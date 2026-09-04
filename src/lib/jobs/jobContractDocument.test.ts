import { describe, expect, it } from 'vitest'
import {
  buildJobContractDocumentHtml,
  buildJobContractPrefill,
  jobContractHeading,
  parseJobContractFields,
  paymentTermsSentence,
  isGoogleDocsUrl,
  isHttpUrl,
  shortDocumentLabel,
} from './jobContractDocument'
import { jobContractChips, jobContractSignatureAuditLine, jobContractSigningUrl, jobContractStatus } from './jobContractLifecycle'

const job = {
  job_name: 'Palmer — WH & repairs',
  job_address: '138 W Pat Blanco, Blanco TX 78606',
  customer_name: 'Michael Palmer',
  customer_email: 'mpalmer@example.com',
  customer_phone: null,
  revenue: 5000,
  fixtures: [
    { name: 'Water heater', count: 1, line_description: '40 gal electric, garage closet' },
    { name: 'Exterior vent', count: 2, line_description: null },
  ],
}

describe('prefill', () => {
  it('scopes from fixtures and amounts from revenue when there is no estimate', () => {
    const f = buildJobContractPrefill({ job })
    expect(f.scope_lines).toEqual(['Water heater — 40 gal electric, garage closet', '2 × Exterior vent'])
    expect(f.amount_cents).toBe(500000)
    expect(f.payment_terms_key).toBe('half_down')
  })

  it('prefers the accepted estimate lines and total', () => {
    const f = buildJobContractPrefill({
      job,
      estimateLines: [{ line_item: 'Custom Service Visit', description: 'Install new 40 gallon electric water heater.', quantity: 1 }],
      acceptedTotalCents: 375912,
    })
    expect(f.scope_lines).toEqual(['Custom Service Visit — Install new 40 gallon electric water heater.'])
    expect(f.amount_cents).toBe(375912)
  })

  it('falls back to the job name and a null amount', () => {
    const f = buildJobContractPrefill({ job: { ...job, fixtures: [], revenue: 0 } })
    expect(f.scope_lines).toEqual(['Palmer — WH & repairs'])
    expect(f.amount_cents).toBeNull()
  })

  it('headings read from the street line', () => {
    expect(jobContractHeading(job)).toBe('Service agreement for 138 W Pat Blanco')
    expect(jobContractHeading({ job_address: null, job_name: 'Coe WH' })).toBe('Service agreement — Coe WH')
  })
})

describe('fields and terms', () => {
  it('parses tolerant snapshots', () => {
    expect(parseJobContractFields(null).payment_terms_key).toBe('half_down')
    const f = parseJobContractFields({ scope_lines: ['a', 3, 'b'], amount_cents: 1234.6, payment_terms_key: 'progress', start_date: '2026-09-04' })
    expect(f.scope_lines).toEqual(['a', 'b'])
    expect(f.amount_cents).toBe(1235)
    expect(f.payment_terms_key).toBe('progress')
    expect(f.start_date).toBe('2026-09-04')
  })

  it('payment sentence fills in the deposit', () => {
    expect(paymentTermsSentence({ amount_cents: 500000, payment_terms_key: 'half_down', payment_terms_text: '' })).toBe(
      '50% down ($2,500.00) to begin work, balance due on completion.',
    )
    expect(paymentTermsSentence({ amount_cents: null, payment_terms_key: 'custom', payment_terms_text: 'Net 15' })).toBe('Net 15')
  })

  it('renders the document with scope, amount, terms and an unsigned line', () => {
    const html = buildJobContractDocumentHtml({
      heading: 'Service agreement for 138 W Pat Blanco',
      jobNumber: '922',
      jobAddress: job.job_address,
      customerName: 'Michael Palmer',
      recipientName: 'Michael Palmer',
      dateLabel: 'Sep 3, 2026',
      revision: 1,
      fields: { ...parseJobContractFields(null), scope_lines: ['Replace <heater>'], amount_cents: 500000 },
      termsHtml: '<p>Terms body</p>',
      templateName: 'Residential Service Agreement',
      issuer: { companyName: 'Click Plumbing', addressText: '12925 FM 20', phone: '512', email: '', tagline: '', licenseLine: 'RMP' },
    })
    expect(html).toContain('Replace &lt;heater&gt;')
    expect(html).toContain('$5,000.00')
    expect(html).toContain('50% down ($2,500.00)')
    expect(html).toContain('<p>Terms body</p>')
    expect(html).toContain('Not yet signed')
    expect(html).toContain('Residential Service Agreement')
  })
})

describe('lifecycle', () => {
  it('status, chips, url, audit', () => {
    expect(jobContractStatus({ status: 'sent', voided_at: null })).toBe('sent')
    expect(jobContractStatus({ status: 'sent', voided_at: '2026-09-03' })).toBe('voided')
    expect(jobContractChips({ status: 'sent', voided_at: null, signer_mode: null, send_count: 2, view_count: 3 })[0]).toEqual({ label: 'sent ×2 · opened 3×', tone: 'sent' })
    expect(jobContractChips({ status: 'signed', voided_at: null, signer_mode: 'paper', send_count: 0, view_count: 0 })[0]?.label).toBe('on file · paper')
    expect(jobContractSigningUrl('https://clicktooling.com/', 'ab c')).toBe('https://clicktooling.com/contract/sign?t=ab%20c')
    expect(
      jobContractSignatureAuditLine({ signed_at: '2026-09-03T00:14:00Z', signer_printed_name: 'Michael Palmer', signer_mode: 'draw', signer_consented_at: '2026-09-03T00:14:00Z' }),
    ).toMatch(/^Signed electronically by Michael Palmer \(drawn\) · Sep 2, 2026, 7:14 PM CT · consent recorded$/)
  })
})

describe('signed document links (v2.2744)', () => {
  it('recognises Google Docs and Drive links only', () => {
    expect(isGoogleDocsUrl('https://docs.google.com/document/d/1kX9abcdefghijQz4/edit?usp=sharing')).toBe(true)
    expect(isGoogleDocsUrl('https://drive.google.com/file/d/1AbC/view')).toBe(true)
    expect(isGoogleDocsUrl('https://www.dropbox.com/s/abc/contract.pdf')).toBe(false)
    expect(isGoogleDocsUrl('http://docs.google.com/x')).toBe(false)
    expect(isGoogleDocsUrl('not a url')).toBe(false)
    expect(isHttpUrl('https://www.dropbox.com/s/abc')).toBe(true)
  })
  it('shortens the label to the host, path and a trimmed id', () => {
    expect(shortDocumentLabel('https://docs.google.com/document/d/1kX9abcdefghijQz4/edit?usp=sharing')).toBe('docs.google.com/document/d/1kX9…Qz4')
    expect(shortDocumentLabel('https://drive.google.com/file/d/short/view')).toBe('drive.google.com/file/d/short')
    expect(shortDocumentLabel('')).toBe('')
  })
})

