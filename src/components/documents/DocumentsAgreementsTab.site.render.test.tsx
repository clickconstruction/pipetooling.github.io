// @vitest-environment jsdom
/**
 * Documents → Agreements, the site (punch list #439, piece 3): **Find by site…** opens the window that finds an
 * address on file, and the list is then asked for the papers that name it, with every spelling answered Same place.
 * A line whose paper names a site says so. **Clear the site** and **Every site** put the list back. The Search tab
 * carries no site. Every name and address here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow, AgreementsQuery } from '../../lib/documents/agreementsLedger'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const KEY_QUARRY = '118 old quarry trail sampleton tx'
const KEY_BARN = '118 old quarry trail barn sampleton tx'

const io = vi.hoisted(() => ({
  role: 'assistant' as string,
  rows: [] as unknown[],
  /** The site each read of the list asked for: its keys, or `every`. */
  asks: [] as string[],
  answers: [] as unknown[],
  failAnswers: false,
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: false, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsLedgerIo', () => ({
  readAgreements: async (q: AgreementsQuery) => {
    io.asks.push(q.site ? [...q.site.keys].sort().join(' | ') : 'every')
    return { rows: q.site ? io.rows.slice(0, 1) : io.rows, more: false }
  },
  countAgreementsWaiting: async () => 1,
  countAgreementsNotSent: async () => 0,
}))
vi.mock('../../hooks/useAddressesOnFile', () => ({
  readAddresses: async () => ({
    rows: [
      { kind: 'job', id: 'j1', address: QUARRY, developmentId: null, label: 'J1340' },
      { kind: 'job', id: 'j2', address: QUARRY, developmentId: null, label: 'J1352' },
    ],
    developments: new Map(),
  }),
}))
vi.mock('../../hooks/useAddressLookAlikes', () => ({
  readAnswers: async () => {
    if (io.failAnswers) throw new Error('refused')
    return io.answers
  },
}))
vi.mock('./AgreementsSendPaper', () => ({ AgreementsSendPaper: () => <button type="button">Send a paper</button> }))
vi.mock('./AgreementsContractLibrary', () => ({ AgreementsContractLibrary: () => null }))
vi.mock('./PaperPartyAddToList', () => ({ PaperPartyAddToList: () => null }))
vi.mock('../contracts/ContractSendWindow', () => ({ ContractSendWindow: () => null }))
vi.mock('../contracts/PersonContractSignedRecordModal', () => ({ PersonContractSignedRecordModal: () => null }))
vi.mock('../jobs/JobContractModal', () => ({ default: () => null }))
vi.mock('../jobs/JobContractRecordModal', () => ({ buildJobContractRecordHtml: () => '<html></html>' }))
vi.mock('../jobs/WorkOrderAssemblerModal', () => ({ WorkOrderAssemblerModal: () => null }))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => null }))
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobContractRows: async () => [] }))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({ readPersonPaperSendFacts: async () => null, sendPersonPaperForSignature: async () => ({}) }))

const row = (over: Partial<AgreementRow>): AgreementRow => ({
  id: 'supply_house_agreement:d1',
  kind: 'supply_house_agreement',
  source_id: 'd1',
  state: 'waiting',
  paper_name: 'Vendor NDA',
  with_name: 'Tallgrass Supply Co.',
  job_id: null,
  job_hcp_number: null,
  job_click_number: null,
  job_name: null,
  job_address: null,
  more_jobs: 0,
  person_id: null,
  person_kind: null,
  at: '2026-11-20T18:00:00Z',
  at_day: '2026-11-20',
  facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park', signer_title: 'Branch manager' },
  ...over,
})

beforeEach(() => {
  io.role = 'assistant'
  io.asks = []
  io.answers = []
  io.failAnswers = false
  io.rows = [row({ site_address_key: KEY_QUARRY, site_address: QUARRY }), row({ id: 'supply_house_agreement:d2', source_id: 'd2', paper_name: 'Vendor terms', with_name: 'Example Pipe & Valve' })]
})
afterEach(() => cleanup())

async function pickQuarry() {
  fireEvent.click(screen.getByRole('button', { name: 'Find by site…' }))
  await screen.findByRole('dialog', { name: 'Which site is it for?' })
  fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: '118 old' } })
  fireEvent.click(await screen.findByRole('button', { name: /^118 Old Quarry Trl, Sampleton, TX/ }))
}

