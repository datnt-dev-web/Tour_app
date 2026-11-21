import { describe, expect, test, vi } from 'vitest';
import { decodePlaceKey, getPlaceView } from '@/features/places/services/place-service';
import type { Place } from '@/features/places/repositories/places-repo';
import type { InternalReview } from '@/features/places/repositories/reviews-repo';
import type { PlaceDetails, PlacesClient } from '@/integrations/google-places/types';
import { MemoryCacheStore } from '@/shared/cache/memory-store';
import { AppError } from '@/shared/errors';

vi.mock('@/shared/config/env', () => ({ getEnv: () => ({ PLACES_TTL_SEC: 86400 }) }));

const LOCAL_ID = '11111111-1111-4111-8111-111111111111';
const details: PlaceDetails = {
  googlePlaceId: 'g1', name: 'Chè Hường', address: 'Số 1', rating: 4.6, reviewCount: 120, priceTier: 1, openNow: true, mapsUrl: 'u',
  weekdayHours: ['Thứ Hai: 08:00 - 22:00'], phone: null, location: null,
};
const place = (over: Partial<Place>): Place => ({
  id: LOCAL_ID, group_id: 'G', google_place_id: null, name: 'Quán nhà', city: 'Hải Phòng', city_norm: 'hai phong', address: null,
  category: 'food', maps_url: null, verified: false, created_by: null, ...over,
});
const review: InternalReview = {
  id: 'r1', placeId: LOCAL_ID, userId: 'u1', authorName: 'Lan', avatarColor: '#f97316', tripId: null, verdict: 'up', note: 'Ngon', rating: null, createdAt: '2026-11-01T00:00:00Z',
};

function setup(saved: Place | null, getDetails: () => Promise<PlaceDetails> = async () => details) {
  const getDetailsMock = vi.fn(getDetails);
  const findPlace = vi.fn(async () => saved);
  const listReviews = vi.fn(async () => (saved ? [review] : []));
  return {
    getDetailsMock,
    findPlace,
    deps: {
      places: { getDetails: getDetailsMock } as unknown as PlacesClient,
      cache: new MemoryCacheStore(),
      placesRepo: { findPlace },
      reviewsRepo: { listReviews },
    },
  };
}

describe('getPlaceView', () => {
  test('gọi getDetails 1 lần trong 24h', async () => {
    const { deps, getDetailsMock } = setup(null);
    await getPlaceView(deps, 'G', 'g1');
    const view = await getPlaceView(deps, 'G', 'g1');
    expect(getDetailsMock).toHaveBeenCalledTimes(1);
    expect(view.details?.name).toBe('Chè Hường');
    expect(view.place).toBeNull();
    expect(view.reviews).toEqual([]);
    expect(view.verified).toBe(true);
  });

  test('chỗ local trả details null, verified false, không gọi Google', async () => {
    const { deps, getDetailsMock, findPlace } = setup(place({}));
    const view = await getPlaceView(deps, 'G', `local:${LOCAL_ID}`);
    expect(getDetailsMock).not.toHaveBeenCalled();
    expect(findPlace).toHaveBeenCalledWith('G', { id: LOCAL_ID });
    expect(view).toMatchObject({ details: null, verified: false, googlePlaceId: null });
    expect(view.reviews).toEqual([review]);
  });

  test('chỗ local không tồn tại hoặc id sai định dạng: NOT_FOUND', async () => {
    await expect(getPlaceView(setup(null).deps, 'G', `local:${LOCAL_ID}`)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getPlaceView(setup(null).deps, 'G', 'local:abc')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('chỗ đã lưu có google id nhưng Google lỗi: vẫn trả chỗ của nhóm, details null', async () => {
    const down = async (): Promise<PlaceDetails> => {
      throw new AppError('PLACES_UNAVAILABLE', 'down');
    };
    const { deps } = setup(place({ google_place_id: 'g1', verified: true }), down);
    const view = await getPlaceView(deps, 'G', 'g1');
    expect(view).toMatchObject({ details: null, verified: true, googlePlaceId: 'g1' });
  });

  test('chỗ chưa lưu và Google lỗi: lan lỗi', async () => {
    const down = async (): Promise<PlaceDetails> => {
      throw new AppError('PLACES_UNAVAILABLE', 'down');
    };
    await expect(getPlaceView(setup(null, down).deps, 'G', 'g1')).rejects.toMatchObject({ code: 'PLACES_UNAVAILABLE' });
  });

  test('decodePlaceKey: giải mã đúng, chuỗi hỏng trả null', () => {
    expect(decodePlaceKey('local%3Aabc')).toBe('local:abc');
    expect(decodePlaceKey('100%')).toBeNull();
  });
});
