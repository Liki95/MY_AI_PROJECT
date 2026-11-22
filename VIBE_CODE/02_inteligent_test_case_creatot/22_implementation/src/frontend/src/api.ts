import type { ApiErrorBody, ConnectionResult, GenerationEvent, Provider, PublicSettings } from './types';

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

async function exportBlob(path: string, markdown: string, key: string, label: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, key }),
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the backend server. Make sure it is running.' });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error || { code: 'INTERNAL', message: `${label} export failed (HTTP ${res.status}).` });
  }
  return res.blob();
}

export const api = {
  getSettings: () => request<PublicSettings>('/api/settings'),
  saveSettings: (patch: unknown) => request<PublicSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  testJira: (jira: { url?: string; email?: string; apiToken?: string }) =>
    request<ConnectionResult & { account?: string }>('/api/jira/test-connection', { method: 'POST', body: JSON.stringify({ jira }) }),
  testLlm: (provider: Provider, llm: unknown) =>
    request<ConnectionResult>('/api/llm/test-connection', { method: 'POST', body: JSON.stringify({ provider, llm }) }),
  listModels: (provider: Provider) => request<{ models: string[] }>(`/api/llm/models?provider=${provider}`),
  exportDocx: (markdown: string, key: string) => exportBlob('/api/export/docx', markdown, key, 'Word'),
  exportCsv: (markdown: string, key: string) => exportBlob('/api/export/csv', markdown, key, 'CSV'),

  /** Streams NDJSON progress events from the test-cases endpoint. */
  async generateTestCases(input: string, onEvent: (e: GenerationEvent) => void): Promise<void> {
    let res: Response;
    try {
      res = await fetch('/api/jira/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
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
