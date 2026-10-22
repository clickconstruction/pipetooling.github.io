import { describe, expect, it } from 'vitest'
import { emailFileRows, emailLine, emailParty, fileKeep, KEEP_FILE_BYTES, RFC_MESSAGE_ID_MAX, rfcMessageId, SKIP_INLINE_PICTURE_BYTES } from './emailLine'
import type { Forwarded } from './forwarded'
import type { EmailIn } from './gmailMessage'

const isOurs = (a: string) => a.toLowerCase().endsWith('@clickconstruction.example')
const isTheBox = (a: string) => a.toLowerCase() === 'bids@clickconstruction.example'
const ours = { isOurs, isTheBox }
const greg = { name: 'Greg Paulk', address: 'greg@hillside.example' }
const rosa = { name: 'Rosa Diaz', address: 'rosa@clickconstruction.example' }
const malachi = { name: 'Malachi', address: 'malachi@clickconstruction.example' }
const bids = { name: null, address: 'bids@clickconstruction.example' }
const elena = { name: 'Elena Marchetti', address: 'elena@cibolocreek.example' }

const email = (over: Partial<EmailIn> = {}): EmailIn => ({
  gmailId: 'g-1',
  threadId: 't-1',
  labels: ['INBOX'],
  at: '2026-10-02T16:30:00.000Z',
  from: greg,
  to: [],
  cc: [],
  subject: 'Hillside sitework, Boerne, rev 1',
  text: 'Robert,\n\nNumbers attached.',
  links: [],
  files: [],
  headers: {},
  ...over,
})

const fwd = (over: Partial<Forwarded> = {}): Forwarded => ({
  from: elena,
  by: rosa,
  to: [rosa],
  subject: 'Pay application 3',
  at: '2026-10-01T21:02:00.000Z',
  text: 'The check goes out Friday.',
  note: null,
  ...over,
})

describe('fileKeep', () => {
  it('copies a file up to 25 MB, leaves a bigger one in Gmail, and leaves out a small picture in the body', () => {
    expect(fileKeep({ size: 1_200_000, inline: false, mime: 'application/pdf' })).toBe('copy')
    expect(fileKeep({ size: KEEP_FILE_BYTES, inline: false, mime: 'application/pdf' })).toBe('copy')
    expect(fileKeep({ size: KEEP_FILE_BYTES + 1, inline: false, mime: 'application/zip' })).toBe('tooBig')
    expect(fileKeep({ size: SKIP_INLINE_PICTURE_BYTES - 1, inline: true, mime: 'image/png' })).toBe('skip')
    expect(fileKeep({ size: SKIP_INLINE_PICTURE_BYTES, inline: true, mime: 'image/jpeg' })).toBe('copy')
    expect(fileKeep({ size: 4_000, inline: false, mime: 'image/png' })).toBe('copy')
  })
})

describe('emailParty: whose thread, and which way', () => {
  it('is the sender, coming in', () => {
    expect(emailParty(email(), null, ours)).toEqual({ address: greg, direction: 'in' })
  })

  it('is nobody when the box itself or the app wrote, or no sender is named', () => {
    expect(emailParty(email({ from: bids }), null, ours)).toBeNull()
    expect(emailParty(email({ from: null }), null, ours)).toBeNull()
  })

  it("is the teammate, coming in, when one of us wrote to the box with nobody outside named (v2.5722)", () => {
    expect(emailParty(email({ from: rosa, to: [bids] }), null, ours)).toEqual({ address: rosa, direction: 'in' })
    expect(emailParty(email({ from: rosa, to: [bids, malachi] }), null, ours)).toEqual({ address: rosa, direction: 'in' })
  })

  it("is the customer, going out, when one of us wrote to them with the box copied (v2.5722)", () => {
    expect(emailParty(email({ from: rosa, to: [elena], cc: [bids] }), null, ours)).toEqual({ address: elena, direction: 'out' })
    expect(emailParty(email({ from: rosa, to: [bids, elena] }), null, ours)).toEqual({ address: elena, direction: 'out' })
  })

  it("is a forwarded copy's first sender, or, when that was one of us, the one we wrote to, going out", () => {
    expect(emailParty(email({ from: rosa }), fwd(), ours)).toEqual({ address: elena, direction: 'in' })
    expect(emailParty(email({ from: rosa }), fwd({ from: rosa, to: [rosa, elena] }), ours)).toEqual({ address: elena, direction: 'out' })
    expect(emailParty(email({ from: rosa }), fwd({ from: rosa, to: [rosa] }), ours)).toBeNull()
  })
})

