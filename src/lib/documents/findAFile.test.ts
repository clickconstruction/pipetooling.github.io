import { describe, expect, it } from 'vitest'
import {
  driveBehindIndex,
  driveBehindMeaning,
  emptyFindWords,
  excerptNote,
  excerptParts,
  FIND_MIN_CHARS,
  findAFileFromAnswer,
  findAFileFromIndexAnswer,
  findAFileFromIndexRows,
  foundByWords,
  type FoundFile,
  foundWords,
  groupByHome,
  hitMetaWords,
  homeWords,
  meaningExcerpt,
  needsDriveBehind,
  pathWords,
  sourceWords,
} from './findAFile'

const hit = (over: Partial<FoundFile>): FoundFile => ({
  id: '1AbCdEfGhIjKlMnOpQrSt',
  name: 'Permit 2026-0412.pdf',
  mime: 'application/pdf',
  bytes: 410 * 1024,
  modified: '2026-10-14T15:00:00Z',
  url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  home: { kind: 'job', id: 'job-1', hcpNumber: '1187', clickNumber: null, name: 'Maple Court townhomes' },
  path: 'Plans',
  excerpt: null,
  excerptWhy: null,
  ...over,
})

describe('findAFile (v2.6305)', () => {
  it('reads the function’s answer and shrugs at shapes it does not know', () => {
    const read = findAFileFromAnswer({
      hits: [
        { id: 'a1234567890', name: 'Permit.pdf', mime: 'application/pdf', bytes: 2048, modified: '2026-10-14T15:00:00Z', url: 'https://x/y', home: { kind: 'job', id: 'job-1', hcpNumber: '1187', clickNumber: null, name: 'Maple' }, path: 'Plans' },
        { id: 'b1234567890', name: 'Quote.pdf', home: { kind: 'bid', id: 'bid-1', number: 'b482', name: 'Oak Hill' } },
        { id: 'c1234567890', name: 'Loose.pdf', home: { kind: 'elsewhere', id: 'x' } },
        { name: 'no id' },
        null,
      ],
      more: true,
    })
    expect(read.hits).toHaveLength(3)
    expect(read.hits[0]).toMatchObject({ bytes: 2048, path: 'Plans', home: { kind: 'job', hcpNumber: '1187' } })
    expect(read.hits[1]).toMatchObject({ mime: 'application/octet-stream', bytes: null, modified: null, path: '', home: { kind: 'bid', number: 'b482' } })
    expect(read.hits[1]!.url).toBe('https://drive.google.com/file/d/b1234567890/view')
    expect(read.hits[2]!.home).toBeNull()
    expect(read.more).toBe(true)
    expect(read.noRoot).toBe(false)
    expect(findAFileFromAnswer(null)).toEqual({ hits: [], more: false, noRoot: false, source: 'drive' })
    expect(findAFileFromAnswer({ noRoot: true })).toMatchObject({ noRoot: true })
  })

  it('names a home as its heading', () => {
    expect(homeWords({ kind: 'job', id: 'j', hcpNumber: '1187', clickNumber: null, name: 'Maple Court townhomes' })).toMatch(/^Job .*1187 · Maple Court townhomes$/)
    expect(homeWords({ kind: 'job', id: 'j', hcpNumber: '1187', clickNumber: null, name: null })).toMatch(/^Job .*1187$/)
    expect(homeWords({ kind: 'bid', id: 'b', number: 'b482', name: 'Oak Hill retail' })).toBe('Bid b482 · Oak Hill retail')
    expect(homeWords(null)).toBe('Not under a job')
  })

  it('groups hits under their home in Drive’s order', () => {
    const a = hit({ id: 'a1234567890' })
    const loose = hit({ id: 'l1234567890', home: null, path: 'Click Customers › Someone' })
    const b = hit({ id: 'b1234567890', path: '' })
    const groups = groupByHome([a, loose, b])
    expect(groups.map((g) => g.key)).toEqual(['job:job-1', 'none'])
    expect(groups[0]!.files.map((f) => f.id)).toEqual(['a1234567890', 'b1234567890'])
  })

  it('reads the line under a hit: folder, day, size', () => {
    const now = new Date('2026-11-01T20:00:00Z')
    expect(pathWords(hit({ path: '' }))).toBe('the job’s folder')
    expect(pathWords(hit({ path: '', home: null }))).toBeNull()
    expect(hitMetaWords(hit({}), now)).toBe('Plans · Oct 14 · 410 KB')
    expect(hitMetaWords(hit({ path: '', home: null, modified: null, bytes: null }), now)).toBe('')
  })

  it('reads an excerpt and its marks, drops a mark outside the text, and draws the parts and the notes (v2.6306)', () => {
    const read = findAFileFromAnswer({
      hits: [
        { id: 'a1234567890', name: 'x.pdf', excerpt: { text: '…agreed to the rock clause as written…', marks: [[15, 26], [90, 99]] } },
        { id: 'b1234567890', name: 'scan.pdf', excerptWhy: 'scan' },
        { id: 'c1234567890', name: 'y.pdf', excerptWhy: 'elsewhere' },
      ],
    })
    expect(read.hits[0]!.excerpt).toEqual({ text: '…agreed to the rock clause as written…', marks: [[15, 26]] })
    expect(excerptParts(read.hits[0]!.excerpt!)).toEqual([
      { text: '…agreed to the ', mark: false },
      { text: 'rock clause', mark: true },
      { text: ' as written…', mark: false },
    ])
    expect(read.hits[1]!.excerpt).toBeNull()
    expect(read.hits[1]!.excerptWhy).toBe('scan')
    expect(read.hits[2]!.excerptWhy).toBeNull()
    expect(excerptNote('scan')).toBe('Matched inside the scan.')
    expect(excerptNote('big')).toBe('Too big to read here.')
    expect(excerptNote('kind')).toBeNull()
    expect(excerptNote(null)).toBeNull()
  })

  it('counts the finds and says when there is nothing', () => {
    expect(foundWords({ hits: [], more: false, source: 'drive' }, 'rock')).toBeNull()
    expect(foundWords({ hits: [hit({})], more: false, source: 'drive' }, 'rock clause')).toBe('1 file says “rock clause”, from Drive.')
    expect(foundWords({ hits: [hit({})], more: false, source: 'index' }, 'rock clause')).toBe('1 file says “rock clause”, from our index.')
    expect(foundWords({ hits: [hit({}), hit({})], more: true, source: 'drive' }, 'permit')).toBe('2 files say “permit”, from Drive. Drive has more. Add a word to narrow it.')
    expect(sourceWords('index')).toBe('from our index')
    expect(emptyFindWords('xyzzy').main).toBe('Nothing in the job folders says “xyzzy”. Try other words, or Drive’s own search.')
    expect(FIND_MIN_CHARS).toBe(2)
  })

  it('reads the index’s rows into hits (punch list #240, PR 1): the home from the joined numbers, the headline’s marks as the excerpt, a held row’s note', () => {
    const read = findAFileFromIndexRows([
      {
        drive_file_id: '1AbCdEfGhIjKlMnOpQrSt',
        jobs_ledger_id: 'job-1',
        bid_id: null,
        folder_kind: 'plans',
        path: 'Plans',
        name: 'Rock clause letter.pdf',
        mime: 'application/pdf',
        bytes: 419840,
        modified_at: '2026-10-14T15:00:00Z',
        text_why: null,
        headline: 'the GC agreed to the <mark>rock</mark> <mark>clause</mark> as written',
        hcp_number: '1187',
        click_number: null,
        job_name: 'Maple Court townhomes',
        bid_number: null,
        project_name: null,
      },
      { drive_file_id: '2BcDeFgHiJkLmNoPqRsTu', jobs_ledger_id: null, bid_id: 'bid-1', path: '', name: 'Scan.pdf', mime: 'application/pdf', bytes: null, modified_at: null, text_why: 'scan', headline: null, bid_number: '482', project_name: 'Boerne Retail Shell' },
      { drive_file_id: '3CdEfGhIjKlMnOpQrStUv', jobs_ledger_id: null, bid_id: null, name: 'Loose.txt', mime: 'text/plain', text_why: 'reading', headline: 'nothing marked' },
      { name: 'no id' },
    ])
    expect(read.source).toBe('index')
    expect(read.more).toBe(false)
    expect(read.hits).toHaveLength(3)
    expect(read.hits[0]).toMatchObject({
      id: '1AbCdEfGhIjKlMnOpQrSt',
      url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
      home: { kind: 'job', id: 'job-1', hcpNumber: '1187', clickNumber: null, name: 'Maple Court townhomes' },
      path: 'Plans',
      bytes: 419840,
      excerpt: { text: 'the GC agreed to the rock clause as written', marks: [[21, 32]] },
      excerptWhy: null,
    })
    expect(read.hits[1]).toMatchObject({ home: { kind: 'bid', id: 'bid-1', number: '482', name: 'Boerne Retail Shell' }, excerpt: null, excerptWhy: 'scan' })
    // A headline with no marks is no excerpt; a read the platform stopped reads as slow, which the box keeps quiet about.
    expect(read.hits[2]).toMatchObject({ home: null, excerpt: null, excerptWhy: 'slow' })
    expect(findAFileFromIndexRows(null)).toEqual({ hits: [], more: false, noRoot: false, source: 'index' })
  })

  it('reads a hit found by meaning (PR 4): the nearest chunk’s opening as its line, the tag, and the count line’s words', () => {
    const read = findAFileFromIndexAnswer({
      meaning: true,
      rows: [
        { drive_file_id: '1AbCdEfGhIjKlMnOpQrSt', name: 'GC letter.pdf', mime: 'application/pdf', by: 'meaning', headline: null, chunk_text: 'The general contractor accepts the added cost of the rock encountered in the trench ' + 'x'.repeat(200) },
        { drive_file_id: '2BcDeFgHiJkLmNoPqRsTu', name: 'Rock clause.pdf', mime: 'application/pdf', by: 'both', headline: 'the <mark>rock</mark> clause', chunk_text: 'ignored when the words matched' },
        { drive_file_id: '3CdEfGhIjKlMnOpQrStUv', name: 'Plain.pdf', mime: 'application/pdf', by: 'words', headline: 'a <mark>rock</mark>' },
      ],
    })
    expect(read.meaning).toBe(true)
    expect(read.hits[0]!.by).toBe('meaning')
    expect(read.hits[0]!.excerpt!.marks).toEqual([])
    expect(read.hits[0]!.excerpt!.text.endsWith('…')).toBe(true)
    expect(read.hits[0]!.excerpt!.text.length).toBeLessThanOrEqual(161)
    expect(read.hits[1]!.excerpt).toEqual({ text: 'the rock clause', marks: [[4, 8]] })
    expect(read.hits[1]!.by).toBe('both')
    expect(read.hits[2]!.by).toBe('words')
    expect(foundByWords('meaning')).toBe('by meaning')
    expect(foundByWords('both')).toBe('by the words and the meaning')
    expect(foundByWords('words')).toBeNull()
    expect(foundByWords(undefined)).toBeNull()
    expect(foundWords(read, 'rock')).toBe('3 files say or are about “rock”, from our index.')
    expect(foundWords({ hits: [read.hits[0]!], more: false, source: 'index' }, 'rock')).toBe('1 file is about “rock”, from our index.')
    expect(meaningExcerpt('short')).toEqual({ text: 'short', marks: [] })
    expect(findAFileFromIndexAnswer({ rows: [] })).toEqual({ hits: [], more: false, noRoot: false, source: 'index' })
  })
})

