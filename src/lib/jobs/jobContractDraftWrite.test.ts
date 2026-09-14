import { describe, expect, it } from 'vitest'
import { buildJobContractDraftPayload } from './jobContractDraftWrite'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN, EMPTY_JOB_CONTRACT_FIELDS } from './jobContractDocument'

describe('buildJobContractDraftPayload', () => {
  it('carries the fields, the chosen terms and the recipient; blanks become null', () => {
    const p = buildJobContractDraftPayload({
      jobId: 'j1',
      fields: { ...EMPTY_JOB_CONTRACT_FIELDS, scope_lines: ['Water heater swap'], amount_cents: 240000 },
      template: { id: 't1', document_name: 'Residential service agreement', book_body_html: '<p>Terms</p>', book_body_format: 'html', book_version_date: '2026-09-01' },
      recipientName: ' May Lee ',
      recipientEmail: 'may@corewellpartners.com',
      recipientPhone: '',
    })
    expect(p).toMatchObject({
      job_id: 'j1',
      body_html: '<p>Terms</p>',
      body_format: 'html',
      template_document_id: 't1',
      template_name: 'Residential service agreement',
      template_version_date: '2026-09-01',
      recipient_name: 'May Lee',
      recipient_email: 'may@corewellpartners.com',
      recipient_phone: null,
    })
    expect((p.fields as { scope_lines: string[]; amount_cents: number }).scope_lines).toEqual(['Water heater swap'])
    expect((p.fields as { amount_cents: number }).amount_cents).toBe(240000)
  })

  it('with no template the built-in terms ride along as plain text', () => {
    const p = buildJobContractDraftPayload({ jobId: 'j1', fields: EMPTY_JOB_CONTRACT_FIELDS, template: null, recipientName: '', recipientEmail: '', recipientPhone: null })
    expect(p.body_html).toBe(DEFAULT_JOB_CONTRACT_TERMS_PLAIN)
    expect(p.body_format).toBe('plain')
    expect(p.template_document_id).toBeNull()
    expect(p.template_name).toBe('Built-in service agreement terms')
    expect(p.recipient_name).toBeNull()
  })
})
