import { describe, expect, it } from 'vitest'
import { base64UrlBytes, decodeHeaderWords, EMAIL_TEXT_MAX, htmlToText, parseAddress, parseAddressList, readGmailMessage, type GmailPart } from './gmailMessage'

/** Text as Gmail sends a part's bytes: base64url of its UTF-8, or of the bytes given. */
const b64url = (text: string | Uint8Array): string => {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const h = (name: string, value: string) => ({ name, value })

const greg: GmailPart = {
  mimeType: 'multipart/mixed',
  headers: [
    h('From', 'Greg Paulk <greg@hillside.example>'),
    h('To', 'bids@clickconstruction.example'),
    h('Cc', '"Paulk, Dana" <dana@hillside.example>, robert@clickconstruction.example'),
    h('Subject', 'Hillside sitework, Boerne, rev 1'),
  ],
  parts: [
    {
      mimeType: 'multipart/alternative',
      parts: [
        { partId: '0.0', mimeType: 'text/plain', headers: [h('Content-Type', 'text/plain; charset="UTF-8"')], body: { data: b64url('Robert,\r\n\r\nNumbers attached.  \r\nDrawings: https://www.dropbox.com/scl/fi/abc/Addendum-2.pdf?dl=0.\r\n\r\n\r\n\r\nGreg') } },
        { partId: '0.1', mimeType: 'text/html', body: { data: b64url('<p>Robert,</p><p>Numbers attached.</p><a href="https://hillside.example/about">us</a>') } },
      ],
    },
    { partId: '1', mimeType: 'application/pdf', filename: 'Hillside-Boerne-sitework-rev1.pdf', headers: [h('Content-Disposition', 'attachment; filename="Hillside-Boerne-sitework-rev1.pdf"')], body: { attachmentId: 'att-1', size: 1_250_000 } },
    { partId: '2', mimeType: 'image/png', filename: 'logo.png', headers: [h('Content-Disposition', 'inline; filename="logo.png"'), h('Content-ID', '<logo@hillside>')], body: { attachmentId: 'att-2', size: 4_200 } },
  ],
}

describe('readGmailMessage', () => {
  it('reads the addresses, the subject, the plain words, the links and the files', () => {
    const email = readGmailMessage({ id: 'g-1', threadId: 't-1', labelIds: ['INBOX', 'CATEGORY_PERSONAL'], internalDate: String(Date.UTC(2026, 9, 2, 16, 30)), payload: greg })
    expect(email.gmailId).toBe('g-1')
    expect(email.threadId).toBe('t-1')
    expect(email.at).toBe('2026-10-02T16:30:00.000Z')
    expect(email.from).toEqual({ name: 'Greg Paulk', address: 'greg@hillside.example' })
    expect(email.to).toEqual([{ name: null, address: 'bids@clickconstruction.example' }])
    expect(email.cc).toEqual([
      { name: 'Paulk, Dana', address: 'dana@hillside.example' },
      { name: null, address: 'robert@clickconstruction.example' },
    ])
    expect(email.subject).toBe('Hillside sitework, Boerne, rev 1')
    expect(email.text).toBe('Robert,\n\nNumbers attached.\nDrawings: https://www.dropbox.com/scl/fi/abc/Addendum-2.pdf?dl=0.\n\nGreg')
    expect(email.links).toEqual(['https://hillside.example/about', 'https://www.dropbox.com/scl/fi/abc/Addendum-2.pdf?dl=0'])
    expect(email.files).toEqual([
      { partId: '1', name: 'Hillside-Boerne-sitework-rev1.pdf', mime: 'application/pdf', size: 1_250_000, attachmentId: 'att-1', data: null, inline: false },
      { partId: '2', name: 'logo.png', mime: 'image/png', size: 4_200, attachmentId: 'att-2', data: null, inline: true },
    ])
    expect(email.headers['subject']).toBe('Hillside sitework, Boerne, rev 1')
  })

  it('reads an HTML-only email as text: paragraphs, breaks, list items and entities', () => {
    const email = readGmailMessage({
      id: 'g-2',
      payload: { mimeType: 'text/html', headers: [h('From', 'jonah@marshvale.example')], body: { data: b64url('<html><head><style>p{}</style></head><body><p>Robert,</p><p>Addendum&nbsp;2 is here &amp; <b>ready</b>.<br>Items:</p><ul><li>Panel</li><li>Curbs</li></ul><p><a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing&amp;x=1">the set</a></p></body></html>') } },
    })
    expect(email.text).toBe('Robert,\n\nAddendum 2 is here & ready.\nItems:\n\n- Panel\n- Curbs\n\nthe set')
    expect(email.links).toEqual(['https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing&x=1'])
    expect(email.at).toBeNull()
    expect(email.files).toEqual([])
  })

  it('reads a part in its own charset', () => {
    const latin1 = new Uint8Array([0x43, 0x61, 0x66, 0xe9])
    const email = readGmailMessage({ id: 'g-3', payload: { mimeType: 'text/plain', headers: [h('Content-Type', 'text/plain; charset=ISO-8859-1')], body: { data: b64url(latin1) } } })
    expect(email.text).toBe('Café')
  })

  it('keeps the first words of a very long email and says where the rest is', () => {
    const email = readGmailMessage({ id: 'g-4', payload: { mimeType: 'text/plain', body: { data: b64url('x'.repeat(EMAIL_TEXT_MAX + 50)) } } })
    expect(email.text.startsWith('x'.repeat(EMAIL_TEXT_MAX))).toBe(true)
    expect(email.text.endsWith('[The rest of this email is in Gmail.]')).toBe(true)
  })

  it('names a file with no name by what it is, and takes an attached text file as a file', () => {
    const email = readGmailMessage({
      id: 'g-5',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('See attached.') } },
          { partId: '1', mimeType: 'text/plain', filename: 'notes.txt', body: { attachmentId: 'a', size: 10 } },
          { partId: '2', mimeType: 'image/jpeg', headers: [h('Content-ID', '<x>')], body: { attachmentId: 'b', size: 50_000 } },
        ],
      },
    })
    expect(email.text).toBe('See attached.')
    expect(email.files.map((f) => [f.name, f.inline])).toEqual([['notes.txt', false], ['picture', true]])
  })
})

