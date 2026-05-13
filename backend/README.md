# ContractIQ Backend

> **Multi-agent contract intelligence API** built on Google ADK v1.33, Gemini 3.1 Pro, FastAPI, Firebase Firestore, and Google Cloud Storage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent orchestration | Google ADK `1.33.0` — `SequentialAgent` pipeline |
| LLM (extraction & scoring) | `gemini-3.1-pro-preview` — 2M token context |
| LLM (routing & formatting) | `gemini-3-flash-preview` |
| Document ingestion | Gemini Files API |
| API server | FastAPI + Uvicorn |
| Database | Firebase Firestore (named database) |
| File storage | Firebase Cloud Storage (GCS) |
| Auth | Firebase Admin SDK (JWT token verification) |
| Document output | `python-docx` (DOCX redlines) + `reportlab` (PDF summary) |

---

## Project Structure

```
backend/
├── agents/
│   ├── orchestrator.py       # Root SequentialAgent (all 6 sub-agents)
│   ├── ingestion.py          # GCS → Gemini Files API + metadata extraction
│   ├── extractor.py          # 40-clause extraction (Gemini Pro 2M ctx)
│   ├── risk_scorer.py        # Clause risk scoring 0–100 + RiskReport
│   ├── redline.py            # Rewrite suggestions for HIGH/MEDIUM clauses
│   ├── hitl.py               # Human-in-the-loop checkpoint (Firestore polling)
│   └── output_formatter.py   # JSON + DOCX + PDF generation → GCS
├── tools/
│   ├── gcs_tools.py          # GCS upload/download helpers
│   ├── playbook_tools.py     # Built-in + custom playbook loading
│   ├── docx_tools.py         # Word redline + PDF summary generation
│   └── notification_tools.py # Firestore status updates + Slack webhook
├── models/
│   ├── contract.py           # Pydantic models (ClauseBundle, RiskReport, etc.)
│   └── job.py                # Job state machine + enums
├── api/
│   ├── main.py               # FastAPI app factory + CORS
│   ├── deps.py               # Firebase Auth dependency
│   └── routes/
│       ├── upload.py         # POST /v1/upload
│       ├── jobs.py           # POST/GET /v1/jobs
│       ├── contracts.py      # GET /v1/contracts/{id}/clauses|risk|redlines
│       ├── review.py         # POST /v1/contracts/{id}/review + queue
│       ├── export.py         # GET /v1/contracts/{id}/export/json|docx|pdf
│       └── playbooks.py      # GET/POST /v1/playbooks
├── config.py                 # Pydantic Settings (env vars)
├── main.py                   # ADK Runner entrypoint (adk web compatible)
├── Dockerfile                # Cloud Run deployment
├── requirements.txt
└── .env.example
```

---

## Prerequisites

