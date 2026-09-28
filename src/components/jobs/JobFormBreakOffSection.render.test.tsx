// @vitest-environment jsdom
/**
 * Render tests for the equation row's phone 2×2 grid (v2.1231): on narrow
 * viewports the wrapping flex row becomes a chip|operator|chip grid — row one
 * Paid + Billed, row two New Invoice → Left to bill — with the middle "+"
 * dropped (the row break replaces it) and equal-width stretched chips. Wide
 * viewports keep the single flex equation with both "+" operators.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
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

describe('the break-off button — a press counts only if the button still means the same (v2.4015)', () => {
  type Slider = ReturnType<typeof useBreakOffSlider>
  const sliderFor = (isFull: boolean, amount: string) => ({ ...breakOff, isSendFullUnallocatedToReadyToBill: isFull, newInvoiceAmount: amount }) as unknown as Slider
  const section = (slider: Slider, createInvoice: () => void, move: () => void) => (
    <JobFormBreakOffSection breakOff={slider} jobTotalBidDollars={21000} movingJobToReadyToBill={false} creatingInvoice={false} createInvoice={createInvoice} moveWorkingJobToReadyToBillFromEdit={move} />
  )

  it('runs New Invoice when it still says New Invoice at the click', () => {
    narrowMatches = false
    const createInvoice = vi.fn()
    const move = vi.fn()
    renderWithProviders(section(sliderFor(false, '5000'), createInvoice, move))
    const button = screen.getByRole('button', { name: 'New invoice' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(createInvoice).toHaveBeenCalledTimes(1)
    expect(move).not.toHaveBeenCalled()
  })

  it('moves the job when Ready to Bill is what was pressed', () => {
    narrowMatches = false
    const createInvoice = vi.fn()
    const move = vi.fn()
    renderWithProviders(section(sliderFor(true, '11000'), createInvoice, move))
    const button = screen.getByRole('button', { name: 'Ready to Bill' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(move).toHaveBeenCalledTimes(1)
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('does neither when New Invoice turned into Ready to Bill between the press and the click, and says why', async () => {
    narrowMatches = false
    const createInvoice = vi.fn()
    const move = vi.fn()
    const { rerender } = renderWithProviders(section(sliderFor(false, '50000'), createInvoice, move))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'New invoice' }))
    // The press blurred the amount field, which cut the amount back to everything left.
    rerender(section(sliderFor(true, '11000'), createInvoice, move))
    fireEvent.click(screen.getByRole('button', { name: 'Ready to Bill' }))
    expect(move).not.toHaveBeenCalled()
    expect(createInvoice).not.toHaveBeenCalled()
    expect(await screen.findByText(/the amount is now \$11,000\.00 — everything left on the job/)).toBeTruthy()
    // The next press is deliberate: the button said Ready to Bill when the pointer went down.
    const button = screen.getByRole('button', { name: 'Ready to Bill' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(move).toHaveBeenCalledTimes(1)
  })

  it('runs a keyboard press, which has no pointer-down', () => {
    narrowMatches = false
    const move = vi.fn()
    renderWithProviders(section(sliderFor(true, '11000'), () => {}, move))
    fireEvent.click(screen.getByRole('button', { name: 'Ready to Bill' }))
    expect(move).toHaveBeenCalledTimes(1)
  })

  it('forgets a press that left the button without a click', () => {
    narrowMatches = false
    const move = vi.fn()
    const { rerender } = renderWithProviders(section(sliderFor(false, '50000'), () => {}, move))
    const before = screen.getByRole('button', { name: 'New invoice' })
    fireEvent.pointerDown(before)
    fireEvent.pointerLeave(before)
    rerender(section(sliderFor(true, '11000'), () => {}, move))
    fireEvent.click(screen.getByRole('button', { name: 'Ready to Bill' }))
    expect(move).toHaveBeenCalledTimes(1)
  })
})
