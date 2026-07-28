import { describe, expect, it } from 'vitest'
import { buildHazmatNoticeEmailPreviewHtml } from './hazmatNoticeEmailPreview'
import { hazmatNoticeEmailSubject, hazmatNoticeEmailText } from './sendHazmatNoticeEmail'

const section = {
  jobNumber: '857',
  customerEmail: 'brace.tj@gmail.com',
  attachmentFilename: 'biohazard-remediation-fee-notice-857.pdf',
  noticeHtml: '<!DOCTYPE html><html><body><h1>Notice</h1></body></html>',
  invoiceReference: 'Stripe invoice for job 857',
}

describe('buildHazmatNoticeEmailPreviewHtml', () => {
  it('renders the exact subject and body the sender uses', () => {
    const html = buildHazmatNoticeEmailPreviewHtml([section])
    expect(html).toContain(hazmatNoticeEmailSubject('857'))
    expect(html).toContain(hazmatNoticeEmailText('857', 'Stripe invoice for job 857'))
    expect(html).toContain('brace.tj@gmail.com')
    expect(html).toContain('biohazard-remediation-fee-notice-857.pdf')
  })

  it('inlines the notice via a sandboxed iframe with escaped srcdoc', () => {
    const html = buildHazmatNoticeEmailPreviewHtml([section])
    expect(html).toContain('sandbox=""')
    expect(html).toContain('srcdoc="&lt;!DOCTYPE html&gt;')
    expect(html).not.toContain('srcdoc="<!DOCTYPE')
  })

  it('numbers emails when several incidents each get one', () => {
    const html = buildHazmatNoticeEmailPreviewHtml([section, { ...section, jobNumber: '858' }])
    expect(html).toContain('Email 1 of 2')
    expect(html).toContain('Email 2 of 2')
  })

  it('escapes angle brackets in interpolated values', () => {
    const html = buildHazmatNoticeEmailPreviewHtml([{ ...section, customerEmail: '<script>x</script>@x.com' }])
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
