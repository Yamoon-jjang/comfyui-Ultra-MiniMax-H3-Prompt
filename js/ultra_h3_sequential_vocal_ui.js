// Continue-Speaking UI for Ultra MiniMax H3.
//
// Recovery-baseline contract:
// - Add only the narrator direct text + Vocal 2/3 dialogue as real Core STRING inputs.
// - DO NOT write widget.y, node.size, setSize(), arrange(), or compute Core geometry.
// - DO NOT reorder any existing Core widget relative to another Core widget.
// - Only active Progress toggles are created up front. Voice legends/controls are
//   added lazily when Continue Speaking is enabled; ComfyUI/LiteGraph owns every
//   y coordinate and all subsequent layout.
// - Speaker/language/delivery state persists in Extension Options. Dialogue text
//   stays in Core STRING widgets so native external connections remain authoritative.

import { EXTENSION_OPTIONS_PROPERTY, EXTENSION_WIDGET_MARKER } from "./ultra_h3_extension_options.js";

const MAX_TURNS = 6;
const STATE_VERSION = 1;
const TOGGLE_PREFIX = "__ultra_seq_vocal_toggle_";
const LEGEND_PREFIX = "__ultra_seq_vocal_legend_";
const CONTROLS_PREFIX = "__ultra_seq_vocal_controls_";
const NARRATOR_PRESET_WIDGET = "__ultra_seq_narrator_voice_preset";
// Real Core optional STRING widget/input.  Do not create a frontend socket.
const NARRATOR_DESC_WIDGET = "narrator_voice_desc";
const ROW_INSET = 15;
const ROW_LABEL_OFFSET = 20;
const PLAIN_ROW_LABEL_OFFSET = 9;
export const SEQUENTIAL_VOCAL_WIDGET_MARKER = Symbol.for("ultraH3.sequentialVocalWidget");
const GROUP_VISUAL_END_OFFSET = Symbol.for("ultraH3.groupVisualEndOffset");
const INSTALLED = new WeakMap();

