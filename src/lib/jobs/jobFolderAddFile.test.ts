import { describe, expect, it } from 'vitest'
import { ADD_FILE_MAX_BYTES, ADD_FILE_WORDS, ADD_SHEET_WORDS, AddFileFailure, addFileCanRetry, addFileConfirmLabel, addFileFailureOf, addFileSizeWords, addFileTooBig, addFileWhereFor, addedWords, folderPhotoFileName } from './jobFolderAddFile'

describe('jobFolderAddFile (v2.6303)', () => {
  it('maps the Job folders rows to where a put lands, and serves no other row', () => {
    expect(addFileWhereFor('Job folder')).toBe('top')
    expect(addFileWhereFor('Plans')).toBe('plans')
    expect(addFileWhereFor('Pictures')).toBe('pictures')
    expect(addFileWhereFor('Bid folder')).toBeNull()
  })

  it('holds the function’s 10 MB cap at the byte', () => {
    expect(addFileTooBig(ADD_FILE_MAX_BYTES)).toBe(false)
    expect(addFileTooBig(ADD_FILE_MAX_BYTES + 1)).toBe(true)
    expect(ADD_FILE_WORDS.tooBig).toMatch(/Over 10 MB/)
  })

  it('reads a size as a person does', () => {
    expect(addFileSizeWords(12)).toBe('12 B')
    expect(addFileSizeWords(410 * 1024)).toBe('410 KB')
    expect(addFileSizeWords(2.1 * 1024 * 1024)).toBe('2.1 MB')
    expect(addFileSizeWords(1024 * 1024)).toBe('1 MB')
  })

  it('names the act and the folder on the press, and the file once it is there', () => {
    expect(addFileConfirmLabel('Plans')).toBe('Add it to Plans')
    expect(addedWords('Permit 2026-0412.pdf', 'Plans')).toBe('Permit 2026-0412.pdf is in Plans.')
    expect(ADD_FILE_WORDS.where.top).toMatch(/the job’s folder itself/)
  })
})

describe('the phone’s Add ▾ sheet (punch list #355 H, v2.7282)', () => {
  it('names the three rows and the shot as the photo sweep names one', () => {
    expect(ADD_SHEET_WORDS.button).toBe('Add ▾')
    expect(ADD_SHEET_WORDS.title('Plans')).toBe('Add to Plans')
    expect([ADD_SHEET_WORDS.photo, ADD_SHEET_WORDS.file, ADD_SHEET_WORDS.drive]).toEqual(['Take a photo', 'Choose a file', 'Open in Google Drive'])
    const name = folderPhotoFileName({ at: '2026-11-14T15:00:00Z', byName: 'Robert', folder: 'Plans', mime: 'image/jpeg' })
    expect(name).toMatch(/^2026-11-14 Robert · Plans\.jpe?g$/)
  })
})

describe('addFileFailureOf (v2.7635): a file that did not go up says why, and whether it can go again', () => {
  it('reads no answer at all as a file that never reached the app, with the second try', () => {
    const f = addFileFailureOf(null)
    expect(f).toBeInstanceOf(AddFileFailure)
    expect(f.message).toBe(ADD_FILE_WORDS.lost)
    expect(f.retry).toBe(true)
  })

  it('shows the function’s own sentence and takes its answer on the second try', () => {
    const refused = addFileFailureOf({ error: 'Drive did not take the file. Drive said: quota exceeded.', retry: false, status: 502 })
    expect(refused.message).toBe('Drive did not take the file. Drive said: quota exceeded.')
    expect(refused.retry).toBe(false)
    expect(addFileFailureOf({ error: 'The app could not reach Drive.', retry: true, status: 502 }).retry).toBe(true)
  })

  it('reads the status when the function gave no answer on the second try', () => {
    expect(addFileFailureOf({ error: 'That job has no Drive folder yet.', status: 409 }).retry).toBe(false)
    expect(addFileFailureOf({ error: 'Office only.', status: 403 }).retry).toBe(false)
    expect(addFileFailureOf({ error: 'The index did not answer.', status: 500 }).retry).toBe(true)
    expect(addFileFailureOf({ error: 'Slow down.', status: 429 }).retry).toBe(true)
    expect(addFileFailureOf({ error: 'Refused in the body of a 200.', status: null }).retry).toBe(false)
  })

  it('never shows the old catch-all’s bare word', () => {
    for (const bare of ['failed', '', undefined]) {
      const f = addFileFailureOf({ error: bare, status: 500 })
      expect(f.message).toBe(ADD_FILE_WORDS.failed)
      expect(f.retry).toBe(true)
    }
    expect(addFileFailureOf({ error: 'failed', status: 500 }, 'The photo was not saved.').message).toBe('The photo was not saved.')
  })

  it('offers the second try for its own retryable failure and for nothing else', () => {
    expect(addFileCanRetry(new AddFileFailure('x', true))).toBe(true)
    expect(addFileCanRetry(new AddFileFailure('x', false))).toBe(false)
    expect(addFileCanRetry(new Error('That file is over 10 MB.'))).toBe(false)
    expect(addFileCanRetry({ retry: true })).toBe(false)
  })
})
