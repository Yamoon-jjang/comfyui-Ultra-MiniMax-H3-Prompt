// Shared UI-only Extension Options framework for Ultra MiniMax H3 nodes.
//
// Design contract:
// - Existing backend positional widget order stays untouched.
// - Extension controls are UI-only and persist in node.properties by stable IDs.
// - One hidden runtime transport widget serializes the scoped option state only
//   when graphToPrompt queues the node; it is never written to widgets_values.
// - Unknown future scopes/keys in node.properties are preserved by the frontend
//   and safely ignored by older backend compilers.

export const EXTENSION_OPTIONS_PROPERTY = "ultraH3ExtensionOptions";
export const EXTENSION_OPTIONS_TRANSPORT = "ultra_extension_options_json";
export const EXTENSION_WIDGET_MARKER = Symbol.for("ultraH3.extensionOptionWidget");
const GROUP_INDENT = Symbol.for("ultraH3.groupedSectionIndent");
const SELF_INDENTED_WIDGET = Symbol.for("ultraH3.selfIndentedWidget");

const EXTENSION_VERSION = 2;
const PERSON_SLOTS = Object.freeze(["A", "B", "C"]);

const SCENE_LOCATION_VALUES = Object.freeze([
  "modern_city_street",
  "busy_crosswalk",
  "neon_district",
  "narrow_urban_alley",
  "old_european_street",
  "seoul_downtown",
  "paris_boulevard",
  "new_york_avenue",
  "tokyo_neon_street",
  "city_square",
  "riverside_promenade",
  "pedestrian_bridge",
  "traffic_intersection",
  "city_rooftop",
  "crowded_night_market",
  "busy_street_market",
  "festival_plaza",
  "amusement_park",
  "stadium_concourse",
  "packed_subway_car",
  "busy_subway_platform",
  "busy_train_station",
  "moving_train_interior",
  "busy_airport_terminal",
  "busy_bus_terminal",
  "underground_parking",
  "road_tunnel",
  "harbor_pier",
  "modern_cafe",
  "cozy_cafe",
  "rooftop_cafe",
  "lively_restaurant",
  "hotel_lobby",
  "busy_shopping_mall",
  "art_gallery",
  "modern_office",
  "industrial_warehouse",
  "active_factory_floor",
  "busy_kitchen",
  "greenhouse",
  "open_beach",
  "rough_wave_seashore",
  "rocky_coast",
  "tropical_shore",
  "dense_forest",
  "pine_forest",
  "bamboo_forest",
  "open_meadow",
  "flower_field",
  "lakeside",
  "riverbank",
  "mountain_valley",
  "mountain_ridge",
  "waterfall",
  "canyon",
  "desert_dunes",
  "rocky_desert",
  "snowfield",
  "glacier",
  "construction_site",
  "wind_turbine_field",
  "futuristic_city",
  "space_station",
  "ancient_ruins",
  "fantasy_forest"
]);

const WEATHER_VALUES = Object.freeze([
  "clear",
  "partly_cloudy",
  "overcast",
  "light_drizzle",
  "light_rain",
  "steady_rain",
  "heavy_rain",
  "wind_driven_rain",
  "torrential_rain",
  "thunderstorm",
  "severe_thunderstorm",
  "light_snow",
  "steady_snow",
  "heavy_snow",
  "blizzard",
  "light_breeze",
  "steady_wind",
  "strong_wind",
  "violent_gusts",
  "light_fog",
  "dense_fog",
  "low_mist",
  "dusty_wind",
  "sandstorm",
  "hailstorm"
]);

const TURN_KEEP_VALUE = "keep";
const TURN_RESET_VALUE = "reset_to_baseline";

const ETHNIC_APPEARANCE_VALUES = Object.freeze([
  "none",
  "korean",
  "east_asian",
  "southeast_asian",
  "south_asian",
  "central_asian",
  "west_asian_middle_eastern",
  "european",
  "african",
  "latin_american",
  "mixed_heritage",
]);

const DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "ethnic_appearance",
    scope: "person.profile",
    promptTarget: "appearance",
    order: 10,
    defaultValue: "none",
    values: ETHNIC_APPEARANCE_VALUES,
    labels: Object.freeze({
      en: Object.freeze({
        none: "Unspecified",
        korean: "Korean appearance",
        east_asian: "East Asian appearance",
        southeast_asian: "Southeast Asian appearance",
        south_asian: "South Asian appearance",
        central_asian: "Central Asian appearance",
        west_asian_middle_eastern: "West Asian / Middle Eastern appearance",
        european: "European appearance",
        african: "African appearance",
        latin_american: "Latin American appearance",
        mixed_heritage: "Mixed-heritage appearance",
      }),
      ko: Object.freeze({
        none: "지정 안 함",
        korean: "한국인 외형",
        east_asian: "동아시아계 외형",
        southeast_asian: "동남아시아계 외형",
        south_asian: "남아시아계 외형",
        central_asian: "중앙아시아계 외형",
        west_asian_middle_eastern: "중동·서아시아계 외형",
        european: "유럽계 외형",
        african: "아프리카계 외형",
        latin_american: "라틴아메리카계 외형",
        mixed_heritage: "혼합 계통 외형",
      }),
    }),
    fieldLabel: Object.freeze({ en: "Ethnic appearance", ko: "민족적 외형" }),
    tooltip: Object.freeze({
      en: "Optional visual heritage/ethnic appearance cue for this person. It combines with Appearance Preset and Appearance Additional Input instead of replacing them. In I2V/R2V, the connected visual reference can remain the stronger identity cue.",
      ko: "이 인물의 민족적·지역적 외형 방향을 선택합니다. 외형 프리셋과 외형 추가 입력을 대체하지 않고 함께 조합됩니다. I2V/R2V에서는 연결된 시각 참조의 실제 인물 외형이 더 강하게 작용할 수 있습니다.",
    }),
  }),
]);

