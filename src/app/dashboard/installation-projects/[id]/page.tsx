import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import InstallationProjectForm from "@/components/installationProjects/InstallationProjectForm";
import { InstallationMainImageUploader, InstallationGalleryUploader } from "@/components/installationProjects/InstallationProjectImageUploader";
import { updateInstallationProject } from "../actions";
import { getInstallationProject } from "@/lib/installationProjects";
import { getCurrentUser } from "@/lib/auth";

interface EditInstallationProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInstallationProjectPage({ params }: EditInstallationProjectPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canEdit = user?.role === "admin" || Boolean(user?.isBranchManager) || Boolean(user?.canManageInstallations);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Installation Project" />
        <EmptyState title="Owner/Manager only" description="Only the Owner or a branch Manager can edit installation projects." />
      </div>
    );
  }

  const project = await getInstallationProject(id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${project.title}`}
        description="Owner/Manager: project details, images, and visibility."
        actions={
          project.isVisibleOnWebsite ? (
            <Link
              href={`/installations/${project.websiteSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Preview on website
            </Link>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Main Image</h2>
        <InstallationMainImageUploader projectId={project.id} imageUrl={project.mainImageUrl} />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Gallery Images</h2>
        <InstallationGalleryUploader projectId={project.id} imageUrls={project.galleryImageUrls} />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Project Details</h2>
        <InstallationProjectForm action={updateInstallationProject.bind(null, id)} initialValues={project} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
