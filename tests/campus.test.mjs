import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { campusFocus, outline, zoneFocus } from "../src/lib/map-geometry.ts";

const campus = JSON.parse(await readFile(new URL("../data/campus.json",import.meta.url),"utf8"));
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
