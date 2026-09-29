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
      ['gc', 'RMC · Dudley Mason', 2, 'send 2 notices · 17 d'],
      ['gc', 'Hunter Homes', 1, '49 d to the flag'],
      ['direct', 'Direct — we contracted with the owner', 1, '47 d of room'],
      ['gone', 'Lien gone', 1, 'money still owed'],
    ])
    expect(cal.groups[0]!.sub).toBe('GC · 2 jobs · 2 notices owed')
    expect(cal.groups[0]!.total).toBe(17702)
    expect(cal.groups[0]!.tone).toBe('amber')
    expect(cal.groups[3]!.sub).toContain('a window closed unsent')
    expect(cal.totals).toEqual({ jobs: 5, open: 26384, noticesOwed: 2, gone: 1 })
    expect(cal.jobs.map((j) => j.jobId)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('a GC with one notice owed says "send the notice"; a GC with none says the tightest verdict', () => {
    const one = buildLienCalendar([job({ ...RMC })], '')
    expect(one.groups[0]!.word).toBe('send the notice · 17 d')
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
import { LIEN_CALENDAR_KEY, commercialLienByFor, lienCalendarAxis, lienCalendarDensity, lienCalendarGroupFlags, lienCalendarMarks, lienCalendarTodo, noticeFlagsFor } from './lienCalendar'

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
    expect(marks.map((m) => m.kind)).toEqual(['run', 'pay', 'notice', 'lien'])
    const run = marks[0] as Extract<(typeof marks)[number], { kind: 'run' }>
    expect(run.short).toBe(false)
    const lien = marks[3] as Extract<(typeof marks)[number], { kind: 'lien' }>
    expect(lien.ymd).toBe(j.runway.lienByYmd)
    expect(lien.pct).toBe(axis.pct(j.runway.lienByYmd))
  })
  it('no pay date → a dashed dot just past today; a closed row → one red flag at its date', () => {
    const open = job({ jobId: 'a', r: { lastWorkYmd: '2026-08-12' } })
    const axis = lienCalendarAxis([open], TODAY)
    expect(lienCalendarMarks(open, axis).map((m) => m.kind)).toEqual(['pay_missing', 'lien'])
    const gone = job({ jobId: 'g', r: { lastWorkYmd: '2026-03-01' } })
    const gm = lienCalendarMarks(gone, lienCalendarAxis([gone], TODAY))
    expect(gm).toHaveLength(1)
    expect(gm[0]).toMatchObject({ kind: 'lien', closed: true, tone: 'red' })
  })
  it('the months carry one hollow flag per unpaid month and a check for a sent one; the kind bracket reaches the commercial date', () => {
    const j = job({
      jobId: 'a',
      ...RMC,
      isSub: true,
      lastWorkYmd: '2026-08-12',
      r: { lastWorkYmd: '2026-08-12', propertyKind: '' },
      months: [
        { key: '2026-07', due: '2026-09-15', state: 'sent' },
        { key: '2026-08', due: '2026-10-15', state: 'due' },
      ],
    })
    expect(j.runway.kindAssumed).toBe(true)
    expect(noticeFlagsFor(j)).toEqual([
      { ymd: '2026-09-15', done: true, monthKey: '2026-07' },
      { ymd: '2026-10-15', done: false, monthKey: '2026-08' },
    ])
    expect(commercialLienByFor(j)).toBe('2026-12-15')
    const axis = lienCalendarAxis([j], TODAY)
    const kinds = lienCalendarMarks(j, axis).map((m) => m.kind)
    expect(kinds).toEqual(['bracket', 'pay_missing', 'notice', 'notice', 'lien'])
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
  it('the key names every glyph the rows can draw', () => {
    const glyphs = LIEN_CALENDAR_KEY.map((k) => k.glyph)
    for (const g of ['today', 'pay', 'pay_missing', 'notice', 'check', 'lien', 'room', 'short', 'bracket', 'count']) expect(glyphs).toContain(g)
  })
})
