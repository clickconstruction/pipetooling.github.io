// @vitest-environment jsdom
/**
 * Render smoke for Find a check: the newest checks show before anything is
 * typed, a number or an amount finds the check and reads out where it sits
 * and how it got there, a miss says what else to try, and the sheet prints
 * (a PDF since v2.4913) or downloads for the period.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GcFindCheckModal from './GcFindCheckModal'
import type { GcChecksInputs } from '../../lib/jobs/gcChecksAppliedIo'

const io = vi.hoisted(() => ({
  fetch: vi.fn(),
  fetchDev: vi.fn(),
  /** What the PDF was built from: the name, the report, the day. */
  pdf: vi.fn(async (..._args: unknown[]) => new Blob(['%PDF'], { type: 'application/pdf' })),
  built: vi.fn(),
  filed: vi.fn(),
  how: vi.fn((): 'opened' | 'blocked' | 'failed' => 'opened'),
}))
vi.mock('../../lib/jobs/gcChecksAppliedIo', () => ({ fetchGcChecksInputs: io.fetch, fetchDevelopmentChecksInputs: io.fetchDev }))
vi.mock('../../lib/jobsDocuments/gcChecksAppliedPdf', () => ({ gcChecksSheetPdfBlob: io.pdf }))
vi.mock('../../lib/sent/sentCopiesIo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sent/sentCopiesIo')>()
  return {
    ...actual,
    printPdfAndFile: async (build: () => Promise<{ blob: Blob; fileName: string }>, filing: Record<string, unknown>) => {
      const how = io.how()
      if (how !== 'opened') return how
      io.built(await build())
      io.filed(filing)
      return how
    },
  }
})
vi.mock('../../lib/formatJobDetailModalDateYmd', () => ({ todayYmdChicago: () => '2026-09-28' }))

const inputs: GcChecksInputs = {
  jobs: [
    {
      id: 'oak',
      click_number: '1041',
      job_name: 'Oak Ridge Ph 2',
      job_address: '4410 Oak Ridge Dr',
      customer_id: 'owner',
      gc_customer_id: 'gc-1',
      bill_to_party: 'gc',
      lien_retainage_held: null,
      invoices: [
        { id: 'oak-1', job_id: 'oak', sequence_order: 1, amount: 9750, status: 'paid', billed_at: '2026-08-01' },
        { id: 'oak-2', job_id: 'oak', sequence_order: 2, amount: 13333, status: 'billed', billed_at: '2026-09-08' },
      ],
      payments: [
        { id: 'p1', job_id: 'oak', invoice_id: 'oak-1', amount: 9750, paid_on: '2026-09-10', payment_type: 'check', reference_number: '48102' },
        { id: 'p2', job_id: 'oak', invoice_id: 'oak-2', amount: 12000, paid_on: '2026-09-24', sent_on: '2026-09-19', payment_type: 'check', reference_number: '48211' },
      ],
    },
    {
      id: 'maple',
      click_number: '1058',
      job_name: 'Maple Ct',
      job_address: '210 Maple Ct',
      customer_id: 'owner',
      gc_customer_id: 'gc-1',
      bill_to_party: 'gc',
      lien_retainage_held: null,
      invoices: [{ id: 'maple-1', job_id: 'maple', sequence_order: 1, amount: 6400, status: 'paid', billed_at: '2026-09-01' }],
      payments: [{ id: 'p3', job_id: 'maple', invoice_id: 'maple-1', amount: 6400, paid_on: '2026-09-24', payment_type: 'check', reference_number: '48211' }],
    },
  ],
  events: [{ id: 'e1', kind: 'moved', payment_id: 'p2', from_job_id: 'maple', to_job_id: 'oak', amount: 12000, created_at: '2026-09-26T16:00:00Z' }],
  deposits: [],
}

