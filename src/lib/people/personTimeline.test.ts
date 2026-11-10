import { describe, expect, it } from 'vitest'
import {
  buildPersonTimeline,
  contractRecordDoor,
  contractSignedHow,
  countPersonTimeline,
  filterPersonTimeline,
  groupPersonTimelineByMonth,
  monthLabelOf,
  personFileFactChips,
  personFileFacts,
  personTimelineEmptyWords,
  signedPapers,
  splitPersonTimeline,
  statementDoor,
  statementRows,
  ymdShift,
  type PersonTimelineInput,
} from './personTimeline'

const TODAY = '2026-11-02'

function input(over: Partial<PersonTimelineInput> = {}): PersonTimelineInput {
  return {
    todayYmd: TODAY,
    person: { id: 'p1', name: 'Pat Doe', start_date: '2026-02-01', end_date: null, archived_at: null },
    entries: [],
    attachments: [],
    evidence: [],
    reports: [],
    contracts: [],
    licenses: [],
    writeups: [],
    ncns: [],
    excuses: [],
    namesById: { u1: 'Malachi', u2: 'Grace' },
    ...over,
  }
}

describe('buildPersonTimeline · one line per thing on record, on the day it is about', () => {
  it('an HR entry sits on its entry_date with its source as the lane, the writer named', () => {
    const lines = buildPersonTimeline(
      input({
        entries: [
          { id: 'e1', entry_date: '2026-08-06', content: 'Talked about the truck.', source: 'conversation', created_by: 'u1', created_at: '2026-08-24T13:59:56Z', author_label: null },
          { id: 'e2', entry_date: '2026-07-28', content: 'Left the site early.', source: 'incident', created_by: null, created_at: '2026-08-24T15:08:02Z', author_label: 'HR agent' },
        ],
        attachments: [{ id: 'a1', entry_id: 'e2' }, { id: 'a2', entry_id: null }],
      }),
    )
    const e1 = lines.find((l) => l.key === 'entry:e1')!
    expect(e1.lane).toBe('said')
    expect(e1.ymd).toBe('2026-08-06')
    expect(e1.kindWords).toBe('conversation')
    expect(e1.byName).toBe('Malachi')
    const e2 = lines.find((l) => l.key === 'entry:e2')!
    expect(e2.lane).toBe('did')
    expect(e2.byName).toBe('HR agent')
    expect(e2.attachmentIds).toEqual(['a1'])
  })

  it('a pending field report waits to be filed; a filed one is left to its entry; a dismissed one keeps its reason', () => {
    const lines = buildPersonTimeline(
      input({
        reports: [
          { id: 'r1', status: 'pending', occurred_date: '2026-10-12', created_at: '2026-10-13T12:33:23Z', author_name: 'Malachi', content: 'Late again.', resolution_note: null, resolved_at: null, filed_entry_id: null },
          { id: 'r2', status: 'filed', occurred_date: '2026-08-24', created_at: '2026-08-24T21:38:23Z', author_name: 'Malachi', content: 'Broke a jack.', resolution_note: null, resolved_at: '2026-08-25T00:00:00Z', filed_entry_id: 'e9' },
          { id: 'r3', status: 'dismissed', occurred_date: '2026-09-01', created_at: '2026-09-01T21:38:23Z', author_name: 'Malachi', content: 'Nothing much.', resolution_note: 'Not about this person.', resolved_at: '2026-09-02T00:00:00Z', filed_entry_id: null },
        ],
      }),
    )
    const keys = lines.map((l) => l.key)
    expect(keys).toContain('report:r1')
    expect(keys).not.toContain('report:r2')
    const r1 = lines.find((l) => l.key === 'report:r1')!
    expect(r1.state).toBe('unreviewed')
    expect(r1.kindWords).toBe('field report · waiting to be filed')
    const r3 = lines.find((l) => l.key === 'report:r3')!
    expect(r3.state).toBe('dismissed')
    expect(r3.notes).toBe('Dismissed: Not about this person.')
  })

  it('a contract reads signed, sent and waiting, or owed; the signer is named, the sent day kept', () => {
    const lines = buildPersonTimeline(
      input({
        contracts: [
          { id: 'c1', document_name: 'Subcontractor Handbook', status: 'signed', created_at: '2026-04-21T05:49:09Z', sent_at: '2026-04-21T19:07:29Z', signed_at: '2026-04-21', office_completed_at: null, signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'agreement' },
          { id: 'c2', document_name: 'Form I-9', status: 'sent', created_at: '2026-04-21T05:35:25Z', sent_at: '2026-06-17T11:30:20Z', signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'agreement' },
          { id: 'c3', document_name: 'W-9', status: 'unsent', created_at: '2026-08-05T06:39:45Z', sent_at: null, signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'w9' },
        ],
      }),
    )
    const c1 = lines.find((l) => l.key === 'contract:c1:signed')!
    expect(c1.lane).toBe('paper')
    expect(c1.ymd).toBe('2026-04-21')
    expect(c1.byName).toBe('Pat Doe')
    expect(c1.notes).toBe('Signed electronically. Sent 2026-04-21.')
    // v2.6820: a signed paper's door opens its own record, not the tab; the unsigned ones keep the tab.
    expect(c1.door).toEqual({ label: 'Open the signed record', to: '/people?tab=contracts&doc=c1' })
    expect(lines.find((l) => l.key === 'contract:c2:sent')!.state).toBe('waiting')
    expect(lines.find((l) => l.key === 'contract:c2:sent')!.door).toEqual({ label: 'Contracts', to: '/people?tab=contracts' })
    expect(lines.find((l) => l.key === 'contract:c3:owed')!.kindWords).toBe('owed · not sent yet')
  })

  it('a signed line says how it was signed and when the office recorded it after the day it was signed (v2.6820)', () => {
    const base = { status: 'signed', sent_at: null, office_completed_at: null, expires_at: null, doc_type: 'agreement' }
    const lines = buildPersonTimeline(
      input({
        contracts: [
          // Signed in April, keyed in in August: the e-sign consent's clock says electronically; the record's day is named.
          { ...base, id: 'k1', document_name: 'Subcontractor agreement', created_at: '2026-08-05T08:32:04Z', signed_at: '2026-04-02', signer_printed_name: 'pat doe', signer_consented_at: '2026-04-02T15:53:00Z', signer_signature_storage_path: null, form_scan_storage_path: null, form_source: null },
          // A scan keyed in from paper.
          { ...base, id: 'k2', document_name: 'Form I-9', created_at: '2026-09-05T02:32:33Z', signed_at: '2026-09-04', signer_printed_name: 'Pat Doe', signer_consented_at: null, signer_signature_storage_path: null, form_scan_storage_path: 'scans/k2.pdf', form_source: 'paper' },
          // Marked signed by the office with nothing from a signing.
          { ...base, id: 'k3', document_name: 'W-9', created_at: '2026-03-01T10:00:00Z', signed_at: '2026-03-01', signer_printed_name: null, signer_consented_at: null, signer_signature_storage_path: null, form_scan_storage_path: null, form_source: null },
          // An hours statement signed through the app reads as one.
          { ...base, id: 'k4', document_name: 'Hours statement HS-629-0001', created_at: '2026-11-03T04:21:00Z', signed_at: '2026-11-04', signer_printed_name: 'Pat Doe', signer_consented_at: '2026-11-04T16:00:00Z', doc_type: 'hours_statement' },
        ],
      }),
    )
    const k1 = lines.find((l) => l.key === 'contract:k1:signed')!
    expect(k1.notes).toBe('Signed electronically. Recorded 2026-08-05.')
    expect(k1.byName).toBe('pat doe')
    expect(lines.find((l) => l.key === 'contract:k2:signed')!.notes).toBe('Signed on paper; the scan is the record.')
    expect(lines.find((l) => l.key === 'contract:k3:signed')!.notes).toBe('Recorded by the office as signed; no copy from the signing.')
    expect(lines.find((l) => l.key === 'contract:k3:signed')!.byName).toBe('Pat Doe')
    expect(lines.find((l) => l.key === 'contract:k4:signed')!.kindWords).toBe('hours statement · signed')
    expect(contractSignedHow({ sent_at: '2026-04-21T19:07:29Z' })).toBe('electronically')
    expect(contractSignedHow({ sent_at: null })).toBe('recorded by the office')
    expect(contractRecordDoor('a b').to).toBe('/people?tab=contracts&doc=a%20b')
  })

  it('a two-party form adds the office section as its own line on the day the office finished', () => {
    const lines = buildPersonTimeline(
      input({
        contracts: [
          { id: 'c4', document_name: 'Form I-9', status: 'signed', created_at: '2026-09-05T02:32:33Z', sent_at: '2026-09-05T02:32:58Z', signed_at: '2026-09-04', office_completed_at: '2026-09-05T02:48:34Z', signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'agreement' },
        ],
      }),
    )
    const office = lines.find((l) => l.key === 'contract:c4:office')!
    expect(office.kindWords).toBe('office section completed')
    expect(office.ymd).toBe('2026-09-04') // 02:48 UTC on the 5th is the evening of the 4th in Central
    expect(office.byName).toBe('the office')
  })

  it('a license is on file the day it was added and expires or has expired on its own day', () => {
    const lines = buildPersonTimeline(
      input({
        licenses: [
          { id: 'l1', license_type: 'Master Plumber #123', date_of_expiry: '2026-07-31', created_at: '2026-03-24T17:55:55Z', note: null },
          { id: 'l2', license_type: 'Journeyman #456', date_of_expiry: '2027-02-28', created_at: '2026-03-24T18:28:55Z', note: 'renews by mail' },
        ],
      }),
    )
    const gone = lines.find((l) => l.key === 'license:l1:expiry')!
    expect(gone.lane).toBe('missed')
    expect(gone.state).toBe('expired')
    expect(gone.kindWords).toBe('license expired')
    const ahead = lines.find((l) => l.key === 'license:l2:expiry')!
    expect(ahead.lane).toBe('planned')
    expect(ahead.state).toBe('ahead')
    expect(lines.find((l) => l.key === 'license:l2:filed')!.notes).toBe('renews by mail')
  })

  it('a write-up names its template and its disclosure; a draft reads as a draft', () => {
    const lines = buildPersonTimeline(
      input({
        writeups: [
          { id: 'w1', template_name: 'Insubordination', status: 'submitted', disclosure: 'discussed_with_subject', submitted_at: '2026-07-22T22:29:16Z', created_at: '2026-07-22T22:00:00Z', filled_by_user_id: 'u1' },
          { id: 'w2', template_name: 'Insubordination', status: 'submitted', disclosure: 'withheld_from_subject', submitted_at: '2026-07-13T15:59:52Z', created_at: '2026-07-13T15:00:00Z', filled_by_user_id: 'u2' },
          { id: 'w3', template_name: 'Tardiness', status: 'draft', disclosure: null, submitted_at: null, created_at: '2026-10-01T15:00:00Z', filled_by_user_id: 'u1' },
        ],
      }),
    )
    expect(lines.find((l) => l.key === 'writeup:w1')!.kindWords).toBe('write-up · discussed with them')
    expect(lines.find((l) => l.key === 'writeup:w1')!.byName).toBe('Malachi')
    expect(lines.find((l) => l.key === 'writeup:w2')!.kindWords).toBe('write-up · kept from them')
    const draft = lines.find((l) => l.key === 'writeup:w3')!
    expect(draft.state).toBe('draft')
    expect(draft.kindWords).toBe('write-up · draft')
  })

  it('a no-show is missed on its work date; an excused late is said on its work date', () => {
    const lines = buildPersonTimeline(
      input({
        ncns: [{ id: 'n1', work_date: '2026-10-20', created_at: '2026-10-20T15:00:00Z', created_by_user_id: 'u1', details: null }],
        excuses: [{ id: 'x1', work_date: '2026-10-22', note: 'Dentist, told the office 7:40.', created_at: '2026-10-22T15:00:00Z', author_name: 'Grace' }],
      }),
    )
    const n = lines.find((l) => l.key === 'ncns:n1')!
    expect(n.lane).toBe('missed')
    expect(n.what).toBe('Did not come in and did not call.')
    expect(n.byName).toBe('Malachi')
    const x = lines.find((l) => l.key === 'excuse:x1')!
    expect(x.lane).toBe('said')
    expect(x.kindWords).toBe('late · excused')
    expect(x.byName).toBe('Grace')
  })

  it('evidence of its own stands on the day it is about with its memo and files; evidence on an entry rides that entry', () => {
    const lines = buildPersonTimeline(
      input({
        entries: [{ id: 'e1', entry_date: '2026-08-05', content: 'Returned to the property.', source: 'incident', created_by: null, created_at: '2026-08-24T15:08:02Z', author_label: 'HR agent' }],
        attachments: [{ id: 'f2', entry_id: 'e1' }],
        evidence: [
          { id: 'v1', entry_id: null, dated_on: '2026-10-29', title: 'Mess left at the site', memo: 'Two photos from the GC the morning after.', created_at: '2026-10-29T16:00:00Z', created_by: 'u1', author_label: null, drive_folder_url: 'https://drive.google.com/drive/folders/abc', fileIds: ['f1'] },
          { id: 'v2', entry_id: 'e1', dated_on: '2026-08-05', title: 'Gas can photo', memo: 'x', created_at: '2026-08-24T16:00:00Z', created_by: null, author_label: 'HR agent', drive_folder_url: null, fileIds: ['f2'] },
        ],
      }),
    )
    const v1 = lines.find((l) => l.key === 'evidence:v1')!
    expect(v1.lane).toBe('paper')
    expect(v1.kindWords).toBe('evidence')
    expect(v1.notes).toBe('Two photos from the GC the morning after.')
    expect(v1.byName).toBe('Malachi')
    expect(v1.door).toEqual({ label: 'Open in Drive', to: 'https://drive.google.com/drive/folders/abc' })
    expect(v1.attachmentIds).toEqual(['f1'])
    expect(lines.find((l) => l.key === 'evidence:v2')).toBeUndefined()
    expect(lines.find((l) => l.key === 'entry:e1')!.attachmentIds).toEqual(['f2'])
    expect(countPersonTimeline(lines).bySource.evidence).toBe(1)
  })

  it('employment: the start day, then the last day or the day the roster row was archived', () => {
    const started = buildPersonTimeline(input())
    expect(started.find((l) => l.key === 'employment:p1:start')!.kindWords).toBe('started')
    const ended = buildPersonTimeline(input({ person: { id: 'p1', name: 'Pat Doe', start_date: '2026-02-01', end_date: '2026-10-15', archived_at: '2026-10-16T12:00:00Z' } }))
    expect(ended.find((l) => l.key === 'employment:p1:end')!.ymd).toBe('2026-10-15')
    expect(ended.find((l) => l.key === 'employment:p1:archived')).toBeUndefined()
    const archived = buildPersonTimeline(input({ person: { id: 'p1', name: 'Pat Doe', start_date: null, end_date: null, archived_at: '2026-10-16T12:00:00Z' } }))
    expect(archived.find((l) => l.key === 'employment:p1:archived')!.ymd).toBe('2026-10-16')
    const ahead = buildPersonTimeline(input({ person: { id: 'p1', name: 'Pat Doe', start_date: '2026-12-01', end_date: null, archived_at: null } }))
    expect(ahead.find((l) => l.key === 'employment:p1:start')!.lane).toBe('planned')
  })

  it('newest day first; the same day falls to the newest written; nothing without a day', () => {
    const lines = buildPersonTimeline(
      input({
        person: null,
        entries: [
          { id: 'e1', entry_date: '2026-10-01', content: 'a', source: 'conversation', created_by: null, created_at: '2026-10-01T10:00:00Z', author_label: null },
          { id: 'e2', entry_date: '2026-10-01', content: 'b', source: 'conversation', created_by: null, created_at: '2026-10-01T12:00:00Z', author_label: null },
          { id: 'e3', entry_date: 'unknown', content: 'c', source: 'conversation', created_by: null, created_at: '2026-10-01T12:00:00Z', author_label: null },
        ],
        ncns: [{ id: 'n1', work_date: '2026-10-20', created_at: '2026-10-20T15:00:00Z', created_by_user_id: null, details: null }],
      }),
    )
    expect(lines.map((l) => l.key)).toEqual(['ncns:n1', 'entry:e2', 'entry:e1'])
  })
})

