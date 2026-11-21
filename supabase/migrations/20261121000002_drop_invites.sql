-- Bỏ đăng nhập theo lời mời: tài khoản do admin cấp (xem 20261121000001_profiles_username.sql).

drop table public.invites;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- create table public.invites (
--   id uuid primary key default gen_random_uuid(),
--   token text not null unique,
--   group_id uuid not null references public.groups (id) on delete cascade,
--   created_by uuid not null references public.profiles (id),
--   expires_at timestamptz not null,
--   used_by uuid references public.profiles (id),
--   used_at timestamptz
-- );
-- alter table public.invites enable row level security;
-- revoke all on public.invites from anon, authenticated;
