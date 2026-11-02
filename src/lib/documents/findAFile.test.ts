import { describe, expect, it } from 'vitest'
import { FIND_MIN_CHARS, emptyFindWords, excerptNote, excerptParts, findAFileFromAnswer, foundWords, groupByHome, hitMetaWords, homeWords, pathWords, type FoundFile } from './findAFile'

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
    expect(findAFileFromAnswer(null)).toEqual({ hits: [], more: false, noRoot: false })
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
    expect(foundWords({ hits: [], more: false }, 'rock')).toBeNull()
    expect(foundWords({ hits: [hit({})], more: false }, 'rock clause')).toBe('1 file says “rock clause”.')
    expect(foundWords({ hits: [hit({}), hit({})], more: true }, 'permit')).toBe('2 files say “permit”, and Drive has more. Add a word to narrow it.')
    expect(emptyFindWords('xyzzy').main).toBe('Nothing in the job folders says “xyzzy”. Try other words, or Drive’s own search.')
    expect(FIND_MIN_CHARS).toBe(2)
  })
})
