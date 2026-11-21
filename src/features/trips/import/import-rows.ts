import { z } from 'zod';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import type { StoredPlaceCategory } from '@/features/places/repositories/places-repo';
import { AppError } from '@/shared/errors';
import { normalizeText } from '@/shared/text';
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS } from '../constants';

export type ImportRow = {
  name: string;
  category: StoredPlaceCategory;
  address: string | null;
  mapsUrl: string | null;
  note: string | null;
};

export type ImportPreview = { rows: ImportRow[]; errors: { line: number; message: string }[] };

export const IMPORT_LIMITS = { name: 120, address: 200, mapsUrl: 500, note: 500 } as const;

const httpUrl = z.url({ protocol: /^https?$/ }).max(IMPORT_LIMITS.mapsUrl);

type Field = 'name' | 'category' | 'address' | 'mapsUrl' | 'note';
const FIELDS: Field[] = ['name', 'category', 'address', 'mapsUrl', 'note'];
const headerKey = (h: string) => normalizeText(h.replace(/\*/g, ''));
const FIELD_BY_HEADER = new Map(IMPORT_COLUMNS.map((h, i) => [headerKey(h), FIELDS[i]]));

const CATEGORY_BY_LABEL = new Map(STORED_CATEGORIES.map((c) => [normalizeText(CATEGORY_LABELS[c]), c]));

export function categoryFromLabel(label: string): StoredPlaceCategory | null {
  return CATEGORY_BY_LABEL.get(normalizeText(label)) ?? null;
}

const isBlank = (cells: string[] | undefined) => !cells || cells.every((c) => !c?.trim());

/**
 * Bảng ô chữ (đọc từ csv/xlsx) thành dòng hợp lệ + lỗi theo số dòng trong file.
 * Lỗi cả file (thiếu cột bắt buộc, quá nhiều dòng) thì ném AppError: không có gì để xem trước.
 */
export function parseImportTable(table: string[][], links: (string | null)[][] = []): ImportPreview {
  const headerAt = table.findIndex((r) => !isBlank(r));
  const columns = headerAt < 0 ? [] : table[headerAt].map((h) => FIELD_BY_HEADER.get(headerKey(h ?? '')));
  if (!columns.includes('name') || !columns.includes('category')) {
    throw new AppError('IMPORT_BAD_HEADER', 'File thiếu cột "Tên quán" hoặc "Loại". Hãy dùng file mẫu.');
  }

  const body = table
    .slice(headerAt + 1)
    .map((cells, i) => ({ cells, hrefs: links[headerAt + 1 + i] ?? [], line: headerAt + i + 2 }))
    .filter((r) => !isBlank(r.cells));
  if (body.length > IMPORT_MAX_ROWS) {
    throw new AppError('IMPORT_TOO_MANY', `File có ${body.length} dòng, tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập.`);
  }

  const rows: ImportRow[] = [];
  const errors: ImportPreview['errors'] = [];
  const firstLineByName = new Map<string, number>();

  for (const { cells, hrefs, line } of body) {
    const get = (f: Field) => {
      const i = columns.indexOf(f);
      if (i < 0) return '';
      // Ô Link bản đồ thường là chữ "xem bản đồ" gắn hyperlink: cần địa chỉ link. Cột khác giữ chữ hiển thị
      // (tên dán từ Google Maps hay kèm link, không được biến thành URL).
      if (f === 'mapsUrl' && hrefs[i]) return hrefs[i].trim();
      return (cells[i] ?? '').trim();
    };
    const result = toRow(get);
    if (typeof result === 'string') {
      errors.push({ line, message: result });
      continue;
    }
    const key = normalizeText(result.name);
    const first = firstLineByName.get(key);
    if (first !== undefined) {
      errors.push({ line, message: `Trùng tên với dòng ${first}.` });
      continue;
    }
    firstLineByName.set(key, line);
    rows.push(result);
  }
  return { rows, errors };
}

/** Một dòng thành ImportRow, hoặc câu báo lỗi đầu tiên gặp. */
function toRow(get: (f: Field) => string): ImportRow | string {
  const name = get('name');
  if (!name) return 'Thiếu tên quán.';
  if (name.length > IMPORT_LIMITS.name) return `Tên quán quá dài (tối đa ${IMPORT_LIMITS.name} ký tự).`;

  const label = get('category');
  if (!label) return 'Thiếu loại.';
  const category = categoryFromLabel(label);
  if (!category) return `Loại "${label}" không có trong app.`;

  const address = get('address');
  if (address.length > IMPORT_LIMITS.address) return `Địa chỉ quá dài (tối đa ${IMPORT_LIMITS.address} ký tự).`;
  const mapsUrl = get('mapsUrl');
  if (mapsUrl && !httpUrl.safeParse(mapsUrl).success) return 'Link bản đồ không hợp lệ.';
  const note = get('note');
  if (note.length > IMPORT_LIMITS.note) return `Ghi chú quá dài (tối đa ${IMPORT_LIMITS.note} ký tự).`;

  return { name, category, address: address || null, mapsUrl: mapsUrl || null, note: note || null };
}
