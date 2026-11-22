import type { DirectUploadStorage, FileStorage, UploadTicket } from '@/integrations/cloudinary/types';
import { AppError } from '@/shared/errors';
import type { PhotosRepo, PlacePhoto } from '../repositories/photos-repo';

/** Tải thẳng lên Cloudinary nên không vướng giới hạn 4,5 MB của Vercel; ảnh điện thoại độ phân giải cao vẫn vừa. */
export const PHOTO_MAX_BYTES = 25_000_000;
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
/** Định dạng Cloudinary nhận ra sau upload; khác danh sách (vd. svg đổi tên) thì từ chối. */
const PHOTO_FORMATS = ['jpg', 'png', 'webp', 'heic', 'heif', 'gif'];
/** Ảnh thu nhỏ cho lưới và ảnh lớn khi bấm xem (Cloudinary tự đổi cỡ, chuyển định dạng nhẹ). */
export const THUMB_WIDTH = 400;
export const FULL_WIDTH = 1600;

export interface PhotoDeps {
  photos: PhotosRepo;
  storage: FileStorage & DirectUploadStorage;
}

export type PlacePhotoView = PlacePhoto & { thumbUrl: string; fullUrl: string };

const folderOf = (placeId: string) => `food-tour/places/${placeId}`;
const invalid = (m: string) => new AppError('PHOTO_INVALID', m);
/** Dòng có thể bị ghi tay qua API: chỉ tin public id nằm trong thư mục của chính quán. */
const owns = (r: Pick<PlacePhoto, 'place_id' | 'file_public_id'>) => r.file_public_id.startsWith(`${folderOf(r.place_id)}/`);

/** Bước 1: vé để trình duyệt tải thẳng ảnh lên Cloudinary (ảnh điện thoại vượt giới hạn 4,5 MB của Vercel). */
export async function preparePlacePhotoUpload(deps: PhotoDeps, input: { placeId: string; fileName: string; size: number }): Promise<UploadTicket> {
  const ext = /\.([a-z0-9]+)$/i.exec(input.fileName.trim())?.[1]?.toLowerCase();
  if (!ext || !PHOTO_EXTENSIONS.includes(ext)) throw invalid('Chỉ nhận ảnh (jpg, png, webp, heic, gif).');
  if (input.size <= 0) throw invalid('Ảnh rỗng.');
  if (input.size > PHOTO_MAX_BYTES) throw invalid(`Ảnh quá lớn (tối đa ${PHOTO_MAX_BYTES / 1_000_000} MB).`);
  if (!(await deps.photos.placeExists(input.placeId))) throw new AppError('NOT_FOUND', 'Không tìm thấy quán.');
  return deps.storage.signUpload({ folder: folderOf(input.placeId), resourceType: 'image' });
}

/** Bước 2: ghi nhận ảnh vừa tải: đúng thư mục quán, có thật, đúng định dạng và dung lượng; lỗi thì dọn ảnh. */
export async function addPlacePhoto(deps: PhotoDeps, input: { placeId: string; tripId?: string | null; publicId: string }): Promise<PlacePhoto> {
  if (!owns({ place_id: input.placeId, file_public_id: input.publicId })) throw invalid('Ảnh không thuộc quán này.');
  if (!(await deps.photos.placeExists(input.placeId))) throw new AppError('NOT_FOUND', 'Không tìm thấy quán.');
  const stored = await deps.storage.inspect(input.publicId, 'image');
  if (!stored) throw invalid('Chưa thấy ảnh trên kho lưu, thử tải lại.');
  const discard = () => deps.storage.destroy(input.publicId, 'image').catch((e) => console.error('[photo] không dọn được ảnh', e));
  if (!PHOTO_FORMATS.includes(stored.format ?? '') || stored.bytes > PHOTO_MAX_BYTES) {
    await discard();
    throw invalid(stored.bytes > PHOTO_MAX_BYTES ? `Ảnh quá lớn (tối đa ${PHOTO_MAX_BYTES / 1_000_000} MB).` : 'Tệp không phải ảnh hợp lệ.');
  }
  try {
    return await deps.photos.insert({ place_id: input.placeId, trip_id: input.tripId ?? null, file_public_id: input.publicId, file_format: stored.format });
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
