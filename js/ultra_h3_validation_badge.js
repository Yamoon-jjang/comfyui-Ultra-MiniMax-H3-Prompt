import { app } from "../../scripts/app.js";

const BADGE_STATE = new WeakMap();
const TEXTAREA_LISTENER = new WeakSet();
const MAX_WIDTH_PX = 620;
const EDGE_INSET = 10;

function currentNodeErrors() {
  try {
    const publicErrors = app?.extensionManager?.lastNodeErrors;
    if (publicErrors && typeof publicErrors === "object") return publicErrors;
  } catch (_) {}
  // Compatibility fallback for frontends that still expose the legacy getter.
  try {
    const legacyErrors = app?.lastNodeErrors;
    if (legacyErrors && typeof legacyErrors === "object") return legacyErrors;
  } catch (_) {}
  return null;
}

const DISPLAY_MS = 3500;

function nodeValidationRecord(node) {
  const errors = currentNodeErrors();
  if (!errors || node?.id == null) return { errors: null, record: null };
  const key = String(node.id);
  const record = Object.prototype.hasOwnProperty.call(errors, key)
    ? errors[key]
    : (Object.prototype.hasOwnProperty.call(errors, node.id) ? errors[node.id] : null);
  return { errors, record };
}

function validationActive(node, hooks) {
  try { return !!hooks.isActive?.(node); } catch (_) { return false; }
}

function badgeMessage(node, hooks) {
  try { return String(hooks.message?.(node) ?? "").trim(); } catch (_) { return ""; }
}

function ensureBadgeElement(node) {
  let state = BADGE_STATE.get(node);
  if (state?.element?.isConnected) return state;

  const element = document.createElement("div");
  element.setAttribute("data-ultra-h3-validation-badge", "1");
  Object.assign(element.style, {
    position: "fixed",
    display: "none",
    boxSizing: "border-box",
    pointerEvents: "none",
    zIndex: "2147483000",
    padding: "5px 9px",
    border: "1px solid rgba(255, 190, 55, 0.98)",
    borderRadius: "8px",
    background: "rgba(53, 38, 16, 0.96)",
    color: "rgba(255, 239, 199, 0.99)",
    font: "600 13px/1.25 sans-serif",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.32)",
  });
  document.body.appendChild(element);
  if (!state) {
    state = {
      element: null,
      target: null,
      lastErrorsObject: null,
      lastRecordObject: null,
      visibleUntil: 0,
      manualVisibleUntil: 0,
      hideTimer: null,
      hooks: null,
    };
  }
  state.element = element;
  BADGE_STATE.set(node, state);
  return state;
}

