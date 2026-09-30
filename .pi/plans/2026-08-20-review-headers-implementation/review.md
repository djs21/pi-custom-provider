# Code Review

**Reviewed:** Browser-header support for provider creation + fetch, default contextWindow/maxTokens bump
**Verdict:** NEEDS CHANGES

## Summary

Header plumbing is correct end-to-end: `create()` forwards headers to both the fetcher and `ProviderConfig`, refresh/updateKey/refreshAll re-forward stored headers, and the fetcher merge order correctly lets provider headers override auth headers. One real bug: the `ctx.ui.confirm` call passes a boolean where the API requires a message string.

## Findings

### [P1] `ctx.ui.confirm` called with wrong second argument

**File:** `handlers.ts:39-42`
**Issue:** `ctx.ui.confirm("Pakai browser headers untuk bypass Cloudflare?", true)` passes `true` as the second argument. The pi API signature is:

```ts
confirm(title: string, message: string, opts?: ExtensionUIDialogOptions): Promise<boolean>;
```

So `true` lands in the `message: string` parameter — a TypeScript type error (`boolean` not assignable to `string`), and at runtime `showExtensionConfirm` renders `${title}\n${message}`, so the dialog body displays the literal text `true`.

The `true` was presumably meant as "default to Yes", but the API has no default parameter — it always renders a `["Yes", "No"]` selector (Yes highlighted first, so Enter already selects Yes). The yes/no choice itself still works; the message text is just broken and the type is wrong.

**Suggested Fix:**
```ts
const useHeaders = await ctx.ui.confirm(
  "Browser headers",
  "Pakai browser headers untuk bypass Cloudflare?",
);
```

## Checklist

### ✅ PASS

1. **create() forwards headers to fetcher AND ProviderConfig** — `manager.ts:94` (`input.headers`) and `manager.ts:102` (`headers: input.headers`). Correct.
2. **updateKey/refresh/refreshAll forward stored headers** — `manager.ts:157`, `manager.ts:190`, `manager.ts:219` all pass `provider.headers` / `p.headers`. Correct.
3. **Provider headers override auth headers** — `fetcher.ts:30-46`: auth headers are set into `hdr` first, then provider entries overwrite same keys. Provider wins, as intended.
4. **Defaults are fallbacks only** — `fetcher.ts:99-100`: `?? 256_000` and `?? 10_240` are only applied when all API fields are null/undefined. Correct.
5. **Existing providers without headers unaffected** — `fetcher.ts:42` guards `if (headers)`; `headers: undefined` is omitted by `JSON.stringify` in `store.ts:43`, so legacy entries in models.json are untouched.
6. **`headers` → `hdr` rename is safe** — the old local shadowing is gone; the function parameter is `headers` and the merged object is `hdr`, used correctly at `fetcher.ts:48`. No stale `headers` reference remains.
7. **StubModelFetcher still matches ModelFetcher** — `fetcher.ts:133` adds `_headers?: Record<string, string>`; interface satisfied.
8. **types.ts already declares the field** — `types.ts:25`: `headers?: Record<string, string>`. No change needed.
9. **"No" → undefined** — `handlers.ts:43-52`: ternary yields `undefined` (not `{}`). Correct.
10. **Refresh preserves headers** — `refresh()` reads `provider` via `managedProvider()`, which loads persisted config including `headers`. Correct.

### ❌ FAIL

1. **`handlers.ts:39-42`** — `ctx.ui.confirm` second arg is `true` (boolean) instead of a message string. Type error + dialog shows literal `true`. Fix above.

### ⚠️ WARN

1. **`handlers.ts:45`** — hardcoded `User-Agent: Chrome/131.0.0.0` is static and will age. Not a blocker (verified Bun/Node both accept the `Sec-Fetch-*` headers without error), but consider a newer/more maintainable UA constant if Cloudflare evasion actually relies on it.

## What's Good

- Clean seam placement: headers flow through the existing `ModelFetcher` interface rather than a parallel path; all four call sites were updated consistently.
- The merge logic is simple and correct (auth first, provider overrides).
- Backward compatibility for existing providers is handled naturally via the `if (headers)` guard and JSON-omitted `undefined`.
