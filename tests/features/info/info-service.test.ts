import { describe, expect, test, vi } from 'vitest';
import { INFO_MAX_FILE_BYTES, INFO_MAX_ITEMS } from '@/features/info/constants';
import type { InfosRepo, NewTripInfo, TripInfo } from '@/features/info/repositories/infos-repo';
import { addFile, addLink, addNote, listInfos, removeInfo } from '@/features/info/services/info-service';
import type { FileStorage } from '@/integrations/cloudinary/types';

const TRIP = '00000000-0000-4000-8000-000000000001';

function fakeRepo(existing: TripInfo[] = [], count = existing.length) {
  const rows = [...existing];
  return {
    list: vi.fn(async () => rows),
    count: vi.fn(async () => count),
    insert: vi.fn(async (r: NewTripInfo) => ({ id: 'new', created_at: 't', created_by: 'u', body: null, url: null, file_public_id: null, file_resource_type: null, file_format: null, file_bytes: null, file_name: null, ...r }) as TripInfo),
    remove: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
  } satisfies InfosRepo;
}

function fakeStorage() {
  return {
    upload: vi.fn(async () => ({ publicId: 'food-tour/t/abc', resourceType: 'raw' as const, format: 'docx', bytes: 5 })),
    destroy: vi.fn(async () => {}),
    signedUrl: vi.fn((f: { publicId: string }, o?: { downloadName?: string }) => `https://signed/${f.publicId}${o?.downloadName ? `?dl=${o.downloadName}` : ''}`),
  } satisfies FileStorage;
}

const deps = (repo = fakeRepo(), storage: FileStorage | null = fakeStorage(), tripExists = true) => ({
  infos: repo,
  storage,
  trips: { getTrip: vi.fn(async () => (tripExists ? ({ id: TRIP } as never) : null)) },
});

const file = (name: string, size = 5) => ({ name, data: new Uint8Array(size) });

describe('addNote / addLink', () => {
  test('ghi chú cắt khoảng trắng và lưu đúng loại', async () => {
    const d = deps();
    await addNote(d, { tripId: TRIP, title: '  SĐT chủ nhà  ', body: ' 0900 ' });
    expect(d.infos.insert).toHaveBeenCalledWith({ trip_id: TRIP, kind: 'note', title: 'SĐT chủ nhà', body: '0900' });
  });

  test('link phải là http(s)', async () => {
    const d = deps();
    await expect(addLink(d, { tripId: TRIP, title: 'Sheet', url: 'javascript:alert(1)' })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await addLink(d, { tripId: TRIP, title: 'Sheet', url: 'https://docs.google.com/x' });
    expect(d.infos.insert).toHaveBeenCalledWith({ trip_id: TRIP, kind: 'link', title: 'Sheet', url: 'https://docs.google.com/x', body: null });
  });

  test('tiêu đề rỗng bị từ chối; chuyến đầy thì INFO_FULL', async () => {
    await expect(addNote(deps(), { tripId: TRIP, title: '  ', body: 'x' })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addNote(deps(fakeRepo([], INFO_MAX_ITEMS)), { tripId: TRIP, title: 'a', body: 'x' })).rejects.toMatchObject({ code: 'INFO_FULL' });
  });

  test('chuyến không thấy (không có quyền) thì NOT_FOUND, không ghi', async () => {
    const d = deps(fakeRepo(), fakeStorage(), false);
    await expect(addNote(d, { tripId: TRIP, title: 'a', body: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.infos.insert).not.toHaveBeenCalled();
  });
});

describe('addFile', () => {
  test('upload vào thư mục chuyến rồi lưu metadata; tiêu đề mặc định là tên tệp', async () => {
    const d = deps();
    await addFile(d, { tripId: TRIP, title: '', file: file('Vé tàu.DOCX') });
    expect(d.storage!.upload).toHaveBeenCalledWith(expect.any(Uint8Array), { folder: `food-tour/${TRIP}` });
    expect(d.infos.insert).toHaveBeenCalledWith({
      trip_id: TRIP, kind: 'file', title: 'Vé tàu.DOCX', file_public_id: 'food-tour/t/abc', file_resource_type: 'raw', file_format: 'docx', file_bytes: 5, file_name: 'Vé tàu.DOCX',
    });
  });

  test('đuôi không cho phép, tệp rỗng hoặc quá lớn bị từ chối trước khi upload', async () => {
    const d = deps();
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('virus.exe') })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('khongduoi') })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf', 0) })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf', INFO_MAX_FILE_BYTES + 1) })).rejects.toMatchObject({ code: 'INFO_INVALID' });
    expect(d.storage!.upload).not.toHaveBeenCalled();
  });

  test('chưa cấu hình Cloudinary thì UPLOAD_DISABLED', async () => {
    await expect(addFile(deps(fakeRepo(), null), { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toMatchObject({ code: 'UPLOAD_DISABLED' });
  });

  test('chuyến không có quyền: không upload gì', async () => {
    const d = deps(fakeRepo(), fakeStorage(), false);
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.storage!.upload).not.toHaveBeenCalled();
  });

  test('ghi DB lỗi thì xóa tệp vừa upload rồi ném lỗi', async () => {
    const d = deps();
    d.infos.insert.mockRejectedValueOnce(new Error('db down'));
    await expect(addFile(d, { tripId: TRIP, title: 'x', file: file('a.pdf') })).rejects.toThrow('db down');
    expect(d.storage!.destroy).toHaveBeenCalledWith('food-tour/t/abc', 'raw');
  });
});

describe('listInfos / removeInfo', () => {
  const stored = { id: 'f1', trip_id: TRIP, kind: 'file', title: 'Vé', body: null, url: null, file_public_id: 'p1', file_resource_type: 'image', file_format: 'pdf', file_bytes: 9, file_name: 've.pdf', created_at: 't', created_by: 'u' } as TripInfo;
  const note = { ...stored, id: 'n1', kind: 'note', body: 'x', file_public_id: null, file_resource_type: null, file_format: null, file_bytes: null, file_name: null } as TripInfo;

  test('mục tệp có link xem và link tải ký sẵn; ghi chú thì không', async () => {
    const items = await listInfos(deps(fakeRepo([stored, note])), TRIP);
    expect(items[0]).toMatchObject({ id: 'f1', viewUrl: 'https://signed/p1', downloadUrl: 'https://signed/p1?dl=ve.pdf' });
    expect(items[1]).toMatchObject({ id: 'n1', viewUrl: null, downloadUrl: null });
  });

  test('chưa cấu hình Cloudinary vẫn liệt kê được (tệp không có link)', async () => {
    const items = await listInfos(deps(fakeRepo([stored]), null), TRIP);
    expect(items[0]).toMatchObject({ viewUrl: null, downloadUrl: null });
  });

  test('xóa tệp thì dọn asset; lỗi dọn asset không làm hỏng thao tác xóa', async () => {
    const storage = fakeStorage();
    const d = deps(fakeRepo([stored]), storage);
    storage.destroy.mockRejectedValueOnce(new Error('cloud down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(removeInfo(d, 'f1')).resolves.toBeUndefined();
    expect(d.storage!.destroy).toHaveBeenCalledWith('p1', 'image');
    spy.mockRestore();
  });

  test('xóa mục không có thì NOT_FOUND', async () => {
    await expect(removeInfo(deps(), 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
