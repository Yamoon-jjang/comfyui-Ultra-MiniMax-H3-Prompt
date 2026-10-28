// Display-only connected STRING tooltip helper shared by Main and R2V.
// It never mutates graph links, widget values, node geometry, serialization,
// prompt generation, or upstream nodes. Values are resolved only when ComfyUI
// reads the target widget tooltip.

const TOOLTIP_STATE = new WeakMap();
const OVERLAY_TOOLTIP = Symbol.for("ultraH3.overlayTooltip");
const CONNECTED_TOOLTIP_ACTIVE = Symbol.for("ultraH3.connectedTooltipActive");
const CONNECTED_STRING_ACTIVE = Symbol.for("ultraH3.connectedStringActive");
const INPUT_LABEL_STATE = new WeakMap();
const MAX_CHARS = 420;
const CONNECTED_MARK = "↖";

function graphLinkById(node, linkId) {
  if (linkId == null || linkId === -1) return null;
  const graph = node?.graph;
  return graph?.links?.[linkId] ?? graph?._links?.get?.(linkId) ?? null;
}

function graphNodeById(graph, nodeId) {
  if (!graph || nodeId == null) return null;
  try {
    const direct = graph.getNodeById?.(nodeId);
    if (direct) return direct;
  } catch (_) {}
  return graph?._nodes_by_id?.[nodeId]
    ?? graph?._nodes?.find?.((candidate) => String(candidate?.id) === String(nodeId))
    ?? null;
}

function isStringInput(input) {
  const type = input?.type ?? input?.widget?.type;
  if (Array.isArray(type)) return type.some((item) => String(item).toUpperCase() === "STRING");
  return String(type ?? "").toUpperCase() === "STRING";
}

function parseTextEntries(value) {
  let parsed = value;
  if (typeof parsed === "string") {
    const text = parsed.trim();
    if (!text || (text[0] !== "{" && text[0] !== "[")) return null;
    try { parsed = JSON.parse(text); } catch (_) { return null; }
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) return null;
  return parsed.entries.map((entry) => {
    if (entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "text")) {
      return String(entry.text ?? "");
    }
    return typeof entry === "string" ? entry : null;
  });
}

function outputMappedWidgetValue(originNode, originSlot) {
  const widgets = Array.isArray(originNode?.widgets) ? originNode.widgets : [];
  const outputs = Array.isArray(originNode?.outputs) ? originNode.outputs : [];
  const output = outputs[originSlot];
  const outputType = String(output?.type ?? "").toUpperCase();
  if (outputType && outputType !== "STRING") return null;
  const names = [output?.widget?.name, output?.widget, output?.name]
    .filter((value) => typeof value === "string" && value);

  for (const name of names) {
    const widget = widgets.find((candidate) => candidate?.name === name || candidate?.label === name);
    if (widget && (typeof widget.value === "string" || widget.value == null)) return String(widget.value ?? "");
  }

  // Common direct text nodes expose one STRING output per text widget.
  const stringWidgets = widgets.filter((widget) => typeof widget?.value === "string" || widget?.value == null);
  const allOutputsString = outputs.length > 0 && outputs.every((item) => String(item?.type ?? "STRING").toUpperCase() === "STRING");
  if (originSlot >= 0 && originSlot < stringWidgets.length && outputs.length === stringWidgets.length && allOutputsString) {
    return String(stringWidgets[originSlot]?.value ?? "");
  }
  if (outputs.length === 1 && stringWidgets.length === 1 && allOutputsString) {
    return String(stringWidgets[0]?.value ?? "");
  }

  // Multi-output text nodes can keep rows in a compact {entries:[{text:...}]}
  // state object/string. Detect the data shape rather than any external node name.
  const containers = [
    ...widgets.map((widget) => widget?.value),
    originNode?.properties,
    originNode?.widgets_values,
  ];
  for (const candidate of containers) {
    const entries = parseTextEntries(candidate);
    if (entries && entries.length === outputs.length && originSlot >= 0 && originSlot < entries.length && entries[originSlot] != null) {
      return entries[originSlot];
    }
    if (candidate && typeof candidate === "object") {
      for (const nested of Object.values(candidate)) {
        const nestedEntries = parseTextEntries(nested);
        if (nestedEntries && nestedEntries.length === outputs.length && originSlot >= 0 && originSlot < nestedEntries.length && nestedEntries[originSlot] != null) {
          return nestedEntries[originSlot];
        }
      }
    }
  }
  return null;
}

