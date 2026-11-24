import { MapPin, StickyNote } from 'lucide-react';

/** Dưới tên quán: địa chỉ một dòng (kèm icon), rồi ghi chú nhỏ gọn (tối đa 2 dòng) để thẻ không bị dài. Không truyền note thì bỏ dòng ghi chú. */
export function PlaceLines({ address, note = null }: { address: string | null; note?: string | null }) {
  return (
    <>
      {address && (
        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin size={13} aria-hidden className="shrink-0" />
          <span className="truncate">{address}</span>
        </p>
      )}
      {note && (
        <p className="mt-0.5 flex gap-1 text-xs leading-snug text-muted/80">
          <StickyNote size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{note}</span>
        </p>
      )}
    </>
  );
}
