-- Chia tiền kiểu "một người trả hết, cuối chuyến chia đều": danh sách người tham gia (tên, không cần tài khoản),
-- một thủ quỹ, đánh dấu ai đã chuyển; tài khoản ngân hàng của thủ quỹ để tạo mã VietQR.
create table public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_payer boolean not null default false,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index trip_participants_name_uniq on public.trip_participants (trip_id, lower(trim(name)));
-- Mỗi chuyến tối đa một thủ quỹ.
create unique index trip_participants_one_payer on public.trip_participants (trip_id) where is_payer;

alter table public.trips
  add column payer_bank_bin text check (payer_bank_bin ~ '^\d{6}$'),
  add column payer_account_no text check (payer_account_no ~ '^[0-9A-Za-z]{4,19}$'),
  add column payer_account_name text check (length(trim(payer_account_name)) between 1 and 60);

alter table public.trip_participants enable row level security;
create policy trip_participants_all on public.trip_participants for all to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
  with check (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

-- Số người chia tiền (trips.party_size, dùng cho thống kê) đi theo danh sách người tham gia khi đã có danh sách.
-- security invoker: chỉ cập nhật được chuyến mà người gọi có quyền (RLS của trips).
create function public.sync_party_size() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_trip uuid := coalesce(new.trip_id, old.trip_id);
  v_count integer;
begin
  select count(*) into v_count from public.trip_participants where trip_id = v_trip;
  if v_count > 0 then
    update public.trips set party_size = v_count where id = v_trip;
  end if;
  return null;
end;
$$;
revoke execute on function public.sync_party_size() from public, anon, authenticated;

create trigger trip_participants_sync_party_size
  after insert or delete on public.trip_participants
  for each row execute function public.sync_party_size();

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop trigger trip_participants_sync_party_size on public.trip_participants;
-- drop function public.sync_party_size();
-- alter table public.trips drop column payer_account_name, drop column payer_account_no, drop column payer_bank_bin;
-- drop table public.trip_participants;
