import { describe, expect, it } from 'vitest'

import { buildAxisCards, type RunScoreRow } from './confidenceBoard'
import type { RobotRowState } from './robotRowState'
import {
  axisByRobotBidNumber,
  buildJobTypeRows,
  buildLiveRuns,
  buildPracticeRuns,
  buildYourPart,
  deltaPhrase,
  jobTypeLabel,
  lessonLine,
  plainSlots,
  rankJobTypeRows,
  receiptSentence,
  receiptsByAxis,
  recentRuns,
  type JobTypeRow,
  type YourPartBid,
} from './robotScoreboard'
import type { ShadowRunRow } from './shadowStory'

const score = (o: Partial<RunScoreRow> & { id: string }): RunScoreRow => ({
  run_label: `BT-${o.id}`,
  kind: 'backtest',
  axis: 'small TI',
  project_name: 'AutoZone 1604',
  twin_bid_number: null,
  reference_bid_number: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  counts_note: null,
  scope_verdict: null,
  gate_eligible: true,
  note: null,
  scored_at: '2026-09-01T00:00:00Z',
  ...o,
})

const shadow = (o: Partial<ShadowRunRow> & { id: string }): ShadowRunRow => ({
  status: 'locked',
  axis: null,
  created_at: '2026-09-06T10:00:00Z',
  locked_at: '2026-09-06T11:00:00Z',
  scored_at: null,
  shadow_bid_number: '481',
  reference_bid_number: '385',
  project_name: 'Galloway Park Concession Stand Burnet',
  requested_by_name: null,
  reference_sent_at: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  ...o,
})

describe('words', () => {
  it('names axes the way an estimator would, and tidies unknown slugs', () => {
    expect(jobTypeLabel('mid-size TI (fitness)')).toBe('Fitness club finish-out')
    expect(jobTypeLabel('proto/auto-service')).toBe('Auto-service prototype')
    expect(jobTypeLabel('car-wash/express')).toBe('Car wash express')
    expect(jobTypeLabel(null)).toBe('Unsorted')
  })

  it('phrases deltas as high / low, and multiples past 100%', () => {
    expect(deltaPhrase(44.2)).toBe('44% high')
    expect(deltaPhrase(-1.2)).toBe('1% low')
    expect(deltaPhrase(-7.9)).toBe('8% low')
    expect(deltaPhrase(413)).toBe('5.1× high')
    expect(deltaPhrase(127)).toBe('2.3× high')
    expect(deltaPhrase(0.2)).toBe('on the nose')
    expect(deltaPhrase(null)).toBe('—')
  })

  it('strips the robot prefix from a receipt and cuts at a sentence', () => {
    expect(receiptSentence('🤖 Learned: the book now carries the institutional uplift.')).toBe('The book now carries the institutional uplift.')
    const long = 'Learned: first sentence is short. ' + 'x'.repeat(200)
    expect(receiptSentence(long)).toBe('First sentence is short.')
  })
})

