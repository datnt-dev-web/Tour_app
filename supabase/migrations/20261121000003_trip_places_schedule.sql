-- Lịch ghé từng chỗ trong chuyến (timeline). Giờ địa phương của chuyến, không cần múi giờ.
-- Ngày và giờ đi cùng nhau: có cả hai hoặc không có cái nào.

alter table public.trip_places
  add column visit_date date,
  add column visit_time time(0),
  add constraint trip_places_visit_pair check ((visit_date is null) = (visit_time is null));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- alter table public.trip_places drop constraint trip_places_visit_pair, drop column visit_time, drop column visit_date;
