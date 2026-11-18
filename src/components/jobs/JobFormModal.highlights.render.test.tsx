// @vitest-environment jsdom
/**
 * The highlight and focus doors, on the form itself (the Job form map's second pass, cut 5).
 * `useJobFormHighlights` has its own tests on a fake clock; this pins the wiring: each way of opening the form
 * rings the right block and the ring fades when it should. The clock is fake but keeps pace with the real one,
 * so the form's own loading settles as usual and the fades are then walked forward by hand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown }))
const dom = vi.hoisted(() => ({ scrolls: [] as Array<{ el: Element; block: unknown; focus: string | null; testId: string | null }>, sized: false }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal, { type JobFormModalProps } from './JobFormModal'

const line = (id: string, name: string, price: number, seq: number) => ({ id, job_id: 'job-fir', name, count: 1, line_unit_price: price, line_description: null, invoice_id: null, sequence_order: seq, line_kind: 'work', stage_kind: null, shared_with_gc: false })
/** The ring's border as jsdom reads `2px solid #93c5fd` back. */
const RING = '2px solid rgb(147, 197, 253)'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  dom.scrolls = []
  dom.sized = false
  Element.prototype.scrollIntoView = function (this: Element, opts?: boolean | ScrollIntoViewOptions) {
    dom.scrolls.push({ el: this, block: typeof opts === 'object' ? opts.block : opts, focus: this.getAttribute('data-job-form-focus'), testId: this.getAttribute('data-testid') })
  }
  Element.prototype.getBoundingClientRect = function () {
    return { height: dom.sized ? 40 : 0, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})
afterEach(() => {
  vi.useRealTimers()
})

async function openFirHill(props: Partial<JobFormModalProps> = {}, job: Record<string, unknown> = {}) {
  db.job = makeJob({ id: 'job-fir', hcp_number: '984', job_name: 'Fir Hill', status: 'working', revenue: 2_000, customer_id: 'cust-fir', customer_name: 'Rowan Builders', fixtures: [line('f-rough', 'Rough-in', 1_200, 0), line('f-final', 'Final', 800, 1)], ...job })
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-fir" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={() => {}} onSaved={null} {...props} />,
  )
  await settle()
  await screen.findByDisplayValue('Fir Hill')
  await settle()
}

/** Walk the fake clock forward and let React draw what it changed. */
const pass = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const linesBlock = () => screen.getByText('① Line Items').parentElement?.parentElement as HTMLElement
const paymentsBlock = () => screen.getByTestId('job-form-payments-received')
const focusDoor = () => document.querySelector('[data-job-form-focus]')?.getAttribute('data-job-form-focus') ?? null
const picturesBox = () => document.getElementById('job-form-customer-job-pictures') as HTMLInputElement | null
const redBlocks = () => Array.from(document.querySelectorAll('div')).filter((d) => (d as HTMLElement).style.background === 'var(--bg-red-tint)')
/** Was this element scrolled to, and how. */
const scrolledTo = (el: Element | null | undefined, block: string) => dom.scrolls.some((s) => s.el === el && s.block === block)

describe('Edit Job: the highlight and focus doors', () => {
  it('opened plain, nothing is ringed and nothing scrolls', async () => {
    dom.sized = true
    await openFirHill()
    await pass(500)
    expect(linesBlock().style.border).toBe('')
    expect(paymentsBlock().style.border).toBe('')
    expect(focusDoor()).toBeNull()
    expect(dom.scrolls).toEqual([])
  })

  it('the line items door rings ① Line Items and the ring fades 2.5 s later', async () => {
    await openFirHill({ fixturesSectionHighlightInitial: true })
    expect(linesBlock().style.border).toBe(RING)
    await pass(100)
    expect(scrolledTo(linesBlock(), 'nearest')).toBe(true)
    expect(dom.scrolls).toHaveLength(1)
    await pass(2_500)
    expect(linesBlock().style.border).toBe('')
  })

  it('the payments door rings the payments block, scrolls it to the middle once it has a size, and fades 4 s later', async () => {
    dom.sized = true
    await openFirHill({ paymentsReceivedHighlightInitial: true })
    expect(paymentsBlock().style.border).toBe(RING)
    await pass(150)
    expect(scrolledTo(paymentsBlock(), 'center')).toBe(true)
    expect(dom.scrolls).toHaveLength(1)
    await pass(3_500)
    expect(paymentsBlock().style.border).toBe(RING)
    await pass(700)
    expect(paymentsBlock().style.border).toBe('')
  })

  it('the payments door on a block with no size yet keeps its ring and gives up after 15 s', async () => {
    await openFirHill({ paymentsReceivedHighlightInitial: true })
    await pass(10_000)
    expect(paymentsBlock().style.border).toBe(RING)
    await pass(5_200)
    expect(paymentsBlock().style.border).toBe('')
    expect(dom.scrolls).toEqual([])
  })

  it('the status door rings the status rail, scrolls to it, and fades 4.5 s later', async () => {
    dom.sized = true
    await openFirHill({ focusRowInitial: 'status' })
    expect(focusDoor()).toBe('status')
    await pass(150)
    expect(dom.scrolls.map((s) => [s.block, s.focus])).toEqual([['center', 'status']])
    await pass(4_000)
    expect(focusDoor()).toBe('status')
    await pass(700)
    expect(focusDoor()).toBeNull()
  })

  it('the % done door rings the money card’s Done figure and fades the same way', async () => {
    dom.sized = true
    await openFirHill({ focusRowInitial: 'pct' })
    expect(focusDoor()).toBe('pct')
    await pass(150)
    expect(dom.scrolls.map((s) => [s.block, s.focus])).toEqual([['center', 'pct']])
    await pass(4_700)
    expect(focusDoor()).toBeNull()
  })

  it('a fact-row door such as the property record rings neither field', async () => {
    dom.sized = true
    await openFirHill({ focusRowInitial: 'property' as JobFormModalProps['focusRowInitial'] })
    expect(focusDoor()).toBeNull()
  })

  it('the Customer Pictures door opens the row, puts the cursor in the box, rings it and fades 2.5 s later', async () => {
    await openFirHill({ jobPicturesLinkHighlightInitial: true })
    await pass(100)
    const box = picturesBox()
    expect(box).not.toBeNull()
    expect(document.activeElement).toBe(box)
    expect((box?.parentElement as HTMLElement).style.border).toBe(RING)
    expect(scrolledTo(box?.parentElement, 'nearest')).toBe(true)
    await pass(2_600)
    expect((picturesBox()?.parentElement as HTMLElement).style.border).toBe('')
  })

  it('the billing customer door on a job with no customer shows its red block, and the clock does not fade it', async () => {
    await openFirHill({ billingCustomerHighlightInitial: true }, { customer_id: null, customer_name: null })
    expect(redBlocks()).toHaveLength(1)
    await pass(100)
    expect(scrolledTo(redBlocks()[0], 'nearest')).toBe(true)
    await pass(20_000)
    expect(redBlocks()).toHaveLength(1)
  })

  it('the billing customer door on a job that has its customer shows no red block: the flag clears at once', async () => {
    await openFirHill({ billingCustomerHighlightInitial: true })
    await pass(100)
    expect(redBlocks()).toHaveLength(0)
  })
})
