import { describe, expect, it } from 'vitest'
import {
  censusOf,
  dayTickWords,
  galleryTiles,
  jobPickWords,
  jobPicks,
  jobPicksShown,
  moreJobsWords,
  moreTileWords,
  personChipWords,
  photosCardMeta,
  photosFootWords,
  photosLookWords,
  rowsByPerson,
  siteFilter,
  siteSourceChips,
  CREWS_PHOTOS_FOR_THE_OFFICE,
  sitePhotosEmptyWords,
  sitePhotosNarrowed,
  tileWords,
  weekFromIso,
} from './sitePhotos'
import type { UploadedPhotoRow } from './uploadedPhotos'

const J1 = '11111111-1111-4111-8111-111111111111'
const J2 = '22222222-2222-4222-8222-222222222222'
const B1 = '33333333-3333-4333-8333-333333333333'

function row(over: Partial<UploadedPhotoRow> = {}): UploadedPhotoRow {
  return {
    source: 'report',
    id: 'p1',
    job_id: J1,
    bid_id: null,
    project_id: null,
    report_id: 'r1',
    container_id: null,
    question_id: null,
    message_id: null,
    contact_id: null,
    caption: 'Rough in',
    stage_name: 'Rough in',
    by_user_id: 'u1',
    by_name: 'Malachi Reed',
    direction: null,
    channel: null,
    taken_at: '2026-11-02T13:42:00Z',
    bytes: 310_000,
    original_bytes: 0,
    bucket: 'report-photos',
    storage_path: 'j1/p1.jpg',
    drive_file_id: null,
    filed_at: null,
    fail_why: null,
    status: null,
    job_hcp_number: '629',
    job_click_number: null,
    job_name: 'Lot 14 rough-in',
    customer_name: 'Ridgeway Builders',
    bid_number: null,
    ...over,
  }
}

describe('the site is asked for by its pieces', () => {
  it('one or over the jobs and the bids, uuids only, each once', () => {
    expect(siteFilter([J1, J2, J1, 'not-a-uuid'], [B1])).toBe(`job_id.in.(${J1},${J2}),bid_id.in.(${B1})`)
    expect(siteFilter([J1], [])).toBe(`job_id.in.(${J1})`)
    expect(siteFilter([], [B1])).toBe(`bid_id.in.(${B1})`)
  })
  it('a site with no piece reads nothing', () => {
    expect(siteFilter([], [])).toBeNull()
    expect(siteFilter(['x'], [])).toBeNull()
  })
})

