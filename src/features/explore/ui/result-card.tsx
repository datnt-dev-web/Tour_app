import { Star } from 'lucide-react';
import Link from 'next/link';
import type { RankedPlace } from '@/features/explore/services/ranking';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

const formatCount = (n: number) => n.toLocaleString('vi-VN');
const formatPrice = (tier: number) => '₫'.repeat(tier);

export interface ResultCardProps {
  place: RankedPlace;
  /** Chưa truyền thì nút bị vô hiệu. */
  onAdd?: (place: RankedPlace) => void;
  /** Đã thêm vào chuyến (lạc quan, hoàn tác nếu lỗi). */
  added?: boolean;
}

export function ResultCard({ place, onAdd, added = false }: ResultCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-ink text-sm font-bold text-white">
          {place.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug">{place.name}</h3>
          <p className="truncate text-sm text-muted">{place.address}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1 text-sm">
            <Star size={14} className="fill-warn text-warn" aria-hidden />
            <span className="font-semibold">{place.rating?.toFixed(1)}</span>
            <span className="text-muted">({formatCount(place.reviewCount)})</span>
            {place.priceTier && <span className="text-muted">· {formatPrice(place.priceTier)}</span>}
          </p>
        </div>
        {place.openNow !== null && (
          <Badge tone={place.openNow ? 'good' : 'bad'} className="h-fit shrink-0">
            {place.openNow ? 'Đang mở' : 'Đã đóng'}
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Link
          prefetch
          href={`/places/${place.googlePlaceId}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-surface"
        >
          Xem &amp; kiểm tra
        </Link>
        <Button className="flex-1" disabled={!onAdd || added} onClick={() => onAdd?.(place)}>
          {added ? '✓ Đã thêm' : '+ Thêm vào chuyến'}
        </Button>
      </div>
    </Card>
  );
}