describe('GcFindCheckModal', () => {
  it('reads the GC’s payments, shows the newest checks, then finds one by number with its trail', async () => {
    io.fetch.mockResolvedValue(inputs)
    const onClose = vi.fn()
    render(<GcFindCheckModal gcId="gc-1" gcName="Structura Builders" onClose={onClose} />)
    expect(await screen.findByText('Newest 2 of 2')).toBeTruthy()
    expect(io.fetch).toHaveBeenCalledWith('gc-1')
    expect(screen.getAllByTestId('gc-found-check')).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Check number, amount or the day it was received'), { target: { value: '48211' } })
    expect(screen.getByText('1 match')).toBeTruthy()
    expect(screen.getAllByTestId('gc-found-check')).toHaveLength(1)
    expect(screen.getByText('Check #48211 · $18,400.00 · received Sep 24, 2026 (mailed Sep 19)')).toBeTruthy()
    expect(screen.getByText('Applied now to $6,400.00 on 210 Maple Ct · 1058 Maple Ct, Invoice 1 of 1, which it paid in full and $12,000.00 on 4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2, Invoice 2 of 2.')).toBeTruthy()
    expect(screen.getByText('$12,000.00 moved from 210 Maple Ct · 1058 Maple Ct to 4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2 on Sep 26')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Check number, amount or the day it was received'), { target: { value: '$9,750' } })
    expect(screen.getByText(/Check #48102/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Check number, amount or the day it was received'), { target: { value: '99999' } })
    expect(screen.getByText(/No check matches “99999”/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close Find a check' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('prints the sheet for the last twelve months, widens to everything, and downloads the CSV', async () => {
    io.fetch.mockResolvedValue({
      ...inputs,
      jobs: [
        ...inputs.jobs,
        {
          id: 'old',
          click_number: '900',
          job_name: 'Old job',
          job_address: '1 Old Rd',
          customer_id: 'owner',
          gc_customer_id: 'gc-1',
          bill_to_party: 'gc',
          lien_retainage_held: null,
          invoices: [{ id: 'old-1', job_id: 'old', sequence_order: 1, amount: 100, status: 'paid', billed_at: '2024-01-01' }],
          payments: [{ id: 'p0', job_id: 'old', invoice_id: 'old-1', amount: 100, paid_on: '2024-02-01', payment_type: 'check', reference_number: '1' }],
        },
      ],
    })
    io.pdf.mockClear()
    io.built.mockClear()
    io.filed.mockClear()
    render(<GcFindCheckModal gcId="gc-1" gcName="Structura Builders" onClose={() => {}} />)
    expect(await screen.findByText(/The sheet: 2 payments since Sep 28, 2025/)).toBeTruthy()

    // The sheet is a PDF (v2.4913): built from the period's report, named for the GC and the day, filed under the GC.
    fireEvent.click(screen.getByRole('button', { name: '🖨 Print the sheet' }))
    await waitFor(() => expect(io.filed).toHaveBeenCalledTimes(1))
    expect(io.pdf.mock.calls[0]![0]).toBe('Structura Builders')
    expect(io.pdf.mock.calls[0]![1]).toMatchObject({ sinceYmd: '2025-09-28', earlierCount: 1 })
    expect(io.pdf.mock.calls[0]![2]).toEqual({ asOfYmd: '2026-09-28' })
    expect(io.built.mock.calls[0]![0]).toMatchObject({ fileName: 'checks-applied_Structura-Builders_2026-09-28.pdf' })
    expect(io.filed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'gc_checks_applied', title: 'Checks applied for Structura Builders', customerId: 'gc-1' }))

    fireEvent.click(screen.getByRole('button', { name: 'show all 3' }))
    expect(screen.getByText(/The sheet: 3 payments on record/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: '🖨 Print the sheet' }))
    await waitFor(() => expect(io.pdf).toHaveBeenCalledTimes(2))
    expect(io.pdf.mock.calls[1]![1]).toMatchObject({ sinceYmd: null, earlierCount: 0 })

    // A refused tab builds nothing and says how to allow it.
    io.how.mockReturnValueOnce('blocked')
    fireEvent.click(await screen.findByRole('button', { name: '🖨 Print the sheet' }))
    expect(await screen.findByText(/The browser blocked the new tab/)).toBeTruthy()
    expect(io.pdf).toHaveBeenCalledTimes(2)

    const createObjectURL = vi.fn(() => 'blob:sheet')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:sheet')
    click.mockRestore()
  })

  it('under By development (v2.4912): reads the development\'s jobs, counts the owner\'s bill too, and files the sheet under those jobs', async () => {
    const owners = {
      id: 'elm',
      click_number: '1070',
      job_name: 'Elm St',
      job_address: '12 Elm St',
      customer_id: 'owner',
      gc_customer_id: 'gc-1',
      bill_to_party: 'customer',
      lien_retainage_held: null,
      invoices: [{ id: 'elm-1', job_id: 'elm', sequence_order: 1, amount: 2500, status: 'paid', billed_at: '2026-09-02' }],
      payments: [{ id: 'p9', job_id: 'elm', invoice_id: 'elm-1', amount: 2500, paid_on: '2026-09-20', payment_type: 'check', reference_number: '7001' }],
    }
    io.fetchDev.mockResolvedValue({ ...inputs, jobs: [...inputs.jobs, owners] })
    io.fetch.mockClear()
    io.filed.mockClear()
    render(<GcFindCheckModal gcId="dev-sage" gcName="Sage Meadows" byDevelopment onClose={() => {}} />)
    // Three checks: the GC's two and the owner's #7001, which a GC's own sheet leaves out.
    expect(await screen.findByText('Newest 3 of 3')).toBeTruthy()
    expect(io.fetchDev).toHaveBeenCalledWith('dev-sage')
    expect(io.fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Check number, amount or the day it was received'), { target: { value: '7001' } })
    expect(screen.getByText(/Check #7001/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '🖨 Print the sheet' }))
    await waitFor(() => expect(io.filed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'gc_checks_applied', title: 'Checks applied for Sage Meadows', jobIds: ['oak', 'maple', 'elm'] })))
    expect(io.filed.mock.calls[0]![0]).not.toHaveProperty('customerId')
  })

  it('says when the read failed', async () => {
    io.fetch.mockRejectedValue(new Error('no route to host'))
    render(<GcFindCheckModal gcId="gc-1" gcName="Structura Builders" onClose={() => {}} />)
    expect(await screen.findByText('no route to host')).toBeTruthy()
  })
})
