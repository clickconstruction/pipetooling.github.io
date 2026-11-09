// @vitest-environment jsdom
/**
 * People → Review → Scoreboard (punch list #234 PR 4): one row per superintendent for the month with
 * the jobs signed off, hours used of earned, days against the plan, labor kept for payroll access and
 * the bonus; a name opens the jobs and the held ones with their reasons; without payroll access the
 * kept column is not drawn; nothing waiting says so. The kernel's suite holds the arithmetic.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { ScoreRead } from '../../lib/people/superintendentScores'

let read: ScoreRead | null = null
vi.mock('../../hooks/useSuperintendentScores', () => ({ useSuperintendentScores: () => ({ read, loading: false, error: null, reload: vi.fn() }) }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'master_technician', user: { id: 'owner' }, profileName: 'Owner' }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PeopleScoreboardTab } from './PeopleScoreboardTab'

const rows: ScoreRead['rows'] = [
  { userId: 'pat', userName: 'Pat Sample', jobId: 'j1', jobLabel: '1042 Harbor Lane Offices', status: 'working', awardedKind: 'bid', awardedAt: '2026-10-02T15:00:00Z', plannedFinish: null, awardedHours: 516, certifiedPct: 48, signedOn: '2026-10-30', signedBy: 'Taunya', teamHours: 190, subHours: 16, hoursUnder: 41.7, scored: true, signedInPeriod: true, earnedUsd: 11_146, actualUsd: 9_016, keptUsd: 2_130, bonusUsd: 213 },
  { userId: 'pat', userName: 'Pat Sample', jobId: 'j2', jobLabel: '#1050 Pruett', status: 'working', awardedKind: 'book', awardedAt: '2026-10-05T15:00:00Z', plannedFinish: null, awardedHours: 471, certifiedPct: 20, signedOn: '2026-10-20', signedBy: 'Taunya', teamHours: 80, subHours: 0, hoursUnder: null, scored: false, signedInPeriod: true, earnedUsd: 0, actualUsd: 4_000, keptUsd: -4_000, bonusUsd: null },
  { userId: 'lee', userName: 'Lee Sample', jobId: 'j3', jobLabel: '1031 Cedar Row', status: 'working', awardedKind: 'typed', awardedAt: '2026-09-01T15:00:00Z', plannedFinish: null, awardedHours: 240, certifiedPct: 35, signedOn: '2026-10-28', signedBy: 'Robert', teamHours: 290, subHours: 0, hoursUnder: -206, scored: true, signedInPeriod: true, earnedUsd: 3_780, actualUsd: 5_200, keptUsd: -1_420, bonusUsd: 0 },
]

installDomShims()
afterEach(cleanup)

describe('PeopleScoreboardTab', () => {
  it('one row per superintendent with the hours, the kept dollars and the bonus; a name opens the jobs and the held ones', () => {
    read = { readsWages: true, sharePct: 10, burden: 1.2, fromYmd: '2026-11-01', toYmd: '2026-11-30', rows }
    renderWithProviders(<PeopleScoreboardTab />)
    const trs = screen.getAllByTestId('scoreboard-row')
    expect(trs).toHaveLength(2)
    expect(trs[0]!.textContent).toContain('Pat Sample')
    expect(trs[0]!.textContent).toContain('1042 Harbor Lane Offices · 48%')
    expect(trs[0]!.textContent).toContain('1 not scored')
    expect(trs[0]!.textContent).toContain('206 h / 248 h')
    expect(trs[0]!.textContent).toContain('42 h under the baseline')
    expect(trs[0]!.textContent).toContain('$2,130 kept')
    expect(trs[0]!.textContent).toContain('$213 · 10% of the labor kept')
    expect(trs[1]!.textContent).toContain('−$1,420, nothing owed back')
    expect(trs[1]!.textContent).toContain('$0 · nothing kept this period')
    fireEvent.click(screen.getByRole('button', { name: /Pat Sample/ }))
    const jobs = screen.getByTestId('scoreboard-jobs').textContent ?? ''
    expect(jobs).toContain('1042 Harbor Lane Offices · 48% signed off Oct 30 by Taunya · 206 h of 248 h earned · 42 h under the baseline')
    expect(jobs).toContain("#1050 Pruett · not scored: awarded on the book's hours, a guess; the score waits for a bid or typed baseline")
    expect(screen.getByText('Change the share in Settings → People')).toBeTruthy()
    // No scored job here carries a plan: the Days column says so.
    expect(trs[0]!.textContent).toContain('no plan')
    cleanup()
    // A plan with no hours yet waits on hours, never "no plan" (the second walk's slip 5).
    read = { readsWages: true, sharePct: 10, burden: 1.2, fromYmd: '2026-11-01', toYmd: '2026-11-30', rows: [{ ...rows[0]!, plannedFinish: '2026-11-20', teamHours: 0, subHours: 0 }] }
    renderWithProviders(<PeopleScoreboardTab />)
    expect(screen.getAllByTestId('scoreboard-row')[0]!.textContent).toContain('waits on hours')
    expect(screen.getAllByTestId('scoreboard-row')[0]!.textContent).not.toContain('no plan')
  })
  it('without payroll access the kept column is not drawn and the bonus still is; nothing waiting says so', () => {
    read = { readsWages: false, sharePct: 10, burden: 1.2, fromYmd: '2026-11-01', toYmd: '2026-11-30', rows: rows.map((r) => ({ ...r, earnedUsd: null, actualUsd: null, keptUsd: null })) }
    renderWithProviders(<PeopleScoreboardTab />)
    expect(screen.queryByText('Labor kept')).toBeNull()
    expect(screen.getAllByTestId('scoreboard-row')[0]!.textContent).toContain('$213 · 10% of the labor kept')
    cleanup()
    read = { readsWages: true, sharePct: 10, burden: 1.2, fromYmd: '2026-11-01', toYmd: '2026-11-30', rows: [] }
    renderWithProviders(<PeopleScoreboardTab />)
    expect(screen.getByText(/Nothing waiting on the scoreboard for/)).toBeTruthy()
  })
})
