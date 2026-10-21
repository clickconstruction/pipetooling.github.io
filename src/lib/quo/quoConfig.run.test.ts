/**
 * quo-config's own handler, run here (v2.5718, the Quo connection in Settings): the owner or a dev only; `set` keeps
 * the key in Vault with the caller's name and answers the status, never the key; `status` names where the key comes
 * from, Vault before the environment; `directory` reads Quo's numbers and people, every page, with the versioned
 * header, and says in words when Quo refuses. The Quo behind `fetch` is a fake; the keys are made up.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDb } from '../mail/mailRunFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db = new FakeDb()
const auth = { user: { id: 'u-robert', email: 'robert@plumbing.example' } as { id: string; email?: string } | null }
const vault: { key?: string; by?: string } = {}
const quo = { calls: [] as Array<{ url: string; headers: Record<string, string> }>, answers: {} as Record<string, Array<{ status?: number; body: unknown }>> }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: auth.user }, error: auth.user ? null : { message: 'no' } }) },
    from: (name: string) => db.from(name),
    rpc: (fn: string, args: Record<string, unknown> = {}) => db.rpc(fn, args),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }
const FUNCTION_FILE = '../../../supabase/functions/quo-config/index.ts'
const realFetch = globalThis.fetch
const KEY = 'made-up-quo-key-for-the-run-test'

/** A fake Quo: each path's answers in order, the last one repeated. */
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input)
  const headers = (init?.headers ?? {}) as Record<string, string>
  quo.calls.push({ url, headers })
  const path = new URL(url).pathname
  const list = quo.answers[path] ?? [{ status: 404, body: { title: 'Not Found' } }]
  const call = quo.calls.filter((c) => new URL(c.url).pathname === path).length - 1
  const a = list[Math.min(call, list.length - 1)]!
  return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { 'Content-Type': 'application/json' } })
}

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})
beforeEach(() => {
  db.tables = { users: [{ id: 'u-robert', name: 'Robert Douglas', role: 'master_technician', read_only: false, is_sample: false, is_digital_twin: false }] }
  db.rpcCalls = []
  delete vault.key
  delete vault.by
  delete ENV.QUO_API_KEY
  quo.calls = []
  quo.answers = {}
  db.rpcAnswers = {
    quo_secret_get: () => vault.key ?? null,
    quo_secret_status: () => (vault.key ? { set: true, saved_at: '2026-10-21T19:30:00+00:00', saved_by: vault.by ?? null } : { set: false, saved_at: null, saved_by: null }),
    quo_secret_set: (a) => {
      const v = String(a.p_value ?? '')
      if (!v) {
        delete vault.key
        delete vault.by
        return false
      }
      vault.key = v
      vault.by = String(a.p_saved_by ?? '')
      return true
    },
  }
  auth.user = { id: 'u-robert', email: 'robert@plumbing.example' }
})

