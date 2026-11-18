"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { browserAuth } from "@/lib/supabase-browser";

type Mode = "signin" | "campus" | "visitor" | "forgot" | "reset";

export function AccountForm({ reset, expired }: { reset: boolean; expired: boolean }) {
  const [mode, setMode] = useState<Mode>(reset ? "reset" : "signin");
  const [message, setMessage] = useState(expired ? "This link expired or was already used. Request a new one." : "");
  const [busy, setBusy] = useState(false);
  const signup = mode === "campus" || mode === "visitor";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const callback = new URL("/auth/confirm", location.origin);
    setBusy(true);
    setMessage("");
    try {
      const { auth } = browserAuth();
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw new Error("Sign-in failed. Check your credentials and email verification.");
        location.assign("/parking");
      } else if (signup) {
        const { error } = await auth.signUp({
          email, password,
          options: {
            emailRedirectTo: callback.href,
            data: { display_name: String(data.get("name")).trim(), registration: mode },
          },
        });
        if (error) throw new Error("Registration could not be completed. Check the fields and try again.");
        setMessage("Check your inbox to confirm your email address.");
      } else if (mode === "forgot") {
        callback.searchParams.set("type", "recovery");
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: callback.href });
        if (error) throw new Error("A reset email could not be requested right now. Try again shortly.");
        setMessage("If the address is registered, look for a password reset email.");
      } else {
        const { error } = await auth.updateUser({ password });
        if (error) throw new Error("Password update failed. Request a fresh recovery link if needed.");
        location.assign("/parking");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "Sign in", campus: "Campus registration", visitor: "Visitor registration",
    forgot: "Reset your password", reset: "Set a new password",
  };

  return <section className="card auth-card">
    <Link href="/">UoM Smart Parking</Link>
    <h1>{titles[mode]}</h1>
    <form onSubmit={submit}>
      {signup && <label>Name<input name="name" autoComplete="name" required maxLength={100} /></label>}
      {mode !== "reset" && <label>Email<input name="email" type="email" autoComplete="email" required /></label>}
      {mode !== "forgot" && <label>Password<input name="password" type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        minLength={mode === "signin" ? 1 : 12} required /></label>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : titles[mode]}</button>
    </form>
    <p role="status">{message}</p>
    <nav className="actions" aria-label="Account options">
      {(["signin", "campus", "visitor", "forgot"] as const).filter((option) => option !== mode)
        .map((option) => <button key={option} disabled={busy} onClick={() => { setMode(option); setMessage(""); }}>{titles[option]}</button>)}
    </nav>
  </section>;
}
