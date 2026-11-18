"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Campus, MapFocus, Space, Zone } from "@/lib/contracts";

const View2D = dynamic(() => import("./map-2d"), { ssr: false, loading: () => <p className="card">Loading map…</p> });
const View3D = dynamic(() => import("./map-3d"), { ssr: false, loading: () => <p className="card">Loading 3D campus…</p> });

export type MapProps = {
  campus: Campus; zones: Zone[]; spaces: Space[]; selected: string; selectedSpace: string; focus: MapFocus | null;
  night: boolean; labels: boolean; onZone: (id: string) => void; onSpace: (id: string) => void;
};

export function MapView({ onOverview, ...props }: Omit<MapProps, "night" | "labels"> & { onOverview: () => void }) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [failed, setFailed] = useState(false);
  const [night, setNight] = useState(false);
  const [labels, setLabels] = useState(true);
  return <div>
    <div className="map-tools" role="group" aria-label="Map controls">
      <button aria-pressed={mode === "3d" && !failed} disabled={failed} onClick={() => setMode("3d")}>3D campus</button>
      <button aria-pressed={mode === "2d" || failed} onClick={() => setMode("2d")}>2D map</button>
      <button aria-pressed={night} onClick={() => setNight(!night)}>Night</button>
      <button aria-pressed={labels} onClick={() => setLabels(!labels)}>Labels</button>
      <button onClick={onOverview}>Overview</button>
    </div>
    {failed && <p role="status">Using the 2D view because 3D is unavailable on this device.</p>}
    <div className="map-frame" role="group" aria-label="University campus map">
      {mode === "3d" && !failed
        ? <View3D {...props} night={night} labels={labels} onFailure={() => setFailed(true)} />
        : <View2D {...props} night={night} labels={labels} />}
    </div>
  </div>;
}
