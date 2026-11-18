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
