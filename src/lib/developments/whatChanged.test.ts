import { describe, expect, it } from 'vitest'
import type { MemberBid, MemberJob, MemberRequest } from './overview'
import { buildWhatChanged, filterChangeLines, placeSinceLine, searchWords, splitForHighlight, type ChangeInputs, type ChangeLine } from './whatChanged'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const STAGES: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to Bill', billed: 'Billed Awaiting Payment', paid: 'Paid' }

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return { bid_number: null, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null, ...over }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return { hcp_number: null, click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over }
}
function request(over: Partial<MemberRequest> & { id: string }): MemberRequest {
  return { lane: 'estimators', title: 'Which plans?', status: 'open', priority: null, created_at: '2026-10-26T12:00:00Z', closed_at: null, closed_note: null, from_user_id: 'u-dana', bid_id: null, job_ledger_id: null, development_id: null, reference_summary: null, notes: [], ...over }
}
function inputs(over: Partial<ChangeInputs> = {}): ChangeInputs {
  return {
    members: { bids: [], jobs: [] },
    requests: [], submissionEntries: [], bidChanges: [], statusEvents: [], invoices: [], payments: [], threadNotes: [], bidNotes: [], entryLines: [], customerContacts: [],
    customerNames: new Map([['c-ridgeway', 'Ridgeway Builders']]),
    names: new Map([['u-dana', 'Dana'], ['u-mel', 'Mel'], ['u-luis', 'Luis']]),
    bidLabel: (b) => `BP${b.bid_number ?? '?'}`,
    jobLabel: (j) => `JP${j.hcp_number ?? '?'}`,
    stageLabel: (s) => STAGES[(s ?? '').toLowerCase()] ?? '—',
    money: (n) => `$${n.toLocaleString('en-US')}`,
    shortDay: (iso) => iso.slice(0, 10),
    siteName: 'Harlow Ranch',
    nowMs: NOW,
    ...over,
  }
}
const bp401 = bid({ id: 'b401', bid_number: '401', project_name: 'Phase 2 water', created_at: '2026-10-01T09:00:00Z', estimator_id: 'u-dana', bid_date_sent: '2026-10-20', bid_value: 139650, design_drawing_plan_date: '2026-10-18' })
const jp1102 = job({ id: 'j1102', hcp_number: '1102', job_name: 'Lot 7', created_at: '2026-10-05T09:00:00Z', revenue: 12000 })
const byId = (lines: ChangeLine[], id: string) => lines.find((l) => l.id === id)

