# AI-Powered Jira Test Plan Generator

Enter a Jira issue ID (or paste a story description). The app fetches the issue from Jira (read-only) and has an LLM (Groq or local Ollama) write a test plan that follows the project template exactly (`VIBE_CODE/01_plan/TestPlan_Template.md`), with a source reference on every statement.

```
Enter Jira ID → Retrieve Jira Issue → Generate Test Plan → Display Generated Test Plan
```

## Layout

```
02_Implementation/
├── package.json              # convenience scripts (install:all, build, start, dev:*, test)
├── .gitignore
├── README.md
└── src/
    ├── backend/              # Node.js + Express (ESM; dependencies: express, docx)
    │   ├── server.js         # routes, NDJSON progress stream, static hosting of the built UI
    │   ├── lib/config.js     # .env loading, runtime settings, validation (secrets stay server-side)
    │   ├── lib/jira.js       # READ-ONLY Jira client, ADF → text, issue normalisation
    │   ├── lib/llm.js        # Groq + Ollama clients (deterministic settings)
    │   ├── lib/testPlan.js   # prompt builder, template loader, structure + traceability checks
    │   ├── lib/docxExport.js # Markdown → Microsoft Word (.docx) converter
    │   └── tests/            # node:test unit tests
    └── frontend/             # React 18 + TypeScript + Vite
        └── src/              # App, GeneratorPanel, SettingsPanel, api client, styles
```

## Prerequisites

- Node.js ≥ 20.12 (tested on Node 26). Uses `process.loadEnvFile` and the built-in `fetch`.
- A Jira Cloud account and API token.
- A Groq API key **or** a running Ollama instance.

## Installation

```powershell
cd VIBE_CODE/02_Implementation
npm run install:all      # installs backend + frontend dependencies
npm run build            # builds the React UI into src/frontend/dist
```

> On Windows PowerShell with script execution disabled, call `npm.cmd` instead of `npm`.

## Configuration & environment variables

The backend reads **`VIBE_CODE/.env`**. Change the path with the `ENV_FILE` variable.

| Variable | Required | Purpose |
|---|---|---|
| `JIRA_BASE_URL` | yes | e.g. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | yes | Jira account email |
| `JIRA_TOKEN` (or `JIRA_API_TOKEN`) | yes | Jira API token |
| `GROQ_API_KEY` | for Groq | Groq API key (`gsk_…`) |
| `LLM_PROVIDER` | no | `groq` (default) or `ollama` |
| `GROQ_MODEL` | no | default `openai/gpt-oss-120b` |
| `OLLAMA_BASE_URL` | no | default `http://localhost:11434` |
| `OLLAMA_MODEL` | no | default `llama3.1` |
| `PORT` / `HOST` | no | default `5050` / `127.0.0.1` |
| `PLAN_DIR` | no | template folder, default `VIBE_CODE/01_plan` |

**About `config.md`:** the prompt names `config.md` as the configuration source. That file doesn't exist in this project, so the app uses the `.env` file instead, as the user asked.

**Settings made in the UI** are kept on the server only:
- Secrets (Jira token, Groq key) typed in the UI live **in server memory only**. They are never written to disk, never sent back to the browser, and never saved in browser storage. After a restart the `.env` values apply again.
- Non-secret choices (provider, models, Ollama URL, Jira URL/email) are saved to `src/backend/settings.local.json`, which is git-ignored.

## AI configuration

- **Groq:** OpenAI-compatible `chat/completions` with `temperature: 0`, `top_p: 1`, `seed: 42`. For `gpt-oss` models, reasoning is set to `low` and kept out of the output.
- **Ollama:** `/api/chat` with `temperature: 0`, `top_p: 1`, `seed: 42`, `num_ctx: 16384`.
- **Validate Model** checks that the provider is reachable, that the model is in the provider's model list, and that it answers a 5-token test prompt.

## How to Start the Application

> **Windows PowerShell note:** If `npm` is blocked by execution policy, use `npm.cmd` (shown below) or run `node src/backend/server.js` directly.

### Quick Start (Recommended — Single Server)

If dependencies are already installed and the frontend is built:

```powershell
cd C:\AI\my_AI_project\VIBE_CODE\02_Implementation
node src/backend/server.js
```

*(Alternatively, run `npm.cmd start`.)*

Then open **http://localhost:5050** in your browser.

### First-Time Setup (Fresh Install)

```powershell
cd C:\AI\my_AI_project\VIBE_CODE\02_Implementation
npm.cmd run install:all      # 1. Install backend + frontend dependencies
npm.cmd run build            # 2. Build the React frontend into src/frontend/dist
npm.cmd start                # 3. Start the server → http://localhost:5050
```

### Development Mode (Hot Reload)

Run the backend and Vite dev server in two separate terminals:

```powershell
# Terminal 1 — Backend API (http://localhost:5050)
cd C:\AI\my_AI_project\VIBE_CODE\02_Implementation
npm.cmd run dev:backend

# Terminal 2 — Frontend UI with hot reload (http://localhost:5173, proxies /api → :5050)
cd C:\AI\my_AI_project\VIBE_CODE\02_Implementation
npm.cmd run dev:frontend
```

Open **http://localhost:5173** in your browser.

### Stopping, Restarting & Running Tests

