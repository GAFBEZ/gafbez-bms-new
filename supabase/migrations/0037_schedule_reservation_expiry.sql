-- ---------------------------------------------------------------------
-- Actually schedule release_expired_reservations() (0030_orders_and_
-- payments.sql). The function has existed since Stage 5 and the website
-- has a matching /api/cron/release-expired-reservations HTTP endpoint,
-- but nothing was ever wired up to call either one -- every checkout
-- (Paystack AND a staff-confirmed WhatsApp order) reserves stock for
-- reservation_expiry_minutes (default 30), and with no sweep running,
-- get_available_to_sell() keeps counting that stock as gone forever once
-- the customer abandons checkout or a WhatsApp deal falls through.
--
-- pg_cron running inside the database is simpler and more reliable here
-- than Vercel Cron: no HTTP round trip, no CRON_SECRET/SUPABASE_SERVICE_
-- ROLE_KEY dependency, and it keeps running even if the website deployment
-- is down. The website's HTTP endpoint is left in place as a manual/
-- backup trigger -- this doesn't replace it, just stops relying on it as
-- the only mechanism.
-- ---------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;

-- Defensive: cron.schedule() jobs run as whichever role calls it (the
-- migration runner, effectively "postgres" on Supabase) -- postgres
-- already has this in practice, but being explicit costs nothing and
-- keeps this migration self-contained if that ever changes.
grant execute on function public.release_expired_reservations() to postgres;

-- unschedule first so re-running this migration (or a future edit to the
-- schedule) doesn't error on a duplicate job name.
select cron.unschedule(jobid)
  from cron.job
  where jobname = 'release-expired-reservations';

select cron.schedule(
  'release-expired-reservations',
  '*/5 * * * *',
  $$select public.release_expired_reservations();$$
);
