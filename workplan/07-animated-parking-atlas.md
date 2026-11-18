# Phase 7. Moratuwa Parking Atlas

Open the app and you get a campus sheet you can use before signing in. Pick **Library** and the orange locator travels from the playground to the Library Roadside Bay. The strip below the map identifies **Z08**, its vehicle category, and its two planned spaces. Press **Trace Main Street** to watch the road appear, bend by bend, on the university plan.

[Watch the atlas in motion](assets/parking-atlas-motion.webp) · [Campus geometry](../data/campus.json) · [Driver and availability model](04-driver-live-parking.md)

## The interface

| Surface | What the driver sees and can do |
| --- | --- |
| Public atlas | An oversized, condensed title on warm paper faces a dark, gridded plan. Peach marks identify proposed parking zones. The locator, zone code, name, category, and planned capacity change together. Use three landmark shortcuts, the zone selector, or the previous and next controls. |
| Zone directory | Search by name or code, narrow by vehicle category, and locate a result on the drawing. Selecting a row returns keyboard focus to the zone picker. The directory includes all 27 proposed zones. |
| Driver access | The sign-in form sits beside a perforated map stub. The existing components handle registration, recovery, confirmation errors, and staff MFA. On phones the form comes first. |
| Driver board | The largest figure is the last reported number of available spaces. Active sessions and registered vehicles sit beside it. **View campus** opens the existing interactive 2D map. **Find Parking** opens vehicle-specific results. |

**Visual language.** Barlow Condensed 800 gives the headings the shape of lettering on a parking sign. Manrope handles forms and longer names. Zone codes use the system monospace face. Paper `#F3F0E6`, ink `#202925`, map blue-green `#203A40`, and orange `#ED6B37` carry through the public and signed-in screens.

**Data.** The build draws the playground, 16 roads, 30 building footprints, and proposed zones directly from the supplied campus geometry. The public total of 440 is labelled *planned spaces*. The signed-in board reads `Zone.available` from the authenticated snapshot. A pending snapshot displays a dash, and a received count of zero displays zero. The existing app header reports sync and connectivity state.

## Motion

| Trigger | Visible response | Timing |
| --- | --- | --- |
| Open the atlas | The two title lines print into place. The map sheet settles from a slight tilt. | 430 ms per line, 80 ms stagger. Sheet settles in 520 ms. |
| Select a zone | The detail strip updates immediately. The locator glides to the zone’s schematic coordinates and its outline settles around the endpoint. Rapid selections retarget the same element. | 380 ms travel. The outline settles for 360 ms after a 300 ms delay. |
| Trace Main Street | A line advances along the stored points of **UoM Main Street**. Segment length determines its share of the drawing time. The toggle hides the highlight or replays it. | 1,100 ms total. |
| Reported availability changes | The new value appears immediately and moves up a fraction of a line. It displays only the value reported by the API. | 160 ms. |
| Prefer reduced motion | The title and sheet render in their final positions. Zone selection moves the locator immediately. The street toggle shows the entire line immediately. | Static presentation. |

The map image and first zone are available in the initial HTML. The browser handles selection, search, and finite CSS animations. The road trace depicts a street on the schematic. Campus-level directions use the existing Google Maps link.

## Apply to the existing Next.js app

Use the current application from Phases 1–6 as the starting point. The blocks below are complete files. The public atlas and the printable diagram share `data/campus.json`. The app already supplies Manrope, Lucide, the account components, map geometry helpers, and authenticated driver data.

| Add | Replace |
| --- | --- |
| `src/components/campus-plate.tsx` | `scripts/campus.mjs` |
| `src/components/street-trace.tsx` | `src/app/page.tsx` |
| `src/components/parking-atlas.tsx` | `src/app/account/page.tsx` |
| `src/app/atlas.css` | `src/components/parking-overview.tsx` |
| | `src/app/layout.tsx` |

**Install the two packages** in a working copy of the app, using Node.js 24. The canvas package runs during asset generation. The browser receives the generated WebP and bundled font.

```powershell
npm install --save-exact @fontsource/barlow-condensed@5.3.0
npm install --save-dev --save-exact @napi-rs/canvas@1.1.1
```

**Write the nine files.** Copy each source block to its named path, or run this block from the root of the working copy where you want the redesign. It replaces the five files listed above. Use a copy that includes any local UI work you want to keep for comparison.

```powershell
$atlasRoot = (Get-Location).Path
$atlasDoc = [IO.File]::ReadAllText((Join-Path $atlasRoot 'workplan/07-animated-parking-atlas.md'))
$atlasPaths = @(
  'scripts/campus.mjs'
  'src/components/campus-plate.tsx'
  'src/components/street-trace.tsx'
  'src/components/parking-atlas.tsx'
  'src/app/page.tsx'
  'src/app/account/page.tsx'
  'src/components/parking-overview.tsx'
  'src/app/layout.tsx'
  'src/app/atlas.css'
)
$atlasSources = @{}
foreach ($relative in $atlasPaths) {
  $pattern = '(?ms)^<!-- atlas-file: ' + [regex]::Escape($relative) + ' -->\r?\n\r?\n```[^\r\n]+\r?\n(.*?)^```[ \t]*\r?$'
  $blocks = [regex]::Matches($atlasDoc, $pattern)
  if ($blocks.Count -ne 1) { throw "Expected one source block for $relative" }
  $atlasSources[$relative] = $blocks[0].Groups[1].Value
}
foreach ($relative in $atlasPaths) {
  $path = Join-Path $atlasRoot $relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path)) | Out-Null
  [IO.File]::WriteAllText($path, $atlasSources[$relative], [Text.UTF8Encoding]::new($false))
}
```

