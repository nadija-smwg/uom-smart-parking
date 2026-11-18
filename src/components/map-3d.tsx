"use client";

import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useEffect, useRef } from "react";
import { categoryDisplay, type MapFocus, type Point } from "@/lib/contracts";
import { campusFocus, outline, spaceColor } from "@/lib/map-geometry";
import type { MapProps } from "./map-view";

type View = {
  scene: T.Scene; content: T.Group; parking: T.Group; signs: T.Group;
  fit: (target: MapFocus) => void;
  draw: () => void;
};

function clear(group: T.Group) {
  group.traverse((object) => {
    if (object instanceof T.Mesh || object instanceof T.Sprite) {
      if (object instanceof T.Mesh) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) { material.map?.dispose(); material.dispose(); }
    }
  });
  group.clear();
}

const at = ([x, z]: Point, y = 0) => new T.Vector3(x, y, z);
const overviewAngle = new T.Vector3(.5, 1, 1).normalize();
const detailAngle = new T.Vector3(.2, 1, .55).normalize();
const overviewLabels = new Set(["Sumanadasa Building", "Faculty of IT", "Library"]);

function fitCamera(camera: T.PerspectiveCamera, controls: OrbitControls, { point, size }: MapFocus) {
  const [width, depth] = size;
  const angle = Math.max(width, depth) > 500 ? overviewAngle : detailAngle;
  const right = new T.Vector3().crossVectors(camera.up, angle).normalize();
  const up = new T.Vector3().crossVectors(angle, right);
  const vertical = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * .86;
  const horizontal = vertical * camera.aspect;
  let distance = controls.minDistance;
  // Every corner must fit at its own depth in the perspective projection.
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      const corner = new T.Vector3(x, 0, z);
      const projected = Math.max(Math.abs(corner.dot(right)) / horizontal, Math.abs(corner.dot(up)) / vertical);
      distance = Math.max(distance, corner.dot(angle) + projected);
    }
  }
  controls.maxDistance = Math.max(3000, distance * 1.25);
  camera.far = controls.maxDistance + 2200;
  camera.updateProjectionMatrix();
  controls.target.copy(at(point));
  camera.position.copy(controls.target).addScaledVector(angle, distance);
  controls.update();
}

function slab(group: T.Group, x: number, z: number, w: number, d: number, height: number, fill: string, ground = 0) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, height, d), new T.MeshLambertMaterial({ color: fill }));
  mesh.position.copy(at([x, z], ground + height / 2));
  group.add(mesh);
  return mesh;
}
function strip(group: T.Group, points: Point[], width: number, color: string, y: number) {
  return points.slice(1).map((b, index) => {
    const a = points[index];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const mesh = slab(group, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(dx, dz), width, 1, color, y);
    mesh.rotation.y = -Math.atan2(dz, dx);
    return mesh;
  });
}

function label(text: string, point: Point, y: number) {
  const surface = document.createElement("canvas");
  const ctx = surface.getContext("2d");
  if (!ctx) return null;
  const font = "600 24px system-ui";
  ctx.font = font;
  surface.width = Math.ceil(ctx.measureText(text).width) + 20;
  surface.height = 36;
  ctx.fillStyle = "#f8f5e9";
  ctx.fillRect(0, 0, surface.width, surface.height);
  ctx.font = font;
  ctx.fillStyle = "#152944";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, surface.width / 2, surface.height / 2);
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(surface), sizeAttenuation: false }));
  sprite.center.set(.5, 0);
  sprite.position.copy(at(point, y));
  sprite.userData.aspect = surface.width / surface.height;
  sprite.userData.landmark = overviewLabels.has(text);
  return sprite;
}

