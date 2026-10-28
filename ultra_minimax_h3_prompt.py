from __future__ import annotations

import hashlib
import json
import math
import os
import re
import threading
import time
import unicodedata
from collections import deque
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple

try:
    from comfy_execution.graph import ExecutionBlocker
except ImportError:  # Standalone validation/import outside ComfyUI.
    ExecutionBlocker = None

VERSION = "3.50"

MODE_VALUES = ("auto", "t2va", "i2va", "fl2va", "l2va")
SHOT_LAYOUT_VALUES = ("auto_safe", "single", "two", "three", "four")
STYLE_VALUES = (
    "auto",
    "cinematic",
    "family_film",
    "warm_cinematic",
    "natural",
    "live_action",
    "live_action_cinematic",
    "2d_animated",
    "japanese_anime",
    "3d_cg",
    "claymation",
    "watercolor",
    "vintage_film",
    "monochrome_cinematic",
    "film_noir",
    "dark_fantasy",
    "cinematic_horror",
    "ominous_dark",
    "post_apocalyptic",
    "gothic",
    "cyberpunk",
    "dreamlike",
)
CAMERA_VALUES = (
    "auto",
    "static",
    "zoom_in",
    "zoom_out",
    "push_in",
    "pull_out",
    "pan_left",
    "pan_right",
    "truck_left",
    "truck_right",
    "tilt_up",
    "tilt_down",
    "pedestal_up",
    "pedestal_down",
    "arc_shot",
    "tracking_shot",
    "handheld_tracking",
    "shake_slightly",
    "shake_strongly",
    "pov",
    "roll_clockwise",
    "roll_counterclockwise",
)
CAMERA_AMPLITUDE_VALUES = ("default", "small", "large")
CAMERA_SPEED_VALUES = ("default", "slow", "fast")
# Later shots may inherit the Shot 1/base modifier or override/omit it per shot.
CAMERA_SHOT_AMPLITUDE_VALUES = ("inherit",) + CAMERA_AMPLITUDE_VALUES
CAMERA_SHOT_SPEED_VALUES = ("inherit",) + CAMERA_SPEED_VALUES
CAMERA_TRANSITION_VALUES = (
    "cut",
    "cross_dissolve",
    "fade",
    "wipe",
)
REFERENCE_FIDELITY_VALUES = ("strict", "balanced", "creative")
SOUNDSCAPE_VALUES = ("auto", "minimal", "custom_only", "silent")
MUSIC_VALUES = (
    "none",
    "sparse_piano_strings",
    "acoustic_guitar_bass",
    "classical_guitar",
    "soft_light_music",
    "gentle_classical",
    "lyrical_harp_cello",
    "light_jazz",
    "bossa_nova",
    "korean_traditional_fusion",
    "vintage_pop",
    "modern_pop",
    "kpop_style",
    "kpop_dance",
    "fast_rap_beat",
    "oldschool_hiphop",
    "funk_groove",
    "rock_drive",
    "ambient_synth",
    "dark_ambient",
    "electronic_pulse",
    "upbeat_electronic",
    "minimal_luxury_electronic",
    "tech_product_pulse",
    "synthwave",
    "dream_pop",
    "cinematic_percussion",
    "orchestral_rise",
    "cheerful_march",
    "grand_march",
    "celestial_space",
    "mystic_fantasy",
    "custom",
)
DIALOGUE_LANGUAGE_VALUES = (
    "auto",
    "English",
    "Korean",
    "Japanese",
    "Chinese",
    "Spanish",
    "French",
    "German",
    "Russian",
    "Arabic",
    "Italian",
    "Portuguese",
)
DIALOGUE_DELIVERY_VALUES = ("on_screen", "voiceover")
NARRATOR_VOICE_PRESET_VALUES = (
    "auto",
    "calm_neutral",
    "warm_female",
    "calm_female",
    "bright_female",
    "low_calm_male",
    "warm_male",
    "mature_male",
    "documentary",
    "news_information",
    "cinematic",
    "soft_emotional",
    "tense_low",
    "custom",
)
NARRATOR_VOICE_PRESET_TEXT = {
    "calm_neutral": "a calm, neutral adult narrator voice with clear and restrained delivery",
    "warm_female": "a warm adult female narrator voice with gentle, reassuring delivery",
    "calm_female": "a calm adult female narrator voice with clear, measured delivery",
    "bright_female": "a bright adult female narrator voice with clear, lively delivery",
    "low_calm_male": "a low, calm adult male narrator voice with clear and measured delivery",
    "warm_male": "a warm adult male narrator voice with natural, reassuring delivery",
    "mature_male": "a mature adult male narrator voice with a deep, composed tone and clear delivery",
    "documentary": "a composed documentary narrator voice with clear, objective, measured delivery",
    "news_information": "a clear professional information narrator voice with precise, neutral delivery",
    "cinematic": "a cinematic narrator voice with controlled depth, clear articulation, and dramatic restraint",
    "soft_emotional": "a soft, emotionally warm narrator voice with gentle, intimate delivery",
    "tense_low": "a low, tense narrator voice with restrained, suspenseful delivery",
}
SCENE_ROLE_VALUES = ("auto_safe", "scene_action", "dialogue")
SCENE_TRANSLATE_VALUES = ("ko_to_en", "off")
GENDER_VALUES = ("unspecified", "female", "male", "nonbinary")
AGE_VALUES = ("unspecified", "child", "teen", "twenties", "thirties", "forties", "fifties", "sixties", "elderly")
EXTENSION_OPTIONS_VERSION = 2
SCENE_LOCATION_TEXT = {
    'modern_city_street': 'a modern city street with storefronts, glass facades, moderate traffic, and a few anonymous pedestrians moving at an ordinary real-time pace',
    'busy_crosswalk': 'a busy urban crosswalk with marked lanes, signal lights, vehicles, and groups of anonymous pedestrians crossing at normal walking speed',
    'neon_district': 'a dense neon-lit entertainment district with bright signage, storefront reflections, moderate traffic, and ordinary pedestrian activity at normal real-time speed',
    'narrow_urban_alley': 'a narrow urban alley with hanging signs, vents, textured walls, and occasional anonymous passersby, with only slow local steam drift where present',
    'old_european_street': 'a historic European street lined with stone facades, cafes, parked bicycles, and light pedestrian activity at a natural pace',
    'seoul_downtown': 'a busy downtown Seoul street with multilayered signage, storefronts, normal traffic, and ordinary pedestrian activity at real-time speed',
    'paris_boulevard': 'a broad Parisian boulevard with tree-lined sidewalks, cafe awnings, light traffic, and a modest number of pedestrians moving naturally at an ordinary pace',
    'new_york_avenue': 'a busy New York avenue with tall facades, taxis and other traffic, crosswalks, and natural real-time pedestrian activity',
    'tokyo_neon_street': 'a vivid Tokyo-style neon street with layered signage, storefront reflections, moderate traffic, and natural pedestrian activity at normal real-time speed',
    'city_square': 'a spacious city square with open paving, surrounding architecture, a modest crowd, and calm ordinary pedestrian movement',
    'riverside_promenade': 'a riverside promenade beside gently flowing water, with trees, railings, distant city reflections, and occasional pedestrians',
    'pedestrian_bridge': 'an elevated pedestrian bridge with railings, city depth, occasional pedestrians, and traffic or trains visible below at ordinary speed where present',
    'traffic_intersection': 'a large busy traffic intersection with multiple lanes, crosswalks, signal lights, turning lanes, and ordinary real-time traffic',
    'city_rooftop': 'an open city rooftop with a deep skyline, rooftop structures, railings, and only subtle natural movement in exposed lightweight elements',
    'crowded_night_market': 'a crowded night market with tightly packed illuminated stalls, hanging signs, food steam, and pedestrians moving at ordinary walking speed',
    'busy_street_market': 'a busy street market with tightly packed stalls, shoppers, vendors, fabric canopies, and normal real-time market activity',
    'festival_plaza': 'a lively festival plaza with decorations, stalls, lights, and a moderate crowd moving at a normal real-time pace',
    'amusement_park': 'an active amusement park with illuminated rides, game stalls, visitors, and ride motion occurring at ordinary real-time speed',
    'stadium_concourse': 'a crowded stadium concourse with concession signs, entrances, spectators, and steady but natural foot traffic',
    'packed_subway_car': 'a tightly packed subway car with commuters standing close together, overhead straps, doors, windows, and subtle body sway consistent with normal train motion',
    'busy_subway_platform': 'a busy subway platform with waiting commuters, platform signs, a train at or near the platform, and normal boarding-area activity',
    'busy_train_station': 'a large train-station concourse with travelers, luggage, information displays, platforms, and normal pedestrian flow',
    'moving_train_interior': 'the interior of a moving train with seated and standing passengers, carriage fittings, and scenery passing the windows at normal travel speed',
    'busy_airport_terminal': 'a busy airport terminal with travelers, luggage, flight displays, gates, and steady pedestrian activity at an ordinary pace',
    'busy_bus_terminal': 'a busy bus terminal with buses at marked bays, passengers, destination displays, and normal boarding activity',
    'underground_parking': 'an underground parking garage with concrete lanes, parked vehicles, overhead lights, and occasional vehicles moving at low normal speed',
    'road_tunnel': 'a long road tunnel with repeating ceiling lights, lane markings, and vehicles traveling at normal road speed',
    'harbor_pier': 'a working harbor pier with moored boats, ropes, flags, dock equipment, and gentle water movement',
    'modern_cafe': 'a modern cafe with tables, counter equipment, window reflections, and sparse background patrons, with subtle steam where present',
    'cozy_cafe': 'a cozy cafe with warm interior lighting, tables, glass reflections, and restrained background activity, with subtle steam where present',
    'rooftop_cafe': 'a rooftop cafe overlooking the city, with awnings, tables, hanging lights, and a gentle natural breeze in exposed fabric where present',
    'lively_restaurant': 'a lively restaurant with tables, staff, diners, serving areas, and normal background service activity',
    'hotel_lobby': 'an elegant hotel lobby with polished floors, seating, elevators, luggage, and a modest flow of guests at a normal pace',
    'busy_shopping_mall': 'a busy shopping mall with multi-level storefronts, escalators, shoppers, and steady ordinary foot traffic',
    'art_gallery': 'a spacious art gallery with exhibits, open circulation paths, and a few visitors moving slowly between works',
    'modern_office': 'a modern office with desks, monitors, glass partitions, and occasional coworkers moving naturally in the distant background',
    'industrial_warehouse': 'a large industrial warehouse with racks, machinery, ventilation, suspended chains or curtains, and restrained distant activity',
    'active_factory_floor': 'an active factory floor with conveyor systems, machinery, indicator lights, and distant workers, with equipment operating at normal industrial speed',
    'busy_kitchen': 'a busy professional kitchen with workstations, cookware, steam, and staff moving purposefully at a normal working pace',
    'greenhouse': 'a glass greenhouse filled with plants, condensation, diffuse light, and only gentle leaf or mist movement where present',
    'open_beach': 'a wide sandy beach with regular waves reaching shore, foam, wet sand reflections, and subtle coastal vegetation movement',
    'rough_wave_seashore': 'a windswept seashore with powerful waves crashing against the shore, sea spray, turbulent water, and forceful wave motion at natural real-time speed',
    'rocky_coast': 'a rugged rocky coast with waves striking the rocks, sea spray, wet stone, and natural continuous ocean motion',
    'tropical_shore': 'a tropical shoreline with rolling waves, palm trees, bright water, and gentle coastal vegetation movement',
    'dense_forest': 'a dense natural forest with layered trunks, leaves, and deep foliage, with only localized natural leaf and branch movement',
    'pine_forest': 'a pine forest with layered trunks and needles, deep natural depth, and gentle localized branch movement',
    'bamboo_forest': 'a bamboo forest with tall stalks, dense leaves, layered depth, and gentle natural sway where wind reaches them',
    'open_meadow': 'an open meadow with tall grass and scattered plants, with a light natural ripple through nearby grass',
    'flower_field': 'a broad flower field with layered blossoms and stems, with gentle localized sway in nearby plants',
    'lakeside': 'a peaceful lakeside with calm water, small ripples, reeds, shoreline plants, and stable reflections',
    'riverbank': 'a natural riverbank with a steady current, reeds, branches, and reflections moving with the water at a normal pace',
    'mountain_valley': 'a broad mountain valley with layered slopes, distant haze, sparse vegetation, and slow natural cloud or mist drift',
    'mountain_ridge': 'a high mountain ridge with distant peaks, exposed grass, mist, and slow natural atmospheric drift',
    'waterfall': 'a large waterfall environment with continuous falling water, spray, mist, and churning pool motion at natural real-time speed',
    'canyon': 'a vast canyon with layered rock walls, distant haze, sparse dust, and mostly stable atmospheric depth',
    'desert_dunes': 'a vast desert of rolling dunes with fine surface texture, distant heat haze, and slight low sand drift where wind is present',
    'rocky_desert': 'a barren rocky desert with stones, dry ground, distant heat haze, and occasional light dust drift',
    'snowfield': 'a vast snow-covered landscape with broad open snow, distant ridges, stable visibility, and occasional fine powder drifting close to the surface',
    'glacier': 'a glacial landscape with blue ice, crevasses, meltwater, distant mist, and subtle natural surface reflections',
    'construction_site': 'an active construction site with cranes, machinery, materials, and distant workers, with only task-relevant equipment moving at normal working speed',
    'wind_turbine_field': 'an open landscape of large wind turbines with blades rotating steadily at realistic speed, with grass and distant turbines remaining visually stable',
    'futuristic_city': 'a futuristic city with advanced architecture, illuminated transit routes, digital displays, and restrained real-time background activity',
    'space_station': 'a large space-station interior with control displays, mechanical structures, windows or corridors, and restrained localized system activity',
    'ancient_ruins': 'an ancient ruin complex with broken stone structures, sparse vegetation, shafts of light, and subtle natural dust or foliage movement',
    'fantasy_forest': 'a fantastical forest with luminous plants or particles, layered foliage, and subtle localized magical atmospheric motion',
}
WEATHER_TEXT = {
    'clear': 'clear and stable, with crisp visibility, stable daylight, and a calm atmosphere',
    'partly_cloudy': 'partly cloudy, with mixed sunlight and cloud cover and only slow natural light variation',
    'overcast': 'fully overcast, with broad soft ambient light, muted contrast, and stable cloud cover',
    'light_drizzle': 'a fine drizzle falling lightly through exposed outdoor air, with small droplets and subtle wetting of nearby surfaces',
    'light_rain': 'light rain falling steadily with visible droplets, small splashes, and wet outdoor surfaces at a natural real-time rate',
    'steady_rain': 'steady rainfall with visible rain streaks, consistent splashes, wet reflections, and natural real-time water movement',
    'heavy_rain': 'heavy rain falling densely across exposed outdoor areas with strong visible streaks, pronounced splashes, and reduced distant clarity at a consistent real-time rate',
    'wind_driven_rain': 'heavy rain driven diagonally by strong wind, with visible sheets and localized movement in exposed hair, loose clothing, and nearby vegetation at natural speed',
    'torrential_rain': 'torrential rain pouring down in dense sheets with intense nearby splashes, flowing runoff, and strongly reduced visibility at natural real-time speed',
    'thunderstorm': 'a strong thunderstorm with heavy rain, occasional lightning flashes, gusting wind, and reduced distant visibility',
    'severe_thunderstorm': 'a severe thunderstorm with dense wind-driven rain, intermittent bright lightning, powerful gusts, and strongly reduced visibility',
    'light_snow': 'light snow falling gently with sparse flakes drifting through the air and a subtle surface dusting',
    'steady_snow': 'steady snowfall with layered flakes moving through visible depth, soft outdoor surface coverage, and softened distant visibility',
    'heavy_snow': 'heavy snowfall with dense flakes across multiple depth layers, established snow cover, and noticeably reduced background visibility',
    'blizzard': 'a fierce blizzard with dense wind-driven snow, powerful gusts, blowing surface powder, and severely reduced visibility at natural real-time speed',
    'light_breeze': 'a light breeze gently moving exposed hair, loose fabric, and nearby leaves or grass where present',
    'steady_wind': 'steady wind moving exposed hair, loose clothing, and nearby vegetation at a consistent natural speed',
    'strong_wind': 'strong sustained wind clearly moving exposed hair, loose clothing, and nearby vegetation at natural real-time speed',
    'violent_gusts': 'powerful irregular gusts causing brief forceful movement in exposed hair, loose fabric, nearby vegetation, and surface dust where present',
    'light_fog': 'light fog with mild visibility reduction and only subtle slow drift through the local air',
    'dense_fog': 'dense fog blanketing the scene and strongly reducing distant visibility, with only subtle slow local drift',
    'low_mist': 'low mist resting near the ground or water surface, drifting slowly and locally while softening nearby depth',
    'dusty_wind': 'dry gusting wind carrying localized dust and fine debris through exposed areas, with intermittent visibility reduction at a natural pace',
    'sandstorm': 'a powerful sandstorm with dense wind-driven sand, turbulent airborne particles, and strongly reduced visibility at natural real-time speed',
    'hailstorm': 'a violent hailstorm with fast-falling hail, natural impacts and rebounds on exposed surfaces, heavy precipitation, and strong gusting wind',
}
TURN_SCENE_KEEP = "keep"
TURN_SCENE_RESET = "reset_to_baseline"

# Weather is an exterior/environment state. When the selected location is an
# enclosed interior, keep rain/snow/wind outside instead of accidentally asking
# H3 to make it rain inside a subway car, cafe, terminal, etc. The weather can
# still remain visible through windows/openings and through indirect light or
# reflection changes. This is compiler context only; it does not alter the
# canonical UI values or reject deliberately unusual location/weather pairs.
ENCLOSED_SCENE_LOCATIONS = frozenset({
    "packed_subway_car", "busy_subway_platform", "busy_train_station",
    "moving_train_interior", "busy_airport_terminal", "busy_bus_terminal",
    "underground_parking", "road_tunnel", "modern_cafe", "cozy_cafe",
    "lively_restaurant", "hotel_lobby", "busy_shopping_mall", "art_gallery",
    "modern_office", "industrial_warehouse", "active_factory_floor",
    "busy_kitchen", "greenhouse", "space_station",
})
EXTENSION_OPTION_DEFINITIONS = {
    "person.profile.ethnic_appearance": {
        "scope": "person.profile",
        "prompt_target": "appearance",
        "order": 10,
        "default": "none",
        "values": {
            "none": "",
            "korean": "Korean facial features",
            "east_asian": "East Asian facial features",
            "southeast_asian": "Southeast Asian facial features",
            "south_asian": "South Asian facial features",
            "central_asian": "Central Asian facial features",
            "west_asian_middle_eastern": "Middle Eastern or West Asian facial features",
            "european": "European facial features",
            "african": "African facial features",
            "latin_american": "Latin American facial features",
            "mixed_heritage": "a mixed-heritage appearance",
        },
    },
    "scene.baseline.location": {"scope": "scene.baseline", "prompt_target": "environment", "order": 10, "default": "none", "values": {"none": "", **SCENE_LOCATION_TEXT}},
    "scene.baseline.weather": {"scope": "scene.baseline", "prompt_target": "environment", "order": 20, "default": "none", "values": {"none": "", **WEATHER_TEXT}},
}

def _parse_extension_options_json(raw: Any) -> dict:
    """Parse scoped Extension Options without disturbing legacy positional inputs."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        source = raw
    else:
        text = str(raw or "").strip()
        if not text or text == "{}" or len(text) > 131072:
            return {}
        try:
            source = json.loads(text)
        except Exception:
            return {}
    if not isinstance(source, dict):
        return {}

    clean: dict = {}
    person = source.get("person")
    if isinstance(person, dict):
        person_clean = {}
        definition = EXTENSION_OPTION_DEFINITIONS["person.profile.ethnic_appearance"]
        valid_values = definition["values"]
        default = definition["default"]
        for slot in ("A", "B", "C"):
            slot_state = person.get(slot)
            if not isinstance(slot_state, dict):
                continue
            profile = slot_state.get("profile")
            if not isinstance(profile, dict):
                continue
            value = str(profile.get("ethnic_appearance", default) or default)
            if value == default or value not in valid_values:
                continue
            person_clean[slot] = {"profile": {"ethnic_appearance": value}}
        if person_clean:
            clean["person"] = person_clean

    scene = source.get("scene")
    if isinstance(scene, dict):
        baseline = scene.get("baseline")
        if isinstance(baseline, dict):
            baseline_clean = {}
            location = str(baseline.get("location", "none") or "none")
            weather = str(baseline.get("weather", "none") or "none")
            if location != "none" and location in SCENE_LOCATION_TEXT:
                baseline_clean["location"] = location
            if weather != "none" and weather in WEATHER_TEXT:
                baseline_clean["weather"] = weather
            if baseline_clean:
                clean["scene"] = {"baseline": baseline_clean}

    turn_source = source.get("turn")
    if isinstance(turn_source, dict):
        turn_clean = {}
        valid_location = set(SCENE_LOCATION_TEXT) | {TURN_SCENE_RESET}
        valid_weather = set(WEATHER_TEXT) | {TURN_SCENE_RESET}
        for index in range(1, MAX_TURNS + 1):
            raw_turn = turn_source.get(str(index), turn_source.get(index))
            if not isinstance(raw_turn, dict):
                continue
            raw_scene = raw_turn.get("scene")
            if not isinstance(raw_scene, dict):
                continue
            scene_clean = {}
            location = str(raw_scene.get("location", TURN_SCENE_KEEP) or TURN_SCENE_KEEP)
            weather = str(raw_scene.get("weather", TURN_SCENE_KEEP) or TURN_SCENE_KEEP)
            if location != TURN_SCENE_KEEP and location in valid_location:
                scene_clean["location"] = location
            if weather != TURN_SCENE_KEEP and weather in valid_weather:
                scene_clean["weather"] = weather
            if scene_clean:
                turn_clean[str(index)] = {"scene": scene_clean}
        if turn_clean:
            clean["turn"] = turn_clean
    return clean


def _extension_scene_baseline(extension_options: dict) -> dict:
    baseline = (extension_options or {}).get("scene", {}).get("baseline", {})
    if not isinstance(baseline, dict):
        baseline = {}
    return {
        "location": str(baseline.get("location", "none") or "none"),
        "weather": str(baseline.get("weather", "none") or "none"),
    }


def _extension_turn_scene(extension_options: dict, index: int) -> dict:
    turn = (extension_options or {}).get("turn", {}).get(str(int(index)), {})
    scene = turn.get("scene", {}) if isinstance(turn, dict) else {}
    if not isinstance(scene, dict):
        scene = {}
    return {
        "location": str(scene.get("location", TURN_SCENE_KEEP) or TURN_SCENE_KEEP),
        "weather": str(scene.get("weather", TURN_SCENE_KEEP) or TURN_SCENE_KEEP),
    }


def _turn_scene_has_change(turn: dict) -> bool:
    return any(str(turn.get(key, TURN_SCENE_KEEP) or TURN_SCENE_KEEP) != TURN_SCENE_KEEP for key in ("scene_location_override", "scene_weather_override"))


def _extension_has_explicit_environment_state(extension_options: dict) -> bool:
    """Return True only when the extension actually defines a scene/weather state.

    A bare `reset_to_baseline` with no baseline and no earlier explicit override
    cannot create visual content by itself. Treating it as content would make the
    UI look valid while the compiler still has no scene to generate.
    """
    baseline = _extension_scene_baseline(extension_options or {})
    if any(value != "none" for value in baseline.values()):
        return True
    for index in range(1, MAX_TURNS + 1):
        scene = _extension_turn_scene(extension_options or {}, index)
        if scene.get("location") in SCENE_LOCATION_TEXT or scene.get("weather") in WEATHER_TEXT:
            return True
    return False


def _weather_is_exterior_scoped(location: str) -> bool:
    return str(location or "") in ENCLOSED_SCENE_LOCATIONS




# Structured environment options feed only high-confidence ambience keywords
# into the existing Auto Sound inference.  Do not pass the full visual preset
# prose here: background phrases such as "pedestrians walking" would otherwise
# be misread as a main-subject footstep action.  This keeps legacy scene_prompt
# sound inference byte-for-byte unchanged while letting the new scene/weather
# menus contribute appropriate ambience.
_ENV_SOUND_TRAFFIC_LOCATIONS = frozenset({
    "modern_city_street", "busy_crosswalk", "seoul_downtown", "paris_boulevard",
    "new_york_avenue", "tokyo_neon_street", "traffic_intersection",
    "pedestrian_bridge", "underground_parking", "road_tunnel",
})
_ENV_SOUND_MARKET_LOCATIONS = frozenset({"crowded_night_market", "busy_street_market", "festival_plaza", "stadium_concourse"})
_ENV_SOUND_CAFE_LOCATIONS = frozenset({"modern_cafe", "cozy_cafe"})
_ENV_SOUND_COAST_LOCATIONS = frozenset({"open_beach", "rough_wave_seashore", "rocky_coast", "tropical_shore", "harbor_pier"})
_ENV_SOUND_FOREST_LOCATIONS = frozenset({"dense_forest", "pine_forest", "bamboo_forest", "fantasy_forest"})
_ENV_SOUND_RAIL_LOCATIONS = frozenset({"packed_subway_car", "busy_subway_platform", "busy_train_station", "moving_train_interior"})
_ENV_SOUND_RAIN_WEATHER = frozenset({"light_drizzle", "light_rain", "steady_rain", "heavy_rain", "wind_driven_rain", "torrential_rain", "thunderstorm", "severe_thunderstorm"})
_ENV_SOUND_WIND_WEATHER = frozenset({"wind_driven_rain", "thunderstorm", "severe_thunderstorm", "light_breeze", "steady_wind", "strong_wind", "violent_gusts", "dusty_wind", "sandstorm", "hailstorm", "blizzard"})

def _structured_environment_sound_cues(location: str, weather: str) -> str:
    location = str(location or "none")
    weather = str(weather or "none")
    cues: List[str] = []
    if location in _ENV_SOUND_TRAFFIC_LOCATIONS:
        cues.append("city street traffic")
    if location in _ENV_SOUND_MARKET_LOCATIONS:
        cues.append("street market crowd")
    if location in _ENV_SOUND_CAFE_LOCATIONS:
        cues.append("cafe")
    if location in _ENV_SOUND_COAST_LOCATIONS:
        cues.append("beach ocean")
    if location in _ENV_SOUND_FOREST_LOCATIONS:
        cues.append("forest")
    if location in _ENV_SOUND_RAIL_LOCATIONS:
        cues.append("moving train")
    if location == "busy_kitchen":
        cues.append("kitchen")
    # Weather is exterior-scoped for enclosed locations.  Do not create an
    # interior rain/wind sound merely because the exterior weather preset is set.
    if not _weather_is_exterior_scoped(location):
        if weather in _ENV_SOUND_RAIN_WEATHER:
            cues.append("rain")
        if weather in _ENV_SOUND_WIND_WEATHER:
            cues.append("wind")
    return " ".join(cues)



def _structured_environment_sound_description(location: str, weather: str) -> str:
    location = str(location or "none")
    weather = str(weather or "none")
    parts: List[str] = []
    if location in _ENV_SOUND_TRAFFIC_LOCATIONS:
        parts.append("low city traffic ambience")
    elif location in _ENV_SOUND_MARKET_LOCATIONS:
        parts.append("open-air crowd and market ambience")
    elif location in _ENV_SOUND_CAFE_LOCATIONS:
        parts.append("quiet cafe room tone")
    elif location in _ENV_SOUND_COAST_LOCATIONS:
        parts.append("coastal water ambience")
    elif location in _ENV_SOUND_FOREST_LOCATIONS:
        parts.append("natural forest ambience")
    elif location in _ENV_SOUND_RAIL_LOCATIONS:
        parts.append("rail and carriage ambience")
    elif location == "busy_kitchen":
        parts.append("professional kitchen work sounds")
    elif location == "amusement_park":
        parts.append("restrained amusement-park ride and crowd ambience")
    elif location == "active_factory_floor":
        parts.append("industrial machinery ambience")
    elif location == "construction_site":
        parts.append("restrained construction-site machinery ambience")

    if not _weather_is_exterior_scoped(location):
        if weather in _ENV_SOUND_RAIN_WEATHER:
            parts.append("rain audible on nearby exposed surfaces")
        if weather in _ENV_SOUND_WIND_WEATHER:
            parts.append("wind intensity matching the visible weather")
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} with {parts[1]}"
    return f"{parts[0]}, with " + " and ".join(parts[1:])


def _structured_environment_sound_timeline(opening_state: dict, turns: Sequence[dict]) -> str:
    phases: List[Tuple[float, str]] = []
    current_location = str((opening_state or {}).get("location", "none") or "none")
    current_weather = str((opening_state or {}).get("weather", "none") or "none")
    opening_desc = _structured_environment_sound_description(current_location, current_weather)
    if opening_desc:
        phases.append((0.0, opening_desc))
    last_desc = opening_desc
    for turn in turns or ():
        if not str(turn.get("environment_change_sentence", "") or "").strip():
            continue
        elapsed = float(turn.get("elapsed_seconds", 0.0))
        current_location = str(turn.get("resolved_scene_location", current_location) or current_location)
        current_weather = str(turn.get("resolved_scene_weather", current_weather) or current_weather)
        desc = _structured_environment_sound_description(current_location, current_weather)
        # A transition from a strong structured ambience (rain/wind/traffic/etc.)
        # to a state with no dedicated cue must still end the earlier ambience.
        # Otherwise H3 can carry rain or wind through the rest of the clip.
        if desc != last_desc:
            if desc:
                phases.append((elapsed, desc))
            elif last_desc:
                phases.append((elapsed, "__minimal_natural_ambience__"))
            last_desc = desc
    if not phases:
        return ""
    first_time, first_desc = phases[0]
    if first_desc == "__minimal_natural_ambience__":
        chunks = [
            "Opening environment-specific ambience is minimal; only natural incidental background sound is present"
            if first_time <= 1e-9
            else f"At approximately {first_time:.2f} seconds, prior environment-specific ambience subsides to minimal natural background sound"
        ]
    else:
        chunks = [f"Opening environmental ambience is {first_desc}" if first_time <= 1e-9 else f"At approximately {first_time:.2f} seconds, environmental ambience is {first_desc}"]
    for elapsed, desc in phases[1:]:
        if desc == "__minimal_natural_ambience__":
            chunks.append(f"at approximately {elapsed:.2f} seconds the previous environment-specific ambience subsides to minimal natural background sound")
        else:
            chunks.append(f"at approximately {elapsed:.2f} seconds it shifts to {desc}")
    return _ensure_terminal_punctuation("; ".join(chunks))


_STRUCTURED_ENV_AUTO_SOUND_SENTENCES = (
    "Steady rain is audible on nearby surfaces, with water movement matching the visible weather.",
    "Wind moves through the environment with intensity matching the visible motion of hair, fabric, and surrounding objects.",
    "Coastal water movement creates a steady natural ambience around the visible scene.",
    "Low natural outdoor ambience continues around the visible forest environment.",
    "Distant engines, tire noise, and intermittent traffic movement form a low urban sound bed.",
    "Low urban ambience continues underneath the visible action.",
    "Quiet indoor room tone continues with subtle interior sounds matching visible movement.",
    "Quiet shop ambience continues with light counter, tray, packaging, and work-surface sounds when those actions are visible.",
    "Low open-air public-space ambience continues around the visible market or gathering.",
)


def _merge_structured_environment_soundscape(base_soundscape: str, environment_timeline: str) -> str:
    timeline = str(environment_timeline or "").strip()
    base = str(base_soundscape or "").strip()
    if not timeline:
        return base
    generic = "Natural ambient sound follows the visible environment, with physical action sounds synchronized to movement."
    if base == generic:
        base = ""
    # Structured environment menus own location/weather ambience over time. Remove
    # only generic ambient sentences that could otherwise continue after their
    # location has ended; synchronized action/object sounds remain untouched.
    for sentence in _STRUCTURED_ENV_AUTO_SOUND_SENTENCES:
        base = base.replace(sentence, " ")
    base = re.sub(r"\s+", " ", base).strip()
    if not base:
        return _enforce_h3_sentence_limit(timeline, "overall_soundscape", 4)
    return _enforce_h3_sentence_limit(f"{timeline} {base}", "overall_soundscape", 4)

def _opening_weather_sentence(weather: str, location: str) -> str:
    weather_text = WEATHER_TEXT.get(str(weather or ""), "")
    if not weather_text:
        return ""
    if _weather_is_exterior_scoped(location):
        return _ensure_terminal_punctuation(
            f"Outside the enclosed setting, the opening weather is {weather_text}; "
            "the interior remains physically sheltered, while exterior conditions may be visible through windows or openings where applicable"
        )
    return _ensure_terminal_punctuation(f"The opening weather is {weather_text}")


def _continuing_weather_sentence(weather: str, location: str) -> str:
    weather_text = WEATHER_TEXT.get(str(weather or ""), "")
    if not weather_text:
        return ""
    if _weather_is_exterior_scoped(location):
        return _ensure_terminal_punctuation(
            f"The existing weather continues outside the enclosed setting as {weather_text}; "
            "the interior remains physically sheltered, while exterior conditions may remain visible through windows or openings where applicable"
        )
    return _ensure_terminal_punctuation(f"The existing weather continues across the new environment as {weather_text}")


def _post_apocalyptic_location_text(location_text: str) -> str:
    """Keep the selected place recognizable while removing normal-operation cues.

    This is intentionally conservative: only phrases that strongly imply a normally
    functioning populated world are softened.  The underlying location identity and
    physically meaningful motion (waves, wind turbines, waterfalls, trains, etc.)
    remain intact.
    """
    value = str(location_text or "").strip()
    replacements = (
        (r"\ba busy\b", "a formerly busy"),
        (r"\ba crowded\b", "a formerly crowded"),
        (r"\ba lively\b", "a formerly lively"),
        (r"\ban active\b", "a formerly active"),
        (r"\ba working harbor pier\b", "a harbor pier"),
        (r"\bmoderate traffic\b", "sparse survivor-era vehicle movement"),
        (r"\blight traffic\b", "sparse survivor-era vehicle movement"),
        (r"\bnormal traffic\b", "sparse survivor-era vehicle movement"),
        (r"\bordinary real-time traffic\b", "sparse survivor-era vehicle movement at natural real-time speed"),
        (r"\btaxis and other traffic\b", "abandoned vehicles and sparse survivor-era traffic"),
        (r"\bsteady ordinary foot traffic\b", "sparse survivor movement"),
        (r"\bsteady pedestrian activity at an ordinary pace\b", "sparse survivor movement at a natural pace"),
        (r"\bnormal pedestrian flow\b", "sparse survivor movement"),
        (r"\bnormal boarding activity\b", "limited survivor-era boarding activity"),
        (r"\bnormal boarding-area activity\b", "limited survivor-era platform activity"),
        (r"\bnormal background service activity\b", "sparse improvised service activity"),
        (r"\bnormal real-time market activity\b", "sparse survivor-market activity at natural real-time speed"),
        (r"\bordinary pedestrian activity at normal real-time speed\b", "sparse survivor movement at natural real-time speed"),
        (r"\bnatural real-time pedestrian activity\b", "sparse survivor movement at natural real-time speed"),
        (r"\bnatural pedestrian activity at normal real-time speed\b", "sparse survivor movement at natural real-time speed"),
        (r"\blight pedestrian activity at a natural pace\b", "sparse survivor movement at a natural pace"),
        (r"\ba modest number of pedestrians moving naturally at an ordinary pace\b", "a few survivors moving naturally at an ordinary pace"),
        (r"\ba few anonymous pedestrians moving at an ordinary real-time pace\b", "a few survivors moving at an ordinary real-time pace"),
        (r"\bgroups of anonymous pedestrians crossing at normal walking speed\b", "a few survivors crossing at normal walking speed"),
        (r"\bpedestrians moving at ordinary walking speed\b", "survivors moving at ordinary walking speed"),
        (r"\bshoppers, vendors\b", "survivors and improvised vendors"),
        (r"\bshoppers\b", "survivors"),
        (r"\btravelers\b", "survivors"),
        (r"\bcommuters\b", "survivors"),
        (r"\bvisitors\b", "survivors"),
        (r"\bspectators\b", "survivors"),
        (r"\bguests\b", "survivors"),
        (r"\bcoworkers\b", "survivors"),
        (r"\bdistant workers\b", "a few survivor workers"),
        (r"\bstaff moving purposefully at a normal working pace\b", "a few survivors working at a natural pace"),
        (r"\bequipment operating at normal industrial speed\b", "only sparse survivor-operated equipment moving at natural speed"),
        (r"\bride motion occurring at ordinary real-time speed\b", "only occasional survivor-operated ride motion at natural real-time speed"),
        (r"\bordinary pedestrian activity\b", "sparse survivor movement"),
        (r"\boccasional anonymous passersby\b", "occasional survivors"),
        (r"\ba modest crowd\b", "a small group of survivors"),
        (r"\bpassengers\b", "survivors"),
        (r"\bvehicles traveling at normal road speed\b", "sparse survivor-era vehicles moving at natural road speed"),
        (r"\ba modern cafe\b", "an abandoned or improvised survivor-era cafe"),
        (r"\ba cozy cafe\b", "a weathered survivor shelter adapted from a cafe"),
        (r"\bflight displays\b", "damaged or improvised information displays"),
        (r"\bdeparture boards\b", "damaged or improvised information boards"),
        (r"\bretail displays\b", "scavenged or improvised display areas"),
        (r"\bstorefronts\b", "weathered former storefronts"),
        (r"\bsparse background patrons\b", "a few survivors"),
        (r"\bbackground patrons\b", "a few survivors"),
        (r"\bdiners\b", "survivors"),
        (r"\ba moderate crowd moving at a normal real-time pace\b", "a small group of survivors moving at a natural pace"),
        (r"\boccasional pedestrians\b", "occasional survivors"),
        (r"\bsteady but natural foot traffic\b", "sparse survivor movement"),
        (r"\bdestination displays\b", "damaged or improvised destination displays"),
        (r"(?<!improvised )\binformation displays\b", "damaged or improvised information displays"),
    )
    for pattern, repl in replacements:
        value = re.sub(pattern, repl, value, flags=re.I)
    value = re.sub(r"\s{2,}", " ", value).strip()
    return (
        f"{value}, unmistakably existing in a post-collapse survivor-era state with context-appropriate damage, "
        "abandonment, scavenged reuse, and reduced normal civic operation"
    )


def _style_adapted_location_text(location: str, visual_style: str) -> str:
    value = SCENE_LOCATION_TEXT.get(str(location or ""), "")
    style = str(visual_style or "auto")
    if not value:
        return ""
    if style == "post_apocalyptic":
        return _post_apocalyptic_location_text(value)
    if style == "cyberpunk":
        return (
            f"{value}, unmistakably reinterpreted as a cyberpunk future environment with advanced infrastructure, "
            "high-tech utilities, emissive signage or displays where contextually plausible, and a coherent high-tech low-life design language"
        )
    if style == "dark_fantasy":
        return (
            f"{value}, unmistakably reinterpreted through a dark-fantasy world state with aged mythical materials, "
            "otherworldly design cues where plausible, and shadow-rich supernatural atmosphere"
        )
    if style == "gothic":
        return (
            f"{value}, unmistakably reinterpreted through dark Gothic art direction with aged stone or metal, "
            "ornate vertical forms where plausible, and solemn shadow-rich lighting"
        )
    if style == "dreamlike":
        return (
            f"{value}, clearly rendered through the same coherent dreamlike visual logic with subtly surreal spatial or atmospheric details "
            "while the selected place remains recognizable"
        )
    return value


def _environment_state_sentence(location: str, weather: str, visual_style: str = "auto") -> str:
    sentences: List[str] = []
    location_text = _style_adapted_location_text(location, visual_style)
    if location_text:
        sentences.append(_ensure_terminal_punctuation(f"The opening environment is {location_text}"))
        sentences.append("This opening setting is clearly recognizable on screen during its opening time range.")
    weather_sentence = _opening_weather_sentence(weather, location)
    if weather_sentence:
        sentences.append(weather_sentence)
        sentences.append("This opening weather state is visibly apparent during its opening time range rather than merely implied.")
    return " ".join(sentences)


def _selected_visual_requirements_sentence(
    active_person_slots: Sequence[str],
    profiles: dict,
    opening_environment_state: dict,
    turns: Sequence[dict],
    visual_style: str,
) -> str:
    """Anchor persistent selections only; time-varying environment is anchored locally."""
    clauses: List[str] = []
    if any(_profile_has_explicit_visual_settings(profiles.get(slot, {})) for slot in active_person_slots):
        clauses.append(
            "keep each selected person's appearance and wardrobe clearly recognizable and visually consistent whenever that person appears"
        )
    if str(visual_style or "auto") != "auto":
        clauses.append("make the selected visual style a dominant whole-video treatment rather than a subtle hint")
    persistent = ""
    if clauses:
        detail = clauses[0] if len(clauses) == 1 else clauses[0] + " and " + clauses[1]
        persistent = _ensure_terminal_punctuation(
            "The selected structured visual settings are authoritative over conflicting free-form descriptors: " + detail
        )
    opening_location = str((opening_environment_state or {}).get("location", "none") or "none")
    opening_weather = str((opening_environment_state or {}).get("weather", "none") or "none")
    has_timed_environment = (
        opening_location != "none"
        or opening_weather != "none"
        or any(
            str((turn or {}).get("resolved_scene_location", "none") or "none") != "none"
            or str((turn or {}).get("resolved_scene_weather", "none") or "none") != "none"
            for turn in (turns or [])
        )
    )
    environment_precedence = ""
    if has_timed_environment:
        environment_precedence = (
            "For each time range that has a structured setting or weather selection, that time-scoped structured state overrides conflicting free-form location or weather descriptions only for that same time range."
        )
    return " ".join(part for part in (persistent, environment_precedence) if part)


def _selected_profile_continuity_sentence(active_person_slots: Sequence[str], profiles: dict) -> str:
    if not any(_profile_has_explicit_visual_settings(profiles.get(slot, {})) for slot in active_person_slots):
        return ""
    return (
        "The same previously established selected character appearance and wardrobe remain clearly recognizable and consistent in this shot."
    )

def _resolve_environment_timeline(turns: Sequence[dict], baseline: dict, visual_style: str = "auto") -> Tuple[dict, List[dict]]:
    """Resolve baseline + Progress overrides as one chronological scene state.

    Overrides at 0.0s become the effective opening state, so the prompt never
    states a baseline and immediately contradicts it at the first frame.
    Later values persist until another Progress changes them. `reset_to_baseline`
    returns to the opening baseline; if that baseline is unspecified, the prompt
    explicitly returns to the scene/weather established at the opening instead
    of inventing a new value.
    """
    baseline_state = {
        "location": str((baseline or {}).get("location", "none") or "none"),
        "weather": str((baseline or {}).get("weather", "none") or "none"),
    }
    current = dict(baseline_state)
    reset_state = dict(baseline_state)
    resolved = [dict(turn) for turn in (turns or [])]

    def apply_value(kind: str, raw_value: str, *, emit: bool) -> Tuple[str, bool]:
        nonlocal current
        value = str(raw_value or TURN_SCENE_KEEP)
        if value == TURN_SCENE_KEEP:
            return "", False
        previous = current[kind]
        if value == TURN_SCENE_RESET:
            target = reset_state[kind]
            if previous == target:
                return "", False
            current[kind] = target
            if not emit:
                return "", True
            if kind == "location":
                if target != "none" and target in SCENE_LOCATION_TEXT:
                    return f"the setting is again {_style_adapted_location_text(target, visual_style)}", True
                return "the setting again matches the opening environment established at the start of the video", True
            if target != "none" and target in WEATHER_TEXT:
                if _weather_is_exterior_scoped(current.get("location", "none")):
                    return (
                        f"the weather outside the enclosed setting is again {WEATHER_TEXT[target]}, while the interior remains physically sheltered",
                        True,
                    )
                return f"the weather is again {WEATHER_TEXT[target]}", True
            return "the weather again matches the opening conditions established at the start of the video", True
        table = SCENE_LOCATION_TEXT if kind == "location" else WEATHER_TEXT
        if value not in table or previous == value:
            return "", False
        current[kind] = value
        if not emit:
            return "", True
        if kind == "location":
            return f"the setting is now {_style_adapted_location_text(value, visual_style)}", True
        if _weather_is_exterior_scoped(current.get("location", "none")):
            return (
                f"the weather outside the enclosed setting is now {table[value]}, while the interior remains physically sheltered and exterior conditions remain visible only where applicable",
                True,
            )
        return f"the weather across the whole scene is now {table[value]}", True

    # First-frame overrides define the real opening state and are not narrated as
    # an instantaneous change. This is the key baseline->Progress overwrite rule.
    for turn in resolved:
        if float(turn.get("elapsed_seconds", 0.0)) > 1e-9:
            continue
        apply_value("location", turn.get("scene_location_override", TURN_SCENE_KEEP), emit=False)
        apply_value("weather", turn.get("scene_weather_override", TURN_SCENE_KEEP), emit=False)
        turn["resolved_scene_location"] = current.get("location", "none")
        turn["resolved_scene_weather"] = current.get("weather", "none")
        turn["environment_change_sentence"] = ""
    opening_state = dict(current)
    # If the saved baseline did not specify a dimension, a 0.0s Progress override
    # becomes the actual opening state and therefore the meaningful reset target.
    # This keeps emitted "opening ..." wording and the compiler's internal state
    # identical after reset_to_baseline.
    for kind in ("location", "weather"):
        if baseline_state[kind] == "none":
            reset_state[kind] = opening_state[kind]

    for turn in resolved:
        elapsed = float(turn.get("elapsed_seconds", 0.0))
        if elapsed <= 1e-9:
            continue
        clauses = []
        location_clause, location_changed = apply_value("location", turn.get("scene_location_override", TURN_SCENE_KEEP), emit=True)
        weather_clause, weather_changed = apply_value("weather", turn.get("scene_weather_override", TURN_SCENE_KEEP), emit=True)
        if location_clause:
            clauses.append(location_clause)
        if weather_clause:
            clauses.append(weather_clause)
        elif location_changed and not weather_changed and current.get("weather", "none") != "none":
            # The weather state persists across location changes. Restate it once
            # so a transition from outdoors to an enclosed location cannot make H3
            # carry rain/snow/wind physically inside by accident.
            continuation = _continuing_weather_sentence(current.get("weather", "none"), current.get("location", "none"))
            if continuation:
                clauses.append(continuation.rstrip(".!?"))
        turn["resolved_scene_location"] = current.get("location", "none")
        turn["resolved_scene_weather"] = current.get("weather", "none")
        if clauses:
            timed_sentences: List[str] = []
            first = clauses[0]
            timed_sentences.append(_ensure_terminal_punctuation(
                f"At approximately {elapsed:.2f} seconds, {first[0].lower() + first[1:]}"
            ))
            for extra in clauses[1:]:
                timed_sentences.append(_ensure_terminal_punctuation(
                    f"At the same moment, {extra[0].lower() + extra[1:]}"
                ))
            if location_changed:
                timed_sentences.append(
                    "During this new setting's time range, the selected location is clearly recognizable on screen; the established main subjects remain the same characters, and background activity proceeds at normal real-time speed."
                )
            elif weather_changed:
                timed_sentences.append(
                    "During this weather state's time range, the selected weather is visually obvious on screen while the established main subjects remain continuous and weather motion proceeds at natural real-time speed."
                )
            turn["environment_change_sentence"] = " ".join(timed_sentences)
        else:
            turn["environment_change_sentence"] = ""
    return opening_state, resolved

def _extension_prompt_fragments(extension_options: dict, slot: str, prompt_target: str) -> List[str]:
    fragments = []
    person_profile = (extension_options or {}).get("person", {}).get(slot, {}).get("profile", {})
    if not isinstance(person_profile, dict):
        return fragments
    definitions = sorted(
        EXTENSION_OPTION_DEFINITIONS.items(),
        key=lambda item: (int(item[1].get("order", 0)), item[0]),
    )
    for path, definition in definitions:
        if definition.get("scope") != "person.profile" or definition.get("prompt_target") != prompt_target:
            continue
        option_id = path.rsplit(".", 1)[-1]
        value = str(person_profile.get(option_id, definition.get("default", "none")) or definition.get("default", "none"))
        text = str(definition.get("values", {}).get(value, "") or "").strip()
        if text:
            fragments.append(text)
    return fragments


def _extension_ethnic_appearance_id(extension_options: dict, slot: str) -> str:
    """Return the canonical ethnic-appearance option id for camera semantics.

    Prompt wording is intentionally presentation data and can change over time;
    semantic warnings must therefore depend on the stable canonical option id,
    not on an English substring such as ``facial features``.
    """
    definition = EXTENSION_OPTION_DEFINITIONS["person.profile.ethnic_appearance"]
    default = str(definition.get("default", "none") or "none")
    profile = (extension_options or {}).get("person", {}).get(slot, {}).get("profile", {})
    if not isinstance(profile, dict):
        return default
    value = str(profile.get("ethnic_appearance", default) or default)
    return value if value in definition.get("values", {}) else default


def _merge_extension_profile_text(extension_parts: Sequence[str], existing_text: str) -> str:
    """Prefix scoped extension phrases without changing legacy output when empty."""
    existing = str(existing_text or "").strip()
    parts = []
    lowered_existing = existing.lower()
    for part in extension_parts or ():
        text = str(part or "").strip()
        if not text:
            continue
        # Avoid the common manual duplicate while leaving semantically distinct
        # user wording untouched.
        if text.lower() in lowered_existing:
            continue
        parts.append(text)
    if not parts:
        return existing
    if existing:
        parts.append(existing)
    return ", ".join(parts)


APPEARANCE_PRESET_VALUES = (
    "none",
    "average_build",
    "slim_build",
    "petite_build",
    "diminutive_build",
    "athletic_build",
    "lean_muscular_build",
    "muscular_build",
    "solid_build",
    "curvy_build",
    "hourglass_figure",
    "full_figure",
    "tall_slim_build",
    "tall_build",
    "short_stature",
    "long_legs",
    "broad_shoulders",
    "full_bust",
    "small_bust",
    "soft_round_features",
    "defined_jawline",
    "freckles",
    "light_stubble",
    "full_beard",
    "long_black_hair",
    "long_brown_hair",
    "shoulder_length_hair",
    "straight_hair",
    "wavy_hair",
    "curly_hair",
    "short_hair",
    "short_bob",
    "pixie_cut",
    "buzz_cut",
    "ponytail",
    "braided_hair",
)
CLOTHING_PRESET_VALUES = (
    "none",
    "tailored_suit",
    "business_casual",
    "shirt_and_slacks",
    "blouse_and_pencil_skirt",
    "coat_and_skirt",
    "tshirt_and_jeans",
    "blouse_and_jeans",
    "cardigan_and_skirt",
    "knit_sweater_and_skirt",
    "turtleneck_and_slacks",
    "oversized_sweater",
    "casual_jeans",
    "denim_jacket",
    "leather_jacket",
    "trench_coat",
    "hoodie_and_joggers",
    "streetwear",
    "dress",
    "sundress",
    "work_apron",
    "chef_uniform",
    "work_overalls",
    "mechanic_coveralls",
    "medical_scrubs",
    "lab_coat",
    "raincoat",
    "puffer_jacket",
    "pajamas",
    "school_uniform",
    "sportswear",
    "yoga_outfit",
    "tennis_outfit",
    "cycling_outfit",
    "crop_top_and_leggings",
    "tank_top_and_shorts",
    "hanbok",
    "kimono",
    "qipao",
    "ao_dai",
    "swimsuit",
    "one_piece_swimsuit",
    "bikini",
    "beach_cover_up",
    "cocktail_dress",
    "evening_gown",
    "mini_skirt_and_blouse",
    "crop_top_and_jeans",
    "camisole_and_shorts",
    "bodycon_dress",
    "off_shoulder_dress",
    "halter_neck_dress",
    "slip_dress",
    "lingerie_set",
    "bra_and_panties",
    "sheer_lingerie",
    "open_robe_lingerie",
    "micro_bikini",
    "bodystocking",
    "thong_only",
    "topless_with_bottoms",
    "loose_apron_only",
    "nude",
)
# Profile safety has one simple rule: built-in adult-only profile presets are
# available only when the selected age is explicitly 20s or older.  The same
# data is exposed through the age-widget metadata so the frontend can prevent
# invalid combinations before execution.
PROFILE_SAFETY = {
    "adult_ages": ("twenties", "thirties", "forties", "fifties", "sixties", "elderly"),
    "adult_only_appearance": ("full_bust", "small_bust"),
    "adult_only_clothing": (
        "nude",
        "bodycon_dress",
        "off_shoulder_dress",
        "halter_neck_dress",
        "slip_dress",
        "mini_skirt_and_blouse",
        "crop_top_and_jeans",
        "camisole_and_shorts",
        "lingerie_set",
        "bra_and_panties",
        "thong_only",
        "loose_apron_only",
        "sheer_lingerie",
        "open_robe_lingerie",
        "topless_with_bottoms",
        "micro_bikini",
        "bodystocking",
    ),
}

class _UserInputError(ValueError):
    """Raised for validation failures the user can fix from the node UI/workflow."""


class _UserFixableRuntimeError(RuntimeError):
    """Raised for runtime/environment failures the user can resolve without a code change."""


class _TranslationUnavailableError(_UserFixableRuntimeError):
    """Raised when automatic Korean-to-English translation cannot produce safe usable text."""


class _TranslationNetworkUnavailableError(_TranslationUnavailableError):
    """Raised when both external Korean-to-English translation routes are unavailable."""


class _TranslationRateLimitedError(_TranslationNetworkUnavailableError):
    """Raised when reachable online translation providers are temporarily rate-limited."""


class _TranslationDependencyUnavailableError(_TranslationUnavailableError):
    """Raised when automatic translation cannot run because a required Python dependency is unavailable."""


class _TranslationRouteUnavailableError(RuntimeError):
    """Internal marker for a translation route that cannot be reached or used."""


class _TranslationRouteDependencyError(_TranslationRouteUnavailableError):
    """Internal marker for a translation route whose Python dependency is unavailable."""


class _TranslationRouteRateLimitedError(_TranslationRouteUnavailableError):
    """Internal marker for an online translation provider returning HTTP 429."""


class _TranslationRouteCoolingDownError(_TranslationRouteUnavailableError):
    """Internal marker for a provider skipped after a recent HTTP 429."""


class _TranslationRouteConfigurationError(_TranslationRouteUnavailableError):
    """Internal marker for an explicitly configured official route that needs user attention."""


class _TranslationRouteUnusableResultError(RuntimeError):
    """Internal marker for a reachable route that returned no safe usable translation."""


_TRANSLATION_PROVIDER_LOCK = threading.Lock()
_TRANSLATION_STATE_LOCK = threading.Lock()
_TRANSLATION_CACHE_LOCK = threading.Lock()
_TRANSLATION_API_CONFIG_LOCK = threading.Lock()
_GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT = 0.0
_GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL = 0.0
_GOOGLE_TRANSLATION_LAST_REQUEST_AT = 0.0
_GOOGLE_TRANSLATION_COOLDOWN_UNTIL = 0.0
_MYMEMORY_TRANSLATION_LAST_REQUEST_AT = 0.0
_MYMEMORY_TRANSLATION_COOLDOWN_UNTIL = 0.0
_GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 = 0
_GOOGLE_TRANSLATION_CONSECUTIVE_429 = 0
_MYMEMORY_TRANSLATION_CONSECUTIVE_429 = 0
_GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH = 0.0
_GOOGLE_TRANSLATION_LAST_429_EPOCH = 0.0
_MYMEMORY_TRANSLATION_LAST_429_EPOCH = 0.0
_TRANSLATION_PROVIDER_STATE_LOADED = False
_TRANSLATION_PROVIDER_REQUEST_TIMES: Dict[str, deque] = {
    "google_cloud": deque(maxlen=64),
    "google": deque(maxlen=64),
    "mymemory": deque(maxlen=64),
}
_GOOGLE_CLOUD_TRANSLATION_MIN_REQUEST_INTERVAL_SECONDS = 0.05
_GOOGLE_TRANSLATION_MIN_REQUEST_INTERVAL_SECONDS = 0.65
_MYMEMORY_TRANSLATION_MIN_REQUEST_INTERVAL_SECONDS = 0.30
_GOOGLE_CLOUD_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS = 30.0
_GOOGLE_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS = 30.0
_MYMEMORY_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS = 20.0
_TRANSLATION_MAX_RETRY_AFTER_SECONDS = 900.0
_TRANSLATION_MAX_429_COOLDOWN_SECONDS = 600.0
_TRANSLATION_429_COUNT_DECAY_SECONDS = 1800.0
_TRANSLATION_TRANSIENT_RETRY_DELAY_SECONDS = 0.9
_MYMEMORY_TRANSLATION_CHUNK_LIMIT_BYTES = 480
_TRANSLATION_CACHE_SCHEMA_VERSION = 1
_TRANSLATION_CACHE_PIPELINE_VERSION = "v3.50-ko-en-structural-20260824"
_TRANSLATION_CACHE_MAX_ENTRIES = 2048
_TRANSLATION_CACHE_MAX_AGE_SECONDS = 30.0 * 24.0 * 60.0 * 60.0
_TRANSLATION_CACHE_LOADED = False
_TRANSLATION_CACHE_ENTRIES: Dict[str, Dict[str, Any]] = {}
_TRANSLATION_API_CONFIG_SCHEMA_VERSION = 1
_TRANSLATION_API_CONFIG_LOADED = False
_GOOGLE_CLOUD_TRANSLATION_API_KEY = ""
_GOOGLE_CLOUD_TRANSLATION_API_KEY_MAX_LENGTH = 512


def _translation_user_state_dir(create: bool = False) -> Optional[Path]:
    """Return a ComfyUI-user-local state directory without writing into the node package.

    Outside ComfyUI (for example static validation), persistent state is simply disabled.
    """
    try:
        import folder_paths  # type: ignore
        get_user_directory = getattr(folder_paths, "get_user_directory", None)
        if not callable(get_user_directory):
            return None
        base = Path(str(get_user_directory())).expanduser()
        target = base / "ultra_minimax_h3_prompt"
        if create:
            target.mkdir(parents=True, exist_ok=True)
        return target
    except Exception:
        return None


def _translation_atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    """Best-effort atomic JSON state write; translation must never fail because caching failed."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, path)
    except Exception:
        try:
            tmp = path.with_name(path.name + ".tmp")
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass


def _translation_cache_path(create: bool = False) -> Optional[Path]:
    root = _translation_user_state_dir(create=create)
    return (root / "translation_cache_v1.json") if root is not None else None


def _translation_provider_state_path(create: bool = False) -> Optional[Path]:
    root = _translation_user_state_dir(create=create)
    return (root / "translation_provider_state_v1.json") if root is not None else None


def _translation_api_config_path(create: bool = False) -> Optional[Path]:
    root = _translation_user_state_dir(create=create)
    return (root / "translation_api_config_v1.json") if root is not None else None


def _normalize_google_cloud_translation_api_key(value: Any) -> str:
    key = str(value or "").strip()
    if not key:
        return ""
    if len(key) > _GOOGLE_CLOUD_TRANSLATION_API_KEY_MAX_LENGTH:
        raise ValueError("Google Cloud Translation API key is too long.")
    if len(key) < 20 or not re.fullmatch(r"[A-Za-z0-9_-]+", key):
        raise ValueError("Google Cloud Translation API key format is invalid.")
    return key


def _load_google_cloud_translation_api_key_if_needed() -> None:
    global _TRANSLATION_API_CONFIG_LOADED, _GOOGLE_CLOUD_TRANSLATION_API_KEY
    with _TRANSLATION_API_CONFIG_LOCK:
        if _TRANSLATION_API_CONFIG_LOADED:
            return
        _TRANSLATION_API_CONFIG_LOADED = True
        path = _translation_api_config_path(create=False)
        if path is None or not path.is_file():
            return
        try:
            if path.stat().st_size > 64 * 1024:
                return
            payload = json.loads(path.read_text(encoding="utf-8"))
            if int(payload.get("schema", 0)) != _TRANSLATION_API_CONFIG_SCHEMA_VERSION:
                return
            _GOOGLE_CLOUD_TRANSLATION_API_KEY = _normalize_google_cloud_translation_api_key(
                payload.get("google_cloud_translation_api_key", "")
            )
        except Exception:
            _GOOGLE_CLOUD_TRANSLATION_API_KEY = ""


def _google_cloud_translation_api_key() -> str:
    _load_google_cloud_translation_api_key_if_needed()
    with _TRANSLATION_API_CONFIG_LOCK:
        return str(_GOOGLE_CLOUD_TRANSLATION_API_KEY or "")


def _translation_write_api_config(key: str) -> bool:
    path = _translation_api_config_path(create=True)
    if path is None:
        return False
    tmp = path.with_name(path.name + ".tmp")
    payload = {
        "schema": _TRANSLATION_API_CONFIG_SCHEMA_VERSION,
        "google_cloud_translation_api_key": key,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        try:
            os.chmod(tmp, 0o600)
        except Exception:
            pass
        os.replace(tmp, path)
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
        return True
    except Exception:
        try:
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass
        return False


def _reset_google_cloud_translation_provider_state() -> None:
    global _GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT, _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL
    global _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429, _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH
    with _TRANSLATION_PROVIDER_LOCK:
        _GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT = 0.0
        _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL = 0.0
        _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 = 0
        _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH = 0.0
        history = _TRANSLATION_PROVIDER_REQUEST_TIMES.get("google_cloud")
        if history is not None:
            history.clear()
    _translation_persist_provider_state()


def _save_google_cloud_translation_api_key(value: Any) -> bool:
    global _TRANSLATION_API_CONFIG_LOADED, _GOOGLE_CLOUD_TRANSLATION_API_KEY
    key = _normalize_google_cloud_translation_api_key(value)
    if not key:
        raise ValueError("Google Cloud Translation API key is empty.")
    if not _translation_write_api_config(key):
        return False
    with _TRANSLATION_API_CONFIG_LOCK:
        _GOOGLE_CLOUD_TRANSLATION_API_KEY = key
        _TRANSLATION_API_CONFIG_LOADED = True
    _reset_google_cloud_translation_provider_state()
    return True


def _clear_google_cloud_translation_api_key() -> bool:
    global _TRANSLATION_API_CONFIG_LOADED, _GOOGLE_CLOUD_TRANSLATION_API_KEY
    path = _translation_api_config_path(create=False)
    try:
        if path is not None and path.exists():
            path.unlink()
    except Exception:
        return False
    with _TRANSLATION_API_CONFIG_LOCK:
        _GOOGLE_CLOUD_TRANSLATION_API_KEY = ""
        _TRANSLATION_API_CONFIG_LOADED = True
    _reset_google_cloud_translation_provider_state()
    return True


def _google_cloud_translation_api_status() -> Dict[str, Any]:
    key = _google_cloud_translation_api_key()
    return {
        "configured": bool(key),
        "provider": "google_cloud_translation_v2",
        "workflow_exposed": False,
    }


def _normalize_translation_cache_text(text: str) -> str:
    """Conservative cache-only normalization that does not merge punctuation or wording changes."""
    value = unicodedata.normalize("NFC", str(text or ""))
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    # Ignore only formatting noise that the surrounding translation pipeline already
    # treats as insignificant: outer whitespace and trailing whitespace per line.
    value = "\n".join(line.rstrip(" \t") for line in value.split("\n")).strip(" \t\n")
    return value


def _translation_cache_key(text: str) -> str:
    normalized = _normalize_translation_cache_text(text)
    material = f"{_TRANSLATION_CACHE_PIPELINE_VERSION}\0ko\0en\0{normalized}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def _load_translation_cache_if_needed() -> None:
    global _TRANSLATION_CACHE_LOADED, _TRANSLATION_CACHE_ENTRIES
    with _TRANSLATION_CACHE_LOCK:
        if _TRANSLATION_CACHE_LOADED:
            return
        _TRANSLATION_CACHE_LOADED = True
        path = _translation_cache_path(create=False)
        if path is None or not path.is_file():
            return
        try:
            if path.stat().st_size > 16 * 1024 * 1024:
                return
            payload = json.loads(path.read_text(encoding="utf-8"))
            if int(payload.get("schema", 0)) != _TRANSLATION_CACHE_SCHEMA_VERSION:
                return
            if str(payload.get("pipeline", "")) != _TRANSLATION_CACHE_PIPELINE_VERSION:
                return
            entries = payload.get("entries") or {}
            if not isinstance(entries, dict):
                return
            now = time.time()
            loaded: Dict[str, Dict[str, Any]] = {}
            for key, entry in entries.items():
                if not isinstance(key, str) or not isinstance(entry, dict):
                    continue
                translated = entry.get("translated")
                route = entry.get("route")
                saved_at = entry.get("saved_at", 0.0)
                if not isinstance(translated, str) or not translated.strip() or not isinstance(route, str):
                    continue
                try:
                    saved_at_f = float(saved_at)
                except Exception:
                    continue
                if saved_at_f <= 0 or now - saved_at_f > _TRANSLATION_CACHE_MAX_AGE_SECONDS:
                    continue
                loaded[key] = {"translated": translated, "route": route, "saved_at": saved_at_f}
            if len(loaded) > _TRANSLATION_CACHE_MAX_ENTRIES:
                newest = sorted(loaded.items(), key=lambda item: float(item[1].get("saved_at", 0.0)), reverse=True)
                loaded = dict(newest[:_TRANSLATION_CACHE_MAX_ENTRIES])
            _TRANSLATION_CACHE_ENTRIES = loaded
        except Exception:
            # Corrupt/foreign cache state is ignored; online translation remains available.
            _TRANSLATION_CACHE_ENTRIES = {}


def _translation_persistent_cache_get(text: str) -> Optional[Tuple[str, str]]:
    _load_translation_cache_if_needed()
    key = _translation_cache_key(text)
    with _TRANSLATION_CACHE_LOCK:
        entry = _TRANSLATION_CACHE_ENTRIES.get(key)
        if not isinstance(entry, dict):
            return None
        translated = entry.get("translated")
        route = entry.get("route")
        if not isinstance(translated, str) or not translated.strip() or not isinstance(route, str):
            return None
        return translated, route


def _translation_persistent_cache_put(text: str, translated: str, route: str) -> None:
    if not translated or not route:
        return
    _load_translation_cache_if_needed()
    key = _translation_cache_key(text)
    now = time.time()
    with _TRANSLATION_CACHE_LOCK:
        existing = _TRANSLATION_CACHE_ENTRIES.get(key)
        if isinstance(existing, dict) and existing.get("translated") == translated and existing.get("route") == route:
            return
        _TRANSLATION_CACHE_ENTRIES[key] = {"translated": translated, "route": route, "saved_at": now}
        if len(_TRANSLATION_CACHE_ENTRIES) > _TRANSLATION_CACHE_MAX_ENTRIES:
            overflow = len(_TRANSLATION_CACHE_ENTRIES) - _TRANSLATION_CACHE_MAX_ENTRIES
            oldest = sorted(
                _TRANSLATION_CACHE_ENTRIES.items(),
                key=lambda item: float(item[1].get("saved_at", 0.0)),
            )[:overflow]
            for old_key, _entry in oldest:
                _TRANSLATION_CACHE_ENTRIES.pop(old_key, None)
        path = _translation_cache_path(create=True)
        if path is None:
            return
        payload = {
            "schema": _TRANSLATION_CACHE_SCHEMA_VERSION,
            "pipeline": _TRANSLATION_CACHE_PIPELINE_VERSION,
            "entries": _TRANSLATION_CACHE_ENTRIES,
        }
        _translation_atomic_write_json(path, payload)


def _translation_provider_state_snapshot() -> Dict[str, Any]:
    now_mono = time.monotonic()
    now_epoch = time.time()
    return {
        "schema": 1,
        "saved_at": now_epoch,
        "google_cloud": {
            "cooldown_until": now_epoch + max(0.0, _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL - now_mono),
            "consecutive_429": int(_GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429),
            "last_429": float(_GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH),
        },
        "google": {
            "cooldown_until": now_epoch + max(0.0, _GOOGLE_TRANSLATION_COOLDOWN_UNTIL - now_mono),
            "consecutive_429": int(_GOOGLE_TRANSLATION_CONSECUTIVE_429),
            "last_429": float(_GOOGLE_TRANSLATION_LAST_429_EPOCH),
        },
        "mymemory": {
            "cooldown_until": now_epoch + max(0.0, _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL - now_mono),
            "consecutive_429": int(_MYMEMORY_TRANSLATION_CONSECUTIVE_429),
            "last_429": float(_MYMEMORY_TRANSLATION_LAST_429_EPOCH),
        },
    }


def _translation_persist_provider_state() -> None:
    path = _translation_provider_state_path(create=True)
    if path is None:
        return
    with _TRANSLATION_PROVIDER_LOCK:
        payload = _translation_provider_state_snapshot()
    _translation_atomic_write_json(path, payload)


def _translation_restore_provider_state_if_needed() -> None:
    global _TRANSLATION_PROVIDER_STATE_LOADED
    global _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL
    global _GOOGLE_TRANSLATION_COOLDOWN_UNTIL, _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL
    global _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429
    global _GOOGLE_TRANSLATION_CONSECUTIVE_429, _MYMEMORY_TRANSLATION_CONSECUTIVE_429
    global _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH
    global _GOOGLE_TRANSLATION_LAST_429_EPOCH, _MYMEMORY_TRANSLATION_LAST_429_EPOCH
    with _TRANSLATION_STATE_LOCK:
        if _TRANSLATION_PROVIDER_STATE_LOADED:
            return
        _TRANSLATION_PROVIDER_STATE_LOADED = True
        path = _translation_provider_state_path(create=False)
        if path is None or not path.is_file():
            return
        try:
            if path.stat().st_size > 256 * 1024:
                return
            payload = json.loads(path.read_text(encoding="utf-8"))
            if int(payload.get("schema", 0)) != 1:
                return
            now_epoch = time.time()
            now_mono = time.monotonic()
            with _TRANSLATION_PROVIDER_LOCK:
                for provider in ("google_cloud", "google", "mymemory"):
                    state = payload.get(provider) or {}
                    if not isinstance(state, dict):
                        continue
                    try:
                        cooldown_until_epoch = float(state.get("cooldown_until", 0.0))
                    except Exception:
                        cooldown_until_epoch = 0.0
                    try:
                        last_429 = float(state.get("last_429", 0.0))
                    except Exception:
                        last_429 = 0.0
                    try:
                        count = max(0, int(state.get("consecutive_429", 0)))
                    except Exception:
                        count = 0
                    if last_429 <= 0 or now_epoch - last_429 > _TRANSLATION_429_COUNT_DECAY_SECONDS:
                        count = 0
                    remaining = max(0.0, min(_TRANSLATION_MAX_RETRY_AFTER_SECONDS, cooldown_until_epoch - now_epoch))
                    if provider == "google_cloud":
                        _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL = max(
                            _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL, now_mono + remaining
                        )
                        _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 = count
                        _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH = last_429
                    elif provider == "google":
                        _GOOGLE_TRANSLATION_COOLDOWN_UNTIL = max(_GOOGLE_TRANSLATION_COOLDOWN_UNTIL, now_mono + remaining)
                        _GOOGLE_TRANSLATION_CONSECUTIVE_429 = count
                        _GOOGLE_TRANSLATION_LAST_429_EPOCH = last_429
                    else:
                        _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL = max(_MYMEMORY_TRANSLATION_COOLDOWN_UNTIL, now_mono + remaining)
                        _MYMEMORY_TRANSLATION_CONSECUTIVE_429 = count
                        _MYMEMORY_TRANSLATION_LAST_429_EPOCH = last_429
        except Exception:
            return


def _translation_adaptive_interval(provider: str, now: float) -> float:
    """Keep short jobs close to legacy speed, but gradually slow sustained bursts."""
    history = _TRANSLATION_PROVIDER_REQUEST_TIMES.get(provider)
    if history is None:
        return 0.0
    while history and now - history[0] > 30.0:
        history.popleft()
    recent_10 = sum(1 for stamp in history if now - stamp <= 10.0)
    recent_30 = len(history)
    if provider == "google_cloud":
        return _GOOGLE_CLOUD_TRANSLATION_MIN_REQUEST_INTERVAL_SECONDS
    if provider == "google":
        if recent_30 >= 14:
            return 1.75
        if recent_10 >= 9:
            return 1.50
        if recent_10 >= 6:
            return 1.20
        if recent_10 >= 3:
            return 0.95
        return _GOOGLE_TRANSLATION_MIN_REQUEST_INTERVAL_SECONDS
    if provider == "mymemory":
        if recent_30 >= 10:
            return 1.80
        if recent_10 >= 6:
            return 1.50
        if recent_10 >= 4:
            return 1.20
        if recent_10 >= 2:
            return 0.90
        return 0.60
    return 0.0


def _translation_retry_after_seconds(headers: Any) -> Optional[float]:
    try:
        value = headers.get("Retry-After") if headers is not None else None
    except Exception:
        value = None
    if not value:
        return None
    value = str(value).strip()
    try:
        seconds = float(value)
        if seconds >= 0:
            return min(seconds, _TRANSLATION_MAX_RETRY_AFTER_SECONDS)
    except Exception:
        pass
    try:
        retry_at = parsedate_to_datetime(value)
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=timezone.utc)
        seconds = (retry_at - datetime.now(timezone.utc)).total_seconds()
        if seconds >= 0:
            return min(seconds, _TRANSLATION_MAX_RETRY_AFTER_SECONDS)
    except Exception:
        pass
    return None


def _translation_exception_http_status(exc: BaseException) -> Optional[int]:
    seen: set = set()
    current: Optional[BaseException] = exc
    for _ in range(8):
        if current is None or id(current) in seen:
            break
        seen.add(id(current))
        response = getattr(current, "response", None)
        status = getattr(response, "status_code", None) if response is not None else None
        if not isinstance(status, int):
            code = getattr(current, "code", None)
            status = code if isinstance(code, int) else None
        if isinstance(status, int):
            return status
        current = current.__cause__ or current.__context__
    return None


def _translation_wait_provider_slot(provider: str) -> None:
    global _GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT
    global _GOOGLE_TRANSLATION_LAST_REQUEST_AT, _MYMEMORY_TRANSLATION_LAST_REQUEST_AT
    _translation_restore_provider_state_if_needed()
    while True:
        with _TRANSLATION_PROVIDER_LOCK:
            now = time.monotonic()
            history = _TRANSLATION_PROVIDER_REQUEST_TIMES.get(provider)
            interval = _translation_adaptive_interval(provider, now)
            if provider == "google_cloud":
                if now < _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL:
                    remaining = max(0.0, _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL - now)
                    raise _TranslationRouteCoolingDownError(
                        f"Google Cloud Translation is cooling down after HTTP 429 ({remaining:.1f}s remaining)."
                    )
                wait_for = interval - (now - _GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT)
                if wait_for <= 0:
                    _GOOGLE_CLOUD_TRANSLATION_LAST_REQUEST_AT = now
                    if history is not None:
                        history.append(now)
                    return
            elif provider == "google":
                if now < _GOOGLE_TRANSLATION_COOLDOWN_UNTIL:
                    remaining = max(0.0, _GOOGLE_TRANSLATION_COOLDOWN_UNTIL - now)
                    raise _TranslationRouteCoolingDownError(
                        f"Google translation is cooling down after HTTP 429 ({remaining:.1f}s remaining)."
                    )
                wait_for = interval - (now - _GOOGLE_TRANSLATION_LAST_REQUEST_AT)
                if wait_for <= 0:
                    _GOOGLE_TRANSLATION_LAST_REQUEST_AT = now
                    if history is not None:
                        history.append(now)
                    return
            elif provider == "mymemory":
                if now < _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL:
                    remaining = max(0.0, _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL - now)
                    raise _TranslationRouteCoolingDownError(
                        f"MyMemory translation is cooling down after HTTP 429 ({remaining:.1f}s remaining)."
                    )
                wait_for = interval - (now - _MYMEMORY_TRANSLATION_LAST_REQUEST_AT)
                if wait_for <= 0:
                    _MYMEMORY_TRANSLATION_LAST_REQUEST_AT = now
                    if history is not None:
                        history.append(now)
                    return
            else:
                return
        time.sleep(max(0.0, wait_for))


def _translation_note_provider_429(provider: str, headers: Any = None) -> None:
    global _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL
    global _GOOGLE_TRANSLATION_COOLDOWN_UNTIL, _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL
    global _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429
    global _GOOGLE_TRANSLATION_CONSECUTIVE_429, _MYMEMORY_TRANSLATION_CONSECUTIVE_429
    global _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH
    global _GOOGLE_TRANSLATION_LAST_429_EPOCH, _MYMEMORY_TRANSLATION_LAST_429_EPOCH
    _translation_restore_provider_state_if_needed()
    now_mono = time.monotonic()
    now_epoch = time.time()
    retry_after = _translation_retry_after_seconds(headers)
    with _TRANSLATION_PROVIDER_LOCK:
        if provider == "google_cloud":
            _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 = min(8, _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 + 1)
            _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH = now_epoch
            backoff = min(
                _TRANSLATION_MAX_429_COOLDOWN_SECONDS,
                _GOOGLE_CLOUD_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS
                * (2 ** (_GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 - 1)),
            )
            cooldown = max(backoff, retry_after or 0.0)
            _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL = max(
                _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL, now_mono + cooldown
            )
        elif provider == "google":
            _GOOGLE_TRANSLATION_CONSECUTIVE_429 = min(8, _GOOGLE_TRANSLATION_CONSECUTIVE_429 + 1)
            _GOOGLE_TRANSLATION_LAST_429_EPOCH = now_epoch
            backoff = min(
                _TRANSLATION_MAX_429_COOLDOWN_SECONDS,
                _GOOGLE_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS * (2 ** (_GOOGLE_TRANSLATION_CONSECUTIVE_429 - 1)),
            )
            cooldown = max(backoff, retry_after or 0.0)
            _GOOGLE_TRANSLATION_COOLDOWN_UNTIL = max(_GOOGLE_TRANSLATION_COOLDOWN_UNTIL, now_mono + cooldown)
        elif provider == "mymemory":
            _MYMEMORY_TRANSLATION_CONSECUTIVE_429 = min(8, _MYMEMORY_TRANSLATION_CONSECUTIVE_429 + 1)
            _MYMEMORY_TRANSLATION_LAST_429_EPOCH = now_epoch
            backoff = min(
                _TRANSLATION_MAX_429_COOLDOWN_SECONDS,
                _MYMEMORY_TRANSLATION_DEFAULT_429_COOLDOWN_SECONDS * (2 ** (_MYMEMORY_TRANSLATION_CONSECUTIVE_429 - 1)),
            )
            cooldown = max(backoff, retry_after or 0.0)
            _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL = max(_MYMEMORY_TRANSLATION_COOLDOWN_UNTIL, now_mono + cooldown)
        else:
            return
    _translation_persist_provider_state()


def _translation_note_provider_success(provider: str) -> None:
    """Reset only 429 escalation state after a provider has actually succeeded."""
    global _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429, _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH
    global _GOOGLE_TRANSLATION_CONSECUTIVE_429, _MYMEMORY_TRANSLATION_CONSECUTIVE_429
    global _GOOGLE_TRANSLATION_LAST_429_EPOCH, _MYMEMORY_TRANSLATION_LAST_429_EPOCH
    _translation_restore_provider_state_if_needed()
    changed = False
    with _TRANSLATION_PROVIDER_LOCK:
        if provider == "google_cloud" and (
            _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 or _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH
        ):
            _GOOGLE_CLOUD_TRANSLATION_CONSECUTIVE_429 = 0
            _GOOGLE_CLOUD_TRANSLATION_LAST_429_EPOCH = 0.0
            changed = True
        elif provider == "google" and (_GOOGLE_TRANSLATION_CONSECUTIVE_429 or _GOOGLE_TRANSLATION_LAST_429_EPOCH):
            _GOOGLE_TRANSLATION_CONSECUTIVE_429 = 0
            _GOOGLE_TRANSLATION_LAST_429_EPOCH = 0.0
            changed = True
        elif provider == "mymemory" and (_MYMEMORY_TRANSLATION_CONSECUTIVE_429 or _MYMEMORY_TRANSLATION_LAST_429_EPOCH):
            _MYMEMORY_TRANSLATION_CONSECUTIVE_429 = 0
            _MYMEMORY_TRANSLATION_LAST_429_EPOCH = 0.0
            changed = True
    if changed:
        _translation_persist_provider_state()


def _translation_cooldown_summary() -> str:
    """Return prompt-safe remaining provider cooldowns without exposing request text."""
    now = time.monotonic()
    with _TRANSLATION_PROVIDER_LOCK:
        google_cloud_remaining = max(0.0, _GOOGLE_CLOUD_TRANSLATION_COOLDOWN_UNTIL - now)
        google_remaining = max(0.0, _GOOGLE_TRANSLATION_COOLDOWN_UNTIL - now)
        mymemory_remaining = max(0.0, _MYMEMORY_TRANSLATION_COOLDOWN_UNTIL - now)
    parts: List[str] = []
    if google_cloud_remaining > 0:
        parts.append(f"Google Cloud cooldown {google_cloud_remaining:.1f}s")
    if google_remaining > 0:
        parts.append(f"Google cooldown {google_remaining:.1f}s")
    if mymemory_remaining > 0:
        parts.append(f"MyMemory cooldown {mymemory_remaining:.1f}s")
    return ", ".join(parts)


def _translation_exception_diagnostic(exc: BaseException) -> str:
    """Return a prompt-safe diagnostic summary without logging request text or URLs.

    Translation exceptions may contain the full request URL, including the user's
    translatable text.  Never stringify the exception here.  Only expose bounded
    structural metadata that is useful for distinguishing timeout, HTTP status,
    missing dependency, and low-level connection failures.
    """
    parts: List[str] = []
    seen: set = set()
    current: Optional[BaseException] = exc
    for _ in range(6):
        if current is None or id(current) in seen:
            break
        seen.add(id(current))

        name = type(current).__name__
        meta: List[str] = []

        response = getattr(current, "response", None)
        status = getattr(response, "status_code", None) if response is not None else None
        if not isinstance(status, int):
            code = getattr(current, "code", None)
            status = code if isinstance(code, int) else None
        if isinstance(status, int):
            meta.append(f"HTTP {status}")

        if isinstance(current, ModuleNotFoundError):
            module_name = getattr(current, "name", None)
            if module_name:
                meta.append(f"module={module_name}")

        errno = getattr(current, "errno", None)
        if isinstance(errno, int):
            meta.append(f"errno={errno}")

        if "timeout" in name.lower():
            meta.append("timeout")

        reason = getattr(current, "reason", None)
        if reason is not None and not isinstance(reason, (str, bytes)):
            reason_name = type(reason).__name__
            if reason_name and reason_name != name:
                meta.append(f"reason={reason_name}")
            reason_errno = getattr(reason, "errno", None)
            if isinstance(reason_errno, int):
                meta.append(f"reason_errno={reason_errno}")
            if "timeout" in reason_name.lower() and "timeout" not in meta:
                meta.append("timeout")

        if meta:
            parts.append(f"{name}[{','.join(meta)}]")
        else:
            parts.append(name)

        current = current.__cause__ or current.__context__

    return ">".join(parts) if parts else type(exc).__name__


def _translation_routes_diagnostic(errors: List[Tuple[str, Exception]]) -> str:
    """Format per-route failure metadata for console/error reports only."""
    return "; ".join(
        f"{label}={_translation_exception_diagnostic(exc)}"
        for label, exc in errors
    )


def _warning_message_from_info(info: Any, fallback: str) -> str:
    """Return the user-facing warning carried by an info block.

    User-fixable blocks keep detailed machine-readable status in ``info``; this
    helper makes the same trusted warning visible through ExecutionBlocker so a
    blocked queue cannot look like a silent successful completion.
    """
    for line in str(info or "").splitlines():
        if line.startswith("warning="):
            message = line.split("=", 1)[1].strip()
            if message:
                return message
    return str(fallback or "Prompt generation was blocked by an invalid or incomplete input setting.").strip()


def _blocked_result(info: Any, fallback: str = "Prompt generation was blocked by an invalid or incomplete input setting."):
    message = _warning_message_from_info(info, fallback)
    if ExecutionBlocker is not None:
        return ExecutionBlocker(message), info
    return "", info


SEQUENTIAL_VOCAL_MAX_CHARS = 131072
SEQUENTIAL_VOCAL_VERSION = 1
SEQUENTIAL_VOCAL_SOURCES = ("A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "Narrator")
SEQUENTIAL_VOCAL_ADDED_SLOT_DEFAULT_SPEAKER = "A"

def _parse_sequential_vocal_json(raw: Any) -> dict:
    """Parse fail-closed runtime state for optional per-Progress sequential speech."""
    if raw is None:
        return {"version": SEQUENTIAL_VOCAL_VERSION}
    if isinstance(raw, dict):
        source = raw
    else:
        text = str(raw or "").strip()
        if not text or text == "{}":
            return {"version": SEQUENTIAL_VOCAL_VERSION}
        if len(text) > SEQUENTIAL_VOCAL_MAX_CHARS:
            raise _UserInputError("Sequential speech data is too large to queue safely. Shorten the added dialogue text.")
        try:
            source = json.loads(text)
        except Exception as exc:
            raise _UserInputError("Sequential speech data is malformed. Reopen the node or reset the affected sequential-speech settings.") from exc
    if not isinstance(source, dict):
        raise _UserInputError("Sequential speech data must be a JSON object.")
    if source.get("transport_error"):
        detail = str(source.get("transport_error") or "transport_error")
        raise _UserInputError(f"Sequential speech could not be queued safely ({detail}). Shorten the added dialogue or reopen the node.")
    clean = {"version": SEQUENTIAL_VOCAL_VERSION}
    narrator_preset = str(source.get("narrator_voice_preset", "auto") or "auto")
    if narrator_preset not in NARRATOR_VOICE_PRESET_VALUES:
        narrator_preset = "auto"
    narrator_direct = str(source.get("narrator_voice_desc", "") or "")
    if len(narrator_direct) > 1000:
        narrator_direct = narrator_direct[:1000]
    if narrator_preset == "custom":
        narrator_voice = narrator_direct.strip()
    elif narrator_preset == "auto":
        narrator_voice = ""
    else:
        narrator_voice = NARRATOR_VOICE_PRESET_TEXT.get(narrator_preset, "")
    if narrator_voice:
        clean["narrator_voice_desc"] = narrator_voice
    raw_turns = source.get("turns", {})
    if raw_turns is None:
        raw_turns = {}
    if not isinstance(raw_turns, dict):
        raise _UserInputError("Sequential speech turn data is malformed.")
    turns = {}
    for key, value in raw_turns.items():
        try:
            index = int(key)
        except Exception as exc:
            raise _UserInputError("Sequential speech contains an invalid Progress index.") from exc
        if index < 1 or index > MAX_TURNS or not isinstance(value, dict):
            raise _UserInputError(f"Sequential speech contains invalid data for Progress {key}.")
        if not bool(value.get("enabled", False)):
            continue
        turn = {"enabled": True}
        for slot in (1, 2, 3):
            source_value = str(value.get(f"speaker_{slot}", "") or "")
            if source_value and source_value not in SEQUENTIAL_VOCAL_SOURCES:
                raise _UserInputError(f"Progress {index} Vocal {slot} has an unsupported speaker: {source_value}.")
            if source_value:
                turn[f"speaker_{slot}"] = source_value
            if slot == 1:
                continue
            text_value = str(value.get(f"text_{slot}", "") or "")
            if len(text_value) > 8000:
                raise _UserInputError(f"Progress {index} Vocal {slot} is too long; keep each added dialogue under 8000 characters.")
            turn[f"text_{slot}"] = text_value
            language = str(value.get(f"language_{slot}", "auto") or "auto")
            if language not in DIALOGUE_LANGUAGE_VALUES:
                raise _UserInputError(f"Progress {index} Vocal {slot} has an unsupported dialogue language: {language}.")
            turn[f"language_{slot}"] = language
            delivery = str(value.get(f"delivery_{slot}", "on_screen") or "on_screen")
            if delivery not in DIALOGUE_DELIVERY_VALUES:
                raise _UserInputError(f"Progress {index} Vocal {slot} has an unsupported delivery: {delivery}.")
            turn[f"delivery_{slot}"] = delivery
        turns[str(index)] = turn
    if turns:
        clean["turns"] = turns
    return clean

def _sequential_turn_state(state: dict, source_turn_index: int) -> dict:
    turns = state.get("turns", {}) if isinstance(state, dict) else {}
    value = turns.get(str(int(source_turn_index)), {}) if isinstance(turns, dict) else {}
    return value if isinstance(value, dict) and value.get("enabled") else {}

class _ProfileSafetyError(_UserInputError):
    """Raised when a built-in adult-only preset is paired with a non-adult age."""


def _profile_safety_error(slot: str, profile: dict) -> str:
    """Return one clear error for an impossible built-in profile combination."""
    age = profile.get("age", "unspecified")
    if age in PROFILE_SAFETY["adult_ages"]:
        return ""

    appearance = profile.get("appearance_preset", "none")
    clothing = profile.get("clothing_preset", "none")
    if appearance in PROFILE_SAFETY["adult_only_appearance"]:
        field, value = "appearance_preset", appearance
    elif clothing in PROFILE_SAFETY["adult_only_clothing"]:
        field, value = "clothing_preset", clothing
    else:
        return ""

    return (
        f"person_{slot.lower()}_{field}={value} is an adult-only built-in preset and requires an explicit age of 20s or older; "
        f"current age={age}. Choose an adult age or another preset. "
        "This rule applies only to the node's built-in profile presets; free-text scene/profile inputs are not analyzed or modified."
    )


def _repair_profile_safety(slot: str, profile: dict) -> List[str]:
    """Drop only incompatible built-in adult-only presets and preserve free text.

    Age/profile mismatches are common UI mistakes after changing person age. They
    should not abort prompt generation. The structured built-in preset is the
    only thing repaired; user-authored appearance/clothing text is untouched.
    """
    warnings: List[str] = []
    age = str(profile.get("age", "unspecified") or "unspecified")
    if age in PROFILE_SAFETY["adult_ages"]:
        return warnings
    appearance = str(profile.get("appearance_preset", "none") or "none")
    clothing = str(profile.get("clothing_preset", "none") or "none")
    if appearance in PROFILE_SAFETY["adult_only_appearance"]:
        profile["appearance_preset"] = "none"
        warnings.append(
            f"Person {slot}: appearance preset {appearance} requires an explicit adult age; "
            f"the preset was ignored because age={age}. Free-text appearance was preserved."
        )
    if clothing in PROFILE_SAFETY["adult_only_clothing"]:
        profile["clothing_preset"] = "none"
        warnings.append(
            f"Person {slot}: clothing preset {clothing} requires an explicit adult age; "
            f"the preset was ignored because age={age}. Free-text clothing was preserved."
        )
    return warnings


TURN_SPEAKER_VALUES = ("A", "B", "C", "A+B", "A+C", "B+C", "A+B+C")
CAMERA_TARGET_VALUES = ("current_action", "A", "B", "C", "A+B", "A+C", "B+C", "A+B+C", "scene")
CAMERA_FRAMING_VALUES = ("auto", "face_closeup", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene")
MAX_TURNS = 6
MAX_CAMERA_SHOTS = 6

APPEARANCE_PRESET_TEXT = {
    "none": "",
    "slim_build": "a slim build",
    "athletic_build": "an athletic build",
    "petite_build": "a petite build",
    "curvy_build": "a curvy build",
    "hourglass_figure": "an hourglass figure",
    "full_bust": "a full bust",
    "small_bust": "a small bust",
    "long_legs": "long legs",
    "long_black_hair": "long black hair",
    "straight_hair": "straight hair",
    "short_hair": "short hair",
    "wavy_hair": "wavy hair",
    "full_figure": "a full-figured build",
    "tall_build": "a tall build",
    "broad_shoulders": "broad shoulders",
    "soft_round_features": "soft, rounded facial features",
    "defined_jawline": "a defined jawline",
    "long_brown_hair": "long brown hair",
    "shoulder_length_hair": "shoulder-length hair",
    "short_bob": "a short bob haircut",
    "pixie_cut": "a pixie cut",
    "curly_hair": "curly hair",
    "ponytail": "hair tied in a ponytail",
    "braided_hair": "braided hair",
    "freckles": "light freckles",
    "average_build": "an average build",
    "diminutive_build": "a slight, delicate build",
    "solid_build": "a sturdy build",
    "lean_muscular_build": "a lean, toned build",
    "muscular_build": "a muscular build",
    "tall_slim_build": "a tall, slim build",
    "short_stature": "short stature",
    "buzz_cut": "a buzz cut",
    "light_stubble": "light stubble",
    "full_beard": "a full beard",
}
CLOTHING_PRESET_TEXT = {
    "none": "",
    "hanbok": "hanbok",
    "tailored_suit": "a tailored suit",
    "shirt_and_slacks": "a shirt with slacks",
    "dress": "a dress",
    "school_uniform": "a neat school uniform",
    "cardigan_and_skirt": "a cardigan with a coordinated skirt",
    "blouse_and_jeans": "a blouse with jeans",
    "turtleneck_and_slacks": "a turtleneck with tailored slacks",
    "oversized_sweater": "an oversized sweater with casual bottoms",
    "casual_jeans": "casual jeans",
    "crop_top_and_leggings": "a crop top with leggings",
    "tank_top_and_shorts": "a tank top with shorts",
    "sportswear": "sportswear",
    "coat_and_skirt": "a coat with a skirt",
    "swimsuit": "a swimsuit",
    "bikini": "a bikini",
    "blouse_and_pencil_skirt": "a fitted blouse with a pencil skirt",
    "business_casual": "a polished business-casual outfit",
    "tshirt_and_jeans": "a simple T-shirt with jeans",
    "knit_sweater_and_skirt": "a knit sweater with a skirt",
    "trench_coat": "a trench coat over a coordinated outfit",
    "leather_jacket": "a leather jacket with fitted trousers",
    "denim_jacket": "a denim jacket with casual basics",
    "hoodie_and_joggers": "a hoodie with jogger pants",
    "streetwear": "layered contemporary streetwear",
    "yoga_outfit": "a fitted yoga top with leggings",
    "tennis_outfit": "a tennis top with a pleated sport skirt",
    "cycling_outfit": "a fitted cycling jersey with cycling shorts",
    "sundress": "a light sundress",
    "cocktail_dress": "an elegant cocktail dress",
    "evening_gown": "a formal evening gown",
    "bodycon_dress": "a fitted bodycon dress",
    "off_shoulder_dress": "an off-the-shoulder dress",
    "halter_neck_dress": "a halter-neck dress",
    "slip_dress": "a satin slip dress",
    "mini_skirt_and_blouse": "a blouse with a mini skirt",
    "crop_top_and_jeans": "a crop top with high-waisted jeans",
    "camisole_and_shorts": "a camisole top with tailored shorts",
    "one_piece_swimsuit": "a one-piece swimsuit",
    "beach_cover_up": "a swimsuit with a light beach cover-up",
    "work_apron": "a practical work apron over everyday clothes",
    "chef_uniform": "a chef's uniform",
    "pajamas": "pajamas",
    "raincoat": "a raincoat",
    "puffer_jacket": "a puffer jacket",
    "work_overalls": "work overalls",
    "medical_scrubs": "medical scrubs",
    "lab_coat": "a white lab coat",
    "mechanic_coveralls": "mechanic coveralls",
    "kimono": "a kimono",
    "qipao": "a qipao",
    "ao_dai": "an ao dai",
    "lingerie_set": "a lingerie set",
    "bra_and_panties": "a bra and panties",
    "thong_only": "a thong only",
    "loose_apron_only": "a loose apron only",
    "sheer_lingerie": "sheer lingerie",
    "open_robe_lingerie": "an open robe with lingerie",
    "topless_with_bottoms": "bottoms only with the chest uncovered",
    "micro_bikini": "a micro bikini",
    "bodystocking": "a bodystocking",
    "nude": "nothing",
}

# Korean combo labels are accepted by the backend only as a legacy workflow
# compatibility fallback. Current display localization is owned entirely by
# ComfyUI native locales/en and locales/ko metadata; the frontend extension does
# not infer or override the application language.
KO_CHOICE_ALIASES = {
    "scene_input_role": {
        "대사 자동 감지 · 보수적": "auto_safe",
        "장면 / 행동 전용 (권장)": "scene_action",
        "전체를 대사로 처리": "dialogue",
    },
    "mode": {
        "자동": "auto",
        "텍스트 → 영상 (T2VA)": "t2va",
        "시작 이미지 → 영상 (I2VA)": "i2va",
        "첫 + 마지막 이미지 → 영상 (FL2VA)": "fl2va",
        "마지막 이미지 → 영상 (L2VA)": "l2va",
    },
    "shot_layout": {
        "자동 · 안전": "auto_safe",
        "1 숏": "single",
        "2 숏": "two",
        "3 숏": "three",
        "4 숏": "four",
        "1컷": "single",
        "2컷": "two",
        "3컷": "three",
        "4컷": "four",
    },
    "visual_style": {
        "원문 / 참조 유지 · 스타일 추가 없음": "auto",
        "원문/참조 스타일 유지": "auto",
        "스타일 추가 없음 / 참조 이미지 스타일 유지": "auto",
        "시네마틱": "cinematic",
        "영화풍": "cinematic",
        "패밀리 필름": "family_film",
        "따뜻한 가족 영화풍": "family_film",
        "웜 시네마틱": "warm_cinematic",
        "따뜻한 영화풍": "warm_cinematic",
        "내추럴": "natural",
        "자연스러운 실사풍": "natural",
        "실사": "live_action",
        "실사 + 시네마틱": "live_action_cinematic",
        "2D 애니메이션": "2d_animated",
        "일본 애니 스타일": "japanese_anime",
        "3D CG": "3d_cg",
        "클레이메이션": "claymation",
        "수채화": "watercolor",
        "빈티지 필름": "vintage_film",
        "흑백 시네마": "monochrome_cinematic",
        "필름 누아르": "film_noir",
        "다크 판타지": "dark_fantasy",
        "시네마틱 공포": "cinematic_horror",
        "영화풍 공포": "cinematic_horror",
        "공포 영화풍": "cinematic_horror",
        "불길한 어둠": "ominous_dark",
        "불길한 어두운 분위기": "ominous_dark",
        "불길하고 어두운 분위기": "ominous_dark",
        "포스트 아포칼립스": "post_apocalyptic",
        "멸망 이후 세계풍": "post_apocalyptic",
        "문명 붕괴 이후 세계풍": "post_apocalyptic",
        "고딕": "gothic",
        "사이버펑크": "cyberpunk",
        "네온 미래도시풍 (사이버펑크)": "cyberpunk",
        "네온 미래 도시풍 (사이버펑크)": "cyberpunk",
        "몽환": "dreamlike",
    },
    "camera_motion": {
        "카메라 지시 없음": "auto",
        "고정 숏": "static",
        "줌 인": "zoom_in",
        "줌 아웃": "zoom_out",
        "푸시 인": "push_in",
        "풀 아웃": "pull_out",
        "팬 왼쪽": "pan_left",
        "팬 오른쪽": "pan_right",
        "트럭 왼쪽": "truck_left",
        "카메라 왼쪽 평행 이동": "truck_left",
        "트럭 오른쪽": "truck_right",
        "카메라 오른쪽 평행 이동": "truck_right",
        "틸트 업": "tilt_up",
        "틸트 다운": "tilt_down",
        "페데스털 업": "pedestal_up",
        "카메라 수직 상승": "pedestal_up",
        "페데스털 다운": "pedestal_down",
        "카메라 수직 하강": "pedestal_down",
        "아크 숏": "arc_shot",
        "피사체 주위 원호 이동": "arc_shot",
        "트래킹 숏": "tracking_shot",
        "피사체 따라가기": "tracking_shot",
        "핸드헬드 추적 촬영": "handheld_tracking",
        "Handheld Tracking": "handheld_tracking",
        "handheld tracking": "handheld_tracking",
        # Legacy workflow convenience option: preserve older saved workflows by
        # mapping it to H3's closest named motion type.
        "dynamic": "tracking_shot",
        "다이나믹": "tracking_shot",
        "다이나믹 카메라": "tracking_shot",
        "약한 카메라 흔들림": "shake_slightly",
        "강한 카메라 흔들림": "shake_strongly",
        "POV": "pov",
        "1인칭 시점": "pov",
        "시계방향 롤": "roll_clockwise",
        "화면 시계방향 회전": "roll_clockwise",
        "반시계방향 롤": "roll_counterclockwise",
        "화면 반시계방향 회전": "roll_counterclockwise",
    },
    "camera_amplitude": {
        "기본 · 생략": "default",
        "작게": "small",
        "크게": "large",
    },
    "camera_speed": {
        "기본 · 생략": "default",
        "느리게": "slow",
        "빠르게": "fast",
    },
    "camera_shot_amplitude": {
        "기본 설정을 따라감": "inherit",
        "기본 · 생략": "default",
        "작게": "small",
        "크게": "large",
    },
    "camera_shot_speed": {
        "기본 설정을 따라감": "inherit",
        "기본 · 생략": "default",
        "느리게": "slow",
        "빠르게": "fast",
    },
    "camera_target": {
        "현재 진행 중심": "current_action",
        "현재 진행에 맞춤": "current_action",
        "인물 1": "A",
        "인물 2": "B",
        "인물 3": "C",
        "인물 1 + 2": "A+B",
        "인물 1 + 3": "A+C",
        "인물 2 + 3": "B+C",
        "인물 1 + 2 + 3": "A+B+C",
        "전체 장면": "scene",
    },
    "camera_transition": {
        "일반 컷": "cut",
        "일반 컷 (전환 방식)": "cut",
        "부드럽게 겹치며 전환": "cross_dissolve",
        "부드럽게 겹치며 전환 (전환 방식)": "cross_dissolve",
        "겹침 전환 (크로스 디졸브)": "cross_dissolve",
        "페이드 전환": "fade",
        "페이드 (전환 방식)": "fade",
        "화면 밀어내기 전환": "wipe",
        "화면 밀어내기 (전환 방식)": "wipe",
        "밀어내기 전환 (와이프)": "wipe",
        # Legacy experimental transition values.  H3 explicitly
        # documents cut/cross-dissolve/fade/wipe, so migrate old values to the
        # closest official transition instead of emitting unsupported effects.
        "blind": "wipe",
        "slide": "wipe",
        "rotate": "cut",
        "bounce": "cut",
        "블라인드 전환": "wipe",
        "슬라이드 전환": "wipe",
        "회전 전환": "cut",
        "바운스 전환": "cut",
    },
    "reference_fidelity": {
        "강하게 유지": "strict",
        "균형": "balanced",
        "변화 허용": "creative",
    },
    "soundscape_mode": {
        "자동": "auto",
        "최소 자연음": "minimal",
        "최소한의 환경음": "minimal",
        "사용자 환경음 힌트만 · 힌트 필수": "custom_only",
        "직접 입력한 환경음만 사용 (입력 필수)": "custom_only",
        "직접 입력한 환경음만 사용 (비우면 자연음으로 보정)": "custom_only",
        "환경음 / 물리음 없음": "silent",
        "환경음·동작음 없음": "silent",
    },
    "music_mode": {
        "사용 안 함": "none",
        "성긴 피아노 + 저음 현악": "sparse_piano_strings",
        "절제된 피아노 + 저음 현악": "sparse_piano_strings",
        "어쿠스틱 기타 + 베이스": "acoustic_guitar_bass",
        "앰비언트 신스": "ambient_synth",
        "잔잔한 신시사이저": "ambient_synth",
        "전자 펄스": "electronic_pulse",
        "반복되는 전자 리듬": "electronic_pulse",
        "오케스트라 상승": "orchestral_rise",
        "점차 고조되는 오케스트라": "orchestral_rise",
        "클래식 기타": "classical_guitar",
        "잔잔한 경음악": "soft_light_music",
        "잔잔한 클래식": "gentle_classical",
        "경쾌한 행진곡": "cheerful_march",
        "장엄한 행진곡": "grand_march",
        "보사노바": "bossa_nova",
        "서정적 하프 + 첼로": "lyrical_harp_cello",
        "하프 + 첼로": "lyrical_harp_cello",
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
        "한국 전통 퓨전": "korean_traditional_fusion",
        "사용자 음악 힌트 · 힌트 필수": "custom",
        "직접 입력한 음악 사용 (입력 필수)": "custom",
        "직접 입력한 음악 사용 (비우면 음악 없음으로 보정)": "custom",
    },
    "dialogue_language": {
        "자동 · 한글/영어 우선": "auto",
        "자동 · 한국어/영어 우선 판별": "auto",
        "자동 · 문자권 기반": "auto",
        "영어": "English",
        "한국어": "Korean",
        "일본어": "Japanese",
        "중국어": "Chinese",
        "스페인어": "Spanish",
        "프랑스어": "French",
        "독일어": "German",
        "러시아어": "Russian",
        "아랍어": "Arabic",
        "이탈리아어": "Italian",
        "포르투갈어": "Portuguese",
    },
    "dialogue_delivery": {
        "화면 속 인물이 직접 말함": "on_screen",
        "화면 밖 내레이션": "voiceover",
        "화면 밖 음성 (보이스오버)": "voiceover",
        # Accept legacy Korean wording if it ever appears in a saved workflow.
        "화면 속 인물 발화": "on_screen",
        "화면 밖 보이스오버": "voiceover",
    },
    "scene_translate": {
        "사용 안 함": "off",
        "사용 안 함 · 입력 그대로": "off",
        "한글→영문 자동번역": "ko_to_en",
        "자동 · 한글→영문 / 영어 그대로": "ko_to_en",
        "자동 · 한국어→영어 / 영어는 그대로": "ko_to_en",
    },
    "gender": {
        "지정 안 함": "unspecified",
        "여성": "female",
        "남성": "male",
        "논바이너리": "nonbinary",
        "남성·여성 이외 (논바이너리)": "nonbinary",
    },
    "age": {
        "지정 안 함": "unspecified",
        "어린이": "child",
        "청소년": "teen",
        "20대": "twenties",
        "30대": "thirties",
        "40대": "forties",
        "50대": "fifties",
        "60대": "sixties",
        "노년": "elderly",
        "노년층": "elderly",
        # Legacy canonical values retained for older saved workflows.
        "young_adult": "twenties",
        "adult": "thirties",
        "middle_aged": "forties",
        "older_adult": "elderly",
    },
    "appearance_preset": {
        "지정 안 함": "none",
        "마른 체형": "slim_build",
        "슬림한 체형": "slim_build",
        "탄탄한 체형": "athletic_build",
        "아담한 체형": "petite_build",
        "곡선미 있는 체형": "curvy_build",
        "곡선이 도드라진 체형": "curvy_build",
        "모래시계 체형": "hourglass_figure",
        "허리가 잘록한 모래시계 체형": "hourglass_figure",
        "풍만한 가슴": "full_bust",
        "풍만한 가슴 (성인 전용)": "full_bust",
        "볼륨 있는 가슴": "full_bust",
        "볼륨 있는 가슴 (성인 전용)": "full_bust",
        "빈약한 가슴": "small_bust",
        "빈약한 가슴 (성인 전용)": "small_bust",
        "작은 가슴": "small_bust",
        "작은 가슴 (성인 전용)": "small_bust",
        "긴 다리": "long_legs",
        "긴 검은 머리": "long_black_hair",
        "생머리": "straight_hair",
        "짧은 머리": "short_hair",
        "웨이브 헤어": "wavy_hair",
        "웨이브 머리": "wavy_hair",
        "풍만한 체형": "full_figure",
        "볼륨 있는 체형": "full_figure",
        "큰 키와 늘씬한 체형": "tall_build",
        "큰 키의 늘씬한 체형": "tall_build",
        "넓은 어깨": "broad_shoulders",
        "부드럽고 둥근 얼굴선": "soft_round_features",
        "또렷한 턱선": "defined_jawline",
        "긴 갈색 머리": "long_brown_hair",
        "어깨 길이 머리": "shoulder_length_hair",
        "어깨까지 오는 머리": "shoulder_length_hair",
        "짧은 단발": "short_bob",
        "픽시컷": "pixie_cut",
        "아주 짧은 머리 (픽시컷)": "pixie_cut",
        "곱슬머리": "curly_hair",
        "포니테일": "ponytail",
        "뒤로 묶은 머리 (포니테일)": "ponytail",
        "땋은 머리": "braided_hair",
        "옅은 주근깨": "freckles",
        "보통 체형": "average_build",
        "왜소한 체형": "diminutive_build",
        "다부진 체형": "solid_build",
        "마르고 탄탄한 체형": "lean_muscular_build",
        "근육질 체형": "muscular_build",
        "키 크고 마른 체형": "tall_slim_build",
        "작은 키": "short_stature",
        "버즈컷": "buzz_cut",
        "아주 짧게 민 머리 (버즈컷)": "buzz_cut",
        "옅은 수염": "light_stubble",
        "풍성한 턱수염": "full_beard",
    },
    "clothing_preset": {
        "지정 안 함": "none",
        "한복": "hanbok",
        "맞춤 정장": "tailored_suit",
        "셔츠와 슬랙스": "shirt_and_slacks",
        "드레스": "dress",
        "교복": "school_uniform",
        "가디건 + 스커트": "cardigan_and_skirt",
        "가디건과 스커트": "cardigan_and_skirt",
        "블라우스 + 청바지": "blouse_and_jeans",
        "블라우스와 청바지": "blouse_and_jeans",
        "터틀넥 + 슬랙스": "turtleneck_and_slacks",
        "터틀넥과 슬랙스": "turtleneck_and_slacks",
        "오버사이즈 스웨터": "oversized_sweater",
        "청바지 캐주얼": "casual_jeans",
        "캐주얼 청바지 차림": "casual_jeans",
        "크롭탑과 레깅스": "crop_top_and_leggings",
        "탱크톱 + 반바지": "tank_top_and_shorts",
        "탱크톱과 반바지": "tank_top_and_shorts",
        "운동복 / 조깅복": "sportswear",
        "운동복·조깅복": "sportswear",
        "코트와 스커트": "coat_and_skirt",
        "수영복": "swimsuit",
        "비키니": "bikini",
        "블라우스와 펜슬 스커트": "blouse_and_pencil_skirt",
        "비즈니스 캐주얼": "business_casual",
        "비즈니스 캐주얼 차림": "business_casual",
        "티셔츠와 청바지": "tshirt_and_jeans",
        "니트와 스커트": "knit_sweater_and_skirt",
        "니트 스웨터와 스커트": "knit_sweater_and_skirt",
        "트렌치코트": "trench_coat",
        "가죽 재킷": "leather_jacket",
        "데님 재킷": "denim_jacket",
        "후드티와 조거 팬츠": "hoodie_and_joggers",
        "후드티와 조거팬츠": "hoodie_and_joggers",
        "현대적 스트리트웨어": "streetwear",
        "현대적인 스트리트 패션": "streetwear",
        "요가복": "yoga_outfit",
        "테니스복": "tennis_outfit",
        "사이클링복": "cycling_outfit",
        "자전거 라이딩복": "cycling_outfit",
        "선드레스": "sundress",
        "여름 원피스 (선드레스)": "sundress",
        "칵테일 드레스": "cocktail_dress",
        "이브닝 가운": "evening_gown",
        "바디콘 드레스 (성인)": "bodycon_dress",
        "몸에 붙는 드레스 (바디콘·성인 전용)": "bodycon_dress",
        "오프숄더 드레스 (성인)": "off_shoulder_dress",
        "어깨가 드러나는 드레스 (오프숄더·성인 전용)": "off_shoulder_dress",
        "홀터넥 드레스 (성인)": "halter_neck_dress",
        "목 뒤로 연결되는 드레스 (홀터넥·성인 전용)": "halter_neck_dress",
        "슬립 드레스 (성인)": "slip_dress",
        "슬립 드레스 (성인 전용)": "slip_dress",
        "블라우스와 미니스커트 (성인)": "mini_skirt_and_blouse",
        "블라우스와 미니스커트 (성인 전용)": "mini_skirt_and_blouse",
        "크롭탑과 청바지 (성인)": "crop_top_and_jeans",
        "크롭탑과 청바지 (성인 전용)": "crop_top_and_jeans",
        "캐미솔과 쇼츠 (성인)": "camisole_and_shorts",
        "캐미솔과 반바지 (성인 전용)": "camisole_and_shorts",
        "원피스 수영복": "one_piece_swimsuit",
        "수영복과 비치 커버업": "beach_cover_up",
        "수영복과 비치 겉옷 (커버업)": "beach_cover_up",
        "앞치마": "work_apron",
        "작업용 앞치마": "work_apron",
        "셰프복": "chef_uniform",
        "요리사 유니폼": "chef_uniform",
        "잠옷": "pajamas",
        "우비": "raincoat",
        "패딩 점퍼": "puffer_jacket",
        "멜빵 작업복": "work_overalls",
        "작업복 멜빵 바지": "work_overalls",
        "스크럽": "medical_scrubs",
        "의료용 스크럽": "medical_scrubs",
        "실험복": "lab_coat",
        "정비복": "mechanic_coveralls",
        "기모노": "kimono",
        "치파오": "qipao",
        "아오자이": "ao_dai",
        "란제리": "lingerie_set",
        "란제리 세트": "lingerie_set",
        "브라와 팬티": "bra_and_panties",
        "브라와 팬티만": "bra_and_panties",
        "티팬티만": "thong_only",
        "헐렁한 앞치마만": "loose_apron_only",
        "시스루 란제리": "sheer_lingerie",
        "오픈 가운과 란제리": "open_robe_lingerie",
        "하의만 착용한 상반신 노출": "topless_with_bottoms",
        "마이크로 비키니": "micro_bikini",
        "보디스타킹": "bodystocking",
        "누드 (성인 전용)": "nude",
    },
    "turn_speaker": {
        "A": "A",
        "B": "B",
        "C": "C",
        "A+B": "A+B",
        "A+C": "A+C",
        "B+C": "B+C",
        "A+B+C": "A+B+C",
        "인물 1": "A",
        "인물 2": "B",
        "인물 3": "C",
        "인물 1 + 2": "A+B",
        "인물 1 + 3": "A+C",
        "인물 2 + 3": "B+C",
        "인물 1 + 2 + 3": "A+B+C",
    },
}


def _choice_values(canonical_values: Sequence[str], field: str) -> List[str]:
    # Expose canonical backend values only. ComfyUI's official nodeDefs.json
    # localization maps those stable values to the active UI language. Korean
    # aliases remain accepted by _canonical_choice() solely for older workflows.
    return list(canonical_values)


def _canonical_choice(value: Any, allowed: Sequence[str], field: str) -> str:
    raw = str(value)
    canonical = KO_CHOICE_ALIASES.get(field, {}).get(raw, raw)
    if canonical not in allowed:
        raise _UserInputError(f"Unsupported {field}: {value}")
    return canonical

def _sequential_vocal_from_kwargs(kwargs: dict, turn_count: int) -> dict:
    """Read Continue-Speaking state while preserving the recovery Core order.

    Speaker/language/delivery state stays in ``ultra_extension_options_json``.
    Only text that must behave like an ordinary connectable ComfyUI STRING uses
    native Core fields: Narrator direct voice plus Vocal 2/3 dialogue.  Those 13
    fields are added without changing the relative order of the recovery Main
    120 / R2V 111 Core widgets, and old positional workflows are migrated before
    ComfyUI configures the node.
    """
    raw_transport = kwargs.get("ultra_extension_options_json", "{}")
    transport_source = None
    if isinstance(raw_transport, dict):
        transport_source = raw_transport
    else:
        text = str(raw_transport or "").strip()
        if text and text != "{}" and len(text) <= SEQUENTIAL_VOCAL_MAX_CHARS:
            try:
                candidate = json.loads(text)
            except Exception:
                candidate = None
            if isinstance(candidate, dict):
                transport_source = candidate

    if isinstance(transport_source, dict) and "sequential_vocal" in transport_source:
        parsed = _parse_sequential_vocal_json(transport_source.get("sequential_vocal"))
        # Ignore stale rows beyond the active Progress count while preserving the
        # stored UI state for when the user raises the count again.
        turns = parsed.get("turns")
        if isinstance(turns, dict):
            parsed["turns"] = {
                str(index): value
                for index, value in turns.items()
                if 1 <= int(index) <= int(turn_count)
            }
            if not parsed["turns"]:
                parsed.pop("turns", None)

        # The compact UI keeps non-text Continue-Speaking settings in the
        # extension transport, but actual dialogue/narrator text uses ordinary
        # Core STRING widget-inputs so external text connections work exactly as
        # they do for Timeline dialogue. Core values are authoritative here.
        raw_seq = transport_source.get("sequential_vocal")
        narrator_custom = isinstance(raw_seq, dict) and str(raw_seq.get("narrator_voice_preset", "auto") or "auto") == "custom"
        if narrator_custom:
            narrator_text = str(kwargs.get("narrator_voice_desc", "") or "")[:1000]
            if narrator_text.strip():
                parsed["narrator_voice_desc"] = narrator_text
            else:
                parsed.pop("narrator_voice_desc", None)
        parsed_turns = parsed.get("turns")
        if isinstance(parsed_turns, dict):
            for index in range(1, int(turn_count) + 1):
                turn = parsed_turns.get(str(index))
                if not isinstance(turn, dict) or not bool(turn.get("enabled")):
                    continue
                for slot in (2, 3):
                    text = str(kwargs.get(f"turn_{index}_vocal_{slot}_text", "") or "")
                    if len(text) > 8000:
                        raise _UserInputError(
                            f"Progress {index} Vocal {slot} is too long; keep each added dialogue under 8000 characters."
                        )
                    turn[f"text_{slot}"] = text
        return parsed

    # Compatibility path for the abandoned prototype that exposed every Vocal
    # field as a native Core widget.  Keeping this parser costs no schema slots
    # and lets direct API callers migrate cleanly.
    state = {"version": SEQUENTIAL_VOCAL_VERSION}
    has_native_state = any(
        f"turn_{index}_sequential_vocal" in kwargs
        for index in range(1, int(turn_count) + 1)
    ) or "narrator_voice_preset" in kwargs or "narrator_voice_desc" in kwargs
    if not has_native_state:
        return state

    preset = _canonical_choice(
        kwargs.get("narrator_voice_preset", "auto"),
        NARRATOR_VOICE_PRESET_VALUES,
        "narrator_voice_preset",
    )
    direct_voice = str(kwargs.get("narrator_voice_desc", "") or "").strip()
    if preset == "custom":
        narrator_voice = direct_voice
    elif preset == "auto":
        narrator_voice = ""
    else:
        narrator_voice = NARRATOR_VOICE_PRESET_TEXT[preset]
    if narrator_voice:
        state["narrator_voice_desc"] = narrator_voice

    turns = {}
    for index in range(1, int(turn_count) + 1):
        enabled = _validate_bool_field(
            kwargs.get(f"turn_{index}_sequential_vocal", False),
            f"turn_{index}_sequential_vocal",
        )
        if not enabled:
            continue
        turn = {"enabled": True}
        for slot in (1, 2, 3):
            default_speaker = (
                kwargs.get(f"turn_{index}_speaker", "A")
                if slot == 1
                else SEQUENTIAL_VOCAL_ADDED_SLOT_DEFAULT_SPEAKER
            )
            speaker = _canonical_choice(
                kwargs.get(f"turn_{index}_vocal_{slot}_speaker", default_speaker),
                SEQUENTIAL_VOCAL_SOURCES,
                "sequential_speaker",
            )
            turn[f"speaker_{slot}"] = speaker
            if slot == 1:
                continue
            text = str(kwargs.get(f"turn_{index}_vocal_{slot}_text", "") or "")
            if len(text) > 8000:
                raise _UserInputError(
                    f"Progress {index} Vocal {slot} is too long; keep each added dialogue under 8000 characters."
                )
            turn[f"text_{slot}"] = text
            turn[f"language_{slot}"] = _canonical_choice(
                kwargs.get(f"turn_{index}_vocal_{slot}_language", "auto"),
                DIALOGUE_LANGUAGE_VALUES,
                "dialogue_language",
            )
            turn[f"delivery_{slot}"] = _canonical_choice(
                kwargs.get(f"turn_{index}_vocal_{slot}_delivery", "on_screen"),
                DIALOGUE_DELIVERY_VALUES,
                "dialogue_delivery",
            )
        turns[str(index)] = turn
    if turns:
        state["turns"] = turns
    return state

def _validate_bool_field(value: Any, field: str) -> bool:
    """Validate public BOOLEAN workflow fields without Python truthiness surprises.

    Native ComfyUI BOOLEAN widgets provide real booleans. A small explicit
    compatibility set is also accepted for direct API / older serialized data;
    arbitrary non-empty strings must never silently become True.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = float("nan")
        if math.isfinite(numeric) and numeric in (0.0, 1.0):
            return bool(int(numeric))
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1"}:
            return True
        if normalized in {"false", "0"}:
            return False
    raise _UserInputError(f"{field} must be a boolean value (true/false).")


def _validate_int_field(value: Any, field: str, minimum: int, maximum: int) -> int:
    """Validate an integer-valued public workflow field without silent truncation."""
    if isinstance(value, bool):
        raise _UserInputError(f"{field} must be an integer from {minimum} to {maximum}.")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise _UserInputError(f"{field} must be an integer from {minimum} to {maximum}.") from exc
    if not math.isfinite(numeric) or not numeric.is_integer():
        raise _UserInputError(f"{field} must be an integer from {minimum} to {maximum}; current value={value!r}.")
    result = int(numeric)
    if result < minimum or result > maximum:
        raise _UserInputError(f"{field} must be an integer from {minimum} to {maximum}.")
    return result


def _snap_half_second(value: float) -> float:
    """Snap a non-negative time to the same nearest 0.5-second grid as the UI."""
    numeric = max(0.0, float(value))
    return math.floor(numeric * 2.0 + 0.5) / 2.0


def _validate_duration_seconds(value: Any) -> int:
    """Accept whole-second planning durations from 4 through 30."""
    if isinstance(value, bool):
        raise _UserInputError("duration_seconds must be an integer from 4 to 30.")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise _UserInputError("duration_seconds must be an integer from 4 to 30.") from exc
    if not math.isfinite(numeric) or not numeric.is_integer():
        raise _UserInputError(
            f"duration_seconds={value!r} is invalid for MiniMax H3; use a whole number from 4 to 30 seconds."
        )
    duration = int(numeric)
    if not (4 <= duration <= 30):
        raise _UserInputError("duration_seconds must be an integer from 4 to 30.")
    return duration

STYLE_TEXT = {
    # MiniMax H3 expects the overall visual style at the start of Shot 1.
    # These declarations are deliberately strong enough to affect the actual
    # rendered world/medium, not merely add a weak color grade.  They also state
    # cross-shot continuity because later Timeline environment changes can
    # otherwise overpower a one-line style prefix.
    "cinematic": "Cinematic, polished live-action feature-film imagery with deliberate composition, dimensional lighting, controlled contrast, realistic materials, and natural cinematic motion. Keep this cinematic treatment visually consistent across every shot and later setting change.",
    "family_film": "Family-film style, polished storybook-like live-action cinema with warm inviting color, soft flattering light, clear readable expressions, gentle emotional staging, and wholesome feature-film production design. Keep this warm family-film look consistent across every shot and setting change.",
    "warm_cinematic": "Warm cinematic, live-action feature-film imagery with soft golden-toned light, warm skin and material rendering, inviting contrast, gentle highlights, and emotionally warm composition. Keep this warm cinematic treatment consistent across every shot and setting change.",
    "natural": "Natural live-action, realistic unstylized real-world footage with believable available light, true-to-life materials and skin, grounded physical motion, restrained grading, and an observational camera feel. Keep the natural real-world appearance consistent across every shot and setting change.",
    "live_action": "Live-action, photoreal real-world footage with natural human appearance, physically plausible materials, believable lighting, realistic depth, and grounded motion rather than illustrated or synthetic rendering. Keep the live-action appearance consistent across every shot and setting change.",
    "live_action_cinematic": "Live-action, cinematic, photoreal feature-film footage with realistic people and materials, deliberate composition, polished dimensional lighting, controlled contrast, and natural cinematic motion. Keep this live-action cinematic treatment consistent across every shot and setting change.",
    "2d_animated": "2D-animated, render the entire video as coherent hand-drawn or digitally drawn 2D animation with clear linework, flattened graphic forms, animation-style shading, and intentionally non-photoreal surfaces. Keep the same 2D animation language across every shot and setting change.",
    "japanese_anime": "Japanese anime, render the entire video in a coherent Japanese 2D anime visual language with clean expressive linework, cel-style shading, designed highlights, readable facial acting, and animation-consistent motion. Keep the same anime rendering across every shot and setting change.",
    "3d_cg": "3D CG, render the entire video as polished computer-generated 3D animation with clearly modeled dimensional forms, coherent digital materials, controlled CG lighting, and smooth physically readable animated motion. Keep the same 3D CG rendering across every shot and setting change.",
    "claymation": "Claymation, render the entire video as tactile stop-motion clay animation with handmade clay characters and objects, visible sculpted texture, miniature practical-set character, and intentionally stepped stop-motion movement. Keep this claymation material language across every shot and setting change.",
    "watercolor": "Watercolor, render the entire video as moving hand-painted watercolor artwork with visible paper texture, translucent pigment washes, soft color bleeding, painterly edges, and illustration-like animated motion rather than photoreal surfaces. Keep the watercolor medium consistent across every shot and setting change.",
    "vintage_film": "Vintage film, live-action footage with an unmistakable older film-stock image character: restrained grain, softened highlight roll-off, slightly aged color response, modest contrast, and period-like optical texture without changing the story era unless the scene itself requests it. Keep the same vintage-film treatment across every shot and setting change.",
    "monochrome_cinematic": "Monochrome cinematic, render the entire video strictly in black and white with no color accents, using deliberate grayscale separation, sculpted light and shadow, cinematic tonal contrast, and polished monochrome composition. Keep the black-and-white treatment consistent across every shot and setting change.",
    "film_noir": "Film noir, render the entire video as classic black-and-white noir cinema with hard directional lighting, deep blacks, sharp shadow geometry, restrained highlights, dramatic negative space, and tense noir composition. Keep the noir visual language consistent across every shot and setting change.",
    "dark_fantasy": "Dark fantasy, reinterpret the selected world through unmistakable dark-fantasy art direction while keeping the chosen subjects and location recognizable: aged mythical materials, ancient or otherworldly design cues where contextually plausible, shadow-rich atmosphere, muted color, and restrained supernatural visual accents. Keep this dark-fantasy world state consistent across every shot and setting change.",
    "cinematic_horror": "Cinematic horror, render the scene with unmistakable live-action horror-film language: threatening negative space, unsettling staging, deep controlled shadows, ominous practical-looking light, restrained color, and visual tension that makes the ordinary setting feel dangerous without changing the requested action. Keep the horror treatment consistent across every shot and setting change.",
    "ominous_dark": "Ominous dark, keep the requested world recognizable but give the entire video a clearly foreboding visual mood through subdued color, low-key illumination, deep shadow structure, sparse highlights, uneasy spatial depth, and restrained visual tension. Keep this ominous treatment consistent across every shot and setting change.",
    "post_apocalyptic": "Post-apocalyptic, portray the selected setting as a believable world after large-scale civilizational collapse while keeping the location itself recognizable: abandoned or damaged infrastructure where contextually plausible, weathered and neglected architecture, scattered debris and remnants, improvised or scavenged materials, reduced signs of normal civic operation, and a harsh dust-muted atmosphere. Keep this post-apocalyptic world state consistent across every shot and later setting change; do not depict the world transforming into it during the clip.",
    "gothic": "Gothic, reinterpret the selected environment through unmistakable dark Gothic art direction while keeping its underlying location recognizable: ornate aged architecture or decorative forms where contextually plausible, dark stone and metal textures, vertical or pointed design cues, cool muted tones, dramatic low-key illumination, and solemn shadow-rich atmosphere. Keep this Gothic treatment consistent across every shot and setting change.",
    "cyberpunk": "Cyberpunk, reinterpret the selected environment as a convincing high-tech low-life future while keeping its underlying location recognizable: layered technological infrastructure, emissive signage and displays, neon-accented artificial light, reflective modern materials, dense utility detail, and visible advanced urban technology where contextually plausible. Keep this cyberpunk world state consistent across every shot and setting change.",
    "dreamlike": "Dreamlike, render the requested scene as a coherent waking dream with soft atmospheric diffusion, luminous transitions, subtly surreal spatial relationships, gently unreal visual details where contextually plausible, and fluid but readable continuity rather than ordinary documentary realism. Keep this dreamlike visual logic consistent across every shot and setting change.",
}

STYLE_START_PREFIXES = {
    "cinematic": "Cinematic,",
    "family_film": "Family-film style,",
    "warm_cinematic": "Warm cinematic,",
    "natural": "Natural live-action,",
    "live_action": "Live-action,",
    "live_action_cinematic": "Live-action, cinematic,",
    "2d_animated": "2D-animated,",
    "japanese_anime": "Japanese anime,",
    "3d_cg": "3D CG,",
    "claymation": "Claymation,",
    "watercolor": "Watercolor,",
    "vintage_film": "Vintage film,",
    "monochrome_cinematic": "Monochrome cinematic,",
    "film_noir": "Film noir,",
    "dark_fantasy": "Dark fantasy,",
    "cinematic_horror": "Cinematic horror,",
    "ominous_dark": "Ominous dark,",
    "post_apocalyptic": "Post-apocalyptic,",
    "gothic": "Gothic,",
    "cyberpunk": "Cyberpunk,",
    "dreamlike": "Dreamlike,",
}


STYLE_SHOT_CONTINUITY_TEXT = {
    "cinematic": "The same cinematic live-action treatment continues in this shot.",
    "family_film": "The same warm family-film visual treatment continues in this shot.",
    "warm_cinematic": "The same warm cinematic live-action treatment continues in this shot.",
    "natural": "The same natural live-action appearance continues in this shot.",
    "live_action": "The same photoreal live-action appearance continues in this shot.",
    "live_action_cinematic": "The same live-action cinematic treatment continues in this shot.",
    "2d_animated": "The same 2D animated rendering continues in this shot.",
    "japanese_anime": "The same Japanese anime rendering continues in this shot.",
    "3d_cg": "The same 3D CG rendering continues in this shot.",
    "claymation": "The same claymation stop-motion rendering continues in this shot.",
    "watercolor": "The same hand-painted watercolor rendering continues in this shot.",
    "vintage_film": "The same vintage film-stock treatment continues in this shot.",
    "monochrome_cinematic": "The same strict black-and-white cinematic treatment continues in this shot.",
    "film_noir": "The same classic black-and-white film-noir treatment continues in this shot.",
    "dark_fantasy": "The same dark-fantasy world state and art direction continue in this shot.",
    "cinematic_horror": "The same cinematic horror treatment continues in this shot.",
    "ominous_dark": "The same ominous dark visual treatment continues in this shot.",
    "post_apocalyptic": "The same post-apocalyptic collapse-era world state continues in this shot.",
    "gothic": "The same dark Gothic art direction continues in this shot.",
    "cyberpunk": "The same cyberpunk future-world art direction continues in this shot.",
    "dreamlike": "The same dreamlike visual logic continues in this shot.",
}

STYLE_WORLD_SETTING_CONTINUITY_TEXT = {
    "dark_fantasy": "Treat the selected location as its dark-fantasy version: its architecture, materials, props, and background activity must belong to the same mythical otherworldly setting rather than reverting to ordinary contemporary design.",
    "post_apocalyptic": "Treat the selected location as its post-collapse version: ordinary civic infrastructure, vehicles, businesses, signage, services, and background population must visibly belong to a damaged or improvised survivor-era society rather than a normally functioning present-day world; no transformation sequence is shown.",
    "gothic": "Treat the selected location as its Gothic version: architecture, materials, decorative forms, lighting, and background set dressing must retain the same dark Gothic art direction rather than reverting to ordinary contemporary design.",
    "cyberpunk": "Treat the selected location as its cyberpunk future version: architecture, signage, vehicles, infrastructure, utilities, and background activity must visibly belong to the same high-tech low-life world rather than ordinary present-day design.",
    "dreamlike": "Treat the selected location through the same coherent dreamlike visual logic: spatial relationships, atmosphere, materials, and background details may become subtly surreal while the location remains recognizable.",
}
# Only strongly worded media-style phrases are treated as conflicts. This is
# intentionally conservative so ordinary objects such as a watercolor painting
# inside a live-action scene do not produce noisy warnings.
_STYLE_MEDIA_PATTERNS = {
    "live_action": re.compile(r"(?i)\b(?:photorealistic|photo-realistic|live[- ]action)\s+(?:style|footage|video|look|render(?:ing)?)\b"),
    "2d_animated": re.compile(r"(?i)\b(?:2d[- ]animat(?:ed|ion)|anime|cartoon)\s+(?:style|look|video|render(?:ing)?)\b"),
    "3d_cg": re.compile(r"(?i)\b(?:3d\s*(?:cg|cgi|animation)|computer[- ]generated)\s+(?:style|look|video|render(?:ing)?)\b"),
    "claymation": re.compile(r"(?i)\b(?:claymation|clay[- ]animation|stop[- ]motion clay)\s+(?:style|look|video|render(?:ing)?)\b"),
    "watercolor": re.compile(r"(?i)\bwatercolou?r\s+(?:style|look|animation|video|render(?:ing)?)\b"),
}

_SOUND_HINT_DIALOGUE_RE = re.compile(r"(?i)(?:<d>|</d>|\b(?:dialogue|voiceover|narrator)\b|\b(?:he|she|they|person|man|woman|speaker)\s+says?\b)")
_SOUND_HINT_MUSIC_RE = re.compile(r"(?i)\b(?:background\s+music|music\s+plays?|song\s+plays?|singing|radio\s+music|television\s+music|phone\s+music)\b")
_MUSIC_ABSTRACT_MOOD_RE = re.compile(r"(?i)\b(?:melancholic|romantic|dreamy|triumphant|heroic|emotional|heartwarming|sad|happy|joyful|ominous|suspenseful|tense|mysterious|uplifting|inspiring)\b|\b(?:makes?\s+the\s+audience\s+feel|creates?\s+(?:a|an)\s+sense\s+of)\b")
_MUSIC_DIEGETIC_RE = re.compile(r"(?i)\b(?:radio|television|tv|phone|speaker|headphones?)\b.*\b(?:music|song|plays?|audible)\b|\b(?:audible\s+to|heard\s+by)\s+(?:the\s+)?characters?\b")


CAMERA_SENTENCES = {
    "static": "The camera holds a static shot",
    "zoom_in": "The camera zooms in",
    "zoom_out": "The camera zooms out",
    "push_in": "The camera pushes in",
    "pull_out": "The camera pulls out",
    "pan_left": "The camera pans left",
    "pan_right": "The camera pans right",
    "truck_left": "The camera trucks left",
    "truck_right": "The camera trucks right",
    "tilt_up": "The camera tilts up",
    "tilt_down": "The camera tilts down",
    "pedestal_up": "The camera moves upward in a pedestal shot",
    "pedestal_down": "The camera moves downward in a pedestal shot",
    "arc_shot": "The camera moves in an arc around the main visible subject",
    "tracking_shot": "The camera follows the main visible subject in a tracking shot",
    "handheld_tracking": "Throughout this shot, the camera follows the action with pronounced unstable handheld movement, irregular shake, abrupt small jolts, and imperfect framing as the operator continuously follows the action",
    "shake_slightly": "The camera shakes slightly",
    "shake_strongly": "The camera shakes strongly",
    "pov": "The camera presents the action from a POV perspective",
    "roll_clockwise": "The camera rolls clockwise",
    "roll_counterclockwise": "The camera rolls counterclockwise",
}

# Camera types for which amplitude/speed are semantically meaningful.
_CAMERA_MODIFIER_COMPATIBLE = {
    "zoom_in",
    "zoom_out",
    "push_in",
    "pull_out",
    "pan_left",
    "pan_right",
    "truck_left",
    "truck_right",
    "tilt_up",
    "tilt_down",
    "pedestal_up",
    "pedestal_down",
    "arc_shot",
    "tracking_shot",
    "roll_clockwise",
    "roll_counterclockwise",
}

MUSIC_TEXT = {
    "none": (
        "N/A"
    ),
    "sparse_piano_strings": (
        "Sparse piano notes at a slow tempo, joined by sustained low strings that remain restrained and fade gently near the end."
    ),
    "acoustic_guitar_bass": (
        "A soft acoustic-guitar pattern at a moderate tempo, supported by sparse upright-bass notes with even restrained dynamics and a gentle fade at the end."
    ),
    "classical_guitar": (
        "Fingerpicked nylon-string classical guitar at a relaxed slow-to-moderate tempo, using gentle arpeggios and light bass resonance with even dynamics that taper softly at the end."
    ),
    "soft_light_music": (
        "Soft electric piano and clean guitar at a relaxed medium tempo, supported by light brushed percussion and a simple steady bass line with even unobtrusive dynamics."
    ),
    "gentle_classical": (
        "A small string ensemble with soft piano at a slow tempo, using long legato phrases and restrained dynamics that settle into a gentle final cadence."
    ),
    "light_jazz": (
        "A light jazz ensemble with brushed drums, upright bass, and mellow piano at a relaxed medium tempo with even restrained dynamics, ending with a soft fade."
    ),
    "bossa_nova": (
        "Nylon-string guitar, soft upright bass, gentle hand percussion, and light piano play a relaxed syncopated bossa nova rhythm at a moderate tempo with even dynamics and a soft ending."
    ),
    "lyrical_harp_cello": (
        "Gentle concert harp arpeggios carry a lyrical melody at a slow tempo, joined by warm sustained cello phrases with soft legato movement, maintaining quiet even dynamics with no percussion or heavy bass and settling into a calm delicate ending."
    ),
    "korean_traditional_fusion": (
        "Gayageum plucks and daegeum bamboo-flute phrases lead a moderate pulse with light janggu percussion, warm bass, and restrained modern pads, maintaining even controlled dynamics while building gently before a clean finish."
    ),
    "vintage_pop": (
        "Clean electric guitar, warm electric piano, melodic bass, and light acoustic drums play a steady vintage pop groove at a moderate tempo with even controlled dynamics, ending with a short instrumental resolution."
    ),
    "modern_pop": (
        "Clean guitar, bright keyboard chords, melodic bass, and crisp drums form a polished mid-tempo pop groove with controlled drum transients and even overall dynamics, adding a small instrumental lift before a clean ending."
    ),
    "kpop_style": (
        "Crisp electronic drums, bright synth chords, melodic bass, and polished layered synth accents form a tight mid-to-fast pop rhythm with controlled transients and even overall dynamics, building briefly before a clean final hit."
    ),
    "kpop_dance": (
        "Punchy electronic drums, syncopated bass, bright synth hooks, and layered rhythmic accents drive a fast dance-pop beat with controlled transients and even overall dynamics, brief rises, and a strong clean ending."
    ),
    "fast_rap_beat": (
        "Fast hip-hop drums with tight hi-hat patterns, deep controlled bass, sparse keyboard stabs, and a rapid steady groove use sharp rhythmic accents with controlled transients and even overall dynamics, ending cleanly."
    ),
    "oldschool_hiphop": (
        "Dry kick and snare drums, a steady bass groove, and sparse electric-piano chords play at a moderate hip-hop tempo with consistent dynamics and a short final stop."
    ),
    "funk_groove": (
        "Syncopated electric bass, clean rhythm guitar, clavinet-like keys, and tight drums play a brisk repeating funk groove with crisp accented beats, controlled transients, and even overall dynamics before a clean finish."
    ),
    "rock_drive": (
        "Overdriven electric guitars, electric bass, and tight acoustic drums drive a brisk straight rock rhythm with steady momentum and controlled overall dynamics, followed by a short lift and a decisive ending."
    ),
    "ambient_synth": (
        "Sustained synthesizer pads at a slow tempo with a light repeating pulse, maintaining low dynamics and tapering off at the end."
    ),
    "dark_ambient": (
        "Dark ambient drones with low textures and subtle pulses at a very slow tempo, maintaining restrained dynamics and trailing off smoothly at the end."
    ),
    "electronic_pulse": (
        "A low electronic pulse at a slow tempo with sparse controlled sub-bass accents, maintaining even restrained dynamics and ending cleanly with the final visual beat."
    ),
    "upbeat_electronic": (
        "An upbeat electronic groove with crisp percussion, bright synth accents, and a clean pulse at a lively medium tempo, using controlled transients and even restrained dynamics, ending decisively with the final visual beat."
    ),
    "minimal_luxury_electronic": (
        "Clean plucked synth tones, restrained sub-bass, sparse electronic percussion, and airy textures form a precise moderate pulse with subtle rises while keeping overall dynamics even and restrained, ending cleanly."
    ),
    "tech_product_pulse": (
        "Crisp plucked synths, soft electronic pulses, restrained sub-bass, and precise percussion run at a medium-fast tempo with controlled transients and even restrained dynamics, building briefly before a sudden clean stop."
    ),
    "synthwave": (
        "Analog synth chords, pulsing bass, gated electronic drums, and a repeating arpeggiated synth line drive a steady mid-tempo rhythm with controlled bass and drum transients, even overall dynamics, and a gradual layered build."
    ),
    "dream_pop": (
        "Airy synthesizer pads, clean delayed guitar, soft electronic drums, and sustained bass move at a slow-to-moderate tempo with smooth gradual dynamic changes and a long fade."
    ),
    "cinematic_percussion": (
        "Restrained cinematic percussion with deep drums, light pulses, and gradual momentum at a moderate tempo, keeping drum transients controlled and overall dynamics even, resolving cleanly near the end."
    ),
    "orchestral_rise": (
        "Low strings begin softly at a moderate tempo, joined by restrained brass and percussion that increase gradually in density while maintaining controlled dynamics before a controlled final decay."
    ),
    "cheerful_march": (
        "Bright brass, snare drum, and light woodwinds play a steady marching rhythm at a brisk tempo, with clear accented beats, controlled transients, even dynamics, and consistent forward momentum."
    ),
    "grand_march": (
        "Low brass, full strings, and marching snare percussion move at a firm moderate tempo, gradually adding layers while maintaining controlled even dynamics toward a broad final cadence."
    ),
    "celestial_space": (
        "Wide sustained synthesizer pads, distant choir-like textures, soft bell tones, and a very slow floating pulse gradually expand in layers while maintaining low even dynamics before fading into a long spacious decay."
    ),
    "mystic_fantasy": (
        "Soft strings, harp arpeggios, celesta-like bells, and distant choir textures move at a slow tempo with restrained even dynamics, gradually adding layers before settling into a quiet sustained ending."
    ),
}



_EXPLICIT_SILENCE_RE = re.compile(
    r"\b(?:complete silence|completely silent|silent throughout|no sound at all|absolutely silent)\b|완전\s*무음|소리\s*(?:전혀\s*)?없음|아무\s*소리도\s*없",
    re.I,
)

# High-confidence sound cues only. English regexes use word boundaries to avoid
# false positives such as 'train' -> 'rain'. Korean patterns avoid bare '비'.
_CAFE_SOUND_CUE_RE = re.compile(r"\b(?:cafe|café|coffee shop)\b|카페|커피숍", re.I)

# The cafe ambience below is intentionally indoor-only. Suppress it only when
# the cafe itself is explicitly described as an outdoor venue. Do not infer
# outdoor-ness merely from generic scene words such as city, beach, or street;
# an indoor cafe can still overlook those places. Explicit indoor wording wins
# when both indoor and outdoor terms are present.
_OUTDOOR_CAFE_CONTEXT_RE = re.compile(
    r"(?:"
    r"\b(?:rooftop|outdoor|open[- ]air|sidewalk|street[- ]side|streetside|al\s+fresco)\b"
    r"(?:[\s-]+[A-Za-zÀ-ÖØ-öø-ÿ']+){0,3}[\s-]+\b(?:cafe|café|coffee shop)\b"
    r"|\b(?:cafe|café|coffee shop)(?:'s)?\b"
    r"(?:[\s-]+[A-Za-zÀ-ÖØ-öø-ÿ']+){0,3}[\s-]+\b(?:terrace|patio|deck|balcony|rooftop|"
    r"outdoor|open[- ]air|sidewalk|street[- ]side|streetside)\b"
    r"|(?:루프탑|옥상|야외|노천|테라스|파티오|야외석).{0,12}(?:카페|커피숍)"
    r"|(?:카페|커피숍).{0,12}(?:루프탑|옥상|야외|노천|테라스|파티오|야외석)"
    r")",
    re.I,
)
_INDOOR_CAFE_CONTEXT_RE = re.compile(
    r"(?:"
    r"\b(?:indoor|indoors|inside|interior)\b.{0,32}\b(?:cafe|café|coffee shop)\b"
    r"|\b(?:cafe|café|coffee shop)\b.{0,32}\b(?:indoor|indoors|inside|interior)\b"
    r"|(?:실내|내부).{0,16}(?:카페|커피숍)"
    r"|(?:카페|커피숍).{0,16}(?:실내|내부)"
    r")",
    re.I,
)


def _suppress_indoor_cafe_cue(text: str) -> bool:
    if not _OUTDOOR_CAFE_CONTEXT_RE.search(text):
        return False
    return _INDOOR_CAFE_CONTEXT_RE.search(text) is None


_SOUND_CUES = (
    # Specific physical/weather events first. The 1-4 sentence limit should
    # prefer synchronized action sounds over generic location ambience.
    (
        re.compile(r"\b(?:rain|raining|rainy|downpour)\b|비가\s*오|비\s*오는|빗소리|빗방울|장대비|우천", re.I),
        "Steady rain is audible on nearby surfaces, with water movement matching the visible weather.",
    ),
    (
        re.compile(r"\b(?:splashes|splashing|splashed)\b(?:.{0,25}\b(?:water|puddle|puddles|pool|stream)\b)?|(?:물|웅덩이).{0,12}(?:튀|첨벙)", re.I),
        "Water splashes briefly in sync with the visible contact and movement.",
    ),
    (
        re.compile(r"(?:\b(?:opens|opening|opened|unfolds|unfolding|unfolded|raises|raising|raised|closes|closing|closed|folds|folding|folded|open|close)\s+(?:the|a|an|his|her|their)\s+umbrella\b|\bumbrella\s+(?:(?:is|was)\s+)?(?:opens|opening|unfolds|unfolding|closes|closing|folds|folding)\b|우산(?:을|이|가)?\s*.{0,10}(?:펴|펼치|펼쳐|접|닫))", re.I),
        "The umbrella mechanism clicks and the canopy fabric snaps or rustles in sync with the visible opening or folding motion.",
    ),
    (
        re.compile(r"(?:\b(?:a|the)?\s*glass(?:\s+(?:pane|window))?\s+(?:(?:is|was)\s+)?(?:falls|falling|drops|dropping|breaks|breaking|shatters|shattering|smashes|smashing)\b|\b(?:breaks|breaking|shatters|shattering|smashes|smashing|drops|dropping)\s+(?:the|a)\s+glass\b|유리(?:가|를)?\s*.{0,12}(?:깨지|깨뜨|부서지|떨어지))", re.I),
        "Glass contact produces a sharp impact followed by brittle breaking and short sliding sounds that match the visible fragments.",
    ),
    (
        re.compile(r"(?:\b(?:folds|folding|folded|unfolds|unfolding|unfolded)\s+(?:the|a|his|her|their)\s+(?:paper|letter)\b|\b(?:turns|turning|turned)\s+(?:the|a)\s+page\b|\b(?:paper|letter)\s+(?:(?:is|was)\s+)?(?:folding|unfolding)\b|\bpage\s+(?:(?:is|was)\s+)?(?:turns|turning)\b|(?:편지|종이|페이지)(?:를|가|이)?\s*.{0,10}(?:접|펼|넘기))", re.I),
        "Paper rustles softly in sync with the visible folding, unfolding, or page-turning motion.",
    ),
    (
        re.compile(r"(?:\b(?:door|shutter|gate)\s+(?:(?:is|was)\s+)?(?:slowly\s+|quickly\s+|suddenly\s+|gradually\s+)?(?:opens|opening|closes|closing|swings|slides|slams|slamming)\b|\b(?:opens|opening|closes|closing|opened|closed|slams|slamming|slammed|open|close)\s+(?:the|a|his|her|their)\s+(?:door|shutter|gate)\b|(?:문을|셔터를).{0,12}(?:열|닫|올리|내리)|(?:문이|셔터가).{0,12}(?:열리|닫히))", re.I),
        "Hinges, latches, or sliding hardware make brief synchronized sounds as the visible door, shutter, or gate moves.",
    ),
    (
        re.compile(r"(?:\b(?:car|vehicle|motorcycle|motorbike)\s+(?:(?:is|was)\s+)?(?:slowly\s+|quickly\s+)?(?:drives|driving|moves|moving|rolls|rolling|accelerates|accelerating|brakes|braking|approaches|approaching|departs|departing)\b|\b(?:car|vehicle|motorcycle|motorbike)\s+passes\s+(?:by|past|through)\b|\b(?:drives|driving)\s+(?:the|a|his|her|their)\s+(?:car|vehicle|motorcycle|motorbike)\b|운전|주행|(?:자동차|차량|오토바이)(?:가|이|를)?\s*.{0,12}(?:움직|달리|지나가|출발|접근))", re.I),
        "Engine and road noise follow the visible vehicle motion with consistent distance and direction.",
    ),
    (
        re.compile(r"(?:\b(?:walks|walked|walking(?!\s+(?:stick|sticks|cane|canes|tour|tours|path|paths|trail|trails|shoe|shoes|boot|boots))|footsteps|jogs|jogged|jogging|sprints|sprinting|on foot)\b|\bruns(?=\s*(?:[,.!?]|$)|\s+(?:quickly|slowly|toward|towards|across|along|away|outside|inside|through|down|up|past|to|from)\b)|\brunning(?=\s*(?:[,.!?]|$)|\s+(?:quickly|slowly|toward|towards|across|along|away|outside|inside|through|down|up|past|to|from)\b)|걷(?:는다|고|는|다가|기|습니다)|걸어|걸으며|걸었다|산책|보행|달려|달린다|달리고|달리는|달렸다|뛴다|뛰는|뛰어|조깅)", re.I),
        "Footsteps remain synchronized with the subject's visible pace and contact with the ground.",
    ),
    (
        re.compile(r"(?:\b(?:train|subway|railcar|metro)\s+(?:(?:is|was)\s+)?(?:slowly\s+|quickly\s+)?(?:moves?|moving|arrives?|arriving|departs?|departing|passes?|passing|travels?|traveling|travelling|approaches?|approaching|leaves?)\b|\b(?:moving|arriving|departing|passing|approaching)\s+(?:train|subway|railcar|metro)\b|\b(?:train|subway)\s+pulls?\s+in\b|(?:기차|열차|전철|지하철)(?:가|이|은|는)?\s*.{0,12}(?:움직|달리|도착|출발|지나가|접근))", re.I),
        "Rail and carriage sounds follow the visible train movement, with low mechanical noise underneath.",
    ),
    (
        re.compile(r"\b(?:kitchen|cooking|cook|restaurant kitchen)\b|주방|요리|조리", re.I),
        "Utensil, cookware, and work-surface sounds remain synchronized with visible cooking or handling actions.",
    ),
    (
        re.compile(r"(?:\b(?:flame|flames|fireplace|campfire|bonfire)\b|\bfire\b.{0,30}\b(?:burns?|burning|blazes?|blazing|crackles?|flickers?)\b|모닥불|장작불|벽난로|불꽃)", re.I),
        "Fire crackles and shifts with small pops synchronized to the visible flames.",
    ),
    (
        re.compile(r"(?:\bwind\b(?!\s+(?:chime|chimes|turbine|turbines|instrument|instruments|up))|\b(?:windy|breeze|gusts?)\b|바람|강풍|산들바람)", re.I),
        "Wind moves through the environment with intensity matching the visible motion of hair, fabric, and surrounding objects.",
    ),
    # Generic location ambience comes last so it cannot displace more specific
    # synchronized action sounds when four cues are already available.
    (
        re.compile(r"\b(?:ocean|sea|beach|shore|coast|coastline|seaside)\b|바다|해변|해안|파도", re.I),
        "Coastal water movement creates a steady natural ambience around the visible scene.",
    ),
    (
        re.compile(r"\b(?:forest|woods|woodland)\b|숲|산림", re.I),
        "Low natural outdoor ambience continues around the visible forest environment.",
    ),
    (
        re.compile(r"\b(?:traffic|traffic jam)\b|교통|교통체증", re.I),
        "Distant engines, tire noise, and intermittent traffic movement form a low urban sound bed.",
    ),
    (
        re.compile(r"\b(?:street|city|urban alley|city alley)\b|거리|도시|골목", re.I),
        "Low urban ambience continues underneath the visible action.",
    ),
    (
        _CAFE_SOUND_CUE_RE,
        "Quiet indoor room tone continues with subtle interior sounds matching visible movement.",
    ),
    (
        re.compile(r"\b(?:bakery|pastry shop)\b|빵집|제과점|베이커리", re.I),
        "Quiet shop ambience continues with light counter, tray, packaging, and work-surface sounds when those actions are visible.",
    ),
    (
        re.compile(r"\b(?:street market|open-air market|bazaar|crowd|crowded)\b|재래시장|전통시장|야시장|군중|붐비는", re.I),
        "Low open-air public-space ambience continues around the visible market or gathering.",
    ),
)

_H3_RESERVED_INLINE_RE = re.compile(
    r"(?i)(?:integrated_multimodal_description|overall_soundscape|non_diegetic_music)\s*:|"
    r"<\/?(?:d|scenetrans|cutoff)(?:\s|>|$)|\[Shot\s+\d+\]"
)



def _clean_text(value: Any, *, max_chars: int, preserve_newlines: bool = True) -> str:
    if value is None:
        return ""
    text = str(value).replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    # Remove remaining C0 controls except tab/newline.
    text = "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32)
    if preserve_newlines:
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
        text = "\n".join(lines).strip()
    else:
        text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        raise _UserInputError(f"Input text is too long ({len(text)} characters; maximum is {max_chars}).")
    return text


def _clean_timeline_dialogue_verbatim(value: Any, *, max_chars: int) -> str:
    """Sanitize control bytes without rewriting user-authored dialogue.

    Timeline dialogue is source text, not descriptive prose.  Keep interior
    spacing and punctuation exactly as entered; only remove invalid control
    bytes, normalize platform line endings, and trim outer whitespace that the
    single-line Timeline widget cannot meaningfully express.
    """
    if value is None:
        return ""
    text = str(value).replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32).strip()
    if len(text) > max_chars:
        raise _UserInputError(f"Input text is too long ({len(text)} characters; maximum is {max_chars}).")
    return text


def _clean_scene_text(value: Any, *, max_chars: int) -> str:
    """Clean scene text without changing literal content inside double quotes."""
    if value is None:
        return ""
    text = str(value).replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32)
    if len(text) > max_chars:
        raise _UserInputError(f"Input text is too long ({len(text)} characters; maximum is {max_chars}).")
    # Outside quoted screen text, normalize layout whitespace just like ordinary
    # scene input. Inside quotes preserve spacing/punctuation literally.
    return _normalize_scene_whitespace_preserving_quotes(text, flatten_newlines=False)


def _count_h3_sentences(text: str) -> int:
    """Count prose sentences conservatively without splitting decimal numbers."""
    value = (text or "").strip()
    if not value or value.upper() == "N/A":
        return 0
    parts = [part.strip() for part in re.split(r"(?<=[.!?。！？])\s+", value) if part.strip()]
    return max(1, len(parts))


def _trim_user_sentences(text: str, max_sentences: int) -> Tuple[str, bool]:
    """Keep the first user-authored sentences when an H3 section has a hard budget."""
    value = str(text or "").strip()
    if not value or int(max_sentences) <= 0:
        return "", bool(value)
    parts = [part.strip() for part in re.split(r"(?<=[.!?。！？])\s+", value) if part.strip()]
    if len(parts) <= max_sentences:
        return value, False
    return " ".join(parts[:max_sentences]).strip(), True


def _enforce_h3_sentence_limit(text: str, field_name: str, max_sentences: int) -> str:
    value = (text or "").strip()
    if not value or value.upper() == "N/A":
        return value
    count = _count_h3_sentences(value)
    if count < 1 or count > max_sentences:
        raise _UserInputError(
            f"{field_name} must contain 1-{max_sentences} sentences for MiniMax H3; got {count}. "
            "Shorten the custom text instead of relying on automatic truncation."
        )
    return value


def _reject_reserved_timeline_structure(text: str, field_name: str) -> None:
    if not text:
        return
    if _H3_RESERVED_INLINE_RE.search(text):
        raise _UserInputError(
            f"{field_name} contains reserved H3 structure. Enter plain scene/action/dialogue text only; "
            "this node adds [Shot] and <d> dialogue markup automatically. <scenetrans>/<cutoff> are also "
            "reserved H3 continuity tags and are not accepted as literal user text."
        )


def _normalize_timeline_action(text: Any, field_name: str) -> Tuple[str, List[str]]:
    """Normalize a Timeline action without interpreting its vocabulary.

    User-authored natural language is preserved regardless of language. The
    compiler validates only structure/length here; it does not maintain an
    action-word whitelist and does not silently replace unknown actions.
    """
    clean = _clean_text(text, max_chars=4_000, preserve_newlines=False)
    _reject_reserved_timeline_structure(clean, field_name)
    if not clean:
        return "", []
    warnings: List[str] = []
    if _contains_non_english_body_script(clean):
        warnings.append(
            f"{field_name} contains non-English visual/action text; it was preserved exactly as entered. "
            "English is recommended for the most direct H3 body interpretation."
        )
    return _ensure_terminal_punctuation(clean), warnings


def _timeline_body_language_warnings(text: str, field_name: str) -> List[str]:
    if text and _contains_non_english_body_script(text):
        return [
            f"{field_name} contains non-English descriptive text; it was preserved exactly as entered. "
            "English is recommended for the most direct H3 body interpretation."
        ]
    return []


def _timeline_scene_language_warning(scene: str, translate_mode: str) -> List[str]:
    if not scene or not _contains_non_english_body_script(scene):
        return []
    if _contains_hangul(scene) and translate_mode == "off":
        return [
            "scene_prompt contains Korean while scene auto-translation is off; the original scene text was preserved unchanged. "
            "For the most direct H3 English body, enable Korean→English auto-translation or enter the scene in English. "
            "Timeline dialogue is never translated."
        ]
    return [
        "scene_prompt contains non-English visual text; the original scene text was preserved unchanged. "
        "English scene text is recommended for the most direct H3 body."
    ]

def _ensure_terminal_punctuation(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[-1] in ".!?。！？":
        return text
    return text + "."


def _contains_non_english_body_script(text: str) -> bool:
    # Warn for Hangul, CJK, Hiragana/Katakana, Cyrillic, or Arabic in body fields.
    return bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]", text))




def _format_custom_body_hint(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    return _ensure_terminal_punctuation(text)


def _detect_dialogue_language(text: str) -> str:
    if re.search(r"[\uac00-\ud7af]", text):
        return "Korean"
    if re.search(r"[\u3040-\u30ff]", text):
        return "Japanese"
    if re.search(r"[\u3400-\u9fff]", text):
        return "Chinese"
    if re.search(r"[\u0400-\u04ff]", text):
        return "Russian"
    if re.search(r"[\u0600-\u06ff]", text):
        return "Arabic"
    return "English"









def _mode_reference_contract_issue(mode: str, start_image: Any, end_image: Any) -> Optional[str]:
    """Return the first missing-reference issue for an explicit Main mode.

    Auto is the only topology-driven mode.  Explicit T2VA intentionally ignores
    connected image inputs.  Explicit image modes keep the user's selected mode
    and require only the reference image(s) that mode actually needs.
    """
    has_start = start_image is not None
    has_end = end_image is not None

    if mode == "i2va" and not has_start:
        return "i2va_missing_start"
    if mode == "l2va" and not has_end:
        return "l2va_missing_end"
    if mode == "fl2va":
        if not has_start and not has_end:
            return "fl2va_missing_both"
        if not has_start:
            return "fl2va_missing_start"
        if not has_end:
            return "fl2va_missing_end"
    return None


def _mode_reference_contract_message(issue: str, locale: str = "en") -> str:
    ko = str(locale or "en").lower().startswith("ko")
    messages = {
        "i2va_missing_start": (
            "I2VA 모드에는 시작 이미지가 필요합니다. 시작 이미지를 연결한 후 다시 실행해 주세요.",
            "I2VA requires a start image. Connect the start image and run again.",
        ),
        "l2va_missing_end": (
            "L2VA 모드에는 마지막 이미지가 필요합니다. 마지막 이미지를 연결한 후 다시 실행해 주세요.",
            "L2VA requires an end image. Connect the end image and run again.",
        ),
        "fl2va_missing_both": (
            "FL2VA 모드에는 시작 이미지와 마지막 이미지가 모두 필요합니다. 두 이미지를 연결한 후 다시 실행해 주세요.",
            "FL2VA requires both a start image and an end image. Connect both images and run again.",
        ),
        "fl2va_missing_start": (
            "FL2VA 모드에는 시작 이미지가 필요합니다. 시작 이미지를 연결한 후 다시 실행해 주세요.",
            "FL2VA requires a start image. Connect the start image and run again.",
        ),
        "fl2va_missing_end": (
            "FL2VA 모드에는 마지막 이미지가 필요합니다. 마지막 이미지를 연결한 후 다시 실행해 주세요.",
            "FL2VA requires an end image. Connect the end image and run again.",
        ),
    }
    pair = messages.get(issue)
    if pair is None:
        return "영상 입력 방식에 필요한 이미지를 연결한 후 다시 실행해 주세요." if ko else "Connect the image required by the selected H3 mode and run again."
    return pair[0] if ko else pair[1]


def _resolve_mode(mode: str, start_image: Any, end_image: Any) -> Tuple[str, List[str]]:
    """Resolve Main mode under the explicit-mode image contract.

    Auto follows the actual start/end connection topology.  Manual T2VA stays
    T2VA even when images are connected.  Manual I2VA/L2VA/FL2VA stay fixed and
    require their own reference image(s); irrelevant extra image connections are
    ignored by prompt-mode resolution rather than changing the selected mode.
    """
    warnings: List[str] = []
    has_start = start_image is not None
    has_end = end_image is not None

    if mode not in MODE_VALUES:
        raise _UserInputError(f"Unsupported mode: {mode}")

    if mode == "auto":
        if has_start and has_end:
            return "fl2va", warnings
        if has_start:
            return "i2va", warnings
        if has_end:
            return "l2va", warnings
        return "t2va", warnings

    issue = _mode_reference_contract_issue(mode, start_image, end_image)
    if issue is not None:
        raise _UserInputError(_mode_reference_contract_message(issue, "en"))

    return mode, warnings












def _style_sentence(style: str, mode: str, text: str) -> str:
    if style not in STYLE_VALUES:
        raise _UserInputError(f"Unsupported visual_style: {style}")
    if style != "auto":
        base = STYLE_TEXT[style]
        if mode == "i2va":
            return base + " Preserve the key visual cues established by <Picture 1> while applying this selected target style treatment."
        if mode == "fl2va":
            return base + " Begin with the visual treatment established by Picture 1 and evolve continuously toward the visual treatment established by Picture 2."
        if mode == "l2va":
            return base + " Let the video converge toward the final visual treatment established by <Picture 1>."
        return base

    # H3 says keyframe tasks should derive their style from the reference image.
    # This rule-only node cannot inspect pixels, so it emits a neutral style
    # anchor instead of inventing a specific visual medium.
    if mode == "i2va":
        return "Preserve the visual style established by <Picture 1>."
    if mode == "fl2va":
        return "Begin with the visual treatment established by Picture 1 and evolve continuously toward the visual treatment established by Picture 2."
    if mode == "l2va":
        return "Preserve the visual treatment established by <Picture 1> as the video converges toward the final frame."

    # For T2VA auto, do not guess a style the user did not specify. Any explicit
    # style wording in scene_prompt remains authoritative user text.
    return ""


def _style_conflict_warnings(style: str, text: str) -> List[str]:
    if style == "auto" or not text:
        return []
    selected_family = (
        "live_action" if style in {"live_action_cinematic", "natural"}
        else "2d_animated" if style == "japanese_anime"
        else style
    )
    if selected_family not in _STYLE_MEDIA_PATTERNS:
        return []
    conflicts = []
    for family, pattern in _STYLE_MEDIA_PATTERNS.items():
        if family == selected_family:
            continue
        if pattern.search(text):
            conflicts.append(family)
    if not conflicts:
        return []
    labels = ", ".join(conflicts)
    return [
        f"scene_prompt contains an explicit media-style phrase ({labels}) that may conflict with visual_style={style}. "
        "The selected visual style is placed first in Shot 1, but contradictory scene wording is preserved rather than silently deleted."
    ]


def _sound_hint_semantic_warnings(custom_hint: str) -> List[str]:
    warnings: List[str] = []
    if not custom_hint:
        return warnings
    if _SOUND_HINT_DIALOGUE_RE.search(custom_hint):
        warnings.append(
            "sound_hint appears to contain spoken dialogue/voiceover content. MiniMax H3 keeps spoken content in integrated_multimodal_description, not overall_soundscape."
        )
    if _SOUND_HINT_MUSIC_RE.search(custom_hint):
        warnings.append(
            "sound_hint appears to describe music. MiniMax H3 keeps diegetic music in integrated_multimodal_description and audience-only background music in non_diegetic_music."
        )
    return warnings


def _music_hint_semantic_warnings(custom_hint: str) -> List[str]:
    warnings: List[str] = []
    if not custom_hint:
        return warnings
    if _MUSIC_ABSTRACT_MOOD_RE.search(custom_hint):
        warnings.append(
            "music_hint uses abstract mood/emotional-function wording. MiniMax H3 recommends instrumentation, tempo/speed, rhythm, and dynamic changes instead."
        )
    if _MUSIC_DIEGETIC_RE.search(custom_hint):
        warnings.append(
            "music_hint appears to describe music audible inside the scene. MiniMax H3 treats diegetic music as part of integrated_multimodal_description, not non_diegetic_music."
        )
    return warnings


def _reference_sentence(mode: str, fidelity: str, *, action_requested: bool = True) -> str:
    if fidelity not in REFERENCE_FIDELITY_VALUES:
        raise _UserInputError(f"Unsupported reference_fidelity: {fidelity}")
    if mode == "t2va":
        return ""

    if mode == "i2va":
        if not action_requested:
            if fidelity == "strict":
                return "The visible subject and scene shown in <Picture 1> stay closely consistent with the reference image throughout the shot."
            if fidelity == "balanced":
                return "The visible subject and scene shown in <Picture 1> remain consistent with the reference image throughout the shot."
            return "The visible subject and scene remain recognizable from <Picture 1> while allowing natural motion and reframing."
        if fidelity == "strict":
            return "The visible subject and scene shown in <Picture 1> stay closely consistent with the reference image while the requested action develops."
        if fidelity == "balanced":
            return "The visible subject and scene shown in <Picture 1> remain consistent with the reference image while the requested action develops."
        return "The visible subject and scene stay recognizable from <Picture 1> while allowing broader motion and reframing."

    if mode == "fl2va":
        if fidelity == "strict":
            return "Begin from Picture 1 and move continuously so the final shot lands closely on Picture 2 while preserving clear visual continuity."
        if fidelity == "balanced":
            return "Begin from Picture 1 and move continuously toward Picture 2, preserving clear subject continuity while allowing the scene, pose, composition, or lighting changes needed to reach the final reference."
        return "Begin from Picture 1 and move broadly but continuously toward Picture 2, allowing stronger scene, pose, composition, or lighting changes while keeping recognizable visual continuity."

    if mode == "l2va":
        if fidelity == "strict":
            return "Move continuously toward the final state established by <Picture 1>, keeping the visible subject and scene closely consistent at the end."
        if fidelity == "balanced":
            return "Move naturally toward the final state established by <Picture 1>, preserving clear visual continuity while allowing the changes needed before the final convergence."
        return "Move broadly but continuously toward the final state established by <Picture 1>, allowing stronger intermediate changes while keeping recognizable continuity before the final convergence."
    raise AssertionError("unreachable")


def _camera_sentence(camera: str, amplitude: str, speed: str) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    if camera not in CAMERA_VALUES:
        raise _UserInputError(f"Unsupported camera_motion: {camera}")
    if amplitude not in CAMERA_AMPLITUDE_VALUES:
        raise _UserInputError(f"Unsupported camera_amplitude: {amplitude}")
    if speed not in CAMERA_SPEED_VALUES:
        raise _UserInputError(f"Unsupported camera_speed: {speed}")
    if camera == "auto":
        if amplitude != "default" or speed != "default":
            warnings.append("camera_amplitude/camera_speed were ignored because camera_motion is not selected.")
        return "", warnings

    base = CAMERA_SENTENCES[camera]
    if camera not in _CAMERA_MODIFIER_COMPATIBLE:
        if amplitude != "default" or speed != "default":
            warnings.append(f"Camera amplitude/speed modifiers do not apply cleanly to '{camera}' and were ignored.")
        return base + ".", warnings

    modifiers: List[str] = []
    if amplitude == "small":
        modifiers.append("with small amplitude")
    elif amplitude == "large":
        modifiers.append("with large amplitude")
    if speed == "slow":
        modifiers.append("at slow speed")
    elif speed == "fast":
        modifiers.append("at fast speed")
    return base + ((" " + " ".join(modifiers)) if modifiers else "") + ".", warnings



def _allowed_camera_targets(person_count: int) -> Tuple[str, ...]:
    if person_count <= 1:
        return ("current_action", "A", "scene")
    if person_count == 2:
        return ("current_action", "A", "B", "A+B", "scene")
    return CAMERA_TARGET_VALUES


def _camera_target_slots(target: str) -> Tuple[str, ...]:
    if target in {"current_action", "scene"}:
        return ()
    return tuple(part for part in str(target).split("+") if part in {"A", "B", "C"})


def _allowed_camera_framings_for_target(target: str) -> Tuple[str, ...]:
    if target == "current_action":
        return ("auto",)
    if target == "scene":
        return ("auto", "wide_scene")
    slots = _camera_target_slots(target)
    if len(slots) >= 2:
        return ("auto", "head_and_shoulders", "upper_body", "waist_up", "knee_up", "full_body", "wide_scene")
    return CAMERA_FRAMING_VALUES


def _single_shot_framing_sentence(framing: str) -> str:
    framing = _canonical_choice(framing, CAMERA_FRAMING_VALUES, "camera_framing")
    return {
        "auto": "",
        "face_closeup": "Use a close-up framing on the primary visible face when a clear subject is present.",
        "head_and_shoulders": "Use a head-and-shoulders framing on the primary visible subject when a clear subject is present.",
        "upper_body": "Use an upper-body framing on the primary visible subject when a clear subject is present.",
        "waist_up": "Use a waist-up framing on the primary visible subject when a clear subject is present.",
        "knee_up": "Use a knee-up framing on the primary visible subject when a clear subject is present.",
        "full_body": "Use a full-body framing on the primary visible subject when a clear subject is present.",
        "wide_scene": "Use a wide establishing framing that keeps the surrounding scene clearly visible.",
    }[framing]


def _camera_target_opening_sentence(target: str, framing: str = "auto") -> str:
    framing = _canonical_choice(framing, CAMERA_FRAMING_VALUES, "camera_framing")
    if target == "current_action":
        return "The opening shot follows the current action and composition."
    if target == "scene":
        if framing == "wide_scene":
            return "The opening shot establishes the full scene and all visible subjects in a wide establishing shot."
        return "The opening shot establishes the full scene and all visible subjects."
    slots = _camera_target_slots(target)
    if len(slots) == 1:
        subject = f"Person {slots[0]}"
        return {
            "auto": f"The opening shot centers {subject}, with framing chosen automatically to suit the opening action.",
            "face_closeup": f"The opening shot frames {subject} in a close-up of the face.",
            "head_and_shoulders": f"The opening shot frames {subject} in a head-and-shoulders shot.",
            "upper_body": f"The opening shot frames {subject} in an upper-body shot.",
            "waist_up": f"The opening shot frames {subject} in a waist-up shot.",
            "knee_up": f"The opening shot frames {subject} in a knee-up shot.",
            "full_body": f"The opening shot frames {subject} in a full-body shot.",
            "wide_scene": f"The opening shot frames {subject} in a wide shot that keeps the surrounding scene visible.",
        }[framing]
    names = " and ".join(f"Person {slot}" for slot in slots)
    return {
        "auto": f"The opening shot frames {names} together.",
        "head_and_shoulders": f"The opening shot frames {names} together in a head-and-shoulders shot.",
        "upper_body": f"The opening shot frames {names} together in an upper-body shot.",
        "waist_up": f"The opening shot frames {names} together in a waist-up shot.",
        "knee_up": f"The opening shot frames {names} together in a knee-up shot.",
        "full_body": f"The opening shot frames {names} together in a full-body shot.",
        "wide_scene": f"The opening shot frames {names} together in a wide shot that keeps the surrounding scene visible.",
    }.get(framing, f"The opening shot frames {names} together.")


def _camera_target_transition_clause(target: str, transition: str = "cut", framing: str = "auto") -> str:
    transition = _canonical_choice(transition, CAMERA_TRANSITION_VALUES, "camera_transition")
    framing = _canonical_choice(framing, CAMERA_FRAMING_VALUES, "camera_framing")
    if transition == "cut":
        if target == "current_action":
            return "the camera cuts to a new view following the current action."
        if target == "scene":
            if framing == "wide_scene":
                return "the camera cuts to a wide establishing view of the full scene and all visible subjects."
            return "the camera cuts to a wider view of the full scene and all visible subjects."
        slots = _camera_target_slots(target)
        if len(slots) == 1:
            subject = f"Person {slots[0]}"
            return {
                "auto": f"the camera cuts to an automatically composed shot centered on {subject}, with framing chosen to suit the current action.",
                "face_closeup": f"the camera cuts to a close-up of {subject}'s face.",
                "head_and_shoulders": f"the camera cuts to a head-and-shoulders shot of {subject}.",
                "upper_body": f"the camera cuts to an upper-body shot of {subject}.",
                "waist_up": f"the camera cuts to a waist-up shot of {subject}.",
                "knee_up": f"the camera cuts to a knee-up shot of {subject}.",
                "full_body": f"the camera cuts to a full-body shot of {subject}.",
                "wide_scene": f"the camera cuts to a wide shot of {subject} within the surrounding scene.",
            }[framing]
        names = " and ".join(f"Person {slot}" for slot in slots)
        return {
            "auto": f"the camera cuts to frame {names} together.",
            "head_and_shoulders": f"the camera cuts to a head-and-shoulders shot of {names} together.",
            "upper_body": f"the camera cuts to an upper-body shot of {names} together.",
            "waist_up": f"the camera cuts to a waist-up shot of {names} together.",
            "knee_up": f"the camera cuts to a knee-up shot of {names} together.",
            "full_body": f"the camera cuts to a full-body shot of {names} together.",
            "wide_scene": f"the camera cuts to a wide shot of {names} together within the surrounding scene.",
        }.get(framing, f"the camera cuts to frame {names} together.")

    if target == "current_action":
        destination = "a new view following the current action"
    elif target == "scene":
        destination = "a wide establishing view of the full scene and all visible subjects" if framing == "wide_scene" else "a wider view of the full scene and all visible subjects"
    else:
        slots = _camera_target_slots(target)
        if len(slots) == 1:
            subject = f"Person {slots[0]}"
            destination = {
                "auto": f"an automatically composed view centered on {subject}, with framing chosen to suit the current action",
                "face_closeup": f"a close-up of {subject}'s face",
                "head_and_shoulders": f"a head-and-shoulders shot of {subject}",
                "upper_body": f"an upper-body shot of {subject}",
                "waist_up": f"a waist-up shot of {subject}",
                "knee_up": f"a knee-up shot of {subject}",
                "full_body": f"a full-body shot of {subject}",
                "wide_scene": f"a wide shot of {subject} within the surrounding scene",
            }[framing]
        else:
            names = " and ".join(f"Person {slot}" for slot in slots)
            destination = {
                "auto": f"a view framing {names} together",
                "head_and_shoulders": f"a head-and-shoulders shot of {names} together",
                "upper_body": f"an upper-body shot of {names} together",
                "waist_up": f"a waist-up shot of {names} together",
                "knee_up": f"a knee-up shot of {names} together",
                "full_body": f"a full-body shot of {names} together",
                "wide_scene": f"a wide shot of {names} together within the surrounding scene",
            }.get(framing, f"a view framing {names} together")

    if transition == "cross_dissolve":
        return f"the shot cross-dissolves to {destination}."
    if transition == "fade":
        return f"the shot fades into {destination}."
    if transition == "wipe":
        return f"a wipe transition reveals {destination}."
    raise AssertionError("unreachable")


def _format_h3_shot_timestamp(seconds: float) -> str:
    millis_total = int(round(float(seconds) * 1000.0))
    minutes, millis_rem = divmod(millis_total, 60_000)
    whole_seconds, millis = divmod(millis_rem, 1000)
    return f"{minutes:02d}:{whole_seconds:02d}.{millis:03d}"


def _repair_camera_start_times(
    raw_times: Sequence[Any],
    duration_seconds: float,
    warnings: Optional[List[str]] = None,
    label_prefix: str = "Camera Shot",
) -> List[float]:
    """Repair finite/grid/order/range mistakes in extra Shot start times.

    Shot rows are ordinary user controls, so a stale value after changing the
    duration or shot count should not abort the whole node.  Preserve the number
    of requested shots and choose the nearest deterministic 0.5-second schedule.
    """
    warnings = warnings if warnings is not None else []
    count = len(list(raw_times or []))
    if count <= 0:
        return []
    max_start = max(0.5, float(duration_seconds) - 0.5)
    repaired: List[float] = []
    for pos, raw in enumerate(list(raw_times), start=1):
        shot = pos + 1
        try:
            value = float(raw)
        except (TypeError, ValueError):
            value = float("nan")
        min_allowed = 0.5 if not repaired else repaired[-1] + 0.5
        remaining = count - pos
        max_allowed = max_start - 0.5 * remaining
        # duration_seconds is currently >=4 and at most five extra shots are
        # exposed, so this should not happen through the UI.  Keep a deterministic
        # fallback for malformed direct API calls rather than emitting NaN.
        if max_allowed < min_allowed:
            max_allowed = min_allowed
        if not math.isfinite(value):
            candidate = min_allowed
        else:
            candidate = _snap_half_second(value)
            candidate = min(max(candidate, min_allowed), max_allowed)
        candidate = _snap_half_second(candidate)
        if (not math.isfinite(value)) or abs(candidate - value) > 1e-9:
            shown = repr(raw) if not math.isfinite(value) else f"{value:.3f}s"
            warnings.append(
                f"{label_prefix} {shot} start time {shown} was invalid, out of order, or off the 0.5-second grid; "
                f"it was repaired to {candidate:.1f}s."
            )
        repaired.append(candidate)
    return repaired


def _normalize_camera_sequence(
    enabled: bool,
    shot_count: int,
    first_target: str,
    first_framing: str,
    first_motion: str,
    first_amplitude: str,
    first_speed: str,
    extra_shots: Sequence[dict],
    person_count: int,
    duration_seconds: float,
    warnings: Optional[List[str]] = None,
) -> List[dict]:
    if not enabled:
        return []
    warnings = warnings if warnings is not None else []
    shot_count = _validate_int_field(shot_count, "camera_shot_count", 2, MAX_CAMERA_SHOTS)

    allowed_targets = set(_allowed_camera_targets(person_count))
    first_target = _canonical_choice(first_target, CAMERA_TARGET_VALUES, "camera_target")
    if first_target not in allowed_targets:
        original_target = first_target
        first_target = "current_action" if "current_action" in allowed_targets else sorted(allowed_targets)[0]
        warnings.append(
            f"Camera Shot 1 target {original_target!r} is unavailable for person_count={person_count}; it was repaired to {first_target!r}."
        )
    first_framing = _canonical_choice(first_framing, CAMERA_FRAMING_VALUES, "camera_framing")
    allowed_first_framings = set(_allowed_camera_framings_for_target(first_target))
    if first_framing not in allowed_first_framings:
        original_framing = first_framing
        first_framing = "auto" if "auto" in allowed_first_framings else sorted(allowed_first_framings)[0]
        warnings.append(
            f"Camera Shot 1 framing {original_framing!r} is unavailable for target={first_target}; it was repaired to {first_framing!r}."
        )
    first_motion = _canonical_choice(first_motion, CAMERA_VALUES, "camera_motion")
    first_amplitude = _canonical_choice(first_amplitude, CAMERA_AMPLITUDE_VALUES, "camera_amplitude")
    first_speed = _canonical_choice(first_speed, CAMERA_SPEED_VALUES, "camera_speed")
    normalized = [{
        "index": 1, "start": 0.0, "target": first_target, "framing": first_framing,
        "motion": first_motion, "amplitude": first_amplitude, "speed": first_speed, "transition": "cut",
    }]

    requested = list(extra_shots or [])[: shot_count - 1]
    if len(requested) != shot_count - 1:
        raise _UserInputError("Camera sequence data does not match camera_shot_count. Re-select the shot count so the visible Shot rows match the requested number of shots.")
    repaired_starts = _repair_camera_start_times(
        [raw.get("start", 0.5 * offset) for offset, raw in enumerate(requested, start=1)],
        duration_seconds, warnings=warnings, label_prefix="Camera Shot",
    )
    for offset, (raw, start_time) in enumerate(zip(requested, repaired_starts), start=2):
        target = _canonical_choice(raw.get("target", "current_action"), CAMERA_TARGET_VALUES, "camera_target")
        if target not in allowed_targets:
            original_target = target
            target = "current_action" if "current_action" in allowed_targets else sorted(allowed_targets)[0]
            warnings.append(
                f"Camera Shot {offset} target {original_target!r} is unavailable for person_count={person_count}; it was repaired to {target!r}."
            )
        motion = _canonical_choice(raw.get("motion", "auto"), CAMERA_VALUES, "camera_motion")
        raw_amplitude = _canonical_choice(raw.get("amplitude", "inherit"), CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude")
        raw_speed = _canonical_choice(raw.get("speed", "inherit"), CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed")
        amplitude = first_amplitude if raw_amplitude == "inherit" else raw_amplitude
        speed = first_speed if raw_speed == "inherit" else raw_speed
        framing = _canonical_choice(raw.get("framing", "auto"), CAMERA_FRAMING_VALUES, "camera_framing")
        allowed_framings = set(_allowed_camera_framings_for_target(target))
        if framing not in allowed_framings:
            original_framing = framing
            framing = "auto" if "auto" in allowed_framings else sorted(allowed_framings)[0]
            warnings.append(
                f"Camera Shot {offset} framing {original_framing!r} is unavailable for target={target}; it was repaired to {framing!r}."
            )
        transition = _canonical_choice(raw.get("transition", "cut"), CAMERA_TRANSITION_VALUES, "camera_transition")
        normalized.append({
            "index": offset, "start": start_time, "target": target, "framing": framing,
            "motion": motion, "amplitude": amplitude, "speed": speed, "transition": transition,
        })
    return normalized



def _camera_sequence_from_kwargs(
    kwargs: dict,
    duration_seconds: float,
    warnings: Optional[List[str]] = None,
) -> Tuple[int, List[dict]]:
    """Derive active Shot 2-6 settings and softly repair their start times.

    Shot 1 always begins at 0s.  Extra shots remain contiguous; changing video
    duration or enabled-shot count cannot leave an old finite/NaN time that
    blocks the entire prompt.
    """
    if not _validate_bool_field(kwargs.get("camera_sequence_enabled", False), "camera_sequence_enabled"):
        return 1, []
    warnings = warnings if warnings is not None else []
    raws: List[dict] = []
    first_disabled_shot: Optional[int] = None
    for shot in range(2, MAX_CAMERA_SHOTS + 1):
        default_enabled = (shot == 2)
        if not _validate_bool_field(kwargs.get(f"camera_shot_{shot}_enabled", default_enabled), f"camera_shot_{shot}_enabled"):
            first_disabled_shot = shot
            break
        raws.append({
            "raw_start": kwargs.get(f"camera_shot_{shot}_start_seconds", 0.5 * (shot - 1)),
            "transition": kwargs.get(f"camera_shot_{shot}_transition", "cut"),
            "target": kwargs.get(f"camera_shot_{shot}_target", "current_action"),
            "framing": kwargs.get(f"camera_shot_{shot}_framing", "auto"),
            "motion": kwargs.get(f"camera_shot_{shot}_motion", "auto"),
            "amplitude": kwargs.get(f"camera_shot_{shot}_amplitude", "inherit"),
            "speed": kwargs.get(f"camera_shot_{shot}_speed", "inherit"),
        })
    if first_disabled_shot is not None:
        for later_shot in range(first_disabled_shot + 1, MAX_CAMERA_SHOTS + 1):
            later_value = kwargs.get(f"camera_shot_{later_shot}_enabled", False)
            later_enabled = (
                later_value is True
                or (isinstance(later_value, (int, float)) and not isinstance(later_value, bool) and later_value == 1)
                or (isinstance(later_value, str) and later_value.strip().lower() in {"true", "1"})
            )
            if later_enabled:
                warnings.append(
                    f"Camera Shot {later_shot} was ignored because Camera Shot {first_disabled_shot} is disabled; "
                    "camera shots must be enabled contiguously without gaps."
                )
                break
    repaired_starts = _repair_camera_start_times(
        [row["raw_start"] for row in raws], duration_seconds, warnings=warnings, label_prefix="Camera Shot"
    )
    specs: List[dict] = []
    for row, start_time in zip(raws, repaired_starts):
        specs.append({
            "start": start_time,
            "transition": row["transition"],
            "target": row["target"],
            "framing": row["framing"],
            "motion": row["motion"],
            "amplitude": row["amplitude"],
            "speed": row["speed"],
        })
    return 1 + len(specs), specs


def _temporal_visual_density_warnings(turns: Sequence[dict], camera_sequence: Sequence[dict], duration_seconds: float) -> List[str]:
    duration = max(0.5, float(duration_seconds))
    location_times: List[float] = []
    weather_times: List[float] = []
    visual_transition_times = set()
    for turn in turns or ():
        elapsed = float(turn.get("elapsed_seconds", 0.0))
        if elapsed <= 1e-9:
            continue
        raw_location = str(turn.get("scene_location_override", TURN_SCENE_KEEP) or TURN_SCENE_KEEP)
        raw_weather = str(turn.get("scene_weather_override", TURN_SCENE_KEEP) or TURN_SCENE_KEEP)
        env_sentence = str(turn.get("environment_change_sentence", "") or "")
        # Count only effective changes that actually emitted a new setting/weather.
        if raw_location != TURN_SCENE_KEEP and "setting" in env_sentence.lower():
            location_times.append(elapsed)
            visual_transition_times.add(round(elapsed, 3))
        if raw_weather != TURN_SCENE_KEEP and "weather" in env_sentence.lower():
            weather_times.append(elapsed)
            visual_transition_times.add(round(elapsed, 3))
    cut_times = [float(shot.get("start", 0.0)) for shot in (camera_sequence or [])[1:] if float(shot.get("start", 0.0)) > 1e-9]
    for value in cut_times:
        visual_transition_times.add(round(value, 3))

    warnings: List[str] = []
    # A full setting replacement inside one continuous Shot can be interpreted as
    # a morph/time-compressed background transition even when it happens only once.
    unaligned_location_times = [
        value for value in location_times
        if not any(abs(value - cut) <= 0.11 for cut in cut_times)
    ]
    if unaligned_location_times:
        preview = ", ".join(f"{value:.1f}s" for value in unaligned_location_times[:3])
        warnings.append(
            f"Setting-transition warning: major setting change(s) at {preview} do not coincide with a camera cut. "
            "MiniMax H3 may interpret a full location replacement inside one continuous shot as a background morph or time-compressed transition; align major location replacements with a Shot cut when an actual scene cut is intended."
        )
    if duration <= 8.0 and len(location_times) >= 2:
        warnings.append(
            f"Temporal density warning: {len(location_times)} setting changes occur within a {duration:.0f}s video. "
            "MiniMax H3 may compress the background into rapid or time-lapse-like transitions; consider fewer setting changes or align major location changes with camera cuts."
        )
    elif len(visual_transition_times) >= 4:
        ordered = sorted(visual_transition_times)
        span = max(0.5, ordered[-1] - ordered[0]) if len(ordered) > 1 else duration
        average_spacing = span / max(1, len(ordered) - 1)
        if average_spacing < 3.0:
            warnings.append(
                f"Temporal density warning: {len(visual_transition_times)} major visual transition times (setting/weather/cuts) are spaced about {average_spacing:.1f}s apart on average within a {duration:.0f}s video. "
                "If the generated video feels rushed, reduce simultaneous environment changes or increase spacing between major events."
            )
    return warnings


_BODY_SCALE_APPEARANCE_DESC_PATTERNS = (
    re.compile(r"\b(?:average|slim|petite|diminutive|athletic|lean|muscular|solid|curvy|hourglass|full(?:-figured)?|tall(?:\s+and\s+slim)?|short)\s+(?:build|figure|physique|body|stature)\b", re.I),
    re.compile(r"\b(?:long|short|slender|muscular)\s+legs?\b", re.I),
    re.compile(r"\b(?:broad|wide|narrow|sloping)\s+shoulders?\b", re.I),
    re.compile(r"\b(?:narrow|slim|small|defined)\s+waist\b", re.I),
    re.compile(r"\b(?:body\s+(?:shape|proportions?|silhouette)|overall\s+(?:build|physique|figure|stature)|full[- ]body\s+(?:build|proportions?))\b", re.I),
    re.compile(r"(?:체형|몸매|전신\s*실루엣|신체\s*비율|전체\s*체격|근육질\s*체형|운동형\s*체형|마른\s*체형|슬림한\s*체형|굴곡진\s*체형|긴\s*다리|짧은\s*다리|넓은\s*어깨|좁은\s*허리|장신\s*체형|단신\s*체형)"),
)


def _appearance_desc_has_body_scale_detail(value: Any) -> bool:
    """Return True only for high-confidence body-scale details hidden by face-only framing.

    ``appearance_desc`` also legitimately stores close-up-visible traits such as
    hair, eyes, freckles and jawline.  Do not warn merely because the field is
    non-empty; restrict detection to explicit build/proportion language.
    """
    text = str(value or "").strip()
    return bool(text) and any(pattern.search(text) for pattern in _BODY_SCALE_APPEARANCE_DESC_PATTERNS)


def _camera_semantic_compatibility_warnings(
    turns: Sequence[dict],
    camera_sequence: Sequence[dict],
    *,
    single_target: str,
    single_framing: str,
    profiles: dict,
    active_person_slots: Sequence[str],
) -> List[str]:
    """Warn when valid controls request visuals that cannot all be legible at once."""
    warnings: List[str] = []
    if camera_sequence:
        shots = [dict(shot) for shot in camera_sequence]
    else:
        shots = [{"index": 1, "start": 0.0, "target": single_target, "framing": single_framing}]
    cut_times = [float(shot.get("start", 0.0)) for shot in shots[1:]]

    def shot_for_time(elapsed: float) -> dict:
        index = 0
        for i, cut in enumerate(cut_times, start=1):
            if elapsed + 1e-9 >= cut:
                index = i
            else:
                break
        return shots[index]

    tight = {"face_closeup", "head_and_shoulders", "upper_body", "waist_up"}
    face_detail_presets = {"soft_round_features", "defined_jawline", "freckles", "light_stubble", "full_beard"}
    body_detail_presets = {
        "average_build", "slim_build", "petite_build", "diminutive_build", "athletic_build", "lean_muscular_build",
        "muscular_build", "solid_build", "curvy_build", "hourglass_figure", "full_figure", "tall_slim_build",
        "tall_build", "short_stature", "long_legs", "broad_shoulders", "full_bust", "small_bust",
    }

    for turn in turns or ():
        elapsed = float(turn.get("elapsed_seconds", 0.0))
        shot = shot_for_time(elapsed)
        target = str(shot.get("target", "current_action") or "current_action")
        target_slots = set(_camera_target_slots(target))
        if not target_slots:
            continue
        if not _turn_uses_sequential_renderer(turn):
            if not str(turn.get("dialogue_text", "") or "").strip() or turn.get("dialogue_delivery") != "on_screen":
                continue
            speaker_slots = set(_speaker_slots(turn.get("speaker", "A")))
            if target_slots.isdisjoint(speaker_slots):
                framing = str(shot.get("framing", "auto") or "auto")
                severity = " especially with the selected tight framing" if framing in tight else ""
                warnings.append(
                    f"Camera/dialogue visibility warning: the Shot active at {elapsed:.2f}s targets {target}, but on-screen dialogue is assigned to {turn.get('speaker', 'A')}{severity}. "
                    "A visibly lip-synchronized speaker must remain in frame; change the Shot target/framing or use voiceover if the speaker is intentionally off camera."
                )
            continue
        for vocal in _turn_vocal_events(turn):
            if str(vocal.get("delivery", "on_screen") or "on_screen") != "on_screen":
                continue
            speaker = str(vocal.get("speaker", "") or "")
            if speaker == "Narrator":
                continue
            speaker_slots = set(_vocal_source_slots(speaker))
            if target_slots.isdisjoint(speaker_slots):
                framing = str(shot.get("framing", "auto") or "auto")
                severity = " especially with the selected tight framing" if framing in tight else ""
                slot_index = int(vocal.get("slot_index", 1) or 1)
                warnings.append(
                    f"Camera/dialogue visibility warning: the Shot active at {elapsed:.2f}s targets {target}, but Vocal {slot_index} on-screen dialogue is assigned to {speaker}{severity}. "
                    "A visibly lip-synchronized speaker must remain in frame; change the Shot target/framing or use voiceover if the speaker is intentionally off camera."
                )

    for shot in shots:
        target = str(shot.get("target", "current_action") or "current_action")
        framing = str(shot.get("framing", "auto") or "auto")
        slots = _camera_target_slots(target)
        if target == "current_action" and framing == "face_closeup":
            if any(
                str((profiles.get(slot, {}) or {}).get("appearance_preset", "none") or "none") in body_detail_presets
                or _appearance_desc_has_body_scale_detail((profiles.get(slot, {}) or {}).get("appearance_desc", ""))
                or str((profiles.get(slot, {}) or {}).get("clothing_preset", "none") or "none") != "none"
                or bool(str((profiles.get(slot, {}) or {}).get("clothing_desc", "") or "").strip())
                for slot in active_person_slots
            ):
                warnings.append(
                    f"Framing visibility warning: Shot {shot.get('index', 1)} follows the current action in a face close-up while body/wardrobe settings are selected. "
                    "Those settings remain in the prompt but cannot all be visually verified in a face-only composition; use a wider framing when body or full wardrobe visibility matters."
                )
        if target == "current_action" and framing == "wide_scene":
            if any(
                str((profiles.get(slot, {}) or {}).get("appearance_preset", "none") or "none") in face_detail_presets
                or str((profiles.get(slot, {}) or {}).get("extension_ethnic_appearance", "none") or "none") != "none"
                for slot in active_person_slots
            ):
                warnings.append(
                    f"Framing visibility warning: Shot {shot.get('index', 1)} follows the current action in a wide scene while fine facial or ethnic-appearance details are selected. "
                    "Those traits remain in the prompt but may be visually small; include a closer Shot when facial detail must be clearly verified."
                )
        for slot in slots:
            if slot not in active_person_slots:
                continue
            profile = profiles.get(slot, {}) or {}
            appearance_preset = str(profile.get("appearance_preset", "none") or "none")
            clothing_preset = str(profile.get("clothing_preset", "none") or "none")
            appearance_desc = str(profile.get("appearance_desc", "") or "")
            clothing_desc = str(profile.get("clothing_desc", "") or "")
            extension_ethnic_appearance = str(profile.get("extension_ethnic_appearance", "none") or "none")
            if framing == "face_closeup" and (
                appearance_preset in body_detail_presets
                or _appearance_desc_has_body_scale_detail(appearance_desc)
                or clothing_preset != "none"
                or clothing_desc.strip()
            ):
                warnings.append(
                    f"Framing visibility warning: Shot {shot.get('index', 1)} uses a face close-up on Person {slot}, while body/wardrobe settings are selected. "
                    "Those settings remain in the prompt but cannot be expected to be clearly visible in a face-only composition; use a wider framing when they must be visibly verified."
                )
            if framing == "wide_scene" and (
                appearance_preset in face_detail_presets or extension_ethnic_appearance != "none"
            ):
                warnings.append(
                    f"Framing visibility warning: Shot {shot.get('index', 1)} uses a wide scene while Person {slot} has fine facial or ethnic-appearance detail selected. "
                    "The setting can dominate the frame and fine facial traits may be less legible; include a closer Shot if those traits must be visibly verified."
                )
    # Deduplicate deterministic repeated warnings without changing order.
    return list(dict.fromkeys(warnings))


def _reference_sentence_for_shots(mode: str, fidelity: str, shot_count: int, *, action_requested: bool = True) -> str:
    if shot_count <= 1:
        return _reference_sentence(mode, fidelity, action_requested=action_requested)
    if fidelity not in REFERENCE_FIDELITY_VALUES:
        raise _UserInputError(f"Unsupported reference_fidelity: {fidelity}")
    if mode == "t2va":
        return ""
    if mode == "i2va":
        if fidelity == "strict":
            return "The visible subject and scene shown in <Picture 1> stay closely consistent with the reference image across the explicitly requested shots."
        if fidelity == "balanced":
            return "The visible subject and scene shown in <Picture 1> remain consistent with the reference image across the explicitly requested shots."
        return "The visible subject and scene remain recognizable from <Picture 1> across the explicitly requested shots while allowing broader reframing."
    if mode == "fl2va":
        if fidelity == "strict":
            return "Begin from Picture 1 and progress across the explicitly requested shots so the final shot lands closely on Picture 2 while preserving clear visual continuity."
        if fidelity == "balanced":
            return "Begin from Picture 1 and progress across the explicitly requested shots toward Picture 2, preserving clear subject continuity while allowing the scene, pose, composition, or lighting changes needed to reach the final reference."
        return "Begin from Picture 1 and progress broadly across the explicitly requested shots toward Picture 2, allowing stronger scene, pose, composition, or lighting changes while keeping recognizable visual continuity."
    if mode == "l2va":
        if fidelity == "strict":
            return "Progress across the explicitly requested shots toward the final state established by <Picture 1>, keeping the visible subject and scene closely consistent at the end."
        if fidelity == "balanced":
            return "Progress naturally across the explicitly requested shots toward the final state established by <Picture 1>, preserving clear visual continuity while allowing the changes needed before the final convergence."
        return "Progress broadly across the explicitly requested shots toward the final state established by <Picture 1>, allowing stronger intermediate changes while keeping recognizable continuity before the final convergence."
    raise AssertionError("unreachable")

def _soundscape(
    text: str,
    mode: str,
    custom_hint: str,
    dialogue_text: str = "",
    dialogue_delivery: str = "on_screen",
    has_non_diegetic_music: bool = False,
) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    if mode not in SOUNDSCAPE_VALUES:
        raise _UserInputError(f"Unsupported soundscape_mode: {mode}")
    warnings.extend(_sound_hint_semantic_warnings(custom_hint))

    # The H3 guide keeps spoken dialogue in integrated_multimodal_description;
    # overall_soundscape summarizes ambience, physical action sounds, and
    # non-verbal human sounds without repeating dialogue.
    if mode == "silent":
        if custom_hint:
            warnings.append("sound_hint was ignored because soundscape_mode is silent.")
        # H3 reserves N/A for explicit complete silence throughout the video.
        # If dialogue or non-diegetic music is still present, only the ambient /
        # physical / non-verbal soundscape is absent, so describe that absence
        # instead of claiming the whole video is silent.
        if not dialogue_text and not has_non_diegetic_music:
            return "N/A", warnings
        return _enforce_h3_sentence_limit("Ambient sound, physical-action sound, and non-verbal human sound are absent.", "overall_soundscape", 4), warnings

    if mode == "custom_only":
        if not custom_hint:
            warnings.append(
                "Soundscape was set to Custom only but the custom sound field was empty; "
                "it was repaired to a restrained natural ambient/action soundscape."
            )
            return _enforce_h3_sentence_limit(
                "Natural ambient sound remains restrained, with physical action sounds synchronized to visible movement.",
                "overall_soundscape", 4,
            ), warnings
        custom_text = _format_custom_body_hint(custom_hint)
        custom_text, trimmed = _trim_user_sentences(custom_text, 4)
        if trimmed:
            warnings.append("Soundscape custom text exceeded H3's 4-sentence section budget; only the first 4 sentences were kept.")
        return _enforce_h3_sentence_limit(custom_text, "overall_soundscape", 4), warnings

    if mode == "minimal":
        parts = ["Natural ambient sound remains restrained, with physical action sounds synchronized to visible movement."]
        if custom_hint:
            custom_text, trimmed = _trim_user_sentences(_format_custom_body_hint(custom_hint), 3)
            if trimmed:
                warnings.append("Soundscape custom text exceeded the remaining H3 sentence budget; only the first 3 custom sentences were kept.")
            if custom_text:
                parts.append(custom_text)
        return _enforce_h3_sentence_limit(" ".join(parts), "overall_soundscape", 4), warnings

    if not custom_hint and _EXPLICIT_SILENCE_RE.search(text):
        if dialogue_text or has_non_diegetic_music:
            return _enforce_h3_sentence_limit("Ambient sound, physical-action sound, and non-verbal human sound are absent.", "overall_soundscape", 4), warnings
        return "N/A", warnings

    cues: List[str] = []
    custom_text = _format_custom_body_hint(custom_hint) if custom_hint else ""
    custom_text, trimmed = _trim_user_sentences(custom_text, 4)
    if trimmed:
        warnings.append("Soundscape custom text exceeded H3's 4-sentence section budget; only the first 4 sentences were kept.")
    custom_sentence_count = _count_h3_sentences(custom_text) if custom_text else 0
    # User-authored custom sound is authoritative. Reserve the remaining H3
    # sentence budget for automatically inferred ambience instead of rejecting a
    # valid custom hint merely because several auto cues were also detected.
    auto_cue_limit = max(0, 4 - custom_sentence_count)
    for pattern, sentence in _SOUND_CUES:
        if pattern.search(text) and len(cues) < auto_cue_limit:
            if pattern is _CAFE_SOUND_CUE_RE and _suppress_indoor_cafe_cue(text):
                continue
            cues.append(sentence)
        if len(cues) >= auto_cue_limit:
            break
    if not cues and auto_cue_limit > 0:
        cues.append("Natural ambient sound follows the visible environment, with physical action sounds synchronized to movement.")
    if custom_text:
        cues.append(custom_text)
    return _enforce_h3_sentence_limit(" ".join(cues), "overall_soundscape", 4), warnings


def _music(mode: str, custom_hint: str) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    if mode not in MUSIC_VALUES:
        raise _UserInputError(f"Unsupported music_mode: {mode}")

    warnings.extend(_music_hint_semantic_warnings(custom_hint))
    custom_hint = _format_custom_body_hint(custom_hint)
    if mode == "none":
        if custom_hint:
            warnings.append("music_hint was ignored because music_mode is none.")
        return _enforce_h3_sentence_limit(MUSIC_TEXT[mode], "non_diegetic_music", 3), warnings

    if mode == "custom":
        if not custom_hint:
            warnings.append(
                "Background Music was set to Custom but the custom music field was empty; "
                "it was repaired to no non-diegetic music."
            )
            return _enforce_h3_sentence_limit(MUSIC_TEXT["none"], "non_diegetic_music", 3), warnings
        custom_hint, trimmed = _trim_user_sentences(custom_hint, 3)
        if trimmed:
            warnings.append("Custom background-music text exceeded H3's 3-sentence section budget; only the first 3 sentences were kept.")
        return _enforce_h3_sentence_limit(custom_hint, "non_diegetic_music", 3), warnings

    base_music = MUSIC_TEXT[mode]
    if custom_hint:
        # Presets define the base instrumentation/shape. Keep one preset
        # sentence and at most the remaining two user sentences.
        custom_hint, trimmed = _trim_user_sentences(custom_hint, 2)
        if trimmed:
            warnings.append("Background-music additional input exceeded the remaining H3 sentence budget; only the first 2 custom sentences were kept.")
        base_music = f"{base_music} {custom_hint}"
    return _enforce_h3_sentence_limit(base_music, "non_diegetic_music", 3), warnings



def _estimate_spoken_seconds(text: str) -> float:
    if not text.strip():
        return 0.0
    hangul = len(re.findall(r"[\uac00-\ud7af]", text))
    kana_cjk = len(re.findall(r"[\u3040-\u30ff\u3400-\u9fff]", text))
    punctuation_pause = 0.12 * len(re.findall(r"[,.!?。！？]", text))
    if hangul:
        base = hangul / 4.5
    elif kana_cjk:
        base = kana_cjk / 4.2
    else:
        words = len(re.findall(r"\b[\w’'-]+\b", text, flags=re.UNICODE))
        base = words / 2.35 if words else len(text) / 12.0
    return base + punctuation_pause


def _estimate_fast_spoken_seconds(text: str) -> float:
    """Conservative lower-bound estimate used only for hard timing blocks.

    The ordinary estimator remains the warning signal.  This second estimate
    assumes unusually fast but still intelligible delivery so a user is blocked
    only when a line is clearly unable to fit the available Shot/video window.
    """
    if not str(text or "").strip():
        return 0.0
    value = str(text)
    hangul = len(re.findall(r"[\uac00-\ud7af]", value))
    kana_cjk = len(re.findall(r"[\u3040-\u30ff\u3400-\u9fff]", value))
    latin_words = len(re.findall(r"(?i)(?<![\w’'-])[A-Z0-9][A-Z0-9’'-]*(?![\w’'-])", value))
    punctuation_pause = 0.015 * len(re.findall(r"[,.!?。！？]", value))
    base = (hangul / 10.0) + (kana_cjk / 9.5) + (latin_words / 6.0)
    if base <= 0.0:
        base = len(value) / 24.0
    return base + punctuation_pause


def _dialogue_clearly_exceeds_window(text: str, available_seconds: float) -> bool:
    available = max(0.0, float(available_seconds))
    # A small absolute margin prevents hard blocks on sub-second rounding edges.
    return _estimate_fast_spoken_seconds(text) > available + 0.15


def _reference_clothing_lock_sentence(mode: str, preserve_reference_clothing: bool) -> str:
    if mode != "i2va" or not preserve_reference_clothing:
        return ""
    return (
        "Preserve the exact clothing, colors, materials, and accessories visible on every person in <Picture 1> "
        "throughout the entire target video. Do not change, replace, remove, or redesign any wardrobe or accessories."
    )


def _instruction(mode: str, shot_count: int, duration: float) -> str:
    if mode == "t2va":
        return ""
    if mode == "i2va":
        return "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced."
    if mode == "fl2va":
        return (
            "How the reference pictures align with the target video — "
            f"Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; "
            f"Picture 2 (from Shot {shot_count}) aligns with the {duration:.2f}-second mark of the target video."
        )
    if mode == "l2va":
        return (
            "How the reference pictures align with the target video — "
            f"<Picture 1> (from [Shot {shot_count}]) aligns with the {duration:.2f}-second mark of the target video."
        )
    raise AssertionError("unreachable")


def _final_landing_sentence(mode: str) -> str:
    if mode == "fl2va":
        return "End the final shot on the subject state, object arrangement, camera view, and composition established by Picture 2."
    if mode == "l2va":
        return "End the final shot on the subject state, object arrangement, camera view, and composition established by <Picture 1>."
    return ""


def _validate_generated_prompt(prompt: str, mode: str, shot_count: int, duration: float, visual_style: str = "auto", max_speaker_id: int = 3, allow_narrator_voiceover: bool = False) -> List[str]:
    errors: List[str] = []
    max_speaker_id = max(1, min(9, int(max_speaker_id or 3)))
    sid_atom = rf"S(?:[1-{max_speaker_id}])"
    for field in ("integrated_multimodal_description:", "overall_soundscape:", "non_diegetic_music:"):
        matches = list(re.finditer(r"(?m)^" + re.escape(field), prompt))
        if len(matches) != 1:
            errors.append(f"Expected exactly one top-level '{field}' field.")

    positions = [prompt.find(field) for field in (
        "integrated_multimodal_description:",
        "overall_soundscape:",
        "non_diegetic_music:",
    )]
    if not (positions[0] >= 0 and positions[0] < positions[1] < positions[2]):
        errors.append("Core H3 fields are not in the required order.")

    # First shot has no timestamp; later ones must have strictly increasing timestamps.
    body_match = re.search(
        r"integrated_multimodal_description:\s*(.*?)(?:\n\noverall_soundscape:)", prompt, flags=re.S
    )
    if not body_match:
        errors.append("Could not isolate integrated_multimodal_description.")
    else:
        body = body_match.group(1)
        if re.match(r"^\s*\[Shot 1\]\s+At\s+\d{2}:\d{2}\.\d{3},", body):
            errors.append("Shot 1 must not have an H3 shot timestamp header.")
        if not body.lstrip().startswith("[Shot 1]"):
            errors.append("integrated_multimodal_description must begin with [Shot 1].")
        if visual_style != "auto":
            expected_prefix = STYLE_START_PREFIXES.get(visual_style)
            shot1_body = re.sub(r"^\s*\[Shot 1\]\s*", "", body, count=1)
            if expected_prefix and not shot1_body.startswith(expected_prefix):
                errors.append(
                    f"Shot 1 must begin with the selected H3 style declaration '{expected_prefix}' for visual_style={visual_style}."
                )
        elif mode in {"i2va", "fl2va", "l2va"}:
            shot1_body = re.sub(r"^\s*\[Shot 1\]\s*", "", body, count=1)
            expected_auto_prefix = {
                "i2va": "Preserve the visual style established by <Picture 1>.",
                "fl2va": "Begin with the visual treatment established by Picture 1",
                "l2va": "Preserve the visual treatment established by <Picture 1>",
            }.get(mode, "")
            if expected_auto_prefix and not shot1_body.startswith(expected_auto_prefix):
                errors.append("Keyframe auto style must begin Shot 1 with the expected neutral reference-style anchor.")
        later_ids = [int(x) for x in re.findall(r"\[Shot\s+(\d+)\]\s+At\s+\d{2}:\d{2}\.\d{3},", body)]
        expected_later = list(range(2, shot_count + 1))
        if later_ids != expected_later:
            errors.append(f"Later shot headers are not sequential: expected {expected_later}, got {later_ids}.")
        cut_times = re.findall(r"\[Shot\s+\d+\]\s+At\s+(\d{2}):(\d{2})\.(\d{3}),", body)
        seconds_values: List[float] = []
        for mm, ss, ms in cut_times:
            seconds_values.append(int(mm) * 60 + int(ss) + int(ms) / 1000.0)
        if len(seconds_values) != max(0, shot_count - 1):
            errors.append("Later-shot timestamp count does not match the shot count.")
        if any(b <= a for a, b in zip(seconds_values, seconds_values[1:])):
            errors.append("Shot timestamps are not strictly increasing.")
        if any(value <= 0 or value >= duration for value in seconds_values):
            errors.append("A shot timestamp falls outside the effective video duration.")

    first_line = prompt.split("\n", 1)[0]
    if mode == "t2va":
        if first_line.startswith("For the target video") or first_line.startswith("How the reference pictures"):
            errors.append("T2VA must not start with an image-alignment instruction.")
    elif mode == "i2va":
        expected = "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced."
        if first_line != expected:
            errors.append("I2VA first-line instruction does not match the H3 guide format.")
    elif mode == "fl2va":
        if not first_line.startswith("How the reference pictures align with the target video — Picture 1"):
            errors.append("FL2VA first-line instruction is missing or malformed.")
        if f"Picture 2 (from Shot {shot_count})" not in first_line or f"{duration:.2f}-second" not in first_line:
            errors.append("FL2VA final-frame alignment does not match the final shot/duration.")
    elif mode == "l2va":
        if not first_line.startswith("How the reference pictures align with the target video — <Picture 1>"):
            errors.append("L2VA first-line instruction is missing or malformed.")
        if f"[Shot {shot_count}]" not in first_line or f"{duration:.2f}-second" not in first_line:
            errors.append("L2VA final-frame alignment does not match the final shot/duration.")

    if prompt.count("<d>") != prompt.count("</d>"):
        errors.append("Dialogue <d> tags are unbalanced.")
    if "<d>" in prompt:
        if not re.search(r"\(S[1-3](?:,S[1-3])*\)", prompt):
            errors.append("Generated dialogue is missing a stable speaker ID.")
        sound_match = re.search(r"overall_soundscape:\s*(.*?)(?:\n\nnon_diegetic_music:)", prompt, flags=re.S)
        music_match = re.search(r"non_diegetic_music:\s*(.*)$", prompt, flags=re.S)
        if sound_match and "<d>" in sound_match.group(1):
            errors.append("Dialogue markup must not be repeated inside overall_soundscape.")
        if music_match and "<d>" in music_match.group(1):
            errors.append("Dialogue markup must not appear inside non_diegetic_music.")
        for payload in re.findall(r"<d>(.*?)</d>", prompt, flags=re.S):
            if not re.match(r"^\[(?:English|Korean|Japanese|Chinese|Spanish|French|German|Russian|Arabic|Italian|Portuguese)\]\s+.+", payload.strip(), flags=re.S):
                errors.append("Dialogue payload is missing a supported H3 language tag or spoken text.")
                break

    # Prevent internal translation sentinels from ever reaching the user/model.
    if re.search(r"H3(?:SCREEN|PROTECTED)TEXT", prompt, flags=re.IGNORECASE):
        errors.append("Internal screen-text protection sentinel leaked into the generated prompt.")

    sound_match = re.search(r"overall_soundscape:\s*(.*?)(?:\n\nnon_diegetic_music:)", prompt, flags=re.S)
    music_match = re.search(r"non_diegetic_music:\s*(.*)$", prompt, flags=re.S)
    if sound_match:
        sound_value = sound_match.group(1).strip()
        if sound_value.upper() != "N/A":
            sound_sentences = _count_h3_sentences(sound_value)
            if not (1 <= sound_sentences <= 4):
                errors.append(f"overall_soundscape must contain 1-4 sentences or N/A; got {sound_sentences}.")
    if music_match:
        music_value = music_match.group(1).strip()
        if music_value.upper() != "N/A":
            music_sentences = _count_h3_sentences(music_value)
            if not (1 <= music_sentences <= 3):
                errors.append(f"non_diegetic_music must contain 1-3 sentences or N/A; got {music_sentences}.")

    # Every generated voiceover dialogue must use the H3 voiceover marker.
    # T2VA additionally keeps visible speakers' lips closed; image-reference modes
    # must not assume that the referenced pixels contain the selected speaker.
    for match in re.finditer(r"<d>.*?</d>", prompt, flags=re.S):
        prefix = prompt[max(0, match.start() - 500):match.start()]
        suffix = prompt[match.end():min(len(prompt), match.end() + 220)]
        # Classify the marker immediately attached to this <d> block, rather
        # than scanning earlier Turns where another voiceover may appear.
        marker = re.search(
            r"(?:(?P<lemma>says|sings)(?: in an off-screen voiceover)?:|(?P<group>(?:say|sing) together)(?: in an off-screen voiceover)?[:,])\s*$",
            prefix, flags=re.IGNORECASE
        )
        marker_text = marker.group(0).strip() if marker else ""
        marker_lc = marker_text.rstrip(':, ').strip().lower()
        if marker_text and "off-screen voiceover" in marker_lc:
            if marker_lc != "says in an off-screen voiceover":
                errors.append("Voiceover dialogue must use the exact 'says in an off-screen voiceover:' marker.")
            narrator_attached = allow_narrator_voiceover and bool(re.search(r"independent narrator[^<]{0,500}$", prefix, flags=re.IGNORECASE))
            if not narrator_attached and not re.search(r"lips?\s+remain\s+completely\s+closed", suffix, flags=re.IGNORECASE):
                errors.append("Voiceover dialogue must explicitly state that any corresponding on-screen speakers' lips remain completely closed.")

    # Composite speaker IDs may contain only unique supported members.
    for sid_text in re.findall(rf"\(({sid_atom}(?:,{sid_atom})+)\)", prompt):
        members = sid_text.split(',')
        if len(members) != len(set(members)):
            errors.append(f"Composite speaker ID contains duplicate members: ({sid_text}).")

    # New H3 voice identities must be introduced in first-vocal-event order.
    # This also catches old fixed A=S1/B=S2/C=S3 output when B or C speaks
    # before A. Existing IDs may reappear in any later dialogue Turn.
    known_sids: set = set()
    next_expected_sid = 1
    for dialogue_match in re.finditer(r"<d>.*?</d>", prompt, flags=re.S):
        prefix = prompt[max(0, dialogue_match.start() - 800):dialogue_match.start()]
        # The on-screen composite renderer reinforces separate voices with
        # "say together in two|three clearly distinct voices at the same time,
        # with both voices|all three voices clearly audible," before <d>. That
        # clause must still count as this dialogue's speaker marker; otherwise
        # the composite members were skipped and a later speaker was reported
        # as out of order (false RuntimeError for e.g. A+C then B).
        groups = re.findall(
            rf"\(({sid_atom}(?:,{sid_atom})*)\)\s*(?:(?:says|sings)(?: in an off-screen voiceover)?:"
            rf"|(?:(?:say|sing) together(?: in (?:two|three) clearly distinct voices at the same time,"
            rf" with (?:both voices|all three voices) clearly audible)?))[:,]?\s*$",
            prefix, flags=re.IGNORECASE,
        )
        if not groups:
            continue
        members = groups[-1].upper().split(',')
        for sid in members:
            if sid in known_sids:
                continue
            expected = f"S{next_expected_sid}"
            if sid != expected:
                errors.append(
                    f"Speaker IDs must be introduced by first vocal-event order: expected {expected}, got {sid}."
                )
                # Continue with the observed ID to avoid a cascade of duplicate
                # messages while still reporting later independent violations.
            known_sids.add(sid)
            next_expected_sid += 1

    return errors



def _contains_hangul(text: str) -> bool:
    return bool(re.search(r"[\uac00-\ud7af]", text or ""))


def _looks_like_google_error_page(text: str) -> bool:
    probe = re.sub(r"\s+", " ", (text or "")).strip().lower()
    if not probe:
        return True
    if re.search(r"\berror\s+5\d\d\b", probe):
        return True
    markers = (
        "error 500",
        "server error",
        "that\u2019s an error",
        "that's an error",
        "there was an error",
        "please try again later",
        "<html",
        "<!doctype html",
    )
    return any(marker in probe for marker in markers)


def _translate_google_cloud_v2_request(
    text: str,
    *,
    api_key: Optional[str] = None,
    use_provider_guard: bool = True,
) -> str:
    """Official Google Cloud Translation Basic v2 route.

    The API key is loaded from the ComfyUI-user-local secret configuration and
    is never accepted through INPUT_TYPES/workflow serialization.  The optional
    explicit key is used only by the local settings dialog's one-shot test.
    """
    key = _normalize_google_cloud_translation_api_key(
        api_key if api_key is not None else _google_cloud_translation_api_key()
    )
    if not key:
        raise _TranslationRouteConfigurationError(
            "Google Cloud Translation API key is not configured."
        )
    try:
        from html import unescape as _html_unescape
        from urllib.request import Request, urlopen
    except Exception as exc:
        raise _TranslationRouteDependencyError(
            "Python standard-library HTTP helpers are unavailable for Google Cloud Translation."
        ) from exc

    if use_provider_guard:
        _translation_wait_provider_slot("google_cloud")

    body = json.dumps(
        {
            "q": text,
            "source": "ko",
            "target": "en",
            "format": "text",
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    request = Request(
        "https://translation.googleapis.com/language/translate/v2",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "x-goog-api-key": key,
            "User-Agent": "Ultra-MiniMax-H3-Prompt/3.50",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(2_000_000)
            charset = response.headers.get_content_charset() or "utf-8"
    except Exception as exc:
        status = _translation_exception_http_status(exc)
        error_text = ""
        if status in (400, 401, 403, 429):
            try:
                raw_error = exc.read(200_000) if callable(getattr(exc, "read", None)) else b""
                if isinstance(raw_error, bytes):
                    error_text = raw_error.decode("utf-8", errors="replace").lower()
                else:
                    error_text = str(raw_error or "").lower()
            except Exception:
                error_text = ""
        quota_limited_403 = status == 403 and any(
            token in error_text
            for token in (
                "quota", "rate limit", "ratelimit", "resource_exhausted",
                "daily limit", "user rate limit", "limit exceeded",
            )
        )
        if status == 429 or quota_limited_403:
            if use_provider_guard:
                _translation_note_provider_429("google_cloud", getattr(exc, "headers", None))
            raise _TranslationRouteRateLimitedError(
                f"Google Cloud Translation API was rate/quota limited (HTTP {status or 429})."
            ) from exc
        if status in (400, 401, 403):
            raise _TranslationRouteConfigurationError(
                "Google Cloud Translation API rejected the configured key/project settings."
            ) from exc
        raise _TranslationRouteUnavailableError(
            "Google Cloud Translation API request failed."
        ) from exc

    try:
        payload = json.loads(raw.decode(charset, errors="replace"))
        translations = ((payload.get("data") or {}).get("translations") or [])
        translated = ""
        if translations and isinstance(translations[0], dict):
            translated = _html_unescape(str(translations[0].get("translatedText") or "")).strip()
    except Exception as exc:
        raise _TranslationRouteUnusableResultError(
            "Google Cloud Translation API returned an unexpected response."
        ) from exc

    if not translated or _looks_like_google_error_page(translated):
        raise _TranslationRouteUnusableResultError(
            "Google Cloud Translation API returned no usable translation."
        )
    if use_provider_guard:
        _translation_note_provider_success("google_cloud")
    return translated


def register_translation_api_routes() -> bool:
    """Register local ComfyUI endpoints for the official translation API setting.

    The secret is stored only under the ComfyUI user directory.  These routes
    deliberately never return the key and the key is not part of INPUT_TYPES,
    node properties, workflow JSON, or prompt payloads.
    """
    try:
        from aiohttp import web  # type: ignore
        from server import PromptServer  # type: ignore
    except Exception:
        return False

    try:
        prompt_server = PromptServer.instance
        routes = prompt_server.routes
    except Exception:
        return False

    marker = "_ultra_h3_translation_api_routes_v1"
    if getattr(prompt_server, marker, False):
        return True

    def _json_error(message: str, *, status: int = 400, error_type: str = "request_error"):
        return web.json_response(
            {"ok": False, "error": str(message or "Translation API request failed."), "type": error_type},
            status=status,
        )

    @routes.get("/ultra_minimax_h3/translation_api")
    async def _translation_api_status_route(request):
        del request
        return web.json_response({"ok": True, **_google_cloud_translation_api_status()})

    @routes.post("/ultra_minimax_h3/translation_api")
    async def _translation_api_save_route(request):
        try:
            payload = await request.json()
        except Exception:
            return _json_error("Invalid JSON request.")
        if not isinstance(payload, dict):
            return _json_error("Invalid request body.")
        try:
            key = _normalize_google_cloud_translation_api_key(payload.get("api_key", ""))
        except ValueError as exc:
            return _json_error(str(exc))
        if not key:
            return _json_error("Google Cloud Translation API key is empty.")
        if not _save_google_cloud_translation_api_key(key):
            return _json_error(
                "Could not save the API key in the ComfyUI user directory.",
                status=500,
                error_type="storage_error",
            )
        return web.json_response({"ok": True, **_google_cloud_translation_api_status()})

    @routes.delete("/ultra_minimax_h3/translation_api")
    async def _translation_api_delete_route(request):
        del request
        if not _clear_google_cloud_translation_api_key():
            return _json_error(
                "Could not remove the saved API key from the ComfyUI user directory.",
                status=500,
                error_type="storage_error",
            )
        return web.json_response({"ok": True, **_google_cloud_translation_api_status()})

    @routes.post("/ultra_minimax_h3/translation_api/test")
    async def _translation_api_test_route(request):
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            return _json_error("Invalid request body.")
        supplied = payload.get("api_key", None)
        try:
            key = (
                _normalize_google_cloud_translation_api_key(supplied)
                if supplied is not None and str(supplied or "").strip()
                else _google_cloud_translation_api_key()
            )
        except ValueError as exc:
            return _json_error(str(exc))
        if not key:
            return _json_error("Enter an API key or save one first.", error_type="missing_key")

        try:
            import asyncio
            translated = await asyncio.to_thread(
                _translate_google_cloud_v2_request,
                "한 여성이 비 오는 거리를 천천히 걷는다.",
                api_key=key,
                use_provider_guard=False,
            )
        except _TranslationRouteRateLimitedError:
            return _json_error(
                "Google Cloud Translation returned HTTP 429. Check quota/rate limits and try again later.",
                status=429,
                error_type="rate_limited",
            )
        except _TranslationRouteConfigurationError:
            return _json_error(
                "Google Cloud Translation rejected the key/project settings. Check the API-key restriction, Cloud Translation API activation, and Billing.",
                status=403,
                error_type="configuration_error",
            )
        except Exception:
            return _json_error(
                "Google Cloud Translation test request failed. Check the network and Google Cloud service status.",
                status=502,
                error_type="provider_error",
            )
        return web.json_response(
            {
                "ok": True,
                "provider": "google_cloud_translation_v2",
                "translatedText": translated,
                "configured": bool(_google_cloud_translation_api_key()),
            }
        )

    try:
        setattr(prompt_server, marker, True)
    except Exception:
        pass
    return True


def _translate_google_json_request(text: str) -> str:
    """Thread-safe no-key Google JSON route with bounded transient retry and 429 cooldown."""
    try:
        import requests  # type: ignore
    except Exception as exc:
        raise _TranslationRouteDependencyError(
            "requests is unavailable for Google Korean-to-English translation."
        ) from exc

    last_error: Optional[Exception] = None
    for attempt in range(2):
        _translation_wait_provider_slot("google")
        session = requests.Session()
        response = None
        try:
            response = session.get(
                "https://translate.googleapis.com/translate_a/single",
                params={
                    "client": "gtx",
                    "sl": "ko",
                    "tl": "en",
                    "dt": "t",
                    "ie": "UTF-8",
                    "oe": "UTF-8",
                    "q": text,
                },
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=(5, 20),
            )
            response.raise_for_status()
        except Exception as exc:
            last_error = exc
            status = _translation_exception_http_status(exc)
            if status == 429:
                _translation_note_provider_429("google", getattr(response, "headers", None))
                raise _TranslationRouteRateLimitedError(
                    "Google JSON Korean-to-English translation was rate-limited (HTTP 429)."
                ) from exc
            if status in (500, 502, 503, 504) and attempt == 0:
                time.sleep(_TRANSLATION_TRANSIENT_RETRY_DELAY_SECONDS)
                continue
            if status is None and attempt == 0:
                time.sleep(_TRANSLATION_TRANSIENT_RETRY_DELAY_SECONDS)
                continue
            raise _TranslationRouteUnavailableError(
                "Google JSON Korean-to-English translation request failed."
            ) from exc
        finally:
            try:
                session.close()
            except Exception:
                pass

        try:
            payload = response.json()
            segments = payload[0]
            translated = "".join(
                segment[0] for segment in segments
                if isinstance(segment, list) and segment and isinstance(segment[0], str)
            ).strip()
        except Exception as exc:
            raise _TranslationRouteUnusableResultError(
                "Google JSON Korean-to-English translation returned an unexpected response."
            ) from exc

        if not translated or _looks_like_google_error_page(translated):
            raise _TranslationRouteUnusableResultError(
                "Google JSON Korean-to-English translation returned no usable translation."
            )
        _translation_note_provider_success("google")
        return translated

    if last_error is not None:
        raise _TranslationRouteUnavailableError(
            "Google JSON Korean-to-English translation request failed."
        ) from last_error
    raise _TranslationRouteUnavailableError(
        "Google JSON Korean-to-English translation request failed."
    )

def _translate_google_mobile_request(text: str) -> str:
    """Google mobile-page fallback; locally skipped while Google is cooling down after 429."""
    try:
        from html import unescape as _html_unescape
        from urllib.parse import urlencode
        from urllib.request import Request, urlopen
    except Exception as exc:
        raise _TranslationRouteDependencyError(
            "Python standard-library HTTP helpers are unavailable for the mobile translation route."
        ) from exc

    _translation_wait_provider_slot("google")
    query = urlencode({"sl": "ko", "tl": "en", "hl": "en", "q": text})
    request = Request(
        f"https://translate.google.com/m?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(2_000_000)
            charset = response.headers.get_content_charset() or "utf-8"
    except Exception as exc:
        status = _translation_exception_http_status(exc)
        if status == 429:
            _translation_note_provider_429("google", getattr(exc, "headers", None))
            raise _TranslationRouteRateLimitedError(
                "Google mobile Korean-to-English translation was rate-limited (HTTP 429)."
            ) from exc
        raise _TranslationRouteUnavailableError(
            "Google mobile Korean-to-English translation request failed."
        ) from exc

    try:
        page = raw.decode(charset, errors="replace")
        match = re.search(
            r'<div[^>]*class=["\']result-container["\'][^>]*>(.*?)</div>',
            page,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            raise ValueError("result-container not found")
        translated = re.sub(r"<[^>]+>", "", match.group(1))
        translated = _html_unescape(translated)
        translated = re.sub(r"\s+", " ", translated).strip()
    except Exception as exc:
        raise _TranslationRouteUnusableResultError(
            "Google mobile Korean-to-English translation returned an unexpected response."
        ) from exc

    if not translated or _looks_like_google_error_page(translated):
        raise _TranslationRouteUnusableResultError(
            "Google mobile Korean-to-English translation returned no usable translation."
        )
    _translation_note_provider_success("google")
    return translated

def _split_translation_text_for_mymemory(
    text: str,
    limit_bytes: int = _MYMEMORY_TRANSLATION_CHUNK_LIMIT_BYTES,
) -> List[str]:
    """Split by UTF-8 byte size because MyMemory limits q to 500 bytes."""
    if len(text.encode("utf-8")) <= limit_bytes:
        return [text]

    chunks: List[str] = []
    remaining = text
    boundary_pattern = re.compile(r"[.!?。！？]\s+|[,;:]\s+|\s+")

    while remaining:
        if len(remaining.encode("utf-8")) <= limit_bytes:
            chunks.append(remaining)
            break

        used_bytes = 0
        char_limit = 0
        for index, char in enumerate(remaining):
            char_bytes = len(char.encode("utf-8"))
            if used_bytes + char_bytes > limit_bytes:
                break
            used_bytes += char_bytes
            char_limit = index + 1

        if char_limit <= 0:
            # Defensive only: valid Unicode code points are at most 4 UTF-8 bytes,
            # while the configured budget is much larger.
            char_limit = 1

        candidate = remaining[:char_limit]
        search_floor_bytes = max(1, int(limit_bytes * 0.55))
        cuts: List[int] = []
        for match in boundary_pattern.finditer(candidate):
            if len(candidate[:match.end()].encode("utf-8")) >= search_floor_bytes:
                cuts.append(match.end())
        cut = max(cuts) if cuts else char_limit
        # Never cut the node-owned opaque tokens used to preserve screen text
        # and structural Person identities across external translation.
        token_pattern = re.compile(
            r"H3SCREENTEXTTOKEN\d+X|ZXQH3(?:PERSON|ACTOR)[ABC]QXZ",
            flags=re.IGNORECASE,
        )
        for token_match in token_pattern.finditer(remaining):
            if token_match.start() < cut < token_match.end():
                before = token_match.start()
                after = token_match.end()
                if before > 0:
                    cut = before
                elif len(remaining[:after].encode("utf-8")) <= limit_bytes:
                    cut = after
                break
        chunk = remaining[:cut].strip()
        if not chunk:
            chunk = remaining[:char_limit]
            cut = char_limit
        chunks.append(chunk)
        remaining = remaining[cut:].lstrip()

    return chunks


def _translate_mymemory_ko_to_en_single(text: str) -> str:
    """Independent no-key fallback; intentionally does not use Google's endpoints."""
    try:
        from html import unescape as _html_unescape
        from urllib.parse import urlencode
        from urllib.request import Request, urlopen
    except Exception as exc:
        raise _TranslationRouteDependencyError(
            "Python standard-library HTTP helpers are unavailable for the MyMemory translation route."
        ) from exc

    _translation_wait_provider_slot("mymemory")
    query = urlencode({"q": text, "langpair": "ko-KR|en-GB"})
    request = Request(
        f"https://api.mymemory.translated.net/get?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(2_000_000)
            charset = response.headers.get_content_charset() or "utf-8"
    except Exception as exc:
        status = _translation_exception_http_status(exc)
        if status == 429:
            _translation_note_provider_429("mymemory", getattr(exc, "headers", None))
            raise _TranslationRouteRateLimitedError(
                "MyMemory Korean-to-English translation was rate-limited (HTTP 429)."
            ) from exc
        raise _TranslationRouteUnavailableError(
            "MyMemory Korean-to-English translation request failed."
        ) from exc

    try:
        payload = json.loads(raw.decode(charset, errors="replace"))
        response_data = payload.get("responseData") or {}
        translated = _html_unescape(str(response_data.get("translatedText") or "")).strip()
        response_status = payload.get("responseStatus")
        try:
            response_status_code = int(response_status) if response_status is not None else 200
        except (TypeError, ValueError):
            response_status_code = 200
        if response_status_code >= 400:
            raise ValueError(f"responseStatus={response_status_code}")
        if not translated:
            for match in payload.get("matches") or []:
                if isinstance(match, dict) and match.get("translation"):
                    translated = _html_unescape(str(match["translation"])).strip()
                    break
    except Exception as exc:
        raise _TranslationRouteUnusableResultError(
            "MyMemory Korean-to-English translation returned an unexpected response."
        ) from exc

    if not translated or _looks_like_google_error_page(translated):
        raise _TranslationRouteUnusableResultError(
            "MyMemory Korean-to-English translation returned no usable translation."
        )
    _translation_note_provider_success("mymemory")
    return translated


def _translate_mymemory_ko_to_en(text: str) -> str:
    chunks = _split_translation_text_for_mymemory(text)
    translated = [_translate_mymemory_ko_to_en_single(chunk) for chunk in chunks]
    return " ".join(part.strip() for part in translated if part.strip()).strip()


def _translate_google_deep_translator_request(text: str) -> str:
    """Optional compatibility fallback; never bypass the Google 429 cooldown."""
    _translation_wait_provider_slot("google")
    try:
        from deep_translator import GoogleTranslator  # type: ignore
    except Exception as exc:
        raise _TranslationRouteDependencyError(
            "deep-translator is unavailable for the optional translation route."
        ) from exc
    try:
        translated = (GoogleTranslator(source="ko", target="en").translate(text) or "").strip()
    except Exception as exc:
        status = _translation_exception_http_status(exc)
        if status == 429 or type(exc).__name__ == "TooManyRequests":
            _translation_note_provider_429("google", getattr(getattr(exc, "response", None), "headers", None))
            raise _TranslationRouteRateLimitedError(
                "deep-translator GoogleTranslator was rate-limited (HTTP 429)."
            ) from exc
        raise _TranslationRouteUnavailableError(
            "deep-translator GoogleTranslator request failed."
        ) from exc
    if not translated or _looks_like_google_error_page(translated):
        raise _TranslationRouteUnusableResultError(
            "deep-translator GoogleTranslator returned no usable translation."
        )
    _translation_note_provider_success("google")
    return translated


@lru_cache(maxsize=2048)
def _translate_google_ko_to_en(text: str) -> Tuple[str, str]:
    """Translate Korean to English with provider-aware fallback and persistent success caching."""
    cached = _translation_persistent_cache_get(text)
    if cached is not None:
        return cached

    routes: List[Tuple[Any, str, bool]] = []
    if _google_cloud_translation_api_key():
        routes.append((_translate_google_cloud_v2_request, "Google Cloud Translation v2", False))
    routes.extend((
        (_translate_google_json_request, "Google JSON", False),
        (_translate_google_mobile_request, "Google mobile", False),
        (_translate_mymemory_ko_to_en, "MyMemory independent fallback", False),
        # Optional only: ordinary users do not need deep-translator installed.
        (_translate_google_deep_translator_request, "deep-translator Google compatibility fallback", True),
    ))
    errors: List[Tuple[str, Exception]] = []
    for route, label, optional_dependency in routes:
        try:
            translated = route(text)
            # Persist only Google-backed successful translations. MyMemory is a
            # useful emergency fallback, but pinning its potentially different
            # wording across ComfyUI restarts could lower prompt quality after
            # Google recovers. The existing in-process LRU still preserves the
            # current-session behavior exactly.
            if label != "MyMemory independent fallback":
                _translation_persistent_cache_put(text, translated, label)
            return translated, label
        except _TranslationRouteDependencyError as exc:
            if optional_dependency:
                continue
            errors.append((label, exc))
        except Exception as exc:
            errors.append((label, exc))

    detail = ", ".join(f"{label}={type(exc).__name__}" for label, exc in errors)
    diagnostic = _translation_routes_diagnostic(errors)
    try:
        print(f"[Ultra MiniMax H3 Translation] all routes failed: {diagnostic}")
    except Exception:
        pass
    route_errors = [exc for _label, exc in errors if isinstance(exc, _TranslationRouteUnavailableError)]
    unusable_errors = [exc for _label, exc in errors if isinstance(exc, _TranslationRouteUnusableResultError)]
    dependency_errors = [exc for exc in route_errors if isinstance(exc, _TranslationRouteDependencyError)]
    non_dependency_route_errors = [exc for exc in route_errors if not isinstance(exc, _TranslationRouteDependencyError)]
    configuration_errors = [exc for exc in route_errors if isinstance(exc, _TranslationRouteConfigurationError)]
    rate_limit_route_errors = [
        exc for exc in non_dependency_route_errors
        if isinstance(exc, (_TranslationRouteRateLimitedError, _TranslationRouteCoolingDownError))
    ]
    last_error = errors[-1][1] if errors else RuntimeError("no translation routes configured")

    if route_errors and len(route_errors) == len(errors):
        if configuration_errors and _google_cloud_translation_api_key():
            raise _TranslationUnavailableError(
                "The configured Google Cloud Translation API key/project settings need attention, and the free fallback routes also failed. "
                "Open Google Translation API Settings and use Test, then verify the key restriction, Cloud Translation API activation, and Billing. "
                f"({detail}; diagnostics: {diagnostic})."
            ) from last_error
        if non_dependency_route_errors and len(rate_limit_route_errors) == len(non_dependency_route_errors):
            cooldown_note = _translation_cooldown_summary()
            raise _TranslationRateLimitedError(
                "Korean->English translation providers are temporarily rate-limited (HTTP 429)"
                + (f"; {cooldown_note}" if cooldown_note else "")
                + f" ({detail}; diagnostics: {diagnostic})."
            ) from last_error
        if non_dependency_route_errors:
            raise _TranslationNetworkUnavailableError(
                "Korean->English translation failed on all reachable online routes"
                + ("; one or more optional compatibility dependencies are also unavailable" if dependency_errors else "")
                + f" ({detail}; diagnostics: {diagnostic})."
            ) from last_error
        raise _TranslationDependencyUnavailableError(
            "Korean->English translation cannot use any configured route because required Python dependencies are unavailable "
            f"({detail}; diagnostics: {diagnostic})."
        ) from last_error

    if unusable_errors or errors:
        raise _TranslationUnavailableError(
            "Korean->English translation could not produce a safe usable result across all routes "
            f"({detail}; diagnostics: {diagnostic})."
        ) from last_error
    raise _TranslationUnavailableError("Korean->English translation has no configured route.")

def _quoted_screen_text_spans(text: str) -> List[Tuple[bool, str]]:
    """Split translatable text from double-quoted on-screen text that must stay literal."""
    if not text:
        return []
    pattern = re.compile(r'"(?:\\.|[^"\\])*"|“[^”]*”')
    spans: List[Tuple[bool, str]] = []
    cursor = 0
    for match in pattern.finditer(text):
        if match.start() > cursor:
            spans.append((False, text[cursor:match.start()]))
        spans.append((True, match.group(0)))
        cursor = match.end()
    if cursor < len(text):
        spans.append((False, text[cursor:]))
    return spans or [(False, text)]


def _scene_structural_person_slots(text: str) -> Tuple[str, ...]:
    """Return explicit Person A/B/C structural references outside quoted screen text."""
    slots: List[str] = []
    for protected, part in _quoted_screen_text_spans(text or ""):
        if protected:
            continue
        for match in re.finditer(r"(?i)(?<![A-Za-z0-9_])Person\s+([ABC])(?=$|[^A-Za-z0-9_])", part):
            slot = match.group(1).upper()
            if slot not in slots:
                slots.append(slot)
    return tuple(slots)


def _normalize_scene_whitespace_preserving_quotes(text: str, *, flatten_newlines: bool) -> str:
    """Normalize prompt whitespace without changing literal text inside double quotes."""
    if not text:
        return ""
    output: List[str] = []
    for protected, part in _quoted_screen_text_spans(text):
        if protected:
            # Keep the literal text intact; only line breaks are flattened because
            # the final H3 body is intentionally single-line.
            if flatten_newlines:
                part = re.sub(r"(?:\r\n|\r|\n)+", " ", part)
            output.append(part)
            continue
        if flatten_newlines:
            part = re.sub(r"\s*(?:\r\n|\r|\n)+\s*", " ", part)
        part = re.sub(r"[ \t\f\v]+", " ", part)
        output.append(part)
    return "".join(output).strip()


def _translate_line_preserving_screen_text(text: str) -> Tuple[str, str]:
    """Translate one line while keeping double-quoted screen text literal."""
    spans = _quoted_screen_text_spans(text)
    protected_values = [part for protected, part in spans if protected]
    if not protected_values:
        return _translate_google_ko_to_en(text)

    masked_parts: List[str] = []
    protected_index = 0
    for protected, part in spans:
        if protected:
            masked_parts.append(f"H3SCREENTEXTTOKEN{protected_index}X")
            protected_index += 1
        else:
            masked_parts.append(part)
    masked = "".join(masked_parts)

    translated, route = _translate_google_ko_to_en(masked)
    restored = translated
    all_tokens_found = True
    for index, value in enumerate(protected_values):
        token = f"H3SCREENTEXTTOKEN{index}X"
        pattern = re.compile(re.escape(token), flags=re.IGNORECASE)
        if not pattern.search(restored):
            all_tokens_found = False
            break
        restored = pattern.sub(lambda _m, value=value: value, restored, count=1)
    if all_tokens_found:
        # Normalize only the translator-produced masked text first; restore the
        # literal quoted values afterward so their internal spacing/punctuation
        # is never rewritten by cleanup.
        normalized = re.sub(r"\s+", " ", translated).strip()
        normalized = re.sub(r'\s+([,.;:!?])', r'\1', normalized)
        restored = normalized
        for index, value in enumerate(protected_values):
            token = f"H3SCREENTEXTTOKEN{index}X"
            restored = re.sub(re.escape(token), lambda _m, value=value: value, restored, count=1, flags=re.IGNORECASE)
        if not re.search(r"H3SCREENTEXTTOKEN\d+X", restored, flags=re.IGNORECASE):
            return restored, route
        # A duplicated sentinel is also unusable; fall through to the safe
        # per-span translation path rather than leaking an internal token.

    # Conservative fallback if a translator unexpectedly mutates or duplicates a sentinel:
    # translate only the unquoted spans and preserve every quoted span verbatim.
    translated_parts: List[str] = []
    routes: List[str] = []
    for protected, part in spans:
        if protected or not _contains_hangul(part):
            translated_parts.append(part)
            continue
        part_translation, part_route = _translate_google_ko_to_en(part)
        translated_parts.append(part_translation)
        if part_route not in routes:
            routes.append(part_route)
    # Reassemble without injecting spaces around protected text. The original
    # quote/particle boundary is preserved during translation; only add an
    # English word-boundary space when separately translated fallback fragments
    # would otherwise glue ASCII text to the preserved quoted literal.
    joined_parts: List[str] = []
    for piece in translated_parts:
        if not piece:
            continue
        if joined_parts:
            prev = joined_parts[-1]
            if prev and piece and not prev[-1].isspace() and not piece[0].isspace():
                prev_quoted = bool(re.search(r'["”]$', prev))
                next_ascii = bool(re.match(r'[A-Za-z0-9]', piece))
                prev_ascii = bool(re.search(r'[A-Za-z0-9]$', prev))
                next_quoted = piece.startswith(('"', '“'))
                if (prev_quoted and next_ascii) or (prev_ascii and next_quoted):
                    joined_parts.append(" ")
        joined_parts.append(piece)
    joined = "".join(joined_parts)
    joined = _normalize_scene_whitespace_preserving_quotes(joined, flatten_newlines=False)
    return joined, ", ".join(routes) if routes else route


def _translate_piece_preserving_screen_text(text: str) -> Tuple[str, str]:
    """Translate non-empty lines independently, then let the H3 compiler flatten them later."""
    lines = text.splitlines(keepends=True)
    if not lines:
        lines = [text]
    output: List[str] = []
    routes: List[str] = []
    for line in lines:
        newline = ""
        body = line
        if line.endswith("\r\n"):
            body, newline = line[:-2], "\r\n"
        elif line.endswith("\n") or line.endswith("\r"):
            body, newline = line[:-1], line[-1]
        if not body.strip() or not _contains_hangul(body):
            output.append(body + newline)
            continue
        translated, route = _translate_line_preserving_screen_text(body)
        output.append(translated + newline)
        if route not in routes:
            routes.append(route)
    return "".join(output).strip(), ", ".join(routes) if routes else "Google translation"


def _flatten_scene_translation_for_prompt(text: str) -> str:
    """
    H3 scene body reads best as one natural line even when the user entered
    multiple lines. Preserve separators like || / -> / CUT: with clean spacing,
    collapse newlines to single spaces, and avoid glued words or double spaces.
    """
    if not text:
        return ""
    return _normalize_scene_whitespace_preserving_quotes(text, flatten_newlines=True)

_KOREAN_PERSON_PARTICLES = {
    "", "은", "는", "이", "가", "을", "를", "의", "에게", "한테", "께",
    "와", "과", "랑", "하고", "도", "만", "부터", "까지", "로", "으로",
    "에서", "에게서", "보다",
}


def _korean_person_token_matches(text: str, stems: Sequence[str]) -> bool:
    if not text:
        return False
    tokens = re.findall(r"[가-힣]+", text)
    for token in tokens:
        for stem in stems:
            if not token.startswith(stem):
                continue
            if token[len(stem):] in _KOREAN_PERSON_PARTICLES:
                return True
    return False


def _contains_explicit_korean_first_singular(text: str) -> bool:
    # Contracted standalone forms such as 난/전 are listed explicitly so words
    # such as 나무, 내일, 저녁 are not mistaken for first-person pronouns.
    return _korean_person_token_matches(text, ("나", "내", "저", "제", "난", "전"))


def _contains_explicit_korean_first_plural(text: str) -> bool:
    if not text:
        return False
    for token in re.findall(r"[가-힣]+", text):
        if token.startswith(("우리", "저희")):
            return True
    return False


def _contains_explicit_korean_second_person(text: str) -> bool:
    if not text:
        return False
    if _korean_person_token_matches(text, ("너", "네", "니", "넌")):
        return True
    for token in re.findall(r"[가-힣]+", text):
        if token.startswith(("너희", "당신", "그대", "자네", "그쪽", "여러분")):
            return True
    return False


def _neutralize_translated_person_perspective(
    original_ko: str, translated_en: str, warning_subject: str = "Scene auto-translation",
    force_first_second: bool = False,
) -> Tuple[str, List[str]]:
    """Neutralize only first/second-person perspective invented by translation.

    Korean scene descriptions often omit the grammatical subject. A translator
    may fill that gap with I/we/you even though the source never selected that
    point of view. If the Korean source contains any explicit first-person cue
    (나/저/우리/저희...) or explicit second-person cue (너/너희/당신...), that
    corresponding perspective is left untouched. Third-person wording such as
    그녀/그 남성/그들 is never targeted. Quoted screen text is protected verbatim.
    """
    warnings: List[str] = []
    if not translated_en:
        return translated_en, warnings

    source_has_first_person = (
        _contains_explicit_korean_first_singular(original_ko)
        or _contains_explicit_korean_first_plural(original_ko)
    )
    source_has_second_person = _contains_explicit_korean_second_person(original_ko)
    neutralize_first = force_first_second or not source_has_first_person
    neutralize_second = force_first_second or not source_has_second_person
    if not neutralize_first and not neutralize_second:
        return translated_en, warnings

    protected_values: List[str] = []
    masked_parts: List[str] = []
    for protected, part in _quoted_screen_text_spans(translated_en):
        if protected:
            token = f"H3PROTECTEDTEXT{len(protected_values)}TOKEN"
            protected_values.append(part)
            masked_parts.append(token)
        else:
            masked_parts.append(part)
    working_text = "".join(masked_parts)

    # Do not mistake the common country abbreviation ``US`` for the object
    # pronoun ``us`` when scanning translated scene text.
    def protect_literal(match: re.Match) -> str:
        token = f"H3PROTECTEDTEXT{len(protected_values)}TOKEN"
        protected_values.append(match.group(0))
        return token

    working_text = re.sub(r"\bUS\b", protect_literal, working_text)

    first_pattern = r"\b(?:I|me|my|mine|myself|we|us|our|ours|ourselves)\b|\bI[’'](?:m|ve|ll|d)\b|\bwe[’'](?:re|ve|ll|d)\b"
    second_pattern = r"\b(?:you|your|yours|yourself|yourselves)\b|\byou[’'](?:re|ve|ll|d)\b"
    has_invented_first = neutralize_first and bool(re.search(first_pattern, working_text, flags=re.IGNORECASE))
    has_invented_second = neutralize_second and bool(re.search(second_pattern, working_text, flags=re.IGNORECASE))
    if not has_invented_first and not has_invented_second:
        return translated_en, warnings

    def restore_protected(text: str) -> str:
        for index, value in enumerate(protected_values):
            text = text.replace(f"H3PROTECTEDTEXT{index}TOKEN", value)
        return text

    def neutralize_sentence(sentence: str) -> str:
        original = sentence.strip()
        if not original:
            return original
        converted = original
        started_with_invented_person = False

        if has_invented_first:
            started_with_invented_person = started_with_invented_person or bool(
                re.match(r"^(?:I|me|my|mine|myself|we|us|our|ours|ourselves)\b|^(?:I|we)[’']", converted, flags=re.IGNORECASE)
            )
            # Contractions first, then full auxiliary forms, then residual pronouns.
            for pattern, replacement in (
                (r"\bI[’']m\b", "they are"),
                (r"\bI[’']ve\b", "they have"),
                (r"\bI[’']ll\b", "they will"),
                (r"\bI[’']d\b", "they'd"),
                (r"\bwe[’']re\b", "they are"),
                (r"\bwe[’']ve\b", "they have"),
                (r"\bwe[’']ll\b", "they will"),
                (r"\bwe[’']d\b", "they'd"),
                (r"\bI\s+am\b", "they are"),
                (r"\bI\s+was\b", "they were"),
                (r"\bI\s+have\b", "they have"),
                (r"\bI\s+do\b", "they do"),
                (r"\bwe\s+are\b", "they are"),
                (r"\bwe\s+were\b", "they were"),
                (r"\bwe\s+have\b", "they have"),
                (r"\bwe\s+do\b", "they do"),
                (r"\bmyself\b", "themselves"),
                (r"\bourselves\b", "themselves"),
                (r"\bmine\b", "theirs"),
                (r"\bours\b", "theirs"),
                (r"\bmy\b", "their"),
                (r"\bour\b", "their"),
                (r"\bme\b", "them"),
                (r"\bus\b", "them"),
                (r"\bI\b", "they"),
                (r"\bwe\b", "they"),
            ):
                converted = re.sub(pattern, replacement, converted, flags=re.IGNORECASE)

        if has_invented_second:
            started_with_invented_person = started_with_invented_person or bool(
                re.match(r"^(?:you|your|yours|yourself|yourselves)\b|^you[’']", converted, flags=re.IGNORECASE)
            )
            for pattern, replacement in (
                (r"\byou[’']re\b", "they are"),
                (r"\byou[’']ve\b", "they have"),
                (r"\byou[’']ll\b", "they will"),
                (r"\byou[’']d\b", "they'd"),
                (r"\byou\s+are\b", "they are"),
                (r"\byou\s+were\b", "they were"),
                (r"\byou\s+have\b", "they have"),
                (r"\byou\s+do\b", "they do"),
                (r"\byourselves\b", "themselves"),
                (r"\byourself\b", "themselves"),
                (r"\byours\b", "theirs"),
                (r"\byour\b", "their"),
            ):
                converted = re.sub(pattern, replacement, converted, flags=re.IGNORECASE)

            # ``you`` is morphologically identical as subject and object.
            # Handle the high-confidence subject positions first, then treat
            # remaining occurrences as objects. This keeps neutralization
            # grammatical for both ``You walk`` and ``I look at you`` without
            # guessing the translated verb's inflection.
            converted = re.sub(
                r"\byou\s+(?=(?:can|could|will|would|shall|should|must|may|might)\b)",
                "they ", converted, flags=re.IGNORECASE,
            )
            converted = re.sub(r"^you\b", "they", converted, flags=re.IGNORECASE)
            converted = re.sub(
                r"(\b(?:and|but|while|as|when|if|because|although|though|then|after|before)\s+)you\b",
                lambda match: match.group(1) + "they",
                converted, flags=re.IGNORECASE,
            )
            converted = re.sub(r"\byou\b", "them", converted, flags=re.IGNORECASE)

        converted = re.sub(r"\s+", " ", converted).strip()
        if started_with_invented_person and converted:
            converted = converted[:1].upper() + converted[1:]
        return converted

    # Keep punctuation with each sentence while neutralizing only unquoted text.
    parts = re.split(r"(?<=[.!?])\s+", working_text.strip())
    rebuilt_parts: List[str] = []
    changed = False
    for part in parts:
        converted = neutralize_sentence(part)
        changed = changed or converted != part.strip()
        rebuilt_parts.append(converted)

    rebuilt = re.sub(r"\s+", " ", " ".join(filter(None, rebuilt_parts))).strip()
    if not changed or not rebuilt:
        return translated_en, warnings

    labels: List[str] = []
    if has_invented_first:
        labels.append("first-person")
    if has_invented_second:
        labels.append("second-person")
    if force_first_second:
        warnings.append(
            warning_subject + " normalized " + " and ".join(labels)
            + " wording to the selected Timeline target so the action keeps one clear performer."
        )
    else:
        warnings.append(
            warning_subject + " introduced " + " and ".join(labels)
            + " wording not explicitly present in the Korean source; only that invented perspective was neutralized."
        )
    return restore_protected(rebuilt), warnings

def _harmonize_known_single_person_pronouns(
    translated_en: str,
    gender: str,
    *,
    warning_subject: str,
) -> Tuple[str, List[str]]:
    """Repair only clear opposite-gender pronoun drift from translation.

    The selected Timeline target and Person profile can make a single actor's
    gender unambiguous, while Google may still emit the opposite binary pronoun
    in a later sentence.  Correct only those mechanically certain mismatches.
    Singular ``they/their`` is left untouched because changing it would also
    require rewriting coordinated verb agreement and could damage otherwise
    valid translator prose. Quoted text is preserved verbatim.
    """
    gender = str(gender or "").lower()
    if gender not in {"female", "male"} or not translated_en:
        return translated_en, []

    changed = False
    rebuilt: List[str] = []
    for protected, part in _quoted_screen_text_spans(translated_en):
        if protected or not part:
            rebuilt.append(part)
            continue
        out = part
        before = out
        if gender == "female":
            out = re.sub(r"(?i)\bhe\b", lambda m: "She" if m.group(0)[:1].isupper() else "she", out)
            out = re.sub(r"(?i)\bhis\b", lambda m: "Her" if m.group(0)[:1].isupper() else "her", out)
            out = re.sub(r"(?i)\bhimself\b", lambda m: "Herself" if m.group(0)[:1].isupper() else "herself", out)
        else:
            out = re.sub(r"(?i)\bshe\b", lambda m: "He" if m.group(0)[:1].isupper() else "he", out)
            out = re.sub(r"(?i)\bhers\b", lambda m: "His" if m.group(0)[:1].isupper() else "his", out)
            out = re.sub(r"(?i)\bherself\b", lambda m: "Himself" if m.group(0)[:1].isupper() else "himself", out)
        if out != before:
            changed = True
        rebuilt.append(out)

    result = "".join(rebuilt)
    if not changed:
        return translated_en, []
    return result, [
        f"{warning_subject} corrected a clear opposite-gender pronoun introduced by machine translation."
    ]

def _translate_scene_prompt_if_needed(text: str, translate_mode: str) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    text = (text or "").strip()
    if not text or translate_mode == "off":
        return text, warnings
    if translate_mode not in SCENE_TRANSLATE_VALUES:
        raise _UserInputError(f"Unsupported scene_translate: {translate_mode}")
    if not _contains_hangul(text):
        warnings.append("scene_translate was enabled but scene_prompt already appears non-Korean; no translation request was made.")
        return text, warnings

    # Legacy cut/shot separators are rejected by the public Timeline compiler
    # before this helper is called, so this function translates one shared
    # scene_prompt only. Keep explicit UI character references stable in the
    # scene path so ``인물 1/2/3`` cannot drift to Person 1/Figure 1.
    translation_source = _stabilize_korean_person_references_for_translation(text)
    translated, route, _ = _translate_structural_person_text(translation_source)
    routes_used: List[str] = [route] if route else []

    out = translated.strip()
    out = _flatten_scene_translation_for_prompt(out)
    out, post_warnings = _neutralize_translated_person_perspective(text, out)
    warnings.extend(post_warnings)
    if not out:
        raise _TranslationUnavailableError("scene_translate produced an empty translation for scene_prompt.")
    route_note = ", ".join(routes_used) if routes_used else "Google translation"
    warnings.append(f"scene_prompt was translated from Korean to English using {route_note}. Multiline input was flattened into one prompt line with normalized spacing.")
    return out, warnings


_KOREAN_PERSON_REFERENCE_RE = re.compile(
    r"인물\s*([123ABC])(?:번)?(?![0-9A-Za-z])"
    r"(?P<particle>에게서|한테서|으로부터|로부터|에게|한테|께서|께|에서|부터|까지|으로|이랑|하고|[로랑이가은는을를와과의에도만])?",
    re.IGNORECASE,
)
_KOREAN_REFLEXIVE_REFERENCE_RE = re.compile(
    r"(?<![가-힣A-Za-z0-9_])(?:자기\s*자신|자신|본인)"
    r"(?P<particle>에게서|한테서|으로부터|로부터|에게|한테|께서|께|에서|부터|까지|으로|이랑|하고|[로랑이가은는을를와과의에도만])?"
)

_KOREAN_PERSON_PARTICLE_CANONICAL = {
    "이": "가",
    "가": "가",
    "은": "는",
    "는": "는",
    "을": "를",
    "를": "를",
    "와": "와",
    "과": "와",
    "의": "의",
    "에게": "에게",
    "한테": "에게",
    "에게서": "에게서",
    "한테서": "에게서",
    "으로부터": "으로부터",
    "에서": "에서",
    "에": "에",
    "도": "도",
    "만": "만",
    "부터": "부터",
    "까지": "까지",
    "으로": "으로",
    "로": "으로",
    "로부터": "으로부터",
    "께서": "가",
    "께": "에게",
    "이랑": "와",
    "랑": "와",
    "하고": "와",
    "": "",
}


def _stabilize_korean_person_references_for_translation(text: str, *, reflexive_slot: str = "") -> str:
    """Keep structural person references stable across Korean→English translation.

    Only explicit UI labels (``인물 1/2/3``) and, for a single-person Timeline
    action, Korean reflexive references such as ``자신이/자신의`` are
    normalized. Ordinary nouns, verbs, objects, clothing, places, and emotions
    remain untouched for the translator. Double-quoted on-screen text is also
    left byte-for-byte unchanged so the existing screen-text protection keeps
    its original contract.
    """
    raw = text or ""
    if not raw:
        return raw

    def stabilize_segment(segment: str) -> str:
        if not segment:
            return segment

        def repl(match: re.Match) -> str:
            raw_slot = match.group(1).upper()
            slot = {"1": "A", "2": "B", "3": "C"}.get(raw_slot, raw_slot)
            if slot not in ("A", "B", "C"):
                return match.group(0)
            particle = _KOREAN_PERSON_PARTICLE_CANONICAL.get(
                match.group("particle") or "", match.group("particle") or ""
            )
            return f"Person {slot}{particle}"

        first_reflexive = _KOREAN_REFLEXIVE_REFERENCE_RE.search(segment)
        # A preceding explicit Person N can establish a different local subject,
        # so do not guess the reflexive's owner in that case. This keeps the rule
        # conservative while still stabilizing ordinary omitted-subject Timeline
        # actions such as "자신의 옷을 내려다본다".
        allow_reflexive = bool(
            reflexive_slot in ("A", "B", "C")
            and first_reflexive
            and not _KOREAN_PERSON_REFERENCE_RE.search(segment[:first_reflexive.start()])
        )

        out = _KOREAN_PERSON_REFERENCE_RE.sub(repl, segment)
        if allow_reflexive:
            def repl_reflexive(match: re.Match) -> str:
                particle = _KOREAN_PERSON_PARTICLE_CANONICAL.get(
                    match.group("particle") or "", match.group("particle") or ""
                )
                return f"Person {reflexive_slot}{particle}"
            out = _KOREAN_REFLEXIVE_REFERENCE_RE.sub(repl_reflexive, out)
        return out

    return "".join(
        part if protected else stabilize_segment(part)
        for protected, part in _quoted_screen_text_spans(raw)
    )


def _leading_stabilized_person_reference(text: str) -> str:
    """Return a leading structural Person A/B/C from mixed Korean/English text.

    ``_stabilize_korean_person_references_for_translation`` intentionally keeps
    Korean particles attached to the canonical Person label.  This helper only
    decides whether the user explicitly started the action with a Person label;
    it does not inspect or classify ordinary action vocabulary.
    """
    match = re.match(r"(?i)^\s*Person\s+([ABC])(?=$|[^A-Za-z0-9_])", text or "")
    return match.group(1).upper() if match else ""


_TRANSLATION_PERSON_TOKEN = {
    "A": "ZXQH3PERSONAQXZ",
    "B": "ZXQH3PERSONBQXZ",
    "C": "ZXQH3PERSONCQXZ",
}
_TRANSLATION_ACTOR_TOKEN = {
    "A": "ZXQH3ACTORAQXZ",
    "B": "ZXQH3ACTORBQXZ",
    "C": "ZXQH3ACTORCQXZ",
}


def _translation_gender_hint(slot: str, person_gender_by_slot: Optional[dict]) -> str:
    gender = str((person_gender_by_slot or {}).get(slot, "") or "").lower()
    if gender == "female":
        return " (female person)"
    if gender == "male":
        return " (male person)"
    return ""


def _tokenize_person_references_for_translation(
    stabilized_text: str,
    *,
    actor_slot: str = "",
    person_gender_by_slot: Optional[dict] = None,
) -> Tuple[str, str]:
    """Protect structural Person IDs from the external translator.

    The selected single-person Timeline performer receives a distinct opaque
    ACTOR token, while every other Person A/B/C reference receives an opaque
    PERSON token.  Google is still free to translate every ordinary noun, verb,
    object, place, clothing term, modifier, and emotion.  Only the node-owned
    structural identities are kept outside that vocabulary translation.

    Returns ``(translation_source, actor_token)``.  ``actor_token`` is empty
    when no Timeline actor anchor was requested.
    """
    raw = stabilized_text or ""
    actor_slot = (actor_slot or "").upper()
    if actor_slot not in ("A", "B", "C"):
        actor_slot = ""

    explicit_leading = _leading_stabilized_person_reference(raw)
    # For Korean single-person Timeline actions the Turn selector is the
    # authoritative performer. Other explicit Person references stay protected
    # as referenced characters instead of being allowed to steal that role.
    use_actor_anchor = bool(actor_slot)
    actor_token = _TRANSLATION_ACTOR_TOKEN[actor_slot] if use_actor_anchor else ""

    first_actor_replaced = False

    def protect_segment(segment: str) -> str:
        nonlocal first_actor_replaced
        if not segment:
            return segment

        def repl(match: re.Match) -> str:
            nonlocal first_actor_replaced
            slot = match.group(1).upper()
            if use_actor_anchor and slot == actor_slot and not first_actor_replaced and explicit_leading == actor_slot:
                first_actor_replaced = True
                return actor_token + _translation_gender_hint(slot, person_gender_by_slot)
            return _TRANSLATION_PERSON_TOKEN[slot] + _translation_gender_hint(slot, person_gender_by_slot)

        return re.sub(r"(?i)\bPerson\s+([ABC])(?![A-Za-z0-9_])", repl, segment)

    protected = "".join(
        part if quoted else protect_segment(part)
        for quoted, part in _quoted_screen_text_spans(raw)
    )

    if use_actor_anchor and not first_actor_replaced:
        # Korean topic particle supplies an explicit grammatical performer to
        # the translation request. The opaque token, not ordinary vocabulary,
        # carries the actor identity through the external service.
        protected = f"{actor_token}{_translation_gender_hint(actor_slot, person_gender_by_slot)}는 {protected}"
    return protected, actor_token


def _restore_person_translation_tokens(text: str) -> str:
    """Restore opaque translation-only Person/Actor tokens to Person A/B/C."""
    out = text or ""
    all_tokens = []
    for slot in ("A", "B", "C"):
        all_tokens.append((_TRANSLATION_ACTOR_TOKEN[slot], slot))
        all_tokens.append((_TRANSLATION_PERSON_TOKEN[slot], slot))

    # Google may retain, drop, or lightly move the parenthetical gender hint.
    # Remove it only when it is adjacent to one of our opaque tokens.
    for token, slot in all_tokens:
        esc = re.escape(token)
        out = re.sub(
            rf"(?i)({esc})\s*\(\s*(?:female|male)(?:\s+person)?\s*\)",
            token,
            out,
        )
        out = re.sub(
            rf"(?i)\(\s*(?:female|male)(?:\s+person)?\s*\)\s*({esc})",
            token,
            out,
        )
        out = re.sub(esc, f"Person {slot}", out, flags=re.I)
    return out


def _strip_translation_token_gender_hints(text: str) -> str:
    out = text or ""
    for token in tuple(_TRANSLATION_ACTOR_TOKEN.values()) + tuple(_TRANSLATION_PERSON_TOKEN.values()):
        esc = re.escape(token)
        out = re.sub(
            rf"(?i)({esc})\s*\(\s*(?:female|male)(?:\s+person)?\s*\)",
            token, out,
        )
        out = re.sub(
            rf"(?i)\(\s*(?:female|male)(?:\s+person)?\s*\)\s*({esc})",
            token, out,
        )
    return out


def _actor_token_survived_translation(text: str, actor_token: str) -> bool:
    return bool(actor_token and re.search(re.escape(actor_token), text or "", flags=re.I))


def _front_actor_token_after_intro(text: str, actor_token: str) -> str:
    """Move a translated ACTOR token ahead of one fronted introductory clause.

    This is structural rather than lexical.  For example both
    ``From far behind, ACTOR ...`` and ``After PERSON A moves, ACTOR ...`` become
    ``ACTOR, from far behind, ...`` / ``ACTOR, after PERSON A moves, ...``.
    No word list is consulted and a referenced Person inside the introduction
    is preserved rather than treated as a reason to reject the translation.
    """
    raw = (text or "").strip()
    if not raw or not actor_token:
        return raw
    esc = re.escape(actor_token)
    if re.match(rf"(?i)^{esc}(?=$|[^A-Za-z0-9_])", raw):
        return raw

    match = re.match(rf"(?is)^([^.!?]{{1,240}}?)([,;:])\s*({esc})(?=$|[^A-Za-z0-9_])\s*(.*)$", raw)
    if not match:
        return raw
    intro = match.group(1).strip()
    rest = match.group(4).strip()
    if not intro:
        return raw
    # Lowercase only an ordinary leading ASCII capital created by sentence
    # position; Person/quoted/non-ASCII content remains untouched.
    if re.match(r"^[A-Z][a-z]", intro) and not re.match(r"(?i)^Person\s+[ABC]\b", intro):
        intro = intro[:1].lower() + intro[1:]
    return f"{actor_token}, {intro}, {rest}".strip().rstrip(', ')


def _translate_structural_person_text(
    stabilized_source: str,
    *,
    person_gender_by_slot: Optional[dict] = None,
    actor_slot: str = "",
) -> Tuple[str, str, bool]:
    """Translate text while preserving node-owned Person identities.

    Returns ``(restored_translation, route, actor_survived)``.  The caller can
    fall back to an earlier usable translation if an external service ever
    removes the opaque ACTOR token; ordinary translation content is never
    reconstructed by local dictionaries.
    """
    source, actor_token = _tokenize_person_references_for_translation(
        stabilized_source,
        actor_slot=actor_slot,
        person_gender_by_slot=person_gender_by_slot,
    )
    translated, route = _translate_piece_preserving_screen_text(source)
    translated = _strip_translation_token_gender_hints(translated)
    actor_survived = _actor_token_survived_translation(translated, actor_token)
    if actor_survived:
        translated = _front_actor_token_after_intro(translated, actor_token)
    restored = _restore_person_translation_tokens(translated)
    restored = _normalize_scene_whitespace_preserving_quotes(restored, flatten_newlines=True)
    return restored, route, actor_survived

def _translate_korean_descriptive_text_if_needed(
    text: str, field_name: str, *, action_target_count: int = 0,
    action_target_slots: Sequence[str] = (), person_gender_by_slot: Optional[dict] = None,
    translate_mode: str = "ko_to_en",
) -> Tuple[str, List[str]]:
    """Translate Korean non-dialogue descriptive text to English for H3 body use.

    Dialogue is deliberately excluded. Structural Person A/B/C references are
    protected with opaque translation-only tokens. For one-person Timeline
    actions, the selected Turn person is supplied as an explicit grammatical
    ACTOR before translation unless the first translation is clearly an
    independent camera/scene clause or the user explicitly started with a
    conflicting Person. This avoids accumulating phrase-by-phrase acceptance
    heuristics while leaving ordinary vocabulary entirely to the translator.
    """
    warnings: List[str] = []
    text = (text or "").strip()
    if translate_mode not in SCENE_TRANSLATE_VALUES:
        raise _UserInputError(f"Unsupported scene_translate: {translate_mode}")
    if not text or translate_mode == "off" or not _contains_hangul(text):
        return text, warnings

    reflexive_slot = action_target_slots[0] if len(action_target_slots) == 1 else ""
    stabilized_source = _stabilize_korean_person_references_for_translation(
        text, reflexive_slot=reflexive_slot
    )

    # First pass keeps explicit Person references stable but does not impose a
    # Timeline actor. It is authoritative for genuine camera/scene clauses and
    # remains a safe fallback if the actor-anchored external request fails.
    first_out, first_route, _ = _translate_structural_person_text(
        stabilized_source,
        person_gender_by_slot=person_gender_by_slot,
    )
    out = first_out
    route = first_route

    if action_target_count == 1 and len(action_target_slots) == 1:
        target_slot = str(action_target_slots[0] or "").upper()
        # Normal independent scene/camera clauses retain the first translation.
        # Every other Korean single-person action receives the selected Turn
        # actor before translation. This makes the selector authoritative even
        # when another Person appears earlier inside a subordinate/context clause.
        starts_with_fronted_preposition = bool(re.match(r"(?i)^\s*(?:from|at)\b", first_out or ""))
        should_anchor = bool(
            target_slot in ("A", "B", "C")
            and (
                starts_with_fronted_preposition
                or not _action_starts_with_independent_subject(first_out)
            )
        )
        if should_anchor:
            try:
                anchored_out, anchored_route, actor_survived = _translate_structural_person_text(
                    stabilized_source,
                    person_gender_by_slot=person_gender_by_slot,
                    actor_slot=target_slot,
                )
                if anchored_out and actor_survived:
                    out = anchored_out
                    route = anchored_route
                    warnings.append(
                        f"{field_name} auto-translation structurally anchored Person {target_slot} as the selected Timeline action subject."
                    )
            except _TranslationUnavailableError:
                # Keep the first usable translation only when the second external
                # translation request itself is unavailable. Programming errors
                # must remain visible instead of being mistaken for a network fallback.
                pass

    out, perspective_warnings = _neutralize_translated_person_perspective(
        text, out, warning_subject=f"{field_name} auto-translation",
        force_first_second=action_target_count > 0,
    )
    warnings.extend(perspective_warnings)
    if action_target_count == 1 and perspective_warnings and re.match(r"(?i)^they\b", out):
        out = re.sub(r"(?i)^they\b", "The visible subject is shown while they", out, count=1)
    if not out:
        raise _TranslationUnavailableError(f"Korean→English auto-translation produced an empty result for {field_name}.")
    if re.search(r"(?i)ZXQH3(?:ACTOR|PERSON)[ABC]QXZ", out):
        raise _TranslationUnavailableError(f"Translation-only Person token leaked into {field_name}.")
    warnings.append(f"{field_name} was translated from Korean to English using {route}.")
    return out, warnings

def _merge_profile_detail_text(preset_value: str, preset_map: dict, custom_text: str) -> str:
    preset_text = (preset_map.get(preset_value, "") or "").strip()
    custom_text = (custom_text or "").strip()
    if preset_text and custom_text:
        # The translated free-text detail is appended inside an existing profile
        # phrase (for example: ``with a slim build, ...``). Google can return a
        # sentence-initial article such as ``A natural, modern look ...``; keep
        # the wording intact but normalize only that article for mid-phrase use.
        # Requiring following whitespace deliberately leaves terms such as
        # ``A-line skirt`` and all proper names/structural Person labels untouched.
        custom_text = re.sub(
            r"^(A|An|The)(?=\s)",
            lambda match: match.group(1).lower(),
            custom_text,
            count=1,
        )
        return f"{preset_text}, {custom_text}"
    return preset_text or custom_text


def _clean_voice_desc_for_subject(value: Any) -> str:
    """Normalize a user voice description only for grammatical subject insertion.

    Keep the user's semantic wording, but remove UI-like prefixes and trailing
    sentence punctuation that would otherwise split ``Person A ... (S1) says``
    into malformed fragments.
    """
    voice = str(value or "").strip()
    if not voice:
        return ""
    voice = re.sub(r"(?i)^\s*(?:voice\s+characteristics?|voice\s+characteristic)\s*:\s*", "", voice).strip()
    voice = re.sub(r"(?i)^\s*with\s+", "", voice).strip()
    voice = voice.rstrip(" \t\r\n.;,:!")
    return voice.strip()


def _profile_fragment(
    label: str,
    gender: str,
    age: str,
    *,
    appearance_desc: str = "",
    clothing_desc: str = "",
    voice_desc: str = "",
    include_visual: bool = False,
    include_voice: bool = False,
    compact_identity: bool = False,
) -> str:
    """Render a natural English character phrase for MiniMax H3.

    Age buckets become natural English wording. Optional appearance/clothing are
    introduced only on the character's first real timeline appearance so they
    stay attached to Person A/B/C without bloating every later event. Voice is
    still introduced only with the first spoken line/S-ID. After a character
    has already been established, ``compact_identity`` keeps later Timeline
    events focused on Person A/B/C instead of repeating age/gender metadata.
    """
    if compact_identity:
        subject = f"Person {label}"
    elif age == "unspecified":
        noun = {
            "female": "a woman",
            "male": "a man",
            "nonbinary": "a non-binary person",
            "unspecified": "",
        }[gender]
        subject = f"Person {label}, {noun}" if noun else f"Person {label}"
    elif age == "child":
        noun = {
            "female": "a girl",
            "male": "a boy",
            "nonbinary": "a non-binary child",
            "unspecified": "a child",
        }[gender]
        subject = f"Person {label}, {noun}"
    elif age == "teen":
        noun = {
            "female": "a teenage girl",
            "male": "a teenage boy",
            "nonbinary": "a non-binary teenager",
            "unspecified": "a teenager",
        }[gender]
        subject = f"Person {label}, {noun}"
    elif age == "elderly":
        noun = {
            "female": "an elderly woman",
            "male": "an elderly man",
            "nonbinary": "an elderly non-binary person",
            "unspecified": "an elderly person",
        }[gender]
        subject = f"Person {label}, {noun}"
    else:
        decade = {
            "twenties": "twenties",
            "thirties": "thirties",
            "forties": "forties",
            "fifties": "fifties",
            "sixties": "sixties",
        }[age]
        if gender == "female":
            lead = "a young woman" if age == "twenties" else "a woman"
            subject = f"Person {label}, {lead} in her {decade}"
        elif gender == "male":
            lead = "a young man" if age == "twenties" else "a man"
            subject = f"Person {label}, {lead} in his {decade}"
        elif gender == "nonbinary":
            lead = "a non-binary young adult" if age == "twenties" else "a non-binary person"
            subject = f"Person {label}, {lead} in their {decade}"
        else:
            lead = "a young adult" if age == "twenties" else "a person"
            subject = f"Person {label}, {lead} in their {decade}"

    if include_visual and not compact_identity:
        appearance = (appearance_desc or "").strip()
        clothing = (clothing_desc or "").strip()
        if appearance:
            appearance = re.sub(r"(?i)^(?:with|having)\s+", "", appearance).strip().rstrip(" .;,:!")
            if appearance:
                subject += f", with {appearance}"
        if clothing:
            clothing = re.sub(r"(?i)^(?:wearing|dressed\s+in)\s+", "", clothing).strip().rstrip(" .;,:!")
            if clothing:
                subject += f", wearing {clothing}"

    if include_voice and str(voice_desc or "").strip():
        voice = _clean_voice_desc_for_subject(voice_desc)
        if voice:
            if _contains_non_english_body_script(voice):
                subject += f" with voice characteristics: {voice}"
            else:
                voice = re.sub(r"^(?:a|an)\s+", "", voice, flags=re.I)
                if voice and voice[:1].isupper() and not re.match(r"^[A-Z]{2,}(?:\b|$)", voice):
                    voice = voice[:1].lower() + voice[1:]
                article = "an" if voice[:1].lower() in "aeiou" else "a"
                subject += f" with {article} {voice}"
    return subject

def _speaker_slots(selection: str) -> Tuple[str, ...]:
    """Return the canonical A/B/C members of a single or combined Turn selection."""
    if selection not in TURN_SPEAKER_VALUES:
        raise _UserInputError(f"Unsupported turn speaker selection: {selection}")
    slots = tuple(selection.split("+"))
    if not slots or len(set(slots)) != len(slots) or any(slot not in ("A", "B", "C") for slot in slots):
        raise _UserInputError(f"Invalid turn speaker selection: {selection}")
    return slots


def _vocal_source_slots(source: str) -> Tuple[str, ...]:
    if source == "Narrator":
        return tuple()
    return _speaker_slots(source)


def _speaker_is_subset_of_target(source: str, target: str) -> bool:
    if source == "Narrator":
        return True
    return set(_speaker_slots(source)).issubset(set(_speaker_slots(target)))


def _coerce_speaker_selection_to_active(selection: str, person_count: int) -> str:
    """Repair a stale A/B/C selection to the currently active cast deterministically.

    Structured UI selectors remain authoritative, but hidden/stale workflow values
    should not block execution merely because person_count was reduced. Missing
    members collapse onto the last active Person while preserving order and
    de-duplicating the resulting group.
    """
    active = list(("A", "B", "C")[:max(1, min(3, int(person_count)))])
    raw_members = [part for part in str(selection or "A").split("+") if part in ("A", "B", "C")]
    if not raw_members:
        raw_members = [active[0]]
    fallback = active[-1]
    out: List[str] = []
    for member in raw_members:
        mapped = member if member in active else fallback
        if mapped not in out:
            out.append(mapped)
    return "+".join(out or [active[0]])


def _coerce_vocal_source_to_target(source: str, target: str, person_count: int) -> str:
    """Repair a stale Vocal speaker only against the active cast.

    The Progress target controls the action subject, not who may speak inside
    Continue-Speaking.  A valid Vocal 2/3 speaker therefore remains B or A+B
    even when the Progress action target is A.  Only speakers outside the
    current person_count are collapsed deterministically.
    """
    if source == "Narrator":
        return "Narrator"
    return _coerce_speaker_selection_to_active(source, person_count)


def _generic_human_slot_for_composite(match: _GenericHumanSubjectMatch, slots: Sequence[str], profiles: dict) -> str:
    """Resolve a leading 'the woman/man/person' to one selected Person when possible."""
    wanted_gender = ""
    noun = str(getattr(match, "noun", "") or "").lower()
    if noun in {"woman", "girl"}:
        wanted_gender = "female"
    elif noun in {"man", "boy"}:
        wanted_gender = "male"
    else:
        mods = {str(value).lower() for value in (getattr(match, "premodifiers", ()) or ())}
        if "female" in mods:
            wanted_gender = "female"
        elif "male" in mods:
            wanted_gender = "male"
    if wanted_gender:
        matches = [slot for slot in slots if str((profiles.get(slot) or {}).get("gender", "unspecified")) == wanted_gender]
        if len(matches) == 1:
            return matches[0]
    return str(slots[0])


def _pronoun_slot_for_composite(pronoun: str, slots: Sequence[str], profiles: dict) -> Tuple[str, bool]:
    """Bind leading He/She inside a composite Progress without inventing a new actor.

    Return ``(slot, exact_gender_match)``.  A unique configured gender match is
    authoritative.  If gender is ambiguous or unspecified, fall back to the first
    already-selected slot so malformed ``Person A and Person B He waves`` output
    can never escape while preserving deterministic execution.
    """
    wanted_gender = "male" if str(pronoun or "").lower() == "he" else "female"
    matches = [
        str(slot) for slot in slots
        if str((profiles.get(slot) or {}).get("gender", "unspecified")) == wanted_gender
    ]
    if len(matches) == 1:
        return matches[0], True
    return str(slots[0]), False


def _normalize_turn_vocal_events(turn: dict, person_count: int, preserve_verbatim: bool = True) -> List[dict]:
    """Return only real non-empty vocal events in stable UI slot order."""
    source_turn_index = int(turn.get("source_turn_index", turn.get("index", 1)))
    raw_target = _canonical_choice(turn.get("speaker", "A"), TURN_SPEAKER_VALUES, "turn_speaker")
    target = _coerce_speaker_selection_to_active(raw_target, person_count)
    soft_warnings = turn.setdefault("_soft_warnings", [])
    if target != raw_target:
        soft_warnings.append(
            f"Progress {source_turn_index}: target {raw_target} was outside person_count={person_count}; "
            f"it was repaired to {target} so prompt generation can continue."
        )
        turn["speaker"] = target
    active_slots = set(("A", "B", "C")[:int(person_count)])
    seq = turn.get("sequential_vocal") if isinstance(turn.get("sequential_vocal"), dict) else {}
    enabled = bool(seq.get("enabled"))
    raw_events: List[dict] = []
    if enabled:
        raw_events.append({
            "slot_index": 1,
            "speaker": str(seq.get("speaker_1") or target),
            "text": turn.get("dialogue_text", ""),
            "language": turn.get("dialogue_language", "auto"),
            "delivery": turn.get("dialogue_delivery", "on_screen"),
        })
        for slot_index in (2, 3):
            raw_events.append({
                "slot_index": slot_index,
                # Vocal 2/3 UI defaults to Person A independently of the Progress
                # action target. If the user leaves that visible default untouched,
                # no speaker key is stored in the compact extension state. Match the
                # UI default here instead of inheriting A+B/B/etc. from the action.
                "speaker": str(seq.get(f"speaker_{slot_index}") or SEQUENTIAL_VOCAL_ADDED_SLOT_DEFAULT_SPEAKER),
                "text": seq.get(f"text_{slot_index}", ""),
                "language": seq.get(f"language_{slot_index}", "auto"),
                "delivery": seq.get(f"delivery_{slot_index}", "on_screen"),
            })
    else:
        raw_events.append({
            "slot_index": 1,
            "speaker": target,
            "text": turn.get("dialogue_text", ""),
            "language": turn.get("dialogue_language", "auto"),
            "delivery": turn.get("dialogue_delivery", "on_screen"),
        })

    events: List[dict] = []
    for raw in raw_events:
        slot_index = int(raw["slot_index"])
        text = str(raw.get("text", "") or "")
        text = _clean_timeline_dialogue_verbatim(text, max_chars=4_000) if preserve_verbatim else _clean_text(text, max_chars=4_000, preserve_newlines=False)
        if not text.strip():
            continue
        source = str(raw.get("speaker") or target)
        if source not in SEQUENTIAL_VOCAL_SOURCES:
            original_source = source
            source = target
            soft_warnings.append(
                f"Progress {source_turn_index} Vocal {slot_index}: unsupported speaker {original_source!r} "
                f"was repaired to the Progress target {target}."
            )
        if source != "Narrator":
            repaired_source = _coerce_vocal_source_to_target(source, target, person_count)
            if repaired_source != source:
                soft_warnings.append(
                    f"Progress {source_turn_index} Vocal {slot_index}: speaker {source} was outside person_count={person_count}; "
                    f"it was repaired to {repaired_source} so prompt generation can continue."
                )
                source = repaired_source
        language = _canonical_choice(raw.get("language", "auto"), DIALOGUE_LANGUAGE_VALUES, "dialogue_language")
        delivery = _canonical_choice(raw.get("delivery", "on_screen"), DIALOGUE_DELIVERY_VALUES, "dialogue_delivery")
        if source == "Narrator":
            delivery = "narrator"
        _reject_reserved_timeline_structure(text, f"turn_{source_turn_index}_vocal_{slot_index}_dialogue_text")
        events.append({
            "event_id": f"T{source_turn_index}-V{slot_index}",
            "source_turn_index": source_turn_index,
            "slot_index": slot_index,
            "speaker": source,
            "text": text,
            "language": language,
            "delivery": delivery,
        })
    return events


def _turn_vocal_events(turn: dict) -> List[dict]:
    value = turn.get("vocal_events")
    if isinstance(value, list):
        return [event for event in value if isinstance(event, dict) and str(event.get("text", "") or "").strip()]
    if str(turn.get("dialogue_text", "") or "").strip():
        return [{
            "event_id": f"T{int(turn.get('source_turn_index', turn.get('index', 1)))}-V1",
            "source_turn_index": int(turn.get("source_turn_index", turn.get("index", 1))),
            "slot_index": 1,
            "speaker": turn.get("speaker", "A"),
            "text": turn.get("dialogue_text", ""),
            "language": turn.get("dialogue_language", "auto"),
            "delivery": turn.get("dialogue_delivery", "on_screen"),
        }]
    return []


def _turn_dialogue_texts(turn: dict) -> List[str]:
    return [str(event.get("text", "") or "") for event in _turn_vocal_events(turn)]


def _turn_uses_sequential_renderer(turn: dict) -> bool:
    """True only when sequential state changes the legacy one-dialogue semantics."""
    seq = turn.get("sequential_vocal") if isinstance(turn.get("sequential_vocal"), dict) else {}
    if not bool(seq.get("enabled")):
        return False
    events = _turn_vocal_events(turn)
    target = str(turn.get("speaker", "A") or "A")
    if len(events) > 1:
        return True
    if not events:
        return False
    event = events[0]
    return not (
        int(event.get("slot_index", 1) or 1) == 1
        and str(event.get("speaker", target) or target) == target
        and str(event.get("language", "auto") or "auto") == str(turn.get("dialogue_language", "auto") or "auto")
        and str(event.get("delivery", "on_screen") or "on_screen") == str(turn.get("dialogue_delivery", "on_screen") or "on_screen")
    )


def _turn_spoken_seconds(turn: dict, *, fast: bool = False) -> float:
    estimator = _estimate_fast_spoken_seconds if fast else _estimate_spoken_seconds
    return sum(estimator(text) for text in _turn_dialogue_texts(turn))


def _assign_timeline_speaker_ids(profiles: dict, turns: Sequence[dict], narrator_voice_desc: str = "") -> dict:
    """Assign stable H3 S-IDs from first actual vocal-event order, including Narrator."""
    assigned = {slot: dict(profile) for slot, profile in (profiles or {}).items()}
    for profile in assigned.values():
        profile['sid'] = None
    assigned["Narrator"] = {
        "sid": None, "gender": "unspecified", "age": "unspecified",
        "appearance_desc": "", "clothing_desc": "", "voice_desc": str(narrator_voice_desc or ""),
    }
    next_sid = 1
    for turn in turns or ():
        for event in _turn_vocal_events(turn):
            source = str(event.get("speaker", "A") or "A")
            members = ("Narrator",) if source == "Narrator" else _speaker_slots(source)
            for member in members:
                if member not in assigned:
                    raise ValueError(f"Unknown vocal speaker: {member}")
                if assigned[member].get('sid'):
                    continue
                if next_sid > 4:
                    raise ValueError("Timeline requires more than four H3 speaker IDs.")
                assigned[member]['sid'] = f"S{next_sid}"
                next_sid += 1
    return assigned


def _sid_number(sid: str) -> int:
    match = re.fullmatch(r"S([1-9][0-9]*)", sid or "")
    if not match:
        raise ValueError(f"Invalid or unassigned H3 speaker ID: {sid!r}")
    return int(match.group(1))


def _close_coordinated_profile_fragment(fragment: str) -> str:
    """Close an appositive Person profile before coordinating another subject."""
    fragment = (fragment or "").strip()
    if "," in fragment and not fragment.endswith(","):
        return fragment + ","
    return fragment


def _join_subject_fragments(parts: Sequence[str]) -> str:
    items = [part.strip() for part in parts if part and part.strip()]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    closed = [_close_coordinated_profile_fragment(item) for item in items[:-1]]
    if len(items) == 2:
        return f"{closed[0]} and {items[1]}"
    # Three-person composites need explicit list separators even when earlier
    # profile fragments already carry appositive commas. The old space-join
    # could emit malformed text such as ``Person A Person B and Person C``
    # after those people had already been introduced.
    list_heads = [item[:-1] if item.endswith(",") else item for item in closed]
    return f"{', '.join(list_heads)}, and {items[-1]}"


def _pluralize_compound_predicate_token(word: str) -> str:
    """Return the plural/base form for an obvious English finite verb token.

    This helper is intentionally conservative and is used only when the subject
    is compiler-generated and known to contain multiple people/subjects. It
    fixes mechanical agreement errors such as ``Person A and Person B walks``
    without rewriting arbitrary user prose.
    """
    lower = (word or "").lower()
    irregular = {"is": "are", "was": "were", "has": "have", "does": "do", "goes": "go"}
    base_s_exceptions = {"focus", "bias", "gas", "bus", "canvas", "alias"}
    if lower in irregular:
        base = irregular[lower]
    elif lower in base_s_exceptions or lower.endswith("ss"):
        return word
    elif lower.endswith("ies") and len(lower) > 3:
        base = lower[:-3] + "y"
    elif lower.endswith("tzes"):
        # Base forms ending in ``-tz`` take ``-es`` (waltz→waltzes,
        # blitz→blitzes, spritz→spritzes).  They must not follow the base-e
        # ``gaze→gazes`` rule below.
        base = lower[:-2]
    elif lower.endswith("zzes"):
        base = lower[:-2]
    elif lower.endswith("zes"):
        # ``gazes/freezes/seizes`` are base-e verbs plus ``s``; doubled-z
        # forms such as ``buzzes`` are handled above and remove ``es``.
        base = lower[:-1]
    elif lower.endswith(("ches", "shes", "xes", "sses", "oes")):
        base = lower[:-2]
    elif lower in {"focuses", "refocuses"}:
        base = lower[:-2]
    elif lower.endswith("s") and len(lower) > 2:
        base = lower[:-1]
    else:
        return word
    if word.isupper():
        return base.upper()
    if word[:1].isupper():
        return base[:1].upper() + base[1:]
    return base


_COMPOUND_ASPECTUAL_FINITE_FORMS = frozenset({
    # Small grammatical class only: these finite aspect/phase verbs are often
    # followed directly by an -ing participle.  Without this exception a
    # structural noun-phrase guard would misread ``starts walking`` as a plural
    # noun plus modifier.  This is deliberately not a general action whitelist.
    "starts", "begins", "continues", "keeps", "stops",
})

_COMPOUND_LINKING_FINITE_FORMS = frozenset({
    "is", "was", "becomes", "seems", "remains", "appears", "feels",
})

_COMPOUND_NOUN_MODIFIER_PREPOSITIONS = frozenset({"on", "off", "with", "without"})
_COMPOUND_RELATIONAL_NOUN_COORD_PREPOSITIONS = frozenset({
    # When a plain ``and`` follows one of these prepositional phrases, the next
    # plural-looking token may still be another object of the same preposition
    # (``looks at cars and buses``, ``waits for trains and buses``) rather than
    # a new predicate.  Keep this grammar-role set broad instead of growing a
    # verb/noun whitelist.
    "at", "in", "on", "into", "onto", "around", "near", "beside", "behind",
    "under", "over", "through", "across", "toward", "towards", "inside", "outside",
    "from", "for", "with", "without", "between", "among", "by", "of", "off",
    "during", "throughout", "within",
})
_COMPOUND_RECIPROCAL_RE = re.compile(r"(?i)\b(?:each other|one another)\b")
_COMPOUND_DIRECTION_WORDS = frozenset({
    "forward", "back", "backward", "away", "home", "inside", "outside",
    "up", "down", "closer", "apart", "together", "upright", "low",
})
_COMPOUND_DETERMINERS = frozenset({
    "a", "an", "the", "this", "that", "these", "those", "my", "your",
    "his", "her", "its", "our", "their", "one", "two", "three", "another",
    "each", "every", "some", "any", "no",
})
_COMPOUND_PREPOSITIONS = frozenset({
    "at", "in", "on", "into", "onto", "around", "near", "beside", "behind",
    "under", "over", "through", "across", "toward", "towards", "inside", "outside", "from", "for",
    "with", "without", "between", "among", "by", "of", "off", "during", "throughout", "within",
})
_COMPOUND_HIGH_CONFIDENCE_BARE_PREDICATES = frozenset({
    # A plain ``and`` after an object is grammatically ambiguous without a full
    # parser (``the camera and lenses`` vs. ``the camera and nods``).  Preserve
    # nouns by default and recognize only a very small class of common,
    # self-contained action predicates when no other clause evidence exists.
    # This is deliberately not a general verb whitelist.
    "smiles", "nods", "waves", "laughs", "blinks", "reacts", "responds",
    "pauses", "bows",
})

_COMPOUND_COORDINATOR_RE = re.compile(
    r"(?i)(,\s*(?:and\s+)?then\s+|,\s+and\s+|\band\s+then\s+|\bthen\s+|\band\s+|,\s+)"
)
_COMPOUND_WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")


def _compound_first_word_and_tail(segment: str) -> Tuple[str, str]:
    match = _COMPOUND_WORD_RE.search(str(segment or ""))
    if not match:
        return "", ""
    return match.group(0), str(segment or "")[match.end():]


def _compound_next_word(tail: str) -> str:
    match = _COMPOUND_WORD_RE.search(str(tail or ""))
    return match.group(0).lower() if match else ""


def _compound_tail_starts_participial_modifier(tail: str) -> bool:
    next_word = _compound_next_word(tail)
    if not next_word:
        return False
    # Relation/preposition words can themselves end in ``-ing`` (notably
    # ``during``).  They introduce a complement rather than a participial noun
    # modifier, so never let spelling alone classify them as ``hands touching``-
    # style shorthand. ``inside``/``outside`` are included because they can be
    # prepositional when an object follows (``inside shops``).
    if next_word in _COMPOUND_PREPOSITIONS or next_word in {"inside", "outside"}:
        return False
    # ``raised/crossed/closed`` and productive -ing modifiers are the common
    # shorthand form behind the noun regression (``hands raised``, ``eyes
    # closed``, ``shoulders touching``).  Aspect/phase verbs are handled by the
    # caller before applying this guard.
    return bool(
        next_word.endswith("ing")
        or next_word.endswith("ed")
        or next_word in {"shown", "seen", "held", "kept", "left", "set", "lit", "worn", "drawn", "bent", "shut"}
    )


def _compound_segment_has_object_like_tail(segment: str) -> bool:
    """Return whether a predicate segment visibly contains a direct-object-like tail.

    This is structural evidence only.  It is used to distinguish ``carry bags
    and boxes`` from ``walk and remain`` without maintaining a vocabulary list
    of verbs or nouns.
    """
    word, tail = _compound_first_word_and_tail(segment)
    if not word:
        return False
    next_word = _compound_next_word(tail)
    if not next_word:
        return False
    if word.lower() in _COMPOUND_LINKING_FINITE_FORMS:
        return False
    if word.lower() in _COMPOUND_ASPECTUAL_FINITE_FORMS and next_word.endswith("ing"):
        return False
    if next_word in _COMPOUND_DETERMINERS:
        return True
    if next_word in _COMPOUND_DIRECTION_WORDS or next_word.endswith("ly"):
        return False
    if next_word in _COMPOUND_PREPOSITIONS:
        return False
    if next_word in {"not", "never", "again", "still", "then"}:
        return False
    # A bare lexical token after the predicate head is normally an object or
    # complement (``carry bags``, ``watch bucks``).  That is enough to protect a
    # following coordinated plural noun from agreement rewriting.
    return True


def _compound_segment_has_relational_object_tail(segment: str) -> bool:
    """Return strong evidence that a plain ``and`` may continue a PP noun list."""
    _word, tail = _compound_first_word_and_tail(segment)
    prep = _compound_next_word(tail)
    if prep not in _COMPOUND_RELATIONAL_NOUN_COORD_PREPOSITIONS:
        return False
    if _COMPOUND_RECIPROCAL_RE.search(tail or ""):
        return False
    # Require an actual object after the preposition; ``moves around`` alone is
    # not enough evidence to protect a following token as a coordinated noun.
    words = _COMPOUND_WORD_RE.findall(tail or "")
    return len(words) >= 2


def _compound_previous_object_is_determined_singular(segment: str) -> bool:
    """Return narrow structural evidence that a completed object precedes ``and``.

    ``looks at the camera and nods`` and ``opens the door and smiles`` are
    ordinary predicate coordination, while ``looks at cars and buses`` and
    ``carry bags and boxes`` are ordinary noun coordination.  A determiner plus
    a singular-looking completed object is useful evidence for the first shape
    without introducing a verb/noun vocabulary.  Plural-looking objects remain
    protected as potential noun lists.
    """
    _word, tail = _compound_first_word_and_tail(segment)
    words = [token.lower() for token in _COMPOUND_WORD_RE.findall(tail or "")]
    if not words:
        return False
    if words[0] in _COMPOUND_PREPOSITIONS:
        words = words[1:]
    if not words or words[0] not in _COMPOUND_DETERMINERS:
        return False
    # Drop the determiner itself; the final lexical token is a conservative
    # approximation of the completed object's head (``the red camera``→camera).
    object_words = words[1:]
    if not object_words:
        return False
    head = object_words[-1]
    # Plural-looking heads keep noun-list protection (``the cars and buses``).
    return not head.endswith("s")


def _compound_followup_has_strong_predicate_shape(word: str, tail: str, connector: str) -> bool:
    """Return structural evidence strong enough to override noun-list protection."""
    lower = str(word or "").lower()
    next_word = _compound_next_word(tail)
    connector_lower = str(connector or "").lower()
    if "then" in connector_lower or connector_lower.lstrip().startswith(", and"):
        return True
    if lower in _COMPOUND_ASPECTUAL_FINITE_FORMS and next_word.endswith("ing"):
        return True
    if _COMPOUND_RECIPROCAL_RE.search(tail or ""):
        return True
    if next_word in _COMPOUND_DETERMINERS:
        return True
    if next_word in {"it", "them", "him", "her", "me", "us", "you"}:
        return True
    if next_word in _COMPOUND_DIRECTION_WORDS or next_word.endswith("ly"):
        return True
    if next_word in {"toward", "towards", "for", "into", "onto"}:
        return True
    # ``turns around`` is a compact directional predicate whose complement is
    # not otherwise in the direction-word set. Keep this idiom narrow so
    # ordinary noun phrases using ``around`` remain protected.
    if lower == "turns" and next_word == "around":
        return True
    if not next_word and lower in _COMPOUND_HIGH_CONFIDENCE_BARE_PREDICATES:
        return True
    return False


def _compound_leading_token_is_noun_phrase(word: str, tail: str) -> bool:
    """Detect strong noun/participle shorthand before touching the first token."""
    lower = str(word or "").lower()
    if _pluralize_compound_predicate_token(word) == word:
        return False
    next_word = _compound_next_word(tail)
    if lower in _COMPOUND_ASPECTUAL_FINITE_FORMS or lower in _COMPOUND_LINKING_FINITE_FORMS or lower in {"has", "does", "goes"}:
        # Finite linking/aspect verbs remain predicates even when followed by a
        # participle/adjective (``is smiling`` -> ``are smiling`` for a bound
        # multi-person subject).  Treating ``is + -ing`` as noun shorthand
        # creates a direct subject/verb agreement error.
        return False
    if _compound_tail_starts_participial_modifier(tail):
        # ``left`` is both a participle (``doors left open``) and a direction
        # adverb (``looks left``).  Preserve the participle by default, but an
        # already-recognized action predicate makes the directional reading
        # unambiguous enough to repair compound-subject agreement.
        if not (next_word == "left" and _looks_like_bare_action_predicate(word)):
            return True
    # A preposition alone is not enough to classify the head as a noun.  In a
    # Timeline action field, ordinary predicates such as ``sits on ...`` and
    # ``walks with ...`` must still agree with a compound subject.  Keep only a
    # narrow static face-worn noun shape (for example ``glasses on their faces``)
    # that was a proven noun-regression case; stronger noun/participle shorthand
    # is already handled above.  This avoids turning the rule into a growing
    # action-verb whitelist while not mistaking ``passes on ...`` for a noun.
    if (
        next_word == "on"
        and lower.endswith("sses")
        and re.match(r"(?i)^\s+on\s+(?:his|her|their)\s+(?:face|faces|head|heads)\b", tail or "")
        and not _COMPOUND_RECIPROCAL_RE.search(tail or "")
    ):
        return True
    return False


def _compound_followup_should_stay_noun(
    word: str,
    segment_tail: str,
    *,
    previous_segment: str,
    connector: str,
    noun_sequence: bool,
) -> bool:
    """Protect coordinated noun/list items; rewrite only clear predicates.

    A plain ``and`` after an object is inherently ambiguous without lexical
    parsing.  The safety rule is therefore asymmetric: preserving an uncertain
    verb is acceptable, but singularizing a user's noun is not.  Strong clause
    evidence may opt a token back into predicate agreement repair.
    """
    lower = str(word or "").lower()
    if lower in _COMPOUND_ASPECTUAL_FINITE_FORMS:
        return False
    if _compound_tail_starts_participial_modifier(segment_tail):
        if not (
            _compound_next_word(segment_tail) == "left"
            and _looks_like_bare_action_predicate(word)
        ):
            return True

    strong_predicate = _compound_followup_has_strong_predicate_shape(
        word, segment_tail, connector
    )
    if strong_predicate:
        return False
    if noun_sequence:
        return True

    previous_has_object = _compound_segment_has_object_like_tail(previous_segment)
    next_word = _compound_next_word(segment_tail)
    connector_lower = str(connector or "").lower()
    has_clause_marker = bool(
        "then" in connector_lower or connector_lower.lstrip().startswith(", and")
    )

    if _COMPOUND_RECIPROCAL_RE.search(segment_tail or ""):
        return False

    # A plain ``and`` after a relational PP remains noun coordination unless
    # the follow-up had independent predicate evidence above.  This preserves
    # ``camera and lenses``, ``children and students``, ``feet and shoes`` and
    # other user nouns while still repairing ``camera and nods`` / ``bus and
    # waves`` through the narrow strong-predicate path.
    if not has_clause_marker and _compound_segment_has_relational_object_tail(previous_segment):
        return True

    # Likewise, an object-bearing direct predicate followed by a bare item or a
    # prepositional modifier is more safely interpreted as object coordination
    # when there is no explicit clause boundary.
    if previous_has_object and not has_clause_marker and next_word in _COMPOUND_PREPOSITIONS:
        return True
    if previous_has_object and not has_clause_marker and not next_word:
        return True

    return False


def _normalize_compound_action_predicate(text: str, subject: str) -> str:
    """Repair agreement only where a compiler-bound compound predicate is clear.

    The previous implementation treated the first ``...s`` token as a verb and
    used a small follow-up verb whitelist.  That created two opposite failures:
    noun shorthand such as ``hands raised`` became ``hand raised``, while normal
    coordinated actions such as ``walks ..., raises ..., and smiles`` remained
    partly singular.

    This implementation is structure-first:
    * protect strong noun/participle shorthand before changing the first token;
    * walk top-level coordinators while retaining the exact original separators;
    * use object/list shape to protect noun coordination;
    * normalize every other inflectable predicate token with the existing
      conservative inflector;
    * never rewrite tokens after an explicit new subject because their segment
      head is not an inflectable predicate token.

    No general English verb/noun vocabulary is introduced.  Ambiguous cases are
    intentionally preserved when structural evidence favors a noun phrase.
    """
    if not text or not subject:
        return text
    prefix = re.escape(subject.strip())
    subject_match = re.match(rf"^(?P<subject>{prefix})(?P<sep>,?\s+)", text)
    if not subject_match:
        return text

    head = text[:subject_match.end()]
    predicate = text[subject_match.end():]
    if not predicate:
        return text

    # Split only on top-level prose coordinators while preserving exact link
    # text.  The function deliberately does not tokenize or reconstruct the
    # rest of the user's prose.
    parts: List[Tuple[str, str]] = []
    cursor = 0
    pending_link = ""
    for match in _COMPOUND_COORDINATOR_RE.finditer(predicate):
        segment = predicate[cursor:match.start()]
        parts.append((pending_link, segment))
        pending_link = match.group(0)
        cursor = match.end()
    parts.append((pending_link, predicate[cursor:]))

    if not parts:
        return text

    rebuilt: List[str] = []
    previous_segment = ""
    noun_sequence = False
    for index, (link, segment) in enumerate(parts):
        word_match = _COMPOUND_WORD_RE.search(segment)
        if not word_match:
            rebuilt.append(link + segment)
            previous_segment = segment
            continue

        word = word_match.group(0)
        replacement = _pluralize_compound_predicate_token(word)
        before = segment[:word_match.start()]
        tail = segment[word_match.end():]

        # Only an actually inflectable third-person token is a repair candidate.
        if replacement == word:
            rebuilt.append(link + segment)
            previous_segment = segment
            # A base-form predicate starts a fresh clause rather than extending
            # a protected noun list, unless that list was already established.
            if index == 0:
                noun_sequence = False
            continue

        keep_as_noun = False
        if index == 0:
            keep_as_noun = _compound_leading_token_is_noun_phrase(word, tail)
        else:
            keep_as_noun = _compound_followup_should_stay_noun(
                word,
                tail,
                previous_segment=previous_segment,
                connector=link,
                noun_sequence=noun_sequence,
            )

        if keep_as_noun:
            rebuilt.append(link + segment)
            noun_sequence = True
        else:
            rebuilt.append(link + before + replacement + tail)
            noun_sequence = False
        previous_segment = segment

    return head + "".join(rebuilt)

def _join_subject_and_predicate(subject: str, predicate: str) -> str:
    """Join a Person A/B/C profile fragment to an action predicate naturally.

    Profile fragments often contain appositive commas such as
    ``Person A, a woman in her thirties, with long black hair``.
    When an action is appended directly, the sentence needs a final comma
    before the predicate: ``Person A, a woman in her thirties, smiles.``
    Plain bare subjects like ``Person A`` should still join with a normal
    space: ``Person A smiles.``
    """
    subject = (subject or "").strip()
    predicate = (predicate or "").strip()
    if not subject:
        return predicate
    if not predicate:
        return subject
    if predicate[:1] in ",;:":
        return f"{subject}{predicate}"
    # Coordinated Person subjects can contain commas that belong to earlier
    # list items/appositives. Only the *final* Person fragment determines
    # whether a closing comma is needed before the predicate. This avoids
    # malformed forms such as ``Person A, a woman, and Person B, walk`` while
    # still closing ``Person A and Person B, a man, walk`` correctly.
    coordinated = bool(re.match(r"(?i)^Person [ABC]\b", subject) and re.search(r"(?i)\band Person [ABC]\b", subject))
    if coordinated:
        final_fragment = re.split(r"(?i),?\s+and\s+(?=Person [ABC]\b)", subject)[-1]
        separator = ", " if "," in final_fragment else " "
    else:
        separator = ", " if "," in subject else " "
    return f"{subject}{separator}{predicate}"


_SINGLE_ACTION_COORDINATED_BASE_VERBS = frozenset({
    # Only used while repairing an already compiler-bound single Person.  Keep
    # this deliberately small so noun coordination is never rewritten broadly.
    "smile", "wave", "walk", "look", "turn", "nod", "talk", "stand", "sit",
    "run", "hold", "move", "step", "raise", "lower", "open", "close", "lean",
    "laugh", "blink", "glance", "reach", "point", "pick", "put", "take",
    "place", "lift", "drop", "dance", "bow", "kneel", "jump", "stop", "start",
    "continue", "speak", "say", "watch", "wait", "follow", "leave", "enter",
    "play", "gaze", "stroll", "approach", "retreat", "pause", "gesture",
    "sprint", "clap", "shrug", "breathe", "sigh", "cry", "smirk", "frown",
    "crouch", "crawl", "spin", "rotate", "tilt", "bend", "stretch", "cross",
    "uncross", "touch", "grab", "release", "push", "pull", "throw", "catch",
    "drink", "eat", "bite", "chew", "kiss", "hug", "shake", "tremble",
    "shiver", "sway", "whisper", "shout", "yell", "scream",
    # Common aspect/linking predicates typed as bare Timeline action fragments.
    # These are grammar-role verbs rather than scene-specific vocabulary, so
    # binding them to the selected Progress subject avoids subjectless output
    # such as ``becomes quiet`` or ``begins walking`` without guessing nouns.
    "begin", "keep", "become", "seem", "remain", "appear", "feel",
})

_ACTION_OWNED_NOUN_SUBJECTS = frozenset({
    "hand", "hands", "eye", "eyes", "hair", "head", "face", "arm", "arms",
    "leg", "legs", "feet", "foot", "shoulder", "shoulders", "mouth", "lips",
    "coat", "dress", "shirt", "jacket", "skirt", "clothes", "clothing", "sleeve",
    "sleeves", "fingers", "finger", "body", "posture", "expression", "gaze",
})

# Extra leading predicates accepted only after a Timeline/Progress target has
# already established that Person A/B/C is the grammatical actor.  Keep this
# separate from _SINGLE_ACTION_COORDINATED_BASE_VERBS: that older set also
# participates in general compound-clause protection, so expanding it would
# re-open noun/verb regressions such as Hair->Hairs or scene subjects such as
# birds/waves/leaves being consumed as a selected Person action.
_TARGETED_ACTION_EXTRA_BASE_VERBS = frozenset({
    "carry", "drive", "ride", "read", "write", "cook", "cut", "pour", "wash",
    "use", "check", "repair", "inspect", "climb", "kick", "press",
})


def _targeted_action_word_candidates(word: str) -> set:
    lower = str(word or "").lower()
    candidates = {lower}
    if lower.endswith("ies") and len(lower) > 4:
        candidates.add(lower[:-3] + "y")
    if lower.endswith("ied") and len(lower) > 4:
        candidates.add(lower[:-3] + "y")
    if lower.endswith("es") and len(lower) > 3:
        candidates.update({lower[:-2], lower[:-1]})
    if lower.endswith("s") and len(lower) > 2:
        candidates.add(lower[:-1])
    if lower.endswith("ing") and len(lower) > 4:
        stem = lower[:-3]
        candidates.update({stem, stem + "e"})
        if len(stem) > 2 and stem[-1:] == stem[-2:-1]:
            candidates.add(stem[:-1])
    if lower.endswith("ed") and len(lower) > 3:
        stem = lower[:-2]
        candidates.update({stem, stem + "e"})
        if stem.endswith("i"):
            candidates.add(stem[:-1] + "y")
        if len(stem) > 2 and stem[-1:] == stem[-2:-1]:
            candidates.add(stem[:-1])
    return candidates


def _looks_like_targeted_action_predicate(text: str) -> bool:
    """Recognize a few omitted human actions only in an already-targeted Progress.

    This deliberately does not broaden the general action classifier.  It exists
    solely for the final Person-binding path, where structured UI state already
    says who performs the event. Independent scene subjects are still rejected by
    _action_starts_with_independent_subject before this helper is acted on.
    """
    if _looks_like_bare_action_predicate(text):
        return True
    raw = str(text or "").strip()
    if not raw:
        return False
    probe = re.sub(
        r"(?i)^(?:(?:then|also|immediately|slowly|quickly|quietly|gently|lightly|simultaneously)\s+)+",
        "", raw, count=1,
    ).lstrip()
    match = re.match(r"([A-Za-z]+)", probe)
    if not match:
        return False
    lower = match.group(1).lower()
    if lower in {"his", "her", "their", "its", "whose"} or lower in _ACTION_OWNED_NOUN_SUBJECTS:
        return False
    return bool(_targeted_action_word_candidates(lower) & _TARGETED_ACTION_EXTRA_BASE_VERBS)


def _singularize_targeted_action_predicate(predicate: str) -> str:
    """Singularize only a predicate already accepted by the targeted classifier."""
    if _looks_like_bare_action_predicate(predicate):
        return _singularize_selected_action_predicate(predicate)
    raw = str(predicate or "")
    match = re.match(
        r"^(?P<lead>\s*(?:(?:then|also|immediately|slowly|quickly|quietly|gently|lightly|together|simultaneously)\s+)*)?"
        r"(?P<word>[A-Za-z]+)(?P<tail>.*)$",
        raw, flags=re.I | re.S,
    )
    if not match:
        return raw
    word = match.group("word")
    candidates = _targeted_action_word_candidates(word)
    if not (candidates & _TARGETED_ACTION_EXTRA_BASE_VERBS):
        return _singularize_selected_action_predicate(raw)
    lower = word.lower()
    if lower.endswith("ing"):
        first = "is " + lower
    elif lower.endswith("ed"):
        first = lower
    elif lower == "press":
        first = "presses"
    else:
        first = _singularize_action_verb_token(word)
    tail = match.group("tail") or ""

    def _coord(match_obj: re.Match) -> str:
        coord_word = match_obj.group("word")
        if not (_targeted_action_word_candidates(coord_word) & _TARGETED_ACTION_EXTRA_BASE_VERBS):
            return match_obj.group(0)
        coord_lower = coord_word.lower()
        if coord_lower.endswith("ing"):
            normalized = "is " + coord_lower
        elif coord_lower.endswith("ed"):
            normalized = coord_lower
        elif coord_lower == "press":
            normalized = "presses"
        else:
            normalized = _singularize_action_verb_token(coord_word)
        return f"{match_obj.group('link')}{normalized}"

    tail = re.sub(
        r"(?i)(?P<link>\b(?:and|then)\s+)(?P<word>[A-Za-z]+)(?=$|[\s,.;:!?])",
        _coord, tail,
    )
    return f"{match.group('lead') or ''}{first}{tail}"


def _looks_like_bare_action_predicate(text: str) -> bool:
    """Return True only when free text safely looks like a Person predicate.

    The older fallback treated *every* first word as a verb, which could turn
    ordinary clauses into corruption such as ``Her`` -> ``Hers`` or ``Hair`` ->
    ``Hairs``.  Lower-case fragments and a conservative common-action vocabulary
    still receive the useful Person binding; clear possessive/body-part subjects
    are left as complete clauses instead of being rewritten.
    """
    raw = str(text or "").strip()
    if not raw:
        return False
    probe = re.sub(
        r"(?i)^(?:(?:then|also|immediately|slowly|quickly|quietly|gently|lightly|simultaneously)\s+)+",
        "", raw, count=1,
    ).lstrip()
    match = re.match(r"([A-Za-z]+)", probe)
    if not match:
        return False
    word = match.group(1)
    lower = word.lower()
    if lower in {"his", "her", "their", "its", "whose"} or lower in _ACTION_OWNED_NOUN_SUBJECTS:
        return False
    if lower in _SINGLE_ACTION_COORDINATED_BASE_VERBS or lower in {
        "is", "are", "was", "were", "has", "have", "does", "do", "go", "goes",
        "can", "could", "will", "would", "shall", "should", "may", "might", "must",
    }:
        return True

    # Recognize only inflections of the conservative action vocabulary.  Do not
    # assume every lower-case first token is a verb: ordinary clauses such as
    # ``door opens`` or ``lights flicker`` must not become ``Person A doors``.
    candidates = {lower}
    if lower.endswith("s") and len(lower) > 2:
        candidates.add(lower[:-1])
    if lower.endswith("es") and len(lower) > 3:
        candidates.add(lower[:-2])
    if lower.endswith("ies") and len(lower) > 4:
        candidates.add(lower[:-3] + "y")
    if lower.endswith("ing") and len(lower) > 4:
        stem = lower[:-3]
        candidates.update({stem, stem + "e"})
        if len(stem) > 2 and stem[-1:] == stem[-2:-1]:
            candidates.add(stem[:-1])
    if lower.endswith("ed") and len(lower) > 3:
        stem = lower[:-2]
        candidates.update({stem, stem + "e"})
        if len(stem) > 2 and stem[-1:] == stem[-2:-1]:
            candidates.add(stem[:-1])
    return bool(candidates & _SINGLE_ACTION_COORDINATED_BASE_VERBS)


def _singularize_action_verb_token(word: str) -> str:
    raw = str(word or "")
    lower = raw.lower()
    if lower in {"is", "was", "has", "does", "goes"} or lower.endswith("ing") or lower.endswith("ed"):
        replacement = raw
    elif lower in {"are", "were", "have", "do", "go"}:
        replacement = {"are": "is", "were": "was", "have": "has", "do": "does", "go": "goes"}[lower]
    elif lower in {"can", "could", "will", "would", "shall", "should", "may", "might", "must", "to"}:
        replacement = raw
    elif lower.endswith("s"):
        replacement = raw
    elif lower.endswith("y") and len(lower) > 1 and lower[-2] not in "aeiou":
        replacement = lower[:-1] + "ies"
    elif lower.endswith(("ch", "sh", "x", "z", "o")):
        replacement = lower + "es"
    else:
        replacement = lower + "s"
    # This token is inserted after an explicit Person subject, so an ordinary
    # sentence-initial capital from the user's fragment must become predicate
    # lower-case (``Walk`` -> ``Person A walks``).
    if raw.isupper() and len(raw) > 1:
        return replacement.lower()
    return replacement.lower()


def _remove_single_person_reciprocal_phrases(text: str) -> str:
    """Remove impossible group-only wording after a group action becomes one Person.

    A repair such as ``both people smile at each other`` -> ``Person A smiles at
    each other`` is grammatically and semantically impossible.  This helper is
    called only on that explicit group-to-single repair path.  Keep the cleanup
    deliberately narrow: for example, ``puts their hands together`` must remain
    valid, while ``stands together`` cannot describe the repaired lone actor.
    """
    value = str(text or "")
    value = re.sub(r"(?i)\b(?:at|to|with|toward|towards)\s+(?:each\s+other|one\s+another)\b", "", value)
    value = re.sub(r"(?i)\b(?:each\s+other's|one\s+another's)\s+", "", value)
    value = re.sub(r"(?i)\b(?:each\s+other|one\s+another)\b", "", value)
    # Only remove ``together`` after verbs whose repaired single-person form is
    # otherwise incomplete/unnatural.  Do not strip it globally because phrases
    # such as ``puts their hands together`` are perfectly valid for one person.
    value = re.sub(
        r"(?i)\b(stands?|sits?|walks?|runs?|talks?|chats?|smiles?|laughs?|dances?|poses?|turns?|nods?|leaves?|enters?|moves?)\s+together\b",
        r"\1",
        value,
    )
    # ``side by side`` also requires more than one actor.  This helper only runs
    # after an explicit multi-person action has already been repaired to one
    # selected Person, so removing it here cannot affect ordinary single-person
    # object-placement phrases elsewhere in the prompt.
    value = re.sub(r"(?i)\bside\s+by\s+side\b", "", value)
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value.strip()


def _singularize_selected_action_predicate(predicate: str) -> str:
    """Conservatively adapt a group/base predicate to one selected Person.

    This is also used for ordinary bare action fragments after the compiler has
    already decided that Person A/B/C is the grammatical subject.
    """
    raw = str(predicate or "")
    if not raw.strip():
        return raw
    match = re.match(r"^(?P<lead>\s*(?:(?:then|also|immediately|slowly|quickly|quietly|gently|lightly|together|simultaneously)\s+)*)?(?P<word>[A-Za-z]+)(?P<tail>.*)$", raw, flags=re.I | re.S)
    if not match:
        return raw
    raw_word = match.group("word")
    if raw_word.lower().endswith("ing") and _looks_like_bare_action_predicate(raw_word):
        first = "is " + raw_word.lower()
    else:
        first = _singularize_action_verb_token(raw_word)
    tail = match.group("tail") or ""

    # Repair only high-confidence coordinated bare action verbs.  This covers
    # common fragments such as ``smile and wave`` without turning arbitrary noun
    # lists into verbs.
    def _coord(match_obj: re.Match) -> str:
        word = match_obj.group("word")
        if word.lower() not in _SINGLE_ACTION_COORDINATED_BASE_VERBS:
            return match_obj.group(0)
        return f"{match_obj.group('link')}{_singularize_action_verb_token(word)}"

    tail = re.sub(
        r"(?i)(?P<link>\b(?:and|then)\s+)(?P<word>[A-Za-z]+)(?=$|[\s,.;:!?])",
        _coord, tail,
    )
    return f"{match.group('lead') or ''}{first}{tail}"


def _suppress_redundant_unspecified_speech_action(action_text: str, has_explicit_dialogue: bool) -> Tuple[str, bool]:
    """Remove only a contentless duplicate speech cue when dialogue is explicit.

    MiniMax H3 already receives the actual spoken content through ``<d>``.  A
    separate action such as ``looks at Person B and speaks`` can therefore act
    like an additional, content-unspecified vocal event and may encourage
    improvised speech.  Keep this repair deliberately narrow: remove only a
    bare terminal speech predicate (or an action made solely of that predicate).
    Content-bearing or delivery-bearing wording such as ``speaks softly``,
    ``talks to Person B``, ``whispers``, ``shouts`` and ``sings`` is preserved.
    """
    raw = str(action_text or "").strip()
    if not raw or not has_explicit_dialogue:
        return raw, False

    terminal = r"(?:speaks?|talks?|says?|begins?\s+(?:to\s+)?speak|starts?\s+(?:to\s+)?speak|begins?\s+speaking|starts?\s+speaking)"
    # Entire action is only an unspecified vocal cue.  The explicit dialogue
    # keeps the Progress timing and speaker identity authoritative.
    if re.fullmatch(rf"(?is)\s*(?:then\s+)?{terminal}\s*[.!?]?\s*", raw):
        return "", True

    # Otherwise remove only a final coordinated vocal cue.  Requiring the end
    # of the action prevents edits to content-bearing clauses later in prose.
    cleaned = re.sub(
        rf"(?is)(?P<head>.+?)\s*(?:,?\s+and|,?\s+then)\s+{terminal}\s*[.!?]?\s*$",
        lambda m: m.group("head").rstrip(" ,;:"),
        raw,
        count=1,
    ).strip()
    if cleaned != raw:
        return cleaned, True
    return raw, False


def _leading_single_person_reference(text: str) -> Tuple[str, int]:
    """Return an unambiguous leading Person A/B/C reference.

    ``Person A`` is always explicit. Bare ``B``/``C`` are retained for legacy
    shorthand, but bare ``A`` is not accepted because normal English action
    sentences frequently begin with the article ``A`` (for example,
    ``A woman walks...``). The Turn selector already supplies the character
    identity, so ambiguous bare-A text must remain ordinary user prose.
    """
    raw = text or ""
    explicit = re.match(r"(?i)^\s*person\s+([ABC])(?=$|[^A-Za-z0-9_])", raw)
    if explicit:
        return explicit.group(1).upper(), explicit.end()
    legacy = re.match(r"(?i)^\s*([BC])(?=$|[^A-Za-z0-9_])", raw)
    if legacy:
        return legacy.group(1).upper(), legacy.end()
    return "", 0


# A generic human subject may contain ordinary adjective/adverb modifiers before
# the human noun (``a nervous young man``, ``an East Asian woman``).  Parse
# those structurally rather than maintaining a vocabulary whitelist.  Function
# words that normally introduce a nested noun phrase stop the match, so text
# such as ``a portrait of a woman`` remains an independent scene subject.
_GENERIC_HUMAN_NOUNS = {"woman", "man", "person", "character", "adult", "child", "girl", "boy", "teenager", "teen"}
_GENERIC_HUMAN_PREMODIFIER_STOP_WORDS = {
    "a", "an", "the", "of", "for", "from", "with", "without", "in", "on",
    "at", "by", "to", "into", "onto", "over", "under", "between", "among",
    "through", "during", "before", "after", "behind", "beside", "near",
}
_GENERIC_HUMAN_PREMODIFIER_CONJUNCTIONS = {"and", "or", "but"}
_GENERIC_HUMAN_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'’_-]*")
_GENERIC_POSTMODIFIER_PREFIX_RE = re.compile(
    r"""(?ix)^(?:
        who\b|whom\b|whose\b|which\b|that\b|
        (?:about|above|across|after|against|along|amid|among|around|at|before|behind|below|beneath|beside|between|beyond|by|despite|during|except|for|from|in|inside|into|near|of|off|on|onto|opposite|outside|over|past|through|throughout|toward|towards|under|underneath|upon|via|with|within|without)\b|
        [A-Za-z][A-Za-z'-]*ing\b|
        (?:[A-Za-z][A-Za-z'-]*(?:ed|en)|clad)\b\s+(?:about|above|across|after|against|along|amid|among|around|at|before|behind|below|beneath|beside|between|beyond|by|despite|during|except|for|from|in|inside|into|near|of|off|on|onto|opposite|outside|over|past|through|throughout|toward|towards|under|underneath|upon|via|with|within|without)\b
    )"""
)
_PROFILE_AGE_PREMODIFIER_RE = re.compile(
    r"(?ix)(?<![\w-])(?:young|elderly|teenage|teen|adult|child|middle[- ]aged|senior|"
    r"\d{1,3}(?:[- ]year[- ]old|[- ]years[- ]old))(?![\w-])"
)
_PROFILE_GENDER_PREMODIFIER_RE = re.compile(
    r"(?ix)(?<![\w-])(?:female|male|non[- ]?binary)(?![\w-])"
)


class _GenericHumanSubjectMatch(NamedTuple):
    start: int
    end: int
    subject_text: str
    noun: str
    premodifier_text: str
    premodifiers: Tuple[str, ...]


class _ActionSubjectBinding(NamedTuple):
    text: str
    matched: bool
    profile_intro_needed: bool


def _match_generic_human_subject_at(text: str, start: int = 0) -> Optional[_GenericHumanSubjectMatch]:
    """Parse ``a/the + optional modifiers + human noun`` at *start*.

    The parser is deliberately lexical-vocabulary-free for descriptive words:
    up to eight ordinary modifier tokens are accepted. Function words that
    normally start a nested noun phrase stop the match, keeping text such as
    ``a portrait of a woman`` independent from Timeline Person binding.
    """
    raw = text or ""
    if start < 0 or start >= len(raw):
        return None
    leading_ws = re.match(r"\s*", raw[start:])
    pos = start + (leading_ws.end() if leading_ws else 0)
    article = re.match(r"(?i)(?:a|an|the)\b", raw[pos:])
    if not article:
        return None
    article_start = pos
    pos += article.end()
    modifier_start = pos
    modifiers: List[str] = []
    last_was_separator = False
    for _ in range(16):
        ws = re.match(r"\s*", raw[pos:])
        pos += ws.end() if ws else 0
        if pos >= len(raw):
            return None
        if raw[pos] == ",":
            if not modifiers or last_was_separator:
                return None
            pos += 1
            last_was_separator = True
            continue
        token_match = _GENERIC_HUMAN_TOKEN_RE.match(raw, pos)
        if not token_match:
            return None
        token = token_match.group(0)
        lower = token.lower()
        token_start = token_match.start()
        pos = token_match.end()
        if lower in _GENERIC_HUMAN_NOUNS:
            premodifier_text = raw[modifier_start:token_start].strip(" \t,")
            return _GenericHumanSubjectMatch(
                article_start,
                pos,
                raw[article_start:pos].strip(),
                lower,
                premodifier_text,
                tuple(modifiers),
            )
        if lower in _GENERIC_HUMAN_PREMODIFIER_CONJUNCTIONS:
            if not modifiers or last_was_separator:
                return None
            last_was_separator = True
            continue
        if lower in _GENERIC_HUMAN_PREMODIFIER_STOP_WORDS:
            return None
        modifiers.append(token)
        if len(modifiers) > 8:
            return None
        last_was_separator = False
    return None


def _match_leading_generic_human_subject(text: str) -> Optional[_GenericHumanSubjectMatch]:
    return _match_generic_human_subject_at(text, 0)


def _clean_profile_owned_premodifiers(text: str, *, gender: str, age: str) -> str:
    """Keep free descriptive modifiers while avoiding duplicate profile identity.

    Timeline profile selectors are authoritative for configured age/gender. If
    those dimensions are set, generic noun-phrase modifiers that merely restate
    age or gender are removed before the remaining descriptive text is attached
    to the same Person identity. This prevents adjacent contradictions such as
    ``in her thirties`` followed by ``an elderly woman`` without maintaining a
    vocabulary list for arbitrary visual adjectives.
    """
    value = (text or "").strip()
    if not value:
        return ""
    if age != "unspecified":
        value = _PROFILE_AGE_PREMODIFIER_RE.sub(" ", value)
    if gender != "unspecified":
        value = _PROFILE_GENDER_PREMODIFIER_RE.sub(" ", value)
    value = re.sub(r"\s*,\s*", ", ", value)
    value = re.sub(r"(?i)^\s*(?:(?:and|or|but)\b|,)\s*", "", value)
    value = re.sub(r"(?i)\s*(?:(?:and|or|but)\b|,)\s*$", "", value)
    value = re.sub(r"\s+", " ", value).strip(" ,")
    return value


def _bare_person_label(subject: str) -> str:
    match = re.match(r"(?i)^\s*Person\s+([ABC])\b", subject or "")
    return f"Person {match.group(1).upper()}" if match else ""


def _decorate_profile_subject_with_generic_match(subject: str, profile: dict, generic_match: _GenericHumanSubjectMatch) -> str:
    """Attach only non-profile pre-noun descriptors to an authoritative Person."""
    premodifier_text = _clean_profile_owned_premodifiers(
        generic_match.premodifier_text,
        gender=(profile or {}).get("gender", "unspecified"),
        age=(profile or {}).get("age", "unspecified"),
    )
    if not premodifier_text:
        return subject
    base = (subject or _bare_person_label(subject)).strip()
    return f"{base}, who is {premodifier_text}" if base else ""


def _postmodifier_main_predicate_start(remainder: str) -> Optional[int]:
    """Find a later finite predicate after a leading generic-human postmodifier.

    This is intentionally narrow.  It only recognizes finite/modal forms from
    the node's existing selected-action grammar, so object nouns inside the
    modifier (``holding a watch``, ``with glasses``) are not mistaken for the
    main predicate. Relative clauses consume their own first finite predicate;
    a second finite predicate is required before we split them.
    """
    raw = str(remainder or "")
    words = list(re.finditer(r"[A-Za-z]+(?:['’][A-Za-z]+)?", raw))
    if len(words) < 2:
        return None
    first = words[0].group(0).lower()
    relative = first in {"who", "whom", "whose", "which", "that"}
    finite_seen = 0
    modal_or_aux = {
        "is", "are", "was", "were", "has", "have", "does", "do", "goes",
        "can", "could", "will", "would", "shall", "should", "may", "might", "must",
    }

    for match in words[1:]:
        word = match.group(0)
        lower = word.lower()
        finite = lower in modal_or_aux
        if not finite:
            # Require visible finite/past morphology; bare lexical words are too
            # ambiguous inside noun phrases (for example ``a watch``).
            visibly_inflected = (
                (lower.endswith("s") and not lower.endswith("ss"))
                or lower.endswith("ed")
            )
            if visibly_inflected and _looks_like_targeted_action_predicate(word):
                finite = True
        if not finite:
            continue
        finite_seen += 1
        if not relative or finite_seen >= 2:
            return match.start()
    return None


def _bind_single_generic_postmodifier(subject: str, remainder: str) -> str:
    """Render a single selected Person plus a leading descriptive postmodifier.

    Examples:
      ``holding a cup walks`` -> ``Person A, holding a cup, walks``
      ``with a briefcase walks`` -> ``Person A, with a briefcase, walks``
      ``holding a cup`` -> ``Person A, holding a cup, is present in the scene``

    The helper is called only after an article-led generic human (a/the person,
    woman, man, ...) has already been matched to the structured single target.
    """
    value = str(remainder or "").strip()
    if not value:
        return subject
    # A human relative introduced with ``that`` is clearer as ``who`` once the
    # generic noun has been replaced by the stable Person A/B/C identity.
    value = re.sub(r"(?i)^that\b", "who", value, count=1)
    split_at = _postmodifier_main_predicate_start(value)
    if split_at is None:
        return f"{subject}, {value}, is present in the scene"
    modifier = value[:split_at].strip(" ,")
    predicate = value[split_at:].strip()
    if not modifier or not predicate:
        return f"{subject}, {value}, is present in the scene"
    return f"{subject}, {modifier}, {predicate}"


def _bind_leading_single_action_subject(text: str, subject: str, profile: dict) -> _ActionSubjectBinding:
    """Bind a leading single-person phrase to the Timeline-selected Person.

    Parsing and rendering decisions are explicit in the return type so callers
    do not have to infer the meaning of positional booleans. Simple generic
    clauses preserve the compact one-sentence form. Modifier-bearing clauses use
    the stable Person identity without inventing a second character.
    """
    raw = text or ""
    possessive_match = re.match(r"(?i)^\s*(his|her|their)\b", raw)
    if possessive_match:
        bare_subject = _bare_person_label(subject)
        if bare_subject:
            remainder = raw[possessive_match.end():].strip()
            possessive_subject = f"{bare_subject}'s"
            profile_intro_needed = bool(subject and subject.strip() != bare_subject)
            return _ActionSubjectBinding(
                _join_subject_and_predicate(possessive_subject, remainder),
                True,
                profile_intro_needed,
            )

    pronoun_match = re.match(
        r"(?i)^\s*(he|she|they|the\s+on-screen\s+person|the\s+visible\s+subject)\b",
        raw,
    )
    # Preserve the long-standing pronoun/on-screen aliases before the more
    # general article+modifier+human parser gets a chance to absorb them.
    if pronoun_match:
        matched_subject = pronoun_match.group(1).strip()
        remainder = raw[pronoun_match.end():].strip()
        lower_subject = matched_subject.lower()
        if lower_subject == "they":
            predicate = "is shown while they" + (f" {remainder}" if remainder else "")
            return _ActionSubjectBinding(_join_subject_and_predicate(subject, predicate), True, False)
        if lower_subject == "the on-screen person":
            # Preserve the established alias rendering while the
            # general generic-human parser is refactored around it.
            bare_subject = _bare_person_label(subject)
            if bare_subject:
                alias_subject = f"{bare_subject}, the on-screen person"
                return _ActionSubjectBinding(
                    _join_subject_and_predicate(alias_subject, remainder),
                    True,
                    bool(subject and subject.strip() != bare_subject),
                )
        return _ActionSubjectBinding(_join_subject_and_predicate(subject, remainder), True, False)

    generic_match = _match_leading_generic_human_subject(raw)
    if generic_match:
        bare_subject = _bare_person_label(subject)
        if not bare_subject:
            return _ActionSubjectBinding(raw, False, False)
        remainder = raw[generic_match.end:].strip()
        described_subject = _decorate_profile_subject_with_generic_match(
            subject or bare_subject, profile, generic_match
        )

        # Preserve non-profile descriptors (tall, nervous, East Asian, etc.) on
        # the configured Person rather than repeating the generic noun phrase.
        if described_subject != (subject or bare_subject):
            return _ActionSubjectBinding(
                _join_subject_and_predicate(described_subject, remainder), True, False
            )

        # If the original premodifier only repeated configured age/gender, the
        # authoritative profile already carries that information. Keep the old
        # compact one-sentence behavior instead of emitting a second identity.
        if generic_match.premodifier_text:
            return _ActionSubjectBinding(
                _join_subject_and_predicate(subject or bare_subject, remainder), True, False
            )

        # A genuine postmodifier (``covered in mud``, ``with a briefcase``,
        # ``holding a cup``) is safer on the bare stable Person label. Emit the
        # full configured profile separately only for that structural case.
        if remainder and _GENERIC_POSTMODIFIER_PREFIX_RE.match(remainder):
            profile_intro_needed = bool(subject and subject.strip() != bare_subject)
            return _ActionSubjectBinding(
                _join_subject_and_predicate(bare_subject, remainder), True, profile_intro_needed
            )

        # Ordinary ``A woman walks`` / ``The man smiles`` keeps the verified
        # Established compact form with the full profile in the same sentence.
        return _ActionSubjectBinding(
            _join_subject_and_predicate(subject or bare_subject, remainder), True, False
        )

    return _ActionSubjectBinding(raw, False, False)



def _normalize_bound_single_person_pronouns(text: str, slot: str, gender: str) -> str:
    """Normalize pronoun drift only after a single Timeline actor is bound.

    The Turn selector is authoritative for action ownership. This helper runs
    after the action has been attached to Person A/B/C, never infers a character
    from scene prose, and never touches composite turns or quoted screen text.

    It intentionally avoids global gender substitution. Only sentence-leading
    He/She continuations that do not follow an explicit *other* Person are
    rebound to the selected Person. Obvious self-owned visual/body possessives
    in a sentence led by that Person are harmonized to the selected binary
    gender, or neutralized to ``their`` when gender is unspecified/nonbinary.
    """
    raw = text or ""
    slot = str(slot or "").upper()
    if not raw or slot not in ("A", "B", "C"):
        return raw

    person = f"Person {slot}"
    normalized_gender = str(gender or "unspecified").lower()
    owned_noun = (
        r"(?:body|hair|head|face|eyes?|gaze|hands?|arms?|legs?|shoulders?|"
        r"waist|chest|back|posture|clothing|clothes|outfit|coat|jacket|dress|"
        r"shirt|skirt|pants|trousers|shoes?|hat|glasses|accessories)"
    )

    # Protect quoted screen text with local opaque placeholders so sentence
    # analysis can run across quote boundaries without changing quoted content.
    protected_values: List[str] = []
    protected_parts: List[str] = []
    for protected, part in _quoted_screen_text_spans(raw):
        if protected:
            token = f"ZXQH3PRONQUOTE{len(protected_values)}QXZ"
            protected_values.append(part)
            protected_parts.append(token)
        else:
            protected_parts.append(part)
    working = "".join(protected_parts)

    sentences = re.split(r"(?<=[.!?])\s+", working)
    previous_mentions_other_person = False
    rebuilt_sentences: List[str] = []
    for sentence in sentences:
        out = sentence
        if not previous_mentions_other_person:
            out = re.sub(
                r"(?i)^\s*(?:he|she)\b",
                lambda m: re.match(r"^\s*", m.group(0)).group(0) + person,
                out,
                count=1,
            )

        if re.match(rf"(?i)^\s*{re.escape(person)}\b", out):
            if normalized_gender == "female":
                replacement, bad = "her", r"his"
            elif normalized_gender == "male":
                replacement, bad = "his", r"her"
            else:
                replacement, bad = "their", r"(?:his|her)"
            out = re.sub(
                rf"(?i)\b{bad}\s+({owned_noun})\b",
                lambda m: f"{replacement} {m.group(1)}",
                out,
            )

        other_slots = {
            match.group(1).upper()
            for match in re.finditer(r"(?i)\bPerson\s+([ABC])\b", out)
            if match.group(1).upper() != slot
        }
        previous_mentions_other_person = bool(other_slots)
        rebuilt_sentences.append(out)

    result = " ".join(rebuilt_sentences)
    for idx, value in enumerate(protected_values):
        result = result.replace(f"ZXQH3PRONQUOTE{idx}QXZ", value)
    return result


def _match_leading_generic_human_group(text: str, expected_count: int):
    """Match a leading natural-language human group for a composite Timeline turn.

    Supported forms are coordinated generic phrases (``a woman and a man``) and
    simple counted plural groups (``two women``, ``three people``). The selected
    A/B/C group remains authoritative; this parser only binds natural wording to
    that already-selected group.
    """
    raw = text or ""
    count_words_by_number = {
        1: ("one", "1"),
        2: ("two", "2", "both"),
        3: ("three", "3"),
        4: ("four", "4"),
        5: ("five", "5"),
        6: ("six", "6"),
        7: ("seven", "7"),
        8: ("eight", "8"),
        9: ("nine", "9"),
        10: ("ten", "10"),
    }
    if expected_count not in count_words_by_number:
        return None

    count_words = count_words_by_number[expected_count]
    noun_pattern = (
        r"woman|man|person|character|adult|child|girl|boy|teenager|teen"
        if expected_count == 1 else
        r"women|men|people|persons|characters|adults|children|girls|boys|teenagers|teens"
    )
    plural = re.match(
        rf"(?i)^\s*(?:the\s+)?(?:all\s+)?(?:{'|'.join(re.escape(v) for v in count_words)})\s+(?P<noun>{noun_pattern})\b",
        raw,
    )
    if plural:
        return {"end": plural.end(), "members": (), "count": expected_count, "noun": plural.group("noun").lower()}

    members: List[_GenericHumanSubjectMatch] = []
    pos = 0
    for idx in range(expected_count):
        member = _match_generic_human_subject_at(raw, pos)
        if not member:
            return None
        members.append(member)
        pos = member.end
        if idx == expected_count - 1:
            break
        sep = re.match(r"(?i)\s*(?:\+|&|and\b|,\s*(?:and\s+)?)\s*", raw[pos:])
        if not sep:
            return None
        pos += sep.end()
    return {"end": pos, "members": tuple(members), "count": expected_count, "noun": ""}


def _generic_human_slots_for_composite_group(group_match: dict, slots: Sequence[str], profiles: dict) -> List[str]:
    """Map a natural 2/3-person subject onto the already-selected Progress cast.

    The structured Progress selection stays authoritative.  If free text names a
    smaller human subgroup, bind that many selected slots; if it names more people
    than the Progress contains, collapse to the selected group instead of leaving a
    contradictory unnamed cast.  Gender wording is used only when it uniquely helps
    choose among the already-selected slots.
    """
    selected = [str(slot) for slot in slots]
    if not selected:
        return []
    declared = int(group_match.get("count") or len(group_match.get("members") or ()) or len(selected))
    desired = max(1, min(len(selected), declared))
    remaining = list(selected)
    chosen: List[str] = []
    members = list(group_match.get("members") or ())

    if members:
        for member in members[:desired]:
            if not remaining:
                break
            slot = _generic_human_slot_for_composite(member, remaining, profiles)
            if slot not in remaining:
                slot = remaining[0]
            chosen.append(slot)
            remaining.remove(slot)
    else:
        noun = str(group_match.get("noun") or "").lower()
        wanted_gender = "female" if noun in {"woman", "women", "girl", "girls"} else "male" if noun in {"man", "men", "boy", "boys"} else ""
        if wanted_gender:
            matching = [
                slot for slot in remaining
                if str((profiles.get(slot) or {}).get("gender", "unspecified")) == wanted_gender
            ]
            for slot in matching[:desired]:
                chosen.append(slot)
                remaining.remove(slot)

    while len(chosen) < desired and remaining:
        chosen.append(remaining.pop(0))
    return chosen or selected[:desired]


def _match_any_leading_generic_human_group(text: str) -> Optional[dict]:
    """Return a leading counted/coordinated natural human group.

    The node supports at most three configured people, but users can still type
    ``four people`` or another larger count by mistake.  Recognize those phrases
    so the structured Progress target can softly reconcile them instead of
    treating the number word as a verb (for example the old ``Person A foures``).
    """
    for count in range(10, 0, -1):
        match = _match_leading_generic_human_group(text, count)
        if match:
            return match
    raw = str(text or "")
    bare_plural = re.match(
        r"(?i)^\s*(?:the\s+)?(?:all\s+)?(?P<noun>women|men|people|persons|characters|adults|children|girls|boys|teenagers|teens)\b",
        raw,
    )
    if bare_plural:
        return {
            "end": bare_plural.end(),
            "members": (),
            "count": 0,
            "noun": bare_plural.group("noun").lower(),
            "bare_plural": True,
        }
    return None

def _action_starts_with_independent_subject(text: str) -> bool:
    """Return True when action text already starts as a complete scene clause.

    Besides article-led clauses, Timeline actions commonly start with counted
    objects/animals (``two cars pass``) or environment subjects (``rain falls``).
    Those are scene events, not predicates that should be prefixed with Person A.
    Clearly human count phrases are still handled by the dedicated human-group
    binder before this function is consulted.
    """
    raw = str(text or "")
    if re.match(
        r"(?i)^\s*(?:(?:a|an)\s+|camera\s+|from\s+|at\s+|"
        r"(?:both|two|three)\s+(?:people|persons|characters)\b|"
        r"the\s+(?:(?:two|three)\s+)?(?:people|persons|characters)\b|"
        r"the\s+(?:camera|scene|door|window|room|light|lights|background|foreground)\b|"
        r"the\s+(?!on-screen\s+(?:person|people|persons)\b|visible\s+subjects?\b)[A-Za-z][A-Za-z'-]*\b)",
        raw,
    ):
        return True
    # Quantified non-human noun phrases are independent subjects.  Human groups
    # have already been consumed by _match_leading_generic_human_group.
    if re.match(
        r"(?i)^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|several|many|multiple|some|few|all)\s+)"
        r"(?!people\b|persons\b|characters\b|women\b|men\b|adults\b|children\b|girls\b|boys\b|teenagers\b|teens\b)"
        r"[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3}\s+",
        raw,
    ):
        return True
    # High-frequency environment subjects safely identify complete scene clauses
    # without requiring a general English parser.
    return bool(re.match(
        r"(?i)^\s*(?:rain|snow|wind|fog|mist|smoke|steam|dust|lightning|thunder|"
        r"clouds?|waves?|water|fire|flames?|traffic|vehicles?|cars?|birds?|leaves|"
        r"curtains?|shadows?|reflections?)\b\s+",
        raw,
    ))


def _leading_composite_person_group(text: str) -> Tuple[Tuple[str, ...], int]:
    """
    Recognize only clearly explicit multi-person prefixes such as
    "Person A and Person B" / "A+B". A normal phrase beginning with the
    article "A" is deliberately not treated as a character reference.
    """
    raw = text or ""
    if not raw.strip():
        return (), 0
    if not re.match(r"(?i)^\s*(?:person\s+[ABC]|[ABC]\s*(?:\+|&|and\b))", raw):
        return (), 0
    token = r"(?:person\s+)?[ABC]"
    sep = r"\s*(?:\+|&|and|,\s*(?:and\s+)?)\s*"
    match = re.match(rf"(?i)^\s*{token}(?:{sep}{token}){{1,2}}(?=$|[^A-Za-z0-9_])", raw)
    if not match:
        return (), 0
    slots = tuple(s.upper() for s in re.findall(r"(?i)(?:person\s+)?([ABC])\b", match.group(0)))
    if len(slots) < 2 or len(set(slots)) != len(slots):
        return (), 0
    return slots, match.end()


def _apply_timeline_time_prefix(text: str, elapsed_seconds: float) -> str:
    """Prefix approximate time without lowercasing stable Person A/B/C identity labels."""
    if elapsed_seconds <= 0 or not text:
        return text
    prefix = f"At approximately {elapsed_seconds:.2f} seconds, "
    if re.match(r"^Person\s+[A-C]\b", text):
        return prefix + text
    return prefix + text[0].lower() + text[1:]


def _action_clearly_indicates_selected_singing(text: str) -> bool:
    """Detect only clear turn-subject singing predicates; avoid broad keyword filtering."""
    raw = (text or "").strip()
    if not raw:
        return False

    # Remove only leading subject forms already understood by Timeline binding.
    # Keep whether a selected-human subject was actually consumed: a bare sentence
    # beginning with "Singing ..." may instead describe birds, bowls, voices, radio
    # audio, or another scene noun and must not be treated as the selected actor.
    selected_subject_consumed = False
    _, explicit_end = _leading_composite_person_group(raw)
    if explicit_end:
        raw = raw[explicit_end:].lstrip()
        selected_subject_consumed = True
    else:
        _, single_end = _leading_single_person_reference(raw)
        if single_end:
            raw = raw[single_end:].lstrip()
            selected_subject_consumed = True
        else:
            group_match = _match_any_leading_generic_human_group(raw)
            if group_match:
                raw = raw[group_match["end"]:].lstrip()
                selected_subject_consumed = True
            else:
                generic = _match_leading_generic_human_subject(raw)
                if generic:
                    raw = raw[generic.end:].lstrip()
                    selected_subject_consumed = True
                else:
                    pronoun = re.match(
                        r"(?i)^\s*(?:they|he|she|the\s+(?:people|persons|characters)|the\s+visible\s+subjects?)\b\s*",
                        raw,
                    )
                    if pronoun:
                        raw = raw[pronoun.end():].lstrip()
                        selected_subject_consumed = True

    adverbs = r"(?:(?:softly|quietly|loudly|gently|together|slowly|happily|sadly|calmly|passionately)\s+){0,3}"
    if selected_subject_consumed:
        predicate = (
            r"(?:sing(?:s|ing)?|sang|(?:is|are|was|were)\s+singing|"
            r"(?:starts?|begins?|continues?)\s+(?:to\s+sing|singing))"
        )
    else:
        # Without an explicit selected-human subject, accept clear finite/auxiliary
        # singing predicates and only a narrow gerund form with an obvious singing
        # complement. This avoids false positives such as "Singing birds ...",
        # "Singing bowls ...", "Singing from a radio ...", and "Sing-song music ...".
        predicate = (
            r"(?:sing(?:s)?|sang|(?:is|are|was|were)\s+singing|"
            r"(?:starts?|begins?|continues?)\s+(?:to\s+sing|singing)|"
            r"singing(?=$|\s+(?:a|an|the|his|her|their|softly|quietly|loudly|gently|"
            r"together|slowly|happily|sadly|calmly|passionately|while|with)\b))"
        )

    # Require a normal predicate boundary. In particular, "sing-song" must not
    # be mistaken for the verb "sing" merely because '-' is a regex word boundary.
    if re.match(rf"(?i)^{adverbs}{predicate}(?=$|[\s,.;:!?])", raw):
        return True

    # A selected-person action can begin with another clear action and then
    # coordinate the singing predicate: ``walks and sings softly``.  Only inspect
    # this continuation when the first clause already looks like a compiler-bound
    # Person predicate, and require the singing verb immediately after and/then.
    # This intentionally does not match independent clauses such as
    # ``walks while birds sing`` or noun phrases such as ``a singing toy``.
    if _looks_like_bare_action_predicate(raw):
        coordinated_singing = (
            r"(?:\band\s+|\bthen\s+)" + adverbs
            + r"(?:sing|sings|sang|(?:is|are|was|were)\s+singing|"
              r"(?:starts?|begins?|continues?)\s+(?:to\s+sing|singing)|"
              r"singing(?=\s+(?:a|an|the|his|her|their|softly|quietly|loudly|gently|"
              r"together|slowly|happily|sadly|calmly|passionately|while|with)\b))"
            + r"(?=$|[\s,.;:!?])"
        )
        if re.search(coordinated_singing, raw, flags=re.I):
            return True

        # Accept only the grammatical same-subject gerund continuation
        # ``walks while singing softly``.  Keep this intentionally narrower
        # than pronoun clauses such as ``walks as she sings`` because the
        # pronoun may refer to a different person.  A noun after ``singing``
        # (``while singing birds circle overhead``) is also excluded.
        same_subject_continuation = (
            r"\bwhile\s+" + adverbs
            + r"singing(?=$|[,.;:!?]|\s+(?:softly|quietly|loudly|gently|together|slowly|happily|sadly|calmly|passionately)\b)"
        )
        if re.search(same_subject_continuation, raw, flags=re.I):
            return True
    return False


def _vocal_event_kind(action_text: str, dialogue_text: str) -> str:
    """Return 'singing' when a Turn action clearly frames Dialogue as lyrics."""
    if not (dialogue_text or "").strip():
        return "speech"
    probe = (action_text or "").strip()
    if _action_clearly_indicates_selected_singing(probe):
        return "singing"
    explicit_slot, explicit_end = _leading_single_person_reference(probe)
    if explicit_slot and _action_clearly_indicates_selected_singing(probe[explicit_end:]):
        return "singing"
    explicit_slots, explicit_end = _leading_composite_person_group(probe)
    if explicit_slots and _action_clearly_indicates_selected_singing(probe[explicit_end:]):
        return "singing"
    return "speech"




def _normalize_unbound_selected_singing_predicate(text: str, *, plural: bool) -> Optional[str]:
    """Normalize only a subjectless leading singing predicate after singing was already selected.

    This helper deliberately does not classify singing.  The caller must first
    establish that the Progress speaker is the intended singer.  That keeps
    independent clauses such as ``singing birds circle overhead`` untouched.
    """
    raw = str(text or "").strip()
    if not raw:
        return None
    adverbs = r"(?:(?:softly|quietly|loudly|gently|together|slowly|happily|sadly|calmly|passionately)\s+){0,3}"
    match = re.match(
        rf"(?is)^(?P<lead>{adverbs})(?P<pred>singing|sing|sings|sang|is\s+singing|are\s+singing|was\s+singing|were\s+singing)(?P<tail>$|[\s,.;:!?].*)",
        raw,
    )
    if not match:
        return None
    lead = match.group("lead") or ""
    pred = re.sub(r"\s+", " ", match.group("pred").lower())
    tail = match.group("tail") or ""
    if plural:
        normalized = {
            "singing": "are singing", "sing": "sing", "sings": "sing", "sang": "sang",
            "is singing": "are singing", "are singing": "are singing",
            "was singing": "were singing", "were singing": "were singing",
        }[pred]
    else:
        normalized = {
            "singing": "is singing", "sing": "sings", "sings": "sings", "sang": "sang",
            "is singing": "is singing", "are singing": "is singing",
            "was singing": "was singing", "were singing": "was singing",
        }[pred]
    return f"{lead}{normalized}{tail}"

def _voiceover_closed_lips_clause(group_size: int) -> str:
    if int(group_size) >= 2:
        return " while any corresponding on-screen speakers' lips remain completely closed."
    return " while any corresponding on-screen speaker's lips remain completely closed."


def _on_screen_speaking_clause(group_size: int) -> str:
    if int(group_size) >= 2:
        return " The visible speakers are speaking directly on screen, and their spoken dialogue is synchronized with natural lip movement."
    return " The visible speaker is speaking directly on screen, and the spoken dialogue is synchronized with natural lip movement."


def _ensure_supported_vocal_delivery(index: int, vocal_kind: str, dialogue_delivery: str) -> None:
    if vocal_kind == "singing" and dialogue_delivery == "voiceover":
        raise _UserInputError(
            f"Turn {index} combines singing/lyrics with voiceover delivery. "
            "MiniMax H3 clearly documents the exact speech voiceover marker 'says in an off-screen voiceover', "
            "but this node does not claim an official off-screen singing marker. Use on-screen singing, or rewrite the event as spoken voiceover instead."
        )


def _render_timeline_turn_composite(
    index: int,
    mode: str,
    speaker_selection: str,
    elapsed_seconds: float,
    action_text: str,
    dialogue_text: str,
    dialogue_language: str,
    dialogue_delivery: str,
    profiles: dict,
    seen_profiles: set,
    seen_speakers: set,
) -> Tuple[List[str], List[str]]:
    """Render an H3 ordered step performed/spoken together by 2-3 selected people."""
    warnings: List[str] = []
    sentences: List[str] = []
    slots = _speaker_slots(speaker_selection)
    if len(slots) < 2:
        raise ValueError("Composite turn renderer requires at least two speakers.")
    for slot in slots:
        if slot not in profiles:
            raise ValueError(f"Unknown turn speaker: {slot}")

    action_text = (action_text or "").strip()
    dialogue_text = (dialogue_text or "").strip()
    if not action_text and not dialogue_text:
        return sentences, warnings
    vocal_kind = _vocal_event_kind(action_text, dialogue_text)
    _ensure_supported_vocal_delivery(index, vocal_kind, dialogue_delivery)
    if vocal_kind != 'singing':
        action_text, suppressed_speech_action = _suppress_redundant_unspecified_speech_action(
            action_text, bool(dialogue_text)
        )
        if suppressed_speech_action:
            warnings.append(
                f"Progress {index}: a contentless duplicate speech action was omitted because explicit dialogue already defines the spoken event."
            )

    turn_prefix = "" if elapsed_seconds <= 0 else f"At approximately {elapsed_seconds:.2f} seconds, "

    # A composite Turn that also contains dialogue must use one stable person
    # ordering across its action and dialogue sentences. H3 compound speaker
    # IDs are normalized by first-vocal-event order (S1,S2,S3), so once those
    # IDs exist use that same ordering for the whole Turn. Action-only composite
    # Turns keep the user's canonical A/B/C selection order.
    subject_slots = slots
    if dialogue_text:
        subject_slots = tuple(sorted(slots, key=lambda slot: _sid_number(profiles[slot].get('sid'))))

    action_subject_part_by_slot = {}
    for slot in slots:
        profile = profiles[slot]
        action_subject_part_by_slot[slot] = _profile_fragment(
            slot, profile['gender'], profile['age'],
            appearance_desc=profile.get('appearance_desc', ''),
            clothing_desc=profile.get('clothing_desc', ''),
            include_visual=slot not in seen_profiles,
            compact_identity=slot in seen_profiles,
        )
    action_subject = _join_subject_fragments([action_subject_part_by_slot[slot] for slot in subject_slots])

    if action_text:
        explicit_slots, _ = _leading_composite_person_group(action_text)
        if explicit_slots and set(explicit_slots) != set(slots):
            warnings.append(
                f"Progress {index}: the selected target is {speaker_selection}, while the action begins with "
                f"Persons {'+'.join(explicit_slots)}. The explicit action subject was kept when it belongs to the selected group; "
                "otherwise it was rebound to an active selected Person."
            )
        raw_single = re.match(r"(?i)^\s*person\s+([ABC])(?=$|[^A-Za-z0-9_])", action_text)
        if raw_single and not explicit_slots:
            warnings.append(
                f"Progress {index}: the combined target is {speaker_selection}, but the action begins with Person {raw_single.group(1).upper()}. "
                "That single-person action was preserved as a sub-action inside the selected Progress instead of blocking execution."
            )

        act, act_warn = _normalize_timeline_action(action_text, f"turn_{index}_action")
        warnings.extend(act_warn)
        if act:
            act_body = act.rstrip('.')
            normalized_slots, normalized_end = _leading_composite_person_group(act_body)
            bound_composite_subject = False
            bound_action_slots = set(slots)
            if normalized_slots:
                usable_slots = [slot for slot in normalized_slots if slot in slots]
                if not usable_slots:
                    usable_slots = [slots[0]]
                    warnings.append(
                        f"Progress {index}: the action named Persons {'+'.join(normalized_slots)}, which are outside the selected target {speaker_selection}; "
                        f"the action was rebound to Person {usable_slots[0]}."
                    )
                elif set(normalized_slots) != set(slots):
                    warnings.append(
                        f"Progress {index}: the action names Persons {'+'.join(normalized_slots)} inside the broader target {speaker_selection}; "
                        "it was kept as that selected subgroup action."
                    )
                bound_action_slots = set(usable_slots)
                bound_subject = _join_subject_fragments([action_subject_part_by_slot[slot] for slot in usable_slots])
                remainder = act_body[normalized_end:]
                if len(usable_slots) == 1:
                    remainder = _singularize_selected_action_predicate(remainder)
                    remainder = _remove_single_person_reciprocal_phrases(remainder)
                act_body = _join_subject_and_predicate(bound_subject, remainder)
                bound_composite_subject = True
            else:
                single_slot, single_end = _leading_single_person_reference(act_body)
                if single_slot:
                    chosen_slot = single_slot if single_slot in slots else slots[0]
                    if single_slot not in slots:
                        warnings.append(
                            f"Progress {index}: the action names Person {single_slot}, which is outside the selected target {speaker_selection}; "
                            f"it was rebound to Person {chosen_slot}."
                        )
                    bound_action_slots = {chosen_slot}
                    act_body = _join_subject_and_predicate(action_subject_part_by_slot[chosen_slot], act_body[single_end:])
                    bound_composite_subject = True
                else:
                    leading_possessive = re.match(r"(?i)^\s*(his|her)\b", act_body)
                    if leading_possessive:
                        possessive = leading_possessive.group(1)
                        pronoun = "he" if possessive.lower() == "his" else "she"
                        chosen_slot, exact_gender_match = _pronoun_slot_for_composite(pronoun, slots, profiles)
                        bound_action_slots = {chosen_slot}
                        bare_subject = f"Person {chosen_slot}'s"
                        act_body = _join_subject_and_predicate(bare_subject, act_body[leading_possessive.end():])
                        bound_composite_subject = True
                        if exact_gender_match:
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains possessive {possessive!r}; "
                                f"it was bound to the uniquely matching Person {chosen_slot}."
                            )
                        else:
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains ambiguous possessive {possessive!r}; "
                                f"it was rebound to the first selected Person {chosen_slot}."
                            )
                    leading_pronoun = None if leading_possessive else re.match(r"(?i)^\s*(he|she)\b", act_body)
                    if leading_pronoun:
                        pronoun = leading_pronoun.group(1)
                        chosen_slot, exact_gender_match = _pronoun_slot_for_composite(pronoun, slots, profiles)
                        bound_action_slots = {chosen_slot}
                        remainder = _singularize_selected_action_predicate(act_body[leading_pronoun.end():])
                        act_body = _join_subject_and_predicate(action_subject_part_by_slot[chosen_slot], remainder)
                        bound_composite_subject = True
                        if exact_gender_match:
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains the single-person pronoun {pronoun!r}; "
                                f"it was bound to the uniquely matching Person {chosen_slot}."
                            )
                        else:
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains the ambiguous single-person pronoun {pronoun!r}; "
                                f"it was rebound to the first selected Person {chosen_slot} so execution can continue without inventing a new actor."
                            )
                    generic_group = None if (leading_possessive or leading_pronoun) else _match_any_leading_generic_human_group(act_body)
                    if generic_group:
                        # Natural phrases such as ``a woman and a man``, ``two
                        # people`` or ``three people`` always bind inside the
                        # structured Progress target.  The free-text group count
                        # may describe a subgroup (2 inside A+B+C) or may exceed a
                        # smaller selected group; both are softly reconciled.
                        usable_slots = _generic_human_slots_for_composite_group(generic_group, slots, profiles)
                        bound_action_slots = set(usable_slots)
                        members = list(generic_group.get("members") or ())
                        decorated_parts = []
                        for pos, slot in enumerate(usable_slots):
                            part = action_subject_part_by_slot[slot]
                            if pos < len(members):
                                part = _decorate_profile_subject_with_generic_match(part, profiles[slot], members[pos])
                            decorated_parts.append(part)
                        bound_subject = _join_subject_fragments(decorated_parts)
                        remainder = act_body[generic_group["end"]:]
                        if len(usable_slots) == 1:
                            remainder = _singularize_selected_action_predicate(remainder)
                            remainder = _remove_single_person_reciprocal_phrases(remainder)
                        act_body = _join_subject_and_predicate(bound_subject, remainder)
                        bound_composite_subject = True
                        declared_count = int(generic_group.get("count") or len(members) or len(usable_slots))
                        if declared_count != len(slots):
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains natural wording for {declared_count} people; "
                                f"it was bound to {'+'.join(usable_slots)} inside the selected Progress group and execution continued."
                            )
                    else:
                        # A combined Progress may legitimately contain a sub-action
                        # led by only one selected person (for example "The woman
                        # looks out the window" while A+B participate in the row).
                        # Resolve the generic human to the configured cast instead
                        # of blocking on English grammar/subject shape.
                        partial_human = _match_leading_generic_human_subject(act_body)
                        if partial_human:
                            chosen_slot = _generic_human_slot_for_composite(partial_human, slots, profiles)
                            bound_action_slots = {chosen_slot}
                            bound_subject = _decorate_profile_subject_with_generic_match(
                                action_subject_part_by_slot[chosen_slot], profiles[chosen_slot], partial_human
                            )
                            act_body = _join_subject_and_predicate(bound_subject, act_body[partial_human.end:])
                            bound_composite_subject = True
                            warnings.append(
                                f"Progress {index}: the combined target {speaker_selection} contains a single-person action subject "
                                f"({partial_human.subject_text!r}); it was bound to Person {chosen_slot} and execution continued."
                            )

            leading_group = re.match(r"(?i)^\s*(?:they|the\s+(?:people|persons|characters)|the\s+on-screen\s+(?:person|people|persons)|the\s+visible\s+subjects?)\b", act_body)
            if leading_group:
                act_body = _join_subject_and_predicate(action_subject, act_body[leading_group.end():])
                bound_composite_subject = True
            else:
                act_body = re.sub(r"(?i)\bthe on-screen (?:person|people|persons)\b", action_subject, act_body)
                act_body = re.sub(r"(?i)\bthe visible subjects?\b", action_subject, act_body)
            if not bound_composite_subject and not act_body.lower().startswith(action_subject.lower()):
                selected_singing_predicate = _action_clearly_indicates_selected_singing(act_body)
                if (
                    not _action_starts_with_independent_subject(act_body)
                    and (_looks_like_targeted_action_predicate(act_body) or selected_singing_predicate)
                ):
                    predicate = act_body[:1].lower() + act_body[1:] if act_body else act_body
                    singing_predicate = (
                        _normalize_unbound_selected_singing_predicate(predicate, plural=True)
                        if selected_singing_predicate else None
                    )
                    if singing_predicate is not None:
                        predicate = singing_predicate
                    else:
                        first_word = re.match(r"([A-Za-z]+)", predicate or "")
                        if first_word and first_word.group(1).lower().endswith("ing") and _looks_like_targeted_action_predicate(first_word.group(1)):
                            predicate = "are " + predicate
                    act_body = _join_subject_and_predicate(action_subject, predicate)
            if action_subject.lower() in act_body.lower():
                act_body = _normalize_compound_action_predicate(act_body, action_subject)
            act = _terminate_action_sentence(act_body)
            if turn_prefix:
                act = _apply_timeline_time_prefix(act, elapsed_seconds)
            sentences.append(act)
            if bound_composite_subject:
                seen_profiles.update(bound_action_slots)
            elif action_subject.lower() in act_body.lower():
                seen_profiles.update(slots)
            turn_prefix = ""

    if dialogue_text:
        # Keep the dialogue subject list in the same S-ID order used by the
        # action sentence above, so a single composite Turn never flips Person
        # ordering between its action and dialogue clauses.
        dialogue_slots = list(subject_slots)
        subject_parts: List[str] = []
        sid_values: List[str] = []
        for slot in dialogue_slots:
            profile = profiles[slot]
            sid = profile.get('sid')
            _sid_number(sid)
            first_mention = sid not in seen_speakers
            subject_parts.append(_profile_fragment(
                slot, profile['gender'], profile['age'],
                appearance_desc=profile.get('appearance_desc', ''),
                clothing_desc=profile.get('clothing_desc', ''),
                voice_desc=profile.get('voice_desc', ''),
                include_visual=slot not in seen_profiles,
                include_voice=first_mention,
                compact_identity=slot in seen_profiles,
            ))
            sid_values.append(sid)
            seen_profiles.add(slot)
        for sid in sid_values:
            seen_speakers.add(sid)

        subject = _join_subject_fragments(subject_parts)
        sid_group = ",".join(sid_values)
        detected_lang = _detect_dialogue_language(dialogue_text)
        lang = detected_lang if dialogue_language == 'auto' else dialogue_language
        if dialogue_language != 'auto' and detected_lang in {"Korean", "Japanese", "Chinese", "Russian", "Arabic"} and dialogue_language != detected_lang:
            warnings.append(f"turn {index}: dialogue_language={dialogue_language} conflicts with detected {detected_lang} script; the manually selected tag was kept.")
        pre = turn_prefix
        if vocal_kind == 'singing':
            # Speaker IDs identify the coordinated subject itself, so attach
            # them directly after the full subject instead of treating the
            # ``(S1,S2) ...`` fragment as an action predicate.  The generic
            # subject/predicate joiner may otherwise add an appositive comma
            # after a profiled final Person, yielding
            # ``Person A ... and Person B ..., (S1,S2) sing together``.
            dialogue_sentence = f"{subject} ({sid_group}) sing together: <d>[{lang}] {dialogue_text}</d>"
            sentences.append(f"{pre}{dialogue_sentence}")
        elif dialogue_delivery == 'voiceover':
            group_subject = f"the combined speaker group consisting of {subject}" if pre else f"The combined speaker group consisting of {subject}"
            voiceover_sentence = f"{pre}{group_subject} ({sid_group}) says in an off-screen voiceover: <d>[{lang}] {dialogue_text}</d>"
            voiceover_sentence += _voiceover_closed_lips_clause(len(slots))
            sentences.append(voiceover_sentence)
        else:
            # As above, the S-ID group belongs directly to the coordinated
            # subject.  Keep a plain space here so profile/appositive commas
            # never leak into ``..., (S1,S2) say together``.
            # Real-world H3 testing showed that the documented compound-speaker
            # form often drives synchronized mouth motion but still collapses to
            # one audible voice.  For on-screen multi-person simultaneous speech,
            # add only the minimum reinforcement that consistently preserves
            # separate audible voices while keeping the original H3 compound
            # speaker structure intact.
            voice_count_phrase = None
            if len(slots) == 2:
                voice_count_phrase = "two"
                audible_phrase = "both voices"
            elif len(slots) == 3:
                voice_count_phrase = "three"
                audible_phrase = "all three voices"
            if voice_count_phrase:
                dialogue_sentence = (
                    f"{subject} ({sid_group}) say together in {voice_count_phrase} clearly distinct voices "
                    f"at the same time, with {audible_phrase} clearly audible, <d>[{lang}] {dialogue_text}</d>"
                )
            else:
                # Fallback for any future unexpected composite cardinality.
                dialogue_sentence = f"{subject} ({sid_group}) say together, <d>[{lang}] {dialogue_text}</d>"
            dialogue_sentence += _on_screen_speaking_clause(len(slots))
            sentences.append(f"{pre}{dialogue_sentence}")
    return sentences, warnings



def _terminate_action_sentence(body: str) -> str:
    """Close a Timeline action sentence without doubling user punctuation.

    ``act.rstrip('.')`` keeps a user's terminal ``!``/``?`` (or a closing
    quote after it); appending ``.`` then produced ``jumps!.``.
    """
    text = (body or "").rstrip()
    if re.search(r"[.!?\u2026][\"'\u201d\u2019)\]]*$", text):
        return text
    return text + "."


def _render_timeline_turn(
    index: int,
    mode: str,
    speaker_slot: str,
    elapsed_seconds: float,
    action_text: str,
    dialogue_text: str,
    dialogue_language: str,
    dialogue_delivery: str,
    profiles: dict,
    seen_profiles: set,
    seen_speakers: set,
) -> Tuple[List[str], List[str]]:
    speaker_slots = _speaker_slots(speaker_slot)
    if len(speaker_slots) > 1:
        return _render_timeline_turn_composite(
            index, mode, speaker_slot, elapsed_seconds, action_text, dialogue_text,
            dialogue_language, dialogue_delivery, profiles, seen_profiles, seen_speakers
        )

    warnings: List[str] = []
    sentences: List[str] = []
    action_text = (action_text or "").strip()
    dialogue_text = (dialogue_text or "").strip()
    if not action_text and not dialogue_text:
        return sentences, warnings
    vocal_kind = _vocal_event_kind(action_text, dialogue_text)
    _ensure_supported_vocal_delivery(index, vocal_kind, dialogue_delivery)
    if vocal_kind != 'singing':
        action_text, suppressed_speech_action = _suppress_redundant_unspecified_speech_action(
            action_text, bool(dialogue_text)
        )
        if suppressed_speech_action:
            warnings.append(
                f"Progress {index}: a contentless duplicate speech action was omitted because explicit dialogue already defines the spoken event."
            )

    turn_prefix = "" if elapsed_seconds <= 0 else f"At approximately {elapsed_seconds:.2f} seconds, "

    if action_text:
        raw_explicit_group, _ = _leading_composite_person_group(action_text)
        raw_explicit_slot, _ = _leading_single_person_reference(action_text)
        if not raw_explicit_group and raw_explicit_slot and raw_explicit_slot != speaker_slot:
            warnings.append(
                f"Progress {index}: the selected target is Person {speaker_slot}, but the action begins with Person {raw_explicit_slot}; "
                f"the structured Progress target was kept and the action was rebound to Person {speaker_slot}."
            )
        act, act_warn = _normalize_timeline_action(action_text, f"turn_{index}_action")
        warnings.extend(act_warn)
        if act:
            profile = profiles.get(speaker_slot, {'gender': 'unspecified', 'age': 'unspecified', 'appearance_desc': '', 'clothing_desc': '', 'voice_desc': '', 'sid': f'S?{speaker_slot}'})
            # Keep voice traits next to the first spoken line, where H3 can
            # associate them with the stable speaker ID. Action-only mentions
            # use identity/gender/age but do not consume the voice introduction.
            subject = _profile_fragment(
                speaker_slot, profile['gender'], profile['age'],
                appearance_desc=profile.get('appearance_desc', ''),
                clothing_desc=profile.get('clothing_desc', ''),
                include_visual=speaker_slot not in seen_profiles,
                compact_identity=speaker_slot in seen_profiles,
            )
            act_body = act.rstrip('.')

            # A single-target Progress can receive contradictory free text such
            # as ``Person A and Person B smile`` or ``both people smile``.
            # Previously the single-person parser consumed only the first Person
            # token, producing malformed output (for example ``Person A and
            # Person B smile`` after an unrelated profile fragment).  Keep the
            # structured single target authoritative, collapse only the clearly
            # leading multi-person subject, and continue with a warning instead
            # of blocking the queue.
            explicit_group, explicit_group_end = _leading_composite_person_group(act_body)
            generic_group = None if explicit_group else _match_any_leading_generic_human_group(act_body)
            if explicit_group:
                remainder = _singularize_selected_action_predicate(act_body[explicit_group_end:])
                remainder = _remove_single_person_reciprocal_phrases(remainder)
                act_body = _join_subject_and_predicate(subject, remainder)
                warnings.append(
                    f"Progress {index}: the selected target is Person {speaker_slot}, but the action begins with multiple people "
                    f"({' + '.join('Person ' + slot for slot in explicit_group)}); the action was rebound to Person {speaker_slot}."
                )
            elif generic_group:
                raw_remainder = act_body[generic_group['end']:]
                single_member_postmodifier = (
                    int(generic_group.get("count") or 0) == 1
                    and bool(generic_group.get("members"))
                    and bool(_GENERIC_POSTMODIFIER_PREFIX_RE.match(raw_remainder.strip()))
                )
                if single_member_postmodifier:
                    act_body = _bind_single_generic_postmodifier(subject, raw_remainder)
                else:
                    remainder = _singularize_selected_action_predicate(raw_remainder)
                    remainder = _remove_single_person_reciprocal_phrases(remainder)
                    act_body = _join_subject_and_predicate(subject, remainder)
                warnings.append(
                    f"Progress {index}: the selected target is Person {speaker_slot}, but the action begins with multi-person wording "
                    f"({act[:generic_group['end']].strip()!r}); the action was rebound to Person {speaker_slot}."
                )
            else:
                # The Turn selector is the authority for A/B/C ownership. A
                # conflicting explicit single Person is softly rebound.
                explicit_slot, explicit_end = _leading_single_person_reference(act_body)
                if explicit_slot:
                    if explicit_slot != speaker_slot:
                        warnings.append(
                            f"Progress {index}: action subject Person {explicit_slot} conflicted with the selected Person {speaker_slot}; "
                            f"the action was rebound to Person {speaker_slot}."
                        )
                    act_body = _join_subject_and_predicate(subject, act_body[explicit_end:])
                else:
                    binding = _bind_leading_single_action_subject(act_body, subject, profile)
                    act_body = binding.text
                    if binding.profile_intro_needed and speaker_slot not in seen_profiles:
                        sentences.append(_ensure_terminal_punctuation(f"{subject}, is present in the scene"))
                        seen_profiles.add(speaker_slot)

                    # Generic person wording later in the sentence is rebound in-place.
                    # Leading forms are handled above so configured Person identity
                    # remains authoritative without creating an unnamed second actor.
                    if not binding.matched:
                        act_body = re.sub(r"(?i)\bthe on-screen person\b", subject, act_body)
                        act_body = re.sub(r"(?i)\bthe visible subject\b", subject, act_body)
            act_body = _normalize_bound_single_person_pronouns(
                act_body, speaker_slot, profile.get('gender', 'unspecified')
            )
            if not re.match(r"(?i)^person\s+[ABC]\b", act_body) and not _action_starts_with_independent_subject(act_body):
                selected_singing_predicate = _action_clearly_indicates_selected_singing(act_body)
                if (
                    not act_body.lower().startswith(subject.lower())
                    and (_looks_like_targeted_action_predicate(act_body) or selected_singing_predicate)
                ):
                    predicate = act_body
                    singing_predicate = (
                        _normalize_unbound_selected_singing_predicate(predicate, plural=False)
                        if selected_singing_predicate else None
                    )
                    predicate = (
                        singing_predicate
                        if singing_predicate is not None
                        else _singularize_targeted_action_predicate(predicate)
                    )
                    act_body = _join_subject_and_predicate(subject, predicate)
            act = _terminate_action_sentence(act_body)
            if turn_prefix:
                act = _apply_timeline_time_prefix(act, elapsed_seconds)
            sentences.append(act)
            if subject.lower() in act_body.lower():
                seen_profiles.add(speaker_slot)
            turn_prefix = ""

    if dialogue_text:
        if speaker_slot not in profiles:
            raise ValueError(f"Unknown turn speaker: {speaker_slot}")
        profile = profiles[speaker_slot]
        sid = profile.get('sid')
        _sid_number(sid)
        first_mention = sid not in seen_speakers
        subject = _profile_fragment(
            speaker_slot, profile['gender'], profile['age'],
            appearance_desc=profile.get('appearance_desc', ''),
            clothing_desc=profile.get('clothing_desc', ''),
            voice_desc=profile.get('voice_desc', ''),
            include_visual=speaker_slot not in seen_profiles,
            include_voice=first_mention,
            compact_identity=speaker_slot in seen_profiles,
        )
        seen_profiles.add(speaker_slot)
        seen_speakers.add(sid)
        detected_lang = _detect_dialogue_language(dialogue_text)
        lang = detected_lang if dialogue_language == 'auto' else dialogue_language
        if dialogue_language != 'auto' and detected_lang in {"Korean", "Japanese", "Chinese", "Russian", "Arabic"} and dialogue_language != detected_lang:
            warnings.append(f"turn {index}: dialogue_language={dialogue_language} conflicts with detected {detected_lang} script; the manually selected tag was kept.")
        pre = turn_prefix
        if vocal_kind == 'singing':
            sentences.append(f"{pre}{subject} ({sid}) sings: <d>[{lang}] {dialogue_text}</d>")
        elif dialogue_delivery == 'voiceover':
            voiceover_sentence = f"{pre}{subject} ({sid}) says in an off-screen voiceover: <d>[{lang}] {dialogue_text}</d>"
            voiceover_sentence += _voiceover_closed_lips_clause(1)
            sentences.append(voiceover_sentence)
        else:
            # The node never analyzes reference pixels, so it must not claim that
            # a specific A/B/C speaker is visibly present in Picture 1.
            on_screen_sentence = f"{pre}{subject} ({sid}) says: <d>[{lang}] {dialogue_text}</d>"
            on_screen_sentence += _on_screen_speaking_clause(1)
            sentences.append(on_screen_sentence)
    return sentences, warnings




def _render_narrator_vocal_event(
    index: int,
    elapsed_seconds: float,
    event: dict,
    profiles: dict,
    seen_speakers: set,
) -> Tuple[List[str], List[str]]:
    text = str(event.get("text", "") or "").strip()
    if not text:
        return [], []
    profile = profiles.get("Narrator", {})
    sid = profile.get("sid")
    _sid_number(sid)
    first_mention = sid not in seen_speakers
    seen_speakers.add(sid)
    voice_desc = _clean_voice_desc_for_subject(profile.get("voice_desc", ""))
    subject = "the independent narrator"
    if first_mention and voice_desc:
        if _contains_non_english_body_script(voice_desc):
            subject += f" with voice characteristics: {voice_desc}"
        else:
            spoken_voice = re.sub(r"^(?:a|an)\s+", "", voice_desc, flags=re.I)
            if spoken_voice and spoken_voice[:1].isupper() and not re.match(r"^[A-Z]{2,}(?:\b|$)", spoken_voice):
                spoken_voice = spoken_voice[:1].lower() + spoken_voice[1:]
            article = "an" if spoken_voice[:1].lower() in "aeiou" else "a"
            subject += f" with {article} {spoken_voice}"
    detected_lang = _detect_dialogue_language(text)
    language = str(event.get("language", "auto") or "auto")
    lang = detected_lang if language == "auto" else language
    warnings: List[str] = []
    if language != "auto" and detected_lang in {"Korean", "Japanese", "Chinese", "Russian", "Arabic"} and language != detected_lang:
        warnings.append(
            f"turn {index}: dialogue_language={language} conflicts with detected {detected_lang} script; the manually selected tag was kept."
        )
    prefix = "" if elapsed_seconds <= 0 else f"At approximately {elapsed_seconds:.2f} seconds, "
    return [f"{prefix}{subject} ({sid}) says in an off-screen voiceover: <d>[{lang}] {text}</d>"], warnings


def _render_timeline_turn_with_vocal_events(
    turn: dict,
    mode: str,
    profiles: dict,
    seen_profiles: set,
    seen_speakers: set,
) -> Tuple[List[str], List[str]]:
    """Render one Progress action plus zero-to-three normalized vocal events."""
    events = _turn_vocal_events(turn)
    target = turn.get("speaker", "A")
    action = str(turn.get("action", "") or "")
    elapsed = float(turn.get("elapsed_seconds", 0.0))
    # Preserve the exact legacy path whenever the new feature is inactive, or
    # when it is ON but semantically identical to the old single-dialogue row.
    if not _turn_uses_sequential_renderer(turn):
        return _render_timeline_turn(
            int(turn.get("index", 1)), mode, target, elapsed,
            action, turn.get("dialogue_text", ""), turn.get("dialogue_language", "auto"),
            turn.get("dialogue_delivery", "on_screen"), profiles, seen_profiles, seen_speakers,
        )

    if len(events) > 1 and any(_vocal_event_kind(action, event.get("text", "")) == "singing" for event in events):
        raise _UserInputError(
            f"Turn {turn.get('index', 1)} uses multiple sequential vocal events with singing/lyrics. "
            "Keep singing on the existing single-vocal path or split the song into separate Progress rows."
        )

    sentences: List[str] = []
    warnings: List[str] = []
    if action and events and not any(_vocal_event_kind(action, event.get("text", "")) == "singing" for event in events):
        action, suppressed_speech_action = _suppress_redundant_unspecified_speech_action(action, True)
        if suppressed_speech_action:
            warnings.append(
                f"Progress {turn.get('index', 1)}: a contentless duplicate speech action was omitted because explicit dialogue already defines the spoken event."
            )
    if action:
        action_sentences, action_warnings = _render_timeline_turn(
            int(turn.get("index", 1)), mode, target, elapsed,
            action, "", "auto", "on_screen", profiles, seen_profiles, seen_speakers,
        )
        sentences.extend(action_sentences)
        warnings.extend(action_warnings)

    for position, event in enumerate(events):
        event_elapsed = elapsed if position == 0 and not action else 0.0
        source = str(event.get("speaker", target) or target)
        if source == "Narrator":
            event_sentences, event_warnings = _render_narrator_vocal_event(
                int(turn.get("index", 1)), event_elapsed, event, profiles, seen_speakers,
            )
        else:
            event_sentences, event_warnings = _render_timeline_turn(
                int(turn.get("index", 1)), mode, source, event_elapsed,
                "", event.get("text", ""), event.get("language", "auto"),
                event.get("delivery", "on_screen"), profiles, seen_profiles, seen_speakers,
            )
        warnings.extend(event_warnings)
        if (action or position > 0) and event_sentences:
            first = str(event_sentences[0])
            if first.startswith("At approximately "):
                first = re.sub(r"^At approximately [0-9.]+ seconds,\s*", "", first)
            # ``Then,`` continues the same sentence flow.  Common-noun subjects
            # beginning with ``The`` must therefore stay lower-case (for example
            # ``Then, the combined speaker group ...``), while stable Person labels
            # remain capitalized.
            if first.lower().startswith(("the independent narrator", "the combined speaker group")):
                event_sentences[0] = "Then, " + first[:1].lower() + first[1:]
            else:
                event_sentences[0] = "Then, " + first[:1].upper() + first[1:]
        sentences.extend(event_sentences)
    return sentences, warnings


def _align_turn_sentences_with_environment(sentences: Sequence[str], elapsed_seconds: float, has_environment_change: bool) -> List[str]:
    if not has_environment_change or elapsed_seconds <= 1e-9:
        return list(sentences)
    prefix = f"At approximately {float(elapsed_seconds):.2f} seconds, "
    aligned: List[str] = []
    replaced = False
    for sentence in sentences:
        value = str(sentence or "")
        if not replaced and value.startswith(prefix):
            value = "At the same moment, " + value[len(prefix):]
            replaced = True
        aligned.append(value)
    return aligned

def _timeline_event_has_content(event: dict) -> bool:
    seq = event.get("sequential_vocal") if isinstance(event.get("sequential_vocal"), dict) else {}
    has_raw_sequential_dialogue = bool(
        seq.get("enabled")
        and any(str(seq.get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
    )
    return bool(
        (event.get("action") or "").strip()
        or _turn_vocal_events(event)
        or has_raw_sequential_dialogue
        or (event.get("dialogue_text") or "").strip()
        or _turn_scene_has_change(event)
    )


def _sort_timeline_events(turns: Sequence[dict], person_count: int, duration_seconds: float) -> Tuple[List[dict], List[str]]:
    """Validate and stably sort events by time, then by row for exact ties."""
    warnings: List[str] = []
    active_slots = set(("A", "B", "C")[:person_count])
    normalized: List[dict] = []
    for position, source in enumerate(turns):
        turn = dict(source)
        source_index = int(turn.get("source_turn_index", turn.get("index", position + 1)))
        raw_speaker = _canonical_choice(turn.get("speaker", "A"), TURN_SPEAKER_VALUES, "turn_speaker")
        speaker = _coerce_speaker_selection_to_active(raw_speaker, person_count)
        if speaker != raw_speaker:
            warnings.append(
                f"Progress {source_index}: target {raw_speaker} was outside person_count={person_count}; "
                f"it was repaired to {speaker}."
            )
        raw_turn_time = turn.get("elapsed_seconds", 0.0)
        try:
            turn_time = float(raw_turn_time)
        except (TypeError, ValueError):
            turn_time = float("nan")
        if not math.isfinite(turn_time):
            warnings.append(
                f"Progress {source_index}: start time {raw_turn_time!r} was not a usable number; it was repaired to 0.0s."
            )
            turn_time = 0.0
        max_start = max(0.0, float(duration_seconds) - 0.5)
        repaired_time = min(max(turn_time, 0.0), max_start)
        repaired_time = _snap_half_second(repaired_time)
        repaired_time = min(max(repaired_time, 0.0), max_start)
        if abs(repaired_time - turn_time) > 1e-9:
            warnings.append(
                f"Progress {source_index}: start time {turn_time:.3f}s was outside the usable 0.5-second Timeline grid; "
                f"it was repaired to {repaired_time:.1f}s."
            )
            turn_time = repaired_time
        turn["source_turn_index"] = source_index
        turn["speaker"] = speaker
        turn["elapsed_seconds"] = turn_time
        turn["order"] = int(turn.get("order", position))
        normalized.append(turn)

    normalized.sort(key=lambda turn: (
        float(turn["elapsed_seconds"]),
        int(turn["source_turn_index"]),
        int(turn.get("order", 0)),
    ))
    for index, turn in enumerate(normalized, start=1):
        turn["index"] = index
        if index > 1 and float(turn["elapsed_seconds"]) == float(normalized[index - 2]["elapsed_seconds"]):
            warnings.append(
                f"Timeline events {index - 1} and {index} share the same start time; H3 may interpret them as overlapping."
            )
    return normalized, warnings


def _profile_has_explicit_visual_settings(profile: dict) -> bool:
    profile = profile or {}
    return (
        profile.get("gender", "unspecified") != "unspecified"
        or profile.get("age", "unspecified") != "unspecified"
        or profile.get("appearance_preset", "none") != "none"
        or profile.get("clothing_preset", "none") != "none"
        or bool(str(profile.get("extension_appearance", "") or "").strip())
        or bool(str(profile.get("appearance_desc", "") or "").strip())
        or bool(str(profile.get("clothing_desc", "") or "").strip())
    )


def build_h3_prompt_timeline(
    scene_prompt: str,
    mode: str,
    duration_seconds: float,
    visual_style: str,
    camera_motion: str,
    camera_amplitude: str,
    camera_speed: str,
    reference_fidelity: str,
    soundscape_mode: str,
    sound_hint: str,
    music_mode: str,
    music_hint: str,
    scene_translate: str,
    person_count: int,
    profiles: dict,
    turns: list,
    start_image=None,
    end_image=None,
    camera_sequence_enabled: bool = False,
    i2va_preserve_reference_clothing: bool = True,
    camera_shot_count: int = 2,
    camera_shot_1_target: str = "current_action",
    camera_shot_1_framing: str = "auto",
    camera_extra_shots: Optional[Sequence[dict]] = None,
    scene_baseline: Optional[dict] = None,
    narrator_voice_desc: str = "",
    preserve_timeline_dialogue_verbatim: bool = True,
    initial_warnings: Optional[Sequence[str]] = None,
) -> Tuple[str, str]:
    warnings: List[str] = list(initial_warnings or [])
    duration_seconds = _validate_duration_seconds(duration_seconds)
    profiles = {slot: dict(profile) for slot, profile in (profiles or {}).items()}
    # Future per-person fields should be merged here so they automatically
    # participate in person-count hide/show preservation and later expansion.
    turns = [dict(turn) for turn in (turns or [])]
    resolved_mode, mode_warnings = _resolve_mode(mode, start_image, end_image)
    warnings.extend(mode_warnings)
    person_count = _validate_int_field(person_count, "person_count", 1, 3)
    active_person_slots = tuple("ABC")[:person_count]
    reference_clothing_lock_active = (
        resolved_mode == "i2va" and bool(i2va_preserve_reference_clothing)
    )
    ignored_clothing_slots: List[str] = []

    camera_sequence = _normalize_camera_sequence(
        bool(camera_sequence_enabled), camera_shot_count, camera_shot_1_target, camera_shot_1_framing, camera_motion,
        camera_amplitude, camera_speed, camera_extra_shots or [], person_count, duration_seconds, warnings=warnings,
    )
    if not camera_sequence:
        camera_shot_1_target = _canonical_choice(camera_shot_1_target, CAMERA_TARGET_VALUES, "camera_target")
        allowed_targets = set(_allowed_camera_targets(person_count))
        if camera_shot_1_target not in allowed_targets:
            original_target = camera_shot_1_target
            camera_shot_1_target = "current_action" if "current_action" in allowed_targets else sorted(allowed_targets)[0]
            warnings.append(
                f"Camera Shot 1 target {original_target!r} is unavailable for person_count={person_count}; it was repaired to {camera_shot_1_target!r}."
            )
        # Preserve legacy single-shot framing compatibility. Multi-shot uses a
        # stricter target/framing matrix; the long-standing single-shot path
        # allowed its framing control independently of the target.
        camera_shot_1_framing = _canonical_choice(camera_shot_1_framing, CAMERA_FRAMING_VALUES, "camera_framing")
    camera_target_slots = {
        slot
        for shot in camera_sequence
        for slot in _camera_target_slots(shot.get("target", "current_action"))
    }
    if not camera_sequence:
        camera_target_slots.update(_camera_target_slots(camera_shot_1_target))

    scene_prompt = _clean_scene_text(scene_prompt, max_chars=20_000)
    _reject_reserved_timeline_structure(scene_prompt, "scene_prompt")
    # Scene structural labels are authoritative visual-presence evidence too.
    # Keep them separate from Timeline/Camera activity so a Person mentioned in
    # the shared scene cannot silently lose an explicitly configured profile
    # merely because another Person has a Timeline event.  Do not fold these
    # slots into camera timing; they are used only for profile availability.
    scene_profile_slots = {
        slot for slot in _scene_structural_person_slots(scene_prompt)
        if slot in active_person_slots
    }
    sound_hint = _clean_text(sound_hint, max_chars=2_000, preserve_newlines=False)
    music_hint = _clean_text(music_hint, max_chars=2_000, preserve_newlines=False)
    _reject_reserved_timeline_structure(sound_hint, "sound_hint")
    _reject_reserved_timeline_structure(music_hint, "music_hint")
    if sound_hint and soundscape_mode != "silent":
        sound_hint, hint_warnings = _translate_korean_descriptive_text_if_needed(sound_hint, "sound_hint", translate_mode=scene_translate)
        warnings.extend(hint_warnings)
    if music_hint and music_mode != "none":
        music_hint, hint_warnings = _translate_korean_descriptive_text_if_needed(music_hint, "music_hint", translate_mode=scene_translate)
        warnings.extend(hint_warnings)
    warnings.extend(_timeline_body_language_warnings(sound_hint, "sound_hint"))
    warnings.extend(_timeline_body_language_warnings(music_hint, "music_hint"))

    # Keep one normalized pre-lock snapshot for the authoritative profile
    # safety check. I2VA's reference-clothing lock may intentionally remove
    # clothing directives from the generation copy, but it must never erase
    # the user's original built-in preset before that preset is validated.
    safety_profiles = {}

    for slot in ('A', 'B', 'C'):
        if slot not in profiles:
            continue
        profiles[slot].setdefault("gender", "unspecified")
        profiles[slot].setdefault("age", "unspecified")
        profiles[slot].setdefault("appearance_preset", "none")
        profiles[slot].setdefault("clothing_preset", "none")
        profiles[slot]["gender"] = _canonical_choice(profiles[slot].get("gender", "unspecified"), GENDER_VALUES, "gender")
        profiles[slot]["age"] = _canonical_choice(profiles[slot].get("age", "unspecified"), AGE_VALUES, "age")
        profiles[slot]["appearance_preset"] = _canonical_choice(profiles[slot].get("appearance_preset", "none"), APPEARANCE_PRESET_VALUES, "appearance_preset")
        profiles[slot]["clothing_preset"] = _canonical_choice(profiles[slot].get("clothing_preset", "none"), CLOTHING_PRESET_VALUES, "clothing_preset")
        for key, max_chars in (("appearance_desc", 1000), ("clothing_desc", 1000), ("voice_desc", 500)):
            field_name = f"person_{slot.lower()}_{key}"
            value = _clean_text(profiles[slot].get(key, ''), max_chars=max_chars, preserve_newlines=False)
            _reject_reserved_timeline_structure(value, field_name)
            profiles[slot][key] = value

        # Snapshot the normalized user profile before the I2VA clothing lock
        # mutates the compiler-local generation copy.
        safety_profiles[slot] = dict(profiles[slot])

        # I2VA reference-clothing lock is intentionally independent from the
        # per-person clothing controls. Preserve the user's serialized/UI values
        # outside this compiler-local profile copy, but remove clothing directives
        # from the generation copy so presets/free text cannot compete with the
        # start-image wardrobe. Turning the lock OFF restores normal V1.9 behavior.
        if reference_clothing_lock_active:
            if (
                profiles[slot].get("clothing_preset", "none") != "none"
                or bool(str(profiles[slot].get("clothing_desc", "") or "").strip())
            ):
                ignored_clothing_slots.append(slot)
            profiles[slot]["clothing_preset"] = "none"
            profiles[slot]["clothing_desc"] = ""

    # Repair stale built-in adult-only presets after an age change instead of
    # blocking the whole queue. Only the built-in preset is dropped; free-text
    # profile instructions remain untouched.
    for slot in active_person_slots:
        repair_warnings = _repair_profile_safety(slot, profiles.get(slot, {}))
        if repair_warnings:
            warnings.extend(repair_warnings)
            # Keep the normalized safety snapshot consistent with the generation
            # copy for downstream diagnostics.
            safety_profiles[slot] = dict(profiles.get(slot, {}))

    turns, sort_warnings = _sort_timeline_events(turns, person_count, duration_seconds)
    warnings.extend(sort_warnings)
    for turn in turns:
        turn["vocal_events"] = _normalize_turn_vocal_events(
            turn, person_count, preserve_verbatim=preserve_timeline_dialogue_verbatim
        )
        warnings.extend(turn.pop("_soft_warnings", []))
    opening_environment_state, turns = _resolve_environment_timeline(turns, scene_baseline or {}, visual_style)
    warnings.extend(_temporal_visual_density_warnings(turns, camera_sequence, duration_seconds))
    warnings.extend(_camera_semantic_compatibility_warnings(
        turns,
        camera_sequence,
        single_target=camera_shot_1_target,
        single_framing=camera_shot_1_framing,
        profiles=profiles,
        active_person_slots=active_person_slots,
    ))
    opening_environment_sentence = _environment_state_sentence(
        opening_environment_state.get("location", "none"),
        opening_environment_state.get("weather", "none"),
        visual_style,
    )

    active_visual_slots = {
        slot
        for turn in turns
        if (turn.get("action") or "").strip()
        for slot in _speaker_slots(turn.get('speaker', 'A'))
    } | {
        slot
        for turn in turns
        for event in _turn_vocal_events(turn)
        if event.get("speaker") != "Narrator"
        for slot in _speaker_slots(event.get("speaker", "A"))
    } | camera_target_slots

    # A common H3 workflow uses scene_prompt as the complete visual/action
    # instruction and leaves the first Timeline row empty. Previously that made
    # every selected person profile a silent no-op. When there is no real
    # Timeline event at all, keep explicitly configured active-person profiles
    # in the final H3 prompt instead of discarding them. Do not invent profiles
    # for untouched/default rows, and preserve the existing turn-attached
    # rendering whenever at least one Timeline event actually targets a person.
    standalone_profile_slots = set()
    if not active_visual_slots:
        for slot in active_person_slots:
            profile = profiles.get(slot, {})
            if _profile_has_explicit_visual_settings(profile):
                standalone_profile_slots.add(slot)

    profile_visual_slots = active_visual_slots | standalone_profile_slots | scene_profile_slots
    for slot in profile_visual_slots:
        if slot not in profiles:
            continue
        # Canonical presets are already English. Translate only the user's
        # additional free text, then merge the two so translation can never
        # rewrite or weaken the preset phrase.
        profile_detail_keys = ("appearance_desc",) if reference_clothing_lock_active else ("appearance_desc", "clothing_desc")
        for key in profile_detail_keys:
            field_name = f"person_{slot.lower()}_{key}"
            value, field_warnings = _translate_korean_descriptive_text_if_needed(profiles[slot].get(key, ''), field_name, translate_mode=scene_translate)
            warnings.extend(field_warnings)
            warnings.extend(_timeline_body_language_warnings(value, field_name))
            profiles[slot][key] = value
        profiles[slot]["appearance_desc"] = _merge_profile_detail_text(
            profiles[slot].get("appearance_preset", "none"),
            APPEARANCE_PRESET_TEXT,
            profiles[slot].get("appearance_desc", ""),
        )
        profiles[slot]["appearance_desc"] = _merge_extension_profile_text(
            [profiles[slot].get("extension_appearance", "")],
            profiles[slot]["appearance_desc"],
        )
        profiles[slot]["clothing_desc"] = _merge_profile_detail_text(
            profiles[slot].get("clothing_preset", "none"),
            CLOTHING_PRESET_TEXT,
            profiles[slot].get("clothing_desc", ""),
        )

    vocal_slots = {
        slot
        for turn in turns
        for event in _turn_vocal_events(turn)
        if event.get("speaker") != "Narrator"
        for slot in _speaker_slots(event.get("speaker", "A"))
    }
    for slot in vocal_slots:
        if slot not in profiles:
            continue
        field_name = f"person_{slot.lower()}_voice_desc"
        voice_desc = profiles[slot].get('voice_desc', '')
        voice_desc, voice_warnings = _translate_korean_descriptive_text_if_needed(voice_desc, field_name, translate_mode=scene_translate)
        warnings.extend(voice_warnings)
        warnings.extend(_timeline_body_language_warnings(voice_desc, field_name))
        profiles[slot]['voice_desc'] = voice_desc

    narrator_voice_desc = _clean_text(narrator_voice_desc, max_chars=1_000, preserve_newlines=False)
    _reject_reserved_timeline_structure(narrator_voice_desc, "narrator_voice_desc")
    if any(event.get("speaker") == "Narrator" for turn in turns for event in _turn_vocal_events(turn)) and narrator_voice_desc:
        narrator_voice_desc, narrator_voice_warnings = _translate_korean_descriptive_text_if_needed(
            narrator_voice_desc, "narrator_voice_desc", translate_mode=scene_translate
        )
        warnings.extend(narrator_voice_warnings)
        warnings.extend(_timeline_body_language_warnings(narrator_voice_desc, "narrator_voice_desc"))

    for turn in turns:
        source_turn_index = int(turn.get('source_turn_index', turn['index']))
        action_field = f"turn_{source_turn_index}_action"
        turn['action'] = _clean_text(turn.get('action', ''), max_chars=4_000, preserve_newlines=False)
        if preserve_timeline_dialogue_verbatim:
            turn['dialogue_text'] = _clean_timeline_dialogue_verbatim(turn.get('dialogue_text', ''), max_chars=4_000)
        else:
            turn['dialogue_text'] = _clean_text(turn.get('dialogue_text', ''), max_chars=4_000, preserve_newlines=False)
        _reject_reserved_timeline_structure(turn['action'], action_field)
        _reject_reserved_timeline_structure(turn['dialogue_text'], f"turn_{source_turn_index}_dialogue_text")
        action_slots = _speaker_slots(turn.get('speaker', 'A'))
        turn['action'], action_warnings = _translate_korean_descriptive_text_if_needed(
            turn['action'], action_field,
            action_target_count=len(action_slots),
            action_target_slots=action_slots,
            person_gender_by_slot={
                slot: profiles.get(slot, {}).get('gender', 'unspecified')
                for slot in ('A', 'B', 'C')
            },
            translate_mode=scene_translate,
        )
        warnings.extend(action_warnings)

    if re.search(r"(?:\|\||→|->|---+|(?i:CUT:))", scene_prompt):
        scene_prompt = re.sub(r"\s*(?:\|\||→|->|---+|(?i:CUT:))\s*", ". ", scene_prompt)
        scene_prompt = re.sub(r"(?:\.\s*){2,}", ". ", scene_prompt).strip()
        warnings.append(
            "scene_prompt contained a legacy cut/shot separator; it was normalized to ordinary sentence punctuation. "
            "Timeline/Shot controls remain authoritative for actual temporal cuts."
        )

    scene_prompt, scene_warnings = _translate_scene_prompt_if_needed(scene_prompt, scene_translate)
    warnings.extend(scene_warnings)
    _reject_reserved_timeline_structure(scene_prompt, "translated scene_prompt")
    inactive_scene_slots = [slot for slot in _scene_structural_person_slots(scene_prompt) if slot not in active_person_slots]
    if inactive_scene_slots:
        fallback_slot = active_person_slots[-1]
        inactive_set = set(inactive_scene_slots)
        scene_prompt = re.sub(
            r"(?i)\bPerson\s+([ABC])\b",
            lambda m: f"Person {fallback_slot}" if m.group(1).upper() in inactive_set else f"Person {m.group(1).upper()}",
            scene_prompt,
        )
        warnings.append(
            f"scene_prompt referenced inactive {', '.join(f'Person {slot}' for slot in inactive_scene_slots)} for person_count={person_count}; "
            f"those structural labels were rebound to Person {fallback_slot}."
        )
    warnings.extend(_timeline_scene_language_warning(scene_prompt, scene_translate))

    # H3 S-IDs are voice identities, not character-slot numbers. Assign them
    # from the first actual vocal event in timeline order. Equal timestamps keep
    # the existing Turn order as a deterministic tie-breaker.
    profiles = _assign_timeline_speaker_ids(profiles, turns, narrator_voice_desc=narrator_voice_desc)

    for pos, turn in enumerate(turns[:-1]):
        if not _turn_vocal_events(turn):
            continue
        next_time = float(turns[pos + 1]['elapsed_seconds'])
        current_time = float(turn['elapsed_seconds'])
        window = max(0.0, next_time - current_time)
        if _turn_uses_sequential_renderer(turn):
            estimated = _turn_spoken_seconds(turn)
            if window > 0.0 and estimated > window * 1.10:
                warnings.append(
                    f"Turn {turn['index']} sequential dialogue is estimated at about {estimated:.1f}s, "
                    f"but the next Turn starts only {window:.1f}s later; the spoken sequence may overlap the next event."
                )
        else:
            dialogue_text = turn.get('dialogue_text', '')
            estimated = _estimate_spoken_seconds(dialogue_text)
            if window > 0.0 and estimated > window * 1.10:
                warnings.append(
                    f"Turn {turn['index']} dialogue is estimated at about {estimated:.1f}s, "
                    f"but the next Turn starts only {window:.1f}s later; the spoken line may overlap the next event."
                )

    # T2VA has no visual reference to fall back on. Do not invent an unnamed
    # subject/action when the user supplied no scene, action, or dialogue.
    if resolved_mode == 't2va' and not scene_prompt and not opening_environment_sentence and not any(
        (turn.get('action') or '').strip() or bool(_turn_vocal_events(turn)) or bool(turn.get("environment_change_sentence")) for turn in turns
    ):
        raise _UserInputError(
            "T2VA timeline requires scene_prompt, a base scene/weather preset, or at least one Progress action/dialogue/environment change. "
            "No generic subject, environment, or action was invented."
        )

    body_sentences: List[str] = []
    style_sentence = _style_sentence(visual_style, resolved_mode, scene_prompt)
    warnings.extend(_style_conflict_warnings(visual_style, scene_prompt))
    shot_count = len(camera_sequence) if camera_sequence else 1
    ref_sentence = _reference_sentence_for_shots(
        resolved_mode, reference_fidelity, shot_count,
        action_requested=any((turn.get("action") or "").strip() for turn in turns),
    )
    reference_clothing_sentence = _reference_clothing_lock_sentence(
        resolved_mode, reference_clothing_lock_active
    )
    backdrop = _ensure_terminal_punctuation(scene_prompt) if scene_prompt else ""
    selected_visual_sentence = _selected_visual_requirements_sentence(
        active_person_slots, profiles, opening_environment_state, turns, visual_style
    )
    profile_continuity_sentence = _selected_profile_continuity_sentence(active_person_slots, profiles)

    seen_profiles: set = set()
    seen_speakers: set = set()
    all_dialogue_texts: List[str] = []

    if not camera_sequence:
        # Preserve the established single-shot compiler behavior whenever
        # multiple-camera shooting is disabled.
        if style_sentence:
            body_sentences.append(style_sentence)
        if ref_sentence:
            body_sentences.append(ref_sentence)
        if reference_clothing_sentence:
            body_sentences.append(reference_clothing_sentence)
        if backdrop:
            body_sentences.append(backdrop)
        if opening_environment_sentence:
            body_sentences.append(opening_environment_sentence)
        if selected_visual_sentence:
            body_sentences.append(selected_visual_sentence)
        # Keep the historical default (current_action + auto) byte-identical.
        # Explicit Shot 1 targets now affect single-shot output instead of being
        # silently ignored. Legacy current_action + non-auto framing keeps the
        # established generic framing sentence.
        if camera_shot_1_target == "current_action":
            opening_camera_sentence = _single_shot_framing_sentence(camera_shot_1_framing)
        else:
            opening_camera_sentence = _camera_target_opening_sentence(camera_shot_1_target, camera_shot_1_framing)
        if opening_camera_sentence:
            body_sentences.append(opening_camera_sentence)
        camera_sentence, camera_warnings = _camera_sentence(camera_motion, camera_amplitude, camera_speed)
        warnings.extend(camera_warnings)
        if camera_sentence:
            body_sentences.append(camera_sentence)

        for slot in active_person_slots:
            if slot not in standalone_profile_slots:
                continue
            profile = profiles[slot]
            fragment = _profile_fragment(
                slot, profile.get("gender", "unspecified"), profile.get("age", "unspecified"),
                appearance_desc=profile.get("appearance_desc", ""),
                clothing_desc=profile.get("clothing_desc", ""),
                include_visual=True,
            )
            if fragment != f"Person {slot}":
                body_sentences.append(_ensure_terminal_punctuation(f"{fragment}, is present in the scene"))
                seen_profiles.add(slot)

        timeline_insert_index = len(body_sentences)

        for turn in turns:
            if turn.get("environment_change_sentence"):
                body_sentences.append(turn["environment_change_sentence"])
            sents, turn_warnings = _render_timeline_turn_with_vocal_events(
                turn, resolved_mode, profiles, seen_profiles, seen_speakers
            )
            warnings.extend(turn_warnings)
            sents = _align_turn_sentences_with_environment(
                sents, float(turn.get("elapsed_seconds", 0.0)), bool(turn.get("environment_change_sentence"))
            )
            body_sentences.extend(sents)
            turn_dialogues = _turn_dialogue_texts(turn)
            if turn_dialogues:
                all_dialogue_texts.extend(turn_dialogues)
                remaining = max(0.0, duration_seconds - float(turn['elapsed_seconds']))
                if _turn_uses_sequential_renderer(turn):
                    estimated = _turn_spoken_seconds(turn)
                    fast_estimated = _turn_spoken_seconds(turn, fast=True)
                    if fast_estimated > remaining + 0.15:
                        warnings.append(
                            f"Turn {turn['index']} sequential dialogue is longer than the remaining {remaining:.1f}s even at a very fast speaking pace; "
                            "prompt generation continued without inventing a cutoff. Shorten/re-time the lines when full delivery is required."
                        )
                    if estimated > remaining * 1.10:
                        warnings.append(
                            f"Turn {turn['index']} sequential dialogue is estimated at about {estimated:.1f}s, "
                            f"but only about {remaining:.1f}s remains after its start time. MiniMax H3 documents "
                            "<cutoff> for speech truncated by the end of the video; this node does not automatically "
                            "split or insert <cutoff>, so shorten/re-time the lines or post-edit the completed H3 prompt if truncation is intentional."
                        )
                else:
                    dialogue_text = turn.get('dialogue_text', '')
                    estimated = _estimate_spoken_seconds(dialogue_text)
                    if _dialogue_clearly_exceeds_window(dialogue_text, remaining):
                        warnings.append(
                            f"Turn {turn['index']} dialogue is longer than the remaining {remaining:.1f}s even at a very fast speaking pace; "
                            "prompt generation continued without inventing a cutoff. Shorten/re-time the line when full delivery is required."
                        )
                    if estimated > remaining * 1.10:
                        warnings.append(
                            f"Turn {turn['index']} dialogue is estimated at about {estimated:.1f}s, "
                            f"but only about {remaining:.1f}s remains after its start time. MiniMax H3 documents "
                            "<cutoff> for speech truncated by the end of the video; this node does not automatically "
                            "split or insert <cutoff>, so shorten/re-time the line or post-edit the completed H3 prompt if truncation is intentional."
                        )

        missing_profile_sentences: List[str] = []
        for slot in active_person_slots:
            if slot not in profile_visual_slots or slot in seen_profiles:
                continue
            profile = profiles.get(slot, {})
            if not _profile_has_explicit_visual_settings(profile):
                continue
            fragment = _profile_fragment(
                slot, profile.get("gender", "unspecified"), profile.get("age", "unspecified"),
                appearance_desc=profile.get("appearance_desc", ""),
                clothing_desc=profile.get("clothing_desc", ""),
                include_visual=True,
            )
            if fragment != f"Person {slot}":
                missing_profile_sentences.append(_ensure_terminal_punctuation(f"{fragment}, is present in the scene"))
                seen_profiles.add(slot)
        if missing_profile_sentences:
            body_sentences[timeline_insert_index:timeline_insert_index] = missing_profile_sentences

        if not body_sentences:
            raise RuntimeError("Timeline compiler produced an empty integrated description without user or reference content.")

        landing = _final_landing_sentence(resolved_mode)
        if landing and landing not in body_sentences:
            body_sentences.append(landing)

        integrated = "[Shot 1] " + " ".join(s for s in body_sentences if s).strip()
    else:
        # H3's official prompt guide treats a genuine subject/viewpoint change as
        # a new [Shot N] with a strictly increasing cut timestamp. Camera motion
        # remains a natural action inside each shot. This branch is activated
        # only by the explicit multiple-camera control.
        shot_bodies: List[List[str]] = [[] for _ in camera_sequence]
        if style_sentence:
            shot_bodies[0].append(style_sentence)
        if ref_sentence:
            shot_bodies[0].append(ref_sentence)
        if reference_clothing_sentence:
            shot_bodies[0].append(reference_clothing_sentence)
        if backdrop:
            shot_bodies[0].append(backdrop)
        if opening_environment_sentence:
            shot_bodies[0].append(opening_environment_sentence)
        if selected_visual_sentence:
            shot_bodies[0].append(selected_visual_sentence)
        shot_continuity_sentence = STYLE_SHOT_CONTINUITY_TEXT.get(str(visual_style or ""), "")
        if shot_continuity_sentence or profile_continuity_sentence:
            for later_shot_body in shot_bodies[1:]:
                if shot_continuity_sentence:
                    later_shot_body.append(shot_continuity_sentence)
                if profile_continuity_sentence:
                    later_shot_body.append(profile_continuity_sentence)

        # A Person explicitly named in the shared scene is already visually
        # present from Shot 1.  Introduce only those scene profiles that would
        # otherwise first appear later; profiles naturally introduced by Shot 1
        # camera targeting or a 0.0s Timeline event retain the established path.
        initial_profile_slots = set(_camera_target_slots(camera_sequence[0].get('target', 'current_action')))
        for turn in turns:
            if abs(float(turn.get('elapsed_seconds', 0.0))) <= 1e-9:
                initial_profile_slots.update(_speaker_slots(turn.get('speaker', 'A')))
        for slot in active_person_slots:
            if slot not in scene_profile_slots or slot in initial_profile_slots or slot in seen_profiles:
                continue
            profile = profiles.get(slot, {})
            if not _profile_has_explicit_visual_settings(profile):
                continue
            fragment = _profile_fragment(
                slot, profile.get("gender", "unspecified"), profile.get("age", "unspecified"),
                appearance_desc=profile.get("appearance_desc", ""),
                clothing_desc=profile.get("clothing_desc", ""),
                include_visual=True,
            )
            if fragment != f"Person {slot}":
                shot_bodies[0].append(_ensure_terminal_punctuation(f"{fragment}, is present in the scene"))
                seen_profiles.add(slot)

        # Introduce a camera-targeted person's configured visual profile only when
        # that target Shot actually begins. Future Shot targets must not be pulled
        # forward into Shot 1, because that can contradict scene text such as
        # "Person A is alone" before Person B enters later. Timeline turns still
        # introduce their own profiles at the first real turn appearance.
        next_camera_profile_shot = 0

        def introduce_camera_target_profiles_through(elapsed_limit: float) -> None:
            nonlocal next_camera_profile_shot
            while next_camera_profile_shot < len(camera_sequence):
                shot = camera_sequence[next_camera_profile_shot]
                if float(shot['start']) > elapsed_limit + 1e-9:
                    break
                shot_body = shot_bodies[int(shot['index']) - 1]
                for slot in _camera_target_slots(shot.get('target', 'current_action')):
                    if slot in seen_profiles or slot not in profile_visual_slots:
                        continue
                    profile = profiles.get(slot, {})
                    if not _profile_has_explicit_visual_settings(profile):
                        continue
                    fragment = _profile_fragment(
                        slot, profile.get("gender", "unspecified"), profile.get("age", "unspecified"),
                        appearance_desc=profile.get("appearance_desc", ""),
                        clothing_desc=profile.get("clothing_desc", ""),
                        include_visual=True,
                    )
                    if fragment != f"Person {slot}":
                        shot_body.append(_ensure_terminal_punctuation(f"{fragment}, is present in the scene"))
                        seen_profiles.add(slot)
                next_camera_profile_shot += 1

        introduce_camera_target_profiles_through(0.0)
        shot_bodies[0].append(_camera_target_opening_sentence(camera_sequence[0]['target'], camera_sequence[0].get('framing', 'auto')))

        any_explicit_motion = any(shot.get('motion') != 'auto' for shot in camera_sequence)
        for shot in camera_sequence:
            sentence, camera_warnings = _camera_sentence(
                shot.get('motion', 'auto'), shot.get('amplitude', camera_amplitude), shot.get('speed', camera_speed)
            )
            if shot.get('motion') == 'auto' and (any_explicit_motion or shot.get('index') != 1):
                camera_warnings = [w for w in camera_warnings if 'ignored because camera_motion is not selected' not in w]
            warnings.extend(camera_warnings)
            if sentence:
                shot_bodies[shot['index'] - 1].append(sentence)

        cut_times = [float(shot['start']) for shot in camera_sequence[1:]]
        for turn in turns:
            elapsed = float(turn['elapsed_seconds'])
            introduce_camera_target_profiles_through(elapsed)
            shot_index = 1
            for cut_time in cut_times:
                if elapsed + 1e-9 >= cut_time:
                    shot_index += 1
                else:
                    break
            render_elapsed = elapsed
            if shot_index > 1 and abs(elapsed - cut_times[shot_index - 2]) <= 1e-9:
                render_elapsed = 0.0
            if turn.get("environment_change_sentence"):
                environment_sentence = turn["environment_change_sentence"]
                if render_elapsed <= 1e-9 and elapsed > 1e-9:
                    absolute_prefix = f"At approximately {elapsed:.2f} seconds, "
                    if environment_sentence.startswith(absolute_prefix):
                        environment_sentence = environment_sentence[len(absolute_prefix):]
                        if environment_sentence:
                            environment_sentence = environment_sentence[0].upper() + environment_sentence[1:]
                shot_bodies[shot_index - 1].append(environment_sentence)
            render_turn = dict(turn)
            render_turn["elapsed_seconds"] = render_elapsed
            sents, turn_warnings = _render_timeline_turn_with_vocal_events(
                render_turn, resolved_mode, profiles, seen_profiles, seen_speakers
            )
            warnings.extend(turn_warnings)
            sents = _align_turn_sentences_with_environment(
                sents, elapsed, bool(turn.get("environment_change_sentence"))
            )
            shot_bodies[shot_index - 1].extend(sents)
            turn_dialogues = _turn_dialogue_texts(turn)
            if turn_dialogues:
                all_dialogue_texts.extend(turn_dialogues)
                if _turn_uses_sequential_renderer(turn):
                    estimated = _turn_spoken_seconds(turn)
                    fast_estimated = _turn_spoken_seconds(turn, fast=True)
                    if shot_index < len(camera_sequence):
                        shot_end = float(camera_sequence[shot_index]['start'])
                        available = max(0.0, shot_end - elapsed)
                        if fast_estimated > available + 0.15:
                            warnings.append(
                                f"Turn {turn['index']} sequential dialogue is longer than the {available:.1f}s window before the next Shot even at a very fast speaking pace; "
                                "prompt generation continued without inventing cross-cut speech markers."
                            )
                        if estimated > available * 1.10:
                            warnings.append(
                                f"Turn {turn['index']} sequential dialogue is estimated at about {estimated:.1f}s, "
                                f"but the next Shot starts only {available:.1f}s later; the spoken sequence may cross the cut. "
                                "MiniMax H3 documents paired <scenetrans> continuity markers plus an explicit cross-cut audio-continuity statement for this case. "
                                "This node does not automatically split dialogue across shots, so shorten/re-time the lines or post-edit the completed H3 prompt when cross-cut speech is intentional."
                            )
                    else:
                        remaining = max(0.0, duration_seconds - elapsed)
                        if fast_estimated > remaining + 0.15:
                            warnings.append(
                                f"Turn {turn['index']} sequential dialogue is longer than the remaining {remaining:.1f}s even at a very fast speaking pace; "
                                "prompt generation continued without inventing a cutoff."
                            )
                        if estimated > remaining * 1.10:
                            warnings.append(
                                f"Turn {turn['index']} sequential dialogue is estimated at about {estimated:.1f}s, "
                                f"but only about {remaining:.1f}s remains after its start time. MiniMax H3 documents "
                                "<cutoff> for speech truncated by the end of the video; this node does not automatically "
                                "split or insert <cutoff>, so shorten/re-time the lines or post-edit the completed H3 prompt if truncation is intentional."
                            )
                else:
                    dialogue_text = turn.get('dialogue_text', '')
                    estimated = _estimate_spoken_seconds(dialogue_text)
                    if shot_index < len(camera_sequence):
                        shot_end = float(camera_sequence[shot_index]['start'])
                        available = max(0.0, shot_end - elapsed)
                        if _dialogue_clearly_exceeds_window(dialogue_text, available):
                            warnings.append(
                                f"Turn {turn['index']} dialogue is longer than the {available:.1f}s window before the next Shot even at a very fast speaking pace; "
                                "prompt generation continued without inventing cross-cut speech markers."
                            )
                        if estimated > available * 1.10:
                            warnings.append(
                                f"Turn {turn['index']} dialogue is estimated at about {estimated:.1f}s, "
                                f"but the next Shot starts only {available:.1f}s later; the spoken line may cross the cut. "
                                "MiniMax H3 documents paired <scenetrans> continuity markers plus an explicit cross-cut audio-continuity statement for this case. "
                                "This node does not automatically split dialogue across shots, so shorten/re-time the line or post-edit the completed H3 prompt when cross-cut speech is intentional."
                            )
                    else:
                        remaining = max(0.0, duration_seconds - elapsed)
                        if _dialogue_clearly_exceeds_window(dialogue_text, remaining):
                            warnings.append(
                                f"Turn {turn['index']} dialogue is longer than the remaining {remaining:.1f}s even at a very fast speaking pace; "
                                "prompt generation continued without inventing a cutoff."
                            )
                        if estimated > remaining * 1.10:
                            warnings.append(
                                f"Turn {turn['index']} dialogue is estimated at about {estimated:.1f}s, "
                                f"but only about {remaining:.1f}s remains after its start time. MiniMax H3 documents "
                                "<cutoff> for speech truncated by the end of the video; this node does not automatically "
                                "split or insert <cutoff>, so shorten/re-time the line or post-edit the completed H3 prompt if truncation is intentional."
                            )

        # Cover camera-targeted Shots that contain no Timeline turn after their
        # start time. Their profiles still belong in that Shot, never in Shot 1.
        introduce_camera_target_profiles_through(float("inf"))

        landing = _final_landing_sentence(resolved_mode)
        if landing:
            shot_bodies[-1].append(landing)

        parts: List[str] = []
        shot1_text = " ".join(s for s in shot_bodies[0] if s).strip()
        if not shot1_text:
            raise RuntimeError("Multiple-camera compiler produced an empty Shot 1.")
        parts.append("[Shot 1] " + shot1_text)
        for shot in camera_sequence[1:]:
            index = int(shot['index'])
            timestamp = _format_h3_shot_timestamp(float(shot['start']))
            header = f"[Shot {index}] At {timestamp}, {_camera_target_transition_clause(shot['target'], shot.get('transition', 'cut'), shot.get('framing', 'auto'))}"
            tail = " ".join(s for s in shot_bodies[index - 1] if s).strip()
            parts.append(header + (" " + tail if tail else ""))
        integrated = " ".join(parts).strip()
    environment_sound_timeline = _structured_environment_sound_timeline(opening_environment_state, turns)
    sound_text_source = " ".join(filter(None, [scene_prompt] + [t['action'] for t in turns]))
    any_dialogue = " ".join(all_dialogue_texts)
    predominant_delivery = 'voiceover' if any(event.get('delivery') in {'voiceover', 'narrator'} for t in turns for event in _turn_vocal_events(t)) else 'on_screen'
    soundscape, sound_warnings = _soundscape(
        sound_text_source, soundscape_mode, sound_hint, any_dialogue, predominant_delivery,
        has_non_diegetic_music=(music_mode != "none"),
    )
    warnings.extend(sound_warnings)
    if soundscape_mode == "auto" and environment_sound_timeline:
        soundscape = _merge_structured_environment_soundscape(soundscape, environment_sound_timeline)
    music, music_warnings = _music(music_mode, music_hint)
    warnings.extend(music_warnings)

    instruction = _instruction(resolved_mode, shot_count, duration_seconds)
    sections = []
    if instruction:
        sections.append(instruction)
    sections.append(f"integrated_multimodal_description: {integrated}")
    sections.append(f"overall_soundscape: {soundscape}")
    sections.append(f"non_diegetic_music: {music}")
    prompt = "\n\n".join(sections)

    has_narrator = any(event.get("speaker") == "Narrator" for turn in turns for event in _turn_vocal_events(turn))
    errors = _validate_generated_prompt(
        prompt, resolved_mode, shot_count, duration_seconds, visual_style,
        max_speaker_id=4 if has_narrator else 3,
        allow_narrator_voiceover=has_narrator,
    )
    if errors:
        raise RuntimeError("Generated H3 prompt failed internal validation:\n- " + "\n- ".join(errors))

    info_lines = [
        f"version={VERSION}",
        f"resolved_mode={resolved_mode}",
        "generator=rule_based_timeline_multishot" if camera_sequence else "generator=rule_based_timeline",
        f"scene_translate={scene_translate}",
        (
            f"visual_style={visual_style}"
            if visual_style != "auto"
            else "visual_style=reference_preserved"
            if resolved_mode != "t2va"
            else "visual_style=auto_no_added_style"
        ),
        f"person_count={person_count}",
        f"turn_count={len(turns)}",
        f"timeline_event_count={len(turns)}",
    ]
    if resolved_mode == "i2va":
        info_lines.append(
            f"reference_clothing_lock={'on' if reference_clothing_lock_active else 'off'}"
        )
        if reference_clothing_lock_active and ignored_clothing_slots:
            info_lines.append(
                "reference_clothing_ignored_profile_settings=" + ",".join(sorted(set(ignored_clothing_slots)))
            )
    if camera_sequence:
        info_lines.append(f"camera_shot_count={shot_count}")
        for shot in camera_sequence:
            framing = shot.get('framing', 'auto')
            framing_part = f",framing:{framing}" if framing != 'auto' else ""
            info_lines.append(
                f"camera_shot_{shot['index']}=target:{shot['target']}{framing_part},start:{shot['start']:.1f},transition:{shot.get('transition', 'cut')},motion:{shot['motion']}"
            )
    elif camera_shot_1_target != "current_action" or camera_shot_1_framing != "auto":
        framing_part = f",framing:{camera_shot_1_framing}" if camera_shot_1_framing != "auto" else ""
        info_lines.append("camera_shot_count=1")
        info_lines.append(f"camera_shot_1=target:{camera_shot_1_target}{framing_part},start:0.0,transition:cut,motion:{camera_motion}")
    if warnings:
        info_lines.append("warnings:")
        info_lines.extend(f"- {w}" for w in warnings)
    else:
        info_lines.append("warnings=none")
    return prompt, "\n".join(info_lines)


class UltraMiniMaxH3Prompt:
    """Rule-based MiniMax H3 prompt compiler with optional scene translation and multi-person timeline support."""

    @classmethod
    def INPUT_TYPES(cls):
        required = {
            "scene_prompt": ("STRING", {"default": "", "multiline": True, "tooltip": "Shared scene/backdrop only: location, mood, lighting, and initial character arrangement. Put changing actions and dialogue in Ordered Steps. Example: A wide meadow in warm late-afternoon light; a woman and a man stand facing each other. Text containing only spaces or line breaks is treated as empty. In T2VA, a completely empty draft remains queueable; the h3_prompt branch waits with status=waiting_for_content instead of becoming a native input error."}),
            "scene_translate": (_choice_values(SCENE_TRANSLATE_VALUES, "scene_translate"), {"default": "ko_to_en", "tooltip": "Global non-dialogue descriptive-text translation control. Automatic: translate Korean scene/action/profile/reference/sound/music descriptions to English while leaving already-English text unchanged. Off: preserve every descriptive field exactly as entered and make no online translation request. Dialogue is never translated."}),
            "scene_input_role": (_choice_values(SCENE_ROLE_VALUES, "scene_input_role"), {"default": "scene_action", "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current runtime always uses Timeline mode and ignores this value."}),
            "mode": (_choice_values(MODE_VALUES, "mode"), {"default": "auto", "tooltip": "Auto follows the actual image connections: none=T2VA, start only=I2VA, end only=L2VA, start+end=FL2VA. Manual T2VA stays T2VA and ignores connected images for prompt-mode resolution. Manual I2VA requires a start image, L2VA requires an end image, and FL2VA requires both; when a required image is missing, the node shows the guidance badge and quietly waits instead of changing to another mode."}),
            "duration_seconds": ("INT", {"default": 5, "min": 4, "max": 30, "step": 1, "tooltip": "Reference duration for H3 timing. This node accepts 4-30 whole seconds. MiniMax H3 officially supports up to 15 seconds; 16-30 seconds are an advanced/local-use range and may increase generation time and memory use sharply. Match this to the actual H3 video-generation duration."}),
            "shot_layout": (_choice_values(SHOT_LAYOUT_VALUES, "shot_layout"), {"default": "auto_safe", "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current runtime ignores this value; use Multiple Camera Cuts for explicit shots."}),
            "visual_style": (_choice_values(STYLE_VALUES, "visual_style"), {"default": "auto"}),
            "narrator_voice_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional custom Narrator voice characteristics. This is a normal ComfyUI STRING widget/input and can be connected from an external STRING source."}),
            "camera_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "tooltip": "Base camera motion for the shot. In multiple-camera mode, this remains the motion for Shot 1 because Shot 1 begins the video and has no transition-in. Tracking Shot follows the subject smoothly; camera shake emphasizes shake; Handheld Tracking follows the action with natural operator movement and irregular micro-corrections."}),
            "camera_amplitude": (_choice_values(CAMERA_AMPLITUDE_VALUES, "camera_amplitude"), {"default": "default", "tooltip": "Single-camera mode: applies to the selected camera motion. Multiple-camera mode: this is Shot 1 amplitude and the inherited default for later Shots whose Camera Amplitude is set to Follow Base Settings."}),
            "camera_speed": (_choice_values(CAMERA_SPEED_VALUES, "camera_speed"), {"default": "default", "tooltip": "Single-camera mode: applies to the selected camera motion. Multiple-camera mode: this is Shot 1 speed and the inherited default for later Shots whose Camera Speed is set to Follow Base Settings."}),
            "camera_sequence_enabled": ("BOOLEAN", {"default": False, "label_on": "ON", "label_off": "OFF", "tooltip": "Enable explicit H3 shot changes. Shot 1 always exists. When enabled, Shot 2-6 can be enabled in order and each Shot gets its own start time in seconds, independent of Timeline Progress timing."}),
            "camera_shot_count": ("INT", {"default": 2, "min": 2, "max": MAX_CAMERA_SHOTS, "step": 1, "hidden": True, "tooltip": "Internal derived active-shot count. The UI derives this from the enabled Shot 2-6 blocks; users do not set it directly."}),
            "camera_shot_1_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "Shot 1 is the default opening shot and always starts at 0.0 seconds. Choose what the opening shot frames. Its timing is independent of Timeline Progress timing."}),
            "camera_shot_1_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for the default Shot 1. Shot 1 always exists even when Multiple Camera Cuts is OFF."}),
            "camera_shot_2_enabled": ("BOOLEAN", {"default": True, "label_on": "ON", "label_off": "OFF", "hidden": True, "tooltip": "Enable Shot 2. When ON, set Shot 2 Start Time (seconds). Shot timing is independent of Timeline Progress timing. Shots must be enabled in order without gaps."}),
            "camera_shot_2_start_seconds": ("FLOAT", {"default": 0.5, "min": 0.5, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": True, "tooltip": "Video time in seconds when Shot 2 starts. Use 0.5-second steps. This timing is independent of Timeline Progress start times; the UI dynamically limits the maximum to video duration minus 0.5 seconds."}),
            "camera_shot_2_transition": (_choice_values(CAMERA_TRANSITION_VALUES, "camera_transition"), {"default": "cut", "hidden": True, "tooltip": "Transition used when Shot 2 starts."}),
            "camera_shot_2_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "What Shot 2 should frame."}),
            "camera_shot_2_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for Shot 2. Available choices follow the selected target."}),
            "camera_shot_2_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "hidden": True, "tooltip": "Optional camera movement inside Shot 2 after its transition."}),
            "camera_shot_2_amplitude": (_choice_values(CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude"), {"default": "inherit", "hidden": True, "tooltip": "Amplitude for Shot 2 camera motion. Follow Base Settings inherits the top Camera Amplitude; Default · Omit suppresses the amplitude phrase for this Shot; Small/Large override it only for this Shot."}),
            "camera_shot_2_speed": (_choice_values(CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed"), {"default": "inherit", "hidden": True, "tooltip": "Speed for Shot 2 camera motion. Follow Base Settings inherits the top Camera Speed; Default · Omit suppresses the speed phrase for this Shot; Slow/Fast override it only for this Shot."}),
            "camera_shot_3_enabled": ("BOOLEAN", {"default": False, "label_on": "ON", "label_off": "OFF", "hidden": True, "tooltip": "Enable Shot 3. When ON, set Shot 3 Start Time (seconds). Shot timing is independent of Timeline Progress timing. Shots must be enabled in order without gaps."}),
            "camera_shot_3_start_seconds": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": True, "tooltip": "Video time in seconds when Shot 3 starts. Use 0.5-second steps. This timing is independent of Timeline Progress start times; the UI dynamically limits the maximum to video duration minus 0.5 seconds."}),
            "camera_shot_3_transition": (_choice_values(CAMERA_TRANSITION_VALUES, "camera_transition"), {"default": "cut", "hidden": True, "tooltip": "Transition used when Shot 3 starts."}),
            "camera_shot_3_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "What Shot 3 should frame."}),
            "camera_shot_3_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for Shot 3. Available choices follow the selected target."}),
            "camera_shot_3_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "hidden": True, "tooltip": "Optional camera movement inside Shot 3 after its transition."}),
            "camera_shot_3_amplitude": (_choice_values(CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude"), {"default": "inherit", "hidden": True, "tooltip": "Amplitude for Shot 3 camera motion. Follow Base Settings inherits the top Camera Amplitude; Default · Omit suppresses the amplitude phrase for this Shot; Small/Large override it only for this Shot."}),
            "camera_shot_3_speed": (_choice_values(CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed"), {"default": "inherit", "hidden": True, "tooltip": "Speed for Shot 3 camera motion. Follow Base Settings inherits the top Camera Speed; Default · Omit suppresses the speed phrase for this Shot; Slow/Fast override it only for this Shot."}),
            "camera_shot_4_enabled": ("BOOLEAN", {"default": False, "label_on": "ON", "label_off": "OFF", "hidden": True, "tooltip": "Enable Shot 4. When ON, set Shot 4 Start Time (seconds). Shot timing is independent of Timeline Progress timing. Shots must be enabled in order without gaps."}),
            "camera_shot_4_start_seconds": ("FLOAT", {"default": 1.5, "min": 0.5, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": True, "tooltip": "Video time in seconds when Shot 4 starts. Use 0.5-second steps. This timing is independent of Timeline Progress start times; the UI dynamically limits the maximum to video duration minus 0.5 seconds."}),
            "camera_shot_4_transition": (_choice_values(CAMERA_TRANSITION_VALUES, "camera_transition"), {"default": "cut", "hidden": True, "tooltip": "Transition used when Shot 4 starts."}),
            "camera_shot_4_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "What Shot 4 should frame."}),
            "camera_shot_4_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for Shot 4. Available choices follow the selected target."}),
            "camera_shot_4_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "hidden": True, "tooltip": "Optional camera movement inside Shot 4 after its transition."}),
            "camera_shot_4_amplitude": (_choice_values(CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude"), {"default": "inherit", "hidden": True, "tooltip": "Amplitude for Shot 4 camera motion. Follow Base Settings inherits the top Camera Amplitude; Default · Omit suppresses the amplitude phrase for this Shot; Small/Large override it only for this Shot."}),
            "camera_shot_4_speed": (_choice_values(CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed"), {"default": "inherit", "hidden": True, "tooltip": "Speed for Shot 4 camera motion. Follow Base Settings inherits the top Camera Speed; Default · Omit suppresses the speed phrase for this Shot; Slow/Fast override it only for this Shot."}),
            "camera_shot_5_enabled": ("BOOLEAN", {"default": False, "label_on": "ON", "label_off": "OFF", "hidden": True, "tooltip": "Enable Shot 5. When ON, set Shot 5 Start Time (seconds). Shot timing is independent of Timeline Progress timing. Shots must be enabled in order without gaps."}),
            "camera_shot_5_start_seconds": ("FLOAT", {"default": 2.0, "min": 0.5, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": True, "tooltip": "Video time in seconds when Shot 5 starts. Use 0.5-second steps. This timing is independent of Timeline Progress start times; the UI dynamically limits the maximum to video duration minus 0.5 seconds."}),
            "camera_shot_5_transition": (_choice_values(CAMERA_TRANSITION_VALUES, "camera_transition"), {"default": "cut", "hidden": True, "tooltip": "Transition used when Shot 5 starts."}),
            "camera_shot_5_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "What Shot 5 should frame."}),
            "camera_shot_5_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for Shot 5. Available choices follow the selected target."}),
            "camera_shot_5_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "hidden": True, "tooltip": "Optional camera movement inside Shot 5 after its transition."}),
            "camera_shot_5_amplitude": (_choice_values(CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude"), {"default": "inherit", "hidden": True, "tooltip": "Amplitude for Shot 5 camera motion. Follow Base Settings inherits the top Camera Amplitude; Default · Omit suppresses the amplitude phrase for this Shot; Small/Large override it only for this Shot."}),
            "camera_shot_5_speed": (_choice_values(CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed"), {"default": "inherit", "hidden": True, "tooltip": "Speed for Shot 5 camera motion. Follow Base Settings inherits the top Camera Speed; Default · Omit suppresses the speed phrase for this Shot; Slow/Fast override it only for this Shot."}),
            "camera_shot_6_enabled": ("BOOLEAN", {"default": False, "label_on": "ON", "label_off": "OFF", "hidden": True, "tooltip": "Enable Shot 6. When ON, set Shot 6 Start Time (seconds). Shot timing is independent of Timeline Progress timing. Shots must be enabled in order without gaps."}),
            "camera_shot_6_start_seconds": ("FLOAT", {"default": 2.5, "min": 0.5, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": True, "tooltip": "Video time in seconds when Shot 6 starts. Use 0.5-second steps. This timing is independent of Timeline Progress start times; the UI dynamically limits the maximum to video duration minus 0.5 seconds."}),
            "camera_shot_6_transition": (_choice_values(CAMERA_TRANSITION_VALUES, "camera_transition"), {"default": "cut", "hidden": True, "tooltip": "Transition used when Shot 6 starts."}),
            "camera_shot_6_target": (_choice_values(CAMERA_TARGET_VALUES, "camera_target"), {"default": "current_action", "hidden": True, "tooltip": "What Shot 6 should frame."}),
            "camera_shot_6_framing": (_choice_values(CAMERA_FRAMING_VALUES, "camera_framing"), {"default": "auto", "hidden": True, "tooltip": "Framing for Shot 6. Available choices follow the selected target."}),
            "camera_shot_6_motion": (_choice_values(CAMERA_VALUES, "camera_motion"), {"default": "auto", "hidden": True, "tooltip": "Optional camera movement inside Shot 6 after its transition."}),
            "camera_shot_6_amplitude": (_choice_values(CAMERA_SHOT_AMPLITUDE_VALUES, "camera_shot_amplitude"), {"default": "inherit", "hidden": True, "tooltip": "Amplitude for Shot 6 camera motion. Follow Base Settings inherits the top Camera Amplitude; Default · Omit suppresses the amplitude phrase for this Shot; Small/Large override it only for this Shot."}),
            "camera_shot_6_speed": (_choice_values(CAMERA_SHOT_SPEED_VALUES, "camera_shot_speed"), {"default": "inherit", "hidden": True, "tooltip": "Speed for Shot 6 camera motion. Follow Base Settings inherits the top Camera Speed; Default · Omit suppresses the speed phrase for this Shot; Slow/Fast override it only for this Shot."}),
            "reference_fidelity": (_choice_values(REFERENCE_FIDELITY_VALUES, "reference_fidelity"), {"default": "balanced", "hidden": True}),
            "soundscape_mode": (_choice_values(SOUNDSCAPE_VALUES, "soundscape_mode"), {"default": "auto", "tooltip": "Controls ambience, physical-action sounds, and non-verbal human sounds. 'silent' suppresses those sounds only; dialogue and non-diegetic music remain separate. If both are also absent, overall_soundscape uses N/A for complete silence."}),
            "sound_hint": ("STRING", {"default": "", "multiline": False, "tooltip": "Optional ambience, physical-action sound, or non-verbal human sound. Do not put spoken dialogue or music here. English is recommended; Korean input is translated internally to English before H3 prompt assembly."}),
            "music_mode": (_choice_values(MUSIC_VALUES, "music_mode"), {"default": "none"}),
            "music_hint": ("STRING", {"default": "", "multiline": False, "tooltip": "Optional audience-only non-diegetic music description. Prefer instrumentation, tempo/speed, rhythm, texture, and dynamic changes; avoid abstract mood/emotional-function wording. Korean input is translated internally to English."}),
            "dialogue_text": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current runtime ignores this field; use Timeline dialogue instead."}),
            "dialogue_language": (_choice_values(DIALOGUE_LANGUAGE_VALUES, "dialogue_language"), {"default": "auto", "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current runtime ignores this value; use Timeline dialogue language instead."}),
            "dialogue_delivery": (_choice_values(DIALOGUE_DELIVERY_VALUES, "dialogue_delivery"), {"default": "on_screen", "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current runtime ignores this value; use Timeline dialogue delivery instead."}),
            "person_count": ("INT", {"default": 1, "min": 1, "max": 3, "step": 1, "tooltip": "How many main character profiles are available to the ordered action/dialogue steps."}),
            "turn_count": ("INT", {"default": 1, "min": 1, "max": MAX_TURNS, "step": 1, "tooltip": "Number of timeline events shown in the UI. Each visible row is one real event with one target person/group, one start time, one action, one dialogue field, one dialogue language, and one delivery mode. Final prompt order still follows start time."}),
            "person_a_gender": (_choice_values(GENDER_VALUES, "gender"), {"default": "unspecified", "tooltip": "Optional profile detail for Main Character 1."}),
            "person_a_age": (_choice_values(AGE_VALUES, "age"), {"default": "unspecified", "tooltip": "Optional age group for Main Character 1. Final prompts use natural phrases such as a woman in her thirties. Adult-only built-in presets are selectable only with an explicit age of 20s or older; changing to another age temporarily hides an incompatible preset and restores it when an adult age is selected again.", "profile_safety": PROFILE_SAFETY}),
            "person_a_advanced": ("BOOLEAN", {"default": False, "label_on": "▼", "label_off": "▶", "tooltip": "Show or hide advanced per-person profile options for Main Character 1. Hidden values are preserved and restored when shown again or when person count changes."}),
            "person_a_appearance_preset": (_choice_values(APPEARANCE_PRESET_VALUES, "appearance_preset"), {"default": "none", "hidden": True, "tooltip": "Optional appearance preset for Main Character 1. Combines naturally with Appearance Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_a_appearance_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional appearance/body description for Main Character 1. English is recommended; Korean is translated internally. Prefer concrete body/build, silhouette, hair, or distinctive physical traits over vague beauty adjectives. This is combined with the appearance preset when both are provided."}),
            "person_a_clothing_preset": (_choice_values(CLOTHING_PRESET_VALUES, "clothing_preset"), {"default": "none", "hidden": True, "tooltip": "Optional clothing preset for Main Character 1. Combines naturally with Clothing Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_a_clothing_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional clothing for Main Character 1. English is recommended; Korean is translated internally. Examples: color, material, or a specific garment refinement. This is combined with the clothing preset when both are provided."}),
            "person_a_voice_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional voice identity for Main Character 1. English is recommended; Korean description is translated internally. Its H3 S ID is assigned at this character's first spoken line and reused afterward."}),
            "person_b_gender": (_choice_values(GENDER_VALUES, "gender"), {"default": "unspecified", "hidden": True, "tooltip": "Optional profile detail for Main Character 2."}),
            "person_b_age": (_choice_values(AGE_VALUES, "age"), {"default": "unspecified", "hidden": True, "tooltip": "Optional age group for Main Character 2. Final prompts use natural phrases such as a man in his fifties. Adult-only built-in presets are selectable only with an explicit age of 20s or older; changing to another age temporarily hides an incompatible preset and restores it when an adult age is selected again.", "profile_safety": PROFILE_SAFETY}),
            "person_b_advanced": ("BOOLEAN", {"default": False, "label_on": "▼", "label_off": "▶", "hidden": True, "tooltip": "Show or hide advanced per-person profile options for Main Character 2. Hidden values are preserved and restored when shown again or when person count changes."}),
            "person_b_appearance_preset": (_choice_values(APPEARANCE_PRESET_VALUES, "appearance_preset"), {"default": "none", "hidden": True, "tooltip": "Optional appearance preset for Main Character 2. Combines naturally with Appearance Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_b_appearance_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional appearance/body description for Main Character 2. English is recommended; Korean is translated internally. This is combined with the appearance preset when both are provided."}),
            "person_b_clothing_preset": (_choice_values(CLOTHING_PRESET_VALUES, "clothing_preset"), {"default": "none", "hidden": True, "tooltip": "Optional clothing preset for Main Character 2. Combines naturally with Clothing Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_b_clothing_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional clothing for Main Character 2. English is recommended; Korean is translated internally. This is combined with the clothing preset when both are provided."}),
            "person_b_voice_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional voice identity for Main Character 2. English is recommended; Korean description is translated internally. Its H3 S ID is assigned at this character's first spoken line and reused afterward."}),
            "person_c_gender": (_choice_values(GENDER_VALUES, "gender"), {"default": "unspecified", "hidden": True, "tooltip": "Optional profile detail for Main Character 3."}),
            "person_c_age": (_choice_values(AGE_VALUES, "age"), {"default": "unspecified", "hidden": True, "tooltip": "Optional age group for Main Character 3. Final prompts use natural English age wording. Adult-only built-in presets are selectable only with an explicit age of 20s or older; changing to another age temporarily hides an incompatible preset and restores it when an adult age is selected again.", "profile_safety": PROFILE_SAFETY}),
            "person_c_advanced": ("BOOLEAN", {"default": False, "label_on": "▼", "label_off": "▶", "hidden": True, "tooltip": "Show or hide advanced per-person profile options for Main Character 3. Hidden values are preserved and restored when shown again or when person count changes."}),
            "person_c_appearance_preset": (_choice_values(APPEARANCE_PRESET_VALUES, "appearance_preset"), {"default": "none", "hidden": True, "tooltip": "Optional appearance preset for Main Character 3. Combines naturally with Appearance Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_c_appearance_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional appearance/body description for Main Character 3. English is recommended; Korean is translated internally. This is combined with the appearance preset when both are provided."}),
            "person_c_clothing_preset": (_choice_values(CLOTHING_PRESET_VALUES, "clothing_preset"), {"default": "none", "hidden": True, "tooltip": "Optional clothing preset for Main Character 3. Combines naturally with Clothing Additional Input when both are used. Adult-only built-in choices are available only with an explicit age of 20s or older."}),
            "person_c_clothing_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional additional clothing for Main Character 3. English is recommended; Korean is translated internally. This is combined with the clothing preset when both are provided."}),
            "person_c_voice_desc": ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": "Optional voice identity for Main Character 3. English is recommended; Korean description is translated internally. Its H3 S ID is assigned at this character's first spoken line and reused afterward."}),
        }
        for idx in range(1, MAX_TURNS + 1):
            dynamic_hidden = idx > 1
            required[f"turn_{idx}_speaker"] = (_choice_values(TURN_SPEAKER_VALUES, "turn_speaker"), {"default": "A", "hidden": dynamic_hidden, "tooltip": "Target person(s) for this timeline event. This row is one real event. If you want another person to act or speak at a different moment, use the next Timeline row. Combined targets act or speak together."})
            required[f"turn_{idx}_elapsed_seconds"] = ("FLOAT", {"default": 0.0, "min": 0.0, "max": 29.5, "step": 0.5, "round": 0.1, "hidden": dynamic_hidden, "tooltip": "Approximate start-time target for this timeline event, not a frame-exact trigger. Natural sequential motion and normal playback speed take priority. The UI uses 0.5-second steps and dynamically limits the maximum to video duration minus 0.5 seconds (for example, 10 seconds → 9.5, 30 seconds → 29.5)."})
            required[f"turn_{idx}_action"] = ("STRING", {"default": "", "multiline": False, "hidden": dynamic_hidden, "tooltip": "Describe what happens at this timeline event. English is recommended. Korean action text is translated internally to English before H3 prompt assembly and always remains an action; dialogue text is never auto-translated."})
            required[f"turn_{idx}_dialogue_text"] = ("STRING", {"default": "", "multiline": False, "hidden": dynamic_hidden, "tooltip": "Optional spoken line for this step. The original dialogue text is preserved and is never auto-translated."})
            required[f"turn_{idx}_dialogue_language"] = (_choice_values(DIALOGUE_LANGUAGE_VALUES, "dialogue_language"), {"default": "auto", "hidden": dynamic_hidden, "tooltip": "Language tag written inside H3 <d>[Language] ...</d>. Auto prioritizes Korean vs English and also recognizes obvious supported writing systems; choose a language manually when another language needs an exact tag."})
            required[f"turn_{idx}_dialogue_delivery"] = (_choice_values(DIALOGUE_DELIVERY_VALUES, "dialogue_delivery"), {"default": "on_screen", "hidden": dynamic_hidden, "tooltip": "Choose direct on-screen speech or off-screen voiceover for this line."})
            # Continue-Speaking adds only the two extra dialogue STRING rows as real
            # Core widgets. Speaker/language/delivery remain lightweight UI state,
            # avoiding the abandoned 182/173-widget prototype while giving these
            # dialogue rows the same native external-STRING connection path as the
            # existing Timeline dialogue field.
            required[f"turn_{idx}_vocal_2_text"] = ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": f"Progress {idx} Vocal 2 dialogue. Preserved verbatim and connectable from an external STRING source."})
            required[f"turn_{idx}_vocal_3_text"] = ("STRING", {"default": "", "multiline": False, "hidden": True, "tooltip": f"Progress {idx} Vocal 3 dialogue. Preserved verbatim and connectable from an external STRING source."})
        required["timeline_events_json"] = ("STRING", {"default": "", "multiline": False, "hidden": True})  # Legacy hidden workflow field kept for compatibility; execution ignores it.
        required["variation_seed"] = ("INT", {"default": 0, "min": 0, "max": 0x7FFFFFFFFFFFFFFF, "step": 1, "hidden": True, "tooltip": "Legacy serialized workflow field retained only for backward-compatible widget alignment. Current Timeline runtime ignores this value."})
        # Appended after every V1.9 serialized widget on purpose. This keeps all
        # existing workflow widget indexes byte-for-byte aligned when old graphs
        # are loaded; JS only changes visibility, never serialization order.
        required["i2va_preserve_reference_clothing"] = ("BOOLEAN", {
            "default": True,
            "label_on": "ON",
            "label_off": "OFF",
            "hidden": True,
            "tooltip": (
                "I2VA only. Keep clothing, colors, materials, and accessories from the start image stable "
                "throughout the entire video. While enabled, per-person clothing presets/free text are preserved "
                "in the workflow but ignored for prompt generation. Ordered Steps and shot count never toggle this value."
            ),
        })
        # Compatibility gate retained at the same serialized widget position.
        # Earlier releases used it to turn a completely empty draft into a native
        # ComfyUI validation error. Empty drafts are queueable again, so the
        # frontend now serializes a neutral verdict and VALIDATE_INPUTS accepts it.
        # Keep the field to preserve old workflow/widget alignment.
        required["ultra_scene_validation_gate"] = (
            ["ok", "missing"],
            {"default": "ok", "hidden": True},
        )
        # Transient UI locale supplied by the frontend only when queueing.
        # JS keeps this widget out of workflow persistence, so it cannot alter
        # saved workflow state or serialized widget alignment.
        required["ultra_ui_locale"] = (
            ["en", "ko"],
            {"default": "en", "hidden": True},
        )
        # Runtime-only, workflow-position-safe transport for scoped UI Extension
        # Options. Frontend JS sets widget.serialize=False, so old widgets_values
        # alignment is unchanged while graphToPrompt still supplies serializeValue.
        required["ultra_extension_options_json"] = (
            "STRING",
            {"default": "{}", "multiline": False, "hidden": True},
        )
        return {"required": required, "optional": {
            "start_image": ("IMAGE", {"tooltip": "Auto-mode topology signal and the required reference for manual I2VA/FL2VA. Manual T2VA ignores it for prompt-mode resolution. Pixels are never inspected."}),
            "end_image": ("IMAGE", {"tooltip": "Auto-mode topology signal and the required reference for manual L2VA/FL2VA. Manual T2VA and manual I2VA ignore it for prompt-mode resolution. Pixels are never inspected."}),
        }}

    @classmethod
    def VALIDATE_INPUTS(cls, scene_prompt, ultra_scene_validation_gate):
        """Keep an unfinished empty draft queueable.

        ``ultra_scene_validation_gate`` is retained in INPUT_TYPES for saved
        workflow/widget compatibility, but a completely empty draft is not a
        native ComfyUI input error. The node boundary reports
        ``status=waiting_for_content`` and quietly blocks only the ``h3_prompt``
        branch when ExecutionBlocker is available. Genuine structural/runtime
        validation remains fail-closed inside ``build``/``_build_impl``.
        """
        return True

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("h3_prompt", "info")
    FUNCTION = "build"
    CATEGORY = "Ultra/MiniMax H3"
    DESCRIPTION = "MiniMax H3 prompt compiler with default Korean-to-English scene translation and timeline-based multi-person dialogue/action support."
    SEARCH_ALIASES = ["MiniMax H3 Prompt", "H3 Prompt Builder", "Ultra H3"]

    @staticmethod
    def _translation_warning(locale: str, kind: str, detail: Any) -> str:
        ko = str(locale or "en").lower().startswith("ko")
        detail_text = str(detail or "").strip()
        prefix = f"{detail_text} " if detail_text else ""
        if kind == "dependency":
            if ko:
                return (
                    prefix
                    + "번역 실패: 자동 번역에 필요한 기본 Python/HTTP 모듈을 사용할 수 없습니다. "
                    "ComfyUI Python 환경을 재시작한 뒤에도 계속되면 설치 환경이 손상되지 않았는지 확인해 주세요. "
                    "deep-translator 설치는 필수가 아니며, 당장 실행해야 한다면 해당 서술 항목을 영어로 직접 입력할 수 있습니다."
                )
            return (
                prefix
                + "Translation failed: A basic Python/HTTP module required for automatic translation is unavailable. "
                "Restart ComfyUI and, if the problem persists, check whether the Python runtime is intact. "
                "deep-translator is optional; if needed, enter the affected descriptive field in English directly."
            )
        if kind == "rate_limit":
            if ko:
                return (
                    prefix
                    + "번역 실패: 인터넷 단절이 아니라 온라인 번역 제공자의 HTTP 429 요청 제한입니다. "
                    "표시된 cooldown 시간이 지난 뒤 다시 시도해 주세요. 반복되면 `사용 안 함 · 입력 그대로`를 선택하면 "
                    "장면/행동/인물/Reference/환경음/음악 등 모든 비대사 서술문을 번역하지 않고 그대로 사용하며 온라인 번역 요청도 하지 않습니다. "
                    "자동 번역을 계속 사용해야 한다면 해당 서술문을 영어로 직접 입력하는 것도 안전한 우회 방법입니다."
                )
            return (
                prefix
                + "Translation failed because the online providers returned HTTP 429 rate limits, not because the internet is disconnected. "
                "Retry after the reported cooldown. If it repeats, Off preserves all non-dialogue descriptive fields exactly as entered and makes no online translation request. "
                "Entering the affected descriptive fields in English is also a safe workaround when automatic translation must be avoided."
            )
        if kind == "network":
            if ko:
                return (
                    prefix
                    + "번역 실패: 한국어→영어 자동 번역에 필요한 온라인 경로에 연결하지 못했습니다. "
                    "인터넷 연결을 확인한 뒤 다시 시도하거나, `사용 안 함 · 입력 그대로`를 선택해 모든 비대사 서술문을 원문 그대로 사용하거나, "
                    "해당 서술 항목을 영어로 직접 입력해 주세요. 대사는 원래 언어 그대로 유지됩니다."
                )
            return (
                prefix
                + "Translation failed because the required online translation routes could not be reached. "
                "Check the internet connection and retry, select Off to preserve all non-dialogue descriptive fields exactly as entered, "
                "or enter the affected descriptive fields in English. Dialogue remains verbatim."
            )
        if ko:
            return (
                prefix
                + "번역 실패: 번역 서비스가 안전하게 사용할 수 있는 정상 결과를 반환하지 않았습니다. "
                "잠시 후 다시 시도하거나 해당 서술 항목을 영어로 직접 입력해 주세요."
            )
        return (
            prefix
            + "Translation failed: The translation service did not return a safe usable result. "
            "Retry later or enter the affected descriptive field in English directly."
        )

    def build(self, **kwargs):
        # Keep user-fixable validation failures out of ComfyUI's traceback UI,
        # while allowing programming/runtime errors to remain visible.
        try:
            return self._build_impl(**kwargs)
        except _TranslationDependencyUnavailableError as exc:
            warning = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "dependency", exc)
            info = (
                f"version={VERSION}\n"
                "status=waiting_for_translation\n"
                f"warning={warning}"
            )
            return _blocked_result(info, warning)
        except _TranslationRateLimitedError as exc:
            warning = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "rate_limit", exc)
            info = (
                f"version={VERSION}\n"
                "status=waiting_for_translation_rate_limit\n"
                f"warning={warning}"
            )
            return _blocked_result(info, warning)
        except _TranslationNetworkUnavailableError as exc:
            warning = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "network", exc)
            info = (
                f"version={VERSION}\n"
                "status=waiting_for_translation\n"
                f"warning={warning}"
            )
            return _blocked_result(info)
        except _TranslationUnavailableError as exc:
            warning = self._translation_warning(kwargs.get("ultra_ui_locale", "en"), "service", exc)
            info = (
                f"version={VERSION}\n"
                "status=waiting_for_translation\n"
                f"warning={warning}"
            )
            return _blocked_result(info)
        except _UserInputError as exc:
            info = (
                f"version={VERSION}\n"
                "status=waiting_for_valid_input\n"
                f"warning={exc}"
            )
            return _blocked_result(info)

    def _build_impl(self, **kwargs):
        # ComfyUI invokes node functions with keyword arguments. Keep all
        # dynamically-added turn fields in kwargs so INPUT_TYPES and runtime
        # execution remain in sync even when the JS only changes visibility.
        scene_prompt = kwargs.get("scene_prompt", "")
        scene_translate = _canonical_choice(kwargs.get("scene_translate", "ko_to_en"), SCENE_TRANSLATE_VALUES, "scene_translate")
        mode = _canonical_choice(kwargs.get("mode", "auto"), MODE_VALUES, "mode")
        i2va_preserve_reference_clothing = _validate_bool_field(kwargs.get("i2va_preserve_reference_clothing", True), "i2va_preserve_reference_clothing")
        duration_seconds = _validate_duration_seconds(kwargs.get("duration_seconds", 5))
        visual_style = _canonical_choice(kwargs.get("visual_style", "auto"), STYLE_VALUES, "visual_style")
        camera_motion = _canonical_choice(kwargs.get("camera_motion", "auto"), CAMERA_VALUES, "camera_motion")
        camera_amplitude = _canonical_choice(kwargs.get("camera_amplitude", "default"), CAMERA_AMPLITUDE_VALUES, "camera_amplitude")
        camera_speed = _canonical_choice(kwargs.get("camera_speed", "default"), CAMERA_SPEED_VALUES, "camera_speed")
        camera_sequence_enabled = _validate_bool_field(kwargs.get("camera_sequence_enabled", False), "camera_sequence_enabled")
        turn_count = _validate_int_field(kwargs.get("turn_count", 1), "turn_count", 1, MAX_TURNS)
        preflight_warnings: List[str] = []
        if duration_seconds > 15:
            preflight_warnings.append(
                f"duration_seconds={duration_seconds} is in this node's advanced/local 16-30 second range; "
                "the official MiniMax H3 generation range is 4-15 seconds."
            )
        camera_shot_count, camera_extra_shots = _camera_sequence_from_kwargs(kwargs, duration_seconds, warnings=preflight_warnings)
        camera_sequence_enabled = camera_sequence_enabled and camera_shot_count > 1
        camera_shot_1_target = _canonical_choice(kwargs.get("camera_shot_1_target", "current_action"), CAMERA_TARGET_VALUES, "camera_target")
        camera_shot_1_framing = _canonical_choice(kwargs.get("camera_shot_1_framing", "auto"), CAMERA_FRAMING_VALUES, "camera_framing")
        reference_fidelity = _canonical_choice(kwargs.get("reference_fidelity", "balanced"), REFERENCE_FIDELITY_VALUES, "reference_fidelity")
        soundscape_mode = _canonical_choice(kwargs.get("soundscape_mode", "auto"), SOUNDSCAPE_VALUES, "soundscape_mode")
        sound_hint = kwargs.get("sound_hint", "")
        music_mode = _canonical_choice(kwargs.get("music_mode", "none"), MUSIC_VALUES, "music_mode")
        music_hint = kwargs.get("music_hint", "")
        person_count = _validate_int_field(kwargs.get("person_count", 1), "person_count", 1, 3)
        extension_options = _parse_extension_options_json(kwargs.get("ultra_extension_options_json", "{}"))
        sequential_vocal = _sequential_vocal_from_kwargs(kwargs, turn_count)
        scene_baseline = _extension_scene_baseline(extension_options)
        start_image = kwargs.get("start_image")
        end_image = kwargs.get("end_image")

        # Explicit image modes are fixed contracts.  Keep the current non-native
        # validation flow: a missing required image is shown by the scene badge,
        # Queue remains accepted, and only h3_prompt is quietly blocked.  This
        # check intentionally runs before the existing empty-T2VA content check
        # so simultaneous user-fixable issues are presented one at a time.
        reference_issue = _mode_reference_contract_issue(mode, start_image, end_image)
        if reference_issue is not None:
            warning = _mode_reference_contract_message(reference_issue, kwargs.get("ultra_ui_locale", "en"))
            info = (
                f"version={VERSION}\n"
                f"requested_mode={mode}\n"
                "status=waiting_for_reference\n"
                f"warning={warning}"
            )
            if ExecutionBlocker is not None:
                return ExecutionBlocker(None), info
            return "", info

        # Future per-person fields should be added in this profile map first so
        # person-count visibility changes keep them preserved and restorable.
        # Hidden person widgets are never treated as deleted state.
        profiles = {
            "A": {
                "sid": None,
                "gender": _canonical_choice(kwargs.get("person_a_gender", "unspecified"), GENDER_VALUES, "gender"),
                "age": _canonical_choice(kwargs.get("person_a_age", "unspecified"), AGE_VALUES, "age"),
                "appearance_preset": _canonical_choice(kwargs.get("person_a_appearance_preset", "none"), APPEARANCE_PRESET_VALUES, "appearance_preset"),
                "appearance_desc": kwargs.get("person_a_appearance_desc", ""),
                "extension_appearance": ", ".join(_extension_prompt_fragments(extension_options, "A", "appearance")),
                "extension_ethnic_appearance": _extension_ethnic_appearance_id(extension_options, "A"),
                "clothing_preset": _canonical_choice(kwargs.get("person_a_clothing_preset", "none"), CLOTHING_PRESET_VALUES, "clothing_preset"),
                "clothing_desc": kwargs.get("person_a_clothing_desc", ""),
                "voice_desc": kwargs.get("person_a_voice_desc", ""),
            },
            "B": {
                "sid": None,
                "gender": _canonical_choice(kwargs.get("person_b_gender", "unspecified"), GENDER_VALUES, "gender"),
                "age": _canonical_choice(kwargs.get("person_b_age", "unspecified"), AGE_VALUES, "age"),
                "appearance_preset": _canonical_choice(kwargs.get("person_b_appearance_preset", "none"), APPEARANCE_PRESET_VALUES, "appearance_preset"),
                "appearance_desc": kwargs.get("person_b_appearance_desc", ""),
                "extension_appearance": ", ".join(_extension_prompt_fragments(extension_options, "B", "appearance")),
                "extension_ethnic_appearance": _extension_ethnic_appearance_id(extension_options, "B"),
                "clothing_preset": _canonical_choice(kwargs.get("person_b_clothing_preset", "none"), CLOTHING_PRESET_VALUES, "clothing_preset"),
                "clothing_desc": kwargs.get("person_b_clothing_desc", ""),
                "voice_desc": kwargs.get("person_b_voice_desc", ""),
            },
            "C": {
                "sid": None,
                "gender": _canonical_choice(kwargs.get("person_c_gender", "unspecified"), GENDER_VALUES, "gender"),
                "age": _canonical_choice(kwargs.get("person_c_age", "unspecified"), AGE_VALUES, "age"),
                "appearance_preset": _canonical_choice(kwargs.get("person_c_appearance_preset", "none"), APPEARANCE_PRESET_VALUES, "appearance_preset"),
                "appearance_desc": kwargs.get("person_c_appearance_desc", ""),
                "extension_appearance": ", ".join(_extension_prompt_fragments(extension_options, "C", "appearance")),
                "extension_ethnic_appearance": _extension_ethnic_appearance_id(extension_options, "C"),
                "clothing_preset": _canonical_choice(kwargs.get("person_c_clothing_preset", "none"), CLOTHING_PRESET_VALUES, "clothing_preset"),
                "clothing_desc": kwargs.get("person_c_clothing_desc", ""),
                "voice_desc": kwargs.get("person_c_voice_desc", ""),
            },
        }

        if turn_count < 1 or turn_count > MAX_TURNS:
            raise _UserInputError(f"turn_count must be between 1 and {MAX_TURNS}.")

        resolved_for_draft, _ = _resolve_mode(mode, start_image, end_image)
        # Treat a completely empty T2VA node as an unfinished draft, not as a
        # runtime failure. This check lives at the ComfyUI node boundary so the
        # strict compiler functions can keep rejecting contentless T2VA calls.
        if resolved_for_draft == "t2va" and not str(scene_prompt or "").strip():
            has_user_event_content = any(
                str(kwargs.get(f"turn_{idx}_action", "") or "").strip()
                or str(kwargs.get(f"turn_{idx}_dialogue_text", "") or "").strip()
                or any(str(_sequential_turn_state(sequential_vocal, idx).get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
                for idx in range(1, turn_count + 1)
            )
            has_environment_state = _extension_has_explicit_environment_state(extension_options)
            if not has_user_event_content and not has_environment_state:
                info = (
                    f"version={VERSION}\n"
                    "resolved_mode=t2va\n"
                    "status=waiting_for_content\n"
                    "warning=T2VA needs a scene instruction, a base/progress environment setting, or at least one Timeline action/dialogue. "
                    "The prompt output was blocked instead of raising a runtime exception; no generic subject, environment, or action was invented."
                )
                # Empty T2VA is an unfinished draft, not a queue/input error.
                # Preserve the pre-native-validation behavior: let ComfyUI run
                # the node, quietly stop only this output branch, and expose the
                # waiting state through ``info``.
                if ExecutionBlocker is not None:
                    return ExecutionBlocker(None), info
                return "", info

        visible_events = []
        for idx in range(1, turn_count + 1):
            speaker = _canonical_choice(kwargs.get(f"turn_{idx}_speaker", "A"), TURN_SPEAKER_VALUES, "turn_speaker")
            raw_elapsed = kwargs.get(f"turn_{idx}_elapsed_seconds", 0.0)
            try:
                elapsed = float(raw_elapsed)
            except (TypeError, ValueError):
                elapsed = float("nan")
            action = str(kwargs.get(f"turn_{idx}_action", "") or "")
            turn_dialogue = str(kwargs.get(f"turn_{idx}_dialogue_text", "") or "")
            turn_scene = _extension_turn_scene(extension_options, idx)
            has_turn_scene_change = any(value != TURN_SCENE_KEEP for value in turn_scene.values())
            sequential_turn = _sequential_turn_state(sequential_vocal, idx)
            has_sequential_dialogue = any(str(sequential_turn.get(f"text_{slot}", "") or "").strip() for slot in (2, 3))
            turn_lang = _canonical_choice(kwargs.get(f"turn_{idx}_dialogue_language", "auto"), DIALOGUE_LANGUAGE_VALUES, "dialogue_language")
            turn_delivery = _canonical_choice(kwargs.get(f"turn_{idx}_dialogue_delivery", "on_screen"), DIALOGUE_DELIVERY_VALUES, "dialogue_delivery")
            visible_events.append({
                "source_turn_index": idx,
                "order": idx,
                "speaker": speaker,
                "elapsed_seconds": elapsed,
                "action": action,
                "dialogue_text": turn_dialogue,
                "dialogue_language": turn_lang,
                "dialogue_delivery": turn_delivery,
                "sequential_vocal": dict(sequential_turn),
                "scene_location_override": turn_scene["location"],
                "scene_weather_override": turn_scene["weather"],
            })
        turns = [dict(event) for event in visible_events if _timeline_event_has_content(event)]
        try:
            return build_h3_prompt_timeline(
                scene_prompt=scene_prompt, mode=mode, duration_seconds=duration_seconds,
                visual_style=visual_style, camera_motion=camera_motion,
                camera_amplitude=camera_amplitude, camera_speed=camera_speed,
                reference_fidelity=reference_fidelity, soundscape_mode=soundscape_mode,
                sound_hint=sound_hint, music_mode=music_mode, music_hint=music_hint,
                scene_translate=scene_translate, person_count=person_count,
                profiles=profiles, turns=turns, start_image=start_image, end_image=end_image,
                camera_sequence_enabled=camera_sequence_enabled,
                i2va_preserve_reference_clothing=i2va_preserve_reference_clothing,
                camera_shot_count=camera_shot_count,
                camera_shot_1_target=camera_shot_1_target,
                camera_shot_1_framing=camera_shot_1_framing,
                camera_extra_shots=camera_extra_shots,
                scene_baseline=scene_baseline,
                narrator_voice_desc=str(sequential_vocal.get("narrator_voice_desc", "") or ""),
                preserve_timeline_dialogue_verbatim=bool(kwargs.get("_preserve_timeline_dialogue_verbatim", True)),
                initial_warnings=preflight_warnings,
            )
        except _ProfileSafetyError as exc:
            info = (
                f"version={VERSION}\n"
                f"resolved_mode={resolved_for_draft}\n"
                "status=waiting_for_valid_profile_selection\n"
                f"warning={exc}"
            )
            return _blocked_result(info)

