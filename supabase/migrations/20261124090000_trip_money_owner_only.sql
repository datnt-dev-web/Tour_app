-- Tiền của chuyến (chi phí khác; giá và người trả của từng chỗ) chỉ owner nhóm của chuyến (admin) được ghi.
-- Thành viên vẫn xem được. Chặn ở database để không ai vượt qua được bằng cách gọi thẳng API.

-- Người gọi có phải owner nhóm của chuyến không. security definer: đọc group_members không qua RLS
-- (như is_group_member). Chỉ trả lời về chính người gọi; chuyến của nhóm khác luôn là false.
create function public.is_trip_owner(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trips t
    join public.group_members m on m.group_id = t.group_id
    where t.id = p_trip_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;
revoke execute on function public.is_trip_owner(uuid) from public, anon;
grant execute on function public.is_trip_owner(uuid) to authenticated;

-- trip_expenses: thành viên đọc, chỉ owner thêm/sửa/xóa.
drop policy trip_expenses_all on public.trip_expenses;
create policy trip_expenses_select on public.trip_expenses for select to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));
create policy trip_expenses_insert on public.trip_expenses for insert to authenticated
  with check (public.is_trip_owner(trip_id));
create policy trip_expenses_update on public.trip_expenses for update to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
create policy trip_expenses_delete on public.trip_expenses for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- trip_places: thành viên vẫn sửa giờ, phương tiện, trạng thái...; riêng cost và paid_by chỉ owner được đặt/đổi.
-- RLS không chặn theo cột được nên dùng trigger.
create function private.guard_trip_place_money() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Không có phiên người dùng (service role: seed, script quản trị) thì không chặn.
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.cost is null and new.paid_by is null then
      return new;
    end if;
  elsif new.cost is not distinct from old.cost and new.paid_by is not distinct from old.paid_by then
    return new;
  end if;
  if not public.is_trip_owner(new.trip_id) then
    raise exception 'Chỉ admin nhóm được sửa giá và người trả' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trip_places_money_owner_only before insert or update on public.trip_places
  for each row execute function private.guard_trip_place_money();

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop trigger trip_places_money_owner_only on public.trip_places;
-- drop function private.guard_trip_place_money();
-- drop policy trip_expenses_select on public.trip_expenses;
-- drop policy trip_expenses_insert on public.trip_expenses;
-- drop policy trip_expenses_update on public.trip_expenses;
-- drop policy trip_expenses_delete on public.trip_expenses;
-- create policy trip_expenses_all on public.trip_expenses for all to authenticated
--   using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
--   with check (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));
-- drop function public.is_trip_owner(uuid);
