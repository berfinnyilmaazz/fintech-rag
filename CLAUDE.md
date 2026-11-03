# CLAUDE.md — Project Instructions

`fintech-rag`: a TypeScript monorepo for hybrid RAG over the internal documentation of Vantor,
a fictional payments company. Chat with grounded, cited answers; a raw search page; an admin
dashboard; and an MCP server — all calling the same framework-free core.

This file is the source of truth for how the project is built. README.md explains it to
readers; EVAL_RESULTS.md holds the measurements; AI_USAGE.md is the honest log.

---

## 1. Non-negotiables

- TypeScript everywhere, `strict` + `noUncheckedIndexedAccess`. **Never `any`** — `unknown`
  plus narrowing.
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`, no `tailwind.config.js`).
- **No `shadcn init`.** Its `@theme inline` block overrides this project's tokens. UI
  primitives are hand-written in `apps/web/components/ui/`; add a single Radix primitive
  directly if one is ever needed.
- Responsive at 375 / 768 / 1440, checked in a browser.
- Every API route: Zod input validation, guard first, try/catch, error envelope
  `{ error: { code, message } }`, 401 for unauthenticated vs 403 for unauthorised.
- No logic duplicated between surfaces. MCP is a transport adapter, never a second
  implementation.
- Runs on a fresh clone from the README, with no API key.

### Cross-platform

Development happens on Windows / PowerShell; everything must also run on macOS and Linux.

- No bash-only syntax in `package.json` scripts. Use Node scripts.
- Normalise paths to forward slashes before deriving metadata; `source_path` is stored POSIX.
- Strip `\r` before hashing content, or CRLF checkouts re-index everything.
- `.gitattributes` keeps the repo LF.
- `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- Postgres is on host port **5433**.
- `pnpm search` is a built-in pnpm command — always **`pnpm run search "…"`**. Flags pnpm
  claims need `--`: `pnpm eval -- --no-llm`.

---

## 2. Dependencies

**Pin every dependency exactly — no caret, no tilde.** Before adding a package, run
`npm view <pkg> version` and say what was found. When using an unfamiliar API, read
`node_modules/<pkg>/dist/*.d.ts` first.

| Package | Version | Note |
|---|---|---|
| `next` | 16.3.1 | App Router; `proxy.ts`, not `middleware.ts` |
| `react` / `react-dom` | 19.2.8 | |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | |
| `drizzle-orm` / `drizzle-kit` | 0.45.2 / 0.31.10 | drizzle's `vector` column serialises itself — no `pgvector` package |
| `postgres` | 3.4.9 | |
| `next-auth` | `5.0.0-beta.32` | npm `latest` is v4 — pin exactly |
| `@auth/drizzle-adapter` | 1.11.3 | |
| `ai` / `@ai-sdk/google` | 7.0.70 / 4.0.47 | |
| `@huggingface/transformers` | 4.2.0 | **not** `@xenova/transformers` |
| `@modelcontextprotocol/server` / `express` | 2.0.0 | MCP v2: `registerTool()`. **Not** `@modelcontextprotocol/sdk` (v1) |
| `zod` | 4.4.3 | |
| `turbo` | 2.10.11 | |
| `typescript` | 5.9.3 | deliberately behind `latest` |
| `@types/node` | 22.20.1 | tracks the Node 22 runtime |
| `@biomejs/biome` | 2.5.9 | folder ignores are `!docs`, not `!docs/**` |
| `vitest` | 4.1.11 | |
| `bcryptjs` | 3.0.3 | ships its own types |
| `js-tiktoken` | 1.0.21 | |
| `tsx` | 4.23.12 | |

pnpm **11.22.0** (`packageManager` in the root `package.json`).

---

## 3. Architecture

```
apps/web        Next.js — UI + API routes + Auth.js
apps/mcp        MCP server (stdio + Streamable HTTP, bearer auth)
packages/core   ingestion, retrieval, RAG, eval — FRAMEWORK-FREE
packages/db     Drizzle schema, migrations, client, seed
packages/shared Zod schemas; types via z.infer
scripts/        ingest, search, ask, eval, calibrate, test-load, test-mcp, screenshot
data/corpus     the synthetic corpus (committed)
```

All retrieval lives in `packages/core`. Every surface calls the same `search()` and `ask()`.

---

## 4. The corpus

123 markdown files, ~21.5k tokens, largest 289 tokens. Path-derived metadata
(`packages/core/src/ingest/loader.ts`):

| directory | docType | metadata |
|---|---|---|
| root | `reference` | — |
| `api/` | `api-reference` | — |
| `policies/` | `policy` | — |
| `runbooks/` | `runbook` | — |
| `release-notes/` | `release-note` | `period` from `YYYY-MM-` |
| `decisions/` | `decision-record` | — |
| `incidents/` | `incident` | `period` only — the slug is an incident, not a merchant |
| `merchants/` | `merchant-profile` | `project` = filename |
| `settlement-reports/` | `settlement-report` | `period` + `project` (merchant) |

