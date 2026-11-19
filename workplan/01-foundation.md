# Phase 1. Project foundation and identity

Use Next.js App Router, TypeScript, Tailwind, and Node.js 24. Manrope and the UI icons are bundled with the application. The campus illustration is stored in the repository.

## Visual design brief

Dantora’s green ink treatment informs the public landing page, account screens, and driver dashboard. The campus illustration depicts an imagined evening scene. The map uses the building footprints, roads, and parking zones from the supplied campus plan. [Dantora reference](https://www.getlayers.ai/layer/dantora) · [Phase 3](03-campus-map.md)

Pair evergreen navigation and pale citron actions with ivory panels. Use Manrope for navigation, forms, and parking data, with serif accents for headings. On phones, keep the main parking action visible, show zone details below the map, and maintain text labels for availability. The landing illustration settles gently into place when the device permits motion.

### Leeward design brief

The earlier Leeward reference informs the daylight view of the interactive map. Its warm surface colors and distinct vehicle-category colors keep roads, buildings, and selection states legible. [Leeward reference](https://www.getlayers.ai/layer/leeward)

<details>
<summary>Campus illustration generation brief</summary>

Generate a wide, engraved illustration of a tropical Sri Lankan university at dusk, with a winding illuminated road, forest canopy, and warm concrete buildings. Concentrate detail on the right and reserve deep green shadow on the left for the headline. Bundle the optimized WebP in the app. [Campus illustration](../public/campus-evening.webp)

</details>

## Local setup

1. Use the repository root when it already contains `package.json` and `src/`. To reconstruct the source from Markdown in a fresh workspace, follow the [workplan index](README.md) and use the generated app directory.
2. Install dependencies. Commit the generated `package-lock.json` for reproducible CI and Vercel installs.
3. Copy the environment example. Configure the database and credentials in Phase 2. Keep `.env.local` out of Git.

```powershell
npm install
Copy-Item -LiteralPath .env.example -Destination .env.local
```

## Supabase Auth setup

Use a dedicated Supabase project for the student demo. Enable email/password sign-in and email confirmation. Configure a minimum password length of 12 and custom SMTP for external recipients. Set the Supabase Site URL to the environment’s canonical origin and allow the exact callback URL. For the deployed project use `https://uom-smart-parking.vercel.app` as the Site URL and add both callback URLs listed in Phase 6. For a separate local Auth project the callback is `http://localhost:3000/auth/confirm`. Keep one canonical origin per Auth project for these server-side email templates. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates#redirecting-the-user-to-a-server-side-endpoint)

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
    "@fontsource-variable/manrope": "5.3.0",
    "@supabase/ssr": "0.8.0",
    "@supabase/supabase-js": "2.95.3",
    "gsap": "3.15.1",
    "leaflet": "1.9.4",
    "lucide-react": "1.75.0",
    "next": "^16.2.0",
    "postgres": "^3.4.8",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "server-only": "^0.0.1",
    "zod": "^4.3.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.0",
    "@types/leaflet": "^1.9.20",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
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
import "@fontsource-variable/manrope";
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
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, History, Map, MapPin, SquareParking } from "lucide-react";
import { SiteBrand } from "@/components/site-brand";
import { campusDirectionsUrl } from "@/lib/contracts";
import campus from "../../data/campus.json";

const features = [
  { icon: Map, title: "Explore the map", detail: "Search for a building or road and see the parking zones nearby." },
  { icon: SquareParking, title: "Find a space", detail: "Check reported availability for your vehicle and campus access." },
  { icon: History, title: "Track your parking", detail: "Save your space and find it again when you’re ready to leave." },
];

export default function Landing() {
  return <main className="welcome">
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <Image className="welcome-scene" src="/campus-evening.webp" alt="" fill sizes="(max-width: 780px) max(100vw, 140svh), 100vw" preload />
      <header className="site-header landing-width">
        <SiteBrand />
        <nav aria-label="Main navigation">
          <a className="guide-link" href="#parking-guide">Parking guide</a>
          <Link className="signin-link" href="/account">Sign in <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>
      <div className="welcome-copy landing-width">
        <p className="location-label"><MapPin size={15} aria-hidden="true" /> University of Moratuwa</p>
        <h1 id="welcome-title">Find your spot<br /><em>on campus.</em></h1>
        <p className="welcome-description">Explore the campus map and find a parking space that fits your vehicle.</p>
        <div className="actions">
          <Link className="scene-action" href="/parking">Find parking <ArrowRight size={19} aria-hidden="true" /></Link>
          <a className="directions-link" href={campusDirectionsUrl} referrerPolicy="no-referrer">
            <Compass size={18} aria-hidden="true" /> Campus directions
          </a>
        </div>
      </div>
      <div className="scene-footer landing-width">
        <span><i aria-hidden="true" /> Moratuwa, Sri Lanka</span>
        <span>Campus illustration</span>
      </div>
    </section>
    <section className="parking-guide landing-width" id="parking-guide" aria-labelledby="guide-title">
      <div className="guide-heading"><h2 id="guide-title">Campus parking guide</h2>
        <p>{campus.zones.length} mapped zones <span aria-hidden="true">/</span> {campus.buildings.length} campus buildings</p>
      </div>
      <div className="welcome-features">
        {features.map(({ icon: Icon, title, detail }) => <article key={title}>
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" /><div><h3>{title}</h3><p>{detail}</p></div>
        </article>)}
      </div>
      {process.env.APP_ENV !== "pilot" && <footer className="site-footer">Student project · Demo data</footer>}
    </section>
  </main>;
}
```

### `src/components/site-brand.tsx`

<!-- file: src/components/site-brand.tsx -->

```tsx
import Link from "next/link";
import { SquareParking } from "lucide-react";

export function SiteBrand() {
  return <Link href="/" className="site-brand">
    <span className="brand-icon"><SquareParking size={24} strokeWidth={2} aria-hidden="true" /></span>
    <span>UoM <strong>Smart Parking</strong></span>
  </Link>;
}
```

### `src/app/globals.css`

<!-- file: src/app/globals.css -->

```css
@import "tailwindcss";

:root {
  --ink: #142e25;
  --action: #19523f;
  --action-hover: #103a2d;
  --paper: #f6f5ed;
  --surface: #fffefa;
  --line: #dedfd4;
  --muted: #525f62;
  --green: #385c3d;
  --sage: #e8efd9;
  --rail: #092a20;
  --shadow: 0 5px 20px #24352b08;
  --citron: #dbf695;
  color-scheme: light;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 500 1rem/1.55 "Manrope Variable", system-ui, sans-serif;
  overflow-wrap: anywhere;
}

h1, h2, h3, p, figure { margin: 0; }
h1, h2, h3 { font-weight: 800; }
h1 { font-size: clamp(2.15rem, 4.2vw, 3.5rem); line-height: 1.05; letter-spacing: -.055em; }
h2 { font-size: clamp(1.16rem, 2vw, 1.4rem); line-height: 1.2; letter-spacing: -.035em; }
h3 { font-size: 1rem; line-height: 1.35; letter-spacing: -.02em; }

button, .button, a.primary, .text-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  min-height: 44px;
  padding: .55rem .9rem;
  border: 1px solid var(--line);
  border-radius: .75rem;
  background: var(--surface);
  color: var(--ink);
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
}

