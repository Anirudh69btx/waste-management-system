from __future__ import annotations

import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def bearing_degrees(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lng2 - lng1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    deg = math.degrees(math.atan2(y, x))
    return (deg + 360) % 360


def move_towards(
    lat1: float, lng1: float, lat2: float, lng2: float, distance_km: float
) -> tuple[float, float]:
    dist = haversine_km(lat1, lng1, lat2, lng2)
    if dist <= distance_km or dist == 0:
        return (lat2, lng2)
    fraction = distance_km / dist
    new_lat = lat1 + (lat2 - lat1) * fraction
    new_lng = lng1 + (lng2 - lng1) * fraction
    return (round(new_lat, 7), round(new_lng, 7))
