import { describe, expect, it } from 'vitest'
import {
  buildMessagesEmail,
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
  greeting: 'Hello Greg,',
  body: 'Checking on the number. Still good for today?',
  signature: ['Robert · Project manager', 'cell (210) 555-0142', 'Email back, text, or call.'],
  footer: 'Click Construction. About Stone Oak Pharmacy.',
  ...more,
})

describe('the reply box’s email request, checked by messages-email', () => {
  it('reads the person, the address, the job and the words, trimmed', () => {
    expect(parseMessagesEmailBody(request({ subject: '  Stone Oak Pharmacy: Checking on the number  ' }))).toEqual({
      contactId: CONTACT,
      channelId: CHANNEL,
      tie: { jobId: JOB, column: 'project_id' },
      subject: 'Stone Oak Pharmacy: Checking on the number',
      greeting: 'Hello Greg,',
      body: 'Checking on the number. Still good for today?',
      signature: ['Robert · Project manager', 'cell (210) 555-0142', 'Email back, text, or call.'],
      footer: 'Click Construction. About Stone Oak Pharmacy.',
    })
  })

  it('takes no job, and an empty greeting and footer', () => {
    expect(parseMessagesEmailBody(request({ tie: null, greeting: '', footer: undefined }))).toMatchObject({ tie: null, greeting: '', footer: '' })
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
    expect(parseMessagesEmailBody(request({ signature: ['a', 'b', 'c', 'd', 'e'] }))).toBeNull()
    expect(parseMessagesEmailBody(request({ signature: ['Robert', ''] }))).toBeNull()
  })
})

describe('the letterhead it goes under', () => {
  it('is the plumbing company on a Pipeline job, Click Construction on any other or none', () => {
    expect(letterheadFor('jobs_ledger_id')).toBe('Click Plumbing and Electrical')
    expect(letterheadFor('project_id')).toBe('Click Construction')
    expect(letterheadFor('bid_id')).toBe('Click Construction')
    expect(letterheadFor(null)).toBe('Click Construction')
  })
})

describe('the email they read', () => {
  const words = request() as unknown as Parameters<typeof buildMessagesEmail>[0]

  it('carries the greeting, the body, the signature and the footer, each its own paragraph, and no closing of ours', () => {
    const built = buildMessagesEmail(words)
    expect(built.subject).toBe('Stone Oak Pharmacy: Checking on the number')
    expect(built.text).toBe(
      [
        'Hello Greg,',
        'Checking on the number. Still good for today?',
        'Robert · Project manager\ncell (210) 555-0142\nEmail back, text, or call.',
        'Click Construction. About Stone Oak Pharmacy.',
      ].join('\n\n'),
    )
    expect(built.html).toContain('Click Construction</div>')
    expect(built.html).toContain('Robert · Project manager<br>cell (210) 555-0142<br>Email back, text, or call.')
    expect(built.html).not.toContain('Thank you,')
  })

  it('escapes the office’s words and leaves out an empty greeting', () => {
    const built = buildMessagesEmail({ ...words, greeting: '', body: 'Bring <the> plans & the pad' }, 'Click Plumbing and Electrical')
    expect(built.html).toContain('Bring &lt;the&gt; plans &amp; the pad')
    expect(built.html).toContain('Click Plumbing and Electrical</div>')
    expect(built.text.startsWith('Bring <the> plans & the pad')).toBe(true)
  })

  it('puts the files that went as links after the body, a line each, the link a link (cut 7e)', () => {
    const built = buildMessagesEmail(words, undefined, [
      { text: 'The plans are in your portal', url: 'https://clicktooling.com/t/7Hq2#plans' },
      { text: 'Rock clause, marked up.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0' },
      { text: 'Not a link', url: 'javascript:alert(1)' },
    ])
    expect(built.text.split('\n\n')).toEqual([
      'Hello Greg,',
      'Checking on the number. Still good for today?',
      'The plans are in your portal: https://clicktooling.com/t/7Hq2#plans\nRock clause, marked up.pdf: https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0',
      'Robert · Project manager\ncell (210) 555-0142\nEmail back, text, or call.',
      'Click Construction. About Stone Oak Pharmacy.',
    ])
    expect(built.html).toContain(
      'The plans are in your portal: <a href="https://clicktooling.com/t/7Hq2#plans" style="color:inherit">clicktooling.com/t/7Hq2#plans</a><br>Rock clause, marked up.pdf: <a href="https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0"',
    )
    expect(built.html).not.toContain('javascript:')
    expect(built.html).not.toContain('[[messages-email links]]')
    expect(buildMessagesEmail(words, undefined, []).text).not.toContain('portal')
  })
})
