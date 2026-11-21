# Nhập chỗ vào chuyến từ file sheet: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Từ card chuyến ở màn Chuyến đi, tải file mẫu .xlsx (cột Loại là dropdown) rồi nhập .xlsx/.csv để thêm nhiều chỗ vào chuyến một lần.

**Architecture:** Đọc/validate dòng là hàm thuần (`features/trips/import/`). `exceljs` (chỉ dùng ở server) sinh file mẫu và đọc xlsx. Server action đọc file và trả về bản xem trước; action thứ hai ghi cả lô qua RPC Postgres `import_trip_places` (một transaction, `security invoker`).

**Tech Stack:** Next.js 16 App Router (server actions, route handler), Supabase Postgres RPC, zod 4, exceljs, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-trip-import-sheet-design.md`

## Global Constraints
- Cột theo thứ tự: `Tên quán*`, `Loại*`, `Địa chỉ`, `Link bản đồ`, `Ghi chú`; ghép cột theo tiêu đề đã chuẩn hóa (`normalizeText`, bỏ `*`), không theo vị trí.
- Loại hợp lệ = nhãn trong `CATEGORY_LABELS` (`src/features/places/constants.ts`), không có danh sách thứ hai.
- Giới hạn: `IMPORT_MAX_ROWS = 200`, `IMPORT_MAX_BYTES = 1_000_000` trong `src/features/trips/constants.ts`.
- Độ dài: tên 1–120, địa chỉ ≤200, ghi chú ≤500, link là URL http(s) ≤500.
- Không nhập ngày/giờ/tiền/cách đi. Chỗ mới có trạng thái mặc định `wanted`.
- `exceljs` chỉ import trong file có `import 'server-only'`.
- Câu chữ hiển thị bằng tiếng Việt, theo giọng các thông báo sẵn có.

## Review Focus
- File xuất từ Google Sheets/Excel có BOM, dấu `;` hoặc ô có xuống dòng/ngoặc kép: phải đọc đúng (test ở Task 1).
- Ô Loại gõ tay sai chính tả hoặc khác hoa thường/dấu, ví dụ `cafe` hay `an chinh`: khớp sau chuẩn hóa thì nhận, còn lại báo lỗi đúng số dòng (Task 1).
- Ô Excel không phải chữ (số, link dạng hyperlink, công thức): đọc ra text hiển thị (Task 2).
- Nhập lại cùng file lần hai: không tạo chỗ trùng, báo "bỏ qua" (Task 3 db test và Task 4).
- File quá 1 MB, hơn 200 dòng, sai định dạng, hoặc không có dòng tiêu đề: báo lỗi rõ, không ghi gì (Task 1 và Task 4).

---

### Task 1: Đọc và validate dòng (thuần)

**Files:**
- Create: `src/features/trips/import/import-rows.ts`
- Create: `src/features/trips/import/csv.ts`
- Modify: `src/features/trips/constants.ts`: thêm `IMPORT_MAX_ROWS`, `IMPORT_MAX_BYTES`, `IMPORT_COLUMNS`
- Test: `tests/features/trips/import-rows.test.ts`, `tests/features/trips/csv.test.ts`

**Interfaces:**
- Produces:
  - `IMPORT_COLUMNS = ['Tên quán*', 'Loại*', 'Địa chỉ', 'Link bản đồ', 'Ghi chú'] as const`
  - `type ImportRow = { name: string; category: StoredPlaceCategory; address: string | null; mapsUrl: string | null; note: string | null }`
  - `type ImportPreview = { rows: ImportRow[]; errors: { line: number; message: string }[] }` (`line` là số dòng trong file, tính từ 1, dòng tiêu đề là 1)
  - `parseImportTable(table: string[][]): ImportPreview`: hàng đầu tiên không rỗng là tiêu đề. Thiếu cột `Tên quán` hoặc `Loại` thì ném `AppError('IMPORT_BAD_HEADER', ...)`. Quá `IMPORT_MAX_ROWS` dòng dữ liệu thì ném `AppError('IMPORT_TOO_MANY', ...)`.
  - `categoryFromLabel(label: string): StoredPlaceCategory | null`
  - `parseCsv(text: string): string[][]`: bỏ BOM; tự nhận dấu phân cách `,` hoặc `;` theo dòng đầu; hỗ trợ ô `"..."` có `""` và xuống dòng bên trong.

- [ ] **Step 1: Viết test thất bại**
  - `parseCsv`: `'﻿a,b\n1,2'` → `[['a','b'],['1','2']]`; `'a;b\n"x;y";"say ""hi"""'` → `[['a','b'],['x;y','say "hi"']]`; ô có `\n` trong ngoặc kép giữ nguyên.
  - `categoryFromLabel`: `'Cafe'`, `'cafe'`, `' an chinh '` → `'cafe'`, `'cafe'`, `'food'`; `'Nhà hàng'` → `null`.
  - `parseImportTable`:
    - tiêu đề đảo thứ tự (`Loại`, `Tên quán`) vẫn ghép đúng;
    - dòng trống hoàn toàn bị bỏ qua và không báo lỗi;
    - thiếu tên → lỗi `{ line: 3, message: 'Thiếu tên quán.' }`;
    - loại sai → lỗi nêu giá trị sai;
    - link `ftp://x` → lỗi;
    - tên trùng (khác dấu, khác hoa thường) trong cùng file → giữ dòng đầu, dòng sau báo lỗi `Trùng tên với dòng N.`;
    - 201 dòng dữ liệu → ném `IMPORT_TOO_MANY`;
    - không có cột Loại → ném `IMPORT_BAD_HEADER`;
    - ô rỗng thành `null`.
