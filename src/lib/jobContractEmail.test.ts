import { describe, expect, it } from 'vitest'
import { buildJobContractPaperEmail, buildJobContractReminderEmail, buildJobContractSendEmail, buildJobContractSignedCopyEmail } from './jobContractEmail'

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
  it('the signed copy (v2.3617): the wording sign-job-contract sent inline, with and without the PDF', () => {
    const withPdf = buildJobContractSignedCopyEmail({ printedName: 'M. Palmer', heading: 'H', jobNo: '1042', amountLabel: '$1,850.00', url: 'https://x.test/contract/sign?t=abc', hasPdf: true })
    expect(withPdf.subject).toBe('Signed: H — Job #1042')
    expect(withPdf.text).toBe('Thank you, M. Palmer. Your agreement is signed.\n\nH\nJob #1042 · $1,850.00\n\nYour signed copy is attached as a PDF, and it stays at this link any time:\nhttps://x.test/contract/sign?t=abc\n')
    expect(withPdf.html).toBe('<p>Thank you, M. Palmer. Your agreement is signed.</p><p><strong>H</strong><br>Job #1042 · $1,850.00</p><p>Your signed copy is attached as a PDF, and it stays at this link any time: <a href="https://x.test/contract/sign?t=abc">https://x.test/contract/sign?t=abc</a></p>')
    const noPdf = buildJobContractSignedCopyEmail({ printedName: 'M. Palmer', heading: 'H', jobNo: '1042', amountLabel: null, url: 'u', hasPdf: false })
    expect(noPdf.text).toContain('Job #1042\n\nYour signed copy stays at this link any time:\nu\n')
  })

  it('the paper email (v2.3631): says a PDF is attached, how to send it back, and offers the link second', () => {
    const e = buildJobContractPaperEmail({ recipientName: 'Michael Palmer', message: '', jobAddress: '138 W Pat Blanco', heading: 'Service agreement for 138 W Pat Blanco', jobNo: '363', amountLine: 'Contract amount: $31,400.00', url: 'https://x.test/contract/sign?t=abc', senderName: 'Taunya' })
    expect(e.subject).toBe('Please sign: Service agreement for 138 W Pat Blanco — Job #363 (PDF attached)')
    expect(e.text).toContain('Hi Michael,')
    expect(e.text).toContain('Attached is your service agreement for 138 W Pat Blanco.')
    expect(e.text).toContain('sign and date the last page')
    expect(e.text.indexOf('sign and date')).toBeLessThan(e.text.indexOf('https://x.test/contract/sign?t=abc'))
    expect(e.html).not.toContain('Review &amp; sign</a>') // no big button — paper is the ask
    expect(e.text).toContain('— Taunya')
  })
})
