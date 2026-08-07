# Unravel Review Rubric

Use this rubric only when the case is disputed, large, or benefits from a numerical red-flag score. It is a discussion aid, not an automatic verdict.

Verdict and confidence rules live in `../SKILL.md`; this file adds only the score.

## Red-flag score

Add points only when repository evidence supports the observation.

| Signal | Score | Evidence examples |
|---|---:|---|
| A mechanism mainly serves speculative future requirements | +2 | comments, unused extension points, no confirmed second variant |
| Interface/factory/strategy abstraction has one real variant and no boundary justification | +2 | single implementation, no adapter/test/platform boundary |
| A routine feature change crosses more than five semantically unrelated touchpoints | +2 | mappings, registries, factories, configs, duplicated edits |
| Operational complexity lacks scale/risk evidence | +2 | queue/cache/lock/service without SLA, load, incidents, or isolation need |
| Object transformations are mechanically isomorphic | +1 | DTO/Command/BO/DO/VO copies with no invariant or ownership change |
| Feature-specific logic was generalized into a framework/platform before repeated use | +1 | generic registry/DSL/plugin model with one consumer |
| Debugging crosses avoidable runtime or discovery boundaries | +1 | event chains, reflection, dynamic registration, async hops |
| No repository evidence explains why a materially simpler design is insufficient | +1 | no tests/docs/history/constraints supporting indirection |

## Interpreting the score

- **0–2:** low overdesign signal; prefer `KEEP` unless stronger qualitative evidence exists.
- **3–5:** review the highest-cost design elements; verdict may be `KEEP`, `DEFER`, or `SIMPLIFY`.
- **6+:** strong overdesign signal; require explicit evidence for the major complexity sources before choosing `KEEP`.

Treat thresholds as discussion prompts, not gates. A single security, correctness, transaction, compatibility, or failure-isolation requirement can justify complexity even with a high score.

## Counter-signals

Reduce confidence in an overdesign finding when the feature shows:

- multiple real implementations with materially different behavior
- repeated historical changes along the same variation axis
- explicit SLA/SLO or production-load evidence
- third-party or platform boundaries that isolate volatility
- security, audit, compliance, idempotency, or transaction constraints
- characterization tests demonstrating subtle behavior
- independent deployment/failure-isolation requirements
- generated or framework-required interfaces/contracts

