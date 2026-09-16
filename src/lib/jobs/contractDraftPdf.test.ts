import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('../supabase', () => ({ supabase: { functions: { invoke } } }))

import { base64ToBytes, fetchContractDraftPdf } from './contractDraftPdf'

describe('fetchContractDraftPdf (v2.3527)', () => {
  beforeEach(() => invoke.mockReset())

  it('asks for draft_pdf by contract id and decodes the bytes', async () => {
    invoke.mockResolvedValue({ data: { ok: true, filename: 'Agreement-J363-to-sign.pdf', pdf_base64: btoa('%PDF-1.7 x') }, error: null })
    const r = await fetchContractDraftPdf({ contractId: 'c-1' })
    expect(invoke).toHaveBeenCalledWith('share-job-contract', { body: { mode: 'draft_pdf', contract_id: 'c-1' } })
    expect(r.filename).toBe('Agreement-J363-to-sign.pdf')
    expect(new TextDecoder().decode(r.bytes)).toBe('%PDF-1.7 x')
  })

  it('renders from the pane\'s own fields for a job with no row, writing nothing', async () => {
    invoke.mockResolvedValue({ data: { ok: true, filename: 'Agreement-J804-to-sign.pdf', pdf_base64: btoa('%PDF') }, error: null })
    const draft = { fields: { scope_lines: ['Rough-in'], amount_cents: 120000 }, body_html: 'Terms', body_format: 'plain', template_name: 'Built-in service agreement terms', recipient_name: 'Auto Zone' }
    await fetchContractDraftPdf({ jobId: 'j-804', draft })
    expect(invoke).toHaveBeenCalledWith('share-job-contract', { body: { mode: 'draft_pdf', job_id: 'j-804', draft } })
  })

  it('names the real problem when the function has not been deployed yet', async () => {
    invoke.mockResolvedValue({ data: { error: 'Add at least one valid email.' }, error: null })
    await expect(fetchContractDraftPdf({ contractId: 'c-1' })).rejects.toThrow(/not live on the server yet/)
  })

  it('base64 round-trips bytes', () => {
    expect(Array.from(base64ToBytes(btoa('ab')))).toEqual([97, 98])
  })
})
