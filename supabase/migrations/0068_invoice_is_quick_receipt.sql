-- Marks an invoice/receipt as a quick walk-in receipt (created via the
-- Daily Sales "Generate Receipt" handoff, see src/lib/pendingReceipt.ts)
-- rather than a normal installation invoice. Defaults to false, so every
-- existing invoice -- and any created the normal way going forward --
-- is completely unaffected: this only changes which sections the
-- Invoice Builder shows/prints, and only for documents that opt into it.
alter table public.invoices add column is_quick_receipt boolean not null default false;

comment on column public.invoices.is_quick_receipt is 'True for a quick receipt generated from a Daily Sales walk-in sale -- the Invoice Builder hides Payment Record/Payment Terms for these, since a walk-in sale is paid in full on the spot and has no deposit/balance schedule. False (the default) for a normal invoice, e.g. a solar installation job, which keeps showing them.';
