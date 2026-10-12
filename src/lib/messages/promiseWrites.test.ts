import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { promiseWriteThrough, refusedWords, runPromiseWrites, writePlace, type PromiseAt, type PromiseWrite, type PromiseWriters, type WrittenPromise } from './promiseWrites'
import type { HeardPromiseKind } from './promises'

const TODAY = '2026-10-12'

const trade = (more: Partial<PromiseAt> = {}): PromiseAt => ({
  line: { channel: 'call', onYmd: '2026-10-12', bidId: null, projectId: 'boerne', jobName: 'Boerne Retail Shell' },
  person: { kind: 'trade', name: 'Tom Riddle', company: 'Hillside Excavation', trade: 'Sitework', contactId: 'tom', companyId: 'hillside' },
  askInviteId: 'inv-hillside-boerne',
  billingJobId: null,
  holds: {},
  todayYmd: TODAY,
  nowIso: '2026-10-12T20:00:00.000Z',
  by: { userId: 'u-rosa', name: 'Rosa', moneyTeam: true },
  ...more,
})
const customer = (more: Partial<PromiseAt> = {}): PromiseAt =>
  trade({ person: { kind: 'customer', name: 'Elena Ruiz', contactId: 'elena', companyId: null }, askInviteId: null, billingJobId: 'job-boerne', ...more })
const arch = (more: Partial<PromiseAt> = {}): PromiseAt =>
  trade({ person: { kind: 'arch', name: 'Jonah Park', company: 'Park Studio', contactId: 'jonah', companyId: null }, askInviteId: null, ...more })

const promise = (kind: HeardPromiseKind, more: Partial<WrittenPromise> = {}): WrittenPromise => ({ kind, dayYmd: '2026-10-14', ...more })
const kinds = (w: PromiseWrite[]) => w.map((x) => x.kind)

