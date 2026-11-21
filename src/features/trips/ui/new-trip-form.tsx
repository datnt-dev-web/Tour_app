'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { Button } from '@/shared/ui/button';
import { celebrate } from '@/shared/ui/celebrate';
import { Card } from '@/shared/ui/card';
import { createTripAction } from '../actions/trip-actions';

const FIELD = 'min-h-11 w-full rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent';

export function NewTripForm({ groupId, onCancel }: { groupId: string; onCancel: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const create = useMutation({
    mutationFn: async () => unwrap(await createTripAction({ groupId, name, city, startDate, endDate })),
    onSuccess: (trip) => {
      celebrate();
      void qc.invalidateQueries({ queryKey: queryKeys.trips(groupId) });
      router.push(`/trips/${trip.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Tạo chuyến mới</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tên chuyến
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ Hải Phòng 3 ngày" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Thành phố
          <input required maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ví dụ Hải Phòng" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Từ ngày
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Đến ngày
            <input required type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} />
          </label>
        </div>
        {create.isError && (
          <p role="alert" className="text-sm text-bad">
            {create.error.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" className="flex-1" disabled={create.isPending}>
            {create.isPending ? 'Đang tạo...' : 'Tạo chuyến'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
