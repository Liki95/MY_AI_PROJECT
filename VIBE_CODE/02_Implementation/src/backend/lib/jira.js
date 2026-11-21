import { AppError, ErrorCodes, fetchWithTimeout } from './errors.js';
import { requireJiraConfig } from './config.js';

/**
 * READ-ONLY Jira client. Only HTTP GET requests are ever issued.
 * No create / update / transition / delete endpoints are implemented.
 */

export const JIRA_KEY_RE = /^[A-Z][A-Z0-9_]{0,19}-[1-9]\d{0,9}$/;
const MAX_DESCRIPTION = 15000;
const MAX_COMMENTS = 20;
const MAX_COMMENT_LEN = 1500;
const MAX_CUSTOM_FIELD_LEN = 3000;
const EXCLUDED_CUSTOM_FIELDS = /^(rank|development|\[chart\]|vulnerability|request participants|satisfaction|team|issue color|locked forms|open forms|submitted forms|total forms|design)$/i;

export function normalizeJiraKey(input) {
  const key = String(input || '').trim().toUpperCase();
  return JIRA_KEY_RE.test(key) ? key : null;
}

function authHeader(s) {
  return 'Basic ' + Buffer.from(`${s.jiraEmail}:${s.jiraToken}`).toString('base64');
}

async function jiraGet(s, apiPath) {
  requireJiraConfig(s);
  const res = await fetchWithTimeout(
    `${s.jiraBaseUrl}${apiPath}`,
    { method: 'GET', headers: { Authorization: authHeader(s), Accept: 'application/json' } },
    { timeoutMs: 20000, unreachableCode: ErrorCodes.JIRA_UNAVAILABLE, label: 'Jira' },
  );
  if (res.ok) return res.json();
  let detail = '';
  try {
    const body = await res.json();
    detail = [...(body.errorMessages || []), ...Object.values(body.errors || {})].join(' ').slice(0, 300);
  } catch { /* non-JSON body */ }
  switch (res.status) {
    case 400: throw new AppError(ErrorCodes.INVALID_INPUT, `Jira rejected the request. ${detail}`.trim(), 400);
    case 401: throw new AppError(ErrorCodes.JIRA_AUTH_FAILED, 'Jira authentication failed. Verify the Jira email and API token.', 401);
    case 403: throw new AppError(ErrorCodes.JIRA_FORBIDDEN, 'Jira authorization failed. The account lacks permission for this resource.', 403);
    case 404: throw new AppError(ErrorCodes.JIRA_NOT_FOUND, `Jira issue not found or not visible to this account. ${detail}`.trim(), 404);
    case 429: throw new AppError(ErrorCodes.JIRA_UNAVAILABLE, 'Jira rate limit reached. Retry shortly.', 429);
    default: throw new AppError(ErrorCodes.JIRA_UNAVAILABLE, `Jira responded with HTTP ${res.status}. ${detail}`.trim(), 502);
  }
}

export async function testJiraConnection(s) {
  const me = await jiraGet(s, '/rest/api/3/myself');
  const info = await jiraGet(s, '/rest/api/3/serverInfo').catch(() => null);
  return {
    ok: true,
    message: `Connected to Jira as ${me.displayName || 'authenticated user'}.`,
    account: me.displayName || null,
    serverTitle: info?.serverTitle || null,
  };
}

/* ---------------- Atlassian Document Format -> plain text/markdown ---------------- */

export function adfToText(node, depth = 0) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((n) => adfToText(n, depth)).join('');
  const kids = () => adfToText(node.content || [], depth);
  switch (node.type) {
    case 'doc': return kids().replace(/\n{3,}/g, '\n\n').trim();
    case 'text': return node.text || '';
    case 'hardBreak': return '\n';
    case 'paragraph': return kids() + '\n\n';
    case 'heading': return '#'.repeat(node.attrs?.level || 3) + ' ' + kids() + '\n\n';
    case 'bulletList':
    case 'orderedList':
      return (node.content || []).map((li, i) => {
        const bullet = node.type === 'orderedList' ? `${i + 1}.` : '-';
        const body = adfToText(li.content || [], depth + 1).trim().replace(/\n+/g, '\n' + '  '.repeat(depth + 1));
        return '  '.repeat(depth) + bullet + ' ' + body;
      }).join('\n') + '\n\n';
    case 'listItem': return kids();
    case 'taskList': return (node.content || []).map((t) => `- [${t.attrs?.state === 'DONE' ? 'x' : ' '}] ${adfToText(t.content || []).trim()}`).join('\n') + '\n\n';
    case 'taskItem': return kids();
    case 'codeBlock': return '```\n' + kids() + '\n```\n\n';
    case 'blockquote': return kids().split('\n').map((l) => (l ? '> ' + l : l)).join('\n') + '\n';
    case 'rule': return '---\n\n';
    case 'panel': return kids();
    case 'table':
      return (node.content || []).map((row) =>
        '| ' + (row.content || []).map((cell) => adfToText(cell.content || []).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|')).join(' | ') + ' |',
      ).join('\n') + '\n\n';
    case 'mention': return node.attrs?.text || '@user';
    case 'emoji': return node.attrs?.text || node.attrs?.shortName || '';
    case 'inlineCard':
    case 'blockCard': return node.attrs?.url || '';
    case 'status': return `[${node.attrs?.text || ''}]`;
    case 'date': return node.attrs?.timestamp ? new Date(Number(node.attrs.timestamp)).toISOString().slice(0, 10) : '';
    case 'mediaSingle':
    case 'mediaGroup':
    case 'media': return '[media attachment]\n';
    default: return kids();
  }
}

