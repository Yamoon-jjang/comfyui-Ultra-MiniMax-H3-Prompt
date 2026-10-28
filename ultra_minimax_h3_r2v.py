from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, Iterable, List, Tuple

from .ultra_minimax_h3_prompt import (
    MAX_CAMERA_SHOTS,
    MAX_TURNS,
    DIALOGUE_LANGUAGE_VALUES,
    STYLE_TEXT,
    UltraMiniMaxH3Prompt,
    VERSION,
    ExecutionBlocker,
    _TranslationDependencyUnavailableError,
    _TranslationRateLimitedError,
    _TranslationNetworkUnavailableError,
    _TranslationUnavailableError,
    _UserInputError,
    _blocked_result,
    _warning_message_from_info,
    _canonical_choice,
    _clean_voice_desc_for_subject,
    _detect_dialogue_language,
    _ensure_terminal_punctuation,
    _estimate_spoken_seconds,
    _dialogue_clearly_exceeds_window,
    _normalize_compound_action_predicate,
    _normalize_timeline_action,
    _translate_korean_descriptive_text_if_needed,
    _validate_int_field,
    _validate_bool_field,
    _snap_half_second,
    _camera_sequence_from_kwargs,
    _parse_extension_options_json,
    _sequential_vocal_from_kwargs,
    _sequential_turn_state,
    _normalize_turn_vocal_events,
    SEQUENTIAL_VOCAL_ADDED_SLOT_DEFAULT_SPEAKER,
    _coerce_speaker_selection_to_active,
    _leading_single_person_reference,
    _leading_composite_person_group,
    _match_leading_generic_human_subject,
    _match_leading_generic_human_group,
    _match_any_leading_generic_human_group,
    _turn_vocal_events,
    _extension_turn_scene,
    _extension_has_explicit_environment_state,
    TURN_SCENE_KEEP,
)

R2V_MAX_IMAGES = 9
R2V_MAX_VIDEOS = 3
R2V_MAX_AUDIOS = 3
R2V_MAX_DURATION_SECONDS = 15
R2V_MIN_REFERENCE_DURATION_SECONDS = 2.0
R2V_MAX_REFERENCE_DURATION_SECONDS = 15.0
R2V_MAX_REFERENCE_TOTAL_DURATION_SECONDS = 15.0

# Dialogue-content Audio can optionally target one concrete Timeline speaker.
# `auto` preserves the legacy shot-wide behavior; explicit targets allow two or
# more independent source clips to provide different exact lines inside one Shot.
DIALOGUE_TARGET_VALUES = (
    "auto", "A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "Narrator",
)


_REFERENCE_TEXT_INPUT_RE = re.compile(
    r"^__r2v_(content|instruction)_(ref_(?:image|video|video_audio|audio)_\d+)$"
)


class _ContainsAnyDict(dict):
    """ComfyUI V1 adapter for JS-created R2V reference sockets.

    Current ComfyUI first checks membership and then indexes the optional-input
    mapping directly. Dynamic sockets therefore need both operations: the
    membership test accepts supported ``ref_*`` names, and ``__getitem__``
    returns the concrete backend socket type for graph dependency/type lookup.
    """

    _IMAGE_INPUT_RE = re.compile(r"^ref_image_\d+$")
    _VIDEO_INPUT_RE = re.compile(r"^ref_video_\d+$")
    _AUDIO_INPUT_RE = re.compile(r"^ref_(?:video_audio|audio)_\d+$")
    _TEXT_INPUT_RE = _REFERENCE_TEXT_INPUT_RE

    def __contains__(self, key):
        # Explicitly declared Core inputs must retain their concrete schema
        # entries while the flexible tail still accepts JS-autogrown sockets.
        if dict.__contains__(self, key):
            return True
        name = str(key or "")
        return bool(
            self._IMAGE_INPUT_RE.fullmatch(name)
            or self._VIDEO_INPUT_RE.fullmatch(name)
            or self._AUDIO_INPUT_RE.fullmatch(name)
            or self._TEXT_INPUT_RE.fullmatch(name)
        )

    def __getitem__(self, key):
        # Core-seeded sockets use the exact schema returned by INPUT_TYPES; only
        # names created later by the frontend fall through to the flexible type
        # adapter.  This mirrors Main's normal Core-owned connection lifecycle
        # for the four always-visible R2V sockets without losing autogrow.
        if dict.__contains__(self, key):
            return dict.__getitem__(self, key)
        name = str(key or "")
        if self._IMAGE_INPUT_RE.fullmatch(name):
            return ("IMAGE",)
        if self._VIDEO_INPUT_RE.fullmatch(name):
            return ("VIDEO",)
        if self._AUDIO_INPUT_RE.fullmatch(name):
            return ("AUDIO",)
        if self._TEXT_INPUT_RE.fullmatch(name):
            return ("STRING",)
        raise KeyError(key)

IMAGE_ROLE_VALUES = (
    "general_reference",
    "person_a_identity",
    "person_b_identity",
    "person_c_identity",
    "person_a_clothing",
    "person_b_clothing",
    "person_c_clothing",
    "person_a_pose_expression",
    "person_b_pose_expression",
    "person_c_pose_expression",
    "scene_environment",
    "animal_nonhuman_subject",
    "style_reference",
    "object_prop",
    "visual_effect",
    "interface_visible_text",
    "first_frame_anchor",
    "keyframe_anchor",
    "edited_keyframe_anchor",
    "last_frame_anchor",
    "composition_anchor",
    "storyboard",
    "custom",
)
VIDEO_ROLE_VALUES = (
    "general_reference",
    "person_a_identity",
    "person_b_identity",
    "person_c_identity",
    "person_a_clothing",
    "person_b_clothing",
    "person_c_clothing",
    "person_a_motion",
    "person_b_motion",
    "person_c_motion",
    "scene_environment",
    "animal_nonhuman_subject",
    "object_prop",
    "visual_effect",
    "interface_visible_text",
    "camera_motion",
    "cuts_rhythm",
    "style_reference",
    "video_edit_source",
    "video_continuation_source",
    "custom",
)
AUDIO_ROLE_VALUES = (
    "general_reference",
    "person_a_voice",
    "person_b_voice",
    "person_c_voice",
    "narrator_voice",
    "music_style",
    "sound_effects",
    "rhythm_timing",
    "audio_continuity",
    "dialogue_content",
    "full_audio_reuse",
    "partial_audio_reuse",
    "custom",
)

VISUAL_RELATION_VALUES = (
    "auto",
    "fully_preserved",
    "partially_preserved",
    "attribute_transfer",
    "weak_reference",
)
AUDIO_RELATION_VALUES = (
    "auto",
    "fully_copy",
    "partially_copy",
    "reference",
    "weak_reference",
)

# Non-person visible references may show several views of one target subject.
# H3 allows one <Subject N> to be defined by multiple source assets.
SUBJECT_GROUP_VALUES = ("auto", "shared_1", "shared_2", "shared_3", "shared_4", "shared_5", "shared_6")
GROUPABLE_SUBJECT_ROLES = {
    "scene_environment", "animal_nonhuman_subject", "style_reference", "object_prop",
    "visual_effect", "interface_visible_text", "general_reference", "custom",
}

def _build_r2v_scope_values(max_shots: int) -> Tuple[str, ...]:
    count = max(1, int(max_shots))
    values: List[str] = ["auto", "all_shots"]
    values.extend(f"shot_{shot}" for shot in range(1, count + 1))
    full_mask = (1 << count) - 1
    for mask in range(1, full_mask):
        shots = [shot for shot in range(1, count + 1) if mask & (1 << (shot - 1))]
        if len(shots) >= 2:
            values.append("shots_" + "_".join(str(shot) for shot in shots))
    return tuple(values)


R2V_SCOPE_VALUES = _build_r2v_scope_values(MAX_CAMERA_SHOTS)

_DYNAMIC_INPUT_RE = re.compile(r"^(ref_image|ref_video|ref_video_audio|ref_audio)_(\d+)$")
_R2V_RESERVED_USER_RE = re.compile(
    r"(?i)(?:subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music)\s*:|"
    r"<(?:Subject|Picture|Video|Audio)\s+\d+>|"
    r"\[Shot\s+\d+\]|<(?:/?d|scenetrans|cutoff)>|\(S\d+\)"
)


def _reject_r2v_reserved_user_text(text: Any, field_name: str) -> None:
    value = str(text or "")
    if _R2V_RESERVED_USER_RE.search(value):
        raise _UserInputError(
            f"{field_name} contains reserved MiniMax H3 R2V structure. Enter plain descriptive text only; "
            "this node assigns the six full-reference sections and <Subject>/<Picture>/<Video>/<Audio> labels automatically."
        )



def _asset_sort_key(name: str) -> Tuple[int, int]:
    match = _DYNAMIC_INPUT_RE.match(name)
    if not match:
        return (99, 999)
    order = {"ref_image": 0, "ref_video": 1, "ref_video_audio": 2, "ref_audio": 3}
    return order[match.group(1)], int(match.group(2))


def _connected_assets(kwargs: Dict[str, Any]) -> Dict[str, List[str]]:
    groups = {"ref_image": [], "ref_video": [], "ref_video_audio": [], "ref_audio": []}
    for name, value in kwargs.items():
        match = _DYNAMIC_INPUT_RE.match(name)
        if not match or value is None:
            continue
        groups[match.group(1)].append(name)
    for values in groups.values():
        values.sort(key=_asset_sort_key)
    return groups


def _apply_reference_text_inputs(
    plan: Dict[str, Dict[str, str]],
    kwargs: Dict[str, Any],
    connected_names: Iterable[str],
) -> Dict[str, Dict[str, str]]:
    """Overlay widget/STRING-input values onto the matching connected reference.

    R2V keeps its compact inline Reference UI as the serialized source of truth.
    The frontend also exposes those same content/instruction widgets as ComfyUI
    STRING widget-input sockets. When ComfyUI supplies one of those values here
    (inline widget value or a connected Text node), it becomes authoritative for
    that field without changing any other reference-plan semantics.
    """

    connected = set(connected_names)
    out = {name: dict(entry) for name, entry in plan.items()}
    for input_name, value in kwargs.items():
        match = _REFERENCE_TEXT_INPUT_RE.fullmatch(str(input_name or ""))
        if not match:
            continue
        field_name, reference_name = match.groups()
        if reference_name not in connected:
            continue
        entry = out.setdefault(reference_name, {})
        entry[field_name] = _clean_plan_text(
            value,
            f"{reference_name}_reference_{field_name}",
        )
    return out


def _clean_plan_text(value: Any, field_name: str, max_chars: int = 4_000) -> str:
    text = str(value or "").replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(text) > max_chars:
        raise _UserInputError(f"{field_name} is too long; keep it within {max_chars} characters.")
    _reject_r2v_reserved_user_text(text, field_name)
    return text


_SCAFFOLD_NON_KOREAN_SCENE_NOTICE = "scene_translate was enabled but scene_prompt already appears non-Korean; no translation request was made."


def _parse_reference_plan(raw: Any) -> Dict[str, Dict[str, str]]:
    raw_text = str(raw or "")
    if not raw_text.strip():
        return {}
    if len(raw_text) > 160_000:
        raise _UserInputError("R2V reference settings are unexpectedly large; reconnect references or reset the R2V reference settings.")
    try:
        payload = json.loads(raw_text)
    except Exception as exc:
        raise _UserInputError(f"R2V reference settings are corrupted and could not be read: {exc}") from exc
    if not isinstance(payload, dict):
        raise _UserInputError("R2V reference settings must be a JSON object.")
    out: Dict[str, Dict[str, str]] = {}
    for name, entry in payload.items():
        if not _DYNAMIC_INPUT_RE.match(str(name)) or not isinstance(entry, dict):
            continue
        role = str(entry.get("role", "")).strip()
        scope = str(entry.get("scope", "auto") or "auto").strip()
        relationship = str(entry.get("relationship", "auto") or "auto").strip()
        subject_group = str(entry.get("subject_group", "auto") or "auto").strip()
        dialogue_target = str(entry.get("dialogue_target", "auto") or "auto").strip()
        # Backward compatibility: earlier R2V builds stored one `note`. Treat it
        # as the target-use instruction rather than pretending it described the
        # unseen source media itself.
        legacy_note = entry.get("note", "")
        content = _clean_plan_text(entry.get("content", ""), f"{name}_reference_content")
        instruction = _clean_plan_text(entry.get("instruction", legacy_note), f"{name}_reference_instruction")
        out[str(name)] = {
            "role": role,
            "scope": scope,
            "relationship": relationship,
            "subject_group": subject_group,
            "dialogue_target": dialogue_target,
            "content": content,
            "instruction": instruction,
        }
    return out


def _default_role(name: str) -> str:
    if name.startswith("ref_image_"):
        return "general_reference"
    if name.startswith("ref_video_audio_") or name.startswith("ref_audio_"):
        return "general_reference"
    if name.startswith("ref_video_"):
        return "general_reference"
    return "general_reference"


def _role_values_for(name: str) -> Tuple[str, ...]:
    if name.startswith("ref_image_"):
        return IMAGE_ROLE_VALUES
    if name.startswith("ref_video_audio_") or name.startswith("ref_audio_"):
        return AUDIO_ROLE_VALUES
    if name.startswith("ref_video_"):
        return VIDEO_ROLE_VALUES
    return ("general_reference",)


def _is_audio_input(name: str) -> bool:
    return name.startswith("ref_audio_") or name.startswith("ref_video_audio_")


def _default_relationship(name: str, role: str) -> str:
    if _is_audio_input(name):
        if role == "full_audio_reuse":
            return "fully_copy"
        if role == "partial_audio_reuse":
            return "partially_copy"
        if role in {"general_reference", "custom"}:
            return "weak_reference"
        return "reference"
    if role in {"first_frame_anchor", "keyframe_anchor", "last_frame_anchor", "composition_anchor", "person_a_identity", "person_b_identity", "person_c_identity", "person_a_clothing", "person_b_clothing", "person_c_clothing", "object_prop", "animal_nonhuman_subject", "interface_visible_text", "video_continuation_source"}:
        return "fully_preserved"
    if role == "edited_keyframe_anchor":
        return "partially_preserved"
    if role in {"scene_environment", "visual_effect", "person_a_pose_expression", "person_b_pose_expression", "person_c_pose_expression", "person_a_motion", "person_b_motion", "person_c_motion", "video_edit_source"}:
        return "partially_preserved"
    return "weak_reference"


def _allowed_relationships(name: str, role: str) -> Tuple[str, ...]:
    if _is_audio_input(name):
        if role == "full_audio_reuse":
            return ("auto", "fully_copy")
        if role == "partial_audio_reuse":
            return ("auto", "partially_copy")
        return ("auto", "reference", "weak_reference")
    if role in {"first_frame_anchor", "keyframe_anchor", "last_frame_anchor", "composition_anchor"}:
        return ("auto", "fully_preserved")
    if role == "edited_keyframe_anchor":
        return ("auto", "partially_preserved")
    if role in {"storyboard", "style_reference", "camera_motion", "cuts_rhythm", "general_reference", "custom"}:
        return ("auto", "fully_preserved", "partially_preserved", "weak_reference")
    if role in {"video_edit_source"}:
        return ("auto", "fully_preserved", "partially_preserved")
    if role in {"video_continuation_source", "scene_environment", "animal_nonhuman_subject", "object_prop", "visual_effect", "interface_visible_text"}:
        return ("auto", "fully_preserved", "partially_preserved", "weak_reference")
    if role.startswith("person_"):
        return ("auto", "fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference")
    return VISUAL_RELATION_VALUES


def _resolve_relationship(name: str, role: str, raw: str) -> str:
    allowed = _allowed_relationships(name, role)
    relationship = _canonical_choice(raw or "auto", allowed, f"{name}_relationship")
    return _default_relationship(name, role) if relationship == "auto" else relationship


def _normalize_reference_audio_dialogue_text(text: str) -> str:
    """Apply MiniMax Full-Reference punctuation rules without rewriting words.

    Ref2VA exact dialogue/lyrics preserve the source words and language, while
    punctuation is standardized to ordinary written marks.  This is deliberately
    separate from Timeline dialogue, whose user-authored punctuation stays
    verbatim under the base H3 prompt-writing rule.
    """
    value = re.sub(r"\s+", " ", str(text or "")).strip()
    if not value:
        return ""
    # Normalize common full-width sentence punctuation before reducing repeated
    # decorative runs.  Do not alter letters, numbers, or source-language words.
    value = value.translate(str.maketrans({"，": ",", "。": ".", "？": "?", "！": "!"}))
    value = re.sub(r"[~～]+", "", value)
    value = re.sub(r"[•●▪◦]+", " ", value)
    # Emoji/pictographic decorations are outside the basic written punctuation
    # allowed by the official Full-Reference dialogue rule.
    value = re.sub(
        "["
        "\U0001F000-\U0001FAFF"
        "\U00002600-\U000027BF"
        "]+",
        "",
        value,
    )
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"([!?.,])\1+", r"\1", value)
    value = re.sub(r"[!?]{2,}", lambda match: "?" if "?" in match.group(0) else "!", value)
    value = re.sub(r"\s+([,?.!])", r"\1", value)
    # Decorative terminal combinations such as ``??...`` or ``!!...`` are
    # reduced to one ordinary sentence mark instead of producing ``?.``/``!.``.
    value = re.sub(r"([?!])\.+", r"\1", value)
    value = re.sub(r"\.([?!])", r"\1", value)
    value = re.sub(r"([,?.!])(?=[^\s,?.!])", r"\1 ", value)
    value = value.strip()
    if value and value[-1] not in ".?!":
        value += "."
    return value


def _reference_dialogue_markup(text: str) -> str:
    """Wrap reference-audio dialogue using the official Ref2VA text policy."""
    raw = str(text or "").strip()
    if not raw:
        return ""
    language = _detect_dialogue_language(raw)
    value = _normalize_reference_audio_dialogue_text(raw)
    return f"<d>[{language}] {value}</d>" if value else ""


def _normalize_r2v_dialogue_markup(
    text: str,
    preserve_exact: Iterable[Tuple[str, str]] = (),
) -> str:
    """Normalize only unprotected legacy/generated dialogue markup.

    User-authored Timeline dialogue is passed in ``preserve_exact`` and remains
    verbatim. Reference-audio ``dialogue_content`` is intentionally *not*
    protected here: its words/language are preserved, while its presentation
    punctuation follows the stricter Full-Reference rule before/while wrapping.
    """

    protected = {(str(language).strip(), str(value)) for language, value in preserve_exact if str(value)}
    pattern = re.compile(r"<d>\[([^\]]+)\]\s*(.*?)</d>", re.S)

    def replace(match: re.Match[str]) -> str:
        language = match.group(1).strip()
        raw_value = match.group(2)
        if (language, raw_value) in protected:
            return f"<d>[{language}] {raw_value}</d>"
        value = re.sub(r"\s+", " ", raw_value).strip()
        # Remove common decorative marks without attempting semantic rewriting.
        value = re.sub(r"[~～]+", "", value).strip()
        value = re.sub(r"[•●▪◦]+", " ", value)
        value = re.sub(r"\s+", " ", value).strip()
        value = re.sub(r"([!?.,。！？])\1+", r"\1", value)
        value = _ensure_terminal_punctuation(value)
        return f"<d>[{language}] {value}</d>"

    return pattern.sub(replace, text or "")