function ultraTextboxTextLabel(originNode, originSlot) {
  // Ultra Textbox exposes each visible row as the matching output name
  // "Text 1", "Text 2", ... . Only this known node receives the label;
  // every other STRING source keeps the existing value-only tooltip.
  if (String(originNode?.comfyClass ?? originNode?.type ?? "") !== "UltraTextbox") return "";
  const outputName = String(originNode?.outputs?.[originSlot]?.name ?? "");
  return /^Text \d+$/.test(outputName) ? outputName : "";
}

function connectedStringValue(node, widgetName, hooks) {
  const index = hooks.inputIndex(node, widgetName);
  if (index < 0) return null;
  const input = node.inputs?.[index];
  if (!input || !isStringInput(input) || !hooks.inputConnected(node, widgetName)) return null;
  const linkId = input.link ?? (Array.isArray(input.links) ? input.links[0] : null);
  const link = graphLinkById(node, linkId);
  if (!link) return { connected: true, value: null, sourceLabel: "" };
  const originId = link.origin_id ?? link.originId;
  const originSlot = Number(link.origin_slot ?? link.originSlot ?? 0);
  const originNode = graphNodeById(node.graph, originId);
  if (!originNode || !Number.isInteger(originSlot) || originSlot < 0) {
    return { connected: true, value: null, sourceLabel: "" };
  }
  return {
    connected: true,
    value: outputMappedWidgetValue(originNode, originSlot),
    sourceLabel: ultraTextboxTextLabel(originNode, originSlot),
  };
}

function truncateTooltip(node, value, hooks) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const ko = hooks.locale(node) === "ko";
  if (!text) return ko ? "(빈 문자열)" : "(empty string)";
  if (text.length <= MAX_CHARS) return text;

  const head = text.slice(0, MAX_CHARS);
  const boundary = Math.max(head.lastIndexOf("\n"), head.lastIndexOf(" "));
  const cut = boundary >= Math.floor(MAX_CHARS * 0.72) ? boundary : MAX_CHARS;
  return `${head.slice(0, cut).trimEnd()}${ko ? "… (이하 생략)" : "… (truncated)"}`;
}

function tooltipText(node, widgetName, fallbackTooltip, hooks) {
  const resolved = connectedStringValue(node, widgetName, hooks);
  if (!resolved?.connected) return String(fallbackTooltip ?? "");
  if (resolved.value != null) {
    const valueText = truncateTooltip(node, resolved.value, hooks);
    return resolved.sourceLabel ? `${resolved.sourceLabel} : ${valueText}` : valueText;
  }
  return hooks.locale(node) === "ko"
    ? "(외부 STRING 연결 · 현재 값은 실행 시 결정됩니다.)"
    : "(External STRING connected · current value is resolved at execution time.)";
}

function connectedStringInput(node, widgetName, hooks) {
  const index = hooks.inputIndex(node, widgetName);
  if (index < 0) return false;
  const input = node.inputs?.[index];
  return !!input && isStringInput(input) && hooks.inputConnected(node, widgetName);
}

function displayLabel(node, widget, baseLabel, hooks) {
  if (!connectedStringInput(node, widget.name, hooks)) return baseLabel;
  if (baseLabel == null || String(baseLabel).trim() === "") return baseLabel;
  const visibleBase = String(baseLabel).trimEnd();
  return `${CONNECTED_MARK} ${visibleBase}`;
}

function refreshInputConnectionMark(node, widget, hooks) {
  const index = hooks.inputIndex(node, widget.name);
  if (index < 0) return;
  const input = node.inputs?.[index];
  if (!input || !isStringInput(input)) return;

  let state = INPUT_LABEL_STATE.get(input);
  const current = input.label;
  if (!state) {
    state = { baseLabel: current };
    INPUT_LABEL_STATE.set(input, state);
  } else {
    // Locale/reference rebuild code may legitimately replace the visible input
    // label. Treat any non-decorated replacement as the new canonical label.
    const decorated = state.baseLabel == null || String(state.baseLabel).trim() === ""
      ? state.baseLabel
      : `${CONNECTED_MARK} ${String(state.baseLabel).trimEnd()}`;
    if (current !== decorated && current !== state.baseLabel) state.baseLabel = current;
  }

  const connected = hooks.inputConnected(node, widget.name);
  const base = state.baseLabel;
  if (base == null || String(base).trim() === "") return;
  const next = connected ? `${CONNECTED_MARK} ${String(base).trimEnd()}` : base;
  if (input.label !== next) input.label = next;
}

