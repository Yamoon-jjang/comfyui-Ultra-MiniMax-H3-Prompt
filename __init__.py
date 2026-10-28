import warnings

from .ultra_minimax_h3_prompt import UltraMiniMaxH3Prompt, VERSION, register_translation_api_routes

NODE_CLASS_MAPPINGS = {
    "UltraMiniMaxH3Prompt": UltraMiniMaxH3Prompt,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "UltraMiniMaxH3Prompt": "🎬 Ultra MiniMax H3 Prompt",
}

# Keep the established T2V/I2V node independently loadable even if the optional
# R2V extension ever encounters a frontend/backend compatibility regression.
# R2V failures are reported, but must not make the stable main node disappear.
try:
    from .ultra_minimax_h3_r2v import UltraMiniMaxH3PromptR2V
except Exception as _r2v_import_error:  # pragma: no cover - defensive load isolation
    warnings.warn(
        f"Ultra MiniMax H3 Prompt R2V could not be loaded; the main V{VERSION} node remains available: {_r2v_import_error}",
        RuntimeWarning,
        stacklevel=1,
    )
else:
    NODE_CLASS_MAPPINGS["UltraMiniMaxH3PromptR2V"] = UltraMiniMaxH3PromptR2V
    NODE_DISPLAY_NAME_MAPPINGS["UltraMiniMaxH3PromptR2V"] = "🎬 Ultra MiniMax H3 Prompt R2V"

# Register the local API-key settings endpoints separately from node execution.
# Failure here must never make either prompt node disappear from ComfyUI.
try:
    register_translation_api_routes()
except Exception as _translation_route_error:  # pragma: no cover - defensive load isolation
    warnings.warn(
        f"Ultra MiniMax H3 Prompt translation API settings routes could not be registered: {_translation_route_error}",
        RuntimeWarning,
        stacklevel=1,
    )

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "VERSION"]
