"use client";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const result = await fetch("/api/v1/" + path, { ...options, headers, cache: "no-store" });
  const json = await result.json();
  if (!result.ok) throw new Error(json.message ?? "The request failed.");
  return json as T;
}

export function mutation(data: unknown, method = "POST", key?: string): RequestInit {
  return { method, body: JSON.stringify(data), headers: key ? { "Idempotency-Key": key } : undefined };
}

export function campusTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(new Date(value));
}