describe('Documents → Agreements · the site', () => {
  it('says the site on a line whose paper names one, and nothing on the others', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const lines = await screen.findAllByTestId('documents-agreements-row')
    expect(lines).toHaveLength(2)
    expect(screen.getAllByTestId('agreement-site').map((s) => s.textContent)).toEqual([`for the site at ${QUARRY}`])
    expect(lines[1]?.querySelector('[data-testid="agreement-site"]')).toBeNull()
    expect(io.asks).toEqual(['every'])
    expect(screen.queryByTestId('documents-agreements-site')).toBeNull()
  })

  it('Find by site… asks the list for the picked address, says so over the list, and Clear the site puts it back', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    fireEvent.click(screen.getByRole('button', { name: 'Find by site…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Which site is it for?' })
    // The window speaks for the list here, not for a send.
    expect(dialog.textContent).toContain('Pick an address. The list then shows the papers that name it.')
    expect(screen.getByRole('button', { name: /^Every site/ }).textContent).toBe('Every siteThe list goes back to every paper.')
    expect(screen.queryByRole('button', { name: /^It is not for a site/ })).toBeNull()
    fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: '118 old' } })
    fireEvent.click(await screen.findByRole('button', { name: /^118 Old Quarry Trl, Sampleton, TX/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Which site is it for?' })).toBeNull())
    await waitFor(() => expect(io.asks).toEqual(['every', KEY_QUARRY]))
    expect(screen.getByTestId('documents-agreements-site').textContent).toBe(`Papers for the site at ${QUARRY}.Clear the site`)
    await waitFor(() => expect(screen.getAllByTestId('documents-agreements-row')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Clear the site' }))
    await waitFor(() => expect(io.asks).toEqual(['every', KEY_QUARRY, 'every']))
    expect(screen.queryByTestId('documents-agreements-site')).toBeNull()
  })

  it('asks for every spelling answered Same place, and for the picked one alone when the answers are refused', async () => {
    io.answers = [{ keyA: KEY_BARN, keyB: KEY_QUARRY, same: true, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' }]
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    await pickQuarry()
    await waitFor(() => expect(io.asks).toEqual(['every', `${KEY_BARN} | ${KEY_QUARRY}`]))
    cleanup()

    io.asks = []
    io.failAnswers = true
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    await pickQuarry()
    await waitFor(() => expect(io.asks).toEqual(['every', KEY_QUARRY]))
  })

  it('Every site and Escape each close the window, and only Every site clears a site', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    await pickQuarry()
    await waitFor(() => expect(screen.getByTestId('documents-agreements-site')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Find by site…' }))
    await screen.findByRole('dialog', { name: 'Which site is it for?' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Which site is it for?' })).toBeNull())
    expect(screen.getByTestId('documents-agreements-site')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Find by site…' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Every site/ }))
    await waitFor(() => expect(screen.queryByTestId('documents-agreements-site')).toBeNull())
    expect(io.asks[io.asks.length - 1]).toBe('every')
  })

  it('a site with no paper says so, and the empty list’s press clears the site', async () => {
    io.rows = []
    renderWithProviders(<DocumentsAgreementsTab />)
    await waitFor(() => expect(io.asks).toEqual(['every']))
    await pickQuarry()
    await waitFor(() => expect(io.asks).toEqual(['every', KEY_QUARRY]))
    fireEvent.click(await screen.findByRole('button', { name: 'Clear the filters' }))
    await waitFor(() => expect(io.asks).toEqual(['every', KEY_QUARRY, 'every']))
    expect(screen.queryByTestId('documents-agreements-site')).toBeNull()
  })

  it('an estimator finds by site too, and the Search tab carries no site', async () => {
    io.role = 'estimator'
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.getByRole('button', { name: 'Find by site…' })).toBeTruthy()
    cleanup()
    renderWithProviders(<DocumentsAgreementsTab embedded embedSearch="vendor" />)
    await screen.findAllByTestId('documents-agreements-row')
    expect(screen.queryByRole('button', { name: 'Find by site…' })).toBeNull()
  })
})
