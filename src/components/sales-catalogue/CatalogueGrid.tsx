"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types";

interface CatalogueGridProps {
  products: Omit<Product, "costPrice" | "supplier">[];
}

function stockStatus(product: Omit<Product, "costPrice" | "supplier">): { label: string; className: string } {
  if (product.quantityInStock === 0) {
    return { label: "Out of stock", className: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" };
  }
  if (product.quantityInStock <= product.reorderLevel) {
    return { label: "Low stock", className: "bg-brand-gold-soft text-brand-gold dark:text-amber-400" };
  }
  return { label: "In stock", className: "bg-brand-green-soft text-brand-green dark:text-emerald-400" };
}

export function CatalogueGrid({ products }: CatalogueGridProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q);
      const matchesCategory = category === "all" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);

  if (products.length === 0) {
    return (
      <EmptyState
        title="No products to show"
        description="Add active products in Inventory Master to see them here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <label htmlFor="catalogue-search" className="sr-only">
            Search catalogue
          </label>
          <input
            id="catalogue-search"
            type="search"
            placeholder="Search by name or SKU…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>

        <label htmlFor="catalogue-category-filter" className="sr-only">
          Filter by category
        </label>
        <select
          id="catalogue-category-filter"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching products"
          description="Try a different search term or category."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const status = stockStatus(product);
            return (
              <div
                key={product.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green-soft text-brand-green dark:text-emerald-400"
                    aria-hidden="true"
                  >
                    <Package className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {product.sku} &middot; {product.category}
                  </p>
                </div>

                <div className="mt-auto">
                  <p className="text-xl font-semibold tracking-tight text-brand-green dark:text-emerald-400">
                    {formatCurrency(product.sellingPrice)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {product.quantityInStock} {product.unit} available
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
