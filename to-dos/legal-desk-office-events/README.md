---
name: "Legal desk: the office records what happened"
number: 167
mockup: not required — shipped (v2.5836); the live desk is the picture, the row closes after the live pass
group: gated
status: proposed 2026-10-24 · rank 2 of 10 from the review of the Burd matter (job 891) · built as v2.5836 (all three steps: the form, the documents, Insert the events; migration 20261025120000) · migration pushed and legal-portal redeployed (980 local / 980 remote in `check:migration-drift`, legal-portal current in `check:edge-drift`, 2026-10-26) · owed: a live pass on a ZZ TEST matter
summary: >
  The Timeline (v2.5800) plans what is next and the firm's portal records the firm's acts, but the
  office cannot record something that already happened: a notice arriving, a supplier paid, a
  sworn statement signed, a call with the inspector. Add *Record what happened* beside *Plan a
  step*: a day, what happened, notes, and the Evidence documents that prove it. It lands on the
  Timeline as an event, and the narrative can list the events instead of retyping them.
next: Migration pushed and legal-portal redeployed (`npm run check:migration-drift` read 980 local / 980 remote and `npm run check:edge-drift` read legal-portal current on 2026-10-26); then the live pass. Delete this to-do after it.
size: S to M (the RPC exists; a form, a kind decision, a document link)
blocker: None — the owner picked a new `event` kind on 2026-10-25; the day may be before the matter existed (built that way, no one asked otherwise).
opinion: built — five events on job 891 went in as planned steps marked done after the fact
---

# Legal desk: the office records what happened

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 2.

## What happened on job 891

The events of 2026-10-22 and 23 belonged on the record: the GC's notice arriving, the supplier's
job account paid in full, and three more. The office had nowhere to put them. They went on the
Timeline as planned steps dated on their real day and marked done that day, each noting *Entered
after the fact on Oct 24*. The narrative's *What happened* list carries the same events again as
prose.

## What exists today

- `legal_add_entry` (`supabase/migrations/20260911195745_legal_matters.sql`) writes any kind the
  CHECK allows for an office role, and the CHECK (`supabase/migrations/20261023195135_legal_plan_items.sql`)
  already allows `step` and `note`.
- Only the firm writes `step` today, through `supabase/functions/submit-legal-portal/index.ts`
  (`via_portal = true`). No office screen writes `step` or `note`.
- `buildLegalTimeline` in `src/lib/legal/legalTimeline.ts` already draws every entry that is not a
  plan as *happened*; `src/components/jobs/legal/LegalTimelinePanel.tsx` has the *Plan a step*
  form.

## The proposal

*Record what happened* on the Timeline tab, beside *Plan a step*: a day (not ahead of today), what
happened, notes, and a picker of the matter's Evidence documents. It writes an entry the Timeline
draws on its day with the office as its source, and the firm reads it unless held, the same way a
planned step is held. The narrative editor gets *Insert the events*, which pastes them as a dated
list under *What happened*.

*Mark done* on a planned step stays as it is. This form is for what was never planned.

## Open decisions

- Which kind: reuse `step` with `meta.source = 'office'` (the portal already words it as a step),
  use `note`, or add `event`. Reusing `step` needs no migration but puts the firm's acts and ours
  under one word.
- Whether an event may be dated before the matter existed (job 891's story starts months before
  its matter did).

## Where it plugs in

Existing: the RPC, the CHECK, the Timeline kernel and panel, the planned step's hold. New: the
form, the documents in `meta.document_ids`, the kind's words for the office and the firm, *Insert
the events*.

## Plan

1. The form and the write, with the kind as decided. S.
2. Documents on an event, opening from the Timeline. S.
3. *Insert the events* in the narrative editor. XS.

## How to verify

On a ZZ TEST matter, record an event dated last week with one document. It sits on that day, opens
its document, shows on the firm's portal unless held, and *Insert the events* puts it in the
narrative.
