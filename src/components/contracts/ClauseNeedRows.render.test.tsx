// @vitest-environment jsdom
/**
 * ClauseNeedRows (Messages, cut 4c): a change waiting on approval as a Needs you row, the one Follow up and the Dashboard
 * share. Approve publishes it, Decline asks for a why first, and Open in Settings links its paper's card.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return m.useAuthModuleMock({ role: 'controller', profileName: 'Maria' })
})
vi.mock('../../lib/contracts/clausesIo', () => ({ approveClauseProposal: vi.fn(), declineClauseProposal: vi.fn() }))

import { approveClauseProposal, declineClauseProposal } from '../../lib/contracts/clausesIo'
import { APPROVERS, MSA, MSA_CLAUSES, ROSA, idsFrom } from '../../test/fixtures/clauseBookDemo'
import { clauseNeeds, editClause } from '../../lib/contracts/approval'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ClauseNeedRows } from './ClauseNeedRows'

const book = { paper: MSA, clauses: MSA_CLAUSES }
const made = editClause(book, { kind: 'edit', clauseId: 'msa-2', en: 'Insurance: $2,000,000 per occurrence.', es: '', scope: 'all' }, ROSA, { at: '2026-10-12T15:00:00Z', why: 'the insurer asked for it', approvers: APPROVERS, newId: idsFrom('p') })
if (made.kind !== 'proposed') throw new Error('expected a proposal')
const rows = clauseNeeds('controller', [{ ...made.proposal, paperId: 'msa' }], [book], { approvers: APPROVERS, when: () => 'Oct 12, 10:00 AM' })

beforeEach(() => {
  vi.mocked(approveClauseProposal).mockReset().mockResolvedValue({ state: 'published', proposal_id: 'p-1' })
  vi.mocked(declineClauseProposal).mockReset().mockResolvedValue({ state: 'declined', proposal_id: 'p-1' })
})

describe('ClauseNeedRows', () => {
  it('draws the row: who changed what, the badge, the facts and the words asked for', () => {
    renderWithProviders(<ClauseNeedRows rows={rows} onDecided={() => {}} />)
    expect(screen.getByText('Rosa changed clause 2 of the master agreement.')).toBeTruthy()
    expect(screen.getByText('Waiting on your approval')).toBeTruthy()
    expect(screen.getByText('the insurer asked for it')).toBeTruthy()
    expect(screen.getByText('Insurance: $2,000,000 per occurrence.')).toBeTruthy()
    expect(screen.getByText('Open in Settings').getAttribute('href')).toBe('/settings?tab=settings-clauses#settings-clause-paper-msa')
  })

  it('approves it and says so', async () => {
    const decided = vi.fn()
    renderWithProviders(<ClauseNeedRows rows={rows} onDecided={decided} />)
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(approveClauseProposal).toHaveBeenCalledWith('p-1'))
    await waitFor(() => expect(decided).toHaveBeenCalled())
    expect(screen.getByText('Approved by Maria. The next paper sent carries it.')).toBeTruthy()
  })

  it('declines it with a why', async () => {
    const decided = vi.fn()
    renderWithProviders(<ClauseNeedRows rows={rows} onDecided={decided} />)
    fireEvent.click(screen.getByText('Decline'))
    const dialog = await screen.findByRole('dialog', { name: 'Decline the change' })
    fireEvent.change(within(dialog).getByLabelText('Why, for Rosa'), { target: { value: 'Keep the old wording.' } })
    fireEvent.click(within(dialog).getByText('Decline'))
    await waitFor(() => expect(declineClauseProposal).toHaveBeenCalledWith('p-1', 'Keep the old wording.'))
    await waitFor(() => expect(decided).toHaveBeenCalled())
  })

  it('draws nothing with no rows', () => {
    const { container } = renderWithProviders(<ClauseNeedRows rows={[]} onDecided={() => {}} />)
    expect(container.querySelector('[data-clause-need-rows]')).toBeNull()
  })
})
