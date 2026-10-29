import { describe, expect, it } from 'vitest'
import {
  HISTORY_BODY_MAX,
  HISTORY_CHIPS,
  aboutIsPiece,
  draftIsKeepable,
  entryLine,
  historyVerb,
  keepEntry,
  lineIsAbout,
  lineMatchesChip,
  localInputValue,
  narrowLines,
  narrowedWords,
  onRecordNotes,
  type HistoryChip,
  type HistoryEntry,
} from './history'
import type { MemberBid, MemberJob } from './overview'
import type { ChangeAbout, ChangeKind, ChangeLine } from './whatChanged'

const NOW = Date.parse('2026-10-29T12:00:00Z')

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id: 'h1', developmentId: 'harlow', about: { kind: 'site' }, happenedAt: '2026-10-24T14:30:00.000Z', source: 'email', body: 'GC asked for a start date', byUserId: 'u-dana', byName: 'Dana', via: 'app', agentLabel: null, createdAt: '2026-10-24T15:00:00.000Z', ...over }
}
const labels = {
  site: 'Harlow Ranch',
  job: (id: string): ChangeAbout | null => (id === 'j1102' ? { kind: 'job', id, label: 'JP1102 Lot 7' } : null),
  bid: (id: string): ChangeAbout | null => (id === 'b401' ? { kind: 'bid', id, label: 'BP401 Phase 2 water' } : null),
  customer: (id: string) => (id === 'c-ridgeway' ? 'Ridgeway Builders' : null),
}
function line(kind: ChangeKind, about: ChangeAbout, over: Partial<ChangeLine> = {}): ChangeLine {
  return { id: `${kind}:${about.id ?? 'site'}`, at: '2026-10-20T09:00:00Z', kind, verb: kind, about, detail: null, by: null, waitingDays: null, ...over }
}
const onJob: ChangeAbout = { kind: 'job', id: 'j1102', label: 'JP1102 Lot 7' }
const onBid: ChangeAbout = { kind: 'bid', id: 'b401', label: 'BP401 Phase 2 water' }
const onSite: ChangeAbout = { kind: 'site', id: null, label: 'Harlow Ranch' }
const onCustomer: ChangeAbout = { kind: 'customer', id: 'c-ridgeway', label: 'Ridgeway Builders' }

describe('historyVerb — the word a source leads with', () => {
  it('names the source, and a note is Note', () => {
    expect(historyVerb('email')).toBe('Email')
    expect(historyVerb('call')).toBe('Call')
    expect(historyVerb('text')).toBe('Text')
    expect(historyVerb('on_site')).toBe('On site')
    expect(historyVerb('letter')).toBe('Letter')
    expect(historyVerb('note')).toBe('Note')
  })
})

describe('draftIsKeepable — a draft says something, not too much, at a time that has come', () => {
  it('needs words', () => {
    expect(draftIsKeepable({ body: 'Mel called', happenedAt: '2026-10-29T11:00:00Z' }, NOW)).toBe(true)
    expect(draftIsKeepable({ body: '   ', happenedAt: '2026-10-29T11:00:00Z' }, NOW)).toBe(false)
    expect(draftIsKeepable({ body: 'x'.repeat(HISTORY_BODY_MAX), happenedAt: '2026-10-29T11:00:00Z' }, NOW)).toBe(true)
    expect(draftIsKeepable({ body: 'x'.repeat(HISTORY_BODY_MAX + 1), happenedAt: '2026-10-29T11:00:00Z' }, NOW)).toBe(false)
  })
  it('needs a real time, no more than five minutes ahead', () => {
    expect(draftIsKeepable({ body: 'Mel called', happenedAt: 'yesterday-ish' }, NOW)).toBe(false)
    expect(draftIsKeepable({ body: 'Mel called', happenedAt: new Date(NOW + 4 * 60_000).toISOString() }, NOW)).toBe(true)
    expect(draftIsKeepable({ body: 'Mel called', happenedAt: new Date(NOW + 6 * 60_000).toISOString() }, NOW)).toBe(false)
    expect(draftIsKeepable({ body: 'Mel called', happenedAt: '2026-10-01T00:00:00Z' }, NOW)).toBe(true)
  })
})

