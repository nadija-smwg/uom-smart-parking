import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

const dbErrors: Record<string, [number, string]> = {
  PARKING_FORBIDDEN: [403, "Your account or vehicle cannot perform this action."],
  SPACE_UNAVAILABLE: [409, "This space is no longer available. Refresh and select an eligible space."],
  ACTIVE_SESSION_LIMIT: [409, "End an active session before starting another."],
  REQUEST_REUSED: [409, "This request key was already used with different details."],
};

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return response({ code: error.code, message: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return response({ code: "INVALID_INPUT", message: "Check the submitted values and try again." }, 422);
  const pg = error as { code?: string; message?: string; constraint_name?: string };
  const match = pg?.code === "P0001" ? dbErrors[pg.message ?? ""] : undefined;
  if (match) return response({ code: pg.message, message: match[1] }, match[0]);
  if (pg?.code === "23505" && pg.constraint_name === "vehicle_plate_active")
    return response({ code: "PLATE_IN_USE", message: "This registration is already active. Contact an administrator if you share the vehicle." }, 409);
  if (pg?.code === "23505") return response({ code: "DUPLICATE", message: "That code or active record already exists." }, 409);
  if (pg?.code === "40P01" || pg?.code === "40001")
    return response({ code: "RETRY", message: "An update overlapped yours. Try the same action again." }, 409);
  console.error("parking-request-failed", { type: error instanceof Error ? error.name : "unknown", code: pg?.code });
  return response({ code: "UNAVAILABLE", message: "The parking service is temporarily unavailable." }, 503);
}
