import { describe, expect, it } from 'vitest'
import { buildLienTimelineBook, type LienBookJob, type LienTimelineBookInput } from './lienTimelineBook'
import type { LienDeskItemRow, LienNoticeMonthRow } from './lienDesk'
import type { LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import {
  buildLienProperties,
  lienNotInRunGroups,
  lienNotInRunWords,
  lienPropertyAffidavitLine,
  lienPropertyAtAffidavit,
  lienPropertyJobsWords,
  lienPropertyNoticeLine,
  lienPropertyOf,
  lienPropertyOfJob,
  lienPropertyTally,
  type LienPropertyNoticeFacts,
} from './lienPropertyPapers'

const sub = (over: Partial<LienPropertyNoticeFacts> = {}): LienPropertyNoticeFacts => ({ isSub: true, pile: null, noticed: false, sentOn: [], ...over })

describe('lienPropertyNoticeLine: where one job’s notice stands', () => {
  it('a job contracted with the owner needs none, in the To do row’s own words', () => {
    expect(lienPropertyNoticeLine(sub({ isSub: false }))).toMatchObject({ state: 'none_needed', words: 'No notice needed · contracted with the owner' })
  })
  it('a notice on record says the day it went', () => {
    expect(lienPropertyNoticeLine(sub({ pile: 'sent', noticed: true, sentOn: ['2026-10-14'] }))).toMatchObject({ state: 'sent', words: 'Notice sent Oct 14', aside: '', sentOn: ['2026-10-14'] })
  })
  it('a notice that aged off the desk’s queue is still sent, from its recorded day', () => {
    expect(lienPropertyNoticeLine(sub({ pile: null, sentOn: ['2026-09-22', '2026-09-22'] }))).toMatchObject({ state: 'sent', words: 'Notice sent Sep 22', sentOn: ['2026-09-22'] })
  })
  it('on record with no day says so, and guesses no day', () => {
    expect(lienPropertyNoticeLine(sub({ noticed: true }))).toMatchObject({ state: 'sent', words: 'Notice on record' })
  })
  it('a live paper is named by its bin on the Board', () => {
    expect(lienPropertyNoticeLine(sub({ pile: 'ready', dueOn: '2026-12-15' }))).toMatchObject({ state: 'going', words: 'Approved · to print', aside: 'last day Dec 15' })
    expect(lienPropertyNoticeLine(sub({ pile: 'printed', printedOn: '2026-11-16', dueOn: '2026-12-15' }))).toMatchObject({ state: 'going', words: 'Approved · to mail', aside: 'printed Nov 16' })
    expect(lienPropertyNoticeLine(sub({ pile: 'awaiting', dueOn: '2026-12-15' }))).toMatchObject({ state: 'waits', words: 'Awaiting Master approval', aside: 'last day Dec 15' })
    expect(lienPropertyNoticeLine(sub({ pile: 'to_draft' }))).toMatchObject({ state: 'waits', words: 'To send for Master approval', aside: '' })
    expect(lienPropertyNoticeLine(sub({ pile: 'needs_owner' }))).toMatchObject({ state: 'waits', words: 'Needs the owner' })
    expect(lienPropertyNoticeLine(sub({ pile: 'held', holdUntil: '2026-11-20' }))).toMatchObject({ state: 'waits', words: 'Held', aside: 'until Nov 20' })
    expect(lienPropertyNoticeLine(sub({ pile: 'missed' }))).toMatchObject({ state: 'missed', words: 'Missed' })
  })
  it('a new month’s paper leads, and the earlier notice that went rides under it', () => {
    expect(lienPropertyNoticeLine(sub({ pile: 'to_draft', dueOn: '2026-12-15', noticed: true, sentOn: ['2026-10-14'] }))).toMatchObject({ state: 'waits', words: 'To send for Master approval', aside: 'last day Dec 15 · earlier: Notice sent Oct 14' })
  })
  it('nothing on record on a job that needs one is said, never explained', () => {
    expect(lienPropertyNoticeLine(sub())).toMatchObject({ state: 'none', words: 'No notice on record' })
  })
})

describe('lienPropertyAffidavitLine: where one job’s affidavit stands', () => {
  const none = { pile: null, gateHeld: false, missing: [] as string[] }
  it('a filed affidavit and its served copy are the timeline’s own steps', () => {
    expect(lienPropertyAffidavitLine({ ...none, pile: 'filed', affidavitStep: { state: 'done', dateWords: 'filed Jul 14', words: '#2026-0412' }, serveStep: { state: 'done', dateWords: 'served Jul 16', words: '2 days' } })).toEqual({ state: 'filed', words: 'Filed Jul 14', aside: 'served Jul 16', pile: 'filed' })
    expect(lienPropertyAffidavitLine({ ...none, affidavitStep: { state: 'done', dateWords: 'filed Jul 14', words: '' }, serveStep: { state: 'due', dateWords: 'Jul 20', words: '' } })).toMatchObject({ state: 'filed', aside: 'serve its copy by Jul 20' })
    expect(lienPropertyAffidavitLine({ ...none, affidavitStep: { state: 'done', dateWords: 'filed Jul 14', words: '' }, serveStep: { state: 'missed', dateWords: 'Jul 20', words: '' } })).toMatchObject({ aside: 'serving its copy is overdue' })
  })
  it('a paper on the desk is named by its bin, with its last day or what it is missing', () => {
    expect(lienPropertyAffidavitLine({ ...none, pile: 'to_draft', deadline: '2026-12-15' })).toEqual({ state: 'waits', words: 'To send for Master approval', aside: 'last day Dec 15', pile: 'to_draft' })
    expect(lienPropertyAffidavitLine({ ...none, pile: 'awaiting', deadline: '2026-12-15' })).toMatchObject({ state: 'waits', words: 'Awaiting Master approval' })
    expect(lienPropertyAffidavitLine({ ...none, pile: 'ready', deadline: '2026-12-15' })).toMatchObject({ state: 'ready', words: 'Ready to file', aside: 'last day Dec 15' })
    expect(lienPropertyAffidavitLine({ ...none, pile: 'needs_property', missing: ['legal', "the GC's address"], deadline: '2026-12-15' })).toMatchObject({ state: 'waits', words: 'Needs the property facts', aside: "missing legal, the GC's address" })
    expect(lienPropertyAffidavitLine({ pile: 'held', gateHeld: true, missing: ['the homestead answer'], deadline: '2026-12-15' })).toMatchObject({ state: 'held', words: 'Held', aside: 'missing the homestead answer' })
    expect(lienPropertyAffidavitLine({ pile: 'held', gateHeld: false, missing: [], deadline: '2026-12-15' })).toMatchObject({ state: 'held', aside: 'last day Dec 15' })
  })
  it('a blocked lien and a closed window keep the timeline’s words', () => {
    expect(lienPropertyAffidavitLine({ ...none, affidavitStep: { state: 'blocked', dateWords: '—', words: 'blocked · no notice on record' } })).toMatchObject({ state: 'blocked', words: 'Blocked · no notice on record' })
    expect(lienPropertyAffidavitLine({ ...none, affidavitStep: { state: 'missed', dateWords: 'Jul 15', words: 'window closed with nothing filed' } })).toMatchObject({ state: 'missed', words: 'Missed', aside: 'window closed with nothing filed' })
  })
  it('no paper and no step is no line', () => {
    expect(lienPropertyAffidavitLine(none)).toEqual({ state: 'none', words: '', aside: '', pile: null })
  })
})

// ---------- one property through the book ----------

const TODAY = '2026-11-16'

function month(job_id: string, work_month: string, deadline: string, extra: Partial<LienNoticeMonthRow> = {}): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 12, noticed: false, open_balance: 1_000, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, ...extra }
}

