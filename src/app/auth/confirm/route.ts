import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const parameters = request.nextUrl.searchParams;
  const token = parameters.get("token_hash");
  const code = parameters.get("code");
  const type = parameters.get("type");
  const auth = (await serverAuth()).auth;
  let accepted = false;
  if (token && (type === "email" || type === "signup" || type === "recovery")) {
    accepted = !(await auth.verifyOtp({ token_hash: token, type })).error;
  } else if (code) {
    accepted = !(await auth.exchangeCodeForSession(code)).error;
  }
  const next = !accepted ? "/account?error=link" : type === "recovery" ? "/account?mode=reset" : "/parking";
  return NextResponse.redirect(new URL(next, process.env.APP_ORIGIN ?? request.nextUrl.origin));
}
