// @vitest-environment jsdom
/**
 * Render smoke for the Job Summary tile figure (v2.3177): dollars with the
 * cents rendered smaller, a true minus for a loss, an em dash when unknown.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { JobSummaryTileMoney } from './JobSummaryLedgerToolbar'

describe('JobSummaryTileMoney', () => {
  it('keeps the whole amount in the text and shrinks only the cents', () => {
    const { container } = render(<JobSummaryTileMoney value={96420.18} />)
    expect(container.textContent).toBe('$96,420.18')
    const small = container.querySelector('span')
    expect(small?.textContent).toBe('.18')
    expect(small?.style.fontSize).toBe('0.7em')
  })
  it('prefixes a loss with a real minus sign and shows an em dash for no value', () => {
    expect(render(<JobSummaryTileMoney value={-1234.5} />).container.textContent).toBe('−$1,234.50')
    expect(render(<JobSummaryTileMoney value={null} />).container.textContent).toBe('—')
  })
})
