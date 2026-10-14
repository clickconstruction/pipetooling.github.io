import { describe, expect, it } from 'vitest'
import { lienCalendarAxis, lienCalendarGroupFlags, lienCalendarMarks, type LienCalendarJob, type LienCalendarMark } from './lienCalendar'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import { plainWordsFailures } from '../plainWords'
import { NO_DOORS, clusterByPct, daysWords, deadlineTone, kindWords, lienGroupFlagCards, lienGroupWordCard, lienMarkCard, lienMarkClusters, monthName, payVersusLien, type LienMarkDoors } from './lienMarkCards'

// Today is 2026-09-28 throughout, the calendar tests' clock.
const TODAY = '2026-09-28'
function runway(over: Partial<LienRunwayInput> = {}) {
  return buildLienPayRunway({ todayYmd: TODAY, openBalance: 1000, lastWorkYmd: '2026-08-12', propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, ...over })
}
function job(over: Partial<LienCalendarJob> & { r?: Partial<LienRunwayInput> } = {}): LienCalendarJob {
  const { r, ...rest } = over
  const isSub = rest.isSub ?? Boolean(rest.gcId)
  return { jobId: 'j', number: '1046 PLUM', name: 'Pretest', customer: 'Randolph Field Reality', gcId: null, gcName: null, address: '214 Beechwood Ave', openBalance: 1000, isSub, runway: runway({ isSub, openBalance: rest.openBalance ?? 1000, ...r }), ...rest }
}
const RMC = { gcId: 'gc-rmc', gcName: 'RMC · Dudley Mason' }
const ALL: LienMarkDoors = { pen: true, lastWork: true, record: true, kinds: true, draft: true }

function marksOf(j: LienCalendarJob, rows: LienCalendarJob[] = [j]) {
  const axis = lienCalendarAxis(rows, TODAY)
  return { axis, marks: lienCalendarMarks(j, axis) }
}
function mark(j: LienCalendarJob, kind: LienCalendarMark['kind'], pick: (m: LienCalendarMark) => boolean = () => true): LienCalendarMark {
  const m = marksOf(j).marks.find((x) => x.kind === kind && pick(x))
  if (!m) throw new Error(`no ${kind} mark`)
  return m
}

describe('daysWords / deadlineTone / monthName', () => {
  it('reads a date against today in a person’s words', () => {
    expect(daysWords(TODAY, '2026-09-28')).toBe('today')
    expect(daysWords(TODAY, '2026-09-29')).toBe('tomorrow')
    expect(daysWords(TODAY, '2026-09-27')).toBe('yesterday')
    expect(daysWords(TODAY, '2026-10-15')).toBe('in 17 days')
    expect(daysWords(TODAY, '2026-09-08')).toBe('20 days ago')
  })
  it('a deadline is red inside a week or past, amber inside three, grey beyond', () => {
    expect(deadlineTone(TODAY, '2026-09-20')).toBe('red')
    expect(deadlineTone(TODAY, '2026-10-05')).toBe('red')
    expect(deadlineTone(TODAY, '2026-10-15')).toBe('amber')
    expect(deadlineTone(TODAY, '2026-11-16')).toBe('grey')
  })
  it('names a month alone in this year and with its year otherwise', () => {
    expect(monthName('2026-08', TODAY)).toBe('August')
    expect(monthName('2025-12', TODAY)).toBe('December 2025')
    expect(monthName(null, TODAY)).toBe('the last work month')
  })
})