button svg, a svg { flex: none; }
button:hover:not(:disabled), .button:hover { background: #eef0e7; }
button[aria-pressed="true"] { background: var(--sage); border-color: #b3c6a2; color: var(--action); }
button.primary, a.primary {
  background: var(--action);
  border-color: var(--action);
  color: white;
  padding-inline: 1rem;
}
button.primary:hover:not(:disabled), a.primary:hover { background: var(--action-hover); }
button:disabled { opacity: .55; cursor: default; }
.text-action {
  text-align: left;
  justify-content: flex-start;
  padding: .3rem .15rem;
  border: 0;
  border-radius: .4rem;
  background: transparent;
  color: var(--action);
  font-size: .9rem;
}
.text-action:hover:not(:disabled) { text-decoration: underline; text-underline-offset: .22em; background: transparent; }
:focus-visible { outline: 3px solid #946000; outline-offset: 3px; }

label { display: grid; min-width: 0; gap: .35rem; font-size: .9rem; font-weight: 750; }
input, select, textarea {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: .55rem .72rem;
  border: 1px solid #bfc7bc;
  border-radius: .7rem;
  background: #fff;
  color: var(--ink);
  font: 550 1rem/1.4 "Manrope Variable", system-ui, sans-serif;
}
select { text-overflow: ellipsis; }
textarea { min-height: 5rem; }
.check { grid-template-columns: auto 1fr; align-items: center; min-height: 44px; gap: .55rem; }
.check input { inline-size: 1.15rem; block-size: 1.15rem; min-height: 0; accent-color: var(--action); }
form, .stack { display: grid; gap: .85rem; }
form > button { justify-self: start; }
summary { cursor: pointer; padding: .55rem 0; font-weight: 750; }
caption { text-align: left; }

.actions { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; }
.small { font-size: .85rem; }
.muted { color: var(--muted); }
.status { font-weight: 750; }
.error { color: #9a2f28; }
.card {
  min-width: 0;
  padding: clamp(1rem, 2vw, 1.45rem);
  border: 1px solid var(--line);
  border-radius: 1.15rem;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.card > h2 { margin-bottom: .7rem; }
.stack > h2 { margin-bottom: 0; }
.card > p + form { margin-top: 1rem; }
.tag {
  display: inline-flex;
  align-items: center;
  padding: .22rem .6rem;
  border-radius: .45rem;
  background: #f0f1e9;
  font-size: .77rem;
  font-weight: 750;
}
.panel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr)); gap: 1rem; align-items: start; }
.record { display: grid; gap: .4rem; padding: .8rem 0; border-bottom: 1px solid var(--line); }
.record:last-child { border-bottom: 0; }
.record button { justify-self: start; }
.record[open] form { margin-block: .4rem .7rem; }

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: .66rem;
  color: var(--ink);
  font-size: .97rem;
  font-weight: 750;
  line-height: 1.15;
  text-decoration: none;
}
.site-brand strong { font-weight: 800; }
.brand-icon, .feature-icon {
  display: inline-grid;
  flex: none;
  place-items: center;
  inline-size: 2.72rem;
  block-size: 2.72rem;
  border-radius: .83rem;
  color: #284b32;
  background: var(--sage);
}
.brand-icon { color: #103426; background: var(--citron); border-radius: 50%; }
.feature-icon[data-tone="blue"] { color: #294e76; background: #e8eff9; }
.feature-icon[data-tone="sand"] { color: #744f24; background: #f6edda; }

.landing-width { width: min(calc(100% - 2 * clamp(1.25rem, 5vw, 5rem)), 90rem); margin-inline: auto; }
.welcome-hero { position: relative; isolation: isolate; display: flex; flex-direction: column; min-height: clamp(39rem, 78svh, 55rem); background: #08251a; color: #fffef5; overflow: clip; }
.welcome-scene { z-index: -2; object-fit: cover; object-position: 65% 55%; }
.welcome-hero::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(90deg, #031d14e8 0%, #041d13b8 28%, transparent 65%), linear-gradient(0deg, #02180dc7, transparent 18%, transparent 83%, #031c1591); }
.site-header, .site-header nav, .scene-footer, .scene-footer span { display: flex; align-items: center; }
.site-header { justify-content: space-between; min-height: 5rem; gap: 1rem; border-bottom: 1px solid #eff7dd45; }
.site-header .site-brand { color: inherit; }
.site-header nav { gap: clamp(1rem, 3vw, 3rem); }
.site-header nav a, .directions-link, .scene-action { display: inline-flex; align-items: center; justify-content: center; gap: .55rem; min-height: 44px; text-decoration: none; font-size: .89rem; font-weight: 750; }
.signin-link { padding-inline: 1.15rem; border: 1px solid #e5edce99; border-radius: 3rem; background: #09241db3; }
.signin-link:hover, .directions-link:hover, .guide-link:hover { text-decoration: underline; text-underline-offset: .25em; }
.welcome-copy { display: grid; flex: 1; align-content: center; justify-items: start; padding-block: clamp(3rem, 6vw, 6rem); gap: 1.35rem; }
.location-label, .scene-footer, .guide-heading p { font: 650 .72rem/1.45 "Manrope Variable", sans-serif; text-transform: uppercase; letter-spacing: .12em; }
.location-label { display: flex; align-items: center; gap: .5rem; color: #e2efce; }
.welcome h1 { font-size: clamp(4.15rem, 7.9vw, 8rem); font-weight: 650; line-height: .93; letter-spacing: -.078em; }
.welcome h1 em, .dashboard-copy h1 span { font-family: Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: -.062em; }
.welcome h1 em { color: var(--citron); }
.welcome-description { max-width: 24rem; color: #eff2e7; font-size: clamp(1rem, 1.4vw, 1.18rem); }
.welcome .actions { gap: .45rem 1.5rem; }
.scene-action { border: 1px solid var(--citron); border-radius: 3rem; padding: .85rem 1.25rem; color: #102b1d; background: var(--citron); }
a.scene-action:hover, button.scene-action:hover:not(:disabled) { background: #efffc5; }
.directions-link { color: #fffef9; }
.welcome-hero :focus-visible, .dashboard-copy :focus-visible { outline-color: var(--citron); }
.scene-footer { justify-content: space-between; gap: .6rem; min-height: 3.4rem; border-top: 1px solid #eff7dd45; color: #f2f5dd; font-size: .64rem; }
.scene-footer span { gap: .55rem; }
.scene-footer i { width: .47rem; height: .47rem; border-radius: 50%; background: var(--citron); }
.parking-guide { padding-block: clamp(2rem, 4vw, 4rem); }
.guide-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: .75rem; padding-bottom: 1.2rem; border-bottom: 1px solid #b9c6b4; }
.guide-heading h2 { font: 500 clamp(1.85rem, 3.3vw, 3.1rem)/1.1 Georgia, serif; letter-spacing: -.055em; }
.guide-heading p { color: var(--green); font-size: .67rem; }
.guide-heading p span { padding-inline: .35rem; }
.welcome-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.welcome-features article { display: flex; align-items: start; gap: 1rem; padding: 1.4rem clamp(.8rem, 2vw, 2rem) .65rem 0; }
.welcome-features article > svg { color: var(--action); flex: none; margin-top: .12rem; }
.welcome-features h3 { margin-bottom: .3rem; font-size: 1.08rem; }
.welcome-features p, .site-footer { color: var(--muted); font-size: .89rem; }
.site-footer { padding-top: 1.8rem; font-size: .76rem; }
.campus-art { position: relative; min-width: 0; overflow: hidden; background: #0b3325; }
.campus-art img { object-fit: cover; }
.art-label { position: absolute; bottom: 1rem; right: 1rem; display: flex; align-items: center; gap: .4rem; max-width: calc(100% - 2rem); border-radius: 2rem; padding: .45rem .8rem; background: #09241deb; color: #f5f7dd; font-size: .74rem; }
.art-label svg { flex: none; }

.auth-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100dvh;
  background: var(--surface);
}
.auth-body { display: grid; grid-template-rows: auto 1fr; min-width: 0; padding: 1.5rem clamp(1.25rem, 4vw, 4.5rem); }
.auth-content { display: grid; align-items: center; padding: 2.25rem 0; }
.auth-card { width: min(100%, 29rem); margin-inline: auto; }
.auth-title { display: grid; gap: .7rem; margin-bottom: 1.75rem; }
.auth-title h1, .auth-card > h1 { font: 500 clamp(2.65rem, 4.5vw, 4.4rem)/1.02 Georgia, serif; letter-spacing: -.055em; }
.auth-title p { max-width: 24rem; }
.auth-card form { gap: 1rem; }
.auth-card form .auth-submit { justify-self: stretch; min-height: 49px; border-radius: 3rem; }
.auth-card > h1, .auth-card > p:not(:empty) { margin-bottom: .9rem; }
.auth-feedback:not(:empty) { padding: .75rem; border: 1px solid var(--line); border-radius: .65rem; background: var(--paper); margin-top: .9rem; }
.account-options { display: grid; justify-items: start; gap: .6rem; margin-top: .35rem; }
.account-options > .actions { margin-top: .65rem; }
.account-options-title { width: 100%; padding-top: .9rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .87rem; font-weight: 750; }
.account-options-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; gap: .6rem; }
.account-options-grid button { justify-content: flex-start; font-size: .85rem; }
.auth-art { min-height: 35rem; margin: .8rem .8rem .8rem 0; border-radius: 1.45rem; }
.auth-art img { object-position: 75% center; }

.app-layout { display: grid; grid-template-columns: 14.4rem minmax(0, 1fr); min-height: 100dvh; }
.side-rail {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 1.3rem .9rem 1rem;
  background: var(--rail);
  color: #f4f8fb;
  overflow-y: auto;
}
.rail-brand { padding-inline: .4rem; margin-bottom: 2rem; }
.rail-brand .site-brand { min-height: 46px; color: #f9fbfd; }
.rail-brand .site-brand strong { display: block; }
.app-nav { display: flex; flex-direction: column; gap: .28rem; }
.app-nav button, .rail-sign-out {
  justify-content: flex-start;
  min-height: 48px;
  gap: .7rem;
  text-align: left;
  color: #e0ebf3;
  border-color: transparent;
  background: transparent;
  font-size: .9rem;
}
.app-nav button:hover:not(:disabled), .rail-sign-out:hover:not(:disabled) { background: #214637; }
.app-nav button[aria-pressed="true"] { border-color: var(--citron); background: var(--citron); color: #142e25; }
.side-rail :focus-visible { outline-color: #d8eca4; outline-offset: 1px; }
.nav-icon { position: relative; display: inline-grid; place-items: center; flex: none; }
.unread-count { position: absolute; top: -.45rem; right: -.65rem; min-width: 1rem; padding: 0 .16rem; border-radius: 1rem; background: #ffd199; color: #452c18; font: 750 .64rem/1rem system-ui; text-align: center; }
.rail-footer { display: grid; justify-items: stretch; gap: .65rem; margin-top: auto; padding-top: 1.25rem; }
.rail-user { display: flex; align-items: center; gap: .65rem; min-width: 0; padding: .85rem .35rem .15rem; border-top: 1px solid #416153; }
.user-avatar { display: grid; place-items: center; inline-size: 2.35rem; block-size: 2.35rem; flex: none; border-radius: .75rem; background: #cfe694; color: #1b3826; font-size: .77rem; font-weight: 800; }
.rail-user > div { min-width: 0; }
.rail-user strong, .rail-user div span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rail-user strong { font-size: .85rem; }
.rail-user div span { color: #c2d4c8; text-transform: capitalize; font-size: .76rem; }

.shell { width: 100%; max-width: 94rem; margin-inline: auto; padding: 1.5rem clamp(1rem, 3vw, 2.5rem) 2.5rem; }
.app-main { padding-top: 0; }
.app-head { display: flex; align-items: center; gap: 1.1rem; min-height: 4.7rem; border-bottom: 1px solid var(--line); margin-bottom: 1.25rem; }
.app-location { display: flex; align-items: center; gap: .45rem; margin-right: auto; color: var(--muted); font-size: .88rem; font-weight: 750; }
.app-location svg { color: var(--green); flex: none; }
.app-head-actions { display: flex; align-items: center; gap: .5rem; }
.app-sync { display: flex; align-items: baseline; gap: .53rem; color: var(--muted); font-size: .76rem; line-height: 1.45; }
.app-sync strong, .app-sync time { display: block; }
.app-sync strong { color: var(--ink); font-weight: 800; }
.sync-dot { position: relative; top: -.06rem; inline-size: .48rem; block-size: .48rem; flex: none; border-radius: 50%; background: #936510; }
.sync-dot[data-state="updated"] { background: #4b7b45; }
.sync-dot[data-state="offline"] { background: #a64839; }
.demo-label { padding: .24rem .55rem; border-radius: .45rem; color: #624e27; background: #f5ebd3; font-size: .76rem; font-weight: 800; }
.mobile-brand, .mobile-sign-out, .operations-short { display: none; }
.app-alert { margin-bottom: .85rem; padding: .7rem .95rem; border: 1px solid #cbd6c3; border-radius: .75rem; background: #f0f4e8; font-size: .9rem; }
.page-intro { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin: 1.55rem 0 1rem; }
.page-intro h1 { font-size: clamp(2.15rem, 3.5vw, 3.1rem); }

.dashboard { display: grid; gap: 1rem; }
.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, .96fr) minmax(0, 1.04fr);
  min-height: 16.25rem;
  border: 1px solid var(--rail);
  border-radius: 1.28rem;
  overflow: hidden;
  background: var(--rail);
  color: #fffef5;
}
.dashboard-copy { display: grid; align-content: center; justify-items: start; gap: .8rem; padding: clamp(1.25rem, 3vw, 2.35rem); }
.dashboard-copy h1 { font-size: clamp(2rem, 3.45vw, 3.1rem); }
.dashboard-copy h1 span { display: block; color: var(--citron); }
.dashboard-copy p { max-width: 24rem; color: #dbe7d9; font-size: .98rem; }
.dashboard-copy .actions { margin-top: .3rem; }
.hero-map-action { background: transparent; border-color: #93af99; color: #eff4e8; border-radius: 3rem; }
.hero-map-action:hover:not(:disabled) { background: #244938; }
.dashboard-art img { object-position: 75% center; }
.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
.metric { display: flex; align-items: center; gap: .85rem; padding: 1rem; }
.metric strong, .metric div span { display: block; }
.metric strong { font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800; letter-spacing: -.055em; line-height: 1.15; }
.metric div span { margin-top: .12rem; color: var(--muted); font-size: .79rem; font-weight: 750; }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1.42fr) minmax(0, 1fr); align-items: start; gap: 1rem; }
.dashboard-secondary { display: grid; gap: .8rem; }
.panel-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2rem .6rem; margin-bottom: .6rem; }
.panel-heading h2 + p { margin-top: .35rem; }
.panel-heading .text-action { font-size: .8rem; }
.availability-list { display: grid; list-style: none; padding: 0; margin: 0; }
.availability-list li { display: flex; align-items: center; gap: .7rem; padding: .5rem 0; }
.category-icon { display: grid; place-items: center; flex: none; inline-size: 2rem; block-size: 2rem; border-radius: .55rem; background: #f5f4ec; }
.availability-row { flex: 1; min-width: 0; }
.availability-row > div { display: flex; justify-content: space-between; align-items: baseline; gap: .15rem .6rem; font-size: .86rem; font-weight: 750; }
.availability-row .small { font-size: .78rem; white-space: nowrap; }
.availability-row progress { display: block; width: 100%; height: .38rem; margin-top: .4rem; appearance: none; color: #668452; border: 0; border-radius: 10rem; background: #eaede2; }
.availability-row progress::-webkit-progress-bar { border-radius: 10rem; background: #eaede2; }
.availability-row progress::-webkit-progress-value { border-radius: 10rem; background: #668452; }
.availability-row progress::-moz-progress-bar { border-radius: 10rem; background: #668452; }
.dashboard-record { display: flex; align-items: center; gap: .65rem; }
.dashboard-record + .dashboard-record { margin-top: .65rem; }
.dashboard-record .feature-icon { inline-size: 2.3rem; block-size: 2.3rem; border-radius: .65rem; }
.dashboard-record h3 { margin-bottom: .15rem; }

.vehicle-picker { grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .6rem; min-width: min(100%, 23rem); }
.vehicle-picker span { display: flex; align-items: center; gap: .4rem; }
.vehicle-picker svg { color: var(--green); flex: none; }
.vehicle-picker select { font-size: .9rem; }
.map-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem); gap: 1rem; align-items: start; }
.map-card { display: grid; gap: .65rem; padding: .75rem; }
.map-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .32rem; }
.map-tools button { gap: .38rem; padding: .32rem .58rem; font-size: .79rem; }
.map-frame {
  position: relative;
  width: 100%;
  min-height: 25rem;
  height: min(64dvh, 46rem);
  border: 1px solid #d9e0cc;
  border-radius: .86rem;
  overflow: hidden;
  background: #e1e8d6;
  isolation: isolate;
}
.map-leaflet.leaflet-container { position: absolute; inset: 0; background: #e4e9dc; font-family: inherit; }
.map-leaflet[data-theme="night"] { background: #192438; }
.map-landmark.leaflet-tooltip {
  padding: .18rem .4rem;
  border: 1px solid #c9caba;
  border-radius: .4rem;
  box-shadow: 0 2px 6px #24352b1f;
  background: #fffdf5;
  color: var(--ink);
  font-size: .68rem;
  font-weight: 800;
}
.map-leaflet[data-theme="night"] .map-landmark { border-color: #657993; background: #202f46; color: #f2f6f9; }
.map-hint { padding-inline: .15rem; color: var(--muted); font-size: .77rem; }
.mobile-sheet { padding: 1rem; }
.mobile-sheet > section { padding-bottom: .95rem; border-bottom: 1px solid var(--line); }
.mobile-sheet h2 + p { color: var(--muted); font-size: .88rem; }
.zone-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4rem; }
.zone-metrics span { padding: .5rem; border-radius: .55rem; background: #f0f3e9; color: var(--muted); font-size: .74rem; font-weight: 750; }
.zone-metrics strong { display: block; color: var(--ink); font-size: 1.15rem; line-height: 1.2; }
.search-field { position: relative; }
.search-field svg { position: absolute; top: 50%; left: .7rem; color: var(--muted); transform: translateY(-50%); pointer-events: none; }
.search-field input { padding-inline-start: 2.25rem; }
.zone-list { display: grid; gap: .4rem; max-height: 16.5rem; overflow-y: auto; padding: .21rem; }
.zone-list button { justify-content: space-between; gap: .42rem; text-align: left; font-size: .82rem; }
.legend-meter { display: block; width: 100%; height: .35rem; margin-top: .25rem; accent-color: var(--action); }
.zone-open { flex: none; padding: .2rem .42rem; border-radius: .45rem; background: #efede4; color: #625639; font-size: .73rem; white-space: nowrap; }
.zone-open[data-available="true"] { background: #edf2e3; color: #31563a; }
.campus-directions { justify-self: start; }
.find-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 18rem)); gap: .8rem; }
.result-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .8rem;
  padding: .65rem 0;
  border-top: 1px solid var(--line);
}
.result-row h3 + p { margin-top: .2rem; }
.result-row button { font-size: .85rem; }
.empty-state { display: grid; justify-items: center; gap: .6rem; text-align: center; padding: 2rem 1rem; border: 1px dashed #ccd5c2; border-radius: .8rem; background: #f7f8f1; }
.account-role { text-transform: capitalize; color: var(--muted); }

@media (max-width: 1050px) {
  .app-layout { grid-template-columns: 12.65rem minmax(0, 1fr); }
  .map-grid { grid-template-columns: minmax(0, 1fr); }
  .map-frame { min-height: 22rem; height: min(56dvh, 39rem); }
}

@media (max-width: 900px) {
  .overview-grid { grid-template-columns: minmax(0, 1fr); }
  .dashboard-secondary { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}

@media (max-width: 780px) {
  .site-header { min-height: 4.2rem; }
  .site-header .guide-link { display: none; }
  .welcome-hero { min-height: clamp(38rem, 83svh, 47rem); }
  .welcome-scene { object-position: 67% center; }
  .welcome-hero::before { background: linear-gradient(90deg, #041d14df, #041d1480 70%, #041d142b), linear-gradient(0deg, #05190dd4, transparent 35%); }
  .welcome-copy { padding-block: 3rem; gap: 1.15rem; }
  .welcome h1 { font-size: clamp(3.65rem, 12vw, 6rem); }
  .welcome-description { max-width: 22rem; }
  .welcome-features { grid-template-columns: 1fr; }
  .welcome-features article { padding: 1.1rem 0; border-bottom: 1px solid var(--line); }
  .auth-page { grid-template-columns: minmax(0, 1fr); align-content: start; }
  .auth-body { display: contents; }
  .auth-body > header, .auth-art { grid-area: 1 / 1; }
  .auth-body > header { z-index: 1; align-self: start; padding: 1rem 1.25rem; }
  .auth-body > header .site-brand { color: white; }
  .auth-art { min-height: 0; height: clamp(7.5rem, 29vw, 12rem); margin: 0; border-radius: 0; }
  .auth-art img { object-position: 70% 53%; }
  .auth-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, #06271cdc, transparent 85%); }
  .auth-art .art-label { z-index: 1; bottom: .55rem; right: .7rem; font-size: .65rem; }
  .auth-content { padding: 2rem 1.25rem; }
}

@media (max-width: 720px) {
  .app-layout { display: block; }
  .side-rail { display: contents; }
  .rail-brand, .rail-footer, .app-location { display: none; }
  .side-rail .app-nav :focus-visible { outline-color: #946000; outline-offset: -2px; }
  .shell { padding-bottom: calc(5.4rem + env(safe-area-inset-bottom)); }
  .app-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem .55rem; padding: .65rem 0 .55rem; margin-bottom: .85rem; }
  .app-head-actions { grid-column: 2; grid-row: 1; }
  .mobile-brand { display: block; }
  .mobile-brand .brand-icon { inline-size: 2.35rem; block-size: 2.35rem; border-radius: .7rem; }
  .mobile-brand .site-brand { min-height: 44px; column-gap: .5rem; font-size: .9rem; }
  .mobile-sign-out { display: inline-flex; inline-size: 44px; padding: 0; }
  .app-sync { grid-column: 1 / -1; align-items: center; font-size: .71rem; }
  .app-sync > div { display: flex; flex-wrap: wrap; gap: .08rem .55rem; }
  .app-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 30;
    flex-direction: row;
    justify-content: space-around;
    gap: 0;
    padding: .24rem .15rem calc(.24rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: var(--surface);
    box-shadow: 0 -5px 25px #2634200c;
  }
  .app-nav button {
    flex: 1 1 0;
    flex-direction: column;
    justify-content: center;
    gap: .25rem;
    min-width: 44px;
    min-height: 54px;
    padding: .19rem .09rem;
    border-radius: .6rem;
    color: var(--muted);
    font-size: .69rem;
    line-height: 1.15;
    text-align: center;
    overflow-wrap: normal;
    text-wrap: balance;
  }
  .app-nav button:hover:not(:disabled) { background: #edf0e7; }
  .app-nav button[aria-pressed="true"] { background: var(--sage); border-color: #bdcda6; color: var(--action); }
  .app-nav svg { width: 18px; height: 18px; }
  .operations-label { display: none; }
  .operations-short { display: inline; }
  .dashboard-hero { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .dashboard-copy { padding: 1.15rem; gap: .55rem; }
  .dashboard-copy p { font-size: .91rem; }
  .dashboard-copy .actions button { padding-inline: .75rem; gap: .4rem; font-size: .88rem; }
  .dashboard-art { height: clamp(9.5rem, 35vw, 14.5rem); }
  .dashboard-art img { object-position: 55% 42%; }
  .metrics { gap: .45rem; }
  .metric { flex-direction: column; align-items: start; gap: .4rem; padding: .68rem; }
  .metric .feature-icon { inline-size: 2rem; block-size: 2rem; border-radius: .55rem; }
  .metric .feature-icon svg { width: 17px; height: 17px; }
  .metric div span { font-size: .71rem; line-height: 1.25; }
  .dashboard-secondary { grid-template-columns: minmax(0, 1fr); }
  .page-intro { align-items: start; flex-direction: column; margin-top: 1.1rem; gap: .7rem; }
  .vehicle-picker { width: 100%; }
  .map-frame { min-height: 16.5rem; height: clamp(16.5rem, 37dvh, 23rem); }
  .map-grid { gap: .65rem; }
  .map-card { padding: .55rem; }
  .mobile-sheet { position: relative; z-index: 2; margin-top: -.25rem; border-radius: 1.15rem 1.15rem .85rem .85rem; }
  .result-row { grid-template-columns: auto minmax(0, 1fr); row-gap: .55rem; }
  .result-row > button { grid-column: 2; justify-self: start; }
}

@media (max-width: 385px) {
  .app-nav button { font-size: .64rem; }
  .account-options-grid { grid-template-columns: minmax(0, 1fr); }
  .find-filters { grid-template-columns: minmax(0, 1fr); }
  .dashboard-copy .actions { gap: .43rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; }
}

.map-detail-label.leaflet-tooltip { padding: .12rem .25rem; border-radius: .2rem; font: 650 .64rem/1.2 system-ui; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes campus-traffic { to { stroke-dashoffset: -72px; } }
  .traffic-lane { animation: campus-traffic 3.6s linear infinite; }
}

@media (prefers-reduced-motion: no-preference) {
  @keyframes scene-enter { from { transform: scale(1.025); } to { transform: scale(1); } }
  .welcome-scene { animation: scene-enter 2.4s ease-out both; }
}
```

### `src/app/account/page.tsx`

<!-- file: src/app/account/page.tsx -->

```tsx
import Image from "next/image";
import { MapPin } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { MfaForm } from "@/components/mfa-form";
import { SiteBrand } from "@/components/site-brand";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  return <main className="auth-page">
    <div className="auth-body">
      <header><SiteBrand /></header>
      <div className="auth-content">
        {mode === "mfa" ? <MfaForm /> : <AccountForm appOrigin={process.env.APP_ORIGIN} reset={mode === "reset"} expired={error === "link"} />}
      </div>
    </div>
    <figure className="campus-art auth-art">
      <Image src="/campus-evening.webp" alt="" fill sizes="(max-width: 780px) 94vw, 50vw" />
      <figcaption className="art-label"><MapPin size={16} aria-hidden="true" /> University of Moratuwa campus illustration</figcaption>
    </figure>
  </main>;
}
```

### `src/components/account-form.tsx`

<!-- file: src/components/account-form.tsx -->

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, GraduationCap, UserRound } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { useParkingMotion } from "@/lib/use-parking-motion";

type Mode = "signin" | "campus" | "visitor" | "forgot" | "reset" | "resend";
const titles: Record<Mode, string> = {
  signin: "Sign in", campus: "Campus registration", visitor: "Visitor registration",
  forgot: "Reset your password", reset: "Set a new password",
  resend: "Resend confirmation",
};
const instructions: Record<Mode, string> = {
  signin: "Sign in to check parking availability and manage your sessions.",
  campus: "For University of Moratuwa students, lecturers, and staff.",
  visitor: "Create an account to find visitor parking on campus.",
  forgot: "Enter your account email to receive a password reset link.",
  reset: "Choose a password with at least 12 characters.",
  resend: "Enter the email address you registered with to request a fresh confirmation link.",
};

export function AccountForm({ reset, expired, appOrigin }: { reset: boolean; expired: boolean; appOrigin?: string }) {
  const [mode, setMode] = useState<Mode>(reset ? "reset" : "signin");
  const [message, setMessage] = useState(expired ? "This link expired or was already used. Request a new one." : "");
  const [busy, setBusy] = useState(false);
  const signup = mode === "campus" || mode === "visitor";
  const formPanel = useParkingMotion<HTMLElement>(".auth-title, form > label, .auth-submit", mode);

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const callback = new URL("/auth/confirm", appOrigin || location.origin);
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
      } else if (mode === "resend") {
        const { error } = await auth.resend({ type: "signup", email, options: { emailRedirectTo: callback.href } });
        if (error) throw new Error("A confirmation email could not be requested right now. Try again shortly.");
        setMessage("If the address is awaiting confirmation, check your inbox and use the newest link.");
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

  return <section ref={formPanel} className="auth-card" aria-labelledby="account-title">
    <div className="auth-title">
      <h1 id="account-title">{titles[mode]}</h1>
      <p className="muted">{instructions[mode]}</p>
    </div>
    <form onSubmit={submit}>
      {signup && <label>Name<input name="name" autoComplete="name" required maxLength={100} /></label>}
      {mode !== "reset" && <label>Email<input name="email" type="email" autoComplete="email" required /></label>}
      {mode !== "forgot" && mode !== "resend" && <label>Password<input name="password" type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        minLength={mode === "signin" ? 1 : 12} required /></label>}
      <button className="primary auth-submit" disabled={busy}>{busy ? "Please wait…" : titles[mode]}
        <ArrowRight size={18} aria-hidden="true" /></button>
    </form>
    <p className="auth-feedback" role="status">{message}</p>
    <nav className="account-options" aria-label="Account options">
      {mode === "signin" ? <>
        <div className="actions">
          <button className="text-action" disabled={busy} onClick={() => changeMode("forgot")}>Reset your password</button>
          <button className="text-action" disabled={busy} onClick={() => changeMode("resend")}>Resend confirmation</button>
        </div>
        <p className="account-options-title">Create an account</p>
        <div className="account-options-grid">
          <button disabled={busy} onClick={() => changeMode("campus")}><GraduationCap size={18} aria-hidden="true" /> Campus registration</button>
          <button disabled={busy} onClick={() => changeMode("visitor")}><UserRound size={18} aria-hidden="true" /> Visitor registration</button>
        </div>
      </> : <div className="actions">
        {(["signin", "campus", "visitor", "forgot", "resend"] as const).filter((option) => option !== mode)
          .map((option) => <button className="text-action" key={option} disabled={busy} onClick={() => changeMode(option)}>{titles[option]}</button>)}
      </div>}
    </nav>
  </section>;
}
```

### `src/components/mfa-form.tsx`

<!-- file: src/components/mfa-form.tsx -->

```tsx
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

export async function signOutAndRedirect(path: "/" | "/account"): Promise<string> {
  try {
    const { error } = await browserAuth().auth.signOut();
    if (!error) {
      window.location.assign(path);
      return "";
    }
  } catch {
    // A dropped connection can also interrupt the sign-out request.
  }
  return "Sign-out could not be confirmed. Check your connection and try again.";
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
  if (request.nextUrl.pathname === "/") {
    const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
    const code = request.nextUrl.searchParams.get("code");
    const target = new URL(code ? "/auth/confirm" : "/account?error=link", origin);
    if (code) {
      target.searchParams.set("code", code);
      if (request.nextUrl.searchParams.get("type") === "recovery") target.searchParams.set("type", "recovery");
    }
    return NextResponse.redirect(target, { headers: { "Cache-Control": "private, no-store" } });
  }
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

export const config = { matcher: [
  "/parking", "/account", "/api/v1/:path*",
  { source: "/", has: [{ type: "query", key: "code" }] },
  { source: "/", has: [{ type: "query", key: "error_code" }] },
  { source: "/", has: [{ type: "query", key: "error" }] },
] };
```

### `src/lib/use-parking-motion.ts`

<!-- file: src/lib/use-parking-motion.ts -->

```ts
"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/** Animate the current contents once, including after a deliberate view change. */
export function useParkingMotion<T extends HTMLElement>(selector: string, view = "", onView = false) {
  const root = useRef<T>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const targets = element.querySelectorAll(selector);
      if (!targets.length) return;
      const reveal = gsap.fromTo(targets, { y: 12, opacity: 0.45 }, {
        y: 0, opacity: 1, duration: 0.46, ease: "power3.out",
        stagger: { amount: Math.min(0.32, (targets.length - 1) * 0.055) },
        paused: true, immediateRender: false, clearProps: "transform,opacity",
      });
      if (!onView) {
        reveal.play();
        return;
      }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          reveal.play();
          observer.disconnect();
        }
      });
      observer.observe(element);
      return () => observer.disconnect();
    });
    return () => media.revert();
  }, [selector, view, onView]);
  return root;
}
```
