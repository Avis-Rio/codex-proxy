const ADMIN_API_KEY_STORAGE_KEY = "codex-proxy.admin-api-key";

function withBearerToken(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers ?? undefined);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return {
    ...init,
    headers,
  };
}

export function getStoredAdminApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ADMIN_API_KEY_STORAGE_KEY)?.trim();
  return value || null;
}

export function setStoredAdminApiKey(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, token.trim());
}

export function clearStoredAdminApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
}

export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withBearerToken(init, getStoredAdminApiKey()));
}

export function bearerFetch(input: RequestInfo | URL, token: string | null, init?: RequestInit): Promise<Response> {
  return fetch(input, withBearerToken(init, token));
}
