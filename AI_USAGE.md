# AI usage

This project was built with Claude Code as a pair. I specified each phase, reviewed each
result, and approved or rejected every deviation. It was built in two phases:

1. **The system itself**, in two days, against a private document corpus that cannot be
   published.
2. **The migration to this repository**: a synthetic fintech corpus written for it, a new
   golden set, and every measurement redone. Nothing measured on the first corpus is quoted
   here as a result.

The most useful section is the second one. A log that only records what worked says nothing
about how the work was actually steered.

---

## How it was used

**I wrote the specification, the assistant wrote most of the code.** The instruction file the
assistant worked from is committed as [CLAUDE.md](CLAUDE.md): architecture, pinned dependency
table, retrieval SQL, and the working rules — one phase at a time, stop at checkpoints, ask
before deviating, verify before asserting, read type definitions instead of guessing.

| | |
|---|---|
| **Mine** | Architecture and monorepo layout; the retrieval traps and what to do about each; hybrid + RRF as the design; the data model; three-layer authorisation; the design language; the fictional company and the shape of the corpus; every phase boundary and every approval of a deviation |
| **Assistant's** | Essentially all of the implementation, the SQL, the components, the tests, the measurement scripts, the corpus text — and most of the corrections to my own specification |
| **Rejected** | Per-document deduplication as a diversity fix (a no-op when one document is one chunk); `shadcn init`; broadening the deprecation signal; tuning the retrieval around the one golden question that still fails |

Three rules did most of the useful work:

1. **Verify before asserting.** No claim about behaviour without having run it.
2. **Read the installed type definitions, never write from memory.** Two packages in this
   stack changed names and APIs recently; memory would have been confidently wrong.
3. **Ask before deviating.** Every departure from the spec below was raised with numbers and
   waited for approval.

---

## Where the AI and the spec were wrong, and how it was caught

### Building the system

**1. The same wrong mental model, twice, in my own spec.** I specified the deprecated penalty
as `score × 0.6` and a no-answer threshold on the fused score. Both treat an RRF value as if
it carried magnitude. It does not: across a 20-candidate pool the whole RRF range is 1/61 to
1/80, a 1.31× spread, so a ×0.6 multiplier pushed the deprecated document out of the pool
entirely — a filter wearing a down-weight's clothing. And the top fused score is ≈1/61 for
every query, answerable or not, so a threshold on it cannot detect anything. Caught by
measuring on the real index. The penalty became a +5 rank offset; the guard moved to raw
cosine taken across the whole vector pool. A third instance of the same error was avoided in
MMR by using the normalised rank as relevance.

**2. A regex that would have inverted the deprecation trap.** A looser `/supersede/` pattern
would have marked the *current* document deprecated, because it says it supersedes the old
one. A unit test pins the narrow form.

**3. An "improvement" that was a measurement artefact.** `ts_rank` ties constantly on
template-shaped documents, and without a tie-break `LIMIT 20` kept an arbitrary subset, so
identical searches returned different results between runs. A comparison between two
variants briefly showed a gain that was noise. Both arms now tie-break deterministically.

**4. A 200× performance bug only a batch of queries could expose.** The embedding provider
was created per call, and the model pipeline is cached on the instance, so every search
re-initialised the model: ~20 ms reused against several seconds fresh. The eval's sequential
queries made it obvious; a single manual search never would have. The provider is memoised on
its resolved configuration.

**5. An eval baseline that measured the wrong thing.** Variants that omitted `mmr` inherited
the application default once it flipped, so the row labelled "no MMR" ran MMR. Every variant
now states every option explicitly — a measurement harness must never read application
defaults. (That rule paid off again in the migration, below.)

**6. A dead model id that `ListModels` still advertised.** The Gemini model in my spec
returned 404 "no longer available to new users" while still appearing in the model listing.
Model ids are now verified with a real `generateContent` call, and `GEMINI_MODEL` is
configurable.

**7. The MCP SDK's v1 API would have been written from memory.** `@modelcontextprotocol/sdk`
is v1; v2 is `@modelcontextprotocol/server` with `registerTool`. Confirmed from `npm view` and
the installed `.d.ts` files before any code was written.

**8. `shadcn init` quietly destroyed the design tokens.** Its `@theme inline` block redefines
the same token names as this palette and is appended after it, so it wins. Reverted; the
primitives are hand-written.

**9. Framework knowledge that was stale — mine, not the model's.** A test route in a folder
starting with `_` did not exist (Next treats it as private); `middleware.ts` is `proxy.ts` in
Next 16; Biome 2 changed its ignore syntax. The tooling said so each time.

**10. A bug only `next build` could find.** Relative imports with `.js` extensions are correct
for `node16` resolution and break Turbopack. `dev` and `tsc` passed; `build` failed with a
misleading error. The acceptance criteria say `pnpm build`, not `pnpm dev`.

**11. A filter the schema promised and the core ignored.** `docType` and `project` were
declared in the request schema, accepted by the API — and silently dropped by core. It
surfaced when a second surface (MCP) called the same function. Both filters now apply inside
each RRF arm, before ranking.

**12. Defects only a clean clone could find.** A unit test that needed a database because of
an import chain; a tie-break on generated chunk ids, which reproduced different numbers after
every re-ingest; and setup timings measured on a machine that already had the model cached.

### Migrating to the synthetic corpus

