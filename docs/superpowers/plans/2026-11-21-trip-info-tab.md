# Tab Thông tin theo chuyến: kế hoạch triển khai

> Thực thi inline (superpowers:executing-plans), TDD cho tầng service/validate.

**Goal:** Tab `/info` lưu ghi chú, link, tệp (Cloudinary) theo từng chuyến.
**Spec:** `docs/superpowers/specs/2026-11-21-trip-info-tab-design.md`

## Global Constraints
- Hằng số trong `src/features/info/constants.ts`: `INFO_MAX_FILE_BYTES = 10_000_000`, `INFO_MAX_ITEMS = 200`, `INFO_FILE_EXTENSIONS`, `INFO_LIMITS = { title: 120, body: 2000, url: 1000 }`.
- Env tùy chọn `CLOUDINARY_CLOUD_NAME|API_KEY|API_SECRET` (cập nhật `.env.example`, `env.ts`, test env).
- `serverActions.bodySizeLimit` nâng lên `'11mb'`.

## Review Focus
- Tên tệp có dấu/khoảng trắng/không đuôi; đuôi viết hoa (`.PDF`) → nhận đúng.
- Upload thành công nhưng insert DB lỗi (RLS, quá 200 mục) → asset bị xóa.
- Thiếu cấu hình Cloudinary → ghi chú/link vẫn chạy, tệp báo lỗi rõ.
- Người ngoài nhóm gọi action với tripId của nhóm khác → bị chặn trước khi upload.
- Mục tệp có resource_type `raw` (docx) vs `image` (pdf, ảnh) → link ký đúng loại.

### Task 1: DB + repo
Migration `20261121000009_trip_infos.sql`: enum `trip_info_kind ('note','link','file')`; bảng `trip_infos(id, trip_id fk cascade, kind, title, body, url, file_public_id, file_resource_type, file_format, file_bytes, file_name, created_by default auth.uid(), created_at)` + check theo kind; index `(trip_id, created_at desc)`, `created_by`; RLS như `trip_expenses`. Types. `createInfosRepo(db)`: `list(tripId)`, `count(tripId)`, `insert(row)`, `remove(id) → row|null`. Test DB `tests/db/trip-infos.test.ts` (chưa chạy được nếu Docker tắt).

### Task 2: Cloudinary client + service (TDD)
`integrations/cloudinary/client.ts`: `createCloudinaryStorage(cfg): FileStorage` với `upload(buf, {folder, filename}) → {publicId, resourceType, format, bytes}`, `destroy(publicId, resourceType)`, `signedUrl(publicId, resourceType, format, {download?, filename?})`.
`info-service.ts`: `addNote`, `addLink`, `addFile`, `removeInfo`, `listInfos` (gắn `href` ký), validate theo constants, lỗi `AppError` mã `INFO_INVALID`, `INFO_FULL`, `UPLOAD_DISABLED`, `NOT_FOUND`. Test `tests/features/info/info-service.test.ts` với repo + storage giả.

### Task 3: Actions + route
`info-actions.ts`: `addNoteAction`, `addLinkAction`, `uploadInfoFileAction(form)`, `removeInfoAction`. Route `GET /api/trips/[tripId]/infos`.

### Task 4: UI + tab
`/info` page (server: danh sách chuyến, chuyến mặc định), `InfoScreen` (chip chuyến, danh sách, form thêm 3 loại, xóa), query key `tripInfos`, BottomNav thêm tab, `isTabActive` test.
