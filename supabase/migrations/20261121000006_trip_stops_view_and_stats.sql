-- Phân trang danh sách/timeline và thống kê tính ở database, để chuyến dài không phải tải hết về máy.

-- trip_stops: các chỗ còn hiệu lực của chuyến (không gồm "Bỏ"), kèm loại chỗ để sắp theo nhóm loại,
-- và cờ trùng giờ tính trên cả ngày (đúng cả khi danh sách bị chia trang).
-- security_invoker: RLS của trip_places/places áp theo người gọi, như truy vấn bảng trực tiếp.
create view public.trip_stops with (security_invoker = true) as
with active as (
  select tp.*, p.category
  from public.trip_places tp
  join public.places p on p.id = tp.place_id
  where tp.status <> 'dropped'
),
windowed as (
  select
    a.*,
    -- Giờ kết thúc muộn nhất của các chỗ trước trong ngày (chỗ không có giờ kết thúc coi như một thời điểm).
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
  -- Trùng: cùng giờ bắt đầu với chỗ liền kề, bắt đầu trước khi chỗ trước kết thúc, hoặc chỗ sau bắt đầu trước khi chỗ này kết thúc.
  coalesce(
    visit_time is not null and (
      visit_time = prev_start
      or visit_time = next_start
      or visit_time < prev_end
      or next_start < coalesce(visit_end_time, visit_time)
    ),
    false
  ) as clash
from windowed;

grant select on public.trip_stops to authenticated;

-- Thống kê một chuyến (như bảng kế hoạch: tổng tiền cả nhóm, chi phí khác, theo ngày/loại, tiến độ).
-- security invoker (mặc định): chỉ thấy chuyến của nhóm mình; chuyến không thấy được thì trả null.
create function public.trip_stats(p_trip_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with trip as (
    select party_size from public.trips where id = p_trip_id
  ),
  s as (
    select status, cost, visit_date, category from public.trip_stops where trip_id = p_trip_id
  )
  select case when not exists (select 1 from trip) then null else jsonb_build_object(
    'people', (select party_size from trip),
    'placesTotal', coalesce((select sum(cost) from s), 0),
    'expensesTotal', coalesce((select sum(amount) from public.trip_expenses where trip_id = p_trip_id), 0),
    'visitedTotal', coalesce((select sum(cost) from s where status = 'visited'), 0),
    'priced', (select count(*) from s where cost is not null),
    'active', (select count(*) from s),
    'visited', (select count(*) from s where status = 'visited'),
    'confirmed', (select count(*) from s where status = 'confirmed'),
    'wanted', (select count(*) from s where status = 'wanted'),
    'byCategory', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'total', total, 'count', n) order by category)
      from (select category, sum(cost) as total, count(*) as n from s where cost is not null group by category) x
    ), '[]'::jsonb),
    'byDay', coalesce((
      select jsonb_agg(jsonb_build_object('date', visit_date, 'total', total) order by visit_date nulls last)
      from (select visit_date, sum(cost) as total from s where cost is not null group by visit_date) x
    ), '[]'::jsonb)
  ) end;
$$;

revoke execute on function public.trip_stats(uuid) from public, anon;
grant execute on function public.trip_stats(uuid) to authenticated;

-- Phân trang lọc/sắp trên view này: theo loại (danh sách) và theo lịch (timeline).
create index trip_places_trip_schedule_idx on public.trip_places (trip_id, visit_date, visit_time);

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop index public.trip_places_trip_schedule_idx;
-- drop function public.trip_stats(uuid);
-- drop view public.trip_stops;