const SPEAKER_VALUES = Object.freeze(["A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "Narrator"]);
const LANGUAGE_VALUES = Object.freeze(["auto", "English", "Korean", "Japanese", "Chinese", "Spanish", "French", "German", "Russian", "Arabic", "Italian", "Portuguese"]);
const DELIVERY_VALUES = Object.freeze(["on_screen", "voiceover"]);
const NARRATOR_PRESET_VALUES = Object.freeze(["auto", "calm_neutral", "warm_female", "calm_female", "bright_female", "low_calm_male", "warm_male", "mature_male", "documentary", "news_information", "cinematic", "soft_emotional", "tense_low", "custom"]);

function activePersonCount(node) {
  const raw = Number(widgetByName(node, "person_count")?.value ?? 1);
  return Math.max(0, Math.min(3, Number.isFinite(raw) ? Math.trunc(raw) : 1));
}

function speakerValuesForNode(node) {
  const count = activePersonCount(node);
  if (count <= 0) return Object.freeze(["Narrator"]);
  if (count === 1) return Object.freeze(["A", "Narrator"]);
  if (count === 2) return Object.freeze(["A", "B", "A+B", "Narrator"]);
  return SPEAKER_VALUES;
}

function coerceSpeakerForNode(node, value) {
  const allowed = speakerValuesForNode(node);
  const source = String(value || "");
  if (allowed.includes(source)) return source;
  if (source === "Narrator" && allowed.includes("Narrator")) return "Narrator";
  const count = activePersonCount(node);
  if (count <= 0) return "Narrator";
  const active = ["A", "B", "C"].slice(0, count);
  const members = source.split("+").filter((member) => active.includes(member));
  const repaired = [...new Set(members)].join("+");
  if (allowed.includes(repaired)) return repaired;
  return active[0] || "Narrator";
}

const LABELS = Object.freeze({
  ko: Object.freeze({
    toggle: "이어 말하기",
    vocal: "발화",
    dialogue: "대사",
    speaker: "화자",
    language: "언어",
    delivery: "말하는 방식",
    on: "ON",
    off: "OFF",
    external: "외부 STRING 연결 사용 중",
    editDialogue: "대사 입력",
    cancel: "취소",
    ok: "확인",
    speakerValues: Object.freeze({ A: "인물 1", B: "인물 2", C: "인물 3", "A+B": "인물 1 + 2", "A+C": "인물 1 + 3", "B+C": "인물 2 + 3", "A+B+C": "인물 1 + 2 + 3", Narrator: "내레이터" }),
    languageValues: Object.freeze({ auto: "자동 · 한국어/영어 우선 판별", English: "영어", Korean: "한국어", Japanese: "일본어", Chinese: "중국어", Spanish: "스페인어", French: "프랑스어", German: "독일어", Russian: "러시아어", Arabic: "아랍어", Italian: "이탈리아어", Portuguese: "포르투갈어" }),
    deliveryValues: Object.freeze({ on_screen: "화면 속 인물이 직접 말함", voiceover: "화면 밖 보이스오버" }),
    narratorDelivery: "내레이터 · 화면 밖 해설",
    narratorVoice: "내레이터 음성",
    narratorVoiceDirect: "내레이터 음성 직접 입력",
    narratorVoiceEdit: "내레이터 음성 특성 입력",
    narratorPresetValues: Object.freeze({ auto: "자동 · 모델에 맡김", calm_neutral: "차분한 중립", warm_female: "따뜻한 여성", calm_female: "차분한 여성", bright_female: "밝은 여성", low_calm_male: "낮고 차분한 남성", warm_male: "따뜻한 남성", mature_male: "중후한 남성", documentary: "다큐멘터리", news_information: "뉴스 · 정보", cinematic: "시네마틱", soft_emotional: "부드러운 감성", tense_low: "긴장감 있는 낮은 해설", custom: "직접 입력" }),
  }),
  en: Object.freeze({
    toggle: "Continue Speaking",
    vocal: "Vocal",
    dialogue: "Dialogue",
    speaker: "Speaker",
    language: "Language",
    delivery: "Speaking Mode",
    on: "ON",
    off: "OFF",
    external: "External STRING connection",
    editDialogue: "Edit dialogue",
    cancel: "Cancel",
    ok: "OK",
    speakerValues: Object.freeze({ A: "Person 1", B: "Person 2", C: "Person 3", "A+B": "Person 1 + 2", "A+C": "Person 1 + 3", "B+C": "Person 2 + 3", "A+B+C": "Person 1 + 2 + 3", Narrator: "Narrator" }),
    languageValues: Object.freeze({ auto: "Auto · Korean/English priority", English: "English", Korean: "Korean", Japanese: "Japanese", Chinese: "Chinese", Spanish: "Spanish", French: "French", German: "German", Russian: "Russian", Arabic: "Arabic", Italian: "Italian", Portuguese: "Portuguese" }),
    deliveryValues: Object.freeze({ on_screen: "On-screen direct speech", voiceover: "Off-screen voiceover" }),
    narratorDelivery: "Narrator · off-screen voiceover",
    narratorVoice: "Narrator Voice",
    narratorVoiceDirect: "Narrator Voice Direct Input",
    narratorVoiceEdit: "Edit narrator voice characteristics",
    narratorPresetValues: Object.freeze({ auto: "Auto · let model decide", calm_neutral: "Calm neutral", warm_female: "Warm female", calm_female: "Calm female", bright_female: "Bright female", low_calm_male: "Low calm male", warm_male: "Warm male", mature_male: "Mature male", documentary: "Documentary", news_information: "News / information", cinematic: "Cinematic", soft_emotional: "Soft emotional", tense_low: "Low tense narration", custom: "Direct input" }),
  }),
});

function localeOf(localeOrFn, node) {
  let value = "en";
  try { value = typeof localeOrFn === "function" ? localeOrFn(node) : localeOrFn; } catch (_) {}
  return String(value || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
}

function widgetByName(node, name) {
  return (node?.widgets || []).find((widget) => widget?.name === name) || null;
}

function inputConnected(node, widgetName) {
  if (!Array.isArray(node?.inputs)) return false;
  return node.inputs.some((input) => {
    if ((input?.link == null || input.link === -1) && !input?.isConnected) return false;
    const name = input?._widget?.name || input?.widget?.name || input?.name;
    return name === widgetName;
  });
}

function extensionState(node, create = false) {
  if (!node) return null;
  node.properties ??= {};
  let state = node.properties[EXTENSION_OPTIONS_PROPERTY];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    if (!create) return null;
    state = { version: 2 };
    node.properties[EXTENSION_OPTIONS_PROPERTY] = state;
  }
  if (create && (!Number.isFinite(Number(state.version)) || Number(state.version) < 2)) state.version = 2;
  return state;
}

function sequentialState(node, create = false) {
  const ext = extensionState(node, create);
  if (!ext) return null;
  let seq = ext.sequential_vocal;
  if (!seq || typeof seq !== "object" || Array.isArray(seq)) {
    if (!create) return null;
    seq = { version: STATE_VERSION, turns: {} };
    ext.sequential_vocal = seq;
  }
  seq.version = STATE_VERSION;
  if (!seq.turns || typeof seq.turns !== "object" || Array.isArray(seq.turns)) seq.turns = {};
  return seq;
}

function turnState(node, turn, create = false) {
  const seq = sequentialState(node, create);
  if (!seq) return null;
  const key = String(turn);
  let state = seq.turns?.[key];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    if (!create) return null;
    state = { enabled: false };
    seq.turns[key] = state;
  }
  return state;
}

function pruneState(node) {
  const ext = extensionState(node, false);
  const seq = ext?.sequential_vocal;
  if (!seq || typeof seq !== "object") return;
  const turns = seq.turns;
  if (turns && typeof turns === "object") {
    for (const key of Object.keys(turns)) {
      const value = turns[key];
      if (!value || typeof value !== "object") { delete turns[key]; continue; }
      const hasStored = Boolean(value.enabled)
        || Boolean(String(value.text_2 || "")) || Boolean(String(value.text_3 || ""))
        || [1,2,3].some((slot) => Boolean(value[`speaker_${slot}`]))
        || [2,3].some((slot) => value[`language_${slot}`] || value[`delivery_${slot}`]);
      if (!hasStored) delete turns[key];
    }
  }
  const narratorPreset = String(seq.narrator_voice_preset || "auto");
  const narratorDesc = String(seq.narrator_voice_desc || "");
  if (!NARRATOR_PRESET_VALUES.includes(narratorPreset) || narratorPreset === "auto") delete seq.narrator_voice_preset;
  if (narratorPreset !== "custom" || !narratorDesc.trim()) delete seq.narrator_voice_desc;
  const hasNarratorState = Boolean(seq.narrator_voice_preset) || Boolean(seq.narrator_voice_desc);
  if ((!turns || Object.keys(turns).length === 0) && !hasNarratorState) delete ext.sequential_vocal;
  if (Object.keys(ext).every((key) => key === "version")) delete node.properties[EXTENSION_OPTIONS_PROPERTY];
}

export function sequentialVocalEnabled(node, turn) {
  return Boolean(turnState(node, turn, false)?.enabled);
}

export function sequentialNarratorWidgetNames() {
  return [NARRATOR_PRESET_WIDGET, NARRATOR_DESC_WIDGET];
}

export function sequentialNarratorUsesCustom(node) {
  return narratorPreset(node) === "custom";
}

function narratorPreset(node) {
  const value = String(sequentialState(node, false)?.narrator_voice_preset || "auto");
  return NARRATOR_PRESET_VALUES.includes(value) ? value : "auto";
}

function narratorDesc(node) {
  const core = widgetByName(node, NARRATOR_DESC_WIDGET);
  if (core) return String(core.value ?? "");
  return String(sequentialState(node, false)?.narrator_voice_desc || "");
}

function setNarratorPreset(node, preset) {
  const value = NARRATOR_PRESET_VALUES.includes(String(preset)) ? String(preset) : "auto";
  const seq = sequentialState(node, true);
  if (value === "auto") delete seq.narrator_voice_preset;
  else seq.narrator_voice_preset = value;
  if (value !== "custom") delete seq.narrator_voice_desc;
  pruneState(node);
}

function setNarratorDesc(node, value) {
  const text = String(value || "").slice(0, 1000);
  const widget = widgetByName(node, NARRATOR_DESC_WIDGET);
  if (widget) {
    if (String(widget.value ?? "") !== text) widget.value = text;
  } else {
    const seq = sequentialState(node, true);
    if (text.trim()) seq.narrator_voice_desc = text;
    else delete seq.narrator_voice_desc;
  }
  const seq = sequentialState(node, true);
  seq.narrator_voice_preset = "custom";
  pruneState(node);
}

function setSequentialEnabled(node, turn, enabled) {
  const state = turnState(node, turn, true);
  state.enabled = Boolean(enabled);
  if (state.enabled && !state.speaker_1) {
    const target = String(widgetByName(node, `turn_${turn}_speaker`)?.value || "A");
    state.speaker_1 = coerceSpeakerForNode(node, target);
  }
  pruneState(node);
}

function getField(node, turn, slot, field) {
  const state = turnState(node, turn, false) || {};
  if (slot === 1) {
    if (field === "speaker") {
      const stored = SPEAKER_VALUES.includes(String(state.speaker_1 || ""))
        ? String(state.speaker_1)
        : String(widgetByName(node, `turn_${turn}_speaker`)?.value || "A");
      return coerceSpeakerForNode(node, stored);
    }
    if (field === "dialogue") return String(widgetByName(node, `turn_${turn}_dialogue_text`)?.value || "");
    if (field === "language") return String(widgetByName(node, `turn_${turn}_dialogue_language`)?.value || "auto");
    if (field === "delivery") return String(widgetByName(node, `turn_${turn}_dialogue_delivery`)?.value || "on_screen");
  }
  if (field === "dialogue") {
    const core = widgetByName(node, vocalTextWidgetName(turn, slot));
    return core ? String(core.value ?? "") : String(state[`text_${slot}`] || "");
  }
  if (field === "speaker") {
    const stored = SPEAKER_VALUES.includes(String(state[`speaker_${slot}`] || "")) ? String(state[`speaker_${slot}`]) : "A";
    return coerceSpeakerForNode(node, stored);
  }
  if (field === "language") return LANGUAGE_VALUES.includes(String(state[`language_${slot}`] || "")) ? String(state[`language_${slot}`]) : "auto";
  if (field === "delivery") return DELIVERY_VALUES.includes(String(state[`delivery_${slot}`] || "")) ? String(state[`delivery_${slot}`]) : "on_screen";
  return "";
}

function commitCoreWidget(node, name, value) {
  const widget = widgetByName(node, name);
  if (!widget) return false;
  if (widget.value === value) return false;
  widget.value = value;
  try { widget.callback?.call(widget, value); } catch (_) {}
  return true;
}

function setField(node, turn, slot, field, value) {
  if (slot === 1) {
    if (field === "speaker") {
      if (!speakerValuesForNode(node).includes(String(value))) return false;
      const state = turnState(node, turn, true);
      if (state.speaker_1 === value) return false;
      state.speaker_1 = String(value);
      return true;
    }
    if (field === "dialogue") return commitCoreWidget(node, `turn_${turn}_dialogue_text`, String(value || ""));
    if (field === "language") return LANGUAGE_VALUES.includes(String(value)) && commitCoreWidget(node, `turn_${turn}_dialogue_language`, String(value));
    if (field === "delivery") return DELIVERY_VALUES.includes(String(value)) && commitCoreWidget(node, `turn_${turn}_dialogue_delivery`, String(value));
    return false;
  }
  const state = turnState(node, turn, true);
  if (field === "dialogue") {
    const text = String(value || "").slice(0, 8000);
    const core = widgetByName(node, vocalTextWidgetName(turn, slot));
    if (core) return commitCoreWidget(node, core.name, text);
    if (state[`text_${slot}`] === text) return false;
    state[`text_${slot}`] = text;
    return true;
  }
  if (field === "speaker" && speakerValuesForNode(node).includes(String(value))) {
    if (state[`speaker_${slot}`] === value) return false;
    state[`speaker_${slot}`] = String(value);
    return true;
  }
  if (field === "language" && LANGUAGE_VALUES.includes(String(value))) {
    if (state[`language_${slot}`] === value) return false;
    state[`language_${slot}`] = String(value);
    return true;
  }
  if (field === "delivery" && DELIVERY_VALUES.includes(String(value))) {
    if (state[`delivery_${slot}`] === value) return false;
    state[`delivery_${slot}`] = String(value);
    return true;
  }
  return false;
}

function notify(node, installed, meta = {}) {
  pruneState(node);
  try { installed?.onChange?.(node, meta); } catch (_) {}
  try { node?.setDirtyCanvas?.(true, true); } catch (_) {}
}

function insertAfterCoreAnchorOnce(node, widget, anchorName, afterWidget = null) {
  const widgets = node?.widgets;
  if (!Array.isArray(widgets) || !widget) return false;
  const current = widgets.indexOf(widget);
  if (current < 0) return false;
  const anchor = afterWidget && widgets.includes(afterWidget) ? widgets.indexOf(afterWidget) : widgets.findIndex((item) => item?.name === anchorName);
  if (anchor < 0 || current === anchor + 1) return false;
  widgets.splice(current, 1);
  const liveAnchor = afterWidget && widgets.includes(afterWidget) ? widgets.indexOf(afterWidget) : widgets.findIndex((item) => item?.name === anchorName);
  widgets.splice(Math.max(0, liveAnchor + 1), 0, widget);
  return true;
}

function roundedRect(ctx, x, y, width, height, radius = 9) {
  const r = Math.max(2, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  const value = String(text || "");
  if (!ctx?.measureText || ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function drawRow(ctx, width, y, label, value, { disabled = false, arrows = false, height = 25 } = {}) {
  const x = ROW_INSET;
  const w = Math.max(80, width - ROW_INSET * 2);
  const h = Math.max(18, Number(height) || 25);
  ctx.save();
  try {
    roundedRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = disabled ? "#252525" : "#202020";
    ctx.strokeStyle = disabled ? "#515151" : "#666";
    ctx.lineWidth = 1;
    ctx.fill(); ctx.stroke();
    ctx.font = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = disabled ? "#777" : "#aaa";
    ctx.fillText(label, x + (arrows ? ROW_LABEL_OFFSET : PLAIN_ROW_LABEL_OFFSET), y + h / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = disabled ? "#888" : "#ddd";
    ctx.fillText(truncate(ctx, value, Math.max(60, w * 0.56)), x + w - (arrows ? 35 : 20), y + h / 2);
    if (arrows && !disabled) {
      ctx.textAlign = "center"; ctx.fillStyle = "#ccc";
      ctx.fillText("◀", x + 13, y + h / 2);
      ctx.fillText("▶", x + w - 13, y + h / 2);
    }
  } finally { ctx.restore(); }
}

function drawLegend(ctx, width, y, title) {
  const left = ROW_INSET, right = Math.max(80, width - ROW_INSET), h = 18;
  ctx.save();
  try {
    ctx.font = "bold 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#ddd";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, left, y + h / 2);
    const titleWidth = Math.ceil(ctx.measureText?.(title)?.width || 42);
    const lineStart = Math.min(right, left + titleWidth + 10);
    if (lineStart < right) {
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineStart, y + h / 2);
      ctx.lineTo(right, y + h / 2);
      ctx.stroke();
    }
  } finally { ctx.restore(); }
}

function panelMetrics(width) {
  const rowH = 25, gap = 5, legendH = 18, legendGap = 3;
  const blockH = legendH + legendGap + rowH * 4 + gap * 3 + 7;
  return { rowH, gap, legendH, legendGap, blockH, height: blockH * 3 + 2 };
}

function panelHit(width, localY) {
  const m = panelMetrics(width);
  if (!Number.isFinite(localY) || localY < 0 || localY > m.height) return null;
  const slot = Math.max(1, Math.min(3, Math.floor(localY / m.blockH) + 1));
  const inside = localY - (slot - 1) * m.blockH - m.legendH - m.legendGap;
  if (inside < 0) return null;
  const stride = m.rowH + m.gap;
  const row = Math.floor(inside / stride);
  if (row < 0 || row > 3 || (inside % stride) > m.rowH) return null;
  return { slot, field: ["dialogue", "speaker", "language", "delivery"][row] };
}

let activePopup = null;
function closePopup() {
  const popup = activePopup; activePopup = null;
  if (!popup) return;
  try { popup.cleanup?.(); } catch (_) {}
  try { popup.element?.remove?.(); } catch (_) {}
}

function openTextEditor(event, initial, title, commit, buttonLabels = { cancel: "Cancel", ok: "OK" }, maxLength = 8000) {
  if (typeof document === "undefined" || !document.body) {
    const next = typeof window !== "undefined" ? window.prompt?.(title, initial) : null;
    if (next != null) commit(next);
    return;
  }
  closePopup();
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { position: "fixed", zIndex: "100000", width: "min(560px, calc(100vw - 24px))", padding: "10px", border: "1px solid #666", borderRadius: "10px", background: "#171717", boxShadow: "0 12px 32px rgba(0,0,0,.5)" });
  const label = document.createElement("div"); label.textContent = title; Object.assign(label.style, { color: "#ddd", fontSize: "13px", marginBottom: "7px" });
  const area = document.createElement("textarea"); area.value = initial; area.maxLength = Math.max(1, Number(maxLength) || 8000); Object.assign(area.style, { width: "100%", minHeight: "92px", boxSizing: "border-box", resize: "vertical", background: "#222", color: "#eee", border: "1px solid #555", borderRadius: "7px", padding: "8px", font: "13px sans-serif" });
  const actions = document.createElement("div"); Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "7px", marginTop: "8px" });
  const cancel = document.createElement("button"); cancel.textContent = buttonLabels.cancel || "Cancel";
  const save = document.createElement("button"); save.textContent = buttonLabels.ok || "OK";
  for (const button of [cancel, save]) Object.assign(button.style, { background: "#2a2a2a", color: "#eee", border: "1px solid #666", borderRadius: "6px", padding: "5px 12px" });
  actions.append(cancel, save); wrap.append(label, area, actions); document.body.appendChild(wrap);
  const vw = window.innerWidth || 800, vh = window.innerHeight || 600;
  const x = Math.max(8, Math.min(Number(event?.clientX || vw / 2) - 120, vw - Math.min(560, vw - 24) - 8));
  const y = Math.max(8, Math.min(Number(event?.clientY || vh / 2) - 40, vh - 190));
  wrap.style.left = `${x}px`; wrap.style.top = `${y}px`;
  const cleanup = () => document.removeEventListener("keydown", keydown, true);
  const finish = (saveValue) => { const value = area.value; closePopup(); if (saveValue) commit(value); };
  const keydown = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(false); } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); finish(true); } };
  document.addEventListener("keydown", keydown, true);
  cancel.onclick = () => finish(false); save.onclick = () => finish(true);
  activePopup = { element: wrap, cleanup };
  setTimeout(() => { try { area.focus(); area.select(); } catch (_) {} }, 0);
}