const SCENE_BASELINE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "location", scope: "scene.baseline", promptTarget: "environment", order: 10, defaultValue: "none",
    values: Object.freeze(["none", ...SCENE_LOCATION_VALUES]),
    labels: Object.freeze({
      en: Object.freeze({ none: "Unspecified",
        "modern_city_street": "Modern city street",
        "busy_crosswalk": "Busy urban crosswalk",
        "neon_district": "Neon entertainment district",
        "narrow_urban_alley": "Narrow urban alley",
        "old_european_street": "Historic European street",
        "seoul_downtown": "Downtown Seoul street",
        "paris_boulevard": "Paris boulevard",
        "new_york_avenue": "New York avenue",
        "tokyo_neon_street": "Tokyo-style neon street",
        "city_square": "City square",
        "riverside_promenade": "Riverside promenade",
        "pedestrian_bridge": "Pedestrian bridge",
        "traffic_intersection": "Busy traffic intersection",
        "city_rooftop": "City rooftop",
        "crowded_night_market": "Crowded night market",
        "busy_street_market": "Busy street market",
        "festival_plaza": "Festival plaza",
        "amusement_park": "Amusement park",
        "stadium_concourse": "Busy stadium concourse",
        "packed_subway_car": "Packed subway car",
        "busy_subway_platform": "Busy subway platform",
        "busy_train_station": "Busy train station",
        "moving_train_interior": "Moving train interior",
        "busy_airport_terminal": "Busy airport terminal",
        "busy_bus_terminal": "Busy bus terminal",
        "underground_parking": "Underground parking garage",
        "road_tunnel": "Road tunnel",
        "harbor_pier": "Harbor pier",
        "modern_cafe": "Modern cafe",
        "cozy_cafe": "Cozy cafe",
        "rooftop_cafe": "Rooftop cafe",
        "lively_restaurant": "Lively restaurant",
        "hotel_lobby": "Busy hotel lobby",
        "busy_shopping_mall": "Busy shopping mall",
        "art_gallery": "Art gallery",
        "modern_office": "Modern office",
        "industrial_warehouse": "Industrial warehouse",
        "active_factory_floor": "Active factory floor",
        "busy_kitchen": "Busy professional kitchen",
        "greenhouse": "Glass greenhouse",
        "open_beach": "Open sandy beach",
        "rough_wave_seashore": "Rough-wave seashore",
        "rocky_coast": "Rocky coast",
        "tropical_shore": "Tropical shore",
        "dense_forest": "Dense forest",
        "pine_forest": "Pine forest",
        "bamboo_forest": "Bamboo forest",
        "open_meadow": "Open meadow",
        "flower_field": "Flower field",
        "lakeside": "Lakeside",
        "riverbank": "Riverbank",
        "mountain_valley": "Mountain valley",
        "mountain_ridge": "Mountain ridge",
        "waterfall": "Waterfall",
        "canyon": "Canyon",
        "desert_dunes": "Desert dunes",
        "rocky_desert": "Rocky desert",
        "snowfield": "Open snowfield",
        "glacier": "Glacial landscape",
        "construction_site": "Active construction site",
        "wind_turbine_field": "Wind-turbine field",
        "futuristic_city": "Futuristic city",
        "space_station": "Space-station interior",
        "ancient_ruins": "Ancient ruins",
        "fantasy_forest": "Fantasy forest"
      }),
      ko: Object.freeze({ none: "선택 안 함",
        "modern_city_street": "\ud604\ub300 \ub3c4\uc2ec \uac70\ub9ac",
        "busy_crosswalk": "\ud65c\uae30\ucc2c \ub3c4\uc2ec \ud6a1\ub2e8\ubcf4\ub3c4",
        "neon_district": "\ub124\uc628 \ubc88\ud654\uac00",
        "narrow_urban_alley": "\uc881\uc740 \ub3c4\uc2ec \uace8\ubaa9",
        "old_european_street": "\uc624\ub798\ub41c \uc720\ub7fd\ud48d \uac70\ub9ac",
        "seoul_downtown": "\uc11c\uc6b8 \ub3c4\uc2ec \uac70\ub9ac",
        "paris_boulevard": "\ud30c\ub9ac \ub300\ub85c",
        "new_york_avenue": "\ub274\uc695 \ub3c4\uc2ec \ub300\ub85c",
        "tokyo_neon_street": "\ub3c4\ucfc4\ud48d \ub124\uc628 \uac70\ub9ac",
        "city_square": "\ub3c4\uc2ec \uad11\uc7a5",
        "riverside_promenade": "\uac15\ubcc0 \uc0b0\ucc45\ub85c",
        "pedestrian_bridge": "\ubcf4\ud589\uad50",
        "traffic_intersection": "\ud63c\uc7a1\ud55c \ub300\ud615 \uad50\ucc28\ub85c",
        "city_rooftop": "\ub3c4\uc2ec \uc625\uc0c1",
        "crowded_night_market": "\ud65c\uae30\ucc28\uace0 \ubd90\ube44\ub294 \uc57c\uc2dc\uc7a5",
        "busy_street_market": "\ubd90\ube44\ub294 \uc7ac\ub798\uc2dc\uc7a5",
        "festival_plaza": "\ud65c\uae30\ucc2c \ucd95\uc81c \uad11\uc7a5",
        "amusement_park": "\ub180\uc774\uacf5\uc6d0",
        "stadium_concourse": "\ubd90\ube44\ub294 \uacbd\uae30\uc7a5 \ud1b5\ub85c",
        "packed_subway_car": "\ub9cc\uc6d0 \uc9c0\ud558\ucca0 \ub0b4\ubd80",
        "busy_subway_platform": "\ubd90\ube44\ub294 \uc9c0\ud558\ucca0 \uc2b9\uac15\uc7a5",
        "busy_train_station": "\ubd84\uc8fc\ud55c \uae30\ucc28\uc5ed",
        "moving_train_interior": "\ub2ec\ub9ac\ub294 \uae30\ucc28 \ub0b4\ubd80",
        "busy_airport_terminal": "\ubd84\uc8fc\ud55c \uacf5\ud56d \ud130\ubbf8\ub110",
        "busy_bus_terminal": "\ubd84\uc8fc\ud55c \ubc84\uc2a4\ud130\ubbf8\ub110",
        "underground_parking": "\uc9c0\ud558 \uc8fc\ucc28\uc7a5",
        "road_tunnel": "\ub3c4\ub85c \ud130\ub110",
        "harbor_pier": "\ud56d\uad6c\u00b7\ubd80\ub450",
        "modern_cafe": "\ud604\ub300\uc801\uc778 \uce74\ud398",
        "cozy_cafe": "\uc544\ub291\ud55c \uce74\ud398",
        "rooftop_cafe": "\ub8e8\ud504\ud0d1 \uce74\ud398",
        "lively_restaurant": "\ud65c\uae30\ucc2c \ub808\uc2a4\ud1a0\ub791",
        "hotel_lobby": "\ubd84\uc8fc\ud55c \ud638\ud154 \ub85c\ube44",
        "busy_shopping_mall": "\ubd90\ube44\ub294 \uc1fc\ud551\ubab0",
        "art_gallery": "\ubbf8\uc220\uad00\u00b7\uac24\ub7ec\ub9ac",
        "modern_office": "\ud604\ub300\uc2dd \uc0ac\ubb34\uc2e4",
        "industrial_warehouse": "\uc0b0\uc5c5 \ucc3d\uace0",
        "active_factory_floor": "\uac00\ub3d9 \uc911\uc778 \uacf5\uc7a5",
        "busy_kitchen": "\ubd84\uc8fc\ud55c \uc8fc\ubc29",
        "greenhouse": "\uc720\ub9ac \uc628\uc2e4",
        "open_beach": "\ub113\uc740 \ubaa8\ub798\uc0ac\uc7a5",
        "rough_wave_seashore": "\uac70\uc13c \ud30c\ub3c4\uc758 \ubc14\ub2f7\uac00",
        "rocky_coast": "\ubc14\uc704 \ud574\uc548",
        "tropical_shore": "\uc57c\uc790\uc218\uac00 \uc788\ub294 \ud574\ubcc0",
        "dense_forest": "\uc6b8\ucc3d\ud55c \uc232",
        "pine_forest": "\uc18c\ub098\ubb34 \uc232",
        "bamboo_forest": "\ub300\ub098\ubb34 \uc232",
        "open_meadow": "\ub113\uc740 \ucd08\uc6d0",
        "flower_field": "\ub113\uc740 \uaf43\ubc2d",
        "lakeside": "\ud638\uc22b\uac00",
        "riverbank": "\uac15\uac00",
        "mountain_valley": "\uc0b0\uc545 \uacc4\uace1",
        "mountain_ridge": "\uc0b0 \uc815\uc0c1\u00b7\ub2a5\uc120",
        "waterfall": "\ud3ed\ud3ec \uc8fc\ubcc0",
        "canyon": "\ud611\uace1",
        "desert_dunes": "\uad11\ud65c\ud55c \uc0ac\ub9c9 \ubaa8\ub798\uc5b8\ub355",
        "rocky_desert": "\ud669\ub7c9\ud55c \ubc14\uc704 \uc0ac\ub9c9",
        "snowfield": "\uad11\ud65c\ud55c \uc124\uc6d0",
        "glacier": "\ube59\ud558 \uc9c0\ub300",
        "construction_site": "\uac00\ub3d9 \uc911\uc778 \uacf5\uc0ac \ud604\uc7a5",
        "wind_turbine_field": "\ud48d\ub825\ubc1c\uc804\uae30 \ub4e4\ud310",
        "futuristic_city": "\ubbf8\ub798 \ub3c4\uc2dc",
        "space_station": "\uc6b0\uc8fc \uc815\uac70\uc7a5 \ub0b4\ubd80",
        "ancient_ruins": "\uace0\ub300 \uc720\uc801",
        "fantasy_forest": "\ud310\ud0c0\uc9c0 \uc232"
      }),
    }),
    fieldLabel: Object.freeze({ en: "Base scene / location", ko: "기본 장면 / 배경" }),
    tooltip: Object.freeze({
      en: "Opening scene/location for the video. Progress rows can override it from their start time onward. The preset describes a video-ready environment while keeping background activity at a natural real-time pace; it does not control Camera or Sound.",
      ko: "영상 시작 시점의 기본 장면·배경입니다. 진행 항목에서 다시 선택하면 해당 시작 시점부터 덮어씁니다. 카메라·사운드를 건드리지 않으며 배경 활동은 자연스러운 실시간 속도를 유지하도록 영상용 환경을 구성합니다.",
    }),
  }),
  Object.freeze({
    id: "weather", scope: "scene.baseline", promptTarget: "environment", order: 20, defaultValue: "none",
    values: Object.freeze(["none", ...WEATHER_VALUES]),
    labels: Object.freeze({
      en: Object.freeze({ none: "Unspecified",
        "clear": "Clear",
        "partly_cloudy": "Partly cloudy",
        "overcast": "Overcast",
        "light_drizzle": "Light drizzle",
        "light_rain": "Light rain",
        "steady_rain": "Steady rain",
        "heavy_rain": "Heavy rain",
        "wind_driven_rain": "Wind-driven heavy rain",
        "torrential_rain": "Torrential rain",
        "thunderstorm": "Thunderstorm with lightning",
        "severe_thunderstorm": "Severe thunderstorm",
        "light_snow": "Light snow",
        "steady_snow": "Steady snow",
        "heavy_snow": "Heavy snow",
        "blizzard": "Fierce blizzard",
        "light_breeze": "Light breeze",
        "steady_wind": "Steady wind",
        "strong_wind": "Strong wind",
        "violent_gusts": "Violent gusts",
        "light_fog": "Light fog",
        "dense_fog": "Dense fog",
        "low_mist": "Low drifting mist",
        "dusty_wind": "Dust-laden wind",
        "sandstorm": "Sandstorm",
        "hailstorm": "Hailstorm"
      }),
      ko: Object.freeze({ none: "선택 안 함",
        "clear": "\ub9d1\uc74c",
        "partly_cloudy": "\uc57d\uac04 \ud750\ub9bc",
        "overcast": "\ud750\ub9bc",
        "light_drizzle": "\uc774\uc2ac\ube44",
        "light_rain": "\uac00\ubcbc\uc6b4 \ube44",
        "steady_rain": "\ubcf4\ud1b5 \ube44",
        "heavy_rain": "\uac15\ud55c \ube44",
        "wind_driven_rain": "\ubab0\uc544\uce58\ub294 \ube44\ubc14\ub78c",
        "torrential_rain": "\uc3df\uc544\uc9c0\ub294 \ud3ed\uc6b0",
        "thunderstorm": "\ucc9c\ub465\u00b7\ubc88\uac1c\ub97c \ub3d9\ubc18\ud55c \ud3ed\uc6b0",
        "severe_thunderstorm": "\uac70\uc13c \ucc9c\ub465\ubc88\uac1c \ud3ed\ud48d\uc6b0",
        "light_snow": "\uac00\ubcbc\uc6b4 \ub208",
        "steady_snow": "\ubcf4\ud1b5 \ub208",
        "heavy_snow": "\uac15\ud55c \ub208",
        "blizzard": "\uac15\ud55c \ub208\ubcf4\ub77c",
        "light_breeze": "\uc0b0\ub4e4\ubc14\ub78c",
        "steady_wind": "\ubc14\ub78c",
        "strong_wind": "\uac15\ud55c \ubc14\ub78c",
        "violent_gusts": "\uac70\uc13c \ub3cc\ud48d",
        "light_fog": "\uc605\uc740 \uc548\uac1c",
        "dense_fog": "\uc9d9\uc740 \uc548\uac1c",
        "low_mist": "\ub0ae\uac8c \ud750\ub974\ub294 \uc6b4\ubb34",
        "dusty_wind": "\uba3c\uc9c0\ubc14\ub78c",
        "sandstorm": "\ubaa8\ub798\ud3ed\ud48d",
        "hailstorm": "\uc6b0\ubc15\uc744 \ub3d9\ubc18\ud55c \ud3ed\ud48d"
      }),
    }),
    fieldLabel: Object.freeze({ en: "Base weather / environment", ko: "기본 날씨 / 환경" }),
    tooltip: Object.freeze({
      en: "Opening weather/environment state. It is a single video-oriented preset; Progress rows can replace it later. Strong presets describe wind-driven rain, lightning, snow, fog, or airborne particles while keeping scene-wide motion at a natural real-time pace.",
      ko: "영상 시작 시점의 기본 날씨·환경 상태입니다. 단일 선택형 영상 프리셋이며 진행 항목에서 이후 상태를 바꿀 수 있습니다. 강한 프리셋은 비바람·번개·눈·안개·입자를 구체적으로 표현하되 장면 전체가 빨라지지 않도록 자연스러운 실시간 속도를 기준으로 합니다.",
    }),
  }),
]);

