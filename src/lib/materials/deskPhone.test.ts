import { describe, expect, it } from 'vitest'
import { buildDeskPhone, deskPhoneBoxesWords, deskPhoneMissingWords, DESK_PHONE_NOT_ON_A_SITE, type DeskPhoneJob } from './deskPhone'
import type { DeskGroup } from './siteRollup'

const job = (over: Partial<DeskPhoneJob> & Pick<DeskPhoneJob, 'id'>): DeskPhoneJob => ({
  number: over.id, name: `ZZ Test ${over.id}`, boxes: 3, places: 0, due: 0, dueWords: '', missingLines: 0, missingUnpricedLines: 0, missingMoney: 0, credits: 0, failed: null, ...over,
})

// A site with two jobs, a site with one, and a job on no site: the owner's own desk on the day this was drawn.
const JOBS: DeskPhoneJob[] = [
  job({ id: '224', name: 'ZZ Test phase 2 draws', boxes: 94, places: 2, due: 12, dueWords: '12 due a count · A1, A7, A8…' }),
  job({ id: '1091', name: 'ZZ Test lift stations', boxes: 3 }),
  job({ id: '1113', name: 'ZZ Test walk project', boxes: 3, due: 1, dueWords: 'ZZ1 due a count' }),
  job({ id: '972', name: 'ZZ Test gas test', boxes: 3, missingLines: 2, missingMoney: 85 }),
]
const GROUPS: DeskGroup[] = [
  { kind: 'site', siteId: 's1', name: 'ZZ Test Ridge', jobIds: ['224', '1091'] },
  { kind: 'site', siteId: 's2', name: 'ZZ Test development', jobIds: ['1113'] },
  { kind: 'job', jobId: '972' },
]
const build = (filter: 'all' | 'due' | 'missing' = 'all', jobs = JOBS, groups = GROUPS) => buildDeskPhone({ jobs, groups, filter })
const tile = (m: ReturnType<typeof build>, key: string) => m.tiles.find((t) => t.key === key)!

describe('the three figures', () => {
  it('adds up every job: boxes on site, boxes due a count, money missing this week', () => {
    const m = build()
    expect(m.tiles.map((t) => `${t.figure} ${t.word}`)).toEqual(['103 Boxes on site', '13 Due a count', '$85 Missing this week'])
    expect(m.tiles.map((t) => t.tone)).toEqual(['here', 'gap', 'gap'])
    expect(m.tiles.map((t) => t.on)).toEqual([true, false, false])
    expect(m.tiles.some((t) => t.off)).toBe(false)
  })

  it('a figure with nothing behind it is quiet and its press is dead', () => {
    const m = build('all', JOBS.map((j) => ({ ...j, due: 0, dueWords: '', missingLines: 0, missingMoney: 0 })))
    expect(tile(m, 'due')).toMatchObject({ figure: '0', tone: 'out', off: true, title: 'No box is due a count.' })
    expect(tile(m, 'missing')).toMatchObject({ figure: '$0', tone: 'out', off: true, title: 'Nothing came up short this week.' })
    expect(tile(m, 'all').off).toBe(false)
  })

  it('money that leaves out a line with no price is a floor, and says so with a plus', () => {
    const m = build('all', [job({ id: 'a', missingLines: 3, missingUnpricedLines: 2, missingMoney: 1204.4 })], [{ kind: 'job', jobId: 'a' }])
    expect(tile(m, 'missing').figure).toBe('$1,204+')
    expect(tile(m, 'missing').title).toBe('$1,204.40 missing this week on 1 job: 3 lines · 2 with no price. Press to see that job.')
  })

  it('with no priced line there is no money to show: the figure is the lines that came up short', () => {
    const m = build('all', [job({ id: 'a', missingLines: 3, missingUnpricedLines: 3 })], [{ kind: 'job', jobId: 'a' }])
    expect(tile(m, 'missing')).toMatchObject({ figure: '3', word: 'Short this week', tone: 'gap', off: false })
    const one = build('all', [job({ id: 'a', missingLines: 1, missingUnpricedLines: 1 })], [{ kind: 'job', jobId: 'a' }])
    expect(tile(one, 'missing')).toMatchObject({ figure: '1', word: 'Short this week', title: '1 line came up short this week on 1 job, with no price to add up. Press to see that job.' })
  })

  it('a job that did not load adds no figure', () => {
    const m = build('all', [...JOBS.slice(0, 3), { ...JOBS[3]!, failed: 'No connection.' }])
    expect(tile(m, 'all').figure).toBe('100')
    expect(tile(m, 'missing')).toMatchObject({ figure: '$0', off: true })
  })

  it('each title is a whole sentence that says what its press does', () => {
    const m = build()
    expect(tile(m, 'all').title).toBe('103 boxes on site across 4 jobs. Press to see every job.')
    expect(tile(m, 'due').title).toBe('13 boxes due a count on 2 jobs. Press to see those jobs.')
    expect(tile(m, 'missing').title).toBe('$85.00 missing this week on 1 job: 2 lines. Press to see that job.')
  })
})