describe('keepEntry — a kept draft lands at the head, trimmed, as the app', () => {
  it('builds the entry and never touches the list it was given', () => {
    const before = [entry({ id: 'h0' })]
    const out = keepEntry(before, 'harlow', { about: { kind: 'bid', id: 'b401' }, happenedAt: '2026-10-28T09:30', source: 'call', body: '  Mel called about the lift  ' }, { userId: 'u-mel', name: 'Mel' }, NOW)
    expect(out).toHaveLength(2)
    expect(out[1]).toBe(before[0])
    expect(before).toHaveLength(1)
    const kept = out[0]!
    expect(kept.id.startsWith(`h_${NOW.toString(36)}_`)).toBe(true)
    expect(kept).toMatchObject({ developmentId: 'harlow', about: { kind: 'bid', id: 'b401' }, source: 'call', body: 'Mel called about the lift', byUserId: 'u-mel', byName: 'Mel', via: 'app', agentLabel: null, createdAt: '2026-10-29T12:00:00.000Z' })
    expect(kept.happenedAt).toBe(new Date(Date.parse('2026-10-28T09:30')).toISOString())
  })
})

describe('entryLine — the line the stream draws for an entry', () => {
  it('finds the piece by the page’s own labels, or says it is no longer here', () => {
    expect(entryLine(entry({ about: { kind: 'job', id: 'j1102' } }), labels).about).toEqual(onJob)
    expect(entryLine(entry({ about: { kind: 'job', id: 'j-gone' } }), labels).about).toEqual({ kind: 'job', id: 'j-gone', label: 'a job no longer here' })
    expect(entryLine(entry({ about: { kind: 'bid', id: 'b401' } }), labels).about).toEqual(onBid)
    expect(entryLine(entry({ about: { kind: 'bid', id: 'b-gone' } }), labels).about).toEqual({ kind: 'bid', id: 'b-gone', label: 'a bid no longer here' })
    expect(entryLine(entry({ about: { kind: 'customer', id: 'c-ridgeway' } }), labels).about).toEqual(onCustomer)
    expect(entryLine(entry({ about: { kind: 'customer', id: 'c-other' } }), labels).about).toEqual({ kind: 'customer', id: 'c-other', label: 'the customer' })
    expect(entryLine(entry(), labels).about).toEqual(onSite)
  })
  it('the sender leads; a robot that kept it through MCP is the mark, not the author', () => {
    expect(entryLine(entry(), labels)).toMatchObject({ id: 'history:h1', at: '2026-10-24T14:30:00.000Z', kind: 'entry', verb: 'Email', detail: 'GC asked for a start date', by: 'Dana', waitingDays: null, source: 'email', via: 'app', agent: null, withTime: true })
    expect(entryLine(entry({ byUserId: null, byName: null, via: 'mcp', agentLabel: 'the inbox robot', source: 'note' }), labels)).toMatchObject({ verb: 'Note', by: 'the inbox robot', via: 'mcp', agent: 'the inbox robot' })
    expect(entryLine(entry({ via: 'mcp', agentLabel: 'the inbox robot' }), labels)).toMatchObject({ by: 'Dana', agent: 'the inbox robot' })
    expect(entryLine(entry({ byName: null, agentLabel: 'stray' }), labels)).toMatchObject({ by: null, agent: null })
  })
})

describe('lineMatchesChip, aboutIsPiece, narrowLines — the chips that narrow', () => {
  const lines: ChangeLine[] = [
    line('note', onJob, { id: 'n1' }),
    line('entry', onSite, { id: 'e-note', source: 'note' }),
    line('entry', onBid, { id: 'e-call', source: 'call' }),
    line('plans', onBid, { id: 'p1' }),
    line('stage', onJob, { id: 's1' }),
    line('new_job', onJob, { id: 'nj' }),
    line('new_bid', onBid, { id: 'nb' }),
    line('won', onBid, { id: 'w' }),
    line('lost', onBid, { id: 'l' }),
    line('sent', onBid, { id: 'st' }),
    line('contact', onBid, { id: 'c' }),
    line('billed', onJob, { id: 'b' }),
    line('paid', onJob, { id: 'pd' }),
    line('asked', onSite, { id: 'a' }),
    line('answered', onCustomer, { id: 'an' }),
  ]
  const ids = (chip: HistoryChip) => lines.filter((l) => lineMatchesChip(l, chip)).map((l) => l.id)

  it('each chip takes its kinds and no other', () => {
    expect(ids('all')).toHaveLength(lines.length)
    expect(ids('wrote')).toEqual(['n1', 'e-note'])
    expect(ids('happened')).toEqual(['e-call'])
    expect(ids('plans')).toEqual(['p1'])
    expect(ids('stages')).toEqual(['s1', 'nj', 'nb', 'w', 'l', 'st', 'c'])
    expect(ids('money')).toEqual(['b', 'pd'])
    expect(ids('questions')).toEqual(['a', 'an'])
    expect(HISTORY_CHIPS.map((c) => c.key)).toEqual(['all', 'wrote', 'happened', 'plans', 'stages', 'money', 'questions'])
  })
  it('a piece is its job, its bid, or both; no piece is everything', () => {
    const both = { jobId: 'j1102', bidId: 'b401', label: 'JP1102' }
    expect(aboutIsPiece(onJob, null)).toBe(true)
    expect(aboutIsPiece(onJob, both)).toBe(true)
    expect(aboutIsPiece(onBid, both)).toBe(true)
    expect(aboutIsPiece(onSite, both)).toBe(false)
    expect(aboutIsPiece(onCustomer, both)).toBe(false)
    expect(aboutIsPiece(onJob, { jobId: null, bidId: 'b401', label: 'BP401' })).toBe(false)
    expect(aboutIsPiece({ kind: 'job', id: 'j-other', label: 'JP9' }, both)).toBe(false)
    expect(lineIsAbout(line('stage', onJob), both)).toBe(true)
  })
  it('narrows by chip and by piece together, and hands back a copy when nothing narrows', () => {
    const all = narrowLines(lines, 'all', null)
    expect(all).toEqual(lines)
    expect(all).not.toBe(lines)
    expect(narrowLines(lines, 'stages', { jobId: 'j1102', bidId: null, label: 'JP1102' }).map((l) => l.id)).toEqual(['s1', 'nj'])
    expect(narrowLines(lines, 'all', { jobId: null, bidId: 'b401', label: 'BP401' }).map((l) => l.id)).toEqual(['e-call', 'p1', 'nb', 'w', 'l', 'st', 'c'])
    expect(narrowLines(lines, 'money', { jobId: null, bidId: 'b401', label: 'BP401' })).toEqual([])
  })
})

