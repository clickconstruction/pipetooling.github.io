import { describe, expect, it } from 'vitest'
import {
  applySessionNotesAssignment,
  buildSessionNotesJobIndex,
  buildSessionNotesLines,
  buildSessionNotesServerFilter,
  groupSessionNotesLines,
  sessionNotesAnchorToken,
  sessionNotesBookedTo,
  sessionNotesHours,
  sessionNotesSearchTokens,
  sessionNotesStatus,
  sessionNotesSuggestions,
  sessionNotesWindowStartYmd,
  splitSessionNotesTextByTokens,
  summarizeSessionNotesLines,
  type SessionNotesRow,
} from './sessionNotesSearch'
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { ymdAddDays } from '../../utils/dateUtils'

const prefixMap: LedgerPrefixMap = {}
const OFFICE = 'office-job'
const NOW = new Date('2026-09-03T15:00:00Z').getTime()

const jobs = [
  { id: 'j961', hcp_number: '961', click_number: null, job_name: 'Smith residence', service_type_id: null },
  { id: 'j878', hcp_number: '878', click_number: null, job_name: 'Lyndsey Lane Remodel', service_type_id: null },
  { id: OFFICE, hcp_number: '1', click_number: null, job_name: 'Office', service_type_id: null },
]
const jobIndex = buildSessionNotesJobIndex(jobs)

function row(over: Partial<SessionNotesRow> & { id: string }): SessionNotesRow {
  return {
    user_id: 'u-darren',
    clocked_in_at: '2026-09-02T12:00:00Z',
    clocked_out_at: '2026-09-02T16:42:00Z',
    work_date: '2026-09-02',
    notes: '',
    origin: 'user_punch',
    salary_segment_index: null,
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    rejected_at: null,
    revoked_at: null,
    users: { name: 'Darren M' },
    jobs_ledger: null,
    bids: null,
    ...over,
  }
}

const rows: SessionNotesRow[] = [
  row({ id: 's1', job_ledger_id: OFFICE, notes: 'helped terry on 961 trim, then shop', jobs_ledger: { hcp_number: '1', job_name: 'Office' } }),
  row({
    id: 's2',
    user_id: 'u-terry',
    users: { name: 'Terry K' },
    job_ledger_id: 'j961',
    jobs_ledger: { hcp_number: '961', job_name: 'Smith residence' },
    notes: 'trim set upstairs baths',
    approved_at: '2026-09-03T01:00:00Z',
    clocked_in_at: '2026-09-02T12:05:00Z',
  }),
  row({ id: 's3', notes: 'back to 961 w/ terry', clocked_in_at: '2026-09-02T17:10:00Z', clocked_out_at: '2026-09-02T21:02:00Z' }),
  row({ id: 's4', user_id: 'u-abe', users: { name: 'Abe L' }, bid_id: 'b1', bids: { bid_number: '2041', project_name: 'Cedar Ridge' }, notes: 'site walk', work_date: '2026-08-28', clocked_in_at: '2026-08-28T12:00:00Z', clocked_out_at: '2026-08-28T17:00:00Z' }),
  row({ id: 's5', notes: 'voided', rejected_at: '2026-09-03T00:00:00Z' }),
  row({ id: 's6', user_id: 'u-terry', users: { name: 'Terry K' }, job_ledger_id: 'j961', jobs_ledger: { hcp_number: '961', job_name: 'Smith residence' }, notes: 'top out', work_date: '2026-09-03', clocked_in_at: '2026-09-03T11:52:00Z', clocked_out_at: null }),
]