function makeTurnSceneDefinition(baseDefinition) {
  const fieldLabel = baseDefinition.id === "location"
    ? Object.freeze({ en: "Scene / location change", ko: "장면 / 배경 변경" })
    : Object.freeze({ en: "Weather / environment change", ko: "날씨 / 환경 변경" });
  const keepEn = baseDefinition.id === "location" ? "Keep current scene / location" : "Keep current weather / environment";
  const keepKo = baseDefinition.id === "location" ? "현재 장면 / 배경 유지" : "현재 날씨 / 환경 유지";
  const resetEn = baseDefinition.id === "location" ? "Return to base scene / location" : "Return to base weather / environment";
  const resetKo = baseDefinition.id === "location" ? "기본 장면 / 배경으로 복귀" : "기본 날씨 / 환경으로 복귀";
  return Object.freeze({
    ...baseDefinition,
    scope: "turn.scene",
    defaultValue: TURN_KEEP_VALUE,
    values: Object.freeze([TURN_KEEP_VALUE, TURN_RESET_VALUE, ...baseDefinition.values.filter((value) => value !== "none")]),
    labels: Object.freeze({
      en: Object.freeze({ [TURN_KEEP_VALUE]: keepEn, [TURN_RESET_VALUE]: resetEn, ...baseDefinition.labels.en }),
      ko: Object.freeze({ [TURN_KEEP_VALUE]: keepKo, [TURN_RESET_VALUE]: resetKo, ...baseDefinition.labels.ko }),
    }),
    fieldLabel,
    tooltip: Object.freeze({
      en: baseDefinition.id === "location"
        ? "Keep current scene/location, return to the opening base scene, or replace the scene from this Progress time onward. The selected state persists until a later Progress changes it."
        : "Keep current weather/environment, return to the opening base weather, or replace it from this Progress time onward. The selected state persists until a later Progress changes it.",
      ko: baseDefinition.id === "location"
        ? "현재 장면·배경을 유지하거나, 영상 시작의 기본 장면으로 복귀하거나, 이 진행 시점부터 새 장면으로 바꿉니다. 이후 진행에서 다시 바꿀 때까지 상태가 유지됩니다."
        : "현재 날씨·환경을 유지하거나, 영상 시작의 기본 날씨로 복귀하거나, 이 진행 시점부터 새 날씨로 바꿉니다. 이후 진행에서 다시 바꿀 때까지 상태가 유지됩니다.",
    }),
  });
}

