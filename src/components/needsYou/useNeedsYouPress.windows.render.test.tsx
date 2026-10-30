// @vitest-environment jsdom
/**
 * The two windows of v2.6096 (punch list #178, PR 6): a returned check's line opens the Accounts
 * receivable window in place on its case (the list when several came back) and re-reads the line on
 * close; the statement round's line opens GC Review in place and re-reads on close.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouHandles } from '../../hooks/useNeedsYouInputs'
import type { NeedsYouDoorData } from '../../lib/needsYouDoors'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'
import { useNeedsYouPress } from './useNeedsYouPress'

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => vi.fn() }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant' }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../dashboard/DashboardArDepositsModal', () => ({
  DashboardArDepositsModal: ({ open, initialDepositId, onClose }: { open: boolean; initialDepositId?: string | null; onClose: () => void }) =>
    open ? (
      <div data-ar-window={initialDepositId ?? 'list'}>
        <button type="button" onClick={onClose}>
          Close the deposits
        </button>
      </div>
    ) : null,
}))
vi.mock('../dashboard/GcReviewWindow', () => ({
  GcReviewWindow: ({ onClose }: { onClose: () => void }) => (
    <div data-gc-review-window>
      <button type="button" onClick={onClose}>
        Close the review
      </button>
    </div>
  ),
}))
vi.mock('../dashboard/DashboardLienReleaseQueueModal', () => ({ DashboardLienReleaseQueueModal: () => null }))
vi.mock('../dashboard/DashboardLienWaiversToSignModal', () => ({ DashboardLienWaiversToSignModal: () => null }))
vi.mock('../dashboard/DashboardStaleTallyStaffFollowUpModal', () => ({ DashboardStaleTallyStaffFollowUpModal: () => null }))

const reloadBankReturned = vi.fn()
const reloadStatementRound = vi.fn()
const refetchArBankUnallocatedCount = vi.fn(async () => {})
const handles = { reloadBankReturned, reloadStatementRound, refetchArBankUnallocatedCount } as unknown as NeedsYouHandles
const item = (key: NeedsYouItem['key']): NeedsYouItem => ({ key, severity: 'amber', kicker: '', title: key, detail: '', figure: '1', actionLabel: 'Open' })

function Host({ doorData }: { doorData: NeedsYouDoorData }) {
  const press = useNeedsYouPress({ host: 'quickfill', doorData, handles, officeEligible: true })
  return (
    <div>
      <button type="button" onClick={() => press.onAction(item('returned-check'))}>
        Open the check
      </button>
      <button type="button" onClick={() => press.onAction(item('statement-round'))}>
        Open the list
      </button>
      {press.windows}
    </div>
  )
}

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  reloadBankReturned.mockClear()
  reloadStatementRound.mockClear()
})

describe('useNeedsYouPress · the two windows of v2.6096', () => {
  it('a returned check opens the deposits window on its case and re-reads the line on close', async () => {
    renderWithProviders(<Host doorData={{ role: 'assistant', returnedCheckIds: ['tx-1'] }} />)
    await settle()
    expect(document.querySelector('[data-ar-window]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the check' }))
    expect(document.querySelector('[data-ar-window]')?.getAttribute('data-ar-window')).toBe('tx-1')
    fireEvent.click(screen.getByRole('button', { name: 'Close the deposits' }))
    expect(document.querySelector('[data-ar-window]')).toBeNull()
    expect(reloadBankReturned).toHaveBeenCalledTimes(1)
    expect(refetchArBankUnallocatedCount).toHaveBeenCalled()
  })

  it('several returned checks open the window on the list', async () => {
    renderWithProviders(<Host doorData={{ role: 'assistant', returnedCheckIds: ['tx-1', 'tx-2'] }} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the check' }))
    expect(document.querySelector('[data-ar-window]')?.getAttribute('data-ar-window')).toBe('list')
  })

  it('the statement round opens GC Review in place and re-reads the line on close', async () => {
    renderWithProviders(<Host doorData={{ role: 'assistant' }} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the list' }))
    await screen.findByRole('button', { name: 'Close the review' })
    expect(document.querySelector('[data-gc-review-window]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close the review' }))
    expect(document.querySelector('[data-gc-review-window]')).toBeNull()
    expect(reloadStatementRound).toHaveBeenCalledTimes(1)
  })
})
