// @vitest-environment jsdom
/**
 * Render smokes for going down the Bridge's list of jobs with no percent (v2.7221): the facts above the app's own
 * percent window, a save that moves on to the next job, Skip and Back, and a close that shuts it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

/** What the save's status report answers; a refusal's words when set. */
let reportRefusal: string | null = null
const reports: Array<{ jobId: string; pct: number }> = []
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (table: string) => unknown; rpc: (fn: string, args: unknown) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'jobs_ledger') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: { pct_complete: null, status: 'working' }, error: null })
      return builder
    }
    return originalFrom(table)
  }
  const originalRpc = stub.rpc.bind(stub)
  // One-line jobs: the plain control, as on a job with no priced lines.
  stub.rpc = (fn: string, args: unknown) => (fn === 'list_job_stage_progress' ? Promise.resolve({ data: null, error: null }) : originalRpc(fn, args))
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
// The app's own save path, answered here: the window files a status report, then mirrors the percent onto the job.
vi.mock('../../lib/reports/submitStatusReportFromStepper', () => ({
  submitStatusReportFromStepper: async (args: { jobId: string; pct: number }) => {
    if (reportRefusal) return { ok: false, reason: 'error', message: reportRefusal }
    reports.push({ jobId: args.jobId, pct: args.pct })
    return { ok: true, fieldValues: {}, reportId: 'r1' }
  },
}))
vi.mock('../../lib/propagateReportPctToJob', () => ({ propagateReportPctToJob: async () => ({ jobStatus: 'working', pctError: null }) }))

import { useState } from 'react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgePctFacts, BridgePctRun } from './BridgePctRun'
import type { DivePctJob } from '../../lib/bridge/callDive'
import { PCT_FACTS_LINES_SHOWN, type PctJobFacts } from '../../lib/bridge/pctFacts'

// Made-up people on made-up jobs.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const TODAY = '2026-03-10'
const job = (n: number, name: string): DivePctJob => ({ id: `j${n}`, hcpNumber: String(n), jobName: name, label: `${n} · ${name}` })
const RUN = [job(301, 'Pine Row'), job(302, 'Spruce Hall'), job(303, 'Fir Lane')]
const pine: PctJobFacts = {
  chargeUsd: 9500,
  lines: [
    { key: 'l1', name: 'Rough in', usd: 4000, billed: true },
    { key: 'l2', name: 'Top out', usd: 3000, billed: false },
    { key: 'l3', name: 'Fixtures', usd: 3000, billed: false },
    { key: 'l4', name: 'Good neighbour', usd: -500, billed: false },
    { key: 'l5', name: 'Permit', usd: null, billed: false },
    { key: 'l6', name: 'Final', usd: 0, billed: false },
  ],
  billedUsd: 4000,
  lastWorked: { ymd: '2026-03-05', source: 'clocked', people: ['Sam Holt', 'Dana Reyes'] },
  nextScheduled: { ymd: '2026-03-12', people: ['Dana Reyes'] },
  hoursLine: '11 hours by Dana and Sam',
  lastPct: null,
}
const spruce: PctJobFacts = { chargeUsd: null, lines: [], billedUsd: 0, lastWorked: null, nextScheduled: null, hoursLine: 'No hours yet', lastPct: null }
const FACTS = new Map([
  ['j301', pine],
  ['j302', spruce],
])

/** The page's part: it holds which job the window is on. */
function Page({ start = RUN[0]!, run = RUN, onSaved = () => {}, onClosed = () => {} }: { start?: DivePctJob; run?: DivePctJob[]; onSaved?: (jobId: string, pct: number) => void; onClosed?: () => void }) {
  const [on, setOn] = useState<DivePctJob | null>(start)
  if (!on) return <div data-testid="closed" />
  return (
    <BridgePctRun
      job={on}
      run={run}
      facts={FACTS}
      factsError={null}
      todayYmd={TODAY}
      dayLabel={dayLabel}
      jobHref={(id) => `/jobs?tab=stages&edit=${id}`}
      onMove={setOn}
      onSaved={onSaved}
      onClose={() => {
        onClosed()
        setOn(null)
      }}
    />
  )
}