function openChoicePopup(event, values, current, labelFor, commit, options = null) {
  if (typeof document === "undefined" || !document.body) return false;
  closePopup();
  const compactPersonList = options?.compactPersonList === true;
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    zIndex: "100000",
    maxHeight: "min(420px, calc(100vh - 20px))",
    overflowY: "auto",
    minWidth: compactPersonList ? "170px" : "260px",
    maxWidth: compactPersonList ? "220px" : "none",
    padding: compactPersonList ? "3px" : "5px",
    border: "1px solid #666",
    borderRadius: compactPersonList ? "6px" : "9px",
    background: "#191919",
    boxShadow: "0 12px 30px rgba(0,0,0,.5)",
    font: compactPersonList ? "13px system-ui, -apple-system, 'Segoe UI', sans-serif" : "",
    lineHeight: compactPersonList ? "1.25" : "normal",
  });
  for (const value of values) {
    const row = document.createElement("button"); row.type = "button"; row.textContent = labelFor(value);
    Object.assign(row.style, {
      display: "block",
      width: "100%",
      textAlign: "left",
      border: "0",
      borderRadius: compactPersonList ? "4px" : "6px",
      padding: compactPersonList ? "5px 8px" : "7px 10px",
      margin: compactPersonList ? "0" : "1px 0",
      background: value === current ? "#383838" : "transparent",
      color: "#eee",
      cursor: "pointer",
      font: compactPersonList ? "inherit" : "",
      lineHeight: compactPersonList ? "inherit" : "normal",
      whiteSpace: "nowrap",
    });
    row.onclick = () => { closePopup(); commit(value); };
    wrap.appendChild(row);
  }
  document.body.appendChild(wrap);
  const rect = wrap.getBoundingClientRect();
  const vw = window.innerWidth || 800, vh = window.innerHeight || 600;
  const x = Math.max(6, Math.min(Number(event?.clientX || 20), vw - rect.width - 6));
  const y = Math.max(6, Math.min(Number(event?.clientY || 20), vh - rect.height - 6));
  wrap.style.left = `${x}px`; wrap.style.top = `${y}px`;
  const outside = (e) => { if (!wrap.contains(e.target)) closePopup(); };
  const keydown = (e) => { if (e.key === "Escape") closePopup(); };
  const cleanup = () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", keydown, true); };
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  document.addEventListener("keydown", keydown, true);
  activePopup = { element: wrap, cleanup };
  return true;
}

