// @vitest-environment jsdom
/**
 * Render smoke for Find a check: the newest checks show before anything is
 * typed, a number or an amount finds the check and reads out where it sits
 * and how it got there, and a miss says what else to try.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GcFindCheckModal from './GcFindCheckModal'
import type { GcChecksInputs } from '../../lib/jobs/gcChecksAppliedIo'

const io = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../lib/jobs/gcChecksAppliedIo', () => ({ fetchGcChecksInputs: io.fetch }))

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

  it('says when the read failed', async () => {
    io.fetch.mockRejectedValue(new Error('no route to host'))
    render(<GcFindCheckModal gcId="gc-1" gcName="Structura Builders" onClose={() => {}} />)
    expect(await screen.findByText('no route to host')).toBeTruthy()
  })
})
