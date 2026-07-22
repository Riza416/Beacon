"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/actions/utils";
import { DEMO_COOKIE } from "@/lib/demo";

/**
 * Turn demo mode on/off for the current global admin. Demo mode is a per-admin
 * cookie that makes the dashboard render a fictional preview instead of live
 * data. Only global admins may set it (adminAction throws otherwise), and it
 * changes nothing in the database.
 */
export async function setDemoMode(on: boolean): Promise<void> {
  await adminAction();
  const store = await cookies();
  if (on) {
    store.set(DEMO_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    store.delete(DEMO_COOKIE);
  }
  revalidatePath("/");
}