**Run locally.** Use the Supabase and database runtime settings from Phase 1. For this example the preview uses port 3107, and the origin matches the address opened in the browser.

```powershell
npm run assets
npm run typecheck
npm test
npm run build
$env:APP_ORIGIN = 'http://localhost:3107'
npm run start -- --hostname 127.0.0.1 --port 3107
```

Open [the example local address](http://localhost:3107). For interactive editing, use `npm run dev -- --hostname 127.0.0.1 --port 3107` with the same origin.

**Ship through the existing workflow.** Include the source changes and updated lockfile in your branch. Add `public/campus-atlas.webp` to `.gitignore` alongside `public/campus.json`. The existing `predev` and `prebuild` hooks generate both assets. The hosting build needs the build-time dependencies installed. Follow the existing CI and Vercel workflow when the UI is ready to publish. [Hosting and deployment](06-testing-and-hosting.md)

## Acceptance checks

1. Load the homepage at 1440, 390, and 320 CSS pixels. Check that the sign-in button, zone picker, and step controls fit, and that the page has no horizontal overflow.
2. Starting at Z01, press **Previous zone** to reach Z27 and **Next zone** to return to Z01. Locate **Library**, then choose **Sumanadasa Front Bikes**. The latter shows 74 planned spaces.
3. Toggle **Trace Main Street**. The line follows the actual road from the main entrance on the supplied plan. Enable the operating system’s reduced-motion setting and toggle it again. All segments should appear together.
4. Search for a missing zone and check the empty state. Clear the search, filter to **Bicycles**, and locate **Z20 Bicycle Rack**. The zone picker should have focus and show the selected zone.
5. Follow **Find parking** while signed out, open visitor registration, and switch to password recovery. With a driver session, verify the board against the authenticated snapshot and use **View campus** to select a zone on the live map.
6. Operate the zone picker and directory with the keyboard. Use the existing app checks for offline status, eligibility, claims, release, and officer permissions when merging.

## Verification record

The Parking Atlas went live on 19 November 2026. Chrome verified the public site at 1440, 390, and 320 CSS pixels. The hosted zone picker, directory, Main Street trace, registration, and password recovery screens responded to input. The implementation passed the GitHub application, PostgreSQL, and production smoke checks. [Hosted app](https://uom-smart-parking.vercel.app/) · [Release run](https://github.com/nadija-smwg/uom-smart-parking/actions/runs/44405531132) · [HTML feature audit](../docs/campus-map-feature-audit.md)

The local production build, TypeScript, and campus fixture tests passed. Chrome exercised the atlas at 1440, 390, and 320 CSS pixels, including all-zone expansion, search, category filtering, focus return, zone wraparound, the road trace, and the reduced-motion state. A separate production run used two driver sessions, local PostgreSQL, and simulated authentication and realtime services. It covered the parking board, touch map, concurrent claims, releases, offline handling, and polling after a socket disconnect.

## Source files

### scripts/campus.mjs

<!-- atlas-file: scripts/campus.mjs -->

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";

// The live map and the printed plate use the same local campus coordinates.
const source = await readFile("data/campus.json");
const campus = JSON.parse(source);
const [width, height] = campus.size;
const scale = 2;
const canvas = createCanvas(width * scale, height * scale);
const ctx = canvas.getContext("2d");
ctx.scale(scale, scale);

function stroke(points, color, weight) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.stroke();
}

ctx.fillStyle = "#203a40";
ctx.fillRect(0, 0, width, height);
for (let x = 0; x < width; x += 24) {
  stroke([[x, 0], [x, height]], x % 120 ? "#294249" : "#365157", 0.8);
}
for (let y = 0; y < height; y += 24) {
  stroke([[0, y], [width, y]], y % 120 ? "#294249" : "#365157", 0.8);
}

// Engraving the playing field gives the oval a distinct surface at phone sizes.
const [cx, cy, rx, ry] = campus.playground;
ctx.save();
ctx.beginPath();
ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
ctx.fillStyle = "#809c89";
ctx.fill();
ctx.clip();
for (let x = cx - rx; x < cx + rx; x += 19) {
  ctx.fillStyle = "#779582";
  ctx.fillRect(x, cy - ry, 9.5, ry * 2);
}
for (const inset of [3, 8]) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - inset, ry - inset, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#c5cfb9";
  ctx.stroke();
}
ctx.restore();

ctx.lineJoin = "round";
ctx.lineCap = "round";
for (const [, weight, points] of campus.roads) stroke(points, "#112d33", weight + 6);
for (const [, weight, points] of campus.roads) stroke(points, "#c9c5aa", weight + 1);
ctx.setLineDash([7, 7]);
for (const [, weight, points] of campus.roads) {
  if (weight >= 8) stroke(points, "#65706b", 1.2);
}
ctx.setLineDash([]);

for (const [, x, y, w, h] of campus.buildings) {
  ctx.fillStyle = "#122b30";
  ctx.fillRect(x + 3, y + 4, w, h);
  ctx.fillStyle = "#80999a";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#cccfb9";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  for (let edge = x - h; edge <= x + w; edge += 8) {
    stroke([[edge, y + h], [edge + h, y]], "#6c8689", 1);
  }
  ctx.restore();
}

