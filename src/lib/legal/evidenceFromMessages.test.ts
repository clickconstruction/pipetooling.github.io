/**
 * The Legal desk's Evidence door, From the job's messages… (punch list #230 PR 5): the rows, the .eml, the Evidence
 * row an email becomes, and the press. Everyone and everything here is made up, as in the mock-up.
 */
import { describe, expect, it } from 'vitest'
import { sentEmailCopyHtml } from '../../../supabase/functions/_shared/sentCopyEmail'
import {
  EVIDENCE_FROM_MESSAGES_WORDS,
  SENT_PROVENANCE,
  base64Of,
  conversationOnMatter,
  conversationsOf,
  documentDraftOf,
  emlFilesOfLine,
  emlOf,
  evidenceDayWords,
  evidenceJobTiles,
  evidenceJobsWords,
  fileCanFit,
  evidenceSpanWords,
  evidenceTitleOf,
  filedHeader,
  headerWords,
  lineItemKey,
  lineProvenance,
  mailboxHeader,
  messagesLineHref,
  myMailRawPath,
  onMatterKeys,
  putOutcomeWords,
  putPlan,
  quotedPrintable,
  rfc5322Date,
  sentItemKey,
  type EvidenceEmlContext,
  type EvidenceItem,
  type EvidenceLine,
  type EvidencePeople,
  type EvidenceSentCopy,
} from './evidenceFromMessages'

const TODAY = '2026-11-01'
const JOB_A = 'pipeline:11111111-1111-4111-8111-111111111111'
const JOB_B = 'pipeline:22222222-2222-4222-8222-222222222222'
const people: EvidencePeople = {
  users: {
    'u-marisol': { name: 'Marisol Vega', email: 'marisol@clickplumbing.example' },
    'u-rosa': { name: 'Rosa Diaz', email: 'rosa@clickplumbing.example' },
  },
}
const jobs = { words: { [JOB_A]: 'J1077 · 4 Elm Ct', [JOB_B]: 'J1062 · 9 Oak Row' }, todayYmd: TODAY }
const ctx: EvidenceEmlContext = { todayYmd: TODAY, boxes: { bids: 'bids@clickplumbing.example', team: 'team@clickplumbing.example' }, users: people.users, appFrom: 'Click Plumbing and Electrical <team@noreply.clicktooling.example>' }

const line = (id: string, over: Partial<EvidenceLine> = {}): EvidenceLine => ({
  id,
  contactId: 'c-dale',
  contactName: 'Dale Okafor',
  contactKind: 'customer',
  contactAddress: 'dale@ridgeway.example',
  jobKey: JOB_A,
  direction: 'in',
  at: '2026-10-24T19:03:00Z',
  subject: 'Re: 4 Elm Ct water heater',
  body: 'Yes, go ahead with the 40 for now.',
  whoUserId: null,
  whoText: 'Dale Okafor <dale@ridgeway.example> to bids@',
  mailbox: 'bids',
  mailUserId: null,
  gmailId: `g-${id}`,
  gmailThreadId: 't-elm',
  rfcMessageId: `<${id}@mail.ridgeway.example>`,
  files: [],
  ...over,
})

const sent = (id: string, over: Partial<EvidenceSentCopy> = {}): EvidenceSentCopy => ({
  id,
  kind: 'estimate_sent',
  title: 'Estimate 1044',
  subject: 'Estimate 1044 sent',
  recipientName: 'Dale Okafor',
  recipientEmails: ['dale@ridgeway.example'],
  sentAt: '2026-10-02T15:00:00Z',
  sentByName: 'Rosa Diaz',
  copyPath: `${id}/copy.html`,
  copyType: 'text/html',
  copyBytes: 4200,
  attachments: [],
  jobKey: JOB_A,
  ...over,
})

const SENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

/** Quoted-printable read back, for the round trips. */
function fromQuotedPrintable(qp: string): string {
  const bytes: number[] = []
  const joined = qp.replace(/=\r\n/g, '')
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === '=' && /^[0-9A-F]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(joined.charCodeAt(i))
  }
  return new TextDecoder().decode(Uint8Array.from(bytes)).replace(/\r\n/g, '\n')
}

