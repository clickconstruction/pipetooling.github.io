// @vitest-environment jsdom
/**
 * Render tests for the equation row's phone 2×2 grid (v2.1231): on narrow
 * viewports the wrapping flex row becomes a chip|operator|chip grid — row one
 * Paid + Billed, row two New Invoice → Left to bill — with the middle "+"
 * dropped (the row break replaces it) and equal-width stretched chips. Wide
 * viewports keep the single flex equation with both "+" operators.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { JobFormBreakOffSection } from './JobFormBreakOffSection'
import type { useBreakOffSlider } from './useBreakOffSlider'
import { renderWithProviders } from '../../test/renderSmokeMocks'

let narrowMatches = true

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(max-width: 640px)' && narrowMatches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

afterEach(cleanup)

/** Just the fields the section reads — cast to the hook's full return type. */
const breakOff = {
  newInvoiceAmount: '11000',
  setNewInvoiceAmount: () => {},
  newInvoiceAmountInputFocused: false,
  setNewInvoiceAmountInputFocused: () => {},
  isSendFullUnallocatedToReadyToBill: false,
  breakOffBillingTrackPercents: { hasTotal: true, paidPct: 48, billedPct: 0, breakPreviewPct: 52 },
  breakOffPaidSum: 10000,
  breakOffBilledSum: 0,
  breakOffRemaining: 11000,
  breakOffCombinedSliderBounds: { min: 0, max: 100 },
  breakOffInvoiceSharePct: 52,
} as unknown as ReturnType<typeof useBreakOffSlider>

function renderSection() {
  return renderWithProviders(
    <JobFormBreakOffSection
      breakOff={breakOff}
      jobTotalBidDollars={21000}
      movingJobToReadyToBill={false}
      creatingInvoice={false}
      createInvoice={() => {}}
      moveWorkingJobToReadyToBillFromEdit={() => {}}
    />,
  )
}

function equationRow(): HTMLElement {
  return screen.getByText('Paid').closest('div') as HTMLElement
}

describe('JobFormBreakOffSection equation row phone grid (v2.1231)', () => {
  it('narrow: 2×2 grid, one "+" (the row break replaces the second), stretched chips', () => {
    narrowMatches = true
    renderSection()
    const row = equationRow()
    expect(row.style.display).toBe('grid')
    expect(row.style.gridTemplateColumns).toContain('minmax')
    expect(screen.getAllByText('+')).toHaveLength(1)
    expect(screen.getByText('→')).toBeTruthy()
    const paidChip = screen.getByText('Paid').closest('span[title]') as HTMLElement
    expect(paidChip.style.width).toBe('100%')
  })

  it('wide: single flex equation with both "+" operators and content-sized chips', () => {
    narrowMatches = false
    renderSection()
    const row = equationRow()
    expect(row.style.display).toBe('flex')
    expect(screen.getAllByText('+')).toHaveLength(2)
    const paidChip = screen.getByText('Paid').closest('span[title]') as HTMLElement
    expect(paidChip.style.width).toBe('')
  })
})
