import { describe, expect, it } from 'vitest'
import { whereFilesGoFromAnswer } from './whereFilesGoTab'

/** Task cards (#273, PR 4): the Tasks folder on the Where files go answer, the Fleet folder's shape. */
describe('whereFilesGoFromAnswer · the Tasks folder', () => {
  it('reads the tasks folder as it reads the fleet one, and null while none is set', () => {
    const url = 'https://drive.google.com/drive/folders/t1'
    expect(whereFilesGoFromAnswer({ tasks: { id: 't1', url, ok: true, words: 'The app can write here.', folder: null } }).tasks).toEqual({ id: 't1', url, ok: true, words: 'The app can write here.', folder: null })
    expect(whereFilesGoFromAnswer({}).tasks).toBeNull()
    expect(whereFilesGoFromAnswer({ tasks: null }).tasks).toBeNull()
  })
})
