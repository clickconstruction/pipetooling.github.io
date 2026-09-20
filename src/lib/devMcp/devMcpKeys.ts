/**
 * Dev MCP keys (v2.3640, to-dos/mcp-servers.md): the pure half of Settings → Your
 * account → Dev MCP keys. A key is generated in the browser, shown once, and only its
 * sha256 is stored (`dev_mcp_credentials`); it reads the app AS its owner through
 * `dev-mcp`. The `ptd_` prefix is the naming scheme's: a scanner, a person and the
 * Worker can tell a dev key from a twin key (`ptt_`).
 */

export const DEV_MCP_PUBLIC_URL = 'https://mcp.clicktooling.com/dev'
export const DEV_MCP_KEY_PREFIX = 'ptd_'
export const DEV_MCP_ENV_VAR = 'PT_DEV_MCP_TOKEN'

export type DevMcpKeyRow = { id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

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

export function splitDevMcpKeys(rows: DevMcpKeyRow[]): { live: DevMcpKeyRow[]; revoked: DevMcpKeyRow[] } {
  return { live: rows.filter((r) => !r.revoked_at), revoked: rows.filter((r) => r.revoked_at) }
}
