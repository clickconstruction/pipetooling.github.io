// @vitest-environment jsdom
/**
 * Render smokes for TwinOwnerMemoCard (v2.3232) — a pre-rule multi-decision ask
 * on the Console: the robot's text, the split into one-decision drafts, and
 * Post writing the drafts as the robot's own open questions before retiring
 * the original with a note saying where the decisions went.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TwinOwnerMemoCard } from './TwinOwnerMemoCard'

const LEGACY =
  'Three decisions for Wendi: (1) SMALL-TI RESIDUAL — approve either a footage residual (~$6-8k) or ~30% higher per-fixture all-ins? (2) TAKE 5 PROTO PACKAGE — approve minting a package entry? Also confirm: CA piping is plumber scope on Take 5s? (3) HUNTER RD BAND — bank this as a market-band flag rather than recalibrating the book down.'

const questions = [
  { id: '836b6c22-b8e0-4fb5-856d-b4e9d071099c', twin_user_id: 'twin-1', about_bid_id: 'shell-425', mission: 'backtest-slate-2026-08-31', question: LEGACY, status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-01T04:23:26Z', audience: 'estimator', kind: 'decision', topic: null, choices: null, recommended: null },
  { id: 'q-new', twin_user_id: 'twin-1', about_bid_id: null, mission: null, question: 'Carry travel past 200 miles?', status: 'open', answer: null, answered_by: null, answered_at: null, created_at: '2026-09-02T04:23:26Z', audience: 'estimator', kind: 'decision', topic: 'travel-bands', choices: ['Yes', 'No'], recommended: 'Yes' },
]

const inserted: unknown[] = []
const updates: Array<{ patch: Record<string, unknown>; id: string }> = []
// Rows an earlier Post already wrote (the retry scenario) — empty by default.
let priorSplits: Array<{ id: string; mission: string }> = []

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'robert' } } }) },
    from: (table: string) => {
      if (table === 'users') return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: 'twin-1', name: 'Twin Estimator 1', email: 't@x' }], error: null }) }) }) }
      if (table === 'twin_questions')
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: questions, error: null }) }) }),
            ilike: () => Promise.resolve({ data: priorSplits, error: null }),
          }),
          insert: (rows: unknown[]) => {
            inserted.push(...rows)
            return { select: () => Promise.resolve({ data: rows.map((_, i) => ({ id: `new-${i}` })), error: null }) }
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_c: string, id: string) => ({ eq: () => ({ select: () => { updates.push({ patch, id }); return Promise.resolve({ data: [{ id }], error: null }) } }) }),
          }),
        }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }), eq: () => Promise.resolve({ data: [], error: null }) }) }
    },
  },
}))

describe('TwinOwnerMemoCard', () => {
  it('shows the pre-rule ask split into decisions and posts them as the robot, retiring the original', async () => {
    renderWithProviders(<TwinOwnerMemoCard />)
    await waitFor(() => expect(screen.getByText('Owner memo · 1')).toBeTruthy())
    // The one-tap question is not a memo.
    expect(screen.queryByText('Carry travel past 200 miles?')).toBeNull()
    // Four decisions: the three numbered parts plus the "Also confirm".
    expect(screen.getByText('Small-ti residual')).toBeTruthy()
    expect(screen.getByText('Take 5 proto package')).toBeTruthy()
    expect(screen.getByText('Take 5 proto package · also')).toBeTruthy()
    expect(screen.getByText('Hunter rd band')).toBeTruthy()
    // "either A or B" became two taps.
    expect((screen.getByLabelText('Decision 1 taps') as HTMLInputElement).value).toBe('footage residual, ~30% higher per-fixture all-ins')
    expect(screen.getByText(/nothing re-asks on its own/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Post 4 as one-tap questions' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(inserted).toHaveLength(4)
    expect(inserted[0]).toMatchObject({ twin_user_id: 'twin-1', about_bid_id: 'shell-425', status: 'open', audience: 'estimator', kind: 'decision', topic: 'small-ti-residual', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' })
    expect(inserted[2]).toMatchObject({ question: 'CA piping is plumber scope on Take 5s?', choices: ['Yes', 'No'] })
    expect(updates[0]).toMatchObject({ id: '836b6c22-b8e0-4fb5-856d-b4e9d071099c', patch: { status: 'dismissed', answer: 'Re-asked as 4 one-decision questions from the Console.' } })
  })

  it('refuses to post while a draft breaks the one-decision rule, and names the problem', async () => {
    inserted.length = 0
    updates.length = 0
    renderWithProviders(<TwinOwnerMemoCard />)
    await waitFor(() => expect(screen.getByText('Owner memo · 1')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Decision 1 taps'), { target: { value: 'Only one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post 4 as one-tap questions' }))
    expect(await screen.findByText(/only 1 distinct choice/)).toBeTruthy()
    expect(inserted).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('a retry after a half-failed Post finds the rows already written, skips the insert, and only retires the original (v2.3236)', async () => {
    inserted.length = 0
    updates.length = 0
    priorSplits = [
      { id: 'p1', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
      { id: 'p2', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
      { id: 'p3', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
      { id: 'p4', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
    ]
    renderWithProviders(<TwinOwnerMemoCard />)
    await waitFor(() => expect(screen.getByText('Owner memo · 1')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Post 4 as one-tap questions' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(inserted).toHaveLength(0)
    expect(updates[0]).toMatchObject({ id: '836b6c22-b8e0-4fb5-856d-b4e9d071099c', patch: { status: 'dismissed', answer: 'Re-asked as 4 one-decision questions from the Console.' } })
    priorSplits = []
  })
})
