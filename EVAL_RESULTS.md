# Retrieval evaluation

Every retrieval decision in this repository was measured against a golden set rather than
argued about. This file holds the measurements, including the variants that lost.

```bash
pnpm eval              # every variant + the end-to-end refusal check (3 Gemini calls)
pnpm eval -- --no-llm  # retrieval only, no model calls
pnpm calibrate         # the topCosine groups behind the no-answer threshold
```

All numbers below come from one index built from `data/corpus` (123 documents, 123 chunks).
Both retrieval arms tie-break on `source_path`, so a fresh clone reproduces them exactly.

---

## The golden set

[`packages/core/eval/golden.json`](packages/core/eval/golden.json) — **23 answerable, 3
out-of-corpus.**

- **9 trap questions**, one per retrieval hazard the corpus was built to contain: the
  deprecated v1 / current v2 API pair, three questions whose answer spans 2–3 documents, two
  "latest" questions, an exact identifier, and two questions that only one of 66
  template-shaped settlement reports answers.
- **14 single-source questions** across API references, policies, runbooks, ADRs, incidents
  and merchant profiles.
- **3 refusals**: parental leave, company valuation, and a deliberate near miss — *"How do I
  integrate Apple Pay with the Vantor API?"* — phrased entirely in payments vocabulary.

Two rules:

1. **Every answerable question has exactly one `expected` document.** Questions with dozens
   of equally correct sources ("which months had the chargeback ratio below the threshold?")
   are excluded; recall cannot score them. They are measured for diversity instead.
2. **`supporting` documents are reported separately and never folded into recall**, so the
   headline numbers stay comparable across variants.

> **Bias, stated up front.** The corpus and the golden set were written by the same people.
> Questions written against documents you have read favour what those documents answer
> clearly. Treat the absolute numbers as optimistic; the *differences between variants* are
> the useful signal.

---

## Every variant, same questions, same index

| variant | recall@1 | recall@3 | recall@5 | recall@6 | MRR@10 | false refusals |
|---|---:|---:|---:|---:|---:|---:|
| vector-only | 60.9% | 82.6% | 87.0% | 91.3% | 0.736 | 0/23 |
| hybrid RRF · AND | 78.3% | 82.6% | 91.3% | 95.7% | 0.833 | 0/23 |
| hybrid RRF · OR | 69.6% | 82.6% | 82.6% | 82.6% | 0.780 | 0/23 |
| hybrid RRF · AND→OR | 73.9% | 82.6% | 87.0% | 87.0% | 0.807 | 0/23 |
| **hybrid AND · recency ← shipped** | **87.0%** | **91.3%** | **95.7%** | **95.7%** | **0.902** | **0/23** |
| hybrid AND · recency · MMR λ0.7 | 87.0% | 91.3% | 95.7% | 95.7% | 0.902 | 0/23 |
| hybrid AND · recency · MMR λ0.5 | 87.0% | 87.0% | 95.7% | 95.7% | 0.891 | 0/23 |
| hybrid AND · recency · MMR λ0.3 | 87.0% | 87.0% | 95.7% | 95.7% | 0.889 | 0/23 |
| hybrid AND→OR · recency · MMR λ0.5 | 82.6% | 91.3% | 95.7% | 100.0% | 0.873 | 0/23 |
| hybrid AND · recency · no query prefix | 82.6% | 87.0% | 95.7% | 95.7% | 0.870 | 0/23 |

**Supporting-document coverage** (10 questions have one):

| variant | @3 | @5 | @6 |
|---|---:|---:|---:|
| vector-only | 35.0% | 50.0% | 60.0% |
| hybrid RRF · AND→OR | 55.0% | 65.0% | 65.0% |
| **hybrid AND · recency ← shipped** | 45.0% | **70.0%** | **70.0%** |
| hybrid AND · recency · MMR λ0.5 | 55.0% | 60.0% | 60.0% |
| hybrid AND · recency · MMR λ0.3 | 30.0% | 55.0% | 60.0% |

**Rank of the expected document** on the questions where variants disagree:

| question | vector | AND | AND→OR | AND·rec | AND·rec·MMR.5 |
|---|---:|---:|---:|---:|---:|
| trap-deprecated | 2 | 1 | 1 | 1 | 1 |
| trap-duplicate-payouts | 1 | 1 | 2 | 1 | 1 |
| trap-dispute-refunded | 2 | 2 | 2 | 2 | 4 |
| trap-latest-release | 4 | 4 | 9 | **1** | 1 |
| trap-latest-settlement | 6 | 6 | 10 | **1** | 1 |
| trap-identifier | 2 | 1 | 1 | 1 | 1 |
| single-first-payout-hold | >10 | 4 | 4 | 4 | 4 |
| single-truncated-file | >10 | >10 | 9 | >10 | >10 |

---

## The decisions

### 1. Hybrid RRF over vector-only — taken

+17.4 points recall@1 (60.9% → 78.3%) and +0.097 MRR before any other change. The corpus is
dense with exact tokens — `E4091`, `Idempotency-Key`, `webhookctl isolate`, merchant slugs —
and the vector arm alone ranks the right document second or worse on nine of 23 questions.

### 2. Keyword arm: plain AND — taken; AND→OR fallback — rejected on this corpus

