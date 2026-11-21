/**
 * Byte của file CSV thành chữ. Google Sheets và "CSV UTF-8" của Excel là UTF-8; "CSV (Comma delimited)" của Excel
 * bản tiếng Việt lưu bằng mã ANSI windows-1258, đọc như UTF-8 sẽ vỡ dấu nên thử lại bằng mã đó.
 */
export function decodeCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1258').decode(buf);
  }
}

/**
 * Đọc CSV xuất từ Excel/Google Sheets thành bảng ô chữ.
 * Excel bản tiếng Việt xuất bằng dấu `;`, Google Sheets bằng `,`: đoán theo dòng đầu (ngoài ngoặc kép).
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const sep = detectSeparator(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  // Dòng cuối không có xuống dòng; file kết thúc bằng xuống dòng thì không thêm dòng trống.
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows;
}

function detectSeparator(src: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let quoted = false;
  for (const ch of src) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}
