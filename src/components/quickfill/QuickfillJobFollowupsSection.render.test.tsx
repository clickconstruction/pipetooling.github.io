// @vitest-environment jsdom
/**
 * Quickfill's Job follow-ups station (v2.6093, punch list #178, PR 4): two lanes over one read,
 * the count both lanes, the Next line the stalest quiet job else the job longest without a crew,
 * each lane opening the Follow-ups deck in place on its lens, and closing the deck re-reading.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillJobFollowupsSection } from './QuickfillJobFollowupsSection'

type Nudge = ReturnType<typeof import('../../hooks/useJobFollowupNudge').useJobFollowupNudge>
const reload = vi.fn()
const nudge: { value: Nudge } = {
  value: {
    count: 2,
    stageCounts: { waiting: 0, working: 2, ready_to_bill: 0, billed: 0, collections: 0 },
    idle: { count: 3, total: 41_550, mine: 1 },
    first: { hcpNumber: '651', jobName: 'Dudley Mason', quietDays: 12 },
    idleFirst: { hcpNumber: '983', jobName: 'Water Heater removal', idleDays: 46, need: 'Schedule the next visit or close it' },
    reload,
  },
}

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant' }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../hooks/useJobFollowupNudge', () => ({ useJobFollowupNudge: () => nudge.value }))
vi.mock('../../lib/jobs/zzTestJobSwitch', () => ({ useZzTestJobsHidden: () => false }))
vi.mock('../jobs/JobsFollowupModal', () => ({
  JobsFollowupModal: ({ initialLens, onClose }: { initialLens: 'idle' | null; onClose: () => void }) => (
    <div data-deck-lens={initialLens ?? 'all'}>
      <button type="button" onClick={onClose}>
        Close the deck
      </button>
    </div>
  ),
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  reload.mockClear()
})

describe('QuickfillJobFollowupsSection · two lanes (v2.6093, punch list #178)', () => {
  it('draws the quiet and idle lanes, counts both, and leads with the stalest quiet job', async () => {
    const counts: Array<number | null> = []
    const lines: Array<string | null> = []
    renderWithProviders(<QuickfillJobFollowupsSection onCount={(n) => counts.push(n)} onNextLine={(l) => lines.push(l)} />)
    await settle()
    expect(screen.getByText('2 jobs are waiting on a follow-up')).toBeTruthy()
    expect(screen.getByText('3 open jobs have sat idle 21+ days')).toBeTruthy()
    expect(screen.getByText('$41,550 of contract with no crew on site in 21 days · 1 is yours. Each card says what the job needs: a bill, a visit, or to be closed.')).toBeTruthy()
    expect(counts[counts.length - 1]).toBe(5)
    expect(lines[lines.length - 1]).toBe('Call about 651 Dudley Mason · quiet 12 days')
  })

  it('the Idle lane opens the deck on its lens in place, and closing it re-reads', async () => {
    renderWithProviders(<QuickfillJobFollowupsSection />)
    await settle()
    expect(document.querySelector('[data-deck-lens]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Review the idle jobs, 3 waiting' }))
    expect(document.querySelector('[data-deck-lens]')?.getAttribute('data-deck-lens')).toBe('idle')
    fireEvent.click(screen.getByRole('button', { name: 'Close the deck' }))
    expect(document.querySelector('[data-deck-lens]')).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Review the quiet jobs, 2 waiting' }))
    expect(document.querySelector('[data-deck-lens]')?.getAttribute('data-deck-lens')).toBe('all')
  })

  it('with no quiet job the Next line is the job longest without a crew; with nothing it says so', async () => {
    const lines: Array<string | null> = []
    nudge.value = { ...nudge.value, count: 0, first: null }
    renderWithProviders(<QuickfillJobFollowupsSection onNextLine={(l) => lines.push(l)} />)
    await settle()
    expect(screen.queryByText(/waiting on a follow-up/)).toBeNull()
    expect(lines[lines.length - 1]).toBe('Schedule the next visit or close it · 983 Water Heater removal · no field work in 46 days')
    cleanup()
    nudge.value = { ...nudge.value, idle: { count: 0, total: 0, mine: 0 }, idleFirst: null }
    renderWithProviders(<QuickfillJobFollowupsSection />)
    await settle()
    expect(screen.getByText('Nothing waiting on a follow-up. Every open job has moved or been reviewed.')).toBeTruthy()
  })
})
