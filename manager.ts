/**
 * ProviderManager — the deep module
 *
 * Orchestrates ModelStore + Registry + ModelFetcher behind one seam.
 * TUI layer calls this; tests call this.
 * All file I/O, HTTP, and pi-API calls are hidden behind injected adapters.
 */

import type { ProviderConfig, ProviderResult, RefreshAllResult, ModelDef } from "./types.js";
import type { ModelStore } from "./store.js";
import type { Registry } from "./registry.js";
import type { ModelFetcher } from "./fetcher.js";

// ── Interface ─────────────────────────────────────────────────

export interface ProviderManager {
  /** Add a brand new provider: fetch models, persist, register. */
  create(input: {
    name: string;
    baseUrl: string;
    api: string;
    apiKey: string;
  }): Promise<ProviderResult>;

  /** Rename an existing managed provider. */
  rename(name: string, newName: string): Promise<ProviderResult>;

  /** Update API key for a managed provider, then refresh models. */
  updateKey(name: string, apiKey: string): Promise<ProviderResult>;

  /** Re-fetch models for one managed provider. */
  refresh(name: string): Promise<ProviderResult>;

  /** Re-fetch models for every managed provider. */
  refreshAll(): Promise<RefreshAllResult>;

  /** Remove a managed provider from store and registry. */
  delete(name: string): Promise<ProviderResult>;

  /** Return names of all managed providers. */
  list(): string[];
}

// ── Implementation ────────────────────────────────────────────

export function createProviderManager(
  store: ModelStore,
  registry: Registry,
  fetcher: ModelFetcher,
): ProviderManager {
  function managedProvider(name: string): ProviderConfig | undefined {
    const data = store.read();
    const p = data.providers[name];
    if (!p || p._managed !== true) return undefined;
    return p;
  }

  /**
   * Merge incoming models from API with existing models in config.
   * Preserves user-overridden properties (cost, reasoning, contextWindow, maxTokens, input).
   * Only updates id + name from API.
   */
  function mergeModels(existing: ModelDef[] | undefined, incoming: ModelDef[]): ModelDef[] {
    const existingMap = new Map((existing ?? []).map((m) => [m.id, m]));
    return incoming.map((incoming) => {
      const existing = existingMap.get(incoming.id);
      if (!existing) return incoming; // new model, use API defaults
      return {
        ...incoming, // id, name from API
        reasoning: existing.reasoning,
        input: existing.input,
        cost: existing.cost,
        contextWindow: existing.contextWindow,
        maxTokens: existing.maxTokens,
      };
    });
  }

  return {
    // ── create ──────────────────────────────────────────────
    async create(input) {
      if (!input.name || !input.baseUrl || !input.apiKey || !input.api) {
        return { ok: false, error: "Semua field wajib diisi (name, baseUrl, apiKey, api)" };
      }

      // Check duplicate
      const existing = store.read();
      if (existing.providers[input.name]) {
        return { ok: false, error: `Provider "${input.name}" sudah ada` };
      }

      try {
        const { models, rawUrl } = await fetcher.fetch(input.baseUrl, input.apiKey, input.api);

        const config: ProviderConfig = {
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          api: input.api,
          _managed: true,
          models,
        };

        const data = store.read();
        data.providers[input.name] = config;
        store.write(data);

        registry.register(input.name, config);

        return { ok: true, detail: `Provider "${input.name}" ditambahkan`, modelsCount: models.length };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },

    // ── rename ──────────────────────────────────────────────
    async rename(name, newName) {
      if (!name || !newName) {
        return { ok: false, error: "Nama lama dan baru wajib diisi" };
      }

      const provider = managedProvider(name);
      if (!provider) {
        return { ok: false, error: `Provider "${name}" tidak ditemukan atau tidak dikelola` };
      }

      const data = store.read();
      if (data.providers[newName]) {
        return { ok: false, error: `Provider "${newName}" sudah ada` };
      }

      data.providers[newName] = { ...provider };
      delete data.providers[name];
      store.write(data);

      registry.unregister(name);
      registry.register(newName, provider);

      return { ok: true, detail: `"${name}" → "${newName}"` };
    },

    // ── updateKey ───────────────────────────────────────────
    async updateKey(name, apiKey) {
      if (!name || !apiKey) {
        return { ok: false, error: "Nama provider dan API key wajib diisi" };
      }

      const provider = managedProvider(name);
      if (!provider) {
        return { ok: false, error: `Provider "${name}" tidak ditemukan atau tidak dikelola` };
      }

      provider.apiKey = apiKey;

      try {
        const { models, rawUrl } = await fetcher.fetch(provider.baseUrl, apiKey, provider.api);
        provider.models = mergeModels(provider.models, models);

        const data = store.read();
        data.providers[name] = provider;
        store.write(data);

        registry.unregister(name);
        registry.register(name, provider);

        return {
          ok: true,
          detail: `Key "${name}" diperbarui, ${models.length} model dari ${rawUrl}`,
          modelsCount: models.length,
        };
      } catch (e: any) {
        // Save key even if fetch fails
        const data = store.read();
        data.providers[name] = provider;
        store.write(data);

        return { ok: false, error: `Key tersimpan, tapi refresh model gagal: ${e.message}` };
      }
    },

    // ── refresh ─────────────────────────────────────────────
    async refresh(name) {
      const provider = managedProvider(name);
      if (!provider) {
        return { ok: false, error: `Provider "${name}" tidak ditemukan atau tidak dikelola` };
      }

      try {
        const { models, rawUrl } = await fetcher.fetch(provider.baseUrl, provider.apiKey, provider.api);
        provider.models = mergeModels(provider.models, models);

        const data = store.read();
        data.providers[name] = provider;
        store.write(data);

        registry.unregister(name);
        registry.register(name, provider);

        return { ok: true, detail: `"${name}" diperbarui — ${models.length} model dari ${rawUrl}`, modelsCount: models.length }; 
      } catch (e: any) {
        return { ok: false, error: `Refresh "${name}" gagal: ${e.message}` };
      }
    },

    // ── refreshAll ──────────────────────────────────────────
    async refreshAll() {
      const data = store.read();
      const names = Object.entries(data.providers)
        .filter(([_, p]) => p._managed === true)
        .map(([n]) => n);

      const ok: string[] = [];
      const fail: Array<{ name: string; error: string }> = [];

      for (const name of names) {
        const p = data.providers[name];
        try {
          const { models } = await fetcher.fetch(p.baseUrl, p.apiKey, p.api);
          p.models = mergeModels(p.models, models);
          data.providers[name] = p;
          registry.unregister(name);
          registry.register(name, p);
          ok.push(name);
        } catch (e: any) {
          fail.push({ name, error: e.message });
        }
      }

      store.write(data);

      return {
        ok: ok.length,
        fail: fail.length,
        details: [
          ...ok.map((n) => ({ name: n })),
          ...fail.map((f) => ({ name: f.name, error: f.error })),
        ],
      };
    },

    // ── delete ──────────────────────────────────────────────
    async delete(name) {
      const provider = managedProvider(name);
      if (!provider) {
        return { ok: false, error: `Provider "${name}" tidak ditemukan atau tidak dikelola` };
      }

      const data = store.read();
      delete data.providers[name];
      store.write(data);

      registry.unregister(name);

      return { ok: true, detail: `Provider "${name}" dihapus` };
    },

    // ── list ────────────────────────────────────────────────
    list(): string[] {
      const data = store.read();
      return Object.entries(data.providers)
        .filter(([_, p]) => p._managed === true)
        .map(([n]) => n);
    },
  };
}
