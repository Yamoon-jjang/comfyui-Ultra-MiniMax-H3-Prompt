const HEADER_PREFIX = "__ultra_h3_group_header__";
const COLLAPSE_PROPERTY = "__ultra_h3_group_collapse_v1";
const HEADER_MARKER = Symbol("ultraH3GroupedSectionHeader");
const NODE_CONFIG = new WeakMap();
const NODE_GROUPS = new WeakMap();
const WIDGET_NODE = new WeakMap();
const HEADER_TEXT = Symbol("ultraH3GroupedSectionText");
const HEADER_TITLE = Symbol("ultraH3GroupedSectionTitle");
const HEADER_SUMMARY = Symbol("ultraH3GroupedSectionSummary");
const HEADER_ACCENT = Symbol("ultraH3GroupedSectionAccent");
// Last tooltip text actually committed to a header. The connected-STRING
// tooltip bridge later installs a `tooltip` getter on every widget (headers
// included) that returns "" while unconnected, so comparing against
// header.tooltip / header.options.tooltip is always unequal. That made every
// refresh replace all header options objects (24+ per click), forcing Vue to
// re-render the node's widget list on every menu interaction.
const HEADER_TOOLTIP_APPLIED = Symbol("ultraH3GroupedSectionTooltipApplied");

// Keep the established end state (header.options.tooltip is a plain data
// property holding the header help) while avoiding a new options object when
// nothing changed. Only a rebound accessor or a different value needs a write.
function headerOptionsTooltipIsPlain(header, tooltip) {
  const options = header?.options;
  if (!options || typeof options !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(options, "tooltip");
  return Boolean(descriptor && "value" in descriptor && descriptor.value === tooltip && options.serialize === false);
}
const GROUP_VISUAL_END_OFFSET = Symbol.for("ultraH3.groupVisualEndOffset");
const GROUP_DRAW_INSTALLED = new WeakSet();
const GROUP_REDRAW_PENDING = new WeakSet();
const GROUP_INDENT = Symbol.for("ultraH3.groupedSectionIndent");
const SELF_INDENTED_WIDGET = Symbol.for("ultraH3.selfIndentedWidget");
const GROUP_INDENT_PATCHED = new WeakSet();
const DISCLOSURE_PATCHED = new WeakSet();
const TOP_LEVEL_INDENT = 8;
const NESTED_INDENT = 15;

const ACCENTS = Object.freeze({
  basic: "rgba(135, 184, 86, 0.82)",
  reference: "rgba(73, 157, 220, 0.82)",
  person: "rgba(143, 105, 196, 0.82)",
  progress: "rgba(220, 143, 77, 0.82)",
  camera: "rgba(196, 125, 76, 0.82)",
  sound: "rgba(75, 162, 137, 0.82)",
  neutral: "rgba(145, 151, 160, 0.72)",
});

function widgetsOf(node) {
  return Array.isArray(node?.widgets) ? node.widgets : [];
}

function widgetByName(node, name) {
  return widgetsOf(node).find((widget) => widget?.name === name) || null;
}

function buildWidgetIndex(node) {
  const index = new Map();
  for (const widget of widgetsOf(node)) {
    const name = String(widget?.name || "");
    if (name && !index.has(name)) index.set(name, widget);
  }
  return index;
}

function indexedWidget(node, index, name) {
  if (!name) return null;
  return index?.get(String(name)) || widgetByName(node, name);
}

function readCollapseMap(node) {
  const value = node?.properties?.[COLLAPSE_PROPERTY];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isCollapsed(node, id) {
  return readCollapseMap(node)[id] === true;
}

function writeCollapsed(node, id, collapsed) {
  node.properties ??= {};
  const previous = readCollapseMap(node);
  const next = { ...previous };
  if (collapsed) next[id] = true;
  else delete next[id];
  if (Object.keys(next).length) node.properties[COLLAPSE_PROPERTY] = next;
  else delete node.properties[COLLAPSE_PROPERTY];
}

function inputConnectedForWidget(node, widget) {
  const name = String(widget?.name || "");
  if (!name || !Array.isArray(node?.inputs)) return false;
  return node.inputs.some((input) => {
    if ((input?.link == null || input.link === -1) && !input?.isConnected) return false;
    const widgetName = input?._widget?.name || input?.widget?.name;
    return input?.name === name || widgetName === name;
  });
}

function connectedChildCount(node, children) {
  let count = 0;
  for (const widget of children || []) if (inputConnectedForWidget(node, widget)) count += 1;
  return count;
}

function resolveChildren(node, group, widgetIndex = null) {
  let source = [];
  try {
    source = typeof group.children === "function" ? group.children(node) : group.children;
  } catch (_) {
    source = [];
  }
  if (!Array.isArray(source)) return [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const widget = typeof item === "string" ? indexedWidget(node, widgetIndex, item) : item;
    if (!widget || isGroupedSectionHeader(widget) || seen.has(widget)) continue;
    seen.add(widget);
    result.push(widget);
  }
  return result;
}

function resolveGroups(node) {
  const config = NODE_CONFIG.get(node);
  if (!config) return [];
  let groups = [];
  try { groups = config.groups?.(node) || []; } catch (_) { groups = []; }
  return Array.isArray(groups) ? groups.filter((group) => group?.id) : [];
}

function groupIsActive(node, group, children) {
  if (typeof group.active === "function") {
    try { return Boolean(group.active(node)); } catch (_) { return true; }
  }
  if (group.active != null) return Boolean(group.active);
  return children.length > 0;
}

function localeOf(node) {
  const config = NODE_CONFIG.get(node);
  try { return config?.locale?.(node) === "ko" ? "ko" : "en"; } catch (_) { return "en"; }
}

function displayTitle(node, group) {
  const locale = localeOf(node);
  if (typeof group.title === "function") {
    try { return String(group.title(node, locale) || group.id); } catch (_) { return String(group.id); }
  }
  if (group.title && typeof group.title === "object") return String(group.title[locale] || group.title.en || group.id);
  return String(group.title || group.id);
}

function displaySummary(node, group) {
  const locale = localeOf(node);
  if (typeof group.summary !== "function") return "";
  try { return String(group.summary(node, locale) || "").trim(); } catch (_) { return ""; }
}

function defaultGroupTooltip(node, group) {
  const locale = localeOf(node);
  const kind = String(group?.kind || "neutral");
  const ko = {
    basic: "영상의 기본 생성 조건을 모아 둔 그룹입니다. 장면 번역, 입력 방식, 영상 길이, 스타일, 주요 인물 수와 시간순 진행 수를 설정합니다.",
    camera: "카메라와 촬영 컷을 모아 둔 그룹입니다. 기본 카메라 움직임과 여러 촬영 컷의 시작 시점, 대상, 구도, 전환 및 움직임을 설정합니다.",
    sound: "영상의 소리를 모아 둔 그룹입니다. 환경음과 배경 음악의 사용 방식 및 직접 입력 내용을 설정합니다.",
    person: "해당 인물의 프로필을 모아 둔 그룹입니다. 성별, 연령대와 고급 설정의 외형, 의상, 음성 특성을 설정합니다.",
    progress: "해당 시간순 진행의 내용을 모아 둔 그룹입니다. 대상 인물, 시작 시점, 행동, 대사, 대사 언어와 말하는 방식을 설정합니다.",
    reference: "연결된 R2V 참조가 영상에 어떻게 사용될지 정하는 그룹입니다. 참조 역할, 대상, 적용 범위와 구체적인 적용 지시를 설정합니다. 공식 Ref2VA 입력 한도는 이미지 9개, 비디오 3개, 독립 오디오 3개, 혼합 파일 12개이며, 이 한도를 초과하거나 확인 가능한 참조 길이 한도를 초과하면 프롬프트 생성이 차단되고 수정이 필요한 이유가 표시됩니다.",
    neutral: "서로 관련된 설정을 한곳에 모아 둔 그룹입니다.",
  };
  const en = {
    basic: "Groups the core generation settings: scene translation, input mode, duration, visual style, active people, and timeline progress count.",
    camera: "Groups camera and shot controls: base camera motion plus each shot's start time, target, framing, transition, and motion.",
    sound: "Groups video sound controls: environmental sound, background music, and their optional direct descriptions.",
    person: "Groups this person's profile: gender, age, and advanced appearance, clothing, and voice characteristics.",
    progress: "Groups this timeline progress event: target person, start time, action, dialogue, dialogue language, and delivery.",
    reference: "Groups how this connected R2V reference is used: its role, target, scope, and detailed application instruction. Official Ref2VA limits are 9 images, 3 videos, 3 standalone audios, and 12 mixed files; exceeding these limits, or a reliably measurable reference-duration limit, blocks prompt generation and shows the reason that must be fixed.",
    neutral: "Groups related settings in one section.",
  };
  return (locale === "ko" ? ko : en)[kind] || (locale === "ko" ? ko.neutral : en.neutral);
}

function displayTooltip(node, group) {
  const locale = localeOf(node);
  if (typeof group?.tooltip === "function") {
    try {
      const value = String(group.tooltip(node, locale) || "").trim();
      if (value) return value;
    } catch (_) {}
  } else if (group?.tooltip && typeof group.tooltip === "object") {
    const value = String(group.tooltip[locale] || group.tooltip.en || "").trim();
    if (value) return value;
  } else if (group?.tooltip) {
    const value = String(group.tooltip).trim();
    if (value) return value;
  }
  return defaultGroupTooltip(node, group);
}

function headerTitleText(node, group) {
  const collapsed = isCollapsed(node, group.id);
  const arrow = collapsed ? "▶" : "▼";
  return `${arrow} ${displayTitle(node, group)}`;
}

function headerSummaryText(node, group, children = []) {
  const parts = [];
  const summary = displaySummary(node, group);
  if (summary) parts.push(summary);
  if (isCollapsed(node, group.id)) {
    const linked = connectedChildCount(node, children);
    if (linked > 0) parts.push(localeOf(node) === "ko" ? `연결 ${linked} 유지` : `${linked} linked kept`);
  }
  return parts.join(" · ");
}

function headerText(node, group, children = []) {
  const title = headerTitleText(node, group);
  const summary = headerSummaryText(node, group, children);
  return summary ? `${title}  ·  ${summary}` : title;
}

function widgetHidden(widget) {
  return Boolean(widget?.hidden || widget?.options?.hidden);
}

function widgetBounds(widget) {
  const y = Number(widget?.last_y ?? widget?.y);
  if (!Number.isFinite(y)) return null;
  const h = Math.max(18, Number(widget?.computedHeight ?? widget?.height ?? 20) || 20);
  const visualEndOffset = Number(widget?.[GROUP_VISUAL_END_OFFSET]);
  const visualEnd = Number.isFinite(visualEndOffset)
    ? y + Math.max(0, Math.min(h, visualEndOffset))
    : y + h / 2;
  return { y, h, top: y, bottom: y + h, center: y + h / 2, visualEnd };
}

function mutedAccent(value, alpha = 0.54) {
  const color = String(value || ACCENTS.neutral);
  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgba) return color;
  const parts = rgba[1].split(",").map((item) => item.trim());
  if (parts.length < 3) return color;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function resolveIndentOverrides(node, group, widgetIndex = null) {
  let source = [];
  try {
    source = typeof group.indentOverrides === "function" ? group.indentOverrides(node) : group.indentOverrides;
  } catch (_) {
    source = [];
  }
  if (!Array.isArray(source)) return new Map();
  const result = new Map();
  for (const item of source) {
    const indent = Math.max(0, Number(item?.indent) || 0);
    for (const rawChild of Array.isArray(item?.children) ? item.children : []) {
      const child = typeof rawChild === "string" ? indexedWidget(node, widgetIndex, rawChild) : rawChild;
      if (!child || isGroupedSectionHeader(child)) continue;
      result.set(child, indent);
    }
  }
  return result;
}

function resolveBranchlessChildren(node, group, widgetIndex = null) {
  let source = [];
  try {
    source = typeof group.branchlessChildren === "function" ? group.branchlessChildren(node) : group.branchlessChildren;
  } catch (_) {
    source = [];
  }
  if (!Array.isArray(source)) return new Set();
  const result = new Set();
  for (const item of source) {
    const child = typeof item === "string" ? indexedWidget(node, widgetIndex, item) : item;
    if (!child || isGroupedSectionHeader(child)) continue;
    result.add(child);
  }
  return result;
}

function resolveSubgroups(node, group, widgetIndex = null) {
  let source = [];
  try {
    source = typeof group.subgroups === "function" ? group.subgroups(node) : group.subgroups;
  } catch (_) {
    source = [];
  }
  if (!Array.isArray(source)) return [];
  const resolved = [];
  for (const item of source) {
    const anchor = typeof item?.anchor === "string" ? indexedWidget(node, widgetIndex, item.anchor) : item?.anchor;
    if (!anchor || isGroupedSectionHeader(anchor)) continue;
    const children = [];
    const seen = new Set();
    for (const rawChild of Array.isArray(item?.children) ? item.children : []) {
      const child = typeof rawChild === "string" ? indexedWidget(node, widgetIndex, rawChild) : rawChild;
      if (!child || child === anchor || isGroupedSectionHeader(child) || seen.has(child)) continue;
      seen.add(child);
      children.push(child);
    }
    resolved.push({
      id: String(item?.id || item?.anchor || anchor?.name || ""),
      anchor,
      children,
      depth: Math.max(2, Math.min(3, Number(item?.depth) || 2)),
    });
  }
  return resolved;
}

function visibleDecoratedChildren(children) {
  const out = [];
  for (const child of children || []) {
    if (!child || isGroupedSectionHeader(child) || widgetHidden(child)) continue;
    const bounds = widgetBounds(child);
    if (!bounds) continue;
    out.push({ widget: child, bounds });
  }
  return out;
}

function shiftedCanvasEvent(event, indent) {
  if (!event || !(indent > 0) || !Number.isFinite(Number(event.canvasX))) return event;
  try {
    return new Proxy(event, {
      get(target, prop) {
        if (prop === "canvasX") return Number(target.canvasX) - indent;
        return Reflect.get(target, prop, target);
      },
    });
  } catch (_) {
    return event;
  }
}

function shiftedOwnerForIndent(owner, indent) {
  if (!owner || !(indent > 0) || !Array.isArray(owner.size)) return owner;
  try {
    return new Proxy(owner, {
      get(target, prop) {
        if (prop === "size") {
          const size = target.size;
          return [Math.max(1, Number(size?.[0] || 0) - indent * 2), Number(size?.[1] || 0)];
        }
        return Reflect.get(target, prop, target);
      },
    });
  } catch (_) {
    return owner;
  }
}

function withReducedWidgetWidth(widget, node, indent, callback) {
  if (!(indent > 0)) return callback();
  const hadOwnWidth = Object.prototype.hasOwnProperty.call(widget, "width");
  const previousWidth = widget.width;
  const sourceWidth = Number(previousWidth) || Number(node?.size?.[0]) || Number(node?.width) || 0;
  if (sourceWidth > 0) {
    try { widget.width = Math.max(1, sourceWidth - indent * 2); } catch (_) {}
  }
  try { return callback(); }
  finally {
    try {
      if (hadOwnWidth) widget.width = previousWidth;
      else delete widget.width;
    } catch (_) {
      try { widget.width = previousWidth; } catch (_) {}
    }
  }
}

function shiftedWidgetEventOptions(options, widget, indent) {
  if (!options || typeof options !== "object" || !(indent > 0)) return options;
  const next = { ...options };
  if (options.e) next.e = shiftedCanvasEvent(options.e, indent);
  return next;
}

function isPersonAdvancedDisclosure(widget) {
  return /^person_[abc]_advanced$/.test(String(widget?.name || "")) && String(widget?.type || "") === "toggle";
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(Number(radius) || 0, width * 0.5, height * 0.5));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, [r]);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function installCenteredDisclosurePatch(widget) {
  if (!isPersonAdvancedDisclosure(widget) || DISCLOSURE_PATCHED.has(widget) || typeof widget.drawWidget !== "function") return;
  DISCLOSURE_PATCHED.add(widget);
  widget.drawWidget = function (ctx, options = {}) {
    if (!ctx) return;
    const width = Math.max(1, Number(options?.width) || Number(this?.node?.size?.[0]) || 200);
    const showText = options?.showText !== false;
    const y = Number(this?.y || 0);
    const h = Math.max(18, Number(this?.height) || 20);
    const margin = 15;
    const x0 = margin;
    const x1 = Math.max(x0 + 1, width - margin);
    ctx.save();
    try {
      roundedRectPath(ctx, x0, y, x1 - x0, h, h * 0.5);
      ctx.fillStyle = this.background_color || "#222";
      ctx.strokeStyle = this.outline_color || "#666";
      ctx.lineWidth = 1;
      ctx.fill();
      if (showText && !this.computedDisabled) ctx.stroke();
      if (!showText) return;

      // This disclosure row has no left arrow/control. Match plain native
      // STRING rows instead of reserving the stepped-widget arrow gutter.
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = this.secondary_text_color || "#bbb";
      ctx.fillText(String(this.displayName || this.label || this.name || ""), x0 + 9, y + h * 0.5);

      // Use the same right-side control center as ComfyUI stepped-widget arrows.
      // BaseWidget: margin 15, arrowMargin 6, arrowWidth 10 -> visual center ~ width - 27.
      const centerX = width - 27;
      const centerY = y + h * 0.5;
      const r = Math.max(6, Math.min(8, h * 0.34));
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = this.value ? "rgba(152, 177, 200, 0.92)" : "rgba(90, 94, 100, 0.82)";
      ctx.fill();

      ctx.fillStyle = this.value ? "#e8edf2" : "#c5cbd1";
      ctx.beginPath();
      if (this.value) {
        ctx.moveTo(centerX - 4.5, centerY - 2.5);
        ctx.lineTo(centerX + 4.5, centerY - 2.5);
        ctx.lineTo(centerX, centerY + 4);
      } else {
        ctx.moveTo(centerX - 2.5, centerY - 4.5);
        ctx.lineTo(centerX - 2.5, centerY + 4.5);
        ctx.lineTo(centerX + 4, centerY);
      }
      ctx.closePath();
      ctx.fill();
    } finally {
      ctx.restore();
    }
  };
}

function installGroupedIndentPatch(widget) {
  if (!widget || GROUP_INDENT_PATCHED.has(widget)) return;
  GROUP_INDENT_PATCHED.add(widget);

  // Some canvas-only widgets own their complete row geometry. Their draw and
  // pointer handlers read GROUP_INDENT directly, so wrapping them here would
  // either be ignored by Vue's registered callback or apply the inset twice.
  if (widget?.[SELF_INDENTED_WIDGET]) return;

  // Current ComfyUI BaseWidget deliberately uses its fixed 15px margin once for
  // the capsule but twice for the text grid. Increasing that static margin makes
  // labels move twice as far as the row edge. Instead, translate the complete
  // rendered widget and reduce only the supplied width. Every primitive then
  // moves by exactly the same amount, preserving native internal alignment.
  if (typeof widget.drawWidget === "function") {
    const originalDrawWidget = widget.drawWidget;
    widget.drawWidget = function (ctx, options = {}, ...rest) {
      const indent = Math.max(0, Number(this?.[GROUP_INDENT]) || 0);
      if (!(indent > 0) || !ctx) return originalDrawWidget.call(this, ctx, options, ...rest);
      const width = Number(options?.width) || Number(this?.node?.size?.[0]) || 0;
      const nextOptions = options && typeof options === "object"
        ? { ...options, width: Math.max(1, width - indent * 2) }
        : options;
      ctx.save();
      try {
        ctx.translate(indent, 0);
        return originalDrawWidget.call(this, ctx, nextOptions, ...rest);
      } finally {
        ctx.restore();
      }
    };

    for (const methodName of ["onClick", "onDrag"]) {
      const original = widget[methodName];
      if (typeof original !== "function") continue;
      widget[methodName] = function (...args) {
        const indent = Math.max(0, Number(this?.[GROUP_INDENT]) || 0);
        if (!(indent > 0)) return original.apply(this, args);
        const node = args?.[0]?.node || args?.[1] || this?.node || null;
        const nextArgs = [...args];
        if (nextArgs[0] && typeof nextArgs[0] === "object" && ("e" in nextArgs[0] || "canvas" in nextArgs[0])) {
          nextArgs[0] = shiftedWidgetEventOptions(nextArgs[0], this, indent);
        }
        return withReducedWidgetWidth(this, node, indent, () => original.apply(this, nextArgs));
      };
    }
    return;
  }

  // Legacy/custom canvas widgets already own their drawing. Apply the identical
  // translate + width reduction and shift the pointer x by the same amount.
  if (typeof widget.draw === "function") {
    const originalDraw = widget.draw;
    widget.draw = function (ctx, owner, width, y, H, ...rest) {
      const indent = Math.max(0, Number(this?.[GROUP_INDENT]) || 0);
      if (!(indent > 0) || !ctx) return originalDraw.call(this, ctx, owner, width, y, H, ...rest);
      const adjustedWidth = Math.max(1, (Number(width) || 0) - indent * 2);
      ctx.save();
      try {
        ctx.translate(indent, 0);
        return originalDraw.call(this, ctx, owner, adjustedWidth, y, H, ...rest);
      } finally {
        ctx.restore();
      }
    };
  }
  if (typeof widget.mouse === "function") {
    const originalMouse = widget.mouse;
    widget.mouse = function (event, pos, owner, ...rest) {
      const indent = Math.max(0, Number(this?.[GROUP_INDENT]) || 0);
      if (!(indent > 0)) return originalMouse.call(this, event, pos, owner, ...rest);
      const shiftedPos = Array.isArray(pos) && Number.isFinite(Number(pos[0]))
        ? [Number(pos[0]) - indent, Number(pos[1]) || 0]
        : pos;
      return originalMouse.call(this, shiftedCanvasEvent(event, indent), shiftedPos, shiftedOwnerForIndent(owner, indent), ...rest);
    };
  }
}

function setGroupedIndent(widget, indent) {
  if (!widget || isGroupedSectionHeader(widget)) return;
  installCenteredDisclosurePatch(widget);
  // STRING rows already inherit the same whole-row indentation as combo/toggle
  // rows. Do not add a second label-only shift: it makes Action, Dialogue,
  // direct-input and narrator text rows drift to the right of same-depth peers.
  installGroupedIndentPatch(widget);
  try { widget[GROUP_INDENT] = Math.max(0, Number(indent) || 0); } catch (_) {}
}

function applyGroupedIndents(node, resolved) {
  const desired = new Map();
  for (const entry of resolved || []) {
    if (!entry?.active) continue;
    for (const child of entry.children || []) {
      const indent = entry.indentOverrides?.has(child) ? entry.indentOverrides.get(child) : TOP_LEVEL_INDENT;
      desired.set(child, indent);
    }
    for (const subgroup of entry.subgroups || []) {
      desired.set(subgroup.anchor, TOP_LEVEL_INDENT);
      for (const child of subgroup.children || []) desired.set(child, NESTED_INDENT);
    }
  }

  for (const widget of widgetsOf(node)) {
    if (!widget || isGroupedSectionHeader(widget)) continue;
    const next = Math.max(0, Number(desired.get(widget)) || 0);
    const current = Math.max(0, Number(widget?.[GROUP_INDENT]) || 0);
    if (current === next && (next === 0 || GROUP_INDENT_PATCHED.has(widget))) continue;
    setGroupedIndent(widget, next);
  }
}

function drawBranch(ctx, x, startY, endY, children, accent, branchEndX, branchless = null, allowBranchlessTerminal = false) {
  if (!children.length) return;
  const lastChild = children[children.length - 1] || null;
  // A branchless suffix (for example the Basic Settings narrator rows) should
  // not leave a detached horizontal tick or extend the trunk into rows that are
  // intentionally outside the visual hierarchy. Progress is the one exception:
  // Continue Speaking uses a deliberate terminal L-finish when its branchless
  // block is the final visible content.
  let lineEndChild = null;
  for (const child of children) {
    if (!branchless?.has(child.widget)) lineEndChild = child;
  }
  if (allowBranchlessTerminal && lastChild && branchless?.has(lastChild.widget)) lineEndChild = lastChild;
  if (!lineEndChild) return;

  const effectiveEndY = allowBranchlessTerminal && branchless?.has(lineEndChild.widget)
    ? lineEndChild.bounds.visualEnd
    : lineEndChild.bounds.center;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(x, startY);
  ctx.lineTo(x, Math.round(effectiveEndY) + 0.5);
  ctx.stroke();

  for (const child of children) {
    const suppressed = branchless?.has(child.widget);
    if (suppressed) {
      if (!(allowBranchlessTerminal && child === lineEndChild)) continue;
    }
    const branchY = suppressed ? child.bounds.visualEnd : child.bounds.center;
    const y = Math.round(branchY) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(branchEndX, y);
    ctx.stroke();
  }
}

function drawGroupedHierarchy(node, ctx) {
  if (!ctx) return;
  const state = NODE_GROUPS.get(node);
  const resolved = Array.isArray(state?.resolved) ? state.resolved : [];
  if (!resolved.length || state?.lineDrawReady === false) return;
  ctx.save();
  try {
    for (const entry of resolved) {
      if (!entry?.active || !entry?.header || isCollapsed(node, entry.group?.id)) continue;
      const headerBounds = widgetBounds(entry.header);
      if (!headerBounds) continue;
      const accent = entry.lineAccent || mutedAccent(entry.header?.[HEADER_ACCENT] || ACCENTS[entry.group?.kind] || ACCENTS.neutral);
      const visibleSubgroups = [];
      for (const subgroup of Array.isArray(entry.subgroups) ? entry.subgroups : []) {
        if (!subgroup?.anchor || widgetHidden(subgroup.anchor)) continue;
        const anchorBounds = widgetBounds(subgroup.anchor);
        if (!anchorBounds) continue;
        const children = visibleDecoratedChildren(subgroup.children);
        if (!children.length) continue;
        visibleSubgroups.push({ anchor: subgroup.anchor, anchorBounds, children, depth: subgroup.depth || 2 });
      }
      const topChildren = visibleDecoratedChildren(entry.topChildren || entry.children);
      if (!topChildren.length) continue;
      const x1 = 15.5;
      const x1End = 22.5;
      const startY = Math.round(headerBounds.bottom - 2) + 0.5;
      const endY = Math.round(topChildren[topChildren.length - 1].bounds.visualEnd) + 0.5;
      drawBranch(ctx, x1, startY, endY, topChildren, accent, x1End, entry.branchlessChildren, entry.group?.kind === "progress");
      for (const subgroup of visibleSubgroups) {
        const anchorY = Math.round(subgroup.anchorBounds.center) + 0.5;
        const x2 = 23.5;
        const x2End = 29.5;
        const nestedEndY = Math.round(subgroup.children[subgroup.children.length - 1].bounds.visualEnd) + 0.5;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(x1End, anchorY);
        ctx.lineTo(x2, anchorY);
        ctx.stroke();
        drawBranch(ctx, x2, anchorY, nestedEndY, subgroup.children, accent, x2End);
      }
    }
  } finally {
    ctx.restore();
  }
}

function installGroupedSectionDraw(node) {
  if (!node || GROUP_DRAW_INSTALLED.has(node)) return;
  GROUP_DRAW_INSTALLED.add(node);
  const previousForeground = node.onDrawForeground;
  node.onDrawForeground = function (...args) {
    const result = typeof previousForeground === "function" ? previousForeground.apply(this, args) : undefined;
    drawGroupedHierarchy(this, args[0]);
    return result;
  };
}

function schedulePostLayoutLineRedraw(node) {
  if (!node || GROUP_REDRAW_PENDING.has(node)) return;
  GROUP_REDRAW_PENDING.add(node);
  const complete = () => {
    GROUP_REDRAW_PENDING.delete(node);
    const state = NODE_GROUPS.get(node);
    if (state) state.lineDrawReady = true;
    requestRedraw(node);
  };
  try {
    if (typeof globalThis?.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(complete);
      return;
    }
  } catch (_) {}
  Promise.resolve().then(complete);
}

function groupedLayoutSignature(node, resolved) {
  const parts = [];
  for (const entry of resolved || []) {
    const id = String(entry?.group?.id || "");
    parts.push(id, entry?.active ? "1" : "0", isCollapsed(node, id) ? "1" : "0");
    if (!entry?.active) continue;
    for (const child of entry.children || []) {
      parts.push(widgetHidden(child) ? "0" : "1");
    }
  }
  return parts.join("");
}

function requestRedraw(node) {
  // LGraphNode.setDirtyCanvas already forwards to its graph in current LiteGraph.
  // Calling graph.setDirtyCanvas again doubles the same invalidation and makes
  // large grouped nodes feel sluggish during reset/toggle operations.
  try { node?.setDirtyCanvas?.(true, true); } catch (_) {}
}

function createHeader(node, group, widgetIndex = null) {
  const config = NODE_CONFIG.get(node);
  if (!node) return null;
  const name = `${HEADER_PREFIX}${group.id}`;
  let header = indexedWidget(node, widgetIndex, name);
  if (header) return header;

  const toggle = () => {
    const liveGroups = resolveGroups(node);
    const live = liveGroups.find((entry) => entry.id === group.id);
    if (!live) return;
    writeCollapsed(node, live.id, !isCollapsed(node, live.id));
    let resynced = false;
    try {
      config?.resync?.(node);
      resynced = true;
    } catch (_) {}
    // A successful resync already refreshes the grouped metadata and dirties the
    // canvas once at the end of the visibility transaction. Avoid a second paint
    // of stale pre-layout header coordinates.
    if (!resynced) refreshGroupedSections(node);
  };

  // Native LiteGraph button labels are always centre-aligned in current
  // ComfyUI renderers; the button's `align` option is not honoured.  Use one
  // tiny legacy custom widget only for the section header so its text can be
  // left-aligned without patching LiteGraph/ComfyUI globally.  The widget is
  // UI-only and keeps the same one-row height and click semantics.
  if (typeof node.addCustomWidget === "function") {
    header = {
      type: "custom",
      name,
      label: "",
      value: null,
      options: { serialize: false },
      serialize: false,
      serializeValue: () => undefined,
      computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 20],
      draw(ctx, owner, width, y, H) {
        if (!ctx) return;
        const margin = 15;
        const h = Number(H) || 20;
        const w = Number(width) || Number(owner?.size?.[0]) || 200;
        ctx.save();
        try {
          ctx.fillStyle = "#222";
          ctx.strokeStyle = "#666";
          ctx.lineWidth = 1;
          ctx.fillRect(margin, y, Math.max(1, w - margin * 2), h);
          ctx.strokeRect(margin, y, Math.max(1, w - margin * 2), h);
          // Draw the accent in the same widget pass using LiteGraph's current y.
          // Never read header.y from a later foreground pass: during reset/layout
          // that coordinate can lag behind the real widget position and leave a
          // visible "ghost" bar for one or more layout commits.
          ctx.fillStyle = String(this[HEADER_ACCENT] || ACCENTS.neutral);
          ctx.fillRect(5, y + 3, 3, Math.max(1, Math.min(18, h - 4)));
          ctx.fillStyle = "#ddd";
          ctx.textBaseline = "alphabetic";
          const textY = y + h * 0.7;
          const leftX = margin + 12;
          const rightX = w - margin - 10;
          const title = String(this[HEADER_TITLE] || this[HEADER_TEXT] || this.label || "");
          const summary = String(this[HEADER_SUMMARY] || "");
          ctx.textAlign = "left";
          ctx.fillText(title, leftX, textY);
          if (summary) {
            const titleWidth = Number(ctx.measureText?.(title)?.width) || 0;
            const summaryWidth = Number(ctx.measureText?.(summary)?.width) || 0;
            // Keep the original design: group name on the left, compact state on
            // the right.  On unusually narrow nodes, prefer the group title and
            // simply omit the summary rather than letting the two texts overlap.
            if (leftX + titleWidth + 18 <= rightX - summaryWidth) {
              ctx.textAlign = "right";
              ctx.fillText(summary, rightX, textY);
            }
          }
        } finally {
          ctx.restore();
        }
      },
      mouse(event) {
        const type = String(event?.type || "").toLowerCase();
        // Legacy custom widgets receive both down and up. Toggle only once on
        // release; this also prevents a drag/move from repeatedly toggling.
        if (type === "pointerup" || type === "mouseup") {
          toggle();
          return true;
        }
        return false;
      },
    };
    node.addCustomWidget(header);
  } else if (typeof node.addWidget === "function") {
    // Very old frontend fallback: retain the native button if custom widgets
    // are unavailable.  It stays functional, although text may be centred.
    header = node.addWidget("button", name, null, toggle, { serialize: false });
  }
  if (!header) return null;

  header.name = name;
  header.serialize = false;
  header.serializeValue = () => undefined;
  header.options = { ...(header.options || {}), serialize: false };
  header[HEADER_TITLE] = headerTitleText(node, group);
  header[HEADER_SUMMARY] = headerSummaryText(node, group);
  header[HEADER_TEXT] = headerText(node, group);
  header[HEADER_ACCENT] = ACCENTS[group.kind] || ACCENTS.neutral;
  header.label = header[HEADER_TEXT];
  const initialTooltip = displayTooltip(node, group);
  header.tooltip = initialTooltip;
  header.options = { ...(header.options || {}), tooltip: initialTooltip, serialize: false };
  header[HEADER_TOOLTIP_APPLIED] = initialTooltip;
  header[HEADER_MARKER] = true;
  try { WIDGET_NODE.set(header, node); } catch (_) {}
  try { config?.markUiOnly?.(header); } catch (_) {}
  try { widgetIndex?.set(name, header); } catch (_) {}
  return header;
}