function hideBadge(node) {
  const state = BADGE_STATE.get(node);
  if (!state) return;
  state.visibleUntil = 0;
  state.manualVisibleUntil = 0;
  if (state.hideTimer != null) {
    clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
  if (state.element) state.element.style.display = "none";
}

function scheduleHide(node, state) {
  if (state.hideTimer != null) clearTimeout(state.hideTimer);
  const delay = Math.max(0, state.visibleUntil - Date.now());
  state.hideTimer = setTimeout(() => {
    state.hideTimer = null;
    if (Date.now() >= state.visibleUntil) hideBadge(node);
  }, delay + 25);
}

function positionBadge(element, target) {
  let rect;
  try { rect = target?.getBoundingClientRect?.(); } catch (_) { rect = null; }
  if (!rect || rect.width < 80 || rect.height < 28) return false;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;

  const available = Math.max(80, rect.width - EDGE_INSET * 2);
  const width = Math.min(MAX_WIDTH_PX, available);
  element.style.left = `${Math.round(rect.left + EDGE_INSET)}px`;
  element.style.top = `${Math.round(rect.top + EDGE_INSET)}px`;
  element.style.maxWidth = `${Math.round(width)}px`;
  return true;
}

function syncBadge(node, hooks) {
  const state = ensureBadgeElement(node);
  const { errors, record } = nodeValidationRecord(node);
  const manualActive = Date.now() < Number(state.manualVisibleUntil || 0);
  const active = validationActive(node, hooks) && (!!record || manualActive);

  if (!active) {
    state.lastErrorsObject = errors;
    state.lastRecordObject = record;
    hideBadge(node);
    return;
  }

  const isNewValidationEpisode = errors !== state.lastErrorsObject || record !== state.lastRecordObject;
  state.lastErrorsObject = errors;
  state.lastRecordObject = record;

  if (isNewValidationEpisode && record) {
    state.visibleUntil = Date.now() + DISPLAY_MS;
    scheduleHide(node, state);
  }

  if (Date.now() >= state.visibleUntil) {
    if (state.element) state.element.style.display = "none";
    return;
  }

  let target = null;
  try { target = hooks.targetElement?.(node) ?? null; } catch (_) {}
  if (!target || target.tagName?.toLowerCase?.() !== "textarea") {
    if (state.element) state.element.style.display = "none";
    return;
  }

  const message = badgeMessage(node, hooks);
  if (!message) {
    if (state.element) state.element.style.display = "none";
    return;
  }

  state.target = target;
  if (!positionBadge(state.element, target)) {
    if (state.element) state.element.style.display = "none";
    return;
  }
  state.element.textContent = message;
  state.element.style.display = "block";

  if (!TEXTAREA_LISTENER.has(target)) {
    target.addEventListener("input", () => {
      // Once the user starts correcting the input, get the badge out of the way.
      // A later Queue attempt creates a fresh validation episode and shows it again.
      try { hideBadge(node); } catch (_) {}
    }, { passive: true });
    TEXTAREA_LISTENER.add(target);
  }
}

function removeBadge(node) {
  const state = BADGE_STATE.get(node);
  try { state?.element?.remove?.(); } catch (_) {}
  BADGE_STATE.delete(node);
}

export function triggerValidationBadge(node) {
  const state = BADGE_STATE.get(node);
  const hooks = state?.hooks;
  if (!state || !hooks) return false;
  if (!validationActive(node, hooks)) {
    hideBadge(node);
    return false;
  }
  const until = Date.now() + DISPLAY_MS;
  state.manualVisibleUntil = until;
  state.visibleUntil = until;
  scheduleHide(node, state);
  try { syncBadge(node, hooks); } catch (_) {}
  try { app?.canvas?.setDirty?.(true, true); } catch (_) {}
  return true;
}

export function installValidationBadge(node, hooks) {
  if (!node || !hooks?.isActive || !hooks?.message || !hooks?.targetElement) return;
  if (BADGE_STATE.has(node)) return;

  // Keep this display-only. The draw hook is used only as a reliable sync point
  // after ComfyUI updates its native validation state and whenever pan/zoom moves
  // the textarea on screen. It never changes node/widget geometry.
  BADGE_STATE.set(node, {
    element: null,
    target: null,
    lastErrorsObject: null,
    lastRecordObject: null,
    visibleUntil: 0,
    manualVisibleUntil: 0,
    hideTimer: null,
    hooks,
  });
  const originalDraw = node.onDrawForeground;
  node.onDrawForeground = function (...args) {
    const result = typeof originalDraw === "function" ? originalDraw.apply(this, args) : undefined;
    try {
      const state = BADGE_STATE.get(this);
      const now = Date.now();
      const { errors, record } = nodeValidationRecord(this);
      const visible = now < Number(state?.visibleUntil || 0)
        || now < Number(state?.manualVisibleUntil || 0);
      // Hidden badges need no DOM read/write on ordinary canvas frames. Sync
      // again only for a new validation result or while a visible badge must
      // follow the graph during pan/zoom.
      if (visible || errors !== state?.lastErrorsObject || record !== state?.lastRecordObject) {
        syncBadge(this, hooks);
      }
    } catch (_) {}
    return result;
  };

  const originalRemoved = node.onRemoved;
  node.onRemoved = function (...args) {
    try { removeBadge(this); } catch (_) {}
    return typeof originalRemoved === "function" ? originalRemoved.apply(this, args) : undefined;
  };

  // Initial sync intentionally stays hidden. A native validation failure or the
  // explicit non-blocking draft trigger can start a visible validation episode.
  try { syncBadge(node, hooks); } catch (_) {}
}
