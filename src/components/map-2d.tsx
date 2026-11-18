"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MapFocus, Point } from "@/lib/contracts";
import { categoryDisplay } from "@/lib/contracts";
import { campusFocus, outline, spaceColor } from "@/lib/map-geometry";
import type { MapProps } from "./map-view";

const xy = ([x, y]: Point): L.LatLngTuple => [-y, x];
const safeText = (label: string) => Object.assign(document.createElement("span"), { textContent: label });

function fit(map: L.Map, { point: [x, y], size: [width, height] }: MapFocus) {
  map.fitBounds([xy([x - width / 2, y - height / 2]), xy([x + width / 2, y + height / 2])],
    { padding: [20, 20], animate: false });
}

export default function Map2D(props: MapProps) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const { campus, zones, spaces, selected, selectedSpace, focus, night, labels, onZone, onSpace } = props;
  const target = useRef<MapFocus>(focus ?? campusFocus(campus.size));
  useEffect(() => {
    if (!node.current) return;
    const instance = L.map(node.current, {
      crs: L.CRS.Simple, minZoom: -4, maxZoom: 4, zoomSnap: 0.25,
      trackResize: false,
      // Leaflet's zoom transition can finish after switching this view out.
      zoomAnimation: false,
    });
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
    const layout = L.layerGroup().addTo(instance);
    const [px, py, rx, ry] = campus.playground;
    const yard = Array.from({ length: 36 }, (_, i) => {
      const angle = i * 2 * Math.PI / 36;
      return xy([px + Math.cos(angle) * rx, py + Math.sin(angle) * ry]);
    });
    L.polygon(yard, { color: "#789263", fillColor: "#8ea878", fillOpacity: 1, interactive: false }).addTo(layout);
    for (const [name, width, points] of campus.roads) {
      const road = L.polyline(points.map(xy), { color: night ? "#8294a7" : "#a59f92", weight: width / 2 });
      if (labels) road.bindTooltip(safeText(name));
      road.addTo(layout);
    }
    for (const [name, x, y, w, h, , visible] of campus.buildings) {
      const building = L.rectangle([xy([x, y]), xy([x + w, y + h])], {
        color: night ? "#5b7290" : "#ad9d87", weight: 1,
        fillColor: night ? "#788ca2" : "#e9d9c3", fillOpacity: 1,
      });
      if (labels && visible) building.bindTooltip(safeText(name));
      building.addTo(layout);
    }
    return () => { layout.remove(); };
  }, [campus, night, labels]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const parking = L.layerGroup().addTo(instance);
    for (const zone of zones) {
      const color = categoryDisplay[zone.category].color;
      const active = zone.id === selected;
      const style = { color, weight: active ? 5 : 3, opacity: zone.open ? 1 : .45 };
      const shape = zone.geometry.type === "strip"
        ? L.polyline(zone.geometry.points.map(xy), { ...style, weight: Math.max(zone.geometry.w, 7) + (active ? 3 : 0) })
        : L.polygon(outline(zone.geometry).map(xy), { ...style, fillOpacity: zone.open ? .6 : .2 });
      shape.bindTooltip(safeText(zone.code + " · " + zone.name)).on("click", () => onZone(zone.id)).addTo(parking);
    }
    let activeMarker: L.CircleMarker | undefined;
    for (const space of spaces.filter((row) => row.zone_id === selected)) {
      const color = spaceColor(space);
      const active = space.id === selectedSpace;
      const marker = L.circleMarker(xy([space.x, space.y]), {
        color: active ? "#fff5d1" : color, fillColor: color, fillOpacity: 1, radius: active ? 6 : 4, weight: 2,
      })
        .bindTooltip(safeText(space.code)).on("click", () => onSpace(space.id)).addTo(parking);
      if (active) activeMarker = marker;
    }
    activeMarker?.bringToFront();
    return () => { parking.remove(); };
  }, [zones, spaces, selected, selectedSpace, onZone, onSpace]);

  return <div ref={node} className="map-leaflet" style={{ background: night ? "#293949" : "#e0e8d4" }} />;
}
