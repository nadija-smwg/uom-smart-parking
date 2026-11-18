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