def _flatten_r2v_vocal_events(events: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flat: List[Dict[str, Any]] = []
    for turn in events:
        for vocal in _turn_vocal_events(turn):
            item = dict(vocal)
            item["shot"] = int(turn.get("shot", 1) or 1)
            item["elapsed_seconds"] = float(turn.get("elapsed_seconds", 0.0) or 0.0)
            item["turn_speaker"] = str(turn.get("speaker", "A") or "A")
            flat.append(item)
    flat.sort(key=lambda item: (
        int(item.get("shot", 1)), float(item.get("elapsed_seconds", 0.0)),
        int(item.get("source_turn_index", 0)), int(item.get("slot_index", 1)),
    ))
    return flat


def _protect_timeline_dialogue_markup(
    text: str,
    events: Iterable[Dict[str, Any]],
) -> Tuple[str, Dict[str, Tuple[str, str, str]]]:
    """Protect each real Timeline VocalEvent independently before Audio injection."""
    out = str(text or "")
    mappings: Dict[str, Tuple[str, str, str]] = {}
    cursor = 0
    for event in _flatten_r2v_vocal_events(events):
        event_id = str(event.get("event_id") or f"T{event.get('source_turn_index', 0)}-V{event.get('slot_index', 1)}")
        dialogue = str(event.get("text", "") or "")
        if not dialogue or event_id in mappings:
            continue
        language = str(event.get("language", "auto") or "auto")
        if language == "auto":
            language = _detect_dialogue_language(dialogue)
        markup = f"<d>[{language}] {dialogue}</d>"
        index = out.find(markup, cursor)
        if index < 0:
            index = out.find(markup)
        if index < 0:
            continue
        safe_id = re.sub(r"[^A-Za-z0-9]", "", event_id)
        placeholder = f"ZXQH3TIMELINEDLG{safe_id}QXZ"
        out = out[:index] + placeholder + out[index + len(markup):]
        mappings[event_id] = (placeholder, language, dialogue)
        cursor = index + len(placeholder)
    return out, mappings


def _restore_timeline_dialogue_markup(
    text: str,
    mappings: Dict[str, Tuple[str, str, str]],
    reference_bound_events: Iterable[str] = (),
) -> str:
    """Restore Timeline dialogue using event-level, not Turn-level, binding."""
    out = str(text or "")
    normalized_events = {str(value) for value in reference_bound_events}
    for event_id, (placeholder, language, dialogue) in mappings.items():
        if event_id in normalized_events:
            normalized = _normalize_reference_audio_dialogue_text(dialogue)
            markup = f"<d>[{language}] {normalized}</d>" if normalized else ""
        else:
            markup = f"<d>[{language}] {dialogue}</d>"
        out = out.replace(placeholder, markup, 1)
    return out


def _active_shot_count(kwargs: Dict[str, Any]) -> int:
    if not _validate_bool_field(kwargs.get("camera_sequence_enabled", False), "camera_sequence_enabled"):
        return 1
    turn_count = _validate_int_field(kwargs.get("turn_count", 1), "turn_count", 1, MAX_TURNS)
    count, _ = _camera_sequence_from_kwargs(kwargs, kwargs.get("duration_seconds", 5))
    return count


def _shot_start_times(kwargs: Dict[str, Any], shot_count: int) -> List[float]:
    if shot_count <= 1:
        return [0.0]
    turn_count = _validate_int_field(kwargs.get("turn_count", 1), "turn_count", 1, MAX_TURNS)
    derived_count, specs = _camera_sequence_from_kwargs(kwargs, kwargs.get("duration_seconds", 5))
    if derived_count != shot_count:
        raise _UserInputError("R2V active Shot state changed while resolving Timeline timing. Recheck the Shot enable settings.")
    return [0.0] + [float(spec["start"]) for spec in specs]

def _shot_for_elapsed(kwargs: Dict[str, Any], elapsed: float, shot_count: int) -> int:
    starts = _shot_start_times(kwargs, shot_count)
    shot = 1
    for index, start in enumerate(starts[1:], start=2):
        if elapsed + 1e-9 >= start:
            shot = index
        else:
            break
    return shot


def _r2v_action_required_person_count(action: str) -> int:
    """Return the minimum explicit cast size demanded by an R2V action.

    person_count=0 is a first-class R2V mode for products, objects, animals and
    environments.  Do not invent Person A merely because a Timeline row contains
    text.  Promote the cast only when the action itself explicitly names a Person
    or unmistakably uses human-subject wording.
    """
    raw = str(action or "").strip()
    if not raw:
        return 0

    explicit_group, _ = _leading_composite_person_group(raw)
    if explicit_group:
        return max({"A": 1, "B": 2, "C": 3}[slot] for slot in explicit_group)
    explicit_single, _ = _leading_single_person_reference(raw)
    if explicit_single:
        return {"A": 1, "B": 2, "C": 3}[explicit_single]

    # Counted/coordinated generic human subjects are explicit enough to promote
    # a people-free project, but arbitrary object/environment prose is not.
    generic_group = _match_any_leading_generic_human_group(raw)
    if generic_group:
        return min(3, int(generic_group.get("count") or (2 if generic_group.get("bare_plural") else 1)))
    if _match_leading_generic_human_subject(raw):
        return 1
    if re.match(
        r"(?i)^\s*(?:the\s+on-screen\s+(?:person|people|persons)|the\s+visible\s+subjects?)\b",
        raw,
    ):
        return 1
    # Bare pronouns are not enough evidence to invent a Person cast in R2V.
    # With person_count=0, ``he/she/they`` may refer to an animal or an object
    # established by the reference/scene. Preserve that action as people-free.
    return 0


def _r2v_preferred_speaker_for_explicit_action(action: str, person_count: int) -> str:
    """Choose a deterministic visible target when person_count=0 was auto-promoted."""
    raw = str(action or "").strip()
    if not raw or int(person_count) <= 0:
        return ""
    explicit_group, _ = _leading_composite_person_group(raw)
    if explicit_group:
        active = [slot for slot in explicit_group if {"A": 1, "B": 2, "C": 3}[slot] <= int(person_count)]
        return "+".join(active) if active else "A"
    explicit_single, _ = _leading_single_person_reference(raw)
    if explicit_single and {"A": 1, "B": 2, "C": 3}[explicit_single] <= int(person_count):
        return explicit_single
    generic_group = _match_any_leading_generic_human_group(raw)
    if generic_group:
        count = min(3, int(generic_group.get("count") or (2 if generic_group.get("bare_plural") else 1)))
        return "+".join(("A", "B", "C")[: min(count, int(person_count))])
    if _match_leading_generic_human_subject(raw) or re.match(
        r"(?i)^\s*(?:the\s+on-screen\s+(?:person|people|persons)|the\s+visible\s+subjects?)\b",
        raw,
    ):
        return "A"
    return ""


_R2V_BARE_ACTION_VERB_RE = re.compile(
    r"(?i)^(?:rolls?|rotates?|spins?|opens?|closes?|moves?|slides?|rises?|falls?|tilts?|turns?|"
    r"unfolds?|folds?|expands?|contracts?|glows?|flashes?|pulses?|vibrates?|shakes?|sways?|"
    r"floats?|drifts?|accelerates?|decelerates?|stops?|starts?|descends?|ascends?|approaches?|"
    r"recedes?|swings?|bounces?|bursts?|melts?|pours?|flows?|emerges?|appears?|disappears?)\b"
)


def _r2v_bind_people_free_action_subject(text: str, field: str, warnings: List[str]) -> str:
    """Bind only high-confidence bare verb fragments to a neutral visible subject."""
    raw = str(text or "").strip()
    if not raw or not _R2V_BARE_ACTION_VERB_RE.match(raw):
        return raw
    warnings.append(
        f"{field}: a people-free action began with a bare verb fragment; it was bound to a neutral visible subject for grammatical clarity."
    )
    return "The visible subject " + raw[:1].lower() + raw[1:]


def _r2v_people_free_action_clause(
    action: str, elapsed: float, field: str, warnings: List[str], *, translate_mode: str = "ko_to_en"
) -> str:
    """Render an object/environment Timeline action without creating Person A."""
    raw = str(action or "").strip()
    if not raw:
        return ""
    translated, translate_warnings = _translate_korean_descriptive_text_if_needed(
        raw, field, translate_mode=translate_mode
    )
    warnings.extend(translate_warnings)
    translated = str(translated or "").strip()
    if not translated:
        return ""
    # Keep people-free R2V actions on the exact same structural-safety path as
    # Main Timeline actions.  The dedicated renderer must not become a bypass
    # for reserved [Shot]/<d>/<scenetrans> markup.
    translated, action_warnings = _normalize_timeline_action(translated, field)
    warnings.extend(action_warnings)
    if not translated:
        return ""
    translated = _r2v_bind_people_free_action_subject(translated, field, warnings)
    if float(elapsed) <= 0:
        return translated
    return f"At approximately {float(elapsed):.2f} seconds, {translated[:1].lower() + translated[1:] if translated else translated}"


def _r2v_timeline_events(
    kwargs: Dict[str, Any],
    duration: int,
    shot_count: int,
    extension_options: Dict[str, Any] | None = None,
    sequential_vocal: Dict[str, Any] | None = None,
    person_count: int = 1,
    warnings: List[str] | None = None,
) -> List[Dict[str, Any]]:
    turn_count = _validate_int_field(kwargs.get("turn_count", 1), "turn_count", 1, MAX_TURNS)
    events: List[Dict[str, Any]] = []
    max_start = max(0.0, float(duration) - 0.5)
    sequential_vocal = sequential_vocal or {}
    warnings = warnings if warnings is not None else []
    for index in range(1, turn_count + 1):
        speaker = str(kwargs.get(f"turn_{index}_speaker", "A") or "A").strip()
        if speaker not in DIALOGUE_TARGET_VALUES[1:]:
            raise _UserInputError(f"Unsupported R2V Timeline speaker: {speaker}")
        if int(person_count) <= 0:
            # R2V exposes Narrator as the only speaker when person_count=0. A/B/C
            # values can remain in old workflows or hidden Core state; treating
            # them as visible people would create a phantom cast.
            if speaker != "Narrator":
                warnings.append(
                    f"Progress {index}: person_count=0 allows only the independent Narrator; stale target {speaker} was repaired to Narrator."
                )
                speaker = "Narrator"
        elif speaker != "Narrator":
            repaired_speaker = _coerce_speaker_selection_to_active(speaker, int(person_count))
            if repaired_speaker != speaker:
                warnings.append(
                    f"Progress {index}: target {speaker} was outside person_count={person_count}; it was repaired to {repaired_speaker}."
                )
                speaker = repaired_speaker
        action = str(kwargs.get(f"turn_{index}_action", "") or "").strip()
        dialogue = str(kwargs.get(f"turn_{index}_dialogue_text", "") or "").strip()
        language = _canonical_choice(
            kwargs.get(f"turn_{index}_dialogue_language", "auto"),
            DIALOGUE_LANGUAGE_VALUES,
            "dialogue_language",
        )
        delivery = str(kwargs.get(f"turn_{index}_dialogue_delivery", "on_screen") or "on_screen")
        turn_scene = _extension_turn_scene(extension_options or {}, index)
        has_scene_change = any(value != TURN_SCENE_KEEP for value in turn_scene.values())
        seq_turn = _sequential_turn_state(sequential_vocal, index)
        has_seq_dialogue = any(str(seq_turn.get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
        if not action and not dialogue and not has_seq_dialogue and not has_scene_change:
            continue
        raw_elapsed = kwargs.get(f"turn_{index}_elapsed_seconds", 0.0)
        try:
            elapsed = float(raw_elapsed)
        except (TypeError, ValueError):
            elapsed = float("nan")
        if not math.isfinite(elapsed):
            warnings.append(
                f"Progress {index}: start time {raw_elapsed!r} was not a usable number; it was repaired to 0.0s."
            )
            elapsed = 0.0
        repaired_elapsed = min(max(elapsed, 0.0), max_start)
        repaired_elapsed = _snap_half_second(repaired_elapsed)
        repaired_elapsed = min(max(repaired_elapsed, 0.0), max_start)
        if abs(repaired_elapsed - elapsed) > 1e-9:
            warnings.append(
                f"Progress {index}: start time {elapsed:.3f}s was outside the usable 0.5-second Timeline grid; it was repaired to {repaired_elapsed:.1f}s."
            )
            elapsed = repaired_elapsed
        event = {
            "source_turn_index": index,
            "speaker": speaker,
            "elapsed_seconds": elapsed,
            "shot": _shot_for_elapsed(kwargs, elapsed, shot_count),
            "action": action,
            "dialogue_text": dialogue,
            "dialogue_language": language,
            "dialogue_delivery": delivery,
            "sequential_vocal": dict(seq_turn),
            "scene_location_override": turn_scene["location"],
            "scene_weather_override": turn_scene["weather"],
            "people_free_action": bool(action) and int(person_count) <= 0,
        }
        if speaker == "Narrator":
            # Legacy R2V Narrator rows are a special action-less target. Model
            # them as the same common VocalEvent identity used by the new UI.
            raw_events = []
            if seq_turn:
                raw_events.append((1, dialogue, language))
                for slot in (2, 3):
                    raw_events.append((slot, str(seq_turn.get(f"text_{slot}", "") or ""), str(seq_turn.get(f"language_{slot}", "auto") or "auto")))
            else:
                raw_events.append((1, dialogue, language))
            vocal_events = []
            for slot, text, lang in raw_events:
                if not str(text or "").strip():
                    continue
                vocal_events.append({
                    "event_id": f"T{index}-V{slot}", "source_turn_index": index, "slot_index": slot,
                    "speaker": "Narrator", "text": str(text), "language": lang, "delivery": "narrator",
                })
            event["vocal_events"] = vocal_events
        else:
            event["vocal_events"] = _normalize_turn_vocal_events(
                event, max(1, int(person_count)), preserve_verbatim=True
            )
        events.append(event)
    events.sort(key=lambda item: (float(item["elapsed_seconds"]), int(item["source_turn_index"])))
    return events


def _validate_r2v_narrator_dialogue_timing(
    narrator_events: List[Dict[str, Any]],
    kwargs: Dict[str, Any],
    duration: float,
    shot_count: int,
    warnings: List[str],
) -> None:
    """Apply the Main dialogue timing contract to R2V-only Narrator rows."""
    if not narrator_events:
        return
    starts = _shot_start_times(kwargs, shot_count)
    for event in narrator_events:
        dialogue = str(event.get("dialogue_text", "") or "").strip()
        if not dialogue:
            continue
        elapsed = float(event.get("elapsed_seconds", 0.0))
        shot = int(event.get("shot", 1) or 1)
        estimated = _estimate_spoken_seconds(dialogue)
        if shot < shot_count:
            available = max(0.0, float(starts[shot]) - elapsed)
            if _dialogue_clearly_exceeds_window(dialogue, available):
                warnings.append(
                    f"Turn {event['source_turn_index']} Narrator dialogue is longer than the {available:.1f}s window before the next Shot even at a very fast speaking pace; "
                    "prompt generation continued without inventing cross-cut speech markers."
                )
            if estimated > available * 1.10:
                warnings.append(
                    f"Turn {event['source_turn_index']} Narrator dialogue is estimated at about {estimated:.1f}s, "
                    f"but the next Shot starts only {available:.1f}s later; the spoken line may cross the cut. "
                    "Shorten/re-time the line or move the Shot boundary when cross-cut speech is not intentional."
                )
        else:
            remaining = max(0.0, float(duration) - elapsed)
            if _dialogue_clearly_exceeds_window(dialogue, remaining):
                warnings.append(
                    f"Turn {event['source_turn_index']} Narrator dialogue is longer than the remaining {remaining:.1f}s even at a very fast speaking pace; "
                    "prompt generation continued without inventing a cutoff."
                )
            if estimated > remaining * 1.10:
                warnings.append(
                    f"Turn {event['source_turn_index']} Narrator dialogue is estimated at about {estimated:.1f}s, "
                    f"but only about {remaining:.1f}s remains after its start time; the line may reach the video end."
                )



def _r2v_single_paragraph_phase_groups(raw: str, shot_count: int) -> Dict[int, str]:
    """Split one clearly chronological paragraph only when explicit phase cues exist.

    This stays intentionally conservative. It activates only when a single scene
    paragraph contains an explicit middle-phase cue and an explicit ending cue,
    allowing us to keep future-only events out of Shot 1 without trying to infer
    arbitrary semantic structure from ordinary descriptive prose.
    """
    text = re.sub(r"\s+", " ", str(raw or "")).strip()
    if not text or int(shot_count) < 2:
        return {}
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    if len(sentences) < 3:
        return {}

    end_cue = re.compile(r"(?i)^\s*(?:by the end|in the end|finally|eventually|at the end)\b|^(?:마지막(?:에는)?|끝에는|마침내)")
    middle_cue = re.compile(r"(?i)^\s*(?:then|next|afterwards?|later)\b|^(?:그다음|다음|이후|그러자)")

    end_indices = [idx for idx, sentence in enumerate(sentences) if end_cue.search(sentence)]
    if not end_indices:
        return {}
    middle_indices = [idx for idx, sentence in enumerate(sentences) if middle_cue.search(sentence)]
    if int(shot_count) >= 3 and not middle_indices:
        return {}

    groups: Dict[int, List[str]] = {1: [], 2: [], 3: []}
    phase = 1
    first_middle = middle_indices[0] if middle_indices else None
    first_end = end_indices[0]
    for idx, sentence in enumerate(sentences):
        if int(shot_count) >= 3 and first_middle is not None and idx >= first_middle:
            phase = max(phase, 2)
        if idx >= first_end:
            phase = max(phase, 3 if int(shot_count) >= 3 else 2)
        groups[phase].append(sentence)

    result = {shot: " ".join(values).strip() for shot, values in groups.items() if values}
    if int(shot_count) >= 3 and (1 not in result or 2 not in result or 3 not in result):
        return {}
    if int(shot_count) == 2 and (1 not in result or 2 not in result):
        return {}
    return {shot: result[shot] for shot in range(1, min(int(shot_count), 3) + 1) if shot in result}


def _r2v_scene_phase_paragraphs(scene_prompt: Any, shot_count: int, timeline_events: Iterable[Dict[str, Any]]) -> Dict[int, str]:
    """Conservatively distribute clearly chronological scene prose by Shot.

    Full-reference detailed_description must stay in playback order. A common
    R2V scene_prompt may be written either as several blank-line-separated
    phases or as one paragraph with explicit temporal cues. Timeline rows
    provide the concrete shot times. Feeding the whole story to the inherited
    compiler places every future phase inside Shot 1 before later Shot headers,
    so we redistribute only when the chronology is explicit. Ordinary purely
    descriptive scene prompts keep the established behavior unchanged.
    """
    raw = str(scene_prompt or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if int(shot_count) < 2 or not raw:
        return {}
    active_action_shots = {int(event.get("shot", 1)) for event in timeline_events if str(event.get("action", "") or "").strip()}
    if len(active_action_shots) < 2:
        return {}
    paragraphs = [re.sub(r"\s+", " ", part).strip() for part in re.split(r"\n\s*\n+", raw) if part.strip()]
    cue_re = re.compile(
        r"(?i)\b(?:at first|initially|then|next|afterwards?|later|by the end|in the end|finally|eventually)\b|"
        r"(?:처음|초반|그다음|다음|이후|중반|후반|마지막|끝에는|마침내)"
    )
    if len(paragraphs) >= 2:
        if sum(1 for paragraph in paragraphs if cue_re.search(paragraph)) < 2:
            return {}
        groups: Dict[int, List[str]] = {shot: [] for shot in range(1, int(shot_count) + 1)}
        for index, paragraph in enumerate(paragraphs):
            shot = min(index + 1, int(shot_count))
            groups[shot].append(paragraph)
        return {shot: " ".join(values).strip() for shot, values in groups.items() if values}
    return _r2v_single_paragraph_phase_groups(raw, int(shot_count))


def _repair_reference_scope(scope: str, shot_count: int) -> Tuple[str, bool]:
    """Clamp stale explicit Shot scopes after camera-shot count changes."""
    scope = str(scope or "auto")
    count = max(1, int(shot_count))
    if scope.startswith("shot_"):
        try:
            shot = int(scope.rsplit("_", 1)[-1])
        except Exception:
            return scope, False
        repaired = min(max(1, shot), count)
        return f"shot_{repaired}", repaired != shot
    if scope.startswith("shots_"):
        try:
            shots = [int(value) for value in scope.split("_")[1:]]
        except Exception:
            return scope, False
        repaired = list(dict.fromkeys(min(max(1, shot), count) for shot in shots))
        changed = repaired != shots
        if repaired == list(range(1, count + 1)):
            return "all_shots", True
        if len(repaired) == 1:
            return f"shot_{repaired[0]}", changed or len(shots) != 1
        return "shots_" + "_".join(str(shot) for shot in repaired), changed
    return scope, False


def _shot_scope(role: str, scope: str, shot_count: int) -> List[int]:
    """Resolve a reference-plan scope into concrete target shots.

    The official Ref2VA guide requires reference labels to appear at the point
    where they actually take effect. `auto` therefore has deterministic,
    role-aware semantics instead of leaving an unresolved "intended moment".
    """

    scope = _canonical_choice(scope or "auto", R2V_SCOPE_VALUES, "reference_scope")

    # Concrete first/final anchors have fixed temporal meaning. Other roles may
    # accept an explicit shot scope; in Ref2VA a referenced costume, pose,
    # motion, object, effect, or audio cue may intentionally apply only to part
    # of the target video.
    if role == "first_frame_anchor":
        return [1]
    if role == "last_frame_anchor":
        return [shot_count]

    if scope.startswith("shot_"):
        shot = int(scope.rsplit("_", 1)[-1])
        if shot > shot_count:
            raise _UserInputError(
                f"Reference scope targets Shot {shot}, but the current R2V camera sequence has only {shot_count} shot(s)."
            )
        return [shot]
    if scope.startswith("shots_"):
        shots = [int(value) for value in scope.split("_")[1:]]
        invalid = [shot for shot in shots if shot < 1 or shot > shot_count]
        if invalid:
            raise _UserInputError(
                "Reference scope targets "
                + ", ".join(f"Shot {shot}" for shot in invalid)
                + f", but the current R2V camera sequence has only {shot_count} shot(s)."
            )
        # Scope values are canonical and ordered, but de-duplicate defensively so
        # retention_analysis and detailed_description cannot drift if a future
        # migration introduces repeated shot numbers.
        return list(dict.fromkeys(shots))
    if scope == "all_shots":
        return list(range(1, shot_count + 1))

    if role in {"style_reference", "video_edit_source"}:
        return list(range(1, shot_count + 1))
    if role == "video_continuation_source":
        return [1]
    if role.endswith("_identity") or role.endswith("_clothing") or role.endswith("_motion"):
        return list(range(1, shot_count + 1))
    if role.endswith("_pose_expression"):
        return [1]

    if role in {"keyframe_anchor", "edited_keyframe_anchor"}:
        return [2 if shot_count >= 2 else 1]
    if role in {"composition_anchor", "object_prop", "visual_effect", "general_reference", "custom"}:
        return [1]
    if role in {"storyboard", "scene_environment", "camera_motion", "cuts_rhythm", "audio_continuity"}:
        return list(range(1, shot_count + 1))
    return list(range(1, shot_count + 1))


_SHOT_RE = re.compile(r"\[Shot\s+(\d+)\](?:\s+At\s+\d{2}:\d{2}\.\d{3},)?")


def _shot_parts(text: str) -> Tuple[str, List[Tuple[int, str, str]]]:
    matches = list(_SHOT_RE.finditer(text or ""))
    if not matches:
        return text, []
    prefix = text[: matches[0].start()].strip()
    parts: List[Tuple[int, str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        parts.append((int(match.group(1)), match.group(0), text[match.end() : end].strip()))
    return prefix, parts


def _normalize_verbal_match_text(text: str) -> str:
    """Normalize only presentation details for exact dialogue-source matching.

    Ref2VA exact dialogue/lyric reuse must never claim that one source transcript
    supplies unrelated target words. Whitespace and terminal punctuation are not
    semantic wording, so normalize those while keeping the actual words, casing,
    and internal punctuation intact.
    """

    value = re.sub(r"\s+", " ", str(text or "")).strip()
    value = re.sub(r"[~～]+", "", value).strip()
    value = re.sub(r"[•●▪◦]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"([!?.,。！？])\1+", r"\1", value)
    return value.rstrip(" .!?。！？").strip()


def _verbal_source_contains(source_text: str, target_text: str) -> bool:
    source = _normalize_verbal_match_text(source_text)
    target = _normalize_verbal_match_text(target_text)
    if not source or not target:
        return False
    # Require word boundaries at alphanumeric edges so a short target such as
    # "he" cannot accidentally match an unrelated source word such as "the".
    left = r"(?<!\w)" if target[:1].isalnum() else ""
    right = r"(?!\w)" if target[-1:].isalnum() else ""
    return re.search(left + re.escape(target) + right, source) is not None


def _join_shot_parts(prefix: str, parts: List[Tuple[int, str, str]]) -> str:
    rendered = []
    if prefix.strip():
        rendered.append(prefix.strip())
    rendered.extend(f"{header} {body}".strip() for _, header, body in parts)
    return " ".join(rendered).strip()


def _inject_shot_prefixes(text: str, clauses: Dict[int, List[str]]) -> str:
    prefix, parts = _shot_parts(text)
    if not parts:
        return text
    out: List[Tuple[int, str, str]] = []
    for number, header, body in parts:
        lead = " ".join(value.strip() for value in clauses.get(number, []) if value and value.strip())
        if lead:
            # Later-shot headers end in a comma: "[Shot 2] At 00:03.000,".
            # The first inserted clause is grammatically part of that sentence,
            # while the original base body becomes a new sentence after it.
            if " At " in header and lead[:1].isalpha():
                lead = lead[:1].lower() + lead[1:]
            if body[:1].isalpha():
                body = body[:1].upper() + body[1:]
            out.append((number, header, f"{lead} {body}".strip()))
        else:
            out.append((number, header, body))
    return _join_shot_parts(prefix, out)


def _inject_shot_suffixes(text: str, clauses: Dict[int, List[str]]) -> str:
    prefix, parts = _shot_parts(text)
    if not parts:
        return text
    out: List[Tuple[int, str, str]] = []
    for number, header, body in parts:
        tail = " ".join(value.strip() for value in clauses.get(number, []) if value and value.strip())
        out.append((number, header, f"{body} {tail}".strip() if tail else body))
    return _join_shot_parts(prefix, out)


def _inject_timed_shot_clauses(text: str, clauses: Dict[int, List[Tuple[float, str]]]) -> str:
    """Insert independent timed events in chronological order inside each Shot.

    The inherited Timeline already emits ``At approximately X seconds`` clauses.
    R2V-only Narrator rows are compiled outside that stable path, so they must be
    merged by timestamp rather than blindly appended at the end of a Shot.
    """
    prefix, parts = _shot_parts(text)
    if not parts:
        return text
    timed_re = re.compile(r"\bAt approximately (\d+(?:\.\d+)?) seconds,")
    out: List[Tuple[int, str, str]] = []
    for number, header, body in parts:
        updated = body
        for event_time, clause in sorted(clauses.get(number, []), key=lambda item: item[0]):
            insertion = len(updated)
            for match in timed_re.finditer(updated):
                if float(match.group(1)) > float(event_time) + 1e-9:
                    insertion = match.start()
                    break
            left = updated[:insertion].rstrip()
            right = updated[insertion:].lstrip()
            updated = " ".join(part for part in (left, clause.strip(), right) if part)
        out.append((number, header, updated))
    return _join_shot_parts(prefix, out)


def _shot_numbers_for_label(text: str, label: str) -> List[int]:
    _, parts = _shot_parts(text)
    return [number for number, _header, body in parts if label in body]


def _shot_list_text(shots: Iterable[int]) -> str:
    values = sorted(set(int(v) for v in shots))
    return ", ".join(f"[Shot {value}]" for value in values)


def _compact_shot_list_text(shots: Iterable[int]) -> str:
    """Compact repeated retention ranges without changing Shot identities."""
    values = sorted(set(int(v) for v in shots))
    if len(values) >= 2 and values == list(range(values[0], values[-1] + 1)):
        return f"[Shot {values[0]}]-[Shot {values[-1]}]"
    return _shot_list_text(values)


def _replace_speaker_voice_reference(
    text: str,
    subject_label: str,
    sid: str,
    audio_label: str,
    relationship: str = "reference",
    instruction: str = "",
) -> Tuple[str, int]:
    """Bind a voice reference directly to an individual speaking/singing clause.

    Composite/group vocal events use a different grammar in the inherited Main compiler
    compiler and are handled with shot-level binding from `_speaker_events`.
    """
    pattern = re.compile(
        rf"{re.escape(subject_label)}\s+\({re.escape(sid)}\)\s+(?P<lemma>says|sings)(?P<voiceover>\s+in\s+an\s+off-screen\s+voiceover)?:"
    )

    def repl(match: re.Match[str]) -> str:
        lemma = match.group("lemma") or "says"
        voiceover = match.group("voiceover") or ""
        if relationship == "weak_reference":
            voice_clause = f"using broad voice characteristics inspired by {audio_label}"
        else:
            voice_clause = f"using the voice timbre and delivery referenced from {audio_label}"
        if instruction:
            voice_clause += f", while following this target-use instruction: {instruction.rstrip('.!?')}"
        return f"{subject_label} ({sid}), {voice_clause}, {lemma}{voiceover}:"

    return pattern.subn(repl, text)


def _asset_identity_key(value: Any) -> Tuple[str, int]:
    """Identity key for one physical ComfyUI reference value within a single execution.

    One upstream IMAGE/VIDEO/AUDIO output may be connected to several R2V role
    sockets.  Those connections describe multiple roles of one source file; they
    must not consume multiple H3 file slots or receive different reference labels.
    Object identity is the safest execution-local signal because ComfyUI forwards
    the same output object to every downstream link from that output.
    """
    return (type(value).__name__, id(value))


def _shared_asset_ordinals(names: Iterable[str], kwargs: Dict[str, Any]) -> Dict[str, int]:
    labels: Dict[str, int] = {}
    by_identity: Dict[Tuple[str, int], int] = {}
    next_index = 1
    for name in names:
        key = _asset_identity_key(kwargs.get(name))
        if key not in by_identity:
            by_identity[key] = next_index
            next_index += 1
        labels[name] = by_identity[key]
    return labels


def _unique_asset_count(names: Iterable[str], kwargs: Dict[str, Any]) -> int:
    return len({_asset_identity_key(kwargs.get(name)) for name in names})


def _orphan_video_audio_names(groups: Dict[str, List[str]]) -> List[str]:
    """Return Video-Audio sockets that do not have their same-numbered Video."""
    video_names = set(groups["ref_video"])
    return [
        name
        for name in groups["ref_video_audio"]
        if f"ref_video_{name.rsplit('_', 1)[-1]}" not in video_names
    ]


def _independent_audio_names(groups: Dict[str, List[str]], kwargs: Dict[str, Any]) -> List[str]:
    """Return AUDIO-role sockets that represent physical sources beyond Videos.

    Paired ref_video_audio_N belongs to ref_video_N and consumes no additional
    source slot.  Orphan Video-Audio and standalone Audio sockets do consume the
    Audio <= 3 / mixed-file budget, except when they reuse the exact same
    upstream AUDIO object as an already-paired Video soundtrack.
    """
    orphan_names = _orphan_video_audio_names(groups)
    orphan_set = set(orphan_names)
    paired_identities = {
        _asset_identity_key(kwargs.get(name))
        for name in groups["ref_video_audio"]
        if name not in orphan_set
    }
    return [
        name
        for name in [*groups["ref_audio"], *orphan_names]
        if _asset_identity_key(kwargs.get(name)) not in paired_identities
    ]


def _known_video_duration_seconds(value: Any) -> float | None:
    """Return a reliable VIDEO duration when the connected object exposes it.

    ComfyUI's official VIDEO interface provides ``get_duration()``. Custom video
    loaders are allowed to pass other objects, so duration inspection is strictly
    best-effort: unsupported objects or failing accessors are left unblocked.
    """
    getter = getattr(value, "get_duration", None)
    if not callable(getter):
        return None
    try:
        duration = float(getter())
    except Exception:
        return None
    if not math.isfinite(duration) or duration < 0.0:
        return None
    return duration


def _known_audio_duration_seconds(value: Any) -> float | None:
    """Return duration for the standard ComfyUI AUDIO mapping when available."""
    if not isinstance(value, dict):
        return None
    waveform = value.get("waveform")
    sample_rate = value.get("sample_rate")
    if waveform is None or sample_rate is None:
        return None
    try:
        rate = float(sample_rate)
        sample_count = int(waveform.shape[-1])
    except Exception:
        return None
    if not math.isfinite(rate) or rate <= 0.0 or sample_count < 0:
        return None
    return float(sample_count / rate)


def _known_unique_media_durations(
    names: Iterable[str],
    kwargs: Dict[str, Any],
    media_kind: str,
) -> List[Tuple[str, float]]:
    seen: set[Tuple[str, int]] = set()
    durations: List[Tuple[str, float]] = []
    duration_reader = _known_video_duration_seconds if media_kind == "video" else _known_audio_duration_seconds
    for name in names:
        value = kwargs.get(name)
        key = _asset_identity_key(value)
        if key in seen:
            continue
        seen.add(key)
        duration = duration_reader(value)
        if duration is not None:
            durations.append((name, duration))
    return durations


def _reference_media_duration_errors(groups: Dict[str, List[str]], kwargs: Dict[str, Any]) -> List[str]:
    """Return official Ref2VA duration violations only when duration is reliable.

    Known standard VIDEO/AUDIO values are blocked outside the official 2-15s
    per-reference window or above the 15s known-total budget. Unsupported custom
    media objects remain compatible: if duration cannot be read reliably, this
    validator does not guess and does not block them.
    """
    errors: List[str] = []
    video_durations = _known_unique_media_durations(groups["ref_video"], kwargs, "video")
    orphan_video_audio = set(_orphan_video_audio_names(groups))
    paired_video_audio_names = [
        name for name in groups["ref_video_audio"] if name not in orphan_video_audio
    ]
    soundtrack_durations = _known_unique_media_durations(
        paired_video_audio_names, kwargs, "audio"
    )
    independent_audio_durations = _known_unique_media_durations(
        _independent_audio_names(groups, kwargs), kwargs, "audio"
    )

    for name, duration in video_durations:
        if duration < R2V_MIN_REFERENCE_DURATION_SECONDS - 1e-9 or duration > R2V_MAX_REFERENCE_DURATION_SECONDS + 1e-9:
            errors.append(
                f"{name} duration is {duration:.3f}s; each reference video must be 2-15 seconds."
            )
    known_video_total = sum(duration for _name, duration in video_durations)
    if known_video_total > R2V_MAX_REFERENCE_TOTAL_DURATION_SECONDS + 1e-9:
        errors.append(
            f"Known reference-video duration totals {known_video_total:.3f}s; the maximum total is 15 seconds."
        )

    def validate_audio_group(durations: List[Tuple[str, float]], label: str) -> None:
        for name, duration in durations:
            if duration < R2V_MIN_REFERENCE_DURATION_SECONDS - 1e-9 or duration > R2V_MAX_REFERENCE_DURATION_SECONDS + 1e-9:
                errors.append(
                    f"{name} duration is {duration:.3f}s; each {label} must be 2-15 seconds."
                )
        known_total = sum(duration for _name, duration in durations)
        if known_total > R2V_MAX_REFERENCE_TOTAL_DURATION_SECONDS + 1e-9:
            errors.append(
                f"Known {label} duration totals {known_total:.3f}s; the maximum total is 15 seconds."
            )

    # A paired ref_video_audio_N is the soundtrack of its same-numbered Video,
    # not another physical Reference file. Orphan Video-Audio sockets are
    # independent Audio references and therefore share the standalone Audio
    # duration budget. Keep the paired soundtrack budget separate so a video's
    # soundtrack is not double-counted as an additional physical Audio source.
    validate_audio_group(soundtrack_durations, "reference-video soundtrack")
    validate_audio_group(independent_audio_durations, "independent Audio reference")
    return errors


def _audio_labels(groups: Dict[str, List[str]], kwargs: Dict[str, Any]) -> Dict[str, int]:
    """Match H3 audio order while collapsing multiple role-links to one physical signal.

    Enabled video soundtracks are enumerated first in video order, followed by
    standalone Audio sources.  If the exact same upstream AUDIO value is connected
    to more than one role socket, every role receives the same <Audio N> label.
    """
    labels: Dict[str, int] = {}
    by_identity: Dict[Tuple[str, int], int] = {}
    next_index = 1
    video_audio_set = set(groups["ref_video_audio"])
    ordered_names: List[str] = []
    for video_name in groups["ref_video"]:
        suffix = video_name.rsplit("_", 1)[-1]
        audio_name = f"ref_video_audio_{suffix}"
        if audio_name in video_audio_set:
            ordered_names.append(audio_name)
    # If a same-numbered Video soundtrack is connected without its Video, keep
    # the prompt compiler usable by treating that orphan soundtrack as an
    # independent audio-style cue after the paired soundtracks.
    for audio_name in groups["ref_video_audio"]:
        if audio_name not in ordered_names:
            ordered_names.append(audio_name)
    ordered_names.extend(groups["ref_audio"])
    for audio_name in ordered_names:
        key = _asset_identity_key(kwargs.get(audio_name))
        if key not in by_identity:
            by_identity[key] = next_index
            next_index += 1
        labels[audio_name] = by_identity[key]
    return labels


def _person_key_from_role(role: str) -> str | None:
    match = re.match(r"^person_([abc])_", role)
    return match.group(1).upper() if match else None


def _active_person_visual_setting_kinds(kwargs: dict, extension_options: dict, person: str) -> List[str]:
    """Return the structured visual-setting categories explicitly selected for one target person.

    This intentionally reports categories rather than concrete values so the
    prompt can reinforce precedence without re-describing every person twice.
    """
    key = str(person or "").lower()
    if key not in {"a", "b", "c"}:
        return []
    categories: List[str] = []
    gender = str(kwargs.get(f"person_{key}_gender", "unspecified") or "unspecified")
    age = str(kwargs.get(f"person_{key}_age", "unspecified") or "unspecified")
    appearance_preset = str(kwargs.get(f"person_{key}_appearance_preset", "none") or "none")
    appearance_desc = str(kwargs.get(f"person_{key}_appearance_desc", "") or "").strip()
    clothing_preset = str(kwargs.get(f"person_{key}_clothing_preset", "none") or "none")
    clothing_desc = str(kwargs.get(f"person_{key}_clothing_desc", "") or "").strip()
    ethnic = str((((extension_options or {}).get("person", {}).get(person.upper(), {}).get("profile", {}) or {}).get("ethnic_appearance", "none")) or "none")
    if gender != "unspecified":
        categories.append("gender")
    if age != "unspecified":
        categories.append("age")
    if ethnic != "none":
        categories.append("ethnic appearance")
    if appearance_preset != "none" or appearance_desc:
        categories.append("appearance")
    if clothing_preset != "none" or clothing_desc:
        categories.append("wardrobe")
    return categories


def _general_visible_reference_people_override_sentence(
    translated_plan: Dict[str, Dict[str, str]],
    kwargs: dict,
    extension_options: dict,
    active_person_count: int,
) -> str:
    """Return a precedence sentence for person-like general references.

    General/custom visible references are intentionally broad and may contain
    people. When the user also selected structured target-person settings, make
    the precedence explicit so the model does not keep the source person's face
    or ethnic look more strongly than the target settings.
    """
    has_general_visible_reference = any(
        str(name).startswith(("ref_image_", "ref_video_"))
        and str((entry or {}).get("role", "") or "") in {"general_reference", "custom"}
        for name, entry in (translated_plan or {}).items()
    )
    if not has_general_visible_reference:
        return ""

    active_people = []
    for person in ("A", "B", "C")[:max(0, int(active_person_count or 0))]:
        categories = _active_person_visual_setting_kinds(kwargs, extension_options, person)
        if categories:
            active_people.append((person, categories))
    if not active_people:
        return ""

    person_clauses: List[str] = []
    for person, categories in active_people:
        person_clauses.append(
            f"Person {person} must follow the selected {_natural_join(categories)} settings"
        )
    return (
        "When a general visible reference or custom visible reference contains people, "
        "use it only for the requested mood, hairstyle, wardrobe, accessories, pose, motion, and scene cues where applicable. "
        "Do not preserve the reference person's facial identity or ethnic facial characteristics when they conflict with the selected target person settings. "
        + _ensure_terminal_punctuation(_natural_join(person_clauses))
    )


def _inline_prose(value: Any) -> str:
    """Trim terminal sentence punctuation before embedding prose inside another sentence."""
    return str(value or "").strip().rstrip(".!?")


def _visible_text_literal(value: Any) -> str:
    """Return visible scene text without prose normalization.

    Outer whitespace is not semantically part of the reference-plan field, but
    every character inside the value -- repeated spaces, punctuation and source
    language -- must remain untouched for MiniMax H3 visible-text instructions.
    """
    return str(value or "").strip()


def _quoted_visible_text(value: Any) -> str:
    return f'"{_visible_text_literal(value)}"'


def _natural_join(parts: Iterable[str]) -> str:
    values = [p for p in parts if p]
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return values[0] + " and " + values[1]
    return ", ".join(values[:-1]) + ", and " + values[-1]


def _natural_join_inline_prose(parts: Iterable[str]) -> str:
    """Join user prose fragments without creating ``. and`` boundaries.

    This is intentionally separate from ``_natural_join`` because generated
    labels and structural phrases may rely on their original punctuation.
    """
    values = [_inline_prose(part) for part in parts if str(part or "").strip()]
    return _natural_join([value for value in values if value])


def _as_r2v_blocked_info(base_info: Any, locale: str = "en") -> str:
    """Preserve a trusted base waiting/error state while adapting Main-only wording to R2V."""
    raw_lines = [line for line in str(base_info or "").splitlines() if line.strip()]
    out = [f"version={VERSION}", "node=UltraMiniMaxH3PromptR2V", "resolved_mode=ref2va"]
    ko = str(locale or "en").lower().startswith("ko")
    main_empty_prefix = "warning=T2VA needs a scene instruction"
    for line in raw_lines:
        if line.startswith("version=") or line.startswith("node=") or line.startswith("resolved_mode="):
            continue
        if line.startswith(main_empty_prefix):
            if ko:
                line = (
                    "warning=R2V에는 장면 지시어, Timeline 행동/대사, 또는 연결된 참조 중 하나 이상이 필요합니다. "
                    "완전히 빈 초안도 Queue 입력 오류로 중단하지 않으며, 임의 내용을 만들지 않고 h3_prompt 출력만 waiting_for_content 상태로 대기합니다."
                )
            else:
                line = (
                    "warning=R2V needs a scene instruction, Timeline action/dialogue, or a connected reference. "
                    "A completely empty draft remains queueable; h3_prompt waits with status=waiting_for_content instead of inventing a generic subject or action."
                )
        out.append(line)
    return "\n".join(out)


def _split_base_prompt(prompt: str) -> Tuple[str, str, str]:
    pattern = re.compile(
        r"(?:^|\n\n)integrated_multimodal_description:\s*(.*?)\n\noverall_soundscape:\s*(.*?)\n\nnon_diegetic_music:\s*(.*)\s*$",
        re.S,
    )
    match = pattern.search(prompt or "")
    if not match:
        raise RuntimeError("R2V compiler could not parse the trusted base H3 prompt sections.")
    return match.group(1).strip(), match.group(2).strip(), match.group(3).strip()


def _task_types(asset_roles: List[Tuple[str, str]]) -> List[str]:
    task_types: List[str] = []

    def add(value: str):
        if value not in task_types:
            task_types.append(value)

    for name, role in asset_roles:
        is_audio = name.startswith("ref_audio_") or name.startswith("ref_video_audio_")
        if role in {"first_frame_anchor", "keyframe_anchor", "edited_keyframe_anchor", "last_frame_anchor", "composition_anchor"}:
            add("keyframe completion")
        elif role == "video_edit_source":
            add("video editing")
        elif role == "video_continuation_source":
            add("video continuation")
        elif role in {"full_audio_reuse", "partial_audio_reuse"}:
            add("audio reuse")
        elif role in {"person_a_voice", "person_b_voice", "person_c_voice", "narrator_voice", "music_style", "sound_effects", "rhythm_timing", "audio_continuity", "dialogue_content"} or (is_audio and role in {"general_reference", "custom"}):
            add("audio reference")
        else:
            add("reference generation")
    return task_types or ["reference generation"]


def _replace_people_with_subjects(text: str, person_subjects: Dict[str, int]) -> str:
    out = text
    for person, subject_index in person_subjects.items():
        out = re.sub(rf"\bPerson {person}\b", f"<Subject {subject_index}>", out)
    return out


def _normalize_r2v_composite_subject_verbs(text: str) -> str:
    """Apply the shared conservative compound-predicate repair to R2V Subjects.

    R2V detailed_description normally starts with ``[Shot N]`` rather than the
    coordinated Subject itself, so scan each compiler-generated Subject group in
    place instead of requiring it at string offset zero. Work one sentence at a
    time so later independent clauses and dialogue remain outside this repair.
    """
    coordinated_sentence = re.compile(
        r"(?P<subjects><Subject\s+\d+>(?:,\s*<Subject\s+\d+>)*(?:,?\s+and\s+<Subject\s+\d+>))"
        r"(?P<predicate>\s+[^.\n]*)(?P<terminal>\.|$)"
    )

    def repl(match: re.Match) -> str:
        subjects = match.group("subjects")
        fragment = subjects + match.group("predicate")
        return _normalize_compound_action_predicate(fragment, subjects) + match.group("terminal")

    return coordinated_sentence.sub(repl, str(text or ""))


def _compact_reference_continuations(text: str) -> str:
    """Merge runs of short repeated-reference continuation sentences.

    Full-reference prompts can legitimately keep many labels active across
    several Shots. Emitting ``... reference continues.`` once per label is
    semantically redundant and can push otherwise valid 12-file prompts over
    practical prompt budgets. Merge only consecutive compiler-generated
    continuation sentences; user prose and first-use reference detail remain
    untouched.
    """
    pattern = re.compile(
        r"(?P<run>(?:<(?:Subject|Picture|Video|Audio)\s+\d+>\s+"
        r"[^.\n]*?\s+reference continues\.\s*){2,})"
    )

    def repl(match: re.Match) -> str:
        run = match.group("run")
        items = re.findall(
            r"(<(?:Subject|Picture|Video|Audio)\s+\d+>)\s+"
            r"([^.\n]*?)\s+reference continues\.",
            run,
        )
        cleaned = []
        for label, role_text in items:
            role_text = re.sub(r"\s+", " ", role_text).strip()
            item = f"{label} {role_text}" if role_text else label
            if item not in cleaned:
                cleaned.append(item)
        if len(cleaned) < 2:
            return run
        return "Continuing references: " + "; ".join(cleaned) + ". "

    return pattern.sub(repl, text)


def _speaker_events(text: str) -> Tuple[Dict[str, str], Dict[str, List[int]]]:
    """Recover global S-IDs and actual vocal-event shots from the base prompt.

    The Main compiler supports both individual speech (``Person A (S1) says``) and
    composite speech (``Person A and Person B (S1,S2) say together``),
    including the corresponding combined-speaker voice-over form. Ref2VA voice
    references must work for both without inventing or renumbering S-IDs.
    """
    speakers: Dict[str, str] = {}
    shots: Dict[str, List[int]] = {"A": [], "B": [], "C": [], "N": []}
    _prefix, parts = _shot_parts(text)
    if not parts:
        parts = [(1, "[Shot 1]", text or "")]

    group_re = re.compile(
        r"(?P<people>Person [ABC](?:,\s*Person [ABC])*(?:,\s*and\s*Person [ABC]|\s+and\s+Person [ABC]))"
        r"\s+\((?P<sids>S\d+(?:,S\d+)+)\)"
    )
    combined_re = re.compile(
        r"The combined speaker group consisting of\s+"
        r"(?P<people>Person [ABC](?:,\s*Person [ABC])*(?:,\s*and\s*Person [ABC]|\s+and\s+Person [ABC]))"
        r"\s+\((?P<sids>S\d+(?:,S\d+)+)\)"
    )
    individual_re = re.compile(r"\bPerson ([ABC]) \(S(\d+)\)")
    narrator_re = re.compile(r"\bindependent narrator(?:[^.!?\n]{0,900}?)\(S(\d+)\)\s+says in an off-screen voiceover", re.I)
    # The base compiler may embed a profile between the Person label and the
    # speaker ID when a Timeline row contains dialogue but no separate action,
    # e.g. ``Person A, a young woman in her twenties (S1) says``. Keep the
    # established exact matchers above, then use this speech-anchored fallback
    # only for those profiled forms. Limiting the prefix to one sentence and
    # requiring a speech verb after the S-ID avoids treating ordinary Person
    # mentions as vocal events.
    profiled_speech_re = re.compile(
        r"(?P<prefix>\bPerson [ABC]\b[^.!?\[\]\n]{0,700}?)"
        r"\s*,?\s*\((?P<sids>S\d+(?:,S\d+)*)\)"
        r"\s+(?:say(?:s)?(?:\s+together)?|speak(?:s)?)(?=\s|:|,)",
        re.I,
    )

    for shot_number, _header, body in parts:
        # The voice-over form contains the ordinary people/S-ID substring too;
        # de-duplicate by assigning through setdefault and unique shot lists.
        for regex in (combined_re, group_re):
            for match in regex.finditer(body):
                people = re.findall(r"Person ([ABC])", match.group("people"))
                sids = match.group("sids").split(",")
                if len(people) != len(sids):
                    continue
                for person, sid in zip(people, sids):
                    speakers.setdefault(person, sid)
                    if shot_number not in shots[person]:
                        shots[person].append(shot_number)
        for person, sid_num in individual_re.findall(body):
            speakers.setdefault(person, f"S{sid_num}")
            if shot_number not in shots[person]:
                shots[person].append(shot_number)
        for sid_num in narrator_re.findall(body):
            speakers.setdefault("N", f"S{sid_num}")
            if shot_number not in shots["N"]:
                shots["N"].append(shot_number)

        for match in profiled_speech_re.finditer(body):
            sids = match.group("sids").split(",")
            people = re.findall(r"Person ([ABC])", match.group("prefix"), re.I)
            if not people or not sids:
                continue
            # The base compiler emits one Person label per S-ID in a vocal
            # clause. If extra Person labels appear in the same sentence, the
            # prose is semantically ambiguous; fail closed instead of guessing
            # which mentioned person owns the S-ID.
            if len(people) != len(sids):
                continue
            for person, sid in zip(people, sids):
                person = person.upper()
                speakers.setdefault(person, sid)
                if shot_number not in shots[person]:
                    shots[person].append(shot_number)

    return speakers, shots


def _timeline_global_speaker_ids(events: Iterable[Dict[str, Any]]) -> Dict[str, str]:
    """Assign S-IDs by first actual vocal-event order across A/B/C/Narrator.

    The inherited Main compiler cannot see R2V-only Narrator rows, so compiling
    visible rows first would otherwise give Person A/B/C earlier S-IDs even when
    a narrator actually speaks first. MiniMax H3 requires global S-IDs to follow
    the target video's first real vocal-event order. Group speech claims each
    participating visible speaker at the same event, in the stable A/B/C order
    encoded by the Timeline speaker value.
    """
    ordered: List[str] = []
    seen = set()
    for event in events:
        if not str(event.get("dialogue_text", "") or "").strip():
            continue
        speaker = str(event.get("speaker", "") or "").strip()
        slots = ["N"] if speaker == "Narrator" else [slot for slot in speaker.split("+") if slot in {"A", "B", "C"}]
        for slot in slots:
            if slot not in seen:
                seen.add(slot)
                ordered.append(slot)
    return {slot: f"S{index}" for index, slot in enumerate(ordered, start=1)}


def _remap_visible_speaker_ids(text: str, current: Dict[str, str], desired: Dict[str, str]) -> str:
    """Remap already-compiled visible S-IDs without cascade collisions."""
    replacements = {current[slot]: desired[slot] for slot in ("A", "B", "C") if slot in current and slot in desired and current[slot] != desired[slot]}
    if not replacements:
        return text
    return re.sub(r"\bS\d+\b", lambda match: replacements.get(match.group(0), match.group(0)), text)



def _repair_r2v_adjacent_subject_noun_phrase(text: str) -> str:
    """Remove an impossible duplicated grammatical subject in R2V action prose.

    The inherited Timeline binder intentionally prefixes the selected Person when
    it cannot prove that a free-form action already starts with an independent
    scene subject. R2V actions can legitimately begin with referenced objects or
    environments (for example, "The miniature city expands ... Person A looks
    upward"). After Person labels are converted to <Subject N>, that conservative
    fallback can yield the ungrammatical "<Subject 1> The miniature city ...".
    A Person/<Subject> label immediately followed by a fresh article-led noun
    phrase is never a valid English predicate, so removing only that adjacent
    duplicate subject is a narrow R2V-safe repair.
    """
    return re.sub(
        r"(?:<Subject\s+\d+>|Person\s+[ABC])\s+(?=(?:the|a|an)\s+[A-Za-z])",
        "",
        text or "",
        flags=re.I,
    )


def _normalize_embedded_article_case(text: str) -> str:
    """Normalize a narrow standalone-human noun phrase after profile embedding.

    The stable main compiler intentionally accepts descriptor fragments. Users
    may enter a standalone self-description such as ``An adult woman with short
    hair``; after embedding, ``Person A, with an adult woman ...`` reads as if a
    second person accompanies Person A. R2V may repair that narrow grammar case.

    Do not treat every later human noun as the head of the phrase. Multi-entity
    or relational descriptions such as ``a small dog and a woman ...`` or
    ``a portrait showing a woman ...`` must remain ordinary ``with ...`` text
    instead of becoming ``Person A, who is ...``.
    """
    out = re.sub(r"\bwith\s+(A|An)\s+", lambda m: "with " + m.group(1).lower() + " ", text)
    subject = r"(?P<subject>(?:<Subject\s+\d+>|Person\s+[ABC]))"
    human_phrase = re.compile(
        subject
        + r",\s+with\s+(?P<phrase>(?:a|an)\s+[^,.;]{0,140}?\b(?:woman|man|person|adult|character)\b[^,.;]{0,140})",
        re.I,
    )

    def replace_human_phrase(match: re.Match) -> str:
        phrase = match.group("phrase")
        head = re.search(r"\b(?:woman|man|person|adult|character)\b", phrase, re.I)
        if not head:
            return match.group(0)

        # Inspect only the words before the candidate human head noun. After
        # removing the opening article, a second article, conjunction, or
        # relationship preposition means the human noun belongs to another
        # entity/embedded relation rather than being Person A/B/C's head noun.
        prefix = phrase[: head.start()]
        prefix = re.sub(r"^\s*(?:a|an)\s+", "", prefix, flags=re.I).strip()
        if re.search(r"\b(?:a|an|the)\b", prefix, re.I):
            return match.group(0)
        if re.search(r"\b(?:and|or|but)\b", prefix, re.I):
            return match.group(0)
        if re.search(
            r"\b(?:of|with|beside|alongside|near|behind|among|between|inside|outside|under|over)\b",
            prefix,
            re.I,
        ):
            return match.group(0)

        suffix = phrase[head.end() :]
        # A relation to another explicit person is not a pure self-identity
        # descriptor. Leave it untouched rather than reinterpreting the human
        # noun as Person A/B/C. This covers inputs such as ``a young woman
        # standing beside him`` while still allowing ``an adult woman with
        # short hair``.
        if re.search(
            r"\b(?:standing|sitting|walking|running|posing|lying|kneeling)\b.{0,48}"
            r"\b(?:beside|alongside|near|behind|with)\s+(?:him|her|them)\b",
            suffix,
            re.I,
        ):
            return match.group(0)
        if re.search(r"\b(?:beside|alongside|near|behind)\s+(?:him|her|them)\b", suffix, re.I):
            return match.group(0)

        # Keep the repair conservative: the human head must appear near the
        # beginning of the noun phrase, after only a short modifier sequence.
        if len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", prefix)) > 6:
            return match.group(0)
        return f"{match.group('subject')}, who is {phrase}"

    return human_phrase.sub(replace_human_phrase, out)


def _r2v_infer_person_gender(text: str) -> str:
    lowered = str(text or "")
    if re.search(r"\b(?:woman|female|lady|girl)\b", lowered, re.I):
        return "female"
    if re.search(r"\b(?:man|male|gentleman|boy)\b", lowered, re.I):
        return "male"
    return ""


def _r2v_clean_reference_content(role: str, text: str, target_gender: str = "") -> str:
    out = str(text or "").strip()
    if not out:
        return out
    if role.startswith("person_"):
        # Prefer the explicit Person A/B/C gender selected in the node. Fall back
        # to source-text inference only when the target gender is unspecified or
        # non-binary, preserving the previous conservative behavior for ambiguous
        # free-form reference prose.
        gender = target_gender if target_gender in {"female", "male"} else _r2v_infer_person_gender(out)
        replacements = {}
        if gender == "female":
            replacements = {
                r"\bThey are\b": "She is",
                r"\bThey have\b": "She has",
                r"\bTheir\b": "Her",
                r"\btheir\b": "her",
                r"\bthemself\b": "herself",
                r"\bHe is\b": "She is",
                r"\bHe has\b": "She has",
                r"\bHe was\b": "She was",
                r"\bHe\b": "She",
                r"\bHis\b": "Her",
                r"\bhis\b": "her",
                r"\bIt is\b": "She is",
                r"\bIt has\b": "She has",
                r"\bIt holds\b": "She holds",
                r"\bIt was\b": "She was",
            }
        elif gender == "male":
            replacements = {
                r"\bThey are\b": "He is",
                r"\bThey have\b": "He has",
                r"\bTheir\b": "His",
                r"\btheir\b": "his",
                r"\bthemself\b": "himself",
                r"\bShe is\b": "He is",
                r"\bShe has\b": "He has",
                r"\bShe was\b": "He was",
                r"\bShe\b": "He",
                r"\bHer\b": "His",
                r"\bher\b": "his",
                r"\bIt is\b": "He is",
                r"\bIt has\b": "He has",
                r"\bIt holds\b": "He holds",
                r"\bIt was\b": "He was",
            }
        for patt, repl in replacements.items():
            out = re.sub(patt, repl, out)
        return out
    if role in {"scene_environment", "object_prop"}:
        out = re.sub(r"(^|\.\s+)(?:They|We|You) see\s+", lambda m: m.group(1) + "It contains ", out)
    if role == "object_prop":
        out = out.replace("clear transparent", "clear")
    return out


def _r2v_normalize_subject_self_pronouns(text: str, subject_genders: Dict[str, str]) -> str:
    out = str(text or "")
    if not out or not subject_genders:
        return out
    for label, gender in subject_genders.items():
        if gender == "female":
            poss = "her"
        elif gender == "male":
            poss = "his"
        else:
            poss = "their"
        # Keep this repair intentionally narrow. Only normalize the possessive in a
        # same-sentence clause already anchored to one explicit Subject label when
        # the immediately following noun is ``gaze``. Broad pronoun rewriting in
        # free Timeline prose has high regression risk.
        out = re.sub(
            rf"({re.escape(label)}[^.?!\n]{{0,240}}?)\b(?:his|her|their)\b(?=\s+gaze\b)",
            lambda m: m.group(1) + poss,
            out,
            flags=re.I,
        )
    return out


def _style_opening(visual_style: str, has_style_reference: bool) -> str:
    if visual_style != "auto":
        style = STYLE_TEXT.get(visual_style, "").strip()
        return f"Overall visual treatment: {style}" if style else ""
    if has_style_reference:
        return "Overall visual treatment follows the designated style reference without inventing a conflicting medium or look."
    # Full-reference guidance establishes the overall visual treatment before
    # [Shot 1]. Keep the automatic case deliberately neutral so the compiler
    # satisfies that structure without inventing a medium or overriding refs.
    return "Overall visual treatment stays consistent with the requested scene and designated references."


def _validate_full_reference_prompt(prompt: str) -> Dict[str, Any]:
    """Fail closed on structural Ref2VA mistakes before returning the prompt."""

    section_order = (
        "subject_definitions:",
        "summary:",
        "retention_analysis:",
        "detailed_description:",
        "overall_soundscape:",
        "non_diegetic_music:",
    )
    positions = [prompt.find(token) for token in section_order]
    if any(pos < 0 for pos in positions) or positions != sorted(positions):
        raise RuntimeError("Generated R2V prompt failed the official six-section order invariant.")
    if "integrated_multimodal_description:" in prompt:
        raise RuntimeError("Generated R2V prompt incorrectly retained the base-mode field name.")

    sections: Dict[str, str] = {}
    for index, token in enumerate(section_order):
        start = positions[index] + len(token)
        end = positions[index + 1] if index + 1 < len(section_order) else len(prompt)
        sections[token[:-1]] = prompt[start:end].strip()

    definitions = sections["subject_definitions"]
    retention = sections["retention_analysis"]
    detailed = sections["detailed_description"]
    if re.search(r"\(S\d+(?:,S\d+)*\)", retention):
        raise RuntimeError("Generated R2V retention_analysis incorrectly contains a speaker ID.")

    defined_labels: List[str] = []
    for line in definitions.splitlines():
        match = re.match(r"\s*(<(?:Subject|Picture|Video|Audio)\s+\d+>)", line)
        if match:
            defined_labels.append(match.group(1))
    if defined_labels and len(defined_labels) != len(set(defined_labels)):
        raise RuntimeError("Generated R2V subject_definitions contains duplicate tracked labels.")

    visible_markers = {"fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"}
    audio_markers = {"fully_copy", "partially_copy", "reference", "weak_reference"}
    retention_labels: List[str] = []
    for line in retention.splitlines():
        match = re.match(
            r"\s*(<(?:Subject|Picture|Video|Audio)\s+\d+>).*?:\s*([a-z_]+)\s+-\s+.+$",
            line,
        )
        if not match:
            raise RuntimeError("Generated R2V retention_analysis contains a malformed tracked reference line.")
        label, marker = match.group(1), match.group(2)
        allowed = audio_markers if label.startswith("<Audio ") else visible_markers
        if marker not in allowed:
            raise RuntimeError(f"Generated R2V retention_analysis uses invalid relationship marker {marker!r} for {label}.")
        retention_labels.append(label)
    if defined_labels and retention_labels != defined_labels:
        raise RuntimeError("Generated R2V retention_analysis does not preserve one line per tracked definition in definition order.")

    # Source-asset labels may legitimately occur inside subject_definitions as
    # provenance, but all labels used in target-facing sections must correspond
    # to an explicit tracked definition. This catches accidental leakage of a
    # raw <Picture>/<Video>/<Audio> ordinal after roles are remapped to Subjects.
    tracked = set(defined_labels)
    target_text = "\n".join(
        [sections["summary"], detailed, sections["overall_soundscape"], sections["non_diegetic_music"]]
    )
    used_target_labels = set(re.findall(r"<(?:Subject|Picture|Video|Audio)\s+\d+>", target_text))
    undefined = sorted(used_target_labels - tracked)
    if undefined:
        raise RuntimeError(
            "Generated R2V prompt uses undefined target-facing reference labels: " + ", ".join(undefined)
        )

    detail_prefix, shot_parts = _shot_parts(detailed)
    if not shot_parts or shot_parts[0][0] != 1:
        raise RuntimeError("Generated R2V detailed_description does not begin its playback structure with [Shot 1].")
    if not detail_prefix.strip():
        raise RuntimeError("Generated R2V detailed_description is missing the required English style opening before [Shot 1].")
    expected = list(range(1, len(shot_parts) + 1))
    actual = [number for number, _header, _body in shot_parts]
    if actual != expected:
        raise RuntimeError("Generated R2V detailed_description contains non-sequential Shot labels.")
    if " At " in shot_parts[0][1]:
        raise RuntimeError("Generated R2V [Shot 1] must not contain a timestamp.")
    for number, header, _body in shot_parts[1:]:
        if not re.fullmatch(rf"\[Shot\s+{number}\]\s+At\s+\d{{2}}:\d{{2}}\.\d{{3}},", header):
            raise RuntimeError(f"Generated R2V [Shot {number}] is missing the official cut timestamp notation.")

    # Every tracked visible label must actually be applied in detailed_description.
    # Audio labels are allowed to remain definition-only when the current target
    # timeline has no compatible speaking/audio phase for a stricter binding; the
    # prompt-composer should stay usable and report the situation through user
    # warnings instead of treating it as an internal generation failure.
    for label in defined_labels:
        if label.startswith("<Audio "):
            continue
        if label not in detailed:
            raise RuntimeError(f"Generated R2V prompt defines {label} but never applies it in detailed_description.")

    word_re = re.compile(r"\b[A-Za-z]+(?:[-'][A-Za-z]+)*\b")
    detailed_word_count = len(word_re.findall(detailed))
    shot_word_counts = {number: len(word_re.findall(body)) for number, _header, body in shot_parts}
    return {
        "detailed_word_count": detailed_word_count,
        "shot_count": len(shot_parts),
        "shot_word_counts": shot_word_counts,
    }


class UltraMiniMaxH3PromptR2V(UltraMiniMaxH3Prompt):
    """Independent MiniMax H3 full-reference prompt compiler.

    The Main node remains independent. R2V reuses only its
    stable text/timeline/camera/dialogue compiler and translation helpers, then
    wraps the result in MiniMax H3's six-section full-reference format.
    """

    @classmethod
    def INPUT_TYPES(cls):
        base = UltraMiniMaxH3Prompt.INPUT_TYPES()
        required = dict(base["required"])
        for key in (
            "scene_input_role",
            "mode",
            "shot_layout",
            "reference_fidelity",
            "dialogue_text",
            "dialogue_language",
            "dialogue_delivery",
            "timeline_events_json",
            "variation_seed",
            "i2va_preserve_reference_clothing",
        ):
            required.pop(key, None)

        scene_translate_type, scene_translate_options = required["scene_translate"]
        scene_translate_options = dict(scene_translate_options)
        scene_translate_options["tooltip"] = (
            "R2V uses the same global non-dialogue descriptive-text translation control as Main. Automatic translates Korean scene/action/profile/reference/sound/music descriptions and leaves English unchanged. "
            "Off preserves every descriptive field exactly as entered and makes no online translation request. Dialogue remains verbatim."
        )
        required["scene_translate"] = (scene_translate_type, scene_translate_options)

        required["duration_seconds"] = (
            "INT",
            {
                "default": 5,
                "min": 4,
                "max": R2V_MAX_DURATION_SECONDS,
                "step": 1,
                "tooltip": "MiniMax H3 Ref2VA target duration. Official full-reference range: 4-15 seconds.",
            },
        )
        # R2V still supports zero-person environment/object/product workflows,
        # but the default working surface starts with Person 1 just like Main.
        # This keeps Person/Timeline child menus semantically stable while 0
        # remains an explicit user choice for people-free R2V generation.
        required["person_count"] = (
            "INT",
            {
                "default": 1,
                "min": 0,
                "max": 3,
                "step": 1,
                "tooltip": "Choose the active cast size first. Default is 1 for the normal Person 1 + Turn 1 workflow; use 0 for environment/object/product-focused R2V. Ordinary count changes preserve hidden settings and remember detached external STRING links for restoration; confirmed Reset clears that remembered state.",
            },
        )
        # R2V Timeline can mix visible A/B/C speakers with an independent
        # off-screen Narrator. The stable main node remains unchanged; the R2V
        # wrapper removes Narrator rows before calling the inherited compiler and
        # reinserts them as independent S-ID voice-over events afterward.
        for index in range(1, MAX_TURNS + 1):
            key = f"turn_{index}_speaker"
            field_type, options = required[key]
            values = list(field_type) if isinstance(field_type, (list, tuple)) else ["A", "B", "C"]
            if "Narrator" not in values:
                values.append("Narrator")
            required[key] = (values, dict(options))

        # R2V has a different trained duration contract from this package's
        # 4-30s main node. Keep the server-side widget bounds at 14.5s too;
        # the R2V-only JS further tightens them to the selected duration-0.5.
        for index in range(1, MAX_TURNS + 1):
            key = f"turn_{index}_elapsed_seconds"
            field_type, options = required[key]
            options = dict(options)
            options["max"] = 14.5
            options["tooltip"] = (
                "Approximate start-time target for this R2V timeline event. "
                "The UI limits it to the selected duration minus 0.5 seconds; "
                "MiniMax H3 Ref2VA target duration is 4-15 seconds."
            )
            required[key] = (field_type, options)
        for shot in range(2, MAX_CAMERA_SHOTS + 1):
            key = f"camera_shot_{shot}_start_seconds"
            field_type, options = required[key]
            options = dict(options)
            options["max"] = 14.5
            options["tooltip"] = (
                f"Video time in seconds when Shot {shot} starts. Use 0.5-second steps. "
                "This timing is independent of Timeline Progress start times; the UI limits it to the selected R2V duration minus 0.5 seconds."
            )
            required[key] = (field_type, options)

        # One authoritative serialized state object for all JS-only reference
        # Reference role/relationship/content/scope/instruction controls. This avoids dozens of serialized mirror widgets.
        # Keep every pre-existing R2V serialized widget in its historical order:
        # the new runtime-only Extension transport inherited from Main is moved
        # behind reference_plan_json before the frontend marks it non-persistent.
        extension_transport = required.pop("ultra_extension_options_json", None)
        required["reference_plan_json"] = (
            "STRING",
            {"default": "{}", "multiline": False, "hidden": True},
        )
        if extension_transport is not None:
            required["ultra_extension_options_json"] = extension_transport

        # Start the node in its real Basic View state instead of constructing
        # every inherited control visibly and collapsing it one tick later.
        # These are the only core widgets visible for a fresh R2V node. The
        # frontend may unhide the rest when Full View or a non-default setting
        # requires them. ComfyUI/LiteGraph therefore computes the initial node
        # geometry from the same widget set the user actually sees.
        initial_basic_widgets = {
            "scene_prompt",
            "scene_translate",
            "duration_seconds",
            "visual_style",
            "camera_motion",
            "camera_amplitude",
            "camera_speed",
            "camera_sequence_enabled",
            "camera_shot_1_target",
            "camera_shot_1_framing",
            "soundscape_mode",
            "sound_hint",
            "music_mode",
            "music_hint",
            "person_count",
            "turn_count",
            "person_a_gender",
            "person_a_age",
            "person_a_advanced",
            "turn_1_speaker",
            "turn_1_elapsed_seconds",
            "turn_1_action",
            "turn_1_dialogue_text",
            "turn_1_dialogue_language",
            "turn_1_dialogue_delivery",
        }
        for name, spec in list(required.items()):
            field_type, options = spec
            options = dict(options)
            # Some inherited Main controls (notably camera_shot_1_framing)
            # already carry hidden=True before the R2V initial-view pass.  The
            # fresh-node contract must be authoritative in both directions:
            # explicitly unhide Basic-View members and hide everything else.
            options["hidden"] = name not in initial_basic_widgets
            required[name] = (field_type, options)

        # Keep the initial R2V surface compact. Additional reference sockets are
        # a frontend concern and must never be bulk-seeded into a fresh node.
        optional = _ContainsAnyDict({
            "ref_image_0": (
                "IMAGE",
                {"tooltip": "MiniMax H3 R2V Picture 1 reference."},
            ),
            "ref_video_0": (
                "VIDEO",
                {"tooltip": "MiniMax H3 R2V Video 1 reference."},
            ),
            "ref_video_audio_0": (
                "AUDIO",
                {"tooltip": "Optional audio track paired with R2V Video 1."},
            ),
            "ref_audio_0": (
                "AUDIO",
                {"tooltip": "MiniMax H3 R2V Audio 1 reference."},
            ),
        })
        return {"required": required, "optional": optional}

    @classmethod
    def VALIDATE_INPUTS(cls, scene_prompt, ultra_scene_validation_gate):
        # Keep a completely empty R2V draft queueable. The hidden gate remains
        # in the schema for workflow/widget compatibility; true R2V contract
        # violations are still blocked inside build/_build_impl.
        return True

    CATEGORY = "Ultra/MiniMax H3"
    DESCRIPTION = "MiniMax H3 Ref2VA prompt compiler with dynamic image/video/audio references and official six-section full-reference formatting."
    SEARCH_ALIASES = ["MiniMax H3 R2V Prompt", "H3 Ref2VA Prompt", "Ultra H3 R2V"]

    @staticmethod
    def _block_message_from_info(info: Any) -> str:
        return _warning_message_from_info(
            info,
            "R2V prompt generation was blocked by an invalid or incomplete input setting. Check the R2V node settings.",
        )

    def build(self, **kwargs):
        """R2V-only node boundary with visible reasons for true hard blocks.

        Draftable semantic/reference conflicts are reported as warnings inside
        ``_build_impl``. Official physical-source count limits, reliably
        measurable reference-duration limits, and genuinely invalid structural
        inputs remain hard blocks. Hard blocks use a message-bearing
        ExecutionBlocker so ComfyUI shows the reason instead of silently
        completing with no prompt output.
        """
        try:
            result = self._build_impl(**kwargs)
        except _TranslationDependencyUnavailableError as exc:
            message = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "dependency", exc)
            info = f"version={VERSION}\nstatus=waiting_for_translation\nwarning={message}"
            return _blocked_result(info, message)
        except _TranslationRateLimitedError as exc:
            message = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "rate_limit", exc)
            info = f"version={VERSION}\nstatus=waiting_for_translation_rate_limit\nwarning={message}"
            return _blocked_result(info, message)
        except _TranslationNetworkUnavailableError as exc:
            message = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "network", exc)
            info = f"version={VERSION}\nstatus=waiting_for_translation\nwarning={message}"
            return _blocked_result(info, message)
        except _TranslationUnavailableError as exc:
            message = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "service", exc)
            info = f"version={VERSION}\nstatus=waiting_for_translation\nwarning={message}"
            return _blocked_result(info, message)
        except _UserInputError as exc:
            message = str(exc)
            info = f"version={VERSION}\nstatus=waiting_for_valid_input\nwarning={message}"
            return _blocked_result(info, message)

        if isinstance(result, tuple) and len(result) == 2:
            prompt, info = result
            if ExecutionBlocker is not None and isinstance(prompt, ExecutionBlocker):
                # A completely empty draft is intentionally a silent waiting
                # state: Queue execution is not rejected and only this output
                # branch remains blocked. Preserve that behavior for R2V. True
                # invalid-input blockers still carry the adapted R2V reason.
                if "status=waiting_for_content" in str(info or ""):
                    return ExecutionBlocker(None), info
                return ExecutionBlocker(self._block_message_from_info(info)), info
        return result

    def _build_impl(self, **kwargs):
        duration = _validate_int_field(
            kwargs.get("duration_seconds", 5), "duration_seconds", 4, R2V_MAX_DURATION_SECONDS
        )
        requested_person_count = _validate_int_field(kwargs.get("person_count", 1), "person_count", 0, 3)
        requested_turn_count = _validate_int_field(kwargs.get("turn_count", 1), "turn_count", 1, MAX_TURNS)
        sequential_vocal = _sequential_vocal_from_kwargs(kwargs, requested_turn_count)
        plan_warnings: List[str] = []
        requested_scene_translate = _canonical_choice(
            kwargs.get("scene_translate", "ko_to_en"), ("ko_to_en", "off"), "scene_translate"
        )
        # `scene_translate` is the authoritative global switch for every
        # non-dialogue descriptive field in R2V. When the user explicitly
        # selects Off, Korean scene/action/profile/reference/sound/music text is
        # preserved exactly as entered and no online translation route is used.

        # The inherited Main compiler already protects its own [Shot]/<d> syntax.
        # R2V adds a second reserved namespace for its six sections and reference
        # labels, so reject those tokens in ordinary descriptive fields before
        # any translation or reference markup is introduced by this compiler.
        r2v_plain_text_fields = ["scene_prompt", "sound_hint", "music_hint"]
        for person in ("a", "b", "c"):
            r2v_plain_text_fields.extend([
                f"person_{person}_appearance_desc",
                f"person_{person}_clothing_desc",
                f"person_{person}_voice_desc",
            ])
        for index in range(1, MAX_TURNS + 1):
            r2v_plain_text_fields.extend([
                f"turn_{index}_action",
                f"turn_{index}_dialogue_text",
            ])
        for field_name in r2v_plain_text_fields:
            _reject_r2v_reserved_user_text(kwargs.get(field_name, ""), field_name)
        _reject_r2v_reserved_user_text(sequential_vocal.get("narrator_voice_desc", ""), "narrator_voice_desc")
        for turn_index in range(1, requested_turn_count + 1):
            seq_turn = _sequential_turn_state(sequential_vocal, turn_index)
            for slot_index in (2, 3):
                _reject_r2v_reserved_user_text(
                    seq_turn.get(f"text_{slot_index}", ""),
                    f"turn_{turn_index}_vocal_{slot_index}_dialogue_text",
                )

        groups = _connected_assets(kwargs)
        unique_image_count = _unique_asset_count(groups["ref_image"], kwargs)
        unique_video_count = _unique_asset_count(groups["ref_video"], kwargs)
        independent_audio_names = _independent_audio_names(groups, kwargs)
        unique_standalone_audio_count = _unique_asset_count(independent_audio_names, kwargs)
        reference_limit_errors: List[str] = []
        if unique_image_count > R2V_MAX_IMAGES:
            reference_limit_errors.append(
                f"{unique_image_count} unique reference images are connected; the maximum is {R2V_MAX_IMAGES}."
            )
        if unique_video_count > R2V_MAX_VIDEOS:
            reference_limit_errors.append(
                f"{unique_video_count} unique reference videos are connected; the maximum is {R2V_MAX_VIDEOS}."
            )
        if unique_standalone_audio_count > R2V_MAX_AUDIOS:
            reference_limit_errors.append(
                f"{unique_standalone_audio_count} unique independent reference audios are connected; the maximum is {R2V_MAX_AUDIOS}. "
                "Standalone Audio sockets and Video-Audio sockets without their same-numbered Video share this limit."
            )
        # A same-numbered Video soundtrack belongs to that Video source and is
        # not counted twice.  An orphan ref_video_audio_N has no Video source to
        # belong to, so it is an independent AUDIO source and shares both the
        # Audio <= 3 limit above and the official mixed-file <= 12 budget below.
        mixed_file_count = unique_image_count + unique_video_count + unique_standalone_audio_count
        # Official H3 Ref2VA does not accept Audio as the sole reference modality.
        # A standalone/orphan Audio reference must be accompanied by at least one
        # connected Picture or Video source.  Keep this fail-closed instead of
        # generating a prompt that the model entry itself cannot accept.
        if unique_standalone_audio_count > 0 and unique_image_count == 0 and unique_video_count == 0:
            reference_limit_errors.append(
                "Reference Audio cannot be used as the sole R2V input. Connect at least one reference Picture or Video together with the Audio."
            )
        if mixed_file_count > 12:
            reference_limit_errors.append(
                f"{mixed_file_count} mixed unique source files are connected; the maximum is 12."
            )
        if reference_limit_errors:
            raise _UserInputError(
                "R2V reference limit exceeded: " + " ".join(reference_limit_errors) +
                " Reuse the same upstream media object for additional semantic roles instead of adding another unique physical source."
            )
        video_names = set(groups["ref_video"])
        for soundtrack_name in groups["ref_video_audio"]:
            suffix = soundtrack_name.rsplit("_", 1)[-1]
            if f"ref_video_{suffix}" not in video_names:
                plan_warnings.append(
                    f"{soundtrack_name} is connected without its same-numbered reference video. The prompt was still generated and this soundtrack is treated as an independent audio-style cue."
                )

        # Block only duration violations that can be measured reliably. Unknown
        # custom media remain compatible rather than being rejected by guesswork.
        reference_duration_errors = _reference_media_duration_errors(groups, kwargs)
        if reference_duration_errors:
            raise _UserInputError(
                "R2V reference duration limit exceeded: " + " ".join(reference_duration_errors) +
                " Adjust the connected reference media duration before generating the prompt."
            )

        plan = _parse_reference_plan(kwargs.get("reference_plan_json", "{}"))
        all_connected = sorted(sum(groups.values(), []), key=_asset_sort_key)
        plan = _apply_reference_text_inputs(plan, kwargs, all_connected)
        translated_plan: Dict[str, Dict[str, str]] = {}
        active_shot_count = _active_shot_count(kwargs)
        for name in all_connected:
            entry = plan.get(name, {})
            role = entry.get("role") or _default_role(name)
            role = _canonical_choice(role, _role_values_for(name), f"{name}_role")
            scope = _canonical_choice(entry.get("scope", "auto") or "auto", R2V_SCOPE_VALUES, f"{name}_scope")
            repaired_scope, scope_changed = _repair_reference_scope(scope, active_shot_count)
            if scope_changed:
                plan_warnings.append(
                    f"{name}: reference scope {scope!r} exceeded the current {active_shot_count} Shot layout; it was repaired to {repaired_scope!r}."
                )
                scope = repaired_scope
            relationship_mode = entry.get("relationship", "auto") or "auto"
            relationship = _resolve_relationship(name, role, relationship_mode)
            subject_group = entry.get("subject_group", "auto") or "auto"
            dialogue_target = entry.get("dialogue_target", "auto") or "auto"
            if role == "dialogue_content":
                dialogue_target = _canonical_choice(dialogue_target, DIALOGUE_TARGET_VALUES, f"{name}_dialogue_target")
            else:
                dialogue_target = "auto"
            if role in GROUPABLE_SUBJECT_ROLES:
                subject_group = _canonical_choice(subject_group, SUBJECT_GROUP_VALUES, f"{name}_subject_group")
            else:
                subject_group = "auto"

            # `content` describes what is actually present in the reference asset.
            # `instruction` describes how that source should be used/changed in the
            # target. Keeping them separate lets subject_definitions remain factual
            # while retention_analysis carries the target relationship.
            content = entry.get("content", "")
            instruction = entry.get("instruction", "")
            if role == "interface_visible_text":
                # Visible scene text is an exact-string contract, not descriptive
                # prose: preserve internal whitespace and punctuation verbatim and
                # let only the surrounding English wrapper explain its role.
                translated_content = _visible_text_literal(content)
                content_warnings: List[str] = []
            elif role == "dialogue_content":
                # Exact reference-audio dialogue/lyrics keep their original words
                # and language and are never translated. Punctuation is normalized
                # only when the text is emitted inside <d>, per the Full-Reference
                # guide; keep the raw source transcript here for matching/binding.
                translated_content = str(content or "").strip()
                content_warnings = []
            else:
                translated_content, content_warnings = _translate_korean_descriptive_text_if_needed(content, f"{name}_reference_content", translate_mode=requested_scene_translate)
                translated_content = re.sub(r"\s+", " ", translated_content).strip()
            translated_instruction, instruction_warnings = _translate_korean_descriptive_text_if_needed(instruction, f"{name}_reference_instruction", translate_mode=requested_scene_translate)
            translated_instruction = re.sub(r"\s+", " ", translated_instruction).strip()
            # Normalize only the descriptive source-content prose after translation.
            # This keeps the physical reference contract unchanged while preventing
            # contradictory person pronouns and non-person "They see ..." artifacts
            # from leaking into subject_definitions and later H3 reference clauses.
            target_person = _person_key_from_role(role)
            target_gender = ""
            if target_person:
                gender_key = f"person_{target_person.lower()}_gender"
                raw_gender = str(kwargs.get(gender_key, "unspecified") or "unspecified")
                target_gender = _canonical_choice(
                    raw_gender, ("unspecified", "female", "male", "nonbinary"), gender_key
                )
            translated_content = _r2v_clean_reference_content(role, translated_content, target_gender)
            _reject_r2v_reserved_user_text(translated_content, f"translated {name}_reference_content")
            _reject_r2v_reserved_user_text(translated_instruction, f"translated {name}_reference_instruction")
            if role == "custom" and not (translated_content or translated_instruction):
                role = "general_reference"
                relationship_mode = "auto"
                relationship = _resolve_relationship(name, role, relationship_mode)
                plan_warnings.append(
                    f"{name}: Custom reference was selected without Source Content or Apply Instruction; it was repaired to General reference."
                )
            content_recommended_roles = {
                "person_a_identity", "person_b_identity", "person_c_identity",
                "person_a_clothing", "person_b_clothing", "person_c_clothing",
                "person_a_pose_expression", "person_b_pose_expression", "person_c_pose_expression",
                "person_a_motion", "person_b_motion", "person_c_motion",
                "scene_environment", "animal_nonhuman_subject", "style_reference", "object_prop", "visual_effect",
                "interface_visible_text", "camera_motion", "cuts_rhythm",
                "narrator_voice", "music_style", "sound_effects", "rhythm_timing", "audio_continuity",
            }
            if role in content_recommended_roles and not translated_content:
                plan_warnings.append(
                    f"{name}: Source Content is empty for role={role}. This prompt-only node cannot inspect the reference media; "
                    "describe the concrete visible/audible source characteristics when you need a more explicit Context-IR-style rewrite."
                )
            # Validate any explicit shot target immediately so stale workflow
            # state cannot silently point at a shot that no longer exists.
            _shot_scope(role, scope, active_shot_count)
            plan_warnings.extend(content_warnings)
            plan_warnings.extend(instruction_warnings)
            translated_plan[name] = {
                "role": role,
                "scope": scope,
                "relationship": relationship,
                "relationship_mode": relationship_mode,
                "subject_group": subject_group,
                "dialogue_target": dialogue_target,
                "content": translated_content,
                "instruction": translated_instruction,
            }

        def repair_plan_role(name: str, new_role: str, reason: str) -> None:
            entry = translated_plan[name]
            old_role = entry.get("role", "general_reference")
            if old_role == new_role:
                return
            entry["role"] = new_role
            entry["relationship_mode"] = "auto"
            entry["relationship"] = _resolve_relationship(name, new_role, "auto")
            if new_role not in GROUPABLE_SUBJECT_ROLES:
                entry["subject_group"] = "auto"
            plan_warnings.append(f"{name}: {reason} Role was repaired from {old_role} to {new_role}.")

        # Reject relationship combinations that are structurally ambiguous or
        # self-contradictory before compiling the target prompt. H3 can combine
        # many references, but one target cannot simultaneously be a direct edit
        # and a continuation of different source videos, nor have two concrete
        # first/final frame anchors or two complete final-audio signals.
        video_edit_sources = [
            name for name in groups["ref_video"]
            if translated_plan[name]["role"] == "video_edit_source"
        ]
        video_continuation_sources = [
            name for name in groups["ref_video"]
            if translated_plan[name]["role"] == "video_continuation_source"
        ]
        if len(video_edit_sources) > 1:
            for name in video_edit_sources[1:]:
                repair_plan_role(name, "general_reference", "Only one direct video-edit source can be authoritative.")
            video_edit_sources = video_edit_sources[:1]
        if len(video_continuation_sources) > 1:
            for name in video_continuation_sources[1:]:
                repair_plan_role(name, "general_reference", "Only one video-continuation source can be authoritative.")
            video_continuation_sources = video_continuation_sources[:1]
        if video_edit_sources and video_continuation_sources:
            # Preserve the earlier physical source in deterministic source order
            # and downgrade the competing relationship to a general reference.
            primary = min(video_edit_sources[0], video_continuation_sources[0], key=_asset_sort_key)
            if primary == video_edit_sources[0]:
                repair_plan_role(video_continuation_sources[0], "general_reference", "Direct edit and continuation cannot both be authoritative in one target.")
                video_continuation_sources = []
            else:
                repair_plan_role(video_edit_sources[0], "general_reference", "Direct edit and continuation cannot both be authoritative in one target.")
                video_edit_sources = []

        first_frame_anchors = [
            name for name in groups["ref_image"]
            if translated_plan[name]["role"] == "first_frame_anchor"
        ]
        last_frame_anchors = [
            name for name in groups["ref_image"]
            if translated_plan[name]["role"] == "last_frame_anchor"
        ]
        if len(first_frame_anchors) > 1:
            for name in first_frame_anchors[1:]:
                repair_plan_role(name, "general_reference", "Only one concrete first-frame anchor can be authoritative.")
            first_frame_anchors = first_frame_anchors[:1]
        if len(last_frame_anchors) > 1:
            for name in last_frame_anchors[1:]:
                repair_plan_role(name, "general_reference", "Only one concrete final-frame anchor can be authoritative.")
            last_frame_anchors = last_frame_anchors[:1]

        connected_audio_names = groups["ref_video_audio"] + groups["ref_audio"]
        full_audio_sources = [
            name for name in connected_audio_names
            if translated_plan[name]["role"] == "full_audio_reuse"
        ]
        if len(full_audio_sources) > 1:
            # Multiple complete-final-audio contracts are contradictory. Keep
            # all physical references but downgrade every complete-reuse source
            # to partial reuse so the prompt can still use them safely.
            for name in full_audio_sources:
                repair_plan_role(name, "partial_audio_reuse", "Multiple complete Audio reuse sources conflict with each other.")
            full_audio_sources = []
        elif full_audio_sources:
            full_name = full_audio_sources[0]
            must_downgrade_full = False
            reasons: List[str] = []
            if _unique_asset_count(connected_audio_names, kwargs) > 1:
                must_downgrade_full = True
                reasons.append("additional Audio references are connected")

            active_turns = requested_turn_count
            scripted_dialogue = []
            for index in range(1, active_turns + 1):
                seq_turn = _sequential_turn_state(sequential_vocal, index)
                if (
                    str(kwargs.get(f"turn_{index}_dialogue_text", "") or "").strip()
                    or any(str(seq_turn.get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
                ):
                    scripted_dialogue.append(index)
            if scripted_dialogue:
                must_downgrade_full = True
                reasons.append("scripted target dialogue is present")
            sound_mode = str(kwargs.get("soundscape_mode", "auto") or "auto")
            sound_hint = str(kwargs.get("sound_hint", "") or "").strip()
            if sound_mode != "auto" or sound_hint:
                must_downgrade_full = True
                reasons.append("explicit target soundscape settings are present")
            music_mode = str(kwargs.get("music_mode", "none") or "none")
            music_hint = str(kwargs.get("music_hint", "") or "").strip()
            if music_mode != "none" or music_hint:
                must_downgrade_full = True
                reasons.append("independent target music is present")
            if must_downgrade_full:
                repair_plan_role(
                    full_name,
                    "partial_audio_reuse",
                    "Full audio reuse conflicts with " + ", ".join(reasons) + ".",
                )
                full_audio_sources = []

        voice_sources: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        dialogue_content_sources: List[str] = []
        for name in connected_audio_names:
            role = translated_plan[name]["role"]
            person = _person_key_from_role(role)
            if person and role.endswith("_voice"):
                voice_sources[person].append(name)
            if role == "dialogue_content":
                dialogue_content_sources.append(name)
        for person, sources in voice_sources.items():
            if len(sources) > 1:
                for name in sources[1:]:
                    repair_plan_role(
                        name, "general_reference",
                        f"Person {person} already has an earlier authoritative voice-timbre Audio reference."
                    )
                voice_sources[person] = sources[:1]
        narrator_voice_sources = [
            name for name in connected_audio_names
            if translated_plan[name]["role"] == "narrator_voice"
        ]
        if len(narrator_voice_sources) > 1:
            for name in narrator_voice_sources[1:]:
                repair_plan_role(
                    name, "general_reference",
                    "The independent Narrator already has an earlier authoritative voice-timbre Audio reference."
                )
            narrator_voice_sources = narrator_voice_sources[:1]
        person_count_for_refs = requested_person_count
        for name, entry in translated_plan.items():
            target_person = _person_key_from_role(entry["role"])
            if target_person == "A" and person_count_for_refs < 1:
                plan_warnings.append(
                    f"{name} targets Person A, but person_count is {person_count_for_refs}. The prompt was still generated; increase person_count when you want that target person to exist explicitly in the final prompt."
                )
            if target_person == "B" and person_count_for_refs < 2:
                plan_warnings.append(
                    f"{name} targets Person B, but person_count is {person_count_for_refs}. The prompt was still generated; increase person_count when you want that target person to exist explicitly in the final prompt."
                )
            if target_person == "C" and person_count_for_refs < 3:
                plan_warnings.append(
                    f"{name} targets Person C, but person_count is {person_count_for_refs}. The prompt was still generated; increase person_count when you want that target person to exist explicitly in the final prompt."
                )
            dialogue_target = entry.get("dialogue_target", "auto")
            if entry["role"] == "dialogue_content" and dialogue_target not in {"auto", "Narrator"}:
                for slot in dialogue_target.split("+"):
                    required_count = {"A": 1, "B": 2, "C": 3}.get(slot, 99)
                    if person_count_for_refs < required_count:
                        plan_warnings.append(
                            f"{name} exact-dialogue target {dialogue_target} requires Person {slot}, but person_count is {person_count_for_refs}. The prompt was still generated; add that person to the target cast when you need an explicit match."
                        )

        # Reference relationships outrank inherited T2V/I2VA target controls.
        # `Auto` must remain migration-friendly: older workflows did not have a
        # relationship selector, so an automatically resolved fully-preserved
        # relationship is softened to partially_preserved when the user already
        # has an explicit target override for the same property. Only an
        # explicitly chosen Fully preserved relationship is treated as a hard
        # contradiction.
        extension_options = _parse_extension_options_json(kwargs.get("ultra_extension_options_json", "{}"))
        explicit_style = str(kwargs.get("visual_style", "auto") or "auto")
        explicit_camera = str(kwargs.get("camera_motion", "auto") or "auto")

        def soften_auto_reference(name: str, entry: Dict[str, str], reason: str) -> bool:
            if entry.get("relationship") != "fully_preserved":
                return False
            explicit = entry.get("relationship_mode", "auto") != "auto"
            entry["relationship"] = "partially_preserved"
            plan_warnings.append(
                f"{name}: {'Explicit' if explicit else 'Auto'} Fully preserved conflicted with {reason}; "
                "it was repaired to Partially preserved so both the reference and target instruction can remain usable."
            )
            return True

        for name, entry in translated_plan.items():
            role = entry["role"]
            relationship = entry["relationship"]
            person = _person_key_from_role(role)

            if role == "style_reference" and relationship == "fully_preserved" and explicit_style != "auto":
                soften_auto_reference(name, entry, "Visual Style is explicitly set")
                relationship = entry["relationship"]

            if role == "camera_motion" and relationship == "fully_preserved":
                explicit_shot_motion = False
                if _validate_bool_field(kwargs.get("camera_sequence_enabled", False), "camera_sequence_enabled"):
                    shot_count, _ = _camera_sequence_from_kwargs(kwargs, kwargs.get("duration_seconds", 5))
                    for shot in range(2, shot_count + 1):
                        if str(kwargs.get(f"camera_shot_{shot}_motion", "auto") or "auto") != "auto":
                            explicit_shot_motion = True
                            break
                if explicit_camera != "auto" or explicit_shot_motion:
                    soften_auto_reference(name, entry, "an independent target camera movement is selected")
                    relationship = entry["relationship"]

            if role == "cuts_rhythm" and relationship == "fully_preserved" and _validate_bool_field(kwargs.get("camera_sequence_enabled", False), "camera_sequence_enabled"):
                soften_auto_reference(name, entry, "a manual multi-shot camera sequence is enabled")
                relationship = entry["relationship"]

            if person and relationship == "fully_preserved":
                key = person.lower()
                if role.endswith("identity"):
                    gender = str(kwargs.get(f"person_{key}_gender", "unspecified") or "unspecified")
                    age = str(kwargs.get(f"person_{key}_age", "unspecified") or "unspecified")
                    preset = str(kwargs.get(f"person_{key}_appearance_preset", "none") or "none")
                    desc = str(kwargs.get(f"person_{key}_appearance_desc", "") or "").strip()
                    ethnic = str(
                        (((extension_options or {}).get("person", {}).get(person, {}).get("profile", {}) or {}).get("ethnic_appearance", "none"))
                        or "none"
                    )
                    identity_overrides = []
                    if gender != "unspecified":
                        identity_overrides.append("gender")
                    if age != "unspecified":
                        identity_overrides.append("age")
                    if ethnic != "none":
                        identity_overrides.append("ethnic appearance")
                    if preset != "none":
                        identity_overrides.append("appearance preset")
                    if desc:
                        identity_overrides.append("appearance additional input")
                    if identity_overrides:
                        override_text = ", ".join(identity_overrides)
                        soften_auto_reference(name, entry, f"Person {person} has explicit target identity/appearance settings ({override_text})")
                        relationship = entry["relationship"]
                if role.endswith("clothing"):
                    preset = str(kwargs.get(f"person_{key}_clothing_preset", "none") or "none")
                    desc = str(kwargs.get(f"person_{key}_clothing_desc", "") or "").strip()
                    if preset != "none" or desc:
                        soften_auto_reference(name, entry, f"Person {person} has an explicit target clothing override")
                        relationship = entry["relationship"]

            if role in {"person_a_voice", "person_b_voice", "person_c_voice", "narrator_voice"} and entry["instruction"]:
                # Keep this as a warning rather than a hard error: a user may use
                # target voice text to refine delivery while still referencing the
                # source timbre.
                plan_warnings.append(
                    f"{name}: the voice reference also has an Apply Instruction; the reference timbre remains authoritative while the instruction may refine delivery."
                )

        effective_person_count = requested_person_count
        if requested_person_count == 0:
            required_person_count = 0
            for index in range(1, requested_turn_count + 1):
                action = str(kwargs.get(f"turn_{index}_action", "") or "").strip()
                required_person_count = max(required_person_count, _r2v_action_required_person_count(action))
            # Explicit Person-scoped references are also authoritative evidence
            # that the run needs a cast. Speech alone is not: with zero people the
            # UI permits only Narrator, so stale hidden A/B/C speaker state must not
            # silently invent a visible Person.
            for entry in translated_plan.values():
                person = _person_key_from_role(entry.get("role", ""))
                if person:
                    required_person_count = max(required_person_count, {"A": 1, "B": 2, "C": 3}[person])
            if required_person_count:
                effective_person_count = min(3, required_person_count)
                plan_warnings.append(
                    f"person_count was 0 but explicit visible-person action/reference content requires a cast; "
                    f"this run was repaired to person_count={effective_person_count}."
                )

        timeline_kwargs = kwargs
        if requested_person_count == 0 and effective_person_count > 0:
            # The zero-person UI stores Narrator as its only valid Timeline target.
            # If explicit human wording/reference evidence promotes the cast, bind
            # the visible action to the person/group named by that wording instead
            # of dropping it as a Narrator action.
            timeline_kwargs = dict(kwargs)
            for index in range(1, requested_turn_count + 1):
                preferred = _r2v_preferred_speaker_for_explicit_action(
                    kwargs.get(f"turn_{index}_action", ""), effective_person_count
                )
                if preferred:
                    timeline_kwargs[f"turn_{index}_speaker"] = preferred
                    plan_warnings.append(
                        f"Progress {index}: person_count=0 was promoted by explicit visible-person action text; "
                        f"the action target was repaired to {preferred}."
                    )

        timeline_events = _r2v_timeline_events(
            timeline_kwargs, duration, active_shot_count, extension_options, sequential_vocal,
            effective_person_count, warnings=plan_warnings,
        )
        sequential_active = any(
            bool(_sequential_turn_state(sequential_vocal, index).get("enabled"))
            for index in range(1, int(kwargs.get("turn_count", 1) or 1) + 1)
        )
        scene_phase_paragraphs = _r2v_scene_phase_paragraphs(kwargs.get("scene_prompt", ""), active_shot_count, timeline_events)
        # Backward compatibility: earlier R2V builds represented the people-free
        # narrator through a hidden neutral A speaker row. When such a workflow
        # still has a narrator_voice reference, migrate those legacy rows in memory
        # instead of suddenly rejecting or turning them into a visible Person A.
        if effective_person_count == 0 and narrator_voice_sources:
            for event in timeline_events:
                if event["speaker"] == "A" and not bool((event.get("sequential_vocal") or {}).get("enabled")):
                    event["speaker"] = "Narrator"
                    for vocal in event.get("vocal_events", []):
                        if vocal.get("speaker") == "A":
                            vocal["speaker"] = "Narrator"
                            vocal["delivery"] = "narrator"
        narrator_events = [event for event in timeline_events if event["speaker"] == "Narrator"]
        visible_events = [event for event in timeline_events if event["speaker"] != "Narrator"]
        if not sequential_active:
            _validate_r2v_narrator_dialogue_timing(
                narrator_events, kwargs, duration, active_shot_count, plan_warnings
            )
        if effective_person_count == 0 and visible_events:
            # Defensive fallback: visible rows should already have promoted the
            # effective count above. If one remains, reinterpret it as Narrator
            # rather than failing the queue.
            for event in visible_events:
                event["speaker"] = "Narrator"
                event["action"] = ""
                for vocal in event.get("vocal_events", []):
                    vocal["speaker"] = "Narrator"
                    vocal["delivery"] = "narrator"
            plan_warnings.append(
                "A people-free R2V run contained a stale visible-person Timeline row; it was repaired to independent Narrator output."
            )
            narrator_events = list(timeline_events)
            visible_events = []
        for event in narrator_events:
            if event["action"] and not event.get("people_free_action"):
                plan_warnings.append(
                    f"Turn {event['source_turn_index']}: Narrator is an independent off-screen voice, so the Timeline action field was ignored. Put visible action in scene_prompt or a visible Person turn."
                )
            if (
                not _turn_vocal_events(event)
                and not (event.get("people_free_action") and str(event.get("action", "") or "").strip())
                and not any(event.get(key, TURN_SCENE_KEEP) != TURN_SCENE_KEEP for key in ("scene_location_override", "scene_weather_override"))
            ):
                plan_warnings.append(
                    f"Turn {event['source_turn_index']}: Narrator has no dialogue text, so this narrator row contributes no vocal event."
                )

        base_kwargs = dict(kwargs)
        if scene_phase_paragraphs:
            base_kwargs["scene_prompt"] = scene_phase_paragraphs.get(1, str(kwargs.get("scene_prompt", "") or ""))
        base_kwargs.update(
            {
                "mode": "t2va",
                # R2V exposes the same global non-dialogue translation control
                # as Main. Off preserves the shared scene and all R2V-owned
                # descriptive text exactly as entered; automatic mode translates
                # Korean descriptive text while leaving dialogue verbatim.
                "scene_translate": requested_scene_translate,
                "duration_seconds": duration,
                "reference_fidelity": "balanced",
                "i2va_preserve_reference_clothing": False,
                "start_image": None,
                "end_image": None,
                # Internal-only contract: R2V Timeline dialogue is literal
                # source speech and must not be prose-whitespace-normalized by
                # the inherited Main compiler.
                "_preserve_timeline_dialogue_verbatim": True,
            }
        )

        # Reset the inherited Main timeline surface before repacking the active
        # R2V rows. Continue Speaking is a formal backend schema, so every hidden
        # slot is reset explicitly; no UI-only positional state participates here.
        for index in range(1, MAX_TURNS + 1):
            base_kwargs[f"turn_{index}_speaker"] = "A"
            base_kwargs[f"turn_{index}_elapsed_seconds"] = 0.0
            base_kwargs[f"turn_{index}_action"] = ""
            base_kwargs[f"turn_{index}_dialogue_text"] = ""
            base_kwargs[f"turn_{index}_dialogue_language"] = "auto"
            base_kwargs[f"turn_{index}_dialogue_delivery"] = "on_screen"
            base_kwargs[f"turn_{index}_sequential_vocal"] = False
            base_kwargs[f"turn_{index}_vocal_1_speaker"] = "A"
            for slot in (2, 3):
                base_kwargs[f"turn_{index}_vocal_{slot}_text"] = ""
                base_kwargs[f"turn_{index}_vocal_{slot}_speaker"] = "A"
                base_kwargs[f"turn_{index}_vocal_{slot}_language"] = "auto"
                base_kwargs[f"turn_{index}_vocal_{slot}_delivery"] = "on_screen"

        remapped_extension = json.loads(json.dumps(extension_options)) if extension_options else {}
        remapped_turn_state: Dict[str, Any] = {}

        # A connected Narrator voice reference is authoritative for timbre and
        # delivery. Otherwise preserve the Core STRING Narrator voice text when
        # R2V repacks Continue-Speaking into the inherited Main compiler.
        narrator_text_voice = str(sequential_vocal.get("narrator_voice_desc", "") or "").strip()
        if narrator_voice_sources:
            if narrator_text_voice:
                plan_warnings.append(
                    "Narrator voice Audio Reference is connected, so it takes priority over the text Narrator voice characteristics for timbre/delivery."
                )
            base_kwargs["narrator_voice_preset"] = "auto"
            base_kwargs["narrator_voice_desc"] = ""
        else:
            base_kwargs["narrator_voice_preset"] = "custom" if narrator_text_voice else "auto"
            base_kwargs["narrator_voice_desc"] = narrator_text_voice

        if sequential_active:
            # New path: the inherited compiler receives the complete A/B/C/N
            # VocalEvent sequence so ordering inside one Progress remains exact.
            packed_events: List[Dict[str, Any]] = [dict(event) for event in timeline_events]
            packed_events.sort(key=lambda item: (float(item["elapsed_seconds"]), int(item["source_turn_index"])))
            for target_index, event in enumerate(packed_events, start=1):
                source_index = int(event["source_turn_index"])
                source_speaker = str(event.get("speaker", "A") or "A")
                base_target = "A" if source_speaker == "Narrator" else source_speaker
                base_kwargs[f"turn_{target_index}_speaker"] = base_target
                base_kwargs[f"turn_{target_index}_elapsed_seconds"] = event["elapsed_seconds"]
                base_kwargs[f"turn_{target_index}_action"] = "" if source_speaker == "Narrator" else kwargs.get(f"turn_{source_index}_action", "")
                base_kwargs[f"turn_{target_index}_dialogue_text"] = kwargs.get(f"turn_{source_index}_dialogue_text", "")
                base_kwargs[f"turn_{target_index}_dialogue_language"] = kwargs.get(f"turn_{source_index}_dialogue_language", "auto")
                base_kwargs[f"turn_{target_index}_dialogue_delivery"] = kwargs.get(f"turn_{source_index}_dialogue_delivery", "on_screen")

                source_seq = dict(_sequential_turn_state(sequential_vocal, source_index))
                enabled = bool(source_seq.get("enabled")) or source_speaker == "Narrator"
                base_kwargs[f"turn_{target_index}_sequential_vocal"] = enabled
                base_kwargs[f"turn_{target_index}_vocal_1_speaker"] = (
                    "Narrator" if source_speaker == "Narrator" else str(source_seq.get("speaker_1") or source_speaker)
                )
                for slot in (2, 3):
                    text_value = str(source_seq.get(f"text_{slot}", "") or "")
                    base_kwargs[f"turn_{target_index}_vocal_{slot}_text"] = text_value
                    base_kwargs[f"turn_{target_index}_vocal_{slot}_speaker"] = (
                        "Narrator" if source_speaker == "Narrator" and text_value.strip()
                        else str(source_seq.get(f"speaker_{slot}") or SEQUENTIAL_VOCAL_ADDED_SLOT_DEFAULT_SPEAKER)
                    )
                    base_kwargs[f"turn_{target_index}_vocal_{slot}_language"] = str(source_seq.get(f"language_{slot}", "auto") or "auto")
                    base_kwargs[f"turn_{target_index}_vocal_{slot}_delivery"] = str(source_seq.get(f"delivery_{slot}", "on_screen") or "on_screen")

                source_turn_state = (extension_options.get("turn", {}).get(str(source_index), {}) if extension_options else {})
                if source_turn_state:
                    remapped_turn_state[str(target_index)] = source_turn_state
        else:
            # Legacy OFF path: preserve the recovery-final R2V compiler exactly.
            # Narrator rows remain outside Main and are reinserted afterward.
            packed_events = []
            for event in timeline_events:
                has_environment_change = any(
                    event.get(key, TURN_SCENE_KEEP) != TURN_SCENE_KEEP
                    for key in ("scene_location_override", "scene_weather_override")
                )
                if event["speaker"] == "Narrator":
                    if has_environment_change:
                        packed_events.append({**event, "speaker": "A", "action": "", "dialogue_text": "", "environment_only": True})
                    continue
                packed_events.append(dict(event))
            packed_events.sort(key=lambda item: (float(item["elapsed_seconds"]), int(item["source_turn_index"])))
            for target_index, event in enumerate(packed_events, start=1):
                source_index = int(event["source_turn_index"])
                base_kwargs[f"turn_{target_index}_speaker"] = event["speaker"]
                base_kwargs[f"turn_{target_index}_elapsed_seconds"] = event["elapsed_seconds"]
                if not event.get("environment_only"):
                    base_kwargs[f"turn_{target_index}_action"] = kwargs.get(f"turn_{source_index}_action", "")
                    base_kwargs[f"turn_{target_index}_dialogue_text"] = kwargs.get(f"turn_{source_index}_dialogue_text", "")
                    base_kwargs[f"turn_{target_index}_dialogue_language"] = kwargs.get(f"turn_{source_index}_dialogue_language", "auto")
                    base_kwargs[f"turn_{target_index}_dialogue_delivery"] = kwargs.get(f"turn_{source_index}_dialogue_delivery", "on_screen")
                source_turn_state = (extension_options.get("turn", {}).get(str(source_index), {}) if extension_options else {})
                if source_turn_state:
                    remapped_turn_state[str(target_index)] = source_turn_state

        if remapped_turn_state:
            remapped_extension["turn"] = remapped_turn_state
        else:
            remapped_extension.pop("turn", None)
        base_kwargs["ultra_extension_options_json"] = json.dumps(remapped_extension, ensure_ascii=False, separators=(",", ":"))
        base_kwargs["turn_count"] = max(1, len(packed_events))

        if effective_person_count == 0:
            # The inherited compiler requires one internal person slot, but all
            # visible-person fields and turns remain neutral so no phantom actor
            # can appear in a people-free scene.
            base_kwargs["person_count"] = 1
            for person in ("a", "b", "c"):
                base_kwargs[f"person_{person}_gender"] = "unspecified"
                base_kwargs[f"person_{person}_age"] = "unspecified"
                base_kwargs[f"person_{person}_advanced"] = False
                base_kwargs[f"person_{person}_appearance_preset"] = "none"
                base_kwargs[f"person_{person}_appearance_desc"] = ""
                base_kwargs[f"person_{person}_clothing_preset"] = "none"
                base_kwargs[f"person_{person}_clothing_desc"] = ""
                base_kwargs[f"person_{person}_voice_desc"] = ""
            for index in range(1, MAX_CAMERA_SHOTS + 1):
                target_key = f"camera_shot_{index}_target"
                framing_key = f"camera_shot_{index}_framing"
                if str(base_kwargs.get(target_key, "current_action")) not in {"current_action", "scene"}:
                    base_kwargs[target_key] = "current_action"
                    # A stale person framing can survive an old workflow or a
                    # rapid person-count reduction. Once the target is forced
                    # to a non-person target, normalize framing to Auto too.
                    base_kwargs[framing_key] = "auto"
        else:
            base_kwargs["person_count"] = effective_person_count

        # R2V can be driven by Picture/Video/Audio references, or by explicit
        # scene/timeline text with no external reference. Unlike ordinary T2VA,
        # connected reference media can itself define a valid
        # edit/continuation/anchor/reference task even when scene_prompt and all
        # visible Timeline rows are intentionally blank. Do not weaken the base
        # T2VA content gate globally; provide an R2V-only neutral scaffold solely
        # for the inherited compiler, then let the concrete Reference roles and
        # relationships below define the actual target. No source facts are invented.
        has_inherited_scene = bool(str(base_kwargs.get("scene_prompt", "") or "").strip())
        remapped_seq_state_for_gate = _sequential_vocal_from_kwargs(base_kwargs, int(base_kwargs.get("turn_count", 1) or 1))
        has_inherited_event = any(
            str(base_kwargs.get(f"turn_{index}_action", "") or "").strip()
            or str(base_kwargs.get(f"turn_{index}_dialogue_text", "") or "").strip()
            or any(str(_sequential_turn_state(remapped_seq_state_for_gate, index).get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
            for index in range(1, int(base_kwargs.get("turn_count", 1) or 1) + 1)
        )
        remapped_extension_state = _parse_extension_options_json(base_kwargs.get("ultra_extension_options_json", "{}"))
        has_environment_extension = _extension_has_explicit_environment_state(remapped_extension_state)
        has_people_free_action = any(
            bool(event.get("people_free_action")) and bool(str(event.get("action", "") or "").strip())
            for event in timeline_events
        )
        people_free_base_scaffold = has_people_free_action and not has_inherited_scene and not has_inherited_event and not has_environment_extension
        reference_only_base_scaffold = (
            bool(all_connected)
            and not has_people_free_action
            and not has_inherited_scene
            and not has_inherited_event
            and not has_environment_extension
        )
        scaffold_scene_used = False
        if reference_only_base_scaffold or people_free_base_scaffold:
            base_kwargs["scene_prompt"] = (
                "The scene follows the explicit visible Timeline action."
                if people_free_base_scaffold
                else "The target follows the connected reference media according to the defined reference relationships."
            )
            # Keep the user's scene_translate for the inherited compiler. The
            # scaffold sentence is already English, so no translation request
            # is made for it, but sound_hint / music_hint / other descriptive
            # fields compiled by Main still need ko_to_en. Forcing "off" here
            # leaked untranslated Korean into overall_soundscape and
            # non_diegetic_music for reference-only / people-free R2V runs.
            # Only the scaffold's own "already non-Korean" notice is dropped.
            scaffold_scene_used = True
            if reference_only_base_scaffold and not has_people_free_action:
                plan_warnings.append(
                    "R2V scene_prompt and visible Timeline content are empty, so a neutral reference-driven scaffold was used instead of blocking execution. "
                    "The connected Reference roles, relationships, content, and instructions remain authoritative; no unseen source details were invented by this prompt-only node."
                )

        base_prompt, base_info = super()._build_impl(**base_kwargs)
        # The inherited Main compiler intentionally returns an empty STRING
        # (or an ExecutionBlocker when available) for user-fixable draft/validation
        # states such as invalid 0.5-second timing or an incomplete scene. R2V must
        # propagate that state instead of trying to parse a prompt body that was
        # deliberately not produced.
        if not isinstance(base_prompt, str) or not base_prompt.strip():
            return base_prompt, _as_r2v_blocked_info(base_info, kwargs.get("ultra_ui_locale", "en"))
        integrated, soundscape, music = _split_base_prompt(base_prompt)

        if sequential_active:
            # The shared compiler sees the complete A/B/C/N VocalEvent sequence.
            speakers, speaker_event_shots = _speaker_events(integrated)
        else:
            # Recovery-final OFF path: Main saw visible A/B/C rows only. Reconcile
            # those S-IDs against the complete R2V Timeline and then inject the
            # independent Narrator exactly as before.
            desired_speakers = _timeline_global_speaker_ids(timeline_events)
            current_visible_speakers, _ = _speaker_events(integrated)
            integrated = _remap_visible_speaker_ids(integrated, current_visible_speakers, desired_speakers)
            speakers, speaker_event_shots = _speaker_events(integrated)

            narrator_spoken_events = [event for event in narrator_events if event["dialogue_text"]]
            if narrator_spoken_events:
                narrator_sid = desired_speakers.get("N")
                if not narrator_sid:
                    raise RuntimeError("R2V narrator dialogue exists but no global speaker ID was assigned.")
                narrator_clauses: Dict[int, List[Tuple[float, str]]] = {}
                narrator_shots: List[int] = []
                narrator_voice_desc = str(sequential_vocal.get("narrator_voice_desc", "") or "").strip()
                if narrator_voice_desc and not narrator_voice_sources:
                    narrator_voice_desc, narrator_voice_warnings = _translate_korean_descriptive_text_if_needed(
                        narrator_voice_desc, "narrator_voice_desc", translate_mode=requested_scene_translate
                    )
                    plan_warnings.extend(narrator_voice_warnings)
                for event in narrator_spoken_events:
                    language = event["dialogue_language"]
                    if language == "auto":
                        language = _detect_dialogue_language(event["dialogue_text"])
                    dialogue = event["dialogue_text"]
                    elapsed = float(event["elapsed_seconds"])
                    voice_clause = ""
                    if narrator_voice_desc and not narrator_voice_sources:
                        cleaned_voice = _clean_voice_desc_for_subject(narrator_voice_desc)
                        if cleaned_voice:
                            spoken_voice = re.sub(r"^(?:a|an)\s+", "", cleaned_voice, flags=re.I)
                            article = "an" if spoken_voice[:1].lower() in "aeiou" else "a"
                            voice_clause = f" with {article} {spoken_voice}"
                    time_prefix = "" if elapsed <= 0 else f"At approximately {elapsed:.2f} seconds, "
                    narrator_subject = "The independent narrator" if elapsed <= 0 else "the independent narrator"
                    clause = (
                        f"{time_prefix}{narrator_subject}{voice_clause} ({narrator_sid}) says in an off-screen voiceover: "
                        f"<d>[{language}] {dialogue}</d>"
                    )
                    narrator_clauses.setdefault(int(event["shot"]), []).append((elapsed, clause))
                    if int(event["shot"]) not in narrator_shots:
                        narrator_shots.append(int(event["shot"]))
                integrated = _inject_timed_shot_clauses(integrated, narrator_clauses)
                speakers["N"] = narrator_sid
                speaker_event_shots["N"] = narrator_shots

        # person_count=0 supports products/objects/animals/environments. Their
        # Timeline actions are intentionally compiled outside Main's Person A/B/C
        # renderer so a stale hidden speaker cannot create a phantom actor. Insert
        # them chronologically into the same Shot while leaving Narrator speech and
        # reference processing unchanged.
        people_free_clauses: Dict[int, List[Tuple[float, str]]] = {}
        for event in timeline_events:
            if not event.get("people_free_action"):
                continue
            clause = _r2v_people_free_action_clause(
                event.get("action", ""),
                float(event.get("elapsed_seconds", 0.0)),
                f"turn_{int(event.get('source_turn_index', 1))}_action",
                plan_warnings,
                translate_mode=requested_scene_translate,
            )
            if clause:
                # A tiny sort-only offset places the visible action before any
                # same-timestamp Narrator line; the rendered timestamp itself is
                # unchanged.
                sort_time = float(event.get("elapsed_seconds", 0.0)) - 1e-6
                people_free_clauses.setdefault(int(event.get("shot", 1)), []).append((sort_time, clause))
        if people_free_clauses:
            integrated = _inject_timed_shot_clauses(integrated, people_free_clauses)

        # Protect actual Timeline dialogue before any Reference-Audio verbal
        # markup is injected. This keeps identical dialogue text in different
        # Turns independently addressable by the later binding policy.
        integrated, timeline_dialogue_placeholders = _protect_timeline_dialogue_markup(
            integrated, timeline_events
        )

        picture_labels = _shared_asset_ordinals(groups["ref_image"], kwargs)
        video_labels = _shared_asset_ordinals(groups["ref_video"], kwargs)
        audio_labels = _audio_labels(groups, kwargs)

        person_sources: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        person_roles: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        person_relationships: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        person_reference_details: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        person_reference_instructions: Dict[str, List[str]] = {"A": [], "B": [], "C": []}
        person_reference_bindings: Dict[str, List[Dict[str, str]]] = {"A": [], "B": [], "C": []}
        # source name, definition text, role, content, instruction, scope, relationship, subject_group
        nonperson_subjects: List[Tuple[str, str, str, str, str, str, str, str]] = []
        # label, role, definition text, scope, relationship, instruction
        standalone_picture_defs: List[Tuple[str, str, str, str, str, str]] = []
        standalone_video_defs: List[Tuple[str, str, str, str, str, str]] = []
        # label, role, definition text, scope, relationship, content, instruction
        audio_defs: List[Tuple[str, str, str, str, str, str, str]] = []
        # label, scope, exact source content, instruction, target speaker/group
        dialogue_content_defs: List[Tuple[str, str, str, str, str]] = []
        # Attribute transfer uses its own source subject rather than pretending the
        # transferred source already is the target Person A/B/C.
        transfer_subjects: List[Tuple[str, str, str, str, str, str]] = []  # source label, role, target person, content, instruction, scope
        asset_roles: List[Tuple[str, str]] = []

        for name in all_connected:
            entry = translated_plan[name]
            role = entry["role"]
            content = entry["content"]
            instruction = entry["instruction"]
            scope = entry["scope"]
            relationship = entry["relationship"]
            subject_group = entry.get("subject_group", "auto")
            asset_roles.append((name, role))
            person = _person_key_from_role(role)

            if name.startswith("ref_image_"):
                label = f"<Picture {picture_labels[name]}>"
                if person:
                    descriptor = (
                        "identity/appearance" if role.endswith("identity")
                        else "clothing" if role.endswith("clothing")
                        else "pose/expression"
                    )
                    if relationship == "attribute_transfer":
                        transfer_subjects.append((label, role, person, content, instruction, scope))
                    else:
                        source_text = f"{descriptor} from {label}"
                        if content:
                            source_text += f": {_inline_prose(content)}"
                            person_reference_details[person].append(content)
                        if instruction:
                            person_reference_instructions[person].append(instruction)
                        person_sources[person].append(source_text)
                        person_roles[person].append(role)
                        person_relationships[person].append(relationship)
                        person_reference_bindings[person].append({
                            "source": label, "role": role, "content": content, "instruction": instruction,
                            "scope": scope, "relationship": relationship,
                        })
                elif role in {"scene_environment", "animal_nonhuman_subject", "style_reference", "object_prop", "visual_effect", "interface_visible_text", "general_reference", "custom"}:
                    source_kind = {
                        "scene_environment": "environment",
                        "animal_nonhuman_subject": "animal/non-human subject",
                        "style_reference": "visual style",
                        "object_prop": "object/prop",
                        "visual_effect": "visual effect",
                        "interface_visible_text": "visible text/interface",
                        "general_reference": "general visible content",
                        "custom": "custom visible content",
                    }[role]
                    definition = f"{source_kind} from {label}"
                    if content:
                        if role == "interface_visible_text":
                            definition += f", preserving the original-language visible content {_quoted_visible_text(content)}"
                        else:
                            definition += f": {_inline_prose(content)}"
                    nonperson_subjects.append((name, definition, role, content, instruction, scope, relationship, subject_group))
                elif role in {"first_frame_anchor", "keyframe_anchor", "edited_keyframe_anchor", "last_frame_anchor", "composition_anchor"}:
                    target_shots = _shot_scope(role, scope, active_shot_count)
                    target = target_shots[0]
                    anchor_text = {
                        "first_frame_anchor": "the first frame of [Shot 1]",
                        "keyframe_anchor": f"a concrete keyframe within [Shot {target}]",
                        "edited_keyframe_anchor": f"an edited concrete keyframe within [Shot {target}]",
                        "last_frame_anchor": f"the final frame of [Shot {target}] and of the target video",
                        "composition_anchor": f"a concrete composition anchor for [Shot {target}]",
                    }[role]
                    text = f"{label} is {anchor_text}"
                    if content:
                        text += f", showing {_inline_prose(content)}"
                    standalone_picture_defs.append((label, role, text + ".", scope, relationship, instruction))
                elif role == "storyboard":
                    target_shots = _shot_scope(role, scope, active_shot_count)
                    shot_text = _shot_list_text(target_shots)
                    text = f"{label} is a storyboard reference for {shot_text}, defining viewpoint, subject placement, and shot order"
                    if content:
                        text += f", with the visible planning content: {_inline_prose(content)}"
                    standalone_picture_defs.append((label, role, text + ".", scope, relationship, instruction))

            elif name.startswith("ref_video_audio_") or name.startswith("ref_audio_"):
                label = f"<Audio {audio_labels[name]}>"
                source_clause = ""
                if name.startswith("ref_video_audio_"):
                    suffix = name.rsplit("_", 1)[-1]
                    video_name = f"ref_video_{suffix}"
                    if video_name in video_labels:
                        source_clause = f" synchronized with <Video {video_labels[video_name]}>"
                if role in {"person_a_voice", "person_b_voice", "person_c_voice"}:
                    person = _person_key_from_role(role)
                    target = f"Person {person}"
                    sid = speakers.get(person or "")
                    sid_text = f" ({sid})" if sid else ""
                    text = f"{label} references {target}{sid_text} voice timbre/delivery{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "narrator_voice":
                    sid = speakers.get("N")
                    sid_text = f" ({sid})" if sid else ""
                    text = f"{label} references the independent narrator{sid_text} voice timbre/delivery{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "full_audio_reuse":
                    text = f"{label} is reused as the complete target audio signal{source_clause}"
                elif role == "partial_audio_reuse":
                    text = f"{label} is partially reused in the target audio{source_clause}"
                elif role == "music_style":
                    text = f"{label} references music style/texture{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "sound_effects":
                    text = f"{label} references sound-effect texture{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "rhythm_timing":
                    text = f"{label} references beat/rhythm/timing{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "audio_continuity":
                    text = f"{label} references target audio continuity{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                elif role == "dialogue_content":
                    dialogue_target = entry.get("dialogue_target", "auto")
                    if dialogue_target == "auto":
                        text = f"{label} provides dialogue or lyric content for the target{source_clause}"
                    elif dialogue_target == "Narrator":
                        text = f"{label} provides exact dialogue or lyric content for the independent narrator{source_clause}"
                    else:
                        text = f"{label} provides exact dialogue or lyric content for Timeline speaker {dialogue_target}{source_clause}"
                    dialogue_content_defs.append((label, scope, content, instruction, dialogue_target))
                else:
                    text = f"{label} is a general audio reference{source_clause}"
                    if content:
                        text += f": {_inline_prose(content)}"
                audio_defs.append((label, role, text + ".", scope, relationship, content, instruction))

            elif name.startswith("ref_video_"):
                label = f"<Video {video_labels[name]}>"
                if person:
                    descriptor = (
                        "identity/appearance" if role.endswith("identity")
                        else "clothing" if role.endswith("clothing")
                        else "motion/performance"
                    )
                    if relationship == "attribute_transfer":
                        transfer_subjects.append((label, role, person, content, instruction, scope))
                    else:
                        source_text = f"{descriptor} from {label}"
                        if content:
                            source_text += f": {_inline_prose(content)}"
                            person_reference_details[person].append(content)
                        if instruction:
                            person_reference_instructions[person].append(instruction)
                        person_sources[person].append(source_text)
                        person_roles[person].append(role)
                        person_relationships[person].append(relationship)
                        person_reference_bindings[person].append({
                            "source": label, "role": role, "content": content, "instruction": instruction,
                            "scope": scope, "relationship": relationship,
                        })
                elif role in {"scene_environment", "animal_nonhuman_subject", "object_prop", "visual_effect", "interface_visible_text", "style_reference"}:
                    source_kind = {
                        "scene_environment": "environment",
                        "animal_nonhuman_subject": "animal/non-human subject",
                        "object_prop": "object/prop",
                        "visual_effect": "visual effect",
                        "interface_visible_text": "visible text/interface",
                        "style_reference": "moving visual style",
                    }[role]
                    definition = f"{source_kind} from {label}"
                    if content:
                        if role == "interface_visible_text":
                            definition += f", preserving the original-language visible content {_quoted_visible_text(content)}"
                        else:
                            definition += f": {_inline_prose(content)}"
                    nonperson_subjects.append((name, definition, role, content, instruction, scope, relationship, subject_group))
                elif role == "camera_motion":
                    text = f"{label} references camera movement"
                    if content:
                        text += f": {_inline_prose(content)}"
                    standalone_video_defs.append((label, role, text + ".", scope, relationship, instruction))
                elif role == "cuts_rhythm":
                    text = f"{label} references cut/pacing/rhythm"
                    if content:
                        text += f": {_inline_prose(content)}"
                    standalone_video_defs.append((label, role, text + ".", scope, relationship, instruction))
                elif role == "video_edit_source":
                    text = f"{label} is the source video to be directly edited"
                    if content:
                        text += f", whose relevant source state is {_inline_prose(content)}"
                    standalone_video_defs.append((label, role, text + ".", scope, relationship, instruction))
                elif role == "video_continuation_source":
                    text = f"{label} is the source video whose ending state and continuity start the target continuation"
                    if content:
                        text += f", with the ending state described as {_inline_prose(content)}"
                    standalone_video_defs.append((label, role, text + ".", scope, relationship, instruction))
                else:
                    text = f"{label} references whole-video motion/structure/timing"
                    if content:
                        text += f": {_inline_prose(content)}"
                    standalone_video_defs.append((label, role, text + ".", scope, relationship, instruction))

        subject_lines: List[str] = []
        summary_refs: List[str] = []
        person_subjects: Dict[str, int] = {}
        subject_roles: Dict[str, str] = {}
        subject_scopes: Dict[str, str] = {}
        subject_notes: Dict[str, str] = {}
        subject_instructions: Dict[str, str] = {}
        subject_relationships: Dict[str, str] = {}
        # Keep visible-text literals outside prose-normalized subject notes so
        # detailed_description can repeat each exact source string byte-for-byte.
        subject_visible_texts: Dict[str, List[str]] = {}
        # Only populated when one shared non-person Subject intentionally mixes
        # source-level relationship strengths. The aggregate marker stays useful
        # for the target Subject, while these contracts preserve which physical
        # source owns each stronger/weaker relationship.
        subject_mixed_source_contracts: Dict[str, List[Tuple[str, str, Tuple[int, ...]]]] = {}
        subject_transfer_targets: Dict[str, str] = {}
        next_subject = 1

        for person in ("A", "B", "C"):
            if not person_sources[person]:
                continue
            person_subjects[person] = next_subject
            label = f"<Subject {next_subject}>"
            source_text = _natural_join(person_sources[person])
            subject_lines.append(f"{label} is Person {person}: {source_text}.")
            summary_refs.append(f"{label} as Person {person}")
            subject_roles[label] = "person"
            subject_scopes[label] = "auto"
            relations = person_relationships[person]
            subject_relationships[label] = relations[0] if relations and all(v == relations[0] for v in relations) else "partially_preserved"
            detail_text = _natural_join_inline_prose(person_reference_details[person])
            if not detail_text:
                role_terms: List[str] = []
                for source_role in person_roles[person]:
                    term = (
                        "referenced identity and appearance" if source_role.endswith("identity")
                        else "referenced clothing characteristics" if source_role.endswith("clothing")
                        else "referenced pose and expression" if source_role.endswith("pose_expression")
                        else "referenced motion and performance"
                    )
                    if term not in role_terms:
                        role_terms.append(term)
                detail_text = _natural_join(role_terms) or "reference characteristics defined in subject_definitions"
            subject_notes[label] = detail_text
            subject_instructions[label] = _natural_join_inline_prose(person_reference_instructions[person])
            next_subject += 1

        nonperson_groups: Dict[Tuple[str, str], List[Tuple[str, str, str, str, str, str, str, str]]] = {}
        shared_group_roles: Dict[str, set] = {}
        seen_nonperson_contracts: set[Tuple[str, str, str, str, str, str, str]] = set()
        for entry in nonperson_subjects:
            source_name, _text, _role, _content, _instruction, _scope, _relationship, subject_group = entry
            if source_name in picture_labels:
                physical_source = f"Picture:{picture_labels[source_name]}"
            elif source_name in video_labels:
                physical_source = f"Video:{video_labels[source_name]}"
            else:
                physical_source = source_name
            exact_contract = (
                physical_source, _role, str(_content or ""), str(_instruction or ""),
                str(_scope or "auto"), str(_relationship or ""), str(subject_group or "auto"),
            )
            if exact_contract in seen_nonperson_contracts:
                plan_warnings.append(
                    f"{source_name}: an identical semantic Reference link to the same physical {physical_source} was omitted as a duplicate."
                )
                continue
            seen_nonperson_contracts.add(exact_contract)
            if subject_group != "auto":
                shared_group_roles.setdefault(subject_group, set()).add(_role)
            # A stale shared-group selector can accidentally combine different
            # semantic roles. Split only the conflicting roles into separate
            # Subjects while still grouping same-role views together.
            group_key = ("separate", source_name) if subject_group == "auto" else ("shared", f"{subject_group}|{_role}")
            nonperson_groups.setdefault(group_key, []).append(entry)
        for group_name, roles in shared_group_roles.items():
            if len(roles) > 1:
                plan_warnings.append(
                    f"Target subject group {group_name} mixed roles {', '.join(sorted(roles))}; the group was split by role instead of blocking execution."
                )

        for (_group_kind, group_name), entries in nonperson_groups.items():
            role = entries[0][2]
            label = f"<Subject {next_subject}>"
            if len(entries) == 1:
                subject_lines.append(f"{label} is {entries[0][1]}.")
            else:
                shared_kind = {
                    "scene_environment": "one shared scene or environment",
                    "animal_nonhuman_subject": "one shared animal or non-human subject",
                    "style_reference": "one shared visual style",
                    "object_prop": "one shared visible object or prop",
                    "visual_effect": "one shared visual effect",
                    "interface_visible_text": "one shared visible text/interface subject",
                    "general_reference": "one shared visible reference subject",
                    "custom": "one shared custom visible subject",
                }.get(role, "one shared visible subject")
                # When several views/clips define the same target but apply to
                # different Shot subsets, retain that provenance in the one shared
                # Subject definition.  Without it, a front view intended for early
                # Shots and a reverse view intended for a later Shot become an
                # undifferentiated pile of references.
                entry_shot_sets = [tuple(_shot_scope(role, entry[5], active_shot_count)) for entry in entries]
                scopes_differ = len(set(entry_shot_sets)) > 1
                source_descriptions = []
                for entry, entry_shots in zip(entries, entry_shot_sets):
                    description = entry[1]
                    if scopes_differ:
                        description += f" for {_shot_list_text(entry_shots)}"
                    source_descriptions.append(description)
                subject_lines.append(f"{label} is {shared_kind}: {_natural_join(source_descriptions)}.")

            summary_role = (
                "scene/environment" if role == "scene_environment"
                else "animal/non-human subject" if role == "animal_nonhuman_subject"
                else "visual style" if role == "style_reference"
                else "object/prop" if role == "object_prop"
                else "visual effect" if role == "visual_effect"
                else "visible text/interface" if role == "interface_visible_text"
                else "visual reference"
            )
            summary_refs.append(f"{label} for {summary_role}")
            subject_roles[label] = role
            shot_union = sorted({shot for entry in entries for shot in _shot_scope(role, entry[5], active_shot_count)})
            if shot_union == list(range(1, active_shot_count + 1)):
                combined_scope = "all_shots"
            elif len(shot_union) == 1:
                combined_scope = f"shot_{shot_union[0]}"
            else:
                combined_scope = "shots_" + "_".join(str(shot) for shot in shot_union)
            subject_scopes[label] = combined_scope
            contents = list(dict.fromkeys(entry[3] for entry in entries if entry[3]))
            instructions = list(dict.fromkeys(entry[4] for entry in entries if entry[4]))
            relationships = [entry[6] for entry in entries]
            if role == "interface_visible_text":
                subject_visible_texts[label] = [_visible_text_literal(value) for value in contents]
                subject_notes[label] = contents[0] if len(contents) == 1 else ""
            else:
                subject_notes[label] = _natural_join_inline_prose(contents)
            subject_instructions[label] = _natural_join_inline_prose(instructions)
            subject_relationships[label] = relationships[0] if relationships and all(value == relationships[0] for value in relationships) else "partially_preserved"
            if len(set(relationships)) > 1:
                contracts: List[Tuple[str, str, Tuple[int, ...]]] = []
                for entry in entries:
                    source_match = re.search(r"<(?:Picture|Video)\s+\d+>", entry[1])
                    if not source_match:
                        continue
                    contract = (source_match.group(0), entry[6], tuple(_shot_scope(role, entry[5], active_shot_count)))
                    if contract not in contracts:
                        contracts.append(contract)
                if contracts:
                    subject_mixed_source_contracts[label] = contracts
            next_subject += 1

        for source_label, role, person, content, instruction, scope in transfer_subjects:
            label = f"<Subject {next_subject}>"
            descriptor = (
                "identity and appearance characteristics" if role.endswith("identity")
                else "clothing characteristics" if role.endswith("clothing")
                else "pose and expression characteristics" if role.endswith("pose_expression")
                else "motion and performance characteristics"
            )
            definition = f"{label} is the {descriptor} from {source_label} intended for transfer to Person {person}"
            if content:
                definition += f": {_inline_prose(content)}"
            subject_lines.append(definition + ".")
            summary_refs.append(f"{label} for {descriptor} transfer to Person {person}")
            subject_roles[label] = "attribute_transfer"
            subject_scopes[label] = scope
            subject_notes[label] = content
            subject_instructions[label] = instruction
            subject_relationships[label] = "attribute_transfer"
            subject_transfer_targets[label] = person
            next_subject += 1

        picture_defs_by_label: Dict[str, List[Tuple[str, str, str, str, str, str]]] = {}
        for entry in standalone_picture_defs:
            picture_defs_by_label.setdefault(entry[0], []).append(entry)
        for label, entries in picture_defs_by_label.items():
            picture_role_texts: List[str] = []
            definition_fragments: List[str] = []
            for _label, role, text, _scope, _relationship, _instruction in entries:
                fragment = text[len(label):].strip().rstrip(".") if text.startswith(label) else text.rstrip(".")
                if fragment.startswith("is "):
                    fragment = fragment[3:]
                definition_fragments.append(_r2v_clean_reference_content(role, fragment))
                role_text = {
                    "first_frame_anchor": "the opening frame anchor",
                    "keyframe_anchor": "an intermediate concrete keyframe anchor",
                    "edited_keyframe_anchor": "an edited intermediate keyframe anchor",
                    "last_frame_anchor": "the final frame anchor",
                    "composition_anchor": "a concrete composition anchor",
                    "storyboard": "storyboard and shot planning",
                }.get(role, "shot planning")
                if role_text not in picture_role_texts:
                    picture_role_texts.append(role_text)
            if len(entries) == 1:
                subject_lines.append(_r2v_clean_reference_content(entries[0][1], entries[0][2]))
            else:
                subject_lines.append(f"{label} serves multiple concrete frame/planning roles: " + "; ".join(definition_fragments) + ".")
            summary_refs.append(f"{label} for {_natural_join(picture_role_texts)}")

        video_defs_by_label: Dict[str, List[Tuple[str, str, str, str, str, str]]] = {}
        for entry in standalone_video_defs:
            video_defs_by_label.setdefault(entry[0], []).append(entry)
        for label, entries in video_defs_by_label.items():
            video_role_texts: List[str] = []
            definition_fragments: List[str] = []
            for _label, role, text, _scope, _relationship, _instruction in entries:
                fragment = text[len(label):].strip().rstrip(".") if text.startswith(label) else text.rstrip(".")
                if fragment.startswith("is "):
                    fragment = fragment[3:]
                definition_fragments.append(_r2v_clean_reference_content(role, fragment))
                role_text = {
                    "camera_motion": "camera movement",
                    "cuts_rhythm": "cut, pacing, and temporal structure",
                    "video_edit_source": "the direct source for video editing",
                    "video_continuation_source": "the source state for video continuation",
                }.get(role, "whole-video temporal guidance")
                if role_text not in video_role_texts:
                    video_role_texts.append(role_text)
            if len(entries) == 1:
                subject_lines.append(_r2v_clean_reference_content(entries[0][1], entries[0][2]))
            else:
                subject_lines.append(f"{label} serves multiple video roles: " + "; ".join(definition_fragments) + ".")
            summary_refs.append(f"{label} for {_natural_join(video_role_texts)}")

        audio_defs_by_label: Dict[str, List[Tuple[str, str, str, str, str, str, str]]] = {}
        for entry in audio_defs:
            audio_defs_by_label.setdefault(entry[0], []).append(entry)

        for label, entries in audio_defs_by_label.items():
            definition_fragments: List[str] = []
            summary_role_texts: List[str] = []
            for _label, role, raw_text, _scope, _relationship, _content, _instruction in entries:
                text = _replace_people_with_subjects(raw_text, person_subjects)
                fragment = text[len(label):].strip().rstrip(".") if text.startswith(label) else text.rstrip(".")
                if fragment.startswith("is "):
                    fragment = fragment[3:]
                definition_fragments.append(_r2v_clean_reference_content(role, fragment))
                audio_role_text = {
                    "full_audio_reuse": "the complete reused audio signal",
                    "partial_audio_reuse": "the partially reused audio signal",
                    "music_style": "music style and texture",
                    "sound_effects": "sound-effect texture",
                    "rhythm_timing": "beat, rhythm, and timing",
                    "audio_continuity": "audio continuity",
                    "dialogue_content": "dialogue or lyric content",
                    "person_a_voice": "Person A's voice timbre and delivery",
                    "person_b_voice": "Person B's voice timbre and delivery",
                    "person_c_voice": "Person C's voice timbre and delivery",
                    "narrator_voice": "the independent narrator's voice timbre and delivery",
                }.get(role, "audio guidance")
                if audio_role_text not in summary_role_texts:
                    summary_role_texts.append(audio_role_text)
            if len(entries) == 1:
                subject_lines.append(_r2v_clean_reference_content(entries[0][1], _replace_people_with_subjects(entries[0][2], person_subjects)))
            else:
                # The official Ref2VA guide explicitly says that one Audio asset
                # serving several roles should be described as one item.  Keep one
                # stable <Audio N> definition rather than inventing duplicate files.
                subject_lines.append(f"{label} serves multiple audio roles: " + "; ".join(definition_fragments) + ".")
            summary_refs.append(f"{label} for {_natural_join(summary_role_texts)}")

        if not subject_lines:
            subject_lines.append(
                "No external Picture, Video, or Audio reference is connected; follow the target scene, timeline, and sound instructions directly."
            )
            summary_refs.append("the target scene/timeline instructions without external reference media")
            plan_warnings.append(
                "No external reference media is connected. The prompt was still generated as a reference-free H3 draft based only on the target scene/timeline inputs."
            )

        # Convert the stable base T2VA body to full-reference detailed_description.
        # The base compiler remains authoritative for timeline/camera/dialogue
        # grammar; R2V only binds reference labels at their actual application
        # points, as required by the official full-reference guide.
        detailed = _replace_people_with_subjects(integrated, person_subjects)
        detailed = _normalize_r2v_composite_subject_verbs(detailed)
        detailed = _repair_r2v_adjacent_subject_noun_phrase(detailed)
        detailed = _normalize_embedded_article_case(detailed)
        selected_style = str(kwargs.get("visual_style", "auto"))
        if selected_style != "auto" and selected_style in STYLE_TEXT:
            detailed = detailed.replace(f"[Shot 1] {STYLE_TEXT[selected_style]} ", "[Shot 1] ", 1)

        shot_prefixes: Dict[int, List[str]] = {}
        shot_suffixes: Dict[int, List[str]] = {}

        def add_prefix(shots: Iterable[int], sentence: str) -> None:
            for shot in shots:
                shot_prefixes.setdefault(int(shot), []).append(sentence)

        def add_suffix(shots: Iterable[int], sentence: str) -> None:
            for shot in shots:
                shot_suffixes.setdefault(int(shot), []).append(sentence)

        if scene_phase_paragraphs:
            for shot, paragraph in scene_phase_paragraphs.items():
                if int(shot) <= 1:
                    continue
                translated_phase, phase_warnings = _translate_korean_descriptive_text_if_needed(
                    paragraph, f"scene_prompt_shot_{shot}", translate_mode=requested_scene_translate
                )
                translated_phase = re.sub(r"\s+", " ", translated_phase).strip()
                _reject_r2v_reserved_user_text(translated_phase, f"translated scene_prompt_shot_{shot}")
                if translated_phase:
                    translated_phase = _replace_people_with_subjects(translated_phase, person_subjects)
                    translated_phase = _repair_r2v_adjacent_subject_noun_phrase(translated_phase)
                    translated_phase = _normalize_embedded_article_case(translated_phase)
                    add_prefix([int(shot)], _ensure_terminal_punctuation(translated_phase))
                plan_warnings.extend(phase_warnings)

        def add_first_then_continue(shots: Iterable[int], first_sentence: str, continuation: str = "") -> None:
            """Describe a repeated reference fully once, then reuse its label.

            The official full-reference writing pattern describes referenced
            characteristics at first clear appearance and subsequently reuses the
            stable label.  Repeating the same source prose and Apply Instruction
            in every Shot increases prompt length without adding target intent.
            """
            ordered = list(dict.fromkeys(int(shot) for shot in shots))
            if not ordered:
                return
            add_prefix([ordered[0]], first_sentence)
            if continuation:
                for shot in ordered[1:]:
                    add_prefix([shot], continuation)

        # Referenced people are already substituted directly into the base body.
        # State factual source characteristics at first appearance, then apply the
        # user-selected retention relationship and target-use instruction without
        # inventing details that this prompt-only node cannot see.
        for person, subject_index in person_subjects.items():
            label = f"<Subject {subject_index}>"
            appearances = _shot_numbers_for_label(detailed, label)
            target = appearances[0] if appearances else 1
            # First appearance may summarize only whole-video traits. If every
            # Person reference is Shot-scoped, do not imply that those traits are
            # already active in an earlier Shot; the scoped clauses below become
            # authoritative at their real application points.
            broad_bindings = [
                binding for binding in person_reference_bindings.get(person, [])
                if binding.get("scope", "auto") in {"auto", "all_shots"}
            ]
            if not broad_bindings:
                continue
            broad_details: List[str] = []
            broad_relationships: List[str] = []
            for binding in broad_bindings:
                relationship_value = str(binding.get("relationship", "partially_preserved"))
                if relationship_value not in broad_relationships:
                    broad_relationships.append(relationship_value)
                if binding.get("content"):
                    value = _r2v_clean_reference_content(binding.get("role", ""), str(binding["content"]).strip())
                    if value and value not in broad_details:
                        broad_details.append(value)
            referenced_traits = _natural_join_inline_prose(broad_details)
            instruction = subject_instructions.get(label, "").strip()
            relationship = broad_relationships[0] if len(broad_relationships) == 1 else "partially_preserved"
            relation_text = {
                "fully_preserved": "keeps its defined reference traits",
                "partially_preserved": "keeps its reference traits with requested changes allowed",
                "weak_reference": "uses its reference traits only as broad guidance",
            }.get(relationship, "uses its selected reference relationship")
            sentence = f"At first appearance, {label} {relation_text}"
            if referenced_traits:
                sentence += f": {_inline_prose(referenced_traits)}"
            sentence += "; target action, position, and camera follow this shot."
            add_prefix([target], sentence)

        # Apply person-specific reference roles at their actual shot scopes. This
        # matters when, for example, a costume reference is only intended for one
        # shot while the same referenced person remains visible elsewhere.
        for person, bindings in person_reference_bindings.items():
            subject_index = person_subjects.get(person)
            if subject_index is None:
                continue
            label = f"<Subject {subject_index}>"
            for binding in bindings:
                role = binding["role"]
                scope = binding["scope"]
                relationship = binding["relationship"]
                content = binding["content"]
                instruction = binding["instruction"]
                # For the ordinary all-video identity/clothing case, the first
                # appearance sentence plus persistent Subject label already carries
                # the relationship. Emit per-shot clauses when timing or special
                # behavior actually needs to be made explicit.
                if scope in {"auto", "all_shots"} and role.endswith(("_identity", "_clothing")):
                    # The first-appearance sentence plus the persistent Subject
                    # label and retention_analysis already carry whole-video
                    # identity/clothing. Repeating the same content/instruction in
                    # every Shot bloats prompts without adding timing information.
                    continue
                target_shots = _shot_scope(role, scope, active_shot_count)
                role_text = (
                    "identity and appearance" if role.endswith("_identity")
                    else "clothing" if role.endswith("_clothing")
                    else "pose and expression" if role.endswith("_pose_expression")
                    else "motion and performance"
                )
                relation_text = {
                    "fully_preserved": "fully preserved",
                    "partially_preserved": "partially preserved with requested target changes allowed",
                    "weak_reference": "weak reference only",
                }.get(relationship, relationship)
                clause = f"{label} {role_text}: {relation_text}"
                # Broad all-video roles already carry their concrete source details
                # and target-use instruction in subject_definitions/retention_analysis.
                # Repeating those strings in every Shot inflates max-reference
                # prompts without changing application timing. Explicit/narrow
                # scopes keep the concrete detail at the actual application point.
                broad_scope = scope in {"auto", "all_shots"}
                if content and not broad_scope:
                    clause += f", including {_r2v_clean_reference_content(role, content)}"
                if instruction and not broad_scope:
                    clause += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(
                    target_shots,
                    clause + ".",
                    f"{label} {role_text} reference continues.",
                )

        general_reference_people_override = _general_visible_reference_people_override_sentence(
            translated_plan, kwargs, extension_options, requested_person_count
        )

        style_subject_labels: List[Tuple[str, str]] = []
        for label, role in subject_roles.items():
            if role == "person":
                continue
            scope = subject_scopes.get(label, "auto")
            target_shots = _shot_scope(role, scope, active_shot_count)
            content = subject_notes.get(label, "")
            instruction = subject_instructions.get(label, "")
            relationship = subject_relationships.get(label, "weak_reference")
            broad_scope = scope in {"auto", "all_shots"}
            relation_verb = {
                "fully_preserved": "fully preserved",
                "partially_preserved": "partially preserved with requested target changes allowed",
                "weak_reference": "weak reference only",
                "attribute_transfer": "transferred to the designated target",
            }.get(relationship, "uses its selected reference relationship")

            if role == "attribute_transfer":
                person = subject_transfer_targets.get(label, "A")
                target_index = person_subjects.get(person)
                target_label = f"<Subject {target_index}>" if target_index is not None else f"Person {person}"
                detail = f"{target_label} receives the referenced characteristics from {label}; the source attributes are transferred to the designated target"
                if content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} transfer remains applied.")
            elif role == "scene_environment":
                scene_relation = {
                    "fully_preserved": "fully preserve defined scene traits",
                    "partially_preserved": "partially preserve scene traits while allowing requested target changes",
                    "weak_reference": "use scene traits only as broad guidance",
                }.get(relationship, "follow the selected scene relationship")
                detail = f"Environment {label}: {scene_relation}"
                if not broad_scope and content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if not broad_scope and instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} environment reference continues.")
            elif role == "style_reference":
                style_subject_labels.append((label, scope))
                if scope not in {"auto", "all_shots"}:
                    detail = f"The visual treatment in this shot references {label} and {relation_verb}"
                    if content:
                        detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                    if instruction:
                        detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                    add_first_then_continue(target_shots, detail + ".", f"{label} style reference continues.")
            elif role == "animal_nonhuman_subject":
                detail = f"{label} non-human subject: {relation_verb}"
                if not broad_scope and content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if not broad_scope and instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} remains the referenced non-human subject.")
            elif role == "object_prop":
                detail = f"{label} object/prop: {relation_verb}"
                if not broad_scope and content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if not broad_scope and instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} prop reference continues.")
            elif role == "visual_effect":
                detail = f"{label} visual effect: {relation_verb}"
                if not broad_scope and content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if not broad_scope and instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} visual-effect reference continues.")
            elif role == "interface_visible_text":
                detail = f"{label} visible text/interface: {relation_verb}"
                exact_texts = subject_visible_texts.get(label) or ([content] if content else [])
                if exact_texts:
                    quoted_texts = _natural_join([_quoted_visible_text(value) for value in exact_texts])
                    detail += f". Preserve the visibly presented source-language content exactly as {quoted_texts}"
                if instruction and not broad_scope:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} visible-text/interface reference continues.")
            else:
                detail = f"{label} visible reference: {relation_verb}"
                if not broad_scope and content:
                    detail += f", specifically {_inline_prose(_r2v_clean_reference_content(role, content))}"
                if general_reference_people_override:
                    detail += (
                        ". If this visible reference contains people, preserve only the requested mood, hairstyle, wardrobe, accessories, pose, motion, and scene cues where applicable; "
                        "do not preserve conflicting facial identity or ethnic facial characteristics from the reference person"
                    )
                if not broad_scope and instruction:
                    detail += f". Apply instruction: {instruction.rstrip('.!?')}"
                add_first_then_continue(target_shots, detail + ".", f"{label} visible reference continues.")

        for label, role, _text, scope, relationship, instruction in standalone_picture_defs:
            target_shots = _shot_scope(role, scope, active_shot_count)
            extra = f" Apply instruction: {instruction.rstrip('.!?')}." if instruction else ""
            if role == "first_frame_anchor":
                add_prefix([1], f"The shot begins from {label} as its concrete first frame and the defined frame is fully preserved.{extra}")
            elif role == "keyframe_anchor":
                add_prefix(target_shots, f"At the intended keyframe within this shot, the frame corresponds to {label} and is fully preserved.{extra}")
            elif role == "edited_keyframe_anchor":
                add_prefix(target_shots, f"At the intended keyframe within this shot, the frame is based on {label} but is deliberately modified according to the requested edit.{extra}")
            elif role == "last_frame_anchor":
                add_suffix([active_shot_count], f"The shot ends on {label} as the target video's concrete final frame and the defined frame is fully preserved.{extra}")
            elif role == "composition_anchor":
                add_prefix(target_shots, f"The shot composition is anchored to {label} at this point and the defined composition is fully preserved.{extra}")
            elif role == "storyboard":
                relation_clause = {
                    "fully_preserved": f"faithfully follows {label}",
                    "partially_preserved": f"closely follows {label} while allowing the requested target changes",
                    "weak_reference": f"broadly references {label}",
                }.get(relationship, f"references {label}")
                add_prefix(target_shots, f"Shot planning {relation_clause} for viewpoint, subject placement, and shot order without treating it as a literal frame.{extra}")

        for label, role, _text, scope, relationship, instruction in standalone_video_defs:
            target_shots = _shot_scope(role, scope, active_shot_count)
            extra = f" Apply instruction: {instruction.rstrip('.!?')}." if instruction else ""
            if role == "camera_motion":
                relation_phrase = {
                    "fully_preserved": "faithfully follows",
                    "partially_preserved": "closely follows",
                    "weak_reference": "broadly references",
                }.get(relationship, "references")
                add_first_then_continue(
                    target_shots,
                    f"Camera movement {relation_phrase} {label}.{extra}",
                    f"{label} camera reference continues.",
                )
            elif role == "cuts_rhythm":
                # Both subjects below are compound/plural ("pacing and rhythm",
                # "cut ... and its pacing"), so use plural verb forms.
                relation_phrase = {
                    "fully_preserved": "faithfully follow",
                    "partially_preserved": "closely follow",
                    "weak_reference": "broadly reference",
                }.get(relationship, "reference")
                if target_shots:
                    first_shot = target_shots[0]
                    first_text = (
                        f"Shot pacing and rhythm {relation_phrase} {label}.{extra}"
                        if first_shot == 1
                        else f"This cut and pacing {relation_phrase} {label}.{extra}"
                    )
                    add_first_then_continue(
                        target_shots,
                        first_text,
                        f"{label} cut/pacing reference continues.",
                    )
            elif role == "video_edit_source":
                preservation = "preserve its source continuity faithfully" if relationship == "fully_preserved" else "preserve its source continuity except for the explicitly requested edits"
                add_prefix([1], f"The target begins as an edited version of {label}; {preservation}.{extra}")
            elif role == "video_continuation_source":
                preservation = "faithfully preserves" if relationship == "fully_preserved" else "partially preserves"
                add_prefix([1], f"The opening state continues directly from the ending state of {label} and {preservation} that source state.{extra}")
            else:
                add_prefix(target_shots, f"{label} supplies only the whole-video temporal guidance defined in subject_definitions according to the selected relationship.{extra}")

        detailed = _inject_shot_prefixes(detailed, shot_prefixes)
        detailed = _inject_shot_suffixes(detailed, shot_suffixes)

        # Bind voice references to actual target vocal events. If a composite
        # A+B/A+B+C sentence cannot be rewritten inline for one individual S-ID,
        # collect a compact per-Shot voice map instead of adding one long fallback
        # sentence per person and per Shot.
        voice_fallbacks: Dict[int, List[str]] = {}
        for label, role, _raw_text, _scope, relationship, _content, instruction in audio_defs:
            if role not in {"person_a_voice", "person_b_voice", "person_c_voice", "narrator_voice"}:
                continue
            narrator_reference = role == "narrator_voice"
            person = "N" if narrator_reference else _person_key_from_role(role)
            if person is None:
                continue
            subject_index = person_subjects.get(person)
            sid = speakers.get(person)
            if not sid:
                target_name = "the independent narrator" if narrator_reference else f"Person {person}"
                plan_warnings.append(
                    f"{label} is assigned as {target_name}'s voice reference, but that speaker has no actual dialogue event in the target timeline. The prompt was still generated; this voice reference remains listed but could not be bound to a concrete speaking point."
                )
                continue
            target_label = "the independent narrator" if narrator_reference else (f"<Subject {subject_index}>" if subject_index is not None else f"Person {person}")
            detailed, replacements = _replace_speaker_voice_reference(
                detailed, target_label, sid, label, relationship=relationship, instruction=instruction
            )
            if replacements <= 0:
                vocal_shots = speaker_event_shots.get(person, [])
                if not vocal_shots:
                    plan_warnings.append(
                        f"{label} could not be bound to {target_label}'s actual speaking point. The prompt was still generated; check the Timeline dialogue settings if you need a concrete voice-binding sentence."
                    )
                    continue
                segment = (
                    f"{target_label} ({sid}) broadly follows {label}"
                    if relationship == "weak_reference"
                    else f"{target_label} ({sid}) uses {label}"
                )
                if instruction:
                    segment += f" ({instruction.rstrip('.!?')})"
                for shot in vocal_shots:
                    if segment not in voice_fallbacks.setdefault(shot, []):
                        voice_fallbacks[shot].append(segment)

        if voice_fallbacks:
            detailed = _inject_shot_prefixes(
                detailed,
                {shot: ["Voice references: " + "; ".join(items) + "."] for shot, items in voice_fallbacks.items()},
            )

        # Exact dialogue/lyric Audio can target either the legacy shot-wide
        # dialogue phase (`auto`) or one concrete Timeline speaker/group. Event-
        # level claims allow A and B to use different exact source clips inside
        # the same Shot without falsely treating those references as overlapping.
        target_dialogue_events = _flatten_r2v_vocal_events(timeline_events)
        claimed_dialogue_events: Dict[str, str] = {}
        claimed_direct_audio_shots: Dict[int, str] = {}
        reference_bound_dialogue_events: set[str] = set()
        dialogue_exact_prefixes: Dict[int, List[Tuple[float, str]]] = {}

        def dialogue_event_matches_target(event: Dict[str, Any], target: str) -> bool:
            return target == "auto" or str(event.get("speaker", "")) == target

        def dialogue_target_text(target: str) -> str:
            if target == "Narrator":
                return "the independent narrator"
            if target == "auto":
                return "the target vocal event"
            labels: List[str] = []
            for slot in target.split("+"):
                subject_index = person_subjects.get(slot)
                labels.append(f"<Subject {subject_index}>" if subject_index is not None else f"Person {slot}")
            return _natural_join(labels)

        for dialogue_label, dialogue_scope, dialogue_source_text, dialogue_instruction, dialogue_target in dialogue_content_defs:
            explicit_source_markup = _reference_dialogue_markup(dialogue_source_text)
            matching_target_events = [
                event for event in target_dialogue_events
                if dialogue_event_matches_target(event, dialogue_target)
            ]

            if matching_target_events:
                if dialogue_scope == "auto":
                    candidates = [
                        event for event in matching_target_events
                        if str(event.get("event_id")) not in claimed_dialogue_events
                        and (
                            not dialogue_source_text
                            or _verbal_source_contains(dialogue_source_text, event["text"])
                        )
                    ]
                    if not candidates:
                        target_clause = "" if dialogue_target == "auto" else f" for Timeline speaker {dialogue_target}"
                        plan_warnings.append(
                            f"{dialogue_label} has no unclaimed target dialogue event{target_clause} that matches its exact Source Content. The prompt was still generated; this exact-dialogue reference remains listed, but it was not bound to a concrete target vocal event."
                        )
                        continue
                    selected_events = [candidates[0]]
                else:
                    requested_shots = (
                        sorted({int(event["shot"]) for event in matching_target_events})
                        if dialogue_scope == "all_shots"
                        else _shot_scope("dialogue_content", dialogue_scope, active_shot_count)
                    )
                    selected_events = [
                        event for event in matching_target_events
                        if int(event["shot"]) in requested_shots
                    ]
                    if not selected_events:
                        target_clause = "" if dialogue_target == "auto" else f" by Timeline speaker {dialogue_target}"
                        plan_warnings.append(
                            f"{dialogue_label} is scoped to {_shot_list_text(requested_shots)}, but that range contains no target dialogue or lyric event{target_clause}. The prompt was still generated; this exact-dialogue reference remains listed without a direct shot binding."
                        )
                        continue

                overlaps = [
                    event for event in selected_events
                    if str(event.get("event_id")) in claimed_dialogue_events
                ]
                if overlaps:
                    previous = _natural_join(sorted({claimed_dialogue_events[str(event.get("event_id"))] for event in overlaps}))
                    turns = ", ".join(f"Turn {event['source_turn_index']} Vocal {event.get('slot_index', 1)}" for event in overlaps)
                    plan_warnings.append(
                        f"{dialogue_label} and {previous} both claim exact dialogue/lyric content for {turns}. The prompt was still generated; the later overlapping exact-dialogue binding was skipped."
                    )
                    continue

                if dialogue_source_text:
                    mismatches = [
                        event for event in selected_events
                        if not _verbal_source_contains(dialogue_source_text, event["text"])
                    ]
                    if mismatches:
                        turns = ", ".join(f"Turn {event['source_turn_index']} Vocal {event.get('slot_index', 1)}" for event in mismatches)
                        plan_warnings.append(
                            f"{dialogue_label} exact Source Content does not contain the target wording used by {turns}. The prompt was still generated; this exact-dialogue binding was skipped."
                        )
                        continue
                else:
                    plan_warnings.append(
                        f"{dialogue_label}: Dialogue/Lyric Content has no Source Content transcript; the compiler assumes the selected Timeline dialogue is the exact source wording."
                    )

                instruction_clause = (
                    f" Target-use instruction: {dialogue_instruction.rstrip('.!?')}." if dialogue_instruction else ""
                )
                by_shot: Dict[int, List[Dict[str, Any]]] = {}
                for event in selected_events:
                    by_shot.setdefault(int(event["shot"]), []).append(event)
                for shot, events in by_shot.items():
                    if dialogue_target == "auto":
                        subject_clause = "The spoken or sung wording used by the selected target vocal event in this shot"
                    else:
                        subject_clause = f"The spoken or sung wording used by {dialogue_target_text(dialogue_target)} in this shot"
                    clause = (
                        f"{subject_clause} is the explicitly requested verbal content from {dialogue_label}; "
                        f"preserve its source language and exact wording and do not invent missing words.{instruction_clause}"
                    )
                    first_time = min(float(event.get("elapsed_seconds", 0.0)) for event in events)
                    dialogue_exact_prefixes.setdefault(shot, []).append((first_time, clause))
                for event in selected_events:
                    event_id = str(event.get("event_id") or f"T{event['source_turn_index']}-V{event.get('slot_index', 1)}")
                    claimed_dialogue_events[event_id] = dialogue_label
                    reference_bound_dialogue_events.add(event_id)
            else:
                # A directly referenced verbal cue may exist without a Timeline
                # speaker. An explicit dialogue target, however, is meaningful only
                # when that target actually has a vocal event.
                if dialogue_target != "auto":
                    plan_warnings.append(
                        f"{dialogue_label} targets Timeline speaker {dialogue_target}, but that speaker has no dialogue or lyric event in the active Timeline. The prompt was still generated; this reference was treated only as a listed audio source."
                    )
                    continue
                if not explicit_source_markup:
                    plan_warnings.append(
                        f"{dialogue_label} is assigned as dialogue/lyric content, but there is no Timeline dialogue and no Source Content transcript to preserve. The prompt was still generated; add Timeline dialogue or Source Content when you need an exact verbal-content instruction."
                    )
                    continue
                target_dialogue_shots = _shot_scope("dialogue_content", dialogue_scope, active_shot_count)
                overlap = sorted(shot for shot in target_dialogue_shots if shot in claimed_direct_audio_shots)
                if overlap:
                    previous = _natural_join(sorted({claimed_direct_audio_shots[shot] for shot in overlap}))
                    plan_warnings.append(
                        f"{dialogue_label} and {previous} both claim exact standalone verbal content in {_shot_list_text(overlap)}. The prompt was still generated; the later overlapping standalone verbal cue was skipped."
                    )
                    continue
                instruction_clause = (
                    f" Target-use instruction: {dialogue_instruction.rstrip('.!?')}." if dialogue_instruction else ""
                )
                detailed = _inject_shot_prefixes(
                    detailed,
                    {
                        shot: [
                            f"At this point, {dialogue_label} supplies the referenced verbal content {explicit_source_markup} as an audible source; "
                            f"preserve the exact source wording and language without inventing a separate speaker.{instruction_clause}"
                        ]
                        for shot in target_dialogue_shots
                    },
                )
                for shot in target_dialogue_shots:
                    claimed_direct_audio_shots[shot] = dialogue_label

        if dialogue_exact_prefixes:
            detailed = _inject_shot_prefixes(
                detailed,
                {
                    shot: [text for _time, text in sorted(items, key=lambda item: item[0])]
                    for shot, items in dialogue_exact_prefixes.items()
                },
            )

        audio_reference_prefixes: Dict[int, List[str]] = {}

        def add_audio_first_then_continue(shots: Iterable[int], first_sentence: str, continuation: str = "") -> None:
            ordered = list(dict.fromkeys(int(shot) for shot in shots))
            if not ordered:
                return
            audio_reference_prefixes.setdefault(ordered[0], []).append(first_sentence)
            if continuation:
                for shot in ordered[1:]:
                    audio_reference_prefixes.setdefault(shot, []).append(continuation)

        for label, role, _text, scope, relationship, content, instruction in audio_defs:
            instruction_clause = f" Target-use instruction: {instruction.rstrip('.!?')}." if instruction else ""
            if role == "partial_audio_reuse":
                target_shots = _shot_scope(role, scope, active_shot_count)
                add_audio_first_then_continue(
                    target_shots,
                    f"Only the requested portion or layer of {label} is reused here; other target audio remains independently generated.{instruction_clause}",
                    f"The requested {label} portion/layer continues to be reused.",
                )
            elif role == "rhythm_timing":
                target_shots = _shot_scope(role, scope, active_shot_count)
                phrase = "broadly follows" if relationship == "weak_reference" else "follows"
                add_audio_first_then_continue(
                    target_shots,
                    f"Visible action timing {phrase} {label} beat/cadence without copying its signal.{instruction_clause}",
                    f"{label} beat/timing reference continues.",
                )
            elif role == "sound_effects":
                target_shots = _shot_scope(role, scope, active_shot_count)
                phrase = "broadly reference" if relationship == "weak_reference" else "reference"
                add_audio_first_then_continue(
                    target_shots,
                    f"Physical sound effects {phrase} {label} for sound texture without copying unrelated source audio.{instruction_clause}",
                    f"{label} sound-effect texture reference continues.",
                )
            elif role == "audio_continuity":
                target_shots = _shot_scope(role, scope, active_shot_count)
                phrase = "broadly follows" if relationship == "weak_reference" else "follows"
                add_audio_first_then_continue(
                    target_shots,
                    f"Audible continuity {phrase} {label} for texture, rhythm, and transitions without copying its full signal.{instruction_clause}",
                    f"{label} audio-continuity reference continues.",
                )
            elif role in {"general_reference", "custom"}:
                target_shots = _shot_scope(role, scope, active_shot_count)
                phrase = "only broadly references" if relationship == "weak_reference" else "references"
                add_audio_first_then_continue(
                    target_shots,
                    f"Audible treatment {phrase} {label} for its defined characteristics without wholesale signal copying.{instruction_clause}",
                    f"{label} audio reference continues.",
                )

        if audio_reference_prefixes:
            detailed = _inject_shot_prefixes(detailed, audio_reference_prefixes)

        global_style_subject_labels = [label for label, scope in style_subject_labels if scope in {"auto", "all_shots"}]
        style_ref = bool(global_style_subject_labels)
        opening = _style_opening(selected_style, style_ref)
        if global_style_subject_labels:
            # The official full-reference guide establishes visual treatment in
            # one or two English sentences before [Shot 1]. Consolidate any
            # number of style references into one second sentence rather than
            # producing an unbounded pre-shot paragraph.
            style_clauses: List[str] = []
            for label in global_style_subject_labels:
                relationship = subject_relationships.get(label, "weak_reference")
                instruction = subject_instructions.get(label, "")
                if relationship == "fully_preserved":
                    clause = f"faithfully preserves the style characteristics defined by {label}"
                elif relationship == "partially_preserved":
                    clause = f"retains the style characteristics of {label} while allowing the requested target changes"
                else:
                    clause = f"uses {label} only as broad style guidance"
                if instruction:
                    clause += f", following the target-use instruction {instruction.rstrip('.!?')}"
                style_clauses.append(clause)
            opening += " Reference style guidance " + "; ".join(style_clauses) + "."
        if opening:
            detailed = opening.strip() + "\n" + detailed.strip()

        if general_reference_people_override:
            detailed = general_reference_people_override.strip() + "\n" + detailed.strip()

        music_entries = [entry for entry in audio_defs if entry[1] == "music_style"]
        sound_entries = [entry for entry in audio_defs if entry[1] in {"sound_effects", "rhythm_timing", "audio_continuity"}]
        full_reuse_entries = [entry for entry in audio_defs if entry[1] == "full_audio_reuse"]
        partial_reuse_entries = [entry for entry in audio_defs if entry[1] == "partial_audio_reuse"]

        for label, _role, _text, _scope, relationship, _content, instruction in music_entries:
            relation_phrase = "broadly references" if relationship == "weak_reference" else "references"
            addition = f"The musical treatment {relation_phrase} {label} for music style, instrumentation, rhythm, and texture without copying the source signal verbatim."
            if instruction:
                addition += f" Target-use instruction: {instruction.rstrip('.!?')}."
            music = addition if music == "N/A" else music + " " + addition

        for label, role, _text, _scope, relationship, _content, instruction in sound_entries:
            relation_phrase = "broadly references" if relationship == "weak_reference" else "references"
            if role == "audio_continuity":
                addition = f"Audible continuity {relation_phrase} {label} for ongoing texture, rhythm, and transition behavior without copying the full source signal."
            elif role == "sound_effects":
                addition = f"Physical sound design {relation_phrase} {label} for the specified sound-effect texture without copying unrelated source audio."
            else:
                addition = f"Physical sound timing {relation_phrase} {label} for the specified rhythmic characteristics without copying the source signal."
            if instruction:
                addition += f" Target-use instruction: {instruction.rstrip('.!?')}."
            soundscape = addition if soundscape == "N/A" else soundscape + " " + addition

        if full_reuse_entries:
            reference_text = _natural_join([entry[0] for entry in full_reuse_entries])
            soundscape = (
                f"The complete target audio signal is fully copied from {reference_text}. "
                "Do not independently add, remove, replace, or regenerate ambience, dialogue, sound effects, or music outside that reused signal."
            )
            music = f"No independently generated non-diegetic music; any music remains exactly as contained in the fully reused {reference_text} signal."
        if partial_reuse_entries:
            reference_text = _natural_join([entry[0] for entry in partial_reuse_entries])
            additions = [entry[6] for entry in partial_reuse_entries if entry[6]]
            addition = f"Only the explicitly requested portions or layers of {reference_text} are reused; other target sounds remain independently generated."
            if additions:
                addition += f" Target-use instruction: {_natural_join_inline_prose(additions)}"
                if addition[-1] not in ".!?":
                    addition += "."
            soundscape = addition if soundscape == "N/A" else soundscape + " " + addition

        # Normalize only Reference/generated dialogue currently present; the
        # real Timeline <d> spans are still placeholders here. Restore each Turn
        # afterwards using either verbatim Timeline policy or the stricter
        # Full-Reference policy when that exact event was successfully bound to
        # a dialogue_content Audio reference.
        detailed = _normalize_r2v_dialogue_markup(detailed)
        detailed = _restore_timeline_dialogue_markup(
            detailed, timeline_dialogue_placeholders, reference_bound_dialogue_events
        )
        detailed = _compact_reference_continuations(detailed)

        # Build retention_analysis only after detailed_description is fully
        # reference-bound. This lets us report actual shot appearances instead
        # of generic fidelity statements detached from playback order.
        retention_lines: List[str] = []
        subject_person = {f"<Subject {index}>": person for person, index in person_subjects.items()}
        for label, role in subject_roles.items():
            scope = subject_scopes.get(label, "auto")
            scoped_shots = _shot_scope(role, scope, active_shot_count)
            actual_shots = _shot_numbers_for_label(detailed, label)
            marker = subject_relationships.get(label, "weak_reference")
            instruction = subject_instructions.get(label, "")

            if role == "person":
                person = subject_person[label]
                shots = actual_shots
                if not shots:
                    raise RuntimeError(f"Generated R2V prompt defined {label} but never used it in detailed_description.")
                role_contracts: List[str] = []
                person_bindings = person_reference_bindings.get(person, [])
                role_contract_signatures: Dict[str, set] = {}
                for binding in person_bindings:
                    role_name = binding.get("role", "")
                    role_shots = tuple(_shot_scope(role_name, binding.get("scope", "auto"), active_shot_count))
                    signature = (binding.get("relationship", "partially_preserved"), role_shots)
                    role_contract_signatures.setdefault(role_name, set()).add(signature)
                for binding in person_bindings:
                    role_name = binding.get("role", "")
                    role_text = (
                        "identity/appearance" if role_name.endswith("_identity")
                        else "clothing" if role_name.endswith("_clothing")
                        else "pose/expression" if role_name.endswith("_pose_expression")
                        else "motion/performance"
                    )
                    role_shots = tuple(_shot_scope(role_name, binding.get("scope", "auto"), active_shot_count))
                    if len(role_contract_signatures.get(role_name, set())) > 1 and binding.get("source"):
                        role_text += f"({binding['source']})"
                    role_relationship = binding.get("relationship", "partially_preserved")
                    item = f"{role_text}={role_relationship}@{_compact_shot_list_text(role_shots)}"
                    if item not in role_contracts:
                        role_contracts.append(item)
                line = f"{label}: {marker} - active {_compact_shot_list_text(shots)}"
                if role_contracts:
                    line += "; roles " + "; ".join(role_contracts)
                if instruction:
                    line += f"; instruction: {_inline_prose(instruction)}"
                retention_lines.append(line + ".")
                continue

            if role == "attribute_transfer":
                person = subject_transfer_targets.get(label, "A")
                target_index = person_subjects.get(person)
                target_label = f"<Subject {target_index}>" if target_index is not None else f"Person {person}"
                shots = actual_shots or scoped_shots
                line = f"{label}: attribute_transfer - target {target_label} @ {_compact_shot_list_text(shots)}"
                if instruction:
                    line += f"; instruction: {_inline_prose(instruction)}"
                retention_lines.append(line + ".")
                continue

            if role == "style_reference":
                qualifier = f"style {_compact_shot_list_text(scoped_shots)}"
            elif role == "scene_environment":
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            elif role == "animal_nonhuman_subject":
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            elif role == "object_prop":
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            elif role == "visual_effect":
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            elif role == "interface_visible_text":
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            else:
                qualifier = f"active {_compact_shot_list_text(actual_shots or scoped_shots)}"
            line = f"{label}: {marker} - {role}; {qualifier}"
            source_contracts = subject_mixed_source_contracts.get(label, [])
            if source_contracts:
                line += "; sources " + "; ".join(
                    f"{source_label}={source_relationship}@{_compact_shot_list_text(source_shots)}"
                    for source_label, source_relationship, source_shots in source_contracts
                )
            if instruction:
                line += f"; instruction: {_inline_prose(instruction)}"
            retention_lines.append(line + ".")

        # A single physical Picture/Video may be connected more than once to
        # assign several semantic roles.  Keep exactly one tracked retention
        # line per physical label, and spell out each role's own relationship
        # inside that line.  This mirrors the full-reference rule that one
        # source asset may serve several purposes without becoming duplicate
        # <Picture N>/<Video N> files.
        for label, entries in picture_defs_by_label.items():
            fragments: List[str] = []
            markers: List[str] = []
            for _label, role, _text, scope, relationship, instruction in entries:
                shots = _shot_scope(role, scope, active_shot_count)
                markers.append(relationship)
                role_text = {
                    "first_frame_anchor": "first-frame",
                    "keyframe_anchor": "keyframe",
                    "edited_keyframe_anchor": "edited-keyframe",
                    "last_frame_anchor": "last-frame",
                    "composition_anchor": "composition",
                    "storyboard": "storyboard",
                }.get(role, role)
                fragment = f"{role_text}={relationship}@{_compact_shot_list_text(shots)}"
                if instruction:
                    fragment += f" ({_inline_prose(instruction)})"
                fragments.append(fragment)
            primary_marker = markers[0] if len(set(markers)) == 1 else "partially_preserved"
            retention_lines.append(f"{label}: {primary_marker} - " + "; ".join(fragments) + ".")

        for label, entries in video_defs_by_label.items():
            fragments: List[str] = []
            markers: List[str] = []
            for _label, role, _text, scope, relationship, instruction in entries:
                shots = _shot_scope(role, scope, active_shot_count)
                markers.append(relationship)
                role_text = {
                    "camera_motion": "camera",
                    "cuts_rhythm": "cut/pacing",
                    "video_edit_source": "edit-source",
                    "video_continuation_source": "continuation-source",
                }.get(role, "temporal")
                fragment = f"{role_text}={relationship}@{_compact_shot_list_text(shots)}"
                if instruction:
                    fragment += f" ({_inline_prose(instruction)})"
                fragments.append(fragment)
            primary_marker = markers[0] if len(set(markers)) == 1 else "partially_preserved"
            retention_lines.append(f"{label}: {primary_marker} - " + "; ".join(fragments) + ".")

        audio_retention_by_label: Dict[str, List[Tuple[str, str, str, str, str, str, str]]] = {}
        for entry in audio_defs:
            audio_retention_by_label.setdefault(entry[0], []).append(entry)

        for label, entries in audio_retention_by_label.items():
            roles = [entry[1] for entry in entries]
            if "full_audio_reuse" in roles and len(set(roles)) > 1:
                plan_warnings.append(
                    f"{label} was assigned Full audio reuse together with another role; Full reuse was repaired to Partial audio reuse for this shared source."
                )
                entries = [
                    (entry[0], "partial_audio_reuse", entry[2], entry[3], "partially_copy", entry[5], entry[6])
                    if entry[1] == "full_audio_reuse" else entry
                    for entry in entries
                ]
            fragments: List[str] = []
            markers: List[str] = []
            for _label, role, _text, scope, relationship, _content, instruction in entries:
                markers.append(relationship)
                if role in {"person_a_voice", "person_b_voice", "person_c_voice", "narrator_voice"}:
                    if role == "narrator_voice":
                        target = "Narrator"
                    else:
                        person = _person_key_from_role(role)
                        target = f"<Subject {person_subjects[person]}>" if person in person_subjects else f"Person {person}"
                    shots = _shot_numbers_for_label(detailed, label)
                    fragment = f"voice({target})={relationship}" + (f"@{_compact_shot_list_text(shots)}" if shots else "")
                elif role == "dialogue_content":
                    shots = _shot_numbers_for_label(detailed, label)
                    fragment = f"exact-dialogue={relationship}" + (f"@{_compact_shot_list_text(shots)}" if shots else "")
                elif role == "full_audio_reuse":
                    fragment = f"full-reuse={relationship}"
                elif role == "partial_audio_reuse":
                    shots = _shot_scope(role, scope, active_shot_count)
                    fragment = f"partial-reuse={relationship}@{_compact_shot_list_text(shots)}"
                else:
                    shots = _shot_numbers_for_label(detailed, label)
                    role_text = {
                        "music_style": "music-style",
                        "sound_effects": "sound-effects",
                        "rhythm_timing": "rhythm/timing",
                        "audio_continuity": "continuity",
                        "general_reference": "general-audio",
                        "custom": "custom-audio",
                    }.get(role, role)
                    fragment = f"{role_text}={relationship}" + (f"@{_compact_shot_list_text(shots)}" if shots else "")
                if instruction:
                    fragment += f" ({_inline_prose(instruction)})"
                fragments.append(fragment)
            if "fully_copy" in markers:
                primary_marker = "fully_copy"
            elif "partially_copy" in markers:
                primary_marker = "partially_copy"
            elif "reference" in markers:
                primary_marker = "reference"
            else:
                primary_marker = "weak_reference"
            retention_lines.append(f"{label}: {primary_marker} - " + "; ".join(fragments) + ".")

        tasks = _task_types(asset_roles)
        task_prefix = "[" + " + ".join(tasks) + "]"
        if "video editing" in tasks:
            edit_video = next((label for label, role, _text, _scope, _relationship, _instruction in standalone_video_defs if role == "video_edit_source"), None)
            summary_body = f"The target video is an edited version of {edit_video}." if edit_video else "The target video directly edits the designated source video."
        elif "video continuation" in tasks:
            cont_video = next((label for label, role, _text, _scope, _relationship, _instruction in standalone_video_defs if role == "video_continuation_source"), None)
            summary_body = f"The target video continues from {cont_video}." if cont_video else "The target video continues from the designated source video."
        else:
            summary_body = "Generate the target video from the defined full-reference relationships."
        # The official Ref2VA guide asks summary to identify the target and its
        # main reference relationships, not merely repeat the task-type prefix.
        # Keep this concise by naming only the first few already-defined main
        # relationships; detailed contracts remain authoritative below.
        if summary_refs:
            # A short summary explicitly ties the target video to its principal
            # already-defined labels. Remaining contracts stay in retention_analysis.
            principal = _natural_join(summary_refs[:3])
            if "video editing" not in tasks and "video continuation" not in tasks:
                summary_body = "The video uses " + principal + "."
            else:
                summary_body += " It also uses " + principal + "."

        subject_gender_map: Dict[str, str] = {}
        for person, subject_index in person_subjects.items():
            inferred = ""
            for binding in person_reference_bindings.get(person, []):
                inferred = _r2v_infer_person_gender(str(binding.get("content", "")))
                if inferred:
                    break
            if inferred:
                subject_gender_map[f"<Subject {subject_index}>"] = inferred

        detailed = _r2v_normalize_subject_self_pronouns(detailed, subject_gender_map)

        prompt = "\n\n".join(
            [
                "subject_definitions:\n" + "\n".join(subject_lines),
                "summary:\n" + f"{task_prefix} {summary_body}",
                "retention_analysis:\n" + "\n".join(retention_lines),
                "detailed_description:\n" + detailed,
                "overall_soundscape:\n" + soundscape,
                "non_diegetic_music:\n" + music,
            ]
        )

        guide_metrics = _validate_full_reference_prompt(prompt)

        info_lines = [
            f"version={VERSION}",
            "node=UltraMiniMaxH3PromptR2V",
            "resolved_mode=ref2va",
            "generator=rule_based_full_reference",
            f"duration_seconds={duration}",
            f"pictures={unique_image_count}",
            f"videos={unique_video_count}",
            f"video_soundtracks={_unique_asset_count(groups['ref_video_audio'], kwargs)}",
            f"standalone_audios={unique_standalone_audio_count}",
            f"reference_only_base_scaffold={'yes' if reference_only_base_scaffold else 'no'}",
            f"people_free_base_scaffold={'yes' if people_free_base_scaffold else 'no'}",
            "task_types=" + ",".join(tasks),
            f"prompt_chars={len(prompt)}",
            f"detailed_description_words={guide_metrics['detailed_word_count']}",
            f"detailed_description_shots={guide_metrics['shot_count']}",
            "detailed_description_shot_words=" + ",".join(
                f"{shot}:{count}" for shot, count in guide_metrics["shot_word_counts"].items()
            ),
        ]
        for name in all_connected:
            role = translated_plan[name]["role"]
            if name.startswith("ref_image_"):
                tag = f"<Picture {picture_labels[name]}>"
            elif name.startswith("ref_video_audio_") or name.startswith("ref_audio_"):
                tag = f"<Audio {audio_labels[name]}>"
            else:
                tag = f"<Video {video_labels[name]}>"
            scope = translated_plan[name]["scope"]
            relationship = translated_plan[name]["relationship"]
            content_state = "yes" if translated_plan[name]["content"] else "no"
            instruction_state = "yes" if translated_plan[name]["instruction"] else "no"
            subject_group = translated_plan[name].get("subject_group", "auto")
            dialogue_target = translated_plan[name].get("dialogue_target", "auto")
            info_lines.append(
                f"reference={name} -> {tag} role={role} relationship={relationship} scope={scope} "
                f"subject_group={subject_group} dialogue_target={dialogue_target} content={content_state} instruction={instruction_state}"
            )
        combined_warnings = list(plan_warnings)
        if "reference generation" in tasks and guide_metrics["detailed_word_count"] < 350:
            combined_warnings.append(
                "The official MiniMax H3 full-reference guide normally uses about 350-500 English words for generation-task detailed_description. "
                "This rule-based prompt is shorter because the current scene/timeline inputs do not contain enough concrete visual information; add scene, appearance, action, camera, and sound detail rather than padding with invented facts."
            )
        elif "reference generation" in tasks and guide_metrics["detailed_word_count"] > 500:
            combined_warnings.append(
                "The generated detailed_description is longer than the official MiniMax H3 full-reference guide's normal 350-500 word range. "
                "Reduce repeated scene/reference prose or use narrower shot scopes if the target runtime has a strict prompt budget."
            )
        if len(prompt) > 7000:
            combined_warnings.append(
                f"The generated full-reference prompt is {len(prompt)} characters. Some MiniMax API paths document a 7000-character prompt limit; "
                "local ComfyUI runtimes may differ, so this node warns instead of blocking execution."
            )
        sparse_shots = [
            shot for shot, count in guide_metrics["shot_word_counts"].items()
            if count < 30
        ]
        if sparse_shots:
            combined_warnings.append(
                "The following shot(s) are unusually sparse for the official full-reference shot-writing guidance: "
                + ", ".join(f"Shot {shot}" for shot in sparse_shots)
                + ". Add concrete composition, visible subjects/positions, environment/lighting, action, camera, and synchronized sound where applicable."
            )
        if "warnings:" in base_info:
            base_warning_block = base_info.split("warnings:", 1)[1].strip()
            for line in base_warning_block.splitlines():
                cleaned = line.strip()
                if cleaned.startswith("- "):
                    cleaned = cleaned[2:].strip()
                if scaffold_scene_used and cleaned == _SCAFFOLD_NON_KOREAN_SCENE_NOTICE:
                    continue
                if cleaned:
                    combined_warnings.append(cleaned)
        if combined_warnings:
            info_lines.append("warnings:")
            info_lines.extend(f"- {warning}" for warning in combined_warnings)
        else:
            info_lines.append("warnings=none")
        return prompt, "\n".join(info_lines)
