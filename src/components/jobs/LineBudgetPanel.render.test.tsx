// @vitest-environment jsdom
/**
 * The brush on a line's budget panel (punch list #234 PR 1b): the owner's press carries the open
 * line's split onto the job's other assumed lines as ✎ tuned, Undo puts their nothing back, a job
 * with no other assumed line offers no brush, and the office sees none. The sliders themselves are
 * PR 1's and the fixtures section's smokes hold them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

let role = 'master_technician'
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => ({ role }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { LineBudgetPanel } from './LineBudgetQuietLine'
import { openLineBudget } from '../../hooks/useLineBudgets'
import { lineBudgetColumnsFor, DEFAULT_LINE_BUDGET_SETTINGS as S, type LineBudgetWrite } from '../../lib/jobs/lineBudgets'

beforeEach(() => {
  role = 'master_technician'
  openLineBudget('f1', { laborPct: 45, materialsPct: 35, source: 'assumed' })
})
afterEach(cleanup)

function harness(others: number) {
  const applied: LineBudgetWrite[] = []
  let undone = 0
  const brush = {
    others,
    apply: (columns: LineBudgetWrite) => {
      applied.push(columns)
      return () => {
        undone += 1
      }
    },
  }
  const row = lineBudgetColumnsFor({ laborPct: 60, materialsPct: 25, source: 'tuned', tunedAt: '2026-11-07T00:00:00Z' }, S)
  render(<LineBudgetPanel fixtureId="f1" name="Water heater" priceUsd={4000} row={row} onChange={() => {}} brush={brush} />)
  return { applied, undone: () => undone }
}

describe('LineBudgetPanel · the brush', () => {
  it('carries the open line’s split onto the other assumed lines as tuned, and Undo takes it back', () => {
    const h = harness(3)
    fireEvent.click(screen.getByRole('button', { name: 'Brush onto the 3 other assumed lines' }))
    expect(h.applied).toHaveLength(1)
    expect(h.applied[0]).toMatchObject({ budget_labor_pct: 60, budget_materials_pct: 25, budget_source: 'tuned', budget_rate_usd: 45 })
    expect(h.applied[0]!.budget_tuned_at).toBeTruthy()
    expect(screen.getByTestId('line-budget-brush').textContent).toContain('Brushed onto 3 lines · each reads ✎ tuned')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(h.undone()).toBe(1)
    expect(screen.getByRole('button', { name: 'Brush onto the 3 other assumed lines' })).toBeTruthy()
  })

  it('no other assumed line, no brush; the office sees none either', () => {
    harness(0)
    expect(screen.queryByTestId('line-budget-brush')).toBeNull()
    cleanup()
    role = 'assistant'
    harness(3)
    expect(screen.queryByTestId('line-budget-brush')).toBeNull()
  })
})
