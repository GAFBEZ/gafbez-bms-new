"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/navigation";

interface NavListProps {
  onNavigate?: () => void;
  isAdmin: boolean;
}

export function NavList({ onNavigate, isAdmin }: NavListProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {visibleItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-brand-gold bg-white/10 text-white"
                : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
