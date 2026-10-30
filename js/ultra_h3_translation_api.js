import { api } from "../../scripts/api.js";
import { h3FetchApi } from "./ultra_h3_security.js";

export const TRANSLATION_API_WIDGET_MARKER = Symbol.for("ultraH3.translationApiWidget");

const STATUS_PATH = "/ultra_minimax_h3/translation_api";
const TEST_PATH = "/ultra_minimax_h3/translation_api/test";

const LIVE_TRANSLATION_API_WIDGETS = new Set();

const TEXT = Object.freeze({
  ko: Object.freeze({
    buttonUnset: "Google 번역 API 설정",
    buttonReady: "Google 번역 API · 키 저장됨",
    tooltip: "자동 번역 사용 시 공식 Google Cloud Translation Basic v2 API 키를 설정합니다. 키는 workflow/노드 속성에 저장되지 않고 ComfyUI 사용자 폴더의 로컬 설정에만 저장됩니다.",
    title: "Google 번역 API 설정",
    intro: "공식 Google Cloud Translation Basic v2를 사용합니다. 기존 번역 캐시를 먼저 확인하고, 캐시에 없으면 저장된 공식 API 키를 우선 사용합니다. 공식 API가 실패하면 기존 무료 번역 경로를 계속 시도합니다. 저장된 키는 workflow에 포함되지 않습니다.",
    keyLabel: "Google Cloud Translation API Key",
    keyPlaceholderSaved: "저장된 키가 있습니다 · 변경하려면 새 키 입력",
    keyPlaceholderEmpty: "API Key 입력",
    showKey: "입력 중인 키 표시",
    configured: "상태: API Key 저장됨",
    notConfigured: "상태: API Key 미설정",
    test: "연결 테스트",
    save: "키 저장",
    remove: "저장된 키 삭제",
    close: "닫기",
    testing: "공식 번역 API를 테스트하는 중...",
    saving: "API Key를 저장하는 중...",
    deleting: "저장된 API Key를 삭제하는 중...",
    testOk: (text) => `테스트 성공: ${text}`,
    saveOk: "API Key를 ComfyUI 사용자 로컬 설정에 저장했습니다.",
    deleteOk: "저장된 API Key를 삭제했습니다. 자동 번역은 기존 무료 경로를 사용합니다.",
    enterKey: "저장할 API Key를 입력하세요.",
    confirmDelete: "ComfyUI 사용자 폴더에 저장된 Google 번역 API Key를 삭제할까요?",
    statusFailed: "API 설정 상태를 확인하지 못했습니다. ComfyUI 서버 연결을 확인하세요.",
    requestFailed: "요청에 실패했습니다.",
    keyTestHint: "새 키를 입력한 상태에서 ‘연결 테스트’를 누르면 저장하기 전에 그 키를 시험합니다. 입력란이 비어 있으면 현재 저장된 키를 시험합니다.",
    guideHint: "API 발급·요금·보안 안내는 패키지의 ‘구글 번역 API 사용법.txt’를 참고하세요.",
    errorRateLimited: "Google Cloud Translation 사용량/속도 제한에 걸렸습니다. Google Cloud의 할당량을 확인하고 잠시 후 다시 시도하세요.",
    errorConfiguration: "API Key 또는 Google Cloud 프로젝트 설정을 확인하세요. Cloud Translation API 활성화, Billing 연결, API Key의 Cloud Translation API 제한을 확인하세요.",
    errorStorage: "API Key를 ComfyUI 사용자 폴더에 저장하거나 삭제하지 못했습니다. 폴더 쓰기 권한을 확인하세요.",
    errorMissingKey: "테스트할 API Key를 입력하거나 먼저 저장하세요.",
    errorProvider: "Google Cloud Translation 연결 테스트에 실패했습니다. 인터넷 연결과 Google Cloud 서비스 상태를 확인하세요.",
    savedKeyPrivacyHint: "보안을 위해 이미 저장된 API Key는 다시 표시하지 않습니다. 이 입력란은 새 Key 입력·교체용입니다.",
  }),
  en: Object.freeze({
    buttonUnset: "Google Translation API Settings",
    buttonReady: "Google Translation API · Key saved",
    tooltip: "Configure an official Google Cloud Translation Basic v2 API key for automatic translation. The key is kept only in the ComfyUI user-local configuration and is never stored in workflow/node properties.",
    title: "Google Translation API Settings",
    intro: "Uses the official Google Cloud Translation Basic v2 API. The translation cache is checked first; on a cache miss, the saved official API key is tried before the existing free translation routes. If the official API fails, the existing free routes are still tried. The saved key is never included in workflows.",
    keyLabel: "Google Cloud Translation API Key",
    keyPlaceholderSaved: "A saved key exists · enter a new key to replace it",
    keyPlaceholderEmpty: "Enter API Key",
    showKey: "Show key being entered",
    configured: "Status: API Key saved",
    notConfigured: "Status: API Key not configured",
    test: "Connection test",
    save: "Save key",
    remove: "Delete saved key",
    close: "Close",
    testing: "Testing the official Translation API...",
    saving: "Saving API Key...",
    deleting: "Deleting the saved API Key...",
    testOk: (text) => `Test succeeded: ${text}`,
    saveOk: "API Key saved in the ComfyUI user-local configuration.",
    deleteOk: "Saved API Key deleted. Auto translation will use the existing free routes.",
    enterKey: "Enter an API Key to save.",
    confirmDelete: "Delete the Google Translation API Key saved in the ComfyUI user directory?",
    statusFailed: "Could not read the API setting status. Check the ComfyUI server connection.",
    requestFailed: "Request failed.",
    keyTestHint: "With a new key entered, Connection test checks that key before saving it. If the field is empty, the currently saved key is tested.",
    guideHint: "See ‘구글 번역 API 사용법.txt’ in the package for API setup, pricing, and security guidance.",
    errorRateLimited: "Google Cloud Translation is rate/quota limited. Check your Google Cloud quotas and try again later.",
    errorConfiguration: "Check the API key and Google Cloud project settings: Cloud Translation API enabled, Billing linked, and the key restricted to Cloud Translation API.",
    errorStorage: "Could not save or remove the API key in the ComfyUI user directory. Check folder write permissions.",
    errorMissingKey: "Enter an API key to test or save one first.",
    errorProvider: "Google Cloud Translation connection test failed. Check the network and Google Cloud service status.",
    savedKeyPrivacyHint: "For security, the saved API key is never shown again. This field is only for entering or replacing a key.",
  }),
});

