// @vitest-environment jsdom
/**
 * Render smokes for the field % done stepper (v2.1806): mounts, loads the
 * job's saved pct, steps with the chips (clamped), previews the delta, and
 * gates the Save button until something would actually be recorded.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

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

  it('steps with the chips, shows the move, clamps at 100', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.click(screen.getByText('+20'))
    expect(screen.getByText('65%')).toBeTruthy()
    expect(screen.getByText('▲ 20')).toBeTruthy()
    expect((screen.getByText('Save 65%') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('+20'))
    fireEvent.click(screen.getByText('+20'))
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('▲ 55')).toBeTruthy()
  })

  it('steps down show the ▼ correction', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.click(screen.getByText('−5'))
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('▼ 5')).toBeTruthy()
  })

  it('a null pct on a working job starts the stepper at 0', async () => {
    jobRow = { pct_complete: null, status: 'working' }
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 0%')).toBeTruthy())
    fireEvent.click(screen.getByText('+20'))
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText('▲ 20')).toBeTruthy()
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
      await waitFor(() => expect(screen.getByText('How far along is each line?')).toBeTruthy())
      const held = (await screen.findByText('Save · job 32%')) as HTMLButtonElement
      expect(held.disabled).toBe(true)
      // The chips are off the screen while the list is on.
      expect((screen.getByText('+20').parentElement as HTMLElement).style.display).toBe('none')
      fireEvent.click(screen.getByRole('button', { name: 'Set Rough In to 50 percent' }))
      const ready = screen.getByText('Save · job 38%') as HTMLButtonElement
      expect(ready.disabled).toBe(false)
      expect(screen.getByText('Job 32% → 38%')).toBeTruthy()
      // The escape brings the chips back, with the saved number as the base.
      fireEvent.click(screen.getByText('Set the whole-job % instead'))
      expect((screen.getByText('+20').parentElement as HTMLElement).style.display).toBe('grid')
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
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('a lost signal reads the offline sentence with Retry where the number goes; Retry reads the job (v2.5962)', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    jobError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    try {
      renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={vi.fn()} onSaved={vi.fn()} />)
      await waitFor(() => expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy())
      jobError = null
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    } finally {
      jobError = null
    }
  })
})
