// @vitest-environment jsdom
/**
 * The field report's percent opens on the job's number (punch list #189, PR 5a; the card's follow-up: an untouched
 * Save on a one-line job wrote 0 to the job). The form reads the job's recorded percent with its links, seeds the
 * untouched percent field with it, says so under the field, and an untouched Save files that number; a pick files
 * the pick and the line reads *Was 40%.*
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

let jobRow: Record<string, unknown> | null = { pct_complete: 40, status: 'working', google_drive_link: null, job_pictures_link: null }
const inserted: Array<Record<string, unknown>> = []

/** A table whose every chain ends in `rows` (or the first row for `.single()` / `.maybeSingle()`). */
function table(rows: () => unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit', 'in', 'is', 'not', 'gte']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    b.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return b
    }
    const result = () => Promise.resolve(single ? { data: rows()[0] ?? null, error: null } : { data: rows(), error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown; rpc: (fn: string, args: unknown) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (t: string) => {
    if (t === 'report_templates') return table(() => [{ id: 't1', name: 'Status Report', sequence_order: 1 }])
    if (t === 'report_template_fields') return table(() => [{ id: 'f1', template_id: 't1', label: 'How complete is the job?', input_type: 'percent_0_100', sequence_order: 1 }])
    if (t === 'jobs_ledger') return table(() => (jobRow ? [jobRow] : []))
    if (t === 'reports') return table(() => [{ id: 'r1' }])
    return originalFrom(t)
  }
  const originalRpc = stub.rpc.bind(stub)
  stub.rpc = (fn: string, args: unknown) => {
    if (fn === 'list_job_stage_progress') return Promise.resolve({ data: [], error: null })
    if (fn === 'set_job_pct_from_field') return Promise.resolve({ data: { ok: true }, error: null })
    return originalRpc(fn, args)
  }
  ;(stub.auth as Record<string, unknown>).getUser = () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })
  return { supabase: stub }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import AdditionalReportModal from './AdditionalReportModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

// The body scroll lock restores the page's scroll on close; jsdom has no scrollTo.
window.scrollTo = () => {}

const props = { open: true, onClose: vi.fn(), onSaved: vi.fn(), authUserId: 'u1', userRole: 'helpers' as const, jobId: 'job-1', hcpNumber: 'PLUM 512', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln' }

describe('AdditionalReportModal', () => {
  it('opens the percent on the job’s 40%, says so, and an untouched Save files 40', async () => {
    inserted.length = 0
    jobRow = { pct_complete: 40, status: 'working', google_drive_link: null, job_pictures_link: null }
    renderWithProviders(<AdditionalReportModal {...props} />)
    await waitFor(() => expect(screen.getByText("Opens on the job's 40%. Leave it, and the report files 40%.")).toBeTruthy())
    expect(screen.getByText('40%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }))
    await waitFor(() => expect(inserted).toHaveLength(1))
    expect((inserted[0]!.field_values as Record<string, string>)['How complete is the job?']).toBe('40')
  })

  it('a pick files the pick, and the line under the field reads what it was', async () => {
    inserted.length = 0
    jobRow = { pct_complete: 40, status: 'working', google_drive_link: null, job_pictures_link: null }
    renderWithProviders(<AdditionalReportModal {...props} />)
    await waitFor(() => expect(screen.getByText("Opens on the job's 40%. Leave it, and the report files 40%.")).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Set How complete is the job? to 75 percent' }))
    expect(screen.getByText('Was 40%.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }))
    await waitFor(() => expect(inserted).toHaveLength(1))
    expect((inserted[0]!.field_values as Record<string, string>)['How complete is the job?']).toBe('75')
  })

  it('a job with no number yet opens on 0, as the card shows it', async () => {
    inserted.length = 0
    jobRow = { pct_complete: null, status: 'working', google_drive_link: null, job_pictures_link: null }
    renderWithProviders(<AdditionalReportModal {...props} />)
    await waitFor(() => expect(screen.getByText("Opens on the job's 0%. Leave it, and the report files 0%.")).toBeTruthy())
  })
})
