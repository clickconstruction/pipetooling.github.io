import { describe, expect, it } from 'vitest'
import {
  LIEN_PUBLIC_BIN_TITLE,
  lienBoxFoldWords,
  lienPublicNeedsWords,
  buildLienPublicBin,
  buildLienPublicWindow,
  lienJobIdsAskingPublic,
  lienJobIdsOffLienPath,
  lienPropertyIsPublic,
  lienPublicAnswerOf,
  lienPublicAttorneyNote,
  lienPublicBoardLine,
  lienPublicAnsweredWords,
  lienPublicBackLabel,
  lienPublicDefaultReason,
  lienPublicListNote,
  lienPublicNotListedWhy,
  lienPublicPressDoes,
  lienPublicPressLabel,
  lienPublicPressOutcome,
  lienPublicPressWords,
  lienPublicStanding,
  lienPublicWhatWentOut,
  lienPublicWindowListsJob,
  type LienPublicJob,
} from './lienPublicProperty'

const CITY = { owner_name: 'ZZ TEST CITY OF', owner_company: 'ATTN REAL ESTATE MANAGER' }
const PRIVATE = { owner_name: 'ZZ Test Holdings LLC', owner_company: '' }

describe('the answer on the property record', () => {
  it('reads public, private or nothing, whatever else the column holds', () => {
    expect(lienPublicAnswerOf({ lien_public_answer: 'public' })).toBe('public')
    expect(lienPublicAnswerOf({ lien_public_answer: 'private' })).toBe('private')
    expect(lienPublicAnswerOf({ lien_public_answer: null })).toBeNull()
    expect(lienPublicAnswerOf({ lien_public_answer: 'maybe' })).toBeNull()
    // A row read before the migration carries no answer.
    expect(lienPublicAnswerOf(CITY)).toBeNull()
    expect(lienPublicAnswerOf(null)).toBeNull()
  })

  it('the stored answer wins over the names; with no answer the names decide', () => {
    expect(lienPropertyIsPublic(CITY)).toBe(true)
    expect(lienPropertyIsPublic(PRIVATE)).toBe(false)
    // No, it is private: a name that only sounds public no longer holds a paper.
    expect(lienPropertyIsPublic({ ...CITY, lien_public_answer: 'private' })).toBe(false)
    // Yes, public: a name the guess would never catch.
    expect(lienPropertyIsPublic({ ...PRIVATE, lien_public_answer: 'public' })).toBe(true)
    // The names a screen holds are asked when the record's own are not at hand.
    expect(lienPropertyIsPublic(null, ['ZZ TEST COUNTY OF', ''])).toBe(true)
    expect(lienPropertyIsPublic({ lien_public_answer: 'private' }, ['ZZ TEST COUNTY OF'])).toBe(false)
    expect(lienPropertyIsPublic(null)).toBe(false)
  })

  it('stands off the path, asking, private or clear', () => {
    expect(lienPublicStanding({ ...CITY, lien_public_answer: 'public' })).toBe('off_path')
    expect(lienPublicStanding({ ...CITY, lien_public_answer: null })).toBe('asks')
    // A row read before the migration is pushed cannot be answered, so it does not ask.
    expect(lienPublicStanding(CITY)).toBe('clear')
    expect(lienPublicStanding({ ...CITY, lien_public_answer: 'private' })).toBe('private')
    expect(lienPublicStanding(PRIVATE)).toBe('clear')
    expect(lienPublicStanding(null)).toBe('clear')
  })

  it('every job at a public property is off the path, by its property and no flag of its own', () => {
    const properties = { a1: { ...CITY, lien_public_answer: 'public' }, a2: { ...CITY, lien_public_answer: null }, a3: PRIVATE, a4: { ...CITY, lien_public_answer: 'private' } }
    const jobs = [
      { id: 'j1', customer_address_id: 'a1' },
      { id: 'j2', customer_address_id: 'a1' },
      { id: 'j3', customer_address_id: 'a2' },
      { id: 'j4', customer_address_id: 'a3' },
      { id: 'j5', customer_address_id: 'a4' },
      { id: 'j6', customer_address_id: null },
      { id: 'j7', customer_address_id: 'not-read' },
    ]
    expect([...lienJobIdsOffLienPath(jobs, properties)]).toEqual(['j1', 'j2'])
    expect([...lienJobIdsAskingPublic(jobs, properties)]).toEqual(['j3'])
    // The answer taken back: both jobs are on the path again, and the property asks.
    const back = { ...properties, a1: { ...CITY, lien_public_answer: null } }
    expect([...lienJobIdsOffLienPath(jobs, back)]).toEqual([])
    expect([...lienJobIdsAskingPublic(jobs, back)]).toEqual(['j1', 'j2', 'j3'])
  })
})

