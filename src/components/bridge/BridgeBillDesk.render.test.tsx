// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeBillDesk } from './BridgeBillDesk'
import { buildBillDesk, type BillDeskBill, type BillDeskInput, type BillDeskJob } from '../../lib/bridge/bill/billDesk'
import type { BillPileItem } from '../../lib/bridge/billPile'

const TODAY = '2026-10-26'
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const job = (id: string, label: string, status: string, revenueUsd: number | null, item: BillPileItem, over: Partial<BillDeskJob> = {}): BillDeskJob => ({ id, label, status, revenueUsd, billedUsd: 0, paymentsUsd: 0, item, readyYmd: null, pct100SinceYmd: null, newestPctYmd: null, newestBillYmd: null, hoursInWindow: 0, ...over })
const bill = (id: string, jobId: string, jobLabel: string, usd: number, billedYmd: string, readyYmd: string | null, over: Partial<BillDeskBill> = {}): BillDeskBill => ({ id, jobId, jobLabel, usd, billedYmd, sentFromHere: true, sentByName: 'Taunya', readyYmd, paid: false, ...over })

const input: BillDeskInput = {
  todayYmd: TODAY,
  windowStart: '2026-08-31',
  pile: { knownUsd: 26_300, readyUsd: 18_600 },
  pace: { inPerWeekUsd: 52_900, outPerWeekUsd: 56_300, weeks: 0.47, windowWeeks: 8 },
  flows: { billedUsd: 444_000, paidUsd: 268_000, arTotalUsd: 259_000 },
  companyPaceDays: 7,
  jobs: [
    job('j1024', '1024 · Lawver install', 'working', 4_100, { id: 'j1024', usd: 4_100, pct: 100, source: 'hand' }, { pct100SinceYmd: '2026-09-19', newestPctYmd: '2026-09-19' }),
    job('j1051', '1051 · Patel repipe', 'working', 8_800, { id: 'j1051', usd: 3_600, pct: 100, source: 'hand' }, { billedUsd: 5_200, newestPctYmd: '2026-10-05', newestBillYmd: '2026-10-02' }),
    job('j1017', '1017 · Terrell', 'working', null, { id: 'j1017', usd: 0, pct: null, source: 'no-price' }, { hoursInWindow: 38 }),
    job('j1081', '1081 · Adams Pretest', 'ready_to_bill', 9_600, { id: 'j1081', usd: 9_600, pct: null, source: 'ready' }, { readyYmd: '2026-10-20' }),
    job('j977', '977 · Springtown', 'ready_to_bill', 9_500, { id: 'j977', usd: 5_400, pct: null, source: 'ready' }, { billedUsd: 4_100, readyYmd: '2026-10-23' }),
    job('j1044', '1044 · H & I Creekside', 'ready_to_bill', 9_700, { id: 'j1044', usd: 3_600, pct: null, source: 'ready' }, { paymentsUsd: 6_100, readyYmd: '2026-10-24' }),
  ],
  bills: [
    bill('i473', 'j473', '473 · Mike Holub', 1_500, '2026-10-12', null, { sentFromHere: false, sentByName: null }),
    bill('i1087', 'j1087', '1087 · Edwards Ranch', 645, '2026-10-21', '2026-10-21'),
    bill('i1046', 'j1046', '1046 · Pretest', 1_350, '2026-10-23', '2026-10-17'),
    bill('i1048', 'j1048', '1048 · Tison per plans', 4_800, '2026-10-16', '2026-10-16', { sentByName: 'Dana' }),
    bill('i1007', 'j1007', '1007 · SPACEX pay app 3', 11_800, '2026-10-14', '2026-10-10'),
    bill('i1075', 'j1075', '1075 · DRF Line Repair', 2_210, '2026-10-09', '2026-10-09', { sentByName: 'Dana' }),
    bill('i804', 'j804', '804 · Summit Auto Zone', 3_100, '2026-10-06', '2026-10-06'),
  ],
  dayLabel: md,
}
const desk = buildBillDesk(input)

describe('BridgeBillDesk (v2.5930)', () => {
  it('draws the headline, the verdict, the leaks with a fold, the fast lane with its door, the scorecard table, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeBillDesk facts={desk.facts} desk={desk} error={null} isLink={true} readStamp="Mon, Oct 26 · pay week Oct 25–31" onClose={onClose} />)
    expect(screen.getByTestId('bridge-bill-headline').textContent).toBe('Where billing leaks: $7.7k will not bill itself.')
    expect(screen.getByTestId('bridge-bill-verdict').textContent).toBe('$18.6k the office already called done waits on a send.')
    expect(screen.getByTestId('bridge-bill-pipe').textContent).toContain("Collect's desk")
    const rows = screen.getAllByTestId('bridge-bill-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('Finished, never billed.')
    expect(rows[0]!.textContent).toContain('1024 Lawver install reads 100% since Sep 19.')
    expect(rows[2]!.textContent).toContain('No price, so no number ever rings.')
    const hand = screen.getAllByTestId('bridge-bill-hand')
    expect(hand).toHaveLength(1)
    expect(hand[0]!.textContent).toContain('473 Mike Holub was marked billed Oct 12 with no send on file.')
    expect(screen.getByTestId('bridge-bill-hand-note').textContent).toContain('1 bill, $1.5k, was marked billed by hand')
    const head = rows[1]!.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(rows[1]!.textContent).toContain('The read that proves it:')
    expect(rows[1]!.textContent).toContain('the bills cover $5.2k')
    const restDoor = rows[1]!.querySelector('a') as HTMLAnchorElement
    expect(restDoor.textContent).toBe('Bill the rest ›')
    expect(restDoor.getAttribute('href')).toBe('/jobs?tab=billing')
    const fast = screen.getAllByTestId('bridge-bill-fast')
    expect(fast).toHaveLength(3)
    expect(fast[0]!.textContent).toContain('1081 · Adams Pretest')
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
    expect(table.textContent).toContain('1046 · Pretest · $1.4k')
    expect(table.textContent).toContain('6 days')
    expect(table.textContent).toContain('$8.1k·d')
    expect(table.textContent).toContain('by hand')
    expect(screen.getByText('1 bill has no ready day on record. It sits in the table with a dash.')).toBeTruthy()
    expect(screen.getByTestId('bridge-bill-meter').textContent).toContain('$184k·days')
    expect(screen.getByText(/The week's call is recorded on the link desk above/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('draws the header and the pipe at once while the reads are in flight, and the error line when they fail', () => {
    const { rerender } = renderWithProviders(<BridgeBillDesk facts={desk.facts} desk={null} error={null} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-bill-headline').textContent).toContain('reading the rows')
    expect(screen.getByTestId('bridge-bill-verdict').textContent).toBe('$18.6k the office already called done waits on a send.')
    expect(screen.getByText('Reading the Bill desk…')).toBeTruthy()
    expect(screen.queryAllByTestId('bridge-bill-row')).toHaveLength(0)
    rerender(<BridgeBillDesk facts={desk.facts} desk={null} error="network down" isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByText(/could not be read \(network down\)/)).toBeTruthy()
  })
})