const TURN_SCENE_DEFINITIONS = Object.freeze(SCENE_BASELINE_DEFINITIONS.map(makeTurnSceneDefinition));

function normalizeLocale(localeOrFn, node) {
  let raw;
  try { raw = typeof localeOrFn === "function" ? localeOrFn(node) : localeOrFn; } catch (_) { raw = "en"; }
  return String(raw || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
}

function normalizeSlot(slot) {
  const upper = String(slot || "").toUpperCase();
  return PERSON_SLOTS.includes(upper) ? upper : null;
}

function cloneJsonSafe(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return {}; }
}

function rawState(node) {
  const value = node?.properties?.[EXTENSION_OPTIONS_PROPERTY];
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function ensureState(node) {
  if (!node) return { version: EXTENSION_VERSION };
  node.properties ??= {};
  let state = rawState(node);
  if (!state) {
    state = { version: EXTENSION_VERSION };
    node.properties[EXTENSION_OPTIONS_PROPERTY] = state;
  } else if (!Number.isFinite(Number(state.version)) || Number(state.version) < EXTENSION_VERSION) {
    state.version = EXTENSION_VERSION;
  }
  return state;
}

function definitionValue(node, slot, definition) {
  const normalizedSlot = normalizeSlot(slot);
  if (!normalizedSlot || !definition) return definition?.defaultValue ?? "none";
  const state = rawState(node);
  const value = state?.person?.[normalizedSlot]?.profile?.[definition.id];
  const canonical = String(value ?? definition.defaultValue ?? "none");
  return definition.values.includes(canonical) ? canonical : (definition.defaultValue ?? "none");
}

function pruneEmptyContainers(state) {
  if (!state || typeof state !== "object") return;
  const person = state.person;
  if (person && typeof person === "object" && !Array.isArray(person)) {
    for (const slot of PERSON_SLOTS) {
      const personState = person[slot];
      if (!personState || typeof personState !== "object" || Array.isArray(personState)) continue;
      const profile = personState.profile;
      if (profile && typeof profile === "object" && !Array.isArray(profile) && Object.keys(profile).length === 0) delete personState.profile;
      if (Object.keys(personState).length === 0) delete person[slot];
    }
    if (Object.keys(person).length === 0) delete state.person;
  }
  const scene = state.scene;
  if (scene && typeof scene === "object" && !Array.isArray(scene)) {
    const baseline = scene.baseline;
    if (baseline && typeof baseline === "object" && !Array.isArray(baseline) && Object.keys(baseline).length === 0) delete scene.baseline;
    if (Object.keys(scene).length === 0) delete state.scene;
  }
  const turns = state.turn;
  if (turns && typeof turns === "object" && !Array.isArray(turns)) {
    for (const key of Object.keys(turns)) {
      const turnState = turns[key];
      if (!turnState || typeof turnState !== "object" || Array.isArray(turnState)) { delete turns[key]; continue; }
      const turnScene = turnState.scene;
      if (turnScene && typeof turnScene === "object" && !Array.isArray(turnScene) && Object.keys(turnScene).length === 0) delete turnState.scene;
      if (Object.keys(turnState).length === 0) delete turns[key];
    }
    if (Object.keys(turns).length === 0) delete state.turn;
  }
}

function setDefinitionValue(node, slot, definition, incoming) {
  const normalizedSlot = normalizeSlot(slot);
  if (!node || !normalizedSlot || !definition) return false;
  const value = String(incoming ?? definition.defaultValue ?? "none");
  if (!definition.values.includes(value)) return false;
  const previous = definitionValue(node, normalizedSlot, definition);
  if (previous === value) return false;

  const state = ensureState(node);
  state.person ??= {};
  state.person[normalizedSlot] ??= {};
  state.person[normalizedSlot].profile ??= {};
  if (value === definition.defaultValue) delete state.person[normalizedSlot].profile[definition.id];
  else state.person[normalizedSlot].profile[definition.id] = value;
  pruneEmptyContainers(state);
  if (!state.person && Object.keys(state).every((key) => key === "version")) {
    delete node.properties[EXTENSION_OPTIONS_PROPERTY];
  }
  return true;
}

function sceneBaselineDefinitionValue(node, definition) {
  const state = rawState(node);
  const value = String(state?.scene?.baseline?.[definition.id] ?? definition.defaultValue ?? "none");
  return definition.values.includes(value) ? value : (definition.defaultValue ?? "none");
}

function setSceneBaselineDefinitionValue(node, definition, incoming) {
  if (!node || !definition) return false;
  const value = String(incoming ?? definition.defaultValue ?? "none");
  if (!definition.values.includes(value)) return false;
  const previous = sceneBaselineDefinitionValue(node, definition);
  if (previous === value) return false;
  const state = ensureState(node);
  state.scene ??= {};
  state.scene.baseline ??= {};
  if (value === definition.defaultValue) delete state.scene.baseline[definition.id];
  else state.scene.baseline[definition.id] = value;
  pruneEmptyContainers(state);
  if (!state.person && !state.scene && !state.turn && Object.keys(state).every((key) => key === "version")) {
    delete node.properties[EXTENSION_OPTIONS_PROPERTY];
  }
  return true;
}

function turnSceneDefinitionValue(node, turnIndex, definition) {
  const index = Math.max(1, Math.min(6, Number(turnIndex) || 1));
  const state = rawState(node);
  const value = String(state?.turn?.[String(index)]?.scene?.[definition.id] ?? definition.defaultValue ?? TURN_KEEP_VALUE);
  return definition.values.includes(value) ? value : (definition.defaultValue ?? TURN_KEEP_VALUE);
}

function setTurnSceneDefinitionValue(node, turnIndex, definition, incoming) {
  const index = Math.max(1, Math.min(6, Number(turnIndex) || 1));
  if (!node || !definition) return false;
  const value = String(incoming ?? definition.defaultValue ?? TURN_KEEP_VALUE);
  if (!definition.values.includes(value)) return false;
  const previous = turnSceneDefinitionValue(node, index, definition);
  if (previous === value) return false;
  const state = ensureState(node);
  state.turn ??= {};
  state.turn[String(index)] ??= {};
  state.turn[String(index)].scene ??= {};
  if (value === definition.defaultValue) delete state.turn[String(index)].scene[definition.id];
  else state.turn[String(index)].scene[definition.id] = value;
  pruneEmptyContainers(state);
  if (!state.person && !state.scene && !state.turn && Object.keys(state).every((key) => key === "version")) {
    delete node.properties[EXTENSION_OPTIONS_PROPERTY];
  }
  return true;
}

function personDefinitionList() {
  return DEFINITIONS.filter((definition) => definition.scope === "person.profile")
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id));
}

