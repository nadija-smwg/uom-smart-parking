# Phase 3. Campus geometry and responsive 2D map

The bundled fixture transcribes the playground, 30 buildings, 16 roads, and 27 proposed zones from the campus HTML. The demo creates 440 approximate spaces and sample access rules from the project brief. Playground Car Park and Mill Road Bike Bay permit visitors in the relevant vehicle categories for testing. The campus references below were checked on 18 November 2026. The inventory, eligibility, and space placements still need campus verification. [Supplied campus HTML](<../docs/UoM Smart Parking – 3D Campus Map-4.html>)

## Public campus references

| Source | What it supports |
| --- | --- |
| [UoM official contact page](https://uom.lk/contact) | The campus destination is University of Moratuwa, Bandaranayake Mawatha, Moratuwa 10400. Use this address for the external campus-directions link. |
| [UoM Electrical Engineering aerial reference](https://uom.lk/elect/sumanadasa-building) | Confirms Sumanadasa Building and identifies landmarks including the Library, Administration, L-Block, hostels, and the Civil Engineering Complex. |
| [2024 R4TLI conference venue map](https://slstl.lk/wp-content/uploads/2024/06/R4TLI-2024-DTCP-UoM-Map.pdf) | The illustrated Katubedda campus plan shows the University Ground, Library, Administrative Building, Back Gate, Bolgoda Lake, a separate pedestrian approach, a vehicle entrance near the main entrance, and generic parking markers. Use it for orientation and label checks. |
| [Google Maps directions to the campus](https://www.google.com/maps/dir/?api=1&destination=University%20of%20Moratuwa%2C%20Bandaranayake%20Mawatha%2C%20Moratuwa%2010400%2C%20Sri%20Lanka) | Opens directions to the campus address. The app uses a Maps URL, which needs no API key. [Google Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started) |

The R4TLI map is for a specific event and its parking markers show general locations. Current gate access, permits, stall counts, and the numbered zones require separate verification. The named `UoM_Parking_Map_A3-2.pdf` was not located in the public results reviewed. The supplied diagram remains the source for local map geometry. Use the schematic entrance and landmark choices for ranking, and the Google Maps link for directions to the campus address. For pilot geometry, use a UoM-approved survey or appropriately licensed spatial data with attribution and an on-site check. [OpenStreetMap data licensing](https://www.openstreetmap.org/copyright)

Leaflet draws the HTML's top-down campus layout in local coordinates. The campus boundary, playing field, road widths, and building footprints are rendered beneath the live zone and space layers. Use **Overview** to frame the campus again. Search for a zone, building, or road, or choose a space with the keyboard from the selected zone's details. On touch screens, drag to pan and pinch to zoom. The zone list works independently of the map. [Leeward design brief](01-foundation.md#leeward-design-brief) · [Leaflet local map coordinates](https://leafletjs.com/examples-v1/crs-simple/crs-simple.html)

Set `APP_ENV=demo` and confirm that `DATABASE_URL` points to the demo project's restricted runtime login. Enable `CONFIRM_DEMO_SEED` for the seed command. Seeding requires empty zone inventory. `npm run assets` generates the public campus asset and icons. The development and build commands run it automatically.

```powershell
$env:CONFIRM_DEMO_SEED = 'yes'
try { npm run db:seed } finally { Remove-Item Env:CONFIRM_DEMO_SEED }
npm run assets
npm test
npm run build
```

The diagram's `x` increases right and `y` increases down. Zone geometry supports rotated boxes, strips, and polygons. Individual demo spaces use local points. Distance ranking uses diagram units from a selected entrance or landmark. GPS positioning and verified turn-by-turn guidance require a geographic alignment and a routable campus network.

The shared map shows campus inventory. **Find Parking** recommends spaces based on the user's account role or grant and selected vehicle type. Demo role and vehicle rules are examples for testing. Use approved campus rules for real access decisions.

For the pilot, record the drawing or survey version, trusted coordinate source, check date, and verifier for each zone. Match several identifiable control points across the campus, then check separate points on site before enabling position-based directions. Record usable gates, permitted travel directions, and signed space counts with Campus Security. Keep web-source links with this evidence so later edits can be traced.

**Exit check** Verify that the campus plan matches the HTML and that the map and zone list agree on the selected space and its status. Try pinch and pan on a narrow touchscreen, and select an available space with the keyboard list. Confirm the public directions link opens the UoM campus address and passes no parking or account data to Google Maps.

## Map verification

The feature-by-feature comparison covers simulated traffic, occupancy pins, nearest free, saved spots, notices, and 3D presentation differences. [HTML feature audit](../docs/campus-map-feature-audit.md)

The HTML and bundled fixture match on campus bounds, playground coordinates, all 30 building footprints, all 16 roads, and all 27 zone geometries. The Google Maps link uses the university address and the Maps API version.

The production build and campus tests passed. Chrome rendered the 2D plan with WebGL disabled at desktop and phone widths, including 320 CSS pixels and phone landscape. Browser checks covered touch pan and pinch, road and building search, category filtering, keyboard selection, map taps, day and night themes, and labels. Two signed-in drivers verified the claim and release flow against an isolated database with the demo inventory.

Physical phone testing and signed-in testing against the hosted API remain for the deployment checklist.

## Demo inventory verification

A read-only check of the hosted demo database matched all zone geometries and proposed capacities against the fixture. The stored spaces have unique codes and are marked as unverified. Visitor rules cover cars and vans in Z01 and motorcycles in Z11.

| Category | Spaces |
| --- | ---: |
| Cars and vans | 100 |
| Motorcycles | 250 |
| Bicycles | 50 |
| University vehicles | 20 |
| Other and unassigned | 20 |

## Complete source files

### `data/campus.json`

<!-- file: data/campus.json -->

```json
{
  "coordinateVersion": 1,
  "size": [1022,742],
  "playground": [385,128,130,105],
  "buildings": [
    ["Sumanadasa Building",435,300,205,85,26,1],
    ["UoM Gym",548,185,82,42,14,1],
    ["Textile & Apparel Eng.",710,65,120,85,22,1],
    ["Fashion & Product Design",795,5,100,50,18,1],
    ["Transport & Logistics",775,145,75,65,16,1],
    ["L Building",682,185,100,50,16,1],
    ["Faculty of Business",690,228,60,38,14,1],
    ["Faculty of IT",780,250,75,65,16,1],
    ["Electronic & Telecom",705,352,100,72,20,1],
    ["Wala Canteen",375,296,65,50,9,1],
    ["Aeronautical Lab",283,303,70,45,10,1],
    ["Earth Resources Eng.",385,402,90,60,14,1],
    ["Workshops",233,383,115,85,12,0],
    ["Goda Canteen",490,405,40,60,9,1],
    ["Food Court",570,420,60,70,10,1],
    ["Examination Hall",790,478,60,52,12,1],
    ["New Auditorium",830,440,48,48,16,1],
    ["Faculty of Medicine",805,545,70,38,12,1],
    ["Library",645,585,72,78,22,1],
    ["Architecture",752,578,58,80,18,1],
    ["Town & Country Planning",752,668,62,56,12,1],
    ["Administration",470,598,150,36,12,1],
    ["Graduate Studies",640,520,40,36,10,1],
    ["Girls Hostel",950,305,60,60,16,1],
    ["Boys Hostel",895,262,40,28,14,0],
    ["CE Research Lab",930,122,60,38,12,1],
    ["Block A",210,490,100,22,10,0],
    ["Block B",255,520,95,26,10,0],
    ["Block C",350,470,120,22,10,0],
    ["Admin Annex",590,510,40,60,12,0]
  ],
  "roads": [
    ["Mill Road",13,[[228,0],[222,100],[215,300],[210,400],[190,520],[140,620],[125,742]]],
    ["Katubedda–Kospelena Road",20,[[0,522],[150,560],[330,610],[480,652],[640,712],[740,742]]],
    ["Sumanadasa Front Road",8,[[235,375],[325,385],[560,402],[635,412]]],
    ["UoM Main Street",10,[[630,692],[635,560],[640,410],[650,300],[665,190],[685,40],[700,25],[790,28],[840,0]]],
    ["Playground Road",6,[[290,272],[640,298]]],
    ["Link Road",6,[[645,302],[740,322]]],
    ["North-East Avenue",7,[[640,405],[720,340],[800,272],[870,225],[915,218]]],
    ["Research Lane",6,[[858,0],[864,120],[866,225]]],
    ["Hostel Road",6,[[868,120],[1022,98]]],
    ["Exam Hall Road",7,[[640,448],[720,482],[800,525],[825,528]]],
    ["Auditorium Loop",6,[[775,448],[840,420],[880,380],[912,350]]],
    ["Library Ring",7,[[630,692],[700,700],[790,706],[880,650],[960,690],[1022,712]]],
    ["Engineering Back Road",6,[[225,380],[225,430],[235,545],[330,551],[450,566],[470,592],[468,625]]],
    ["Food Court Lane",5,[[538,497],[632,497]]],
    ["Siribara Manike Road",7,[[172,585],[180,660],[186,742]]],
    ["West Lane",5,[[100,130],[205,132]]]
  ],
  "origins": [
    {"id":"main-gate","name":"Main entrance (schematic)","x":630,"y":692},
    {"id":"mill-road","name":"Mill Road landmark","x":228,"y":0},
    {"id":"library","name":"Library","x":681,"y":624},
    {"id":"playground","name":"Playground","x":385,"y":128}
  ],
  "zones": [
    {"code":"Z01","name":"Playground Car Park","capacity":26,"category":"cars","geometry":{"type":"box","x":443,"y":257,"w":84,"h":24,"r":0}},
    {"code":"Z02","name":"Mill Road Car Bay","capacity":4,"category":"cars","geometry":{"type":"box","x":225,"y":318,"w":12,"h":24,"r":0}},
    {"code":"Z03","name":"Admin Car Park (E)","capacity":9,"category":"cars","geometry":{"type":"box","x":581,"y":540,"w":12,"h":60,"r":0}},
    {"code":"Z04","name":"Admin Car Park (S)","capacity":17,"category":"cars","geometry":{"type":"box","x":540,"y":572,"w":92,"h":14,"r":0}},
    {"code":"Z05","name":"Hostel Car Park","capacity":19,"category":"cars","geometry":{"type":"box","x":940,"y":92,"w":44,"h":34,"r":0}},
    {"code":"Z06","name":"Boys Hostel Bay","capacity":4,"category":"cars","geometry":{"type":"box","x":891,"y":240,"w":16,"h":16,"r":45}},
    {"code":"Z07","name":"Electronic Dept Car Park","capacity":8,"category":"cars","geometry":{"type":"box","x":680,"y":431,"w":24,"h":26,"r":0}},
    {"code":"Z08","name":"Library Roadside Bay","capacity":2,"category":"cars","geometry":{"type":"box","x":638,"y":612,"w":4,"h":42,"r":0}},
    {"code":"Z09","name":"Research Lane Bay","capacity":2,"category":"cars","geometry":{"type":"box","x":872,"y":170,"w":4,"h":34,"r":0}},
    {"code":"Z10","name":"Main Street Roadside","capacity":9,"category":"cars","geometry":{"type":"strip","points":[[685,44],[660,190]],"w":5}},
    {"code":"Z11","name":"Mill Road Bike Bay","capacity":15,"category":"motorcycles","geometry":{"type":"box","x":224,"y":347,"w":12,"h":14,"r":0}},
    {"code":"Z12","name":"Graduate Studies Bikes","capacity":16,"category":"motorcycles","geometry":{"type":"box","x":641,"y":553,"w":8,"h":22,"r":0}},
    {"code":"Z13","name":"Exam Hall Bikes A","capacity":27,"category":"motorcycles","geometry":{"type":"box","x":737,"y":474,"w":22,"h":14,"r":25}},
    {"code":"Z14","name":"Exam Hall Bikes B","capacity":27,"category":"motorcycles","geometry":{"type":"box","x":757,"y":486,"w":22,"h":14,"r":25}},
    {"code":"Z15","name":"Sumanadasa Front Bikes","capacity":74,"category":"motorcycles","geometry":{"type":"strip","points":[[323,385],[560,403],[635,412]],"w":5}},
    {"code":"Z16","name":"Engineering Back Bikes","capacity":28,"category":"motorcycles","geometry":{"type":"strip","points":[[330,558],[448,567]],"w":4}},
    {"code":"Z17","name":"Research Lane Bikes","capacity":22,"category":"motorcycles","geometry":{"type":"strip","points":[[858,6],[864,100]],"w":4}},
    {"code":"Z18","name":"NE Avenue Bikes","capacity":28,"category":"motorcycles","geometry":{"type":"strip","points":[[745,285],[850,236]],"w":4}},
    {"code":"Z19","name":"Exam Hall Road Bikes","capacity":13,"category":"motorcycles","geometry":{"type":"strip","points":[[765,503],[815,527]],"w":4}},
    {"code":"Z20","name":"Bicycle Rack","capacity":50,"category":"bicycles","geometry":{"type":"box","x":655,"y":481,"w":14,"h":26,"r":-8}},
    {"code":"Z21","name":"University Vehicles A","capacity":12,"category":"university","geometry":{"type":"box","x":514,"y":633,"w":48,"h":14,"r":0}},
    {"code":"Z22","name":"University Vehicles B","capacity":8,"category":"university","geometry":{"type":"box","x":602,"y":643,"w":32,"h":14,"r":0}},
    {"code":"Z23","name":"Reserved Bay 1","capacity":3,"category":"other","geometry":{"type":"box","x":514,"y":265,"w":22,"h":40,"r":0}},
    {"code":"Z24","name":"Reserved Bay 2","capacity":4,"category":"other","geometry":{"type":"box","x":543,"y":262,"w":30,"h":40,"r":0}},
    {"code":"Z25","name":"Reserved Bay 3","capacity":4,"category":"other","geometry":{"type":"box","x":572,"y":265,"w":30,"h":40,"r":0}},
    {"code":"Z26","name":"Reserved Bay 4","capacity":4,"category":"other","geometry":{"type":"box","x":603,"y":265,"w":30,"h":40,"r":0}},
    {"code":"Z27","name":"Playground Road Bay","capacity":5,"category":"other","geometry":{"type":"strip","points":[[290,272],[636,297]],"w":4}}
  ]
}
```

### `scripts/campus.mjs`

<!-- file: scripts/campus.mjs -->

```js
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public", { recursive: true });
await copyFile("data/campus.json", "public/campus.json");
```

### `scripts/seed.mjs`

<!-- file: scripts/seed.mjs -->

```js
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const { APP_ENV, DATABASE_URL: url, CONFIRM_DEMO_SEED } = process.env;
if (APP_ENV !== "demo" || CONFIRM_DEMO_SEED !== "yes" || !url)
  throw new Error("Set APP_ENV=demo, CONFIRM_DEMO_SEED=yes, and a DEMO runtime DATABASE_URL.");
const campus = JSON.parse(await readFile("data/campus.json", "utf8"));
const ca = process.env.DATABASE_SSL_CA?.trim();
const ssl = ca ? { ca, rejectUnauthorized: true } : undefined;
const db = postgres(url, { max: 1, prepare: false, ssl });
const kinds = { cars: ["car", "van"], motorcycles: ["motorcycle"], bicycles: ["bicycle"], university: ["university"], other: ["other"] };
const baseRoles = ["student", "lecturer", "staff", "officer", "admin"];

function point(geometry, index, count) {
  if (geometry.type === "box") {
    const { x, y, w, h, r } = geometry;
    const cols = Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count * w / h))));
    const rows = Math.ceil(count / cols);
    const dx = ((index % cols + .5) / cols - .5) * w;
    const dy = ((Math.floor(index / cols) + .5) / rows - .5) * h;
    const angle = r * Math.PI / 180;
    return [x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle)];
  }
  const parts = geometry.points.slice(1).map((b, i) => {
    const a = geometry.points[i];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  let offset = parts.reduce((sum, part) => sum + part.length, 0) * (index + .5) / count;
  for (const part of parts) {
    if (offset <= part.length && part.length > 0) {
      const t = offset / part.length;
      return [part.a[0] + (part.b[0] - part.a[0]) * t, part.a[1] + (part.b[1] - part.a[1]) * t];
    }
    offset -= part.length;
  }
  return geometry.points.at(-1);
}

try {
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(190086043)`;
    if ((await tx`select id from app.zones limit 1`).length) throw new Error("Demo seed requires empty zone inventory.");
    for (const zone of campus.zones) {
      const [{ id }] = await tx`insert into app.zones(code,name,category,proposed_capacity,geometry,instructions)
        values (${zone.code},${zone.name},${zone.category},${zone.capacity},${tx.json(zone.geometry)},
          'Planning reference. Follow posted signs and officer instructions.') returning id`;
      const spaces = Array.from({ length: zone.capacity }, (_, i) => {
        const [x, y] = point(zone.geometry, i, zone.capacity);
        return { zone_id: id, code: zone.code + "-" + String(i + 1).padStart(3, "0"), x, y };
      });
      await tx`insert into app.spaces ${tx(spaces)}`;
      const roles = zone.category === "university" ? ["staff", "admin"] :
        zone.category === "other" ? [] : ["Z01", "Z11"].includes(zone.code) ? [...baseRoles, "visitor"] : baseRoles;
      for (const role of roles) for (const kind of kinds[zone.category]) {
        await tx`insert into app.access_rules(zone_id,role,kind) values (${id},${role},${kind})`;
      }
    }
    await tx`insert into app.parking_rules(title,body)
      values ('Manual parking reports','Confirm only once you have parked. End your session when you leave. Follow campus signage and security instructions.')`;
  });
  console.log("Loaded 27 proposed zones and 440 demo spaces.");
} finally {
  await db.end();
}
```

### `src/lib/contracts.ts`

<!-- file: src/lib/contracts.ts -->

```ts
export const roles = ["student", "lecturer", "staff", "visitor", "officer", "admin"] as const;
export const kinds = ["car", "van", "motorcycle", "bicycle", "university", "other"] as const;
export const categories = ["cars", "motorcycles", "bicycles", "university", "other"] as const;
export const states = ["open", "closed", "blocked", "under_review", "retired"] as const;
export const campusDirectionsUrl = "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent("University of Moratuwa, Bandaranayake Mawatha, Moratuwa 10400, Sri Lanka");
export type Role = typeof roles[number];
export type Kind = typeof kinds[number];
export type Category = typeof categories[number];

export type Point = [number, number];
export type MapFocus = { point: Point; size: Point };
export type Geometry =
  | { type: "box"; x: number; y: number; w: number; h: number; r: number }
  | { type: "strip"; points: Point[]; w: number }
  | { type: "polygon"; points: Point[] };
export type Campus = {
  coordinateVersion: number; size: Point; playground: [number, number, number, number];
  buildings: [string, number, number, number, number, number, number][];
  roads: [string, number, Point[]][]; origins: { id: string; name: string; x: number; y: number }[];
};

export type Zone = {
  id: string; code: string; name: string; category: Category; proposed_capacity: number;
  geometry: Geometry; instructions: string; open: boolean; published: boolean; verified: boolean;
  version: number; inventory: number; available: number; occupied: number;
};
export type Space = {
  id: string; zone_id: string; zone_name: string; zone_code: string; code: string; x: number; y: number;
  state: typeof states[number]; published: boolean; verified: boolean; version: number;
  occupied: boolean; available: boolean; eligible: boolean; updated_at: string;
};
export type Vehicle = { id: string; kind: Kind; plate: string | null; model: string; color: string };
export type Session = {
  id: string; started_at: string; ended_at: string | null; code: string; zone_name: string;
  kind: Kind; plate: string | null; stale?: boolean; verified_at?: string | null; user_name?: string;
};
export type Notice = { id: string; title: string; body: string; published_at: string; read_at: string | null };
export type Rule = { id: string; title: string; body: string };
export type Report = { id: string; kind: string; description: string; status: string; zone: string; space: string | null; resolution: string | null };
export type Profile = { id: string; name: string; role: Role; verified: boolean; registration: "campus" | "visitor" };

export const categoryDisplay: Record<Category, { label: string; color: string }> = {
  cars: { label: "Cars and vans", color: "#b94d43" },
  motorcycles: { label: "Motorcycles", color: "#4775a4" },
  bicycles: { label: "Bicycles", color: "#ba5d83" },
  university: { label: "University vehicles", color: "#333b40" },
  other: { label: "Other and unassigned", color: "#4d7d52" },
};
```

### `src/lib/map-geometry.ts`

<!-- file: src/lib/map-geometry.ts -->

```ts
import type { Geometry, MapFocus, Point, Space, Zone } from "./contracts";

export function zoneStatus(zone: Pick<Zone, "open" | "inventory" | "available" | "occupied">) {
  if (!zone.open) return { label: "Closed", color: "#637080" };
  if (!zone.inventory) return { label: "No inventory", color: "#637080" };
  if (!zone.available) return zone.occupied === zone.inventory
    ? { label: "Full", color: "#b4413d" } : { label: "Unavailable", color: "#637080" };
  if (zone.available / zone.inventory < .4) return { label: "Filling", color: "#b06b08" };
  return { label: "Available", color: "#24784c" };
}

export function rankEligibleSpaces(spaces: Space[], origin?: { x: number; y: number }, byAvailability = false) {
  const eligible = spaces.filter((space) => space.available && space.eligible);
  const counts = new Map<string, number>();
  if (byAvailability) {
    for (const space of eligible) counts.set(space.zone_id, (counts.get(space.zone_id) ?? 0) + 1);
  }
  const distance = (space: Space) => origin ? Math.hypot(space.x - origin.x, space.y - origin.y) : 0;
  return eligible.sort((a, b) => (counts.get(b.zone_id) ?? 0) - (counts.get(a.zone_id) ?? 0)
    || distance(a) - distance(b) || a.code.localeCompare(b.code));
}

export function spaceColor(space: Space): string {
  if (space.occupied) return "#ae413d";
  return space.available ? "#206c49" : "#667181";
}

export function outline(geometry: Exclude<Geometry, { type: "strip" }>): Point[] {
  if (geometry.type === "polygon") return geometry.points;
  const { x, y, r, w, h } = geometry;
  const angle = r * Math.PI / 180;
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Point[])
    .map(([dx, dy]) => [x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle)]);
}

export function campusFocus(size: Point): MapFocus {
  return { point: [size[0] / 2, size[1] / 2], size };
}

export function zoneFocus(geometry: Geometry): MapFocus {
  const points = geometry.type === "strip" ? geometry.points : outline(geometry);
  const x = points.map((point) => point[0]);
  const y = points.map((point) => point[1]);
  const left = Math.min(...x), right = Math.max(...x);
  const top = Math.min(...y), bottom = Math.max(...y);
  const padding = geometry.type === "strip" ? geometry.w : 0;
  return {
    point: [(left + right) / 2, (top + bottom) / 2],
    size: [Math.max(64, right - left + padding), Math.max(64, bottom - top + padding)],
  };
}
```

### `src/components/map-view.tsx`

<!-- file: src/components/map-view.tsx -->

```tsx
"use client";

import dynamic from "next/dynamic";
import { CarFront, Focus, Moon, Tag } from "lucide-react";
import { useState } from "react";
import type { Campus, MapFocus, Space, Zone } from "@/lib/contracts";

const Map2D = dynamic(() => import("./map-2d"), { ssr: false, loading: () => <p className="card" role="status">Loading map…</p> });

export type MapProps = {
  campus: Campus; zones: Zone[]; spaces: Space[]; selected: string; selectedSpace: string; focus: MapFocus | null;
  night: boolean; labels: boolean; traffic: boolean;
  onZone: (id: string) => void; onSpace: (id: string) => void; onDeselect: () => void;
};

export function MapView({ onOverview, ...props }: Omit<MapProps, "night" | "labels" | "traffic"> & { onOverview: () => void }) {
  const [night, setNight] = useState(false);
  const [labels, setLabels] = useState(true);
  const [traffic, setTraffic] = useState(false);
  return <div className="card map-card">
    <div className="map-tools" role="group" aria-label="Map controls">
      <button aria-pressed={night} onClick={() => setNight(!night)}><Moon size={16} aria-hidden="true" /> Night</button>
      <button aria-pressed={traffic} onClick={() => setTraffic(!traffic)}><CarFront size={16} aria-hidden="true" /> Demo traffic</button>
      <button aria-pressed={labels} onClick={() => setLabels(!labels)}><Tag size={16} aria-hidden="true" /> Labels</button>
      <button onClick={onOverview}><Focus size={16} aria-hidden="true" /> Overview</button>
    </div>
    <div className="map-frame" role="group" aria-label="University campus map">
      <Map2D {...props} night={night} labels={labels} traffic={traffic} />
    </div>
    <p className="map-hint">Drag to pan · Pinch or scroll to zoom{traffic && " · Traffic animation is simulated."}</p>
  </div>;
}
```

### `src/components/map-2d.tsx`

<!-- file: src/components/map-2d.tsx -->

```tsx
"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MapFocus, Point } from "@/lib/contracts";
import { categoryDisplay } from "@/lib/contracts";
import { campusFocus, outline, spaceColor, zoneFocus, zoneStatus } from "@/lib/map-geometry";
import type { MapProps } from "./map-view";

const xy = ([x, y]: Point): L.LatLngTuple => [-y, x];
const safeText = (label: string) => Object.assign(document.createElement("span"), { textContent: label });
const basePane = "campus-base";
const landmarkLabels = new Set(["Sumanadasa Building", "Faculty of IT", "Library"]);
const dayColors = {
  campus: "#f0ecdd", boundary: "#b5baa4", field: "#a3bf88", fieldEdge: "#819969",
  road: "#fffdf4", roadEdge: "#bbb59f", centerline: "#c0a76a", building: "#d3c9b7", buildingEdge: "#ab9b85",
};
const nightColors = {
  campus: "#24324b", boundary: "#536583", field: "#326846", fieldEdge: "#61916d",
  road: "#53617a", roadEdge: "#77869c", centerline: "#aabbd2", building: "#495a75", buildingEdge: "#8b9cb4",
};

function fit(map: L.Map, { point: [x, y], size: [width, height] }: MapFocus) {
  map.fitBounds([xy([x - width / 2, y - height / 2]), xy([x + width / 2, y + height / 2])],
    { padding: [20, 20], animate: false });
}

export default function Map2D(props: MapProps) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const { campus, zones, spaces, selected, selectedSpace, focus, night, labels, traffic, onZone, onSpace, onDeselect } = props;
  const target = useRef<MapFocus>(focus ?? campusFocus(campus.size));
  useEffect(() => {
    if (!node.current) return;
    const instance = L.map(node.current, {
      crs: L.CRS.Simple, minZoom: -4, maxZoom: 4, zoomSnap: 0.25,
      trackResize: false,
      // Theme and label changes replace the base layers together.
      fadeAnimation: false,
      // The Map tab can unmount the renderer during a zoom.
      zoomAnimation: false,
    });
    instance.createPane(basePane).style.zIndex = "350";
    const trafficPane = instance.createPane("campus-traffic");
    trafficPane.style.zIndex = "375";
    trafficPane.style.pointerEvents = "none";
    instance.createPane("zone-status").style.zIndex = "405";
    map.current = instance;
    fit(instance, target.current);
    const observer = new ResizeObserver(() => {
      instance.invalidateSize({ pan: false });
      fit(instance, target.current);
    });
    observer.observe(node.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    target.current = focus ?? campusFocus(campus.size);
    if (map.current) fit(map.current, target.current);
  }, [focus, campus.size]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.on("click", onDeselect);
    return () => { instance.off("click", onDeselect); };
  }, [onDeselect]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !traffic) return;
    const layer = L.layerGroup().addTo(instance);
    for (const [, width, points] of campus.roads) {
      if (width < 6 || points.length < 2) continue;
      for (const direction of [1, -1]) {
        const lane = points.map(([x, y], i) => {
          const [ax, ay] = points[Math.max(0, i - 1)];
          const [bx, by] = points[Math.min(points.length - 1, i + 1)];
          const offset = direction * width * .24 / (Math.hypot(bx - ax, by - ay) || 1);
          return xy([x - (by - ay) * offset, y + (bx - ax) * offset]);
        });
        L.polyline(direction > 0 ? lane : lane.reverse(), {
          pane: "campus-traffic", interactive: false, color: direction > 0 ? "#cc5c2e" : "#237f91",
          weight: 3, opacity: 1, dashArray: "6 66", lineCap: "round", className: "traffic-lane",
        }).addTo(layer);
      }
    }
    return () => { layer.remove(); };
  }, [campus.roads, traffic]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const layout = L.layerGroup().addTo(instance);
    const colors = night ? nightColors : dayColors;
    L.rectangle([xy([0, 0]), xy(campus.size)], {
      pane: basePane, color: colors.boundary, weight: 1, fillColor: colors.campus, fillOpacity: 1, interactive: false,
    }).addTo(layout);

    const [px, py, rx, ry] = campus.playground;
    const yard = Array.from({ length: 48 }, (_, i) => {
      const angle = i * 2 * Math.PI / 48;
      return xy([px + Math.cos(angle) * rx, py + Math.sin(angle) * ry]);
    });
    const field = L.polygon(yard, {
      pane: basePane, color: colors.fieldEdge, weight: 1, fillColor: colors.field, fillOpacity: 1, interactive: false,
    }).addTo(layout);
    if (labels) field.bindTooltip(safeText("Playground"), { permanent: true, direction: "center", className: "map-landmark", opacity: 1 });

    const roads = campus.roads.map(([name, width, points]) => {
      const path = points.map(xy);
      const edge = L.polyline(path, { pane: basePane, color: colors.roadEdge, interactive: false }).addTo(layout);
      const road = L.polyline(path, { pane: basePane, color: colors.road }).addTo(layout);
      const centerline = L.polyline(path, {
        pane: basePane, color: colors.centerline, weight: 1, interactive: false,
      }).addTo(layout);
      if (labels) road.bindTooltip(safeText(name), { sticky: true });
      return { width, edge, road, centerline };
    });
    const fitRoadWidths = () => {
      const scale = instance.getZoomScale(instance.getZoom(), 0);
      for (const { width, edge, road, centerline } of roads) {
        const weight = Math.max(2, width * scale);
        edge.setStyle({ weight: weight + 1.5 });
        road.setStyle({ weight });
        centerline.setStyle({ opacity: weight > 3 ? .75 : 0, weight: Math.max(.65, .9 * scale) });
      }
    };
    fitRoadWidths();
    instance.on("zoomend", fitRoadWidths);

    const secondaryLabels: { building: L.Rectangle; name: string }[] = [];
    for (const [name, x, y, w, h, , visible] of campus.buildings) {
      const building = L.rectangle([xy([x, y]), xy([x + w, y + h])], {
        pane: basePane, color: colors.buildingEdge, weight: 1, fillColor: colors.building, fillOpacity: 1,
      }).addTo(layout);
      if (!labels || !visible) continue;
      if (landmarkLabels.has(name)) {
        building.bindTooltip(safeText(name), { permanent: true, direction: "center", className: "map-landmark", opacity: 1 });
      } else secondaryLabels.push({ building, name });
    }
    let detailed: boolean | undefined;
    const updateLabels = () => {
      const showNames = instance.getZoom() >= 1;
      if (detailed === showNames) return;
      detailed = showNames;
      for (const { building, name } of secondaryLabels) {
        building.unbindTooltip().bindTooltip(safeText(name), showNames
          ? { permanent: true, direction: "center", className: "map-detail-label", opacity: 1 }
          : { sticky: true });
      }
    };
    updateLabels();
    instance.on("zoomend", updateLabels);
    return () => { instance.off("zoomend", fitRoadWidths); instance.off("zoomend", updateLabels); layout.remove(); };
  }, [campus, night, labels]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const parking = L.layerGroup().addTo(instance);
    const strips: { path: L.Path; width: number; selected: boolean }[] = [];
    for (const zone of zones) {
      const color = categoryDisplay[zone.category].color;
      const active = zone.id === selected;
      const style = { color, weight: active ? 5 : 3, opacity: zone.open ? 1 : .45, bubblingMouseEvents: false };
      const { geometry } = zone;
      const shape = geometry.type === "strip"
        ? L.polyline(geometry.points.map(xy), { ...style, lineCap: "butt" })
        : L.polygon(outline(geometry).map(xy), { ...style, fillOpacity: zone.open ? .6 : .2 });
      if (geometry.type === "strip") strips.push({ path: shape, width: geometry.w, selected: active });
      shape.bindTooltip(safeText(zone.code + " · " + zone.name)).on("click", () => onZone(zone.id)).addTo(parking);
      const status = zoneStatus(zone);
      if (!active) {
        L.circleMarker(xy(zoneFocus(geometry).point), {
          pane: "zone-status", radius: 5, color: "#fffdf4", weight: 1.5, fillColor: status.color, fillOpacity: 1,
          bubblingMouseEvents: false,
        }).bindTooltip(safeText(zone.name + " · " + status.label + " · " + zone.available + " open"))
          .on("click", () => onZone(zone.id)).addTo(parking);
      }
    }
    const fitStripWidths = () => {
      const scale = instance.getZoomScale(instance.getZoom(), 0);
      for (const strip of strips) strip.path.setStyle({ weight: Math.max(4, strip.width * scale) + (strip.selected ? 2 : 0) });
    };
    fitStripWidths();
    instance.on("zoomend", fitStripWidths);
    let activeMarker: L.CircleMarker | undefined;
    for (const space of spaces.filter((row) => row.zone_id === selected)) {
      const color = spaceColor(space);
      const active = space.id === selectedSpace;
      const marker = L.circleMarker(xy([space.x, space.y]), {
        color: active ? "#fff5d1" : color, fillColor: color, fillOpacity: 1, radius: active ? 6 : 4, weight: 2,
        bubblingMouseEvents: false,
      })
        .bindTooltip(safeText(space.code)).on("click", () => onSpace(space.id)).addTo(parking);
      if (active) activeMarker = marker;
    }
    activeMarker?.bringToFront();
    return () => { instance.off("zoomend", fitStripWidths); parking.remove(); };
  }, [zones, spaces, selected, selectedSpace, onZone, onSpace]);

  return <div ref={node} className="map-leaflet" data-theme={night ? "night" : "day"} />;
}
```
