import 'server-only';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { CATEGORY_LABELS, STORED_CATEGORIES } from '@/features/places/constants';
import { AppError } from '@/shared/errors';
import { IMPORT_COLUMNS, IMPORT_MAX_UNZIPPED_BYTES } from '../constants';

/** Số dòng nhập liệu có sẵn dropdown Loại (dòng 2..501), dư so với IMPORT_MAX_ROWS. */
const TEMPLATE_INPUT_ROWS = 500;
const COLUMN_WIDTHS = [32, 18, 36, 32, 32];
// Hướng dẫn để ở ghi chú tiêu đề, không để dòng ví dụ: người dùng hay giữ lại dòng ví dụ và nó bị nhập thành chỗ thật.
const HEADER_NOTES: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> = {
  'Tên quán*': 'Bắt buộc. Mỗi dòng một quán/địa điểm, ví dụ: Quán bún cá A.',
  'Loại*': 'Bắt buộc. Chọn trong danh sách thả xuống.',
  'Link bản đồ': 'Không bắt buộc. Dán link Google Maps / OpenStreetMap (bắt đầu bằng http).',
};

/** File mẫu .xlsx: cột Loại là dropdown lấy từ CATEGORY_LABELS, nên luôn khớp danh sách loại trong code. */
export async function buildImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Danh sách', { views: [{ state: 'frozen', ySplit: 1 }] });
  // Danh sách loại để ở sheet ẩn thay vì list inline: list inline giới hạn 255 ký tự và vỡ khi nhãn có dấu phẩy.
  const lists = wb.addWorksheet('Loại', { state: 'hidden' });
  const labels = STORED_CATEGORIES.map((c) => CATEGORY_LABELS[c]);
  labels.forEach((label, i) => (lists.getCell(i + 1, 1).value = label));

  const header = sheet.addRow([...IMPORT_COLUMNS]);
  header.font = { bold: true };
  IMPORT_COLUMNS.forEach((col, i) => {
    const note = HEADER_NOTES[col];
    if (note) header.getCell(i + 1).note = note;
  });
  COLUMN_WIDTHS.forEach((width, i) => (sheet.getColumn(i + 1).width = width));

  for (let r = 2; r <= TEMPLATE_INPUT_ROWS + 1; r++) {
    sheet.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`'Loại'!$A$1:$A$${labels.length}`],
      showErrorMessage: true,
      errorTitle: 'Loại không hợp lệ',
      error: 'Chọn một loại trong danh sách.',
    };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Chữ hiển thị của từng ô, và địa chỉ hyperlink (nếu có) ở cùng vị trí. */
export interface XlsxTable {
  cells: string[][];
  links: (string | null)[][];
}

const tooLarge = () => new AppError('IMPORT_FILE', 'File Excel quá lớn sau khi giải nén. Hãy chỉ giữ một sheet danh sách.');

/** Đọc sheet đầu tiên. Từ chối file zip bung ra quá lớn trước khi exceljs nạp toàn bộ vào bộ nhớ. */
export async function readXlsxTable(buf: ArrayBuffer): Promise<XlsxTable> {
  const zip = await JSZip.loadAsync(buf);
  let unzipped = 0;
  zip.forEach((_, entry) => {
    // Kích thước khai trong thư mục zip; JSZip không có API công khai cho nó nên đọc trường nội bộ.
    unzipped += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (unzipped > IMPORT_MAX_UNZIPPED_BYTES) throw tooLarge();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  const cells: string[][] = [];
  const links: (string | null)[][] = [];
  sheet?.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const texts: string[] = [];
    const hrefs: (string | null)[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const cell = row.getCell(c);
      texts.push(cell.text || '');
      hrefs.push(cell.hyperlink || null);
    }
    cells[rowNumber - 1] = texts;
    links[rowNumber - 1] = hrefs;
  });
  const out = { cells: Array.from(cells, (r) => r ?? []), links: Array.from(links, (r) => r ?? []) };
  // Dòng chỉ mang định dạng/dropdown (file mẫu có sẵn tới dòng 501) không phải dữ liệu.
  while (out.cells.length && out.cells[out.cells.length - 1].every((c) => !c.trim())) {
    out.cells.pop();
    out.links.pop();
  }
  return out;
}
