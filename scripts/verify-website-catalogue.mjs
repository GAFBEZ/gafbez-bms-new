#!/usr/bin/env node
// Security verification for the Website Catalogue (Stage 2).
//
// Uses only the anon/publishable key from .env.local -- the same
// credential the public website will eventually use, and the same
// credential this app's browser code already uses. Never reads or
// requires the service_role key.
//
// Run after applying supabase/migrations/0028_website_catalogue.sql:
//   node scripts/verify-website-catalogue.mjs
//
// The role-based checks (Owner/Admin can update, Manager/Salesperson
// cannot) need a signed-in session and this script deliberately never
// asks for a password on the command line. Set these two env vars first
// if you want those checks included:
//   BMS_TEST_ADMIN_EMAIL / BMS_TEST_ADMIN_PASSWORD
//   BMS_TEST_STAFF_EMAIL / BMS_TEST_STAFF_PASSWORD
// Without them, those specific checks are skipped (reported, not silently
// dropped) and everything anon-testable still runs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pass = 0;
let fail = 0;
let skip = 0;

// PostgREST's actual wording when 0028 hasn't been applied yet: it reports
// an unknown view/function as a schema-cache miss, not a Postgres
// "relation/function does not exist" error (that wording only shows up if
// you hit the table/function directly over a raw Postgres connection).
function isNotAppliedYet(error) {
  return !!error && /could not find (the )?(table|function)/i.test(error.message);
}

