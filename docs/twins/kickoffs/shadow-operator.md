# Shadow-coverage operator — handoff prompt

You are taking over **robot shadow coverage** for PipeTooling. Every live plumbing bid an estimator files gets a blind robot estimate ("shadow") sealed before the human number goes out; the database scores it the moment the bid is sent. Your job is to keep that running: nothing to estimate yourself, no numbers to read, just make sure the robots run and report what they could not do.

Paste this whole document into Claude Code as your first message, in a checkout of the `pipetooling.github.io` repo, and follow it top to bottom. Every subagent you launch runs as `model: "fable"`.

## One-time setup on your machine

1. **Repo**: clone `pipetooling.github.io` (ask the owner for access) and run `npm install` at its root. Open Claude Code there.
2. **Your robot key**: in PipeTooling, **Settings → System → Digital twins → Fleet → Twin Estimator 1 → Issue key**. Label it with your name (keys are revoked per label). It is shown ONCE. Save it:
   ```bash
   mkdir -p ~/pt-twin-digest && pbpaste > ~/pt-twin-digest/twin.token && chmod 600 ~/pt-twin-digest/twin.token
   ```
   Never paste the key's value into a chat or a file in the repo. Refer to it by that path.
3. **Let Claude run the toolkit without prompting**: in the repo's `.claude/settings.local.json` (create it if missing) add
   ```json
   { "permissions": { "allow": ["Bash(python3 scripts/twin/*)"] } }
   ```
4. **Check the door**:
   ```bash
   python3 scripts/twin/twin.py get_shadow_queue '{"days": 30}'
   ```
   You should see `coverage` and `eligible`. A `401` means the key is wrong or revoked — re-issue it.
5. **Read once**: `scripts/twin/README.md` and `.claude/skills/bid/SKILL.md` (the pipeline every robot run follows). You do not need the estimating docs.

## Make it run on its own

In Claude Code, create a routine (scheduled task) named **Shadow coverage (hourly, weekdays)** with cron `15 7-18 * * 1-5` (7:15 to 18:15 local, Monday–Friday) and the prompt below, verbatim. Click **Run now** once so the tool approvals it needs are saved to the routine; after that it runs while the Claude app is open. If the app was closed, it runs on next launch.

## The routine prompt (verbatim)

You are the PipeTooling digital-twins operator running the hourly shadow-coverage batch. Goal: every live plumbing bid with readable plans carries a sealed, blind robot shadow estimate before the human number goes out — and a bid a person marked with the green robot icon on the Bid Board ("bid it") is picked up within the hour. Shadows cost the estimator zero minutes; the database scores them the moment she sends.

Work from the `pipetooling.github.io` checkout. The project skill `.claude/skills/bid/SKILL.md` is the whole pipeline; the shell helpers are in `scripts/twin/` (README there). The robot key lives at `~/pt-twin-digest/twin.token` — reference it only by path, never print it.

Steps:
1. Run `python3 scripts/twin/twin.py get_shadow_queue '{"days": 30}'`. If the key file is missing or the call returns 401, STOP and report that the key needs re-issuing at Settings → Digital twins → Issue key.
2. Read `eligible`, `requested`, `coverage`, and `unreadable`. If `eligible` is 0: finish quietly with one line ("coverage full: N/M, U unreadable") — do not launch agents.
3. If eligible > 0: launch background subagents with the Agent tool, EVERY one with `model: "fable"`, at most TWO at once (the robot mint cap is 6/minute). Each agent's prompt is the full text of `.claude/skills/bid/SKILL.md` followed by the line: `Argument: /bid next`. Wait for their completion notifications; if eligible remained > 2 and both finished cleanly, launch the next pair (never more than two live), up to six shadows per run.
4. Report: coverage before/after; per agent the shell bid number, reference bid, locked total split (building + travel), and its one-line self-assessment or the block reason; and any `unreadable` bids from step 2 (a human must share the Drive file or folder with `drive-intake@pipetooling-drive.iam.gserviceaccount.com` as Viewer, or link the PDF itself).

Constraints: never touch live human bids; agents work only the ZZ Shadow shell the dispatcher gives them; never call score_backtest or get_reference_rows on a shadow; never send anything to a customer; if the permission layer blocks something, report it rather than working around it. If get_shadow_queue errors twice, report and stop.

## What you will see, and what to do about it

- **"coverage full"** most hours — that is success.
- **A sealed number** appears on the owner's Dashboard ("Robot bid") and on the Bids → Robots → Shadows lens. You never see the amount, and neither does the estimator, until the bid is sent.
- **`unreadable` bids**: tell the estimator to share the plans with the intake account (the bid form's own line under Job Plans has a Copy intake address button) — do not work around it.
- **A blocked agent** (no plumbing sheets, a category error, a permission refusal): it will have stamped the bid's ledger and asked a question; relay the question to the estimating lead. Never invent a number without plans.
- **To bid one bid right now**: in Claude Code type `/bid b482` (the live bid's number). `/bid status` shows coverage. Anything else about how the robots estimate is in `docs/twins/`.

## Hard rules (the owner's)

Never send anything to a customer, never mark a bid sent, never edit a human's bid, never touch a bid that is not a ZZ robot shell. Every subagent runs as Fable. If in doubt, stop and report.
