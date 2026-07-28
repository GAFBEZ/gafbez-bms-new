"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInstallationProject } from "@/lib/installationProjects";
import type { InstallationProject } from "@/types";

export interface InstallationProjectFormState {
  error: string | null;
  success?: boolean;
}

const FORM_ERROR = "Fill in at least a title and a slug.";

function parseProductsUsed(formData: FormData): string[] {
  return String(formData.get("productsUsed") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface ProjectFieldValues {
  title: string;
  websiteSlug: string;
  location: string;
  installationDate: string | null;
  systemCapacity: string;
  shortDescription: string;
  fullDescription: string;
  mainImageUrl: string;
  galleryImageUrls: string[];
  projectType: string;
  productsUsed: string[];
  customerTestimonial: string;
  testimonialAuthorName: string;
  isVisibleOnWebsite: boolean;
  isFeatured: boolean;
  displayOrder: number;
}

function rpcParams(values: ProjectFieldValues) {
  return {
    p_title: values.title,
    p_website_slug: values.websiteSlug,
    p_location: values.location,
    p_installation_date: values.installationDate,
    p_system_capacity: values.systemCapacity,
    p_short_description: values.shortDescription,
    p_full_description: values.fullDescription,
    p_main_image_url: values.mainImageUrl,
    p_gallery_image_urls: values.galleryImageUrls,
    p_project_type: values.projectType,
    p_products_used: values.productsUsed,
    p_customer_testimonial: values.customerTestimonial,
    p_testimonial_author_name: values.testimonialAuthorName,
    p_is_visible_on_website: values.isVisibleOnWebsite,
    p_is_featured: values.isFeatured,
    p_display_order: values.displayOrder,
  };
}

function fromFormData(formData: FormData): ProjectFieldValues {
  return {
    title: String(formData.get("title") ?? "").trim(),
    websiteSlug: String(formData.get("websiteSlug") ?? "").trim(),
    location: String(formData.get("location") ?? ""),
    installationDate: String(formData.get("installationDate") ?? "") || null,
    systemCapacity: String(formData.get("systemCapacity") ?? ""),
    shortDescription: String(formData.get("shortDescription") ?? ""),
    fullDescription: String(formData.get("fullDescription") ?? ""),
    mainImageUrl: String(formData.get("mainImageUrl") ?? ""),
    galleryImageUrls: [],
    projectType: String(formData.get("projectType") ?? ""),
    productsUsed: parseProductsUsed(formData),
    customerTestimonial: String(formData.get("customerTestimonial") ?? ""),
    testimonialAuthorName: String(formData.get("testimonialAuthorName") ?? ""),
    isVisibleOnWebsite: formData.get("isVisibleOnWebsite") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    displayOrder: Number(formData.get("displayOrder") ?? 0),
  };
}

function fromProject(project: InstallationProject): ProjectFieldValues {
  return {
    title: project.title,
    websiteSlug: project.websiteSlug,
    location: project.location ?? "",
    installationDate: project.installationDate,
    systemCapacity: project.systemCapacity ?? "",
    shortDescription: project.shortDescription ?? "",
    fullDescription: project.fullDescription ?? "",
    mainImageUrl: project.mainImageUrl ?? "",
    galleryImageUrls: project.galleryImageUrls,
    projectType: project.projectType ?? "",
    productsUsed: project.productsUsed,
    customerTestimonial: project.customerTestimonial ?? "",
    testimonialAuthorName: project.testimonialAuthorName ?? "",
    isVisibleOnWebsite: project.isVisibleOnWebsite,
    isFeatured: project.isFeatured,
    displayOrder: project.displayOrder,
  };
}

export async function createInstallationProject(
  _prevState: InstallationProjectFormState,
  formData: FormData,
): Promise<InstallationProjectFormState> {
  const values = fromFormData(formData);
  if (!values.title || !values.websiteSlug) return { error: FORM_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_installation_project", rpcParams(values));

  if (error) return { error: error.message };

  revalidatePath("/dashboard/installation-projects");
  // Straight to the edit page, not the list -- this form's own subtitle
  // says "Upload images after saving," which only actually works as a
  // one-step flow if landing here also lands you where the uploaders are.
  redirect(`/dashboard/installation-projects/${data.id}`);
}

export async function updateInstallationProject(
  id: string,
  _prevState: InstallationProjectFormState,
  formData: FormData,
): Promise<InstallationProjectFormState> {
  const values = fromFormData(formData);
  if (!values.title || !values.websiteSlug) return { error: FORM_ERROR };

  // Main image and gallery images are both managed by the image uploader
  // widgets (their own Server Actions below), not this form -- preserve
  // whatever is already saved rather than wiping either out on every
  // metadata save. (mainImageUrl was previously missing here, which
  // silently cleared a project's main image on its next unrelated details
  // edit -- see the update_installation_project RPC, a full-replace call
  // where an empty string here is written through as NULL.)
  const existing = await getInstallationProject(id);
  values.mainImageUrl = existing?.mainImageUrl ?? "";
  values.galleryImageUrls = existing?.galleryImageUrls ?? [];

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_installation_project", { p_id: id, ...rpcParams(values) });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/installation-projects");
  revalidatePath(`/dashboard/installation-projects/${id}`);
  redirect("/dashboard/installation-projects");
}

export async function toggleInstallationProjectStatus(
  id: string,
  field: "is_visible_on_website" | "is_featured",
  currentValue: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("installation_projects")
    .select("is_visible_on_website, is_featured")
    .eq("id", id)
    .single();

  if (!project) return;

  await supabase.rpc("set_installation_project_status", {
    p_id: id,
    p_is_visible_on_website: field === "is_visible_on_website" ? !currentValue : project.is_visible_on_website,
    p_is_featured: field === "is_featured" ? !currentValue : project.is_featured,
  });

  revalidatePath("/dashboard/installation-projects");
}

export async function updateInstallationProjectDisplayOrder(id: string, displayOrder: number): Promise<void> {
  if (displayOrder < 0) return;
  const supabase = await createClient();
  await supabase.rpc("set_installation_project_display_order", { p_id: id, p_display_order: displayOrder });
  revalidatePath("/dashboard/installation-projects");
}

export async function deleteInstallationProject(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("delete_installation_project", { p_id: id });
  revalidatePath("/dashboard/installation-projects");
}

// ---------------------------------------------------------------------
// Image save/remove/reorder -- the file bytes themselves are uploaded to
// Supabase Storage directly from the browser (see
// InstallationProjectImageUploader.tsx), NOT proxied through these
// Server Actions. A Server Action's request body goes through Vercel's
// serverless function pipeline, which hard-caps request bodies at 4.5MB
// regardless of any Next.js config -- well under this bucket's own 5MB
// per-file limit, so routing uploads through a Server Action fails on
// any real photo. These actions only ever receive a short URL string
// (or a handful of them) after the browser has already uploaded the
// file straight to Storage, so they stay tiny no matter the image size.
// ---------------------------------------------------------------------

function extractInstallationImagesPath(publicUrl: string): string | null {
  const marker = "/object/public/installation-images/";
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

async function saveProject(id: string, values: ProjectFieldValues) {
  const supabase = await createClient();
  return supabase.rpc("update_installation_project", { p_id: id, ...rpcParams(values) });
}

export async function saveInstallationMainImageUrl(
  projectId: string,
  imageUrl: string,
): Promise<InstallationProjectFormState> {
  const project = await getInstallationProject(projectId);
  if (!project) return { error: "Installation project not found." };

  const { error } = await saveProject(projectId, { ...fromProject(project), mainImageUrl: imageUrl });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/installation-projects/${projectId}`);
  return { error: null, success: true };
}

export async function removeInstallationMainImage(projectId: string): Promise<void> {
  const project = await getInstallationProject(projectId);
  if (!project) return;

  const supabase = await createClient();
  if (project.mainImageUrl) {
    const path = extractInstallationImagesPath(project.mainImageUrl);
    if (path) await supabase.storage.from("installation-images").remove([path]);
  }

  await saveProject(projectId, { ...fromProject(project), mainImageUrl: "" });
  revalidatePath(`/dashboard/installation-projects/${projectId}`);
}

export async function addInstallationGalleryImageUrls(
  projectId: string,
  imageUrls: string[],
): Promise<InstallationProjectFormState> {
  if (imageUrls.length === 0) return { error: "Choose at least one image file to upload." };

  const project = await getInstallationProject(projectId);
  if (!project) return { error: "Installation project not found." };

  const { error } = await saveProject(projectId, {
    ...fromProject(project),
    galleryImageUrls: [...project.galleryImageUrls, ...imageUrls],
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/installation-projects/${projectId}`);
  return { error: null, success: true };
}

export async function removeInstallationGalleryImage(projectId: string, imageUrl: string): Promise<void> {
  const project = await getInstallationProject(projectId);
  if (!project) return;

  const supabase = await createClient();
  const path = extractInstallationImagesPath(imageUrl);
  if (path) await supabase.storage.from("installation-images").remove([path]);

  await saveProject(projectId, {
    ...fromProject(project),
    galleryImageUrls: project.galleryImageUrls.filter((url) => url !== imageUrl),
  });
  revalidatePath(`/dashboard/installation-projects/${projectId}`);
}

/** Swaps a gallery image with its neighbour in the given direction --
 * simple, fully keyboard-accessible reordering (two buttons per image)
 * rather than drag-and-drop, which would need a lot more machinery to be
 * keyboard-operable at all. */
export async function moveInstallationGalleryImage(
  projectId: string,
  imageUrl: string,
  direction: "up" | "down",
): Promise<void> {
  const project = await getInstallationProject(projectId);
  if (!project) return;

  const urls = [...project.galleryImageUrls];
  const index = urls.indexOf(imageUrl);
  if (index === -1) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= urls.length) return;

  [urls[index], urls[swapWith]] = [urls[swapWith], urls[index]];

  await saveProject(projectId, { ...fromProject(project), galleryImageUrls: urls });
  revalidatePath(`/dashboard/installation-projects/${projectId}`);
}