function widgetName(slot, definition) {
  const lower = String(slot || "").toLowerCase();
  return `__ultra_ext_person_${lower}_profile_${definition.id}`;
}

function sceneBaselineWidgetName(definition) {
  return `__ultra_ext_scene_baseline_${definition.id}`;
}

function turnSceneWidgetName(turnIndex, definition) {
  return `__ultra_ext_turn_${Number(turnIndex)}_scene_${definition.id}`;
}

function widgetByExactExtensionName(node, name) {
  return (node?.widgets || []).find((widget) => widget?.[EXTENSION_WIDGET_MARKER]?.name === name || widget?.name === name) || null;
}

function widgetByExtension(node, slot, definition) {
  const name = widgetName(slot, definition);
  return (node?.widgets || []).find((widget) => widget?.[EXTENSION_WIDGET_MARKER]?.name === name || widget?.name === name) || null;
}

function optionLabel(definition, locale, value) {
  return definition?.labels?.[locale]?.[value]
    ?? definition?.labels?.en?.[value]
    ?? String(value ?? "");
}

let activeExtensionOptionPopup = null;

function closeExtensionOptionPopup() {
  const popup = activeExtensionOptionPopup;
  activeExtensionOptionPopup = null;
  if (!popup) return;
  try { popup.cleanup?.(); } catch (_) {}
  try { popup.element?.remove?.(); } catch (_) {}
}

