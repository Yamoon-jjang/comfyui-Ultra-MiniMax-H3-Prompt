import { app } from "../../scripts/app.js";
import { installConnectedStringTooltips } from "./ultra_h3_connected_string_tooltip.js";
import { installCoreWidgetHoverTooltips } from "./ultra_h3_widget_tooltip.js";
import { installValidationBadge, triggerValidationBadge } from "./ultra_h3_validation_badge.js";
import { EXTENSION_WIDGET_MARKER, installExtensionOptions, refreshExtensionOptions, extensionWidgetNamesForPerson, sceneBaselineWidgetNames, turnSceneWidgetNames, hasSceneEnvironmentExtension, installExtensionTransport, resetExtensionOptions } from "./ultra_h3_extension_options.js";
import { configureGroupedSections, refreshGroupedSections, groupedWidgetVisible, clearGroupedSectionState, setAllGroupedSectionsCollapsed } from "./ultra_h3_grouped_sections.js";
import { installSequentialVocalUi, refreshSequentialVocalLabels, sequentialVocalEnabled, sequentialVocalWidgetNames, sequentialNarratorWidgetNames, sequentialNarratorUsesCustom, SEQUENTIAL_VOCAL_WIDGET_MARKER, migrateFailedNativeSequentialWorkflow, migrateSequentialCoreTextSchema } from "./ultra_h3_sequential_vocal_ui.js";
import { installGraphWidgetHostGeometryGuard } from "./ultra_h3_widget_host_geometry_guard.js";
import { TRANSLATION_API_WIDGET_MARKER, installTranslationApiUi, refreshTranslationApiUi, translationApiWidget } from "./ultra_h3_translation_api.js";

const NODE_CLASS = "UltraMiniMaxH3PromptR2V";
const MAX_CAMERA_SHOTS = 6;
const GROUPED_SECTIONS_INSTALLED = new WeakSet();
const UI_MARKER = Symbol("ultraH3R2VUiOnly");
const REFERENCE_UI_MARKER = Symbol("ultraH3R2VReferenceUi");
const VIEW_TOGGLE_MARKER = Symbol("ultraH3R2VViewToggle");
const ACTION_ROW_MARKER = Symbol("ultraH3R2VActionRow");
const RESET_BUTTON_MARKER = Symbol("ultraH3R2VResetButton");
const MODE_DISPLAY_MARKER = Symbol("ultraH3R2VModeDisplay");
const BASIC_COUNT_UI_MARKER = Symbol("ultraH3R2VBasicCountUi");
const BASIC_VIEW_PROPERTY = "ultra_h3_r2v_basic_view";
const PREFERENCE_PROPERTY = "__ultra_h3_r2v_preferences_v1";
const DYNAMIC_LINK_MEMORY_PROPERTY = "__ultra_h3_r2v_dynamic_link_memory_v1";
const DETACHED_REFERENCE_PLAN_PROPERTY = "__ultra_h3_r2v_detached_reference_plan_v1";
const CORE_DEFAULTS_PROPERTY = "__ultraH3R2VCoreWidgetDefaults";
const MAIN_NODE_PERSISTENCE_GUARD_MARKER = "__ultra_h3_persistence_guard_v21";
const RESET_CONFIRM_MS = 4500;
// H3's physical-source limits remain Picture<=9 / Video<=3 / Audio<=3.
const MAX_ROLE_LINKS = { image: 18, video: 6, audio: 6 };
const PHYSICAL_SOURCE_MAX = { image: 9, video: 3, audio: 3 };
const NODE_STATES = new WeakMap();
// Capture the real fresh-node outer geometry once at creation time. Confirmed reset
// restores this exact runtime baseline instead of guessing from computeSize() or
// hard-coded scene allowances, while preserving the user's current width.
const FRESH_RESET_GEOMETRY = new WeakMap();
// Preserve the exact Core/LiteGraph node size serialized in the workflow.
// Grouped visibility is restored later than Core configure, so without this
// baseline the flexible scene_prompt can absorb a temporary expanded layout.
const SERIALIZED_WORKFLOW_GEOMETRY = new WeakMap();
// Nodes whose serialized workflow geometry was just restored in
// loadedGraphNode. Until Vue has mounted and settled the new graph view, the
// scene_prompt textarea reports a transient flex height; it must never be
// captured as the "user" scene height (that capture made the textarea grow on
// every workflow switch).
const WORKFLOW_LOAD_SETTLING = new WeakSet();
let GRAPH_CONFIGURE_DEPTH = 0;
const PROFILE_FIELDS = {
  1: [
    "person_a_gender", "person_a_age", "person_a_advanced",
    "person_a_appearance_preset", "person_a_appearance_desc",
    "person_a_clothing_preset", "person_a_clothing_desc", "person_a_voice_desc",
  ],
  2: [
    "person_b_gender", "person_b_age", "person_b_advanced",
    "person_b_appearance_preset", "person_b_appearance_desc",
    "person_b_clothing_preset", "person_b_clothing_desc", "person_b_voice_desc",
  ],
  3: [
    "person_c_gender", "person_c_age", "person_c_advanced",
    "person_c_appearance_preset", "person_c_appearance_desc",
    "person_c_clothing_preset", "person_c_clothing_desc", "person_c_voice_desc",
  ],
};
const TURN_FIELDS = [
  "speaker", "elapsed_seconds", "action", "dialogue_text", "dialogue_language", "dialogue_delivery",
];
const CAMERA_SHOT_FIELDS = {
  2: ["camera_shot_2_enabled", "camera_shot_2_start_seconds", "camera_shot_2_transition", "camera_shot_2_target", "camera_shot_2_framing", "camera_shot_2_motion", "camera_shot_2_amplitude", "camera_shot_2_speed"],
  3: ["camera_shot_3_enabled", "camera_shot_3_start_seconds", "camera_shot_3_transition", "camera_shot_3_target", "camera_shot_3_framing", "camera_shot_3_motion", "camera_shot_3_amplitude", "camera_shot_3_speed"],
  4: ["camera_shot_4_enabled", "camera_shot_4_start_seconds", "camera_shot_4_transition", "camera_shot_4_target", "camera_shot_4_framing", "camera_shot_4_motion", "camera_shot_4_amplitude", "camera_shot_4_speed"],
  5: ["camera_shot_5_enabled", "camera_shot_5_start_seconds", "camera_shot_5_transition", "camera_shot_5_target", "camera_shot_5_framing", "camera_shot_5_motion", "camera_shot_5_amplitude", "camera_shot_5_speed"],
  6: ["camera_shot_6_enabled", "camera_shot_6_start_seconds", "camera_shot_6_transition", "camera_shot_6_target", "camera_shot_6_framing", "camera_shot_6_motion", "camera_shot_6_amplitude", "camera_shot_6_speed"],
};


const ROLE_LABELS = {
  en: {
    image: {
      general_reference: "General visual reference",
      person_a_identity: "Person A · identity / appearance",
      person_b_identity: "Person B · identity / appearance",
      person_c_identity: "Person C · identity / appearance",
      person_a_clothing: "Person A · clothing",
      person_b_clothing: "Person B · clothing",
      person_c_clothing: "Person C · clothing",
      person_a_pose_expression: "Person A · pose / expression",
      person_b_pose_expression: "Person B · pose / expression",
      person_c_pose_expression: "Person C · pose / expression",
      scene_environment: "Scene / environment",
      animal_nonhuman_subject: "Animal / non-human subject",
      style_reference: "Visual style",
      object_prop: "Object / product / prop",
      visual_effect: "Visual effect / VFX",
      interface_visible_text: "Visible text / interface",
      first_frame_anchor: "Concrete first-frame anchor",
      keyframe_anchor: "Concrete intermediate keyframe anchor",
      edited_keyframe_anchor: "Source keyframe to edit",
      last_frame_anchor: "Concrete final-frame anchor",
      composition_anchor: "Concrete frame / composition anchor",
      storyboard: "Storyboard / shot planning",
      custom: "Custom role",
    },
    video: {
      general_reference: "General video reference",
      person_a_identity: "Person A · identity / appearance",
      person_b_identity: "Person B · identity / appearance",
      person_c_identity: "Person C · identity / appearance",
      person_a_clothing: "Person A · clothing",
      person_b_clothing: "Person B · clothing",
      person_c_clothing: "Person C · clothing",
      person_a_motion: "Person A · motion / performance",
      person_b_motion: "Person B · motion / performance",
      person_c_motion: "Person C · motion / performance",
      scene_environment: "Scene / environment",
      animal_nonhuman_subject: "Animal / non-human subject",
      object_prop: "Object / product / prop",
      visual_effect: "Visual effect / VFX",
      interface_visible_text: "Visible text / interface",
      camera_motion: "Camera movement",
      cuts_rhythm: "Cuts / pacing / rhythm",
      style_reference: "Moving visual style",
      video_edit_source: "Source video to edit",
      video_continuation_source: "Source video to continue",
      custom: "Custom role",
    },
    audio: {
      general_reference: "General audio reference",
      person_a_voice: "Person A · voice timbre / delivery",
      person_b_voice: "Person B · voice timbre / delivery",
      person_c_voice: "Person C · voice timbre / delivery",
      narrator_voice: "Narrator · independent off-screen voice",
      music_style: "Music style / texture",
      sound_effects: "Sound-effect texture",
      rhythm_timing: "Beat / rhythm / timing",
      audio_continuity: "Audio continuity / transition",
      dialogue_content: "Exact dialogue / lyric content",
      full_audio_reuse: "Reuse full audio signal",
      partial_audio_reuse: "Reuse part of audio signal",
      custom: "Custom role",
    },
    role: "Reference focus",
    roleTooltip: "Choose what this image, video, or audio should contribute to the final video, such as identity, clothing, motion, camera movement, or voice.",
    relationship: "Application method",
    relationshipTooltip: "Choose how the selected source element should affect the final video: preserve it, use part of it, transfer it, or use it only as a weak reference.",
    relationshipAuto: "Auto · resolve from reference focus and target settings",
    subjectGroup: "Same subject link",
    subjectGroupTooltip: "Use the same group number when multiple references show the same person, object, place, or other target. Leave the default for separate targets.",
    subjectGroupAuto: "Separate subject · default",
    dialogueTarget: "Dialogue speaker",
    dialogueTargetTooltip: "Choose who should speak the exact dialogue or lyrics from this audio reference in the final video.",
    dialogueTargetAuto: "Auto · match dialogue in scope",
    scope: "Apply to",
    scopeTooltip: "Choose which Shot(s) should use this reference. Auto follows the selected reference focus.",
    sourceContent: "Source details",
    sourceContentTooltip: "Describe what is actually visible or audible in the connected source. Put how it should affect the final video under Result instructions. With Descriptive Text Translation on Auto, Korean descriptive text here is translated to English; with Off, it is preserved.",
    sourceContentDialogue: "Exact source dialogue / lyrics",
    sourceContentDialogueTooltip: "Enter the exact dialogue or lyrics heard in the source, in the original language. Use [unclear] for uncertain parts.",
    sourceContentVisibleText: "Exact visible text / interface",
    sourceContentVisibleTextTooltip: "Enter the exact text or UI labels visible in the source, in the original language. Do not translate them here.",
    applyInstruction: "Result instructions",
    applyInstructionTooltip: "Describe how the selected source element should appear in the final video. Example: keep only the jacket color/material, or use only the running rhythm. With Descriptive Text Translation on Auto, Korean instructions are translated to English; with Off, they are preserved.",
    sourceContentPlaceholder: "What is actually visible/audible in the source · set result instructions below",
    sourceContentDialoguePlaceholder: "Enter the exact source words/lyrics in the original language; use [unclear] for uncertain spans",
    sourceContentVisibleTextPlaceholder: "Enter visible text/UI labels in the original language exactly as shown; add no translation here",
    applyInstructionPlaceholder: "Optional · how this source should affect the final video",
  },
  ko: {
    image: {
      general_reference: "일반 시각 참조",
      person_a_identity: "인물 A · 정체성 / 외형",
      person_b_identity: "인물 B · 정체성 / 외형",
      person_c_identity: "인물 C · 정체성 / 외형",
      person_a_clothing: "인물 A · 의상",
      person_b_clothing: "인물 B · 의상",
      person_c_clothing: "인물 C · 의상",
      person_a_pose_expression: "인물 A · 포즈 / 표정",
      person_b_pose_expression: "인물 B · 포즈 / 표정",
      person_c_pose_expression: "인물 C · 포즈 / 표정",
      scene_environment: "장면 / 배경 / 환경",
      animal_nonhuman_subject: "동물 / 비인물 주체",
      style_reference: "영상 스타일",
      object_prop: "사물 / 제품 / 소품",
      visual_effect: "시각 효과 / VFX",
      interface_visible_text: "화면 글자 / 인터페이스",
      first_frame_anchor: "실제 첫 프레임 기준",
      keyframe_anchor: "실제 중간 키프레임 기준",
      edited_keyframe_anchor: "편집할 원본 키프레임",
      last_frame_anchor: "실제 마지막 프레임 기준",
      composition_anchor: "실제 프레임 / 구도 기준",
      storyboard: "스토리보드 / 촬영 계획",
      custom: "직접 지정",
    },
    video: {
      general_reference: "일반 비디오 참조",
      person_a_identity: "인물 A · 정체성 / 외형",
      person_b_identity: "인물 B · 정체성 / 외형",
      person_c_identity: "인물 C · 정체성 / 외형",
      person_a_clothing: "인물 A · 의상",
      person_b_clothing: "인물 B · 의상",
      person_c_clothing: "인물 C · 의상",
      person_a_motion: "인물 A · 동작 / 연기",
      person_b_motion: "인물 B · 동작 / 연기",
      person_c_motion: "인물 C · 동작 / 연기",
      scene_environment: "장면 / 배경 / 환경",
      animal_nonhuman_subject: "동물 / 비인물 주체",
      object_prop: "사물 / 제품 / 소품",
      visual_effect: "시각 효과 / VFX",
      interface_visible_text: "화면 글자 / 인터페이스",
      camera_motion: "카메라 움직임",
      cuts_rhythm: "컷 / 속도 / 리듬",
      style_reference: "움직이는 영상 스타일",
      video_edit_source: "직접 편집할 원본 비디오",
      video_continuation_source: "이어 만들 원본 비디오",
      custom: "직접 지정",
    },
    audio: {
      general_reference: "일반 오디오 참조",
      person_a_voice: "인물 A · 음색 / 말투",
      person_b_voice: "인물 B · 음색 / 말투",
      person_c_voice: "인물 C · 음색 / 말투",
      narrator_voice: "내레이터 · 독립 화면 밖 음성",
      music_style: "음악 스타일 / 질감",
      sound_effects: "효과음 질감",
      rhythm_timing: "박자 / 리듬 / 타이밍",
      audio_continuity: "오디오 연속성 / 전환",
      dialogue_content: "정확한 대사 / 가사 내용",
      full_audio_reuse: "오디오 전체 신호 재사용",
      partial_audio_reuse: "오디오 일부 신호 재사용",
      custom: "직접 지정",
    },
    role: "참고할 요소",
    roleTooltip: "이 이미지·영상·오디오에서 최종 영상에 참고할 요소를 고릅니다. 예: 인물 외형, 의상, 동작, 카메라 움직임, 음색.",
    relationship: "반영 방식",
    relationshipTooltip: "선택한 원본 요소를 최종 영상에 어떻게 반영할지 정합니다. 그대로 유지, 일부만 참고, 다른 대상에 전달, 약하게 참고 등을 선택합니다.",
    relationshipAuto: "자동 · 참고 요소와 목표 설정에 맞게 결정",
    subjectGroup: "같은 대상 연결",
    subjectGroupTooltip: "여러 Reference가 같은 인물·사물·장소 등을 보여주면 같은 번호로 연결합니다. 서로 다른 대상이면 기본값을 유지합니다.",
    subjectGroupAuto: "별도 대상 · 기본값",
    dialogueTarget: "대사 화자 지정",
    dialogueTargetTooltip: "이 오디오에 들어 있는 정확한 대사·가사를 최종 영상에서 누가 말할지 지정합니다.",
    dialogueTargetAuto: "자동 · 범위의 대사와 일치",
    scope: "적용 구간",
    scopeTooltip: "이 Reference를 어느 Shot에 적용할지 정합니다. 자동은 선택한 참고 요소에 맞춰 결정합니다.",
    sourceContent: "원본 내용·특징",
    sourceContentTooltip: "연결한 원본에서 실제로 보이거나 들리는 내용을 적습니다. 최종 영상에 어떻게 반영할지는 아래 ‘결과 반영 방법’에 적습니다. 설명문 자동 번역이 자동이면 이 일반 설명의 한국어를 영어로 번역하고, 사용 안 함이면 입력 그대로 사용합니다.",
    sourceContentDialogue: "원본 대사·가사",
    sourceContentDialogueTooltip: "원본 오디오에서 실제로 들리는 대사·가사를 원래 언어 그대로 입력합니다. 불확실한 부분은 [unclear]로 표시합니다.",
    sourceContentVisibleText: "원본 화면 글자·UI",
    sourceContentVisibleTextTooltip: "원본 화면에 실제로 보이는 글자·UI 라벨을 원래 언어 그대로 입력합니다. 여기서는 번역하지 않습니다.",
    applyInstruction: "결과 반영 방법",
    applyInstructionTooltip: "위에서 정한 원본 요소를 최종 영상에 어떻게 반영할지 적습니다. 예: 재킷 색·재질만 유지, 달리는 리듬만 참고. 설명문 자동 번역이 자동이면 한국어 지시를 영어로 번역하고, 사용 안 함이면 입력 그대로 사용합니다.",
    sourceContentPlaceholder: "원본에서 실제로 보이거나 들리는 내용 · 결과 반영 방법은 아래에서 지정",
    sourceContentDialoguePlaceholder: "원본 대사/가사를 원래 언어 그대로 입력하세요. 불확실한 구간은 [unclear] 사용",
    sourceContentVisibleTextPlaceholder: "화면에 보이는 글자/UI 라벨을 원래 언어 그대로 정확히 입력하세요. 여기서는 번역하지 않습니다",
    applyInstructionPlaceholder: "선택 사항 · 최종 영상에 어떻게 반영할지 입력",
  },
};

const RELATIONSHIP_LABELS = {
  en: {
    auto: "Auto · reference-focus aware",
    fully_preserved: "Fully preserved",
    partially_preserved: "Partially preserved",
    attribute_transfer: "Attribute transfer",
    weak_reference: "Weak reference",
    fully_copy: "Fully copy audio",
    partially_copy: "Partially copy audio",
    reference: "Reference characteristics only",
  },
  ko: {
    auto: "자동 · 참고 요소에 맞게",
    fully_preserved: "완전 보존",
    partially_preserved: "부분 보존",
    attribute_transfer: "속성 전달",
    weak_reference: "약한 참조",
    fully_copy: "오디오 전체 복사",
    partially_copy: "오디오 일부 복사",
    reference: "특성만 참조",
  },
};

