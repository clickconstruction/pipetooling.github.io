import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailJobChip, MyMailRow } from './contract'
import { foldedCount, MY_MAIL_WORDS, rowsForView, viewRows } from './view'

// Made-up mail in Marisol Vega's box.
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }

const row = (gmailId: string, at: string, over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId,
  threadId: `t-${gmailId}`,
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: 'Owner wants the 50-gal.',
  at,
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

const plain = row('plain', '2026-11-01T15:12:00.000Z')
const older = row('older', '2026-10-30T15:00:00.000Z', { guess: { ...elm, why: 'the subject names JP1077' } })
const tagged = row('tagged', '2026-10-31T09:00:00.000Z', { tagged: { ...elm, messageId: 'm-1' } })
const newsletter = row('news', '2026-11-01T12:00:00.000Z', { folded: 'bulk' })
const taggedNotice = row('notice-tagged', '2026-10-29T12:00:00.000Z', { folded: 'notice', tagged: { ...elm, messageId: null } })
const boxTied = row('box-tied', '2026-10-28T12:00:00.000Z', { inMessages: { messageId: 'm-9', jobKey: 'pipeline:job-elm' } })
const boxUntied = row('box-untied', '2026-10-27T12:00:00.000Z', { inMessages: { messageId: 'm-8', jobKey: null } })
const page = [older, boxTied, newsletter, plain, taggedNotice, tagged, boxUntied]
const ids = (rows: MyMailRow[]) => rows.map((r) => r.gmailId)

describe('viewRows: what each view draws', () => {
  it('To tag hides what is on a job, tagged or tied by the boxes, and what folds, newest first', () => {
    expect(ids(rowsForView(page, 'toTag'))).toEqual(['plain', 'older', 'box-untied'])
    expect(ids(viewRows(page, 'toTag').folded)).toEqual(['news'])
  })

  it('Tagged shows the tagged conversations alone, a tagged notice too, with no fold line', () => {
    expect(ids(rowsForView(page, 'tagged'))).toEqual(['tagged', 'notice-tagged'])
    expect(viewRows(page, 'tagged').folded).toEqual([])
  })

  it('All shows every mail, the folded ones behind their one line and a tagged one never folded', () => {
    expect(ids(rowsForView(page, 'all'))).toEqual(['plain', 'tagged', 'older', 'notice-tagged', 'box-tied', 'box-untied'])
    expect(ids(viewRows(page, 'all').folded)).toEqual(['news'])
  })

  it('draws one instant in one order, and leaves the page it was given as it was', () => {
    const a = row('a', '2026-11-01T10:00:00.000Z')
    const b = row('b', '2026-11-01T10:00:00.000Z')
    const given = [a, b]
    expect(ids(rowsForView(given, 'all'))).toEqual(['b', 'a'])
    expect(ids(given)).toEqual(['a', 'b'])
  })

  it('counts what sits behind the fold line, To tag’s when no view is named', () => {
    const notices = [newsletter, row('n2', '2026-11-01T11:00:00.000Z', { folded: 'noReply' }), row('n3', '2026-11-01T10:00:00.000Z', { folded: 'notice', inMessages: { messageId: 'm-7', jobKey: 'pipeline:job-elm' } })]
    expect(foldedCount(notices)).toBe(2)
    expect(foldedCount(notices, 'all')).toBe(3)
    expect(foldedCount(notices, 'tagged')).toBe(0)
  })
})

describe('MY_MAIL_WORDS: the tab’s words', () => {
  it('says what is read, what is kept and what a tag does', () => {
    expect(MY_MAIL_WORDS.card(' marisol@clickplumbing.example ')).toBe(
      'Your mail, read live from marisol@clickplumbing.example. Nothing is kept until you tag it. A tag puts that conversation on the job for the office to read.',
    )
  })

  it('names the fold line by its count', () => {
    expect(MY_MAIL_WORDS.fold(12)).toBe('12 notices and newsletters, left out as the bids@ reader leaves them out')
    expect(MY_MAIL_WORDS.fold(1)).toBe('1 notice or newsletter, left out as the bids@ reader leaves it out')
  })

  it('says what an empty view means, in EmptyState’s parts', () => {
    expect(MY_MAIL_WORDS.empty('toTag')).toEqual({ main: 'Nothing waiting to tag.', next: '', tail: '' })
    expect(MY_MAIL_WORDS.empty('tagged')).toEqual({ main: 'No tagged conversations yet.', next: 'To tag', tail: 'lists the mail you can tag.' })
    expect(MY_MAIL_WORDS.empty('all')).toEqual({ main: 'No emails in your Inbox or Sent yet.', next: 'Your account', tail: 'shows what this tab reads.' })
    expect(MY_MAIL_WORDS.empty('toTag', ' Ridgeway ')).toEqual({ main: 'No emails match ‘Ridgeway’.', next: 'Clear the search', tail: '' })
    expect(MY_MAIL_WORDS.views).toEqual({ toTag: 'To tag', tagged: 'Tagged', all: 'All' })
  })

  it('keeps every sentence in plain words', () => {
    const empties = (['toTag', 'tagged', 'all'] as const).flatMap((v) => {
      const w = MY_MAIL_WORDS.empty(v)
      return [w.main, `${w.next} ${w.tail}`.trim()]
    })
    for (const text of [MY_MAIL_WORDS.card('marisol@clickplumbing.example'), MY_MAIL_WORDS.fold(12), MY_MAIL_WORDS.fold(1), ...empties, MY_MAIL_WORDS.empty('all', 'Ridgeway').main]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