describe('the sections', () => {
  it('a section for each site with its jobs under it, then the jobs on no site', () => {
    const m = build()
    expect(m.sections.map((s) => [s.heading, s.siteId, s.rows.map((r) => r.id)])).toEqual([
      ['ZZ Test Ridge', 's1', ['224', '1091']],
      ['ZZ Test development', 's2', ['1113']],
      [DESK_PHONE_NOT_ON_A_SITE, null, ['972']],
    ])
  })

  it('a site that holds more than one job says its boxes, since no row adds them up', () => {
    const m = build()
    expect(m.sections.map((s) => s.boxesWords)).toEqual(['97 boxes', null, null])
  })

  it('with no job on a site the loose jobs carry no heading', () => {
    const m = build('all', JOBS, JOBS.map((j) => ({ kind: 'job' as const, jobId: j.id })))
    expect(m.sections).toHaveLength(1)
    expect(m.sections[0]!.heading).toBeNull()
    expect(m.sections[0]!.rows).toHaveLength(4)
  })

  it('a site counts the jobs of its own that did not load, and leaves their boxes out of its sum', () => {
    const m = build('all', [JOBS[0]!, { ...JOBS[1]!, failed: 'No connection.' }, JOBS[2]!, JOBS[3]!])
    expect(m.sections[0]).toMatchObject({ boxesWords: '94 boxes', notLoadedWords: '1 job did not load' })
  })

  it('a job the groups name and the desk did not read is left out, never drawn as zeros', () => {
    const m = build('all', JOBS.slice(1))
    expect(m.sections[0]!.rows.map((r) => r.id)).toEqual(['1091'])
  })
})

describe('a row', () => {
  const rowOf = (id: string, m = build()) => m.sections.flatMap((s) => s.rows).find((r) => r.id === id)!

  it('says what the job holds on one line, and each thing it needs on a line of its own', () => {
    expect(rowOf('224')).toMatchObject({ number: '224', name: 'ZZ Test phase 2 draws', label: '224 · ZZ Test phase 2 draws', facts: '94 boxes · 2 places', needs: ['12 due a count · A1, A7, A8…'], marked: true, failed: null })
    expect(rowOf('972')).toMatchObject({ facts: '3 boxes · all counted this fortnight', needs: ['$85.00 missing this week · 2 lines'], marked: true })
  })

  it('a job with nothing due and nothing short is quiet and says all counted', () => {
    expect(rowOf('1091')).toMatchObject({ facts: '3 boxes · all counted this fortnight', needs: [], marked: false })
  })

  it('one place is not worth a word, credits are, and a job with no box says no count', () => {
    const m = build('all', [job({ id: 'a', boxes: 1, places: 1, credits: 2 }), job({ id: 'b', boxes: 0, credits: 1 })], [{ kind: 'job', jobId: 'a' }, { kind: 'job', jobId: 'b' }])
    expect(rowOf('a', m).facts).toBe('1 box · all counted this fortnight · 2 credits due')
    expect(rowOf('b', m).facts).toBe('0 boxes · 1 credit due')
  })

  it('a job that did not load says so with its reason, and no figure stands in for it', () => {
    const m = build('all', [{ ...JOBS[0]!, failed: 'No connection. Check your signal.' }], [{ kind: 'job', jobId: '224' }])
    expect(rowOf('224', m)).toMatchObject({ facts: '', needs: [], marked: true, failed: 'Did not load. No connection. Check your signal.' })
  })

  it('a job with no number is named by its name alone, and one with neither still has a label to be pressed by', () => {
    const m = build('all', [job({ id: 'a', number: '', name: 'ZZ Test loose job' }), job({ id: 'b', number: '77', name: '' }), job({ id: 'c', number: '', name: '' })], ['a', 'b', 'c'].map((jobId) => ({ kind: 'job' as const, jobId })))
    expect(['a', 'b', 'c'].map((id) => rowOf(id, m).label)).toEqual(['ZZ Test loose job', '77', '—'])
  })
})