describe('splitPersonTimeline · groupPersonTimelineByMonth · filterPersonTimeline', () => {
  const lines = buildPersonTimeline(
    input({
      licenses: [{ id: 'l2', license_type: 'Journeyman', date_of_expiry: '2027-02-28', created_at: '2026-03-24T18:28:55Z', note: null }],
      ncns: [{ id: 'n1', work_date: '2026-10-20', created_at: '2026-10-20T15:00:00Z', created_by_user_id: null, details: null }],
    }),
  )
  it('what is ahead of today sits apart, soonest first; the record stays newest first', () => {
    const { ahead, past } = splitPersonTimeline(lines, TODAY)
    expect(ahead.map((l) => l.key)).toEqual(['license:l2:expiry'])
    expect(past.map((l) => l.key)).toEqual(['ncns:n1', 'license:l2:filed', 'employment:p1:start'])
  })
  it('months group in the order given with the month spelled out', () => {
    const { past } = splitPersonTimeline(lines, TODAY)
    expect(groupPersonTimelineByMonth(past).map((m) => [m.label, m.lines.length])).toEqual([
      ['October 2026', 1],
      ['March 2026', 1],
      ['February 2026', 1],
    ])
    expect(monthLabelOf('2026-11-02')).toBe('November 2026')
  })
  it('a source or a lane filter narrows the line', () => {
    expect(filterPersonTimeline(lines, { source: 'license' }).map((l) => l.key)).toEqual(['license:l2:expiry', 'license:l2:filed'])
    expect(filterPersonTimeline(lines, { lane: 'missed' }).map((l) => l.key)).toEqual(['ncns:n1'])
    expect(filterPersonTimeline(lines, {})).toHaveLength(4)
  })
  it('counts by source and lane', () => {
    const c = countPersonTimeline(lines)
    expect(c.total).toBe(4)
    expect(c.bySource.license).toBe(2)
    expect(c.byLane.planned).toBe(1)
    expect(c.byLane.missed).toBe(1)
  })
})

