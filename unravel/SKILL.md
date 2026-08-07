---
name: unravel
description: Review whether a codebase feature is over-engineered. Use for read-only review of suspected excess — layers, factories, or strategies; DTO/BO/VO conversion chains; caches, queues, or locks; generic frameworks or registries; speculative future-proofing. Work from repository evidence, ask only decision-changing questions, and leave the code unchanged.
compatibility: Requires access to search and read the target repository. Git history, tests, issues, and architecture documents improve confidence but are optional.
metadata:
  version: "2.0.0"
---

# Unravel

Unravel one feature at a time to determine whether each important source of complexity earns its place.

This is a **read-only analysis skill**: return findings and verdicts; keep source, configuration, and tests unchanged. Implementation, if wanted, is a separate follow-up task.

Work **repository-first**: reconstruct intent from code, tests, configuration, documentation, issues, and git history. Ask the user only about decision-changing unknowns the repository cannot answer.

## Core principle

> Complexity must earn its place.

The target is proportionate design, not minimal code. Complexity pays when it serves a real requirement, constraint, observed variation, safety property, or operational need.

## Two axes of judgment

Keep these separate; mixing them manufactures false confidence.

**Requirement timing** — when a requirement lands:

- **Current** — behavior the system must support now
- **Confirmed** — scheduled or documented near-term change
- **Speculative** — possible future scenario without concrete commitment

**Element verdict** — whether one design element earns its place:

- **KEEP** — evidence supports the complexity
- **DEFER** — the boundary is sound, but the full mechanism can wait for real variation
- **SIMPLIFY** — a materially simpler design preserves current and confirmed requirements
- **UNRESOLVED** — repository evidence is insufficient

## Workflow

### 1. Define the review boundary

Identify the feature or user-visible behavior, its entry points, main execution path, persistence and external-system boundaries, and the expected review output.

Search the repository for candidate boundaries. If exactly one coherent feature matches the request, state it and proceed. If several match and the choice changes the verdict, ask the user to pick. Otherwise choose the narrowest boundary that still traces end to end — state it instead of silently expanding.

### 2. Reconstruct the requirement baseline

Classify each requirement by timing (Current / Confirmed / Speculative) using repository evidence:

- tests and acceptance cases
- issue or ticket references
- API contracts and schemas
- configuration and deployment files
- git history and recurring changes
- comments that explain non-obvious constraints

Speculative requirements never justify complexity on their own.

### 3. Trace the feature end to end

Build a compact feature map:

```text
entry point
  -> orchestration
  -> business rules
  -> persistence or external calls
  -> observable result
```

Record only complexity relevant to this feature:

- layers and indirections
- interfaces and implementations
- factories, strategies, registries, plugins, or rule engines
- object transformations
- asynchronous boundaries
- caches, queues, locks, distributed transactions, or services
- configuration-driven behavior
- shared frameworks introduced by the feature

Cite exact files, symbols, or call paths for every material observation.

### 4. Build the complexity ledger

For every material design element, record:

| Question | Required evidence |
|---|---|
| What present problem does it solve? | Requirement, constraint, repeated variation, or measured failure |
| Why is a simpler design insufficient? | Concrete lost behavior, quality, safety, or operability |
| What does the complexity cost? | Extra concepts, touchpoints, runtime boundaries, dependencies, or debugging effort |
| Is it used today? | Multiple real variants, active configuration, production load, or confirmed roadmap |
| Which requirement timing does it serve? | Current / Confirmed / Speculative |

Then assign the element verdict (KEEP / DEFER / SIMPLIFY / UNRESOLVED). An UNRESOLVED element stays unresolved; it never becomes a confident finding.

### 5. Run the four tests

Apply every relevant test. Mark one `Not applicable` only with a concrete reason (e.g. no operational mechanism exists to scale-test).

#### A. Variation test

Check whether the abstraction represents real variation.

A single implementation is a warning, not proof. Keep it when it forms a real boundary: third-party adapter, framework port, generated contract, test seam, security boundary, or platform extension point.

#### B. Routine-change test

Simulate one likely change grounded in the feature — adding a field, adding a state, changing a validation rule, supporting a second provider, adding a query condition — and estimate the files, concepts, registrations, mappings, and deployment components that must change.

#### C. Deletion test

For each questionable layer or mechanism, ask:

> If this were removed or inlined, what present capability or quality would be lost?

A deletion candidate is stronger when behavior, testability, reliability, and confirmed extensibility survive the thought experiment.

