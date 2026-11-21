import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { TripsRepo } from '@/features/trips/repositories/trips-repo';
import type { FileStorage, StoredResourceType } from '@/integrations/cloudinary/types';
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
  storage: FileStorage | null;
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

/** Upload tệp vào thư mục của chuyến rồi lưu metadata; ghi DB lỗi thì xóa tệp để không để rác trên Cloudinary. */
export async function addFile(deps: InfoDeps, input: { tripId: string; title: string; file: { name: string; data: Uint8Array } }): Promise<TripInfo> {
  const storage = deps.storage;
  if (!storage) throw new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu tệp (Cloudinary). Liên hệ admin.');
  const { name, ext } = splitName(input.file.name);
  if (!ext || !includes(INFO_FILE_EXTENSIONS, ext)) throw invalid(`Chỉ nhận tệp: ${INFO_FILE_EXTENSIONS.join(', ')}.`);
  if (input.file.data.byteLength === 0) throw invalid('Tệp rỗng.');
  if (input.file.data.byteLength > INFO_MAX_FILE_BYTES) throw invalid(`Tệp quá lớn (tối đa ${INFO_MAX_FILE_BYTES / 1_000_000} MB).`);
  const title = cleanTitle(input.title.trim() || name);
  await assertWritable(deps, input.tripId);

  // Ảnh lên dạng image (Cloudinary kiểm định dạng thật); tài liệu lên raw với đuôi trong public id để tải về mở được.
  const isImage = includes(INFO_IMAGE_EXTENSIONS, ext);
  const stored = await storage.upload(input.file.data, {
    folder: tripFolder(input.tripId),
    publicId: isImage ? randomUUID() : `${randomUUID()}.${ext}`,
    resourceType: isImage ? 'image' : 'raw',
  });
  const discard = () => storage.destroy(stored.publicId, stored.resourceType).catch((err) => console.error('[info] không dọn được tệp', err));
  if (isImage && !includes(INFO_IMAGE_FORMATS, stored.format ?? '')) {
    await discard();
    throw invalid('Tệp không phải ảnh hợp lệ.');
  }

  const row: NewTripInfo = {
    trip_id: input.tripId,
    kind: 'file',
    title,
    file_public_id: stored.publicId,
    file_resource_type: stored.resourceType,
    file_format: isImage ? stored.format : ext,
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