describe('narrowing the list', () => {
  const ids = (m: ReturnType<typeof build>) => m.sections.flatMap((s) => s.rows.map((r) => r.id))

  it('Due a count keeps the jobs with a box due, under their sites', () => {
    const m = build('due')
    expect(m.filter).toBe('due')
    expect(ids(m)).toEqual(['224', '1113'])
    expect(m.sections.map((s) => s.heading)).toEqual(['ZZ Test Ridge', 'ZZ Test development'])
    expect(m.tiles.map((t) => t.on)).toEqual([false, true, false])
  })

  it('a site keeps the sum of all its boxes while its list is narrowed', () => {
    expect(build('due').sections[0]!.boxesWords).toBe('97 boxes')
  })

  it('Missing this week keeps the jobs that came up short', () => {
    const m = build('missing')
    expect(ids(m)).toEqual(['972'])
    expect(m.sections[0]!.heading).toBe(DESK_PHONE_NOT_ON_A_SITE)
  })

  it('a job that did not load stays in every list, with its press to read it again', () => {
    const m = build('missing', [{ ...JOBS[0]!, failed: 'No connection.' }, ...JOBS.slice(1)])
    expect(ids(m)).toEqual(['224', '972'])
  })

  it('a filter with nothing left behind it falls back to every job', () => {
    const m = build('due', JOBS.map((j) => ({ ...j, due: 0, dueWords: '' })))
    expect(m.filter).toBe('all')
    expect(ids(m)).toEqual(['224', '1091', '1113', '972'])
    expect(m.tiles.map((t) => t.on)).toEqual([true, false, false])
  })

  it('jobs that did not load do not hold a filter up by themselves', () => {
    const m = build('due', JOBS.map((j) => ({ ...j, due: 0, dueWords: '', failed: 'No connection.' })))
    expect(m.filter).toBe('all')
  })
})

describe('the words', () => {
  it('counts boxes in the singular and with a thousands mark', () => {
    expect([0, 1, 2, 1250].map(deskPhoneBoxesWords)).toEqual(['0 boxes', '1 box', '2 boxes', '1,250 boxes'])
  })

  it('names the money when a short line has a price, and what happened when none has', () => {
    expect(deskPhoneMissingWords({ missingLines: 0, missingUnpricedLines: 0, missingMoney: 0 })).toBe('')
    expect(deskPhoneMissingWords({ missingLines: 2, missingUnpricedLines: 0, missingMoney: 85 })).toBe('$85.00 missing this week · 2 lines')
    expect(deskPhoneMissingWords({ missingLines: 3, missingUnpricedLines: 2, missingMoney: 12.5 })).toBe('$12.50 missing this week · 3 lines · 2 with no price')
    expect(deskPhoneMissingWords({ missingLines: 3, missingUnpricedLines: 3, missingMoney: 0 })).toBe('Missing this week · 3 lines, none with a price')
  })
})

describe('a desk with no money, for the roles that read none', () => {
  const quiet = (filter: 'all' | 'due' | 'missing' = 'all', jobs = JOBS) => buildDeskPhone({ jobs, groups: GROUPS, filter, money: false })
  const rowOf = (id: string, m = quiet()) => m.sections.flatMap((s) => s.rows).find((r) => r.id === id)!

  it('has two figures: the boxes and the boxes due a count', () => {
    expect(quiet().tiles.map((t) => `${t.figure} ${t.word}`)).toEqual(['103 Boxes on site', '13 Due a count'])
  })

  it('a row says nothing about what came up short or about credits', () => {
    const m = quiet('all', JOBS.map((j) => (j.id === '972' ? { ...j, credits: 2 } : j)))
    expect(rowOf('972', m)).toMatchObject({ facts: '3 boxes · all counted this fortnight', needs: [], marked: false })
    expect(JSON.stringify(m)).not.toMatch(/\$|missing|credit/i)
  })

  it('a row still names its boxes due a count', () => {
    expect(rowOf('224')).toMatchObject({ needs: ['12 due a count · A1, A7, A8…'], marked: true })
  })

  it('Due a count narrows the list, and a narrowing to what came up short is every job', () => {
    expect(quiet('due').sections.flatMap((s) => s.rows.map((r) => r.id))).toEqual(['224', '1113'])
    const m = quiet('missing')
    expect(m.filter).toBe('all')
    expect(m.sections.flatMap((s) => s.rows.map((r) => r.id))).toEqual(['224', '1091', '1113', '972'])
  })

  it('money is drawn unless it is turned off', () => {
    expect(buildDeskPhone({ jobs: JOBS, groups: GROUPS, filter: 'all' }).tiles).toHaveLength(3)
    expect(buildDeskPhone({ jobs: JOBS, groups: GROUPS, filter: 'all', money: true }).tiles).toHaveLength(3)
  })
})