function language(locale) {
  return String(locale || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

function labels(locale) {
  return TEXT[language(locale)] || TEXT.en;
}

function widgetsOf(node) {
  return Array.isArray(node?.widgets) ? node.widgets : [];
}

export function translationApiWidget(node) {
  return widgetsOf(node).find((widget) => Boolean(widget?.[TRANSLATION_API_WIDGET_MARKER])) || null;
}

async function requestJson(path, options = {}) {
  const response = await h3FetchApi(path, options);
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok || !payload?.ok) {
    const message = String(payload?.error || `${response.status || ""} ${response.statusText || ""}` || "Request failed.").trim();
    const error = new Error(message || "Request failed.");
    error.status = response.status;
    error.type = payload?.type || "request_error";
    throw error;
  }
  return payload;
}

function localizedRequestError(error, t) {
  const type = String(error?.type || "");
  if (type === "rate_limited") return t.errorRateLimited;
  if (type === "configuration_error") return t.errorConfiguration;
  if (type === "storage_error") return t.errorStorage;
  if (type === "missing_key") return t.errorMissingKey;
  if (type === "provider_error") return t.errorProvider;
  return error?.message || t.requestFailed;
}

function applyButtonText(node, widget, locale) {
  if (!widget) return;
  const t = labels(locale);
  const configured = Boolean(widget.__ultraTranslationApiConfigured);
  const text = configured ? t.buttonReady : t.buttonUnset;
  widget.name = text;
  widget.label = text;
  widget.tooltip = t.tooltip;
  widget.options = { ...(widget.options || {}), serialize: false, tooltip: t.tooltip };
  try { widget.__ultraGroupedNode = node; } catch (_) {}
}

function trackTranslationApiWidget(node, widget) {
  if (!widget) return;
  try { widget.__ultraTranslationApiNode = node; } catch (_) {}
  LIVE_TRANSLATION_API_WIDGETS.add(widget);
}

function setConfigured(node, widget, configured, locale) {
  trackTranslationApiWidget(node, widget);
  const value = Boolean(configured);
  for (const candidate of Array.from(LIVE_TRANSLATION_API_WIDGETS)) {
    const owner = candidate?.__ultraTranslationApiNode;
    if (!owner || !widgetsOf(owner).includes(candidate)) {
      LIVE_TRANSLATION_API_WIDGETS.delete(candidate);
      continue;
    }
    candidate.__ultraTranslationApiConfigured = value;
    candidate.__ultraTranslationApiStatusKnown = true;
    applyButtonText(owner, candidate, candidate.__ultraTranslationApiLocale || locale);
    owner?.setDirtyCanvas?.(true, true);
  }
}

async function refreshStatus(node, widget, locale) {
  if (!widget || widget.__ultraTranslationApiStatusPending) return;
  widget.__ultraTranslationApiStatusPending = true;
  try {
    const status = await requestJson(STATUS_PATH);
    setConfigured(node, widget, Boolean(status.configured), widget.__ultraTranslationApiLocale || locale);
  } catch (_) {
    // A settings-status failure must never interfere with the node itself.
    applyButtonText(node, widget, locale);
  } finally {
    widget.__ultraTranslationApiStatusPending = false;
  }
}

function styledButton(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  Object.assign(button.style, {
    minHeight: "32px",
    padding: "6px 11px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "inherit",
    cursor: "pointer",
  });
  return button;
}

function openSettingsDialog(node, widget, locale) {
  if (typeof document === "undefined" || !document.body) return;
  if (widget.__ultraTranslationApiDialog?.isConnected) return;

  const t = labels(locale);
  const overlay = document.createElement("div");
  widget.__ultraTranslationApiDialog = overlay;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(0,0,0,0.58)",
    boxSizing: "border-box",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(620px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto",
    boxSizing: "border-box",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "var(--comfy-menu-bg, #252525)",
    color: "var(--input-text, #e8e8e8)",
    boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
    padding: "18px",
    fontFamily: "Arial, sans-serif",
  });
  overlay.appendChild(panel);

  const titleRow = document.createElement("div");
  Object.assign(titleRow.style, { display: "flex", alignItems: "center", gap: "12px" });
  const title = document.createElement("div");
  title.textContent = t.title;
  Object.assign(title.style, { fontSize: "17px", fontWeight: "700", flex: "1" });
  const x = styledButton("×");
  Object.assign(x.style, { minWidth: "34px", padding: "2px 8px", fontSize: "20px" });
  titleRow.append(title, x);
  panel.appendChild(titleRow);

  const intro = document.createElement("div");
  intro.textContent = t.intro;
  Object.assign(intro.style, { marginTop: "10px", lineHeight: "1.5", opacity: "0.86", fontSize: "13px" });
  panel.appendChild(intro);

  const status = document.createElement("div");
  status.textContent = widget.__ultraTranslationApiConfigured ? t.configured : t.notConfigured;
  Object.assign(status.style, { marginTop: "14px", fontWeight: "600", fontSize: "13px" });
  panel.appendChild(status);

  const keyLabel = document.createElement("label");
  keyLabel.textContent = t.keyLabel;
  Object.assign(keyLabel.style, { display: "block", marginTop: "14px", marginBottom: "6px", fontSize: "13px" });
  panel.appendChild(keyLabel);

  const input = document.createElement("input");
  // Keep the field out of browser/password-manager credential heuristics.
  // Chromium can visually mask a normal text field without using type=password,
  // so the API key stays obscured while Google Password Manager does not treat
  // this as a website password. Firefox falls back to password type only when
  // the CSS masking property is unavailable.
  const canCssMaskKey = "webkitTextSecurity" in input.style;
  input.type = canCssMaskKey ? "text" : "password";
  input.autocomplete = "off";
  input.name = "ultra_h3_translation_api_key_input";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("aria-autocomplete", "none");
  input.setAttribute("data-form-type", "other");
  input.setAttribute("data-1p-ignore", "true");
  input.setAttribute("data-lpignore", "true");
  input.setAttribute("data-bwignore", "true");
  input.placeholder = widget.__ultraTranslationApiConfigured ? t.keyPlaceholderSaved : t.keyPlaceholderEmpty;
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "7px 9px",
    borderRadius: "7px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "var(--comfy-input-bg, #171717)",
    color: "inherit",
    fontFamily: "monospace",
  });
  if (canCssMaskKey) input.style.webkitTextSecurity = "disc";
  panel.appendChild(input);

  const privacyHint = document.createElement("div");
  privacyHint.textContent = t.savedKeyPrivacyHint;
  Object.assign(privacyHint.style, { marginTop: "7px", lineHeight: "1.45", opacity: "0.72", fontSize: "12px" });
  panel.appendChild(privacyHint);

  const showRow = document.createElement("label");
  Object.assign(showRow.style, { display: "inline-flex", alignItems: "center", gap: "7px", marginTop: "8px", fontSize: "12px", cursor: "pointer" });
  const show = document.createElement("input");
  show.type = "checkbox";
  show.addEventListener("change", () => {
    if (canCssMaskKey) input.style.webkitTextSecurity = show.checked ? "none" : "disc";
    else input.type = show.checked ? "text" : "password";
  });
  const showText = document.createElement("span");
  showText.textContent = t.showKey;
  showRow.append(show, showText);
  panel.appendChild(showRow);

  const keyTestHint = document.createElement("div");
  keyTestHint.textContent = t.keyTestHint;
  Object.assign(keyTestHint.style, { marginTop: "7px", lineHeight: "1.45", opacity: "0.72", fontSize: "12px" });
  panel.appendChild(keyTestHint);

  const message = document.createElement("div");
  Object.assign(message.style, { minHeight: "20px", marginTop: "12px", fontSize: "12px", lineHeight: "1.45", overflowWrap: "anywhere" });
  panel.appendChild(message);

  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end", marginTop: "10px" });
  const test = styledButton(t.test);
  const save = styledButton(t.save);
  const remove = styledButton(t.remove);
  const close = styledButton(t.close);
  actions.append(test, save, remove, close);
  panel.appendChild(actions);

  const guideHint = document.createElement("div");
  guideHint.textContent = t.guideHint;
  Object.assign(guideHint.style, { marginTop: "12px", lineHeight: "1.45", opacity: "0.7", fontSize: "11px" });
  panel.appendChild(guideHint);

  const buttons = [test, save, remove, close, x];
  const setBusy = (busy) => {
    for (const button of buttons) button.disabled = Boolean(busy);
    if (!busy) remove.disabled = !Boolean(widget.__ultraTranslationApiConfigured);
    input.disabled = Boolean(busy);
    show.disabled = Boolean(busy);
  };
  setBusy(false);
  const setMessage = (text, isError = false) => {
    message.textContent = String(text || "");
    message.style.color = isError ? "#ff9d9d" : "inherit";
  };
  const closeDialog = () => {
    try { input.value = ""; } catch (_) {}
    try { overlay.remove(); } catch (_) {}
    widget.__ultraTranslationApiDialog = null;
  };

  x.addEventListener("click", closeDialog);
  close.addEventListener("click", closeDialog);
  // Deliberately do not close on backdrop click: an accidental click must not
  // discard a key the user is entering.

  test.addEventListener("click", async () => {
    setBusy(true);
    setMessage(t.testing);
    try {
      const key = String(input.value || "").trim();
      const payload = await requestJson(TEST_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { api_key: key } : {}),
      });
      setMessage(t.testOk(String(payload.translatedText || "")));
      if (payload.configured) setConfigured(node, widget, true, locale);
    } catch (error) {
      setMessage(localizedRequestError(error, t), true);
    } finally {
      setBusy(false);
    }
  });

  save.addEventListener("click", async () => {
    const key = String(input.value || "").trim();
    if (!key) {
      setMessage(t.enterKey, true);
      input.focus();
      return;
    }
    setBusy(true);
    setMessage(t.saving);
    try {
      const payload = await requestJson(STATUS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      setConfigured(node, widget, Boolean(payload.configured), locale);
      input.value = "";
      input.placeholder = t.keyPlaceholderSaved;
      status.textContent = t.configured;
      setMessage(t.saveOk);
    } catch (error) {
      setMessage(localizedRequestError(error, t), true);
    } finally {
      setBusy(false);
    }
  });

  remove.addEventListener("click", async () => {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    setMessage(t.deleting);
    try {
      const payload = await requestJson(STATUS_PATH, { method: "DELETE" });
      setConfigured(node, widget, Boolean(payload.configured), locale);
      input.value = "";
      input.placeholder = t.keyPlaceholderEmpty;
      status.textContent = t.notConfigured;
      setMessage(t.deleteOk);
    } catch (error) {
      setMessage(localizedRequestError(error, t), true);
    } finally {
      setBusy(false);
    }
  });

  document.body.appendChild(overlay);
}