const CORE_OPTION_LABELS = {"en":{"scene_translate":{"off":"Off · preserve input","ko_to_en":"Auto · Korean→English / keep English"},"visual_style":{"auto":"Preserve source/reference; add no style","cinematic":"Cinematic","family_film":"Family Film","warm_cinematic":"Warm Cinematic","natural":"Natural Live-Action","live_action":"Live-action","live_action_cinematic":"Live-action + Cinematic","2d_animated":"2D Animated","japanese_anime":"Japanese Anime","3d_cg":"3D CG","claymation":"Claymation","watercolor":"Watercolor","vintage_film":"Vintage Film","monochrome_cinematic":"Monochrome Cinematic","film_noir":"Film Noir","dark_fantasy":"Dark Fantasy","cinematic_horror":"Cinematic Horror","ominous_dark":"Ominous Dark","post_apocalyptic":"Post-Apocalyptic","gothic":"Gothic","cyberpunk":"Cyberpunk","dreamlike":"Dreamlike"},"camera_motion":{"auto":"No camera instruction","static":"Static Shot","zoom_in":"Zoom In","zoom_out":"Zoom Out","push_in":"Push In","pull_out":"Pull Out","pan_left":"Pan Left","pan_right":"Pan Right","truck_left":"Truck Left","truck_right":"Truck Right","tilt_up":"Tilt Up","tilt_down":"Tilt Down","pedestal_up":"Pedestal Up","pedestal_down":"Pedestal Down","arc_shot":"Arc Shot","tracking_shot":"Tracking Shot","handheld_tracking":"Handheld Tracking","shake_slightly":"Shake Slightly","shake_strongly":"Shake Strongly","pov":"POV","roll_clockwise":"Roll Clockwise","roll_counterclockwise":"Roll Counterclockwise"},"camera_amplitude":{"default":"Default · Omit","small":"Small","large":"Large"},"camera_speed":{"default":"Default · Omit","slow":"Slow","fast":"Fast"},"camera_shot_1_target":{"current_action":"Current Action Focus","A":"Person A","B":"Person B","C":"Person C","A+B":"Person A + B","A+C":"Person A + C","B+C":"Person B + C","A+B+C":"Person A + B + C","scene":"Full Scene"},"camera_shot_2_transition":{"cut":"Cut (Transition)","cross_dissolve":"Cross-Dissolve (Transition)","fade":"Fade (Transition)","wipe":"Wipe (Transition)"},"camera_shot_2_target":{"current_action":"Current Action Focus","A":"Person A","B":"Person B","C":"Person C","A+B":"Person A + B","A+C":"Person A + C","B+C":"Person B + C","A+B+C":"Person A + B + C","scene":"Full Scene"},"camera_shot_2_motion":{"auto":"No camera instruction","static":"Static Shot","zoom_in":"Zoom In","zoom_out":"Zoom Out","push_in":"Push In","pull_out":"Pull Out","pan_left":"Pan Left","pan_right":"Pan Right","truck_left":"Truck Left","truck_right":"Truck Right","tilt_up":"Tilt Up","tilt_down":"Tilt Down","pedestal_up":"Pedestal Up","pedestal_down":"Pedestal Down","arc_shot":"Arc Shot","tracking_shot":"Tracking Shot","handheld_tracking":"Handheld Tracking","shake_slightly":"Shake Slightly","shake_strongly":"Shake Strongly","pov":"POV","roll_clockwise":"Roll Clockwise","roll_counterclockwise":"Roll Counterclockwise"},"camera_shot_3_transition":{"cut":"Cut (Transition)","cross_dissolve":"Cross-Dissolve (Transition)","fade":"Fade (Transition)","wipe":"Wipe (Transition)"},"camera_shot_3_target":{"current_action":"Current Action Focus","A":"Person A","B":"Person B","C":"Person C","A+B":"Person A + B","A+C":"Person A + C","B+C":"Person B + C","A+B+C":"Person A + B + C","scene":"Full Scene"},"camera_shot_3_motion":{"auto":"No camera instruction","static":"Static Shot","zoom_in":"Zoom In","zoom_out":"Zoom Out","push_in":"Push In","pull_out":"Pull Out","pan_left":"Pan Left","pan_right":"Pan Right","truck_left":"Truck Left","truck_right":"Truck Right","tilt_up":"Tilt Up","tilt_down":"Tilt Down","pedestal_up":"Pedestal Up","pedestal_down":"Pedestal Down","arc_shot":"Arc Shot","tracking_shot":"Tracking Shot","handheld_tracking":"Handheld Tracking","shake_slightly":"Shake Slightly","shake_strongly":"Shake Strongly","pov":"POV","roll_clockwise":"Roll Clockwise","roll_counterclockwise":"Roll Counterclockwise"},"camera_shot_4_transition":{"cut":"Cut (Transition)","cross_dissolve":"Cross-Dissolve (Transition)","fade":"Fade (Transition)","wipe":"Wipe (Transition)"},"camera_shot_4_target":{"current_action":"Current Action Focus","A":"Person A","B":"Person B","C":"Person C","A+B":"Person A + B","A+C":"Person A + C","B+C":"Person B + C","A+B+C":"Person A + B + C","scene":"Full Scene"},"camera_shot_4_motion":{"auto":"No camera instruction","static":"Static Shot","zoom_in":"Zoom In","zoom_out":"Zoom Out","push_in":"Push In","pull_out":"Pull Out","pan_left":"Pan Left","pan_right":"Pan Right","truck_left":"Truck Left","truck_right":"Truck Right","tilt_up":"Tilt Up","tilt_down":"Tilt Down","pedestal_up":"Pedestal Up","pedestal_down":"Pedestal Down","arc_shot":"Arc Shot","tracking_shot":"Tracking Shot","handheld_tracking":"Handheld Tracking","shake_slightly":"Shake Slightly","shake_strongly":"Shake Strongly","pov":"POV","roll_clockwise":"Roll Clockwise","roll_counterclockwise":"Roll Counterclockwise"},"soundscape_mode":{"auto":"Auto","minimal":"Minimal Natural","custom_only":"Custom sound hint only · empty = natural fallback","silent":"No ambience / physical sound"},"music_mode":{"none":"None","sparse_piano_strings":"Sparse Piano + Low Strings","acoustic_guitar_bass":"Acoustic Guitar + Bass","classical_guitar":"Classical Guitar","soft_light_music":"Soft Light Instrumental","gentle_classical":"Gentle Classical","lyrical_harp_cello":"Lyrical Harp + Cello","light_jazz":"Light Jazz","bossa_nova":"Bossa Nova","korean_traditional_fusion":"Korean Traditional Fusion","vintage_pop":"Vintage Pop","modern_pop":"Modern Pop","kpop_style":"K-pop Style","kpop_dance":"K-pop Dance","fast_rap_beat":"Fast Rap Beat","oldschool_hiphop":"Old-School Hip-Hop","funk_groove":"Funk Groove","rock_drive":"Rock Drive","ambient_synth":"Ambient Synth","dark_ambient":"Dark Ambient","electronic_pulse":"Electronic Pulse","upbeat_electronic":"Upbeat Electronic","minimal_luxury_electronic":"Minimal Luxury Electronic","tech_product_pulse":"Tech Product Electronic","synthwave":"Synthwave","dream_pop":"Dream Pop","cinematic_percussion":"Cinematic Percussion","orchestral_rise":"Orchestral Rise","cheerful_march":"Cheerful March","grand_march":"Grand March","celestial_space":"Celestial · Space","mystic_fantasy":"Mystical Fantasy","custom":"Custom music hint · empty = no music"},"person_a_gender":{"unspecified":"Unspecified","female":"Female","male":"Male","nonbinary":"Non-binary"},"person_a_age":{"unspecified":"Unspecified","child":"Child","teen":"Teenager","twenties":"20s","thirties":"30s","forties":"40s","fifties":"50s","sixties":"60s","elderly":"Elderly"},"person_b_gender":{"unspecified":"Unspecified","female":"Female","male":"Male","nonbinary":"Non-binary"},"person_b_age":{"unspecified":"Unspecified","child":"Child","teen":"Teenager","twenties":"20s","thirties":"30s","forties":"40s","fifties":"50s","sixties":"60s","elderly":"Elderly"},"person_c_gender":{"unspecified":"Unspecified","female":"Female","male":"Male","nonbinary":"Non-binary"},"person_c_age":{"unspecified":"Unspecified","child":"Child","teen":"Teenager","twenties":"20s","thirties":"30s","forties":"40s","fifties":"50s","sixties":"60s","elderly":"Elderly"},"turn_1_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_1_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_1_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"turn_2_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_2_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_2_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"turn_3_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_3_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_3_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"turn_4_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_4_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_4_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"turn_5_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_5_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_5_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"turn_6_speaker":{"A":"Person 1","B":"Person 2","C":"Person 3","A+B":"Person 1 + 2","A+C":"Person 1 + 3","B+C":"Person 2 + 3","A+B+C":"Person 1 + 2 + 3"},"turn_6_dialogue_language":{"auto":"Auto · Korean/English priority","English":"English","Korean":"Korean","Japanese":"Japanese","Chinese":"Chinese","Spanish":"Spanish","French":"French","German":"German","Russian":"Russian","Arabic":"Arabic","Italian":"Italian","Portuguese":"Portuguese"},"turn_6_dialogue_delivery":{"on_screen":"On-screen direct speech","voiceover":"Off-screen voiceover"},"person_a_appearance_preset":{"none":"Unspecified","average_build":"Average Build","slim_build":"Slim Build","petite_build":"Petite Build","diminutive_build":"Slight Build","athletic_build":"Athletic Build","lean_muscular_build":"Lean Toned Build","muscular_build":"Muscular Build","solid_build":"Sturdy Build","curvy_build":"Curvy Build","hourglass_figure":"Hourglass Figure","full_figure":"Full-Figured Build","tall_slim_build":"Tall Slim Build","tall_build":"Tall Build","short_stature":"Short Stature","long_legs":"Long Legs","broad_shoulders":"Broad Shoulders","full_bust":"Full Bust (Adults Only)","small_bust":"Small Bust (Adults Only)","soft_round_features":"Soft Rounded Features","defined_jawline":"Defined Jawline","freckles":"Light Freckles","light_stubble":"Light Stubble","full_beard":"Full Beard","long_black_hair":"Long Black Hair","long_brown_hair":"Long Brown Hair","shoulder_length_hair":"Shoulder-Length Hair","straight_hair":"Straight Hair","wavy_hair":"Wavy Hair","curly_hair":"Curly Hair","short_hair":"Short Hair","short_bob":"Short Bob","pixie_cut":"Pixie Cut","buzz_cut":"Buzz Cut","ponytail":"Ponytail","braided_hair":"Braided Hair"},"person_a_clothing_preset":{"none":"Unspecified","tailored_suit":"Tailored Suit","business_casual":"Business Casual","shirt_and_slacks":"Shirt + Slacks","blouse_and_pencil_skirt":"Blouse + Pencil Skirt","coat_and_skirt":"Coat + Skirt","tshirt_and_jeans":"T-Shirt + Jeans","blouse_and_jeans":"Blouse + Jeans","cardigan_and_skirt":"Cardigan + Skirt","knit_sweater_and_skirt":"Knit Sweater + Skirt","turtleneck_and_slacks":"Turtleneck + Slacks","oversized_sweater":"Oversized Sweater","casual_jeans":"Casual Jeans","denim_jacket":"Denim Jacket","leather_jacket":"Leather Jacket","trench_coat":"Trench Coat","hoodie_and_joggers":"Hoodie + Joggers","streetwear":"Contemporary Streetwear","dress":"Simple Dress","sundress":"Sundress","work_apron":"Work Apron","chef_uniform":"Chef's Uniform","work_overalls":"Work Overalls","mechanic_coveralls":"Mechanic Coveralls","medical_scrubs":"Medical Scrubs","lab_coat":"Lab Coat","raincoat":"Raincoat","puffer_jacket":"Puffer Jacket","pajamas":"Pajamas","school_uniform":"School Uniform","sportswear":"General Sportswear / Jogging Clothes","yoga_outfit":"Yoga Outfit","tennis_outfit":"Tennis Outfit","cycling_outfit":"Cycling Outfit","crop_top_and_leggings":"Crop Top + Leggings","tank_top_and_shorts":"Tank Top + Shorts","hanbok":"Hanbok","kimono":"Kimono","qipao":"Qipao","ao_dai":"Ao Dai","swimsuit":"Standard Swimsuit","one_piece_swimsuit":"One-Piece Swimsuit","bikini":"Bikini","beach_cover_up":"Swimsuit + Beach Cover-Up","cocktail_dress":"Cocktail Dress","evening_gown":"Evening Gown","mini_skirt_and_blouse":"Blouse + Mini Skirt (Adult)","crop_top_and_jeans":"Crop Top + Jeans (Adult)","camisole_and_shorts":"Camisole + Shorts (Adult)","bodycon_dress":"Bodycon Dress (Adult)","off_shoulder_dress":"Off-Shoulder Dress (Adult)","halter_neck_dress":"Halter-Neck Dress (Adult)","slip_dress":"Slip Dress (Adult)","lingerie_set":"Lingerie Set (Adults Only)","bra_and_panties":"Bra + Panties (Adults Only)","sheer_lingerie":"Sheer Lingerie (Adults Only)","open_robe_lingerie":"Open Robe + Lingerie (Adults Only)","micro_bikini":"Micro Bikini (Adults Only)","bodystocking":"Bodystocking (Adults Only)","thong_only":"Thong Only (Adults Only)","topless_with_bottoms":"Topless with Bottoms (Adults Only)","loose_apron_only":"Loose Apron Only (Adults Only)","nude":"Nude (Adults Only)"},"person_b_appearance_preset":{"none":"Unspecified","average_build":"Average Build","slim_build":"Slim Build","petite_build":"Petite Build","diminutive_build":"Slight Build","athletic_build":"Athletic Build","lean_muscular_build":"Lean Toned Build","muscular_build":"Muscular Build","solid_build":"Sturdy Build","curvy_build":"Curvy Build","hourglass_figure":"Hourglass Figure","full_figure":"Full-Figured Build","tall_slim_build":"Tall Slim Build","tall_build":"Tall Build","short_stature":"Short Stature","long_legs":"Long Legs","broad_shoulders":"Broad Shoulders","full_bust":"Full Bust (Adults Only)","small_bust":"Small Bust (Adults Only)","soft_round_features":"Soft Rounded Features","defined_jawline":"Defined Jawline","freckles":"Light Freckles","light_stubble":"Light Stubble","full_beard":"Full Beard","long_black_hair":"Long Black Hair","long_brown_hair":"Long Brown Hair","shoulder_length_hair":"Shoulder-Length Hair","straight_hair":"Straight Hair","wavy_hair":"Wavy Hair","curly_hair":"Curly Hair","short_hair":"Short Hair","short_bob":"Short Bob","pixie_cut":"Pixie Cut","buzz_cut":"Buzz Cut","ponytail":"Ponytail","braided_hair":"Braided Hair"},"person_b_clothing_preset":{"none":"Unspecified","tailored_suit":"Tailored Suit","business_casual":"Business Casual","shirt_and_slacks":"Shirt + Slacks","blouse_and_pencil_skirt":"Blouse + Pencil Skirt","coat_and_skirt":"Coat + Skirt","tshirt_and_jeans":"T-Shirt + Jeans","blouse_and_jeans":"Blouse + Jeans","cardigan_and_skirt":"Cardigan + Skirt","knit_sweater_and_skirt":"Knit Sweater + Skirt","turtleneck_and_slacks":"Turtleneck + Slacks","oversized_sweater":"Oversized Sweater","casual_jeans":"Casual Jeans","denim_jacket":"Denim Jacket","leather_jacket":"Leather Jacket","trench_coat":"Trench Coat","hoodie_and_joggers":"Hoodie + Joggers","streetwear":"Contemporary Streetwear","dress":"Simple Dress","sundress":"Sundress","work_apron":"Work Apron","chef_uniform":"Chef's Uniform","work_overalls":"Work Overalls","mechanic_coveralls":"Mechanic Coveralls","medical_scrubs":"Medical Scrubs","lab_coat":"Lab Coat","raincoat":"Raincoat","puffer_jacket":"Puffer Jacket","pajamas":"Pajamas","school_uniform":"School Uniform","sportswear":"General Sportswear / Jogging Clothes","yoga_outfit":"Yoga Outfit","tennis_outfit":"Tennis Outfit","cycling_outfit":"Cycling Outfit","crop_top_and_leggings":"Crop Top + Leggings","tank_top_and_shorts":"Tank Top + Shorts","hanbok":"Hanbok","kimono":"Kimono","qipao":"Qipao","ao_dai":"Ao Dai","swimsuit":"Standard Swimsuit","one_piece_swimsuit":"One-Piece Swimsuit","bikini":"Bikini","beach_cover_up":"Swimsuit + Beach Cover-Up","cocktail_dress":"Cocktail Dress","evening_gown":"Evening Gown","mini_skirt_and_blouse":"Blouse + Mini Skirt (Adult)","crop_top_and_jeans":"Crop Top + Jeans (Adult)","camisole_and_shorts":"Camisole + Shorts (Adult)","bodycon_dress":"Bodycon Dress (Adult)","off_shoulder_dress":"Off-Shoulder Dress (Adult)","halter_neck_dress":"Halter-Neck Dress (Adult)","slip_dress":"Slip Dress (Adult)","lingerie_set":"Lingerie Set (Adults Only)","bra_and_panties":"Bra + Panties (Adults Only)","sheer_lingerie":"Sheer Lingerie (Adults Only)","open_robe_lingerie":"Open Robe + Lingerie (Adults Only)","micro_bikini":"Micro Bikini (Adults Only)","bodystocking":"Bodystocking (Adults Only)","thong_only":"Thong Only (Adults Only)","topless_with_bottoms":"Topless with Bottoms (Adults Only)","loose_apron_only":"Loose Apron Only (Adults Only)","nude":"Nude (Adults Only)"},"person_c_appearance_preset":{"none":"Unspecified","average_build":"Average Build","slim_build":"Slim Build","petite_build":"Petite Build","diminutive_build":"Slight Build","athletic_build":"Athletic Build","lean_muscular_build":"Lean Toned Build","muscular_build":"Muscular Build","solid_build":"Sturdy Build","curvy_build":"Curvy Build","hourglass_figure":"Hourglass Figure","full_figure":"Full-Figured Build","tall_slim_build":"Tall Slim Build","tall_build":"Tall Build","short_stature":"Short Stature","long_legs":"Long Legs","broad_shoulders":"Broad Shoulders","full_bust":"Full Bust (Adults Only)","small_bust":"Small Bust (Adults Only)","soft_round_features":"Soft Rounded Features","defined_jawline":"Defined Jawline","freckles":"Light Freckles","light_stubble":"Light Stubble","full_beard":"Full Beard","long_black_hair":"Long Black Hair","long_brown_hair":"Long Brown Hair","shoulder_length_hair":"Shoulder-Length Hair","straight_hair":"Straight Hair","wavy_hair":"Wavy Hair","curly_hair":"Curly Hair","short_hair":"Short Hair","short_bob":"Short Bob","pixie_cut":"Pixie Cut","buzz_cut":"Buzz Cut","ponytail":"Ponytail","braided_hair":"Braided Hair"},"person_c_clothing_preset":{"none":"Unspecified","tailored_suit":"Tailored Suit","business_casual":"Business Casual","shirt_and_slacks":"Shirt + Slacks","blouse_and_pencil_skirt":"Blouse + Pencil Skirt","coat_and_skirt":"Coat + Skirt","tshirt_and_jeans":"T-Shirt + Jeans","blouse_and_jeans":"Blouse + Jeans","cardigan_and_skirt":"Cardigan + Skirt","knit_sweater_and_skirt":"Knit Sweater + Skirt","turtleneck_and_slacks":"Turtleneck + Slacks","oversized_sweater":"Oversized Sweater","casual_jeans":"Casual Jeans","denim_jacket":"Denim Jacket","leather_jacket":"Leather Jacket","trench_coat":"Trench Coat","hoodie_and_joggers":"Hoodie + Joggers","streetwear":"Contemporary Streetwear","dress":"Simple Dress","sundress":"Sundress","work_apron":"Work Apron","chef_uniform":"Chef's Uniform","work_overalls":"Work Overalls","mechanic_coveralls":"Mechanic Coveralls","medical_scrubs":"Medical Scrubs","lab_coat":"Lab Coat","raincoat":"Raincoat","puffer_jacket":"Puffer Jacket","pajamas":"Pajamas","school_uniform":"School Uniform","sportswear":"General Sportswear / Jogging Clothes","yoga_outfit":"Yoga Outfit","tennis_outfit":"Tennis Outfit","cycling_outfit":"Cycling Outfit","crop_top_and_leggings":"Crop Top + Leggings","tank_top_and_shorts":"Tank Top + Shorts","hanbok":"Hanbok","kimono":"Kimono","qipao":"Qipao","ao_dai":"Ao Dai","swimsuit":"Standard Swimsuit","one_piece_swimsuit":"One-Piece Swimsuit","bikini":"Bikini","beach_cover_up":"Swimsuit + Beach Cover-Up","cocktail_dress":"Cocktail Dress","evening_gown":"Evening Gown","mini_skirt_and_blouse":"Blouse + Mini Skirt (Adult)","crop_top_and_jeans":"Crop Top + Jeans (Adult)","camisole_and_shorts":"Camisole + Shorts (Adult)","bodycon_dress":"Bodycon Dress (Adult)","off_shoulder_dress":"Off-Shoulder Dress (Adult)","halter_neck_dress":"Halter-Neck Dress (Adult)","slip_dress":"Slip Dress (Adult)","lingerie_set":"Lingerie Set (Adults Only)","bra_and_panties":"Bra + Panties (Adults Only)","sheer_lingerie":"Sheer Lingerie (Adults Only)","open_robe_lingerie":"Open Robe + Lingerie (Adults Only)","micro_bikini":"Micro Bikini (Adults Only)","bodystocking":"Bodystocking (Adults Only)","thong_only":"Thong Only (Adults Only)","topless_with_bottoms":"Topless with Bottoms (Adults Only)","loose_apron_only":"Loose Apron Only (Adults Only)","nude":"Nude (Adults Only)"},"camera_shot_1_framing":{"auto":"Auto · Scene-Appropriate","face_closeup":"Face Close-Up","head_and_shoulders":"Face + Shoulders","upper_body":"Upper Body","waist_up":"Waist Up","knee_up":"Knee Up","full_body":"Full Body","wide_scene":"Wide Establishing View"},"camera_shot_2_framing":{"auto":"Auto · Scene-Appropriate","face_closeup":"Face Close-Up","head_and_shoulders":"Face + Shoulders","upper_body":"Upper Body","waist_up":"Waist Up","knee_up":"Knee Up","full_body":"Full Body","wide_scene":"Wide Establishing View"},"camera_shot_3_framing":{"auto":"Auto · Scene-Appropriate","face_closeup":"Face Close-Up","head_and_shoulders":"Face + Shoulders","upper_body":"Upper Body","waist_up":"Waist Up","knee_up":"Knee Up","full_body":"Full Body","wide_scene":"Wide Establishing View"},"camera_shot_4_framing":{"auto":"Auto · Scene-Appropriate","face_closeup":"Face Close-Up","head_and_shoulders":"Face + Shoulders","upper_body":"Upper Body","waist_up":"Waist Up","knee_up":"Knee Up","full_body":"Full Body","wide_scene":"Wide Establishing View"}},"ko":{"scene_translate":{"off":"사용 안 함 · 입력 그대로","ko_to_en":"자동 · 한국어→영어 / 영어는 그대로"},"visual_style":{"auto":"스타일 추가 없음 / 참조 이미지 스타일 유지","cinematic":"영화풍","family_film":"따뜻한 가족 영화풍","warm_cinematic":"따뜻한 영화풍","natural":"자연스러운 실사풍","live_action":"실사","live_action_cinematic":"실사 영화풍","2d_animated":"2D 애니메이션","japanese_anime":"일본 애니메이션풍","3d_cg":"3D CG","claymation":"점토 스톱모션","watercolor":"수채화풍","vintage_film":"빈티지 필름풍","monochrome_cinematic":"흑백 영화풍","film_noir":"흑백 누아르 영화풍","dark_fantasy":"어두운 판타지풍","cinematic_horror":"공포 영화풍","ominous_dark":"불길하고 어두운 분위기","post_apocalyptic":"문명 붕괴 이후 세계풍","gothic":"어두운 고딕풍","cyberpunk":"네온 미래 도시풍 (사이버펑크)","dreamlike":"몽환적 영상풍"},"camera_motion":{"auto":"카메라 지시 없음","static":"카메라 고정","zoom_in":"화면 확대 (줌 인)","zoom_out":"화면 축소 (줌 아웃)","push_in":"카메라 앞으로 이동","pull_out":"카메라 뒤로 이동","pan_left":"카메라 시선 왼쪽 회전","pan_right":"카메라 시선 오른쪽 회전","truck_left":"카메라 왼쪽 평행 이동","truck_right":"카메라 오른쪽 평행 이동","tilt_up":"카메라 시선 위로 이동","tilt_down":"카메라 시선 아래로 이동","pedestal_up":"카메라 수직 상승","pedestal_down":"카메라 수직 하강","arc_shot":"피사체 주위 원호 이동","tracking_shot":"피사체 따라가기","handheld_tracking":"핸드헬드 추적 촬영","shake_slightly":"약한 카메라 흔들림","shake_strongly":"강한 카메라 흔들림","pov":"1인칭 시점","roll_clockwise":"화면 시계방향 회전","roll_counterclockwise":"화면 반시계방향 회전"},"camera_amplitude":{"default":"기본 · 생략","small":"작게","large":"크게"},"camera_speed":{"default":"기본 · 생략","slow":"느리게","fast":"빠르게"},"camera_shot_1_target":{"current_action":"현재 진행에 맞춤","A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3","scene":"전체 장면"},"camera_shot_2_transition":{"cut":"일반 컷","cross_dissolve":"겹침 전환 (크로스 디졸브)","fade":"페이드 전환","wipe":"밀어내기 전환 (와이프)"},"camera_shot_2_target":{"current_action":"현재 진행에 맞춤","A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3","scene":"전체 장면"},"camera_shot_2_motion":{"auto":"카메라 지시 없음","static":"카메라 고정","zoom_in":"화면 확대 (줌 인)","zoom_out":"화면 축소 (줌 아웃)","push_in":"카메라 앞으로 이동","pull_out":"카메라 뒤로 이동","pan_left":"카메라 시선 왼쪽 회전","pan_right":"카메라 시선 오른쪽 회전","truck_left":"카메라 왼쪽 평행 이동","truck_right":"카메라 오른쪽 평행 이동","tilt_up":"카메라 시선 위로 이동","tilt_down":"카메라 시선 아래로 이동","pedestal_up":"카메라 수직 상승","pedestal_down":"카메라 수직 하강","arc_shot":"피사체 주위 원호 이동","tracking_shot":"피사체 따라가기","handheld_tracking":"핸드헬드 추적 촬영","shake_slightly":"약한 카메라 흔들림","shake_strongly":"강한 카메라 흔들림","pov":"1인칭 시점","roll_clockwise":"화면 시계방향 회전","roll_counterclockwise":"화면 반시계방향 회전"},"camera_shot_3_transition":{"cut":"일반 컷","cross_dissolve":"겹침 전환 (크로스 디졸브)","fade":"페이드 전환","wipe":"밀어내기 전환 (와이프)"},"camera_shot_3_target":{"current_action":"현재 진행에 맞춤","A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3","scene":"전체 장면"},"camera_shot_3_motion":{"auto":"카메라 지시 없음","static":"카메라 고정","zoom_in":"화면 확대 (줌 인)","zoom_out":"화면 축소 (줌 아웃)","push_in":"카메라 앞으로 이동","pull_out":"카메라 뒤로 이동","pan_left":"카메라 시선 왼쪽 회전","pan_right":"카메라 시선 오른쪽 회전","truck_left":"카메라 왼쪽 평행 이동","truck_right":"카메라 오른쪽 평행 이동","tilt_up":"카메라 시선 위로 이동","tilt_down":"카메라 시선 아래로 이동","pedestal_up":"카메라 수직 상승","pedestal_down":"카메라 수직 하강","arc_shot":"피사체 주위 원호 이동","tracking_shot":"피사체 따라가기","handheld_tracking":"핸드헬드 추적 촬영","shake_slightly":"약한 카메라 흔들림","shake_strongly":"강한 카메라 흔들림","pov":"1인칭 시점","roll_clockwise":"화면 시계방향 회전","roll_counterclockwise":"화면 반시계방향 회전"},"camera_shot_4_transition":{"cut":"일반 컷","cross_dissolve":"겹침 전환 (크로스 디졸브)","fade":"페이드 전환","wipe":"밀어내기 전환 (와이프)"},"camera_shot_4_target":{"current_action":"현재 진행에 맞춤","A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3","scene":"전체 장면"},"camera_shot_4_motion":{"auto":"카메라 지시 없음","static":"카메라 고정","zoom_in":"화면 확대 (줌 인)","zoom_out":"화면 축소 (줌 아웃)","push_in":"카메라 앞으로 이동","pull_out":"카메라 뒤로 이동","pan_left":"카메라 시선 왼쪽 회전","pan_right":"카메라 시선 오른쪽 회전","truck_left":"카메라 왼쪽 평행 이동","truck_right":"카메라 오른쪽 평행 이동","tilt_up":"카메라 시선 위로 이동","tilt_down":"카메라 시선 아래로 이동","pedestal_up":"카메라 수직 상승","pedestal_down":"카메라 수직 하강","arc_shot":"피사체 주위 원호 이동","tracking_shot":"피사체 따라가기","handheld_tracking":"핸드헬드 추적 촬영","shake_slightly":"약한 카메라 흔들림","shake_strongly":"강한 카메라 흔들림","pov":"1인칭 시점","roll_clockwise":"화면 시계방향 회전","roll_counterclockwise":"화면 반시계방향 회전"},"soundscape_mode":{"auto":"자동","minimal":"최소한의 환경음","custom_only":"직접 입력한 환경음만 사용 (비우면 자연음으로 보정)","silent":"환경음·동작음 없음"},"music_mode":{"none":"사용 안 함","sparse_piano_strings":"절제된 피아노 + 저음 현악","acoustic_guitar_bass":"어쿠스틱 기타 + 베이스","classical_guitar":"클래식 기타","soft_light_music":"잔잔한 경음악","gentle_classical":"잔잔한 클래식","lyrical_harp_cello":"서정적 하프 + 첼로","light_jazz":"라이트 재즈","bossa_nova":"보사노바","korean_traditional_fusion":"한국 전통 퓨전","vintage_pop":"고전·빈티지 팝","modern_pop":"모던 팝","kpop_style":"K-pop 스타일","kpop_dance":"K-pop 댄스","fast_rap_beat":"빠른 랩 비트","oldschool_hiphop":"올드스쿨 힙합","funk_groove":"펑키 그루브","rock_drive":"록 드라이브","ambient_synth":"잔잔한 신시사이저","dark_ambient":"다크 앰비언트","electronic_pulse":"반복되는 전자 리듬","upbeat_electronic":"경쾌한 일렉트로닉","minimal_luxury_electronic":"고급 미니멀 광고","tech_product_pulse":"테크 제품 광고","synthwave":"신스웨이브","dream_pop":"몽환적 드림 팝","cinematic_percussion":"시네마틱 퍼커션","orchestral_rise":"점차 고조되는 오케스트라","cheerful_march":"경쾌한 행진곡","grand_march":"장엄한 행진곡","celestial_space":"천공·우주 음악","mystic_fantasy":"신비로운 판타지","custom":"직접 입력한 음악 사용 (비우면 음악 없음으로 보정)"},"person_a_gender":{"unspecified":"지정 안 함","female":"여성","male":"남성","nonbinary":"남성·여성 이외 (논바이너리)"},"person_a_age":{"unspecified":"지정 안 함","child":"어린이","teen":"청소년","twenties":"20대","thirties":"30대","forties":"40대","fifties":"50대","sixties":"60대","elderly":"노년층"},"person_b_gender":{"unspecified":"지정 안 함","female":"여성","male":"남성","nonbinary":"남성·여성 이외 (논바이너리)"},"person_b_age":{"unspecified":"지정 안 함","child":"어린이","teen":"청소년","twenties":"20대","thirties":"30대","forties":"40대","fifties":"50대","sixties":"60대","elderly":"노년층"},"person_c_gender":{"unspecified":"지정 안 함","female":"여성","male":"남성","nonbinary":"남성·여성 이외 (논바이너리)"},"person_c_age":{"unspecified":"지정 안 함","child":"어린이","teen":"청소년","twenties":"20대","thirties":"30대","forties":"40대","fifties":"50대","sixties":"60대","elderly":"노년층"},"turn_1_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_1_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_1_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"turn_2_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_2_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_2_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"turn_3_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_3_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_3_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"turn_4_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_4_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_4_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"turn_5_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_5_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_5_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"turn_6_speaker":{"A":"인물 1","B":"인물 2","C":"인물 3","A+B":"인물 1 + 2","A+C":"인물 1 + 3","B+C":"인물 2 + 3","A+B+C":"인물 1 + 2 + 3"},"turn_6_dialogue_language":{"auto":"자동 · 한국어/영어 우선 판별","English":"영어","Korean":"한국어","Japanese":"일본어","Chinese":"중국어","Spanish":"스페인어","French":"프랑스어","German":"독일어","Russian":"러시아어","Arabic":"아랍어","Italian":"이탈리아어","Portuguese":"포르투갈어"},"turn_6_dialogue_delivery":{"on_screen":"화면 속 인물이 직접 말함","voiceover":"화면 밖 음성 (보이스오버)"},"person_a_appearance_preset":{"none":"지정 안 함","average_build":"보통 체형","slim_build":"슬림한 체형","petite_build":"아담한 체형","diminutive_build":"왜소한 체형","athletic_build":"탄탄한 체형","lean_muscular_build":"마르고 탄탄한 체형","muscular_build":"근육질 체형","solid_build":"다부진 체형","curvy_build":"곡선이 도드라진 체형","hourglass_figure":"허리가 잘록한 모래시계 체형","full_figure":"풍만한 체형","tall_slim_build":"키 크고 마른 체형","tall_build":"키가 큰 체형","short_stature":"작은 키","long_legs":"긴 다리","broad_shoulders":"넓은 어깨","full_bust":"볼륨 있는 가슴 (성인 전용)","small_bust":"작은 가슴 (성인 전용)","soft_round_features":"부드럽고 둥근 얼굴선","defined_jawline":"또렷한 턱선","freckles":"옅은 주근깨","light_stubble":"옅은 수염","full_beard":"풍성한 턱수염","long_black_hair":"긴 검은 머리","long_brown_hair":"긴 갈색 머리","shoulder_length_hair":"어깨까지 오는 머리","straight_hair":"생머리","wavy_hair":"웨이브 머리","curly_hair":"곱슬머리","short_hair":"짧은 머리","short_bob":"짧은 단발","pixie_cut":"아주 짧은 머리 (픽시컷)","buzz_cut":"아주 짧게 민 머리 (버즈컷)","ponytail":"뒤로 묶은 머리 (포니테일)","braided_hair":"땋은 머리"},"person_a_clothing_preset":{"none":"지정 안 함","tailored_suit":"맞춤 정장","business_casual":"비즈니스 캐주얼 차림","shirt_and_slacks":"셔츠와 슬랙스","blouse_and_pencil_skirt":"블라우스와 펜슬 스커트","coat_and_skirt":"코트와 스커트","tshirt_and_jeans":"티셔츠와 청바지","blouse_and_jeans":"블라우스와 청바지","cardigan_and_skirt":"가디건과 스커트","knit_sweater_and_skirt":"니트 스웨터와 스커트","turtleneck_and_slacks":"터틀넥과 슬랙스","oversized_sweater":"오버사이즈 스웨터","casual_jeans":"캐주얼 청바지 차림","denim_jacket":"데님 재킷","leather_jacket":"가죽 재킷","trench_coat":"트렌치코트","hoodie_and_joggers":"후드티와 조거팬츠","streetwear":"현대적인 스트리트 패션","dress":"일반 드레스","sundress":"여름 원피스 (선드레스)","work_apron":"작업용 앞치마","chef_uniform":"셰프복","work_overalls":"멜빵 작업복","mechanic_coveralls":"정비복","medical_scrubs":"의료용 스크럽","lab_coat":"실험복","raincoat":"우비","puffer_jacket":"패딩 점퍼","pajamas":"잠옷","school_uniform":"교복","sportswear":"일반 운동복·조깅복","yoga_outfit":"요가복","tennis_outfit":"테니스복","cycling_outfit":"자전거 라이딩복","crop_top_and_leggings":"크롭탑과 레깅스","tank_top_and_shorts":"탱크톱과 반바지","hanbok":"한복","kimono":"기모노","qipao":"치파오","ao_dai":"아오자이","swimsuit":"일반 수영복","one_piece_swimsuit":"원피스 수영복","bikini":"비키니","beach_cover_up":"수영복과 비치 겉옷 (커버업)","cocktail_dress":"칵테일 드레스","evening_gown":"이브닝 가운","mini_skirt_and_blouse":"블라우스와 미니스커트 (성인 전용)","crop_top_and_jeans":"크롭탑과 청바지 (성인 전용)","camisole_and_shorts":"캐미솔과 반바지 (성인 전용)","bodycon_dress":"몸에 붙는 드레스 (바디콘·성인 전용)","off_shoulder_dress":"어깨가 드러나는 드레스 (오프숄더·성인 전용)","halter_neck_dress":"목 뒤로 연결되는 드레스 (홀터넥·성인 전용)","slip_dress":"슬립 드레스 (성인 전용)","lingerie_set":"란제리 세트 (성인 전용)","bra_and_panties":"브라와 팬티만 (성인 전용)","sheer_lingerie":"시스루 란제리 (성인 전용)","open_robe_lingerie":"오픈 가운과 란제리 (성인 전용)","micro_bikini":"마이크로 비키니 (성인 전용)","bodystocking":"보디스타킹 (성인 전용)","thong_only":"티팬티만 (성인 전용)","topless_with_bottoms":"하의만 착용한 상반신 노출 (성인 전용)","loose_apron_only":"헐렁한 앞치마만 (성인 전용)","nude":"누드 (성인 전용)"},"person_b_appearance_preset":{"none":"지정 안 함","average_build":"보통 체형","slim_build":"슬림한 체형","petite_build":"아담한 체형","diminutive_build":"왜소한 체형","athletic_build":"탄탄한 체형","lean_muscular_build":"마르고 탄탄한 체형","muscular_build":"근육질 체형","solid_build":"다부진 체형","curvy_build":"곡선이 도드라진 체형","hourglass_figure":"허리가 잘록한 모래시계 체형","full_figure":"풍만한 체형","tall_slim_build":"키 크고 마른 체형","tall_build":"키가 큰 체형","short_stature":"작은 키","long_legs":"긴 다리","broad_shoulders":"넓은 어깨","full_bust":"볼륨 있는 가슴 (성인 전용)","small_bust":"작은 가슴 (성인 전용)","soft_round_features":"부드럽고 둥근 얼굴선","defined_jawline":"또렷한 턱선","freckles":"옅은 주근깨","light_stubble":"옅은 수염","full_beard":"풍성한 턱수염","long_black_hair":"긴 검은 머리","long_brown_hair":"긴 갈색 머리","shoulder_length_hair":"어깨까지 오는 머리","straight_hair":"생머리","wavy_hair":"웨이브 머리","curly_hair":"곱슬머리","short_hair":"짧은 머리","short_bob":"짧은 단발","pixie_cut":"아주 짧은 머리 (픽시컷)","buzz_cut":"아주 짧게 민 머리 (버즈컷)","ponytail":"뒤로 묶은 머리 (포니테일)","braided_hair":"땋은 머리"},"person_b_clothing_preset":{"none":"지정 안 함","tailored_suit":"맞춤 정장","business_casual":"비즈니스 캐주얼 차림","shirt_and_slacks":"셔츠와 슬랙스","blouse_and_pencil_skirt":"블라우스와 펜슬 스커트","coat_and_skirt":"코트와 스커트","tshirt_and_jeans":"티셔츠와 청바지","blouse_and_jeans":"블라우스와 청바지","cardigan_and_skirt":"가디건과 스커트","knit_sweater_and_skirt":"니트 스웨터와 스커트","turtleneck_and_slacks":"터틀넥과 슬랙스","oversized_sweater":"오버사이즈 스웨터","casual_jeans":"캐주얼 청바지 차림","denim_jacket":"데님 재킷","leather_jacket":"가죽 재킷","trench_coat":"트렌치코트","hoodie_and_joggers":"후드티와 조거팬츠","streetwear":"현대적인 스트리트 패션","dress":"일반 드레스","sundress":"여름 원피스 (선드레스)","work_apron":"작업용 앞치마","chef_uniform":"셰프복","work_overalls":"멜빵 작업복","mechanic_coveralls":"정비복","medical_scrubs":"의료용 스크럽","lab_coat":"실험복","raincoat":"우비","puffer_jacket":"패딩 점퍼","pajamas":"잠옷","school_uniform":"교복","sportswear":"일반 운동복·조깅복","yoga_outfit":"요가복","tennis_outfit":"테니스복","cycling_outfit":"자전거 라이딩복","crop_top_and_leggings":"크롭탑과 레깅스","tank_top_and_shorts":"탱크톱과 반바지","hanbok":"한복","kimono":"기모노","qipao":"치파오","ao_dai":"아오자이","swimsuit":"일반 수영복","one_piece_swimsuit":"원피스 수영복","bikini":"비키니","beach_cover_up":"수영복과 비치 겉옷 (커버업)","cocktail_dress":"칵테일 드레스","evening_gown":"이브닝 가운","mini_skirt_and_blouse":"블라우스와 미니스커트 (성인 전용)","crop_top_and_jeans":"크롭탑과 청바지 (성인 전용)","camisole_and_shorts":"캐미솔과 반바지 (성인 전용)","bodycon_dress":"몸에 붙는 드레스 (바디콘·성인 전용)","off_shoulder_dress":"어깨가 드러나는 드레스 (오프숄더·성인 전용)","halter_neck_dress":"목 뒤로 연결되는 드레스 (홀터넥·성인 전용)","slip_dress":"슬립 드레스 (성인 전용)","lingerie_set":"란제리 세트 (성인 전용)","bra_and_panties":"브라와 팬티만 (성인 전용)","sheer_lingerie":"시스루 란제리 (성인 전용)","open_robe_lingerie":"오픈 가운과 란제리 (성인 전용)","micro_bikini":"마이크로 비키니 (성인 전용)","bodystocking":"보디스타킹 (성인 전용)","thong_only":"티팬티만 (성인 전용)","topless_with_bottoms":"하의만 착용한 상반신 노출 (성인 전용)","loose_apron_only":"헐렁한 앞치마만 (성인 전용)","nude":"누드 (성인 전용)"},"person_c_appearance_preset":{"none":"지정 안 함","average_build":"보통 체형","slim_build":"슬림한 체형","petite_build":"아담한 체형","diminutive_build":"왜소한 체형","athletic_build":"탄탄한 체형","lean_muscular_build":"마르고 탄탄한 체형","muscular_build":"근육질 체형","solid_build":"다부진 체형","curvy_build":"곡선이 도드라진 체형","hourglass_figure":"허리가 잘록한 모래시계 체형","full_figure":"풍만한 체형","tall_slim_build":"키 크고 마른 체형","tall_build":"키가 큰 체형","short_stature":"작은 키","long_legs":"긴 다리","broad_shoulders":"넓은 어깨","full_bust":"볼륨 있는 가슴 (성인 전용)","small_bust":"작은 가슴 (성인 전용)","soft_round_features":"부드럽고 둥근 얼굴선","defined_jawline":"또렷한 턱선","freckles":"옅은 주근깨","light_stubble":"옅은 수염","full_beard":"풍성한 턱수염","long_black_hair":"긴 검은 머리","long_brown_hair":"긴 갈색 머리","shoulder_length_hair":"어깨까지 오는 머리","straight_hair":"생머리","wavy_hair":"웨이브 머리","curly_hair":"곱슬머리","short_hair":"짧은 머리","short_bob":"짧은 단발","pixie_cut":"아주 짧은 머리 (픽시컷)","buzz_cut":"아주 짧게 민 머리 (버즈컷)","ponytail":"뒤로 묶은 머리 (포니테일)","braided_hair":"땋은 머리"},"person_c_clothing_preset":{"none":"지정 안 함","tailored_suit":"맞춤 정장","business_casual":"비즈니스 캐주얼 차림","shirt_and_slacks":"셔츠와 슬랙스","blouse_and_pencil_skirt":"블라우스와 펜슬 스커트","coat_and_skirt":"코트와 스커트","tshirt_and_jeans":"티셔츠와 청바지","blouse_and_jeans":"블라우스와 청바지","cardigan_and_skirt":"가디건과 스커트","knit_sweater_and_skirt":"니트 스웨터와 스커트","turtleneck_and_slacks":"터틀넥과 슬랙스","oversized_sweater":"오버사이즈 스웨터","casual_jeans":"캐주얼 청바지 차림","denim_jacket":"데님 재킷","leather_jacket":"가죽 재킷","trench_coat":"트렌치코트","hoodie_and_joggers":"후드티와 조거팬츠","streetwear":"현대적인 스트리트 패션","dress":"일반 드레스","sundress":"여름 원피스 (선드레스)","work_apron":"작업용 앞치마","chef_uniform":"셰프복","work_overalls":"멜빵 작업복","mechanic_coveralls":"정비복","medical_scrubs":"의료용 스크럽","lab_coat":"실험복","raincoat":"우비","puffer_jacket":"패딩 점퍼","pajamas":"잠옷","school_uniform":"교복","sportswear":"일반 운동복·조깅복","yoga_outfit":"요가복","tennis_outfit":"테니스복","cycling_outfit":"자전거 라이딩복","crop_top_and_leggings":"크롭탑과 레깅스","tank_top_and_shorts":"탱크톱과 반바지","hanbok":"한복","kimono":"기모노","qipao":"치파오","ao_dai":"아오자이","swimsuit":"일반 수영복","one_piece_swimsuit":"원피스 수영복","bikini":"비키니","beach_cover_up":"수영복과 비치 겉옷 (커버업)","cocktail_dress":"칵테일 드레스","evening_gown":"이브닝 가운","mini_skirt_and_blouse":"블라우스와 미니스커트 (성인 전용)","crop_top_and_jeans":"크롭탑과 청바지 (성인 전용)","camisole_and_shorts":"캐미솔과 반바지 (성인 전용)","bodycon_dress":"몸에 붙는 드레스 (바디콘·성인 전용)","off_shoulder_dress":"어깨가 드러나는 드레스 (오프숄더·성인 전용)","halter_neck_dress":"목 뒤로 연결되는 드레스 (홀터넥·성인 전용)","slip_dress":"슬립 드레스 (성인 전용)","lingerie_set":"란제리 세트 (성인 전용)","bra_and_panties":"브라와 팬티만 (성인 전용)","sheer_lingerie":"시스루 란제리 (성인 전용)","open_robe_lingerie":"오픈 가운과 란제리 (성인 전용)","micro_bikini":"마이크로 비키니 (성인 전용)","bodystocking":"보디스타킹 (성인 전용)","thong_only":"티팬티만 (성인 전용)","topless_with_bottoms":"하의만 착용한 상반신 노출 (성인 전용)","loose_apron_only":"헐렁한 앞치마만 (성인 전용)","nude":"누드 (성인 전용)"},"camera_shot_1_framing":{"auto":"자동 · 장면에 맞춤","face_closeup":"얼굴 클로즈업","head_and_shoulders":"얼굴·어깨 중심","upper_body":"상반신","waist_up":"허리 위","knee_up":"무릎 위","full_body":"전신","wide_scene":"넓은 전경"},"camera_shot_2_framing":{"auto":"자동 · 장면에 맞춤","face_closeup":"얼굴 클로즈업","head_and_shoulders":"얼굴·어깨 중심","upper_body":"상반신","waist_up":"허리 위","knee_up":"무릎 위","full_body":"전신","wide_scene":"넓은 전경"},"camera_shot_3_framing":{"auto":"자동 · 장면에 맞춤","face_closeup":"얼굴 클로즈업","head_and_shoulders":"얼굴·어깨 중심","upper_body":"상반신","waist_up":"허리 위","knee_up":"무릎 위","full_body":"전신","wide_scene":"넓은 전경"},"camera_shot_4_framing":{"auto":"자동 · 장면에 맞춤","face_closeup":"얼굴 클로즈업","head_and_shoulders":"얼굴·어깨 중심","upper_body":"상반신","waist_up":"허리 위","knee_up":"무릎 위","full_body":"전신","wide_scene":"넓은 전경"}}};
for (let index = 1; index <= 6; index++) {
  const key = `turn_${index}_speaker`;
  CORE_OPTION_LABELS.en[key] = { ...(CORE_OPTION_LABELS.en[key] || {}), Narrator: "Narrator" };
  CORE_OPTION_LABELS.ko[key] = { ...(CORE_OPTION_LABELS.ko[key] || {}), Narrator: "내레이터" };
}

for (const locale of ["en", "ko"]) {
  const table = CORE_OPTION_LABELS[locale];
  if (!table) continue;
  const targetLabels = table.camera_shot_4_target || table.camera_shot_3_target || table.camera_shot_2_target || table.camera_shot_1_target;
  const framingLabels = table.camera_shot_4_framing || table.camera_shot_3_framing || table.camera_shot_2_framing || table.camera_shot_1_framing;
  const motionLabels = table.camera_shot_4_motion || table.camera_shot_3_motion || table.camera_shot_2_motion || table.camera_motion;
  const transitionLabels = table.camera_shot_4_transition || table.camera_shot_3_transition || table.camera_shot_2_transition;
  const amplitudeLabels = { inherit: locale === "ko" ? "기본 설정을 따라감" : "Follow Base Settings", ...(table.camera_amplitude || {}) };
  const speedLabels = { inherit: locale === "ko" ? "기본 설정을 따라감" : "Follow Base Settings", ...(table.camera_speed || {}) };
  for (let shot = 2; shot <= MAX_CAMERA_SHOTS; shot++) {
    table[`camera_shot_${shot}_amplitude`] = amplitudeLabels;
    table[`camera_shot_${shot}_speed`] = speedLabels;
  }
  for (let shot = 5; shot <= MAX_CAMERA_SHOTS; shot++) {
    if (targetLabels) table[`camera_shot_${shot}_target`] = targetLabels;
    if (framingLabels) table[`camera_shot_${shot}_framing`] = framingLabels;
    if (motionLabels) table[`camera_shot_${shot}_motion`] = motionLabels;
    if (transitionLabels) table[`camera_shot_${shot}_transition`] = transitionLabels;
  }
}

const LOCALIZED_CORE_WIDGETS = new WeakSet();

function normalizeLocale(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (text === "ko" || text.startsWith("ko-") || text.includes("korean") || text.includes("한국")) return "ko";
  if (text === "en" || text.startsWith("en-") || text.includes("english") || text.includes("영어")) return "en";
  return null;
}

const LAST_CONFIRMED_LOCALE = new WeakMap();

function activeLocale(node) {
  const getters = [
    () => app?.extensionManager?.setting?.get?.("Comfy.Locale.Language"),
    () => app?.ui?.settings?.getSettingValue?.("Comfy.Locale.Language"),
    () => app?.extensionManager?.setting?.get?.("Comfy.Locale"),
    () => app?.ui?.settings?.getSettingValue?.("Comfy.Locale"),
  ];
  for (const get of getters) {
    try {
      const value = normalizeLocale(get());
      if (value) { if (node) LAST_CONFIRMED_LOCALE.set(node, value); return value; }
    } catch (_) {}
  }
  for (const widget of node?.widgets || []) {
    if (/[가-힣]/.test(String(widget?.label ?? widget?.name ?? ""))) { if (node) LAST_CONFIRMED_LOCALE.set(node, "ko"); return "ko"; }
  }
  return (node && LAST_CONFIRMED_LOCALE.get(node)) || "en";
}

const SCENE_PROMPT_HELP = Object.freeze({
  ko: {
    tooltip: "영상 전체에 공통인 장소·분위기·조명·초기 배치를 적습니다. R2V에서는 이 항목이 비어 있어도 Picture/Video가 포함된 유효한 Reference 구성 또는 활성 시간순 진행의 행동·대사가 있으면 정상 진행합니다. Picture/Video 없이 Audio만 연결한 Ref2VA는 허용하지 않습니다. 공백·스페이스·줄바꿈만 있는 값은 내용으로 인정하지 않습니다.",
    placeholder: "영상의 장면과 원하는 연출을 입력하세요",
  },
  en: {
    tooltip: "Describe the shared scene/background, mood, lighting, and initial arrangement. In R2V this field may be empty when a valid Picture/Video-backed Reference set or active Ordered Step action/dialogue provides generation content. Standalone Audio without Picture/Video is not a valid Ref2VA task. Spaces and line breaks alone count as empty.",
    placeholder: "Describe the video scene and desired direction",
  },
});

function scenePromptHelp(node) {
  return SCENE_PROMPT_HELP[activeLocale(node)] ?? SCENE_PROMPT_HELP.en;
}

function suppressScenePromptSchemaTooltip(nodeData) {
  if (!nodeData || nodeData.name !== NODE_CLASS) return;
  const spec = nodeData?.input?.required?.scene_prompt;
  if (!Array.isArray(spec) || !spec[1] || typeof spec[1] !== "object") return;
  // Keep runtime/Ultra overlay help, but remove the schema tooltip source used
  // by ComfyUI's native tooltip layer.
  spec[1].tooltip = "";
}

function installScenePromptHelp(node) {
  const widget = widgetByName(node, "scene_prompt");
  if (!widget) return;
  const help = scenePromptHelp(node);
  widget.options ??= {};
  widget.options.placeholder = help.placeholder;
  widget.options.tooltip = help.tooltip;
  widget.tooltip = help.tooltip;

  const applyDomHelp = () => {
    const textarea = widget?.element?.querySelector?.("textarea") || widget?.element;
    if (!textarea) return false;
    try { textarea.placeholder = help.placeholder; } catch (_) {}
    try { textarea.setAttribute?.("title", help.tooltip); } catch (_) {}
    return true;
  };

  if (!applyDomHelp()) {
    nextFrame(() => {
      if (!applyDomHelp()) nextFrame(applyDomHelp);
    });
  }
}

function canonicalCoreOptionValue(widgetName, value) {
  const raw = String(value ?? "");
  const maps = [CORE_OPTION_LABELS.en?.[widgetName], CORE_OPTION_LABELS.ko?.[widgetName]];
  for (const map of maps) {
    if (map && Object.prototype.hasOwnProperty.call(map, raw)) return raw;
  }
  for (const map of maps) {
    if (!map) continue;
    for (const [canonical, display] of Object.entries(map)) {
      if (String(display) === raw) return canonical;
    }
  }
  return raw;
}

function coreOptionLabel(node, widgetName, value) {
  const canonical = canonicalCoreOptionValue(widgetName, value);
  const locale = activeLocale(node);
  return CORE_OPTION_LABELS[locale]?.[widgetName]?.[canonical]
    ?? CORE_OPTION_LABELS.en?.[widgetName]?.[canonical]
    ?? canonical;
}

function refreshCameraFramingLabels(node) {
  const locale = activeLocale(node);
  const cameraEnabled = Boolean(widgetByName(node, "camera_sequence_enabled")?.value ?? false);
  const labels = locale === "ko"
    ? { generic: "촬영 컷 구도", shot1: "촬영 컷 1 구도" }
    : { generic: "Shot Framing", shot1: "Shot 1 Framing" };
  const widget = widgetByName(node, "camera_shot_1_framing");
  if (!widget) return;
  widget.label = cameraEnabled ? labels.shot1 : labels.generic;
}

function installLocalizedComboDisplay(node) {
  for (const widget of node?.widgets || []) {
    if (!CORE_OPTION_LABELS.en?.[widget?.name] && !CORE_OPTION_LABELS.ko?.[widget?.name]) continue;
    widget.options ??= {};
    const canonical = canonicalCoreOptionValue(widget.name, widget.value);
    if (canonical !== String(widget.value ?? "")) widget.value = canonical;
    if (!LOCALIZED_CORE_WIDGETS.has(widget)) {
      widget.options.getOptionLabel = (value) => coreOptionLabel(node, widget.name, value);
      LOCALIZED_CORE_WIDGETS.add(widget);
    }
  }
}

function readPersistedMap(node, key) {
  const raw = node?.properties?.[PREFERENCE_PROPERTY]?.[key];
  const out = new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, value] of Object.entries(raw)) {
    if (value == null) continue;
    out.set(String(name), String(value));
  }
  return out;
}