describe('buildWhatChanged — the feed off the records, newest first', () => {
  it('is empty with nothing to read', () => {
    expect(buildWhatChanged(inputs())).toEqual([])
  })

  it("a bid's birth, its send (a day, by its estimator) and its outcome", () => {
    const won = bid({ id: 'b402', bid_number: '402', project_name: 'Clubhouse', outcome: 'won', outcome_at: '2026-10-25T15:00:00Z', agreed_value: 61000 })
    const lost = bid({ id: 'b403', bid_number: '403', outcome: 'lost', outcome_at: '2026-10-26T15:00:00Z' })
    const noOutcome = bid({ id: 'b404', bid_number: '404', outcome_at: '2026-10-27T15:00:00Z' })
    const lines = buildWhatChanged(inputs({ members: { bids: [bp401, won, lost, noOutcome], jobs: [] } }))
    expect(byId(lines, 'newbid:b401')).toMatchObject({ kind: 'new_bid', verb: 'New bid', at: '2026-10-01T09:00:00Z', about: { kind: 'bid', id: 'b401', label: 'BP401 Phase 2 water' }, detail: null, by: null })
    expect(byId(lines, 'sent:b401')).toMatchObject({ kind: 'sent', verb: 'Sent', at: '2026-10-20T12:00:00.000Z', detail: '$139,650', by: 'Dana', dayOnly: true })
    expect(byId(lines, 'outcome:b402')).toMatchObject({ kind: 'won', verb: 'Won', detail: '$61,000', about: { label: 'BP402 Clubhouse' } })
    expect(byId(lines, 'outcome:b403')).toMatchObject({ kind: 'lost', verb: 'Lost', detail: null, about: { label: 'BP403' } })
    expect(byId(lines, 'outcome:b404')).toBeUndefined()
    expect(byId(lines, 'newbid:b404')).toBeUndefined()
  })

  it('contacts on a bid lead with the method and the words', () => {
    const lines = buildWhatChanged(inputs({ members: { bids: [bp401], jobs: [] }, submissionEntries: [
      { id: 'e1', bid_id: 'b401', occurred_at: '2026-10-21T10:00:00Z', contact_method: 'call', notes: '  Left word with Mel  ', created_by: 'u-luis' },
      { id: 'e2', bid_id: 'b401', occurred_at: '2026-10-22T10:00:00Z', contact_method: null, notes: '', created_by: null },
      { id: 'e3', bid_id: 'b-gone', occurred_at: '2026-10-23T10:00:00Z', contact_method: 'email', notes: 'dropped', created_by: null },
    ] }))
    expect(byId(lines, 'entry:e1')).toMatchObject({ kind: 'contact', verb: 'Contact · call', detail: 'Left word with Mel', by: 'Luis' })
    expect(byId(lines, 'entry:e2')).toMatchObject({ verb: 'Contact', detail: null, by: null })
    expect(byId(lines, 'entry:e3')).toBeUndefined()
  })

  it('plan filings are numbered per bid oldest first, say which set they replace, and the last carries the plan date', () => {
    const bp405 = bid({ id: 'b405', bid_number: '405' })
    const lines = buildWhatChanged(inputs({ members: { bids: [bp401, bp405], jobs: [] }, bidChanges: [
      { id: 7, bid_id: 'b401', changed_at: '2026-10-20T08:00:00Z', changed: ['design_drawing_plan_date'], changed_by: 'u-mel' },
      { id: 5, bid_id: 'b401', changed_at: '2026-10-02T08:00:00Z', changed: ['plans_link', 'bid_value'], changed_by: 'u-dana' },
      { id: 6, bid_id: 'b405', changed_at: '2026-10-10T08:00:00Z', changed: ['plans_link'], changed_by: null },
      { id: 8, bid_id: 'b401', changed_at: '2026-10-21T08:00:00Z', changed: ['bid_value'], changed_by: null },
      { id: 9, bid_id: 'b-gone', changed_at: '2026-10-22T08:00:00Z', changed: ['plans_link'], changed_by: null },
    ] }))
    expect(lines.filter((l) => l.kind === 'plans').map((l) => l.id)).toEqual(['plans:7', 'plans:6', 'plans:5'])
    expect(byId(lines, 'plans:5')).toMatchObject({ verb: 'New plans', detail: 'set 1', by: 'Dana' })
    expect(byId(lines, 'plans:7')).toMatchObject({ verb: 'Plans again', detail: 'set 2 · replaces set 1 of 2026-10-02 · dated 2026-10-18', by: 'Mel' })
    expect(byId(lines, 'plans:6')).toMatchObject({ verb: 'New plans', detail: 'set 1', by: null })
  })

  it("a job's birth, its stage moves, its bills and its payments", () => {
    const lines = buildWhatChanged(inputs({
      members: { bids: [], jobs: [jp1102] },
      statusEvents: [
        { id: 's1', job_id: 'j1102', changed_at: '2026-10-06T09:00:00Z', from_status: 'waiting', to_status: 'working', changed_by_user_id: 'u-mel' },
        { id: 's2', job_id: 'j1102', changed_at: '2026-10-15T09:00:00Z', from_status: null, to_status: 'Billed', changed_by_user_id: null },
        { id: 's3', job_id: 'j1102', changed_at: '2026-10-28T09:00:00Z', from_status: 'billed', to_status: 'paid', changed_by_user_id: null },
        { id: 's4', job_id: 'j-gone', changed_at: '2026-10-28T09:00:00Z', from_status: null, to_status: 'working', changed_by_user_id: null },
      ],
      invoices: [
        { id: 'i1', job_id: 'j1102', amount: 12000, status: 'sent', billed_at: '2026-10-15T09:00:00Z', sent_to_customer_at: '2026-10-16T09:00:00Z', created_at: null },
        { id: 'i2', job_id: 'j1102', amount: 1, status: 'draft', billed_at: null, sent_to_customer_at: null, created_at: '2026-10-17T09:00:00Z' },
      ],
      payments: [
        { id: 'p1', job_id: 'j1102', amount: 5000, paid_on: '2026-10-27', created_at: '2026-10-28T09:00:00Z' },
        { id: 'p2', job_id: 'j1102', amount: 7000, paid_on: null, created_at: '2026-10-28T10:00:00Z' },
      ],
    }))
    expect(byId(lines, 'newjob:j1102')).toMatchObject({ kind: 'new_job', verb: 'New job', detail: '$12,000', about: { kind: 'job', id: 'j1102', label: 'JP1102 Lot 7' } })
    expect(byId(lines, 'stage:s1')).toMatchObject({ kind: 'stage', verb: 'Working', detail: 'moved from Waiting', by: 'Mel' })
    expect(byId(lines, 'stage:s2')).toMatchObject({ kind: 'billed', verb: 'Billed Awaiting Payment', detail: null, by: null })
    expect(byId(lines, 'stage:s3')).toMatchObject({ kind: 'paid', verb: 'Paid', detail: 'moved from Billed Awaiting Payment' })
    expect(byId(lines, 'stage:s4')).toBeUndefined()
    expect(byId(lines, 'bill:i1')).toMatchObject({ kind: 'billed', verb: 'Billed', at: '2026-10-16T09:00:00Z', detail: '$12,000' })
    expect(byId(lines, 'bill:i2')).toBeUndefined()
    expect(byId(lines, 'pay:p1')).toMatchObject({ kind: 'paid', verb: 'Paid', at: '2026-10-27T12:00:00.000Z', detail: '$5,000', dayOnly: true })
    expect(byId(lines, 'pay:p2')).toMatchObject({ at: '2026-10-28T10:00:00Z', detail: '$7,000', dayOnly: false })
  })

  it("notes on jobs and bids, the customers' contact log (a day each) and the entries handed in", () => {
    const entry: ChangeLine = { id: 'history:h1', at: '2026-10-24T14:30:00Z', kind: 'entry', verb: 'Email', about: { kind: 'site', id: null, label: 'Harlow Ranch' }, detail: 'GC asked for a start date', by: 'Dana', waitingDays: null, source: 'email', via: 'app', withTime: true }
    const lines = buildWhatChanged(inputs({
      members: { bids: [bp401], jobs: [jp1102] },
      threadNotes: [{ id: 'n1', job_id: 'j1102', created_at: '2026-10-07T09:00:00Z', author_user_id: 'u-mel', body: ' Meter set ' }, { id: 'n2', job_id: 'j1102', created_at: '2026-10-08T09:00:00Z', author_user_id: 'u-mel', body: '   ' }],
      bidNotes: [{ id: 'bn1', estimate_id: 'b401', created_at: '2026-10-03T09:00:00Z', author_user_id: 'u-luis', body: 'Priced the lift' }, { id: 'bn2', estimate_id: 'b-gone', created_at: '2026-10-03T09:00:00Z', author_user_id: 'u-luis', body: 'x' }],
      customerContacts: [
        { id: 'c1', customer_id: 'c-ridgeway', contact_date: '2026-10-09', contact_method: 'call', details: 'Asked about the gate', created_by: 'u-dana' },
        { id: 'c2', customer_id: 'c-other', contact_date: '2026-10-10T15:00:00Z', contact_method: null, details: null, created_by: null },
      ],
      entryLines: [entry],
    }))
    expect(byId(lines, 'note:n1')).toMatchObject({ kind: 'note', verb: 'Note', detail: 'Meter set', by: 'Mel', about: { kind: 'job', id: 'j1102' } })
    expect(byId(lines, 'note:n2')).toMatchObject({ detail: null })
    expect(byId(lines, 'bidnote:bn1')).toMatchObject({ kind: 'note', verb: 'Note', detail: 'Priced the lift', by: 'Luis', about: { kind: 'bid', id: 'b401' } })
    expect(byId(lines, 'bidnote:bn2')).toBeUndefined()
    expect(byId(lines, 'contact:c1')).toMatchObject({ kind: 'note', verb: 'Customer contact · call', at: '2026-10-09T12:00:00.000Z', dayOnly: true, detail: 'Asked about the gate', by: 'Dana', about: { kind: 'customer', id: 'c-ridgeway', label: 'Ridgeway Builders' } })
    expect(byId(lines, 'contact:c2')).toMatchObject({ verb: 'Customer contact', at: '2026-10-10T15:00:00Z', dayOnly: false, detail: null, about: { label: 'the customer' } })
    expect(byId(lines, 'history:h1')).toBe(entry)
  })

  it('a question is asked about its bid, its job or the site, ages while open, and its answers and close follow', () => {
    const open = request({ id: 'r1', bid_id: 'b401', created_at: '2026-10-26T06:00:00Z', notes: [{ id: 'a1', author_user_id: 'u-mel', body: ' The second set ', created_at: '2026-10-27T06:00:00Z' }] })
    const closed = request({ id: 'r2', lane: 'dispatch', job_ledger_id: 'j1102', title: 'Crew for Friday', from_user_id: 'u-ghost', created_at: '2026-10-20T06:00:00Z', closed_at: '2026-10-21T06:00:00Z', closed_note: ' Sent Luis ' })
    const site = request({ id: 'r3', title: 'Gate code', created_at: '2026-10-29T06:00:00Z', closed_at: '2026-10-29T07:00:00Z', closed_note: '  ' })
    const lines = buildWhatChanged(inputs({ members: { bids: [bp401], jobs: [jp1102] }, requests: [open, closed, site] }))
    expect(byId(lines, 'ask:r1')).toMatchObject({ kind: 'asked', verb: 'Asked', detail: 'Which plans?', by: 'Dana, to the estimators', waitingDays: 3, about: { kind: 'bid', id: 'b401' } })
    expect(byId(lines, 'answer:a1')).toMatchObject({ kind: 'answered', verb: 'Answered', detail: 'The second set', by: 'Mel', about: { kind: 'bid', id: 'b401' } })
    expect(byId(lines, 'ask:r2')).toMatchObject({ by: 'someone, to Dispatch', waitingDays: null, about: { kind: 'job', id: 'j1102' } })
    expect(byId(lines, 'closed:r2')).toMatchObject({ kind: 'answered', verb: 'Closed', detail: 'Sent Luis', by: null, at: '2026-10-21T06:00:00Z' })
    expect(byId(lines, 'ask:r3')).toMatchObject({ about: { kind: 'site', id: null, label: 'Harlow Ranch' } })
    expect(byId(lines, 'closed:r3')).toBeUndefined()
  })

  it('reads newest first across every kind', () => {
    const lines = buildWhatChanged(inputs({
      members: { bids: [bp401], jobs: [jp1102] },
      threadNotes: [{ id: 'n1', job_id: 'j1102', created_at: '2026-10-28T09:00:00Z', author_user_id: 'u-mel', body: 'Meter set' }],
      requests: [request({ id: 'r1', created_at: '2026-10-10T06:00:00Z' })],
    }))
    expect(lines.map((l) => l.id)).toEqual(['note:n1', 'sent:b401', 'ask:r1', 'newjob:j1102', 'newbid:b401'])
  })
})

