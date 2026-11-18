# Phase 1. Project foundation and identity

Use Next.js App Router, TypeScript, Tailwind, and Node.js 24. The source uses original UI and requires no external design assets.

## Leeward design brief

Leeward from GetLayers.ai is the selected visual reference. Start with the mobile **Campus Map** with a zone selected, then apply the same design to **Find Parking** and **My Parking**. Use this project-specific prompt for the design handoff. [Preview Leeward](https://www.getlayers.ai/layer/leeward)

> Design a mobile-first UoM Smart Parking app using Leeward’s 3D landscape as the visual reference. Show the supplied University of Moratuwa campus layout as an isometric architectural model in soft daylight, with warm concrete buildings and a green playground. Use warm ivory `#F7F4ED` panels, university navy `#173B68` for navigation and primary actions, and subtle shadows. On desktop, put parking results beside the map. On mobile, keep the map visible behind a compact selected-zone bottom sheet. When a driver selects a zone, focus the map on it and show availability and one clear parking action. Keep the 2D/3D switch easy to reach and make status readable through text and icons as well as color.

## Local setup

1. Use the repository root when it already contains `package.json` and `src/`. To reconstruct the source from Markdown in a fresh workspace, follow the [workplan index](README.md) and use the generated app directory.
2. Install dependencies. Commit the generated `package-lock.json` for reproducible CI and Vercel installs.
3. Copy the environment example. Configure the database and credentials in Phase 2. Keep `.env.local` out of Git.

```powershell
npm install
Copy-Item -LiteralPath .env.example -Destination .env.local
```

## Supabase Auth setup

Use a dedicated Supabase project for the student demo. Enable email/password sign-in and email confirmation. Configure a minimum password length of 12 and custom SMTP for external recipients. Set the Supabase Site URL to the environment’s canonical origin and allow the exact callback URL. For local work that is `http://localhost:3000/auth/confirm`. Keep one canonical origin per Auth project for these server-side email templates. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates#redirecting-the-user-to-a-server-side-endpoint)

Use these links in the corresponding email templates.

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm your email</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

Public signup offers **Campus** and **Visitor**. Email confirmation verifies the address. Campus accounts remain pending until an administrator verifies affiliation and assigns Student, Lecturer, University Staff, or an authorized operations role. Email-confirmed visitors receive Driver permissions with visitor-specific zone rules. Assign Security Officer and Administrator in Operations after verifying the person's duties. Pilot accounts with either privileged role require TOTP. See the [permission matrix](05-operations.md#roles-and-permissions).

**Exit check** after the remaining phases and database setup. Verify campus signup, visitor signup, email confirmation, sign-in, and password recovery with the intended origin. Opening `/parking` when signed out should redirect to sign-in.

## Complete source files

### `package.json`

<!-- file: package.json -->

```json
{
  "name": "uom-smart-parking",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "db:migrate": "node --env-file-if-exists=.env.local scripts/migrate.mjs",
    "db:runtime": "node --env-file-if-exists=.env.local scripts/provision-runtime.mjs",
    "db:seed": "node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/seed.mjs",
    "db:admin": "node --env-file-if-exists=.env.local scripts/bootstrap-admin.mjs",
    "assets": "node scripts/campus.mjs && node scripts/icons.mjs",
    "test": "node --test tests/*.test.mjs",
    "test:database": "node --env-file-if-exists=.env.local scripts/check-database.mjs",
    "prebuild": "npm run assets",
    "predev": "npm run assets"
  },
  "dependencies": {
    "@supabase/ssr": "0.8.0",
    "@supabase/supabase-js": "2.95.3",
    "leaflet": "1.9.4",
    "next": "^16.2.0",
    "postgres": "^3.4.8",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "server-only": "^0.0.1",
    "three": "^0.183.0",
    "zod": "^4.3.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.0",
    "@types/leaflet": "^1.9.20",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@types/three": "^0.183.0",
    "tailwindcss": "^4.2.0",
    "typescript": "^5.9.3"
  }
}
```

### `tsconfig.json`

<!-- file: tsconfig.json -->

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `.gitignore`

<!-- file: .gitignore -->

```dotenv
node_modules/
.next/
.vercel/
*.tsbuildinfo
next-env.d.ts
.env*
!.env.example
public/campus.json
public/icon-192.png
public/icon-512.png
*.dump
```

### `.env.example`

<!-- file: .env.example -->

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
APP_ORIGIN=http://localhost:3000
APP_ENV=demo
STALE_SESSION_HOURS=24
DATABASE_URL=
DATABASE_SSL_CA=
# Local operator variables only
MIGRATION_DATABASE_URL=
PARKING_RUNTIME_PASSWORD=
BOOTSTRAP_ADMIN_EMAIL=
CONFIRM_DEMO_SEED=
CONFIRM_DATABASE_TEST=
```

### `next.config.ts`

<!-- file: next.config.ts -->

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default config;
```

### `postcss.config.mjs`

<!-- file: postcss.config.mjs -->

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

### `src/app/layout.tsx`

<!-- file: src/app/layout.tsx -->

```tsx
import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { InstallSupport } from "@/components/install-support";

export const metadata: Metadata = {
  title: "UoM Smart Parking",
  description: "Find eligible parking at the University of Moratuwa campus.",
  applicationName: "UoM Smart Parking",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<InstallSupport /></body></html>;
}
```

### `src/app/page.tsx`

<!-- file: src/app/page.tsx -->

```tsx
import Link from "next/link";
import { campusDirectionsUrl } from "@/lib/contracts";

export default function Landing() {
  return <main className="welcome">
    <div>
      <p className="eyebrow">University of Moratuwa</p>
      <h1>UoM Smart Parking</h1>
      <p>Explore campus parking, check eligible spaces, and keep track of where you parked.</p>
      {process.env.APP_ENV !== "pilot" && <p className="tag">Student project · Demo data</p>}
      <div className="actions">
        <Link className="primary" href="/parking">Find parking</Link>
        <a href={campusDirectionsUrl} referrerPolicy="no-referrer">Campus directions (Google Maps)</a>
      </div>
    </div>
  </main>;
}
```

### `src/app/globals.css`

<!-- file: src/app/globals.css -->

```css
@import "tailwindcss";

:root { --ink:#152944; --navy:#173b68; --paper:#f7f4ed; --line:#d8dcd3; --green:#176843; }
* { box-sizing:border-box; }
body { margin:0; color:var(--ink); background:var(--paper); font:16px/1.5 system-ui,sans-serif; }
a { color:inherit; }
h1,h2,h3,p { margin:0 0 .65rem; }
h1 { font-size:clamp(1.8rem,4vw,3.3rem); line-height:1.06; letter-spacing:-.045em; }
h2 { font-size:1.5rem; line-height:1.15; }
h3 { font-size:1.1rem; font-weight:650; }
button,a.primary { cursor:pointer; }
button,a.primary,input,select,textarea { min-height:44px; }
button,a.primary { display:inline-flex; align-items:center; justify-content:center; padding:.45rem .8rem; border:1px solid var(--line); border-radius:.6rem; background:#fff; color:var(--ink); font:inherit; text-decoration:none; }
button.primary,a.primary { background:var(--navy); color:white; border-color:var(--navy); font-weight:650; }
button[aria-pressed=true] { background:#e0e9f4; border-color:#8aa1be; }
button:disabled { opacity:.55; cursor:default; }
:focus-visible { outline:3px solid #946000; outline-offset:3px; }
label { display:grid; gap:.25rem; font-weight:600; }
input,select,textarea { padding:.45rem .6rem; width:100%; min-width:0; border:1px solid #aeb8b0; border-radius:.5rem; background:white; color:var(--ink); font:inherit; }
textarea { min-height:5rem; }
.check { grid-template-columns:auto 1fr; align-items:center; min-height:44px; gap:.55rem; }
.check input { inline-size:1.15rem; block-size:1.15rem; min-height:0; accent-color:var(--navy); }
form,.stack { display:grid; gap:.8rem; }
form > button { justify-self:start; }
.welcome,.auth-page { min-height:100dvh; display:grid; place-items:center; padding:1.2rem; }
.welcome { background:radial-gradient(ellipse at 75% 30%,#cfe0bf,transparent 60%),var(--paper); }
.welcome > div { max-width:39rem; }
.welcome p { max-width:34rem; }
.card { background:#fffcf5; border:1px solid var(--line); border-radius:1rem; padding:1rem; box-shadow:0 4px 25px #1529440b; min-width:0; }
.auth-card { width:min(100%,32rem); }
.eyebrow { text-transform:uppercase; letter-spacing:.13em; font-size:.76rem; font-weight:750; }
.tag { display:inline-block; padding:.25rem .55rem; border-radius:999px; background:#e9eddf; font-size:.82rem; }
.actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
.small { font-size:.9rem; }
.muted { color:#485c6e; }
.status { font-weight:650; }
.error { color:#9a2f28; }
.shell { max-width:93rem; margin:auto; padding:1rem clamp(.7rem,2vw,2rem); }
.app-head { display:flex; justify-content:space-between; align-items:start; gap:.8rem; }
.app-head h1 { margin-bottom:.3rem; }
.app-nav { margin:.8rem 0 1rem; }
.map-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(17rem,23rem); gap:.9rem; align-items:start; }
.map-frame { position:relative; width:100%; min-height:26rem; height:min(66vh,48rem); overflow:hidden; background:#e1e8d6; border:1px solid var(--line); border-radius:1rem; isolation:isolate; }
.map-frame canvas { display:block; width:100%; height:100%; touch-action:none; }
.map-leaflet { position:absolute; inset:0; background:#e1e8d6; }
.map-tools { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.65rem; }
.zone-list { display:grid; gap:.35rem; max-height:16rem; overflow:auto; padding:.2rem; }
.zone-list button { justify-content:space-between; gap:.5rem; text-align:left; }
.zone-list button span:last-child { white-space:nowrap; }
.campus-directions { display:inline-flex; align-items:center; min-height:44px; justify-self:start; text-decoration:underline; }
.panel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr)); gap:.8rem; align-items:start; }
.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(8rem,1fr)); gap:.55rem; }
.kpis strong { display:block; font-size:1.45rem; }
.record { padding:.6rem 0; border-bottom:1px solid var(--line); }
caption { text-align:left; }
summary { cursor:pointer; padding:.4rem 0; }
@media (max-width: 720px) {
  .shell { padding-bottom:calc(5.5rem + env(safe-area-inset-bottom)); }
  .map-grid { grid-template-columns:1fr; }
  .map-frame { min-height:18rem; height:clamp(18rem,44dvh,26rem); }
  .mobile-sheet { border-radius:1.2rem 1.2rem .8rem .8rem; margin-top:-.35rem; position:relative; z-index:2; }
  .app-nav { display:flex; flex-wrap:nowrap; position:fixed; inset:auto 0 0; z-index:20; margin:0; background:var(--paper); border-top:1px solid var(--line); overflow:auto; padding:.35rem .4rem calc(.35rem + env(safe-area-inset-bottom)); }
  .app-nav button { white-space:nowrap; flex:0 0 auto; font-size:.82rem; }
}
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto !important; } }
```

### `src/app/account/page.tsx`

<!-- file: src/app/account/page.tsx -->

```tsx
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
```

### `src/components/account-form.tsx`

<!-- file: src/components/account-form.tsx -->

```tsx
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
```

### `src/components/mfa-form.tsx`

<!-- file: src/components/mfa-form.tsx -->

```tsx
"use client";

import { useEffect,useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";

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
      await browserAuth().auth.signOut(); location.assign("/account");
    }}>Back to sign in</button>
  </section>;
}
```

### `src/app/auth/confirm/route.ts`

<!-- file: src/app/auth/confirm/route.ts -->

```ts
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
```

### `src/lib/supabase-config.ts`

<!-- file: src/lib/supabase-config.ts -->

```ts
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public configuration is missing.");
  return { url, key };
}
```

### `src/lib/supabase-browser.ts`

<!-- file: src/lib/supabase-browser.ts -->

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./supabase-config";

export function browserAuth() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key);
}
```

### `src/server/auth.ts`

<!-- file: src/server/auth.ts -->

```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/supabase-config";

export async function serverAuth() {
  const cookieStore = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options);
        } catch {
          // Proxy refreshes cookies before Server Components run.
        }
      },
    },
  });
}
```

### `src/proxy.ts`

<!-- file: src/proxy.ts -->

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase-config";

export async function proxy(request: NextRequest) {
  const { url, key } = supabaseConfig();
  let response = NextResponse.next({ request });
  const auth = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  await auth.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/parking", "/account", "/api/v1/:path*"] };
```
