import { describe, expect, it } from 'vitest'
import { backtestLabel, buildRobotMirror, mirrorAuditChip, mirrorRunReviewable, mirrorStatusLabel, type MirrorBid, type MirrorShell } from './robotMirror'
import type { ShadowRunRow } from './shadowStory'
import type { RunScoreRow } from './confidenceBoard'

const human = (over: Partial<MirrorBid> & { id: string; bid_number: string }): MirrorBid => ({
  project_name: `Project ${over.bid_number}`,
  outcome: null,
  bid_date_sent: null,
  bid_value: null,
  plans_link: 'https://drive/x',
  ...over,
})

const shell = (over: Partial<MirrorShell> & { id: string; bid_number: string }): MirrorShell => ({
  project_name: `ZZ Shadow ${over.bid_number}`,
  twin_source_bid_id: null,
  ...over,
})

const run = (over: Partial<ShadowRunRow> & { shadow_bid_number: string; reference_bid_number: string; status: string }): ShadowRunRow => ({
  id: `run-${over.shadow_bid_number}`,
  axis: null,
  created_at: '2026-09-07T10:00:00Z',
  locked_at: null,
  scored_at: null,
  project_name: null,
  requested_by_name: null,
  reference_sent_at: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  ...over,
})

const score = (over: Partial<RunScoreRow> & { run_label: string; reference_bid_number: string }): RunScoreRow => ({
  id: `score-${over.run_label}`,
  kind: 'backtest',
  axis: null,
  project_name: null,
  twin_bid_number: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  counts_note: null,
  scope_verdict: null,
  gate_eligible: true,
  note: null,
  scored_at: '2026-09-05T10:00:00Z',
  ...over,
})

