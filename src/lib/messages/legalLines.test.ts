import { describe, expect, it } from 'vitest'
import type { Tables } from '../../types/database'
import { plainWordsFailures } from '../plainWords'
import {
  boxStateAfter,
  isLegalLine,
  LEGAL_BOX_WORDS,
  LEGAL_PAPER_NAMES,
  LEGAL_ROUTE_WHY,
  legalHowSentence,
  legalLines,
  legalSendsFromDemandLetters,
  legalSendsFromFilings,
  routeReply,
  standingLegalLine,
  type LegalPaper,
} from './legalLines'
import type { ThreadMessage } from './thread'

/**
 * The mockups' card 7: Dana Whitfield on job 1312, the Oakridge sewer line. The office sent a Notice of unpaid balance
 * on Sun Oct 18 by certified mail and email, and Dana texted on Tue Oct 20. Nothing here is a real row.
 */
const DANA = 'dana'
const JOB = 'job-1312'
const ROSA = { userId: 'u-rosa', name: 'Rosa' }

type FilingRow = Pick<Tables<'job_lien_filings'>, 'id' | 'job_id' | 'kind' | 'created_at' | 'filed_at' | 'served_at' | 'voided_at' | 'sends'>
const filing = (id: string, patch: Partial<FilingRow> = {}): FilingRow => ({
  id,
  job_id: JOB,
  kind: 'notice_53_056',
  // Recorded Sun Oct 18 at 10:15 AM in Chicago.
  created_at: '2026-10-18T15:15:00.000Z',
  filed_at: null,
  served_at: null,
  voided_at: null,
  sends: [
    { recipient: 'owner', method: 'certified_mail', tracking: '9407 1000 0000 0000 0000 00', sent_on: '2026-10-18' },
    { recipient: 'owner', method: 'email', tracking: '', sent_on: '2026-10-18' },
    { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-18' },
  ],
  ...patch,
})

const danaText: ThreadMessage = {
  id: 'm-20',
  contactId: DANA,
  jobId: null,
  channel: 'text',
  direction: 'in',
  at: '2026-10-20T19:05:00.000Z',
  who: 'Dana',
  body: 'Got a letter about a lien?? Nobody told me the bill was late.',
}

const thread = (...sends: Parameters<typeof legalLines>[0]) => [...legalLines(sends, DANA), danaText]
const notice = legalSendsFromFilings([filing('f-notice')], { recipient: 'owner' })

describe('legalLines', () => {
  it('draws Dana’s notice as a grey line from the office, read only, with the paper and how it went', () => {
    const [line] = legalLines(notice, DANA)
    expect(line).toEqual({
      id: 'legal:filing:f-notice',
      contactId: DANA,
      jobId: 'pipeline:job-1312',
      channel: 'event',
      direction: 'out',
      at: '2026-10-18T15:15:00.000Z',
      who: 'the office',
      subject: 'Notice of unpaid balance',
      body: 'Sent by certified mail and email from the Lien desk.',
      channelId: null,
      legal: true,
      paper: 'notice',
    })
    expect(isLegalLine(line!)).toBe(true)
    expect(isLegalLine(danaText)).toBe(false)
  })

  it('takes the GC’s copy for a GC, and leaves out a paper with no copy to the person', () => {
    const gc = legalSendsFromFilings([filing('f-notice')], { recipient: 'original_contractor' })
    expect(gc.map((s) => s.methods)).toEqual([['certified_mail']])
    const ownerOnly = filing('f-owner', { sends: [{ recipient: 'owner', method: 'email', tracking: '', sent_on: '2026-10-18' }] })
    expect(legalSendsFromFilings([ownerOnly], { recipient: 'original_contractor' })).toEqual([])
  })

  it('names each paper as the app does, marks the second letter from its desk item, and drops a voided one', () => {
    const sends = legalSendsFromFilings(
      [
        filing('f-retainage', { kind: 'retainage_53_057' }),
        filing('f-two'),
        filing('f-void', { voided_at: '2026-10-19T12:00:00.000Z' }),
        filing('f-odd', { kind: 'something_new' }),
      ],
      { items: [{ sent_filing_id: 'f-two', fields: { letterTwo: { kind: 'unresponsive' } }, voided_at: null }] },
    )
    expect(sends.map((s) => [s.id, s.paper])).toEqual([
      ['filing:f-retainage', 'retainage'],
      ['filing:f-two', 'secondLetter'],
    ])
    expect(Object.values(LEGAL_PAPER_NAMES)).toEqual(['Notice of unpaid balance', 'Retainage notice', 'Lien affidavit', 'Lien release', 'Demand letter', 'Second letter', 'Courtesy notice'])
  })

  it('shows an affidavit once it is served, and a release with no send, at noon of its day', () => {
    const sends = legalSendsFromFilings([
      filing('f-aff', { kind: 'affidavit', sends: [], filed_at: '2026-11-02' }),
      filing('f-served', { kind: 'affidavit', sends: [], filed_at: '2026-11-02', served_at: '2026-11-04' }),
      filing('f-release', { kind: 'release_of_record', sends: [], filed_at: '2026-11-20' }),
    ])
    expect(sends.map((s) => [s.paper, s.at])).toEqual([
      ['affidavit', '2026-11-04T18:00:00.000Z'],
      ['release', '2026-11-20T18:00:00.000Z'],
    ])
    expect(legalLines(sends, DANA).map((l) => l.body)).toEqual(['Recorded on the Lien desk.', 'Recorded on the Lien desk.'])
  })

  it('reads a demand letter that went, and none that was voided or never sent', () => {
    const base = { job_id: JOB, created_at: '2026-10-21T15:00:00.000Z', voided_at: null }
    const sends = legalSendsFromDemandLetters([
      { ...base, id: 'd1', sent_at: '2026-10-21', sent_method: 'traceable_courier' },
      { ...base, id: 'd2', sent_at: null, sent_method: '' },
      { ...base, id: 'd3', sent_at: '2026-10-21', sent_method: 'email', voided_at: '2026-10-22T12:00:00.000Z' },
    ])
    expect(sends).toEqual([{ id: 'demand:d1', jobId: JOB, paper: 'demand', methods: ['traceable_courier'], at: '2026-10-21T15:00:00.000Z' }])
  })

  it('says how it went in one plain sentence', () => {
    expect(legalHowSentence(['hand'])).toBe('Sent by hand from the Lien desk.')
    expect(legalHowSentence(['certified_mail', 'traceable_courier', 'email'])).toBe('Sent by certified mail, traceable courier and email from the Lien desk.')
    const papers = Object.keys(LEGAL_PAPER_NAMES) as LegalPaper[]
    const words = [...papers.map((p) => LEGAL_PAPER_NAMES[p]), legalHowSentence(['certified_mail', 'email']), legalHowSentence([]), LEGAL_BOX_WORDS, LEGAL_ROUTE_WHY]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})

describe('the reply box under a legal line', () => {
  it('is off for a tech and the superintendent after Dana’s notice, with the words', () => {
    for (const role of ['primary', 'superintendent', 'helpers', 'subcontractor', 'estimator']) {
      expect(boxStateAfter(thread(...notice), role)).toEqual({ open: false, words: LEGAL_BOX_WORDS })
    }
  })

  it('is on for the office, the master included', () => {
    for (const role of ['assistant', 'controller', 'master_technician', 'dev']) expect(boxStateAfter(thread(...notice), role)).toEqual({ open: true, words: null })
  })

  it('is on with no legal line, and comes back after a Lien release on that job', () => {
    expect(boxStateAfter([danaText], 'primary').open).toBe(true)
    const release = legalSendsFromFilings([filing('f-release', { kind: 'release_of_record', sends: [], filed_at: '2026-11-20' })])
    expect(boxStateAfter(thread(...notice, ...release), 'primary').open).toBe(true)
  })

  it('stays off while another job’s notice stands', () => {
    const other = legalSendsFromFilings([filing('f-1298', { job_id: 'job-1298' })])
    const release = legalSendsFromFilings([filing('f-release', { kind: 'release_of_record', sends: [], filed_at: '2026-11-20' })])
    const lines = thread(...notice, ...release, ...other)
    expect(standingLegalLine(lines)?.id).toBe('legal:filing:f-1298')
    expect(boxStateAfter(lines, 'primary').open).toBe(false)
  })
})

describe('routeReply', () => {
  const standing = () => standingLegalLine(thread(...notice))

  it('sends Dana’s reply to the office alone, with the reason, and the office’s pick as the rule wrote it', () => {
    expect(routeReply(danaText, standing(), ROSA)).toEqual({
      has: 'office',
      userId: 'u-rosa',
      name: 'Rosa',
      reason: 'legal',
      why: LEGAL_ROUTE_WHY,
      write: { has_user_id: 'u-rosa', has_since: danaText.at, has_how: 'rule' },
    })
  })

  it('leaves it for whoever in the office answers first when nobody is picked', () => {
    expect(routeReply(danaText, standing())).toMatchObject({ has: 'office', userId: null, write: { has_user_id: null, has_since: null, has_how: null } })
  })

  it('leaves the usual rule to decide before the notice, for our own line, and with no notice standing', () => {
    expect(routeReply({ ...danaText, at: '2026-10-17T19:05:00.000Z' }, standing(), ROSA)).toBeNull()
    expect(routeReply({ ...danaText, direction: 'out' }, standing(), ROSA)).toBeNull()
    expect(routeReply(danaText, null, ROSA)).toBeNull()
  })
})
