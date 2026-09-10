import { describe, expect, it } from 'vitest'
import { envelopeRefusal, isRevisionAfterReveal, pickEnvelopeRows, robotReviewRevisionNote } from './robotEnvelope'
import type { DiffEntry, TakeoffDiff } from './takeoffDiff'

const entry = (key: string, robotExt: number, ourExt: number): DiffEntry => ({
  key,
  label: key,
  robotCount: robotExt > 0 ? 1 : 0,
  ourCount: ourExt > 0 ? 1 : 0,
  robotExt,
  ourExt,
  impact: robotExt - ourExt,
})

const sent = { id: 'b431', bid_number: '431', estimator_id: 'wendi', bid_date_sent: '2026-09-10', bid_value: 148200 }

describe('envelopeRefusal', () => {
  it('opens for the bid\'s estimator once the bid is sent with a value and the run is scored', () => {
    expect(envelopeRefusal(sent, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBeNull()
  })
  it('never opens before send, without a value, or on a sealed run — the seal is the whole point', () => {
    expect(envelopeRefusal({ ...sent, bid_date_sent: null }, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBe('not-sent')
    expect(envelopeRefusal({ ...sent, bid_value: null }, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBe('no-value')
    expect(envelopeRefusal({ ...sent, bid_value: '0' }, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBe('no-value')
    expect(envelopeRefusal(sent, { userId: 'wendi', role: 'estimator' }, 'locked', new Set())).toBe('no-scored-run')
    expect(envelopeRefusal(sent, { userId: 'wendi', role: 'estimator' }, null, new Set())).toBe('no-scored-run')
  })
  it('an assistant marking someone else\'s bid sent gets the Dashboard nudge, not the modal; a dev always may', () => {
    expect(envelopeRefusal(sent, { userId: 'diane', role: 'assistant' }, 'scored', new Set())).toBe('not-estimator')
    expect(envelopeRefusal(sent, { userId: 'robert', role: 'dev' }, 'scored', new Set())).toBeNull()
    expect(envelopeRefusal({ ...sent, estimator_id: null }, { userId: 'diane', role: 'assistant' }, 'scored', new Set())).toBeNull()
  })
  it('a recorded best effort (v2.3234) opens it before send — the human number is already on record', () => {
    expect(envelopeRefusal({ ...sent, bid_date_sent: null, bid_value: null, best_effort_value: 148200 }, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBeNull()
    expect(envelopeRefusal({ ...sent, bid_date_sent: null, bid_value: null, best_effort_value: '0' }, { userId: 'wendi', role: 'estimator' }, 'scored', new Set())).toBe('not-sent')
    expect(envelopeRefusal({ ...sent, bid_date_sent: null, bid_value: null, best_effort_value: 148200 }, { userId: 'wendi', role: 'estimator' }, 'locked', new Set())).toBe('no-scored-run')
  })
  it('roles outside the audit audience never see it, and it offers once per bid per session', () => {
    expect(envelopeRefusal(sent, { userId: 'wendi', role: 'primary' }, 'scored', new Set())).toBe('not-auditor')
    expect(envelopeRefusal(sent, { userId: 'wendi', role: 'estimator' }, 'scored', new Set(['b431']))).toBe('already-offered')
  })
})

describe('pickEnvelopeRows', () => {
  const diff: TakeoffDiff = {
    missed: [entry('missed-small', 0, 300), entry('missed-big', 0, 5000)],
    added: [entry('added-big', 5000, 0), entry('added-mid', 2000, 0)],
    gaps: [entry('gap', 900, 400)],
    rates: [entry('rate', 1200, 1100)],
    matchedOkCount: 7,
  }
  it('pools every bucket, biggest dollars first, missed ahead on a tie, and says how many it hid', () => {
    const { rows, hidden } = pickEnvelopeRows(diff, 3)
    expect(rows.map((r) => r.entry.key)).toEqual(['missed-big', 'added-big', 'added-mid'])
    expect(rows[0]?.bucket).toBe('missed')
    expect(rows[0]?.impact).toBe(-5000)
    expect(hidden).toBe(3)
  })
  it('caps at the default and never hides a negative count', () => {
    const { rows, hidden } = pickEnvelopeRows(diff)
    expect(rows).toHaveLength(6)
    expect(hidden).toBe(0)
  })
})

describe('robotReviewRevisionNote', () => {
  it('names the old and new value, the direction, and the robot\'s number', () => {
    expect(robotReviewRevisionNote(148200, 151400, 171940)).toBe(
      "[robot review] Bid value revised after seeing the robot's number: $148,200 → $151,400 (+$3,200) · robot had $171,940",
    )
    expect(robotReviewRevisionNote('150000', 140000, null)).toBe(
      "[robot review] Bid value revised after seeing the robot's number: $150,000 → $140,000 (−$10,000)",
    )
  })
  it('is silent when nothing really changed or a side is missing', () => {
    expect(robotReviewRevisionNote(148200, 148200.4, 1)).toBeNull()
    expect(robotReviewRevisionNote(null, 100, 1)).toBeNull()
    expect(robotReviewRevisionNote(100, 0, 1)).toBeNull()
  })
})

describe('isRevisionAfterReveal', () => {
  it('needs a prior send, a scored run, and a real value change', () => {
    expect(isRevisionAfterReveal({ wasSentBefore: true, prevValue: 100, nextValue: 120, runStatus: 'scored' })).toBe(true)
    expect(isRevisionAfterReveal({ wasSentBefore: false, prevValue: 100, nextValue: 120, runStatus: 'scored' })).toBe(false)
    expect(isRevisionAfterReveal({ wasSentBefore: true, prevValue: 100, nextValue: 120, runStatus: 'locked' })).toBe(false)
    expect(isRevisionAfterReveal({ wasSentBefore: true, prevValue: 100, nextValue: undefined, runStatus: 'scored' })).toBe(false)
    expect(isRevisionAfterReveal({ wasSentBefore: true, prevValue: 100, nextValue: 100, runStatus: 'scored' })).toBe(false)
  })
})
