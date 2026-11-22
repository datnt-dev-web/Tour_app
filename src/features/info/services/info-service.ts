import { z } from 'zod';
import type { TripsRepo } from '@/features/trips/repositories/trips-repo';
import type { DirectUploadStorage, FileStorage, StoredResourceType, UploadTicket } from '@/integrations/cloudinary/types';
import { AppError } from '@/shared/errors';
import {
  INFO_FILE_EXTENSIONS,
  INFO_IMAGE_EXTENSIONS,
  INFO_IMAGE_FORMATS,
  INFO_LIMITS,
  INFO_MAX_FILE_BYTES,
  INFO_MAX_ITEMS,
  INFO_STORAGE_FOLDER,
} from '../constants';
import type { InfosRepo, NewTripInfo, TripInfo } from '../repositories/infos-repo';

export interface InfoDeps {
  infos: InfosRepo;
  /** null khi chưa cấu hình Cloudinary: ghi chú/link vẫn dùng được, tệp thì không. */
  storage: (FileStorage & DirectUploadStorage) | null;
  trips: Pick<TripsRepo, 'getTrip'>;
}

const invalid = (message: string) => new AppError('INFO_INVALID', message);
const httpUrl = z.url({ protocol: /^https?$/ }).max(INFO_LIMITS.url);
const tripFolder = (tripId: string) => `${INFO_STORAGE_FOLDER}/${tripId}`;

/**
 * Tệp chỉ được ký/xóa khi public id nằm trong thư mục của chính chuyến đó. Dòng có thể bị ghi tay qua API
 * (RLS cho thành viên ghi bảng), nên không tin public id lưu trong dòng nếu nó trỏ sang thư mục khác.
 */
const ownsFile = (r: TripInfo): r is TripInfo & { file_public_id: string } =>
  r.kind === 'file' && !!r.file_public_id && r.file_public_id.startsWith(`${tripFolder(r.trip_id)}/`);

function cleanTitle(title: string): string {
  const t = title.trim();
  if (!t) throw invalid('Cần nhập tiêu đề.');
  if (t.length > INFO_LIMITS.title) throw invalid(`Tiêu đề quá dài (tối đa ${INFO_LIMITS.title} ký tự).`);
  return t;
}

/** Chuyến phải đọc được bằng quyền người gọi (RLS) và chưa đầy; kiểm trước mọi ghi/upload. */
async function assertWritable(deps: InfoDeps, tripId: string) {
  if (!(await deps.trips.getTrip(tripId))) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
  if ((await deps.infos.count(tripId)) >= INFO_MAX_ITEMS) {
    throw new AppError('INFO_FULL', `Mỗi chuyến tối đa ${INFO_MAX_ITEMS} mục thông tin. Xóa bớt mục cũ rồi thêm.`);
  }
}

export async function addNote(deps: InfoDeps, input: { tripId: string; title: string; body: string }): Promise<TripInfo> {
  const title = cleanTitle(input.title);
  const body = input.body.trim();
  if (!body) throw invalid('Cần nhập nội dung ghi chú.');
  if (body.length > INFO_LIMITS.body) throw invalid(`Ghi chú quá dài (tối đa ${INFO_LIMITS.body} ký tự).`);
  await assertWritable(deps, input.tripId);
  return deps.infos.insert({ trip_id: input.tripId, kind: 'note', title, body });
}

export async function addLink(deps: InfoDeps, input: { tripId: string; title: string; url: string; note?: string }): Promise<TripInfo> {
  const title = cleanTitle(input.title);
  const url = input.url.trim();
  if (!httpUrl.safeParse(url).success) throw invalid('Link phải bắt đầu bằng http:// hoặc https://.');
  const body = input.note?.trim() || null;
  if (body && body.length > INFO_LIMITS.body) throw invalid(`Ghi chú quá dài (tối đa ${INFO_LIMITS.body} ký tự).`);
  await assertWritable(deps, input.tripId);
  return deps.infos.insert({ trip_id: input.tripId, kind: 'link', title, url, body });
}

/** Tách tên và đuôi; tên dài thì cắt phần trước đuôi để không mất đuôi. */
function splitName(raw: string): { name: string; ext: string | null } {
  const trimmed = raw.trim();
  const m = /\.([a-z0-9]+)$/i.exec(trimmed);
  if (!m) return { name: trimmed.slice(0, INFO_LIMITS.fileName), ext: null };
  const suffix = m[0];
  return { name: trimmed.slice(0, trimmed.length - suffix.length).slice(0, INFO_LIMITS.fileName - suffix.length) + suffix, ext: m[1].toLowerCase() };
}

const includes = (list: readonly string[], v: string) => list.includes(v);

function storageOf(deps: InfoDeps) {
  if (!deps.storage) throw new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu tệp (Cloudinary). Liên hệ admin.');
  return deps.storage;
}

