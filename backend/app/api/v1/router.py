"""Aggregates every v1 router.

Adding a module in a later phase means one import and one include_router
line here - no other file changes.
"""

from fastapi import APIRouter

from app.api.v1 import auth, crop_recommendation, disease_detection, farmer, health, modules, weather

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(farmer.router)
api_router.include_router(crop_recommendation.router)
api_router.include_router(disease_detection.router)
api_router.include_router(weather.router)
api_router.include_router(modules.router)