describe('personFileFacts · the strip says only what is there', () => {
  it('counts papers by state, licenses by whether they lapsed, no-shows in ninety days, and the newest day on record', () => {
    const inp = input({
      entries: [{ id: 'e1', entry_date: '2026-08-06', content: 'x', source: 'conversation', created_by: null, created_at: '2026-08-24T13:59:56Z', author_label: null }],
      reports: [{ id: 'r1', status: 'pending', occurred_date: '2026-10-12', created_at: '2026-10-13T12:33:23Z', author_name: 'M', content: 'x', resolution_note: null, resolved_at: null, filed_entry_id: null }],
      contracts: [
        { id: 'c1', document_name: 'A', status: 'signed', created_at: '2026-04-21T05:49:09Z', sent_at: null, signed_at: '2026-04-21', office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'agreement' },
        { id: 'c2', document_name: 'B', status: 'sent', created_at: '2026-04-21T05:35:25Z', sent_at: '2026-06-17T11:30:20Z', signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'agreement' },
        { id: 'c3', document_name: 'C', status: 'unsent', created_at: '2026-08-05T06:39:45Z', sent_at: null, signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'w9' },
      ],
      licenses: [
        { id: 'l1', license_type: 'A', date_of_expiry: '2026-07-31', created_at: '2026-03-24T17:55:55Z', note: null },
        { id: 'l2', license_type: 'B', date_of_expiry: '2027-02-28', created_at: '2026-03-24T18:28:55Z', note: null },
      ],
      writeups: [{ id: 'w1', template_name: 'T', status: 'submitted', disclosure: null, submitted_at: '2026-07-22T22:29:16Z', created_at: '2026-07-22T22:00:00Z', filled_by_user_id: null }],
      ncns: [
        { id: 'n1', work_date: '2026-10-20', created_at: '2026-10-20T15:00:00Z', created_by_user_id: null, details: null },
        { id: 'n2', work_date: '2026-05-20', created_at: '2026-05-20T15:00:00Z', created_by_user_id: null, details: null },
      ],
    })
    const facts = personFileFacts(inp, buildPersonTimeline(inp))
    expect(facts).toEqual({
      entries: 1,
      evidence: 0,
      reportsPending: 1,
      papersSigned: 1,
      papersWaiting: 1,
      papersOwed: 1,
      statementsOpen: 0,
      licensesLive: 1,
      licensesExpired: 1,
      writeups: 1,
      ncns90: 1,
      lastYmd: '2026-10-20',
    })
    expect(personFileFactChips(facts).map((c) => c.label)).toEqual([
      '1 report waiting to be filed',
      '1 license expired',
      '1 paper owed',
      '1 sent, waiting',
      '1 no-show in 90 days',
      '1 paper signed',
      '1 license on file',
      '1 write-up',
      '1 HR entry',
    ])
  })
  it('each chip names the Timeline filter it narrows to (v2.6820): the paper chips open the papers, a license chip the licenses', () => {
    const facts = personFileFacts(
      input({
        contracts: [
          { id: 'c1', document_name: 'A', status: 'signed', created_at: '2026-04-21T05:49:09Z', sent_at: null, signed_at: '2026-04-21', office_completed_at: null, signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'agreement' },
          { id: 'c3', document_name: 'B', status: 'unsent', created_at: '2026-08-05T06:39:45Z', sent_at: null, signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'w9' },
        ],
        licenses: [{ id: 'l1', license_type: 'Journeyman', date_of_expiry: '2027-01-15', created_at: '2026-03-01T10:00:00Z', note: null }],
      }),
      [],
    )
    const chips = personFileFactChips(facts)
    expect(chips.map((c) => [c.key, c.filter])).toEqual([
      ['owed', { lane: 'paper', source: 'contract' }],
      ['signed', { lane: 'paper', source: 'contract' }],
      ['licenses', { source: 'license' }],
    ])
  })

  it('an empty file has no chips and no last day', () => {
    const inp = input({ person: null })
    const facts = personFileFacts(inp, buildPersonTimeline(inp))
    expect(facts.lastYmd).toBeNull()
    expect(personFileFactChips(facts)).toEqual([])
  })
  it('ymdShift moves on the calendar, across a month end and a year end', () => {
    expect(ymdShift('2026-11-02', -90)).toBe('2026-08-04')
    expect(ymdShift('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('hours statements on the line (v2.6820)', () => {
  const stmt = (over: Record<string, unknown>) => ({ id: 's1', record_id: 'HS-629-0001', job_ledger_id: 'j629', job_label: 'Job 629 · Rough-in', state: 'printed', basis: 'paid', period_start: '2026-03-31', period_end: '2026-06-30', prepared_at: '2026-11-03T04:21:00Z', updated_at: '2026-11-03T04:21:00Z', contract_document_id: null, drive_file_id: null, matter_document_id: null, ...over })

  it('a printed statement reads not signed back on the day it was prepared, names the job, the period and the basis, and opens the job', () => {
    const lines = buildPersonTimeline(input({ statements: [stmt({})] }))
    const l = lines.find((x) => x.key === 'statement:s1')!
    expect(l.lane).toBe('paper')
    expect(l.source).toBe('statement')
    expect(l.ymd).toBe('2026-11-02') // 04:21 UTC on the 3rd is the evening of the 2nd in Central
    expect(l.kindWords).toBe('hours statement · printed, not signed back')
    expect(l.what).toBe('Hours statement HS-629-0001')
    expect(l.notes).toBe("Job 629 · Rough-in · 2026-03-31 to 2026-06-30 · hours paid. The sheet is on the job's Documents tab.")
    expect(l.state).toBe('owed')
    expect(l.byName).toBe('the office')
    expect(l.door).toEqual({ label: 'Open the job', to: '/jobs?tab=stages&edit=j629' })
  })

  it('a signed statement carries the signed day and the signed record\'s door, and its copy draws no second line; a draft, a sent one and one in Drive read their own way', () => {
    const copy = { id: 'c9', document_name: 'Hours statement HS-629-0002', status: 'signed', created_at: '2026-11-04T10:00:00Z', sent_at: '2026-11-04T10:00:00Z', signed_at: '2026-11-05', office_completed_at: null, signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'hours_statement', signer_consented_at: '2026-11-05T16:00:00Z' }
    const lines = buildPersonTimeline(
      input({
        contracts: [copy],
        statements: [
          stmt({ id: 's2', record_id: 'HS-629-0002', state: 'signed', contract_document_id: 'c9', prepared_at: '2026-11-04T10:00:00Z', matter_document_id: 'm1' }),
          stmt({ id: 's3', record_id: 'HS-629-0003', state: 'draft', prepared_at: '2026-11-06T10:00:00Z' }),
          stmt({ id: 's4', record_id: 'HS-629-0004', state: 'sent', prepared_at: '2026-11-07T10:00:00Z', basis: 'charged' }),
          stmt({ id: 's5', record_id: 'HS-629-0005', state: 'printed', prepared_at: '2026-11-08T10:00:00Z', drive_file_id: 'd1' }),
        ],
      }),
    )
    expect(lines.find((x) => x.key === 'contract:c9:signed')).toBeUndefined()
    const s2 = lines.find((x) => x.key === 'statement:s2')!
    expect(s2.kindWords).toBe('hours statement · signed back')
    expect(s2.notes).toBe("Job 629 · Rough-in · 2026-03-31 to 2026-06-30 · hours paid. Signed 2026-11-05. On a matter's Evidence tab.")
    expect(s2.byName).toBe('Pat Doe')
    expect(s2.state).toBe('live')
    expect(s2.door).toEqual({ label: 'Open the signed record', to: '/people?tab=contracts&doc=c9' })
    expect(lines.find((x) => x.key === 'statement:s3')!.kindWords).toBe('hours statement · draft')
    expect(lines.find((x) => x.key === 'statement:s3')!.state).toBe('draft')
    const s4 = lines.find((x) => x.key === 'statement:s4')!
    expect(s4.kindWords).toBe('hours statement · sent for signature · waiting')
    expect(s4.notes).toContain('hours charged')
    expect(s4.state).toBe('waiting')
    const s5 = lines.find((x) => x.key === 'statement:s5')!
    expect(s5.door).toEqual({ label: 'Open in Drive', to: 'https://drive.google.com/file/d/d1/view' })
    expect(s5.notes).toBe("Job 629 · Rough-in · 2026-03-31 to 2026-06-30 · hours paid. In the job's Drive folder.")
    // The signed copy still draws when the statements were held (an older caller, a refused read).
    expect(buildPersonTimeline(input({ contracts: [copy] })).find((x) => x.key === 'contract:c9:signed')!.kindWords).toBe('hours statement · signed')
    expect(countPersonTimeline(lines).bySource.statement).toBe(4)
  })

  it('the strip counts the statements not signed back, and the list names each standing with its door', () => {
    const inp = input({ statements: [stmt({}), stmt({ id: 's3', record_id: 'HS-629-0003', state: 'draft', prepared_at: '2026-11-06T10:00:00Z' }), stmt({ id: 's4', record_id: 'HS-629-0004', state: 'sent', prepared_at: '2026-11-07T10:00:00Z' })] })
    const facts = personFileFacts(inp, buildPersonTimeline(inp))
    expect(facts.statementsOpen).toBe(2)
    expect(personFileFactChips(facts).find((c) => c.key === 'statements')).toEqual({ key: 'statements', label: '2 hours statements not signed back', tone: 'amber', filter: { source: 'statement' } })
    const rows = statementRows(inp)
    expect(rows.map((r) => [r.record_id, r.standing, r.standing_words, r.prepared_on, r.door.label])).toEqual([
      ['HS-629-0004', 'sent', 'sent for signature · waiting', '2026-11-07', 'Open the job'],
      ['HS-629-0003', 'draft', 'draft', '2026-11-06', 'Open the job'],
      ['HS-629-0001', 'printed', 'printed, not signed back', '2026-11-02', 'Open the job'],
    ])
    expect(rows[2]).toMatchObject({ job: 'Job 629 · Rough-in', period: { from: '2026-03-31', to: '2026-06-30' }, basis: 'paid', signed_on: null, signed_copy_id: null, in_drive: false, on_matter: false })
    expect(statementDoor({ job_ledger_id: 'j', contract_document_id: 'c', drive_file_id: 'd', state: 'printed' }).label).toBe('Open in Drive')
    expect(statementDoor({ job_ledger_id: 'j', contract_document_id: 'c', drive_file_id: 'd', state: 'signed' }).label).toBe('Open the signed record')
  })
})

describe('signedPapers · what they signed, as a list', () => {
  it('one entry per signed paper, newest first, with the day, who signed, how, the sent and recorded days and the door; unsigned papers are left out', () => {
    const list = signedPapers(
      input({
        contracts: [
          { id: 'c1', document_name: 'Subcontractor Handbook', status: 'signed', created_at: '2026-04-21T05:49:09Z', sent_at: '2026-04-21T19:07:29Z', signed_at: '2026-04-21', office_completed_at: '2026-04-22T15:00:00Z', signer_printed_name: 'Pat Doe', expires_at: '2027-04-21', doc_type: 'agreement' },
          { id: 'k1', document_name: 'Subcontractor agreement', status: 'signed', created_at: '2026-08-05T08:32:04Z', sent_at: null, signed_at: '2026-04-02', office_completed_at: null, signer_printed_name: '', expires_at: null, doc_type: 'agreement', signer_consented_at: '2026-04-02T15:53:00Z' },
          { id: 'c3', document_name: 'W-9', status: 'unsent', created_at: '2026-08-05T06:39:45Z', sent_at: null, signed_at: null, office_completed_at: null, signer_printed_name: null, expires_at: null, doc_type: 'w9' },
        ],
      }),
    )
    expect(list).toEqual([
      { id: 'c1', paper: 'Subcontractor Handbook', doc_type: 'agreement', signed_on: '2026-04-21', signed_as: 'Pat Doe', how: 'electronically', sent_on: '2026-04-21', recorded_on: null, office_completed_on: '2026-04-22', expires_on: '2027-04-21', door: { label: 'Open the signed record', to: '/people?tab=contracts&doc=c1' } },
      { id: 'k1', paper: 'Subcontractor agreement', doc_type: 'agreement', signed_on: '2026-04-02', signed_as: 'Pat Doe', how: 'electronically', sent_on: null, recorded_on: '2026-08-05', office_completed_on: null, expires_on: null, door: { label: 'Open the signed record', to: '/people?tab=contracts&doc=k1' } },
    ])
    expect(signedPapers(input())).toEqual([])
  })
})

describe('personTimelineEmptyWords', () => {
  const noop = () => {}
  it('a filter that hides every line offers All; a reader who cannot add reads the fact; the dev is offered the composer', () => {
    expect(personTimelineEmptyWords({ filtered: true, canAdd: true, clearFilter: noop, openComposer: noop }).next?.label).toBe('All ›')
    expect(personTimelineEmptyWords({ filtered: false, canAdd: false, clearFilter: noop, openComposer: noop })).toEqual({ main: 'Nothing on record yet.' })
    expect(personTimelineEmptyWords({ filtered: false, canAdd: true, clearFilter: noop, openComposer: noop }).next?.label).toBe('Add an entry')
  })
})
