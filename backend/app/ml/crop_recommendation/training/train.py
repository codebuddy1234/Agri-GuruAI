"""Train the production crop recommendation model (ExtraTreesClassifier).

Run from the backend directory:

    python -m app.ml.crop_recommendation.training.train

Never imported by the API. Trains one fixed model on a stratified
train/holdout split and writes the serving artifacts.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.core.config import get_settings
from app.ml.crop_recommendation.schema import (
    FEATURE_ORDER,
    FEATURE_SPECS,
    MODEL_NAME,
    TARGET_NAME,
)

RANDOM_STATE = 42
TEST_SIZE = 0.2
MODEL_VERSION = "v1.0.0"
N_ESTIMATORS = 300


def load_dataset(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")
    df = pd.read_csv(csv_path)

    missing = (set(FEATURE_ORDER) | {TARGET_NAME}) - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns {sorted(missing)}.")
    if df[list(FEATURE_ORDER)].isna().any().any():
        raise ValueError("Dataset contains missing feature values.")
    if not np.isfinite(df[list(FEATURE_ORDER)].to_numpy()).all():
        raise ValueError("Dataset contains non-finite feature values.")
    return df


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "clf",
                ExtraTreesClassifier(
                    n_estimators=N_ESTIMATORS,
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def evaluate_holdout(
    model: Pipeline,
    X_test: np.ndarray,
    y_test: np.ndarray,
    class_names: list[str],
) -> dict[str, Any]:
    y_pred = model.predict(X_test)
    metrics = {
        "holdout_accuracy": float(accuracy_score(y_test, y_pred)),
        "holdout_macro_f1": float(f1_score(y_test, y_pred, average="macro")),
        "holdout_macro_precision": float(
            precision_score(y_test, y_pred, average="macro", zero_division=0)
        ),
        "holdout_macro_recall": float(
            recall_score(y_test, y_pred, average="macro", zero_division=0)
        ),
    }
    report = classification_report(
        y_test, y_pred, target_names=class_names, zero_division=0, output_dict=True
    )
    return {
        "metrics": metrics,
        "per_class_f1": {
            name: round(float(report[name]["f1-score"]), 4)
            for name in class_names
            if name in report
        },
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }


def main() -> None:
    settings = get_settings()
    csv_path = settings.DATASET_PATH
    out_dir = settings.MODEL_ARTIFACTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataset(csv_path)
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df[TARGET_NAME])
    class_names = list(label_encoder.classes_)

    X_train, X_test, y_train, y_test = train_test_split(
        df[list(FEATURE_ORDER)].to_numpy(dtype=np.float64),
        y,
        test_size=TEST_SIZE,
        stratify=y,
        shuffle=True,
        random_state=RANDOM_STATE,
    )

    model = build_pipeline()
    model.fit(X_train, y_train)
    holdout = evaluate_holdout(model, X_test, y_test, class_names)

    for key, value in holdout["metrics"].items():
        print(f"{key}: {value:.4f}")

    joblib.dump(model, out_dir / "model.joblib")
    joblib.dump(model.named_steps["scaler"], out_dir / "preprocessor.joblib")
    joblib.dump(label_encoder, out_dir / "label_encoder.joblib")

    metadata = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "algorithm": "ExtraTrees",
        "trained_at": datetime.now(UTC).isoformat(),
        "random_state": RANDOM_STATE,
        "dataset": {
            "file": csv_path.name,
            "sha256": file_sha256(csv_path),
            "n_rows": int(len(df)),
            "n_classes": len(class_names),
            "test_size": TEST_SIZE,
        },
        "feature_names": list(FEATURE_ORDER),
        "target_name": TARGET_NAME,
        "classes": class_names,
        "hyperparameters": {
            "n_estimators": N_ESTIMATORS,
            "random_state": RANDOM_STATE,
            "n_jobs": -1,
        },
        "metrics": holdout["metrics"],
        "per_class_f1": holdout["per_class_f1"],
        "confusion_matrix": holdout["confusion_matrix"],
        "input_ranges": {
            spec.name: {
                "training_min": spec.training_min,
                "training_max": spec.training_max,
                "accepted_min": spec.accepted_min,
                "accepted_max": spec.accepted_max,
                "unit": spec.unit,
            }
            for spec in FEATURE_SPECS.values()
        },
        "library_versions": {
            "scikit-learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "joblib": joblib.__version__,
        },
    }
    (out_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Artifacts written to {out_dir}")


if __name__ == "__main__":
    main()
