// @vitest-environment jsdom
/**
 * Documents → Agreements (punch list #376): every agreement on file, newest first under a band per month, with a kind
 * and a state to pick and a box to type in; a line says its kind, its name, who it is with, the job, where it stands
 * and its day, and a press opens the window that kind already has; the list says so when nothing matches or nothing is
 * on file; a read that fails says so with Retry; under the Search tab it asks only for the words it is handed. A paper
 * that waits acts where it sits: a job's contract opens its Contract window, and a staff, sub or partner paper carries
 * Send again and Copy the signing link, both through the one sender, and the list reads again after. An outside
 * party's paper that is not signed also carries Take back: it asks first, deletes through the one guarded delete, says
 * what came of it, and reads again. A signed paper carries none. A party's paper that was made and never sent reads
 * not sent under a chip that shows while one exists, says what kind of paper it is when it is not an agreement, and
 * carries Send, which opens the Send window for a first send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow, AgreementsQuery } from '../../lib/documents/agreementsLedger'
import { stubPhoneWidth } from '../../test/phoneWidth'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const io = vi.hoisted(() => ({
  rows: [] as unknown[],
  more: false,
  waiting: 0 as number | null,
  asks: [] as Array<{ kind: string; state: string; typed: string; limit: number }>,
  counts: [] as string[],
  fail: null as null | Error,
  jobs: [] as string[],
  windows: [] as string[],
  facts: [] as string[],
  sends: [] as Array<Record<string, unknown>>,
  sendFail: null as null | Error,
  reminderSwitch: false,
  reminders: {} as Record<string, Record<string, unknown>>,
  reminderReads: [] as string[][],
  reminderWrites: [] as Array<{ id: string; turnOn: boolean }>,
  reminderFail: null as null | Error,
  /** How many papers were made and never sent; the Not sent chip shows while it is above none. */
  notSent: 0 as number | null,
  notSentCounts: [] as string[],
  /** Who is signed in. The office's assistant unless a test says otherwise. */
  role: 'assistant' as string,
  takeBacks: [] as string[],
  takeBackOutcome: { kind: 'taken' } as { kind: string },
  takeBackFail: null as null | Error,
}))
vi.mock('../../lib/documents/paperTakeBackIo', () => ({
  takeBackPartyPaper: async (documentId: string) => {
    io.takeBacks.push(documentId)
    if (io.takeBackFail) throw io.takeBackFail
    return io.takeBackOutcome
  },
  // A trade company's own paper goes through its function, never the plain delete.
  takeBackCompanyPaper: async (documentId: string) => {
    io.takeBacks.push(`company:${documentId}`)
    if (io.takeBackFail) throw io.takeBackFail
    return io.takeBackOutcome
  },
}))
vi.mock('../../lib/contracts/personPaperReminderIo', () => ({
  NO_PAPER_REMINDERS: { switchOn: false, byId: new Map() },
  readPaperReminders: async (ids: string[]) => {
    io.reminderReads.push(ids)
    return { switchOn: io.reminderSwitch, byId: new Map(Object.entries(io.reminders)) }
  },
  writePaperReminderSwitch: async (id: string, turnOn: boolean) => {
    io.reminderWrites.push({ id, turnOn })
    if (io.reminderFail) throw io.reminderFail
  },
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsLedgerIo', () => ({
  readAgreements: async (q: AgreementsQuery) => {
    io.asks.push({ kind: q.kind, state: q.state, typed: q.typed, limit: q.limit })
    if (io.fail) throw io.fail
    return { rows: io.rows, more: io.more }
  },
  countAgreementsWaiting: async (kind: string) => {
    io.counts.push(kind)
    return io.waiting
  },
  countAgreementsNotSent: async (kind: string) => {
    io.notSentCounts.push(kind)
    return io.notSent
  },
}))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({
  readPersonPaperSendFacts: async (documentId: string) => {
    io.facts.push(documentId)
    return { target: { personName: 'Bryce Tolland', documentName: 'Referral partner agreement' }, initialEmail: 'bryce@example.com', personId: null, sender: null }
  },
  sendPersonPaperForSignature: async (input: Record<string, unknown>) => {
    io.sends.push(input)
    if (io.sendFail) throw io.sendFail
    return { acceptUrl: 'https://x/contract/accept?t=new', emailed: false, emailNote: null }
  },
}))
// The Send window is its own file's to test: here it says what it was opened on, and its button says it sent.
// Add to a list is its own file's to test: here it says which paper it was opened on, and its button says it added them.
vi.mock('./PaperPartyAddToList', () => ({
  PaperPartyAddToList: (p: { documentId: string; onAdded: (words: string) => void }) => (
    <div data-testid="add-to-list-window">
      {p.documentId}
      <button type="button" onClick={() => p.onAdded('Noor Haddad is with Ridgeway Builders now.')}>
        fake add
      </button>
    </div>
  ),
}))
vi.mock('../contracts/ContractSendWindow', () => ({
  ContractSendWindow: (p: { again?: boolean; docId: string | null; target: { personName: string; documentName: string } | null; initialEmail: string; onSent: (s: { docId: string; emailed: boolean; planKind: null }) => void }) => (
    <div data-testid="send-window">
      {`${p.again ? 'again' : 'first'}|${p.docId}|${p.target?.personName}|${p.target?.documentName}|${p.initialEmail}`}
      <button type="button" onClick={() => p.onSent({ docId: p.docId ?? '', emailed: true, planKind: null })}>
        fake send
      </button>
    </div>
  ),
}))
// The library door is its own file's to test: here it says it is open, and its button closes it.
vi.mock('./AgreementsContractLibrary', () => ({
  AgreementsContractLibrary: (p: { open: boolean; onClose: () => void }) =>
    p.open ? (
      <div data-testid="contract-library">
        open
        <button type="button" onClick={p.onClose}>
          fake close
        </button>
      </div>
    ) : null,
}))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async (id: string) => {
    io.jobs.push(id)
    return { id, hcp_number: '2418', click_number: '', job_name: 'Pierce kitchen repipe', job_address: '410 Maple St', customer_name: 'Harlan Pierce' }
  },
}))
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobContractRows: async () => [] }))
// The windows themselves are their own files' to test: here each says it opened, and on what.
vi.mock('../jobs/JobContractModal', () => ({
  default: (p: { open: boolean; job: { id: string } | null; initialRecordId?: string | null }) => (p.open ? <div data-testid="contract-window">{`${p.job?.id}|${p.initialRecordId}`}</div> : null),
}))
vi.mock('../jobs/JobContractRecordModal', () => ({ buildJobContractRecordHtml: () => '<html></html>' }))
vi.mock('../contracts/PersonContractSignedRecordModal', () => ({
  PersonContractSignedRecordModal: (p: { open: boolean; documentId: string | null }) => (p.open ? <div data-testid="signed-record-window">{p.documentId}</div> : null),
}))
vi.mock('../jobs/WorkOrderAssemblerModal', () => ({
  WorkOrderAssemblerModal: (p: { open: boolean; jobs: Array<{ id: string }>; initial: { commitmentId?: string | null } | null }) =>
    p.open ? <div data-testid="work-order-window">{`${p.jobs[0]?.id}|${p.initial?.commitmentId}`}</div> : null,
}))

