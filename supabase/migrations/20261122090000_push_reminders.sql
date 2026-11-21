-- Thông báo đẩy (Web Push) nhắc trước giờ tới mỗi chỗ, kể cả khi đã đóng app.
-- Cả hai bảng chỉ server (service role) đọc/ghi: bật RLS, không có policy nào cho authenticated.

-- Mỗi trình duyệt/máy đã bật thông báo là một dòng. endpoint là duy nhất: máy dùng chung đổi người
-- thì server ghi đè user_id (người đang đăng nhập mới nhận).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- Đã nhắc chỗ nào, cho giờ nào: khóa theo (chỗ, giờ tới) nên nhóm đổi giờ thì được nhắc lại theo giờ mới.
-- Server chèn dòng này TRƯỚC khi gửi (on conflict do nothing) để hai lượt cron chạy chồng không gửi trùng.
create table public.push_reminders_sent (
  trip_place_id uuid not null references public.trip_places (id) on delete cascade,
  visit_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (trip_place_id, visit_at)
);
alter table public.push_reminders_sent enable row level security;

-- Các chỗ (chưa bỏ, chưa đi) sẽ tới giờ trong p_window_min phút tới và chưa nhắc. Giờ trong chuyến là giờ Việt Nam.
create function public.due_push_reminders(p_window_min integer)
returns table (trip_place_id uuid, trip_id uuid, group_id uuid, place_name text, trip_name text, visit_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select tp.id, t.id, t.group_id, p.name, t.name, v.visit_at
  from public.trip_places tp
  join public.trips t on t.id = tp.trip_id
  join public.places p on p.id = tp.place_id
  cross join lateral (select (tp.visit_date + tp.visit_time) at time zone 'Asia/Ho_Chi_Minh' as visit_at) v
  where tp.visit_date is not null
    and tp.visit_time is not null
    and tp.status in ('wanted', 'confirmed')
    and v.visit_at > now()
    and v.visit_at <= now() + make_interval(mins => p_window_min)
    and not exists (
      select 1 from public.push_reminders_sent s where s.trip_place_id = tp.id and s.visit_at = v.visit_at
    );
$$;
revoke execute on function public.due_push_reminders(integer) from public, anon, authenticated;
grant execute on function public.due_push_reminders(integer) to service_role;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop function public.due_push_reminders(integer);
-- drop table public.push_reminders_sent;
-- drop table public.push_subscriptions;
