/** Shared types for the cust-prov extension. */

export interface Cost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelDef {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: Cost;
  contextWindow: number;
  maxTokens: number;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  compat?: Record<string, any>;
  models: ModelDef[];

  /** Internal flag — set by extension to track managed providers */
  _managed?: boolean;
}

export interface ModelsFile {
  providers: Record<string, ProviderConfig>;
}

// ── ProviderManager result types ──────────────────────────────

export type ProviderResult =
  | { ok: true; detail: string; modelsCount?: number }
  | { ok: false; error: string };

export interface RefreshAllResult {
  ok: number;
  fail: number;
  details: Array<{ name: string; error?: string }>;
}
