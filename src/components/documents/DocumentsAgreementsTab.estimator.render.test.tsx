// @vitest-environment jsdom
/**
 * Documents → Agreements as an estimator reads it (punch list #403, call 8): the chips for the kinds their role reads
 * and no other, the lines the read answers, and nothing to act on. No **Send a paper**, no **Contract library**, and
 * no press on a line: a signed paper's name, a job and a waiting paper are plain words. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow, AgreementsQuery } from '../../lib/documents/agreementsLedger'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const io = vi.hoisted(() => ({
  role: 'estimator' as string,
  rows: [] as unknown[],
  asks: [] as Array<{ kind: string; reader: string | undefined }>,
  counts: [] as string[],
  /** How many papers were made and never sent, as the count answers. */
  notSent: 0 as number | null,
  mounted: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsLedgerIo', () => ({
  readAgreements: async (q: AgreementsQuery) => {
    io.asks.push({ kind: q.kind, reader: q.reader })
    return { rows: io.rows, more: false }
  },
  countAgreementsWaiting: async (kind: string, reader?: string) => {
    io.counts.push(`${kind}:${reader}`)
    return 1
  },
  countAgreementsNotSent: async () => io.notSent,
}))
// The windows and the senders are their own files' to test: here each says it was drawn at all.
vi.mock('./AgreementsSendPaper', () => ({
  AgreementsSendPaper: () => {
    io.mounted.push('send-a-paper')
    return <button type="button">Send a paper</button>
  },
}))
vi.mock('./AgreementsContractLibrary', () => ({
  AgreementsContractLibrary: () => {
    io.mounted.push('contract-library')
    return null
  },
}))
vi.mock('./PaperPartyAddToList', () => ({ PaperPartyAddToList: () => <div data-testid="add-to-list-window" /> }))
vi.mock('../contracts/ContractSendWindow', () => ({ ContractSendWindow: () => <div data-testid="send-window" /> }))
vi.mock('../contracts/PersonContractSignedRecordModal', () => ({
  PersonContractSignedRecordModal: (p: { open: boolean }) => (p.open ? <div data-testid="signed-record-window" /> : null),
}))
vi.mock('../jobs/JobContractModal', () => ({ default: (p: { open: boolean }) => (p.open ? <div data-testid="contract-window" /> : null) }))
vi.mock('../jobs/JobContractRecordModal', () => ({ buildJobContractRecordHtml: () => '<html></html>' }))
vi.mock('../jobs/WorkOrderAssemblerModal', () => ({ WorkOrderAssemblerModal: (p: { open: boolean }) => (p.open ? <div data-testid="work-order-window" /> : null) }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => null }))
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobContractRows: async () => [] }))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({ readPersonPaperSendFacts: async () => null, sendPersonPaperForSignature: async () => ({}) }))

const row = (over: Partial<AgreementRow>): AgreementRow => ({
  id: 'supply_house_agreement:d1',
  kind: 'supply_house_agreement',
  source_id: 'd1',
  state: 'waiting',
  paper_name: 'Mutual secrecy agreement',
  with_name: 'Tallgrass Supply Co.',
  job_id: null,
  job_hcp_number: null,
  job_click_number: null,
  job_name: null,
  job_address: null,
  more_jobs: 0,
  person_id: null,
  person_kind: null,
  at: '2026-11-18T18:00:00Z',
  at_day: '2026-11-18',
  facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park', signer_title: 'Branch manager' },
  ...over,
})

const ROWS = [
  row({}),
  row({
    id: 'customer_agreement:d2',
    kind: 'customer_agreement',
    source_id: 'd2',
    state: 'signed',
    paper_name: 'Site secrecy agreement',
    with_name: 'Ridgeway Builders',
    job_id: 'j1042',
    job_hcp_number: '1042',
    job_name: 'Alder Court',
    job_address: '18 Alder Court',
    at_day: '2026-11-17',
    facts: { status: 'signed', party_kind: 'customer', signer_name: 'Dana Ruiz', signer_title: 'Project manager', signer_printed_name: 'Dana Ruiz' },
  }),
  row({ id: 'work_order:w1', kind: 'work_order', source_id: 'w1', state: 'signed', paper_name: 'WO-0412', with_name: 'Juniper Mechanical LLC', job_id: 'j1042', job_hcp_number: '1042', job_name: 'Alder Court', at_day: '2026-11-14', facts: { status: 'accepted' } }),
]