function persistPreferences(node, state) {
  if (!node || !state) return;
  node.properties ??= {};
  node.properties[PREFERENCE_PROPERTY] = {
    turnSpeakers: Object.fromEntries([...state.preferredTurnSpeakers.entries()]),
    cameraTargets: Object.fromEntries([...state.preferredCameraTargets.entries()]),
    profilePresets: Object.fromEntries([...state.preferredProfilePresets.entries()]),
  };
}

function nodeState(node) {
  let state = NODE_STATES.get(node);
  if (!state) {
    state = {
      resizeToken: 0,
      pendingSceneHeight: null,
      lastSceneHeight: null,
      sceneConnectionToken: 0,
      layoutRevision: 0,
      lastDynamicCounts: null,
      suppressConnectionUiSync: 0,
      referenceNormalizeTimer: null,
      referenceNormalizePending: false,
      coreVisibilitySyncPending: false,
      coreVisibilityRefreshReferenceSemantics: false,
      resetConfirmUntil: 0,
      resetConfirmTimer: null,
      preferredTurnSpeakers: readPersistedMap(node, "turnSpeakers"),
      preferredCameraTargets: readPersistedMap(node, "cameraTargets"),
      preferredProfilePresets: readPersistedMap(node, "profilePresets"),
      autoFallbackTurnSpeakers: new Set(),
      programmaticTurnSpeakerWrites: new Set(),
      autoFallbackCameraTargets: new Set(),
      programmaticCameraTargetWrites: new Set(),
      autoFallbackProfilePresets: new Set(),
      programmaticProfilePresetWrites: new Set(),
      referenceSemanticWriteDepth: 0,
    };
    NODE_STATES.set(node, state);
  }
  return state;
}

function discardNodeState(node) {
  const state = NODE_STATES.get(node);
  if (state) {
    state.resizeToken = (state.resizeToken ?? 0) + 1;
    state.pendingSceneHeight = null;
    if (state.resetConfirmTimer != null) clearTimeout(state.resetConfirmTimer);
    if (state.referenceNormalizeTimer != null) clearTimeout(state.referenceNormalizeTimer);
    state.referenceNormalizeTimer = null;
    state.referenceNormalizePending = false;
    state.coreVisibilitySyncPending = false;
    state.coreVisibilityRefreshReferenceSemantics = false;
  }
  NODE_STATES.delete(node);
}

function cloneResetValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function beginResetGraphChange(node) {
  const graph = node?.graph;
  if (!graph || typeof graph.beforeChange !== "function" || typeof graph.afterChange !== "function") return null;
  try {
    graph.beforeChange(node);
    return graph;
  } catch (_) {
    return null;
  }
}

function finishResetGraphChange(graph, node) {
  if (!graph) return;
  try { graph.afterChange(node); } catch (_) {}
  try { graph.setDirtyCanvas?.(true, true); } catch (_) {}
}

function widgetByName(node, name) {
  return (node.widgets || []).find((widget) => widget?.name === name);
}

// -----------------------------------------------------------------------------
// Input-content helpers
// -----------------------------------------------------------------------------
// Whitespace-only text is empty. Hard blocking uses ComfyUI native validation.
// No custom border/DOM styling is installed here.
function requiredInputIsBlank(widget) {
  return !String(widget?.value ?? "").trim();
}

function setWidgetVisible(widget, visible) {
  if (!widget) return false;
  const effectiveVisible = groupedWidgetVisible(widget?.__ultraGroupedNode || null, widget, visible);
  const hidden = !effectiveVisible;
  const previousOptions = widget.options && typeof widget.options === "object" ? widget.options : {};
  const changed = widget.hidden !== hidden || previousOptions.hidden !== hidden;
  if (widget.hidden !== hidden) widget.hidden = hidden;
  // [Regression guard: ghost socket] Hidden widget-backed inputs must not keep
  // their previous runtime Y hit-target. If a ghost socket returns, verify this
  // y=0 + hidden/options.hidden path before changing physical input topology.
  // Vue/LiteGraph assigns a fresh layout position when the widget is visible again.
  if (hidden && typeof widget.y === "number" && widget.y !== 0 && !widget?.[SEQUENTIAL_VOCAL_WIDGET_MARKER]) widget.y = 0;
  if (changed) widget.options = { ...previousOptions, hidden };
  return changed;
}

function refreshVueWidgetMetadata(node) {
  // Normal creation has already produced concrete widgets. Do not replace the
  // full array merely to expose hidden/label changes: frontend 1.53 treats that
  // as a complete widget-order registration and stalls large H3 nodes.
  try { node._widgetSlotsDirty = true; } catch (_) {}
  try { node.setDirtyCanvas?.(true, true); } catch (_) {}
}

function withBatchedWidgetMutations(node, callback) {
  if (!node || typeof callback !== "function") return callback?.();
  const ownDescriptor = Object.getOwnPropertyDescriptor(node, "widgets");
  let descriptor = ownDescriptor;
  let owner = node;
  while (!descriptor && (owner = Object.getPrototypeOf(owner))) {
    descriptor = Object.getOwnPropertyDescriptor(owner, "widgets");
  }
  if (!descriptor?.get || !descriptor?.set || descriptor.configurable !== true) return callback();
  const initial = Array.isArray(node.widgets) ? [...node.widgets] : [];
  const working = [...initial];
  Object.defineProperty(node, "widgets", {
    value: working,
    writable: true,
    configurable: true,
    enumerable: descriptor.enumerable !== false,
  });
  try {
    return callback();
  } finally {
    const finalWidgets = Array.isArray(node.widgets) ? node.widgets : [];
    if (ownDescriptor) Object.defineProperty(node, "widgets", ownDescriptor);
    else delete node.widgets;
    const unchanged = finalWidgets.length === initial.length
      && finalWidgets.every((widget, index) => widget === initial[index]);
    if (!unchanged) node.widgets = finalWidgets;
  }
}

function widgetInputIndex(node, name) {
  if (!Array.isArray(node?.inputs)) return -1;
  return node.inputs.findIndex((item) => item?.name === name || item?.widget?.name === name);
}

function widgetInputConnected(node, name) {
  const index = widgetInputIndex(node, name);
  if (index < 0) return false;
  const input = node.inputs[index];
  if (input?.link !== undefined && input.link !== null && input.link !== -1) return true;
  if (Array.isArray(input?.links) && input.links.length > 0) return true;
  return false;
}

function disconnectWidgetInput(node, name) {
  const index = widgetInputIndex(node, name);
  if (index < 0 || !widgetInputConnected(node, name)) return false;
  if (typeof node?.disconnectInput === "function") {
    try {
      return node.disconnectInput(index) !== false;
    } catch (error) {
      console.warn(`[Ultra MiniMax H3 Prompt R2V] Failed to disconnect inactive input ${name}.`, error);
      return false;
    }
  }
  return false;
}

function restoreCoreConvertedWidgetAfterReset(widget) {
  if (!widget || !String(widget.type || "").startsWith("converted-widget")) return false;
  widget.type = widget.origType;
  widget.computeSize = widget.origComputeSize;
  widget.serializeValue = widget.origSerializeValue;
  delete widget.origType;
  delete widget.origComputeSize;
  delete widget.origSerializeValue;
  if (Array.isArray(widget.linkedWidgets)) {
    for (const linked of widget.linkedWidgets) restoreCoreConvertedWidgetAfterReset(linked);
  }
  return true;
}

function convertedWidgetResetPlan(node, resetPlan) {
  const converted = [];
  const invalid = [];
  const seen = new Set();
  for (const item of resetPlan || []) {
    const widget = item?.widget;
    // Only the top-level converted widget owns an input slot. Linked widgets use
    // types such as "converted-widget:<parent>" and are restored recursively
    // with their parent, so treating them as separate slots would be incorrect.
    if (!widget || seen.has(widget) || String(widget.type || "") !== "converted-widget") continue;
    seen.add(widget);
    const name = String(widget.name || "");
    const inputIndex = (node.inputs || []).findIndex((input) => input?.widget?.name === name);
    if (!name || inputIndex < 0 || typeof node?.removeInput !== "function") {
      invalid.push(name || "<unnamed>");
      continue;
    }
    const input = node.inputs[inputIndex];
    // R2V's physical Picture/Video/Audio Reference sockets are never converted
    // core widgets and must never be removed by Settings Reset.
    if (exactGroup(input?.name || "")) {
      invalid.push(name);
      continue;
    }
    converted.push({ widget, name, input });
  }
  return { converted, invalid };
}

function restoreConvertedWidgetsAfterConfirmedReset(node, convertedPlan) {
  if (!convertedPlan?.length) return false;

  // All resettable widget links were detached before this point. Refuse to
  // change topology if a converted input somehow remained connected; this keeps
  // Reset transactional instead of silently deleting a live external link.
  for (const item of convertedPlan) {
    const index = (node.inputs || []).indexOf(item.input);
    if (index < 0) throw new Error(`Converted widget input disappeared during reset: ${item.name}`);
    if (widgetInputConnected(node, item.name)) {
      throw new Error(`Converted widget input remained connected during reset: ${item.name}`);
    }
  }

  // Remove from the end so LiteGraph slot indices cannot invalidate a later
  // removal. This mirrors ComfyUI's own widget-input conversion inverse, while
  // leaving physical Reference inputs untouched.
  const ordered = [...convertedPlan].sort((a, b) =>
    (node.inputs || []).indexOf(b.input) - (node.inputs || []).indexOf(a.input)
  );
  for (const item of ordered) {
    const index = (node.inputs || []).indexOf(item.input);
    if (index < 0) throw new Error(`Converted widget input missing during removal: ${item.name}`);
    node.removeInput(index);
    if (!restoreCoreConvertedWidgetAfterReset(item.widget)) {
      throw new Error(`Converted widget metadata could not be restored: ${item.name}`);
    }
  }
  // removeInput() owns the concrete slot/link bookkeeping.  Rebuilding private
  // slot caches or rewriting link.target_slot from an extension desynchronises
  // the store-backed frontend used by ComfyUI 0.37 / frontend 1.53.
  refreshVueWidgetMetadata(node);
  return true;
}

function activeCameraShotCount(node) {
  if (!Boolean(widgetByName(node, "camera_sequence_enabled")?.value)) return 1;
  let count = 1;
  for (let shot = 2; shot <= MAX_CAMERA_SHOTS; shot++) {
    const enabled = Boolean(widgetByName(node, `camera_shot_${shot}_enabled`)?.value ?? (shot === 2));
    if (!enabled) break;
    count = shot;
  }
  const countWidget = widgetByName(node, "camera_shot_count");
  if (countWidget && Number(countWidget.value) !== count) countWidget.value = Math.max(2, count);
  return count;
}

function normalizeWholeSecondDuration(value, fallback = 5, maximum = 15) {
  const fallbackNumeric = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumeric)
    ? Math.max(4, Math.min(maximum, Math.round(fallbackNumeric)))
    : 5;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return safeFallback;
  return Math.max(4, Math.min(maximum, Math.round(numeric)));
}

function snapHalfSecond(value, fallback = 0.0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric * 2) / 2;
}

function cameraTimelineMaxStart(node) {
  const durationWidget = widgetByName(node, "duration_seconds");
  const safeDuration = normalizeWholeSecondDuration(durationWidget?.value, 5, 15);
  if (durationWidget && Number(durationWidget.value) !== safeDuration) durationWidget.value = safeDuration;
  return Math.max(0.5, safeDuration - 0.5);
}

function syncShotStartTimeBounds(node, { clampValues = true } = {}) {
  const maxValue = cameraTimelineMaxStart(node);
  let previousStart = 0.0;
  let changed = false;
  for (let shot = 2; shot <= MAX_CAMERA_SHOTS; shot++) {
    const enabled = Boolean(widgetByName(node, `camera_shot_${shot}_enabled`)?.value ?? (shot === 2));
    const widget = widgetByName(node, `camera_shot_${shot}_start_seconds`);
    if (!widget) continue;
    const minValue = Math.min(maxValue, Math.max(0.5, previousStart + 0.5));
    const opts = widget.options && typeof widget.options === "object" ? widget.options : {};
    if (Number(opts.min) !== minValue || Number(opts.max) !== maxValue || Number(opts.step) !== 0.5) {
      widget.options = { ...opts, min: minValue, max: maxValue, step: 0.5 };
      changed = true;
    }
    if (clampValues && enabled) {
      const raw = Number(widget.value);
      const fallback = Math.min(maxValue, Math.max(minValue, 0.5 * (shot - 1)));
      const snapped = Number.isFinite(raw) ? Math.round(raw * 2) / 2 : fallback;
      const next = Math.max(minValue, Math.min(maxValue, snapped));
      if (Math.abs(Number(widget.value) - next) > 1e-9) { widget.value = next; changed = true; }
      previousStart = next;
    }
  }
  // Keep one Vue metadata commit per visibility/layout transaction.
  // syncCoreVisibility() owns the final node.widgets refresh after all bounds
  // and visibility changes have settled.
  return changed;
}

function readDynamicCounts(node) {
  return {
    personCount: Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1))),
    turnCount: Math.max(1, Math.min(6, Number(widgetByName(node, "turn_count")?.value ?? 1))),
    cameraEnabled: Boolean(widgetByName(node, "camera_sequence_enabled")?.value),
    cameraShotCount: activeCameraShotCount(node),
  };
}

function detachResettableWidgetLinksForConfirmedReset(node) {
  const captured = {};
  const state = nodeState(node);
  const names = [];
  const seen = new Set();
  for (const input of Array.isArray(node?.inputs) ? node.inputs : []) {
    const name = input?.widget?.name;
    if (!name || seen.has(name) || !widgetInputConnected(node, name)) continue;
    seen.add(name);
    names.push(name);
  }
  state.suppressConnectionUiSync = (state.suppressConnectionUiSync ?? 0) + 1;
  try {
    for (const name of names) {
      if (!rememberDynamicInputConnection(node, name, captured)) continue;
      if (!disconnectWidgetInput(node, name)) delete captured[name];
    }
  } finally {
    state.suppressConnectionUiSync = Math.max(0, (state.suppressConnectionUiSync ?? 1) - 1);
  }
  return captured;
}

function restoreResettableWidgetLinksAfterFailedReset(node, captured) {
  if (!captured || !Object.keys(captured).length) return false;
  const memory = { ...captured };
  const state = nodeState(node);
  let restored = false;
  state.suppressConnectionUiSync = (state.suppressConnectionUiSync ?? 0) + 1;
  try {
    for (const name of Object.keys(memory)) {
      restored = restoreRememberedDynamicInput(node, name, memory) || restored;
    }
  } finally {
    state.suppressConnectionUiSync = Math.max(0, (state.suppressConnectionUiSync ?? 1) - 1);
  }
  return restored;
}

function hardActiveDynamicInputs(counts) {
  const active = new Set();
  for (let personIndex = 1; personIndex <= counts.personCount; personIndex++) {
    for (const name of PROFILE_FIELDS[personIndex] || []) active.add(name);
  }
  for (let turnIndex = 1; turnIndex <= counts.turnCount; turnIndex++) {
    for (const field of TURN_FIELDS) active.add(`turn_${turnIndex}_${field}`);
  }
  active.add("camera_sequence_enabled");
  active.add("camera_shot_1_target");
  active.add("camera_shot_1_framing");
  if (counts.cameraEnabled) {
    for (let shotIndex = 2; shotIndex <= MAX_CAMERA_SHOTS; shotIndex++) {
      if (shotIndex <= counts.cameraShotCount + 1) active.add(`camera_shot_${shotIndex}_enabled`);
      if (shotIndex <= counts.cameraShotCount) {
        active.add(`camera_shot_${shotIndex}_start_seconds`);
        for (const suffix of ["transition", "target", "framing", "motion", "amplitude", "speed"]) active.add(`camera_shot_${shotIndex}_${suffix}`);
      }
    }
  }
  return active;
}

function graphLinkById(graph, linkId) {
  if (linkId == null || linkId === -1) return null;
  const links = graph?.links;
  if (!links) return null;
  try {
    if (typeof links.get === "function") return links.get(linkId) ?? links.get(String(linkId)) ?? null;
  } catch (_) {}
  return links?.[linkId] ?? links?.[String(linkId)] ?? null;
}

