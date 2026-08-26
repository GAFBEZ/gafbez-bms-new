"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { mapQuoteTemplateRow, type QuoteTemplateRow } from "@/lib/quotes";
import type { QuoteLineItem, QuoteLoadCalc, QuoteSystemType, QuoteTemplate, SavedQuoteItem } from "@/types";

const QUOTE_BUILDER_PATH = "/dashboard/quote-builder";

export interface SaveQuoteInput {
  id?: string;
  systemType: QuoteSystemType;
  quoteNumber: string | null;
  quoteDate: string;
  customerName: string | null;
  customerAddress: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  vatPercent: number;
  grandTotal: number;
  loadCalc: QuoteLoadCalc | null;
}

export async function saveQuote(input: SaveQuoteInput): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in first." };

  const supabase = await createClient();
  const payload = {
    owner_id: user.id,
    owner_role: "staff" as const,
    system_type: input.systemType,
    quote_number: input.quoteNumber,
    quote_date: input.quoteDate,
    customer_name: input.customerName,
    customer_address: input.customerAddress,
    line_items: input.lineItems,
    subtotal: input.subtotal,
    vat_percent: input.vatPercent,
    grand_total: input.grandTotal,
    load_calc: input.loadCalc,
  };

  const { data, error } = input.id
    ? await supabase.from("quotes").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("quotes").insert(payload).select("id").single();

  if (error || !data) {
    console.error("[quotes] saveQuote failed:", error);
    return { error: "We couldn't save this quote. Please try again." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { id: data.id as string };
}

export async function deleteQuote(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);

  if (error) {
    console.error("[quotes] deleteQuote failed:", error);
    return { error: "We couldn't delete this quote." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { ok: true };
}

export async function saveQuoteItem(
  name: string,
  description: string,
  rate: number,
): Promise<{ item: SavedQuoteItem } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in first." };
  if (!name.trim()) return { error: "Give this item a name before saving it." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_saved_items")
    .insert({ owner_id: user.id, name: name.trim(), description: description.trim() || null, rate })
    .select("id, name, description, rate")
    .single();

  if (error || !data) {
    console.error("[quotes] saveQuoteItem failed:", error);
    return { error: "We couldn't save this item. Please try again." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { item: { id: data.id, name: data.name, description: data.description, rate: Number(data.rate) } };
}

export async function deleteSavedItem(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_saved_items").delete().eq("id", id);

  if (error) {
    console.error("[quotes] deleteSavedItem failed:", error);
    return { error: "We couldn't remove this saved item." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { ok: true };
}

export async function saveQuoteTemplate(
  name: string,
  systemType: QuoteSystemType,
  lineItems: QuoteLineItem[],
  loadCalc: QuoteLoadCalc | null,
): Promise<{ template: QuoteTemplate } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in first." };
  if (!name.trim()) return { error: "Give this template a name before saving it." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_templates")
    .insert({
      owner_id: user.id,
      system_type: systemType,
      name: name.trim(),
      line_items: lineItems,
      load_calc: loadCalc,
    })
    .select("id, system_type, name, line_items, load_calc")
    .single();

  if (error || !data) {
    console.error("[quotes] saveQuoteTemplate failed:", error);
    return { error: "We couldn't save this template. Please try again." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { template: mapQuoteTemplateRow(data as QuoteTemplateRow) };
}

export async function deleteQuoteTemplate(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_templates").delete().eq("id", id);

  if (error) {
    console.error("[quotes] deleteQuoteTemplate failed:", error);
    return { error: "We couldn't remove this template." };
  }

  revalidatePath(QUOTE_BUILDER_PATH);
  return { ok: true };
}