const ready = () => waitFor(() => expect(screen.getByText('Save 0%')).toBeTruthy())

describe('BridgePctFacts', () => {
  it('says what we charge, the days and the hours, then the job’s lines with their amounts', () => {
    renderWithProviders(<BridgePctFacts facts={pine} error={null} todayYmd={TODAY} dayLabel={dayLabel} jobHref="/jobs?tab=stages&edit=j301" />)
    expect(screen.getByTestId('bridge-pct-fact-charge').textContent).toBe('We are charging$9,500')
    expect(screen.getByTestId('bridge-pct-fact-billed').textContent).toBe('Billed so far$4,000 of $9,500')
    expect(screen.getByTestId('bridge-pct-fact-worked').textContent).toBe('Last workedMar 5. Clocked by Sam and Dana.')
    expect(screen.getByTestId('bridge-pct-fact-next').textContent).toBe('Next scheduledMar 12, for Dana.')
    expect(screen.getByTestId('bridge-pct-fact-hours').textContent).toBe('Hours so far11 hours by Dana and Sam.')
    // The first few lines, the rest on a press, and a line on a bill that went out says so.
    expect(screen.getByTestId('bridge-pct-lines').textContent).toContain('The job’s 6 lines')
    expect(screen.getAllByTestId('bridge-pct-line').map((l) => l.textContent)).toEqual(['Rough inbilled$4,000', 'Top out$3,000', 'Fixtures$3,000', 'Good neighbour−$500'])
    fireEvent.click(screen.getByRole('button', { name: 'and 2 more' }))
    expect(screen.getAllByTestId('bridge-pct-line').map((l) => l.textContent).slice(PCT_FACTS_LINES_SHOWN)).toEqual(['Permitno price', 'Final$0'])
    fireEvent.click(screen.getByRole('button', { name: `Show the first ${PCT_FACTS_LINES_SHOWN}` }))
    expect(screen.getAllByTestId('bridge-pct-line')).toHaveLength(PCT_FACTS_LINES_SHOWN)
  })

  it('says a job has no price and no lines, and offers the job, never $0', () => {
    renderWithProviders(<BridgePctFacts facts={spruce} error={null} todayYmd={TODAY} dayLabel={dayLabel} jobHref="/jobs?tab=stages&edit=j302" />)
    expect(screen.getByTestId('bridge-pct-fact-charge').textContent).toBe('We are chargingNo price yet. It is also on the list “Price the jobs with no price”.')
    expect(screen.getByTestId('bridge-pct-fact-worked').textContent).toBe('Last workedNot worked yet.')
    expect(screen.queryByTestId('bridge-pct-fact-billed')).toBeNull()
    expect(screen.getByTestId('bridge-pct-lines').textContent).toBe('The job’s linesThis job has no lines yet. Open the job to add them.')
    expect(screen.getByRole('link', { name: 'Open the job' }).getAttribute('href')).toBe('/jobs?tab=stages&edit=j302')
    expect(screen.getByTestId('bridge-pct-facts').textContent).not.toContain('$0')
  })

  it('says it is reading, and a failed read says its reason', () => {
    const { rerender } = renderWithProviders(<BridgePctFacts facts={null} error={null} todayYmd={TODAY} dayLabel={dayLabel} jobHref="/x" />)
    expect(screen.getByTestId('bridge-pct-facts').textContent).toBe('Reading the job’s lines and days…')
    rerender(<BridgePctFacts facts={null} error="permission denied for table job_schedule_blocks" todayYmd={TODAY} dayLabel={dayLabel} jobHref="/x" />)
    expect(screen.getByTestId('bridge-pct-facts').textContent).toBe('The job’s lines and days could not be read. permission denied for table job_schedule_blocks')
  })
})

