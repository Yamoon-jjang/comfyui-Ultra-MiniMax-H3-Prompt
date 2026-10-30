// Ultra MiniMax H3 request token helper (pairs with request_guard.py).
//
// The translation API routes only accept save/test/remove requests that carry
// the per-process token ComfyUI's Python side created at startup. This module
// fetches that token once from the same-origin route, sends it with every
// request, and, if ComfyUI was restarted meanwhile (new token), fetches the new
// one and retries the request once. Nothing else changes in how the calling
// code builds or handles its requests.
import { api } from "../../scripts/api.js";

const TOKEN_ROUTE = "/ultra_minimax_h3/security/token";
const TOKEN_ERROR_CODE = "ultra_h3_token";
const TOKEN_HEADER = "X-Ultra-H3-Token";

let cachedToken = "";
let pendingToken = null;

function loadToken(force = false) {
  if (!force && cachedToken) return Promise.resolve(cachedToken);
  if (!force && pendingToken) return pendingToken;
  const request = (async () => {
    try {
      const response = await api.fetchApi(TOKEN_ROUTE, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok && data && typeof data.token === "string" && data.token) {
        cachedToken = data.token;
      } else if (force) {
        cachedToken = "";
      }
    } catch (_) {
      if (force) cachedToken = "";
    }
    return cachedToken;
  })();
  pendingToken = request;
  request.finally(() => {
    if (pendingToken === request) pendingToken = null;
  });
  return request;
}

function plainHeaders(headers) {
  if (!headers) return {};
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function withToken(options, token) {
  const next = { ...(options || {}) };
  const headers = plainHeaders(next.headers);
  if (token) headers[TOKEN_HEADER] = token;
  next.headers = headers;
  return next;
}

async function isTokenRejection(response) {
  if (!response || response.status !== 403) return false;
  try {
    const data = await response.clone().json();
    return data?.code === TOKEN_ERROR_CODE;
  } catch (_) {
    return false;
  }
}

// Drop-in replacement for api.fetchApi() for this node's protected routes.
export async function h3FetchApi(route, options = {}) {
  const token = await loadToken(false);
  let response = await api.fetchApi(route, withToken(options, token));
  if (await isTokenRejection(response)) {
    const fresh = await loadToken(true);
    if (fresh) response = await api.fetchApi(route, withToken(options, fresh));
  }
  return response;
}
