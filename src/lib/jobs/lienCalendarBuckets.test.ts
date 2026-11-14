import { describe, expect, it } from 'vitest'
import type { LienCalendarJob } from './lienCalendar'
import { buildLienCalendarBoard, lienBucketOf, lienGroupRows, lienNextDate, lienNextDateCounts, lienPhoneLine, lienPropertyTally, lienSameProperty, lienWorkedLaterLabel } from './lienCalendarBuckets'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'

// Today is Thursday 2026-10-01 unless a test says otherwise: Oct 15 is 14 days out, Nov 16 46, Dec 15 75.
const TODAY = '2026-10-01'

function job(over: Partial<LienCalendarJob> & { r?: Partial<LienRunwayInput> } = {}): LienCalendarJob {
  const { r, ...rest } = over
  const isSub = rest.isSub ?? Boolean(rest.gcId)
  return {
    jobId: 'j',
    number: '1046 PLUM',
    name: 'Pretest',
    customer: 'Randolph Field Reality',
    gcId: null,
    gcName: null,
    // Each job at its own street number: jobs at one property are a case of their own (v2.4526).
    address: `${(rest.jobId ?? 'j').charCodeAt(0)} Beechwood Ave`,
    openBalance: 1000,
    isSub,
    runway: buildLienPayRunway({ todayYmd: TODAY, openBalance: rest.openBalance ?? 1000, lastWorkYmd: '2026-08-12', propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub, ...r }),
    ...rest,
  }
}

const RLC = { gcId: 'gc-rlc', gcName: 'RLC · Dunmere Mallin' }
const KESTRIN = { gcId: 'gc-kestrin', gcName: 'Kestrin Contracting' }

