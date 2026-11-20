import type { PlaceDetails, PlacesClient } from '@/integrations/google-places/types';
import { cached } from '@/shared/cache/cached';
import type { CacheStore } from '@/shared/cache/cache-store';
import { cacheKey } from '@/shared/cache/keys';
import { getEnv } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import type { Place, PlacesRepo } from '../repositories/places-repo';
import type { InternalReview, ReviewsRepo } from '../repositories/reviews-repo';

export interface PlaceView {
  /** Bản ghi của nhóm; null khi nhóm chưa lưu chỗ này (xem từ Khám phá). */
  place: Place | null;
  googlePlaceId: string | null;
  /** Dữ liệu Google (cache 24h); null với chỗ thêm tay hoặc khi Google đang lỗi. */
  details: PlaceDetails | null;
  /** Có google id nghĩa là đã đối chiếu với Google Maps; chỗ thêm tay thì chưa. */
  verified: boolean;
  reviews: InternalReview[];
}

export interface PlaceViewDeps {
  places: Pick<PlacesClient, 'getDetails'>;
  cache: CacheStore;
  placesRepo: Pick<PlacesRepo, 'findPlace'>;
  reviewsRepo: Pick<ReviewsRepo, 'listReviews'>;
}

const LOCAL_PREFIX = 'local:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError('NOT_FOUND', 'Không tìm thấy chỗ này.');

/** placeKey là Google place id hoặc `local:<uuid>` (chỗ thêm tay). Chỗ local không có trong nhóm thì NOT_FOUND. */
export async function getPlaceView(deps: PlaceViewDeps, groupId: string, placeKey: string): Promise<PlaceView> {
  const isLocal = placeKey.startsWith(LOCAL_PREFIX);
  const localId = placeKey.slice(LOCAL_PREFIX.length);
  if (isLocal && !UUID.test(localId)) throw notFound();

  const place = await deps.placesRepo.findPlace(groupId, isLocal ? { id: localId } : { googlePlaceId: placeKey });
  if (isLocal && !place) throw notFound();

  const googlePlaceId = isLocal ? (place?.google_place_id ?? null) : placeKey;
  const [details, reviews] = await Promise.all([
    googlePlaceId ? loadDetails(deps, googlePlaceId, place !== null) : null,
    place ? deps.reviewsRepo.listReviews(place.id) : [],
  ]);
  return { place, googlePlaceId, details, verified: googlePlaceId !== null, reviews };
}

/** Chỗ nhóm đã lưu vẫn xem được khi Google lỗi (chỉ thiếu phần chi tiết); chỗ chưa lưu thì không còn gì để hiện nên lan lỗi. */
async function loadDetails(deps: PlaceViewDeps, id: string, saved: boolean): Promise<PlaceDetails | null> {
  try {
    return await cached(deps.cache, cacheKey('places:details', { id }), getEnv().PLACES_TTL_SEC, () => deps.places.getDetails(id));
  } catch (e) {
    if (saved && e instanceof AppError && e.code === 'PLACES_UNAVAILABLE') return null;
    throw e;
  }
}
