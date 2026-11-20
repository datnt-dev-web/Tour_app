'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import { Badge } from '@/shared/ui/badge';
import { Chip } from '@/shared/ui/chip';
import { STATUS_LABELS, STATUS_TONES, TAB_STATUSES, TRIP_PLACE_STATUSES, TRIP_TABS, type TripTab } from '../constants';
import type { TripDetail, TripPlaceItem } from '../repositories/trips-repo';
import { dateRange } from './home-screen';
import { tripQuery } from './trip-queries';
import { useRemoveFromTrip, useSetStatus } from './use-trip-mutations';

function PlaceRow({ item, onStatus, onRemove }: { item: TripPlaceItem; onStatus: (s: TripPlaceItem['status']) => void; onRemove: () => void }) {
  return (
    <li className="flex flex-col gap-2 rounded border border-line bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{item.place.name}</p>
          <p className="truncate text-sm text-muted">{item.note || item.place.address}</p>
        </div>
        <Badge tone={STATUS_TONES[item.status]} className="shrink-0">
          {STATUS_LABELS[item.status]}
        </Badge>
      </div>
      <div className="flex gap-2">
        <select
          aria-label={`Trạng thái của ${item.place.name}`}
          value={item.status}
          onChange={(e) => onStatus(e.target.value as TripPlaceItem['status'])}
          className="min-h-11 flex-1 rounded border border-line bg-white px-3 text-sm"
        >
          {TRIP_PLACE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Xóa ${item.place.name} khỏi chuyến`}
          onClick={onRemove}
          className="inline-flex size-11 items-center justify-center rounded border border-line bg-white text-bad hover:bg-surface"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function TripScreen({ tripId, initialData }: { tripId: string; initialData: TripDetail }) {
  const [tab, setTab] = useState<TripTab>('all');
  const { data } = useQuery({ ...tripQuery(tripId), initialData });
  const setStatus = useSetStatus(tripId);
  const remove = useRemoveFromTrip(tripId);
  const { trip, items } = data;

  const visible = items.filter((i) => TAB_STATUSES[tab].includes(i.status));
  const groups = STORED_CATEGORIES.map((category) => ({ category, rows: visible.filter((i) => i.place.category === category) })).filter(
    (g) => g.rows.length > 0,
  );
  const exploreHref = `/explore?${new URLSearchParams({ city: trip.city, trip: trip.id })}`;
  const mutationError = setStatus.error ?? remove.error;

  return (
    <main className="flex flex-col gap-4 p-4 pb-28">
      <header className="flex flex-col gap-1">
        <Link href="/" aria-label="Quay lại" className="-ml-2 inline-flex size-11 items-center justify-center rounded text-ink hover:bg-surface">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-xl font-extrabold">{trip.city}</h1>
        <p className="text-sm text-muted">
          {trip.name}
          {dateRange(trip) && ` · ${dateRange(trip)}`}
        </p>
      </header>

      <div className="flex gap-2" role="group" aria-label="Lọc theo trạng thái">
        {TRIP_TABS.map((t) => (
          <Chip key={t.value} selected={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {mutationError && (
        <p role="alert" className="text-sm text-bad">
          {mutationError.message}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Chưa có chỗ nào ở đây. Bấm &quot;Tìm thêm&quot; để thêm chỗ.</p>
      ) : (
        groups.map(({ category, rows }) => (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[category]} ({rows.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((item) => (
                <PlaceRow
                  key={item.id}
                  item={item}
                  onStatus={(status) => setStatus.mutate({ tripPlaceId: item.id, status })}
                  onRemove={() => remove.mutate({ tripPlaceId: item.id })}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+16px)] mx-auto flex max-w-[480px] justify-end px-4">
        <Link
          href={exploreHref}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded bg-accent px-5 text-sm font-semibold text-white shadow-md hover:bg-accent-strong"
        >
          <Search size={18} aria-hidden />
          Tìm thêm
        </Link>
      </div>
    </main>
  );
}
