import { describe, expect, it } from 'vitest'
import {
  cardPhotoWords,
  driveFileUrl,
  newPhotoLine,
  newPhotoId,
  photoCountWords,
  photosInFlight,
  photosSentence,
  reportPhotoCaption,
  reportPhotoPath,
  reportSaveWords,
  sentTiles,
  tileNeedsStage,
  tilesOnStage,
  type ReportPhotoTile,
} from './reportPhotos'

const tile = (over: Partial<ReportPhotoTile>): ReportPhotoTile => ({
  id: 'p1',
  status: 'sent',
  previewUrl: 'blob:1',
  originalBytes: 4_200_000,
  bytes: 310_000,
  width: 1600,
  height: 1200,
  longEdge: 1600,
  shrunk: true,
  fixtureId: null,
  stageName: null,
  questionId: null,
  questionWords: null,
  storagePath: 'job-1/p1.jpg',
  takenAt: '2026-10-29T15:41:00.000Z',
  failWhy: null,
  ...over,
})

describe('reportPhotos', () => {
  it('names the bucket object by the job and the photo, the gate’s shape', () => {
    expect(reportPhotoPath('job-1', 'p1')).toBe('job-1/p1.jpg')
  })

  it('captions by the stage, else the first words of What got done, else Report photo', () => {
    expect(reportPhotoCaption({ stageName: 'Rough In', whatGotDone: 'drain lines set' })).toBe('Rough In')
    expect(reportPhotoCaption({ stageName: null, whatGotDone: 'Rough in on bath 2, drain lines set and tested today' })).toBe('Rough in on bath 2, drain')
    expect(reportPhotoCaption({ stageName: '  ', whatGotDone: '' })).toBe('Report photo')
    // A photo that answers a checklist question (PR 6) is named by the stage and the question, the question mark dropped.
    expect(reportPhotoCaption({ stageName: 'Rough In', whatGotDone: 'drain lines set', questionWords: 'Did the water test hold?' })).toBe('Rough In · Did the water test hold')
    expect(reportPhotoCaption({ stageName: null, whatGotDone: '', questionWords: 'Is the vent through the roof flashed and sealed on every side of the stack?' })).toBe('Is the vent through the roof flashed and sealed on every')
  })

  it('counts only the sent tiles, and knows when one is still on its way', () => {
    const tiles = [tile({ id: 'a' }), tile({ id: 'b', status: 'sending' }), tile({ id: 'c', status: 'failed', failWhy: 'no signal' })]
    expect(sentTiles(tiles).map((t) => t.id)).toEqual(['a'])
    expect(photosInFlight(tiles)).toBe(true)
    expect(photosInFlight([tile({ id: 'a' }), tile({ id: 'c', status: 'failed' })])).toBe(false)
  })

  it('puts a tile on its stage, and asks for one only on a job with stages', () => {
    const tiles = [tile({ id: 'a', fixtureId: 'r', stageName: 'Rough In' }), tile({ id: 'b' })]
    expect(tilesOnStage(tiles, 'r').map((t) => t.id)).toEqual(['a'])
    expect(tileNeedsStage(tiles[1]!, 3)).toBe(true)
    expect(tileNeedsStage(tiles[0]!, 3)).toBe(false)
    expect(tileNeedsStage(tiles[1]!, 1)).toBe(false)
  })

  it('says what Save writes, and waits for a shot still on its way', () => {
    expect(reportSaveWords({ jobPct: 36, tiles: [], saving: false })).toBe('Save · job 36%')
    expect(reportSaveWords({ jobPct: 36, tiles: [tile({ id: 'a' }), tile({ id: 'b' })], saving: false })).toBe('Save · job 36% · 2 photos')
    expect(reportSaveWords({ jobPct: 36, tiles: [tile({ id: 'a' }), tile({ id: 'b', status: 'shrinking' })], saving: false })).toBe('Sending 1 photo…')
    expect(reportSaveWords({ jobPct: 36, tiles: [tile({ id: 'a', status: 'sending' }), tile({ id: 'b', status: 'shrinking' })], saving: false })).toBe('Sending 2 photos…')
    expect(reportSaveWords({ jobPct: 36, tiles: [tile({ id: 'a' })], saving: true })).toBe('Saving…')
    // A failed shot does not ride and does not hold Save.
    expect(reportSaveWords({ jobPct: 36, tiles: [tile({ id: 'a' }), tile({ id: 'b', status: 'failed' })], saving: false })).toBe('Save · job 36% · 1 photo')
    // A Note or a Walk files no percent: Save names the report and its photos only (v2.6126).
    expect(reportSaveWords({ jobPct: null, tiles: [tile({ id: 'a' })], saving: false })).toBe('Save report · 1 photo')
    expect(reportSaveWords({ jobPct: null, tiles: [], saving: false })).toBe('Save report')
  })

  it('reads a card row: in Drive, not yet, or not yet with the reason', () => {
    expect(cardPhotoWords({ drive_file_id: 'd1', fail_why: null, storage_path: null })).toEqual({ text: 'in Drive', tone: 'filed' })
    expect(cardPhotoWords({ drive_file_id: null, fail_why: null, storage_path: 'j/p.jpg' })).toEqual({ text: 'not in Drive yet', tone: 'waiting' })
    expect(cardPhotoWords({ drive_file_id: null, fail_why: 'That job has no Drive folder yet.', storage_path: 'j/p.jpg' })).toEqual({ text: 'not in Drive yet · That job has no Drive folder yet.', tone: 'held' })
    expect(driveFileUrl('abc/1')).toBe('https://drive.google.com/file/d/abc%2F1/view')
  })

  it('writes the photos’ clause for the Stage progress line, and makes ids', () => {
    expect(photosSentence([])).toBe('')
    expect(photosSentence([tile({ id: 'a' })])).toBe('1 photo')
    expect(photosSentence([tile({ id: 'a', stageName: 'Rough In' })])).toBe('1 photo on Rough In')
    // A photo that answers a checklist question (PR 6) is counted after the stages.
    expect(photosSentence([tile({ id: 'a', stageName: 'Rough In', questionId: 'q1' }), tile({ id: 'b', stageName: 'Rough In' })])).toBe('2 photos on Rough In, 1 answers a checklist question')
    expect(photosSentence([tile({ id: 'a', questionId: 'q1' }), tile({ id: 'b', questionId: 'q2' })])).toBe('2 photos, 2 answer checklist questions')
    expect(photosSentence([tile({ id: 'a', stageName: 'Rough In' }), tile({ id: 'b', stageName: 'Rough In' }), tile({ id: 'c', stageName: 'Top Out' })])).toBe('3 photos on Rough In and Top Out')
    expect(photosSentence([tile({ id: 'a', stageName: 'Rough In' }), tile({ id: 'b', stageName: 'Top Out' }), tile({ id: 'c', stageName: 'Trim Set' })])).toBe('3 photos on Rough In, Top Out and Trim Set')
    expect(newPhotoId()).not.toBe(newPhotoId())
  })

  it('words the line over the tiles and the photo count', () => {
    expect(newPhotoLine({ shrinkWords: '4.2 MB → 310 KB · 1600 px', jobHasFolder: true })).toBe("New photo · 4.2 MB → 310 KB · 1600 px · goes to the job's Drive folder")
    expect(newPhotoLine({ shrinkWords: '310 KB', jobHasFolder: false })).toBe('New photo · 310 KB · kept until the job has a Drive folder')
    expect(photoCountWords(0)).toBe('')
    expect(photoCountWords(1)).toBe('1 photo')
    expect(photoCountWords(3)).toBe('3 photos')
  })
})
