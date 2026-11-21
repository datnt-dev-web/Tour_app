import { describe, expect, test, vi } from 'vitest';
import { INFO_MAX_FILE_BYTES, INFO_MAX_ITEMS } from '@/features/info/constants';
import type { InfosRepo, NewTripInfo, TripInfo } from '@/features/info/repositories/infos-repo';
import { addFile, addLink, addNote, fileLink, removeInfo, type InfoDeps } from '@/features/info/services/info-service';
import type { FileStorage, StoredFile } from '@/integrations/cloudinary/types';

const TRIP = '00000000-0000-4000-8000-000000000001';

function fakeRepo(existing: TripInfo[] = [], count = existing.length) {
  const rows = [...existing];
  return {
    list: vi.fn(async () => rows),
    get: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    count: vi.fn(async () => count),
    insert: vi.fn(
      async (r: NewTripInfo) =>
        ({ id: 'new', created_at: 't', created_by: 'u', body: null, url: null, file_public_id: null, file_resource_type: null, file_format: null, file_bytes: null, file_name: null, ...r }) as TripInfo,
    ),
    remove: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
  } satisfies InfosRepo;
}

function fakeStorage() {
  return {
    upload: vi.fn(
      async (_d: Uint8Array, o: { folder: string; publicId: string; resourceType: 'image' | 'raw' }): Promise<StoredFile> => ({
        publicId: `${o.folder}/${o.publicId}`,
        resourceType: o.resourceType,
        format: o.resourceType === 'image' ? 'png' : null,
        bytes: 5,
      }),
    ),
    destroy: vi.fn(async () => {}),
    fileUrl: vi.fn((f: { publicId: string }, o: { download: boolean; ttlSec: number }) => `https://signed/${f.publicId}?dl=${o.download}&ttl=${o.ttlSec}`),
  } satisfies FileStorage;
}

function makeDeps(repo = fakeRepo(), storage = fakeStorage(), tripExists = true) {
  const trips = { getTrip: vi.fn(async () => (tripExists ? ({ id: TRIP } as never) : null)) };
  return { infos: repo, storage, trips } satisfies InfoDeps;
}

const file = (name: string, size = 5) => ({ name, data: new Uint8Array(size) });

