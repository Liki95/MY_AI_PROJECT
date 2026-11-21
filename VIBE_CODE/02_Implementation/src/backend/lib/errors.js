/**
 * Typed application error. `code` is a stable machine-readable identifier the
 * frontend uses to render the correct error state. Messages never contain secrets.
 */
export class AppError extends Error {
  constructor(code, message, status = 500, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const ErrorCodes = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_CONFIG: 'MISSING_CONFIG',
  JIRA_AUTH_FAILED: 'JIRA_AUTH_FAILED',
  JIRA_FORBIDDEN: 'JIRA_FORBIDDEN',
  JIRA_NOT_FOUND: 'JIRA_NOT_FOUND',
  JIRA_UNAVAILABLE: 'JIRA_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  LLM_AUTH_FAILED: 'LLM_AUTH_FAILED',
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_MODEL_NOT_FOUND: 'LLM_MODEL_NOT_FOUND',
  GENERATION_FAILED: 'GENERATION_FAILED',
  INTERNAL: 'INTERNAL',
});

export function toErrorPayload(err) {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } } };
  }
  return { status: 500, body: { error: { code: ErrorCodes.INTERNAL, message: 'Unexpected server error.' } } };
}

/**
 * fetch() wrapper with timeout. Network-level failures are converted to AppError
 * using the supplied code so callers can distinguish "unreachable" from HTTP errors.
 */
export async function fetchWithTimeout(url, options = {}, { timeoutMs = 20000, unreachableCode = ErrorCodes.NETWORK_ERROR, label = 'Remote service' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new AppError(unreachableCode, `${label} did not respond within ${Math.round(timeoutMs / 1000)}s.`, 504);
    }
    const cause = e.cause?.code ? ` (${e.cause.code})` : '';
    throw new AppError(unreachableCode, `${label} is unreachable${cause}. Check the URL and your network connection.`, 502);
  } finally {
    clearTimeout(timer);
  }
}
