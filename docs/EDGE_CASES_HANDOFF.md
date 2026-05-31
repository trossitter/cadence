# Handoff: "great" edge-case signals

For Codex. These are the five sharp signals that move Cadence from a working
weekly tracker to something 15Five structurally can't do. Each entry says what
the signal *is*, what data we already have vs. must add, the backend change, and
**how to show it** — because an unsurfaced signal is worthless.

Grounding (verified against current code):
- `WeeklyCommitment` (domain + `types.ts`) has: `status`, `confidence` (0–100),
  `chessLayer`, `weekStart`, `lockedAt/reviewedAt/reconciledAt`,
  `carriedForwardFromId`, `supportingOutcome`, owner/manager fields.
- State machine (`WeeklyCommitmentWorkflow.requireTransition`): DRAFT → LOCKED →
  {APPROVED | NEEDS_REVISION} → {RECONCILING} → {RECONCILED | CARRIED_FORWARD}.
  RECONCILED/CARRIED_FORWARD are terminal. `assertEditable` already blocks edits
  unless DRAFT/NEEDS_REVISION.
- `carriedForwardFromId` forms a backward lineage chain (each carry = new row
  pointing at its predecessor).
- RCDO entities (`RallyCry`/`DefiningObjective`/`SupportingOutcome`) currently
  have **only** `id` + `title` — no priority, no active/archived flag.
- The frontend already computes `ownerRollup` (per-owner total/locked/reconciled/
  atRisk) in `app.tsx`.

## Design rule for all five

These are **manager-side exception signals**. Default audience is the **Director
workspace + a weekly exception digest**, not the contributor's own face. The
contributor sees only the non-judgmental version of their own item (e.g. "carried
3 weeks", not "you over-commit"). Badges are quiet and title-case — no large
all-caps, color-coded by severity (slate → amber → red).

---

## Sequencing (do these in order)

1. **#4 Audit event log — the keystone.** Unblocks confidence-at-lock snapshots
   (needed by #3) and outcome-change detection (strengthens #1). Build first.
2. **#2 Chronic carry** and **#5 Capacity** — cheap, computable from today's data,
   no schema change. Quick wins, ship alongside.
3. **#1 Outcome deprioritized** — needs new RCDO fields (see open decision).
4. **#3 Over-optimism** — depends on #4's snapshots.

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
  actor_is_manager boolean not null,     -- derives "blessed carry" for #3
  from_status varchar(32),
  to_status varchar(32) not null,
  confidence_at_event integer,          -- snapshot, powers #3
  changed_fields jsonb,                  -- {field: [old, new]} for edits
  occurred_at timestamptz not null
);
create index idx_audit_commitment on commitment_audit_events(commitment_id, occurred_at);
```
**Backend:** in `WeeklyCommitmentWorkflow`, append one event on each mutation
(`create/update/lock/review/startReconciliation/reconcile/carryForward/
reopenDraft`). Capture `confidence_at_event` on `lock` specifically. Cheapest
implementation: a private `record(commitment, fromStatus, toStatus, changedFields)`
helper called at the end of each method; or a Spring `ApplicationEventPublisher`
if you'd rather decouple.

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

## #3 — Over-optimism calibration (gentle, manager-only)

**Signal:** a person who repeatedly locks in high confidence but doesn't deliver —
calibration feedback, not a scorecard.

**Data:** needs confidence-at-lock, which today is mutable and reset to DRAFT on
edit. **Depends on #4** (`confidence_at_event` on the lock event). "Missed"
(decided): ended `NEEDS_REVISION`, or ended `CARRIED_FORWARD` **only when the
carry was not blessed**; `RECONCILED` = met; **blessed carries are excluded
entirely** — neither hit nor miss.

**Blessed carry = derived, not declared.** A carry is blessed when the
`CARRIED_FORWARD` audit event's `actor_is_manager` is true (a director rolled it),
or the commitment carried an `APPROVED` managerReview. No approval screen, no
extra click — it falls out of the #4 event log. (If #3 is built before #4, add a
`carried_by_manager boolean` to `weekly_commitments`, set from `actor.manager()`
in `carryForward()`, as a standalone equivalent.) Rationale: counting every
rollover as a miss punishes honesty and pushes people to silently re-draft instead
of carrying forward truthfully — re-creating the performative behavior Cadence
exists to kill.

**Backend:** per owner, over a trailing window (**default 8 weeks, min 4 samples**),
compute: among commitments locked at confidence **≥ 80**, the fraction that ended
missed. Expose as `calibration: { sample, highConfidenceMissRate }` on the owner
roll-up.

**Show it:** a quiet dot/tooltip beside the owner in the Director roll-up only —
"tends to over-commit (5/6 high-confidence items slipped)". Never punitive, never
shown to peers. Suppress entirely below the min sample.

---

## Decisions (all resolved — Galadriel)

1. **#1 model — binary active/archived.** No priority rank; archiving cascades
   down a branch.
2. **Audience — director-only.** #3 calibration and #5 capacity appear only in the
   Director workspace. Contributors see their own #2 carry and #4 history, framed
   neutrally. Keeps the tool off the surveillance path that sinks 15Five.
3. **#3 "missed" — blessed carries excluded, derived not declared.** Blessed = the
   carry was made by a manager (`actor.manager()`) or the commitment had an
   `APPROVED` managerReview; no approval ritual. Reasoning: punishing honest
   rollovers re-creates the performative behavior Cadence exists to kill.
4. **#5 capacity — count of open items, not chess layer.** Load = an owner's
   non-terminal commitments for the week; flag > 6. No weighting, no new field;
   the chess layer is shown for context only (it encodes importance, not effort).