function useNativeConnectedTooltip(widget) {
  // R2V Reference content/instruction rows already have a stable single-overlay
  // tooltip path. Keep that proven dynamic Reference UI untouched; this bridge
  // only restores the older Core STRING behavior (action/dialogue/instructions).
  return !String(widget?.name ?? "").startsWith("__r2v_");
}

function nativeConnectedTooltip(node, widget, state, hooks) {
  if (!useNativeConnectedTooltip(widget)) return "";
  // Connected STRING previews are content inspection, not ordinary help. Keep
  // them available even when the node's optional help-tooltips toggle is OFF.
  if (!connectedStringInput(node, widget.name, hooks)) return "";
  return tooltipText(node, widget.name, state.baseTooltip, hooks);
}

function bindNativeTooltipBridge(node, widget, state, hooks) {
  const options = widget?.options;
  if (!options || typeof options !== "object") return;
  if (state.optionsRef === options && state.optionsTooltipBound) return;

  // Dynamic UI code can replace widget.options while rebuilding locale/reference
  // rows. Preserve the newest static help text, but expose it through the native
  // tooltip path only while this STRING is actually connected. Unconnected help
  // remains owned by the single Ultra styled overlay.
  const current = options.tooltip;
  if (current != null && String(current) !== "") state.baseTooltip = String(current);

  try {
    Object.defineProperty(options, "tooltip", {
      configurable: true,
      enumerable: true,
      get() { return nativeConnectedTooltip(node, widget, state, hooks); },
      set(value) { state.baseTooltip = String(value ?? ""); },
    });
    state.optionsRef = options;
    state.optionsTooltipBound = true;
  } catch (_) {
    state.optionsRef = options;
    state.optionsTooltipBound = false;
  }
}

function installOne(node, widget, hooks) {
  if (!node || !widget) return;

  let state = TOOLTIP_STATE.get(widget);
  if (state) {
    bindNativeTooltipBridge(node, widget, state, hooks);
    return;
  }

  state = {
    baseTooltip: String(widget.tooltip ?? widget.options?.tooltip ?? ""),
    baseLabel: widget.label,
    optionsRef: null,
    optionsTooltipBound: false,
  };
  TOOLTIP_STATE.set(widget, state);

  let tooltipInstalled = false;
  try {
    Object.defineProperty(widget, OVERLAY_TOOLTIP, {
      configurable: true,
      value: () => tooltipText(node, widget.name, state.baseTooltip, hooks),
    });
    Object.defineProperty(widget, CONNECTED_STRING_ACTIVE, {
      configurable: true,
      value: () => connectedStringInput(node, widget.name, hooks),
    });
    Object.defineProperty(widget, CONNECTED_TOOLTIP_ACTIVE, {
      configurable: true,
      value: () => useNativeConnectedTooltip(widget) && connectedStringInput(node, widget.name, hooks),
    });
    Object.defineProperty(widget, "tooltip", {
      configurable: true,
      enumerable: true,
      get() {
        return nativeConnectedTooltip(node, widget, state, hooks);
      },
      set(value) {
        state.baseTooltip = String(value ?? "");
      },
    });
    bindNativeTooltipBridge(node, widget, state, hooks);
    tooltipInstalled = true;
  } catch (_) {}

  try {
    Object.defineProperty(widget, "label", {
      configurable: true,
      enumerable: true,
      get() {
        return displayLabel(node, widget, state.baseLabel, hooks);
      },
      set(value) {
        state.baseLabel = value;
      },
    });
  } catch (_) {
    // Label decoration is optional. Tooltip behavior remains intact if a future
    // frontend makes widget.label non-configurable.
  }

  if (!tooltipInstalled) {
    // Future-proof fail-closed path: preserve the original static tooltip.
    TOOLTIP_STATE.delete(widget);
  }
}

export function installConnectedStringTooltips(node, hooks) {
  if (!hooks?.inputIndex || !hooks?.inputConnected || !hooks?.locale) return;
  for (const widget of node?.widgets || []) {
    installOne(node, widget, hooks);
    refreshInputConnectionMark(node, widget, hooks);
  }
}
