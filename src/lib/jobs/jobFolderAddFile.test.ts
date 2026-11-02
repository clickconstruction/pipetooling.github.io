import { describe, expect, it } from 'vitest'
import { ADD_FILE_MAX_BYTES, ADD_FILE_WORDS, addFileConfirmLabel, addFileSizeWords, addFileTooBig, addFileWhereFor, addedWords } from './jobFolderAddFile'

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