describe('promiseWriteThrough: where a written promise also goes', () => {
  it('a quote: a line on the company’s ask with the promised day, from a voicemail as a call', () => {
    const t = promiseWriteThrough(promise('quote'), trade({ line: { ...trade().line, channel: 'voicemail' } }))
    expect(t.target).toBe('boardAsk')
    expect(t.skips).toEqual([])
    expect(t.writes).toEqual([
      {
        kind: 'askDay',
        companyId: 'hillside',
        inviteId: 'inv-hillside-boerne',
        on: '2026-10-12',
        how: 'call',
        note: 'Said in a voicemail: Hillside Excavation’s Sitework quote for Boerne Retail Shell by Wed Oct 14.',
        promisedBy: '2026-10-14',
      },
    ])
  })

  it('a quote with no open ask, no job or no company writes nothing, and says what to do', () => {
    expect(promiseWriteThrough(promise('quote'), trade({ askInviteId: null })).skips).toEqual(['No open ask for Hillside Excavation on this job. Ask them from the Board.'])
    expect(promiseWriteThrough(promise('quote'), trade({ line: { ...trade().line, projectId: null } })).skips[0]).toMatch(/^The line is on no job\. Tie it to a job/)
    expect(promiseWriteThrough(promise('quote'), trade({ person: { ...trade().person, companyId: null } })).skips[0]).toMatch(/^They are not tied to a company yet\./)
    expect(promiseWriteThrough(promise('quote'), trade({ line: { ...trade().line, channel: 'note' } })).writes).toEqual([])
  })

  it('a start or a delivery is the Board’s promise on the job; insurance or a W-9 is the company’s', () => {
    expect(promiseWriteThrough(promise('start', { writes: 'delivery' }), trade()).writes).toEqual([
      { kind: 'tradePromise', companyId: 'hillside', promise: 'delivery', projectId: 'boerne', dueOn: '2026-10-14', what: 'Hillside Excavation’s delivery on Boerne Retail Shell' },
    ])
    expect(promiseWriteThrough(promise('start'), trade()).writes[0]).toMatchObject({ promise: 'start', what: 'Hillside Excavation’s start on Boerne Retail Shell' })
    expect(promiseWriteThrough(promise('papers', { writes: 'w9' }), trade({ line: { ...trade().line, projectId: null } })).writes).toEqual([
      { kind: 'tradePromise', companyId: 'hillside', promise: 'w9', projectId: null, dueOn: '2026-10-14', what: 'Hillside Excavation’s W-9' },
    ])
    expect(promiseWriteThrough(promise('start'), trade({ line: { ...trade().line, projectId: null } })).writes).toEqual([])
  })

  it('a payment: the Pipeline’s promise on the job’s bill, then a hold on the flow’s pay application', () => {
    const t = promiseWriteThrough(promise('payment'), customer({ line: { ...customer().line, channel: 'text' } }))
    expect(t.target).toBe('paymentPromise')
    expect(t.writes).toEqual([
      { kind: 'payment', jobId: 'job-boerne', date: '2026-10-14', note: 'Said in a text: a payment on Boerne Retail Shell by Wed Oct 14.', channel: 'text' },
      { kind: 'hold', contactId: 'elena', stepId: 'payapp', jobId: 'boerne', until: '2026-10-14' },
    ])
    expect(promiseWriteThrough(promise('payment'), customer({ billingJobId: null })).skips).toEqual(['This job has no bill on the Pipeline yet. Add the promise there once it has one.'])
  })

  it('a hold only for a day after today, and never earlier than one already standing', () => {
    expect(promiseWriteThrough(promise('cert', { dayYmd: TODAY }), arch()).skips).toEqual(['Mon Oct 12 is not after today, so the reminder was not held.'])
    expect(promiseWriteThrough(promise('cert'), arch({ holds: { 'certify|boerne': '2026-10-16' } })).skips).toEqual(['The reminder is already held until Fri Oct 16, so it stays.'])
    expect(promiseWriteThrough(promise('cert'), arch({ holds: { 'certify|boerne': '2026-10-14' } })).writes).toEqual([])
    expect(promiseWriteThrough(promise('cert'), arch({ holds: { 'certify|boerne': '2026-10-13', 'certify|padb': '2026-10-20' } })).writes).toEqual([
      { kind: 'hold', contactId: 'jonah', stepId: 'certify', jobId: 'boerne', until: '2026-10-14' },
    ])
  })

  it('a decision: the bid’s follow-up day as a note, or on a GC job a hold on Said yes', () => {
    const onBid = promiseWriteThrough(promise('decision'), customer({ line: { ...customer().line, bidId: 'bid-7', projectId: null } }))
    expect(onBid.target).toBe('bidFollowUp')
    expect(onBid.writes).toEqual([
      {
        kind: 'bidFollowup',
        entry: {
          bid_id: 'bid-7',
          gc_customer_id: null,
          contact_method: null,
          notes: 'Said on a call: their answer on our bid for Boerne Retail Shell by Wed Oct 14. Call again Wed, Oct 14. Ask for Elena Ruiz. Waiting on owner deciding.',
          occurred_at: '2026-10-12T20:00:00.000Z',
          created_by: 'u-rosa',
          next_followup_on: '2026-10-14',
          next_followup_contact_person_id: null,
          next_followup_reason: 'owner_deciding',
          next_followup_cleared: false,
        },
      },
    ])
    expect(promiseWriteThrough(promise('decision'), customer()).writes).toEqual([{ kind: 'hold', contactId: 'elena', stepId: 'yes', jobId: 'boerne', until: '2026-10-14' }])
    expect(promiseWriteThrough(promise('decision'), customer({ line: { ...customer().line, projectId: null } })).skips).toEqual([
      'The line is on no bid or job. Tie it to the bid, then set its follow-up day.',
    ])
  })

  it('access, an answer and a certificate hold their steps: On site, Questions, Certify pay apps', () => {
    expect(promiseWriteThrough(promise('access'), customer()).writes).toEqual([{ kind: 'hold', contactId: 'elena', stepId: 'onsite', jobId: 'boerne', until: '2026-10-14' }])
    expect(promiseWriteThrough(promise('answer'), arch()).writes).toEqual([{ kind: 'hold', contactId: 'jonah', stepId: 'questions', jobId: 'boerne', until: '2026-10-14' }])
    expect(promiseWriteThrough(promise('access'), customer()).target).toBe('scheduleWait')
    expect(promiseWriteThrough(promise('answer'), arch()).target).toBe('planQuestion')
    expect(promiseWriteThrough(promise('cert'), arch()).target).toBe('payAppCertificate')
  })

  it('a day heard only in words writes nothing past the line, whatever the kind', () => {
    for (const [kind, at] of [['quote', trade()], ['payment', customer()], ['answer', arch()]] as const) {
      const t = promiseWriteThrough(promise(kind, { dayYmd: null, dayWords: 'next week' }), at)
      expect(t.writes).toEqual([])
      expect(t.skips[0]).toMatch(/^No date was heard, so nothing went to .+\. Add it there once they give a day\.$/)
    }
  })

  it('one promise per target written by someone off the money gate: only the Pipeline is skipped', () => {
    const off = { userId: 'u-est', name: 'Sam', moneyTeam: false }
    const each: [HeardPromiseKind, PromiseAt, string[]][] = [
      ['quote', trade({ by: off }), ['askDay']],
      ['start', trade({ by: off }), ['tradePromise']],
      ['payment', customer({ by: off }), ['hold']],
      ['decision', customer({ by: off }), ['hold']],
      ['access', customer({ by: off }), ['hold']],
      ['answer', arch({ by: off }), ['hold']],
      ['cert', arch({ by: off }), ['hold']],
    ]
    for (const [kind, at, writes] of each) {
      const t = promiseWriteThrough(promise(kind), at)
      expect(`${kind}: ${kinds(t.writes).join(',')}`).toBe(`${kind}: ${writes.join(',')}`)
      expect(t.skips).toEqual(kind === 'payment' ? ['Only the money team writes a payment promise. Ask one of them to add it on the Pipeline.'] : [])
    }
  })

  it('a refusal names its place and its words, and every word here passes the plain words rules', () => {
    const pay: PromiseWrite = { kind: 'payment', jobId: 'job-boerne', date: '2026-10-14', note: 'x', channel: null }
    expect(writePlace(pay)).toBe('The Pipeline')
    expect(refusedWords(pay, 'Not allowed to record payment promises')).toBe('Written down. The Pipeline did not take it. Not allowed to record payment promises.')
    const said: string[] = [refusedWords(pay, 'Job not found')]
    for (const kind of ['quote', 'start', 'papers', 'payment', 'decision', 'access', 'answer', 'cert'] as const) {
      for (const at of [trade({ askInviteId: null }), trade({ person: { ...trade().person, companyId: null } }), customer({ billingJobId: null, by: { userId: 'u', name: 'S', moneyTeam: false } }), arch({ line: { ...arch().line, projectId: null } })]) {
        for (const p of [promise(kind), promise(kind, { dayYmd: null, dayWords: 'soon' }), promise(kind, { dayYmd: TODAY })]) said.push(...promiseWriteThrough(p, at).skips)
      }
    }
    expect(new Set(said).size).toBeGreaterThan(8)
    expect([...new Set(said)].flatMap((s) => plainWordsFailures(s).map((f) => `${s} → ${f}`))).toEqual([])
  })
})

