import { describe, expect, it } from 'vitest'
import { ADD_FILE_MAX_BYTES, ADD_FILE_WORDS, ADD_SHEET_WORDS, addFileConfirmLabel, addFileSizeWords, addFileTooBig, addFileWhereFor, addedWords, folderPhotoFileName } from './jobFolderAddFile'

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
