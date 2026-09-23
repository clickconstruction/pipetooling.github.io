import { describe, expect, it } from 'vitest'
import { abbreviateTimeSince, advanceConsequence, jobNextLine, phoneRowPasses, type JobNextLineInput } from './jobNextLine'
import type { ProgressPaymentView } from './progressPaymentCell'
import type { StagesMoneyBarModel } from '../stagesMoneyBar'
import type { JobCrewPosition } from './jobCrewPosition'

const view = (over: Partial<ProgressPaymentView> = {}): ProgressPaymentView => ({
  mode: 'lines',
  stageBar: null,
  liveChipSuffix: null,
  segments: [],
  words: { text: '', full: '', tone: 'plain' },
  stale: false,
  percent: null,
  ...over,
})

const bar = (over: Partial<StagesMoneyBarModel> = {}): StagesMoneyBarModel => ({
  hasBar: true,
  paidFrac: 0,
  billedFrac: 0,
  unbilledFrac: 0,
  total: 600,
  paid: 0,
  billedUnpaid: 0,
  valueCreated: 0,
  unbilled: 0,
  doneNotBilled: 0,
  notDone: 600,
  owed: 0,
  overpaid: false,
  ...over,
})

const crew = (over: Partial<JobCrewPosition> = {}): JobCrewPosition => ({
  jobId: 'j',
  lastWorkYmd: '2026-09-18',
  lastDayPeople: ['Behar'],
  onSiteToday: false,
  sessions60d: 3,
  people60d: 1,
  sheet: null,
  report: null,
  pctManualAt: null,
  pctSetAt: null,
  pctSource: null,
  ...over,
})

const base = (over: Partial<JobNextLineInput> = {}): JobNextLineInput => ({
  stage: 'working',
  view: view(),
  money: bar(),
  billSentAlert: null,
  quietDays: null,
  expectedPay: null,
  contract: null,
  upcoming: null,
  crew: null,
  billDisplay: null,
  createdAt: '2026-09-23T14:00:00Z',
  todayYmd: '2026-09-23',
  now: new Date('2026-09-23T14:24:00Z'),
  ...over,
})

describe('jobNextLine — the chip, first match wins', () => {
  it('no bid value beats everything', () => {
    const n = jobNextLine(base({ view: view({ mode: 'nobid' }), billSentAlert: { sentAt: null, label: 'x', title: 't' }, quietDays: 20 }))
    expect(n.chip).toMatchObject({ label: 'no bid value', tone: 'red', action: 'no-bid' })
    expect(n.needsMe).toBe(true)
  })
  it('a bill out with no % is red, then quiet days by severity', () => {
    expect(jobNextLine(base({ billSentAlert: { sentAt: null, label: 'Bill sent Sep 21 · set % done', title: 't' } })).chip).toMatchObject({ label: 'set % done', tone: 'red', action: 'pct' })
    expect(jobNextLine(base({ quietDays: 6 })).chip).toMatchObject({ label: 'quiet 6 d', tone: 'amber', action: 'notes' })
    expect(jobNextLine(base({ quietDays: 15 })).chip).toMatchObject({ label: 'quiet 15 d', tone: 'red' })
  })
  it('a late bill, then a missing contract, are amber; a signed one is a fact on the line', () => {
    expect(
      jobNextLine(base({ stage: 'billed', expectedPay: { expectedYmd: '2026-09-10', state: 'late', source: 'customer', medianDays: 30, daysLate: 12, label: '12d past expected', title: 't' } })).chip,
    ).toMatchObject({ label: '12 d past expected', tone: 'amber', action: 'bill-row' })
    expect(jobNextLine(base({ contract: { kind: 'none' } })).chip).toMatchObject({ label: 'no contract', tone: 'amber', action: 'contract' })
    const signed = jobNextLine(base({ contract: { kind: 'signed', source: 'estimate', signedAt: '2026-09-20T00:00:00Z', estimateNumber: 146 } as never }))
    expect(signed.chip).toBeNull()
    expect(signed.line).toContain('Signed')
  })
  it('a ready draw and done-not-billed money are green and do not count as Needs me', () => {
    const draw = jobNextLine(base({ view: view({ mode: 'stages', stageBar: { segments: [], count: 3, liveNumber: 2, caption: 'Stage 2 of 3 · Top Out 60% · draw 2 ready to bill', captionTone: 'amber', impliedJobPct: 40, recognized: true } }) }))
    expect(draw.chip).toMatchObject({ label: 'draw 2 ready', tone: 'green', action: 'bill-stage' })
    expect(draw.needsMe).toBe(false)
    const done = jobNextLine(base({ money: bar({ doneNotBilled: 4200 }) }))
    expect(done.chip).toMatchObject({ label: '$4,200 done, not billed', tone: 'green', action: 'advance' })
    expect(jobNextLine(base({ stage: 'waiting', money: bar({ doneNotBilled: 4200 }) })).chip).toBeNull()
  })
})