- **Stop the server:** Press `Ctrl + C` in the terminal running the server.
- **After editing `VIBE_CODE/.env`:** Stop and restart the server so the updated environment variables take effect.
- **Run backend tests:**
  ```powershell
  cd C:\AI\my_AI_project\VIBE_CODE\02_Implementation
  npm.cmd test
  ```

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/jira/test-plan` | `{ input }` → NDJSON stream: `retrieving` → `retrieved` → `generating` → `done` \| `error` |
| `POST` | `/api/jira/test-connection` | Test Jira credentials (`GET /rest/api/3/myself`); optional unsaved overrides |
| `POST` | `/api/llm/test-connection` | `{ provider, llm? }` validate provider + model |
| `GET` | `/api/llm/models?provider=` | List available models |
| `POST` | `/api/export/docx` | `{ markdown, key? }` → Microsoft Word (`.docx`) download |
| `GET` / `PUT` | `/api/settings` | Read (secrets shown only as configured/not configured) / update settings |

Every error response has the form `{ error: { code, message } }`. Codes: `INVALID_INPUT`, `MISSING_CONFIG`, `JIRA_AUTH_FAILED`, `JIRA_FORBIDDEN`, `JIRA_NOT_FOUND`, `JIRA_UNAVAILABLE`, `NETWORK_ERROR`, `LLM_UNAVAILABLE`, `LLM_AUTH_FAILED`, `LLM_RATE_LIMITED`, `LLM_MODEL_NOT_FOUND`, `GENERATION_FAILED`.

## Usage

1. Open http://localhost:5050.
2. **Settings → JIRA Connection → Test Connection.** On success, any values you edited are saved.
3. **Settings → LLM Provider:** pick *Ollama Local* or *Groq API*, choose a model, then click **Validate Model**.
4. Enter a Jira key (e.g. `SCRUM-4`) or paste a story description (≥ 20 chars), then click **Generate Test Plan** (or press Ctrl+Enter).
5. Review the plan and any **Review warnings**. Use **Copy**, **Download .md**, or **Download .docx** (Microsoft Word) to export it.

## Generation, traceability and safety

- Data pulled from Jira: key, summary, description (ADF → Markdown), the Acceptance Criteria custom field (if one exists), issue metadata (type, status, priority, project, assignee, reporter, dates, parent, components, versions, environment), labels, comments (latest 20), linked issues, sub-tasks, attachment metadata (file contents are not read), and non-empty custom fields.
- Each source item gets a reference tag such as `[SUMMARY]`, `[DESCRIPTION]`, `[ACCEPTANCE-CRITERIA]`, `[META:priority]`, `[COMMENT-2]`, `[LINK-1]` or `[CF:Story Points]`. The model must cite these tags.
- **Post-generation checks:**
  - The H1 heading is rebuilt from the Jira key and summary.
  - Section names and order are checked against the template.
  - Any cited reference tag that isn't in the source data is flagged as a warning in the UI.
- The rules from `01_plan/RICEPOT_Framework.md` and `Prompt_Engineering/anti-hallucination.rules.md` are built into the prompt, including the exact strings `Insufficient information to determine.` and `Inference (low confidence)`.
- **Prompt-injection protection:** Jira content is wrapped in `<jira_source>` as untrusted data, and any copies of the wrapper tags inside the content are removed.
- **Read-only:** the backend only sends `GET` requests to Jira.
- **No secrets in logs:** logs record only method, path, status and duration. Request bodies and headers are never logged.

## Verification performed (2026-11-21)

| Check | Result |
|---|---|
| Backend unit tests (`npm test`): key validation, ADF conversion, normalisation, injection tag removal, template parsing, post-processing | 7/7 pass |
| Frontend type-check + production build (`tsc --noEmit && vite build`) | pass |
| Backend startup and `.env` loading | pass |
| `GET /api/settings`: secrets returned only as configured/not configured | pass |
| `POST /api/jira/test-connection` against live Jira | pass |
| Live Jira search + retrieval/normalisation of `SCRUM-4` | pass |
| Input validation (`QA-` → `INVALID_INPUT`) | pass |
| Live Groq generation for `SCRUM-4` (`openai/gpt-oss-120b`, about 6.5 s, template structure check passed, 0 warnings) | pass (see limitation 1) |
| Ollama | not verified: no local Ollama instance was reachable |

No mocks are used. Every integration shown in the UI is live.

## Known limitations

1. **Wrong `GROQ_API_KEY` in `VIBE_CODE/.env`.** The value starts with `ygsk_`, but Groq keys start with `gsk_`. Groq rejects it with 401 until the stray leading `y` is removed. The live generation test above ran with the corrected key held in memory only; the `.env` file was not changed. You can also paste the key in **Settings → Groq API → API Key** and click **Validate Model**.
2. Only `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` and `allam-2-7b` are available on this Groq account; `llama-3.3-70b-versatile` is not.
3. LLM output can still vary slightly even with temperature 0 and a fixed seed. The structure and traceability checks flag deviations but don't rewrite content.
4. Long inputs are truncated: description and AC at 15,000 chars, the latest 20 comments at 1,500 chars each. Attachment contents are not analysed.
5. Acceptance criteria are only detected from a custom field named "Acceptance Criteria". Otherwise the model is told to look for criteria in the description.
6. Secrets entered in the UI are lost on server restart (by design).
