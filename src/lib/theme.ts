import { cookies } from "next/headers";

export const THEME_COOKIE = "theme";
export type ThemePreference = "light" | "dark" | "system";

export async function getThemePreference(): Promise<ThemePreference> {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE)?.value;
  return value === "light" || value === "dark" ? value : "system";
}
