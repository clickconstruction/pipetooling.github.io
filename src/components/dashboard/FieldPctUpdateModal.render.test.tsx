// @vitest-environment jsdom
/**
 * Render smokes for the field % done stepper (v2.1806): mounts, loads the
 * job's saved pct, moves it with the precise-number control (punch list #189,
 * PR 5a: quick picks, −5 and +5, a typed number, clamped), previews the delta,
 * and gates the Save button until something would actually be recorded.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { OFFLINE_READ_MESSAGE } from '../../lib/offlineRecoveryState'

let jobRow: { pct_complete: number | null; status: string | null } | null = {
  pct_complete: 45,
  status: 'working',
}
/** The job's read fails with this result error while set (v2.5962). */
let jobError: unknown = null
/** Report by line (v2.5664): the job's priced lines; null = a one-line job, the ± chips as before. */
let lineRows: unknown[] | null = null
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & {
    from: (table: string) => unknown
    rpc: (fn: string, args: unknown) => unknown
  }
  const originalFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'jobs_ledger') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve(jobError ? { data: null, error: jobError, status: 0 } : { data: jobRow, error: null })
      return builder
    }
    return originalFrom(table)
  }
  const originalRpc = stub.rpc.bind(stub)
  stub.rpc = (fn: string, args: unknown) => (fn === 'list_job_stage_progress' ? Promise.resolve({ data: lineRows, error: null }) : originalRpc(fn, args))
  return { supabase: stub }
})
// v2.2078: the modal reads useAuth (stepper saves file a report as the caller).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
// The app's own save path, answered here (v2.7260): the status report, the percent's mirror, and the move to Ready to Bill.
const reports: Array<{ jobId: string; pct: number }> = []
/** What the move answers: a refusal's words while set. */
let moveRefusal: string | null = null
const moves: string[] = []
vi.mock('../../lib/reports/submitStatusReportFromStepper', () => ({
  submitStatusReportFromStepper: async (args: { jobId: string; pct: number }) => {
    reports.push({ jobId: args.jobId, pct: args.pct })
    return { ok: true, fieldValues: {}, reportId: 'r1' }
  },
}))
vi.mock('../../lib/propagateReportPctToJob', () => ({ propagateReportPctToJob: async () => ({ jobStatus: jobRow?.status ?? null, pctError: null }) }))
vi.mock('../../lib/markJobReadyToBill', () => ({
  markJobReadyToBill: async (jobId: string) => {
    moves.push(jobId)
    return moveRefusal ? { ok: false, message: moveRefusal, variant: 'error' } : { ok: true, message: 'Job moved to Ready to Bill.', variant: 'error' }
  },
}))

import FieldPctUpdateModal from './FieldPctUpdateModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const JOB = { id: 'job-1', hcpNumber: 'J949', jobName: 'Dominguez- Run camera', label: 'J949 · Dominguez- Run camera' }

