-- Thống kê chi phí chuyến đi (theo bảng kế hoạch của nhóm):
--   cost của từng chỗ là tổng tiền cả nhóm (VND, null = chưa có giá), chia đầu người theo party_size;
--   trip_expenses là chi phí không gắn với quán (vé tàu, khách sạn, thuê xe...).

alter table public.trip_places
  add column cost bigint check (cost >= 0);

alter table public.trips
  add column party_size integer not null default 1 check (party_size between 1 and 100);

-- Chuyến có sẵn: số người = số thành viên nhóm hiện tại.
update public.trips t
set party_size = greatest(1, (select count(*) from public.group_members m where m.group_id = t.group_id));

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 120),
  amount bigint not null check (amount >= 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index trip_expenses_trip_id_idx on public.trip_expenses (trip_id);

alter table public.trip_expenses enable row level security;
-- Như trip_places: thành viên nhóm của chuyến được đọc/ghi.
create policy trip_expenses_all on public.trip_expenses for all to authenticated
  using (public.is_group_member((select t.group_id from public.trips t where t.id = trip_id)))
  with check (public.is_group_member((select t.group_id from public.trips t where t.id = trip_id)));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop table public.trip_expenses;
-- alter table public.trips drop column party_size;
-- alter table public.trip_places drop column cost;
