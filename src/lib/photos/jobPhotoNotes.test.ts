import { describe, expect, it } from 'vitest'
import { addPress, addWrites, addedWords, canEditJobPhotoWords, descriptionTrimmed, gridBySource, gridChips, gridFootWords, gridItems, gridSearch, gridTileWords, jobPhotoCaption, jobPhotoNotePath, newPhotosLine, offersWordsForTheRest, tileWords, wordsForTheRest, type JobPhotoTile } from './jobPhotoNotes'
import type { UploadedPhotoRow } from './uploadedPhotos'

function tile(over: Partial<JobPhotoTile> & { id: string }): JobPhotoTile {
  return {
    status: 'sent',
    previewUrl: 'blob:x',
    originalBytes: 4_200_000,
    bytes: 310_000,
    width: 1600,
    height: 1200,
    longEdge: 1600,
    shrunk: true,
    fixtureId: null,
    stageName: null,
    description: '',
    storagePath: `job/${over.id}.jpg`,
    takenAt: '2026-11-02T20:41:00.000Z',
    failWhy: null,
    ...over,
  }
}

describe('jobPhotoNotes', () => {
  it('names the bucket object by the job and the photo, the gate’s shape', () => {
    expect(jobPhotoNotePath('job-1', 'photo-9')).toBe('job-1/photo-9.jpg')
  })

  it('the caption is the description’s first line cut on a word, else the stage, else Job photo', () => {
    expect(jobPhotoCaption({ description: 'Cracked flange under the second lav, unit 204', stageName: 'Rough In' })).toBe('Cracked flange under the second lav, unit 204')
    expect(jobPhotoCaption({ description: 'Before: the old slab penetration at the kitchen island, east wall, with the saw cut marked', stageName: null })).toBe('Before: the old slab penetration at the kitchen island, east')
    expect(jobPhotoCaption({ description: 'First line\nSecond line', stageName: null })).toBe('First line')
    expect(jobPhotoCaption({ description: '  ', stageName: 'Top Out' })).toBe('Top Out')
    expect(jobPhotoCaption({ description: '', stageName: null })).toBe('Job photo')
  })

  it('trims the description, folds blank runs and cuts at the cap', () => {
    expect(descriptionTrimmed('  a\r\n\r\n\r\n\r\nb  ')).toBe('a\n\nb')
    expect(descriptionTrimmed('x'.repeat(600))).toHaveLength(500)
  })

  it('the press names the count and is dead while a shot is on its way or nothing is ready', () => {
    expect(addPress({ tiles: [tile({ id: 'a' }), tile({ id: 'b' })], adding: false })).toEqual({ label: 'Add 2 photos to the job', dead: false })
    expect(addPress({ tiles: [tile({ id: 'a' })], adding: false })).toEqual({ label: 'Add 1 photo to the job', dead: false })
    expect(addPress({ tiles: [tile({ id: 'a' }), tile({ id: 'b', status: 'sending' })], adding: false })).toEqual({ label: 'Sending 1 photo…', dead: true })
    expect(addPress({ tiles: [tile({ id: 'a', status: 'shrinking' }), tile({ id: 'b', status: 'sending' })], adding: false })).toEqual({ label: 'Sending 2 photos…', dead: true })
    expect(addPress({ tiles: [tile({ id: 'a', status: 'failed' })], adding: false })).toEqual({ label: 'Add photos', dead: true })
    expect(addPress({ tiles: [], adding: false })).toEqual({ label: 'Add photos', dead: true })
    expect(addPress({ tiles: [tile({ id: 'a' })], adding: true })).toEqual({ label: 'Adding…', dead: true })
  })

  it('Use these words for the rest fills only the tiles with no words of their own', () => {
    const tiles = [tile({ id: 'a', description: 'Meter location' }), tile({ id: 'b' }), tile({ id: 'c', description: 'Its own words' })]
    expect(wordsForTheRest(tiles, 'a').map((t) => t.description)).toEqual(['Meter location', 'Meter location', 'Its own words'])
    expect(wordsForTheRest(tiles, 'b').map((t) => t.description)).toEqual(['Meter location', '', 'Its own words'])
    expect(offersWordsForTheRest(tiles, 'a')).toBe(true)
    expect(offersWordsForTheRest(tiles, 'b')).toBe(false)
    expect(offersWordsForTheRest([tiles[0]!], 'a')).toBe(false)
    expect(offersWordsForTheRest([tiles[0]!, tiles[2]!], 'a')).toBe(false)
  })

  it('the line over the tiles counts them and says where they go', () => {
    expect(newPhotosLine({ count: 1, longEdge: 1600, jobHasFolder: true })).toBe('New photo · shrunk to 1600 px · goes to the job’s Drive folder')
    expect(newPhotosLine({ count: 2, longEdge: 1600, jobHasFolder: true })).toBe('2 new photos · shrunk to 1600 px · they go to the job’s Drive folder')
    expect(newPhotosLine({ count: 2, longEdge: 1200, jobHasFolder: false })).toBe('2 new photos · shrunk to 1200 px · the first makes the job’s Drive folder')
  })

  it('a tile reads its first line, else its stage, else No description', () => {
    expect(tileWords({ description: 'Cracked flange\nunder the lav', stage_name: 'Rough In' })).toEqual({ text: 'Cracked flange', none: false })
    expect(tileWords({ description: '', stage_name: 'Rough In' })).toEqual({ text: 'Rough In', none: false })
    expect(tileWords({ description: ' ', stage_name: '' })).toEqual({ text: 'No description', none: true })
  })

  it('the writes are one per sent tile with the words trimmed and the caption named', () => {
    const writes = addWrites([tile({ id: 'a', description: '  Meter location  ', fixtureId: 'f1', stageName: 'Rough In' }), tile({ id: 'b', status: 'failed' }), tile({ id: 'c' })])
    expect(writes).toEqual([
      { id: 'a', description: 'Meter location', fixtureId: 'f1', stageName: 'Rough In', caption: 'Meter location' },
      { id: 'c', description: '', fixtureId: null, stageName: null, caption: 'Job photo' },
    ])
  })

  it('the toast counts what added and names the first reason for what did not', () => {
    expect(addedWords({ added: 2, failed: [] })).toEqual({ text: '2 photos added to the job', tone: 'success' })
    expect(addedWords({ added: 1, failed: ['The gate refused it.'] })).toEqual({ text: '1 photo added to the job, but one did not: The gate refused it.', tone: 'warning' })
    expect(addedWords({ added: 0, failed: ['No signal.'] })).toEqual({ text: 'The photo did not add: No signal.', tone: 'warning' })
  })

  const base: UploadedPhotoRow = {
    source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
    caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'u1', by_name: 'Carla Nguyen', direction: null, channel: null,
    taken_at: '2026-11-02T20:41:00.000Z', bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: '2026-11-02T20:46:00.000Z', fail_why: null, status: null,
    job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge', customer_name: 'Ridgeway Builders', bid_number: null,
  }
  const report: UploadedPhotoRow = { ...base, source: 'report', id: 'r1', caption: 'Rough In', by_name: 'Mateo Ruiz', taken_at: '2026-11-02T17:05:00.000Z', drive_file_id: 'd-2', report_id: 'rep-1' }
  const waiting: UploadedPhotoRow = { ...base, id: 'n2', caption: '', stage_name: '', taken_at: '2026-11-02T20:40:00.000Z', storage_path: 'job-1/n2.jpg', drive_file_id: null, filed_at: null }

  it('the grid is our rows plus the folder’s hand-added files, newest first, never a row doubled', () => {
    const drive = [
      { id: 'd-1', name: '2026-11-02 Carla Nguyen · Cracked flange.jpg', mime: 'image/jpeg', bytes: 310_000, modified: '2026-11-02T20:46:00.000Z', from: 'pictures' as const },
      { id: 'd-9', name: 'IMG_4471.jpg', mime: 'image/jpeg', bytes: 2_000_000, modified: '2026-11-01T13:48:00.000Z', from: 'pictures' as const },
    ]
    const items = gridItems({ rows: [report, base, waiting], drive, job: { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge' } })
    expect(items.map((i) => i.row.id)).toEqual(['n1', 'n2', 'r1', 'drive:d-9'])
    expect(items[3]).toMatchObject({ hand: true, row: { caption: 'IMG_4471.jpg', by_name: 'Added in Drive', drive_file_id: 'd-9', job_id: 'job-1', job_hcp_number: '1077' } })
    expect(gridTileWords(items[3]!)).toEqual({ text: 'IMG_4471.jpg', none: true, who: 'Added in Drive' })
    expect(gridTileWords(items[0]!)).toEqual({ text: 'Cracked flange under the second lav', none: false, who: 'Carla Nguyen' })
    expect(gridTileWords(items[1]!)).toEqual({ text: 'No description', none: true, who: 'Carla Nguyen' })
    expect(gridTileWords(items[2]!)).toEqual({ text: 'Rough In', none: false, who: 'Mateo Ruiz · Report' })
    expect(gridItems({ rows: [], drive: null, job: { id: 'job-1' } })).toEqual([])
  })

  it('the search reads the words, the person, the stage and the source; the chips show only with two sources and carry counts', () => {
    const items = gridItems({ rows: [report, base, waiting], drive: null, job: { id: 'job-1' } })
    expect(gridSearch(items, 'flange').map((i) => i.row.id)).toEqual(['n1'])
    expect(gridSearch(items, 'mateo').map((i) => i.row.id)).toEqual(['r1'])
    expect(gridSearch(items, 'rough').map((i) => i.row.id)).toEqual(['n1', 'r1'])
    expect(gridSearch(items, 'report').map((i) => i.row.id)).toEqual(['r1'])
    expect(gridSearch(items, 'f')).toHaveLength(3)
    expect(gridBySource(items, 'report').map((i) => i.row.id)).toEqual(['r1'])
    expect(gridChips(items, 'primary')).toEqual([
      { key: 'all', label: 'All · 3' },
      { key: 'report', label: 'Reports · 1' },
      { key: 'job', label: 'Job photos · 2' },
    ])
    expect(gridChips(items.filter((i) => i.row.source === 'job'), 'dev')).toEqual([])
  })

  it('the foot counts, names the folder and the hand-added files', () => {
    expect(gridFootWords({ count: 14, hand: 1, folderKind: 'pictures' })).toBe('14 photos · In Drive: Customer Pictures · 1 was put in the folder by hand and read by file name')
    expect(gridFootWords({ count: 1, hand: 0, folderKind: null })).toBe('1 photo')
    expect(gridFootWords({ count: 3, hand: 2, folderKind: 'photos' })).toBe('3 photos · In Drive: Team only › Photos · 2 were put in the folder by hand and read by file name')
  })

  it('the taker and the office may change the words; a helper may not change another’s', () => {
    expect(canEditJobPhotoWords({ role: 'helpers', byUserId: 'u1', authUserId: 'u1' })).toBe(true)
    expect(canEditJobPhotoWords({ role: 'helpers', byUserId: 'u1', authUserId: 'u2' })).toBe(false)
    expect(canEditJobPhotoWords({ role: 'assistant', byUserId: 'u1', authUserId: 'u2' })).toBe(true)
    expect(canEditJobPhotoWords({ role: 'estimator', byUserId: null, authUserId: 'u2' })).toBe(true)
    expect(canEditJobPhotoWords({ role: 'primary', byUserId: null, authUserId: 'u2' })).toBe(false)
  })
})