- Python **3.11+**
- A Google Cloud project (`your-project-id`)
- **Gemini API key** from [Google AI Studio](https://aistudio.google.com)
- Firebase service account JSON (download from Firebase Console)
- `pip` or a virtual environment manager

---

## Quick Start

### 1. Clone and create a virtual environment

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
# Copy the example file
copy .env.example .env        # Windows
cp .env.example .env          # macOS/Linux
```

Edit `.env` with your values:

```env
GCP_PROJECT=your-project-id
GEMINI_API_KEY=your-key-from-aistudio.google.com
GEMINI_MODEL_PRO=gemini-3.1-pro-preview
GEMINI_MODEL_FLASH=gemini-3-flash-preview
FIRESTORE_DATABASE=(default)
GCS_RAW_BUCKET=your-project-id.firebasestorage.app
GCS_EXPORT_BUCKET=your-project-id.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
HITL_SLA_HOURS=24
AUTO_APPROVE_THRESHOLD=30
# Optional — leave empty to disable Slack
SLACK_WEBHOOK_URL=
```

### 4. Add Firebase service account

Download your service account JSON from:
**Firebase Console → Project Settings → Service Accounts → Generate new private key**

Save it as `backend/firebase-service-account.json`.

---

## Running Locally

### Option A — FastAPI server (recommended for full integration)

```bash
# From the backend/ directory
uvicorn api.main:app --reload --port 8080
```

- API base URL: `http://localhost:8080/v1`
- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`

### Option B — ADK Web UI (interactive agent testing)

```bash
# From the backend/ directory
adk web
```

- Opens the ADK developer UI at `http://localhost:8000`
- Upload a PDF and watch the full pipeline execute step-by-step
- Useful for debugging individual agent behaviour

### Option C — Run both simultaneously (recommended for development)

```bash
# Terminal 1 — FastAPI
uvicorn api.main:app --reload --port 8080

# Terminal 2 — ADK dev UI
adk web
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/upload` | Upload 1–100 PDFs/DOCXs. Returns `upload_id` |
| `POST` | `/v1/jobs` | Create review job, kick off pipeline |
| `GET` | `/v1/jobs` | List all jobs for current user |
| `GET` | `/v1/jobs/{job_id}` | Get job status + summary |
| `GET` | `/v1/jobs/{job_id}/contracts` | List contracts in a job |
| `GET` | `/v1/contracts/{id}/clauses` | Full ClauseBundle JSON |
| `GET` | `/v1/contracts/{id}/risk` | Full RiskReport JSON |
| `GET` | `/v1/contracts/{id}/redlines` | Redline suggestions |
| `POST` | `/v1/contracts/{id}/review` | Submit HITL decision (APPROVE/OVERRIDE/ESCALATE) |
| `GET` | `/v1/review-queue` | All pending review items across all jobs |
| `GET` | `/v1/contracts/{id}/export/json` | Download JSON export |
| `GET` | `/v1/contracts/{id}/export/docx` | Download Word redlines |
| `GET` | `/v1/contracts/{id}/export/pdf` | Download PDF summary |
| `GET` | `/v1/playbooks` | List available playbooks |
| `POST` | `/v1/playbooks` | Upload custom playbook |

### Example: Upload and start a job

```bash
# 1. Upload contracts
curl -X POST http://localhost:8080/v1/upload \
  -F "files=@contract1.pdf" \
  -F "files=@contract2.pdf"

# Response: { "upload_id": "upl_abc123", "gcs_uris": [...] }

# 2. Create a review job
curl -X POST http://localhost:8080/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "upload_id": "upl_abc123",
    "playbook_id": "nda_standard_2026",
    "reviewer_email": "lawyer@firm.com",
    "sla_hours": 24
  }'

# 3. Poll job status
curl http://localhost:8080/v1/jobs/job_xyz789
```

---

## Agent Pipeline

```
PDF Upload (GCS)
      ↓
Ingestion Agent     → Gemini Files API registration + metadata extraction
      ↓
Extractor Agent     → 40 clause types extracted (Gemini Pro 2M context)
      ↓
Risk Scorer Agent   → Each clause scored 0–100 against playbook
      ↓
Redline Agent       → Rewrites for HIGH/MEDIUM risk clauses only
      ↓
HITL Agent          → Pause + notify reviewer (Firestore polling / Slack)
      ↓              Auto-approve if score ≤ AUTO_APPROVE_THRESHOLD
Output Formatter    → JSON + DOCX redlines + PDF summary → GCS
      ↓
COMPLETE
```

### Job Status Flow

```
QUEUED → INGESTING → EXTRACTING → SCORING → REDLINING
       → PENDING_REVIEW → APPROVED / OVERRIDDEN / ESCALATED
       → FORMATTING → COMPLETE

Error states: FAILED_INGESTION | FAILED_EXTRACTION | FAILED_SCORING | FAILED
```

---

## Built-in Playbooks

| ID | Name | Use for |
|---|---|---|
| `nda_standard_2026` | Standard NDA Playbook | Non-disclosure agreements |
| `msa_standard_2026` | Master Services Agreement | Professional services / SaaS |
| `vendor_compliance_2026` | Vendor Compliance | Supplier / procurement contracts |

Custom playbooks (PDF or DOCX) can be uploaded via `POST /v1/playbooks` and are stored in Firestore + Gemini Files API.

---

## Docker / Cloud Run Deployment

```bash
# Build image
docker build -t contractiq-api .

# Run locally with Docker
docker run -p 8080:8080 \
  -e GEMINI_API_KEY=your-key \
  -e GCP_PROJECT=your-project-id \
  contractiq-api

# Deploy to Cloud Run
gcloud run deploy contractiq-api \
  --image gcr.io/your-project-id/contractiq-api:latest \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 20 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

---

## Cost Estimate

| Contract | Avg tokens | Estimated cost |
|---|---|---|
| Single 20-page contract | ~15K in + 5K out | ~$0.18 |
| Batch of 100 contracts | — | ~$18 |
| 500 contracts/month | — | ~$90 + $200 infra |

Gemini 3.1 Pro: $3.50/M input · $10.50/M output (May 2026)
