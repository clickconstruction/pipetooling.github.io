// @vitest-environment jsdom
/**
 * Documents → Agreements, a trade company's line (2026-11-24). A sub's company is a row on People → Contracts with its
 * own papers and its own send, so the office's press on a company's waiting paper opens that paper there. It used to
 * open GC mode's page, which shows no paper. A signed one opens its signed record as before, a GC project's paper keeps
 * GC mode, and an estimator's waiting line has no press. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow } from '../../lib/documents/agreementsLedger'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const io = vi.hoisted(() => ({ role: 'assistant' as string, rows: [] as unknown[] }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: false, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsLedgerIo', () => ({
  readAgreements: async () => ({ rows: io.rows, more: false }),
  countAgreementsWaiting: async () => 2,
  countAgreementsNotSent: async () => 0,
}))
vi.mock('../../lib/contracts/personPaperReminderIo', () => ({
  NO_PAPER_REMINDERS: { switchOn: false, byId: new Map() },
  readPaperReminders: async () => ({ switchOn: false, byId: new Map() }),
  writePaperReminderSwitch: async () => {},
}))
// The windows and the senders are their own files' to test.
vi.mock('./AgreementsSendPaper', () => ({ AgreementsSendPaper: () => <button type="button">Send a paper</button> }))
vi.mock('./AgreementsContractLibrary', () => ({ AgreementsContractLibrary: () => null }))
vi.mock('./PaperPartyAddToList', () => ({ PaperPartyAddToList: () => null }))
vi.mock('../contracts/ContractSendWindow', () => ({ ContractSendWindow: () => null }))
vi.mock('../contracts/PersonContractSignedRecordModal', () => ({ PersonContractSignedRecordModal: () => <div data-testid="signed-record-window" /> }))
vi.mock('../jobs/JobContractModal', () => ({ default: () => null }))
vi.mock('../jobs/JobContractRecordModal', () => ({ buildJobContractRecordHtml: () => '<html></html>' }))
vi.mock('../jobs/WorkOrderAssemblerModal', () => ({ WorkOrderAssemblerModal: () => null }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => null }))
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobContractRows: async () => [] }))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({ readPersonPaperSendFacts: async () => null, sendPersonPaperForSignature: async () => ({}) }))

const row = (over: Partial<AgreementRow>): AgreementRow => ({
  id: 'company_agreement:g1',
  kind: 'company_agreement',
  source_id: 'g1',
  state: 'waiting',
  paper_name: 'Subcontractor agreement',
  with_name: 'ZZ Sample Mechanical LLC',
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
  facts: { status: 'sent' },
  ...over,
})

const ROWS = [
  row({}),
  row({ id: 'company_agreement:g2', source_id: 'g2', state: 'signed', paper_name: 'Trade agreement', at_day: '2026-11-17', facts: { status: 'signed' } }),
  row({ id: 'sow:s1', kind: 'sow', source_id: 's1', paper_name: 'Statement of work · Electrical', with_name: 'Brightline Electric', job_name: 'Westfield Clinic', at_day: '2026-11-16', facts: { status: 'sent', sent_on: '2026-11-16' } }),
]

beforeEach(() => {
  io.role = 'assistant'
  io.rows = ROWS
})
afterEach(() => cleanup())

describe('DocumentsAgreementsTab · a trade company’s line', () => {
  it('opens a waiting company paper on People → Contracts, for each role that acts on the tab', async () => {
    for (const role of ['assistant', 'controller', 'master_technician', 'dev']) {
      io.role = role
      renderWithProviders(<DocumentsAgreementsTab />)
      await screen.findAllByTestId('documents-agreements-row')
      expect(screen.getByRole('link', { name: 'Subcontractor agreement' }).getAttribute('href'), role).toBe('/people?tab=contracts&doc=g1')
      cleanup()
    }
  })

  it('leaves the other doors as they were: a signed one opens its record, and a GC project’s paper GC mode', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.getByRole('button', { name: 'Trade agreement' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Statement of work · Electrical' }).getAttribute('href')).toBe('/gc')
    // A company's line carries no act of its own: its send is on its company's row.
    expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull()
  })

  it('gives an estimator’s waiting line no press', async () => {
    io.role = 'estimator'
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.queryByRole('link', { name: 'Subcontractor agreement' })).toBeNull()
    expect(screen.getByText('Subcontractor agreement')).toBeTruthy()
  })
})