describe('the census', () => {
  const now = Date.parse('2026-11-02T18:00:00Z')
  const week = weekFromIso(now)
  const rows = [
    { id: 'a', job_id: J1, bid_id: null, taken_at: '2026-11-02T13:42:00Z' },
    { id: 'b', job_id: J1, bid_id: null, taken_at: '2026-10-30T13:42:00Z' },
    { id: 'c', job_id: J2, bid_id: null, taken_at: '2026-10-20T13:42:00Z' },
    { id: 'd', job_id: null, bid_id: B1, taken_at: '2026-10-19T13:42:00Z' },
    { id: 'e', job_id: null, bid_id: null, taken_at: '2026-10-18T13:42:00Z' },
  ]
  it('counts the total, this week and each piece', () => {
    expect(week).toBe('2026-10-26T18:00:00.000Z')
    const c = censusOf(rows, week)
    expect(c.total).toBe(5)
    expect(c.thisWeek).toBe(2)
    expect(c.capped).toBe(false)
    expect([...c.byPiece.entries()]).toEqual([
      [J1, 2],
      [J2, 1],
      [B1, 1],
    ])
  })
  it('a census at its cap reads as a plus', () => {
    const c = censusOf(rows, week, 5)
    expect(c.capped).toBe(true)
    expect(photosLookWords(c)).toEqual({ n: 5, count: '5+ · 2 this week', need: null })
    expect(photosCardMeta(c)).toBe('5+ on this site · 2 this week · newest first')
  })
  it("the strip's words: the count with this week, the count alone, none yet, dots while reading", () => {
    expect(photosLookWords(censusOf(rows, week))).toEqual({ n: 5, count: '5 · 2 this week', need: null })
    expect(photosLookWords(censusOf(rows.slice(2), week))).toEqual({ n: 3, count: '3', need: null })
    expect(photosLookWords(censusOf([], week))).toEqual({ n: 0, count: 'none yet', need: null })
    expect(photosLookWords(null)).toEqual({ n: 0, count: '…', need: null })
    expect(photosCardMeta(censusOf([], week))).toBe('nothing filed yet')
    expect(photosCardMeta(null)).toBe('reading the site’s photos…')
  })
  it('the job picker: All jobs first, then the pieces with photos by count, a piece the page no longer lists left out', () => {
    const picks = jobPicks(censusOf(rows, week), [
      { id: J2, label: 'JP640 Lot 20' },
      { id: J1, label: 'JP629 Lot 14' },
      { id: 'gone', label: 'JP600' },
    ])
    expect(picks).toEqual([
      { key: 'all', label: 'All jobs', count: 5 },
      { key: J1, label: 'JP629 Lot 14', count: 2 },
      { key: J2, label: 'JP640 Lot 20', count: 1 },
    ])
    expect(jobPickWords(picks[1]!)).toBe('JP629 Lot 14 · 2')
    expect(jobPicks(null, [])).toEqual([])
  })
  it('the picker folds past six jobs, keeps the picked one in view, and opens whole', () => {
    const picks = [{ key: 'all', label: 'All jobs', count: 40 }, ...Array.from({ length: 9 }, (_, i) => ({ key: `j${i}`, label: `JP${600 + i}`, count: 9 - i }))]
    const folded = jobPicksShown(picks, null, false)
    expect(folded.picks.map((p) => p.key)).toEqual(['all', 'j0', 'j1', 'j2', 'j3', 'j4', 'j5'])
    expect(folded.folded).toBe(3)
    expect(moreJobsWords(3)).toBe('+ 3 more jobs')
    expect(moreJobsWords(1)).toBe('+ 1 more job')
    const withPicked = jobPicksShown(picks, 'j8', false)
    expect(withPicked.picks.map((p) => p.key)).toEqual(['all', 'j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j8'])
    expect(withPicked.folded).toBe(2)
    expect(jobPicksShown(picks, null, true).folded).toBe(0)
    expect(jobPicksShown(picks.slice(0, 7), null, false).folded).toBe(0)
  })
})

describe('the row of tiles', () => {
  const today = '2026-11-02'
  it('a tick over the first tile of each day, the day in the company calendar, and Show more at the end', () => {
    const rows = [
      row({ id: 'a', taken_at: '2026-11-02T13:42:00Z' }),
      row({ id: 'b', taken_at: '2026-11-02T12:00:00Z' }),
      row({ id: 'c', taken_at: '2026-11-02T03:30:00Z' }), // 10:30 PM Nov 1 in Chicago: yesterday
      row({ id: 'd', taken_at: '2026-10-29T20:00:00Z' }),
      row({ id: 'e', taken_at: 'not a time' }),
    ]
    const tiles = galleryTiles(rows, today, true, 312)
    expect(tiles.map((t) => (t.kind === 'photo' ? [t.row.id, t.index, t.tick] : ['more', t.left]))).toEqual([
      ['a', 0, 'Today'],
      ['b', 1, null],
      ['c', 2, 'Yesterday'],
      ['d', 3, 'Oct 29'],
      ['e', 4, 'No date'],
      ['more', 307],
    ])
    expect(moreTileWords(307)).toBe('307 older')
    expect(moreTileWords(null)).toBe('')
    expect(moreTileWords(0)).toBe('')
  })
  it('no Show more when the row is whole or empty', () => {
    expect(galleryTiles([row()], today, false, 1).map((t) => t.kind)).toEqual(['photo'])
    expect(galleryTiles([], today, true, 10)).toEqual([])
  })
  it('the tick words', () => {
    expect(dayTickWords('2026-11-02', today)).toBe('Today')
    expect(dayTickWords('2026-11-01', today)).toBe('Yesterday')
    expect(dayTickWords('2026-10-31', today)).toBe('Oct 31')
    expect(dayTickWords('', today)).toBe('No date')
  })
  it("a tile's words: the job and the first name, the page's own label when it has one, a text's picture by its source", () => {
    expect(tileWords(row(), null)).toBe('J629 · Malachi')
    expect(tileWords(row(), 'JP629')).toBe('JP629 · Malachi')
    expect(tileWords(row({ source: 'message', channel: 'text', by_name: '+1 512 555 0100', job_id: null, bid_id: B1, bid_number: '503' }), null)).toBe('Bid 503 · text')
    expect(tileWords(row({ by_name: '' }), 'JP629')).toBe('JP629')
  })
  it('the foot: so many of the total, the whole row once every photo is on it, the shown count while narrowed', () => {
    const c = censusOf([{ id: 'a', job_id: J1, bid_id: null, taken_at: '2026-11-02T13:42:00Z' }], weekFromIso(Date.now()))
    expect(photosFootWords(60, { total: 312, thisWeek: 9, capped: false, byPiece: new Map() }, false)).toBe('60 of 312 · scroll sideways · a tile opens the photo')
    expect(photosFootWords(1, c, false)).toBe('1 photo · scroll sideways · a tile opens the photo')
    expect(photosFootWords(12, c, true)).toBe('12 photos · scroll sideways · a tile opens the photo')
    expect(photosFootWords(60, { total: 5000, thisWeek: 9, capped: true, byPiece: new Map() }, false)).toBe('60 of 5000+ · scroll sideways · a tile opens the photo')
  })
})

