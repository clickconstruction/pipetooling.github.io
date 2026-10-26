---
name: "Legal desk: answer a gap, not only fix it"
number: 192
mockup: mockup.html — before/after of the gaps section, the Answer sheet, the Answered group and the firm-side carry
group: gated
status: proposed 2026-10-26 (the owner's note after the Burd-walk batch retired) · step 1 built as v2.5920 (the table and RPCs, Answer… on every gap, the Answered group, the contract-not-needed auto answer; migration 20261026210000) · step 2 built as v2.5923 (the portal's What the office flagged and already answered, the printed packet's answer lines, Insert the answers in the narrative) · owed: db push + legal-portal deploy after merge, then a live pass on a ZZ TEST matter
summary: >
  Every row under *Before this goes to an attorney* was a computed nag whose only control was a
  door to the surface that would change the fact. A fact that is true and known — the work ran on
  a handshake, there is no paper to record — had nowhere to live, the row nagged forever, and the
  attorney read a hole where the office had an answer. Give every gap *Answer…*: one line stored
  by the gap's own key on the matter, with an Evidence document; an answered note leaves the
  count for an Answered group, a red gap stays red with the answer riding under it, and the
  job's own *contract not needed* mark answers its agreement gap by itself.
next: Push the migration and redeploy legal-portal once the two PRs merge; a live pass on a ZZ TEST matter; then the open decisions below, or delete this to-do.
size: S left (the live pass; the decisions)
blocker: None.
opinion: built — #166's Ours with the owner was the one gap that could already be answered; this is that pattern on every row
---

# Legal desk: answer a gap, not only fix it

## The ask

The owner, 2026-10-26, looking at the desk after the Burd-walk batch (#166–#175) retired: *"I
don't like this 'before it goes to an attorney' section, for example, what if work was done
without a contract, there is no way to list it or fill it in or make sure that was noted in the
narrative."*

## What exists today

- The gaps list computes on every open (`buildLegalPacket` in `src/lib/legal/legalPacket.ts`),
  each row carrying one door (`Contract…`, `Call mode…`, `Edit job…`, `Liens on the job…`).
- #166's *Ours with the owner* (`jobs_ledger.owner_contract_confirmed_at`) is the one stored
  answer — it silences its note and stays.
- The job's *contract not needed* mark (`contract_not_needed_at/reason`, the contract strip's
  *Not needed…*) exists and the desk's agreement gap ignores it.

## The proposal

1. **Answer… on every gap** — one line (≤ 500) plus an optional Evidence document, stored per
   gap key on the matter (`legal_matter_gap_answers`), by and when; Edit and Clear.
2. **Answered is its own group** — out of the to-know-about count, still on the record; a red
   gap stays red with its answer riding under it; the count line reads
   *1 to fix · 4 to know about · 3 answered*.
3. **Auto answers** — *contract not needed* answers `contract:<jobId>` by itself, worded from
   its reason and day; a typed answer on the same key wins.
4. **The carry** (PR 2) — the firm's portal and the printed packet show each answer beside its
   gap, and the narrative editor gains **Insert the answers** beside *Insert the events*.

## Plan

1. The table and RPCs, the kernel fold, Answer… and the Answered group on the desk. M. **Built, v2.5920.**
2. The carry: the portal, the packet print, Insert the answers. S. **Built, v2.5923.**

## Open decisions

- Who may answer: any office role (built), or the collections-note gate.
- Whether an answered red gap softens the packet cover's count line
  (*1 to fix — answered, see the office's answers*).
- Job facts vs matter facts: should `contract:<jobId>`'s answer live on the job and ride onto
  any future matter, the way *contract not needed* does?
- Insert vs always-on: the firm's view shows answers beside gaps (PR 2); is **Insert the
  answers** still wanted for emphasis, or enough on its own?

## How to verify

On a ZZ TEST matter, answer the agreement gap with one line and a document: the row moves to
Answered with the line and the document one press away, and the count line gains *· 1 answered*.
Mark a job contract not needed: its gap answers itself with no Clear. On the firm's portal and
the printed packet the answer reads beside its gap, and *Insert the answers* puts the list in
the narrative.