function openExtensionOptionPopup(event, node, widget, definition, localeOrFn, commit) {
  if (typeof document === "undefined" || !document?.body || !definition) return false;
  closeExtensionOptionPopup();

  const locale = normalizeLocale(localeOrFn, node);
  const values = [...definition.values];
  const current = String(widget?.value ?? definition.defaultValue);
  const popup = document.createElement("div");
  popup.dataset.ultraH3ExtensionPopup = definition.id;
  Object.assign(popup.style, {
    position: "fixed",
    zIndex: "100000",
    minWidth: "220px",
    maxWidth: "340px",
    maxHeight: "340px",
    overflowY: "auto",
    padding: "4px",
    background: "#242424",
    color: "#ddd",
    border: "1px solid #666",
    borderRadius: "6px",
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
    font: "12px sans-serif",
    lineHeight: "1.35",
  });

  for (const value of values) {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.value = value;
    const selected = value === current;
    row.textContent = `${selected ? "✓" : "  "} ${optionLabel(definition, locale, value)}`;
    Object.assign(row.style, {
      display: "block",
      width: "100%",
      margin: "0",
      padding: "6px 9px",
      border: "0",
      borderRadius: "4px",
      background: selected ? "#3a3a3a" : "transparent",
      color: selected ? "#fff" : "#ddd",
      textAlign: "left",
      font: "inherit",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    row.addEventListener("pointerenter", () => { row.style.background = "#444"; });
    row.addEventListener("pointerleave", () => { row.style.background = selected ? "#3a3a3a" : "transparent"; });
    row.addEventListener("pointerdown", (popupEvent) => {
      popupEvent.preventDefault();
      popupEvent.stopPropagation();
    });
    row.addEventListener("click", (popupEvent) => {
      popupEvent.preventDefault();
      popupEvent.stopPropagation();
      commit(value);
      closeExtensionOptionPopup();
    });
    popup.appendChild(row);
  }

  document.body.appendChild(popup);
  const eventX = Number(event?.clientX ?? event?.pageX);
  const eventY = Number(event?.clientY ?? event?.pageY);
  const startX = Number.isFinite(eventX) ? eventX : Math.max(8, (window.innerWidth || 800) / 2);
  const startY = Number.isFinite(eventY) ? eventY : Math.max(8, (window.innerHeight || 600) / 2);
  const rect = popup.getBoundingClientRect();
  const viewportW = Number(window.innerWidth || document.documentElement?.clientWidth || 800);
  const viewportH = Number(window.innerHeight || document.documentElement?.clientHeight || 600);
  const left = Math.max(6, Math.min(startX, viewportW - rect.width - 6));
  const top = Math.max(6, Math.min(startY + 4, viewportH - rect.height - 6));
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  const onOutsidePointer = (outsideEvent) => {
    if (popup.contains(outsideEvent.target)) return;
    closeExtensionOptionPopup();
  };
  const onKeyDown = (keyEvent) => {
    if (keyEvent.key === "Escape") closeExtensionOptionPopup();
  };
  const cleanup = () => {
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
  document.addEventListener("pointerdown", onOutsidePointer, true);
  document.addEventListener("keydown", onKeyDown, true);
  activeExtensionOptionPopup = { element: popup, cleanup };
  return true;
}

function refreshOneWidget(node, widget, slot, definition, localeOrFn) {
  if (!widget || !definition) return;
  const locale = normalizeLocale(localeOrFn, node);
  const name = widgetName(slot, definition);
  const label = definition.fieldLabel?.[locale] ?? definition.fieldLabel?.en ?? definition.id;
  const value = definitionValue(node, slot, definition);
  const tooltip = definition.tooltip?.[locale] ?? definition.tooltip?.en ?? "";
  if (widget.name !== name) widget.name = name;
  if (widget.label !== label) widget.label = label;
  if (widget.value !== value) widget.value = value;
  const current = widget.options || {};
  const previousValues = Array.isArray(current.values) ? current.values : [];
  const resolverChanged = widget.__ultraOptionLabelLocaleSource !== localeOrFn || typeof current.getOptionLabel !== "function";
  if (current.serialize !== false || current.tooltip !== tooltip || resolverChanged
    || previousValues.length !== definition.values.length
    || previousValues.some((entry, index) => entry !== definition.values[index])) {
    widget.__ultraOptionLabelLocaleSource = localeOrFn;
    widget.options = {
      ...current,
      values: [...definition.values],
      serialize: false,
      tooltip,
      getOptionLabel: (incoming) => optionLabel(definition, normalizeLocale(localeOrFn, node), String(incoming ?? "")),
    };
  }
  if (widget.serialize !== false) widget.serialize = false;
  if (typeof widget.serializeValue !== "function") widget.serializeValue = () => undefined;
}

function moveBeforeAnchor(node, widget, anchorName) {
  const widgets = node?.widgets;
  if (!Array.isArray(widgets) || !widget) return false;
  const currentIndex = widgets.indexOf(widget);
  const anchorIndex = widgets.findIndex((item) => item?.name === anchorName);
  if (currentIndex < 0 || anchorIndex < 0 || currentIndex === anchorIndex - 1) return false;
  widgets.splice(currentIndex, 1);
  const nextAnchorIndex = widgets.findIndex((item) => item?.name === anchorName);
  if (nextAnchorIndex < 0) {
    widgets.push(widget);
    return true;
  }
  widgets.splice(nextAnchorIndex, 0, widget);
  return true;
}

function refreshStateWidget(node, widget, definition, localeOrFn, value) {
  if (!widget || !definition) return;
  const activeLocale = normalizeLocale(localeOrFn, node);
  const label = definition.fieldLabel?.[activeLocale] ?? definition.fieldLabel?.en ?? definition.id;
  const tooltip = definition.tooltip?.[activeLocale] ?? definition.tooltip?.en ?? "";
  if (widget.label !== label) widget.label = label;
  if (widget.value !== value) widget.value = value;
  const current = widget.options || {};
  const previousValues = Array.isArray(current.values) ? current.values : [];
  const resolverChanged = widget.__ultraOptionLabelLocaleSource !== localeOrFn || typeof current.getOptionLabel !== "function";
  if (current.serialize !== false || current.tooltip !== tooltip || resolverChanged
    || previousValues.length !== definition.values.length
    || previousValues.some((entry, index) => entry !== definition.values[index])) {
    widget.__ultraOptionLabelLocaleSource = localeOrFn;
    widget.options = {
      ...current,
      values: [...definition.values],
      serialize: false,
      tooltip,
      getOptionLabel: (incoming) => optionLabel(definition, normalizeLocale(localeOrFn, node), String(incoming ?? "")),
    };
  }
  if (widget.serialize !== false) widget.serialize = false;
  if (typeof widget.serializeValue !== "function") widget.serializeValue = () => undefined;
}

function groupedRowInset(widget, base = 15) {
  return Math.max(0, Number(base) || 0) + Math.max(0, Number(widget?.[GROUP_INDENT]) || 0);
}

function createCanvasStateWidget(node, name, definition, localeOrFn, readValue, commit) {
  if (typeof node?.addCustomWidget !== "function") return null;
  const localX = (event, pos, owner) => {
    if (Number.isFinite(Number(event?.canvasX)) && Array.isArray(owner?.pos)) return Number(event.canvasX) - Number(owner.pos[0] || 0);
    if (Array.isArray(pos) && Number.isFinite(Number(pos[0]))) return Number(pos[0]);
    return NaN;
  };
  const widget = {
    type: "custom",
    name,
    label: definition.fieldLabel?.en ?? definition.id,
    value: readValue(),
    options: { serialize: false, tooltip: definition.tooltip?.en ?? "" },
    serialize: false,
    serializeValue: () => undefined,
    computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 20],
    draw(ctx, owner, width, y, H) {
      if (!ctx) return;
      const activeLocale = normalizeLocale(localeOrFn, node);
      const h = Number(H) || 20;
      const w = Number(width) || Number(owner?.size?.[0]) || 200;
      const inset = groupedRowInset(this);
      const x0 = inset;
      const x1 = Math.max(x0 + 1, w - inset);
      this.__ultraExtensionWidth = w;
      const display = optionLabel(definition, activeLocale, String(this.value ?? definition.defaultValue));
      const field = definition.fieldLabel?.[activeLocale] ?? definition.fieldLabel?.en ?? definition.id;
      const values = definition.values;
      const currentIndex = Math.max(0, values.indexOf(String(this.value ?? definition.defaultValue)));
      ctx.save();
      try {
        ctx.fillStyle = "#222";
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const r = Math.max(4, Math.min(h / 2, 10));
        ctx.moveTo(x0 + r, y); ctx.lineTo(x1 - r, y); ctx.quadraticCurveTo(x1, y, x1, y + r);
        ctx.lineTo(x1, y + h - r); ctx.quadraticCurveTo(x1, y + h, x1 - r, y + h);
        ctx.lineTo(x0 + r, y + h); ctx.quadraticCurveTo(x0, y + h, x0, y + h - r);
        ctx.lineTo(x0, y + r); ctx.quadraticCurveTo(x0, y, x0 + r, y); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.textBaseline = "middle"; ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb"; ctx.textAlign = "left"; ctx.fillText(field, x0 + 20, y + h / 2);
        ctx.fillStyle = "#ddd"; ctx.textAlign = "right"; ctx.fillText(display, x1 - 35, y + h / 2);
        ctx.textAlign = "center"; ctx.fillStyle = currentIndex > 0 ? "#ddd" : "#777"; ctx.fillText("◀", x0 + 12, y + h / 2);
        ctx.fillStyle = currentIndex < values.length - 1 ? "#ddd" : "#777"; ctx.fillText("▶", x1 - 12, y + h / 2);
      } finally { ctx.restore(); }
    },
    mouse(event, pos, owner) {
      const type = String(event?.type || "").toLowerCase();
      if (type !== "pointerup" && type !== "mouseup") return false;
      const width = Number(this.__ultraExtensionWidth) || Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 0;
      const x = localX(event, pos, owner || node);
      if (!Number.isFinite(x) || !(width > 0)) return false;
      const values = definition.values;
      const current = String(this.value ?? definition.defaultValue);
      const index = Math.max(0, values.indexOf(current));
      const inset = groupedRowInset(this);
      if (x < inset || x > width - inset) return false;
      const edge = inset + 25;
      if (x <= edge) { if (index > 0) commit(values[index - 1]); return true; }
      if (x >= width - edge) { if (index < values.length - 1) commit(values[index + 1]); return true; }
      try { event?.preventDefault?.(); } catch (_) {}
      try { event?.stopPropagation?.(); } catch (_) {}
      return openExtensionOptionPopup(event, node, this, definition, localeOrFn, commit);
    },
  };
  widget[SELF_INDENTED_WIDGET] = true;
  node.addCustomWidget(widget);
  return widget;
}

export function installExtensionOptions(node, { locale = "en", refreshMetadata = null, onChange = null } = {}) {
  if (!node || (typeof node.addCustomWidget !== "function" && typeof node.addWidget !== "function")) return false;
  let changed = false;
  const personCount = Math.max(0, Math.min(PERSON_SLOTS.length, Number(node?.widgets?.find?.((widget) => widget?.name === "person_count")?.value) || 0));
  const turnCount = Math.max(1, Math.min(6, Number(node?.widgets?.find?.((widget) => widget?.name === "turn_count")?.value) || 1));
  const activePersonSlots = PERSON_SLOTS.slice(0, personCount);

  const localX = (event, pos, owner) => {
    if (Number.isFinite(Number(event?.canvasX)) && Array.isArray(owner?.pos)) {
      return Number(event.canvasX) - Number(owner.pos[0] || 0);
    }
    if (Array.isArray(pos) && Number.isFinite(Number(pos[0]))) return Number(pos[0]);
    return NaN;
  };

  for (const slot of activePersonSlots) {
    for (const definition of personDefinitionList()) {
      let widget = widgetByExtension(node, slot, definition);
      if (!widget) {
        const name = widgetName(slot, definition);
        const commit = (incoming) => {
          const canonical = String(incoming ?? definition.defaultValue);
          if (!definition.values.includes(canonical)) return;
          const didChange = setDefinitionValue(node, slot, definition, canonical);
          const liveWidget = widgetByExtension(node, slot, definition);
          if (liveWidget) refreshOneWidget(node, liveWidget, slot, definition, locale);
          if (didChange) {
            try { onChange?.(node, { slot, definition, value: canonical }); } catch (_) {}
            try { node.setDirtyCanvas?.(true, true); } catch (_) {}
            try { node.graph?.setDirtyCanvas?.(true, true); } catch (_) {}
          }
        };

        if (typeof node.addCustomWidget === "function") {
          // Use a canvas-only UI row instead of a native Vue combo. Reordering a
          // newly-created native combo among established backend DOM widgets can
          // make Vue temporarily reuse positional widget state (the failed first
          // candidate visibly surfaced raw null/none values in neighbouring
          // STRING rows). This custom row behaves like the existing safe count
          // mirrors: it lives in node.widgets for layout only, is detached by the
          // persistence guard, and never participates in backend positional data.
          widget = {
            type: "custom",
            name,
            label: definition.fieldLabel?.en ?? definition.id,
            value: definitionValue(node, slot, definition),
            options: { serialize: false, tooltip: definition.tooltip?.en ?? "" },
            serialize: false,
            serializeValue: () => undefined,
            computeSize: (width) => [Number(width) || Number(node?.size?.[0]) || 200, 20],
            draw(ctx, owner, width, y, H) {
              if (!ctx) return;
              const activeLocale = normalizeLocale(locale, node);
              const h = Number(H) || 20;
              const w = Number(width) || Number(owner?.size?.[0]) || 200;
              const inset = groupedRowInset(this);
              const x0 = inset;
              const x1 = Math.max(x0 + 1, w - inset);
              this.__ultraExtensionWidth = w;
              const display = optionLabel(definition, activeLocale, String(this.value ?? definition.defaultValue));
              const field = definition.fieldLabel?.[activeLocale] ?? definition.fieldLabel?.en ?? definition.id;
              const values = definition.values;
              const currentIndex = Math.max(0, values.indexOf(String(this.value ?? definition.defaultValue)));
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

                ctx.textBaseline = "middle";
                ctx.font = "12px sans-serif";
                ctx.fillStyle = "#bbb";
                ctx.textAlign = "left";
                ctx.fillText(field, x0 + 20, y + h / 2);
                ctx.fillStyle = "#ddd";
                ctx.textAlign = "right";
                ctx.fillText(display, x1 - 35, y + h / 2);
                ctx.textAlign = "center";
                ctx.fillStyle = currentIndex > 0 ? "#ddd" : "#777";
                ctx.fillText("◀", x0 + 12, y + h / 2);
                ctx.fillStyle = currentIndex < values.length - 1 ? "#ddd" : "#777";
                ctx.fillText("▶", x1 - 12, y + h / 2);
              } finally {
                ctx.restore();
              }
            },
            mouse(event, pos, owner) {
              const type = String(event?.type || "").toLowerCase();
              if (type !== "pointerup" && type !== "mouseup") return false;
              const width = Number(this.__ultraExtensionWidth) || Number(owner?.size?.[0]) || Number(node?.size?.[0]) || 0;
              const x = localX(event, pos, owner || node);
              if (!Number.isFinite(x) || !(width > 0)) return false;
              const values = definition.values;
              const current = String(this.value ?? definition.defaultValue);
              const index = Math.max(0, values.indexOf(current));
              const inset = groupedRowInset(this);
              if (x < inset || x > width - inset) return false;
              const edge = inset + 25;
              if (x <= edge) {
                if (index > 0) commit(values[index - 1]);
                return true;
              }
              if (x >= width - edge) {
                if (index < values.length - 1) commit(values[index + 1]);
                return true;
              }
              // The row is canvas-only to protect backend positional widget
              // persistence, so it does not inherit a native combo dropdown.
              // Recreate the expected combo behavior with a lightweight DOM
              // popup while keeping the proven left/right stepper arrows.
              try { event?.preventDefault?.(); } catch (_) {}
              try { event?.stopPropagation?.(); } catch (_) {}
              return openExtensionOptionPopup(event, node, this, definition, locale, commit);
            },
          };
          widget[SELF_INDENTED_WIDGET] = true;
          node.addCustomWidget(widget);
        } else {
          // Old frontend fallback only. The persistence guard still detaches this
          // UI-only widget around configure/serialize so backend positions stay
          // untouched.
          widget = node.addWidget("combo", name, definitionValue(node, slot, definition), commit,
            { values: [...definition.values], serialize: false });
        }
        if (!widget) continue;
        widget[EXTENSION_WIDGET_MARKER] = { name, slot, scope: definition.scope, id: definition.id, promptTarget: definition.promptTarget };
        changed = true;
      }
      refreshOneWidget(node, widget, slot, definition, locale);
      changed = moveBeforeAnchor(node, widget, `person_${slot.toLowerCase()}_appearance_preset`) || changed;
    }
  }
  for (const definition of SCENE_BASELINE_DEFINITIONS) {
    const name = sceneBaselineWidgetName(definition);
    let widget = widgetByExactExtensionName(node, name);
    const commit = (incoming) => {
      const canonical = String(incoming ?? definition.defaultValue);
      if (!definition.values.includes(canonical)) return;
      const didChange = setSceneBaselineDefinitionValue(node, definition, canonical);
      const liveWidget = widgetByExactExtensionName(node, name);
      if (liveWidget) refreshStateWidget(node, liveWidget, definition, locale, sceneBaselineDefinitionValue(node, definition));
      if (didChange) {
        try { onChange?.(node, { scope: definition.scope, definition, value: canonical }); } catch (_) {}
        try { node.setDirtyCanvas?.(true, true); } catch (_) {}
        try { node.graph?.setDirtyCanvas?.(true, true); } catch (_) {}
      }
    };
    if (!widget) {
      widget = createCanvasStateWidget(node, name, definition, locale, () => sceneBaselineDefinitionValue(node, definition), commit);
      if (!widget && typeof node.addWidget === "function") {
        widget = node.addWidget("combo", name, sceneBaselineDefinitionValue(node, definition), commit, { values: [...definition.values], serialize: false });
      }
      if (widget) {
        widget[EXTENSION_WIDGET_MARKER] = { name, scope: definition.scope, id: definition.id, promptTarget: definition.promptTarget };
        changed = true;
      }
    }
    if (widget) {
      refreshStateWidget(node, widget, definition, locale, sceneBaselineDefinitionValue(node, definition));
      changed = moveBeforeAnchor(node, widget, "visual_style") || changed;
    }
  }

  for (let turnIndex = 1; turnIndex <= turnCount; turnIndex += 1) {
    for (const definition of TURN_SCENE_DEFINITIONS) {
      const name = turnSceneWidgetName(turnIndex, definition);
      let widget = widgetByExactExtensionName(node, name);
      const commit = (incoming) => {
        const canonical = String(incoming ?? definition.defaultValue);
        if (!definition.values.includes(canonical)) return;
        const didChange = setTurnSceneDefinitionValue(node, turnIndex, definition, canonical);
        const liveWidget = widgetByExactExtensionName(node, name);
        if (liveWidget) refreshStateWidget(node, liveWidget, definition, locale, turnSceneDefinitionValue(node, turnIndex, definition));
        if (didChange) {
          try { onChange?.(node, { scope: definition.scope, turnIndex, definition, value: canonical }); } catch (_) {}
          try { node.setDirtyCanvas?.(true, true); } catch (_) {}
          try { node.graph?.setDirtyCanvas?.(true, true); } catch (_) {}
        }
      };
      if (!widget) {
        widget = createCanvasStateWidget(node, name, definition, locale, () => turnSceneDefinitionValue(node, turnIndex, definition), commit);
        if (!widget && typeof node.addWidget === "function") {
          widget = node.addWidget("combo", name, turnSceneDefinitionValue(node, turnIndex, definition), commit, { values: [...definition.values], serialize: false });
        }
        if (widget) {
          widget[EXTENSION_WIDGET_MARKER] = { name, scope: definition.scope, turnIndex, id: definition.id, promptTarget: definition.promptTarget };
          changed = true;
        }
      }
      if (widget) {
        refreshStateWidget(node, widget, definition, locale, turnSceneDefinitionValue(node, turnIndex, definition));
        changed = moveBeforeAnchor(node, widget, `turn_${turnIndex}_action`) || changed;
      }
    }
  }

  if (changed) {
    try { refreshMetadata?.(node); } catch (_) {}
  }
  return changed;
}

export function refreshExtensionOptions(node, { locale = "en" } = {}) {
  if (!node) return;
  for (const slot of PERSON_SLOTS) {
    for (const definition of personDefinitionList()) {
      const widget = widgetByExtension(node, slot, definition);
      if (widget) refreshOneWidget(node, widget, slot, definition, locale);
    }
  }
  for (const definition of SCENE_BASELINE_DEFINITIONS) {
    const widget = widgetByExactExtensionName(node, sceneBaselineWidgetName(definition));
    if (widget) refreshStateWidget(node, widget, definition, locale, sceneBaselineDefinitionValue(node, definition));
  }
  for (let turnIndex = 1; turnIndex <= 6; turnIndex += 1) {
    for (const definition of TURN_SCENE_DEFINITIONS) {
      const widget = widgetByExactExtensionName(node, turnSceneWidgetName(turnIndex, definition));
      if (widget) refreshStateWidget(node, widget, definition, locale, turnSceneDefinitionValue(node, turnIndex, definition));
    }
  }
}

export function extensionWidgetNamesForPerson(slot) {
  const normalizedSlot = normalizeSlot(slot);
  if (!normalizedSlot) return [];
  return personDefinitionList().map((definition) => widgetName(normalizedSlot, definition));
}

export function hasSceneEnvironmentExtension(node) {
  const state = rawState(node);
  const baseline = state?.scene?.baseline;
  if (baseline && typeof baseline === "object" && !Array.isArray(baseline)) {
    if (String(baseline.location ?? "none") !== "none" || String(baseline.weather ?? "none") !== "none") return true;
  }
  const turns = state?.turn;
  if (turns && typeof turns === "object" && !Array.isArray(turns)) {
    for (const turnState of Object.values(turns)) {
      const scene = turnState?.scene;
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) continue;
      // A reset command alone does not define a visual state when no baseline or
      // earlier explicit override exists. Count only concrete scene/weather values
      // here so the missing-content badge cannot be cleared by a meaningless reset.
      const location = String(scene.location ?? TURN_KEEP_VALUE);
      const weather = String(scene.weather ?? TURN_KEEP_VALUE);
      if (location !== TURN_KEEP_VALUE && location !== TURN_RESET_VALUE) return true;
      if (weather !== TURN_KEEP_VALUE && weather !== TURN_RESET_VALUE) return true;
    }
  }
  return false;
}

