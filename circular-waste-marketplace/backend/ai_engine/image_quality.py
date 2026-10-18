"""
Circular Waste Marketplace — Image Quality Gate
================================================
Assesses uploaded waste images for blur, brightness, resolution,
and perceptual duplicate detection before the image is sent to
the AI waste classifier or stored permanently.

Returns::

    ImageQualityResult(ok=True, score=0.87, reasons=[])

Heuristics are always available. ONNX model can be plugged in via
model_registry.py without changing this interface.
"""
from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import imagehash
except ImportError:
    imagehash = None

try:
    from scipy.ndimage import laplace as scipy_laplace
except ImportError:
    scipy_laplace = None

import numpy as np
from PIL import Image
import structlog

from app.core.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class ImageQualityResult:
    """
    Result of an image quality assessment gate.

    Attributes:
        ok: Whether the image passes all quality thresholds.
        score: Composite quality score in [0.0, 1.0].
        reasons: Human-readable list of failure reasons.
        blur_score: Laplacian variance (higher = sharper).
        brightness: Mean pixel brightness [0, 255].
        width: Image width in pixels.
        height: Image height in pixels.
        perceptual_hash: 64-bit pHash hex string for duplicate detection.
        content_hash: SHA-256 hex of raw file bytes.
    """
    ok: bool
    score: float
    reasons: list[str] = field(default_factory=list)
    blur_score: float = 0.0
    brightness: float = 0.0
    width: int = 0
    height: int = 0
    perceptual_hash: str = ""
    content_hash: str = ""


# ---------------------------------------------------------------------------
# Thresholds (sourced from settings / .env)
# ---------------------------------------------------------------------------
_MIN_SCORE = settings.image_quality_min_score
_MIN_RESOLUTION = settings.image_quality_min_resolution
_BLUR_THRESHOLD = 100.0     # Laplacian variance below this → too blurry
_BRIGHTNESS_MIN = 30.0      # Mean brightness below this → too dark
_BRIGHTNESS_MAX = 230.0     # Mean brightness above this → overexposed


def _compute_blur(gray: np.ndarray) -> float:
    """Laplacian variance — lower values indicate blur."""
    if cv2 is not None:
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if scipy_laplace is not None:
        return float(scipy_laplace(gray.astype(np.float64)).var())
    # 2D discrete Laplacian filter approximation
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    lap = (
        gray[1:-1, 2:] + gray[1:-1, :-2] +
        gray[2:, 1:-1] + gray[:-2, 1:-1] -
        4.0 * gray[1:-1, 1:-1]
    )
    return float(lap.var())


def _compute_brightness(gray: np.ndarray) -> float:
    """Mean pixel brightness on the grayscale channel."""
    return float(gray.mean())


def _compute_perceptual_hash(pil_image: Image.Image) -> str:
    """64-bit perceptual hash for near-duplicate detection."""
    if imagehash is not None:
        return str(imagehash.phash(pil_image))
    # Difference hash (dhash) fallback using pure PIL and numpy
    resized = pil_image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.int32)
    diff = pixels[:, 1:] > pixels[:, :-1]
    bits = "".join("1" if b else "0" for b in diff.flatten())
    return f"{int(bits, 2):016x}"


def _hamming_distance(h1: str, h2: str) -> int:
    """Compute Hamming distance between two hex hash strings."""
    try:
        val1 = int(h1, 16)
        val2 = int(h2, 16)
        return bin(val1 ^ val2).count("1")
    except Exception:
        return 999


def _compute_content_hash(raw_bytes: bytes) -> str:
    """SHA-256 of the raw file bytes — used for exact deduplication."""
    return hashlib.sha256(raw_bytes).hexdigest()


def _composite_score(
    blur_score: float,
    brightness: float,
    width: int,
    height: int,
) -> float:
    """
    Compute a composite quality score in [0.0, 1.0].

    Sub-scores are clamped individually and averaged with weights:
    - Blur:        40%
    - Brightness:  30%
    - Resolution:  30%
    """
    # Blur sub-score: 0 at threshold=0, 1 at threshold≥500
    blur_sub = min(blur_score / 500.0, 1.0)

    # Brightness sub-score: peaks at 128, falls off toward extremes
    brightness_sub = 1.0 - abs(brightness - 128.0) / 128.0
    brightness_sub = max(0.0, brightness_sub)

    # Resolution sub-score: 0 below minimum, 1 at 2× minimum
    min_dim = min(width, height)
    resolution_sub = min(min_dim / (_MIN_RESOLUTION * 2), 1.0)
    if min_dim < _MIN_RESOLUTION:
        resolution_sub = min_dim / _MIN_RESOLUTION * 0.5  # Partial credit

    return round(0.4 * blur_sub + 0.3 * brightness_sub + 0.3 * resolution_sub, 4)