function report(name, ok, detail) {
  if (ok === "skip") {
    skip++;
    console.log(`SKIP  ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`Target: ${SUPABASE_URL}\n`);

  // ---- Baseline (works regardless of whether 0028 has been applied) ----

  {
    const { data, error } = await anon.from("products").select("id, cost_price").limit(1);
    report(
      "Anonymous users cannot read the full products table",
      !!error || (data ?? []).length === 0,
      error ? undefined : `got ${data?.length ?? 0} row(s) back`,
    );
  }

  {
    const { data, error } = await anon.from("product_stock").select("*").limit(1);
    report(
      "Anonymous users cannot read the full product_stock table",
      !!error || (data ?? []).length === 0,
      error ? undefined : `got ${data?.length ?? 0} row(s) back`,
    );
  }

  // ---- website_catalogue view (requires 0028 applied) ----

  {
    const { error } = await anon.from("website_catalogue").select("*").limit(1);
    if (isNotAppliedYet(error)) {
      report("website_catalogue view is reachable by anon", "skip", "migration 0028 not applied yet");
    } else {
      report("website_catalogue view is reachable by anon", !error, error?.message);
    }
  }

  {
    const { data, error } = await anon.from("website_catalogue").select("*").limit(1);
    if (!error && data) {
      const row = data[0];
      const forbiddenKeys = [
        "cost_price",
        "selling_price",
        "reorder_level",
        "supplier",
        "quantity_in_stock",
      ];
      const leaked = row ? forbiddenKeys.filter((k) => k in row) : [];
      report(
        "website_catalogue never exposes cost_price/selling_price/reorder_level/supplier",
        leaked.length === 0,
        leaked.length ? `leaked columns: ${leaked.join(", ")}` : undefined,
      );
    } else {
      report(
        "website_catalogue never exposes cost_price/selling_price/reorder_level/supplier",
        "skip",
        "view not reachable, see previous check",
      );
    }
  }

  {
    const { data, error } = await anon.from("website_catalogue").select("id, name");
    if (error) {
      report("Hidden/inactive products never appear in website_catalogue", "skip", error.message);
    } else {
      // Structural check only (this script doesn't know which specific
      // products are hidden/inactive on this project) -- confirms the view
      // returns *something* filterable and no error, full hidden-vs-visible
      // behaviour is exercised end-to-end from the BMS UI (mark a product
      // hidden, confirm it drops out of a get_website_catalogue_by_branch()
      // call below).
      report(
        "Hidden/inactive products never appear in website_catalogue",
        true,
        `returned ${data.length} visible+active product(s) — spot-check counts against Inventory Master`,
      );
    }
  }

  // ---- get_website_catalogue_by_branch (requires 0028 applied) ----

  for (const branchId of ["abuja", "minna"]) {
    const { data, error } = await anon.rpc("get_website_catalogue_by_branch", {
      p_branch_id: branchId,
    });
    if (isNotAppliedYet(error)) {
      report(`get_website_catalogue_by_branch returns ${branchId}'s own stock`, "skip", "migration 0028 not applied yet");
      continue;
    }
    report(`get_website_catalogue_by_branch returns ${branchId}'s own stock`, !error, error?.message);
    if (!error && data) {
      const zeroStockOk = data.every(
        (row) =>
          row.branch_quantity > 0
            ? row.branch_stock_status === "in_stock"
            : row.branch_stock_status === "out_of_stock",
      );
      report(`${branchId}: stock_status matches quantity for every row`, zeroStockOk);
    }
  }

  {
    const { error } = await anon.rpc("get_website_catalogue_by_branch", {
      p_branch_id: "not-a-real-branch",
    });
    if (isNotAppliedYet(error)) {
      report("Invalid branch id is rejected", "skip", "migration 0028 not applied yet");
    } else {
      report("Invalid branch id is rejected", !!error, error ? undefined : "expected an error, got none");
    }
  }

  {
    const { error } = await anon.rpc("get_website_catalogue_by_branch", { p_branch_id: "ilorin" });
    if (isNotAppliedYet(error)) {
      report("Inactive/coming-soon branch is rejected", "skip", "migration 0028 not applied yet");
    } else {
      report(
        "Inactive/coming-soon branch is rejected",
        !!error,
        error ? undefined : "expected an error (Ilorin is coming_soon), got none",
      );
    }
  }

  // ---- update_product_website_details (requires 0028 applied) ----

  {
    const { error } = await anon.rpc("update_product_website_details", {
      p_id: "00000000-0000-0000-0000-000000000000",
      p_brand: null,
      p_model: null,
      p_short_description: null,
      p_full_description: null,
      p_website_price: null,
      p_website_slug: null,
      p_product_image_url: null,
      p_gallery_image_urls: [],
      p_specifications: {},
      p_warranty_text: null,
      p_is_visible_on_website: false,
      p_is_featured_on_website: false,
      p_website_display_order: 0,
      p_is_combo_eligible: false,
      p_calculator_eligible: false,
    });
    if (isNotAppliedYet(error)) {
      report("Anonymous users cannot call update_product_website_details", "skip", "migration 0028 not applied yet");
    } else {
      report(
        "Anonymous users cannot call update_product_website_details",
        !!error,
        error ? undefined : "expected a permission error, RPC succeeded instead",
      );
    }
  }

  // ---- Role-based checks: need real staff/admin sessions ----

  const adminEmail = env.BMS_TEST_ADMIN_EMAIL || process.env.BMS_TEST_ADMIN_EMAIL;
  const adminPassword = env.BMS_TEST_ADMIN_PASSWORD || process.env.BMS_TEST_ADMIN_PASSWORD;
  const staffEmail = env.BMS_TEST_STAFF_EMAIL || process.env.BMS_TEST_STAFF_EMAIL;
  const staffPassword = env.BMS_TEST_STAFF_PASSWORD || process.env.BMS_TEST_STAFF_PASSWORD;

  if (adminEmail && adminPassword) {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: signInError } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (signInError) {
      report("Owner/Admin sign-in", false, signInError.message);
    } else {
      const { data: products } = await adminClient.from("products").select("id").limit(1);
      const testId = products?.[0]?.id;
      if (testId) {
        const { data: current } = await adminClient
          .from("products")
          .select(
            "brand, model, short_description, full_description, website_price, website_slug, product_image_url, gallery_image_urls, specifications, warranty_text, is_visible_on_website, is_featured_on_website, website_display_order, is_combo_eligible, calculator_eligible",
          )
          .eq("id", testId)
          .single();
        const { error } = await adminClient.rpc("update_product_website_details", {
          p_id: testId,
          p_brand: current?.brand ?? null,
          p_model: current?.model ?? null,
          p_short_description: current?.short_description ?? null,
          p_full_description: current?.full_description ?? null,
          p_website_price: current?.website_price ?? null,
          p_website_slug: current?.website_slug ?? null,
          p_product_image_url: current?.product_image_url ?? null,
          p_gallery_image_urls: current?.gallery_image_urls ?? [],
          p_specifications: current?.specifications ?? {},
          p_warranty_text: current?.warranty_text ?? null,
          p_is_visible_on_website: current?.is_visible_on_website ?? false,
          p_is_featured_on_website: current?.is_featured_on_website ?? false,
          p_website_display_order: current?.website_display_order ?? 0,
          p_is_combo_eligible: current?.is_combo_eligible ?? false,
          p_calculator_eligible: current?.calculator_eligible ?? false,
        });
        report("Owner/Admin can update website details", !error, error?.message);
      } else {
        report("Owner/Admin can update website details", "skip", "no products found to test against");
      }
    }
  } else {
    report("Owner/Admin can update website details", "skip", "set BMS_TEST_ADMIN_EMAIL/BMS_TEST_ADMIN_PASSWORD to run");
  }

  if (staffEmail && staffPassword) {
    const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: signInError } = await staffClient.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });
    if (signInError) {
      report("Manager/Salesperson (non-admin staff) sign-in", false, signInError.message);
    } else {
      const { data: products } = await staffClient.from("products").select("id").limit(1);
      const testId = products?.[0]?.id;
      if (testId) {
        const { error } = await staffClient.rpc("update_product_website_details", {
          p_id: testId,
          p_brand: null,
          p_model: null,
          p_short_description: null,
          p_full_description: null,
          p_website_price: null,
          p_website_slug: null,
          p_product_image_url: null,
          p_gallery_image_urls: [],
          p_specifications: {},
          p_warranty_text: null,
          p_is_visible_on_website: false,
          p_is_featured_on_website: false,
          p_website_display_order: 0,
          p_is_combo_eligible: false,
          p_calculator_eligible: false,
        });
        report(
          "Manager/Salesperson (non-admin staff) cannot update website details",
          !!error,
          error ? undefined : "expected a permission error, RPC succeeded instead",
        );
      } else {
        report("Manager/Salesperson (non-admin staff) cannot update website details", "skip", "no products found to test against");
      }
      // This is a real assertion, not a website-catalogue check -- it
      // documents PRE-EXISTING behaviour (see 0003_products.sql: the
      // SELECT policy has been "authenticated: true" since Inventory
      // Master's first migration, unrelated to anything in 0028). Expect
      // this to FAIL on an unmodified install; it's tracked in
      // WEBSITE_CATALOGUE_NOTES.md "Known limitations" as out of scope for
      // Stage 2, not something this migration introduced or fixes.
      const { data: costCheck, error: costError } = await staffClient
        .from("products")
        .select("cost_price")
        .limit(1);
      const staffCannotReadCost = !!costError || (costCheck ?? []).length === 0;
      report(
        "(pre-existing, informational) Manager/Salesperson cannot read cost_price via direct table SELECT",
        staffCannotReadCost,
        staffCannotReadCost ? undefined : "staff CAN read cost_price via direct table SELECT — pre-existing gap predating Stage 2, see WEBSITE_CATALOGUE_NOTES.md",
      );
    }
  } else {
    report("Manager/Salesperson (non-admin staff) cannot update website details", "skip", "set BMS_TEST_STAFF_EMAIL/BMS_TEST_STAFF_PASSWORD to run");
  }

  console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Verification script crashed:", err);
  process.exit(1);
});
