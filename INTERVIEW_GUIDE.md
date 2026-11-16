# AgriGuru AI — Complete Codebase Guide (for your interview)

> Plain-English explanation of every code file — how it works and what it does.
> No code was changed; this document is information only.

---

## 1. What the project is (the 30-second answer)

**AgriGuru** is a smart-farming decision-support website for farmers in Maharashtra, available in **Marathi, Hindi and English**. A farmer signs up, enters 7 soil/weather values, and the app recommends which crop to grow — with a confidence score, alternative crops, and a saved history. It also has leaf-photo disease detection and live weather.

The one-line architecture (from the README):

```
Farmer → Next.js (frontend) → FastAPI (backend) → validation → service → trained ML model
                                                      ↓
                                                PostgreSQL (history)
```

**Tech stack:**
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL + Alembic (migrations)
- **ML:** scikit-learn (crop model, `.joblib` file) + TensorFlow/MobileNetV2 (disease model, `.keras` file)
- **Tests:** pytest (82 tests, real PostgreSQL)
- **Deployment:** Docker Compose (3 services: db, api, web)

---

## 2. How a request flows end-to-end (the story to tell)

This is the most important thing to understand. Say a farmer submits the crop form:

1. **Frontend form** (`crop-form.tsx`) validates inputs locally, then calls `api.predict()` in `api-client.ts`.
2. **API client** attaches the JWT token (`Authorization: Bearer ...`) and does `POST /api/v1/crop-recommendation/predict`.
3. **`main.py`** receives it. Middleware adds a request ID; exception handlers wrap everything in a standard response.
4. **Router** (`v1/router.py` → `crop_recommendation.py`) matches the URL. The route function is *thin*: it validates the request with a Pydantic schema, checks the JWT via dependencies, and delegates.
5. **Dependencies** (`deps.py`) verify the token, load the user from the DB, and confirm the role is "farmer". Also injects the DB session and the pre-loaded ML predictor.
6. **Schema** (`schemas/crop.py`) validates the 7 numbers against ranges defined in the ML `schema.py` (single source of truth).
7. **Service** (`crop_recommendation_service.py`) — the only place ML and DB meet. It maps field names → feature names, verifies farm ownership, calls the predictor, flags out-of-range values, and saves the result to the DB.
8. **Predictor** (`ml/.../inference/predictor.py`) builds the feature vector by name, calls `predict_proba`, ranks the top 3 crops, and returns the result.
9. Response travels back up through `envelope()` → `{"success": true, "data": {...}}` → frontend shows the result page.
10. If a 401 happens anywhere, the API client transparently refreshes the token and retries once.

---

## 3. Backend files, folder by folder

### 3.1 `backend/app/main.py` — the application entry point
- `create_app()` builds the FastAPI app: sets the title/docs URLs, adds **CORS** middleware (restricted origins, never `*`), adds a **request-ID middleware** (every response gets `X-Request-ID`).
- Registers **5 exception handlers** so *every* error leaves in one standard shape: app errors, validation errors (422), database errors, HTTP errors, and a catch-all 500 that never leaks a stack trace to the farmer.
- **`lifespan()`**: runs at startup — configures logging, then loads **both ML models once** (crop + disease). If a model file is broken, it logs a warning and still boots (graceful degradation).
- Includes the versioned router under `/api/v1`, plus `/` and the health route.

### 3.2 `backend/app/core/` — infrastructure/config
| File | What it does (plain English) |
|---|---|
| **config.py** | Reads all settings from environment/.env into a typed `Settings` class. `SECRET_KEY` has **no default** and a validator rejects the `.env.example` placeholder — so a bad deployment fails at startup instead of running with a guessable key. Provides `sqlalchemy_url` and `cors_origin_list` properties. `get_settings()` is cached (parses .env once). |
| **security.py** | Password hashing with **bcrypt** (rejects >72-byte passwords silently truncated by bcrypt). JWT create/decode with **access** and **refresh** token types. The `type` claim is checked so a refresh token can't be replayed as an access token. |
| **exceptions.py** | A hierarchy of expected errors (`InvalidInputError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`, `ModelUnavailableError`, `DatabaseUnavailableError`, etc.), each with an HTTP status, error code, and farmer-friendly message. |
| **logging.py** | Emits **single-line JSON logs** (greppable in containers). Each log line carries the same `request_id` returned to the client in errors. |

