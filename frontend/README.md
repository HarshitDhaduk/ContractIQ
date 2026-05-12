# ContractIQ Frontend

> **Next.js 14 dashboard** for the ContractIQ multi-agent contract intelligence platform. Includes Google Auth, drag-and-drop batch upload, real-time job tracking, risk heatmap, HITL review UI, and export downloads.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Auth (Google Sign-In) |
| Data fetching | TanStack React Query (with live polling) |
| Animations | Framer Motion |
| File upload | react-dropzone |
| Icons | Lucide React |

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                        # Root layout (AuthProvider + QueryProvider)
│   ├── globals.css                       # Dark theme, glassmorphism, risk colors
│   ├── page.tsx                          # Landing / Google Sign-In page
│   └── dashboard/
│       ├── layout.tsx                    # Auth guard + Sidebar
│       ├── page.tsx                      # Dashboard overview (stats + recent jobs)
│       ├── upload/
│       │   └── page.tsx                  # Drag-and-drop batch upload (3-step flow)
│       ├── jobs/
│       │   ├── page.tsx                  # Job list with live status polling
│       │   └── [jobId]/
│       │       └── page.tsx              # Job detail + batch risk meter
│       ├── contracts/
│       │   └── [contractId]/
│       │       └── page.tsx              # HITL review: risk heatmap + redlines + decision
│       ├── playbooks/
│       │   └── page.tsx                  # Playbook list + custom upload
│       └── settings/
│           └── page.tsx                  # HITL threshold, SLA, Slack webhook
├── components/
│   └── Sidebar.tsx                       # Navigation + live HITL queue badge
├── lib/
│   ├── firebase.ts                       # Firebase app initialisation
│   ├── auth-context.tsx                  # Auth context (user, idToken, login, logout)
│   ├── api.ts                            # Typed API client for all backend endpoints
│   └── query-provider.tsx               # TanStack React Query client
├── .env.local                            # NEXT_PUBLIC_API_URL
└── package.json
```

---

## Prerequisites

- **Node.js 18+** (check with `node -v`)
- **npm 9+** (check with `npm -v`)
- ContractIQ backend running at `http://localhost:8080`

---

## Quick Start

### 1. Install dependencies

```bash
# From the frontend/ directory
npm install
```

### 2. Configure environment

The `.env.local` file is already created and points to the local backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/v1
```

Change this if your backend runs on a different port or in the cloud.

### 3. Start the development server

```bash
npm run dev
```

App runs at **`http://localhost:3000`**

---

## All Available Commands

```bash
# Start development server (hot reload)
npm run dev

# Build for production (checks for TypeScript errors)
npm run build

# Start production server (after build)
npm run start

# Type-check only (no build output)
npx tsc --noEmit
```

---

## Pages & Features

### `/` — Landing Page
- Full-screen hero with animated gradient background
- Feature showcase (2M context, 40 clauses, risk playbook)
- **Google Sign-In** button — redirects to `/dashboard` on success

### `/dashboard` — Overview
- Stats cards: total jobs, awaiting review, complete
- Recent jobs list with status badges
- Quick-action buttons (New Upload, View Jobs)
- Live polling every 5 seconds

### `/dashboard/upload` — Batch Upload
3-step wizard:
1. **Drop zone** — drag & drop up to 100 PDFs or DOCXs
2. **Configure** — select playbook, enter reviewer email, optional Slack webhook
3. **Submit** — creates the job and redirects to live tracking

### `/dashboard/jobs` — Job List
- Live-polling list with status badges and progress bars
- Status flow: `QUEUED → INGESTING → EXTRACTING → SCORING → PENDING_REVIEW → COMPLETE`
- Click any job to drill into contract detail

### `/dashboard/jobs/[jobId]` — Job Detail
- Batch-level risk score gauge
- List of all contracts in the job with individual risk scores and critical flags
- Contracts with `PENDING_REVIEW` status show an orange alert

### `/dashboard/contracts/[contractId]` — Contract Review ⭐
The core HITL interface:
- **Risk score header** with executive summary
- **3 tabs:**
  - **Risk Heatmap** — 5×8 grid of all 40 clause types colour-coded RED/AMBER/GREEN; click any cell to see clause details
  - **Clauses** — expandable list of all extracted clauses with original text, deviation notes, and page references
  - **Redlines** — side-by-side diff view (original in red / proposed in green) with rationale
- **HITL Decision panel** (right sidebar):
  - `APPROVE` / `OVERRIDE` / `ESCALATE` buttons
  - Notes text field
  - Submit decision → unblocks the agent pipeline
- **Downloads panel** — links to JSON, Word redlines, PDF summary

### `/dashboard/playbooks` — Playbooks
- Lists all built-in playbooks (NDA, MSA, Vendor Compliance)
- Upload a custom PDF/DOCX playbook with name, type, and description
- Custom playbooks are registered with Gemini Files API as grounding sources

### `/dashboard/settings` — Settings
- **Auto-Approve Threshold** slider (default 30) — contracts scoring below this are approved automatically
- **SLA Hours** — time before auto-escalation (default 24h)
- **Slack Webhook URL** — optional; high-risk contracts ping this channel

---

## Sidebar — Live HITL Queue Badge

The sidebar polls `/v1/review-queue` every 15 seconds. When any jobs are in `PENDING_REVIEW` state, an animated orange badge appears:

```
● 3 awaiting review
```

This gives reviewers a persistent, real-time alert without leaving the dashboard.

---

## Firebase Auth

Authentication is handled with Firebase Google Sign-In:

```typescript
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

await signInWithPopup(auth, googleProvider);
```

The `useAuth()` hook provides:
- `user` — Firebase `User` object (or `null`)
- `idToken` — JWT token, refreshed automatically, passed to all API calls
- `signInWithGoogle()` — trigger Google popup
- `logout()` — sign out

All dashboard routes are protected by an auth guard in `app/dashboard/layout.tsx`.

---

## Production Build

```bash
npm run build
```

Expected output:
```
Route (app)
┌ ○ /
├ ○ /dashboard
├ ○ /dashboard/jobs
├ ƒ /dashboard/jobs/[jobId]
├ ƒ /dashboard/contracts/[contractId]
├ ○ /dashboard/playbooks
├ ○ /dashboard/settings
└ ○ /dashboard/upload
```

All static routes pre-rendered; dynamic routes (`[jobId]`, `[contractId]`) are server-rendered on demand.

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://your-cloud-run-api-url/v1
```

Or use the Vercel GitHub integration for automatic deploys on push.
