import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'
import { BRIEF, DIRECTORY, HARNESS, CT_GUIDE, TT_GUIDE, PLACEMENT_GUIDE, PRICING_GUIDE, MISSIONS } from './briefs.ts'
import { callTtManageUser, ttBridgeConfigured, ttTwinEmail } from '../_shared/ttBridge.ts'
import { todayYmdInAppTz, ymdAddDays } from '../_shared/appTimeZone.ts'
import { classifyTwinQuestionAudience, isTwinQuestionAudience } from '../_shared/twinQuestionAudience.ts'
import { checkEstimatorQuestionShape, matchRecommended, normalizeTwinQuestionChoices } from '../_shared/twinQuestionShape.ts'
import { PLANS_ASK_DEFAULT_CHOICES, PLANS_ASK_DEFAULT_RECOMMENDED, answerRequestsRerun, classifyTwinQuestionKind, effectiveTwinQuestionKind, isTwinQuestionKind } from '../_shared/twinQuestionKind.ts'

// Digital twins MCP server (docs/DIGITAL_TWINS_PLAN.md; owner-approved 2026-08-28).
// A minimal, dependency-free Model Context Protocol server over streamable HTTP
// (stateless JSON-RPC POST; GET → 405, no SSE — permitted by the MCP spec) so ANY
// MCP-capable agent (Claude, Grok/xAI, GPT, …) can hold a twin seat without a browser
// harness of its own for the setup steps. The WORK still happens in the app UI — this
// server mints sessions and carries documents; it exposes no business data.
//
// Auth: every tools/call requires the per-twin token (X-Twin-Token header, or
// Authorization: Bearer <token>) — the same credential twin-login v2 accepts, resolved
// against twin_credentials (sha256). initialize / tools/list are open metadata.
// mint_session passes the token THROUGH to twin-login so the four account guards, the
// 6/min rate limit, and the twin_runs mint log all stay single-sourced there.
//
// briefs.ts is GENERATED from docs/twins/* by scripts/build-twin-mcp-briefs.mjs —
// regenerate + redeploy after editing the docs. Missions carry only the verbatim
// mission text (never the scorer's verification).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-token, mcp-session-id, mcp-protocol-version',
}

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const TOOLS = [
  {
    name: 'mint_session',
    description:
      "Mint a signed-in session for YOUR twin on the deployed apps: PipeTooling (default) or CountTooling (app: 'counttooling' — the PDF-takeoff tool where estimating starts). Returns an action_link — navigate a browser to it and you are signed in (single-use; sessions expire after hours, re-mint then). One credential covers both apps. Rate limit 6/minute across both.",
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', enum: ['pipetooling', 'counttooling', 'takeofftooling'], description: "Which app to sign into (default 'pipetooling'; 'takeofftooling' is the electrical explode-and-cost app — v2.3082)" },
        redirectTo: { type: 'string', description: 'Where to land, e.g. https://pipetooling.com/bids (or a counttooling.com URL with app: counttooling)' },
        run: { type: 'string', description: 'Mission id or label for the fleet ledger, e.g. M1' },
      },
    },
  },
  {
    name: 'get_brief',
    description: 'Your role brief (docs/twins/estimator.md) — read this first: identity, map, permissions, core loops, vocabulary, guardrails.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_directory',
    description: 'The app directory (docs/twins/APP_DIRECTORY.md) — every route, a task→URL index, per-role nav.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_harness_guide',
    description: 'The harness kit (docs/twins/TWIN_HARNESS.md) — auth, session semantics, rules of engagement, safety rungs.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ct_guide',
    description: 'Completing a bid\'s takeoff in CountTooling — your access, the plans→import→review→counts loop, the import contract, and the hard limits. Read before any CountTooling work.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_tt_guide',
    description: "Costing an ELECTRICAL bid in TakeoffTooling (v2.3082) — the explode-and-cost stage between the CountTooling takeoff and PipeTooling's counts: your TT seat, the import-manifest door, the review lane, and the exact item/result contracts. Plumbing bids never touch TakeoffTooling. Read before tt_finish_costing.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_placement_guide',
    description: 'The takeoff placement protocol set (docs/twins/PLACEMENT.md + CALIBRATION.md + EXTRACTOR.md) — doorway calibration, counters-first placement, line tracing, registration/snap/density gates, branch sweeps, keyed-note census, printed-total reconciliation. Read before placing or tracing anything.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pricing_guide',
    description: "The pricing robot's brief (Price Matrix PR 3): how a supply-house fixture quote is written — kits by subtotal, carriers on a second sheet, size lists as option groups, printed totals that are not job totals — and how you write it back onto the bid. Read whole before the first next_price_matrix. Pricer keys only.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_component_rules',
    description: 'The rulebook of what belongs to what (a carrier with the wall-hung fixture on the same schedule line), where to look ("see the carrier and drain quote" = the second sheet, same tag), defaults for plan-decided options, and roles a fixture kind must price. Read before structuring a quote; honour every active rule.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'next_price_matrix',
    description: "The pricing dispatcher: claims the OLDEST queued price-matrix request (status queued → working, claimed by you) and returns the bid, the fixture rows as a snapshot (names + counts — the only rows you price) and the quote links to read (1-based sources). One request at a time; never call again until you finish_price_matrix the one you hold. `done: true` = nothing queued. Pricer keys only.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_quote_documents',
    description: "The files behind a request's quote links, page by page. With no `source`: lists every source's files (name, size, readable?). With `source` (1-based, from next_price_matrix): fetches that link through the Drive intake account (a folder's PDFs merged in name order), splits the pages you name into single-page PDFs in the twin-plans-tmp bucket, and returns their URLs with the page count; `embed: true` also attaches up to 3 inline. Start with no `pages` for the count and the first pages, then ask by number until every page is read — including any sheet a quote points at. A 403/404 means the intake account cannot read it: name the house and continue.",
    inputSchema: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'The request uuid from next_price_matrix' },
        source: { type: 'number', description: 'Which quote link, 1-based (omit to list all sources)' },
        pages: { type: 'string', description: "Pages to stage, e.g. '1-6' or '2,5,7' (default '1-8', at most 8 per call)" },
        embed: { type: 'boolean', description: 'Attach up to 3 pages inline as PDF resources' },
      },
      required: ['request'],
    },
  },
  {
    name: 'put_quote',
    description: "One house's quote, structured, onto the bid (bid_quotes source=robot + bid_quote_lines). Lines use the request's fixture row names VERBATIM as `fixture`. A group under one EACH subtotal = one line with component_role 'kit' carrying the subtotal as unit_price_each_cents plus unpriced role lines (bowl, seat, flush_valve, …). A carrier priced on another sheet = a 'carrier' line on the fixture it belongs to. A size list = lines sharing option_group ('size') with option_label each and at most one option_chosen. A part belonging to no row = component_role 'loose'. Every line carries page_ref. `replace: true` rewrites a house you already wrote for this request. Pricer keys only.",
    inputSchema: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'The request uuid' },
        house: { description: 'Source index (1-based), supply house id, or name' },
        lines: {
          type: 'array',
          description: 'The structured lines',
          items: {
            type: 'object',
            properties: {
              fixture: { type: 'string', description: "The request's row name, verbatim (e.g. 'WC1&2')" },
              component_role: { type: 'string', description: 'kit | bowl | seat | flush_valve | carrier | faucet | drain | trap | supply | stops | trim | mixing_valve | accessory | freight | loose | (omit for a plain priced line)' },
              label: { type: 'string', description: "The vendor's description of the part, model numbers included" },
              unit_price_each_cents: { type: 'number', description: 'Cents per each; omit/null for an unpriced kit component' },
              cant_supply: { type: 'boolean' },
              option_group: { type: 'string', description: "Alternatives share a group, e.g. 'size'" },
              option_label: { type: 'string', description: "e.g. '4in'" },
              option_chosen: { type: 'boolean', description: 'True on the option the request row names (at most one per group)' },
              page_ref: { type: 'string', description: "Where it came from — 'p. 3', 'carrier sheet'" },
              alternate_note: { type: 'string' },
            },
            required: ['fixture'],
          },
        },
        valid_until: { type: 'string', description: 'YYYY-MM-DD the quote is good until (48 hours from the quote date if it says so)' },
        freight_cents: { type: 'number', description: 'Order-level freight in cents; omit when not stated (not stated is not free)' },
        quoted_by: { type: 'string', description: 'The salesperson / writer named on the quote' },
        source_doc_url: { type: 'string', description: 'The link you read (defaults to the source url)' },
        note: { type: 'string', description: 'Quote-level notes — terms, lead times, what the vendor excluded' },
        replace: { type: 'boolean' },
      },
      required: ['request', 'house', 'lines'],
    },
  },
  {
    name: 'finish_price_matrix',
    description: "STG-3: the picks, the asks, the summary. `picks`: one per fixture row you can price — the cheapest COMPLETE kit across houses (a house missing a part is incomplete, never cheapest; expired quotes never win), with `reason` in plain words. `asks`: rows where the plans decide (which carrier variant, which size) — 2–4 short choices + your recommendation; the estimator taps one on Bids → Audits. The request flips to ready and the estimator sees 'Matrix ready · n picks, m to settle'. `blocked: true` instead when you could read no source. Pricer keys only.",
    inputSchema: {
      type: 'object',
      properties: {
        request: { type: 'string' },
        picks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fixture: { type: 'string', description: "The request's row name, verbatim" },
              house: { description: 'Source index, supply house id, or name of the winning quote' },
              reason: { type: 'string', description: "Why — 'cheapest complete kit', 'only house with the carrier', 'NWS expired Sep 4, Ferguson live'" },
            },
            required: ['fixture', 'house', 'reason'],
          },
        },
        asks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fixture: { type: 'string' },
              question: { type: 'string', description: 'One decision, under 320 characters, naming the project and the sheet' },
              choices: { type: 'array', items: { type: 'string' }, description: '2–4 tap labels, each a complete instruction' },
              recommended: { type: 'string', description: 'Your pick, one of the choices' },
            },
            required: ['fixture', 'question', 'choices'],
          },
        },
        summary: { type: 'string', description: 'Two or three sentences for the estimator: houses read, what was priced, what waits on her' },
        blocked: { type: 'boolean', description: 'True when nothing could be read — the request flips to blocked with the summary as the reason' },
      },
      required: ['request', 'summary'],
    },
  },
  {
    name: 'extend_component_rules',
    description: 'Add rules you are confident of to the rulebook, each with where it came from (mirror_note) — the way the bid robot extends its price book. Pricer keys only; the estimator sees them as receipts and can retire one.',
    inputSchema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rule: { type: 'string', description: 'The rule in plain words' },
              kind: { type: 'string', description: 'placement | sheet | option_default | required_role' },
              fixture_pattern: { type: 'string', description: 'Optional: which row names it applies to (case-insensitive substring)' },
              role: { type: 'string', description: 'Optional: the component role it concerns' },
            },
            required: ['rule'],
          },
        },
        mirror_note: { type: 'string', description: 'Where these came from — the quote, page, and what you saw' },
      },
      required: ['rules', 'mirror_note'],
    },
  },
  {
    name: 'get_mission',
    description: 'One mission, verbatim (M1–M5). You receive only the mission text — scoring is done independently.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Mission id, e.g. M1' } },
      required: ['id'],
    },
  },
  {
    name: 'get_assignments',
    description:
      "Bids where YOUR twin is the assigned estimator — your work queue (assignment is the grant: being the estimator is both the permission and the job). Returns bid number, project, GC, due date, status, and which pipeline links are present.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_plan_brief',
    description:
      "The plan substrate for one of your assigned bids: the machine-readable read of the plan set (sheet inventory, fixture schedule, note flags, scale calibrations, reconciliation, scope & risk read). Default returns the rollup brief; full=true returns every per-sheet record. Schema: docs/twins/SUBSTRATE.md.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid number (e.g. 'b403' or 'BP403') or bid uuid" },
        full: { type: 'boolean', description: 'true = full per-sheet substrate, not just the rollup (large)' },
      },
      required: ['bid'],
    },
  },
  {
    name: 'get_work_state',
    description:
      "One composite read of where a bid stands in the pipeline — your resume after any interruption: bid facts, which links are stamped (Drive/plans/CountTooling), substrate version present, counts rows, and the recent bid-note audit ledger. Reconstruct 'where was I, what's next' from this plus the brief.",
    inputSchema: {
      type: 'object',
      properties: { bid: { type: 'string', description: "Bid number (e.g. 'b403') or bid uuid" } },
      required: ['bid'],
    },
  },
  {
    name: 'ask_question',
    description:
      "Park a question instead of stalling — the INTERNAL lane (RFIs to the GC are the external lane, drafted in the app's RFI tab). Two audiences (v1.3.14): audience 'estimator' = a judgment about the JOB (scope, counts, pricing, packages, which sheet governs) — she reads it on Bids → Audits, so write it for her: ONE decision, two sentences, name the project and the sheet, never a run code, table name or tool name. audience 'operator' = the MACHINE is in your way (sandbox, sign-in, the write fence, a table you can't write, a file the service account can't read, a verb that doesn't exist) — pair it with a heartbeat state 'blocked'. A blocker with both halves is TWO questions. Never park a finding or an answer here (that is add_bid_note / submit_report). Omit audience and the text decides. Answers arrive asynchronously: pull them next run with get_answers. Asking is always better than guessing. SHAPE (v1.3.15): an estimator question is REFUSED unless it is ONE decision under 320 characters with `choices` — 2–4 short labels she can tap (≤40 chars each) — and ideally `recommended`, your own pick among them; the refusal names what to fix. A three-part ask is three calls; the working detail (numbers, sheet refs, the pattern) goes in add_bid_note on your shell, not in the question. KIND (v1.3.16): `kind: 'plans'` when what you need is a different or additional plan set on THIS bid (wrong set filed, plumbing sheets missing, a file the intake account can't open) — it goes to that bid's robot needs sheet next to Edit bid and Copy intake address, not to Standing rulings, and gets default taps ('Attached — rerun' / 'Use what is on the bid' / 'Skip this bid') if you give none. Everything else is `kind: 'decision'`. Omit it and the text decides.",
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question, self-contained (a human reads it cold)' },
        bid: { type: 'string', description: "Optional bid it concerns (e.g. 'b403' or uuid)" },
        mission: { type: 'string', description: 'Optional mission/run label' },
        topic: { type: 'string', description: "Standing-rulings key (v2.2939): one kebab slug per doctrine issue — 'travel-bands', 'small-ti-absorption', 'package-boundary' — so duplicate asks collapse into ONE ruling for the estimator. Before parking a doctrine-level question, check get_answers for an existing topic and reuse its slug; leave empty only for genuinely bid-specific asks." },
        audience: { type: 'string', enum: ['estimator', 'operator'], description: "Who answers: 'estimator' (a judgment about the job) or 'operator' (the machine is in your way). Omit and the text is classified — machine vocabulary (sandbox, fence, service account, a table or tool name) routes to the operator." },
        choices: { type: 'array', items: { type: 'string' }, description: "2–4 short answer labels the estimator can tap (≤40 chars each), e.g. ['Residual', 'Higher per-fixture', 'Neither'] or ['Yes', 'No']. REQUIRED for audience 'estimator'; optional for the operator. Her tap is saved as the label, verbatim, so make each label a complete instruction to yourself." },
        recommended: { type: 'string', description: 'Your own pick — must be one of choices. Shown first and filled, so one tap agrees with you. Give it whenever you have a view.' },
        kind: { type: 'string', enum: ['decision', 'plans'], description: "'plans' = you need a different/additional plan set on this bid (always pass `bid`); routed to the bid's robot needs sheet. 'decision' = a judgment for Standing rulings. Omit and the text is classified." },
      },
      required: ['question'],
    },
  },
  {
    name: 'get_answers',
    description:
      'Your questions and their answers (newest first) — check this at the START of every run; an answered question may unblock parked work. Promoted questions carry the RFI number they became. Blind-safe (v2.2868): any item that mentions a reference you currently hold an unsealed shell against comes back redacted, and reappears after that shell is scored — never try to recover a redacted item another way.',
    inputSchema: { type: 'object', properties: { open_only: { type: 'boolean', description: 'true = only unanswered' } } },
  },
  {
    name: 'heartbeat',
    description:
      "Tell the fleet console what you're doing right now: current bid, pipeline stage, and state (working|blocked|done). Send one when you start, when you block (pair it with ask_question), and when you finish. Cheap; send freely.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b403' or uuid), if the work is bid-scoped" },
        stage: { type: 'string', description: "Pipeline stage, e.g. 'STG-3 takeoff'" },
        state: { type: 'string', enum: ['working', 'blocked', 'done'] },
        note: { type: 'string', description: 'One line of detail' },
      },
      required: ['stage', 'state'],
    },
  },
  {
    name: 'file_plans',
    description:
      "File the plans in Google Drive for one of your bids (pipeline STG-1): creates/reuses the job folder in the shared jobs folder, optionally uploads the plan set from a URL, stamps drive_link/plans_link on the bid, and writes the audit note. Idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b403' or uuid) — must be yours (assigned/created)" },
        plans_url: { type: 'string', description: 'Optional URL of the plan-set PDF to fetch into the folder' },
        plans_file_name: { type: 'string', description: 'Optional file name for the uploaded plans' },
      },
      required: ['bid'],
    },
  },
  {
    name: 'submit_report',
    description: 'File your mission report (answer, evidence, stumbles). Lands in the twin_runs fleet ledger attributed to your twin.',
    inputSchema: {
      type: 'object',
      properties: {
        mission: { type: 'string', description: 'Mission id, e.g. M1' },
        report: { type: 'string', description: 'Your full report text' },
      },
      required: ['mission', 'report'],
    },
  },
  {
    name: 'open_backtest',
    description:
      "Open a blind backtest of a human reference bid (pipeline STG-0): creates a 'ZZ Twin <PROJECT> (backtest)' bid owned by and assigned to YOUR twin, copying ONLY the reference's logistics (project name, address, customer, service type, distance, plans link) — never its counts, pricing, value, or outcome, so the blind protocol is structural. Idempotent per reference. Stamps the STG-0 ledger note. Returns a blind-safe reference_grade (A=full scorecard .. D=census-only, X=no plans) computed from field PRESENCE only; quality flags (round value, weak-loss category, staleness) are unseal-time. The reference stays sealed until your STG-6 scorecard stamp.",
    inputSchema: {
      type: 'object',
      properties: {
        reference_bid: { type: 'string', description: "The human bid to re-estimate blind (e.g. 'b370' or uuid)" },
        due_in_days: { type: 'number', description: 'Optional due date offset for the twin bid (default 7)' },
        round: { type: 'number', description: "Re-run round (v2.2800): 2 or higher opens a NEW shell named 'ZZ Twin <PROJECT> (backtest R<round>)' instead of handing back the first round's bid — a scored round-1 shell carries its scorecard and would unblind you. Omit for the first run." },
        gate_run: { type: 'boolean', description: 'HOLDOUT references (reserved for gate measurement) refuse to open unless this is true — pass it ONLY when the operator explicitly ordered a gate run (v2.2952).' },
      },
      required: ['reference_bid'],
    },
  },
  {
    name: 'score_backtest',
    description:
      "STG-6 unseal + scorecard in one call, for a BACKTEST bid you own (v2.2800). Refused unless the bid's ledger already carries a LOCK note — your blind total goes on the record before the reference opens. The seal breaks HERE: the call reads the reference's value, outcome, loss category and sent date, computes delta_pct, the reference quality flags (roundValue, weakLoss, lossUncategorized, stale), the presence grade and gate_eligible, writes the twin_run_scores row the Scoreboard reads, stamps '[STG-6 SCORECARD]' on your ledger, and returns the reference facts. Idempotent per run_label; a second call with the same run_label plus scope_verdict / counts_note / note AMENDS those fields (locked_total never changes).",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your backtest bid (e.g. 'b431' or uuid) — created by / assigned to you" },
        run_label: { type: 'string', description: "Unique run label, e.g. 'R2-BT-3'" },
        axis: { type: 'string', description: "Confidence-scoreboard axis, e.g. 'proto/auto-service', 'small TI', 'institutional'" },
        locked_total: { type: 'number', description: 'Your blind total — must match the LOCK note already on the ledger' },
        counts_note: { type: 'string', description: "Optional one-liner on count accuracy, e.g. 'fixtures 17/19 exact · footage 0.9x'" },
        scope_verdict: { type: 'string', description: "Exactly 'pass' or 'fail' (anything else records as 'unknown'). The scope-match check needs the reference rows, which this call unseals — so first call WITHOUT it, do the line-compare, then call again with the same run_label and the verdict: the row is amended and gate_eligible recomputed (v2.2816)." },
        note: { type: 'string', description: 'Optional one-line lesson for the axis card' },
      },
      required: ['bid', 'run_label', 'axis', 'locked_total'],
    },
  },
  {
    name: 'get_plan_pages',
    description:
      "Hand yourself the plan set, page by page (v1.3.18) — for a harness with no shell (Claude Desktop) that cannot call plan-fetch itself. Pulls the bid's own set through plan-fetch (folders merged, parts joined), splits the pages you name into single-page PDFs in the twin-plans-tmp bucket, and returns their URLs with the page count; `embed: true` also attaches up to 3 of them as PDF resources in this reply. Start with no `pages` to get the count and the first pages, then ask for the sheets you need by number (P-series, schedules, risers). Sheets are drawings: read them as images. Own/assigned bids only; sets over 60 MB are refused (trim and stage_plan_pdf instead).",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b482' or uuid) — own or assigned" },
        pages: { type: 'string', description: "Page list, 1-based, e.g. '1-4,9' (default '1-6'; at most 8 per call)" },
        embed: { type: 'boolean', description: 'Also return up to 3 of the pages as application/pdf resources in this reply (≤ 3 MB total)' },
      },
      required: ['bid'],
    },
  },
  {
    name: 'stage_plan_pdf',
    description:
      "Oversized plan sets (v2.2816): CountTooling refuses PDFs over 50 MB or 200 pages. Trim the set to the plumbing sheets yourself (pdfseparate/pdfunite, or qpdf --pages), then call this for a one-time signed upload URL into the twin-plans-tmp bucket: PUT the trimmed file to upload_url (Content-Type: application/pdf, body = the file), then pass public_url as pdf_url to ct_finish_takeoff. The staged object is deleted automatically after a successful import; it expires with the bucket regardless.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b467') — the object is filed under its tag" },
        file_name: { type: 'string', description: "File name for the trimmed set, e.g. 'davis-ms-plumbing.pdf'" },
      },
      required: ['bid'],
    },
  },
  {
    name: 'next_backtest',
    description:
      "Dispatcher for parallel round runs (v2.2806): hand me the round's candidate list and I open the FIRST reference that has no shell for this round and return it as yours — a claim is the shell itself, so two agents can never land on the same bid (an accidental duplicate deletes itself). Optional axis filter. Returns done: true when every candidate is claimed. Call it once per bid, never while a bid is still unscored.",
    inputSchema: {
      type: 'object',
      properties: {
        round: { type: 'number', description: 'Round number (default 2)' },
        axis: { type: 'string', description: "Optional substring filter on the candidate axis, e.g. 'proto' or 'institutional'" },
        candidates: {
          type: 'array',
          description: 'Ordered list from the kickoff: [{ bid: "b344", axis: "proto/auto-service", label: "R2-BT-2" }, …]',
          items: { type: 'object', properties: { bid: { type: 'string' }, axis: { type: 'string' }, label: { type: 'string' } }, required: ['bid'] },
        },
      },
      required: ['candidates'],
    },
  },
  {
    name: 'add_bid_note',
    description:
      "Write one entry to a bid's audit ledger — the pipeline's flight recorder ('[pipeline STG-N] …' stamps, scorecards, run logs). Only on bids you created or are the assigned estimator for. Notes never move the follow-up clock.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b406' or uuid) — must be yours (assigned/created)" },
        note: { type: 'string', description: 'The ledger entry text (max 8000 chars)' },
      },
      required: ['bid', 'note'],
    },
  },
  {
    name: 'ct_finish_takeoff',
    description:
      'One-call STG-3 finisher: server-side mints YOUR CountTooling session, imports the takeoff (import-takeoff, idempotent by name), marks the project review-ready, mints a view link, stamps count_tooling_link on the bid, and opens the bid_audits row. The bid number is stamped as external_ref automatically and the plan set rides via plan-fetch — no browser, no scripts. Only on bids you created or are assigned to.',
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b410' or uuid) — becomes external_ref and the plan-fetch source" },
        name: { type: 'string', description: 'CT project name (re-import with the same name replaces)' },
        note: { type: 'string', description: 'Optional provenance note stored in the takeoff data' },
        takeoff: { type: 'object', description: 'takeoff.json v1 (counters, lineTypes, pages) — TAKEOFF_IMPORT.md contract' },
        self_assessment: { type: 'string', description: "Your confession for the auditor: 2-3 sentences on where THIS draft is least sure (modeled vs traced footage, guessed sub scopes, unread sheets). Shown atop the audit card as 'Where I'm least sure' — always send it." },
        view_name: { type: 'string', description: "Optional view-link label (default '<bid> audit view')" },
        skip_pdf: { type: 'boolean', description: 'Skip the plan-fetch PDF leg (default false)' },
        pdf_url: { type: 'string', description: "https URL of a plan PDF to attach INSTEAD of the bid's own set — for sets over CountTooling's 50 MB / 200-page cap, trim to the plumbing sheets and stage with stage_plan_pdf, then pass its public_url here (v2.2816)." },
      },
      required: ['bid', 'name', 'takeoff'],
    },
  },
  {
    name: 'paste_counts',
    description:
      "STG-5 in one call (v2.2864): write count rows into PipeTooling and book-assign every one from the 🤖 Robot Default book, so the Audits tab prices your card. Each row names the book entry to assign (extend the book first when a tag is missing); unit_price_override carries a price the book doesn't (a lump/bucket row, a LOCK-stated all-in) — label such rows transparently. Pass expected_total (your LOCK total) and the call REFUSES when the priced rows don't equal it — the step-0 invariant (tab total = lock) is enforced server-side, not by convention. Refused when the bid already has rows unless replace: true. Do this BEFORE your LOCK note and before the audit exists; an audit with no rows reads draft $0 and cannot be judged (the 2026-09-04 'we will not do this for free' cards).",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b467' or uuid) — created by / assigned to you" },
        rows: {
          type: 'array',
          description: 'The count rows, in display order (max 200)',
          items: {
            type: 'object',
            properties: {
              fixture: { type: 'string', description: "Row label, e.g. 'Water Closet (WC)' or 'ft of 2\" Sanitary Waste (PVC)'" },
              count: { type: 'number', description: 'Quantity (ea) or length (ft)' },
              unit: { type: 'string', description: "'ea' | 'ft' | 'px' | 'sqft' — omit to infer from the fixture name ('ft of …' → ft)" },
              page: { type: 'string', description: "Plan sheet, e.g. 'P2.1' (optional)" },
              book_entry: { type: 'string', description: 'EXACT 🤖 Robot Default entry name to assign this row to (the fixture_types name)' },
              unit_price_override: { type: 'number', description: "Price per unit when the book entry's price is not the row's price (lump rows, LOCK-stated all-ins)" },
              unit_cost: { type: 'number', description: 'v2.3082: materials COST per unit from TakeoffTooling (tt_manifest.rows[].unit_cost) — lands as the row\'s custom cost tagged TakeoffTooling so the Workbench opens costed' },
              labor_hours: { type: 'number', description: 'v2.3082: labor hours per unit from TakeoffTooling — summed onto the STG-5 ledger note (labor lands on the Labor tab by hand for now)' },
            },
            required: ['fixture', 'count', 'book_entry'],
          },
        },
        expected_total: { type: 'number', description: 'Your LOCK total — the call refuses unless the priced rows equal it (±$1 or 0.1%). Always pass it once you have locked.' },
        replace: { type: 'boolean', description: "Delete the bid's existing count rows + assignments first (default false — existing rows refuse the call)" },
      },
      required: ['bid', 'rows'],
    },
  },
  {
    name: 'tt_finish_costing',
    description:
      "One-call STG-4 for ELECTRICAL bids (v2.3082): server-side mints YOUR TakeoffTooling session, POSTs your counts to import-manifest (payload v2 items — units, types, groups, children; idempotent by bid stamp, re-run replaces), lets the explode kernel add each row's assembly priced from your synced book (else the shipped defaults), marks the manifest review-ready over the bridge, and stamps a [pipeline STG-4] note. Returns exploded/unpriced counts and a share_url a human can open. Only on bids you created or are assigned to; read get_tt_guide first. Then get_work_state(bid).tt_manifest has the priced rows for paste_counts (unit_cost + labor_hours).",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b467' or uuid) — becomes external_ref" },
        name: { type: 'string', description: 'TakeoffTooling project name (ZZ-prefixed on write missions)' },
        items: { type: 'array', description: "Payload v2 items: [{ description, quantity, unit?: ea|ft|px, type?: lighting|gear|devices|conduit|wire|specialSystems, pages?, group?, children?: [{ description, quantity, unit?, type?, labor?, price? }] }] — nothing omitted is inferred", items: { type: 'object' } },
        note: { type: 'string', description: 'Optional provenance note stored on the manifest' },
        explode: { type: 'boolean', description: 'Run the assembly templates on childless rows (default true)' },
        labor_rate: { type: 'number', description: 'Optional $/hr for the cost summary' },
        tax_rate: { type: 'number', description: 'Optional sales tax percent for the cost summary (default 8.25)' },
      },
      required: ['bid', 'name', 'items'],
    },
  },
  {
    name: 'get_robot_book',
    description:
      "Read the 🤖 Robot Default price book (v2.2868): entry names and prices, so rows can be priced from the real book instead of mirrored guesses. Pass your bid to get the book for its service type, or nothing for every robot book. Read-only; prices here are the ones paste_counts uses when a row carries no override.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Optional: your bid (e.g. 'b470' or uuid) — returns the robot book for its service type only" },
      },
    },
  },
  {
    name: 'extend_robot_book',
    description:
      "Extend the 🤖 Robot Default book when a tag is missing (v2.2868) — the doctrine's 'extend it when a tag is missing; mirror sources in the ledger', as a verb. Adds fixture types + priced entries to the robot book for your bid's service type and stamps a '[book extend]' note carrying your mirror_note on that bid's ledger. Names already in the book are skipped, never repriced (re-mirrors of existing prices stay a digest-session act). Use real mirrored prices and say where they came from — an invented price poisons every future draft.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b470' or uuid) — the ledger the mirror note lands on; must be yours (assigned/created)" },
        entries: {
          type: 'array',
          description: 'New entries, max 20: [{ name, price }]',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: "Entry name exactly as rows will reference it, e.g. 'ft of 1 1/2\" Cold Water'" },
              price: { type: 'number', description: 'Unit price (mirrored, not invented)' },
            },
            required: ['name', 'price'],
          },
        },
        mirror_note: { type: 'string', description: "Where the prices came from, e.g. 'human books: FEET OF 1 1/2IN COPPER $87.63 (108 versions)' — required, lands on the ledger" },
      },
      required: ['bid', 'entries', 'mirror_note'],
    },
  },
  {
    name: 'put_substrate',
    description:
      "STG-2 as a verb (v2.2881): attach your plan substrate to YOUR bid — the bids_plan_substrates insert that agent environments kept blocking client-side. Build the substrate per EXTRACTOR.md (get_placement_guide) first; this only stores it. Latest row wins (get_plan_brief reads the newest), so a corrected substrate is just another call. Stamps '[pipeline STG-2]' on the ledger.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b474' or uuid) — created by / assigned to you" },
        substrate: { type: 'object', description: 'The substrate JSON per EXTRACTOR.md (carries substrate_version inside)' },
        version: { type: 'string', description: "Version label for the row (default 'v001', or v<n+1> when rows exist)" },
      },
      required: ['bid', 'substrate'],
    },
  },
  {
    name: 'seed_audit_questions',
    description:
      "Seed your open questions onto the bid's audit card (v2.2881) — the bid_audit_notes insert that agent environments kept blocking client-side. Questions land as kind='question' with your authorship; anchor every one you can (sheet_ref + one-line context — an unanchored question makes the auditor hunt). Plain trade words, one ask each, never asking the auditor to grade your number. Finds the bid's audit row (ct_finish_takeoff opens it) or opens one if missing.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b474' or uuid) — created by / assigned to you" },
        questions: {
          type: 'array',
          description: 'Up to 20: [{ body, section?, sheet_ref?, context? }]',
          items: {
            type: 'object',
            properties: {
              body: { type: 'string', description: 'The question, plain trade words, one ask' },
              section: { type: 'string', description: "'counts' | 'footage' | 'pricing' | 'scope' | 'general' (default general)" },
              sheet_ref: { type: 'string', description: "Plan sheet where you saw it, e.g. 'P2.1'" },
              context: { type: 'string', description: 'One sentence: what you saw and what rides on the answer' },
            },
            required: ['body'],
          },
        },
      },
      required: ['bid', 'questions'],
    },
  },
  {
    name: 'get_reference_rows',
    description:
      "The post-unseal read for the scope-match line-compare (v2.2881): your backtest bid's REFERENCE rows (fixtures, counts, units, pages, assigned prices). Blind-safe by construction — REFUSED until the shell's scorecard exists (score_backtest, or a scored shadow), the same order-of-operations the LOCK gate enforces on the way in. Use it for the T4 comparison and the amended scope verdict; never for a bid still sealed.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "YOUR twin shell (e.g. 'b475' or uuid), not the reference — the server resolves and checks the pairing" },
      },
      required: ['bid'],
    },
  },
  {
    name: 'get_shadow_queue',
    description:
      'Fleet Phase 1 (shadow bidding): live human bids eligible for a shadow estimate — created recently, plans present AND readable by the Drive intake service account (probed via plan-fetch; unreadable ones are listed under `unreadable` for a human to repair, never queued), NOT yet sent (so the shadow is blind by nature), not a ZZ bid, not already shadowed. HUMAN-REQUESTED bids (the green robot icon on the Bid Board) come FIRST, oldest ask on top, and bypass the lookback window — work those before the rest. Returns logistics only. Pick one and open_shadow it.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Lookback window in days (default 14)' } },
    },
  },
  {
    name: 'next_shadow',
    description:
      "The auto-shadow dispatcher (v2.2936): FIRST (v1.3.17) hands back one of YOUR own unlocked shells whose plans ask a person answered 'Attached — rerun' (resumed: true — redo STG-2 with the new set and lock; the ask is consumed once); otherwise claim the next live bid that needs a shadow — human-requested bids first (oldest ask, no age limit), then the oldest eligible bid inside the lookback. The claim is the shadow shell itself, so parallel agents never share a bid; done: true means every eligible live bid is covered. Bids whose plans the Drive intake service account cannot read are skipped (probed first via plan-fetch; see get_shadow_queue's `unreadable` list) — never claim a bid you cannot fetch plans for. The whole point (LEARNING_PLAN.md): a shadow costs the estimator zero minutes, locks blind before her number exists, and auto-scores when she sends — run agents on this verb until it says done and the live board is fully covered. Never call it again while your current shadow is unlocked.",
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Lookback window for unrequested bids (default 30); human-requested bids ignore it' },
      },
    },
  },
  {
    name: 'open_shadow',
    description:
      "Open a shadow estimate of a LIVE bid (fleet Phase 1): creates a 'ZZ Shadow <PROJECT>' bid owned by YOUR twin with logistics only, and registers the twin_shadow_runs row. Refused if the reference has already been sent (that would be a backtest — use open_backtest). Idempotent per reference. Estimate it exactly like a backtest, then lock_shadow your total BEFORE the human number exists.",
    inputSchema: {
      type: 'object',
      properties: {
        reference_bid: { type: 'string', description: "The live bid to shadow (e.g. 'b420' or uuid)" },
        axis: { type: 'string', description: "Axis classification for the confidence scoreboard, e.g. 'restaurant-ti', 'warehouse', 'small-ti'" },
      },
      required: ['reference_bid'],
    },
  },
  {
    name: 'void_shadow',
    description:
      "Take a shadow OUT of the scoring loop (v2.3032): a category error (wrong division), a wrong reference, a contaminated run. Own shells only; a run that already scored stays scored (the owner judges gate eligibility instead). Stamps '[shadow VOID] <reason>' on the ledger. Use it instead of leaving a bad lock to auto-score.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your shadow shell (e.g. 'b480' or uuid)" },
        reason: { type: 'string', description: 'Why this run must never score (plain words, one paragraph max)' },
      },
      required: ['bid', 'reason'],
    },
  },
  {
    name: 'lock_shadow',
    description:
      'Lock your shadow total (fleet Phase 1): records the blind total on the twin_shadow_runs row and stamps the ledger. Must happen BEFORE the reference bid is sent; refused after. Scoring is automatic later via score_shadows.',
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your ZZ Shadow bid (e.g. 'b418' or uuid)" },
        total: { type: 'number', description: 'The locked blind total in dollars' },
      },
      required: ['bid', 'total'],
    },
  },
  {
    name: 'score_shadows',
    description:
      "Score every locked shadow whose reference has since been SENT (bid_value + date present): computes delta vs the human number, records WHOSE number it was (teacher — the reference's estimator; a calibration-standard teacher counts toward Gate B, any other is practice), marks the run scored, and stamps scorecard notes on both bids. Call at the start of any run — it is the auto-scorecard. Returns the runs scored plus per-axis rolling stats (the confidence scoreboard data; gate math takes standard-teacher runs only).",
    inputSchema: { type: 'object', properties: {} },
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}
function textContent(text: string, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function presentedToken(req: Request): string | null {
  const direct = req.headers.get('X-Twin-Token')
  if (direct) return direct.trim()
  const auth = req.headers.get('Authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return null
}

type TwinKind = 'estimator' | 'pricer'
type ResolvedTwin = { twinUserId: string; email: string; credId: string; kind: TwinKind }

async function resolveTwin(req: Request): Promise<ResolvedTwin | { error: string; status: number }> {
  const token = presentedToken(req)
  if (!token) return { error: 'Missing X-Twin-Token (or Authorization: Bearer) — this MCP server requires your per-twin token.', status: 401 }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) return { error: 'Server not configured', status: 500 }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const hash = await sha256Hex(token)
  const { data: cred, error } = await admin.from('twin_credentials').select('id, twin_user_id, revoked_at').eq('token_hash', hash).maybeSingle()
  if (error) return { error: `Credential lookup failed: ${error.message}`, status: 500 }
  if (!cred || cred.revoked_at) return { error: 'Unknown or revoked twin token', status: 401 }
  // twin_kind lands with 20260911023538 (Price Matrix PR 1); before the push the column is
  // unknown to PostgREST — read the legacy shape and treat every twin as an estimator.
  let user: { email: string; is_digital_twin: boolean; role: string; twin_kind?: string | null } | null = null
  const wide = await admin.from('users').select('email, is_digital_twin, role, twin_kind').eq('id', cred.twin_user_id).maybeSingle()
  if (!wide.error) user = wide.data as typeof user
  else {
    const legacy = await admin.from('users').select('email, is_digital_twin, role').eq('id', cred.twin_user_id).maybeSingle()
    user = legacy.data as typeof user
  }
  if (!user || user.is_digital_twin !== true || user.role !== 'estimator') return { error: 'Twin account not eligible', status: 403 }
  const kind: TwinKind = user.twin_kind === 'pricer' ? 'pricer' : 'estimator'
  return { twinUserId: cred.twin_user_id, email: user.email as string, credId: cred.id as string, kind }
}

// ---------------------------------------------------------------------------
// Pricing twin (Price Matrix PR 3 — docs/PRICE_MATRIX_PLAN.md). A pricer key
// holds no bids and is refused every bid verb; a bid robot is refused the
// pricer's. The shared verbs (heartbeat, notes, questions, reports, docs) work
// for both. Everything the pricer writes is provenance-stamped robot.
// ---------------------------------------------------------------------------
const PRICER_VERBS: ReadonlySet<string> = new Set([
  'get_pricing_guide', 'next_price_matrix', 'get_quote_documents', 'put_quote', 'finish_price_matrix', 'get_component_rules', 'extend_component_rules',
])
const SHARED_VERBS: ReadonlySet<string> = new Set(['get_directory', 'get_harness_guide', 'get_answers', 'ask_question', 'heartbeat', 'add_bid_note', 'submit_report'])
const PRICER_COMPONENT_ROLES: ReadonlySet<string> = new Set([
  'kit', 'bowl', 'seat', 'flush_valve', 'carrier', 'faucet', 'drain', 'trap', 'supply', 'stops', 'trim', 'mixing_valve', 'accessory', 'freight', 'loose',
])
type PricerScopeLine = { count_row_id?: string; fixture: string; count: number; unit?: string | null }
type PricerSource = { rfq_id?: string; supply_house_id?: string | null; house_name?: string; url?: string; requested_on?: string | null }
type PricerRequestRow = {
  id: string
  bid_id: string
  bid_version_id: string | null
  status: string
  claimed_by: string | null
  requested_by: string | null
  requested_at: string
  scope: PricerScopeLine[]
  sources: PricerSource[]
}
const PRICER_REQUEST_COLS = 'id, bid_id, bid_version_id, status, claimed_by, requested_by, requested_at, scope, sources'
function shapePricerRequest(r: Record<string, unknown>): PricerRequestRow {
  return {
    id: String(r.id),
    bid_id: String(r.bid_id),
    bid_version_id: (r.bid_version_id as string | null) ?? null,
    status: String(r.status),
    claimed_by: (r.claimed_by as string | null) ?? null,
    requested_by: (r.requested_by as string | null) ?? null,
    requested_at: String(r.requested_at),
    scope: Array.isArray(r.scope) ? (r.scope as PricerScopeLine[]) : [],
    sources: Array.isArray(r.sources) ? (r.sources as PricerSource[]) : [],
  }
}
/** The request the pricer is working: claimed by this twin and still open (working), or ready for a re-finish. */
async function loadPricerRequest(
  admin: ReturnType<typeof createClient>,
  twin: ResolvedTwin,
  ref: string,
  allow: ReadonlyArray<string> = ['working'],
): Promise<{ request: PricerRequestRow; bid: { id: string; bid_number: string; project_name: string | null } } | { error: string }> {
  const id = String(ref ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: 'request must be the request uuid next_price_matrix returned' }
  const { data, error } = await admin.from('bid_price_matrix_requests').select(PRICER_REQUEST_COLS).eq('id', id).maybeSingle()
  if (error) return { error: `Request lookup failed: ${error.message}` }
  if (!data) return { error: `No price-matrix request ${id}` }
  const request = shapePricerRequest(data as Record<string, unknown>)
  if (request.claimed_by !== twin.twinUserId) return { error: `Request ${id.slice(0, 8)} is not yours — next_price_matrix claims requests; work only the one it hands you.` }
  if (!allow.includes(request.status)) return { error: `Request ${id.slice(0, 8)} is ${request.status}, not ${allow.join('/')} — nothing more to do on it.` }
  const { data: bid } = await admin.from('bids').select('id, bid_number, project_name').eq('id', request.bid_id).maybeSingle()
  if (!bid) return { error: `The request's bid is gone` }
  return { request, bid: bid as { id: string; bid_number: string; project_name: string | null } }
}
/** A pricer may stamp the ledger of a bid whose request it holds (working or ready). */
async function pricerMayTouchBid(admin: ReturnType<typeof createClient>, twin: ResolvedTwin, bidId: string): Promise<boolean> {
  if (twin.kind !== 'pricer') return false
  const { data } = await admin.from('bid_price_matrix_requests').select('id').eq('bid_id', bidId).eq('claimed_by', twin.twinUserId).in('status', ['working', 'ready']).limit(1)
  return Array.isArray(data) && data.length > 0
}
const pricerKey = (name: string) => name.trim().toLowerCase()
function pricerSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}
/** Resolve `house` (a 1-based source index, a supply_house uuid, or a name) to a supply_houses row via the request's sources first. */
async function resolvePricerHouse(
  admin: ReturnType<typeof createClient>,
  request: PricerRequestRow,
  house: unknown,
): Promise<{ id: string; name: string; sourceIndex: number | null; url: string | null } | { error: string }> {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const raw = typeof house === 'number' ? String(house) : String(house ?? '').trim()
  if (!raw) return { error: 'house is required — a source index from next_price_matrix (1, 2, …), the supply house id, or its name' }
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= request.sources.length) {
    const src = request.sources[n - 1]!
    if (src.supply_house_id) {
      const { data: h } = await admin.from('supply_houses').select('id, name').eq('id', src.supply_house_id).maybeSingle()
      if (h) return { id: (h as { id: string }).id, name: (h as { name: string }).name, sourceIndex: n, url: src.url ?? null }
    }
    if (src.house_name) {
      const { data: h } = await admin.from('supply_houses').select('id, name').ilike('name', src.house_name).limit(1).maybeSingle()
      if (h) return { id: (h as { id: string }).id, name: (h as { name: string }).name, sourceIndex: n, url: src.url ?? null }
    }
    return { error: `Source ${n} (${src.house_name ?? '?'}) has no supply house on file — the estimator adds the house on Edit Bid → Price requests.` }
  }
  if (uuidRe.test(raw)) {
    const { data: h } = await admin.from('supply_houses').select('id, name').eq('id', raw).maybeSingle()
    if (!h) return { error: `No supply house ${raw}` }
    const idx = request.sources.findIndex((x) => x.supply_house_id === raw)
    return { id: (h as { id: string }).id, name: (h as { name: string }).name, sourceIndex: idx >= 0 ? idx + 1 : null, url: idx >= 0 ? (request.sources[idx]!.url ?? null) : null }
  }
  const bySource = request.sources.findIndex((x) => (x.house_name ?? '').trim().toLowerCase() === raw.toLowerCase())
  if (bySource >= 0) return resolvePricerHouse(admin, request, bySource + 1)
  const { data: h } = await admin.from('supply_houses').select('id, name').ilike('name', `%${raw}%`).eq('vendor_kind', 'supply_house').limit(2)
  const rows = (h ?? []) as Array<{ id: string; name: string }>
  if (rows.length === 1) return { id: rows[0]!.id, name: rows[0]!.name, sourceIndex: null, url: null }
  if (rows.length > 1) return { error: `"${raw}" matches several supply houses (${rows.map((r) => r.name).join(', ')}) — pass the source index or the id` }
  return { error: `No supply house named "${raw}" — pass a source index from next_price_matrix (1, 2, …)` }
}

