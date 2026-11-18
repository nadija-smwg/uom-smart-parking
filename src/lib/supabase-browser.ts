"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./supabase-config";

export function browserAuth() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key);
}

export async function signOutAndRedirect(path: "/" | "/account"): Promise<string> {
  try {
    const { error } = await browserAuth().auth.signOut();
    if (!error) {
      window.location.assign(path);
      return "";
    }
  } catch {
    // A dropped connection can also interrupt the sign-out request.
  }
  return "Sign-out could not be confirmed. Check your connection and try again.";
}