function reorderHeaders(node, resolved) {
  const widgets = widgetsOf(node);
  if (!widgets.length) return false;

  const headers = widgets.filter(isGroupedSectionHeader);
  const headerSet = new Set(headers);
  const core = widgets.filter((widget) => !headerSet.has(widget));
  const insertion = new Map();
  const trailing = [];

  const coreIndex = new Map(core.map((widget, index) => [widget, index]));
  for (const entry of resolved) {
    const { header, children, active } = entry;
    if (!header) continue;
    const hidden = !active;
    if (header.hidden !== hidden || header?.options?.hidden !== hidden) {
      header.hidden = hidden;
      header.options = { ...(header.options || {}), hidden, serialize: false };
    }
    if (!active) continue;

    let anchorIndex = core.length;
    for (const child of children) {
      const index = coreIndex.get(child);
      if (index != null && index < anchorIndex) anchorIndex = index;
    }
    if (anchorIndex >= core.length) trailing.push(header);
    else {
      if (!insertion.has(anchorIndex)) insertion.set(anchorIndex, []);
      insertion.get(anchorIndex).push(header);
    }
  }

  const next = [];
  for (let index = 0; index < core.length; index += 1) {
    for (const header of insertion.get(index) || []) next.push(header);
    next.push(core[index]);
  }
  next.push(...trailing);
  for (const header of headers) if (!next.includes(header)) next.push(header);

  const changed = next.length !== widgets.length || next.some((widget, index) => widget !== widgets[index]);
  if (changed) widgets.splice(0, widgets.length, ...next);
  return changed;
}