describe('job types', () => {
  const scores = [
    score({ id: 'a', axis: 'institutional', delta_pct: -57.5, scored_at: '2026-08-31T01:00:00Z' }),
    score({ id: 'b', axis: 'institutional', delta_pct: 127, scored_at: '2026-09-05T01:00:00Z', note: 'x1.8 institutional uplift was the miss' }),
    score({ id: 'c', axis: 'mid-size TI (fitness)', delta_pct: -10.8, scored_at: '2026-09-04T01:00:00Z' }),
    score({ id: 'd', axis: 'mid-size TI (fitness)', delta_pct: -1.2, scored_at: '2026-09-05T02:00:00Z' }),
  ]
  const shadows = [shadow({ id: 's1', axis: 'bank-branch', shadow_bid_number: '420', reference_bid_number: '391', reference_sent_at: '2026-09-01T00:00:00Z' })]
  const cards = buildAxisCards(scores, shadows)

  it('re-labels the five slots in plain words and keeps sealed runs as pending', () => {
    const fitness = cards.find((c) => c.axis === 'mid-size TI (fitness)')!
    expect(plainSlots(fitness).map((s) => s.label)).toEqual(['11% low', '1% low', '·', '·', '·'])
    expect(plainSlots(fitness).map((s) => s.state)).toEqual(['out', 'in', 'empty', 'empty', 'empty'])
    const bank = cards.find((c) => c.axis === 'bank-branch')!
    expect(plainSlots(bank)[0]).toMatchObject({ state: 'pending', label: 'b420 🔒' })
  })

  it('ranks closest to ready first: streaks, then waiting, then blocked', () => {
    const rows = buildJobTypeRows(cards, shadows)
    expect(rows.map((r) => r.label)).toEqual(['Fitness club finish-out', 'Bank branch', 'Schools & libraries'])
    expect(rows[0]!.statusText).toBe('1 of 5 in a row')
    expect(rows[1]!.statusText).toBe('Waiting on a score')
    expect(rows[2]!.statusText).toBe('Needs a fix first')
  })

  it('writes the lesson from the receipt when one exists, else from what the axis waits on', () => {
    const inst = cards.find((c) => c.axis === 'institutional')!
    expect(lessonLine(inst, { body: '🤖 Learned: county libraries carry the institutional uplift.', auditor: 'Wendi', createdAt: null }, shadows)).toBe(
      'County libraries carry the institutional uplift. After Wendi’s audit.',
    )
    expect(lessonLine(inst, null, shadows)).toMatch(/^The last run was off/)
    const bank = cards.find((c) => c.axis === 'bank-branch')!
    expect(lessonLine(bank, null, shadows)).toBe('Sealed on b420. Scores once b391 has a bid value.')
    const fitness = cards.find((c) => c.axis === 'mid-size TI (fitness)')!
    expect(lessonLine(fitness, null, shadows)).toBe('Nothing to fix right now. 4 more close runs to go.')
  })

  it('keeps the operator note aside as rawNote, never in the lesson', () => {
    const rows = buildJobTypeRows(cards, shadows)
    const inst = rows.find((r) => r.axis === 'institutional')!
    expect(inst.rawNote).toContain('x1.8 institutional uplift')
    expect(inst.lesson).not.toContain('x1.8')
  })

  it('ranking is stable on ties by scored count then name', () => {
    const mk = (label: string, tone: JobTypeRow['tone'], streak: number, scoredCount: number): JobTypeRow => ({
      axis: label, label, tone, statusText: '', streak, scoredCount, inFlight: 0, slots: [], lesson: '', rawNote: '',
    })
    const ranked = rankJobTypeRows([mk('b', 'progress', 0, 1), mk('a', 'progress', 0, 3), mk('c', 'ready', 5, 5), mk('d', 'awaiting', 0, 0)])
    expect(ranked.map((r) => r.label)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('matches receipts to axes through the robot bid number', () => {
    const axisOf = axisByRobotBidNumber(
      [score({ id: 'x', axis: 'small TI', twin_bid_number: 'b415' })],
      [shadow({ id: 's', axis: 'bank-branch', shadow_bid_number: '420' })],
    )
    expect(axisOf.get('415')).toBe('small TI')
    expect(axisOf.get('420')).toBe('bank-branch')
    const byAxis = receiptsByAxis(
      [
        { bid_id: 'twin-415', body: 'older', created_at: '2026-09-01T00:00:00Z', auditor: 'Wendi' },
        { bid_id: 'twin-415', body: '🤖 Learned: newer', created_at: '2026-09-05T00:00:00Z', auditor: null },
        { bid_id: 'unknown', body: 'orphan', created_at: '2026-09-06T00:00:00Z', auditor: null },
      ],
      new Map([['twin-415', '415']]),
      axisOf,
    )
    expect(byAxis.get('small TI')?.body).toBe('🤖 Learned: newer')
    expect(byAxis.size).toBe(1)
  })
})

describe('recent runs', () => {
  it('takes the newest scored runs that count, shadows included, practice teachers excluded', () => {
    const runs = recentRuns(
      [
        score({ id: 'a', delta_pct: -17, scored_at: '2026-09-05T01:00:00Z' }),
        score({ id: 'b', delta_pct: 59.9, scored_at: '2026-09-04T01:00:00Z', teacher_user_id: 'malachi' }),
        score({ id: 'v', delta_pct: -28, scored_at: '2026-09-06T01:00:00Z', gate_eligible: false }),
      ],
      [shadow({ id: 's', status: 'scored', delta_pct: 44.2, scored_at: '2026-09-07T01:00:00Z', shadow_bid_number: '418', teacher_standard: true })],
      new Set(['wendi']),
    )
    expect(runs.map((r) => r.label)).toEqual(['b418', 'BT-a'])
    expect(runs[0]).toMatchObject({ delta: 44.2, within: false })
  })
})

describe('your part', () => {
  const bid = (o: Partial<YourPartBid> & { id: string }): YourPartBid => ({
    bid_number: o.id.replace(/\D/g, ''),
    project_name: 'Project',
    bid_date_sent: null,
    outcome: null,
    estimator_id: null,
    ...o,
  })
  const stateFor = (states: Record<string, RobotRowState>) => (b: YourPartBid): RobotRowState => states[b.id] ?? { kind: 'queued', title: '' }

  it('leads with the viewer’s sealed bids, then queued, then what the robots can’t see, then what waits on anyone', () => {
    const bids = [
      bid({ id: 'b385', project_name: 'Galloway Park', estimator_id: 'grace' }),
      bid({ id: 'b391', project_name: 'RBFCU Potranco', estimator_id: 'grace', bid_date_sent: '2026-09-01' }),
      bid({ id: 'b483', project_name: 'Laynes Chicken Fingers', estimator_id: 'grace' }),
      bid({ id: 'b380', project_name: 'Medina Valley ISD', estimator_id: 'wendi' }),
      bid({ id: 'b431', project_name: 'Palmer Winery', estimator_id: 'wendi' }),
    ]
    const lines = buildYourPart({
      viewerId: 'grace',
      bids,
      stateFor: stateFor({
        b385: { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: '481' },
        b391: { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: '420' },
        b483: { kind: 'queued', title: '' },
        b380: { kind: 'needs', badge: '?', title: '', questions: 0, gaps: [{ key: 'plans', label: 'No plans link', fix: '', required: true }] },
        b431: { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: '482' },
      }),
      auditsPending: 30,
      questionsWaiting: 1,
      coverage: { covered: 2, live: 21 },
    })
    expect(lines.map((l) => l.key)).toEqual(['sealed', 'queued', 'cant-see', 'waiting', 'coverage'])
    expect(lines[0]!.text).toBe('The robot has sealed numbers on 2 of your bids.')
    expect(lines[0]!.detail).toBe('b385 Galloway Park scores the day you send it. b391 RBFCU Potranco scores once it has a bid value.')
    expect(lines[0]!.doors.map((d) => d.label)).toEqual(['Open b385', 'Open b391'])
    expect(lines[1]!.text).toBe('b483 Laynes Chicken Fingers is queued for the next weekday batch.')
    expect(lines[2]!.text).toBe('Robots can’t see 1 live bid.')
    expect(lines[2]!.detail).toMatch(/^It has no plans link\./)
    expect(lines[2]!.doors[0]).toMatchObject({ kind: 'bid-board' })
    expect(lines[3]!.text).toBe('30 audits and 1 question are waiting on anyone.')
    expect(lines[3]!.doors[0]).toMatchObject({ kind: 'audits', primary: true })
    expect(lines[4]!.text).toBe('Robots are shadowing 2 of 21 live bids with plans.')
  })

  it('falls back to the office’s sealed bids when the viewer has none, and counts a scored run against their number', () => {
    const bids = [
      bid({ id: 'b431', project_name: 'Palmer Winery', estimator_id: 'wendi' }),
      bid({ id: 'b166', project_name: 'Take 5 Brownsville', estimator_id: 'robert', bid_date_sent: '2026-09-02' }),
    ]
    const lines = buildYourPart({
      viewerId: 'robert',
      bids,
      stateFor: stateFor({
        b431: { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: '482' },
        b166: { kind: 'scored', title: '', deltaPct: 44.2, twinBidNumber: '418' },
      }),
      auditsPending: 0,
      questionsWaiting: 0,
      coverage: null,
    })
    expect(lines.map((l) => l.key)).toEqual(['sealed', 'scored'])
    expect(lines[0]!.text).toBe('The robot has a sealed number on 1 live bid.')
    expect(lines[1]!.text).toBe('The robot was 44% high on b166 Take 5 Brownsville.')
    expect(lines[1]!.doors[0]).toMatchObject({ label: 'Compare b166', kind: 'bid' })
  })

  it('points the viewer at their own unreadable bids', () => {
    const lines = buildYourPart({
      viewerId: 'grace',
      bids: [bid({ id: 'b500', project_name: 'Mine', estimator_id: 'grace' }), bid({ id: 'b501', project_name: 'Theirs', estimator_id: 'wendi' })],
      stateFor: () => ({ kind: 'needs', badge: '?', title: '', questions: 0, gaps: [{ key: 'plans-unreadable', label: 'Plans aren’t shared with the robots', fix: '', required: true }] }),
      auditsPending: 0,
      questionsWaiting: 0,
      coverage: null,
    })
    expect(lines[0]!.text).toBe('Robots can’t see 2 live bids.')
    expect(lines[0]!.detail).toBe('Both have plans aren’t shared with the robots. 1 is yours. The robot needs sheet on each row says what to attach.')
    expect(lines[0]!.doors).toEqual([{ label: 'Fix b500', kind: 'bid', bidId: 'b500' }])
  })
})

describe('runs', () => {
  it('orders live runs in flight first, then scored, voided last, and says whose send it waits on', () => {
    const bids: YourPartBid[] = [{ id: 'x', bid_number: '385', project_name: 'Galloway', bid_date_sent: null, outcome: null, estimator_id: 'grace' }]
    const rows = buildLiveRuns(
      [
        shadow({ id: 'scored', status: 'scored', shadow_bid_number: '418', reference_bid_number: '166', project_name: 'Take 5 Brownsville', locked_total: 72854, reference_value: 50528, delta_pct: 44.2, scored_at: '2026-09-07T00:00:00Z', teacher_name: 'Wendi', teacher_standard: true }),
        shadow({ id: 'void', status: 'void', shadow_bid_number: '480', reference_bid_number: '378', project_name: 'SpaceX', created_at: '2026-09-07T11:00:00Z' }),
        shadow({ id: 'sealed', created_at: '2026-09-06T10:00:00Z' }),
        shadow({ id: 'sent', status: 'locked', shadow_bid_number: '420', reference_bid_number: '391', project_name: 'RBFCU', reference_sent_at: '2026-09-01T00:00:00Z', created_at: '2026-08-31T00:00:00Z' }),
      ],
      bids,
      'grace',
    )
    expect(rows.map((r) => r.key)).toEqual(['sealed', 'sent', 'scored', 'void'])
    expect(rows[0]!.line).toBe('sealed · waiting on you to send b385')
    expect(rows[1]!.line).toBe('sealed · scores once b391 has a bid value')
    expect(rows[2]).toMatchObject({ line: 'robot $72,854, ours $50,528 · against Wendi’s number', deltaText: '44% high', counts: true })
    expect(rows[3]).toMatchObject({ phase: 'void', deltaText: 'voided' })
    expect(rows[0]!.steps).toHaveLength(5)
  })

  it('keeps voided practice runs, marked, with the operator’s note', () => {
    const rows = buildPracticeRuns(
      [
        score({ id: 'ok', run_label: 'R2-BT-29', delta_pct: -1.2, locked_total: 277273, reference_value: 280611, scored_at: '2026-09-05T00:00:00Z', teacher_user_id: 'wendi' }),
        score({ id: 'void', run_label: 'R2-BT-27', delta_pct: 22.2, gate_eligible: false, note: 'reference carries zero count rows', scored_at: '2026-09-06T00:00:00Z' }),
      ],
      new Set(['wendi']),
    )
    expect(rows.map((r) => r.label)).toEqual(['R2-BT-27', 'R2-BT-29'])
    expect(rows[0]).toMatchObject({ voided: true, deltaText: 'voided', note: 'reference carries zero count rows', counts: false })
    expect(rows[1]).toMatchObject({ voided: false, deltaText: '1% low', robot: '$277,273', ours: '$280,611', counts: true })
  })
})
