/**
 * Before we start, the rows read into the rules (punch list #382, PR 4): a stage line and its rows as one stage,
 * the days of notice, who we ask, and the starter. Every site, person and day here is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { bulletIsYes, readiness, stageStanding } from './startChecks'
import {
  NO_START_ROWS,
  STARTER,
  START_CHECK_WORDS,
  UNREAD,
  companyListFor,
  contactName,
  handReading,
  liveMarkOf,
  nextBulletOrder,
  noticeFor,
  stageFromRows,
  standingDecisionOf,
  starterFor,
  starterWords,
  whoseTag,
  type StageLine,
  type StartBulletRow,
  type StartCheckRows,
  type StartMarkRow,
  type StartTemplateRow,
} from './startCheckRows'

const LINE: StageLine = { fixtureId: 'f1', jobId: 'j1', name: 'Top Out', order: 2, finished: false, window: ['2026-12-08', '2026-12-12'] }
const dayOf = (iso: string) => iso.slice(0, 10)
const ctx = { jobLabel: 'J2101', part: 'Lodge', dayOf }
let n = 0
const at = () => `2026-11-${String(10 + ++n).padStart(2, '0')}T15:00:00Z`
const bullet = (id: string, o: Partial<StartBulletRow> = {}): StartBulletRow => ({ id, job_id: 'j1', fixture_id: 'f1', sort_order: 1, words: `Bullet ${id}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: at(), ...o })
const mark = (id: string, bulletId: string, o: Partial<StartMarkRow> = {}): StartMarkRow => ({ id, bullet_id: bulletId, job_id: 'j1', know: 'word', who_name: 'Ray', how: 'by phone', said_on: '2026-11-14', source: 'office', photo_storage_path: null, photo_file_name: null, taken_back_at: null, created_at: at(), ...o })
const rowsOf = (o: Partial<StartCheckRows>): StartCheckRows => ({ ...NO_START_ROWS, ...o })

describe('a stage line and its rows as one stage', () => {
  it('reads a line with no rows as a stage with no list', () => {
    const s = stageFromRows(LINE, NO_START_ROWS, ctx)
    expect(s).toEqual({ id: 'f1', part: 'Lodge', job: 'J2101', name: 'Top Out', window: ['2026-12-08', '2026-12-12'], trip: null, finished: false, theirDays: [], bullets: [], decision: null, arrivals: [] })
    expect(stageStanding(s, { noticeDays: 10, contact: 'Ray' }, '2026-11-17').next).toBe('write')
  })

  it('orders the bullets, leaves out one taken off the list and every row of another line', () => {
    const rows = rowsOf({ bullets: [bullet('c', { sort_order: 3 }), bullet('a', { sort_order: 1 }), bullet('gone', { sort_order: 2, removed_at: at() }), bullet('other', { fixture_id: 'f2' })] })
    expect(stageFromRows(LINE, rows, ctx).bullets.map((b) => b.id)).toEqual(['a', 'c'])
  })

  it('a bullet on them carries its live yes, its asks in order and the day they promised', () => {
    const rows = rowsOf({
      bullets: [bullet('a', { wants_photo: true, by_day: '2026-11-26', shown_to_gc: false })],
      marks: [mark('old', 'a', { taken_back_at: at() }), mark('live', 'a', { know: 'photo', who_name: 'Ray Ortiz', how: 'on his page', said_on: '2026-11-12' })],
      asks: [
        { id: 'k2', batch_id: 'b2', job_id: 'j1', fixture_id: 'f1', bullet_id: 'a', kind: 'ask', how: 'text', to_name: 'Ray', asked_on: '2026-11-14', created_at: '2026-11-14T16:00:00Z' },
        { id: 'k1', batch_id: 'b1', job_id: 'j1', fixture_id: 'f1', bullet_id: 'a', kind: 'ask', how: 'email', to_name: 'Ray', asked_on: '2026-11-10', created_at: '2026-11-10T16:00:00Z' },
        { id: 'k3', batch_id: 'b3', job_id: 'j1', fixture_id: 'f1', bullet_id: null, kind: 'hold_note', how: 'email', to_name: 'Ray', asked_on: '2026-11-15', created_at: '2026-11-15T16:00:00Z' },
      ],
    })
    const [b] = stageFromRows(LINE, rows, ctx).bullets
    expect(b).toEqual({ id: 'a', on: 'them', words: 'Bullet a.', wantsPhoto: true, eye: false, yes: { know: 'photo', who: 'Ray Ortiz', how: 'on his page', day: '2026-11-12' }, asks: [{ day: '2026-11-10', how: 'email' }, { day: '2026-11-14', how: 'text' }], byDay: '2026-11-26' })
    expect(liveMarkOf(rows, 'a')?.id).toBe('live')
    expect(liveMarkOf(rows, 'nobody')).toBeNull()
  })

  it('a yes taken back leaves the bullet open', () => {
    const rows = rowsOf({ bullets: [bullet('a')], marks: [mark('m', 'a', { taken_back_at: at() })] })
    const [b] = stageFromRows(LINE, rows, ctx).bullets
    expect(b && bulletIsYes(b)).toBe(false)
  })

  it('a bullet of ours ticked by hand reads who marked it and when, and one the app does not read yet says so', () => {
    const rows = rowsOf({
      bullets: [
        bullet('h', { waits_on: 'us', reads: 'hand', shown_to_gc: false }),
        bullet('d', { waits_on: 'us', reads: 'hand', shown_to_gc: false, hand_ok: true, hand_ok_at: '2026-11-16T15:00:00Z', hand_ok_by_name: 'Dana' }),
        bullet('o', { waits_on: 'us', reads: 'order_log', shown_to_gc: false }),
      ],
    })
    const s = stageFromRows(LINE, rows, ctx)
    expect(s.bullets).toEqual([
      { id: 'h', on: 'us', words: 'Bullet h.', reads: 'hand', ok: false, fact: 'Not marked done yet.', door: 'Mark it done' },
      { id: 'd', on: 'us', words: 'Bullet d.', reads: 'hand', ok: true, fact: 'Marked done by Dana, Nov 16.', door: 'Mark it not done' },
      { id: 'o', on: 'us', words: 'Bullet o.', reads: 'order_log', ok: false, fact: UNREAD.fact, door: '' },
    ])
    expect(readiness(s.bullets)).toEqual({ yes: 1, total: 3, pct: 33 })
    expect(handReading({ hand_ok: true, hand_ok_at: null, hand_ok_by_name: '' }, dayOf).fact).toBe('Marked done.')
    // A reader, once one is built, is asked for the kinds a hand does not tick.
    const read = stageFromRows(LINE, rows, { ...ctx, readUs: (r) => (r.reads === 'order_log' ? { ok: true, fact: 'Two lines land Nov 25.', door: 'Open the order log' } : null) })
    expect(read.bullets[2]).toMatchObject({ ok: true, fact: 'Two lines land Nov 25.', door: 'Open the order log' })
  })

  it('keeps every day they gave in order, less one marked removed', () => {
    const day = (id: string, ready: string, o = {}) => ({ id, job_id: 'j1', fixture_id: 'f1', ready_day: ready, said_on: '2026-11-03', who_name: 'Ray', how: 'email', source: 'office' as const, removed_at: null, created_at: at(), ...o })
    const s = stageFromRows(LINE, rowsOf({ theirDays: [day('1', '2026-11-24'), day('2', '2027-11-28', { removed_at: at() }), day('3', '2026-11-28')] }), ctx)
    expect(s.theirDays.map((d) => d.day)).toEqual(['2026-11-24', '2026-11-28'])
  })

  it('reads the newest decision that stands, and every arrival, oldest first', () => {
    const d = (id: string, kind: 'go' | 'hold', o = {}) => ({ id, job_id: 'j1', fixture_id: 'f1', kind, decided_on: '2026-11-12', open_then: ['Water is on site.'], start_then: '2026-12-08', hold_until: null, by_name: 'Dana', taken_back_at: null, created_at: at(), ...o })
    const rows = rowsOf({
      decisions: [d('1', 'hold'), d('2', 'go', { by_name: 'Sam' }), d('3', 'go', { taken_back_at: at() })],
      arrivals: [
        { id: 'a1', job_id: 'j1', fixture_id: 'f1', arrived_on: '2026-12-08', not_as_told: ['x'], by_name: 'Luis', created_at: at() },
        { id: 'a2', job_id: 'j1', fixture_id: 'f1', arrived_on: '2026-12-09', not_as_told: [], by_name: 'Luis', created_at: at() },
      ],
    })
    const s = stageFromRows(LINE, rows, ctx)
    expect(s.decision).toEqual({ kind: 'go', by: 'Sam', day: '2026-11-12', openThen: ['Water is on site.'] })
    expect(s.arrivals).toEqual([
      { day: '2026-12-08', by: 'Luis', notAsTold: ['x'] },
      { day: '2026-12-09', by: 'Luis', notAsTold: [] },
    ])
    expect(standingDecisionOf(rows, 'f1')?.id).toBe('2')
    expect(standingDecisionOf(rows, 'f2')).toBeNull()
  })

  it('sorts the next bullet after every bullet the line has had, taken off or not', () => {
    const rows = rowsOf({ bullets: [bullet('a', { sort_order: 2 }), bullet('b', { sort_order: 5, removed_at: at() }), bullet('c', { fixture_id: 'f2', sort_order: 9 })] })
    expect(nextBulletOrder(rows, 'f1')).toBe(6)
    expect(nextBulletOrder(NO_START_ROWS, 'f1')).toBe(1)
  })
})

describe('the days of notice', () => {
  const row = (o: { development_id?: string | null; job_id?: string | null; notice_days: number | null }) => ({ id: 's', development_id: null, job_id: null, shows_on_gc_page: false, ...o })

  it('reads the default by distance: ten days far and two near', () => {
    expect(noticeFor({ onSite: true, site: null, job: null, far: true })).toEqual({ days: 10, own: false, defaultDays: 10, home: 'site' })
    expect(noticeFor({ onSite: true, site: null, job: null, far: false })).toEqual({ days: 2, own: false, defaultDays: 2, home: 'site' })
    expect(noticeFor({ onSite: false, site: null, job: null, far: false })).toEqual({ days: 2, own: false, defaultDays: 2, home: 'job' })
  })

  it('a job on a site reads the site’s number, and a job on no site its own', () => {
    expect(noticeFor({ onSite: true, site: row({ development_id: 'd', notice_days: 7 }), job: row({ job_id: 'j', notice_days: 3 }), far: true })).toEqual({ days: 7, own: true, defaultDays: 10, home: 'site' })
    expect(noticeFor({ onSite: false, site: null, job: row({ job_id: 'j', notice_days: 3 }), far: true })).toEqual({ days: 3, own: true, defaultDays: 10, home: 'job' })
    // A row with no number, such as a job's row that only holds its page switch, reads the default. Zero is a number.
    expect(noticeFor({ onSite: true, site: row({ development_id: 'd', notice_days: null }), job: null, far: false }).own).toBe(false)
    expect(noticeFor({ onSite: true, site: row({ development_id: 'd', notice_days: 0 }), job: null, far: true })).toMatchObject({ days: 0, own: true })
  })
})

describe('who we ask', () => {
  it('is the first name of the GC’s contact, then the GC, then the customer', () => {
    expect(contactName({ gcContact: ' Ray Ortiz ', gc: 'Northgate Builders', customer: 'Heron Point LLC' })).toBe('Ray')
    expect(contactName({ gcContact: '', gc: 'Northgate Builders', customer: 'Heron Point LLC' })).toBe('Northgate Builders')
    expect(contactName({ gc: null, customer: ' Heron Point LLC ' })).toBe('Heron Point LLC')
    expect(contactName({})).toBe('the customer')
  })
})

describe('the starter', () => {
  const t = (id: string, o: Partial<StartTemplateRow> = {}): StartTemplateRow => ({ id, stage_kind: 'rough_in', sort_order: 1, words: `Company ${id}.`, waits_on: 'them', wants_photo: false, reads: null, retired_at: null, ...o })

  it('offers the four to a stage whose kind has no company list', () => {
    const starter = starterFor([t('x', { stage_kind: 'top_out' })], 'rough_in')
    expect(starter.fromCompany).toBe(false)
    expect(starter.bullets).toEqual(STARTER)
    expect(starter.bullets.map((b) => b.on)).toEqual(['them', 'them', 'them', 'us'])
    expect(starterFor([], null).bullets).toHaveLength(4)
    expect(starterWords('Underground', starter, null)).toEqual({ lead: 'No list yet for Underground. Start from four common bullets, then change them.', use: 'Use the four', own: 'Write my own' })
  })

  it('offers the company’s list for the stage’s kind, in its order, with a retired row left out', () => {
    const templates = [t('b', { sort_order: 2, waits_on: 'us', reads: 'order_log' }), t('a', { sort_order: 1, wants_photo: true }), t('old', { sort_order: 0, retired_at: '2026-11-01T00:00:00Z' }), t('other', { stage_kind: 'trim_set' })]
    expect(companyListFor(templates, 'rough_in').map((x) => x.id)).toEqual(['a', 'b'])
    expect(companyListFor(templates, null)).toEqual([])
    const starter = starterFor(templates, 'rough_in')
    expect(starter).toEqual({
      fromCompany: true,
      bullets: [
        { words: 'Company a.', on: 'them', wantsPhoto: true, reads: null, templateId: 'a' },
        { words: 'Company b.', on: 'us', wantsPhoto: false, reads: 'order_log', templateId: 'b' },
      ],
    })
    expect(starterWords('Rough In', starter, 'rough_in')).toEqual({ lead: 'No list yet for Rough In. Start from the company’s list for Rough In, then change it.', use: 'Use the company’s two', own: 'Write my own' })
  })

  it('says every word on the list in plain words', () => {
    const lines = [
      START_CHECK_WORDS.lead,
      START_CHECK_WORDS.officeOnly.why,
      'Not marked done yet.',
      'Marked done by Dana, Nov 16.',
      UNREAD.fact,
      ...Object.values(starterWords('Rough In', starterFor([], 'rough_in'), 'rough_in')),
      ...Object.values(starterWords('Rough In', starterFor([t('a')], 'rough_in'), 'rough_in')),
      ...STARTER.map((b) => b.words),
      START_CHECK_WORDS.toCompany('top_out'),
    ]
    for (const line of lines) expect(plainWordsFailures(line)).toEqual([])
  })

  it('tags a bullet with whose it is', () => {
    const s = stageFromRows(LINE, rowsOf({ bullets: [bullet('a'), bullet('h', { waits_on: 'us', reads: 'hand' }), bullet('o', { waits_on: 'us', reads: 'trip' })] }), ctx)
    expect(s.bullets.map((b) => whoseTag(b, 'Ray'))).toEqual(['from Ray', 'ours, ticked by hand', 'ours, read from the app'])
  })
})
