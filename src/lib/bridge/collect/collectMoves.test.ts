import { describe, expect, it } from 'vitest'
import type { LienArChip } from '../../jobs/lienArChip'
import type { PaySpeedData } from '../../jobs/billedExpectedPay'
import type { ChaseTouch } from '../../jobs/paymentChase'
import { plainWordsFailures } from '../../plainWords'
import { buildCollectPile, type CollectBill } from './collectPile'
import { buildCollectPayers } from './collectPayers'
import { buildCollectSheet, collectMoveFor, collectSheetAsCallMoves, collectSheetText } from './collectMoves'
import { collectDecisions } from './collectDecisions'
import { collectWhatIf } from './collectWhatIf'

const TODAY = '2026-10-25'
const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const plain = (s: string | null) => s != null && expect(plainWordsFailures(s.replace(/^Say: /, '')), s).toEqual([])
const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { rmc: { medianDays: 35, samples: 4 }, harper: { medianDays: 74, samples: 1 }, handi: { medianDays: 6, samples: 10 }, knight: { medianDays: 30, samples: 31 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { structura: 'commercial', rmc: 'commercial', southern: 'commercial', harper: 'commercial', handi: 'commercial', knight: 'commercial' },
  receipts: {},
  quality: null,
}
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
const bills: CollectBill[] = [
  bill('spacex', 'structura', 'Structura, Inc. – Austin', '2026-09-24', 103_386, { sentFromHere: false }),
  ...[13_420, 9_800, 8_780, 7_902, 3_500, 3_500, 2_650, 2_245].map((usd, i) => bill(`rmc-${i}`, 'rmc', 'RMC- Dudley Mason', i === 0 ? '2026-03-16' : '2026-08-18', usd, i === 2 ? { billedYmd: '2026-09-21', sentFromHere: false } : {})),
  bill('sp', 'southern', 'Southern Post Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('tfh', 'harper', 'TF Harper', '2026-09-16', 29_323, { sentFromHere: false }),
  bill('tfh2', 'harper', 'TF Harper', '2026-07-06', 2_918),
  bill('hi', 'handi', 'H & I Construction', '2026-10-23', 14_220),
  bill('hi2', 'handi', 'H & I Construction', '2026-09-03', 350),
  bill('kn', 'knight', 'Knight Contracting', '2026-09-20', 4_087),
  bill('kn2', 'knight', 'Knight Contracting', '2026-09-01', 2_000),
]
const touches: ChaseTouch[] = [{ id: 't1', customerId: 'knight', jobId: 'j-kn', outcome: 'dispute', note: 'the trip charge is not ours', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-10-22T15:00:00Z', createdByName: 'Taunya' }]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-sp': { promisedYmd: '2026-10-16', markedByName: 'Taunya' } }, payAppJobIds: new Set(), gcPayerIds: new Set(['rmc', 'harper', 'knight', 'southern']), gcPaceFromIds: new Set(['rmc', 'harper', 'knight']), todayYmd: TODAY })
const cut = buildCollectPayers(pile, { touches })
const payer = (name: string) => cut.payers.find((p) => p.payerName === name)!
const lienHref = (door: LienArChip['door']) => `/lien?${'jobId' in door ? door.jobId : ''}`
const chip = (over: Partial<LienArChip>): LienArChip => ({ tone: 'amber', state: 'due', paper: 'notice', words: 'Notice by Nov 16 · 22d', sentence: 'August, to the owner.', title: '', door: { to: 'desk', jobId: 'j-tfh', kind: 'notice', pile: null }, dueOn: '2026-11-16', daysLeft: 22, ...over })

describe('collectMoveFor (v2.5854)', () => {
  const opts = { todayYmd: TODAY, dayLabel: md, lienHref }
  it('calls a broken promise first, in its own words', () => {
    const m = collectMoveFor(payer('Southern Post Construction'), opts)
    expect(m).toMatchObject({ kind: 'call_promise', title: 'Call: the Oct 16 promise', isCall: true, askUsd: 38_625, owner: '' })
    expect(m.opener).toBe('Say: the $38.6k promised for Oct 16 has not landed. What happened, and what is the new date?')
    plain(m.opener)
  })
  it('asks a GC for the pay date on a hand-marked bill, before or after it is due', () => {
    const s = collectMoveFor(payer('Structura, Inc. – Austin'), opts)
    expect(s.kind).toBe(s.title === 'Call for the pay date' ? 'call_date' : 'call_payapp')
    expect(s.opener).toBe('Say: the pay application for $103k, marked billed here Sep 24. When did it go in, is it approved, and which pay run is it on?')
    plain(s.opener)
    const h = collectMoveFor(payer('TF Harper'), { ...opts, chip: chip({}) })
    expect(h).toMatchObject({ kind: 'call_date', title: 'Call for the pay date', paper: { label: 'Notice by Nov 16 · 22d', href: '/lien?j-tfh' } })
    const due = collectMoveFor({ ...payer('TF Harper'), bills: payer('TF Harper').bills.map((b) => (b.key === 'tfh' ? { ...b, state: 'late' as const } : b)) }, opts)
    expect(due).toMatchObject({ kind: 'call_payapp', title: 'Call: is the pay app approved?' })
    plain(h.opener)
  })
  it('sends a statement before the call on an account with many bills', () => {
    const m = collectMoveFor(payer('RMC- Dudley Mason'), opts)
    expect(m).toMatchObject({ kind: 'statement_call', title: 'Send the statement, then call', isCall: true, askUsd: payer('RMC- Dudley Mason').usd })
    expect(m.opener).toBe('Say: 8 open bills, $51.8k, the oldest from March. Which can you pay this week, and when?')
    plain(m.opener)
  })
  it('asks about the one late bill on an account that pays on time', () => {
    const m = collectMoveFor(payer('H & I Construction'), opts)
    expect(m).toMatchObject({ kind: 'ask_one', title: 'Ask about the $350', isCall: true, askUsd: 350 })
    expect(m.opener).toBe('Say: the $350 from Sep 3 is 9 times your usual pace. Is something wrong with it?')
    plain(m.opener)
  })
  it('sends a statement alone on a small account, and reads the owner from the recorded plan', () => {
    const m = collectMoveFor(payer('Knight Contracting'), { ...opts, smallUsd: 10_000, recordedMoves: [{ key: 'chase', title: 'Send the statement', who: 'Taunya · Tue', then: 6_087 }] })
    expect(m).toMatchObject({ kind: 'statement', title: 'Send the statement', opener: null, isCall: false, owner: 'Taunya · Tue' })
  })
  it('builds the sheet: calls, statements, the ask, the money that pays itself; the call moves; the text', () => {
    const sheet = buildCollectSheet(cut, (p) => collectMoveFor(p, opts))
    // The cut is four payers here: Structura, RMC, Southern Post and TF Harper hold over nine tenths.
    expect(sheet.rows.map((r) => r.move.kind)).toEqual(['call_date', 'statement_call', 'call_promise', 'call_date'])
    expect(sheet.calls).toBe(4)
    expect(sheet.statements).toBe(0)
    expect(sheet.askUsd).toBe(sheet.rows.reduce((s, r) => s + r.move.askUsd, 0))
    // Structura's $103k is not yet due on an account with nothing late: it pays itself.
    expect(sheet.paysItselfUsd).toBe(103_386)
    const moves = collectSheetAsCallMoves(sheet, new Map([['structura', 'Taunya · Mon']]))
    expect(moves[0]).toMatchObject({ key: 'chase', title: `Structura, Inc. – Austin: ${sheet.rows[0]!.move.title}`, who: 'Taunya · Mon', then: sheet.rows[0]!.move.askUsd })
    const text = collectSheetText(sheet, 'The Collect desk, Sun, Oct 25')
    expect(text.split('\n')[0]).toBe('The Collect desk, Sun, Oct 25')
    expect(text).toContain('Southern Post Construction · $38.6k · Call: the Oct 16 promise')
    expect(text.trim().endsWith(`4 moves, $${Math.round(sheet.askUsd / 1000)}k asked for.`)).toBe(true)
  })
})

describe('collectDecisions (v2.5854)', () => {
  const opts = { chipFor: (p: { payerName: string }) => (p.payerName === 'RMC- Dudley Mason' ? chip({ paper: 'affidavit', words: 'Affidavit by Nov 16', sentence: 'Noticed Sep 22, three jobs.', dueOn: '2026-11-16', door: { to: 'desk', jobId: 'j-rmc-0', kind: 'affidavit', pile: null } }) : null), lienHref, customerHref: (id: string) => `/customers/${id}`, jobsHref: '/jobs?tab=stages', dayLabel: md }
  it('lifts the GC record, the affidavit, the slow payer and the dispute into the owner’s strip, money first, three at most', () => {
    const d = collectDecisions(cut, opts)
    expect(d.map((x) => x.kind)).toEqual(['gc_record', 'affidavit', 'terms'])
    expect(d[0]).toMatchObject({ head: 'Put Structura, Inc. – Austin on the job as the GC.', door: { href: '/jobs?tab=stages' }, usd: 103_386 })
    expect(d[1]).toMatchObject({ head: 'File the RMC- Dudley Mason lien by Nov 16.', door: { href: '/lien?j-rmc-0' } })
    expect(d[2]).toMatchObject({ head: 'Terms for TF Harper on the next bid.', door: { href: '/customers/harper' } })
    for (const x of d) {
      plain(x.head)
      plain(x.words)
    }
    const all = collectDecisions(cut, { ...opts, max: 10 })
    expect(all.map((x) => x.kind)).toContain('dispute')
    expect(all.find((x) => x.kind === 'dispute')!.words).toContain('Their words: the trip charge is not ours')
  })
})

describe('collectWhatIf (v2.5854)', () => {
  it('lands half the ask in three weeks on top of today’s pace, with the pile still growing on billing', () => {
    const w = collectWhatIf({ headlineUsd: 297_000, askUsd: 260_000, paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800, windowWeeks: 8, buildWeeks: 5.2 })
    expect(w.pileThenUsd).toBeCloseTo(297_000 + 3 * 27_600 - 130_000, 6)
    expect(w.paceThenUsd).toBeCloseTo(29_200 + 130_000 / 8, 6)
    expect(w.value).toBe('10.2 → about 5.5 weeks')
    expect(w.linkThen).toBe('pair')
    expect(w.words).toContain('Collect and Build then read as a pair, 5.5 and 5.2 weeks.')
    expect(w.leftAlone.usd).toBeCloseTo(297_000 + 12 * 27_600, 6)
    plain(w.words)
    plain(w.leftAlone.words)
    const strong = collectWhatIf({ headlineUsd: 297_000, askUsd: 260_000, paidPerWeekUsd: 29_200, billedPerWeekUsd: 30_000, windowWeeks: 8, buildWeeks: 5.2 })
    expect(strong.linkThen).toBe('build')
    const none = collectWhatIf({ headlineUsd: 297_000, askUsd: 0, paidPerWeekUsd: 0, billedPerWeekUsd: 0, windowWeeks: 8, buildWeeks: null })
    expect(none.value).toBe('no pace to read')
  })
})
