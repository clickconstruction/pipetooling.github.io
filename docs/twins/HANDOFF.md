# Digital twins & MCP — operator handoff

---
file: HANDOFF.md
type: Handoff / State of the program
purpose: Everything a new operator needs to take over the digital-twins program — what is live, how to run it day-to-day, where the secrets live, and the prioritized open threads (including the agent-dashboard/RFI roadmap that previously existed only in a chat session)
audience: The incoming twins operator (a dev), AI agents
last_updated: 2026-08-28
key_sections:
  - name: "What is live today"
  - name: "Day-to-day operation"
  - name: "Secrets & access"
  - name: "Open threads, prioritized"
  - name: "Gotchas that will bite"
---

Written 2026-08-28, the day the program shipped end to end. Read
`DIGITAL_TWINS_PLAN.md` first for the locked owner decisions (estimator-only,
one-directional fence, assignment-is-the-grant, drift caught not prevented); this doc
is the *current state* on top of that plan.

## What is live today (all in prod)

- **Twin identity**: `users.is_digital_twin` (PT) / `profiles.is_digital_twin` (CT);
  🤖 banner in the app; `?as=twin:<role>[:n]` dev-login alias.
- **Write fence** (migration `20260828070000`): RESTRICTIVE policies on every RLS
  table — a twin writes only its own bids (creator or assigned estimator — assignment
  IS the grant), bid-child tables, and help_feedback. Rung 1 = `read_only` flag (the
  training-mode block); rung 2 = fenced writes; rung 3 (production) not built.
- **Per-twin credentials** (`twin_credentials`, sha256-hashed, revocable) accepted by
  `twin-login` v2 and required by every `twin-mcp` tools/call.
- **twin-mcp** — the MCP server any agent vendor can hold a seat through
  (`https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/twin-mcp`). Six tools:
  `mint_session` (PipeTooling by default, `app: 'counttooling'` for the takeoff tool —
  one token opens both apps), `get_brief`, `get_directory`, `get_harness_guide`,
  `get_mission`, `submit_report`. No business-data tools by design — work happens in
  the app via the minted browser session.
- **Fleet console** — Settings → System → Digital twins (dev-only): mint twins, issue
  and revoke tokens (shown once), flip safety rungs, endpoints card, CT-seat link
  status + backfill, recent-runs ledger (`twin_runs`).
- **CT↔PT user bridge**: PT is the system of record; twin mints auto-create the
  CountTooling seat; archive/restore mirror across; Monday drift-audit email to devs.
- **Fleet**: `twin-estimator-1@twins.pipetooling.local` (rung 1), CT seat linked.
  Mission **M1 ran and PASSED** (found a real lens bug — see
  `missions/estimator.md` results table). M2/M3 have not run.

## Day-to-day operation

Everything routine happens in **Settings → System → Digital twins** — you need the
`dev` role in the app. Mint a twin, issue it a token, hand the token + the two
endpoint URLs + `TWIN_HARNESS.md` to whoever runs the agent (their agent can also
fetch the docs itself via `get_harness_guide`/`get_brief`). Revoke a token to cut off
one partner; the runs ledger shows every sign-in and report.

Running a mission: give the agent its token, say "run M2" — it fetches the mission
verbatim via `get_mission` and files results via `submit_report`. Score independently
against the verification sections in `missions/estimator.md` (the MCP bundle
deliberately excludes them).

## Secrets & access

- **You don't need any shared secret to operate.** Per-twin tokens are minted in the
  panel by any dev; that is the intended day-to-day path.
- The **master `TWIN_LOGIN_SECRET`** (mints any twin; rotating it is the fleet kill
  switch) and the **CT bridge secret** (`CT_MANAGE_USER_SECRET`) live as function
  secrets, with the only readable copies in the owner's main-checkout
  `.env.twin.local` (gitignored). Ask Robert if you truly need them; rotation:
  `supabase secrets set <NAME>=…` on the respective project. Never store secrets in
  the CountTooling repo (it does not gitignore `*.local`).
- CT project ref `hrqxvfydmvtvwhvefmqc`; PT `yewfzhbofbbyvkvtaatw`. CT migrations
  apply via Supabase MCP `apply_migration` (its `db push` refuses); PT migrations only
  via `db push` after merge — see CLAUDE.md.

## Open threads, prioritized

1. **Run M2** (rung 1, no schema work — just operate the panel and score it), then
   graduate twin-estimator-1 to rung 2 and **run M3** (first fenced-write mission;
   watch the write fence in anger).
2. **The question/RFI primitive → agent dashboard** (owner's long-term direction,
   roadmap agreed 2026-08-28; previously unrecorded):
   1. `twin_questions` table (twin, bid, mission, question, status
      open/answered/forwarded, answer, answered_by) + an `ask_question` MCP tool —
      twins create value even read-only by asking sharp questions when blocked.
   2. `get_answers` MCP tool — agents are stateless between runs; answers must be
      pullable so a blocked twin resumes after the owner rules.
   3. Heartbeat/status on `twin_runs` (current mission, bid, working/blocked/done) so
      "see all my agents running" is a query.
   4. "Draft RFI to GC" — compose from a twin question over the existing
      `bid_gc_recipients` + GC email infrastructure.
   Then the dashboard surface itself: fleet status + question inbox + a Dashboard
   nudge when a twin blocks. Mockup teaser exists in the "Digital Twins Fleet
   Console" artifact (last section).
3. **CountTooling parity, deferred deliberately**: 🤖 banner on CT, CT per-twin
   credentials (today CT trusts the PT-held secret via the two-app mint), a CT app
   directory doc bundled into `get_directory` (today's bundle is PT-centric with a CT
   section in the estimator brief).
4. **Metrics hygiene**: add `AND NOT is_digital_twin` exclusions to company metrics
   as twins start touching more surfaces (usage stats, hours rollups).
5. **Pooled seats** (`twin:<role>:any` allocation) if the fleet grows beyond
   hand-assigned numbers; Phase 2 of the plan (other roles) after the estimator
   sandbox proves out.

## Gotchas that will bite

- **`briefs.ts` is generated.** After editing anything in `docs/twins/`, run
  `node scripts/build-twin-mcp-briefs.mjs` and redeploy `twin-mcp`, or agents keep
  reading the old docs. Missions bundle only the verbatim mission text — never add
  scorer sections above the results table without checking the generator.
- **Function secrets apply on cold start.** After `supabase secrets set`, warm
  isolates keep old values — redeploy the function to force it (bit us on cutover
  day).
- **Re-run the fence after bid-family DDL.** Any migration that CREATEs a table in
  the bid family must end with `SELECT public.apply_digital_twin_write_blocks();`
  (plus the two read-only appliers — house rule).
- **twin_runs note formats are parsed** by `twinConsoleDisplay.ts` (the panel's
  plain-English feed) — if you change what twin-login/twin-mcp write, update the
  kernel and its tests.
- **Scoring stays outside the MCP.** Never hand a twin the verification sections;
  that separation is what makes mission results meaningful.
