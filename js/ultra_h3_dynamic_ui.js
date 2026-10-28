import { app } from "../../scripts/app.js";
import { installConnectedStringTooltips } from "./ultra_h3_connected_string_tooltip.js";
import { installCoreWidgetHoverTooltips } from "./ultra_h3_widget_tooltip.js";
import { installValidationBadge, triggerValidationBadge } from "./ultra_h3_validation_badge.js";
import { EXTENSION_WIDGET_MARKER, installExtensionOptions, refreshExtensionOptions, extensionWidgetNamesForPerson, sceneBaselineWidgetNames, turnSceneWidgetNames, hasSceneEnvironmentExtension, installExtensionTransport, snapshotExtensionOptions, restoreExtensionOptionsSnapshot, resetExtensionOptions } from "./ultra_h3_extension_options.js";
import { configureGroupedSections, refreshGroupedSections, groupedWidgetVisible, clearGroupedSectionState, setAllGroupedSectionsCollapsed, isGroupedSectionHeader } from "./ultra_h3_grouped_sections.js";
import { installSequentialVocalUi, refreshSequentialVocalLabels, sequentialVocalEnabled, sequentialVocalWidgetNames, sequentialNarratorWidgetNames, sequentialNarratorUsesCustom, SEQUENTIAL_VOCAL_WIDGET_MARKER, migrateFailedNativeSequentialWorkflow, migrateSequentialCoreTextSchema } from "./ultra_h3_sequential_vocal_ui.js";
import { installGraphWidgetHostGeometryGuard } from "./ultra_h3_widget_host_geometry_guard.js";
import { TRANSLATION_API_WIDGET_MARKER, installTranslationApiUi, refreshTranslationApiUi, translationApiWidget } from "./ultra_h3_translation_api.js";

const NODE_CLASS = "UltraMiniMaxH3Prompt";
const MAX_TURNS = 6;
const MAX_CAMERA_SHOTS = 6;
const GROUPED_SECTIONS_INSTALLED = new WeakSet();
const BASIC_COUNT_UI_MARKER = Symbol("ultraH3BasicCountUi");

