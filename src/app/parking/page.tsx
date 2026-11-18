import { redirect } from "next/navigation";
import { ParkingApp } from "@/components/parking-app";
import { ApiError } from "@/server/errors";
import { viewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function ParkingPage() {
  try {
    const { id, name, role, verified, registration } = await viewer();
    return <ParkingApp initialProfile={{ id, name, role, verified, registration }} demo={process.env.APP_ENV !== "pilot"} />;
  } catch (error) {
    if (error instanceof ApiError && error.code === "MFA_REQUIRED") redirect("/account?mode=mfa");
    if (error instanceof ApiError && error.status === 401) redirect("/account");
    if (error instanceof ApiError && error.code === "ACCOUNT_UNAVAILABLE")
      return <main className="shell"><h1>Account unavailable</h1><p>Contact the parking administrator.</p></main>;
    throw error;
  }
}
