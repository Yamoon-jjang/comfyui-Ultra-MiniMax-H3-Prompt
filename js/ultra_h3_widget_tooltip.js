import { WIDGET_TOOLTIPS } from "./ultra_h3_widget_tooltip_texts.js";
// Display-only hover tooltips for ordinary Core/LiteGraph widgets.
// Current ComfyUI frontend preserves widget.tooltip/options.tooltip metadata
// but does not consistently render it for canvas widgets. This helper reads
// that existing metadata and shows a small DOM overlay. It never changes
// widget values/options, graph topology, serialization, or node geometry.

const INSTALLED = new WeakSet();
const OVERLAY_TOOLTIP = Symbol.for("ultraH3.overlayTooltip");
const CONNECTED_TOOLTIP_ACTIVE = Symbol.for("ultraH3.connectedTooltipActive");
const CONNECTED_STRING_ACTIVE = Symbol.for("ultraH3.connectedStringActive");
const TOOLTIP_ENABLED_PROPERTY = "ultra_h3_tooltips_enabled";
const TITLE_TOGGLE_INSTALLED = new WeakSet();
let tooltipEl = null;
let activeNode = null;
let activeWidget = null;

function ensureTooltipElement() {
  if (tooltipEl?.isConnected) return tooltipEl;
  const el = document.createElement("div");
  el.dataset.ultraH3WidgetTooltip = "1";
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "100000",
    maxWidth: "500px",
    padding: "7px 9px",
    borderRadius: "6px",
    background: "rgba(20, 20, 24, 0.96)",
    color: "#f2f2f2",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 4px 18px rgba(0,0,0,0.34)",
    font: "12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    pointerEvents: "none",
    display: "none",
  });
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

function hideTooltip(node = null) {
  if (node && activeNode && activeNode !== node) return;
  if (tooltipEl) tooltipEl.style.display = "none";
  activeNode = null;
  activeWidget = null;
}


function tooltipEnabled(node) {
  // Fresh/reloaded nodes default to OFF. Only an explicit persisted true turns
  // Ultra hover help on; this keeps the title control opt-in without touching
  // ComfyUI's native widget metadata or geometry.
  return node?.properties?.[TOOLTIP_ENABLED_PROPERTY] === true;
}

function setTooltipEnabled(node, enabled) {
  if (!node) return;
  node.properties ??= {};
  node.properties[TOOLTIP_ENABLED_PROPERTY] = Boolean(enabled);
  if (!enabled) hideTooltip(node);
  try { node.setDirtyCanvas?.(true, true); } catch (_) {}
}

function titleToggleBounds(node) {
  const cached = node?.__ultraH3TooltipToggleBounds;
  if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.w)) return cached;
  const width = Number(node?.size?.[0]) || 0;
  if (!(width > 0)) return null;
  const titleHeight = Math.max(24, Number(globalThis?.LiteGraph?.NODE_TITLE_HEIGHT) || 30);
  const controlWidth = 50;
  const controlHeight = 16;
  const rightGap = 18;
  const x = width - rightGap - controlWidth;
  const y = -titleHeight + Math.max(3, (titleHeight - controlHeight) / 2);
  if (x < 8) return null;
  return { x, y, w: controlWidth, h: controlHeight };
}