describe('sessionNotesSearch primitives', () => {
  it('classifies where time is booked, with the office job as its own bucket', () => {
    expect(sessionNotesBookedTo({ job_ledger_id: OFFICE, bid_id: null }, OFFICE)).toBe('office')
    expect(sessionNotesBookedTo({ job_ledger_id: 'j961', bid_id: null }, OFFICE)).toBe('job')
    expect(sessionNotesBookedTo({ job_ledger_id: null, bid_id: 'b1' }, OFFICE)).toBe('bid')
    expect(sessionNotesBookedTo({ job_ledger_id: null, bid_id: null }, OFFICE)).toBe('none')
    // No office job configured → the office job is just a job.
    expect(sessionNotesBookedTo({ job_ledger_id: OFFICE, bid_id: null }, null)).toBe('job')
  })

  it('counts open sessions to now and never goes negative', () => {
    expect(sessionNotesHours({ clocked_in_at: '2026-09-02T12:00:00Z', clocked_out_at: '2026-09-02T16:42:00Z' }, NOW)).toBeCloseTo(4.7, 5)
    expect(sessionNotesHours({ clocked_in_at: '2026-09-03T11:52:00Z', clocked_out_at: null }, NOW)).toBeCloseTo(3.1333, 3)
    expect(sessionNotesHours({ clocked_in_at: '2026-09-02T16:00:00Z', clocked_out_at: '2026-09-02T15:00:00Z' }, NOW)).toBe(0)
  })

  it('reads status from clock-out and approval', () => {
    expect(sessionNotesStatus({ clocked_out_at: null, approved_at: null })).toBe('open')
    expect(sessionNotesStatus({ clocked_out_at: 'x', approved_at: null })).toBe('pending')
    expect(sessionNotesStatus({ clocked_out_at: 'x', approved_at: 'y' })).toBe('approved')
  })

  it('tokenizes and picks the longest token as the server anchor', () => {
    expect(sessionNotesSearchTokens('  Terry  961 terry ')).toEqual(['terry', '961'])
    expect(sessionNotesAnchorToken(['961', 'terry'])).toBe('terry')
    expect(sessionNotesAnchorToken([])).toBeNull()
  })

  it('windows back from today inclusive; 0 means no bound', () => {
    expect(sessionNotesWindowStartYmd('2026-09-03', 7, ymdAddDays)).toBe('2026-08-28')
    expect(sessionNotesWindowStartYmd('2026-09-03', 30, ymdAddDays)).toBe('2026-08-05')
    expect(sessionNotesWindowStartYmd('2026-09-03', 0, ymdAddDays)).toBeNull()
  })
})

describe('sessionNotesSuggestions', () => {
  it('names jobs mentioned in the note that the session is not booked to', () => {
    const s = sessionNotesSuggestions({ notes: 'helped terry on 961 trim, then 878', job_ledger_id: OFFICE }, jobIndex, prefixMap)
    expect(s.map((x) => x.jobId)).toEqual(['j961', 'j878'])
    expect(s[0]?.label).toContain('961')
    expect(s[0]?.label).toContain('Smith residence')
  })

  it('skips the job the session is already on and unknown numbers', () => {
    expect(sessionNotesSuggestions({ notes: '961 trim set', job_ledger_id: 'j961' }, jobIndex, prefixMap)).toEqual([])
    expect(sessionNotesSuggestions({ notes: 'unit 4402 leak', job_ledger_id: null }, jobIndex, prefixMap)).toEqual([])
  })
})

describe('buildSessionNotesLines', () => {
  const base = { rows, officeJobId: OFFICE, jobIndex, prefixMap, nowMs: NOW }

  it('drops rejected rows, sorts newest first, and builds the where label', () => {
    const lines = buildSessionNotesLines({ ...base, query: '', scope: 'all' })
    expect(lines.map((l) => l.id)).toEqual(['s6', 's3', 's2', 's1', 's4'])
    const s2 = lines.find((l) => l.id === 's2')!
    expect(s2.whereLabel).toContain('961 · Smith residence')
    expect(s2.status).toBe('approved')
    const s4 = lines.find((l) => l.id === 's4')!
    expect(s4.bookedTo).toBe('bid')
    expect(s4.whereLabel).toContain('2041 · Cedar Ridge')
    expect(lines.find((l) => l.id === 's1')!.bookedTo).toBe('office')
    expect(lines.find((l) => l.id === 's1')!.whereLabel).toBeNull()
  })

  it('matches every token across person, note, where, and date', () => {
    const terry = buildSessionNotesLines({ ...base, query: 'terry', scope: 'all' })
    expect(terry.map((l) => l.id)).toEqual(['s6', 's3', 's2', 's1'])
    const terryOffice = buildSessionNotesLines({ ...base, query: 'terry shop', scope: 'all' })
    expect(terryOffice.map((l) => l.id)).toEqual(['s1'])
    const byJob = buildSessionNotesLines({ ...base, query: 'smith', scope: 'all' })
    expect(byJob.map((l) => l.id)).toEqual(['s6', 's2'])
    const byDate = buildSessionNotesLines({ ...base, query: '08-28', scope: 'all' })
    expect(byDate.map((l) => l.id)).toEqual(['s4'])
  })

  it('scopes by where time is booked and honours pins', () => {
    expect(buildSessionNotesLines({ ...base, query: '', scope: 'office' }).map((l) => l.id)).toEqual(['s1'])
    expect(buildSessionNotesLines({ ...base, query: '', scope: 'none' }).map((l) => l.id)).toEqual(['s3'])
    expect(buildSessionNotesLines({ ...base, query: '', scope: 'bid' }).map((l) => l.id)).toEqual(['s4'])
    expect(buildSessionNotesLines({ ...base, query: '', scope: 'all', pinnedJobId: 'j961' }).map((l) => l.id)).toEqual(['s6', 's2'])
    expect(buildSessionNotesLines({ ...base, query: '', scope: 'all', pinnedUserId: 'u-darren' }).map((l) => l.id)).toEqual(['s3', 's1'])
  })

  it('carries suggestions only where the note names another job', () => {
    const lines = buildSessionNotesLines({ ...base, query: '', scope: 'all' })
    expect(lines.find((l) => l.id === 's1')!.suggestions.map((s) => s.jobId)).toEqual(['j961'])
    expect(lines.find((l) => l.id === 's3')!.suggestions.map((s) => s.jobId)).toEqual(['j961'])
    expect(lines.find((l) => l.id === 's2')!.suggestions).toEqual([])
  })
})

