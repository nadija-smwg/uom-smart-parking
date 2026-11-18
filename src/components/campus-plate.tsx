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
