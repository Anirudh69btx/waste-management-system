"""
Circular Waste Marketplace — Dynamic Pricing Engine
====================================================
Computes effective ₹/kg price for a recycled material lot using
the formula defined in the domain docs:

    Effective Price = Base × (1 − (ΔMoisture × M_penalty)
                                − (ΔContamination × C_penalty))

The result is clamped between floor_price and ceiling_price.

All pricing rule parameters come from the ``pricing_rules`` DB table —
no prices are hardcoded in this module.

Usage::

    quote = compute_price_quote(
        base_benchmark=2.50,
        floor_price=1.20,
        ceiling_price=4.00,
        moisture_content_percent=8.0,
        moisture_benchmark_percent=5.0,
        contamination_percent=3.0,
        contamination_benchmark_percent=0.0,
        moisture_penalty=0.02,
        contamination_penalty=0.05,
        grade=WastePurityGrade.GRADE_A,
    )
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models import WastePurityGrade

# Grade multipliers applied on top of the formula
# These represent a premium/discount for verified purity tiers.
# TODO(docs): pricing.md does not define explicit grade multipliers.
#             Using reasonable production defaults pending docs update.
GRADE_MULTIPLIERS: dict[str, float] = {
    "GRADE_A": 1.00,       # No adjustment — benchmark is for Grade A
    "GRADE_B": 0.85,       # 15% discount for lower purity
    "GRADE_C": 0.65,       # 35% discount
    "CONTAMINATED": 0.40,  # 60% discount — significantly impaired value
}

# Standard benchmark moisture levels per common category
# TODO(docs): pricing.md should specify per-category moisture benchmarks.
DEFAULT_MOISTURE_BENCHMARK_PERCENT = 5.0
DEFAULT_CONTAMINATION_BENCHMARK_PERCENT = 0.0


@dataclass(frozen=True)
class PricingQuote:
    """
    Full pricing calculation breakdown for a material lot.

    Attributes:
        effective_price_per_kg: Final effective price after all deductions.
        base_benchmark_price_per_kg: Reference market price.
        floor_price_per_kg: Minimum acceptable price (from pricing_rules).
        ceiling_price_per_kg: Maximum reference price.
        grade_multiplier: Applied grade adjustment factor.
        moisture_penalty_applied: Fractional price reduction from moisture.
        contamination_penalty_applied: Fractional reduction from contamination.
        total_penalty_fraction: Combined total penalty fraction.
        is_below_floor: True if computed price was clamped to floor.
        is_above_ceiling: True if computed price was clamped to ceiling.
    """
    effective_price_per_kg: float
    base_benchmark_price_per_kg: float
    floor_price_per_kg: float
    ceiling_price_per_kg: float
    grade_multiplier: float
    moisture_penalty_applied: float
    contamination_penalty_applied: float
    total_penalty_fraction: float
    is_below_floor: bool
    is_above_ceiling: bool


def compute_price_quote(
    *,
    base_benchmark: float,
    floor_price: float,
    ceiling_price: float,
    moisture_content_percent: float,
    contamination_percent: float,
    moisture_penalty: float = 0.02,
    contamination_penalty: float = 0.05,
    moisture_benchmark_percent: float = DEFAULT_MOISTURE_BENCHMARK_PERCENT,
    contamination_benchmark_percent: float = DEFAULT_CONTAMINATION_BENCHMARK_PERCENT,
    grade: str = "GRADE_A",
) -> PricingQuote:
    """
    Compute the effective price per kg using the dynamic penalty formula.

    Formula::

        moisture_delta = max(0, moisture_content - moisture_benchmark)
        contamination_delta = max(0, contamination - contamination_benchmark)

        penalty = (moisture_delta × moisture_penalty)
                + (contamination_delta × contamination_penalty)

        grade_mult = GRADE_MULTIPLIERS[grade]

        effective_raw = base_benchmark × grade_mult × (1 − penalty)
        effective = clamp(effective_raw, floor_price, ceiling_price)

    Args:
        base_benchmark: Market reference price in ₹/kg.
        floor_price: Minimum acceptable price enforced by pricing_rules.
        ceiling_price: Maximum acceptable reference price.
        moisture_content_percent: Measured moisture % of the lot.
        contamination_percent: Measured contamination % of the lot.
        moisture_penalty: Price deduction per 1% excess moisture.
        contamination_penalty: Price deduction per 1% contamination.
        moisture_benchmark_percent: Acceptable moisture threshold.
        contamination_benchmark_percent: Acceptable contamination threshold.
        grade: WastePurityGrade string (GRADE_A/B/C/CONTAMINATED).

    Returns:
        :class:`PricingQuote` with full breakdown of applied deductions.

    Raises:
        ValueError: If floor_price > ceiling_price or base_benchmark ≤ 0.
    """
    if base_benchmark <= 0:
        raise ValueError(f"base_benchmark must be > 0, got {base_benchmark}")
    if floor_price > ceiling_price:
        raise ValueError(
            f"floor_price ({floor_price}) must be ≤ ceiling_price ({ceiling_price})"
        )

    grade_mult = GRADE_MULTIPLIERS.get(grade, 1.0)

    moisture_delta = max(0.0, moisture_content_percent - moisture_benchmark_percent)
    contamination_delta = max(0.0, contamination_percent - contamination_benchmark_percent)

    moisture_penalty_applied = moisture_delta * moisture_penalty
    contamination_penalty_applied = contamination_delta * contamination_penalty
    total_penalty = moisture_penalty_applied + contamination_penalty_applied

    # Clamp penalty to [0, 1] to prevent negative prices
    total_penalty = min(total_penalty, 1.0)

    effective_raw = base_benchmark * grade_mult * (1.0 - total_penalty)

    is_below_floor = effective_raw < floor_price
    is_above_ceiling = effective_raw > ceiling_price
    effective = max(floor_price, min(effective_raw, ceiling_price))

    return PricingQuote(
        effective_price_per_kg=round(effective, 4),
        base_benchmark_price_per_kg=round(base_benchmark, 4),
        floor_price_per_kg=round(floor_price, 4),
        ceiling_price_per_kg=round(ceiling_price, 4),
        grade_multiplier=round(grade_mult, 4),
        moisture_penalty_applied=round(moisture_penalty_applied, 4),
        contamination_penalty_applied=round(contamination_penalty_applied, 4),
        total_penalty_fraction=round(total_penalty, 4),
        is_below_floor=is_below_floor,
        is_above_ceiling=is_above_ceiling,
    )


def validate_listing_price(
    unit_price_per_kg: float,
    floor_price: float,
) -> None:
    """
    Assert that a proposed listing price meets the floor requirement.

    Raises:
        ValueError: If unit_price_per_kg < floor_price.
    """
    if unit_price_per_kg < floor_price:
        raise ValueError(
            f"Proposed price ₹{unit_price_per_kg:.2f}/kg is below the "
            f"enforced floor price of ₹{floor_price:.2f}/kg. "
            "Please revise the listing price."
        )