`websearch_to_tsquery` ANDs every term, so a long natural-language question often matches
nothing and the keyword arm goes silent. The fallback form widens to OR when that happens.

On this corpus the widened OR arm is **worse than no keyword arm at all**: it costs 4.4
points recall@1 (78.3% → 73.9%), and on "What changed in the latest API release?" it drags
the right document from rank 4 to rank 9. The silent arm is accepted as the lesser evil —
when AND finds nothing, retrieval is vector-only, which is what the numbers say is better
here. The fallback remains a measured variant (`keywordMode: 'fallback'`).

### 3. Recency tie-break — taken

The ten release notes share one template and the twelve monthly reports per merchant share
another, so "latest" has an answer that similarity alone does not find: rank 4 and rank 6.

When a query says *latest / most recent / newest*, the newest dated candidate of the same
doc type and merchant takes the position of the highest-ranked one. Undated documents keep
their place, so a report can never be lifted over a reference document. "current" is
deliberately not a cue — "the current Payments API" asks for v2 over v1, not for a date.

Both temporal questions move to rank 1: **recall@1 78.3% → 87.0%, MRR 0.833 → 0.902.** The
rule is deliberately generic, but it was designed with these two questions visible, so the
gain is an upper bound on what a fresh question set would show.

### 4. MMR — implemented, measured, **off by default**

MMR penalises a candidate that is too similar to what is already selected. It was written
for the settlement reports, whose highlights repeat verbatim across dozens of files.

| repetitive query | distinct merchants, MMR off | λ0.5 | λ0.3 |
|---|---:|---:|---:|
| chargeback ratio below the monitoring threshold | 4 | 5 | 6 |
| payout lag after the batch window moved | 5 | 6 | 6 |
| `do_not_honor` soft declines recovered on retry | 2 | 3 | 4 |
| `risk-scorer` review queue cleared within 24 hours | 4 | 4 | 5 |

λ0.7 changes nothing at all: related documents sit at 0.85+ cosine of each other, and a swap
needs `Δsim > λ/((1−λ)(n−1))` = 0.123 over a 20-candidate pool. λ0.5 adds one merchant on
three of four queries. In exchange:

- **It removes the deprecated document from the context.** For the v1/v2 question, Payments
  API v1 is near-identical to v2 — exactly what MMR penalises — and drops from position 5 to
  7, outside topK 6. The answer then cannot cite v1 when it says v1 is retired. Preserving
  that is the whole point of down-weighting v1 instead of filtering it.
- MRR 0.902 → 0.891; supporting coverage @5 70% → 60%; "dispute on a refunded payment" drops
  from rank 2 to 4.

One extra merchant in a list of six does not pay for that. MMR is off; the code, its tests
and the λ variants stay so the decision can be re-measured on a different corpus.

### 5. The BGE query prefix — kept

With the asymmetric query instruction: 87.0% / 0.902. Without: 82.6% / 0.870. The model
card's advice holds on this pipeline.

### 6. topK 6 — kept

recall@6 equals recall@8 (95.7%) for the shipped variant; widening the context buys nothing.

---

## Refusal behaviour

Two layers. **Layer 1** is a cosine guard that refuses without calling a model. **Layer 2**
is the prompt instruction plus post-hoc citation validation.

`pnpm calibrate` measured `topCosine` — the best cosine anywhere in the vector candidate
pool, never the fused RRF score — over three groups:

| group | topCosine range |
|---|---|
| 23 answerable golden-set questions | 0.5709 – 0.8447 |
| out-of-corpus, in-domain wording | 0.6204 – 0.7183 |
| unrelated to the domain entirely | 0.4284 – 0.4465 |

**The threshold is 0.51**, the middle of the 0.124-wide gap between "unrelated" and
"answerable", ~0.06 clear of both.

The in-domain out-of-corpus group **overlaps** the answerable range — the Apple Pay question
(0.7183) outscores 13 of the 23 answerable ones. Margin and keyword-hit count were measured
too and overlap as well. No threshold can do this job; raising it would refuse real
questions. Those questions are layer 2's:

| question | top cosine | caught by | citations | answer |
|---|---:|---|---:|---|
| What is the parental leave policy at Vantor? | 0.6204 | layer 2 | 0 | "The corpus does not cover this." |
| What was Vantor valued at in its last funding round? | 0.7144 | layer 2 | 0 | "The corpus does not cover this." |
| How do I integrate Apple Pay with the Vantor API? | 0.7183 | layer 2 | 0 | "The corpus does not cover this." |

**3/3 refused, 0 invented citations**, with `gemini-3.6-flash`. 0/23 answerable questions
were refused by layer 1. Layer 2 requires a model: in extractive mode (no key) the system
returns labelled passages and cannot refuse an in-domain question.

---

## Known limitations of this evaluation

- **One question fails in every shipped variant.** *"Why were GBP payouts held in August
  2026?"* expects the truncated-settlement-file incident, which ranks below 10. The incident
  text says "GBP payouts for the day were held", but other documents about payouts outrank it
  and the AND arm finds nothing for the full question. It is left failing rather than tuned
  around.
- **Recall cannot score many-answer questions**, so diversity is measured separately — a
  weaker instrument: it checks that the six results differ, not that they are the right six.
- **23 questions is small.** One question is 4.3 points of recall@1.
