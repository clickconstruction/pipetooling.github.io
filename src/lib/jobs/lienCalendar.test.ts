import { describe, expect, it } from 'vitest'
import { buildLienCalendar, lienCalendarRowMatches, type LienCalendarJob } from './lienCalendar'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'

// Today is 2026-09-28 throughout.
function runway(over: Partial<LienRunwayInput> = {}) {
  return buildLienPayRunway({ todayYmd: '2026-09-28', openBalance: 1000, lastWorkYmd: '2026-08-12', propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, ...over })
}
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
    address: '214 Beechwood Ave',
    openBalance: 1000,
    isSub,
    runway: runway({ isSub, openBalance: rest.openBalance ?? 1000, ...r }),
    ...rest,
  }
}

const RMC = { gcId: 'gc-rmc', gcName: 'RMC · Dudley Mason' }

describe('lienCalendarRowMatches', () => {
  const j = job({ number: '890 PLUM', name: 'Rizvi', customer: 'Dudley Mason', ...RMC, address: '628 Terrell Rd, San Antonio' })
  it('every token must land somewhere: number, name, customer, GC or address', () => {
    expect(lienCalendarRowMatches(j, '')).toBe(true)
    expect(lienCalendarRowMatches(j, '890')).toBe(true)
    expect(lienCalendarRowMatches(j, 'terrell rmc')).toBe(true)
    expect(lienCalendarRowMatches(j, 'terrell hunter')).toBe(false)
  })
})

