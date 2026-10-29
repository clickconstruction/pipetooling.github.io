import { describe, expect, it } from 'vitest'
import {
  buildPlainMessagesEmail,
  letterheadFor,
  MESSAGES_EMAIL_BODY_MAX,
  parseMessagesEmailBody,
} from '../../../supabase/functions/_shared/messagesEmail'

const CONTACT = '0f6a3c2e-1b7d-4e55-9a0c-3f2b8d1e4a01'
const CHANNEL = '7c1d9e44-2a6b-4f03-8e5d-6b0a2c9f1d02'
const JOB = 'b3e8f0a1-9c2d-4e7f-a6b5-1d0c3e2f4a03'

const request = (more: Record<string, unknown> = {}) => ({
  contactId: CONTACT,
  channelId: CHANNEL,
  tie: { jobId: JOB, column: 'project_id' },
  subject: 'Stone Oak Pharmacy: Checking on the number',
  body: 'Greg,\n\nChecking on the number. Still good for today?',
  signature: ['Robert', 'Project manager · Click Construction', 'cell (210) 555-0142'],
  ...more,
})

describe('the reply box’s email request, checked by messages-email', () => {
  it('reads the person, the address, the job and the words, trimmed; a greeting and a footer read empty when a client sends none', () => {
    expect(parseMessagesEmailBody(request({ subject: '  Stone Oak Pharmacy: Checking on the number  ' }))).toEqual({
      contactId: CONTACT,
      channelId: CHANNEL,
      tie: { jobId: JOB, column: 'project_id' },
      subject: 'Stone Oak Pharmacy: Checking on the number',
      greeting: '',
      body: 'Greg,\n\nChecking on the number. Still good for today?',
      signature: ['Robert', 'Project manager · Click Construction', 'cell (210) 555-0142'],
      footer: '',
    })
  })

  it('takes no job, and a stale client’s greeting and footer', () => {
    expect(parseMessagesEmailBody(request({ tie: null, greeting: 'Hello Greg,', footer: 'Click Construction. About Stone Oak Pharmacy.' }))).toMatchObject({
      tie: null,
      greeting: 'Hello Greg,',
      footer: 'Click Construction. About Stone Oak Pharmacy.',
    })
  })

  it('refuses a missing or blank piece, an id that is not one, and words that run long', () => {
    expect(parseMessagesEmailBody(null)).toBeNull()
    expect(parseMessagesEmailBody([request()])).toBeNull()
    expect(parseMessagesEmailBody(request({ contactId: 'c-greg' }))).toBeNull()
    expect(parseMessagesEmailBody(request({ channelId: undefined }))).toBeNull()
    expect(parseMessagesEmailBody(request({ subject: '   ' }))).toBeNull()
    expect(parseMessagesEmailBody(request({ body: '' }))).toBeNull()
    expect(parseMessagesEmailBody(request({ body: 'x'.repeat(MESSAGES_EMAIL_BODY_MAX + 1) }))).toBeNull()
    expect(parseMessagesEmailBody(request({ subject: 'x'.repeat(201) }))).toBeNull()
  })

  it('refuses a job without its column, or in a column that is not a job’s, and a signature that is not short lines', () => {
    expect(parseMessagesEmailBody(request({ tie: { jobId: JOB } }))).toBeNull()
    expect(parseMessagesEmailBody(request({ tie: { jobId: JOB, column: 'contact_id' } }))).toBeNull()
    expect(parseMessagesEmailBody(request({ tie: 'project:x' }))).toBeNull()
    expect(parseMessagesEmailBody(request({ signature: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }))).toBeNull()
    expect(parseMessagesEmailBody(request({ signature: ['a', 'b', 'c', 'd', 'e', 'f'] }))).not.toBeNull()
    expect(parseMessagesEmailBody(request({ signature: ['Robert', ''] }))).toBeNull()
  })
})

describe('the company on the From', () => {
  it('is the plumbing company on a Pipeline job, Click Construction on any other or none', () => {
    expect(letterheadFor('jobs_ledger_id')).toBe('Click Plumbing and Electrical')
    expect(letterheadFor('project_id')).toBe('Click Construction')
    expect(letterheadFor('bid_id')).toBe('Click Construction')
    expect(letterheadFor(null)).toBe('Click Construction')
  })
})

