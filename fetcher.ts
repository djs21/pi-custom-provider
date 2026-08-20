/**
 * ModelFetcher — HTTP/network seam
 *
 * Interface + 2 adapters:
 *   HttpModelFetcher   (prod: real HTTP GET)
 *   StubModelFetcher   (tests: canned data)
 */

import type { ModelDef } from "./types.js";

// ── Interface ─────────────────────────────────────────────────

export interface ModelFetcher {
  fetch(baseUrl: string, apiKey: string, api: string, headers?: Record<string, string>): Promise<{ models: ModelDef[]; rawUrl: string }>;
}

// ── Production adapter ────────────────────────────────────────

export class HttpModelFetcher implements ModelFetcher {
  async fetch(
    baseUrl: string,
    apiKey: string,
    api: string,
    headers?: Record<string, string>,
  ): Promise<{ models: ModelDef[]; rawUrl: string }> {
    const cleanUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    let url: string;
    let hdr: Record<string, string> = {};

    if (api === "anthropic-messages") {
      url = `${cleanUrl}/models`;
      hdr["x-api-key"] = apiKey;
      hdr["anthropic-version"] = "2023-06-01";
      hdr["Content-Type"] = "application/json";
    } else {
      url = `${cleanUrl}/models`;
      hdr["Authorization"] = `Bearer ${apiKey}`;
      hdr["Content-Type"] = "application/json";
    }

    // Merge provider headers (they override auth headers for same keys)
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        hdr[k] = v;
      }
    }

    const response = await fetch(url, { headers: hdr });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `GET ${url} → ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }

    const raw = (await response.json()) as any;
    const items: any[] = raw?.data ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No models returned from ${url}`);
    }

    const models: ModelDef[] = items.map((m: any) => {
      // Rich format (OpenRouter-style)
      const pricing = m.pricing as Record<string, string> | undefined;
      const topProvider = m.top_provider as Record<string, any> | undefined;
      const reasoningObj = m.reasoning as Record<string, any> | undefined;
      const arch = m.architecture as Record<string, any> | undefined;

      const cost = pricing
        ? {
            input: parseFloat(pricing.prompt ?? "0") * 1_000_000,
            output: parseFloat(pricing.completion ?? "0") * 1_000_000,
            cacheRead: parseFloat(pricing.input_cache_read ?? "0") * 1_000_000,
            cacheWrite: parseFloat(pricing.input_cache_write ?? "0") * 1_000_000,
          }
        : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

      const reasoning =
        reasoningObj?.mandatory === true ||
        (Array.isArray(reasoningObj?.supported_efforts) &&
          reasoningObj!.supported_efforts!.length > 0) ||
        api === "anthropic-messages" ||
        /reason|think/i.test(m.id ?? "");

      const input: string[] = arch?.input_modalities
        ? (arch.input_modalities as string[]).filter(
            (m: string) => m === "text" || m === "image",
          )
        : ["text"];

      return {
        id: m.id,
        name: m.name ?? m.id ?? "unknown",
        reasoning,
        input: input.length > 0 ? input : ["text"],
        cost,
        contextWindow: (m.context_length ?? m.context_window ?? m.contextWindow ?? 256_000) as number,
        maxTokens: (topProvider?.max_completion_tokens ?? m.max_tokens ?? m.maxTokens ?? 10_240) as number,
      };
    });

    return { models, rawUrl: url };
  }
}

// ── Test adapter ──────────────────────────────────────────────

export interface StubModel {
  id: string;
  name?: string;
}

export class StubModelFetcher implements ModelFetcher {
  private models: ModelDef[] = [];
  private shouldThrow: Error | null = null;

  /** Set canned models the fetcher returns. */
  setModels(models: ModelDef[]): void {
    this.models = models;
  }

  /** Set a canned error the fetcher throws. */
  setError(error: Error): void {
    this.shouldThrow = error;
  }

  async fetch(
    baseUrl: string,
    _apiKey: string,
    _api: string,
    _headers?: Record<string, string>,
  ): Promise<{ models: ModelDef[]; rawUrl: string }> {
    if (this.shouldThrow) {
      throw this.shouldThrow;
    }
    return { models: this.models, rawUrl: `${baseUrl}/models` };
  }
}
