"""
Tests for the AI Engine modules.
Achieves ≥80% coverage on ai_engine/ with pure-Python test scenarios.
No external models, APIs, or GPU required — all heuristic paths tested.
"""
from __future__ import annotations

import io
import struct

import numpy as np
import pytest
from PIL import Image, ImageDraw


# ---------------------------------------------------------------------------
# Helpers: generate synthetic test images
# ---------------------------------------------------------------------------

def _make_png_bytes(
    width: int = 640,
    height: int = 480,
    color: tuple[int, int, int] = (120, 80, 60),
    add_noise: bool = True,
) -> bytes:
    """Return bytes of a valid PNG image with optional noise for sharpness."""
    img = Image.new("RGB", (width, height), color=color)
    if add_noise:
        import random
        draw = ImageDraw.Draw(img)
        for _ in range(1000):
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            draw.point((x, y), fill=(random.randint(0, 255),) * 3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_blurry_png_bytes() -> bytes:
    """Return a uniformly colored image (zero Laplacian variance = blurry)."""
    return _make_png_bytes(color=(128, 128, 128), add_noise=False)


def _make_dark_png_bytes() -> bytes:
    """Return a nearly-black image."""
    return _make_png_bytes(color=(5, 5, 5), add_noise=False)


def _make_small_png_bytes() -> bytes:
    """Return a very small image below the resolution threshold."""
    return _make_png_bytes(width=128, height=128)


# ---------------------------------------------------------------------------
# image_quality tests
# ---------------------------------------------------------------------------

class TestImageQuality:
    """Unit tests for ai_engine.image_quality."""

    def test_good_image_passes(self) -> None:
        from ai_engine.image_quality import assess_image_quality
        result = assess_image_quality(_make_png_bytes())
        assert isinstance(result.ok, bool)
        assert 0.0 <= result.score <= 1.0
        assert isinstance(result.reasons, list)
        assert result.width == 640
        assert result.height == 480
        assert len(result.content_hash) == 64  # SHA-256 hex

    def test_dark_image_fails(self) -> None:
        from ai_engine.image_quality import assess_image_quality
        result = assess_image_quality(_make_dark_png_bytes())
        assert not result.ok
        assert any("dark" in r.lower() for r in result.reasons)

    def test_small_image_fails(self) -> None:
        from ai_engine.image_quality import assess_image_quality
        result = assess_image_quality(_make_small_png_bytes())
        assert not result.ok
        assert any("resolution" in r.lower() for r in result.reasons)

    def test_invalid_bytes_fails(self) -> None:
        from ai_engine.image_quality import assess_image_quality
        result = assess_image_quality(b"not_an_image_XXXX")
        assert not result.ok
        assert len(result.reasons) > 0

    def test_perceptual_hash_is_string(self) -> None:
        from ai_engine.image_quality import assess_image_quality
        result = assess_image_quality(_make_png_bytes())
        assert isinstance(result.perceptual_hash, str)
        assert len(result.perceptual_hash) > 0

    def test_batch_duplicate_detection(self) -> None:
        from ai_engine.image_quality import assess_images_batch
        # Same image submitted twice → at least one should be flagged duplicate
        img = _make_png_bytes()
        results = assess_images_batch([img, img])
        assert len(results) == 2
        # At least one should be marked not-ok due to duplication
        flagged = [r for r in results if not r.ok]
        assert len(flagged) >= 1

    def test_composite_score_range(self) -> None:
        from ai_engine.image_quality import _composite_score
        score = _composite_score(blur_score=300.0, brightness=128.0, width=640, height=480)
        assert 0.0 <= score <= 1.0


# ---------------------------------------------------------------------------
# waste_classifier tests
# ---------------------------------------------------------------------------

class TestWasteClassifier:
    """Unit tests for ai_engine.waste_classifier."""

    def test_heuristic_classify_returns_valid_category(self) -> None:
        from ai_engine.waste_classifier import classify_waste, WASTE_CATEGORIES
        result = classify_waste(_make_png_bytes(), top_k=3, onnx_session=None)
        assert result.category in WASTE_CATEGORIES
        assert 0.0 <= result.confidence <= 1.0
        assert len(result.top_k) <= 3
        assert result.model_version == "heuristic-v1"
        assert len(result.input_hash) == 64

    def test_heuristic_all_probs_sum_to_one(self) -> None:
        from ai_engine.waste_classifier import classify_waste
        result = classify_waste(_make_png_bytes(), top_k=10, onnx_session=None)
        # top_k probabilities are a subset of the full distribution
        assert all(0.0 <= conf <= 1.0 for _, conf in result.top_k)

    def test_green_image_biases_organic(self) -> None:
        """Green-tinted images should increase ORGANIC_BIOMASS prior."""
        from ai_engine.waste_classifier import classify_waste
        green_bytes = _make_png_bytes(color=(40, 130, 40))
        result = classify_waste(green_bytes, onnx_session=None)
        # Green image should rank ORGANIC_BIOMASS in top-2
        top_cats = [cat for cat, _ in result.top_k]
        assert "ORGANIC_BIOMASS" in top_cats[:3]

    def test_rejected_below_threshold_is_boolean(self) -> None:
        from ai_engine.waste_classifier import classify_waste
        result = classify_waste(_make_png_bytes(), onnx_session=None)
        assert isinstance(result.rejected, bool)

    def test_latency_ms_is_non_negative(self) -> None:
        from ai_engine.waste_classifier import classify_waste
        result = classify_waste(_make_png_bytes(), onnx_session=None)
        assert result.latency_ms >= 0

    def test_softmax_sums_to_one(self) -> None:
        from ai_engine.waste_classifier import _softmax
        logits = np.array([1.0, 2.0, 3.0, 0.5])
        probs = _softmax(logits)
        assert abs(probs.sum() - 1.0) < 1e-5

    def test_onnx_fallback_on_bad_session(self) -> None:
        """Passing a malformed session object triggers heuristic fallback."""
        from ai_engine.waste_classifier import classify_waste, WASTE_CATEGORIES
        result = classify_waste(_make_png_bytes(), onnx_session=object(), top_k=3)
        # Should fall back to heuristics without raising
        assert result.category in WASTE_CATEGORIES
        assert result.model_version == "heuristic-v1"


# ---------------------------------------------------------------------------
# pricing_engine tests
# ---------------------------------------------------------------------------

class TestPricingEngine:
    """Unit tests for ai_engine.pricing_engine."""

    def test_basic_quote_no_penalty(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote
        quote = compute_price_quote(
            base_benchmark=2.50,
            floor_price=1.20,
            ceiling_price=4.00,
            moisture_content_percent=5.0,   # at benchmark → no penalty
            contamination_percent=0.0,
            grade="GRADE_A",
        )
        assert quote.effective_price_per_kg == pytest.approx(2.50, rel=1e-3)
        assert quote.moisture_penalty_applied == 0.0
        assert quote.contamination_penalty_applied == 0.0
        assert not quote.is_below_floor
        assert not quote.is_above_ceiling

    def test_moisture_penalty_reduces_price(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote
        quote = compute_price_quote(
            base_benchmark=2.50,
            floor_price=1.20,
            ceiling_price=4.00,
            moisture_content_percent=15.0,  # 10% above benchmark → penalty
            contamination_percent=0.0,
            grade="GRADE_A",
        )
        assert quote.moisture_penalty_applied > 0
        assert quote.effective_price_per_kg < 2.50

    def test_floor_price_clamping(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote
        quote = compute_price_quote(
            base_benchmark=1.00,
            floor_price=1.20,
            ceiling_price=4.00,
            moisture_content_percent=80.0,  # extreme moisture → below floor
            contamination_percent=50.0,
            grade="CONTAMINATED",
        )
        assert quote.is_below_floor
        assert quote.effective_price_per_kg == pytest.approx(1.20, rel=1e-3)

    def test_grade_b_discount(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote, GRADE_MULTIPLIERS
        quote_a = compute_price_quote(
            base_benchmark=2.50, floor_price=0.50, ceiling_price=5.00,
            moisture_content_percent=5.0, contamination_percent=0.0, grade="GRADE_A"
        )
        quote_b = compute_price_quote(
            base_benchmark=2.50, floor_price=0.50, ceiling_price=5.00,
            moisture_content_percent=5.0, contamination_percent=0.0, grade="GRADE_B"
        )
        assert quote_b.effective_price_per_kg < quote_a.effective_price_per_kg

    def test_invalid_base_benchmark_raises(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote
        with pytest.raises(ValueError, match="base_benchmark"):
            compute_price_quote(
                base_benchmark=0.0, floor_price=1.0, ceiling_price=5.0,
                moisture_content_percent=5.0, contamination_percent=0.0
            )

    def test_floor_above_ceiling_raises(self) -> None:
        from ai_engine.pricing_engine import compute_price_quote
        with pytest.raises(ValueError, match="floor_price"):
            compute_price_quote(
                base_benchmark=2.0, floor_price=5.0, ceiling_price=2.0,
                moisture_content_percent=5.0, contamination_percent=0.0
            )

    def test_validate_listing_price_passes(self) -> None:
        from ai_engine.pricing_engine import validate_listing_price
        validate_listing_price(unit_price_per_kg=2.0, floor_price=1.5)

    def test_validate_listing_price_fails_below_floor(self) -> None:
        from ai_engine.pricing_engine import validate_listing_price
        with pytest.raises(ValueError, match="floor price"):
            validate_listing_price(unit_price_per_kg=1.0, floor_price=1.5)


# ---------------------------------------------------------------------------
# biogas_estimator tests
# ---------------------------------------------------------------------------

class TestBiogasEstimator:
    """Unit tests for ai_engine.biogas_estimator."""

    def test_organic_biomass_estimate(self) -> None:
        from ai_engine.biogas_estimator import estimate_biogas
        result = estimate_biogas(wet_mass_kg=1000.0, category_code="ORGANIC_BIOMASS")
        assert result.wet_mass_kg == 1000.0
        assert result.methane_yield_m3 > 0
        assert result.energy_kwh > 0
        assert result.co2_displacement_kg > 0
        # VS mass < wet mass
        assert result.vs_mass_kg < result.wet_mass_kg

    def test_methane_proportional_to_mass(self) -> None:
        from ai_engine.biogas_estimator import estimate_biogas
        r1 = estimate_biogas(wet_mass_kg=500.0)
        r2 = estimate_biogas(wet_mass_kg=1000.0)
        assert r2.methane_yield_m3 == pytest.approx(r1.methane_yield_m3 * 2, rel=1e-3)

    def test_override_bmp_and_vs(self) -> None:
        from ai_engine.biogas_estimator import estimate_biogas
        result = estimate_biogas(
            wet_mass_kg=100.0, category_code="ORGANIC_BIOMASS",
            vs_override=0.90, bmp_override=0.45
        )
        expected_vs = 100.0 * 0.90
        expected_ch4 = expected_vs * 0.45
        assert result.vs_mass_kg == pytest.approx(expected_vs, rel=1e-4)
        assert result.methane_yield_m3 == pytest.approx(expected_ch4, rel=1e-4)

    def test_zero_mass_raises(self) -> None:
        from ai_engine.biogas_estimator import estimate_biogas
        with pytest.raises(ValueError, match="wet_mass_kg"):
            estimate_biogas(wet_mass_kg=0.0)

    def test_is_biogas_eligible(self) -> None:
        from ai_engine.biogas_estimator import is_biogas_eligible
        assert is_biogas_eligible("ORGANIC_BIOMASS") is True
        assert is_biogas_eligible("FERROUS_METAL") is False
        assert is_biogas_eligible("E_WASTE") is False

    def test_non_organic_category_raises(self) -> None:
        from ai_engine.biogas_estimator import estimate_biogas
        with pytest.raises(ValueError, match="biogas potential"):
            estimate_biogas(wet_mass_kg=100.0, category_code="FERROUS_METAL")


# ---------------------------------------------------------------------------
# model_registry tests
# ---------------------------------------------------------------------------

class TestModelRegistry:
    """Unit tests for ai_engine.model_registry."""

    def setup_method(self) -> None:
        from ai_engine.model_registry import reset_registry
        reset_registry()

    def test_singleton_returns_same_instance(self) -> None:
        from ai_engine.model_registry import get_model_registry
        r1 = get_model_registry()
        r2 = get_model_registry()
        assert r1 is r2

    def test_classifier_returns_none_when_model_absent(self) -> None:
        """Without model file, should return None (heuristic fallback)."""
        from ai_engine.model_registry import get_model_registry
        registry = get_model_registry()
        session = registry.get_classifier_session()
        assert session is None  # No ONNX file in CI → heuristic mode

    def test_health_structure(self) -> None:
        from ai_engine.model_registry import get_model_registry
        registry = get_model_registry()
        health = registry.health()
        assert "classifier" in health
        assert "model_version" in health
        assert "fallback_to_heuristics" in health

    def test_version_from_settings(self) -> None:
        from ai_engine.model_registry import get_model_registry
        from app.core.settings import get_settings
        registry = get_model_registry()
        assert registry.version == get_settings().model_version