function window(job_id: string, last_month: string, deadline: string, extra: Partial<LienAffidavitRow> = {}): LienAffidavitRow {
  return { job_id, last_month, deadline, is_sub: true, noticed: true, filed: false, open_balance: 1_000, customer_id: 'c', gc_customer_id: 'gc1', property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, ...extra }
}

function job(id: string, over: Partial<LienBookJob> = {}): LienBookJob {
  return { id, label: `${id.slice(1)} · Job ${id}`, address: '412 Ridgeline Dr', gcId: 'gc1', gcName: 'Marlow Builders', propertyKind: 'residential', homestead: false, county: 'Comal', ownerName: 'Avery and Jordan Pell', openBalance: 1_000, lastWorkDate: '2026-09-20', isSub: true, addressId: 'p-ridgeline', propertyAddress: '412 Ridgeline Dr, Hollow Creek', ownerMailingAddress: '9 Alder Ct, Hollow Creek', ...over }
}

const noticeFiling = (job_id: string, sent_on: string, months: string[]): JobLienFilingRow =>
  ({ id: `f-${job_id}`, job_id, kind: 'notice_53_056', amount: 1_000, county: '', created_at: `${sent_on}T15:00:00Z`, created_by: null, fields: {}, filed_at: null, invoice_ids: [], months_covered: months, recording_number: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '7000', sent_on }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '7001', sent_on }], serve_due: null, served_at: null, voided_at: null }) as unknown as JobLienFilingRow

