// @vitest-environment jsdom
/**
 * The Customer page's Agreements card and the customer's own papers (punch list #403, step 4): a paper that is with
 * the customer is listed under *Papers with this customer*, and the card shows for it even when no job has a contract.
 * With no job paper, no open job and no paper of their own, the card stays away. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import CustomerAgreementsCard from './CustomerAgreementsCard'

const io = vi.hoisted(() => ({ papers: [] as unknown[], asked: [] as string[] }))

vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/jobContractCoversWrite', async (orig) => ({
  ...(await orig<typeof import('../../lib/jobs/jobContractCoversWrite')>()),
  loadPartyJobs: async () => [],
  loadContractRowsForJobs: async () => [],
}))
vi.mock('../../lib/contracts/partyPapersIo', () => ({
  readPartyPapers: async (party: { kind: string; id: string }) => {
    io.asked.push(`${party.kind}:${party.id}`)
    return io.papers
  },
}))
vi.mock('../jobs/AddJobContractSheet', () => ({ default: () => null }))

beforeEach(() => {
  io.papers = []
  io.asked = []
})
afterEach(() => cleanup())

describe('CustomerAgreementsCard · the customer’s own papers', () => {
  it('lists a paper that is with the customer, on a customer with no job contract', async () => {
    io.papers = [
      {
        id: 'p1',
        document_name: 'Site secrecy agreement',
        doc_type: 'agreement',
        status: 'sent',
        party_contact_id: 'k-ridgeway',
        signer_name: 'Dana Ruiz',
        signer_title: 'Project manager',
        signer_printed_name: null,
        signed_at: null,
        sent_at: '2026-11-17T15:00:00Z',
        created_at: '2026-11-17T14:00:00Z',
        signer_last_viewed_at: null,
        supersedes_person_contract_document_id: null,
      },
    ]
    renderWithProviders(<CustomerAgreementsCard customerId="c-ridgeway" customerName="Ridgeway Builders" />)
    const block = await screen.findByTestId('customer-party-papers')
    expect(block.textContent).toContain('Papers with this customer')
    expect(block.textContent).toContain('Site secrecy agreement')
    expect(block.textContent).toContain('Dana Ruiz signs, Project manager')
    expect(io.asked).toEqual(['customer:c-ridgeway'])
    expect(screen.getByTestId('customer-agreements').textContent).toContain('Add one')
  })

  it('stays away when the customer has no job paper, no open job and no paper of their own', async () => {
    const { container } = renderWithProviders(<CustomerAgreementsCard customerId="c-ridgeway" customerName="Ridgeway Builders" />)
    await waitFor(() => expect(io.asked).toEqual(['customer:c-ridgeway']))
    expect(container.querySelector('[data-testid="customer-agreements"]')).toBeNull()
  })
})
