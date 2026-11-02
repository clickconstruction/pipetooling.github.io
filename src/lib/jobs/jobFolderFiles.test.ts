/**
 * The folder listing's words (v2.6299): the function's answer parsed defensively and ordered, counts, sizes, days, who,
 * where a file came from (the app's own Drive account as the app, v2.6334), the empty words of a folder made and not
 * made, and the *more* line. Made-up names only.
 */
import { describe, expect, it } from 'vitest'
import { SHOW_FIRST, byTheApp, fileDayWords, fileMetaWords, fileSizeWords, fromWords, hasAnyFolder, jobFolderFilesFromAnswer, moreWords, sectionCountWords, sectionEmptyWords, type JobFolderFile } from './jobFolderFiles'

const NOW = new Date('2026-11-02T01:00:00Z')
const file = (id: string, over: Partial<JobFolderFile> = {}): JobFolderFile => ({ id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 2_200_000, modified: '2026-11-01T20:00:00Z', by: 'Dana Example', url: `https://drive.google.com/file/d/${id}/view`, from: null, ...over })

describe('jobFolderFilesFromAnswer', () => {
  it('reads the function’s shape, drops what it does not know and orders the five folders', () => {
    const read = jobFolderFilesFromAnswer({
      job: { folderId: '1job', url: 'https://drive.google.com/drive/folders/1job', hold: null },
      sections: [
        { key: 'job', name: 'Job folder', folderId: '1job', url: 'u', files: [{ id: 'a', name: 'notes.txt', mime: 'text/plain', bytes: 12, modified: '2026-11-01T10:00:00Z', by: 'Dana', url: 'f', from: { kind: 'link' } }], more: false },
        { key: 'plans', name: 'Plans', folderId: null, url: null, files: [], more: false },
        { key: 'nonsense', name: 'x', folderId: '1x', url: null, files: [], more: false },
        { key: 'pictures', name: 'Customer Pictures', folderId: '1pic', url: 'p', files: [{ id: 'b', from: { kind: 'photo', source: 'report' } }, { name: 'no id' }, 'junk'], more: true },
      ],
    })
    expect(read.sections.map((s) => s.key)).toEqual(['pictures', 'plans', 'job'])
    expect(read.sections[0]!.files).toHaveLength(1)
    expect(read.sections[0]!.files[0]).toMatchObject({ id: 'b', name: 'Untitled', from: { kind: 'photo', source: 'report' } })
    expect(read.sections[0]!.more).toBe(true)
    expect(read.sections[2]!.files[0]!.from).toEqual({ kind: 'link', source: null })
    expect(read.job).toEqual({ folderId: '1job', url: 'https://drive.google.com/drive/folders/1job', hold: null })
  })

  it('reads an unknown answer as empty and never throws', () => {
    expect(jobFolderFilesFromAnswer(null)).toEqual({ job: { folderId: null, url: null, hold: null }, sections: [] })
    expect(jobFolderFilesFromAnswer({ sections: 'nope' }).sections).toEqual([])
    expect(hasAnyFolder(jobFolderFilesFromAnswer({}))).toBe(false)
    expect(hasAnyFolder(jobFolderFilesFromAnswer({ sections: [{ key: 'plans', folderId: '1p' }] }))).toBe(true)
  })
})

