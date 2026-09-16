import { describe, expect, it } from 'vitest'
import { buildJobContractReminderEmail, buildJobContractSendEmail } from './jobContractEmail'

describe('jobContractEmail — one builder for the sender and the tab (v2.3510)', () => {
  it('the send email: greeting from the first name, the standard opening when no message, the amount line, the link twice, the sign-off', () => {
    const e = buildJobContractSendEmail({ recipientName: 'Sam Sample', message: '', jobAddress: '100 Sample St, Kyle, TX 78640', heading: 'Service agreement for 100 Sample St', jobNo: '1042', amountLine: 'Contract amount: $1,850.00', url: 'https://x.test/contract/sign?t=abc', senderName: 'Taunya' })
    expect(e.subject).toBe('Please sign: Service agreement for 100 Sample St — Job #1042')
    expect(e.text).toContain('Hi Sam,')
    expect(e.text).toContain('Here is your service agreement for 100 Sample St, Kyle, TX 78640.')
    expect(e.text).toContain('Contract amount: $1,850.00')
    expect(e.text).toContain('— Taunya')
    expect(e.html).toContain('Review &amp; sign')
    expect(e.html.split('https://x.test/contract/sign?t=abc').length).toBe(4) // the button, the plain link, and its text
    expect(e.html).toContain('<br>— Taunya')
  })
  it('the send email: a typed message replaces the opening and keeps its line breaks; no name means Hello', () => {
    const e = buildJobContractSendEmail({ recipientName: null, message: 'Thanks for choosing us.\nSee you Monday.', jobAddress: null, heading: 'H', jobNo: '1', amountLine: '', url: 'u', senderName: '' })
    expect(e.text.startsWith('Hello,\n\nThanks for choosing us.\nSee you Monday.')).toBe(true)
    expect(e.html).toContain('Thanks for choosing us.<br>See you Monday.')
    expect(e.html).not.toContain('Contract amount')
    expect(e.text).not.toContain('—')
  })
  it('the reminder: the amount line, and the closing changes on the last one', () => {
    const first = buildJobContractReminderEmail({ recipientName: 'Sam Sample', heading: 'H', jobNo: '1042', amountLabel: '$1,850.00', url: 'u', last: false })
    expect(first.subject).toBe('Reminder: please sign — H (Job #1042)')
    expect(first.text).toContain('Contract amount: $1,850.00')
    expect(first.text.trim().endsWith('Questions? Just reply to this email.')).toBe(true)
    const last = buildJobContractReminderEmail({ recipientName: null, heading: 'H', jobNo: '1042', amountLabel: null, url: 'u', last: true })
    expect(last.text).toContain('This is our last automatic reminder')
    expect(last.html).toContain('last automatic reminder')
    expect(last.html).not.toContain('Contract amount')
  })
})
