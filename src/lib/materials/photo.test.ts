import { describe, expect, it } from 'vitest'
import { actIsFresh, FRESH_ACT_MS, photoFileName, photoMarkWords, photoStatusWords, photoWords, type PhotoNote } from './photo'

const NOW = new Date('2026-10-28T20:00:00Z')

describe('the photo name', () => {
  it('names the shot the way the sweep names a photo in Drive: day, who, what', () => {
    expect(photoFileName({ at: '2026-10-28T20:00:00Z', byName: 'Jordan', containerLabel: 'A1', after: 'Put in', mime: 'image/jpeg' })).toBe('2026-10-28 Jordan · A1 after Put in.jpg')
    expect(photoFileName({ at: '2026-10-28T20:00:00Z', byName: 'Jordan', containerLabel: 'A1', after: null, mime: 'image/heic' })).toBe('2026-10-28 Jordan · A1.heic')
  })

  it('falls back to a jpeg ending when the phone says nothing about the type', () => {
    expect(photoFileName({ at: '2026-10-28T20:00:00Z', byName: 'Carla', containerLabel: 'B7', after: 'Count', mime: '' })).toBe('2026-10-28 Carla · B7 after Count.jpg')
  })

  it('says what just happened for ten minutes', () => {
    expect(photoWords('A1', 'Put in')).toBe('A1 after Put in')
    expect(photoWords('A1', null)).toBe('A1')
    const t = NOW.getTime()
    expect(actIsFresh(t - 60_000, t)).toBe(true)
    expect(actIsFresh(t - FRESH_ACT_MS - 1, t)).toBe(false)
  })
})

describe('photoMarkWords', () => {
  const note = (at: string, byName = 'Jordan'): PhotoNote => ({ id: at, jobId: 'j1', containerId: 'a1', fileName: `${at} ${byName} · A1.jpg`, byUserId: null, byName, at, bytes: 312_000, width: 1600, height: 1200, status: 'filed', driveFileId: 'd1', storagePath: null })

  it('reads nothing, one photo, then a count with the last one', () => {
    expect(photoMarkWords([], NOW)).toBe('')
    expect(photoMarkWords([note('2026-10-28T15:00:00Z')], NOW)).toBe('1 photo today by Jordan')
    expect(photoMarkWords([note('2026-10-25T15:00:00Z', 'Carla'), note('2026-10-27T15:00:00Z')], NOW)).toBe('2 photos, last yesterday by Jordan')
    expect(photoMarkWords([note('2026-10-20T15:00:00Z')], NOW)).toBe('1 photo 8 days ago by Jordan')
  })

  it('says where a shot is in plain words', () => {
    expect(photoStatusWords('on-phone')).toBe('kept on this phone until there is signal')
    expect(photoStatusWords('filed')).toBe("in the job's folder")
  })
})
