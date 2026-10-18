"""
Circular Waste Marketplace — Waste Classifier
=============================================
Top-K category + confidence prediction for waste images.
Supports two backends (selected via model_registry.py):
  1. ONNX model (waste_clf_v1.onnx) — primary
  2. Deterministic heuristics — fallback when model file absent

Interface::

    result = classify_waste(image_bytes, top_k=3)
    # ClassificationResult(
    #     category="PLASTIC_PET", confidence=0.91,
    #     top_k=[("PLASTIC_PET", 0.91), ("PLASTIC_HDPE", 0.06), ...],
    #     rejected=False, model_version="v1.0.0"
    # )

Every call is auditable: input_hash, model_version, output, latency stored
by the calling service.
"""
from __future__ import annotations

import hashlib
import io
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from PIL import Image
import structlog

from app.core.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Canonical waste categories (must match DB waste_categories.code)
# ---------------------------------------------------------------------------
WASTE_CATEGORIES = [
    "ORGANIC_BIOMASS",
    "PLASTIC_PET",
    "PLASTIC_HDPE",
    "PAPER_CARDBOARD",
    "FERROUS_METAL",
    "NON_FERROUS_METAL",
    "GLASS",
    "E_WASTE",
    "HAZARDOUS",
    "TEXTILE",
]

# Heuristic prior distribution (rough global baseline)
_HEURISTIC_PRIORS: dict[str, float] = {
    "ORGANIC_BIOMASS": 0.30,
    "PLASTIC_PET":     0.18,
    "PLASTIC_HDPE":    0.12,
    "PAPER_CARDBOARD": 0.14,
    "FERROUS_METAL":   0.10,
    "NON_FERROUS_METAL": 0.04,
    "GLASS":           0.05,
    "E_WASTE":         0.03,
    "HAZARDOUS":       0.01,
    "TEXTILE":         0.03,
}

_CONFIDENCE_THRESHOLD = settings.classifier_confidence_threshold


@dataclass(frozen=True)
class ClassificationResult:
    """
    Output of the waste classification pipeline.

    Attributes:
        category: Predicted top-1 category code.
        confidence: Top-1 confidence in [0.0, 1.0].
        top_k: Ranked list of (category, confidence) tuples.
        rejected: True if top-1 confidence is below threshold.
        model_version: String identifying the model/heuristic version used.
        input_hash: SHA-256 of image bytes (for audit logging).
        latency_ms: Inference latency in milliseconds.
    """
    category: str
    confidence: float
    top_k: list[tuple[str, float]]
    rejected: bool
    model_version: str
    input_hash: str
    latency_ms: int


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

def _preprocess(image_bytes: bytes, target_size: int = 224) -> np.ndarray:
    """
    Resize and normalize an image for model inference.

    Returns a float32 array with shape (1, 3, H, W) in RGB channel-first
    layout, values normalized to [0.0, 1.0].
    """
    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pil = pil.resize((target_size, target_size), Image.BILINEAR)
    arr = np.array(pil, dtype=np.float32) / 255.0
    # Normalize with ImageNet mean/std
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    # NHWC → NCHW
    arr = arr.transpose(2, 0, 1)[np.newaxis, ...]
    return arr.astype(np.float32)


def _softmax(logits: np.ndarray) -> np.ndarray:
    exp = np.exp(logits - logits.max())
    return exp / exp.sum()


# ---------------------------------------------------------------------------
# Heuristic fallback (deterministic, no model required)
# ---------------------------------------------------------------------------