function cycle(values, current, direction) {
  const index = Math.max(0, values.indexOf(String(current)));
  return values[Math.max(0, Math.min(values.length - 1, index + direction))];
}

function createNarratorPresetWidget(node, installed) {
  const widget = {
    type: "custom",
    name: NARRATOR_PRESET_WIDGET,
    label: "",
    value: null,
    options: { serialize: false },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 20],
    draw(ctx, owner, width, y, H) {
      if (!ctx) return;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      const preset = narratorPreset(node);
      drawRow(ctx, Number(width) || Number(owner?.size?.[0]) || 200, y, text.narratorVoice, text.narratorPresetValues[preset] || preset, { arrows: true, height: 20 });
    },
    mouse(event, pos, owner) {
      const type = String(event?.type || "").toLowerCase();
      if (type !== "pointerup" && type !== "mouseup") return false;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      const current = narratorPreset(node);
      const width = Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 200;
      const localX = Array.isArray(pos) ? Number(pos[0]) : NaN;
      const commit = (value) => { setNarratorPreset(node, value); notify(node, installed, { kind: "narrator_voice_preset" }); };
      if (Number.isFinite(localX) && (localX < ROW_INSET || localX > width - ROW_INSET)) return false;
      if (Number.isFinite(localX) && localX <= ROW_INSET + 27) { commit(cycle(NARRATOR_PRESET_VALUES, current, -1)); return true; }
      if (Number.isFinite(localX) && localX >= width - ROW_INSET - 27) { commit(cycle(NARRATOR_PRESET_VALUES, current, 1)); return true; }
      if (!openChoicePopup(event, NARRATOR_PRESET_VALUES, current, (value) => text.narratorPresetValues[value] || value, commit)) commit(cycle(NARRATOR_PRESET_VALUES, current, 1));
      return true;
    },
  };
  widget[EXTENSION_WIDGET_MARKER] = { name: widget.name, scope: "sequential_vocal", narrator: true };
  widget[SEQUENTIAL_VOCAL_WIDGET_MARKER] = true;
  node.addCustomWidget(widget);
  return widget;
}

