import { describe, expect, test, vi } from 'vitest';
import { addPlacePhoto, listPlacePhotos, PHOTO_MAX_BYTES, removePlacePhoto } from '@/features/places/services/photo-service';
import type { PlacePhoto } from '@/features/places/repositories/photos-repo';

const PLACE = '00000000-0000-4000-8000-0000000000aa';
const row = (id: string, publicId = `food-tour/places/${PLACE}/${id}`): PlacePhoto => ({
  id, place_id: PLACE, trip_id: null, user_id: 'u1', file_public_id: publicId, file_format: 'jpg', created_at: 't',
});

function makeDeps(rows: PlacePhoto[] = [], placeExists = true) {
  return {
    photos: {
      placeExists: vi.fn(async () => placeExists),
      list: vi.fn(async () => rows),
      insert: vi.fn(async (r: Omit<PlacePhoto, 'id' | 'created_at' | 'user_id'>) => ({ ...r, id: 'new', created_at: 't', user_id: 'u1' }) as PlacePhoto),
      remove: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    },
    storage: {
      upload: vi.fn(async (_d: Uint8Array, o: { folder: string; publicId: string; resourceType: 'image' | 'raw' }) => ({
        publicId: `${o.folder}/${o.publicId}`, resourceType: o.resourceType, format: 'jpg' as string | null, bytes: 5,
      })),
      destroy: vi.fn(async () => {}),
      fileUrl: vi.fn(() => 'x'),
      imageUrl: vi.fn((f: { publicId: string }, o: { width: number }) => `https://img/${o.width}/${f.publicId}`),
    },
  };
}
const img = (name: string, size = 5) => ({ name, data: new Uint8Array(size) });

describe('addPlacePhoto', () => {
  test('ảnh vào thư mục của quán, lưu metadata kèm chuyến', async () => {
    const d = makeDeps();
    await addPlacePhoto(d, { placeId: PLACE, tripId: 't1', file: img('IMG_001.JPG') });
    expect(d.storage.upload.mock.calls[0][1]).toMatchObject({ folder: `food-tour/places/${PLACE}`, resourceType: 'image' });
    expect(d.photos.insert).toHaveBeenCalledWith(expect.objectContaining({ place_id: PLACE, trip_id: 't1', file_format: 'jpg' }));
  });

  test('không phải ảnh, quá lớn, hoặc quán không thuộc nhóm → không upload', async () => {
    const d = makeDeps();
    await expect(addPlacePhoto(d, { placeId: PLACE, file: img('a.pdf') })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    await expect(addPlacePhoto(d, { placeId: PLACE, file: img('a.jpg', PHOTO_MAX_BYTES + 1) })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    await expect(addPlacePhoto(makeDeps([], false), { placeId: PLACE, file: img('a.jpg') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.storage.upload).not.toHaveBeenCalled();
  });

  test('Cloudinary nhận ra không phải ảnh thật → xóa và từ chối', async () => {
    const d = makeDeps();
    d.storage.upload.mockResolvedValueOnce({ publicId: `food-tour/places/${PLACE}/x`, resourceType: 'image', format: 'svg', bytes: 5 });
    await expect(addPlacePhoto(d, { placeId: PLACE, file: img('x.png') })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    expect(d.storage.destroy).toHaveBeenCalled();
    expect(d.photos.insert).not.toHaveBeenCalled();
  });
});

describe('listPlacePhotos / removePlacePhoto', () => {
  test('kèm link ảnh thu nhỏ và ảnh lớn; bỏ qua ảnh có public id ngoài thư mục quán', async () => {
    const out = await listPlacePhotos(makeDeps([row('p1'), row('p2', 'food-tour/places/khac/x')]), PLACE);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'p1', thumbUrl: `https://img/400/food-tour/places/${PLACE}/p1`, fullUrl: `https://img/1600/food-tour/places/${PLACE}/p1` });
  });

  test('xóa ảnh thì dọn Cloudinary; không có → NOT_FOUND', async () => {
    const d = makeDeps([row('p1')]);
    await removePlacePhoto(d, 'p1');
    expect(d.storage.destroy).toHaveBeenCalledWith(`food-tour/places/${PLACE}/p1`, 'image');
    await expect(removePlacePhoto(makeDeps(), 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