describe('lienMarkCard', () => {
  it('a notice owed: the month, send by with the days, the owner and the GC, the money, Draft the notice', () => {
    const j = job({ ...RMC, openBalance: 9800 })
    const c = lienMarkCard(mark(j, 'notice'), j, TODAY, NO_DOORS)
    expect(c.glyph).toBe('notice')
    expect(c.title).toBe('Notice owed · August')
    expect(c.when).toBe('Send by Oct 15 · in 17 days')
    expect(c.whenTone).toBe('amber')
    expect(c.facts).toEqual(['A § 53.056 notice for August’s work. It goes to the owner and the GC.', '$9,800 is owed on this job.'])
    expect(c.door).toEqual({ kind: 'lien_window', label: 'Draft the notice ›' })
    expect(c.pct).toBeGreaterThan(0)
  })
  it('a notice on file, and one in the mail with Record the mailing when the desk has the door', () => {
    const j = job({ ...RMC, r: { workMonths: ['2026-07', '2026-08'], noticedMonths: ['2026-07'], mailedMonths: ['2026-08'] } })
    const done = lienMarkCard(mark(j, 'notice', (m) => m.kind === 'notice' && m.done), j, TODAY, ALL)
    expect(done.glyph).toBe('notice_done')
    expect(done.title).toBe('Notice on file · July')
    expect(done.facts[0]).toBe('July’s § 53.056 notice is recorded.')
    const mailed = lienMarkCard(mark(j, 'notice', (m) => m.kind === 'notice' && m.mailed), j, TODAY, ALL)
    expect(mailed.glyph).toBe('mailed')
    expect(mailed.title).toBe('In the mail · August')
    expect(mailed.when).toBe('Record the number by Oct 15 · in 17 days')
    expect(mailed.door).toEqual({ kind: 'record', label: 'Record the mailing ›', jobIds: ['j'] })
    expect(lienMarkCard(mark(j, 'notice', (m) => m.kind === 'notice' && m.mailed), j, TODAY, NO_DOORS).door?.kind).toBe('lien_window')
  })
  it('the lien flag: file by with the days, counted from the work month on the property’s kind, the money', () => {
    const house = job({ openBalance: 5724 })
    const c = lienMarkCard(mark(house, 'lien'), house, TODAY, NO_DOORS)
    expect(c.title).toBe('Lien deadline')
    expect(c.when).toBe('File by Nov 16 · in 49 days')
    expect(c.whenTone).toBe('grey')
    expect(c.facts).toEqual(['The last day to file the lien affidavit with the county, § 53.052.', 'Counted from August’s work on a house.', '$5,724 is owed on this job.'])
    const commercial = job({ r: { propertyKind: 'non_residential' } })
    expect(kindWords(commercial)).toBe('a commercial building')
    const unset = job({ r: { propertyKind: '' } })
    expect(kindWords(unset)).toBe('a property with no kind, read as a house')
    // a filed lien draws no flag: the row ends at its work tick
    const filed = job({ r: { filedYmd: '2026-09-10' } })
    expect(marksOf(filed).marks.map((m) => m.kind)).toEqual(['work'])
  })
  it('a dead row: the closed flag and the grey wash both read Lien gone, the window that shut and the money still owed', () => {
    const j = job({ ...RMC, openBalance: 658, r: { lastWorkYmd: '2026-03-01' } })
    const flag = lienMarkCard(mark(j, 'lien'), j, TODAY, ALL)
    const wash = lienMarkCard(mark(j, 'gone'), j, TODAY, ALL)
    expect(flag.title).toBe('Lien gone')
    expect(flag.when).toBe('Closed May 15 · 136 days ago')
    expect(flag.facts).toEqual(['The § 53.056 notice was due May 15 and none is recorded.', 'Nothing can be filed after that day.', '$658 is still owed. Collections or the Legal desk can chase it.'])
    expect(wash.facts).toEqual(flag.facts)
    expect(wash.pct).toBeNull()
  })
  it('the pay dot reads the date against the lien flag; the pen is its door when the office has one', () => {
    const room = job({ r: { expectedPayYmd: '2026-09-30' } })
    const c = lienMarkCard(mark(room, 'pay'), room, TODAY, ALL)
    expect(c.title).toBe('Pay date they gave')
    expect(c.when).toBe('Sep 30 · in 2 days')
    expect(c.whenTone).toBe('green')
    expect(c.facts[0]).toBe('That leaves 47 days of room before the lien flag.')
    expect(c.door).toEqual({ kind: 'pen', label: 'Change it ›' })
    expect(lienMarkCard(mark(room, 'pay'), room, TODAY, NO_DOORS).door?.kind).toBe('lien_window')
    const late = job({ r: { expectedPayYmd: '2026-11-20' } })
    expect(lienMarkCard(mark(late, 'pay'), late, TODAY, ALL).facts[0]).toBe('That is 4 days after the lien flag. File first.')
    expect(payVersusLien('2026-11-16', '2026-11-16', TODAY).text).toBe('That is the lien day itself. File first.')
    expect(payVersusLien('2026-09-01', '2026-11-16', TODAY).text).toBe('That day has passed and the money is not in.')
    const missing = job()
    const m = lienMarkCard(mark(missing, 'pay_missing'), missing, TODAY, ALL)
    expect(m.title).toBe('No pay date yet')
    expect(m.door).toEqual({ kind: 'pen', label: 'Record what they said ›' })
  })
  it('the run says the gap in days each way; the bracket names both dates and offers Set the kind', () => {
    const room = job({ r: { expectedPayYmd: '2026-09-30' } })
    const r = lienMarkCard(mark(room, 'run'), room, TODAY, ALL)
    expect(r.title).toBe('Room')
    expect(r.facts[0]).toBe('The money is expected Sep 30, 47 days before the lien flag on Nov 16.')
    const short = job({ r: { expectedPayYmd: '2026-11-20' } })
    const s = lienMarkCard(mark(short, 'run'), short, TODAY, ALL)
    expect(s.title).toBe('File first')
    expect(s.facts[0]).toBe('The lien window closes Nov 16, 4 days before the money is expected on Nov 20.')
    const unset = job({ r: { propertyKind: '' } })
    const b = lienMarkCard(mark(unset, 'bracket'), unset, TODAY, ALL)
    expect(b.title).toBe('Kind not set')
    expect(b.facts[0]).toBe('The board shows the house date, Nov 16. A commercial building would be Dec 15.')
    expect(b.door).toEqual({ kind: 'kinds', label: 'Set the kind ›' })
    expect(lienMarkCard(mark(unset, 'bracket'), unset, TODAY, NO_DOORS).door).toBeNull()
  })
  it('the work tick names the month the flags count from; the creation stand-in says it is a stand-in', () => {
    const worked = job()
    const w = lienMarkCard(mark(worked, 'work'), worked, TODAY, ALL)
    expect(w.title).toBe('Last day worked')
    expect(w.when).toBe('Aug 12 · 47 days ago')
    expect(w.facts[0]).toBe('The lien flag counts from August. Each notice flag counts from its own month.')
    expect(w.door).toEqual({ kind: 'last_work', label: 'Change the last day ›' })
    const made = job({ r: { lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z' } })
    const c = lienMarkCard(mark(made, 'work'), made, TODAY, NO_DOORS)
    expect(c.glyph).toBe('work_hollow')
    expect(c.title).toBe('No approved hours')
    expect(c.facts[0]).toBe('The board counts from the month the job was created, August.')
    expect(c.door).toBeNull()
  })
  it('every fact on every card is plain words', () => {
    const jobs = [
      job({ ...RMC, r: { workMonths: ['2026-07', '2026-08'], noticedMonths: ['2026-07'], mailedMonths: ['2026-08'] } }),
      job({ r: { expectedPayYmd: '2026-09-30' } }),
      job({ r: { expectedPayYmd: '2026-11-20', propertyKind: '' } }),
      job({ ...RMC, r: { lastWorkYmd: '2026-03-01' } }),
      job({ r: { lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z' } }),
      job({ r: { filedYmd: '2026-09-10' } }),
    ]
    const failures: string[] = []
    for (const j of jobs) for (const m of marksOf(j).marks) for (const f of lienMarkCard(m, j, TODAY, ALL).facts) failures.push(...plainWordsFailures(f))
    for (const f of lienGroupWordCard({ name: 'RMC', jobs }, null, TODAY, true).facts) failures.push(...plainWordsFailures(f))
    expect(failures).toEqual([])
  })
})

describe('lienMarkClusters', () => {
  it('chains points that touch, left to right, and leaves the areas out', () => {
    const marks: LienCalendarMark[] = [
      { kind: 'work', pct: 10, ymd: '2026-08-12', offAxis: false, fromCreation: false, label: 'Aug 12' },
      { kind: 'run', fromPct: 30, toPct: 60, short: false },
      { kind: 'pay', pct: 30, ymd: '2026-09-30' },
      { kind: 'notice', pct: 31, ymd: '2026-10-15', done: false, mailed: false, monthKey: '2026-08', tone: 'amber' },
      { kind: 'lien', pct: 60, ymd: '2026-11-16', tone: 'grey', closed: false },
    ]
    expect(lienMarkClusters(marks, 1.5)).toEqual([
      { key: '0', pct: 10, indexes: [0] },
      { key: '2-3', pct: 30, indexes: [2, 3] },
      { key: '4', pct: 60, indexes: [4] },
    ])
    expect(lienMarkClusters(marks, 0.5).map((c) => c.key)).toEqual(['0', '2', '3', '4'])
  })
  it('a chain runs on: three marks a step apart are one cluster even when the ends are far', () => {
    expect(clusterByPct([{ index: 0, pct: 10 }, { index: 1, pct: 11 }, { index: 2, pct: 12 }], 1).map((c) => c.indexes)).toEqual([[0, 1, 2]])
    expect(clusterByPct([], 1)).toEqual([])
  })
})

describe('lienGroupFlagCards / lienGroupWordCard', () => {
  it('a GC row’s folded flag lists the jobs behind each count, sums them and offers the bar’s door for exactly those jobs', () => {
    const rows = [
      job({ jobId: 'a', number: '890', name: 'Rizvi', ...RMC, openBalance: 9800 }),
      job({ jobId: 'b', number: '881', name: 'Umar', ...RMC, openBalance: 7902 }),
      job({ jobId: 'c', number: '258', name: 'Dudley', ...RMC, openBalance: 285, r: { mailedMonths: ['2026-08'] } }),
    ]
    const axis = lienCalendarAxis(rows, TODAY)
    const flags = lienCalendarGroupFlags({ jobs: rows }, axis)
    const oct = flags.find((f) => f.ymd === '2026-10-15')!
    const cards = lienGroupFlagCards(oct, { jobs: rows, kind: 'gc' }, axis, TODAY, ALL)
    expect(cards.map((c) => c.title)).toEqual(['2 notices owed', '1 in the mail'])
    expect(cards[0]!.when).toBe('Send by Oct 15 · in 17 days')
    expect(cards[0]!.jobs).toEqual([
      { jobId: 'a', number: '890', name: 'Rizvi', month: 'August', money: 9800 },
      { jobId: 'b', number: '881', name: 'Umar', month: 'August', money: 7902 },
    ])
    expect(cards[0]!.facts).toEqual(['$17,702 across the 2.'])
    expect(cards[0]!.door).toEqual({ kind: 'draft', label: 'Draft the 2 ›', ymd: '2026-10-15', jobIds: ['a', 'b'] })
    expect(cards[1]!.door).toEqual({ kind: 'record', label: 'Record the mailing ›', jobIds: ['c'] })
    const nov = flags.find((f) => f.ymd === '2026-11-16')!
    const liens = lienGroupFlagCards(nov, { jobs: rows, kind: 'gc' }, axis, TODAY, NO_DOORS)
    expect(liens.map((c) => c.title)).toEqual(['3 liens to file'])
    expect(liens[0]!.jobs.map((j) => j.number)).toEqual(['890', '881', '258'])
    expect(liens[0]!.door).toBeNull()
    expect(lienGroupFlagCards(oct, { jobs: rows, kind: 'gc' }, axis, TODAY, NO_DOORS).map((c) => c.door)).toEqual([null, null])
  })
  it('the GC’s word: one date for every job, or none yet; the pen is its door for the office', () => {
    const g = { name: 'Burd & Assoc.', jobs: [job({ jobId: 'a' }), job({ jobId: 'b' }), job({ jobId: 'c' })] }
    const said = lienGroupWordCard(g, '2026-10-20', TODAY, true)
    expect(said.title).toBe('Burd & Assoc. said Oct 20')
    expect(said.when).toBe('Oct 20 · in 22 days')
    expect(said.facts).toEqual(['One word for all 3 jobs.'])
    expect(said.door).toEqual({ kind: 'pen', label: 'Change it ›' })
    const none = lienGroupWordCard(g, null, TODAY, false)
    expect(none.title).toBe('No pay date yet')
    expect(none.facts[0]).toBe('No one date for Burd & Assoc.’s 3 jobs yet.')
    expect(none.door).toBeNull()
  })
})
