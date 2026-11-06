import { describe, expect, it } from 'vitest'
import {
  TASK_PHOTO_STANDING_WORDS,
  instanceIdFromPath,
  roadmapTaskFolderPath,
  sortTaskPhotos,
  taskFolderName,
  taskPhotoCaption,
  taskPhotoDriveName,
  taskPhotoPath,
  taskPhotoStanding,
} from './taskPhotos'

const INSTANCE = '0159a7c5-cb55-4217-97e8-bfc93f1cd08b'

describe('the bucket path', () => {
  it('names a shot by its day row and reads the day row back', () => {
    expect(taskPhotoPath(INSTANCE, 'p1')).toBe(`${INSTANCE}/p1.jpg`)
    expect(instanceIdFromPath(`${INSTANCE}/p1.jpg`)).toBe(INSTANCE)
    expect(instanceIdFromPath('sig/x.png')).toBeNull()
  })
})

describe('the Drive name', () => {
  it('says the day, the person and what the shot is for', () => {
    expect(taskPhotoDriveName({ dayYmd: '2026-11-04', byName: 'Mateo', kind: 'progress', percentAt: 67 })).toBe('2026-11-04 Mateo · 67%.jpg')
    expect(taskPhotoDriveName({ dayYmd: '2026-11-05', byName: 'Mateo', kind: 'finish' })).toBe('2026-11-05 Mateo · finish.jpg')
    expect(taskPhotoDriveName({ dayYmd: '2026-11-04', byName: 'Mateo', kind: 'line', lineBody: ' Pipe is  racked by size ' })).toBe('2026-11-04 Mateo · Pipe is racked by size.jpg')
    expect(taskPhotoDriveName({ dayYmd: '2026-11-04', byName: '', kind: 'progress' })).toBe('2026-11-04 Someone · progress.jpg')
  })
  it('keeps a backslash and a control character out of the name, as every Drive name does', () => {
    expect(taskPhotoDriveName({ dayYmd: '2026-11-04', byName: 'A\\B', kind: 'line', lineBody: 'cut\tthe 2/4' })).toBe('2026-11-04 A B · cut the 2/4.jpg')
  })
  it('captions by kind', () => {
    expect(taskPhotoCaption({ kind: 'progress', percentAt: 50 })).toBe('50%')
    expect(taskPhotoCaption({ kind: 'progress', percentAt: null })).toBe('progress')
    expect(taskPhotoCaption({ kind: 'line', lineBody: '' })).toBe('line')
  })
})

describe('the folders', () => {
  it('a one-off card’s folder is the day and the title', () => {
    expect(taskFolderName({ dayYmd: '2026-11-04', title: 'Put the plumbing tools in a neat home' })).toBe('2026-11-04 · Put the plumbing tools in a neat home')
    expect(taskFolderName({ dayYmd: '2026-11-04', title: '' })).toBe('2026-11-04 · Task')
    expect(taskFolderName({ dayYmd: '2026-11-04', title: 'x'.repeat(200) }).length).toBeLessThanOrEqual(120)
  })
  it('a roadmap card’s folders are its roadmap, its stage and itself', () => {
    expect(roadmapTaskFolderPath({ roadmapTitle: 'Farm 1', stageNumber: 31, stageTitle: 'Shelve the containers', taskNumber: '31.5', taskTitle: 'Weld up the second set of shelves' })).toEqual([
      'Farm 1',
      '31 · Shelve the containers',
      '31.5 · Weld up the second set of shelves',
    ])
    expect(roadmapTaskFolderPath({ roadmapTitle: '', stageNumber: 3, stageTitle: '', taskNumber: '3.1', taskTitle: '' })).toEqual(['Roadmap', '3', '3.1'])
  })
})

describe('a photo’s standing', () => {
  it('reads filed, waiting or failed with the strip’s words', () => {
    expect(taskPhotoStanding({ drive_file_id: 'd', filed_at: 'x' })).toBe('filed')
    expect(taskPhotoStanding({ storage_path: 'p', fail_why: 'no folder' })).toBe('failed')
    expect(taskPhotoStanding({ storage_path: 'p' })).toBe('waiting')
    expect(TASK_PHOTO_STANDING_WORDS.failed).toBe('not in Drive yet')
  })
  it('sorts newest first', () => {
    const rows = [
      { id: 'a', taken_at: '2026-11-04T09:12:00Z', kind: 'progress' },
      { id: 'b', taken_at: '2026-11-05T10:31:00Z', kind: 'finish' },
    ]
    expect(sortTaskPhotos(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })
})