describe('narrowedWords — the card’s meta while narrowed', () => {
  it('counts the lines and names the chip, the piece, or both', () => {
    expect(narrowedWords(12, 118, 'plans', null)).toBe('12 of 118 lines · Plans')
    expect(narrowedWords(5, 118, 'all', { jobId: 'j1', bidId: null, label: 'JP1098' })).toBe('5 of 118 lines · JP1098')
    expect(narrowedWords(2, 118, 'money', { jobId: 'j1', bidId: null, label: 'JP1098' })).toBe('2 of 118 lines · JP1098 · Money')
    expect(narrowedWords(118, 118, 'all', null)).toBe('118 of 118 lines')
    expect(narrowedWords(1, 1, 'questions', null)).toBe('1 of 1 line · Questions')
  })
})

describe('onRecordNotes — the undated notes a record carries', () => {
  const bidBase = { bid_number: null, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null }
  const jobBase = { hcp_number: null, click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null }
  const bids: MemberBid[] = [{ ...bidBase, id: 'b401', bid_number: '401', project_name: 'Phase 2 water', notes: '  Price holds 30 days  ' }, { ...bidBase, id: 'b402', bid_number: '402', notes: '   ' }, { ...bidBase, id: 'b403', bid_number: '403' }]
  const jobs: MemberJob[] = [{ ...jobBase, id: 'j1102', hcp_number: '1102', job_name: 'Lot 7', collections_note: 'Pays on the 10th' }, { ...jobBase, id: 'j1103', hcp_number: '1103', collections_note: null }]
  const customers = [
    { id: 'c-ridgeway', name: 'Ridgeway Builders', payment_terms_note: 'Net 30', lien_notice_policy_note: ' Notice every month ' },
    { id: 'c-quiet', name: 'Quiet Co', payment_terms_note: '', lien_notice_policy_note: null },
  ]
  it('one row per note that says something: the bids, then the jobs, then the customers', () => {
    expect(onRecordNotes({ bids, jobs }, customers, { bidLabel: (b) => `BP${b.bid_number}`, jobLabel: (j) => `JP${j.hcp_number}` })).toEqual([
      { key: 'bid:b401', label: 'On the bid', about: { kind: 'bid', id: 'b401', label: 'BP401 Phase 2 water' }, text: 'Price holds 30 days' },
      { key: 'job:j1102', label: 'Collections', about: { kind: 'job', id: 'j1102', label: 'JP1102 Lot 7' }, text: 'Pays on the 10th' },
      { key: 'terms:c-ridgeway', label: 'Payment terms', about: onCustomer, text: 'Net 30' },
      { key: 'lien:c-ridgeway', label: 'Lien notices', about: onCustomer, text: 'Notice every month' },
    ])
    expect(onRecordNotes({ bids: [], jobs: [] }, [], { bidLabel: () => '', jobLabel: () => '' })).toEqual([])
  })
})

describe('localInputValue — the datetime-local box in the device’s own time', () => {
  it('pads every part', () => {
    expect(localInputValue(new Date(2026, 9, 28, 14, 5).getTime())).toBe('2026-10-28T14:05')
    expect(localInputValue(new Date(2026, 0, 3, 7, 9).getTime())).toBe('2026-01-03T07:09')
  })
})