describe('Drive behind hits by meaning alone (PR 4, hardened in review)', () => {
  const hit = (id: string, by?: 'words' | 'meaning' | 'both') => ({ id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 1, modified: null, url: `https://drive.google.com/file/d/${id}/view`, home: null, path: '', excerpt: null, excerptWhy: null, ...(by ? { by } : {}) })
  it('asks Drive when the index found nothing or only meaning; not when any hit has the words', () => {
    expect(needsDriveBehind({ hits: [] })).toBe(true)
    expect(needsDriveBehind({ hits: [hit('a', 'meaning'), hit('b', 'meaning')] })).toBe(true)
    expect(needsDriveBehind({ hits: [hit('a', 'meaning'), hit('b', 'both')] })).toBe(false)
    expect(needsDriveBehind({ hits: [hit('a')] })).toBe(false)
  })
  it('puts Drive’s hits first, then the meaning hits Drive did not name, with Drive’s more; Drive empty leaves the index as it was', () => {
    const index = { hits: [hit('m1', 'meaning'), hit('d2', 'meaning')], more: false, noRoot: false, source: 'index' as const, meaning: true }
    const drive = { hits: [hit('d1'), hit('d2')], more: true, noRoot: false, source: 'drive' as const }
    const merged = driveBehindMeaning(index, drive)
    expect(merged.hits.map((h) => h.id)).toEqual(['d1', 'd2', 'm1'])
    expect(merged).toMatchObject({ source: 'drive', more: true, meaning: true })
    expect(driveBehindMeaning(index, { ...drive, hits: [], more: false })).toBe(index)
  })
})

describe('Drive fills in behind the index (PR 1, hardened in review)', () => {
  const hit = (id: string) => ({ id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 1, modified: null, url: `https://drive.google.com/file/d/${id}/view`, home: null, path: '', excerpt: null, excerptWhy: null })
  it('keeps the index’s hits first, adds Drive’s the index did not name, takes Drive’s more; Drive empty leaves the index as it was', () => {
    const index = { hits: [hit('i1'), hit('both')], more: false, noRoot: false, source: 'index' as const }
    const drive = { hits: [hit('both'), hit('d1')], more: true, noRoot: false, source: 'drive' as const }
    const merged = driveBehindIndex(index, drive)
    expect(merged.hits.map((h) => h.id)).toEqual(['i1', 'both', 'd1'])
    expect(merged).toMatchObject({ source: 'index', more: true })
    expect(driveBehindIndex(index, { ...drive, hits: [], more: false })).toBe(index)
  })
})
