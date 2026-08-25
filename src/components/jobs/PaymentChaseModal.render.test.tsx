// @vitest-environment jsdom
/**
 * Render-smoke tests for PaymentChaseModal's promise builder (v2.2044):
 * three modes (a date / N days from today / N days after billing), live
 * per-bill landing chips, and the outcome-echoing apply button.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import PaymentChaseModal from './PaymentChaseModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildPaymentChaseQueue } from '../../lib/jobs/paymentChase'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const TODAY = '2026-08-21'

const speeds: PaySpeedData = {
  company: { medianDays: 16, samples: 40 },
  customers: { knight: { medianDays: 25, samples: 6 } },
  segments: { residential: { medianDays: 7, samples: 8 }, commercial: { medianDays: 25, samples: 32 } },
  customerTypes: { knight: 'commercial' },
  receipts: {},
  quality: null,
}

function invRow(jobId: string, invoiceId: string, amount: number, billedAt: string): StageRow {
  const job = {
    id: jobId,
    hcp_number: jobId.replace('j', '9'),
    click_number: null,
    job_name: 'Job',
    customer_id: 'knight',
    customer_name: 'Knight Contracting',
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: {
      id: invoiceId,
      job_id: jobId,
      amount,
      status: 'billed',
      sequence_order: 1,
      estimated_bill_date: null,
      billed_at: billedAt,
    },
  } as unknown as StageRow
}

function mountModal() {
  const queue = buildPaymentChaseQueue(
    [
      // Knight pays in ~25d, so both are past expected on 2026-08-21:
      // Jul 15 → expected Aug 9 (12d late); Jul 8 → expected Aug 2 (19d late).
      invRow('j1', 'i1', 3600, '2026-07-15T12:00:00Z'),
      invRow('j2', 'i2', 2700, '2026-07-08T12:00:00Z'),
    ],
    speeds,
    null,
    [],
    TODAY,
  )
  return renderWithProviders(
    <PaymentChaseModal
      queue={queue}
      loading={false}
      paySpeeds={speeds}
      todayYmd={TODAY}
      authRole={'dev'}
      onClose={vi.fn()}
      onRecorded={vi.fn()}
      onOpenInvoice={vi.fn()}
    />,
  )
}

describe('PaymentChaseModal promise builder', () => {
  it('mode "in N days": chip tap previews one shared landing date and arms the apply button', () => {
    mountModal()
    expect(screen.getByRole('button', { name: 'In N days' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '14d' }))
    // today (Aug 21) + 14 = Sep 4, same for both checked bills.
    expect(screen.getAllByText('→ Sep 4')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mark 2 promises → Sep 4' })).toBeTruthy()
  })

  it('mode "N days after billing": net chip previews a diverging date per bill', () => {
    mountModal()
    fireEvent.click(screen.getByRole('button', { name: 'N days after billing' }))
    fireEvent.click(screen.getByRole('button', { name: 'net 45' }))
    // Jul 15 + 45 = Aug 29; Jul 8 + 45 = Aug 22 — each bill lands on its own date.
    expect(screen.getByText('→ Aug 29')).toBeTruthy()
    expect(screen.getByText('→ Aug 22')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark 2 promises · Aug 22 – Aug 29' })).toBeTruthy()
    expect(screen.getByText(/each bill lands on its own date/)).toBeTruthy()
  })

  it('mode "a date": the picked date lands on every bill; empty input keeps the button disarmed', () => {
    mountModal()
    fireEvent.click(screen.getByRole('button', { name: '📅 A date' }))
    const apply = screen.getByRole('button', { name: 'Mark promise' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    expect(screen.getByText('pick the date they named')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The date they named'), { target: { value: '2026-08-28' } })
    expect(screen.getAllByText('→ Aug 28')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mark 2 promises → Aug 28' })).toBeTruthy()
  })

  it('unchecking a bill drops its landing chip and the button count follows', () => {
    mountModal()
    fireEvent.click(screen.getByRole('button', { name: '14d' }))
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[1] as HTMLElement)
    expect(screen.getAllByText('→ Sep 4')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Mark promise → Sep 4' })).toBeTruthy()
  })
})
