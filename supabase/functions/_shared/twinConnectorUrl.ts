// The address an MCP client is told to connect to (v2.3633). Shared by the
// twin-setup edge function (TWIN_MCP_PUBLIC_URL) and the client's copy buttons
// (src/lib/bids/desktopKickoff.ts), so both read a public address the same way.
//
// Two shapes of input:
//   - a bare origin ("https://<ref>.supabase.co", trailing slash or not) is a
//     Supabase project URL: the function door is appended.
//   - anything with a path ("https://mcp.clicktooling.com/twin") is already the
//     connector's address and is taken verbatim, less a trailing slash.
// Pure: no env reads, no network.

const FUNCTION_PATH = '/functions/v1/twin-mcp'

export function twinMcpConnectorUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, '')
  let path = ''
  try {
    path = new URL(trimmed).pathname.replace(/\/+$/, '')
  } catch {
    // Not a parseable URL: keep the historical behaviour rather than guess.
    return `${trimmed}${FUNCTION_PATH}`
  }
  return path ? trimmed : `${trimmed}${FUNCTION_PATH}`
}

/**
 * Is this an address a twin-mcp client may be pointed at? Either shape twinMcpConnectorUrl
 * produces: the function door (`…/functions/v1/twin-mcp`) or a public audience path whose last
 * segment is `twin` (`https://mcp.clicktooling.com/twin`, or `/count/twin` should CountTooling get
 * its own — the naming scheme in to-dos/mcp-servers.md). https only; nothing a shell or JSON
 * quote could break on. The setup commands refuse anything else rather than write it into a
 * Claude Desktop config (v2.3716 — the check predated the public address and rejected it).
 */
export function isTwinMcpConnectorUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!/^https:\/\/[^\s"'\\]+$/.test(trimmed)) return false
  let path = ''
  try {
    path = new URL(trimmed).pathname.replace(/\/+$/, '')
  } catch {
    return false
  }
  return path === FUNCTION_PATH || path.split('/').pop() === 'twin'
}
