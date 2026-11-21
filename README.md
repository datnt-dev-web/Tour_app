# Food Tour nhóm

App mobile cho nhóm bạn chọn quán ăn theo chuyến đi. Không có đăng ký: admin cấp tài khoản, người dùng chỉ nhập username để vào (không mật khẩu).

## Đăng nhập bằng username

Tài khoản cố định: `wibu` (admin, owner nhóm) và `sucvat` (thành viên), khai báo trong `scripts/seed-accounts.ts`. Các script đọc Supabase trong `.env.local` (local hoặc cloud), cần `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run account:seed        # tạo/cập nhật wibu + sucvat, chạy lại an toàn (cần chạy lại sau `supabase db reset`)
npm run account:create -- --username an.vu --name "An Vũ" [--group <groupId>] [--role owner|member]
```

Username 3–32 ký tự `a-z 0-9 . _`, lưu ở `profiles.username` (người dùng không tự sửa được). User mới dùng email giả `<username>@food-tour.local`. `account:seed` đưa cả hai vào nhóm wibu đang ở, nếu chưa thì nhóm "Con lợn nhựa" (tạo mới nếu chưa có). `account:create` không có `--group` thì vào nhóm duy nhất, hoặc tạo "Con lợn nhựa" nếu chưa có nhóm nào; có nhiều nhóm thì phải truyền `--group`.

Khi đăng nhập, server action tìm user theo username (phải thuộc ít nhất một nhóm), tạo magic link bằng service role rồi xác thực ngay ở server để ghi phiên vào cookie, không gửi email.

**Lưu ý bảo mật:** ai biết username là vào được; đừng dùng username dễ đoán.

### Cấu hình Supabase

- Local: `supabase/config.toml` đặt `enable_signup = false` (cần `npx supabase stop && npx supabase start` để áp dụng).
- Cloud: Authentication, Sign In / Providers: tắt "Allow new users to sign up". Tài khoản do admin tạo qua service role không bị ảnh hưởng.

## Chạy app

Biến môi trường: xem `.env.example` (Supabase URL/anon/service role, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, Upstash tùy chọn ở dev, giới hạn AI và TTL cache). Sao chép thành `.env.local`; với Supabase local lấy khóa từ `npx supabase status`.

```bash
npm install
npx supabase start          # Postgres + Auth local (cần Docker)
npx supabase db reset       # áp migration từ đầu
npm run account:seed        # tạo wibu + sucvat
npm run dev                 # http://localhost:3000
npm run build && npm start  # bản production (service worker chỉ đăng ký ở bản này)
```

Seed chuyến Hải Phòng: `npm run seed:haiphong -- --group <groupId> --user <userId>` (thiếu khóa Places thì mọi chỗ ở dạng chưa xác minh).

## Bản đồ chuyến

Tab "Bản đồ" của chuyến dùng OpenStreetMap (Leaflet), không cần khóa API. Tọa độ lấy ở server: Google Place Details nếu `GOOGLE_PLACES_API_KEY` là khóa thật, ngược lại hoặc khi không có tọa độ thì geocode bằng Nominatim (tối đa 1 request/giây theo chính sách, nên lần đầu mở có thể mất khoảng 1 giây mỗi quán chưa có cache). Tọa độ chỉ cache ở Redis (`GEOCODE_TTL_SEC`), không ghi vào Postgres. Nút "Chỉ đường" vẫn mở Google Maps.

## Thông báo nhắc giờ (Web Push)

Nhắc trước 30 phút mỗi chỗ có giờ trong chuyến, kể cả khi đã đóng app. Người dùng bấm "Bật thông báo nhắc giờ" ở tab Timeline/Hôm nay; iPhone phải mở app từ biểu tượng ngoài màn hình chính (iOS 16.4+). Không có push (bản dev, trình duyệt cũ) thì vẫn còn nhắc trong app lúc đang mở và file lịch `.ics`.

- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (tạo bằng `npx web-push generate-vapid-keys`), `CRON_SECRET`. Thiếu khóa VAPID thì tính năng tắt.
- Bộ hẹn giờ: pg_cron trên Supabase gọi `GET /api/cron/reminders` mỗi 5 phút (migration `..._push_reminder_cron.sql`). URL và khóa nằm trong Vault, tạo tay ở từng môi trường:
  `select vault.create_secret('https://<domain>/api/cron/reminders', 'push_cron_url'); select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');`
- Kiểm tra: `select * from cron.job_run_details order by start_time desc limit 5;` và `select status_code, content from net._http_response order by created desc limit 5;`
- Mỗi chỗ chỉ nhắc một lần cho mỗi giờ hẹn (`push_reminders_sent`); đổi giờ thì nhắc lại theo giờ mới. Đánh dấu trước khi gửi, nên gửi lỗi tạm thời thì bỏ lượt đó.

## Lệnh kiểm tra

```bash
npx vitest run && npm run test:db && npm run typecheck && npm run lint && npm run build
```

`test:db` cần `supabase start`.

## PWA

`src/app/manifest.ts` + `public/sw.js` (đăng ký bởi `src/shared/pwa/register-sw.tsx`, chỉ production). Service worker viết tay vì `@serwist/next` dựa trên webpack, không hợp build Turbopack của Next 16. Chiến lược: precache icon/manifest; StaleWhileRevalidate cho `/_next/static` và font; NetworkFirst (timeout 3s) cho trang; không cache `/api/*` và `/auth/*`. Icon sinh bằng `node scripts/make-icons.mjs` từ ảnh gốc `assets/main-icon.jpg` (ra icon PWA, `src/app/favicon.ico`, `src/app/apple-icon.png` và emblem màn login); đổi icon thì thay ảnh gốc rồi chạy lại.

## Hiệu năng (Lighthouse mobile, bản `npm start`, máy dev)

Đo 21/11/2026 (đã đăng nhập, trừ `/login`): `/login` LCP 1.8–2.0 s, 350 KB (chỉ dùng font Be Vietnam Pro); `/` 0.92, LCP 1.6 s; `/trips/[id]` 0.79, LCP 1.5 s, TBT 840 ms; `/info` và `/explore` 0.87–0.88, LCP 2.8 s (đo khi màn chờ còn 1 giây; nay đã rút còn 0,4 giây). TTFB thật trên Vercel khoảng 0.2–0.3 s khi server đã ấm, 1.5–1.8 s lần khởi động nguội. Số đo dao động giữa các lần chạy.

Lưu ý khi viết code: client component không được import giá trị (không chỉ type) từ file có `node:crypto`/module Node, vì bundler sẽ kéo polyfill (~140 KB gzip) vào trình duyệt. Hằng số dùng chung đặt ở `features/*/constants.ts`.

## Lỗ hổng đã biết

- Chưa kiểm với khóa Google Places và Gemini thật (`/explore`, tóm tắt AI, xác minh chỗ lúc seed mới chạy với khóa giả hoặc không có khóa).
- Chưa có smoke test e2e tự động; kiểm tay trên trình duyệt mobile.
- Service worker cache HTML trang đã đăng nhập (NetworkFirst); trên máy dùng chung, đăng xuất không xóa cache trang.
