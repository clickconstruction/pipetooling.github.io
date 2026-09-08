# scripts/twin — the robot-estimator toolkit

Stdlib-only Python helpers a Claude Code session (or a human) uses to drive the
twin program from the shell. They are what the `/bid` skill calls. Nothing
secret lives here: the per-twin key is a file on the machine, the publishable
key comes from `.env.local`.

| Script | What it does | Acts as |
|---|---|---|
| `twin.py <tool> ['<json>']` | Call one twin-mcp verb (`get_brief`, `next_shadow`, `lock_shadow`, …) | twin |
| `twinrest.py [--as twin\|dev] get\|patch\|post\|rpc …` | Signed-in PostgREST / RPC calls (`rpc list_shadow_runs`) | twin or dev seat |
| `probe_plans.py [--force] [--bid bNNN]` | "Plans readable by robots" sweep or single check (plan-fetch probe) | twin |
| `set_plans.py bNNN <url> [--apply]` | Repoint a **ZZ robot shell's** plans link, then probe it | twin |
| `twinenv.py` | Shared settings: URL/anon key from `.env.local`, key file, dev secret | — |

## One-time setup on a machine

1. Issue a twin key: **Settings → Digital twins → Issue key** (shown once).
2. Save it: `mkdir -p ~/pt-twin-digest && pbpaste > ~/pt-twin-digest/twin.token && chmod 600 ~/pt-twin-digest/twin.token`
   (or set `TWIN_TOKEN_FILE`). Revoke it in the same Settings card to cut the machine off.
3. Launch sessions with `bash scripts/twin-session.sh` so the MCP connector is live too.
4. For Claude Code to run these without a prompt each time, add to the **main
   checkout's** `.claude/settings.local.json` (gitignored; only you can edit it):
   ```json
   "Bash(python3 scripts/twin/*)"
   ```
   The dev-side script (`twinrest.py --as dev`) additionally needs `VITE_DEV_LOGIN_SECRET` in `.env.local`.

## Rules the scripts enforce (and you should too)

- Never print the key; reference it by path.
- Writes stay inside the twin write fence: ZZ shells the twin created. `set_plans.py`
  refuses human bids by name — their plans link is the estimator's record.
- `--as dev` is for staff metadata (axis, holdout, calibration standard). It is not a
  way around the fence.
- The user's Homebrew `python3` (3.13) fails TLS to supabase.co on Diane's Mac; run
  from the Claude sandbox or a stock `python3`.

See `docs/twins/TWIN_HARNESS.md` for the harness, `docs/twins/FEEDBACK_LOOP.md` for
the audit loop, and `.claude/skills/bid/SKILL.md` for the pipeline itself.
