import { describe, expect, it } from 'vitest'
import { addPress, addWrites, addedWords, descriptionTrimmed, jobPhotoCaption, jobPhotoNotePath, newPhotosLine, offersWordsForTheRest, tileWords, wordsForTheRest, type JobPhotoTile } from './jobPhotoNotes'

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
})
