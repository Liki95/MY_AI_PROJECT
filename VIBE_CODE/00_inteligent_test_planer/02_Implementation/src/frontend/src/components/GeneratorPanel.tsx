import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ApiError } from '../api';
import type { PublicSettings, TestPlanResult } from '../types';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; step: 'retrieving' | 'generating'; message: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'success'; result: TestPlanResult };

const ERROR_TITLES: Record<string, string> = {
  INVALID_INPUT: 'Invalid input',
  MISSING_CONFIG: 'Missing configuration',
  JIRA_AUTH_FAILED: 'Jira authentication failed',
  JIRA_FORBIDDEN: 'Jira authorization failed',
  JIRA_NOT_FOUND: 'Jira issue not found',
  JIRA_UNAVAILABLE: 'Jira unavailable',
  NETWORK_ERROR: 'Network failure',
  LLM_UNAVAILABLE: 'AI provider unavailable',
  LLM_AUTH_FAILED: 'AI provider authentication failed',
  LLM_RATE_LIMITED: 'AI provider rate limited',
  LLM_MODEL_NOT_FOUND: 'AI model not available',
  GENERATION_FAILED: 'Test plan generation failed',
};

export default function GeneratorPanel({ settings }: { settings: PublicSettings | null }) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const busy = phase.kind === 'loading';
  const inFlight = useRef(false);

  const providerLabel = settings
    ? settings.llm.provider === 'groq'
      ? `Groq · ${settings.llm.groq.model}`
      : `Ollama · ${settings.llm.ollama.model}`
    : '';

  async function submit() {
    const value = input.trim();
    if (inFlight.current) return; // prevent duplicate submissions
    if (!value) {
      setPhase({ kind: 'error', code: 'INVALID_INPUT', message: 'Enter a Jira issue ID (e.g. QA-123) or paste a story description.' });
      return;
    }
    inFlight.current = true;
    setCopied(false);
    setExportError(null);
    setPhase({ kind: 'loading', step: 'retrieving', message: 'Preparing request…' });
    try {
      await api.generateTestPlan(value, (evt) => {
        if (evt.stage === 'retrieving') setPhase({ kind: 'loading', step: 'retrieving', message: `Retrieving ${evt.key} from Jira…` });
        else if (evt.stage === 'retrieved')
          setPhase({ kind: 'loading', step: 'retrieving', message: evt.issue.manual ? 'Using pasted story description…' : `Retrieved ${evt.issue.key}: ${evt.issue.summary}` });
        else if (evt.stage === 'generating')
          setPhase({ kind: 'loading', step: 'generating', message: `Generating test plan with ${evt.provider === 'groq' ? 'Groq' : 'Ollama'} (${evt.model})…` });
        else if (evt.stage === 'done') setPhase({ kind: 'success', result: evt.result });
        else if (evt.stage === 'error') setPhase({ kind: 'error', code: evt.error.code, message: evt.error.message });
      });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError({ code: 'INTERNAL', message: 'Unexpected error.' });
      setPhase({ kind: 'error', code: err.code, message: err.message });
    } finally {
      inFlight.current = false;
    }
  }

  async function copyMarkdown(md: string) {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  function download(result: TestPlanResult) {
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TestPlan_${result.issue.key}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function downloadDocx(result: TestPlanResult) {
    if (exportingDocx) return;
    setExportingDocx(true);
    setExportError(null);
    try {
      const blob = await api.exportDocx(result.markdown, result.issue.key);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TestPlan_${result.issue.key}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : 'Failed to export Word document.');
    } finally {
      setExportingDocx(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="gen-title">
      <h1 id="gen-title" className="panel-title title-blue">
        <span aria-hidden="true">🤖</span> AI Test Plan Generator
      </h1>

      <div className={`output-box ${phase.kind === 'success' ? 'has-result' : ''}`} aria-live="polite">
        {phase.kind === 'idle' && (
          <div className="output-placeholder">
            <h2>Generated Test Plan Output</h2>
            <p className="hint">Enter a Jira ticket ID (e.g. QA-123) or paste a story description below.</p>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="output-placeholder">
            <div className="spinner" aria-hidden="true" />
            <ol className="steps">
              <li className={phase.step === 'retrieving' ? 'active' : 'done'}>Retrieve Jira issue</li>
              <li className={phase.step === 'generating' ? 'active' : ''}>Generate test plan</li>
            </ol>
            <p className="hint">{phase.message}</p>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="output-placeholder">
            <div className="alert alert-error" role="alert">
              <strong>{ERROR_TITLES[phase.code] || 'Error'}</strong>
              <span>{phase.message}</span>
            </div>
          </div>
        )}

        {phase.kind === 'success' && (
          <div className="result">
            <div className="result-bar">
              <div className="result-meta">
                <span className="badge badge-ok">✓ Generated</span>
                {phase.result.issue.url ? (
                  <a href={phase.result.issue.url} target="_blank" rel="noreferrer noopener" className="issue-link">
                    {phase.result.issue.key}
                  </a>
                ) : (
                  <span className="issue-link">Pasted story</span>
                )}
                <span className="muted">
                  {phase.result.provider === 'groq' ? 'Groq' : 'Ollama'} · {phase.result.model} · {(phase.result.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="result-actions">
                <button type="button" className="btn-ghost" onClick={() => copyMarkdown(phase.result.markdown)}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => download(phase.result)}>
                  Download .md
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void downloadDocx(phase.result)}
                  disabled={exportingDocx}
                >
                  {exportingDocx ? 'Exporting…' : 'Download .docx'}
                </button>
              </div>
            </div>
            {exportError && (
              <div className="alert alert-error alert-inline" role="alert">
                <strong>Word export failed</strong>
                <span>{exportError}</span>
              </div>
            )}
            {phase.result.warnings.length > 0 && (
              <div className="alert alert-warn">
                <strong>Review warnings</strong>
                <ul>
                  {phase.result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <article className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{phase.result.markdown}</ReactMarkdown>
            </article>
          </div>
        )}
      </div>

      <form
        className="generator-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          className="ticket-input"
          aria-label="Jira ticket ID or story description"
          placeholder="Enter JIRA Ticket ID or Paste Story Description..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
          rows={2}
          maxLength={20000}
        />
        <button type="submit" className="btn-generate" disabled={busy}>
          {busy ? (phase.step === 'retrieving' ? 'Retrieving Jira Issue…' : 'Generating Test Plan…') : 'Generate Test Plan'}
        </button>
        {providerLabel && <p className="footnote">Using {providerLabel}</p>}
      </form>
    </section>
  );
}
