'use server';

import { z } from 'zod';
import { STORED_CATEGORIES } from '@/features/places/constants';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { authed } from '@/shared/supabase/authed';
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '../constants';
import { decodeCsv, parseCsv } from '../import/csv';
import { IMPORT_LIMITS, parseImportTable, type ImportPreview } from '../import/import-rows';
import { readXlsxTable, type XlsxTable } from '../import/xlsx';
import { createTripsRepo } from '../repositories/trips-repo';
import { importTripPlaces } from '../services/trips-service';

const fileError = (message: string) => new AppError('IMPORT_FILE', message);

/** Đọc file người dùng chọn thành bản xem trước (dòng hợp lệ + lỗi theo dòng). Chưa ghi gì. */
export async function previewImportAction(form: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await authed();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw fileError('Chưa chọn file.');
    if (file.size > IMPORT_MAX_BYTES) throw fileError('File quá lớn (tối đa 1 MB).');

    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) {
      let table: XlsxTable;
      try {
        table = await readXlsxTable(await file.arrayBuffer());
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw fileError('Không đọc được file Excel. Hãy lưu lại dạng .xlsx rồi thử lại.');
      }
      return parseImportTable(table.cells, table.links);
    }
    if (name.endsWith('.csv')) return parseImportTable(parseCsv(decodeCsv(await file.arrayBuffer())));
    throw fileError('Chỉ nhận file .xlsx hoặc .csv.');
  });
}

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable();

const importSchema = z.object({
  tripId: z.uuid(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(IMPORT_LIMITS.name),
        category: z.enum(STORED_CATEGORIES),
        address: optionalText(IMPORT_LIMITS.address),
        mapsUrl: z.url({ protocol: /^https?$/ }).max(IMPORT_LIMITS.mapsUrl).nullable(),
        note: optionalText(IMPORT_LIMITS.note),
      }),
    )
    .max(IMPORT_MAX_ROWS),
});

/** Ghi các dòng đã xem trước vào chuyến; validate lại vì dữ liệu đi qua client. */
export async function importTripPlacesAction(input: z.input<typeof importSchema>): Promise<ActionResult<{ added: number; skipped: number }>> {
  return runAction(async () => {
    const { db } = await authed();
    return importTripPlaces({ trips: createTripsRepo(db), places: createPlacesRepo(db) }, parse(importSchema, input));
  });
}
