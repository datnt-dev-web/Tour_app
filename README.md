# Food Tour nhóm

App mobile cho nhóm bạn chọn quán ăn theo chuyến đi. Chỉ vào được khi có lời mời.

## Đăng nhập theo lời mời

Luồng: `/invite/[token]` lưu cookie `ft-invite` rồi sang `/login`; đăng nhập Google hoặc magic link; `/auth/callback` kiểm tra quyền (`canAccess`) rồi nhận lời mời. Email trong `BOOTSTRAP_OWNER_EMAILS` được tự tạo nhóm "Hội ăn chơi" ở lần đăng nhập đầu.

Supabase vẫn để `enable_signup = true` vì OAuth và OTP cần tạo user mới. Người lạ có thể tạo tài khoản trong `auth.users`, nhưng bị `canAccess` đẩy ra (signOut, `/login?error=not-invited`) và không có dòng nào trong `group_members` nên RLS không cho đọc dữ liệu.

### Cấu hình Supabase Cloud

1. Authentication, Providers, Email: bật (magic link, tắt "Confirm email" nếu muốn vào ngay bằng link).
2. Authentication, Providers, Google: bật, dán Client ID và Client Secret từ Google Cloud Console (OAuth client loại Web). Thêm `https://<project-ref>.supabase.co/auth/v1/callback` vào "Authorized redirect URIs" của Google.
3. Authentication, URL Configuration:
   - Site URL: domain production, ví dụ `https://food-tour.example.com`.
   - Redirect URLs: thêm `https://food-tour.example.com/auth/callback` (và bản preview nếu cần).
4. Biến môi trường production: xem `.env.example`, nhớ `BOOTSTRAP_OWNER_EMAILS`.

### Chạy local

Đặt `SUPABASE_AUTH_GOOGLE_CLIENT_ID` và `SUPABASE_AUTH_GOOGLE_SECRET` trong môi trường trước `supabase start` (provider Google đã bật trong `supabase/config.toml`). Magic link local xem ở Inbucket, `http://127.0.0.1:54324`.
