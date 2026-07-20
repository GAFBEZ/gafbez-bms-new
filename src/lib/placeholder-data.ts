import {
  Banknote,
  CircleDollarSign,
  Layers,
  Package,
  PiggyBank,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DASHBOARD_PALETTE } from "@/lib/palette";
import type {
  BranchSalesRow,
  DashboardMetric,
  LowStockRow,
  NotificationRow,
  RecentSaleRow,
  StockMovementRow,
} from "@/types";

/**
 * Fallback/demo values. Five of these eight metrics are overridden with
 * live figures computed from the `products` table on the dashboard page
 * (see src/lib/dashboard.ts) — the other three (netProfit, todaySales,
 * outstandingBalance) stay static until sales/expenses modules exist.
 */

export const dashboardMetrics: DashboardMetric[] = [
  {
    key: "totalProducts",
    label: "Total Products",
    value: "1,248",
    helperText: "Active products in catalog",
    icon: Package,
    accent: DASHBOARD_PALETTE.tealDark,
  },
  {
    key: "unitsInStock",
    label: "Total Units in Stock",
    value: "38,940",
    helperText: "Units currently available",
    icon: Layers,
    accent: DASHBOARD_PALETTE.orange,
  },
  {
    key: "inventoryValue",
    label: "Total Inventory Value",
    value: "₦412,600,000",
    helperText: "At cost price",
    icon: Wallet,
    accent: DASHBOARD_PALETTE.blue,
  },
  {
    key: "expectedRevenue",
    label: "Expected Inventory Revenue",
    value: "₦589,300,000",
    helperText: "At selling price",
    icon: TrendingUp,
    accent: DASHBOARD_PALETTE.red,
  },
  {
    key: "grossProfit",
    label: "Estimated Gross Profit",
    value: "₦176,700,000",
    helperText: "Revenue minus cost",
    icon: PiggyBank,
    accent: DASHBOARD_PALETTE.magentaDark,
  },
  {
    key: "netProfit",
    label: "Net Profit",
    value: "₦98,450,000",
    helperText: "After expenses",
    icon: Banknote,
    accent: DASHBOARD_PALETTE.amberDark,
  },
  {
    key: "todaySales",
    label: "Today's Sales",
    value: "₦3,215,000",
    helperText: "Across all branches",
    icon: ShoppingCart,
    accent: DASHBOARD_PALETTE.violet,
  },
  {
    key: "outstandingBalance",
    label: "Outstanding Customer Balance",
    value: "₦12,830,000",
    helperText: "Unpaid customer invoices",
    icon: CircleDollarSign,
    accent: DASHBOARD_PALETTE.green,
  },
];

export const branchSales: BranchSalesRow[] = [
  { branch: "Abuja Branch", amount: "₦1,540,000", share: 48 },
  { branch: "Minna Branch", amount: "₦980,000", share: 30 },
  { branch: "Ilorin Branch", amount: "₦695,000", share: 22 },
];

export const recentSales: RecentSaleRow[] = [
  {
    id: "SL-10231",
    customer: "Bala Solar Distributors",
    branch: "Abuja",
    amount: "₦452,000",
    date: "14 Jul 2026",
  },
  {
    id: "SL-10230",
    customer: "Chika Renewable Supplies",
    branch: "Minna",
    amount: "₦188,500",
    date: "14 Jul 2026",
  },
  {
    id: "SL-10229",
    customer: "Femi Power Solutions",
    branch: "Abuja",
    amount: "₦960,000",
    date: "13 Jul 2026",
  },
  {
    id: "SL-10228",
    customer: "Grace Energy Hub",
    branch: "Ilorin",
    amount: "₦275,000",
    date: "13 Jul 2026",
  },
];

export const recentStockMovements: StockMovementRow[] = [
  {
    id: "SM-5021",
    product: "150W Monocrystalline Solar Panel",
    type: "in",
    quantity: "+120 units",
    date: "14 Jul 2026",
  },
  {
    id: "SM-5020",
    product: "200Ah Lithium Battery",
    type: "out",
    quantity: "-18 units",
    date: "14 Jul 2026",
  },
  {
    id: "SM-5019",
    product: "5kVA Hybrid Inverter",
    type: "out",
    quantity: "-6 units",
    date: "13 Jul 2026",
  },
  {
    id: "SM-5018",
    product: "MC4 Connector Pair",
    type: "in",
    quantity: "+500 units",
    date: "12 Jul 2026",
  },
];

export const lowStockProducts: LowStockRow[] = [
  { id: "PRD-118", product: "5kVA Hybrid Inverter", remaining: 4, threshold: 10 },
  { id: "PRD-204", product: "200Ah Lithium Battery", remaining: 7, threshold: 15 },
  { id: "PRD-311", product: "60A MPPT Charge Controller", remaining: 3, threshold: 12 },
];

export const recentNotifications: NotificationRow[] = [
  {
    id: "NT-901",
    message: "Low stock alert: 5kVA Hybrid Inverter at Abuja Branch",
    time: "2 hours ago",
    type: "warning",
  },
  {
    id: "NT-900",
    message: "Daily sales report submitted for Minna Branch",
    time: "5 hours ago",
    type: "success",
  },
  {
    id: "NT-899",
    message: "New customer added: Femi Power Solutions",
    time: "Yesterday",
    type: "info",
  },
];
