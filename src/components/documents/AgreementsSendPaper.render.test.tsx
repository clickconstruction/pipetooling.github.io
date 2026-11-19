// @vitest-environment jsdom
/**
 * Documents → Agreements, Send a paper: the press reads the Contract Book and offers its papers; a paper with nothing
 * to sign names why and is not a press; a picked paper asks for a person through People's own picker; a picked person
 * opens the Send window on the plan, with nothing written before; and a sent paper tells the list to read again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { AgreementsSendPaper } from './AgreementsSendPaper'

const io = vi.hoisted(() => ({
  reads: 0,
  fail: null as null | Error,
  book: [] as unknown[],
  personDocuments: [] as unknown[],
  rosterNames: [] as string[],
  facts: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsSendIo', () => ({
  readAgreementsSendBook: async () => {
    io.reads += 1
    if (io.fail) throw io.fail
    return { book: io.book, personDocuments: io.personDocuments, rosterNames: io.rosterNames }
  },
}))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({
  readPersonSendFactsByName: async (personName: string, documentName: string) => {
    io.facts.push(`${personName}|${documentName}`)
    return { target: { personName, documentName }, initialEmail: 'bryce@example.com', personId: null, sender: null }
  },
}))
// The Send window is its own file's to test: here it says what it was opened on, and its button says it sent.
vi.mock('../contracts/ContractSendWindow', () => ({
  ContractSendWindow: (p: { again?: boolean; docId: string | null; quickSendPlan?: { kind: string } | null; target: { personName: string; documentName: string } | null; onSent: (s: { docId: string; emailed: boolean; planKind: string | null }) => void }) => (
    <div data-testid="send-window">
      {`${p.again ? 'again' : 'first'}|${p.docId}|${p.quickSendPlan?.kind}|${p.target?.personName}|${p.target?.documentName}`}
      <button type="button" onClick={() => p.onSent({ docId: 'new', emailed: true, planKind: p.quickSendPlan?.kind ?? null })}>
        fake send
      </button>
    </div>
  ),
}))

/** Every name here is made up. */
const bookRow = (over: Record<string, unknown>) => ({
  id: 'b1',
  document_name: 'Subcontractor Handbook',
  book_body_html: '<p>Rules</p>',
  book_body_format: 'html',
  canonical_document_url: null,
  form_template_id: null,
  book_version_date: null,
  updated_at: '2026-10-01T00:00:00Z',
  audience: 'sub',
  flow_kind: null,
  ...over,
})
const sentCopy = { id: 'd9', person_name: 'Priya Nair', document_name: 'Subcontractor Handbook', status: 'sent', lineage_version: 1, sent_at: '2026-11-01T00:00:00Z', signer_last_viewed_at: null, signed_at: null, url: null, signing_body_html: '<p>Rules</p>', signing_body_format: 'html', canonical_document_url: null }

beforeEach(() => {
  io.reads = 0
  io.fail = null
  io.book = [bookRow({}), bookRow({ id: 'b2', document_name: 'Empty shell', book_body_html: '' }), bookRow({ id: 'b3', document_name: 'W-9', book_body_html: null, form_template_id: 'f1' })]
  io.personDocuments = [sentCopy]
  io.rosterNames = ['Bryce Tolland', 'Priya Nair']
  io.facts = []
})
afterEach(() => cleanup())

describe('AgreementsSendPaper', () => {
  it('reads the Book on the press and offers its papers; one with no words names why and is not a press', async () => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} />)
    expect(io.reads).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send a paper' })
    expect(io.reads).toBe(1)
    expect(Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['×', 'Subcontractor HandbookFrom the Contract Book', 'W-9A form from the Contract Book'])
    expect(screen.getByTestId('send-paper-no-words').textContent).toBe('Empty shellNo words yet. Write it in the Contract Book first.')
    fireEvent.change(screen.getByLabelText('Find a paper'), { target: { value: 'zebra' } })
    expect(await screen.findByText('No papers match ‘zebra’.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getByRole('button', { name: /^W-9/ })).toBeTruthy()
  })

  it('a paper, then a person with no copy yet: the Send window opens on a plan that writes only at Send', async () => {
    const onSent = vi.fn()
    renderWithProviders(<AgreementsSendPaper onSent={onSent} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Subcontractor Handbook/ }))
    // People's own picker: who has not had it, and who already has it out.
    expect(await screen.findByRole('dialog', { name: 'Send Subcontractor Handbook to a person' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bryce Tolland' }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('first|null|insert|Bryce Tolland|Subcontractor Handbook')
    expect(io.facts).toEqual(['Bryce Tolland|Subcontractor Handbook'])
    fireEvent.click(screen.getByRole('button', { name: 'fake send' }))
    await waitFor(() => expect(screen.queryByTestId('send-window')).toBeNull())
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it('a person who already has it out is sent the same copy again', async () => {
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Subcontractor Handbook/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Priya Nair/ }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('again|d9|reuse|Priya Nair|Subcontractor Handbook')
  })

  it('says why when the Book does not read, and opens nothing', async () => {
    io.fail = new Error('permission denied for table contract_template_documents')
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    expect(await screen.findByText('permission denied for table contract_template_documents')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Send a paper' })).toBeNull()
  })

  it('with no paper in the Book names where one is written', async () => {
    io.book = []
    renderWithProviders(<AgreementsSendPaper onSent={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a paper' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send a paper' })
    expect(dialog.textContent).toContain('No papers in the Contract Book yet. People is where a paper is written, on Contracts.')
    expect(screen.getByRole('link', { name: 'People' }).getAttribute('href')).toBe('/people?tab=contracts')
  })
})