/* ---------------- Field value simplification ---------------- */

function simplify(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(simplify).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (value.type === 'doc') return adfToText(value);
    if (value.displayName) return value.displayName;
    if (value.value !== undefined) return simplify(value.value) + (value.child ? ` / ${simplify(value.child)}` : '');
    if (value.name) {
      // Sprint objects
      if (value.state && (value.startDate || value.endDate || value.state)) {
        const dates = [value.startDate?.slice(0, 10), value.endDate?.slice(0, 10)].filter(Boolean).join(' → ');
        return `${value.name} (${value.state}${dates ? ', ' + dates : ''}${value.goal ? ', goal: ' + value.goal : ''})`;
      }
      return value.name;
    }
    if (value.key) return value.key;
  }
  return '';
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n) + `… [truncated ${s.length - n} chars]` : s);

/* ---------------- Issue retrieval + normalization ---------------- */

export async function fetchIssue(s, key) {
  const raw = await jiraGet(s, `/rest/api/3/issue/${encodeURIComponent(key)}?expand=names&fields=*all`);
  return normalizeIssue(raw, s.jiraBaseUrl);
}

export function normalizeIssue(raw, baseUrl) {
  const f = raw.fields || {};
  const names = raw.names || {};

  const description = truncate(adfToText(f.description) || simplify(f.description), MAX_DESCRIPTION);

  // Acceptance criteria: any custom field explicitly named "Acceptance Criteria".
  let acceptanceCriteria = '';
  const customFields = [];
  for (const [id, name] of Object.entries(names).sort(([a], [b]) => a.localeCompare(b))) {
    if (!id.startsWith('customfield_')) continue;
    const val = simplify(f[id]);
    if (!val) continue;
    if (/acceptance\s*criteria/i.test(name)) {
      acceptanceCriteria = truncate(val, MAX_DESCRIPTION);
      continue;
    }
    if (EXCLUDED_CUSTOM_FIELDS.test(name) || /^\{.*\}$/.test(val) || /^\d+\|/.test(val)) continue;
    customFields.push({ id, name, value: truncate(val, MAX_CUSTOM_FIELD_LEN) });
  }

  const allComments = f.comment?.comments || [];
  const comments = allComments.slice(-MAX_COMMENTS).map((c, i) => ({
    ref: `COMMENT-${allComments.length - Math.min(allComments.length, MAX_COMMENTS) + i + 1}`,
    author: c.author?.displayName || 'Unknown',
    created: c.created?.slice(0, 10) || '',
    body: truncate(adfToText(c.body) || simplify(c.body), MAX_COMMENT_LEN),
  }));

  const linkedIssues = (f.issuelinks || []).map((l, i) => {
    const other = l.outwardIssue || l.inwardIssue;
    return {
      ref: `LINK-${i + 1}`,
      relation: l.outwardIssue ? l.type?.outward : l.type?.inward,
      key: other?.key,
      summary: other?.fields?.summary || '',
      status: other?.fields?.status?.name || '',
    };
  });

  const attachments = (f.attachment || []).map((a, i) => ({
    ref: `ATTACHMENT-${i + 1}`,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    created: a.created?.slice(0, 10) || '',
  }));

  const subtasks = (f.subtasks || []).map((st) => ({ key: st.key, summary: st.fields?.summary || '', status: st.fields?.status?.name || '' }));

  return {
    key: raw.key,
    url: `${baseUrl}/browse/${raw.key}`,
    summary: f.summary || '',
    description,
    acceptanceCriteria,
    metadata: {
      issueType: f.issuetype?.name || '',
      status: f.status?.name || '',
      priority: f.priority?.name || '',
      project: f.project ? `${f.project.name} (${f.project.key})` : '',
      assignee: f.assignee?.displayName || '',
      reporter: f.reporter?.displayName || '',
      created: f.created?.slice(0, 10) || '',
      updated: f.updated?.slice(0, 10) || '',
      dueDate: f.duedate || '',
      resolution: f.resolution?.name || '',
      environment: adfToText(f.environment) || simplify(f.environment),
      parent: f.parent ? `${f.parent.key}: ${f.parent.fields?.summary || ''}` : '',
      components: (f.components || []).map((c) => c.name),
      fixVersions: (f.fixVersions || []).map((v) => v.name),
      affectsVersions: (f.versions || []).map((v) => v.name),
    },
    labels: [...(f.labels || [])].sort(),
    comments,
    totalComments: allComments.length,
    linkedIssues,
    subtasks,
    attachments,
    customFields,
  };
}

/** Build an issue-like object from pasted story text (no Jira call). */
export function manualStory(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim())?.trim() || 'Pasted story';
  return {
    key: 'MANUAL',
    url: null,
    summary: truncate(firstLine.replace(/^#+\s*/, ''), 120),
    description: truncate(text.trim(), MAX_DESCRIPTION),
    acceptanceCriteria: '',
    metadata: {},
    labels: [],
    comments: [],
    totalComments: 0,
    linkedIssues: [],
    subtasks: [],
    attachments: [],
    customFields: [],
    manual: true,
  };
}