describe('the day words', () => {
  it('reads today, yesterday, a day this year and a day another year', () => {
    expect(evidenceDayWords('2026-11-01', TODAY)).toBe('today')
    expect(evidenceDayWords('2026-10-31', TODAY)).toBe('yesterday')
    expect(evidenceDayWords('2026-10-24', TODAY)).toBe('Oct 24')
    expect(evidenceDayWords('2025-10-24', TODAY)).toBe('Oct 24, 2025')
    expect(evidenceDayWords('', TODAY)).toBe('')
    expect(evidenceSpanWords('2026-10-24', '2026-11-01', TODAY)).toBe('Oct 24 to today')
    expect(evidenceSpanWords('2026-09-30', '2026-09-30', TODAY)).toBe('Sep 30')
  })

  it('names each job and the bid it came from as the tiles print them', () => {
    const tiles = evidenceJobTiles(
      [{ id: '11111111-1111-4111-8111-111111111111', hcp_number: 'J1077', click_number: null, job_name: '4 Elm Ct', status: 'billed', bid_id: 'b-482' }],
      [{ id: 'b-482', bid_number: 'B482', project_name: '4 Elm Ct', bid_due_date: null, bid_date_sent: null, outcome: 'won' }],
      TODAY,
    )
    expect(tiles).toEqual({ words: { [JOB_A]: 'J1077 · 4 Elm Ct', 'bid:b-482': 'B482 · 4 Elm Ct' }, numbers: ['J1077'] })
  })

  it('names the account’s jobs, and counts them past four', () => {
    expect(evidenceJobsWords(['J1077'])).toBe('emails on J1077')
    expect(evidenceJobsWords(['J1077', 'J1062', 'J1077'])).toBe('emails on J1077 and J1062')
    expect(evidenceJobsWords(['J1', 'J2', 'J3'])).toBe('emails on J1, J2 and J3')
    expect(evidenceJobsWords(['J1', 'J2', 'J3', 'J4', 'J5'])).toBe('emails on 5 jobs')
    expect(evidenceJobsWords([])).toBe('no jobs on this account')
  })
})

