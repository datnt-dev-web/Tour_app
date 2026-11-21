-- Nhập nhiều chỗ vào chuyến từ file sheet trong MỘT transaction: một dòng hỏng thì cả lô không ghi gì.
-- security invoker: RLS của trips/places/trip_places áp theo người gọi, như khi thêm từng chỗ qua API.
-- p_rows: [{ place_id (null = tạo chỗ mới), name, category, address, maps_url, note, city_norm }].
-- Server đã ghép place_id theo tên chuẩn hóa (bỏ dấu) vì Postgres không có sẵn hàm bỏ dấu giống app.
create function public.import_trip_places(p_trip_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip public.trips%rowtype;
  v_row record;
  v_place_id uuid;
  v_added integer := 0;
  v_inserted integer;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  -- Không thấy chuyến = không có quyền (RLS) hoặc không tồn tại: không lộ chuyến của nhóm khác.
  if not found then
    raise exception 'trip not accessible' using errcode = '42501';
  end if;

  for v_row in
    select * from jsonb_to_recordset(p_rows)
      as r(place_id uuid, name text, category public.place_category, address text, maps_url text, note text, city_norm text)
  loop
    v_place_id := v_row.place_id;
    if v_place_id is null then
      insert into public.places (group_id, name, city, city_norm, address, category, maps_url, verified)
      values (v_trip.group_id, v_row.name, v_trip.city, v_row.city_norm, v_row.address, v_row.category, v_row.maps_url, false)
      returning id into v_place_id;
    end if;

    insert into public.trip_places (trip_id, place_id, note)
    values (p_trip_id, v_place_id, v_row.note)
    on conflict (trip_id, place_id) do nothing;
    get diagnostics v_inserted = row_count;
    v_added := v_added + v_inserted;
  end loop;

  return jsonb_build_object('added', v_added, 'skipped', jsonb_array_length(p_rows) - v_added);
end;
$$;

revoke execute on function public.import_trip_places(uuid, jsonb) from public, anon;
grant execute on function public.import_trip_places(uuid, jsonb) to authenticated;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop function public.import_trip_places(uuid, jsonb);
