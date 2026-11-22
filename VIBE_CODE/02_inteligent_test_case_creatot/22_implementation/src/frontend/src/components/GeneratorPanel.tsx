import { Children, Fragment, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ApiError } from '../api';
import type { PublicSettings, TestCasesResult } from '../types';
import { CheckSquareBadgeIcon, ChecklistDocIcon, JiraMarkIcon, SparkleIcon } from './Icons';

type LoadStep = 'retrieving' | 'analyzing' | 'generating';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; step: LoadStep; message: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'success'; result: TestCasesResult };

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
  GENERATION_FAILED: 'Test case generation failed',
};

const STEP_ORDER: LoadStep[] = ['retrieving', 'analyzing', 'generating'];

/** Safely render <br> markers inside GFM table cells (multi-line steps) without raw HTML injection. */
function renderCellBreaks(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== 'string' || !/<br\s*\/?>/i.test(child)) return child;
    const parts = child.split(/<br\s*\/?>/gi);
    return parts.map((p, idx) => (
      <Fragment key={idx}>
        {idx > 0 && <br />}
        {p}
      </Fragment>
    ));
  });
}

export default function GeneratorPanel({ settings }: { settings: PublicSettings | null }) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'docx' | 'csv' | null>(null);
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
      await api.generateTestCases(value, (evt) => {
        if (evt.stage === 'retrieving') {
          setPhase({ kind: 'loading', step: 'retrieving', message: `Retrieving ${evt.key} from Jira…` });
        } else if (evt.stage === 'retrieved') {
          setPhase({
            kind: 'loading',
            step: 'analyzing',
            message: evt.issue.manual
              ? 'Analyzing pasted requirements and acceptance criteria…'
              : `Retrieved ${evt.issue.key}: analyzing requirements and acceptance criteria…`,
          });
        } else if (evt.stage === 'analyzing') {
          const areas = evt.analysis.detectedAreas.length
            ? `Coverage areas identified: ${evt.analysis.detectedAreas.join(', ')}.`
            : 'Completed requirement pre-analysis.';
          setPhase({ kind: 'loading', step: 'analyzing', message: areas });
        } else if (evt.stage === 'generating') {
          setPhase({
            kind: 'loading',
            step: 'generating',
            message: `Generating test cases & coverage matrix with ${evt.provider === 'groq' ? 'Groq' : 'Ollama'} (${evt.model})…`,
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

  function triggerDownload(blob: Blob, filename: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadMd(result: TestCasesResult) {
    triggerDownload(new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' }), `TestCases_${result.issue.key}.md`);
  }

  async function downloadServerExport(result: TestCasesResult, format: 'docx' | 'csv') {
    if (exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const blob =
        format === 'docx'
          ? await api.exportDocx(result.markdown, result.issue.key)
          : await api.exportCsv(result.markdown, result.issue.key);
      triggerDownload(blob, `TestCases_${result.issue.key}.${format}`);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : `Failed to export .${format} file.`);
    } finally {
      setExporting(null);
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
      <div className="panel-header-row">
        <h1 id="gen-title" className="panel-title title-gradient">
          <CheckSquareBadgeIcon />
          <span>AI Test Case Generator</span>
        </h1>
        <span className="header-pill">
          Turn Jira stories
          <br />
          into test cases
        </span>
      </div>

      <div className={`output-box ${phase.kind === 'success' ? 'has-result' : ''}`} aria-live="polite">
        {phase.kind === 'idle' && (
          <div className="output-placeholder">
            <ChecklistDocIcon />
            <h2>
              Generated Test Cases
              <br />
              Output
            </h2>
            <p className="hint">
              Enter a JIRA issue ID to generate detailed test cases
              <br />
              with traceability, coverage and clear steps.
            </p>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="output-placeholder">
            <div className="spinner" aria-hidden="true" />
            <ol className="steps">
              <li className={stepClass('retrieving', phase.step)}>Retrieve Jira issue</li>
              <li className={stepClass('analyzing', phase.step)}>Analyze requirements</li>
              <li className={stepClass('generating', phase.step)}>Generate test cases &amp; coverage</li>
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
                <span className="badge badge-ok">
                  ✓ {phase.result.testCaseCount > 0 ? `${phase.result.testCaseCount} Test Cases` : 'Generated'}
                </span>
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
                  onClick={() => void downloadServerExport(phase.result, 'csv')}
                  disabled={exporting !== null}
                >
                  {exporting === 'csv' ? 'Exporting…' : 'Download .csv'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void downloadServerExport(phase.result, 'docx')}
                  disabled={exporting !== null}
                >
                  {exporting === 'docx' ? 'Exporting…' : 'Download .docx'}
                </button>
              </div>
            </div>

            {exportError && (
              <div className="alert alert-error alert-inline" role="alert">
                <strong>Export failed</strong>
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="table-scroll">
                      <table>{children}</table>
                    </div>
                  ),
                  td: ({ children }) => <td>{renderCellBreaks(children)}</td>,
                }}
              >
                {phase.result.markdown}
              </ReactMarkdown>
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
            <JiraMarkIcon />
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
                  : 'Generating Test Cases…'
              : 'Generate Test Cases'}
          </span>
        </button>

        {providerLabel && <p className="footnote">Active provider: {providerLabel}</p>}
      </form>
    </section>
  );
}