describe('conversationsOf', () => {
  const lines: EvidenceLine[] = [
    line('m-1'),
    line('m-2', { direction: 'out', at: '2026-10-24T19:40:00Z', subject: '', body: 'Will do. Install is set for Wednesday.', whoUserId: 'u-marisol', whoText: 'Marisol Vega <marisol@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega’s mail', mailbox: 'mine', mailUserId: 'u-marisol' }),
    line('m-3', { at: '2026-11-01T14:12:00Z', body: 'Owner wants the 50-gal, not the 40.', mailbox: 'mine', mailUserId: 'u-marisol', whoText: 'Dale Okafor <dale@ridgeway.example> to Marisol Vega’s mail' }),
    line('m-4', { jobKey: JOB_B, gmailThreadId: 't-oak', subject: 'Fwd: JP1062 final walk', at: '2026-09-30T16:00:00Z' }),
    // An email sent from the reply box: no Gmail id, no conversation.
    line('m-5', { direction: 'out', gmailId: null, gmailThreadId: null, rfcMessageId: null, subject: 'Your invoice', at: '2026-10-10T15:00:00Z', whoUserId: 'u-rosa', whoText: '', mailbox: 'team' }),
  ]

  it('groups by Gmail conversation on each job, newest first, then the app’s own sends', () => {
    const rows = conversationsOf(lines, [sent(SENT_ID), sent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { subject: 'Bill 88 sent', sentAt: '2026-10-20T15:00:00Z' })], people, jobs)
    expect(rows.map((r) => [r.kind, r.key])).toEqual([
      ['conversation', `thread:t-elm|${JOB_A}`],
      ['conversation', lineItemKey('m-5')],
      ['conversation', `thread:t-oak|${JOB_B}`],
      ['send', sentItemKey('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
      ['send', sentItemKey(SENT_ID)],
    ])
    const elm = rows[0]!
    expect(elm.items.map((i) => i.key)).toEqual(['line:m-1', 'line:m-2', 'line:m-3'])
    expect(elm.subject).toBe('Re: 4 Elm Ct water heater')
    expect(elm.headline).toBe('Re: 4 Elm Ct water heater · 3 emails, Oct 24 to today')
    expect(elm.parties).toEqual(['Dale Okafor'])
    expect(elm.provenance).toBe('read from bids@ · tagged by Marisol Vega from their mail')
    expect(elm.jobWords).toBe('J1077 · 4 Elm Ct')
    expect(rows[1]!.provenance).toBe('sent from Messages by Rosa Diaz')
    expect(rows[2]!.headline).toBe('Fwd: JP1062 final walk · 1 email, Sep 30')
    expect(rows[2]!.jobWords).toBe('J1062 · 9 Oak Row')
    const send = rows[4]!
    expect(send.headline).toBe('Estimate 1044 sent · Oct 2')
    expect(send.provenance).toBe(SENT_PROVENANCE)
    expect(send.parties).toEqual(['Dale Okafor'])
  })

  it('reads a conversation with no subject, and words where each line came from', () => {
    const rows = conversationsOf([line('m-9', { subject: '  ', gmailThreadId: 't-x' })], [], people, jobs)
    expect(rows[0]!.subject).toBe('(no subject)')
    expect(lineProvenance({ mailbox: 'team', mailUserId: null, gmailId: 'g', direction: 'in', whoUserId: null }, people)).toBe('read from team@')
    expect(lineProvenance({ mailbox: 'mine', mailUserId: 'u-gone', gmailId: 'g', direction: 'in', whoUserId: null }, people)).toBe('tagged by a teammate from their mail')
    expect(lineProvenance({ mailbox: null, mailUserId: null, gmailId: null, direction: 'in', whoUserId: null }, people)).toBe('written in Messages')
  })

  it('knows what the matter already holds: a line by its source, a send by its file’s name', () => {
    const on = onMatterKeys([{ source_message_id: 'm-1', original_name: 'Re 4 Elm Ct water heater 1 of 3.eml' }, { source_message_id: null, original_name: `sent-${SENT_ID} Estimate 1044 sent.eml` }, { source_message_id: null, original_name: 'sent-notauuid.eml' }])
    expect([...on].sort()).toEqual(['line:m-1', `sent:${SENT_ID}`])
    const rows = conversationsOf(lines, [sent(SENT_ID)], people, jobs)
    expect(conversationOnMatter(rows[0]!, on)).toEqual({ on: 1, all: false })
    expect(conversationOnMatter(rows.find((r) => r.kind === 'send')!, on)).toEqual({ on: 1, all: true })
  })
})

describe('emlOf', () => {
  const item = (l: EvidenceLine): EvidenceItem => ({ kind: 'line', key: lineItemKey(l.id), at: l.at, line: l })

  it('writes a box-read mail with its own From, the box as To, the company’s time, the kept Message-ID and the record', () => {
    const built = emlOf(item(line('m-1')), [], ctx)
    const [head, body] = built.text.split('\r\n\r\n')
    expect(head!.split('\r\n')).toEqual([
      'From: Dale Okafor <dale@ridgeway.example>',
      'To: bids@clickplumbing.example',
      'Date: Sat, 24 Oct 2026 14:03:00 -0500',
      'Subject: Re: 4 Elm Ct water heater',
      'Message-ID: <m-1@mail.ridgeway.example>',
      'X-PipeTooling-Record: made from Messages line m-1 on 2026-11-01',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
    ])
    expect(body).toBe('Yes, go ahead with the 40 for now.')
    expect(built.bytes).toBe(built.text.length)
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(built.text)).toBe(true)
    expect(built.text.includes('\n') && !/[^\r]\n/.test(built.text)).toBe(true)
    expect(built.attached).toEqual([])
    expect(built.listed).toEqual([])
  })

  it('a teammate’s mail copied to the box goes From them, To the person, Cc the box', () => {
    const out = line('m-7', { direction: 'out', whoUserId: 'u-rosa', whoText: 'Rosa Diaz <rosa@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · copied to bids@' })
    const head = emlOf(item(out), [], ctx).text.split('\r\n\r\n')[0]!
    expect(head).toContain('From: Rosa Diaz <rosa@clickplumbing.example>\r\nTo: Dale Okafor <dale@ridgeway.example>\r\nCc: bids@clickplumbing.example\r\n')
  })

  it('carries the kept files inside while they fit, and names the rest at the foot with why', () => {
    const pdf = new Uint8Array(3000).map((_, i) => i % 251)
    const big = new Uint8Array(1_200_000).fill(7)
    const l = line('m-3', {
      files: [
        { id: 'f-1', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 3000, bucketPath: 'g-m-3/1-elm-ct-spec-sheet.pdf', kind: 'file', url: null, leftInGmail: null },
        { id: 'f-2', name: 'plans.pdf', mime: 'application/pdf', size: 31_000_000, bucketPath: null, kind: 'file', url: null, leftInGmail: 'too_big' },
        { id: 'f-3', name: 'photos.zip', mime: 'application/zip', size: 1_200_000, bucketPath: 'g-m-3/3-photos.zip', kind: 'file', url: null, leftInGmail: null },
        { id: 'f-4', name: 'Drawings', mime: null, size: null, bucketPath: null, kind: 'link', url: 'https://www.dropbox.com/s/elm', leftInGmail: null },
      ],
    })
    const files = emlFilesOfLine(l, { 'f-1': pdf, 'f-3': big })
    expect(files.map((f) => [f.name, f.bytes === null ? null : f.bytes.length, f.note])).toEqual([
      ['elm-ct-spec-sheet.pdf', 3000, 'our copy could not be read'],
      ['plans.pdf', null, 'too big to keep, it stays in Gmail'],
      ['photos.zip', 1_200_000, 'our copy could not be read'],
      ['Drawings', null, 'a link, not a file: https://www.dropbox.com/s/elm'],
    ])
    expect([fileCanFit(3000, 1024 * 1024), fileCanFit(1_200_000, 1024 * 1024), fileCanFit(7_000_000), fileCanFit(8_000_000)]).toEqual([true, false, true, false])
    expect(emlFilesOfLine(l, {}, 1024 * 1024).map((f) => f.note)).toEqual(['our copy could not be read', 'too big to keep, it stays in Gmail', 'over the 1 MB this copy may carry', 'a link, not a file: https://www.dropbox.com/s/elm'])
    const built = emlOf(item(l), files, ctx, { maxBytes: 1024 * 1024 })
    expect(built.attached).toEqual(['elm-ct-spec-sheet.pdf'])
    expect(built.listed).toEqual(['plans.pdf: too big to keep, it stays in Gmail', 'photos.zip: over the 1 MB this copy may carry', 'Drawings: a link, not a file: https://www.dropbox.com/s/elm'])
    expect(built.bytes).toBeLessThanOrEqual(1024 * 1024)
    expect(built.text).toContain('Content-Type: multipart/mixed; boundary="=_pt_linem3_mixed"')
    expect(built.text).toContain('Content-Type: application/pdf; name="elm-ct-spec-sheet.pdf"\r\nContent-Disposition: attachment; filename="elm-ct-spec-sheet.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n')
    expect(built.text).toContain(base64Of(pdf.subarray(0, 57)))
    expect(built.text.trimEnd().endsWith('--=_pt_linem3_mixed--')).toBe(true)
    const textPart = built.text.split('Content-Transfer-Encoding: quoted-printable\r\n\r\n')[1]!.split('\r\n--=_pt_')[0]!
    expect(fromQuotedPrintable(textPart)).toBe(['Yes, go ahead with the 40 for now.', '', '--', 'Files on this email that are not inside this copy:', '- plans.pdf: too big to keep, it stays in Gmail', '- photos.zip: over the 1 MB this copy may carry', '- Drawings: a link, not a file: https://www.dropbox.com/s/elm'].join('\n'))
    // With room for both, both go inside.
    expect(emlOf(item(l), files, ctx).attached).toEqual(['elm-ct-spec-sheet.pdf', 'photos.zip'])
  })

  it('encodes a name and a subject past ASCII, and the words as quoted-printable', () => {
    const l = line('m-8', { contactName: 'José Muñoz', whoText: '', subject: 'Re: año nuevo — the café job', body: 'Gracias, José.' })
    const built = emlOf(item(l), [], ctx)
    expect(built.text).toContain(`From: =?UTF-8?B?${Buffer.from('José Muñoz').toString('base64')}?= <dale@ridgeway.example>`)
    expect(built.text).toContain('Subject: =?UTF-8?B?')
    expect(built.text).toContain('Gracias, Jos=C3=A9.')
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(built.text)).toBe(true)
  })

  it('makes an app send from its filed copy: the head’s From and To, the page as HTML beside its words, the files inside', () => {
    const html = sentEmailCopyHtml({ from: 'Click Plumbing <team@noreply.clicktooling.example>', to: ['dale@ridgeway.example'], cc: ['ana@ridgeway.example'], subject: 'Estimate 1044 sent', html: '<p>Hi Dale,</p><p>Your estimate is attached.</p>', attachments: [{ filename: 'Estimate-1044.pdf', content: 'JVBERi0=' }] })
    expect(filedHeader(html, 'From')).toBe('Click Plumbing <team@noreply.clicktooling.example>')
    const copy = sent(SENT_ID, { attachments: [{ name: 'Estimate-1044.pdf', path: `${SENT_ID}/1-Estimate-1044.pdf`, type: 'application/pdf', bytes: 5 }] })
    const built = emlOf({ kind: 'sent', key: sentItemKey(SENT_ID), at: copy.sentAt, copy }, [{ name: 'Estimate-1044.pdf', mime: 'application/pdf', bytes: Uint8Array.from([37, 80, 68, 70, 45]) }], ctx, { html })
    const head = built.text.split('\r\n\r\n')[0]!
    expect(head).toContain('From: Click Plumbing <team@noreply.clicktooling.example>\r\nTo: dale@ridgeway.example\r\nCc: ana@ridgeway.example\r\nDate: Fri, 2 Oct 2026 10:00:00 -0500\r\nSubject: Estimate 1044 sent\r\n')
    expect(head).toContain(`X-PipeTooling-Record: made from the app's sent copy ${SENT_ID} on 2026-11-01`)
    expect(head).not.toContain('Message-ID')
    expect(built.text).toContain('Content-Type: multipart/alternative;')
    expect(built.text).toContain('Content-Type: text/html; charset=utf-8')
    expect(built.attached).toEqual(['Estimate-1044.pdf'])
    const text = built.text.split('Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n')[1]!.split('\r\n--=_pt_')[0]!
    expect(fromQuotedPrintable(text)).toContain('Hi Dale,\n\nYour estimate is attached.')
  })

  it('an email the reply box sent goes From the app’s sender when no filed copy is handed in', () => {
    const l = line('m-5', { direction: 'out', gmailId: null, gmailThreadId: null, rfcMessageId: null, whoText: '', whoUserId: 'u-rosa', mailbox: 'team' })
    const head = emlOf(item(l), [], ctx).text.split('\r\n\r\n')[0]!
    expect(head).toContain('From: Click Plumbing and Electrical <team@noreply.clicktooling.example>\r\nTo: Dale Okafor <dale@ridgeway.example>\r\n')
  })
})