describe('buildRobotMirror', () => {
  it('a sealed shadow on a live bid lands in Unsent with status only — no money before send', () => {
    const b431 = human({ id: 'h431', bid_number: '431', robot_requested_at: null })
    const s482 = shell({ id: 's482', bid_number: '482', twin_source_bid_id: 'h431' })
    const m = buildRobotMirror({
      humanBids: [b431],
      shells: [s482],
      shadowRuns: [run({ shadow_bid_number: '482', reference_bid_number: '431', status: 'locked', locked_at: '2026-09-07T12:00:00Z' })],
      scores: [],
      audits: [{ id: 'a1', bid_id: 's482', status: 'pending', requested_at: '2026-09-07T13:00:00Z' }],
    })
    expect(m.rowCount).toBe(1)
    const row = m.sections.unsent[0]
    expect(row?.latest.status).toBe('sealed')
    expect(row?.latest.robotTotal).toBeNull()
    expect(row?.latest.deltaPct).toBeNull()
    expect(row?.latest.label).toBe('shadow b482')
    expect(mirrorAuditChip(row!.latest)).toEqual({ text: 'review at send', tone: 'seal' })
    expect(mirrorStatusLabel(row!.latest).sub).toBe('opens when we send')
  })

  it('a scored shadow on a sent bid shows the robot number, ours, and the delta in Not yet won or lost', () => {
    const b397 = human({ id: 'h397', bid_number: '397', bid_date_sent: '2026-09-08', bid_value: 50528 })
    const s418 = shell({ id: 's418', bid_number: '418', twin_source_bid_id: null })
    const m = buildRobotMirror({
      humanBids: [b397],
      shells: [s418],
      shadowRuns: [
        run({ shadow_bid_number: '418', reference_bid_number: '397', status: 'scored', scored_at: '2026-09-08T15:00:00Z', locked_total: 72854, reference_value: 50528, delta_pct: 44.2, teacher_name: 'Wendi', teacher_standard: true }),
      ],
      scores: [],
      audits: [{ id: 'a2', bid_id: 's418', status: 'pending', requested_at: '2026-08-31T15:00:00Z' }],
    })
    const row = m.sections.pending[0]
    expect(row?.latest).toMatchObject({ status: 'scored', robotTotal: 72854, ourValue: 50528, deltaPct: 44.2, shellBidId: 's418', practice: false })
    expect(mirrorAuditChip(row!.latest)).toEqual({ text: 'audit waiting', tone: 'audit' })
  })

  it('pairs a pre-stamp shadow through the run\'s reference number when twin_source_bid_id is null', () => {
    const b396 = human({ id: 'h396', bid_number: '396', bid_date_sent: '2026-09-08', bid_value: null })
    const s419 = shell({ id: 's419', bid_number: '419' })
    const m = buildRobotMirror({
      humanBids: [b396],
      shells: [s419],
      shadowRuns: [run({ shadow_bid_number: '419', reference_bid_number: '396', status: 'locked', reference_sent_at: '2026-09-08' })],
      scores: [],
      audits: [],
    })
    const row = m.sections.pending[0]
    expect(row?.latest.status).toBe('sealed')
    expect(row?.note).toBe('no bid value on record')
    expect(m.orphanShells).toEqual([])
  })

  it('two backtest rounds on one decided bid: the newest leads, the earlier folds behind it', () => {
    const b201 = human({ id: 'h201', bid_number: '201', outcome: 'lost', bid_date_sent: '2026-04-24', bid_value: 180357 })
    const r1 = shell({ id: 's422', bid_number: '422', project_name: 'ZZ Twin AISD GARCIA (backtest)', twin_source_bid_id: 'h201' })
    const r2 = shell({ id: 's471', bid_number: '471', project_name: 'ZZ Twin AISD GARCIA (backtest R2)', twin_source_bid_id: 'h201' })
    const m = buildRobotMirror({
      humanBids: [b201],
      shells: [r1, r2],
      shadowRuns: [],
      scores: [
        score({ run_label: 'BT-16', reference_bid_number: '201', twin_bid_number: '422', delta_pct: -57.5, scored_at: '2026-09-01T10:00:00Z', locked_total: 76700, reference_value: 180357 }),
        score({ run_label: 'R2-BT-25', reference_bid_number: '201', twin_bid_number: '471', delta_pct: 127.0, scored_at: '2026-09-05T10:00:00Z', locked_total: 409385, reference_value: 180357 }),
      ],
      audits: [{ id: 'a3', bid_id: 's471', status: 'pending', requested_at: '2026-09-05T13:00:00Z' }],
    })
    expect(m.rowCount).toBe(1)
    const row = m.sections.lost[0]
    expect(row?.latest).toMatchObject({ label: 'backtest R2', deltaPct: 127, shellBidId: 's471' })
    expect(row?.earlier.map((r) => [r.label, r.deltaPct])).toEqual([['backtest', -57.5]])
  })

  it('a seeded score with no shell still mirrors onto the human bid by reference number', () => {
    const b269 = human({ id: 'h269', bid_number: '269', outcome: 'lost', bid_date_sent: '2026-05-21', bid_value: 210789 })
    const m = buildRobotMirror({
      humanBids: [b269],
      shells: [],
      shadowRuns: [],
      scores: [score({ run_label: 'BT-6', reference_bid_number: '269', delta_pct: -17.0, locked_total: 174930, reference_value: 210789 })],
      audits: [],
    })
    expect(m.sections.lost[0]?.latest).toMatchObject({ kind: 'backtest', label: 'backtest BT-6', shellBidId: null, deltaPct: -17 })
  })

  it('a practice-teacher backtest is marked practice when the standard set is known', () => {
    const b67 = human({ id: 'h67', bid_number: '67', outcome: 'won', bid_date_sent: '2026-01-05', bid_value: 32600 })
    const m = buildRobotMirror({
      humanBids: [b67],
      shells: [],
      shadowRuns: [],
      scores: [score({ run_label: 'BT-12', reference_bid_number: '67', delta_pct: -2.6, teacher_user_id: 'malachi', teacher_name: 'Malachi' })],
      audits: [],
      standardTeacherIds: new Set(['wendi']),
    })
    const latest = m.sections.won[0]!.latest
    expect(latest.practice).toBe(true)
    expect(mirrorAuditChip(latest)).toEqual({ text: 'practice teacher', tone: 'practice' })
  })

  it('a shell with no run yet reads working, carries its audit, and never leaks a number', () => {
    const b376 = human({ id: 'h376', bid_number: '376', bid_date_sent: '2026-08-18', bid_value: 346881 })
    const s476 = shell({ id: 's476', bid_number: '476', project_name: 'ZZ Twin CASA LINDA (backtest R2)', twin_source_bid_id: 'h376' })
    const m = buildRobotMirror({ humanBids: [b376], shells: [s476], shadowRuns: [], scores: [], audits: [{ id: 'a4', bid_id: 's476', status: 'pending', requested_at: '2026-09-05T20:00:00Z' }] })
    expect(m.sections.pending[0]?.latest).toMatchObject({ status: 'working', label: 'backtest R2', robotTotal: null, audit: { id: 'a4', status: 'pending' } })
    expect(mirrorRunReviewable(m.sections.pending[0]!.latest)).toBe(false)
  })

  it('an audited shell with a priced draft and no score row reads audited with the draft total — on a sent bid only', () => {
    const sent = human({ id: 'h166', bid_number: '166', outcome: 'won', bid_date_sent: '2026-04-21', bid_value: 38000 })
    const live = human({ id: 'h900', bid_number: '900' })
    const s425 = shell({ id: 's425', bid_number: '425', project_name: 'ZZ Twin SEGUIN (backtest)', twin_source_bid_id: 'h166' })
    const s901 = shell({ id: 's901', bid_number: '901', twin_source_bid_id: 'h900' })
    const audits = [
      { id: 'a5', bid_id: 's425', status: 'pending', requested_at: '2026-08-31T22:00:00Z' },
      { id: 'a6', bid_id: 's901', status: 'pending', requested_at: '2026-09-09T22:00:00Z' },
    ]
    const draftTotals = new Map([
      ['s425', { total: 27030, rowCount: 40 }],
      ['s901', { total: 99999, rowCount: 12 }],
    ])
    const m = buildRobotMirror({ humanBids: [sent, live], shells: [s425, s901], shadowRuns: [], scores: [], audits, draftTotals })
    const won = m.sections.won[0]!.latest
    expect(won).toMatchObject({ status: 'audited', robotTotal: 27030, ourValue: 38000, deltaPct: -28.9 })
    expect(mirrorRunReviewable(won)).toBe(true)
    expect(mirrorAuditChip(won)).toEqual({ text: 'audit waiting', tone: 'audit' })
    expect(mirrorStatusLabel(won).sub).toBe('draft total · not scored on the ledger')
    // The live bid's shell keeps its seal: status only, no draft, whatever the audit holds.
    expect(m.sections.unsent[0]!.latest).toMatchObject({ status: 'working', robotTotal: null, deltaPct: null })
  })

  it('a voided shadow reads voided; a queued live bid reads queued; orphan shells are listed', () => {
    const b378 = human({ id: 'h378', bid_number: '378' })
    const b483 = human({ id: 'h483', bid_number: '483', robot_requested_at: '2026-09-09T10:00:00Z' })
    const s480 = shell({ id: 's480', bid_number: '480', twin_source_bid_id: 'h378' })
    const test = shell({ id: 's399', bid_number: '399', project_name: 'ZZ Twin Test 1' })
    const m = buildRobotMirror({
      humanBids: [b378, b483],
      shells: [s480, test],
      shadowRuns: [run({ shadow_bid_number: '480', reference_bid_number: '378', status: 'void' })],
      scores: [],
      audits: [],
    })
    const byId = Object.fromEntries(m.sections.unsent.map((r) => [r.bid.id, r.latest.status]))
    expect(byId).toEqual({ h378: 'void', h483: 'queued' })
    expect(mirrorAuditChip(m.sections.unsent.find((r) => r.bid.id === 'h378')!.latest)).toEqual({ text: 'void', tone: 'void' })
    expect(m.orphanShells.map((s) => s.bid_number)).toEqual(['399'])
  })

  it('counts the live bids no robot has touched, plumbing-eligible only', () => {
    const covered = human({ id: 'h1', bid_number: '1' })
    const uncovered = human({ id: 'h2', bid_number: '2' })
    const noPlans = human({ id: 'h3', bid_number: '3', plans_link: null })
    const optedOut = human({ id: 'h4', bid_number: '4', robot_opt_out: true })
    const m = buildRobotMirror({
      humanBids: [covered, uncovered, noPlans, optedOut],
      shells: [],
      shadowRuns: [run({ shadow_bid_number: '900', reference_bid_number: '1', status: 'locked' })],
      scores: [],
      audits: [],
    })
    expect(m.liveEligible).toBe(2)
    expect(m.uncoveredLive).toBe(1)
    expect(m.rowCount).toBe(1)
  })
})

describe('backtestLabel', () => {
  it('reads the round off the shell name, else the run label', () => {
    expect(backtestLabel('ZZ Twin X (backtest R2)')).toBe('backtest R2')
    expect(backtestLabel('ZZ Twin X (backtest)')).toBe('backtest')
    expect(backtestLabel(null, 'BT-9')).toBe('backtest BT-9')
    expect(backtestLabel(null, null)).toBe('backtest')
  })
})
