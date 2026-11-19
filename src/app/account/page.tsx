import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { MfaForm } from "@/components/mfa-form";
import { CampusPlate } from "@/components/campus-plate";
import { SiteBrand } from "@/components/site-brand";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  return <div className="atlas-account">
    <header className="atlas-mast atlas-width"><SiteBrand />
      <Link className="atlas-index-link" href="/"><ArrowLeft size={16} /> Parking atlas</Link>
    </header>
    <main className="atlas-pass">
      <div className="pass-entry">
        {mode === "mfa" ? <MfaForm /> : <AccountForm appOrigin={process.env.APP_ORIGIN} reset={mode === "reset"} expired={error === "link"} />}
      </div>
      <aside className="pass-stub">
        <p className="atlas-mono">University of Moratuwa</p>
        <h2>Campus<br />access<span>.</span></h2>
        <CampusPlate />
        <Link href="/">Browse parking zones <ArrowUpRight size={18} /></Link>
      </aside>
    </main>
  </div>;
}
