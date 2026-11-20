# Food Tour nhóm

App mobile cho nhóm bạn chọn quán ăn theo chuyến đi. Chỉ vào được khi có lời mời.

## Đăng nhập theo lời mời

Luồng: `/invite/[token]` lưu cookie `ft-invite` rồi sang `/login`; đăng nhập Google hoặc magic link; `/auth/callback` kiểm tra quyền (`canAccess`) rồi nhận lời mời. Email trong `BOOTSTRAP_OWNER_EMAILS` được tự tạo nhóm "Con lợn nhựa" ở lần đăng nhập đầu.

Supabase vẫn để `enable_signup = true` vì OAuth và OTP cần tạo user mới. Người lạ có thể tạo tài khoản trong `auth.users`, nhưng bị `canAccess` đẩy ra (signOut, `/login?error=not-invited`) và không có dòng nào trong `group_members` nên RLS không cho đọc dữ liệu.

### Cấu hình Supabase Cloud

1. Authentication, Providers, Email: bật OTP/magic link, giữ "Confirm email" bật, và tắt đăng ký email + mật khẩu (chỉ dùng OTP hoặc Google) để người lạ không tự lập tài khoản bằng mật khẩu.
2. Authentication, Providers, Google: bật, dán Client ID và Client Secret từ Google Cloud Console (OAuth client loại Web). Thêm `https://<project-ref>.supabase.co/auth/v1/callback` vào "Authorized redirect URIs" của Google.
3. Authentication, URL Configuration:
   - Site URL: domain production, ví dụ `https://food-tour.example.com`.
   - Redirect URLs: thêm `https://food-tour.example.com/auth/callback` (và bản preview nếu cần).
4. Biến môi trường production: xem `.env.example`, nhớ `BOOTSTRAP_OWNER_EMAILS`.

### Chạy local

Đặt `SUPABASE_AUTH_GOOGLE_CLIENT_ID` và `SUPABASE_AUTH_GOOGLE_SECRET` trong môi trường trước `supabase start` (provider Google đã bật trong `supabase/config.toml`). Magic link local xem ở Inbucket, `http://127.0.0.1:54324`.

## Chạy app

Biến môi trường: xem `.env.example` (Supabase URL/anon/service role, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, Upstash tùy chọn ở dev, `BOOTSTRAP_OWNER_EMAILS`, giới hạn AI và TTL cache). Sao chép thành `.env.local`; với Supabase local lấy khóa từ `npx supabase status`.

```bash
npm install
npx supabase start          # Postgres + Auth local (cần Docker)
npx supabase db reset       # áp migration từ đầu
npm run dev                 # http://localhost:3000
npm run build && npm start  # bản production (service worker chỉ đăng ký ở bản này)
```

Seed chuyến Hải Phòng: `npm run seed:haiphong -- --group <groupId> --user <userId>` (thiếu khóa Places thì mọi chỗ ở dạng chưa xác minh).

### Đăng nhập nhanh khi dev (chỉ Supabase local)

```bash
npm run dev:login-link -- --email dev@example.com [--origin http://localhost:3000]
```

Script tạo user nếu chưa có, cho vào nhóm "Con lợn nhựa", seed Hải Phòng nếu nhóm chưa có chuyến, rồi in URL `/auth/callback?token_hash=...` dùng một lần; mở URL đó là đăng nhập. Script từ chối chạy nếu Supabase URL không phải localhost/127.0.0.1.

### Bật Google OAuth

Tạo OAuth client loại Web trong Google Cloud Console, thêm `<supabase-url>/auth/v1/callback` vào Authorized redirect URIs. Local: đặt `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET` trước `supabase start`. Cloud: bật provider Google trong Dashboard (xem mục cấu hình ở trên).

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
