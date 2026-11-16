"""Disease detection routes.

Accepts a leaf photo upload, runs the MobileNetV2 model and returns the
ranked diagnosis. No persistence in Phase 2: the result is returned
directly, nothing is written to the database.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, UploadFile
from app.api.v1.deps import CurrentFarmer, DiseasePredictorDep
from app.core.exceptions import InvalidInputError
from app.schemas.common import envelope

router = APIRouter(prefix="/disease-detection", tags=["disease detection"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/predict", summary="Identify plant disease from a leaf photo")
async def predict(
    user: CurrentFarmer,  # noqa: ARG001 - auth guard; user unused beyond the role check
    image: UploadFile,
    predictor: DiseasePredictorDep,
) -> dict[str, Any]:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidInputError(
            "Please upload a JPG, PNG or WebP photo.",
            details=[{"field": "image", "message": "Only JPG, PNG or WebP images are accepted."}],
        )
    raw = await image.read()
    result = predictor.predict_image(raw)
    return envelope(
        {
            "disease": result.disease,
            "confidence": result.confidence,
            "alternatives": [
                {"label": c.label, "probability": c.probability}
                for c in result.alternatives
            ],
            "model_name": result.model_name,
            "model_version": result.model_version,
        }
    )


@router.get("/model-info", summary="Which disease model is currently serving")
def model_info(user: CurrentFarmer, predictor: DiseasePredictorDep) -> dict[str, Any]:  # noqa: ARG001
    return envelope(
        {
            "model_name": predictor.model_name,
            "model_version": predictor.model_version,
            "n_classes": len(predictor.labels),
            "classes": predictor.labels,
            "input_size": [160, 160],
        }
    )
