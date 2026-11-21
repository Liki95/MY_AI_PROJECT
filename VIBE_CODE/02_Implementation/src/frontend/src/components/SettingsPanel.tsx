import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Provider, PublicSettings } from '../types';

interface Props {
  settings: PublicSettings | null;
  loadError: string | null;
  onSettingsChange: (s: PublicSettings) => void;
  onRetry: () => void;
}

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string };

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'ok') return <p className="status status-ok" role="status">✓ {status.message}</p>;
  if (status.kind === 'error') return <p className="status status-error" role="alert">✕ {status.message}</p>;
  return null;
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Unexpected error.');

export default function SettingsPanel({ settings, loadError, onSettingsChange, onRetry }: Props) {
  // Jira form — the API token is write-only: it is never returned by the backend.
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraStatus, setJiraStatus] = useState<Status>({ kind: 'idle' });

  // LLM form
  const [provider, setProvider] = useState<Provider>('groq');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('');
  const [models, setModels] = useState<Record<Provider, string[]>>({ ollama: [], groq: [] });
  const [llmStatus, setLlmStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!settings) return;
    setJiraUrl(settings.jira.url);
    setJiraEmail(settings.jira.email);
    setProvider(settings.llm.provider);
    setOllamaUrl(settings.llm.ollama.baseUrl);
    setOllamaModel(settings.llm.ollama.model);
    setGroqModel(settings.llm.groq.model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings === null]);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    api.listModels(provider)
      .then((r) => !cancelled && setModels((m) => ({ ...m, [provider]: r.models })))
      .catch(() => { /* list is optional; model can still be typed */ });
    return () => { cancelled = true; };
  }, [provider, settings === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function testJira() {
    setJiraStatus({ kind: 'busy' });
    const jira = { url: jiraUrl, email: jiraEmail, ...(jiraToken.trim() ? { apiToken: jiraToken } : {}) };
    try {
      const r = await api.testJira(jira);
      onSettingsChange(await api.saveSettings({ jira })); // persist only after a successful test
      setJiraToken('');
      setJiraStatus({ kind: 'ok', message: r.message });
    } catch (e) {
      setJiraStatus({ kind: 'error', message: errMsg(e) });
    }
  }

  async function selectProvider(p: Provider) {
    if (p === provider) return;
    setProvider(p);
    setLlmStatus({ kind: 'idle' });
    try {
      onSettingsChange(await api.saveSettings({ llm: { provider: p } }));
    } catch (e) {
      setLlmStatus({ kind: 'error', message: errMsg(e) });
    }
  }

  async function validateModel() {
    setLlmStatus({ kind: 'busy' });
    const llm =
      provider === 'ollama'
        ? { provider, ollama: { baseUrl: ollamaUrl, model: ollamaModel } }
        : { provider, groq: { model: groqModel, ...(groqKey.trim() ? { apiKey: groqKey } : {}) } };
    try {
      const r = await api.testLlm(provider, llm);
      if (r.availableModels) setModels((m) => ({ ...m, [provider]: r.availableModels! }));
      onSettingsChange(await api.saveSettings({ llm }));
      setGroqKey('');
      setLlmStatus({ kind: 'ok', message: `${r.message}${r.latencyMs ? ` (${r.latencyMs} ms)` : ''}` });
    } catch (e) {
      const available = e instanceof ApiError ? e.details?.availableModels : undefined;
      if (available?.length) setModels((m) => ({ ...m, [provider]: available }));
      setLlmStatus({ kind: 'error', message: errMsg(e) });
    }
  }

  const disabled = !settings;

  return (
    <section className="panel" aria-labelledby="settings-title">
      <h2 id="settings-title" className="panel-title title-purple">
        <span aria-hidden="true">⚙</span> Settings
      </h2>

      {loadError && (
        <div className="alert alert-error" role="alert">
          <strong>Settings unavailable</strong>
          <span>{loadError}</span>
          <button type="button" className="btn-ghost" onClick={onRetry}>Retry</button>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">JIRA Connection</h3>
        <label className="field">
          <span>URL</span>
          <input type="url" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="https://your-domain.atlassian.net" disabled={disabled} autoComplete="off" />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="name@company.com" disabled={disabled} autoComplete="off" />
        </label>
        <label className="field">
          <span>API Token</span>
          <input
            type="password"
            value={jiraToken}
            onChange={(e) => setJiraToken(e.target.value)}
            placeholder={settings?.jira.apiTokenConfigured ? '•••••••• configured on server' : 'Not configured'}
            disabled={disabled}
            autoComplete="new-password"
          />
        </label>
        <button type="button" className="btn-green" onClick={testJira} disabled={disabled || jiraStatus.kind === 'busy'}>
          {jiraStatus.kind === 'busy' ? 'Testing…' : 'Test Connection'}
        </button>
        <StatusLine status={jiraStatus} />
      </div>

      <div className="card">
        <h3 className="card-title">LLM Provider</h3>
        <div role="radiogroup" aria-label="LLM provider" className="provider-list">
          {(['ollama', 'groq'] as Provider[]).map((p) => (
            <div key={p} className={`provider ${provider === p ? 'selected' : ''}`}>
              <button type="button" role="radio" aria-checked={provider === p} className="provider-option" onClick={() => selectProvider(p)} disabled={disabled}>
                <span className="check" aria-hidden="true">{provider === p ? '✓' : '○'}</span>
                {p === 'ollama' ? 'Ollama Local' : 'Groq API'}
              </button>
              {provider === p && p === 'ollama' && (
                <div className="provider-config">
                  <label className="field compact">
                    <span>Base URL</span>
                    <input type="url" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
                  </label>
                  <label className="field compact">
                    <span>Model</span>
                    <input list="ollama-models" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3.1" />
                    <datalist id="ollama-models">{models.ollama.map((m) => <option key={m} value={m} />)}</datalist>
                  </label>
                </div>
              )}
              {provider === p && p === 'groq' && (
                <div className="provider-config">
                  <label className="field compact">
                    <span>API Key</span>
                    <input
                      type="password"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder={settings?.llm.groq.apiKeyConfigured ? '•••••••• configured on server' : 'Not configured'}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="field compact">
                    <span>Model</span>
                    <input list="groq-models" value={groqModel} onChange={(e) => setGroqModel(e.target.value)} placeholder="openai/gpt-oss-120b" />
                    <datalist id="groq-models">{models.groq.map((m) => <option key={m} value={m} />)}</datalist>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn-indigo" onClick={validateModel} disabled={disabled || llmStatus.kind === 'busy'}>
          {llmStatus.kind === 'busy' ? 'Validating…' : 'Validate Model'}
        </button>
        <StatusLine status={llmStatus} />
      </div>
    </section>
  );
}
