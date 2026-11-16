# AgriGuru AI

Smart agriculture decision-support platform for farmers — Maharashtra first, in
**Marathi, Hindi and English**.

**Phase 1 is complete**: the Crop Recommendation module is built end-to-end, on
an architecture the remaining modules attach to without restructuring.

```
Farmer → HTML/CSS/JS → FastAPI → validation → service → trained model
                                    ↓
                              PostgreSQL → history
```

---

## What works today

| | |
|---|---|
| 🌱 **Crop Recommendation** | Live — 22 crops from 7 soil/weather values |
| 🔐 Authentication | Email + password, JWT access/refresh, farmer/expert/admin roles |
| 👤 Farmer profile & farms | Profile, location, farms in acre/guntha/hectare |
| 📜 Prediction history | Every recommendation saved with its model version |
| 🌐 Marathi / Hindi / English | Locale in the URL, one JSON dictionary per language |

Disease detection (pretrained MobileNetV2), live weather (Open-Meteo) and the
offline fertiliser calculator are live. Market prices, yield prediction,
schemes and expert review appear as **Coming Soon** cards.

## ⚠️ Read this before quoting an accuracy number

The model scores **0.9955 holdout accuracy**, and that figure is close to
meaningless as a measure of real-world usefulness:

- The dataset is effectively **synthetic** — exactly 100 rows per crop, tidy
  per-crop ranges, integer N/P/K against 8-decimal temperatures.
- The classes are **near-separable by construction**: four very different model
  families land within 2.7 points, and naive Bayes leads.
- There is **no geography, season or soil type** in the data, yet the target
  region is Maharashtra — and the label set contains apple and coconut.
- **N, P, K are unitless ratios, not kg/ha.** A soil health card value is on a
  different scale and will mislead.

Details: [`docs/DATASET_INSPECTION.md`](docs/DATASET_INSPECTION.md) §6 and
[`docs/MODEL_CARD.md`](docs/MODEL_CARD.md).

## Quick start

### With Docker

```bash
cp .env.example backend/.env
# set a real SECRET_KEY — the app refuses to start with the placeholder:
python -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up --build
```

Then: frontend http://localhost:3000 · API docs http://localhost:8000/api/v1/docs

### Manual

**1. Database** (PostgreSQL 13+ — `gen_random_uuid()` is built in from 13)

```bash
createdb agriguru
psql -c "CREATE USER agriguru WITH PASSWORD 'agriguru';"
```

**2. Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

cp ../.env.example .env          # then set a real SECRET_KEY
alembic upgrade head             # creates the 4 tables

# Train the model (once). The API loads the artifacts; it never retrains.
python -m app.ml.crop_recommendation.training.train

uvicorn app.main:app --reload
```

**3. Frontend**

```bash
cd frontend
python -m http.server 3000
```

Open http://localhost:3000 — the app starts on `/#/mr` (Marathi is the default).
No `npm install` or build step: the frontend is plain HTML, CSS and ES modules.
To point at a different API, set `window.AGRIGURU_API_BASE_URL` before the app
scripts load (default `http://localhost:8000/api/v1`), or edit
`frontend/js/config.js`.

## Troubleshooting

### "Cannot reach the server. Check your internet connection."

This is **not** a database problem. It means the browser got *no HTTP response
at all*, so the request never reached the backend. (A broken database gives you
"The service is temporarily unavailable" instead — that comes back as a 503
*from* the backend, which means the backend was reachable.)

Causes, in the order they actually happen:

| # | Cause | Check |
|---|---|---|
| 1 | Backend not running | `curl http://localhost:8000/api/v1/health` |
| 2 | Backend **crashed at startup** | Look at the uvicorn terminal |
| 3 | CORS blocks the origin | `CORS_ORIGINS` in `backend/.env` |
| 4 | Wrong API URL | `API_BASE_URL` in `frontend/js/config.js` |

**Cause 2 is the most common on a first setup.** If you copied `.env.example`
without generating a `SECRET_KEY`, the backend refuses to start:

```
pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings
SECRET_KEY
  Value error, SECRET_KEY is still the placeholder from .env.example.
```

That is deliberate — a guessable signing key would let anyone forge a login
token. Fix it:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
# paste the output as SECRET_KEY in backend/.env, then restart uvicorn
```

Run the backend in its **own terminal and keep it visible**. If it exits
immediately, the error printed there is your real problem.

**Cause 3** catches people out because `localhost` and `127.0.0.1` are
*different origins* to a browser. If you open the site on one and only the other
is listed in `CORS_ORIGINS`, every request is blocked and looks exactly like the
server being down. List both in development:

```
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