### 3.3 `backend/app/database/` — data layer
| File | What it does |
|---|---|
| **session.py** | Creates the SQLAlchemy **engine** (connection pool with `pool_pre_ping`), the session factory, a `get_session()` dependency that always closes the session, and `database_is_reachable()` used by health checks (never raises). |
| **base.py** | Shared building blocks: `UUIDPrimaryKeyMixin` (UUID ids via `gen_random_uuid()`) and `TimestampMixin` (`created_at`/`updated_at` stamped by the DB). |
| **models/enums.py** | Enums shared by DB and API: `UserRole` (farmer/expert/admin), `Language` (mr/hi/en), `AreaUnit` (acre/hectare/guntha). Defined once so values can't drift. |
| **models/user.py** | `users` table: auth only — email, mobile, password hash, role, active/verified flags, last login. Deliberately holds no farmer-specific data. |
| **models/farmer_profile.py** | `farmer_profiles` table (1:1 with user): name, preferred language, structured location (state/district/taluka/village, lat/long). Structured columns so weather/market modules can join on district later. |
| **models/farm.py** | `farms` table (1:N from profile): name, **area as value + unit** (never a bare number), soil type, irrigation. Has a DB check constraint that area must be positive. |
| **models/crop_prediction.py** | `crop_predictions` table: the 7 inputs as typed columns, the recommended crop, confidence, JSONB `alternatives`, and **mandatory `model_name`/`model_version`** for provenance. This is both history and audit record. |
| **models/__init__.py** | Imports all models so they register on `Base.metadata` before Alembic runs — a model not imported here would be silently missing from migrations. |

