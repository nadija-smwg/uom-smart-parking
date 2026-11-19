import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase-config";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
    const code = request.nextUrl.searchParams.get("code");
    const target = new URL(code ? "/auth/confirm" : "/account?error=link", origin);
    if (code) {
      target.searchParams.set("code", code);
      if (request.nextUrl.searchParams.get("type") === "recovery") target.searchParams.set("type", "recovery");
    }
    return NextResponse.redirect(target, { headers: { "Cache-Control": "private, no-store" } });
  }
  const { url, key } = supabaseConfig();
  let response = NextResponse.next({ request });
  const auth = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  await auth.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: [
  "/parking", "/account", "/api/v1/:path*",
  { source: "/", has: [{ type: "query", key: "code" }] },
  { source: "/", has: [{ type: "query", key: "error_code" }] },
  { source: "/", has: [{ type: "query", key: "error" }] },
] };
