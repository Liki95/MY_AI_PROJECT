import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ErrorCodes, toErrorPayload } from './lib/errors.js';
import { initSettings, getSettings, getPublicSettings, updateSettings, withOverrides, requireJiraConfig } from './lib/config.js';
import { normalizeJiraKey, fetchIssue, manualStory, testJiraConnection } from './lib/jira.js';
import { listModels, testLlmConnection, PROVIDERS } from './lib/llm.js';
import { generateTestPlan } from './lib/testPlan.js';
import { markdownToDocxBuffer } from './lib/docxExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = initSettings();
const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST || '127.0.0.1';
const MIN_STORY_LEN = 20;
const MAX_INPUT_LEN = 20000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Security headers + request log (method, path, status, duration — never bodies or headers).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const t = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) console.log(`[api] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - t}ms)`);
  });
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ---------- Settings ---------- */
app.get('/api/settings', (_req, res) => res.json(getPublicSettings()));
app.put('/api/settings', wrap(async (req, res) => res.json(updateSettings(req.body))));

/* ---------- Jira ---------- */
app.post('/api/jira/test-connection', wrap(async (req, res) => {
  res.json(await testJiraConnection(withOverrides({ jira: req.body?.jira })));
}));

/**
 * Main workflow. Streams NDJSON progress events so the UI can show
 * "retrieving" and "generating" states:
 *   {stage:"retrieving"} -> {stage:"retrieved", issue} -> {stage:"generating"} -> {stage:"done", result} | {stage:"error", error}
 * Input validation / configuration errors are returned as a normal JSON error before streaming starts.
 */
app.post('/api/jira/test-plan', wrap(async (req, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
  if (!input) throw new AppError(ErrorCodes.INVALID_INPUT, 'Enter a Jira issue ID (e.g. QA-123) or paste a story description.', 400);
  if (input.length > MAX_INPUT_LEN) throw new AppError(ErrorCodes.INVALID_INPUT, `Input exceeds ${MAX_INPUT_LEN} characters.`, 400);

  const key = normalizeJiraKey(input);
  const looksLikeKey = /^[A-Za-z][A-Za-z0-9_]*-\S*$/.test(input) && !/\s/.test(input);
  if (!key && looksLikeKey) throw new AppError(ErrorCodes.INVALID_INPUT, `"${input.slice(0, 40)}" is not a valid Jira issue ID. Expected format: PROJECT-123.`, 400);
  if (!key && input.length < MIN_STORY_LEN) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Enter a valid Jira issue ID (e.g. QA-123) or paste a story description of at least ${MIN_STORY_LEN} characters.`, 400);
  }

  const settings = getSettings();
  if (key) requireJiraConfig(settings);
  if (!PROVIDERS.includes(settings.provider)) throw new AppError(ErrorCodes.MISSING_CONFIG, 'No LLM provider selected.', 400);
  if (settings.provider === 'groq' && !settings.groqApiKey) {
    throw new AppError(ErrorCodes.MISSING_CONFIG, 'Missing Groq API key (GROQ_API_KEY).', 400, { missing: ['GROQ_API_KEY'] });
  }

  res.status(200).setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');
  const started = Date.now();
  try {
    let issue;
    if (key) {
      send({ stage: 'retrieving', key });
      issue = await fetchIssue(settings, key);
    } else {
      issue = manualStory(input);
    }
    send({ stage: 'retrieved', issue: { key: issue.key, summary: issue.summary, url: issue.url, manual: Boolean(issue.manual), comments: issue.totalComments, linkedIssues: issue.linkedIssues.length, attachments: issue.attachments.length, hasAcceptanceCriteria: Boolean(issue.acceptanceCriteria) } });
    send({ stage: 'generating', provider: settings.provider, model: settings.provider === 'groq' ? settings.groqModel : settings.ollamaModel });
    const plan = await generateTestPlan(issue, settings);
    send({ stage: 'done', result: { ...plan, issue: { key: issue.key, summary: issue.summary, url: issue.url, manual: Boolean(issue.manual) }, generatedAt: new Date().toISOString(), durationMs: Date.now() - started } });
  } catch (err) {
    const { body } = toErrorPayload(err);
    if (!(err instanceof AppError)) console.error('[test-plan] unexpected error:', err?.message);
    send({ stage: 'error', ...body });
  }
  res.end();
}));

/* ---------- LLM ---------- */
app.get('/api/llm/models', wrap(async (req, res) => {
  const provider = String(req.query.provider || '');
  if (!PROVIDERS.includes(provider)) throw new AppError(ErrorCodes.INVALID_INPUT, 'provider must be "ollama" or "groq".', 400);
  res.json({ provider, models: await listModels(provider, getSettings()) });
}));

app.post('/api/llm/test-connection', wrap(async (req, res) => {
  const provider = req.body?.provider || getSettings().provider;
  if (!PROVIDERS.includes(provider)) throw new AppError(ErrorCodes.INVALID_INPUT, 'provider must be "ollama" or "groq".', 400);
  res.json(await testLlmConnection(provider, withOverrides({ llm: req.body?.llm })));
}));

/* ---------- Export ---------- */
app.post('/api/export/docx', wrap(async (req, res) => {
  const markdown = typeof req.body?.markdown === 'string' ? req.body.markdown.trim() : '';
  if (!markdown) throw new AppError(ErrorCodes.INVALID_INPUT, 'Markdown content is required to export a Word document.', 400);
  if (markdown.length > 200000) throw new AppError(ErrorCodes.INVALID_INPUT, 'Markdown content is too large to export.', 400);
  const rawKey = typeof req.body?.key === 'string' ? req.body.key.trim() : 'TestPlan';
  const safeKey = rawKey.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'TestPlan';
  const filename = `TestPlan_${safeKey}.docx`;
  const buffer = await markdownToDocxBuffer(markdown, { title: `Test Plan — ${safeKey}` });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}));

app.use('/api', (_req, _res, next) => next(new AppError('NOT_FOUND', 'API route not found.', 404)));

/* ---------- Static frontend (production build) ---------- */
const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// Error handler — never leaks stack traces or secrets.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') err = new AppError(ErrorCodes.INVALID_INPUT, 'Malformed JSON body.', 400);
  if (!(err instanceof AppError)) console.error('[server] unexpected error:', err?.message);
  const { status, body } = toErrorPayload(err);
  res.status(status).json(body);
});

app.listen(PORT, HOST, () => {
  const s = getPublicSettings();
  console.log(`[server] Jira Test Plan Generator listening on http://localhost:${PORT}`);
  console.log(`[config] .env ${env.loaded ? 'loaded' : 'NOT FOUND'} (${path.relative(process.cwd(), env.file) || env.file})`);
  console.log(`[config] Jira URL: ${s.jira.url || '(missing)'} | email: ${s.jira.email ? 'set' : '(missing)'} | token: ${s.jira.apiTokenConfigured ? 'set' : '(missing)'}`);
  console.log(`[config] LLM provider: ${s.llm.provider} | Groq key: ${s.llm.groq.apiKeyConfigured ? 'set' : '(missing)'} | Ollama: ${s.llm.ollama.baseUrl}`);
  if (!fs.existsSync(DIST)) console.log('[server] Frontend build not found — run "npm run build" or use the Vite dev server.');
});