describe('addNote / addLink', () => {
  test('ghi chú cắt khoảng trắng và lưu đúng loại', async () => {
    const d = makeDeps();
    await addNote(d, { tripId: TRIP, title: '  SĐT chủ nhà  ', body: ' 0900 ' });
    expect(d.infos.insert).toHaveBeenCalledWith({ trip_id: TRIP, kind: 'note', title: 'SĐT chủ nhà', body: '0900' });
  });

  test('link phải là http(s)', async () => {
    const d = makeDeps();
    await expect(addLink(d, { tripId: TRIP, title: 'Sheet', url: 'javascript:alert(1)' })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await addLink(d, { tripId: TRIP, title: 'Sheet', url: 'https://docs.google.com/x' });
    expect(d.infos.insert).toHaveBeenCalledWith({ trip_id: TRIP, kind: 'link', title: 'Sheet', url: 'https://docs.google.com/x', body: null });
  });

  test('tiêu đề rỗng bị từ chối; chuyến đầy thì INFO_FULL', async () => {
    await expect(addNote(makeDeps(), { tripId: TRIP, title: '  ', body: 'x' })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addNote(makeDeps(fakeRepo([], INFO_MAX_ITEMS)), { tripId: TRIP, title: 'a', body: 'x' })).rejects.toMatchObject({ code: 'INFO_FULL' });
  });

  test('chuyến không thấy (không có quyền) thì NOT_FOUND, không ghi', async () => {
    const d = makeDeps(fakeRepo(), fakeStorage(), false);
    await expect(addNote(d, { tripId: TRIP, title: 'a', body: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.infos.insert).not.toHaveBeenCalled();
  });
});

describe('addFile', () => {
  test('tài liệu (kể cả PDF) lên dạng raw, public id giữ đuôi để tải về mở được; tiêu đề trống thì lấy tên tệp', async () => {
    const d = makeDeps();
    await addFile(d, { tripId: TRIP, title: '  ', file: file('Vé tàu.DOCX') });
    const opts = d.storage.upload.mock.calls[0][1];
    expect(opts).toMatchObject({ folder: `food-tour/${TRIP}`, resourceType: 'raw' });
    expect(opts.publicId).toMatch(/^[0-9a-f-]{36}\.docx$/);
    expect(d.infos.insert).toHaveBeenCalledWith({
      trip_id: TRIP, kind: 'file', title: 'Vé tàu.DOCX', file_public_id: `food-tour/${TRIP}/${opts.publicId}`, file_resource_type: 'raw', file_format: 'docx', file_bytes: 5, file_name: 'Vé tàu.DOCX',
    });
    await addFile(d, { tripId: TRIP, title: 'x', file: file('dat-phong.pdf') });
    expect(d.storage.upload.mock.calls[1][1]).toMatchObject({ resourceType: 'raw' });
  });

  test('ảnh lên dạng image; Cloudinary nhận ra không phải ảnh thật (vd. SVG đổi tên .png) thì xóa và từ chối', async () => {
    const d = makeDeps();
    await addFile(d, { tripId: TRIP, title: 'x', file: file('ve.png') });
    expect(d.storage.upload.mock.calls[0][1]).toMatchObject({ resourceType: 'image' });
    d.storage.upload.mockResolvedValueOnce({ publicId: `food-tour/${TRIP}/evil`, resourceType: 'image', format: 'svg', bytes: 5 });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('evil.png') })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    expect(d.storage.destroy).toHaveBeenCalledWith(`food-tour/${TRIP}/evil`, 'image');
  });

  test('tên tệp rất dài vẫn giữ được đuôi', async () => {
    const d = makeDeps();
    await addFile(d, { tripId: TRIP, title: 'x', file: file(`${'a'.repeat(300)}.pdf`) });
    const row = d.infos.insert.mock.calls[0][0];
    expect(row.file_name!.length).toBeLessThanOrEqual(255);
    expect(row.file_name).toMatch(/\.pdf$/);
  });

  test('đuôi không cho phép, tệp rỗng hoặc quá lớn bị từ chối trước khi upload', async () => {
    const d = makeDeps();
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('virus.exe') })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('khongduoi') })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf', 0) })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf', INFO_MAX_FILE_BYTES + 1) })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    expect(d.storage.upload).not.toHaveBeenCalled();
  });

  test('chưa cấu hình Cloudinary thì UPLOAD_DISABLED', async () => {
    const d = { ...makeDeps(), storage: null };
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toMatchObject({ code: 'UPLOAD_DISABLED' });
  });

  test('chuyến không có quyền: không upload gì', async () => {
    const d = makeDeps(fakeRepo(), fakeStorage(), false);
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.storage.upload).not.toHaveBeenCalled();
  });

  test('ghi DB lỗi thì xóa tệp vừa upload rồi ném lỗi', async () => {
    const d = makeDeps();
    d.infos.insert.mockRejectedValueOnce(new Error('db down'));
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toThrow('db down');
    expect(d.storage.destroy).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^food-tour/${TRIP}/.+\\.pdf$`)), 'raw');
  });
});

describe('fileLink / removeInfo', () => {
  const stored = {
    id: 'f1', trip_id: TRIP, kind: 'file', title: 'Vé', body: null, url: null, file_public_id: `food-tour/${TRIP}/p1.pdf`,
    file_resource_type: 'raw', file_format: 'pdf', file_bytes: 9, file_name: 've.pdf', created_at: 't', created_by: 'u',
  } as TripInfo;
  const note = { ...stored, id: 'n1', kind: 'note', body: 'x', file_public_id: null, file_resource_type: null, file_format: null, file_bytes: null, file_name: null } as TripInfo;
  const foreign = { ...stored, id: 'f2', file_public_id: 'food-tour/00000000-0000-4000-8000-0000000000ff/x.pdf' } as TripInfo;

  test('ký link có hạn ngay lúc bấm: xem hoặc tải về', async () => {
    const d = makeDeps(fakeRepo([stored]));
    expect(await fileLink(d, 'f1', false, 300)).toBe(`https://signed/food-tour/${TRIP}/p1.pdf?dl=false&ttl=300`);
    expect(await fileLink(d, 'f1', true, 300)).toBe(`https://signed/food-tour/${TRIP}/p1.pdf?dl=true&ttl=300`);
  });

  test('không phải tệp, không thấy, hoặc public id ngoài thư mục chuyến (ghi tay qua API) → NOT_FOUND, không ký', async () => {
    const d = makeDeps(fakeRepo([stored, note, foreign]));
    for (const id of ['n1', 'nope', 'f2']) await expect(fileLink(d, id, false, 300)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.storage.fileUrl).not.toHaveBeenCalled();
  });

  test('xóa tệp thì dọn asset; lỗi dọn asset không làm hỏng thao tác xóa', async () => {
    const d = makeDeps(fakeRepo([stored]));
    d.storage.destroy.mockRejectedValueOnce(new Error('cloud down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(removeInfo(d, 'f1')).resolves.toBeUndefined();
    expect(d.storage.destroy).toHaveBeenCalledWith(`food-tour/${TRIP}/p1.pdf`, 'raw');
    spy.mockRestore();
  });

  test('xóa mục có public id ngoài thư mục chuyến: xóa dòng nhưng không đụng tệp của người khác', async () => {
    const d = makeDeps(fakeRepo([foreign]));
    await removeInfo(d, 'f2');
    expect(d.storage.destroy).not.toHaveBeenCalled();
  });

  test('xóa mục không có thì NOT_FOUND', async () => {
    await expect(removeInfo(makeDeps(), 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
