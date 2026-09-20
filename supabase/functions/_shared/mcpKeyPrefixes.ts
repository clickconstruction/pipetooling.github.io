// The MCP servers' key prefixes (to-dos/mcp-servers.md → the naming scheme). A key is a
// prefix + 64 hex; only its sha256 is stored, and lookup hashes the WHOLE presented string,
// so the prefix is part of the key and the bare-hex twin keys minted before it keep working.
// The prefix lets a secret scanner, a person and the Worker tell the audiences apart.
//
// Shared by the client (Settings → Digital twins, Settings → Dev MCP keys) and twin-setup.
// scripts/cloudflare/mcp-router.worker.js is a single deployed file and cannot import this:
// it carries its own copy of the rule, and src/lib/mcpRouterWorker.test.ts holds the two together.
// Pure: no env reads, no network.

export const TWIN_MCP_KEY_PREFIX = 'ptt_'
export const DEV_MCP_KEY_PREFIX = 'ptd_'

export function formatTwinMcpKey(hex: string): string {
  return `${TWIN_MCP_KEY_PREFIX}${hex}`
}

export type McpAudiencePath = '/twin' | '/dev'

/** The other audience's prefix and where a key carrying it belongs. */
const WRONG_DOOR: Record<McpAudiencePath, { prefix: string; belongsAt: McpAudiencePath; holder: string }> = {
  '/twin': { prefix: DEV_MCP_KEY_PREFIX, belongsAt: '/dev', holder: 'dev' },
  '/dev': { prefix: TWIN_MCP_KEY_PREFIX, belongsAt: '/twin', holder: 'twin' },
}

/** The header each audience presents its key in, beside `Authorization: Bearer`. */
export const MCP_TOKEN_HEADER: Record<McpAudiencePath, string> = {
  '/twin': 'x-twin-token',
  '/dev': 'x-dev-token',
}

function bearerOf(authorization: string | null | undefined): string {
  const auth = (authorization ?? '').trim()
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

/**
 * The Worker's one check: a key that names the OTHER audience is refused at the edge, before
 * the fetch. Returns the sentence to answer with, or null to pass the request through. A bare
 * key, no key, or this audience's own prefix all pass — the function behind decides those.
 */
export function wrongDoorRefusal(
  path: McpAudiencePath,
  presented: { token?: string | null; authorization?: string | null },
): string | null {
  const rule = WRONG_DOOR[path]
  const keys = [(presented.token ?? '').trim(), bearerOf(presented.authorization)]
  if (!keys.some((k) => k.startsWith(rule.prefix))) return null
  return `This is a ${rule.holder} key (${rule.prefix}…) and this address is ${path} — connect it to ${rule.belongsAt} instead.`
}
