# AI-Powered Jira Test Case Generator

Enter a Jira issue ID (or paste requirement details). The application retrieves the Jira issue (read-only), performs requirement pre-analysis, and generates execution-ready **Test Cases** and a **Coverage Matrix** following the exact supplied template (`21_plan/test_case_templet.md`) with full source traceability.

```
Enter Jira ID → Retrieve Jira Issue → Analyze Requirements → Generate Test Cases & Coverage Matrix → Display Test Cases
```

## Layout

```
22_implementation/
├── package.json              # root scripts (install:all, build, start, dev:*, test)
├── .gitignore
├── README.md
└── src/
    ├── backend/              # Node.js + Express (ESM; dependencies: express, docx)
    │   ├── app.js            # Express app, NDJSON progress stream, API routes, static hosting
    │   ├── server.js         # local HTTP server entrypoint (default port 5070)
    │   ├── lib/config.js     # .env loader, server-side settings & validation
    │   ├── lib/jira.js       # READ-ONLY Jira Cloud v3 client (AC, sprint, epic, dependencies, comments, etc.)
    │   ├── lib/llm.js        # Groq API + Ollama Local clients (deterministic settings)
    │   ├── lib/testCases.js  # pre-analysis, test case prompt, template/coverage validation, CSV export
    │   ├── lib/docxExport.js # Markdown → landscape Microsoft Word (.docx) export
    │   ├── templates/        # bundled fallback copy of test_case_templet.md
    │   └── tests/            # node:test unit tests
    └── frontend/             # React 18 + TypeScript + Vite
        └── src/              # App, GeneratorPanel, SettingsPanel, Icons, api client, styles
```

## Prerequisites

- Node.js ≥ 20.12 (uses built-in `process.loadEnvFile` and `fetch`).
- A Jira Cloud account and API token.
- A Groq API key **or** a running local Ollama instance.

## Installation

> **Windows PowerShell note:** If `npm` is blocked by execution policy, use `npm.cmd` (shown below) or run `node src/backend/server.js` directly.

```powershell
cd C:\AI\my_AI_project\VIBE_CODE\02_inteligent_test_case_creatot\22_implementation
npm.cmd run install:all      # Installs backend + frontend dependencies
npm.cmd run build            # Type-checks and builds React UI into src/frontend/dist
```

## Configuration & Environment Variables

The backend automatically resolves **`VIBE_CODE/.env`** (or any path set via `ENV_FILE`).

| Variable | Required | Purpose |
|---|---|---|
| `JIRA_BASE_URL` | yes | Jira Cloud base URL (e.g. `https://your-domain.atlassian.net`) |
| `JIRA_EMAIL` | yes | Jira account email |
| `JIRA_TOKEN` (or `JIRA_API_TOKEN`) | yes | Jira API token |
| `GROQ_API_KEY` | for Groq | Groq API key (`gsk_…`) |
| `LLM_PROVIDER` | no | `groq` (default) or `ollama` |
| `GROQ_MODEL` | no | default `openai/gpt-oss-120b` |
| `OLLAMA_BASE_URL` | no | default `http://localhost:11434` |
| `OLLAMA_MODEL` | no | default `llama3.1` |
| `PORT` / `HOST` | no | default `5070` / `127.0.0.1` |
| `PLAN_DIR` | no | template directory (default `21_plan/`) |

**About `config.md`:** `prompt_TC_creator.md` mentions `config.md` or `.env`; because `config.md` is not present in the workspace, the application loads `VIBE_CODE/.env`.

**Server-side secret handling:**
- Secrets (Jira API token, Groq API key) entered in Settings are stored in **server memory only** — never written to disk, never returned in `GET /api/settings`, never logged, and never stored in browser storage.
- Non-secret preferences persist locally in `src/backend/settings.local.json` (git-ignored).

## How to Start the Application

### Quick Start (Single Server — Recommended)

```powershell
cd C:\AI\my_AI_project\VIBE_CODE\02_inteligent_test_case_creatot\22_implementation
node src/backend/server.js
```

*(Alternatively: `npm.cmd start`.)*

Open **http://localhost:5070** in your browser.

### Development Mode (Hot Reload)

Run in two separate terminals:

```powershell
# Terminal 1 — Backend API (http://localhost:5070)
cd C:\AI\my_AI_project\VIBE_CODE\02_inteligent_test_case_creatot\22_implementation
npm.cmd run dev:backend

# Terminal 2 — Frontend UI (http://localhost:5175, proxies /api → :5070)
cd C:\AI\my_AI_project\VIBE_CODE\02_inteligent_test_case_creatot\22_implementation
npm.cmd run dev:frontend
```

### Stopping & Tests

- Press `Ctrl + C` to stop the server (restart after editing `VIBE_CODE/.env`).
- Run unit tests: `npm.cmd test` (or `node --test src/backend/tests/`).