**Rules for editing the corpus:**

- The deprecation regex is case-insensitive. **Only `api/payments-api-v1.md` may contain the
  words "deprecated" or "superseded by".** Elsewhere write "retired" or "sunset".
- Keep documents under 512 tokens, or the chunker splits them.
- Keep facts consistent across documents (incident ↔ ADR ↔ release note ↔ reports).
- After any change: `pnpm test:load` (asserts counts, deprecated set, merchants, chunks),
  then `pnpm ingest` and `pnpm eval`.

### The retrieval traps it contains

1. **Deprecated v1 / current v2** Payments API, near-identical text.
2. **66 template-shaped settlement reports** sharing highlights verbatim; the merchant and
   month in the header are the main discriminating signal.
3. **Dense identifiers** — error codes, headers, CLI commands, merchant slugs.
4. **Multi-document answers** — incident ↔ ADR ↔ release note; refunds ↔ disputes.
5. **"Latest" questions** over release notes and monthly reports.
6. **Out-of-corpus questions**, including in-domain near misses.

---

## 5. Retrieval design — every value here was measured

- **One document = one chunk** below 512 tokens; heading-aware split (400 target, 60 overlap)
  above. Embedded text carries a `[docType] title / project | period | status` header; the
  displayed content does not.
- **`tsv` is generated from `embedded_text`**, so merchant slugs and periods are keyword-searchable.
- **Hybrid RRF in one SQL query**: vector top 20 + `ts_rank` top 20, `1/(60 + rank)` per arm.
  The vector CTE nests so HNSW is used and the raw distance survives.
- **Keyword arm: plain AND** (`DEFAULT_KEYWORD_MODE = 'and'`). The AND→OR fallback measured
  worse on this corpus.
- **Deprecated penalty: +5 ranks in each arm — never a score multiplier.** An RRF score's
  whole range is 1.31×; a multiplier larger than that is a filter.
- **Recency tie-break** (`recency.ts`) on *latest / most recent / newest*: the newest
  candidate of the same docType + merchant takes the highest-ranked one's position.
  "current" is not a cue.
- **MMR is implemented and off** (`DEFAULT_MMR = false`): it pushed deprecated v1 out of the
  top 6. Inside MMR, relevance is the normalised rank, never the RRF score.
- **Deterministic tie-breaks on `source_path`** in both arms. Never tie-break on chunk id.
- **Raw SQL serialises the query vector by hand**: `${JSON.stringify(vec)}::vector`.
- **BGE query prefix stays** — dropping it costs 4.4 points recall@1.
- **topK 6.**

## 6. Generation and refusal

1. Retrieve topK 6.
2. **Layer 1:** if `topCosine` < **0.51**, answer "The corpus does not cover this." without
   calling a model. `topCosine = 1 − MIN(dist)` over the whole vector CTE — **never** the
   fused score, never `chunks[0].cosine`. Recalibrate with `pnpm calibrate` whenever the
   corpus changes.
3. No provider configured → extractive mode, clearly labelled.
4. Otherwise `streamText` with numbered passages.
5. **Validate citations** after the stream: strip `[n]` markers that map to no passage.
6. Log to `search_logs` (`top_cosine real`, never the RRF score).

In-domain out-of-corpus questions overlap the answerable cosine range; layer 2 (prompt +
citation validation) handles them. Generation: `gemini-3.6-flash`, configurable via
`GEMINI_MODEL`; needs both `LLM_PROVIDER=gemini` and `GOOGLE_GENERATIVE_AI_API_KEY`.

The embedding provider **must stay memoised** — a fresh instance re-initialises the model on
every query.

## 7. Security

1. `proxy.ts` gates `/dashboard/*` — UX only.
2. **`requireUser()` / `requireAdmin()` as the first statement of every route handler** —
   the real enforcement.
3. Server Components re-check with `auth()`.

A non-admin `DELETE /api/documents/:id` must return 403 **and leave the row intact**.
`/api/chat` and `/api/search` are rate-limited. Never commit `.env`.

## 8. Evaluation

`packages/core/eval/golden.json`: 23 answerable (one `expected` document each) + 3 refusals.
Questions with many correct sources are excluded.

- **Every eval variant states every option explicitly** — a harness must never read
  application defaults.
- Judge changes at recall@1 and MRR, and **read the ranked lists**: a supporting document
  can vanish without moving recall.
- Do not tune retrieval to a single failing golden question.

---

## 9. How to work

- One phase at a time; stop at checkpoints and wait for confirmation.
- **Ask before deviating** from this file, with numbers.
- **Verify before asserting** — run it.
- Conventional Commits, atomic and meaningful. Never squash.
- Comments only where the *why* is non-obvious. Propose a split past ~250 lines.
- Definition of done: it runs, errors are handled, types are strict, UI checked at 375px,
  committed, and AI_USAGE.md updated with what went wrong and how it was caught.
