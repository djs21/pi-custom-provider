# 🧩 cust-prov — Custom Provider Manager for pi

Ekstensi **pi coding agent** untuk mengelola *custom LLM provider* dari dalam TUI.  
Daftarkan provider API apapun yang kompatibel dengan OpenAI atau Anthropic, kelola model-nya, dan langsung pakai dari pi — tanpa edit config manual.

## ✨ Fitur

| Fitur | CLI (`/cp`) |
|-------|-------------|
| ➕ Tambah custom provider baru | `1. New provider` |
| ✏️ Edit nama atau API key provider | `2. Edit custom provider` |
| 🗑️ Hapus provider | Langsung dari menu utama |
| 🔄 Refresh model semua provider sekaligus | `3. Refresh all models` |
| 🔒 API key disimpan di file, aman | — |

## 🚀 Instalasi

1. Clone repositori ini ke direktori ekstensi pi:

```bash
cd ~/.pi/agent/extensions/
git clone git@github-pribadi:djs21/pi-custom-provider.git cust-prov
```

2. Restart pi — ekstensi otomatis terdeteksi lewat `package.json`:

```json
{
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

3. Jalankan perintah `/cp` dari TUI pi.

## 🧰 Cara Pakai

### Tambah Provider Baru

1. `/cp` → `1. Custom provider` → `1. New provider`
2. Isi **nama provider** (bebas, misal `my-vllm`)
3. Isi **Base URL** (misal `https://my-vllm.example.com/v1`)
4. Pilih **API type**:
   - `openai-completions` — untuk server OpenAI-compatible (vLLM, TGI, LiteLLM, dll)
   - `anthropic-messages` — untuk Anthropic Messages API
5. Masukkan **API Key**
6. Ekstensi akan otomatis *fetch models* dari endpoint dan mendaftarkannya ke registry pi

### Edit Provider

1. `/cp` → `1. Custom provider` → `2. Edit custom provider`
2. Pilih provider yang akan diedit
3. Pilih aksi:
   - **Ganti nama** — rename provider
   - **Ganti API key** — update key + refresh models

### Hapus Provider

1. `/cp` → `2. Hapus custom provider`
2. Pilih provider → konfirmasi

### Refresh Semua Provider

`/cp` → `1. Custom provider` → `3. Refresh all custom provider models`

## 🏗️ Arsitektur

```
index.ts          ← Entry point (bridge ke pi ExtensionAPI)
handlers.ts       ← TUI handlers (input → manager call)
manager.ts        ← Orchestrator (business logic)
store.ts          ← File I/O (baca/tulis models.json)
registry.ts       ← Pi registry adapter (daftar/cabut model)
fetcher.ts        ← HTTP client (fetch model list dari API)
types.ts          ← Shared types
```

### Alur Data

```
User (TUI /cp)
  → handlers.ts (input)
    → manager.ts (orchestrator)
      → store.ts     (baca/tulis file)
      → fetcher.ts   (HTTP ke external API)
      → registry.ts  (daftar model ke pi)
```

## ⚙️ Konfigurasi

### Provider Config (disimpan di `models.json` oleh store)

```typescript
interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: "openai-completions" | "anthropic-messages";
  authHeader?: boolean;
  headers?: Record<string, string>;
  compat?: Record<string, any>;
  models: ModelDef[];
  _managed: true;  // di-set otomatis oleh ekstensi
}
```

### Model Definition

```typescript
interface ModelDef {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}
```

## 🧪 Development

### Prasyarat

- [Bun](https://bun.sh) runtime
- pi coding agent terinstall

### Struktur

```bash
.
├── index.ts       # Entry point
├── types.ts       # Shared types
├── manager.ts     # Business logic
├── handlers.ts    # TUI handlers
├── store.ts       # File persistence
├── registry.ts    # Pi registry
├── fetcher.ts     # HTTP fetcher
├── package.json   # Extension manifest
└── README.md
```

## 🧑‍💻 Tech Stack

- **Runtime:** Bun
- **Bahasa:** TypeScript (ESM)
- **Framework:** pi coding agent Extension API
- **HTTP:** Built-in `fetch`

## 📄 Lisensi

MIT — lihat file [LICENSE](LICENSE).
