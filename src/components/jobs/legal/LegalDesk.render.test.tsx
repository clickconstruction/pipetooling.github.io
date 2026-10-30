// @vitest-environment jsdom
/**
 * Render smokes for the Legal desk (PR 1): the accounts rail groups two
 * Collections jobs for one customer into one account, the worth panel and
 * five tabs render, the gap strip names the contract stop, and the Their
 * word timeline carries the collections note. Wiring-level only — the packet
 * math lives in src/lib/legal/legalPacket.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, cleanup, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import LegalDesk from './LegalDesk'

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function collectionsJob(id: string, hcp: string, amount: number) {
  return makeJob({
    id,
    hcp_number: hcp,
    status: 'billed',
    collections_at: '2026-08-20T15:00:00Z',
    collections_note: id === 'job-a' ? 'Customer is engaging in theft of service.' : null,
    customer_id: 'tle',
    customer_name: 'The Learning Experience',
    customer_email: 'aaron@tle.test',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })],
  })
}

const noop = () => {}
const baseProps = {
  contractCoverage: new Map(),
  users: [],
  companyName: 'Click Plumbing and Electrical',
  onOpenContract: noop,
  onOpenLienInstruments: noop,
  onOpenEditJob: noop,
  onOpenCallMode: noop,
  onOpenAccountsReceivable: noop,
  onOpenSessionNotes: noop,
  onOpenReports: noop,
  onOpenJobThread: noop,
  onOpenPromisedPay: noop,
  onFocusJob: noop,
  onAfterWriteDown: noop,
}

describe('LegalDesk', () => {
  it('groups the payer, renders the worth panel, five tabs, the contract stop and the timeline', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502), collectionsJob('job-b', '718', 1480)]} {...baseProps} />)
    await settle()
    // A page since punch list #182: a named region, not a dialog.
    expect(screen.getByRole('region', { name: /^Legal Desk/ })).toBeTruthy()
    expect(screen.getAllByText('The Learning Experience').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 account · \$8,982\.00/)).toBeTruthy()
    // v2.5851: six tabs; the Record of contact is the Timeline's Said lane and Fees & steps reads With the firm.
    for (const label of ['Narrative', 'Account', 'Paper', 'Evidence', 'With the firm', 'Timeline']) expect(screen.getByRole('tab', { name: label })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Record of contact' })).toBeNull()
    await waitFor(() => expect(screen.getByText(/No signed agreement and no sworn-account basis on 717/)).toBeTruthy())
    expect(screen.getByText(/2 things an attorney will ask for first/)).toBeTruthy()
    // Gap answers (v2.5920): every gap row carries Answer…, and pressing it opens the inline sheet.
    const answerDoors = screen.getAllByRole('button', { name: 'Answer…' })
    expect(answerDoors.length).toBeGreaterThan(0)
    fireEvent.click(answerDoors[0]!)
    await waitFor(() => expect(document.querySelector('[data-legal-gap-answer-sheet]')).toBeTruthy())
    expect(screen.getByLabelText('The answer')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-legal-gap-answer-sheet]')).toBeNull()
    expect(screen.getByText('Can we sue?')).toBeTruthy()
    expect(screen.getByText("What's left for us?")).toBeTruthy()
    // v2.6105 (punch list #214, PR 2): the money as bars under the questions — one segment per open bill (two jobs, a bill each), the keep · firm · filing bar, no claim bar while nothing is offered or added.
    expect(document.querySelectorAll('[data-legal-money-bar="bills"] [data-legal-money-segment="bill"]').length).toBe(2)
    expect(document.querySelector('[data-legal-money-bar="left_claim"] [data-legal-money-segment="keep"]')).toBeTruthy()
    expect(document.querySelector('[data-legal-money-bar="claim"]')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }))
    expect(screen.getByText(/theft of service/)).toBeTruthy()
    expect(document.querySelector('[data-legal-timeline-lane="said"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Said · / }))
    expect(document.querySelector('[data-legal-timeline-lane="paper"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^All · / }))
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    expect(screen.getByText('Where each job stands')).toBeTruthy()
    // v2.6104 (punch list #214): the desk's strip opens on the Windows calendar, under its own remembered scope.
    expect(document.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    // Punch list #175 (v2.5835): the Paper tab reads the supplier books; the stub holds no allocations, so the section says so.
    expect(screen.getByText('Supply houses')).toBeTruthy()
    await waitFor(() => expect(document.querySelector('[data-legal-suppliers="none"]')?.textContent).toMatch(/No supply house sold materials/))
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }))
    expect(screen.getByText('Owner’s mailing address')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'With the firm' }))
    // The fees list is the firm's to fill, so its empty state names who and offers no press (punch list #184, sweep C).
    expect(document.querySelector('[data-legal-fees-empty] [data-empty-state]')!.textContent).toBe('No fees or costs yet. No firm is on this account. When one is, the fees and costs it adds list here and roll into the total demand.')
  })

  it("on Paper, a stop's title opens the window on the stop as evidence — the record, the rule, the Lien window door (v2.4800)", async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} />)
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    // v2.6104: the desk opens on the calendar; the stops' doors are the Steps view's, so switch first.
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }))
    await waitFor(() => expect(document.querySelector('[data-legal-job-timeline] [data-lien-timeline-stop-door]')).toBeTruthy())
    const doors = [...document.querySelectorAll('[data-legal-job-timeline] [data-lien-timeline-stop-door]')] as HTMLButtonElement[]
    const suit = doors.find((d) => d.dataset.lienTimelineStopDoor === 'suit')!
    fireEvent.click(suit)
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('Suit to foreclose the lien')
    // The filing checklist: an original contractor owes no § 53.056 notice, so row A reads not needed; the affidavit is not on file.
    expect(screen.getByTestId('lien-stop-paper-checklist')).toBeTruthy()
    expect(screen.getAllByTestId('lien-stop-paper-check').map((n) => n.getAttribute('data-status')).slice(0, 2)).toEqual(['not_needed', 'not_on_file'])
    expect(screen.getByTestId('lien-stop-paper-rule-words').textContent).toContain('§ 53.158')
    expect(screen.getByTestId('lien-stop-paper-rail-venue').textContent).toContain('district court')
    expect(screen.getByTestId('lien-stop-paper-move').textContent).toBe('COUNSEL')
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open the job’s Lien window ›')
    expect(screen.getByTestId('lien-stop-paper-second-act').textContent).toBe('Copy the record as text')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-stop-paper')).toBeNull()
  })

  it('renders an empty state when nothing is in Collections', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[]} {...baseProps} />)
    await settle()
    // The good state, in the one empty shape (punch list #184, sweep C).
    expect(screen.getByText('Nothing is in Collections.').closest('[data-empty-state]')?.textContent).toBe('Nothing is in Collections.')
  })
})

/**
 * The desk's sheets and its Apply discount window are drawn inside the desk's backdrop, outside
 * its panel. A click there carried on to the desk's backdrop and closed the desk (v2.4352): a
 * click outside a sheet closed both, and Apply discount — no backdrop handler of its own — closed
 * the desk on the first click anywhere in it.
 */
