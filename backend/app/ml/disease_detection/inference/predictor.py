"""Disease detection inference.

Wraps the MobileNetV2 PlantVillage `.keras` model. Loaded once at startup
and reused for every request, mirroring the crop recommendation predictor:
a missing or broken artifact degrades this feature (503) instead of
preventing the app from booting.
"""

from __future__ import annotations

import io
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.exceptions import ModelUnavailableError, PredictionFailedError

logger = logging.getLogger(__name__)

MODEL_FILE = "best_mnv2_pv_original.keras"
LABELS_FILE = "labels.json"

#: Must match the training input size (mobilenetv2_1.00_160).
IMAGE_SIZE = (160, 160)

#: How many ranked predictions to return.
TOP_K = 3

#: Predictions below this are dropped rather than shown as "0%" options.
MIN_PROBABILITY = 1e-4

#: 10 MB upload cap.
MAX_IMAGE_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class DiseaseCandidate:
    label: str
    probability: float


@dataclass(frozen=True)
class DiseaseResult:
    disease: str
    confidence: float
    alternatives: list[DiseaseCandidate]
    model_name: str
    model_version: str


class DiseasePredictor:
    """Loads the keras model lazily and serves predictions."""

    def __init__(self, artifacts_dir: Path) -> None:
        self.artifacts_dir = artifacts_dir
        self._model: Any = None
        self._labels: list[str] = []
        self._metadata: dict[str, Any] = {}
        self._loaded = False
        self._load_error: str | None = None

    # --- lifecycle ---

    def load(self) -> None:
        model_path = self.artifacts_dir / MODEL_FILE
        labels_path = self.artifacts_dir / LABELS_FILE
        metadata_path = self.artifacts_dir / "metadata.json"

        missing = [p.name for p in (model_path, labels_path) if not p.exists()]
        if missing:
            raise FileNotFoundError(
                f"Missing disease model artifacts {missing} in {self.artifacts_dir}."
            )

        # Imported here so the app boots even when TF is not installed;
        # health() then reports unavailable instead of crashing startup.
        import tensorflow as tf  # noqa: PLC0415

        # compile=False: the artifact was saved with a custom training loss
        # (`smoothed_loss`) that inference does not need. Loading without
        # the compiled training state avoids requiring that custom object.
        self._model = tf.keras.models.load_model(str(model_path), compile=False)
        self._labels = json.loads(labels_path.read_text(encoding="utf-8"))
        if metadata_path.exists():
            self._metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

        n_outputs = int(self._model.output_shape[-1])
        if n_outputs != len(self._labels):
            raise ValueError(
                f"Model outputs {n_outputs} classes but labels.json "
                f"has {len(self._labels)}. Fix labels.json to match training order."
            )

        self._loaded = True
        self._load_error = None
        logger.info("Loaded disease model (%d classes)", len(self._labels))

    def try_load(self) -> bool:
        try:
            self.load()
            return True
        except Exception as exc:  # noqa: BLE001 - deliberately broad at the boundary
            self._loaded = False
            self._load_error = str(exc)
            logger.error("Disease model unavailable: %s", exc)
            return False

    # --- introspection ---

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> str | None:
        return self._load_error

    @property
    def model_name(self) -> str:
        return str(self._metadata.get("model_name", "disease_detection"))

    @property
    def model_version(self) -> str:
        return str(self._metadata.get("model_version", "mnv2_pv_original_v1"))

    @property
    def labels(self) -> list[str]:
        return list(self._labels)

    def health(self) -> dict[str, Any]:
        if not self._loaded:
            return {"status": "unavailable", "reason": self._load_error}
        return {
            "status": "available",
            "model_name": self.model_name,
            "model_version": self.model_version,
            "algorithm": self._metadata.get("algorithm", "MobileNetV2"),
            "n_classes": len(self._labels),
        }

    # --- prediction ---

    def _preprocess(self, raw: bytes):
        """Decode, resize to 160x160 and scale to [-1, 1] (MobileNetV2)."""
        from PIL import Image  # noqa: PLC0415

        import numpy as np  # noqa: PLC0415

        try:
            img = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception as exc:
            raise PredictionFailedError(
                "That file is not a readable image. Please upload a JPG or PNG photo."
            ) from exc
        img = img.resize(IMAGE_SIZE)
        arr = np.asarray(img, dtype=np.float32)
        return (arr / 127.5 - 1.0)[None, ...]

    def predict_image(self, raw: bytes) -> DiseaseResult:
        if not self._loaded:
            raise ModelUnavailableError(
                "Disease detection is not available right now. "
                "Other features still work. Please try again shortly."
            )
        if not raw:
            raise PredictionFailedError("No image data was uploaded.")
        if len(raw) > MAX_IMAGE_BYTES:
            raise PredictionFailedError("That image is too large. Please upload a file under 10 MB.")

        batch = self._preprocess(raw)

        import numpy as np  # noqa: PLC0415

        try:
            probs = np.asarray(self._model.predict(batch, verbose=0)[0], dtype=float)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Disease prediction failed")
            raise PredictionFailedError() from exc

        ranked_idx = np.argsort(probs)[::-1][:TOP_K]
        ranked = [
            DiseaseCandidate(label=self._labels[int(i)], probability=round(float(probs[i]), 4))
            for i in ranked_idx
            if float(probs[i]) >= MIN_PROBABILITY
        ]
        if not ranked:
            raise PredictionFailedError()
        top = ranked[0]
        return DiseaseResult(
            disease=top.label,
            confidence=top.probability,
            alternatives=ranked[1:],
            model_name=self.model_name,
            model_version=self.model_version,
        )


#: Module-level singleton, populated by the FastAPI lifespan handler.
_predictor: DiseasePredictor | None = None


def init_disease_predictor(artifacts_dir: Path) -> DiseasePredictor:
    global _predictor
    _predictor = DiseasePredictor(artifacts_dir)
    _predictor.try_load()
    return _predictor


def get_disease_predictor() -> DiseasePredictor:
    if _predictor is None:
        raise ModelUnavailableError("The disease detection service is not initialised.")
    return _predictor
