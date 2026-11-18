import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { runFilingPayload, type RunNotice } from './lienDeskRun'
import { LIEN_MAILED_COPY_WORDS, lienMailedCopiesWith, lienMailedCopiesWithout, lienMailedCopyAddedWords, lienMailedCopyDocument, lienMailedCopyKey, lienMailedCopyName, lienMailedCopyProblem, lienMailedCopyTakeOffAsk, lienMailedCopyTakenOffWords, parseLienMailedCopies, type LienMailedCopy, lienMailedCopyPutBackWords } from './lienMailedCopies'

const copy = (n: number, over: Partial<LienMailedCopy> = {}): LienMailedCopy => ({ url: `https://drive.google.com/file/d/f${n}/view`, driveFileId: `f${n}`, name: `Lien notice as mailed · 650 · 2026-11-16${n > 1 ? ` · ${n}` : ''}.pdf`, at: '2026-11-16T18:00:00.000Z', by: 'u1', ...over })

describe('the mailed copies as the notice remembers them', () => {
  it('reads the column without trust: a list of files with a link, anything else as none', () => {
    expect(parseLienMailedCopies(null)).toEqual([])
    expect(parseLienMailedCopies('[]')).toEqual([])
    expect(parseLienMailedCopies({ url: 'https://example.test/a' })).toEqual([])
    expect(parseLienMailedCopies([copy(1), null, 7, { url: 'not a link', name: 'x' }, { url: ' https://example.test/b ', by: '' }])).toEqual([copy(1), { url: 'https://example.test/b', driveFileId: '', name: 'the mailed copy', at: '', by: null }])
  })

  it('adds a file last and never lists one Drive file twice', () => {
    expect(lienMailedCopiesWith([], copy(1))).toEqual([copy(1)])
    expect(lienMailedCopiesWith([copy(1)], copy(2)).map((c) => c.driveFileId)).toEqual(['f1', 'f2'])
    expect(lienMailedCopiesWith([copy(1), copy(2)], copy(1, { at: 'later' })).map((c) => [c.driveFileId, c.at])).toEqual([['f2', '2026-11-16T18:00:00.000Z'], ['f1', 'later']])
  })

  it('takes one file off and leaves the others in their order (v2.7525); a row with no Drive id is told by its link', () => {
    expect(lienMailedCopiesWithout([copy(1), copy(2), copy(3)], copy(2)).map((c) => c.driveFileId)).toEqual(['f1', 'f3'])
    expect(lienMailedCopiesWithout([copy(1)], copy(1))).toEqual([])
    // A file that is not on the list changes nothing.
    expect(lienMailedCopiesWithout([copy(1)], copy(9))).toEqual([copy(1)])
    const bare = { url: 'https://example.test/b', driveFileId: '', name: 'the mailed copy', at: '', by: null }
    expect(lienMailedCopyKey(bare)).toBe('https://example.test/b')
    expect(lienMailedCopiesWithout([copy(1), bare], bare)).toEqual([copy(1)])
    expect(lienMailedCopiesWithout([copy(1), bare], copy(1))).toEqual([bare])
  })
})

describe('the file a row takes', () => {
  it('takes a scan or a photo up to 10 MB, and says in a sentence why another file cannot go', () => {
    expect(lienMailedCopyProblem({ size: 400_000, type: 'application/pdf', name: 'scan.pdf' })).toBeNull()
    expect(lienMailedCopyProblem({ size: 400_000, type: 'image/jpeg', name: 'IMG_0412.jpg' })).toBeNull()
    // A scanner that hands over a PDF with no type still names it.
    expect(lienMailedCopyProblem({ size: 400_000, type: '', name: 'SCAN0007.PDF' })).toBeNull()
    expect(lienMailedCopyProblem({ size: 400_000, type: 'text/plain', name: 'notes.txt' })).toBe('That file is not a scan or a photo. Add a PDF or a picture.')
    expect(lienMailedCopyProblem({ size: 0, type: 'application/pdf', name: 'scan.pdf' })).toBe('That file is empty. Scan the papers again.')
    expect(lienMailedCopyProblem({ size: 14 * 1024 * 1024, type: 'application/pdf', name: 'stack.pdf' })).toBe('That file is 14 MB. The most a file can be is 10 MB. Scan this notice alone, or at a lower quality.')
  })

  it('names the file for what it is, so the Drive folder reads with no app open', () => {
    expect(lienMailedCopyName({ jobNumber: '650', ymd: '2026-11-16', already: 0, file: { type: 'application/pdf', name: 'SCAN0007.PDF' } })).toBe('Lien notice as mailed · 650 · 2026-11-16.pdf')
    expect(lienMailedCopyName({ jobNumber: '650', ymd: '2026-11-16', already: 1, file: { type: 'image/jpeg', name: 'IMG_0412.jpeg' } })).toBe('Lien notice as mailed · 650 · 2026-11-16 · 2.jpeg')
    // A photo off a phone with no extension takes one from its type.
    expect(lienMailedCopyName({ jobNumber: ' 651 ', ymd: '2026-11-16', already: 0, file: { type: 'image/png', name: 'image' } })).toBe('Lien notice as mailed · 651 · 2026-11-16.png')
    expect(lienMailedCopyName({ jobNumber: '', ymd: '2026-11-16', already: 0, file: { type: '', name: 'photo' } })).toBe('Lien notice as mailed · 2026-11-16.jpg')
  })

  it('a retainage notice’s file says so in its name (v2.7525)', () => {
    expect(lienMailedCopyName({ jobNumber: '650', ymd: '2026-11-16', already: 0, file: { type: 'application/pdf', name: 'SCAN0007.PDF' }, paper: 'retainage' })).toBe('Retainage notice as mailed · 650 · 2026-11-16.pdf')
    expect(lienMailedCopyName({ jobNumber: '650', ymd: '2026-11-16', already: 1, file: { type: 'image/png', name: 'image' }, paper: 'retainage' })).toBe('Retainage notice as mailed · 650 · 2026-11-16 · 2.png')
    expect(lienMailedCopyName({ jobNumber: '650', ymd: '2026-11-16', already: 0, file: { type: 'application/pdf', name: 'a.pdf' }, paper: 'notice' })).toBe('Lien notice as mailed · 650 · 2026-11-16.pdf')
  })
})

