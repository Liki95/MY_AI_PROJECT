import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ErrorCodes } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
// Default: VIBE_CODE/.env  (backend lives at VIBE_CODE/02_Implementation/src/backend)
export const ENV_FILE = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.resolve(BACKEND_DIR, '..', '..', '..', '.env');
const LOCAL_SETTINGS_FILE = path.join(BACKEND_DIR, 'settings.local.json');

export const DEFAULTS = Object.freeze({
  provider: 'groq',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  groqModel: 'openai/gpt-oss-120b',
});

let envLoaded = false;
export function loadEnv() {
  if (envLoaded) return { file: ENV_FILE, loaded: true };
  if (fs.existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE); // Node >= 20.12, no dependency needed
    envLoaded = true;
  }
  return { file: ENV_FILE, loaded: envLoaded };
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Runtime settings. Baseline comes from the .env file. Values changed via the
 * Settings UI are held server-side only:
 *  - secrets (Jira token, Groq key) live in memory and are NEVER written to disk or returned to the client
 *  - non-secret choices (provider, models, Ollama URL, Jira URL/email) persist to settings.local.json (git-ignored)
 */
const state = {
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraToken: '',
  groqApiKey: '',
  provider: DEFAULTS.provider,
  ollamaBaseUrl: DEFAULTS.ollamaBaseUrl,
  ollamaModel: DEFAULTS.ollamaModel,
  groqModel: DEFAULTS.groqModel,
};
const PERSISTABLE = ['jiraBaseUrl', 'jiraEmail', 'provider', 'ollamaBaseUrl', 'ollamaModel', 'groqModel'];

export function initSettings() {
  const env = loadEnv();
  state.jiraBaseUrl = normalizeUrl(clean(process.env.JIRA_BASE_URL));
  state.jiraEmail = clean(process.env.JIRA_EMAIL);
  state.jiraToken = clean(process.env.JIRA_TOKEN || process.env.JIRA_API_TOKEN);
  state.groqApiKey = clean(process.env.GROQ_API_KEY);
  if (process.env.OLLAMA_BASE_URL) state.ollamaBaseUrl = normalizeUrl(clean(process.env.OLLAMA_BASE_URL));
  if (process.env.OLLAMA_MODEL) state.ollamaModel = clean(process.env.OLLAMA_MODEL);
  if (process.env.GROQ_MODEL) state.groqModel = clean(process.env.GROQ_MODEL);
  if (process.env.LLM_PROVIDER) state.provider = clean(process.env.LLM_PROVIDER).toLowerCase();

  if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf8'));
      for (const k of PERSISTABLE) if (typeof saved[k] === 'string' && saved[k]) state[k] = saved[k];
    } catch {
      console.warn('[config] settings.local.json is invalid and was ignored.');
    }
  }
  if (!['groq', 'ollama'].includes(state.provider)) state.provider = DEFAULTS.provider;
  return env;
}

export function normalizeUrl(u) {
  return clean(u).replace(/\/+$/, '');
}

function isHttpUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSettings() {
  return { ...state };
}

/** Public view of settings — secrets are reduced to booleans. */
export function getPublicSettings() {
  return {
    envFileLoaded: envLoaded,
    jira: {
      url: state.jiraBaseUrl,
      email: state.jiraEmail,
      apiTokenConfigured: Boolean(state.jiraToken),
    },
    llm: {
      provider: state.provider,
      ollama: { baseUrl: state.ollamaBaseUrl, model: state.ollamaModel },
      groq: { model: state.groqModel, apiKeyConfigured: Boolean(state.groqApiKey) },
    },
  };
}

/** Validate a partial settings patch (same shape as the public view, plus optional secrets). */
export function validatePatch(body = {}) {
  const out = {};
  const errors = [];
  const j = body.jira || {};
  const l = body.llm || {};
  if (j.url !== undefined) {
    const u = normalizeUrl(j.url);
    if (u && !isHttpUrl(u)) errors.push('Jira URL must be a valid http(s) URL.');
    else out.jiraBaseUrl = u;
  }
  if (j.email !== undefined) {
    const e = clean(j.email);
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errors.push('Jira email is not a valid email address.');
    else out.jiraEmail = e;
  }
  if (typeof j.apiToken === 'string' && clean(j.apiToken)) out.jiraToken = clean(j.apiToken);
  if (l.provider !== undefined) {
    if (!['groq', 'ollama'].includes(l.provider)) errors.push('LLM provider must be "ollama" or "groq".');
    else out.provider = l.provider;
  }
  if (l.ollama?.baseUrl !== undefined) {
    const u = normalizeUrl(l.ollama.baseUrl);
    if (!isHttpUrl(u)) errors.push('Ollama base URL must be a valid http(s) URL.');
    else out.ollamaBaseUrl = u;
  }
  if (l.ollama?.model !== undefined && clean(l.ollama.model)) out.ollamaModel = clean(l.ollama.model);
  if (l.groq?.model !== undefined && clean(l.groq.model)) out.groqModel = clean(l.groq.model);
  if (typeof l.groq?.apiKey === 'string' && clean(l.groq.apiKey)) out.groqApiKey = clean(l.groq.apiKey);
  if (errors.length) throw new AppError(ErrorCodes.INVALID_INPUT, errors.join(' '), 400);
  return out;
}

export function updateSettings(body) {
  const patch = validatePatch(body);
  Object.assign(state, patch);
  const toSave = Object.fromEntries(PERSISTABLE.map((k) => [k, state[k]]));
  try {
    fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(toSave, null, 2));
  } catch {
    console.warn('[config] Could not persist settings.local.json (non-secret settings kept in memory).');
  }
  return getPublicSettings();
}

/** Merge request-level overrides (for "test before save") without mutating state. */
export function withOverrides(body) {
  return { ...state, ...validatePatch(body) };
}

export function requireJiraConfig(s = state) {
  const missing = [];
  if (!s.jiraBaseUrl) missing.push('Jira URL (JIRA_BASE_URL)');
  if (!s.jiraEmail) missing.push('Jira Email (JIRA_EMAIL)');
  if (!s.jiraToken) missing.push('Jira API Token (JIRA_TOKEN)');
  if (missing.length) {
    throw new AppError(ErrorCodes.MISSING_CONFIG, `Missing Jira configuration: ${missing.join(', ')}.`, 400, { missing });
  }
}
