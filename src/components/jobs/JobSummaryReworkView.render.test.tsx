// @vitest-environment jsdom
/**
 * The Rework view's callback verdict (punch list #255, v2.6589): an unpressed pair offers both presses weighing the
 * same; a press records the verdict and the row reads the chip with the other press; a crew lead reads *not pressed*;
 * a refused press names its reason. The pairs themselves are the kernel's (`findReworkPairs` is mocked here).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobCallbacksIo } from '../../lib/jobs/jobCallbacksIo'
import type { JobCallbackRow } from '../../lib/jobs/jobCallbacks'

const auth = vi.hoisted(() => ({ role: 'assistant' as string, readOnly: false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, readOnly: auth.readOnly, profileName: 'Rosa Office', user: { id: 'viewer' } }) }))

vi.mock('../../lib/jobs/jobSummaryRework', async (orig) => {
  const real = await orig<typeof import('../../lib/jobs/jobSummaryRework')>()
  const pair = {
    first: { jobId: 'j-first', number: '1184', name: 'Water heater', startYmd: '2026-10-01', doneYmd: '2026-10-05' },
    second: { jobId: 'j-second', number: '1199', name: 'Leak at the heater', startYmd: '2026-10-17', doneYmd: '2026-10-17' },
    daysAfter: 12,
    kind: 'callback' as const,
    addressLabel: '1208 Mesquite Ln',
    returnCostUsd: 180,
    returnRevenueUsd: 0,
  }
  return { ...real, findReworkPairs: () => [pair], reworkRateBy: () => [], summarizeRework: () => ({ finishedJobs: 10, returns: 1, ratePct: 10, returnCostUsd: 180, returnRevenueUsd: 0, unplaced: 0 }) }
})

import JobSummaryReworkView from './JobSummaryReworkView'

function ioWith(rows: JobCallbackRow[], fail?: string): JobCallbacksIo & { setVerdict: ReturnType<typeof vi.fn> } {
  return {
    forFirstJobs: vi.fn(async () => rows),
    setVerdict: vi.fn(async () => {
      if (fail) throw new Error(fail)
    }),
  }
}

const mount = (io: JobCallbacksIo) => render(<JobSummaryReworkView allRows={[]} ledger={null} ledgerLoading={false} userNameById={new Map()} showMoney={false} onOpenJob={() => undefined} callbacksIo={io} />)

afterEach(() => {
  cleanup()
  auth.role = 'assistant'
  auth.readOnly = false
})

describe('JobSummaryReworkView · the callback verdict', () => {
  it('offers both presses on an unpressed pair, and a press records the verdict and reads the chip', async () => {
    const io = ioWith([])
    mount(io)
    expect(await screen.findByRole('button', { name: 'It was a callback' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not a callback' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'It was a callback' }))
    await waitFor(() => expect(io.setVerdict).toHaveBeenCalledWith('j-first', 'j-second', 'callback', 'Rosa Office'))
    expect(await screen.findByText(/^Callback · Rosa Office · /)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not a callback' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'It was a callback' })).toBeNull()
  })

  it('reads a recorded verdict with the other press beside it; a crew lead reads not pressed', async () => {
    mount(ioWith([{ first_job_id: 'j-first', second_job_id: 'j-second', verdict: 'not_callback', decided_by_name: 'Lou', decided_at: '2026-11-05T15:00:00Z' }]))
    expect(await screen.findByText('Not a callback · Lou · Nov 5')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'It was a callback' })).toBeTruthy()
    cleanup()
    auth.role = 'primary'
    mount(ioWith([]))
    expect(await screen.findByText('not pressed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'It was a callback' })).toBeNull()
  })

  it('a refused press names its reason', async () => {
    mount(ioWith([], 'The verdict was not recorded. The leader and the office press it, and the push that adds it must be on.'))
    fireEvent.click(await screen.findByRole('button', { name: 'Not a callback' }))
    expect((await screen.findByRole('alert')).textContent).toContain('The verdict was not recorded.')
  })
})
