import { describe, expect, it } from 'vitest'
import { addPickedFiles, asBuiltFileName, asBuiltPressWords, fileAgainLabel, filedWords, fileHoldWhy, filingWords, heldBehindLine, mailFilesWords, pickedFilesWords, planSetFileKind, splitMailFiles, splitReadyFiles, type MailFilesResult } from './planSetFiles'

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
  it('names the press that files again and a file held back', () => {
    expect(fileAgainLabel(1)).toBe('File 1 file again')
    expect(fileAgainLabel(3)).toBe('File 3 files again')
    expect(heldBehindLine('huge.jpg', 'over 10 MB (11 MB)')).toBe('huge.jpg stayed behind · over 10 MB (11 MB)')
  })
})

describe('addPickedFiles', () => {
  it('a second pick adds to the first, as a phone’s camera hands back one shot a press', () => {
    const one = { ...photo('image.jpg'), lastModified: 1 }
    const two = { ...photo('image.jpg'), lastModified: 2 }
    const three = pdf('sheets.pdf')
    expect(addPickedFiles(addPickedFiles(addPickedFiles([], [one]), [two]), [three])).toEqual([one, two, three])
  })
  it('the same file picked twice counts once', () => {
    const one = { ...photo('image.jpg'), lastModified: 1 }
    expect(addPickedFiles([one], [{ ...one }, one])).toEqual([one])
  })
})

describe('a mail’s files', () => {
  const none: MailFilesResult = { readFailed: null, landed: 0, failed: [], left: [], linkTyped: false, noLineFiles: 0 }

  it('splits the files we hold a copy of from the ones that stayed in Gmail', () => {
    const kept = { id: 'a1', name: 'spec.pdf', mime: null, copied: true, leftWhy: null }
    const big = { id: 'a2', name: 'full-set.zip', mime: null, copied: false, leftWhy: 'too_big' }
    expect(splitMailFiles([kept, big])).toEqual({ ready: [kept], left: [big] })
  })

  it('no file says only what is true: it holds a link only when someone typed one', () => {
    expect(mailFilesWords(none)).toEqual({ words: 'The mail had no file to keep.', tone: 'success' })
    expect(mailFilesWords({ ...none, linkTyped: true })).toEqual({ words: 'The mail had no file to keep. The paper holds its link.', tone: 'success' })
  })

  it('green only when every file landed', () => {
    expect(mailFilesWords({ ...none, landed: 1 })).toEqual({ words: 'The mail’s file is in the paper’s folder.', tone: 'success' })
    expect(mailFilesWords({ ...none, landed: 2 }).words).toBe('The mail’s 2 files are in the paper’s folder.')
    const part = mailFilesWords({ ...none, landed: 1, failed: [{ name: 'loads.xlsx', why: 'Drive answered 500' }] })
    expect(part).toEqual({ words: 'The mail’s file is in the paper’s folder. One file did not land: loads.xlsx: Drive answered 500.', tone: 'warning' })
    expect(mailFilesWords({ ...none, failed: [{ name: 'a', why: 'One.' }, { name: 'b', why: 'Two.' }] }).words).toBe('2 files did not land: a: One. b: Two.')
  })

  it('names a file that stayed in Gmail and why', () => {
    const left = mailFilesWords({ ...none, landed: 1, left: [{ name: 'full-set.zip', leftWhy: 'too_big' }, { name: 'old.pdf', leftWhy: 'not_copied' }] })
    expect(left.words).toBe('The mail’s file is in the paper’s folder. full-set.zip stays in Gmail, too big for us to keep. old.pdf stays in Gmail, never copied here.')
    expect(left.tone).toBe('warning')
  })

  it('a read that failed says so and never reads as a mail with no file', () => {
    expect(mailFilesWords({ ...none, readFailed: 'No connection' })).toEqual({ words: 'The mail’s files did not read: No connection. The paper is kept.', tone: 'warning' })
  })

  it('a mail no line holds says its files stayed behind', () => {
    expect(mailFilesWords({ ...none, noLineFiles: 1 })).toEqual({ words: 'The mail’s file stayed in Gmail, since no line on the job holds this mail.', tone: 'warning' })
    expect(mailFilesWords({ ...none, noLineFiles: 3 }).words).toBe('The mail’s 3 files stayed in Gmail, since no line on the job holds this mail.')
  })
})
