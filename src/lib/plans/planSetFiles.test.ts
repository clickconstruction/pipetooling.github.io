import { describe, expect, it } from 'vitest'
import { asBuiltFileName, asBuiltPressWords, filedWords, fileHoldWhy, filingWords, pickedFilesWords, planSetFileKind, splitReadyFiles } from './planSetFiles'

const photo = (name: string, size = 2_400_000) => ({ name, size, type: 'image/jpeg' })
const pdf = (name: string, size = 900_000) => ({ name, size, type: 'application/pdf' })

describe('planSetFileKind / fileHoldWhy', () => {
  it('reads photos and PDFs by type, then by name; anything else is held with its reason', () => {
    expect(planSetFileKind(photo('IMG_4411.jpg'))).toBe('photo')
    expect(planSetFileKind({ name: 'scan.PDF', type: '' })).toBe('pdf')
    expect(planSetFileKind({ name: 'sheet.heic', type: '' })).toBe('photo')
    expect(planSetFileKind({ name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('other')
    expect(fileHoldWhy(photo('a.jpg'))).toBeNull()
    expect(fileHoldWhy(photo('big.jpg', 11 * 1024 * 1024))).toBe('over 10 MB (11 MB)')
    expect(fileHoldWhy({ name: 'notes.docx', size: 10, type: 'application/msword' })).toBe('not a photo or a PDF')
  })
  it('splits what goes from what stays, keeping the order', () => {
    const r = splitReadyFiles([photo('1.jpg'), photo('big.jpg', 20_000_000), pdf('as-built.pdf')])
    expect(r.ready.map((f) => f.name)).toEqual(['1.jpg', 'as-built.pdf'])
    expect(r.held).toEqual([{ file: photo('big.jpg', 20_000_000), why: 'over 10 MB (19.1 MB)' }])
  })
})

describe('words', () => {
  it('counts the picked files by kind with the size in all', () => {
    expect(pickedFilesWords([])).toBe('')
    expect(pickedFilesWords([photo('1.jpg', 860 * 1024)])).toBe('1 photo · 860 KB')
    expect(pickedFilesWords([photo('1.jpg'), photo('2.jpg'), pdf('a.pdf')])).toBe('2 photos and 1 PDF · 5.4 MB')
  })
  it('names a phone photo after the job and the day, counted; a PDF with a real name keeps it', () => {
    expect(asBuiltFileName('JP972', '2026-11-02', 1, 3, photo('IMG_4411.jpg'))).toBe('As-built · JP972 · 2026-11-02 · 1 of 3.jpg')
    expect(asBuiltFileName('JP972', '2026-11-02', 1, 1, { name: 'blob', type: 'image/png' })).toBe('As-built · JP972 · 2026-11-02.png')
    expect(asBuiltFileName('JP972', '2026-11-02', 2, 2, pdf('Lodge as-built markups.pdf'))).toBe('Lodge as-built markups.pdf')
    expect(asBuiltFileName('JP972', '2026-11-02', 1, 1, pdf('Scan 3.pdf'))).toBe('As-built · JP972 · 2026-11-02.pdf')
  })
  it('the press says what it does with its count, and holds never kill it', () => {
    expect(asBuiltPressWords(0, 0)).toEqual({ button: 'Add the as-built', foot: null, dead: false })
    expect(asBuiltPressWords(3, 0).button).toBe('Add the as-built with 3 files')
    expect(asBuiltPressWords(2, 1).button).toBe('Add the as-built with 2 files · 1 held ▸')
    expect(asBuiltPressWords(2, 1).dead).toBe(false)
    const only = asBuiltPressWords(0, 2)
    expect(only.button).toBe('Add the as-built without the files ▸')
    expect(only.dead).toBe(false)
    expect(only.foot).toBe('2 are held. They stay here with the reason. The as-built adds without them.')
  })
  it('filing and filed words', () => {
    expect(filingWords(0, 5)).toBe('Filing 1 of 5…')
    expect(filingWords(4, 5)).toBe('Filing 5 of 5…')
    expect(filedWords(3, 0)).toEqual({ line: 'Filed 3 files.', head: null, tone: 'success' })
    expect(filedWords(2, 1).line).toBe('Filed 2 files. 1 did not file.')
    expect(filedWords(0, 2).tone).toBe('error')
  })
})
