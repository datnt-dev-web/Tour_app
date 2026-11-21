# Tab "Thông tin" theo chuyến (ghi chú, link, tệp trên Cloudinary)

Ngày: 2026-11-21 · Trạng thái: người dùng giao builder tự quyết phần còn mở ("làm tiếp tới khi hoàn thành")

## Mục đích
Một chỗ chung cho nhóm cất thông tin của từng chuyến: vé tàu/xe, xác nhận đặt phòng, ảnh chụp lịch trình, link Google Sheet/Drive, số điện thoại, ghi chú. Chia theo chuyến để dễ kiểm soát. Tệp lưu trên Cloudinary.

## Phạm vi
- Có: tab mới "Thông tin" ở thanh dưới; chọn chuyến bằng chip; mỗi chuyến có danh sách mục gồm 3 loại: **Ghi chú** (tiêu đề + nội dung), **Link** (tiêu đề + URL), **Tệp** (tải lên, có tiêu đề); xóa mục; mở/tải tệp.
- Không: sửa mục (xóa rồi thêm lại), thư mục con, phân quyền theo từng người, xem trước tài liệu trong app.

## Quyết định (builder tự quyết, người dùng có thể sửa)
- **Vị trí:** tab dưới thứ 5 `/info` (icon FolderOpen). Mặc định mở chuyến sắp đi gần nhất (không có thì chuyến gần nhất đã đi), như tab Bản đồ; đổi chuyến bằng `?trip=`.
- **Lưu trữ:** bảng `trip_infos` (Postgres, RLS theo nhóm như `trip_expenses`). Tệp lên Cloudinary qua server (server action nhận FormData, SDK `cloudinary` upload). Không lộ API secret ra client.
- **Riêng tư:** tệp upload kiểu `authenticated` vào thư mục `food-tour/<tripId>`; link xem/tải do server ký (`sign_url`) khi liệt kê, nên không đoán/duyệt được tệp của nhóm khác.
- **Giới hạn:** tệp ≤ 10 MB; định dạng: ảnh (jpg, jpeg, png, webp, heic, gif), pdf, doc(x), xls(x), ppt(x), txt, csv. Tiêu đề ≤ 120, ghi chú ≤ 2000, URL http(s) ≤ 1000. Mỗi chuyến tối đa 200 mục.
- **Cấu hình:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` là tùy chọn trong env: thiếu thì ghi chú/link vẫn dùng được, nút tải tệp báo "Chưa cấu hình lưu tệp".
- **Nhất quán:** upload xong mà ghi DB lỗi thì xóa asset vừa up; xóa mục thì xóa DB trước, xóa asset sau (lỗi xóa asset chỉ ghi log, không chặn người dùng).

## Kiến trúc
- `features/info/`: `repositories/infos-repo.ts`, `services/info-service.ts` (validate + điều phối repo và kho tệp), `actions/info-actions.ts`, `ui/*`.
- `integrations/cloudinary/client.ts` (`server-only`): `upload`, `destroy`, `signedUrl`; interface `FileStorage` để test service bằng fake.
- Đọc danh sách qua route `GET /api/trips/[tripId]/infos` (cần ký URL ở server), giống `/locations`.

## Cách đã cân nhắc
- **Chọn:** upload qua server. Đơn giản, không lộ chữ ký, kiểm tra quyền chuyến trước khi up.
- Upload thẳng từ trình duyệt lên Cloudinary bằng chữ ký: nhẹ cho server nhưng phải tin metadata client gửi về (cần gọi Admin API để xác minh); hơn phức tạp cho tệp ≤10 MB.
- Supabase Storage: đã có sẵn hạ tầng, nhưng người dùng chỉ định Cloudinary.