describe('the email they read: plain (#207 PR 1, the mock-up’s shape A)', () => {
  const words = request() as unknown as Parameters<typeof buildPlainMessagesEmail>[0]

  it('carries the body as typed, then the signature, and nothing after it: no bar, no card, no footer, no closing of ours', () => {
    const built = buildPlainMessagesEmail(words)
    expect(built.subject).toBe('Stone Oak Pharmacy: Checking on the number')
    expect(built.text).toBe(['Greg,\n\nChecking on the number. Still good for today?', 'Robert\nProject manager · Click Construction\ncell (210) 555-0142'].join('\n\n'))
    expect(built.html).toContain('<p style="margin:0 0 12px">Greg,<br><br>Checking on the number. Still good for today?</p>')
    expect(built.html).toContain('Robert<br><span style="color:#6b7280;font-size:13px">Project manager · Click Construction</span><br><span style="color:#6b7280;font-size:13px">cell (210) 555-0142</span></p>')
    expect(built.html.endsWith('</p></div></body></html>')).toBe(true)
    // The font stack sits inside a double-quoted style attribute, so its own quotes are single ones and the size, the line height and the ink survive.
    expect(built.html).toContain(`font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">`)
    expect(built.html).not.toContain('"Segoe UI"')
    // Nothing of the letterhead's: no bar with the company's name, no cream card, no ink border.
    expect(built.html).not.toContain('Click Construction</div>')
    expect(built.html).not.toContain('text-transform:uppercase')
    expect(built.html).not.toContain('#f7f5ef')
    expect(built.html).not.toContain('Thank you,')
    expect(built.html).not.toContain('Email back, text, or call.')
    expect(built.text).not.toContain('About Stone Oak Pharmacy')
  })

  it('escapes the office’s words and leaves out a blank signature line', () => {
    const built = buildPlainMessagesEmail({ ...words, body: 'Bring <the> plans & the pad', signature: ['Robert', ' ', 'cell (210) 555-0142'] })
    expect(built.html).toContain('Bring &lt;the&gt; plans &amp; the pad')
    expect(built.text).toBe('Bring <the> plans & the pad\n\nRobert\ncell (210) 555-0142')
    expect(built.text.startsWith('Bring <the> plans & the pad')).toBe(true)
  })

  it('draws a stale client’s greeting before the body and its footer after the signature, small and grey', () => {
    const built = buildPlainMessagesEmail({ ...words, body: 'Checking on the number.', greeting: 'Hello Greg,', footer: 'Click Construction. About Stone Oak Pharmacy.' })
    expect(built.text).toBe(['Hello Greg,', 'Checking on the number.', 'Robert\nProject manager · Click Construction\ncell (210) 555-0142', 'Click Construction. About Stone Oak Pharmacy.'].join('\n\n'))
    expect(built.html).toContain('<p style="margin:0 0 12px">Hello Greg,</p><p style="margin:0 0 12px">Checking on the number.</p>')
    expect(built.html).toContain('<p style="margin:12px 0 0;color:#6b7280;font-size:13px">Click Construction. About Stone Oak Pharmacy.</p></div>')
  })

  it('puts the files that went as links after the body, a line each, the link a link (cut 7e)', () => {
    const built = buildPlainMessagesEmail(words, [
      { text: 'The plans are in your portal', url: 'https://clicktooling.com/t/7Hq2#plans' },
      { text: 'Rock clause, marked up.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0' },
      { text: 'Not a link', url: 'javascript:alert(1)' },
    ])
    expect(built.text.split('\n\n')).toEqual([
      'Greg,',
      'Checking on the number. Still good for today?',
      'The plans are in your portal: https://clicktooling.com/t/7Hq2#plans\nRock clause, marked up.pdf: https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0',
      'Robert\nProject manager · Click Construction\ncell (210) 555-0142',
    ])
    expect(built.html).toContain(
      'The plans are in your portal: <a href="https://clicktooling.com/t/7Hq2#plans" style="color:inherit">clicktooling.com/t/7Hq2#plans</a><br>Rock clause, marked up.pdf: <a href="https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0"',
    )
    expect(built.html).not.toContain('javascript:')
    expect(buildPlainMessagesEmail(words, []).text).not.toContain('portal')
  })
})
