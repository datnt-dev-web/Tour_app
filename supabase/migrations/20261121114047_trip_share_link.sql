-- Link chỉ xem lịch trình cho người ngoài nhóm: token ngẫu nhiên (base64url 32 byte) + hạn dùng.
-- Trang công khai đọc bằng service role và lọc đúng token còn hạn; thành viên tạo/thu hồi qua RLS sẵn có của trips.
alter table public.trips
  add column share_token text check (share_token ~ '^[A-Za-z0-9_-]{43}$'),
  add column share_expires_at timestamptz,
  add constraint trips_share_pair check ((share_token is null) = (share_expires_at is null));

create unique index trips_share_token_uniq on public.trips (share_token) where share_token is not null;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop index public.trips_share_token_uniq;
-- alter table public.trips drop constraint trips_share_pair, drop column share_expires_at, drop column share_token;
