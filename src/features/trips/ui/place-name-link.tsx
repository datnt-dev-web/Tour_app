import Link from 'next/link';
import { placeKeyOf } from '@/features/places/constants';
import type { Place } from '@/features/places/repositories/places-repo';

/** Tên quán mở trang chỗ (kèm chuyến); chỗ đã đi thì gạch ngang. Dùng chung cho Danh sách, Timeline, Hôm nay. */
export function PlaceNameLink({ place, tripId, visited = false, className = '' }: { place: Pick<Place, 'id' | 'google_place_id' | 'name'>; tripId: string; visited?: boolean; className?: string }) {
  return (
    <Link
      href={`/places/${encodeURIComponent(placeKeyOf({ placeId: place.id, googlePlaceId: place.google_place_id }))}?trip=${tripId}`}
      className={`block font-semibold leading-snug ${visited ? 'text-muted line-through' : ''} ${className}`}
    >
      {place.name}
    </Link>
  );
}
