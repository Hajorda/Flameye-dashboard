"""
Rothermel (1972) fire spread model — pure Python, SI units throughout.

Reference:
  Rothermel, R. C. (1972). A mathematical model for predicting fire spread in
  wildland fuels. USDA Forest Service Research Paper INT-115.

All inputs/outputs in SI:
  wind speed  → m/s
  slope       → fraction (tan of slope angle)
  rate of spread → m/min
"""

from __future__ import annotations

import math

from .fuel_models import FuelModel

# Mineral content (standard NFFL values)
_S_T = 0.0555   # total mineral content fraction
_S_E = 0.010    # effective mineral content fraction
_RHO_P = 513.0  # particle density kg/m³  (32 lb/ft³)


def _reaction_intensity(fuel: FuelModel, moisture: float) -> float:
    """
    Reaction intensity IR (kJ/m²/min).

    moisture: live + dead weighted moisture content (fraction, e.g. 0.08 = 8%)
    """
    sigma = fuel.sigma        # m⁻¹
    w0 = fuel.w0              # kg/m²
    Mx = fuel.Mx              # moisture of extinction (fraction)
    h = fuel.h                # heat content kJ/kg

    if sigma <= 0 or w0 <= 0:
        return 0.0

    # Moisture damping coefficient
    r_M = min(moisture / Mx, 1.0)
    eta_M = 1.0 - 2.59 * r_M + 5.11 * r_M**2 - 3.52 * r_M**3

    # Mineral damping coefficient
    eta_S = 0.174 * _S_E ** (-0.19)

    beta = fuel.beta
    beta_op = fuel.beta_op

    if beta_op <= 0:
        return 0.0

    # Optimum reaction velocity Γ'max (min⁻¹)
    A = 133.0 * sigma ** (-0.7913)
    gamma_max = sigma**1.5 / (495.0 + 0.0594 * sigma**1.5)

    # Reaction velocity Γ' (min⁻¹)
    ratio = beta / beta_op
    gamma = gamma_max * (ratio ** A) * math.exp(A * (1.0 - ratio))

    # Net fuel load (removes mineral content)
    w_n = w0 * (1.0 - _S_T)

    IR = gamma * w_n * h * eta_M * eta_S
    return max(IR, 0.0)


def _propagating_flux_ratio(fuel: FuelModel) -> float:
    """Propagating flux ratio ξ (dimensionless)."""
    sigma = fuel.sigma
    beta = fuel.beta
    if sigma <= 0:
        return 0.0
    return math.exp((0.792 + 0.681 * sigma**0.5) * (beta + 0.1)) / (192.0 + 0.2595 * sigma)


def _wind_factor(fuel: FuelModel, wind_speed_mps: float) -> float:
    """
    Wind factor φw.
    wind_speed_mps: mid-flame wind speed in m/s (positive = toward fire front)
    """
    if wind_speed_mps <= 0:
        return 0.0

    sigma = fuel.sigma
    beta = fuel.beta
    beta_op = fuel.beta_op

    # Convert wind speed to ft/min for the original Rothermel coefficients
    U_ft_min = wind_speed_mps * 196.85  # 1 m/s = 196.85 ft/min

    C = 7.47 * math.exp(-0.133 * sigma**0.55)
    B = 0.02526 * sigma**0.54
    E = 0.715 * math.exp(-3.59e-4 * sigma)

    phi_w = C * (U_ft_min**B) * (beta / beta_op) ** (-E)
    return max(phi_w, 0.0)


def _slope_factor(fuel: FuelModel, slope_tan: float) -> float:
    """
    Slope factor φs.
    slope_tan: tan(slope angle) — positive upslope, negative downslope
    """
    if slope_tan <= 0:
        return 0.0

    beta = fuel.beta
    phi_s = 5.275 * (beta**(-0.3)) * slope_tan**2
    return max(phi_s, 0.0)


def rate_of_spread(
    fuel: FuelModel,
    wind_speed_mps: float,
    slope_tan: float,
    moisture: float = 0.08,
) -> float:
    """
    Surface fire rate of spread R (m/min).

    fuel           : FuelModel instance
    wind_speed_mps : effective (mid-flame) wind speed in direction of spread (m/s)
    slope_tan      : tan(slope_angle) in direction of spread; positive = uphill
    moisture       : fine-fuel moisture content (fraction)
    """
    IR = _reaction_intensity(fuel, moisture)
    xi = _propagating_flux_ratio(fuel)

    if IR <= 0 or xi <= 0:
        return 0.0

    phi_w = _wind_factor(fuel, wind_speed_mps)
    phi_s = _slope_factor(fuel, slope_tan)

    rho_b = fuel.w0 / max(fuel.delta, 0.001)  # bulk density kg/m³
    epsilon = math.exp(-138.0 / max(fuel.sigma, 1.0))  # effective heating number
    Q_ig = 250.0 + 1116.0 * moisture               # heat of pre-ignition kJ/kg

    denominator = rho_b * epsilon * Q_ig
    if denominator <= 0:
        return 0.0

    R = IR * xi * (1.0 + phi_w + phi_s) / denominator
    return max(R, 0.0)
