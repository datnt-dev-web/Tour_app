-- Hiệu năng RLS và index (theo khuyến nghị RLS performance của Supabase).
--
-- Trước: policy gọi is_group_member(group_id) cho TỪNG dòng (mỗi lần một lượt tra group_members), và bảng con
-- còn chạy thêm truy vấn con vào trips cho từng dòng. Chi phí tăng theo tổng số dòng của mọi nhóm.
-- Sau: lấy danh sách nhóm của người gọi MỘT lần mỗi truy vấn (private.my_group_ids), rồi so bằng hash/index.
-- Ý nghĩa quyền giữ nguyên: chỉ thành viên nhóm thấy/ghi dữ liệu của nhóm; ràng buộc "cùng nhóm" giữ nguyên.

-- Schema không mở qua API (PostgREST chỉ mở public), nên hàm không gọi được từ client.
create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer: đọc group_members không qua RLS (tránh đệ quy policy của chính group_members).
-- Chỉ trả nhóm của chính người gọi (auth.uid()), không nhận tham số.
create function private.my_group_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select group_id from public.group_members where user_id = (select auth.uid());
$$;
revoke execute on function private.my_group_ids() from public, anon;
grant execute on function private.my_group_ids() to authenticated;

-- groups / group_members
drop policy groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (id in (select private.my_group_ids()));

drop policy group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (group_id in (select private.my_group_ids()));

-- profiles: thấy mình và người cùng nhóm
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select m.user_id from public.group_members m where m.group_id in (select private.my_group_ids()))
  );

-- Bảng có group_id
drop policy trips_all on public.trips;
create policy trips_all on public.trips for all to authenticated
  using (group_id in (select private.my_group_ids()))
  with check (group_id in (select private.my_group_ids()));

drop policy places_all on public.places;
create policy places_all on public.places for all to authenticated
  using (group_id in (select private.my_group_ids()))
  with check (group_id in (select private.my_group_ids()));

-- Bảng con của trips: trip thuộc nhóm của mình; place phải cùng nhóm với trip (chỉ kiểm khi ghi)
drop policy trip_places_all on public.trip_places;
create policy trip_places_all on public.trip_places for all to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
  with check (
    trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids()))
    and (select t.group_id from public.trips t where t.id = trip_id)
      = (select p.group_id from public.places p where p.id = place_id)
  );

drop policy trip_expenses_all on public.trip_expenses;
create policy trip_expenses_all on public.trip_expenses for all to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
  with check (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

-- Đánh giá nội bộ: đọc theo nhóm của place; ghi là của chính mình, trip (nếu có) cùng nhóm với place
drop policy reviews_select on public.place_reviews_internal;
create policy reviews_select on public.place_reviews_internal for select to authenticated
  using (place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids())));

drop policy reviews_insert on public.place_reviews_internal;
create policy reviews_insert on public.place_reviews_internal for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids()))
    and (
      trip_id is null
      or (select t.group_id from public.trips t where t.id = trip_id)
        = (select p.group_id from public.places p where p.id = place_id)
    )
  );

drop policy reviews_update on public.place_reviews_internal;
create policy reviews_update on public.place_reviews_internal for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids()))
    and (
      trip_id is null
      or (select t.group_id from public.trips t where t.id = trip_id)
        = (select p.group_id from public.places p where p.id = place_id)
    )
  );

-- Index cho khóa ngoại chưa có (xóa/cập nhật bảng cha khỏi phải quét toàn bảng con; join theo place/trip).
create index trip_places_place_id_idx on public.trip_places (place_id);
create index place_reviews_trip_id_idx on public.place_reviews_internal (trip_id);
create index place_reviews_user_id_idx on public.place_reviews_internal (user_id);
create index trip_places_added_by_idx on public.trip_places (added_by);
create index trips_created_by_idx on public.trips (created_by);
create index places_created_by_idx on public.places (created_by);
create index groups_created_by_idx on public.groups (created_by);
create index trip_expenses_created_by_idx on public.trip_expenses (created_by);

-- Thừa: trip_id đã đứng đầu unique (trip_id, place_id) và index lịch (trip_id, visit_date, visit_time).
drop index public.trip_places_trip_id_idx;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- create index trip_places_trip_id_idx on public.trip_places (trip_id);
-- drop index public.trip_expenses_created_by_idx, public.groups_created_by_idx, public.places_created_by_idx,
--   public.trips_created_by_idx, public.trip_places_added_by_idx, public.place_reviews_user_id_idx,
--   public.place_reviews_trip_id_idx, public.trip_places_place_id_idx;
-- Tạo lại các policy như trong 20261120000001_init.sql và 20261121000004_trip_costs.sql (dùng public.is_group_member),
-- rồi: drop function private.my_group_ids(); drop schema private;