export default function Map3D(props: MapProps & { onFailure: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const { campus, zones, spaces, selected, selectedSpace, focus, night, labels } = props;

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" }); }
    catch { latest.current.onFailure(); return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    node.append(renderer.domElement);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(47, 1, 5, 5500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * .48;
    controls.minDistance = 60;

    const content = new T.Group();
    const parking = new T.Group();
    const signs = new T.Group();
    const sky = new T.HemisphereLight("#f9efd9", "#698264", 2.3);
    const sun = new T.DirectionalLight("#fff5dd", 2.0);
    sun.position.set(111, 750, 671);
    sun.target.position.set(511, 0, 371);
    scene.add(sun.target);
    scene.add(content, parking, signs, sky, sun);
    const draw = () => {
      const showLocalLabels = camera.position.distanceTo(controls.target) < 740;
      const labelHeight = 30 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / Math.max(node.clientHeight, 1);
      for (const sign of signs.children) {
        sign.visible = showLocalLabels || sign.userData.landmark;
        sign.scale.set(labelHeight * sign.userData.aspect, labelHeight, 1);
      }
      renderer.render(scene, camera);
    };
    const fit = (target: MapFocus) => {
      fitCamera(camera, controls, target);
      draw();
    };
    view.current = { scene, content, parking, signs, fit, draw };
    controls.addEventListener("change", draw);

    const resizeViewport = () => {
      const { clientWidth: width, clientHeight: height } = node;
      if (!width || !height) return;
      camera.aspect = width / height;
      renderer.setSize(width, height, false);
      fit(latest.current.focus ?? campusFocus(latest.current.campus.size));
    };
    resizeViewport();
    const resize = new ResizeObserver(resizeViewport);
    resize.observe(node);
    const canvas = renderer.domElement;
    const lost = (event: Event) => { event.preventDefault(); latest.current.onFailure(); };
    canvas.addEventListener("webglcontextlost", lost);
    const ray = new T.Raycaster();
    let start: [number, number] | null = null;
    const down = (event: PointerEvent) => {
      start = event.isPrimary && event.button === 0 ? [event.clientX, event.clientY] : null;
    };
    const up = (event: PointerEvent) => {
      const origin = start;
      start = null;
      if (!origin || Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 7) return;
      const box = canvas.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2((event.clientX - box.left) / box.width * 2 - 1,
        1 - (event.clientY - box.top) / box.height * 2), camera);
      const hit = ray.intersectObjects(parking.children)[0]?.object.userData;
      if (hit?.space) latest.current.onSpace(hit.space);
      else if (hit?.zone) latest.current.onZone(hit.zone);
    };
    const cancel = () => { start = null; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      resize.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("webglcontextlost", lost);
      controls.dispose();
      clear(content);
      clear(parking);
      clear(signs);
      renderer.dispose();
      canvas.remove();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const g = v.content;
    clear(g);
    clear(v.signs);
    v.scene.background = new T.Color(night ? "#17283c" : "#dde9d5");
    const [width, depth] = campus.size;
    slab(g, width / 2, depth / 2, width, depth, 7, night ? "#344858" : "#b5c6a6", -7);
    const [px, py, rx, ry] = campus.playground;
    const field = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 48), new T.MeshLambertMaterial({ color: night ? "#436c55" : "#80a268" }));
    field.position.copy(at([px, py], .55));
    field.scale.set(rx, 1, ry);
    g.add(field);
    for (const [name, width, points] of campus.roads) {
      strip(g, points, width, night ? "#64768b" : "#ada79a", 1);
      if (labels && width >= 10) {
        const roadLabel = label(name, points[Math.floor(points.length / 2)], 4);
        if (roadLabel) v.signs.add(roadLabel);
      }
    }
    for (const [name, x, y, w, h, height, visible] of campus.buildings) {
      slab(g, x + w / 2, y + h / 2, w, h, height, night ? "#6f839d" : "#e3cdb1");
      if (labels && visible) {
        const buildingLabel = label(name, [x + w / 2, y + h / 2], height + 10);
        if (buildingLabel) v.signs.add(buildingLabel);
      }
    }
    v.draw();
  }, [campus, night, labels]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const parking = v.parking;
    clear(parking);
    for (const zone of zones) {
      const color = zone.open ? categoryDisplay[zone.category].color : "#667181";
      const geometry = zone.geometry;
      const y = selected === zone.id ? 6 : 3;
      const parts: T.Object3D[] = geometry.type === "strip" ? strip(parking, geometry.points, geometry.w + 2, color, y) : [];
      if (geometry.type !== "strip") {
        const [first, ...rest] = outline(geometry);
        const shape = new T.Shape();
        shape.moveTo(first[0], -first[1]);
        for (const point of rest) shape.lineTo(point[0], -point[1]);
        shape.closePath();
        const mesh = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshLambertMaterial({ color, side: T.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = y;
        parking.add(mesh);
        parts.push(mesh);
      }
      for (const part of parts) part.userData.zone = zone.id;
    }
    for (const space of spaces.filter((entry) => entry.zone_id === selected)) {
      const active = space.id === selectedSpace;
      const mesh = slab(parking, space.x, space.y, active ? 5 : 3.8, active ? 5 : 3.8, 2, spaceColor(space), 8);
      mesh.userData.space = space.id;
      if (active) {
        const ring = new T.Mesh(new T.RingGeometry(3.6, 5.1, 24), new T.MeshBasicMaterial({ color: "#fff5d1" }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(at([space.x, space.y], 10.1));
        ring.userData.space = space.id;
        parking.add(ring);
      }
    }
    v.draw();
  }, [zones, spaces, selected, selectedSpace]);

  useEffect(() => {
    view.current?.fit(focus ?? campusFocus(campus.size));
  }, [focus, campus.size]);

  return <div ref={host} className="map-leaflet" aria-hidden="true" />;
}