// ---------------------------------------------------------------------------
// Discipline fence (v2.3032): twin-estimator-1 is a PLUMBING estimator. On
// 2026-09-07 next_shadow claimed b378 — an Electrical-division bid — and the
// robot locked a $907k plumbing number against an electrical reference, mirroring
// 34 plumbing entries into the empty electrical robot book on the way. Every
// claim door now checks the reference's service type against Plumbing.
// ---------------------------------------------------------------------------
let plumbingServiceTypeCache: string | null = null
async function plumbingServiceTypeId(admin: ReturnType<typeof createClient>): Promise<string | null> {
  if (plumbingServiceTypeCache) return plumbingServiceTypeCache
  const { data } = await admin.from('service_types').select('id').ilike('name', 'plumbing').limit(1).maybeSingle()
  plumbingServiceTypeCache = (data as { id: string } | null)?.id ?? null
  return plumbingServiceTypeCache
}
async function disciplineRefusal(admin: ReturnType<typeof createClient>, refBid: { bid_number: string; service_type_id: string | null }): Promise<string | null> {
  const plumbing = await plumbingServiceTypeId(admin)
  if (!plumbing || refBid.service_type_id === plumbing) return null
  const { data: st } = await admin.from('service_types').select('name').eq('id', refBid.service_type_id ?? '').maybeSingle()
  return `b${refBid.bid_number} is a${/^[aeiou]/i.test(String(st?.name ?? '')) ? 'n' : ''} ${st?.name ?? 'non-plumbing'} bid — twin-estimator-1 estimates PLUMBING only. A plumbing number against another division's reference is a category error, not a data point; pick a plumbing reference.`
}

// "Plans readable by robots" (v2.3080 / v1.3.11): before listing or claiming,
// ask plan-fetch to probe any live bid whose plans link was never checked (or
// not in the last 24h). Best-effort and bounded — a slow Drive never blocks the
// queue; a bid the service account cannot read is skipped by the dispatcher and
// listed under `unreadable` so a human can repair the link.
async function probePlansSweep(req: Request, limit = 15): Promise<void> {
  const token = presentedToken(req)
  if (!token) return
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12_000)
  try {
    await fetch(`${supabaseUrl}/functions/v1/plan-fetch?probe=all&limit=${limit}`, {
      headers: { 'X-Twin-Token': token },
      signal: ctl.signal,
    })
  } catch {
    // best-effort
  } finally {
    clearTimeout(timer)
  }
}

