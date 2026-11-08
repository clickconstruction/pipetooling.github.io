// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Line budgets (punch list #234 PR 1b): the four kinds with their
 * sliders and the read-out on a chosen line size, a drag moving one kind with materials giving way,
 * Save naming what it writes and the store taking the draft, Back to what you saved dropping it,
 * and the learning line offering a kind's settled number. The kernel's suite holds the arithmetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const saved: string[] = []
vi.mock('../../lib/supabase', () => {
  const tuned = [52, 50, 55, 52, 48, 53].map((l) => ({ name: 'Water heater', budget_labor_pct: l }))
  const builder = (rows: unknown) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok)
    b.update = (patch: { value_text: string }) => {
      saved.push(patch.value_text)
      const u: Record<string, unknown> = {}
      u.eq = () => u
      u.select = () => Promise.resolve({ data: [{ key: 'line_budget_settings_v1' }], error: null })
      return u
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table === 'jobs_ledger_fixtures' ? tuned : []) } }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'master_technician', user: { id: 'u1' }, profileName: 'Owner' }) }))
vi.mock('../../hooks/useBidCrewRate', () => ({ useBidCrewRate: () => ({ loading: false, crewRate: { companyRate: 48.2, avgFieldWage: 37, fieldHours: 900, burden: 1.2, overheadPerFieldHour: 10, fromYmd: '2026-08-09', toYmd: '2026-11-07' } }) }))
const showToast = vi.fn()
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast }) }))

import LineBudgetSettingsBlock from './LineBudgetSettingsBlock'
import { resetLineBudgetSettingsForTests } from '../../lib/jobs/lineBudgetSettingsStore'

beforeEach(() => {
  saved.length = 0
  showToast.mockClear()
  resetLineBudgetSettingsForTests()
})
afterEach(cleanup)

const slider = (name: string) => screen.getByLabelText(name) as HTMLInputElement

describe('LineBudgetSettingsBlock', () => {
  it('draws the four kinds read out on the picked line size, the rate with the roster beside it, and nothing to save', async () => {
    render(<LineBudgetSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('line-budget-saved-words').textContent).toBe('Every line still assumed reads these.'))
    expect(screen.getByTestId('line-budget-readout-rough_in').textContent).toBe('$4,500 labor · 100 h · $3,500 materials · $2,000 margin')
    fireEvent.click(screen.getByRole('button', { name: '$4,000' }))
    expect(screen.getByTestId('line-budget-readout-trim_set').textContent).toBe('$1,600 labor · 36 h · $1,600 materials · $800 margin')
    expect(screen.getByText('The roster ran $48.20 an hour over the last 90 days, burdened.')).toBeTruthy()
    expect((screen.getByTestId('line-budget-save') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('line-budget-save').textContent).toBe('Nothing changed yet')
  })

  it('a drag moves one kind with materials giving way; Save names what it writes and the store takes it', async () => {
    render(<LineBudgetSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('line-budget-saved-words').textContent).toBe('Every line still assumed reads these.'))
    fireEvent.change(slider('Any line labor percent'), { target: { value: '70' } })
    expect(slider('Any line materials percent').value).toBe('30')
    fireEvent.click(screen.getByRole('button', { name: 'Use the roster’s rate' }))
    expect(screen.getByTestId('line-budget-save').textContent).toBe('Save · 1 split and the rate')
    expect(screen.getByTestId('line-budget-saved-words').textContent).toBe('2 changes not saved yet.')
    fireEvent.click(screen.getByTestId('line-budget-save'))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(JSON.parse(saved[0]!)).toEqual({ rateUsd: 48.2, targetMarginPct: 20, splits: { rough_in: [45, 35], top_out: [45, 35], trim_set: [40, 40], any: [70, 30] } })
    await waitFor(() => expect(screen.getByTestId('line-budget-save').textContent).toBe('Nothing changed yet'))
    expect(showToast).toHaveBeenCalledWith('Saved 1 split and the rate. Every line still assumed reads the new numbers.', 'success')
  })

  it('Back to what you saved drops the draft; the learning line offers the settled number and the press takes it', async () => {
    render(<LineBudgetSettingsBlock />)
    await waitFor(() => expect(screen.getByTestId('learning-line-any').textContent).toContain('Your Any line lines ran 52% labor on the last 6 tunes, against the 45% default.'))
    fireEvent.change(slider('Rough In materials percent'), { target: { value: '20' } })
    expect(screen.getByTestId('line-budget-save').textContent).toBe('Save · 1 split')
    fireEvent.click(screen.getByRole('button', { name: 'Back to what you saved' }))
    expect(screen.getByTestId('line-budget-save').textContent).toBe('Nothing changed yet')
    fireEvent.click(screen.getByRole('button', { name: 'Use 52%' }))
    expect(slider('Any line labor percent').value).toBe('52')
    expect(screen.queryByTestId('learning-line-any')).toBeNull()
    expect(screen.getByTestId('line-budget-save').textContent).toBe('Save · 1 split')
  })
})