describe('the record takes the mailed copy as its saved copy', () => {
  const notice: RunNotice = { itemId: 'it1', jobId: 'j650', kind: 'notice_53_056', label: '650 · AXO Schertz', jobNumber: '650', months: ['2026-07'], amount: 100, fields: {} as RunNotice['fields'], extras: {} as RunNotice['extras'], coverLetter: null, ownerUnconfirmed: false, recipients: [] } as unknown as RunNotice

  it('the first file is the link and the note names every file; with no file the typed link stands as before', () => {
    expect(lienMailedCopyDocument([], { url: 'https://example.test/typed', note: 'the packet' })).toEqual({ url: 'https://example.test/typed', note: 'the packet' })
    expect(lienMailedCopyDocument([])).toEqual({})
    expect(lienMailedCopyDocument([copy(1), copy(2)])).toEqual({ url: copy(1).url, note: `What was mailed: ${copy(1).name}, ${copy(2).name}` })
  })

  it('a link the office typed in the run wins, and its note comes first', () => {
    expect(lienMailedCopyDocument([copy(1)], { url: ' https://example.test/typed ', note: ' green cards ' })).toEqual({ url: 'https://example.test/typed', note: `green cards · What was mailed: ${copy(1).name}` })
  })

  it('reaches the filing as document_url and document_note', () => {
    const payload = runFilingPayload(notice, [], 'u1', lienMailedCopyDocument([copy(1)]))
    expect(payload.document_url).toBe(copy(1).url)
    expect(payload.document_note).toBe(`What was mailed: ${copy(1).name}`)
    expect(runFilingPayload(notice, [], 'u1', lienMailedCopyDocument([]))).not.toHaveProperty('document_url')
  })
})

describe('the words', () => {
  it('every sentence a person reads keeps to plain words', () => {
    for (const s of [LIEN_MAILED_COPY_WORDS.title, LIEN_MAILED_COPY_WORDS.printFirst, LIEN_MAILED_COPY_WORDS.failed, lienMailedCopyAddedWords('scan.pdf'), lienMailedCopyProblem({ size: 1, type: 'text/plain', name: 'a.txt' })!, lienMailedCopyProblem({ size: 0, type: 'application/pdf', name: 'a.pdf' })!]) expect(plainWordsFailures(s), s).toEqual([])
    expect([LIEN_MAILED_COPY_WORDS.add, LIEN_MAILED_COPY_WORDS.another, LIEN_MAILED_COPY_WORDS.open]).toEqual(['Add what was mailed', 'Add another', 'Open in Drive'])
  })

  it('taking a file off asks first, names the act on its press, and says the file goes to Drive’s trash (v2.7525, v2.7699)', () => {
    expect(lienMailedCopyTakeOffAsk('scan.pdf')).toBe('Take scan.pdf off this notice? The file goes to Drive’s trash. Drive keeps it there 30 days.')
    expect(lienMailedCopyTakenOffWords('scan.pdf', { where: 'trash' })).toBe('Took scan.pdf off this notice. The file is in Drive’s trash.')
    expect(lienMailedCopyTakenOffWords('scan.pdf', { where: 'drive', why: 'A lien record still uses it.', retry: false })).toBe('Took scan.pdf off this notice. The file stays in Drive. A lien record still uses it.')
    // A link that is not a Drive file's: nothing was asked of Drive, so nothing is said of it.
    expect(lienMailedCopyTakenOffWords('scan.pdf')).toBe('Took scan.pdf off this notice.')
    expect(lienMailedCopyPutBackWords('scan.pdf')).toBe('Put scan.pdf back on this notice.')
    expect([LIEN_MAILED_COPY_WORDS.takeOff, LIEN_MAILED_COPY_WORDS.takeOffConfirm, LIEN_MAILED_COPY_WORDS.keep]).toEqual(['Take off', 'Take it off', 'Keep it'])
    for (const s of [lienMailedCopyTakeOffAsk('the scan'), lienMailedCopyTakenOffWords('the scan', { where: 'trash' }), lienMailedCopyPutBackWords('the scan'), LIEN_MAILED_COPY_WORDS.takeOffFailed]) expect([s, plainWordsFailures(s)]).toEqual([s, []])
  })
})
