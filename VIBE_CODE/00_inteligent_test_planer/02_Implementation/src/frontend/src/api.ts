import type { ApiErrorBody, ConnectionResult, GenerationEvent, Provider, PublicSettings } from './types';

/** Error thrown for any failed API call; `code` maps to a UI error state. */
export class ApiError extends Error {
  code: string;
  details?: ApiErrorBody['details'];
  constructor(body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
    this.details = body.details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the backend server. Make sure it is running.' });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error || { code: 'INTERNAL', message: `Request failed (HTTP ${res.status}).` });
  return body as T;
}

export const api = {
  getSettings: () => request<PublicSettings>('/api/settings'),
  saveSettings: (patch: unknown) => request<PublicSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  testJira: (jira: { url?: string; email?: string; apiToken?: string }) =>
    request<ConnectionResult & { account?: string }>('/api/jira/test-connection', { method: 'POST', body: JSON.stringify({ jira }) }),
  testLlm: (provider: Provider, llm: unknown) =>
    request<ConnectionResult>('/api/llm/test-connection', { method: 'POST', body: JSON.stringify({ provider, llm }) }),
  listModels: (provider: Provider) => request<{ models: string[] }>(`/api/llm/models?provider=${provider}`),

  /** Converts generated Markdown into a Microsoft Word (.docx) Blob via the backend. */
  async exportDocx(markdown: string, key: string): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, key }),
      });
    } catch {
      throw new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the backend server. Make sure it is running.' });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error || { code: 'INTERNAL', message: `Word export failed (HTTP ${res.status}).` });
    }
    return res.blob();
  },

  /** Streams NDJSON progress events from the test-plan endpoint. */
  async generateTestPlan(input: string, onEvent: (e: GenerationEvent) => void): Promise<void> {
    let res: Response;
    try {
      res = await fetch('/api/jira/test-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
    } catch {
      throw new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the backend server. Make sure it is running.' });
    }
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error || { code: 'INTERNAL', message: `Request failed (HTTP ${res.status}).` });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as GenerationEvent;
          if (evt.stage === 'done' || evt.stage === 'error') finished = true;
          onEvent(evt);
        }
      }
    } catch {
      throw new ApiError({ code: 'NETWORK_ERROR', message: 'Connection to the backend was interrupted during generation.' });
    }
    if (!finished) throw new ApiError({ code: 'GENERATION_FAILED', message: 'Generation ended unexpectedly without a result.' });
  },
};
