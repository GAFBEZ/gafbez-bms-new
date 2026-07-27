import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductEditTabs } from "@/components/inventory/ProductEditTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { updateProduct } from "@/app/dashboard/inventory/actions";
import { getProduct } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Product" description="Update a product record." />
        <EmptyState
          title="Admins only"
          description="Editing products is restricted to admin accounts."
        />
      </div>
    );
  }

  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const updateProductWithId = updateProduct.bind(null, product.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Product"
        description={`Update details for ${product.name}.`}
      />
      <ProductEditTabs product={product} updateAction={updateProductWithId} />
    </div>
  );
}