function vocalTextWidgetName(turn, slot) {
  if (slot === 1) return `turn_${turn}_dialogue_text`;
  return `turn_${turn}_vocal_${slot}_text`;
}

function prepareCoreStringWidget(node, widget, installed) {
  if (!widget) return null;
  if (!widget.__ultraSeqCoreStringPrepared) {
    const originalCallback = widget.callback;
    widget.callback = function(value, ...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.call(this, value, ...args)
        : undefined;
      notify(node, installed, { kind: "core_string", name: widget.name });
      return result;
    };
    try { widget.__ultraSeqCoreStringPrepared = true; } catch (_) {}
  }
  return widget;
}


function createToggleWidget(node, turn, installed) {
  const widget = {
    type: "custom",
    name: `${TOGGLE_PREFIX}${turn}`,
    label: "",
    value: null,
    options: { serialize: false },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 22],
    draw(ctx, owner, width, y, H) {
      if (!ctx) return;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      const enabled = sequentialVocalEnabled(node, turn);
      const h = Number(H) || 22, w = Number(width) || Number(owner?.size?.[0]) || 200;
      ctx.save();
      try {
        roundedRect(ctx, ROW_INSET, y, Math.max(80, w - ROW_INSET * 2), h, 10);
        ctx.fillStyle = "#202020"; ctx.strokeStyle = "#666"; ctx.fill(); ctx.stroke();
        ctx.font = "12px system-ui, -apple-system, 'Segoe UI', sans-serif"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#bbb"; ctx.textAlign = "left"; ctx.fillText(text.toggle, ROW_INSET + PLAIN_ROW_LABEL_OFFSET, y + h / 2);
        ctx.fillStyle = enabled ? "#ddd" : "#999"; ctx.textAlign = "right"; ctx.fillText(enabled ? text.on : text.off, w - ROW_INSET - 32, y + h / 2);
        ctx.beginPath(); ctx.arc(w - ROW_INSET - 13, y + h / 2, 7, 0, Math.PI * 2); ctx.fillStyle = enabled ? "#777" : "#444"; ctx.fill();
      } finally { ctx.restore(); }
    },
    mouse(event, pos, owner) {
      const type = String(event?.type || "").toLowerCase();
      if (type !== "pointerup" && type !== "mouseup") return false;
      const width = Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 200;
      const localX = Array.isArray(pos) ? Number(pos[0]) : NaN;
      if (Number.isFinite(localX) && (localX < ROW_INSET || localX > width - ROW_INSET)) return false;
      setSequentialEnabled(node, turn, !sequentialVocalEnabled(node, turn));
      notify(node, installed, { turn, kind: "toggle" });
      return true;
    },
  };
  widget[EXTENSION_WIDGET_MARKER] = { name: widget.name, scope: "sequential_vocal", turn };
  widget[SEQUENTIAL_VOCAL_WIDGET_MARKER] = true;
  node.addCustomWidget(widget);
  return widget;
}

function createLegendWidget(node, turn, slot, installed) {
  const widget = {
    type: "custom",
    name: `${LEGEND_PREFIX}${turn}_${slot}`,
    label: "",
    value: null,
    options: { serialize: false },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 18],
    draw(ctx, owner, width, y) {
      if (!ctx) return;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      drawLegend(ctx, Number(width) || Number(owner?.size?.[0]) || 200, y, `${text.vocal} ${slot}`);
    },
  };
  widget[EXTENSION_WIDGET_MARKER] = { name: widget.name, scope: "sequential_vocal", turn, slot };
  widget[SEQUENTIAL_VOCAL_WIDGET_MARKER] = true;
  node.addCustomWidget(widget);
  return widget;
}

function controlsMetrics() {
  return { rowH: 25, gap: 5, height: 25 * 3 + 5 * 2 + 2 };
}

function controlsHit(localY) {
  const m = controlsMetrics();
  if (!Number.isFinite(localY) || localY < 0 || localY > m.height) return null;
  const stride = m.rowH + m.gap;
  const row = Math.floor(localY / stride);
  if (row < 0 || row > 2) return null;
  const inside = localY - row * stride;
  if (inside > m.rowH) return null;
  return ["speaker", "language", "delivery"][row];
}

