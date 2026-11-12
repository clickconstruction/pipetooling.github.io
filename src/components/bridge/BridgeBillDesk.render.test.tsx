// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeBillDesk } from './BridgeBillDesk'
import { buildBillDesk, type BillDeskBill, type BillDeskInput, type BillDeskJob } from '../../lib/bridge/bill/billDesk'
import type { BillPileItem } from '../../lib/bridge/billPile'

// Made-up jobs and figures throughout.
const TODAY = '2026-10-26'
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const job = (id: string, label: string, status: string, revenueUsd: number | null, item: BillPileItem, over: Partial<BillDeskJob> = {}): BillDeskJob => ({ id, label, status, revenueUsd, billedUsd: 0, paymentsUsd: 0, item, readyYmd: null, pct100SinceYmd: null, newestPctYmd: null, newestBillYmd: null, hoursInWindow: 0, ...over })
const bill = (id: string, jobId: string, jobLabel: string, usd: number, billedYmd: string, readyYmd: string | null, over: Partial<BillDeskBill> = {}): BillDeskBill => ({ id, jobId, jobLabel, usd, billedYmd, sentFromHere: true, sentByName: 'Avery', readyYmd, paid: false, ...over })

const leakJobs: BillDeskJob[] = [
  job('j2101', '2101 · Ridgeway tower', 'working', 30_000, { id: 'j2101', usd: 19_000, pct: 100, source: 'hand' }, { billedUsd: 11_000, newestPctYmd: '2026-09-21', newestBillYmd: '2026-09-28' }),
  job('j2122', '2122 · Cedar Bend', 'working', 20_000, { id: 'j2122', usd: 13_000, pct: 100, source: 'hand' }, { billedUsd: 7_000, newestPctYmd: '2026-10-12', newestBillYmd: '2026-10-16' }),
  job('j2140', '2140 · Marlow clinic', 'working', 4_100, { id: 'j2140', usd: 4_100, pct: 100, source: 'hand' }, { pct100SinceYmd: '2026-09-19', newestPctYmd: '2026-09-19' }),
  job('j2150', '2150 · Hollis barn', 'working', null, { id: 'j2150', usd: 0, pct: null, source: 'no-price' }, { hoursInWindow: 38 }),
  job('j2151', '2151 · Pine Hollow', 'working', null, { id: 'j2151', usd: 0, pct: null, source: 'no-price' }, { hoursInWindow: 12 }),
]
const readyJobs: BillDeskJob[] = [
  job('j2160', '2160 · Quarry Road', 'ready_to_bill', 9_600, { id: 'j2160', usd: 9_600, pct: null, source: 'ready' }, { readyYmd: '2026-10-20' }),
  job('j2161', '2161 · Larkspur', 'ready_to_bill', 9_500, { id: 'j2161', usd: 5_400, pct: null, source: 'ready' }, { billedUsd: 4_100, readyYmd: '2026-10-23' }),
  job('j2162', '2162 · Dunmore', 'ready_to_bill', 9_700, { id: 'j2162', usd: 3_600, pct: null, source: 'ready' }, { paymentsUsd: 6_100, readyYmd: '2026-10-24' }),
]
const base: Omit<BillDeskInput, 'jobs' | 'pile'> = {
  todayYmd: TODAY,
  windowStart: '2026-08-31',
  pace: { inPerWeekUsd: 33_500, outPerWeekUsd: 39_000, weeks: 1, windowWeeks: 8 },
  flows: { billedUsd: 312_000, paidUsd: 204_000, arTotalUsd: 240_000 },
  companyPaceDays: 7,
  bills: [
    bill('i1', 'j2170', '2170 · Sable Creek', 1_500, '2026-10-12', null, { sentFromHere: false, sentByName: null }),
    bill('i2', 'j2171', '2171 · Tamarack', 2_500, '2026-10-14', '2026-10-10', { sentFromHere: false, sentByName: null }),
    bill('i3', 'j2172', '2172 · Wren Street', 645, '2026-10-21', '2026-10-21'),
    bill('i4', 'j2173', '2173 · Osprey Point', 1_350, '2026-10-23', '2026-10-17'),
    bill('i5', 'j2174', '2174 · Fennel Court', 4_800, '2026-10-16', '2026-10-16', { sentByName: 'Blake' }),
    bill('i6', 'j2175', '2175 · Alder Row', 2_210, '2026-10-09', '2026-10-09', { sentByName: 'Blake' }),
    bill('i7', 'j2176', '2176 · Briar Mill', 3_100, '2026-10-06', '2026-10-06'),
  ],
  dayLabel: md,
}
/** As the live page reads today: leaks and hand-marked bills, no job marked ready to bill. */
const desk = buildBillDesk({ ...base, pile: { knownUsd: 36_100, readyUsd: 0 }, jobs: leakJobs })
/** The same with three jobs the office marked ready to bill. */
const deskReady = buildBillDesk({ ...base, pile: { knownUsd: 54_700, readyUsd: 18_600 }, jobs: [...leakJobs, ...readyJobs] })
const STAMP = 'Mon, Oct 26 · pay week Oct 25–31'
const stepRows = (group: string) => within(screen.getByTestId(`bridge-step-group-${group}`)).getAllByTestId('bridge-step-row')

