// @vitest-environment jsdom
/**
 * Render smoke for the hover cards on the Lien desk's Deadlines marks (v2.5531): a hover or a
 * focus opens one mark's card a beat later; marks that touch share one card with a column per
 * mark; a GC row's folded flag lists its jobs and offers the bar's door for exactly those; a
 * card's door acts and the card goes; Esc and leaving close it. The words come from
 * lib/jobs/lienMarkCards.ts (kernel-tested).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LienDeskCalendarTab from './LienDeskCalendarTab'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'

vi.mock('../../lib/jobs/paymentChaseIo', () => ({ addJobPaymentPromise: vi.fn(async () => {}), addJobPaymentPromisesSettled: vi.fn(async (args: { jobIds: string[] }) => ({ saved: args.jobIds, failed: [] })) }))
vi.mock('../../lib/jobs/propertyKindWrite', () => ({ savePropertyKind: vi.fn(async () => {}) }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn(), showActionToast: vi.fn() }) }))
afterEach(cleanup)

const TODAY = '2026-09-28'
const base = { todayYmd: TODAY, openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
const rows: LienCalendarJob[] = [
  // Rizvi: August's notice owed Oct 15, and the GC's word on the same day — a pay dot and a flag that touch.
  { jobId: 'a', number: '890 PLUM', name: 'Rizvi', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '628 Terrell Rd', openBalance: 9800, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 9800, lastWorkYmd: '2026-08-12', isSub: true, expectedPayYmd: '2026-10-15' }), lastWorkYmd: '2026-08-12' },
  { jobId: 'b', number: '881 PLUM', name: 'Umar Khan', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '9703 Lenox Hl', openBalance: 7902, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 7902, lastWorkYmd: '2026-08-20', propertyKind: '', isSub: true, workMonths: ['2026-07', '2026-08'], noticedMonths: ['2026-07'] }), lastWorkYmd: '2026-08-20', addressId: 'addr-b' },
  { jobId: 'd', number: '473 PLUM', name: 'Mike Holub', customer: 'Michael Holub', gcId: null, gcName: null, address: '109 Tuscarora', openBalance: 5724, isSub: false, runway: buildLienPayRunway({ ...base, openBalance: 5724, lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-09-30' }), lastWorkYmd: '2026-08-12' },
]

function rowOf(number: string): HTMLElement {
  return screen.getByText(number).closest('[role="row"]') as HTMLElement
}
function mount(over: Partial<Parameters<typeof LienDeskCalendarTab>[0]> = {}) {
  const onOpen = vi.fn()
  render(<LienDeskCalendarTab rows={rows} todayYmd={TODAY} onOpenJob={onOpen} {...over} />)
  return { onOpen }
}
const card = () => screen.findByTestId('lien-mark-card')
const noCard = () => waitFor(() => expect(screen.queryByTestId('lien-mark-card')).toBeNull())

describe('LienDeskCalendarTab — the hover cards (v2.5531)', () => {
  it('hovering a notice flag opens its card a beat later: the month, send by with the days, the money, Draft the notice; the door opens the job and the card goes', async () => {
    const { onOpen } = mount()
    const umar = rowOf('881 PLUM')
    const flag = within(umar).getByRole('button', { name: /A § 53.056 notice is owed for August 2026/ })
    // no browser tooltip competes with the card
    expect(within(umar).getByTestId('lien-cal-track').querySelector('[title]')).toBeNull()
    fireEvent.mouseEnter(flag)
    const c = await card()
    expect(c.getAttribute('aria-label')).toBe('About 881 PLUM')
    expect(within(c).getAllByTestId('lien-mark-card-col').length).toBe(1)
    expect(c.textContent).toContain('Notice owed · August')
    expect(within(c).getByTestId('lien-mark-card-when').textContent).toBe('Send by Oct 15 · in 17 days')
    expect(c.textContent).toContain('It goes to the owner and the GC.')
    expect(c.textContent).toContain('$7,902 is owed on this job.')
    fireEvent.click(within(c).getByRole('button', { name: 'Draft the notice ›' }))
    expect(onOpen).toHaveBeenCalledWith('b')
    await noCard()
  })

  it('leaving the mark closes the card a beat later; moving into the card keeps it; Esc closes it at once', async () => {
    mount()
    const umar = rowOf('881 PLUM')
    const flag = within(umar).getByRole('button', { name: /A § 53.056 notice is owed for August 2026/ })
    fireEvent.mouseEnter(flag)
    const c = await card()
    fireEvent.mouseLeave(flag)
    fireEvent.mouseEnter(c)
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.getByTestId('lien-mark-card')).toBe(c)
    // Esc closes it wherever the focus is: a hover moves none, so the key lands on the body
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('lien-mark-card')).toBeNull()
    // a hover that ends before the card opens never opens it
    fireEvent.mouseEnter(flag)
    fireEvent.mouseLeave(flag)
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.queryByTestId('lien-mark-card')).toBeNull()
    // keyboard focus opens it too
    fireEvent.focus(flag)
    await card()
    fireEvent.blur(flag)
    await noCard()
  })

  it('marks that touch share one card, a column per mark in their order; the pay dot’s door is the pen for the office', async () => {
    mount({ canWrite: true })
    const rizvi = rowOf('890 PLUM')
    // the pay dot and August's flag both sit on Oct 15
    const dot = within(rizvi).getByRole('button', { name: /said they would pay: Oct 15/ })
    fireEvent.mouseEnter(dot)
    const c = await card()
    const cols = within(c).getAllByTestId('lien-mark-card-col')
    expect(cols.length).toBe(2)
    expect(cols[0]!.textContent).toContain('Pay date they gave')
    expect(cols[0]!.textContent).toContain('That leaves 32 days of room before the lien flag.')
    expect(cols[1]!.textContent).toContain('Notice owed · August')
    // hovering the flag instead opens the same two-column card
    fireEvent.mouseLeave(dot)
    fireEvent.mouseEnter(within(rizvi).getByRole('button', { name: /A § 53.056 notice is owed for August 2026/ }))
    await waitFor(() => expect(within(screen.getByTestId('lien-mark-card')).getAllByTestId('lien-mark-card-col').length).toBe(2))
    fireEvent.click(within(screen.getByTestId('lien-mark-card')).getByRole('button', { name: 'Change it ›' }))
    expect(screen.queryByTestId('lien-mark-card')).toBeNull()
    expect(screen.getByTestId('lien-cal-pen')).toBeTruthy()
  })

  it('without the pen the dot’s door opens the job; the run and the bracket have their own cards', async () => {
    const { onOpen } = mount()
    const holub = rowOf('473 PLUM')
    fireEvent.mouseEnter(within(holub).getByRole('button', { name: /said they would pay: Sep 30/ }))
    let c = await card()
    expect(c.textContent).toContain('That leaves 47 days of room before the lien flag.')
    fireEvent.click(within(c).getByRole('button', { name: 'Open the Lien window ›' }))
    expect(onOpen).toHaveBeenCalledWith('d')
    await noCard()
    fireEvent.mouseEnter(within(holub).getByLabelText('Room — the money is expected before the lien date'))
    c = await card()
    expect(c.textContent).toContain('The money is expected Sep 30, 47 days before the lien flag on Nov 16.')
    fireEvent.mouseLeave(within(holub).getByLabelText('Room — the money is expected before the lien date'))
    await noCard()
    const umar = rowOf('881 PLUM')
    fireEvent.mouseEnter(within(umar).getByLabelText(/Property kind not set/))
    c = await card()
    expect(c.textContent).toContain('Kind not set')
    expect(c.textContent).toContain('A commercial building would be Dec 15.')
    // no kinds door without the pen
    expect(within(c).queryByTestId('lien-mark-card-door')).toBeNull()
  })

  it('a GC row’s folded flag lists the jobs behind its count and offers Draft the N for exactly those; the kinds door opens the sheet', async () => {
    const onDraft = vi.fn()
    mount({ canWrite: true, onDraft })
    const rmc = screen.getByTestId('lien-cal-group-gc:gc1')
    fireEvent.mouseEnter(within(rmc).getByLabelText('2 notices owed by Oct 15'))
    const c = await card()
    expect(c.getAttribute('aria-label')).toBe('About RMC · Dudley Mason')
    const jobs = within(c).getAllByTestId('lien-mark-card-job').map((j) => j.textContent)
    expect(jobs).toEqual(['890 PLUMRizvi · August$9,800', '881 PLUMUmar Khan · August$7,902'])
    expect(c.textContent).toContain('$17,702 across the 2.')
    fireEvent.click(within(c).getByRole('button', { name: 'Draft the 2 ›' }))
    expect(onDraft).toHaveBeenCalledWith('2026-10-15', ['a', 'b'])
    await noCard()
    // the bracket's card opens Set kinds for the office
    fireEvent.mouseEnter(within(rowOf('881 PLUM')).getByLabelText(/Property kind not set/))
    fireEvent.click(within(await card()).getByRole('button', { name: 'Set the kind ›' }))
    expect(screen.getByTestId('lien-cal-kinds')).toBeTruthy()
  })
})
