import { Star } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RankedPlace } from '@/features/explore/services/ranking';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { staggerStyle } from '@/shared/ui/stagger';
import { Card } from '@/shared/ui/card';

const formatCount = (n: number) => n.toLocaleString('vi-VN');
const formatPrice = (tier: number) => '₫'.repeat(tier);

export interface ResultCardProps {
  place: RankedPlace;
  /** Chưa truyền thì nút bị vô hiệu. */
  onAdd?: (place: RankedPlace) => void;
  /** Đã thêm vào chuyến (lạc quan, hoàn tác nếu lỗi). */
  added?: boolean;
  /** Query string nối vào link chi tiết (category, trip) để màn chỗ biết ngữ cảnh khi thêm vào chuyến. */
  detailQuery?: string;
  /** Nhãn phụ trên tên (vd. "AI gợi ý"). */
  badge?: ReactNode;
}

export function ResultCard({ place, onAdd, added = false, detailQuery, badge }: ResultCardProps) {
  return (
    <Card className="stagger flex flex-col gap-3" style={staggerStyle(place.rank - 1)}>
      <div className="flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-deep text-sm font-bold text-white">
          {place.rank}
        </span>
        <div className="min-w-0 flex-1">
          {badge && <div className="mb-1">{badge}</div>}
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
          href={`/places/${encodeURIComponent(place.googlePlaceId)}${detailQuery ? `?${detailQuery}` : ''}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center pressable rounded border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-surface"
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