export function sceneBaselineWidgetNames() {
  return SCENE_BASELINE_DEFINITIONS.map((definition) => sceneBaselineWidgetName(definition));
}

export function turnSceneWidgetNames(turnIndex) {
  const index = Math.max(1, Math.min(6, Number(turnIndex) || 1));
  return TURN_SCENE_DEFINITIONS.map((definition) => turnSceneWidgetName(index, definition));
}

export function serializeExtensionOptions(node) {
  const state = rawState(node);
  if (!state || typeof state !== "object" || Array.isArray(state)) return "{}";
  let encoded;
  try { encoded = JSON.stringify(state); } catch (_) { return "{}"; }
  // This transport carries only small UI option IDs. Refuse pathological
  // workflow property payloads without breaking queue execution.
  return encoded.length <= 131072 ? encoded : "{}";
}

export function installExtensionTransport(node) {
  const widget = (node?.widgets || []).find((item) => item?.name === EXTENSION_OPTIONS_TRANSPORT);
  if (!widget) return false;
  widget.hidden = true;
  widget.options = { ...(widget.options || {}), hidden: true };
  // Same contract used by the existing validation/locale runtime widgets:
  // omitted from workflow widgets_values, but graphToPrompt still calls
  // serializeValue to supply the live value to the backend.
  widget.serialize = false;
  widget.serializeValue = () => serializeExtensionOptions(node);
  return true;
}

export function snapshotExtensionOptions(node) {
  const value = rawState(node);
  return value ? cloneJsonSafe(value) : undefined;
}

export function restoreExtensionOptionsSnapshot(node, snapshot, { locale = "en" } = {}) {
  if (!node) return;
  node.properties ??= {};
  if (snapshot === undefined) delete node.properties[EXTENSION_OPTIONS_PROPERTY];
  else node.properties[EXTENSION_OPTIONS_PROPERTY] = cloneJsonSafe(snapshot);
  refreshExtensionOptions(node, { locale });
}

export function resetExtensionOptions(node, { locale = "en" } = {}) {
  if (!node) return;
  node.properties ??= {};
  delete node.properties[EXTENSION_OPTIONS_PROPERTY];
  refreshExtensionOptions(node, { locale });
}