describe('emailLine', () => {
  it("names the sender and the box it reached", () => {
    expect(emailLine(email(), null, { address: greg, direction: 'in' }, 'bids@')).toEqual({
      gmailId: 'g-1',
      gmailThreadId: 't-1',
      direction: 'in',
      at: '2026-10-02T16:30:00.000Z',
      subject: 'Hillside sitework, Boerne, rev 1',
      body: 'Robert,\n\nNumbers attached.',
      whoText: 'Greg Paulk <greg@hillside.example> to bids@',
      rfcMessageId: null,
    })
    expect(emailLine(email({ from: { name: null, address: 'dee@alamoconcrete.example' }, subject: '' }), null, { address: { name: null, address: 'dee@alamoconcrete.example' }, direction: 'in' }, 'bids@')).toMatchObject({
      subject: null,
      whoText: 'dee@alamoconcrete.example to bids@',
    })
  })

  it("names a teammate's mail to the box as theirs, and one to a customer with the box copied as ours to them (v2.5722)", () => {
    expect(emailLine(email({ from: rosa, to: [bids] }), null, { address: rosa, direction: 'in' }, 'team@')).toMatchObject({
      direction: 'in',
      whoText: 'Rosa Diaz <rosa@clickconstruction.example> to team@',
    })
    expect(emailLine(email({ from: rosa, to: [elena], cc: [bids] }), null, { address: elena, direction: 'out' }, 'team@')).toMatchObject({
      direction: 'out',
      whoText: 'Rosa Diaz <rosa@clickconstruction.example> to Elena Marchetti <elena@cibolocreek.example> · copied to team@',
    })
  })

  it("takes a forwarded copy's words, subject and time, and says who forwarded it", () => {
    const line = emailLine(email({ from: rosa, subject: 'Fwd: Pay application 3' }), fwd(), { address: elena, direction: 'in' }, 'bids@', 'Rosa')
    expect(line).toMatchObject({
      at: '2026-10-01T21:02:00.000Z',
      subject: 'Pay application 3',
      body: 'The check goes out Friday.',
      whoText: 'Elena Marchetti <elena@cibolocreek.example> · forwarded to bids@ by Rosa',
    })
  })

  it("falls back to the email's own time, its subject without Fwd:, and the forwarder's own name", () => {
    const line = emailLine(email({ from: rosa, subject: 'FW: Fwd: Glass' }), fwd({ subject: null, at: null }), { address: elena, direction: 'in' }, 'bids@')
    expect(line).toMatchObject({ at: '2026-10-02T16:30:00.000Z', subject: 'Glass', whoText: 'Elena Marchetti <elena@cibolocreek.example> · forwarded to bids@ by Rosa Diaz' })
  })
})

describe('rfcMessageId: the same mail in both boxes', () => {
  it("is the mail's Message-ID header, trimmed, on the line and on a forwarded copy's line", () => {
    const headers = { 'message-id': '  <CAF8x2@mail.gmail.com> ' }
    expect(rfcMessageId({ headers })).toBe('<CAF8x2@mail.gmail.com>')
    expect(emailLine(email({ headers }), null, { address: greg, direction: 'in' }, 'bids@').rfcMessageId).toBe('<CAF8x2@mail.gmail.com>')
    expect(emailLine(email({ from: rosa, headers }), fwd(), { address: elena, direction: 'in' }, 'office@', 'Rosa').rfcMessageId).toBe('<CAF8x2@mail.gmail.com>')
  })

  it('is null when the mail has none, an empty one, or one longer than a header line', () => {
    expect(rfcMessageId({ headers: {} })).toBeNull()
    expect(rfcMessageId({ headers: { 'message-id': '   ' } })).toBeNull()
    expect(rfcMessageId({ headers: { 'message-id': `<${'x'.repeat(RFC_MESSAGE_ID_MAX)}>` } })).toBeNull()
    expect(rfcMessageId({ headers: { 'message-id': `<${'x'.repeat(RFC_MESSAGE_ID_MAX - 2)}>` } })).toHaveLength(RFC_MESSAGE_ID_MAX)
  })
})

describe('emailFileRows', () => {
  it("rows each kept file with its paper guess, leaves out a small picture in the body, and adds the file hosts' links", () => {
    const rows = emailFileRows(
      email({
        files: [
          { partId: '1', name: 'Hillside COI 2027.pdf', mime: 'application/pdf', size: 380_000, attachmentId: 'a1', data: null, inline: false },
          { partId: '2', name: 'logo.png', mime: 'image/png', size: 3_000, attachmentId: 'a2', data: null, inline: true },
          { partId: '3', name: 'full-set.zip', mime: 'application/zip', size: 31_000_000, attachmentId: 'a3', data: null, inline: false },
        ],
        links: ['https://hillside.example/about', 'https://we.tl/t-AbC123'],
      }),
      'trade',
    )
    expect(rows).toEqual([
      { kind: 'file', name: 'Hillside COI 2027.pdf', mime: 'application/pdf', size: 380_000, partId: '1', attachmentId: 'a1', keep: 'copy', paper: 'coi' },
      { kind: 'file', name: 'full-set.zip', mime: 'application/zip', size: 31_000_000, partId: '3', attachmentId: 'a3', keep: 'tooBig', paper: null },
      { kind: 'link', name: 'WeTransfer link', url: 'https://we.tl/t-AbC123', host: 'wetransfer' },
    ])
  })
})
