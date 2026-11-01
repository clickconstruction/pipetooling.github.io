import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailJobChip, MyMailRow, MyMailTagOk } from './contract'
import { canUntag, fileWords, fromWords, MY_MAIL_READER_WORDS, partiesWords, partyWords, readerBody, taggedJob, threadCountWords, unknownSenderContact, type MyMailOpened } from './reader'

// Made-up mail in Marisol Vega's box.
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
const harbor: MyMailJobChip = { kind: 'pipeline', id: 'job-harbor', key: 'pipeline:job-harbor', num: 'JP1081', name: '19 Harbor Ln' }
const tagOk = (jobKey: string, over: Partial<MyMailTagOk> = {}): MyMailTagOk => ({ ok: true, jobKey, lines: 0, tied: 3, files: 0, contactId: 'c-dale', unknownSender: null, ...over })
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

  it('offers it on a conversation the boxes hold whole too, since the untag still unties their lines, ends the tag and takes the label off', () => {
    // bids@ copied on every mail, as the guides advise: every line is the box's, and a wrong tag must still come off.
    const box = { messageId: 'm-1', jobKey: elm.key }
    expect(canUntag(opened({ tagged: { ...elm, messageId: 'm-1' }, inMessages: box, threadRows: [row({ gmailId: 'g-2', inMessages: { messageId: 'm-2', jobKey: elm.key } })] }))).toBe(true)
  })

  it('offers it on a mail of a tagged conversation that no line holds yet, and none on a conversation not tagged', () => {
    expect(canUntag(opened({ tagged: { ...elm, messageId: null } }))).toBe(true)
    expect(canUntag(opened())).toBe(false)
    expect(canUntag(opened({ inMessages: { messageId: 'm-1', jobKey: elm.key } }))).toBe(false)
  })
})

describe('taggedJob: the job a tagged conversation’s bar names', () => {
  it('names the job the conversation is tagged onto, on the job when a line holds this mail', () => {
    expect(taggedJob(opened({ tagged: { ...elm, messageId: 'm-1' } }), null)).toEqual({ key: elm.key, chip: { ...elm, messageId: 'm-1' }, onTheJob: true })
  })

  it('says a mail no line holds yet is not on the job, a reply that came after the follow stopped', () => {
    expect(taggedJob(opened({ tagged: { ...elm, messageId: null } }), null)).toEqual({ key: elm.key, chip: { ...elm, messageId: null }, onTheJob: false })
    // This sitting tagged it before, but the mail read since says this one is not on the job.
    expect(taggedJob(opened({ tagged: { ...elm, messageId: null } }), { ok: tagOk(elm.key), chip: elm }, true).onTheJob).toBe(false)
  })

  it('names this sitting’s tag over a mail read before it: a first tag, a move, a mail put on the job', () => {
    expect(taggedJob(opened(), { ok: tagOk(elm.key), chip: elm }, false)).toEqual({ key: elm.key, chip: elm, onTheJob: true })
    expect(taggedJob(opened(), { ok: tagOk(elm.key), chip: elm })).toEqual({ key: elm.key, chip: elm, onTheJob: true })
    const moved = taggedJob(opened({ tagged: { ...elm, messageId: 'm-1' } }), { ok: tagOk(harbor.key), chip: harbor }, false)
    expect(moved).toEqual({ key: harbor.key, chip: harbor, onTheJob: true })
    const put = taggedJob(opened({ tagged: { ...elm, messageId: null } }), { ok: tagOk(elm.key, { lines: 1, tied: 0 }), chip: elm }, false)
    expect(put).toEqual({ key: elm.key, chip: { ...elm, messageId: null }, onTheJob: true })
  })

  it('says the job without a chip when a move’s press did not know it, and trusts the mail read after the tag', () => {
    expect(taggedJob(opened({ tagged: { ...elm, messageId: 'm-1' } }), { ok: tagOk(harbor.key), chip: null }, false)).toEqual({ key: harbor.key, chip: null, onTheJob: true })
    expect(taggedJob(opened({ tagged: { ...harbor, messageId: 'm-1' } }), { ok: tagOk(harbor.key), chip: null }, true)).toEqual({ key: harbor.key, chip: { ...harbor, messageId: 'm-1' }, onTheJob: true })
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
    for (const text of [
      MY_MAIL_READER_WORDS.untagAsk,
      MY_MAIL_READER_WORDS.notOnTheJob,
      MY_MAIL_READER_WORDS.nothingHere,
      MY_MAIL_READER_WORDS.inMessagesWhy,
      MY_MAIL_READER_WORDS.tagOntoAJob,
      MY_MAIL_READER_WORDS.offline,
      MY_MAIL_READER_WORDS.notUntagged,
    ]) {
      expect(plainWordsFailures(text)).toEqual([])
    }
  })

  it('asks before an untag in words true of a conversation the boxes hold too', () => {
    expect(MY_MAIL_READER_WORDS.untagAsk).toBe(
      'Untag takes this conversation off the job. The lines the tag wrote go, with their files and the copy of each mail. A line the bids@ or team@ reader took goes back to where it was.',
    )
  })
})
