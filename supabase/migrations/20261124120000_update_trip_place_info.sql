-- Sửa một chỗ trong chuyến (tab Danh sách): tên, địa chỉ, loại nằm ở places (dùng chung với sổ quán),
-- ghi chú nằm ở trip_places. Ghi hai bảng trong MỘT transaction để không bao giờ chỉ sửa được một nửa.
-- security invoker: RLS của trip_places/places áp theo người gọi (mọi thành viên nhóm đều được sửa, như khi thêm).
-- Không đụng cost/paid_by nên trigger chỉ-admin của tiền không chặn.
create function public.update_trip_place_info(
  p_trip_place_id uuid,
  p_name text,
  p_address text,
  p_category public.place_category,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_place_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'name required' using errcode = '22023';
  end if;

  update public.trip_places
  set note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_trip_place_id
  returning place_id into v_place_id;
  -- Không thấy dòng = không có quyền (RLS) hoặc không tồn tại: không lộ dữ liệu nhóm khác.
  if v_place_id is null then
    raise exception 'trip place not accessible' using errcode = 'P0002';
  end if;

  update public.places
  set name = trim(p_name),
      address = nullif(trim(coalesce(p_address, '')), ''),
      category = p_category
  where id = v_place_id;
end;
$$;

revoke execute on function public.update_trip_place_info(uuid, text, text, public.place_category, text) from public, anon;
grant execute on function public.update_trip_place_info(uuid, text, text, public.place_category, text) to authenticated;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop function public.update_trip_place_info(uuid, text, text, public.place_category, text);