export function isGroupedSectionHeader(widget) {
  return Boolean(widget?.[HEADER_MARKER] || String(widget?.name || "").startsWith(HEADER_PREFIX));
}

export function groupedWidgetVisible(node, widget, requestedVisible) {
  if (!requestedVisible || !widget || isGroupedSectionHeader(widget)) return Boolean(requestedVisible);
  const owner = node || WIDGET_NODE.get(widget) || null;
  const state = NODE_GROUPS.get(owner);
  const groupId = state?.widgetToGroup?.get(widget);
  if (!groupId || !isCollapsed(owner, groupId)) return true;
  // Keep already-connected promoted/widget sockets visible. This avoids hiding
  // live connection targets and preserves the established ghost-terminal guard.
  return inputConnectedForWidget(owner, widget);
}

export function clearGroupedSectionState(node) {
  if (node?.properties) delete node.properties[COLLAPSE_PROPERTY];
}

export function setAllGroupedSectionsCollapsed(node, collapsed = true, { refresh = true } = {}) {
  if (!node) return false;
  const groups = resolveGroups(node);
  if (!groups.length) return false;
  const next = { ...readCollapseMap(node) };
  let changed = false;
  for (const group of groups) {
    const id = String(group?.id || "");
    if (!id) continue;
    if (collapsed) {
      if (next[id] !== true) { next[id] = true; changed = true; }
    } else if (Object.prototype.hasOwnProperty.call(next, id)) {
      delete next[id];
      changed = true;
    }
  }
  if (!changed) return false;
  node.properties ??= {};
  if (Object.keys(next).length) node.properties[COLLAPSE_PROPERTY] = next;
  else delete node.properties[COLLAPSE_PROPERTY];
  if (refresh) refreshGroupedSections(node);
  return true;
}