describe('the encodings', () => {
  it('quoted-printable keeps every line within 76 and reads back the same', () => {
    const words = `${'word '.repeat(40)}end\nA line = with an equals and a trailing space \nCafé ✓`
    const qp = quotedPrintable(words)
    for (const l of qp.split('\r\n')) expect(l.length).toBeLessThanOrEqual(76)
    expect(qp).toContain('=3D')
    expect(qp).toContain('space=20')
    expect(fromQuotedPrintable(qp)).toBe(words)
  })

  it('a long header past ASCII splits into words of at most 75', () => {
    const words = headerWords('Señor '.repeat(30))
    for (const w of words.split('\r\n ')) {
      expect(w.length).toBeLessThanOrEqual(75)
      expect(w).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    }
    expect(headerWords('Plain words')).toBe('Plain words')
    expect(mailboxHeader({ name: 'Okafor, Dale', address: 'dale@ridgeway.example' })).toBe('"Okafor, Dale" <dale@ridgeway.example>')
    expect(mailboxHeader({ name: null, address: 'dale@ridgeway.example' })).toBe('dale@ridgeway.example')
    expect(base64Of(new TextEncoder().encode('Ma'))).toBe('TWE=')
  })

  it('writes the date in the company’s zone with its offset, summer and winter', () => {
    expect(rfc5322Date('2026-10-24T19:03:00Z')).toBe('Sat, 24 Oct 2026 14:03:00 -0500')
    expect(rfc5322Date('2026-01-15T06:05:09Z')).toBe('Thu, 15 Jan 2026 00:05:09 -0600')
    expect(rfc5322Date('not a time')).toBe('')
  })
})

