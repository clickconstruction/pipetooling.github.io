# Completing a bid's takeoff in CountTooling — twin guide

---
file: docs/twins/COUNTTOOLING_BID_GUIDE.md
type: Twin brief (CountTooling)
purpose: Everything an estimator twin needs to take a bid through CountTooling — what you have access to, the full loop from plans to approved counts, and the exact contracts. Served by twin-mcp as get_ct_guide.
audience: Digital Twins
last_updated: 2026-08-30
---

CountTooling (counttooling.com) is where the takeoff happens: a PDF plan set with
counters (fixture symbols) and lines (pipe runs) drawn on top. Your PipeTooling bid
sends you here at pipeline stage 3; your counts come back to PipeTooling at stage 5.

## What you have access to

- **Your own CT seat**: `twin-<role>-<n>@twins.counttooling.local`, minted with
  `mint_session` (`app: 'counttooling'`) — same per-twin token as everything else.
  Your account wears the 🤖 badge on every surface; own projects only, always.
- **The agent door**: `POST /functions/v1/import-takeoff` on CountTooling with your CT
  session JWT (twin accounts only). You do NOT robot-mouse the canvas — you compute
  placements and import them. Full payload contract: `TAKEOFF_IMPORT.md` in the CT repo.
- **The plan bytes**: PipeTooling's `GET /functions/v1/plan-fetch?bid=<bid>` streams your
  bid's plan set (your `X-Twin-Token` authorizes it; assignment is the grant).
- **The review flow**: your project carries `review_status` — you mark it `ready`, a
  human reviews; `changes` + a note sends it back to you, `reviewed` clears you forward.

## The loop

1. **Start from PipeTooling**: `get_work_state(bid)` — the `ct_takeoff` block lists your
   CT projects with review status; `get_plan_brief(bid)` is the substrate (fixture
   schedule, scales, scope flags). Count what the schedule's tags tell you to count.
2. **Compute placements** in the coordinate contract: canvas pixels in the page's base
   frame (PDF viewport at scale 1, rotation 0); `scale.pixelsPerUnit` is px per FOOT —
   calibrate from a dimension string, never trust a stated scale on a reduced print.
3. **One import call** lands everything:
   `{ name, note, takeoff, pdf_url, pdf_headers }` where
   `pdf_url = https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/plan-fetch?bid=<bid>`
   and `pdf_headers = { "X-Twin-Token": "<your token>" }` — the project arrives WITH the
   plans under your marks (55-page sets are fine; 50 MB cap). Re-import with the same
   name REPLACES the project — that is your fix-and-retry loop, never a duplicate.
   Rejections are 400s that name the exact field; fix what they name.
4. **Flag ambiguities, keep counting**: a note prefixed `RFI:` at the exact spot rides
   the RFI-flags convention into PipeTooling's RFI queue. Never guess a count a plan
   doesn't support — flag it and move on. **Notes contract (Notes ledger)**: on-sheet
   `text` stays SHORT — one line, ≤ ~100 chars (a question for RFIs, a label
   otherwise). Long provenance (trace workflow, gate numbers) goes in the note's
   optional `detail` field — it shows in the reviewer's Notes ledger drawer, never as
   plan-space text. In the app your RFI and detail-bearing notes render as numbered
   pins, so the sheet stays readable. The reviewer resolves/answers RFIs in the
   drawer; `get_work_state`'s `ct_takeoff.notes_ledger` hands the answers back to you
   (`resolved: true` + `answer`) — READ them before re-asking or re-importing.
5. **Mark ready**: with your CT session, call the `set_project_review_status` RPC
   (`p_project_id`, `p_status: 'ready'`). Your project appears in the human reviewer's
   "Ready for review" lane.
6. **Watch the verdict** in `get_work_state`'s `ct_takeoff`:
   - `changes` + `review_note` — the reviewer sent it back; the note says what to fix.
     Fix, re-import (same name), mark `ready` again.
   - `reviewed` — you're clear: bring counts into PipeTooling (Copy to /Tooling in the
     CT app → Counts tab paste import on your bid) and continue the middle
     (takeoff book → labor → draft pricing — see your estimator brief §8).
7. **Stamp the ledger**: a method-less bid note in PipeTooling at every stage boundary
   (imported N marks / marked ready / changes received / counts imported), and
   heartbeat working/blocked/done. A killed run must be reconstructable from
   `get_work_state` + the ledger alone.

## Hard limits (all refusals are loud)

- Twin accounts only; always your own project. You cannot edit, delete, or even see
  other people's projects — a human links or copies what you need.
- PDF: 50 MB, ≤200 pages; page indexes must fit inside the PDF's page count.
- You never mark your own work `reviewed` and never request `changes` — those are
  reviewer (overseer/admin) acts, and the RPC refuses you by name.
- Scoring: any import can be diffed against a reference with the CT repo's
  `takeoff-eval.js` kernel (counts per counter name, feet per line type) — expect your
  M4/M5 runs to be scored with it.