describe('BridgeBillDesk on the step frame (spike candidate 9, punch list #303)', () => {
  it('opens on the work with no bill and the rows to do this week, each with one press, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeBillDesk facts={desk.facts} desk={desk} error={null} isLink={true} readStamp={STAMP} onClose={onClose} />)
    const win = screen.getByTestId('bridge-bill-desk')
    expect(within(win).getByRole('dialog').getAttribute('aria-label')).toBe('Bill, broken down')
    expect(win.textContent).toContain('Bill · the work done')
    expect(screen.getByTestId('bridge-bill-headline').textContent).toBe('$36.1k of finished work has no bill.')
    expect(screen.getByText('The office bills $39k a week. So this is about one week of work.')).toBeTruthy()
    expect(screen.queryByTestId('bridge-bill-error')).toBeNull()

    // Do this week: the two largest part-billed jobs, then the jobs with no price as one row.
    const todo = stepRows('do')
    expect(todo).toHaveLength(3)
    expect(todo[0]!.textContent).toContain('Bill the rest of 2101 Ridgeway tower')
    expect(todo[0]!.textContent).toContain('$19k left. Part-billed 4 weeks ago.')
    const first = todo[0]!.querySelector('a') as HTMLAnchorElement
    expect(first.textContent).toBe('Open the bill')
    expect(first.getAttribute('href')).toBe('/jobs?tab=billing')
    expect(first.style.background).toBe('rgb(37, 99, 235)')
    expect(todo[1]!.textContent).toContain('Bill the rest of 2122 Cedar Bend')
    expect(todo[1]!.textContent).toContain('$13k left. Part-billed last week.')
    expect((todo[1]!.querySelector('a') as HTMLAnchorElement).style.background).not.toBe('rgb(37, 99, 235)')
    expect(todo[2]!.textContent).toContain('Price 2 jobs that have hours')
    expect(todo[2]!.textContent).toContain('With no price their work never bills.')

    // The one no-price row opens its jobs under itself, each with the door it had.
    expect(screen.queryByTestId('bridge-bill-noprice-list')).toBeNull()
    const setPrices = screen.getByTestId('bridge-bill-press-no-price')
    expect(setPrices.textContent).toBe('Set prices')
    fireEvent.click(setPrices)
    const noPrice = within(todo[2]!).getAllByTestId('bridge-bill-noprice')
    expect(noPrice).toHaveLength(2)
    expect(noPrice[0]!.textContent).toContain('2150 · Hollis barn')
    expect(noPrice[0]!.textContent).toContain('38 h this window')
    const priceIt = noPrice[0]!.querySelector('a') as HTMLAnchorElement
    expect(priceIt.textContent).toBe('Price the job ›')
    expect(priceIt.getAttribute('href')).toBe('/jobs?tab=stages&edit=j2150')
    expect(screen.getByTestId('bridge-bill-press-no-price').textContent).toBe('Hide the jobs')

    // Did the customer get these: the hand-marked bills as one row, opening the list the window had.
    const ask = stepRows('ask')
    expect(ask).toHaveLength(1)
    expect(ask[0]!.textContent).toContain('2 bills marked billed by hand')
    expect(ask[0]!.textContent).toContain('$4k. Nothing on record went out.')
    expect(screen.queryAllByTestId('bridge-bill-hand')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('bridge-bill-press-hand-marked'))
    // One list is open at a time.
    expect(screen.queryByTestId('bridge-bill-noprice-list')).toBeNull()
    const hand = within(ask[0]!).getAllByTestId('bridge-bill-hand')
    expect(hand).toHaveLength(2)
    expect(hand[0]!.textContent).toContain('2171 Tamarack was marked billed Oct 14 with no send on file.')
    expect(screen.getByTestId('bridge-bill-hand-note').textContent).toContain('2 bills, $4k, were marked billed by hand')
    const handHead = hand[0]!.querySelector('button[aria-expanded]') as HTMLButtonElement
    fireEvent.click(handHead)
    expect(hand[0]!.textContent).toContain('The read that proves it:')
    expect((hand[0]!.querySelector('a') as HTMLAnchorElement).textContent).toBe('Open the bill ›')
    fireEvent.click(screen.getByTestId('bridge-bill-press-hand-marked'))
    expect(screen.queryAllByTestId('bridge-bill-hand')).toHaveLength(0)

    expect(screen.getByTestId('bridge-bill-rule').textContent).toBe('4 of 6 bills went out the day the job finished.')
    expect(screen.getByTestId('bridge-bill-open-billing').getAttribute('href')).toBe('/jobs?tab=billing')
    // Nothing the window used to print whole is open yet.
    expect(screen.queryAllByTestId('bridge-bill-row')).toHaveLength(0)
    expect(screen.queryByTestId('bridge-bill-pipe')).toBeNull()
    expect(screen.queryByTestId('bridge-bill-meter')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps every leak, the pipe, the cost of waiting and how it is counted behind the folds at the foot', () => {
    renderWithProviders(<BridgeBillDesk facts={deskReady.facts} desk={deskReady} error={null} isLink={false} readStamp={STAMP} onClose={() => {}} />)
    // Jobs the office marked ready to bill lead Do this week as one row.
    const todo = stepRows('do')
    expect(todo).toHaveLength(4)
    expect(todo[0]!.textContent).toContain('Bill 3 jobs marked ready to bill')
    expect(todo[0]!.textContent).toContain('$18.6k. The office already called them done.')
    const openBilling = todo[0]!.querySelector('a') as HTMLAnchorElement
    expect(openBilling.textContent).toBe('Open Billing')
    expect(openBilling.style.background).toBe('rgb(37, 99, 235)')
    expect(todo[1]!.textContent).toContain('Bill the rest of 2101 Ridgeway tower')

    expect(Array.from(screen.getByTestId('bridge-step-folds').querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Every leak (5) ›', 'The pipe, this window ›', 'What waiting costs ›', 'How this is counted ›'])

    // Every leak: the whole list as before, each row folding open on its proof and its door.
    const leaksFold = screen.getByTestId('bridge-step-fold-leaks')
    expect(leaksFold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(leaksFold)
    expect(leaksFold.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-bill-leaks-headline').textContent).toBe('Where billing leaks: $36.1k will not bill itself.')
    const rows = screen.getAllByTestId('bridge-bill-row')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.textContent).toContain('A remainder aging behind a part-bill.')
    expect(rows[2]!.textContent).toContain('Finished, never billed.')
    expect(rows[2]!.textContent).toContain('2140 Marlow clinic reads 100% since Sep 19.')
    expect(rows[4]!.textContent).toContain('No price, so no number ever rings.')
    const head = rows[1]!.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(rows[1]!.textContent).toContain('The read that proves it:')
    expect(rows[1]!.textContent).toContain('the bills cover $7k')
    const restDoor = rows[1]!.querySelector('a') as HTMLAnchorElement
    expect(restDoor.textContent).toBe('Bill the rest ›')
    expect(restDoor.getAttribute('href')).toBe('/jobs?tab=billing')

    // The pipe: one fold is open at a time.
    fireEvent.click(screen.getByTestId('bridge-step-fold-pipe'))
    expect(screen.queryAllByTestId('bridge-bill-row')).toHaveLength(0)
    expect(screen.getByTestId('bridge-bill-pipe').textContent).toContain("Collect's desk")
    expect(screen.getByTestId('bridge-bill-pipe').textContent).toContain('$18.6k ready, $36.1k by the %')
    expect(screen.getByTestId('bridge-step-fold-body-pipe').textContent).toContain('the office bills $39k a week')

    // What waiting costs: the meter, Billable today with its doors, and the scorecard with its table.
    fireEvent.click(screen.getByTestId('bridge-step-fold-cost'))
    expect(screen.getByTestId('bridge-bill-meter').textContent).toContain('$383k·days')
    expect(screen.getByTestId('bridge-bill-verdict').textContent).toBe('$18.6k the office already called done waits on a send.')
    const fast = screen.getAllByTestId('bridge-bill-fast')
    expect(fast).toHaveLength(3)
    expect(fast[0]!.textContent).toContain('2160 · Quarry Road')
    expect(fast[0]!.textContent).toContain('sat 6 days')
    expect(fast[2]!.textContent).toContain('payments cover $6.1k of $9.7k')
    const billIt = fast[0]!.querySelector('a') as HTMLAnchorElement
    expect(billIt.textContent).toBe('Bill it ›')
    expect(billIt.getAttribute('href')).toBe('/jobs?tab=billing')
    const score = screen.getByTestId('bridge-bill-scorecard')
    expect(score.textContent).toContain('4 of 6')
    expect(screen.queryByTestId('bridge-bill-table')).toBeNull()
    fireEvent.click(score)
    const table = screen.getByTestId('bridge-bill-table')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(7)
    expect(table.textContent).toContain('2173 · Osprey Point · $1.4k')
    expect(table.textContent).toContain('6 days')
    expect(table.textContent).toContain('$8.1k·d')
    expect(table.textContent).toContain('by hand')
    expect(screen.getByText('1 bill has no ready day on record. It sits in the table with a dash.')).toBeTruthy()

    // How this is counted: plain words, and the day the window was read.
    fireEvent.click(screen.getByTestId('bridge-step-fold-counted'))
    const counted = screen.getByTestId('bridge-bill-counted')
    expect(counted.textContent).toContain("Finished work is each job's percent done times its price.")
    expect(counted.textContent).toContain('Nothing is recorded in this window.')
    expect(counted.textContent).toContain(`Read ${STAMP}`)
    fireEvent.click(screen.getByTestId('bridge-step-fold-counted'))
    expect(screen.queryByTestId('bridge-bill-counted')).toBeNull()
  })

  it('draws the headline at once while the reads are in flight, and the reason near the top when they fail', () => {
    const { rerender } = renderWithProviders(<BridgeBillDesk facts={desk.facts} desk={null} error={null} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-bill-headline').textContent).toBe('$36.1k of finished work has no bill.')
    expect(screen.getByTestId('bridge-step-group-do').textContent).toContain('Reading the jobs…')
    expect(screen.queryAllByTestId('bridge-step-row')).toHaveLength(0)
    expect(screen.queryByTestId('bridge-step-group-ask')).toBeNull()
    expect(screen.queryByTestId('bridge-bill-rule')).toBeNull()
    expect(screen.getByTestId('bridge-step-fold-leaks').textContent).toBe('Every leak ›')
    fireEvent.click(screen.getByTestId('bridge-step-fold-pipe'))
    expect(screen.getByTestId('bridge-bill-pipe').textContent).toContain("Collect's desk")
    rerender(<BridgeBillDesk facts={desk.facts} desk={null} error="network down" isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-bill-error').textContent).toBe('This window could not read its jobs and bills. network down')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByTestId('bridge-step-group-do')).toBeNull()
  })

  it('says so when nothing waits: no row to do, and no hand-marked bill', () => {
    const quiet = buildBillDesk({ ...base, pile: { knownUsd: 0, readyUsd: 0 }, jobs: [], bills: [] })
    renderWithProviders(<BridgeBillDesk facts={quiet.facts} desk={quiet} error={null} isLink={false} readStamp={STAMP} onClose={() => {}} />)
    expect(screen.getByTestId('bridge-bill-headline').textContent).toBe('Every finished job has a bill.')
    expect(screen.getByTestId('bridge-step-group-do').textContent).toContain('No job is ready to bill, and none has a part-bill waiting.')
    expect(screen.getByTestId('bridge-step-group-ask').textContent).toContain('No bill of the last 8 pay weeks was marked billed by hand without a send.')
    expect(screen.getByTestId('bridge-step-fold-leaks').textContent).toBe('Every leak (0) ›')
  })
})