describe('addresses and header words', () => {
  it('reads each way an address is written', () => {
    expect(parseAddress('Greg Paulk <greg@hillside.example>')).toEqual({ name: 'Greg Paulk', address: 'greg@hillside.example' })
    expect(parseAddress('"Paulk, Greg" <greg@hillside.example>')).toEqual({ name: 'Paulk, Greg', address: 'greg@hillside.example' })
    expect(parseAddress('greg@hillside.example')).toEqual({ name: null, address: 'greg@hillside.example' })
    expect(parseAddress('Greg Paulk [mailto:greg@hillside.example]')).toEqual({ name: 'Greg Paulk', address: 'greg@hillside.example' })
    expect(parseAddress('Greg Paulk <mailto:greg@hillside.example>')).toEqual({ name: 'Greg Paulk', address: 'greg@hillside.example' })
    expect(parseAddress('Greg Paulk')).toBeNull()
    expect(parseAddressList('a@x.example; "B, C" <b@x.example>,')).toEqual([
      { name: null, address: 'a@x.example' },
      { name: 'B, C', address: 'b@x.example' },
    ])
    expect(parseAddressList(undefined)).toEqual([])
  })

  it('reads RFC 2047 words, B and Q, and passes plain words through', () => {
    expect(decodeHeaderWords('=?UTF-8?B?Q2Fmw6k=?= order')).toBe('Café order')
    expect(decodeHeaderWords('=?ISO-8859-1?Q?Caf=E9_order?=')).toBe('Café order')
    expect(decodeHeaderWords('=?UTF-8?Q?a?= =?UTF-8?Q?b?=')).toBe('ab')
    expect(decodeHeaderWords('Plain words')).toBe('Plain words')
    expect(parseAddress('=?UTF-8?B?w4lsZW5h?= <elena@cibolocreek.example>')).toEqual({ name: 'Élena', address: 'elena@cibolocreek.example' })
  })

  it('reads entities and drops what is not words', () => {
    expect(htmlToText('<!-- x --><script>bad()</script>A&#39;s &#x2014; B')).toBe("A's — B")
    expect(base64UrlBytes('%%%')).toEqual(new Uint8Array(0))
  })
})