## Backend API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/jira/test-cases` | `{ input }` → NDJSON stream: `retrieving` → `retrieved` → `analyzing` → `generating` → `done` \| `error` |
| `POST` | `/api/jira/test-connection` | Validate Jira credentials (`GET /rest/api/3/myself`) |
| `POST` | `/api/llm/test-connection` | Validate selected LLM provider and model |
| `GET` | `/api/llm/models?provider=` | List available models for `groq` or `ollama` |
| `POST` | `/api/export/csv` | `{ markdown, key? }` → RFC 4180 CSV export of Section 3 Test Cases (Jira/TestRail/Excel ready) |
| `POST` | `/api/export/docx` | `{ markdown, key? }` → Landscape Microsoft Word (`.docx`) download |
| `GET` / `PUT` | `/api/settings` | Read (secrets masked as booleans) / update settings |
| `GET` | `/api/health` | Health check |

## Usage Guide

1. Open **http://localhost:5070**.
2. In **Settings → JIRA Connection**, verify URL/Email and click **Test Connection**.
3. In **Settings → LLM Provider**, pick **Ollama Local** or **Groq API**, confirm the model, and click **Validate Model**.
4. Enter a Jira Issue ID (e.g. `SCRUM-4`) or paste requirement details (≥ 20 chars), then click **Generate Test Cases** (or press `Ctrl + Enter`).
5. Review the generated Test Cases, Coverage Matrix, and Human Review Gate. Export with **Copy**, **Download .md**, **Download .csv**, or **Download .docx**.

## Governance, Traceability & Safety

- **Read-only Jira integration:** Only HTTP `GET` requests are issued. Extracts key, summary, description (ADF → Markdown), Acceptance Criteria, priority, components, labels, sprint details, epic info, linked issues & dependencies, subtasks, attachment metadata (not contents), comments (latest 20), and custom fields.
- **Documented vs. Proposed vs. Assumptions:** Every test case is tagged `Documented` or `Proposed`, maps to source tags (`[SUMMARY]`, `[DESCRIPTION]`, `[ACCEPTANCE-CRITERIA]`, `[COMMENT-1]`, etc.) or numbered Gaps, and uses `"Insufficient information to determine."` / `"Inference (low confidence)"` where appropriate.
- **Post-generation checks:** Verifies all 7 exact template sections from `21_plan/test_case_templet.md`, verifies Test Case IDs (`<KEY>-TC-001`…), verifies Section 5 Coverage Matrix rows, and flags ungrounded source tags.
- **Prompt-injection protection:** Jira content is wrapped as untrusted source data (`<jira_source>`) with embedded closing tags neutralized.

## Verification Results (2026-11-22)

| Check | Result |
|---|---|
| Backend unit tests (`node --test tests/`): key validation, ADF conversion, sprint/epic/dependency extraction, pre-analysis, tag sanitization, 7-section template order, post-processing, CSV export, landscape `.docx` export | **10/10 pass** |
| Frontend type-check + production build (`tsc --noEmit && vite build`) | **pass** |
| Backend startup and `VIBE_CODE/.env` loading on `http://localhost:5070` | **pass** |
| `GET /` and `GET /api/health` | **200 OK** |
| `GET /api/settings` (secrets masked as booleans) | **200 OK** |
| Invalid Jira key (`PROJ-` → `INVALID_INPUT`) | **400 OK** |
| `POST /api/jira/test-connection` against live Jira Cloud | **200 OK** |
| `POST /api/llm/test-connection` against live Groq (`openai/gpt-oss-120b`, 252 ms) | **200 OK** |
| End-to-end `POST /api/jira/test-cases` (`SCRUM-4`): `retrieving → retrieved → analyzing → generating → done` (7.0 s, 10 test cases, 7/7 exact sections, Coverage Matrix verified, 10,911 chars, `0` warnings) | **pass** |
| `POST /api/export/csv` on live generated test cases (11 CSV rows: header + 10 test cases, 3,907 bytes) | **200 OK** |
| `POST /api/export/docx` on live generated test cases (18,228 bytes, valid landscape `PK` OOXML archive) | **200 OK** |
| Ollama Local | Not verified (no local Ollama instance running; full client + Settings UI implemented) |

No mocks were used; all live integrations shown in the UI were verified end-to-end.

## Known Limitations

1. **Ollama Local** requires a running local Ollama instance at the configured Base URL (`http://localhost:11434` by default); it was not verified live in this environment because no Ollama daemon is installed/running.
2. Minor output variation can still occur across LLM runs despite `temperature: 0`, `top_p: 1`, and fixed `seed: 42`.
3. Very long Jira descriptions (>16,000 chars) and comments (>20 comments or >1,500 chars each) are truncated; attachment contents are not downloaded or parsed (metadata only).
4. Secrets entered via Settings live in server memory only and reset to `.env` values on server restart.
