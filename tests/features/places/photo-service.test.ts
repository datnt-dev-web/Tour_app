import { describe, expect, test, vi } from 'vitest';
import { addPlacePhoto, listPlacePhotos, PHOTO_MAX_BYTES, preparePlacePhotoUpload, removePlacePhoto } from '@/features/places/services/photo-service';
import type { InspectedFile } from '@/integrations/cloudinary/types';
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
      signUpload: vi.fn((o: { folder: string }) => ({ url: 'u', fields: {}, publicId: `${o.folder}/x` })),
      inspect: vi.fn(async (): Promise<InspectedFile | null> => ok),
      mediaUrl: vi.fn(() => 'm'),
    },
  };
}
const ok: InspectedFile = { publicId: 'p', resourceType: 'image', format: 'jpg', bytes: 5, width: 10, height: 10, durationSec: null, isAudio: false };

describe('tải ảnh quán (thẳng lên Cloudinary)', () => {
  test('ký vé ảnh vào thư mục của quán; không phải ảnh, quá lớn, hoặc quán không thuộc nhóm thì không ký', async () => {
    const d = makeDeps();
    await preparePlacePhotoUpload(d, { placeId: PLACE, fileName: 'IMG_001.JPG', size: 5 });
    expect(d.storage.signUpload).toHaveBeenCalledWith({ folder: `food-tour/places/${PLACE}`, resourceType: 'image' });
    await expect(preparePlacePhotoUpload(d, { placeId: PLACE, fileName: 'a.pdf', size: 5 })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    await expect(preparePlacePhotoUpload(d, { placeId: PLACE, fileName: 'a.jpg', size: PHOTO_MAX_BYTES + 1 })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    await expect(preparePlacePhotoUpload(makeDeps([], false), { placeId: PLACE, fileName: 'a.jpg', size: 5 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(d.storage.signUpload).toHaveBeenCalledTimes(1);
  });

  test('ghi nhận ảnh vừa tải kèm chuyến', async () => {
    const d = makeDeps();
    await addPlacePhoto(d, { placeId: PLACE, tripId: 't1', publicId: `food-tour/places/${PLACE}/abc` });
    expect(d.photos.insert).toHaveBeenCalledWith({ place_id: PLACE, trip_id: 't1', file_public_id: `food-tour/places/${PLACE}/abc`, file_format: 'jpg' });
  });

  test('public id ngoài thư mục quán bị từ chối mà không đụng kho', async () => {
    const d = makeDeps();
    await expect(addPlacePhoto(d, { placeId: PLACE, publicId: 'food-tour/places/khac/abc' })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
    expect(d.storage.inspect).not.toHaveBeenCalled();
  });

  test('Cloudinary nhận ra không phải ảnh thật hoặc quá nặng → xóa và từ chối', async () => {
    for (const bad of [{ format: 'svg' }, { bytes: PHOTO_MAX_BYTES + 1 }]) {
      const d = makeDeps();
      d.storage.inspect.mockResolvedValueOnce({ ...ok, ...bad });
      await expect(addPlacePhoto(d, { placeId: PLACE, publicId: `food-tour/places/${PLACE}/x` })).rejects.toMatchObject({ code: 'PHOTO_INVALID' });
      expect(d.storage.destroy).toHaveBeenCalledWith(`food-tour/places/${PLACE}/x`, 'image');
      expect(d.photos.insert).not.toHaveBeenCalled();
    }
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