describe('buildLienCalendar', () => {
  it('groups sub jobs by GC, direct jobs under one heading, lien-gone last; each group names its next move', () => {
    const rows = [
      job({ jobId: 'a', number: '890', name: 'Rizvi', ...RMC, openBalance: 9800 }), // notice owed Oct 15
      job({ jobId: 'b', number: '881', name: 'Umar', ...RMC, openBalance: 7902, r: { lastWorkYmd: '2026-09-02' } }), // notice owed Nov 16
      job({ jobId: 'c', number: '983', name: 'Water Heater', gcId: 'gc-hunter', gcName: 'Hunter Homes', openBalance: 2300, r: { noticedMonths: ['2026-08'] } }), // notice recorded → flag alone Nov 16
      job({ jobId: 'd', number: '473', name: 'Mike Holub', customer: 'Michael Holub', openBalance: 5724, r: { expectedPayYmd: '2026-09-30' } }), // direct, room
      job({ jobId: 'e', number: '663', name: 'Knight', gcId: 'gc-knight', gcName: 'Knight Contracting', openBalance: 658, r: { lastWorkYmd: '2026-07-20' } }), // notice window closed → gone
      job({ jobId: 'f', number: '000', name: 'Paid', openBalance: 0, r: { openBalance: 0 } }), // nothing open → dropped
    ]
    const cal = buildLienCalendar(rows, '')
    expect(cal.groups.map((g) => [g.kind, g.name, g.jobs.length, g.word])).toEqual([
      ['gc', 'RMC · Dudley Mason', 2, 'send 2 notices by Oct 15 · 17 d'],
      ['gc', 'Hunter Homes', 1, '49 d to the flag'],
      ['direct', 'Direct — we contracted with the owner', 1, '47 d of room'],
      ['gone', 'Lien gone', 1, 'money still owed'],
    ])
    expect(cal.groups[0]!.sub).toBe('GC · 2 jobs · 2 notices owed · 2 at one property') // both rows sit at the fixture's one address
    expect(cal.groups[0]!.total).toBe(17702)
    expect(cal.groups[0]!.tone).toBe('amber')
    expect(cal.groups[3]!.sub).toContain('a window closed unsent')
    expect(cal.totals).toEqual({ jobs: 5, open: 26384, noticesOwed: 2, gone: 1 })
    expect(cal.jobs.map((j) => j.jobId)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('a GC with one notice owed says "send the notice"; a GC with none says the tightest verdict', () => {
    const one = buildLienCalendar([job({ ...RMC })], '')
    expect(one.groups[0]!.word).toBe('send the notice by Oct 15 · 17 d')
    const none = buildLienCalendar([job({ ...RMC, r: { noticedMonths: ['2026-08'], expectedPayYmd: '2026-10-03' } })], '')
    expect(none.groups[0]!.word).toBe('44 d of room')
    expect(none.groups[0]!.tone).toBe('green')
  })

  it('search narrows the rows and the groups follow', () => {
    const rows = [job({ jobId: 'a', ...RMC }), job({ jobId: 'd', name: 'Mike Holub', customer: 'Michael Holub' })]
    const cal = buildLienCalendar(rows, 'holub')
    expect(cal.groups.map((g) => g.kind)).toEqual(['direct'])
    expect(cal.totals.jobs).toBe(1)
  })

  it('within a group the tightest runway comes first, then the bigger balance', () => {
    const rows = [
      job({ jobId: 'far', ...RMC, openBalance: 100, r: { lastWorkYmd: '2026-09-02' } }),
      job({ jobId: 'near-small', ...RMC, openBalance: 100 }),
      job({ jobId: 'near-big', ...RMC, openBalance: 9000 }),
    ]
    expect(buildLienCalendar(rows, '').groups[0]!.jobs.map((j) => j.jobId)).toEqual(['near-big', 'near-small', 'far'])
  })
})

// ---- PR C (v2.4152): the shared axis, the marks, the density and the to-do ----
import { LIEN_CALENDAR_KEY, closedYmdFor, commercialLienByFor, lienCalendarAxis, lienCalendarDensity, lienCalendarGroupFlags, lienCalendarMarks, lienCalendarTodo, noticeFlagsFor, rowWord, sharedPropertyNote, workMarkFor } from './lienCalendar'

const TODAY = '2026-09-28'

describe('lienCalendarAxis', () => {
  it('runs from three weeks back to ten days past the last date, with every statutory date as a column', () => {
    const rows = [job({ jobId: 'a', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12' } }), job({ jobId: 'b', r: { lastWorkYmd: '2026-07-20' } })]
    const axis = lienCalendarAxis(rows, TODAY)
    expect(axis.startYmd).toBe('2026-09-07')
    expect(axis.columns.map((c) => c.ymd)).toEqual(['2026-10-15', '2026-11-16'])
    expect(axis.columns[0]!.daysFromToday).toBe(17)
    expect(axis.columns[0]!.label).toBe('Oct 15')
    expect(axis.endYmd > '2026-11-16').toBe(true)
    expect(axis.pct(axis.startYmd)).toBe(0)
    expect(axis.pct(axis.endYmd)).toBe(100)
    expect(axis.todayPct).toBeGreaterThan(0)
    expect(axis.todayPct).toBeLessThan(axis.columns[0]!.pct)
  })
  it('a lien-gone row pulls the past gutter back to its closed date, never past ninety days', () => {
    const gone = job({ jobId: 'g', r: { lastWorkYmd: '2026-03-01' } })
    expect(gone.runway.state).toBe('closed')
    const axis = lienCalendarAxis([gone], TODAY)
    expect(axis.startYmd).toBe('2026-06-30')
    expect(axis.columns.some((c) => c.past)).toBe(false)
  })
})

describe('lienCalendarMarks', () => {
  it('a sub job with a pay date: run, notice flag, pay dot and lien flag on one scale', () => {
    const j = job({ jobId: 'a', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-10-03' } })
    const axis = lienCalendarAxis([j], TODAY)
    const marks = lienCalendarMarks(j, axis)
    expect(marks.map((m) => m.kind)).toEqual(['work', 'run', 'pay', 'notice', 'lien'])
    const run = marks[1] as Extract<(typeof marks)[number], { kind: 'run' }>
    expect(run.short).toBe(false)
    const lien = marks[4] as Extract<(typeof marks)[number], { kind: 'lien' }>
    expect(lien.ymd).toBe(j.runway.lienByYmd)
    expect(lien.pct).toBe(axis.pct(j.runway.lienByYmd))
  })
  it('no pay date → a dashed dot just past today; a closed row → one red flag at its date', () => {
    const open = job({ jobId: 'a', r: { lastWorkYmd: '2026-08-12' } })
    const axis = lienCalendarAxis([open], TODAY)
    expect(lienCalendarMarks(open, axis).map((m) => m.kind)).toEqual(['work', 'pay_missing', 'lien'])
    // under a GC row the dashed dot is the GC's, not the job's
    expect(lienCalendarMarks(open, axis, { payMissingDot: false }).map((m) => m.kind)).toEqual(['work', 'lien'])
    const gone = job({ jobId: 'g', r: { lastWorkYmd: '2026-03-01' } })
    const gm = lienCalendarMarks(gone, lienCalendarAxis([gone], TODAY))
    expect(gm.map((m) => m.kind)).toEqual(['work', 'gone', 'lien'])
    expect(gm[1]).toMatchObject({ kind: 'gone', by: 'lien', ymd: '2026-06-15', label: 'lien window closed Jun 15' })
    expect(gm[2]).toMatchObject({ kind: 'lien', closed: true, tone: 'red', ymd: '2026-06-15' })
  })
  it('the work tick: the last day worked with its date; hollow and amber from the creation day; at the left edge with ◂ when it is before the axis (v2.4265)', () => {
    const worked = job({ jobId: 'a', r: { lastWorkYmd: '2026-09-10' } })
    const axis = lienCalendarAxis([worked], TODAY)
    expect(workMarkFor(worked, axis)).toEqual({ kind: 'work', pct: axis.pct('2026-09-10'), ymd: '2026-09-10', offAxis: false, fromCreation: false, label: 'Sep 10' })
    const early = job({ jobId: 'b', r: { lastWorkYmd: '2026-08-12' } })
    expect(workMarkFor(early, axis)).toMatchObject({ pct: 0, offAxis: true, label: '◂ Aug 12' })
    const created = job({ jobId: 'c', r: { lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z' } })
    expect(created.runway.datedFromCreation).toBe(true)
    expect(created.runway.basisYmd).toBe('2026-08-03')
    expect(workMarkFor(created, axis)).toMatchObject({ fromCreation: true, offAxis: true, label: '◂ Aug · no hours' })
    expect(workMarkFor(job({ jobId: 'd', r: { lastWorkYmd: null, createdAt: null } }), axis)).toBeNull()
  })
  it('a notice window closed unsent dies on the notice date, not the lien date — the gutter and the flag follow it', () => {
    const j = job({ jobId: 'e', ...RMC, isSub: true, r: { lastWorkYmd: '2026-07-20' } })
    expect(j.runway.state).toBe('closed')
    expect(j.runway.closedBy).toBe('notice')
    expect(closedYmdFor(j.runway)).toBe('2026-09-15')
    const axis = lienCalendarAxis([j], TODAY)
    expect(axis.columns.map((c) => c.ymd)).toEqual(['2026-09-15'])
    const marks = lienCalendarMarks(j, axis)
    expect(marks[1]).toMatchObject({ kind: 'gone', by: 'notice', ymd: '2026-09-15', label: 'notice not sent by Sep 15' })
    expect(marks[2]).toMatchObject({ kind: 'lien', closed: true, ymd: '2026-09-15' })
  })
  it('the kind bracket shows on a job dated from its creation day too', () => {
    const created = job({ jobId: 'c', ...RMC, isSub: true, r: { lastWorkYmd: null, createdAt: '2026-08-03T15:00:00Z', propertyKind: '' } })
    expect(created.runway.kindAssumed).toBe(true)
    expect(commercialLienByFor(created)).toBe('2026-12-15')
  })
  it('the work months carry one hollow flag per unpaid month and a check for a sent one; the kind bracket reaches the commercial date', () => {
    const j = job({
      jobId: 'a',
      ...RMC,
      isSub: true,
      lastWorkYmd: '2026-08-12',
      r: { lastWorkYmd: '2026-08-12', propertyKind: '', workMonths: ['2026-07', '2026-08'], noticedMonths: ['2026-07'] },
    })
    expect(j.runway.kindAssumed).toBe(true)
    expect(noticeFlagsFor(j)).toEqual([
      { ymd: '2026-09-15', done: true, monthKey: '2026-07' },
      { ymd: '2026-10-15', done: false, monthKey: '2026-08' },
    ])
    expect(commercialLienByFor(j)).toBe('2026-12-15')
    const axis = lienCalendarAxis([j], TODAY)
    const kinds = lienCalendarMarks(j, axis).map((m) => m.kind)
    expect(kinds).toEqual(['work', 'bracket', 'pay_missing', 'notice', 'notice', 'lien'])
    // the sent month's date is a past column — its check still has a place
    expect(axis.columns.map((c) => [c.ymd, c.past])).toEqual([['2026-09-15', true], ['2026-10-15', false], ['2026-11-16', false], ['2026-12-15', false]])
  })
})

describe('the GC row, the density and the to-do', () => {
  const rows = [
    job({ jobId: 'a', ...RMC, isSub: true, openBalance: 9800, r: { lastWorkYmd: '2026-08-12' } }),
    job({ jobId: 'b', ...RMC, isSub: true, openBalance: 7902, r: { lastWorkYmd: '2026-08-20', propertyKind: '' }, lastWorkYmd: '2026-08-20' }),
    job({ jobId: 'c', ...RMC, isSub: true, openBalance: 4100, r: { lastWorkYmd: '2026-08-05' } }),
    job({ jobId: 'd', gcId: 'gc-hunter', gcName: 'Hunter Homes', isSub: true, openBalance: 12640, r: { lastWorkYmd: '2026-09-10' } }),
    job({ jobId: 'e', openBalance: 5724, r: { lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-09-30' } }),
  ]
  const cal = buildLienCalendar(rows, '')
  const axis = lienCalendarAxis(cal.jobs, TODAY)
  it('folds a GC’s flags per date with a count', () => {
    const rmc = cal.groups.find((g) => g.key === 'gc:gc-rmc')!
    const flags = lienCalendarGroupFlags(rmc, axis)
    expect(flags.map((f) => [f.ymd, f.notices, f.liens])).toEqual([
      ['2026-10-15', 3, 0],
      ['2026-11-16', 0, 3],
    ])
  })
  it('counts what lands on each 15th', () => {
    const density = lienCalendarDensity(cal, axis)
    const oct = density.find((c) => c.ymd === '2026-10-15')!
    expect(oct.notices.count).toBe(3)
    expect(oct.notices.total).toBe(9800 + 7902 + 4100)
    expect([...oct.notices.gcIds]).toEqual(['gc-rmc'])
    const nov = density.find((c) => c.ymd === '2026-11-16')!
    expect(nov.notices.count).toBe(1)
    expect(nov.liens.count).toBe(4)
  })
  it('writes the three sentences and their actions', () => {
    const density = lienCalendarDensity(cal, axis)
    const todo = lienCalendarTodo(cal, density, new Map(cal.jobs.map((j) => [j.jobId, j])))
    expect(todo.map((t) => t.heading)).toEqual(['By Oct 15 · 17 d', 'Before that', 'By Nov 16 · 49 d'])
    expect(todo[0]!.sentence).toBe('3 notices to RMC · Dudley Mason · $21.8k')
    expect(todo[0]!.action).toMatchObject({ kind: 'draft', ymd: '2026-10-15', label: 'Draft the three' })
    expect(todo[1]!.sentence).toBe('1 property has no kind — its flag could sit a month later · $7.9k')
    expect(todo[1]!.action).toMatchObject({ kind: 'kinds', jobIds: ['b'] })
    expect(todo[2]!.sentence).toBe('1 notice to Hunter Homes · 4 liens to file · $40.2k')
    expect(todo[2]!.action).toBeNull()
  })
  it('the key names every glyph the rows can draw, each with a few words and the long ones (v2.4265)', () => {
    const glyphs = LIEN_CALENDAR_KEY.map((k) => k.glyph)
    for (const g of ['today', 'work', 'work_hollow', 'pay', 'pay_missing', 'notice', 'check', 'lien', 'room', 'short', 'bracket', 'count', 'gone']) expect(glyphs).toContain(g)
    for (const k of LIEN_CALENDAR_KEY) {
      expect(k.short.split(/\s+/).length, k.glyph).toBeLessThanOrEqual(4)
      expect(k.long.length, k.glyph).toBeGreaterThan(k.label.length)
    }
    expect(LIEN_CALENDAR_KEY.find((k) => k.glyph === 'bracket')?.door).toBe('kinds')
    expect(LIEN_CALENDAR_KEY.find((k) => k.glyph === 'notice')?.door).toBe('draft')
  })
  it('a job row says only what its GC row does not (v2.4265)', () => {
    const rmc = cal.groups.find((g) => g.key === 'gc:gc-rmc')!
    // every RMC job owes the Oct 15 notice the row already names
    for (const j of rmc.jobs) expect(rowWord(j, rmc)).toBeNull()
    const later = job({ jobId: 'x', ...RMC, isSub: true, r: { lastWorkYmd: '2026-09-02' } })
    expect(rowWord(later, { kind: 'gc', jobs: [...rmc.jobs, later] })).toEqual({ text: 'notice by Nov 16 · 49 d', tone: 'amber' })
    const direct = cal.groups.find((g) => g.kind === 'direct')!
    expect(rowWord(direct.jobs[0]!, direct)).toEqual({ text: '47 d of room', tone: 'green' })
    expect(rowWord(job({ jobId: 'g', r: { lastWorkYmd: '2026-03-01' } }), null)).toEqual({ text: 'still owed', tone: 'grey' })
  })
  it('a GC row counts the jobs that share one property', () => {
    expect(sharedPropertyNote([{ address: '9703 Lenox Hl, San Antonio, TX 78230' }, { address: '9703 Lenox Hl San Antonio, TX' }, { address: '628 Terrell Rd' }])).toBe('2 at one property')
    expect(sharedPropertyNote([{ address: '628 Terrell Rd' }, { address: '' }, { address: '' }])).toBe('')
    const two = buildLienCalendar([job({ jobId: 'a', ...RMC, address: '9703 Lenox Hl' }), job({ jobId: 'b', ...RMC, address: '9703 Lenox Hl' })], '')
    expect(two.groups[0]!.sub).toBe('GC · 2 jobs · 2 notices owed · 2 at one property')
  })
})


// ---- v2.4308: a job worked over several months owes its earliest notice first ----
describe('the notice that counts is the earliest one still owed (v2.4308)', () => {
  // The Calendar read live on 2026-10-01: three GCs' jobs each worked several months, no notice
  // recorded, all commercial. July's notices are due Oct 15; the last month's are later.
  const OCT_1 = '2026-10-01'
  const commercial = { todayYmd: OCT_1, propertyKind: 'non_residential' }
  const rows = [
    job({ jobId: '878', number: '878', name: 'Take 5- Seguin', gcId: 'gc-sp', gcName: 'Southern Post Construction', openBalance: 38625, r: { ...commercial, lastWorkYmd: '2026-09-21', workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'] } }),
    job({ jobId: '891', number: '891', name: 'Take 5- Liberty Hill', gcId: 'gc-burd', gcName: 'Burd & Assoc.', openBalance: 27199, r: { ...commercial, lastWorkYmd: '2026-08-11', workMonths: ['2026-07', '2026-08'] } }),
    job({ jobId: '650', number: '650', name: 'ATI Schertz', gcId: 'gc-loberg', gcName: 'Loberg Contracting', openBalance: 15722, r: { ...commercial, lastWorkYmd: '2026-09-08', workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'] } }),
    // a GC whose one notice really is Nov 16: worked September only, residential
    job({ jobId: '983', number: '983', name: 'Water Heater removal', gcId: 'gc-hi', gcName: 'H & I Construction', openBalance: 350, r: { todayYmd: OCT_1, lastWorkYmd: '2026-09-03', workMonths: ['2026-09'] } }),
  ]
  const cal = buildLienCalendar(rows, '')

  it('each GC row names July’s date, and the groups sort by it', () => {
    expect(cal.groups.map((g) => [g.name, g.word])).toEqual([
      ['Southern Post Construction', 'send the notice by Oct 15 · 14 d'],
      ['Burd & Assoc.', 'send the notice by Oct 15 · 14 d'],
      ['Loberg Contracting', 'send the notice by Oct 15 · 14 d'],
      ['H & I Construction', 'send the notice by Nov 16 · 46 d'],
    ])
    expect(cal.totals.noticesOwed).toBe(4)
  })

  it('a job row’s sentence names the same date as its GC row', () => {
    const seguin = cal.jobs.find((j) => j.jobId === '878')!
    expect(seguin.runway.lines).toEqual(['notice by Oct 15 · lien by Jan 15', 'send the notice · 14 d'])
    expect(rowWord(seguin, cal.groups[0]!)).toBeNull()
    // beside July's notice, a job whose first notice is later says its own date
    const later = cal.jobs.find((j) => j.jobId === '983')!
    expect(rowWord(later, { kind: 'gc', jobs: [seguin, later] })).toEqual({ text: 'notice by Nov 16 · 46 d', tone: 'amber' })
  })

  it('one flag per month still owed, none for a closed month; the Oct 15 column counts all three', () => {
    const seguin = cal.jobs.find((j) => j.jobId === '878')!
    expect(noticeFlagsFor(seguin)).toEqual([
      { ymd: '2026-10-15', done: false, monthKey: '2026-07' },
      { ymd: '2026-11-16', done: false, monthKey: '2026-08' },
      { ymd: '2026-12-15', done: false, monthKey: '2026-09' },
    ])
    const axis = lienCalendarAxis(cal.jobs, OCT_1)
    const density = lienCalendarDensity(cal, axis)
    expect(density.find((c) => c.ymd === '2026-10-15')!.notices.jobIds).toEqual(['878', '891', '650'])
    const todo = lienCalendarTodo(cal, density, new Map(cal.jobs.map((j) => [j.jobId, j])))
    expect(todo[0]).toMatchObject({ heading: 'By Oct 15 · 14 d', sentence: '3 notices across 3 GCs · $81.5k' })
  })

  it('a job with no property kind draws its flags where its words are, on the residential clock', () => {
    // Job 927, Mike Holub – Candelaria: July through September, no kind. July's window closed Sep 15 on
    // the residential clock; August's notice is the first owed. (Before, the flags sat a month later than the words.)
    const holub = job({ jobId: '927', gcId: 'gc-holub', gcName: 'Michael Holub', r: { todayYmd: OCT_1, propertyKind: '', lastWorkYmd: '2026-09-09', workMonths: ['2026-07', '2026-08', '2026-09'] } })
    expect(holub.runway.noticeByYmd).toBe('2026-10-15')
    expect(noticeFlagsFor(holub)).toEqual([
      { ymd: '2026-10-15', done: false, monthKey: '2026-08' },
      { ymd: '2026-11-16', done: false, monthKey: '2026-09' },
    ])
  })
})


// ---- PR D (v2.4153): the pen ----
import { groupPayYmd, kindsQueue, promiseConsequence, whoseWordOptions } from './lienCalendar'

describe('the pen', () => {
  it('reads a pay date back against the lien flag', () => {
    expect(promiseConsequence('2026-10-03', '2026-11-16', TODAY)).toEqual({ tone: 'green', text: '44 d of room before the lien flag' })
    expect(promiseConsequence('2026-11-20', '2026-11-16', TODAY)).toEqual({ tone: 'red', text: '4 d after the lien flag — file first' })
    expect(promiseConsequence('2026-11-16', '2026-11-16', TODAY)).toEqual({ tone: 'red', text: 'on the lien day — file first' })
    expect(promiseConsequence('2026-09-01', '2026-11-16', TODAY)).toEqual({ tone: 'amber', text: 'that day has passed' })
  })
  it('whose word: the owner, and the GC on a sub job', () => {
    expect(whoseWordOptions(job({ customer: 'Umar Khan', ...RMC, isSub: true }))).toEqual([
      { key: 'owner', label: 'Umar Khan (owner)' },
      { key: 'gc', label: 'RMC · Dudley Mason (GC)' },
    ])
    expect(whoseWordOptions(job({ customer: 'Mike Holub' }))).toEqual([{ key: 'owner', label: 'Mike Holub (owner)' }])
  })
  it('the GC row carries one dot only when every dated job agrees', () => {
    const a = job({ jobId: 'a', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-10-03' } })
    const b = job({ jobId: 'b', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-10-03' } })
    const c = job({ jobId: 'c', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12' } })
    expect(groupPayYmd([a, b, c], TODAY)).toBe('2026-10-03')
    expect(groupPayYmd([a, job({ jobId: 'd', ...RMC, isSub: true, r: { lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-10-10' } })], TODAY)).toBeNull()
    expect(groupPayYmd([c], TODAY)).toBeNull()
  })
  it('the kinds queue is the assumed rows, biggest first, with the commercial date', () => {
    const q = kindsQueue([
      job({ jobId: 'a', number: 'J1', openBalance: 450, addressId: 'addr-a', lastWorkYmd: '2026-08-12', r: { lastWorkYmd: '2026-08-12', propertyKind: '' } }),
      job({ jobId: 'b', number: 'J2', openBalance: 7902, addressId: null, lastWorkYmd: '2026-08-20', r: { lastWorkYmd: '2026-08-20', propertyKind: '' } }),
      job({ jobId: 'c', number: 'J3', openBalance: 9000, r: { lastWorkYmd: '2026-08-12' } }),
    ])
    expect(q.map((x) => [x.jobId, x.addressId, x.commercialYmd])).toEqual([
      ['b', null, '2026-12-15'],
      ['a', 'addr-a', '2026-12-15'],
    ])
  })
})