const item = (over: Partial<LienDeskItemRow>): LienDeskItemRow =>
  ({ id: 'i1', job_id: 'j1207', kind: 'notice_53_056', status: 'approved', months: ['2026-10'], fields: {}, created_at: '2026-11-10T15:00:00Z', updated_at: '2026-11-16T15:00:00Z', voided_at: null, sent_at: null, printed_at: null, hold_until: null, approval_mode: null, ...over }) as unknown as LienDeskItemRow

/**
 * The property that started this view, with made-up jobs: seven jobs under one GC. One notice approved and printed
 * today, four that went Oct 14 and stand at the affidavit, two that went Sep 22. Then a job at the owner's other
 * property, a job contracted with its owner, and a job with no property record.
 */
function input(): LienTimelineBookInput {
  const oct14 = ['j1203', 'j1204', 'j1205', 'j1206']
  const sep22 = ['j1198', 'j1199']
  return {
    rows: [
      month('j1207', '2026-10', '2026-12-15'),
      ...oct14.map((id) => month(id, '2026-09', '2026-11-16', { noticed: true })),
      ...sep22.map((id) => month(id, '2026-08', '2026-10-15', { noticed: true })),
      month('j1301', '2026-10', '2026-12-15', { has_owner: false }),
      month('j1500', '2026-10', '2026-12-15'),
    ],
    affidavitRows: [
      ...oct14.map((id) => window(id, '2026-09', '2027-01-15')),
      window('j1198', '2026-08', '2026-12-15', { has_legal: false }),
      window('j1199', '2026-08', '2026-12-15'),
      window('j1400', '2026-09', '2027-01-15', { is_sub: false, gc_customer_id: null, noticed: false }),
    ],
    items: [item({ printed_at: '2026-11-16T16:00:00Z' })],
    filingsByJob: Object.fromEntries([...oct14.map((id) => [id, [noticeFiling(id, '2026-10-14', ['2026-09'])]] as const), ...sep22.map((id) => [id, [noticeFiling(id, '2026-09-22', ['2026-08'])]] as const)]),
    jobs: {
      j1207: job('j1207'),
      ...Object.fromEntries([...oct14, ...sep22].map((id) => [id, job(id)])),
      j1301: job('j1301', { addressId: 'p-fenwick', propertyAddress: '88 Fenwick Ln, Hollow Creek', address: '88 Fenwick Ln' }),
      j1400: job('j1400', { addressId: 'p-quarry', propertyAddress: '30 Quarry Rd, Hollow Creek', ownerName: 'Dale Okafor', ownerMailingAddress: '30 Quarry Rd, Hollow Creek', isSub: false, gcId: null, gcName: '' }),
      j1500: job('j1500', { addressId: null, propertyAddress: '', ownerName: '', ownerMailingAddress: '', address: '5 Typed St' }),
    },
    policyByCustomer: { gc1: 'ask' },
    todayYmd: TODAY,
  }
}

