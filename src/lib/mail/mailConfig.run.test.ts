/**
 * mail-config's own handler, run here (the Docsmit train, PR 9): dev only; `set` writes each given value
 * into Vault through the service-role function and answers the status; `status` never carries a hash or
 * a software id; `ping` reads the account with what is set, Vault before the environment.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDb, FakeDocsmit, FakeStorage, routeFetch } from './mailRunFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db = new FakeDb()
const docsmit = new FakeDocsmit()
const storage = new FakeStorage()
const auth = { user: { id: 'u-robert' } as { id: string } | null }
const vault: Record<string, string> = {}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: auth.user }, error: auth.user ? null : { message: 'no' } }) },
    from: (name: string) => db.from(name),
    rpc: (fn: string, args: Record<string, unknown>) => db.rpc(fn, args),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', DOCSMIT_SOFTWARE_ID: 'env-soft' }
const FUNCTION_FILE = '../../../supabase/functions/mail-config/index.ts'
const realFetch = globalThis.fetch
const HASH = 'a'.repeat(128)

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = routeFetch(docsmit, storage)
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})
beforeEach(() => {
  db.tables = { users: [{ id: 'u-robert', role: 'dev', read_only: false }] }
  db.rpcCalls = []
  for (const k of Object.keys(vault)) delete vault[k]
  db.rpcAnswers = {
    mail_secret_get: (a) => vault[String(a.p_name)] ?? null,
    mail_secret_set: (a) => {
      const v = String(a.p_value ?? '')
      if (!v) { delete vault[String(a.p_name)]; return false }
      vault[String(a.p_name)] = v
      return true
    },
  }
  docsmit.calls = []
  docsmit.answers = {}
  auth.user = { id: 'u-robert' }
})

function post(body: unknown): Promise<Response> {
  return box.handler!(new Request('http://fn/mail-config', { method: 'POST', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

describe('mail-config (the Docsmit train, PR 9)', () => {
  it('developers only', async () => {
    db.tables.users = [{ id: 'u-robert', role: 'assistant', read_only: false }]
    expect((await post({ action: 'status' })).status).toBe(403)
    auth.user = null
    expect((await post({ action: 'status' })).status).toBe(401)
  })

  it('status: what is set and where from, the email and the base URL, never a hash or a software id', async () => {
    vault.docsmit_email = 'bids@clickplumbing.com'
    const res = await post({ action: 'status' })
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toEqual({ ok: true, ready: false, email: null, base_url: null, env: null, set: { DOCSMIT_EMAIL: true, DOCSMIT_PASSWORD_SHA512: false, DOCSMIT_SOFTWARE_ID: true, DOCSMIT_BASE_URL: false }, source: { DOCSMIT_EMAIL: 'vault', DOCSMIT_PASSWORD_SHA512: 'none', DOCSMIT_SOFTWARE_ID: 'env', DOCSMIT_BASE_URL: 'none' } })
    expect(JSON.stringify(out)).not.toContain('env-soft')
  })

  it('set: each given value into Vault, a bad shape refused, a blank forgets; then ready, with Tracksmit by default', async () => {
    const bad = await post({ action: 'set', password_sha512: 'not-a-hash' })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toMatch(/SHA-512/)
    const res = await post({ action: 'set', email: 'bids@clickplumbing.com', password_sha512: HASH.toUpperCase(), software_id: 'soft-9' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, ready: true, email: 'bids@clickplumbing.com', base_url: 'https://secure.tracksmit.com/api/v1', env: 'tracksmit', set: { DOCSMIT_PASSWORD_SHA512: true, DOCSMIT_SOFTWARE_ID: true } })
    expect(vault).toEqual({ docsmit_email: 'bids@clickplumbing.com', docsmit_password_sha512: HASH, docsmit_software_id: 'soft-9' })
    const forget = await post({ action: 'set', software_id: '' })
    expect((await forget.json()).source.DOCSMIT_SOFTWARE_ID).toBe('env')
    expect(vault.docsmit_software_id).toBeUndefined()
    expect((await post({ action: 'set' })).status).toBe(400)
    expect((await post({ action: 'set', base_url: 'https://evil.example/api' })).status).toBe(400)
  })

  it('ping: 409 until set up; then one token and the account, from Vault before the environment', async () => {
    expect((await post({ action: 'ping' })).status).toBe(409)
    vault.docsmit_email = 'bids@clickplumbing.com'
    vault.docsmit_password_sha512 = HASH
    vault.docsmit_base_url = 'https://secure.docsmit.com/api/v1'
    docsmit.answers['GET /account/info'] = { body: { organization: 'Click Plumbing', creditBalance: 88 } }
    const res = await post({ action: 'ping' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, env: 'prod', account: { name: 'Click Plumbing', credit_balance: 88 } })
    expect(docsmit.calls[0]).toMatchObject({ path: '/token', body: { email: 'bids@clickplumbing.com', password: HASH, softwareID: 'env-soft' } })
  })
})
