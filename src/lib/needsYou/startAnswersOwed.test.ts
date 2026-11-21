/**
 * What customers owe us before a stage starts, for Needs you (punch list #382, PR 6): the count is the Schedule
 * look's own, site by site, and a site whose day to decide is far owes nothing yet. Every site and person here is
 * made up.
 */
import { describe, expect, it } from 'vitest'
import { needsYouDoor } from '../needsYouDoors'
import { plainWordsFailures } from '../plainWords'
import type { StageLine, StartBulletRow, StartCheckRows } from '../startChecks/startCheckRows'
import { START_OWED_ACTION, sitesOnDefaultNotice, startAnswersOwed, startOwedDetail, startOwedHref, startOwedTitle, withoutZzTestStartJobs, type StartOwedJob, type StartOwedSources } from './startAnswersOwed'

const TODAY = '2026-11-17'
let n = 0
const at = () => `2026-11-${String(1 + (++n % 27)).padStart(2, '0')}T15:00:00Z`
const job = (id: string, o: Partial<StartOwedJob> = {}): StartOwedJob => ({ id, label: id.toUpperCase(), name: `${id} plumbing`, developmentId: 'dev-1', developmentName: 'Heron Point', address: '12 Marsh Road, Tidewater, NC', gcContact: 'Ray Ortiz', gcName: 'Northgate Builders', customerName: 'Heron Point LLC', ...o })
const line = (fixtureId: string, jobId: string, window: [string, string] | null, o: Partial<StageLine> = {}): StageLine => ({ fixtureId, jobId, name: 'Top Out', order: ++n, finished: false, window, ...o })
const bullet = (id: string, jobId: string, fixtureId: string, o: Partial<StartBulletRow> = {}): StartBulletRow => ({ id, job_id: jobId, fixture_id: fixtureId, sort_order: ++n, words: `Bullet ${id}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: at(), ...o })
const rows = (bullets: StartBulletRow[], marks: StartCheckRows['marks'] = []): StartCheckRows => ({ bullets, marks, asks: [], theirDays: [], decisions: [], arrivals: [] })
const yes = (bulletId: string, jobId: string) => ({ id: `m-${bulletId}`, bullet_id: bulletId, job_id: jobId, know: 'word' as const, who_name: 'Ray', how: 'by phone', said_on: '2026-11-14', source: 'office' as const, photo_storage_path: null, photo_file_name: null, taken_back_at: null, created_at: at() })

describe('the answers owed, site by site', () => {
  // Heron Point: a stage near its day with two open and one with a yes, and a stage far out. A job on no site with one open.
  const sources: StartOwedSources = {
    jobs: [job('j1'), job('j2'), job('lone', { developmentId: null, developmentName: null, gcContact: null, gcName: null, customerName: 'Pat Alder', name: 'Alder house' })],
    lines: [line('near', 'j1', ['2026-12-01', '2026-12-12']), line('far', 'j2', ['2027-02-08', '2027-02-12']), line('lone-stage', 'lone', ['2026-11-25', '2026-11-26']), line('done', 'j1', ['2026-11-20', '2026-11-21'], { finished: true })],
    rows: rows(
      [bullet('a', 'j1', 'near'), bullet('b', 'j1', 'near'), bullet('c', 'j1', 'near'), bullet('d', 'j2', 'far'), bullet('e', 'lone', 'lone-stage'), bullet('f', 'j1', 'done'), bullet('ours', 'j1', 'near', { waits_on: 'us', reads: 'hand', shown_to_gc: false })],
      [yes('c', 'j1')],
    ),
    settings: [],
  }

  it('counts what the Schedule look counts: open bullets on them, on stages ahead whose day to decide is near', () => {
    const owed = startAnswersOwed(sources, TODAY, new Set(['dev-1']))
    expect(owed.sites).toEqual([
      { key: 'dev-1', developmentId: 'dev-1', jobId: 'j1', name: 'Heron Point', contact: 'Ray', answers: 2, stages: 1 },
      { key: 'job:lone', developmentId: null, jobId: 'lone', name: 'Alder house', contact: 'Pat Alder', answers: 1, stages: 1 },
    ])
    expect(owed.answers).toBe(3)
    expect(owed.stages).toBe(2)
  })

  it('reads the site’s own notice, and the default by distance when it has none', () => {
    // Near, the site needs two days of notice: the December 1 stage is decided by November 29, which is 12 days off.
    expect(startAnswersOwed(sources, TODAY).sites.map((s) => s.key)).toEqual(['dev-1', 'job:lone'])
    // A stage 40 days out on a site that needs 30 days of notice is near its day to decide.
    const late: StartOwedSources = { ...sources, lines: [line('near', 'j1', ['2026-12-27', '2026-12-30'])], rows: rows([bullet('a', 'j1', 'near')]) }
    expect(startAnswersOwed(late, TODAY, new Set(['dev-1'])).answers).toBe(0)
    expect(startAnswersOwed({ ...late, settings: [{ id: 's', development_id: 'dev-1', job_id: null, notice_days: 30, shows_on_gc_page: false }] }, TODAY).answers).toBe(1)
    expect(sitesOnDefaultNotice(sources)).toEqual([
      { key: 'dev-1', address: '12 Marsh Road, Tidewater, NC' },
      { key: 'job:lone', address: '12 Marsh Road, Tidewater, NC' },
    ])
    expect(sitesOnDefaultNotice({ ...sources, settings: [{ id: 's', development_id: 'dev-1', job_id: null, notice_days: 7, shows_on_gc_page: false }] }).map((s) => s.key)).toEqual(['job:lone'])
  })

  it('owes nothing with no open bullet on them, and nothing on a stage with no days', () => {
    expect(startAnswersOwed({ jobs: [], lines: [], rows: rows([]), settings: [] }, TODAY)).toEqual({ sites: [], answers: 0, stages: 0 })
    const noDays: StartOwedSources = { jobs: [job('j1')], lines: [line('x', 'j1', null)], rows: rows([bullet('a', 'j1', 'x')]), settings: [] }
    expect(startAnswersOwed(noDays, TODAY).answers).toBe(0)
  })
})

describe('a ZZ test job owes the office nothing', () => {
  // A walk's test job on its own test site, with two open bullets near its day, beside a real site with one.
  const sources: StartOwedSources = {
    jobs: [job('j1'), job('zz', { name: 'ZZ Test Stages Walk', developmentId: 'dev-zz', developmentName: 'ZZ Test development', gcContact: null, gcName: null, customerName: null })],
    lines: [line('f1', 'j1', ['2026-11-24', '2026-11-26']), line('fz', 'zz', ['2026-11-24', '2026-11-26'])],
    rows: rows([bullet('a', 'j1', 'f1'), bullet('z1', 'zz', 'fz'), bullet('z2', 'zz', 'fz')]),
    settings: [],
  }

  it('counts it for a seat that shows ZZ jobs, and leaves it out for one that hides them', () => {
    const all = startAnswersOwed(sources, TODAY)
    expect(all.answers).toBe(3)
    expect(all.sites.map((s) => s.name)).toEqual(['ZZ Test development', 'Heron Point'])
    const shown = startAnswersOwed(withoutZzTestStartJobs(sources), TODAY)
    expect(shown.answers).toBe(1)
    expect(shown.sites.map((s) => s.name)).toEqual(['Heron Point'])
    expect(sitesOnDefaultNotice(withoutZzTestStartJobs(sources)).map((s) => s.key)).toEqual(['dev-1'])
  })

  it('reads a customer named ZZ the same way, and hands back the same sources when there is no ZZ job', () => {
    const byCustomer: StartOwedSources = { ...sources, jobs: [job('j1'), job('zz', { name: 'Lodge plumbing', customerName: 'ZZ Test GC', developmentId: 'dev-zz', developmentName: 'A test site' })] }
    expect(startAnswersOwed(withoutZzTestStartJobs(byCustomer), TODAY).answers).toBe(1)
    const none: StartOwedSources = { ...sources, jobs: [job('j1')] }
    expect(withoutZzTestStartJobs(none)).toBe(none)
  })
})

describe('the line on Needs you', () => {
  const one = { sites: [{ key: 'dev-1', developmentId: 'dev-1', jobId: 'j1', name: 'Heron Point', contact: 'Ray', answers: 6, stages: 2 }], answers: 6, stages: 2 }
  const two = { sites: [...one.sites, { key: 'job:lone', developmentId: null, jobId: 'lone', name: 'Alder house', contact: 'Pat Alder', answers: 1, stages: 1 }], answers: 7, stages: 3 }

  it('names the person on one site, and counts across sites when there is more than one', () => {
    expect(startOwedTitle(one)).toBe('Ray owes us 6 answers on 2 stages')
    expect(startOwedTitle(two)).toBe('Customers owe us 7 answers on 3 stages')
    expect(startOwedTitle({ sites: [{ ...one.sites[0]!, answers: 1, stages: 1 }], answers: 1, stages: 1 })).toBe('Ray owes us 1 answer on 1 stage')
    expect(startOwedTitle({ sites: [{ ...one.sites[0]!, contact: 'the customer' }], answers: 6, stages: 2 })).toBe('The customer owes us 6 answers on 2 stages')
    expect(startOwedDetail(one)).toBe('Heron Point. Each is something that must be true before a stage starts. Ask before the day we decide.')
    expect(startOwedDetail(two)).toBe('Heron Point and 1 more site. Each is something that must be true before a stage starts. Ask before the day we decide.')
    expect(startOwedDetail({ sites: [], answers: 0, stages: 0 })).toBe('')
    for (const words of [startOwedTitle(one), startOwedTitle(two), startOwedDetail(one), startOwedDetail(two), START_OWED_ACTION]) expect(plainWordsFailures(words)).toEqual([])
  })

  it('opens the site’s Schedule look, or the job’s window for a job on no site', () => {
    expect(startOwedHref(one.sites[0])).toBe('/developments/dev-1?look=schedule')
    expect(startOwedHref(two.sites[1])).toBe('/jobs?tab=stages&jobDetail=lone')
    expect(startOwedHref(null)).toBe('/jobs?tab=stages')
  })

  it('its door is the look', () => {
    expect(needsYouDoor({ key: 'start-answers-owed' }, { startOwedFirst: { developmentId: 'dev-1', jobId: 'j1' } } as Parameters<typeof needsYouDoor>[1], 'dashboard')).toEqual({ kind: 'href', href: '/developments/dev-1?look=schedule' })
    expect(needsYouDoor({ key: 'start-answers-owed' }, { startOwedFirst: null } as Parameters<typeof needsYouDoor>[1], 'quickfill')).toEqual({ kind: 'href', href: '/jobs?tab=stages' })
  })
})
