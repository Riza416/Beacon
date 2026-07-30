/**
 * Starter outline inserted into an empty PRD field by the "Insert starter
 * outline" button. Mirrors the section order of the in-app PRD guide so the
 * two never drift.
 */
export const PRD_STARTER_OUTLINE = `# Title
Plain description of the change — not a codename.

Owner:
Reviewers (by function — engineering, design, compliance, ops):
Status: Draft

## 1. Summary
Three to five sentences: the problem, what we're doing about it, and what
changes as a result. Write this last.

## 2. Problem
Who is hurting, how much, and how you know — ticket volumes, numbers, a
customer quote, a regulatory deadline. Describe today's workflow including the
manual workarounds.

## 3. Why now
What makes this the right thing to do this quarter rather than next year.

## 4. Goals and non-goals
Goals (2-4, as outcomes, not features):
-

Non-goals (adjacent things we are deliberately NOT doing):
-

## 5. Users and use cases
Who this is for, by role and situation. Internal ops and admins count.

As a [role], when [situation], I want to [action], so that [outcome].

## 6. Requirements
Number them so reviewers can say "I disagree with R4". Each one must be
testable — a number, a condition, or an observable behaviour.

Must have
- R1.
- R2.

Should have
- R3.

Won't have (this time)
- R4. ... because ...

Don't forget: failure and timeout states, partial completion, empty/first-run
states, permissions (who sees, who does, who approves), limits (amounts, rates,
retries, timeouts), what gets logged for audit, and what happens to work
already in flight when this ships.

## 7. Out of scope
Work we're not doing now, and why.

## 8. Dependencies and risks
What has to be true for this to work. For each risk: what could go wrong, how
likely, and what we'd do about it.

## 9. Success metrics
For each: what we measure, where the number comes from (name the dashboard or
query), today's baseline, and what good looks like.
- Metric | source | baseline | target
- Guardrail (must not get worse):

## 10. Rollout
Feature flag (name it), who gets it first, how to turn it off, any migration,
and whether users need telling.

## 11. Open questions
Each with a name and a date against it.
-
`;
