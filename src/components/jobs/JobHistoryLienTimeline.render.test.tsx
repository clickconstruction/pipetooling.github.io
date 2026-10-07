// @vitest-environment jsdom
/**
 * The History tab's lien box (v2.3879; presentational since v2.4707): the calendar, fixed —
 * no Steps · Windows switch, the verdict band first, the demand letter as a row, whose move
 * under the live rows. The read and the gate live in JobWindowModal.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import JobHistoryLienTimeline from './JobHistoryLienTimeline'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'

const timeline = buildLienTimeline({
  todayYmd: '2026-09-27',
  isSub: true,
  propertyKind: 'commercial',
  lastMonth: '2026-07',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'sent', at: '2026-08-14T15:00:00Z' },
    { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-12T15:00:00Z' },
  ],
  noticeState: 'sent',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
  demandLetters: [{ sentAt: '2026-09-14T16:00:00Z', deadlineDate: '2026-09-28', amount: 8940, openRemaining: 8940, debtorParty: 'gc' }],
})

describe('JobHistoryLienTimeline', () => {
  it('draws the calendar with the letter and the Waiting-on line, no switch, the band before the chart', () => {
    const { container } = render(<JobHistoryLienTimeline timeline={timeline} />)
    expect(container.querySelector('[data-job-history-lien-timeline]')).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    expect(container.querySelector('[data-lien-timeline-view]')).toBeNull()
    const verdict = container.querySelector('[data-lien-timeline-verdict]')!
    const chart = container.querySelector('[data-lien-timeline-windows]')!
    expect(verdict.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-window="demand"]')?.textContent).toContain('reply by Sep 28')
    expect(container.querySelector('[data-lien-timeline-waiting]')?.textContent).toContain('the GC')
    expect(container.querySelector('[data-lien-timeline-window="affidavit"] [data-lien-timeline-move="ours"]')).toBeTruthy()
  })
})
