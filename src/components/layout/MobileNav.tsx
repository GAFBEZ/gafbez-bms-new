"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { NavList } from "@/components/layout/NavList";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  logoUrl: string | null;
}

export function MobileNav({ open, onClose, isAdmin, logoUrl }: MobileNavProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation overlay"
        className="absolute inset-0 bg-gray-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className="relative flex h-full w-72 max-w-[80%] flex-col bg-brand-green shadow-xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Logo variant="light" logoUrl={logoUrl} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList onNavigate={onClose} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
