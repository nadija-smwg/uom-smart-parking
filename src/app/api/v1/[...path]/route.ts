import type { NextRequest } from "next/server";
import * as driver from "@/server/driver";
import { ApiError, errorResponse, response } from "@/server/errors";
import { viewer } from "@/server/viewer";
import { staffRoute } from "@/server/staff-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  try {
    if (request.method !== "GET") {
      const expected = new URL(process.env.APP_ORIGIN ?? request.nextUrl.origin).origin;
      if (request.headers.get("origin") !== expected)
        throw new ApiError(403, "ORIGIN_REQUIRED", "This request must come from the parking application.");
      if (Number(request.headers.get("content-length") ?? 0) > 64_000)
        throw new ApiError(413, "TOO_LARGE", "The submitted data is too large.");
    }
    const user = await viewer();
    const segments = (await params).path;
    const [area, item, action] = segments;
    const route = request.method + " " + segments.join("/");
    const body = () => request.json() as Promise<unknown>;
    const key = () => driver.uuid.parse(request.headers.get("idempotency-key"));
    if (area === "officer" || area === "admin") return await staffRoute(request, segments, user);
    if (route === "GET home") return response(await driver.home(user));
    if (route === "GET campus") return response(await driver.snapshot(user, request.nextUrl.searchParams.get("vehicle")));
    if (route === "PATCH profile") return response(await driver.saveProfile(user, await body()));
    if (route === "POST vehicles") return response(await driver.saveVehicle(user, await body()), 201);
    if (area === "vehicles" && segments.length === 2) {
      const id = driver.uuid.parse(item);
      if (request.method === "PATCH") return response(await driver.saveVehicle(user, await body(), id));
      if (request.method === "DELETE") return response(await driver.archiveVehicle(user, id));
    }
    if (route === "POST sessions") return response(await driver.claim(user, await body(), key()), 201);
    if (request.method === "POST" && segments.length === 3) {
      if (area === "sessions" && action === "end") return response(await driver.release(user, driver.uuid.parse(item), key()));
      if (area === "notifications" && action === "read") return response(await driver.markRead(user, driver.uuid.parse(item)));
    }
    if (route === "POST reports") return response(await driver.report(user, await body()), 201);
    throw new ApiError(404, "NOT_FOUND", "This endpoint does not exist.");
  } catch (error) {
    return errorResponse(error);
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
