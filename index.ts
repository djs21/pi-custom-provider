/**
 * Custom Provider Manager — entry point (thin bridge)
 *
 * Wires adapters → registers /cp command → dispatches to handlers.
 * No business logic, no TUI helpers — just menu routing.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FsModelStore } from "./store.js";
import { PiRegistry } from "./registry.js";
import { HttpModelFetcher } from "./fetcher.js";
import { createProviderManager } from "./manager.js";
import type { ProviderManager } from "./manager.js";
import {
  cmdNewProvider,
  cmdEditProvider,
  cmdDeleteProvider,
  cmdRefreshAll,
} from "./handlers.js";

function buildManager(pi: ExtensionAPI): ProviderManager {
  return createProviderManager(
    new FsModelStore(),
    new PiRegistry(pi),
    new HttpModelFetcher(),
  );
}

export default function (pi: ExtensionAPI) {
  const mgr = buildManager(pi);

  pi.registerCommand("cp", {
    description: "Custom provider manager — baru / edit / hapus / refresh models",
    handler: async (_args, ctx) => {
      const main = await ctx.ui.select("Pilih opsi:", [
        "1. Provider dari daftar provider",
        "2. Ollama",
        "3. Custom provider",
        "4. Hapus custom provider",
        "x. Batal",
      ]);
      if (!main || main.startsWith("x")) return;

      if (main.startsWith("4.")) {
        await cmdDeleteProvider(mgr, ctx);
        return;
      }

      if (!main.startsWith("3")) {
        ctx.ui.notify("Fitur belum tersedia", "warning");
        return;
      }

      const sub = await ctx.ui.select("Custom provider:", [
        "1. New provider",
        "2. Edit custom provider",
        "3. Refresh all custom provider models",
        "x. Kembali",
      ]);
      if (!sub || sub.startsWith("x")) return;

      if (sub.startsWith("1.")) await cmdNewProvider(mgr, ctx);
      else if (sub.startsWith("2.")) await cmdEditProvider(mgr, ctx);
      else if (sub.startsWith("3.")) await cmdRefreshAll(mgr, ctx);
    },
  });
}
