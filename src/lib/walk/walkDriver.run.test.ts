/**
 * The walk's driver, run here against fakes (punch list #142 PR 8): `runWalk` from `scripts/walk/run.ts` with its io
 * stubbed — every function call answered from here, the kit's thread advanced as each leg lands, the clock fake, so
 * the test asserts the sequence of calls, a wait ending on its limit with what it saw, cleanup in `finally`, and that
 * nothing printed carries a secret or a whole link. Nothing reaches a network.
 */
import { describe, expect, it } from 'vitest'
import type { FollowUpContactRow, FollowUpMessageRow, FollowUpRows } from '../followUp/followUpRows'
import { MAIL_WAIT_MS, type ThreadLine } from './walkRun'
import { runWalk, TEXT_WORDS, type Auth, type WalkChannel, type WalkIo, type WalkReads } from '../../../scripts/walk/run'

const KIT = {
  customerId: 'cu-walk',
  contactId: 'c-walk',
  emailChannelId: 'ch-walk-email',
  phoneChannelId: 'ch-walk-phone',
  estimateId: 'e-walk',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}
const ANON = 'anon-key-value-1234'
const SECRET = 'dev-login-secret-value'
const JWT = 'tester-jwt-value-xyz'
const LINK = 'https://clicktooling.com/estimate/accept?t=tok-abcdef-9f2e'
const START = Date.parse('2026-10-22T14:00:00.000Z')

const contactRow = (id: string, patch: Partial<FollowUpContactRow> = {}): FollowUpContactRow => ({
  id,
  kind: 'customer',
  customer_id: null,
  customer_contact_person_id: null,
  gc_company_id: null,
  gc_company_person_id: null,
  person_id: null,
  name: null,
  goes_by: null,
  off_since: null,
  off_why: null,
  off_by: null,
  prospect_id: null,
  supply_house_id: null,
  supply_house_contact_id: null,
  team_prospect_id: null,
  state: 'waiting',
  snoozed_until: null,
  has_user_id: null,
  has_since: null,
  has_how: null,
  ...patch,
})

const queueLine = (id: string, contactId: string, at: string): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: 'ch-walk-phone',
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at,
  subject: null,
  body: TEXT_WORDS,
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
})

interface Fake {
  io: WalkIo
  calls: Array<{ name: string; body: Record<string, unknown>; auth: Auth }>
  printed: string[]
  thread: ThreadLine[]
  channel: WalkChannel
  written: unknown
  /** Whether the estimate email ever arrives in bids@. */
  arrives: boolean
}

interface FakeOpts {
  /** Whether the estimate email ever arrives in bids@. */
  arrives?: boolean
  /** A kept kit: setup answers made false with an older stamp, the thread already holds the seed and the owner's press, the estimate is sent. */
  kept?: boolean
  /** The first `walk open` throws a fetch failure. */
  failOpenFirst?: boolean
  /** Every read of the channel throws a fetch failure. */
  channelThrows?: boolean
}
const fetchFailed = () => Object.assign(new TypeError('fetch failed'), { cause: new Error('ECONNRESET') })

