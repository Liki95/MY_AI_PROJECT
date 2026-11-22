import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ApiError } from '../api';
import type { PublicSettings, TestStrategyResult } from '../types';
import { LinkIcon, ShieldCheckIcon, SparkleIcon, StrategyDocIcon } from './Icons';

type LoadStep = 'retrieving' | 'analyzing' | 'generating';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; step: LoadStep; message: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'success'; result: TestStrategyResult };

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
  GENERATION_FAILED: 'Test strategy generation failed',
};

const STEP_ORDER: LoadStep[] = ['retrieving', 'analyzing', 'generating'];

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
    if (inFlight.current) return;
    if (!value) {
      setPhase({ kind: 'error', code: 'INVALID_INPUT', message: 'Enter a Jira issue ID (e.g. PROJ-123) or paste requirement details.' });
      return;
    }
    inFlight.current = true;
    setCopied(false);
    setExportError(null);
    setPhase({ kind: 'loading', step: 'retrieving', message: 'Preparing request…' });
    try {
      await api.generateTestStrategy(value, (evt) => {
        if (evt.stage === 'retrieving') {
          setPhase({ kind: 'loading', step: 'retrieving', message: `Retrieving ${evt.key} from Jira…` });
        } else if (evt.stage === 'retrieved') {
          setPhase({
            kind: 'loading',
            step: 'analyzing',
            message: evt.issue.manual
              ? 'Analyzing pasted requirements and risk domains…'
              : `Retrieved ${evt.issue.key}: analyzing requirements, metadata, and risks…`,
          });
        } else if (evt.stage === 'analyzing') {
          const domains = evt.analysis.detectedDomains.length
            ? `Detected coverage areas: ${evt.analysis.detectedDomains.join(', ')}.`
            : 'Completed metadata and risk pre-analysis.';
          setPhase({ kind: 'loading', step: 'analyzing', message: domains });
        } else if (evt.stage === 'generating') {
          setPhase({
            kind: 'loading',
            step: 'generating',
            message: `Generating test strategy with ${evt.provider === 'groq' ? 'Groq' : 'Ollama'} (${evt.model})…`,
          });
        } else if (evt.stage === 'done') {
          setPhase({ kind: 'success', result: evt.result });
        } else if (evt.stage === 'error') {
          setPhase({ kind: 'error', code: evt.error.code, message: evt.error.message });
        }
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

  function downloadMd(result: TestStrategyResult) {
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TestStrategy_${result.issue.key}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function downloadDocx(result: TestStrategyResult) {
    if (exportingDocx) return;
    setExportingDocx(true);
    setExportError(null);
    try {
      const blob = await api.exportDocx(result.markdown, result.issue.key);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TestStrategy_${result.issue.key}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : 'Failed to export Word document.');
    } finally {
      setExportingDocx(false);
    }
  }

  function stepClass(target: LoadStep, current: LoadStep) {
    const tIdx = STEP_ORDER.indexOf(target);
    const cIdx = STEP_ORDER.indexOf(current);
    if (tIdx < cIdx) return 'done';
    if (tIdx === cIdx) return 'active';
    return '';
  }

  return (
    <section className="panel" aria-labelledby="gen-title">
      <h1 id="gen-title" className="panel-title title-gradient">
        <ShieldCheckIcon />
        <span>AI Test Strategy Generator</span>
      </h1>

      <div className={`output-box ${phase.kind === 'success' ? 'has-result' : ''}`} aria-live="polite">
        {phase.kind === 'idle' && (
          <div className="output-placeholder">
            <StrategyDocIcon />
            <h2>Generated Test Strategy Output</h2>
            <p className="hint">Your AI-powered test strategy will appear here.</p>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="output-placeholder">
            <div className="spinner" aria-hidden="true" />
            <ol className="steps">
              <li className={stepClass('retrieving', phase.step)}>Retrieve Jira issue</li>
              <li className={stepClass('analyzing', phase.step)}>Analyze requirements &amp; risks</li>
              <li className={stepClass('generating', phase.step)}>Generate test strategy</li>
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
                  <span className="issue-link">Pasted requirements</span>
                )}
                <span className="muted">
                  {phase.result.provider === 'groq' ? 'Groq' : 'Ollama'} · {phase.result.model} · {(phase.result.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="result-actions">
                <button type="button" className="btn-ghost" onClick={() => copyMarkdown(phase.result.markdown)}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => downloadMd(phase.result)}>
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
        <div className="input-shell">
          <span className="input-icon">
            <LinkIcon size={20} />
          </span>
          <textarea
            className="ticket-input"
            aria-label="Jira issue ID or requirement details"
            placeholder="Enter JIRA Issue ID or Paste Requirement Details..."
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
        </div>

        <button type="submit" className="btn-generate" disabled={busy}>
          <SparkleIcon />
          <span>
            {busy
              ? phase.step === 'retrieving'
                ? 'Retrieving Jira Issue…'
                : phase.step === 'analyzing'
                  ? 'Analyzing Requirements…'
                  : 'Generating Test Strategy…'
              : 'Generate Test Strategy'}
          </span>
        </button>

        {providerLabel && <p className="footnote">Active provider: {providerLabel}</p>}
      </form>
    </section>
  );
}
