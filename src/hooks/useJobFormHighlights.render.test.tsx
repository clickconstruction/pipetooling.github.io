// @vitest-environment jsdom
/**
 * `useJobFormHighlights` (the Job form map's second pass, cut 5): the five flags a deep link opens the Job form
 * with, where each lands, and when each fades. On a fake clock, with the scroll and each element's size as
 * stand-ins, since jsdom lays nothing out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useJobFormHighlights, type JobFormFocusField } from './useJobFormHighlights'

type Doors = ReturnType<typeof useJobFormHighlights>

const dom = { scrolls: [] as Array<{ to: string | null; block: unknown }>, sized: new Set<string>() }
let doors: Doors

function Harness({ customerId, focusFieldInitial }: { customerId: string | null; focusFieldInitial: JobFormFocusField | null }) {
  doors = useJobFormHighlights({ customerId, focusFieldInitial })
  return (
    <>
      <div ref={doors.billingCustomerHighlightRef} data-testid="billing" />
      <div ref={doors.fixturesSectionHighlightRef} data-testid="lines" />
      <div ref={doors.paymentsReceivedHighlightRef} data-testid="payments" />
      <div ref={doors.focusFieldRef} data-testid="focus" />
      <div ref={doors.jobPicturesLinkHighlightRef} data-testid="pictures">
        <input ref={doors.jobPicturesLinkInputRef} aria-label="Customer Pictures" defaultValue="https://photos.example.com/album" />
      </div>
    </>
  )
}

const mount = (p: { customerId?: string | null; focusFieldInitial?: JobFormFocusField | null } = {}) =>
  render(<Harness customerId={p.customerId ?? null} focusFieldInitial={p.focusFieldInitial ?? null} />)
const pass = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const flags = () => ({ billing: doors.billingCustomerHighlight, lines: doors.fixturesSectionHighlight, payments: doors.paymentsReceivedHighlight, focus: doors.focusFieldFlash, pictures: doors.jobPicturesLinkHighlight })
const QUIET = { billing: false, lines: false, payments: false, focus: null, pictures: false }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  dom.scrolls = []
  dom.sized = new Set()
  Element.prototype.scrollIntoView = function (this: Element, opts?: boolean | ScrollIntoViewOptions) {
    dom.scrolls.push({ to: this.getAttribute('data-testid'), block: typeof opts === 'object' ? opts.block : opts })
  }
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return { height: dom.sized.has(this.getAttribute('data-testid') ?? '') ? 40 : 0 } as DOMRect
  }
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useJobFormHighlights', () => {
  it('opens quiet: no flag set, nothing scrolled, no timer running', () => {
    mount()
    pass(60_000)
    expect(flags()).toEqual(QUIET)
    expect(dom.scrolls).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('line items: scrolls to the block on the next frame and fades after 2.5 s', () => {
    mount()
    act(() => doors.setFixturesSectionHighlight(true))
    expect(dom.scrolls).toEqual([])
    pass(20)
    expect(dom.scrolls).toEqual([{ to: 'lines', block: 'nearest' }])
    pass(2_479)
    expect(flags().lines).toBe(true)
    pass(1)
    expect(flags()).toEqual(QUIET)
  })

  it('Customer Pictures: scrolls to the box, focuses and selects it, and fades after 2.5 s', () => {
    const view = mount()
    const input = view.getByLabelText('Customer Pictures') as HTMLInputElement
    act(() => doors.setJobPicturesLinkHighlight(true))
    pass(20)
    expect(dom.scrolls).toEqual([{ to: 'pictures', block: 'nearest' }])
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length])
    pass(2_479)
    expect(flags().pictures).toBe(true)
    pass(1)
    expect(flags()).toEqual(QUIET)
  })

  it('billing customer: scrolls to the block and does not fade by the clock', () => {
    mount()
    act(() => doors.setBillingCustomerHighlight(true))
    pass(20)
    expect(dom.scrolls).toEqual([{ to: 'billing', block: 'nearest' }])
    pass(600_000)
    expect(flags().billing).toBe(true)
  })

  it('billing customer: clears once the job has a customer', () => {
    const view = mount()
    act(() => doors.setBillingCustomerHighlight(true))
    pass(20)
    view.rerender(<Harness customerId="cust-1" focusFieldInitial={null} />)
    expect(flags()).toEqual(QUIET)
  })

  it('billing customer: set on a job that already has one, it clears at once and never scrolls', () => {
    mount({ customerId: 'cust-1' })
    act(() => doors.setBillingCustomerHighlight(true))
    pass(1_000)
    expect(flags()).toEqual(QUIET)
    expect(dom.scrolls).toEqual([])
  })

  it('payments received: waits for the block to have a size, scrolls it to the middle, then fades 4 s later', () => {
    mount()
    act(() => doors.setPaymentsReceivedHighlight(true))
    pass(1_000)
    expect(dom.scrolls).toEqual([])
    expect(flags().payments).toBe(true)
    dom.sized.add('payments')
    pass(100)
    expect(dom.scrolls).toEqual([{ to: 'payments', block: 'center' }])
    pass(3_999)
    expect(flags().payments).toBe(true)
    pass(1)
    expect(flags()).toEqual(QUIET)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('payments received: a block that never has a size is given up on after 150 looks, 15 s, unscrolled', () => {
    mount()
    act(() => doors.setPaymentsReceivedHighlight(true))
    pass(14_999)
    expect(flags().payments).toBe(true)
    pass(1)
    expect(flags()).toEqual(QUIET)
    expect(dom.scrolls).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['status', 'pct'] as const)('the %s door: opens ringed, scrolls once its field has a size, and fades 4.5 s later', (field) => {
    dom.sized.add('focus')
    mount({ focusFieldInitial: field })
    expect(flags().focus).toBe(field)
    pass(100)
    expect(dom.scrolls).toEqual([{ to: 'focus', block: 'center' }])
    pass(4_499)
    expect(flags().focus).toBe(field)
    pass(1)
    expect(flags()).toEqual(QUIET)
  })

  it('the status door: a field that never has a size is given up on after 15 s', () => {
    mount({ focusFieldInitial: 'status' })
    pass(14_999)
    expect(flags().focus).toBe('status')
    pass(1)
    expect(flags()).toEqual(QUIET)
    expect(dom.scrolls).toEqual([])
  })

  it('a flag cleared by hand before its fade drops the fade, and setting it again starts a full one', () => {
    mount()
    act(() => doors.setFixturesSectionHighlight(true))
    pass(1_000)
    act(() => doors.setFixturesSectionHighlight(false))
    expect(vi.getTimerCount()).toBe(0)
    act(() => doors.setFixturesSectionHighlight(true))
    pass(2_499)
    expect(flags().lines).toBe(true)
    pass(1)
    expect(flags().lines).toBe(false)
  })

  it('the doors do not wait on each other: two open at once each keep their own clock', () => {
    dom.sized.add('payments')
    mount()
    act(() => {
      doors.setFixturesSectionHighlight(true)
      doors.setPaymentsReceivedHighlight(true)
    })
    pass(2_500)
    expect(flags()).toEqual({ ...QUIET, payments: true })
    pass(1_600)
    expect(flags()).toEqual(QUIET)
  })

  it('a form closed mid-flash leaves no timer behind', () => {
    dom.sized.add('payments')
    const view = mount({ focusFieldInitial: 'pct' })
    act(() => {
      doors.setFixturesSectionHighlight(true)
      doors.setPaymentsReceivedHighlight(true)
      doors.setJobPicturesLinkHighlight(true)
      doors.setBillingCustomerHighlight(true)
    })
    pass(150)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