describe('documentDraftOf', () => {
  const rows = conversationsOf([line('m-1'), line('m-2', { direction: 'out', at: '2026-10-24T19:40:00Z', whoText: 'Marisol Vega <marisol@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega’s mail', mailbox: 'mine', mailUserId: 'u-marisol', whoUserId: 'u-marisol' })], [sent(SENT_ID)], people, jobs)
  const elm = rows[0]!
  const opts = { ourName: 'Click Plumbing and Electrical', todayYmd: TODAY, people }

  it('a mail in from a box: received on its day, the payer’s paper, the app’s record, its line', () => {
    const { draft, fileName } = documentDraftOf(elm, elm.items[0]!, 1, 2, { ...opts, copy: 'made' })
    expect(draft).toEqual({
      title: 'Re: 4 Elm Ct water heater · 1 of 2 · Oct 24, 2026',
      shows: 'Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, the app’s record of the mail as read from bids@.',
      datedOn: '2026-10-24',
      state: 'received',
      receivedOn: '2026-10-24',
      whose: 'theirs',
      sourceMessageId: 'm-1',
    })
    expect(fileName).toBe('Re 4 Elm Ct water heater 1 of 2.eml')
  })

  it('a tagged mail out as sent, or the record when its raw copy was not kept', () => {
    const raw = documentDraftOf(elm, elm.items[1]!, 2, 2, { ...opts, copy: 'raw' }).draft
    expect(raw.shows).toBe('Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, as sent.')
    expect([raw.state, raw.sent, raw.whose]).toEqual(['sent', { sentOn: '2026-10-24', sentHow: 'email', sentTo: 'Dale Okafor' }, 'ours'])
    expect(documentDraftOf(elm, elm.items[1]!, 2, 2, { ...opts, copy: 'made_raw_missing' }).draft.shows).toBe('Email between Dale Okafor and Click Plumbing and Electrical on J1077 · 4 Elm Ct, the app’s record of the mail tagged from Marisol Vega’s mail. The mail as received was not kept.')
    const raw1 = documentDraftOf(elm, elm.items[0]!, 1, 2, { ...opts, copy: 'raw' }).draft
    expect(raw1.shows.endsWith(', as received.')).toBe(true)
  })

  it('a supply house’s mail is the supplier’s paper; an app send is ours, filed, and named so the door knows it', () => {
    const house = conversationsOf([line('m-6', { contactKind: 'supply_house', contactName: 'Hill Supply', gmailThreadId: 't-hill' })], [], people, jobs)[0]!
    expect(documentDraftOf(house, house.items[0]!, 1, 1, { ...opts, copy: 'made' }).draft.whose).toBe('supplier')
    const send = rows.find((r) => r.kind === 'send')!
    const { draft, fileName } = documentDraftOf(send, send.items[0]!, 1, 1, { ...opts, copy: 'filed' })
    expect(draft.title).toBe('Estimate 1044 sent · Oct 2, 2026')
    expect(draft.shows).toBe('Email from Click Plumbing and Electrical to Dale Okafor on J1077 · 4 Elm Ct, the app’s own send as filed.')
    expect([draft.state, draft.sent?.sentHow, draft.sourceMessageId]).toEqual(['sent', 'email', null])
    expect(fileName).toBe(`sent-${SENT_ID} Estimate 1044 sent.eml`)
    expect(onMatterKeys([{ original_name: fileName }]).has(sentItemKey(SENT_ID))).toBe(true)
    expect(evidenceTitleOf({ subject: 'x'.repeat(200) }, 1, 1, '2026-10-24')).toBe(`${'x'.repeat(139)}… · Oct 24, 2026`)
  })
})

