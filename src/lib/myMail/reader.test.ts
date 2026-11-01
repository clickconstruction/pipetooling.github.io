import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailJobChip, MyMailRow } from './contract'
import { canUntag, fileWords, fromWords, MY_MAIL_READER_WORDS, partiesWords, partyWords, readerBody, threadCountWords, unknownSenderContact, type MyMailOpened } from './reader'

// Made-up mail in Marisol Vega's box.
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
const row = (over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId: 'g-1',
  threadId: 't-1',
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: 'Owner wants the 50-gal.',
  at: '2026-11-01T15:12:00.000Z',
  files: 1,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})
const opened = (over: Partial<MyMailOpened> = {}): MyMailOpened => ({
  ...row(),
  to: [{ name: 'Marisol Vega', address: 'marisol@clickplumbing.example' }],
  cc: [],
  bodyText: 'Marisol,\n\nOwner wants the 50-gal, not the 40.',
  bodyHtml: null,
  fileList: [{ name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000 }],
  threadCount: 3,
  threadRows: [],
  ...over,
})

describe('readerBody: the words as the thread’s email line draws them', () => {
  it('reads an HTML body as text, so no HTML reaches the page', () => {
    const html = '<div>Marisol,</div><div><br></div><div>Owner wants the <b>50-gal</b>.</div><script>alert(1)</script><style>p{}</style>'
    expect(readerBody(opened({ bodyHtml: html, bodyText: '' }))).toBe('Marisol,\n\nOwner wants the 50-gal.')
  })

  it('draws the plain words when there is no HTML, or when the HTML reads as nothing', () => {
    expect(readerBody(opened())).toBe('Marisol,\n\nOwner wants the 50-gal, not the 40.')
    expect(readerBody(opened({ bodyHtml: '<div><img src="cid:logo"></div>', bodyText: 'Yes, go ahead.' }))).toBe('Yes, go ahead.')
  })
})

describe('the header lines', () => {
  it('names an address with its name, or the address alone, and joins several', () => {
    expect(partyWords({ name: 'Dale Okafor', address: 'dale@ridgeway.example' })).toBe('Dale Okafor <dale@ridgeway.example>')
    expect(partyWords({ name: '', address: 'ap@harlanfreight.example' })).toBe('ap@harlanfreight.example')
    expect(partiesWords([{ name: 'Priya Nair', address: 'priya@cedarbend.example' }, { name: '', address: 'board@cedarbend.example' }])).toBe('Priya Nair <priya@cedarbend.example>, board@cedarbend.example')
  })

  it('says From as the sender on a mail in and the person’s own address on a mail out', () => {
    expect(fromWords(opened(), 'marisol@clickplumbing.example')).toBe('Dale Okafor <dale@ridgeway.example>')
    expect(fromWords(opened({ direction: 'out' }), ' marisol@clickplumbing.example ')).toBe('marisol@clickplumbing.example')
  })

  it('lists a file with its size, and counts the conversation', () => {
    expect(fileWords({ name: 'elm-ct-spec-sheet.pdf', size: 212_000 })).toBe('elm-ct-spec-sheet.pdf · 212 KB')
    expect(fileWords({ name: 'note.txt', size: -1 })).toBe('note.txt')
    expect(threadCountWords(3)).toBe('3 in this conversation')
    expect(threadCountWords(0)).toBe('1 in this conversation')
  })
})

describe('canUntag', () => {
  it('offers Untag on a tagged conversation with a line of the tag’s own', () => {
    expect(canUntag(opened({ tagged: { ...elm, messageId: 'm-1' } }))).toBe(true)
    expect(canUntag(opened({ tagged: { ...elm, messageId: 'm-1' }, inMessages: { messageId: 'm-1', jobKey: elm.key }, threadRows: [row({ gmailId: 'g-2' })] }))).toBe(true)
  })

  it('offers none on a conversation not tagged, or one the boxes wrote whole', () => {
    expect(canUntag(opened())).toBe(false)
    const box = { messageId: 'm-1', jobKey: elm.key }
    expect(canUntag(opened({ tagged: { ...elm, messageId: 'm-1' }, inMessages: box, threadRows: [row({ gmailId: 'g-2', inMessages: { messageId: 'm-2', jobKey: elm.key } })] }))).toBe(false)
  })
})

describe('unknownSenderContact', () => {
  it('makes the person Who is this? names, with the one address and no record', () => {
    expect(unknownSenderContact({ contactId: 'c-harlan', address: ' ap@harlanfreight.example ', name: 'Harlan Freight' })).toEqual({
      id: 'c-harlan',
      kind: 'unknown',
      name: 'Harlan Freight',
      goesBy: null,
      company: '',
      record: null,
      channels: [{ id: 'c-harlan:email', kind: 'email', value: 'ap@harlanfreight.example', optedOutAt: null }],
      jobIds: [],
      defaultJobId: null,
    })
    expect(unknownSenderContact({ contactId: 'c-x', address: 'x@y.example', name: ' ' }).name).toBe('x@y.example')
  })
})

describe('the reader’s words', () => {
  it('keeps its sentences in plain words', () => {
    for (const text of [MY_MAIL_READER_WORDS.untagAsk, MY_MAIL_READER_WORDS.nothingHere, MY_MAIL_READER_WORDS.inMessagesWhy, MY_MAIL_READER_WORDS.tagOntoAJob, MY_MAIL_READER_WORDS.offline, MY_MAIL_READER_WORDS.notUntagged]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
