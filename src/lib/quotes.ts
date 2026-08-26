import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Quote, QuoteLineItem, QuoteLoadCalc, QuoteSystemType, QuoteTemplate, SavedQuoteItem } from "@/types";

/** Row shape from `select * from public.quotes` (0057_quote_builder.sql).
 * `line_items`/`load_calc` are jsonb -- Postgres returns them already
 * parsed as JS values via supabase-js, not as strings needing JSON.parse. */
interface QuoteRow {
  id: string;
  owner_id: string;
  owner_role: "staff" | "installer";
  system_type: QuoteSystemType;
  quote_number: string | null;
  quote_date: string;
  customer_name: string | null;
  customer_address: string | null;
  line_items: QuoteLineItem[] | null;
  subtotal: number;
  vat_percent: number;
  grand_total: number;
  load_calc: QuoteLoadCalc | null;
  created_at: string;
  updated_at: string;
}

function mapQuoteRow(row: QuoteRow): Quote {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerRole: row.owner_role,
    systemType: row.system_type,
    quoteNumber: row.quote_number,
    quoteDate: row.quote_date,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    lineItems: row.line_items ?? [],
    subtotal: Number(row.subtotal),
    vatPercent: Number(row.vat_percent),
    grandTotal: Number(row.grand_total),
    loadCalc: row.load_calc,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QuoteTemplateRow {
  id: string;
  system_type: QuoteSystemType;
  name: string;
  line_items: QuoteLineItem[] | null;
  load_calc: QuoteLoadCalc | null;
}

export function mapQuoteTemplateRow(row: QuoteTemplateRow): QuoteTemplate {
  return {
    id: row.id,
    systemType: row.system_type,
    name: row.name,
    lineItems: row.line_items ?? [],
    loadCalc: row.load_calc,
  };
}

/** Every quote this staff member has saved, most recent first -- RLS
 * (`owner_id = auth.uid() or is_admin()`) already scopes this to their
 * own rows unless they're an admin. */
export async function getQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to load quotes:", error.message);
    return [];
  }

  return ((data ?? []) as QuoteRow[]).map(mapQuoteRow);
}

export async function getQuote(id: string): Promise<Quote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();

  if (error || !data) return null;

  return mapQuoteRow(data as QuoteRow);
}

export async function getSavedItems(): Promise<SavedQuoteItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_saved_items")
    .select("id, name, description, rate")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to load saved quote items:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    rate: Number(row.rate),
  }));
}

export async function getQuoteTemplates(): Promise<QuoteTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_templates")
    .select("id, system_type, name, line_items, load_calc")
    .order("name", { ascending: true });

  if (error) {
    console.warn("Failed to load quote templates:", error.message);
    return [];
  }

  return ((data ?? []) as QuoteTemplateRow[]).map(mapQuoteTemplateRow);
}
