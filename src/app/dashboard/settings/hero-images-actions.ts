"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getHeroImages } from "@/lib/heroImages";

export interface HeroImageFormState {
  error: string | null;
  success?: boolean;
}

// The file itself is uploaded to Supabase Storage directly from the
// browser (see HeroImagesManager.tsx), not proxied through a Server
// Action -- same reasoning as installation project/product image
// uploads: Vercel hard-caps a Server Action's request body at 4.5MB
// regardless of Next.js config, well under this bucket's 5MB per-file
// limit. This action only ever receives the resulting URL string.

export async function saveHeroImage(imageUrl: string): Promise<HeroImageFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_hero_image", { p_image_url: imageUrl });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

function extractHeroImagesPath(publicUrl: string): string | null {
  const marker = "/object/public/hero-images/";
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export async function removeHeroImage(id: string, imageUrl: string): Promise<void> {
  const supabase = await createClient();

  const path = extractHeroImagesPath(imageUrl);
  if (path) await supabase.storage.from("hero-images").remove([path]);

  await supabase.rpc("delete_hero_image", { p_id: id });

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
}

/** Swaps a hero image with its neighbour in the given direction -- same
 * simple, keyboard-accessible two-button reordering as the installation
 * project gallery, adapted to real rows + a display_order column instead
 * of a JSON array. */
export async function moveHeroImage(id: string, direction: "up" | "down"): Promise<void> {
  const images = await getHeroImages();
  const index = images.findIndex((image) => image.id === id);
  if (index === -1) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= images.length) return;

  const current = images[index];
  const neighbour = images[swapWith];

  const supabase = await createClient();
  await supabase.rpc("set_hero_image_display_order", { p_id: current.id, p_display_order: neighbour.displayOrder });
  await supabase.rpc("set_hero_image_display_order", { p_id: neighbour.id, p_display_order: current.displayOrder });

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
}
