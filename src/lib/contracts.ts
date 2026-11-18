export const roles = ["student", "lecturer", "staff", "visitor", "officer", "admin"] as const;
export const kinds = ["car", "van", "motorcycle", "bicycle", "university", "other"] as const;
export const categories = ["cars", "motorcycles", "bicycles", "university", "other"] as const;
export const states = ["open", "closed", "blocked", "under_review", "retired"] as const;
export const campusDirectionsUrl = "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent("University of Moratuwa, Bandaranayake Mawatha, Moratuwa 10400, Sri Lanka");
export type Role = typeof roles[number];
export type Kind = typeof kinds[number];
export type Category = typeof categories[number];

export type Point = [number, number];
export type MapFocus = { point: Point; size: Point };
export type Geometry =
  | { type: "box"; x: number; y: number; w: number; h: number; r: number }
  | { type: "strip"; points: Point[]; w: number }
  | { type: "polygon"; points: Point[] };
export type Campus = {
  coordinateVersion: number; size: Point; playground: [number, number, number, number];
  buildings: [string, number, number, number, number, number, number][];
  roads: [string, number, Point[]][]; origins: { id: string; name: string; x: number; y: number }[];
};

export type Zone = {
  id: string; code: string; name: string; category: Category; proposed_capacity: number;
  geometry: Geometry; instructions: string; open: boolean; published: boolean; verified: boolean;
  version: number; inventory: number; available: number; occupied: number;
};
export type Space = {
  id: string; zone_id: string; zone_name: string; zone_code: string; code: string; x: number; y: number;
  state: typeof states[number]; published: boolean; verified: boolean; version: number;
  occupied: boolean; available: boolean; eligible: boolean; updated_at: string;
};
export type Vehicle = { id: string; kind: Kind; plate: string | null; model: string; color: string };
export type Session = {
  id: string; started_at: string; ended_at: string | null; code: string; zone_name: string;
  kind: Kind; plate: string | null; stale?: boolean; verified_at?: string | null; user_name?: string;
};
export type Notice = { id: string; title: string; body: string; published_at: string; read_at: string | null };
export type Rule = { id: string; title: string; body: string };
export type Report = { id: string; kind: string; description: string; status: string; zone: string; space: string | null; resolution: string | null };
export type Profile = { id: string; name: string; role: Role; verified: boolean; registration: "campus" | "visitor" };

export const categoryDisplay: Record<Category, { label: string; color: string }> = {
  cars: { label: "Cars and vans", color: "#b94d43" },
  motorcycles: { label: "Motorcycles", color: "#4775a4" },
  bicycles: { label: "Bicycles", color: "#ba5d83" },
  university: { label: "University vehicles", color: "#333b40" },
  other: { label: "Other and unassigned", color: "#4d7d52" },
};