const LEGACY_SINGLE_SHOT_FIELDS = [
  "scene_input_role",
  "shot_layout",
  "dialogue_text",
  "dialogue_language",
  "dialogue_delivery",
  "variation_seed",
];
const PROFILE_FIELDS = {
  1: [
    "person_a_gender", "person_a_age", "person_a_advanced",
    "person_a_voice_desc", "person_a_appearance_preset", "person_a_appearance_desc",
    "person_a_clothing_preset", "person_a_clothing_desc",
  ],
  2: [
    "person_b_gender", "person_b_age", "person_b_advanced",
    "person_b_voice_desc", "person_b_appearance_preset", "person_b_appearance_desc",
    "person_b_clothing_preset", "person_b_clothing_desc",
  ],
  3: [
    "person_c_gender", "person_c_age", "person_c_advanced",
    "person_c_voice_desc", "person_c_appearance_preset", "person_c_appearance_desc",
    "person_c_clothing_preset", "person_c_clothing_desc",
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


// ComfyUI keeps canonical workflow values (A, ko_to_en, on_screen, ...).
// These display-only tables mirror locales/en + locales/ko; workflow values stay canonical.
const OPTION_LABELS = {
  "en": {
    "scene_input_role": {
      "auto_safe": "Conservative speech auto-detect",
      "scene_action": "Visual action only (recommended)",
      "dialogue": "Entire Text as Dialogue"
    },
    "mode": {
      "auto": "Auto",
      "t2va": "Text → Video (T2VA)",
      "i2va": "Start Image → Video (I2VA)",
      "fl2va": "First + Last Image → Video (FL2VA)",
      "l2va": "Last Image → Video (L2VA)"
    },
    "shot_layout": {
      "auto_safe": "Auto · Safe",
      "single": "1 Shot",
      "two": "2 Shots",
      "three": "3 Shots",
      "four": "4 Shots"
    },
    "visual_style": {
      "auto": "Preserve source/reference; add no style",
      "cinematic": "Cinematic",
      "family_film": "Family Film",
      "warm_cinematic": "Warm Cinematic",
      "natural": "Natural Live-Action",
      "live_action": "Live-action",
      "live_action_cinematic": "Live-action + Cinematic",
      "2d_animated": "2D Animated",
      "japanese_anime": "Japanese Anime",
      "3d_cg": "3D CG",
      "claymation": "Claymation",
      "watercolor": "Watercolor",
      "vintage_film": "Vintage Film",
      "monochrome_cinematic": "Monochrome Cinematic",
      "film_noir": "Film Noir",
      "dark_fantasy": "Dark Fantasy",
      "cinematic_horror": "Cinematic Horror",
      "ominous_dark": "Ominous Dark",
      "post_apocalyptic": "Post-Apocalyptic",
      "gothic": "Gothic",
      "cyberpunk": "Cyberpunk",
      "dreamlike": "Dreamlike"
    },
    "camera_motion": {
      "auto": "No camera instruction",
      "static": "Static Shot",
      "zoom_in": "Zoom In",
      "zoom_out": "Zoom Out",
      "push_in": "Push In",
      "pull_out": "Pull Out",
      "pan_left": "Pan Left",
      "pan_right": "Pan Right",
      "truck_left": "Truck Left",
      "truck_right": "Truck Right",
      "tilt_up": "Tilt Up",
      "tilt_down": "Tilt Down",
      "pedestal_up": "Pedestal Up",
      "pedestal_down": "Pedestal Down",
      "arc_shot": "Arc Shot",
      "tracking_shot": "Tracking Shot",
      "handheld_tracking": "Handheld Tracking",
      "shake_slightly": "Shake Slightly",
      "shake_strongly": "Shake Strongly",
      "pov": "POV",
      "roll_clockwise": "Roll Clockwise",
      "roll_counterclockwise": "Roll Counterclockwise"
    },
    "camera_amplitude": {
      "default": "Default · Omit",
      "small": "Small",
      "large": "Large"
    },
    "camera_speed": {
      "default": "Default · Omit",
      "slow": "Slow",
      "fast": "Fast"
    },
    "reference_fidelity": {
      "strict": "Strict",
      "balanced": "Balanced",
      "creative": "Creative"
    },
    "soundscape_mode": {
      "auto": "Auto",
      "minimal": "Minimal Natural",
      "custom_only": "Custom sound hint only · empty = natural fallback",
      "silent": "No ambience / physical sound"
    },
    "music_mode": {
      "none": "None",
      "sparse_piano_strings": "Sparse Piano + Low Strings",
      "acoustic_guitar_bass": "Acoustic Guitar + Bass",
      "classical_guitar": "Classical Guitar",
      "soft_light_music": "Soft Light Instrumental",
      "gentle_classical": "Gentle Classical",
      "lyrical_harp_cello": "Lyrical Harp + Cello",
      "light_jazz": "Light Jazz",
      "bossa_nova": "Bossa Nova",
      "korean_traditional_fusion": "Korean Traditional Fusion",
      "vintage_pop": "Vintage Pop",
      "modern_pop": "Modern Pop",
      "kpop_style": "K-pop Style",
      "kpop_dance": "K-pop Dance",
      "fast_rap_beat": "Fast Rap Beat",
      "oldschool_hiphop": "Old-School Hip-Hop",
      "funk_groove": "Funk Groove",
      "rock_drive": "Rock Drive",
      "ambient_synth": "Ambient Synth",
      "dark_ambient": "Dark Ambient",
      "electronic_pulse": "Electronic Pulse",
      "upbeat_electronic": "Upbeat Electronic",
      "minimal_luxury_electronic": "Minimal Luxury Electronic",
      "tech_product_pulse": "Tech Product Electronic",
      "synthwave": "Synthwave",
      "dream_pop": "Dream Pop",
      "cinematic_percussion": "Cinematic Percussion",
      "orchestral_rise": "Orchestral Rise",
      "cheerful_march": "Cheerful March",
      "grand_march": "Grand March",
      "celestial_space": "Celestial · Space",
      "mystic_fantasy": "Mystical Fantasy",
      "custom": "Custom music hint · empty = no music"
    },
    "dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "dialogue_delivery": {
      "on_screen": "Visible Speaker Talks",
      "voiceover": "Off-screen Narration"
    },
    "scene_translate": {
      "off": "Off · preserve input",
      "ko_to_en": "Auto · Korean→English / keep English"
    },
    "person_a_gender": {
      "unspecified": "Unspecified",
      "female": "Female",
      "male": "Male",
      "nonbinary": "Non-binary"
    },
    "person_a_age": {
      "unspecified": "Unspecified",
      "child": "Child",
      "teen": "Teenager",
      "twenties": "20s",
      "thirties": "30s",
      "forties": "40s",
      "fifties": "50s",
      "sixties": "60s",
      "elderly": "Elderly"
    },
    "person_a_appearance_preset": {
      "none": "Unspecified",
      "average_build": "Average Build",
      "slim_build": "Slim Build",
      "petite_build": "Petite Build",
      "diminutive_build": "Slight Build",
      "athletic_build": "Athletic Build",
      "lean_muscular_build": "Lean Toned Build",
      "muscular_build": "Muscular Build",
      "solid_build": "Sturdy Build",
      "curvy_build": "Curvy Build",
      "hourglass_figure": "Hourglass Figure",
      "full_figure": "Full-Figured Build",
      "tall_slim_build": "Tall Slim Build",
      "tall_build": "Tall Build",
      "short_stature": "Short Stature",
      "long_legs": "Long Legs",
      "broad_shoulders": "Broad Shoulders",
      "full_bust": "Full Bust (Adults Only)",
      "small_bust": "Small Bust (Adults Only)",
      "soft_round_features": "Soft Rounded Features",
      "defined_jawline": "Defined Jawline",
      "freckles": "Light Freckles",
      "light_stubble": "Light Stubble",
      "full_beard": "Full Beard",
      "long_black_hair": "Long Black Hair",
      "long_brown_hair": "Long Brown Hair",
      "shoulder_length_hair": "Shoulder-Length Hair",
      "straight_hair": "Straight Hair",
      "wavy_hair": "Wavy Hair",
      "curly_hair": "Curly Hair",
      "short_hair": "Short Hair",
      "short_bob": "Short Bob",
      "pixie_cut": "Pixie Cut",
      "buzz_cut": "Buzz Cut",
      "ponytail": "Ponytail",
      "braided_hair": "Braided Hair"
    },
    "person_a_clothing_preset": {
      "none": "Unspecified",
      "tailored_suit": "Tailored Suit",
      "business_casual": "Business Casual",
      "shirt_and_slacks": "Shirt + Slacks",
      "blouse_and_pencil_skirt": "Blouse + Pencil Skirt",
      "coat_and_skirt": "Coat + Skirt",
      "tshirt_and_jeans": "T-Shirt + Jeans",
      "blouse_and_jeans": "Blouse + Jeans",
      "cardigan_and_skirt": "Cardigan + Skirt",
      "knit_sweater_and_skirt": "Knit Sweater + Skirt",
      "turtleneck_and_slacks": "Turtleneck + Slacks",
      "oversized_sweater": "Oversized Sweater",
      "casual_jeans": "Casual Jeans",
      "denim_jacket": "Denim Jacket",
      "leather_jacket": "Leather Jacket",
      "trench_coat": "Trench Coat",
      "hoodie_and_joggers": "Hoodie + Joggers",
      "streetwear": "Contemporary Streetwear",
      "dress": "Simple Dress",
      "sundress": "Sundress",
      "work_apron": "Work Apron",
      "chef_uniform": "Chef's Uniform",
      "work_overalls": "Work Overalls",
      "mechanic_coveralls": "Mechanic Coveralls",
      "medical_scrubs": "Medical Scrubs",
      "lab_coat": "Lab Coat",
      "raincoat": "Raincoat",
      "puffer_jacket": "Puffer Jacket",
      "pajamas": "Pajamas",
      "school_uniform": "School Uniform",
      "sportswear": "General Sportswear / Jogging Clothes",
      "yoga_outfit": "Yoga Outfit",
      "tennis_outfit": "Tennis Outfit",
      "cycling_outfit": "Cycling Outfit",
      "crop_top_and_leggings": "Crop Top + Leggings",
      "tank_top_and_shorts": "Tank Top + Shorts",
      "hanbok": "Hanbok",
      "kimono": "Kimono",
      "qipao": "Qipao",
      "ao_dai": "Ao Dai",
      "swimsuit": "Standard Swimsuit",
      "one_piece_swimsuit": "One-Piece Swimsuit",
      "bikini": "Bikini",
      "beach_cover_up": "Swimsuit + Beach Cover-Up",
      "cocktail_dress": "Cocktail Dress",
      "evening_gown": "Evening Gown",
      "mini_skirt_and_blouse": "Blouse + Mini Skirt (Adult)",
      "crop_top_and_jeans": "Crop Top + Jeans (Adult)",
      "camisole_and_shorts": "Camisole + Shorts (Adult)",
      "bodycon_dress": "Bodycon Dress (Adult)",
      "off_shoulder_dress": "Off-Shoulder Dress (Adult)",
      "halter_neck_dress": "Halter-Neck Dress (Adult)",
      "slip_dress": "Slip Dress (Adult)",
      "lingerie_set": "Lingerie Set (Adults Only)",
      "bra_and_panties": "Bra + Panties (Adults Only)",
      "sheer_lingerie": "Sheer Lingerie (Adults Only)",
      "open_robe_lingerie": "Open Robe + Lingerie (Adults Only)",
      "micro_bikini": "Micro Bikini (Adults Only)",
      "bodystocking": "Bodystocking (Adults Only)",
      "thong_only": "Thong Only (Adults Only)",
      "topless_with_bottoms": "Topless with Bottoms (Adults Only)",
      "loose_apron_only": "Loose Apron Only (Adults Only)",
      "nude": "Nude (Adults Only)"
    },
    "person_b_gender": {
      "unspecified": "Unspecified",
      "female": "Female",
      "male": "Male",
      "nonbinary": "Non-binary"
    },
    "person_b_age": {
      "unspecified": "Unspecified",
      "child": "Child",
      "teen": "Teenager",
      "twenties": "20s",
      "thirties": "30s",
      "forties": "40s",
      "fifties": "50s",
      "sixties": "60s",
      "elderly": "Elderly"
    },
    "person_b_appearance_preset": {
      "none": "Unspecified",
      "average_build": "Average Build",
      "slim_build": "Slim Build",
      "petite_build": "Petite Build",
      "diminutive_build": "Slight Build",
      "athletic_build": "Athletic Build",
      "lean_muscular_build": "Lean Toned Build",
      "muscular_build": "Muscular Build",
      "solid_build": "Sturdy Build",
      "curvy_build": "Curvy Build",
      "hourglass_figure": "Hourglass Figure",
      "full_figure": "Full-Figured Build",
      "tall_slim_build": "Tall Slim Build",
      "tall_build": "Tall Build",
      "short_stature": "Short Stature",
      "long_legs": "Long Legs",
      "broad_shoulders": "Broad Shoulders",
      "full_bust": "Full Bust (Adults Only)",
      "small_bust": "Small Bust (Adults Only)",
      "soft_round_features": "Soft Rounded Features",
      "defined_jawline": "Defined Jawline",
      "freckles": "Light Freckles",
      "light_stubble": "Light Stubble",
      "full_beard": "Full Beard",
      "long_black_hair": "Long Black Hair",
      "long_brown_hair": "Long Brown Hair",
      "shoulder_length_hair": "Shoulder-Length Hair",
      "straight_hair": "Straight Hair",
      "wavy_hair": "Wavy Hair",
      "curly_hair": "Curly Hair",
      "short_hair": "Short Hair",
      "short_bob": "Short Bob",
      "pixie_cut": "Pixie Cut",
      "buzz_cut": "Buzz Cut",
      "ponytail": "Ponytail",
      "braided_hair": "Braided Hair"
    },
    "person_b_clothing_preset": {
      "none": "Unspecified",
      "tailored_suit": "Tailored Suit",
      "business_casual": "Business Casual",
      "shirt_and_slacks": "Shirt + Slacks",
      "blouse_and_pencil_skirt": "Blouse + Pencil Skirt",
      "coat_and_skirt": "Coat + Skirt",
      "tshirt_and_jeans": "T-Shirt + Jeans",
      "blouse_and_jeans": "Blouse + Jeans",
      "cardigan_and_skirt": "Cardigan + Skirt",
      "knit_sweater_and_skirt": "Knit Sweater + Skirt",
      "turtleneck_and_slacks": "Turtleneck + Slacks",
      "oversized_sweater": "Oversized Sweater",
      "casual_jeans": "Casual Jeans",
      "denim_jacket": "Denim Jacket",
      "leather_jacket": "Leather Jacket",
      "trench_coat": "Trench Coat",
      "hoodie_and_joggers": "Hoodie + Joggers",
      "streetwear": "Contemporary Streetwear",
      "dress": "Simple Dress",
      "sundress": "Sundress",
      "work_apron": "Work Apron",
      "chef_uniform": "Chef's Uniform",
      "work_overalls": "Work Overalls",
      "mechanic_coveralls": "Mechanic Coveralls",
      "medical_scrubs": "Medical Scrubs",
      "lab_coat": "Lab Coat",
      "raincoat": "Raincoat",
      "puffer_jacket": "Puffer Jacket",
      "pajamas": "Pajamas",
      "school_uniform": "School Uniform",
      "sportswear": "General Sportswear / Jogging Clothes",
      "yoga_outfit": "Yoga Outfit",
      "tennis_outfit": "Tennis Outfit",
      "cycling_outfit": "Cycling Outfit",
      "crop_top_and_leggings": "Crop Top + Leggings",
      "tank_top_and_shorts": "Tank Top + Shorts",
      "hanbok": "Hanbok",
      "kimono": "Kimono",
      "qipao": "Qipao",
      "ao_dai": "Ao Dai",
      "swimsuit": "Standard Swimsuit",
      "one_piece_swimsuit": "One-Piece Swimsuit",
      "bikini": "Bikini",
      "beach_cover_up": "Swimsuit + Beach Cover-Up",
      "cocktail_dress": "Cocktail Dress",
      "evening_gown": "Evening Gown",
      "mini_skirt_and_blouse": "Blouse + Mini Skirt (Adult)",
      "crop_top_and_jeans": "Crop Top + Jeans (Adult)",
      "camisole_and_shorts": "Camisole + Shorts (Adult)",
      "bodycon_dress": "Bodycon Dress (Adult)",
      "off_shoulder_dress": "Off-Shoulder Dress (Adult)",
      "halter_neck_dress": "Halter-Neck Dress (Adult)",
      "slip_dress": "Slip Dress (Adult)",
      "lingerie_set": "Lingerie Set (Adults Only)",
      "bra_and_panties": "Bra + Panties (Adults Only)",
      "sheer_lingerie": "Sheer Lingerie (Adults Only)",
      "open_robe_lingerie": "Open Robe + Lingerie (Adults Only)",
      "micro_bikini": "Micro Bikini (Adults Only)",
      "bodystocking": "Bodystocking (Adults Only)",
      "thong_only": "Thong Only (Adults Only)",
      "topless_with_bottoms": "Topless with Bottoms (Adults Only)",
      "loose_apron_only": "Loose Apron Only (Adults Only)",
      "nude": "Nude (Adults Only)"
    },
    "person_c_gender": {
      "unspecified": "Unspecified",
      "female": "Female",
      "male": "Male",
      "nonbinary": "Non-binary"
    },
    "person_c_age": {
      "unspecified": "Unspecified",
      "child": "Child",
      "teen": "Teenager",
      "twenties": "20s",
      "thirties": "30s",
      "forties": "40s",
      "fifties": "50s",
      "sixties": "60s",
      "elderly": "Elderly"
    },
    "person_c_appearance_preset": {
      "none": "Unspecified",
      "average_build": "Average Build",
      "slim_build": "Slim Build",
      "petite_build": "Petite Build",
      "diminutive_build": "Slight Build",
      "athletic_build": "Athletic Build",
      "lean_muscular_build": "Lean Toned Build",
      "muscular_build": "Muscular Build",
      "solid_build": "Sturdy Build",
      "curvy_build": "Curvy Build",
      "hourglass_figure": "Hourglass Figure",
      "full_figure": "Full-Figured Build",
      "tall_slim_build": "Tall Slim Build",
      "tall_build": "Tall Build",
      "short_stature": "Short Stature",
      "long_legs": "Long Legs",
      "broad_shoulders": "Broad Shoulders",
      "full_bust": "Full Bust (Adults Only)",
      "small_bust": "Small Bust (Adults Only)",
      "soft_round_features": "Soft Rounded Features",
      "defined_jawline": "Defined Jawline",
      "freckles": "Light Freckles",
      "light_stubble": "Light Stubble",
      "full_beard": "Full Beard",
      "long_black_hair": "Long Black Hair",
      "long_brown_hair": "Long Brown Hair",
      "shoulder_length_hair": "Shoulder-Length Hair",
      "straight_hair": "Straight Hair",
      "wavy_hair": "Wavy Hair",
      "curly_hair": "Curly Hair",
      "short_hair": "Short Hair",
      "short_bob": "Short Bob",
      "pixie_cut": "Pixie Cut",
      "buzz_cut": "Buzz Cut",
      "ponytail": "Ponytail",
      "braided_hair": "Braided Hair"
    },
    "person_c_clothing_preset": {
      "none": "Unspecified",
      "tailored_suit": "Tailored Suit",
      "business_casual": "Business Casual",
      "shirt_and_slacks": "Shirt + Slacks",
      "blouse_and_pencil_skirt": "Blouse + Pencil Skirt",
      "coat_and_skirt": "Coat + Skirt",
      "tshirt_and_jeans": "T-Shirt + Jeans",
      "blouse_and_jeans": "Blouse + Jeans",
      "cardigan_and_skirt": "Cardigan + Skirt",
      "knit_sweater_and_skirt": "Knit Sweater + Skirt",
      "turtleneck_and_slacks": "Turtleneck + Slacks",
      "oversized_sweater": "Oversized Sweater",
      "casual_jeans": "Casual Jeans",
      "denim_jacket": "Denim Jacket",
      "leather_jacket": "Leather Jacket",
      "trench_coat": "Trench Coat",
      "hoodie_and_joggers": "Hoodie + Joggers",
      "streetwear": "Contemporary Streetwear",
      "dress": "Simple Dress",
      "sundress": "Sundress",
      "work_apron": "Work Apron",
      "chef_uniform": "Chef's Uniform",
      "work_overalls": "Work Overalls",
      "mechanic_coveralls": "Mechanic Coveralls",
      "medical_scrubs": "Medical Scrubs",
      "lab_coat": "Lab Coat",
      "raincoat": "Raincoat",
      "puffer_jacket": "Puffer Jacket",
      "pajamas": "Pajamas",
      "school_uniform": "School Uniform",
      "sportswear": "General Sportswear / Jogging Clothes",
      "yoga_outfit": "Yoga Outfit",
      "tennis_outfit": "Tennis Outfit",
      "cycling_outfit": "Cycling Outfit",
      "crop_top_and_leggings": "Crop Top + Leggings",
      "tank_top_and_shorts": "Tank Top + Shorts",
      "hanbok": "Hanbok",
      "kimono": "Kimono",
      "qipao": "Qipao",
      "ao_dai": "Ao Dai",
      "swimsuit": "Standard Swimsuit",
      "one_piece_swimsuit": "One-Piece Swimsuit",
      "bikini": "Bikini",
      "beach_cover_up": "Swimsuit + Beach Cover-Up",
      "cocktail_dress": "Cocktail Dress",
      "evening_gown": "Evening Gown",
      "mini_skirt_and_blouse": "Blouse + Mini Skirt (Adult)",
      "crop_top_and_jeans": "Crop Top + Jeans (Adult)",
      "camisole_and_shorts": "Camisole + Shorts (Adult)",
      "bodycon_dress": "Bodycon Dress (Adult)",
      "off_shoulder_dress": "Off-Shoulder Dress (Adult)",
      "halter_neck_dress": "Halter-Neck Dress (Adult)",
      "slip_dress": "Slip Dress (Adult)",
      "lingerie_set": "Lingerie Set (Adults Only)",
      "bra_and_panties": "Bra + Panties (Adults Only)",
      "sheer_lingerie": "Sheer Lingerie (Adults Only)",
      "open_robe_lingerie": "Open Robe + Lingerie (Adults Only)",
      "micro_bikini": "Micro Bikini (Adults Only)",
      "bodystocking": "Bodystocking (Adults Only)",
      "thong_only": "Thong Only (Adults Only)",
      "topless_with_bottoms": "Topless with Bottoms (Adults Only)",
      "loose_apron_only": "Loose Apron Only (Adults Only)",
      "nude": "Nude (Adults Only)"
    },
    "turn_1_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_1_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_1_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "turn_2_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_2_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_2_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "turn_3_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_3_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_3_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "turn_4_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_4_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_4_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "turn_5_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_5_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_5_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "turn_6_speaker": {
      "A": "Person 1",
      "B": "Person 2",
      "C": "Person 3",
      "A+B": "Person 1 + 2",
      "A+C": "Person 1 + 3",
      "B+C": "Person 2 + 3",
      "A+B+C": "Person 1 + 2 + 3"
    },
    "turn_6_dialogue_language": {
      "auto": "Auto · Korean/English priority",
      "English": "English",
      "Korean": "Korean",
      "Japanese": "Japanese",
      "Chinese": "Chinese",
      "Spanish": "Spanish",
      "French": "French",
      "German": "German",
      "Russian": "Russian",
      "Arabic": "Arabic",
      "Italian": "Italian",
      "Portuguese": "Portuguese"
    },
    "turn_6_dialogue_delivery": {
      "on_screen": "On-screen direct speech",
      "voiceover": "Off-screen voiceover"
    },
    "camera_framing": {
      "auto": "Auto · Scene-Appropriate",
      "face_closeup": "Face Close-Up",
      "head_and_shoulders": "Face + Shoulders",
      "upper_body": "Upper Body",
      "waist_up": "Waist Up",
      "knee_up": "Knee Up",
      "full_body": "Full Body",
      "wide_scene": "Wide Establishing View"
    }
  },
  "ko": {
    "scene_input_role": {
      "auto_safe": "대사 자동 감지 · 보수적",
      "scene_action": "장면 / 행동 전용 (권장)",
      "dialogue": "전체를 대사로 처리"
    },
    "mode": {
      "auto": "자동",
      "t2va": "텍스트 → 영상 (T2VA)",
      "i2va": "시작 이미지 → 영상 (I2VA)",
      "fl2va": "첫 + 마지막 이미지 → 영상 (FL2VA)",
      "l2va": "마지막 이미지 → 영상 (L2VA)"
    },
    "shot_layout": {
      "auto_safe": "자동 · 안전",
      "single": "1컷",
      "two": "2컷",
      "three": "3컷",
      "four": "4컷"
    },
    "visual_style": {
      "auto": "스타일 추가 없음 / 참조 이미지 스타일 유지",
      "cinematic": "영화풍",
      "family_film": "따뜻한 가족 영화풍",
      "warm_cinematic": "따뜻한 영화풍",
      "natural": "자연스러운 실사풍",
      "live_action": "실사",
      "live_action_cinematic": "실사 영화풍",
      "2d_animated": "2D 애니메이션",
      "japanese_anime": "일본 애니메이션풍",
      "3d_cg": "3D CG",
      "claymation": "점토 스톱모션",
      "watercolor": "수채화풍",
      "vintage_film": "빈티지 필름풍",
      "monochrome_cinematic": "흑백 영화풍",
      "film_noir": "흑백 누아르 영화풍",
      "dark_fantasy": "어두운 판타지풍",
      "cinematic_horror": "공포 영화풍",
      "ominous_dark": "불길하고 어두운 분위기",
      "post_apocalyptic": "문명 붕괴 이후 세계풍",
      "gothic": "어두운 고딕풍",
      "cyberpunk": "네온 미래 도시풍 (사이버펑크)",
      "dreamlike": "몽환적 영상풍"
    },
    "camera_motion": {
      "auto": "카메라 지시 없음",
      "static": "카메라 고정",
      "zoom_in": "화면 확대 (줌 인)",
      "zoom_out": "화면 축소 (줌 아웃)",
      "push_in": "카메라 앞으로 이동",
      "pull_out": "카메라 뒤로 이동",
      "pan_left": "카메라 시선 왼쪽 회전",
      "pan_right": "카메라 시선 오른쪽 회전",
      "truck_left": "카메라 왼쪽 평행 이동",
      "truck_right": "카메라 오른쪽 평행 이동",
      "tilt_up": "카메라 시선 위로 이동",
      "tilt_down": "카메라 시선 아래로 이동",
      "pedestal_up": "카메라 수직 상승",
      "pedestal_down": "카메라 수직 하강",
      "arc_shot": "피사체 주위 원호 이동",
      "tracking_shot": "피사체 따라가기",
      "handheld_tracking": "핸드헬드 추적 촬영",
      "shake_slightly": "약한 카메라 흔들림",
      "shake_strongly": "강한 카메라 흔들림",
      "pov": "1인칭 시점",
      "roll_clockwise": "화면 시계방향 회전",
      "roll_counterclockwise": "화면 반시계방향 회전"
    },
    "camera_amplitude": {
      "default": "기본 · 생략",
      "small": "작게",
      "large": "크게"
    },
    "camera_speed": {
      "default": "기본 · 생략",
      "slow": "느리게",
      "fast": "빠르게"
    },
    "reference_fidelity": {
      "strict": "강하게 유지",
      "balanced": "균형",
      "creative": "변화 허용"
    },
    "soundscape_mode": {
      "auto": "자동",
      "minimal": "최소한의 환경음",
      "custom_only": "직접 입력한 환경음만 사용 (비우면 자연음으로 보정)",
      "silent": "환경음·동작음 없음"
    },
    "music_mode": {
      "none": "사용 안 함",
      "sparse_piano_strings": "절제된 피아노 + 저음 현악",
      "acoustic_guitar_bass": "어쿠스틱 기타 + 베이스",
      "classical_guitar": "클래식 기타",
      "soft_light_music": "잔잔한 경음악",
      "gentle_classical": "잔잔한 클래식",
      "lyrical_harp_cello": "서정적 하프 + 첼로",
      "light_jazz": "라이트 재즈",
      "bossa_nova": "보사노바",
      "korean_traditional_fusion": "한국 전통 퓨전",
      "vintage_pop": "고전·빈티지 팝",
      "modern_pop": "모던 팝",
      "kpop_style": "K-pop 스타일",
      "kpop_dance": "K-pop 댄스",
      "fast_rap_beat": "빠른 랩 비트",
      "oldschool_hiphop": "올드스쿨 힙합",
      "funk_groove": "펑키 그루브",
      "rock_drive": "록 드라이브",
      "ambient_synth": "잔잔한 신시사이저",
      "dark_ambient": "다크 앰비언트",
      "electronic_pulse": "반복되는 전자 리듬",
      "upbeat_electronic": "경쾌한 일렉트로닉",
      "minimal_luxury_electronic": "고급 미니멀 광고",
      "tech_product_pulse": "테크 제품 광고",
      "synthwave": "신스웨이브",
      "dream_pop": "몽환적 드림 팝",
      "cinematic_percussion": "시네마틱 퍼커션",
      "orchestral_rise": "점차 고조되는 오케스트라",
      "cheerful_march": "경쾌한 행진곡",
      "grand_march": "장엄한 행진곡",
      "celestial_space": "천공·우주 음악",
      "mystic_fantasy": "신비로운 판타지",
      "custom": "직접 입력한 음악 사용 (비우면 음악 없음으로 보정)"
    },
    "dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "scene_translate": {
      "off": "사용 안 함 · 입력 그대로",
      "ko_to_en": "자동 · 한국어→영어 / 영어는 그대로"
    },
    "person_a_gender": {
      "unspecified": "지정 안 함",
      "female": "여성",
      "male": "남성",
      "nonbinary": "남성·여성 이외 (논바이너리)"
    },
    "person_a_age": {
      "unspecified": "지정 안 함",
      "child": "어린이",
      "teen": "청소년",
      "twenties": "20대",
      "thirties": "30대",
      "forties": "40대",
      "fifties": "50대",
      "sixties": "60대",
      "elderly": "노년층"
    },
    "person_a_appearance_preset": {
      "none": "지정 안 함",
      "average_build": "보통 체형",
      "slim_build": "슬림한 체형",
      "petite_build": "아담한 체형",
      "diminutive_build": "왜소한 체형",
      "athletic_build": "탄탄한 체형",
      "lean_muscular_build": "마르고 탄탄한 체형",
      "muscular_build": "근육질 체형",
      "solid_build": "다부진 체형",
      "curvy_build": "곡선이 도드라진 체형",
      "hourglass_figure": "허리가 잘록한 모래시계 체형",
      "full_figure": "풍만한 체형",
      "tall_slim_build": "키 크고 마른 체형",
      "tall_build": "키가 큰 체형",
      "short_stature": "작은 키",
      "long_legs": "긴 다리",
      "broad_shoulders": "넓은 어깨",
      "full_bust": "볼륨 있는 가슴 (성인 전용)",
      "small_bust": "작은 가슴 (성인 전용)",
      "soft_round_features": "부드럽고 둥근 얼굴선",
      "defined_jawline": "또렷한 턱선",
      "freckles": "옅은 주근깨",
      "light_stubble": "옅은 수염",
      "full_beard": "풍성한 턱수염",
      "long_black_hair": "긴 검은 머리",
      "long_brown_hair": "긴 갈색 머리",
      "shoulder_length_hair": "어깨까지 오는 머리",
      "straight_hair": "생머리",
      "wavy_hair": "웨이브 머리",
      "curly_hair": "곱슬머리",
      "short_hair": "짧은 머리",
      "short_bob": "짧은 단발",
      "pixie_cut": "아주 짧은 머리 (픽시컷)",
      "buzz_cut": "아주 짧게 민 머리 (버즈컷)",
      "ponytail": "뒤로 묶은 머리 (포니테일)",
      "braided_hair": "땋은 머리"
    },
    "person_a_clothing_preset": {
      "none": "지정 안 함",
      "tailored_suit": "맞춤 정장",
      "business_casual": "비즈니스 캐주얼 차림",
      "shirt_and_slacks": "셔츠와 슬랙스",
      "blouse_and_pencil_skirt": "블라우스와 펜슬 스커트",
      "coat_and_skirt": "코트와 스커트",
      "tshirt_and_jeans": "티셔츠와 청바지",
      "blouse_and_jeans": "블라우스와 청바지",
      "cardigan_and_skirt": "가디건과 스커트",
      "knit_sweater_and_skirt": "니트 스웨터와 스커트",
      "turtleneck_and_slacks": "터틀넥과 슬랙스",
      "oversized_sweater": "오버사이즈 스웨터",
      "casual_jeans": "캐주얼 청바지 차림",
      "denim_jacket": "데님 재킷",
      "leather_jacket": "가죽 재킷",
      "trench_coat": "트렌치코트",
      "hoodie_and_joggers": "후드티와 조거팬츠",
      "streetwear": "현대적인 스트리트 패션",
      "dress": "일반 드레스",
      "sundress": "여름 원피스 (선드레스)",
      "work_apron": "작업용 앞치마",
      "chef_uniform": "셰프복",
      "work_overalls": "멜빵 작업복",
      "mechanic_coveralls": "정비복",
      "medical_scrubs": "의료용 스크럽",
      "lab_coat": "실험복",
      "raincoat": "우비",
      "puffer_jacket": "패딩 점퍼",
      "pajamas": "잠옷",
      "school_uniform": "교복",
      "sportswear": "일반 운동복·조깅복",
      "yoga_outfit": "요가복",
      "tennis_outfit": "테니스복",
      "cycling_outfit": "자전거 라이딩복",
      "crop_top_and_leggings": "크롭탑과 레깅스",
      "tank_top_and_shorts": "탱크톱과 반바지",
      "hanbok": "한복",
      "kimono": "기모노",
      "qipao": "치파오",
      "ao_dai": "아오자이",
      "swimsuit": "일반 수영복",
      "one_piece_swimsuit": "원피스 수영복",
      "bikini": "비키니",
      "beach_cover_up": "수영복과 비치 겉옷 (커버업)",
      "cocktail_dress": "칵테일 드레스",
      "evening_gown": "이브닝 가운",
      "mini_skirt_and_blouse": "블라우스와 미니스커트 (성인 전용)",
      "crop_top_and_jeans": "크롭탑과 청바지 (성인 전용)",
      "camisole_and_shorts": "캐미솔과 반바지 (성인 전용)",
      "bodycon_dress": "몸에 붙는 드레스 (바디콘·성인 전용)",
      "off_shoulder_dress": "어깨가 드러나는 드레스 (오프숄더·성인 전용)",
      "halter_neck_dress": "목 뒤로 연결되는 드레스 (홀터넥·성인 전용)",
      "slip_dress": "슬립 드레스 (성인 전용)",
      "lingerie_set": "란제리 세트 (성인 전용)",
      "bra_and_panties": "브라와 팬티만 (성인 전용)",
      "sheer_lingerie": "시스루 란제리 (성인 전용)",
      "open_robe_lingerie": "오픈 가운과 란제리 (성인 전용)",
      "micro_bikini": "마이크로 비키니 (성인 전용)",
      "bodystocking": "보디스타킹 (성인 전용)",
      "thong_only": "티팬티만 (성인 전용)",
      "topless_with_bottoms": "하의만 착용한 상반신 노출 (성인 전용)",
      "loose_apron_only": "헐렁한 앞치마만 (성인 전용)",
      "nude": "누드 (성인 전용)"
    },
    "person_b_gender": {
      "unspecified": "지정 안 함",
      "female": "여성",
      "male": "남성",
      "nonbinary": "남성·여성 이외 (논바이너리)"
    },
    "person_b_age": {
      "unspecified": "지정 안 함",
      "child": "어린이",
      "teen": "청소년",
      "twenties": "20대",
      "thirties": "30대",
      "forties": "40대",
      "fifties": "50대",
      "sixties": "60대",
      "elderly": "노년층"
    },
    "person_b_appearance_preset": {
      "none": "지정 안 함",
      "average_build": "보통 체형",
      "slim_build": "슬림한 체형",
      "petite_build": "아담한 체형",
      "diminutive_build": "왜소한 체형",
      "athletic_build": "탄탄한 체형",
      "lean_muscular_build": "마르고 탄탄한 체형",
      "muscular_build": "근육질 체형",
      "solid_build": "다부진 체형",
      "curvy_build": "곡선이 도드라진 체형",
      "hourglass_figure": "허리가 잘록한 모래시계 체형",
      "full_figure": "풍만한 체형",
      "tall_slim_build": "키 크고 마른 체형",
      "tall_build": "키가 큰 체형",
      "short_stature": "작은 키",
      "long_legs": "긴 다리",
      "broad_shoulders": "넓은 어깨",
      "full_bust": "볼륨 있는 가슴 (성인 전용)",
      "small_bust": "작은 가슴 (성인 전용)",
      "soft_round_features": "부드럽고 둥근 얼굴선",
      "defined_jawline": "또렷한 턱선",
      "freckles": "옅은 주근깨",
      "light_stubble": "옅은 수염",
      "full_beard": "풍성한 턱수염",
      "long_black_hair": "긴 검은 머리",
      "long_brown_hair": "긴 갈색 머리",
      "shoulder_length_hair": "어깨까지 오는 머리",
      "straight_hair": "생머리",
      "wavy_hair": "웨이브 머리",
      "curly_hair": "곱슬머리",
      "short_hair": "짧은 머리",
      "short_bob": "짧은 단발",
      "pixie_cut": "아주 짧은 머리 (픽시컷)",
      "buzz_cut": "아주 짧게 민 머리 (버즈컷)",
      "ponytail": "뒤로 묶은 머리 (포니테일)",
      "braided_hair": "땋은 머리"
    },
    "person_b_clothing_preset": {
      "none": "지정 안 함",
      "tailored_suit": "맞춤 정장",
      "business_casual": "비즈니스 캐주얼 차림",
      "shirt_and_slacks": "셔츠와 슬랙스",
      "blouse_and_pencil_skirt": "블라우스와 펜슬 스커트",
      "coat_and_skirt": "코트와 스커트",
      "tshirt_and_jeans": "티셔츠와 청바지",
      "blouse_and_jeans": "블라우스와 청바지",
      "cardigan_and_skirt": "가디건과 스커트",
      "knit_sweater_and_skirt": "니트 스웨터와 스커트",
      "turtleneck_and_slacks": "터틀넥과 슬랙스",
      "oversized_sweater": "오버사이즈 스웨터",
      "casual_jeans": "캐주얼 청바지 차림",
      "denim_jacket": "데님 재킷",
      "leather_jacket": "가죽 재킷",
      "trench_coat": "트렌치코트",
      "hoodie_and_joggers": "후드티와 조거팬츠",
      "streetwear": "현대적인 스트리트 패션",
      "dress": "일반 드레스",
      "sundress": "여름 원피스 (선드레스)",
      "work_apron": "작업용 앞치마",
      "chef_uniform": "셰프복",
      "work_overalls": "멜빵 작업복",
      "mechanic_coveralls": "정비복",
      "medical_scrubs": "의료용 스크럽",
      "lab_coat": "실험복",
      "raincoat": "우비",
      "puffer_jacket": "패딩 점퍼",
      "pajamas": "잠옷",
      "school_uniform": "교복",
      "sportswear": "일반 운동복·조깅복",
      "yoga_outfit": "요가복",
      "tennis_outfit": "테니스복",
      "cycling_outfit": "자전거 라이딩복",
      "crop_top_and_leggings": "크롭탑과 레깅스",
      "tank_top_and_shorts": "탱크톱과 반바지",
      "hanbok": "한복",
      "kimono": "기모노",
      "qipao": "치파오",
      "ao_dai": "아오자이",
      "swimsuit": "일반 수영복",
      "one_piece_swimsuit": "원피스 수영복",
      "bikini": "비키니",
      "beach_cover_up": "수영복과 비치 겉옷 (커버업)",
      "cocktail_dress": "칵테일 드레스",
      "evening_gown": "이브닝 가운",
      "mini_skirt_and_blouse": "블라우스와 미니스커트 (성인 전용)",
      "crop_top_and_jeans": "크롭탑과 청바지 (성인 전용)",
      "camisole_and_shorts": "캐미솔과 반바지 (성인 전용)",
      "bodycon_dress": "몸에 붙는 드레스 (바디콘·성인 전용)",
      "off_shoulder_dress": "어깨가 드러나는 드레스 (오프숄더·성인 전용)",
      "halter_neck_dress": "목 뒤로 연결되는 드레스 (홀터넥·성인 전용)",
      "slip_dress": "슬립 드레스 (성인 전용)",
      "lingerie_set": "란제리 세트 (성인 전용)",
      "bra_and_panties": "브라와 팬티만 (성인 전용)",
      "sheer_lingerie": "시스루 란제리 (성인 전용)",
      "open_robe_lingerie": "오픈 가운과 란제리 (성인 전용)",
      "micro_bikini": "마이크로 비키니 (성인 전용)",
      "bodystocking": "보디스타킹 (성인 전용)",
      "thong_only": "티팬티만 (성인 전용)",
      "topless_with_bottoms": "하의만 착용한 상반신 노출 (성인 전용)",
      "loose_apron_only": "헐렁한 앞치마만 (성인 전용)",
      "nude": "누드 (성인 전용)"
    },
    "person_c_gender": {
      "unspecified": "지정 안 함",
      "female": "여성",
      "male": "남성",
      "nonbinary": "남성·여성 이외 (논바이너리)"
    },
    "person_c_age": {
      "unspecified": "지정 안 함",
      "child": "어린이",
      "teen": "청소년",
      "twenties": "20대",
      "thirties": "30대",
      "forties": "40대",
      "fifties": "50대",
      "sixties": "60대",
      "elderly": "노년층"
    },
    "person_c_appearance_preset": {
      "none": "지정 안 함",
      "average_build": "보통 체형",
      "slim_build": "슬림한 체형",
      "petite_build": "아담한 체형",
      "diminutive_build": "왜소한 체형",
      "athletic_build": "탄탄한 체형",
      "lean_muscular_build": "마르고 탄탄한 체형",
      "muscular_build": "근육질 체형",
      "solid_build": "다부진 체형",
      "curvy_build": "곡선이 도드라진 체형",
      "hourglass_figure": "허리가 잘록한 모래시계 체형",
      "full_figure": "풍만한 체형",
      "tall_slim_build": "키 크고 마른 체형",
      "tall_build": "키가 큰 체형",
      "short_stature": "작은 키",
      "long_legs": "긴 다리",
      "broad_shoulders": "넓은 어깨",
      "full_bust": "볼륨 있는 가슴 (성인 전용)",
      "small_bust": "작은 가슴 (성인 전용)",
      "soft_round_features": "부드럽고 둥근 얼굴선",
      "defined_jawline": "또렷한 턱선",
      "freckles": "옅은 주근깨",
      "light_stubble": "옅은 수염",
      "full_beard": "풍성한 턱수염",
      "long_black_hair": "긴 검은 머리",
      "long_brown_hair": "긴 갈색 머리",
      "shoulder_length_hair": "어깨까지 오는 머리",
      "straight_hair": "생머리",
      "wavy_hair": "웨이브 머리",
      "curly_hair": "곱슬머리",
      "short_hair": "짧은 머리",
      "short_bob": "짧은 단발",
      "pixie_cut": "아주 짧은 머리 (픽시컷)",
      "buzz_cut": "아주 짧게 민 머리 (버즈컷)",
      "ponytail": "뒤로 묶은 머리 (포니테일)",
      "braided_hair": "땋은 머리"
    },
    "person_c_clothing_preset": {
      "none": "지정 안 함",
      "tailored_suit": "맞춤 정장",
      "business_casual": "비즈니스 캐주얼 차림",
      "shirt_and_slacks": "셔츠와 슬랙스",
      "blouse_and_pencil_skirt": "블라우스와 펜슬 스커트",
      "coat_and_skirt": "코트와 스커트",
      "tshirt_and_jeans": "티셔츠와 청바지",
      "blouse_and_jeans": "블라우스와 청바지",
      "cardigan_and_skirt": "가디건과 스커트",
      "knit_sweater_and_skirt": "니트 스웨터와 스커트",
      "turtleneck_and_slacks": "터틀넥과 슬랙스",
      "oversized_sweater": "오버사이즈 스웨터",
      "casual_jeans": "캐주얼 청바지 차림",
      "denim_jacket": "데님 재킷",
      "leather_jacket": "가죽 재킷",
      "trench_coat": "트렌치코트",
      "hoodie_and_joggers": "후드티와 조거팬츠",
      "streetwear": "현대적인 스트리트 패션",
      "dress": "일반 드레스",
      "sundress": "여름 원피스 (선드레스)",
      "work_apron": "작업용 앞치마",
      "chef_uniform": "셰프복",
      "work_overalls": "멜빵 작업복",
      "mechanic_coveralls": "정비복",
      "medical_scrubs": "의료용 스크럽",
      "lab_coat": "실험복",
      "raincoat": "우비",
      "puffer_jacket": "패딩 점퍼",
      "pajamas": "잠옷",
      "school_uniform": "교복",
      "sportswear": "일반 운동복·조깅복",
      "yoga_outfit": "요가복",
      "tennis_outfit": "테니스복",
      "cycling_outfit": "자전거 라이딩복",
      "crop_top_and_leggings": "크롭탑과 레깅스",
      "tank_top_and_shorts": "탱크톱과 반바지",
      "hanbok": "한복",
      "kimono": "기모노",
      "qipao": "치파오",
      "ao_dai": "아오자이",
      "swimsuit": "일반 수영복",
      "one_piece_swimsuit": "원피스 수영복",
      "bikini": "비키니",
      "beach_cover_up": "수영복과 비치 겉옷 (커버업)",
      "cocktail_dress": "칵테일 드레스",
      "evening_gown": "이브닝 가운",
      "mini_skirt_and_blouse": "블라우스와 미니스커트 (성인 전용)",
      "crop_top_and_jeans": "크롭탑과 청바지 (성인 전용)",
      "camisole_and_shorts": "캐미솔과 반바지 (성인 전용)",
      "bodycon_dress": "몸에 붙는 드레스 (바디콘·성인 전용)",
      "off_shoulder_dress": "어깨가 드러나는 드레스 (오프숄더·성인 전용)",
      "halter_neck_dress": "목 뒤로 연결되는 드레스 (홀터넥·성인 전용)",
      "slip_dress": "슬립 드레스 (성인 전용)",
      "lingerie_set": "란제리 세트 (성인 전용)",
      "bra_and_panties": "브라와 팬티만 (성인 전용)",
      "sheer_lingerie": "시스루 란제리 (성인 전용)",
      "open_robe_lingerie": "오픈 가운과 란제리 (성인 전용)",
      "micro_bikini": "마이크로 비키니 (성인 전용)",
      "bodystocking": "보디스타킹 (성인 전용)",
      "thong_only": "티팬티만 (성인 전용)",
      "topless_with_bottoms": "하의만 착용한 상반신 노출 (성인 전용)",
      "loose_apron_only": "헐렁한 앞치마만 (성인 전용)",
      "nude": "누드 (성인 전용)"
    },
    "turn_1_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_1_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_1_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "turn_2_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_2_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_2_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "turn_3_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_3_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_3_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "turn_4_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_4_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_4_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "turn_5_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_5_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_5_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "turn_6_speaker": {
      "A": "인물 1",
      "B": "인물 2",
      "C": "인물 3",
      "A+B": "인물 1 + 2",
      "A+C": "인물 1 + 3",
      "B+C": "인물 2 + 3",
      "A+B+C": "인물 1 + 2 + 3"
    },
    "turn_6_dialogue_language": {
      "auto": "자동 · 한국어/영어 우선 판별",
      "English": "영어",
      "Korean": "한국어",
      "Japanese": "일본어",
      "Chinese": "중국어",
      "Spanish": "스페인어",
      "French": "프랑스어",
      "German": "독일어",
      "Russian": "러시아어",
      "Arabic": "아랍어",
      "Italian": "이탈리아어",
      "Portuguese": "포르투갈어"
    },
    "turn_6_dialogue_delivery": {
      "on_screen": "화면 속 인물이 직접 말함",
      "voiceover": "화면 밖 음성 (보이스오버)"
    },
    "camera_framing": {
      "auto": "자동 · 장면에 맞춤",
      "face_closeup": "얼굴 클로즈업",
      "head_and_shoulders": "얼굴·어깨 중심",
      "upper_body": "상반신",
      "waist_up": "허리 위",
      "knee_up": "무릎 위",
      "full_body": "전신",
      "wide_scene": "넓은 전경"
    }
  }
};