describe('what already went out on a job', () => {
  it('says the notice mailed and the affidavit approved and not filed', () => {
    expect(
      lienPublicWhatWentOut([
        { kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' },
        { kind: 'affidavit', status: 'approved', approved_at: '2026-11-11T16:00:00Z' },
      ]),
    ).toBe('A lien notice was mailed Oct 8. An affidavit was approved Nov 11 and not filed.')
  })
  it('says nothing went out, and counts the months missed once each', () => {
    const missed = (months: string[]) => ({ kind: 'notice_53_056', status: 'missed', months })
    expect(lienPublicWhatWentOut([missed(['2026-06']), missed(['2026-07']), missed(['2026-08', '2026-07']), missed(['2026-09'])])).toBe('No lien paper has gone out. Four months were missed.')
    expect(lienPublicWhatWentOut([missed(['2026-06'])])).toBe('No lien paper has gone out. One month was missed.')
    expect(lienPublicWhatWentOut([])).toBe('No lien paper has gone out.')
  })
  it('names a paper waiting on approval, and leaves a voided one out', () => {
    expect(lienPublicWhatWentOut([{ kind: 'notice_53_056', status: 'awaiting_approval' }])).toBe('No lien paper has gone out. A lien notice was drafted and not sent.')
    expect(lienPublicWhatWentOut([{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z', voided_at: '2026-10-09T15:00:00Z' }])).toBe('No lien paper has gone out.')
    expect(lienPublicWhatWentOut([{ kind: 'retainage_53_057', status: 'approved' }])).toBe('No lien paper has gone out. A retainage notice was approved and not sent.')
  })
})

describe('the bin: Public jobs · bond claim', () => {
  const job = (over: Partial<LienPublicJob>): LienPublicJob => ({ jobId: 'j', addressId: 'a1', number: 'ZZ1', name: 'ZZ Test Drains', gcName: 'ZZ Test Builders', unpaid: 100, bond: 'unknown', attorneySince: '2026-11-16T18:00:00Z', papers: [], ...over })
  it('is null with no job off the path', () => {
    expect(buildLienPublicBin([])).toBeNull()
  })
  it('lists the jobs, the most money first, with the total, the bond chip, what went out and since when', () => {
    const bin = buildLienPublicBin([
      job({ jobId: 'small', number: 'ZZ883', unpaid: 2918.4, papers: [{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }] }),
      job({ jobId: 'big', number: 'ZZ523', name: 'ZZ Test Hills', unpaid: 29323.4 }),
    ])!
    expect(bin.title).toBe(LIEN_PUBLIC_BIN_TITLE)
    expect(bin.count).toBe(2)
    expect(bin.totalWords).toBe('$32,241 unpaid')
    // Folded to one line (v2.7854): the count in words, and the rows that still wear the bond chip, so the fold never hides what needs a person.
    expect(bin.foldWords).toBe('2 jobs · $32,241 unpaid')
    expect(bin.needs).toBe('2 to get the bond')
    expect(buildLienPublicBin([job({ bond: 'yes' })])!.needs).toBeNull()
    expect(buildLienPublicBin([job({ bond: 'yes', unpaid: 100 })])!.foldWords).toBe('1 job · $100 unpaid')
    expect(lienBoxFoldWords(3, 1750)).toBe('3 jobs · $1,750 unpaid')
    expect(lienPublicNeedsWords(1)).toBe('1 to get the bond')
    expect(lienPublicNeedsWords(0)).toBeNull()
    expect(bin.rows.map((r) => r.jobId)).toEqual(['big', 'small'])
    expect(bin.rows[0]).toMatchObject({ label: 'ZZ523 · ZZ Test Hills', unpaidWords: '$29,323', chip: 'get the bond', line: 'ZZ Test Builders · bond not known yet · with the attorney since Nov 16' })
    expect(bin.rows[1]!.line).toBe('ZZ Test Builders · a lien notice went out Oct 8 · with the attorney since Nov 16')
    expect(bin.backLabel).toBe('Put a job back on the lien path…')
  })
  it('drops the chip once the bond is known, and says when a job is not on the attorney’s list', () => {
    const bin = buildLienPublicBin([job({ bond: 'yes', attorneySince: null }), job({ jobId: 'k', number: 'ZZ2', bond: 'no', papers: [{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }] })])!
    expect(bin.rows[0]).toMatchObject({ chip: null, line: 'ZZ Test Builders · there is a payment bond · not on the attorney’s list yet' })
    expect(bin.rows[1]).toMatchObject({ chip: null, line: 'ZZ Test Builders · a lien notice went out Oct 8 · no payment bond · with the attorney since Nov 16' })
  })
  it('a job the Collections flag held never reads as if counsel has it', () => {
    const bin = buildLienPublicBin([job({ status: 'working', attorneySince: null }), job({ jobId: 'w', number: 'ZZ3', status: 'waiting', attorneySince: null })])!
    expect(bin.rows.map((r) => r.line)).toEqual([
      'ZZ Test Builders · bond not known yet · not on the attorney’s list, the job is still being worked',
      'ZZ Test Builders · bond not known yet · not on the attorney’s list, the job has not started',
    ])
    expect(lienPublicNotListedWhy('ready_to_bill')).toBe('is not billed yet')
    expect(lienPublicNotListedWhy('billed')).toBeNull()
  })
})

describe('the Board’s line', () => {
  const line = (asking: string[], open: string[]) =>
    lienPublicBoardLine({ askingJobIds: new Set(asking), openPaperJobIds: new Set(open), unpaidOf: (id) => (id === 'j883' ? 2918.4 : 29323.4), addressIdOf: () => 'a1' })
  it('counts the jobs that ask and still have a paper open, with their money', () => {
    expect(line(['j883', 'j523'], ['j883', 'j523', 'other'])).toEqual({ count: 2, words: '2 jobs sit on public property and are still on the lien path · $32,241 unpaid', action: 'Review them ›', jobIds: ['j883', 'j523'], addressIds: ['a1'] })
    expect(line(['j883', 'j523'], ['j883'])).toMatchObject({ count: 1, words: '1 job sits on public property and is still on the lien path · $2,918 unpaid', action: 'Review it ›' })
  })
  it('is null when no asking job has a paper open', () => {
    expect(line(['j883'], ['other'])).toBeNull()
    expect(line([], ['j883'])).toBeNull()
  })
})

describe('the window', () => {
  const sent = { kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }
  const missed = (m: string) => ({ kind: 'notice_53_056', status: 'missed', months: [m] })
  // The two jobs as they stood on 2026-11-16, with made-up names: 883 billed, 523 still being worked.
  const property = () =>
    buildLienPublicWindow({
      address: ' 100 Sample Rd, Sampletown ',
      ownerName: 'ZZ TEST CITY OF',
      jobs: [
        { jobId: 'a', number: '523', name: 'ZZ Test Hills', status: 'working', unpaid: 29323.4, papers: [missed('2026-06'), missed('2026-07'), missed('2026-08'), missed('2026-09')] },
        { jobId: 'b', number: '883', name: 'ZZ Test Drains', status: 'billed', unpaid: 2918.4, papers: [sent, { kind: 'affidavit', status: 'approved', approved_at: '2026-11-11T16:00:00Z' }] },
        // Paid long ago, no paper: never on the lien path, so not listed.
        { jobId: 'c', number: '200', name: 'ZZ Test Old Job', status: 'paid', unpaid: 0, papers: [] },
        // Paid, but a paper sits on it: listed, unticked, and it says why it does not go on the list.
        { jobId: 'd', number: '310', name: 'ZZ Test Paid', status: 'paid', unpaid: 0, papers: [sent] },
      ],
    })

  it('lists the jobs that owe money or have a paper, the most money first, with what went out, and fills the reason in', () => {
    const w = property()
    expect(w.title).toBe('Take this property off the lien path?')
    expect(w.sub).toBe('100 Sample Rd, Sampletown · owner of record ZZ TEST CITY OF')
    expect(w.jobs.map((j) => [j.label, j.unpaidWords, j.wentOut, j.ticked])).toEqual([
      ['523 · ZZ Test Hills', '$29,323', 'No lien paper has gone out. Four months were missed.', true],
      ['883 · ZZ Test Drains', '$2,918', 'A lien notice was mailed Oct 8. An affidavit was approved Nov 11 and not filed.', true],
      ['310 · ZZ Test Paid', '$0', 'A lien notice was mailed Oct 8.', false],
    ])
    expect(w.reason).toBe('Public property. The owner of record is ZZ TEST CITY OF. A mechanic’s lien does not attach.')
    expect(lienPublicDefaultReason(' ')).toBe('Public property. A mechanic’s lien does not attach.')
  })

  it('names, before the press, a job the Collections flag will hold, and says it still leaves the lien path', () => {
    const w = property()
    expect(w.jobs.map((j) => j.listNote)).toEqual([
      '523 is still being worked, so it cannot go on the Collections list yet. It still leaves the lien path.',
      null,
      '310 is paid, so it does not go on the Collections list. It still leaves the lien path.',
    ])
    expect(lienPublicListNote('9', 'waiting')).toBe('9 has not started, so it cannot go on the Collections list yet. It still leaves the lien path.')
    expect(lienPublicListNote('9', 'ready_to_bill')).toBe('9 is not billed yet, so it cannot go on the Collections list yet. It still leaves the lien path.')
    expect(lienPublicListNote('9', 'billed')).toBeNull()
    expect(lienPublicListNote('9', null)).toBeNull()
    expect(lienPublicWindowListsJob({ unpaid: 0.4, papers: [] })).toBe(false)
    expect(lienPublicWindowListsJob({ unpaid: 0, papers: [{ kind: 'notice_53_056', status: 'missed', voided_at: '2026-10-01T00:00:00Z' }] })).toBe(false)
  })

  it('says what the press does: every listed job leaves, a ticked billed job goes to the attorney', () => {
    const w = property()
    const ticked = (...ids: string[]) => new Set(ids)
    expect(lienPublicPressDoes(w.jobs, ticked('a', 'b'))).toEqual([
      'All 3 jobs leave the lien bins. Nothing is filed and nothing is deleted.',
      'Every job at this address, now and later, stays off the lien path.',
      '883 goes on the attorney’s list for a bond claim, with what already went out.',
    ])
    const two = w.jobs.slice(0, 2)
    expect(lienPublicPressDoes(two, ticked('a', 'b'))[0]).toBe('Both jobs leave the lien bins. Nothing is filed and nothing is deleted.')
    expect(lienPublicPressDoes(two, ticked())[2]).toBe('No job goes on the attorney’s list.')
    const billed = [{ jobId: 'x', number: '1', listNote: null }, { jobId: 'y', number: '2', listNote: null }]
    expect(lienPublicPressDoes(billed, ticked('x', 'y'))[2]).toBe('Both go on the attorney’s list for a bond claim, with what already went out.')
    expect(lienPublicPressDoes([...billed, { jobId: 'z', number: '3', listNote: null }], ticked('x', 'y', 'z'))[2]).toBe('1, 2 and 3 go on the attorney’s list for a bond claim, with what already went out.')
    expect(lienPublicPressDoes([billed[0]!], ticked('x'))[0]).toBe('The job leaves the lien bins. Nothing is filed and nothing is deleted.')
    expect(lienPublicPressDoes([], ticked())[0]).toBe('No job here is on the lien path.')
  })

  it('labels the press with the act and its count', () => {
    expect(lienPublicPressLabel(2)).toBe('Take 2 jobs off the lien path ▸')
    expect(lienPublicPressLabel(1)).toBe('Take 1 job off the lien path ▸')
    expect(lienPublicPressLabel(0)).toBe('Take this property off the lien path ▸')
    expect(lienPublicBackLabel(2)).toBe('Put 2 jobs back on the lien path ▸')
    expect(lienPublicBackLabel(0)).toBe('Put this property back on the lien path ▸')
  })

  it('after the press: the property is off the path, the listed jobs, and each held job with the function’s reason', () => {
    const numberOf = (id: string) => ({ a: '523', b: '883' })[id] ?? id
    const words = lienPublicPressWords(
      [
        { job_id: 'b', bond_set: false, on_attorney_list: true, already_on_list: false, held: null },
        { job_id: 'a', bond_set: false, on_attorney_list: false, already_on_list: false, held: 'Job must be in Billed Awaiting Payment to change Collections' },
      ],
      numberOf,
    )
    expect(words).toEqual({
      line: 'The property is off the lien path. 883 is on the attorney’s list. 523 did not go on it.',
      tone: 'warning',
      head: 'This job did not go on the attorney’s list. It left the lien path all the same.',
      held: [{ jobId: 'a', number: '523', reason: 'Job must be in Billed Awaiting Payment to change Collections' }],
    })
    expect(lienPublicPressWords([{ job_id: 'b', bond_set: true, on_attorney_list: true, already_on_list: true, held: null }], numberOf)).toEqual({ line: 'The property is off the lien path. 883 is on the attorney’s list.', tone: 'success', head: null, held: [] })
    expect(lienPublicPressWords([], numberOf).line).toBe('The property is off the lien path.')
  })

  it('says how a record was answered', () => {
    expect(lienPublicAnsweredWords('public', '2026-11-16T18:00:00Z')).toBe('Public property, answered Nov 16. Every job here is off the lien path.')
    expect(lienPublicAnsweredWords('private', null)).toBe('Not public property. Its lien papers can go out.')
  })
  it('writes the attorney’s note from the reason and what went out', () => {
    expect(lienPublicAttorneyNote(' Public property. ', 'A lien notice was mailed Oct 8.')).toBe('Public property. A lien notice was mailed Oct 8.')
  })
  it('reads the press’s answer: what went on the list, and each job it held with the reason', () => {
    const outcome = lienPublicPressOutcome(
      [
        { job_id: 'a', bond_set: true, on_attorney_list: true, already_on_list: false, held: null },
        { job_id: 'b', bond_set: true, on_attorney_list: false, already_on_list: false, held: 'Job must be in Billed Awaiting Payment to change Collections' },
        { job_id: null, bond_set: false, on_attorney_list: false, already_on_list: false, held: 'No job was named' },
      ],
      (id) => (id === 'b' ? '883 · ZZ Test Drains' : id),
    )
    expect(outcome.done).toBe(1)
    expect(outcome.held).toEqual([
      { label: '883 · ZZ Test Drains', reason: 'Job must be in Billed Awaiting Payment to change Collections' },
      { label: 'A job', reason: 'No job was named' },
    ])
  })
})