/** Đuôi hợp lệ → loại asset: ảnh lên image (Cloudinary kiểm định dạng thật), tài liệu lên raw kèm đuôi để tải về mở được. */
function fileKind(fileName: string): { name: string; ext: string; resourceType: 'image' | 'raw' } {
  const { name, ext } = splitName(fileName);
  if (!ext || !includes(INFO_FILE_EXTENSIONS, ext)) throw invalid(`Chỉ nhận tệp: ${INFO_FILE_EXTENSIONS.join(', ')}.`);
  return { name, ext, resourceType: includes(INFO_IMAGE_EXTENSIONS, ext) ? 'image' : 'raw' };
}

/**
 * Bước 1: vé để trình duyệt tải thẳng tệp lên Cloudinary (Vercel giới hạn body request 4,5 MB).
 * Kiểm đuôi, dung lượng và quyền trước để không ký vé vô ích.
 */
export async function prepareInfoUpload(deps: InfoDeps, input: { tripId: string; fileName: string; size: number }): Promise<UploadTicket> {
  const storage = storageOf(deps);
  const { ext, resourceType } = fileKind(input.fileName);
  if (input.size <= 0) throw invalid('Tệp rỗng.');
  if (input.size > INFO_MAX_FILE_BYTES) throw invalid(`Tệp quá lớn (tối đa ${INFO_MAX_FILE_BYTES / 1_000_000} MB).`);
  await assertWritable(deps, input.tripId);
  return storage.signUpload({ folder: tripFolder(input.tripId), resourceType, extension: resourceType === 'raw' ? ext : undefined });
}

/** Bước 2: ghi nhận tệp vừa tải: đúng thư mục chuyến, có thật trên kho, đúng định dạng và dung lượng; lỗi thì dọn tệp. */
export async function addInfoFile(deps: InfoDeps, input: { tripId: string; title: string; fileName: string; publicId: string }): Promise<TripInfo> {
  const storage = storageOf(deps);
  const { name, ext, resourceType } = fileKind(input.fileName);
  const inFolder = input.publicId.startsWith(`${tripFolder(input.tripId)}/`) && !input.publicId.slice(tripFolder(input.tripId).length + 1).includes('/');
  if (!inFolder || (resourceType === 'raw' && !input.publicId.endsWith(`.${ext}`))) throw invalid('Tệp không thuộc chuyến này.');
  const title = cleanTitle(input.title.trim() || name);
  await assertWritable(deps, input.tripId);

  const stored = await storage.inspect(input.publicId, resourceType);
  if (!stored) throw invalid('Chưa thấy tệp trên kho lưu, thử tải lại.');
  const discard = () => storage.destroy(input.publicId, resourceType).catch((err) => console.error('[info] không dọn được tệp', err));
  if (resourceType === 'image' && !includes(INFO_IMAGE_FORMATS, stored.format ?? '')) {
    await discard();
    throw invalid('Tệp không phải ảnh hợp lệ.');
  }
  if (stored.bytes > INFO_MAX_FILE_BYTES) {
    await discard();
    throw invalid(`Tệp quá lớn (tối đa ${INFO_MAX_FILE_BYTES / 1_000_000} MB).`);
  }

  const row: NewTripInfo = {
    trip_id: input.tripId,
    kind: 'file',
    title,
    file_public_id: input.publicId,
    file_resource_type: resourceType,
    file_format: resourceType === 'image' ? stored.format : ext,
    file_bytes: stored.bytes,
    file_name: name,
  };
  try {
    return await deps.infos.insert(row);
  } catch (e) {
    await discard();
    throw e;
  }
}

export function listInfos(deps: InfoDeps, tripId: string): Promise<TripInfo[]> {
  return deps.infos.list(tripId);
}

/** Link xem/tải ký lúc bấm, hết hạn sau ttlSec: danh sách không chứa link nên không có link sống lâu lưu trên máy. */
export async function fileLink(deps: InfoDeps, id: string, download: boolean, ttlSec: number): Promise<string> {
  const row = await deps.infos.get(id);
  if (!row || !ownsFile(row) || !deps.storage) throw new AppError('NOT_FOUND', 'Không tìm thấy tệp.');
  const file = { publicId: row.file_public_id, resourceType: row.file_resource_type as StoredResourceType, format: row.file_format };
  return deps.storage.fileUrl(file, { download, ttlSec });
}

/** Xóa mục; tệp trên Cloudinary dọn sau, lỗi dọn chỉ ghi log (mục đã biến mất với người dùng). */
export async function removeInfo(deps: InfoDeps, id: string): Promise<void> {
  const removed = await deps.infos.remove(id);
  if (!removed) throw new AppError('NOT_FOUND', 'Không tìm thấy mục thông tin.');
  if (ownsFile(removed) && deps.storage) {
    await deps.storage
      .destroy(removed.file_public_id, removed.file_resource_type as StoredResourceType)
      .catch((err) => console.error('[info] không xóa được tệp trên Cloudinary', err));
  }
}