for (const locale of ["en", "ko"]) {
  const table = OPTION_LABELS[locale];
  if (!table) continue;
  const amplitudeLabels = {
    inherit: locale === "ko" ? "기본 설정을 따라감" : "Follow Base Settings",
    ...(table.camera_amplitude || {}),
  };
  const speedLabels = {
    inherit: locale === "ko" ? "기본 설정을 따라감" : "Follow Base Settings",
    ...(table.camera_speed || {}),
  };
  for (let shot = 2; shot <= MAX_CAMERA_SHOTS; shot++) {
    table[`camera_shot_${shot}_amplitude`] = amplitudeLabels;
    table[`camera_shot_${shot}_speed`] = speedLabels;
  }
}

const CAMERA_TARGET_LABELS = Object.freeze({
  en: {
    current_action: "Current Action Focus",
    A: "Person A",
    B: "Person B",
    C: "Person C",
    "A+B": "Person A + B",
    "A+C": "Person A + C",
    "B+C": "Person B + C",
    "A+B+C": "Person A + B + C",
    scene: "Full Scene",
  },
  ko: {
    current_action: "현재 진행에 맞춤",
    A: "인물 1",
    B: "인물 2",
    C: "인물 3",
    "A+B": "인물 1 + 2",
    "A+C": "인물 1 + 3",
    "B+C": "인물 2 + 3",
    "A+B+C": "인물 1 + 2 + 3",
    scene: "전체 장면",
  },
});

const CAMERA_TRANSITION_LABELS = Object.freeze({
  en: {
    cut: "Cut (Transition)",
    cross_dissolve: "Cross-Dissolve (Transition)",
    fade: "Fade (Transition)",
    wipe: "Wipe (Transition)",
  },
  ko: {
    cut: "일반 컷",
    cross_dissolve: "겹침 전환 (크로스 디졸브)",
    fade: "페이드 전환",
    wipe: "밀어내기 전환 (와이프)",
  },
});

for (const locale of ["en", "ko"]) {
  const table = OPTION_LABELS[locale];
  if (!table) continue;
  for (let shot = 1; shot <= MAX_CAMERA_SHOTS; shot++) {
    table[`camera_shot_${shot}_target`] = CAMERA_TARGET_LABELS[locale];
    table[`camera_shot_${shot}_framing`] = table.camera_framing;
    if (shot >= 2) {
      table[`camera_shot_${shot}_motion`] = table.camera_motion;
      table[`camera_shot_${shot}_transition`] = CAMERA_TRANSITION_LABELS[locale];
    }
  }
}


// -----------------------------------------------------------------------------
// Node helpers
// -----------------------------------------------------------------------------

const NODE_STATES = new WeakMap();
// Capture the real fresh-node outer geometry once at creation time. Confirmed reset
// restores this exact runtime baseline instead of guessing from computeSize() or
// hard-coded scene allowances, while preserving the user's current width.
const FRESH_RESET_GEOMETRY = new WeakMap();
// Workflow JSON already contains the user-authored node geometry. During
// configure, Vue/Core may temporarily expand the node before grouped visibility
// is restored. Keep the serialized Core size separate from scene_prompt DOM
// measurements and re-apply it once after loadedGraphNode finishes.
const SERIALIZED_WORKFLOW_GEOMETRY = new WeakMap();
let GRAPH_CONFIGURE_DEPTH = 0;
const LOCALIZED_WIDGETS = new WeakSet();
const DYNAMIC_CALLBACK_WIDGETS = new WeakSet();
const PREFERENCE_PROPERTY = "__ultra_h3_dynamic_preferences_v1";
const DYNAMIC_LINK_MEMORY_PROPERTY = "__ultra_h3_dynamic_link_memory_v1";
const VIEW_TOGGLE_MARKER = "__ultra_h3_view_toggle";
const RESET_BUTTON_MARKER = "__ultra_h3_reset_button";
const ACTION_ROW_MARKER = "__ultra_h3_action_row";
const RESET_CONFIRM_MS = 3500;
const REFERENCE_FIDELITY_UI_MARKER = "__ultra_h3_reference_fidelity_ui";
const REFERENCE_CLOTHING_UI_MARKER = "__ultra_h3_reference_clothing_ui";
const CONNECTION_WATCH_MARKER = "__ultra_h3_connection_watch";
const PERSISTENCE_GUARD_MARKER = "__ultra_h3_persistence_guard_v21";
const CORE_DEFAULTS_PROPERTY = "__ultraH3CoreWidgetDefaults";

function readPersistedPreferenceMap(node, key) {
  const raw = node?.properties?.[PREFERENCE_PROPERTY]?.[key];
  const result = new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [indexText, value] of Object.entries(raw)) {
    const index = Number(indexText);
    if (!Number.isInteger(index) || index < 1 || value == null) continue;
    result.set(index, String(value));
  }
  return result;
}

function readPersistedNamedPreferenceMap(node, key) {
  const raw = node?.properties?.[PREFERENCE_PROPERTY]?.[key];
  const result = new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [name, value] of Object.entries(raw)) {
    if (!name || value == null) continue;
    result.set(String(name), String(value));
  }
  return result;
}

function persistPreferredSelections(node, state) {
  if (!node || !state) return;
  node.properties ??= {};
  const turnSpeakers = Object.fromEntries(
    [...state.preferredTurnSpeakers.entries()].map(([index, value]) => [String(index), String(value)])
  );
  const cameraTargets = Object.fromEntries(
    [...state.preferredCameraTargets.entries()].map(([index, value]) => [String(index), String(value)])
  );
  const cameraFramings = Object.fromEntries(
    [...state.preferredCameraFramings.entries()].map(([index, value]) => [String(index), String(value)])
  );
  const profilePresets = Object.fromEntries(
    [...state.preferredProfilePresets.entries()].map(([name, value]) => [String(name), String(value)])
  );
  node.properties[PREFERENCE_PROPERTY] = {
    turnSpeakers,
    cameraTargets,
    cameraFramings,
    profilePresets,
    compactView: Boolean(state.compactView),
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
      preferredTurnSpeakers: readPersistedPreferenceMap(node, "turnSpeakers"),
      autoFallbackTurnSpeakers: new Set(),
      programmaticTurnSpeakerWrites: new Set(),
      preferredCameraTargets: readPersistedPreferenceMap(node, "cameraTargets"),
      autoFallbackCameraTargets: new Set(),
      programmaticCameraTargetWrites: new Set(),
      preferredCameraFramings: readPersistedPreferenceMap(node, "cameraFramings"),
      autoFallbackCameraFramings: new Set(),
      programmaticCameraFramingWrites: new Set(),
      preferredProfilePresets: readPersistedNamedPreferenceMap(node, "profilePresets"),
      programmaticProfilePresetWrites: new Set(),
      compactView: Boolean(node?.properties?.[PREFERENCE_PROPERTY]?.compactView),
      resetConfirmUntil: 0,
      resetConfirmTimer: null,
    };
    NODE_STATES.set(node, state);
  }
  return state;
}

function discardNodeState(node) {
  const state = NODE_STATES.get(node);
  if (state) {
    // Invalidate any bounded post-layout callbacks that captured this state
    // before a workflow reload/reset replaces it.
    state.resizeToken = (state.resizeToken ?? 0) + 1;
    if (state.resetConfirmTimer != null) {
      clearTimeout(state.resetConfirmTimer);
      state.resetConfirmTimer = null;
    }
  }
  NODE_STATES.delete(node);
}

function widgetsOf(node) {
  return Array.isArray(node?.widgets) ? node.widgets : [];
}

function isUiOnlyWidget(widget) {
  return Boolean(
    widget?.[VIEW_TOGGLE_MARKER]
    || widget?.[RESET_BUTTON_MARKER]
    || widget?.[ACTION_ROW_MARKER]
    || widget?.[REFERENCE_FIDELITY_UI_MARKER]
    || widget?.[REFERENCE_CLOTHING_UI_MARKER]
    || widget?.[BASIC_COUNT_UI_MARKER]
    || widget?.[EXTENSION_WIDGET_MARKER]
    || widget?.[TRANSLATION_API_WIDGET_MARKER]
    || isGroupedSectionHeader(widget)
  );
}

function serializedWidgetsOf(node) {
  return widgetsOf(node).filter((widget) => !isUiOnlyWidget(widget));
}

function detachUiOnlyWidgets(node) {
  const widgets = widgetsOf(node);
  const detached = [];
  for (let index = widgets.length - 1; index >= 0; index -= 1) {
    const widget = widgets[index];
    if (!isUiOnlyWidget(widget)) continue;
    detached.push({ index, widget });
    widgets.splice(index, 1);
  }
  detached.reverse();
  return detached;
}

function restoreUiOnlyWidgets(node, detached) {
  if (!Array.isArray(detached) || !detached.length) return;
  const widgets = widgetsOf(node);
  for (const { index, widget } of detached) {
    if (!widget || widgets.includes(widget)) continue;
    widgets.splice(Math.max(0, Math.min(index, widgets.length)), 0, widget);
  }
}

function collapseLegacyUiOnlySparseValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = serializedWidgetsOf(node);
  const styleIndex = widgets.findIndex((widget) => widget?.name === "visual_style");
  if (styleIndex < 0) return;

  // V2.0 added non-serialized mirror widgets directly after Visual Style.
  // LiteGraph's workflow serializer skipped those widgets but retained their
  // array indexes, so JSON workflows could contain null holes at this exact
  // boundary. If a workflow was loaded while affected and then saved again,
  // those holes could stack (2 -> 4 -> 6 ...), while values at the tail were
  // already unrecoverable. Collapse every consecutive hole at this one known
  // boundary before schema migration or core positional restoration. Any tail
  // fields that were already lost remain at their normal node defaults rather
  // than being guessed. Real server widgets in this node never serialize null
  // at this boundary.
  const holeIndex = styleIndex + 1;
  while (holeIndex < info.widgets_values.length) {
    const missing = !(holeIndex in info.widgets_values);
    const nullHole = info.widgets_values[holeIndex] == null;
    if (!missing && !nullHole) break;
    info.widgets_values.splice(holeIndex, 1);
  }
}

function collapseLegacyExtensionOptionSparseValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = serializedWidgetsOf(node);
  // The first Extension Options candidate inserted one non-serialized native
  // combo immediately before each appearance_preset. LiteGraph could persist a
  // null hole at that UI-only array position, shifting every following backend
  // value during configure. Remove only those impossible nulls at the three
  // known appearance-preset boundaries. Normal backend appearance presets are
  // canonical strings (for example "none"), never null.
  for (const slot of ["a", "b", "c"]) {
    const anchorIndex = widgets.findIndex((widget) => widget?.name === `person_${slot}_appearance_preset`);
    if (anchorIndex < 0 || anchorIndex >= info.widgets_values.length) continue;
    if (info.widgets_values[anchorIndex] == null) info.widgets_values.splice(anchorIndex, 1);
  }
}

function widgetByName(node, name) {
  return widgetsOf(node).find((widget) => widget.name === name);
}

// -----------------------------------------------------------------------------
// Input-content helpers
// -----------------------------------------------------------------------------
// Whitespace-only text is empty. Hard blocking uses ComfyUI native validation.
// No custom border/DOM styling is installed here.
function requiredInputIsBlank(widget) {
  return !String(widget?.value ?? "").trim();
}

