/**
 * legal-notify-dispatch's own handler, run here (v2.4632, punch list #85 item 26): the function's
 * `index.ts` with its URL imports and its mail sender stood in for, over a small in-memory database.
 * It proves the "now" lane stamps each person only on success, retries the rest each tick up to
 * twelve times, never re-sends to someone already sent, mints each person's stop link once, and
 * checks the cron secret. Nothing here reaches a real database or a mail service.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGAL_NOTIFY_MAX_TRIES } from './legalNotifyLedger'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }
const db: { tables: Record<string, Row[]>; writes: string[] } = { tables: {}, writes: [] }
const sent: Array<{ to: string; subject: string; html: string }> = []
const failFor = new Set<string>()
const fake = { ledgerWriteFails: false }

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  const preds: Array<(r: Row) => boolean> = []
  let op: 'select' | 'update' | 'insert' = 'select'
  let patch: Row = {}
  let lim = Infinity
  const rows = () => (db.tables[name] ??= [])
  const run = () => {
    const hit = rows().filter((r) => preds.every((p) => p(r)))
    if (op === 'update') {
      db.writes.push(`update ${name} ${Object.keys(patch).sort().join(',')}`)
      if (fake.ledgerWriteFails && 'sent_to' in patch) return { data: null, error: { message: 'statement timeout' } }
      for (const r of hit) Object.assign(r, structuredClone(patch))
      return { data: null, error: null }
    }
    return { data: structuredClone(hit.slice(0, lim)), error: null, count: hit.length }
  }
  const chain: Chain = {}
  chain.select = () => chain
  chain.eq = (c: unknown, v: unknown) => (preds.push((r) => r[c as string] === v), chain)
  chain.is = (c: unknown, v: unknown) => (preds.push((r) => (r[c as string] ?? null) === v), chain)
  chain.not = (c: unknown, _o: unknown, v: unknown) => (preds.push((r) => (r[c as string] ?? null) !== v), chain)
  chain.in = (c: unknown, v: unknown) => (preds.push((r) => (v as unknown[]).includes(r[c as string])), chain)
  chain.order = () => chain
  chain.limit = (n: unknown) => ((lim = n as number), chain)
  chain.update = (p: unknown) => ((op = 'update'), (patch = p as Row), chain)
  chain.maybeSingle = () => Promise.resolve({ data: (run().data as Row[] | null)?.[0] ?? null, error: null })
  chain.then = (ok: unknown, bad: unknown) => Promise.resolve(run()).then(ok as (v: unknown) => unknown, bad as (e: unknown) => unknown)
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({ from: (name: string) => table(name) }) }))
vi.mock('../../../supabase/functions/_shared/resendSendEmail.ts', () => ({
  sendEmailViaResend: async (to: string, subject: string, _text: string, html: string) => {
    sent.push({ to, subject, html })
    return failFor.has(to) ? { success: false, error: 'The to address is invalid' } : { success: true, resendEmailId: 'r' }
  },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', CRON_SECRET: 'cron-secret-123', RESEND_API_KEY: 're_test', APP_ORIGIN: 'https://app.test' }
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/legal-notify-dispatch/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})

const person = (id: string, email: string): Row => ({ id, firm_id: 'f1', name: id, email, mode: 'now', scope: 'all', digest_weekday: 1, digest_time: '07:00', confirmed_at: '2026-10-01T00:00:00Z', paused_at: null, removed_at: null, last_digest_at: null, unsubscribe_token_hash: null, unsubscribe_salt: null, send_failed_since: null, send_error: null })
const event = (id: string, extra: Row = {}): Row => ({ id, firm_id: 'f1', matter_id: 'm1', trigger: 'referred', payload: { payer: 'Sample Contracting' }, created_at: '2026-10-05T15:00:00Z', sent_now_at: null, digested_at: null, sent_to: {}, ...extra })

beforeEach(() => {
  sent.length = 0
  failFor.clear()
  fake.ledgerWriteFails = false
  db.writes = []
  db.tables = {
    legal_firms: [{ id: 'f1', name: 'Sample & Partner', paused_at: null, active: true }],
    legal_firm_recipients: [person('ann', 'ann@firm.test'), person('bo', 'bo@firm.test')],
    legal_portal_links: [{ firm_id: 'f1', token: 'portal-token', revoked_at: null }],
    legal_matters: [{ id: 'm1', firm_id: 'f1', payer_name: 'Sample Contracting', stage: 'referred', handling_name: 'ann', released_at: null }],
    legal_notification_queue: [event('e1')],
  }
})

const tick = async (secret: string = ENV.CRON_SECRET ?? '') => {
  const res = await box.handler!(new Request('http://localhost/functions/v1/legal-notify-dispatch', { method: 'POST', headers: { 'X-Cron-Secret': secret } }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const T = (name: string): Row[] => (db.tables[name] ??= [])
const q = (id: string) => T('legal_notification_queue').find((r) => r.id === id)!
const rec = (id: string) => T('legal_firm_recipients').find((r) => r.id === id)!
const stopLink = (html: string) => /\/legal\/confirm\?t=([0-9a-f]+)&stop=1/.exec(html)?.[1] ?? null

describe('legal-notify-dispatch · the now lane per person (v2.4632)', () => {
  it('stamps the event only when everyone is sent; a failing person is retried and never re-sends to the rest', async () => {
    failFor.add('bo@firm.test')
    expect((await tick()).body).toMatchObject({ ok: true, now: 1, retrying: 1, gaveUp: 0 })
    expect(sent.map((s) => s.to)).toEqual(['ann@firm.test', 'bo@firm.test'])
    expect(q('e1').sent_now_at).toBeNull()
    expect(q('e1').sent_to).toMatchObject({ ann: { tries: 1 }, bo: { tries: 1, error: 'The to address is invalid' } })
    expect(rec('bo').send_failed_since).toEqual(expect.any(String))
    expect(rec('bo').send_error).toBe('The to address is invalid')
    expect(rec('ann').send_failed_since).toBeNull()

    const firstFailure = rec('bo').send_failed_since
    sent.length = 0
    await tick()
    expect(sent.map((s) => s.to)).toEqual(['bo@firm.test'])
    expect(rec('bo').send_failed_since).toBe(firstFailure)

    failFor.clear()
    sent.length = 0
    expect((await tick()).body).toMatchObject({ now: 1, retrying: 0 })
    expect(sent.map((s) => s.to)).toEqual(['bo@firm.test'])
    expect(q('e1').sent_now_at).toEqual(expect.any(String))
    expect(rec('bo').send_failed_since).toBeNull()
    expect(rec('bo').send_error).toBeNull()
  })

  it(`gives up on a person after ${LEGAL_NOTIFY_MAX_TRIES} tries and then stamps the event`, async () => {
    failFor.add('bo@firm.test')
    for (let i = 0; i < LEGAL_NOTIFY_MAX_TRIES - 1; i++) await tick()
    expect(q('e1').sent_now_at).toBeNull()
    expect((await tick()).body).toMatchObject({ gaveUp: 1 })
    expect(q('e1').sent_now_at).toEqual(expect.any(String))
    expect(sent.filter((s) => s.to === 'bo@firm.test')).toHaveLength(LEGAL_NOTIFY_MAX_TRIES)
    expect(sent.filter((s) => s.to === 'ann@firm.test')).toHaveLength(1)
    expect(rec('bo').send_failed_since).toEqual(expect.any(String))
  })

  it('a person who confirms after the event is not sent it; one who stops meanwhile is skipped', async () => {
    failFor.add('bo@firm.test')
    await tick()
    T('legal_firm_recipients').push(person('cy', 'cy@firm.test'))
    rec('bo').paused_at = '2026-10-05T16:00:00Z'
    sent.length = 0
    await tick()
    expect(sent).toEqual([])
    expect(q('e1').sent_to).toMatchObject({ bo: { skipped: expect.any(String) } })
    expect(q('e1').sent_to).not.toHaveProperty('cy')
    expect(q('e1').sent_now_at).toEqual(expect.any(String))
  })

  it('mints each person’s stop link once: the same link in every email, the hash written once', async () => {
    await tick()
    T('legal_notification_queue').push(event('e2', { trigger: 'pulled' }))
    await tick()
    const annLinks = sent.filter((s) => s.to === 'ann@firm.test').map((s) => stopLink(s.html))
    expect(annLinks).toHaveLength(2)
    expect(annLinks[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(annLinks[1]).toBe(annLinks[0])
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(annLinks[0]!))), (b) => b.toString(16).padStart(2, '0')).join('')
    expect(rec('ann').unsubscribe_token_hash).toBe(hash)
    expect(db.writes.filter((w) => w === 'update legal_firm_recipients unsubscribe_token_hash,updated_at')).toHaveLength(2) // ann and bo, once each
  })

  it('a queue without the per-person column (a deploy ahead of the migration) stamps after one pass, as before', async () => {
    failFor.add('bo@firm.test')
    db.tables.legal_notification_queue = [event('e1')]
    delete T('legal_notification_queue')[0]!.sent_to
    await tick()
    expect(q('e1').sent_now_at).toEqual(expect.any(String))
    sent.length = 0
    await tick()
    expect(sent).toEqual([])
  })

  it('a ledger that cannot be written falls back to stamping after one pass, never re-sending each tick', async () => {
    failFor.add('bo@firm.test')
    fake.ledgerWriteFails = true
    await tick()
    expect(q('e1').sent_now_at).toEqual(expect.any(String))
    sent.length = 0
    await tick()
    expect(sent).toEqual([])
  })

  it('refuses a wrong cron secret, of the same length or not', async () => {
    expect((await tick('cron-secret-124')).status).toBe(401)
    expect((await tick('x')).status).toBe(401)
    expect((await tick('')).status).toBe(401)
    expect(sent).toEqual([])
  })
})
