import { createClient } from "@/lib/supabase/server";
import type { Branch, BranchStatus } from "@/types";

const ALL_BRANCHES_OPTION: Branch = {
  id: "all",
  name: "All Branches",
  status: "active",
};

/**
 * Used if Supabase isn't reachable yet (env vars missing, migration not run,
 * network issue). Keeps the UI functional during setup instead of breaking.
 */
const FALLBACK_BRANCHES: Branch[] = [
  ALL_BRANCHES_OPTION,
  { id: "abuja", name: "GAFBEZ Energies Abuja Branch", status: "active" },
  { id: "minna", name: "GAFBEZ Energies Minna Branch", status: "active" },
  { id: "ilorin", name: "GAFBEZ Energies Ilorin Branch", status: "coming-soon" },
];

interface BranchRow {
  id: string;
  name: string;
  status: "active" | "coming_soon";
}

/**
 * Fetches branches from Supabase (Server Components only) and prepends the
 * UI-only "All Branches" option. Falls back to static data if the table
 * isn't set up yet, so the dashboard shell never breaks during setup.
 */
export async function getBranches(): Promise<Branch[]> {
  // Note: createClient() calls next/headers cookies(), which Next.js uses to
  // detect dynamic routes during the build's static-generation pass. Don't
  // wrap this call in try/catch — that would swallow Next's internal
  // dynamic-usage signal instead of letting it correctly mark the route.
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("branches")
    .select("id, name, status")
    .order("name");

  if (error || !data) {
    if (error) console.warn("Falling back to static branches:", error.message);
    return FALLBACK_BRANCHES;
  }

  const mapStatus = (status: BranchRow["status"]): BranchStatus =>
    status === "coming_soon" ? "coming-soon" : "active";

  return [
    ALL_BRANCHES_OPTION,
    ...(data as BranchRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      status: mapStatus(row.status),
    })),
  ];
}

export async function getBranch(id: string): Promise<Branch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const row = data as BranchRow;
  return {
    id: row.id,
    name: row.name,
    status: row.status === "coming_soon" ? "coming-soon" : "active",
  };
}
