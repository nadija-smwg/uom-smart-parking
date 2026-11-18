import type { Geometry, MapFocus, Point, Space } from "./contracts";

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
