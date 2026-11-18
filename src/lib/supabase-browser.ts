"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./supabase-config";

export function browserAuth() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key);
}