function activeTimelineHasUserContent(node) {
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

const NATIVE_SCENE_VALIDATION_GATE = "ultra_scene_validation_gate";
const TRANSIENT_UI_LOCALE = "ultra_ui_locale";

const VALIDATION_BADGE_TEXT = Object.freeze({
  ko: Object.freeze({
    content: "⚠ 최상단 지시어·환경 설정·행동/대사 중 하나를 입력하세요",
    i2va_missing_start: "⚠ I2VA 모드에는 시작 이미지가 필요합니다. 시작 이미지를 연결해 주세요",
    l2va_missing_end: "⚠ L2VA 모드에는 마지막 이미지가 필요합니다. 마지막 이미지를 연결해 주세요",
    fl2va_missing_both: "⚠ FL2VA 모드에는 시작 이미지와 마지막 이미지가 모두 필요합니다. 두 이미지를 연결해 주세요",
    fl2va_missing_start: "⚠ FL2VA 모드에는 시작 이미지가 필요합니다. 시작 이미지를 연결해 주세요",
    fl2va_missing_end: "⚠ FL2VA 모드에는 마지막 이미지가 필요합니다. 마지막 이미지를 연결해 주세요",
  }),
  en: Object.freeze({
    content: "⚠ Enter a top instruction, environment setting, or action/dialogue",
    i2va_missing_start: "⚠ I2VA requires a start image. Connect the start image",
    l2va_missing_end: "⚠ L2VA requires an end image. Connect the end image",
    fl2va_missing_both: "⚠ FL2VA requires both a start image and an end image. Connect both images",
    fl2va_missing_start: "⚠ FL2VA requires a start image. Connect the start image",
    fl2va_missing_end: "⚠ FL2VA requires an end image. Connect the end image",
  }),
});

function nativeSceneValidationIssue(node) {
  const mode = canonicalValue("mode", widgetByName(node, "mode")?.value) || "auto";
  const startConnected = referenceInputConnected(node, "start_image");
  const endConnected = referenceInputConnected(node, "end_image");

  // Explicit image-mode reference requirements are the first actionable issue.
  // Do not stack the generic content message underneath a missing-image message;
  // after the user fixes the reference connection, the next Queue attempt can
  // surface any remaining independent issue in normal priority order.
  if (mode === "i2va" && !startConnected) return "i2va_missing_start";
  if (mode === "l2va" && !endConnected) return "l2va_missing_end";
  if (mode === "fl2va") {
    if (!startConnected && !endConnected) return "fl2va_missing_both";
    if (!startConnected) return "fl2va_missing_start";
    if (!endConnected) return "fl2va_missing_end";
  }

  const scene = widgetByName(node, "scene_prompt");
  if (!requiredInputIsBlank(scene) || widgetInputConnected(node, "scene_prompt")) return null;
  if (activeTimelineHasUserContent(node)) return null;
  if (hasSceneEnvironmentExtension(node)) return null;

  // Image-based tasks can intentionally rely on their required reference image
  // without an extra scene/action. Manual T2VA ignores connected images, while
  // Auto uses any connected reference to resolve to an image-based mode.
  if (mode === "t2va") return "content";
  if (mode === "auto") return (startConnected || endConnected) ? null : "content";
  return null;
}

function nativeSceneValidationBadgeText(node) {
  const locale = activeLocale(node);
  const issue = nativeSceneValidationIssue(node);
  const table = VALIDATION_BADGE_TEXT[locale] ?? VALIDATION_BADGE_TEXT.en;
  return issue ? (table?.[issue] ?? VALIDATION_BADGE_TEXT.en?.[issue] ?? "") : "";
}

function nativeSceneValidationGateValue(node) {
  // "missing" remains a display-only signal. Python VALIDATE_INPUTS accepts it,
  // so Queue is not rejected; serialization triggers one prioritized badge and
  // the node boundary quietly blocks only h3_prompt when required.
  return nativeSceneValidationIssue(node) ? "missing" : "ok";
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
    const verdict = nativeSceneValidationGateValue(node);
    if (verdict === "missing") triggerValidationBadge(node);
    return verdict;
  };
}

function installTransientUiLocale(node) {
  const widget = widgetByName(node, TRANSIENT_UI_LOCALE);
  if (!widget) return;
  widget.hidden = true;
  widget.options = { ...(widget.options || {}), hidden: true };
  // Runtime-only locale for human-facing backend warnings. Do not persist it
  // in workflows; use the live ComfyUI locale only when graphToPrompt queues.
  widget.serialize = false;
  widget.serializeValue = () => activeLocale(node) === "ko" ? "ko" : "en";
}

function setWidgetVisible(widget, visible) {
  if (!widget) return false;

  const effectiveVisible = groupedWidgetVisible(widget?.__ultraGroupedNode || null, widget, visible);
  const hidden = !effectiveVisible;
  const previousOptions = widget.options && typeof widget.options === "object"
    ? widget.options
    : {};
  const changed = widget.hidden !== hidden || previousOptions.hidden !== hidden;

  // LiteGraph/Vue can retain a hidden widget's last runtime Y coordinate and
  // reuse it as a connection candidate position. Clear only that transient
  // coordinate when hiding; values, widget identity and connection metadata stay intact.
  if (widget.hidden !== hidden) widget.hidden = hidden;
  if (hidden && typeof widget.y === "number" && widget.y !== 0 && !widget?.[SEQUENTIAL_VOCAL_WIDGET_MARKER]) widget.y = 0;
  if (changed) widget.options = { ...previousOptions, hidden };
  return changed;
}

function refreshVueWidgetMetadata(node) {
  // Widgets have already been converted individually by ComfyUI during normal
  // node creation. Reassigning the array here makes frontend 1.53 reconvert and
  // re-register the entire 100+ widget schema on every disclosure click.
  // Visibility is read directly from the live concrete widget objects.
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

// -----------------------------------------------------------------------------
// Locale-aware combo labels
// -----------------------------------------------------------------------------

const SCENE_PROMPT_HELP = Object.freeze({
  ko: {
    tooltip: "영상 전체에 공통인 장소·분위기·조명·초기 인물 배치를 적습니다. 시간에 따라 바뀌는 행동과 대사는 아래 시간순 진행에 적으세요. 예: 넓은 초원, 늦은 오후의 따뜻한 햇빛, 한 여성과 한 남성이 서로 마주 서 있다.",
    placeholder: "영상의 장면과 원하는 연출을 입력하세요",
  },
  en: {
    tooltip: "Describe the location, mood, lighting, and initial character arrangement shared by the whole video. Put changing actions and dialogue in Ordered Steps. Example: A wide meadow in warm late-afternoon light; a woman and a man stand facing each other.",
    placeholder: "Describe the video scene and desired direction",
  },
});

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
      const locale = normalizeLocale(get());
      if (locale) { if (node) LAST_CONFIRMED_LOCALE.set(node, locale); return locale; }
    } catch (_) {}
  }

  // Only use labels already localized by ComfyUI as a fallback. Browser/OS
  // language is intentionally ignored because it can disagree with ComfyUI.
  for (const widget of widgetsOf(node)) {
    if (/[가-힣]/.test(String(widget?.label ?? ""))) { if (node) LAST_CONFIRMED_LOCALE.set(node, "ko"); return "ko"; }
  }
  return (node && LAST_CONFIRMED_LOCALE.get(node)) || "en";
}

function scenePromptHelp(node) {
  return SCENE_PROMPT_HELP[activeLocale(node)] ?? SCENE_PROMPT_HELP.en;
}

function localizeScenePromptNodeData(nodeData) {
  if (!nodeData || nodeData.name !== NODE_CLASS) return;
  const spec = nodeData?.input?.required?.scene_prompt;
  if (!Array.isArray(spec) || !spec[1] || typeof spec[1] !== "object") return;
  const help = SCENE_PROMPT_HELP[activeLocale(null)] ?? SCENE_PROMPT_HELP.en;
  // The Ultra overlay owns scene_prompt help. Leaving schema tooltip text here
  // lets recent ComfyUI frontends render a second native tooltip.
  spec[1].tooltip = "";
  spec[1].placeholder = help.placeholder;
}

function normalizeProfileSafetyPolicy(raw) {
  if (!raw || typeof raw !== "object") return null;
  const list = (key) => Array.isArray(raw[key]) ? raw[key].map((value) => String(value)) : [];
  const adultAges = list("adult_ages");
  const adultOnlyAppearance = list("adult_only_appearance");
  const adultOnlyClothing = list("adult_only_clothing");
  if (!adultAges.length) return null;
  return Object.freeze({
    adultAges: Object.freeze(adultAges),
    adultOnlyAppearance: Object.freeze(adultOnlyAppearance),
    adultOnlyClothing: Object.freeze(adultOnlyClothing),
  });
}

function installProfileSafetyNodeData(nodeType, nodeData) {
  if (!nodeType?.prototype || !nodeData || nodeData.name !== NODE_CLASS) return;
  const raw = nodeData?.input?.required?.person_a_age?.[1]?.profile_safety;
  const policy = normalizeProfileSafetyPolicy(raw);
  if (policy) nodeType.prototype.__ultraH3ProfileSafetyPolicy = policy;
}

function profileSafetyPolicy(node) {
  return node?.__ultraH3ProfileSafetyPolicy ?? null;
}

function baseProfileSafetyValues(node, widget) {
  if (Array.isArray(widget?.__ultraH3ProfileSafetyBaseValues)) {
    return widget.__ultraH3ProfileSafetyBaseValues;
  }
  const fromLabels = Object.keys(OPTION_LABELS.en?.[widget.name] ?? {});
  const fromWidget = Array.isArray(widget?.options?.values) ? [...widget.options.values] : [];
  // Locale tables intentionally mirror every canonical combo value and stay
  // untouched when a current dropdown is filtered. Prefer the larger source
  // so a nodeCreated -> loadedGraphNode state rebuild can always restore the
  // complete adult list instead of caching an already-filtered subset.
  const values = fromLabels.length >= fromWidget.length ? fromLabels : fromWidget;
  widget.__ultraH3ProfileSafetyBaseValues = Object.freeze([...values]);
  return widget.__ultraH3ProfileSafetyBaseValues;
}

function syncProfileSafety(node, { resetInvalid = true } = {}) {
  const policy = profileSafetyPolicy(node);
  if (!policy) return false;
  const adultAges = new Set(policy.adultAges);
  const blockedAppearance = new Set(policy.adultOnlyAppearance);
  const blockedClothing = new Set(policy.adultOnlyClothing);
  const { personCount } = readDynamicCounts(node);
  const state = nodeState(node);
  let changed = false;
  let preferenceChanged = false;

  for (const slot of ["a", "b", "c"].slice(0, personCount)) {
    const ageWidget = widgetByName(node, `person_${slot}_age`);
    const age = canonicalValue(ageWidget?.name ?? "", ageWidget?.value ?? "unspecified");
    const isAdult = adultAges.has(age);

    for (const [suffix, blocked] of [
      ["appearance_preset", blockedAppearance],
      ["clothing_preset", blockedClothing],
    ]) {
      const widget = widgetByName(node, `person_${slot}_${suffix}`);
      if (!widget) continue;
      widget.options ??= {};
      const baseValues = baseProfileSafetyValues(node, widget);
      const allowed = isAdult ? [...baseValues] : baseValues.filter((value) => !blocked.has(String(value)));
      const previous = Array.isArray(widget.options.values) ? widget.options.values : [];
      if (previous.length !== allowed.length || previous.some((value, index) => value !== allowed[index])) {
        widget.options = { ...widget.options, values: allowed };
        changed = true;
      }

      const key = widget.name;
      const current = canonicalValue(widget.name, widget.value) || "none";
      let next = current;

      if (resetInvalid && !allowed.includes(current)) {
        if (current !== "none" && state.preferredProfilePresets.get(key) !== current) {
          state.preferredProfilePresets.set(key, current);
          preferenceChanged = true;
        }
        next = "none";
      } else if (isAdult && current === "none") {
        const preferred = state.preferredProfilePresets.get(key);
        if (preferred && preferred !== "none" && allowed.includes(preferred)) {
          next = preferred;
        }
      }

      if (widget.value !== next) {
        state.programmaticProfilePresetWrites.add(key);
        try { widget.value = next; } finally { state.programmaticProfilePresetWrites.delete(key); }
        changed = true;
      }
    }
  }

  if (preferenceChanged) persistPreferredSelections(node, state);
  if (changed) {
    refreshVueWidgetMetadata(node);
    node.setDirtyCanvas?.(true, true);
  }
  return changed;
}

function installScenePromptHelp(node) {
  const widget = widgetByName(node, "scene_prompt");
  if (!widget) return;
  const help = scenePromptHelp(node);
  widget.options ??= {};
  widget.options.tooltip = help.tooltip;
  widget.options.placeholder = help.placeholder;
  widget.tooltip = help.tooltip;

  const applyDomHelp = () => {
    const textarea = findSceneTextarea(node);
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

const LEGACY_KO_DISPLAY_TO_CANONICAL = Object.freeze({
  "1 숏": "single",
  "2 숏": "two",
  "3 숏": "three",
  "4 숏": "four",
  "원문/참조 스타일 유지": "auto",
  "영화풍 공포": "cinematic_horror",
  "불길한 어두운 분위기": "ominous_dark",
  "멸망 이후 세계풍": "post_apocalyptic",
  "네온 미래도시풍 (사이버펑크)": "cyberpunk",
  "최소 자연음": "minimal",
  "사용자 환경음 힌트만 · 힌트 필수": "custom_only",
  "환경음 / 물리음 없음": "silent",
  "성긴 피아노 + 저음 현악": "sparse_piano_strings",
  "앰비언트 신스": "ambient_synth",
  "전자 펄스": "electronic_pulse",
  "오케스트라 상승": "orchestral_rise",
  "클래식 기타": "classical_guitar",
  "잔잔한 경음악": "soft_light_music",
  "잔잔한 클래식": "gentle_classical",
  "경쾌한 행진곡": "cheerful_march",
  "장엄한 행진곡": "grand_march",
  "보사노바": "bossa_nova",
  "고전·빈티지 팝": "vintage_pop",
  "모던 팝": "modern_pop",
  "K-pop 스타일": "kpop_style",
  "K-pop 댄스": "kpop_dance",
  "빠른 랩 비트": "fast_rap_beat",
  "올드스쿨 힙합": "oldschool_hiphop",
  "펑키 그루브": "funk_groove",
  "록 드라이브": "rock_drive",
  "고급 미니멀 광고": "minimal_luxury_electronic",
  "테크 제품 광고": "tech_product_pulse",
  "신스웨이브": "synthwave",
  "몽환적 드림 팝": "dream_pop",
  "천공·우주 음악": "celestial_space",
  "신비로운 판타지": "mystic_fantasy",
  "서정적 하프 + 첼로": "lyrical_harp_cello",
  "한국 전통 퓨전": "korean_traditional_fusion",
  "사용자 음악 힌트 · 힌트 필수": "custom",
  "자동 · 한글/영어 우선": "auto",
  "화면 밖 내레이션": "voiceover",
  "자동 · 한글→영문 / 영어 그대로": "ko_to_en",
  "논바이너리": "nonbinary",
  "노년": "elderly",
  "마른 체형": "slim_build",
  "곡선미 있는 체형": "curvy_build",
  "모래시계 체형": "hourglass_figure",
  "풍만한 가슴 (성인 전용)": "full_bust",
  "빈약한 가슴 (성인 전용)": "small_bust",
  "웨이브 헤어": "wavy_hair",
  "풍만한 체형": "full_figure",
  "큰 키와 늘씬한 체형": "tall_build",
  "어깨 길이 머리": "shoulder_length_hair",
  "픽시컷": "pixie_cut",
  "포니테일": "ponytail",
  "가디건 + 스커트": "cardigan_and_skirt",
  "블라우스 + 청바지": "blouse_and_jeans",
  "터틀넥 + 슬랙스": "turtleneck_and_slacks",
  "청바지 캐주얼": "casual_jeans",
  "탱크톱 + 반바지": "tank_top_and_shorts",
  "운동복 / 조깅복": "sportswear",
  "비즈니스 캐주얼": "business_casual",
  "니트와 스커트": "knit_sweater_and_skirt",
  "후드티와 조거 팬츠": "hoodie_and_joggers",
  "현대적 스트리트웨어": "streetwear",
  "사이클링복": "cycling_outfit",
  "선드레스": "sundress",
  "바디콘 드레스 (성인)": "bodycon_dress",
  "오프숄더 드레스 (성인)": "off_shoulder_dress",
  "홀터넥 드레스 (성인)": "halter_neck_dress",
  "슬립 드레스 (성인)": "slip_dress",
  "블라우스와 미니스커트 (성인)": "mini_skirt_and_blouse",
  "크롭탑과 청바지 (성인)": "crop_top_and_jeans",
  "캐미솔과 쇼츠 (성인)": "camisole_and_shorts",
  "수영복과 비치 커버업": "beach_cover_up",
  "현재 진행 중심": "current_action",
  "일반 컷 (전환 방식)": "cut",
  "부드럽게 겹치며 전환 (전환 방식)": "cross_dissolve",
  "페이드 (전환 방식)": "fade",
  "화면 밀어내기 (전환 방식)": "wipe"
});

function canonicalValue(widgetName, value) {
  const raw = String(value ?? "");
  if (/^person_[abc]_age$/.test(widgetName)) {
    const legacyAge = {
      young_adult: "twenties",
      adult: "thirties",
      middle_aged: "forties",
      older_adult: "elderly",
      "Young adult": "twenties",
      Adult: "thirties",
      "Middle-aged": "forties",
      "Older adult": "elderly",
      "청년": "twenties",
      "성인": "thirties",
      "중년": "forties",
    };
    if (Object.prototype.hasOwnProperty.call(legacyAge, raw)) return legacyAge[raw];
  }
  const maps = [OPTION_LABELS.en[widgetName], OPTION_LABELS.ko[widgetName]];

  for (const map of maps) {
    if (map && Object.prototype.hasOwnProperty.call(map, raw)) return raw;
  }
  for (const map of maps) {
    if (!map) continue;
    for (const [canonical, display] of Object.entries(map)) {
      if (String(display) === raw) return canonical;
    }
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_KO_DISPLAY_TO_CANONICAL, raw)) {
    return LEGACY_KO_DISPLAY_TO_CANONICAL[raw];
  }
  return raw;
}

function advancedToggleValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const raw = String(value).trim().toLowerCase();
  if (["expanded", "true", "1", "on", "show advanced", "고급 표시"].includes(raw)) return true;
  if (["collapsed", "false", "0", "off", "basic only", "기본만 표시"].includes(raw)) return false;
  return Boolean(value);
}

function normalizeAdvancedToggleWidgets(node) {
  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const widget = widgetByName(node, name);
    if (!widget) continue;
    const next = advancedToggleValue(widget.value);
    if (widget.value !== next) widget.value = next;
  }
}

const LEGACY_CAMERA_SCHEMA_DEFAULTS = Object.freeze({
  camera_shot_2_transition: "cut",
  camera_shot_3_transition: "cut",
  camera_shot_4_transition: "cut",
  camera_shot_4_target: "current_action",
  camera_shot_4_motion: "auto",
});

const CAMERA_FRAMING_SCHEMA_DEFAULTS = Object.freeze({
  camera_shot_1_framing: "auto",
  camera_shot_2_framing: "auto",
  camera_shot_3_framing: "auto",
  camera_shot_4_framing: "auto",
});

function cameraSchemaWidgetsBeforeFraming(node) {
  return serializedWidgetsOf(node).filter(
    (widget) => !Object.prototype.hasOwnProperty.call(CAMERA_FRAMING_SCHEMA_DEFAULTS, widget?.name)
  );
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
  const widgets = serializedWidgetsOf(node);
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

function migrateLegacyCameraSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = cameraSchemaWidgetsBeforeFraming(node);
  if (!widgets.length) return;

  const clothingLockName = "i2va_preserve_reference_clothing";
  const clothingLockIndex = widgets.findIndex((widget) => widget?.name === clothingLockName);
  const hasClothingLock = clothingLockIndex >= 0;
  const legacyValues = [...info.widgets_values];

  // V2.0 appends one new serialized widget after every V1.9 widget. A genuine
  // V2.0 graph therefore already has a Boolean at that final slot and must not
  // be mistaken for the older camera schema that also happened to differ by one
  // value. Camera migration continues to reason against the exact V1.9 widget
  // schema so all prior camera migrations retain their original length math.
  if (hasClothingLock && legacyValues.length === widgets.length && typeof legacyValues[clothingLockIndex] === "boolean") return;
  const compatibilityWidgets = hasClothingLock
    ? widgets.filter((widget) => widget?.name !== clothingLockName)
    : widgets;
  const currentLength = compatibilityWidgets.length;
  let addedNames = null;
  let dropLegacyShot1Motion = false;

  // Legacy layout: 91 required widgets, before Shot 4 and per-cut
  // transition selectors existed.
  if (legacyValues.length === currentLength - 6) {
    addedNames = new Set(Object.keys(LEGACY_CAMERA_SCHEMA_DEFAULTS));
  // Later legacy layout: Shot 1 mirror + Shot 4 + per-cut transition selectors.
  // Remove the deprecated Shot 1 mirror while keeping the rest aligned.
  } else if (legacyValues.length === currentLength + 1) {
    dropLegacyShot1Motion = true;
  // Discarded legacy draft: Shot 1 mirror + Shot 4 existed, but the three
  // explicit transition selectors did not. Accept it defensively if a user
  // happened to save a workflow with that draft.
  } else if (legacyValues.length === currentLength - 2) {
    addedNames = new Set([
      "camera_shot_2_transition",
      "camera_shot_3_transition",
      "camera_shot_4_transition",
    ]);
    dropLegacyShot1Motion = true;
  } else {
    return;
  }

  const migrated = [];
  let oldIndex = 0;
  for (const widget of compatibilityWidgets) {
    const name = widget?.name;
    if (addedNames && addedNames.has(name)) {
      migrated.push(LEGACY_CAMERA_SCHEMA_DEFAULTS[name]);
      continue;
    }
    if (oldIndex >= legacyValues.length) return;
    migrated.push(legacyValues[oldIndex++]);
  }
  if (oldIndex === legacyValues.length && migrated.length === currentLength) {
    info.widgets_values = migrated;
  }
}