describe('runPromiseWrites: the writes in order, stopping at the first refused', () => {
  const writers = (refuse: PromiseWrite['kind'] | null, made: string[]): PromiseWriters => {
    const make = (kind: PromiseWrite['kind']) => async () => {
      if (kind === refuse) throw { message: 'Not allowed to record payment promises' }
      made.push(kind)
    }
    return { askDay: make('askDay'), tradePromise: make('tradePromise'), payment: make('payment'), bidFollowup: make('bidFollowup'), hold: make('hold') }
  }
  const words = (e: unknown) => (e as { message: string }).message
  const writes = promiseWriteThrough(promise('payment'), customer()).writes

  it('makes each write through its own verb', async () => {
    const made: string[] = []
    expect(await runPromiseWrites(writes, writers(null, made), words)).toEqual({ made: writes, refused: null })
    expect(made).toEqual(['payment', 'hold'])
  })

  it('stops at the first refused, names its place and its words, and keeps what went before', async () => {
    const made: string[] = []
    expect(await runPromiseWrites(writes, writers('payment', made), words)).toEqual({ made: [], refused: 'Written down. The Pipeline did not take it. Not allowed to record payment promises.' })
    expect(made).toEqual([])
    const after: string[] = []
    expect((await runPromiseWrites(writes, writers('hold', after), words)).made).toEqual([writes[0]])
  })
})
