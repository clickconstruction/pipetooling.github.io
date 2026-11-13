// @vitest-environment jsdom
/**
 * The Pay speeds window's Money waiting list for a payer on a Pay calendar (punch list #323, v2.7127):
 * the row leads with how far past expected their worst bill is, and each bill names its due day.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaySpeedsBreakdownModal from './PaySpeedsBreakdownModal'

vi.mock('../customers/CustomerPortalGlobeButton', () => ({ default: () => null }))
vi.mock('../customers/PayCalendarLine', () => ({ default: () => null }))
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null })), from: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profileName: 'Dana Whitfield' }),
}))
import type { PayReceipt, PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT } from '../../lib/jobs/payCalendar'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { settle } from '../../test/renderSmokeMocks'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

const TODAY = '2026-11-22'

const receipt = (billedYmd: string, paidYmd: string): PayReceipt => ({ billedYmd, paidYmd, gapDays: 0, jobId: null, jobName: null, address: null })

const speeds: PaySpeedData = {
  company: { medianDays: 11, samples: 40 },
  customers: { lark: { medianDays: 41, samples: 3 } },
  segments: { residential: null, commercial: { medianDays: 41, samples: 3 } },
  customerTypes: { lark: 'commercial' },
  // Paid the 10th of the next month, each of the last three landing 6 days after it.
  receipts: { lark: [receipt('2026-07-10', '2026-08-16'), receipt('2026-08-06', '2026-09-16'), receipt('2026-09-03', '2026-10-16')] },
  quality: null,
}

function bill(amount: number, billedYmd: string, jobName: string): StageRow {
  const job = { id: `j-${jobName}`, customer_id: 'lark', customer_name: 'Larkfield Construction', job_name: jobName, job_address: null, payments: [], invoices: [] } as unknown as JobWithDetails
  return { kind: 'invoice', job, inv: { id: `inv-${jobName}`, job_id: job.id, amount, status: 'billed', sequence_order: 1, billed_at: `${billedYmd}T18:00:00Z` } } as unknown as StageRow
}

// Lot 4 was due Oct 10 and expected Oct 16. Lot 6 is due Dec 10.
const rows = [bill(9000, '2026-09-28', 'Lot 4'), bill(2500, '2026-11-03', 'Lot 6')]
const payCalendars = indexPayCalendars([{ payerCustomerId: 'lark', jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null }])

describe('Money waiting for a payer on a Pay calendar', () => {
  it('leads with how far past expected they are, and names each bill’s due day', async () => {
    render(<PaySpeedsBreakdownModal todayYmd={TODAY} rows={rows} paySpeeds={speeds} onClose={vi.fn()} payCalendars={payCalendars} />)
    await settle()
    expect(screen.getByTestId('money-waiting-lead').textContent).toBe('37d past expected')
    expect(screen.getByText(/pay calendar · lands ~6d after the pay day/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('money-waiting-lead'))
    await settle()
    expect(screen.getByText('due Oct 10 · 37d past expected')).toBeTruthy()
    expect(screen.getByText('due Dec 10')).toBeTruthy()
  })

  it('reads the same payer by their wait when no calendar is passed', async () => {
    render(<PaySpeedsBreakdownModal todayYmd={TODAY} rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    expect(screen.getByTestId('money-waiting-lead').textContent).toBe('55d waiting')
    expect(screen.getByText(/usually ~41d/)).toBeTruthy()
  })
})
