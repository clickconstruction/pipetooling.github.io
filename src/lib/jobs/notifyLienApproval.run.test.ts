/**
 * notify-lien-approval's own handler, run here (v2.7445): the function's `index.ts` with its URL imports stood in for,
 * a fake database, and the three senders (the push through a person's hours, the device sender, the email) replaced
 * by recorders. Nothing here reaches a database, a phone or an inbox.
 *
 * What it holds: a notice's ask is the office's, whoever first saved the draft. Before, the function answered 403
 * *Not your draft* to anyone but `drafted_by`, so a second office person's send for approval and every Remind told
 * the leader nothing. The other kinds keep the checks that prove whose record or screen it is.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
type Push = { userIds: string[]; title: string; body: string; url: string; tag: string; templateType: string }

const box: { handler: Handler | null } = { handler: null }
const world = vi.hoisted(() => ({
  /** `op table`, in order: what the function read and wrote. */
  calls: [] as string[],
  callerId: 'u-wendi' as string | null,
  users: [] as Array<Record<string, unknown>>,
  items: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  customers: [] as Array<Record<string, unknown>>,
  history: [] as Array<Record<string, unknown>>,
  pushes: [] as Array<Record<string, unknown>>,
  emails: [] as Array<{ to: string; subject: string; text: string }>,
  /** The leaders whose phone takes the push; anyone else on has no device, so the words go by email. */
  devices: new Set<string>(),
}))

function table(name: string) {
  let op = 'select'
  let inserted: Row | null = null
  const eq: Record<string, unknown> = {}
  const within: Record<string, unknown[]> = {}
  const rows = (): Row[] => {
    const all: Row[] = name === 'users' ? world.users : name === 'job_lien_desk_items' ? world.items : name === 'jobs_ledger' ? world.jobs : name === 'customers' ? world.customers : []
    return all.filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v) && Object.entries(within).every(([k, vs]) => vs.includes(r[k])))
  }
  const settle = (one: boolean) => {
    world.calls.push(`${op} ${name}`)
    if (op === 'insert') {
      if (name === 'notification_history' && inserted) world.history.push(inserted)
      return { data: null, error: null }
    }
    const found = rows()
    return { data: one ? (found[0] ?? null) : found, error: null }
  }
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  chain.select = () => chain
  chain.match = () => chain
  chain.is = () => chain
  chain.eq = (col, v) => ((eq[col as string] = v), chain)
  chain.in = (col, vs) => ((within[col as string] = vs as unknown[]), chain)
  chain.insert = (row) => ((op = 'insert'), (inserted = row as Row), chain)
  chain.maybeSingle = () => Promise.resolve(settle(true))
  chain.then = (resolve, reject) => Promise.resolve(settle(false)).then(resolve as (v: unknown) => unknown, reject as (e: unknown) => unknown)
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => (world.callerId ? { data: { user: { id: world.callerId } }, error: null } : { data: { user: null }, error: { message: 'bad token' } }) },
    from: (name: string) => table(name),
  }),
}))
// The three senders, as recorders: a real one would buzz a phone or send an email.
vi.mock('../../../supabase/functions/_shared/pushHoursSend.ts', () => ({
  sendPushHonouringHours: async (_admin: unknown, push: Push) => {
    world.pushes.push(push)
    const sent = push.userIds.filter((id) => world.devices.has(id))
    return { sent, noDevice: push.userIds.filter((id) => !world.devices.has(id)), held: [], devices: sent.length }
  },
}))
vi.mock('../../../supabase/functions/_shared/webPushSend.ts', () => ({ webPushSender: () => null }))
vi.mock('../../../supabase/functions/_shared/resendSendEmail.ts', () => ({
  sendEmailViaResend: async (to: string, subject: string, text: string) => {
    world.emails.push({ to, subject, text })
    return { success: true }
  },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key', RESEND_API_KEY: 'resend-test-key', APP_ORIGIN: 'http://app.test' }
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/notify-lien-approval/index.ts'

const REAL = { is_sample: false, is_digital_twin: false, is_walk_tester: false, archived_at: null }
const person = (id: string, name: string, role: string, over: Row = {}): Row => ({ id, name, role, email: `${id}@office.test`, ...REAL, ...over })
// Made-up people: Taunya first saved the draft, Wendi is a second office person, Malachi is the job's leader.
const TAUNYA = person('u-taunya', 'Taunya Reed', 'assistant')
const WENDI = person('u-wendi', 'Wendi Park', 'assistant')
const CARLA = person('u-carla', 'Carla Voss', 'controller')
const MALACHI = person('u-malachi', 'Malachi Whites', 'master_technician')
const HELPER = person('u-hank', 'Hank Lowe', 'helpers')
const SUB = person('u-sub', 'Sam Sub', 'subcontractor')

const notice = (over: Row = {}): Row => ({ id: 'it1', job_id: 'j650', kind: 'notice_53_056', status: 'awaiting_approval', voided_at: null, drafted_by: 'u-taunya', fields: { notice: { claimAmount: 27_199 } }, signed_by: null, signed_at: null, signer_signature_mode: null, signed_recorded_by: null, signed_witness_how: null, signed_on_device_of: null, submitted_at: new Date(Date.now() - 40 * 86_400_000).toISOString(), ...over })
const affidavit = (id: string, over: Row = {}): Row => notice({ id, kind: 'affidavit', fields: {}, ...over })

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  world.calls = []
  world.callerId = 'u-wendi'
  world.users = [TAUNYA, WENDI, CARLA, MALACHI, HELPER, SUB]
  world.items = [notice()]
  world.jobs = [{ id: 'j650', job_name: 'Tune 5 Liberty Hill', hcp_number: '650', click_number: null, master_user_id: 'u-malachi', gc_customer_id: 'gc1' }]
  world.customers = [{ id: 'gc1', name: 'Brund & Assoc.' }]
  world.history = []
  world.pushes = []
  world.emails = []
  world.devices = new Set(['u-malachi'])
})

async function post(body: Row, auth = true) {
  const res = await box.handler!(new Request('http://localhost/functions/v1/notify-lien-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-token' } : {}) },
    body: JSON.stringify(body),
  }))
  return { status: res.status, body: (await res.json()) as Row }
}
const nothingSent = () => world.pushes.length === 0 && world.emails.length === 0 && world.history.length === 0