const ROWS = [
  // This month: four notices due Oct 15 across three GCs
  job({ jobId: 'a', name: 'Dunmere Mallin', ...RLC, openBalance: 9800 }),
  job({ jobId: 'b', name: 'Service Visit', ...RLC, openBalance: 7902, r: { lastWorkYmd: '2026-08-20', propertyKind: '' } }),
  job({ jobId: 'c', name: 'Stonewick', ...KESTRIN, openBalance: 15406, r: { lastWorkYmd: '2026-08-05' } }),
  // worked June to September on a commercial job: July's notice is the next date, not the Jan 15 lien
  job({ jobId: 'k', name: 'Tune 5- Seguin', gcId: 'gc-sp', gcName: 'Southern Pine Construction', openBalance: 38625, r: { propertyKind: 'non_residential', lastWorkYmd: '2026-09-21', workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'] } }),
  // Next month: a notice and a lien, both Nov 16
  job({ jobId: 'd', name: 'Water Heater removal', gcId: 'gc-hi', gcName: 'B & D Construction', openBalance: 350, r: { lastWorkYmd: '2026-09-03' } }),
  job({ jobId: 'e', name: 'Mike Holmby', openBalance: 5724, r: { expectedPayYmd: '2026-09-30' } }),
  // Later: liens Dec 15 and Jan 15, and a lien on file
  job({ jobId: 'f', name: 'Corl Trim', openBalance: 900, r: { lastWorkYmd: '2026-09-10' } }),
  job({ jobId: 'g', name: 'AXO Schertz', openBalance: 1400, r: { lastWorkYmd: '2026-09-10', propertyKind: 'non_residential' } }),
  job({ jobId: 'j', name: 'Filed one', openBalance: 2000, r: { filedYmd: '2026-09-03' } }),
  // A late notice (v2.7198, punch list #335, row 4): July's notice was due Sep 15 and never sent, and the affidavit can still be
  // filed by Oct 15, so the job is due this month, not overdue.
  job({ jobId: 'h', name: 'Dunmere Mallin', ...RLC, openBalance: 285, r: { lastWorkYmd: '2026-07-10' } }),
  // Overdue: May's lien window closed Aug 17
  job({ jobId: 'i', name: 'Samantha Coyle', openBalance: 5355, r: { lastWorkYmd: '2026-05-05' } }),
  // nothing open: not on the board
  job({ jobId: 'z', name: 'Paid', openBalance: 0 }),
]

const ids = (jobs: ReadonlyArray<{ jobId: string }>) => jobs.map((j) => j.jobId)

describe('each job counted once, at its next date', () => {
  const byId = new Map(ROWS.map((j) => [j.jobId, j]))
  it('the next date is the notice owed, else the lien date; none once the window closed or the lien is filed', () => {
    expect(lienNextDate(byId.get('a')!)).toEqual({ ymd: '2026-10-15', what: 'notice' })
    expect(lienNextDate(byId.get('k')!)).toEqual({ ymd: '2026-10-15', what: 'notice' })
    expect(byId.get('k')!.runway.lienByYmd).toBe('2027-01-15')
    expect(lienNextDate(byId.get('e')!)).toEqual({ ymd: '2026-11-16', what: 'lien' })
    // A late notice is due by the lien's own day; it read null, as a closed window, until v2.7198 (punch list #335, row 4).
    expect(lienNextDate(byId.get('h')!)).toEqual({ ymd: '2026-10-15', what: 'late_notice' })
    expect(lienNextDate(byId.get('i')!)).toBeNull()
    expect(lienNextDate(byId.get('j')!)).toBeNull()
  })
  it('lands in the month its next date falls in', () => {
    expect(ROWS.map((j) => [j.jobId, lienBucketOf(j, TODAY)])).toEqual([
      ['a', 'this_month'],
      ['b', 'this_month'],
      ['c', 'this_month'],
      ['k', 'this_month'],
      ['d', 'next_month'],
      ['e', 'next_month'],
      ['f', 'later'],
      ['g', 'later'],
      ['j', 'later'],
      ['h', 'this_month'],
      ['i', 'overdue'],
      ['z', null],
    ])
  })
  it('the four buckets add up to the board: no job twice', () => {
    const board = buildLienCalendarBoard(ROWS, '', TODAY)
    expect(board.buckets.map((b) => b.key)).toEqual(['overdue', 'this_month', 'next_month', 'later'])
    expect(board.buckets.map((b) => b.jobs.length)).toEqual([1, 5, 2, 3])
    expect(board.count).toBe(11)
    expect(board.buckets.reduce((s, b) => s + b.total, 0)).toBe(board.total)
    expect(board.total).toBe(87747)
    const seen = board.buckets.flatMap((b) => ids(b.jobs))
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('what each bucket says', () => {
  const board = buildLienCalendarBoard(ROWS, '', TODAY)
  const [overdue, thisMonth, nextMonth, later] = board.buckets
  it('This month: one date, the days to it, the notices and their GCs, and the door to draft them', () => {
    expect(thisMonth).toMatchObject({ title: 'This month', dateLabel: 'Oct 15', total: 72018, notices: 4, lateNotices: 1, liens: 0, dates: ['2026-10-15'] })
    expect(thisMonth!.facts).toBe('by Oct 15 · in 14 days · 4 notices across 3 GCs · 1 late notice')
    // v2.7254: the band draws the date as a pill and the count at its right, so its summary is the rest
    expect(thisMonth!.datePill).toBe('by Oct 15 · in 14 days')
    expect(thisMonth!.summary).toBe('4 notices across 3 GCs · 1 late notice')
    // tightest first, then the bigger balance
    expect(thisMonth!.draft).toEqual({ ymd: '2026-10-15', jobIds: ['k', 'c', 'a', 'b'], label: 'Draft the 4' })
    expect(thisMonth!.groups.map((g) => g.name)).toEqual(['Southern Pine Construction', 'RLC · Dunmere Mallin', 'Kestrin Contracting'])
    // the bar names the date, so a GC row under it says only what to send
    expect(thisMonth!.groups.map((g) => g.word)).toEqual(['send the notice', 'send 2 notices', 'send the notice'])
  })
  it('a GC row keeps its own date when its bucket holds more than one', () => {
    const rows = [
      job({ jobId: 'oct', ...RLC, r: { lastWorkYmd: '2026-10-01' } }),
      job({ jobId: 'oct-c', ...RLC, r: { lastWorkYmd: '2026-10-01', propertyKind: 'non_residential' } }),
    ]
    const later = buildLienCalendarBoard(rows, '', TODAY).buckets[3]!
    expect(later.dates).toEqual(['2026-12-15', '2027-01-15'])
    expect(later.groups[0]!.word).toBe('send 2 notices by Dec 15 · 75 d')
  })
  it('Next month: a notice to one GC and a lien to file; no door while the desk does not list them yet', () => {
    expect(nextMonth!.facts).toBe('by Nov 16 · in 46 days · 1 notice to B & D Construction · 1 lien to file')
    expect(nextMonth!.dateLabel).toBe('Nov 16')
    expect(nextMonth!.draft).toBeNull()
  })
  it('Later: more than one date reads "and after"; a filed lien waits here', () => {
    expect(later!.facts).toBe('Dec 15 and after · 2 liens to file · 1 lien filed')
    expect(later!.datePill).toBe('Dec 15 and after')
    expect(later!.summary).toBe('2 liens to file · 1 lien filed')
    expect(later!.dateLabel).toBe('Dec 15 +')
    expect(later!.dates).toEqual(['2026-12-15', '2027-01-15'])
    expect(ids(later!.jobs)).toEqual(['f', 'g', 'j'])
  })
  it('Overdue: the closed windows, one lien-gone group, no door', () => {
    expect(overdue).toMatchObject({ title: 'Overdue', dateLabel: '', total: 5355, draft: null, lateNotices: 0 })
    expect(overdue!.facts).toBe('1 job · nothing left to file · money still owed')
    expect(overdue!.datePill).toBe('')
    expect(overdue!.summary).toBe('nothing left to file · money still owed')
    expect(overdue!.groups.map((g) => g.kind)).toEqual(['gone'])
  })
  it('each bucket covers its stretch of the axis', () => {
    expect(board.buckets.map((b) => b.span)).toEqual([
      { fromYmd: null, toYmd: '2026-10-01' },
      { fromYmd: '2026-10-01', toYmd: '2026-11-01' },
      { fromYmd: '2026-11-01', toYmd: '2026-12-01' },
      { fromYmd: '2026-12-01', toYmd: null },
    ])
  })
  it('counts the property kinds not set, and the date row counts each job once', () => {
    expect(board.kindsUnset).toBe(1)
    const counts = lienNextDateCounts(board.buckets)
    expect([...counts.values()].map((c) => [c.ymd, c.jobs, c.notices, c.liens])).toEqual([
      // The late notice counts with the notices on its day, which is the lien's own (v2.7198, punch list #335, row 4).
      ['2026-10-15', 5, 5, 0],
      ['2026-11-16', 2, 1, 1],
      ['2026-12-15', 1, 0, 1],
      ['2027-01-15', 1, 0, 1],
    ])
    expect(counts.get('2026-10-15')!.total).toBe(72018)
  })
  it('search narrows every bucket', () => {
    const kestrin = buildLienCalendarBoard(ROWS, 'kestrin', TODAY)
    expect(kestrin.buckets.map((b) => ids(b.jobs))).toEqual([[], ['c'], [], []])
    expect(kestrin.count).toBe(1)
    expect(kestrin.buckets[1]!.facts).toBe('by Oct 15 · in 14 days · 1 notice to Kestrin Contracting')
    expect(kestrin.buckets[1]!.draft?.label).toBe('Draft the one')
  })
})

describe('a phone row’s line', () => {
  const byId = new Map(ROWS.map((j) => [j.jobId, j]))
  it('says the dates; keeps file first and the day a lien died', () => {
    expect(lienPhoneLine(byId.get('a')!)).toBe('notice by Oct 15 · lien by Nov 16')
    expect(lienPhoneLine(byId.get('e')!)).toBe('pay was due Sep 30 · file lien by Nov 16')
    // A late notice says its dates like any job with a date ahead; a window closed for good keeps the day the lien died.
    expect(lienPhoneLine(byId.get('h')!)).toBe('send the late notice by Oct 15')
    expect(lienPhoneLine(byId.get('i')!)).toBe('lien gone · window closed Aug 17')
    expect(lienPhoneLine(byId.get('j')!)).toBe('lien filed Sep 3')
    const late = job({ jobId: 'ff', r: { expectedPayYmd: '2026-12-01' } })
    expect(lienPhoneLine(late)).toBe('file lien by Nov 16 → pay Dec 1 · file first')
  })
})

describe('late in the month and across the new year', () => {
  it('after the 15th This month is empty and says so; next month’s notices are inside the desk’s 30 days', () => {
    const OCT_20 = '2026-10-20'
    const rows = [
      job({ jobId: 'd', ...RLC, r: { todayYmd: OCT_20, lastWorkYmd: '2026-09-03' } }),
      job({ jobId: 'e', r: { todayYmd: OCT_20, lastWorkYmd: '2026-08-12' } }),
    ]
    const board = buildLienCalendarBoard(rows, '', OCT_20)
    const [overdue, thisMonth, nextMonth] = board.buckets
    expect(thisMonth!.jobs).toEqual([])
    expect(thisMonth!.empty).toBe('Nothing else falls due in October.')
    expect(thisMonth!.facts).toBe('')
    expect(overdue!.empty).toBe('No lien window has closed on a billed job.')
    expect(nextMonth!.facts).toBe('by Nov 16 · in 27 days · 1 notice to RLC · Dunmere Mallin · 1 lien to file')
    expect(nextMonth!.draft).toEqual({ ymd: '2026-11-16', jobIds: ['d'], label: 'Draft the one' })
  })
  it('in December, next month is January of the next year', () => {
    const DEC_2 = '2026-12-02'
    const rows = [
      job({ jobId: 'dec', r: { todayYmd: DEC_2, lastWorkYmd: '2026-09-10' } }),
      job({ jobId: 'jan', ...RLC, r: { todayYmd: DEC_2, lastWorkYmd: '2026-11-03' } }),
      job({ jobId: 'feb', r: { todayYmd: DEC_2, lastWorkYmd: '2026-11-03' } }),
    ]
    const board = buildLienCalendarBoard(rows, '', DEC_2)
    expect(board.buckets.map((b) => ids(b.jobs))).toEqual([[], ['dec'], ['jan'], ['feb']])
    expect(board.buckets[2]!.span).toEqual({ fromYmd: '2027-01-01', toYmd: '2027-02-01' })
    expect(board.buckets[2]!.facts).toBe('by Jan 15 · in 44 days · 1 notice to RLC · Dunmere Mallin')
    expect(board.buckets[3]!.empty).toBe('Nothing falls due after January.')
  })
})

describe('an overdue job is listed with its property (v2.4526)', () => {
  const TARROW = '628 Tarrow Rd, San Antonio, TX 78209'
  const LENOX = '9703 Lenox Hl San Antonio, TX 78240'
  const rows = [
    // RLC, notices due Oct 15: two at Lenox Hl, one at Tarrow Rd, one somewhere else
    job({ jobId: 'n1', number: '273', ...RLC, openBalance: 17585, address: LENOX }),
    job({ jobId: 'n2', number: '858', ...RLC, openBalance: 7902, address: '9703 Lenox Hl, San Antonio, TX' }),
    job({ jobId: 'n3', number: '867', ...RLC, openBalance: 1710, address: TARROW }),
    job({ jobId: 'n4', number: '868', ...RLC, openBalance: 2650, address: '1875 Co Rd 777, Devine, TX' }),
    // Overdue: one at Lenox Hl, two at Tarrow Rd, one at a property with nothing ahead. June's notice was due Aug 17 and
    // its affidavit Sep 15, both behind us, so the lien is gone (a July job would still owe a late notice by Oct 15).
    job({ jobId: 'o1', number: '881', ...RLC, openBalance: 1050, address: LENOX, r: { lastWorkYmd: '2026-06-10' } }),
    job({ jobId: 'o2', number: '226', ...RLC, openBalance: 650, address: TARROW, r: { lastWorkYmd: '2026-05-05' } }),
    job({ jobId: 'o3', number: '608', ...RLC, openBalance: 2245, address: '628 Tarrow Rd', r: { lastWorkYmd: '2026-06-10' } }),
    job({ jobId: 'o4', number: '186', ...RLC, openBalance: 6200, address: '574 Co Rd 660, Devine TX 78016', r: { lastWorkYmd: '2026-05-05' } }),
  ]
  const board = buildLienCalendarBoard(rows, '', TODAY)
  const [overdue, thisMonth] = board.buckets

  it('the counts and the money do not move', () => {
    expect(ids(overdue!.jobs).sort()).toEqual(['o1', 'o2', 'o3', 'o4'])
    expect(overdue!.total).toBe(1050 + 650 + 2245 + 6200)
    expect(ids(thisMonth!.jobs).sort()).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(thisMonth!.total).toBe(17585 + 7902 + 1710 + 2650)
    expect(thisMonth!.notices).toBe(4)
    expect(board.count).toBe(8)
  })

  it('Overdue lists only the job with nothing ahead at its property, and its bar says where the rest are', () => {
    expect(ids(overdue!.groups.flatMap((g) => g.jobs))).toEqual(['o4'])
    expect(overdue!.away).toBe(3)
    expect(overdue!.facts).toBe('4 jobs · 1 listed here · 3 are listed under This month')
    // Shown on its own, Overdue is whole again.
    expect(ids(overdue!.whole!.groups.flatMap((g) => g.jobs)).sort()).toEqual(['o1', 'o2', 'o3', 'o4'])
    expect(overdue!.whole!.facts).toBe('4 jobs · nothing left to file · money still owed')
  })

  it('the GC’s group clusters by property: its jobs with a date ahead, then the overdue ones, biggest first', () => {
    const g = thisMonth!.groups[0]!
    expect(thisMonth!.guests).toBe(3)
    // The group's own numbers are its notices only.
    expect(ids(g.jobs).sort()).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(g.total).toBe(17585 + 7902 + 1710 + 2650)
    expect(g.sub).toBe('GC · 4 jobs · 4 notices owed · 3 windows closed · 2 at one property')
    expect(lienGroupRows(g).map((r) => (r.kind === 'label' ? `# ${r.label}` : `${r.job.number}${r.closed ? ' closed' : ''}`))).toEqual([
      '# 9703 Lenox Hl San Antonio',
      '273',
      '858',
      '881 closed',
      '# 628 Tarrow Rd, San Antonio',
      '867',
      '608 closed',
      '226 closed',
      '# Other properties',
      '868',
    ])
  })

  it('a property’s heading says both piles and their sum, which the group’s total leaves out (v2.6849)', () => {
    const g = thisMonth!.groups[0]!
    const labels = lienGroupRows(g).flatMap((r) => (r.kind === 'label' ? [r] : []))
    const tarrow = labels.find((r) => r.label.startsWith('628 Tarrow'))!.tally!
    expect(tarrow.open).toEqual({ jobs: 1, total: 1710 })
    expect(tarrow.gone).toEqual({ jobs: 2, total: 2245 + 650 })
    expect(tarrow.owed).toBe(1710 + 2245 + 650)
    expect(tarrow.words).toBe('Lien open on 1 job · $1,710 · lien gone on 2 · $2,895 · $4,605 owed here')
    expect(tarrow.short).toBe('$1,710 lien open · $2,895 lien gone · $4,605 owed')
    expect(tarrow.title).toContain('2 more closed their windows')
    const lenox = labels.find((r) => r.label.startsWith('9703 Lenox'))!.tally!
    expect(lenox.words).toBe('Lien open on 2 jobs · $25,487 · lien gone on 1 · $1,050 · $26,537 owed here')
    expect(lenox.title).toContain('One more closed its window')
    // Nothing closed among the group's other properties: the rows already add up.
    expect(labels.find((r) => r.label === 'Other properties')!.tally).toBeNull()
    // The piles are the property's, so every tally's open money is part of the group's total and no gone money is.
    expect(g.total).toBe(tarrow.open.total + lenox.open.total + 2650)
  })

  it('a property with nothing closed has no tally, and the row’s press names the job', () => {
    expect(lienPropertyTally({ jobs: [job({ jobId: 'a' })], closed: [] })).toBeNull()
    expect(lienWorkedLaterLabel('608')).toBe('Worked later? Change the last day of work · 608')
  })

  it('a group that lists none draws its jobs as before', () => {
    const plain = buildLienCalendarBoard(ROWS, '', TODAY).buckets[1]!.groups[0]!
    expect(plain.byProperty).toBeUndefined()
    expect(lienGroupRows(plain).every((r) => r.kind === 'job' && !r.closed)).toBe(true)
  })

  it('follows the property to its earliest date, in whichever bucket that is', () => {
    const later = buildLienCalendarBoard(
      [
        job({ jobId: 'd1', gcId: 'gc-hi', gcName: 'B & D Construction', address: '12 Oak St, Seguin, TX', r: { lastWorkYmd: '2026-09-03' } }),
        job({ jobId: 'x1', openBalance: 400, address: '12 Oak St, Seguin, TX', r: { lastWorkYmd: '2026-05-05' } }),
      ],
      '',
      TODAY,
    )
    expect(later.buckets[0]!.facts).toBe('1 job · 0 listed here · 1 is listed under Next month')
    expect(later.buckets[0]!.summary).toBe('0 listed here · 1 is listed under Next month')
    // shown on its own, Overdue is whole again: its plain summary rides along
    expect(later.buckets[0]!.whole!.summary).toBe('nothing left to file · money still owed')
    expect(later.buckets[2]!.guests).toBe(1)
    expect(lienGroupRows(later.buckets[2]!.groups[0]!).map((r) => (r.kind === 'label' ? r.label : `${r.job.jobId}${r.closed ? ' closed' : ''}`))).toEqual(['12 Oak St, Seguin', 'd1', 'x1 closed'])
  })

  it('matches on the linked property record, the typed address, or one address cut short of the other', () => {
    const at = (address: string, addressId: string | null = null) => ({ address, addressId })
    expect(lienSameProperty(at('1 A St', 'addr-1'), at('somewhere else', 'addr-1'))).toBe(true)
    expect(lienSameProperty(at('9703 Lenox Hl San Antonio, TX 78240'), at('9703 Lenox Hl, San Antonio, TX'))).toBe(true)
    expect(lienSameProperty(at('628 Tarrow Rd'), at('628 Tarrow Rd, San Antonio, TX 78209'))).toBe(true)
    // A city alone is not a property, a number and one word is too little, and 62 is not 628.
    expect(lienSameProperty(at('San Antonio, TX'), at('San Antonio, TX'))).toBe(false)
    expect(lienSameProperty(at('12 Oak'), at('12 Oak St, Seguin, TX'))).toBe(false)
    expect(lienSameProperty(at('62 Tarrow Rd'), at('628 Tarrow Rd'))).toBe(false)
    // A filed lien has no date ahead, so it hosts nothing.
    const filed = buildLienCalendarBoard(
      [job({ jobId: 'f1', address: '5 Elm St', r: { filedYmd: '2026-09-03' } }), job({ jobId: 'x2', address: '5 Elm St', r: { lastWorkYmd: '2026-05-05' } })],
      '',
      TODAY,
    )
    expect(filed.buckets[0]!.away).toBe(0)
    expect(filed.buckets[0]!.whole).toBeNull()
  })
})

describe('Record the mailing (v2.5522)', () => {
  it('a printed notice leaves Draft the N for Record the mailing · N, the bar counts it, and the GC row under the bar says so', () => {
    const rows = [
      job({ jobId: 'a', name: 'Dunmere Mallin', ...RLC, openBalance: 9800 }),
      job({ jobId: 'p', name: 'Tune 5- Seguin', gcId: 'gc-sp', gcName: 'Southern Pine Construction', openBalance: 38625, r: { mailedMonths: ['2026-08'] } }),
      job({ jobId: 'q', name: 'Liberty Hill', gcId: 'gc-sp', gcName: 'Southern Pine Construction', openBalance: 6258, r: { mailedMonths: ['2026-08'] } }),
    ]
    const board = buildLienCalendarBoard(rows, '', TODAY)
    const thisMonth = board.buckets.find((b) => b.key === 'this_month')!
    expect(thisMonth.facts).toBe('by Oct 15 · in 14 days · 3 notices across 2 GCs · 2 in the mail')
    expect(thisMonth.draft).toEqual({ ymd: '2026-10-15', jobIds: ['a'], label: 'Draft the one' })
    expect(thisMonth.record).toEqual({ jobIds: ['p', 'q'], label: 'Record the mailing · 2' })
    const sp = thisMonth.groups.find((g) => g.key === 'gc:gc-sp')!
    expect(sp.word).toBe('record 2 mailings')
    expect(sp.sub).toBe('GC · 2 jobs · 2 in the mail')
    const mixed = buildLienCalendarBoard([...rows, job({ jobId: 'r', name: 'Round Rock', gcId: 'gc-sp', gcName: 'Southern Pine Construction', openBalance: 100 })], '', TODAY)
    expect(mixed.buckets.find((b) => b.key === 'this_month')!.groups.find((g) => g.key === 'gc:gc-sp')!.word).toBe('send the notice · 2 in the mail')
  })
})
