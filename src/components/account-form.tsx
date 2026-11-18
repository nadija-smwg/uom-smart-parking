"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, GraduationCap, UserRound } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";

type Mode = "signin" | "campus" | "visitor" | "forgot" | "reset";
const titles: Record<Mode, string> = {
  signin: "Sign in", campus: "Campus registration", visitor: "Visitor registration",
  forgot: "Reset your password", reset: "Set a new password",
};
const instructions: Record<Mode, string> = {
  signin: "Sign in to check parking availability and manage your sessions.",
  campus: "For University of Moratuwa students, lecturers, and staff.",
  visitor: "Create an account to find visitor parking on campus.",
  forgot: "Enter your account email to receive a password reset link.",
  reset: "Choose a password with at least 12 characters.",
};

export function AccountForm({ reset, expired }: { reset: boolean; expired: boolean }) {
  const [mode, setMode] = useState<Mode>(reset ? "reset" : "signin");
  const [message, setMessage] = useState(expired ? "This link expired or was already used. Request a new one." : "");
  const [busy, setBusy] = useState(false);
  const signup = mode === "campus" || mode === "visitor";

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
  }

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

  return <section className="auth-card" aria-labelledby="account-title">
    <div className="auth-title">
      <h1 id="account-title">{titles[mode]}</h1>
      <p className="muted">{instructions[mode]}</p>
    </div>
    <form onSubmit={submit}>
      {signup && <label>Name<input name="name" autoComplete="name" required maxLength={100} /></label>}
      {mode !== "reset" && <label>Email<input name="email" type="email" autoComplete="email" required /></label>}
      {mode !== "forgot" && <label>Password<input name="password" type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        minLength={mode === "signin" ? 1 : 12} required /></label>}
      <button className="primary auth-submit" disabled={busy}>{busy ? "Please wait…" : titles[mode]}
        <ArrowRight size={18} aria-hidden="true" /></button>
    </form>
    <p className="auth-feedback" role="status">{message}</p>
    <nav className="account-options" aria-label="Account options">
      {mode === "signin" ? <>
        <button className="text-action" disabled={busy} onClick={() => changeMode("forgot")}>Reset your password</button>
        <p className="account-options-title">Create an account</p>
        <div className="account-options-grid">
          <button disabled={busy} onClick={() => changeMode("campus")}><GraduationCap size={18} aria-hidden="true" /> Campus registration</button>
          <button disabled={busy} onClick={() => changeMode("visitor")}><UserRound size={18} aria-hidden="true" /> Visitor registration</button>
        </div>
      </> : <div className="actions">
        {(["signin", "campus", "visitor", "forgot"] as const).filter((option) => option !== mode)
          .map((option) => <button className="text-action" key={option} disabled={busy} onClick={() => changeMode(option)}>{titles[option]}</button>)}
      </div>}
    </nav>
  </section>;
}
