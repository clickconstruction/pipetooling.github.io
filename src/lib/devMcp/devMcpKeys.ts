/**
 * Dev MCP keys (v2.3640, to-dos/mcp-servers.md): the pure half of Settings → Your
 * account → Dev MCP keys. A key is generated in the browser; its sha256 is stored
 * (`dev_mcp_credentials`) for the lookup and, since v2.5899, the key itself sits in Vault
 * (`secret_id`) so the card can copy it again; it reads the app AS its owner through
 * `dev-mcp`. The `ptd_` prefix is the naming scheme's: a scanner, a person and the
 * Worker can tell a dev key from a twin key (`ptt_`) — both prefixes live in
 * `_shared/mcpKeyPrefixes.ts`.
 */

import { DEV_MCP_KEY_PREFIX, mcpConnectorHeader } from '../mcpKeyPrefixes'

export { DEV_MCP_KEY_PREFIX }
export const DEV_MCP_PUBLIC_URL = 'https://mcp.clicktooling.com/dev'
export const DEV_MCP_ENV_VAR = 'PT_DEV_MCP_TOKEN'

/** `secret_id` is absent until the v2.5899 column is on prod (the card retries its read without it). */
export type DevMcpKeyRow = { id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null; secret_id?: string | null }
/** One `dev_mcp_calls` row of the reveal log (v2.5899): which key, when. */
export type DevMcpRevealRow = { credential_id: string | null; created_at: string }
/** The `dev_mcp_calls.verb` the reveal RPC writes — the card reads the log by it. */
export const DEV_MCP_REVEAL_VERB = 'reveal_key'

export function formatDevMcpKey(hex: string): string {
  return `${DEV_MCP_KEY_PREFIX}${hex}`
}

/** The label as stored: trimmed, capped, never empty — keys are revoked by label. */
export function devMcpKeyLabel(raw: string): string {
  return raw.trim().slice(0, 80) || 'unlabeled'
}

/**
 * The one line a dev adds to their shell profile. The key lives in the environment, never
 * in the repo: `.mcp.json` reads `${PT_DEV_MCP_TOKEN}`. Single quotes — a key is
 * `ptd_` + hex, so there is nothing to escape.
 */
export function devMcpShellLine(key: string): string {
  return `export ${DEV_MCP_ENV_VAR}='${key}'`
}

/**
 * The one command a person pastes into Terminal (v2.3686): drops any old line, appends the
 * shell line to ~/.zshrc, and says so. The key rides inside it — the same exposure as
 * "Copy shell line" — but the person never has to open a file or know what a profile is.
 */
export function devMcpSetupCommand(key: string): string {
  return `sed -i '' '/^export ${DEV_MCP_ENV_VAR}=/d' ~/.zshrc; ${devMcpShellLine(key)} && echo "${devMcpShellLine(key)}" >> ~/.zshrc && echo "Saved. Now quit Claude Code and open it again."`
}

/** The claude.ai connector's `authorization` header value — the one rule for both audiences lives in `mcpKeyPrefixes.ts`. */
export const devMcpConnectorHeader = mcpConnectorHeader

export function splitDevMcpKeys(rows: DevMcpKeyRow[]): { live: DevMcpKeyRow[]; revoked: DevMcpKeyRow[] } {
  return { live: rows.filter((r) => !r.revoked_at), revoked: rows.filter((r) => r.revoked_at) }
}

/** A live key whose plaintext sits in Vault: the card offers Copy. A key from before v2.5899 has no secret. */
export function devMcpKeyCanCopy(row: DevMcpKeyRow): boolean {
  return !row.revoked_at && !!row.secret_id
}

/** Newest reveal per key from the log, newest first or not — the latest `created_at` wins. */
export function lastRevealByKey(calls: DevMcpRevealRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of calls) {
    if (!c.credential_id) continue
    const prev = out[c.credential_id]
    if (!prev || c.created_at > prev) out[c.credential_id] = c.created_at
  }
  return out
}

type DbError = { message: string; code?: string | null } | null | undefined

/** PostgREST's answer when the client is ahead of the migration: the column is not there yet (42703). */
export function isMissingColumnError(error: DbError): boolean {
  return !!error && (error.code === '42703' || /column .* does not exist/i.test(error.message))
}

/** PostgREST's answer when the client is ahead of the migration: the function is not there yet (PGRST202). */
export function isMissingFunctionError(error: DbError): boolean {
  return !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message))
}
