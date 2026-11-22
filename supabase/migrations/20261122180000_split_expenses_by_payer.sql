-- Chia tiền nhiều người trả: mỗi khoản (giá một chỗ, chi phí khác) ghi ai đã trả, mọi khoản chia đều cho người tham gia;
-- cuối chuyến ai được chia trả thẳng cho người đã chi (gộp và đối trừ theo từng cặp người).
-- Thay cách cũ "một thủ quỹ trả hết": tài khoản nhận tiền chuyển từ chuyến sang từng người, dấu "đã chuyển"
-- thay bằng các lần chuyển thật (số tiền cụ thể) để sửa khoản chi sau đó vẫn biết còn thiếu bao nhiêu.

-- Khóa (trip_id, id) để khóa ngoại bên dưới chỉ trỏ được tới người của đúng chuyến đó.
alter table public.trip_participants
  add constraint trip_participants_trip_id_id_key unique (trip_id, id),
  add column bank_bin text check (bank_bin ~ '^\d{6}$'),
  add column account_no text check (account_no ~ '^[0-9A-Za-z]{4,19}$'),
  add column account_name text check (length(trim(account_name)) between 1 and 60),
  -- Đủ cả ba hoặc không có gì, để mã VietQR không bao giờ thiếu thông tin.
  add constraint trip_participants_bank_complete check (
    (bank_bin is null and account_no is null and account_name is null)
    or (bank_bin is not null and account_no is not null and account_name is not null)
  );

-- Khóa ngoại mặc định (NO ACTION): không xóa được người còn được ghi là đã trả một khoản hoặc có lần chuyển tiền,
-- tránh mất dấu tiền; xóa cả chuyến thì mọi thứ cùng bị xóa trong một lệnh nên vẫn được.
alter table public.trip_places
  add column paid_by uuid,
  add constraint trip_places_paid_by_fkey foreign key (trip_id, paid_by) references public.trip_participants (trip_id, id);
create index trip_places_paid_by_idx on public.trip_places (paid_by) where paid_by is not null;

alter table public.trip_expenses
  add column paid_by uuid,
  add constraint trip_expenses_paid_by_fkey foreign key (trip_id, paid_by) references public.trip_participants (trip_id, id);
create index trip_expenses_paid_by_idx on public.trip_expenses (paid_by) where paid_by is not null;

-- Một lần chuyển tiền thật giữa hai người trong chuyến.
create table public.trip_transfers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_id uuid not null,
  to_id uuid not null,
  amount bigint not null check (amount > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint trip_transfers_distinct check (from_id <> to_id),
  constraint trip_transfers_from_fkey foreign key (trip_id, from_id) references public.trip_participants (trip_id, id),
  constraint trip_transfers_to_fkey foreign key (trip_id, to_id) references public.trip_participants (trip_id, id)
);
create index trip_transfers_trip_id_idx on public.trip_transfers (trip_id);
create index trip_transfers_from_id_idx on public.trip_transfers (from_id);
create index trip_transfers_to_id_idx on public.trip_transfers (to_id);
create index trip_transfers_created_by_idx on public.trip_transfers (created_by);

alter table public.trip_transfers enable row level security;
create policy trip_transfers_all on public.trip_transfers for all to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
  with check (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

-- Dữ liệu cũ: thủ quỹ đã trả mọi khoản có giá; tài khoản nhận tiền của chuyến là của thủ quỹ.
-- (Dấu "đã chuyển" cũ dựa trên số làm tròn kiểu cũ nên không chuyển thành lần chuyển tiền; người dùng bấm lại.)
update public.trip_participants p
set bank_bin = t.payer_bank_bin, account_no = t.payer_account_no, account_name = t.payer_account_name
from public.trips t
where p.trip_id = t.id and p.is_payer
  and t.payer_bank_bin is not null and t.payer_account_no is not null and t.payer_account_name is not null;

update public.trip_places tp
set paid_by = p.id
from public.trip_participants p
where p.trip_id = tp.trip_id and p.is_payer and tp.cost is not null;

update public.trip_expenses e
set paid_by = p.id
from public.trip_participants p
where p.trip_id = e.trip_id and p.is_payer;

drop index public.trip_participants_one_payer;
alter table public.trip_participants drop column is_payer, drop column paid;
alter table public.trips drop column payer_bank_bin, drop column payer_account_no, drop column payer_account_name;

-- Thêm paid_by vào cuối view (create or replace chỉ cho thêm cột ở cuối).
create or replace view public.trip_stops with (security_invoker = true) as
with active as (
  select tp.*, p.category
  from public.trip_places tp
  join public.places p on p.id = tp.place_id
  where tp.status <> 'dropped'
),
windowed as (
  select
    a.*,
    max(coalesce(a.visit_end_time, a.visit_time)) over w_before as prev_end,
    lag(a.visit_time) over w as prev_start,
    lead(a.visit_time) over w as next_start
  from active a
  window
    w as (partition by a.trip_id, a.visit_date order by a.visit_time, a.id),
    w_before as (partition by a.trip_id, a.visit_date order by a.visit_time, a.id rows between unbounded preceding and 1 preceding)
)
select
  id, trip_id, place_id, added_by, note, status, visit_date, visit_time, visit_end_time, transport, cost, category,
  coalesce(
    visit_time is not null and (
      visit_time = prev_start
      or visit_time = next_start
      or visit_time < prev_end
      or next_start < coalesce(visit_end_time, visit_time)
    ),
    false
  ) as clash,
  paid_by
from windowed;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- create or replace view không bỏ được cột: drop view public.trip_stops; rồi tạo lại như 20261121000006 (không có paid_by)
--   và grant select on public.trip_stops to authenticated;
-- alter table public.trips add column payer_bank_bin text check (payer_bank_bin ~ '^\d{6}$'),
--   add column payer_account_no text check (payer_account_no ~ '^[0-9A-Za-z]{4,19}$'),
--   add column payer_account_name text check (length(trim(payer_account_name)) between 1 and 60);
-- alter table public.trip_participants add column is_payer boolean not null default false, add column paid boolean not null default false;
-- create unique index trip_participants_one_payer on public.trip_participants (trip_id) where is_payer;
-- (khôi phục thủ quỹ/tài khoản từ paid_by và bank_* nếu cần, trước khi bỏ các cột dưới)
-- drop table public.trip_transfers;
-- alter table public.trip_expenses drop constraint trip_expenses_paid_by_fkey, drop column paid_by;
-- alter table public.trip_places drop constraint trip_places_paid_by_fkey, drop column paid_by;
-- alter table public.trip_participants drop constraint trip_participants_bank_complete,
--   drop column account_name, drop column account_no, drop column bank_bin,
--   drop constraint trip_participants_trip_id_id_key;
