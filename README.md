# Ultra MiniMax H3 Prompt · ComfyUI 영상 프롬프트 제작 노드

**MiniMax H3 영상 생성에 필요한 복잡한 장면·인물·카메라·행동·대사·환경음·음악 지시를, 메뉴와 자연어 입력으로 구성하는 ComfyUI 커스텀 노드입니다.**

장면을 영어로 처음부터 직접 설계할 필요 없이 필요한 항목을 선택하고 작성하면, H3 형식에 맞는 **구조화된 영상 프롬프트**를 생성합니다. 이 노드는 영상 모델을 대체하지 않는 *프롬프트 생성기*이며, 실제 영상 렌더링에는 ComfyUI의 MiniMax H3 모델과 별도의 생성 워크플로가 필요합니다.

> **두 개의 독립적인 프롬프트 노드를 제공합니다.** `UltraMiniMaxH3Prompt`(Main)와 `UltraMiniMaxH3PromptR2V`(R2V)를 각각 사용하거나 함께 배치할 수 있습니다. **아래 올인원 워크플로는 개발자의 개인적인 구성 예시일 뿐이며, 필수 구성이나 유일하게 권장되는 방식이 아닙니다.** 사용자는 두 노드를 원하는 모델·샘플러·이미지 처리·영상 출력 노드와 자유롭게 연결해 자기 목적에 맞는 워크플로를 만들 수 있습니다.

## 📦 설치

**ComfyUI Manager (권장)**

ComfyUI의 **Manager → Custom Nodes Manager**에서 **`Ultra MiniMax H3 Prompt`** 를 검색하여 설치합니다. Registry 상태에 따라 최신 안정 버전 대신 `nightly` 옵션만 제공되거나 특정 버전의 설치가 제한될 수 있습니다.

**수동 설치**