export function configureGroupedSections(node, config) {
  if (!node || !config) return;
  NODE_CONFIG.set(node, config);
  installGroupedSectionDraw(node);
  refreshGroupedSections(node);
}

export function refreshGroupedSections(node, { redraw = true } = {}) {
  const config = NODE_CONFIG.get(node);
  if (!node || !config) return false;
  const widgetIndex = buildWidgetIndex(node);
  for (const widget of widgetsOf(node)) {
    try { WIDGET_NODE.set(widget, node); } catch (_) {}
  }
  const groups = resolveGroups(node);
  const validGroupIds = new Set(groups.map((group) => String(group.id)));
  const collapseMap = readCollapseMap(node);
  const staleCollapseIds = Object.keys(collapseMap).filter((id) => !validGroupIds.has(id));
  if (staleCollapseIds.length && node?.properties) {
    const nextCollapseMap = { ...collapseMap };
    for (const id of staleCollapseIds) delete nextCollapseMap[id];
    if (Object.keys(nextCollapseMap).length) node.properties[COLLAPSE_PROPERTY] = nextCollapseMap;
    else delete node.properties[COLLAPSE_PROPERTY];
  }

  const validHeaderNames = new Set(groups.map((group) => `${HEADER_PREFIX}${group.id}`));
  const liveWidgets = widgetsOf(node);
  for (let index = liveWidgets.length - 1; index >= 0; index -= 1) {
    const widget = liveWidgets[index];
    if (!isGroupedSectionHeader(widget) || validHeaderNames.has(String(widget?.name || ""))) continue;
    liveWidgets.splice(index, 1);
  }

  const widgetToGroup = new Map();
  const resolved = [];

  for (const group of groups) {
    const children = resolveChildren(node, group, widgetIndex);
    const indentOverrides = resolveIndentOverrides(node, group, widgetIndex);
    const branchlessChildren = resolveBranchlessChildren(node, group, widgetIndex);
    const subgroups = resolveSubgroups(node, group, widgetIndex);
    const active = groupIsActive(node, group, children);
    const header = createHeader(node, group, widgetIndex);
    const nestedSet = new Set();
    for (const subgroup of subgroups) for (const child of subgroup.children || []) nestedSet.add(child);
    const topChildren = children.filter((child) => !nestedSet.has(child));
    const lineAccent = mutedAccent(ACCENTS[group.kind] || ACCENTS.neutral);
    for (const child of children) widgetToGroup.set(child, group.id);
    resolved.push({ group, children, topChildren, indentOverrides, branchlessChildren, subgroups, active, header, lineAccent });
  }

  applyGroupedIndents(node, resolved);
  const previousState = NODE_GROUPS.get(node);
  const orderChanged = reorderHeaders(node, resolved);
  const lineSignature = groupedLayoutSignature(node, resolved);
  const layoutChanged = orderChanged || previousState?.lineSignature !== lineSignature;
  const state = {
    widgetToGroup,
    resolved,
    lineSignature,
    lineDrawReady: layoutChanged ? false : previousState?.lineDrawReady !== false,
  };
  NODE_GROUPS.set(node, state);
  if (layoutChanged) schedulePostLayoutLineRedraw(node);
  for (const entry of resolved) {
    if (entry.header) {
      const title = headerTitleText(node, entry.group);
      const summary = headerSummaryText(node, entry.group, entry.children);
      const text = summary ? `${title}  ·  ${summary}` : title;
      const tooltip = displayTooltip(node, entry.group);
      entry.header[HEADER_TITLE] = title;
      entry.header[HEADER_SUMMARY] = summary;
      entry.header[HEADER_TEXT] = text;
      entry.header[HEADER_ACCENT] = ACCENTS[entry.group.kind] || ACCENTS.neutral;
      if (entry.header.label !== text) entry.header.label = text;
      if (entry.header[HEADER_TOOLTIP_APPLIED] !== tooltip || !headerOptionsTooltipIsPlain(entry.header, tooltip)) {
        entry.header.tooltip = tooltip;
        entry.header.options = { ...(entry.header.options || {}), tooltip, serialize: false };
        entry.header[HEADER_TOOLTIP_APPLIED] = tooltip;
      }
    }
  }
  if (orderChanged) {
    try { config.refreshMetadata?.(node); } catch (_) {}
  }
  if (redraw) requestRedraw(node);
  return orderChanged;
}
