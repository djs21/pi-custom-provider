/**
 * TUI command handlers — one function per /cp sub-command.
 *
 * Each handler: TUI input → ProviderManager call → notify result.
 * No business logic, no I/O, no pi API — pure presentation.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ProviderManager } from "./manager.js";

// ── New provider ─────────────────────────────────────────────

export async function cmdNewProvider(mgr: ProviderManager, ctx: ExtensionCommandContext): Promise<void> {
  const name = await ctx.ui.input("Provider name:");
  if (!name) return;

  let baseUrl: string | undefined;
  while (!baseUrl) {
    baseUrl = await ctx.ui.input("Base URL (https://...):");
    if (baseUrl === undefined) return;
    if (!baseUrl) ctx.ui.notify("✗ Base URL wajib diisi", "warning");
  }

  const apiChoice = await ctx.ui.select("API type:", [
    "openai-completions — OpenAI-compatible (/v1)",
    "anthropic-messages — Anthropic Messages API",
  ]);
  if (!apiChoice) return;
  const api = apiChoice.startsWith("openai") ? "openai-completions" : "anthropic-messages";

  let apiKey: string | undefined;
  while (!apiKey) {
    apiKey = await ctx.ui.input("API Key:");
    if (apiKey === undefined) return;
    if (!apiKey) ctx.ui.notify("✗ API key wajib diisi", "warning");
  }

  ctx.ui.notify("Fetching models...", "info");
  const result = await mgr.create({ name, baseUrl, api, apiKey });

  if (result.ok) {
    ctx.ui.notify(`✓ ${result.detail}`, "success");
  } else {
    ctx.ui.notify(`✗ ${result.error}`, "error");
  }
}

// ── Edit provider ────────────────────────────────────────────

export async function cmdEditProvider(mgr: ProviderManager, ctx: ExtensionCommandContext): Promise<void> {
  const names = mgr.list();
  if (names.length === 0) {
    ctx.ui.notify("No managed providers", "warning");
    return;
  }

  const selected = await ctx.ui.select("Pick provider:", names);
  if (!selected) return;

  const action = await ctx.ui.select("Action:", [
    "1. Ganti nama",
    "2. Ganti API key → refresh models",
  ]);
  if (!action) return;

  if (action.startsWith("1.")) {
    const newName = await ctx.ui.input("New name:", selected);
    if (!newName || newName === selected || !newName.trim()) return;

    const result = await mgr.rename(selected, newName);
    if (result.ok) {
      ctx.ui.notify(`✓ ${result.detail}`, "success");
    } else {
      ctx.ui.notify(`✗ ${result.error}`, "error");
    }
    return;
  }

  const newKey = await ctx.ui.input("New API key:");
  if (!newKey) return;

  ctx.ui.notify("Refreshing models...", "info");
  const result = await mgr.updateKey(selected, newKey);

  if (result.ok) {
    ctx.ui.notify(`✓ ${result.detail}`, "success");
  } else {
    ctx.ui.notify(`✗ ${result.error}`, "warning");
  }
}

// ── Delete provider ──────────────────────────────────────────

export async function cmdDeleteProvider(mgr: ProviderManager, ctx: ExtensionCommandContext): Promise<void> {
  const names = mgr.list();
  if (names.length === 0) {
    ctx.ui.notify("No managed providers to delete", "warning");
    return;
  }

  const selected = await ctx.ui.select("Pilih provider yang akan dihapus:", names);
  if (!selected) return;

  const confirm = await ctx.ui.confirm(
    "Hapus provider?",
    `Yakin ingin menghapus "${selected}"? Semua model akan hilang dari registry.`,
  );
  if (!confirm) return;

  const result = await mgr.delete(selected);
  if (result.ok) {
    ctx.ui.notify(`✓ ${result.detail}`, "success");
  } else {
    ctx.ui.notify(`✗ ${result.error}`, "error");
  }
}

// ── Refresh all ──────────────────────────────────────────────

export async function cmdRefreshAll(mgr: ProviderManager, ctx: ExtensionCommandContext): Promise<void> {
  const names = mgr.list();
  if (names.length === 0) {
    ctx.ui.notify("No managed providers to refresh", "warning");
    return;
  }

  ctx.ui.notify("Refreshing all providers...", "info");
  const result = await mgr.refreshAll();

  if (result.fail > 0) {
    for (const d of result.details) {
      if (d.error) ctx.ui.notify(`"${d.name}" failed: ${d.error}`, "error");
    }
  }
  ctx.ui.notify(`Refresh done: ${result.ok} ok, ${result.fail} failed`, result.fail > 0 ? "warning" : "success");
}
