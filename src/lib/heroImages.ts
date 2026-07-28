import { createClient } from "@/lib/supabase/server";

export interface HeroImage {
  id: string;
  imageUrl: string;
  displayOrder: number;
}

export async function getHeroImages(): Promise<HeroImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_images")
    .select("id, image_url, display_order")
    .order("display_order", { ascending: true });

  if (error || !data) {
    if (error) console.warn("Falling back to no hero images:", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
  }));
}
