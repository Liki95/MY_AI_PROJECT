export type Provider = 'ollama' | 'groq';

export interface PublicSettings {
  envFileLoaded: boolean;
  jira: { url: string; email: string; apiTokenConfigured: boolean };
  llm: {
    provider: Provider;
    ollama: { baseUrl: string; model: string };
    groq: { model: string; apiKeyConfigured: boolean };
  };
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { missing?: string[]; availableModels?: string[] };
}

export interface IssueRef {
  key: string;
  summary: string;
  url: string | null;
  manual: boolean;
}

export interface TestPlanResult {
  markdown: string;
  warnings: string[];
  provider: Provider;
  model: string;
  issue: IssueRef;
  generatedAt: string;
  durationMs: number;
}

export type GenerationEvent =
  | { stage: 'retrieving'; key: string }
  | { stage: 'retrieved'; issue: IssueRef & { comments: number; linkedIssues: number; attachments: number; hasAcceptanceCriteria: boolean } }
  | { stage: 'generating'; provider: Provider; model: string }
  | { stage: 'done'; result: TestPlanResult }
  | { stage: 'error'; error: ApiErrorBody };

export interface ConnectionResult {
  ok: boolean;
  message: string;
  availableModels?: string[];
  latencyMs?: number;
}
