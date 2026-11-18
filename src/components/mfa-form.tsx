"use client";

import { useEffect,useState } from "react";
import { browserAuth, signOutAndRedirect } from "@/lib/supabase-browser";

export function MfaForm() {
  const [factor,setFactor] = useState("");
  const [secret,setSecret] = useState("");
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState("");
  useEffect(() => {
    const auth = browserAuth().auth;
    let stop = false;
    void auth.mfa.listFactors().then(async ({data,error}) => {
      if (stop) return;
      if (error) setMessage("Sign in first to verify your staff account.");
      else {
        const totp = data.totp.at(0);
        if (totp?.status === "verified") setFactor(totp.id);
        for (const row of data.all) if (row.factor_type === "totp" && row.status === "unverified") await auth.mfa.unenroll({factorId:row.id});
      }
      setBusy(false);
    }).catch(() => { if (!stop) { setMessage("Sign in first to continue."); setBusy(false); } });
    return () => { stop = true; };
  },[]);
  return <section className="card auth-card"><h1>Staff account verification</h1>
    {secret && <p>Enter this setup key in your authenticator app, then enter its six-digit code. <code>{secret}</code></p>}
    {!factor ? <button disabled={busy} onClick={async () => {
      setBusy(true); setMessage("");
      try {
        const {data,error} = await browserAuth().auth.mfa.enroll({factorType:"totp",friendlyName:"UoM Smart Parking"});
        if (error || !data) throw new Error("Could not start authentication setup.");
        setFactor(data.id); setSecret(data.totp.secret);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Setup failed."); }
      finally { setBusy(false); }
    }}>Set up authenticator</button> : <form onSubmit={async (event) => {
      event.preventDefault();
      const code=String(new FormData(event.currentTarget).get("code"));
      setBusy(true); setMessage("");
      try {
        const {error} = await browserAuth().auth.mfa.challengeAndVerify({factorId:factor,code});
        if (error) throw new Error("Enter the current authenticator code.");
        location.assign("/parking");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed."); }
      finally { setBusy(false); }
    }}><label>Authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></label>
    <button disabled={busy}>Verify</button></form>}
    <p role="status">{message}</p><button onClick={async () => {
      setMessage(await signOutAndRedirect("/account"));
    }}>Back to sign in</button>
  </section>;
}