for (const { geometry: g } of campus.zones) {
  ctx.fillStyle = "#fb9a62";
  ctx.strokeStyle = "#fb9a62";
  ctx.save();
  if (g.type === "strip") {
    stroke(g.points, "#ff985d", Math.max(g.w, 5));
  } else if (g.type === "box") {
    ctx.translate(g.x, g.y);
    ctx.rotate(g.r * Math.PI / 180);
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.fillStyle = "#984e32";
    for (let col = 6; col < g.w - 2; col += 9) ctx.fillRect(col - g.w / 2, -g.h / 2 + 2, 1, g.h - 4);
  } else if (g.type === "polygon") {
    ctx.beginPath();
    ctx.moveTo(...g.points[0]);
    for (const point of g.points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

await mkdir("public", { recursive: true });
await writeFile("public/campus.json", source);
await writeFile("public/campus-atlas.webp", await canvas.encode("webp", 90));
```

### src/components/campus-plate.tsx

<!-- atlas-file: src/components/campus-plate.tsx -->

```tsx
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import source from "../../data/campus.json";
import { type Campus, type Category, type Geometry, type Point } from "@/lib/contracts";
import { zoneFocus } from "@/lib/map-geometry";

export type AtlasZone = { code: string; name: string; category: Category; capacity: number; geometry: Geometry };
// The fixture's positional tuples are also checked by tests/campus.test.mjs.
export const plan = source as unknown as Campus & { zones: AtlasZone[] };
const [width, height] = plan.size;

export function plotPosition([x, y]: Point): CSSProperties {
  return { left: (100 * x / width) + "%", top: (100 * y / height) + "%" };
}

export function ZoneLocator({ zone }: { zone: AtlasZone }) {
  const [x, y] = zoneFocus(zone.geometry).point;
  // A full-size transparent layer makes translate percentages match plan coordinates.
  return <div className="atlas-locator" aria-hidden="true"
    style={{ transform: "translate(" + (100 * x / width) + "%, " + (100 * y / height) + "%)" }}>
    <span className="locator-ring" key={zone.code} />
    <span className="locator-code" data-left={x > width * .76}>{zone.code}</span>
  </div>;
}

export function CampusPlate({ children, priority = false }: { children?: ReactNode; priority?: boolean }) {
  return <div className="atlas-plate">
    <Image src="/campus-atlas.webp" width={width * 2} height={height * 2} alt=""
      unoptimized preload={priority} className="atlas-print" />
    {children}
  </div>;
}
```

### src/components/street-trace.tsx

<!-- atlas-file: src/components/street-trace.tsx -->

```tsx
import { plan, plotPosition } from "./campus-plate";

// Each segment starts when the previous one finishes, at a constant map speed.
const road = plan.roads.find(([name]) => name === "UoM Main Street");
const points = road?.[2] ?? [];
const segments = points.slice(1).map(([x, y], i) => {
  const start = points[i];
  const dx = x - start[0];
  const dy = y - start[1];
  return { start, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
});
const total = segments.reduce((sum, part) => sum + part.length, 0);

export function StreetTrace() {
  let elapsed = 0;
  return <div className="street-trace" aria-hidden="true">
    {segments.map(({ start, length, angle }, i) => {
      const duration = 1100 * length / total;
      const delay = elapsed;
      elapsed += duration;
      return <i key={i} style={{ ...plotPosition(start), width: (100 * length / plan.size[0]) + "%",
        transform: "rotate(" + angle + "rad)" }}>
        <b style={{ animationDelay: delay + "ms", animationDuration: duration + "ms" }} />
      </i>;
    })}
  </div>;
}
```

### src/components/parking-atlas.tsx

<!-- atlas-file: src/components/parking-atlas.tsx -->

```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Crosshair, MapPin, Route, Search } from "lucide-react";
import { campusDirectionsUrl, categories, categoryDisplay } from "@/lib/contracts";
import { StreetTrace } from "./street-trace";
import { SiteBrand } from "./site-brand";
import { CampusPlate, plan, plotPosition, ZoneLocator } from "./campus-plate";

const zones = plan.zones;
const plannedSpaces = zones.reduce((sum, zone) => sum + zone.capacity, 0);
const firstPage = 5;
const landmarks = [
  { label: "Playground", code: "Z01", point: plan.playground.slice(0, 2) as [number, number] },
  ...[
    { label: "Hostels", building: "Girls Hostel", code: "Z05" },
    { label: "Library", building: "Library", code: "Z08" },
  ].flatMap(({ label, building, code }) => {
    const row = plan.buildings.find(([name]) => name === building);
    return row ? [{ label, code, point: [row[1] + row[3] / 2, row[2] + row[4] / 2] as [number, number] }] : [];
  }),
];

const mapLabels = plan.buildings.filter(([name]) => ["Sumanadasa Building", "Faculty of IT", "Administration"].includes(name));

export function ParkingAtlas({ demo }: { demo: boolean }) {
  const [selected, setSelected] = useState(zones[0].code);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [trace, setTrace] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const picker = useRef<HTMLSelectElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const index = zones.findIndex((zone) => zone.code === selected);
  const zone = zones[index];
  const term = query.trim().toLowerCase();
  const results = zones.filter((row) => (!category || row.category === category)
    && (row.code + " " + row.name).toLowerCase().includes(term));
  const visible = expanded ? results : results.slice(0, firstPage);

  function locate(code: string) {
    setSelected(code);
    picker.current?.focus({ preventScroll: true });
    sheet.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  function step(direction: number) {
    setSelected((current) => {
      const at = zones.findIndex((row) => row.code === current);
      return zones[(at + direction + zones.length) % zones.length].code;
    });
  }

  return <div className="atlas-home">
    <header className="atlas-mast atlas-width">
      <SiteBrand />
      <nav aria-label="Main navigation">
        <a className="atlas-directions" href={campusDirectionsUrl} referrerPolicy="no-referrer">Campus directions <ArrowUpRight size={16} /></a>
        <Link className="atlas-key" href="/account">Sign in <ArrowRight size={16} /></Link>
      </nav>
    </header>
    <main className="atlas-width">
      <div className="atlas-spread">
        <section className="atlas-cover" aria-labelledby="atlas-title">
          <p className="atlas-kicker"><span />University of Moratuwa</p>
          <h1 id="atlas-title" aria-label="Parking atlas"><span className="atlas-word"><b>Parking</b></span><span className="atlas-word"><b>atlas<i>.</i></b></span></h1>
          <p className="atlas-lead">Pick a zone on the Katubedda campus plan. Sign in to check which spaces fit your vehicle.</p>
          <div className="atlas-actions">
            <Link className="atlas-key orange" href="/parking">Find parking <ArrowRight size={19} /></Link>
            <a className="atlas-index-link" href="#zone-directory">Zone directory <ArrowDown size={15} /></a>
          </div>
          <dl className="atlas-totals">
            <div><dt>Parking zones</dt><dd>{zones.length}</dd></div>
            <div><dt>Planned spaces</dt><dd>{plannedSpaces}</dd></div>
          </dl>
        </section>

        <section ref={sheet} className="atlas-sheet" aria-labelledby="sheet-title">
          <div className="atlas-sheet-head"><h2 id="sheet-title"><Crosshair size={16} /> Campus plan</h2>
            <button className="trace-control" aria-pressed={trace} onClick={() => setTrace(!trace)}><Route size={15} /> Trace Main Street</button></div>
          <CampusPlate priority>
            {trace && <StreetTrace />}
            {mapLabels.map(([name, x, y, w, h]) => <span key={name} className="atlas-building-label" aria-hidden="true"
              style={plotPosition([x + w / 2, y + h / 2])}>{name}</span>)}
            {landmarks.map((landmark) => <button type="button" className="atlas-landmark" key={landmark.code}
              style={plotPosition(landmark.point)} data-edge={landmark.point[0] > plan.size[0] * .9} aria-label={"Locate " + landmark.label + " parking"}
              aria-pressed={selected === landmark.code} onClick={() => setSelected(landmark.code)}>
              <span>{landmark.label}</span>
            </button>)}
            <ZoneLocator zone={zone} />
            <div className="atlas-legend"><i /> Parking zone {trace && <span>UoM Main Street</span>}</div>
          </CampusPlate>
          <div className="atlas-slip">
            <span className="atlas-zone-code" aria-hidden="true">{zone.code}</span>
            <div className="atlas-zone-choice">
              <label className="sr-only" htmlFor="atlas-zone">Choose a parking zone</label>
              <select id="atlas-zone" ref={picker} value={selected} onChange={(event) => setSelected(event.target.value)}>
                {zones.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <p>{categoryDisplay[zone.category].label} · {zone.capacity} planned spaces</p>
            </div>
            <div className="atlas-turn">
              <button aria-label="Previous zone" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
              <button aria-label="Next zone" onClick={() => step(1)}><ChevronRight size={18} /></button>
            </div>
          </div>
          <p className="sr-only" role="status">{zone.code}, {zone.name}, {zone.capacity} planned spaces.</p>
        </section>
      </div>

      <section id="zone-directory" className="atlas-directory" aria-labelledby="directory-title">
        <div className="atlas-directory-head">
          <h2 id="directory-title">Zone directory</h2>
          <div className="atlas-filters">
            <label className="atlas-search"><Search size={16} aria-hidden="true" />
              <input type="search" aria-label="Search zones by name or code" placeholder="Search name or code"
                value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(false); }} />
            </label>
            <select aria-label="Parking category" value={category}
              onChange={(event) => { setCategory(event.target.value); setExpanded(false); }}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{categoryDisplay[item].label}</option>)}
            </select>
          </div>
        </div>
        <p className="sr-only" role="status">{results.length} matching zones</p>
        <ul className="atlas-index">
          {visible.map((row) => <li key={row.code}>
            <button onClick={() => locate(row.code)} aria-label={"Show " + row.code + " " + row.name + " on campus plan"}>
              <span className="index-code">{row.code}</span>
              <strong>{row.name}</strong><span className="index-kind">{categoryDisplay[row.category].label}</span>
              <span className="index-count">{row.capacity} planned</span><ArrowUpRight size={18} />
            </button>
          </li>)}
        </ul>
        {!results.length && <p className="atlas-empty">No matching zones. Try a different name or category.</p>}
        {results.length > firstPage && <button className="atlas-more" aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer zones" : "Show all " + results.length + " zones"}</button>}
      </section>
    </main>
    <footer className="atlas-foot atlas-width"><a href={campusDirectionsUrl} referrerPolicy="no-referrer"><MapPin size={14} /> Campus directions <ArrowUpRight size={13} /></a>
      {demo && <span>Student project · Demo data</span>}</footer>
  </div>;
}
```

### src/app/page.tsx

<!-- atlas-file: src/app/page.tsx -->

```tsx
import { ParkingAtlas } from "@/components/parking-atlas";

export default function Landing() {
  return <ParkingAtlas demo={process.env.APP_ENV !== "pilot"} />;
}
```

### src/app/account/page.tsx

<!-- atlas-file: src/app/account/page.tsx -->

```tsx
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
        {mode === "mfa" ? <MfaForm /> : <AccountForm reset={mode === "reset"} expired={error === "link"} />}
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
```

### src/components/parking-overview.tsx

<!-- atlas-file: src/components/parking-overview.tsx -->

```tsx
import { CampusPlate } from "./campus-plate";
import { ArrowRight, ArrowUpRight, Bell, Bike, CarFront, History, MapPin, SquareParking } from "lucide-react";
import { campusTime } from "@/lib/api";
import { categories, categoryDisplay, type Notice, type Session, type Zone } from "@/lib/contracts";

export function ParkingOverview({ name, zones, vehicleCount, active, notices, onFind, onMap, onSessions, onNotices }: {
  name: string;
  zones?: Zone[];
  vehicleCount: number;
  active: Session[];
  notices: Notice[];
  onFind: () => void;
  onMap: () => void;
  onSessions: () => void;
  onNotices: () => void;
}) {
  const available = zones?.reduce((sum, row) => sum + row.available, 0);

  return <div className="dashboard atlas-board">
    <header className="board-head">
      <div><p className="atlas-mono">Welcome, {name}</p><h1>Parking board</h1></div>
      <button className="atlas-key orange" onClick={onFind}>Find Parking <ArrowRight size={18} /></button>
    </header>
    <section className="board-ledger" aria-label="Parking at a glance">
      <div className="board-count">
        <h2>Available spaces</h2>
        <strong className="board-value" key={available ?? "pending"}>{available ?? "—"}</strong>
        <p>{zones ? "Across " + zones.length + " published zones" : "Waiting for campus availability"}</p>
      </div>
      <dl className="board-small-counts">
        <div><dt>Active sessions</dt><dd>{zones ? active.length : "—"}</dd></div>
        <div><dt>Registered vehicles</dt><dd>{zones ? vehicleCount : "—"}</dd></div>
      </dl>
      <button className="board-map" onClick={onMap} aria-label="View campus">
        <CampusPlate />
        <span>View campus <ArrowUpRight size={17} /></span>
      </button>
    </section>

    <div className="overview-grid">
      <section className="card availability-card">
        <div className="panel-heading">
          <div><h2>Campus availability</h2><p className="muted small">Based on manually reported parking activity.</p></div>
          <button className="text-action" onClick={onMap}>Open map <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {zones ? <ul className="availability-list">
          {categories.map((category) => {
            const rows = zones.filter((zone) => zone.category === category);
            const available = rows.reduce((sum, zone) => sum + zone.available, 0);
            const total = rows.reduce((sum, zone) => sum + zone.inventory, 0);
            const { label, color } = categoryDisplay[category];
            const Icon = category === "bicycles" ? Bike : category === "cars" ? CarFront : SquareParking;
            return <li key={category}>
              <span className="category-icon" style={{ color }}><Icon size={17} aria-hidden="true" /></span>
              <div className="availability-row">
                <div><span>{label}</span><span className="muted small"><strong>{available}</strong> of {total} open</span></div>
                <progress max={Math.max(total, 1)} value={available} aria-label={label + " availability"} />
              </div>
            </li>;
          })}
        </ul> : <p className="muted">Waiting for parking availability.</p>}
      </section>

      <div className="dashboard-secondary">
        <section className="card">
          <div className="panel-heading"><h2>Active parking</h2>
            <button className="text-action" onClick={onSessions}>{active.length ? "Manage active parking" : "View sessions"}
              <ArrowRight size={16} aria-hidden="true" />
            </button></div>
          {active.length ? active.map((session) => <div className="dashboard-record" key={session.id}>
            <span className="feature-icon"><MapPin size={18} aria-hidden="true" /></span>
            <div><h3>{session.zone_name}</h3><p className="small muted">{session.code} · {session.plate ?? session.kind}</p></div>
          </div>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="blue"><History size={18} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No active sessions. Your current parking space will appear here." : "Loading your parking sessions…"}</p>
          </div>}
        </section>
        <section className="card">
          <div className="panel-heading"><h2>Recent notices</h2>
            <button className="text-action" onClick={onNotices}>View notices <ArrowRight size={16} aria-hidden="true" /></button></div>
          {notices.length ? notices.slice(0, 3).map((notice) => <article className="dashboard-record" key={notice.id}>
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <div><h3>{notice.title}</h3><p className="small muted">{campusTime(notice.published_at)}</p></div>
          </article>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No current notices." : "Loading campus notices…"}</p>
          </div>}
        </section>
      </div>
    </div>
  </div>;
}
```

### src/app/layout.tsx

<!-- atlas-file: src/app/layout.tsx -->

```tsx
import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "leaflet/dist/leaflet.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
import "./atlas.css";
import { InstallSupport } from "@/components/install-support";

export const metadata: Metadata = {
  title: "UoM Smart Parking",
  description: "Find eligible parking at the University of Moratuwa campus.",
  applicationName: "UoM Smart Parking",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="atlas-site">{children}<InstallSupport /></body></html>;
}
```

### src/app/atlas.css

<!-- atlas-file: src/app/atlas.css -->

```css
.atlas-site {
  --ink: #202925;
  --paper: #f3f0e6;
  --surface: #fffcf3;
  --line: #cac8bb;
  --muted: #515a53;
  --action: #243d37;
  --action-hover: #162b26;
  --rail: #202d2b;
  --citron: #ff935a;
  --accent: #ed6b37;
  --display: "Barlow Condensed", Impact, sans-serif;
  --mono: ui-monospace, Consolas, monospace;
  background-color: var(--paper);
}
.atlas-width { width: min(91%, 90rem); margin-inline: auto; }
.atlas-site .brand-icon { border-radius: .22rem; background: var(--accent); color: #221e19; }
.atlas-site .site-brand { color: var(--ink); letter-spacing: -.035em; }
.atlas-site .rail-brand .site-brand { color: #fffdf3; }
.atlas-site :focus-visible { outline: 3px solid #a44218; outline-offset: 3px; }
.atlas-mast { display: flex; justify-content: space-between; align-items: center; gap: .75rem; min-height: 5rem; border-bottom: 1px solid var(--ink); }
.atlas-mast nav, .atlas-actions, .atlas-key, .atlas-index-link, .atlas-directions, .atlas-foot a {
  display: inline-flex; align-items: center; gap: .6rem;
}
.atlas-mast nav { gap: 1.5rem; flex: none; }
.atlas-mast .atlas-key { white-space: nowrap; }
.atlas-site .atlas-key {
  justify-content: center; min-height: 44px; padding: .7rem 1.15rem; border: 1px solid var(--ink);
  border-radius: .2rem; background: var(--ink); color: #fffdf3; font-size: .89rem; font-weight: 800; text-decoration: none;
}
.atlas-site .atlas-key.orange { min-height: 50px; background: var(--accent); color: #211e1b; border-color: #733d25; }
.atlas-site .atlas-key:hover { background: #34443b; }
.atlas-site .atlas-key.orange:hover { background: #ff925b; }
.atlas-directions, .atlas-index-link { min-height: 44px; font-size: .86rem; font-weight: 750; text-decoration: none; }
.atlas-index-link:hover, .atlas-directions:hover { text-decoration: underline; text-underline-offset: .25em; }
.atlas-spread { display: grid; grid-template-columns: minmax(0, .72fr) minmax(0, 1.28fr); align-items: center;
  gap: clamp(1.5rem, 4.5vw, 5.5rem); padding: clamp(2rem, 4.2vw, 4.7rem) 0; }
.atlas-cover { min-width: 0; }
.atlas-kicker, .atlas-mono, .atlas-sheet-head, .atlas-foot, .atlas-totals dt, .index-code, .index-count, .atlas-legend {
  font-family: var(--mono); font-size: .71rem; line-height: 1.4; letter-spacing: .06em; text-transform: uppercase;
}
.atlas-kicker { display: flex; gap: .6rem; align-items: center; font-weight: 700; }
.atlas-kicker span { width: 1.8rem; height: 3px; background: var(--accent); }
.atlas-cover h1, .atlas-directory h2, .pass-stub h2, .atlas-account .auth-card h1, .board-head h1 {
  font-family: var(--display); font-weight: 800; text-transform: uppercase; letter-spacing: -.035em;
}
.atlas-cover h1 { margin-block: 1.05rem 1.35rem; font-size: clamp(5.2rem, 9vw, 10rem); line-height: .81; }
.atlas-word, .atlas-word b { display: block; }
.atlas-word { overflow: clip; padding-bottom: .06em; }
.atlas-word b { font-weight: inherit; }
.atlas-word i, .pass-stub h2 span { color: var(--accent); font-style: normal; }
.atlas-lead { max-width: 26rem; color: #424c45; font-size: clamp(.96rem, 1.35vw, 1.12rem); }
.atlas-actions { flex-wrap: wrap; gap: .4rem 1.3rem; margin-block: 1.5rem; }
.atlas-totals { display: flex; gap: clamp(1.4rem, 4.2vw, 5rem); max-width: 26rem; padding-top: 1.05rem; border-top: 1px solid var(--line); }
.atlas-totals div { display: flex; flex-direction: column-reverse; gap: .1rem; }
.atlas-totals dt { color: var(--muted); font-size: .64rem; }
.atlas-totals dd { margin: 0; font: 800 2.65rem/.94 var(--display); font-variant-numeric: tabular-nums; }

.atlas-sheet { color: var(--ink); background: var(--surface); border: 1px solid #293b36; box-shadow: 5px 5px 0 #c7c8b9; }
.atlas-sheet-head, .atlas-slip { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
.atlas-sheet-head { padding-inline: .95rem; min-height: 2.8rem; border-bottom: 1px solid #283b36; }
.atlas-sheet-head h2 { display: flex; align-items: center; gap: .5rem; font: 700 .73rem/1.2 var(--mono); letter-spacing: .08em; }
.atlas-site .trace-control { background: transparent; border: 0; border-radius: .1rem; min-height: 44px; padding: .3rem; color: #384740; font: 650 .7rem/1.25 var(--mono); }
.atlas-site .trace-control[aria-pressed="true"] { color: #823c1a; text-decoration: underline; text-underline-offset: .25em; }
.atlas-plate { position: relative; isolation: isolate; overflow: hidden; background: #203a40; }
.atlas-plate { container-type: inline-size; }
.atlas-building-label { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; color: #f6f3dd; background: #213b3cce;
  padding: .12rem .28rem; font: 600 clamp(.5rem, 1.45cqw, .72rem)/1.1 var(--mono); pointer-events: none; }
@container (max-width: 470px) { .atlas-building-label { display: none; } }
.atlas-landmark[data-edge="true"] { transform: translate(-100%, -50%); }
.atlas-foot a { min-height: 44px; }
.atlas-print { display: block; width: 100%; height: auto; }
.atlas-landmark { position: absolute; z-index: 2; transform: translate(-50%, -50%); min-width: 44px; min-height: 44px; padding: 0; background: transparent; border: 0; }
.atlas-site .atlas-landmark, .atlas-site .atlas-landmark:hover, .atlas-site .atlas-landmark[aria-pressed="true"] { background: transparent; border: 0; }
.atlas-landmark span { display: block; padding: .21rem .38rem; background: #172f32; color: #ffffed; border: 1px solid #bec7b9;
  font: 650 clamp(.56rem, .85vw, .72rem)/1.1 var(--mono); white-space: nowrap; }
.atlas-landmark[aria-pressed="true"] span, .atlas-landmark:hover span { background: #f9e3be; color: #26332a; }
.atlas-site .atlas-plate :focus-visible { outline-color: #fff3b0; outline-offset: -2px; }
.atlas-locator { position: absolute; z-index: 3; inset: 0; pointer-events: none; }
.locator-ring { position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; border: 2px solid white; border-radius: 50%; background: #e86127; box-shadow: 0 0 0 2px #322d25; }
.locator-ring::after { content: ""; position: absolute; inset: -5px; border: 2px solid #ffd09a; border-radius: inherit; }
.locator-code { position: absolute; left: 12px; top: -12px; background: #f9e3be; color: #1b302e; border: 1px solid #28362e;
  padding: .1rem .35rem; font: 800 .7rem/1.6 var(--mono); }
.locator-code[data-left="true"] { left: auto; right: calc(100% + 12px); }
.atlas-legend { position: absolute; z-index: 3; left: .6rem; bottom: .55rem; display: flex; align-items: center; gap: .3rem; padding: .25rem .4rem;
  color: #fffdef; background: #172f32ed; text-transform: none; font-size: .64rem; pointer-events: none; }
.atlas-legend i { width: .6rem; height: .6rem; background: #fb9a62; }
.atlas-legend span::before { content: ""; display: inline-block; width: .7rem; height: 3px; margin: 0 .35rem; background: #ffe786; vertical-align: middle; }
.street-trace { position: absolute; inset: 0; pointer-events: none; }
.street-trace i { position: absolute; height: 0; transform-origin: left center; }
.street-trace b { position: absolute; inset: -2px 0 auto; height: 4px; border-radius: 2px; background: #ffe786; box-shadow: 0 0 0 1px #6b572d; transform-origin: left; }
.atlas-slip { padding: .7rem .85rem; min-height: 4.75rem; border-top: 1px solid var(--ink); }
.atlas-zone-code { padding: .4rem .5rem; min-width: 3.5rem; text-align: center; border: 1px solid #9d522b; background: #ffb183; font: 800 1.8rem/1 var(--display); }
.atlas-zone-choice { flex: 1; min-width: 0; }
.atlas-zone-choice select { min-height: 44px; padding: .2rem .15rem; border: 0; border-radius: .1rem; background: transparent; font-size: clamp(.91rem, 1.2vw, 1.13rem); font-weight: 800; }
.atlas-zone-choice p { color: var(--muted); font: 550 .69rem/1.4 var(--mono); }
.atlas-turn { display: flex; align-items: center; }
.atlas-turn button { min-width: 44px; min-height: 44px; padding: 0; border-radius: .1rem; border-color: #aaa99b; }
.atlas-turn button + button { margin-left: -1px; }

.atlas-directory { border-top: 2px solid var(--ink); padding: 1.6rem 0 2.2rem; scroll-margin-top: 1rem; }
.atlas-directory-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.2rem; }
.atlas-directory h2, .board-head h1 { font-size: clamp(2.3rem, 4vw, 4rem); line-height: .95; }
.atlas-filters { display: flex; align-items: center; gap: .55rem; }
.atlas-filters select, .atlas-search { min-height: 44px; border: 1px solid #a6a89b; border-radius: .15rem; background: var(--surface); font-size: .85rem; }
.atlas-filters select { width: auto; max-width: 13.2rem; }
.atlas-search { position: relative; display: flex; align-items: center; padding-inline: .65rem .2rem; flex: 1; }
.atlas-search input { min-height: 42px; padding: .4rem; border: 0; background: transparent; font-size: .85rem; }
.atlas-index { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.atlas-index li { border-bottom: 1px solid var(--line); }
.atlas-site .atlas-index button { display: grid; grid-template-columns: 3.5rem minmax(0, 1.3fr) minmax(0, 1fr) 6rem 1.2rem;
  gap: 1rem; align-items: center; width: 100%; min-height: 3.5rem; padding: .5rem .65rem; text-align: left;
  border: 0; border-radius: 0; background: transparent; color: var(--ink); }
.atlas-site .atlas-index button:hover, .atlas-site .atlas-index button:focus-visible { background: #e7e4d7; }
.index-code { font-weight: 750; }
.index-kind, .index-count, .atlas-empty { color: var(--muted); font-size: .83rem; font-weight: 550; }
.index-count { text-transform: none; letter-spacing: 0; }
.atlas-empty { padding: 1rem 0; }
.atlas-more { margin-top: .8rem; background: transparent; border-color: #a6a89b; border-radius: .2rem; font-size: .85rem; }
.atlas-foot { display: flex; justify-content: space-between; align-items: center; gap: .7rem; padding-block: 1rem; border-top: 1px solid var(--ink); color: var(--muted); font-size: .64rem; }

.atlas-account { min-height: 100svh; }
.atlas-pass { width: min(91%, 67rem); margin: clamp(2rem, 5vw, 6rem) auto; display: grid; grid-template-columns: 1.22fr .78fr;
  border: 1px solid var(--ink); background: var(--surface); box-shadow: 5px 5px 0 #c7c8b9; }
.pass-entry { display: grid; align-items: center; min-width: 0; padding: clamp(1.25rem, 3.5vw, 3rem); }
.atlas-account .auth-card h1 { font-size: clamp(2.9rem, 5vw, 4.65rem); line-height: .97; }
.atlas-account .auth-card input, .atlas-account .auth-card button { border-radius: .2rem; }
.atlas-account .auth-submit { background: var(--ink); }
.pass-stub { display: grid; align-content: space-between; gap: 1rem; min-width: 0; padding: clamp(1.2rem, 3vw, 2.3rem);
  border-left: 2px dashed #a8a68e; background: #223832; color: #fff9e8; }
.pass-stub h2 { font-size: clamp(3.1rem, 6vw, 6.2rem); line-height: .84; }
.pass-stub .atlas-plate { border-block: 1px solid #789286; }
.pass-stub a { display: flex; align-items: center; justify-content: space-between; min-height: 44px; gap: .7rem; color: inherit; font-weight: 750; }
.atlas-board { gap: 1.25rem; }
.board-head { display: flex; align-items: end; justify-content: space-between; gap: .8rem; flex-wrap: wrap; }
.board-head p { color: var(--muted); margin-bottom: .45rem; }
.board-ledger { display: grid; grid-template-columns: minmax(0, 1fr) minmax(8rem, .77fr) minmax(9.5rem, .9fr);
  border: 1px solid var(--ink); background: var(--surface); }
.board-count, .board-small-counts { padding: clamp(.9rem, 2.2vw, 1.6rem); }
.board-count h2, .board-small-counts dt { font: 700 .75rem/1.4 var(--mono); }
.board-value { display: block; font: 800 clamp(4rem, 6vw, 6.5rem)/1 var(--display); font-variant-numeric: tabular-nums; color: #a64621; }
.board-count p { font-size: .78rem; color: var(--muted); }
.board-small-counts { display: grid; align-content: center; gap: .65rem; border-left: 1px dashed #9a9c8f; }
.board-small-counts dd { margin: 0; font: 800 1.8rem/1 var(--display); }
.atlas-site .board-map { display: grid; grid-template-rows: 1fr auto; align-items: stretch; justify-content: stretch; gap: 0; overflow: hidden;
  padding: 0; border: 0; border-radius: 0; background: #203a40; color: #fff9e8; }
.board-map .atlas-print { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.board-map > span { display: flex; align-items: center; justify-content: space-between; padding: .6rem .85rem; font-size: .87rem; background: #172d2c; }
.atlas-site .app-layout .card { border-radius: .32rem; box-shadow: none; }
.atlas-site .app-nav button[aria-pressed="true"] { background: #ffc6a3; border-color: #b36c48; color: #30281f; }
.atlas-site .side-rail :focus-visible, .atlas-site .pass-stub :focus-visible { outline-color: #ffdca2; }

@media (max-width: 900px) {
  .atlas-spread { gap: 1.5rem; grid-template-columns: minmax(0, .76fr) minmax(0, 1.24fr); }
  .atlas-turn { flex-direction: column; }
  .atlas-turn button + button { margin: -1px 0 0; }
  .atlas-sheet-head { padding-inline: .6rem; }
}
@media (max-width: 720px) {
  .atlas-width, .atlas-pass { width: calc(100% - 2.2rem); }
  .atlas-mast { min-height: 4.25rem; }
  .atlas-mast nav { gap: .5rem; }
  .atlas-mast .atlas-directions { display: none; }
  .atlas-spread { grid-template-columns: 1fr; padding: 1.65rem 0 2rem; gap: 1.35rem; }
  .atlas-cover h1 { font-size: clamp(2.95rem, 14vw, 6rem); line-height: .86; margin-block: .75rem; }
  .atlas-word { display: inline-block; }
  .atlas-word + .atlas-word { margin-left: .14em; }
  .atlas-lead { font-size: .94rem; max-width: 30rem; }
  .atlas-actions { margin-block: .9rem 0; }
  .atlas-totals { display: none; }
  .atlas-turn { flex-direction: row; }
  .atlas-turn button + button { margin: 0 0 0 -1px; }
  .atlas-slip { gap: .4rem; padding: .5rem; }
  .atlas-zone-code { min-width: 2.6rem; padding: .3rem; font-size: 1.45rem; }
  .atlas-zone-choice p { font-size: .64rem; }
  .atlas-directory-head { align-items: stretch; flex-direction: column; }
  .atlas-filters select { max-width: 45%; }
  .atlas-site .atlas-index button { grid-template-columns: 2.3rem minmax(0, 1fr) 1.1rem; gap: .5rem; }
  .index-kind, .index-count { display: none; }
  .atlas-pass { grid-template-columns: 1fr; margin-block: 1.5rem; }
  .pass-stub { grid-template-columns: 1fr auto; align-items: center; border-left: 0; border-top: 2px dashed #a8a68e; }
  .pass-stub h2, .pass-stub .atlas-plate { display: none; }
  .pass-stub .atlas-mono { font-size: .62rem; }
  .pass-stub a { font-size: .79rem; }
  .board-ledger { grid-template-columns: 1fr 1fr; }
  .board-map { grid-column: 1 / -1; }
  .board-map .atlas-plate { height: 5.5rem; }
  .atlas-site .side-rail .app-nav :focus-visible { outline-color: #a44218; }
}
@media (max-width: 380px) {
  .atlas-mast .atlas-key { padding-inline: .7rem; }
  .atlas-actions { column-gap: .6rem; }
  .atlas-actions .atlas-key { padding-inline: .85rem; }
  .atlas-slip { flex-wrap: wrap; }
  .atlas-turn { justify-content: end; flex: 1 0 100%; }
  .atlas-mast .site-brand { gap: .4rem; font-size: .86rem; }
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes title-print { from { transform: translateY(.42em); } to { transform: none; } }
  @keyframes sheet-settle { from { transform: perspective(950px) rotateX(3deg) translateY(10px); } to { transform: none; } }
  @keyframes ring-settle { from { transform: scale(1.85); opacity: .4; } to { transform: scale(1); opacity: 1; } }
  @keyframes trace-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes count-change { from { transform: translateY(.09em); } to { transform: none; } }
  .atlas-word b { animation: title-print 430ms cubic-bezier(.2,.8,.2,1) both; }
  .atlas-word + .atlas-word b { animation-delay: 80ms; }
  .atlas-sheet, .atlas-pass { transform-origin: top center; animation: sheet-settle 520ms cubic-bezier(.2,.8,.2,1) both; }
  .atlas-locator { transition: transform 380ms cubic-bezier(.22,.82,.24,1); }
  .locator-ring::after { animation: ring-settle 360ms 300ms ease-out both; }
  .street-trace b { animation: trace-line linear both; }
  .board-value { animation: count-change 160ms ease-out; }
  .atlas-key svg, .atlas-index button > svg { transition: transform 150ms ease-out; }
  .atlas-key:hover svg, .atlas-key:focus-visible svg { transform: translateX(3px); }
  .atlas-index button:hover > svg { transform: translate(2px,-2px); }
}
```
