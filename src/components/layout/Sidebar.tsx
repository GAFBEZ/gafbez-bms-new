import { Logo } from "@/components/layout/Logo";
import { NavList } from "@/components/layout/NavList";

interface SidebarProps {
  isAdmin: boolean;
  logoUrl: string | null;
  businessName: string;
}

export function Sidebar({ isAdmin, logoUrl, businessName }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-green lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo variant="light" logoUrl={logoUrl} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavList isAdmin={isAdmin} />
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-snug text-white/50">
        {businessName}
        <br />
        Business Management System
      </div>
    </aside>
  );
}