// Who taught this reference: the assigned estimator, else the sender who
// attested the send, else the creator — plus whether they are a calibration
// standard (users.calibration_standard, v2.3080).
type TeacherBid = { estimator_id: string | null; bid_date_sent_attested_by: string | null; created_by: string | null }
async function resolveTeacher(admin: ReturnType<typeof createClient>, bid: TeacherBid): Promise<{ id: string | null; name: string | null; standard: boolean }> {
  const id = bid.estimator_id ?? bid.bid_date_sent_attested_by ?? bid.created_by ?? null
  if (!id) return { id: null, name: null, standard: false }
  const { data: u } = await admin.from('users').select('name, calibration_standard').eq('id', id).maybeSingle()
  return { id, name: (u as { name?: string | null } | null)?.name ?? null, standard: !!(u as { calibration_standard?: boolean } | null)?.calibration_standard }
}

// ---------------------------------------------------------------------------
// Shadow shells (v2.2936): one creator for open_shadow and next_shadow. The
// twin_shadow_runs row IS the claim; the caller has already verified the
// reference is unsent (blind by nature — the shadow opens before the human
// number exists).
// ---------------------------------------------------------------------------
type ShadowRefBid = {
  id: string
  bid_number: string
  project_name: string | null
  address: string | null
  customer_id: string | null
  service_type_id: string | null
  distance_from_office: number | null
  plans_link: string | null
  gc_builder_id: string | null
  bid_due_date: string | null
}

async function createShadowShell(
  admin: ReturnType<typeof createClient>,
  twin: { twinUserId: string; email: string },
  refBid: ShadowRefBid,
  axis: string | null,
): Promise<{ id: string; bid_number: string } | { error: string }> {
  const ztName = `ZZ Shadow ${String(refBid.project_name ?? 'UNKNOWN').toUpperCase()}`
  const { data: created, error: insErr } = await admin
    .from('bids')
    .insert({
      project_name: ztName,
      address: refBid.address,
      customer_id: refBid.customer_id,
      service_type_id: refBid.service_type_id,
      distance_from_office: refBid.distance_from_office,
      plans_link: refBid.plans_link,
      gc_builder_id: refBid.gc_builder_id,
      bid_due_date: refBid.bid_due_date,
      // v2.2543: pair the shadow with its live source so the Bid Board's
      // robot icon turns colorful the moment the shadow opens.
      twin_source_bid_id: refBid.id,
      created_by: twin.twinUserId,
      estimator_id: twin.twinUserId,
      notes: `Shadow estimate of live bid b${refBid.bid_number} (fleet Phase 1). Blind by nature — opened before the human number exists.`,
    })
    .select('id, bid_number')
    .single()
  if (insErr) return { error: `Shadow bid not created: ${insErr.message}` }
  const { error: runErr } = await admin.from('twin_shadow_runs').insert({
    shadow_bid_id: created.id, reference_bid_id: refBid.id, twin_user_id: twin.twinUserId, axis,
  })
  if (runErr) {
    await admin.from('bids').delete().eq('id', created.id).then(() => {}, () => {})
    return { error: `Shadow run not registered: ${runErr.message}` }
  }
  await admin.from('bids_submission_entries').insert({
    bid_id: created.id,
    notes: `[shadow STG-0] Shadow of live b${refBid.bid_number} (${refBid.project_name}) opened by ${twin.email}. Axis: ${axis || 'unclassified'}. Lock the blind total with lock_shadow BEFORE the human bid is sent; score_shadows finishes the loop automatically.`,
  }).then(() => {}, () => {})
  return { id: created.id as string, bid_number: String(created.bid_number) }
}

// ---------------------------------------------------------------------------
// Backtest shells (v2.2523 / rounds v2.2800 / dispatcher v2.2806). One creator for
// open_backtest and next_backtest. Logistics fields ONLY are read from the reference —
// counts, pricing, bid_value, outcome never reach the caller (blind protocol).
// ---------------------------------------------------------------------------
type BacktestShellResult =
  | { ok: true; reused: boolean; round: number; bid: string; bid_id: string; name: string; reference_grade: string; grade_note: string; reference_bid_number: string | null; logistics?: Record<string, unknown>; warning?: string }
  | { ok: false; error: string }

async function openBacktestShell(
  admin: ReturnType<typeof createClient>,
  twin: { twinUserId: string; email: string },
  reference: string,
  opts: { round?: number; dueInDays?: number; gateRun?: boolean },
): Promise<BacktestShellResult> {
  const ref = reference.trim()
  if (!ref) return { ok: false, error: 'Missing reference_bid (bid number like b370, or uuid)' }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let rq = admin.from('bids').select('id, bid_number, project_name, address, customer_id, service_type_id, distance_from_office, plans_link, gc_builder_id, holdout')
  rq = uuidRe.test(ref) ? rq.eq('id', ref) : rq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
  const { data: refBid, error: refErr } = await rq.maybeSingle()
  if (refErr) return { ok: false, error: `Reference lookup failed: ${refErr.message}` }
  if (!refBid) return { ok: false, error: `No bid found for "${ref}"` }
  // Holdout enforcement (v2.2952, LEARNING_PLAN lever 3): holdout references are
  // reserved for gate measurement — never practice, never quoted in doctrine.
  // Only an operator-ordered gate run may open one; next_backtest auto-skips.
  if ((refBid as { holdout?: boolean }).holdout && !opts.gateRun) {
    return { ok: false, error: `b${refBid.bid_number} is a HOLDOUT reference — reserved for gate measurement, never practice. Only an operator-ordered gate run opens it (open_backtest with gate_run: true); pick a different reference.` }
  }
  const disciplineErr = await disciplineRefusal(admin, refBid as { bid_number: string; service_type_id: string | null })
  if (disciplineErr) return { ok: false, error: disciplineErr }
  // Reference data-grade (v2.2545) — PRESENCE booleans only, blind-safe.
  const [{ count: countRows }, { count: pricingRows }, { data: presence }] = await Promise.all([
    admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
    admin.from('bid_pricing_assignments').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
    admin.from('bids').select('id').eq('id', refBid.id).not('bid_value', 'is', null).maybeSingle(),
  ])
  const hasPlans = !!String(refBid.plans_link ?? '').trim()
  const hasValue = !!presence
  const hasCounts = (countRows ?? 0) > 0
  const hasPricing = (pricingRows ?? 0) > 0
  const referenceGrade = !hasPlans ? 'X' : hasValue && hasCounts && hasPricing ? 'A' : hasValue ? 'B' : hasCounts ? 'C' : 'D'
  const gradeNote = referenceGrade === 'A' ? 'full scorecard possible'
    : referenceGrade === 'B' ? 'dollar-level scorecard only (no reference takeoff rows)'
    : referenceGrade === 'C' ? 'quantity scorecard only (no reliable reference value)'
    : referenceGrade === 'D' ? 'census reps only — no scorecard'
    : 'no plans — not backtestable'
  // v2.2800: a re-run round gets its own shell — a scored round-1 shell carries its
  // scorecard (reference value, delta) in the ledger and would unblind the run.
  const roundNum = Math.floor(Number(opts.round ?? 1))
  const round = Number.isFinite(roundNum) && roundNum >= 2 ? roundNum : 1
  const roundTag = round >= 2 ? ` R${round}` : ''
  const ztName = `ZZ Twin ${String(refBid.project_name ?? 'UNKNOWN').toUpperCase()} (backtest${roundTag})`
  const { data: existing } = await admin
    .from('bids').select('id, bid_number').eq('created_by', twin.twinUserId).eq('project_name', ztName).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (existing) {
    return { ok: true, reused: true, round, bid: `b${existing.bid_number}`, bid_id: existing.id, name: ztName, reference_grade: referenceGrade, grade_note: gradeNote, reference_bid_number: refBid.bid_number ?? null, warning: round >= 2 ? undefined : 'This shell may already carry a scorecard — read its ledger via get_work_state before working it, or open a new round with round: 2.' }
  }
  const dueDays = Number(opts.dueInDays ?? 7)
  const due = ymdAddDays(todayYmdInAppTz(), Number.isFinite(dueDays) && dueDays > 0 ? dueDays : 7)
  const { data: created, error: insErr } = await admin
    .from('bids')
    .insert({
      project_name: ztName,
      address: refBid.address,
      customer_id: refBid.customer_id,
      service_type_id: refBid.service_type_id,
      distance_from_office: refBid.distance_from_office,
      plans_link: refBid.plans_link,
      gc_builder_id: refBid.gc_builder_id,
      bid_due_date: due,
      created_by: twin.twinUserId,
      estimator_id: twin.twinUserId,
      twin_source_bid_id: refBid.id,
      notes: `Blind backtest${roundTag ? ` (round ${round})` : ''} of b${refBid.bid_number}. Reference sealed until the STG-6 scorecard stamp. Opened via twin-mcp.`,
    })
    .select('id, bid_number')
    .single()
  if (insErr) return { ok: false, error: `Backtest bid not created: ${insErr.message}` }
  // Race guard (v2.2806): two dispatchers can pass the "existing" check together. The
  // earliest-created shell wins; a later duplicate deletes itself and reports reused.
  const { data: winners } = await admin.from('bids').select('id, bid_number').eq('created_by', twin.twinUserId).eq('project_name', ztName).order('created_at', { ascending: true }).limit(1)
  const winner = winners?.[0]
  if (winner && winner.id !== created.id) {
    await admin.from('bids').delete().eq('id', created.id).then(() => {}, () => {})
    return { ok: true, reused: true, round, bid: `b${winner.bid_number}`, bid_id: winner.id, name: ztName, reference_grade: referenceGrade, grade_note: gradeNote, reference_bid_number: refBid.bid_number ?? null }
  }
  await admin.from('bids_submission_entries').insert({
    bid_id: created.id,
    notes: `[pipeline STG-0] Blind backtest${roundTag ? ` ROUND ${round}` : ''} of b${refBid.bid_number} (${refBid.project_name}) opened via twin-mcp by ${twin.email}. Logistics copied (address, customer, service type, distance ${refBid.distance_from_office ?? '?'} mi, plans link); reference counts/pricing/outcome SEALED until STG-6${round >= 2 ? '. Prior rounds of this reference are OFF LIMITS until the scorecard stamp' : ''}.`,
  }).then(() => {}, () => {})
  return {
    ok: true, reused: false, round, bid: `b${created.bid_number}`, bid_id: created.id, name: ztName,
    reference_grade: referenceGrade, grade_note: gradeNote, reference_bid_number: refBid.bid_number ?? null,
    logistics: { address: refBid.address, distance_from_office: refBid.distance_from_office, plans_link: !!refBid.plans_link, due },
  }
}

