import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — the deployed Worker is one plain JS file with no types
import worker from '../../scripts/cloudflare/mcp-router.worker.js'
import { MCP_TOKEN_HEADER, wrongDoorRefusal, type McpAudiencePath } from './mcpKeyPrefixes'

/**
 * scripts/cloudflare/mcp-router.worker.js deploys as a single file, so it carries its own copy
 * of the wrong-door rule. These run the Worker itself against a stubbed upstream: the refusal
 * happens before the fetch, and its sentence is the kernel's.
 */
const route = worker as { fetch: (req: Request) => Promise<Response> }

function post(path: string, headers: Record<string, string>): Request {
  return new Request(`https://mcp.clicktooling.com${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' })
}

function stubUpstream() {
  const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', upstream)
  return upstream
}

afterEach(() => vi.unstubAllGlobals())

describe('mcp-router Worker — the wrong-door refusal', () => {
  const cases: { path: McpAudiencePath; key: string }[] = [
    { path: '/twin', key: 'ptd_ab12' },
    { path: '/dev', key: 'ptt_ab12' },
  ]

  for (const { path, key } of cases) {
    it(`refuses ${key.slice(0, 4)} at ${path} before the fetch, in the kernel’s words`, async () => {
      const upstream = stubUpstream()
      for (const headers of [{ [MCP_TOKEN_HEADER[path]]: key }, { authorization: `Bearer ${key}` }]) {
        const res = await route.fetch(post(path, headers))
        expect(res.status).toBe(401)
        expect(await res.text()).toBe(wrongDoorRefusal(path, { token: key }))
      }
      expect(upstream).not.toHaveBeenCalled()
    })
  }

  it('passes a bare key, a prefixed key at its own door, and no key through to the function', async () => {
    const upstream = stubUpstream()
    const bare = 'ab'.repeat(32)
    const passes: [string, Record<string, string>][] = [
      ['/twin', { 'x-twin-token': bare }],
      ['/twin', { 'x-twin-token': 'ptt_ab12' }],
      ['/twin/', { authorization: 'Bearer ptt_ab12' }],
      ['/dev', { 'x-dev-token': 'ptd_ab12' }],
      ['/dev', {}],
    ]
    for (const [path, headers] of passes) {
      const res = await route.fetch(post(path, headers))
      expect(res.status).toBe(200)
    }
    expect(upstream).toHaveBeenCalledTimes(passes.length)
    expect(String(upstream.mock.calls[0]?.[0])).toMatch(/\/functions\/v1\/twin-mcp$/)
    expect(String(upstream.mock.calls[3]?.[0])).toMatch(/\/functions\/v1\/dev-mcp$/)
  })

  it('still answers 404 off the route map, without a fetch', async () => {
    const upstream = stubUpstream()
    expect((await route.fetch(post('/nope', { 'x-twin-token': 'ptd_ab12' }))).status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })
})
