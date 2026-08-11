"use client";

import type { ReactNode } from "react";

interface TabButtonProps {
  id: string;
  isActive: boolean;
  ariaControls: string;
  onClick: () => void;
  children: ReactNode;
}

/** Solid pill-button tab style -- same visual weight as this app's
 * primary action buttons (Add Customer, Record Sale, etc.) rather than
 * a subtle underline, so the active tab is unmistakable at a glance.
 * Shared by every tabbed dashboard page (Customers, Daily Sales, Sales
 * Catalogue, Installation Jobs, Refund Requests). */
export function TabButton({ id, isActive, ariaControls, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={isActive}
      aria-controls={ariaControls}
      onClick={onClick}
      className={
        isActive
          ? "rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white shadow-sm"
          : "rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }
    >
      {children}
    </button>
  );
}