describe('grouping and summary', () => {
  const lines = buildSessionNotesLines({ rows, officeJobId: OFFICE, jobIndex, prefixMap, nowMs: NOW, query: '', scope: 'all' })

  it('groups by day in newest-first order with raw ymd labels', () => {
    const g = groupSessionNotesLines(lines, 'day')
    expect(g.map((x) => x.label)).toEqual(['2026-09-03', '2026-09-02', '2026-08-28'])
    expect(g[1]!.lines.map((l) => l.id)).toEqual(['s3', 's2', 's1'])
  })

  it('groups by person and job alphabetically; none is one group', () => {
    expect(groupSessionNotesLines(lines, 'person').map((x) => x.label)).toEqual(['Abe L', 'Darren M', 'Terry K'])
    const byJob = groupSessionNotesLines(lines, 'job')
    // Labels carry the ledger prefix ("B2041", "J961") — assert the tails. Jobs/bids
    // alphabetically, then Office, then the unbooked pile.
    expect(byJob.map((x) => x.label.replace(/^[A-Za-z]+(?=\d)/, ''))).toEqual(['2041 · Cedar Ridge', '961 · Smith residence', 'Office', 'Booked to nothing'])
    expect(groupSessionNotesLines(lines, 'none')).toHaveLength(1)
  })

  it('summarizes sessions, people, hours, and suggested lines', () => {
    const s = summarizeSessionNotesLines(lines)
    expect(s.sessions).toBe(5)
    expect(s.people).toBe(3)
    expect(s.suggested).toBe(2)
    expect(s.hours).toBeCloseTo(4.7 + 4.6167 + 3.8667 + 5 + 3.1333, 2)
  })
})

describe('server prefilter', () => {
  it('returns null with no query and otherwise anchors on the longest token', () => {
    expect(buildSessionNotesServerFilter({ query: '   ', users: [], jobs })).toBeNull()
    const f = buildSessionNotesServerFilter({
      query: '961 terry',
      users: [
        { id: 'u-terry', name: 'Terry K' },
        { id: 'u-darren', name: 'Darren M' },
      ],
      jobs,
    })!
    expect(f.anchor).toBe('terry')
    expect(f.userIds).toEqual(['u-terry'])
    expect(f.jobIds).toEqual([])
  })

  it('resolves job numbers and names to job ids', () => {
    expect(buildSessionNotesServerFilter({ query: 'smith', users: [], jobs })!.jobIds).toEqual(['j961'])
    expect(buildSessionNotesServerFilter({ query: '878', users: [], jobs })!.jobIds).toEqual(['j878'])
  })

  it('strips PostgREST punctuation from the anchor sent to the server', () => {
    expect(buildSessionNotesServerFilter({ query: 'a,(b)"c*%\\', users: [], jobs })!.anchor).toBe('abc')
  })
})

describe('highlight + assignment patch', () => {
  it('marks every token occurrence case-insensitively', () => {
    const seg = splitSessionNotesTextByTokens('Helped Terry on 961 trim', ['terry', '961'])
    expect(seg).toEqual([
      { text: 'Helped ', match: false },
      { text: 'Terry', match: true },
      { text: ' on ', match: false },
      { text: '961', match: true },
      { text: ' trim', match: false },
    ])
    expect(splitSessionNotesTextByTokens('plain', [])).toEqual([{ text: 'plain', match: false }])
  })

  it('patches a row for a job, a bid, or a clear', () => {
    const r = rows[0]!
    const asJob = applySessionNotesAssignment(r, { source: 'job', id: 'j961', hcp_number: '961', job_name: 'Smith residence' })
    expect(asJob.job_ledger_id).toBe('j961')
    expect(asJob.jobs_ledger?.job_name).toBe('Smith residence')
    expect(asJob.bid_id).toBeNull()
    const asBid = applySessionNotesAssignment(r, { source: 'bid', id: 'b1', bid_number: '2041', project_name: 'Cedar Ridge' })
    expect(asBid.bid_id).toBe('b1')
    expect(asBid.job_ledger_id).toBeNull()
    const cleared = applySessionNotesAssignment(asBid, null)
    expect(cleared.bid_id).toBeNull()
    expect(cleared.bids).toBeNull()
  })
})