export function refreshTranslationApiUi(node, { locale = "en", fetchStatus = false } = {}) {
  const widget = translationApiWidget(node);
  if (!widget) return null;
  trackTranslationApiWidget(node, widget);
  widget.__ultraTranslationApiLocale = language(locale);
  applyButtonText(node, widget, locale);
  if (fetchStatus) void refreshStatus(node, widget, locale);
  return widget;
}

export function installTranslationApiUi(node, { locale = "en", markUiOnly = null } = {}) {
  if (!node || typeof node.addWidget !== "function") return null;
  let widget = translationApiWidget(node);
  if (!widget) {
    const t = labels(locale);
    widget = node.addWidget("button", t.buttonUnset, null, () => {
      openSettingsDialog(node, widget, locale);
    }, { serialize: false });
    if (!widget) return null;
    widget[TRANSLATION_API_WIDGET_MARKER] = true;
    widget.serialize = false;
    widget.serializeValue = () => undefined;
    widget.options = { ...(widget.options || {}), serialize: false };
    try { markUiOnly?.(widget); } catch (_) {}

    const widgets = widgetsOf(node);
    const sceneTranslate = widgets.find((item) => item?.name === "scene_translate");
    const currentIndex = widgets.indexOf(widget);
    const sceneIndex = widgets.indexOf(sceneTranslate);
    if (currentIndex >= 0 && sceneIndex >= 0 && currentIndex !== sceneIndex + 1) {
      widgets.splice(currentIndex, 1);
      const refreshedSceneIndex = widgets.indexOf(sceneTranslate);
      widgets.splice(refreshedSceneIndex + 1, 0, widget);
    }
  } else {
    try { markUiOnly?.(widget); } catch (_) {}
  }

  // Keep callback locale live without rebuilding/replacing the widget. This is
  // important for grouped geometry and prevents socket/widget index churn.
  trackTranslationApiWidget(node, widget);
  widget.callback = () => openSettingsDialog(node, widget, widget.__ultraTranslationApiLocale || locale);
  widget.__ultraTranslationApiLocale = language(locale);
  applyButtonText(node, widget, locale);
  if (!widget.__ultraTranslationApiStatusKnown) void refreshStatus(node, widget, locale);
  return widget;
}
