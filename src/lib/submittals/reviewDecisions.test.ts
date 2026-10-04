import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

import { decisionsAsText, describeDecisions, itemsSentBack, resubmitConfirm, resubmitLabel, resubmitSplit, summarizeDecisions } from './reviewDecisions'

const it_ = (o: Record<string, unknown>) => ({ tag: 'X-1', status: 'alternate', submitted_label: 'THING', submitted_model: null, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_at: null, ...o })

describe('reviewDecisions', () => {
  const items = [
    it_({ tag: 'WC-1', status: 'as_specified' }),
    it_({ tag: 'DWH-1', review_decision: 'approved', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-16T15:00:00Z' }),
    it_({ tag: 'FV-1', status: 'design_change', review_decision: 'revise', review_note: 'hold 1.0 gpf', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-16T15:00:00Z' }),
    it_({ tag: 'RD-2', review_decision: 'rejected', reviewed_by_name: 'Tom R.', reviewed_at: '2026-09-17T15:00:00Z' }),
    it_({ tag: 'RPZ-1' }),
    it_({ tag: 'PRV-1', status: 'missing' }),
  ]
  it('summarizes: decided, the three kinds, the open differing rows, who decided', () => {
    const s = summarizeDecisions(items)
    expect(s).toEqual({ decided: 3, approved: 1, revise: 1, rejected: 1, open: 1, noAnswer: 3, sentBack: 2, byName: ['Dana W.', 'Tom R.'], entered: 0, enteredBy: [] })
    expect(describeDecisions(s)).toBe('1 approved · 1 revise · 1 rejected · by Dana W., Tom R.')
    expect(describeDecisions(summarizeDecisions([it_({})]))).toBe('')
  })
  it('writes the copyable text and picks the rows sent back', () => {
    expect(decisionsAsText(items, 'Rev 2 · BP398 ZZ Test', APP_CALENDAR_TZ)).toBe(['Rev 2 · BP398 ZZ Test', 'DWH-1 · THING — Approved (Dana W. · Sep 16)', 'FV-1 · THING — Revise: "hold 1.0 gpf" (Dana W. · Sep 16)', 'RD-2 · THING — Rejected (Tom R. · Sep 17)'].join('\n'))
    expect(decisionsAsText([it_({})], 'Rev 1', APP_CALENDAR_TZ)).toBe('Rev 1\n(no decisions yet)')
    expect(itemsSentBack(items).map((i) => i.tag)).toEqual(['FV-1', 'RD-2'])
  })

  it('entered decisions (5b) count, name who typed them, and read so in the text', () => {
    const entered = [
      it_({ tag: 'DWH-1', review_decision: 'approved', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'entered', decision_entered_by_name: 'Wendi' }),
      it_({ tag: 'RD-2', review_decision: 'revise', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'entered', decision_entered_by_name: null }),
      it_({ tag: 'FV-1', review_decision: 'rejected', reviewed_by_name: 'Tom R.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'room' }),
    ]
    const s = summarizeDecisions(entered)
    expect(s.entered).toBe(2)
    expect(s.enteredBy).toEqual(['Wendi', 'the office'])
    expect(describeDecisions(s)).toBe('1 approved · 1 revise · 1 rejected · by Dana W., Tom R. · 2 entered by Wendi, the office')
    expect(decisionsAsText(entered, 'Rev 2', APP_CALENDAR_TZ).split('\n')[1]).toBe('DWH-1 · THING — Approved (Dana W. · entered by Wendi · Sep 17)')
  })
  it('2026-10-03 · a resubmit leaves only the approved rows behind: a row with no answer goes on with the rows sent back', () => {
    const split = resubmitSplit(items)
    expect(split.sentBack.map((i) => i.tag)).toEqual(['FV-1', 'RD-2'])
    expect(split.approved.map((i) => i.tag)).toEqual(['DWH-1'])
    // As specified, missing or differing: a row nobody answered is not approved, so it is carried.
    expect(split.noAnswer.map((i) => i.tag)).toEqual(['WC-1', 'RPZ-1', 'PRV-1'])
  })

  it('2026-10-03 · the button and the question count every kind of row', () => {
    expect(resubmitLabel(3, 1)).toBe('Rev 3 from the 1 row sent back')
    expect(resubmitLabel(2, 4, 9)).toBe('Rev 2 from the 4 rows sent back and the 9 with no answer')
    // BP375 on 2026-10-03: four sent back, ten with no answer, nothing approved.
    expect(resubmitConfirm(1, { sentBack: 4, noAnswer: 10, approved: 0, total: 14 })).toEqual({
      title: 'Rev 2 from the 4 rows sent back and the 10 with no answer',
      message: '4 rows were sent back. They go on Rev 2 so you can fix them. 10 rows have no answer yet. They go on Rev 2 too and keep waiting. No row was approved on Rev 1.',
      confirmLabel: 'Build Rev 2 with 14 rows',
    })
    expect(resubmitConfirm(2, { sentBack: 1, noAnswer: 0, approved: 13, orderOnly: 1, total: 2 })).toEqual({
      title: 'Rev 3 from the 1 row sent back',
      message: '1 row was sent back. It goes on Rev 3 so you can fix it. 13 rows were approved. They stay on Rev 2 and on the procurement log. 1 row you buy without the GC goes on Rev 3 too.',
      confirmLabel: 'Build Rev 3 with 2 rows',
    })
    expect(resubmitConfirm(1, { sentBack: 1, noAnswer: 1, approved: 1, total: 2 }).message).toBe('1 row was sent back. It goes on Rev 2 so you can fix it. 1 row has no answer yet. It goes on Rev 2 too and keeps waiting. 1 row was approved. It stays on Rev 1 and on the procurement log.')
  })
})