const feed: ChangeLine[] = [
  { id: 'a', at: '2026-10-28T09:00:00Z', kind: 'note', verb: 'Note', about: { kind: 'job', id: 'j1', label: 'JP1102 Lot 7' }, detail: 'Gas line set', by: 'Mel', waitingDays: null },
  { id: 'b', at: '2026-10-27T09:00:00Z', kind: 'sent', verb: 'Sent', about: { kind: 'bid', id: 'b1', label: 'BP401 Phase 2 water' }, detail: '$139,650', by: 'Dana', waitingDays: null },
  { id: 'c', at: '2026-10-26T09:00:00Z', kind: 'asked', verb: 'Asked', about: { kind: 'site', id: null, label: 'Harlow Ranch' }, detail: null, by: null, waitingDays: 3 },
]

describe('placeSinceLine — where You last looked sits', () => {
  it('no stamp: no line, nothing new', () => {
    expect(placeSinceLine(feed, null)).toEqual({ index: null, newCount: 0 })
  })
  it('the index of the first line at or before the stamp is how many are new', () => {
    expect(placeSinceLine(feed, '2026-10-27T12:00:00Z')).toEqual({ index: 1, newCount: 1 })
    expect(placeSinceLine(feed, '2026-10-27T09:00:00Z')).toEqual({ index: 1, newCount: 1 })
    expect(placeSinceLine(feed, '2026-10-29T00:00:00Z')).toEqual({ index: 0, newCount: 0 })
    expect(placeSinceLine(feed, '2026-10-01T00:00:00Z')).toEqual({ index: 3, newCount: 3 })
    expect(placeSinceLine([], '2026-10-01T00:00:00Z')).toEqual({ index: 0, newCount: 0 })
  })
})

