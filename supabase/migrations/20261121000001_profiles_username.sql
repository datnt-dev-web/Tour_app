-- Đăng nhập bằng username do admin cấp (không còn tự đăng ký).
-- Username lưu chữ thường; null với tài khoản cũ chưa được cấp username.

alter table public.profiles
  add column username text unique
  check (username ~ '^[a-z0-9._]{3,32}$');

-- Người dùng chỉ được sửa tên hiển thị và màu avatar; username chỉ admin (service role) đổi.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_color) on public.profiles to authenticated;

-- Script cấp tài khoản truyền username qua user_metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    lower(nullif(new.raw_user_meta_data ->> 'username', ''))
  );
  return new;
end $$;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- create or replace function public.handle_new_user() returns trigger
-- language plpgsql security definer set search_path = '' as $$
-- begin
--   insert into public.profiles (id, display_name)
--   values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
--   return new;
-- end $$;
-- grant update on public.profiles to authenticated;
-- alter table public.profiles drop column username;