describe('a notice sent for approval: whoever in the office presses (v2.7445)', () => {
  it('an office person who did not draft the notice tells the leader', async () => {
    expect(world.items[0]!.drafted_by).not.toBe(world.callerId)
    const res = await post({ item_id: 'it1', due_ymd: '2026-12-15' })
    expect(res).toEqual({ status: 200, body: { success: true, push_sent: 1, email_sent: false, held: 0, leader_name: 'Malachi Whites' } })
    expect(world.pushes).toHaveLength(1)
    expect(world.pushes[0]).toMatchObject({ userIds: ['u-malachi'], title: 'Approve a lien notice', templateType: 'lien_approval_ask', url: '/lien-desk?tab=notices&job=j650&pile=awaiting' })
    expect(String(world.pushes[0]!.body)).toContain('650 · Tune 5 Liberty Hill · $27,199 owed by Brund & Assoc.')
    expect(world.history).toEqual([expect.objectContaining({ recipient_user_id: 'u-malachi', template_type: 'lien_approval_ask', channel: 'push' })])
  })

  it('every office role may: the controller, the drafter, and the leader for a job that is another leader’s', async () => {
    for (const id of ['u-carla', 'u-taunya']) {
      world.callerId = id
      expect((await post({ item_id: 'it1' })).body).toMatchObject({ success: true, push_sent: 1 })
    }
    expect(world.pushes).toHaveLength(2)
  })

  it('the message names who pressed, never the drafter', async () => {
    world.devices = new Set()
    const res = await post({ item_id: 'it1', due_ymd: '2026-12-15' })
    expect(res.body).toMatchObject({ success: true, push_sent: 0, email_sent: true, leader_name: 'Malachi Whites' })
    expect(world.emails).toHaveLength(1)
    expect(world.emails[0]!.to).toBe('u-malachi@office.test')
    expect(world.emails[0]!.text.split('\n')[0]).toBe('Wendi sent a lien notice for your approval.')
    expect(world.emails[0]!.text).not.toContain('Taunya')
    expect(world.history).toEqual([expect.objectContaining({ channel: 'email' })])
  })

  it('a reminder says so, and goes the same way', async () => {
    world.devices = new Set()
    await post({ item_id: 'it1', remind: true })
    expect(world.emails[0]!.text.split('\n')[0]).toBe('Wendi is reminding you of a lien notice that waits for your approval.')
    world.devices = new Set(['u-malachi'])
    expect((await post({ item_id: 'it1', remind: true })).body).toMatchObject({ success: true, push_sent: 1 })
  })

  it('a caller outside the office is refused before the paper is read, even its drafter', async () => {
    for (const [id, role] of [['u-hank', 'helpers'], ['u-sub', 'subcontractor']] as const) {
      world.callerId = id
      world.items = [notice({ drafted_by: id })]
      world.calls = []
      expect(await post({ item_id: 'it1' }), role).toEqual({ status: 403, body: { error: 'Not the office' } })
      expect(world.calls).not.toContain('select job_lien_desk_items')
    }
    expect(nothingSent()).toBe(true)
  })

  it('an archived office account is refused in the Away note’s words', async () => {
    world.users = [TAUNYA, { ...WENDI, archived_at: '2026-11-01T00:00:00Z' }, MALACHI]
    const res = await post({ item_id: 'it1' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('archived_caller')
    expect(nothingSent()).toBe(true)
  })

  it('a notice that no longer waits for approval answers as before: 200, nothing sent', async () => {
    for (const over of [{ status: 'approved' }, { status: 'drafted' }, { status: 'held' }, { voided_at: '2026-11-10T00:00:00Z' }]) {
      world.items = [notice(over)]
      expect(await post({ item_id: 'it1' })).toEqual({ status: 200, body: { success: true, push_sent: 0, email_sent: false, message: 'Not awaiting approval' } })
    }
    expect(nothingSent()).toBe(true)
  })

  it('a paper that is not on the desk, and a paper that is not a notice, are refused', async () => {
    expect(await post({ item_id: 'nope' })).toEqual({ status: 404, body: { error: 'Paper not found' } })
    world.items = [affidavit('it1'), notice({ id: 'ret1', kind: 'retainage_53_057' })]
    expect(await post({ item_id: 'it1' })).toEqual({ status: 400, body: { error: 'Not a lien notice' } })
    expect(await post({ item_id: 'ret1' })).toEqual({ status: 400, body: { error: 'Not a lien notice' } })
    expect(await post({})).toEqual({ status: 400, body: { error: 'Missing item_id' } })
    expect(nothingSent()).toBe(true)
  })

  it('no sign-in is refused before anything is read', async () => {
    expect(await post({ item_id: 'it1' }, false)).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    world.callerId = null
    expect(await post({ item_id: 'it1' })).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    expect(world.calls).toEqual([])
  })

  it('a job with no leader of its own asks every leader but the caller', async () => {
    const ROBERT = person('u-robert', 'Robert Dale', 'dev')
    world.users = [TAUNYA, WENDI, MALACHI, ROBERT]
    world.jobs = [{ ...world.jobs[0]!, master_user_id: null }]
    world.devices = new Set(['u-malachi', 'u-robert'])
    const res = await post({ item_id: 'it1' })
    expect(res.body).toMatchObject({ success: true, push_sent: 2, leader_name: null })
    expect([...(world.pushes[0]!.userIds as string[])].sort()).toEqual(['u-malachi', 'u-robert'])
  })
})

describe('the other kinds keep their own checks', () => {
  it('a pen record: only its recorder, to its signer', async () => {
    world.items = [notice({ status: 'approved', signer_signature_mode: 'pen', signed_recorded_by: 'u-taunya', signed_by: 'u-malachi', signed_at: '2026-11-10T18:00:00Z', signed_witness_how: 'saw_it' })]
    expect(await post({ item_id: 'it1', kind: 'pen_recorded' })).toEqual({ status: 403, body: { error: 'Not your record' } })
    expect(nothingSent()).toBe(true)
    world.callerId = 'u-taunya'
    expect((await post({ item_id: 'it1', kind: 'pen_recorded' })).body).toMatchObject({ success: true, push_sent: 1, leader_name: 'Malachi Whites' })
    expect(world.pushes[0]).toMatchObject({ userIds: ['u-malachi'], title: 'Taunya recorded your pen signature', templateType: 'lien_pen_recorded' })
  })

  it('a signing code: only the screen it was typed on, whatever that sign-in’s role', async () => {
    world.items = [notice({ status: 'approved', signer_signature_mode: 'code', signed_by: 'u-malachi', signed_at: '2026-11-10T18:00:00Z', signed_on_device_of: 'u-hank' })]
    expect(await post({ item_id: 'it1', kind: 'code_used' })).toEqual({ status: 403, body: { error: 'Not your screen' } })
    world.callerId = 'u-hank'
    expect((await post({ item_id: 'it1', kind: 'code_used' })).body).toMatchObject({ success: true, push_sent: 1 })
    expect(world.pushes[0]).toMatchObject({ userIds: ['u-malachi'], title: 'Your signing code signed a lien notice', templateType: 'lien_code_used' })
    world.items = [notice({ status: 'approved', signer_signature_mode: 'code', signed_by: 'u-malachi', signed_on_device_of: null })]
    expect(await post({ item_id: 'it1', kind: 'code_used' })).toEqual({ status: 200, body: { error: 'Signed on his own screen' } })
    world.items = [notice({ status: 'approved', signer_signature_mode: 'typed', signed_by: 'u-malachi' })]
    expect(await post({ item_id: 'it1', kind: 'code_used' })).toEqual({ status: 403, body: { error: 'Not a code signature' } })
  })

  it('a waiver’s code: no release, no message', async () => {
    expect(await post({ kind: 'waiver_code_used' })).toEqual({ status: 400, body: { error: 'Missing release_id' } })
    expect(await post({ kind: 'waiver_code_used', release_id: 'rel-none' })).toEqual({ status: 403, body: { error: 'Not a code signature' } })
    expect(nothingSent()).toBe(true)
  })
})

describe('an affidavit: the fifteen minutes stand for the send, and a reminder is a later call (v2.7445)', () => {
  const fresh = new Date(Date.now() - 60_000).toISOString()

  it('the send tells the leader of a paper just sent, and of no older one', async () => {
    world.items = [affidavit('a1', { submitted_at: fresh }), affidavit('a2')]
    const res = await post({ kind: 'affidavit', items: [{ item_id: 'a1', due_ymd: '2026-12-15' }, { item_id: 'a2', due_ymd: '2026-12-15' }] })
    expect(res.body).toMatchObject({ success: true, push_sent: 1, told: 1, leader_name: 'Malachi Whites' })
    expect(world.pushes).toHaveLength(1)
    expect(world.pushes[0]).toMatchObject({ title: 'Approve a lien affidavit', templateType: 'lien_affidavit_approval_ask' })
  })

  it('an old paper with no reminder asked answers 200 with nothing sent, as before', async () => {
    world.items = [affidavit('a2')]
    expect((await post({ kind: 'affidavit', items: [{ item_id: 'a2' }] })).body).toMatchObject({ success: true, push_sent: 0, told: 0, message: 'Not awaiting approval' })
    expect(nothingSent()).toBe(true)
  })

  it('a reminder reaches him for a paper sent forty days ago, in one message for the lot', async () => {
    world.items = [affidavit('a2'), affidavit('a3'), affidavit('a4', { status: 'approved' })]
    world.devices = new Set()
    const res = await post({ kind: 'affidavit', remind: true, items: [{ item_id: 'a2' }, { item_id: 'a3' }, { item_id: 'a4' }] })
    expect(res.body).toMatchObject({ success: true, email_sent: true, told: 2 })
    expect(world.emails).toHaveLength(1)
    expect(world.emails[0]!.text.split('\n')[0]).toBe('Wendi is reminding you of 2 lien affidavits that wait for your approval.')
  })

  it('a caller outside the office is refused', async () => {
    world.callerId = 'u-hank'
    world.items = [affidavit('a1', { submitted_at: fresh })]
    expect(await post({ kind: 'affidavit', remind: true, items: [{ item_id: 'a1' }] })).toEqual({ status: 403, body: { error: 'Not the office' } })
    expect(nothingSent()).toBe(true)
  })
})