def assess_image_quality(image_bytes: bytes) -> ImageQualityResult:
    """
    Assess a single image for quality suitability.

    Args:
        image_bytes: Raw bytes of the uploaded image file.

    Returns:
        :class:`ImageQualityResult` with composite score and failure reasons.

    This function is **synchronous** and CPU-bound. In async routes it must
    be called via ``asyncio.get_event_loop().run_in_executor(None, ...)``.
    """
    reasons: list[str] = []

    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        logger.warning("image_open_failed", error=str(exc))
        return ImageQualityResult(
            ok=False, score=0.0, reasons=["Cannot open image: invalid or corrupt file."]
        )

    width, height = pil_image.size
    if cv2 is not None:
        np_image = np.array(pil_image)
        gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    else:
        gray = np.array(pil_image.convert("L"), dtype=np.float64)

    blur_score = _compute_blur(gray)
    brightness = _compute_brightness(gray)
    p_hash = _compute_perceptual_hash(pil_image)
    c_hash = _compute_content_hash(image_bytes)
    score = _composite_score(blur_score, brightness, width, height)

    # ── Failure checks ────────────────────────────────────────────────────
    if blur_score < _BLUR_THRESHOLD:
        reasons.append(
            f"Image is too blurry (sharpness score: {blur_score:.1f}, "
            f"minimum required: {_BLUR_THRESHOLD:.1f})."
        )

    if brightness < _BRIGHTNESS_MIN:
        reasons.append(
            f"Image is too dark (brightness: {brightness:.1f}, "
            f"minimum: {_BRIGHTNESS_MIN:.1f})."
        )
    elif brightness > _BRIGHTNESS_MAX:
        reasons.append(
            f"Image is overexposed (brightness: {brightness:.1f}, "
            f"maximum: {_BRIGHTNESS_MAX:.1f})."
        )

    if min(width, height) < _MIN_RESOLUTION:
        reasons.append(
            f"Image resolution too low ({width}×{height}px). "
            f"Minimum: {_MIN_RESOLUTION}px on shortest side."
        )

    if score < _MIN_SCORE:
        reasons.append(
            f"Composite quality score {score:.2f} below minimum threshold {_MIN_SCORE:.2f}."
        )

    ok = len(reasons) == 0

    return ImageQualityResult(
        ok=ok,
        score=score,
        reasons=reasons,
        blur_score=round(blur_score, 2),
        brightness=round(brightness, 2),
        width=width,
        height=height,
        perceptual_hash=p_hash,
        content_hash=c_hash,
    )


def assess_images_batch(images: list[bytes]) -> list[ImageQualityResult]:
    """
    Assess a batch of images, also flagging perceptual near-duplicates.

    Args:
        images: List of raw image byte arrays.

    Returns:
        List of :class:`ImageQualityResult` in the same order as input.
        Duplicate images have an additional reason string appended.
    """
    results = [assess_image_quality(b) for b in images]

    # Detect near-duplicate pairs (Hamming distance ≤ 10 → duplicate)
    hashes = [r.perceptual_hash for r in results if r.perceptual_hash]
    seen_hashes: list[str] = []
    duplicate_indices: set[int] = set()

    for i, h in enumerate(hashes):
        for j, prev_h in enumerate(seen_hashes):
            dist = 999
            if imagehash is not None:
                try:
                    dist = abs(imagehash.hex_to_hash(h) - imagehash.hex_to_hash(prev_h))
                except Exception:
                    dist = _hamming_distance(h, prev_h)
            else:
                dist = _hamming_distance(h, prev_h)

            if dist <= 10:
                duplicate_indices.add(i)
                duplicate_indices.add(j)
        seen_hashes.append(h)

    # Mark duplicates in results (results are frozen; rebuild them)
    final: list[ImageQualityResult] = []
    for idx, result in enumerate(results):
        if idx in duplicate_indices and result.ok:
            new_reasons = list(result.reasons) + [
                "Duplicate or near-duplicate image detected in this submission batch."
            ]
            result = ImageQualityResult(
                ok=False,
                score=result.score,
                reasons=new_reasons,
                blur_score=result.blur_score,
                brightness=result.brightness,
                width=result.width,
                height=result.height,
                perceptual_hash=result.perceptual_hash,
                content_hash=result.content_hash,
            )
        final.append(result)

    return final