function post(body: unknown): Promise<Response> {
  return box.handler!(new Request('http://fn/quo-config', { method: 'POST', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

describe('quo-config (v2.5718)', () => {
  it('the owner or a dev only, a real account, not read-only', async () => {
    expect((await post({ action: 'status' })).status).toBe(200)
    db.tables.users = [{ id: 'u-robert', role: 'dev', read_only: false, is_sample: false, is_digital_twin: false }]
    expect((await post({ action: 'status' })).status).toBe(200)
    db.tables.users = [{ id: 'u-robert', role: 'assistant', read_only: false, is_sample: false, is_digital_twin: false }]
    expect((await post({ action: 'status' })).status).toBe(403)
    db.tables.users = [{ id: 'u-robert', role: 'master_technician', read_only: true, is_sample: false, is_digital_twin: false }]
    expect((await post({ action: 'status' })).status).toBe(403)
    db.tables.users = [{ id: 'u-robert', role: 'dev', read_only: false, is_sample: false, is_digital_twin: true }]
    expect((await post({ action: 'status' })).status).toBe(403)
    auth.user = null
    expect((await post({ action: 'status' })).status).toBe(401)
  })

  it('status: no key, the environment’s key, then Vault’s with when and by whom; never the key itself', async () => {
    expect(await (await post({ action: 'status' })).json()).toEqual({ ok: true, set: false, source: 'none', last4: null, saved_at: null, saved_by: null })
    ENV.QUO_API_KEY = 'env-key-0000-1111-2222'
    expect(await (await post({ action: 'status' })).json()).toEqual({ ok: true, set: true, source: 'env', last4: null, saved_at: null, saved_by: null })
    vault.key = KEY
    vault.by = 'Robert Douglas'
    const out = await (await post({ action: 'status' })).json()
    expect(out).toEqual({ ok: true, set: true, source: 'vault', last4: 'test', saved_at: '2026-10-21T19:30:00+00:00', saved_by: 'Robert Douglas' })
    expect(JSON.stringify(out)).not.toContain(KEY)
  })

  it('set: the key into Vault with the caller’s name, a bad shape refused, a blank forgets', async () => {
    expect((await post({ action: 'set' })).status).toBe(400)
    const bad = await post({ action: 'set', key: 'has a space in it' })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toBe('That does not look like a Quo key. Paste it again with no spaces.')
    expect(vault.key).toBeUndefined()
    const res = await post({ action: 'set', key: ` ${KEY} ` })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, set: true, source: 'vault', last4: 'test', saved_by: 'Robert Douglas' })
    expect(vault).toEqual({ key: KEY, by: 'Robert Douglas' })
    expect(db.rpcCalls.find((c) => c.fn === 'quo_secret_set')?.args).toEqual({ p_value: KEY, p_saved_by: 'Robert Douglas' })
    const forget = await post({ action: 'set', key: '' })
    expect(await forget.json()).toMatchObject({ ok: true, set: false, source: 'none' })
    expect(vault.key).toBeUndefined()
  })

  it('directory: 409 without a key; else Quo’s numbers and people, every page, with the versioned header', async () => {
    const none = await post({ action: 'directory' })
    expect(none.status).toBe(409)
    expect((await none.json()).error).toBe('No Quo key yet. Paste the key first.')
    vault.key = KEY
    quo.answers = {
      '/phone-numbers': [
        { body: { data: [{ id: 'PNteam01', name: 'Team line', symbol: '🏡', phoneNumber: '+15125550144' }], nextCursor: 'page2' } },
        { body: { data: [{ id: 'PNbids02', name: 'Bids', phoneNumber: '+15125550199' }], nextCursor: null } },
      ],
      '/users': [{ body: { data: [{ id: 'USrosa2', firstName: 'Rosa', lastName: 'Diaz', email: 'rosa@plumbing.example', role: 'member' }], nextCursor: null } }],
    }
    const res = await post({ action: 'directory' })
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.numbers.map((n: { id: string }) => n.id)).toEqual(['PNteam01', 'PNbids02'])
    expect(out.members.map((m: { id: string }) => m.id)).toEqual(['USrosa2'])
    expect(out).toMatchObject({ ok: true, set: true, source: 'vault', last4: 'test' })
    expect(quo.calls.map((c) => c.url)).toEqual(['https://api.quo.com/phone-numbers?limit=50', 'https://api.quo.com/phone-numbers?limit=50&after=page2', 'https://api.quo.com/users?limit=50'])
    for (const c of quo.calls) expect(c.headers).toEqual({ Authorization: KEY, 'Quo-Api-Version': '2026-03-30' })
  })

  it('directory: Quo’s refusal in words, 502', async () => {
    ENV.QUO_API_KEY = 'env-key-0000-1111-2222'
    quo.answers = { '/phone-numbers': [{ status: 401, body: { title: 'Unauthorized', message: 'Invalid API key' } }] }
    const res = await post({ action: 'directory' })
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ ok: false, set: true, source: 'env', error: 'Quo did not give its numbers (401: Unauthorized, Invalid API key).' })
    expect(quo.calls).toHaveLength(1)
  })
})
