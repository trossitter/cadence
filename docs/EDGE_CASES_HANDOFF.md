# Handoff: "great" edge-case signals

For Codex. These are the **four** sharp signals that move Cadence from a working
weekly tracker to something 15Five structurally can't do. (A fifth —
over-optimism calibration — was cut; see the bottom.) Each entry says what the
signal *is*, what data we already have vs. must add, the backend change, and
**how to show it** — because an unsurfaced signal is worthless.

Grounding (verified against current code):
- `WeeklyCommitment` (domain + `types.ts`) has: `status`, `confidence` (0–100 —
  **being replaced**, see Model change), `chessLayer`, `weekStart`,
  `lockedAt/reviewedAt/reconciledAt`, `carriedForwardFromId`, `supportingOutcome`,
  owner/manager fields.
- State machine (`WeeklyCommitmentWorkflow.requireTransition`): DRAFT → LOCKED →
  {APPROVED | NEEDS_REVISION} → {RECONCILING} → {RECONCILED | CARRIED_FORWARD}.
  RECONCILED/CARRIED_FORWARD are terminal. `assertEditable` already blocks edits
  unless DRAFT/NEEDS_REVISION.
- `carriedForwardFromId` forms a backward lineage chain (each carry = new row
  pointing at its predecessor).
- RCDO entities (`RallyCry`/`DefiningObjective`/`SupportingOutcome`) currently
  have **only** `id` + `title` — no priority, no active/archived flag.
- The frontend already computes `ownerRollup` (per-owner total/locked/reconciled/
  atRisk) in `app.tsx`. `atRisk` currently keys off `confidence < 70` — it should
  read the new risk ordinal instead.

## Design rule for all four