describe('BridgePctRun', () => {
  beforeEach(() => {
    reportRefusal = null
    reports.length = 0
  })

  it('draws the facts above the app’s percent control, and a save moves on to the next job', async () => {
    const onSaved = vi.fn()
    const onClosed = vi.fn()
    renderWithProviders(<Page onSaved={onSaved} onClosed={onClosed} />)
    await ready()
    const win = screen.getByRole('dialog', { name: 'Update % done for 301 · Pine Row' })
    expect(within(win).getByTestId('bridge-pct-run-place').textContent).toBe('Job 1 of 3 without a percent')
    expect(within(win).getByTestId('bridge-pct-fact-charge').textContent).toBe('We are charging$9,500')
    expect(within(win).getByTestId('bridge-pct-run-next-note').textContent).toBe('Save moves on to the next job.')
    // Two presses: a percent, then Save.
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 50 percent' }))
    fireEvent.click(screen.getByText('Save 50%'))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update % done for 302 · Spruce Hall' })).toBeTruthy())
    expect(reports).toEqual([{ jobId: 'j301', pct: 50 }])
    expect(onSaved).toHaveBeenCalledWith('j301', 50)
    expect(onClosed).not.toHaveBeenCalled()
    // The next job opens clean, on its own facts, and the place holds still.
    await ready()
    expect(screen.getByTestId('bridge-pct-run-place').textContent).toBe('Job 2 of 3 without a percent')
    expect(screen.getByTestId('bridge-pct-fact-charge').textContent).toContain('No price yet')
  })

  it('skips and goes back without saving, and comes back to a skipped job before it closes', async () => {
    const onSaved = vi.fn()
    const onClosed = vi.fn()
    renderWithProviders(<Page onSaved={onSaved} onClosed={onClosed} />)
    await ready()
    expect(screen.queryByTestId('bridge-pct-run-back')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Skip to 302 · Spruce Hall' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update % done for 302 · Spruce Hall' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Skip to 303 · Fir Lane' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update % done for 303 · Fir Lane' })).toBeTruthy())
    expect(screen.queryByTestId('bridge-pct-run-skip')).toBeNull()
    expect(reports).toEqual([])
    // The last job on the list, saved: the run comes back to the first one skipped.
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 25 percent' }))
    fireEvent.click(screen.getByText('Save 25%'))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update % done for 301 · Pine Row' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Skip to 302 · Spruce Hall' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back to 301 · Pine Row' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update % done for 301 · Pine Row' })).toBeTruthy())
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('closes after the last job is saved, and Not now closes with nothing saved', async () => {
    const onSaved = vi.fn()
    const onClosed = vi.fn()
    const { unmount } = renderWithProviders(<Page run={[RUN[0]!]} onSaved={onSaved} onClosed={onClosed} />)
    await ready()
    // One job: nothing to count, skip or move on to.
    expect(screen.queryByTestId('bridge-pct-run-place')).toBeNull()
    expect(screen.queryByTestId('bridge-pct-run-next-note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 75 percent' }))
    fireEvent.click(screen.getByText('Save 75%'))
    await waitFor(() => expect(screen.getByTestId('closed')).toBeTruthy())
    expect(onSaved).toHaveBeenCalledWith('j301', 75)
    unmount()
    onClosed.mockClear()
    renderWithProviders(<Page onSaved={onSaved} onClosed={onClosed} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.getByTestId('closed')).toBeTruthy()
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('keeps the window on the job and says the reason when a save is refused', async () => {
    reportRefusal = 'new row violates row-level security policy'
    const onSaved = vi.fn()
    renderWithProviders(<Page onSaved={onSaved} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 50 percent' }))
    fireEvent.click(screen.getByText('Save 50%'))
    await waitFor(() => expect(screen.getByText(/row-level security/)).toBeTruthy())
    expect(screen.getByRole('dialog', { name: 'Update % done for 301 · Pine Row' })).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('leads the list with a job opened from elsewhere on the page', async () => {
    renderWithProviders(<Page start={job(310, 'Elm Court')} />)
    await ready()
    expect(screen.getByTestId('bridge-pct-run-place').textContent).toBe('Job 1 of 4 without a percent')
    expect(screen.getByRole('button', { name: 'Skip to 301 · Pine Row' })).toBeTruthy()
  })
})
