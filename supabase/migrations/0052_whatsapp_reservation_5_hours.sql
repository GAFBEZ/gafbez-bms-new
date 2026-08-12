-- Business decision: 3 days (0050's default) was too long to hold stock
-- for a confirmed WhatsApp order the customer hasn't paid for yet.
-- Shortens the window to 5 hours -- both the default for future rows and
-- the live singleton app_settings row.

alter table public.app_settings
  alter column whatsapp_reservation_hours set default 5;

update public.app_settings set whatsapp_reservation_hours = 5;

comment on column public.app_settings.whatsapp_reservation_hours is 'How long stock stays reserved for a confirmed WhatsApp order awaiting in-person payment/pickup before release_expired_reservations() releases it and expires the order. Default 5 hours -- deliberately shorter than the original 3-day default (see 0050) per business decision to free up unpaid/unconfirmed stock faster. Still separate from reservation_expiry_minutes, which is for the website''s own card-payment checkout.';