function fake(opts: FakeOpts = {}): Fake {
  let clock = START
  const f: Fake = { io: null as unknown as WalkIo, calls: [], printed: [], thread: [], channel: { id: 'ch-walk-phone', contact_id: 'c-walk', kind: 'phone', opted_out_at: null, opted_out_by_box: {} }, written: null, arrives: opts.arrives ?? true }
  const line = (patch: Partial<ThreadLine> & Pick<ThreadLine, 'id' | 'channel' | 'direction'>): ThreadLine => ({
    quo_id: null,
    channel_id: 'ch-walk-phone',
    who_text: '',
    at: new Date(clock).toISOString(),
    body: '',
    delivery: null,
    mailbox: 'team',
    ...patch,
  })
  if (opts.kept) {
    f.thread.push(line({ id: 'm-seed', channel: 'text', direction: 'out', at: new Date(START - 3 * 86_400_000).toISOString(), who_text: 'ZZ walk seed', quo_id: 'walk-seed-old', delivery: 'delivered' }))
    f.thread.push(line({ id: 'm-text-out', channel: 'text', direction: 'out', at: new Date(START - 10 * 60_000).toISOString(), body: 'Your estimate', quo_id: 'quo-1', who_text: 'Robert' }))
  }
  let opens = 0
  const reads: WalkReads = {
    thread: async () => f.thread.map((l) => ({ ...l })),
    channel: async () => {
      if (opts.channelThrows) throw fetchFailed()
      return { ...f.channel }
    },
    estimate: async () => (opts.kept ? { status: 'sent', sent_at: new Date(START - 10 * 60_000).toISOString(), title: 'ZZ walk estimate (delete me)', estimate_number: 7 } : { status: 'draft', sent_at: null, title: 'ZZ walk estimate (delete me)', estimate_number: 7 }),
    boxes: async () => ({ team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' }, bids: { address: KIT.email, phone: KIT.phone, numberId: 'PN-bids' } }),
    strays: async () => [{ id: 'c-walk', kind: 'customer', created_at: new Date(START + 1000).toISOString(), channels: [{ kind: 'email', key: KIT.email }] }],
    loadQueue: async (): Promise<FollowUpRows> => ({
      contacts: [contactRow('c-walk', { customer_id: 'cu-walk' })],
      channels: [],
      records: { customers: [{ id: 'cu-walk', name: 'ZZ Walk Messages Desk' }] },
      messages: [queueLine('m-text-in', 'c-walk', new Date(clock - 60_000).toISOString())],
      heard: [],
      owed: [],
    }),
    loadWaiting: async () => [],
    loadWentOut: async () => [{ id: 'm-text-out', contactId: 'c-walk', name: 'ZZ Walk Messages Desk', kind: 'customer', channel: 'text', body: 'Your estimate', atMs: START + 120_000, who: 'ZZ Walk tester', delivery: 'delivered' }],
    loadStrip: async () => ({
      lines: [
        { id: 'm-text-in', contactId: 'c-walk', kind: 'customer', direction: 'in', channel: 'text', atMs: clock - 60_000, who: 'ZZ' },
        { id: 'm-other', contactId: 'c-dana', kind: 'customer', direction: 'in', channel: 'text', atMs: clock - 3_600_000, who: 'Dana' },
      ],
      estimates: [{ id: 'e-walk', number: 7, sentAtMs: START + 60_000, opened: true, accepted: false }],
      ratings: [],
    }),
  }
  f.io = {
    secrets: [ANON, SECRET],
    now: () => clock,
    sleep: async (ms) => void (clock += ms),
    log: (l) => f.printed.push(l),
    writeReport: (r) => ((f.written = r), '/tmp/walk/report.json'),
    signIn: async () => ({ jwt: JWT, reads }),
    call: async (name, body, auth) => {
      const b = body as Record<string, unknown>
      f.calls.push({ name, body: b, auth })
      if (name === 'send-estimate-to-customer') return { status: 200, body: { ok: true, emailed: true, sent_to: KIT.email, accept_url: LINK } }
      if (name === 'quo-send') {
        f.thread.push(line({ id: 'm-text-out', channel: 'text', direction: 'out', body: String(b.body), quo_id: 'quo-1' }))
        return { status: 200, body: { ok: true, messageId: 'm-text-out', quoId: 'quo-1', mailbox: 'team' } }
      }
      if (name === 'messages-email') {
        f.thread.push(line({ id: 'm-email-out', channel: 'email', direction: 'out', channel_id: 'ch-walk-email' }))
        return { status: 200, body: { ok: true, messageId: 'm-email-out' } }
      }
      if (name !== 'walk') return { status: 404, body: { error: `unexpected ${name}` } }
      switch (b.action) {
        case 'setup':
          return { status: 200, body: { ok: true, kit: opts.kept ? { ...KIT, made: false, madeAt: new Date(START - 30 * 60_000).toISOString() } : { ...KIT, made: true }, tester: { id: 'u-tester', email: 'walk-tester@walk.pipetooling.local', made: false } } }
        case 'seed-old':
          f.thread.push(line({ id: 'm-seed', channel: 'text', direction: 'out', at: new Date(clock - 3 * 86_400_000).toISOString(), who_text: 'ZZ walk seed', delivery: 'delivered' }))
          return { status: 200, body: { ok: true, id: 'm-seed', at: new Date(clock - 3 * 86_400_000).toISOString() } }
        case 'open':
          opens += 1
          if (opts.failOpenFirst && opens === 1) throw fetchFailed()
          if (!f.arrives || opens < (opts.failOpenFirst ? 3 : 2)) return { status: 200, body: { ok: true, arrived: false, checked: 0 } }
          f.thread.push(line({ id: 'm-eye', channel: 'event', direction: 'out', quo_id: 'estimate:e-walk:opened', body: '👀 ZZ opened estimate #7.', mailbox: null }))
          return { status: 200, body: { ok: true, arrived: true, arrivedAt: new Date(clock).toISOString(), linkTail: '…9f2e', open: { status: 200, ok: true } } }
        case 'reply-email':
          f.thread.push(line({ id: 'm-email-in', channel: 'email', direction: 'in', channel_id: 'ch-walk-email' }))
          return { status: 200, body: { ok: true, gmailId: 'gm-1' } }
        case 'text': {
          if (b.words === TEXT_WORDS) {
            f.thread.push(line({ id: 'm-text-in', channel: 'text', direction: 'in', body: TEXT_WORDS }))
            const out = f.thread.find((l) => l.id === 'm-text-out')
            if (out) out.delivery = 'delivered'
          }
          if (b.words === 'STOP') f.channel.opted_out_by_box = { team: new Date(clock).toISOString() }
          if (b.words === 'START') f.channel.opted_out_by_box = { team: null }
          return { status: 200, body: { ok: true, quoId: `quo-${String(b.words)}` } }
        }
        case 'cleanup':
          return { status: 200, body: { ok: true, cleaned: true, counts: { messages: f.thread.length, contacts: 1, customers: 1, estimates: 1 } } }
        default:
          return { status: 400, body: { ok: false, words: 'unknown action' } }
      }
    },
  }
  return f
}

const flagsOf = (patch: Partial<Parameters<typeof runWalk>[0]> = {}) => ({ keep: false, ownerPresses: false, fallbackPhone: false, answer: false, cleanupOnly: false, ...patch })

describe('npm run walk (punch list #142 PR 8)', () => {
  it('runs the whole loop in order, reads the office’s view, finds no stray, cleans up, and prints no secret', async () => {
    const f = fake()
    const report = await runWalk(flagsOf(), f.io)
    expect(f.calls.map((c) => `${c.name}${c.name === 'walk' ? `:${String(c.body.action)}${c.body.words ? ` ${String(c.body.words)}` : ''}` : ''}`)).toEqual([
      'walk:setup',
      'walk:seed-old',
      'send-estimate-to-customer',
      'quo-send',
      'walk:open',
      'walk:open',
      'walk:reply-email Can you do it Thursday?',
      'walk:text Thursday works',
      'walk:text STOP',
      'walk:text START',
      'walk:cleanup',
    ])
    expect(f.calls[0]!.auth).toBe('secret')
    expect(f.calls[2]).toMatchObject({ auth: { jwt: JWT }, body: { estimate_id: 'e-walk', customer_email: KIT.email, public_origin: 'https://clicktooling.com' } })
    expect(f.calls[3]).toMatchObject({ auth: { jwt: JWT }, body: { contactId: 'c-walk', channelId: 'ch-walk-phone' } })
    expect(String(f.calls[3]!.body.body)).toBe(`ZZ, this is ZZ Walk tester with Click Plumbing. Your estimate for ZZ walk estimate (delete me) is ready, $1.00. Open it to approve the option you want: ${LINK}`)

    expect(report.ok).toBe(true)
    expect(report.steps.map((s) => `${s.key}:${s.ok}`)).toEqual([
      'setup:true',
      'signIn:true',
      'seedOld:true',
      'estimateEmail:true',
      'estimateText:true',
      'open:true',
      'replyEmail:true',
      'replyText:true',
      'stop:true',
      'start:true',
      'answer:null',
      'office:true',
      'stray:true',
      'cleanup:true',
    ])
    expect(report.steps.find((s) => s.key === 'open')).toMatchObject({ waitedFor: '15 s', where: expect.stringContaining('👀 line m-eye') })
    expect(report.steps.find((s) => s.key === 'replyText')?.where).toContain('the estimate text reads ✓ delivered')
    expect(report.steps.find((s) => s.key === 'stop')?.where).toBe('the team box’s stop is set on the kit’s number')
    expect(report.lanes?.kitIn).toBe('in New (Who has it?)')
    expect(report.lanes?.wentOut).toEqual(['ZZ Walk Messages Desk: text 9:02 AM · ZZ Walk tester ✓ delivered'])
    expect(report.strip?.find((d) => d.key === 'estimates')).toMatchObject({ differs: true })
    expect(report.strays).toEqual([])
    expect(report.cleanup).toMatchObject({ cleaned: true })
    expect(report.kit).toEqual({ customerId: 'cu-walk', contactId: 'c-walk', estimateId: 'e-walk', emailChannelId: 'ch-walk-email', phoneChannelId: 'ch-walk-phone', sharedPhone: false })
    expect(f.written).toEqual(report)

    const all = f.printed.join('\n')
    for (const secret of [ANON, SECRET, JWT, LINK]) expect(all, secret).not.toContain(secret)
    expect(all).toContain('Green: every step went, no stray contact, cleaned up.')
    expect(all).toContain('Report written to /tmp/walk/report.json')
  })

  it('a wait that ends on its limit holds the step with what it saw, skips what needed it, and still cleans up', async () => {
    const f = fake({ arrives: false })
    const report = await runWalk(flagsOf(), f.io)
    const open = report.steps.find((s) => s.key === 'open')!
    expect(open).toMatchObject({ ok: false, held: 'the estimate email never arrived in the bids inbox', waitedFor: '3 m', saw: 'bids@ had no email from the app’s sender for this estimate' })
    expect(f.calls.filter((c) => c.name === 'walk' && c.body.action === 'open')).toHaveLength(Math.floor(MAIL_WAIT_MS / 15_000) + 1)
    expect(report.steps.find((s) => s.key === 'replyEmail')).toMatchObject({ ok: null, held: 'the open held' })
    // The text legs do not need the email: they still run.
    expect(report.steps.find((s) => s.key === 'replyText')?.ok).toBe(true)
    expect(f.calls[f.calls.length - 1]).toMatchObject({ name: 'walk', body: { action: 'cleanup' } })
    expect(report.ok).toBe(false)
    expect(report.held).toEqual(['Open the estimate from the bids inbox: the estimate email never arrived in the bids inbox'])
  })

  it('--keep leaves the rows and says how to clean them; --cleanup-only only cleans up', async () => {
    const kept = fake()
    const r1 = await runWalk(flagsOf({ keep: true }), kept.io)
    expect(kept.calls.some((c) => c.body.action === 'cleanup')).toBe(false)
    expect(r1.steps.find((s) => s.key === 'cleanup')).toMatchObject({ ok: null, held: 'kept (--keep)' })
    expect(r1.ok).toBe(true)
    expect(kept.printed.join('\n')).toContain('Run `npm run walk -- --cleanup-only` to remove them.')

    const only = fake()
    const r2 = await runWalk(flagsOf({ cleanupOnly: true }), only.io)
    expect(only.calls.map((c) => c.body.action)).toEqual(['cleanup'])
    expect(r2.steps.map((s) => s.key)).toEqual(['cleanup'])
    expect(r2.ok).toBe(true)
  })

  it('--answer sends one email from the thread as the tester and asserts one line out and no second', async () => {
    const f = fake()
    const report = await runWalk(flagsOf({ answer: true }), f.io)
    expect(f.calls.find((c) => c.name === 'messages-email')).toMatchObject({ auth: { jwt: JWT }, body: { contactId: 'c-walk', channelId: 'ch-walk-email' } })
    expect(report.steps.find((s) => s.key === 'answer')).toMatchObject({ ok: true, where: 'one email out, no second line' })
    expect(report.ok).toBe(true)
  })

  it('--fallback-phone sets up with the owner’s phone, asks the owner to text, and sends no text through Quo', async () => {
    const f = fake()
    const report = await runWalk(flagsOf({ fallbackPhone: true }), f.io)
    expect(f.calls[0]).toMatchObject({ name: 'walk', body: { action: 'setup', fallback: true, ownerEmail: 'robert@douglasmining.com' } })
    expect(f.calls.some((c) => c.name === 'walk' && c.body.action === 'text')).toBe(false)
    expect(f.printed).toContain(`Text "${TEXT_WORDS}" now from your own phone to the company number.`)
    // Nobody texted back in this fake, so the text legs hold after their wait, and the walk still cleans up.
    expect(report.steps.find((s) => s.key === 'replyText')).toMatchObject({ ok: false, held: 'the text never landed on the thread' })
    expect(f.calls[f.calls.length - 1]).toMatchObject({ body: { action: 'cleanup' } })
  })

  it('a poll that throws inside a wait is tried again on the next poll, and the walk goes on (found item 2)', async () => {
    const f = fake({ failOpenFirst: true })
    const report = await runWalk(flagsOf(), f.io)
    expect(f.calls.filter((c) => c.name === 'walk' && c.body.action === 'open')).toHaveLength(3)
    expect(report.steps.find((s) => s.key === 'open')).toMatchObject({ ok: true, waitedFor: '30 s' })
    expect(f.printed).toContain('  poll 1 failed, trying again on the next: TypeError: fetch failed (ECONNRESET)')
    expect(report.ok).toBe(true)
  })

  it('a wait whose every poll throws holds its step with the last error, and the walk still cleans up', async () => {
    const f = fake({ channelThrows: true })
    const report = await runWalk(flagsOf(), f.io)
    expect(report.steps.find((s) => s.key === 'stop')).toMatchObject({ ok: false, held: 'the stop was never set', waitedFor: '2 m', saw: 'the last poll failed: TypeError: fetch failed (ECONNRESET)' })
    expect(report.steps.find((s) => s.key === 'start')).toMatchObject({ ok: false, held: 'the stop never cleared' })
    expect(f.calls[f.calls.length - 1]).toMatchObject({ name: 'walk', body: { action: 'cleanup' } })
    expect(report.ok).toBe(false)
  })

  it('--owner-presses on a kept kit reads the press made before the restart and seeds no second line (found items 3 and 4)', async () => {
    const f = fake({ kept: true })
    const report = await runWalk(flagsOf({ ownerPresses: true, keep: true }), f.io)
    expect(f.calls.some((c) => c.name === 'walk' && c.body.action === 'seed-old')).toBe(false)
    expect(report.steps.find((s) => s.key === 'seedOld')).toMatchObject({ ok: true, where: expect.stringContaining('already there from an earlier run: line m-seed') })
    expect(report.steps.find((s) => s.key === 'estimateEmail')).toMatchObject({ ok: true, waitedFor: '0 s' })
    expect(report.steps.find((s) => s.key === 'estimateText')).toMatchObject({ ok: true, where: 'the owner’s press, a text out (pressed before this run)', waitedFor: '0 s' })
    expect(report.steps.find((s) => s.key === 'replyText')?.where).toContain('the estimate text reads ✓ delivered')
    expect(f.printed.some((l) => l.endsWith('A press made before this restart is read as well.'))).toBe(true)
    expect(report.ok).toBe(true)
  })

  it('a refused setup ends the walk with the refusal and nothing else pressed, then cleanup', async () => {
    const f = fake()
    const io: WalkIo = { ...f.io, call: async (name, body, auth) => (name === 'walk' && (body as { action: string }).action === 'setup' ? { status: 409, body: { ok: false, error: 'setupRefused', words: 'The walk kit cannot be set up: contacts abc carries bids@.' } } : f.io.call(name, body, auth)) }
    const report = await runWalk(flagsOf(), io)
    expect(report.steps.map((s) => `${s.key}:${s.ok}`)).toEqual(['setup:false', 'cleanup:true'])
    expect(report.held).toEqual(['Set up the kit: The walk kit cannot be set up: contacts abc carries bids@.'])
    expect(f.calls.map((c) => c.body.action)).toEqual(['cleanup'])
  })
})
