import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { campusFocus, outline, rankEligibleSpaces, zoneFocus, zoneStatus } from "../src/lib/map-geometry.ts";

const campus = JSON.parse(await readFile(new URL("../data/campus.json",import.meta.url),"utf8"));
test("2D geometry agrees with every road, building and parking shape in the supplied HTML", async () => {
  const html = await readFile(new URL("../docs/UoM Smart Parking – 3D Campus Map-4.html", import.meta.url), "utf8");
  function rows(name) {
    const match = html.match(new RegExp("const " + name + "=(\\[[^;]+\\]);"));
    assert.ok(match, name);
    return JSON.parse(match[1].replaceAll("'", '"'));
  }
  assert.deepEqual(campus.buildings, rows("BD"));
  assert.deepEqual(campus.roads, rows("ROADS"));
  const category = { car: "cars", bike: "motorcycles", cycle: "bicycles", uni: "university", other: "other" };
  const expected = new Map();
  for (const [type, name, x, y, w, h, r] of rows("PB"))
    expected.set(name, { category: category[type], geometry: { type: "box", x, y, w, h, r } });
  for (const [type, name, points, w] of rows("PS"))
    expected.set(name, { category: category[type], geometry: { type: "strip", points, w } });
  assert.equal(expected.size, campus.zones.length);
  for (const { name, category, geometry } of campus.zones) {
    assert.deepEqual({ category, geometry }, expected.get(name), name);
    expected.delete(name);
  }
  assert.equal(expected.size, 0);
});

test("availability pins handle the HTML filling threshold and operational closures", () => {
  const open = { open: true, inventory: 10, occupied: 6, available: 4 };
  assert.equal(zoneStatus(open).label, "Available");
  assert.equal(zoneStatus({ ...open, available: 3 }).label, "Filling");
  assert.equal(zoneStatus({ ...open, available: 0, occupied: 10 }).label, "Full");
  assert.equal(zoneStatus({ ...open, available: 0 }).label, "Unavailable");
  assert.equal(zoneStatus({ ...open, open: false }).label, "Closed");
  assert.equal(zoneStatus({ ...open, inventory: 0, available: 0, occupied: 0 }).label, "No inventory");
});

test("nearest free and availability ranking exclude ineligible and occupied spaces", () => {
  const space = { code: "A", zone_id: "west", x: 2, y: 0, available: true, eligible: true };
  const rows = [space, { ...space, x: 0, code: "B", eligible: false }, { ...space, x: 1, code: "C", available: false },
    { ...space, x: 4, code: "D", zone_id: "east" }, { ...space, x: 5, code: "E", zone_id: "east" }];
  assert.deepEqual(rankEligibleSpaces(rows, { x: 0, y: 0 }).map(s => s.code), ["A", "D", "E"]);
  assert.deepEqual(rankEligibleSpaces(rows, { x: 0, y: 0 }, true).map(s => s.code), ["D", "E", "A"]);
});
test("verified transcription of the planning reference", () => {
  assert.equal(campus.buildings.length,30);
  assert.equal(campus.roads.length,16);
  assert.equal(campus.zones.length,27);
  assert.equal(new Set(campus.zones.map((zone)=>zone.code)).size,27);
  const totals={};
  for (const zone of campus.zones) totals[zone.category]=(totals[zone.category]??0)+zone.capacity;
  assert.deepEqual(totals,{cars:100,motorcycles:250,bicycles:50,university:20,other:20});
});
test("local geometries and starting points contain usable coordinates", () => {
  for (const zone of campus.zones) {
    const shape=zone.geometry;
    if(shape.type==="box") assert.ok([shape.x,shape.y,shape.w,shape.h,shape.r].every(Number.isFinite) && shape.w>0 && shape.h>0);
    else assert.ok(shape.points.length>=2 && shape.points.every((point)=>point.length===2 && point.every(Number.isFinite)) && shape.w>0);
  }
  assert.equal(campus.origins[0].id,"main-gate");
});

test("the map frames the campus and the full extent of each selected zone", () => {
  assert.deepEqual(campusFocus(campus.size), { point: [511, 371], size: [1022, 742] });
  for (const { code, geometry } of campus.zones) {
    const { point: [x, y], size: [width, height] } = zoneFocus(geometry);
    const points = geometry.type === "strip" ? geometry.points : outline(geometry);
    for (const [px, py] of points) {
      assert.ok(Math.abs(px - x) <= width / 2 + 1e-8, code + " exceeds viewport width");
      assert.ok(Math.abs(py - y) <= height / 2 + 1e-8, code + " exceeds viewport height");
    }
  }
});