function migrateV20ReferenceClothingSerializedValue(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = cameraSchemaWidgetsBeforeFraming(node);
  const lockIndex = widgets.findIndex((widget) => widget?.name === "i2va_preserve_reference_clothing");
  if (lockIndex < 0) return;

  // New V2.0 nodes default to ON. Existing V1.9-and-older workflows have no
  // serialized value for this appended field, so append OFF to preserve their
  // historical wardrobe behavior instead of silently changing old I2VA output.
  if (info.widgets_values.length === widgets.length - 1) {
    info.widgets_values = [...info.widgets_values, false];
  }
}

const LEGACY_H3_CAMERA_VALUE_MAP = Object.freeze({
  camera_motion: Object.freeze({
    dynamic: "tracking_shot",
    Dynamic: "tracking_shot",
    "다이나믹": "tracking_shot",
    "다이나믹 카메라": "tracking_shot",
    "장면 따라 다이나믹 이동": "tracking_shot",
  }),
  camera_transition: Object.freeze({
    blind: "wipe",
    slide: "wipe",
    rotate: "cut",
    bounce: "cut",
    "Blind (Experimental Transition)": "wipe",
    "Slide (Experimental Transition)": "wipe",
    "Rotate (Experimental Transition)": "cut",
    "Bounce (Experimental Transition)": "cut",
    "블라인드 (실험적 전환)": "wipe",
    "슬라이드 (실험적 전환)": "wipe",
    "회전 (실험적 전환)": "cut",
    "바운스 (실험적 전환)": "cut",
    "블라인드 전환": "wipe",
    "슬라이드 전환": "wipe",
    "회전 전환": "cut",
    "바운스 전환": "cut",
  }),
});

function migrateLegacyCameraFramingSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = serializedWidgetsOf(node);
  const added = Object.keys(CAMERA_FRAMING_SCHEMA_DEFAULTS);
  if (info.widgets_values.length !== widgets.length - added.length) return;
  const migrated = [];
  let oldIndex = 0;
  for (const widget of widgets) {
    const name = widget?.name;
    if (Object.prototype.hasOwnProperty.call(CAMERA_FRAMING_SCHEMA_DEFAULTS, name)) {
      migrated.push(CAMERA_FRAMING_SCHEMA_DEFAULTS[name]);
      continue;
    }
    if (oldIndex >= info.widgets_values.length) return;
    migrated.push(info.widgets_values[oldIndex++]);
  }
  if (oldIndex === info.widgets_values.length && migrated.length === widgets.length) {
    info.widgets_values = migrated;
  }
}


const LEGACY_H3_CAMERA_MOTION_WIDGETS = Object.freeze([
  "camera_motion",
  "camera_shot_2_motion",
  "camera_shot_3_motion",
  "camera_shot_4_motion",
]);
const LEGACY_H3_CAMERA_TRANSITION_WIDGETS = Object.freeze([
  "camera_shot_2_transition",
  "camera_shot_3_transition",
  "camera_shot_4_transition",
]);

function migratedOfficialCameraValue(name, value) {
  const raw = String(value ?? "");
  if (LEGACY_H3_CAMERA_MOTION_WIDGETS.includes(name)) {
    return LEGACY_H3_CAMERA_VALUE_MAP.camera_motion[raw] ?? value;
  }
  if (LEGACY_H3_CAMERA_TRANSITION_WIDGETS.includes(name)) {
    return LEGACY_H3_CAMERA_VALUE_MAP.camera_transition[raw] ?? value;
  }
  return value;
}

function migrateLegacyH3OfficialCameraSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = serializedWidgetsOf(node);
  for (let index = 0; index < widgets.length && index < info.widgets_values.length; index += 1) {
    const name = widgets[index]?.name;
    if (!name) continue;
    info.widgets_values[index] = migratedOfficialCameraValue(name, info.widgets_values[index]);
  }
}

function normalizeLegacyH3OfficialCameraWidgets(node) {
  for (const name of [...LEGACY_H3_CAMERA_MOTION_WIDGETS, ...LEGACY_H3_CAMERA_TRANSITION_WIDGETS]) {
    const widget = widgetByName(node, name);
    if (!widget) continue;
    const next = migratedOfficialCameraValue(name, widget.value);
    if (next !== widget.value) widget.value = next;
  }
}

function normalizeLegacyAdvancedSerializedValues(node, info) {
  if (!Array.isArray(info?.widgets_values)) return;
  const widgets = serializedWidgetsOf(node);
  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const index = widgets.findIndex((widget) => widget.name === name);
    if (index < 0 || index >= info.widgets_values.length) continue;
    const raw = info.widgets_values[index];
    if (raw === "expanded" || raw === "collapsed" || raw === "Show Advanced" || raw === "Basic Only" || raw === "고급 표시" || raw === "기본만 표시") {
      info.widgets_values[index] = advancedToggleValue(raw);
    }
  }
}

function optionLabel(node, widgetName, value) {
  const canonical = canonicalValue(widgetName, value);
  const locale = activeLocale(node);
  return OPTION_LABELS[locale]?.[widgetName]?.[canonical]
    ?? OPTION_LABELS.en?.[widgetName]?.[canonical]
    ?? canonical;
}

function advancedToggleBaseLabel(locale, widgetName) {
  const labels = locale === "ko"
    ? {
        person_a_advanced: "인물 1 고급 설정",
        person_b_advanced: "인물 2 고급 설정",
        person_c_advanced: "인물 3 고급 설정",
      }
    : {
        person_a_advanced: "Person 1 Advanced Settings",
        person_b_advanced: "Person 2 Advanced Settings",
        person_c_advanced: "Person 3 Advanced Settings",
      };
  return labels[widgetName] ?? widgetName;
}

function refreshAdvancedToggleLabels(node) {
  const locale = activeLocale(node);
  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const widget = widgetByName(node, name);
    if (!widget) continue;
    widget.label = advancedToggleBaseLabel(locale, name);
  }
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
  for (const widget of widgetsOf(node)) {
    if (!OPTION_LABELS.en[widget.name] && !OPTION_LABELS.ko[widget.name]) continue;
    widget.options ??= {};

    const canonical = canonicalValue(widget.name, widget.value);
    if (canonical !== String(widget.value ?? "")) widget.value = canonical;

    if (!LOCALIZED_WIDGETS.has(widget)) {
      widget.options.getOptionLabel = (value) => optionLabel(node, widget.name, value);
      LOCALIZED_WIDGETS.add(widget);
    }
  }
}

// -----------------------------------------------------------------------------
// Dynamic character / timeline visibility
// -----------------------------------------------------------------------------

function allowedTurnSpeakerChoices(personCount) {
  if (personCount <= 1) return ["A"];
  if (personCount === 2) return ["A", "B", "A+B"];
  return ["A", "B", "C", "A+B", "A+C", "B+C", "A+B+C"];
}

function allowedCameraTargetChoices(personCount) {
  if (personCount <= 1) return ["current_action", "A", "scene"];
  if (personCount === 2) return ["current_action", "A", "B", "A+B", "scene"];
  return ["current_action", "A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "scene"];
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
    widget.options ??= {};

    const previous = Array.isArray(widget.options.values) ? widget.options.values : [];
    if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
      widget.options = { ...widget.options, values: [...allowed] };
      changed = true;
    }

    const current = canonicalValue(widget.name, widget.value) || fallback;
    if (!state.preferredCameraTargets.has(index)) {
      state.preferredCameraTargets.set(index, current);
    }

    const preferred = state.preferredCameraTargets.get(index) || current;
    let next = current;
    if (allowed.includes(preferred)) {
      next = preferred;
      state.autoFallbackCameraTargets.delete(index);
    } else if (!allowed.includes(current)) {
      next = fallback;
      state.autoFallbackCameraTargets.add(index);
      preferenceChanged = true;
    }

    if (widget.value !== next) {
      state.programmaticCameraTargetWrites.add(index);
      try { widget.value = next; } finally { state.programmaticCameraTargetWrites.delete(index); }
      changed = true;
    }
  }
  if (preferenceChanged) persistPreferredSelections(node, state);
  return changed;
}

const TURN_DRAFT_FIELDS = [
  "elapsed_seconds",
  "action",
  "dialogue_text",
  "dialogue_language",
  "dialogue_delivery",
];

const TURN_DRAFT_DEFAULTS = Object.freeze({
  elapsed_seconds: 0.0,
  action: "",
  dialogue_text: "",
  dialogue_language: "auto",
  dialogue_delivery: "on_screen",
});


function syncCameraFramingChoices(node, personCount) {
  let changed = false;
  const fullChoices = ["auto", "face_closeup", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene"];

  for (let index = 1; index <= MAX_CAMERA_SHOTS; index++) {
    const widget = widgetByName(node, `camera_shot_${index}_framing`);
    if (!widget) continue;
    widget.options ??= {};

    const target = canonicalValue(`camera_shot_${index}_target`, widgetByName(node, `camera_shot_${index}_target`)?.value) || "current_action";
    let allowed = fullChoices;
    if (target === "current_action") allowed = ["auto"];
    else if (target === "scene") allowed = ["auto", "wide_scene"];
    else if ((target.match(/\+/g) || []).length >= 1) {
      allowed = ["auto", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene"];
    }

    const previous = Array.isArray(widget.options.values) ? widget.options.values : [];
    const choicesChanged = previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i]);
    if (choicesChanged) {
      widget.options = { ...widget.options, values: [...allowed] };
      changed = true;
    }

    // Simple A-mode rule:
    // - non-person targets always stay at automatic scene framing;
    // - when a person target becomes available again, start from Auto instead
    //   of remembering an older portrait/body framing selection.
    let next = canonicalValue(widget.name, widget.value) || "auto";
    if (allowed.length === 1 || !allowed.includes(next)) next = "auto";
    if (widget.value !== next) {
      widget.value = next;
      changed = true;
    }
  }
  return changed;
}

function syncTurnSpeakerChoices(node, personCount, turnCount) {
  const allowed = allowedTurnSpeakerChoices(personCount);
  const fallback = allowed[0] ?? "A";
  const state = nodeState(node);
  let changed = false;
  let preferenceChanged = false;

  for (let index = 1; index <= MAX_TURNS; index++) {
    const widget = widgetByName(node, `turn_${index}_speaker`);
    if (!widget) continue;
    widget.options ??= {};

    const previous = Array.isArray(widget.options.values) ? widget.options.values : [];
    if (previous.length !== allowed.length || previous.some((value, i) => value !== allowed[i])) {
      widget.options = { ...widget.options, values: [...allowed] };
      changed = true;
    }

    const current = canonicalValue(widget.name, widget.value) || fallback;
    if (!state.preferredTurnSpeakers.has(index)) {
      state.preferredTurnSpeakers.set(index, current);
    }

    const isActiveTurn = turnCount > 0 && index <= turnCount;
    const preferred = state.preferredTurnSpeakers.get(index) || current;
    let next = current;
    if (isActiveTurn) {
      if (allowed.includes(preferred)) {
        next = preferred;
        state.autoFallbackTurnSpeakers.delete(index);
      } else if (!allowed.includes(current)) {
        next = fallback;
        state.autoFallbackTurnSpeakers.add(index);
        preferenceChanged = true;
      }
    }

    if (widget.value !== next) {
      state.programmaticTurnSpeakerWrites.add(index);
      try { widget.value = next; } finally { state.programmaticTurnSpeakerWrites.delete(index); }
      changed = true;
    }
  }
  if (preferenceChanged) persistPreferredSelections(node, state);
  return changed;
}

