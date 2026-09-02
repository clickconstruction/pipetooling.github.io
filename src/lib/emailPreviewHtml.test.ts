import { describe, expect, it } from 'vitest'
import {
  buildEmailPreviewHtml,
  emailPreviewSampleVarsFor,
  EMAIL_PREVIEW_SAMPLE_VARS,
  isDigestPreviewType,
} from './emailPreviewHtml'

describe('emailPreviewSampleVarsFor', () => {
  it('gives digest types a {{default_subject}} sample; others none', () => {
    expect(emailPreviewSampleVarsFor('money_waiting').default_subject).toContain('Money waiting')
    expect(emailPreviewSampleVarsFor('lien_release_to_customer').default_subject).toBeUndefined()
  })

  it('every digest preview type resolves a default subject', () => {
    for (const t of [
      'paid_job',
      'ready_to_bill',
      'money_waiting',
      'billed_awaiting',
      'payment_forecast',
      'crew_day',
      'weekly_money',
      'weekly_movement',
      'schedule_day',
      'gc_statement_scheduled',
    ]) {
      expect(isDigestPreviewType(t), t).toBe(true)
      expect(emailPreviewSampleVarsFor(t).default_subject, t).toBeTruthy()
    }
    expect(isDigestPreviewType('invitation')).toBe(false)
  })

  it('sample vars cover the advertised editor variables', () => {
    for (const key of ['name', 'email', 'role', 'link', 'project_name', 'stage_name', 'workflow_link', 'amount', 'project', 'form_label', 'signer', 'job_number', 'invoice_reference']) {
      expect(EMAIL_PREVIEW_SAMPLE_VARS[key], key).toBeTruthy()
    }
  })
})

describe('buildEmailPreviewHtml', () => {
  it('renders variables into subject and body with sample data', () => {
    const html = buildEmailPreviewHtml(
      'lien_release_to_customer',
      'Release of lien — {{project}}',
      'Attached is the release ({{form_label}}, {{amount}}) for {{project}}.',
    )
    expect(html).toContain('Release of lien — Kent — 414 Candelaria, Helotes, TX')
    expect(html).toContain('(Conditional · progress, $1,250.00)')
  })

  it('escapes HTML from the wording and converts newlines to <br>', () => {
    const html = buildEmailPreviewHtml('invitation', 'Hi <b>{{name}}</b>', 'Line one\nLine two <script>')
    expect(html).toContain('Hi &lt;b&gt;Jordan Reyes&lt;/b&gt;')
    expect(html).toContain('Line one<br>Line two &lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('leaves unknown variables visible instead of dropping them', () => {
    const html = buildEmailPreviewHtml('invitation', 'Hello {{tpyo}}', 'Body')
    expect(html).toContain('Hello {{tpyo}}')
  })

  it('digest previews carry the labeled sample-data section; others do not', () => {
    const digest = buildEmailPreviewHtml('weekly_money', '{{default_subject}}', 'Your weekly money movement is below.')
    expect(digest).toContain('Weekly money movement — Sep 1 – Sep 5')
    expect(digest).toContain('SAMPLE DATA')
    const plain = buildEmailPreviewHtml('invitation', 'Welcome', 'Hi {{name}}')
    expect(plain).not.toContain('SAMPLE DATA')
  })

  it('attachment-bearing types show a sample attachment chip', () => {
    expect(buildEmailPreviewHtml('lien_release_to_customer', 's', 'b')).toContain('lien-release-conditional-progress-1003.pdf')
    expect(buildEmailPreviewHtml('hazmat_notice', 's', 'b')).toContain('biohazard-fee-notice-job-1003.pdf')
    expect(buildEmailPreviewHtml('invitation', 's', 'b')).not.toContain('.pdf')
  })

  it('is a complete standalone light document', () => {
    const html = buildEmailPreviewHtml('invitation', 'Welcome', 'Hi {{name}}')
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('Preview with sample data')
    expect(html).toContain('<strong>Subject:</strong> Welcome')
  })
})