async function callTool(req: Request, name: string, args: Record<string, unknown>) {
  // Docs tools work with a valid token too, but auth is required for every call.
  const twin = await resolveTwin(req)
  if ('error' in twin) return textContent(`Auth failed: ${twin.error}`, true)
  // Price Matrix PR 3: a pricer key is refused every bid verb; a bid robot is refused the pricer's.
  if (twin.kind === 'pricer' && !PRICER_VERBS.has(name) && !SHARED_VERBS.has(name)) {
    return textContent(`${name} is a bid verb — a twin-pricer key prices supply-house quotes and holds no bids; that door is refused by design (docs/PRICE_MATRIX_PLAN.md). Your verbs: ${[...PRICER_VERBS].join(', ')}, plus heartbeat, add_bid_note, ask_question, get_answers, submit_report.`, true)
  }
  if (twin.kind !== 'pricer' && PRICER_VERBS.has(name)) {
    return textContent(`${name} is the pricing robot's verb — a bid robot never prices quotes. Use a twin-pricer key (Settings → Digital twins → Twin Pricer 1).`, true)
  }

  switch (name) {
    case 'get_brief':
      return textContent(BRIEF)
    case 'get_directory':
      return textContent(DIRECTORY)
    case 'get_harness_guide':
      return textContent(HARNESS || 'Harness guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_ct_guide':
      return textContent(CT_GUIDE || 'CountTooling guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_tt_guide':
      return textContent(TT_GUIDE || 'TakeoffTooling guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_placement_guide':
      return textContent(PLACEMENT_GUIDE || 'Placement guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_pricing_guide':
      return textContent(PRICING_GUIDE || 'Pricing guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_component_rules': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data, error } = await admin.from('fixture_component_rules').select('id, kind, rule, fixture_pattern, role, source, times_used, last_used_at, created_at').eq('active', true).order('kind').order('created_at')
      if (error) return textContent(`Rulebook not readable: ${error.message}`, true)
      const rules = (data ?? []) as Array<Record<string, unknown>>
      return textContent(JSON.stringify({
        ok: true,
        count: rules.length,
        rules: rules.map((r) => ({ id: r.id, kind: r.kind, rule: r.rule, fixture_pattern: r.fixture_pattern ?? null, role: r.role ?? null, source: r.source, times_used: r.times_used ?? 0 })),
        how: rules.length === 0
          ? 'The rulebook is empty — structure from the brief alone, and ask (never guess) where the plans decide. Rules you are sure of go in with extend_component_rules and a mirror_note.'
          : 'Honour every rule while structuring; an option_default rule may choose a variant for you (say so in the pick reason). Anything a rule does not settle, ask.',
      }, null, 2))
    }
    case 'next_price_matrix': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      // One at a time: a request this twin already holds comes back first.
      const { data: held } = await admin.from('bid_price_matrix_requests').select(PRICER_REQUEST_COLS).eq('claimed_by', twin.twinUserId).eq('status', 'working').order('claimed_at', { ascending: true }).limit(1)
      const heldRow = Array.isArray(held) && held.length ? shapePricerRequest(held[0] as Record<string, unknown>) : null
      let claimed: PricerRequestRow | null = heldRow
      let resumed = false
      if (claimed) resumed = true
      else {
        const { data: cands, error } = await admin.from('bid_price_matrix_requests').select('id').eq('status', 'queued').order('requested_at', { ascending: true }).limit(10)
        if (error) return textContent(`Queue lookup failed: ${error.message}`, true)
        for (const c of (cands ?? []) as Array<{ id: string }>) {
          // The conditional update IS the claim — two pricers can never take the same request.
          const nowIso = new Date().toISOString()
          const { data: won } = await admin.from('bid_price_matrix_requests')
            .update({ status: 'working', claimed_by: twin.twinUserId, claimed_at: nowIso, heartbeat_at: nowIso, updated_at: nowIso })
            .eq('id', c.id).eq('status', 'queued')
            .select(PRICER_REQUEST_COLS).maybeSingle()
          if (won) { claimed = shapePricerRequest(won as Record<string, unknown>); break }
        }
      }
      if (!claimed) return textContent(JSON.stringify({ done: true, note: 'Nothing is queued for the pricing robot. An estimator asks from Bids → Pricing → Supply house prices ▾ → Price it with the robot.' }, null, 2))
      const { data: bid } = await admin.from('bids').select('id, bid_number, project_name').eq('id', claimed.bid_id).maybeSingle()
      const b = bid as { id: string; bid_number: string; project_name: string | null } | null
      if (!resumed && b) {
        await admin.from('bids_submission_entries').insert({
          bid_id: b.id,
          notes: `[pricer STG-0] ${twin.email} claimed price-matrix request ${claimed.id.slice(0, 8)} — ${claimed.scope.length} fixture rows, ${claimed.sources.length} quote link${claimed.sources.length === 1 ? '' : 's'} (${claimed.sources.map((x) => x.house_name ?? '?').join(', ') || 'none'}).`,
        }).then(() => {}, () => {})
      }
      return textContent(JSON.stringify({
        ok: true,
        resumed,
        request: claimed.id,
        bid: b ? `b${b.bid_number}` : null,
        project: b?.project_name ?? null,
        requested_at: claimed.requested_at,
        rows: claimed.scope.map((r) => ({ fixture: r.fixture, count: r.count, unit: r.unit ?? null })),
        sources: claimed.sources.map((x, i) => ({ source: i + 1, house: x.house_name ?? null, supply_house_id: x.supply_house_id ?? null, url: x.url ?? null, requested_on: x.requested_on ?? null })),
        next: resumed
          ? 'This is the request you already hold — finish it (put_quote per house, then finish_price_matrix) before claiming another.'
          : 'This request is yours alone. get_quote_documents(request) to list the files, then by source and page until every page is read; put_quote per house using these row names verbatim; finish_price_matrix with picks, asks and a summary. heartbeat working now.',
      }, null, 2))
    }
    case 'get_quote_documents': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const loaded = await loadPricerRequest(admin, twin, String(args.request ?? ''), ['working', 'ready'])
      if ('error' in loaded) return textContent(loaded.error, true)
      const { request, bid } = loaded
      const token = presentedToken(req)
      if (!token) return textContent('No twin token on this call', true)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const sourceN = args.source == null ? null : Number(args.source)
      if (sourceN == null) {
        // Listing: every source's files, readable or not.
        const out: Array<Record<string, unknown>> = []
        for (let i = 1; i <= request.sources.length; i++) {
          const src = request.sources[i - 1]!
          const res = await fetch(`${supabaseUrl}/functions/v1/plan-fetch?request=${encodeURIComponent(request.id)}&source=${i}&list=1`, { headers: { 'X-Twin-Token': token } })
          const body = await res.json().catch(() => ({})) as { files?: Array<{ name: string; size: number | null }>; error?: string }
          out.push({ source: i, house: src.house_name ?? null, url: src.url ?? null, readable: res.ok, files: res.ok ? body.files ?? [] : [], note: res.ok ? null : `${res.status}: ${body.error ?? res.statusText}` })
        }
        return textContent(JSON.stringify({
          ok: true, request: request.id, bid: `b${bid.bid_number}`, sources: out,
          how: 'Call again with `source` (and `pages`) to read a file. A source that is not readable: say which house and the fix (share the folder with drive-intake@pipetooling-drive.iam.gserviceaccount.com as Viewer), and continue with the others.',
        }, null, 2))
      }
      if (!Number.isInteger(sourceN) || sourceN < 1 || sourceN > request.sources.length) return textContent(`source must be 1..${request.sources.length}`, true)
      const src = request.sources[sourceN - 1]!
      const CAP_BYTES = 60 * 1024 * 1024
      const fetchPart = async (part: number | null): Promise<{ bytes: Uint8Array; parts: number } | { error: string; status: number }> => {
        const u = `${supabaseUrl}/functions/v1/plan-fetch?request=${encodeURIComponent(request.id)}&source=${sourceN}${part ? `&part=${part}` : ''}`
        const res = await fetch(u, { headers: { 'X-Twin-Token': token } })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          return { error: body.slice(0, 300) || res.statusText, status: res.status }
        }
        return { bytes: new Uint8Array(await res.arrayBuffer()), parts: Math.max(1, Number(res.headers.get('X-Plan-Parts') ?? '1') || 1) }
      }
      const first = await fetchPart(null)
      if ('error' in first) {
        const hint = first.status === 404 || first.status === 403 ? ' The intake account cannot read this link — a person must share it with drive-intake@pipetooling-drive.iam.gserviceaccount.com as Viewer, or attach the PDF.' : ''
        return textContent(`Source ${sourceN} (${src.house_name ?? '?'}) refused (${first.status}): ${first.error}.${hint}`, true)
      }
      let doc: PDFDocument
      let totalBytes = first.bytes.byteLength
      try {
        doc = await PDFDocument.load(first.bytes, { ignoreEncryption: true, updateMetadata: false })
        for (let part = 2; part <= Math.min(first.parts, 8); part++) {
          const more = await fetchPart(part)
          if ('error' in more) break
          totalBytes += more.bytes.byteLength
          if (totalBytes > CAP_BYTES) return textContent(`Source ${sourceN} is over ${Math.round(CAP_BYTES / 1048576)} MB across ${first.parts} files — read it part by part (the plan-fetch ?part lane) or ask a person for the quote alone.`, true)
          const extra = await PDFDocument.load(more.bytes, { ignoreEncryption: true, updateMetadata: false })
          const copied = await doc.copyPages(extra, extra.getPageIndices())
          for (const pg of copied) doc.addPage(pg)
        }
      } catch (e) {
        return textContent(`Could not open source ${sourceN} as a PDF: ${e instanceof Error ? e.message : String(e)}`, true)
      }
      const pageCount = doc.getPageCount()
      const MAX_PAGES = 8
      const spec = String(args.pages ?? '').trim() || '1-8'
      const wanted: number[] = []
      for (const tok of spec.split(',')) {
        const t = tok.trim()
        if (!t) continue
        const mm = /^(\d+)\s*-\s*(\d+)$/.exec(t)
        if (mm) { const a = Number(mm[1]); const bb = Number(mm[2]); for (let n = Math.min(a, bb); n <= Math.max(a, bb); n++) wanted.push(n) }
        else if (/^\d+$/.test(t)) wanted.push(Number(t))
      }
      const pages = [...new Set(wanted)].filter((n) => n >= 1 && n <= pageCount).slice(0, MAX_PAGES)
      if (pages.length === 0) return textContent(JSON.stringify({ ok: true, request: request.id, source: sourceN, house: src.house_name ?? null, page_count: pageCount, pages: [], note: `No pages matched "${spec}" — the quote has ${pageCount} page${pageCount === 1 ? '' : 's'}.` }, null, 2))
      const setKey = (await sha256Hex(`${request.id}:${sourceN}:${src.url ?? ''}:${pageCount}:${totalBytes}`)).slice(0, 10)
      const embed = args.embed === true
      const EMBED_MAX = 3
      const EMBED_BYTES = 3 * 1024 * 1024
      const out: Array<{ page: number; url: string; bytes: number }> = []
      const resources: Array<{ type: 'resource'; resource: { uri: string; mimeType: string; blob: string } }> = []
      let embedded = 0
      for (const n of pages) {
        const one = await PDFDocument.create()
        const [pg] = await one.copyPages(doc, [n - 1])
        one.addPage(pg)
        const bytes = await one.save({ useObjectStreams: true })
        const objectPath = `quote-pages/${request.id}/s${sourceN}/${setKey}/p${String(n).padStart(3, '0')}.pdf`
        const { error: upErr } = await admin.storage.from('twin-plans-tmp').upload(objectPath, bytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) return textContent(`Could not stage page ${n}: ${upErr.message}`, true)
        const url = admin.storage.from('twin-plans-tmp').getPublicUrl(objectPath).data.publicUrl
        out.push({ page: n, url, bytes: bytes.byteLength })
        if (embed && resources.length < EMBED_MAX && embedded + bytes.byteLength <= EMBED_BYTES) {
          let bin = ''
          for (let i = 0; i < bytes.byteLength; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
          resources.push({ type: 'resource', resource: { uri: url, mimeType: 'application/pdf', blob: btoa(bin) } })
          embedded += bytes.byteLength
        }
      }
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pricer STG-1] get_quote_documents — ${src.house_name ?? `source ${sourceN}`}: ${pages.length} of ${pageCount} page${pageCount === 1 ? '' : 's'} staged (${pages.join(', ')}).`,
      }).then(() => {}, () => {})
      const text = JSON.stringify({
        ok: true, request: request.id, source: sourceN, house: src.house_name ?? null, page_count: pageCount, staged: out.length, pages: out,
        ...(embed ? { embedded: resources.length } : {}),
        how: 'Each url is a single-page PDF (public, staged in twin-plans-tmp). Read every page — fixture schedules, carrier and drain sheets, terms. Ask for more pages by number until the page count is covered. Then put_quote for this house with the request row names verbatim.',
      }, null, 2)
      return { content: [{ type: 'text', text }, ...resources], isError: false }
    }
    case 'put_quote': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const loaded = await loadPricerRequest(admin, twin, String(args.request ?? ''))
      if ('error' in loaded) return textContent(loaded.error, true)
      const { request, bid } = loaded
      const house = await resolvePricerHouse(admin, request, args.house)
      if ('error' in house) return textContent(house.error, true)
      const rawLines = Array.isArray(args.lines) ? (args.lines as Array<Record<string, unknown>>) : []
      if (rawLines.length === 0 || rawLines.length > 600) return textContent('put_quote needs 1..600 lines', true)
      const scopeKeys = new Set(request.scope.map((r) => pricerKey(r.fixture)))
      const scopeNames = new Map(request.scope.map((r) => [pricerKey(r.fixture), r.fixture]))
      const problems: string[] = []
      const lines = rawLines.map((l, i) => {
        const fixtureRaw = String(l.fixture ?? '').trim()
        const role = l.component_role == null || String(l.component_role).trim() === '' ? null : String(l.component_role).trim()
        if (!fixtureRaw) problems.push(`line ${i + 1}: fixture is required`)
        if (role && !PRICER_COMPONENT_ROLES.has(role)) problems.push(`line ${i + 1}: component_role "${role}" is not one of ${[...PRICER_COMPONENT_ROLES].join(', ')}`)
        const fixture = scopeNames.get(pricerKey(fixtureRaw)) ?? fixtureRaw
        if (role !== 'loose' && fixtureRaw && !scopeKeys.has(pricerKey(fixtureRaw))) problems.push(`line ${i + 1}: "${fixtureRaw}" is not a row in the request snapshot — use the row names next_price_matrix returned verbatim, or component_role 'loose' for a part that belongs to no row`)
        const priceRaw = l.unit_price_each_cents
        const price = priceRaw == null || priceRaw === '' ? null : Math.round(Number(priceRaw))
        if (price != null && (!Number.isFinite(price) || price < 0)) problems.push(`line ${i + 1}: unit_price_each_cents must be a non-negative integer (cents)`)
        return {
          fixture,
          component_role: role,
          label: l.label == null ? null : String(l.label).slice(0, 300),
          unit_price_each_cents: price,
          cant_supply: l.cant_supply === true,
          option_group: l.option_group == null || String(l.option_group).trim() === '' ? null : String(l.option_group).trim().slice(0, 40),
          option_label: l.option_label == null ? null : String(l.option_label).slice(0, 80),
          option_chosen: l.option_chosen === true,
          page_ref: l.page_ref == null ? null : String(l.page_ref).slice(0, 80),
          alternate_note: l.alternate_note == null ? null : String(l.alternate_note).slice(0, 300),
        }
      })
      // At most one chosen option per (fixture, group).
      const chosenSeen = new Set<string>()
      for (const l of lines) {
        if (l.option_group && l.option_chosen) {
          const k = `${pricerKey(l.fixture)}|${l.option_group}`
          if (chosenSeen.has(k)) problems.push(`"${l.fixture}" ${l.option_group}: more than one option_chosen`)
          chosenSeen.add(k)
        }
      }
      if (problems.length) return textContent(`put_quote NOT written — ${problems.slice(0, 8).join('; ')}${problems.length > 8 ? `; +${problems.length - 8} more` : ''}`, true)
      // Idempotence per (request, house): rewrite only on replace.
      const { data: existing } = await admin.from('bid_quotes').select('id').eq('robot_request_id', request.id).eq('supply_house_id', house.id)
      const existingIds = ((existing ?? []) as Array<{ id: string }>).map((q) => q.id)
      if (existingIds.length && args.replace !== true) return textContent(`${house.name} already has a robot quote on this request — pass replace: true to rewrite it.`, true)
      if (existingIds.length) {
        await admin.from('bid_quote_lines').delete().in('quote_id', existingIds)
        await admin.from('bid_quotes').delete().in('id', existingIds)
      }
      const validUntil = String(args.valid_until ?? '').trim()
      const freight = args.freight_cents == null ? null : Math.round(Number(args.freight_cents))
      const { data: quote, error: qErr } = await admin.from('bid_quotes').insert({
        bid_id: bid.id,
        bid_version_id: request.bid_version_id,
        supply_house_id: house.id,
        quoted_by: args.quoted_by == null ? null : String(args.quoted_by).slice(0, 120),
        source: 'robot',
        valid_until: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
        freight_cents: freight != null && Number.isFinite(freight) ? freight : null,
        note: args.note == null ? null : String(args.note).slice(0, 2000),
        source_doc_url: args.source_doc_url == null ? house.url : String(args.source_doc_url).slice(0, 600),
        robot_request_id: request.id,
        created_by: twin.twinUserId,
      }).select('id').single()
      if (qErr || !quote) return textContent(`Quote not saved: ${qErr?.message ?? 'no row'}`, true)
      const quoteId = (quote as { id: string }).id
      const { error: lErr } = await admin.from('bid_quote_lines').insert(lines.map((l) => ({
        quote_id: quoteId,
        fixture: l.fixture,
        unit_price_each_cents: l.cant_supply ? null : l.unit_price_each_cents,
        price_basis: 'each',
        basis_qty: 1,
        basis_price_cents: l.cant_supply ? null : l.unit_price_each_cents,
        cant_supply: l.cant_supply,
        alternate_note: l.alternate_note,
        match_confidence: 'manual',
        matched_from: l.label,
        picked: false,
        component_role: l.component_role,
        label: l.label,
        option_group: l.option_group,
        option_label: l.option_label,
        option_chosen: l.option_chosen,
        page_ref: l.page_ref,
      })))
      if (lErr) {
        await admin.from('bid_quotes').delete().eq('id', quoteId)
        return textContent(`Lines not saved (quote rolled back): ${lErr.message}`, true)
      }
      // Price memory: the fixture's $/each per house — kit subtotals, plain lines, chosen options. Deduped per fixture key.
      const memory = new Map<string, Record<string, unknown>>()
      for (const l of lines) {
        if (l.cant_supply || l.unit_price_each_cents == null) continue
        if (l.component_role && l.component_role !== 'kit') continue
        if (l.option_group && !l.option_chosen) continue
        memory.set(pricerKey(l.fixture), { supply_house_id: house.id, fixture: l.fixture, unit_price_each_cents: l.unit_price_each_cents, quoted_at: new Date().toISOString(), source_bid_id: bid.id })
      }
      if (memory.size) await admin.from('supply_house_fixture_prices').upsert([...memory.values()], { onConflict: 'supply_house_id,fixture_key' }).then(() => {}, () => {})
      const kits = lines.filter((l) => l.component_role === 'kit').length
      const carriers = lines.filter((l) => l.component_role === 'carrier').length
      const options = lines.filter((l) => l.option_group).length
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pricer STG-2] put_quote ${house.name} — ${lines.length} lines (${kits} kit subtotal${kits === 1 ? '' : 's'}, ${carriers} carrier${carriers === 1 ? '' : 's'}, ${options} option line${options === 1 ? '' : 's'})${validUntil ? ` · valid until ${validUntil}` : ''}${existingIds.length ? ' · replaced the earlier robot quote' : ''}.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({ ok: true, quote_id: quoteId, house: house.name, lines: lines.length, kits, carriers, option_lines: options, replaced: existingIds.length > 0, next: 'Next house, or finish_price_matrix when every readable source is written.' }, null, 2))
    }
    case 'finish_price_matrix': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const loaded = await loadPricerRequest(admin, twin, String(args.request ?? ''), ['working', 'ready'])
      if ('error' in loaded) return textContent(loaded.error, true)
      const { request, bid } = loaded
      const summary = String(args.summary ?? '').trim().slice(0, 2000)
      if (!summary) return textContent('finish_price_matrix needs a summary for the estimator', true)
      const nowIso = new Date().toISOString()
      if (args.blocked === true) {
        await admin.from('bid_price_matrix_requests').update({ status: 'blocked', summary, finished_at: nowIso, heartbeat_at: nowIso, updated_at: nowIso }).eq('id', request.id)
        await admin.from('bids_submission_entries').insert({ bid_id: bid.id, notes: `[pricer BLOCKED] request ${request.id.slice(0, 8)} — ${summary.slice(0, 400)}` }).then(() => {}, () => {})
        return textContent(JSON.stringify({ ok: true, status: 'blocked', next: 'ask_question with audience operator for the machine problem (a folder not shared, a link that is not a PDF), heartbeat blocked, then next_price_matrix.' }, null, 2))
      }
      // The robot quotes on this request, with their lines.
      const { data: quotes } = await admin.from('bid_quotes').select('id, supply_house_id, valid_until, freight_cents, supply_houses(name)').eq('robot_request_id', request.id)
      const qRows = (quotes ?? []) as Array<{ id: string; supply_house_id: string | null; valid_until: string | null; freight_cents: number | null; supply_houses: { name: string } | Array<{ name: string }> | null }>
      if (qRows.length === 0) return textContent('No robot quotes on this request yet — put_quote at least one house first, or finish with blocked: true.', true)
      const houseName = (q: typeof qRows[number]) => (Array.isArray(q.supply_houses) ? q.supply_houses[0]?.name : q.supply_houses?.name) ?? 'house'
      const quoteIds = qRows.map((q) => q.id)
      const { data: lineRows } = await admin.from('bid_quote_lines').select('id, quote_id, fixture, unit_price_each_cents, cant_supply, component_role, option_group, option_chosen, picked, pick_source').in('quote_id', quoteIds)
      const lines = (lineRows ?? []) as Array<{ id: string; quote_id: string; fixture: string; unit_price_each_cents: number | null; cant_supply: boolean; component_role: string | null; option_group: string | null; option_chosen: boolean; picked: boolean; pick_source: string | null }>
      const countByKey = new Map(request.scope.map((r) => [pricerKey(r.fixture), Number(r.count) || 0]))
      const today = todayYmdInAppTz()
      // Picks.
      const picks = Array.isArray(args.picks) ? (args.picks as Array<Record<string, unknown>>) : []
      const problems: string[] = []
      const pickedKeys = new Set<string>()
      let totalCents = 0
      // Clear earlier robot picks on these quotes so a re-finish is idempotent.
      const robotPicked = lines.filter((l) => l.picked && l.pick_source === 'robot').map((l) => l.id)
      if (robotPicked.length) await admin.from('bid_quote_lines').update({ picked: false, pick_reason: null, pick_source: null }).in('id', robotPicked)
      for (const p of picks) {
        const fixture = String(p.fixture ?? '').trim()
        const key = pricerKey(fixture)
        if (!countByKey.has(key)) { problems.push(`pick "${fixture}" is not a row in the request`); continue }
        const house = await resolvePricerHouse(admin, request, p.house)
        if ('error' in house) { problems.push(`pick "${fixture}": ${house.error}`); continue }
        const quote = qRows.find((q) => q.supply_house_id === house.id)
        if (!quote) { problems.push(`pick "${fixture}": ${house.name} has no robot quote on this request`); continue }
        const cellLines = lines.filter((l) => l.quote_id === quote.id && pricerKey(l.fixture) === key)
        if (cellLines.length === 0) { problems.push(`pick "${fixture}": ${house.name} did not quote it`); continue }
        const priced = cellLines.filter((l) => !l.cant_supply && l.unit_price_each_cents != null && (!l.option_group || l.option_chosen))
        if (priced.length === 0) { problems.push(`pick "${fixture}": ${house.name}'s lines carry no price (an option group with no option_chosen?)`); continue }
        const reason = String(p.reason ?? '').trim().slice(0, 300) || 'robot pick'
        await admin.from('bid_quote_lines').update({ picked: true, pick_reason: reason, pick_source: 'robot' }).in('id', cellLines.map((l) => l.id))
        const each = priced.reduce((acc, l) => acc + (l.unit_price_each_cents ?? 0), 0)
        totalCents += each * (countByKey.get(key) ?? 0)
        pickedKeys.add(key)
      }
      // Asks — the estimator lane, one decision each, tap-answerable.
      const asks = Array.isArray(args.asks) ? (args.asks as Array<Record<string, unknown>>) : []
      let filed = 0
      for (const a of asks) {
        const fixture = String(a.fixture ?? '').trim()
        const q = String(a.question ?? '').trim()
        if (!q) { problems.push(`ask "${fixture}": empty question`); continue }
        const shape = checkEstimatorQuestionShape({ question: q, choices: a.choices, recommended: a.recommended })
        if (!shape.ok) { problems.push(`ask "${fixture}" not filed — ${shape.problems.join('; ')}`); continue }
        const base = { twin_user_id: twin.twinUserId, about_bid_id: bid.id, mission: `price-matrix:${request.id.slice(0, 8)}`, question: q, topic: `price-matrix-${pricerSlug(fixture) || 'row'}` }
        let ins = await admin.from('twin_questions').insert({ ...base, audience: 'estimator', choices: shape.choices, recommended: shape.recommended, kind: 'decision' }).select('id').single()
        if (ins.error && /\bkind\b/i.test(ins.error.message)) ins = await admin.from('twin_questions').insert({ ...base, audience: 'estimator', choices: shape.choices, recommended: shape.recommended }).select('id').single()
        if (ins.error) { problems.push(`ask "${fixture}" not saved: ${ins.error.message}`); continue }
        filed += 1
      }
      const expired = qRows.filter((q) => q.valid_until && q.valid_until < today).map(houseName)
      const result = {
        houses_read: qRows.length,
        rows_priced: pickedKeys.size,
        rows_asked: filed,
        total_cents_at_counts: Math.round(totalCents),
        expired_houses: expired,
        rows_total: request.scope.length,
      }
      await admin.from('bid_price_matrix_requests').update({ status: 'ready', summary, result, finished_at: nowIso, heartbeat_at: nowIso, updated_at: nowIso }).eq('id', request.id)
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pricer STG-3] matrix ready — ${qRows.length} house${qRows.length === 1 ? '' : 's'} read (${qRows.map(houseName).join(', ')}), ${pickedKeys.size} of ${request.scope.length} rows picked, ${filed} ask${filed === 1 ? '' : 's'} for the estimator, $${(Math.round(totalCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} at counts before freight${expired.length ? ` · expired: ${expired.join(', ')}` : ''}. ${summary.slice(0, 300)}`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, status: 'ready', ...result,
        problems: problems.length ? problems : undefined,
        next: 'heartbeat done, submit_report (label PRICE-<bid>), then next_price_matrix. The estimator sees "Matrix ready" on the bid; her taps on your asks come back through get_answers.',
      }, null, 2))
    }
    case 'extend_component_rules': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const mirror = String(args.mirror_note ?? '').trim()
      const rules = Array.isArray(args.rules) ? (args.rules as Array<Record<string, unknown>>) : []
      if (!mirror || rules.length === 0 || rules.length > 20) return textContent('extend_component_rules needs 1..20 rules + a mirror_note naming where they came from', true)
      const KINDS = new Set(['placement', 'sheet', 'option_default', 'required_role'])
      const rows = rules.map((r) => ({
        rule: String(r.rule ?? '').trim().slice(0, 600),
        kind: KINDS.has(String(r.kind ?? '')) ? String(r.kind) : 'placement',
        fixture_pattern: r.fixture_pattern == null ? null : String(r.fixture_pattern).slice(0, 120),
        role: r.role == null || !PRICER_COMPONENT_ROLES.has(String(r.role)) ? null : String(r.role),
        source: 'robot',
        created_by: twin.twinUserId,
        mirror_note: mirror.slice(0, 600),
      })).filter((r) => r.rule)
      if (rows.length === 0) return textContent('Every rule needs text', true)
      const { data, error } = await admin.from('fixture_component_rules').insert(rows).select('id')
      if (error) return textContent(`Rules not saved: ${error.message}`, true)
      return textContent(JSON.stringify({ ok: true, added: (data ?? []).length, note: 'The estimator sees these as receipts and can retire any of them; a retired rule stays out of get_component_rules.' }, null, 2))
    }
    case 'get_mission': {
      const m = MISSIONS[String(args.id ?? '').toUpperCase()]
      if (!m) return textContent(`Unknown mission id. Available: ${Object.keys(MISSIONS).join(', ')}`, true)
      return textContent(`# ${m.title}\nPrerequisites: ${m.prerequisites}\n\nMISSION (verbatim):\n${m.text}`)
    }
    case 'mint_session': {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const app = String(args.app ?? 'pipetooling')
      if (app === 'takeofftooling') {
        // Three-app companion (v2.3082): TakeoffTooling is the electrical explode-and-cost
        // app. Same shape as the CountTooling branch below — this server holds TT's fleet
        // secret, mirrors the per-twin token hash over the TT bridge (best-effort), mints
        // with the per-twin token first, and rate-limits against the shared ledger.
        const ttUrl = Deno.env.get('TT_TWIN_LOGIN_URL')
        const ttSecret = Deno.env.get('TAKEOFFTOOLING_TWIN_LOGIN_SECRET')
        if (!ttUrl || !ttSecret) return textContent('TakeoffTooling minting is not configured on this server (TT_TWIN_LOGIN_URL / TAKEOFFTOOLING_TWIN_LOGIN_SECRET)', true)
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
        const { count } = await admin.from('twin_runs').select('id', { count: 'exact', head: true }).eq('twin_user_id', twin.twinUserId).gte('started_at', oneMinuteAgo)
        if ((count ?? 0) >= 6) return textContent('Rate limited: max 6 mints per minute per twin (across all apps). Wait a minute and retry.', true)
        const ttEmail = ttTwinEmail(twin.email)
        const redirectTo = (args.redirectTo as string) || 'https://takeofftooling.com'
        const rawToken = presentedToken(req)!
        if (ttBridgeConfigured()) {
          try { await callTtManageUser({ verb: 'set_twin_credential', email: ttEmail, token_hash: await sha256Hex(rawToken) }) } catch (_) { /* best-effort; the secret fallback still mints */ }
        }
        let res = await fetch(ttUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken }, body: JSON.stringify({ email: ttEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }) })
        if (res.status === 401) {
          console.log('[twin-mcp] TT per-twin mint refused; falling back to fleet secret')
          res = await fetch(ttUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ttSecret }, body: JSON.stringify({ email: ttEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }) })
        }
        const body = await res.json().catch(() => ({}))
        if (!res.ok) return textContent(`TakeoffTooling mint failed (${res.status}): ${body.error ?? 'unknown'}${res.status === 404 ? ' — no TT seat yet: Settings → Digital twins → link the TT seat' : ''}`, true)
        try {
          await admin.from('twin_runs').insert({ twin_user_id: twin.twinUserId, mission: (args.run as string) || 'mcp-mint', notes: `mint via=token:${twin.credId} app=takeofftooling redirect=${redirectTo}` })
        } catch (_) { /* ledger best-effort */ }
        return textContent(JSON.stringify({ ok: true, app: 'takeofftooling', email: ttEmail, action_link: body.action_link, note: 'single-use — navigate a browser to it, or walk the verify redirect for the session JWT that authorizes import-manifest' }, null, 2))
      }
      if (app === 'counttooling') {
        // Two-app companion (v2.2439): this server holds CountTooling's twin secret, so
        // one per-twin credential covers both apps (locked decision — CT per-twin
        // credential parity stays deferred). PT's twin-login isn't in this path, so its
        // guards don't run — re-apply the essentials here: the twin was already
        // resolved+eligibility-checked above, and the 6/min rate limit is enforced
        // against the shared twin_runs ledger before minting.
        const ctUrl = Deno.env.get('CT_TWIN_LOGIN_URL')
        const ctSecret = Deno.env.get('COUNTTOOLING_TWIN_LOGIN_SECRET')
        if (!ctUrl || !ctSecret) return textContent('CountTooling minting is not configured on this server (CT_TWIN_LOGIN_URL / COUNTTOOLING_TWIN_LOGIN_SECRET)', true)
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
        const { count } = await admin
          .from('twin_runs')
          .select('id', { count: 'exact', head: true })
          .eq('twin_user_id', twin.twinUserId)
          .gte('started_at', oneMinuteAgo)
        if ((count ?? 0) >= 6) return textContent('Rate limited: max 6 mints per minute per twin (across both apps). Wait a minute and retry.', true)
        const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
        const redirectTo = (args.redirectTo as string) || 'https://counttooling.com'
        // CT-4 per-twin credential parity: mirror this token's hash to CT (idempotent,
        // best-effort — needs the manage-user bridge), then mint with the PER-TWIN token.
        // Fall back to the shared fleet secret only if CT doesn't know the token yet.
        const rawToken = presentedToken(req)!
        const bridgeUrl = Deno.env.get('CT_MANAGE_USER_URL')
        const bridgeSecret = Deno.env.get('CT_MANAGE_USER_SECRET')
        if (bridgeUrl && bridgeSecret) {
          try {
            await fetch(bridgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': bridgeSecret },
              body: JSON.stringify({ verb: 'set_twin_credential', email: ctEmail, token_hash: await sha256Hex(rawToken) }),
            })
          } catch (_) { /* sync best-effort; the secret fallback below still mints */ }
        }
        let res = await fetch(ctUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken },
          body: JSON.stringify({ email: ctEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }),
        })
        if (res.status === 401) {
          console.log('[twin-mcp] CT per-twin mint refused; falling back to fleet secret')
          res = await fetch(ctUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ctSecret },
            body: JSON.stringify({ email: ctEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }),
          })
        }
        const body = await res.json().catch(() => ({}))
        if (!res.ok) return textContent(`CountTooling mint failed (${res.status}): ${body.error ?? 'unknown'}`, true)
        try {
          await admin.from('twin_runs').insert({
            twin_user_id: twin.twinUserId,
            mission: (args.run as string) || 'mcp-mint',
            notes: `mint via=token:${twin.credId} app=counttooling redirect=${redirectTo}`,
          })
        } catch (_) { /* ledger best-effort */ }
        return textContent(JSON.stringify({ ok: true, app: 'counttooling', email: ctEmail, action_link: body.action_link, note: 'single-use — navigate a browser to it, or curl -s -o /dev/null -w %{redirect_url} it once to read the JWT from the fragment' }, null, 2))
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/twin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': presentedToken(req)! },
        body: JSON.stringify({ redirectTo: (args.redirectTo as string) || (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') + '/bids', run: (args.run as string) || 'mcp-mint' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return textContent(`Mint failed (${res.status}): ${body.error ?? 'unknown'}`, true)
      return textContent(JSON.stringify({ ok: true, app: 'pipetooling', email: twin.email, action_link: body.action_link, note: 'single-use — navigate a browser to it, or curl -s -o /dev/null -w %{redirect_url} it once to read the JWT from the fragment' }, null, 2))
    }
    case 'ask_question': {
      const q = String(args.question ?? '').trim()
      if (!q) return textContent('Empty question', true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let aboutBidId: string | null = null
      const bidRef = String(args.bid ?? '').trim()
      if (bidRef) {
        const uuidRe = /^[0-9a-f-]{36}$/i
        const { data: b } = await (uuidRe.test(bidRef)
          ? admin.from('bids').select('id').eq('id', bidRef).maybeSingle()
          : admin.from('bids').select('id').eq('bid_number', bidRef.replace(/^(bp|b)/i, '')).maybeSingle())
        aboutBidId = (b as { id: string } | null)?.id ?? null
      }
      // topic (v2.2939): the standing-rulings key — one kebab slug per doctrine issue
      // ('travel-bands', 'small-ti-absorption') so duplicate asks collapse into one ruling.
      const topic = String(args.topic ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || null
      // audience (v1.3.14): the robot's choice, else the text decides — machine
      // vocabulary routes to the operator so the estimator's panel holds only
      // questions about the job. Column lands with 20260909045818; if the insert
      // is refused for the column, retry without it (edge deployed ahead of push).
      const classified = classifyTwinQuestionAudience(q)
      const audience = isTwinQuestionAudience(args.audience) ? args.audience : classified.audience
      // Shape (v1.3.15 / v2.3210): an estimator question must be tap-answerable —
      // one decision, 2–4 short choices, the robot's pick. The operator lane is
      // unconstrained (machine problems are messy); choices are kept if given.
      // kind (v1.3.16 / v2.3212): a plans ask is a task on ONE bid, routed to its
      // robot needs sheet; the robot names it, else the text decides. A plans ask
      // with no choices gets the standard taps so the estimator never types.
      const kindClassified = classifyTwinQuestionKind(q)
      const kind = isTwinQuestionKind(args.kind) ? args.kind : kindClassified.kind
      const plansDefaults = kind === 'plans' && !Array.isArray(args.choices)
      let choices: string[] | null = null
      let recommended: string | null = null
      if (audience === 'estimator') {
        const shape = checkEstimatorQuestionShape({
          question: q,
          choices: plansDefaults ? [...PLANS_ASK_DEFAULT_CHOICES] : args.choices,
          recommended: plansDefaults ? PLANS_ASK_DEFAULT_RECOMMENDED : args.recommended,
        })
        if (!shape.ok) return textContent(`Question NOT filed for the estimator — ${shape.problems.join('; ')}. ${shape.hint}`, true)
        choices = shape.choices
        recommended = shape.recommended
      } else {
        choices = normalizeTwinQuestionChoices(args.choices)
        recommended = choices ? matchRecommended(args.recommended, choices) : null
      }
      const base = { twin_user_id: twin.twinUserId, about_bid_id: aboutBidId, mission: (args.mission as string) ?? null, question: q, topic }
      // Column ladder: choices/recommended land with 20260909233000, audience with
      // 20260909045818 — retry without whichever the insert is refused for (edge
      // deployed ahead of push).
      let ins = await admin.from('twin_questions').insert({ ...base, audience, choices, recommended, kind }).select('id').single()
      if (ins.error && /\bkind\b/i.test(ins.error.message)) ins = await admin.from('twin_questions').insert({ ...base, audience, choices, recommended }).select('id').single()
      if (ins.error && /choices|recommended/i.test(ins.error.message)) ins = await admin.from('twin_questions').insert({ ...base, audience }).select('id').single()
      if (ins.error && /audience/i.test(ins.error.message)) ins = await admin.from('twin_questions').insert(base).select('id').single()
      const { data: row, error } = ins
      if (error) return textContent(`Question not saved: ${error.message}`, true)
      const lane = audience === 'operator'
        ? `Filed for the OPERATOR (${isTwinQuestionAudience(args.audience) ? 'your call' : `classified: ${classified.signals.join(', ')}`}) — it shows on the fleet console, not the estimator's panel.`
        : kind === 'plans'
          ? `Filed as a PLANS ask (${isTwinQuestionKind(args.kind) ? 'your call' : `classified: ${kindClassified.signals.join(', ')}`}) — it shows on ${aboutBidId ? 'the bid\'s' : 'a'} robot needs sheet (the amber icon on the Bid Board) with ${choices?.length ?? 0} taps${plansDefaults ? ' (the standard three)' : ''}, not on Standing rulings.${aboutBidId ? '' : ' You passed no bid — a plans ask without a bid has no sheet to land on; pass bid next time.'}`
          : `Filed for the ESTIMATOR — it shows on Bids → Audits → Standing rulings as ${choices?.length ?? 0} tap${choices?.length === 1 ? '' : 's'}${recommended ? ` (your pick "${recommended}" first)` : ''}.`
      return textContent(`Question parked (id ${(row as { id: string }).id.slice(0, 8)}). ${lane} Pull answers with get_answers on your next run. Keep working what you can.`)
    }
    case 'get_answers': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let sel = admin
        .from('twin_questions')
        .select('id, about_bid_id, mission, question, status, answer, answered_at, promoted_rfi_id, created_at, topic, choices, recommended, kind')
        .eq('twin_user_id', twin.twinUserId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (args.open_only === true) sel = sel.eq('status', 'open')
      const { data, error } = await sel
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      if (!data?.length) return textContent(args.open_only === true ? 'No open questions.' : 'No questions yet — ask_question parks one.')
      // Blindness redaction (v2.2868): an answer can quote a reference's value — it
      // happened on R2-BT-20, where a parked answer named the reference bid and its won
      // number, exposing a blind run before its lock. Every reference this twin holds an
      // UNSEALED shell against gets its mentions redacted; the item comes back after the
      // shell's STG-6 (or shadow score) breaks the seal. Over-redaction is safe; a leak
      // is not.
      const { data: shells } = await admin.from('bids')
        .select('id, bid_number, twin_source_bid_id')
        .eq('created_by', twin.twinUserId)
        .not('twin_source_bid_id', 'is', null)
      let redacted = 0
      let out = data
      if (shells?.length) {
        const [{ data: scored }, { data: shadowScored }] = await Promise.all([
          admin.from('twin_run_scores').select('twin_bid_number').in('twin_bid_number', shells.map((s) => String(s.bid_number))),
          admin.from('twin_shadow_runs').select('shadow_bid_id').not('scored_at', 'is', null).in('shadow_bid_id', shells.map((s) => s.id)),
        ])
        const scoredNums = new Set((scored ?? []).map((r) => String(r.twin_bid_number)))
        const scoredShadowIds = new Set((shadowScored ?? []).map((r) => r.shadow_bid_id))
        const unsealed = shells.filter((s) => !scoredNums.has(String(s.bid_number)) && !scoredShadowIds.has(s.id))
        if (unsealed.length) {
          const { data: refs } = await admin.from('bids')
            .select('id, bid_number, project_name')
            .in('id', unsealed.map((s) => s.twin_source_bid_id))
          const matchers = (refs ?? []).map((r) => ({
            tag: `b${r.bid_number}`,
            numRe: new RegExp(`\\bbp?${r.bid_number}\\b`, 'i'),
            name: String(r.project_name ?? '').trim().toLowerCase(),
          }))
          out = data.map((q: Record<string, unknown>) => {
            const text = `${q.question ?? ''}\n${q.answer ?? ''}`.toLowerCase()
            const hit = matchers.find((m) => m.numRe.test(text) || (m.name.length >= 6 && text.includes(m.name)))
            if (!hit) return q
            redacted++
            return {
              id: q.id, status: q.status, created_at: q.created_at, mission: q.mission,
              redacted: true,
              note: `Redacted: this item mentions ${hit.tag}, a reference you currently hold a blind shell against. It will be readable again after that shell's scorecard breaks the seal.`,
            }
          })
        }
      }
      return textContent(JSON.stringify({ questions: out, ...(redacted ? { redacted_for_blindness: redacted } : {}) }, null, 2))
    }
    case 'heartbeat': {
      const stage = String(args.stage ?? '').trim()
      const state = String(args.state ?? '').trim()
      if (!stage || !['working', 'blocked', 'done'].includes(state)) return textContent("heartbeat needs stage + state in {working|blocked|done}", true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let bidId: string | null = null
      const bidRef = String(args.bid ?? '').trim()
      if (bidRef) {
        const uuidRe = /^[0-9a-f-]{36}$/i
        const { data: b } = await (uuidRe.test(bidRef)
          ? admin.from('bids').select('id').eq('id', bidRef).maybeSingle()
          : admin.from('bids').select('id').eq('bid_number', bidRef.replace(/^(bp|b)/i, '')).maybeSingle())
        bidId = (b as { id: string } | null)?.id ?? null
      }
      const { error } = await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: 'heartbeat',
        bid_id: bidId,
        stage,
        state,
        notes: `heartbeat stage=${stage} state=${state}${args.note ? ` ${String(args.note).slice(0, 400)}` : ''}`,
        ended_at: state === 'done' ? new Date().toISOString() : null,
      })
      if (error) return textContent(`Heartbeat not recorded: ${error.message}`, true)
      return textContent('Heartbeat recorded.')
    }
    case 'get_assignments': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: bids, error } = await admin
        .from('bids')
        .select('id, bid_number, project_name, bid_due_date, bid_date_sent, outcome, address, drive_link, plans_link, count_tooling_plans_link, customers(name)')
        .eq('estimator_id', twin.twinUserId)
        .order('bid_due_date', { ascending: true, nullsFirst: false })
        .limit(50)
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      if (!bids?.length) return textContent('No bids are currently assigned to you (estimator = your twin). Ask the operator, or check get_brief for the mission flow.')
      const rows = bids.map((b: Record<string, unknown>) => ({
        bid: b.bid_number ? `b${b.bid_number}` : b.id,
        bid_id: b.id,
        project: b.project_name,
        gc: (b.customers as { name?: string } | null)?.name ?? null,
        due: b.bid_due_date,
        sent: b.bid_date_sent,
        outcome: b.outcome ?? 'open',
        address: b.address,
        links: { drive: !!b.drive_link, plans: !!b.plans_link, counttooling: !!b.count_tooling_plans_link },
      }))
      return textContent(JSON.stringify({ assignments: rows }, null, 2))
    }
    case 'get_plan_brief':
    case 'get_work_state': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      if (!ref) return textContent('Missing bid (bid number like b403, or uuid)', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let q = admin
        .from('bids')
        .select('id, bid_number, project_name, bid_due_date, bid_due_time, bid_date_sent, outcome, bid_value, address, drive_link, plans_link, count_tooling_plans_link, itb_links, estimator_id, created_by, last_contact, twin_source_bid_id, customers(name)')
      q = uuidRe.test(ref) ? q.eq('id', ref) : q.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error } = await q.maybeSingle()
      if (error) return textContent(`Bid lookup failed: ${error.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      // Assignment is the grant: these reads serve only the twin's own bids.
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not assigned to you (estimator) and was not created by you — get_assignments lists your queue.`, true)
      }
      const { data: sub } = await admin
        .from('bids_plan_substrates')
        .select('version, substrate, created_at')
        .eq('bid_id', bid.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (name === 'get_plan_brief') {
        if (!sub) return textContent(`No plan substrate on bid ${ref} yet — STG-2 is YOURS to do: fetch the plan set (plans link / plan-fetch), follow EXTRACTOR.md (bundled in get_placement_guide) to build the substrate, then attach it with put_substrate and call get_plan_brief again. Do not skip to the takeoff without it.`, true)
        const s = sub.substrate as Record<string, unknown>
        const payload = args.full === true
          ? s
          : {
              substrate_version: s.substrate_version,
              generated_at: s.generated_at,
              supersedes: s.supersedes,
              source: s.source,
              bid: s.bid,
              rollup: s.rollup,
              note: 'Rollup only — pass full: true for every per-sheet record (schedules, notes, crops).',
            }
        return textContent(JSON.stringify(payload, null, 2))
      }
      // get_work_state
      const countFor = async (table: string) => {
        const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('bid_id', bid.id)
        return count ?? 0
      }
      const [countRowsCount, exactMappings, roughLines, laborEstimates, priceBookCopies, openQuestions] = await Promise.all([
        countFor('bids_count_rows'),
        countFor('bids_takeoff_template_mappings'),
        countFor('bids_takeoff_rough_part_lines'),
        countFor('cost_estimates'),
        countFor('price_book_versions'),
        admin.from('twin_questions').select('id', { count: 'exact', head: true }).eq('twin_user_id', twin.twinUserId).eq('about_bid_id', bid.id).eq('status', 'open').then((r) => r.count ?? 0),
      ])
      const { data: rfiRows } = await admin.from('bids_rfis').select('rfi_number, status').eq('bid_id', bid.id).order('rfi_number')
      const { data: hb } = await admin
        .from('twin_runs')
        .select('stage, state, notes, started_at')
        .eq('twin_user_id', twin.twinUserId)
        .eq('mission', 'heartbeat')
        .eq('bid_id', bid.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: entries } = await admin
        .from('bids_submission_entries')
        .select('occurred_at, contact_method, notes')
        .eq('bid_id', bid.id)
        .order('occurred_at', { ascending: false })
        .limit(10)
      const state = {
        bid: {
          bid: bid.bid_number ? `b${bid.bid_number}` : bid.id,
          bid_id: bid.id,
          project: bid.project_name,
          gc: (bid.customers as { name?: string } | null)?.name ?? null,
          due: bid.bid_due_date,
          sent: bid.bid_date_sent,
          outcome: bid.outcome ?? 'open',
          bid_value: bid.bid_value,
          last_contact: bid.last_contact,
          address: bid.address,
          // v2.2939: a shadow/backtest shell can now verify its own pairing.
          twin_source_bid_id: bid.twin_source_bid_id ?? null,
        },
        links: {
          drive: bid.drive_link ?? null,
          plans: bid.plans_link ?? null,
          counttooling: bid.count_tooling_plans_link ?? null,
          itb: bid.itb_links ?? null,
        },
        substrate: sub ? { version: (sub.substrate as Record<string, unknown>).substrate_version, attached_at: sub.created_at } : null,
        counts_rows: countRowsCount,
        middle: {
          takeoff_exact_mappings: exactMappings,
          takeoff_rough_part_lines: roughLines,
          labor_estimates: laborEstimates,
          price_book_copies: priceBookCopies,
        },
        rfis: (rfiRows ?? []).map((r: Record<string, unknown>) => ({ n: r.rfi_number, status: r.status })),
        open_questions_here: openQuestions,
        latest_heartbeat: hb ? { at: hb.started_at, stage: hb.stage, state: hb.state } : null,
        audit_ledger_tail: (entries ?? []).map((e: Record<string, unknown>) => ({
          at: e.occurred_at, method: e.contact_method ?? 'note', note: String(e.notes ?? '').slice(0, 300),
        })),
        // CT-3 (Wave 3.6 closure): the twin's CountTooling projects with review state —
        // 'changes' + review_note is the reviewer sending the takeoff BACK; fix and
        // re-mark ready. Fetched over the CT bridge; degrades to an error note, never a throw.
        // v2.3082: the electrical STG-4 — the twin's TakeoffTooling manifest for THIS bid
        // (bid stamp match only), with the priced rows PipeTooling's paste_counts takes.
        // Absent on plumbing bids by construction; degrades to an error note, never a throw.
        tt_manifest: await (async () => {
          try {
            if (!ttBridgeConfigured()) return { error: 'TT bridge not configured' }
            const ttEmail = ttTwinEmail(twin.email)
            const tag = `b${bid.bid_number}`
            const { status, json } = await callTtManageUser({ verb: 'twin_projects', email: ttEmail })
            if (status !== 200) return { error: `TT bridge ${status}: ${json?.error ?? 'unknown'}` }
            const projects = ((json.projects ?? []) as Array<Record<string, unknown>>).filter((p) => {
              const ext = String(p.external_ref ?? '').trim().toLowerCase()
              return ext === tag.toLowerCase() || ext === String(bid.bid_number)
            })
            if (!projects.length) return { projects: [], rows: null, note: `No TakeoffTooling manifest is stamped with ${tag} — tt_finish_costing creates one (electrical bids only; plumbing bids never have one).` }
            const m = await callTtManageUser({ verb: 'twin_manifest', email: ttEmail, project_id: projects[0].id })
            return m.status === 200 ? { projects, ...m.json } : { projects, error: `twin_manifest ${m.status}: ${m.json?.error ?? 'unknown'}` }
          } catch (e) {
            return { error: String(e instanceof Error ? e.message : e) }
          }
        })(),
        ct_takeoff: await (async () => {
          try {
            const ctUrl = Deno.env.get('CT_MANAGE_USER_URL')
            const ctSecret = Deno.env.get('CT_MANAGE_USER_SECRET')
            if (!ctUrl || !ctSecret) return { error: 'CT bridge not configured' }
            const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
            const r = await fetch(ctUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': ctSecret },
              body: JSON.stringify({ verb: 'twin_projects', email: ctEmail }),
            })
            const body = await r.json()
            if (!r.ok) return { error: `CT bridge ${r.status}: ${body?.error ?? 'unknown'}` }
            const allProjects = (body.projects ?? []) as Array<Record<string, unknown>>
            // v2.2806: only THIS bid's project(s) — ct_finish_takeoff stamps external_ref
            // with the bid tag, and the project name carries the ZZ name. A blind
            // round-2 run must never see another bid's project or notes ledger.
            const tag = `b${bid.bid_number}`
            const nameKey = String(bid.project_name ?? '').trim().toLowerCase()
            const projects = allProjects.filter((p) => {
              const ext = String(p.external_ref ?? '').trim().toLowerCase()
              const nm = String(p.name ?? '').trim().toLowerCase()
              return ext === tag.toLowerCase() || ext === String(bid.bid_number) || (nameKey.length > 0 && nm === nameKey)
            })
            // Notes-ledger loop (2026-08-30): pull the note ledger of this bid's most
            // recently touched project — open RFIs are questions still waiting,
            // answered ones carry the reviewer's answer (read before re-asking).
            let rfis: unknown = null
            const newest = projects[0]
            if (!newest) return { projects: [], notes_ledger: null, note: `No CountTooling project is stamped with ${tag} (external_ref) or named like this bid — ct_finish_takeoff creates one.` }
            if (newest?.id) {
              try {
                const rr = await fetch(ctUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': ctSecret },
                  body: JSON.stringify({ verb: 'twin_rfis', email: ctEmail, project_id: newest.id }),
                })
                const rb = await rr.json()
                rfis = rr.ok ? rb : { error: `twin_rfis ${rr.status}: ${rb?.error ?? 'unknown'}` }
              } catch (e) {
                rfis = { error: String(e instanceof Error ? e.message : e) }
              }
            }
            return { projects, notes_ledger: rfis }
          } catch (e) {
            return { error: String(e instanceof Error ? e.message : e) }
          }
        })(),
      }
      return textContent(JSON.stringify(state, null, 2))
    }
    case 'file_plans': {
      // Thin pass-through to drive-intake — the token re-authenticates there and the
      // assignment check runs server-side; this keeps Drive logic single-sourced.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const res = await fetch(`${supabaseUrl}/functions/v1/drive-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': presentedToken(req)! },
        body: JSON.stringify({ bid: args.bid, plans_url: args.plans_url, plans_file_name: args.plans_file_name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return textContent(`file_plans failed (${res.status}): ${body.error ?? 'unknown'}`, true)
      return textContent(JSON.stringify(body, null, 2))
    }
    case 'submit_report': {
      const mission = String(args.mission ?? args.label ?? '').trim() || 'unlabeled'
      const report = String(args.report ?? '').trim()
      if (!report) return textContent('Empty report', true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: `report:${mission}`,
        notes: report.slice(0, 8000),
        ended_at: new Date().toISOString(),
      })
      if (error) return textContent(`Report not saved: ${error.message}`, true)
      return textContent(`Report filed for ${mission} — it is in the fleet ledger, attributed to ${twin.email}.`)
    }
    case 'open_backtest': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const r = await openBacktestShell(admin, twin, String(args.reference_bid ?? ''), { round: Number(args.round ?? 1), dueInDays: Number(args.due_in_days ?? 7), gateRun: args.gate_run === true })
      if (!r.ok) return textContent(r.error, true)
      return textContent(JSON.stringify({
        ...r,
        next: r.reused ? undefined : 'STG-2 substrate is yours (get_plan_brief tells you when it is missing); then takeoff (STG-3), counts+books (STG-5) BEFORE the lock, then score_backtest (STG-6) and the audit questions.',
      }, null, 2))
    }
    case 'get_plan_pages': {
      // v2.3230 / v1.3.18: the plan set for a shell-less harness. plan-fetch already
      // merges folders and streams parts for a caller with the twin token; this verb
      // does that fetch server-side, splits pages with pdf-lib, and parks single-page
      // PDFs in the staging bucket so a Claude Desktop chat can open them by URL (or
      // receive them inline as resources). Own/assigned bids only, same fence as
      // stage_plan_pdf.
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      if (!ref) return textContent('get_plan_pages needs bid', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, project_name, plans_link, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) return textContent('Not your bid (created_by / estimator fence)', true)
      if (!String(bid.plans_link ?? '').trim()) return textContent(`b${bid.bid_number} has no plans link — file_plans first, or ask a person to paste the set on the bid.`, true)
      const token = presentedToken(req)
      if (!token) return textContent('No twin token on this call', true)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const bidTag = `b${bid.bid_number}`
      const CAP_BYTES = 60 * 1024 * 1024
      const fetchPart = async (part: number | null): Promise<{ bytes: Uint8Array; parts: number } | { error: string; status: number }> => {
        const u = `${supabaseUrl}/functions/v1/plan-fetch?bid=${encodeURIComponent(bidTag)}${part ? `&part=${part}` : ''}`
        const res = await fetch(u, { headers: { 'X-Twin-Token': token } })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          return { error: body.slice(0, 300) || res.statusText, status: res.status }
        }
        const buf = new Uint8Array(await res.arrayBuffer())
        return { bytes: buf, parts: Math.max(1, Number(res.headers.get('X-Plan-Parts') ?? '1') || 1) }
      }
      const first = await fetchPart(null)
      if ('error' in first) {
        const hint = first.status === 404 || first.status === 403
          ? ' The intake account cannot read this file — a person must share it with drive-intake@pipetooling-drive.iam.gserviceaccount.com as Viewer (the bid form has Copy intake address), or paste the PDF itself.'
          : ''
        return textContent(`plan-fetch refused (${first.status}): ${first.error}.${hint}`, true)
      }
      let doc: PDFDocument
      let totalBytes = first.bytes.byteLength
      try {
        doc = await PDFDocument.load(first.bytes, { ignoreEncryption: true, updateMetadata: false })
        // A folder that exceeded plan-fetch's merge cap streams its largest file with
        // X-Plan-Parts; join the rest (in name order) so page numbers cover the set.
        for (let part = 2; part <= Math.min(first.parts, 8); part++) {
          const more = await fetchPart(part)
          if ('error' in more) break
          totalBytes += more.bytes.byteLength
          if (totalBytes > CAP_BYTES) return textContent(`The set is over ${Math.round(CAP_BYTES / 1048576)} MB across ${first.parts} files — trim to the plumbing sheets and stage it with stage_plan_pdf, or ask a person for the plumbing set alone.`, true)
          const extra = await PDFDocument.load(more.bytes, { ignoreEncryption: true, updateMetadata: false })
          const copied = await doc.copyPages(extra, extra.getPageIndices())
          for (const pg of copied) doc.addPage(pg)
        }
      } catch (e) {
        return textContent(`Could not open the plan set as a PDF: ${e instanceof Error ? e.message : String(e)}`, true)
      }
      const pageCount = doc.getPageCount()
      // Parse the page list: "1-4,9" → [1,2,3,4,9], 1-based, clipped, at most 8.
      const MAX_PAGES = 8
      const spec = String(args.pages ?? '').trim() || '1-6'
      const wanted: number[] = []
      for (const tok of spec.split(',')) {
        const t = tok.trim()
        if (!t) continue
        const mm = /^(\d+)\s*-\s*(\d+)$/.exec(t)
        if (mm) {
          const a = Number(mm[1]); const b = Number(mm[2])
          for (let n = Math.min(a, b); n <= Math.max(a, b); n++) wanted.push(n)
        } else if (/^\d+$/.test(t)) wanted.push(Number(t))
      }
      const pages = [...new Set(wanted)].filter((n) => n >= 1 && n <= pageCount).slice(0, MAX_PAGES)
      if (pages.length === 0) return textContent(JSON.stringify({ ok: true, bid: bidTag, page_count: pageCount, pages: [], note: `No pages matched "${spec}" — the set has ${pageCount} page${pageCount === 1 ? '' : 's'}.` }, null, 2))
      const setKey = (await sha256Hex(`${bid.id}:${bid.plans_link}:${pageCount}:${totalBytes}`)).slice(0, 10)
      const embed = args.embed === true
      const EMBED_MAX = 3
      const EMBED_BYTES = 3 * 1024 * 1024
      const out: Array<{ page: number; url: string; bytes: number }> = []
      const resources: Array<{ type: 'resource'; resource: { uri: string; mimeType: string; blob: string } }> = []
      let embedded = 0
      for (const n of pages) {
        const one = await PDFDocument.create()
        const [pg] = await one.copyPages(doc, [n - 1])
        one.addPage(pg)
        const bytes = await one.save({ useObjectStreams: true })
        const objectPath = `plan-pages/${bidTag}/${setKey}/p${String(n).padStart(3, '0')}.pdf`
        const { error: upErr } = await admin.storage.from('twin-plans-tmp').upload(objectPath, bytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) return textContent(`Could not stage page ${n}: ${upErr.message}`, true)
        const url = admin.storage.from('twin-plans-tmp').getPublicUrl(objectPath).data.publicUrl
        out.push({ page: n, url, bytes: bytes.byteLength })
        if (embed && resources.length < EMBED_MAX && embedded + bytes.byteLength <= EMBED_BYTES) {
          let bin = ''
          for (let i = 0; i < bytes.byteLength; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
          resources.push({ type: 'resource', resource: { uri: url, mimeType: 'application/pdf', blob: btoa(bin) } })
          embedded += bytes.byteLength
        }
      }
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pipeline STG-2] get_plan_pages — ${pages.length} of ${pageCount} page${pageCount === 1 ? '' : 's'} staged (${pages.join(', ')})${embed ? `, ${resources.length} embedded` : ''}.`,
      }).then(() => {}, () => {})
      const text = JSON.stringify({
        ok: true, bid: bidTag, project: bid.project_name, page_count: pageCount, staged: out.length, pages: out,
        ...(embed ? { embedded: resources.length } : {}),
        how: 'Each url is a single-page PDF (public, staged in twin-plans-tmp). Open or fetch it to read the sheet; sheets are drawings, so read them as images where you can. Ask for more pages by number — sheet index first, then the P-series, schedules and risers. Build the substrate per EXTRACTOR.md from what you read, then put_substrate.',
      }, null, 2)
      return { content: [{ type: 'text', text }, ...resources], isError: false }
    }
    case 'stage_plan_pdf': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      if (!ref) return textContent('stage_plan_pdf needs bid', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) return textContent('Not your bid (created_by / estimator fence)', true)
      const safeName = (String(args.file_name ?? '').trim() || `b${bid.bid_number}-plans.pdf`).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'plans.pdf'
      const objectPath = `b${bid.bid_number}/${Date.now()}-${safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`}`
      const { data: signed, error: signErr } = await admin.storage.from('twin-plans-tmp').createSignedUploadUrl(objectPath)
      if (signErr || !signed) return textContent(`Could not create an upload URL: ${signErr?.message ?? 'unknown'}`, true)
      const publicUrl = admin.storage.from('twin-plans-tmp').getPublicUrl(objectPath).data.publicUrl
      return textContent(JSON.stringify({
        ok: true, bucket: 'twin-plans-tmp', object_path: objectPath, upload_url: signed.signedUrl, public_url: publicUrl, size_limit_bytes: 52428800,
        how: 'curl -sS -X PUT "<upload_url>" -H "Content-Type: application/pdf" --data-binary @trimmed.pdf   — then ct_finish_takeoff(..., pdf_url: public_url). Keep the trimmed set under 50 MB / 200 pages.',
      }, null, 2))
    }
    case 'next_backtest': {
      // Dispatcher (v2.2806): parallel agents each ask for the next unclaimed reference
      // in a round's list. A claim IS the round's shell, so the harness stays the single
      // source of truth and two agents can never end up on the same bid.
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const round = Number(args.round ?? 2)
      const axisFilter = String(args.axis ?? '').trim().toLowerCase()
      const rawList = Array.isArray(args.candidates) ? (args.candidates as Array<Record<string, unknown>>) : []
      const candidates = rawList
        .map((c) => ({ bid: String(c.bid ?? '').trim(), axis: String(c.axis ?? '').trim(), label: String(c.label ?? '').trim() }))
        .filter((c) => c.bid && (!axisFilter || c.axis.toLowerCase().includes(axisFilter)))
      if (!candidates.length) return textContent('next_backtest needs candidates: [{ bid, axis, label }] (optionally filtered by axis)', true)
      const skipped: string[] = []
      for (const c of candidates) {
        const r = await openBacktestShell(admin, twin, c.bid, { round })
        if (!r.ok) { skipped.push(`${c.bid}: ${r.error}`); continue }
        if (r.reused) { skipped.push(`${c.bid}: already claimed (${r.bid})`); continue }
        const remaining = candidates.slice(candidates.indexOf(c) + 1).length
        return textContent(JSON.stringify({
          ok: true, claimed: { label: c.label, axis: c.axis, reference: c.bid }, ...r, remaining_in_list: remaining, skipped,
          next: 'This shell is yours alone. STG-2 substrate first (get_plan_brief), then takeoff, counts+books before the lock, score_backtest, audit questions. Do not call next_backtest again until this bid is scored.',
        }, null, 2))
      }
      return textContent(JSON.stringify({ ok: true, done: true, claimed: null, skipped, note: 'Every candidate in the list already has a shell for this round (or could not be opened).' }, null, 2))
    }
    case 'score_backtest': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const runLabel = String(args.run_label ?? '').trim().slice(0, 40)
      const axis = String(args.axis ?? '').trim().slice(0, 60)
      const lockedTotal = Number(args.locked_total)
      if (!ref || !runLabel || !axis || !Number.isFinite(lockedTotal) || lockedTotal <= 0) {
        return textContent('score_backtest needs bid + run_label + axis + positive locked_total', true)
      }
      // v2.2816: lenient verdict parse ("PASS (pre-unseal)" → pass); anything else is unknown, said back.
      const scopeVerdictRaw = String(args.scope_verdict ?? '').trim().toLowerCase()
      const scopeVerdict: 'pass' | 'fail' | 'unknown' = scopeVerdictRaw.startsWith('pass') ? 'pass' : scopeVerdictRaw.startsWith('fail') ? 'fail' : 'unknown'
      const verdictGiven = scopeVerdictRaw.length > 0
      const verdictCoerced = verdictGiven && scopeVerdict === 'unknown' ? `scope_verdict "${scopeVerdictRaw.slice(0, 40)}" is not pass/fail — recorded as unknown` : null
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, project_name, created_by, estimator_id, twin_source_bid_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) return textContent('Not your bid (created_by / estimator fence)', true)
      if (!bid.twin_source_bid_id) return textContent(`b${bid.bid_number} has no reference pairing (twin_source_bid_id) — not a backtest shell`, true)
      // Blindness order is structural: no LOCK note on the ledger, no unseal.
      const { data: lockNotes } = await admin.from('bids_submission_entries').select('id').eq('bid_id', bid.id).ilike('notes', '%LOCK%').limit(1)
      if (!lockNotes?.length) return textContent(`b${bid.bid_number} has no LOCK note on its ledger — add_bid_note your blind total first ("[STG-3..5 + LOCK] $NN,NNN …"), then score.`, true)
      // STG-5 is structural too (v2.2864): an estimate that lives only in the lock note
      // renders draft $0 on the Audits tab and cannot be judged — seven BT-16..19 cards
      // sat that way for four days. No count rows in PipeTooling, no unseal.
      const { count: twinRowCount } = await admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', bid.id)
      if (!twinRowCount) {
        return textContent(`b${bid.bid_number} has no count rows in PipeTooling — the audit card would read draft $0 and cannot be judged. Run STG-5 first (paste_counts, or the Counts tab paste import + book assignment), then score.`, true)
      }
      // Idempotent per run label — and AMENDABLE (v2.2816): the scope-match check needs the
      // reference rows, which only this call unseals, so the honest first verdict is often
      // "unknown". A second call with the same run_label and a verdict (or counts_note /
      // note) updates those fields and recomputes gate_eligible; locked_total never changes.
      const { data: existingScore } = await admin.from('twin_run_scores').select('*').eq('run_label', runLabel).maybeSingle()
      if (existingScore) {
        const patch: Record<string, unknown> = {}
        if (verdictGiven && scopeVerdict !== 'unknown') patch.scope_verdict = scopeVerdict
        const cn = String(args.counts_note ?? '').trim().slice(0, 200); if (cn) patch.counts_note = cn
        const nt = String(args.note ?? '').trim().slice(0, 400); if (nt) patch.note = nt
        if (!Object.keys(patch).length) return textContent(JSON.stringify({ ok: true, reused: true, score: existingScore, hint: verdictCoerced ?? 'Pass scope_verdict pass|fail (and/or counts_note, note) to amend this run.' }, null, 2))
        // gate_eligible = grade A/B + flags clear + scope not fail; the first two are frozen
        // in the stamped note, so re-derive them from the reference the same way.
        const { data: amendRef } = await admin.from('bids').select('id, bid_value, outcome, loss_category, bid_date_sent, created_at, plans_link').eq('id', bid.twin_source_bid_id).maybeSingle()
        if (amendRef) {
          const [{ count: c1 }, { count: c2 }] = await Promise.all([
            admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', amendRef.id),
            admin.from('bid_pricing_assignments').select('id', { count: 'exact', head: true }).eq('bid_id', amendRef.id),
          ])
          const v = amendRef.bid_value == null ? null : Number(amendRef.bid_value)
          const g = !String(amendRef.plans_link ?? '').trim() ? 'X' : v != null && (c1 ?? 0) > 0 && (c2 ?? 0) > 0 ? 'A' : v != null ? 'B' : (c1 ?? 0) > 0 ? 'C' : 'D'
          const lostA = amendRef.outcome === 'lost'
          const flagsClearA = !((v != null && v > 0 && v % 100 === 0) || (lostA && ['no_bid', 'project_died'].includes(String(amendRef.loss_category ?? ''))) || (lostA && !amendRef.loss_category) || (() => { const w = String(amendRef.bid_date_sent ?? amendRef.created_at ?? '').slice(0, 10); const d = w ? Math.abs(Date.parse(`${todayYmdInAppTz()}T00:00:00Z`) - Date.parse(`${w}T00:00:00Z`)) / 86400000 : 0; return Number.isFinite(d) && d > 183 })())
          const finalVerdict = (patch.scope_verdict as string | undefined) ?? String(existingScore.scope_verdict ?? 'unknown')
          patch.gate_eligible = (g === 'A' || g === 'B') && flagsClearA && finalVerdict !== 'fail'
        }
        const { data: amended, error: amendErr } = await admin.from('twin_run_scores').update(patch).eq('id', existingScore.id).select('*').single()
        if (amendErr) return textContent(`Amend failed: ${amendErr.message}`, true)
        await admin.from('bids_submission_entries').insert({
          bid_id: bid.id,
          notes: `[STG-6 SCORECARD amended] ${runLabel}: ${Object.entries(patch).map(([k, v]) => `${k}=${String(v)}`).join(', ')} via twin-mcp score_backtest.`,
        }).then(() => {}, () => {})
        return textContent(JSON.stringify({ ok: true, reused: true, amended: true, score: amended, hint: verdictCoerced ?? undefined }, null, 2))
      }
      // The seal breaks here — reference value/outcome are read by the server, not the agent.
      const { data: refBid } = await admin.from('bids')
        .select('id, bid_number, project_name, bid_value, outcome, loss_category, bid_date_sent, created_at, plans_link, estimator_id, bid_date_sent_attested_by, created_by')
        .eq('id', bid.twin_source_bid_id).maybeSingle()
      if (!refBid) return textContent('Reference bid not found', true)
      // v2.3099: WHOSE number — same resolver as shadows; the Scoreboard treats a
      // non-calibration-standard teacher as practice.
      const teacher = await resolveTeacher(admin, refBid as TeacherBid)
      const [{ count: refCounts }, { count: refPricing }] = await Promise.all([
        admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
        admin.from('bid_pricing_assignments').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
      ])
      const refValue = refBid.bid_value == null ? null : Number(refBid.bid_value)
      const hasPlans = !!String(refBid.plans_link ?? '').trim()
      const grade = !hasPlans ? 'X' : refValue != null && (refCounts ?? 0) > 0 && (refPricing ?? 0) > 0 ? 'A' : refValue != null ? 'B' : (refCounts ?? 0) > 0 ? 'C' : 'D'
      // Quality flags — mirrors src/lib/bids/referenceGrade.ts (unseal-time only).
      const roundValue = refValue != null && refValue > 0 && refValue % 100 === 0
      const lost = refBid.outcome === 'lost'
      const weakLoss = lost && ['no_bid', 'project_died'].includes(String(refBid.loss_category ?? ''))
      const lossUncategorized = lost && !refBid.loss_category
      const whenYmd = String(refBid.bid_date_sent ?? refBid.created_at ?? '').slice(0, 10)
      const today = todayYmdInAppTz()
      const ageDays = whenYmd ? Math.abs(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${whenYmd}T00:00:00Z`)) / 86400000 : 0
      const stale = Number.isFinite(ageDays) && ageDays > 183
      const flagsClear = !(roundValue || weakLoss || lossUncategorized || stale)
      const gateEligible = (grade === 'A' || grade === 'B') && flagsClear && scopeVerdict !== 'fail'
      const deltaPct = refValue != null && refValue > 0 ? Math.round(((lockedTotal - refValue) / refValue) * 1000) / 10 : null
      const now = new Date().toISOString()
      const { data: score, error: scoreErr } = await admin.from('twin_run_scores').insert({
        run_label: runLabel,
        kind: 'backtest',
        axis,
        project_name: refBid.project_name,
        twin_bid_number: String(bid.bid_number),
        reference_bid_number: String(refBid.bid_number),
        locked_total: lockedTotal,
        reference_value: refValue,
        delta_pct: deltaPct,
        counts_note: String(args.counts_note ?? '').trim().slice(0, 200) || null,
        scope_verdict: scopeVerdict,
        gate_eligible: gateEligible,
        note: String(args.note ?? '').trim().slice(0, 400) || null,
        scored_at: now,
        teacher_user_id: teacher.id,
        teacher_name: teacher.name,
      }).select('*').single()
      if (scoreErr) return textContent(`Score not recorded: ${scoreErr.message}`, true)
      const flagList = [roundValue && 'roundValue', weakLoss && 'weakLoss', lossUncategorized && 'lossUncategorized', stale && 'stale'].filter(Boolean).join(', ') || 'none'
      const teacherLabel = teacher.name ? ` by ${teacher.name} (${teacher.standard ? 'calibration standard' : 'practice teacher — not a gate run'})` : ''
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[STG-6 SCORECARD] ${runLabel} (${axis}) via twin-mcp score_backtest: twin locked $${lockedTotal.toLocaleString()} vs reference b${refBid.bid_number} ${refValue != null ? `$${refValue.toLocaleString()}` : '(no value)'}${teacherLabel} ${refBid.outcome ?? 'undecided'}${refBid.loss_category ? ` (${refBid.loss_category})` : ''}, sent ${refBid.bid_date_sent ?? '—'} → delta ${deltaPct != null ? `${deltaPct > 0 ? '+' : ''}${deltaPct}%` : 'n/a'}. Grade ${grade}, flags: ${flagList}, scope ${scopeVerdict}, gate-eligible ${gateEligible ? 'yes' : 'no'}.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, reused: false, run_label: runLabel, twin_bid: `b${bid.bid_number}`,
        reference: { bid: `b${refBid.bid_number}`, project_name: refBid.project_name, value: refValue, outcome: refBid.outcome, loss_category: refBid.loss_category, sent: refBid.bid_date_sent, count_rows: refCounts ?? 0, priced_rows: refPricing ?? 0 },
        locked_total: lockedTotal, delta_pct: deltaPct, grade, flags: { roundValue, weakLoss, lossUncategorized, stale }, scope_verdict: scopeVerdict, gate_eligible: gateEligible,
        scope_verdict_note: verdictCoerced ?? undefined,
        next: 'Now (and only now) read the reference rows: run the scope-match line-compare, then call score_backtest AGAIN with the same run_label and scope_verdict pass|fail (plus counts_note) — that amends the row and recomputes gate_eligible. Then the count/footage comparison, the audit questions in plain words, and the digest per FEEDBACK_LOOP.md.',
        score_id: score.id,
      }, null, 2))
    }
    case 'add_bid_note': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const note = String(args.note ?? '').trim()
      if (!ref || !note) return textContent('add_bid_note needs bid + note', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let q = admin.from('bids').select('id, bid_number, estimator_id, created_by')
      q = uuidRe.test(ref) ? q.eq('id', ref) : q.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error } = await q.maybeSingle()
      if (error) return textContent(`Bid lookup failed: ${error.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId && !(await pricerMayTouchBid(admin, twin, bid.id))) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — notes land only on your own bids.`, true)
      }
      const { error: insErr } = await admin.from('bids_submission_entries').insert({ bid_id: bid.id, notes: note.slice(0, 8000) })
      if (insErr) return textContent(`Note not saved: ${insErr.message}`, true)
      return textContent(`Note recorded on b${bid.bid_number} (${note.length > 120 ? note.slice(0, 120) + '…' : note})`)
    }
    case 'tt_finish_costing': {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
      const ref = String(args.bid ?? '').trim()
      const projName = String(args.name ?? '').trim()
      const items = args.items
      if (!ref || !projName || !Array.isArray(items) || !items.length) return textContent('tt_finish_costing needs bid + name + items[] (payload v2 items)', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, estimator_id, created_by, count_tooling_link')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error: bidErr } = await bq.maybeSingle()
      if (bidErr) return textContent(`Bid lookup failed: ${bidErr.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — manifests land only on your own bids.`, true)
      }
      const bidTag = `b${bid.bid_number}`
      // 1. Mint a TT session server-side (per-twin token, fleet secret fallback) and walk
      //    the magic link for the access_token — same path as ct_finish_takeoff.
      const ttLoginUrl = Deno.env.get('TT_TWIN_LOGIN_URL')
      const ttSecret = Deno.env.get('TAKEOFFTOOLING_TWIN_LOGIN_SECRET')
      if (!ttLoginUrl) return textContent('TT_TWIN_LOGIN_URL not configured on this server', true)
      const ttBase = new URL(ttLoginUrl).origin
      const TT_ANON = 'sb_publishable_vMFyQ4I0LqZD6yhfoF_Zbw_9MsPoC9G' // TakeoffTooling's publishable key (ships in its cloud.js)
      const ttEmail = ttTwinEmail(twin.email)
      const rawToken = presentedToken(req)!
      if (ttBridgeConfigured()) {
        try { await callTtManageUser({ verb: 'set_twin_credential', email: ttEmail, token_hash: await sha256Hex(rawToken) }) } catch (_) { /* best-effort */ }
      }
      let mintRes = await fetch(ttLoginUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken }, body: JSON.stringify({ email: ttEmail, redirectTo: 'https://takeofftooling.com', run: `tt-finish:${bidTag}` }) })
      if (mintRes.status === 401 && ttSecret) {
        mintRes = await fetch(ttLoginUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ttSecret }, body: JSON.stringify({ email: ttEmail, redirectTo: 'https://takeofftooling.com', run: `tt-finish:${bidTag}` }) })
      }
      const mintBody = await mintRes.json().catch(() => ({}))
      if (!mintRes.ok || !mintBody.action_link) {
        return textContent(`TakeoffTooling mint failed (${mintRes.status}): ${mintBody.error ?? 'unknown'}${mintRes.status === 404 ? ' — no TT seat yet: Settings → Digital twins → link the TT seat' : ''}`, true)
      }
      const verifyRes = await fetch(mintBody.action_link, { redirect: 'manual' })
      const loc = verifyRes.headers.get('location') ?? ''
      const jwtMatch = loc.match(/access_token=([^&]+)/)
      if (!jwtMatch) return textContent(`TT verify did not yield a session (status ${verifyRes.status}) — link may be expired`, true)
      const ttJwt = jwtMatch[1]
      // 2. The door. external_ref is ALWAYS the bid tag; the bid's CountTooling plans link rides along.
      const importBody: Record<string, unknown> = {
        name: projName,
        external_ref: bidTag,
        note: String(args.note ?? '').slice(0, 400) || `twin-mcp tt_finish_costing for ${bidTag}`,
        items,
        explode: args.explode !== false,
      }
      if (bid.count_tooling_link) importBody.plans_url = bid.count_tooling_link
      if (typeof args.labor_rate === 'number') importBody.labor_rate = args.labor_rate
      if (typeof args.tax_rate === 'number') importBody.tax_rate = args.tax_rate
      const impRes = await fetch(`${ttBase}/functions/v1/import-manifest`, {
        method: 'POST', headers: { Authorization: `Bearer ${ttJwt}`, apikey: TT_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(importBody),
      })
      const impBody = await impRes.json().catch(() => ({}))
      if (!impRes.ok || !impBody.project_id) return textContent(`import-manifest failed (${impRes.status}): ${JSON.stringify(impBody).slice(0, 600)}`, true)
      // 3. Review-ready over the bridge (best-effort loud).
      let reviewReady = false
      let reviewNote = 'TT bridge not configured — mark ready in the app'
      if (ttBridgeConfigured()) {
        const r = await callTtManageUser({ verb: 'set_twin_project_review', project_id: impBody.project_id, status: 'ready', note: `twin-mcp tt_finish_costing ${bidTag}` }).catch((e) => ({ status: 0, json: { error: String(e) } }))
        reviewReady = r.status === 200
        reviewNote = reviewReady ? 'ready' : `set_twin_project_review ${r.status}: ${r.json?.error ?? 'unknown'}`
      }
      // 4. Ledger + fleet ledger.
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pipeline STG-4] via twin-mcp tt_finish_costing: TakeoffTooling manifest ${impBody.project_id} "${projName}" — ${impBody.rows} rows (${impBody.counts} counts · ${impBody.line_types} line types · ${impBody.unscaled} unscaled), ${impBody.exploded} exploded, ${impBody.unpriced} unpriced, book: ${impBody.book}; review ${reviewNote}`,
      }).then(() => {}, () => {})
      await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId, mission: `tt-finish:${bidTag}`,
        notes: `project=${impBody.project_id} rows=${impBody.rows} exploded=${impBody.exploded} unpriced=${impBody.unpriced} review=${reviewNote}`, ended_at: new Date().toISOString(),
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, bid: bidTag, project_id: impBody.project_id, replaced: !!impBody.replaced,
        rows: impBody.rows, counts: impBody.counts, line_types: impBody.line_types, unscaled: impBody.unscaled,
        exploded: impBody.exploded, unpriced: impBody.unpriced, book: impBody.book,
        review_ready: reviewReady, share_url: impBody.share_url,
        next: impBody.unpriced
          ? `${impBody.unpriced} assembly rows have no book price — extend your TakeoffTooling book or pass labor/price on those children and re-run (same bid replaces). Then get_work_state(${bidTag}).tt_manifest → paste_counts with unit_cost + labor_hours.`
          : `get_work_state(${bidTag}).tt_manifest has the priced rows — paste_counts them with unit_cost + labor_hours (STG-5).`,
      }, null, 2))
    }
    case 'ct_finish_takeoff': {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      // 0. Fence: the bid must be the twin's own (assigned/created), same rule as add_bid_note.
      const ref = String(args.bid ?? '').trim()
      const projName = String(args.name ?? '').trim()
      const takeoff = args.takeoff
      if (!ref || !projName || !takeoff || typeof takeoff !== 'object') {
        return textContent('ct_finish_takeoff needs bid + name + takeoff (v1 object)', true)
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, estimator_id, created_by')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error: bidErr } = await bq.maybeSingle()
      if (bidErr) return textContent(`Bid lookup failed: ${bidErr.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — takeoffs land only on your own bids.`, true)
      }
      const bidTag = `b${bid.bid_number}`

      // 1. Mint a CT session server-side: per-twin token first, fleet secret fallback
      //    (same path as mint_session), then walk the magic link ourselves — the verify
      //    redirect's fragment carries the access_token, no browser required.
      const ctLoginUrl = Deno.env.get('CT_TWIN_LOGIN_URL')
      const ctSecret = Deno.env.get('COUNTTOOLING_TWIN_LOGIN_SECRET')
      if (!ctLoginUrl) return textContent('CT_TWIN_LOGIN_URL not configured on this server', true)
      const ctBase = new URL(ctLoginUrl).origin
      // CT publishable anon key (ships in the CT client's config.js — public by design).
      const CT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXh2ZnlkbXZ0dndodmVmbXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODM0NTMsImV4cCI6MjA4Nzk1OTQ1M30.dqn8DwO-dc0z2GwunCfEo5VO8lPRUGaN6ruzAm33HSs'
      const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
      const rawToken = presentedToken(req)!
      let mintRes = await fetch(ctLoginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken },
        body: JSON.stringify({ email: ctEmail, redirectTo: 'https://counttooling.com', run: `ct-finish:${bidTag}` }),
      })
      if (mintRes.status === 401 && ctSecret) {
        mintRes = await fetch(ctLoginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ctSecret },
          body: JSON.stringify({ email: ctEmail, redirectTo: 'https://counttooling.com', run: `ct-finish:${bidTag}` }),
        })
      }
      const mintBody = await mintRes.json().catch(() => ({}))
      if (!mintRes.ok || !mintBody.action_link) {
        return textContent(`CT mint failed (${mintRes.status}): ${mintBody.error ?? 'unknown'}`, true)
      }
      const verifyRes = await fetch(mintBody.action_link, { redirect: 'manual' })
      const loc = verifyRes.headers.get('location') ?? ''
      const jwtMatch = loc.match(/access_token=([^&]+)/)
      if (!jwtMatch) return textContent(`CT verify did not yield a session (status ${verifyRes.status}) — link may be expired`, true)
      const ctJwt = jwtMatch[1]

      // 2. Import the takeoff. external_ref is ALWAYS the bid tag (bid-stamp doctrine);
      //    the plan set rides via plan-fetch with the caller's own token.
      const importBody: Record<string, unknown> = {
        name: projName,
        note: String(args.note ?? '').slice(0, 400) || `twin-mcp ct_finish_takeoff for ${bidTag}`,
        external_ref: bidTag,
        takeoff,
      }
      if (args.skip_pdf !== true) {
        // Default: the bid's own plan set via plan-fetch. pdf_url overrides for the
        // oversized-set fallback (a compressed copy staged elsewhere) — https only.
        const pdfOverride = String(args.pdf_url ?? '').trim()
        if (pdfOverride && !/^https:\/\//.test(pdfOverride)) return textContent('pdf_url must be https', true)
        importBody.pdf_url = pdfOverride || `${supabaseUrl}/functions/v1/plan-fetch?bid=${bidTag}`
        importBody.pdf_headers = pdfOverride ? undefined : { 'X-Twin-Token': rawToken }
      }
      const impRes = await fetch(`${ctBase}/functions/v1/import-takeoff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctJwt}`, apikey: CT_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify(importBody),
      })
      const impBody = await impRes.json().catch(() => ({}))
      if (!impRes.ok || !impBody.project_id) {
        return textContent(`import-takeoff failed (${impRes.status}): ${JSON.stringify(impBody).slice(0, 600)}`, true)
      }
      const projectId = impBody.project_id as string
      // v2.2816: a set staged via stage_plan_pdf is consumed by the import — remove it.
      {
        const staged = String(importBody.pdf_url ?? '')
        const m = staged.match(/\/storage\/v1\/object\/public\/twin-plans-tmp\/(.+)$/)
        if (m) await admin.storage.from('twin-plans-tmp').remove([decodeURIComponent(m[1])]).then(() => {}, () => {})
      }

      // 3. Review-ready + view link (best-effort loud: failures reported, marks kept).
      const rpcHeaders = { Authorization: `Bearer ${ctJwt}`, apikey: CT_ANON, 'Content-Type': 'application/json' }
      const readyRes = await fetch(`${ctBase}/rest/v1/rpc/set_project_review_status`, {
        method: 'POST', headers: rpcHeaders,
        body: JSON.stringify({ p_project_id: projectId, p_status: 'ready' }),
      })
      const linkRes = await fetch(`${ctBase}/rest/v1/rpc/create_view_link`, {
        method: 'POST', headers: rpcHeaders,
        body: JSON.stringify({ p_project_id: projectId, p_name: String(args.view_name ?? '').trim() || `${bidTag} audit view` }),
      })
      const linkBody = await linkRes.json().catch(() => ({}))
      const viewUrl = linkBody?.token ? `https://counttooling.com/app/?t=${linkBody.token}` : null

      // 4. PT side: stamp count_tooling_link + open the audit row (idempotent).
      const selfAssessment = String(args.self_assessment ?? '').trim().slice(0, 2000) || null
      if (viewUrl) {
        await admin.from('bids').update({ count_tooling_link: viewUrl }).eq('id', bid.id).then(() => {}, () => {})
        const { data: existingAudit } = await admin.from('bid_audits').select('id').eq('bid_id', bid.id).maybeSingle()
        if (!existingAudit) {
          await admin.from('bid_audits').insert({
            bid_id: bid.id, ct_project_id: projectId, ct_view_url: viewUrl,
            status: 'pending', created_by: twin.twinUserId,
            ...(selfAssessment ? { self_assessment: selfAssessment } : {}),
          }).then(() => {}, () => {})
        } else if (selfAssessment) {
          // Re-finish (replaced takeoff): refresh the confession to match the new draft.
          await admin.from('bid_audits').update({ self_assessment: selfAssessment }).eq('id', existingAudit.id).then(() => {}, () => {})
        }
      }
      await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: `ct-finish:${bidTag}`,
        notes: `project=${projectId} markers=${impBody.counter_count ?? '?'} pdf=${impBody.pdf ? (impBody.pdf.ok ? 'ok' : 'FAIL') : 'skipped'} view=${viewUrl ?? 'none'}`,
        ended_at: new Date().toISOString(),
      }).then(() => {}, () => {})

      return textContent(JSON.stringify({
        ok: true, bid: bidTag, project_id: projectId, replaced: !!impBody.replaced,
        counter_count: impBody.counter_count ?? null, line_count: impBody.line_count ?? null,
        pdf: impBody.pdf ?? null, review_ready: readyRes.ok, view_url: viewUrl,
        audit: viewUrl ? 'bid_audits row ensured + count_tooling_link stamped' : 'view link failed — audit row not created',
      }, null, 2))
    }
    case 'paste_counts': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const rows = Array.isArray(args.rows) ? args.rows as Record<string, unknown>[] : []
      if (!ref || !rows.length) return textContent('paste_counts needs bid + rows[]', true)
      if (rows.length > 200) return textContent('paste_counts takes at most 200 rows', true)
      const UNITS = ['ea', 'ft', 'px', 'sqft']
      const parsed = rows.map((r, i) => ({
        i,
        fixture: String(r.fixture ?? '').trim().slice(0, 300),
        count: Number(r.count),
        unit: r.unit == null ? null : String(r.unit).trim(),
        page: r.page == null ? null : String(r.page).trim().slice(0, 40) || null,
        bookEntry: String(r.book_entry ?? '').trim(),
        override: r.unit_price_override == null ? null : Number(r.unit_price_override),
        // v2.3082: TakeoffTooling's cost side per unit (materials $ and labor hours)
        unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
        laborHours: r.labor_hours == null ? null : Number(r.labor_hours),
      }))
      const bad = parsed.filter((r) =>
        !r.fixture || !r.bookEntry || !Number.isFinite(r.count) || r.count <= 0 ||
        (r.unit != null && !UNITS.includes(r.unit)) || (r.override != null && !Number.isFinite(r.override)) ||
        (r.unitCost != null && !(Number.isFinite(r.unitCost) && r.unitCost >= 0)) || (r.laborHours != null && !(Number.isFinite(r.laborHours) && r.laborHours >= 0)))
      if (bad.length) {
        return textContent(`Invalid rows (need fixture + positive count + book_entry; unit one of ${UNITS.join('/')}): ${bad.map((r) => `#${r.i + 1} "${r.fixture || '(no fixture)'}"`).join(', ')}`, true)
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, service_type_id, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error: bidErr } = await bq.maybeSingle()
      if (bidErr) return textContent(`Bid lookup failed: ${bidErr.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — counts land only on your own bids.`, true)
      }
      // The 🤖 Robot Default book for this bid's service type (global: bid_id null, is_robot).
      const { data: robotVer } = await admin.from('price_book_versions')
        .select('id, name').eq('is_robot', true).is('bid_id', null).eq('service_type_id', bid.service_type_id).maybeSingle()
      if (!robotVer) return textContent('No global 🤖 Robot Default price book exists for this bid\'s service type', true)
      const { data: entries, error: entErr } = await admin.from('price_book_entries')
        .select('id, total_price, fixture_types(name)').eq('version_id', robotVer.id).limit(1000)
      if (entErr) return textContent(`Book read failed: ${entErr.message}`, true)
      const entryByName = new Map<string, { id: string; total_price: number }>()
      for (const e of entries ?? []) {
        const name = (e.fixture_types as { name?: string } | null)?.name
        if (name) entryByName.set(name.trim().toLowerCase(), { id: e.id as string, total_price: Number(e.total_price) })
      }
      const unmatched = parsed.filter((r) => !entryByName.has(r.bookEntry.toLowerCase()))
      if (unmatched.length) {
        return textContent(`These book_entry names are not in the 🤖 Robot Default book — extend the book first (mirror sources in the ledger) or fix the name: ${unmatched.map((r) => `"${r.bookEntry}"`).join(', ')}`, true)
      }
      // The step-0 invariant, enforced: priced rows must equal the lock.
      const total = Math.round(parsed.reduce((s, r) => s + r.count * (r.override ?? entryByName.get(r.bookEntry.toLowerCase())!.total_price), 0) * 100) / 100
      const expected = args.expected_total == null ? null : Number(args.expected_total)
      if (expected != null && Number.isFinite(expected) && Math.abs(total - expected) > Math.max(1, expected * 0.001)) {
        return textContent(`Priced rows total $${total.toLocaleString()} but expected_total is $${expected.toLocaleString()} — the audit card must price to your lock. Fix the rows (or the lock) before pasting.`, true)
      }
      const { count: existing } = await admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', bid.id)
      if ((existing ?? 0) > 0 && !args.replace) {
        return textContent(`b${bid.bid_number} already has ${existing} count rows — pass replace: true to rewrite them (this deletes the existing rows and their book assignments).`, true)
      }
      if ((existing ?? 0) > 0) {
        for (const table of ['bid_pricing_assignments', 'bid_count_row_custom_prices', 'bid_count_row_custom_costs', 'bid_count_row_submission_hides']) {
          const { error: delErr } = await admin.from(table).delete().eq('bid_id', bid.id)
          if (delErr) return textContent(`Replace failed clearing ${table}: ${delErr.message}`, true)
        }
        const { error: delRowsErr } = await admin.from('bids_count_rows').delete().eq('bid_id', bid.id)
        if (delRowsErr) return textContent(`Replace failed clearing bids_count_rows: ${delRowsErr.message}`, true)
      }
      const { data: inserted, error: rowErr } = await admin.from('bids_count_rows').insert(parsed.map((r, i) => ({
        bid_id: bid.id, fixture: r.fixture, count: r.count, unit: r.unit, page: r.page, sequence_order: i + 1,
      }))).select('id')
      if (rowErr) return textContent(`Rows not saved: ${rowErr.message}`, true)
      const { error: asgErr } = await admin.from('bid_pricing_assignments').insert((inserted ?? []).map((row, i) => ({
        bid_id: bid.id,
        count_row_id: row.id,
        price_book_entry_id: entryByName.get(parsed[i].bookEntry.toLowerCase())!.id,
        price_book_version_id: robotVer.id,
        unit_price_override: parsed[i].override,
        is_fixed_price: false,
      })))
      if (asgErr) return textContent(`Rows saved but assignments failed (${asgErr.message}) — the card will price $0 until every row is assigned. Fix and re-run with replace: true.`, true)
      const overrides = parsed.filter((r) => r.override != null).length
      // v2.3082: TakeoffTooling's cost side. unit_cost lands as the row's custom
      // MATERIALS cost (the workbench's lineCostForRow reads bid_count_row_custom_costs;
      // provenance tag reads "cost from TakeoffTooling"); labor hours are summed onto the
      // ledger note — the Labor tab is still a human step (no per-row labor column yet).
      const costed = parsed.map((r, i) => ({ r, i })).filter(({ r }) => r.unitCost != null && r.unitCost > 0)
      let costNote = ''
      if (costed.length && inserted) {
        const { error: costErr } = await admin.from('bid_count_row_custom_costs').insert(costed.map(({ r, i }) => ({
          bid_id: bid.id, count_row_id: inserted[i].id, unit_materials_cents: Math.round(r.unitCost! * 100),
          source: 'quoted', house_name: 'TakeoffTooling', applied_by: twin.twinUserId,
        })))
        costNote = costErr ? ` — custom costs FAILED (${costErr.message})` : `, ${costed.length} rows costed from TakeoffTooling`
      }
      const laborHoursTotal = Math.round(parsed.reduce((s, r) => s + (r.laborHours ?? 0) * r.count, 0) * 10) / 10
      if (laborHoursTotal > 0) costNote += `, ${laborHoursTotal} labor hrs from TakeoffTooling (enter on the Labor tab)`
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pipeline STG-5] via twin-mcp paste_counts: ${parsed.length} rows written and book-assigned (🤖 Robot Default, ${overrides} price overrides${costNote}) → priced $${total.toLocaleString()}${expected != null ? ` = expected_total $${expected.toLocaleString()}` : ' (no expected_total passed)'}.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, bid: `b${bid.bid_number}`, rows: parsed.length, priced_total: total,
        replaced: (existing ?? 0) > 0 ? existing : 0, overrides,
        costed_rows: costed.length, labor_hours_total: laborHoursTotal,
        next: expected == null ? 'No expected_total passed — verify the Counts tab total equals your LOCK before scoring.' : 'LOCK note next if not already on the ledger, then score_backtest (STG-6).',
      }, null, 2))
    }
    case 'get_robot_book': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let versions = admin.from('price_book_versions').select('id, name, service_type_id').eq('is_robot', true).is('bid_id', null)
      const ref = String(args.bid ?? '').trim()
      if (ref) {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        let bq = admin.from('bids').select('id, service_type_id')
        bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
        const { data: bid } = await bq.maybeSingle()
        if (!bid) return textContent(`No bid found for "${ref}"`, true)
        versions = versions.eq('service_type_id', bid.service_type_id)
      }
      const { data: vers, error: verErr } = await versions
      if (verErr) return textContent(`Book lookup failed: ${verErr.message}`, true)
      if (!vers?.length) return textContent('No global 🤖 Robot Default book found', true)
      const books = await Promise.all(vers.map(async (v) => {
        const { data: entries } = await admin.from('price_book_entries')
          .select('total_price, sequence_order, fixture_types(name)').eq('version_id', v.id).order('sequence_order').limit(1000)
        return {
          version_id: v.id,
          service_type_id: v.service_type_id,
          entries: (entries ?? []).map((e) => ({ name: (e.fixture_types as { name?: string } | null)?.name ?? '?', price: e.total_price })),
        }
      }))
      return textContent(JSON.stringify({ books, note: 'paste_counts matches rows to these names exactly; the price shown is what an override-less row earns.' }, null, 2))
    }
    case 'extend_robot_book': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const mirrorNote = String(args.mirror_note ?? '').trim()
      const entries = Array.isArray(args.entries) ? args.entries as Record<string, unknown>[] : []
      if (!ref || !mirrorNote || !entries.length) return textContent('extend_robot_book needs bid + entries[] + mirror_note (where the prices came from)', true)
      if (entries.length > 20) return textContent('extend_robot_book takes at most 20 entries per call', true)
      const parsed = entries.map((e) => ({ name: String(e.name ?? '').trim().slice(0, 200), price: Number(e.price) }))
      const bad = parsed.filter((e) => !e.name || !Number.isFinite(e.price) || e.price <= 0)
      if (bad.length) return textContent(`Invalid entries (need name + positive price): ${bad.map((e) => `"${e.name || '(no name)'}"`).join(', ')}`, true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, service_type_id, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — book extensions ride your own bid's ledger.`, true)
      }
      const { data: robotVer } = await admin.from('price_book_versions')
        .select('id').eq('is_robot', true).is('bid_id', null).eq('service_type_id', bid.service_type_id).maybeSingle()
      if (!robotVer) return textContent('No global 🤖 Robot Default book exists for this bid\'s service type', true)
      const { data: existing } = await admin.from('price_book_entries')
        .select('sequence_order, fixture_types(name)').eq('version_id', robotVer.id).limit(1000)
      const have = new Set((existing ?? []).map((e) => ((e.fixture_types as { name?: string } | null)?.name ?? '').trim().toLowerCase()))
      let nextSeq = Math.max(0, ...(existing ?? []).map((e) => e.sequence_order ?? 0)) + 1
      const added: string[] = []
      const skipped: string[] = []
      for (const entry of parsed) {
        if (have.has(entry.name.toLowerCase())) { skipped.push(entry.name); continue }
        const { data: ftExisting } = await admin.from('fixture_types')
          .select('id').eq('service_type_id', bid.service_type_id).eq('name', entry.name).maybeSingle()
        let ftId = ftExisting?.id
        if (!ftId) {
          const { data: ft, error: ftErr } = await admin.from('fixture_types')
            .insert({ name: entry.name, service_type_id: bid.service_type_id, sequence_order: 0 }).select('id').single()
          if (ftErr) return textContent(`fixture_types insert failed at "${entry.name}": ${ftErr.message} (added so far: ${added.join(', ') || 'none'})`, true)
          ftId = ft.id
        }
        const { error: entErr } = await admin.from('price_book_entries').insert({
          version_id: robotVer.id, fixture_type_id: ftId, sequence_order: nextSeq++,
          total_price: entry.price, rough_in_price: entry.price, top_out_price: 0, trim_set_price: 0,
        })
        if (entErr) return textContent(`price_book_entries insert failed at "${entry.name}": ${entErr.message} (added so far: ${added.join(', ') || 'none'})`, true)
        added.push(`${entry.name} = $${entry.price}`)
      }
      if (added.length) {
        await admin.from('bids_submission_entries').insert({
          bid_id: bid.id,
          notes: `[book extend] 🤖 Robot Default +${added.length} via twin-mcp extend_robot_book: ${added.join(' · ')}. Mirror sources: ${mirrorNote.slice(0, 2000)}`,
        }).then(() => {}, () => {})
      }
      return textContent(JSON.stringify({ ok: true, added, skipped, note: skipped.length ? 'Skipped names already in the book — existing prices are never changed here; re-mirrors go through the digest.' : undefined }, null, 2))
    }
    case 'put_substrate': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const substrate = args.substrate
      if (!ref || !substrate || typeof substrate !== 'object' || Array.isArray(substrate)) {
        return textContent('put_substrate needs bid + substrate (a JSON object per EXTRACTOR.md)', true)
      }
      const size = JSON.stringify(substrate).length
      if (size > 1_000_000) return textContent(`Substrate too large (${size} chars > 1MB) — trim page-level noise; the substrate is the distilled read, not the plan set.`, true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — substrates land only on your own bids.`, true)
      }
      const { count: existing } = await admin.from('bids_plan_substrates').select('id', { count: 'exact', head: true }).eq('bid_id', bid.id)
      const version = String(args.version ?? '').trim().slice(0, 20) || `v${String((existing ?? 0) + 1).padStart(3, '0')}`
      const { error: insErr } = await admin.from('bids_plan_substrates').insert({
        bid_id: bid.id, version, substrate, created_by: twin.twinUserId,
      })
      if (insErr) return textContent(`Substrate not saved: ${insErr.message}`, true)
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[pipeline STG-2] substrate ${version} attached via twin-mcp put_substrate (${size.toLocaleString()} chars${existing ? `, supersedes ${existing} earlier row${existing === 1 ? '' : 's'}` : ''}).`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({ ok: true, bid: `b${bid.bid_number}`, version, next: 'get_plan_brief now reads this substrate; set-class triage per the placement guide, then the takeoff.' }, null, 2))
    }
    case 'seed_audit_questions': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const questions = Array.isArray(args.questions) ? args.questions as Record<string, unknown>[] : []
      if (!ref || !questions.length) return textContent('seed_audit_questions needs bid + questions[]', true)
      if (questions.length > 20) return textContent('seed_audit_questions takes at most 20 questions per call', true)
      const SECTIONS = ['counts', 'footage', 'pricing', 'scope', 'general']
      const parsed = questions.map((q) => ({
        body: String(q.body ?? '').trim().slice(0, 4000),
        section: SECTIONS.includes(String(q.section ?? '').trim().toLowerCase()) ? String(q.section).trim().toLowerCase() : 'general',
        sheet_ref: String(q.sheet_ref ?? '').trim().slice(0, 40) || null,
        context: String(q.context ?? '').trim().slice(0, 1000) || null,
      }))
      if (parsed.some((q) => !q.body)) return textContent('Every question needs a body', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — audit questions land only on your own bids.`, true)
      }
      let { data: audit } = await admin.from('bid_audits').select('id, status').eq('bid_id', bid.id)
        .order('requested_at', { ascending: false }).limit(1).maybeSingle()
      if (!audit) {
        const { data: created, error: audErr } = await admin.from('bid_audits')
          .insert({ bid_id: bid.id, status: 'pending', created_by: twin.twinUserId }).select('id, status').single()
        if (audErr) return textContent(`No audit row and could not open one: ${audErr.message}`, true)
        audit = created
      }
      const { data: inserted, error: noteErr } = await admin.from('bid_audit_notes').insert(parsed.map((q) => ({
        audit_id: audit!.id, bid_id: bid.id, author_id: twin.twinUserId,
        kind: 'question', section: q.section, body: q.body, sheet_ref: q.sheet_ref, context: q.context,
      }))).select('id')
      if (noteErr) return textContent(`Questions not saved: ${noteErr.message}`, true)
      const unanchored = parsed.filter((q) => !q.sheet_ref).length
      return textContent(JSON.stringify({
        ok: true, bid: `b${bid.bid_number}`, audit_id: audit!.id, seeded: inserted?.length ?? 0,
        ...(unanchored ? { warning: `${unanchored} question${unanchored === 1 ? '' : 's'} carry no sheet_ref — an unanchored question makes the auditor hunt through the whole set.` } : {}),
      }, null, 2))
    }
    case 'get_reference_rows': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      if (!ref) return textContent('get_reference_rows needs bid (YOUR twin shell)', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, created_by, estimator_id, twin_source_bid_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created).`, true)
      }
      if (!bid.twin_source_bid_id) return textContent(`b${bid.bid_number} has no reference pairing (twin_source_bid_id) — nothing to compare against.`, true)
      // The seal check — same doctrine as score_backtest's LOCK gate, in the read direction:
      // no scorecard, no reference rows. A scored shadow counts too.
      const [{ data: scored }, { data: shadowScored }] = await Promise.all([
        admin.from('twin_run_scores').select('run_label').eq('twin_bid_number', String(bid.bid_number)).limit(1),
        admin.from('twin_shadow_runs').select('id').eq('shadow_bid_id', bid.id).not('scored_at', 'is', null).limit(1),
      ])
      if (!scored?.length && !shadowScored?.length) {
        return textContent(`b${bid.bid_number} is still SEALED — no scorecard on record. score_backtest (or a scored shadow) breaks the seal; only then do the reference rows open.`, true)
      }
      const { data: refBid } = await admin.from('bids').select('id, bid_number, project_name').eq('id', bid.twin_source_bid_id).maybeSingle()
      if (!refBid) return textContent('Reference bid not found', true)
      const [{ data: rows }, { data: asg }] = await Promise.all([
        admin.from('bids_count_rows').select('id, fixture, count, unit, page, sequence_order').eq('bid_id', refBid.id).order('sequence_order').limit(500),
        admin.from('bid_pricing_assignments').select('count_row_id, unit_price_override, price_book_entry_id').eq('bid_id', refBid.id).limit(500),
      ])
      const entryIds = [...new Set((asg ?? []).map((a) => a.price_book_entry_id).filter(Boolean))]
      const priceById: Record<string, number> = {}
      if (entryIds.length) {
        const { data: entries } = await admin.from('price_book_entries').select('id, total_price').in('id', entryIds)
        for (const e of entries ?? []) priceById[e.id as string] = Number(e.total_price)
      }
      type RefAsg = { count_row_id: string; unit_price_override: number | null; price_book_entry_id: string }
      const asgByRow = new Map<string, RefAsg>(((asg ?? []) as RefAsg[]).map((a) => [a.count_row_id, a]))
      return textContent(JSON.stringify({
        reference: `b${refBid.bid_number}`,
        project_name: refBid.project_name,
        rows: (rows ?? []).map((r) => {
          const a = asgByRow.get(r.id as string)
          const unit_price = a ? (a.unit_price_override ?? priceById[a.price_book_entry_id] ?? null) : null
          return { fixture: r.fixture, count: r.count, unit: r.unit, page: r.page, unit_price }
        }),
        next: 'Run the scope-match line-compare, write the T4 scorecard to your ledger, and amend score_backtest with the verdict + counts_note.',
      }, null, 2))
    }
    case 'get_shadow_queue': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const days = Number(args.days ?? 14)
      const since = new Date(Date.now() - (Number.isFinite(days) && days > 0 ? days : 14) * 86400_000).toISOString()
      // Logistics only — pricing fields don't exist yet on eligible bids by definition
      // (bid_date_sent IS NULL is the blindness guarantee), and are never selected anyway.
      const QUEUE_COLS = 'id, bid_number, project_name, address, distance_from_office, bid_due_date, plans_link, created_at, robot_requested_at, robot_requested_by, plans_robot_readable, plans_robot_probe_note'
      // v2.2543: human-requested bids (the green robot icon) come first and bypass
      // the lookback window — a person's ask shouldn't age out of the queue.
      // v2.3032: plumbing-only — the twin's discipline (see disciplineRefusal).
      // v2.3080: plans must be READABLE by the intake service account — probe first.
      const plumbingId = await plumbingServiceTypeId(admin)
      if (!plumbingId) return textContent('No Plumbing service type found — cannot scope the queue to the twin\'s discipline', true)
      await probePlansSweep(req)
      const [recentRes, requestedRes] = await Promise.all([
        admin
          .from('bids')
          .select(QUEUE_COLS)
          .is('bid_date_sent', null)
          .not('plans_link', 'is', null)
          .eq('service_type_id', plumbingId)
          .eq('robot_opt_out', false)
          .gte('created_at', since)
          .not('project_name', 'ilike', 'ZZ %')
          .order('created_at', { ascending: false })
          .limit(25),
        admin
          .from('bids')
          .select(QUEUE_COLS)
          .is('bid_date_sent', null)
          .not('plans_link', 'is', null)
          .eq('service_type_id', plumbingId)
          .eq('robot_opt_out', false)
          .not('robot_requested_at', 'is', null)
          .not('project_name', 'ilike', 'ZZ %')
          .order('robot_requested_at', { ascending: true })
          .limit(25),
      ])
      if (recentRes.error) return textContent(`Queue lookup failed: ${recentRes.error.message}`, true)
      if (requestedRes.error) return textContent(`Queue lookup failed: ${requestedRes.error.message}`, true)
      const { data: shadowed } = await admin.from('twin_shadow_runs').select('reference_bid_id')
      const taken = new Set((shadowed ?? []).map((r: { reference_bid_id: string }) => r.reference_bid_id))
      type QueueRow = { id: string; bid_number: string; project_name: string | null; address: string | null; distance_from_office: number | null; bid_due_date: string | null; plans_link: string | null; created_at: string | null; robot_requested_at: string | null; robot_requested_by: string | null; plans_robot_readable: boolean | null; plans_robot_probe_note: string | null }
      const hasPlans = (b: QueueRow) => !taken.has(b.id) && String(b.plans_link ?? '').trim() !== ''
      const eligible = (rows: QueueRow[] | null) => (rows ?? []).filter((b) => hasPlans(b) && b.plans_robot_readable !== false)
      const requested = eligible(requestedRes.data as QueueRow[] | null)
      const requestedIds = new Set(requested.map((b) => b.id))
      const rest = eligible(recentRes.data as QueueRow[] | null).filter((b) => !requestedIds.has(b.id))
      // Unreadable-by-robots (v2.3080): listed, never queued — a human repairs the link.
      const unreadableSeen = new Set<string>()
      const unreadable = [...((requestedRes.data ?? []) as QueueRow[]), ...((recentRes.data ?? []) as QueueRow[])]
        .filter((b) => hasPlans(b) && b.plans_robot_readable === false && !unreadableSeen.has(b.id) && unreadableSeen.add(b.id))
        .map((b) => ({ bid: `b${b.bid_number}`, project: b.project_name, why: b.plans_robot_probe_note, requested: !!b.robot_requested_at }))
      const requesterIds = [...new Set(requested.map((b) => b.robot_requested_by).filter((x): x is string => !!x))]
      const { data: requesters } = requesterIds.length
        ? await admin.from('users').select('id, name').in('id', requesterIds)
        : { data: [] as Array<{ id: string; name: string | null }> }
      const nameById = new Map((requesters ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name]))
      const toEntry = (b: QueueRow) => ({
        bid: `b${b.bid_number}`,
        project: b.project_name,
        address: b.address,
        miles: b.distance_from_office,
        due: b.bid_due_date,
        created: b.created_at,
        ...(b.robot_requested_at
          ? { requested: true, requested_at: b.robot_requested_at, requested_by: (b.robot_requested_by && nameById.get(b.robot_requested_by)) || null }
          : {}),
      })
      const queue = [...requested.map(toEntry), ...rest.map(toEntry)]
      // Coverage (v2.2936, LEARNING_PLAN.md lever 2): how much of the live board is
      // shadowed, windowless — the number the auto-shadow program drives to 100%.
      const { data: allLive } = await admin.from('bids').select('id, plans_robot_readable')
        .is('bid_date_sent', null).not('plans_link', 'is', null).eq('service_type_id', plumbingId).eq('robot_opt_out', false).not('project_name', 'ilike', 'ZZ %').limit(1000)
      const liveRows = (allLive ?? []) as Array<{ id: string; plans_robot_readable: boolean | null }>
      const liveIds = liveRows.map((b) => b.id)
      const shadowedLive = liveIds.filter((id) => taken.has(id)).length
      const unreadableLive = liveRows.filter((b) => b.plans_robot_readable === false && !taken.has(b.id)).length
      return textContent(JSON.stringify({
        eligible: queue.length,
        requested: requested.length,
        coverage: {
          live_with_plans: liveIds.length, shadowed: shadowedLive, unshadowed: liveIds.length - shadowedLive,
          unreadable_by_robots: unreadableLive,
        },
        queue,
        ...(unreadable.length ? { unreadable, unreadable_note: 'These live bids have a plans link the Drive intake service account cannot read — not queued. A human shares the file with the service account or links the PDF itself; the next probe (24h, or plan-fetch ?probe=1) clears them.' } : {}),
        next: 'next_shadow claims the first one for you (requested entries first) — or open_shadow(reference_bid, axis) to pick. Then estimate exactly like a backtest and lock_shadow before the human number exists.',
      }, null, 2))
    }
    case 'open_shadow': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.reference_bid ?? '').trim()
      if (!ref) return textContent('Missing reference_bid', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let rq = admin.from('bids').select('id, bid_number, project_name, address, customer_id, service_type_id, distance_from_office, plans_link, gc_builder_id, bid_due_date, bid_date_sent, robot_opt_out')
      rq = uuidRe.test(ref) ? rq.eq('id', ref) : rq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: refBid, error: refErr } = await rq.maybeSingle()
      if (refErr) return textContent(`Reference lookup failed: ${refErr.message}`, true)
      if (!refBid) return textContent(`No bid found for "${ref}"`, true)
      if (refBid.bid_date_sent) {
        return textContent(`b${refBid.bid_number} has already been SENT — a shadow would not be blind. Use open_backtest instead.`, true)
      }
      const shadowDisciplineErr = await disciplineRefusal(admin, refBid as { bid_number: string; service_type_id: string | null })
      if (shadowDisciplineErr) return textContent(shadowDisciplineErr, true)
      // v2.3142: the estimator's opt-out ("Don't let robots shadow this bid") is final.
      if ((refBid as { robot_opt_out?: boolean | null }).robot_opt_out === true) {
        return textContent(`b${refBid.bid_number} is opted out of robot shadowing on its bid form — the estimator asked for no shadow. Pick another reference.`, true)
      }
      const { data: existingRun } = await admin.from('twin_shadow_runs').select('id, shadow_bid_id, status').eq('reference_bid_id', refBid.id).maybeSingle()
      if (existingRun) {
        const { data: sb } = await admin.from('bids').select('bid_number').eq('id', existingRun.shadow_bid_id).maybeSingle()
        return textContent(JSON.stringify({ ok: true, reused: true, shadow_bid: `b${sb?.bid_number}`, status: existingRun.status }, null, 2))
      }
      const r = await createShadowShell(admin, twin, refBid as ShadowRefBid, String(args.axis ?? '').trim() || null)
      if ('error' in r) return textContent(r.error, true)
      return textContent(JSON.stringify({
        ok: true, reused: false, shadow_bid: `b${r.bid_number}`, shadow_bid_id: r.id,
        reference: `b${refBid.bid_number}`, axis: String(args.axis ?? '') || null,
        next: 'Estimate like a backtest (census -> counts -> pricing), then lock_shadow(bid, total).',
      }, null, 2))
    }
    case 'next_shadow': {
      // The auto-shadow dispatcher (v2.2936, LEARNING_PLAN.md lever 2): claim the
      // next live bid that needs a shadow — human requests first (oldest ask), then
      // oldest eligible inside the lookback. The twin_shadow_runs row IS the claim;
      // an accidental same-instant duplicate deletes itself in favour of the
      // earliest-created run, so parallel agents never share a bid.
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const days = Number(args.days ?? 30)
      const since = new Date(Date.now() - (Number.isFinite(days) && days > 0 ? days : 30) * 86400_000).toISOString()
      const CLAIM_COLS = 'id, bid_number, project_name, address, customer_id, service_type_id, distance_from_office, plans_link, gc_builder_id, bid_due_date, bid_date_sent, created_at, robot_requested_at, backtest_axis, plans_robot_readable'
      // v2.3032: plumbing-only candidates — the 2026-09-07 b378 category error.
      // v2.3080: readable-plans-only candidates — the 2026-09-06 b480 blocked shadow.
      const claimPlumbingId = await plumbingServiceTypeId(admin)
      if (!claimPlumbingId) return textContent('No Plumbing service type found — cannot scope claims to the twin\'s discipline', true)
      // v2.3229 / v1.3.17: an answered plans ask ("Attached — rerun") against a shell
      // this twin still holds UNLOCKED is handed back before any new claim — the rerun
      // the estimator's tap promised, without relying on the robot to remember. Each
      // answered ask is consumed once (acted_at); answers that are not a rerun are
      // consumed too (nothing to resume). Skipped cleanly until the column lands.
      try {
        const nowIso = () => new Date().toISOString()
        const { data: asks, error: asksErr } = await admin.from('twin_questions')
          .select('id, about_bid_id, question, answer, answered_at, kind')
          .eq('twin_user_id', twin.twinUserId).eq('status', 'answered').is('acted_at', null)
          .not('about_bid_id', 'is', null).order('answered_at', { ascending: true }).limit(20)
        if (!asksErr) {
          const consume = (id: string) => admin.from('twin_questions').update({ acted_at: nowIso() }).eq('id', id).then(() => {}, () => {})
          for (const ask of (asks ?? []) as Array<{ id: string; about_bid_id: string; question: string; answer: string | null; kind: string | null }>) {
            if (effectiveTwinQuestionKind(ask) !== 'plans' || !answerRequestsRerun(ask.answer)) {
              await consume(ask.id)
              continue
            }
            const SHELL_COLS = 'id, bid_number, project_name, created_by, twin_source_bid_id'
            const { data: about } = await admin.from('bids').select(SHELL_COLS).eq('id', ask.about_bid_id).maybeSingle()
            if (!about) { await consume(ask.id); continue }
            type ShellRow = { id: string; bid_number: string; project_name: string | null; created_by: string | null; twin_source_bid_id: string | null }
            let shell: ShellRow | null = (about as ShellRow).created_by === twin.twinUserId && (about as ShellRow).twin_source_bid_id ? (about as ShellRow) : null
            if (!shell) {
              // The ask was filed on the HUMAN bid — find this twin's shell for it.
              const { data: mine } = await admin.from('bids').select(SHELL_COLS)
                .eq('twin_source_bid_id', (about as ShellRow).id).eq('created_by', twin.twinUserId)
                .order('created_at', { ascending: false }).limit(1).maybeSingle()
              shell = (mine as ShellRow | null) ?? null
            }
            if (!shell) { await consume(ask.id); continue }
            const { data: run } = await admin.from('twin_shadow_runs').select('id, status').eq('shadow_bid_id', shell.id).maybeSingle()
            if (!run || (run as { status: string }).status !== 'open') { await consume(ask.id); continue } // locked / scored / void: nothing to resume
            await consume(ask.id)
            const { data: ref } = await admin.from('bids').select('bid_number, project_name, plans_link, robot_requested_at').eq('id', shell.twin_source_bid_id!).maybeSingle()
            await admin.from('bids_submission_entries').insert({
              bid_id: shell.id,
              notes: `[pipeline STG-0 resume] a person answered the plans ask "${String(ask.answer ?? '').slice(0, 80)}" — the reference carries the new set; redo STG-2 onward and lock.`,
            }).then(() => {}, () => {})
            return textContent(JSON.stringify({
              ok: true, resumed: true,
              shadow_bid: `b${shell.bid_number}`, shadow_bid_id: shell.id,
              reference: ref ? `b${(ref as { bid_number: string }).bid_number}` : null,
              project: (ref as { project_name?: string | null } | null)?.project_name ?? shell.project_name,
              plans_link: (ref as { plans_link?: string | null } | null)?.plans_link ?? null,
              requested: !!(ref as { robot_requested_at?: string | null } | null)?.robot_requested_at,
              asked: ask.question, answered: ask.answer,
              next: 'This is YOUR existing shell, handed back because a person answered your plans ask. Redo STG-2 with the plan set now on the reference (plan-fetch reads the new link), then STG-3 and STG-5, and lock_shadow. Do not call next_shadow again until it is locked.',
            }, null, 2))
          }
        }
      } catch (_) {
        // Resume is best-effort; a normal claim follows.
      }
      await probePlansSweep(req)
      const [requestedRes, recentRes] = await Promise.all([
        admin.from('bids').select(CLAIM_COLS)
          .is('bid_date_sent', null).not('plans_link', 'is', null).eq('service_type_id', claimPlumbingId).eq('robot_opt_out', false).not('robot_requested_at', 'is', null)
          .not('project_name', 'ilike', 'ZZ %').order('robot_requested_at', { ascending: true }).limit(25),
        admin.from('bids').select(CLAIM_COLS)
          .is('bid_date_sent', null).not('plans_link', 'is', null).eq('service_type_id', claimPlumbingId).eq('robot_opt_out', false).gte('created_at', since)
          .not('project_name', 'ilike', 'ZZ %').order('created_at', { ascending: true }).limit(50),
      ])
      if (requestedRes.error) return textContent(`Queue lookup failed: ${requestedRes.error.message}`, true)
      if (recentRes.error) return textContent(`Queue lookup failed: ${recentRes.error.message}`, true)
      const { data: shadowed } = await admin.from('twin_shadow_runs').select('reference_bid_id')
      const taken = new Set((shadowed ?? []).map((r: { reference_bid_id: string }) => r.reference_bid_id))
      const seen = new Set<string>()
      let skippedUnreadable = 0
      const candidates = [...(requestedRes.data ?? []), ...(recentRes.data ?? [])].filter((b) => {
        if (taken.has(b.id) || seen.has(b.id) || !String(b.plans_link ?? '').trim()) return false
        seen.add(b.id)
        if ((b as { plans_robot_readable?: boolean | null }).plans_robot_readable === false) {
          skippedUnreadable += 1
          return false
        }
        return true
      }) as ShadowRefBid[]
      if (!candidates.length) {
        return textContent(JSON.stringify({
          done: true,
          note: `Every eligible live bid (requested, or created in the last ${days} days) already has a shadow.`,
          ...(skippedUnreadable ? { skipped_unreadable: skippedUnreadable, unreadable_note: 'Live bids whose plans the intake service account cannot read were skipped — get_shadow_queue lists them; a human repairs the link.' } : {}),
        }, null, 2))
      }
      for (const refBid of candidates) {
        const axis = String((refBid as { backtest_axis?: string | null }).backtest_axis ?? '').trim() || null
        const r = await createShadowShell(admin, twin, refBid, axis)
        if ('error' in r) continue // someone else claimed between the list and the insert — next candidate
        // Same-instant duplicate check: earliest-created run for this reference wins.
        const { data: runs } = await admin.from('twin_shadow_runs')
          .select('id, shadow_bid_id, created_at').eq('reference_bid_id', refBid.id).order('created_at', { ascending: true })
        if (runs && runs.length > 1 && runs[0]!.shadow_bid_id !== r.id) {
          await admin.from('twin_shadow_runs').delete().eq('shadow_bid_id', r.id).then(() => {}, () => {})
          await admin.from('bids').delete().eq('id', r.id).then(() => {}, () => {})
          continue
        }
        return textContent(JSON.stringify({
          ok: true, shadow_bid: `b${r.bid_number}`, shadow_bid_id: r.id,
          reference: `b${refBid.bid_number}`, project: refBid.project_name, axis,
          requested: !!(refBid as { robot_requested_at?: string | null }).robot_requested_at,
          remaining_unshadowed: candidates.length - 1,
          next: 'This shadow is yours alone. Estimate like a backtest (substrate -> takeoff -> paste_counts) and lock_shadow BEFORE the human number exists. Do not call next_shadow again until this one is locked.',
        }, null, 2))
      }
      return textContent(JSON.stringify({ done: true, note: 'All current candidates were claimed by parallel agents — nothing left to shadow right now.' }, null, 2))
    }
    case 'void_shadow': {
      // v2.3032: the door for a shadow that should never score — a category error, a
      // wrong reference, a contaminated run. Own shells only; a scored run stays scored.
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const reason = String(args.reason ?? '').trim().slice(0, 1000)
      if (!ref || !reason) return textContent('void_shadow needs bid (your shadow shell) + reason', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, created_by, estimator_id')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.created_by !== twin.twinUserId && bid.estimator_id !== twin.twinUserId) return textContent('Not your shell (created_by / estimator fence)', true)
      const { data: run } = await admin.from('twin_shadow_runs').select('id, status').eq('shadow_bid_id', bid.id).maybeSingle()
      if (!run) return textContent(`b${bid.bid_number} has no shadow run to void`, true)
      if (run.status === 'scored') return textContent(`b${bid.bid_number} is already SCORED — a scored run stays on the record; the owner judges its gate eligibility instead.`, true)
      const { error: updErr } = await admin.from('twin_shadow_runs').update({ status: 'void' }).eq('id', run.id)
      if (updErr) return textContent(`Void failed: ${updErr.message}`, true)
      await admin.from('bids_submission_entries').insert({ bid_id: bid.id, notes: `[shadow VOID] via twin-mcp void_shadow (was ${run.status}): ${reason}` }).then(() => {}, () => {})
      return textContent(JSON.stringify({ ok: true, bid: `b${bid.bid_number}`, was: run.status, now: 'void', note: 'score_shadows only scores locked runs; this one is out of the loop for good.' }, null, 2))
    }
    case 'lock_shadow': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const total = Number(args.total)
      if (!ref || !Number.isFinite(total) || total <= 0) return textContent('lock_shadow needs bid + positive total', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      const { data: run, error: runErr } = await admin.from('twin_shadow_runs')
        .select('id, status, reference_bid_id, twin_user_id').eq('shadow_bid_id', bid.id).maybeSingle()
      if (runErr || !run) return textContent(`No shadow run for b${bid.bid_number}`, true)
      if (run.twin_user_id !== twin.twinUserId) return textContent('Not your shadow run', true)
      if (run.status === 'scored') return textContent('Run already scored — locking refused', true)
      const { data: refBid } = await admin.from('bids').select('bid_number, bid_date_sent').eq('id', run.reference_bid_id).maybeSingle()
      if (refBid?.bid_date_sent) {
        return textContent(`Reference b${refBid.bid_number} was SENT before you locked — this run is contaminated. Marking nothing; flag it in the ledger and drop the run.`, true)
      }
      const { error } = await admin.from('twin_shadow_runs')
        .update({ status: 'locked', locked_total: total, locked_at: new Date().toISOString() })
        .eq('id', run.id)
      if (error) return textContent(`Lock failed: ${error.message}`, true)
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[shadow LOCK] Blind total $${total.toLocaleString()} locked at ${new Date().toISOString()} — before the human number exists. Scoring is automatic when the reference is sent.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({ ok: true, shadow_bid: `b${bid.bid_number}`, locked_total: total, status: 'locked' }, null, 2))
    }
    case 'score_shadows': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: locked, error } = await admin.from('twin_shadow_runs')
        .select('id, shadow_bid_id, reference_bid_id, axis, locked_total').eq('status', 'locked')
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      const scored: Array<Record<string, unknown>> = []
      for (const run of locked ?? []) {
        const { data: refBid } = await admin.from('bids')
          .select('bid_number, project_name, bid_value, bid_date_sent, outcome, estimator_id, bid_date_sent_attested_by, created_by').eq('id', run.reference_bid_id).maybeSingle()
        if (!refBid?.bid_date_sent || refBid.bid_value == null) continue
        const refVal = Number(refBid.bid_value)
        const delta = refVal > 0 ? ((Number(run.locked_total) - refVal) / refVal) * 100 : null
        // v2.3080: WHOSE number was this? A calibration-standard teacher counts
        // toward Gate B; anyone else is practice (b481 scored against Grace's bid).
        const teacher = await resolveTeacher(admin, refBid as TeacherBid)
        await admin.from('twin_shadow_runs').update({
          status: 'scored', reference_value: refVal,
          delta_pct: delta == null ? null : Math.round(delta * 10) / 10,
          scored_at: new Date().toISOString(),
          teacher_user_id: teacher.id, teacher_name: teacher.name,
        }).eq('id', run.id)
        const { data: sb } = await admin.from('bids').select('bid_number').eq('id', run.shadow_bid_id).maybeSingle()
        const teacherLabel = teacher.name ? ` by ${teacher.name} (${teacher.standard ? 'calibration standard' : 'practice teacher — not a gate run'})` : ''
        const line = `[shadow SCORECARD] Twin locked $${Number(run.locked_total).toLocaleString()} (blind, pre-send) vs human $${refVal.toLocaleString()}${teacherLabel} = ${delta == null ? 'n/a' : (delta > 0 ? '+' : '') + (Math.round(delta * 10) / 10) + '%'} — axis ${run.axis ?? 'unclassified'}, reference b${refBid.bid_number} (${refBid.project_name}).`
        await admin.from('bids_submission_entries').insert({ bid_id: run.shadow_bid_id, notes: line }).then(() => {}, () => {})
        await admin.from('bids_submission_entries').insert({ bid_id: run.reference_bid_id, notes: line }).then(() => {}, () => {})
        scored.push({ shadow_bid: `b${sb?.bid_number}`, reference: `b${refBid.bid_number}`, axis: run.axis, locked: run.locked_total, human: refVal, delta_pct: delta == null ? null : Math.round(delta * 10) / 10, teacher: teacher.name, teacher_standard: teacher.standard })
      }
      // Confidence scoreboard: rolling per-axis stats over all scored runs. Gate
      // math takes STANDARD-teacher runs only (v2.3080); practice runs are counted
      // beside them so the difference is visible.
      const { data: allScored } = await admin.from('twin_shadow_runs')
        .select('axis, delta_pct, scored_at, teacher_user_id').eq('status', 'scored').order('scored_at', { ascending: false })
      const { data: standards } = await admin.from('users').select('id').eq('calibration_standard', true)
      const standardIds = new Set(((standards ?? []) as Array<{ id: string }>).map((u) => u.id))
      const byAxis: Record<string, { standard: number[]; practice: number[] }> = {}
      for (const r of allScored ?? []) {
        const bucket = (byAxis[r.axis ?? 'unclassified'] ??= { standard: [], practice: [] })
        const isStandard = !!r.teacher_user_id && standardIds.has(r.teacher_user_id as string)
        ;(isStandard ? bucket.standard : bucket.practice).push(Number(r.delta_pct))
      }
      const scoreboard = Object.entries(byAxis).map(([axis, { standard, practice }]) => {
        const all = [...standard, ...practice]
        return {
          axis, runs: all.length, standard_runs: standard.length, practice_runs: practice.length,
          mean_abs_pct: all.length ? Math.round((all.reduce((s, d) => s + Math.abs(d), 0) / all.length) * 10) / 10 : null,
          last5_in_8pct: standard.slice(0, 5).filter((d) => Math.abs(d) <= 8).length,
          gate_b_met: standard.length >= 5 && standard.slice(0, 5).every((d) => Math.abs(d) <= 8),
        }
      })
      return textContent(JSON.stringify({ newly_scored: scored, scoreboard, gate_note: 'gate_b_met / last5_in_8pct count calibration-standard teachers only (users.calibration_standard); practice_runs are shown, not gated.' }, null, 2))
    }
    default:
      return textContent(`Unknown tool: ${name}`, true)
  }
}

