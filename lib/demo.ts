// Name of the cookie that flags demo mode for a global admin. Demo mode swaps
// live pages for a fictional, in-memory preview (see components/demo/*).
import { cookies } from "next/headers";

export const DEMO_COOKIE = "beacon_demo";

/**
 * Demo mode is a global-admin-only cookie. Honored only for admins, so the flag
 * can never expose demo content to a real user. Call from a server component /
 * server action to decide whether to render the fictional preview.
 */
export async function isDemoOn(role: string): Promise<boolean> {
  if (role !== "admin") return false;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}