These are **manager-side exception signals**. Default audience is the **Director
workspace + a weekly exception digest**, not the contributor's own face. The
contributor sees only the non-judgmental version of their own item (e.g. "carried
3 weeks"), never a capacity or calibration judgment. Badges are quiet and
title-case — no large all-caps, color-coded by severity (slate → amber → red).

---

## Model change (prerequisite): confidence → risk ordinal

Replace the numeric `confidence` (0–100) with a three-state **risk ordinal**:
`ON_TRACK | AT_RISK | BLOCKED`.

**Why:** a self-rated 0–100 is subjective false precision (why 70 and not 65?) and
one more number an owner has to invent every week — the busywork-that-feels-
skippable failure that sinks 15Five. Three honest states are easy to set, easy to
read, and enough to drive every risk surface we need.

**Change:**
- Backend: `enum CommitmentRisk { ON_TRACK, AT_RISK, BLOCKED }`; migration replaces
  `confidence integer` with `risk varchar(16) not null default 'ON_TRACK'` (or keep
  `confidence` nullable for one release if you want a soft migration).
- `types.ts`: `risk: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED'` (drop `confidence: number`).
- Form: the 0–100 input becomes a 3-option select. Optional nicety: default to
  `BLOCKED` when a blocker/overdue condition is present.
- Derivations: `summary.atRisk` / `ownerRollup.atRisk` become `risk !== 'ON_TRACK'`
  (or split AT_RISK vs BLOCKED); the demo `demoConfidence` arrays become `demoRisk`.

**Show it:** a small ordinal pill on the row — slate `On track`, amber `At risk`,
red `Blocked`. That's the whole risk UI; no gauges, no percentages.

---

## Sequencing (do these in order)

1. **Model change (risk ordinal)** — small but prerequisite; everything below reads
   it. Do first.
2. **#4 Audit event log — the keystone.** Honest edit history + the reliable lock
   timestamp that #1 detection needs. Build next.
3. **#2 Chronic carry** and **#5 Capacity** — cheap, computable from today's data,
   no schema change. Quick wins, ship alongside.
4. **#1 Outcome deprioritized** — needs the new RCDO active/archived fields.

---

## #4 — Post-lock edits are auditable events (keystone)

**Signal:** every status transition and post-lock change is a recorded event, not
a silently-overwritten timestamp. Today, `lockedAt/reviewedAt/reconciledAt` are
single columns overwritten on each pass; a lock→reopen→relock leaves no trace.

**Data:** new table.
```sql
-- V3__commitment_audit_events.sql
create table commitment_audit_events (
  id uuid primary key,
  commitment_id uuid not null references weekly_commitments(id),
  actor_subject varchar(255) not null,
  actor_name varchar(255) not null,
  from_status varchar(32),
  to_status varchar(32) not null,
  changed_fields jsonb,                  -- {field: [old, new]} for edits
  occurred_at timestamptz not null
);
create index idx_audit_commitment on commitment_audit_events(commitment_id, occurred_at);
```
**Backend:** in `WeeklyCommitmentWorkflow`, append one event on each mutation
(`create/update/lock/review/startReconciliation/reconcile/carryForward/
reopenDraft`). Cheapest implementation: a private `record(commitment, fromStatus,
toStatus, changedFields)` helper called at the end of each method; or a Spring
`ApplicationEventPublisher` if you'd rather decouple.

**Show it:** a small clock affordance on any commitment with >1 event → opens a
right-side timeline drawer (status chips + actor + time, "edited after lock"
highlighted amber). Director drill-down shows the full chain. Contributor sees
their own item's timeline, read-only.

---

## #2 — Chronic carry (3+ weeks)

**Signal:** the same commitment has rolled forward repeatedly — work that never
gets done but never dies.

**Data:** already present. Walk `carriedForwardFromId` backward; depth = ancestor
count. **Default flag: weeksCarried ≥ 2 (i.e. its 3rd appearance).** No schema
change.

**Backend:** add a derived `weeksCarried` (recursive CTE on
`carried_forward_from_id`, or walk in the workflow read path) and expose it on the
current-week DTO. Add `int weeksCarried` + `LocalDate originWeekStart` to the
response model and to `types.ts WeeklyCommitment`.

**Show it:** a chip on the commitment row — `Carried 3 wks` — slate at 2, amber at
3, red at 4+. In the director digest, a "stuck work" list sorted by `weeksCarried`
desc, each with its blocker/reason. This is the single most useful director signal
and it's nearly free.

---

## #5 — Capacity risk (overloaded owner)

**Signal:** one person holds too much heavy work this week.

**Data (decided — count of open items):** load = the number of an owner's
**non-terminal** commitments for the week (status not in {RECONCILED,
CARRIED_FORWARD}). **Default flag: > 6 open items.** No weighting, no new field.
The chess layer is shown alongside for context but does **not** drive the metric —
it encodes importance, not effort.

**Backend:** none required — `ownerRollup` in `app.tsx` already counts per owner;
add an `openCount` + over-threshold flag there. Move to the manager endpoint later
only if you need server-side sorting at scale.

**Show it:** a capacity meter per person in the Director roll-up — a load bar that
turns amber over the threshold, the person's open items listed on hover, each with
its chess layer as a small tag. Surfaces before lock so a director can rebalance.

---

## #1 — Working toward a deprioritized outcome

**Signal:** a commitment is linked to an RCDO outcome that was archived or
downgraded *after* the commitment was created/locked — effort pointed at something
the org no longer prioritizes.

**Data (decided — binary active/archived):** add `active boolean not null default
true` + `archived_at timestamptz` to `supporting_outcomes` (and `rally_cries`, so
a whole branch can be retired). "Downgraded" = archived; no priority rank.

Detection = the linked outcome or any ancestor is now inactive and its
`archived_at > commitment.lockedAt` (or `> createdAt` if never locked). The #4
audit log gives the reliable lock timestamp. Archiving a Rally Cry **cascades** —
every commitment under that branch is flagged.

**Backend:** add the field(s) + a derived `outcomeDeprioritized boolean` (and
optional `outcomeStatusNote`) on the commitment DTO + `types.ts`.

**Show it:** an amber inline badge on the row — `Outcome deprioritized` — and a
callout in the Director coverage view ("3 commitments still target a downgraded
outcome"). This pairs naturally with the coverage-gap / strategic-drift read.

---

## #3 (CUT) — Over-optimism calibration

**Cut.** It depended on confidence being a trustworthy number, and we're replacing
the 0–100 self-score with a 3-state risk ordinal (above). A "locked at ≥80 but
missed" calibration has no meaningful input once the number is gone, and building a
per-person over-commit score on a fuzzy self-rating is noise-on-noise — plus a
calibration scorecard risks exactly the surveillance feel that sinks 15Five. Park
it; revisit only if the risk ordinal ever proves reliable enough to calibrate
against.

Cutting #3 also removes the need for `confidence_at_event` snapshots and the entire
blessed-carry / `actor_is_manager` apparatus — both existed *only* to make #3 fair.
The audit log (#4) keeps its full value without them.

---

## Decisions (resolved — Galadriel)

1. **#1 model — binary active/archived.** No priority rank; archiving cascades
   down a branch.
2. **Audience — director-only.** Capacity (#5) and the exception digest live in the
   Director workspace. Contributors see their own #2 carry and #4 history, framed
   neutrally. Keeps the tool off the surveillance path that sinks 15Five.
3. **Confidence → risk ordinal.** Replace the 0–100 self-score with
   `ON_TRACK | AT_RISK | BLOCKED`. Consequence: **#3 over-optimism calibration is
   cut** (it had no honest input without a numeric confidence).
4. **#5 capacity — count of open items, not chess layer.** Load = an owner's
   non-terminal commitments for the week; flag > 6. No weighting, no new field;
   the chess layer is shown for context only (it encodes importance, not effort).
