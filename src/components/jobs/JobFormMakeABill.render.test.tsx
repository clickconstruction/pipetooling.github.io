// @vitest-environment jsdom
/**
 * Make a bill (v2.4307): the whole-rest button, the heading, the remembered "Bill part of it" fold
 * with "Up to % done", and the part button's press rule carried over from the old break-off row
 * (v2.4015): a press counts only if the button still means what it meant when the pointer went down.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { BILL_PART_OPEN_STORAGE_KEY, JobFormMakeABill } from './JobFormMakeABill'
import type { useBreakOffSlider } from './useBreakOffSlider'
import { wholeRestAction } from '../../lib/jobs/billTabMoney'
import { renderWithProviders } from '../../test/renderSmokeMocks'

let narrowMatches = false
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
  // jsdom has no PointerEvent, so fireEvent's pointerType would never reach the handler.
  if (!('PointerEvent' in window)) {
    class PointerEventStandIn extends MouseEvent {
      pointerType: string
      constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? ''
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: PointerEventStandIn, configurable: true })
  }
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  narrowMatches = false
})

type Slider = ReturnType<typeof useBreakOffSlider>
/** Just the fields Make a bill and the track read: a $21,000 job, $10,000 paid, $11,000 left, 60% done. */
const slider = (over: Partial<Record<string, unknown>> = {}): Slider =>
  ({
    newInvoiceAmount: '5000',
    setNewInvoiceAmount: () => {},
    newInvoiceAmountInputFocused: false,
    setNewInvoiceAmountInputFocused: () => {},
    isSendFullUnallocatedToReadyToBill: false,
    breakOffBillingTrackPercents: { hasTotal: true, paidPct: 48, billedPct: 0, breakPreviewPct: 24 },
    breakOffPaidSum: 10000,
    breakOffBilledSum: 0,
    breakOffRemaining: 11000,
    breakOffCombinedSliderBounds: { min: 48, max: 100 },
    breakOffInvoiceSharePct: 24,
    breakOffCombinedHandlePct: 71,
    breakOffCombinedThumbLeftPct: 71,
    jobCompleteTrackPct: 60,
    applyBreakOffCombinedPct: () => {},
    ...over,
  }) as unknown as Slider

function makeABill(
  s: Slider,
  opts: { status?: string; createInvoice?: () => void; move?: () => void; onWholeRest?: (a: unknown) => void; leftToBill?: number; hasOrderStages?: boolean } = {},
) {
  const status = opts.status ?? 'working'
  return (
    <JobFormMakeABill
      breakOff={s}
      jobTotalDollars={21000}
      leftToBill={opts.leftToBill ?? 11000}
      wholeRest={wholeRestAction(status, s.breakOffRemaining)}
      onWholeRest={opts.onWholeRest ?? (() => {})}
      hasOrderStages={opts.hasOrderStages ?? false}
      movingJobToReadyToBill={false}
      creatingInvoice={false}
      createInvoice={opts.createInvoice ?? (() => {})}
      moveWorkingJobToReadyToBillFromEdit={opts.move ?? (() => {})}
    />
  )
}

const part = () => within(screen.getByTestId('bill-part'))

describe('Make a bill — the whole rest and the heading', () => {
  it('a Working job: one press moves all of it to Ready to Bill', () => {
    const onWholeRest = vi.fn()
    renderWithProviders(makeABill(slider(), { onWholeRest }))
    expect(screen.getByText('$11,000 left to bill')).toBeTruthy()
    fireEvent.click(screen.getByTestId('bill-whole-rest'))
    expect(screen.getByTestId('bill-whole-rest').textContent).toBe('Move to Ready to Bill · $11,000')
    expect(onWholeRest).toHaveBeenCalledWith(expect.objectContaining({ kind: 'move_to_ready_to_bill', amount: 11000 }))
  })

  it('a Ready to Bill job whose draft holds the rest: the heading says so and the button opens Bill Customer', () => {
    renderWithProviders(makeABill(slider(), { status: 'ready_to_bill', leftToBill: 0 }))
    expect(screen.getByText('$11,000 on the Ready to Bill draft')).toBeTruthy()
    expect(screen.getByTestId('bill-whole-rest').textContent).toBe('Bill Customer · $11,000')
  })

  it('a job with In order stages says draws follow the stages', () => {
    renderWithProviders(makeABill(slider(), { hasOrderStages: true }))
    expect(screen.getByText('$11,000 left to bill · draws follow the stages')).toBeTruthy()
  })

  it('nothing left to bill: no Make a bill at all', () => {
    renderWithProviders(makeABill(slider({ breakOffRemaining: 0 }), { leftToBill: 0 }))
    expect(screen.queryByTestId('make-a-bill')).toBeNull()
  })
})