describe('LegalDesk · a window inside the desk (v2.4352)', () => {
  const firm = { id: 'firm-1', name: 'Barnes & Holt', handling_name: 'Dana Holt', email: 'dana@barnes.test', phone: '', contingency_pct: 33, filing_cost: 350, active: true }
  const legal = {
    available: true,
    loading: false,
    firm,
    firms: [firm],
    matters: [],
    byPayerKey: new Map(),
    byJobId: new Map(),
    jobIdsByMatter: new Map(),
    entriesByMatter: new Map(), documentsByMatter: new Map(),
    recipients: [],
    firmPaused: false,
    activeFirms: [firm],
    countiesByFirm: new Map(),
    readState: 'ok' as const,
    reload: async () => {},
  }
  const renderDesk = async (extra: { canMarkReady?: boolean; canEditReview?: boolean }) => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={legal} {...extra} />)
    await settle()
  }
  // The desk is a page since punch list #182: the region stays while a sheet over it closes.
  const desk = () => screen.queryByRole('region', { name: /^Legal Desk/ })

  it('a click outside Ask a dev to review closes the sheet only', async () => {
    await renderDesk({ canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: 'Ask a dev to review…' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Ask a dev to review' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Ask a dev to review' })).toBeNull()
    expect(desk()).toBeTruthy()
  })

  it('a click outside Mark attorney-ready, the firm preview or the firm’s emails closes that one only', async () => {
    await renderDesk({ canMarkReady: true, canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: '⚖ Mark attorney ready…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview what the firm sees ↗' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'What the firm will see' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'What the firm will see' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Firm’s emails ↗' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Who at the firm hears from us' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Who at the firm hears from us' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Mark attorney-ready' })).toBeTruthy()
    fireEvent.click(screen.getByRole('dialog', { name: 'Mark attorney-ready' }).parentElement!)
    expect(screen.queryByRole('dialog', { name: 'Mark attorney-ready' })).toBeNull()
    expect(desk()).toBeTruthy()
  })

  it('Write it down… opens the account panel under the header; a click inside it leaves the desk open; Cancel folds it', async () => {
    await renderDesk({ canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: 'Write it down…' }))
    const heading = screen.getByRole('heading', { name: 'How much will we accept?' })
    fireEvent.click(heading)
    expect(desk()).toBeTruthy()
    // The split names the account's open bill and starts at the full balance: nothing to write down yet.
    expect(screen.getByRole('button', { name: 'Nothing to write down' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'How much will we accept?' })).toBeNull()
    expect(desk()).toBeTruthy()
  })

  it('the firm’s door wears a dot while the firm’s answers to Start here are unread (v2.4821)', async () => {
    const withAnswers = { ...firm, intake: { needs: 'The W-9.' }, intake_sent_at: '2026-10-07T15:00:00Z', intake_sent_by: 'Ann Sample', intake_seen_at: null }
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, firm: withAnswers, firms: [withAnswers] }} canMarkReady canEditReview />)
    await settle()
    const door = screen.getByRole('button', { name: 'The collections law firm: Barnes & Holt, new answers from the firm' })
    expect(door.querySelector('[data-legal-firm-intake-new]')).not.toBeNull()
    cleanup()
    const read = { ...withAnswers, intake_seen_at: '2026-10-07T16:00:00Z' }
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, firm: read, firms: [read] }} canMarkReady canEditReview />)
    await settle()
    expect(screen.getByRole('button', { name: 'The collections law firm: Barnes & Holt' }).querySelector('[data-legal-firm-intake-new]')).toBeNull()
  })

  it('the header (v2.5750): the scales and “Legal Desk”; the firm’s doors in one group — its name, Emails, Portal link — then the ? at the bar’s end, and no ✕ or full screen button on the page (punch list #182)', async () => {
    await renderDesk({ canMarkReady: true, canEditReview: true })
    expect(screen.getByRole('heading', { name: 'Legal Desk' })).toBeTruthy()
    const group = document.querySelector('[data-legal-firm-group]')!
    // v2.5792: the firm's segment carries the county that picked it — here the bridge's words, no county colored yet.
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Barnes & Holt· no counties colored yet', 'Emails', 'Portal link'])
    expect(group.firstElementChild).toBe(screen.getByRole('button', { name: 'The collections law firm: Barnes & Holt' }))
    expect(screen.getByRole('button', { name: 'Firm’s emails' }).dataset.legalFirmEmails).toBe('ok')
    // Punch list #187 PR 4: the ? ends the bar. The page has no ✕ and no full screen button (punch list #182 PR 3).
    const help = screen.getByRole('button', { name: 'What this desk holds' })
    expect(help.nextElementSibling).toBeNull()
    // v2.5792: a dev's Firms… door sits before it, the firm group before that.
    expect(help.previousElementSibling).toBe(screen.getByRole('button', { name: 'Firms…' }))
    expect(help.previousElementSibling?.previousElementSibling).toBe(group)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull()
    cleanup()
    // Emails says so, in words, when emails to the firm are paused or an address bounces.
    const bounced = { id: 'r1', firm_id: 'firm-1', name: 'Dana Holt', email: 'dana@barnes.test', role: 'attorney', mode: 'now', scope: 'all', digest_weekday: 1, digest_time: '08:00', confirmed_at: '2026-09-01T00:00:00Z', paused_at: null, send_failed_since: '2026-10-01T00:00:00Z', send_error: '550' }
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, firmPaused: true, recipients: [bounced] }} canMarkReady canEditReview />)
    await settle()
    const emails = screen.getByRole('button', { name: 'Firm’s emails, paused, 1 not reaching' })
    expect(emails.textContent).toBe('Emails · paused · 1 not reaching')
    expect(emails.dataset.legalFirmEmails).toBe('paused')
  })

  it('the firm’s name in the header opens the firm’s window, and a click outside closes only it (v2.4711)', async () => {
    await renderDesk({ canMarkReady: true, canEditReview: true })
    fireEvent.click(screen.getByRole('button', { name: 'The collections law firm: Barnes & Holt' }))
    const win = screen.getByRole('dialog', { name: 'The collections law firm' })
    expect(win).toBeTruthy()
    fireEvent.click(win.parentElement!)
    expect(screen.queryByRole('dialog', { name: 'The collections law firm' })).toBeNull()
    expect(desk()).toBeTruthy()
  })

  it('with no firm, the header and the release sheet both open the firm’s window (v2.4711)', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, firm: null, firms: [] }} canMarkReady canEditReview />)
    await settle()
    // v2.5792: for a dev the door is Firms… — the Settings block over the desk, where a firm is added and its counties colored.
    expect(screen.getByRole('button', { name: 'Set up the collections law firm' }).textContent).toBe('No firm yet · Firms…')
    // The release waits: no firm at all.
    expect(screen.getByText('No firm is set up yet.')).toBeTruthy()
    expect((screen.getByRole('button', { name: '⚖ Mark attorney ready…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Set up the collections law firm' }))
    expect(screen.getByRole('dialog', { name: 'Collections law firms' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Firms…' })).toBeTruthy()
  })

  it('a given-up account sits under Given up on with a pill in place of Mark attorney ready (punch list #94, v2.4794)', async () => {
    const givenUp = {
      ...makeJob({ id: 'job-g', hcp_number: '008', status: 'billed', collections_at: '2026-03-01T15:00:00Z', customer_id: 'surf', customer_name: 'Surf Thru', revenue: 250, payments_made: 0, invoices: [] }),
      uncollectible_at: '2026-10-07T03:30:00Z',
      uncollectible_reason: 'No response from the customer in 7 months.',
    }
    renderWithProviders(<LegalDesk canMarkReady collectionsJobs={[collectionsJob('job-a', '717', 7502)]} uncollectibleJobs={[givenUp]} {...baseProps} />)
    await settle()
    expect(screen.getByText(/^Given up on · 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Surf Thru/ }))
    await settle()
    expect(screen.getByText('Given up on — not for the firm')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mark attorney ready/ })).toBeNull()
    // The chased account keeps the desk's usual header (the smoke has no legal tables, so that is the read-only note).
    fireEvent.click(screen.getByRole('button', { name: /The Learning Experience/ }))
    await settle()
    expect(screen.queryByText('Given up on — not for the firm')).toBeNull()
    expect(screen.getByText('Read-only until the legal tables are applied.')).toBeTruthy()
  })

  it('a read of the legal tables that failed says so and offers Retry; a missing table keeps the old line (v2.5780)', async () => {
    const reload = vi.fn(async () => {})
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, available: false, readState: 'failed', reload }} canMarkReady canEditReview />)
    await settle()
    expect(screen.getByText(/Could not read the legal tables/)).toBeTruthy()
    expect(screen.queryByText('Read-only until the legal tables are applied.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reload).toHaveBeenCalledTimes(1)
    cleanup()
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...legal, available: false, readState: 'missing', reload }} canMarkReady canEditReview />)
    await settle()
    expect(screen.getByText('Read-only until the legal tables are applied.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('Map beside Accounts in the header shows every case on the county map with the legend and the flag; Accounts brings the rail back (v2.5784, punch list #144 PR 3)', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502), collectionsJob('job-b', '718', 1480)]} {...baseProps} legal={{ ...legal, countiesByFirm: new Map([[firm.id, ['Bexar', 'Comal']]]) }} canMarkReady canEditReview />)
    await settle()
    const group = document.querySelector('[data-legal-view-group]')!
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Accounts', 'Map'])
    expect(screen.getByRole('button', { name: 'Accounts' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await settle()
    expect(document.querySelector('[data-legal-map-view]')).toBeTruthy()
    // The rail and the account give way to the map.
    expect(screen.queryByRole('tab', { name: 'Account' })).toBeNull()
    // The legend: the firm with its counties, then the uncovered row — the smoke's account has no geocode, so it is off the map and uncovered.
    const legendRow = document.querySelector('[data-legal-map-legend-row="firm-1"]')!
    expect(legendRow.textContent).toContain('Barnes & Holt')
    expect(legendRow.textContent).toContain('2 counties · Bexar, Comal')
    expect(legendRow.textContent).toContain('0 cases')
    expect(document.querySelector('[data-legal-map-legend-row="none"]')!.textContent).toContain('1 case')
    expect(document.querySelector('[data-legal-map-flag]')!.textContent).toMatch(/1 case in a county no firm covers · The Learning Experience \(off the map\)/)
    expect(document.querySelector('[data-legal-map-summary]')!.textContent).toBe('1 account · 2 jobs · $8,982.00 open')
    expect(document.querySelector('[data-legal-county-card]')!.textContent).toContain('Tap a county to see the cases in it.')
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }))
    await settle()
    expect(screen.getByRole('tab', { name: 'Account' })).toBeTruthy()
    expect(document.querySelector('[data-legal-map-view]')).toBeNull()
  })
})

