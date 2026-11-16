"""Weather request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WeatherLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class WeatherForecastQuery(WeatherLocation):
    days: int = Field(default=7, ge=1, le=16)


class WeatherCondition(BaseModel):
    code: int
    key: str


class WeatherCurrent(BaseModel):
    temperature_c: float
    feels_like_c: float
    humidity_pct: int
    precipitation_mm: float
    wind_kmh: float
    condition: WeatherCondition
    observed_at: str


class WeatherDay(BaseModel):
    date: str
    temp_max_c: float
    temp_min_c: float
    rain_chance_pct: int | None
    condition: WeatherCondition


class WeatherCurrentResponse(BaseModel):
    location: WeatherLocation
    current: WeatherCurrent


class WeatherForecastResponse(BaseModel):
    location: WeatherLocation
    days: list[WeatherDay]
