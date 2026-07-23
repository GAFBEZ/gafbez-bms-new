import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export type BranchStatus = "active" | "coming-soon";

export interface Branch {
  id: string;
  name: string;
  status: BranchStatus;
}

export type DashboardMetricKey =
  | "totalProducts"
  | "unitsInStock"
  | "inventoryValue"
  | "expectedRevenue"
  | "grossProfit"
  | "netProfit"
  | "todaySales"
  | "outstandingBalance";

export interface DashboardMetric {
  key: DashboardMetricKey;
  label: string;
  value: string;
  helperText: string;
  icon: LucideIcon;
  /** Hex accent color for the card's icon badge — from the validated dashboard palette. */
  accent: string;
  /** True when `value` is computed from live data rather than demo data. */
  isLive?: boolean;
}

export interface BranchSalesRow {
  branch: string;
  amount: string;
  share: number;
}

export interface RecentSaleRow {
  id: string;
  customer: string;
  branch: string;
  amount: string;
  date: string;
}

export type StockMovementType = "in" | "out";

export interface StockMovementRow {
  id: string;
  product: string;
  type: StockMovementType;
  quantity: string;
  date: string;
}

export interface LowStockRow {
  id: string;
  product: string;
  remaining: number;
  threshold: number;
}

export type NotificationType = "info" | "warning" | "success";

export interface NotificationRow {
  id: string;
  message: string;
  time: string;
  type: NotificationType;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantityInStock: number;
  reorderLevel: number;
  supplier: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  branchId: string;
  branchName: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
  recordedBy: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  branchId: string | null;
  outstandingBalance: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaleStatus = "paid" | "partial" | "unpaid";

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  customerId: string | null;
  customerName: string | null;
  branchId: string;
  branchName: string;
  totalAmount: number;
  amountPaid: number;
  status: SaleStatus;
  createdAt: string;
  itemCount: number;
  recordedBy: string | null;
}

export interface SaleDetailItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  quantityReturned: number;
}

export interface SaleDetail {
  id: string;
  customerId: string | null;
  customerName: string | null;
  branchId: string;
  branchName: string;
  totalAmount: number;
  amountPaid: number;
  status: SaleStatus;
  createdAt: string;
  items: SaleDetailItem[];
}

export interface BranchSalesSummary {
  branchId: string;
  branchName: string;
  total: number;
}

export interface StaffSalesSummary {
  staffId: string | null;
  staffName: string;
  total: number;
  transactionCount: number;
}

export interface TopProductSummary {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export interface ExpenseCategorySummary {
  category: string;
  total: number;
}

export interface SalesTrendPoint {
  date: string;
  total: number;
}

export interface SalesSummary {
  totalSales: number;
  transactionCount: number;
  averageSale: number;
  totalCogs: number;
  grossProfit: number;
}

export interface Expense {
  id: string;
  branchId: string;
  branchName: string;
  category: string;
  description: string | null;
  amount: number;
  expenseDate: string;
  createdAt: string;
  recordedBy: string | null;
}

export interface Installation {
  id: string;
  branchId: string;
  branchName: string;
  installationDate: string;
  totalCharged: number;
  inverterProductId: string | null;
  inverterProductName: string | null;
  inverterPrice: number;
  inverterQty: number;
  solarPanelProductId: string | null;
  solarPanelProductName: string | null;
  solarPanelPrice: number;
  solarPanelQty: number;
  batteryProductId: string | null;
  batteryProductName: string | null;
  batteryPrice: number;
  batteryQty: number;
  cableAmount: number;
  accessoriesAmount: number;
  installationAmount: number;
  costTotal: number;
  profit: number;
  createdAt: string;
  recordedBy: string | null;
}

export interface InstallationSummary {
  count: number;
  totalCharged: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPct: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  storagePath: string;
  branchId: string | null;
  branchName: string | null;
  category: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  createdAt: string;
}

export type StaffRole = "admin" | "staff";

export interface StaffMember {
  id: string;
  email: string | null;
  fullName: string | null;
  role: StaffRole;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
}
