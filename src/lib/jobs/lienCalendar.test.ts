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
