"""Weather routes.

Thin wrappers over Open-Meteo via the service layer: validate coordinates,
call the service, shape the response. No database access — weather is
fetched live and never stored.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query

from app.api.v1.deps import CurrentFarmer
from app.schemas.common import envelope
from app.services import weather_service

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/search", summary="Find places matching a text address")
def search(
    user: CurrentFarmer,  # noqa: ARG001 - auth guard; user unused beyond the role check
    name: Annotated[str, Query(min_length=2, max_length=100)],
) -> dict[str, Any]:
    return envelope({"places": weather_service.search_places(name)})


@router.get("/current", summary="Current weather for a location")
def current(
    user: CurrentFarmer,  # noqa: ARG001 - auth guard; user unused beyond the role check
    latitude: Annotated[float, Query(ge=-90, le=90)],
    longitude: Annotated[float, Query(ge=-180, le=180)],
) -> dict[str, Any]:
    return envelope(
        {
            "location": {"latitude": latitude, "longitude": longitude},
            "place": weather_service.get_place(latitude, longitude),
            "current": weather_service.get_current(latitude, longitude),
        }
    )


@router.get("/forecast", summary="Daily forecast for a location")
def forecast(
    user: CurrentFarmer,  # noqa: ARG001 - auth guard; user unused beyond the role check
    latitude: Annotated[float, Query(ge=-90, le=90)],
    longitude: Annotated[float, Query(ge=-180, le=180)],
    days: Annotated[int, Query(ge=1, le=16)] = 7,
) -> dict[str, Any]:
    return envelope(
        {
            "location": {"latitude": latitude, "longitude": longitude},
            "place": weather_service.get_place(latitude, longitude),
            "days": weather_service.get_forecast(latitude, longitude, days),
        }
    )
