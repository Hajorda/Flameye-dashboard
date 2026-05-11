"""
Scott-Burgan 40 (SB40) fire behavior fuel model parameters.

Fields (all in SI units for internal computation):
  w0    : oven-dry fuel load (kg/m²)
  delta : fuel bed depth (m)
  Mx    : moisture of extinction (fraction, e.g. 0.30 = 30%)
  sigma : surface area to volume ratio (m⁻¹)  — 1 ft⁻¹ = 3.281 m⁻¹
  h     : heat content (kJ/kg)  — wood ≈ 18 600

Source: Scott & Burgan (2005), USFS Gen. Tech. Rep. RMRS-GTR-153
"""

from __future__ import annotations

# Conversion factors (English → SI)
_TON_AC_TO_KG_M2 = 0.2242  # 1 US ton/acre  →  kg/m²
_FT_TO_M = 0.3048
_FT_INV_TO_M_INV = 1 / _FT_TO_M  # ft⁻¹ → m⁻¹  (sigma)
_BTU_LB_TO_KJ_KG = 2.326  # 1 BTU/lb → kJ/kg

# fmt: off
# Each entry: (w0_kg/m², delta_m, Mx_frac, sigma_m⁻¹, h_kJ/kg)
_MODELS: dict[str, tuple[float, float, float, float, float]] = {
    # ── Non-burnable ───────────────────────────────────────────
    "NB1":  (0.00, 0.00, 0.40, 1.0, 18600),
    "NB2":  (0.00, 0.00, 0.40, 1.0, 18600),
    "NB3":  (0.00, 0.00, 0.40, 1.0, 18600),
    "NB8":  (0.00, 0.00, 0.40, 1.0, 18600),
    "NB9":  (0.00, 0.00, 0.40, 1.0, 18600),

    # ── Grass (GR) ─────────────────────────────────────────────
    "GR1":  (0.10 * _TON_AC_TO_KG_M2,  0.10 * _FT_TO_M, 0.15, 2200 * _FT_INV_TO_M_INV, 18600),
    "GR2":  (0.10 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "GR3":  (0.10 * _TON_AC_TO_KG_M2,  0.60 * _FT_TO_M, 0.30, 1500 * _FT_INV_TO_M_INV, 18600),
    "GR4":  (0.25 * _TON_AC_TO_KG_M2,  0.80 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "GR5":  (0.40 * _TON_AC_TO_KG_M2,  1.50 * _FT_TO_M, 0.40, 1800 * _FT_INV_TO_M_INV, 18600),
    "GR6":  (0.10 * _TON_AC_TO_KG_M2,  1.50 * _FT_TO_M, 0.40, 2200 * _FT_INV_TO_M_INV, 18600),
    "GR7":  (1.00 * _TON_AC_TO_KG_M2,  2.00 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "GR8":  (0.50 * _TON_AC_TO_KG_M2,  2.50 * _FT_TO_M, 0.30, 1500 * _FT_INV_TO_M_INV, 18600),
    "GR9":  (1.00 * _TON_AC_TO_KG_M2,  3.00 * _FT_TO_M, 0.40, 1800 * _FT_INV_TO_M_INV, 18600),

    # ── Grass-Shrub (GS) ──────────────────────────────────────
    "GS1":  (0.20 * _TON_AC_TO_KG_M2,  0.90 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "GS2":  (0.50 * _TON_AC_TO_KG_M2,  1.50 * _FT_TO_M, 0.15, 1800 * _FT_INV_TO_M_INV, 18600),
    "GS3":  (0.30 * _TON_AC_TO_KG_M2,  1.80 * _FT_TO_M, 0.40, 1800 * _FT_INV_TO_M_INV, 18600),
    "GS4":  (1.90 * _TON_AC_TO_KG_M2,  2.10 * _FT_TO_M, 0.40, 1800 * _FT_INV_TO_M_INV, 18600),

    # ── Shrub (SH) ────────────────────────────────────────────
    "SH1":  (0.25 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "SH2":  (1.35 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.15, 2000 * _FT_INV_TO_M_INV, 18600),
    "SH3":  (0.45 * _TON_AC_TO_KG_M2,  2.40 * _FT_TO_M, 0.40, 1600 * _FT_INV_TO_M_INV, 18600),
    "SH4":  (0.85 * _TON_AC_TO_KG_M2,  3.00 * _FT_TO_M, 0.30, 2000 * _FT_INV_TO_M_INV, 18600),
    "SH5":  (3.60 * _TON_AC_TO_KG_M2,  6.00 * _FT_TO_M, 0.15, 750  * _FT_INV_TO_M_INV, 18600),
    "SH6":  (2.90 * _TON_AC_TO_KG_M2,  2.00 * _FT_TO_M, 0.30, 750  * _FT_INV_TO_M_INV, 18600),
    "SH7":  (3.50 * _TON_AC_TO_KG_M2,  6.00 * _FT_TO_M, 0.15, 750  * _FT_INV_TO_M_INV, 18600),
    "SH8":  (2.05 * _TON_AC_TO_KG_M2,  3.00 * _FT_TO_M, 0.40, 1000 * _FT_INV_TO_M_INV, 18600),
    "SH9":  (4.50 * _TON_AC_TO_KG_M2,  4.40 * _FT_TO_M, 0.40, 750  * _FT_INV_TO_M_INV, 18600),

    # ── Timber-Understory (TU) ────────────────────────────────
    "TU1":  (0.20 * _TON_AC_TO_KG_M2,  0.60 * _FT_TO_M, 0.20, 2000 * _FT_INV_TO_M_INV, 18600),
    "TU2":  (0.95 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.30, 1750 * _FT_INV_TO_M_INV, 18600),
    "TU3":  (1.50 * _TON_AC_TO_KG_M2,  1.30 * _FT_TO_M, 0.30, 1500 * _FT_INV_TO_M_INV, 18600),
    "TU4":  (0.90 * _TON_AC_TO_KG_M2,  0.50 * _FT_TO_M, 0.12, 2300 * _FT_INV_TO_M_INV, 18600),
    "TU5":  (1.00 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.25, 1500 * _FT_INV_TO_M_INV, 18600),

    # ── Timber-Litter (TL) ────────────────────────────────────
    "TL1":  (1.00 * _TON_AC_TO_KG_M2,  0.20 * _FT_TO_M, 0.30, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL2":  (1.40 * _TON_AC_TO_KG_M2,  0.20 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL3":  (0.50 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.20, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL4":  (0.50 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL5":  (1.15 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL6":  (2.40 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL7":  (0.30 * _TON_AC_TO_KG_M2,  0.40 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "TL8":  (5.80 * _TON_AC_TO_KG_M2,  0.30 * _FT_TO_M, 0.35, 1750 * _FT_INV_TO_M_INV, 18600),
    "TL9":  (6.65 * _TON_AC_TO_KG_M2,  0.60 * _FT_TO_M, 0.35, 1750 * _FT_INV_TO_M_INV, 18600),

    # ── Slash-Blowdown (SB) ───────────────────────────────────
    "SB1":  (1.50 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "SB2":  (4.50 * _TON_AC_TO_KG_M2,  1.00 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "SB3":  (5.50 * _TON_AC_TO_KG_M2,  1.20 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
    "SB4":  (5.25 * _TON_AC_TO_KG_M2,  2.70 * _FT_TO_M, 0.25, 2000 * _FT_INV_TO_M_INV, 18600),
}
# fmt: on

# LANDFIRE FBFM40 numeric code → SB40 model name
# Codes from LANDFIRE metadata (US_220 product, layer 50)
LANDFIRE_CODE_MAP: dict[int, str] = {
    91: "NB1", 92: "NB2", 93: "NB3", 98: "NB8", 99: "NB9",
    101: "GR1", 102: "GR2", 103: "GR3", 104: "GR4",
    105: "GR5", 106: "GR6", 107: "GR7", 108: "GR8", 109: "GR9",
    121: "GS1", 122: "GS2", 123: "GS3", 124: "GS4",
    141: "SH1", 142: "SH2", 143: "SH3", 144: "SH4",
    145: "SH5", 146: "SH6", 147: "SH7", 148: "SH8", 149: "SH9",
    161: "TU1", 162: "TU2", 163: "TU3", 164: "TU4", 165: "TU5",
    181: "TL1", 182: "TL2", 183: "TL3", 184: "TL4",
    185: "TL5", 186: "TL6", 187: "TL7", 188: "TL8", 189: "TL9",
    201: "SB1", 202: "SB2", 203: "SB3", 204: "SB4",
}

DEFAULT_FUEL_MODEL = "GR2"  # moderate grass — safe conservative default


class FuelModel:
    def __init__(self, name: str, w0: float, delta: float, Mx: float, sigma: float, h: float):
        self.name = name
        self.w0 = w0          # kg/m²
        self.delta = delta    # m
        self.Mx = Mx          # fraction
        self.sigma = sigma    # m⁻¹
        self.h = h            # kJ/kg

    @property
    def rho_p(self) -> float:
        """Particle density (kg/m³) — standard wood value."""
        return 513.0

    @property
    def beta(self) -> float:
        """Packing ratio = w0 / (rho_p * delta)."""
        if self.delta <= 0:
            return 0.0
        return self.w0 / (self.rho_p * self.delta)

    @property
    def beta_op(self) -> float:
        """Optimum packing ratio."""
        return 3.348 * self.sigma ** (-0.8189)


def get(name: str) -> FuelModel:
    name = name.upper()
    if name not in _MODELS:
        name = DEFAULT_FUEL_MODEL
    w0, delta, Mx, sigma, h = _MODELS[name]
    return FuelModel(name, w0, delta, Mx, sigma, h)


def from_landfire_code(code: int) -> FuelModel:
    name = LANDFIRE_CODE_MAP.get(code, DEFAULT_FUEL_MODEL)
    return get(name)
