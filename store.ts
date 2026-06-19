/**
 * ModelStore — persistence seam
 *
 * Interface + 2 adapters:
 *   FsModelStore     (prod: reads/writes ~/.pi/agent/models.json)
 *   InMemoryStore    (tests: keeps data in-memory)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ModelsFile } from "./types.js";

// ── Interface ─────────────────────────────────────────────────

export interface ModelStore {
  read(): ModelsFile;
  write(data: ModelsFile): void;
}

// ── Production adapter ────────────────────────────────────────

const DEFAULT_MODELS_PATH = path.join(os.homedir(), ".pi", "agent", "models.json");

export class FsModelStore implements ModelStore {
  private readonly filePath: string;

  constructor(filePath: string = DEFAULT_MODELS_PATH) {
    this.filePath = filePath;
  }

  read(): ModelsFile {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
    } catch {
      return { providers: {} };
    }
  }

  write(data: ModelsFile): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2) + "\n");
  }
}

// ── Test adapter ──────────────────────────────────────────────

export class InMemoryStore implements ModelStore {
  private data: ModelsFile = { providers: {} };

  read(): ModelsFile {
    return structuredClone(this.data);
  }

  write(data: ModelsFile): void {
    this.data = structuredClone(data);
  }

  /** Helper for tests: inspect current state */
  dump(): ModelsFile {
    return structuredClone(this.data);
  }
}
