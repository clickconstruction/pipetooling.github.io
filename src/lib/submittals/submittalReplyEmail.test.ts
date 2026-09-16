import { describe, expect, it } from 'vitest'
import { buildSubmittalReplyEmail } from '../../../supabase/functions/_shared/submittalReplyEmail'

describe('buildSubmittalReplyEmail (stage 5a)', () => {
  it('names the bid and the tags, carries the answer and the question, and links the personal room', () => {
    const m = buildSubmittalReplyEmail({ companyName: 'Click Plumbing', bidLabel: 'B398 ZZ Test', tags: ['DWH-1'], askedBody: 'Is the 50 gal ok?', replyBody: 'Yes — same footprint, 2" taller.', personName: 'Dana Whitfield', link: 'https://clicktooling.com/submittal?t=abc', phone: '(512) 360-0599' })
    expect(m.subject).toBe('Click Plumbing answered on B398 ZZ Test — DWH-1')
    expect(m.text).toContain('Hi Dana Whitfield,')
    expect(m.text).toContain('Yes — same footprint, 2" taller.')
    expect(m.text).toContain('You asked: "Is the 50 gal ok?"')
    expect(m.text).toContain('https://clicktooling.com/submittal?t=abc')
    expect(m.html).toContain('Open the review')
    expect(m.html).not.toMatch(/\$\d/)
  })
  it('escapes html in what people typed', () => {
    const m = buildSubmittalReplyEmail({ companyName: 'C', bidLabel: 'B1', tags: [], askedBody: '<b>x</b>', replyBody: 'a & b', personName: 'P', link: 'https://x', phone: '' })
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(m.html).toContain('a &amp; b')
    expect(m.subject).toBe('C answered on B1')
  })
})
