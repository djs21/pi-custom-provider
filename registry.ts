/**
 * Registry — pi‑integration seam
 *
 * Interface + 2 adapters:
 *   PiRegistry     (prod: wraps pi.registerProvider / unregisterProvider)
 *   NoopRegistry   (tests: silently records calls)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ProviderConfig } from "./types.js";

// ── Interface ─────────────────────────────────────────────────

export interface Registry {
  register(name: string, config: ProviderConfig): void;
  unregister(name: string): void;
}

// ── Production adapter ────────────────────────────────────────

export class PiRegistry implements Registry {
  private readonly pi: ExtensionAPI;

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
  }

  private buildProviderConfig(config: ProviderConfig): Record<string, any> {
    const out: Record<string, any> = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      api: config.api,
      models: config.models,
    };
    if (config.authHeader) out.authHeader = config.authHeader;
    if (config.headers && Object.keys(config.headers).length > 0) out.headers = config.headers;
    if (config.compat && Object.keys(config.compat).length > 0) out.compat = config.compat;
    return out;
  }

  register(name: string, config: ProviderConfig): void {
    this.pi.registerProvider(name, this.buildProviderConfig(config));
  }

  unregister(name: string): void {
    try {
      this.pi.unregisterProvider(name);
    } catch {
      // may not exist
    }
  }
}

// ── Test adapter ──────────────────────────────────────────────

export interface RegistryCall {
  type: "register" | "unregister";
  name: string;
  config?: ProviderConfig;
}

export class NoopRegistry implements Registry {
  readonly calls: RegistryCall[] = [];

  register(name: string, config: ProviderConfig): void {
    this.calls.push({ type: "register", name, config });
  }

  unregister(name: string): void {
    this.calls.push({ type: "unregister", name });
  }

  /** Helper: assert a registration happened */
  wasRegistered(name: string): boolean {
    return this.calls.some((c) => c.type === "register" && c.name === name);
  }

  /** Helper: assert an unregistration happened */
  wasUnregistered(name: string): boolean {
    return this.calls.some((c) => c.type === "unregister" && c.name === name);
  }

  reset(): void {
    this.calls.length = 0;
  }
}
