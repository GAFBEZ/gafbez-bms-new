import { PageHeader } from "@/components/ui/PageHeader";
import { WebsiteCustomerTable } from "@/components/websiteCustomers/WebsiteCustomerTable";
import { getWebsiteCustomers } from "@/lib/websiteCustomers";

/** Staff-wide (no role gate), matching src/app/dashboard/customers/page.tsx's
 * access level -- see 0043_website_customers_staff_read.sql. Read-only:
 * customer_profiles has no staff-writable columns, so unlike the
 * unrelated "Customers" page (public.customers, a completely separate
 * staff-entered table) there is no Add/Edit/Delete here. */
export default async function WebsiteCustomersPage() {
  const customers = await getWebsiteCustomers();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Website Customers"
        description="Everyone who has registered an account on the website. Distinct from Customers, which is your own staff-entered contact list."
      />
      <WebsiteCustomerTable customers={customers} />
    </div>
  );
}
