// @vitest-environment jsdom
/**
 * Render-smoke tests for the Billing bar's line-item boundary ticks
 * (v2.1130): marks render at their cumulative positions with hoverable
 * labels, skip rendering entirely on the dashed no-line-items track, and
 * leave the bar unchanged when there are no marks.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MoneyLifecycleBar } from './MoneyLifecycleBar'
import { buildJobSegmentsBar, segmentBoundaryMarks } from '../../lib/jobs/jobSegmentsCoverage'

const baseProps = {
  hasBar: true,
  segments: [{ key: 'paid', frac: 0.4, color: '#16a34a' }],
  pctComplete: 60,
  total: 1000,
  rows: [{ key: 'paid', label: 'Paid', value: 400, dot: '#16a34a' }],
  bottomRow: { label: 'Remaining to bill', value: 600 },
}

describe('MoneyLifecycleBar boundary ticks', () => {
  it('renders one titled tick per mark at its cumulative position', () => {
    const marks = segmentBoundaryMarks(
      buildJobSegmentsBar({
        fixtures: [
          { id: 'a', name: 'Rough In', count: 1, line_unit_price: 400, invoice_id: null },
          { id: 'b', name: 'Top Out', count: 1, line_unit_price: 350, invoice_id: null },
          { id: 'c', name: 'Trim', count: 1, line_unit_price: 250, invoice_id: null },
        ],
        riderFeesDollars: 0,
        invoiceStatusById: {},
      }),
    )
    const { container } = render(<MoneyLifecycleBar {...baseProps} marks={marks} />)
    const ticks = Array.from(container.querySelectorAll('[title*="ends at"]'))
    expect(ticks.map((t) => t.getAttribute('title'))).toEqual(['Rough In ends at 40%', 'Top Out ends at 75%'])
    expect(ticks.map((t) => (t as HTMLElement).style.left)).toEqual(['40%', '75%'])
  })

  it('renders no ticks without marks or on the no-line-items track', () => {
    const { container: bare } = render(<MoneyLifecycleBar {...baseProps} />)
    expect(bare.querySelectorAll('[title*="ends at"]')).toHaveLength(0)
    const { container: dashed } = render(
      <MoneyLifecycleBar
        {...baseProps}
        hasBar={false}
        segments={[]}
        marks={[{ frac: 0.4, label: 'Rough In ends at 40%' }]}
      />,
    )
    expect(dashed.querySelectorAll('[title*="ends at"]')).toHaveLength(0)
  })
})
