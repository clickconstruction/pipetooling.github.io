// @vitest-environment jsdom
/**
 * The statement round's window (v2.6096, punch list #178, PR 6): GC Review mounted over the card
 * with the shared jobs cache's billed rows, the office roster, the role's gates and the shared glue,
 * and its close handed back.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { JobsListCacheProvider } from '../../contexts/JobsListCacheContext'
import { GcReviewWindow } from './GcReviewWindow'

type ModalProps = { onClose: () => void; billedActiveRows: unknown[]; collectionsRows: unknown[]; users: Array<{ id: string; name: string }>; isDev: boolean; canCertify: boolean; canFilePromises?: boolean; emailForGc: (id: string) => string }
const seen: ModalProps[] = []

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant' }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../hooks/useBilledMoneyData', () => ({ useBilledMoneyData: () => ({ promisedPayDates: null, loadPromisedPayDates: async () => {} }) }))
vi.mock('../../lib/people/fetchActiveUsers', () => ({ fetchActiveUsers: async () => ({ data: [{ id: 'u-1', name: 'Rosa Vega', email: 'rosa@example.com', role: 'assistant' }] }) }))
vi.mock('../jobs/JobsGcReviewModal', () => ({
  JobsGcReviewModal: (props: ModalProps) => {
    seen.push(props)
    return (
      <div data-gc-review-modal data-users={props.users.length} data-certify={String(props.canCertify)} data-dev={String(props.isDev)}>
        <button type="button" onClick={props.onClose}>
          Close GC Review
        </button>
      </div>
    )
  },
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  seen.length = 0
})

describe('GcReviewWindow (v2.6096, punch list #178)', () => {
  it('mounts GC Review over the card with the roster and the office gates, and hands its close back', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <JobsListCacheProvider>
        <GcReviewWindow onClose={onClose} />
      </JobsListCacheProvider>,
    )
    await settle()
    const modal = () => document.querySelector('[data-gc-review-modal]')
    expect(modal()).toBeTruthy()
    await waitFor(() => expect(modal()?.getAttribute('data-users')).toBe('1'))
    expect(modal()?.getAttribute('data-certify')).toBe('true')
    expect(modal()?.getAttribute('data-dev')).toBe('false')
    const last = seen[seen.length - 1]!
    expect(last.billedActiveRows).toEqual([])
    expect(last.collectionsRows).toEqual([])
    expect(last.canFilePromises).toBe(true)
    expect(last.emailForGc('gc-missing')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Close GC Review' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