### 3.4 `backend/app/schemas/` — request/response contracts (Pydantic)
| File | What it does |
|---|---|
| **common.py** | The single **response envelope**: `SuccessResponse` (`{success, data}`), `ErrorResponse` (`{success:false, error}`), and `PaginatedResponse`. Every endpoint uses these. |
| **auth.py** | Register/login/refresh request schemas. Password strength (length + digit + letter), Indian mobile number validation, and token/user output shapes. |
| **farmer.py** | Profile output, **partial** profile update (every field optional so omitted fields aren't blanked), farm create/output schemas. |
| **crop.py** | The 7 crop inputs. **Key point:** validation bounds are imported from the ML `schema.py` (not hardcoded), and `allow_inf_nan=False` rejects NaN/Infinity (which otherwise pass all range checks silently). Also the history/detail output schemas. |
| **weather.py** | Coordinate and forecast request/response shapes; weather codes kept as language-neutral keys. |

### 3.5 `backend/app/services/` — business logic
| File | What it does |
|---|---|
| **auth_service.py** | Register creates user + profile in **one transaction** (atomic). Login **always runs a hash comparison even for unknown emails** so response time can't reveal registered accounts; deliberately vague "incorrect email or password" message. Refresh validates the token and issues a new pair. |
| **farmer_service.py** | Profile get/update (uses `exclude_unset=True` for true partial updates), farm list/create, and `get_owned_farm()` which returns **404 not 403** for someone else's farm (a 403 would confirm the record exists). |
| **crop_recommendation_service.py** | The orchestration layer: maps farmer-facing names (nitrogen, phosphorus…) → model names (N, P, K…), checks farm ownership *before* inference, calls the predictor, flags out-of-training-range values, saves the prediction, and handles paginated history. |
| **weather_service.py** | Calls Open-Meteo (no API key needed) using stdlib `urllib` with a 10s timeout. Reverse geocoding and place search. Maps WMO weather codes to language-neutral keys. Failures raise `WeatherUnavailableError` so weather-outage looks different from a DB outage. |

### 3.6 `backend/app/api/v1/` — the routes (thin controllers)
| File | What it does |
|---|---|
| **router.py** | Aggregates all 7 routers. Adding a new module = one import + one line. |
| **deps.py** | Shared dependencies: DB session, `current_user` (decodes JWT, loads user, checks active), `require_role()` factory (ready for expert/admin), and injected predictors. |
| **auth.py** | `/auth/register`, `/login`, `/refresh`, `/me`. |
| **farmer.py** | `/farmer/profile` (GET/PUT), `/farmer/farms` (GET/POST). |
| **crop_recommendation.py** | `/predict`, `/history`, `/history/{id}`, `/model-info`. The history list is deliberately lightweight (no heavy input values). |
| **health.py** | `/health` reports DB + both models separately. Overall status is `ok`, `degraded` (model missing but login works), or `down` (DB gone → 503). |
| **weather.py** | `/weather/search`, `/current`, `/forecast`. |
| **disease_detection.py** | `/disease-detection/predict` (accepts JPG/PNG/WebP upload) and `/model-info`. |
| **modules.py** | `/modules` — a registry the dashboard renders from. "Coming soon" modules have `route: None`, so a fake link can never ship. |

### 3.7 `backend/app/ml/` — the machine learning
| File | What it does |
|---|---|
| **crop_recommendation/schema.py** | ⭐ **Single source of truth.** `FEATURE_ORDER` = the contractual order (N, P, K, temperature, humidity, ph, rainfall). `FEATURE_SPECS` holds **training ranges** (what the model saw) vs **accepted ranges** (physically plausible). `out_of_training_range()` flags values the model is extrapolating on. |
| **crop_recommendation/inference/predictor.py** | Loads `model.joblib`, `label_encoder.joblib`, `metadata.json` **once**. ⭐ `_verify_feature_contract()` refuses to serve if code order ≠ artifact order (a silent reorder would give confident wrong answers). Builds the vector by **name lookup** (never dict order). `predict_proba` → top 3 ranked crops. Module-level singleton via `init_predictor()`/`get_predictor()`. |
| **crop_recommendation/training/train.py** | ⭐ **Offline only — never imported by the API.** Reads the CSV, stratified 80/20 split, trains an **ExtraTreesClassifier (300 trees)** in a StandardScaler pipeline, evaluates holdout metrics, and saves model + encoder + metadata (feature names, dataset SHA-256, library versions, ranges, caveat). |
| **crop_recommendation/artifacts/** | The trained files: `model.joblib` (~47 MB), `preprocessor.joblib`, `label_encoder.joblib`, `metadata.json`. |
| **disease_detection/inference/predictor.py** | Mirrors the crop predictor. Lazily imports TensorFlow (so app boots without it), loads MobileNetV2 `.keras` with `compile=False` (skips custom training loss), verifies output count = label count. Preprocesses image: decode → resize 160×160 → scale to [-1,1]. 10 MB upload cap. Singleton. |
| **disease_detection/artifacts/** | `best_mnv2_pv_original.keras` (~28 MB), `labels.json` (38 PlantVillage classes), `metadata.json`. |

### 3.8 Other backend files
- **alembic/** — database migrations. `env.py` wires SQLAlchemy models to Alembic; the single version file creates all 4 tables, indexes, enums and check constraints (`downgrade()` drops them).
- **requirements.txt** — pinned dependencies (FastAPI, SQLAlchemy, bcrypt, pyjwt, scikit-learn, TensorFlow, etc.). Note: uses `bcrypt` directly, not `passlib` (passlib is stale/incompatible with bcrypt 4.x).
- **pytest.ini / tests/** — 82 tests. `conftest.py` sets env vars before imports, builds schema from models in **real PostgreSQL** (not SQLite, because JSONB/UUID/enums differ), and has fixtures like `farmer()` (registers a test user + token). Test files: `test_auth.py`, `test_farmer.py`, `test_crop_recommendation.py`, `test_ml.py`, `test_health.py`.

---

## 4. Frontend files, folder by folder

### 4.1 `frontend/app/` — routing (Next.js App Router)
| File | What it does |
|---|---|
| **layout.tsx** | Root layout: loads **Noto Sans** (covers Devanagari so Marathi/Hindi render correctly), metadata, viewport theme color. |
| **page.tsx** | Root page just redirects to `/mr` (Marathi default). |
| **[locale]/layout.tsx** | Validates the locale segment (`mr`, `hi`, `en`), sets `<html lang>`, generates static params for all 3 languages. |
| **[locale]/page.tsx** | The **landing page** — hero carousel, stats, features, "how it works", honesty warning, CTA, footer. Fully translated. |
| **[locale]/{dashboard, register, login, crop-recommendation, crop-recommendation/result, history, history/[id], profile, weather, disease-detection, fertilizer}/page.tsx** | These are all **thin server components**: validate locale, load the dictionary, and render one client component. No logic lives here. |

### 4.2 `frontend/lib/` — shared helpers
| File | What it does |
|---|---|
| **api-client.ts** | ⭐ The single HTTP client. `request()` adds auth header, handles errors into `ApiClientError`, and **auto-refreshes tokens once on 401**. `tokenStore` saves tokens in localStorage. One method per backend endpoint. `diseasePredict` uses FormData separately (can't go through JSON helper). |
| **i18n.ts / i18n.client.ts** | Server-only dictionary loader + client-safe locale constants. Language is in the **URL segment** (`/mr/...`) so the first paint is already translated and URLs are shareable. English is the key-shape source of truth, so a missing key in hi/mr is a **build error**. |
| **format.ts** | Tiny `{placeholder}` interpolation, crop-name translation, and date/percent formatting. Forces **Latin digits** (`-u-nu-latn`) so a confidence of 95% isn't shown as ९५% next to an input typed as 95. |
| **crop-fields.ts** | The 7 form fields, min/max/step, and a **client-side pre-check**. Comment explicitly says this is for instant feedback only — the backend still validates independently. N/P/K have blank units on purpose (they're unitless ratios). |
| **utils.ts** | `cn()` — standard clsx + tailwind-merge class combiner. |

### 4.3 `frontend/components/` — UI building blocks
| File | What it does |
|---|---|
| **ui/button.tsx** | Reusable button with variants and a `loading` spinner. 48px min height = touch target for one-handed outdoor phone use. |
| **ui/card.tsx, ui/alert.tsx, ui/field.tsx** | Card container; status alert (info/warning/error/success); label + input components with help text and error slots. |
| **layout/app-shell.tsx** | Shell for every signed-in page: header + sidebar built from `/modules`. On mobile it becomes a slide-over drawer. "Coming soon" modules render as non-clickable rows. |
| **layout/app-header.tsx** | Simpler header used on login/register. |
| **layout/language-switcher.tsx** | Switches the locale in the URL (keeps you on the same page + query string) and saves the preference to the profile (fire-and-forget). |
| **layout/module-card.tsx** | Dashboard card. "Coming soon" is a `<div>` not a link — no fake clickable cards. Exports the icon map. |
| **landing/hero-carousel.tsx** | Auto-advancing image carousel (pauses on hover) with arrows and dots. |
| **landing/landing-footer.tsx** | Footer with links and translated text. |
| **crop/crop-form.tsx** | The main form. Redirects to login if not signed in, loads farms, validates locally, calls `api.predict()`. Hands the result to the result page via `sessionStorage` (avoids a long URL / second fetch). Shows the N/P/K unit warning above the inputs. |
| **crop/result-view.tsx** | Reads `?id=`, prefers the sessionStorage copy, falls back to fetching by id. Handles login expiry. |
| **crop/prediction-result.tsx** | Displays the recommendation, a confidence bar with **honest band descriptions** (the model's probability ≠ chance of field success), ranked alternatives, the farmer's own inputs, an out-of-range warning, and a disclaimer. |
| **crop/history-list.tsx / history-detail.tsx** | Paginated history list ("load more") and one prediction in full (reuses `PredictionResult`). |
| **farmer/login-form.tsx / register-form.tsx** | Auth forms. Login sends the farmer to their own **preferred language** dashboard; register sends `undefined` for empty optional fields (empty strings would be rejected by backend validation). |
| **farmer/dashboard-view.tsx** | Fetches profile + modules + 3 recent predictions in **one `Promise.all`** (3 sequential trips would be slow on rural connections). Shows location, module cards, recent history. |
| **farmer/profile-view.tsx** | Edit profile (partial update; empty → `null` to actually clear) and add farms (name, area value + unit). |
| **disease/disease-form.tsx** | Photo upload with preview, 10 MB client check, calls `api.diseasePredict`, shows diagnosis + confidence + alternatives. Hides low-confidence results behind a "not recognizable" warning. |
| **weather/weather-view.tsx** | Location priority: profile → farm coordinates → browser GPS → manual entry → address search. Shows current conditions + 7-day forecast, and can save a location as "home" to the profile. |
| **fertilizer/fertilizer-advice.tsx** | ⭐ **Fully client-side, no API.** Uses a simple hardcoded lookup table (base NPK per crop + soil adjustment + stage split) to show a generic fertilizer plan with a disclaimer. |
| **hooks/use-translated-error.ts** | Maps backend error **codes** to translated messages (backend messages are English-only). The code is the contract; the wording is local. |
| **types/api.ts** | TypeScript mirrors of the backend response shapes (envelope, user, prediction, weather, etc.). |
| **locales/en.json, hi.json, mr.json** | All translated strings. Identical key sets, type-checked against English. |
| **app/globals.css, tailwind.config.ts** | Global styles + custom agricultural color palette (soil/leaf/harvest) with WCAG-AA contrast for outdoor sunlight. `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json` are standard build config. |

---

## 5. Root-level & supporting files
| File | What it does |
|---|---|
| **docker-compose.yml** | 3 plain services: `db` (PostgreSQL 16 with health check), `api` (FastAPI, waits for healthy DB), `web` (Next.js). No queue/cache/proxy — deliberately simple for Phase 1. |
| **.env.example** | Template for all settings; documents where future API keys go. `.env` itself is git-ignored. |
| **README.md** | Setup, troubleshooting, architecture decisions, roadmap. |
| **docs/API.md** | Endpoint documentation. **docs/MODEL_CARD.md** — model details + caveats. **docs/DATASET_INSPECTION.md** — dataset analysis (§6 explains why the 0.9955 accuracy is misleading). **docs/PHASE1_PLAN.md** — the original build plan. |
| **data/raw/Crop_recommendation.csv** | 220 rows, 22 crops, 100 each. The training dataset. |
| **scripts/inspect_dataset.py** | Read-only analysis script that reproduces every number in the docs; also trains tiny baseline models just to answer "is this problem separable?" (not the production pipeline). |
| **backend/Dockerfile, frontend/Dockerfile** | Container build instructions. |

---

## 6. Smart engineering decisions to mention in the interview ⭐

These show maturity and are great talking points:

1. **Graceful degradation** — models load at startup; if one is broken the app still boots, `/health` says "degraded", and only that one endpoint returns 503. Login/history keep working.
2. **Feature-order guard** — code order is checked against `metadata.json` at load; a mismatch is a startup failure, because a silent reorder = confident wrong answers with no error.
3. **One source of truth** — validation ranges live in ML `schema.py` and are reused by the API schema, the training script, and metadata. No drift.
4. **Honesty about the data** — 99.55% accuracy is flagged as near-meaningless (synthetic, balanced, no geography/season); N/P/K are unitless ratios, not kg/ha (UI warns farmers explicitly); extrapolation is flagged, not hidden.
5. **Probability-quality gate** — the model was chosen on useful probabilities, not just accuracy (an overconfident model was rejected).
6. **Security details** — bcrypt with 72-byte guard; JWT `type` claim prevents refresh-token replay; constant-time login; SECRET_KEY with no usable default; cross-farmer reads return 404 not 403; CORS never `*`; errors never leak stack traces.
7. **Standard error envelope + request ID** — one response shape everywhere; the ID in the error matches the log line.
8. **Modular monolith** — one API, one DB; a new module = 4 files + 1 router line.
9. **i18n by URL segment** — server-rendered, shareable, no flash of English, and missing translation keys fail the build.
10. **Tests against real PostgreSQL** — not SQLite, because the real schema uses JSONB/UUID/enums.
11. **Mobile-first** — 44–56px touch targets, high-contrast palette for outdoor sunlight, Latin digits.

---

## 7. Quick "cheat sheet" if asked to summarize a feature

- **Crop recommendation:** thin route → schema validation → service maps fields → predictor (`predict_proba`, top 3) → save to `crop_predictions` → response with confidence, alternatives, out-of-range flags.
- **Auth:** register atomically creates user + profile; bcrypt hash; access (60 min) + refresh (30 day) JWTs; client auto-refreshes on 401.
- **Disease detection:** upload photo → MobileNetV2 (160×160, scaled [-1,1]) → top-3 disease labels → returned directly (nothing saved in Phase 2).
- **Weather:** Open-Meteo (no API key), location from profile/farm/GPS/search, conditions returned as language-neutral keys.
- **History:** paginated list of saved predictions, each tagged with model name/version for provenance.