/** Punch list #184 sweep B: the firm's entries waiting on the office carry their age beside the press, and the ledger keeps its order. */
describe('LegalDesk · the firm’s entries waiting on the office', () => {
  const firm = { id: 'firm-1', name: 'Sample Law', handling_name: 'Sample Counsel', email: 'counsel@sample-law.test', phone: '', contingency_pct: 33, filing_cost: 350, active: true }
  const base = { available: true, loading: false, firm, firms: [firm], activeFirms: [firm], countiesByFirm: new Map(), byJobId: new Map(), documentsByMatter: new Map(), recipients: [], firmPaused: false, readState: 'ok' as const, reload: async () => {} }
  const matter = { id: 'm-1', payer_key: 'c:tle', customer_id: 'tle', payer_name: 'The Learning Experience', firm_id: 'firm-1', stage: 'demand', handling_name: 'Sample Counsel', note_to_firm: '', released_at: '2026-10-01T15:00:00Z', ready_marked_by: null, ready_marked_at: null, review_requested_by: null, review_requested_at: null, review_request_note: '', held_overrides: {}, closed_at: null, closed_reason: '', settlement_floor_amount: null, settlement_floor_pct: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }
  const entry = (id: string, kind: string, created_at: string, over: Record<string, unknown> = {}) => ({ id, matter_id: 'm-1', kind, amount: null, body: `${kind} ${id}`, occurred_on: created_at.slice(0, 10), meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at, ...over })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a step and a fee waiting on the office wear their age; a seen step wears none', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T17:00:00Z'))
    const entries = [
      entry('s-seen', 'step', '2026-10-10T15:00:00Z', { acknowledged_at: '2026-10-11T15:00:00Z' }),
      entry('s-wait', 'step', '2026-10-23T15:00:00Z'),
      entry('f-wait', 'fee', '2026-10-20T15:00:00Z', { amount: 450 }),
    ]
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...base, matters: [matter], byPayerKey: new Map([['c:tle', matter]]), jobIdsByMatter: new Map([['m-1', ['job-a']]]), entriesByMatter: new Map([['m-1', entries]]) } as never} canEditReview />)
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'With the firm' }))
    const chips = [...document.querySelectorAll('[data-firm-wait]')].map((n) => [n.getAttribute('data-firm-wait'), n.textContent])
    expect(chips).toEqual([
      ['red', '6 days waiting'],
      ['amber', '3 days waiting'],
    ])
    expect(screen.getAllByRole('button', { name: 'Acknowledge' })).toHaveLength(2)
  })
})

