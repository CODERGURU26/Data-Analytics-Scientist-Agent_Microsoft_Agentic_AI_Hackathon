<div align="center">

# 🧠 InsightAI

### Analyze. Reason. Recommend.

**An AI-powered Junior Data Scientist that thinks through your dataset like a human analyst — step by step.**

[![Microsoft Agents League](https://img.shields.io/badge/Microsoft%20Agents%20League-Hackathon%202026-0078D4?style=for-the-badge&logo=microsoft)](https://github.com)
[![Next.js](https://img.shields.io/badge/Next.js%2015-App%20Router-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Azure OpenAI](https://img.shields.io/badge/Azure%20OpenAI-GPT--4o-0078D4?style=for-the-badge&logo=microsoftazure)](https://azure.microsoft.com/en-us/products/ai-services/openai-service)

</div>

---

## What is InsightAI?

Most data tools give you charts. InsightAI gives you **reasoning**.

Upload any CSV dataset and InsightAI's 11-agent pipeline walks through it exactly like a human data scientist would — assessing data quality, generating business insights, detecting the ML problem type, recommending models, explaining *why* those models fit, and producing an executive report with an actionable strategy.

> **Not a dashboard. Not a chart generator. A reasoning engine.**

---

## Demo

```
Upload CSV → 11 agents run in sequence → Results stream live to your browser
```

Each phase appears progressively as agents complete — you watch the AI think in real time.

---

## The 11-Phase Agent Pipeline

| # | Agent | What It Does |
|---|-------|-------------|
| 1 | **Dataset Understanding** | Detects rows, columns, types, and infers potential target columns |
| 2 | **Data Quality Assessment** | Scores dataset health (0–100), flags missing values, outliers, duplicates |
| 3 | **Cleaning Recommendations** | Suggests specific fixes with reasoning — never auto-cleans |
| 4 | **EDA Agent** | Computes distributions, correlations, feature importance; generates charts |
| 5 | **Business Insight Agent** | Translates stats into business findings with concrete recommendations |
| 6 | **ML Problem Detection** | Classifies the task: classification, regression, clustering, forecasting |
| 7 | **Model Recommendation** | Recommends top 3 models with confidence scores and trade-offs |
| 8 | **⭐ Reasoning Agent** | Explains model choice step-by-step using dataset-specific facts |
| 9 | **ML Pipeline Recommendation** | Outputs a full preprocessing + training pipeline with code |
| 10 | **Metrics Recommendation** | Selects the right evaluation metrics and explains which to avoid |
| 11 | **Executive Report** | Aggregates everything into a print-ready summary with action plan |

---

## Tech Stack

**Frontend**
- [Next.js 15](https://nextjs.org) — App Router
- [Tailwind CSS](https://tailwindcss.com) + [Shadcn/UI](https://ui.shadcn.com)
- [Recharts](https://recharts.org) — data visualizations
- [React Query](https://tanstack.com/query) — async state management

**Backend**
- [FastAPI](https://fastapi.tiangolo.com) — Python 3.11+
- [Pandas](https://pandas.pydata.org) + [NumPy](https://numpy.org) — data processing
- [Pydantic v2](https://docs.pydantic.dev) — request/response schemas
- Server-Sent Events (SSE) — real-time phase streaming

**AI Layer**
- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service) — GPT-4o
- Structured JSON output mode per agent
- Role-specific system prompts per agent

---

## Project Structure

```
insightai/
├── backend/
│   ├── agents/
│   │   ├── dataset_understanding.py
│   │   ├── data_quality.py
│   │   ├── eda_agent.py
│   │   ├── business_insight.py
│   │   ├── ml_detection.py
│   │   ├── model_recommendation.py
│   │   ├── reasoning_agent.py
│   │   └── report_agent.py
│   ├── models/
│   │   └── schemas.py
│   ├── utils/
│   │   ├── data_loader.py
│   │   └── llm_client.py
│   └── main.py
│
└── frontend/
    ├── app/
    │   └── page.tsx
    ├── components/
    │   ├── upload/        ← UploadZone.tsx
    │   ├── analysis/      ← PhaseCard.tsx, InsightCard.tsx
    │   ├── charts/        ← DistributionChart.tsx, HeatmapChart.tsx
    │   ├── report/        ← ExecutiveReport.tsx
    │   └── ml/            ← ModelCard.tsx, ReasoningPanel.tsx
    ├── lib/
    │   └── api.ts
    └── hooks/
        └── useAnalysis.ts
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Azure OpenAI resource with a GPT-4o or GPT-4-turbo deployment

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/insightai.git
cd insightai
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your_api_key_here
AZURE_DEPLOYMENT_NAME=gpt-4o
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in `/frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload CSV — returns `file_id` + Phase 1 output |
| `GET` | `/analysis/{file_id}/stream` | SSE stream — emits one JSON event per phase |
| `GET` | `/analysis/{file_id}/report` | Full Phase 11 executive report |

---

## Key Features

**Progressive Phase Rendering**
Phases stream to the frontend via Server-Sent Events as each agent completes. No waiting for the full pipeline.

**Reasoning Panel**
The star feature. Phase 8 renders model reasoning as an animated vertical stepper — each step references specific facts from *your* dataset, not generic advice.

**Model Cards**
Each recommended model renders with a confidence score progress bar, a checkmark list of reasons, and trade-offs highlighted in amber.

**Executive Report**
A print-ready summary card with dataset health score, business insights, recommended model, expected challenges, and a numbered action plan. Exportable via browser print.

**Graceful Degradation**
Every agent failure is caught and returned as a structured error — the rest of the analysis continues running. No full-page crashes.

---

## Design System

- **Dark-first UI** — `#0A0A0A` background, `#F5F5F3` text, `#1A1A1A` card surfaces
- **Accent** — Electric teal `#00D4A8` for progress bars, active states, highlights
- **Typography** — `Geist` for body, `Geist Mono` for stats, scores, and code
- **No spinners** — Shadcn Skeleton loaders throughout
- **Animations** — Slide-up + fade on phase card reveal

---

## Judging Criteria Alignment

| Criterion | Weight | How InsightAI Addresses It |
|-----------|--------|----------------------------|
| Technical Implementation | 25% | FastAPI + Azure OpenAI + SSE streaming pipeline |
| Reasoning & Multi-step Thinking | 20% | 11-agent chain + animated Reasoning Panel (Phase 8) |
| Business Impact | 20% | Phase 5 Business Insight Agent with domain-framed findings |
| Presentation | 20% | Progressive UI, dark mode, Executive Report export |
| Creativity | 15% | Live phase streaming + dataset-specific reasoning steps |

---

## Environment Variables Reference

| Variable | Location | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | `backend/.env` | Your Azure OpenAI resource URL |
| `AZURE_OPENAI_KEY` | `backend/.env` | Azure OpenAI API key |
| `AZURE_DEPLOYMENT_NAME` | `backend/.env` | Deployment name (e.g. `gpt-4o`) |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | FastAPI base URL (default: `http://localhost:8000`) |

---

## Built for Microsoft Agents League Hackathon

InsightAI was designed from the ground up for the **Microsoft Agents League** hackathon. Every architectural decision — the agent chain, the SSE streaming, the reasoning panel — maps directly to the judging criteria.

The tagline **"Analyze. Reason. Recommend."** reflects the exact workflow: Pandas analyzes, Azure OpenAI reasons, and the UI presents recommendations a business stakeholder can act on immediately.

---

<div align="center">


</div>
