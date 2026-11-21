'use client';

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { daysUntil, formatDayMonth, todayInVietnam } from '@/shared/date';
import { staggerStyle } from '@/shared/ui/stagger';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ChangePinButton } from '@/features/auth/ui/change-pin-button';
import { SignOutButton } from '@/features/auth/ui/sign-out-button';
import type { TripSummary } from '../repositories/trips-repo';
import { splitTrips } from '../services/trips-service';
import { NewTripForm } from './new-trip-form';
import { tripsQuery } from './trip-queries';

// Sheet nhập file chỉ mở khi bấm icon: tách chunk riêng cho màn Chuyến đi nhẹ hơn.
const ImportSheet = dynamic(() => import('./import-sheet').then((m) => m.ImportSheet), { ssr: false });

type ImportTarget = Pick<TripSummary, 'id' | 'name'>;

/** Nút nhỏ mở sheet nhập danh sách từ file; nằm ngoài Link của card (không lồng nút trong link). */
function ImportButton({ trip, onImport, className = '' }: { trip: ImportTarget; onImport: (t: ImportTarget) => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Nhập danh sách từ file vào chuyến ${trip.name}`}
      title="Nhập danh sách từ file"
      onClick={() => onImport(trip)}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded pressable ${className}`}
    >
      <FileSpreadsheet size={20} aria-hidden />
    </button>
  );
}

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

function UpcomingCard({ trip, today, index, onImport }: { trip: TripSummary; today: string; index: number; onImport: (t: ImportTarget) => void }) {
  const label = countdown(trip, today);
  return (
    <div className="stagger relative" style={staggerStyle(index)}>
      <Link href={`/trips/${trip.id}`} className="pressable block rounded bg-deep p-4 text-white">
        <div className="flex items-start justify-between gap-3 pr-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Sắp đi</p>
            <h2 className="mt-1 text-xl font-extrabold leading-tight">{trip.city}</h2>
            <p className="truncate text-sm text-white/80">
              {trip.name}
              {dateRange(trip) && ` · ${dateRange(trip)}`}
            </p>
          </div>
          {label && <Badge tone="accent" className="shrink-0">{label}</Badge>}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-sm bg-white/8 p-3">
            <dd className="text-xl font-extrabold">{trip.confirmedCount}</dd>
            <dt className="text-xs text-white/70">chỗ đã chốt</dt>
          </div>
          <div className="rounded-sm bg-white/8 p-3">
            <dd className="text-xl font-extrabold">{trip.pendingCount}</dd>
            <dt className="text-xs text-white/70">chưa chốt</dt>
          </div>
        </dl>
      </Link>
      <ImportButton trip={trip} onImport={onImport} className="absolute right-2 top-2 text-white/80 hover:bg-white/10" />
    </div>
  );
}

export function HomeScreen({ userId, groupId, groupName, initialTrips }: { userId: string; groupId: string; groupName: string; initialTrips: TripSummary[] }) {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<ImportTarget | null>(null);
  const { data: trips } = useQuery({ ...tripsQuery(groupId), initialData: initialTrips });
  const { upcoming, past } = splitTrips(trips, todayInVietnam());

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">Nhóm</p>
          <h1 className="truncate text-xl font-extrabold">{groupName}</h1>
        </div>
        <div className="flex shrink-0">
          <ChangePinButton />
          <SignOutButton userId={userId} />
        </div>
      </header>

      {upcoming.map((t, i) => (
        <UpcomingCard key={t.id} index={i} trip={t} today={todayInVietnam()} onImport={setImporting} />
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
          {past.map((t, i) => (
            <div key={t.id} className="stagger flex items-center gap-1" style={staggerStyle(i)}>
              <Link href={`/trips/${t.id}`} className="pressable block min-w-0 flex-1">
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
              <ImportButton trip={t} onImport={setImporting} className="text-muted hover:bg-surface" />
            </div>
          ))}
        </section>
      )}

      {importing && <ImportSheet tripId={importing.id} tripName={importing.name} onClose={() => setImporting(null)} />}
    </main>
  );
}
