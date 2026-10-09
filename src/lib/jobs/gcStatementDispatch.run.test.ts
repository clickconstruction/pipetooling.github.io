/**
 * gc-statement-email-dispatch's own handler, run here (v2.5022; the owner's call of 2026-10-09): a GC's
 * scheduled statement goes only on this week's standing check. Its `index.ts` with the URL imports
 * stood in for, the fake database from `src/test/edgeFakeDb.ts` with each GC's payload answered by
 * entity, and `fetch` caught, so no mail leaves. Five queued sends: a GC checked this week, one never
 * checked, one checked before a bill landed, one that owes only in Collections, and one whose check
 * cannot be read.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, fakeTable, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { gcCertWeekStartYmd } from '../../../supabase/functions/_shared/gcStatementGate'
import { todayYmdInAppTz } from '../../../supabase/functions/_shared/appTimeZone'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb; payloads: Record<string, unknown>; certsFail: boolean } = { handler: null, db: makeFakeDb(), payloads: {}, certsFail: false }
const mail: string[][] = []
const bodies: string[] = []

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => {
    const client = fakeClient(box.db, {}, () => null)
    return {
      ...client,
      // The payload by entity; the week's checks can be made to fail.
      rpc: async (name: string, args: { p_entity_id?: string }) => {
        box.db.calls.push(`rpc ${name}`)
        return { data: box.payloads[args.p_entity_id ?? ''] ?? null, error: null }
      },
      from: (name: string) => {
        if (name === 'gc_review_certifications' && box.certsFail) {
          const chain = fakeTable(box.db, name)
          chain.then = ((resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'timeout' } }).then(resolve)) as never
          return chain
        }
        return fakeTable(box.db, name)
      },
    }
  },
}))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  RESEND_API_KEY: 're_test',
  CRON_SECRET: 'cron-secret',
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/gc-statement-email-dispatch/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  // Resend: record the recipients and answer like Resend. The email wording, the send log and the
  // sent copy (Supabase REST and Storage): answer "not ok", which each treats as nothing to read or keep.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const sentMail = JSON.parse(String(init?.body)) as { to: string[]; html: string }
      mail.push(sentMail.to)
      bodies.push(sentMail.html)
      return new Response(JSON.stringify({ id: `mail-${mail.length}` }), { status: 200 })
    }
    return new Response('{}', { status: 503 })
  }) as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})

const row = (job: string, bill: string, remaining: number, inCollections = false) => ({
  job_id: job,
  row_key: bill,
  display_number: '651',
  job_name: 'Job',
  job_address: `${job} Main St`,
  customer_name: 'Owner',
  ref_date: '2026-09-01',
  ref_is_estimate: false,
  age_days: 38,
  remaining,
  in_collections: inCollections,
})
const payloadFor = (gcId: string, name: string, rows: ReturnType<typeof row>[]) => ({
  generated_at: '2026-10-09T15:00:00Z',
  group_by: 'gc',
  include_collections: rows.some((r) => r.in_collections),
  grand_total: rows.reduce((t, r) => t + r.remaining, 0),
  groups: [{ entity_id: gcId, entity_name: name, is_no_entity: false, job_count: new Set(rows.map((r) => r.job_id)).size, subtotal: rows.reduce((t, r) => t + r.remaining, 0), oldest_age_days: 38, rows }],
})
const queued = (id: string, gcId: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  requested_by: 'u-office',
  sent_to: `ap@${id}.example`,
  group_by: 'gc',
  gc_customer_id: gcId,
  development_id: null,
  entity_name: name,
  include_collections: false,
  send_at: '2026-10-08T12:00:00Z',
  repeat_weekly: false,
  attempts: 0,
  cc_emails: null,
  sent_at: null,
  error: null,
  ...over,
})

beforeEach(() => {
  mail.length = 0
  bodies.length = 0
  box.certsFail = false
  box.db = makeFakeDb()
  const week = gcCertWeekStartYmd(todayYmdInAppTz())
  const check = (gcId: string, jobId: string, remaining: number) => ({
    gc_customer_id: gcId,
    week_start: week,
    certified_at: `${week}T18:00:00Z`,
    total: remaining,
    snapshot: { rows: [{ key: jobId, jobId, remaining }], total: remaining, jobCount: 1 },
  })
  box.db.tables.users = [{ id: 'u-office', name: 'Taunya', email: 'taunya@example.com' }]
  box.db.tables.gc_review_certifications = [
    check('gc-knight', 'j-knight', 26000),
    // Checked at $250; a second $250 bill landed after.
    check('gc-done-right', 'j-sheppard', 250),
    // Last week's check does not count this week.
    { ...check('gc-harper', 'j-harper', 30000), week_start: gcCertWeekStartYmd(new Date(Date.parse(`${week}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)) },
  ]
  box.payloads = {
    'gc-knight': payloadFor('gc-knight', 'Knight Contracting', [row('j-knight', 'b-knight', 26000)]),
    'gc-harper': payloadFor('gc-harper', 'TF Harper', [row('j-harper', 'b-harper', 30000)]),
    'gc-done-right': payloadFor('gc-done-right', 'Done Right Foundation', [row('j-sheppard', 'b-sheppard', 250), row('j-mccluskey', 'b-mccluskey', 250)]),
    'gc-oldco': payloadFor('gc-oldco', 'Oldco Builders', [row('j-oldco', 'b-oldco', 5000, true)]),
  }
  box.db.tables.gc_statement_email_requests = [
    queued('q-knight', 'gc-knight', 'Knight Contracting'),
    queued('q-harper', 'gc-harper', 'TF Harper', { repeat_weekly: true }),
    queued('q-done-right', 'gc-done-right', 'Done Right Foundation'),
    queued('q-oldco', 'gc-oldco', 'Oldco Builders', { include_collections: true }),
  ]
})

async function runCron() {
  const res = await box.handler!(
    new Request('http://localhost/functions/v1/gc-statement-email-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': 'cron-secret' },
      body: '{}',
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const stamped = (id: string) => box.db.writes.filter((w) => w.op === 'update' && w.table === 'gc_statement_email_requests' && w.matched.some((r) => r.id === id)).map((w) => w.values)

describe('gc-statement-email-dispatch holds a GC’s statement until it is checked (v2.5022)', () => {
  it('sends the checked GC and the one that owes only in Collections; refuses the rest with the words and why', async () => {
    expect(await runCron()).toEqual({ status: 200, body: { ok: true, processed: 4, sent: 2, skipped: 0, duplicates: 0, refused: 2, errors: [] } })
    expect(mail).toEqual([['ap@q-knight.example'], ['ap@q-oldco.example']])
    expect(stamped('q-knight')).toEqual([expect.objectContaining({ error: null })])
    expect(stamped('q-harper')).toEqual([expect.objectContaining({ error: 'refused: Check the bills first — a statement never goes out unchecked (not checked this week)' })])
    expect(stamped('q-harper')[0]!.sent_at).toEqual(expect.any(String))
    expect(stamped('q-done-right')).toEqual([expect.objectContaining({ error: 'refused: Check the bills first — a statement never goes out unchecked (changed since it was checked)' })])
    // Nothing went out for the refused two: no audit row, no send-log row.
    const audited = box.db.writes.filter((w) => w.op === 'insert' && w.table === 'gc_statement_emails').map((w) => w.values.gc_customer_id)
    expect(audited).toEqual(['gc-knight', 'gc-oldco'])
  })

  it('a refused weekly send still books next week, when the check is asked for again', async () => {
    await runCron()
    const booked = box.db.writes.filter((w) => w.op === 'insert' && w.table === 'gc_statement_email_requests').map((w) => w.values)
    expect(booked).toEqual([expect.objectContaining({ gc_customer_id: 'gc-harper', send_at: '2026-10-15T12:00:00.000Z', repeat_weekly: true })])
  })

  it('the whole report by GC leaves out the GCs not checked, names them at the top, and the checked ones still go', async () => {
    const harper = payloadFor('gc-harper', 'TF Harper', [row('j-harper', 'b-harper', 30000)]).groups[0]!
    const knight = payloadFor('gc-knight', 'Knight Contracting', [row('j-knight', 'b-knight', 26000)]).groups[0]!
    const noGc = { ...payloadFor('', 'Not billed to a GC', [row('j-none', 'b-none', 250)]).groups[0]!, entity_id: null, is_no_entity: true }
    box.payloads[''] = { generated_at: '2026-10-09T15:00:00Z', group_by: 'gc', include_collections: false, grand_total: 56250, groups: [harper, knight, noGc] }
    box.db.tables.gc_statement_email_requests = [queued('q-all', null as never, 'All GCs', { gc_customer_id: null })]
    expect((await runCron()).body).toMatchObject({ processed: 1, sent: 1, refused: 0, errors: [] })
    expect(bodies[0]).toContain('Held, not checked this week: TF Harper')
    expect(bodies[0]).toContain('>Knight Contracting <span')
    expect(bodies[0]).not.toContain('>TF Harper <span')
    const audit = box.db.writes.find((w) => w.op === 'insert' && w.table === 'gc_statement_emails')!.values
    expect(audit).toMatchObject({ group_by: 'all', gc_name: 'All GCs', total: 26250, job_count: 2 })
  })

  it('a check that cannot be read fails the attempt: nothing sent, the row tried again', async () => {
    box.certsFail = true
    box.db.tables.gc_statement_email_requests = [queued('q-knight', 'gc-knight', 'Knight Contracting')]
    const { body } = await runCron()
    expect(body).toMatchObject({ sent: 0, refused: 0, errors: ['q-knight: gc_review_certifications: timeout'] })
    expect(mail).toEqual([])
    expect(stamped('q-knight')).toEqual([{ error: 'gc_review_certifications: timeout', attempts: 1 }])
  })
})
