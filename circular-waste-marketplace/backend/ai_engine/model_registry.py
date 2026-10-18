"""
Circular Waste Marketplace — Model Registry
===========================================
Lazy singleton loader for ONNX models and AI backends.
Provides health check and graceful heuristic fallback when model
files are absent (useful for CI, staging without GPU, and cold starts).

Usage::

    registry = get_model_registry()
    session = registry.get_classifier_session()
    # session is None → heuristics; InferenceSession → ONNX inference

Design:
- Models are loaded once per process (lru_cache singleton).
- Each model slot is loaded lazily — only when first requested.
- If the model file does not exist or fails to load, the slot stays None
  and heuristic fallbacks are used transparently.
- MODEL_VERSION env controls which model file to load.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional

import structlog

from app.core.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class ModelRegistry:
    """
    Central registry for all AI model sessions.

    Thread-safe once initialized (Python's GIL + lazy initialization pattern).
    Not safe for multiprocessing — each worker gets its own singleton copy,
    which is the desired behavior for Gunicorn/Uvicorn workers.
    """

    def __init__(self) -> None:
        self._version = settings.model_version
        self._registry_path = Path(settings.model_registry_path)
        self._classifier_session: Optional[object] = None
        self._classifier_loaded: bool = False

    @property
    def version(self) -> str:
        return self._version

    # ── Classifier (ONNX) ─────────────────────────────────────────────────

    def get_classifier_session(self) -> Optional[object]:
        """
        Return the ONNX InferenceSession for the waste classifier,
        or None if the model file is absent (falls back to heuristics).
        """
        if not self._classifier_loaded:
            self._classifier_session = self._load_onnx(
                model_filename=settings.waste_classifier_model,
                label="waste_classifier",
            )
            self._classifier_loaded = True
        return self._classifier_session

    # ── Internal loader ───────────────────────────────────────────────────

    def _load_onnx(self, model_filename: str, label: str) -> Optional[object]:
        """
        Attempt to load an ONNX model file from the registry path.

        Returns:
            ``onnxruntime.InferenceSession`` on success.
            ``None`` if the file is absent or fails to load.
        """
        model_path = self._registry_path / model_filename
        if not model_path.exists():
            if settings.fallback_to_heuristics:
                logger.warning(
                    "model_file_not_found_using_heuristics",
                    model=label,
                    path=str(model_path),
                )
                return None
            raise FileNotFoundError(
                f"Model file not found at {model_path}. "
                "Set FALLBACK_TO_HEURISTICS=true to enable heuristic fallback."
            )

        try:
            import onnxruntime as ort  # type: ignore[import-untyped]

            t0 = time.perf_counter()
            session = ort.InferenceSession(
                str(model_path),
                providers=["CPUExecutionProvider"],
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000

            logger.info(
                "model_loaded",
                model=label,
                path=str(model_path),
                load_ms=round(elapsed_ms, 1),
                version=self._version,
            )
            return session

        except Exception as exc:
            logger.error(
                "model_load_failed",
                model=label,
                path=str(model_path),
                error=str(exc),
            )
            if settings.fallback_to_heuristics:
                return None
            raise

    # ── Health check ──────────────────────────────────────────────────────

    def health(self) -> dict[str, object]:
        """
        Return a health summary of all model slots.

        Suitable for inclusion in the ``/ready`` endpoint response.
        """
        return {
            "registry_path": str(self._registry_path),
            "model_version": self._version,
            "fallback_to_heuristics": settings.fallback_to_heuristics,
            "classifier": {
                "loaded": self._classifier_loaded,
                "available": self._classifier_session is not None,
                "file": settings.waste_classifier_model,
            },
        }


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------
_registry: Optional[ModelRegistry] = None


def get_model_registry() -> ModelRegistry:
    """
    Return the process-wide ModelRegistry singleton.

    Thread-safe for read access after initial creation.
    Call once at application startup to eagerly validate model files.
    """
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def reset_registry() -> None:
    """
    Reset the singleton (for testing purposes only).

    In production code, never call this function.
    """
    global _registry
    _registry = None
