import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailJobChip, MyMailRow } from './contract'
import { chipWords, filesWords, FIRST_PAGE, jobWords, MY_MAIL_LIST_WORDS, newerPage, olderPage, onTheJobWords, pageToken, rowDay, rowEnd, taggedWords, untaggedWords, wayOf, whoLine } from './list'

// Made-up mail in Marisol Vega's box.
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
const cedar: MyMailJobChip = { kind: 'bid', id: 'bid-cedar', key: 'bid:bid-cedar', num: 'BP523', name: 'Cedar Bend clubhouse' }

const row = (over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId: 'g-1',
  threadId: 't-1',
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: 'Owner wants the 50-gal.',
  at: '2026-11-01T15:12:00.000Z',
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

describe('rowEnd: a row’s last column', () => {
  it('draws the tag first, then a box’s line on a job, then the guess, else Tag…', () => {
    expect(rowEnd(row({ tagged: { ...elm, messageId: 'm-1' }, guess: { ...cedar, why: 'x' } }))).toEqual({ kind: 'tagged', chip: { ...elm, messageId: 'm-1' }, messageId: 'm-1' })
    expect(rowEnd(row({ inMessages: { messageId: 'm-9', jobKey: 'pipeline:job-elm' }, guess: { ...elm, why: 'x' } }))).toEqual({ kind: 'inMessages', messageId: 'm-9' })
    expect(rowEnd(row({ guess: { ...cedar, why: 'the subject names BP523' } }))).toEqual({ kind: 'guess', chip: { ...cedar, why: 'the subject names BP523' }, why: 'the subject names BP523' })
    expect(rowEnd(row())).toEqual({ kind: 'tag' })
  })

  it('offers the tag on a box’s line that sits on the person, with no job', () => {
    expect(rowEnd(row({ inMessages: { messageId: 'm-8', jobKey: null } }))).toEqual({ kind: 'tag' })
    expect(rowEnd(row({ inMessages: { messageId: 'm-8', jobKey: null }, guess: { ...elm, why: 'Dale Okafor is on this job' } })).kind).toBe('guess')
  })
})

describe('a row’s words', () => {
  it('names a job by its number and its name, either alone when the other is missing', () => {
    expect(chipWords(elm)).toBe('JP1077 · 4 Elm Ct')
    expect(chipWords({ num: '', name: 'Cedar Bend clubhouse' })).toBe('Cedar Bend clubhouse')
    expect(chipWords({ num: 'BP523', name: ' ' })).toBe('BP523')
    expect(chipWords({ num: '', name: '' })).toBe('a job')
    expect(jobWords(elm)).toBe('JP1077')
    expect(jobWords({ num: '', name: '4 Elm Ct' })).toBe('4 Elm Ct')
    expect(jobWords(null)).toBe('the job')
  })

  it('says who, with the address under a name, and to whom on a mail out', () => {
    expect(whoLine(row())).toEqual({ name: 'Dale Okafor', address: 'dale@ridgeway.example' })
    expect(whoLine(row({ direction: 'out', who: { name: 'Priya Nair', address: 'priya@cedarbend.example' } }))).toEqual({ name: 'to Priya Nair', address: 'priya@cedarbend.example' })
    expect(whoLine(row({ who: { name: '', address: 'ap@harlanfreight.example' } }))).toEqual({ name: 'ap@harlanfreight.example', address: '' })
    expect(whoLine(row({ who: { name: '', address: '' } })).name).toBe('Unnamed')
  })

  it('draws the way as an arrow a screen reader names, the files counted, and the day as a thread list says it', () => {
    expect(wayOf(row())).toEqual({ arrow: '↓', label: 'It came in' })
    expect(wayOf(row({ direction: 'out' }))).toEqual({ arrow: '↑', label: 'You sent it' })
    expect(filesWords(1)).toBe('1 file')
    expect(filesWords(3)).toBe('3 files')
    // 9:12 AM in Chicago on Nov 1; the day before reads as its weekday and date.
    expect(rowDay(row(), '2026-11-01T20:00:00.000Z')).toBe('9:12 AM')
    expect(rowDay(row({ at: '2026-10-24T19:03:00.000Z' }), '2026-11-01T20:00:00.000Z')).toBe('Sat, Oct 24')
  })
})

describe('the page of rows', () => {
  it('walks older by Gmail’s token and back to the newest, never past it', () => {
    expect(pageToken(FIRST_PAGE)).toBeNull()
    const two = olderPage(FIRST_PAGE, 'tok-2')
    const three = olderPage(two, 'tok-3')
    expect(pageToken(three)).toBe('tok-3')
    expect(newerPage(three)).toEqual([null, 'tok-2'])
    expect(newerPage(newerPage(three))).toEqual(FIRST_PAGE)
    expect(newerPage(FIRST_PAGE)).toEqual(FIRST_PAGE)
  })
})

describe('the words of a tag and an untag', () => {
  it('says the job and what is on it now', () => {
    expect(taggedWords({ lines: 2, tied: 1, files: 1 }, elm)).toBe('Tagged onto JP1077. 3 lines and 1 file are on the job now.')
    expect(taggedWords({ lines: 1, tied: 0, files: 0 }, cedar)).toBe('Tagged onto BP523. 1 line is on the job now.')
    expect(taggedWords({ lines: 0, tied: 0, files: 0 }, elm)).toBe('Tagged onto JP1077. Every mail in it was on the job already.')
    expect(taggedWords({ lines: 2, tied: 0, files: 2 })).toBe('Tagged. 2 lines and 2 files are on the job now.')
    expect(onTheJobWords({ lines: 0, tied: 1, files: 1 })).toBe('1 line and 1 file are on the job now.')
  })

  it('says what came off, and the copy a legal matter keeps', () => {
    expect(untaggedWords({ removed: 3, keptForMatter: false })).toBe('Untagged. 3 lines came off the job.')
    expect(untaggedWords({ removed: 1, keptForMatter: true })).toBe('Untagged. 1 line came off the job. The legal matter keeps its own copy.')
    expect(untaggedWords({ removed: 0, keptForMatter: false })).toBe('Untagged. Nothing came off the job.')
  })

  it('keeps every sentence in plain words', () => {
    for (const text of [
      taggedWords({ lines: 2, tied: 1, files: 1 }, elm),
      taggedWords({ lines: 0, tied: 0, files: 0 }, elm),
      untaggedWords({ removed: 1, keptForMatter: true }),
      untaggedWords({ removed: 0, keptForMatter: false }),
      MY_MAIL_LIST_WORDS.offline,
      MY_MAIL_LIST_WORDS.notRead,
      MY_MAIL_LIST_WORDS.notTagged,
    ]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
