import { describe, expect, it } from 'vitest'
import { captionWordsOf, foldPhotoBatches, lineTiles, photoTimeRange } from './photoLines'
import { filterChangeLines } from './whatChanged'
import { foldSameDayRuns } from './historyFolds'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { UploadedPhotoRow } from '../photos/uploadedPhotos'

function row(over: Partial<UploadedPhotoRow> & { id: string; taken_at: string }): UploadedPhotoRow {
  return {
    source: 'report',
    job_id: 'j629',
    bid_id: null,
    project_id: null,
    report_id: 'r1',
    container_id: null,
    question_id: null,
    message_id: null,
    contact_id: null,
    caption: '',
    stage_name: 'Rough in',
    by_user_id: 'u-malachi',
    by_name: 'Malachi Reed',
    direction: null,
    channel: null,
    bytes: 1000,
    original_bytes: 0,
    bucket: 'report-photos',
    storage_path: 'p.jpg',
    drive_file_id: null,
    filed_at: null,
    fail_why: null,
    status: null,
    job_hcp_number: '629',
    job_click_number: null,
    job_name: 'Lot 14',
    customer_name: 'Ridgeway',
    bid_number: null,
    ...over,
  }
}
const labels = {
  job: (id: string) => (id === 'j629' ? { kind: 'job' as const, id, label: 'JP629 Lot 14' } : id === 'j631' ? { kind: 'job' as const, id, label: 'JP631 Lot 16' } : null),
  bid: (id: string) => (id === 'b503' ? { kind: 'bid' as const, id, label: 'BP503 Lot 20' } : null),
  siteName: 'Gray Fox Trail',
}

