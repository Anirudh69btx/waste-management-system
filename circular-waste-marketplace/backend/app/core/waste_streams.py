"""Waste stream compatibility matrix.

A trip may only include pickups from ONE stream class.
Mixing causes downstream contamination and safety issues.
"""
from __future__ import annotations


WASTE_STREAM_CLASSES: dict[str, set[int]] = {
    "DRY_RECYCLABLE": {34, 35, 36, 37, 40},   # plastic, paper, ferrous, glass, textile
    "ORGANIC": {33},                           # organic biomass
    "HAZARDOUS_SPECIAL": {38, 39},             # e-waste, hazardous
}


def category_to_stream(category_id: int) -> str | None:
    for stream, ids in WASTE_STREAM_CLASSES.items():
        if category_id in ids:
            return stream
    return None


def streams_compatible(category_ids: list[int]) -> tuple[bool, str | None]:
    """Return (is_compatible, stream_class)."""
    if not category_ids:
        return (True, None)
    streams = {category_to_stream(c) for c in category_ids}
    streams.discard(None)
    if len(streams) == 1:
        return (True, streams.pop())
    return (False, None)
