"use client";

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const result = await fetch("/api/v1/" + path, { ...options, headers, cache: "no-store" });
  if (!result.ok) {
    const error = await result.json().catch(() => null);
    throw new ApiRequestError(result.status, error?.code ?? "", error?.message ?? "The parking service could not complete the request.");
  }
  return await result.json() as T;
}

export function mutation(data: unknown, method = "POST", key?: string): RequestInit {
  return { method, body: JSON.stringify(data), headers: key ? { "Idempotency-Key": key } : undefined };
}

export function campusTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(new Date(value));
}
