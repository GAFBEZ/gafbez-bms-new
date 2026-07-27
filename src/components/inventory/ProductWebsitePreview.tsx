import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types";

interface ProductWebsitePreviewProps {
  product: Product;
}

/**
 * Owner/Admin-only preview of how a product would look on the public
 * website, using nothing but data already in this page's Product object --
 * no call to the public site, no public shop exists yet (Stage 2 is BMS
 * only). Deliberately excludes cost price, selling price, supplier, and
 * reorder level -- the same fields the website itself will never see.
 */
export function ProductWebsitePreview({ product }: ProductWebsitePreviewProps) {
  const { website } = product;
  const isInStock = product.quantityInStock > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row">
      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        {website.productImageUrl ? (
          <Image
            src={website.productImageUrl}
            alt={product.name}
            width={112}
            height={112}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {product.name}
          </h3>
          {website.isFeaturedOnWebsite && (
            <span className="rounded-full bg-brand-gold-soft px-2 py-0.5 text-[11px] font-medium text-brand-gold">
              Featured
            </span>
          )}
          <span
            className={
              website.isVisibleOnWebsite
                ? "rounded-full bg-brand-green-soft px-2 py-0.5 text-[11px] font-medium text-brand-green dark:text-emerald-400"
                : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }
          >
            {website.isVisibleOnWebsite ? "Visible on website" : "Hidden from website"}
          </span>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {[website.brand, website.model, product.category].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {website.websitePrice !== null ? formatCurrency(website.websitePrice) : "No website price set"}
          </span>
          <span
            className={
              isInStock
                ? "text-brand-green dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {isInStock ? "In stock" : "Out of stock"}
          </span>
        </div>

        {website.shortDescription && (
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {website.shortDescription}
          </p>
        )}
      </div>
    </div>
  );
}