describe('the words', () => {
  it('counts a folder', () => {
    expect(sectionCountWords({ files: [], more: false })).toBe('Empty')
    expect(sectionCountWords({ files: [file('a')], more: false })).toBe('1 file')
    expect(sectionCountWords({ files: [file('a'), file('b')], more: false })).toBe('2 files')
    expect(sectionCountWords({ files: Array.from({ length: 100 }, (_, i) => file(`f${i}`)), more: true })).toBe('100 or more files')
  })

  it('sizes and days as people read them', () => {
    expect(fileSizeWords(null)).toBeNull()
    expect(fileSizeWords(500)).toBe('1 KB')
    expect(fileSizeWords(412 * 1024)).toBe('412 KB')
    expect(fileSizeWords(2_200_000)).toBe('2.1 MB')
    expect(fileSizeWords(184 * 1024 * 1024)).toBe('184 MB')
    expect(fileDayWords('2026-11-01T20:00:00Z', NOW)).toBe('Nov 1')
    expect(fileDayWords('2025-03-09T20:00:00Z', NOW)).toBe('Mar 9, 2025')
    expect(fileDayWords('not a date', NOW)).toBeNull()
    expect(fileDayWords(null, NOW)).toBeNull()
  })

  it('joins the row’s second line from what Drive said', () => {
    expect(fileMetaWords(file('a'), NOW)).toBe('Nov 1 · 2.1 MB · Dana Example')
    expect(fileMetaWords(file('a', { bytes: null, by: null }), NOW)).toBe('Nov 1')
    expect(fileMetaWords(file('a', { modified: null, bytes: null, by: null }), NOW)).toBe('')
  })

  it('says where a file came from', () => {
    expect(fromWords(file('a'))).toEqual({ text: 'Added in Drive', tone: 'hand' })
    expect(fromWords(file('a', { from: { kind: 'photo', source: 'report' } }))).toEqual({ text: 'From the app · a report photo', tone: 'app' })
    expect(fromWords(file('a', { from: { kind: 'photo', source: 'box' } })).text).toBe('From the app · a Tally photo')
    expect(fromWords(file('a', { from: { kind: 'photo', source: 'job' } })).text).toBe('From the app · a job photo')
    expect(fromWords(file('a', { from: { kind: 'photo', source: 'message' } })).text).toBe('From the app · a photo from a text or an email')
    expect(fromWords(file('a', { from: { kind: 'photo', source: 'something new' } })).text).toBe('From the app · a photo the app filed')
    expect(fromWords(file('a', { from: { kind: 'link', source: null } })).text).toBe('From the app · a file the app linked')
  })

  it('reads the app’s own Drive account as the app, never as a person (v2.6334)', () => {
    const app = 'drive-intake@example-drive.iam.gserviceaccount.com'
    expect(byTheApp(app)).toBe(true)
    expect(byTheApp(' Drive-Intake@Example-Drive.IAM.GServiceAccount.com ')).toBe(true)
    expect(byTheApp('Dana Example')).toBe(false)
    expect(byTheApp('dana@example.com')).toBe(false)
    expect(byTheApp('iam.gserviceaccount.com fan club')).toBe(false)
    expect(byTheApp(null)).toBe(false)
    expect(fromWords(file('a', { by: app }))).toEqual({ text: 'From the app · a file the app put there', tone: 'app' })
    // The app's own record still says what the file is.
    expect(fromWords(file('a', { by: app, from: { kind: 'photo', source: 'report' } })).text).toBe('From the app · a report photo')
    expect(fromWords(file('a', { by: app, from: { kind: 'link', source: null } })).text).toBe('From the app · a file the app linked')
    expect(fileMetaWords(file('a', { by: app, bytes: 1024 }), NOW)).toBe('Nov 1 · 1 KB')
    expect(fileMetaWords(file('a', { by: app, modified: null, bytes: null }), NOW)).toBe('')
  })

  it('writes the empty words for a folder made and one not made', () => {
    expect(sectionEmptyWords({ name: 'Plans', folderId: null })).toEqual({ main: 'Plans is not made yet.', tail: 'The app makes it when something first lands in it.' })
    expect(sectionEmptyWords({ name: 'Plans', folderId: '1p' })).toEqual({ main: 'Nothing in Plans yet.', tail: 'Drop a file in the folder and it shows here.' })
  })

  it('writes the more line only past the first rows', () => {
    const five = Array.from({ length: SHOW_FIRST }, (_, i) => file(`f${i}`))
    expect(moreWords({ files: five, more: false })).toBeNull()
    expect(moreWords({ files: [...five, file('x'), file('y')], more: false })).toBe('and 2 more in Drive')
    expect(moreWords({ files: Array.from({ length: 100 }, (_, i) => file(`f${i}`)), more: true })).toBe('and 95 or more in Drive')
    expect(moreWords({ files: five, more: true })).toBe('and more in Drive')
  })
})
