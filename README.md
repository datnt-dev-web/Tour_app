# Food Tour nhóm

App mobile cho nhóm bạn chọn quán ăn theo chuyến đi. Không có đăng ký: admin cấp tài khoản, người dùng chỉ nhập username để vào (không mật khẩu).

## Đăng nhập bằng username + PIN

Tài khoản cố định: `wibu` (admin, owner nhóm) và `sucvat` (thành viên), khai báo trong `scripts/seed-accounts.ts`. Các script đọc Supabase trong `.env.local` (local hoặc cloud), cần `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run account:seed        # tạo/cập nhật wibu + sucvat, chạy lại an toàn (cần chạy lại sau `supabase db reset`)
npm run account:create -- --username an.vu --name "An Vũ" [--group <groupId>] [--role owner|member] [--pin 123456]
npm run account:pin -- --username wibu [--pin 123456]   # đặt/đổi PIN; bỏ --pin thì tạo ngẫu nhiên và in ra một lần
```

Username 3–32 ký tự `a-z 0-9 . _`, lưu ở `profiles.username` (người dùng không tự sửa được). User mới dùng email giả `<username>@food-tour.local`. `account:seed` đưa cả hai vào nhóm wibu đang ở, nếu chưa thì nhóm "Con lợn nhựa" (tạo mới nếu chưa có). `account:create` không có `--group` thì vào nhóm duy nhất, hoặc tạo "Con lợn nhựa" nếu chưa có nhóm nào; có nhiều nhóm thì phải truyền `--group`.

Khi đăng nhập, server action tìm user theo username (phải thuộc ít nhất một nhóm) bằng service role, rồi `signInWithPassword` với PIN 6 số (PIN là mật khẩu Supabase Auth: Supabase băm và giới hạn số lần thử). Sai username hay sai PIN đều cùng một thông báo. Tài khoản chưa có PIN không đăng nhập được: chạy `account:pin`. Người dùng tự đổi PIN bằng nút "Đổi PIN" ở màn Chuyến đi.

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

## Lệnh kiểm tra

```bash
npx vitest run && npm run test:db && npm run typecheck && npm run lint && npm run build
```

`test:db` cần `supabase start`.

## PWA

`src/app/manifest.ts` + `public/sw.js` (đăng ký bởi `src/shared/pwa/register-sw.tsx`, chỉ production). Service worker viết tay vì `@serwist/next` dựa trên webpack, không hợp build Turbopack của Next 16. Chiến lược: precache icon/manifest; StaleWhileRevalidate cho `/_next/static` và font; NetworkFirst (timeout 3s) cho trang; không cache `/api/*` và `/auth/*`. Icon sinh bằng `node scripts/make-icons.mjs`.

## Hiệu năng (Lighthouse mobile, bản `npm start`, máy dev)

LCP: `/login` 1.6 s, `/` 2.1 s (có phiên, điểm 0.74 ở lần đo cuối, 1.9 s ở lần đo trước), `/explore` 1.9 s. Đã tắt preload font (10 file woff2) để giảm LCP của `/login` từ 2.4 s xuống 1.6 s. Số đo dao động giữa các lần chạy.

## Lỗ hổng đã biết

- Chưa kiểm với khóa Google Places và Gemini thật (`/explore`, tóm tắt AI, xác minh chỗ lúc seed mới chạy với khóa giả hoặc không có khóa).
- Chưa có smoke test e2e tự động; kiểm tay trên trình duyệt mobile.
- Service worker cache HTML trang đã đăng nhập (NetworkFirst); trên máy dùng chung, đăng xuất không xóa cache trang.