- [ ] **Step 2:** `npx vitest run tests/features/trips/import-rows.test.ts tests/features/trips/csv.test.ts`. Kỳ vọng: FAIL (module chưa có).
- [ ] **Step 3: Cài đặt** theo Interfaces. Dùng zod để kiểm độ dài và URL (`z.url({ protocol: /^https?$/ })`), dùng `normalizeText` để so tiêu đề, loại và tên trùng.
- [ ] **Step 4:** Chạy lại lệnh ở Step 2. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(trips): parse and validate sheet import rows`.

### Task 2: File mẫu và đọc xlsx bằng exceljs

**Files:**
- Create: `src/features/trips/import/xlsx.ts` (`import 'server-only'`)
- Create: `src/app/api/trips/import-template/route.ts`
- Modify: `package.json` (thêm `exceljs` vào dependencies)
- Test: `tests/features/trips/xlsx.test.ts` (alias `server-only` sang stub có sẵn trong `tests/stubs`, nếu vitest config đã có thì dùng luôn)

**Interfaces:**
- Consumes: `IMPORT_COLUMNS`, `CATEGORY_LABELS`, `STORED_CATEGORIES`
- Produces:
  - `buildImportTemplate(): Promise<Buffer>`: sheet `Danh sách` gồm dòng tiêu đề (in đậm, cố định khi cuộn) và 1 dòng ví dụ. Cột B từ dòng 2 đến 501 có data validation `type: 'list'`, `allowBlank: true`, `showErrorMessage: true`, công thức trỏ sang sheet ẩn `Loại` chứa các nhãn. Trỏ sang sheet ẩn để tránh giới hạn 255 ký tự của list inline và lỗi khi nhãn có dấu phẩy.
  - `readXlsxTable(buf: ArrayBuffer): Promise<string[][]>`: chỉ đọc sheet đầu tiên, lấy `cell.text` (text hiển thị, gồm cả hyperlink và kết quả công thức).
  - `GET /api/trips/import-template`: yêu cầu đăng nhập (như các route `/api` khác), trả file với `Content-Disposition: attachment; filename="mau-nhap-cho.xlsx"` và content-type xlsx.

- [ ] **Step 1: Viết test thất bại:** `buildImportTemplate` → `readXlsxTable` cho ra hàng đầu bằng `IMPORT_COLUMNS`. Mở lại bằng exceljs thì ô `B2` có `dataValidation.type === 'list'`, và sheet `Loại` chứa đủ `STORED_CATEGORIES.map(c => CATEGORY_LABELS[c])`. Ô có hyperlink thì đọc ra text.
- [ ] **Step 2:** `npx vitest run tests/features/trips/xlsx.test.ts`. Kỳ vọng: FAIL.
- [ ] **Step 3:** `npm i exceljs`, rồi cài đặt theo Interfaces.
- [ ] **Step 4:** Chạy lại test. Kỳ vọng: PASS. Thêm `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(trips): xlsx import template with category dropdown`.

### Task 3: RPC `import_trip_places` và repo

**Files:**
- Create: `supabase/migrations/20261121000008_import_trip_places.sql`
- Modify: `src/shared/supabase/database.types.ts`: thêm `import_trip_places` vào `Functions`
- Modify: `src/features/places/repositories/places-repo.ts`: thêm `listLocalPlaces`
- Modify: `src/features/trips/repositories/trips-repo.ts`: thêm `importPlaces`
- Test: `tests/db/import-trip-places.test.ts` (theo mẫu `tests/db/trip-stops.test.ts`, chạy bằng `npm run test:db`)

**Interfaces:**
- SQL: `public.import_trip_places(p_trip_id uuid, p_rows jsonb) returns jsonb`, `language plpgsql security invoker`, `set search_path = ''`. Mỗi phần tử của `p_rows`: `{ place_id: uuid|null, name, category, address, maps_url, note }`.
  - `place_id` null thì insert vào `places`, lấy `group_id` và `city` từ chuyến, `city_norm` do server truyền qua trường `city_norm` của phần tử, `verified=false`.
  - Sau đó insert `trip_places(trip_id, place_id, note)` với `on conflict (trip_id, place_id) do nothing`.
  - Trả về `{ "added": n, "skipped": m }`.
  - Chuyến không đọc được (RLS) thì `raise exception using errcode = '42501'`. Mã này được `runAction` đổi thành FORBIDDEN.
  - `grant execute ... to authenticated`. Có comment `-- down:` như các migration khác.
- `PlacesRepo.listLocalPlaces(groupId: string, cityNorm: string): Promise<{ id: string; name: string }[]>`. Viết lại `findLocalPlace` dựa trên hàm này, để chỉ có một truy vấn.
- `TripsRepo.importPlaces(tripId: string, rows: ImportRpcRow[]): Promise<{ added: number; skipped: number }>`, với `ImportRpcRow = { place_id: string | null; name: string; category: StoredPlaceCategory; address: string | null; maps_url: string | null; note: string | null; city_norm: string }`.

- [ ] **Step 1: Viết test DB thất bại:**
  - nhập 2 dòng mới → `added: 2`, có 2 hàng `places` và 2 hàng `trip_places` với `status='wanted'`;
  - nhập lại → `added: 0, skipped: 2`;
  - user ngoài nhóm gọi → lỗi code `42501`, không có hàng nào được ghi;
  - một dòng có category sai enum → cả lô rollback (không có hàng mới).
- [ ] **Step 2:** `supabase db reset` rồi `npm run test:db -- import-trip-places`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Viết migration, types và 2 hàm repo.
- [ ] **Step 4:** Chạy lại lệnh ở Step 2 và `npx vitest run tests/features/trips`. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(db): import_trip_places rpc`.

