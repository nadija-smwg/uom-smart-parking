import "server-only";
import { serverAuth } from "./auth";
import { database, type Transaction } from "./db";
import { ApiError } from "./errors";
import type { Role } from "@/lib/contracts";

export type Viewer = {
  id: string; name: string; role: Role; verified: boolean; suspended: boolean;
  registration: "campus" | "visitor"; max_sessions: number;
};
const elevated = (role: Role) => role === "admin" || role === "officer";

export async function viewer(): Promise<Viewer> {
  const auth = (await serverAuth()).auth;
  const { data: { user } } = await auth.getUser();
  if (!user?.email_confirmed_at) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with a verified email address.");

  const db = database();
  let [profile] = await db<Viewer[]>`select * from app.profiles where id=${user.id}`;
  if (!profile) {
    const registration = user.user_metadata.registration === "campus" ? "campus" : "visitor";
    const name = String(user.user_metadata.display_name || "Campus driver").trim().slice(0, 100) || "Campus driver";
    await db`insert into app.profiles(id,name,registration,verified)
      values (${user.id},${name},${registration},${registration === "visitor"}) on conflict do nothing`;
    [profile] = await db<Viewer[]>`select * from app.profiles where id=${user.id}`;
  }
  if (!profile || profile.suspended) throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "Contact the parking administrator.");
  if (process.env.APP_ENV === "pilot" && elevated(profile.role)) {
    const { data } = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") {
      throw new ApiError(403, "MFA_REQUIRED", "An authenticated MFA session is required for this staff account.");
    }
  }
  return profile;
}

export function requireAccess(user: Viewer, level: "driver" | "officer" | "admin") {
  if (user.suspended || !user.verified || (level === "admin" && user.role !== "admin") ||
      (level === "officer" && !elevated(user.role))) {
    throw new ApiError(403, "PARKING_FORBIDDEN", "Your account does not have permission for this action.");
  }
}

export async function lockActor(tx: Transaction, user: Viewer, level: "driver" | "officer" | "admin") {
  const [current] = await tx<Viewer[]>`select * from app.profiles where id=${user.id} for no key update`;
  if (!current || current.role !== user.role) throw new ApiError(403, "PARKING_FORBIDDEN", "Your account changed. Refresh and try again.");
  requireAccess(current, level);
  return current;
}
