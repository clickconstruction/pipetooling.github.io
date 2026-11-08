import { describe, expect, it } from 'vitest'
import { COPY_RUN_LIMIT_MS, copyMarkWords, copyStop, fetchBytes, keepMark, markedMail, markOf } from './copyStop'
import { isRateLimited, readerHold } from './readerHold'

const ID = '1a1b29b453e52e9b'
const SAVED = '2026-11-06T20:45:04.000Z'
const later = (ms: number) => new Date(Date.parse(SAVED) + ms).toISOString()

describe('copyMarkWords: the mark a run writes before it fetches a mail’s files', () => {
  it('names the mail and its size, and what the next run does', () => {
    expect(copyMarkWords(ID, 24 * 1024 * 1024)).toBe(`Copying the files of mail ${ID} (24 MB) did not finish. The next run takes the mail and leaves its files in Gmail.`)
    expect(copyMarkWords(ID, 3_155_382)).toContain('(3 MB)')
  })

  it('never says nought megabytes, nor a negative size', () => {
    expect(copyMarkWords(ID, 900)).toContain('(0.1 MB)')
    expect(copyMarkWords(ID, -5)).toContain('(0.1 MB)')
  })

  it('is never read as Gmail’s rate limit, so the 429 hold leaves it alone', () => {
    const words = copyMarkWords(ID, 24 * 1024 * 1024)
    expect(isRateLimited(words)).toBe(false)
    expect(readerHold({ last_error: words, updated_at: SAVED }, later(60_000))).toBeNull()
  })
})

describe('markedMail: the mail a mark names', () => {
  it('reads its own words back', () => {
    expect(markedMail(copyMarkWords(ID, 1))).toBe(ID)
    expect(markedMail(`  ${copyMarkWords('abc_-9', 1)}`)).toBe('abc_-9')
  })

  it('is null for any other words', () => {
    expect(markedMail('Gmail /history failed (429): User-rate limit exceeded.  Retry after 2026-11-07T18:37:02.028Z')).toBeNull()
    expect(markedMail('Writing 18f2 failed: duplicate key')).toBeNull()
    expect(markedMail(null)).toBeNull()
    expect(markedMail('')).toBeNull()
  })
})

describe('copyStop: what a run does about the last run’s mark', () => {
  const mark = { last_error: copyMarkWords(ID, 24 * 1024 * 1024), updated_at: SAVED }

  it('is none with no mark, no row or other words', () => {
    expect(copyStop(null, later(0))).toEqual({ kind: 'none' })
    expect(copyStop({ last_error: null, updated_at: SAVED }, later(0))).toEqual({ kind: 'none' })
    expect(copyStop({ last_error: 'Gmail /labels failed (429): User-rate limit exceeded.', updated_at: SAVED }, later(0))).toEqual({ kind: 'none' })
  })

  it('waits while the run that wrote the mark may still be at work', () => {
    expect(copyStop(mark, later(60_000))).toEqual({ kind: 'wait', gmailId: ID, until: later(COPY_RUN_LIMIT_MS) })
    expect(copyStop(mark, later(COPY_RUN_LIMIT_MS - 1))).toMatchObject({ kind: 'wait' })
  })

  it('takes the mail without its files once that run cannot be alive', () => {
    expect(copyStop(mark, later(COPY_RUN_LIMIT_MS))).toEqual({ kind: 'bare', gmailId: ID })
    expect(copyStop(mark, later(3 * 60 * 60_000))).toEqual({ kind: 'bare', gmailId: ID })
  })

  it('takes it bare when the mark’s time or now cannot be read, rather than waiting for ever', () => {
    expect(copyStop({ ...mark, updated_at: null }, later(0))).toEqual({ kind: 'bare', gmailId: ID })
    expect(copyStop(mark, 'not a time')).toEqual({ kind: 'bare', gmailId: ID })
  })
})

describe('fetchBytes: what a mail costs to copy', () => {
  it('counts the files kept by attachment id, and nothing else', () => {
    expect(
      fetchBytes([
        { kind: 'file', keep: 'copy', attachmentId: 'a', size: 20_000_000 },
        { kind: 'file', keep: 'copy', attachmentId: null, size: 40_000 },
        { kind: 'file', keep: 'tooBig', attachmentId: 'b', size: 30_000_000 },
        { kind: 'link' },
        { kind: 'file', keep: 'copy', attachmentId: 'c', size: 125_264 },
      ]),
    ).toEqual({ files: 2, bytes: 20_125_264 })
    expect(fetchBytes([])).toEqual({ files: 0, bytes: 0 })
  })
})

describe('keepMark and markOf: a mark outlives the run that stopped before its mail', () => {
  const mark = copyMarkWords(ID, 24 * 1024 * 1024)
  const refused = 'Gmail /history failed (429): User-rate limit exceeded.  Retry after 2026-11-07T18:37:02.028Z'

  it('puts the mark ahead of the run’s own words, so both kernels read them', () => {
    const words = keepMark(mark, refused)
    expect(words).toBe(`${mark} ${refused}`)
    expect(markedMail(words)).toBe(ID)
    expect(isRateLimited(words)).toBe(true)
    expect(readerHold({ last_error: words, updated_at: '2026-11-07T18:22:02.040Z' }, '2026-11-07T18:30:00.000Z')).toBe('2026-11-07T18:37:02.028Z')
  })

  it('passes the words through with no mark, and never writes a mark twice', () => {
    expect(keepMark(null, refused)).toBe(refused)
    expect(keepMark('not a mark', refused)).toBe(refused)
    expect(keepMark(mark, copyMarkWords('other', 5))).toBe(copyMarkWords('other', 5))
  })

  it('takes the mark back out of words that carry more', () => {
    expect(markOf(`${mark} ${refused}`)).toBe(mark)
    expect(markOf(mark)).toBe(mark)
    expect(markOf(refused)).toBeNull()
    expect(markOf(null)).toBeNull()
  })
})