### Task 4: Service và server actions

**Files:**
- Modify: `src/features/trips/services/trips-service.ts`: thêm `importTripPlaces`
- Create: `src/features/trips/actions/import-actions.ts` (`'use server'`)
- Test: `tests/features/trips/trips-service.test.ts` (thêm `describe('importTripPlaces')`)

**Interfaces:**
- `importTripPlaces(deps: { trips: Pick<TripsRepo, 'getTrip' | 'importPlaces'>; places: Pick<PlacesRepo, 'listLocalPlaces'> }, input: { tripId: string; rows: ImportRow[] }): Promise<{ added: number; skipped: number }>`
  - Chuyến không có thì ném `NOT_FOUND`; `rows` rỗng thì ném `AppError('IMPORT_EMPTY', 'Không có dòng hợp lệ để nhập.')`.
  - Gán `place_id` cho mỗi dòng bằng cách so `normalizeText(name)` với kết quả `listLocalPlaces(trip.group_id, normalizeText(trip.city))`, rồi gọi `importPlaces` một lần.
- `previewImportAction(form: FormData): Promise<ActionResult<ImportPreview>>`: đọc trường `file`.
  - Thiếu file, hoặc `size > IMPORT_MAX_BYTES` → `IMPORT_FILE` "File quá lớn (tối đa 1 MB)." hoặc thông báo thiếu file.
  - Tên file `.xlsx` → `readXlsxTable`; `.csv` → `parseCsv(await file.text())`; định dạng khác → `IMPORT_FILE`. Kết quả đưa qua `parseImportTable`.
  - Gọi `authed()` trước khi đọc file.
