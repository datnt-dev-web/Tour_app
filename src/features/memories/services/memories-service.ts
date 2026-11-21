import type { DirectUploadStorage, FileStorage, UploadTicket } from '@/integrations/cloudinary/types';
import { AppError } from '@/shared/errors';
import {
  MEMORY_BATCH_MAX,
  MEMORY_DOWNLOAD_TTL_SEC,
  MEMORY_FORMATS,
  MEMORY_FULL_WIDTH,
  MEMORY_MAX_BYTES,
  MEMORY_MAX_PER_TRIP,
  MEMORY_THUMB_WIDTH,
  memoryFolder,
} from '../constants';
import type { TripPhoto, TripPhotosRepo } from '../repositories/trip-photos-repo';

export interface MemoriesDeps {
  photos: TripPhotosRepo;
  /** Đọc chuyến bằng quyền người gọi (RLS): null là không có hoặc không thuộc nhóm. */
  findTrip(tripId: string): Promise<{ id: string } | null>;
  storage: (FileStorage & DirectUploadStorage) | null;
}

export type TripPhotoView = Pick<TripPhoto, 'id' | 'user_id' | 'created_at' | 'width' | 'height'> & {
  thumbUrl: string;
  fullUrl: string;
  downloadUrl: string;
};

const invalid = (m: string) => new AppError('MEMORY_INVALID', m);
const includes = (list: readonly string[], v: string) => list.includes(v);
/** Dòng có thể bị ghi tay qua API: chỉ tin public id nằm trong thư mục ảnh của chính chuyến. */
const owns = (r: Pick<TripPhoto, 'trip_id' | 'file_public_id'>) => r.file_public_id.startsWith(`${memoryFolder(r.trip_id)}/`);

function storageOf(deps: MemoriesDeps) {
  if (!deps.storage) throw new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu ảnh (Cloudinary). Liên hệ admin.');
  return deps.storage;
}

async function assertTrip(deps: MemoriesDeps, tripId: string) {
  if (!(await deps.findTrip(tripId))) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
}

/** Vé tải thẳng lên Cloudinary cho `count` ảnh; chặn trước khi chuyến đầy. */
export async function prepareMemoryUploads(deps: MemoriesDeps, input: { tripId: string; count: number }): Promise<UploadTicket[]> {
  const storage = storageOf(deps);
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > MEMORY_BATCH_MAX) throw invalid(`Mỗi lần chọn tối đa ${MEMORY_BATCH_MAX} ảnh.`);
  await assertTrip(deps, input.tripId);
  if ((await deps.photos.count(input.tripId)) + input.count > MEMORY_MAX_PER_TRIP) throw invalid(`Mỗi chuyến tối đa ${MEMORY_MAX_PER_TRIP} ảnh.`);
  return Array.from({ length: input.count }, () => storage.signUpload({ folder: memoryFolder(input.tripId), resourceType: 'image' }));
}

/** Ghi nhận ảnh trình duyệt vừa tải lên: kiểm thư mục, có thật trên Cloudinary, đúng định dạng và dung lượng. */
export async function addMemory(deps: MemoriesDeps, input: { tripId: string; publicId: string }): Promise<TripPhotoView> {
  const storage = storageOf(deps);
  if (!owns({ trip_id: input.tripId, file_public_id: input.publicId })) throw invalid('Ảnh không thuộc chuyến này.');
  await assertTrip(deps, input.tripId);
  const file = await storage.inspect(input.publicId, 'image');
  if (!file) throw invalid('Chưa thấy ảnh trên kho lưu, thử tải lại.');
  const discard = () => storage.destroy(input.publicId, 'image').catch((e) => console.error('[memories] không dọn được ảnh', e));
  if (!includes(MEMORY_FORMATS, file.format ?? '')) {
    await discard();
    throw invalid('Tệp không phải ảnh hợp lệ.');
  }
  if (file.bytes > MEMORY_MAX_BYTES) {
    await discard();
    throw invalid(`Ảnh quá lớn (tối đa ${MEMORY_MAX_BYTES / 1_000_000} MB).`);
  }
  try {
    const row = await deps.photos.insert({ trip_id: input.tripId, file_public_id: input.publicId, file_format: file.format, width: file.width, height: file.height });
    return toView(storage, row);
  } catch (e) {
    await discard();
    throw e;
  }
}

function toView(storage: FileStorage, r: TripPhoto): TripPhotoView {
  const file = { publicId: r.file_public_id, resourceType: 'image' as const, format: r.file_format };
  return {
    id: r.id,
    user_id: r.user_id,
    created_at: r.created_at,
    width: r.width,
    height: r.height,
    thumbUrl: storage.imageUrl(file, { width: MEMORY_THUMB_WIDTH }),
    fullUrl: storage.imageUrl(file, { width: MEMORY_FULL_WIDTH }),
    downloadUrl: storage.fileUrl(file, { download: true, ttlSec: MEMORY_DOWNLOAD_TTL_SEC }),
  };
}

export async function listMemories(deps: MemoriesDeps, tripId: string): Promise<TripPhotoView[]> {
  if (!deps.storage) return [];
  const storage = deps.storage;
  return (await deps.photos.list(tripId)).filter(owns).map((r) => toView(storage, r));
}

/** Xóa ảnh (thành viên nhóm nào cũng xóa được, như ảnh quán); tệp trên Cloudinary dọn sau, lỗi chỉ ghi log. */
export async function removeMemory(deps: MemoriesDeps, id: string): Promise<void> {
  const removed = await deps.photos.remove(id);
  if (!removed) throw new AppError('NOT_FOUND', 'Không tìm thấy ảnh.');
  if (owns(removed) && deps.storage) await deps.storage.destroy(removed.file_public_id, 'image').catch((e) => console.error('[memories] không xóa được ảnh', e));
}