describe('buildLienProperties: the book gathered by property record', () => {
  const book = buildLienTimelineBook(input())
  const properties = buildLienProperties(book.rows)
  const ridgeline = properties.find((p) => p.key === 'p-ridgeline')!

  it('gathers by the record’s id, and the jobs with no record under one group', () => {
    expect(properties.map((p) => `${p.key}:${p.jobs.length}`).sort()).toEqual([':1', 'p-fenwick:1', 'p-quarry:1', 'p-ridgeline:7'])
    expect(properties.find((p) => p.key === '')).toMatchObject({ addressId: null, address: '', ownerName: '' })
  })

  it('names the property by its record and adds what its jobs owe', () => {
    expect(ridgeline).toMatchObject({ address: '412 Ridgeline Dr, Hollow Creek', ownerName: 'Avery and Jordan Pell', openBalance: 7_000 })
    expect(lienPropertyJobsWords(ridgeline.jobs.length)).toBe('7 jobs')
  })

  it('answers the question from the screen: which notices went and when, and which is going now', () => {
    const by = Object.fromEntries(ridgeline.jobs.map((l) => [l.jobId, `${l.notice.words}${l.notice.aside ? ` (${l.notice.aside})` : ''}`]))
    expect(by).toEqual({
      j1207: 'Approved · to mail (printed Nov 16)',
      j1203: 'Notice sent Oct 14',
      j1204: 'Notice sent Oct 14',
      j1205: 'Notice sent Oct 14',
      j1206: 'Notice sent Oct 14',
      j1198: 'Notice sent Sep 22',
      j1199: 'Notice sent Sep 22',
    })
  })

  it('says where each affidavit stands, in the Board’s words', () => {
    const line = (id: string) => ridgeline.jobs.find((l) => l.jobId === id)!.affidavit
    expect(line('j1203')).toMatchObject({ state: 'waits', words: 'To send for Master approval', aside: 'last day Jan 15' })
    expect(line('j1198')).toMatchObject({ state: 'waits', words: 'Needs the property facts', aside: 'missing legal' })
    expect(line('j1207')).toMatchObject({ state: 'none', words: '' })
  })

  it('one tally per property', () => {
    expect(ridgeline.tally).toBe('6 notices sent · 1 to print and mail · 6 at the affidavit')
    expect(properties.find((p) => p.key === 'p-fenwick')!.tally).toBe('1 needs the owner')
    expect(properties.find((p) => p.key === 'p-quarry')!.tally).toBe('1 needs no notice · 1 at the affidavit')
  })

  it('names the owner’s other property only when the name and the mailing address both match', () => {
    expect(ridgeline.sameOwner).toEqual([{ addressId: 'p-fenwick', address: '88 Fenwick Ln, Hollow Creek', jobs: 1 }])
    expect(properties.find((p) => p.key === 'p-quarry')!.sameOwner).toEqual([])
    expect(properties.find((p) => p.key === '')!.sameOwner).toEqual([])
  })

  it('finds one property by its record or by a job on it', () => {
    expect(lienPropertyOf(book.rows, 'p-ridgeline')?.jobs).toHaveLength(7)
    expect(lienPropertyOf(book.rows, 'p-nowhere')).toBeNull()
    expect(lienPropertyOfJob(book.rows, 'j1199')?.key).toBe('p-ridgeline')
    expect(lienPropertyOfJob(book.rows, 'j1500')).toBeNull()
  })

  it('why the other six are not in the envelope, in one set of words', () => {
    const others = ridgeline.jobs.filter((l) => l.jobId !== 'j1207').map((l) => l.notice)
    expect(lienNotInRunGroups(others)).toEqual([
      { count: 4, words: '4 had their notice sent Oct 14.' },
      { count: 2, words: '2 had their notice sent Sep 22.' },
    ])
    expect(lienNotInRunWords(others)).toBe('6 other jobs at this property are not in this envelope. 4 had their notice sent Oct 14. 2 had their notice sent Sep 22.')
  })
})