function activeCameraShotCount(node) {
  if (!Boolean(widgetByName(node, "camera_sequence_enabled")?.value ?? false)) return 1;
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

function syncShotStartTimeBounds(node, { clampValues = true } = {}) {
  const maxValue = timelineMaxStart(node);
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
  if (changed) refreshVueWidgetMetadata(node);
  return changed;
}

function readDynamicCounts(node) {
  const personRaw = Number(widgetByName(node, "person_count")?.value ?? 1);
  const turnRaw = Number(widgetByName(node, "turn_count")?.value ?? 1);
  const cameraEnabled = Boolean(widgetByName(node, "camera_sequence_enabled")?.value ?? false);
  return {
    personCount: Math.max(1, Math.min(3, Number.isFinite(personRaw) ? personRaw : 1)),
    turnCount: Math.max(1, Math.min(MAX_TURNS, Number.isFinite(turnRaw) ? turnRaw : 1)),
    cameraEnabled,
    cameraShotCount: activeCameraShotCount(node),
  };
}

function timelineMaxStart(node) {
  const durationWidget = widgetByName(node, "duration_seconds");
  const safeDuration = normalizeWholeSecondDuration(durationWidget?.value, 5, 30);
  if (durationWidget && Number(durationWidget.value) !== safeDuration) durationWidget.value = safeDuration;
  return Math.max(0, safeDuration - 0.5);
}

function syncTurnStartBounds(node, { clampValues = true } = {}) {
  const maxStart = timelineMaxStart(node);
  const activeTurnCount = Math.max(1, Math.min(MAX_TURNS, Number(widgetByName(node, "turn_count")?.value ?? 1) || 1));
  let metadataChanged = false;
  let valueChanged = false;

  for (let index = 1; index <= MAX_TURNS; index++) {
    const widget = widgetByName(node, `turn_${index}_elapsed_seconds`);
    if (!widget) continue;
    const previousOptions = widget.options && typeof widget.options === "object" ? widget.options : {};
    if (Number(previousOptions.max) !== maxStart || Number(previousOptions.min) !== 0 || Number(previousOptions.step) !== 0.5) {
      widget.options = { ...previousOptions, min: 0, max: maxStart, step: 0.5 };
      metadataChanged = true;
    }
    if (!clampValues || index > activeTurnCount) continue;
    const current = Number(widget.value);
    const snapped = snapHalfSecond(current, 0.0);
    const clamped = Math.max(0, Math.min(maxStart, snapped));
    if (!Number.isFinite(current) || Math.abs(clamped - current) > 1e-9) {
      // Duration reduction is an explicit edit: values beyond the new legal
      // range visibly move to the new maximum instead of surviving invisibly
      // and causing a backend traceback later.
      widget.value = clamped;
      valueChanged = true;
    }
  }

  if (metadataChanged) refreshVueWidgetMetadata(node);
  if (metadataChanged || valueChanged) node.setDirtyCanvas?.(true, true);
  return metadataChanged || valueChanged;
}

function buildVisibilityPlan(node) {
  const { personCount, turnCount, cameraEnabled, cameraShotCount } = readDynamicCounts(node);
  const usingTimeline = turnCount > 0;
  const mode = canonicalValue("mode", widgetByName(node, "mode")?.value) || "auto";
  const compactView = Boolean(nodeState(node).compactView);
  const entries = [];

  const add = (name, visible, { preserveLinkedWhenHidden = false } = {}) => {
    const widget = widgetByName(node, name);
    if (!widget) return;
    const keepLinkedVisible = preserveLinkedWhenHidden && !visible && widgetInputConnected(node, name);
    entries.push({ widget, visible: Boolean(visible || keepLinkedVisible) });
  };

  // These core rows are normally always visible. Route them through the same
  // visibility helper so the Basic Settings group can actually collapse them.
  add("scene_translate", true);
  const translationApi = translationApiWidget(node);
  const translationEnabled = canonicalValue("scene_translate", widgetByName(node, "scene_translate")?.value) !== "off";
  if (translationApi) entries.push({ widget: translationApi, visible: translationEnabled });
  for (const name of ["mode", "duration_seconds", "visual_style"]) add(name, true);
  for (const name of sceneBaselineWidgetNames()) add(name, true);
  const [narratorPresetWidgetName, narratorDescWidgetName] = sequentialNarratorWidgetNames();
  add(narratorPresetWidgetName, true);
  add(narratorDescWidgetName, sequentialNarratorUsesCustom(node), { preserveLinkedWhenHidden: true });
  add("person_count", false);
  add("turn_count", false);
  for (const key of ["person_count", "turn_count"]) {
    const mirror = basicCountMirror(node, key);
    if (mirror) entries.push({ widget: mirror, visible: true });
  }

  for (const name of [
    "scene_input_role",
    "shot_layout",
    "dialogue_text",
    "dialogue_language",
    "dialogue_delivery",
    "variation_seed",
  ]) add(name, !usingTimeline);

  // Keep both serialized reference widgets hidden in-place so workflow widget
  // indexes remain compatible. Non-serialized UI mirrors are grouped directly
  // below Visual Style and are visible only when the selected mode + actual
  // reference connections form a valid image-based task.
  add("reference_fidelity", false);
  add("i2va_preserve_reference_clothing", false);
  const effectiveReferenceMode = effectiveReferenceModeForUi(node);
  const fidelityMirror = widgetsOf(node).find((widget) => widget?.[REFERENCE_FIDELITY_UI_MARKER]);
  if (fidelityMirror) entries.push({ widget: fidelityMirror, visible: effectiveReferenceMode !== null });
  const clothingMirror = widgetsOf(node).find((widget) => widget?.[REFERENCE_CLOTHING_UI_MARKER]);
  // Reference clothing preservation is a high-impact I2VA switch: if it is
  // active, profile clothing edits may intentionally be ignored. Keep this
  // switch reachable in Basic View whenever the current task is valid I2VA.
  if (clothingMirror) entries.push({ widget: clothingMirror, visible: effectiveReferenceMode === "i2va" });

  // Basic View is a genuine quick-edit surface: every active person remains
  // reachable, but only identity essentials are shown. Full View restores the
  // existing advanced toggle + profile detail workflow without changing values.
  const profileGroups = [
    {
      identity: ["person_a_gender", "person_a_age"],
      advancedToggle: "person_a_advanced",
      extensions: extensionWidgetNamesForPerson("A"),
      advanced: [
        "person_a_voice_desc",
        "person_a_appearance_preset",
        "person_a_appearance_desc",
        "person_a_clothing_preset",
        "person_a_clothing_desc",
      ],
    },
    {
      identity: ["person_b_gender", "person_b_age"],
      advancedToggle: "person_b_advanced",
      extensions: extensionWidgetNamesForPerson("B"),
      advanced: [
        "person_b_voice_desc",
        "person_b_appearance_preset",
        "person_b_appearance_desc",
        "person_b_clothing_preset",
        "person_b_clothing_desc",
      ],
    },
    {
      identity: ["person_c_gender", "person_c_age"],
      advancedToggle: "person_c_advanced",
      extensions: extensionWidgetNamesForPerson("C"),
      advanced: [
        "person_c_voice_desc",
        "person_c_appearance_preset",
        "person_c_appearance_desc",
        "person_c_clothing_preset",
        "person_c_clothing_desc",
      ],
    },
  ];
  profileGroups.forEach((group, index) => {
    const personActive = usingTimeline && personCount >= index + 1;
    for (const name of group.identity) {
      add(name, personActive, { preserveLinkedWhenHidden: personActive });
    }
    const expanded = advancedToggleValue(widgetByName(node, group.advancedToggle)?.value);
    // Basic View keeps the disclosure row visible but collapsed. All advanced
    // profile children, including ethnic appearance, belong exclusively to
    // Full View so the compact hierarchy never exposes a child without its parent.
    add(group.advancedToggle, personActive, { preserveLinkedWhenHidden: personActive });
    for (const name of group.extensions) {
      const visible = personActive && !compactView && expanded;
      add(name, visible, { preserveLinkedWhenHidden: personActive && !visible });
    }
    for (const name of group.advanced) {
      const visible = personActive && !compactView && expanded;
      add(name, visible, { preserveLinkedWhenHidden: personActive && !visible });
    }
  });

  // Keep every active Progress accessible in Basic View. Continue Speaking is
  // Speaker/language/delivery remain UI-only state in the extension transport.
  // Only connectable Narrator/Vocal 2/3 text rows are native Core STRING fields;
  // all recovery Core fields retain their relative order. When enabled, the existing
  // Dialogue/Language/Delivery rows are represented by one Core-laid-out custom
  // panel; externally connected Core rows remain visible for connection safety.
  for (let index = 1; index <= MAX_TURNS; index++) {
    const turnActive = usingTimeline && index <= turnCount;
    const sequential = sequentialVocalEnabled(node, index);
    add(`turn_${index}_speaker`, turnActive, { preserveLinkedWhenHidden: turnActive });
    add(`turn_${index}_elapsed_seconds`, turnActive, { preserveLinkedWhenHidden: turnActive });
    add(`turn_${index}_action`, turnActive, { preserveLinkedWhenHidden: turnActive });
    add(`turn_${index}_dialogue_text`, turnActive, { preserveLinkedWhenHidden: turnActive });
    add(`turn_${index}_dialogue_language`, turnActive && !sequential && !compactView, { preserveLinkedWhenHidden: turnActive });
    add(`turn_${index}_dialogue_delivery`, turnActive && !sequential && !compactView, { preserveLinkedWhenHidden: turnActive });
    for (const seqName of sequentialVocalWidgetNames(index)) {
      const isToggle = String(seqName).startsWith("__ultra_seq_vocal_toggle_");
      add(seqName, turnActive && (isToggle || sequential), { preserveLinkedWhenHidden: turnActive });
    }
    for (const name of turnSceneWidgetNames(index)) {
      const visible = turnActive && !compactView;
      add(name, visible, { preserveLinkedWhenHidden: turnActive && !visible });
    }
  }

  // Basic View keeps the high-impact camera choices and lets multi-shot
  // structure expand progressively. Fine per-shot transition/motion tuning
  // remains in Full View; hidden values remain intact.
  add("camera_motion", true);
  add("camera_amplitude", !compactView, { preserveLinkedWhenHidden: true });
  add("camera_speed", !compactView, { preserveLinkedWhenHidden: true });

  // The master multi-shot switch changes the video's camera structure, so keep
  // it discoverable in Basic View. When enabled, each active Shot exposes its
  // start/target/framing plus the next Shot ON/OFF control in sequence. Full View
  // adds transition and per-shot motion. Hidden shot values are never deleted.
  add("camera_sequence_enabled", usingTimeline, { preserveLinkedWhenHidden: usingTimeline });
  // Shot 1 is the default camera block and always begins at video time 0.0s.
  // Keep the framing row present so changing the target does not resize the node.
  // Non-person targets simply offer Auto only; person targets expose body framing.
  add("camera_shot_1_target", usingTimeline);
  add("camera_shot_1_framing", usingTimeline);
  add("camera_shot_count", false);
  let previousEnabled = cameraEnabled;
  for (let shotIndex = 2; shotIndex <= MAX_CAMERA_SHOTS; shotIndex++) {
    const enabledWidget = widgetByName(node, `camera_shot_${shotIndex}_enabled`);
    const enabled = previousEnabled && Boolean(enabledWidget?.value ?? (shotIndex === 2));
    const toggleVisible = usingTimeline && cameraEnabled && previousEnabled;
    add(`camera_shot_${shotIndex}_enabled`, toggleVisible, { preserveLinkedWhenHidden: previousEnabled && !toggleVisible });
    const detailVisible = toggleVisible && enabled;
    add(`camera_shot_${shotIndex}_start_seconds`, detailVisible, { preserveLinkedWhenHidden: enabled && !detailVisible });
    add(`camera_shot_${shotIndex}_target`, detailVisible, { preserveLinkedWhenHidden: enabled && !detailVisible });
    add(`camera_shot_${shotIndex}_framing`, detailVisible, { preserveLinkedWhenHidden: enabled && !detailVisible });
    const fineDetailVisible = detailVisible && !compactView;
    for (const suffix of ["transition", "motion", "amplitude", "speed"]) {
      add(`camera_shot_${shotIndex}_${suffix}`, fineDetailVisible, { preserveLinkedWhenHidden: enabled && !fineDetailVisible });
    }
    previousEnabled = enabled;
  }

  // Sound rows are part of the Sound group even when their underlying core
  // visibility is normally unconditional. Route them through the same helper so
  // the group toggle behaves exactly like Basic/Person/Progress.
  add("soundscape_mode", true, { preserveLinkedWhenHidden: true });
  const soundscapeMode = canonicalValue("soundscape_mode", widgetByName(node, "soundscape_mode")?.value) || "auto";
  add("sound_hint", !compactView || soundscapeMode === "custom_only", { preserveLinkedWhenHidden: true });
  add("music_mode", true, { preserveLinkedWhenHidden: true });
  const musicMode = canonicalValue("music_mode", widgetByName(node, "music_mode")?.value) || "none";
  add("music_hint", !compactView || musicMode === "custom", { preserveLinkedWhenHidden: true });

  return { personCount, turnCount, cameraEnabled, cameraShotCount, compactView, entries };
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

function referenceInputConnected(node, name) {
  return widgetInputConnected(node, name);
}

function disconnectWidgetInput(node, name) {
  const index = widgetInputIndex(node, name);
  if (index < 0 || !widgetInputConnected(node, name)) return false;
  if (typeof node?.disconnectInput === "function") {
    try {
      return node.disconnectInput(index) !== false;
    } catch (error) {
      console.warn(`[Ultra MiniMax H3 Prompt] Failed to disconnect inactive input ${name}.`, error);
      return false;
    }
  }
  return false;
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
  const usingTimeline = counts.turnCount > 0;

  if (!usingTimeline) {
    for (const name of LEGACY_SINGLE_SHOT_FIELDS) active.add(name);
    return active;
  }

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
      const enabledName = `camera_shot_${shotIndex}_enabled`;
      active.add(enabledName);
      if (shotIndex <= counts.cameraShotCount) {
        for (const name of CAMERA_SHOT_FIELDS[shotIndex] || []) active.add(name);
      }
      if (shotIndex >= counts.cameraShotCount + 1) break;
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
    console.warn(`[Ultra MiniMax H3 Prompt] Failed to restore remembered dynamic input ${name}.`, error);
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

  // Ordinary count changes are reversible UI scope changes. Temporarily detach
  // links that leave the active structure so hidden rows cannot leave stale
  // connection geometry, but remember their exact upstream endpoint and restore
  // it when that row becomes active again. Only confirmed Reset discards memory.
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
  for (const name of LEGACY_SINGLE_SHOT_FIELDS) universe.add(name);
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


function effectiveReferenceModeForUi(node) {
  const mode = canonicalValue("mode", widgetByName(node, "mode")?.value) || "auto";
  const startConnected = referenceInputConnected(node, "start_image");
  const endConnected = referenceInputConnected(node, "end_image");

  if (mode === "auto") {
    if (startConnected && endConnected) return "fl2va";
    if (startConnected) return "i2va";
    if (endConnected) return "l2va";
    return null;
  }
  if (mode === "i2va") return startConnected ? "i2va" : null;
  if (mode === "l2va") return endConnected ? "l2va" : null;
  if (mode === "fl2va") return startConnected && endConnected ? "fl2va" : null;
  return null;
}

function referenceFidelityUiText(node) {
  return activeLocale(node) === "ko"
    ? { name: "참조 이미지 유지 강도", tooltip: "실제 이미지 참조가 성립하는 I2VA·FL2VA·L2VA에서만 표시됩니다. 시작/마지막 참조 상태를 얼마나 강하게 유지할지 정하며, 숨겨져도 선택값은 보존됩니다." }
    : { name: "Reference fidelity", tooltip: "Shown only when the current mode and actual image connections form a valid I2VA, FL2VA, or L2VA task. Controls how strongly the reference state is preserved; the selected value is retained while hidden." };
}

function referenceFidelityUiValues(node) {
  const locale = activeLocale(node);
  const labels = OPTION_LABELS[locale]?.reference_fidelity || OPTION_LABELS.en.reference_fidelity;
  return ["strict", "balanced", "creative"].map((value) => labels?.[value] ?? value);
}

function referenceFidelityUiDisplayValue(node, value) {
  const canonical = canonicalValue("reference_fidelity", value) || "balanced";
  const locale = activeLocale(node);
  return OPTION_LABELS[locale]?.reference_fidelity?.[canonical]
    ?? OPTION_LABELS.en.reference_fidelity?.[canonical]
    ?? canonical;
}

function installReferenceFidelityUi(node) {
  if (!node || typeof node.addWidget !== "function") return;
  const storage = widgetByName(node, "reference_fidelity");
  if (!storage) return;
  let mirror = widgetsOf(node).find((item) => item?.[REFERENCE_FIDELITY_UI_MARKER]);
  const text = referenceFidelityUiText(node);
  const values = referenceFidelityUiValues(node);
  if (!mirror) {
    mirror = node.addWidget("combo", "__ultra_h3_reference_fidelity_ui", referenceFidelityUiDisplayValue(node, storage.value), (value) => {
      const canonical = canonicalValue("reference_fidelity", value);
      if (!["strict", "balanced", "creative"].includes(canonical)) return;
      storage.value = canonical;
      mirror.value = referenceFidelityUiDisplayValue(node, canonical);
      node.setDirtyCanvas?.(true, true);
    }, { values, serialize: false });
    if (!mirror) return;
    mirror[REFERENCE_FIDELITY_UI_MARKER] = true;
    mirror.serialize = false;
    mirror.serializeValue = () => undefined;
  }
  if (mirror.label !== text.name) mirror.label = text.name;
  const displayValue = referenceFidelityUiDisplayValue(node, storage.value);
  if (mirror.value !== displayValue) mirror.value = displayValue;
  const currentOptions = mirror.options || {};
  const currentValues = Array.isArray(currentOptions.values) ? currentOptions.values : [];
  if (currentOptions.serialize !== false || currentOptions.tooltip !== text.tooltip
    || currentValues.length !== values.length || currentValues.some((value, index) => value !== values[index])) {
    mirror.options = { ...currentOptions, values, serialize: false, tooltip: text.tooltip };
  }

  const widgets = widgetsOf(node);
  const currentIndex = widgets.indexOf(mirror);
  const styleIndex = widgets.findIndex((item) => item?.name === "visual_style");
  if (currentIndex >= 0 && styleIndex >= 0 && currentIndex !== styleIndex + 1) {
    widgets.splice(currentIndex, 1);
    const nextStyleIndex = widgets.findIndex((item) => item?.name === "visual_style");
    widgets.splice(nextStyleIndex + 1, 0, mirror);
    refreshVueWidgetMetadata(node);
  }
}

function referenceClothingUiText(node) {
  return activeLocale(node) === "ko"
    ? { name: "참조 이미지 의상 유지", tooltip: "실제 동작 모드가 I2VA이고 시작 이미지가 연결되어 있을 때 표시됩니다. 자동 모드에서는 시작 이미지만 연결된 경우, 수동 I2VA에서는 마지막 이미지가 추가로 연결되어 있어도 그 마지막 이미지는 모드 판정에서 무시되므로 표시됩니다. 기본은 켜기입니다. 시간순 진행 수, 촬영 컷 활성 상태, 인물 의상 설정이 이 값을 자동 변경하지 않습니다." }
    : { name: "Preserve reference clothing", tooltip: "Shown when the effective task is I2VA and a start image is connected. In Auto this means start-image-only; in manual I2VA an additionally connected end image is ignored for prompt-mode resolution, so this control still appears. Default: ON. Ordered Steps, shot count, and clothing settings never toggle this value." };
}

function installReferenceClothingUi(node) {
  if (!node || typeof node.addWidget !== "function") return;
  const storage = widgetByName(node, "i2va_preserve_reference_clothing");
  if (!storage) return;
  let mirror = widgetsOf(node).find((item) => item?.[REFERENCE_CLOTHING_UI_MARKER]);
  const text = referenceClothingUiText(node);
  if (!mirror) {
    mirror = node.addWidget("toggle", "__ultra_h3_reference_clothing_ui", Boolean(storage.value), (value) => {
      storage.value = Boolean(value);
      mirror.value = Boolean(value);
      node.setDirtyCanvas?.(true, true);
    }, { serialize: false });
    if (!mirror) return;
    mirror[REFERENCE_CLOTHING_UI_MARKER] = true;
    mirror.serialize = false;
    mirror.serializeValue = () => undefined;
  }
  if (mirror.label !== text.name) mirror.label = text.name;
  const nextValue = Boolean(storage.value);
  if (mirror.value !== nextValue) mirror.value = nextValue;
  const currentOptions = mirror.options || {};
  if (currentOptions.serialize !== false || currentOptions.tooltip !== text.tooltip
    || currentOptions.on !== "ON" || currentOptions.off !== "OFF") {
    mirror.options = { ...currentOptions, serialize: false, tooltip: text.tooltip, on: "ON", off: "OFF" };
  }

  const widgets = widgetsOf(node);
  const currentIndex = widgets.indexOf(mirror);
  const fidelityIndex = widgets.findIndex((item) => item?.[REFERENCE_FIDELITY_UI_MARKER]);
  const styleIndex = widgets.findIndex((item) => item?.name === "visual_style");
  const targetIndex = fidelityIndex >= 0 ? fidelityIndex + 1 : styleIndex + 1;
  if (currentIndex >= 0 && styleIndex >= 0 && currentIndex !== targetIndex) {
    widgets.splice(currentIndex, 1);
    const nextFidelityIndex = widgets.findIndex((item) => item?.[REFERENCE_FIDELITY_UI_MARKER]);
    const nextStyleIndex = widgets.findIndex((item) => item?.name === "visual_style");
    const nextTargetIndex = nextFidelityIndex >= 0 ? nextFidelityIndex + 1 : nextStyleIndex + 1;
    widgets.splice(nextTargetIndex, 0, mirror);
    refreshVueWidgetMetadata(node);
  }
}

function installReferenceConnectionWatcher(node) {
  if (!node || node[CONNECTION_WATCH_MARKER]) return;
  const original = node.onConnectionsChange;
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

    const result = typeof original === "function" ? original.apply(this, args) : undefined;
    if (!inputEvent) return result;
    if ((nodeState(this).suppressConnectionUiSync ?? 0) > 0) return result;
    if (args[2] === false && inputName) forgetRememberedDynamicLink(this, inputName);
    queueMicrotask(() => {
      installReferenceFidelityUi(this);
      installReferenceClothingUi(this);
      syncDynamicUI(this, { preserveSceneHeight: true });
      if (sceneConnectionChanged) {
        preserveSceneGeometryAfterConnection(this, beforeSize, layoutRevision);
      }
    });
    return result;
  };
  node[CONNECTION_WATCH_MARKER] = true;
}

function viewToggleLabel(node) {
  const compact = Boolean(nodeState(node).compactView);
  if (activeLocale(node) === "ko") return compact ? "전체 설정 보기" : "기본 보기";
  return compact ? "Show All Settings" : "Basic View";
}

function resetActionLabel(node) {
  const armed = Number(nodeState(node).resetConfirmUntil) > Date.now();
  if (activeLocale(node) === "ko") return armed ? "정말 초기화?" : "설정 초기화";
  return armed ? "Confirm Reset?" : "Reset Settings";
}

function actionRowText(node) {
  if (activeLocale(node) === "ko") {
    return {
      viewTooltip: "그룹의 ▶/▼ 접힘 상태는 그대로 둡니다. 기본 보기는 핵심 항목만 남기고, 전체 설정 보기는 세부 항목까지 표시합니다. 기본 보기에서 숨긴 값과 연결은 유지되며 실제 연결된 행은 선을 숨기지 않기 위해 계속 보일 수 있습니다.",
      resetTooltip: "현재 노드 너비와 씬 지시어 작업 공간, 이미지·영상 같은 고정 미디어 연결은 유지하고, 씬 지시어·인물·진행·촬영 설정 등 위젯에 연결된 외부 입력선과 설정값을 기본 상태로 되돌립니다. 사라지는 설정 행만큼 노드 길이만 줄어듭니다. 첫 클릭 후 한 번 더 눌러 확인합니다.",
    };
  }
  return {
    viewTooltip: "Keep each group’s ▶/▼ state unchanged. Basic View keeps core controls only; Show All Settings restores fine controls. Hidden values and links stay active, and a live connected row may remain visible so its socket/line is never hidden.",
    resetTooltip: "Keep the current node width, scene editing room, and fixed media connections such as image/video sockets. Disconnect external links attached to resettable widgets and restore setting values to defaults; only the node height used by removed setting rows is reduced. Click once, then confirm with a second click.",
  };
}

function refreshViewToggle(node) {
  const widget = widgetsOf(node).find((item) => item?.[VIEW_TOGGLE_MARKER]);
  if (widget) {
    const label = viewToggleLabel(node);
    if (widget.name !== "__ultra_h3_view_toggle") widget.name = "__ultra_h3_view_toggle";
    if (widget.label !== label) widget.label = label;
    widget.options ??= {};
    const tooltip = actionRowText(node).viewTooltip;
    if (widget.options.tooltip !== tooltip) widget.options.tooltip = tooltip;
  }

  const resetWidget = widgetsOf(node).find((item) => item?.[RESET_BUTTON_MARKER]);
  if (resetWidget) {
    const label = resetActionLabel(node);
    if (resetWidget.name !== "__ultra_h3_reset_button") resetWidget.name = "__ultra_h3_reset_button";
    if (resetWidget.label !== label) resetWidget.label = label;
    resetWidget.options ??= {};
    const tooltip = actionRowText(node).resetTooltip;
    if (resetWidget.options.tooltip !== tooltip) resetWidget.options.tooltip = tooltip;
  }

  const rowWidget = widgetsOf(node).find((item) => item?.[ACTION_ROW_MARKER]);
  const controls = rowWidget?.__ultraH3Controls;
  if (controls?.viewButton) {
    const label = viewToggleLabel(node);
    const tooltip = actionRowText(node).viewTooltip;
    if (controls.viewButton.textContent !== label) controls.viewButton.textContent = label;
    if (controls.viewButton.title !== tooltip) controls.viewButton.title = tooltip;
  }
  if (controls?.resetButton) {
    const label = resetActionLabel(node);
    if (controls.resetButton.textContent !== label) controls.resetButton.textContent = label;
    controls.resetButton.title = actionRowText(node).resetTooltip;
  }
}

function clearResetConfirmation(node) {
  const state = nodeState(node);
  state.resetConfirmUntil = 0;
  if (state.resetConfirmTimer != null) {
    clearTimeout(state.resetConfirmTimer);
    state.resetConfirmTimer = null;
  }
  refreshViewToggle(node);
}

function armResetConfirmation(node) {
  const state = nodeState(node);
  const deadline = Date.now() + RESET_CONFIRM_MS;
  state.resetConfirmUntil = deadline;
  if (state.resetConfirmTimer != null) clearTimeout(state.resetConfirmTimer);
  state.resetConfirmTimer = setTimeout(() => {
    const current = NODE_STATES.get(node);
    // Ignore stale timers from a prior workflow/configure lifecycle or from an
    // earlier confirmation arm. They must never cancel a newer confirmation.
    if (current !== state || Number(current.resetConfirmUntil) !== deadline) return;
    current.resetConfirmUntil = 0;
    current.resetConfirmTimer = null;
    refreshViewToggle(node);
    node.setDirtyCanvas?.(true, true);
  }, RESET_CONFIRM_MS + 50);
  refreshViewToggle(node);
  node.setDirtyCanvas?.(true, true);
}

function cloneResetValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
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
    Object.defineProperty(nodeType.prototype, CORE_DEFAULTS_PROPERTY, {
      value: frozenDefaults,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch (_) {
    nodeType.prototype[CORE_DEFAULTS_PROPERTY] = frozenDefaults;
  }
}

function resettableWidgetPlan(node) {
  const plan = [];
  const missing = [];
  const schemaDefaults = node?.[CORE_DEFAULTS_PROPERTY];
  for (const widget of serializedWidgetsOf(node)) {
    if (!widget) continue;
    const name = String(widget.name || "");
    let hasDefault = false;
    let defaultValue;

    // Prefer the authoritative backend node definition captured during
    // beforeRegisterNodeDef. Some ComfyUI frontends do not retain `default` on
    // each runtime widget.options object, so relying on that object alone can
    // make a confirmed reset silently abort.
    if (schemaDefaults && Object.prototype.hasOwnProperty.call(schemaDefaults, name)) {
      defaultValue = schemaDefaults[name];
      hasDefault = true;
    } else {
      // Compatibility fallback for older/custom frontends where the runtime
      // widget itself still carries the core default. This is not a hard-coded
      // reset table; it remains data supplied by the node definition.
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

function restoreResetSnapshot(node, snapshot) {
  if (!snapshot) return;
  for (const item of snapshot.widgets || []) {
    const widget = item?.widget;
    if (!widget) continue;
    widget.value = cloneResetValue(item.value);
    widget.hidden = item.hidden;
    if (widget.options && typeof widget.options === "object") {
      if (item.optionsHiddenPresent) widget.options = { ...widget.options, hidden: item.optionsHidden };
      else {
        const nextOptions = { ...widget.options };
        delete nextOptions.hidden;
        widget.options = nextOptions;
      }
    }
  }

  node.properties ??= {};
  if (snapshot.preferenceProperty === undefined) delete node.properties[PREFERENCE_PROPERTY];
  else node.properties[PREFERENCE_PROPERTY] = cloneResetValue(snapshot.preferenceProperty);
  if (snapshot.dynamicLinkMemoryProperty === undefined) delete node.properties[DYNAMIC_LINK_MEMORY_PROPERTY];
  else node.properties[DYNAMIC_LINK_MEMORY_PROPERTY] = cloneResetValue(snapshot.dynamicLinkMemoryProperty);
  restoreExtensionOptionsSnapshot(node, snapshot.extensionOptions, { locale: activeLocale });

  const transientState = NODE_STATES.get(node);
  if (transientState && transientState !== snapshot.state) {
    transientState.resizeToken = (transientState.resizeToken ?? 0) + 1;
  }

  if (snapshot.state) {
    // A failed confirmed reset consumes the confirmation click. Do not restore
    // an armed deadline without its timer, which could leave the button stuck
    // on “Confirm Reset”. All actual user preference maps remain untouched.
    snapshot.state.resetConfirmUntil = 0;
    if (snapshot.state.resetConfirmTimer != null) clearTimeout(snapshot.state.resetConfirmTimer);
    snapshot.state.resetConfirmTimer = null;
    NODE_STATES.set(node, snapshot.state);
  } else {
    NODE_STATES.delete(node);
  }

  // Restore the mirror displays without re-running normalization. A rollback
  // must put the exact pre-reset core values back, including unusual but still
  // loadable legacy values, rather than "repairing" them into a new state.
  try { installReferenceFidelityUi(node); } catch (_) {}
  try { installReferenceClothingUi(node); } catch (_) {}
  try { refreshAdvancedToggleLabels(node); } catch (_) {}
  try { refreshViewToggle(node); } catch (_) {}
  try { refreshVueWidgetMetadata(node); } catch (_) {}

  if (snapshot.size && typeof node.setSize === "function") {
    try { node.setSize([snapshot.size.width, snapshot.size.height]); } catch (_) {}
  }
  try { node.setDirtyCanvas?.(true, true); } catch (_) {}
  try { node.graph?.setDirtyCanvas?.(true, true); } catch (_) {}
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

function resetNodeSettingsToCoreDefaults(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return false;

  // Complete preflight before touching any value. Reset is all-or-nothing: if a
  // future ComfyUI/widget type does not expose the backend default, refuse the
  // operation rather than leaving one field stale or inventing a JS fallback.
  let plan;
  let missing;
  try {
    ({ plan, missing } = resettableWidgetPlan(node));
  } catch (error) {
    console.error("Ultra MiniMax H3 Prompt: reset preflight failed; no settings were changed.", error);
    clearResetConfirmation(node);
    return false;
  }
  if (!plan.length || missing.length) {
    console.warn("Ultra MiniMax H3 Prompt: reset aborted because core widget defaults were unavailable:", missing);
    clearResetConfirmation(node);
    return false;
  }

  const size = readNodeSize(node);
  const resetCoreHeight = readCoreComputedHeight(node);
  const previousState = NODE_STATES.get(node) || null;
  // Reset values and fixed rows, but preserve the user's current flexible scene
  // room.  This mirrors the stable R2V path: Core's fixed-layout delta changes
  // only the node outer height, so Reset never collapses a manually sized scene.
  const snapshot = {
    widgets: widgetsOf(node).map((widget) => ({
      widget,
      value: cloneResetValue(widget?.value),
      hidden: widget?.hidden,
      optionsHiddenPresent: Boolean(widget?.options && Object.prototype.hasOwnProperty.call(widget.options, "hidden")),
      optionsHidden: widget?.options?.hidden,
    })),
    preferenceProperty: cloneResetValue(node?.properties?.[PREFERENCE_PROPERTY]),
    dynamicLinkMemoryProperty: cloneResetValue(node?.properties?.[DYNAMIC_LINK_MEMORY_PROPERTY]),
    extensionOptions: snapshotExtensionOptions(node),
    state: previousState,
    size,
  };

  const graphChange = beginResetGraphChange(node);
  const resettableWidgetLinks = detachResettableWidgetLinksForConfirmedReset(node);
  try {
    // Direct assignment is intentional: reset all backend-backed widget values
    // as one transaction. Calling 98 callbacks in sequence would expose many
    // transient half-reset combinations to safety, count and sizing handlers.
    // Direct assignment deliberately bypasses the normal person/turn/shot
    // callbacks. Confirmed Reset has already detached every external connection
    // backed by a resettable widget (scene/person/turn/shot/etc.); native media
    // sockets are intentionally untouched. The inactive-row pass below remains
    // as a compatibility cleanup for older affected workflows.
    for (const { widget, value } of plan) widget.value = cloneResetValue(value);
    const resetCounts = readDynamicCounts(node);
    disconnectInputsInactiveAfterConfirmedReset(node, resetCounts);
    clearRememberedDynamicLinks(node);

    node.properties ??= {};
    delete node.properties[PREFERENCE_PROPERTY];
    resetExtensionOptions(node, { locale: activeLocale });
    clearGroupedSectionState(node);
    discardNodeState(node);
    const state = nodeState(node);
    state.compactView = true;
    setAllGroupedSectionsCollapsed(node, true, { refresh: false });
    persistPreferredSelections(node, state);

    // Re-run only the established bounded synchronization passes once, now that
    // every core value is already at its authoritative Python default.
    normalizeAdvancedToggleWidgets(node);
    normalizeLegacyH3OfficialCameraWidgets(node);
    syncProfileSafety(node, { resetInvalid: true });
    syncTurnStartBounds(node, { clampValues: true });
    syncShotStartTimeBounds(node);
    activeCameraShotCount(node);
    installReferenceFidelityUi(node);
    installReferenceClothingUi(node);
    refreshViewToggle(node);
    // Synchronize the final Basic View once, then apply only Core's fixed-row
    // height delta to the pre-reset node geometry.  The scene editor keeps the
    // exact room the user had, while removed advanced/dynamic rows shorten the
    // node bottom edge immediately.  Do not restore fresh-node geometry here.
    syncDynamicUI(node, { preserveSceneHeight: false });
    applyCoreLayoutDelta(node, size, resetCoreHeight);

    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    app.canvas?.setDirty?.(true, true);
    finishResetGraphChange(graphChange, node);
    return true;
  } catch (error) {
    restoreResettableWidgetLinksAfterFailedReset(node, resettableWidgetLinks);
    console.error("Ultra MiniMax H3 Prompt: settings reset failed; restoring the previous node state.", error);
    restoreResetSnapshot(node, snapshot);
    finishResetGraphChange(graphChange, node);
    return false;
  }
}

function collapseAdvancedTogglesForBasicView(node) {
  let changed = false;
  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const widget = widgetByName(node, name);
    if (!widget || !advancedToggleValue(widget.value)) continue;
    widget.value = false;
    changed = true;
  }
  return changed;
}

function expandAdvancedTogglesForFullView(node) {
  // Use the same normalized person-count contract as the grouped UI instead of
  // parsing the raw runtime combo value independently.  Some frontends expose a
  // localized/display value here; treating that as Number(...) can collapse to 0
  // and make Show All Settings change only its label without reopening details.
  const personCount = activePersonCountForGroups(node);
  const names = ["person_a_advanced", "person_b_advanced", "person_c_advanced"];
  let changed = false;
  for (let index = 0; index < personCount; index += 1) {
    const widget = widgetByName(node, names[index]);
    if (!widget || advancedToggleValue(widget.value)) continue;
    widget.value = true;
    changed = true;
  }
  if (changed) refreshAdvancedToggleLabels(node);
  return changed;
}

function toggleCompactView(node) {
  const state = nodeState(node);
  state.compactView = !state.compactView;
  // View mode changes information density only. Group ▶/▼ state stays intact.
  if (state.compactView) collapseAdvancedTogglesForBasicView(node);
  else expandAdvancedTogglesForFullView(node);
  state.layoutRevision = (state.layoutRevision ?? 0) + 1;
  persistPreferredSelections(node, state);
  clearResetConfirmation(node);
  refreshViewToggle(node);
  syncDynamicUI(node, { preserveSceneHeight: true });
}

function installActionRow(node) {
  if (!node || typeof node.addWidget !== "function") return;

  let viewWidget = widgetsOf(node).find((item) => item?.[VIEW_TOGGLE_MARKER]);
  if (!viewWidget) {
    viewWidget = node.addWidget("button", "__ultra_h3_view_toggle", null, () => toggleCompactView(node), { serialize: false });
    if (viewWidget) {
      viewWidget[VIEW_TOGGLE_MARKER] = true;
      viewWidget.serialize = false;
      viewWidget.serializeValue = () => undefined;
    }
  }

  let resetWidget = widgetsOf(node).find((item) => item?.[RESET_BUTTON_MARKER]);
  if (!resetWidget) {
    resetWidget = node.addWidget("button", "__ultra_h3_reset_button", null, () => {
      const state = nodeState(node);
      if (Number(state.resetConfirmUntil) > Date.now()) resetNodeSettingsToCoreDefaults(node);
      else armResetConfirmation(node);
    }, { serialize: false });
    if (resetWidget) {
      resetWidget[RESET_BUTTON_MARKER] = true;
      resetWidget.serialize = false;
      resetWidget.serializeValue = () => undefined;
    }
  }

  refreshViewToggle(node);
}

function installViewToggle(node) {
  installActionRow(node);
}

function leaveCompactView(node) {
  const state = nodeState(node);
  if (!state.compactView) return false;
  state.compactView = false;
  persistPreferredSelections(node, state);
  refreshViewToggle(node);
  return true;
}

function applyVisibilityPlan(node, plan) {
  let changed = false;
  for (const { widget, visible } of plan.entries) {
    changed = setWidgetVisible(widget, visible) || changed;
  }
  changed = syncTurnSpeakerChoices(node, plan.personCount, plan.turnCount) || changed;
  changed = syncCameraTargetChoices(node, plan.personCount) || changed;
  changed = syncCameraFramingChoices(node, plan.personCount) || changed;
  if (changed) refreshVueWidgetMetadata(node);
  return changed;
}

// -----------------------------------------------------------------------------
// Scene textarea preservation
// -----------------------------------------------------------------------------

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

function captureFreshResetGeometry(node) {
  if (!node || FRESH_RESET_GEOMETRY.has(node)) return;
  const size = readNodeSize(node);
  if (size == null) return;
  FRESH_RESET_GEOMETRY.set(node, { width: size.width, height: size.height });
}

function restoreFreshResetGeometry(node, width) {
  if (!Number.isFinite(width) || width <= 0 || typeof node?.setSize !== "function") return false;
  const fresh = FRESH_RESET_GEOMETRY.get(node);
  let targetHeight = Number(fresh?.height);
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) {
    // A loaded legacy workflow may not have received nodeCreated in this
    // frontend session. Never treat its current expanded height as a reset
    // baseline; fall back to core fresh sizing instead.
    const coreHeight = readCoreComputedHeight(node);
    if (coreHeight == null) return false;
    targetHeight = coreHeight + 0;
  }
  node.setSize([width, targetHeight]);
  node.setDirtyCanvas?.(true, true);
  return true;
}

function nextFrame(callback) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function afterVueLayout(callback) {
  // One frame lets Vue commit visibility; the next lets its shared DOM
  // ResizeObserver publish the resulting node geometry.
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

  // Let ComfyUI/LiteGraph tell us how much the fixed widget layout changed.
  // Applying that delta to the already user-sized node preserves the flexible
  // multiline scene area without waiting for it to collapse and repairing it
  // afterwards. This is deliberately additive: manual node/textarea sizing is
  // retained, while only the newly shown/hidden rows change the node bottom.
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
      // Compatibility fallback only. In the normal path applyCoreLayoutDelta()
      // keeps the scene height stable before Vue paints, so this does nothing.
      // Never chase ResizeObserver feedback with a second correction.
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

  // Connecting a multiline STRING can temporarily replace its textarea with a
  // socket row. The user's node/scene size is still authoritative. Preserve the
  // exact pre-connection geometry once Vue has committed instead of deriving it
  // from a textarea that may not exist while linked. This also respects a manual
  // resize performed while the scene prompt is externally connected.
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


// -----------------------------------------------------------------------------
// Read-only grouped visibility layer
// -----------------------------------------------------------------------------

function groupWidgetNames(prefix, fields) {
  return fields.map((field) => `${prefix}${field}`);
}

function activePersonCountForGroups(node) {
  return Math.max(1, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1) || 1));
}

function activeTurnCountForGroups(node) {
  return Math.max(1, Math.min(MAX_TURNS, Number(widgetByName(node, "turn_count")?.value ?? 1) || 1));
}

function activeShotCountForGroups(node) {
  if (!Boolean(widgetByName(node, "camera_sequence_enabled")?.value)) return 1;
  return Math.max(2, Math.min(MAX_CAMERA_SHOTS, Number(widgetByName(node, "camera_shot_count")?.value ?? activeCameraShotCount(node)) || 2));
}

function mainGroupedSections(node) {
  const groups = [
    {
      id: "basic",
      kind: "basic",
      title: { ko: "기본 설정", en: "Basic Settings" },
      children: (target) => [
        widgetByName(target, "scene_translate"),
        translationApiWidget(target),
        ...["mode", "duration_seconds"].map((name) => widgetByName(target, name)),
        ...sceneBaselineWidgetNames().map((name) => widgetByName(target, name)),
        ...["visual_style", "reference_fidelity", "i2va_preserve_reference_clothing"].map((name) => widgetByName(target, name)),
        ...sequentialNarratorWidgetNames().map((name) => widgetByName(target, name)),
        ...widgetsOf(target).filter((widget) => widget?.[REFERENCE_FIDELITY_UI_MARKER] || widget?.[REFERENCE_CLOTHING_UI_MARKER] || widget?.[BASIC_COUNT_UI_MARKER]),
      ],
      branchlessChildren: () => sequentialNarratorWidgetNames(),
      summary: (target, locale) => {
        const duration = normalizeWholeSecondDuration(widgetByName(target, "duration_seconds")?.value, 5, 30);
        const people = activePersonCountForGroups(target);
        const turns = activeTurnCountForGroups(target);
        const parts = [
          locale === "ko"
            ? `${duration}초 · 인물 ${people} · 진행 ${turns}`
            : `${duration}s · ${people} person${people === 1 ? "" : "s"} · ${turns} progress`,
        ];
        if (duration > 15) {
          parts.push(locale === "ko" ? "⚠ 공식 H3 범위 초과" : "⚠ above official H3 range");
        }
        return parts.join(" · ");
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
        const shots = activeShotCountForGroups(target);
        const rawMotion = String(widgetByName(target, "camera_motion")?.value ?? "auto");
        const parts = [locale === "ko" ? `컷 ${shots}` : `${shots} shot${shots === 1 ? "" : "s"}`];
        if (rawMotion !== "auto" && rawMotion !== "none") parts.push(optionLabel(target, "camera_motion", rawMotion));
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
        if (rawSound !== "auto") parts.push(optionLabel(target, "soundscape_mode", rawSound));
        if (rawMusic !== "none") parts.push(optionLabel(target, "music_mode", rawMusic));
        return parts.join(" · ");
      },
      active: true,
    },
  ];


  const personBasicFields = ["gender", "age", "advanced"];
  const personAdvancedFields = ["appearance_preset", "appearance_desc", "clothing_preset", "clothing_desc", "voice_desc"];
  for (let index = 1; index <= 3; index += 1) {
    const slot = ["a", "b", "c"][index - 1];
    const personKey = slot.toUpperCase();
    groups.push({
      id: `person_${index}`,
      kind: "person",
      title: { ko: `인물 ${index}`, en: `Person ${index}` },
      children: [
        ...groupWidgetNames(`person_${slot}_`, personBasicFields),
        ...extensionWidgetNamesForPerson(personKey),
        ...groupWidgetNames(`person_${slot}_`, personAdvancedFields),
      ],
      subgroups: () => [{
        id: `person_${index}_advanced_branch`,
        anchor: `person_${slot}_advanced`,
        children: [
          ...extensionWidgetNamesForPerson(personKey),
          ...groupWidgetNames(`person_${slot}_`, personAdvancedFields),
        ],
      }],
      // Basic View keeps every active person group, while visibility inside the
      // group is reduced to identity essentials by buildVisibilityPlan().
      active: (target) => index <= activePersonCountForGroups(target),
      summary: (target) => {
        const rawGender = String(widgetByName(target, `person_${slot}_gender`)?.value ?? "unspecified");
        const rawAge = String(widgetByName(target, `person_${slot}_age`)?.value ?? "unspecified");
        const parts = [];
        if (rawGender !== "unspecified") parts.push(optionLabel(target, `person_${slot}_gender`, rawGender));
        if (rawAge !== "unspecified") parts.push(optionLabel(target, `person_${slot}_age`, rawAge));
        return parts.join(" · ");
      },
    });
  }

  for (let index = 1; index <= MAX_TURNS; index += 1) {
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
      // Basic View keeps every active progress group; only its core four rows remain visible.
      active: (target) => index <= activeTurnCountForGroups(target),
      summary: (target, locale) => {
        const speaker = optionLabel(target, `turn_${index}_speaker`, widgetByName(target, `turn_${index}_speaker`)?.value ?? "A");
        const seconds = Number(widgetByName(target, `turn_${index}_elapsed_seconds`)?.value ?? 0) || 0;
        return locale === "ko" ? `${speaker} · ${seconds.toFixed(1)}초` : `${speaker} · ${seconds.toFixed(1)}s`;
      },
    });
  }
  return groups;
}


function createReliableCountMirror(node, text, initialValue, spec, onValue) {
  if (!node) return null;
  const stableName = `__ultra_h3_count_${spec.key}`;
  const clamp = (value) => {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return null;
    return Math.max(spec.min, Math.min(spec.max, numeric));
  };
  let mirror = null;
  const commit = (value) => {
    const next = clamp(value);
    if (next == null) return;
    // Count changes add/remove fixed rows. Capture the user's scene editing
    // height before changing the backend value so the existing bounded scene
    // preservation path can keep that flexible area authoritative.
    const sceneHeightBeforeCommit = spec.preserveSceneHeight
      ? (readSceneHeight(node) ?? nodeState(node).lastSceneHeight)
      : null;
    if (mirror) mirror.value = next;
    onValue(next);
    if (Number.isFinite(sceneHeightBeforeCommit) && sceneHeightBeforeCommit > 0) {
      preserveSceneHeight(node, sceneHeightBeforeCommit);
    }
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

function basicCountUiText(node, storage, key) {
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

function basicCountMirror(node, key) {
  return widgetsOf(node).find((widget) => widget?.[BASIC_COUNT_UI_MARKER] === key) || null;
}

function installMainBasicCountMirrors(node) {
  if (!node || (typeof node.addCustomWidget !== "function" && typeof node.addWidget !== "function")) return false;
  const widgets = widgetsOf(node);
  const visualStyleWidget = widgetByName(node, "visual_style");
  if (!visualStyleWidget) return false;

  let changed = false;
  const specs = [
    { key: "person_count", min: 1, max: 3 },
    { key: "turn_count", min: 1, max: MAX_TURNS },
  ];
  for (const spec of specs) {
    const storage = widgetByName(node, spec.key);
    if (!storage) continue;
    let mirror = basicCountMirror(node, spec.key);
    const text = basicCountUiText(node, storage, spec.key);
    if (!mirror) {
      mirror = createReliableCountMirror(node, text, Number(storage.value ?? spec.min), spec, (next) => {
        storage.value = next;
        if (typeof storage.callback === "function") storage.callback.call(storage, next);
      });
      if (!mirror) continue;
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
  }

  const clothingMirror = widgets.find((item) => item?.[REFERENCE_CLOTHING_UI_MARKER]);
  const fidelityMirror = widgets.find((item) => item?.[REFERENCE_FIDELITY_UI_MARKER]);
  const mirrors = specs.map((spec) => basicCountMirror(node, spec.key)).filter(Boolean);
  const next = widgets.filter((widget) => !mirrors.includes(widget));
  const anchor = clothingMirror || fidelityMirror || visualStyleWidget;
  const anchorIndex = next.indexOf(anchor);
  if (anchorIndex >= 0) next.splice(anchorIndex + 1, 0, ...mirrors);
  const orderChanged = next.length !== widgets.length || next.some((widget, index) => widget !== widgets[index]);
  if (orderChanged) {
    widgets.splice(0, widgets.length, ...next);
    changed = true;
  }
  return changed;
}

function arrangeMainBasicWidgets(node) {
  // Never move real backend widgets for display purposes: ComfyUI queues their
  // values positionally.  Non-serialized mirrors keep the visible Basic Settings
  // layout while person_count/turn_count stay in their original schema order.
  return withBatchedWidgetMutations(node, () => installMainBasicCountMirrors(node));
}

function installMainGroupedSections(node) {
  if (!GROUPED_SECTIONS_INSTALLED.has(node)) {
    return withBatchedWidgetMutations(node, () => installMainGroupedSectionsNow(node));
  }
  return installMainGroupedSectionsNow(node);
}

function installMainGroupedSectionsNow(node) {
  // Do this before header placement so Basic Settings is one contiguous block
  // on screen, matching R2V and the collapse semantics.
  arrangeMainBasicWidgets(node);
  for (const widget of widgetsOf(node)) {
    try { widget.__ultraGroupedNode = node; } catch (_) {}
  }
  if (GROUPED_SECTIONS_INSTALLED.has(node)) return;
  GROUPED_SECTIONS_INSTALLED.add(node);
  configureGroupedSections(node, {
    locale: activeLocale,
    groups: mainGroupedSections,
    resync: (target) => syncDynamicUI(target, { preserveSceneHeight: true }),
    refreshMetadata: refreshVueWidgetMetadata,
  });
}

// Lazily materialized rows (extension options, sequential-vocal rows) and
// layout reordering each commit their own widget batch. Wrap the whole
// visibility transaction so one interaction re-registers the widget array
// at most once on frontend 1.53 (nested batches just run their callback).
function syncDynamicUI(node, options = {}) {
  return withBatchedWidgetMutations(node, () => syncDynamicUIUnbatched(node, options));
}

function syncDynamicUIUnbatched(node, { preserveSceneHeight: preserve = false, forceCoreLayoutDelta = false } = {}) {
  if (!node || node.comfyClass !== NODE_CLASS) return;

  const state = nodeState(node);
  const measuredSceneHeight = preserve ? readSceneHeight(node) : null;
  const sceneHeight = preserve
    ? (state.pendingSceneHeight ?? measuredSceneHeight ?? state.lastSceneHeight)
    : null;
  const beforeSize = preserve ? readNodeSize(node) : null;
  const beforeComputedHeight = preserve ? readCoreComputedHeight(node) : null;

  const locale = activeLocale(node);
  if (state.lastStaticUiLocale !== locale) {
    refreshAdvancedToggleLabels(node);
    refreshCameraFramingLabels(node);
    refreshTranslationApiUi(node, { locale });
    refreshExtensionOptions(node, { locale });
    state.lastStaticUiLocale = locale;
  }
  const extensionPersonCapacity = activePersonCountForGroups(node);
  const extensionTurnCapacity = activeTurnCountForGroups(node);
  if (extensionPersonCapacity > Number(state.extensionPersonCapacity || 0)
    || extensionTurnCapacity > Number(state.extensionTurnCapacity || 0)) {
    withBatchedWidgetMutations(node, () => installExtensionOptions(node, {
      locale: activeLocale,
      refreshMetadata: refreshVueWidgetMetadata,
    }));
    state.extensionPersonCapacity = Math.max(Number(state.extensionPersonCapacity || 0), extensionPersonCapacity);
    state.extensionTurnCapacity = Math.max(Number(state.extensionTurnCapacity || 0), extensionTurnCapacity);
  }
  installReferenceFidelityUi(node);
  installReferenceClothingUi(node);
  installMainGroupedSections(node);
  // Lazy sequential-vocal rows must exist before grouped-section membership
  // and indentation are refreshed for this same interaction.
  withBatchedWidgetMutations(node, () => refreshSequentialVocalLabels(node, {
    turnCount: Number(widgetByName(node, "turn_count")?.value ?? 1),
  }));
  // Refresh after the two display-only reference mirrors exist so grouped
  // visibility never misses a newly created current-locale or lazy vocal row.
  for (const widget of widgetsOf(node)) {
    try { widget.__ultraGroupedNode = node; } catch (_) {}
  }
  refreshGroupedSections(node, { redraw: false });
  const plan = buildVisibilityPlan(node);
  const changed = applyVisibilityPlan(node, plan);

  if ((changed || forceCoreLayoutDelta) && preserve) {
    // Preserve the user's manually sized flexible scene area even when a linked
    // scene_prompt temporarily has no measurable textarea. The core layout delta
    // is sufficient for that case; DOM height verification is only needed when
    // the textarea is actually present.
    // turn_count can activate/deactivate only a collapsed Progress header. That
    // header changes Core's computed fixed-row height but is not part of the
    // visibility plan, so force the same delta path that person_count reaches
    // naturally through its speaker/camera option updates.
    applyCoreLayoutDelta(node, beforeSize, beforeComputedHeight);
    if (!isVueNodesEnabled() && typeof node.arrange === "function") {
      try { node.arrange(); } catch (_) {}
    }
    if (sceneHeight != null) preserveSceneHeight(node, sceneHeight);
  } else if (changed && !isVueNodesEnabled() && typeof node.arrange === "function") {
    // Legacy Canvas only. Vue Nodes owns its geometry through DOM measurement.
    try { node.arrange(); } catch (_) {}
  }

  refreshGroupedSections(node, { redraw: false });
  node.setDirtyCanvas?.(true, true);
}

function incomingCallbackValue(widget, args) {
  return args.length > 0 && args[0] !== undefined ? args[0] : widget?.value;
}

function normalizeWholeSecondDuration(value, fallback = 5, maximum = 30) {
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

function normalizeTurnFieldCallbackValue(field, value) {
  if (field === "elapsed_seconds") return snapHalfSecond(value, 0.0);
  return value ?? TURN_DRAFT_DEFAULTS[field];
}

function installDynamicCallbacks(node) {
  if (!node || node.comfyClass !== NODE_CLASS) return;

  for (const name of ["person_count", "turn_count", "camera_sequence_enabled"]) {
    const widget = widgetByName(node, name);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;

    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const state = nodeState(node);
      const previousCounts = state.lastDynamicCounts ? { ...state.lastDynamicCounts } : readDynamicCounts(node);
      const incomingRaw = incomingCallbackValue(widget, args);
      if (name === "camera_sequence_enabled") {
        widget.value = Boolean(incomingRaw);
        if (widget.value) {
          const shot2 = widgetByName(node, "camera_shot_2_enabled");
          if (shot2) shot2.value = true;
        }
      } else {
        const incoming = Number(incomingRaw);
        if (Number.isFinite(incoming)) widget.value = incoming;
      }
      const nextCounts = readDynamicCounts(node);
      syncRememberedInputsForDynamicChange(node, previousCounts, nextCounts);
      state.lastDynamicCounts = { ...nextCounts };
      // A previously hidden Progress row can become active again after duration
      // was shortened. Normalize only the now-active rows immediately so the
      // visible widget, summary, Queue value, backend value, and final prompt
      // stay on the same 0.5-second timeline. Inactive rows remain remembered.
      if (name === "turn_count") syncTurnStartBounds(node, { clampValues: true });
      // Person/Timeline counts and the master multi-shot switch are structural
      // Basic-View controls. Enabling multi-shot must not force Full View; only
      // Shot 2-6 detail editing remains there.

      syncProfileSafety(node, { resetInvalid: true });
      syncShotStartTimeBounds(node);
      state.layoutRevision = (state.layoutRevision ?? 0) + 1;
      syncDynamicUI(node, {
        preserveSceneHeight: true,
        forceCoreLayoutDelta: name === "turn_count",
      });
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (let shot = 2; shot <= MAX_CAMERA_SHOTS; shot++) {
    for (const suffix of ["enabled", "start_seconds"]) {
      const name = `camera_shot_${shot}_${suffix}`;
      const widget = widgetByName(node, name);
      if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;
      const originalCallback = widget.callback;
      widget.callback = function (...args) {
        const result = typeof originalCallback === "function" ? originalCallback.apply(this, args) : undefined;
        if (suffix === "enabled") widget.value = Boolean(incomingCallbackValue(widget, args));
        else { const value = Number(incomingCallbackValue(widget, args)); if (Number.isFinite(value)) widget.value = Math.round(value * 2) / 2; }
        syncShotStartTimeBounds(node);
        activeCameraShotCount(node);
        // Shot structure/start time are Basic-View controls. Keep the selected
        // view stable while the next Shot row expands or collapses.
        nodeState(node).layoutRevision = (nodeState(node).layoutRevision ?? 0) + 1;
        syncDynamicUI(node, { preserveSceneHeight: true });
        return result;
      };
      DYNAMIC_CALLBACK_WIDGETS.add(widget);
    }
  }

  for (const name of ["person_a_advanced", "person_b_advanced", "person_c_advanced"]) {
    const widget = widgetByName(node, name);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;

    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const incoming = advancedToggleValue(incomingCallbackValue(widget, args));
      if (widget.value !== incoming) widget.value = incoming;
      leaveCompactView(node);
      nodeState(node).layoutRevision = (nodeState(node).layoutRevision ?? 0) + 1;
      syncDynamicUI(node, { preserveSceneHeight: true });
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (const slot of ["a", "b", "c"]) {
    for (const suffix of ["age", "appearance_preset", "clothing_preset"]) {
      const name = `person_${slot}_${suffix}`;
      const widget = widgetByName(node, name);
      if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;
      const originalCallback = widget.callback;
      widget.callback = function (...args) {
        const result = typeof originalCallback === "function"
          ? originalCallback.apply(this, args)
          : undefined;
        const incoming = canonicalValue(widget.name, incomingCallbackValue(widget, args));
        if (widget.value !== incoming) widget.value = incoming;
        if (suffix !== "age") {
          const state = nodeState(node);
          if (!state.programmaticProfilePresetWrites.has(name)) {
            state.preferredProfilePresets.set(name, incoming || "none");
            persistPreferredSelections(node, state);
          }
        }
        syncProfileSafety(node, { resetInvalid: true });
        if (suffix === "age") {
          refreshGroupedSections(node, { redraw: false });
          node.setDirtyCanvas?.(true, true);
        }
        return result;
      };
      DYNAMIC_CALLBACK_WIDGETS.add(widget);
    }
  }

  const modeWidget = widgetByName(node, "mode");
  if (modeWidget && !DYNAMIC_CALLBACK_WIDGETS.has(modeWidget)) {
    const originalCallback = modeWidget.callback;
    modeWidget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const nextMode = canonicalValue(modeWidget.name, incomingCallbackValue(modeWidget, args)) || "auto";
      if (modeWidget.value !== nextMode) modeWidget.value = nextMode;
      // Input mode is part of the Basic-View workflow. Keep the selected view
      // mode stable while the mode-specific rows resynchronize.
      nodeState(node).layoutRevision = (nodeState(node).layoutRevision ?? 0) + 1;
      syncDynamicUI(node, { preserveSceneHeight: true });
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(modeWidget);
  }

  const sceneTranslateWidget = widgetByName(node, "scene_translate");
  if (sceneTranslateWidget && !DYNAMIC_CALLBACK_WIDGETS.has(sceneTranslateWidget)) {
    const originalCallback = sceneTranslateWidget.callback;
    sceneTranslateWidget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const incoming = canonicalValue("scene_translate", incomingCallbackValue(sceneTranslateWidget, args)) || "off";
      if (sceneTranslateWidget.value !== incoming) sceneTranslateWidget.value = incoming;
      // Translation is a node-wide master switch. Keep the API-settings row in
      // the same Basic group, but remove it completely when translation is off.
      // Reuse the established scene-preserving visibility transaction so group
      // separators, node height, Vue/Legacy geometry and socket guards stay owned
      // by the existing layout system.
      queueMicrotask(() => syncDynamicUI(node, { preserveSceneHeight: true }));
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(sceneTranslateWidget);
  }

  const durationWidget = widgetByName(node, "duration_seconds");
  if (durationWidget && !DYNAMIC_CALLBACK_WIDGETS.has(durationWidget)) {
    const originalCallback = durationWidget.callback;
    durationWidget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      durationWidget.value = normalizeWholeSecondDuration(
        incomingCallbackValue(durationWidget, args), durationWidget.value, 30
      );
      syncTurnStartBounds(node, { clampValues: true });
      syncShotStartTimeBounds(node);
      refreshGroupedSections(node, { redraw: false });
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(durationWidget);
  }

  for (let index = 1; index <= MAX_CAMERA_SHOTS; index++) {
    const widget = widgetByName(node, `camera_shot_${index}_target`);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;

    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const nextTarget = canonicalValue(widget.name, incomingCallbackValue(widget, args)) || "current_action";
      if (widget.value !== nextTarget) widget.value = nextTarget;
      const state = nodeState(node);
      if (!state.programmaticCameraTargetWrites.has(index)) {
        state.preferredCameraTargets.set(index, nextTarget);
        state.autoFallbackCameraTargets.delete(index);
        persistPreferredSelections(node, state);
      }
      // A-mode keeps the framing row visible at all times. Target changes only
      // alter which framing values are valid, so avoid a full dynamic-layout
      // rebuild here. This preserves unrelated widget state and reduces resize/
      // synchronization work on every camera-target edit.
      const personCount = Math.max(1, Math.min(3, Number(widgetByName(node, "person_count")?.value ?? 1)));
      syncCameraFramingChoices(node, personCount);
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (let index = 1; index <= MAX_CAMERA_SHOTS; index++) {
    const widget = widgetByName(node, `camera_shot_${index}_framing`);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;

    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const nextFraming = canonicalValue(widget.name, incomingCallbackValue(widget, args)) || "auto";
      if (widget.value !== nextFraming) widget.value = nextFraming;
      const state = nodeState(node);
      if (!state.programmaticCameraFramingWrites.has(index)) {
        state.preferredCameraFramings.set(index, nextFraming);
        state.autoFallbackCameraFramings.delete(index);
        persistPreferredSelections(node, state);
      }
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (let index = 1; index <= MAX_TURNS; index++) {
    const widget = widgetByName(node, `turn_${index}_speaker`);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;

    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      const nextSpeaker = canonicalValue(widget.name, incomingCallbackValue(widget, args)) || "A";
      if (widget.value !== nextSpeaker) widget.value = nextSpeaker;
      const state = nodeState(node);
      if (!state.programmaticTurnSpeakerWrites.has(index)) {
        state.preferredTurnSpeakers.set(index, nextSpeaker);
        state.autoFallbackTurnSpeakers.delete(index);
        persistPreferredSelections(node, state);
      }
      refreshGroupedSections(node, { redraw: false });
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (let index = 1; index <= MAX_TURNS; index++) {
    for (const field of TURN_DRAFT_FIELDS) {
      const widget = widgetByName(node, `turn_${index}_${field}`);
      if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;
      const originalCallback = widget.callback;
      widget.callback = function (...args) {
        const result = typeof originalCallback === "function"
          ? originalCallback.apply(this, args)
          : undefined;
        widget.value = normalizeTurnFieldCallbackValue(field, incomingCallbackValue(widget, args));
        if (field === "elapsed_seconds") {
          syncTurnStartBounds(node, { clampValues: true });
          refreshGroupedSections(node, { redraw: false });
          node.setDirtyCanvas?.(true, true);
        }
        return result;
      };
      DYNAMIC_CALLBACK_WIDGETS.add(widget);
    }
  }

  // Camera motion and gender affect collapsed summaries only. Sound/music mode
  // can also reveal a required custom-text row in Basic View, so those selectors
  // use the proven scene-preserving visibility transaction below.
  for (const name of [
    "camera_motion",
    "person_a_gender", "person_b_gender", "person_c_gender",
  ]) {
    const widget = widgetByName(node, name);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;
    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      refreshGroupedSections(node, { redraw: false });
      node.setDirtyCanvas?.(true, true);
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }

  for (const name of ["soundscape_mode", "music_mode"]) {
    const widget = widgetByName(node, name);
    if (!widget || DYNAMIC_CALLBACK_WIDGETS.has(widget)) continue;
    const originalCallback = widget.callback;
    widget.callback = function (...args) {
      const result = typeof originalCallback === "function"
        ? originalCallback.apply(this, args)
        : undefined;
      // Custom-only selections need their required text field immediately in
      // Basic View. Reuse the established scene-preserving visibility path so
      // the user's scene editor height is not recalculated or squeezed.
      queueMicrotask(() => syncDynamicUI(node, { preserveSceneHeight: true }));
      return result;
    };
    DYNAMIC_CALLBACK_WIDGETS.add(widget);
  }
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

function prepareSerializedInfoBeforeConfigure(node, info) {
  if (!info || typeof info !== "object") return;
  migrateFailedNativeSequentialWorkflow(node, info, { kind: "main" });
  migrateSequentialCoreTextSchema(node, info, { kind: "main" });
  collapseLegacyUiOnlySparseValues(node, info);
  collapseLegacyExtensionOptionSparseValues(node, info);
  migrateV350ShotCameraModifierSerializedValues(node, info);
  migrateLegacyCameraSerializedValues(node, info);
  migrateV20ReferenceClothingSerializedValue(node, info);
  migrateLegacyCameraFramingSerializedValues(node, info);
  migrateLegacyH3OfficialCameraSerializedValues(node, info);
  normalizeLegacyAdvancedSerializedValues(node, info);
}

function installPersistenceLifecycleGuards(nodeType) {
  if (!nodeType?.prototype || nodeType.prototype[PERSISTENCE_GUARD_MARKER]) return;

  const originalConfigure = nodeType.prototype.configure;
  if (typeof originalConfigure === "function") {
    nodeType.prototype.configure = function (info) {
      const args = arguments;
      return withBatchedWidgetMutations(this, () => {
        const detached = detachUiOnlyWidgets(this);
        try {
          captureSerializedWorkflowGeometry(this, info);
          prepareSerializedInfoBeforeConfigure(this, info);
          return originalConfigure.apply(this, args);
        } finally {
          restoreUiOnlyWidgets(this, detached);
        }
      });
    };
  }

  const originalSerialize = nodeType.prototype.serialize;
  if (typeof originalSerialize === "function") {
    nodeType.prototype.serialize = function (...args) {
      return withBatchedWidgetMutations(this, () => {
        const detached = detachUiOnlyWidgets(this);
        try {
          return originalSerialize.apply(this, args);
        } finally {
          restoreUiOnlyWidgets(this, detached);
        }
      });
    };
  }

  nodeType.prototype[PERSISTENCE_GUARD_MARKER] = true;
}


const STRUCTURAL_LOCAL_ONLY_INPUTS = new Set([
  "mode",
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

function initializeNode(node, { captureInitialSceneHeight = true } = {}) {
  installHiddenWidgetSlotRenderGuard(node);
  installStructuralInputConnectionGuard(node);
  if (!node || node.comfyClass !== NODE_CLASS) return;
  normalizeAdvancedToggleWidgets(node);
  const durationWidget = widgetByName(node, "duration_seconds");
  if (durationWidget) durationWidget.value = normalizeWholeSecondDuration(durationWidget.value, 5, 30);
  const state = nodeState(node);
  if (state.compactView) collapseAdvancedTogglesForBasicView(node);
  state.lastDynamicCounts = { ...readDynamicCounts(node) };
  if (captureInitialSceneHeight) {
    const initialSceneHeight = readSceneHeight(node);
    if (initialSceneHeight != null) state.lastSceneHeight = initialSceneHeight;
  }
  normalizeLegacyH3OfficialCameraWidgets(node);
  installLocalizedComboDisplay(node);
  refreshAdvancedToggleLabels(node);
  refreshCameraFramingLabels(node);
  installScenePromptHelp(node);
  installNativeSceneValidationGate(node);
  installTransientUiLocale(node);
  withBatchedWidgetMutations(node, () => {
    installTranslationApiUi(node, { locale: activeLocale(node) });
    installExtensionTransport(node);
    installExtensionOptions(node, { locale: activeLocale, refreshMetadata: refreshVueWidgetMetadata });
  });
  state.extensionPersonCapacity = activePersonCountForGroups(node);
  state.extensionTurnCapacity = activeTurnCountForGroups(node);
  withBatchedWidgetMutations(node, () => installSequentialVocalUi(node, {
    locale: activeLocale,
    onChange: (target) => syncDynamicUI(target, { preserveSceneHeight: true }),
  }));
  state.lastStaticUiLocale = activeLocale(node);
  installDynamicCallbacks(node);
  withBatchedWidgetMutations(node, () => {
    installReferenceFidelityUi(node);
    installReferenceClothingUi(node);
  });
  installReferenceConnectionWatcher(node);
  installViewToggle(node);
  syncProfileSafety(node, { resetInvalid: true });
  syncTurnStartBounds(node, { clampValues: true });
  syncShotStartTimeBounds(node);
  // Workflow loading keeps the serialized/manual node size. Visibility is
  // synchronized here; scene preservation starts with an actual user change.
  syncDynamicUI(node, { preserveSceneHeight: false });
  installConnectedStringTooltips(node, { inputIndex: widgetInputIndex, inputConnected: widgetInputConnected, locale: activeLocale });
  installCoreWidgetHoverTooltips(node, { locale: activeLocale });
  installValidationBadge(node, {
    isActive: (target) => nativeSceneValidationGateValue(target) === "missing",
    message: nativeSceneValidationBadgeText,
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
  name: "UltraMiniMaxH3Prompt.DynamicUI",
  beforeConfigureGraph() {
    GRAPH_CONFIGURE_DEPTH += 1;
  },
  afterConfigureGraph() {
    GRAPH_CONFIGURE_DEPTH = Math.max(0, GRAPH_CONFIGURE_DEPTH - 1);
  },
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE_CLASS) return;
    safelyRunUiPhase("beforeRegisterNodeDef", nodeData, () => {
      installProfileSafetyNodeData(nodeType, nodeData);
      installCoreWidgetDefaultsNodeData(nodeType, nodeData);
      localizeScenePromptNodeData(nodeData);
      installPersistenceLifecycleGuards(nodeType);
    });
  },
  nodeCreated(node) {
    if (!isUltraH3OwnNode(node)) return;
    safelyRunUiPhase("nodeCreated", node, () => {
      const loadingGraph = GRAPH_CONFIGURE_DEPTH > 0;
      // During workflow loading the serialized properties/widgets have not all
      // been restored yet. Building grouped visibility here would paint one
      // temporary expanded layout and then rebuild it again in loadedGraphNode,
      // which makes the node visibly jump. Defer the full UI pass until the
      // authoritative serialized state is available. Keep only the slot render
      // guard active during this transient phase.
      if (loadingGraph) {
        installHiddenWidgetSlotRenderGuard(node);
        return;
      }
      const state = nodeState(node);
      state.compactView = true;
      persistPreferredSelections(node, state);
      initializeNode(node);
      setAllGroupedSectionsCollapsed(node, true, { refresh: false });
      syncDynamicUI(node, { preserveSceneHeight: false });
      applyFreshSceneCoreGeometry(node);
      captureFreshResetGeometry(node);
    });
  },
  loadedGraphNode(node) {
    if (!isUltraH3OwnNode(node)) return;
    // Workflow properties and serialized widget values are authoritative here.
    // Perform exactly one full grouped-visibility pass. Do not capture the DOM
    // scene height before that pass because Vue may still expose a transient
    // flex height while the serialized node is being attached.
    safelyRunUiPhase("loadedGraphNode", node, () => {
      discardNodeState(node);
      // One widget-array commit per loaded node (see R2V loadedGraphNode).
      withBatchedWidgetMutations(node, () => initializeNode(node, { captureInitialSceneHeight: false }));
      restoreSerializedWorkflowGeometry(node);
    });
  },
});