beforeEach(() => {
  io.role = 'estimator'
  io.rows = ROWS
  io.asks = []
  io.counts = []
  io.notSent = 0
  io.mounted = []
})
afterEach(() => cleanup())

describe('DocumentsAgreementsTab · an estimator', () => {
  it('draws the chips for the kinds an estimator reads, and leaves the rest out', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    const chips = Array.from(screen.getByRole('group', { name: 'Kind of agreement' }).querySelectorAll('button')).map((b) => b.textContent)
    expect(chips).toEqual(['All', 'Outside companies', 'Work orders'])
    expect(io.asks[0]).toEqual({ kind: 'all', reader: 'estimator' })
    await waitFor(() => expect(io.counts).toContain('all:estimator'))
  })

  it('asks for an estimator’s kinds when their chip is pressed', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    fireEvent.click(screen.getByRole('button', { name: 'Outside companies' }))
    await waitFor(() => expect(io.asks[io.asks.length - 1]).toEqual({ kind: 'outside', reader: 'estimator' }))
  })

  it('lists the lines the read answers, with who signs and where each stands', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    expect(lines.map((l) => l.textContent)).toEqual([
      expect.stringMatching(/^Supply houseMutual secrecy agreementWith Tallgrass Supply Co\. · Lena Park signs, Branch managernever openedSent Nov 18$/),
      expect.stringMatching(/^CustomerSite secrecy agreementWith Ridgeway Builders · signed by Dana Ruiz, Project manager · J1042 · Alder Court · 18 Alder Courtsigned ✓Signed Nov 17$/),
      expect.stringMatching(/^Work orderWO-0412With Juniper Mechanical LLC · J1042 · Alder Court/),
    ])
  })

  it('has no Send a paper and no Contract library, and never draws either', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.queryByRole('button', { name: 'Send a paper' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Contract library' })).toBeNull()
    expect(io.mounted).toEqual([])
  })

  it('has no press on a line: a name and a job are plain words, and a waiting paper carries no act', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    for (const l of lines) expect(l.querySelector('button, a')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy the signing link' })).toBeNull()
    expect(screen.queryByTestId('signed-record-window')).toBeNull()
  })

  it('reads a paper that was never sent and a W-9 as lines, with no Send and no Take back', async () => {
    io.notSent = 1
    io.rows = [
      row({ id: 'supply_house_agreement:p7', kind: 'supply_house_agreement', source_id: 'p7', state: 'not_sent', paper_name: 'Request for taxpayer number', with_name: 'Tallgrass Supply Co', at_day: '2026-11-21', facts: { status: 'unsent', party_kind: 'supply_house', doc_type: 'w9' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    expect(lines[0]?.textContent).toBe('Supply houseW-9Request for taxpayer numberWith Tallgrass Supply Conot sentMade Nov 21')
    expect(lines[0]?.querySelector('button, a')).toBeNull()
    // The chip is theirs to read by too.
    expect(await screen.findByRole('button', { name: 'Not sent · 1' })).toBeTruthy()
  })

  it('says the list is for reading and where a signed paper opens, in place of the office’s doors', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.getByTestId('documents-agreements-reader-doors').textContent).toBe('This list is for reading. A signed paper, a W-9 or a certificate opens from the company’s own page.')
    expect(screen.queryByTestId('documents-agreements-doors')).toBeNull()
  })

  it('tells an estimator with nothing on file that the office sends, with no press', async () => {
    io.rows = []
    renderWithProviders(<DocumentsAgreementsTab />)
    const empty = await screen.findByTestId('documents-agreements-empty')
    expect(empty.textContent).toBe('No agreements yet. The office sends a paper to an outside company from this tab.')
    expect(empty.querySelector('a, button')).toBeNull()
  })

  it('keeps the office’s tab whole: Send a paper, Contract library, every chip and a press on a signed line', async () => {
    io.role = 'assistant'
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.getByRole('button', { name: 'Send a paper' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contract library' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Kind of agreement' }).querySelectorAll('button')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Site secrecy agreement' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /J1042/ }).length).toBeGreaterThan(0)
    expect(io.asks[0]).toEqual({ kind: 'all', reader: 'office' })
  })
})