async function handleRpc(req: Request, msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }) {
  const { id, method, params } = msg
  switch (method) {
    case 'initialize': {
      const requested = (params?.protocolVersion as string) ?? PROTOCOL_VERSIONS[0]
      const version = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]
      return rpcResult(id, {
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: 'pipetooling-twin-mcp', version: '1.4.0' },
        instructions:
          "PipeTooling digital-twin seat (estimator-only). Call get_brief first, then get_directory; mint_session gives you a signed-in browser link to the real apps — PipeTooling by default, CountTooling (the PDF-takeoff tool) with app: 'counttooling'. The work happens there. Every call needs your per-twin token (X-Twin-Token or Bearer).",
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call': {
      const name = params?.name as string
      const args = (params?.arguments as Record<string, unknown>) ?? {}
      try {
        const result = await callTool(req, name, args)
        return rpcResult(id, result)
      } catch (e) {
        return rpcResult(id, textContent(`Tool error: ${String(e)}`, true))
      }
    }
    default:
      if (method?.startsWith('notifications/')) return null // notifications get no response
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method === 'GET') {
    // No server-initiated stream — spec-permitted for stateless servers.
    return new Response('twin-mcp: MCP streamable-HTTP endpoint. POST JSON-RPC here.', { status: 405, headers: corsHeaders })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400)
  }

  if (Array.isArray(body)) {
    const responses = []
    for (const msg of body) {
      const r = await handleRpc(req, msg)
      if (r) responses.push(r)
    }
    return responses.length > 0 ? json(responses) : new Response(null, { status: 202, headers: corsHeaders })
  }

  const response = await handleRpc(req, body as Record<string, unknown>)
  return response ? json(response) : new Response(null, { status: 202, headers: corsHeaders })
})
