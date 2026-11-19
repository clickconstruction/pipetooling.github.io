// @vitest-environment jsdom
/**
 * What a Billed or Collections row adds beside its buttons (the Stages map's step 23): the bank-returned ⚠, a job-shell
 * row's pill, and the shell's own They said…. Made-up jobs and amounts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StagesBilledRowExtras } from './StagesBilledRowExtras'
import { bankReturnedBadgeTitle, bankReturnedBadgeWords } from '../../lib/jobs/bankReturnedDeposits'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

afterEach(cleanup)

const RETURNED = { count: 1, total: 250, reason: 'NSF' }
const shellRow = (extra: Record<string, unknown> = {}): StageRow => ({ kind: 'job', job: makeJob({ id: 'shell-1', job_name: 'Shell Diner', hcp_number: '878', status: 'billed', revenue: 800, payments_made: 0, invoices: [], ...extra }) })
function billRow(): StageRow {
  const job = makeJob({ id: 'bill-1', job_name: 'Billed Villa', status: 'billed', revenue: 900, payments_made: 0 })
  return { kind: 'invoice', job, inv: makeInvoice({ id: 'inv-1', job_id: 'bill-1', amount: 900, status: 'billed', billed_at: '2026-11-01T18:00:00Z' }) }
}
function draw(row: StageRow, over: Partial<Parameters<typeof StagesBilledRowExtras>[0]> = {}) {
  const onOpenPayments = vi.fn()
  const onOpenPromise = vi.fn()
  const onRowClick = vi.fn()
  render(
    <div onClick={onRowClick}>
      <StagesBilledRowExtras row={row} promise={null} bankReturned={null} canMarkPromisedPay={true} onOpenPayments={onOpenPayments} onOpenPromise={onOpenPromise} {...over} />
    </div>,
  )
  return { onOpenPayments, onOpenPromise, onRowClick }
}

describe('StagesBilledRowExtras', () => {
  it('a returned deposit wears the ⚠ with the bank’s words; the press opens the job’s payments and not the row', () => {
    const row = billRow()
    const { onOpenPayments, onRowClick } = draw(row, { bankReturned: RETURNED })
    const badge = screen.getByTestId('stages-bank-returned-bill-1')
    expect(badge.textContent).toBe(`⚠ ${bankReturnedBadgeWords(RETURNED)}`)
    expect(badge.getAttribute('title')).toBe(bankReturnedBadgeTitle(RETURNED))
    fireEvent.click(badge)
    expect(onOpenPayments).toHaveBeenCalledWith(row.job)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('a bill row with a returned deposit wears only the ⚠: no pill and no They said…', () => {
    draw(billRow(), { bankReturned: RETURNED })
    expect(screen.queryByText('No bill line')).toBeNull()
    expect(screen.queryByText(/In Collections/)).toBeNull()
    expect(screen.queryByRole('button', { name: /They said/ })).toBeNull()
  })

  it('a billed job with no bill line wears No bill line, and says why it cannot age', () => {
    draw(shellRow())
    const pill = screen.getByText('No bill line')
    expect(pill.getAttribute('title')).toContain("can't age, be chased, or be forecast")
    expect(screen.queryByTestId('stages-bank-returned-shell-1')).toBeNull()
  })

  it('a Collections shell ages from the day the office flagged it', () => {
    const flaggedYmd = ymdAddDays(todayYmdInAppTz(), -12)
    draw(shellRow({ collections_at: `${flaggedYmd}T18:00:00.000Z` }))
    const pill = screen.getByText('In Collections 12 days · no bill line')
    expect(pill.getAttribute('title')).toContain(`Flagged difficult to collect ${flaggedYmd}.`)
    expect(screen.queryByText('No bill line')).toBeNull()
  })

  it('one day reads as a day', () => {
    draw(shellRow({ collections_at: `${ymdAddDays(todayYmdInAppTz(), -1)}T18:00:00.000Z` }))
    expect(screen.getByText('In Collections 1 day · no bill line')).toBeTruthy()
  })

  it('a shell’s They said… opens the promise window on the job, named by its number and name', () => {
    const { onOpenPromise } = draw(shellRow())
    fireEvent.click(screen.getByRole('button', { name: 'They said…' }))
    expect(onOpenPromise).toHaveBeenCalledWith({ jobId: 'shell-1', jobLabel: '878 · Shell Diner', initialYmd: null })
  })

  it('with a date already named, the press offers a new date and opens on the old one', () => {
    const { onOpenPromise } = draw(shellRow(), { promise: { promisedYmd: '2026-11-25', markedByName: 'Office Made' } })
    fireEvent.click(screen.getByRole('button', { name: 'They said… (new date)' }))
    expect(onOpenPromise).toHaveBeenCalledWith({ jobId: 'shell-1', jobLabel: '878 · Shell Diner', initialYmd: '2026-11-25' })
  })

  it('a role that cannot mark a promise gets the pill and no They said…', () => {
    draw(shellRow(), { canMarkPromisedPay: false })
    expect(screen.getByText('No bill line')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /They said/ })).toBeNull()
  })

  it('a shell with a returned deposit wears both', () => {
    draw(shellRow(), { bankReturned: RETURNED })
    expect(screen.getByTestId('stages-bank-returned-shell-1')).toBeTruthy()
    expect(screen.getByText('No bill line')).toBeTruthy()
  })

  it('a job with no name is named Job', () => {
    const { onOpenPromise } = draw(shellRow({ job_name: '   ' }))
    fireEvent.click(screen.getByRole('button', { name: 'They said…' }))
    expect(onOpenPromise.mock.calls[0]![0].jobLabel).toBe('878 · Job')
  })
})
