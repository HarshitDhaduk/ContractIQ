# ContractIQ

> **Multi-agent AI contract intelligence platform** — processes 100s of legal contracts in minutes using Google ADK, Gemini 3.1 Pro (2M token context), Firebase, and Next.js.

[![Google ADK](https://img.shields.io/badge/Google_ADK-1.33.0-4285F4?style=flat-square)](https://google.github.io/adk-docs/)
[![Gemini](https://img.shields.io/badge/Gemini-3.1_Pro-8B5CF6?style=flat-square)](https://deepmind.google/technologies/gemini/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_+_Firestore-FFA000?style=flat-square)](https://firebase.google.com/)

---

## What is ContractIQ?

Legal teams spend 60–80% of their time on manual contract review. ContractIQ deploys a coordinated team of AI agents that:

1. **Ingest** — Upload 1–100 PDFs/DOCXs at once; Gemini Files API handles OCR for scanned docs
2. **Extract** — Pull 40+ clause types (indemnity, IP, payment terms, termination, governing law…) in one pass using Gemini's 2M token context — no chunking, no retrieval loss
3. **Score** — Each clause rated 0–100 risk against your firm's playbook (HIGH / MEDIUM / LOW)
4. **Redline** — AI-generated rewrites for non-standard clauses, styled like your firm's precedents
5. **Review** — Human-in-the-loop checkpoint: lawyer approves, overrides, or escalates from the dashboard
6. **Export** — Structured JSON, Word redlines (DOCX), and PDF executive summary

---

## Repository Structure

```
ContractIQ/
├── backend/           # Python FastAPI + Google ADK agents
│   ├── agents/        # 6 ADK agents (ingestion → extractor → scorer → redline → HITL → formatter)
│   ├── tools/         # GCS, Firestore, DOCX/PDF, Slack tools
│   ├── models/        # Pydantic models (ClauseBundle, RiskReport, etc.)
│   ├── api/           # FastAPI routes + Firebase Auth
│   ├── main.py        # ADK Runner entrypoint
│   └── README.md      # Backend setup guide
├── frontend/          # Next.js 14 dashboard
│   ├── app/           # App Router pages (upload, jobs, review, playbooks, settings)
│   ├── components/    # Sidebar with live HITL queue badge
│   ├── lib/           # Firebase auth, API client, React Query
│   └── README.md      # Frontend setup guide
├── playbooks/         # Built-in risk playbooks (NDA, MSA, Vendor)
│   ├── nda_standard.json
│   ├── msa_standard.json
│   └── vendor_compliance.json
└── docs/
    └── contractiq_architecture.html
```

---

## Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| gcloud CLI | latest | [cloud.google.com/sdk](https://cloud.google.com/sdk) |

### 1. Authenticate with Google Cloud (replaces service account key)

```bash
# Login with your Google account
gcloud auth login

# Set up Application Default Credentials for local development
gcloud auth application-default login

# Set the project
gcloud config set project contractiq-by-harshit
```

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file and add your Gemini API key
copy .env.example .env

# Edit .env — set GEMINI_API_KEY from https://aistudio.google.com
# Leave FIREBASE_SERVICE_ACCOUNT_PATH as-is (ADC will be used automatically)

# Start FastAPI server
uvicorn api.main:app --reload --port 8080
```

API: `http://localhost:8080` · Docs: `http://localhost:8080/docs`

### 3. Start the Frontend

```bash
cd frontend

npm install        # skip if already done
npm run dev
```

Dashboard: `http://localhost:3000`

---

## Agent Pipeline

```
PDF Batch Upload (Firebase Storage / GCS)
         ↓
  [Orchestrator — SequentialAgent]
         ↓
  Ingestion Agent    → Gemini Files API (48h TTL) + metadata
         ↓
  Extractor Agent    → 40 clause types (Gemini 3.1 Pro · 2M ctx)
         ↓
  Risk Scorer Agent  → Clause scores 0–100 vs playbook
         ↓
  Redline Agent      → Rewrites for HIGH/MEDIUM clauses only
         ↓
  HITL Agent         → Pause · notify reviewer · poll Firestore
         ↓            (auto-approve if score ≤ threshold)
  Output Formatter   → JSON + DOCX + PDF → GCS
         ↓
       COMPLETE
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent framework | Google ADK `1.33.0` |
| LLM (core) | `gemini-3.1-pro-preview` (2M token context) |
| LLM (routing) | `gemini-3-flash-preview` |
| Document storage | Firebase Storage (GCS) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| API server | FastAPI + Uvicorn |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Animations | Framer Motion |
| Hosting | Cloud Run (API) + Vercel (frontend) |

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
GCP_PROJECT=contractiq-by-harshit
GEMINI_API_KEY=<from aistudio.google.com>
GEMINI_MODEL_PRO=gemini-3.1-pro-preview
GEMINI_MODEL_FLASH=gemini-3-flash-preview
FIRESTORE_DATABASE=ai-studio-21482af3-d77d-425a-a006-d24d5f98f2ec
GCS_RAW_BUCKET=contractiq-by-harshit.firebasestorage.app
GCS_EXPORT_BUCKET=contractiq-by-harshit.firebasestorage.app
HITL_SLA_HOURS=24
AUTO_APPROVE_THRESHOLD=30
SLACK_WEBHOOK_URL=          # optional
```

> **No service account JSON needed locally.** Run `gcloud auth application-default login` and the SDK picks up credentials automatically.

---

## Built-in Playbooks

| Playbook ID | Name | For |
|---|---|---|
| `nda_standard_2026` | Standard NDA | Non-disclosure agreements |
| `msa_standard_2026` | Master Services Agreement | Professional services / SaaS |
| `vendor_compliance_2026` | Vendor Compliance | Supplier / procurement |

Upload custom playbooks (PDF/DOCX) directly from the **Playbooks** page in the dashboard.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: describe your change"`
4. Push and open a PR

---

## License

Copyright © 2026 Harshit Dhaduk / ContractIQ

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

