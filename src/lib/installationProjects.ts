import { createClient } from "@/lib/supabase/server";
import type { InstallationProject } from "@/types";

interface InstallationProjectRow {
  id: string;
  title: string;
  website_slug: string;
  location: string | null;
  installation_date: string | null;
  system_capacity: string | null;
  short_description: string | null;
  full_description: string | null;
  main_image_url: string | null;
  gallery_image_urls: string[] | null;
  project_type: string | null;
  products_used: string[] | null;
  customer_testimonial: string | null;
  testimonial_author_name: string | null;
  is_featured: boolean;
  is_visible_on_website: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS = `
  id, title, website_slug, location, installation_date, system_capacity, short_description,
  full_description, main_image_url, gallery_image_urls, project_type, products_used,
  customer_testimonial, testimonial_author_name, is_featured, is_visible_on_website,
  display_order, created_at, updated_at
`;

function mapRow(row: InstallationProjectRow): InstallationProject {
  return {
    id: row.id,
    title: row.title,
    websiteSlug: row.website_slug,
    location: row.location,
    installationDate: row.installation_date,
    systemCapacity: row.system_capacity,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    mainImageUrl: row.main_image_url,
    galleryImageUrls: row.gallery_image_urls ?? [],
    projectType: row.project_type,
    productsUsed: row.products_used ?? [],
    customerTestimonial: row.customer_testimonial,
    testimonialAuthorName: row.testimonial_author_name,
    isFeatured: row.is_featured,
    isVisibleOnWebsite: row.is_visible_on_website,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Readable by any authenticated staff member -- see installation_projects'
 * "Staff can read all installation projects" RLS policy
 * (0033_installation_projects.sql). Only the create/update/delete/status
 * RPCs (all can_manage_installation_projects()-gated: Owner, any branch
 * Manager, or an Owner-approved salesperson) can ever write. */
export async function getInstallationProjects(): Promise<InstallationProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installation_projects")
    .select(SELECT_COLUMNS)
    .order("display_order", { ascending: true });

  if (error || !data) {
    console.warn("Failed to load installation projects:", error?.message);
    return [];
  }

  return (data as unknown as InstallationProjectRow[]).map(mapRow);
}

export async function getInstallationProject(id: string): Promise<InstallationProject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("installation_projects").select(SELECT_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  return mapRow(data as unknown as InstallationProjectRow);
}
