-- Plain free-text customer name on each installation job, for record
-- keeping ("whose job was this"). Deliberately not a foreign key to
-- customers -- installations remain a standalone job record (see
-- 0025_installations.sql), not integrated into the Customers CRM.

alter table public.installations add column customer_name text;
