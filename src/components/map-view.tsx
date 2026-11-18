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