터미널에서 ComfyUI의 `custom_nodes` 폴더로 이동한 다음 저장소를 복제합니다.

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Yamoon-jjang/comfyui-Ultra-MiniMax-H3-Prompt.git
```

설치 후 **ComfyUI를 완전히 재시작**하고 브라우저를 **Ctrl+F5**로 새로고침하세요. 노드 검색창에서 **`Ultra MiniMax H3 Prompt` (Main)** 및 **`Ultra MiniMax H3 Prompt R2V`** 를 찾을 수 있습니다.

- ✅ **별도 필수 pip 패키지 없음** — `requirements.txt` 기준 추가 설치는 필요하지 않습니다.
- ✅ **한국어 설명 입력 지원** — 온라인 자동 번역을 활용할 수 있으며 Google Cloud Translation API 키는 선택사항입니다.
- ✅ **한국어 상세 안내 포함** — [`메뉴얼.txt`](./메뉴얼.txt) 및 [`구글 번역 API 사용법.txt`](./구글%20번역%20API%20사용법.txt)
- ✅ **올인원 예제 포함** — [`MiniMax_H3_All_In_One.json`](./MiniMax_H3_All_In_One.json)

> **참고:** Main/R2V 프롬프트 노드만 사용한다면 올인원 예제에 포함된 업스케일·보간·추가 도구 노드는 필요하지 않습니다. 올인원 예제 전체를 실행하려면 해당 외부 노드와 모델을 별도로 준비해야 합니다.

---

## 주요 기능

| 구분 | 내용 |
| --- | --- |
| **Main 프롬프트** | T2VA(텍스트), I2VA(시작 이미지), L2VA(끝 이미지), FL2VA(처음+마지막 이미지) 등의 입력 방식과 자동/명시적 모드 선택 |
| **R2V 프롬프트** | 참조 이미지·영상·오디오를 활용하는 Reference-to-Video용 프롬프트 구성 및 참조 역할 지시 |
| **인물과 장면** | 최대 3명의 주요 인물, 장면/환경/날씨/화면 스타일, 외형·의상·목소리 등 세부 선택 |
| **시간순 진행** | 최대 6개의 이벤트를 시간순으로 지정하고, 행동·카메라·장면 전환·대사 등을 조합 |
| **대사와 음향** | 화자별 발화 순서, 복수 화자, 원문 대사 보존, 환경음·비장면 음악·노래 관련 검증 |
| **한국어 입력** | 한국어 설명문의 자동 영어 번역, 영어 원문 유지, 번역 비활성화 선택 및 Google Cloud Translation API 키 선택 사용 |
| **검증과 안내** | 입력·모드·참조 조건을 검사하고 상태 또는 경고를 표시하는 프롬프트 컴파일 흐름 |

프롬프트의 규칙 기반 생성·검증 기능이며, **LLM/VLM을 실행하거나 입력 이미지의 픽셀 내용을 직접 분석하지는 않습니다.** 최종 영상의 내용 및 품질은 사용한 H3 모델, 참조 자료, 샘플링 설정에 따라 달라집니다.

## 올인원 워크플로 예제 (선택사항)

**[MiniMax_H3_All_In_One.json 다운로드](./MiniMax_H3_All_In_One.json)**

이 파일은 2026년 10월 28일에 제공된 최신 개인용 워크플로 예제로, **Main + R2V 프롬프트 노드를 함께 배치하고 생성 경로를 전환**하도록 구성되어 있습니다. T2V/I2V/R2V, 모델·Turbo LoRA 선택, Sigma/샘플러, 선택적 2단계 업스케일, 비교 영상 저장, RIFE 프레임 보간, 오디오·영상 출력 등 여러 작업을 한 화면에 모은 구성입니다.

**주의: 이 예제는 노드 본체의 설치 조건과 다릅니다.** 노드 본체는 Main/R2V 프롬프트 생성을 위해 올인원 전체 구성이 필요하지 않습니다. 반대로 올인원 파일을 그대로 열고 실행하려면 해당 워크플로에 사용된 외부 커스텀 노드와 모델이 추가로 필요할 수 있습니다.

- [Ultra Tools](https://github.com/Yamoon-jjang/comfyui-Ultra-Tools) — Textbox, Translator, 이미지 입력, Workflow Timer 등의 예제용 보조 노드
- [MMH3 Ultimate Upscale](https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale) — 2단계 업스케일 관련 노드
- [KJNodes](https://github.com/kijai/ComfyUI-KJNodes) — SageAttention 관련 노드
- [ComfyUI Impact Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) — ImpactControlBridge 노드
- 기타 워크플로에 사용된 `VRAM_Debug`와 RIFE 보간용 모델 등은 자신의 ComfyUI 환경에 맞게 추가로 확인해야 합니다.

워크플로 JSON에는 제작자 환경에서 선택한 **로컬 모델 파일 이름, 예시 이미지 파일 이름 및 세부 생성 옵션**이 그대로 기록되어 있습니다. 공개용 샘플 이미지/모델 파일은 함께 제공되지 않으므로 **자신이 가진 모델과 입력 이미지로 다시 선택**해야 합니다. 파일 안의 기존 설치 안내에는 V3.50으로 표시된 부분이 있으나, 이 페이지에서 제공하는 패키지 기준 파일명은 **V3.59**입니다. 기존 워크플로의 노드·연결·설정은 그대로 유지하면서, 누락 노드 자동 검색을 돕기 위해 Main/R2V 노드의 `cnr_id` 출처 정보만 추가했습니다.

**활용 제안:** 먼저 두 프롬프트 노드의 `h3_prompt` 출력을 원하는 H3 텍스트 입력에 연결한 *간단한 구성*으로 시작해 보세요. 자신에게 필요하지 않은 업스케일·보간·디버그·분기 노드는 제외하고, 원하는 입력 형태와 후처리 기능을 조합한 워크플로를 별도로 만드는 것이 좋습니다.

## 버전 및 배포 안내

- 제공 ZIP 파일명: **V3.59** — 기존 V3.59 소스에 이 워크플로 예제와 GitHub 안내를 추가한 문서·예제 구성입니다.
- 노드 내부의 기능 버전 문자열은 이전 배포 계열의 **3.50**으로 남아 있으며, 이 문서 추가만으로 백엔드·프런트엔드 기능이 변경되거나 최신 ComfyUI에서의 모든 UI 동작이 검증된 것은 아닙니다.
- 이 구성은 별도의 **v3.90 릴리스**가 아닙니다. GitHub Releases 사용 여부는 저장소 공개·관리 정책에 따라 선택할 수 있습니다.
- 사용·수정·재배포 조건은 [`LICENSE`](./LICENSE)를 확인하십시오.

---

## English technical documentation

The original detailed technical documentation is retained below. The optional `MiniMax_H3_All_In_One.json` is a personal sample workflow, **not a required or canonical workflow**. You are welcome to build your own ComfyUI pipeline using the Main and R2V prompt nodes; the sample's additional loaders, upscalers, switches, and helper nodes are not inherent requirements of these two prompt nodes.

# Ultra MiniMax H3 Prompt

A rule-based ComfyUI prompt compiler for MiniMax H3 video generation.

Current version: **3.50**

## What it does

- Builds the H3 core fields:
  - `integrated_multimodal_description`
  - `overall_soundscape`
  - `non_diegetic_music`
- Supports Auto topology resolution plus explicit T2VA / I2VA / L2VA / FL2VA mode contracts. Manual T2VA ignores connected image references for prompt-mode resolution; manual image modes require their own reference inputs and quietly wait with a guidance badge when one is missing.
- Supports 1–3 main characters and up to 6 timeline events. Each visible timeline row is one real event with one target person/group.
- Each main character keeps basic **Gender/Age** controls visible and can open an **Advanced** profile section for an independent **Ethnic appearance** cue, voice traits, plus combinable **Appearance Preset + Appearance Additional Input** and **Clothing Preset + Clothing Additional Input**. Ethnic appearance is optional and merges into the same natural character-description phrase instead of replacing the normal appearance controls. Canonical preset text stays fixed in English; only Korean additional input is translated before the final merge. The full identity/visual profile is established once; later Timeline events use the stable `Person A/B/C` identity instead of repeating age/gender/appearance/clothing metadata, while voice traits are still introduced with the first spoken line.
- Assigns H3 speaker IDs by **first actual vocal-event order**, not by character-slot number.
- Supports compound speakers such as `(S1,S2)`.
- Preserves dialogue verbatim inside `<d>[Language] ...</d>`.
- Timeline Dialogue currently represents speech/voiceover. If the selected Turn action clearly describes the same actor singing while Dialogue is filled, execution is blocked rather than incorrectly converting lyrics into `says:` speech.
- Structured Scene/Weather presets keep background and weather motion at a natural real-time pace. Busy locations remain visually busy without turning crowds, traffic, signs, or lights into accelerated time-lapse motion; mid-Timeline location changes are phrased as scene transitions while preserving character identity.
- Uses Korean→English scene translation by default while leaving already-English scene text unchanged. Korean Timeline actions, sound/music hints, character additional details, and voice descriptions are translated internally before H3 prompt assembly; dialogue remains verbatim. Music hints are intended for instrumentation, tempo/speed, rhythm, texture, and dynamics rather than abstract emotional-function wording.
- Protects double-quoted on-screen text during scene translation.
- Neutralizes first/second-person wording that a Korean→English translator invents when the Korean scene omitted that perspective, while preserving explicit first-, second-, and third-person wording from the source.
- Validates H3 duration, speaker range, style-at-Shot-1 placement, soundscape sentence count, music sentence count, and core prompt structure; timeline events use 0.5-second starts from 0.0 through `duration - 0.5` and are stably sorted by start time before rendering.

The node does **not** use an LLM/VLM and does not inspect image pixels.

## Native required-input validation

A thick red outline around the whole node is ComfyUI's native validation state for a genuinely invalid input or structure. A completely empty Main T2V or R2V draft is **not** treated as a native input error: Queue is allowed to run, only the `h3_prompt` branch waits, and `info` reports `status=waiting_for_content` without inventing generic content. Manual I2VA/L2VA/FL2VA also use this non-native waiting flow when a required start/end image is missing: one prioritized badge explains the missing reference, and `h3_prompt` waits with `status=waiting_for_reference` instead of silently switching modes. Main image modes may run from valid image references, and R2V may run from a valid Picture/Video-backed Reference configuration. Timeline remains optional. In Main T2V, a short meaningful scene such as `walking` is sufficient; whitespace-only text is empty.


The standalone Timeline compiler canonicalizes profile gender/age plus appearance/clothing preset enums at its own boundary so supported aliases are normalized consistently even when the compiler is called directly outside the public node wrapper.

The translated `scene_prompt` also validates explicit structural `Person A/B/C` labels against the active `person_count`. Ordinary people/background wording is unaffected, and double-quoted screen text such as `"Person B"` remains literal rather than being treated as a character slot.

## Scene translation

The default `Scene Translation` setting is:

`Auto · Korean→English / keep English`

Behavior:

- Korean `scene_prompt` → translated to English.
- English `scene_prompt` → used unchanged without a translation request.
- Timeline actions → with **Automatic translation**, Korean is translated internally by the action path. With **Off · preserve input**, Timeline actions are preserved exactly as entered and no online translation route is used. Explicit structural references such as `인물 1/2/3` are stabilized as `Person A/B/C` only when translation is enabled and are carried through the external translator with opaque translation-only identity tokens, so character slots are not treated as ordinary names or figure labels. The same structural protection is applied to Korean `scene_prompt` text while translation is enabled. For a single-person Korean Timeline action, the selected Turn person is supplied as the authoritative grammatical actor for translation; other Person references remain separate referenced characters, including when they appear inside an introductory/subordinate clause. Clear camera/scene clauses keep their independent subject. No ordinary noun/verb/clothing/object/place/emotion dictionary and no blanket he/she/they replacement is used.
- sound/music hints, character appearance/clothing, and voice descriptions → Korean is translated internally when used.
- dialogue → never auto-translated.
- double-quoted visible text → preserved literally as far as the translation route allows.

Translation uses a request-local Google JSON route first, a Google mobile compatibility route when appropriate, and an independent MyMemory fallback. Successful Google-backed translations are cached persistently in the ComfyUI user area (up to 2048 entries, 30-day retention) using a conservative cache key that ignores only formatting noise such as outer/trailing whitespace; punctuation and wording changes remain distinct. MyMemory results are not persisted across restarts so they cannot permanently replace Google wording after Google recovers. Sustained request bursts are paced adaptively, and HTTP 429 uses provider-specific exponential cooldown with `Retry-After` support; cooldown state survives ComfyUI restarts so a still-limited provider is not immediately hammered again. `deep-translator`, if already installed, is only a final compatibility fallback and is no longer required. No API key is required, but internet access is needed when Korean translation is actually performed.

Korean scene descriptions frequently omit the grammatical subject. If translation invents `I / we / you` even though the Korean source did not explicitly choose that perspective, the node neutralizes only that invented perspective. Explicit source wording such as `나는/우리는`, `너는/너희는`, `그녀가`, `그 남성이`, or `그들이` is not rewritten merely because it is first-, second-, or third-person. Correct English `I/We/You/She/He/They` therefore remains when the source actually specified it.

## Speaker IDs

`Main Character 1/2/3` are stable character identities, not fixed S1/S2/S3 IDs.

H3 S IDs are assigned when a character first actually speaks:

- first new vocal character → S1
- second new vocal character → S2
- third new vocal character → S3

Action-only steps do not consume an S ID. Once assigned, a character keeps the same S ID and voice identity throughout later single or compound dialogue.

If a compound group is the first vocal event, canonical character order is used only as a deterministic tie-break within that simultaneous event. Compound on-screen dialogue follows the official example punctuation, e.g. `(S1,S2) say together, <d>[English] ...</d>`. When one compound Timeline row contains both action and dialogue, the person list in both sentences is normalized to the same S-ID order so the row never flips from `Person A and Person B` in the action to `Person B and Person A` in the immediately following dialogue. Action-only compound rows keep canonical A/B/C selection order.


## H3 style placement

MiniMax H3 expects the overall visual style at the beginning of `[Shot 1]`. Explicit presets are therefore emitted as strong overall-style declarations before scene/action details and explicitly remain active across later Shots and Timeline setting changes. Media/render presets such as Live Action, 2D Animation, Anime, 3D CG, Claymation, Watercolor, Monochrome, and Film Noir control how the entire video is rendered. World/art-direction presets such as Post-Apocalyptic, Cyberpunk, Gothic, and Dark Fantasy also reinterpret the selected environment in a context-aware way while preserving the requested location identity; for example, Post-Apocalyptic means a believable world after civilizational collapse, not merely a dusty color grade. They do not replace the user's primary subject or requested action. `2D Animated` stays as the broad generic 2D category, while `Japanese Anime` is a more specific 2D visual language. In image-based modes, `Auto` does not guess a medium from pixels; it emits only a neutral instruction to preserve the style established by the reference image(s). If the scene text itself contains a strongly contradictory media-style phrase, the node preserves the user's text but reports a warning.

## Character age wording

The UI provides `Child / Teenager / 20s / 30s / 40s / 50s / 60s / Elderly`. The backend does not emit terse age tokens such as `30s`; it combines age and gender into natural English wording such as `a young woman in her twenties`, `a man in his fifties`, or `an elderly woman`.

## Character appearance and clothing

Each active character exposes a compact default profile plus a direct-click `Advanced Settings` toggle. One click immediately expands or collapses the section. `○` on the left plus `▶` on the right means collapsed, while `●` on the left plus `▼` on the right means expanded. Values remain preserved when the section is collapsed or when `person_count` is temporarily reduced.

A bottom `Basic View` / `Show All Settings` toggle is display-only. Basic View is a true quick-edit surface: it keeps global scene/weather/style, every active person's gender/age/ethnic appearance, every active Timeline block's actor/start/action/dialogue, the main camera motion + Shot 1 target/framing, the master `Multiple Camera Cuts` ON/OFF switch, and—while multi-shot is enabled—each active Shot 2-6 start time/target/framing plus the next Shot ON/OFF control, along with the two sound modes. A valid start-image I2VA also keeps `Preserve reference clothing` visible because that switch can override clothing edits. Full View restores profile detail, per-progress scene/weather/language/delivery, camera amplitude/speed, per-shot transition/motion tuning, and other fine controls. Direct sound/music text normally stays hidden in Basic View but appears immediately when its selector is set to the required custom-only mode. The toggle is independent of each group's `▶/▼` collapsed state; `scene_prompt` stays outside the groups. Hidden values, links, prompt semantics, backend widget order, and Reference plans are not rewritten by the view switch. A fine-control row with a live external widget-input link may remain visible in Basic View so the connected socket/line is never hidden behind the compact UI.

The UI provides **grouped section headers** for related controls. Fresh nodes and confirmed Reset show `scene_prompt` plus collapsed `▶ Basic Settings / Camera Settings / Sound / Person N / Timeline N` headers; an R2V Reference group appears below `scene_prompt` only after that Reference is connected. Click a header to change `▶` to `▼` and reveal that group's rows. Basic/Full View controls detail density inside an open group; it does not open or close groups. The headers show a short read-only summary such as duration/person/progress count, person gender/age, progress actor/start time, camera shot count/motion, or an R2V reference role. Hovering a group header shows what it contains. Clicking a header never rewrites prompt values, backend widget order, or reference plans. The thin left category accent is draw-only decoration. Connected ordinary widget-input sockets remain visible when their group is collapsed so a live connection is not hidden. The multiline `scene_prompt` stays outside all collapsible groups and starts at roughly five text lines on a fresh node using the native/Core widget layout contract.

Inside `Advanced`, appearance and clothing can each be built from a preset and an additional free-text refinement:

- `Appearance Preset` + `Appearance Additional Input`
- `Clothing Preset` + `Clothing Additional Input`

If both the preset and the additional input are blank, that detail is simply omitted. If both are present, they are merged naturally into one phrase before H3 prompt assembly. Appearance is intended for concrete visible traits such as build, silhouette, hair, or distinctive physical features rather than vague beauty ratings. The Appearance Additional Input describes that Person A/B/C themself; companions, background people, or separate objects belong in `scene_prompt`, another Person slot, or an R2V Reference role rather than inside the person's appearance field. Clothing describes garments that should actually appear. Korean entries are translated internally to English. These visual descriptors are attached to the stable Person A/B/C identity at that character's first real timeline appearance and are not repeated in every later event.

For I2V/first-last-frame workflows, the reference image still constrains the visible character. Strongly contradictory clothing/appearance text can therefore reduce consistency; use these fields as deliberate overrides or refinements rather than generic quality boosters.


## Expanded appearance and clothing presets

The preset lists cover a practical range of body builds, facial structure, hairstyles, everyday clothing, businesswear, seasonal outerwear, sportswear, formalwear, beachwear, and moderately revealing adult fashion. Profile safety now follows one simple rule: built-in presets marked adult-only are available only when that person has an explicit adult age (`20s` or older). If the age is changed to `Unspecified`, `Child`, or `Teenager`, an already-selected adult-only appearance/clothing preset is temporarily hidden and the active value becomes `Unspecified`; returning to an adult age restores the previous preset unless the user chose another preset in the meantime. Ordinary `Swimsuit` and `Bikini` are not classified as adult-only. Canonical English preset text is preserved, while Korean UI labels stay user-friendly and additional Korean free text is translated before the final merge.

## Localization

ComfyUI's locale setting is the single source of truth:

- `locales/en/nodeDefs.json`
- `locales/ko/nodeDefs.json`

Labels, tooltips, the current combo selection, and combo popup entries switch together. Runtime/workflow values remain canonical (`A`, `ko_to_en`, `on_screen`, etc.); only their display labels change. The frontend never chooses Korean from the browser or operating-system locale. The `scene_prompt` help text is synchronized at runtime so Korean UI shows Korean help/examples and English UI shows English help/examples.

A small title-bar `Tooltip ON / OFF` control is available on both Main and R2V nodes. It is UI-only, saved per node with the workflow, does not add a backend widget or change node layout, and disables only the Ultra tooltip overlay; native tooltips remain suppressed.

When any STRING-capable Main (T2V/I2V) or R2V widget is externally linked, hovering that widget replaces its normal help tooltip with the currently readable upstream STRING value. Empty sources are shown explicitly, and long values are preview-truncated at about 420 characters with an ellipsis marker; the actual prompt value is never changed. If an upstream processing node can only determine its output during execution, the tooltip states that the value is resolved at execution time instead of guessing. This preview is lazy/display-only: it adds no polling, graph rebuild, resize, serialization, or prompt-generation behavior. When the source is specifically Ultra Textbox, its real output-row name is prefixed (for example, `Text 9 : ...`) so the matching source row is immediately identifiable. Other STRING sources remain value-only and receive no guessed slot label. Externally linked STRING widgets also show a small `↖` prefix on the widget label; it disappears immediately when the link is removed and is display-only. The shared scene prompt placeholder is now unified by locale for both Main and R2V: Korean uses `영상의 장면과 원하는 연출을 입력하세요`, and English uses `Describe the video scene and desired direction`. A completely empty draft no longer creates a scene-prompt native-validation badge or rejects Queue. Genuine native validation errors still use ComfyUI's own node/input error display. The Ultra H3 overlay badge code remains display-only and does not change node size or layout.


## Reference-image control visibility

The two related reference controls are grouped directly below `Visual Style`.

- `Reference Fidelity` is shown only when the effective mode has the reference image(s) it requires: Auto resolves from topology; manual I2VA needs start, L2VA needs end, and FL2VA needs both. Manual T2VA always hides it because its connected images are ignored for prompt-mode resolution. The saved value is preserved while hidden.
- `Preserve reference clothing` is placed immediately below `Reference Fidelity` and is narrower: it is shown in both Basic and Full View only for an effective I2VA task with a start image. Auto + start-image-only is therefore shown; manual I2VA also stays valid when an end image happens to be connected because that extra end image is ignored by the I2VA prompt-mode contract. T2VA/L2VA/FL2VA or missing-start states hide it. Its saved ON/OFF value is preserved while hidden.

## Image-mode refinements

When the scene and all active action fields are empty, I2VA does not invent a requested action. Voiceover handling keeps all modes reference-safe while explicitly stating that any corresponding on-screen speaker lips remain completely closed. In image modes, `visual_style=auto` is reported as `reference_preserved` in diagnostic output because the generated prompt explicitly anchors the reference image style. The node uses 1-6 Timeline rows, and runtime prompt generation is Timeline-only.

## Structural controls are local-only

Controls that decide the node's dynamic structure are intentionally **not connectable to external value inputs**. Main protects `H3 Mode`, `Video Duration (s)`, `Number of People`, `Timeline Rows`, `Multiple Camera Cuts`, and `Start Shot 2-6`; R2V protects the same structural controls except that its H3 Mode is already a fixed display row. These values must be set directly on the node. This prevents a hidden mismatch where the frontend could display one person/Timeline/Shot structure while Python receives a different connected value at Queue execution. Ordinary content/settings inputs such as `scene_prompt`, Timeline action/dialogue, person free text, sound/music text, and the real media Reference sockets remain connectable where ComfyUI exposes them.

Structural value connections are not supported. If one is present, disconnect it and save the workflow again. Subgraph/promoted-widget behavior belongs to ComfyUI; when using promoted widgets, verify save → reload → Queue behavior in the actual frontend.

## Dynamic node layout

The frontend keeps dynamic visibility and node sizing event-driven. Character/ordered-step widgets are shown or hidden from one visibility path and synchronized with the active LiteGraph/Vue node layout.

For dynamic person/step/camera changes, the frontend asks ComfyUI/LiteGraph for the node's computed layout height **before and after** the visibility change and immediately applies only that core-reported delta to the already user-sized node. This keeps the flexible `scene_prompt` area at the user's current rendered height while the node bottom grows or shrinks for newly shown/hidden rows. It does not estimate row heights, localized-label wrapping, padding, or grid gaps.

A single bounded post-layout verification remains only as a compatibility fallback for frontends whose `computeSize()` cannot describe a visibility change. There is no custom `ResizeObserver`, interval, continuous resize loop, or repeated correction chase. Initial workflow loading never forces a size change, and manual node resizing naturally creates the next scene-height baseline.

## Camera motion

Camera-motion choices follow MiniMax H3's published motion table directly: zoom, push/pull, pan, truck, tilt, pedestal, arc, tracking, static, shake, POV, and roll variants. `Dynamic` is not a selectable H3 camera-motion option; use `Tracking Shot` for the closest documented behavior.

## Multiple camera cuts

`Multiple Camera Cuts` is an explicit, opt-in H3 shot planner for real subject/viewpoint changes. It is not an automatic alternating-camera feature. The user manually selects the target of each shot (`Person A`, `Person B`, a person group, `Full Scene`, or `Current Action Focus`) and the optional motion inside later shots.

The implementation follows MiniMax H3's published shot rules: `[Shot 1]` begins without a timestamp; later shots use strictly increasing transition times such as `[Shot 2] At 00:03.500, ...`. The transition selector now exposes only the documented choices: ordinary cut, cross-dissolve, fade, and wipe. If only distance or a slight angle changes, camera motion remains preferable to inventing a new shot.

For dialogue continuity, H3 documents `<scenetrans>` when one line intentionally crosses a cut and `<cutoff>` when speech is truncated at the video end. The node still uses its ordinary speaking-time estimate as a warning near the boundary, but it now also applies a deliberately conservative very-fast-speech lower bound: when the line clearly cannot fit before the next Shot or before the video ends even at that pace, prompt generation is blocked and the user must shorten/re-time the line or move the Shot boundary. The node does not automatically split user dialogue or insert `<scenetrans>`/`<cutoff>`, and literal continuity tags in user text remain reserved and rejected.

The UI supports up to six explicit shots without forcing a one-to-one relationship with the six Timeline Progress rows. Timeline Progress controls when action/dialogue changes; Camera Shots are an independent camera timeline. Shot 1 is the always-present opening shot at 0.0 seconds and uses Base Camera Motion. Turning Multiple Camera Cuts on exposes Shot 2, and Shot 2-6 can then be enabled sequentially. Every enabled later Shot has an explicit Start Time (s), transition, target, framing, and camera motion. Start times use 0.5-second steps, must increase strictly from shot to shot, and compile directly to the absolute H3 `[Shot N] At 00:SS.mmm` timestamp. Framing rows stay visible: non-person targets are constrained to Auto / fit to scene; person targets expose the full person-framing list and begin from Auto when switching back to a person. Camera amplitude/speed are the Shot 1/base modifiers. Each later Shot 2-6 adds its own Camera Amplitude and Camera Speed directly after that Shot's Camera Motion. Their default `Follow Base Settings` preserves the previous shared behavior; `Default · Omit` suppresses that modifier only for the selected Shot, while Small/Large and Slow/Fast override only that Shot. The compiler resolves those choices into H3's natural English camera sentence (`with small/large amplitude`, `at slow/fast speed`) only for compatible motions. Handheld Tracking intentionally ignores those modifiers and emits its own unstable operator movement. Turning Multiple Camera Cuts off makes the extra Shot blocks inactive without deleting their stored values.

When multiple shots are enabled, Timeline events remain the action/dialogue timeline. Each event is placed into the shot whose cut window contains its start time. FL2VA/L2VA final-frame alignment points to the actual final shot number, while I2VA continues to anchor Picture 1 to Shot 1.

## Timeline event rows

Each `Timeline N` row is one real event: one target person/group, one start time, one action, one dialogue field, one dialogue-language field, and one delivery mode. If another person acts or speaks at a different moment, use the next row instead of changing the same row's target.

When an English Timeline action begins with a generic human subject, the selected Timeline person remains the authoritative identity. Simple forms such as `A woman walks ...` keep the compact one-sentence profile+action wording. Forms with pre-noun descriptors (`A tall, nervous man ...`, `An elderly woman ...`) are still bound to the selected Person; configured age/gender remain authoritative, while non-profile descriptors such as `tall`, `nervous`, or `East Asian` stay attached to that same Person. Post-modifier forms such as `A woman covered in mud ...`, `A man armed with ...`, `A woman seated by ...`, `A man wrapped in ...`, or `The person holding ...` also stay attached to the stable Person identity rather than creating an unnamed second character. Composite Timeline targets likewise bind leading natural groups such as `A woman and a man ...` or `two people ...` to the already-selected Person group. Independent scene/object subjects such as `A portrait of a woman ...`, `A camera ...`, or `A dog ...` remain independent.

Before rendering the H3 prompt, the backend stably sorts all non-empty timeline rows by **start time first**, then timeline-row number for exact ties. Character number never overrides chronology: if Person 2 speaks at 2 seconds and Person 1 speaks at 5 seconds, Person 2 is rendered first and receives the earlier vocal-event position.

A timeline start time is an **approximate timing target**, not a frame-exact trigger. Generated prompts deliberately use wording such as `At approximately 2.00 seconds`. Natural sequential action and normal playback speed take priority over forcing an impossible schedule; MiniMax H3 is asked to stay as close to the requested timing as practical without inventing slow motion or fast-forward behavior. Stable identity labels keep their capitalization after a time prefix, so `Person A` never becomes `person A`.

If T2VA has no scene text and every visible Timeline row is also empty, the ComfyUI node treats that as an unfinished draft instead of a compiler crash. It blocks the `h3_prompt` branch without inventing a generic subject/action and reports `status=waiting_for_content` through `info`. The strict standalone timeline compiler still rejects truly empty T2VA input.


## Duration range

`duration_seconds` accepts whole seconds from **4 to 30**. MiniMax H3's official supported range is up to 15 seconds; **16-30 seconds are intentionally available for advanced/local workflows** and may increase generation time and memory use sharply. Match this value to the actual H3 video-generation node. When Main is set above 15 seconds, the collapsed **Basic Settings** header also shows a visible `⚠ above official H3 range` summary so this intentional extended range is not mistaken for an officially supported H3 duration.

## Reset settings

The bottom controls use ordinary ComfyUI core button widgets for **Basic View / Show All Settings** and **Reset Settings**. Reset uses the actual ComfyUI widget defaults supplied by the node definition rather than a duplicated hard-coded reset table. A confirmed Reset preserves native media connections such as Main Start/End Image and R2V Picture/Video/Audio Reference media lines, but disconnects external links attached to resettable non-structural widgets, clears remembered dynamic-link state, restores widget defaults, switches to Basic View, and collapses every group. The current `scene_prompt` editing height is intentionally preserved; rows that disappear during reset are removed from the fixed layout and the node's outer bottom edge shrinks by the Core-reported layout delta instead of squeezing the scene editor back to a fresh-node height. Reset first changes the button to **Confirm Reset?** and requires a second click.

## Timeline start-time bounds

Timeline start controls use 0.5-second steps. Their UI maximum follows `duration_seconds - 0.5`; for example, a 10-second video allows starts from 0.0 through 9.5 seconds. If duration is reduced, an existing value above the new maximum visibly clamps to that maximum. Old or malformed workflows that still send an out-of-range or non-grid active event are repaired to the nearest valid 0.5-second value inside the current duration when that correction is unambiguous, and the repair is reported through `info` instead of producing a normal red traceback.

## Structured environment transition safeguards

Structured setting/weather selections are authoritative only inside their own time ranges, so a later environment does not become a global simultaneous requirement. A major setting replacement that occurs away from a camera-cut boundary produces a warning because H3 can otherwise interpret the background replacement as a morph or time-compressed transition. Structured auto ambience follows the same state machine: when rain/wind ambience ends and the next state has no dedicated ambience cue, the prompt explicitly lets the previous environment-specific sound subside instead of carrying it forward. A `reset_to_baseline` with no separately selected baseline returns to an effective 0-second opening override, keeping the emitted text and internal state identical.

## Soundscape silence

MiniMax H3 reserves `overall_soundscape: N/A` for an explicit request for complete silence throughout the video. Therefore `soundscape_mode=silent` emits `N/A` only when there is also no spoken dialogue and no non-diegetic music. If dialogue or background music remains enabled, the soundscape instead states that ambient, physical-action, and non-verbal human sounds are absent.

Custom sound hints belong only to ambience, physical-action sounds, and non-verbal human sounds. Obvious dialogue/voiceover or music wording produces a warning because those belong in the integrated description or music field. `non_diegetic_music` follows the H3 recommendation to focus on instrumentation, speed/tempo, rhythm, texture, and dynamics; obvious abstract mood/emotional-function or diegetic-music wording in a direct hint is preserved but warned rather than silently rewritten.

## Current shot policy

Runtime prompt generation is Timeline-only. Explicit cuts are controlled by **Multiple Camera Cuts** and its Shot 2-6 start times, targets, transitions, and motions. Shot 1 exists even when Multiple Camera Cuts is OFF; its explicit target/framing remains an active single-shot instruction, while the default `current_action + auto` path uses the standard single-shot wording.

Camera semantics are also checked for visibility conflicts. An on-screen lip-synchronized speaker that falls outside a specifically targeted Shot produces an `info` warning, as do face-only framings that cannot visibly verify selected body/wardrobe detail and wide framings that can make fine facial/ethnic-appearance detail too small. The settings are preserved rather than silently rewritten; the warning tells the user when an additional or wider/closer Shot is needed.

When multiple shots are enabled, dialogue-length diagnostics use the current shot window: a line is compared with the time remaining until the next explicit cut, or with the remaining video duration in the final shot. Near-boundary estimates remain warnings, but a line that clearly cannot fit even under the conservative fast-speech bound is blocked so the user can re-time it. The node does not silently rewrite dialogue or invent cross-shot speech.

## Install

If an older `comfyui-Ultra-MiniMax-H3-Prompt` folder is installed, remove that folder first instead of overlaying files. Then copy the new folder into:

`ComfyUI/custom_nodes/comfyui-Ultra-MiniMax-H3-Prompt`

No extra Python translation package is required. The built-in Google/MyMemory routes use the Python/ComfyUI runtime that is already present. If `deep-translator` is already installed it may be used only as a final compatibility fallback, but installation is not required.

Restart ComfyUI.

## Outputs

- `h3_prompt` — final MiniMax H3 prompt.
- `info` — resolved mode, active counts, translation setting, warnings, and blocking status when the node is waiting for a user-fixable condition.

### Public `info` status values

A successful build does not add a `status=` line. When the prompt branch is intentionally blocked for a condition the user can fix, `info` reports one of the following stable status values. ComfyUI uses a **message-bearing `ExecutionBlocker`** when available, so Main and R2V both show the concrete `warning=` reason instead of silently completing or requiring a Python traceback. If `ExecutionBlocker` is unavailable (for example, standalone QA or an older host), the node returns an empty prompt with the same `info` status instead of changing the status category. Public `status=` tokens remain stable for automation/QA. Human-readable translation-failure `warning=` text follows the active ComfyUI locale (Korean or English); the status token itself does not change.

| `status` | Meaning / next action |
| --- | --- |
| `waiting_for_content` | T2VA has neither a scene instruction nor any active Timeline action/dialogue. Add scene or Timeline content. |
| `waiting_for_valid_profile_selection` | A built-in adult-only appearance/clothing preset is incompatible with the selected age. Select an explicit age in the 20s or older, or choose a permitted preset. |
| `waiting_for_valid_input` | A general user-fixable input cannot be repaired safely, such as an invalid duration, reserved H3/R2V markup, invalid selectable value, unsupported R2V reference contract, damaged internal JSON, or required custom sound/music text being missing. Correct the warning shown in `info`. |
| `waiting_for_translation` | Required Korean→English translation could not be completed safely. Built-in Python/HTTP runtime-module failures are distinguished from real online-route failures: runtime failures ask the user to restart/check the ComfyUI Python environment, while online-route failures explain that internet access or a temporary provider limit may be involved. `deep-translator` is optional and is never required for normal operation. If a service was reachable but returned an empty/unsafe result or translation-token integrity failed, `info` instead asks the user to retry or enter the affected descriptive field in English. |

These values are intended to be safe for workflow/automation branching. The accompanying `warning=` line contains the human-readable reason. Internal compiler/renderer invariant failures are deliberately not converted to these statuses; unexpected programming errors remain visible as exceptions.

See `메뉴얼.txt` for the detailed Korean distribution manual.


Timeline start-time widgets use 0.5-second spinner steps. They remain approximate timing targets rather than frame-exact triggers.

### Dynamic person-count visibility

Changing `Main Person Count` between 1, 2, and 3 only changes which person-profile rows are visible. It does not rewrite Timeline event target, start time, action, dialogue, dialogue language, or delivery values. Vue Nodes receives a bounded post-render visibility refresh so reducing 2→1 or 3→1 cannot leave a stale Person 2/3 row in place of Person 1.


Profile-safety note: there is one rule for the node's built-in presets. Adult-only appearance/clothing presets are selectable only with an explicit adult age (`20s` or older). `Unspecified`, `Child`, and `Teenager` therefore cannot be combined with those presets; changing an adult profile to one of those ages temporarily hides the incompatible preset, and returning to an adult age restores it unless another preset was chosen meanwhile. Ordinary `Swimsuit` and `Bikini` are not adult-only. The rule applies only to built-in profile presets; free-form scene/custom text and additional appearance/clothing text are not analyzed or modified. The frontend prevents the combination, while the Timeline compiler performs the single authoritative safety check for old/manual/API workflows and direct compiler calls.


### Scene-only profile behavior

When `Turn Count` is active but all visible Timeline action/dialogue rows are empty, explicitly selected active-person gender, age, appearance, and clothing are still compiled into the final H3 prompt. Untouched/default person rows are not invented. If a real Timeline event exists, the established behavior is preserved: the profile is introduced naturally with that person's first real event. Selecting gender without an age now also remains meaningful (`Female` → woman, `Male` → man, `Non-binary` → non-binary person).


## Separate R2V / Ref2VA node

This package also provides **Ultra MiniMax H3 Prompt R2V** as a separate node. R2V is a separate node rather than a mode inside `Ultra MiniMax H3 Prompt`; Ref2VA therefore uses its own reference inputs and prompt structure.

### Why it is separate

MiniMax H3 full-reference generation uses the **H3-Base-Ref2VA** family and a different reference/prompt contract from the FL2VA-family T2V/I2V modes. The R2V node therefore has an independent Python class, frontend state, serialization state, input contract, and full-reference compiler. Its output contract follows MiniMax's official `skills/h3-prompt-writing/SKILL.md` and `references/ref-en.txt` / `VIDEO_PROMPT_WRITING_GUIDE_ref_en.md` full-reference guidance rather than treating R2V as another main-node mode.

### Reference inputs

The R2V frontend follows ComfyUI's autogrow-style reference-node behavior. In Basic View, connected Reference groups keep Reference Role / Relationship / Apply To as the high-impact controls, and Audio References also keep Dialogue Target visible so exact speech/lyrics can be assigned without hunting through Full View. Subject grouping, source content, and custom result instruction return in Full View. Combo values use localized display labels while their serialized/runtime values remain canonical. To keep the common opening layout aligned with Main, R2V also shows a JS-only one-choice `H3 Mode / 영상 입력 방식` row whose value is `R2V Reference (fixed) / R2V Reference (고정)`; it is display-only, excluded from workflow serialization, and never reaches the backend compiler. The multiline `scene_prompt` follows the same sizing rule as the stable main I2V/T2V node: its current user-sized height is preserved when people, timeline, camera, or reference rows appear/disappear, while only the overall node height grows or shrinks by the fixed-row layout difference.

At first it shows one empty tail for each reference group:

- `Picture 1`
- `Video 1`
- `Video 1 Audio` — optional synchronized soundtrack for that same reference video
- `Audio 1` — standalone reference audio

Connecting the last Picture/Video/Audio slot reveals the next slot. The first 9 Picture, 3 Video, and 3 standalone Audio positions correspond to H3's physical-source limits. Additional role-link positions may appear only so the **same upstream media object** can be connected again with another semantic role; the frontend labels those positions as existing-source role reuse. They do not raise H3's physical limits: after upstream-object deduplication, a 10th unique image, 4th unique video, more than 3 unique standalone Audio files, or more than 12 mixed unique source files is now a user-fixable hard block rather than a prompt that merely carries a warning in `info`. Same-numbered `Video N Audio` soundtracks belong to their reference videos and use ComfyUI's separate soundtrack inputs rather than the standalone Audio slots. If `Video N Audio` is connected without the matching `Video N`, this node still generates a draft prompt and warns that the soundtrack was treated as an independent audio-style cue. Removing a connection compacts the remaining reference sockets and keeps the role/detail metadata attached to the surviving connection. The V1 backend uses ComfyUI's official flexible-input dictionary for these JS-created sockets, so only the compact sockets that actually exist on the node are created while their connected values still reach Python execution.

Like the main node, the R2V node keeps ordinary ComfyUI core buttons at the bottom for **Basic View / Show All Settings** and **Reset Settings**. Structural controls are set locally on the node. Person count, Timeline count, and the multi-shot structure remain usable without forcing Basic View to switch back to Full. When `Multiple Camera Cuts` is ON, each active Shot exposes start time/target/framing and the next Shot ON/OFF control in sequence; disabling a Shot collapses that point and the later Shot rows while stored values remain intact. Full View adds camera amplitude/speed and each Shot's transition/motion tuning. Group `▶/▼` collapse remains independent. Reset preserves connected physical Picture/Video/Audio References, restores resettable values and Reference role/detail UI state, switches to Basic View, and collapses all groups. It intentionally preserves the user's current `scene_prompt` editing height; only the fixed rows removed by reset reduce the node's outer height.

Supported R2V reference limits used by this node:

- Reference images: up to 9
- Reference videos: up to 3; each known clip must be 2–15 seconds and the known total must not exceed 15 seconds
- Standalone reference audios: up to 3; each known clip must be 2–15 seconds and the known standalone-Audio total must not exceed 15 seconds
- Same-numbered `Video N Audio` soundtracks use ComfyUI's separate reference-video soundtrack group and do not consume standalone Audio slots; each known soundtrack must be 2–15 seconds and the known soundtrack-group total must not exceed 15 seconds
- Mixed source files: up to 12
- Target duration: 4–15 seconds
- Audio-only Ref2VA is not valid: at least one Picture or Video reference is required when external Audio is used. Reference-free drafting is still allowed when the user's own scene/timeline defines the task and no external Reference media is connected; in that case `info` only states that no external reference asset is connected.

Reference duration checks are best-effort and compatibility-safe. Official ComfyUI VIDEO objects expose `get_duration()`, and standard AUDIO mappings expose `waveform` plus `sample_rate`; when those values are available, the node enforces the official Ref2VA 2–15 second per-clip and 15 second known-total limits as a user-fixable hard block. Unsupported/custom media objects whose duration cannot be read are not blocked or guessed. Reusing the same upstream object for multiple roles is deduplicated before duration totals are calculated; orphan `Video N Audio` inputs share the independent-Audio duration budget, while a soundtrack paired with its same-numbered Video remains in the separate video-soundtrack group.

For user-fixable validation blocks, **both Main and R2V use a message-bearing ExecutionBlocker** when ComfyUI supports it. The same concrete reason is preserved in `info`. Timing, stale speaker/target choices, and camera states are repaired with warnings when the intended correction is unambiguous; conditions that cannot be repaired safely use the stable blocking statuses below. R2V also rewrites inherited Main-only wording such as `T2VA needs...` into an R2V-specific message before exposing it to the user.

An R2V task may intentionally leave `scene_prompt` and visible Timeline action/dialogue empty when the connected Picture/Video/Audio Reference itself defines the task. In that case R2V uses an internal neutral scaffold only to pass through the inherited text compiler, then the selected Reference role/relationship/content/instruction remains authoritative. Reference-free drafting is also allowed when you do provide your own scene/timeline text. The ordinary T2VA empty-content gate still applies only to the completely empty case.

`Video N Audio` is not a second video file. It represents the enabled soundtrack belonging to the same `Video N`. Use the official ComfyUI flow: connect `Load Video` to `Video N`, then pass that same VIDEO through `Get Video Components` and connect its `audio` output to `Video N Audio`. Audio labels are numbered independently from Video labels, matching ComfyUI H3 presentation order: synchronized video soundtracks first in connected-video order, then standalone Audio references. Current official ComfyUI exposes up to three same-numbered video soundtrack inputs and up to three standalone Audio inputs as separate Ref2VA groups, so a paired soundtrack does not consume a standalone Audio slot.

For local generation, keep the prompt-compiler media input separate from the generation node's conditioning input. This prompt node intentionally receives the source as `VIDEO` so it can inspect duration and preserve whole-video/reference semantics. In current official ComfyUI configurations where `MiniMaxH3ReferenceToVideo.ref_video_N` expects an `IMAGE` frame batch, branch the same `Load Video` source: send the `VIDEO` object to this prompt node's `Video N`, send it through `Get Video Components`, then connect `images` to the generation node's `ref_video_N`. If the original soundtrack is also referenced, connect the extracted `audio` to this node's `Video N Audio` and the corresponding generation-path audio input. Do not try to connect this prompt node's `VIDEO` socket directly to an `IMAGE` reference-video socket.

### Reference roles and relationships

Each connected reference gets an independent UI-only reference plan. In **Basic View** the important controls are **Reference focus**, **Application method**, and **Apply to**; Audio References also keep **Dialogue target** visible. **Show All Settings** additionally exposes subject grouping, **Source details**, and **Result instructions**. These UI-only direct-entry controls never enter the normal `widgets_values` sequence; one hidden `reference_plan_json` remains the serialized authority for their inline values. Optional Text/String links on Source details or Result instructions are normal graph inputs and override the matching inline field only while that link is present.

**Source details** is factual: describe only what is actually visible or audible in the source. **Result instructions** is target-facing: describe how that source element should be preserved, changed, transferred, or otherwise reflected in the final video.

For long reference descriptions, each connected Picture/Video/Audio **Source details** and **Result instructions** row also exposes a standard ComfyUI `STRING` widget-input socket on the same row. Leaving it unconnected keeps the existing inline value. Connecting a Text/String output makes that connected string authoritative for that field without adding multiline rows or changing node height. Person/Timeline/camera/view UI changes preserve these Text links; disconnecting the physical Reference removes only the two Text sockets belonging to that Reference. Reference media types stay explicit: `Picture N` accepts `IMAGE`, `Video N` accepts `VIDEO`, standalone `Audio N` accepts `AUDIO`, and `Video N Audio` accepts `AUDIO`. For a video soundtrack, use the official ComfyUI flow `Load Video → Get Video Components → audio → Video N Audio`. Ordinary still images therefore cannot be connected to either Video row.

Visual references use the official relationship vocabulary `fully_preserved`, `partially_preserved`, `attribute_transfer`, and `weak_reference`; Audio uses `fully_copy`, `partially_copy`, `reference`, and `weak_reference`. The UI also offers **Auto**, which resolves a safe relationship from the selected role. If an Auto identity or clothing reference would otherwise become Fully preserved while the user already has an explicit target override, the compiler softens Auto to `partially_preserved` and reports a warning. For identity references, explicit target **gender, age, ethnic appearance, appearance preset, and appearance additional input** are all treated as identity/appearance overrides; for clothing references, the clothing preset/additional input are treated as wardrobe overrides. An explicitly selected Fully preserved relationship remains strict and rejects those contradictory target overrides.

Picture roles include identity/appearance, clothing, pose/expression, scene/environment, **animal/non-human subject**, visual style, object/product/prop, visual effect/VFX, **visible text/interface**, concrete first/intermediate/final frame anchors, an edited source keyframe, composition anchor, storyboard/shot planning, and custom/general reference.

Video roles include identity/appearance, clothing, motion/performance, scene/environment, **animal/non-human subject**, object/product/prop, visual effect/VFX, **visible text/interface**, camera movement, cut/pacing/temporal rhythm, moving visual style, direct video-edit source, video-continuation source, and custom/general reference. Visible content extracted conceptually from a Video is represented as a `<Subject N>` relationship; `<Video N>` itself is reserved for whole-video temporal/edit/continuation/camera/cut relationships, matching MiniMax's guide.

Audio roles include character voice timbre/delivery, **independent off-screen narrator voice**, music style/texture, sound-effect texture, beat/rhythm/timing, audio continuity/transition, exact dialogue/lyric content, complete audio reuse, partial audio reuse, and custom/general reference. The R2V Timeline speaker choices also include **Narrator**, so narration can coexist with zero visible people or with Person A/B/C without creating a phantom on-screen subject. Exact dialogue/lyric **Source details** keeps the exact source words and original language and may use `[unclear]` for uncertain spans; it is never silently translated or guessed. When that Reference Audio wording is emitted inside `<d>`, MiniMax's Full-Reference rule is followed: ordinary sentence punctuation is standardized and repeated tildes, emoji, bullets, and repeated/decorative punctuation are removed. This is intentionally different from user-authored Timeline dialogue, whose words and punctuation remain verbatim. The **Visible text/interface** visual role likewise keeps its Source details in the original visible language, because MiniMax explicitly exempts scene-visible text from the otherwise-English full-reference structure.

For R2V vocal events, `(Sx)` numbering is global across visible A/B/C speakers and the independent Narrator. The first actual vocal event receives `S1`; a Narrator that speaks before Person A therefore remains `S1`, and any later visible-speaker IDs are remapped consistently in both `detailed_description` and bound `<Audio N>` definitions.

When a multi-shot R2V `scene_prompt` is deliberately written as blank-line-separated chronological phases (for example `At first...`, `Then...`, `By the end...`) and Timeline actions span multiple shots, the compiler keeps those phases in playback order instead of placing the entire future story inside `[Shot 1]`. Ordinary one-paragraph scene text, descriptive multi-paragraph text without clear temporal cues, and scenes without multi-shot action progression keep the established behavior unchanged.

When exact dialogue/lyric Source details is supplied, the selected application scope must agree with the actual Timeline wording. **Auto** binds to the first matching unclaimed vocal event. **All Shots** or an explicit Shot scope requires the source transcript to contain every target dialogue/lyric line that will receive the exact-source claim; otherwise execution returns `waiting_for_valid_input` instead of emitting contradictory Ref2VA instructions. Exact-dialogue references additionally expose an **Exact dialogue speaker** target (`Auto`, A/B/C combinations, or Narrator), so two different Audio references can legally map to two different speakers inside the same Shot. Several exact-dialogue clips are therefore allowed when they target distinct valid events; only contradictory duplicate claims are blocked. If Source details is intentionally left empty, the existing Timeline dialogue remains the authoritative wording. Ordinary R2V text fields also reject reserved six-section/reference-label syntax such as `<Subject N>` so malformed user text cannot leak into the compiler's structural namespace.

Shot scope choices are limited to the target shots that currently exist and include non-contiguous combinations such as **Shot 1 + Shot 3**, matching the official retention examples rather than forcing only one contiguous range. Person B/C roles are unavailable when the current person count does not include them. Temporary role/scope fallbacks keep the user's prior valid selection and restore it if the corresponding person/shot becomes available again.

For non-person visual subjects, **Same target group** (`Auto`, Shared 1–6) can merge several views of the same product, animal, place, environment, effect, visible interface/text, or other compatible target into one `<Subject N>`. Incompatible semantic roles cannot be forced into one group. If grouped source assets intentionally use different preservation strengths or Shot scopes, retention keeps those source-specific contracts instead of flattening them into one ambiguous relationship.

Each role-link still has one explicit **primary semantic role**, but one physical source may now be connected to several role-link positions. The compiler recognizes repeated connections to the same upstream object and keeps one `<Picture N>`, `<Video N>`, or `<Audio N>` identity while merging the explicitly selected roles. This supports cases such as one Video providing person motion + camera motion + cut rhythm, or one Audio providing voice timbre + exact words, without pretending the same file is multiple physical references. The compiler never invents an unselected secondary role from unseen media.

The Main-style scene/person/timeline/camera/dialogue/ambience/music controls remain useful for target scene, people, timeline, camera, dialogue, ambience, and music, but they are now **reference-aware**. R2V nodes default to **1 target person / 1 Timeline row** so the first working surface matches Main and its Person 1 / Timeline 1 hierarchy is immediately coherent. R2V still allows `person_count=0` for environment/object/product/non-person generation; ordinary 0↔1–3 changes preserve the hidden settings and remembered external STRING links, while Reset clears them. A Reference describes source authority; the ordinary controls describe the target or an override. Explicit Fully preserved style/camera/cut/identity/clothing relationships reject contradictory target overrides, while Auto resolves conservatively from the selected role and target settings. Inference-only controls such as resolution, sampler, scheduler, shift, and ComfyUI's `ref_image_size` remain on the actual Ref2VA conditioning/generation nodes and are intentionally not duplicated in this prompt compiler.

The compiler blocks structurally contradictory assignments such as multiple direct-edit sources, edit+continuation at the same time, multiple concrete first/final frame anchors, incompatible same-target groups, duplicate exact-dialogue claims on the same vocal event, or complete target-audio reuse combined with additional Audio references. `fully_copy` also rejects independently scripted target dialogue, explicit target soundscape layers, or independently generated music because those would contradict the reference signal being the complete final audio track. A speaker voice reference must bind to a real target vocal event; individual and shared/group speech keep the existing stable global S-ID assignment.

### MiniMax H3 full-reference output

The R2V node emits the six full-reference sections in this exact order:

1. `subject_definitions`
2. `summary`
3. `retention_analysis`
4. `detailed_description`
5. `overall_soundscape`
6. `non_diegetic_music`

It uses `<Subject N>`, `<Picture N>`, `<Video N>`, and `<Audio N>` relationships, full-reference task labels such as `reference generation`, `keyframe completion`, `video editing`, `video continuation`, `audio reuse`, and `audio reference`, and the documented retention vocabulary (`fully_preserved`, `partially_preserved`, `attribute_transfer`, `weak_reference`, `fully_copy`, `partially_copy`, `reference`). Reference labels are inserted into the actual shot/audio phase where their role takes effect, and `retention_analysis` records the corresponding shot appearances or application range instead of only listing global fidelity. User-authored Timeline dialogue remains verbatim inside the existing H3 `<d>[Language] ...</d>` format. Directly reused/reference-audio dialogue keeps its exact words and original language but uses the Full-Reference punctuation normalization described above. Speaker IDs continue to follow first actual vocal-event order.

The six structural sections are compiled in English. Korean scene/action/profile/sound/music/reference description/instruction text uses the Korean→English translation path. Two official exceptions remain in their original language: dialogue/lyrics and Source details explicitly assigned as **Visible text/interface**.

For ordinary generation tasks, the official full-reference guide normally describes `detailed_description` at roughly 350–500 English words. This rule-based node does not invent visual facts merely to hit that range. Whole-video identity/clothing/environment/object references are therefore defined once in `subject_definitions` / `retention_analysis` and referenced concisely inside later Shots instead of repeating the complete Source details and Result instructions in every Shot. `info` reports both the full prompt character count and detailed-description word count; it warns when the detailed description is unusually short/long and gives a non-blocking warning above 7000 prompt characters because some MiniMax API paths document that limit while local ComfyUI runtimes may differ. Semantic roles with empty **Source details** still report a non-fatal warning because this prompt-only node cannot inspect the connected media itself.

### Connecting it to the actual H3 R2V generation node

This is a **prompt compiler**, not the Ref2VA conditioning/model node. Connect the same source images/videos/audios to the appropriate inputs of the actual ComfyUI MiniMax H3 Reference-to-Video/Ref2VA generation path, and connect this node's `h3_prompt` output to that path's `prompt` input. Keep the connected reference order consistent so `<Picture N>`, `<Video N>`, and `<Audio N>` refer to the same sources on both sides.

The R2V node does not inspect pixels, recognize identities, transcribe reference audio, or semantically inspect a reference video. The user assigns each source's role; the compiler turns that declared relationship plus the familiar scene/people/timeline/camera/dialogue/sound/music controls into the H3 full-reference prompt structure.

For complex reference-heavy prompts, the R2V compiler removes repeated all-Shot continuation prose, compacts retention contracts, and keeps Shot-scoped person/style traits out of earlier Shots. Both Main and R2V now apply the same narrow compiler-only agreement fix to coordinated subjects, so generated forms such as `Person A and Person B walks` / `<Subject 1> and <Subject 2> walks` become `walk` without broadly rewriting arbitrary user prose. This keeps dense legal 12-source simulations materially shorter while preserving the six required sections and reference authority.

R2V frontend layout: Basic View starts with a compact `scene_prompt` area rather than stretching the multiline field to fill a previously larger node. If the user manually enlarges or reduces `scene_prompt`, that chosen height is preserved during ordinary person/timeline/camera/reference layout changes. The node itself grows or shrinks by ComfyUI/LiteGraph's own fixed-widget layout delta, matching the established I2V/T2V behavior; there is no continuous resize observer, interval, or hand-written total-height formula. Basic View starts with `person_count=1` and `turn_count=1`, keeps those two selectors adjacent, and keeps every currently active Person/Timeline group reachable while showing only its quick-edit rows. If the user explicitly selects `person_count=0`, person-specific rows are hidden and Narrator semantics are used where appropriate; returning to 1–3 people restores the ordinary remembered state.


## Example guide

Start with `예제/00_예제_먼저읽기_V3.50.txt`. The main example folder now contains 18 follow-along examples: 2 FL2VA, 4 I2VA, 8 T2VA, and 4 R2V. Alongside the fantasy/cinematic examples, it includes practical real-world examples such as a blue-hour rooftop coffee advertisement, a golden-hour coastal-road car advertisement, a morning bakery croissant advertisement, a rainy night-market food film, and a rainy commute vlog.

The examples use the exact visible control notation where practical. For every multi-shot follow-along example, Shot 1 lists the base camera motion/amplitude/speed and Shots 2-4 explicitly list their own `Camera Motion`, `Camera Amplitude`, and `Camera Speed`; these are no longer treated as one global setting. `Follow Base Setting` inherits the Shot 1 amplitude/speed, while `Default / omit` suppresses that modifier only for the selected Shot.

Reference- and image-based examples are written from the actual visible starting composition. `Overall Scene / Background` describes the static opening stage and spatial layout, while timed actions belong to Progress rows. If the target object is far away, the action must include the required travel; when that travel is unrealistic within a 15-second clip, the example uses an action that can be performed from the visible starting position instead. This prevents prompts such as instantly touching a distant lake from a hilltop and helps H3 preserve the intended visible action sequence.


## License

This distribution uses the restricted bilingual terms in `LICENSE`. Modification, derivative distribution, redistribution, republishing, sharing, sale, or transfer without prior written permission from the copyright holder is prohibited.


## Video-environment timeline options

The optional Extension Options layer provides **Base scene / location** and **Base weather / environment** in Basic Settings, plus matching scene/weather overrides inside each Progress row. The shared data set contains **65 scene/location presets** and **25 weather/environment presets**. These controls are video-oriented rather than image-tag presets: crowded transit, markets, active industrial spaces, rough surf, waterfalls, moving crowds, wind-driven precipitation, lightning, fog, snow, airborne dust and similar visible time-based motion are described explicitly.

The Basic value establishes the opening environment. Each Progress row can **keep the current state**, **return to the base state**, or choose a new preset; a new value persists until a later Progress changes it. A Progress override at 0.0 seconds becomes the effective opening state instead of producing a contradictory instant change. Camera and Sound remain separate controls; environment presets do not select camera movement or non-diegetic audio.

When an enclosed/covered scene such as a packed subway car, train interior, airport terminal, tunnel, cafe, office, or warehouse is combined with rain, snow, or strong outdoor wind, the compiler keeps that weather **outside the enclosed setting**. Only exterior motion visible through openings/windows and indirect lighting/reflection changes are allowed to affect the interior description. If an ongoing storm continues across an outdoor→indoor or indoor→outdoor scene change, the prompt restates that relationship once at the transition so H3 is not told to rain or snow physically inside the enclosed space.

Structured environment changes are time-scoped rather than globally reinforced: the opening place/weather is emphasized only for its opening interval, and each later Progress override is emphasized only from its own timestamp. The compiler no longer tells H3 to keep every selected place or every selected weather state visible at once. When several major setting/weather/camera transitions are packed tightly into a short clip, `info` reports a non-blocking temporal-density warning because that pattern can encourage rushed or time-lapse-like background changes.

World-state styles are compiled together with the selected location instead of describing a normal location first and correcting it afterward. In particular, **Post-apocalyptic** locations are rendered as recognizable post-collapse versions with reduced normal civic operation and context-appropriate damage/scavenged reuse; Cyberpunk, Dark fantasy, Gothic, and Dreamlike locations receive their corresponding world-state interpretation at the location sentence itself. Persistent structured person appearance/wardrobe and an explicitly selected visual style are authoritative over conflicting free-form scene descriptors; time-varying place/weather authority is stated locally at the correct Timeline interval.

Auto Sound keeps structured location/weather ambience on the same Timeline instead of accumulating every past environment into one timeless sound bed. When the scene changes, the environment ambience shifts at that timestamp; synchronized object/action sounds such as footsteps, doors, vehicles, or other visible physical actions remain separate and may continue when the action itself continues.

## Sequential speech

Enable `이어 말하기` inside a Progress group to use 발화 1 / 발화 2 / 발화 3. Each utterance uses the order `대사 / 화자 / 언어 / 말하는 방식`. 발화 1 shares the Progress row's primary dialogue settings, while 발화 2/3 are stored as additional sequential utterances.

When a Progress includes multiple speakers, set the Progress target to the corresponding person combination first. Stale or incompatible speaker/target selections are normalized when they can be repaired safely and are reported through `info`.

## Input correction and blocking

Simple input mistakes that can be corrected without violating the model contract are normalized and reported as non-blocking `info` warnings. Structural limits that cannot be repaired safely, such as unsupported R2V reference counts or durations, Audio-only Ref2VA, damaged or oversized internal JSON, or direct insertion of reserved H3/R2V structures, remain blocked.

After installation, restart ComfyUI completely and refresh the browser.