describe('jobNextLine — the grey line', () => {
  it('leads with the next block and its crew, then one fact', () => {
    const n = jobNextLine(base({ upcoming: { ymd: '2026-09-24', timeStart: '13:00', timeEnd: '16:00', assigneeNames: ['Abraham'], note: null }, billDisplay: 'T+1 (mon)' }))
    expect(n.line).toBe('NEXT Thu Sep 24 1–4 PM · Abraham · bill T+1 (mon)')
    expect(n.today).toBe(false)
  })
  it('falls back to the crew, then to how long the job has been open, abbreviated', () => {
    expect(jobNextLine(base({ crew: crew({ onSiteToday: true, lastWorkYmd: '2026-09-23' }) })).line).toBe('Behar on site today · open 24 min')
    expect(jobNextLine(base({ crew: crew({ onSiteToday: true, lastWorkYmd: '2026-09-23' }) })).today).toBe(true)
    expect(jobNextLine(base()).line).toBe('open 24 min')
  })
  it('says nothing about a crew a Waiting job never had', () => {
    expect(jobNextLine(base({ stage: 'waiting', crew: crew({ lastWorkYmd: null, lastDayPeople: [] }) })).line).toBe('open 24 min')
  })
  it('marks today from a block today', () => {
    expect(jobNextLine(base({ upcoming: { ymd: '2026-09-23', timeStart: '06:00', timeEnd: '07:00', assigneeNames: [], note: null } })).today).toBe(true)
  })
})

describe('phoneRowPasses / abbreviateTimeSince / advanceConsequence', () => {
  it('filters on the kernel’s own flags', () => {
    const needs = jobNextLine(base({ contract: { kind: 'none' } }))
    const plain = jobNextLine(base())
    expect(phoneRowPasses(needs, 'needs')).toBe(true)
    expect(phoneRowPasses(plain, 'needs')).toBe(false)
    expect(phoneRowPasses(plain, 'all')).toBe(true)
  })
  it('abbreviates units', () => {
    expect(abbreviateTimeSince('24 minutes')).toBe('24 min')
    expect(abbreviateTimeSince('1 hour')).toBe('1 h')
    expect(abbreviateTimeSince('3 days')).toBe('3 d')
  })
  it('writes the consequence: the move, the money, the agreement, the schedule', () => {
    const c = advanceConsequence('working', {
      money: bar({ doneNotBilled: 600 }),
      contract: { kind: 'none' },
      upcoming: { ymd: '2026-09-24', timeStart: '13:00', timeEnd: '16:00', assigneeNames: ['Abraham'], note: null },
    })
    expect(c).toMatch(/^Working → Ready to bill · \$600 capable · no contract on file · Abraham's block .* stays on the schedule$/)
    expect(advanceConsequence('billed', { money: bar({ billedUnpaid: 1000 }), contract: undefined, upcoming: null })).toBe('Billed → Paid · $1,000 open')
    expect(advanceConsequence('waiting', { money: bar({ hasBar: false }), contract: null, upcoming: null })).toBe('Waiting → Working')
  })
})