function readRememberedDynamicLinks(node) {
  const raw = node?.properties?.[DYNAMIC_LINK_MEMORY_PROPERTY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

function writeRememberedDynamicLinks(node, links) {
  node.properties ??= {};
  const clean = {};
  for (const [name, descriptor] of Object.entries(links || {})) {
    if (!name || !descriptor || descriptor.originNodeId == null) continue;
    const originSlot = Number(descriptor.originSlot);
    if (!Number.isInteger(originSlot) || originSlot < 0) continue;
    clean[name] = { originNodeId: descriptor.originNodeId, originSlot };
  }
  if (Object.keys(clean).length) node.properties[DYNAMIC_LINK_MEMORY_PROPERTY] = clean;
  else delete node.properties[DYNAMIC_LINK_MEMORY_PROPERTY];
}

function rememberDynamicInputConnection(node, name, memory) {
  const index = widgetInputIndex(node, name);
  if (index < 0) return false;
  const input = node.inputs?.[index];
  const linkId = input?.link ?? (Array.isArray(input?.links) ? input.links[0] : null);
  const link = graphLinkById(node?.graph, linkId);
  if (!link) return false;
  const originNodeId = link.origin_id ?? link.originId;
  const originSlot = Number(link.origin_slot ?? link.originSlot);
  if (originNodeId == null || !Number.isInteger(originSlot) || originSlot < 0) return false;
  memory[name] = { originNodeId, originSlot };
  return true;
}

function restoreRememberedDynamicInput(node, name, memory) {
  if (widgetInputConnected(node, name)) {
    delete memory[name];
    return true;
  }
  const descriptor = memory[name];
  if (!descriptor) return false;
  let targetSlot = widgetInputIndex(node, name);
  if (targetSlot < 0) {
    const widget = widgetByName(node, name);
    if (widget && typeof node?.convertWidgetToInput === "function") {
      try { node.convertWidgetToInput(widget); } catch (_) {}
      targetSlot = widgetInputIndex(node, name);
    }
  }
  if (targetSlot < 0) return false;
  let originNode = null;
  try { originNode = node?.graph?.getNodeById?.(descriptor.originNodeId) ?? null; } catch (_) {}
  if (!originNode || typeof originNode.connect !== "function") return false;
  try {
    const result = originNode.connect(Number(descriptor.originSlot), node, targetSlot);
    const restored = result !== false && widgetInputConnected(node, name);
    if (restored) delete memory[name];
    return restored;
  } catch (error) {
    console.warn(`[Ultra MiniMax H3 Prompt R2V] Failed to restore remembered dynamic input ${name}.`, error);
    return false;
  }
}

function syncRememberedInputsForDynamicChange(node, previousCounts, nextCounts) {
  if (!previousCounts || !nextCounts) return { remembered: [], restored: [] };
  const before = hardActiveDynamicInputs(previousCounts);
  const after = hardActiveDynamicInputs(nextCounts);
  const memory = readRememberedDynamicLinks(node);
  const remembered = [];
  const restored = [];
  const state = nodeState(node);

  // Person/Turn/Shot count changes are reversible. Detach links from rows that
  // temporarily leave the active structure so hidden sockets cannot leave stale
  // geometry, remember the upstream endpoint, then reconnect when the row comes
  // back. Confirmed Reset is the only action that discards this memory.
  state.suppressConnectionUiSync = (state.suppressConnectionUiSync ?? 0) + 1;
  try {
    for (const name of before) {
      if (after.has(name) || !widgetInputConnected(node, name)) continue;
      if (!rememberDynamicInputConnection(node, name, memory)) continue;
      if (disconnectWidgetInput(node, name)) remembered.push(name);
      else delete memory[name];
    }
    for (const name of after) {
      if (before.has(name)) continue;
      if (restoreRememberedDynamicInput(node, name, memory)) restored.push(name);
    }
  } finally {
    state.suppressConnectionUiSync = Math.max(0, (state.suppressConnectionUiSync ?? 1) - 1);
  }

  writeRememberedDynamicLinks(node, memory);
  if (remembered.length || restored.length) {
    state.layoutRevision = (state.layoutRevision ?? 0) + 1;
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    app.canvas?.setDirty?.(true, true);
  }
  return { remembered, restored };
}

function forgetRememberedDynamicLink(node, name) {
  if (!name) return false;
  const memory = readRememberedDynamicLinks(node);
  if (!Object.prototype.hasOwnProperty.call(memory, name)) return false;
  delete memory[name];
  writeRememberedDynamicLinks(node, memory);
  return true;
}

function clearRememberedDynamicLinks(node) {
  if (!node?.properties || !Object.prototype.hasOwnProperty.call(node.properties, DYNAMIC_LINK_MEMORY_PROPERTY)) return false;
  delete node.properties[DYNAMIC_LINK_MEMORY_PROPERTY];
  return true;
}

function disconnectInputsInactiveAfterConfirmedReset(node, resetCounts) {
  if (!resetCounts) return [];
  const active = hardActiveDynamicInputs(resetCounts);
  const universe = new Set();
  for (let personIndex = 1; personIndex <= 3; personIndex++) {
    for (const name of PROFILE_FIELDS[personIndex] || []) universe.add(name);
  }
  for (let turnIndex = 1; turnIndex <= 6; turnIndex++) {
    for (const field of TURN_FIELDS) universe.add(`turn_${turnIndex}_${field}`);
  }
  universe.add("camera_sequence_enabled");
  universe.add("camera_shot_1_framing");
  universe.add("camera_shot_count");
  universe.add("camera_shot_1_target");
  for (let shotIndex = 2; shotIndex <= MAX_CAMERA_SHOTS; shotIndex++) {
    for (const name of CAMERA_SHOT_FIELDS[shotIndex] || []) universe.add(name);
  }

  const disconnected = [];
  const state = nodeState(node);
  state.suppressConnectionUiSync = (state.suppressConnectionUiSync ?? 0) + 1;
  try {
    for (const name of universe) {
      if (!active.has(name) && disconnectWidgetInput(node, name)) disconnected.push(name);
    }
  } finally {
    state.suppressConnectionUiSync = Math.max(0, (state.suppressConnectionUiSync ?? 1) - 1);
  }
  if (disconnected.length) {
    state.layoutRevision = (state.layoutRevision ?? 0) + 1;
    node.setDirtyCanvas?.(true, true);
  }
  return disconnected;
}


function visibleOrLinked(node, widget, visible, preserveLinkedWhenHidden = false) {
  if (!widget) return Boolean(visible);
  return Boolean(visible || (preserveLinkedWhenHidden && widgetInputConnected(node, widget.name)));
}

// -----------------------------------------------------------------------------
// Scene textarea preservation
// -----------------------------------------------------------------------------
// R2V follows the same proven sizing rule as the stable I2V/T2V node:
// - the user-sized scene_prompt height is flexible and must not be recomputed
// - showing/hiding fixed rows changes only the node's bottom edge
// - initial workflow loading never force-fits the node

// [Regression guard: Vue/Legacy detection] Do not infer Vue mode from DOM
// [data-node-id] ancestry: mounted DOM widgets such as scene_prompt may live
// outside a node-specific ancestor. Use Comfy.VueNodes.Enabled itself.
function isVueNodesEnabled() {
  try {
    const value = app?.ui?.settings?.getSettingValue?.("Comfy.VueNodes.Enabled");
    if (typeof value === "boolean") return value;
  } catch (_) {}
  return false;
}

function findSceneTextarea(node) {
  const element = widgetByName(node, "scene_prompt")?.element;
  return element?.tagName?.toLowerCase?.() === "textarea" ? element : null;
}

function readSceneHeight(node) {
  const textarea = findSceneTextarea(node);
  if (!textarea) return null;
  let measured = null;
  try {
    const height = Number(textarea.getBoundingClientRect?.().height);
    if (Number.isFinite(height) && height > 0) measured = height;
  } catch (_) {}
  if (measured == null) {
    for (const value of [textarea.offsetHeight, textarea.clientHeight]) {
      const height = Number(value);
      if (Number.isFinite(height) && height > 0) {
        measured = height;
        break;
      }
    }
  }
  if (measured != null) nodeState(node).lastSceneHeight = measured;
  return measured;
}

function readNodeSize(node) {
  const size = node?.size;
  if (!size || typeof size.length !== "number" || size.length < 2) return null;
  const width = Number(size[0]);
  const height = Number(size[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}


function restoreFreshResetGeometry(node, width) {
  if (!Number.isFinite(width) || width <= 0 || typeof node?.setSize !== "function") return false;
  const fresh = FRESH_RESET_GEOMETRY.get(node);
  const targetHeight = Number(fresh?.height);
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) return false;
  node.setSize([width, targetHeight]);
  node.setDirtyCanvas?.(true, true);
  return true;
}

function freshSceneFiveLineHeight(node) {
  const textarea = findSceneTextarea(node);
  if (!textarea) return null;
  try {
    const styles = getComputedStyle(textarea);
    const fontSize = Number.parseFloat(styles.fontSize) || 14;
    const parsedLineHeight = Number.parseFloat(styles.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
    const verticalChrome = [
      styles.paddingTop, styles.paddingBottom, styles.borderTopWidth, styles.borderBottomWidth,
    ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
    return Math.ceil(lineHeight * 5 + verticalChrome);
  } catch (_) {
    return 100;
  }
}

function applyFreshSceneCoreGeometry(node) {
  const widget = widgetByName(node, "scene_prompt");
  if (!widget || typeof node?.computeSize !== "function" || typeof node?.setSize !== "function") return false;
  const targetMinHeight = freshSceneFiveLineHeight(node);
  if (!Number.isFinite(targetMinHeight) || targetMinHeight <= 0) return false;

  widget.options ??= {};
  const hadOwnMinHeight = Object.prototype.hasOwnProperty.call(widget.options, "getMinHeight");
  const originalGetMinHeight = widget.options.getMinHeight;
  widget.options.getMinHeight = () => {
    let original = NaN;
    try { original = Number(originalGetMinHeight?.()); } catch (_) {}
    return Number.isFinite(original) ? Math.max(original, targetMinHeight) : targetMinHeight;
  };

  try {
    const computed = node.computeSize();
    if (!computed || computed.length < 2) return false;
    const width = Number(node?.size?.[0]) || Number(computed[0]);
    const height = Number(computed[1]);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return false;
    node.setSize([width, height]);
    return true;
  } finally {
    if (hadOwnMinHeight) widget.options.getMinHeight = originalGetMinHeight;
    else delete widget.options.getMinHeight;
  }
}

// Fresh/reset geometry is whatever Core computes after the final Basic View
// visibility pass. Do not add a second manual height offset.
function initializeFreshResetGeometry(node) {
  if (!node || FRESH_RESET_GEOMETRY.has(node)) return;
  const size = readNodeSize(node);
  if (size == null) return;
  FRESH_RESET_GEOMETRY.set(node, { width: size.width, height: size.height });
}

function nextFrame(callback) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function afterVueLayout(callback) {
  nextFrame(() => nextFrame(callback));
}

function finishSceneResize(node, token) {
  const state = nodeState(node);
  if (state.resizeToken !== token) return;
  state.pendingSceneHeight = null;
}

function readCoreComputedHeight(node) {
  if (typeof node?.computeSize !== "function") return null;
  try {
    const computed = node.computeSize();
    const height = Number(computed?.[1]);
    return Number.isFinite(height) && height > 0 ? height : null;
  } catch (_) {
    return null;
  }
}

function applyCoreLayoutDelta(node, beforeSize, beforeComputedHeight) {
  if (beforeSize == null || beforeComputedHeight == null || typeof node?.setSize !== "function") return false;
  const afterComputedHeight = readCoreComputedHeight(node);
  if (afterComputedHeight == null) return false;
  const delta = afterComputedHeight - beforeComputedHeight;
  if (!Number.isFinite(delta) || Math.abs(delta) <= 0.5) return false;
  const nextHeight = beforeSize.height + delta;
  if (!Number.isFinite(nextHeight) || nextHeight <= 0) return false;
  node.setSize([beforeSize.width, nextHeight]);
  node.setDirtyCanvas?.(true, true);
  return true;
}

function verifySceneHeightOnce(node, targetHeight, token, expectedState) {
  const state = NODE_STATES.get(node);
  if (!state || state !== expectedState || state.resizeToken !== token) return;
  const currentHeight = readSceneHeight(node);
  const size = readNodeSize(node);
  if (currentHeight == null || size == null || typeof node.setSize !== "function") {
    finishSceneResize(node, token);
    return;
  }
  const delta = targetHeight - currentHeight;
  if (Number.isFinite(delta) && Math.abs(delta) > 1) {
    const nextHeight = size.height + delta;
    if (Number.isFinite(nextHeight) && nextHeight > 0) {
      node.setSize([size.width, nextHeight]);
      node.setDirtyCanvas?.(true, true);
    }
  }
  // targetHeight is the user-authoritative geometry this bounded pass was
  // asked to preserve. readSceneHeight() above may have observed a transient
  // flex-expanded value immediately before setSize() corrects the node, so do
  // not leave that transient measurement cached for a later linked/hidden scene.
  state.lastSceneHeight = targetHeight;
  finishSceneResize(node, token);
}

function preserveSceneHeight(node, targetHeight) {
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) return;
  const state = nodeState(node);
  state.lastSceneHeight = targetHeight;
  const token = ++state.resizeToken;
  state.pendingSceneHeight = targetHeight;
  afterVueLayout(() => verifySceneHeightOnce(node, targetHeight, token, state));
}

function preserveSceneGeometryAfterConnection(node, beforeSize, layoutRevision) {
  const state = nodeState(node);
  const token = ++state.sceneConnectionToken;
  afterVueLayout(() => {
    if (NODE_STATES.get(node) !== state || state.sceneConnectionToken !== token) return;
    if (!beforeSize || state.layoutRevision !== layoutRevision || typeof node?.setSize !== "function") return;
    const currentSize = readNodeSize(node);
    if (currentSize == null) return;
    if (Math.abs(currentSize.width - beforeSize.width) > 0.5 || Math.abs(currentSize.height - beforeSize.height) > 1) {
      node.setSize([beforeSize.width, beforeSize.height]);
      node.setDirtyCanvas?.(true, true);
    }
    const measured = readSceneHeight(node);
    if (measured != null) state.lastSceneHeight = measured;
  });
}

function layoutSignature(node) {
  const widgets = Array.isArray(node?.widgets) ? node.widgets : [];
  let visible = "";
  for (const widget of widgets) visible += (widget?.hidden || widget?.options?.hidden) ? "0" : "1";
  return `${widgets.length}|${Array.isArray(node?.inputs) ? node.inputs.length : 0}|${visible}`;
}

function runScenePreservingLayoutChange(node, mutate) {
  const state = nodeState(node);
  // Right after a workflow load/switch the textarea height is a transient
  // Vue flex value, not user geometry. Only the serialized/stored heights are
  // trustworthy in that window.
  const settling = WORKFLOW_LOAD_SETTLING.has(node);
  const measuredSceneHeight = settling ? null : readSceneHeight(node);
  const sceneHeight = state.pendingSceneHeight ?? measuredSceneHeight ?? state.lastSceneHeight;
  const beforeSize = readNodeSize(node);
  const beforeComputedHeight = readCoreComputedHeight(node);
  const beforeSignature = layoutSignature(node);
  const result = mutate();
  // Match Main's syncDynamicUI contract: scene preservation runs only when the
  // layout actually changed. A no-op sync (value-only callback, Vue widget
  // mount emitting its current value, unrelated connection refresh) must not
  // measure the textarea and resize the node to that measurement.
  const afterComputedHeight = readCoreComputedHeight(node);
  const layoutChanged = Boolean(result)
    || layoutSignature(node) !== beforeSignature
    || (beforeComputedHeight != null && afterComputedHeight != null
      && Math.abs(afterComputedHeight - beforeComputedHeight) > 0.5);
  if (!layoutChanged) return result;
  if (beforeSize != null && beforeComputedHeight != null) {
    // When scene_prompt is externally linked, its textarea can disappear. The
    // fixed-row layout delta must still be applied to the user's current node
    // height so the implicit scene area stays stable instead of absorbing the
    // row-count change and making the node jump.
    applyCoreLayoutDelta(node, beforeSize, beforeComputedHeight);
    if (!isVueNodesEnabled() && typeof node.arrange === "function") {
      try { node.arrange(); } catch (_) {}
    }
    if (sceneHeight != null && !settling) preserveSceneHeight(node, sceneHeight);
  }
  return result;
}

function syncBounds(node) {
  const durationWidget = widgetByName(node, "duration_seconds");
  const duration = normalizeWholeSecondDuration(durationWidget?.value, 5, 15);
  if (durationWidget && Number(durationWidget.value) !== duration) durationWidget.value = duration;
  const maxStart = Math.max(0, duration - 0.5);
  const activeTurnCount = Math.max(1, Math.min(6, Number(widgetByName(node, "turn_count")?.value ?? 1) || 1));

  let metadataChanged = false;
  for (let i = 1; i <= 6; i++) {
    const widget = widgetByName(node, `turn_${i}_elapsed_seconds`);
    if (!widget) continue;
    const opts = widget.options && typeof widget.options === "object" ? widget.options : {};
    if (Number(opts.min) !== 0 || Number(opts.max) !== maxStart || Number(opts.step) !== 0.5) {
      widget.options = { ...opts, min: 0, max: maxStart, step: 0.5 };
      metadataChanged = true;
    }
    // Preserve inactive Progress rows exactly; clamp only when the row is active.
    if (i > activeTurnCount) continue;
    const current = Number(widget.value);
    const snapped = snapHalfSecond(current, 0.0);
    const clamped = Math.max(0, Math.min(maxStart, snapped));
    if (!Number.isFinite(current) || Math.abs(clamped - current) > 1e-9) widget.value = clamped;
  }
  metadataChanged = syncShotStartTimeBounds(node) || metadataChanged;
  activeCameraShotCount(node);
  return metadataChanged;
}

function basicViewEnabled(node) {
  if (!node.properties) node.properties = {};
  if (!Object.prototype.hasOwnProperty.call(node.properties, BASIC_VIEW_PROPERTY)) {
    node.properties[BASIC_VIEW_PROPERTY] = true;
  }
  return node.properties[BASIC_VIEW_PROPERTY] !== false;
}

function setBasicViewEnabled(node, enabled) {
  if (!node.properties) node.properties = {};
  node.properties[BASIC_VIEW_PROPERTY] = Boolean(enabled);
}

function collapseAdvancedTogglesForBasicView(node) {
  let changed = false;
  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const widget = widgetByName(node, name);
    if (!widget || !Boolean(widget.value)) continue;
    widget.value = false;
    changed = true;
  }
  return changed;
}

function expandAdvancedTogglesForFullView(node) {
  const personCount = Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1) || 0));
  const names = ["person_a_advanced", "person_b_advanced", "person_c_advanced"];
  let changed = false;
  for (let index = 0; index < personCount; index += 1) {
    const widget = widgetByName(node, names[index]);
    if (!widget || Boolean(widget.value)) continue;
    widget.value = true;
    changed = true;
  }
  return changed;
}

function viewToggleText(node) {
  const basic = basicViewEnabled(node);
  const ko = activeLocale(node) === "ko";
  if (ko) return basic ? "전체 설정 보기" : "기본 보기";
  return basic ? "Show All Settings" : "Basic View";
}

function removeSectionWidgets(node) {
  if (!Array.isArray(node?.widgets)) return;
  for (let index = node.widgets.length - 1; index >= 0; index--) {
    const widget = node.widgets[index];
    const legacySection = String(widget?.name || "").startsWith("__r2v_section_");
    if (!legacySection) continue;
    try {
      if (typeof node.removeWidget === "function") node.removeWidget(widget);
    } catch (_) {}
    const remainingIndex = node.widgets.indexOf(widget);
    if (remainingIndex >= 0) node.widgets.splice(remainingIndex, 1);
  }
}

function modeDisplayText(node) {
  return activeLocale(node) === "ko"
    ? { label: "영상 입력 방식", value: "R2V Reference (고정)" }
    : { label: "H3 Mode", value: "R2V Reference (fixed)" };
}

function ensureModeDisplayWidget(node) {
  if (!node || typeof node.addWidget !== "function") return null;
  let widget = (node.widgets || []).find((item) => item?.[MODE_DISPLAY_MARKER]);
  const text = modeDisplayText(node);
  if (!widget) {
    widget = markUiOnly(node.addWidget(
      "combo",
      "__r2v_mode_display",
      text.value,
      () => {},
      { values: [text.value], serialize: false },
    ));
    widget[MODE_DISPLAY_MARKER] = true;
  }
  if (widget.name !== "__r2v_mode_display") widget.name = "__r2v_mode_display";
  if (widget.label !== text.label) widget.label = text.label;
  if (widget.value !== text.value) widget.value = text.value;
  const tooltip = activeLocale(node) === "ko"
    ? "R2V 노드는 Reference-to-Video 방식으로 고정되어 있습니다. 기능에는 관여하지 않는 표시용 항목입니다."
    : "R2V is fixed to Reference-to-Video. This is a display-only row and does not affect backend generation.";
  const currentOptions = widget.options || {};
  if (currentOptions.serialize !== false || currentOptions.tooltip !== tooltip
    || currentOptions.values?.length !== 1 || currentOptions.values?.[0] !== text.value) {
    widget.options = { ...currentOptions, values: [text.value], serialize: false, tooltip };
  }
  return widget;
}


function createReliableCountMirror(node, text, initialValue, spec, onValue) {
  if (!node) return null;
  const stableName = `__ultra_h3_r2v_count_${spec.key}`;
  const clamp = (value) => {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return null;
    return Math.max(spec.min, Math.min(spec.max, numeric));
  };
  let mirror = null;
  const commit = (value) => {
    const next = clamp(value);
    if (next == null) return;
    if (mirror) mirror.value = next;
    onValue(next);
    try { node.setDirtyCanvas?.(true, true); } catch (_) {}
  };
  if (typeof node.addCustomWidget !== "function") {
    if (typeof node.addWidget !== "function") return null;
    mirror = node.addWidget("number", stableName, clamp(initialValue) ?? spec.min, commit,
      { min: spec.min, max: spec.max, step: 1, precision: 0, serialize: false, tooltip: text.tooltip });
    if (mirror) {
      mirror.label = text.label;
      mirror.serialize = false;
      mirror.serializeValue = () => undefined;
    }
    return mirror;
  }
  const localX = (event, pos, owner) => {
    if (Number.isFinite(Number(event?.canvasX)) && Array.isArray(owner?.pos)) {
      return Number(event.canvasX) - Number(owner.pos[0] || 0);
    }
    if (Array.isArray(pos) && Number.isFinite(Number(pos[0]))) return Number(pos[0]);
    return NaN;
  };
  mirror = {
    type: "custom",
    name: stableName,
    label: text.label,
    value: clamp(initialValue) ?? spec.min,
    options: { min: spec.min, max: spec.max, step: 1, precision: 0, serialize: false, tooltip: text.tooltip },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 20],
    draw(ctx, owner, width, y, H) {
      if (!ctx) return;
      const margin = 15;
      const h = Number(H) || 20;
      const w = Number(width) || Number(owner?.size?.[0]) || 200;
      const x0 = margin;
      const x1 = Math.max(x0 + 1, w - margin);
      this.__ultraCountMirrorWidth = w;
      ctx.save();
      try {
        ctx.fillStyle = "#222";
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const r = Math.max(4, Math.min(h / 2, 10));
        ctx.moveTo(x0 + r, y);
        ctx.lineTo(x1 - r, y);
        ctx.quadraticCurveTo(x1, y, x1, y + r);
        ctx.lineTo(x1, y + h - r);
        ctx.quadraticCurveTo(x1, y + h, x1 - r, y + h);
        ctx.lineTo(x0 + r, y + h);
        ctx.quadraticCurveTo(x0, y + h, x0, y + h - r);
        ctx.lineTo(x0, y + r);
        ctx.quadraticCurveTo(x0, y, x0 + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ddd";
        ctx.textBaseline = "middle";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(String(this.label || this.name || ""), x0 + 20, y + h / 2);
        // Match ComfyUI's native number-row hierarchy: label on the left,
        // value tucked against the right step arrow instead of floating in
        // the visual center of the row.
        ctx.textAlign = "right";
        ctx.fillText(String(this.value), x1 - 35, y + h / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = Number(this.value) > spec.min ? "#ddd" : "#777";
        ctx.fillText("◀", x0 + 12, y + h / 2);
        ctx.fillStyle = Number(this.value) < spec.max ? "#ddd" : "#777";
        ctx.fillText("▶", x1 - 12, y + h / 2);
      } finally {
        ctx.restore();
      }
    },
    mouse(event, pos, owner) {
      const type = String(event?.type || "").toLowerCase();
      if (type !== "pointerup" && type !== "mouseup") return false;
      const width = Number(this.__ultraCountMirrorWidth) || Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 0;
      const x = localX(event, pos, owner || node);
      if (!Number.isFinite(x) || !(width > 0)) return false;
      const edge = 40;
      if (x <= edge) {
        if (Number(this.value) > spec.min) commit(Number(this.value) - 1);
        return true;
      }
      if (x >= width - edge) {
        if (Number(this.value) < spec.max) commit(Number(this.value) + 1);
        return true;
      }
      const canvas = app?.canvas;
      if (typeof canvas?.prompt === "function") {
        canvas.prompt("Value", this.value, (value) => commit(value), event);
        return true;
      }
      return false;
    },
  };
  node.addCustomWidget(mirror);
  return mirror;
}

function r2vBasicCountUiText(node, storage, key) {
  const locale = activeLocale(node);
  const fallback = key === "person_count"
    ? (locale === "ko" ? "주요 인물 수" : "Number of People")
    : (locale === "ko" ? "시간순 진행 수" : "Timeline Rows");
  const label = String(storage?.label ?? "").trim();
  return {
    label: label && label !== key ? label : fallback,
    tooltip: String((typeof storage?.[Symbol.for("ultraH3.overlayTooltip")] === "function"
      ? storage[Symbol.for("ultraH3.overlayTooltip")]()
      : undefined) ?? storage?.options?.tooltip ?? storage?.tooltip ?? ""),
  };
}

function r2vBasicCountMirror(node, key) {
  return (node?.widgets || []).find((widget) => widget?.[BASIC_COUNT_UI_MARKER] === key) || null;
}

function installR2VBasicCountMirrors(node) {
  if (!node || (typeof node.addCustomWidget !== "function" && typeof node.addWidget !== "function")) return false;
  const widgets = node.widgets || [];
  const visualStyleWidget = widgetByName(node, "visual_style");
  if (!visualStyleWidget) return false;
  let changed = false;
  const specs = [
    { key: "person_count", min: 0, max: 3 },
    { key: "turn_count", min: 1, max: 6 },
  ];
  let anchor = visualStyleWidget;
  for (const spec of specs) {
    const storage = widgetByName(node, spec.key);
    if (!storage) continue;
    let mirror = r2vBasicCountMirror(node, spec.key);
    const text = r2vBasicCountUiText(node, storage, spec.key);
    if (!mirror) {
      mirror = createReliableCountMirror(node, text, Number(storage.value ?? spec.min), spec, (next) => {
        storage.value = next;
        if (typeof storage.callback === "function") storage.callback.call(storage, next);
      });
      if (!mirror) continue;
      markUiOnly(mirror);
      mirror[BASIC_COUNT_UI_MARKER] = spec.key;
      changed = true;
    }
    if (mirror.label !== text.label) mirror.label = text.label;
    const nextValue = Math.max(spec.min, Math.min(spec.max, Math.round(Number(storage.value ?? spec.min) || spec.min)));
    if (mirror.value !== nextValue) mirror.value = nextValue;
    const currentOptions = mirror.options || {};
    if (currentOptions.min !== spec.min || currentOptions.max !== spec.max || currentOptions.step !== 1
      || currentOptions.precision !== 0 || currentOptions.serialize !== false || currentOptions.tooltip !== text.tooltip) {
      mirror.options = { ...currentOptions, min: spec.min, max: spec.max, step: 1, precision: 0, serialize: false, tooltip: text.tooltip };
    }
    if (storage.hidden !== true) storage.hidden = true;
    if (storage?.options?.hidden !== true) storage.options = { ...(storage.options || {}), hidden: true };

    const oldIndex = widgets.indexOf(mirror);
    const anchorIndex = widgets.indexOf(anchor);
    if (oldIndex >= 0 && anchorIndex >= 0 && oldIndex !== anchorIndex + 1) {
      widgets.splice(oldIndex, 1);
      const liveAnchorIndex = widgets.indexOf(anchor);
      widgets.splice(liveAnchorIndex + 1, 0, mirror);
      changed = true;
    }
    anchor = mirror;
  }
  return changed;
}

function organizeWidgetLayout(node) {
  return withBatchedWidgetMutations(node, () => organizeWidgetLayoutNow(node));
}

function organizeWidgetLayoutNow(node) {
  const widgets = node?.widgets;
  if (!Array.isArray(widgets) || !widgets.length) return;

  // Do not insert DOM widgets between normal ComfyUI widgets. Some current
  // ComfyUI/Nodes 2.0 layouts can reserve large vertical blocks around mixed
  // DOM/core widget flows. R2V therefore keeps its entire body and actions on
  // ordinary ComfyUI widgets only.
  removeSectionWidgets(node);

  const referenceWidgets = widgets.filter((item) => item?.[REFERENCE_UI_MARKER]);
  const scene = widgetByName(node, "scene_prompt");
  if (referenceWidgets.length > 0 && scene) {
    let insertAt = widgets.indexOf(scene) + 1;
    for (const item of referenceWidgets) {
      const old = widgets.indexOf(item);
      if (old >= 0) widgets.splice(old, 1);
    }
    for (const item of referenceWidgets) widgets.splice(insertAt++, 0, item);
  }

  // Mirror Main's common opening sequence without inventing an R2V backend mode.
  // This JS-only one-choice row is display/spacing only and is excluded from
  // workflow serialization by markUiOnly().
  const modeDisplay = ensureModeDisplayWidget(node);
  const sceneTranslate = widgetByName(node, "scene_translate");
  if (modeDisplay && sceneTranslate) {
    const old = widgets.indexOf(modeDisplay);
    if (old >= 0) widgets.splice(old, 1);
    // Keep the non-serialized Google API settings row directly below the
    // translation selector. The R2V display-only mode row follows it, matching
    // Main and the Basic-group separator/branch order exactly.
    const translationApi = translationApiWidget(node);
    const anchorIndex = widgets.indexOf(translationApi || sceneTranslate);
    widgets.splice(Math.max(0, anchorIndex + 1), 0, modeDisplay);
  }

  // Keep the real backend count widgets in their original schema order. ComfyUI
  // queues widget values positionally, so physically moving person_count or
  // turn_count corrupts every following input. Display-only mirrors provide the
  // same Basic Settings layout without touching the backend sequence.
  installR2VBasicCountMirrors(node);

  moveActionControlsToBottom(node);
}

function resetActionLabel(node) {
  const armed = Number(nodeState(node).resetConfirmUntil) > Date.now();
  return activeLocale(node) === "ko" ? (armed ? "정말 초기화?" : "설정 초기화") : (armed ? "Confirm Reset?" : "Reset Settings");
}

function actionRowText(node) {
  if (activeLocale(node) === "ko") {
    return {
      viewTooltip: "그룹의 ▶/▼ 접힘 상태는 그대로 둡니다. 기본 보기는 핵심 항목만 남기고, 전체 설정 보기는 세부 항목까지 표시합니다. 기본 보기에서 숨긴 값과 연결은 유지되며 실제 연결된 행은 선을 숨기지 않기 위해 계속 보일 수 있습니다.",
      resetTooltip: "현재 너비와 Picture/Video/Audio Reference 연결은 유지하고, 씬 지시어·인물·진행·촬영 설정 등 위젯에 연결된 외부 입력선과 모든 설정/화면 상태를 새 노드 기본값으로 되돌립니다. Reference 역할·내용 설정은 기본값으로 초기화되며, 위젯을 입력으로 변환한 상태도 일반 위젯으로 되돌립니다. 첫 클릭 후 한 번 더 눌러 확인합니다.",
    };
  }
  return {
    viewTooltip: "Keep each group’s ▶/▼ state unchanged. Basic View keeps core controls only; Show All Settings restores fine controls. Hidden values and links stay active, and a live connected row may remain visible so its socket/line is never hidden.",
    resetTooltip: "Keep the current node width and Picture/Video/Audio Reference media connections, but disconnect external links attached to resettable widgets such as scene, person, timeline, and shot settings, then restore all settings and node/scene geometry to fresh-node defaults. Reference role/content settings return to defaults, and widgets converted to inputs return to normal widgets. Click once, then confirm with a second click.",
  };
}

function refreshActionControls(node) {
  const texts = actionRowText(node);
  const viewText = viewToggleText(node);
  const widgets = node.widgets || [];
  const viewWidget = widgets.find((item) => item?.[VIEW_TOGGLE_MARKER]);
  if (viewWidget) {
    if (viewWidget.name !== "__r2v_view_toggle") viewWidget.name = "__r2v_view_toggle";
    if (viewWidget.label !== viewText) viewWidget.label = viewText;
    if (viewWidget.value !== viewText) viewWidget.value = viewText;
    if (viewWidget?.options?.serialize !== false || viewWidget?.options?.tooltip !== texts.viewTooltip) {
      viewWidget.options = { ...(viewWidget.options || {}), serialize: false, tooltip: texts.viewTooltip };
    }
  }
  const resetWidget = widgets.find((item) => item?.[RESET_BUTTON_MARKER]);
  if (resetWidget) {
    const label = resetActionLabel(node);
    if (resetWidget.name !== "__r2v_reset_button") resetWidget.name = "__r2v_reset_button";
    if (resetWidget.label !== label) resetWidget.label = label;
    if (resetWidget.value !== label) resetWidget.value = label;
    if (resetWidget?.options?.serialize !== false || resetWidget?.options?.tooltip !== texts.resetTooltip) {
      resetWidget.options = { ...(resetWidget.options || {}), serialize: false, tooltip: texts.resetTooltip };
    }
  }
  const rowWidget = widgets.find((item) => item?.[ACTION_ROW_MARKER]);
  const controls = rowWidget?.__ultraR2VControls;
  if (controls?.viewButton) {
    if (controls.viewButton.textContent !== viewText) controls.viewButton.textContent = viewText;
    if (controls.viewButton.title !== texts.viewTooltip) controls.viewButton.title = texts.viewTooltip;
  }
  if (controls?.resetButton) {
    const resetText = resetActionLabel(node);
    if (controls.resetButton.textContent !== resetText) controls.resetButton.textContent = resetText;
    if (controls.resetButton.title !== texts.resetTooltip) controls.resetButton.title = texts.resetTooltip;
  }
}

function clearResetConfirmation(node) {
  const state = nodeState(node);
  state.resetConfirmUntil = 0;
  if (state.resetConfirmTimer != null) clearTimeout(state.resetConfirmTimer);
  state.resetConfirmTimer = null;
  refreshActionControls(node);
}

function armResetConfirmation(node) {
  const state = nodeState(node);
  const deadline = Date.now() + RESET_CONFIRM_MS;
  state.resetConfirmUntil = deadline;
  if (state.resetConfirmTimer != null) clearTimeout(state.resetConfirmTimer);
  state.resetConfirmTimer = setTimeout(() => {
    const current = NODE_STATES.get(node);
    if (current !== state || Number(current.resetConfirmUntil) !== deadline) return;
    current.resetConfirmUntil = 0;
    current.resetConfirmTimer = null;
    refreshActionControls(node);
    node.setDirtyCanvas?.(true, true);
  }, RESET_CONFIRM_MS + 50);
  refreshActionControls(node);
  node.setDirtyCanvas?.(true, true);
}

function isR2VUiOnlyWidget(widget) {
  // Extension Options are canvas/UI-only state carried through the hidden
  // ultra_extension_options_json transport. They must never participate in
  // positional backend widgets_values indexing or reset-default discovery.
  // Treat them exactly like the existing R2V UI-only widgets everywhere that
  // distinguishes serialized/core widgets from display-only rows.
  return Boolean(widget?.[UI_MARKER] || widget?.[EXTENSION_WIDGET_MARKER] || widget?.[TRANSLATION_API_WIDGET_MARKER]);
}

function resettableWidgetPlan(node) {
  const plan = [];
  const missing = [];
  const schemaDefaults = node?.[CORE_DEFAULTS_PROPERTY];
  for (const widget of (node.widgets || []).filter((item) => !isR2VUiOnlyWidget(item))) {
    if (!widget) continue;
    const name = String(widget.name || "");
    let hasDefault = false;
    let defaultValue;
    if (schemaDefaults && Object.prototype.hasOwnProperty.call(schemaDefaults, name)) {
      defaultValue = schemaDefaults[name];
      hasDefault = true;
    } else {
      const options = widget.options && typeof widget.options === "object" ? widget.options : null;
      if (options && Object.prototype.hasOwnProperty.call(options, "default")) {
        defaultValue = options.default;
        hasDefault = true;
      }
    }
    if (!hasDefault) {
      missing.push(name || "<unnamed>");
      continue;
    }
    plan.push({ widget, value: cloneResetValue(defaultValue) });
  }
  return { plan, missing };
}

function resetNodeSettingsToCoreDefaults(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return false;
  let plan;
  let missing;
  let convertedPlan;
  try {
    ({ plan, missing } = resettableWidgetPlan(node));
    const convertedReset = convertedWidgetResetPlan(node, plan);
    convertedPlan = convertedReset.converted;
    if (convertedReset.invalid.length) missing = [...missing, ...convertedReset.invalid.map((name) => `converted:${name}`)];
  } catch (error) {
    console.error("Ultra MiniMax H3 Prompt R2V: reset preflight failed; no settings were changed.", error);
    clearResetConfirmation(node);
    return false;
  }
  if (!plan.length || missing.length) {
    console.warn("Ultra MiniMax H3 Prompt R2V: reset aborted because core widget defaults were unavailable:", missing);
    clearResetConfirmation(node);
    return false;
  }
  const resetNodeSize = readNodeSize(node);
  const width = resetNodeSize?.width ?? null;
  const resetCoreHeight = readCoreComputedHeight(node);
  // Reset values/view state, but keep the user's current flexible scene room.
  // Core's fixed-row height delta shrinks/expands only the node outer geometry;
  // scene_prompt itself must not be replaced with the fresh-node baseline.
  const snapshotWidgets = (node.widgets || []).map((widget) => ({
    widget,
    value: cloneResetValue(widget?.value),
    hidden: widget?.hidden,
    optionsHiddenPresent: Boolean(widget?.options && Object.prototype.hasOwnProperty.call(widget.options, "hidden")),
    optionsHidden: widget?.options?.hidden,
  }));
  const snapshotProps = cloneResetValue(node.properties || {});
  const graphChange = beginResetGraphChange(node);
  const resettableWidgetLinks = detachResettableWidgetLinksForConfirmedReset(node);
  try {
    // As in the main node, confirmed Reset has already detached every external
    // connection backed by a resettable widget before defaults are assigned.
    // Physical Picture/Video/Audio Reference sockets are native media inputs, so
    // their links remain intact. The inactive-row pass below is retained only as
    // compatibility cleanup for older affected workflows.
    for (const { widget, value } of plan) widget.value = cloneResetValue(value);
    const resetCounts = readDynamicCounts(node);
    disconnectInputsInactiveAfterConfirmedReset(node, resetCounts);
    clearRememberedDynamicLinks(node);
    node.properties ??= {};
    delete node.properties[PREFERENCE_PROPERTY];
    delete node.properties[DETACHED_REFERENCE_PLAN_PROPERTY];
    resetExtensionOptions(node, { locale: activeLocale });
    clearGroupedSectionState(node);
    clearReferenceStateForConfirmedReset(node);
    discardNodeState(node);
    nodeState(node);
    setBasicViewEnabled(node, true);
    setAllGroupedSectionsCollapsed(node, true, { refresh: false });
    clearResetConfirmation(node);
    // Match the stable Main reset path: do not run R2V's ordinary physical-input
    // normalization here. That routine directly reorders node.inputs, which is
    // useful for live Reference compaction but unsafe during a factory reset in
    // Nodes 2.0 because connection hit-targets can retain the old layout. The
    // current physical media sockets stay exactly where they are; only their
    // semantic Reference UI is rebuilt from the cleared default plan.
    attachPlanToInputs(node);
    rebuildReferenceUi(node, { flushCurrent: false });
    applyConfirmedResetReferenceDefaults(node);
    syncCoreVisibility(node, { preserveSceneHeight: false });
    restoreConvertedWidgetsAfterConfirmedReset(node, convertedPlan);
    // The reset changes fixed rows (Basic View, groups, dynamic controls). Apply
    // only Core's fixed-layout delta to the user's existing outer size so the
    // scene editor keeps exactly the room it had before reset.
    applyCoreLayoutDelta(node, resetNodeSize, resetCoreHeight);
    if (isVueNodesEnabled()) {
      afterVueLayout(() => {
        // Nodes 2.0 can commit stale combo display values one layout pass later.
        // Re-assert only the semantic Reference defaults here. A second full
        // syncCoreVisibility() is intentionally forbidden: it starts another
        // layout transaction after Reset has already reached its final geometry,
        // which makes grouped headers/accent bars visibly walk to their positions.
        applyConfirmedResetReferenceDefaults(node);
        node.setDirtyCanvas?.(true, true);
      });
    }
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    app.canvas?.setDirty?.(true, true);
    finishResetGraphChange(graphChange, node);
    return true;
  } catch (error) {
    restoreResettableWidgetLinksAfterFailedReset(node, resettableWidgetLinks);
    console.error("Ultra MiniMax H3 Prompt R2V: settings reset failed; restoring the previous node state.", error);
    for (const item of snapshotWidgets) {
      const widget = item?.widget;
      if (!widget) continue;
      widget.value = cloneResetValue(item.value);
      widget.hidden = item.hidden;
      if (widget.options && typeof widget.options === "object") {
        if (item.optionsHiddenPresent) widget.options = { ...widget.options, hidden: item.optionsHidden };
        else { const nextOptions = { ...widget.options }; delete nextOptions.hidden; widget.options = nextOptions; }
      }
    }
    node.properties = snapshotProps;
    normalizeDynamicInputs(node, { preserveSceneHeight: false });
    syncCoreVisibility(node, { preserveSceneHeight: false });
    if (width != null && node?.size && typeof node.size.length === "number" && node.size.length > 0) node.size[0] = width;
    finishResetGraphChange(graphChange, node);
    return false;
  }
}

function moveActionControlsToBottom(node) {
  const widgets = node?.widgets;
  if (!Array.isArray(widgets) || !widgets.length) return;
  const row = widgets.find((item) => item?.[ACTION_ROW_MARKER]);
  if (row) {
    const index = widgets.indexOf(row);
    if (index >= 0 && index !== widgets.length - 1) {
      widgets.splice(index, 1);
      widgets.push(row);
    }
    return;
  }
  const view = widgets.find((item) => item?.[VIEW_TOGGLE_MARKER]);
  const reset = widgets.find((item) => item?.[RESET_BUTTON_MARKER]);
  for (const item of [view, reset]) {
    if (!item) continue;
    const index = widgets.indexOf(item);
    if (index >= 0) widgets.splice(index, 1);
  }
  if (view) widgets.push(view);
  if (reset) widgets.push(reset);
}

function removeDomActionRow(node) {
  const widgets = node?.widgets || [];
  for (let index = widgets.length - 1; index >= 0; index--) {
    const widget = widgets[index];
    if (!widget?.[ACTION_ROW_MARKER]) continue;
    try { node.removeWidget?.(widget); } catch (_) { widgets.splice(index, 1); }
  }
}

function ensureViewToggle(node) {
  if (!node) return;
  // R2V intentionally uses only ordinary ComfyUI widgets. Mixing DOM widgets
  // with core widgets can leave large vertical gaps in current Vue/Nodes 2.0.
  removeDomActionRow(node);
  let viewWidget = (node.widgets || []).find((item) => item?.[VIEW_TOGGLE_MARKER]);
  if (!viewWidget && typeof node.addWidget === "function") {
    viewWidget = node.addWidget("button", "__r2v_view_toggle", null, () => {
      const nextBasic = !basicViewEnabled(node);
      setBasicViewEnabled(node, nextBasic);
      // View mode changes information density only. Group ▶/▼ state stays intact.
      if (nextBasic) collapseAdvancedTogglesForBasicView(node);
      else expandAdvancedTogglesForFullView(node);
      nodeState(node).layoutRevision = (nodeState(node).layoutRevision ?? 0) + 1;
      syncCoreVisibility(node, { preserveSceneHeight: true });
      refreshActionControls(node);
    }, { serialize: false });
    if (viewWidget) { markUiOnly(viewWidget); viewWidget[VIEW_TOGGLE_MARKER] = true; }
  }
  let resetWidget = (node.widgets || []).find((item) => item?.[RESET_BUTTON_MARKER]);
  if (!resetWidget && typeof node.addWidget === "function") {
    resetWidget = node.addWidget("button", "__r2v_reset_button", null, () => {
      if (Number(nodeState(node).resetConfirmUntil) > Date.now()) resetNodeSettingsToCoreDefaults(node);
      else armResetConfirmation(node);
    }, { serialize: false });
    if (resetWidget) { markUiOnly(resetWidget); resetWidget[RESET_BUTTON_MARKER] = true; }
  }
  refreshActionControls(node);
  moveActionControlsToBottom(node);
}

function allowedTurnSpeakerChoices(personCount) {
  // R2V supports an independent off-screen Narrator in addition to visible
  // Person A/B/C speakers. With zero people the hidden canonical speaker is
  // Narrator; Full View can still expose the narration timeline on demand.
  if (personCount <= 0) return ["Narrator"];
  if (personCount === 1) return ["A", "Narrator"];
  if (personCount === 2) return ["A", "B", "A+B", "Narrator"];
  return ["A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "Narrator"];
}

function allowedCameraTargetChoices(personCount) {
  if (personCount <= 0) return ["current_action", "scene"];
  if (personCount === 1) return ["current_action", "A", "scene"];
  if (personCount === 2) return ["current_action", "A", "B", "A+B", "scene"];
  return ["current_action", "A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "scene"];
}

function syncTurnSpeakerChoices(node, personCount) {
  const allowed = allowedTurnSpeakerChoices(personCount);
  const fallback = allowed[0] || "A";
  const state = nodeState(node);
  let changed = false;
  let preferenceChanged = false;
  for (let index = 1; index <= 6; index++) {
    const widget = widgetByName(node, `turn_${index}_speaker`);
    if (!widget) continue;
    const previous = Array.isArray(widget?.options?.values) ? widget.options.values : [];
    if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
      widget.options = { ...(widget.options || {}), values: [...allowed] };
      changed = true;
    }
    const key = String(index);
    const current = canonicalCoreOptionValue(widget.name, widget.value) || fallback;
    if (!state.preferredTurnSpeakers.has(key)) state.preferredTurnSpeakers.set(key, current);
    const preferred = state.preferredTurnSpeakers.get(key) || current;
    let next = current;
    if (allowed.includes(preferred)) {
      next = preferred;
      state.autoFallbackTurnSpeakers.delete(key);
    } else if (!allowed.includes(current)) {
      next = fallback;
      state.autoFallbackTurnSpeakers.add(key);
      preferenceChanged = true;
    }
    if (String(widget.value ?? "") !== next) {
      state.programmaticTurnSpeakerWrites.add(key);
      try { widget.value = next; } finally { state.programmaticTurnSpeakerWrites.delete(key); }
      changed = true;
    }
  }
  if (preferenceChanged) persistPreferences(node, state);
  return changed;
}

function syncCameraTargetChoices(node, personCount) {
  const allowed = allowedCameraTargetChoices(personCount);
  const fallback = "current_action";
  const state = nodeState(node);
  let changed = false;
  let preferenceChanged = false;
  for (let index = 1; index <= MAX_CAMERA_SHOTS; index++) {
    const widget = widgetByName(node, `camera_shot_${index}_target`);
    if (!widget) continue;
    const previous = Array.isArray(widget?.options?.values) ? widget.options.values : [];
    if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
      widget.options = { ...(widget.options || {}), values: [...allowed] };
      changed = true;
    }
    const key = String(index);
    const current = canonicalCoreOptionValue(widget.name, widget.value) || fallback;
    if (!state.preferredCameraTargets.has(key)) state.preferredCameraTargets.set(key, current);
    const preferred = state.preferredCameraTargets.get(key) || current;
    let next = current;
    if (allowed.includes(preferred)) {
      next = preferred;
      state.autoFallbackCameraTargets.delete(key);
    } else if (!allowed.includes(current)) {
      next = fallback;
      state.autoFallbackCameraTargets.add(key);
      preferenceChanged = true;
    }
    if (String(widget.value ?? "") !== next) {
      state.programmaticCameraTargetWrites.add(key);
      try { widget.value = next; } finally { state.programmaticCameraTargetWrites.delete(key); }
      changed = true;
    }
  }
  if (preferenceChanged) persistPreferences(node, state);
  return changed;
}

function syncCameraFramingChoices(node, personCount) {
  const fullChoices = ["auto", "face_closeup", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene"];
  let changed = false;
  for (let index = 1; index <= MAX_CAMERA_SHOTS; index++) {
    const widget = widgetByName(node, `camera_shot_${index}_framing`);
    if (!widget) continue;
    const target = canonicalCoreOptionValue(`camera_shot_${index}_target`, widgetByName(node, `camera_shot_${index}_target`)?.value) || "current_action";
    let allowed = fullChoices;
    if (target === "current_action") allowed = ["auto"];
    else if (target === "scene") allowed = ["auto", "wide_scene"];
    else if ((target.match(/\+/g) || []).length >= 1) {
      allowed = ["auto", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene"];
    }

    const previous = Array.isArray(widget?.options?.values) ? widget.options.values : [];
    if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
      widget.options = { ...(widget.options || {}), values: [...allowed] };
      changed = true;
    }

    // Simple A-mode rule, matching Main:
    // non-person targets stay on Auto; returning to a person target starts
    // from Auto instead of restoring an older portrait/body framing.
    let next = canonicalCoreOptionValue(widget.name, widget.value) || "auto";
    if (allowed.length === 1 || !allowed.includes(next)) next = "auto";
    if (String(widget.value ?? "") !== next) {
      widget.value = next;
      changed = true;
    }
  }
  return changed;
}

function normalizeProfileSafetyPolicy(raw) {
  if (!raw || typeof raw !== "object") return null;
  const list = (key) => Array.isArray(raw[key]) ? raw[key].map((value) => String(value)) : [];
  const adultAges = list("adult_ages");
  if (!adultAges.length) return null;
  return {
    adultAges,
    adultOnlyAppearance: list("adult_only_appearance"),
    adultOnlyClothing: list("adult_only_clothing"),
  };
}

function installProfileSafetyNodeData(nodeType, nodeData) {
  if (!nodeType?.prototype || !nodeData || nodeData.name !== NODE_CLASS) return;
  const raw = nodeData?.input?.required?.person_a_age?.[1]?.profile_safety;
  const policy = normalizeProfileSafetyPolicy(raw);
  if (policy) nodeType.prototype.__ultraH3R2VProfileSafetyPolicy = policy;
}

function syncProfileSafety(node, personCount) {
  const policy = node?.__ultraH3R2VProfileSafetyPolicy;
  if (!policy) return false;
  const adultAges = new Set(policy.adultAges || []);
  const blockedBySuffix = {
    appearance_preset: new Set(policy.adultOnlyAppearance || []),
    clothing_preset: new Set(policy.adultOnlyClothing || []),
  };
  const state = nodeState(node);
  let changed = false;
  let preferenceChanged = false;
  for (const slot of ["a", "b", "c"].slice(0, personCount)) {
    const age = canonicalCoreOptionValue(`person_${slot}_age`, widgetByName(node, `person_${slot}_age`)?.value) || "unspecified";
    const isAdult = adultAges.has(age);
    for (const suffix of ["appearance_preset", "clothing_preset"]) {
      const widget = widgetByName(node, `person_${slot}_${suffix}`);
      if (!widget) continue;
      if (!Array.isArray(widget.__ultraR2VBaseValues)) {
        widget.__ultraR2VBaseValues = Array.isArray(widget?.options?.values) ? [...widget.options.values] : [];
      }
      const blocked = blockedBySuffix[suffix];
      const allowed = isAdult
        ? [...widget.__ultraR2VBaseValues]
        : widget.__ultraR2VBaseValues.filter((value) => !blocked.has(String(value)));
      const previous = Array.isArray(widget?.options?.values) ? widget.options.values : [];
      if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
        widget.options = { ...(widget.options || {}), values: allowed };
        changed = true;
      }
      const key = `person_${slot}_${suffix}`;
      const current = canonicalCoreOptionValue(widget.name, widget.value) || "none";
      const fallback = allowed.includes("none") ? "none" : String(allowed[0] ?? current);
      if (!state.preferredProfilePresets.has(key)) state.preferredProfilePresets.set(key, current);
      const preferred = state.preferredProfilePresets.get(key) || current;
      let next = current;
      if (allowed.includes(preferred)) {
        next = preferred;
        state.autoFallbackProfilePresets.delete(key);
      } else if (!allowed.includes(current)) {
        next = fallback;
        state.autoFallbackProfilePresets.add(key);
        preferenceChanged = true;
      }
      if (String(widget.value ?? "") !== next) {
        state.programmaticProfilePresetWrites.add(key);
        try { widget.value = next; } finally { state.programmaticProfilePresetWrites.delete(key); }
        changed = true;
      }
    }
  }
  if (preferenceChanged) persistPreferences(node, state);
  return changed;
}

function r2vActivePersonCountForGroups(node) {
  return Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1) || 0));
}

