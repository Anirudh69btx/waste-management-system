"""
Circular Waste Marketplace — Biogas Estimator
=============================================
Estimates methane yield (m³ CH₄) per kg of organic waste using
standard Biochemical Methane Potential (BMP) methodology.

Science basis
-------------
For anaerobic digestion of organic waste:

    CH₄ yield = VS × BMP

Where:
    VS  = Volatile Solids fraction (kg VS / kg wet waste)
    BMP = Biochemical Methane Potential (m³ CH₄ / kg VS)

Standard BMP values (literature sources):
  - Mixed food waste:      0.30–0.45 m³ CH₄/kg VS
  - Restaurant waste:      0.35–0.50 m³ CH₄/kg VS
  - Agricultural biomass:  0.20–0.35 m³ CH₄/kg VS
  - Sewage sludge:         0.25–0.30 m³ CH₄/kg VS

Energy conversion:
    1 m³ CH₄ ≈ 35.9 MJ ≈ 9.97 kWh (LHV at 0°C, 1 atm)

CO₂ displacement:
    Using the average Indian grid emission factor of 0.82 kg CO₂e/kWh.

TODO(docs): biogas.md — document facility-specific BMP calibration procedure
            and VS measurement protocol for each accepted organic sub-category.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.settings import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Physical / conversion constants
# ---------------------------------------------------------------------------
_METHANE_ENERGY_MJ_PER_M3 = 35.9          # Lower Heating Value
_METHANE_ENERGY_KWH_PER_M3 = 9.97         # LHV in kWh
_INDIA_GRID_EMISSION_KG_CO2E_PER_KWH = 0.82

# Per-substrate BMP defaults (m³ CH₄/kg VS)
# Key: waste_categories.code
# TODO(docs): Replace with facility-measured values from biogas.md
SUBSTRATE_BMP: dict[str, float] = {
    "ORGANIC_BIOMASS":   0.35,    # Mixed organic / food waste baseline
    "PAPER_CARDBOARD":   0.18,    # Lignocellulosic — lower BMP
    "TEXTILE":           0.15,    # Cellulosic fibres
    # Non-organic categories default to 0.0 (no biogas potential)
}

# Per-substrate VS fractions (kg VS / kg wet waste)
SUBSTRATE_VS: dict[str, float] = {
    "ORGANIC_BIOMASS":   settings.biogas_vs_fraction,   # from .env (default 0.85)
    "PAPER_CARDBOARD":   0.90,
    "TEXTILE":           0.88,
}


@dataclass(frozen=True)
class BiogasEstimate:
    """
    Result of a biogas yield estimation.

    Attributes:
        wet_mass_kg: Input wet mass in kg.
        vs_fraction: Volatile Solids fraction applied.
        vs_mass_kg: Equivalent VS mass in kg.
        bmp_m3_per_kg_vs: BMP constant used.
        methane_yield_m3: Estimated methane volume at STP.
        energy_mj: Thermal energy content of produced methane.
        energy_kwh: Electrical energy equivalent.
        co2_displacement_kg: Estimated CO₂e avoided vs grid electricity.
        category_code: Waste category code used.
        model_version: String version of the BMP constants set used.
    """
    wet_mass_kg: float
    vs_fraction: float
    vs_mass_kg: float
    bmp_m3_per_kg_vs: float
    methane_yield_m3: float
    energy_mj: float
    energy_kwh: float
    co2_displacement_kg: float
    category_code: str
    model_version: str = "bmp-constants-v1"


def estimate_biogas(
    wet_mass_kg: float,
    category_code: str = "ORGANIC_BIOMASS",
    vs_override: float | None = None,
    bmp_override: float | None = None,
) -> BiogasEstimate:
    """
    Estimate methane yield and energy from organic waste.

    Args:
        wet_mass_kg: Total wet mass of organic material in kg.
        category_code: Waste category code (e.g. ``ORGANIC_BIOMASS``).
        vs_override: Override Volatile Solids fraction (0.0–1.0).
                     If None, uses the substrate-specific default.
        bmp_override: Override BMP value in m³ CH₄/kg VS.
                     If None, uses the substrate-specific default.

    Returns:
        :class:`BiogasEstimate` with full yield and energy breakdown.

    Raises:
        ValueError: If wet_mass_kg ≤ 0 or category has zero biogas potential.
    """
    if wet_mass_kg <= 0:
        raise ValueError(f"wet_mass_kg must be > 0, got {wet_mass_kg}")

    vs_fraction = vs_override if vs_override is not None else SUBSTRATE_VS.get(category_code, 0.0)
    bmp = bmp_override if bmp_override is not None else SUBSTRATE_BMP.get(category_code, 0.0)

    if vs_fraction <= 0 or bmp <= 0:
        raise ValueError(
            f"Category '{category_code}' has no meaningful biogas potential "
            f"(VS fraction: {vs_fraction}, BMP: {bmp}). "
            "Only organic categories are eligible for biogas estimation."
        )

    vs_mass_kg = wet_mass_kg * vs_fraction
    methane_yield_m3 = vs_mass_kg * bmp
    energy_mj = methane_yield_m3 * _METHANE_ENERGY_MJ_PER_M3
    energy_kwh = methane_yield_m3 * _METHANE_ENERGY_KWH_PER_M3
    co2_displacement_kg = energy_kwh * _INDIA_GRID_EMISSION_KG_CO2E_PER_KWH

    return BiogasEstimate(
        wet_mass_kg=round(wet_mass_kg, 4),
        vs_fraction=round(vs_fraction, 4),
        vs_mass_kg=round(vs_mass_kg, 4),
        bmp_m3_per_kg_vs=round(bmp, 4),
        methane_yield_m3=round(methane_yield_m3, 4),
        energy_mj=round(energy_mj, 4),
        energy_kwh=round(energy_kwh, 4),
        co2_displacement_kg=round(co2_displacement_kg, 4),
        category_code=category_code,
    )


def is_biogas_eligible(category_code: str) -> bool:
    """Return True if the material category has known biogas potential."""
    return category_code in SUBSTRATE_BMP and SUBSTRATE_BMP[category_code] > 0
