import { describe, expect, test, vi } from 'vitest';
import type { InspectedFile } from '@/integrations/cloudinary/types';
import type { TripPhoto, TripPhotosRepo } from '@/features/memories/repositories/trip-photos-repo';
import { addMemory, listMemories, prepareMemoryUploads, removeMemory, type MemoriesDeps } from '@/features/memories/services/memories-service';

const TRIP = '11111111-1111-1111-1111-111111111111';
const folder = `food-tour/${TRIP}/photos`;

function fakes(opts: { inspected?: Partial<InspectedFile> | null; tripExists?: boolean; count?: number } = {}) {
  const rows: TripPhoto[] = [];
  const photos: TripPhotosRepo = {
    list: vi.fn(async () => rows),
    count: vi.fn(async () => opts.count ?? rows.length),
    insert: vi.fn(async (r) => {
      const row = { ...r, id: `p${rows.length + 1}`, user_id: 'u1', created_at: '2026-11-23T00:00:00Z' } as TripPhoto;
      rows.push(row);
      return row;
    }),
    remove: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
  };
  const storage = {
    upload: vi.fn(),
    destroy: vi.fn(async () => {}),
    fileUrl: vi.fn(() => 'download-url'),
    imageUrl: vi.fn((_f, { width }: { width: number }) => `img-${width}`),
    signUpload: vi.fn(({ folder: f }: { folder: string }) => ({ url: 'u', fields: {}, publicId: `${f}/x` })),
    inspect: vi.fn(async () => (opts.inspected === null ? null : { publicId: 'p', resourceType: 'image' as const, format: 'jpg', bytes: 1000, width: 4000, height: 3000, durationSec: null, isAudio: false, ...opts.inspected })),
    mediaUrl: vi.fn(),
  };
  const deps: MemoriesDeps = { photos, storage, findTrip: vi.fn(async (id) => (opts.tripExists === false ? null : { id })) };
  return { deps, photos, storage, rows };
}

describe('memories', () => {
  test('ký đúng số vé vào thư mục ảnh của chuyến; quá số lượng mỗi lần hoặc đầy chuyến thì từ chối', async () => {
    const f = fakes();
    const tickets = await prepareMemoryUploads(f.deps, { tripId: TRIP, count: 3 });
    expect(tickets).toHaveLength(3);
    expect(f.storage.signUpload).toHaveBeenCalledWith({ folder, resourceType: 'image' });
    await expect(prepareMemoryUploads(f.deps, { tripId: TRIP, count: 31 })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
    await expect(prepareMemoryUploads(fakes({ count: 999 }).deps, { tripId: TRIP, count: 2 })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
    await expect(prepareMemoryUploads(fakes({ tripExists: false }).deps, { tripId: TRIP, count: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('ghi nhận ảnh hợp lệ kèm kích thước, trả link thu nhỏ/lớn/tải về', async () => {
    const f = fakes();
    const view = await addMemory(f.deps, { tripId: TRIP, publicId: `${folder}/abc` });
    expect(f.photos.insert).toHaveBeenCalledWith({ trip_id: TRIP, file_public_id: `${folder}/abc`, file_format: 'jpg', width: 4000, height: 3000 });
    expect(view).toMatchObject({ thumbUrl: 'img-400', fullUrl: 'img-1600', downloadUrl: 'download-url' });
  });

  test('public id ngoài thư mục của chuyến bị từ chối mà không đụng tới kho', async () => {
    const f = fakes();
    await expect(addMemory(f.deps, { tripId: TRIP, publicId: 'food-tour/khac/photos/abc' })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
    await expect(addMemory(f.deps, { tripId: TRIP, publicId: `food-tour/${TRIP}/photos-x/abc` })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
    expect(f.storage.inspect).not.toHaveBeenCalled();
  });

  test('chưa có trên kho thì báo lỗi; sai định dạng hoặc quá nặng thì xóa tệp và không ghi DB', async () => {
    await expect(addMemory(fakes({ inspected: null }).deps, { tripId: TRIP, publicId: `${folder}/a` })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
    for (const inspected of [{ format: 'svg' }, { bytes: 30_000_000 }]) {
      const f = fakes({ inspected });
      await expect(addMemory(f.deps, { tripId: TRIP, publicId: `${folder}/a` })).rejects.toMatchObject({ code: 'MEMORY_INVALID' });
      expect(f.storage.destroy).toHaveBeenCalledWith(`${folder}/a`, 'image');
      expect(f.photos.insert).not.toHaveBeenCalled();
    }
  });

  test('ghi DB lỗi thì dọn tệp đã tải', async () => {
    const f = fakes();
    vi.mocked(f.photos.insert).mockRejectedValueOnce(new Error('db'));
    await expect(addMemory(f.deps, { tripId: TRIP, publicId: `${folder}/a` })).rejects.toThrow('db');
    expect(f.storage.destroy).toHaveBeenCalledWith(`${folder}/a`, 'image');
  });

  test('danh sách bỏ dòng trỏ ra ngoài thư mục; xóa thì dọn cả tệp', async () => {
    const f = fakes();
    await addMemory(f.deps, { tripId: TRIP, publicId: `${folder}/a` });
    f.rows.push({ ...f.rows[0], id: 'evil', file_public_id: 'food-tour/khac/photos/b' });
    expect((await listMemories(f.deps, TRIP)).map((p) => p.id)).toEqual(['p1']);
    await removeMemory(f.deps, 'p1');
    expect(f.storage.destroy).toHaveBeenCalledWith(`${folder}/a`, 'image');
    await expect(removeMemory(f.deps, 'none')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
