import { AccountForm } from "@/components/account-form";
import { MfaForm } from "@/components/mfa-form";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  return <main className="auth-page">{mode === "mfa" ? <MfaForm /> :
    <AccountForm reset={mode === "reset"} expired={error === "link"} />}</main>;
}