The frontend uses hash routing (`/#/mr/...`), so it works on any static file
server with no rewrite rules.

### Other common issues

| Symptom | Cause | Fix |
|---|---|---|
| `relation "users" does not exist` | Migrations not run | `cd backend && alembic upgrade head` |
| Predictions return 503, everything else works | Model not trained | `python -m app.ml.crop_recommendation.training.train` |
| `password authentication failed` | `POSTGRES_PASSWORD` mismatch, or the role does not exist | `ALTER USER agriguru WITH PASSWORD '…';` |
| `database "agriguru" does not exist` | Database not created | `createdb agriguru` |
| `pytest` fails to connect | No test database | `createdb agriguru_test` |

## Testing

```bash
cd backend && pytest              # 82 tests, needs PostgreSQL
python scripts/inspect_dataset.py # reproduces every dataset figure
# frontend has no build/typecheck step — plain HTML/CSS/JS served as static files
```

The backend tests run against **real PostgreSQL**, not SQLite: the schema uses
JSONB, UUID server defaults and PG enums, so a SQLite substitute would test a
different schema than the one that ships. Set `TEST_DATABASE_URL` to point at a
scratch database.

## Project structure

```
backend/
  app/
    api/v1/        routes — validate, delegate, return. No ML, no SQL.
    core/          config, security, exceptions, logging
    database/      SQLAlchemy models + session
    schemas/       Pydantic request/response contracts
    services/      business logic and transactions
    ml/crop_recommendation/
      schema.py    FEATURE_ORDER + validation ranges (single source of truth)
      training/    offline only — never imported by the API
      inference/   predictor loaded once at startup
      artifacts/   model.joblib, label_encoder.joblib, metadata.json
  alembic/         migrations
  tests/           82 tests
frontend/
  index.html       single entry point (ES modules, no build step)
  styles.css       full design system (soil / leaf / harvest palette)
  js/
    config.js      API base URL, storage keys, hero images
    i18n.js        locale loading, t()/tf(), crop & date formatting
    api.js         fetch client: envelopes, JWT refresh, multipart upload
    router.js      hash router: /#/mr/dashboard
    store.js       shared auth module state
    ui.js          shared render helpers (cards, forms, shell, alerts)
    icons.js       inline SVG icon set
    views/         one module per page (landing, auth, dashboard, crop,
                   result, disease, weather, fertilizer, history, profile)
  locales/         en.json · hi.json · mr.json (identical key sets)
data/raw/          Crop_recommendation.csv
docs/              DATASET_INSPECTION · PHASE1_PLAN · API · MODEL_CARD
scripts/           inspect_dataset.py
```

## Architecture decisions worth knowing

**Modular monolith, not microservices.** One API, one database, one compose
file. Adding a module means four files (`api/v1/x.py`, `schemas/x.py`,
`services/x_service.py`, `database/models/x.py`) plus one router line.

**The model loads once at startup.** If the artifacts are missing the app still
boots, `/health` reports `degraded`, and only `/predict` returns 503 — a broken
model file must not take down login and history.

**Feature order is enforced, not assumed.** It is written to `metadata.json`,
checked against the code's `FEATURE_ORDER` at load, and request vectors are
built by name lookup. A silent reorder would produce confident wrong answers
with no error anywhere; a test proves the guard actually bites.

**Model selection has a probability-quality gate.** Accuracy alone picked
GaussianNB, which returns 100% confidence on 60.7% of predictions. Since the UI
shows confidence and ranked alternatives, that model was disqualified in favour
of RandomForest. See [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md).

**Extrapolation is flagged, not hidden.** Plausible values outside the training
range are accepted and marked `out_of_training_range` in the response and the UI.

**Cross-farmer reads return 404, not 403** — a 403 confirms the record exists.

## Security

Password hashing with bcrypt · JWT with a `type` claim so a refresh token
cannot be replayed as an access token · role-based dependencies ready for
expert and admin · CORS restricted to configured origins (never `*`) · all
secrets from `.env` with `.env.example` committed and `.env` git-ignored ·
ORM-only queries · structured errors that never leak stack traces.

No external API keys are needed: weather uses Open-Meteo (no key) and ML
artifacts are local. Tokens are kept in localStorage, matching the previous
frontend; an httpOnly-cookie setup is deferred to a deployment phase.

## Roadmap

Phase 2: disease detection (CNN), weather integration, mobile OTP login.
Phase 3: market prices, fertiliser recommendation.
Phase 4: yield prediction, schemes, expert verification, admin dashboard.

Each attaches to `farmer_profiles` / `farms` / `users` with the conventions
already in place. None of their tables are created early.
