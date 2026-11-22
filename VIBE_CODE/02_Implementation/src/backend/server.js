import fs from 'node:fs';
import path from 'node:path';
import app, { DIST_DIR, env } from './app.js';
import { getPublicSettings } from './lib/config.js';

const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  const s = getPublicSettings();
  console.log(`[server] Jira Test Plan Generator listening on http://localhost:${PORT}`);
  console.log(`[config] .env ${env.loaded ? 'loaded' : 'NOT FOUND'} (${path.relative(process.cwd(), env.file) || env.file})`);
  console.log(`[config] Jira URL: ${s.jira.url || '(missing)'} | email: ${s.jira.email ? 'set' : '(missing)'} | token: ${s.jira.apiTokenConfigured ? 'set' : '(missing)'}`);
  console.log(`[config] LLM provider: ${s.llm.provider} | Groq key: ${s.llm.groq.apiKeyConfigured ? 'set' : '(missing)'} | Ollama: ${s.llm.ollama.baseUrl}`);
  if (!fs.existsSync(DIST_DIR)) console.log('[server] Frontend build not found — run "npm run build" or use the Vite dev server.');
});
