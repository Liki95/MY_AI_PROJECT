import { AppError, ErrorCodes, fetchWithTimeout } from './errors.js';

/**
 * LLM providers supported by the project: Ollama (local) and Groq (cloud).
 * Deterministic settings are applied wherever the provider supports them
 * (temperature 0, fixed seed, top_p 1).
 */
export const PROVIDERS = ['ollama', 'groq'];
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const SEED = 42;

function requireProviderConfig(provider, s) {
  if (!PROVIDERS.includes(provider)) throw new AppError(ErrorCodes.INVALID_INPUT, `Unsupported LLM provider "${provider}".`, 400);
  if (provider === 'groq' && !s.groqApiKey) {
    throw new AppError(ErrorCodes.MISSING_CONFIG, 'Missing Groq API key (GROQ_API_KEY).', 400, { missing: ['GROQ_API_KEY'] });
  }
  if (provider === 'ollama' && !s.ollamaBaseUrl) {
    throw new AppError(ErrorCodes.MISSING_CONFIG, 'Missing Ollama base URL.', 400, { missing: ['OLLAMA_BASE_URL'] });
  }
}

async function readError(res) {
  try {
    const b = await res.json();
    return String(b?.error?.message || b?.error || '').slice(0, 300);
  } catch {
    return '';
  }
}

function mapHttpError(provider, status, detail) {
  const label = provider === 'groq' ? 'Groq' : 'Ollama';
  if (status === 401 || status === 403) return new AppError(ErrorCodes.LLM_AUTH_FAILED, `${label} rejected the API key. Verify the key in Settings / .env.`, 401);
  if (status === 404) return new AppError(ErrorCodes.LLM_MODEL_NOT_FOUND, `${label} model not found. ${detail}`.trim(), 404);
  if (status === 429) return new AppError(ErrorCodes.LLM_RATE_LIMITED, `${label} rate limit reached. ${detail}`.trim(), 429);
  if (status === 413) return new AppError(ErrorCodes.GENERATION_FAILED, `${label}: request too large for the selected model. ${detail}`.trim(), 413);
  if (status >= 500) return new AppError(ErrorCodes.LLM_UNAVAILABLE, `${label} is unavailable (HTTP ${status}).`, 502);
  return new AppError(ErrorCodes.GENERATION_FAILED, `${label} request failed (HTTP ${status}). ${detail}`.trim(), 502);
}

export async function listModels(provider, s) {
  requireProviderConfig(provider, s);
  if (provider === 'groq') {
    const res = await fetchWithTimeout(`${GROQ_BASE}/models`, { headers: { Authorization: `Bearer ${s.groqApiKey}` } },
      { timeoutMs: 15000, unreachableCode: ErrorCodes.LLM_UNAVAILABLE, label: 'Groq API' });
    if (!res.ok) throw mapHttpError('groq', res.status, await readError(res));
    const body = await res.json();
    return (body.data || [])
      .filter((m) => m.active !== false && !/whisper|tts|guard|orpheus|playai/i.test(m.id))
      .map((m) => m.id)
      .sort();
  }
  const res = await fetchWithTimeout(`${s.ollamaBaseUrl}/api/tags`, {},
    { timeoutMs: 8000, unreachableCode: ErrorCodes.LLM_UNAVAILABLE, label: 'Ollama' });
  if (!res.ok) throw mapHttpError('ollama', res.status, await readError(res));
  const body = await res.json();
  return (body.models || []).map((m) => m.name).sort();
}

/** Validate connectivity AND that the selected model can actually answer. */
export async function testLlmConnection(provider, s) {
  const model = provider === 'groq' ? s.groqModel : s.ollamaModel;
  const models = await listModels(provider, s);
  const present = models.includes(model) || (provider === 'ollama' && models.includes(`${model}:latest`));
  if (!present) {
    throw new AppError(ErrorCodes.LLM_MODEL_NOT_FOUND,
      `Connected to ${provider === 'groq' ? 'Groq' : 'Ollama'}, but model "${model}" is not available.`, 404, { availableModels: models.slice(0, 50) });
  }
  const started = Date.now();
  const reply = await chat(provider, s, [{ role: 'user', content: 'Reply with the single word: OK' }], { maxTokens: 5, timeoutMs: 60000 });
  return {
    ok: true,
    provider,
    model,
    latencyMs: Date.now() - started,
    message: `${provider === 'groq' ? 'Groq API' : 'Ollama Local'} responded using model "${model}".`,
    sample: reply.content.trim().slice(0, 20),
    availableModels: models,
  };
}

export async function chat(provider, s, messages, { maxTokens = 4096, timeoutMs = 180000 } = {}) {
  requireProviderConfig(provider, s);
  if (provider === 'groq') {
    const res = await fetchWithTimeout(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: s.groqModel, messages, temperature: 0, top_p: 1, seed: SEED, max_tokens: maxTokens, stream: false,
        // Reasoning models (gpt-oss): keep reasoning separate from content and bounded so it does not consume the output budget.
        ...(/gpt-oss/i.test(s.groqModel) ? { reasoning_effort: 'low', include_reasoning: false } : {}),
        ...(/qwen3/i.test(s.groqModel) ? { reasoning_format: 'hidden' } : {}),
      }),
    }, { timeoutMs, unreachableCode: ErrorCodes.LLM_UNAVAILABLE, label: 'Groq API' });
    if (!res.ok) throw mapHttpError('groq', res.status, await readError(res));
    const body = await res.json();
    return { content: body.choices?.[0]?.message?.content || '', model: s.groqModel, finishReason: body.choices?.[0]?.finish_reason, usage: body.usage || null };
  }
  const res = await fetchWithTimeout(`${s.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.ollamaModel, messages, stream: false, options: { temperature: 0, top_p: 1, seed: SEED, num_predict: maxTokens, num_ctx: 16384 } }),
  }, { timeoutMs, unreachableCode: ErrorCodes.LLM_UNAVAILABLE, label: 'Ollama' });
  if (!res.ok) throw mapHttpError('ollama', res.status, await readError(res));
  const body = await res.json();
  return { content: body.message?.content || '', model: s.ollamaModel, finishReason: body.done_reason || null, usage: null };
}