describe('foldPhotoBatches — same piece, same person, within the hour', () => {
  it('four shots on one job by one person within the hour are one line at the newest shot, the rows newest first', () => {
    const rows = [
      row({ id: 'a', taken_at: '2026-11-02T13:42:00Z' }),
      row({ id: 'd', taken_at: '2026-11-02T14:15:00Z', caption: 'Vent stack' }),
      row({ id: 'b', taken_at: '2026-11-02T13:50:00Z', caption: 'Rough in' }),
      row({ id: 'c', taken_at: '2026-11-02T14:02:00Z', caption: 'Vent stack' }),
    ]
    const lines = foldPhotoBatches(rows, labels)
    expect(lines).toHaveLength(1)
    const l = lines[0]!
    expect(l).toMatchObject({ id: 'photos:report:d', kind: 'photos', verb: 'Photos', at: '2026-11-02T14:15:00Z', about: { kind: 'job', id: 'j629', label: 'JP629 Lot 14' }, detail: '4 photos · Rough in · “Vent stack”', by: 'Malachi Reed', withTime: true, timeRange: '7:42–8:15 AM' })
    expect(l.photos!.map((r) => r.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(l.searchText).toBe('Vent stack Rough in Malachi Reed')
  })
  it('a shot past the hour of the batch’s newest, another person, or another job opens a line of its own', () => {
    const rows = [
      row({ id: 'a', taken_at: '2026-11-02T14:15:00Z' }),
      row({ id: 'late', taken_at: '2026-11-02T13:10:00Z' }), // 65 min before a
      row({ id: 'deon', taken_at: '2026-11-02T14:10:00Z', by_user_id: 'u-deon', by_name: 'Deon Price' }),
      row({ id: 'other', taken_at: '2026-11-02T14:12:00Z', job_id: 'j631', job_hcp_number: '631' }),
    ]
    const lines = foldPhotoBatches(rows, labels)
    expect(lines.map((l) => [l.id, l.verb, l.about.label, l.by])).toEqual([
      ['photos:report:a', 'Photo', 'JP629 Lot 14', 'Malachi Reed'],
      ['photos:report:other', 'Photo', 'JP631 Lot 16', 'Malachi Reed'],
      ['photos:report:deon', 'Photo', 'JP629 Lot 14', 'Deon Price'],
      ['photos:report:late', 'Photo', 'JP629 Lot 14', 'Malachi Reed'],
    ])
    expect(lines[0]!.detail).toBe('1 photo · Rough in')
    expect(lines[0]!.timeRange).toBe('8:15 AM')
  })
  it('the hour is measured from the batch’s newest shot, so a long trickle breaks into batches', () => {
    const rows = [0, 40, 80, 120].map((min) => row({ id: `m${min}`, taken_at: new Date(Date.parse('2026-11-02T14:00:00Z') - min * 60_000).toISOString() }))
    const lines = foldPhotoBatches(rows, labels)
    expect(lines.map((l) => l.photos!.map((r) => r.id))).toEqual([
      ['m0', 'm40'],
      ['m80', 'm120'],
    ])
  })
  it('a text’s picture on a bid is about the bid, by its sender; a photo on no piece is about the site', () => {
    const rows = [
      row({ id: 't', taken_at: '2026-11-02T14:00:00Z', source: 'message', channel: 'text', direction: 'in', job_id: null, bid_id: 'b503', bid_number: '503', by_user_id: null, by_name: 'Greg Paulk', caption: 'IMG_2231.jpg', stage_name: '' }),
      row({ id: 's', taken_at: '2026-11-02T12:00:00Z', job_id: null, by_user_id: null, by_name: '' }),
      row({ id: 'g', taken_at: '2026-11-02T11:00:00Z', job_id: 'j-gone' }),
    ]
    const lines = foldPhotoBatches(rows, labels)
    expect(lines[0]).toMatchObject({ about: { kind: 'bid', id: 'b503', label: 'BP503 Lot 20' }, by: 'from Greg Paulk', detail: '1 photo · “IMG_2231.jpg”' })
    expect(lines[1]).toMatchObject({ about: { kind: 'site', id: null, label: 'Gray Fox Trail' }, by: 'someone' })
    expect(lines[2]).toMatchObject({ about: { kind: 'job', id: 'j-gone', label: 'a job no longer here' } })
  })
  it('the search finds a caption, a stage or a person on the line', () => {
    const lines = foldPhotoBatches([row({ id: 'a', taken_at: '2026-11-02T13:42:00Z', caption: 'Water heater closet' })], labels)
    expect(filterChangeLines(lines, 'heater')).toHaveLength(1)
    expect(filterChangeLines(lines, 'malachi closet')).toHaveLength(1)
    expect(filterChangeLines(lines, 'deon')).toHaveLength(0)
  })
})

describe('the words and the tiles', () => {
  it('captions: distinct, up to three, the stage’s own words left out', () => {
    const rows = ['Rough in', 'Vent', 'vent', 'Pan drain', 'Trap', 'Fifth'].map((c, i) => row({ id: String(i), taken_at: '2026-11-02T13:42:00Z', caption: c }))
    expect(captionWordsOf(rows, 'Rough in')).toBe('“Vent, Pan drain, Trap”')
    expect(captionWordsOf([row({ id: 'x', taken_at: '2026-11-02T13:42:00Z' })], 'Rough in')).toBe('')
  })
  it('the time range: one time, the same AM/PM once, across noon both', () => {
    expect(photoTimeRange([row({ id: 'a', taken_at: '2026-11-02T14:15:00Z' })])).toBe('8:15 AM')
    expect(photoTimeRange([row({ id: 'a', taken_at: '2026-11-02T14:15:00Z' }), row({ id: 'b', taken_at: '2026-11-02T13:42:00Z' })])).toBe('7:42–8:15 AM')
    expect(photoTimeRange([row({ id: 'a', taken_at: '2026-11-02T18:10:00Z' }), row({ id: 'b', taken_at: '2026-11-02T17:50:00Z' })])).toBe('11:50 AM–12:10 PM')
    expect(photoTimeRange([])).toBe('')
  })
  it('four tiles draw whole; past four, three and a + N tile', () => {
    const four = [1, 2, 3, 4].map((i) => row({ id: String(i), taken_at: '2026-11-02T13:42:00Z' }))
    expect(lineTiles(four).map((t) => (t.kind === 'photo' ? t.row.id : `+${t.count}`))).toEqual(['1', '2', '3', '4'])
    const eleven = Array.from({ length: 11 }, (_, i) => row({ id: String(i), taken_at: '2026-11-02T13:42:00Z' }))
    expect(lineTiles(eleven).map((t) => (t.kind === 'photo' ? t.row.id : `+${t.count}`))).toEqual(['0', '1', '2', '+8'])
  })
})

describe('the History’s same-day fold (v2.6378) leaves photo lines alone', () => {
  it('three batches by one person on one job on one day stay three lines, each with its own photos', () => {
    // Two hours apart, so the hour rule makes three batches; the same day, kind, piece and person would fold any record line.
    const rows = [0, 120, 240].map((min, i) => row({ id: `b${i}`, taken_at: new Date(Date.parse('2026-11-02T20:00:00Z') - min * 60_000).toISOString() }))
    const lines = foldPhotoBatches(rows, labels)
    expect(lines).toHaveLength(3)
    const shown = foldSameDayRuns(lines, calendarYmdInAppTzFromIso)
    expect(shown.map((l) => l.id)).toEqual(lines.map((l) => l.id))
    expect(shown.every((l) => !('foldedCount' in l) && (l.photos?.length ?? 0) === 1)).toBe(true)
  })
})
