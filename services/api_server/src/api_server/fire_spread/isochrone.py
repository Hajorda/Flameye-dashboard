"""
Generate fire spread isochrone polygons using Rothermel ROS per bearing direction.

Huygens wavelet approach (simplified):
  - Sample 72 bearing directions (every 5°)
  - For each bearing: compute effective wind + slope components → ROS → distance
  - Points at those distances form the isochrone polygon
"""

from __future__ import annotations

import math

from .fuel_models import FuelModel
from .rothermel import rate_of_spread

_EARTH_RADIUS_M = 6_371_000.0
_STEP_DEG = 5  # bearing resolution (degrees)


def _offset_latlon(lat: float, lon: float, bearing_deg: float, dist_m: float) -> tuple[float, float]:
    """
    Compute destination point given start, bearing, and distance.
    Uses spherical Earth approximation (Vincenty simplified).
    """
    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    bearing_r = math.radians(bearing_deg)
    ang_dist = dist_m / _EARTH_RADIUS_M

    new_lat_r = math.asin(
        math.sin(lat_r) * math.cos(ang_dist)
        + math.cos(lat_r) * math.sin(ang_dist) * math.cos(bearing_r)
    )
    new_lon_r = lon_r + math.atan2(
        math.sin(bearing_r) * math.sin(ang_dist) * math.cos(lat_r),
        math.cos(ang_dist) - math.sin(lat_r) * math.sin(new_lat_r),
    )
    return math.degrees(new_lat_r), math.degrees(new_lon_r)


def _effective_wind(wind_speed_mps: float, wind_deg: float, bearing_deg: float) -> float:
    """
    Project wind vector onto bearing direction.
    Returns the component of wind speed in the bearing direction (m/s).
    Negative = headwind → treated as 0 (fire doesn't spread into wind).
    """
    angle_diff = math.radians(bearing_deg - wind_deg)
    component = wind_speed_mps * math.cos(angle_diff)
    return max(component, 0.0)


def _effective_slope_tan(slope_deg: float, aspect_deg: float, bearing_deg: float) -> float:
    """
    Project slope gradient onto bearing direction.
    Fire spreads faster upslope; the effective slope component along a bearing:
      tan_eff = tan(slope_deg) * cos(bearing - upslope_direction)

    aspect_deg: direction slope faces (downhill direction, 0=N).
    upslope_direction = aspect_deg + 180° (opposite of downhill face).
    """
    if slope_deg <= 0:
        return 0.0
    tan_slope = math.tan(math.radians(slope_deg))
    upslope_dir = (aspect_deg + 180.0) % 360.0
    angle_diff = math.radians(bearing_deg - upslope_dir)
    component = tan_slope * math.cos(angle_diff)
    return max(component, 0.0)


def directional_ros(
    fuel: FuelModel,
    wind_speed_mps: float,
    wind_deg: float,
    slope_deg: float,
    aspect_deg: float,
    bearing_deg: float,
    moisture: float = 0.08,
) -> float:
    """Rate of spread (m/min) in a specific bearing direction."""
    u_eff = _effective_wind(wind_speed_mps, wind_deg, bearing_deg)
    tan_s = _effective_slope_tan(slope_deg, aspect_deg, bearing_deg)
    return rate_of_spread(fuel, u_eff, tan_s, moisture)


def compute_isochrones(
    lat: float,
    lon: float,
    fuel: FuelModel,
    wind_speed_mps: float,
    wind_deg: float,
    slope_deg: float,
    aspect_deg: float,
    times_min: list[int] | None = None,
    moisture: float = 0.08,
) -> list[dict]:
    """
    Compute fire spread isochrone polygons.

    Returns a list of dicts:
      [{"minutes": 30, "geojson": {"type": "Polygon", "coordinates": [[[lon, lat], ...]]}}, ...]
    """
    if times_min is None:
        times_min = [30, 60, 120]

    # Minimum distance floor so polygon is always visible (200 m)
    MIN_DIST_M = 200.0

    results = []
    for t in times_min:
        points: list[list[float]] = []
        for bearing in range(0, 360, _STEP_DEG):
            ros = directional_ros(fuel, wind_speed_mps, wind_deg, slope_deg, aspect_deg, bearing, moisture)
            dist = max(ros * t, MIN_DIST_M)
            new_lat, new_lon = _offset_latlon(lat, lon, bearing, dist)
            points.append([round(new_lon, 6), round(new_lat, 6)])

        # Close the polygon
        points.append(points[0])

        results.append({
            "minutes": t,
            "geojson": {
                "type": "Polygon",
                "coordinates": [points],
            },
        })

    return results
