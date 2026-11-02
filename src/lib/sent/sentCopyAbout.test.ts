import { describe, expect, it } from 'vitest'
import { SENT_GROUP_COLORS, parseSentCopy, sentKindTag, sentKindWords } from './sentCopies'
import { EMPTY_ABOUT, sentCopyAbout, sentCopySubjectLine } from './sentCopyAbout'

const JOB = '11111111-2222-4333-8444-555555555555'
const BID = '66666666-7777-4888-9999-000000000000'

describe('what a sent copy is about', () => {
  it('reads the job ids and the bid off the row, and leaves them off a row read without them', () => {
    const withKeys = parseSentCopy({ id: 's1', how: 'email', job_ids: [JOB], bid_id: BID })
    expect(withKeys?.jobIds).toEqual([JOB])
    expect(withKeys?.bidId).toBe(BID)
    const without = parseSentCopy({ id: 's1', how: 'email' })
    expect('jobIds' in (without ?? {})).toBe(false)
    expect(parseSentCopy({ id: 's1', how: 'email', job_ids: [], bid_id: null })?.bidId).toBeNull()
  })

  it('draws each job as J<number> · <name> and the bid as B<number> · <project>, each a link', () => {
    const maps = {
      jobs: new Map([[JOB, { id: JOB, hcp_number: '1076', click_number: null, job_name: 'Sneegas Post Test' }]]),
      bids: new Map([[BID, { id: BID, bid_number: 244, project_name: 'Emergency Animal Hospital' }]]),
    }
    expect(sentCopyAbout({ jobIds: [JOB], bidId: BID }, maps)).toEqual([
      { kind: 'job', label: 'J1076 · Sneegas Post Test', to: `/jobs?edit=${JOB}` },
      { kind: 'bid', label: 'B244 · Emergency Animal Hospital', to: `/bids?bidId=${BID}` },
    ])
  })

  it('falls back to the id when the label did not read, and draws nothing for a copy that names no job', () => {
    expect(sentCopyAbout({ jobIds: [JOB], bidId: null }, EMPTY_ABOUT)).toEqual([{ kind: 'job', label: 'Job 11111111', to: `/jobs?edit=${JOB}` }])
    expect(sentCopyAbout({ jobIds: [], bidId: null }, EMPTY_ABOUT)).toEqual([])
    expect(sentCopyAbout({}, EMPTY_ABOUT)).toEqual([])
  })

  it('takes a job with a name alone, or a number alone', () => {
    const jobs = new Map([
      ['a', { id: 'a', hcp_number: '', click_number: 'C12', job_name: 'Leak' }],
      ['b', { id: 'b', hcp_number: null, click_number: null, job_name: 'Leak only' }],
    ])
    expect(sentCopyAbout({ jobIds: ['a', 'b'] }, { jobs, bids: new Map() }).map((l) => l.label)).toEqual(['JC12 · Leak', 'Leak only'])
  })

  it('shows the subject only when it says more than the title', () => {
    expect(sentCopySubjectLine({ title: 'Invoice #1076', subject: 'Invoice #1076 from Click Plumbing' })).toBe('Invoice #1076 from Click Plumbing')
    expect(sentCopySubjectLine({ title: 'Invoice #1076 from Click Plumbing', subject: 'invoice #1076  from click plumbing' })).toBe('')
    expect(sentCopySubjectLine({ title: 'Release of lien', subject: '' })).toBe('')
  })

  it('says a kind in words', () => {
    expect(sentKindWords('invoice_email')).toBe('Invoice email')
    expect(sentKindWords('test_report')).toBe('Test report')
    expect(sentKindWords('gc_statement')).toBe('GC statement')
    expect(sentKindWords('estimate_pdf')).toBe('Estimate PDF')
    expect(sentKindWords('rfq')).toBe('RFQ')
    expect(sentKindWords('')).toBe('')
  })

  it('colours the tag by its group: bills green, lien and legal red, contracts blue, bids violet, statements amber, the rest grey', () => {
    expect(sentKindTag('bill_email')).toEqual({ words: 'Bill email', ...SENT_GROUP_COLORS.bills })
    expect(sentKindTag('lien_release')).toMatchObject({ color: 'var(--text-red-700)' })
    expect(sentKindTag('estimate_pdf')).toMatchObject({ color: 'var(--text-blue-700)' })
    expect(sentKindTag('rfq')).toMatchObject({ color: 'var(--text-violet-700)' })
    expect(sentKindTag('test_report')).toMatchObject({ color: 'var(--text-amber-800)' })
    expect(sentKindTag('messages_email')).toMatchObject({ words: 'Messages email', color: 'var(--text-muted)' })
    const pairs = new Set(Object.values(SENT_GROUP_COLORS).map((c) => c.color))
    expect(pairs.size).toBe(6)
  })
})
