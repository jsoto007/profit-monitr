import { NextResponse } from "next/server";
import { AuthError } from "./auth";

/** Error carrying field-level messages for a form, e.g. { email: "…" }. */
export class FormError extends Error {
  status = 422;
  constructor(public fields: Record<string, string>, message = "Check the highlighted fields.") {
    super(message);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Browsers attach Origin to cross-site writes. A write whose Origin names a
 * different host is refused, which (with SameSite=Lax cookies) closes CSRF.
 */
function assertSameOrigin(req: Request) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Bad origin.");
  }
  // Same-origin means the Origin names the host this request was sent to. A browser sets both
  // headers itself, so a page on another site cannot make them agree. The configured public
  // origins are accepted too (custom domain and the onrender.com name can both be live).
  // X-Forwarded-Host is never consulted.
  const allowed = [req.headers.get("host"), ...[process.env.APP_URL, process.env.RENDER_EXTERNAL_URL].filter(Boolean).map((u) => new URL(u as string).host)];
  if (!allowed.includes(originHost)) throw new HttpError(403, "Cross-site request refused.");
}

/** Wraps a route handler so thrown errors become tidy JSON responses. */
export function handler<T extends unknown[]>(fn: (req: Request, ...rest: T) => Promise<Response>) {
  return async (req: Request, ...rest: T): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof FormError) return NextResponse.json({ error: e.message, fields: e.fields }, { status: e.status });
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "Expected a JSON object.");
  return body as T;
}

/** A trimmed, length-capped string. NUL bytes are dropped — Postgres text columns reject them. */
export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");

/**
 * The caller's address, for rate limiting. The left-most X-Forwarded-For entry
 * is whatever the client sent, so it is never used: prefer the header the edge
 * writes itself, else the hop appended by the nearest proxy (right-most).
 */
export function clientKey(req: Request): string {
  const edge = req.headers.get("cf-connecting-ip") || req.headers.get("true-client-ip");
  const hops = (req.headers.get("x-forwarded-for") || "").split(",").map((h) => h.trim()).filter(Boolean);
  const ip = (edge || hops[hops.length - 1] || "local").trim();
  // One IPv6 customer holds a whole /64; key on the network, not the address.
  return ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
}

/**
 * Absolute URL for a redirect. The configured public origin wins. Without one
 * (local development) the request's own Host is used — never X-Forwarded-Host,
 * which a caller can set — and a port-less Host clears the internal port.
 */
export function absoluteUrl(req: Request, path: string): URL {
  const origin = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (origin) return new URL(path, origin);
  const u = new URL(path, req.url);
  const host = req.headers.get("host");
  if (host) {
    u.host = host;
    if (!host.includes(":")) u.port = "";
  }
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (proto === "http" || proto === "https") u.protocol = proto + ":";
  return u;
}
