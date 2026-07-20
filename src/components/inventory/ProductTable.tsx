"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";
import { DeleteProductButton } from "@/components/inventory/DeleteProductButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types";

interface ProductTableProps {
  products: Product[];
  canDelete: boolean;
}

export function ProductTable({ products, canDelete }: ProductTableProps) {
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
        title="No products yet"
        description="Add your first product to start building the inventory catalog."
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
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            type="search"
            placeholder="Search by name or SKU…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>

        <label htmlFor="category-filter" className="sr-only">
          Filter by category
        </label>
        <select
          id="category-filter"
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
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Supplier
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Cost Price
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Selling Price
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Profit Margin
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Stock
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Reorder Level
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((product) => {
                const isLowStock = product.quantityInStock <= product.reorderLevel;
                const marginAmount = product.sellingPrice - product.costPrice;
                const marginPercent =
                  product.sellingPrice > 0 ? (marginAmount / product.sellingPrice) * 100 : null;
                return (
                  <tr key={product.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{product.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{product.category}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {product.supplier ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatCurrency(product.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatCurrency(product.sellingPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          marginPercent !== null && marginPercent < 0
                            ? "font-medium text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        {marginPercent !== null ? (
                          <>
                            {formatCurrency(marginAmount)}{" "}
                            <span className="text-xs">({marginPercent.toFixed(0)}%)</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isLowStock
                            ? "rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        {product.quantityInStock} {product.unit}
                        {isLowStock ? " · Low" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {product.reorderLevel} {product.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.isActive
                            ? "rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green dark:text-emerald-400"
                            : "rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400"
                        }
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/inventory/${product.id}/edit`}
                          aria-label={`Edit ${product.name}`}
                          className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {canDelete && (
                          <DeleteProductButton id={product.id} productName={product.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
