'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { formatDayMonth } from '@/shared/date';
import { Dropdown } from '@/shared/ui/dropdown';
import { Skeleton } from '@/shared/ui/skeleton';
import { TRIP_TABS, type TripTab } from '../constants';
import type { RawTripStats, TripInfo } from '../repositories/trips-repo';
import { tripDays } from '../services/timeline';
import { dateRange } from './home-screen';
import { tripQuery } from './trip-queries';
import { TripList } from './trip-list';
import { parseTripView, TRIP_VIEWS, tripViewHref, type TripView } from './trip-view';
import { cachedStops, type InitialStops } from './use-paged-stops';

// Tab ngoài Danh sách và hộp thêm chỗ tách thành chunk riêng: trang chuyến tải nhẹ hơn, tab nào mở mới tải.
// Hàm import giữ riêng để tải trước khi người dùng rê/chạm vào tab (trước cả lúc bấm).
const loadMap = () => import('./trip-map');
const loadTimeline = () => import('./trip-timeline');
const loadStats = () => import('./trip-stats-panel');
const loadManualSheet = () => import('./manual-place-sheet');
const VIEW_LOADERS: Partial<Record<TripView, () => Promise<unknown>>> = { map: loadMap, timeline: loadTimeline, stats: loadStats };

const ViewSkeleton = () => <Skeleton className="h-[max(420px,calc(100dvh-24rem))]" />;
const TripMap = dynamic(loadMap, { ssr: false, loading: ViewSkeleton });
const TripTimeline = dynamic(() => loadTimeline().then((m) => m.TripTimeline), { loading: ViewSkeleton });
const TripStatsPanel = dynamic(() => loadStats().then((m) => m.TripStatsPanel), { loading: ViewSkeleton });
const ManualPlaceSheet = dynamic(() => loadManualSheet().then((m) => m.ManualPlaceSheet), { ssr: false });

/**
 * Màn chuyến: phần đầu (thông tin chuyến) và các tab. Mỗi tab tự tải dữ liệu của mình theo trang
 * (Danh sách, Timeline, giá từng chỗ) hoặc số liệu cộng sẵn ở database (Thống kê).
 */
export function TripScreen({
  tripId,
  initialInfo,
  initialStops,
  initialStats,
}: {
  tripId: string;
  initialInfo: TripInfo;
  initialStops?: InitialStops;
  initialStats?: RawTripStats;
}) {
  const [tab, setTab] = useState<TripTab>('all');
  const [day, setDay] = useState('all');
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const view = parseTripView(useSearchParams().get('view'));
  const { data: info } = useQuery({ ...tripQuery(tripId), initialData: initialInfo });
  const [adding, setAdding] = useState(false);
  const { trip } = info;
  const days = tripDays(trip);
  const exploreHref = `/explore?${new URLSearchParams({ city: trip.city, trip: trip.id })}`;
  const dayOptions = [
    { value: 'all', label: 'Tất cả ngày' },
    ...days.map((d, i) => ({ value: d, label: `Ngày ${i + 1} · ${formatDayMonth(d)}` })),
    { value: 'none', label: 'Chưa xếp giờ' },
  ];

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex flex-col gap-1">
        <Link href="/" aria-label="Quay lại" className="-ml-2 inline-flex size-11 items-center justify-center pressable rounded text-ink hover:bg-surface">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">{trip.city}</h1>
            <p className="truncate text-sm text-muted">
              {trip.name}
              {dateRange(trip) && ` · ${dateRange(trip)}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              onPointerEnter={() => void loadManualSheet()}
              onFocus={() => void loadManualSheet()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded border border-line bg-white px-3 text-sm font-semibold text-ink pressable hover:bg-surface"
            >
              <Plus size={18} aria-hidden />
              Thêm
            </button>
            <Link
              href={exploreHref}
              aria-label="Tìm thêm"
              title="Tìm thêm"
              className="inline-flex size-11 items-center justify-center rounded bg-accent text-white pressable hover:bg-accent-strong"
            >
              <Search size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex rounded border border-line bg-white p-1" role="group" aria-label="Kiểu hiển thị">
        {TRIP_VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => router.push(tripViewHref(pathname, v.value), { scroll: false })}
            onPointerEnter={() => void VIEW_LOADERS[v.value]?.()}
            onFocus={() => void VIEW_LOADERS[v.value]?.()}
            className={`min-h-11 flex-1 rounded-sm text-sm font-semibold pressable ${view === v.value ? 'bg-accent text-white' : 'text-ink hover:bg-surface'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Thống kê luôn tính trên cả chuyến nên không có bộ lọc. */}
      {view !== 'stats' && (
        <div className="flex flex-wrap gap-2">
          <Dropdown size="sm" label="Lọc theo trạng thái" prefix="Trạng thái:" value={tab} options={TRIP_TABS} onChange={setTab} />
          {view === 'timeline' && <Dropdown size="sm" label="Lọc theo ngày" prefix="Ngày:" value={day} options={dayOptions} onChange={setDay} />}
        </div>
      )}

      {view === 'map' ? (
        <TripMap tripId={tripId} tab={tab} />
      ) : view === 'stats' ? (
        <TripStatsPanel tripId={tripId} info={info} initialStats={initialStats} initialStops={initialStops} />
      ) : view === 'timeline' ? (
        <TripTimeline tripId={tripId} tab={tab} day={day} days={days} people={trip.party_size} initial={initialStops} />
      ) : (
        <TripList tripId={tripId} tab={tab} days={days} initial={initialStops} />
      )}

      {/* Gợi ý giờ/phương tiện dựa trên các chỗ đã tải (mọi trang đã xem). */}
      {adding && <ManualPlaceSheet tripId={tripId} city={trip.city} days={days} items={cachedStops(qc, tripId)} onClose={() => setAdding(false)} />}
    </main>
  );
}
