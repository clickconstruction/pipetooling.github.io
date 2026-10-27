// @vitest-environment jsdom
/**
 * Render smoke for the Dashboard AR call card's *They promised…* (punch list #184, sweep A,
 * PR 2): the promise is written on every job past one that fails, the bill on the job that did
 * not take is named with the reason, and the next Save covers only that job.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { ArCustomerRow } from '../lib/arCustomerRollup'
import DashboardArCallCard from './DashboardArCallCard'

const settled = vi.fn(async (_args: { jobYmds: ReadonlyArray<readonly [string, string]> }) => ({ saved: ['j1'], failed: [{ jobId: 'j2', why: 'You do not have access to this job.' }], untouched: [] as Array<{ jobId: string; why: string }> }))
vi.mock('../lib/jobs/paymentChaseIo', () => ({
  addPaymentChaseTouch: async () => {},
  recordPromiseForJobsSettled: (args: { jobYmds: ReadonlyArray<readonly [string, string]> }) => settled(args),
}))

afterEach(() => {
  cleanup()
  settled.mockClear()
})

const bill = (key: string, jobId: string, label: string, amount: number) => ({
  item: { key, label, sublabel: null, amount, dateYmd: '2026-09-01', jobId, address: null },
  waitDays: 55,
  tone: 'late' as const,
})

const ROW = {
  customerId: 'c1',
  name: 'Cedar Bend Holdings',
  segment: null,
  ownMedianDays: 20,
  baselineDays: 20,
  oldestWaitDays: 55,
  open: 6300,
  pastPace: true,
  bills: [bill('k1', 'j1', '964 · Hartline', 3600), bill('k2', 'j2', '971 · Ridgeway', 2700)],
} as unknown as ArCustomerRow

describe('the AR call card’s promise', () => {
  it('names the bill whose job did not take, and the next Save covers only that job', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<DashboardArCallCard row={ROW} paySpeeds={null} touches={null} todayYmd="2026-10-26" canAct linesByJob={null} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'They promised…' }))
    fireEvent.change(screen.getByLabelText('Promised payment date'), { target: { value: '2026-11-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save promise (2 jobs)' }))
    const missed = await waitFor(() => {
      const el = document.querySelector('[data-ar-promise-missed]')
      if (!el) throw new Error('no missed list yet')
      return el
    })
    expect(settled.mock.calls[0]![0].jobYmds.map(([j]) => j)).toEqual(['j1', 'j2'])
    expect(missed.textContent).toContain('1 bill did not take. It stays here with the reason.')
    expect(missed.textContent).toContain('971 · Ridgeway · You do not have access to this job.')
    expect(onChanged).toHaveBeenCalledTimes(1)
    settled.mockImplementationOnce(async () => ({ saved: ['j2'], failed: [], untouched: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Save promise (1 job)' }))
    await waitFor(() => expect(document.querySelector('[data-ar-promise-missed]')).toBeNull())
    expect(settled.mock.calls[1]![0].jobYmds.map(([j]) => j)).toEqual(['j2'])
  })
})