describe('putPlan', () => {
  const lines = [
    line('m-1'),
    line('m-2', { mailbox: 'mine', mailUserId: 'u-marisol', at: '2026-10-25T15:00:00Z' }),
    line('m-3', { mailbox: 'mine', mailUserId: 'u-marisol', at: '2026-10-26T15:00:00Z' }),
    line('m-4', { mailbox: 'mine', mailUserId: 'u-marisol', at: '2026-10-27T15:00:00Z' }),
  ]
  const rows = conversationsOf(lines, [sent(SENT_ID), sent('cccccccc-cccc-4ccc-8ccc-cccccccccccc', { copyPath: null })], people, jobs)
  const [elm, ...sends] = rows

  it('puts one document per email, holding what the matter has, a raw copy over 10 MB and a send with no copy', () => {
    const plan = putPlan([elm!, ...sends], { onMatter: new Set(['line:m-1']), rawBytes: { 'm-2': 40_000, 'm-3': 14 * 1024 * 1024, 'm-4': null } })
    expect(plan.ready.map((s) => [s.item.key, s.n, s.count, s.copy])).toEqual([
      ['line:m-2', 2, 4, 'raw'],
      ['line:m-4', 4, 4, 'made_raw_missing'],
      [sentItemKey(SENT_ID), 1, 1, 'filed'],
    ])
    expect(plan.held.map((h) => [h.item.key, h.why, h.words])).toEqual([
      ['line:m-1', 'on_matter', 'Already on the matter.'],
      ['line:m-3', 'too_big', 'The mail as received is 14.0 MB. A matter takes 10 MB at most.'],
      ['sent:cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'no_copy', 'The app kept no copy of this send.'],
    ])
    expect(plan.held[0]!.title).toBe('Re: 4 Elm Ct water heater · 1 of 4 · Oct 24, 2026')
    expect(plan.button).toBe('Put 3 on the matter')
    expect(plan.dead).toBe(false)
    expect(plan.foot).toBe('3 emails are held. They stay off the matter with their reasons below.')
  })

  it('is dead with nothing ticked, and says so when every tick is held', () => {
    expect(putPlan([], { onMatter: new Set(), rawBytes: {} })).toMatchObject({ ready: [], held: [], button: 'Put on the matter', dead: true, foot: null })
    const allOn = putPlan([sends[0]!], { onMatter: new Set([sentItemKey(SENT_ID)]), rawBytes: {} })
    expect(allOn).toMatchObject({ button: 'Put on the matter', dead: true, foot: 'Nothing ticked is ready to put. Each email is held with its reason below.' })
    expect(putPlan([sends[0]!, sends[1]!], { onMatter: new Set(), rawBytes: {} }).foot).toBe('1 email is held. It stays off the matter with its reason below.')
  })

  it('words the outcome: what went, what did not, what was held', () => {
    const plan = putPlan([elm!], { onMatter: new Set(['line:m-1']), rawBytes: { 'm-2': 1, 'm-3': 1, 'm-4': 1 } })
    const o = putOutcomeWords({ done: plan.ready.slice(0, 2).map((s) => ({ key: s.item.key, title: s.title, copy: s.copy })), failed: [{ key: 'line:m-4', title: 'x', reason: 'Could not store x.eml' }], held: plan.held })
    expect(o).toEqual({ line: 'Put 2 emails. 1 did not go on the matter.', head: '1 email did not go on the matter. It stays here with the reason.', tone: 'warning', heldLine: '1 email was held, with its reason below.' })
    expect(putOutcomeWords({ done: [{ key: 'a', title: 'a', copy: 'raw' }], failed: [], held: [] })).toEqual({ line: 'Put 1 email.', head: null, tone: 'success', heldLine: null })
  })
})

describe('the doors', () => {
  it('opens the line in Messages at its thread, and finds a tagged line’s raw copy', () => {
    expect(messagesLineHref('c-dale', 'm-1')).toBe('/messages?thread=c-dale&at=m-1')
    expect(myMailRawPath('m-1')).toBe('mine/m-1.eml')
    expect(EVIDENCE_FROM_MESSAGES_WORDS.door).toBe('From the job’s messages…')
  })
})