- `importTripPlacesAction(input: { tripId: string; rows: ImportRow[] }): Promise<ActionResult<{ added: number; skipped: number }>>`: zod schema dựng lại cùng ràng buộc với Task 1, `rows.max(IMPORT_MAX_ROWS)`.

- [ ] **Step 1: Viết test thất bại** cho `importTripPlaces`:
  - tên `Bánh Đa Cua` khớp chỗ sẵn có `banh da cua` → `place_id` của chỗ đó;
  - tên mới → `place_id: null`, kèm `city_norm` đúng;
  - `rows: []` → `IMPORT_EMPTY`;
  - chuyến không có → `NOT_FOUND`;
  - `importPlaces` được gọi đúng 1 lần.
- [ ] **Step 2:** `npx vitest run tests/features/trips/trips-service.test.ts`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài đặt service và actions.
- [ ] **Step 4:** Chạy lại test và `npm run typecheck`. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(trips): import trip places service and actions`.

### Task 5: Giao diện: icon trên card và sheet nhập

**Files:**
- Create: `src/features/trips/ui/import-sheet.tsx`
- Create: `src/features/trips/ui/use-import-places.ts`
- Modify: `src/features/trips/ui/home-screen.tsx`: icon trên `UpcomingCard` và trên item chuyến đã qua

**Interfaces:**
- `useImportPlaces(tripId: string)`: `useMutation` gọi `unwrap(await importTripPlacesAction(...))`. `onSuccess` invalidate `queryKeys.trip(tripId)`, `tripStopsAll(tripId)`, `tripStats(tripId)`, `tripLocations(tripId)`, `tripsAll`, `bookAll`, như `use-trip-mutations.ts:49-53`.
- `ImportSheet({ tripId, tripName, onClose })`: bố cục theo `manual-place-sheet.tsx`.
  - Link tải mẫu `/api/trips/import-template` (`download`).
  - `<input type="file" accept=".xlsx,.csv">`. Chọn file xong gọi `previewImportAction` qua `useMutation`.
  - Xem trước: "✓ N dòng hợp lệ · ✗ M dòng lỗi", liệt kê từng lỗi `Dòng X: ...`, hiện tối đa 5 dòng hợp lệ đầu tiên.
  - Nút "Nhập N chỗ" bị vô hiệu khi N = 0 hoặc đang gửi.
  - Thành công thì hiện "Đã thêm A chỗ, bỏ qua B chỗ đã có", gọi `celebrate()` nếu A > 0, rồi có nút Đóng.
  - Lỗi thì hiện `error.message`.
- Icon: `FileSpreadsheet` (lucide), nút `size-11`, `aria-label="Nhập danh sách từ file"`.
  - `UpcomingCard` hiện là một `<Link>` bọc cả card, không được lồng button bên trong. Đổi thành `<div className="relative">` chứa Link và đặt nút ở góc phải trên.
  - Sheet nạp bằng `dynamic(..., { ssr: false })` như `explore-screen.tsx:20`.

- [ ] **Step 1:** Cài đặt, rồi chạy `npm run lint` và `npm run typecheck`. Kỳ vọng: không lỗi.
- [ ] **Step 2: Kiểm tay** trên `npm run dev`:
  - tải mẫu, mở bằng Excel thấy dropdown Loại;
  - điền 3 dòng (1 dòng lỗi) và nhập: thấy 2 chỗ mới trong chuyến;
  - nhập lại cùng file: báo bỏ qua 2;
  - thử file CSV xuất từ Google Sheets.
- [ ] **Step 3:** `npm test`. Kỳ vọng: toàn bộ PASS.
- [ ] **Step 4:** Commit `feat(trips): import places from sheet on trip card`.
