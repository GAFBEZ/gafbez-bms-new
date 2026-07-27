import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Visible to Owner/Admin, any branch Manager, or an Owner-approved
   * salesperson (can_manage_installations) -- the same "Owner and Manager
   * unless an existing role rule explicitly permits it" convention as
   * public.can_manage_installation_projects() (Stage 8). Distinct from
   * adminOnly, which hides from every non-admin including Managers. */
  managerOrAdmin?: boolean;
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
  /** Website Catalogue fields (Stage 2). Owner/Admin only, both to read
   * (cost/margin stay out of this object entirely) and to edit. */
  website: ProductWebsiteDetails;
}

/** A single row in the Specification Editor (Inventory Master's Website
 * Details tab). Serialized to/from products.specifications (a JSON object
 * of key -> value) at the form boundary -- see SpecificationEditor. */
export interface ProductSpecification {
  key: string;
  value: string;
}

/** One image in a product's website gallery. products.gallery_image_urls
 * stores these as a plain JSON array of URL strings; this shape exists so
 * the gallery UI has a stable identity per image (the url itself) without
 * assuming anything about the storage path that produced it. */
export interface ProductGalleryImage {
  url: string;
}

/** Everything on `products` that only the public website (and the
 * Inventory Master "Website Details" tab) cares about -- never includes
 * costPrice, sellingPrice, reorderLevel, supplier, or quantityInStock.
 * Owner/Admin only to write, via update_product_website_details(). */
export interface ProductWebsiteDetails {
  brand: string | null;
  model: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  websitePrice: number | null;
  websiteSlug: string | null;
  productImageUrl: string | null;
  galleryImageUrls: string[];
  specifications: Record<string, string>;
  warrantyText: string | null;
  isVisibleOnWebsite: boolean;
  isFeaturedOnWebsite: boolean;
  websiteDisplayOrder: number;
  isComboEligible: boolean;
  calculatorEligible: boolean;
}

export type StockStatus = "in_stock" | "out_of_stock";

/** Shape of a row from the public.website_catalogue view -- the safe,
 * company-wide public product feed (no branch, no cost/margin/supplier).
 * Not consumed by the BMS UI yet (Stage 2 has no public shop), defined here
 * as the shared contract the future public-site integration will use. */
export interface WebsiteCatalogueProduct {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  unit: string;
  shortDescription: string | null;
  fullDescription: string | null;
  websitePrice: number | null;
  websiteSlug: string | null;
  productImageUrl: string | null;
  galleryImageUrls: string[];
  specifications: Record<string, string>;
  warrantyText: string | null;
  isFeaturedOnWebsite: boolean;
  websiteDisplayOrder: number;
  isComboEligible: boolean;
  calculatorEligible: boolean;
  totalStockQuantity: number;
  stockStatus: StockStatus;
}

/** Shape of a row from get_website_catalogue_by_branch() -- same public
 * fields as WebsiteCatalogueProduct, plus one branch's own stock instead of
 * the company-wide total. */
export interface BranchCatalogueProduct
  extends Omit<WebsiteCatalogueProduct, "totalStockQuantity" | "stockStatus"> {
  branchId: string;
  branchName: string;
  branchQuantity: number;
  branchStockStatus: StockStatus;
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
  customerName: string | null;
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
  isBranchManager: boolean;
  canManageInstallations: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------
// Combo packages, installations, refunds & store credit (Stage 6)
// ---------------------------------------------------------------------

export type ComboComponentType = "inverter" | "battery" | "solar_panel" | "accessory" | "installation_service" | "other";

export interface ComboPackageComponent {
  id: string;
  productId: string | null;
  productName: string | null;
  quantity: number;
  componentType: ComboComponentType;
  isRequired: boolean;
  displayName: string;
  displayOrder: number;
}

export interface ComboPackage {
  id: string;
  packageCode: string;
  name: string;
  websiteSlug: string;
  shortDescription: string | null;
  fullDescription: string | null;
  mainImageUrl: string | null;
  galleryImageUrls: string[];
  finalPrice: number;
  systemCapacityText: string | null;
  capacityRank: number;
  appliancesSupported: string[];
  installationScope: string | null;
  warrantyText: string | null;
  inspectionRequired: boolean;
  isActive: boolean;
  isVisibleOnWebsite: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  components: ComboPackageComponent[];
}

export type InstallationStatus =
  | "site_inspection_required"
  | "inspection_scheduled"
  | "inspection_completed"
  | "package_suitable"
  | "package_unsuitable"
  | "awaiting_customer_decision"
  | "installation_scheduled"
  | "installation_in_progress"
  | "installation_completed"
  | "cancelled"
  | "refunded";

export interface InstallationJob {
  id: string;
  orderId: string;
  orderNumber: string;
  comboPackageId: string;
  packageName: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  branchId: string;
  branchName: string | null;
  status: InstallationStatus;
  inspectionRequired: boolean;
  inspectionScheduledAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionResult: "suitable" | "unsuitable" | null;
  inspectionNotes: string | null;
  recommendedPackageId: string | null;
  installationScheduledAt: string | null;
  installationStartedAt: string | null;
  installationCompletedAt: string | null;
  assignedStaffId: string | null;
  customerAddress: string | null;
  createdAt: string;
}

export type RefundRequestType = "full_refund" | "store_credit_conversion" | "paid_order_cancellation" | "package_unsuitable";
export type RefundRequestStatus = "pending" | "manager_approved" | "owner_approved" | "rejected" | "processing" | "completed" | "failed";

export interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  customerId: string;
  customerName: string;
  requestType: RefundRequestType;
  reason: string | null;
  requestedAmount: number;
  status: RefundRequestStatus;
  requestedAt: string;
  rejectionReason: string | null;
  paystackRefundReference: string | null;
  completedAt: string | null;
}

export interface StoreCreditAccountSummary {
  customerId: string;
  customerName: string | null;
  balance: number;
}

export type StoreCreditTransactionType = "credit" | "debit" | "adjustment" | "refund_conversion" | "order_payment" | "reversal";

export interface StoreCreditLedgerEntry {
  id: string;
  customerId: string;
  customerName: string | null;
  transactionType: StoreCreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

/** Shape of a row from public.installation_projects (Stage 8) -- the
 * public marketing gallery. Distinct from the unrelated `Installation`
 * (internal cost/profit record, 0025) and `InstallationJob` (per-order
 * site-inspection workflow, 0031) types above. */
export interface InstallationProject {
  id: string;
  title: string;
  websiteSlug: string;
  location: string | null;
  installationDate: string | null;
  systemCapacity: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  mainImageUrl: string | null;
  galleryImageUrls: string[];
  projectType: string | null;
  productsUsed: string[];
  customerTestimonial: string | null;
  testimonialAuthorName: string | null;
  isFeatured: boolean;
  isVisibleOnWebsite: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
