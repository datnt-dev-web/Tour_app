import { randomUUID } from 'node:crypto';
import type { FileStorage } from '@/integrations/cloudinary/types';
import { AppError } from '@/shared/errors';
import type { PhotosRepo, PlacePhoto } from '../repositories/photos-repo';

export const PHOTO_MAX_BYTES = 10_000_000;
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
/** Định dạng Cloudinary nhận ra sau upload; khác danh sách (vd. svg đổi tên) thì từ chối. */
const PHOTO_FORMATS = ['jpg', 'png', 'webp', 'heic', 'heif', 'gif'];
/** Ảnh thu nhỏ cho lưới và ảnh lớn khi bấm xem (Cloudinary tự đổi cỡ, chuyển định dạng nhẹ). */
export const THUMB_WIDTH = 400;
export const FULL_WIDTH = 1600;

export interface PhotoDeps {
  photos: PhotosRepo;
  storage: FileStorage;
}

export type PlacePhotoView = PlacePhoto & { thumbUrl: string; fullUrl: string };

const folderOf = (placeId: string) => `food-tour/places/${placeId}`;
const invalid = (m: string) => new AppError('PHOTO_INVALID', m);
/** Dòng có thể bị ghi tay qua API: chỉ tin public id nằm trong thư mục của chính quán. */
const owns = (r: PlacePhoto) => r.file_public_id.startsWith(`${folderOf(r.place_id)}/`);

export async function addPlacePhoto(deps: PhotoDeps, input: { placeId: string; tripId?: string | null; file: { name: string; data: Uint8Array } }): Promise<PlacePhoto> {
  const ext = /\.([a-z0-9]+)$/i.exec(input.file.name.trim())?.[1]?.toLowerCase();
  if (!ext || !PHOTO_EXTENSIONS.includes(ext)) throw invalid('Chỉ nhận ảnh (jpg, png, webp, heic, gif).');
  if (input.file.data.byteLength === 0) throw invalid('Ảnh rỗng.');
  if (input.file.data.byteLength > PHOTO_MAX_BYTES) throw invalid(`Ảnh quá lớn (tối đa ${PHOTO_MAX_BYTES / 1_000_000} MB).`);
  if (!(await deps.photos.placeExists(input.placeId))) throw new AppError('NOT_FOUND', 'Không tìm thấy quán.');

  const stored = await deps.storage.upload(input.file.data, { folder: folderOf(input.placeId), publicId: randomUUID(), resourceType: 'image' });
  const discard = () => deps.storage.destroy(stored.publicId, 'image').catch((e) => console.error('[photo] không dọn được ảnh', e));
  if (!PHOTO_FORMATS.includes(stored.format ?? '')) {
    await discard();
    throw invalid('Tệp không phải ảnh hợp lệ.');
  }
  try {
    return await deps.photos.insert({ place_id: input.placeId, trip_id: input.tripId ?? null, file_public_id: stored.publicId, file_format: stored.format });
  } catch (e) {
    await discard();
    throw e;
  }
}

export async function listPlacePhotos(deps: PhotoDeps, placeId: string): Promise<PlacePhotoView[]> {
  const rows = await deps.photos.list(placeId);
  return rows.filter(owns).map((r) => {
    const file = { publicId: r.file_public_id, resourceType: 'image' as const, format: r.file_format };
    return { ...r, thumbUrl: deps.storage.imageUrl(file, { width: THUMB_WIDTH }), fullUrl: deps.storage.imageUrl(file, { width: FULL_WIDTH }) };
  });
}

export async function removePlacePhoto(deps: PhotoDeps, id: string): Promise<void> {
  const removed = await deps.photos.remove(id);
  if (!removed) throw new AppError('NOT_FOUND', 'Không tìm thấy ảnh.');
  if (owns(removed)) await deps.storage.destroy(removed.file_public_id, 'image').catch((e) => console.error('[photo] không xóa được ảnh', e));
}
