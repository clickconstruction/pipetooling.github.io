// @vitest-environment jsdom
/**
 * Render smoke for a GC's bill lines (the certify checklist, the call sheet):
 * the job link opens the job, the chevron reads the job's activity once, an
 * old bill and a broken promise say so. Under a line, what paid the bill.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import GcBillLines, { type GcBillLine } from './GcBillLines'

const activity = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../lib/fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: activity.fetch }))

const line = (key: string, over: Partial<GcBillLine> = {}): GcBillLine => ({
  key,
  jobId: `job-${key}`,
  hcp: key,
  jobName: 'Dudley Mason',
  jobAddress: '233 Palomino Trail',
  customerName: 'Billy Garcia',
  referenceDateDisplay: 'Sep 21, 2026',
  ageDays: 7,
  remaining: 8780,
  inCollections: false,
  ...over,
})

const rows = [line('651'), line('790', { ageDays: 136, remaining: 1712.5, promisedYmd: '2026-09-15' }), line('186', { ageDays: null, promisedYmd: '2026-10-10' })]
const lineFor = (hcp: string) => within(screen.getAllByTestId('gc-bill-line').find((el) => within(el).queryByText(new RegExp(`^${hcp} ·`)))!)

beforeEach(() => {
  activity.fetch.mockReset()
  activity.fetch.mockResolvedValue({
    data: [1, 2, 3, 4, 5].map((n) => ({ id: `e${n}`, occurred_at: `2026-09-0${n}T15:00:00Z`, actor_name: 'Taunya', summary: `event ${n}`, event_type: 'note' })),
    error: null,
  })
})

describe('GcBillLines', () => {
  it('shows each bill’s job, age and what is owed', () => {
    render(<GcBillLines rows={rows} />)
    expect(screen.getAllByTestId('gc-bill-line')).toHaveLength(3)
    expect(lineFor('651').getByText('billed Sep 21, 2026 · 7d')).toBeTruthy()
    expect(lineFor('651').getByText('$8,780.00')).toBeTruthy()
    expect(lineFor('186').getByText('no bill-out date')).toBeTruthy()
    // Without a way to open the job, the job is text.
    expect(lineFor('651').queryByRole('button', { name: /Dudley Mason/ })).toBeNull()
  })

  it('says under a bill what paid it, when the row carries the line', () => {
    render(<GcBillLines rows={[line('651', { paidBy: '$2,000.00 paid by #4821 on Sep 10 · $6,780.00 still open' }), line('790')]} />)
    expect(screen.getAllByTestId('gc-bill-paid-by')).toHaveLength(1)
    expect(lineFor('651').getByText('$2,000.00 paid by #4821 on Sep 10 · $6,780.00 still open')).toBeTruthy()
  })

  it('the job link opens that job', () => {
    const onOpenJobDetail = vi.fn()
    render(<GcBillLines rows={rows} onOpenJobDetail={onOpenJobDetail} />)
    fireEvent.click(lineFor('790').getByRole('button', { name: '790 · Dudley Mason' }))
    expect(onOpenJobDetail).toHaveBeenCalledWith('job-790')
  })

  it('the chevron drops the job’s latest activity, newest first, and reads it once', async () => {
    render(<GcBillLines rows={rows} />)
    fireEvent.click(lineFor('651').getByRole('button', { name: 'Recent activity for 651' }))
    expect(await screen.findByText('event 5')).toBeTruthy()
    expect(screen.queryByText('event 1')).toBeNull()
    expect(screen.getAllByText(/^event \d$/).map((e) => e.textContent)).toEqual(['event 5', 'event 4', 'event 3', 'event 2'])
    fireEvent.click(lineFor('651').getByRole('button', { name: 'Recent activity for 651' }))
    expect(screen.queryByText('event 5')).toBeNull()
    fireEvent.click(lineFor('651').getByRole('button', { name: 'Recent activity for 651' }))
    expect(screen.getByText('event 5')).toBeTruthy()
    expect(activity.fetch).toHaveBeenCalledTimes(1)
    expect(activity.fetch).toHaveBeenCalledWith('job-651')
  })

  it('says when a job has no activity', async () => {
    activity.fetch.mockResolvedValue({ data: [], error: null })
    render(<GcBillLines rows={rows} />)
    fireEvent.click(lineFor('790').getByRole('button', { name: 'Recent activity for 790' }))
    expect(await screen.findByText('No activity recorded on this job yet.')).toBeTruthy()
  })

  it('shows the date a job was promised, late once it has passed — only when told today', () => {
    const { unmount } = render(<GcBillLines rows={rows} todayYmd="2026-09-28" />)
    expect(lineFor('790').getByText(/said Sep 15 · late/)).toBeTruthy()
    expect(lineFor('186').getByText(/said Oct 10/).textContent).not.toContain('late')
    expect(lineFor('651').queryByText(/^said/)).toBeNull()
    unmount()
    render(<GcBillLines rows={rows} />)
    expect(screen.queryByText(/^said/)).toBeNull()
  })

  it('names who was billed and marks a Collections bill, in either layout', () => {
    const withCollections = [line('651'), line('412', { inCollections: true, customerName: 'Rizvi Syed' })]
    const { unmount } = render(<GcBillLines rows={withCollections} showCustomer />)
    expect(lineFor('412').getByText(/Rizvi Syed/)).toBeTruthy()
    expect(lineFor('412').getByText('Collections')).toBeTruthy()
    expect(lineFor('651').queryByText('Collections')).toBeNull()
    unmount()
    render(<GcBillLines rows={withCollections} showCustomer compact />)
    expect(lineFor('412').getByText('Rizvi Syed')).toBeTruthy()
    expect(lineFor('412').getByText('billed Sep 21, 2026 · 7d')).toBeTruthy()
  })

  it('puts what it is given ahead of the job', () => {
    render(<GcBillLines rows={rows} leading={(r) => <input type="checkbox" aria-label={`Reviewed ${r.hcp}`} />} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(lineFor('790').getByRole('checkbox', { name: 'Reviewed 790' })).toBeTruthy()
  })
})