def _heuristic_classify(
    image_bytes: bytes,
    top_k: int,
    input_hash: str,
    t0: float,
) -> ClassificationResult:
    """
    Deterministic colour-histogram heuristic classifier.

    Uses HSV colour statistics to make a rough material guess:
    - High green saturation → ORGANIC_BIOMASS
    - High blue/grey values → FERROUS_METAL
    - High transparency estimate → GLASS
    - Otherwise uses prior distribution

    This is intentionally conservative — it will often predict ORGANIC_BIOMASS
    when uncertain, flagging items for human review.
    """
    try:
        import cv2
    except ImportError:
        cv2 = None

    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if cv2 is not None:
        arr = np.array(pil, dtype=np.uint8)
        hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
        mean_hue = float(hsv[:, :, 0].mean())        # 0–180 in OpenCV
        mean_sat = float(hsv[:, :, 1].mean())        # 0–255
        mean_val = float(hsv[:, :, 2].mean())        # 0–255
    else:
        hsv_arr = np.array(pil.convert("HSV"), dtype=np.float64)
        mean_hue = float(hsv_arr[:, :, 0].mean()) * (180.0 / 255.0)  # Scale to 0–180
        mean_sat = float(hsv_arr[:, :, 1].mean())
        mean_val = float(hsv_arr[:, :, 2].mean())

    priors = dict(_HEURISTIC_PRIORS)

    # Bias priors based on image statistics
    if 30 < mean_hue < 80 and mean_sat > 60:         # Greenish-brown
        priors["ORGANIC_BIOMASS"] += 0.25
    if mean_hue < 20 and mean_sat < 40 and mean_val > 140:   # Grey/silver
        priors["FERROUS_METAL"] += 0.20
    if mean_val > 200 and mean_sat < 30:              # Very bright / white
        priors["PAPER_CARDBOARD"] += 0.15
        priors["GLASS"] += 0.10
    if 90 < mean_hue < 130 and mean_sat > 80:         # Blue-ish
        priors["PLASTIC_PET"] += 0.15

    # Normalize to probability distribution
    total = sum(priors.values())
    probs = {cat: v / total for cat, v in priors.items()}

    # Sort by probability descending
    ranked = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    top_category, top_conf = ranked[0]
    top_k_results = ranked[:top_k]

    latency_ms = int((time.perf_counter() - t0) * 1000)

    return ClassificationResult(
        category=top_category,
        confidence=round(top_conf, 4),
        top_k=[(cat, round(conf, 4)) for cat, conf in top_k_results],
        rejected=top_conf < _CONFIDENCE_THRESHOLD,
        model_version="heuristic-v1",
        input_hash=input_hash,
        latency_ms=latency_ms,
    )


# ---------------------------------------------------------------------------
# ONNX model inference
# ---------------------------------------------------------------------------

def _onnx_classify(
    session: "ort.InferenceSession",  # noqa: F821  — lazy import
    image_bytes: bytes,
    top_k: int,
    input_hash: str,
    t0: float,
    model_version: str,
) -> ClassificationResult:
    """Run inference against a loaded ONNX session."""
    input_arr = _preprocess(image_bytes)
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_arr})
    logits = outputs[0][0]  # (num_classes,)
    probs = _softmax(logits)

    # Map to category labels
    indexed = list(zip(WASTE_CATEGORIES, probs.tolist()))
    ranked = sorted(indexed, key=lambda x: x[1], reverse=True)

    top_category, top_conf = ranked[0]
    latency_ms = int((time.perf_counter() - t0) * 1000)

    return ClassificationResult(
        category=top_category,
        confidence=round(top_conf, 4),
        top_k=[(cat, round(conf, 4)) for cat, conf in ranked[:top_k]],
        rejected=top_conf < _CONFIDENCE_THRESHOLD,
        model_version=model_version,
        input_hash=input_hash,
        latency_ms=latency_ms,
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def classify_waste(
    image_bytes: bytes,
    top_k: int = 3,
    onnx_session: Optional[object] = None,
    model_version: str = "heuristic-v1",
) -> ClassificationResult:
    """
    Classify waste material in an image.

    Args:
        image_bytes: Raw bytes of a single image.
        top_k: Number of top predictions to return.
        onnx_session: Pre-loaded ONNX InferenceSession from model_registry.
                      If None, falls back to deterministic heuristics.
        model_version: Version string for audit logging.

    Returns:
        :class:`ClassificationResult` with category, confidence, and audit fields.

    Note:
        This function is **synchronous** and CPU-bound.
        Wrap in ``run_in_executor`` when calling from async routes.
    """
    t0 = time.perf_counter()
    input_hash = hashlib.sha256(image_bytes).hexdigest()

    if onnx_session is not None:
        try:
            return _onnx_classify(onnx_session, image_bytes, top_k, input_hash, t0, model_version)
        except Exception as exc:
            logger.warning(
                "onnx_inference_failed_falling_back",
                error=str(exc),
                fallback="heuristics",
            )

    return _heuristic_classify(image_bytes, top_k, input_hash, t0)