function titleToggleHit(node, pos) {
  if (!Array.isArray(pos) || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return false;
  const b = titleToggleBounds(node);
  if (!b) return false;
  return pos[0] >= b.x && pos[0] <= b.x + b.w && pos[1] >= b.y && pos[1] <= b.y + b.h;
}

function drawTitleTooltipToggle(node, ctx, hooks) {
  if (!ctx) return;
  const enabled = tooltipEnabled(node);
  const locale = hooks?.locale?.(node) === "ko" ? "ko" : "en";
  const label = locale === "ko"
    ? (enabled ? "툴팁 ON" : "툴팁 OFF")
    : (enabled ? "Tip ON" : "Tip OFF");

  const width = Number(node?.size?.[0]) || 0;
  if (!(width > 0)) return;
  const titleHeight = Math.max(24, Number(globalThis?.LiteGraph?.NODE_TITLE_HEIGHT) || 30);
  const controlWidth = 50;
  const controlHeight = 16;
  const rightGap = 18;
  const titleLeft = 32;
  const titleGap = 8;

  ctx.save();
  try {
    const titleTextSize = Math.max(12, Number(globalThis?.LiteGraph?.NODE_TEXT_SIZE) || 14);
    ctx.font = `bold ${titleTextSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const titleWidth = Math.ceil(ctx.measureText(String(node?.title || "")).width);
    const x = width - rightGap - controlWidth;
    const y = -titleHeight + Math.max(3, (titleHeight - controlHeight) / 2);
    if (x < 8 || x < titleLeft + titleWidth + titleGap) {
      node.__ultraH3TooltipToggleBounds = null;
      return;
    }
    const b = { x, y, w: controlWidth, h: controlHeight };
    node.__ultraH3TooltipToggleBounds = b;

    // Deliberately understated: no filled background, only a thin outline and text.
    ctx.strokeStyle = enabled ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.34)";
    ctx.lineWidth = 1;
    const r = 4;
    const w = b.w, h = b.h;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = enabled ? "rgba(245,247,250,0.82)" : "rgba(215,218,224,0.50)";
    ctx.font = "10.5px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.25);
  } finally {
    ctx.restore();
  }
}

function installTitleTooltipToggle(node, hooks) {
  if (!node || TITLE_TOGGLE_INSTALLED.has(node)) return;
  TITLE_TOGGLE_INSTALLED.add(node);

  const previousDraw = node.onDrawForeground;
  node.onDrawForeground = function (...args) {
    const result = typeof previousDraw === "function" ? previousDraw.apply(this, args) : undefined;
    try { drawTitleTooltipToggle(this, args[0], hooks); } catch (_) {}
    return result;
  };

  const previousMouseDown = node.onMouseDown;
  node.onMouseDown = function (event, pos, ...rest) {
    if (titleToggleHit(this, pos)) {
      setTooltipEnabled(this, !tooltipEnabled(this));
      return true;
    }
    return typeof previousMouseDown === "function"
      ? previousMouseDown.call(this, event, pos, ...rest)
      : undefined;
  };
}

function connectedStringActive(widget) {
  try {
    return typeof widget?.[CONNECTED_STRING_ACTIVE] === "function"
      && widget[CONNECTED_STRING_ACTIVE]();
  } catch (_) {
    return false;
  }
}

function tooltipText(node, widget, hooks) {
  try {
    const locale = hooks?.locale?.(node) === "ko" ? "ko" : "en";
    const nodeClass = String(node?.comfyClass ?? node?.type ?? "");
    const connectedTooltipActive = typeof widget?.[CONNECTED_TOOLTIP_ACTIVE] === "function"
      && widget[CONNECTED_TOOLTIP_ACTIVE]();
    // Core connected STRING rows keep their proven native tooltip path.
    if (connectedTooltipActive) return "";
    const owned = typeof widget?.[OVERLAY_TOOLTIP] === "function"
      ? widget[OVERLAY_TOOLTIP]()
      : undefined;
    // R2V dynamic Reference STRING rows intentionally use the Ultra overlay
    // instead of the native path. While connected, the upstream STRING value
    // takes precedence over ordinary help regardless of the help toggle.
    if (connectedStringActive(widget)) return String(owned ?? "").trim();
    const localized = WIDGET_TOOLTIPS?.[locale]?.[nodeClass]?.[widget?.name];
    const value = localized ?? owned ?? widget?.tooltip ?? widget?.options?.tooltip ?? "";
    return String(value ?? "").trim();
  } catch (_) {
    return "";
  }
}

function widgetHidden(widget) {
  return Boolean(widget?.hidden || widget?.options?.hidden);
}

function widgetOwnsDom(widget) {
  // Most DOM-backed widgets already have native browser affordances. The
  // scene_prompt textarea is handled separately with DOM hover listeners so it
  // can use the same styled tooltip overlay as canvas widgets.
  return Boolean((widget?.element || widget?.inputEl) && widget?.name !== "scene_prompt");
}

function localMouse(node, event, pos) {
  if (Array.isArray(pos) && Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
    // LiteGraph passes node-local coordinates to node mouse callbacks.
    return [Number(pos[0]), Number(pos[1])];
  }
  const gx = Number(event?.canvasX);
  const gy = Number(event?.canvasY);
  if (Number.isFinite(gx) && Number.isFinite(gy) && Array.isArray(node?.pos)) {
    return [gx - Number(node.pos[0] || 0), gy - Number(node.pos[1] || 0)];
  }
  return null;
}

function widgetBounds(widget) {
  const y = Number(widget?.last_y ?? widget?.y);
  if (!Number.isFinite(y)) return null;
  const h = Math.max(18, Number(widget?.computedHeight ?? widget?.height ?? 20) || 20);
  return [y, y + h];
}

function hoveredWidget(node, local, hooks) {
  if (!local) return null;
  const y = local[1];
  const helpEnabled = tooltipEnabled(node);
  for (const widget of node?.widgets || []) {
    if (!widget || widgetHidden(widget) || widgetOwnsDom(widget)) continue;
    if (!helpEnabled && !connectedStringActive(widget)) continue;
    if (!tooltipText(node, widget, hooks)) continue;
    const bounds = widgetBounds(widget);
    if (bounds && y >= bounds[0] && y <= bounds[1]) return widget;
  }
  return null;
}

function positionTooltip(el, event) {
  const gap = 14;
  const margin = 8;
  const mouseX = Number(event?.clientX);
  const mouseY = Number(event?.clientY);
  if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return;

  const viewportWidth = Math.max(1, Number(window?.innerWidth) || 1);
  const viewportHeight = Math.max(1, Number(window?.innerHeight) || 1);
  const availableWidth = Math.max(1, viewportWidth - margin * 2);

  // Measure at a safe in-viewport origin with an explicit intrinsic width.
  // Measuring after first placing the tooltip near the right edge can make a
  // fixed-position auto-width element shrink to the tiny remaining space.
  el.style.maxWidth = `${Math.min(500, availableWidth)}px`;
  el.style.width = "max-content";
  el.style.left = `${margin}px`;
  el.style.top = `${margin}px`;
  const rect = el.getBoundingClientRect();

  let x = mouseX + gap;
  let y = mouseY + gap;

  // Prefer right/below. Flip to the opposite side before the final clamp when
  // there is not enough room, so the tooltip keeps its normal readable width.
  if (x + rect.width > viewportWidth - margin) {
    x = mouseX - rect.width - gap;
  }
  if (y + rect.height > viewportHeight - margin) {
    y = mouseY - rect.height - gap;
  }

  const maxX = Math.max(margin, viewportWidth - rect.width - margin);
  const maxY = Math.max(margin, viewportHeight - rect.height - margin);
  el.style.left = `${Math.min(Math.max(margin, x), maxX)}px`;
  el.style.top = `${Math.min(Math.max(margin, y), maxY)}px`;
}

function showTooltip(node, widget, event, hooks) {
  if (!tooltipEnabled(node) && !connectedStringActive(widget)) return hideTooltip(node);
  const text = tooltipText(node, widget, hooks);
  if (!text) return hideTooltip(node);
  const el = ensureTooltipElement();
  if (activeNode !== node || activeWidget !== widget || el.textContent !== text) {
    el.textContent = text;
  }
  activeNode = node;
  activeWidget = widget;
  el.style.display = "block";
  positionTooltip(el, event);
}


function installDomWidgetTooltip(node, widget, hooks) {
  const element = widget?.element?.querySelector?.("textarea, input, select, button") || widget?.element || widget?.inputEl;
  if (!element || element.__ultraH3DomTooltipInstalled) return;
  element.__ultraH3DomTooltipInstalled = true;
  // scene_prompt used a native HTML title before the shared overlay existed.
  // Remove it so browsers do not show a second tooltip beside the Ultra one.
  try { element.removeAttribute?.("title"); } catch (_) {}
  const handler = (event) => {
    try { element.removeAttribute?.("title"); } catch (_) {}
    if ((!tooltipEnabled(node) && !connectedStringActive(widget)) || !tooltipText(node, widget, hooks)) return hideTooltip(node);
    showTooltip(node, widget, event, hooks);
  };
  element.addEventListener("mouseenter", handler);
  element.addEventListener("mousemove", handler);
  element.addEventListener("mouseleave", () => hideTooltip(node));
  element.addEventListener("blur", () => hideTooltip(node));
}

function chainNodeCallback(node, key, handler) {
  const previous = node?.[key];
  node[key] = function (...args) {
    const result = typeof previous === "function" ? previous.apply(this, args) : undefined;
    try { handler.apply(this, args); } catch (_) {}
    return result;
  };
}

export function installCoreWidgetHoverTooltips(node, hooks = {}) {
  if (!node || INSTALLED.has(node)) return;
  INSTALLED.add(node);
  installTitleTooltipToggle(node, hooks);

  const installSceneTooltip = () => {
    const widget = (node?.widgets || []).find((item) => item?.name === "scene_prompt");
    if (!widget || !tooltipText(node, widget, hooks)) return false;
    installDomWidgetTooltip(node, widget, hooks);
    return Boolean(widget?.element || widget?.inputEl);
  };
  if (!installSceneTooltip()) {
    const nextFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
    nextFrame(() => { if (!installSceneTooltip()) nextFrame(installSceneTooltip); });
  }

  chainNodeCallback(node, "onMouseMove", function (event, pos) {
    const widget = hoveredWidget(this, localMouse(this, event, pos), hooks);
    if (widget) showTooltip(this, widget, event, hooks);
    else hideTooltip(this);
  });
  chainNodeCallback(node, "onMouseLeave", function () { hideTooltip(this); });
  chainNodeCallback(node, "onRemoved", function () { hideTooltip(this); });
}
