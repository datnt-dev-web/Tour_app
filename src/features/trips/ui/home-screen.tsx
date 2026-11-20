'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { daysUntil, formatDayMonth, todayInVietnam } from '@/shared/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import type { TripSummary } from '../repositories/trips-repo';
import { splitTrips } from '../services/trips-service';
import { NewTripForm } from './new-trip-form';
import { tripsQuery } from './trip-queries';

export function dateRange(t: Pick<TripSummary, 'start_date' | 'end_date'>) {
  if (!t.start_date) return '';
  return t.end_date && t.end_date !== t.start_date
    ? `${formatDayMonth(t.start_date)} - ${formatDayMonth(t.end_date)}`
    : formatDayMonth(t.start_date);
}

function countdown(t: TripSummary, today: string) {
  if (!t.start_date) return null;
  const days = daysUntil(t.start_date, today);
  return days > 0 ? `Còn ${days} ngày` : 'Đang diễn ra';
}

function UpcomingCard({ trip, today }: { trip: TripSummary; today: string }) {
  const label = countdown(trip, today);
  return (
    <Link href={`/trips/${trip.id}`} className="block rounded bg-ink p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Sắp đi</p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight">{trip.city}</h2>
          <p className="truncate text-sm text-white/80">
            {trip.name}
            {dateRange(trip) && ` · ${dateRange(trip)}`}
          </p>
        </div>
        {label && <Badge className="shrink-0 bg-accent text-white">{label}</Badge>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-white/10 p-3">
          <dd className="text-xl font-extrabold">{trip.confirmedCount}</dd>
          <dt className="text-xs text-white/70">chỗ đã chốt</dt>
        </div>
        <div className="rounded-sm bg-white/10 p-3">
          <dd className="text-xl font-extrabold">{trip.pendingCount}</dd>
          <dt className="text-xs text-white/70">chưa chốt</dt>
        </div>
      </dl>
    </Link>
  );
}

export function HomeScreen({ groupId, groupName, initialTrips }: { groupId: string; groupName: string; initialTrips: TripSummary[] }) {
  const [creating, setCreating] = useState(false);
  const { data: trips } = useQuery({ ...tripsQuery(groupId), initialData: initialTrips });
  const { upcoming, past } = splitTrips(trips, todayInVietnam());

  return (
    <main className="flex flex-col gap-4 p-4">
      <header>
        <p className="text-sm text-muted">Nhóm</p>
        <h1 className="text-xl font-extrabold">{groupName}</h1>
      </header>

      {upcoming.map((t) => (
        <UpcomingCard key={t.id} trip={t} today={todayInVietnam()} />
      ))}
      {upcoming.length === 0 && <p className="py-4 text-center text-sm text-muted">Chưa có chuyến nào sắp đi.</p>}

      {creating ? (
        <NewTripForm groupId={groupId} onCancel={() => setCreating(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden />
          Tạo chuyến mới
        </Button>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">Đã đi</h2>
          {past.map((t) => (
            <Link key={t.id} href={`/trips/${t.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.city}</p>
                  <p className="truncate text-sm text-muted">
                    {t.name}
                    {dateRange(t) && ` · ${dateRange(t)}`}
                  </p>
                </div>
                <Badge tone="good">{t.confirmedCount} chỗ</Badge>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
