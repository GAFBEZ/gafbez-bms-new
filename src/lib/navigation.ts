import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  BookOpenText,
  Receipt,
  Users,
  Wallet,
  FileText,
  UserCog,
  Settings,
  ClipboardCheck,
  Undo2,
  Images,
  HardHat,
} from "lucide-react";
import type { NavItem } from "@/types";

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventory Master", href: "/dashboard/inventory", icon: Boxes, adminOnly: true },
  {
    label: "Stock Movement",
    href: "/dashboard/stock-movement",
    icon: ArrowLeftRight,
  },
  {
    label: "Sales Catalogue",
    href: "/dashboard/sales-catalogue",
    icon: BookOpenText,
  },
  { label: "Daily Sales", href: "/dashboard/daily-sales", icon: Receipt },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Expenses", href: "/dashboard/expenses", icon: Wallet },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  {
    label: "Staff Management",
    href: "/dashboard/staff-management",
    icon: UserCog,
    adminOnly: true,
  },
  {
    label: "Installation Jobs",
    href: "/dashboard/installation-jobs",
    icon: ClipboardCheck,
  },
  {
    label: "Refund Requests",
    href: "/dashboard/refunds",
    icon: Undo2,
  },
  {
    label: "Installation Projects",
    href: "/dashboard/installation-projects",
    icon: Images,
    managerOrAdmin: true,
  },
  {
    label: "Installer Applications",
    href: "/dashboard/installer-applications",
    icon: HardHat,
    installerReviewAccess: true,
  },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