**13. The deprecation detector constrained the corpus text.** The marker regex is
case-insensitive, so *any* document using the word "deprecated" would be marked deprecated
and demoted. Writing rule adopted before any document was written: only Payments API v1 may
use "deprecated" or "superseded by"; release notes say "retired" or "sunset". Verified with a
grep over the corpus and by `pnpm test:load`, which asserts the deprecated set.

**14. The report generator contradicted the corpus timeline.** One shared settlement-report
sentence says payout lag held "after the batch window moved to 02:00 UTC" — a change made in
March 2026. The generator put it in reports from 2025. Caught by reading generated samples
against the ADR, not by any test; the sentence is now excluded before March 2026.

**15. A clean-history mistake avoided.** The copied code still carried the old corpus's names
and numbers. Committing it as-is would have put them into the history of a public
repository. Commits were held until the code was clean, and the documents that still needed
rewriting were left out of the early commits.

**16. Defaults tuned on one corpus did not transfer.** The AND→OR keyword fallback had been
free on the first corpus. Here it cost 4.4 points recall@1, because the widened OR arm is
noisier than having no keyword arm. The default is now plain AND.

**17. A trap broken in a way the headline metrics could not see.** With MMR on, the deprecated
Payments API v1 dropped out of the top 6 for the v1/v2 question: it is near-identical to v2,
which is what MMR penalises. Recall stayed perfect because v1 is a *supporting* document, not
the expected one. Caught by reading the actual ranked list while writing the README's
screenshot caption. MMR is now off by default; with it off, v1 sits at position 5.

**18. The calibration measured a different set than the eval.** The threshold script had its
own five hard-coded questions. It now reads the golden set, so the threshold is calibrated on
the 23 questions the eval scores.

**19. An API key that did nothing.** The first end-to-end refusal check ran in extractive mode
with a key in `.env`, because `LLM_PROVIDER` was still `none`. The tell was the extractive
banner in the eval's answer column. The README now says both values must be set.

**20. My own write-up miscounted.** A draft of EVAL_RESULTS said the Apple Pay question
outscores 17 of 23 answerable questions; it is 13. It said vector-only misranks six questions;
it is nine. Both recounted from the raw output before committing.

### After publication

**21. A scan report that undercounted by an order of magnitude.** An external scanner flagged
two advisories in one dev dependency. `pnpm audit` found 72, six critical — five in the
pinned Next.js, including unauthenticated remote code execution, plus one in Express under
the MCP HTTP transport. The brief's own instruction, `npm audit`, could not run at all: this
is a pnpm repo and npm needs its own lockfile. The scoped fix was committed first; the wider
upgrade waited for approval because it changed the pinned versions in this file.

**22. A transitive fix pnpm would not apply.** `pnpm update --depth Infinity` cleared every
other transitive advisory but left `vite` at the vulnerable 8.2.1, though `vitest` accepts
the patched release. Adding it as a direct dependency and removing it again re-resolved it
without an `overrides` entry. The last advisory could not be fixed that way: `drizzle-kit`
still depends on the retired `@esbuild-kit` loader, which pins esbuild 0.18, and no release
of `drizzle-kit` drops it. I first called an override not worth it — without having tried
one. A scoped override to the esbuild `drizzle-kit` already uses was then tested against a
baseline: `generate` and `migrate` passed before and after, and a throwaway schema column
produced the correct `ALTER TABLE`. `pnpm audit` now reports zero advisories.

**23. A runtime bump that could have silently changed the index.** Transformers 4.3 brings a
new ONNX runtime. A fresh clone would embed every document with it while the eval numbers
were measured with the old one. Before trusting the eval, all 123 stored vectors were
re-embedded and compared: minimum cosine 1.000000. The eval then reproduced EVAL_RESULTS
exactly.

---

## How non-obvious decisions were verified

**Nothing in the dependency table was trusted.** `npm view` was run against every questionable
package. Two pins are deliberately behind `latest` with reasons recorded: TypeScript 5.9.3 and
`@types/node` matching the Node 22 runtime.

**Library APIs came from `node_modules`, not memory.** Reading drizzle's `vector` column
definition showed it serialises embeddings itself, so the planned `pgvector` package was
dropped — and that the serialisation runs only on the query-builder path. Hybrid retrieval is
a raw `sql` template, so the query vector is stringified and cast explicitly.

**The tsvector decision was proved.** Indexing `content` alone leaves merchant slugs and
periods out of the keyword index; `embedded_text` puts them in. Golden questions that hinge
on one report out of 66 are answered at rank 1.

**The refusal threshold was calibrated across three groups**, and the uncomfortable result —
in-domain out-of-corpus questions overlap the answerable range — was reported rather than
papered over. The design is two layers, and layer 2 was verified with a live model: 3/3
refused, 0 invented citations.

**Authorisation was verified against the database.** A 403 returned *after* a row is deleted
is worse than no check. Row state was captured before and after a forbidden `DELETE`.

**Responsiveness is evidence, not a claim.** A Playwright script signs in, asks a real
question and captures every page at 375 / 768 / 1440.

---

## What I would do differently

**Write the eval first.** It found a performance bug, a determinism bug and two wrong
defaults — none of them eval-shaped problems. It is the instrument that makes everything else
visible.

**Read ranked lists, not just metrics.** The MMR regression was invisible in recall because
the document it removed was "supporting". Aggregates hide exactly the per-query behaviour a
trap is designed around.

**Treat "the spec says so" — and "it worked last time" — as hypotheses.** The most valuable
corrections were the ones where a number contradicted my instructions, or where a default
measured on one corpus failed on the next.
