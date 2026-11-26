// @vitest-environment jsdom
/**
 * Documents → Agreements as an estimator reads it (punch list #403, call 8): the chips for the kinds their role reads
 * and no other, the lines the read answers, and nothing to act on. No **Send a paper**, no **Contract library**, and
 * no act on a line. Since the owner's second decision a signed paper's name is a press that opens its signed record,
 * while a job, a waiting paper and a work order are plain words, and a training account's lines open nothing. Every
 * name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow, AgreementsQuery } from '../../lib/documents/agreementsLedger'
import { stubPhoneWidth } from '../../test/phoneWidth'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const io = vi.hoisted(() => ({
  role: 'estimator' as string,
  /** Training mode (`users.read_only`). */
  readOnly: false,
  /** What the signed record window was handed. */
  signedRecord: [] as Array<{ documentId: string | null; addToList: boolean }>,
  rows: [] as unknown[],
  asks: [] as Array<{ kind: string; reader: string | undefined }>,
  counts: [] as string[],
  /** How many papers were made and never sent, as the count answers. */
  notSent: 0 as number | null,
  mounted: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: io.readOnly, user: { id: 'u1' } })
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
  PersonContractSignedRecordModal: (p: { open: boolean; documentId: string | null; onAddToList?: () => void }) => {
    if (!p.open) return null
    io.signedRecord.push({ documentId: p.documentId, addToList: p.onAddToList != null })
    return <div data-testid="signed-record-window" />
  },
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
  io.readOnly = false
  io.signedRecord = []
  io.rows = ROWS
  io.asks = []
  io.counts = []
  io.notSent = 0
  io.mounted = []
})
afterEach(() => {
  cleanup()
  stubPhoneWidth(false)
})

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

  it('a signed line’s name is its one press: a waiting paper, a work order and a job are plain words, and no line carries an act', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    // The waiting paper and the work order have nothing to press.
    expect(lines[0]?.querySelector('button, a')).toBeNull()
    expect(lines[2]?.querySelector('button, a')).toBeNull()
    // The signed paper has its name, and nothing else: its job is still plain words.
    const presses = Array.from(lines[1]?.querySelectorAll('button, a') ?? [])
    expect(presses.map((b) => b.textContent)).toEqual(['Site secrecy agreement'])
    expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy the signing link' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take back' })).toBeNull()
    expect(screen.queryByTestId('signed-record-window')).toBeNull()
  })

  it('pressing a signed line’s name opens its signed record, right there (punch list #403, decision 2)', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    fireEvent.click(screen.getByRole('button', { name: 'Site secrecy agreement' }))
    expect(await screen.findByTestId('signed-record-window')).toBeTruthy()
    expect(io.signedRecord[0]).toEqual({ documentId: 'd2', addToList: false })
  })

  it('a signed W-9 and a trade company’s signed agreement open the same way', async () => {
    io.rows = [
      row({ id: 'supply_house_agreement:p8', kind: 'supply_house_agreement', source_id: 'p8', state: 'signed', paper_name: 'Request for taxpayer number', at_day: '2026-11-20', facts: { status: 'signed', party_kind: 'supply_house', doc_type: 'w9', signer_name: 'Lena Park' } }),
      row({ id: 'company_agreement:p9', kind: 'company_agreement', source_id: 'p9', state: 'signed', paper_name: 'Master Services Agreement', with_name: 'Juniper Mechanical LLC', at_day: '2026-11-19', facts: { status: 'signed' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    fireEvent.click(screen.getByRole('button', { name: 'Request for taxpayer number' }))
    await screen.findByTestId('signed-record-window')
    expect(io.signedRecord[0]?.documentId).toBe('p8')
    expect(screen.getByRole('button', { name: 'Master Services Agreement' })).toBeTruthy()
  })

  it('a training account reads the lines and opens nothing, and its foot says so', async () => {
    io.readOnly = true
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    expect(lines).toHaveLength(3)
    for (const l of lines) expect(l.querySelector('button, a')).toBeNull()
    expect(lines[1]?.textContent).toMatch(/^CustomerSite secrecy agreementWith Ridgeway Builders/)
    expect(screen.getByTestId('documents-agreements-reader-doors').textContent).toBe('This list is for reading. A training account opens no signed paper.')
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

  it('says at its foot that a signed paper’s name opens its record, in place of the office’s doors', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.getByTestId('documents-agreements-reader-doors').textContent).toBe('Press a signed paper’s name to open its record. A paper that is not signed yet has nothing to open.')
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

describe('DocumentsAgreementsTab · an estimator on a phone', () => {
  it('stands a signed line’s name and every chip 44 px tall at a phone width (the press measured 24 on 2026-11-24)', async () => {
    stubPhoneWidth(true)
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    const name = screen.getByRole('button', { name: 'Site secrecy agreement' })
    expect(name.style.minHeight).toBe('44px')
    expect(name.style.display).toBe('inline-flex')
    const buttons = Array.from(screen.getByRole('region', { name: 'Agreements' }).querySelectorAll('button'))
    // Find by site…, three kind chips, four state chips and the one signed name: an estimator's tab has no other press.
    expect(buttons).toHaveLength(9)
    expect(buttons[0]?.textContent).toBe('Find by site…')
    for (const b of buttons) expect(`${b.textContent}: ${b.style.minHeight}`).toMatch(/: 44px$/)
    // The press still opens the signed record.
    fireEvent.click(name)
    await screen.findByTestId('signed-record-window')
    expect(io.signedRecord).toEqual([{ documentId: 'd2', addToList: false }])
  })

  it('adds no floor at a desk width', async () => {
    stubPhoneWidth(false)
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    for (const b of Array.from(screen.getByRole('region', { name: 'Agreements' }).querySelectorAll('button'))) expect(`${b.textContent}: ${b.style.minHeight}`).toMatch(/: $/)
    expect(screen.getByRole('button', { name: 'Site secrecy agreement' }).style.display).toBe('')
  })
})
