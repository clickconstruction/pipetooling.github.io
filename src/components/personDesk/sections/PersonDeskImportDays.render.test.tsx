// @vitest-environment jsdom
/**
 * The import door on the desk (punch list #265, PR 3): a dev pastes days on one job; the job is looked up by its number,
 * the rows go to import_clock_sessions, and the answer draws line by line with every refusal named.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { PersonDeskImportDays } from './PersonDeskImportDays'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

const rpc = vi.fn()
const jobRow: { data: unknown; error: null } = { data: { id: 'j-1064', job_name: 'ZZ TEST sink', billing_only: false }, error: null }

vi.mock('../../../lib/supabase', () => {
  const b: Record<string, unknown> = {}
  for (const op of ['select', 'eq']) b[op] = () => b
  b.maybeSingle = () => Promise.resolve(jobRow)
  return { supabase: { from: () => b, rpc: (...args: unknown[]) => rpc(...args) } }
})

describe('PersonDeskImportDays', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { inserted: 1, skipped: 1, refused: [{ row: 2, reason: 'a day of more than sixteen hours' }] }, error: null })
  })

  it('opens on the press, refuses a missing job number, and sends the rows the function takes', async () => {
    const onImported = vi.fn()
    renderWithProviders(<PersonDeskImportDays userId="u-rio" displayName="Rio Vance" onImported={onImported} />)
    fireEvent.click(screen.getByTestId('import-days-open'))
    fireEvent.change(screen.getByLabelText('Days to import'), { target: { value: '2026-10-06, 8, bank row of Oct 10\n2026-10-07, 16, bank row of Oct 10\n2026-10-08, 8, bank row of Oct 10' } })
    fireEvent.click(screen.getByRole('button', { name: "Import Rio Vance's days" }))
    expect((await screen.findByRole('alert')).textContent).toContain('Name the job by its number')
    expect(rpc).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Job number'), { target: { value: 'JP1064' } })
    fireEvent.click(screen.getByRole('button', { name: "Import Rio Vance's days" }))
    const result = await screen.findByTestId('import-days-result')
    expect(result.textContent).toContain('1 day went in, waiting for approval.')
    expect(result.textContent).toContain('1 day was already there and was skipped.')
    expect(result.textContent).toContain('Line 2: refused — a day of more than sixteen hours.')
    expect(rpc).toHaveBeenCalledTimes(1)
    const [name, args] = rpc.mock.calls[0] as [string, { p_rows: Array<Record<string, unknown>> }]
    expect(name).toBe('import_clock_sessions')
    expect(args.p_rows).toHaveLength(3)
    expect(args.p_rows[0]).toMatchObject({ user_id: 'u-rio', job_ledger_id: 'j-1064', work_date: '2026-10-06', notes: 'bank row of Oct 10' })
    expect(onImported).toHaveBeenCalled()
  })

  it('names a line that will not read and sends nothing when none reads', async () => {
    renderWithProviders(<PersonDeskImportDays userId="u-rio" displayName="Rio Vance" onImported={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-days-open'))
    fireEvent.change(screen.getByLabelText('Job number'), { target: { value: '1064' } })
    fireEvent.change(screen.getByLabelText('Days to import'), { target: { value: '2026-10-06, 8' } })
    fireEvent.click(screen.getByRole('button', { name: "Import Rio Vance's days" }))
    expect((await screen.findByRole('alert')).textContent).toContain('Line 1: not sent — the note must name where the day came from.')
    expect(rpc).not.toHaveBeenCalled()
  })
})
