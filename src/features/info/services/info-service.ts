import { z } from 'zod';
import type { TripsRepo } from '@/features/trips/repositories/trips-repo';
import type { FileStorage, StoredResourceType } from '@/integrations/cloudinary/types';
import { AppError } from '@/shared/errors';
import { INFO_FILE_EXTENSIONS, INFO_LIMITS, INFO_MAX_FILE_BYTES, INFO_MAX_ITEMS, INFO_STORAGE_FOLDER } from '../constants';
import type { InfosRepo, NewTripInfo, TripInfo } from '../repositories/infos-repo';

export interface InfoDeps {
  infos: InfosRepo;
  /** null khi chưa cấu hình Cloudinary: ghi chú/link vẫn dùng được, tệp thì không. */
  storage: FileStorage | null;
  trips: Pick<TripsRepo, 'getTrip'>;
}

/** Mục gửi về client: tệp kèm link xem/tải đã ký. */
export type InfoItem = TripInfo & { viewUrl: string | null; downloadUrl: string | null };

const invalid = (message: string) => new AppError('INFO_INVALID', message);
const httpUrl = z.url({ protocol: /^https?$/ }).max(INFO_LIMITS.url);

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

function extensionOf(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Upload tệp vào thư mục của chuyến rồi lưu metadata; ghi DB lỗi thì xóa tệp để không để rác trên Cloudinary. */
export async function addFile(deps: InfoDeps, input: { tripId: string; title: string; file: { name: string; data: Uint8Array } }): Promise<TripInfo> {
  if (!deps.storage) throw new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu tệp (Cloudinary). Liên hệ admin.');
  const name = input.file.name.trim().slice(0, INFO_LIMITS.fileName);
  const ext = extensionOf(name);
  if (!ext || !(INFO_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw invalid(`Chỉ nhận tệp: ${INFO_FILE_EXTENSIONS.join(', ')}.`);
  }
  if (input.file.data.byteLength === 0) throw invalid('Tệp rỗng.');
  if (input.file.data.byteLength > INFO_MAX_FILE_BYTES) throw invalid(`Tệp quá lớn (tối đa ${INFO_MAX_FILE_BYTES / 1_000_000} MB).`);
  const title = cleanTitle(input.title || name);
  await assertWritable(deps, input.tripId);

  const stored = await deps.storage.upload(input.file.data, { folder: `${INFO_STORAGE_FOLDER}/${input.tripId}` });
  const row: NewTripInfo = {
    trip_id: input.tripId,
    kind: 'file',
    title,
    file_public_id: stored.publicId,
    file_resource_type: stored.resourceType,
    file_format: stored.format,
    file_bytes: stored.bytes,
    file_name: name,
  };
  try {
    return await deps.infos.insert(row);
  } catch (e) {
    await deps.storage.destroy(stored.publicId, stored.resourceType).catch((err) => console.error('[info] không dọn được tệp', err));
    throw e;
  }
}

export async function listInfos(deps: InfoDeps, tripId: string): Promise<InfoItem[]> {
  const rows = await deps.infos.list(tripId);
  return rows.map((r) => {
    if (r.kind !== 'file' || !r.file_public_id || !deps.storage) return { ...r, viewUrl: null, downloadUrl: null };
    const file = { publicId: r.file_public_id, resourceType: r.file_resource_type as StoredResourceType, format: r.file_format };
    return { ...r, viewUrl: deps.storage.signedUrl(file), downloadUrl: deps.storage.signedUrl(file, { downloadName: r.file_name ?? undefined }) };
  });
}

/** Xóa mục; tệp trên Cloudinary dọn sau, lỗi dọn chỉ ghi log (mục đã biến mất với người dùng). */
export async function removeInfo(deps: InfoDeps, id: string): Promise<void> {
  const removed = await deps.infos.remove(id);
  if (!removed) throw new AppError('NOT_FOUND', 'Không tìm thấy mục thông tin.');
  if (removed.kind === 'file' && removed.file_public_id && deps.storage) {
    await deps.storage
      .destroy(removed.file_public_id, removed.file_resource_type as StoredResourceType)
      .catch((err) => console.error('[info] không xóa được tệp trên Cloudinary', err));
  }
}
