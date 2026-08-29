# Twin harness kit — how any agent works PipeTooling

---
file: docs/twins/TWIN_HARNESS.md
type: Twin onboarding / Integration guide
purpose: Everything an agent harness (any provider — Claude, Grok/xAI, GPT, open-source) needs to run a digital twin against the deployed apps — auth, session flow, rules of engagement, and how results are scored. The owner hands a partner this file + a twin token; nothing else is required.
audience: Twin harness operators, External agent providers, Developers
last_updated: 2026-08-28
---

## What you get

One **digital twin account** — a real, flagged user with the **estimator** role — and a
**per-twin token** that can mint sign-in sessions for that account only. Your agent works
the real app in a headless browser exactly as a person would. Everything it does is
attributable to its account (`created_by`, the fleet ledger, per-twin analytics), every
session wears a visible 🤖 banner, and the database itself fences what it may change.

## Signing in (the whole integration)

```
POST https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/twin-login
Headers:  X-Twin-Token: <your per-twin token>     (partners)
          — or —  X-Twin-Login-Secret: <master>   (owner/ops only)
Body:     { "email": "twin-estimator-1@twins.pipetooling.local",   // optional with a token
            "redirectTo": "https://pipetooling.com/bids",
            "run": "<mission-id>" }                                 // logged to the ledger
→ 200 { "success": true, "action_link": "https://…verify?token=…" }
```

Navigate your headless browser to `action_link` — it lands signed in on the deployed app.
Notes:
- **Links are single-use and sessions expire** (hours). Re-minting on expiry is a normal
  re-login, not an error. Cap: **6 mints/minute per twin** (429 + retry_after_seconds).
- `401` = bad/revoked token · `403` = account not a flagged estimator twin · `404` = no
  such twin. Tokens are revocable per-partner; the master secret is the fleet kill switch.
- CountTooling (the takeoff app) has the same function at
  `https://hrqxvfydmvtvwhvefmqc.supabase.co/functions/v1/twin-login` with its own
  credentials (`twin-estimator-<n>@twins.counttooling.local`). **MCP clients don't need
  it**: `mint_session` takes `app: 'counttooling'` (v2.2439) — the MCP server holds CT's
  twin secret, so one per-twin token signs into both apps.

## What to load into the agent

1. `docs/twins/estimator.md` — the role brief (identity, map, loops, vocabulary,
   guardrails). ~4.5k tokens; written for limited-context agents.
2. `docs/twins/APP_DIRECTORY.md` — where everything lives; task→URL index.
3. One mission from `docs/twins/missions/estimator.md` — **verbatim, no extra hints**.

## Rules of engagement

- **Browser only.** The agent drives the UI like a person — no direct database access, no
  API scraping. (An MCP/API lane may come later; today the UI is the contract.)
- **The safety rungs are DB-enforced, per twin, owner-flipped**:
  1. *Tester* — `read_only`: sees everything its role sees, every write blocked.
  2. *Fenced estimator* — writes only bids it **created** or is the **assigned estimator**
     on (+ their child records); everything else read-only. ZZ-prefixed names for test
     records is etiquette on top.
  3. *Working estimator* — same fence; real bids enter it when a human assigns them.
- **Nothing leaves the building without a human**: letters are copy/print; the app sends
  no email on an estimator's behalf. The final "send" is always a person.
- **Report, don't improvise**: bugs and surprises go through the in-app `/help` → feedback
  (it lands in the dev inbox, attributed to the twin) and the mission report. If a mission
  seems to require touching a record it shouldn't, the twin stops and reports.
- **Data sensitivity**: an estimator twin sees real business data (customers, bid values,
  outcomes). A partner seat means the partner's model processes that data — the owner
  grants seats accordingly.

## How results are scored

Missions carry independent verification (see `missions/estimator.md`): the scorer checks
the claim against the app/DB and records pass/partial/fail + every stumble. The app's own
per-estimator analytics (win rate, margins, Estimators pivot) double as the twin's
long-run scorecard, since twins are excluded from human metrics but not from their own.

## Operator runbook (owner side)

- **Mint a twin**: Active Accounts → Manually add user (role estimator,
  `twin-<role>-<n>@twins.pipetooling.local`), then flag it:
  `update users set is_digital_twin = true, read_only = true where email = '…'` (dev).
- **Issue a per-twin token**: Settings → System → Digital twins → **Issue key** on the
  twin's card (dev role). The key is shown once; only its sha256 lands in
  `twin_credentials`. Label it per partner — revocation is per-key.
- **Revoke**: set `revoked_at = now()` on the credential row (dev). Master secret rotation
  (`supabase secrets set TWIN_LOGIN_SECRET=…`) kills the whole fleet's ops path.
- **Graduate a rung**: flip `read_only`, or assign a real bid's estimator to the twin.
- **Audit**: `twin_runs` (every mint + mission, which credential), `created_by` on
  everything it wrote, the board's Estimator column.
