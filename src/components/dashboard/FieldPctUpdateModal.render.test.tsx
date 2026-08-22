// @vitest-environment jsdom
/**
 * Render smokes for the field % done stepper (v2.1806): mounts, loads the
 * job's saved pct, steps with the chips (clamped), previews the delta, and
 * gates the Save button until something would actually be recorded.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

let jobRow: { pct_complete: number | null; status: string | null } | null = {
  pct_complete: 45,
  status: 'working',
}
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & {
    from: (table: string) => unknown
  }
  const originalFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'jobs_ledger') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: jobRow, error: null })
      return builder
    }
    return originalFrom(table)
  }
  return { supabase: stub }
})
// v2.2078: the modal reads useAuth (stepper saves file a report as the caller).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

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

  it('Escape closes while the stepper is the top layer', async () => {
    jobRow = { pct_complete: 45, status: 'working' }
    const onClose = vi.fn()
    renderWithProviders(<FieldPctUpdateModal job={JOB} onClose={onClose} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