/** Punch list #172 (v2.5847): the office runs a case itself — the door, the sheet, and the offers log once in house. */
describe('LegalDesk · in house (v2.5847)', () => {
  const firm = { id: 'firm-1', name: 'Barnes & Holt', handling_name: 'Dana Holt', email: 'dana@barnes.test', phone: '', contingency_pct: 33, filing_cost: 350, active: true }
  const base = { available: true, loading: false, firm, firms: [firm], activeFirms: [firm], countiesByFirm: new Map(), byJobId: new Map(), jobIdsByMatter: new Map(), entriesByMatter: new Map(), documentsByMatter: new Map(), recipients: [], firmPaused: false, readState: 'ok' as const, reload: async () => {} }
  it('offers Run it in house… to the office on a matter under review, with a sheet that asks why', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...base, matters: [], byPayerKey: new Map() }} canEditReview />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Run it in house…' }))
    expect(screen.getByRole('dialog', { name: 'Run it in house' })).toBeTruthy()
    expect(screen.getByLabelText('Why the office runs it')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Run it in house' })).toBeNull()
  })
  it('in house: the pill, Back to review, the offers log on Fees & steps, and Question for counsel…', async () => {
    const matter = { id: 'm-1', payer_key: 'c:tle', customer_id: 'tle', payer_name: 'The Learning Experience', firm_id: null, stage: 'in_house', handling_name: '', note_to_firm: '', released_at: null, ready_marked_by: null, ready_marked_at: null, review_requested_by: null, review_requested_at: null, review_request_note: '', held_overrides: {}, closed_at: null, closed_reason: '', settlement_floor_amount: null, settlement_floor_pct: null, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z', in_house_at: '2026-10-25T15:00:00Z', in_house_why: 'counsel away until Nov 3' }
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} legal={{ ...base, matters: [matter], byPayerKey: new Map([['c:tle', matter]]), jobIdsByMatter: new Map([['m-1', ['job-a']]]) } as never} canEditReview />)
    await settle()
    expect(document.querySelector('[data-legal-in-house]')!.textContent).toContain('In house since 2026-10-25 · counsel away until Nov 3')
    expect(screen.getByRole('button', { name: 'Back to review' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Run it in house…' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'With the firm' }))
    expect(document.querySelector('[data-legal-offers]')).toBeTruthy()
    // No offer yet: the log says so and offers its own door again (punch list #184, sweep C).
    const noOffers = document.querySelector('[data-legal-offers] [data-empty-state]') as HTMLElement
    expect(noOffers.textContent).toBe('No offers yet. Log an offer… adds the first.')
    fireEvent.click(within(noOffers).getByRole('button', { name: 'Log an offer…' }))
    const form = document.querySelector('[data-legal-offer-form]') as HTMLElement
    expect(form).toBeTruthy()
    expect(document.querySelector('[data-legal-offers] [data-empty-state]')!.textContent).toBe('No offers yet.')
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-legal-offer-form]')).toBeNull()
    fireEvent.click(document.querySelector('[data-legal-offer-add]') as HTMLButtonElement)
    const submit = document.querySelector('[data-legal-offer-form] button[type="submit"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Offer amount'), { target: { value: '12,500' } })
    expect(submit.disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Question for counsel…' })).toBeTruthy()
  })
})

describe('the Legal desk’s ? (punch list #187 PR 4)', () => {
  it('opens the card of what each part holds, with the guide as its door', async () => {
    renderWithProviders(<LegalDesk collectionsJobs={[collectionsJob('job-a', '717', 7502)]} {...baseProps} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'What this desk holds' }))
    const card = screen.getByTestId('legend-card-legal-desk')
    expect(card.textContent).toContain('Can we sue?')
    expect(card.textContent).toContain('Three paths')
    expect((screen.getByTestId('legend-card-legal-desk-guide') as HTMLAnchorElement).getAttribute('href')).toBe('/help?g=review-a-collections-account-before-it-goes-to-your-attorney&via=legend')
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('legend-card-legal-desk')).toBeNull()
  })
})
