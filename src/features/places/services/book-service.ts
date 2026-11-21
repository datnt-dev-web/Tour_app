import { normalizeText } from '@/shared/text';
import type { BookPlaceRaw, PlacesRepo, StoredPlaceCategory } from '../repositories/places-repo';
import type { ReviewVerdict } from '../repositories/reviews-repo';

export type BookVerdict = ReviewVerdict | 'none';

export interface BookRow {
  placeId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  city: string;
  /** Khóa gom theo thành phố (đã chuẩn hóa: "Hải Phòng" và "hai phong" là một). */
  cityKey: string;
  category: StoredPlaceCategory;
  verified: boolean;
  /** Theo đánh giá mới nhất của nhóm; 'none' là chưa có đánh giá nào. */
  verdict: BookVerdict;
  /** Ghi chú của đánh giá mới nhất. */
  note: string | null;
}

export interface BookFilter {
  q?: string;
  verdict?: BookVerdict;
  cityKey?: string;
}

export interface BookCity {
  key: string;
  /** Cách viết phổ biến nhất trong nhóm. */
  label: string;
  count: number;
}

type RawReview = BookPlaceRaw['place_reviews_internal'][number];

function toBookRow(p: BookPlaceRaw): BookRow {
  const latest = p.place_reviews_internal.reduce<RawReview | null>((best, r) => (!best || r.created_at > best.created_at ? r : best), null);
  return {
    placeId: p.id,
    googlePlaceId: p.google_place_id,
    name: p.name,
    address: p.address,
    city: p.city,
    cityKey: p.city_norm,
    category: p.category,
    verified: p.verified,
    verdict: latest ? (latest.verdict as ReviewVerdict) : 'none',
    note: latest?.note ?? null,
  };
}

/** Lọc thuần trên dữ liệu đã có, để màn Sổ quán lọc ngay trên cache phía client. */
export function filterBook(rows: BookRow[], f: BookFilter): BookRow[] {
  const q = f.q ? normalizeText(f.q) : '';
  return rows.filter(
    (r) =>
      (!f.cityKey || r.cityKey === f.cityKey) &&
      (!f.verdict || r.verdict === f.verdict) &&
      (!q || normalizeText([r.name, r.address, r.note].filter(Boolean).join(' ')).includes(q)),
  );
}

/** Các thành phố trong sổ quán, nhiều chỗ nhất trước. */
export function bookCities(rows: BookRow[]): BookCity[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const spellings = byKey.get(r.cityKey) ?? new Map<string, number>();
    spellings.set(r.city, (spellings.get(r.city) ?? 0) + 1);
    byKey.set(r.cityKey, spellings);
  }
  return [...byKey.entries()]
    .map(([key, spellings]) => {
      const sorted = [...spellings.entries()].sort((a, b) => b[1] - a[1]);
      return { key, label: sorted[0][0], count: sorted.reduce((n, [, c]) => n + c, 0) };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'));
}

/** Thành phố mở sẵn: nơi của chuyến sắp đi nếu sổ có chỗ ở đó, không thì nơi nhiều chỗ nhất. */
export function pickBookCity(cities: BookCity[], preferredKey: string | null): string | null {
  return cities.find((c) => c.key === preferredKey)?.key ?? cities[0]?.key ?? null;
}

export async function listBook(repo: Pick<PlacesRepo, 'listBookPlaces'>, groupId: string, f: BookFilter): Promise<BookRow[]> {
  return filterBook((await repo.listBookPlaces(groupId)).map(toBookRow), f);
}
