import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import { IMPORT_COLUMNS } from '@/features/trips/constants';
import { buildImportTemplate, readXlsxTable } from '@/features/trips/import/xlsx';

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function open(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(toArrayBuffer(buf));
  return wb;
}

describe('buildImportTemplate', () => {
  test('chỉ có dòng tiêu đề: không có dòng ví dụ nào bị nhập nhầm', async () => {
    const { cells } = await readXlsxTable(toArrayBuffer(await buildImportTemplate()));
    expect(cells).toEqual([[...IMPORT_COLUMNS]]);
  });

  test('cột Loại là dropdown trỏ tới danh sách loại của app', async () => {
    const wb = await open(await buildImportTemplate());
    const sheet = wb.worksheets[0];
    for (const addr of ['B2', 'B501']) {
      const dv = sheet.getCell(addr).dataValidation;
      expect(dv.type).toBe('list');
      expect(dv.showErrorMessage).toBe(true);
    }
    const lists = wb.getWorksheet('Loại')!;
    const labels = STORED_CATEGORIES.map((c) => CATEGORY_LABELS[c]);
    expect(labels.map((_, i) => lists.getCell(i + 1, 1).text)).toEqual(labels);
    expect(lists.state).toBe('hidden');
  });
});

describe('readXlsxTable', () => {
  test('ô hyperlink: chữ hiển thị ở cells, địa chỉ link ở links', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['Tên quán', 'Loại', 'Địa chỉ', 'Link bản đồ']);
    ws.getCell('A2').value = 'Quán 1';
    ws.getCell('B2').value = 'Cafe';
    ws.getCell('C2').value = 42;
    ws.getCell('D2').value = { text: 'map', hyperlink: 'https://maps.app/x' };
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const { cells, links } = await readXlsxTable(toArrayBuffer(buf));
    expect(cells[1]).toEqual(['Quán 1', 'Cafe', '42', 'map']);
    expect(links[1]).toEqual([null, null, null, 'https://maps.app/x']);
  });

  test('file nén nhỏ nhưng giải nén quá lớn thì từ chối, không nạp vào bộ nhớ', async () => {
    const zip = new JSZip();
    zip.file('xl/worksheets/sheet1.xml', 'a'.repeat(30_000_000));
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(buf.byteLength).toBeLessThan(1_000_000);
    await expect(readXlsxTable(toArrayBuffer(buf))).rejects.toMatchObject({ code: 'IMPORT_FILE' });
  });
});