#### D. Scale-and-risk test

Require concrete evidence before operational complexity earns its place: caching, queues, sharding, distributed locks, microservices, rule engines.

Qualifying evidence: production metrics, load tests, explicit SLA/SLO, failure-isolation requirements, regulatory, security, or transaction constraints, recurring incidents. Hypothetical growth ("users may grow later") does not qualify.

### 6. Resolve decision-changing unknowns

Ask the user only when an unknown is both unanswerable from repository evidence and capable of changing an element verdict, the overall verdict, or confidence.

- Ask at most 1–3 concrete questions at a time, each anchored in cited evidence.
- Decision-changing topics: confirmed second implementations or providers; SLA or peak-load requirements; compliance, security, audit, or tenant-isolation requirements; independent deployment or failure isolation; backward compatibility with external consumers.

Evidence-anchored question:

> `PaymentStrategy` has one implementation and no second provider appears in tests or history. Is a second payment provider already confirmed for the next release?

Weak question (no evidence anchor):

> Why is this so complex?

If the user cannot answer, keep the element UNRESOLVED and adjust confidence or the verdict accordingly.

### 7. Construct the simplest credible alternative

Describe the simplest design that supports current requirements, confirmed changes, and the non-negotiable constraints: correctness, security, authorization, idempotency, transactions, auditability, performance, compatibility, observability, and failure isolation.

Use it as a comparison model, not a coding task. An alternative fails if it merely relocates complexity or drops a safeguard.

### 8. Reach a verdict

Roll the element verdicts up into one overall verdict:

- **KEEP** — complexity is proportionate and evidence-backed across the material elements
- **SIMPLIFY** — current complexity costs more than it returns
- **DEFER** — the boundary should stay, but the full mechanism waits for real variation
- **INSUFFICIENT EVIDENCE** — an UNRESOLVED element could flip the verdict and the user cannot resolve it

A feature may mix verdicts across elements. State the dominant overall verdict, then list element-level exceptions.

State confidence:

- **High** — code path, tests/history, and constraints all support the same conclusion
- **Medium** — code evidence is clear, but a business or operational assumption remains unverified
- **Low** — the repository cannot answer a decision-changing question

Mapping rule: Low confidence on a verdict-flipping unknown produces `INSUFFICIENT EVIDENCE`; Low confidence on a peripheral point leaves the verdict intact with its confidence marked.

Use `references/rubric.md` only when the case is disputed, large, or benefits from a numerical red-flag score. The score informs discussion; concrete evidence decides.

## Judgment anchors

- Judge coordination cost and coupling, not file count — many cohesive files can be cheap, and one coupled file can be expensive.
- Before merging look-alike domain, persistence, and API types, check invariants and ownership.
- Treat pattern names as labels, not evidence; only the problem solved here justifies the pattern.
- Read git history for observed change patterns, not future commitments.
- Label speculative savings as speculation.
- Derive alternatives from requirements; microservices, DDD, event-driven designs, and rule engines are options to justify, not defaults.

## Recommendations

Recommendations describe simplifications; they stay analytical. Each one:

1. Preserves externally observable behavior.
2. Prefers reversible changes.
3. Removes one source of indirection at a time.
4. Keeps or adds characterization tests before structural changes.
5. States migration risk and affected callers.
6. Lands in one bucket: safe immediate opportunity, or later redesign.

Scope every recommendation to the feature under review.

## Output

Use `assets/report-template.md` as the default structure, scaled to the feature: a small review may collapse test detail into its findings; a large one keeps every section.

Every finding:

- separates observation from inference
- cites exact files, symbols, or call paths
- states the cost and benefit of the questioned design
- states what would change its verdict

Cut generic advice that does not bear on this feature. Keep the main response concise; attach detail under each finding. Close by confirming the repository is unchanged.

## Final validation

- [ ] Review boundary is explicit.
- [ ] Repository was searched before any user question.
- [ ] Requirements carry timing: current / confirmed / speculative.
- [ ] Feature is traced end to end with cited evidence.
- [ ] Every material element has a ledger entry and an element verdict.
- [ ] Relevant tests ran; skipped tests carry a concrete reason.
- [ ] Decision-changing unknowns are resolved or marked UNRESOLVED.
- [ ] The simplest credible alternative is compared.
- [ ] Overall verdict is KEEP, SIMPLIFY, DEFER, or INSUFFICIENT EVIDENCE, with confidence stated.
- [ ] Repository is unchanged.
