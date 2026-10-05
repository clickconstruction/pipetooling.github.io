// @vitest-environment jsdom
/**
 * Render smoke for the Lien desk's Timeline tab (v2.3890): a row per job with
 * its Next line, and under it who we are waiting on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import LienDeskTimelineTab from './LienDeskTimelineTab'
import { buildLienTimelineBook, type LienBookJob } from '../../lib/jobs/lienTimelineBook'
import type { LienNoticeMonthRow } from '../../lib/jobs/lienDesk'

afterEach(cleanup)

const TODAY = '2026-09-23'
const row = (job_id: string, work_month: string, deadline: string): LienNoticeMonthRow => ({ job_id, work_month, deadline, approved_hours: 40, noticed: false, open_balance: 10_000, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null })
const job = (id: string): LienBookJob => ({ id, label: `${id.slice(1)} · Job ${id}`, address: `${id} Main St`, gcId: 'gc1', gcName: 'Loberg Contracting', propertyKind: 'non_residential', homestead: false, county: 'Comal', ownerName: 'Elbel Holdings LLC', openBalance: 10_000, lastWorkDate: '2026-08-20', isSub: true })

const book = buildLienTimelineBook({
  rows: [row('j891', '2026-07', '2026-10-15')],
  affidavitRows: [],
  items: [],
  filingsByJob: {},
  demandLettersByJob: { j891: [{ id: 'd1', job_id: 'j891', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Loberg', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null } as never] },
  jobs: { j891: job('j891') },
  policyByCustomer: { gc1: 'ask' },
  todayYmd: TODAY,
})

describe('LienDeskTimelineTab', () => {
  it('draws the job’s row with Next and, under it, who we are waiting on', () => {
    const onOpenRow = vi.fn()
    render(<LienDeskTimelineTab book={book} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={() => {}} onOpenRow={onOpenRow} onPrint={() => {}} />)
    const r = document.querySelector('[data-lien-book-row="j891"]') as HTMLElement
    expect(r.textContent).toContain('891 · Job j891')
    const waiting = r.querySelector('[data-lien-book-waiting]') as HTMLElement
    expect(waiting.textContent).toMatch(/^Waiting on the GC — /)
    fireEvent.click(r)
    expect(onOpenRow).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j891' }))
  })

  it('the job number is its own door to the job; the rest of the row still opens its pane (v2.4535)', () => {
    const onOpenRow = vi.fn()
    const onOpenJob = vi.fn()
    render(<LienDeskTimelineTab book={book} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={() => {}} onOpenRow={onOpenRow} onOpenJob={onOpenJob} onPrint={() => {}} />)
    const r = document.querySelector('[data-lien-book-row="j891"]') as HTMLElement
    const number = within(r).getByRole('button', { name: '891' })
    fireEvent.click(number)
    expect(onOpenJob).toHaveBeenCalledWith('j891')
    expect(onOpenRow).not.toHaveBeenCalled()
    // The name is the row's own button: its click opens the pane, as a click anywhere on the row does.
    fireEvent.click(within(r).getByRole('button', { name: 'Job j891' }))
    expect(onOpenRow).toHaveBeenCalledTimes(1)
    expect(onOpenJob).toHaveBeenCalledTimes(1)
  })
})