function r2vActiveTurnCountForGroups(node) {
  return Math.max(1, Math.min(6, Number(widgetByName(node, "turn_count")?.value ?? 1) || 1));
}

function r2vActiveShotCountForGroups(node) {
  if (!Boolean(widgetByName(node, "camera_sequence_enabled")?.value)) return 1;
  return Math.max(2, Math.min(MAX_CAMERA_SHOTS, Number(widgetByName(node, "camera_shot_count")?.value ?? activeCameraShotCount(node)) || 2));
}

function referenceGroupWidgets(node, referenceName) {
  const prefixes = ["role", "subject_group", "dialogue_target", "relationship", "content", "scope", "instruction"];
  return prefixes.map((prefix) => widgetByName(node, `__r2v_${prefix}_${referenceName}`)).filter(Boolean);
}

function referenceGroupSummary(node, input, locale) {
  const meta = exactGroup(String(input?.name || ""));
  if (!meta) return "";
  const kind = meta.kind;
  const current = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
  const roleTable = (ROLE_LABELS[locale] || ROLE_LABELS.en)?.[kind] || {};
  const role = roleTable[current.role] || current.role || "";
  if (roleSupportsSubjectGrouping(kind, current.role)) {
    const groupTable = subjectGroupDisplayTable(locale);
    const subject = groupTable[current.subject_group] || groupTable.auto || "";
    if (subject && subject !== groupTable.auto) return `${role} · ${subject}`;
  }
  return role;
}

function r2vGroupedSections(node) {
  const groups = [
    {
      id: "basic",
      kind: "basic",
      title: { ko: "기본 설정", en: "Basic Settings" },
      children: (target) => [
        "scene_translate",
        translationApiWidget(target),
        widgetByName(target, "__r2v_mode_display"),
        "duration_seconds",
        ...sceneBaselineWidgetNames(),
        "visual_style",
        ...sequentialNarratorWidgetNames().map((name) => widgetByName(target, name)),
        r2vBasicCountMirror(target, "person_count"), r2vBasicCountMirror(target, "turn_count"),
      ],
      branchlessChildren: () => sequentialNarratorWidgetNames(),
      summary: (target, locale) => {
        const duration = normalizeWholeSecondDuration(widgetByName(target, "duration_seconds")?.value, 5, 15);
        const people = r2vActivePersonCountForGroups(target);
        const turns = r2vActiveTurnCountForGroups(target);
        return locale === "ko"
          ? `${duration}초 · 인물 ${people} · 진행 ${turns}`
          : `${duration}s · ${people} person${people === 1 ? "" : "s"} · ${turns} progress`;
      },
      active: true,
    },
    {
      id: "camera",
      kind: "camera",
      title: { ko: "촬영 설정", en: "Camera" },
      children: [
        "camera_motion", "camera_amplitude", "camera_speed", "camera_sequence_enabled", "camera_shot_count",
        "camera_shot_1_target", "camera_shot_1_framing",
        ...Array.from({ length: MAX_CAMERA_SHOTS - 1 }, (_, index) => index + 2).flatMap((shot) => [
          `camera_shot_${shot}_enabled`, `camera_shot_${shot}_start_seconds`, `camera_shot_${shot}_transition`,
          `camera_shot_${shot}_target`, `camera_shot_${shot}_framing`, `camera_shot_${shot}_motion`,
          `camera_shot_${shot}_amplitude`, `camera_shot_${shot}_speed`,
        ]),
      ],
      subgroups: () => Array.from({ length: MAX_CAMERA_SHOTS - 1 }, (_, index) => index + 2).map((shot) => ({
        id: `camera_shot_${shot}_branch`,
        anchor: `camera_shot_${shot}_enabled`,
        children: [
          `camera_shot_${shot}_start_seconds`, `camera_shot_${shot}_transition`, `camera_shot_${shot}_target`,
          `camera_shot_${shot}_framing`, `camera_shot_${shot}_motion`, `camera_shot_${shot}_amplitude`, `camera_shot_${shot}_speed`,
        ],
      })),
      summary: (target, locale) => {
        const shots = r2vActiveShotCountForGroups(target);
        const rawMotion = String(widgetByName(target, "camera_motion")?.value ?? "auto");
        const parts = [locale === "ko" ? `컷 ${shots}` : `${shots} shot${shots === 1 ? "" : "s"}`];
        if (rawMotion !== "auto" && rawMotion !== "none") parts.push(coreOptionLabel(target, "camera_motion", rawMotion));
        return parts.join(" · ");
      },
      active: true,
    },
    {
      id: "sound",
      kind: "sound",
      title: { ko: "사운드", en: "Sound" },
      children: ["soundscape_mode", "sound_hint", "music_mode", "music_hint"],
      summary: (target) => {
        const rawSound = String(widgetByName(target, "soundscape_mode")?.value ?? "auto");
        const rawMusic = String(widgetByName(target, "music_mode")?.value ?? "none");
        const parts = [];
        if (rawSound !== "auto") parts.push(coreOptionLabel(target, "soundscape_mode", rawSound));
        if (rawMusic !== "none") parts.push(coreOptionLabel(target, "music_mode", rawMusic));
        return parts.join(" · ");
      },
      active: true,
    },
  ];

  for (const input of node.inputs || []) {
    const meta = exactGroup(String(input?.name || ""));
    if (!meta) continue;
    const children = referenceGroupWidgets(node, input.name);
    if (!children.length) continue;
    groups.push({
      id: `reference_${input.name}`,
      kind: "reference",
      title: () => inputLabel(meta.kind, meta.index, activeLocale(node)),
      children,
      summary: (target, liveLocale) => referenceGroupSummary(target, input, liveLocale),
      active: true,
    });
  }

  const profileBasicFields = ["gender", "age", "advanced"];
  const profileAdvancedFields = ["appearance_preset", "appearance_desc", "clothing_preset", "clothing_desc", "voice_desc"];
  for (let index = 1; index <= 3; index += 1) {
    const slot = ["a", "b", "c"][index - 1];
    const personKey = slot.toUpperCase();
    groups.push({
      id: `person_${index}`,
      kind: "person",
      title: { ko: `인물 ${index}`, en: `Person ${index}` },
      children: [
        ...profileBasicFields.map((field) => `person_${slot}_${field}`),
        ...extensionWidgetNamesForPerson(personKey),
        ...profileAdvancedFields.map((field) => `person_${slot}_${field}`),
      ],
      subgroups: () => [{
        id: `person_${index}_advanced_branch`,
        anchor: `person_${slot}_advanced`,
        children: [
          ...extensionWidgetNamesForPerson(personKey),
          ...profileAdvancedFields.map((field) => `person_${slot}_${field}`),
        ],
      }],
      // Basic View keeps every active person group; syncCoreVisibility() trims
      // each group to identity essentials instead of hiding Person 2/3 entirely.
      active: (target) => index <= r2vActivePersonCountForGroups(target),
      summary: (target) => {
        const rawGender = String(widgetByName(target, `person_${slot}_gender`)?.value ?? "unspecified");
        const rawAge = String(widgetByName(target, `person_${slot}_age`)?.value ?? "unspecified");
        const parts = [];
        if (rawGender !== "unspecified") parts.push(coreOptionLabel(target, `person_${slot}_gender`, rawGender));
        if (rawAge !== "unspecified") parts.push(coreOptionLabel(target, `person_${slot}_age`, rawAge));
        return parts.join(" · ");
      },
    });
  }

  for (let index = 1; index <= 6; index += 1) {
    groups.push({
      id: `progress_${index}`,
      kind: "progress",
      title: { ko: `진행 ${index}`, en: `Progress ${index}` },
      children: [
        `turn_${index}_speaker`, `turn_${index}_elapsed_seconds`,
        ...turnSceneWidgetNames(index),
        `turn_${index}_action`,
        `turn_${index}_dialogue_text`,
        ...sequentialVocalWidgetNames(index),
        ...TURN_FIELDS.filter((field) => !["speaker", "elapsed_seconds", "action", "dialogue_text"].includes(field)).map((field) => `turn_${index}_${field}`),
      ],
      // Continue Speaking and its Vocal rows are peers of the normal Progress
      // rows. Use the same full top-level inset so native and custom capsules,
      // labels, values, and hit areas share one horizontal grid. Branch ticks
      // stay hidden because the vocal block is not a deeper hierarchy level.
      indentOverrides: () => [{ children: sequentialVocalWidgetNames(index), indent: 8 }],
      branchlessChildren: () => sequentialVocalWidgetNames(index),
      // Basic View keeps every active progress group and hides only fine controls.
      active: (target) => index <= r2vActiveTurnCountForGroups(target),
      summary: (target, locale) => {
        const speaker = coreOptionLabel(target, `turn_${index}_speaker`, widgetByName(target, `turn_${index}_speaker`)?.value ?? "A");
        const seconds = Number(widgetByName(target, `turn_${index}_elapsed_seconds`)?.value ?? 0) || 0;
        return locale === "ko" ? `${speaker} · ${seconds.toFixed(1)}초` : `${speaker} · ${seconds.toFixed(1)}s`;
      },
    });
  }
  return groups;
}

function installR2VGroupedSections(node) {
  if (!GROUPED_SECTIONS_INSTALLED.has(node)) {
    return withBatchedWidgetMutations(node, () => installR2VGroupedSectionsNow(node));
  }
  return installR2VGroupedSectionsNow(node);
}

function installR2VGroupedSectionsNow(node) {
  for (const widget of node?.widgets || []) {
    try { widget.__ultraGroupedNode = node; } catch (_) {}
  }
  if (GROUPED_SECTIONS_INSTALLED.has(node)) return;
  GROUPED_SECTIONS_INSTALLED.add(node);
  configureGroupedSections(node, {
    locale: activeLocale,
    groups: r2vGroupedSections,
    resync: (target) => syncCoreVisibility(target, { preserveSceneHeight: true }),
    refreshMetadata: refreshVueWidgetMetadata,
    markUiOnly,
  });
}

// Lazily materialized rows (extension options, sequential-vocal rows) and
// layout reordering each commit their own widget batch. Wrap the whole
// visibility transaction so one interaction re-registers the widget array
// at most once on frontend 1.53 (nested batches just run their callback).
function syncCoreVisibility(node, options = {}) {
  return withBatchedWidgetMutations(node, () => syncCoreVisibilityUnbatched(node, options));
}

function syncCoreVisibilityUnbatched(node, { preserveSceneHeight: preserve = false } = {}) {
  if (!node || node.comfyClass !== NODE_CLASS) return;

  installR2VGroupedSections(node);
  // Materialize only the active lazy vocal rows before grouped sections scan
  // their children, so a newly enabled row is indented correctly immediately.
  withBatchedWidgetMutations(node, () => refreshSequentialVocalLabels(node, {
    turnCount: Number(widgetByName(node, "turn_count")?.value ?? 1),
  }));
  refreshGroupedSections(node, { redraw: false });

  const apply = () => {
    const personCount = Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1)));
    const turnCount = Math.max(1, Math.min(6, Number(widgetByName(node, "turn_count")?.value ?? 1)));
    const cameraEnabled = Boolean(widgetByName(node, "camera_sequence_enabled")?.value);
    const basic = basicViewEnabled(node);
    // Timeline is independent from cast size. The default R2V node starts with
    // Person 1 + Turn 1, while person_count=0 remains available for environment,
    // product, object, or Narrator workflows. Keep the Timeline count visible in
    // either case so UI state matches the backend turn_count contract.
    const timelineVisible = true;
    let changed = false;
    const show = (widget, visible, { preserveLinkedWhenHidden = false } = {}) => {
      const finalVisible = visibleOrLinked(node, widget, visible, preserveLinkedWhenHidden);
      changed = setWidgetVisible(widget, finalVisible) || changed;
    };

    installLocalizedComboDisplay(node);
    const locale = activeLocale(node);
    const state = nodeState(node);
    if (state.lastStaticUiLocale !== locale) {
      refreshTranslationApiUi(node, { locale });
      refreshExtensionOptions(node, { locale });
      refreshCameraFramingLabels(node);
      state.lastStaticUiLocale = locale;
    }
    const extensionPersonCapacity = r2vActivePersonCountForGroups(node);
    const extensionTurnCapacity = r2vActiveTurnCountForGroups(node);
    if (extensionPersonCapacity > Number(state.extensionPersonCapacity || 0)
      || extensionTurnCapacity > Number(state.extensionTurnCapacity || 0)) {
      withBatchedWidgetMutations(node, () => installExtensionOptions(node, {
        locale: activeLocale,
        refreshMetadata: refreshVueWidgetMetadata,
      }));
      state.extensionPersonCapacity = Math.max(Number(state.extensionPersonCapacity || 0), extensionPersonCapacity);
      state.extensionTurnCapacity = Math.max(Number(state.extensionTurnCapacity || 0), extensionTurnCapacity);
    }
    changed = syncTurnSpeakerChoices(node, personCount) || changed;
    changed = syncCameraTargetChoices(node, personCount) || changed;
    changed = syncCameraFramingChoices(node, personCount) || changed;
    changed = syncProfileSafety(node, personCount) || changed;

    for (const name of [
      "scene_prompt", "scene_translate", "__r2v_mode_display", "duration_seconds", "visual_style",
      "camera_motion", "camera_shot_1_target", "camera_shot_1_framing",
    ]) show(widgetByName(node, name), true);
    const translationEnabled = canonicalCoreOptionValue("scene_translate", widgetByName(node, "scene_translate")?.value) !== "off";
    show(translationApiWidget(node), translationEnabled);
    for (const name of sceneBaselineWidgetNames()) show(widgetByName(node, name), true);
    const [narratorPresetWidgetName, narratorDescWidgetName] = sequentialNarratorWidgetNames();
    show(widgetByName(node, narratorPresetWidgetName), true);
    show(widgetByName(node, narratorDescWidgetName), sequentialNarratorUsesCustom(node), { preserveLinkedWhenHidden: true });

    show(widgetByName(node, "person_count"), false);
    show(widgetByName(node, "turn_count"), false);
    show(r2vBasicCountMirror(node, "person_count"), true);
    show(r2vBasicCountMirror(node, "turn_count"), timelineVisible);
    // Keep the two high-impact sound modes in Basic View. If a custom-only mode
    // is selected, its required text field is revealed below instead of forcing
    // the user to hunt for it in Full View.
    show(widgetByName(node, "soundscape_mode"), true, { preserveLinkedWhenHidden: true });
    show(widgetByName(node, "music_mode"), true, { preserveLinkedWhenHidden: true });
    // Camera amplitude/speed are fine controls. Basic View still allows the
    // multi-shot structure to expand progressively with core Shot timing/target/
    // framing; Full View adds transition and per-shot motion tuning.
    show(widgetByName(node, "camera_amplitude"), !basic, { preserveLinkedWhenHidden: true });
    show(widgetByName(node, "camera_speed"), !basic, { preserveLinkedWhenHidden: true });

    const personLetters = ["a", "b", "c"];
    for (let idx = 0; idx < personLetters.length; idx++) {
      const person = personLetters[idx];
      const exists = idx + 1 <= personCount;
      const genderWidget = widgetByName(node, `person_${person}_gender`);
      const ageWidget = widgetByName(node, `person_${person}_age`);
      show(genderWidget, exists, { preserveLinkedWhenHidden: exists });
      show(ageWidget, exists, { preserveLinkedWhenHidden: exists });
      const advancedToggle = widgetByName(node, `person_${person}_advanced`);
      // Match Main: Basic View shows the collapsed disclosure row itself, but
      // no advanced child is exposed until Full View is entered and expanded.
      show(advancedToggle, exists, { preserveLinkedWhenHidden: exists });
      const expanded = Boolean(advancedToggle?.value);
      for (const extensionName of extensionWidgetNamesForPerson(person.toUpperCase())) {
        show(widgetByName(node, extensionName), exists && !basic && expanded, { preserveLinkedWhenHidden: exists });
      }
      for (const suffix of ["appearance_preset", "appearance_desc", "clothing_preset", "clothing_desc", "voice_desc"]) {
        show(widgetByName(node, `person_${person}_${suffix}`), exists && expanded && !basic, { preserveLinkedWhenHidden: exists });
      }
    }

    // Continue Speaking keeps speaker/language/delivery as UI-only state. Only
    // the normal Core STRING text rows (Narrator direct + Vocal 2/3 dialogue)
    // are added, while the original recovery Core fields retain their relative
    // order and Vue/Core remain responsible for real widget geometry.
    for (let i = 1; i <= 6; i++) {
      const visible = timelineVisible && i <= turnCount;
      const sequential = sequentialVocalEnabled(node, i);
      const speaker = widgetByName(node, `turn_${i}_speaker`);
      const language = widgetByName(node, `turn_${i}_dialogue_language`);
      const delivery = widgetByName(node, `turn_${i}_dialogue_delivery`);
      const turnIsNarrator = String(speaker?.value ?? "") === "Narrator" || personCount === 0;
      show(speaker, visible && personCount > 0, { preserveLinkedWhenHidden: i <= turnCount });
      show(widgetByName(node, `turn_${i}_elapsed_seconds`), visible, { preserveLinkedWhenHidden: i <= turnCount });
      show(widgetByName(node, `turn_${i}_action`), visible, { preserveLinkedWhenHidden: i <= turnCount });
      show(widgetByName(node, `turn_${i}_dialogue_text`), visible, { preserveLinkedWhenHidden: i <= turnCount });
      show(language, visible && !sequential && !basic, { preserveLinkedWhenHidden: i <= turnCount });
      show(delivery, visible && !sequential && !basic && !turnIsNarrator, { preserveLinkedWhenHidden: i <= turnCount });
      for (const seqName of sequentialVocalWidgetNames(i)) {
        const isToggle = String(seqName).startsWith("__ultra_seq_vocal_toggle_");
        show(widgetByName(node, seqName), visible && (isToggle || sequential), { preserveLinkedWhenHidden: i <= turnCount });
      }
      for (const name of turnSceneWidgetNames(i)) {
        show(widgetByName(node, name), visible && !basic, { preserveLinkedWhenHidden: visible && basic });
      }
    }

    // The master multi-shot switch is a structural choice and remains reachable
    // in Basic View. Each active Shot reveals its core rows and the next Shot
    // ON/OFF control; disabling a Shot collapses that point and later Shot rows.
    show(widgetByName(node, "camera_sequence_enabled"), timelineVisible, { preserveLinkedWhenHidden: true });
    show(widgetByName(node, "camera_shot_count"), false);
    show(widgetByName(node, "camera_shot_1_target"), true);
    // Keep framing rows present so target changes do not resize the node.
    // Non-person targets expose Auto only; person targets expose body framing.
    show(widgetByName(node, "camera_shot_1_framing"), true);
    let previousEnabled = cameraEnabled;
    for (let i = 2; i <= MAX_CAMERA_SHOTS; i++) {
      const enabledWidget = widgetByName(node, `camera_shot_${i}_enabled`);
      const enabled = previousEnabled && Boolean(enabledWidget?.value ?? (i === 2));
      const toggleVisible = cameraEnabled && previousEnabled;
      show(enabledWidget, toggleVisible, { preserveLinkedWhenHidden: previousEnabled && !toggleVisible });
      const detailsVisible = toggleVisible && enabled;
      show(widgetByName(node, `camera_shot_${i}_start_seconds`), detailsVisible, { preserveLinkedWhenHidden: enabled && !detailsVisible });
      show(widgetByName(node, `camera_shot_${i}_target`), detailsVisible, { preserveLinkedWhenHidden: enabled && !detailsVisible });
      show(widgetByName(node, `camera_shot_${i}_framing`), detailsVisible, { preserveLinkedWhenHidden: enabled && !detailsVisible });
      const fineDetailsVisible = detailsVisible && !basic;
      for (const suffix of ["transition", "motion", "amplitude", "speed"]) {
        show(widgetByName(node, `camera_shot_${i}_${suffix}`), fineDetailsVisible, { preserveLinkedWhenHidden: enabled && !fineDetailsVisible });
      }
      previousEnabled = enabled;
    }

    changed = syncReferenceUiVisibility(node, basic) || changed;
    const soundscapeMode = canonicalCoreOptionValue("soundscape_mode", widgetByName(node, "soundscape_mode")?.value) || "auto";
    const musicMode = canonicalCoreOptionValue("music_mode", widgetByName(node, "music_mode")?.value) || "none";
    show(widgetByName(node, "sound_hint"), !basic || soundscapeMode === "custom_only", { preserveLinkedWhenHidden: true });
    show(widgetByName(node, "music_hint"), !basic || musicMode === "custom", { preserveLinkedWhenHidden: true });
    show(widgetByName(node, "reference_plan_json"), false);
    changed = syncBounds(node) || changed;
    ensureViewToggle(node);
    organizeWidgetLayout(node);
    refreshActionControls(node);

    // [Regression guard: Vue ghost line] Commit node.widgets metadata only
    // after this visibility/bounds/layout transaction has fully settled. Do not
    // re-add refreshVueWidgetMetadata() inside syncBounds()/Shot-bound helpers or
    // add a delayed second full visibility/layout pass. If the ghost line ever
    // returns, inspect duplicate metadata/layout commits first; do NOT start by
    // adding arrange(), forced slot reflow, or extra dirty-canvas calls.
    if (changed) refreshVueWidgetMetadata(node);
    refreshGroupedSections(node, { redraw: false });
    node.setDirtyCanvas?.(true, true);
    return changed;
  };

  if (preserve) return runScenePreservingLayoutChange(node, apply);
  const changed = apply();
  if (changed && !isVueNodesEnabled() && typeof node.arrange === "function") {
    try { node.arrange(); } catch (_) {}
  }
  return changed;
}

