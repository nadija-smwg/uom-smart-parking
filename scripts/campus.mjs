import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";

// The live map and the printed plate use the same local campus coordinates.
const source = await readFile("data/campus.json");
const campus = JSON.parse(source);
const [width, height] = campus.size;
const scale = 2;
const canvas = createCanvas(width * scale, height * scale);
const ctx = canvas.getContext("2d");
ctx.scale(scale, scale);

function stroke(points, color, weight) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.stroke();
}

ctx.fillStyle = "#203a40";
ctx.fillRect(0, 0, width, height);
for (let x = 0; x < width; x += 24) {
  stroke([[x, 0], [x, height]], x % 120 ? "#294249" : "#365157", 0.8);
}
for (let y = 0; y < height; y += 24) {
  stroke([[0, y], [width, y]], y % 120 ? "#294249" : "#365157", 0.8);
}

// Engraving the playing field gives the oval a distinct surface at phone sizes.
const [cx, cy, rx, ry] = campus.playground;
ctx.save();
ctx.beginPath();
ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
ctx.fillStyle = "#809c89";
ctx.fill();
ctx.clip();
for (let x = cx - rx; x < cx + rx; x += 19) {
  ctx.fillStyle = "#779582";
  ctx.fillRect(x, cy - ry, 9.5, ry * 2);
}
for (const inset of [3, 8]) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - inset, ry - inset, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#c5cfb9";
  ctx.stroke();
}
ctx.restore();

ctx.lineJoin = "round";
ctx.lineCap = "round";
for (const [, weight, points] of campus.roads) stroke(points, "#112d33", weight + 6);
for (const [, weight, points] of campus.roads) stroke(points, "#c9c5aa", weight + 1);
ctx.setLineDash([7, 7]);
for (const [, weight, points] of campus.roads) {
  if (weight >= 8) stroke(points, "#65706b", 1.2);
}
ctx.setLineDash([]);

for (const [, x, y, w, h] of campus.buildings) {
  ctx.fillStyle = "#122b30";
  ctx.fillRect(x + 3, y + 4, w, h);
  ctx.fillStyle = "#80999a";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#cccfb9";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  for (let edge = x - h; edge <= x + w; edge += 8) {
    stroke([[edge, y + h], [edge + h, y]], "#6c8689", 1);
  }
  ctx.restore();
}

for (const { geometry: g } of campus.zones) {
  ctx.fillStyle = "#fb9a62";
  ctx.strokeStyle = "#fb9a62";
  ctx.save();
  if (g.type === "strip") {
    stroke(g.points, "#ff985d", Math.max(g.w, 5));
  } else if (g.type === "box") {
    ctx.translate(g.x, g.y);
    ctx.rotate(g.r * Math.PI / 180);
    ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.fillStyle = "#984e32";
    for (let col = 6; col < g.w - 2; col += 9) ctx.fillRect(col - g.w / 2, -g.h / 2 + 2, 1, g.h - 4);
  } else if (g.type === "polygon") {
    ctx.beginPath();
    ctx.moveTo(...g.points[0]);
    for (const point of g.points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

await mkdir("public", { recursive: true });
await writeFile("public/campus.json", source);
await writeFile("public/campus-atlas.webp", await canvas.encode("webp", 90));