describe('filterChangeLines — every word typed must be on the line', () => {
  it('an empty search is every line, as a new array', () => {
    const out = filterChangeLines(feed, '   ')
    expect(out).toEqual(feed)
    expect(out).not.toBe(feed)
  })
  it('matches the record, the verb, the words or the name, whatever the case, and needs every word', () => {
    expect(filterChangeLines(feed, 'mel').map((l) => l.id)).toEqual(['a'])
    expect(filterChangeLines(feed, 'JP1102 gas').map((l) => l.id)).toEqual(['a'])
    expect(filterChangeLines(feed, 'sent 139,650').map((l) => l.id)).toEqual(['b'])
    expect(filterChangeLines(feed, 'harlow asked').map((l) => l.id)).toEqual(['c'])
    expect(filterChangeLines(feed, 'dana lot')).toEqual([])
  })
})

describe('searchWords and splitForHighlight — lighting what was searched', () => {
  it('the words lowercased, once each, longest first', () => {
    expect(searchWords('Gas gas  LINE gas line')).toEqual(['line', 'gas'])
    expect(searchWords('')).toEqual([])
  })
  it('cuts the text into lit and unlit pieces, keeping its own casing', () => {
    expect(splitForHighlight('Gas line set by Mel', ['gas', 'mel'])).toEqual([
      { text: 'Gas', hit: true }, { text: ' line set by ', hit: false }, { text: 'Mel', hit: true },
    ])
    expect(splitForHighlight('gas gas', ['gas'])).toEqual([{ text: 'gas', hit: true }, { text: ' ', hit: false }, { text: 'gas', hit: true }])
    expect(splitForHighlight('Gas line', ['gas line', 'gas'])).toEqual([{ text: 'Gas line', hit: true }])
    expect(splitForHighlight('Gas line', ['line', 'gas'])).toEqual([{ text: 'Gas', hit: true }, { text: ' ', hit: false }, { text: 'line', hit: true }])
  })
  it('no words or no text: one unlit piece', () => {
    expect(splitForHighlight('Gas line', [])).toEqual([{ text: 'Gas line', hit: false }])
    expect(splitForHighlight('', ['gas'])).toEqual([{ text: '', hit: false }])
    expect(splitForHighlight('Gas line', ['water', ''])).toEqual([{ text: 'Gas line', hit: false }])
  })
})
