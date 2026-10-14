"use server";

import { signOut } from "@/auth.ts";

/** Ends the dashboard session and returns to the landing page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
