// @vitest-environment jsdom
/**
 * The party's own page (punch list #403, step 4): a supply house's section and the estimator's card on the Customer
 * page list the papers the read answers, every kind and every state. A signed paper's name opens its signed record. A
 * read that fails says so with Retry, and an empty list names where a paper is sent from. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_READ_MESSAGE } from '../../lib/offlineRecoveryState'
import type { PartyPaperRow } from '../../lib/contracts/partyPapers'
import { PartyPapersCard, PartyPapersSection } from './PartyPapers'

const io = vi.hoisted(() => ({
  role: 'assistant' as string,
  /** Training mode (`users.read_only`). */
  readOnly: false,
  rows: [] as unknown[],
  fail: null as unknown,
  asked: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: io.readOnly, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/contracts/partyPapersIo', () => ({
  readPartyPapers: async (party: { kind: string; id: string }) => {
    io.asked.push(`${party.kind}:${party.id}`)
    if (io.fail) throw io.fail
    return io.rows
  },
}))
// The signed record is its own file's to test: here it says which paper it opened on.
vi.mock('./PersonContractSignedRecordModal', () => ({
  PersonContractSignedRecordModal: (p: { documentId: string | null; onClose: () => void }) => (
    <div data-testid="signed-record">
      {p.documentId}
      <button type="button" onClick={p.onClose}>
        fake close
      </button>
    </div>
  ),
}))

const paper = (id: string, p: Partial<PartyPaperRow> = {}): PartyPaperRow => ({
  id,
  document_name: 'Mutual secrecy agreement',
  doc_type: 'agreement',
  status: 'sent',
  party_contact_id: 'k-house',
  signer_name: 'Lena Park',
  signer_title: 'Branch manager',
  signer_printed_name: null,
  signed_at: null,
  sent_at: '2026-11-16T15:00:00Z',
  created_at: '2026-11-16T14:00:00Z',
  signer_last_viewed_at: null,
  supersedes_person_contract_document_id: null,
  ...p,
})

const HOUSE = { kind: 'supply_house' as const, id: 'h1' }
const CUSTOMER = { kind: 'customer' as const, id: 'c1' }

beforeEach(() => {
  io.role = 'assistant'
  io.readOnly = false
  io.rows = []
  io.fail = null
  io.asked = []
})
afterEach(() => cleanup())

