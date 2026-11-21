-- Cứ 5 phút gọi /api/cron/reminders để gửi thông báo nhắc giờ (gói Free của Vercel chỉ cho cron mỗi ngày một lần).
-- URL và khóa bí mật nằm trong Supabase Vault, không nằm trong repo; tạo bằng tay ở từng môi trường:
--   select vault.create_secret('https://<domain>/api/cron/reminders', 'push_cron_url');
--   select vault.create_secret('<giá trị CRON_SECRET>', 'push_cron_secret');
-- Chưa có hai secret này (vd. stack local) thì job chạy nhưng không gọi đi đâu.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'push-reminders',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    timeout_milliseconds := 20000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_cron_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'push_cron_secret');
  $job$
);

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- select cron.unschedule('push-reminders');
-- delete from vault.secrets where name in ('push_cron_url', 'push_cron_secret');