function createControlsWidget(node, turn, slot, installed) {
  const widget = {
    type: "custom",
    name: `${CONTROLS_PREFIX}${turn}_${slot}`,
    label: "",
    value: null,
    options: { serialize: false },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, controlsMetrics().height],
    draw(ctx, owner, width, y) {
      if (!ctx) return;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      const w = Number(width) || Number(owner?.size?.[0]) || 200;
      const m = controlsMetrics();
      let rowY = y;
      const speaker = getField(node, turn, slot, "speaker");
      drawRow(ctx, w, rowY, text.speaker, text.speakerValues[speaker] || speaker, { arrows: true }); rowY += m.rowH + m.gap;
      const language = getField(node, turn, slot, "language");
      drawRow(ctx, w, rowY, text.language, text.languageValues[language] || language, { arrows: true }); rowY += m.rowH + m.gap;
      const narrator = speaker === "Narrator";
      const delivery = getField(node, turn, slot, "delivery");
      drawRow(ctx, w, rowY, text.delivery, narrator ? text.narratorDelivery : (text.deliveryValues[delivery] || delivery), { disabled: narrator, arrows: !narrator });
    },
    mouse(event, pos, owner) {
      const type = String(event?.type || "").toLowerCase();
      if (type !== "pointerup" && type !== "mouseup") return false;
      const width = Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 200;
      let localY = NaN;
      if (Array.isArray(pos) && Number.isFinite(Number(pos[1])) && Number.isFinite(Number(this.y))) localY = Number(pos[1]) - Number(this.y);
      if (!Number.isFinite(localY) && Number.isFinite(Number(event?.canvasY)) && Array.isArray(node?.pos) && Number.isFinite(Number(this.y))) localY = Number(event.canvasY) - Number(node.pos[1] || 0) - Number(this.y);
      const field = controlsHit(localY);
      if (!field) return false;
      const locale = localeOf(installed.locale, node), text = LABELS[locale];
      let values, labels;
      if (field === "speaker") { values = speakerValuesForNode(node); labels = text.speakerValues; }
      else if (field === "language") { values = LANGUAGE_VALUES; labels = text.languageValues; }
      else { values = DELIVERY_VALUES; labels = text.deliveryValues; }
      if (field === "delivery" && getField(node, turn, slot, "speaker") === "Narrator") return true;
      const current = getField(node, turn, slot, field);
      const localX = Array.isArray(pos) ? Number(pos[0]) : NaN;
      const edge = ROW_INSET + 27;
      const commit = (value) => { if (setField(node, turn, slot, field, value)) notify(node, installed, { turn, slot, field }); };
      if (Number.isFinite(localX) && (localX < ROW_INSET || localX > width - ROW_INSET)) return false;
      if (Number.isFinite(localX) && localX <= edge) { commit(cycle(values, current, -1)); return true; }
      if (Number.isFinite(localX) && localX >= width - edge) { commit(cycle(values, current, 1)); return true; }
      const popupOptions = field === "speaker" ? { compactPersonList: true } : null;
      if (!openChoicePopup(event, values, current, (value) => labels[value] || value, commit, popupOptions)) commit(cycle(values, current, 1));
      return true;
    },
  };
  widget[EXTENSION_WIDGET_MARKER] = { name: widget.name, scope: "sequential_vocal", turn, slot };
  widget[SEQUENTIAL_VOCAL_WIDGET_MARKER] = true;
  const metrics = controlsMetrics();
  // Group hierarchy lines should end at the final visible internal row
  // (Speaking Mode), not at the center of this three-row composite widget.
  widget[GROUP_VISUAL_END_OFFSET] = (metrics.rowH + metrics.gap) * 2 + metrics.rowH / 2;
  node.addCustomWidget(widget);
  return widget;
}


export function sequentialVocalWidgetNames(turn) {
  const index = Math.max(1, Math.min(MAX_TURNS, Number(turn) || 1));
  return [
    `${TOGGLE_PREFIX}${index}`,
    `${LEGEND_PREFIX}${index}_1`, `${CONTROLS_PREFIX}${index}_1`,
    `${LEGEND_PREFIX}${index}_2`, vocalTextWidgetName(index, 2), `${CONTROLS_PREFIX}${index}_2`,
    `${LEGEND_PREFIX}${index}_3`, vocalTextWidgetName(index, 3), `${CONTROLS_PREFIX}${index}_3`,
  ];
}

function ensureTurnUi(node, installed, turn, { details = false } = {}) {
  let changed = false;
  let entry = installed.turns.find((item) => item.turn === turn) || null;
  if (!entry) {
    const toggle = createToggleWidget(node, turn, installed);
    const text2 = prepareCoreStringWidget(node, widgetByName(node, vocalTextWidgetName(turn, 2)), installed);
    const text3 = prepareCoreStringWidget(node, widgetByName(node, vocalTextWidgetName(turn, 3)), installed);
    changed = insertAfterCoreAnchorOnce(node, toggle, `turn_${turn}_dialogue_text`) || changed;
    entry = {
      turn, toggle, text2, text3,
      legend1: null, controls1: null, legend2: null, controls2: null, legend3: null, controls3: null,
    };
    installed.turns.push(entry);
    installed.turns.sort((left, right) => left.turn - right.turn);
    changed = true;
  }

  if (details && !entry.legend1) {
    entry.legend1 = createLegendWidget(node, turn, 1, installed);
    entry.controls1 = createControlsWidget(node, turn, 1, installed);
    entry.legend2 = createLegendWidget(node, turn, 2, installed);
    entry.controls2 = createControlsWidget(node, turn, 2, installed);
    entry.legend3 = createLegendWidget(node, turn, 3, installed);
    entry.controls3 = createControlsWidget(node, turn, 3, installed);

    changed = insertAfterCoreAnchorOnce(node, entry.legend1, `turn_${turn}_dialogue_text`, entry.toggle) || changed;
    changed = insertAfterCoreAnchorOnce(node, entry.controls1, `turn_${turn}_dialogue_text`, entry.legend1) || changed;
    changed = insertAfterCoreAnchorOnce(node, entry.legend2, `turn_${turn}_dialogue_text`, entry.controls1) || changed;
    changed = insertAfterCoreAnchorOnce(node, entry.controls2, vocalTextWidgetName(turn, 2)) || changed;
    changed = insertAfterCoreAnchorOnce(node, entry.legend3, vocalTextWidgetName(turn, 2), entry.controls2) || changed;
    changed = insertAfterCoreAnchorOnce(node, entry.controls3, vocalTextWidgetName(turn, 3)) || changed;
    changed = true;
  }
  return changed;
}