function exactGroup(name) {
  let m = /^ref_image_(\d+)$/.exec(name);
  if (m) return { group: "image", index: Number(m[1]), kind: "image" };
  m = /^ref_video_(\d+)$/.exec(name);
  if (m) return { group: "video", index: Number(m[1]), kind: "video" };
  m = /^ref_video_audio_(\d+)$/.exec(name);
  if (m) return { group: "video", index: Number(m[1]), kind: "video_audio" };
  m = /^ref_audio_(\d+)$/.exec(name);
  if (m) return { group: "audio", index: Number(m[1]), kind: "audio" };
  return null;
}

function inputType(kind) {
  if (kind === "video_audio" || kind === "audio") return "AUDIO";
  if (kind === "video") return "VIDEO";
  return "IMAGE";
}

function inputLabel(kind, index, locale) {
  const n = index + 1;
  const ko = locale === "ko";
  const physicalKind = kind === "video_audio" ? "video" : kind;
  const base = kind === "image" ? (ko ? `이미지 참조 ${n}` : `Picture ${n}`)
    : kind === "video" ? (ko ? `영상 참조 ${n}` : `Video ${n}`)
    : kind === "video_audio" ? (ko ? `영상 참조 ${n} 오디오` : `Video ${n} Audio`)
    : (ko ? `오디오 참조 ${n}` : `Audio ${n}`);
  const physicalMax = PHYSICAL_SOURCE_MAX[physicalKind] ?? Infinity;
  if (n <= physicalMax) return base;
  return ko
    ? `${base} · 기존 소스 역할 재사용 전용`
    : `${base} · reuse existing source for another role`;
}

