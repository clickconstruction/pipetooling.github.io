import { describe, expect, it } from 'vitest'
import { type SentCopy, SENT_KIND_GROUPS, canReadSentCopies, parseSentCopy, sentCopyDoor, sentCopyFileName, sentCopyFrameHtml, sentCopyLines, sentCopyPath, sentCopyWords, sentDocumentInsert, sentKindGroup, sentKindGroupFilter, sentSearchFilter } from './sentCopies'

const ID = '11111111-2222-4333-8444-555555555555'
const JOB_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const JOB_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const row = (over: Partial<SentCopy> = {}): SentCopy => ({
  id: 'r1',
  kind: 'owner_records_packet',
  title: 'Records for 9703 Lenox Hill',
  how: 'print',
  recipientName: 'Umar Khan',
  recipientEmails: [],
  subject: '',
  sourceTable: '',
  sourceId: null,
  copyPath: 'r1/copy.html',
  copyType: 'text/html',
  copyHash: 'h1',
  attachments: [],
  sentAt: '2026-10-05T20:30:00Z',
  sentByName: 'Robert',
  sourceSnapshot: null,
  ...over,
})

describe('sentDocumentInsert', () => {
  it('writes what went, to whom and where the office finds it', () => {
    const out = sentDocumentInsert(
      ID,
      { kind: 'owner_records_packet', title: '  Records for 9703 Lenox Hill ', how: 'hand', recipientName: ' Umar Khan ', jobIds: [JOB_A, JOB_B, JOB_A, null, 'not-an-id'], customerId: JOB_B, source: { table: 'lien_owner_record_requests', id: JOB_A } },
      { path: `${ID}/copy.html`, type: 'text/html', hash: 'abc', bytes: 1200 },
    )
    expect(out).toMatchObject({
      id: ID,
      kind: 'owner_records_packet',
      title: 'Records for 9703 Lenox Hill',
      how: 'hand',
      recipient_name: 'Umar Khan',
      job_ids: [JOB_A, JOB_B],
      customer_id: JOB_B,
      bid_id: null,
      source_table: 'lien_owner_record_requests',
      source_id: JOB_A,
      copy_path: `${ID}/copy.html`,
      copy_hash: 'abc',
      copy_bytes: 1200,
    })
  })

  it('still writes the row when the copy could not be kept, and names no source without an id', () => {
    const out = sentDocumentInsert(ID, { kind: 'bill', title: 'Bill 2', how: 'email', recipientEmails: [' ap@gc.example ', 'ap@gc.example', ''], source: { table: 'jobs_ledger_invoices', id: null } }, null)
    expect(out).toMatchObject({ copy_path: null, copy_type: '', copy_hash: '', copy_bytes: null, recipient_emails: ['ap@gc.example'], source_table: '', source_id: null })
  })

  it('refuses a kind the table would refuse', () => {
    expect(sentDocumentInsert(ID, { kind: 'Owner Packet', title: 'x', how: 'print' }, null)).toBeNull()
    expect(sentDocumentInsert(ID, { kind: 'bill', title: 'x', how: 'fax' as never }, null)).toBeNull()
  })
})

describe('where a copy lives', () => {
  it('keeps a page as copy.html and a file under its own safe name', () => {
    expect(sentCopyPath(ID, { html: '<p>x</p>' })).toBe(`${ID}/copy.html`)
    expect(sentCopyPath(ID, { blob: new Blob(['x']), fileName: '../Bill 2 (final).pdf', contentType: 'application/pdf' })).toBe(`${ID}/Bill-2-final-.pdf`)
    expect(sentCopyFileName('///')).toBe('copy')
  })
})

describe('parseSentCopy', () => {
  it('reads a stored row and drops attachments with no path', () => {
    const out = parseSentCopy({ id: 'r1', kind: 'bill', title: '', how: 'email', recipient_emails: ['ap@gc.example'], copy_path: 'r1/copy.html', copy_type: 'text/html', attachments: [{ name: 'Bill 2.pdf', path: 'r1/Bill-2.pdf', type: 'application/pdf' }, { name: 'lost' }, null], sent_at: '2026-10-05T20:30:00Z', sent_by_name: ' Robert ' })
    expect(out).toMatchObject({ title: 'Untitled', how: 'email', recipientEmails: ['ap@gc.example'], sentByName: 'Robert' })
    expect(out?.attachments).toEqual([{ name: 'Bill 2.pdf', path: 'r1/Bill-2.pdf', type: 'application/pdf' }])
  })

  it('answers null for a row it cannot read', () => {
    expect(parseSentCopy(null)).toBeNull()
    expect(parseSentCopy({ id: 'r1', how: 'fax' })).toBeNull()
    expect(parseSentCopy({ how: 'print' })).toBeNull()
  })
})