describe('lienNotInRunWords: every reason is the notice’s own state', () => {
  const line = (f: Partial<LienPropertyNoticeFacts>) => lienPropertyNoticeLine(sub(f))
  it('says one job in the singular', () => {
    expect(lienNotInRunWords([line({ pile: 'awaiting' })])).toBe('1 other job at this property is not in this envelope. 1 waits on Master approval.')
  })
  it('has a sentence for each state', () => {
    const words = (f: Partial<LienPropertyNoticeFacts>, n = 2) => lienNotInRunGroups(Array.from({ length: n }, () => line(f)))[0]!.words
    expect(words({ pile: 'awaiting' })).toBe('2 wait on Master approval.')
    expect(words({ pile: 'to_draft' })).toBe('2 are not sent for approval yet.')
    expect(words({ pile: 'needs_owner' })).toBe('2 need the owner.')
    expect(words({ pile: 'held' })).toBe('2 are held.')
    expect(words({ pile: 'ready' })).toBe('2 are approved and not printed yet.')
    expect(words({ pile: 'printed' })).toBe('2 are printed and wait for the mail.')
    expect(words({ pile: 'missed' })).toBe('2 missed their notice window.')
    expect(words({ isSub: false })).toBe('2 need no notice.')
    expect(words({})).toBe('2 have no notice on record.')
    expect(words({ noticed: true })).toBe('2 have their notice on record.')
    expect(words({ pile: 'printed' }, 1)).toBe('1 is printed and waits for the mail.')
  })
  it('names the run a caller hands it, and says nothing with no other job', () => {
    expect(lienNotInRunWords([line({ isSub: false })], 'this run')).toBe('1 other job at this property is not in this run. 1 needs no notice.')
    expect(lienNotInRunWords([])).toBe('')
  })
})

describe('lienPropertyTally', () => {
  it('counts each notice once, in the path’s order, then the affidavits', () => {
    const l = (n: Partial<LienPropertyNoticeFacts>, pile: 'to_draft' | 'filed' | null = null) => ({ notice: lienPropertyNoticeLine(sub(n)), affidavit: lienPropertyAffidavitLine({ pile, gateHeld: false, missing: [] }) })
    expect(lienPropertyTally([l({ pile: 'awaiting' }), l({ pile: 'to_draft' }), l({ pile: 'to_draft' }), l({ pile: 'held' }), l({ pile: 'missed' }), l({}), l({ noticed: true }, 'filed'), l({ noticed: true }, 'to_draft')])).toBe(
      '2 notices sent · 1 awaiting approval · 2 to send for approval · 1 held · 1 missed · 1 with no notice on record · 1 at the affidavit · 1 filed',
    )
    expect(lienPropertyTally([])).toBe('')
  })
  it('a job is at the affidavit only once its notice is behind it', () => {
    expect(lienPropertyAtAffidavit({ notice: lienPropertyNoticeLine(sub({ pile: 'awaiting' })), affidavit: lienPropertyAffidavitLine({ pile: 'to_draft', gateHeld: false, missing: [] }) })).toBe(false)
    expect(lienPropertyAtAffidavit({ notice: lienPropertyNoticeLine(sub({ isSub: false })), affidavit: lienPropertyAffidavitLine({ pile: 'ready', gateHeld: false, missing: [] }) })).toBe(true)
  })
})