export function installSequentialVocalUi(node, { locale = "en", onChange = null } = {}) {
  if (!node || typeof node.addCustomWidget !== "function") return false;
  if (INSTALLED.has(node)) return false;
  const installed = { locale, onChange, turns: [], narrator: null };
  INSTALLED.set(node, installed);
  let changed = hydrateLegacySequentialTextIntoCore(node);

  const narratorPresetWidget = createNarratorPresetWidget(node, installed);
  const narratorDescWidget = prepareCoreStringWidget(node, widgetByName(node, NARRATOR_DESC_WIDGET), installed);
  // Python places the Core narrator text immediately after visual_style. Insert
  // only the UI-only preset row before it; never move the Core STRING widget.
  changed = insertAfterCoreAnchorOnce(node, narratorPresetWidget, "visual_style") || changed;
  installed.narrator = { preset: narratorPresetWidget, desc: narratorDescWidget };

  const activeTurns = Math.max(1, Math.min(MAX_TURNS, Number(widgetByName(node, "turn_count")?.value) || 1));
  for (let turn = 1; turn <= activeTurns; turn++) {
    changed = ensureTurnUi(node, installed, turn, { details: sequentialVocalEnabled(node, turn) }) || changed;
  }
  return changed;
}

export function refreshSequentialVocalLabels(node, { turnCount = 1 } = {}) {
  const installed = INSTALLED.get(node);
  if (!installed) return false;
  const activeTurns = Math.max(1, Math.min(MAX_TURNS, Number(turnCount) || 1));
  const locale = localeOf(installed.locale, node), text = LABELS[locale];
  let changed = false;
  for (let turn = 1; turn <= activeTurns; turn++) {
    changed = ensureTurnUi(node, installed, turn, { details: sequentialVocalEnabled(node, turn) }) || changed;
  }
  const setLabel = (widget, label) => {
    if (!widget || widget.label === label) return;
    widget.label = label;
    changed = true;
  };

  setLabel(installed.narrator?.desc, text.narratorVoiceDirect);
  for (const entry of installed.turns) {
    const active = entry.turn <= activeTurns;
    const enabled = active && sequentialVocalEnabled(node, entry.turn);
    const primaryDialogue = widgetByName(node, `turn_${entry.turn}_dialogue_text`);
    setLabel(
      primaryDialogue,
      enabled ? text.dialogue : (locale === "ko" ? `진행 ${entry.turn} 대사` : `Progress ${entry.turn} Dialogue`),
    );
    setLabel(entry.text2, text.dialogue);
    setLabel(entry.text3, text.dialogue);
  }
  return changed;
}

export function refreshSequentialVocalUi(node, { turnCount = 1, requestedVisible = null } = {}) {
  const installed = INSTALLED.get(node);
  if (!installed) return false;
  const activeTurns = Math.max(1, Math.min(MAX_TURNS, Number(turnCount) || 1));
  let changed = refreshSequentialVocalLabels(node, { turnCount: activeTurns });
  const apply = (widget, visible) => {
    if (!widget) return;
    const connected = inputConnected(node, String(widget.name || ""));
    const wanted = Boolean(visible || connected);
    const finalVisible = typeof requestedVisible === "function" ? Boolean(requestedVisible(widget, wanted)) : wanted;
    const hidden = !finalVisible;
    if (widget?.options?.hidden !== hidden) widget.options = { ...(widget.options || {}), hidden };
    if (widget.hidden !== hidden) { widget.hidden = hidden; changed = true; }
  };
  apply(installed.narrator?.preset, true);
  if (installed.narrator?.desc) apply(installed.narrator.desc, narratorPreset(node) === "custom");
  for (const entry of installed.turns) {
    const active = entry.turn <= activeTurns;
    const enabled = active && sequentialVocalEnabled(node, entry.turn);
    apply(entry.toggle, active);
    for (const key of ["legend1", "controls1", "legend2", "text2", "controls2", "legend3", "text3", "controls3"]) apply(entry[key], enabled);
  }
  return changed;
}

export function resetSequentialVocalUi(node) {
  const ext = extensionState(node, false);
  if (ext && Object.prototype.hasOwnProperty.call(ext, "sequential_vocal")) delete ext.sequential_vocal;
  const narrator = widgetByName(node, NARRATOR_DESC_WIDGET);
  if (narrator && !inputConnected(node, narrator.name)) narrator.value = "";
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    for (const slot of [2, 3]) {
      const widget = widgetByName(node, vocalTextWidgetName(turn, slot));
      if (widget && !inputConnected(node, widget.name)) widget.value = "";
    }
  }
  pruneState(node);
}


function isSequentialCoreTextName(name) {
  const value = String(name || "");
  return value === NARRATOR_DESC_WIDGET || /^turn_[1-6]_vocal_[23]_text$/.test(value);
}

function isRuntimeUiWidgetName(name) {
  // Backend INPUT_TYPES never uses double-underscore names. Group headers,
  // Continue-Speaking decorations, R2V reference helper rows and view/reset
  // controls do, so exclude them from positional Core-schema migration even if
  // an older frontend build did not stamp EXTENSION_WIDGET_MARKER on them.
  return String(name || "").startsWith("__");
}

function backendCoreWidgetNames(node) {
  return (node?.widgets || [])
    .filter((widget) => !widget?.[EXTENSION_WIDGET_MARKER])
    .map((widget) => String(widget?.name || ""))
    .filter((name) => name && !isRuntimeUiWidgetName(name));
}

function persistentCoreNames(node) {
  return backendCoreWidgetNames(node)
    .filter((name) => name !== "ultra_scene_validation_gate" && name !== "ultra_ui_locale");
}

/**
 * Upgrade recovery/Test3 positional widgets_values to the new Core-text schema.
 * Only 13 STRING widgets are added: Narrator direct text plus Vocal 2/3 dialogue
 * for six Progress rows. Existing Core names keep their relative order.
 */
export function migrateSequentialCoreTextSchema(node, info, { kind = "main" } = {}) {
  if (!Array.isArray(info?.widgets_values)) return false;
  const currentAll = backendCoreWidgetNames(node);
  const currentPersistent = currentAll.filter((name) => name !== "ultra_scene_validation_gate" && name !== "ultra_ui_locale");
  const oldAll = currentAll.filter((name) => !isSequentialCoreTextName(name));
  const oldPersistent = currentPersistent.filter((name) => !isSequentialCoreTextName(name));
  const expectedOldAll = kind === "r2v" ? 111 : 120;
  const expectedOldPersistent = expectedOldAll - 2;
  const expectedNewAll = expectedOldAll + 13;
  const expectedNewPersistent = expectedOldPersistent + 13;
  if (oldAll.length !== expectedOldAll || currentAll.length !== expectedNewAll) return false;

  let sourceNames = null;
  let targetNames = null;
  if (info.widgets_values.length === expectedOldAll) {
    sourceNames = oldAll;
    targetNames = currentAll;
  } else if (info.widgets_values.length === expectedOldPersistent) {
    sourceNames = oldPersistent;
    targetNames = currentPersistent;
  } else if (info.widgets_values.length === expectedNewAll || info.widgets_values.length === expectedNewPersistent) {
    return false;
  } else {
    return false;
  }

  const oldValues = new Map(sourceNames.map((name, index) => [name, info.widgets_values[index]]));
  info.widgets_values = targetNames.map((name) => isSequentialCoreTextName(name) ? "" : oldValues.get(name));
  return true;
}