describe('sentCopyLines', () => {
  it('folds the same copy sent the same way to the same person into one line, newest first', () => {
    const lines = sentCopyLines([
      row({ id: 'r1', sentAt: '2026-10-05T20:30:00Z' }),
      row({ id: 'r3', sentAt: '2026-10-05T20:34:00Z' }),
      row({ id: 'r2', sentAt: '2026-10-05T20:31:00Z' }),
      row({ id: 'r4', sentAt: '2026-10-06T15:00:00Z', kind: 'bill', title: 'Bill 2', copyHash: 'h2' }),
    ])
    expect(lines.map((l) => [l.row.id, l.times.length])).toEqual([
      ['r4', 1],
      ['r3', 3],
    ])
    expect(lines[1]!.times).toEqual(['2026-10-05T20:34:00Z', '2026-10-05T20:31:00Z', '2026-10-05T20:30:00Z'])
  })

  it('keeps apart another way, another person, another copy, and any row whose copy was not kept', () => {
    const lines = sentCopyLines([
      row({ id: 'a' }),
      row({ id: 'b', how: 'hand' }),
      row({ id: 'c', recipientName: 'Someone Else' }),
      row({ id: 'd', copyHash: 'h9' }),
      row({ id: 'e', copyHash: '', copyPath: null }),
      row({ id: 'f', copyHash: '', copyPath: null }),
    ])
    expect(lines).toHaveLength(6)
  })
})

describe('sentCopyWords', () => {
  const when = (iso: string) => `at ${iso.slice(0, 10)}`
  it('says how, when, to whom and by whom', () => {
    expect(sentCopyWords({ row: row(), times: ['2026-10-05T20:30:00Z'] }, when)).toBe('Printed at 2026-10-05 · to Umar Khan · by Robert')
  })
  it('counts a copy that went more than once, and falls back to the addresses', () => {
    const r = row({ how: 'email', recipientName: '', recipientEmails: ['ap@gc.example', 'pm@gc.example'], sentByName: '' })
    expect(sentCopyWords({ row: r, times: ['x', 'y'] }, when)).toBe('Emailed 2 times, last at 2026-10-05 · to ap@gc.example, pm@gc.example')
  })
})

describe('how a copy opens', () => {
  it('draws a page, links a file, and offers nothing when the copy was not kept', () => {
    expect(sentCopyDoor({ copyPath: 'r1/copy.html', copyType: 'text/html' })).toBe('page')
    expect(sentCopyDoor({ copyPath: 'r1/Bill-2.pdf', copyType: 'application/pdf' })).toBe('file')
    expect(sentCopyDoor({ copyPath: null, copyType: '' })).toBe('none')
  })

  it('shows a kept page in a frame that runs no script', () => {
    const html = sentCopyFrameHtml('<p onclick="x()">Hi "there"</p><script>alert(1)</script>', 'Copy as it went out · Records <b>')
    expect(html).toContain('sandbox="allow-same-origin allow-modals"')
    expect(html).not.toContain('allow-scripts')
    // The copy rides in an attribute, escaped: none of its markup is part of the outer page.
    expect(html).toContain('srcdoc="&lt;p onclick=&quot;x()&quot;&gt;Hi &quot;there&quot;&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
    expect(html).toContain('<title>Copy as it went out · Records &lt;b&gt;</title>')
  })
})

describe('canReadSentCopies', () => {
  it('is the office', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].every(canReadSentCopies)).toBe(true)
    expect(['primary', 'estimator', 'superintendent', 'subcontractor', null, undefined].some(canReadSentCopies)).toBe(false)
  })
})

describe('the Documents page groups', () => {
  it('sorts a kind by what the paper is about', () => {
    expect(['bill', 'bill_resent', 'bill_copy', 'bill_pay_code'].map(sentKindGroup)).toEqual(['bills', 'bills', 'bills', 'bills'])
    expect(['lien_notice', 'lien_release', 'demand_letter', 'owner_records_packet', 'legal_packet', 'hazmat_notice'].every((k) => sentKindGroup(k) === 'lien')).toBe(true)
    expect(['job_contract', 'job_contract_reminder', 'person_contract', 'estimate', 'work_order', 'sub_labor_sheet'].every((k) => sentKindGroup(k) === 'contracts')).toBe(true)
    expect(['bid_cover_letter', 'bid_room_link', 'rfq', 'submittal_reply', 'procurement_update', 'purchase_order', 'supply_house_job_account'].every((k) => sentKindGroup(k) === 'bids')).toBe(true)
    expect(['gc_statement', 'gc_statement_print', 'gc_checks_applied', 'test_report', 'field_report'].every((k) => sentKindGroup(k) === 'statements')).toBe(true)
    expect(sentKindGroup('something_new')).toBe('other')
    expect(SENT_KIND_GROUPS.map((g) => g.key)).toEqual(['all', 'bills', 'lien', 'contracts', 'bids', 'statements', 'other'])
  })

  it('turns a group into a filter over kind', () => {
    expect(sentKindGroupFilter('all')).toBeNull()
    expect(sentKindGroupFilter('bills')).toEqual({ or: 'kind.like.bill*' })
    expect(sentKindGroupFilter('statements')?.or).toBe('kind.like.gc_statement*,kind.like.gc_checks*,kind.like.test_report*,kind.like.field_report*')
    const other = sentKindGroupFilter('other')
    expect(other?.or).toBeUndefined()
    expect(other?.notLike).toContain('bill*')
    expect(other?.notLike).toContain('lien_*')
  })

  it('searches the title, who it went to and the subject, and drops anything a filter could read as syntax', () => {
    expect(sentSearchFilter('Lenox')).toBe('title.ilike.*Lenox*,recipient_name.ilike.*Lenox*,subject.ilike.*Lenox*')
    expect(sentSearchFilter('  9703, Lenox (Hill)*%  ')).toBe('title.ilike.*9703 Lenox Hill*,recipient_name.ilike.*9703 Lenox Hill*,subject.ilike.*9703 Lenox Hill*')
    expect(sentSearchFilter('a')).toBeNull()
    expect(sentSearchFilter(',,()')).toBeNull()
  })
})
