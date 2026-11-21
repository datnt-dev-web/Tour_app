# Nhập danh sách chỗ vào chuyến từ file sheet

Ngày: 2026-11-21 · Trạng thái: đã duyệt

## Mục đích
Nhóm soạn danh sách quán/chỗ trong Excel hoặc Google Sheets rồi đổ vào một chuyến một lần, thay vì thêm tay từng chỗ. Lịch (ngày giờ), cách đi và tiền vẫn chốt sau trong app.

## Mục tiêu / không làm
- Có: icon nhỏ trên card chuyến (màn Chuyến đi) mở sheet nhập; tải file mẫu; xem trước + báo lỗi theo dòng; nhập cả lô.
- Không: nhập ngày/giờ/tiền/cách đi; cập nhật chỗ đã có; xuất ngược ra sheet.
- Chống mục tiêu: nhập một nửa rồi lỗi (dữ liệu dở dang); loại chỗ ngoài danh sách của app lọt vào DB.

## File mẫu (.xlsx)
Cột (dòng 1 là tiêu đề): `Tên quán*` | `Loại*` | `Địa chỉ` | `Link bản đồ` | `Ghi chú`.
- `Loại` là dropdown (data validation kiểu list) chỉ gồm nhãn trong `CATEGORY_LABELS` (Ăn chính, Ăn vặt & chè, Cafe, Chỗ chơi, Chỗ nghỉ, Quà mang về). Giá trị ngoài danh sách bị Excel chặn.
- Không có dòng ví dụ (người dùng hay giữ lại và nó bị nhập thành chỗ thật); hướng dẫn đặt ở ghi chú (note) của ô tiêu đề.
- Đọc file xlsx: từ chối nếu tổng dung lượng giải nén > 20 MB (`IMPORT_MAX_UNZIPPED_BYTES`); hyperlink chỉ được lấy cho cột Link bản đồ. CSV nhận cả UTF-8 lẫn ANSI windows-1258 (CSV thường của Excel bản Việt).
- Server sinh file lúc tải (`exceljs`), nên dropdown luôn khớp danh sách loại trong code.
- Chỉ phát mẫu .xlsx (CSV không chứa được dropdown). Vẫn nhận nhập file .csv.

## Luồng
1. Bấm icon trên card chuyến → sheet: nút "Tải file mẫu", ô chọn file (.xlsx, .csv).
2. Chọn file → server action đọc file (`exceljs` cho xlsx, bộ đọc CSV nhỏ tự viết, hỗ trợ BOM, dấu phẩy/chấm phẩy, ô có ngoặc kép) → trả về dòng hợp lệ + lỗi theo số dòng.
3. Xem trước: "✓ N dòng hợp lệ · ✗ M dòng lỗi" kèm lý do từng dòng lỗi.
4. Bấm "Nhập N chỗ" → server action validate lại bằng zod rồi gọi một hàm Postgres (RPC) ghi tất cả trong một transaction.
5. Kết quả: số chỗ đã thêm, số chỗ bỏ qua vì đã có trong chuyến (trùng tên chuẩn hóa). Làm mới cache query của chuyến.

## Quy tắc dữ liệu
- Ghép cột theo tiêu đề (không phân biệt hoa thường/dấu), không theo vị trí.
- `Loại`: so khớp nhãn sau khi chuẩn hóa (bỏ dấu, hoa thường, khoảng trắng); không khớp → lỗi dòng.
- Tên 1–120 ký tự, địa chỉ ≤200, ghi chú ≤500, link phải là URL http(s) (≤500); dòng trống hoàn toàn bỏ qua.
- Trùng tên trong cùng file → giữ dòng đầu, báo trùng.
- Tái dùng chỗ cùng tên đã có trong nhóm + thành phố (như `addManualPlace`), không tạo bản trùng.
- Giới hạn: tối đa 200 dòng, file ≤1 MB (hằng số có tên trong `trips/constants.ts`).

## Quyền
Chỉ thành viên nhóm của chuyến. RPC chạy `security invoker` nên RLS hiện có của `places`/`trip_places` vẫn áp dụng; server action kiểm tra đăng nhập như các action khác.

## Cách làm đã cân nhắc
- **Chọn:** đọc file trên server bằng `exceljs` (cùng thư viện sinh mẫu) + ghi bằng một RPC transaction.
- Đọc trên trình duyệt bằng `read-excel-file`: xem trước không cần gọi server, nhưng thêm thư viện thứ hai cho cùng việc; bỏ.
- SheetJS (`xlsx`) trên npm: bản cũ có lỗ hổng đã biết; bỏ.
- Gọi `addManualPlace` lặp từng dòng: nhiều lượt gọi DB và không nguyên tử; bỏ.

## Để builder tự quyết
Tên file/route, icon cụ thể (lucide), câu chữ thông báo, cấu trúc component sheet (theo `manual-place-sheet.tsx`).
