import { PageHeader } from "@/components/ui/PageHeader";
import { UploadDocumentForm } from "@/components/documents/UploadDocumentForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { getDocuments } from "@/lib/documents";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function DocumentsPage() {
  const activeBranchId = await getActiveBranchId();
  const [documents, branches, user] = await Promise.all([
    getDocuments(activeBranchId),
    getBranches(),
    getCurrentUser(),
  ]);

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Store and organise receipts, invoices, and business documents."
            : `Showing documents for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
      />
      <UploadDocumentForm branches={operationalBranches} />
      <DocumentList documents={documents} canDelete={isAdmin} />
    </div>
  );
}
