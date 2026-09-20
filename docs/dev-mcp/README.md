# dev-mcp — the MCP server a dev's agent reads PipeTooling through

---
file: docs/dev-mcp/README.md
type: Integration guide
purpose: What dev-mcp is, how a dev connects an agent to it, what the door allows and refuses, and how to extend it. The plan and the naming scheme live in to-dos/mcp-servers.md; the function reference is EDGE_FUNCTIONS.md → dev-mcp.
audience: Developers, AI agents
last_updated: 2026-09-20
sections:
  - The idea
  - Connect
  - The verbs
  - What the door refuses
  - The call log
  - Extending it
---

## The idea

`https://mcp.clicktooling.com/dev` reads the app **as the dev whose key it is**. The function resolves the key to a person, mints that person's own session, and calls the app's own API with it — **GET only**. PostgREST runs GET in a read-only transaction, so the database refuses a write whatever an RPC is named; RLS and every `auth.uid()` role check apply exactly as on the screen. The service role is used for three things: resolving the key, minting the session, writing the call log.

It replaces two habits: read-only REST probes through a signed-in browser pane, and raw SQL through the Supabase MCP.

## Connect

Settings → System → Digital twins → **Dev MCP keys** → *Issue a key* (one per machine; shown once; `ptd_…`). Put `export PT_DEV_MCP_TOKEN='ptd_…'` in your shell profile; `.mcp.json` already registers the `dev-mcp` connector with that variable. MCP servers connect at session start — a session launched without the variable cannot repair the connector mid-flight. First call: `whoami`.

## The verbs

| Verb | What it does |
|---|---|
| `whoami` | Who the key reads as, and the door's limits. |
| `find_rpc(text)` · `find_table(text)` · `get_table(table)` | The generated catalog (`dev-mcp/catalog.ts`, from `src/types/database.ts`): names, arguments, columns. Never guess a name. |
| `call_read(rpc, args?, limit?)` | Any RPC, as you, over GET. |
| `read_rows(table, select?, filters?, order?, limit?)` | Any table or view, RLS-bound; default 50 rows, at most 200. |

Resolvers (`find_job` …), composites (`get_job`, `get_customer`, `get_bid`) and `view_as` arrive with PR 4b-2.

## What the door refuses

- **Writes** — by the database (`25006`, read-only transaction), not by a list in the function.
- **Names not in the catalog**, and five credential tables that are never read — directly or through an embed (`DENIED_TABLES` in `_shared/devMcpDoor.ts`).
- **Secrets** — any key named `token`, `secret`, `password`, `api_key`, `hash` (whole or as a `_suffix`) is redacted from every reply at any depth, and cannot be filtered on. An agent's transcript is not a place for a portal token.
- **Known limit** — redaction is by key name. A value that *contains* a secret under another name (a portal URL with its token in the path) comes back as the app shows it to you; you are reading as yourself.
- **Oversized asks** — a request over 6,000 characters as a URL; a reply over 80,000 characters is cut, and says so.

## The call log

`dev_mcp_calls`: one row per call — who, verb, the RPC or table named, args, outcome, rows, milliseconds. Devs read it. It is also the evidence for which composites are worth building next: a question asked the long way, often, earns a verb.

## Extending it

Kernel first: what a verb may name and how it becomes a GET is pure code in `supabase/functions/_shared/devMcpDoor.ts` (tests in `src/lib/devMcp/`). After `npm run gen-types:linked`, run `node scripts/build-dev-mcp-catalog.mjs` (CI fails on a stale catalog) and redeploy `dev-mcp`. The JSON-RPC shell is `_shared/mcpJsonRpc.ts`; the public route is one line in `scripts/cloudflare/mcp-router.worker.js`.