describe('narrowing and the empty words', () => {
  it('a job, a source or a person narrows', () => {
    expect(sitePhotosNarrowed({ jobId: null, source: 'all' }, null)).toBe(false)
    expect(sitePhotosNarrowed({ jobId: J1, source: 'all' }, null)).toBe(true)
    expect(sitePhotosNarrowed({ jobId: null, source: 'box' }, null)).toBe(true)
    expect(sitePhotosNarrowed({ jobId: null, source: 'all' }, 'Malachi Reed')).toBe(true)
  })
  it('the empty words name the site and the door that fills it', () => {
    expect(sitePhotosEmptyWords(false, 'Gray Fox Trail')).toEqual({ main: 'Nothing filed yet on Gray Fox Trail.', tail: 'lists its jobs. A photo on a report, a box or a checklist on one of them shows here within a minute.' })
    expect(sitePhotosEmptyWords(true, 'Gray Fox Trail')).toEqual({ main: 'No photo matches.', tail: 'Pick another job or another source.' })
  })
  it("one person's rows, and the chip's words", () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', by_name: 'Deon Price' }), row({ id: 'c', by_name: ' Malachi Reed ' })]
    expect(rowsByPerson(rows, 'Malachi Reed').map((r) => r.id)).toEqual(['a', 'c'])
    expect(rowsByPerson(rows, null)).toHaveLength(3)
    expect(personChipWords('Malachi Reed')).toBe('Only Malachi’s photos')
  })
})

describe('an estimator, on the overview door', () => {
  const week = weekFromIso(Date.parse('2026-11-03T18:00:00Z'))
  const some = censusOf([{ id: 'a', job_id: null, bid_id: B1, taken_at: '2026-11-02T13:42:00Z' }, { id: 'b', job_id: J1, bid_id: null, taken_at: '2026-10-20T13:42:00Z' }], week)
  it('the card says the crews’ photos are for the office, with the count of what the estimator does see', () => {
    expect(photosCardMeta(null, 'overview')).toBe(CREWS_PHOTOS_FOR_THE_OFFICE)
    expect(photosCardMeta(censusOf([], week), 'overview')).toBe('the crews’ photos are for the office')
    expect(photosCardMeta(some, 'overview')).toBe('2 sent by text or email · the crews’ photos are for the office')
    expect(photosCardMeta(some)).toBe('2 on this site · 1 this week · newest first')
  })
  it('the strip reads the office’s with none to show, and counts the pictures when there are some', () => {
    expect(photosLookWords(censusOf([], week), 'overview')).toEqual({ n: 0, count: 'the office reads them', need: null })
    expect(photosLookWords(censusOf([], week))).toEqual({ n: 0, count: 'none yet', need: null })
    expect(photosLookWords(some, 'overview')).toEqual({ n: 2, count: '2 · 1 this week', need: null })
    expect(photosLookWords(null, 'overview')).toEqual({ n: 0, count: '…', need: null })
  })
  it('the empty words name what fills the row and where the crews’ photos are, with no door to the jobs', () => {
    expect(sitePhotosEmptyWords(false, 'Gray Fox Trail', 'overview')).toEqual({ main: 'No picture sent by text or email on Gray Fox Trail yet.', tail: 'The crews’ photos on the jobs are for the office.' })
    expect(sitePhotosEmptyWords(true, 'Gray Fox Trail', 'overview')).toEqual({ main: 'No picture matches.', tail: 'Pick another job.' })
  })
  it('no source chips for an estimator, whose only source is a text or an email; the office keeps the Photos tab’s', () => {
    expect(siteSourceChips('estimator', 'overview')).toEqual([])
    expect(siteSourceChips('assistant').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'job', 'message'])
  })
})
