// @vitest-environment jsdom
/**
 * Render smoke for Ask for the days (the Gantt's G-141; mock-up `to-dos/gc-mode/mockups/G-141.md`):
 * the press under G-98's whose-days line on the Projected finish measure and on Bill the
 * customer's Finish date card, the paper without it, the draft on the change orders list, and the
 * customer's portal card once it is sent.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcOwnerBillingFinish } from './GcOwnerBillingFinish'
import { GcOwnerBillingChangeOrders } from './GcOwnerBillingChangeOrders'
import { GcOwnerBillingPortal } from './GcOwnerBillingPortal'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** G-98's late job at $500 a day: Tue Dec 15, 4 days past the contract, and Trim's move put 5 days on the finish. */
function lateJob(): GcState {
  const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
  return moveBy(moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.'), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}
const press = (s: GcState) => gcReducer(s, { type: 'draftTimeExtension', projectId: ID })
const send = (s: GcState) => gcReducer(s, { type: 'sendChangeOrder', projectId: ID, changeOrderId: 'co-1' })
const sign = (s: GcState) => gcReducer(s, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: 'co-1' })

const block = () => document.querySelector('[data-tour="gc-late-finish"]') as HTMLElement
const askPress = () => document.querySelector('[data-tour="gc-ask-for-days"]')

describe('Ask for the days (G-141)', () => {
  it('sits under the whose-days line on the Projected finish measure, and drafts on the press', () => {
    const s = lateJob()
    const dispatch = vi.fn()
    render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={dispatch} />)
    const lines = [...block().children].map((el) => el.textContent ?? '')
    const at = lines.indexOf("All 4 are the customer's: a change order for them would save $2,000.")
    expect(at).toBeGreaterThanOrEqual(0)
    expect(block().children[at + 1]).toBe(askPress())
    expect(askPress()?.textContent).toBe(
      'Ask for the daysIt drafts a change order on Bill the customer for 5 days, the days their moves put on the finish. Nothing goes to them until you send it.',
    )
    fireEvent.click(within(askPress() as HTMLElement).getByRole('button', { name: 'Ask for the days' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'draftTimeExtension', projectId: ID })
  })

  it('once drafted, the line says where the ask stands and the press is gone; the paper never prints it', () => {
    const s = press(lateJob())
    render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    expect(askPress()).toBeNull()
    expect([...block().querySelectorAll(':scope > span')].map((el) => el.textContent)).toContain(
      "All 4 are the customer's: change order 1 asks for 5, the days their moves put on the finish. It is a draft on Bill the customer.",
    )
    cleanup()
    const before = lateJob()
    render(<GcBuildingScheduleTab state={before} project={job(before)} dispatch={vi.fn()} />)
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const framed = screen.getByRole('dialog', { name: 'Print the chart' }).querySelector('iframe')?.getAttribute('srcdoc') ?? ''
    expect(framed).toContain("All 4 are the customer's: a change order for them would save $2,000.")
    expect(framed).not.toContain('Ask for the days')
    expect(framed).not.toContain('It drafts a change order')
  })

  it('sits under the same line on Bill the customer’s Finish date card, pointing below', () => {
    const s = lateJob()
    const dispatch = vi.fn()
    render(<GcOwnerBillingFinish state={s} project={job(s)} dispatch={dispatch} />)
    expect(screen.getByText("All 4 are the customer's: a change order for them would save $2,000.")).toBeTruthy()
    expect(askPress()?.textContent).toContain('It drafts a change order below for 5 days, the days their moves put on the finish.')
    fireEvent.click(screen.getByRole('button', { name: 'Ask for the days' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'draftTimeExtension', projectId: ID })
  })

  it('is a draft on the change orders list with no price, its rule, its move and what it saves; signed, no % done', () => {
    const drafted = press(lateJob())
    render(<GcOwnerBillingChangeOrders state={drafted} project={job(drafted)} dispatch={vi.fn()} />)
    expect(screen.getByText('A time extension for the restroom tile decision we asked you for on Sep 28')).toBeTruthy()
    expect(screen.getByText('no change to the price')).toBeTruthy()
    expect(screen.getByText('Customer directive · adds 5 days to the contract · its days are on the chart already')).toBeTruthy()
    for (const line of [
      '5 days, the days your decision moved the finish.',
      'Trim moved Fri Oct 2 and put 5 days on the finish. Our note: “Waiting on the restroom tile decision.”',
      "At the contract's $500 a day, it saves $2,000 and leaves 1 day to spare.",
      'Substantial completion moves from Fri Dec 11 to Wed Dec 16.',
    ]) {
      expect(screen.getByText(line)).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Send for signature' })).toBeTruthy()
    expect(screen.queryByText(/costs us/)).toBeNull()
    cleanup()
    const signed = sign(send(drafted))
    render(<GcOwnerBillingChangeOrders state={signed} project={job(signed)} dispatch={vi.fn()} />)
    expect(screen.getByText('signed Oct 2')).toBeTruthy()
    expect(screen.queryByLabelText('How much of change order 1 is done')).toBeNull()
  })

  it('reads on the customer’s portal card as days only, with the rule in their words', () => {
    const sent = send(press(lateJob()))
    render(<GcOwnerBillingPortal state={sent} project={job(sent)} dispatch={vi.fn()} />)
    expect(screen.getByText('no change to your price')).toBeTruthy()
    expect(screen.getByText('A time extension for the restroom tile decision we asked you for on Sep 28')).toBeTruthy()
    expect(screen.getByText('5 days, the days your decision moved the finish.')).toBeTruthy()
    expect(screen.getByText(/Your price stays the same\. It adds 5 days to the job\. Substantial completion moves to Dec 16\./)).toBeTruthy()
    expect(screen.queryByText(/\$0/)).toBeNull()
  })
})
