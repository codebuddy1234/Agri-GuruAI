"""Weather service (Open-Meteo).

Open-Meteo needs no API key, which keeps Phase 2 free to run. All HTTP is
stdlib urllib with a timeout, so no new dependencies. Failures raise
WeatherUnavailableError — weather being down must never look like a broken
database or a crashed backend.
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from typing import Any

from app.core.exceptions import WeatherUnavailableError

logger = logging.getLogger(__name__)

BASE_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"
SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search"
TIMEOUT_SECONDS = 10

#: WMO weather-code -> stable key. The frontend resolves each key against its
#: locale files, so this service stays language-neutral.
WEATHER_CODE_KEYS: dict[int, str] = {
    0: "clear",
    1: "mainly_clear",
    2: "partly_cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "freezing_drizzle",
    57: "freezing_drizzle",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "freezing_rain",
    67: "freezing_rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow_grains",
    80: "showers",
    81: "showers",
    82: "showers",
    85: "snow_showers",
    86: "snow_showers",
    95: "thunderstorm",
    96: "thunderstorm_hail",
    99: "thunderstorm_hail",
}


def condition_of(code: int) -> dict[str, Any]:
    code = int(code)
    return {"code": code, "key": WEATHER_CODE_KEYS.get(code, "unknown")}


def _fetch(params: dict[str, Any]) -> dict[str, Any]:
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        logger.warning("Weather provider request failed: %s", exc)
        raise WeatherUnavailableError() from exc


def get_place(latitude: float, longitude: float) -> dict[str, Any] | None:
    """Human-readable place for coordinates. Best-effort: returns None when
    the geocoding provider is unreachable, never fails the weather request."""
    url = (
        f"{GEOCODE_URL}?latitude={latitude}&longitude={longitude}"
        "&localityLanguage=en"
    )
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
        name = data.get("city") or data.get("locality") or ""
        region = data.get("principalSubdivision") or ""
        country = data.get("countryName") or ""
        if not name and not region:
            return None
        return {"name": name, "region": region, "country": country}
    except Exception as exc:
        logger.warning("Reverse geocode failed: %s", exc)
        return None


def search_places(query: str, count: int = 5) -> list[dict[str, Any]]:
    """Forward geocoding: text address -> candidate coordinates."""
    query = query.strip()
    if not query:
        return []
    url = f"{SEARCH_URL}?{urllib.parse.urlencode({'name': query, 'count': count, 'language': 'en', 'format': 'json'})}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        logger.warning("Place search failed: %s", exc)
        raise WeatherUnavailableError() from exc
    out = []
    for r in data.get("results") or []:
        try:
            out.append(
                {
                    "name": str(r.get("name") or ""),
                    "region": str(r.get("admin1") or ""),
                    "country": str(r.get("country") or ""),
                    "latitude": float(r["latitude"]),
                    "longitude": float(r["longitude"]),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


def get_current(latitude: float, longitude: float) -> dict[str, Any]:
    data = _fetch(
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
            "timezone": "auto",
        }
    )
    try:
        current = data["current"]
        return {
            "temperature_c": float(current["temperature_2m"]),
            "feels_like_c": float(current["apparent_temperature"]),
            "humidity_pct": int(current["relative_humidity_2m"]),
            "precipitation_mm": float(current.get("precipitation", 0.0)),
            "wind_kmh": float(current["wind_speed_10m"]),
            "condition": condition_of(current["weather_code"]),
            "observed_at": str(current["time"]),
        }
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Unexpected weather provider response: %s", exc)
        raise WeatherUnavailableError() from exc


def get_forecast(latitude: float, longitude: float, days: int) -> list[dict[str, Any]]:
    data = _fetch(
        {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": days,
        }
    )
    try:
        daily = data["daily"]
        out = []
        for i, date in enumerate(daily["time"]):
            rain = daily["precipitation_probability_max"][i]
            out.append(
                {
                    "date": str(date),
                    "temp_max_c": float(daily["temperature_2m_max"][i]),
                    "temp_min_c": float(daily["temperature_2m_min"][i]),
                    "rain_chance_pct": None if rain is None else int(rain),
                    "condition": condition_of(daily["weather_code"][i]),
                }
            )
        return out
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Unexpected weather provider response: %s", exc)
        raise WeatherUnavailableError() from exc