function readPlan(node) {
  const widget = widgetByName(node, "reference_plan_json");
  try {
    const parsed = JSON.parse(String(widget?.value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writePlan(node, plan) {
  const widget = widgetByName(node, "reference_plan_json");
  if (!widget) return;
  widget.value = JSON.stringify(plan);
}

function readDetachedPlan(node) {
  const raw = node?.properties?.[DETACHED_REFERENCE_PLAN_PROPERTY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  try { return JSON.parse(JSON.stringify(raw)); } catch (_) { return {}; }
}

function writeDetachedPlan(node, plan) {
  node.properties ??= {};
  if (!plan || typeof plan !== "object" || !Object.keys(plan).length) {
    delete node.properties[DETACHED_REFERENCE_PLAN_PROPERTY];
    return;
  }
  try {
    node.properties[DETACHED_REFERENCE_PLAN_PROPERTY] = JSON.parse(JSON.stringify(plan));
  } catch (_) {
    node.properties[DETACHED_REFERENCE_PLAN_PROPERTY] = { ...plan };
  }
}

function attachPlanToInputs(node) {
  const plan = readPlan(node);
  const detached = readDetachedPlan(node);
  for (const input of node.inputs || []) {
    if (!exactGroup(input?.name || "")) continue;
    if (plan[input.name]) input.__ultraR2VPlan = { ...plan[input.name] };
    else if (detached[input.name]) input.__ultraR2VPlan = { ...detached[input.name] };
    else input.__ultraR2VPlan = null;
  }
}

function snapshotPlanFromInputs(node) {
  const plan = {};
  const detached = readDetachedPlan(node);
  for (const input of node.inputs || []) {
    if (!exactGroup(input?.name || "") || !input.__ultraR2VPlan) continue;
    plan[input.name] = { ...input.__ultraR2VPlan };
    delete detached[input.name];
  }
  writePlan(node, plan);
  writeDetachedPlan(node, detached);
  return plan;
}

function clearReferenceStateForConfirmedReset(node) {
  // Settings Reset is a fresh-default operation, not a temporary UI collapse.
  // Connected physical references stay connected, but their prior semantic
  // role/scope/content/instruction plan must not be re-imported by the dynamic
  // Reference UI during the reset rebuild. Remove the UI mirrors first so the
  // normal flush step can only rebuild canonical defaults from an empty plan.
  removeReferenceUi(node);
  for (const input of node.inputs || []) {
    if (!exactGroup(input?.name || "")) continue;
    input.__ultraR2VPlan = null;
  }
  const defaults = {};
  for (const input of connectedReferenceInputs(node)) {
    const kind = roleKind(input.name);
    const fresh = migrateReferencePlanEntry(null, kind);
    input.__ultraR2VPlan = { ...fresh };
    defaults[input.name] = { ...fresh };
  }
  writePlan(node, defaults);
  writeDetachedPlan(node, {});
}

function applyConfirmedResetReferenceDefaults(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return;
  // Reset semantic state from the physical Reference links only. Never reuse a
  // detached or pre-reset plan here: Settings Reset must be deterministic.
  const defaults = {};
  for (const input of node.inputs || []) {
    if (!exactGroup(input?.name || "") || input.link == null) continue;
    const fresh = migrateReferencePlanEntry(null, roleKind(input.name));
    input.__ultraR2VPlan = { ...fresh };
    defaults[input.name] = { ...fresh };
  }
  writeDetachedPlan(node, {});
  writePlan(node, defaults);

  // Push the defaults into the already-created UI as well. Nodes 2.0 can retain
  // a combo's visual value for one layout pass even after the backing plan was
  // replaced, so update both model and visible widgets explicitly.
  for (const input of connectedReferenceInputs(node)) {
    refreshReferenceUiSemanticRow(node, input, { snapshot: false });
  }
  snapshotPlanFromInputs(node);
}

function removeInputObject(node, input) {
  if (exactGroup(input?.name || "") && input?.__ultraR2VPlan) {
    const detached = readDetachedPlan(node);
    detached[input.name] = { ...input.__ultraR2VPlan };
    writeDetachedPlan(node, detached);
  }
  const index = (node.inputs || []).indexOf(input);
  if (index >= 0) node.removeInput(index);
}

function captureReferenceIdentityPlan(node, input) {
  if (!input || !exactGroup(input?.name || "")) return null;
  const serialized = readPlan(node);
  const detached = readDetachedPlan(node);
  const source = input.__ultraR2VPlan || serialized[input.name] || detached[input.name] || null;
  const normalized = migrateReferencePlanEntry(source, roleKind(input.name));
  try { return JSON.parse(JSON.stringify(normalized)); } catch (_) { return { ...normalized }; }
}

function restoreDetachedPlanToInput(node, input) {
  if (!exactGroup(input?.name || "") || input?.__ultraR2VPlan) return;
  const detached = readDetachedPlan(node);
  if (detached[input.name]) input.__ultraR2VPlan = { ...detached[input.name] };
}

function applyReferenceIdentityRename(node, input, identity, nextName, kind, index) {
  if (!input || !identity) return;
  input.name = nextName;
  input.type = inputType(kind);
  input.label = inputLabel(kind, index, activeLocale(node));
  input.__ultraR2VPlan = identity.plan ? { ...identity.plan } : null;
}

function normalizeSimpleGroup(node, kind, maxCount) {
  const prefix = kind === "image" ? "ref_image_" : "ref_audio_";
  let slots = (node.inputs || []).filter((input) => exactGroup(input?.name || "")?.kind === kind);
  slots.sort((a, b) => exactGroup(a.name).index - exactGroup(b.name).index);
  const used = slots.filter((slot) => slot.link != null);
  const keep = used.length ? [...used] : slots.length ? [slots[0]] : [];
  const identities = new Map(keep.map((slot) => [slot, {
    name: slot.name,
    plan: captureReferenceIdentityPlan(node, slot),
  }]));
  for (const slot of slots) if (!keep.includes(slot)) removeInputObject(node, slot);
  slots = keep;
  slots.forEach((slot, index) => {
    applyReferenceIdentityRename(node, slot, identities.get(slot), `${prefix}${index}`, kind, index);
  });
  if (!slots.length) {
    const created = node.addInput(`${prefix}0`, inputType(kind));
    restoreDetachedPlanToInput(node, created);
    slots = [created];
  }
  const last = slots[slots.length - 1];
  if (last?.link != null && slots.length < maxCount) {
    const index = slots.length;
    const created = node.addInput(`${prefix}${index}`, inputType(kind));
    created.label = inputLabel(kind, index, activeLocale(node));
    restoreDetachedPlanToInput(node, created);
  }
}

function normalizeVideoPairs(node) {
  const pairs = [];
  for (let i = 0; i < MAX_ROLE_LINKS.video; i++) {
    const video = (node.inputs || []).find((input) => input.name === `ref_video_${i}`);
    const audio = (node.inputs || []).find((input) => input.name === `ref_video_audio_${i}`);
    if (video || audio) pairs.push({ video, audio });
  }
  const usedPairs = pairs.filter((pair) => pair.video?.link != null || pair.audio?.link != null);
  let keep = usedPairs.length ? usedPairs : pairs.length ? [pairs[0]] : [];
  const identities = new Map();
  for (const pair of keep) {
    if (pair.video) identities.set(pair.video, { plan: captureReferenceIdentityPlan(node, pair.video) });
    if (pair.audio) identities.set(pair.audio, { plan: captureReferenceIdentityPlan(node, pair.audio) });
  }
  for (const pair of pairs) {
    if (keep.includes(pair)) continue;
    if (pair.audio) removeInputObject(node, pair.audio);
    if (pair.video) removeInputObject(node, pair.video);
  }
  if (!keep.length) {
    keep = [{
      video: node.addInput("ref_video_0", inputType("video")),
      audio: node.addInput("ref_video_audio_0", inputType("video_audio")),
    }];
  }
  keep.forEach((pair, index) => {
    if (pair.video) applyReferenceIdentityRename(node, pair.video, identities.get(pair.video) || { plan: null }, `ref_video_${index}`, "video", index);
    if (pair.audio) applyReferenceIdentityRename(node, pair.audio, identities.get(pair.audio) || { plan: null }, `ref_video_audio_${index}`, "video_audio", index);
  });
  const last = keep[keep.length - 1];
  if (last?.video?.link != null && keep.length < MAX_ROLE_LINKS.video) {
    const index = keep.length;
    const video = node.addInput(`ref_video_${index}`, inputType("video"));
    const audio = node.addInput(`ref_video_audio_${index}`, inputType("video_audio"));
    video.label = inputLabel("video", index, activeLocale(node));
    audio.label = inputLabel("video_audio", index, activeLocale(node));
    restoreDetachedPlanToInput(node, video);
    restoreDetachedPlanToInput(node, audio);
  }
}

function referenceInputSortKey(input, fallbackIndex) {
  const meta = exactGroup(input?.name || "");
  if (!meta) return [3, fallbackIndex, 0];
  if (meta.kind === "image") return [0, meta.index, 0];
  if (meta.kind === "video") return [1, meta.index, 0];
  if (meta.kind === "video_audio") return [1, meta.index, 1];
  return [2, meta.index, 0];
}

function reorderReferenceInputs(node) {
  const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
  if (inputs.length < 2) return false;
  const original = [...inputs];
  const originalIndex = new Map(original.map((input, index) => [input, index]));
  const ordered = [...original].sort((left, right) => {
    const a = referenceInputSortKey(left, originalIndex.get(left));
    const b = referenceInputSortKey(right, originalIndex.get(right));
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  });
  if (ordered.every((input, index) => input === original[index])) return false;

  const liveLinks = new Map();
  if (node.graph && typeof node.getInputLink === "function") {
    for (let index = 0; index < original.length; index += 1) {
      let link = null;
      try { link = node.getInputLink(index); } catch (_) {}
      if (link) liveLinks.set(original[index], link);
    }
  }
  const floating = [];
  try {
    for (const link of node.graph?.floatingLinks?.values?.() || []) {
      if (link?.target_id === node.id && Number.isInteger(link.target_slot)) {
        const input = original[link.target_slot];
        if (input) floating.push([input, link]);
      }
    }
  } catch (_) {}

  const moved = [];
  const temporaryBase = original.length + 1024;
  try {
    let temporaryOffset = 0;
    for (const [input, link] of liveLinks) {
      const temporarySlot = temporaryBase + temporaryOffset++;
      link.target_slot = temporarySlot;
      if (link.target_slot !== temporarySlot) throw new Error("temporary target-slot update was rejected");
      moved.push([input, link]);
    }
    inputs.splice(0, inputs.length, ...ordered);
    try { node._setConcreteSlots?.(); } catch (_) {}
    const finalIndex = new Map(ordered.map((input, index) => [input, index]));
    for (const [input, link] of moved) {
      const slot = finalIndex.get(input);
      link.target_slot = slot;
      if (link.target_slot !== slot) throw new Error("final target-slot update was rejected");
    }
    for (const [input, link] of floating) link.target_slot = finalIndex.get(input);
    return true;
  } catch (error) {
    inputs.splice(0, inputs.length, ...original);
    try { node._setConcreteSlots?.(); } catch (_) {}
    // Vacate any partially assigned final slots before restoring the original
    // permutation, for the same collision reason as the forward move.
    let rollbackOffset = 0;
    for (const [, link] of moved) {
      try { link.target_slot = temporaryBase + original.length + rollbackOffset++; } catch (_) {}
    }
    for (const [input, link] of moved) {
      try { link.target_slot = originalIndex.get(input); } catch (_) {}
    }
    console.error("[Ultra H3 R2V] Reference input reorder aborted safely", error);
    return false;
  }
}

function connectedReferenceInputs(node) {
  return (node.inputs || []).filter((input) => exactGroup(input?.name || "") && input.link != null);
}

function roleKind(inputName) {
  if (/^ref_image_/.test(inputName)) return "image";
  if (/^ref_video_audio_/.test(inputName) || /^ref_audio_/.test(inputName)) return "audio";
  return "video";
}

function defaultRole(kind) {
  return "general_reference";
}

function referencePersonCount(node) {
  return Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1)));
}

function activeReferenceShotCount(node) {
  return activeCameraShotCount(node);
}

function availableRolesFor(kind, personCount) {
  return Object.keys(ROLE_LABELS.en[kind]).filter((role) => {
    if (/^person_a_/.test(role)) return personCount >= 1;
    if (/^person_b_/.test(role)) return personCount >= 2;
    if (/^person_c_/.test(role)) return personCount >= 3;
    if (role === "narrator_voice") return true;
    return true;
  });
}

function availableScopesFor(node) {
  const count = activeReferenceShotCount(node);
  const values = ["auto", "all_shots", ...Array.from({ length: count }, (_, index) => `shot_${index + 1}`)];
  // The official Ref2VA format explicitly allows a reference subject to appear
  // in a non-contiguous subset such as [Shot 1] and [Shot 3]. Keep one compact
  // selector rather than adding a row of per-shot checkboxes. `all_shots` is the
  // full-set choice; add only proper multi-shot subsets here.
  const maxMask = (1 << count) - 1;
  for (let mask = 1; mask < maxMask; mask++) {
    const shots = [];
    for (let index = 0; index < count; index++) if (mask & (1 << index)) shots.push(index + 1);
    if (shots.length >= 2) values.push(`shots_${shots.join("_")}`);
  }
  return values;
}

function allowedRelationshipsFor(kind, role) {
  if (kind === "audio") {
    if (role === "full_audio_reuse") return ["auto", "fully_copy"];
    if (role === "partial_audio_reuse") return ["auto", "partially_copy"];
    return ["auto", "reference", "weak_reference"];
  }
  if (["first_frame_anchor", "keyframe_anchor", "last_frame_anchor", "composition_anchor"].includes(role)) {
    return ["auto", "fully_preserved"];
  }
  if (role === "edited_keyframe_anchor") return ["auto", "partially_preserved"];
  if (["storyboard", "style_reference", "camera_motion", "cuts_rhythm", "general_reference", "custom"].includes(role)) {
    return ["auto", "fully_preserved", "partially_preserved", "weak_reference"];
  }
  if (role === "video_edit_source") return ["auto", "fully_preserved", "partially_preserved"];
  if (["video_continuation_source", "scene_environment", "animal_nonhuman_subject", "object_prop", "visual_effect", "interface_visible_text"].includes(role)) {
    return ["auto", "fully_preserved", "partially_preserved", "weak_reference"];
  }
  if (/^person_[abc]_/.test(role)) {
    return ["auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
  }
  return ["auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
}

function roleNeedsScope(kind, role) {
  if (kind === "image") return !["first_frame_anchor", "last_frame_anchor"].includes(role);
  if (kind === "video") return !["video_edit_source", "video_continuation_source"].includes(role);
  // Voice references bind to actual speaker events, music style is a global
  // score layer, and full-audio reuse is the complete final signal. Their
  // timing is therefore already determined without an extra shot selector.
  return !["person_a_voice", "person_b_voice", "person_c_voice", "narrator_voice", "music_style", "full_audio_reuse"].includes(role);
}

function scopeDisplayTable(locale) {
  const ko = locale === "ko";
  const table = {
    auto: ko ? "참고 요소에 맞게 자동" : "Auto by reference focus",
    all_shots: ko ? "모든 Shot" : "All shots",
  };
  for (let shot = 1; shot <= MAX_CAMERA_SHOTS; shot++) table[`shot_${shot}`] = `Shot ${shot}`;
  const fullMask = (1 << MAX_CAMERA_SHOTS) - 1;
  for (let mask = 1; mask < fullMask; mask++) {
    const shots = [];
    for (let index = 0; index < MAX_CAMERA_SHOTS; index++) if (mask & (1 << index)) shots.push(index + 1);
    if (shots.length < 2) continue;
    const value = `shots_${shots.join("_")}`;
    table[value] = shots.map((shot) => `Shot ${shot}`).join(" + ");
  }
  return table;
}

function relationshipDisplayTable(locale) {
  return RELATIONSHIP_LABELS[locale] || RELATIONSHIP_LABELS.en;
}

function resolveChoiceFromWidgetValue(rawValue, canonicalValues, displayTable, fallback = "auto") {
  const canonical = Array.isArray(canonicalValues) ? canonicalValues.map((value) => String(value)) : [];
  if (!canonical.length) return fallback;
  if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
    return canonical[rawValue] ?? fallback;
  }
  const text = String(rawValue ?? "").trim();
  if (!text) return fallback;
  if (canonical.includes(text)) return text;
  if (/^\d+$/.test(text)) {
    const index = Number(text);
    if (Number.isInteger(index)) return canonical[index] ?? fallback;
  }
  const tables = Array.isArray(displayTable) ? displayTable : [displayTable];
  for (const table of tables) {
    if (!table || typeof table !== "object") continue;
    const reverse = Object.fromEntries(Object.entries(table).map(([key, value]) => [String(value), key]));
    if (reverse[text] && canonical.includes(reverse[text])) return reverse[text];
  }
  return fallback;
}

function flushReferenceUiToPlan(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return {};
  const locale = activeLocale(node);
  const alternateLocale = locale === "ko" ? "en" : "ko";
  const roleLabels = ROLE_LABELS[locale] || ROLE_LABELS.en;
  const alternateRoleLabels = ROLE_LABELS[alternateLocale] || ROLE_LABELS.en;
  const relationshipTable = relationshipDisplayTable(locale);
  const relationshipTables = [relationshipTable, relationshipDisplayTable(alternateLocale)];
  const scopeTable = scopeDisplayTable(locale);
  const scopeTables = [scopeTable, scopeDisplayTable(alternateLocale)];
  const plan = readPlan(node);
  for (const input of connectedReferenceInputs(node)) {
    const kind = roleKind(input.name);
    const current = migrateReferencePlanEntry(plan[input.name] || input.__ultraR2VPlan, kind);
    const roleChoices = Object.keys(ROLE_LABELS.en[kind]);
    const roleWidget = widgetByName(node, `__r2v_role_${input.name}`);
    current.role = resolveChoiceFromWidgetValue(roleWidget?.value ?? current.role, roleChoices, [roleLabels[kind], alternateRoleLabels[kind]], defaultRole(kind));

    const relationshipChoices = allowedRelationshipsFor(kind, current.role);
    const allRelationshipChoices = kind === "audio"
      ? ["auto", "fully_copy", "partially_copy", "reference", "weak_reference"]
      : ["auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
    const relationshipWidget = widgetByName(node, `__r2v_relationship_${input.name}`);
    const visualRelationship = resolveChoiceFromWidgetValue(
      relationshipWidget?.value ?? current._preferred_relationship ?? current.relationship,
      allRelationshipChoices,
      relationshipTables,
      "auto",
    );

    // A role switch may temporarily make the user's selected application method
    // invalid. Treat that as an execution fallback only: never erase the user's
    // previous explicit choice just because the current role needs Auto. When the
    // original role (or another compatible role) returns, restore it.
    if (current._relationship_auto_fallback && current._preferred_relationship) {
      if (relationshipChoices.includes(current._preferred_relationship)) {
        current.relationship = current._preferred_relationship;
        delete current._preferred_relationship;
        delete current._relationship_auto_fallback;
      } else {
        if (visualRelationship !== "auto") current._preferred_relationship = visualRelationship;
        current.relationship = "auto";
      }
    } else if (relationshipChoices.includes(visualRelationship)) {
      current.relationship = visualRelationship;
    } else {
      current.relationship = "auto";
      if (visualRelationship !== "auto") {
        current._preferred_relationship = visualRelationship;
        current._relationship_auto_fallback = true;
      }
    }

    {
      const groupTable = subjectGroupDisplayTable(locale);
      const groupChoices = Object.keys(groupTable);
      const groupWidget = widgetByName(node, `__r2v_subject_group_${input.name}`);
      const visualGroup = resolveChoiceFromWidgetValue(
        groupWidget?.value ?? current._preferred_subject_group ?? current.subject_group,
        groupChoices,
        [groupTable, subjectGroupDisplayTable(alternateLocale)],
        "auto",
      );
      if (roleSupportsSubjectGrouping(kind, current.role)) {
        current.subject_group = visualGroup;
        delete current._preferred_subject_group;
        delete current._subject_group_auto_fallback;
      } else {
        current.subject_group = "auto";
        if (visualGroup !== "auto") {
          current._preferred_subject_group = visualGroup;
          current._subject_group_auto_fallback = true;
        } else {
          delete current._preferred_subject_group;
          delete current._subject_group_auto_fallback;
        }
      }
    }

    if (kind === "audio") {
      const targetChoices = Object.keys(dialogueTargetDisplayTable("en", 3));
      const targetWidget = widgetByName(node, `__r2v_dialogue_target_${input.name}`);
      const visualTarget = resolveChoiceFromWidgetValue(
        targetWidget?.value ?? current._preferred_dialogue_target ?? current.dialogue_target,
        targetChoices,
        [dialogueTargetDisplayTable(locale, 3), dialogueTargetDisplayTable(alternateLocale, 3)],
        "auto",
      );
      if (current.role === "dialogue_content") {
        current.dialogue_target = visualTarget;
        delete current._preferred_dialogue_target;
        delete current._dialogue_target_auto_fallback;
      } else {
        current.dialogue_target = "auto";
        if (visualTarget !== "auto") {
          current._preferred_dialogue_target = visualTarget;
          current._dialogue_target_auto_fallback = true;
        } else {
          delete current._preferred_dialogue_target;
          delete current._dialogue_target_auto_fallback;
        }
      }
    }

    {
      const scopeChoices = Object.keys(scopeDisplayTable("en"));
      const scopeWidget = widgetByName(node, `__r2v_scope_${input.name}`);
      const visualScope = resolveChoiceFromWidgetValue(
        scopeWidget?.value ?? current._preferred_scope ?? current.scope,
        scopeChoices,
        scopeTables,
        "auto",
      );
      if (roleNeedsScope(kind, current.role)) {
        current.scope = visualScope;
        delete current._preferred_scope;
        delete current._scope_auto_fallback;
      } else {
        current.scope = "auto";
        if (visualScope !== "auto") {
          current._preferred_scope = visualScope;
          current._scope_auto_fallback = true;
        } else {
          delete current._preferred_scope;
          delete current._scope_auto_fallback;
        }
      }
    }

    const contentWidget = widgetByName(node, `__r2v_content_${input.name}`);
    if (contentWidget) current.content = String(contentWidget.value || "");
    const instructionWidget = widgetByName(node, `__r2v_instruction_${input.name}`);
    if (instructionWidget) current.instruction = String(instructionWidget.value || "");
    input.__ultraR2VPlan = { ...current };
    plan[input.name] = { ...current };
  }
  writePlan(node, plan);
  return plan;
}

function migrateReferencePlanEntry(raw, kind) {
  const entry = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const legacyNote = String(entry.note || "");
  const migrated = {
    role: String(entry.role || defaultRole(kind)),
    relationship: String(entry.relationship || "auto"),
    scope: String(entry.scope || "auto"),
    subject_group: String(entry.subject_group || "auto"),
    dialogue_target: String(entry.dialogue_target || "auto"),
    content: String(entry.content || ""),
    instruction: String(entry.instruction != null ? entry.instruction : legacyNote),
  };
  for (const key of [
    "_preferred_role", "_role_auto_fallback",
    "_preferred_scope", "_scope_auto_fallback",
    "_preferred_relationship", "_relationship_auto_fallback",
    "_preferred_subject_group", "_subject_group_auto_fallback",
    "_preferred_dialogue_target", "_dialogue_target_auto_fallback",
  ]) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) migrated[key] = entry[key];
  }
  return migrated;
}

const NATIVE_SCENE_VALIDATION_GATE = "ultra_scene_validation_gate";
const TRANSIENT_UI_LOCALE = "ultra_ui_locale";

const VALIDATION_BADGE_TEXT = Object.freeze({
  ko: "⚠ 최상단 지시어·환경 설정·행동/대사·참조 중 하나를 입력하세요",
  en: "⚠ Enter a top instruction, environment setting, action/dialogue, or reference",
});

function nativeR2VSceneValidationBadgeText(node) {
  return VALIDATION_BADGE_TEXT[activeLocale(node)] ?? VALIDATION_BADGE_TEXT.en;
}

function nativeR2VTimelineHasUserContent(node) {
  const counts = readDynamicCounts(node);
  for (let index = 1; index <= counts.turnCount; index += 1) {
    for (const field of ["action", "dialogue_text"]) {
      const name = `turn_${index}_${field}`;
      const widget = widgetByName(node, name);
      if (widgetInputConnected(node, name) || !requiredInputIsBlank(widget)) return true;
    }
    if (sequentialVocalEnabled(node, index)) {
      for (const field of ["vocal_2_text", "vocal_3_text"]) {
        const name = `turn_${index}_${field}`;
        const widget = widgetByName(node, name);
        if (widgetInputConnected(node, name) || !requiredInputIsBlank(widget)) return true;
      }
    }
  }
  return false;
}

function nativeR2VSceneValidationGateValue(node) {
  const scene = widgetByName(node, "scene_prompt");
  if (!requiredInputIsBlank(scene) || widgetInputConnected(node, "scene_prompt")) return "ok";
  if (nativeR2VTimelineHasUserContent(node)) return "ok";
  if (hasSceneEnvironmentExtension(node)) return "ok";
  if (connectedReferenceInputs(node).length > 0) return "ok";
  // "missing" is a display-only draft signal. Python VALIDATE_INPUTS accepts it,
  // while the frontend shows the scene badge without turning the draft into a
  // native Queue validation error.
  return "missing";
}

function installNativeSceneValidationGate(node) {
  const gate = widgetByName(node, NATIVE_SCENE_VALIDATION_GATE);
  if (!gate) return;
  gate.hidden = true;
  gate.options = { ...(gate.options || {}), hidden: true };
  // Keep the gate out of saved workflow widgets_values while still allowing
  // graphToPrompt() to call serializeValue for the API prompt. ComfyUI uses
  // widget.serialize for workflow persistence and options.serialize for API inclusion.
  gate.serialize = false;
  gate.serializeValue = () => {
    const verdict = nativeR2VSceneValidationGateValue(node);
    if (verdict === "missing") triggerValidationBadge(node);
    return verdict;
  };
}

function installTransientUiLocale(node) {
  const widget = widgetByName(node, TRANSIENT_UI_LOCALE);
  if (!widget) return;
  widget.hidden = true;
  widget.options = { ...(widget.options || {}), hidden: true };
  widget.serialize = false;
  widget.serializeValue = () => activeLocale(node) === "ko" ? "ko" : "en";
}

function roleSupportsSubjectGrouping(kind, role) {
  if (kind === "audio") return false;
  return [
    "scene_environment", "animal_nonhuman_subject", "style_reference", "object_prop",
    "visual_effect", "interface_visible_text", "general_reference", "custom",
  ].includes(role);
}

function subjectGroupDisplayTable(locale) {
  const ko = locale === "ko";
  const table = { auto: ko ? "별도 대상 · 기본값" : "Separate subject · default" };
  for (let index = 1; index <= 6; index++) {
    table[`shared_${index}`] = ko ? `같은 대상 ${index}` : `Shared subject ${index}`;
  }
  return table;
}

function dialogueTargetDisplayTable(locale, personCount) {
  const ko = locale === "ko";
  const table = { auto: ko ? "자동 · 범위의 대사와 일치" : "Auto · match dialogue in scope" };
  const labels = {
    A: ko ? "인물 A" : "Person A",
    B: ko ? "인물 B" : "Person B",
    C: ko ? "인물 C" : "Person C",
    "A+B": ko ? "인물 A + B" : "Person A + B",
    "A+C": ko ? "인물 A + C" : "Person A + C",
    "B+C": ko ? "인물 B + C" : "Person B + C",
    "A+B+C": ko ? "인물 A + B + C" : "Person A + B + C",
    Narrator: ko ? "내레이터" : "Narrator",
  };
  for (const value of allowedTurnSpeakerChoices(personCount)) table[value] = labels[value] || value;
  return table;
}

function referenceContentUiText(labels, role) {
  if (role === "dialogue_content") {
    return {
      label: labels.sourceContentDialogue,
      placeholder: labels.sourceContentDialoguePlaceholder,
      tooltip: labels.sourceContentDialogueTooltip,
    };
  }
  if (role === "interface_visible_text") {
    return {
      label: labels.sourceContentVisibleText,
      placeholder: labels.sourceContentVisibleTextPlaceholder,
      tooltip: labels.sourceContentVisibleTextTooltip,
    };
  }
  return {
    label: labels.sourceContent,
    placeholder: labels.sourceContentPlaceholder,
    tooltip: labels.sourceContentTooltip,
  };
}

function withReferenceSemanticProgrammaticWrite(node, mutate) {
  const state = nodeState(node);
  state.referenceSemanticWriteDepth = (state.referenceSemanticWriteDepth || 0) + 1;
  try { return mutate(); }
  finally { state.referenceSemanticWriteDepth = Math.max(0, (state.referenceSemanticWriteDepth || 1) - 1); }
}

function refreshReferenceUiSemanticRow(node, input, { snapshot = true } = {}) {
  if (!node || !input || !exactGroup(input.name)) return false;
  const kind = roleKind(input.name);
  const locale = activeLocale(node);
  const labels = ROLE_LABELS[locale] || ROLE_LABELS.en;
  const roleTable = labels[kind];
  const current = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);

  const allRoles = Object.keys(ROLE_LABELS.en[kind]);
  const canonicalRoles = availableRolesFor(kind, referencePersonCount(node));
  if (!allRoles.includes(current.role)) current.role = defaultRole(kind);
  if (!canonicalRoles.includes(current.role)) {
    current._preferred_role = current.role;
    current._role_auto_fallback = true;
    current.role = defaultRole(kind);
  } else if (current._role_auto_fallback && canonicalRoles.includes(current._preferred_role)) {
    current.role = current._preferred_role;
    delete current._preferred_role;
    delete current._role_auto_fallback;
  }

  const allRelationships = kind === "audio"
    ? ["auto", "fully_copy", "partially_copy", "reference", "weak_reference"]
    : ["auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
  if (!allRelationships.includes(current.relationship)) current.relationship = "auto";
  const canonicalRelationships = allowedRelationshipsFor(kind, current.role);
  if (!canonicalRelationships.includes(current.relationship)) {
    current._preferred_relationship = current.relationship;
    current._relationship_auto_fallback = true;
    current.relationship = "auto";
  } else if (current._relationship_auto_fallback && canonicalRelationships.includes(current._preferred_relationship)) {
    current.relationship = current._preferred_relationship;
    delete current._preferred_relationship;
    delete current._relationship_auto_fallback;
  }

  const allSubjectGroups = Object.keys(subjectGroupDisplayTable("en"));
  if (!allSubjectGroups.includes(current.subject_group)) current.subject_group = "auto";
  if (current._preferred_subject_group && !allSubjectGroups.includes(current._preferred_subject_group)) {
    delete current._preferred_subject_group;
    delete current._subject_group_auto_fallback;
  }
  if (roleSupportsSubjectGrouping(kind, current.role)) {
    if (current._subject_group_auto_fallback && allSubjectGroups.includes(current._preferred_subject_group)) {
      current.subject_group = current._preferred_subject_group;
      delete current._preferred_subject_group;
      delete current._subject_group_auto_fallback;
    }
  } else {
    if (current.subject_group !== "auto") {
      current._preferred_subject_group = current.subject_group;
      current._subject_group_auto_fallback = true;
    }
    current.subject_group = "auto";
  }

  if (kind === "audio") {
    const allTargets = Object.keys(dialogueTargetDisplayTable("en", 3));
    const liveTargets = Object.keys(dialogueTargetDisplayTable("en", referencePersonCount(node)));
    if (!allTargets.includes(current.dialogue_target)) current.dialogue_target = "auto";
    if (current._preferred_dialogue_target && !allTargets.includes(current._preferred_dialogue_target)) {
      delete current._preferred_dialogue_target;
      delete current._dialogue_target_auto_fallback;
    }
    if (current.role === "dialogue_content") {
      if (!liveTargets.includes(current.dialogue_target)) {
        if (current.dialogue_target !== "auto") current._preferred_dialogue_target = current.dialogue_target;
        current._dialogue_target_auto_fallback = true;
        current.dialogue_target = "auto";
      } else if (current._dialogue_target_auto_fallback && liveTargets.includes(current._preferred_dialogue_target)) {
        current.dialogue_target = current._preferred_dialogue_target;
        delete current._preferred_dialogue_target;
        delete current._dialogue_target_auto_fallback;
      }
    } else {
      if (current.dialogue_target !== "auto") current._preferred_dialogue_target = current.dialogue_target;
      if (current._preferred_dialogue_target && current._preferred_dialogue_target !== "auto") current._dialogue_target_auto_fallback = true;
      current.dialogue_target = "auto";
    }
  }

  const allScopes = Object.keys(scopeDisplayTable("en"));
  const canonicalScopes = availableScopesFor(node);
  if (!allScopes.includes(current.scope)) current.scope = "auto";
  if (current._preferred_scope && !allScopes.includes(current._preferred_scope)) {
    delete current._preferred_scope;
    delete current._scope_auto_fallback;
  }
  if (roleNeedsScope(kind, current.role)) {
    if (!canonicalScopes.includes(current.scope)) {
      if (current.scope !== "auto") current._preferred_scope = current.scope;
      current._scope_auto_fallback = true;
      current.scope = "auto";
    } else if (current._scope_auto_fallback && canonicalScopes.includes(current._preferred_scope)) {
      current.scope = current._preferred_scope;
      delete current._preferred_scope;
      delete current._scope_auto_fallback;
    }
  } else {
    if (current.scope !== "auto") current._preferred_scope = current.scope;
    if (current._preferred_scope && current._preferred_scope !== "auto") current._scope_auto_fallback = true;
    current.scope = "auto";
  }

  input.__ultraR2VPlan = { ...current };
  const meta = exactGroup(input.name);
  const baseLabel = meta ? inputLabel(meta.kind, meta.index, locale) : input.name;
  input.label = baseLabel;

  const roleWidget = widgetByName(node, `__r2v_role_${input.name}`);
  if (roleWidget) {
    roleWidget.options = { ...(roleWidget.options || {}), values: canonicalRoles.map((key) => roleTable[key] || key), serialize: false, tooltip: labels.roleTooltip };
    withReferenceSemanticProgrammaticWrite(node, () => { roleWidget.value = roleTable[current.role] || current.role; });
    roleWidget.label = `${baseLabel} · ${labels.role}`;
    roleWidget.tooltip = labels.roleTooltip;
  }

  const relationshipTable = relationshipDisplayTable(locale);
  const relationshipWidget = widgetByName(node, `__r2v_relationship_${input.name}`);
  if (relationshipWidget) {
    relationshipWidget.options = { ...(relationshipWidget.options || {}), values: canonicalRelationships.map((key) => relationshipTable[key]), serialize: false, tooltip: labels.relationshipTooltip };
    const relationshipDisplayKey = current._relationship_auto_fallback && current._preferred_relationship
      ? current._preferred_relationship
      : current.relationship;
    withReferenceSemanticProgrammaticWrite(node, () => {
      relationshipWidget.value = relationshipTable[relationshipDisplayKey] || relationshipTable.auto;
    });
    relationshipWidget.label = `${baseLabel} · ${labels.relationship}`;
    relationshipWidget.tooltip = labels.relationshipTooltip;
  }

  const groupTable = subjectGroupDisplayTable(locale);
  const groupWidget = widgetByName(node, `__r2v_subject_group_${input.name}`);
  if (groupWidget) {
    groupWidget.options = { ...(groupWidget.options || {}), values: Object.values(groupTable), serialize: false, tooltip: labels.subjectGroupTooltip };
    const groupDisplayKey = current._subject_group_auto_fallback && current._preferred_subject_group
      ? current._preferred_subject_group
      : current.subject_group;
    withReferenceSemanticProgrammaticWrite(node, () => { groupWidget.value = groupTable[groupDisplayKey] || groupTable.auto; });
    groupWidget.label = `${baseLabel} · ${labels.subjectGroup}`;
    groupWidget.tooltip = labels.subjectGroupTooltip;
  }

  if (kind === "audio") {
    const targetTable = dialogueTargetDisplayTable(locale, referencePersonCount(node));
    const targetWidget = widgetByName(node, `__r2v_dialogue_target_${input.name}`);
    if (targetWidget) {
      targetWidget.options = { ...(targetWidget.options || {}), values: Object.values(targetTable), serialize: false, tooltip: labels.dialogueTargetTooltip };
      const targetDisplayKey = current._dialogue_target_auto_fallback && current._preferred_dialogue_target
        ? current._preferred_dialogue_target
        : current.dialogue_target;
      withReferenceSemanticProgrammaticWrite(node, () => {
        targetWidget.value = targetTable[targetDisplayKey] || dialogueTargetDisplayTable(locale, 3)[targetDisplayKey] || targetTable.auto;
      });
      targetWidget.label = `${baseLabel} · ${labels.dialogueTarget}`;
      targetWidget.tooltip = labels.dialogueTargetTooltip;
    }
  }

  const contentText = referenceContentUiText(labels, current.role);
  const contentWidget = widgetByName(node, `__r2v_content_${input.name}`);
  if (contentWidget) {
    contentWidget.label = `${baseLabel} · ${contentText.label}`;
    contentWidget.options = { ...(contentWidget.options || {}), serialize: false, placeholder: contentText.placeholder, tooltip: contentText.tooltip };
    contentWidget.tooltip = contentText.tooltip;
  }

  const scopeTable = scopeDisplayTable(locale);
  const scopeWidget = widgetByName(node, `__r2v_scope_${input.name}`);
  if (scopeWidget) {
    scopeWidget.options = { ...(scopeWidget.options || {}), values: canonicalScopes.map((key) => scopeTable[key]), serialize: false, tooltip: labels.scopeTooltip };
    const scopeDisplayKey = current._scope_auto_fallback && current._preferred_scope
      ? current._preferred_scope
      : current.scope;
    withReferenceSemanticProgrammaticWrite(node, () => { scopeWidget.value = scopeTable[scopeDisplayKey] || scopeTable.auto; });
    scopeWidget.label = `${baseLabel} · ${labels.scope}`;
    scopeWidget.tooltip = labels.scopeTooltip;
  }

  const instructionWidget = widgetByName(node, `__r2v_instruction_${input.name}`);
  if (instructionWidget) {
    instructionWidget.label = `${baseLabel} · ${labels.applyInstruction}`;
    instructionWidget.options = { ...(instructionWidget.options || {}), serialize: false, placeholder: labels.applyInstructionPlaceholder, tooltip: labels.applyInstructionTooltip };
    instructionWidget.tooltip = labels.applyInstructionTooltip;
  }

  if (snapshot) snapshotPlanFromInputs(node);
  // Semantic role edits only update allowed values, labels, placeholders, and
  // the backing Reference plan. Reference-row visibility is intentionally
  // stable across role changes, so do not physically reorder node.widgets here.
  // Full topology/count changes finish through syncCoreVisibility(), which owns
  // the single authoritative visibility/layout transaction.
  node.setDirtyCanvas?.(true, true);
  return true;
}

function refreshAllReferenceUiSemantic(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return false;
  try { flushReferenceUiToPlan(node); } catch (_) {}
  attachPlanToInputs(node);
  let changed = false;
  for (const input of connectedReferenceInputs(node)) {
    changed = refreshReferenceUiSemanticRow(node, input, { snapshot: false }) || changed;
  }
  snapshotPlanFromInputs(node);
  // Callers of the bulk semantic refresh immediately enter syncCoreVisibility().
  // Keep this pass semantic-only so multiple References do not trigger repeated
  // node.widgets splices before that single final layout transaction.
  return changed;
}

function syncReferenceUiVisibility(node, basic) {
  let changed = false;
  for (const input of connectedReferenceInputs(node)) {
    const kind = roleKind(input.name);
    // Role, application method, and scope are the high-impact Reference controls
    // and stay in Basic View. Audio dialogue targeting also stays reachable: it
    // can decide who receives exact referenced speech/lyrics. Keep visibility
    // independent of role selection so role edits cannot reintroduce the old
    // Reference-row blink/layout churn.
    changed = setWidgetVisible(widgetByName(node, `__r2v_role_${input.name}`), true) || changed;
    changed = setWidgetVisible(widgetByName(node, `__r2v_relationship_${input.name}`), true) || changed;
    changed = setWidgetVisible(widgetByName(node, `__r2v_scope_${input.name}`), true) || changed;
    changed = setWidgetVisible(widgetByName(node, `__r2v_subject_group_${input.name}`), !basic) || changed;
    changed = setWidgetVisible(
      widgetByName(node, `__r2v_dialogue_target_${input.name}`),
      kind === "audio",
    ) || changed;
    const contentName = `__r2v_content_${input.name}`;
    const instructionName = `__r2v_instruction_${input.name}`;
    // STRING-backed Reference text rows stay visible while connected even in
    // Basic View. This preserves the proven slot/line contract and prevents a
    // compact-mode hide from creating a hidden live socket or ghost link.
    changed = setWidgetVisible(widgetByName(node, contentName), !basic || widgetInputConnected(node, contentName)) || changed;
    changed = setWidgetVisible(widgetByName(node, instructionName), !basic || widgetInputConnected(node, instructionName)) || changed;
  }
  return changed;
}

function removeReferenceUi(node) {
  const widgets = [...(node.widgets || [])].filter((widget) => widget?.[REFERENCE_UI_MARKER]);
  for (const widget of widgets.reverse()) {
    try { node.removeWidget(widget); } catch (_) {
      const index = (node.widgets || []).indexOf(widget);
      if (index >= 0) node.widgets.splice(index, 1);
    }
  }
}

function markUiOnly(widget) {
  if (!widget) return widget;
  widget[UI_MARKER] = true;
  widget.serialize = false;
  widget.serializeValue = () => undefined;
  widget.options = { ...(widget.options || {}), serialize: false };
  return widget;
}

function markReferenceUi(widget) {
  markUiOnly(widget);
  if (widget) widget[REFERENCE_UI_MARKER] = true;
  return widget;
}

function rebuildReferenceUi(node, { flushCurrent = true } = {}) {
  // Dynamic Reference rows can be rebuilt when the user changes person count,
  // multi-shot settings, locale, or connected reference sockets. Flush the
  // currently visible row widgets first so role/scope/content/instruction edits
  // never disappear just because the UI is being regenerated. Callers that
  // already flushed before mutating/renumbering inputs can skip this duplicate.
  if (flushCurrent) {
    try { flushReferenceUiToPlan(node); } catch (_) {}
  }
  removeReferenceUi(node);
  const locale = activeLocale(node);
  const labels = ROLE_LABELS[locale] || ROLE_LABELS.en;
  const plan = readPlan(node);

  for (const input of connectedReferenceInputs(node)) {
    const kind = roleKind(input.name);
    const table = labels[kind];
    const allRoles = Object.keys(ROLE_LABELS.en[kind]);
    const canonicalRoles = availableRolesFor(kind, referencePersonCount(node));
    const current = migrateReferencePlanEntry(plan[input.name] || input.__ultraR2VPlan, kind);
    if (!allRoles.includes(current.role)) current.role = defaultRole(kind);

    // Mirror the main node's safe fallback/restore behavior: when Person B/C is
    // temporarily unavailable, keep the user's prior role on the input object,
    // show a valid general role, and restore it if the person count grows again.
    if (!canonicalRoles.includes(current.role)) {
      current._preferred_role = current.role;
      current._role_auto_fallback = true;
      current.role = defaultRole(kind);
    } else if (current._role_auto_fallback && canonicalRoles.includes(current._preferred_role)) {
      current.role = current._preferred_role;
      delete current._preferred_role;
      delete current._role_auto_fallback;
    }

    const allRelationships = kind === "audio"
      ? ["auto", "fully_copy", "partially_copy", "reference", "weak_reference"]
      : ["auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
    if (!allRelationships.includes(current.relationship)) current.relationship = "auto";
    const canonicalRelationships = allowedRelationshipsFor(kind, current.role);
    if (!canonicalRelationships.includes(current.relationship)) {
      current._preferred_relationship = current.relationship;
      current._relationship_auto_fallback = true;
      current.relationship = "auto";
    } else if (current._relationship_auto_fallback && canonicalRelationships.includes(current._preferred_relationship)) {
      current.relationship = current._preferred_relationship;
      delete current._preferred_relationship;
      delete current._relationship_auto_fallback;
    }

    const allSubjectGroups = Object.keys(subjectGroupDisplayTable("en"));
    if (!allSubjectGroups.includes(current.subject_group)) current.subject_group = "auto";
    if (current._preferred_subject_group && !allSubjectGroups.includes(current._preferred_subject_group)) {
      delete current._preferred_subject_group;
      delete current._subject_group_auto_fallback;
    }
    if (roleSupportsSubjectGrouping(kind, current.role)) {
      if (current._subject_group_auto_fallback && allSubjectGroups.includes(current._preferred_subject_group)) {
        current.subject_group = current._preferred_subject_group;
        delete current._preferred_subject_group;
        delete current._subject_group_auto_fallback;
      }
    } else {
      if (current.subject_group !== "auto") {
        current._preferred_subject_group = current.subject_group;
        current._subject_group_auto_fallback = true;
      }
      current.subject_group = "auto";
    }

    if (kind === "audio") {
      const allDialogueTargets = Object.keys(dialogueTargetDisplayTable("en", 3));
      const canonicalDialogueTargets = Object.keys(dialogueTargetDisplayTable("en", referencePersonCount(node)));
      if (!allDialogueTargets.includes(current.dialogue_target)) current.dialogue_target = "auto";
      if (current._preferred_dialogue_target && !allDialogueTargets.includes(current._preferred_dialogue_target)) {
        delete current._preferred_dialogue_target;
        delete current._dialogue_target_auto_fallback;
      }
      if (current.role === "dialogue_content") {
        if (!canonicalDialogueTargets.includes(current.dialogue_target)) {
          if (current.dialogue_target !== "auto") current._preferred_dialogue_target = current.dialogue_target;
          current._dialogue_target_auto_fallback = true;
          current.dialogue_target = "auto";
        } else if (current._dialogue_target_auto_fallback && canonicalDialogueTargets.includes(current._preferred_dialogue_target)) {
          current.dialogue_target = current._preferred_dialogue_target;
          delete current._preferred_dialogue_target;
          delete current._dialogue_target_auto_fallback;
        }
      } else {
        if (current.dialogue_target !== "auto") current._preferred_dialogue_target = current.dialogue_target;
        if (current._preferred_dialogue_target && current._preferred_dialogue_target !== "auto") current._dialogue_target_auto_fallback = true;
        current.dialogue_target = "auto";
      }
    }

    const allScopes = Object.keys(scopeDisplayTable("en"));
    const canonicalScopes = availableScopesFor(node);
    if (!allScopes.includes(current.scope)) current.scope = "auto";
    if (current._preferred_scope && !allScopes.includes(current._preferred_scope)) {
      delete current._preferred_scope;
      delete current._scope_auto_fallback;
    }
    if (roleNeedsScope(kind, current.role)) {
      if (!canonicalScopes.includes(current.scope)) {
        if (current.scope !== "auto") current._preferred_scope = current.scope;
        current._scope_auto_fallback = true;
        current.scope = "auto";
      } else if (current._scope_auto_fallback && canonicalScopes.includes(current._preferred_scope)) {
        current.scope = current._preferred_scope;
        delete current._preferred_scope;
        delete current._scope_auto_fallback;
      }
    } else {
      if (current.scope !== "auto") current._preferred_scope = current.scope;
      if (current._preferred_scope && current._preferred_scope !== "auto") current._scope_auto_fallback = true;
      current.scope = "auto";
    }

    input.__ultraR2VPlan = { ...current };
    const reverse = Object.fromEntries(Object.entries(table).map(([key, value]) => [String(value), key]));
    const displayValues = canonicalRoles.map((key) => table[key] || key);
    const displayValue = table[current.role] || current.role;
    // Never build the dynamic Reference rows from a possibly stale/localized
    // `input.label`. Recompute the visible label from the canonical internal
    // socket name so Picture/Image 1/2/3 always stays aligned with the actual
    // ref_* slot after connection compaction, reordering, and locale changes.
    const inputMeta = exactGroup(input.name);
    const baseLabel = inputMeta ? inputLabel(inputMeta.kind, inputMeta.index, locale) : input.name;
    input.label = baseLabel;

    const roleWidget = markReferenceUi(node.addWidget(
      "combo",
      `${baseLabel} · ${labels.role}`,
      displayValue,
      (value) => {
        if ((nodeState(node).referenceSemanticWriteDepth || 0) > 0) return;
        const liveLocale = activeLocale(node);
        const liveTable = (ROLE_LABELS[liveLocale] || ROLE_LABELS.en)[kind];
        const liveCanonicalRoles = availableRolesFor(kind, referencePersonCount(node));
        const canonical = resolveChoiceFromWidgetValue(value, liveCanonicalRoles, liveTable, defaultRole(kind));
        const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
        nextPlan.role = canonical;
        delete nextPlan._preferred_role;
        delete nextPlan._role_auto_fallback;
        input.__ultraR2VPlan = nextPlan;
        snapshotPlanFromInputs(node);
        queueMicrotask(() => runScenePreservingLayoutChange(node, () => {
          refreshReferenceUiSemanticRow(node, input);
          // The role is part of the collapsed Reference-group summary. Refresh
          // group metadata once, without rebuilding/reordering Reference rows.
          refreshGroupedSections(node, { redraw: false });
        }));
      },
      { values: displayValues, serialize: false, tooltip: labels.roleTooltip },
    ));
    if (roleWidget) {
      roleWidget.name = `__r2v_role_${input.name}`;
      roleWidget.label = `${baseLabel} · ${labels.role}`;
      roleWidget.tooltip = labels.roleTooltip;
    }

    {
      const groupTable = subjectGroupDisplayTable(locale);
      const groupWidget = markReferenceUi(node.addWidget(
        "combo",
        `${baseLabel} · ${labels.subjectGroup}`,
        groupTable[current._subject_group_auto_fallback && current._preferred_subject_group ? current._preferred_subject_group : current.subject_group] || groupTable.auto,
        (value) => {
          if ((nodeState(node).referenceSemanticWriteDepth || 0) > 0) return;
          const liveGroupTable = subjectGroupDisplayTable(activeLocale(node));
          const canonical = resolveChoiceFromWidgetValue(value, Object.keys(liveGroupTable), liveGroupTable, "auto");
          const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
          if (roleSupportsSubjectGrouping(kind, nextPlan.role)) {
            nextPlan.subject_group = canonical;
            delete nextPlan._preferred_subject_group;
            delete nextPlan._subject_group_auto_fallback;
          } else {
            nextPlan.subject_group = "auto";
            if (canonical !== "auto") {
              nextPlan._preferred_subject_group = canonical;
              nextPlan._subject_group_auto_fallback = true;
            } else {
              delete nextPlan._preferred_subject_group;
              delete nextPlan._subject_group_auto_fallback;
            }
          }
          input.__ultraR2VPlan = nextPlan;
          snapshotPlanFromInputs(node);
        },
        { values: Object.values(groupTable), serialize: false, tooltip: labels.subjectGroupTooltip },
      ));
      if (groupWidget) {
        groupWidget.name = `__r2v_subject_group_${input.name}`;
        groupWidget.label = `${baseLabel} · ${labels.subjectGroup}`;
        groupWidget.tooltip = labels.subjectGroupTooltip;
      }
    }

    if (kind === "audio") {
      const targetTable = dialogueTargetDisplayTable(locale, referencePersonCount(node));
      const targetWidget = markReferenceUi(node.addWidget(
        "combo",
        `${baseLabel} · ${labels.dialogueTarget}`,
        targetTable[current._dialogue_target_auto_fallback && current._preferred_dialogue_target ? current._preferred_dialogue_target : current.dialogue_target]
          || dialogueTargetDisplayTable(locale, 3)[current._preferred_dialogue_target]
          || targetTable.auto,
        (value) => {
          if ((nodeState(node).referenceSemanticWriteDepth || 0) > 0) return;
          const liveTargetTable = dialogueTargetDisplayTable(activeLocale(node), referencePersonCount(node));
          const canonical = resolveChoiceFromWidgetValue(value, Object.keys(liveTargetTable), liveTargetTable, "auto");
          const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
          if (nextPlan.role === "dialogue_content") {
            nextPlan.dialogue_target = canonical;
            delete nextPlan._preferred_dialogue_target;
            delete nextPlan._dialogue_target_auto_fallback;
          } else {
            nextPlan.dialogue_target = "auto";
            if (canonical !== "auto") {
              nextPlan._preferred_dialogue_target = canonical;
              nextPlan._dialogue_target_auto_fallback = true;
            } else {
              delete nextPlan._preferred_dialogue_target;
              delete nextPlan._dialogue_target_auto_fallback;
            }
          }
          input.__ultraR2VPlan = nextPlan;
          snapshotPlanFromInputs(node);
        },
        { values: Object.values(targetTable), serialize: false, tooltip: labels.dialogueTargetTooltip },
      ));
      if (targetWidget) {
        targetWidget.name = `__r2v_dialogue_target_${input.name}`;
        targetWidget.label = `${baseLabel} · ${labels.dialogueTarget}`;
        targetWidget.tooltip = labels.dialogueTargetTooltip;
      }
    }

    const relationshipTable = relationshipDisplayTable(locale);
    const relationshipWidget = markReferenceUi(node.addWidget(
      "combo",
      `${baseLabel} · ${labels.relationship}`,
      relationshipTable[current.relationship] || relationshipTable.auto,
      (value) => {
        if ((nodeState(node).referenceSemanticWriteDepth || 0) > 0) return;
        const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
        const liveRelationshipTable = relationshipDisplayTable(activeLocale(node));
        const liveRelationships = allowedRelationshipsFor(kind, nextPlan.role);
        const canonical = resolveChoiceFromWidgetValue(value, liveRelationships, liveRelationshipTable, "auto");
        nextPlan.relationship = liveRelationships.includes(canonical) ? canonical : "auto";
        delete nextPlan._preferred_relationship;
        delete nextPlan._relationship_auto_fallback;
        input.__ultraR2VPlan = nextPlan;
        snapshotPlanFromInputs(node);
      },
      { values: canonicalRelationships.map((key) => relationshipTable[key]), serialize: false, tooltip: labels.relationshipTooltip },
    ));
    if (relationshipWidget) {
      relationshipWidget.name = `__r2v_relationship_${input.name}`;
      relationshipWidget.label = `${baseLabel} · ${labels.relationship}`;
      relationshipWidget.tooltip = labels.relationshipTooltip;
    }

    const contentText = referenceContentUiText(labels, current.role);
    const contentWidget = markReferenceUi(node.addWidget(
      "text",
      `${baseLabel} · ${contentText.label}`,
      String(current.content || ""),
      (value) => {
        const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
        nextPlan.content = String(value || "");
        input.__ultraR2VPlan = nextPlan;
        snapshotPlanFromInputs(node);
      },
      { serialize: false, tooltip: contentText.tooltip },
    ));
    if (contentWidget) {
      contentWidget.name = `__r2v_content_${input.name}`;
      contentWidget.label = `${baseLabel} · ${contentText.label}`;
      contentWidget.options = { ...(contentWidget.options || {}), serialize: false, placeholder: contentText.placeholder, tooltip: contentText.tooltip };
      contentWidget.tooltip = contentText.tooltip;
      // Keep Reference content local to the semantic UI. Promoting this widget
      // to a new STRING input after links exist changes every later slot index
      // in frontend 1.53 and is the main cause of Prompt/Audio wire migration.
    }

    {
      const scopeTable = scopeDisplayTable(locale);
      const scopeWidget = markReferenceUi(node.addWidget(
        "combo",
        `${baseLabel} · ${labels.scope}`,
        scopeTable[current._scope_auto_fallback && current._preferred_scope ? current._preferred_scope : current.scope] || scopeTable.auto,
        (value) => {
          if ((nodeState(node).referenceSemanticWriteDepth || 0) > 0) return;
          const liveScopeTable = scopeDisplayTable(activeLocale(node));
          const liveScopes = availableScopesFor(node);
          const canonical = resolveChoiceFromWidgetValue(value, liveScopes, liveScopeTable, "auto");
          const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
          if (roleNeedsScope(kind, nextPlan.role)) {
            nextPlan.scope = liveScopes.includes(canonical) ? canonical : "auto";
            delete nextPlan._preferred_scope;
            delete nextPlan._scope_auto_fallback;
          } else {
            nextPlan.scope = "auto";
            if (canonical !== "auto") {
              nextPlan._preferred_scope = canonical;
              nextPlan._scope_auto_fallback = true;
            } else {
              delete nextPlan._preferred_scope;
              delete nextPlan._scope_auto_fallback;
            }
          }
          input.__ultraR2VPlan = nextPlan;
          snapshotPlanFromInputs(node);
        },
        { values: canonicalScopes.map((key) => scopeTable[key]), serialize: false, tooltip: labels.scopeTooltip },
      ));
      if (scopeWidget) {
        scopeWidget.name = `__r2v_scope_${input.name}`;
        scopeWidget.label = `${baseLabel} · ${labels.scope}`;
        scopeWidget.tooltip = labels.scopeTooltip;
      }
    }

    const instructionWidget = markReferenceUi(node.addWidget(
      "text",
      `${baseLabel} · ${labels.applyInstruction}`,
      String(current.instruction || ""),
      (value) => {
        const nextPlan = migrateReferencePlanEntry(input.__ultraR2VPlan, kind);
        nextPlan.instruction = String(value || "");
        input.__ultraR2VPlan = nextPlan;
        snapshotPlanFromInputs(node);
      },
      { serialize: false, tooltip: labels.applyInstructionTooltip },
    ));
    if (instructionWidget) {
      instructionWidget.name = `__r2v_instruction_${input.name}`;
      instructionWidget.label = `${baseLabel} · ${labels.applyInstruction}`;
      instructionWidget.options = { ...(instructionWidget.options || {}), serialize: false, placeholder: labels.applyInstructionPlaceholder, tooltip: labels.applyInstructionTooltip };
      instructionWidget.tooltip = labels.applyInstructionTooltip;
      // See content above: no runtime input topology mutation is allowed here.
    }
  }
  snapshotPlanFromInputs(node);
  installConnectedStringTooltips(node, { inputIndex: widgetInputIndex, inputConnected: widgetInputConnected, locale: activeLocale });
  installCoreWidgetHoverTooltips(node, { locale: activeLocale });
  syncReferenceUiVisibility(node, basicViewEnabled(node));
  ensureViewToggle(node);
  organizeWidgetLayout(node);
}

function scheduleReferenceNormalizeFromUserEdit(node, { preserveSceneHeight = true } = {}) {
  if (!node || node.comfyClass !== NODE_CLASS) return;
  // Workflow reconstruction is not a user edit. Never mutate/reference-compact
  // serialized input topology while ComfyUI is restoring links.
  if (GRAPH_CONFIGURE_DEPTH > 0) return;
  const state = nodeState(node);
  state.referenceNormalizePending = true;
  if (state.referenceNormalizeTimer != null) return;
  state.referenceNormalizeTimer = setTimeout(() => {
    const current = nodeState(node);
    current.referenceNormalizeTimer = null;
    if (!current.referenceNormalizePending || GRAPH_CONFIGURE_DEPTH > 0) return;
    current.referenceNormalizePending = false;
    normalizeDynamicInputs(node, { preserveSceneHeight });
  }, 0);
}

function restoreReferenceUiWithoutCompaction(node) {
  // Workflow loading is not a user edit. During graph configure, ComfyUI can
  // expose serialized dynamic inputs before every link has been restored. Keep
  // those sockets and their STRING companions intact until the graph finishes
  // configuring; only mirror the persisted semantic plan into the current UI.
  attachPlanToInputs(node);
  const locale = activeLocale(node);
  for (const input of node.inputs || []) {
    const meta = exactGroup(input?.name || "");
    if (meta) input.label = inputLabel(meta.kind, meta.index, locale);
  }
  rebuildReferenceUi(node, { flushCurrent: false });
  syncCoreVisibility(node, { preserveSceneHeight: false });
}

function normalizeDynamicInputs(node, { preserveSceneHeight: preserve = false } = {}) {
  if (!node || node.comfyClass !== NODE_CLASS) return;
  if (node.__ultraR2VNormalizing) return;
  node.__ultraR2VNormalizing = true;
  const state = nodeState(node);
  state.suppressConnectionUiSync = (state.suppressConnectionUiSync ?? 0) + 1;
  const mutate = () => {
    // Add/remove through native methods, then reorder the surviving slot
    // objects with store-aware LLink endpoint updates.
    try { flushReferenceUiToPlan(node); } catch (_) {}
    attachPlanToInputs(node);
    normalizeSimpleGroup(node, "image", MAX_ROLE_LINKS.image);
    normalizeVideoPairs(node);
    normalizeSimpleGroup(node, "audio", MAX_ROLE_LINKS.audio);
    reorderReferenceInputs(node);
    const locale = activeLocale(node);
    for (const input of node.inputs || []) {
      const meta = exactGroup(input?.name || "");
      if (meta) input.label = inputLabel(meta.kind, meta.index, locale);
    }
    snapshotPlanFromInputs(node);
    rebuildReferenceUi(node, { flushCurrent: false });
    return syncCoreVisibility(node, { preserveSceneHeight: false });
  };
  try {
    if (preserve) runScenePreservingLayoutChange(node, mutate);
    else mutate();
  } finally {
    state.suppressConnectionUiSync = Math.max(0, (state.suppressConnectionUiSync ?? 1) - 1);
    node.__ultraR2VNormalizing = false;
  }
}

function scheduleSimpleCoreVisibilitySync(node, { refreshReferenceSemantics = false } = {}) {
  const state = nodeState(node);
  state.coreVisibilityRefreshReferenceSemantics = state.coreVisibilityRefreshReferenceSemantics || Boolean(refreshReferenceSemantics);
  if (state.coreVisibilitySyncPending) return;
  state.coreVisibilitySyncPending = true;

  queueMicrotask(() => {
    if (NODE_STATES.get(node) !== state) return;
    state.coreVisibilitySyncPending = false;
    const refreshSemantics = state.coreVisibilityRefreshReferenceSemantics;
    state.coreVisibilityRefreshReferenceSemantics = false;
    runScenePreservingLayoutChange(node, () => {
      if (refreshSemantics) refreshAllReferenceUiSemantic(node);
      return syncCoreVisibility(node, { preserveSceneHeight: false });
    });
  });
}

function installCallbacks(node) {
  if (node.__ultraR2VCallbacksInstalled) return;
  node.__ultraR2VCallbacksInstalled = true;
  // Person/Timeline counts and multi-shot structure are intentionally usable
  // without leaving Basic View. Only per-shot transition/motion stays Full-View-only.
  const autoExpand = new Set();
  const callbackNames = [
    "scene_translate", "person_count", "turn_count", "duration_seconds", "camera_sequence_enabled",
    "music_mode", "soundscape_mode", "person_a_advanced", "person_b_advanced", "person_c_advanced",
    "person_a_age", "person_b_age", "person_c_age",
    "person_a_appearance_preset", "person_b_appearance_preset", "person_c_appearance_preset",
    "person_a_clothing_preset", "person_b_clothing_preset", "person_c_clothing_preset",
    ...Array.from({ length: MAX_CAMERA_SHOTS }, (_, i) => `camera_shot_${i + 1}_target`),
    ...Array.from({ length: MAX_CAMERA_SHOTS }, (_, i) => `camera_shot_${i + 1}_framing`),
    ...Array.from({ length: MAX_CAMERA_SHOTS - 1 }, (_, i) => `camera_shot_${i + 2}_enabled`),
    ...Array.from({ length: MAX_CAMERA_SHOTS - 1 }, (_, i) => `camera_shot_${i + 2}_start_seconds`),
    "turn_1_speaker", "turn_2_speaker", "turn_3_speaker",
    "turn_4_speaker", "turn_5_speaker", "turn_6_speaker",
  ];
  for (const name of callbackNames) {
    const widget = widgetByName(node, name);
    if (!widget || widget.__ultraR2VWrapped) continue;
    const original = widget.callback;
    widget.callback = function (...args) {
      const state = nodeState(node);
      const tracksDynamicCount = ["person_count", "turn_count", "camera_sequence_enabled"].includes(name) || /^camera_shot_[2-6]_enabled$/.test(name);
      const previousCounts = tracksDynamicCount
        ? (state.lastDynamicCounts ? { ...state.lastDynamicCounts } : readDynamicCounts(node))
        : null;
      const result = original?.apply(this, args);
      if (name === "camera_sequence_enabled" && Boolean(args.length ? args[0] : widget.value)) {
        widget.value = true;
        const shot2 = widgetByName(node, "camera_shot_2_enabled");
        if (shot2) shot2.value = true;
      }
      if (/^camera_shot_[2-6]_enabled$/.test(name)) {
        widget.value = Boolean(args.length ? args[0] : widget.value);
      }
      if (name === "duration_seconds") {
        widget.value = normalizeWholeSecondDuration(args.length ? args[0] : widget.value, widget.value, 15);
      }
      if (/^camera_shot_[2-6]_start_seconds$/.test(name)) {
        widget.value = snapHalfSecond(args.length ? args[0] : widget.value, Number(widget.value) || 0.5);
      }
      // Shot timing/count synchronization is committed once by syncBounds()
      // in the final visibility transaction. Fast-path target/framing edits do
      // not affect shot timing, so no eager bounds pass is needed here.

      // Preserve the user's latest explicit choice when a prior person-count or
      // safety change temporarily forced a fallback. Programmatic fallback
      // writes are guarded so only genuine widget callbacks replace preferences.
      const incomingRaw = args.length > 0 && args[0] !== undefined ? args[0] : widget.value;
      if (/^camera_shot_\d+_target$/.test(name)) {
        const index = String(Number(name.match(/^camera_shot_(\d+)_target$/)?.[1] || 0));
        const value = canonicalCoreOptionValue(name, incomingRaw) || "current_action";
        if (!state.programmaticCameraTargetWrites.has(index)) {
          state.preferredCameraTargets.set(index, value);
          state.autoFallbackCameraTargets.delete(index);
          persistPreferences(node, state);
        }
      } else if (/^turn_\d+_speaker$/.test(name)) {
        const index = String(Number(name.match(/^turn_(\d+)_speaker$/)?.[1] || 0));
        const value = canonicalCoreOptionValue(name, incomingRaw) || (Number(widgetByName(node, "person_count")?.value ?? 1) <= 0 ? "Narrator" : "A");
        if (!state.programmaticTurnSpeakerWrites.has(index)) {
          state.preferredTurnSpeakers.set(index, value);
          state.autoFallbackTurnSpeakers.delete(index);
          persistPreferences(node, state);
        }
      } else if (/^person_[abc]_(appearance_preset|clothing_preset)$/.test(name)) {
        const value = canonicalCoreOptionValue(name, incomingRaw) || "none";
        if (!state.programmaticProfilePresetWrites.has(name)) {
          state.preferredProfilePresets.set(name, value);
          state.autoFallbackProfilePresets.delete(name);
          persistPreferences(node, state);
        }
      }

      // In Basic View a custom-only sound/music mode reveals its required text
      // row. Use the existing coalesced scene-preserving visibility transaction
      // instead of an eager resize/rebuild.
      if (name === "music_mode" || name === "soundscape_mode") {
        scheduleSimpleCoreVisibilitySync(node);
        return result;
      }

      // A-mode keeps every active Shot framing row visible. A target edit only
      // changes the valid framing choices, so do not run the full R2V visibility/
      // layout pipeline for this selection-only change.
      if (/^camera_shot_\d+_target$/.test(name)) {
        const personCount = Math.max(0, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1)));
        syncCameraFramingChoices(node, personCount);
        node.setDirtyCanvas?.(true, true);
        return result;
      }
      if (/^camera_shot_\d+_framing$/.test(name)) {
        node.setDirtyCanvas?.(true, true);
        return result;
      }

      const advancedToggleChange = ["person_a_advanced", "person_b_advanced", "person_c_advanced"].includes(name);
      if (tracksDynamicCount || advancedToggleChange) {
        // Keep topology/count-sensitive callbacks isolated. These paths update
        // remembered links and/or Basic/Full layout state and are intentionally
        // not coalesced with unrelated callbacks.
        queueMicrotask(() => {
          if (tracksDynamicCount) {
            const nextCounts = readDynamicCounts(node);
            syncRememberedInputsForDynamicChange(node, previousCounts, nextCounts);
            state.lastDynamicCounts = { ...nextCounts };
          }
          if (autoExpand.has(name) || advancedToggleChange) {
            state.layoutRevision = (state.layoutRevision ?? 0) + 1;
          }
          runScenePreservingLayoutChange(node, () => {
            if ((autoExpand.has(name) || advancedToggleChange) && basicViewEnabled(node)) {
              setBasicViewEnabled(node, false);
            }
            if (["person_count", "camera_sequence_enabled"].includes(name) || /^camera_shot_[2-6]_enabled$/.test(name)) refreshAllReferenceUiSemantic(node);
            return syncCoreVisibility(node, { preserveSceneHeight: false });
          });
        });
        return result;
      }

      // For value-only callbacks, immediate state/preference writes above are
      // already complete. Coalesce only the expensive final visibility/layout
      // commit when several such callbacks fire in the same JavaScript turn.
      scheduleSimpleCoreVisibilitySync(node, {
        refreshReferenceSemantics: /^camera_shot_[2-6]_start_seconds$/.test(name),
      });
      return result;
    };
    widget.__ultraR2VWrapped = true;
  }

  // These values change only the text shown on collapsed group headers.
  // Do not route them through the full visibility/layout pipeline.
  for (const name of [
    "camera_motion",
    "person_a_gender", "person_b_gender", "person_c_gender",
    "turn_1_elapsed_seconds", "turn_2_elapsed_seconds", "turn_3_elapsed_seconds",
    "turn_4_elapsed_seconds", "turn_5_elapsed_seconds", "turn_6_elapsed_seconds",
  ]) {
    const widget = widgetByName(node, name);
    if (!widget || widget.__ultraR2VSummaryWrapped) continue;
    const original = widget.callback;
    widget.callback = function (...args) {
      const result = original?.apply(this, args);
      if (/^turn_[1-6]_elapsed_seconds$/.test(name)) {
        widget.value = snapHalfSecond(args.length ? args[0] : widget.value, Number(widget.value) || 0.0);
        syncBounds(node);
      }
      refreshGroupedSections(node, { redraw: false });
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    widget.__ultraR2VSummaryWrapped = true;
  }

  const previous = node.onConnectionsChange;
  node.onConnectionsChange = function (...args) {
    const connectionType = args[0];
    const inputIndex = Number(args[1]);
    const inputSlot = Number.isInteger(inputIndex) && inputIndex >= 0 ? this.inputs?.[inputIndex] : null;
    const liteGraphInput = globalThis.LiteGraph?.INPUT;
    const inputEvent = liteGraphInput != null
      ? connectionType === liteGraphInput
      : connectionType === 1 || connectionType === "input" || connectionType === "INPUT" || (inputSlot != null && args[4] === inputSlot);
    const inputName = inputEvent ? (inputSlot?.widget?.name || inputSlot?.name || args[4]?.widget?.name || args[4]?.name || "") : "";
    const sceneConnectionChanged = inputName === "scene_prompt";
    const beforeSize = sceneConnectionChanged ? readNodeSize(this) : null;
    const layoutRevision = nodeState(this).layoutRevision ?? 0;

    const result = previous?.apply(this, args);
    if (!inputEvent) return result;
    if ((nodeState(this).suppressConnectionUiSync ?? 0) > 0) return result;
    if (args[2] === false && inputName) forgetRememberedDynamicLink(this, inputName);
    const referenceConnectionChanged = /^ref_(?:image|video|video_audio|audio)_\d+$/.test(inputName);
    if (referenceConnectionChanged) {
      // During workflow load, preserve serialized sockets/links exactly as they
      // arrive. For real user edits, collapse multiple connection callbacks into
      // one topology mutation so remove/add/reorder cannot recursively schedule
      // additional normalization passes.
      if (GRAPH_CONFIGURE_DEPTH === 0) scheduleReferenceNormalizeFromUserEdit(this, { preserveSceneHeight: true });
      return result;
    }
    setTimeout(() => {
      // Keep visibility/link-aware state current without rebuilding the whole
      // Reference plan for unrelated connections.
      syncCoreVisibility(this, { preserveSceneHeight: true });
      if (sceneConnectionChanged) preserveSceneGeometryAfterConnection(this, beforeSize, layoutRevision);
    }, 0);
    return result;
  };
}

function detachUiOnlyWidgets(node) {
  if (!Array.isArray(node?.widgets)) return [];
  const removed = [];
  for (let index = node.widgets.length - 1; index >= 0; index--) {
    const widget = node.widgets[index];
    if (!isR2VUiOnlyWidget(widget)) continue;
    removed.push({ index, widget });
    node.widgets.splice(index, 1);
  }
  return removed.reverse();
}

function restoreUiOnlyWidgets(node, removed) {
  if (!Array.isArray(node?.widgets)) node.widgets = [];
  for (const { index, widget } of removed || []) {
    node.widgets.splice(Math.min(index, node.widgets.length), 0, widget);
  }
}

function installCoreWidgetDefaultsNodeData(nodeType, nodeData) {
  if (!nodeType?.prototype || !nodeData || nodeData.name !== NODE_CLASS) return;
  const defaults = Object.create(null);
  for (const groupName of ["required", "optional"]) {
    const group = nodeData?.input?.[groupName];
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [name, spec] of Object.entries(group)) {
      const options = Array.isArray(spec) && spec[1] && typeof spec[1] === "object" ? spec[1] : null;
      if (!options || !Object.prototype.hasOwnProperty.call(options, "default")) continue;
      defaults[String(name)] = cloneResetValue(options.default);
    }
  }
  const frozenDefaults = Object.freeze(defaults);
  try {
    Object.defineProperty(nodeType.prototype, CORE_DEFAULTS_PROPERTY, { value: frozenDefaults, writable: true, configurable: true, enumerable: false });
  } catch (_) {
    nodeType.prototype[CORE_DEFAULTS_PROPERTY] = frozenDefaults;
  }
}

const SHOT_CAMERA_MODIFIER_SCHEMA_DEFAULTS = Object.freeze({
  camera_shot_2_amplitude: "inherit", camera_shot_2_speed: "inherit",
  camera_shot_3_amplitude: "inherit", camera_shot_3_speed: "inherit",
  camera_shot_4_amplitude: "inherit", camera_shot_4_speed: "inherit",
  camera_shot_5_amplitude: "inherit", camera_shot_5_speed: "inherit",
  camera_shot_6_amplitude: "inherit", camera_shot_6_speed: "inherit",
});

function migrateV350ShotCameraModifierSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = [...(node?.widgets || [])].filter((widget) => !isR2VUiOnlyWidget(widget));
  const added = Object.keys(SHOT_CAMERA_MODIFIER_SCHEMA_DEFAULTS);
  if (info.widgets_values.length !== widgets.length - added.length) return;
  const migrated = [];
  let oldIndex = 0;
  for (const widget of widgets) {
    const name = widget?.name;
    if (Object.prototype.hasOwnProperty.call(SHOT_CAMERA_MODIFIER_SCHEMA_DEFAULTS, name)) {
      migrated.push(SHOT_CAMERA_MODIFIER_SCHEMA_DEFAULTS[name]);
      continue;
    }
    if (oldIndex >= info.widgets_values.length) return;
    migrated.push(info.widgets_values[oldIndex++]);
  }
  if (oldIndex === info.widgets_values.length && migrated.length === widgets.length) info.widgets_values = migrated;
}

function migrateLegacyCameraFramingSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = [...(node?.widgets || [])].filter((widget) => !isR2VUiOnlyWidget(widget));
  const added = ["camera_shot_1_framing", "camera_shot_2_framing", "camera_shot_3_framing", "camera_shot_4_framing"];
  if (info.widgets_values.length !== widgets.length - added.length) return;
  const migrated = [];
  let oldIndex = 0;
  for (const widget of widgets) {
    const name = widget?.name;
    if (added.includes(name)) {
      migrated.push("auto");
      continue;
    }
    if (oldIndex >= info.widgets_values.length) return;
    migrated.push(info.widgets_values[oldIndex++]);
  }
  if (oldIndex === info.widgets_values.length && migrated.length === widgets.length) info.widgets_values = migrated;
}

function safelyRunUiPhase(phase, nodeOrType, fn) {
  try {
    return fn();
  } catch (error) {
    const nodeName = nodeOrType?.comfyClass || nodeOrType?.title || nodeOrType?.name || "unknown";
    console.error(`[Ultra MiniMax H3 Prompt] ${phase} failed for ${nodeName}. UI enhancement was skipped to protect ComfyUI/workflow loading.`, error);
    return undefined;
  }
}

function serializedCoreWidgetValue(node, info, widgetName) {
  if (!Array.isArray(info?.widgets_values) || !Array.isArray(node?.widgets)) return undefined;
  const coreWidgets = node.widgets.filter((widget) => !isR2VUiOnlyWidget(widget));
  const persistentWidgets = coreWidgets.filter((widget) => !["ultra_scene_validation_gate", "ultra_ui_locale"].includes(widget?.name));
  const persistentIndex = persistentWidgets.findIndex((widget) => widget?.name === widgetName);
  if (persistentIndex >= 0 && info.widgets_values.length <= persistentWidgets.length) {
    return persistentIndex < info.widgets_values.length ? info.widgets_values[persistentIndex] : undefined;
  }
  const rawIndex = coreWidgets.findIndex((widget) => widget?.name === widgetName);
  return rawIndex >= 0 && rawIndex < info.widgets_values.length ? info.widgets_values[rawIndex] : undefined;
}

function restoreSerializedReferenceTextWidgetGuards(node, savedPlanValue) {
  if (!node || node.comfyClass !== NODE_CLASS || !Array.isArray(node.inputs)) return;
  let plan = {};
  try {
    const parsed = JSON.parse(String(savedPlanValue || "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) plan = parsed;
  } catch (_) {}

  for (const slot of node.inputs) {
    const match = /^__r2v_(content|instruction)_(ref_(?:image|video|video_audio|audio)_\d+)$/.exec(String(slot?.name || ""));
    if (!match || widgetByName(node, slot.name)) continue;
    const field = match[1];
    const referenceName = match[2];
    const value = String(plan?.[referenceName]?.[field] || "");
    const widget = markReferenceUi(node.addWidget(
      "text",
      slot.name,
      value,
      () => {},
      { serialize: false },
    ));
    if (!widget) continue;
    widget.name = slot.name;
    widget.label = slot.name;
    widget.hidden = true;
    widget.options = { ...(widget.options || {}), serialize: false, hidden: true };
    slot.widget = { name: slot.name };
  }
}

function serializedWorkflowSize(info) {
  const size = info?.size;
  if (!size) return null;
  let width = null;
  let height = null;
  if (Array.isArray(size) || (typeof size.length === "number" && size.length >= 2)) {
    width = Number(size[0]);
    height = Number(size[1]);
  } else if (typeof size === "object") {
    width = Number(size.width ?? size[0]);
    height = Number(size.height ?? size[1]);
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function captureSerializedWorkflowGeometry(node, info) {
  const size = serializedWorkflowSize(info);
  if (node && size) SERIALIZED_WORKFLOW_GEOMETRY.set(node, size);
}

function restoreSerializedWorkflowGeometry(node) {
  const size = SERIALIZED_WORKFLOW_GEOMETRY.get(node);
  SERIALIZED_WORKFLOW_GEOMETRY.delete(node);
  if (!size || typeof node?.setSize !== "function") return false;
  node.setSize([size.width, size.height]);
  node.setDirtyCanvas?.(true, true);
  return true;
}

function collapseLegacyExtensionOptionSparseValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = [...(node?.widgets || [])].filter((widget) => !isR2VUiOnlyWidget(widget));
  for (const slot of ["a", "b", "c"]) {
    const anchorIndex = widgets.findIndex((widget) => widget?.name === `person_${slot}_appearance_preset`);
    if (anchorIndex < 0 || anchorIndex >= info.widgets_values.length) continue;
    if (info.widgets_values[anchorIndex] == null) info.widgets_values.splice(anchorIndex, 1);
  }
}

function installPersistenceGuard(nodeType) {
  if (!nodeType?.prototype || nodeType.prototype.__ultraR2VPersistenceGuard) return;
  const originalSerialize = nodeType.prototype.serialize;
  if (typeof originalSerialize === "function") {
    nodeType.prototype.serialize = function (...args) {
      return withBatchedWidgetMutations(this, () => {
        try { flushReferenceUiToPlan(this); } catch (_) {}
        const removed = detachUiOnlyWidgets(this);
        try { return originalSerialize.apply(this, args); }
        finally { restoreUiOnlyWidgets(this, removed); }
      });
    };
  }
  const originalConfigure = nodeType.prototype.configure;
  if (typeof originalConfigure === "function") {
    nodeType.prototype.configure = function (...args) {
      return withBatchedWidgetMutations(this, () => {
        const info = args[0];
        captureSerializedWorkflowGeometry(this, info);
        try { migrateFailedNativeSequentialWorkflow(this, info, { kind: "r2v" }); } catch (_) {}
        try { migrateSequentialCoreTextSchema(this, info, { kind: "r2v" }); } catch (_) {}
        try { collapseLegacyExtensionOptionSparseValues(this, info); } catch (_) {}
        try { migrateV350ShotCameraModifierSerializedValues(this, info); } catch (_) {}
        try { migrateLegacyCameraFramingSerializedValues(this, info); } catch (_) {}

        const savedPlanValue = serializedCoreWidgetValue(this, info, "reference_plan_json");
        const removed = detachUiOnlyWidgets(this);
        let result;
        try { result = originalConfigure.apply(this, args); }
        finally { restoreUiOnlyWidgets(this, removed); }

        const planWidget = widgetByName(this, "reference_plan_json");
        if (planWidget && savedPlanValue !== undefined && savedPlanValue !== null) {
          planWidget.value = savedPlanValue;
        }
        try { restoreSerializedReferenceTextWidgetGuards(this, savedPlanValue); } catch (_) {}
        return result;
      });
    };
  }
  nodeType.prototype.__ultraR2VPersistenceGuard = true;
}


const STRUCTURAL_LOCAL_ONLY_INPUTS = new Set([
  "duration_seconds",
  "person_count",
  "turn_count",
  "person_a_advanced",
  "person_b_advanced",
  "person_c_advanced",
  "camera_sequence_enabled",
  "camera_shot_2_enabled",
  "camera_shot_3_enabled",
  "camera_shot_4_enabled",
  "camera_shot_5_enabled",
  "camera_shot_6_enabled",
]);
const STRUCTURAL_INPUT_CONNECTION_GUARD = "__ultraH3StructuralInputConnectionGuard";

function structuralInputName(input) {
  return String(input?.widget?.name || input?._widget?.name || input?.name || "");
}

function installStructuralInputConnectionGuard(node) {
  if (!node || node.comfyClass !== NODE_CLASS || node[STRUCTURAL_INPUT_CONNECTION_GUARD]) return;
  const originalOnConnectInput = node.onConnectInput;
  node.onConnectInput = function (slotIndex, ...args) {
    const input = Array.isArray(this.inputs) ? this.inputs[slotIndex] : null;
    if (STRUCTURAL_LOCAL_ONLY_INPUTS.has(structuralInputName(input))) return false;
    return typeof originalOnConnectInput === "function"
      ? originalOnConnectInput.call(this, slotIndex, ...args)
      : true;
  };
  try { node[STRUCTURAL_INPUT_CONNECTION_GUARD] = true; } catch (_) {}
}

const HIDDEN_WIDGET_SLOT_RENDER_GUARD = "__ultraH3HiddenWidgetSlotRenderGuard";

function installHiddenWidgetSlotRenderGuard(node) {
  // Keep the known-good TEST4 render behavior, but scope it strictly to this
  // Ultra H3 node class so unrelated ComfyUI/custom nodes are never wrapped.
  if (!node || node.comfyClass !== NODE_CLASS || node[HIDDEN_WIDGET_SLOT_RENDER_GUARD] || typeof node.drawSlots !== "function") return;
  const originalDrawSlots = node.drawSlots;

  const resolveSlotWidget = (owner, slot) => {
    const directWidget = slot?._widget;
    const widgetName = directWidget?.name || slot?.widget?.name;
    if (!widgetName) return null;
    if (directWidget) return directWidget;
    const widgets = Array.isArray(owner?.widgets) ? owner.widgets : [];
    // Match the previous Map construction exactly: duplicate names resolved to
    // the last widget in the array. The fallback path is rare because promoted
    // inputs normally carry slot._widget directly.
    for (let index = widgets.length - 1; index >= 0; index--) {
      const widget = widgets[index];
      if (widget?.name === widgetName) return widget;
    }
    return null;
  };

  node.drawSlots = function (...args) {
    const restored = [];
    try {
      const slots = Array.isArray(this._concreteInputs) ? this._concreteInputs : [];

      for (const slot of slots) {
        const widget = resolveSlotWidget(this, slot);
        if (!widget) continue;

        // Hidden promoted/widget inputs must not become invisible connection
        // targets. Structural controls are local-only because their values
        // determine which dependent rows exist; an external runtime value can
        // differ from widget.value and make the visible UI disagree with Queue.
        if (!slot.__ultraH3HiddenWidgetTargetGuard && typeof slot.isValidTarget === "function") {
          const originalIsValidTarget = slot.isValidTarget;
          slot.isValidTarget = function (...targetArgs) {
            const currentWidget = resolveSlotWidget(node, this);
            if (STRUCTURAL_LOCAL_ONLY_INPUTS.has(structuralInputName(this)) || STRUCTURAL_LOCAL_ONLY_INPUTS.has(String(currentWidget?.name || ""))) return false;
            if (currentWidget && (currentWidget.hidden || currentWidget?.options?.hidden) && !(this?.isConnected || this?.link != null)) return false;
            return originalIsValidTarget.apply(this, targetArgs);
          };
          try { slot.__ultraH3HiddenWidgetTargetGuard = true; } catch (_) {}
        }

        const localOnly = STRUCTURAL_LOCAL_ONLY_INPUTS.has(structuralInputName(slot))
          || STRUCTURAL_LOCAL_ONLY_INPUTS.has(String(widget?.name || ""));
        const connected = Boolean(slot?.isConnected || slot?.link != null);

        // Keep the physical slot object and its index untouched. Structural
        // controls are intentionally local-only, so an unconnected socket dot
        // would only advertise a target that onConnectInput/isValidTarget reject.
        // Suppress drawing that dot without addInput/removeInput, reordering, or
        // changing any existing connected legacy slot. Hidden unconnected widget
        // sockets keep the same established suppression below.
        if (!localOnly && !(widget.hidden || widget?.options?.hidden)) continue;
        if (connected) continue;
        if (typeof slot.draw !== "function") continue;
        const originalDraw = slot.draw;
        restored.push([slot, originalDraw]);
        slot.draw = function () {};
      }

      return originalDrawSlots.apply(this, args);
    } finally {
      for (const [slot, draw] of restored) {
        try { slot.draw = draw; } catch (_) {}
      }
    }
  };

  try { node[HIDDEN_WIDGET_SLOT_RENDER_GUARD] = true; } catch (_) {}
}

function initialize(node, { preserveSceneHeight = true, normalizeReferences = true, captureInitialSceneHeight = true } = {}) {
  installHiddenWidgetSlotRenderGuard(node);
  installStructuralInputConnectionGuard(node);
  if (!node || node.comfyClass !== NODE_CLASS) return;
  const durationWidget = widgetByName(node, "duration_seconds");
  if (durationWidget) durationWidget.value = normalizeWholeSecondDuration(durationWidget.value, 5, 15);
  const state = nodeState(node);
  const basic = basicViewEnabled(node);
  if (basic) collapseAdvancedTogglesForBasicView(node);
  installLocalizedComboDisplay(node);
  refreshCameraFramingLabels(node);
  installScenePromptHelp(node);
  installNativeSceneValidationGate(node);
  installTransientUiLocale(node);
  withBatchedWidgetMutations(node, () => {
    installTranslationApiUi(node, { locale: activeLocale(node), markUiOnly });
    installExtensionTransport(node);
    installExtensionOptions(node, { locale: activeLocale, refreshMetadata: refreshVueWidgetMetadata });
  });
  state.extensionPersonCapacity = r2vActivePersonCountForGroups(node);
  state.extensionTurnCapacity = r2vActiveTurnCountForGroups(node);
  withBatchedWidgetMutations(node, () => installSequentialVocalUi(node, {
    locale: activeLocale,
    onChange: (target) => syncCoreVisibility(target, { preserveSceneHeight: true }),
  }));
  state.lastStaticUiLocale = activeLocale(node);
  installCallbacks(node);
  setWidgetVisible(widgetByName(node, "reference_plan_json"), false);
  removeSectionWidgets(node);
  removeDomActionRow(node);
  ensureViewToggle(node);
  organizeWidgetLayout(node);
  // The backend now uses ComfyUI's flexible-input contract, so no unused
  // reference sockets exist to collapse after creation. Build the four real
  // initial sockets synchronously; this keeps the first painted geometry equal
  // to the final Basic View geometry and removes the old long-node -> shrink
  // transition. On workflow load, serialized dynamic inputs are already present
  // before loadedGraphNode and normalize without a deferred resize pass.
  state.lastDynamicCounts = { ...readDynamicCounts(node) };
  if (captureInitialSceneHeight) {
    const initialSceneHeight = readSceneHeight(node);
    if (initialSceneHeight != null) state.lastSceneHeight = initialSceneHeight;
  }
  if (normalizeReferences) normalizeDynamicInputs(node, { preserveSceneHeight });
  else restoreReferenceUiWithoutCompaction(node);
  installConnectedStringTooltips(node, { inputIndex: widgetInputIndex, inputConnected: widgetInputConnected, locale: activeLocale });
  installValidationBadge(node, {
    isActive: (target) => nativeR2VSceneValidationGateValue(target) === "missing",
    message: nativeR2VSceneValidationBadgeText,
    targetElement: findSceneTextarea,
  });
  // Keep the initial Core/LiteGraph widget width authoritative when the
  // selected-node Properties/App host renders the same legacy widget objects.
  installGraphWidgetHostGeometryGuard(node);
}

// Only the Ultra H3 node class may be touched by this extension's lifecycle
// hooks. ComfyUI calls nodeCreated/loadedGraphNode for EVERY node in the graph,
// so without this gate the hooks wrote H3-only properties into unrelated nodes
// and temporarily rewrote their widgets accessor during workflow loads.
function isUltraH3OwnNode(node) {
  return node?.comfyClass === NODE_CLASS
    || node?.type === NODE_CLASS
    || node?.constructor?.comfyClass === NODE_CLASS;
}

app.registerExtension({
  name: "UltraMiniMaxH3Prompt.R2V",
  beforeConfigureGraph() {
    GRAPH_CONFIGURE_DEPTH += 1;
  },
  afterConfigureGraph() {
    GRAPH_CONFIGURE_DEPTH = Math.max(0, GRAPH_CONFIGURE_DEPTH - 1);
  },
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE_CLASS) return;
    safelyRunUiPhase("beforeRegisterNodeDef", nodeData, () => {
      // The V3.50 main frontend owns a legacy workflow-migration guard and installs
      // it on every node type it encounters. R2V has a different serialized
      // schema, so mark this type as already guarded before installing R2V's own
      // persistence lifecycle. This makes extension load order irrelevant while
      // leaving the existing main-node frontend completely untouched.
      try { nodeType.prototype[MAIN_NODE_PERSISTENCE_GUARD_MARKER] = true; } catch (_) {}
      suppressScenePromptSchemaTooltip(nodeData);
      installCoreWidgetDefaultsNodeData(nodeType, nodeData);
      installProfileSafetyNodeData(nodeType, nodeData);
      installPersistenceGuard(nodeType);
    });
  },
  nodeCreated(node) {
    if (!isUltraH3OwnNode(node)) return;
    safelyRunUiPhase("nodeCreated", node, () => {
      const loadingGraph = GRAPH_CONFIGURE_DEPTH > 0;
      // A graph-loaded node does not yet have its authoritative serialized
      // group/reference state here. Avoid building a temporary layout that will
      // immediately be replaced in loadedGraphNode; that double pass was the
      // source of workflow-switch jumping and could let scene_prompt capture an
      // inflated transient flex height.
      if (loadingGraph) {
        installHiddenWidgetSlotRenderGuard(node);
        return;
      }
      initialize(node, { preserveSceneHeight: true, normalizeReferences: true });
      setBasicViewEnabled(node, true);
      setAllGroupedSectionsCollapsed(node, true, { refresh: false });
      syncCoreVisibility(node, { preserveSceneHeight: false });
      applyFreshSceneCoreGeometry(node);
      initializeFreshResetGeometry(node);
    });
  },
  loadedGraphNode(node) {
    if (!isUltraH3OwnNode(node)) return;
    safelyRunUiPhase("loadedGraphNode", node, () => {
      discardNodeState(node);
      WORKFLOW_LOAD_SETTLING.add(node);
      // One widget-array commit per loaded node: inner batches see the data
      // property installed here and simply run, so frontend 1.53 re-registers
      // the 150+ widget schema once instead of four times per workflow switch.
      withBatchedWidgetMutations(node, () => initialize(node, { preserveSceneHeight: false, normalizeReferences: true, captureInitialSceneHeight: false }));
      restoreSerializedWorkflowGeometry(node);
      // Close the settle window only after Vue has mounted the new graph view
      // and published its ResizeObserver geometry (two double-frame passes).
      afterVueLayout(() => afterVueLayout(() => WORKFLOW_LOAD_SETTLING.delete(node)));
    });
  },
});
