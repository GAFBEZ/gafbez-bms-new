import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  BookOpenText,
  Receipt,
  LineChart,
  Users,
  Wallet,
  FileText,
  Bell,
  UserCog,
  Wrench,
  Settings,
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
  { label: "Sales Tracker", href: "/dashboard/sales-tracker", icon: LineChart },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Expenses", href: "/dashboard/expenses", icon: Wallet },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  {
    label: "Staff Management",
    href: "/dashboard/staff-management",
    icon: UserCog,
    adminOnly: true,
  },
  { label: "Installation", href: "/dashboard/installations", icon: Wrench },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
