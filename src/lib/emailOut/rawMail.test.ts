/**
 * The raw mail `messages-email` sends through Gmail as the box (punch list #207 PR 2, v2.6702). Every name, address and
 * job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { base64OfBytes, base64UrlOfBytes, encodedWord, mailboxHeader, messagesEmailMessageId, mimeByName, rawMailBase64Url, rawMailMessage, senderDisplayName, wrap76 } from './rawMail'

const decode = (b64: string): string => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0)))

const MAIL = {
  from: 'Marisol Vega · Click Construction <bids@clickplumbing.example>',
  to: 'Dale Okafor <dale@ridgeway.example>',
  subject: 'JP1077 · 4 Elm Ct — Thursday',
  text: 'Dale,\n\nThursday works for us.\n\nMarisol Vega\nEstimator · Click Construction',
  html: '<!doctype html><html><body><p>Dale,</p><p>Thursday works for us.</p></body></html>',
  messageId: '<messages-0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01@clickplumbing.example>',
  at: '2026-11-08T15:04:05.000Z',
}

describe('rawMail: the display name and the Message-ID', () => {
  it('names the person and the company on the From, the company alone for an unnamed person', () => {
    expect(senderDisplayName('Marisol Vega', 'Click Construction')).toBe('Marisol Vega · Click Construction')
    expect(senderDisplayName('', 'Click Construction')).toBe('Click Construction')
    expect(senderDisplayName(null, 'Click Construction')).toBe('Click Construction')
    expect(senderDisplayName('Marisol Vega', '')).toBe('Marisol Vega')
  })

  it('makes a Message-ID of our own in the box’s domain, from the line’s id', () => {
    expect(messagesEmailMessageId('0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01', 'bids@clickplumbing.example')).toBe('<messages-0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01@clickplumbing.example>')
    expect(messagesEmailMessageId('abc', 'nowhere')).toBe('<messages-abc@pipetooling.local>')
  })

  it('encodes a header word only when it is not ASCII, and a mailbox’s name the same way', () => {
    expect(encodedWord('Thursday works')).toBe('Thursday works')
    expect(encodedWord('JP1077 · 4 Elm Ct')).toBe(`=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode('JP1077 · 4 Elm Ct')))}?=`)
    expect(mailboxHeader('bids@clickplumbing.example')).toBe('bids@clickplumbing.example')
    expect(mailboxHeader('Dale Okafor <dale@ridgeway.example>')).toBe('Dale Okafor <dale@ridgeway.example>')
    expect(mailboxHeader('"Okafor, Dale" <dale@ridgeway.example>')).toBe('"Okafor, Dale" <dale@ridgeway.example>')
    expect(mailboxHeader('Marisol Vega · Click Construction <bids@clickplumbing.example>')).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <bids@clickplumbing\.example>$/)
    expect(mailboxHeader('"Marisol Vega · Click Construction" <bids@clickplumbing.example>')).toBe(mailboxHeader('Marisol Vega · Click Construction <bids@clickplumbing.example>'))
  })

  it('guesses a file’s type from its name', () => {
    expect(mimeByName('plans.PDF')).toBe('application/pdf')
    expect(mimeByName('photo.jpeg')).toBe('image/jpeg')
    expect(mimeByName('whatever.bin')).toBe('application/octet-stream')
  })
})

describe('rawMail: the mail itself', () => {
  it('writes the headers, then the words and the HTML as multipart/alternative, every part base64', () => {
    const raw = rawMailMessage(MAIL)
    const lines = raw.split('\r\n')
    expect(lines[0]).toMatch(/^From: =\?UTF-8\?B\?.+\?= <bids@clickplumbing\.example>$/)
    expect(lines[1]).toBe('To: Dale Okafor <dale@ridgeway.example>')
    expect(lines.some((l) => l.startsWith('Reply-To:'))).toBe(false)
    expect(lines[2]).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/)
    expect(lines[3]).toBe('Date: Sun, 08 Nov 2026 15:04:05 GMT')
    expect(lines[4]).toBe(`Message-ID: ${MAIL.messageId}`)
    expect(lines[5]).toBe('MIME-Version: 1.0')
    expect(lines[6]).toMatch(/^Content-Type: multipart\/alternative; boundary="=_pt1_[A-Za-z0-9]+"$/)
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n')
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n')
    // The words travel whole, CRLF inside the plain part, and the HTML as given.
    const plain = /text\/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(raw)![1]!
    expect(decode(plain)).toBe(MAIL.text.replace(/\n/g, '\r\n'))
    const html = /text\/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(raw)![1]!
    expect(decode(html)).toBe(MAIL.html)
    expect(raw.endsWith('--\r\n')).toBe(true)
  })

  it('carries a Reply-To when asked', () => {
    expect(rawMailMessage({ ...MAIL, replyTo: 'team@clickplumbing.example' })).toContain('\r\nReply-To: team@clickplumbing.example\r\n')
  })

  it('wraps the alternative and each file in multipart/mixed when there are files, the file’s type from the name when none is given', () => {
    const content = btoa('%PDF-1.4 fake')
    const raw = rawMailMessage({ ...MAIL, files: [{ filename: 'Plans A1.pdf', content }, { filename: 'site.jpg', content: btoa('jpg'), mime: 'image/jpeg' }] })
    expect(raw).toMatch(/Content-Type: multipart\/mixed; boundary="=_pt2_[A-Za-z0-9]+"\r\n\r\n--=_pt2_/)
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="=_pt1_')
    expect(raw).toContain('Content-Type: application/pdf; name="Plans A1.pdf"\r\nContent-Disposition: attachment; filename="Plans A1.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + content)
    expect(raw).toContain('Content-Type: image/jpeg; name="site.jpg"')
    const mixed = /boundary="(=_pt2_[A-Za-z0-9]+)"/.exec(raw)![1]!
    expect(raw.trimEnd().endsWith(`--${mixed}--`)).toBe(true)
  })

  it('never lets a header value break into a second header', () => {
    const raw = rawMailMessage({ ...MAIL, subject: 'Hello\r\nBcc: someone@else.example', to: 'dale@ridgeway.example' })
    expect(raw).not.toContain('\r\nBcc:')
    expect(raw.split('\r\n')[2]).toBe('Subject: Hello Bcc: someone@else.example')
  })

  it('wraps base64 at 76 characters and writes the raw as base64url with no padding', () => {
    const long = base64OfBytes(new Uint8Array(200))
    const wrapped = wrap76(long)
    expect(wrapped.split('\r\n').every((l) => l.length <= 76)).toBe(true)
    expect(wrapped.replace(/\r\n/g, '')).toBe(long)
    const url = rawMailBase64Url(MAIL)
    expect(url).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(base64UrlOfBytes(new Uint8Array([251, 255]))).toBe('-_8')
  })
})