describe('a supply house’s papers', () => {
  it('lists every kind and every state: a signed agreement, one that waits, and a W-9 that was never sent', async () => {
    io.rows = [
      paper('p-signed', { status: 'signed', signed_at: '2026-11-20', signer_printed_name: 'Lena Park' }),
      paper('p-sent', { document_name: 'Vendor terms' }),
      paper('p-w9', { document_name: 'W-9', doc_type: 'w9', status: 'unsent', sent_at: null, signer_name: null, signer_title: null }),
    ]
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    const lines = await screen.findAllByTestId('party-paper-row')
    expect(lines).toHaveLength(3)
    expect(io.asked).toEqual(['supply_house:h1'])
    expect(screen.getByTestId('party-papers-count').textContent).toBe('3 papers')
    const words = lines.map((l) => l.textContent ?? '')
    expect(words.some((w) => w.includes('W-9') && w.includes('not sent'))).toBe(true)
    expect(words.some((w) => w.includes('Vendor terms') && w.includes('never opened') && w.includes('Lena Park signs, Branch manager'))).toBe(true)
    expect(words.some((w) => w.includes('signed ✓') && w.includes('signed by Lena Park, Branch manager'))).toBe(true)
  })

  it('draws a line’s day and the count as values, apart from the words', async () => {
    io.rows = [paper('p-sent')]
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    const line = await screen.findByTestId('party-paper-row')
    expect(line.querySelector('[data-value="worked-out"]')?.textContent).toBe('Nov 16')
    expect(screen.getByTestId('party-papers-count').querySelector('[data-value="worked-out"]')?.textContent).toBe('1')
  })

  it('says signing for on a paper that names another business than this house, and not on the house’s own', async () => {
    io.rows = [
      paper('p-other', { document_name: 'Site secrecy agreement', signer_name: 'Noor Haddad', signer_title: null, signing_for: 'Haddad Engineering' }),
      paper('p-own', { document_name: 'Vendor terms', signing_for: 'Tallgrass Supply Co.' }),
    ]
    renderWithProviders(<PartyPapersSection party={HOUSE} partyName="Tallgrass Supply Co." />)
    const words = (await screen.findAllByTestId('party-paper-row')).map((l) => l.textContent ?? '')
    expect(words.find((w) => w.includes('Site secrecy agreement'))).toContain('Noor Haddad signs · signing for Haddad Engineering')
    expect(words.find((w) => w.includes('Vendor terms'))).not.toContain('signing for')
  })

  it('opens a signed paper’s record from its name, and gives a paper that is not signed no press', async () => {
    io.rows = [paper('p-signed', { status: 'signed', signed_at: '2026-11-20' }), paper('p-sent', { document_name: 'Vendor terms' })]
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    await screen.findAllByTestId('party-paper-row')
    expect(screen.queryByRole('button', { name: 'Vendor terms' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mutual secrecy agreement' }))
    expect((await screen.findByTestId('signed-record')).textContent).toContain('p-signed')
    fireEvent.click(screen.getByText('fake close'))
    await waitFor(() => expect(screen.queryByTestId('signed-record')).toBeNull())
  })

  it('opens it for an estimator too, and gives a training estimator the line with no press (punch list #403, decision 2)', async () => {
    io.role = 'estimator'
    io.rows = [paper('p-signed', { status: 'signed', signed_at: '2026-11-20' })]
    const first = renderWithProviders(<PartyPapersSection party={HOUSE} />)
    await screen.findAllByTestId('party-paper-row')
    expect(screen.getByRole('button', { name: 'Mutual secrecy agreement' })).toBeTruthy()
    first.unmount()
    io.readOnly = true
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    const lines = await screen.findAllByTestId('party-paper-row')
    expect(lines[0]?.textContent).toContain('Mutual secrecy agreement')
    expect(lines[0]?.querySelector('button, a')).toBeNull()
    expect(screen.queryByTestId('signed-record')).toBeNull()
  })

  it('opens it for a training assistant as before: the rule is the estimator’s', async () => {
    io.readOnly = true
    io.rows = [paper('p-signed', { status: 'signed', signed_at: '2026-11-20' })]
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    await screen.findAllByTestId('party-paper-row')
    expect(screen.getByRole('button', { name: 'Mutual secrecy agreement' })).toBeTruthy()
  })

  it('names where a paper is sent from when the office reads an empty list', async () => {
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    const empty = await screen.findByTestId('party-papers-empty')
    expect(empty.textContent).toBe('No papers yet. Agreements is where Send a paper sends one.')
    expect(empty.querySelector('a')?.getAttribute('href')).toBe('/documents?tab=agreements')
  })

  it('tells an estimator the office sends one, with no press', async () => {
    io.role = 'estimator'
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    const empty = await screen.findByTestId('party-papers-empty')
    expect(empty.textContent).toBe('No papers yet. The office sends one from Documents.')
    expect(empty.querySelector('a, button')).toBeNull()
  })

  it('says a read that failed, keeps it apart from an empty list, and reads again on Retry', async () => {
    io.fail = new TypeError('Failed to fetch')
    renderWithProviders(<PartyPapersSection party={HOUSE} />)
    expect(await screen.findByText(OFFLINE_READ_MESSAGE)).toBeTruthy()
    expect(screen.queryByTestId('party-papers-empty')).toBeNull()
    io.fail = null
    io.rows = [paper('p-sent')]
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('party-paper-row')).toBeTruthy()
    expect(io.asked).toEqual(['supply_house:h1', 'supply_house:h1'])
  })

  it('draws nothing and reads nothing for a role that reads no paper', async () => {
    io.role = 'superintendent'
    const { container } = renderWithProviders(<PartyPapersSection party={HOUSE} />)
    await waitFor(() => expect(container.querySelector('[data-testid="party-papers-section"]')).toBeNull())
    expect(io.asked).toEqual([])
  })
})

describe('the estimator’s card on the Customer page', () => {
  it('lists the customer’s papers under Agreements', async () => {
    io.role = 'estimator'
    io.rows = [paper('p-sent', { party_contact_id: 'k-customer' })]
    renderWithProviders(<PartyPapersCard party={CUSTOMER} />)
    const card = await screen.findByTestId('party-papers-card')
    expect(card.textContent).toContain('Agreements')
    expect(card.textContent).toContain('never opened')
    expect(io.asked).toEqual(['customer:c1'])
  })

  it('stays away while there is no paper to show', async () => {
    io.role = 'estimator'
    const { container } = renderWithProviders(<PartyPapersCard party={CUSTOMER} />)
    await waitFor(() => expect(io.asked).toEqual(['customer:c1']))
    expect(container.querySelector('[data-testid="party-papers-card"]')).toBeNull()
  })

  it('shows a read that failed, so a refusal never reads as no papers', async () => {
    io.role = 'estimator'
    io.fail = Object.assign(new Error('permission denied for table contacts'), { code: '42501' })
    renderWithProviders(<PartyPapersCard party={CUSTOMER} />)
    const card = await screen.findByTestId('party-papers-card')
    expect(card.textContent).toContain('The papers did not read.')
    expect(screen.queryByTestId('party-paper-row')).toBeNull()
    // A refusal is no lost signal: it offers no Retry.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