describe('Make a bill — Bill part of it', () => {
  it('starts open on a wide screen, closed on a phone, and remembers a press', () => {
    renderWithProviders(makeABill(slider()))
    expect(screen.getByTestId('bill-part')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Bill part of it/ }))
    expect(screen.queryByTestId('bill-part')).toBeNull()
    expect(window.localStorage.getItem(BILL_PART_OPEN_STORAGE_KEY)).toBe('0')
    cleanup()
    narrowMatches = false
    renderWithProviders(makeABill(slider()))
    expect(screen.queryByTestId('bill-part')).toBeNull()
  })

  it('a phone with nothing remembered starts it closed', () => {
    narrowMatches = true
    renderWithProviders(makeABill(slider()))
    expect(screen.queryByTestId('bill-part')).toBeNull()
    expect(screen.getByRole('button', { name: /Bill part of it/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the slider, and Up to % done sets the amount through the job’s % done', () => {
    const apply = vi.fn()
    renderWithProviders(makeABill(slider({ applyBreakOffCombinedPct: apply })))
    expect(part().getByRole('slider')).toBeTruthy()
    // 60% of $21,000 is $12,600; $10,000 is paid, so $2,600 more.
    fireEvent.click(part().getByRole('button', { name: 'Up to % done · $2,600' }))
    expect(apply).toHaveBeenCalledWith(60)
    expect(part().getByText('24% of the job · leaves $6,000 to bill')).toBeTruthy()
  })

  it('no % done: no Up to % done', () => {
    renderWithProviders(makeABill(slider({ jobCompleteTrackPct: null })))
    expect(part().queryByRole('button', { name: /Up to % done/ })).toBeNull()
  })
})

describe('Make a bill — a press counts only if the button still means the same (v2.4015)', () => {
  const sliderFor = (isFull: boolean, amount: string) => slider({ isSendFullUnallocatedToReadyToBill: isFull, newInvoiceAmount: amount })

  it('makes the bill when it still says Make a bill at the click', () => {
    const createInvoice = vi.fn()
    const move = vi.fn()
    renderWithProviders(makeABill(sliderFor(false, '5000'), { createInvoice, move }))
    const button = part().getByRole('button', { name: 'Make a $5,000 bill' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(createInvoice).toHaveBeenCalledTimes(1)
    expect(move).not.toHaveBeenCalled()
  })

  it('moves the job when Move to Ready to Bill is what was pressed', () => {
    const createInvoice = vi.fn()
    const move = vi.fn()
    renderWithProviders(makeABill(sliderFor(true, '11000'), { createInvoice, move }))
    const button = part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(move).toHaveBeenCalledTimes(1)
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('does neither when Make a bill turned into Move to Ready to Bill between the press and the click, and says why', async () => {
    const createInvoice = vi.fn()
    const move = vi.fn()
    const { rerender } = renderWithProviders(makeABill(sliderFor(false, '50000'), { createInvoice, move }))
    fireEvent.pointerDown(part().getByRole('button', { name: 'Make a $50,000 bill' }))
    // The press blurred the amount field, which cut the amount back to everything left.
    rerender(makeABill(sliderFor(true, '11000'), { createInvoice, move }))
    fireEvent.click(part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' }))
    expect(move).not.toHaveBeenCalled()
    expect(createInvoice).not.toHaveBeenCalled()
    expect(await screen.findByText(/the amount is now \$11,000\.00 — everything left on the job/)).toBeTruthy()
    // The next press is deliberate: the button said Move to Ready to Bill when the pointer went down.
    const button = part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(move).toHaveBeenCalledTimes(1)
  })

  it('runs a keyboard press, which has no pointer-down', () => {
    const move = vi.fn()
    renderWithProviders(makeABill(sliderFor(true, '11000'), { move }))
    fireEvent.click(part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' }))
    expect(move).toHaveBeenCalledTimes(1)
  })

  it('forgets a press that left the button without a click', () => {
    const move = vi.fn()
    const { rerender } = renderWithProviders(makeABill(sliderFor(false, '50000'), { move }))
    const before = part().getByRole('button', { name: 'Make a $50,000 bill' })
    fireEvent.pointerDown(before, { pointerType: 'mouse' })
    fireEvent.pointerLeave(before, { pointerType: 'mouse' })
    rerender(makeABill(sliderFor(true, '11000'), { move }))
    fireEvent.click(part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' }))
    expect(move).toHaveBeenCalledTimes(1)
  })

  it('on a touch screen, keeps the press through the leave a lifted finger sends before the click', async () => {
    const createInvoice = vi.fn()
    const move = vi.fn()
    const { rerender } = renderWithProviders(makeABill(sliderFor(false, '50000'), { createInvoice, move }))
    const before = part().getByRole('button', { name: 'Make a $50,000 bill' })
    fireEvent.pointerDown(before, { pointerType: 'touch' })
    fireEvent.pointerUp(before, { pointerType: 'touch' })
    fireEvent.pointerLeave(before, { pointerType: 'touch' })
    rerender(makeABill(sliderFor(true, '11000'), { createInvoice, move }))
    fireEvent.click(part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' }))
    expect(move).not.toHaveBeenCalled()
    expect(createInvoice).not.toHaveBeenCalled()
    expect(await screen.findByText(/everything left on the job/)).toBeTruthy()
  })

  it('on a touch screen, forgets a press the finger scrolled away from', () => {
    const move = vi.fn()
    const { rerender } = renderWithProviders(makeABill(sliderFor(false, '50000'), { move }))
    const before = part().getByRole('button', { name: 'Make a $50,000 bill' })
    fireEvent.pointerDown(before, { pointerType: 'touch' })
    fireEvent.pointerCancel(before, { pointerType: 'touch' })
    rerender(makeABill(sliderFor(true, '11000'), { move }))
    fireEvent.click(part().getByRole('button', { name: 'Move to Ready to Bill · $11,000' }))
    expect(move).toHaveBeenCalledTimes(1)
  })
})