function hydrateLegacySequentialTextIntoCore(node) {
  const seq = sequentialState(node, false);
  if (!seq || typeof seq !== "object") return false;
  let changed = false;
  const narrator = widgetByName(node, NARRATOR_DESC_WIDGET);
  const legacyNarrator = String(seq.narrator_voice_desc || "");
  if (narrator && !inputConnected(node, narrator.name) && !String(narrator.value ?? "").trim() && legacyNarrator.trim()) {
    narrator.value = legacyNarrator.slice(0, 1000);
    changed = true;
  }
  const turns = seq.turns && typeof seq.turns === "object" ? seq.turns : {};
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const state = turns[String(turn)];
    if (!state || typeof state !== "object") continue;
    for (const slot of [2, 3]) {
      const widget = widgetByName(node, vocalTextWidgetName(turn, slot));
      const legacy = String(state[`text_${slot}`] || "");
      if (widget && !inputConnected(node, widget.name) && !String(widget.value ?? "") && legacy) {
        widget.value = legacy.slice(0, 8000);
        changed = true;
      }
    }
  }
  return changed;
}


function failedNativeSequentialOrder(recoveryNames, kind) {
  const out = [];
  for (const name of recoveryNames || []) {
    out.push(name);
    if (name === "visual_style") {
      out.push("narrator_voice_preset", "narrator_voice_desc");
      continue;
    }
    const actionMatch = /^turn_(\d+)_action$/.exec(String(name || ""));
    if (actionMatch) {
      out.push(`turn_${actionMatch[1]}_sequential_vocal`);
      continue;
    }
    const dialogueMatch = /^turn_(\d+)_dialogue_text$/.exec(String(name || ""));
    if (dialogueMatch) {
      out.push(`turn_${dialogueMatch[1]}_vocal_1_speaker`);
      continue;
    }
    const deliveryMatch = /^turn_(\d+)_dialogue_delivery$/.exec(String(name || ""));
    if (deliveryMatch) {
      const index = deliveryMatch[1];
      out.push(
        `turn_${index}_vocal_2_text`, `turn_${index}_vocal_2_speaker`, `turn_${index}_vocal_2_language`, `turn_${index}_vocal_2_delivery`,
        `turn_${index}_vocal_3_text`, `turn_${index}_vocal_3_speaker`, `turn_${index}_vocal_3_language`, `turn_${index}_vocal_3_delivery`,
      );
    }
  }
  const expected = kind === "r2v" ? 173 : 182;
  return out.length === expected ? out : [];
}

/**
 * One-time recovery for workflows saved by the abandoned native-field prototype.
 * It activates only for the exact failed Main(182)/R2V(173) positional shape.
 * Existing recovery Core widgets are never added, removed, moved, or renamed.
 */
export function migrateFailedNativeSequentialWorkflow(node, info, { kind = "main" } = {}) {
  const values = info?.widgets_values;
  if (!Array.isArray(values)) return false;
  const expectedOldCount = kind === "r2v" ? 173 : 182;
  const expectedRecoveryCount = kind === "r2v" ? 111 : 120;
  if (values.length !== expectedOldCount) return false;

  const coreNames = backendCoreWidgetNames(node)
    .filter((name) => !isSequentialCoreTextName(name));
  if (coreNames.length !== expectedRecoveryCount) return false;
  const oldNames = failedNativeSequentialOrder(coreNames, kind);
  if (oldNames.length !== expectedOldCount) return false;

  const old = new Map(oldNames.map((name, index) => [name, values[index]]));
  const remapped = coreNames.map((name) => old.get(name));

  let recoveredSequential = false;
  const recovered = { version: STATE_VERSION, turns: {} };
  const narratorPreset = String(old.get("narrator_voice_preset") || "").trim();
  const narratorDesc = String(old.get("narrator_voice_desc") || "").trim();
  if (narratorPreset && narratorPreset !== "default") { recovered.narrator_voice_preset = narratorPreset; recoveredSequential = true; }
  if (narratorDesc) { recovered.narrator_voice_desc = narratorDesc; recoveredSequential = true; }

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const enabled = Boolean(old.get(`turn_${turn}_sequential_vocal`));
    const text2 = String(old.get(`turn_${turn}_vocal_2_text`) || "");
    const text3 = String(old.get(`turn_${turn}_vocal_3_text`) || "");
    if (!enabled && !text2 && !text3) continue;
    const state = { enabled };
    const speaker1 = String(old.get(`turn_${turn}_vocal_1_speaker`) || old.get(`turn_${turn}_speaker`) || "A");
    state.speaker_1 = SPEAKER_VALUES.includes(speaker1) ? speaker1 : "A";
    for (const slot of [2, 3]) {
      const text = String(old.get(`turn_${turn}_vocal_${slot}_text`) || "");
      const speaker = String(old.get(`turn_${turn}_vocal_${slot}_speaker`) || "A");
      const language = String(old.get(`turn_${turn}_vocal_${slot}_language`) || "auto");
      const delivery = String(old.get(`turn_${turn}_vocal_${slot}_delivery`) || "on_screen");
      state[`text_${slot}`] = text.slice(0, 8000);
      state[`speaker_${slot}`] = SPEAKER_VALUES.includes(speaker) ? speaker : "A";
      state[`language_${slot}`] = LANGUAGE_VALUES.includes(language) ? language : "auto";
      state[`delivery_${slot}`] = DELIVERY_VALUES.includes(delivery) ? delivery : "on_screen";
    }
    recovered.turns[String(turn)] = state;
    recoveredSequential = true;
  }

  info.widgets_values = remapped;
  if (recoveredSequential) {
    info.properties ??= {};
    const existing = info.properties[EXTENSION_OPTIONS_PROPERTY];
    const ext = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : { version: 2 };
    ext.version = Math.max(2, Number(ext.version) || 2);
    const previousSeq = ext.sequential_vocal && typeof ext.sequential_vocal === "object" && !Array.isArray(ext.sequential_vocal)
      ? ext.sequential_vocal : null;
    ext.sequential_vocal = previousSeq ? { ...previousSeq, ...recovered, turns: { ...(previousSeq.turns || {}), ...recovered.turns } } : recovered;
    info.properties[EXTENSION_OPTIONS_PROPERTY] = ext;
  }
  return true;
}
