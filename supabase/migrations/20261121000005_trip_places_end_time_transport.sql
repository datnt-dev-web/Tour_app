-- Khung giờ có giờ kết thúc (08:45 - 09:30) và cách di chuyển tới chỗ đó (tàu, xe máy thuê...), như bảng kế hoạch của nhóm.

alter table public.trip_places
  add column visit_end_time time(0),
  add column transport text check (length(trim(transport)) between 1 and 40),
  -- Có giờ kết thúc thì phải có giờ bắt đầu và kết thúc sau bắt đầu (trong cùng ngày).
  add constraint trip_places_visit_end check (visit_end_time is null or (visit_time is not null and visit_end_time > visit_time));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- alter table public.trip_places drop constraint trip_places_visit_end, drop column transport, drop column visit_end_time;
