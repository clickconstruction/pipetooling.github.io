// @vitest-environment jsdom
/**
 * Render smoke for Job Summary → Days: the tiles mount over a small ledger and
 * the since-then strip (Job Summary follow-up 7) renders under them with the
 * week chips the window offers.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { buildJobDayLedger } from '../../lib/jobs/jobDayLedger'
import type { OtherJobsLaborDetailLine } from '../../lib/overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'
import JobSummaryDaysView from './JobSummaryDaysView'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const line = (ymd: string, job: string): OtherJobsLaborDetailLine => ({ sessionId: `${ymd}-${job}`, workDate: ymd, userName: 'Terry', hours: 8, laborUsd: 240, missingWage: false, jobLedgerId: job, notes: null })
const detail = new Map<string, OtherJobsLaborDetailLine[]>()
for (const d of ['2026-08-03', '2026-08-25']) detail.set(d, [line(d, 'j1')])
detail.set('2026-08-28', [line('2026-08-28', 'j3')])

const ledger = buildJobDayLedger({
  startYmd: '2026-08-01',
  endYmd: '2026-08-31',
  officeJobLedgerId: 'office',
  fieldDetailByDay: detail,
  poolUsdByDay: new Map(),
  jobLabels: new Map([
    ['j1', { number: 'J1', name: 'One', status: 'billed' }],
    ['j3', { number: 'J3', name: 'Three', status: 'working' }],
  ]),
  statusSpansByJob: new Map([
    ['j1', { startYmd: '2026-07-20', endYmd: '2026-08-26', billedYmd: '2026-08-26', paidYmd: null }],
    ['j3', { startYmd: '2026-08-27', endYmd: null }],
  ]),
  addDays: ymdAddDays,
})

const base = { ledgerLoading: false, ledgerError: null, jobLabelById: new Map(), showMoney: false, canOpenSessionNotes: false, users: [], jobs: [] }

describe('JobSummaryDaysView', () => {
  it('renders the since-then strip under the tiles with the week chips the window offers', () => {
    const { container } = render(<JobSummaryDaysView {...base} ledger={ledger} statusByJob={new Map()} todayYmd="2026-08-31" />)
    const strip = container.querySelector('[data-job-run-delta-strip]')
    expect(strip?.textContent).toContain('Since Mon Aug 24:')
    expect(strip?.textContent).toContain('1 job opened')
    expect(strip?.textContent).toContain('1 billed')
    const chips = Array.from(container.querySelectorAll('[aria-label="Since"] button'))
    expect(chips.map((b) => b.textContent)).toEqual(['1 wk', '2 wk', '3 wk', '4 wk'])
    const fourWeeks = chips[3]
    if (!fourWeeks) throw new Error('expected a 4 wk chip')
    fireEvent.click(fourWeeks)
    expect(container.querySelector('[data-job-run-delta-strip]')?.textContent).toContain('Since Mon Aug 3:')
  })
  it('shows no strip without a ledger', () => {
    const { container } = render(<JobSummaryDaysView {...base} ledger={null} />)
    expect(container.querySelector('[data-job-run-delta-strip]')).toBeNull()
    expect(container.textContent).toContain('No day ledger yet.')
  })
})
