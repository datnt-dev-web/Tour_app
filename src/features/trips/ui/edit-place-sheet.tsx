'use client';

import { useState, type FormEvent } from 'react';
import { SuggestInput } from '@/features/geo/ui/suggest-input';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { FIELD } from '@/shared/ui/field';
import { Sheet } from '@/shared/ui/sheet';
import type { TripStop } from '../repositories/trips-repo';
import { useEditTripPlace } from './use-trip-mutations';

/**
 * Sửa một chỗ ở tab Danh sách: tên, địa chỉ, loại (dùng chung với sổ quán) và ghi chú trong chuyến.
 * Mọi thành viên nhóm đều sửa được. Giờ và giá sửa ở nút giờ / tab Thống kê như cũ.
 */
export function EditPlaceSheet({ tripId, city, item, onClose }: { tripId: string; city: string; item: TripStop; onClose: () => void }) {
  const edit = useEditTripPlace(tripId);
  const [name, setName] = useState(item.place.name);
  const [address, setAddress] = useState(item.place.address ?? '');
  const [category, setCategory] = useState<StoredPlaceCategory>(item.category as StoredPlaceCategory);
  const [note, setNote] = useState(item.note ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    edit.mutate({ tripPlaceId: item.id, info: { name, address, category, note } }, { onSuccess: onClose });
  }

  return (
    <Sheet title="Sửa chỗ" description="Tên, địa chỉ, loại đổi cả trong sổ quán." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tên quán / địa điểm
          <input required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Địa chỉ <span className="font-normal text-muted">(không bắt buộc, có thì hiện trên bản đồ)</span>
          <SuggestInput
            kind="address"
            city={city}
            maxLength={200}
            value={address}
            onChange={setAddress}
            placeholder="Gõ tên phố, ví dụ Cầu Đất"
            className={`${FIELD} font-normal`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Loại</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Loại">
            {STORED_CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="px-3">
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ghi chú
          <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Món nên gọi, đặt bàn..." className="w-full rounded border border-line bg-card p-3 text-sm font-normal" />
        </label>

        {edit.error && (
          <p role="alert" className="text-sm text-bad">
            {edit.error.message}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" className="flex-1" disabled={edit.isPending || !name.trim()}>
            {edit.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
