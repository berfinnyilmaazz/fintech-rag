[![M8ven Score](https://m8ven.ai/badge/mcp/berfinnyilmaazz-fintech-rag-1ric9d?v=1ba937bb64eedcd798a45d95a55d8b08)](https://m8ven.ai/mcp/berfinnyilmaazz-fintech-rag-1ric9d?s=readme)
# Fintech RAG

A TypeScript monorepo that makes an internal document corpus answerable: a chat surface that
returns grounded answers with citations, a raw retrieval surface for judging the search
itself, an authenticated admin dashboard for managing and observing the index, and an MCP
server that exposes the same search to an external client. Retrieval is hybrid — pgvector
cosine similarity and Postgres full-text ranking, fused with Reciprocal Rank Fusion in a
single SQL query — and the whole system runs with **no API key at all**.

The corpus is the internal documentation of **Vantor, a fictional payments company**: API
references, policies, runbooks, release notes, architecture decision records, incident
reviews and monthly settlement reports. It is synthetic and committed, so a clone runs as-is.
It was written to contain the problems that break naive RAG — a deprecated API version that
outranks its replacement on pure similarity, 66 template-shaped reports that repeat the same
sentences verbatim, dense identifiers, answers spread over several documents, "latest"
questions, and questions it cannot answer.

Every retrieval decision was measured against a golden set rather than argued about. The
numbers are in [EVAL_RESULTS.md](EVAL_RESULTS.md), including the variants that lost — two of
which were the defaults until the measurements said otherwise.

---

## Screens

**Chat — a grounded answer with its sources.** The deprecated Payments API v1 is retrieved
and the answer says it is retired. That is the point of down-weighting the document rather
than filtering it out: a filtered-away v1 could not be cited.

![Chat with an answer and its sources](screenshots/chat-answered-1440.png)

**Search — retrieval with nothing in front of it.** No model, no key required. Each result
shows its fused score, its rank in *each* arm, its raw cosine and the metadata that
separates otherwise-identical documents.

![Search results showing per-arm ranks](screenshots/search-results-1440.png)

For the v1/v2 question, two rows carry the argument:

```
1.  vec 2   kw —   api/payments-api-v2.md   cos 0.7522
5.  vec 1   kw —   api/payments-api-v1.md   cos 0.8028   ⚠ deprecated
```

`payments-api-v1.md` is **rank 1 in the vector arm with the highest cosine on the page**, and
it sits at position 5: below the current version, still inside the context. That is the +5
rank offset on deprecated documents doing its job.

**Dashboard — corpus, ingestion runs and search analytics.** Admin only.

![Dashboard at 1440px](screenshots/dashboard-1440.png)

**375px.** Every layout was checked at 375 / 768 / 1440 in a real browser. The document table
becomes a card list rather than a sideways-scrolling table.

<p align="center">
  <img src="screenshots/chat-answered-375.png" width="300" alt="Chat at 375px">
  <img src="screenshots/dashboard-375.png" width="300" alt="Dashboard at 375px">
</p>

---

## Architecture

```mermaid
flowchart TB
    subgraph surfaces["Surfaces"]
        chat["/chat<br/>grounded answers"]
        search["/search<br/>raw retrieval"]
        dash["/dashboard<br/>admin"]
        mcp["MCP server<br/>stdio + HTTP"]
    end

    subgraph api["apps/web · API routes"]
        guards["requireUser() / requireAdmin()<br/>Zod · rate limit · error envelope"]
    end

    subgraph core["packages/core — framework-free"]
        ask["ask()<br/>guard → generate → validate citations"]
        srch["search()<br/>hybrid RRF + recency"]
        ingest["runIngestion()<br/>content-hash incremental"]
        embed["EmbeddingProvider<br/>local BGE, 384-dim"]
        llm["LlmProvider<br/>Gemini · Ollama · extractive"]
    end

    db[("Postgres 17 + pgvector<br/>HNSW cosine · GIN tsvector")]
    corpus["data/corpus<br/>123 markdown files"]

    chat --> guards
    search --> guards
    dash --> guards
    guards --> ask
    guards --> srch
    guards --> ingest
    mcp --> srch
    mcp --> ask
    ask --> srch
    ask --> llm
    srch --> embed
    ingest --> embed
    srch --> db
    ingest --> db
    corpus --> ingest
```

**The central rule: every surface calls the same `packages/core` functions.** The chat page,
the search page, the dashboard and the MCP server all reach retrieval through one `search()`
and one `ask()`. MCP is a transport adapter — `apps/mcp/src/tools.ts` restates nothing about
ranking, the no-answer guard or citation validation, and its `search_documents` tool takes
`SearchRequestSchema` *verbatim*, the same Zod object `/api/search` validates against. Search
is exposed as an MCP tool architecturally rather than by duplication: the two surfaces
cannot disagree, because there is only one implementation.

```
.
├── apps/
│   ├── web/                  Next.js 16 App Router — UI + API routes + Auth.js
│   └── mcp/                  MCP server (stdio + Streamable HTTP, bearer auth)
├── packages/
│   ├── core/                 ingestion, retrieval, RAG, eval — no Next, no React
│   │   ├── src/embeddings/   EmbeddingProvider seam (local BGE)
│   │   ├── src/ingest/       loader, metadata, chunker, incremental pipeline
│   │   ├── src/retrieval/    vector · hybrid RRF · recency · MMR
│   │   ├── src/rag/          prompt, providers, citation validation
│   │   ├── src/admin/        corpus + analytics queries
│   │   ├── src/eval/         metrics and report renderers
│   │   └── eval/golden.json  the golden set
│   ├── db/                   Drizzle schema, migrations, client, seed
│   └── shared/               Zod schemas — types derived with z.infer
├── scripts/                  ingest · search · ask · eval · test:load · calibrate · shots · test:mcp
└── data/corpus/              the synthetic corpus (committed)
```

`packages/shared` holds the Zod schemas as the single source of truth. The same schema
validates an API request, an MCP tool input and a client form; TypeScript types come from
`z.infer`, so the frontend/backend contract cannot drift.

---

## The corpus

```
data/corpus/
├── (root)               3   company overview, glossary, on-call and escalation
├── api/                 9   Payments API v1 (DEPRECATED) and v2, auth, idempotency, webhooks, errors…
├── policies/            7   refunds, disputes, KYB, transaction monitoring, payouts, retention, PCI
├── runbooks/            7   settlement mismatch, webhook backlog, secret rotation, failover…
├── release-notes/      10   API 2.0 → 2.9, 2026-01 → 2026-10
├── decisions/           8   ADR-001 → ADR-008
├── incidents/           5   dated incident reviews
├── merchants/           8   one profile per merchant
└── settlement-reports/ 66   monthly, per merchant, 2025-11 → 2026-10
```

123 documents, ~21.5k tokens; the largest is 289 tokens. The documents reference each other
consistently: the April 2026 duplicate-payout incident leads to ADR-006, ships in API 2.4,
and appears in three merchants' April reports.

Metadata comes from the path. `settlement-reports/2026-05-brindle-market.md` yields
`docType: settlement-report`, `project: brindle-market`, `period: 2026-05`; incidents and
release notes take only the period, because the slug after their date is not a merchant.
A document is marked `deprecated` when its content says `DEPRECATED`, `deprecated since` or
`superseded by` — never merely "supersedes", which the current v2 could legitimately say.

---

## Design decisions

### Postgres with pgvector, not a dedicated vector database

One database holds documents, chunks, embeddings, the full-text index, users, ingestion runs
and search logs. Hybrid retrieval is a single SQL query joining an HNSW vector index and a GIN
`tsvector` index; a separate vector store would turn that into two round trips and an
application-side join, and add a service to run.

### One document = one chunk, because the corpus was measured

The largest document is 289 tokens. Splitting would fragment already-coherent context, so a
document under 512 tokens is one chunk. The chunker still exists — heading-aware with a
400-token target and 60-token overlap — and applies only above that limit. On this corpus it
never triggers.

The embedded text carries a metadata header that the text shown to users does not:

```
[settlement-report] Settlement Report: Brindle Market, 2026-05
project: brindle-market | period: 2026-05 | status: current

<raw markdown>
```

### The tsvector is built from `embedded_text`, not `content`

The 66 settlement reports draw their highlights from a pool of 14 sentences; the most common
appears in 38 of them. What separates one report from another is the merchant and the month
— which live in the header. Generating the `tsvector` from `embedded_text` puts merchant
slugs, periods, doc types and status into the keyword index at no cost.

### Hybrid retrieval with RRF

Two arms — pgvector cosine (top 20) and `ts_rank` (top 20) — fused with Reciprocal Rank
Fusion, `1/(60 + rank)` per arm. RRF fuses ranks, not scores, so no normalisation is needed.
The keyword arm is plain `websearch_to_tsquery` (AND): an OR fallback was the default on an
earlier corpus and measured worse on this one. +17.4 points recall@1 over vector-only.

### The deprecated penalty is a rank offset, never a score multiplier

Deprecated documents are demoted by **+5 ranks in each arm** — down-weighted, never
filtered, because the correct answer has to be able to say the old version is retired.

A score multiplier would be a filter in disguise. An RRF score is `1/(k + rank)`, so across a
20-candidate pool its whole range is 1/61 to 1/80 — a 1.31× spread. A ×0.6 multiplier is a
1.67× penalty, larger than the range: a deprecated document at rank 1 would fall below every
other candidate. A rank offset is in the unit RRF works in, and it survives a change to the
pool size, which a tuned multiplier would not.

### A recency tie-break for "latest" questions

Ten release notes share one template; so do the twelve monthly reports of each merchant.
"What changed in the latest API release?" is about equally similar to all of them. When a
query says *latest / most recent / newest*, the newest candidate of the same doc type and
merchant takes the position of the highest-ranked one; undated documents keep their place.
Both temporal golden questions move to rank 1. It is a tie-break, not a query-rewriting layer.

### MMR is implemented, measured, and off

Maximal marginal relevance was built for the repetitive reports. At λ0.5 it adds one distinct
merchant to three of four repetitive queries — and it pushes the deprecated v1 out of the top
6, because v1 is near-identical to v2, which is exactly what MMR penalises. It also lowers
MRR. It ships disabled, with its tests and eval variants intact.

Inside MMR, relevance is the fused **rank** normalised to [0, 1], never the RRF score: the
score's ≈0.016–0.033 range against a 0–1 redundancy term would let diversity outweigh
relevance ~30×.

### Refusal is two layers, and the calibration overlaps

**Layer 1** refuses without calling a model when `topCosine` — the best raw cosine anywhere
in the vector pool, not the fused score — is below **0.51**. A threshold on the fused score
cannot work: vector search always returns a rank 1, so the top fused score is ≈1/61 whether
or not the corpus can answer.

The threshold was calibrated, not invented: answerable questions score 0.5709–0.8447,
off-domain ones 0.4284–0.4465, and 0.51 sits in the middle of the gap. But in-domain
out-of-corpus questions score 0.6204–0.7183 — **inside** the answerable range. No threshold
separates them. **Layer 2** handles those: the prompt requires the exact sentence *"The
corpus does not cover this."*, and every citation is validated afterwards. Measured: 3/3
refused, 0 invented citations.

### Citation validation trusts the output, not the model

The answer streams via `streamText`. When it completes, every `[n]` marker is checked against
the passages actually retrieved; markers that do not map to one are stripped. A model that
invents `[9]` when six passages were retrieved cannot get it through. Structured output was
considered and rejected because it cannot stream — the security property never rested on the
output format, only on validating every citation.

### Local embeddings, optional LLM, never a hard failure

Embeddings run locally: `Xenova/bge-small-en-v1.5`, 384 dimensions, via Transformers.js. Queries
carry BGE's instruction prefix and documents do not; dropping it costs 4.4 points recall@1.
Generation is Gemini when a key is configured and **extractive mode** otherwise: ranked
passages with citations, labelled as such. A missing key degrades the answer and never fails
the request.

### Both retrieval arms tie-break deterministically

`ts_rank` ties constantly on template-shaped documents. Without a tie-break, `LIMIT 20` keeps
an arbitrary subset and identical searches return different results between runs. Both arms
tie-break on `source_path` — a property of the corpus, not of the database. Tie-breaking on
the generated chunk id would be stable within one index and change on every re-ingest.


### Authentication and authorisation — three layers

| | `user` | `admin` |
|---|:---:|:---:|
| Chat, search | ✅ | ✅ |
| View dashboard | ❌ | ✅ |
| List / delete documents | ❌ | ✅ |
| Trigger re-index | ❌ | ✅ |
| Search analytics | ❌ | ✅ |

1. **`proxy.ts` gates `/dashboard/*`.** This is UX, not security. A signed-out visitor is
   redirected to sign-in with a callback URL; a signed-in non-admin goes to `/?denied=dashboard`
   rather than to sign-in, because telling someone to sign in when they already are is a lie.
2. **`requireUser()` / `requireAdmin()` as the first statement of every route handler.** This
   is the actual enforcement. It throws, so nothing below it runs.
3. **Server Components re-check with `auth()`** before rendering admin data, so nothing
   admin-only is serialised into a payload for someone who should not see it.

401 (unauthenticated) and 403 (unauthorized) are distinct throughout, in a consistent
envelope `{ error: { code, message } }` with a closed set of codes.

The proof that layer 2 carries the security rather than layer 1: the guarded API routes are
**not covered by the proxy matcher** (`['/dashboard/:path*']`) and still return 401 and 403
correctly. A direct `curl -X DELETE /api/documents/:id` as a non-admin returns 403 **and the
document is still there** — verified against the database before and after, because a 403
returned *after* the row is gone is worse than no check at all.

Two details that were not asked for:

- **Constant-time behaviour on unknown emails.** `authorize` runs bcrypt against a fixed dummy
  hash when the email is not found, so a missing account and a wrong password take the same
  time. Without it, response latency tells an attacker which addresses have accounts.
- **The role narrows fail-closed.** `JWT extends Record<string, unknown>` in `@auth/core`, so
  `token.role` reads as `unknown` regardless of module augmentation. The session callback
  narrows explicitly, and an unrecognised value falls back to `'user'`, never `'admin'`. A
  runtime check on the value that decides access beats a type assertion.

The MCP HTTP transport uses bearer auth with a shared secret, compared in constant time.
It is **not** OIDC — see [Known limitations](#known-limitations).


### The design language: a quiet interface

The UI is deliberately restrained, and the restraint is functional. There is a limestone
ground rather than white, one sage accent used for exactly three things (active navigation,
the primary action, a positive status), a single shadow depth, no gradients, and no emoji.
Technical values — scores, ranks, cosines, paths, timings — are set in mono at 11.5px so they
read as data rather than prose. Body text sits in a 760px reading column.

Two decisions worth defending: **the sources box sits below the answer, not in a side panel**,
because a citation the reader has to look sideways for is a citation they will not check; and
**the answer is not a chat bubble** — the question is, but the answer is a caps `ANSWER` label
over reading typography, because this is a document with sources, not a message between people.

`shadcn/ui` was initialised, inspected, and reverted: its `@theme inline` block redefines the
same token names this palette uses and is appended *after* ours, so it wins. The six
primitives are hand-written against the project's tokens in about 150 lines. Radix earns its place on dialogs and popovers, where focus management and
ARIA are genuinely hard; not on a `<span>` with a border.


---

## Tech stack

| | |
|---|---|
| **Language** | TypeScript 5.9.3, `strict` + `noUncheckedIndexedAccess`, zero `any` (enforced by Biome) |
| **Monorepo** | pnpm 11.22.0 workspaces + Turborepo 2.10.11 |
| **Frontend** | Next.js 16.4.3 (App Router, Turbopack), React 19.2.8, Tailwind CSS 4.3.3 |
| **Database** | Postgres 17 + pgvector 0.8.6, Drizzle ORM 0.45.2, postgres.js 3.4.9 |
| **Embeddings** | `@huggingface/transformers` 4.3.2 — `Xenova/bge-small-en-v1.5`, 384-dim, local |
| **Generation** | Vercel AI SDK 7.0.70 + `@ai-sdk/google` 4.0.47 (Gemini), Ollama, or extractive |
| **Auth** | Auth.js v5 (`next-auth@5.0.0-beta.32`), JWT sessions, bcryptjs 3.0.3 |
| **MCP** | `@modelcontextprotocol/server` 2.4.0 (v2 API — `registerTool`, `serveStdio`) |
| **Validation** | Zod 4.6.7 — one schema per contract, types via `z.infer` |
| **Tooling** | Biome 2.5.9, Vitest 4.1.11 (61 tests), tsx 4.23.12 |

Every dependency is **pinned exactly** — no carets, no tildes. A range lets behaviour shift
underneath you, and anyone cloning later should get the tree that was tested.

---


## Setup

Requires **Node 22+**, **pnpm 11+** and **Docker**. Every command is cross-platform; development
happened on Windows.

### 1. Install

```bash
pnpm install
pnpm test     # 61 unit tests — needs no database and no .env
```

### 2. Configure

```bash
cp .env.example .env          # macOS / Linux
Copy-Item .env.example .env   # Windows / PowerShell
```

Generate `AUTH_SECRET` — this works on every platform and needs no `openssl`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste it into `AUTH_SECRET` in `.env`. **That is the only required value.** Everything else
has a working default, and the app runs end to end with no LLM key at all.

To enable generated answers, set **both** `LLM_PROVIDER=gemini` and
`GOOGLE_GENERATIVE_AI_API_KEY` (a free [Google AI Studio](https://aistudio.google.com/apikey)
key). A key alone does nothing while `LLM_PROVIDER=none`.

### 3. Database

```bash
docker compose up -d          # Postgres 17 + pgvector on localhost:5433
pnpm db:migrate               # schema, extension, HNSW and GIN indexes
pnpm db:seed                  # two demo users
```

Host port **5433**, not 5432, so this never collides with a Postgres you already run. If
5433 is taken too, change both the `ports:` line in `docker-compose.yml` and the port in
`DATABASE_URL`.

### 4. Index the corpus

```bash
pnpm ingest
```

The first run downloads the embedding model (~127 MB, into `.models/`) and indexes 123
documents: **77 s** measured, most of it the one-time download. Re-running with nothing
changed takes **1.0 s** — content hashes are compared and unchanged documents are skipped
without loading the model.

### 5. Run

```bash
pnpm dev                      # http://localhost:3000
```

### Verify it works without the browser

```bash
pnpm test:load                     # assert the corpus loads as expected
pnpm run search "How do I create a payment with the current Payments API, and what happened to /v1/charges?"
pnpm ask "Why were payouts duplicated in April 2026?"
pnpm eval -- --no-llm              # the tables in EVAL_RESULTS.md
pnpm calibrate                     # the refusal-threshold groups
```

`pnpm test:load` runs the loader over `data/corpus` and **exits non-zero** if the counts per
document type, the deprecated set, the merchant slugs or the chunk count are not what the
corpus contains.

> ⚠️ **`pnpm search` will not work — use `pnpm run search`.** `search` collides with a
> built-in pnpm command, so `pnpm search "…"` queries the npm registry and fails with
> `ERR_PNPM_SEARCH_FAILED`. `ingest`, `ask` and `eval` are safe. Flags that pnpm claims need
> `--` first: `pnpm eval -- --no-llm`.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| admin | `admin@demo.local` | `admin1234` |
| user | `user@demo.local` | `user1234` |

---


## API

Every route validates its input with Zod, guards before anything else, and returns
`{ error: { code, message } }` on failure.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/chat` | user | Grounded answer, streamed as NDJSON |
| `POST` | `/api/search` | user | Ranked passages, no model |
| `GET` | `/api/documents` | **admin** | Corpus listing, filtered and paged |
| `DELETE` | `/api/documents/:id` | **admin** | Soft-delete a document and its chunks |
| `POST` | `/api/ingest` | **admin** | Trigger a re-index (202, runs in background) |
| `GET` | `/api/ingest/runs` | **admin** | Ingestion history |
| `GET` | `/api/stats` | **admin** | Corpus and search analytics |

`/api/chat` and `/api/search` are rate-limited per user (token bucket, 10 and 20 requests).

Sign in first to get a session cookie:

```bash
# Retrieval only — no model involved
curl -s -b cookies.txt -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"what does error E4091 mean?","topK":5}' | jq

# A grounded answer, streamed line by line
curl -N -b cookies.txt -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"how do I rotate a webhook signing secret?"}'

# Authorisation: a non-admin cannot delete, and the document survives
curl -s -b user-cookies.txt -X DELETE http://localhost:3000/api/documents/<id>
# → 403 {"error":{"code":"FORBIDDEN","message":"This endpoint requires the admin role."}}
```

`/api/chat` streams newline-delimited JSON rather than using the AI SDK's response helpers,
because citations are validated only once the answer is complete — the response has to carry
a terminal event the model never produced:

```
{"type":"token","value":"To rotate"}
{"type":"token","value":" a signing"}
…
{"type":"done","answer":"…","citations":[…],"grounded":true,"topCosine":0.8447,"threshold":0.51,…}
```

---


## MCP server

The same retrieval, exposed as two MCP tools: `search_documents` (ranked passages, no model)
and `answer_question` (grounded answer with citations).

### stdio — Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "fintech-rag": {
      "command": "pnpm",
      "args": [
        "--dir", "/absolute/path/to/fintech-rag",
        "--filter", "@rag/mcp", "stdio"
      ],
      "env": {
        "DATABASE_URL": "postgresql://rag:rag@localhost:5433/rag"
      }
    }
  }
}
```

`--dir` takes an absolute path, so this works regardless of the client's working directory.
On Windows use a Windows path with escaped separators
(`"C:\\Users\\you\\fintech-rag"`).

Verify it end to end without a client:

```bash
pnpm test:mcp
```

### Streamable HTTP — bearer auth

```bash
pnpm --filter @rag/mcp http     # listens on MCP_HTTP_PORT (default 3333)
```

```bash
# No token
curl -s -i -X POST http://localhost:3333/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# → 401
#   WWW-Authenticate: Bearer error="invalid_token", error_description="Missing Authorization header"

# With the token from MCP_BEARER_TOKEN
curl -s -X POST http://localhost:3333/mcp \
  -H "Authorization: Bearer $MCP_BEARER_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Authentication is implemented against the SDK's `OAuthTokenVerifier` interface rather than as
a hand-rolled header check, so the 401s carry a real RFC 9728 challenge. The secret is
compared in constant time.

**Extending to full OIDC** is two specific changes, and they are small *because* token
verification lives in exactly one class:

1. Replace `StaticTokenVerifier` with one that fetches the provider's JWKS and validates
   signature, `iss`, `aud` and `exp`. `requireBearerAuth` accepts any `OAuthTokenVerifier`,
   so nothing else changes.
2. Mount the SDK's `mcpAuthMetadataRouter` so a client can discover the authorization server
   from the 401 challenge the server already sends
   (`.well-known/oauth-protected-resource`, RFC 9728).

What is missing is an identity provider to verify against, not the wiring.

---


## Evaluation

**26 questions: 23 answerable, 3 out-of-corpus.** Each answerable question has exactly one
document that answers it; 9 target a specific retrieval trap.

| variant | recall@1 | recall@6 | MRR@10 | false refusals |
|---|---:|---:|---:|---:|
| vector-only | 60.9% | 91.3% | 0.736 | 0/23 |
| hybrid RRF · AND | 78.3% | 95.7% | 0.833 | 0/23 |
| hybrid RRF · AND→OR | 73.9% | 87.0% | 0.807 | 0/23 |
| **hybrid AND · recency ← shipped** | **87.0%** | **95.7%** | **0.902** | **0/23** |
| hybrid AND · recency · MMR λ0.5 | 87.0% | 95.7% | 0.891 | 0/23 |

**Refusal: 3/3 correct, 0 invented citations.** The corpus and the questions were written by
the same people, so treat absolute numbers as optimistic and the differences between variants
as the signal. Full tables, the per-question ranks and the diversity measurements are in
**[EVAL_RESULTS.md](EVAL_RESULTS.md)**.

---

## Features

- ✅ Chat with retrieved passages, grounded answers and validated citations
- ✅ Authenticated admin dashboard: corpus management, ingestion observability, analytics
- ✅ MCP server exposing the same search as a tool (stdio + Streamable HTTP, bearer auth)
- ✅ Authentication and role-based authorisation, enforced per route, 401 ≠ 403
- ✅ TypeScript throughout, `strict`, no `any`; shared Zod schemas across the boundary
- ✅ Monorepo with a framework-free core; no logic duplicated between surfaces
- ✅ Responsive at 375 / 768 / 1440
- ✅ Hybrid search with RRF, deprecation-aware ranking and a recency tie-break
- ✅ Incremental self-updating ingestion via content hash (77 s → 1.0 s on a no-op run)
- ✅ Retrieval eval with a golden set, every variant measured
- ✅ Streaming answers (NDJSON, with post-stream citation validation)
- ✅ Runs with no API key

**Deliberately skipped:** user-management UI and cross-encoder reranking — a second model and
hundreds of milliseconds per query, to improve a ranking whose remaining misses are not
reranking problems.

---

## Deployment

Not deployed. That follows from a decision made on purpose, and it is worth being precise
about which one.

**The choice that makes this system run with no API key is the same choice that makes it a
poor fit for serverless.** Embeddings are local: a 127 MB model, executed through
`onnxruntime-node`'s native bindings. On a function platform that is three problems at once.
The weights and the native binaries push the bundle past the size limits those platforms
impose. There is no writable disk outside `/tmp`, so the model cache cannot persist and every
cold start pays for the download again. And `onnxruntime-node` ships prebuilt `.node`
binaries per platform and ABI (`napi-v6/linux/x64`, `darwin/arm64`, and so on), which have to
be traced into the deployment bundle and match the target exactly — something function
bundlers routinely get wrong for native addons.

**Ingestion has the same shape of problem, more bluntly.** A first index takes over a minute on a
clean install. No reasonable serverless timeout accommodates that, and the current design —
`/api/ingest` returns 202 and finishes the work in a background promise — is exactly what a
function platform kills once the response is sent.

So the honest target is not a function platform at all. It is somewhere with **a persistent
disk and a long-lived process**: Railway, Render or Fly.io, running the app as a container.
Postgres would be a managed instance with pgvector — Neon or Supabase both provide it — and
the Drizzle migrations run against either unchanged.

The steps, in order:

1. Provision hosted Postgres with the `vector` extension and point `DATABASE_URL` at it.
2. Run `pnpm db:migrate` and `pnpm db:seed` against it.
3. Index the corpus **once**, from a machine or a one-off job rather than from a request, and
   let the content hashes make every later run incremental.
4. Publish the app as a container, with `.models/` on a mounted volume so the weights survive
   restarts.
5. Keep everything behind the same sign-in — no anonymous access.

Two things would change on the way, and both are already seams rather than rewrites. Ingestion
moves from a background promise to a queue or a scheduled job. And if the deployment ever did
need to be serverless, `EmbeddingProvider` is the interface a hosted embedding API would slot
into — the local model is a choice behind that seam, not an assumption baked through the code.

The MCP HTTP server is a small Node service and deploys the same way, but its bearer auth
should be replaced with the OIDC path above before it is exposed publicly.

---


## Known limitations

**Some questions have dozens of correct answers, and recall cannot score them.** "Which months
had the chargeback ratio below the threshold?" matches most settlement reports. Such questions
are excluded from the golden set and covered by diversity measurements instead — a weaker
instrument that checks the six results differ, not that they are the right six.

**When the AND keyword arm matches nothing, retrieval is vector-only.** Long questions whose
terms never co-occur in one document hit this. The OR fallback that prevents it measured worse
on this corpus, so the silent arm is the accepted trade-off.

**One golden question fails.** "Why were GBP payouts held in August 2026?" ranks the right
incident below 10 in every shipped variant. It is reported rather than tuned around.

**The recency rule knows three words.** *latest*, *most recent*, *newest*. "What happened last
month?" or an explicit date range is not handled; that would need query understanding, which
this deliberately is not.

**Rate limiting is in-memory** and assumes a single instance. Behind more than one process it
becomes per-process, so the effective limit multiplies. Redis or the database would fix it;
the interface is one function.

**Background ingestion assumes a long-lived process.** `/api/ingest` returns 202 and continues
in a background promise. On a serverless platform that promise can be killed when the response
completes. It closes the run in a `finally`, so it would be recorded as `failed` rather than
hanging — but the correct fix is a queue or a cron job.

**The Gemini free tier is rate-limited per day, per model.** A full `pnpm eval` spends three
calls. On exhaustion the API returns 429; switching `GEMINI_MODEL` gets a fresh quota, and the
app degrades correctly — `/api/chat` returns a clean error event with no provider detail
leaked. A 404 on the model id means Google has retired it; `GEMINI_MODEL` is configurable for
exactly that reason.

**MCP auth is a shared secret, not OIDC.** No issuer, no audience, no expiry, no revocation.
Appropriate for a locally-run server on a trusted machine. The two changes that close the gap
are listed above.

**Extractive mode cannot refuse.** With no LLM configured the system returns ranked passages
labelled *"Retrieved passages · no answer generated"*. The cosine guard still fires on
off-domain queries, but recognising an in-domain question the corpus does not answer requires
a model. The UI never presents extractive output as an answer.

---

## Repository documents

| File | What it is |
|---|---|
| [EVAL_RESULTS.md](EVAL_RESULTS.md) | Every retrieval variant measured, including the rejected ones |
| [AI_USAGE.md](AI_USAGE.md) | How AI was used, and — more usefully — everything it and the spec got wrong |
| [CLAUDE.md](CLAUDE.md) | The instruction file the coding agent worked from |
