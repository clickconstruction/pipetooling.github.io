import { describe, expect, it } from 'vitest'
import { rfcMessageId as readerMessageId } from '../emailIn/emailLine'
import type { GmailPart } from '../emailIn/gmailMessage'
import { leftOutSenders } from '../emailIn/leftOutSenders'
import { MY_MAIL_NO_SUBJECT } from './contract'
import { isOwnMail, isTheirs, MY_MAIL_METADATA_HEADERS, MY_MAIL_SNIPPET_MAX, myMailFold, myMailRow, readMyMail, rfcMessageId, type MyMailGmailMessage, type MyMailReader } from './rows'

// Made-up mail: Marisol Vega is the estimator whose box it is; Dale Okafor at Ridgeway Builders and Priya Nair at the
// Cedar Bend HOA are customers; Harlan Freight is a supplier.
const MARISOL = 'marisol@clickplumbing.example'
const reader: MyMailReader = { address: MARISOL, boxes: ['bids@clickplumbing.example', 'team@noreply.clicktooling.example'] }

/** Text as Gmail sends a part's bytes: base64url of its UTF-8. */
const b64url = (text: string): string => {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const words = (text: string): GmailPart => ({ partId: '0', mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { data: b64url(text) } })
const specSheet: GmailPart = {
  partId: '1',
  mimeType: 'application/pdf',
  filename: 'elm-ct-spec-sheet.pdf',
  headers: [{ name: 'Content-Disposition', value: 'attachment; filename="elm-ct-spec-sheet.pdf"' }],
  body: { attachmentId: 'att-spec', size: 212_000 },
}
const logo: GmailPart = {
  partId: '2',
  mimeType: 'image/png',
  filename: 'ridgeway-logo.png',
  headers: [{ name: 'Content-Disposition', value: 'inline; filename="ridgeway-logo.png"' }, { name: 'Content-ID', value: '<logo@ridgeway>' }],
  body: { attachmentId: 'att-logo', size: 4_100 },
}

interface MailOptions {
  thread?: string
  labels?: string[]
  at?: number | null
  text?: string
  files?: GmailPart[]
  snippet?: string
}

const mail = (id: string, headers: Record<string, string>, o: MailOptions = {}): MyMailGmailMessage => ({
  id,
  threadId: o.thread ?? 't-elm',
  labelIds: o.labels ?? ['INBOX', 'CATEGORY_PERSONAL'],
  ...(o.at === null ? {} : { internalDate: String(o.at ?? Date.UTC(2026, 10, 1, 15, 12)) }),
  ...(o.snippet === undefined ? {} : { snippet: o.snippet }),
  payload: {
    mimeType: 'multipart/mixed',
    headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    parts: [words(o.text ?? ''), ...(o.files ?? [])],
  },
})

const fromDale = (over: Record<string, string> = {}, o: MailOptions = {}) =>
  mail('g-dale-1', { From: 'Dale Okafor <dale@ridgeway.example>', To: MARISOL, Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': ' <CAD1@ridgeway.example> ', ...over }, o)

describe('myMailRow: a mail in the person’s own box as the tab’s row', () => {
  it('reads a mail in: who wrote, the subject, Gmail’s snippet as text, the time, the files the reader keeps, and nothing folded', () => {
    const row = myMailRow(
      fromDale({}, { text: 'Marisol,\n\nOwner wants the 50-gal, not the 40.', snippet: 'Owner wants the 50-gal, not the 40. It&#39;s for the inspector &amp; the owner.', files: [specSheet, logo] }),
      reader,
    )
    expect(row).toEqual({
      gmailId: 'g-dale-1',
      threadId: 't-elm',
      direction: 'in',
      who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
      subject: 'Re: 4 Elm Ct water heater',
      snippet: "Owner wants the 50-gal, not the 40. It's for the inspector & the owner.",
      at: '2026-11-01T15:12:00.000Z',
      // The spec sheet counts; the signature's logo, a small picture in the body, is left out as the reader leaves it.
      files: 1,
      folded: null,
      tagged: null,
      guess: null,
      inMessages: null,
    })
  })

  it('reads a mail out when the person’s own address is its From, in any case, and names the first To who is not them', () => {
    const sent = mail('g-out-1', { From: 'Marisol Vega <Marisol@ClickPlumbing.example>', To: `${MARISOL}, Priya Nair <priya@cedarbend.example>`, Subject: 'Cedar Bend clubhouse, our number' }, { labels: ['SENT'] })
    const row = myMailRow(sent, reader)
    expect(row.direction).toBe('out')
    expect(row.who).toEqual({ name: 'Priya Nair', address: 'priya@cedarbend.example' })
  })

  it('names a Cc on a mail out with no one else in To, and the person on a note to self', () => {
    const copied = mail('g-out-2', { From: MARISOL, To: MARISOL, Cc: 'ap@harlanfreight.example' }, { labels: ['SENT'] })
    expect(myMailRow(copied, reader).who).toEqual({ name: '', address: 'ap@harlanfreight.example' })
    const self = mail('g-out-3', { From: MARISOL, To: MARISOL, Subject: 'Tile count for Elm' }, { labels: ['SENT', 'INBOX'] })
    expect(myMailRow(self, reader)).toMatchObject({ direction: 'out', who: { name: '', address: MARISOL } })
  })

  it('reads a mail with no subject as Gmail writes it, and a teammate’s mail as coming in', () => {
    const row = myMailRow(mail('g-in-2', { From: 'Rosa Diaz <rosa@clickplumbing.example>', To: MARISOL, Subject: '   ' }), reader)
    expect(row.subject).toBe(MY_MAIL_NO_SUBJECT)
    expect(row.direction).toBe('in')
  })

  it('makes the snippet from the words when Gmail sent none, on one line and clipped', () => {
    const short = myMailRow(fromDale({}, { text: 'Yes,\n\ngo ahead   with the 40 for now.' }), reader)
    expect(short.snippet).toBe('Yes, go ahead with the 40 for now.')
    const long = myMailRow(fromDale({}, { text: 'Pipe '.repeat(80) }), reader)
    expect(long.snippet.length).toBeLessThanOrEqual(MY_MAIL_SNIPPET_MAX)
    expect(long.snippet.endsWith('...')).toBe(true)
  })

  it('takes the Date header when Gmail gave no time, and the start of 1970 when neither reads', () => {
    expect(myMailRow(fromDale({ Date: 'Sun, 1 Nov 2026 09:12:00 -0600' }, { at: null }), reader).at).toBe('2026-11-01T15:12:00.000Z')
    expect(myMailRow(fromDale({ Date: 'not a day' }, { at: null }), reader).at).toBe('1970-01-01T00:00:00.000Z')
  })

  it('hands the function the parsed email and the trimmed Message-ID from the same read', () => {
    const read = readMyMail(fromDale(), reader)
    expect(read.rfcMessageId).toBe('<CAD1@ridgeway.example>')
    expect(read.email.subject).toBe('Re: 4 Elm Ct water heater')
    expect(read.row).toEqual(myMailRow(fromDale(), reader))
    // The reader's own function, passed through for the lookup.
    expect(rfcMessageId).toBe(readerMessageId)
  })

  it('asks Gmail for every header the row and the fold read', () => {
    const asked = new Set(MY_MAIL_METADATA_HEADERS.map((h) => h.toLowerCase()))
    for (const header of ['from', 'to', 'cc', 'subject', 'date', 'message-id', 'list-unsubscribe', 'list-id', 'precedence', 'auto-submitted']) expect(asked.has(header)).toBe(true)
  })

  it('reads a mail in the person’s Sent as theirs from any address it went out from, and names the first one outside', () => {
    const alias = mail('g-alias', { From: 'Click Plumbing Estimating <estimating@clickplumbing.example>', To: 'estimating@clickplumbing.example, Dale Okafor <dale@ridgeway.example>', Subject: 'Re: 4 Elm Ct water heater' }, { labels: ['SENT'] })
    expect(myMailRow(alias, reader)).toMatchObject({ direction: 'out', who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' }, folded: null })
    // The same address in the Inbox is someone writing in.
    expect(myMailRow(mail('g-alias-in', { From: 'estimating@clickplumbing.example', To: MARISOL }), reader)).toMatchObject({ direction: 'in', who: { address: 'estimating@clickplumbing.example' } })
    expect(isOwnMail({ from: { name: null, address: 'estimating@clickplumbing.example' }, labels: ['SENT'] }, reader)).toBe(true)
    expect(isOwnMail({ from: { name: null, address: 'estimating@clickplumbing.example' }, labels: ['INBOX'] }, reader)).toBe(false)
    expect(isOwnMail({ from: { name: null, address: MARISOL }, labels: [] }, reader)).toBe(true)
  })

  it('knows the person’s own address case-blind, and nothing as theirs when empty', () => {
    expect(isTheirs(' MARISOL@clickplumbing.example ', reader)).toBe(true)
    expect(isTheirs('rosa@clickplumbing.example', reader)).toBe(false)
    expect(isTheirs('', { address: '' })).toBe(false)
  })
})

describe('myMailFold: what the tab folds, as the bids@ reader leaves it out', () => {
  const fold = (headers: Record<string, string>, o: MailOptions = {}, r: MyMailReader = reader) => myMailRow(mail('g-n', { To: MARISOL, Subject: 'News', ...headers }, o), r).folded

  it('folds a list, a machine and Gmail’s other tabs as bulk', () => {
    expect(fold({ From: 'news@alamosurety.example', 'List-Unsubscribe': '<mailto:u@alamosurety.example>' })).toBe('bulk')
    expect(fold({ From: 'news@alamosurety.example', 'List-Id': 'Alamo Surety <news.alamosurety.example>' })).toBe('bulk')
    expect(fold({ From: 'dale@ridgeway.example', Precedence: 'bulk' })).toBe('bulk')
    expect(fold({ From: 'dale@ridgeway.example', 'Auto-Submitted': 'auto-replied' })).toBe('bulk')
    expect(fold({ From: 'deals@pipesupply.example' }, { labels: ['INBOX', 'CATEGORY_PROMOTIONS'] })).toBe('bulk')
    expect(fold({ From: 'orders@pipesupply.example' }, { labels: ['INBOX', 'CATEGORY_UPDATES'] })).toBe('bulk')
  })

  it('folds a newsletter by the foot of its body when it carries no list header', () => {
    expect(fold({ From: 'editor@tradeweekly.example' }, { text: 'This week in plumbing.\n\nRead more.\n\nUnsubscribe from these emails' })).toBe('bulk')
  })

  it('folds a no-reply sender as no-reply', () => {
    expect(fold({ From: 'no-reply@permits.example' })).toBe('noReply')
  })

  it('folds a sender the office marked a notice, the address or the whole domain, when the mark holds for both boxes', () => {
    const isNotice = leftOutSenders(
      [
        { value: 'statements@harlanfreight.example', kind: 'address', mailbox: null },
        { value: 'alerts.example', kind: 'domain', mailbox: null },
        { value: 'ap@harlanfreight.example', kind: 'address', mailbox: 'bids' },
      ],
      'mine',
    )
    const marked = { ...reader, isNotice }
    expect(fold({ From: 'statements@harlanfreight.example' }, {}, marked)).toBe('notice')
    expect(fold({ From: 'weather@news.alerts.example' }, {}, marked)).toBe('notice')
    // A mark for bids@ alone holds there, not in a person's own box.
    expect(fold({ From: 'ap@harlanfreight.example' }, {}, marked)).toBeNull()
  })

  it('folds a copy of our own, from a box or the app’s sender, as a notice', () => {
    expect(fold({ From: 'ClickTooling <team@noreply.clicktooling.example>' })).toBe('notice')
    expect(fold({ From: 'bids@clickplumbing.example' })).toBe('notice')
  })

  it('never folds a person, or the person’s own mail though it quotes a newsletter’s foot', () => {
    expect(fold({ From: 'Dale Okafor <dale@ridgeway.example>' })).toBeNull()
    expect(fold({ From: MARISOL, 'List-Unsubscribe': '<mailto:u@x.example>' }, { labels: ['SENT'], text: 'Forwarding this.\n\nUnsubscribe' })).toBeNull()
  })

  it('never folds the person’s own mail sent as a box or from an address on the notice list', () => {
    const marked = { ...reader, isNotice: leftOutSenders([{ value: 'estimating@clickplumbing.example', kind: 'address', mailbox: null }], 'mine') }
    expect(fold({ From: 'bids@clickplumbing.example', To: 'dale@ridgeway.example' }, { labels: ['SENT'] })).toBeNull()
    expect(fold({ From: 'estimating@clickplumbing.example', To: 'dale@ridgeway.example' }, { labels: ['SENT'] }, marked)).toBeNull()
    // Neither address writing in is the person: a copy of ours, and a notice, as before.
    expect(fold({ From: 'bids@clickplumbing.example' })).toBe('notice')
    expect(fold({ From: 'estimating@clickplumbing.example' }, {}, marked)).toBe('notice')
  })

  it('reads past the reader’s Inbox gate: an archived mail of a conversation folds by the same rules', () => {
    expect(fold({ From: 'news@alamosurety.example', 'List-Id': 'Alamo <news.alamosurety.example>' }, { labels: [] })).toBe('bulk')
    expect(fold({ From: 'dale@ridgeway.example' }, { labels: [] })).toBeNull()
    expect(myMailFold({ labels: ['SPAM'], from: { name: null, address: 'x@spam.example' }, headers: {} }, reader)).toBe('bulk')
  })
})
