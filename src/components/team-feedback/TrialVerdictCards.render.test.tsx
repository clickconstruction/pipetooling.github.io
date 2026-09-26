// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { buildTrialVerdictCards, type TrialVerdictFeedRow } from '../../lib/hiring/trialVerdicts'

const upsert = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) => {
        upsert(table, row, opts)
        return { select: async () => ({ data: [{ id: 'v1' }], error: null }) }
      },
    }),
  },
}))

import TrialVerdictCards from './TrialVerdictCards'

const feedRow = (over: Partial<TrialVerdictFeedRow> = {}): TrialVerdictFeedRow => ({
  prospect_id: 'p1', helper_user_id: 'u1', helper_name: 'Bryan Ortiz', work_date: '2026-09-21', job_id: 'j1', hcp_number: '258', click_number: null,
  job_name: 'Oak St', customer_name: 'Acme', trial_day: 4, verdict: null, note: null, ...over,
})
const cardsOf = (rows: TrialVerdictFeedRow[]) => buildTrialVerdictCards(rows, { todayYmd: '2026-09-21' })

describe('TrialVerdictCards', () => {
  beforeEach(() => upsert.mockClear())

  it('asks by name, saves the leader’s own row with the word, and cannot save with no answer', async () => {
    const onSaved = vi.fn()
    renderWithProviders(<TrialVerdictCards cards={cardsOf([feedRow()])} userId="leader-1" onSaved={onSaved} />)
    await settle()
    expect(screen.getByText('Take Bryan again?')).toBeTruthy()
    expect(screen.getByText(/worked with you today at .*Oak St/)).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(screen.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByPlaceholderText('A word for the office (optional)'), { target: { value: ' careful, a bit slow ' } })
    fireEvent.click(save)

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(upsert).toHaveBeenCalledWith(
      'team_prospect_trial_verdicts',
      { prospect_id: 'p1', leader_user_id: 'leader-1', job_ledger_id: 'j1', work_date: '2026-09-21', verdict: 'yes', note: 'careful, a bit slow' },
      { onConflict: 'prospect_id,leader_user_id,work_date' },
    )
  })

  it('Skip writes a skipped row with no word, so the card is not dealt again', async () => {
    const onSaved = vi.fn()
    renderWithProviders(<TrialVerdictCards cards={cardsOf([feedRow()])} userId="leader-1" onSaved={onSaved} />)
    await settle()
    fireEvent.change(screen.getByPlaceholderText('A word for the office (optional)'), { target: { value: 'typed, then skipped' } })
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({ verdict: 'skipped', note: null })
  })

  it('shows today’s answer in one line, and Change reopens it with no Skip', async () => {
    renderWithProviders(<TrialVerdictCards cards={cardsOf([feedRow({ verdict: 'no', note: 'late twice' })])} userId="leader-1" onSaved={() => {}} />)
    await settle()
    expect(screen.getByText('You said no · “late twice”')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})
