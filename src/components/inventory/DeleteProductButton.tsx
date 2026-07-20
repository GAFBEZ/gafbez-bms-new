"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProduct } from "@/app/dashboard/inventory/actions";

interface DeleteProductButtonProps {
  id: string;
  productName: string;
}

export function DeleteProductButton({
  id,
  productName,
}: DeleteProductButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        `Delete "${productName}"? This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(() => {
      deleteProduct(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Delete ${productName}`}
      className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
