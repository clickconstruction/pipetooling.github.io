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
import { buildLienProperties } from '../../lib/jobs/lienPropertyPapers'

afterEach(cleanup)

const TODAY = '2026-09-23'
const row = (job_id: string, work_month: string, deadline: string): LienNoticeMonthRow => ({ job_id, work_month, deadline, approved_hours: 40, noticed: false, open_balance: 10_000, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null })
const job = (id: string): LienBookJob => ({ id, label: `${id.slice(1)} · Job ${id}`, address: `${id} Main St`, gcId: 'gc1', gcName: 'Lowbeck Contracting', propertyKind: 'non_residential', homestead: false, county: 'Comal', ownerName: 'Elwick Holdings LLC', openBalance: 10_000, lastWorkDate: '2026-08-20', isSub: true })

const book = buildLienTimelineBook({
  rows: [row('j891', '2026-07', '2026-10-15')],
  affidavitRows: [],
  items: [],
  filingsByJob: {},
  demandLettersByJob: { j891: [{ id: 'd1', job_id: 'j891', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Lowbeck', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null } as never] },
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

  it('an empty book on Something due offers Show All as a press; on All it is the good state (punch list #184, sweep C)', () => {
    const empty = buildLienTimelineBook({ rows: [], affidavitRows: [], items: [], filingsByJob: {}, demandLettersByJob: {}, jobs: {}, policyByCustomer: {}, todayYmd: TODAY })
    const onShow = vi.fn()
    render(<LienDeskTimelineTab book={empty} loading={false} error="" gcId={null} onGcId={() => {}} show="due" onShow={onShow} onOpenRow={() => {}} onPrint={() => {}} />)
    const due = document.querySelector('[data-lien-book-empty="due"] [data-empty-state]') as HTMLElement
    expect(due.textContent).toBe('Nothing is due inside 30 days on these jobs. Show All › lists the whole book.')
    fireEvent.click(within(due).getByRole('button', { name: 'Show All ›' }))
    expect(onShow).toHaveBeenCalledWith('all')
    cleanup()
    render(<LienDeskTimelineTab book={empty} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={onShow} onOpenRow={() => {}} onPrint={() => {}} />)
    const all = document.querySelector('[data-lien-book-empty="all"] [data-empty-state]') as HTMLElement
    expect(all.textContent).toBe('No job has money open and a lien month.')
    expect(within(all).queryByRole('button')).toBeNull()
  })

  it('on a phone the two pickers and Print the grid are a thumb tall, and a computer keeps its own (punch list #352)', () => {
    const controls = () => {
      const tab = document.querySelector('[data-lien-desk-timeline-tab]') as HTMLElement
      const [gc, show] = [...tab.querySelectorAll('select')] as HTMLSelectElement[]
      const print = within(tab).getByRole('button', { name: '⎙ Print the grid' }) as HTMLButtonElement
      return { gc: gc!, show: show!, print, bar: tab.firstElementChild as HTMLElement }
    }
    // A computer: the small pickers and the small press, as they were.
    const desk = render(<LienDeskTimelineTab book={book} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={() => {}} onOpenRow={() => {}} onPrint={() => {}} />)
    const wide = controls()
    expect([wide.gc.style.minHeight, wide.gc.style.fontSize, wide.gc.style.padding]).toEqual(['', '0.78rem', '2px 6px'])
    expect([wide.print.style.minHeight, wide.print.style.fontSize, wide.print.style.padding]).toEqual(['', '0.78rem', '2px 10px'])
    expect(wide.bar.style.position).toBe('sticky')
    desk.unmount()
    // A phone: 44 px, and 16 px words in a picker so an iPhone does not zoom the page.
    render(<LienDeskTimelineTab book={book} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={() => {}} onOpenRow={() => {}} onPrint={() => {}} phone />)
    const phone = controls()
    for (const picker of [phone.gc, phone.show]) expect([picker.style.minHeight, picker.style.fontSize]).toEqual(['44px', '1rem'])
    expect([phone.print.style.minHeight, phone.print.style.fontSize]).toEqual(['44px', '0.875rem'])
    // The taller bar scrolls away with the list in place of staying pinned over it.
    expect(phone.bar.style.position).toBe('static')
  })

  it('a row on a property with more jobs says so, and the press opens the property card and not the row (v2.7488)', () => {
    const shared = buildLienTimelineBook({
      rows: [row('j891', '2026-07', '2026-10-15'), row('j892', '2026-07', '2026-10-15'), row('j900', '2026-07', '2026-10-15')],
      affidavitRows: [],
      items: [],
      filingsByJob: {},
      jobs: { j891: { ...job('j891'), addressId: 'p1', propertyAddress: '412 Ridgeline Dr' }, j892: { ...job('j892'), addressId: 'p1', propertyAddress: '412 Ridgeline Dr' }, j900: { ...job('j900'), addressId: null } },
      policyByCustomer: { gc1: 'ask' },
      todayYmd: TODAY,
    })
    const onOpenRow = vi.fn()
    const onOpenProperty = vi.fn()
    const onSetProperty = vi.fn()
    render(<LienDeskTimelineTab book={shared} loading={false} error="" gcId={null} onGcId={() => {}} show="all" onShow={() => {}} onOpenRow={onOpenRow} onPrint={() => {}} properties={buildLienProperties(shared.rows)} onOpenProperty={onOpenProperty} onSetProperty={onSetProperty} />)
    const door = within(document.querySelector('[data-lien-book-row="j892"]') as HTMLElement).getByRole('button', { name: '412 Ridgeline Dr · 2 jobs here ›' })
    fireEvent.click(door)
    expect(onOpenProperty).toHaveBeenCalledWith('p1', 'j892')
    const bare = document.querySelector('[data-lien-book-row="j900"] [data-lien-book-no-property]') as HTMLElement
    expect(bare.textContent).toContain('No property record')
    fireEvent.click(within(bare).getByRole('button', { name: 'Set the property ›' }))
    expect(onSetProperty).toHaveBeenCalledWith('j900')
    expect(onOpenRow).not.toHaveBeenCalled()
  })
})
