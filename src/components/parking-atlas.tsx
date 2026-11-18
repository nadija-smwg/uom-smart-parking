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
