import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

import { decisionsAsText, describeDecisions, itemsSentBack, summarizeDecisions } from './reviewDecisions'

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
    expect(s).toEqual({ decided: 3, approved: 1, revise: 1, rejected: 1, open: 1, sentBack: 2, byName: ['Dana W.', 'Tom R.'] })
    expect(describeDecisions(s)).toBe('1 approved · 1 revise · 1 rejected · by Dana W., Tom R.')
    expect(describeDecisions(summarizeDecisions([it_({})]))).toBe('')
  })
  it('writes the copyable text and picks the rows sent back', () => {
    expect(decisionsAsText(items, 'Rev 2 · BP398 ZZ Test', APP_CALENDAR_TZ)).toBe(['Rev 2 · BP398 ZZ Test', 'DWH-1 · THING — Approved (Dana W. · Sep 16)', 'FV-1 · THING — Revise: "hold 1.0 gpf" (Dana W. · Sep 16)', 'RD-2 · THING — Rejected (Tom R. · Sep 17)'].join('\n'))
    expect(decisionsAsText([it_({})], 'Rev 1', APP_CALENDAR_TZ)).toBe('Rev 1\n(no decisions yet)')
    expect(itemsSentBack(items).map((i) => i.tag)).toEqual(['FV-1', 'RD-2'])
  })
})