/** Every name, job and date here is made up. */
const row = (over: Partial<AgreementRow>): AgreementRow => ({
  id: 'job_contract:c1',
  kind: 'job_contract',
  source_id: 'c1',
  state: 'signed',
  paper_name: 'Residential plumbing contract',
  with_name: 'Harlan Pierce',
  job_id: 'j1',
  job_hcp_number: '2418',
  job_click_number: '',
  job_name: 'Pierce kitchen repipe',
  job_address: '410 Maple St',
  more_jobs: 0,
  person_id: null,
  person_kind: null,
  at: '2026-11-14T18:00:00Z',
  at_day: '2026-11-14',
  facts: { status: 'signed', signer_mode: 'type', signed_at: '2026-11-14T18:00:00Z' },
  ...over,
})
const lastAsk = () => io.asks[io.asks.length - 1]
const lines = () => screen.findAllByTestId('documents-agreements-row')

beforeEach(() => {
  io.rows = []
  io.more = false
  io.waiting = 0
  io.asks = []
  io.counts = []
  io.fail = null
  io.jobs = []
  io.facts = []
  io.sends = []
  io.sendFail = null
  io.reminderSwitch = false
  io.reminders = {}
  io.reminderReads = []
  io.reminderWrites = []
  io.reminderFail = null
  io.role = 'assistant'
  io.notSent = 0
  io.notSentCounts = []
  io.takeBacks = []
  io.takeBackOutcome = { kind: 'taken' }
  io.takeBackFail = null
})
afterEach(() => {
  cleanup()
  stubPhoneWidth(false)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DocumentsAgreementsTab', () => {
  it('lists each agreement as a line under its month: kind, name, who and which job, where it stands, its day', async () => {
    io.waiting = 1
    io.rows = [
      row({ id: 'job_contract:c2', source_id: 'c2', state: 'waiting', at_day: '2026-11-16', facts: { status: 'sent', send_count: 2, view_count: 3, sent_channel: 'link' } }),
      row({ id: 'person_agreement:d1', kind: 'person_agreement', source_id: 'd1', paper_name: 'Employee handbook', with_name: 'Priya Nair', job_id: null, job_hcp_number: null, job_click_number: null, job_name: null, job_address: null, person_kind: 'helper', at_day: '2026-10-20', facts: { status: 'signed' } }),
      row({ id: 'job_contract:c5', source_id: 'c5', paper_name: '', with_name: 'Dalton Property Group', job_id: 'j3', job_hcp_number: '2377', job_name: 'Dalton duplex A', more_jobs: 2, at_day: '2026-10-30', facts: { status: 'signed', signer_mode: 'paper', has_upload: true, signed_at: '2026-10-30T12:00:00Z' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^ContractResidential plumbing contractWith Harlan Pierce · J2418 · Pierce kitchen repipe · 410 Maple Stsent ×2 · opened 3×Sent Nov 16$/),
      expect.stringMatching(/^StaffEmployee handbookWith Priya Nairsigned ✓Signed Oct 20$/),
      expect.stringMatching(/^ContractSigned paper · scanWith Dalton Property Group · J2377 · Dalton duplex A · and 2 more jobson file · paperSigned Oct 30$/),
    ])
    expect(screen.getAllByTestId('documents-agreements-month').map((h) => h.textContent)).toEqual(['November 20261 agreement', 'October 20262 agreements'])
    expect(screen.getByTestId('documents-agreements-count').textContent).toBe('3 agreements')
    // The job on a line opens the job; the chip that waits carries its count.
    expect(screen.getByRole('link', { name: 'J2377 · Dalton duplex A' }).getAttribute('href')).toBe('/jobs?edit=j3')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Waiting on a signature · 1' })).toBeTruthy())
    expect(io.asks[0]).toEqual({ kind: 'all', state: 'live', typed: '', limit: 100 })
    expect(screen.getByTestId('documents-agreements-doors').textContent).toBe('A job with no contract is in the Contract sweep, under Tools on the Pipeline. An accepted estimate is on the Estimates tab.')
  })

  it('says the business a paper names when its party is another: someone added to a list under a second company', async () => {
    io.rows = [
      row({ id: 'customer_agreement:d9', kind: 'customer_agreement', source_id: 'd9', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Ridgeway Builders', job_id: null, job_hcp_number: null, job_name: null, job_address: null, at_day: '2026-11-18', facts: { status: 'sent', party_kind: 'customer', signer_name: 'Noor Haddad', signing_for: 'Haddad Engineering' } }),
      row({ id: 'customer_agreement:d8', kind: 'customer_agreement', source_id: 'd8', state: 'waiting', paper_name: 'Site secrecy agreement', with_name: 'Ridgeway Builders', job_id: null, job_hcp_number: null, job_name: null, job_address: null, at_day: '2026-11-17', facts: { status: 'sent', party_kind: 'customer', signer_name: 'Dana Ruiz', signer_title: 'Project manager', signing_for: 'Ridgeway Builders' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const words = (await lines()).map((r) => r.textContent ?? '')
    expect(words[0]).toContain('With Ridgeway Builders · Noor Haddad signs · signing for Haddad Engineering')
    expect(words[1]).toContain('With Ridgeway Builders · Dana Ruiz signs, Project manager')
    expect(words[1]).not.toContain('signing for')
  })

  it('asks again for a chip at once, and for typed words once the typing rests', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findByTestId('documents-agreements-empty')
    fireEvent.click(screen.getByRole('button', { name: 'Work orders' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'orders', state: 'live', typed: '', limit: 100 }))
    await waitFor(() => expect(io.counts[io.counts.length - 1]).toBe('orders'))
    fireEvent.click(screen.getByRole('button', { name: 'Voided or ended' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'orders', state: 'ended', typed: '', limit: 100 }))
    expect(screen.getByRole('button', { name: 'Voided or ended' }).getAttribute('aria-pressed')).toBe('true')
    vi.useFakeTimers()
    const before = io.asks.length
    fireEvent.change(screen.getByLabelText('Find an agreement'), { target: { value: 'cedar' } })
    expect(io.asks.length).toBe(before)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    expect(lastAsk()).toEqual({ kind: 'orders', state: 'ended', typed: 'cedar', limit: 100 })
  })

  it('with nothing on file names the page that fills it, and with nothing matching offers to clear', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const empty = await screen.findByTestId('documents-agreements-empty')
    expect(empty.textContent).toBe('No agreements yet. Pipeline is where a contract is sent to sign.')
    expect(screen.getAllByRole('link', { name: 'Pipeline' })[0]?.getAttribute('href')).toBe('/jobs?tab=stages')
    fireEvent.click(screen.getByRole('button', { name: 'Partners' }))
    await waitFor(() => expect(screen.getByTestId('documents-agreements-empty').textContent).toBe('No agreements match the filters. Clear the filters'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'all', state: 'live', typed: '', limit: 100 }))
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('reads the next page on Show more, and says the list is the newest while more waits', async () => {
    io.rows = [row({})]
    io.more = true
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.getByTestId('documents-agreements-count').textContent).toBe('The newest 1 agreement')
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(lastAsk()?.limit).toBe(200))
  })

  it('says so when the read fails, and reads again on Retry', async () => {
    io.fail = new Error('Failed to fetch')
    renderWithProviders(<DocumentsAgreementsTab />)
    const retry = await screen.findByRole('button', { name: /retry/i })
    expect(screen.queryByTestId('documents-agreements-empty')).toBeNull()
    io.fail = null
    io.rows = [row({})]
    fireEvent.click(retry)
    expect((await lines()).length).toBe(1)
  })

  it('a signed contract opens the Contract window on its record', async () => {
    io.rows = [row({})]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Residential plumbing contract' }))
    expect((await screen.findByTestId('contract-window')).textContent).toBe('j1|c1')
    expect(io.jobs).toEqual(['j1'])
  })

  it('a contract that waits on a signature opens its Contract window, where it is sent again or voided', async () => {
    io.rows = [row({ state: 'waiting', facts: { status: 'sent', send_count: 1 } })]
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Residential plumbing contract' }))
    expect((await screen.findByTestId('contract-window')).textContent).toBe('j1|c1')
    expect(opened).not.toHaveBeenCalled()
    // A job's contract carries no presses on its line: its acts are in its window.
    expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull()
  })

  it('a voided contract opens its preview in a window, inside the press', async () => {
    io.rows = [row({ state: 'ended', facts: { status: 'voided', voided_at: '2026-10-15T12:00:00Z' } })]
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Residential plumbing contract' }))
    expect(opened).toHaveBeenCalledWith('', '_blank')
    // A blocked popup says so in words, and no Contract window opens in its place.
    expect(await screen.findByText('The contract did not open. Allow popups for this page, then press it again.')).toBeTruthy()
    expect(screen.queryByTestId('contract-window')).toBeNull()
  })

  it('a person’s signed agreement opens its record, and one still waiting is a link to People → Contracts', async () => {
    io.rows = [
      row({ id: 'person_agreement:d1', kind: 'person_agreement', source_id: 'd1', paper_name: 'Employee handbook', with_name: 'Priya Nair', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'signed' } }),
      row({ id: 'partner_agreement:d2', kind: 'partner_agreement', source_id: 'd2', state: 'waiting', paper_name: 'Referral partner agreement', with_name: 'Bryce Tolland', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'sent' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.getByRole('link', { name: 'Referral partner agreement' }).getAttribute('href')).toBe('/people?tab=contracts&doc=d2')
    fireEvent.click(screen.getByRole('button', { name: 'Employee handbook' }))
    expect((await screen.findByTestId('signed-record-window')).textContent).toBe('d1')
  })

  const waitingPaper = () =>
    row({ id: 'partner_agreement:d2', kind: 'partner_agreement', source_id: 'd2', state: 'waiting', paper_name: 'Referral partner agreement', with_name: 'Bryce Tolland', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'sent' } })
  const signedPaper = () =>
    row({ id: 'person_agreement:d1', kind: 'person_agreement', source_id: 'd1', paper_name: 'Employee handbook', with_name: 'Priya Nair', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'signed' } })
  /** A supply house's paper that is out and not signed. */
  const partyPaper = (over: Partial<AgreementRow> = {}) =>
    row({
      id: 'supply_house_agreement:p1',
      kind: 'supply_house_agreement',
      source_id: 'p1',
      state: 'waiting',
      paper_name: 'Mutual secrecy agreement',
      with_name: 'Tallgrass Supply Co',
      job_id: null,
      job_name: null,
      job_hcp_number: null,
      job_click_number: null,
      job_address: null,
      facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park' },
      ...over,
    })

  it('an outside party’s paper says what the party is and who signs, and one that waits acts on its line', async () => {
    const off = { job_id: null, job_name: null, job_hcp_number: null, job_click_number: null, job_address: null }
    io.rows = [
      row({ id: 'outside_agreement:p4', kind: 'outside_agreement', source_id: 'p4', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Haddad Engineering', ...off, at_day: '2026-11-19', facts: { status: 'sent', party_kind: 'none', signer_name: 'Noor Haddad', signer_title: 'Structural engineer' } }),
      row({ id: 'supply_house_agreement:p1', kind: 'supply_house_agreement', source_id: 'p1', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Tallgrass Supply Co.', ...off, at_day: '2026-11-18', facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park', signer_title: 'Branch manager' } }),
      row({ id: 'customer_agreement:p2', kind: 'customer_agreement', source_id: 'p2', state: 'signed', paper_name: 'Site secrecy agreement', with_name: 'Ridgeway Builders', ...off, at_day: '2026-11-17', facts: { status: 'signed', party_kind: 'customer', signer_name: 'Dana Ruiz', signer_title: 'Project manager', signer_printed_name: 'Dana M. Ruiz' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Not on a listMutual secrecy agreementWith Haddad Engineering · Noor Haddad signs, Structural engineernever openedSent Nov 19Add to a listSend againCopy the signing link$/),
      expect.stringMatching(/^Supply houseMutual secrecy agreementWith Tallgrass Supply Co\. · Lena Park signs, Branch managernever openedSent Nov 18Send againCopy the signing link$/),
      expect.stringMatching(/^CustomerSite secrecy agreementWith Ridgeway Builders · signed by Dana M\. Ruiz, Project managersigned ✓Signed Nov 17$/),
    ])
    // A waiting party's paper has no page of its own to open: its name is words. A signed one opens its record.
    expect(rows[1]?.querySelector('a')).toBeNull()
    expect(Array.from(rows[2]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Site secrecy agreement'])
    // The chip that asks for them.
    fireEvent.click(screen.getByRole('button', { name: 'Outside companies' }))
    await waitFor(() => expect(io.asks[io.asks.length - 1]).toMatchObject({ kind: 'outside' }))
  })

  it('a paper whose party is on no list carries Add to a list, signed or not, and nobody else does', async () => {
    const off = { job_id: null, job_name: null, job_hcp_number: null, job_click_number: null, job_address: null }
    io.rows = [
      row({ id: 'outside_agreement:p4', kind: 'outside_agreement', source_id: 'p4', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Haddad Engineering', ...off, facts: { status: 'sent', party_kind: 'none', signer_name: 'Noor Haddad' } }),
      row({ id: 'outside_agreement:p5', kind: 'outside_agreement', source_id: 'p5', state: 'signed', paper_name: 'Credit terms letter', with_name: 'Haddad Engineering', ...off, facts: { status: 'signed', party_kind: 'none', signer_name: 'Noor Haddad' } }),
      row({ id: 'supply_house_agreement:p1', kind: 'supply_house_agreement', source_id: 'p1', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Tallgrass Supply Co.', ...off, facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(Array.from(rows[0]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Add to a list', 'Send again', 'Copy the signing link'])
    expect(Array.from(rows[1]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Credit terms letter', 'Add to a list'])
    expect(Array.from(rows[2]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send again', 'Copy the signing link'])
    // The press opens the window on that paper, and once they are on a list the list reads again.
    const asksBefore = io.asks.length
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Add to a list' }))
    expect((await screen.findByTestId('add-to-list-window')).textContent).toContain('p4')
    fireEvent.click(screen.getByRole('button', { name: 'fake add' }))
    expect(await screen.findByText('Noor Haddad is with Ridgeway Builders now.')).toBeTruthy()
    await waitFor(() => expect(io.asks.length).toBeGreaterThan(asksBefore))
    expect(screen.queryByTestId('add-to-list-window')).toBeNull()
  })

  it('only a paper that waits carries Send again and Copy the signing link', async () => {
    io.rows = [signedPaper(), waitingPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows[0]?.querySelectorAll('button').length).toBe(1)
    expect(Array.from(rows[1]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send again', 'Copy the signing link'])
  })

  it('a waiting paper says nothing about reminders until one is set, and asks only for the staff and sub papers that wait', async () => {
    io.rows = [signedPaper(), waitingPaper(), row({ id: 'job_contract:c2', source_id: 'c2', state: 'waiting', facts: { status: 'sent' } })]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    await waitFor(() => expect(io.reminderReads).toEqual([['d2']]))
    expect(screen.queryByTestId('documents-agreements-reminders')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Turn reminders off' })).toBeNull()
  })

  it('a paper with a reminder set counts what went, names the next day, and turns off on its line', async () => {
    io.rows = [waitingPaper()]
    io.reminderSwitch = true
    io.reminders = { d2: { status: 'sent', doc_type: 'agreement', person_name: 'Bryce Tolland', signer_email: 'bryce@example.com', reminders_enabled: true, reminder_count: 1, next_reminder_at: '2026-11-23T18:00:00Z' } }
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect((await screen.findByTestId('documents-agreements-reminders')).textContent).toBe('1 of 3 reminders sent · next Nov 23')
    const before = io.asks.length
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders off' }))
    await waitFor(() => expect(io.reminderWrites).toEqual([{ id: 'd2', turnOn: false }]))
    expect(await screen.findByText('Reminders are off for this paper. Bryce Tolland gets no more.')).toBeTruthy()
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
  })

  it('a paper turned off reads so and turns on again, and a write that fails says why', async () => {
    io.rows = [waitingPaper()]
    io.reminderSwitch = true
    io.reminders = { d2: { status: 'sent', doc_type: 'agreement', person_name: 'Bryce Tolland', signer_email: 'bryce@example.com', reminders_enabled: false, reminder_count: 1, next_reminder_at: null } }
    io.reminderFail = new Error('The paper is no longer waiting on a signature. Read the list again.')
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect((await screen.findByTestId('documents-agreements-reminders')).textContent).toBe('Reminders off · 1 of 3 sent')
    fireEvent.click(screen.getByRole('button', { name: 'Turn reminders on' }))
    await waitFor(() => expect(io.reminderWrites).toEqual([{ id: 'd2', turnOn: true }]))
    expect(await screen.findByText('The paper is no longer waiting on a signature. Read the list again.')).toBeTruthy()
  })

  it('all three sent reads so with no press, and a paper with no address cannot be turned on', async () => {
    io.rows = [waitingPaper()]
    io.reminderSwitch = true
    io.reminders = { d2: { status: 'sent', doc_type: 'agreement', person_name: 'Bryce Tolland', signer_email: 'bryce@example.com', reminders_enabled: true, reminder_count: 3, next_reminder_at: null } }
    const view = renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect((await screen.findByTestId('documents-agreements-reminders')).textContent).toBe('All 3 reminders sent')
    expect(screen.queryByRole('button', { name: /Turn reminders/ })).toBeNull()
    view.unmount()
    io.reminders = { d2: { status: 'sent', doc_type: 'agreement', person_name: 'Bryce Tolland', signer_email: null, reminders_enabled: true, reminder_count: 0, next_reminder_at: null } }
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect((await screen.findByTestId('documents-agreements-reminders')).textContent).toBe('Reminders off')
    expect(screen.queryByRole('button', { name: /Turn reminders/ })).toBeNull()
  })

  it('Send again opens the Send window on that paper, and the list reads again once it is sent', async () => {
    io.rows = [waitingPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const before = io.asks.length
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('again|d2|Bryce Tolland|Referral partner agreement|bryce@example.com')
    expect(io.facts).toEqual(['d2'])
    // Nothing is sent by opening the window.
    expect(io.sends).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'fake send' }))
    await waitFor(() => expect(screen.queryByTestId('send-window')).toBeNull())
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
  })

  it('Copy the signing link asks first, makes the link with nothing emailed, copies it, and reads again', async () => {
    io.rows = [waitingPaper()]
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void copied.push(t) } })
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const before = io.asks.length
    fireEvent.click(screen.getByRole('button', { name: 'Copy the signing link' }))
    expect(await screen.findByText('This makes a new signing link for Bryce Tolland. The link sent before stops working. Nothing is emailed.')).toBeTruthy()
    // Nothing is made until the confirm's own press.
    expect(io.sends).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Make and copy the link' }))
    expect(await screen.findByText('Signing link copied. Send it to Bryce Tolland. It works for 14 days.')).toBeTruthy()
    expect(io.sends).toEqual([{ documentId: 'd2', mode: 'link' }])
    expect(copied).toEqual(['https://x/contract/accept?t=new'])
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
  })

  it('Cancel on the confirm makes no link, and a link that fails says why', async () => {
    io.rows = [waitingPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Copy the signing link' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Make and copy the link' })).toBeNull())
    expect(io.sends).toEqual([])
    io.sendFail = new Error('This document is already signed')
    fireEvent.click(screen.getByRole('button', { name: 'Copy the signing link' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Make and copy the link' }))
    expect(await screen.findByText('This document is already signed')).toBeTruthy()
  })

  it('Take back asks first, deletes the paper, says its link no longer works, and reads again', async () => {
    io.role = 'master_technician'
    io.rows = [partyPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const before = io.asks.length
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    expect(
      await screen.findByText('This deletes the copy of Mutual secrecy agreement that is with Tallgrass Supply Co. The signing link sent to Lena Park stops working. Nobody is emailed. It cannot be undone.'),
    ).toBeTruthy()
    // Nothing is deleted until the confirm's own press, which names the act.
    expect(io.takeBacks).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Mutual secrecy agreement was taken back from Tallgrass Supply Co. Its signing link no longer works.')).toBeTruthy()
    expect(io.takeBacks).toEqual(['p1'])
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
  })

  it('Cancel on the confirm deletes nothing', async () => {
    io.role = 'master_technician'
    io.rows = [partyPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Take back the paper' })).toBeNull())
    expect(io.takeBacks).toEqual([])
  })

  it('a paper signed a moment before the press is kept, and the office is told why', async () => {
    io.role = 'master_technician'
    io.rows = [partyPaper()]
    io.takeBackOutcome = { kind: 'signed-since' }
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const before = io.asks.length
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Mutual secrecy agreement was signed before it could be taken back. A signed paper is kept.')).toBeTruthy()
    // The list reads again, so the line says signed.
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
  })

  it('a take-back the database refuses says its reason, and one the account may not make says so', async () => {
    io.role = 'master_technician'
    io.rows = [partyPaper()]
    io.takeBackFail = new Error('This account is in training and cannot change anything.')
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('This account is in training and cannot change anything.')).toBeTruthy()
    io.takeBackFail = null
    io.takeBackOutcome = { kind: 'refused' }
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Mutual secrecy agreement was not taken back. Your account cannot delete a paper.')).toBeTruthy()
  })

  it('a trade company’s own paper is taken back through its function, and a paper GC mode is waiting on says so', async () => {
    const off = { job_id: null, job_name: null, job_hcp_number: null, job_click_number: null, job_address: null }
    io.role = 'master_technician'
    io.rows = [row({ id: 'company_agreement:g1', kind: 'company_agreement', source_id: 'g1', state: 'waiting', paper_name: 'Trade agreement', with_name: 'Juniper Mechanical LLC', ...off, facts: { status: 'sent', signer_name: 'Pat Sample' } })]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    expect(
      await screen.findByText('This deletes the copy of Trade agreement that is with Juniper Mechanical LLC. The signing link sent to Pat Sample stops working. Nobody is emailed. It cannot be undone.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Trade agreement was taken back from Juniper Mechanical LLC. Its signing link no longer works.')).toBeTruthy()
    expect(io.takeBacks).toEqual(['company:g1'])

    // The function's refusal is the office's to read, in its own words.
    io.takeBackFail = new Error('Trade agreement stays with Juniper Mechanical LLC, since GC mode asked for it by Nov 30. It is GC mode’s paper to chase.')
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Trade agreement stays with Juniper Mechanical LLC, since GC mode asked for it by Nov 30. It is GC mode’s paper to chase.')).toBeTruthy()
  })

  it('only an unsigned paper of an outside party or a trade company carries Take back: not a signed one, a job’s or a teammate’s', async () => {
    const off = { job_id: null, job_name: null, job_hcp_number: null, job_click_number: null, job_address: null }
    io.role = 'dev'
    io.rows = [
      partyPaper(),
      partyPaper({ id: 'customer_agreement:p2', kind: 'customer_agreement', source_id: 'p2', state: 'signed', facts: { status: 'signed', party_kind: 'customer', signer_name: 'Dana Ruiz' } }),
      partyPaper({ id: 'customer_agreement:p3', kind: 'customer_agreement', source_id: 'p3', job_id: 'j9', job_name: 'Ridgeway tower', facts: { status: 'sent', party_kind: 'customer', signer_name: 'Dana Ruiz' } }),
      waitingPaper(),
      row({ id: 'company_agreement:g1', kind: 'company_agreement', source_id: 'g1', state: 'waiting', paper_name: 'Trade agreement', with_name: 'Juniper Mechanical LLC', ...off, facts: { status: 'sent' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    const hasTakeBack = rows.map((r) => within(r).queryByRole('button', { name: 'Take back' }) != null)
    expect(hasTakeBack).toEqual([true, false, false, false, true])
  })

  it('Take back is the leader’s and a dev’s: an assistant and the controller send again and copy a link, and delete nothing', async () => {
    io.rows = [partyPaper()]
    for (const role of ['assistant', 'controller']) {
      io.role = role
      renderWithProviders(<DocumentsAgreementsTab />)
      const rows = await lines()
      expect(Array.from(rows[0]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send again', 'Copy the signing link'])
      cleanup()
    }
    io.role = 'master_technician'
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(Array.from(rows[0]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send again', 'Copy the signing link', 'Take back'])
  })

  it('a paper that was made and never sent reads not sent, says its kind, and carries Send, then Take back for the leader', async () => {
    io.role = 'master_technician'
    io.notSent = 2
    io.rows = [
      partyPaper({ id: 'supply_house_agreement:p7', source_id: 'p7', state: 'not_sent', paper_name: 'Request for taxpayer number', at_day: '2026-11-21', facts: { status: 'unsent', party_kind: 'supply_house', doc_type: 'w9' } }),
      partyPaper({ id: 'outside_agreement:p8', kind: 'outside_agreement', source_id: 'p8', state: 'not_sent', with_name: 'Haddad Engineering', at_day: '2026-11-20', facts: { status: 'unsent', party_kind: 'none', doc_type: 'agreement' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows.map((r) => r.textContent)).toEqual([
      'Supply houseW-9Request for taxpayer numberWith Tallgrass Supply Conot sentMade Nov 21SendTake back',
      'Not on a listMutual secrecy agreementWith Haddad Engineeringnot sentMade Nov 20Add to a listSendTake back',
    ])
    // Its name is words: a paper that was never sent has no record to open.
    expect(Array.from(rows[0]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send', 'Take back'])
    // Send opens the Send window on that paper, for a first send, and the list reads again once it is sent.
    const before = io.asks.length
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Send' }))
    expect((await screen.findByTestId('send-window')).textContent).toContain('first|p7|')
    expect(io.facts).toEqual(['p7'])
    fireEvent.click(screen.getByRole('button', { name: 'fake send' }))
    await waitFor(() => expect(io.asks.length).toBe(before + 1))
    expect(screen.queryByTestId('send-window')).toBeNull()
  })

  it('Take back on a paper that was never sent says nobody holds a link', async () => {
    io.role = 'dev'
    io.notSent = 1
    io.rows = [partyPaper({ id: 'supply_house_agreement:p7', source_id: 'p7', state: 'not_sent', facts: { status: 'unsent', party_kind: 'supply_house' } })]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    expect(await screen.findByText('This deletes the copy of Mutual secrecy agreement made for Tallgrass Supply Co. It was never sent, so nobody holds a link. It cannot be undone.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('Mutual secrecy agreement was taken back. It was never sent.')).toBeTruthy()
    expect(io.takeBacks).toEqual(['p7'])
  })

  it('the Not sent chip shows while a paper is not sent, carries the count, and asks for that state', async () => {
    io.rows = [waitingPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    // Nothing is unsent: no chip.
    expect(screen.queryByRole('button', { name: /^Not sent/ })).toBeNull()
    expect(io.notSentCounts).toEqual(['all'])
    cleanup()
    io.notSent = 2
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const chip = await screen.findByRole('button', { name: 'Not sent · 2' })
    fireEvent.click(chip)
    await waitFor(() => expect(lastAsk()).toMatchObject({ state: 'not_sent' }))
    // The chip stays while it is the one picked, also once the last unsent paper is sent or taken back.
    expect(screen.getByRole('button', { name: 'Not sent · 2' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a count that cannot be read draws no Not sent chip, and the list is as it was', async () => {
    io.notSent = null
    io.rows = [waitingPaper()]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.queryByRole('button', { name: /^Not sent/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sent and signed' })).toBeTruthy()
  })

  it('an assistant sends a paper that was never sent and takes none back', async () => {
    io.notSent = 1
    io.rows = [partyPaper({ id: 'supply_house_agreement:p7', source_id: 'p7', state: 'not_sent', facts: { status: 'unsent', party_kind: 'supply_house' } })]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(Array.from(rows[0]?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual(['Send'])
  })

  it('a work order opens its window on the job, and one with no job is not a press', async () => {
    io.rows = [
      row({ id: 'work_order:w1', kind: 'work_order', source_id: 'w1', paper_name: 'WO-2418-01', with_name: 'Tall Pine Excavating', state: 'waiting', facts: { status: 'offered', offered_at: '2026-11-05T15:00:00Z' } }),
      row({ id: 'work_order:w2', kind: 'work_order', source_id: 'w2', paper_name: 'WO-2360-02', with_name: 'Granite Core Drilling', state: 'ended', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'declined' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.queryByRole('button', { name: 'WO-2360-02' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'WO-2418-01' }))
    expect((await screen.findByTestId('work-order-window')).textContent).toBe('j1|w1')
  })

  it('a GC project’s paper names its project and is a link to GC mode', async () => {
    io.rows = [
      row({ id: 'sow:s1', kind: 'sow', source_id: 's1', state: 'waiting', paper_name: 'Statement of work · Electrical', with_name: 'Brightline Electric', job_id: null, job_hcp_number: null, job_click_number: null, job_name: 'Westfield Clinic', job_address: null, at_day: '2026-09-24', facts: { status: 'sent', sent_on: '2026-09-24' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows[0]?.textContent).toBe('Statement of workStatement of work · ElectricalWith Brightline Electric · Westfield Clinicwaiting on their signatureSent Sep 24')
    expect(screen.getByRole('link', { name: 'Statement of work · Electrical' }).getAttribute('href')).toBe('/gc')
    // The project is not a job, so its name is words and not a link to a job.
    expect(screen.queryByRole('link', { name: 'Westfield Clinic' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'GC projects' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'gc', state: 'live', typed: '', limit: 100 }))
  })

  it('under the Search tab draws no box and no chips, stays quiet until two letters, then asks every state for the words it is handed', async () => {
    const view = renderWithProviders(<DocumentsAgreementsTab embedSearch="" />)
    expect(screen.getByTestId('documents-agreements-embed-hint').textContent).toBe('Results appear when you type a search above.')
    expect(screen.queryByLabelText('Find an agreement')).toBeNull()
    expect(io.asks).toEqual([])
    io.rows = [row({})]
    view.rerender(<DocumentsAgreementsTab embedSearch="pierce" />)
    await lines()
    // Every kind and every state: a search must find a voided paper too. No chips and no doors line under Search.
    expect(lastAsk()).toEqual({ kind: 'all', state: 'any', typed: 'pierce', limit: 100 })
    expect(io.counts).toEqual([])
    expect(screen.queryByRole('group', { name: 'Kind of agreement' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'State' })).toBeNull()
    expect(screen.queryByTestId('documents-agreements-doors')).toBeNull()
    // Send a paper belongs to the tab, beside its own box: the Search tab has neither.
    expect(screen.queryByRole('button', { name: 'Send a paper' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Contract library' })).toBeNull()
  })

  it('Send a paper and Contract library sit beside the find box, and the library opens in place', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findByTestId('documents-agreements-empty')
    const row = screen.getByLabelText('Find an agreement').parentElement
    expect(row?.contains(screen.getByRole('button', { name: 'Send a paper' }))).toBe(true)
    expect(screen.queryByTestId('contract-library')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Contract library' }))
    expect((await screen.findByTestId('contract-library')).textContent).toContain('open')
    fireEvent.click(screen.getByRole('button', { name: 'fake close' }))
    await waitFor(() => expect(screen.queryByTestId('contract-library')).toBeNull())
  })
})

describe('DocumentsAgreementsTab · the presses on a phone', () => {
  const off = { job_id: null, job_name: null, job_hcp_number: null, job_click_number: null, job_address: null }
  /** A signed contract (its name a press, its job a link), a waiting partner paper (its name a link, two acts), and a supply house's paper a dev can take back. */
  const rows = () => [
    row({}),
    row({ id: 'partner_agreement:d2', kind: 'partner_agreement', source_id: 'd2', state: 'waiting', paper_name: 'Referral partner agreement', with_name: 'Bryce Tolland', ...off, facts: { status: 'sent' } }),
    row({ id: 'supply_house_agreement:p1', kind: 'supply_house_agreement', source_id: 'p1', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Tallgrass Supply Co.', ...off, facts: { status: 'sent', party_kind: 'supply_house', signer_name: 'Lena Park' } }),
  ]
  /** Every press the tab draws itself: Send a paper is its own file's, and is faked here. */
  const presses = () => {
    const tab = screen.getByRole('region', { name: 'Agreements' })
    const buttons = Array.from(tab.querySelectorAll('button')).filter((b) => b.textContent !== 'Send a paper')
    return [...buttons, screen.getByRole('link', { name: 'Referral partner agreement' }), screen.getByLabelText('Find an agreement')]
  }

  it('stands every press 44 px tall at a phone width: a name, an act, a chip, the find box, Contract library and Show more', async () => {
    stubPhoneWidth(true)
    io.role = 'dev'
    io.more = true
    io.rows = rows()
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    const all = presses()
    expect(all.map((el) => el.textContent || el.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['Contract library', 'All', 'Sent and signed', 'Residential plumbing contract', 'Referral partner agreement', 'Send again', 'Copy the signing link', 'Take back', 'Show more', 'Find an agreement']),
    )
    for (const el of all) expect(`${el.textContent || el.getAttribute('aria-label')}: ${el.style.minHeight}`).toMatch(/: 44px$/)
    // A name's words sit in the middle of the press, as a button's and as a link's.
    expect(screen.getByRole('button', { name: 'Residential plumbing contract' }).style.display).toBe('inline-flex')
    expect(screen.getByRole('link', { name: 'Referral partner agreement' }).style.display).toBe('inline-flex')
    // A job's name inside the sentence stays the height of its words: growing it is a layout call (v2.8430's fragment).
    expect(screen.getByRole('link', { name: /^J2418/ }).style.minHeight).toBe('')
  })

  it('adds no floor at a desk width: the look there is as it was', async () => {
    stubPhoneWidth(false)
    io.role = 'dev'
    io.more = true
    io.rows = rows()
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    for (const el of presses()) expect(`${el.textContent || el.getAttribute('aria-label')}: ${el.style.minHeight}`).toMatch(/: $/)
    expect(screen.getByRole('button', { name: 'Residential plumbing contract' }).style.display).toBe('')
    expect(screen.getByRole('link', { name: 'Referral partner agreement' }).style.display).toBe('inline')
  })
})
