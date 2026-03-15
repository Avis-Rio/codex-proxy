import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { getConfig } from "../config.js";

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function extractRequestAddress(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) return normalizeAddress(first);
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) return normalizeAddress(realIp);

  const remote = getConnInfo(c).remote.address ?? "";
  return normalizeAddress(remote);
}

function extractApiKey(c: Context): string | null {
  const xApiKey = c.req.header("x-api-key")?.trim();
  if (xApiKey) return xApiKey;

  const authHeader = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  return token || null;
}

export function isLocalRequest(c: Context): boolean {
  const addr = extractRequestAddress(c);
  return (
    addr === "" ||
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1" ||
    addr === "localhost"
  );
}

export function requireProxyApiAccess(validate: (key: string) => boolean): MiddlewareHandler {
  return async (c, next) => {
    const proxyApiKey = getConfig().server.proxy_api_key;
    if (!proxyApiKey) {
      await next();
      return;
    }

    const providedKey = extractApiKey(c);
    if (!providedKey || !validate(providedKey)) {
      c.status(401);
      return c.json({
        error: {
          message: "Invalid proxy API key",
          type: "invalid_request_error",
          param: null,
          code: "invalid_api_key",
        },
      });
    }

    await next();
  };
}

export function canAccessAdmin(c: Context): boolean {
  if (isLocalRequest(c)) return true;

  const adminApiKey = getConfig().server.admin_api_key;
  if (!adminApiKey) return false;

  const providedKey = extractApiKey(c);
  return providedKey === adminApiKey;
}

export function requireAdminAccess(): MiddlewareHandler {
  return async (c, next) => {
    if (!canAccessAdmin(c)) {
      const hasAdminKey = !!getConfig().server.admin_api_key;
      c.status(hasAdminKey ? 401 : 403);
      return c.json({
        error: hasAdminKey
          ? "Invalid admin API key"
          : "Admin access is restricted to localhost",
      });
    }

    await next();
  };
}

export function hideAdminSurface(c: Context): Response | null {
  return canAccessAdmin(c) ? null : c.notFound();
}
