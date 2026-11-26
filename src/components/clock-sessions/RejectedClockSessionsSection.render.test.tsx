// @vitest-environment jsdom
/**
 * The Delete press on a rejected clock session (punch list #443): its confirm window names whose session, which day
 * and which hours, says a dev can bring it back, and its button names the act. Cancel deletes nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

const db = { deletes: [] as string[] }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  return {
    supabase: {
      ...stub,
      from: (t: string) => ({
        ...baseFrom(t),
        delete: () => ({
          eq: (_col: string, id: string) => {
            db.deletes.push(`${t}:${id}`)
            return Promise.resolve({ data: null, error: null, status: 204 })
          },
        }),
      }),
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import { RejectedClockSessionsSection } from './RejectedClockSessionsSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { ClockSessionRow } from '../../types/clockSessions'

const session = {
  id: 's-zz-1',
  user_id: 'u-zz-1',
  clocked_in_at: '2026-11-26T02:23:10Z',
  clocked_out_at: '2026-11-26T02:24:40Z',
  work_date: '2026-11-25',
  notes: 'ZZ Test walk',
  job_ledger_id: null,
  bid_id: null,
  clock_in_lat: null,
  clock_in_lng: null,
  clock_out_lat: null,
  clock_out_lng: null,
  clock_in_location_source: null,
  clock_out_location_source: null,
  approved_at: null,
  rejected_at: '2026-11-26T03:00:00Z',
  revoked_at: null,
  users: { name: 'ZZ Test Learner' },
  jobs_ledger: null,
  bids: null,
} as unknown as ClockSessionRow

afterEach(() => {
  cleanup()
  db.deletes = []
})

describe('RejectedClockSessionsSection · Delete names the session', () => {
  it('asks about that person’s session of that day, and Cancel deletes nothing', async () => {
    const onDeleted = vi.fn()
    renderWithProviders(<RejectedClockSessionsSection sessions={[session]} onDeleted={onDeleted} open onToggle={() => {}} canDeleteRejectedSessions />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain("Delete ZZ Test Learner's clock session of Wed, Nov 25, 8:23 PM to 8:24 PM? A dev can bring it back from Recently deleted for 90 days.")
    expect(within(ask).getByRole('button', { name: 'Delete the session' })).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(db.deletes).toEqual([])
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('the yes deletes that one session', async () => {
    const onDeleted = vi.fn()
    renderWithProviders(<RejectedClockSessionsSection sessions={[session]} onDeleted={onDeleted} open onToggle={() => {}} canDeleteRejectedSessions />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete the session' }))
    await settle()
    expect(db.deletes).toEqual(['clock_sessions:s-zz-1'])
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })
})
