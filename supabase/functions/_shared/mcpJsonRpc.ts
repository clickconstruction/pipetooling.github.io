// A minimal, dependency-free MCP server shell over streamable HTTP (v2.3640): stateless
// JSON-RPC POST, GET → 405, no SSE — the same wire behaviour twin-mcp has had since
// v2.2431, lifted out so a second server (dev-mcp) does not copy it. twin-mcp still
// carries its own copy; it adopts this one when it is decomposed (to-dos/mcp-servers.md).

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

export type McpTool = { name: string; description: string; inputSchema: Record<string, unknown> }
export type McpToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

export function mcpText(text: string, isError = false): McpToolResult {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] }
}

export type McpServerOptions = {
  name: string
  version: string
  instructions: string
  tools: McpTool[]
  /** Extra request headers the server reads (lower-case), for the CORS allow list. */
  authHeaders: string[]
  callTool: (req: Request, name: string, args: Record<string, unknown>) => Promise<McpToolResult>
}

type RpcMessage = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }

export function mcpHandler(opts: McpServerOptions): (req: Request) => Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': ['authorization', 'x-client-info', 'apikey', 'content-type', 'mcp-session-id', 'mcp-protocol-version', ...opts.authHeaders].join(', '),
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const result = (id: unknown, value: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result: value })
  const error = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

  async function handle(req: Request, msg: RpcMessage) {
    const { id, method, params } = msg
    switch (method) {
      case 'initialize': {
        const requested = (params?.protocolVersion as string) ?? MCP_PROTOCOL_VERSIONS[0]
        return result(id, {
          protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: opts.name, version: opts.version },
          instructions: opts.instructions,
        })
      }
      case 'ping':
        return result(id, {})
      case 'tools/list':
        return result(id, { tools: opts.tools })
      case 'tools/call': {
        const name = String(params?.name ?? '')
        const args = (params?.arguments as Record<string, unknown>) ?? {}
        try {
          return result(id, await opts.callTool(req, name, args))
        } catch (e) {
          return result(id, mcpText(`Tool error: ${String(e)}`, true))
        }
      }
      default:
        if (method?.startsWith('notifications/')) return null // notifications get no response
        return error(id, -32601, `Method not found: ${method}`)
    }
  }

  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (req.method === 'GET') return new Response(`${opts.name}: MCP streamable-HTTP endpoint. POST JSON-RPC here.`, { status: 405, headers: cors })
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json(error(null, -32700, 'Parse error'), 400)
    }
    if (Array.isArray(body)) {
      const responses = []
      for (const msg of body) {
        const r = await handle(req, msg as RpcMessage)
        if (r) responses.push(r)
      }
      return responses.length > 0 ? json(responses) : new Response(null, { status: 202, headers: cors })
    }
    const response = await handle(req, body as RpcMessage)
    return response ? json(response) : new Response(null, { status: 202, headers: cors })
  }
}