describe('FieldPctUpdateModal', () => {
  it('loads the saved pct as the base and disables Save until a change or note', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    const save = screen.getByText('Save 45%') as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it('a quick pick, +5 and a typed number move the job; the move shows, and 100 is the ceiling', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    expect(screen.getByText('How done is this job?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Job up 5' }))
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText('▲ 5')).toBeTruthy()
    expect((screen.getByText('Save 50%') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 75 percent' }))
    expect(screen.getByText('▲ 30')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Job is 75 percent. Tap to type a number' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Job percent, type a number' }), { target: { value: '120' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Job percent, type a number' }), { key: 'Enter' })
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('▲ 55')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Job up 5' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('−5 shows the ▼ correction, and Not now closes', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    const onClose = vi.fn()
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={onClose} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Job down 5' }))
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('▼ 5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('a null pct on a working job starts the control at 0, and −5 is dead there', async () => {
    jobRow = { pct_complete: null, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 0%')).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Job down 5' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Set Job to 25 percent' }))
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.getByText('▲ 25')).toBeTruthy()
  })

  it('a job with more than one line opens the list in place of the chips, holds Save until a line moves, and says the job number on the button (v2.5664)', async () => {
    jobRow = { pct_complete: 32, status: 'working' }
    lineRows = [
      { fixture_id: 'u', name: 'Underground', stage_kind: 'any', sequence_order: 1, weight_pct: '20', progress_pct: null, draw_paid: true },
      { fixture_id: 'r', name: 'Rough In', stage_kind: 'any', sequence_order: 2, weight_pct: '35', progress_pct: 35, draw_paid: false },
      { fixture_id: 't', name: 'Top Out', stage_kind: 'any', sequence_order: 3, weight_pct: '25', progress_pct: null, draw_paid: false },
      { fixture_id: 'w', name: 'Water heater', stage_kind: 'any', sequence_order: 4, weight_pct: '20', progress_pct: null, draw_paid: false },
    ]
    try {
      renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
      await waitFor(() => expect(screen.getByText('How far along is each stage?')).toBeTruthy())
      const held = (await screen.findByText('Save · job 32%')) as HTMLButtonElement
      expect(held.disabled).toBe(true)
      // The job's own control is off the screen while the list is on.
      expect(screen.queryByRole('button', { name: 'Job up 5' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Set Rough In to 50 percent' }))
      const ready = screen.getByText('Save · job 38%') as HTMLButtonElement
      expect(ready.disabled).toBe(false)
      expect(screen.getByText('Job 32% → 38%')).toBeTruthy()
      // The escape brings the job's own control back, with the saved number as the base.
      fireEvent.click(screen.getByText('Set the whole-job % instead'))
      expect(screen.getByRole('button', { name: 'Job up 5' })).toBeTruthy()
      expect(screen.getByText('Save 32%')).toBeTruthy()
      fireEvent.click(screen.getByText('Mark each line instead'))
      expect(screen.getByText('Save · job 38%')).toBeTruthy()
    } finally {
      lineRows = null
    }
  })

  it('Escape closes while the stepper is the top layer', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    const onClose = vi.fn()
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={onClose} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    // The sheet's frame (PhoneSheet) hears Escape on the document, one layer at a time.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('a lost signal reads the offline sentence with Retry where the number goes; Retry reads the job (v2.5962)', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    jobError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    try {
      renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
      await waitFor(() => expect(screen.getByText(OFFLINE_READ_MESSAGE)).toBeTruthy())
      jobError = null
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    } finally {
      jobError = null
    }
  })

  describe('Ready to Bill at 100% (v2.7260)', () => {
    const TICK = 'Also move to Ready to Bill'
    const open = async (row: { pct_complete: number | null; status: string | null }, first: string) => {
      jobRow = row
      reports.length = 0
      moves.length = 0
      moveRefusal = null
      const onClose = vi.fn()
      const onSaved = vi.fn()
      renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={onClose} onSaved={onSaved} />)
      await waitFor(() => expect(screen.getByText(first)).toBeTruthy())
      return { onClose, onSaved }
    }

    it('offers one tick when the number reaches 100 on a Working job, off until ticked, and Save names the move', async () => {
      await open({ pct_complete: 45, status: 'working' }, 'Save 45%')
      expect(screen.queryByTestId('pct-ready-to-bill')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      const line = screen.getByTestId('pct-ready-to-bill')
      // One tick, with what it says for the person who ticks it under it.
      expect(line.textContent).toBe('Also move to Ready to BillParts are reported, and the customer knows the work is done.')
      const tick = screen.getByRole('checkbox', { name: new RegExp(TICK) }) as HTMLInputElement
      expect(tick.checked).toBe(false)
      expect(screen.getByText('Save 100%')).toBeTruthy()
      fireEvent.click(tick)
      expect(screen.getByText('Save 100% and move to Ready to Bill')).toBeTruthy()
      // Off 100 the line goes, and Save is the number alone again.
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 75 percent' }))
      expect(screen.queryByTestId('pct-ready-to-bill')).toBeNull()
      expect(screen.getByText('Save 75%')).toBeTruthy()
    })

    it('files the report and then moves the job when the tick is on, with no second window', async () => {
      const { onClose, onSaved } = await open({ pct_complete: 45, status: 'working' }, 'Save 45%')
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(TICK) }))
      fireEvent.click(screen.getByText('Save 100% and move to Ready to Bill'))
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(reports).toEqual([{ jobId: 'job-1', pct: 100 }])
      expect(moves).toEqual(['job-1'])
      expect(onSaved).toHaveBeenCalledWith(100)
      expect(screen.queryByText('Move to Ready to Bill?')).toBeNull()
    })

    it('saves 100% alone when the tick is off: no move, and the old second window does not open', async () => {
      const { onClose, onSaved } = await open({ pct_complete: 45, status: 'working' }, 'Save 45%')
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      fireEvent.click(screen.getByText('Save 100%'))
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(reports).toEqual([{ jobId: 'job-1', pct: 100 }])
      expect(moves).toEqual([])
      expect(onSaved).toHaveBeenCalledWith(100)
      expect(screen.queryByText('Move to Ready to Bill?')).toBeNull()
    })

    it('keeps the percent and says why when the move is refused, then moves on a second press', async () => {
      const { onClose, onSaved } = await open({ pct_complete: 45, status: 'working' }, 'Save 45%')
      moveRefusal = 'You’re not allowed to change this job’s status.'
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(TICK) }))
      fireEvent.click(screen.getByText('Save 100% and move to Ready to Bill'))
      const held = await screen.findByTestId('pct-ready-to-bill-held')
      expect(held.textContent).toBe('The percent is saved. The job did not move to Ready to Bill. You’re not allowed to change this job’s status.')
      expect(screen.getByText('Saved at 100%')).toBeTruthy()
      // The report was filed once, and the window has not closed or told the page yet.
      expect(reports.length).toBe(1)
      expect(onClose).not.toHaveBeenCalled()
      expect(onSaved).not.toHaveBeenCalled()
      // The second press is the move alone: no second report.
      moveRefusal = null
      fireEvent.click(screen.getByRole('button', { name: 'Move to Ready to Bill' }))
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(moves).toEqual(['job-1', 'job-1'])
      expect(reports.length).toBe(1)
      expect(onSaved).toHaveBeenCalledWith(100)
    })

    it('tells the page the percent saved when a refused move is left where it is', async () => {
      const { onClose, onSaved } = await open({ pct_complete: 45, status: 'working' }, 'Save 45%')
      moveRefusal = 'Could not update job status.'
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(TICK) }))
      fireEvent.click(screen.getByText('Save 100% and move to Ready to Bill'))
      await screen.findByTestId('pct-ready-to-bill-held')
      fireEvent.click(screen.getByRole('button', { name: 'Leave it in Working' }))
      expect(onSaved).toHaveBeenCalledWith(100)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(moves).toEqual(['job-1'])
    })

    it('offers nothing on a job that is not Working', async () => {
      await open({ pct_complete: 90, status: 'ready_to_bill' }, 'Save 90%')
      fireEvent.click(screen.getByRole('button', { name: 'Set Job to 100 percent' }))
      expect(screen.getByText('Save 100%')).toBeTruthy()
      expect(screen.queryByTestId('pct-ready-to-bill')).toBeNull()
    })

    it('lets a job already at 100% and still Working move by the tick alone, with no second report', async () => {
      const { onClose, onSaved } = await open({ pct_complete: 100, status: 'working' }, 'Save 100%')
      expect((screen.getByText('Save 100%') as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(TICK) }))
      const save = screen.getByText('Save 100% and move to Ready to Bill') as HTMLButtonElement
      expect(save.disabled).toBe(false)
      fireEvent.click(save)
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(reports).toEqual([])
      expect(moves).toEqual(['job-1'])
      expect(onSaved).toHaveBeenCalledWith(100)
    })

    it('offers the same tick by line, once the lines add up to 100', async () => {
      lineRows = [
        { fixture_id: 'r', name: 'Rough In', stage_kind: 'any', sequence_order: 1, weight_pct: '60', progress_pct: 100, draw_paid: false },
        { fixture_id: 't', name: 'Top Out', stage_kind: 'any', sequence_order: 2, weight_pct: '40', progress_pct: 50, draw_paid: false },
      ]
      try {
        await open({ pct_complete: 80, status: 'working' }, 'How far along is each stage?')
        await screen.findByText('Save · job 80%')
        expect(screen.queryByTestId('pct-ready-to-bill')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Set Top Out to 100 percent' }))
        expect(screen.getByText('Save · job 100%')).toBeTruthy()
        fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(TICK) }))
        expect(screen.getByText('Save · job 100% and move to Ready to Bill')).toBeTruthy()
      } finally {
        lineRows = null
      }
    })
  })
})
