import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Emailing a signed lien release to the customer (the "ready to send" lane):
 * the gates, the PDF source (stored bytes, else a regeneration with the typed
 * signature), the size cap, the wording override, and the exact payload handed
 * to the edge function with its error mapping.
 */
const getSession = vi.fn(async () => ({ data: { session: { access_token: 'tok' } as { access_token: string } | null } }))
const download = vi.fn(async (_path: string): Promise<{ data: Blob | null; error: null }> => ({ data: new Blob(['pdf']), error: null }))
const invoke = vi.fn(async (_name: string, _opts: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: { success: true }, error: null }))
const bucketsUsed: string[] = []
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: () => getSession() },
    storage: {
      from: (bucket: string) => {
        bucketsUsed.push(bucket)
        return { download: (p: string) => download(p) }
      },
    },
    functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) },
  },
}))
const buildPdf = vi.fn(async (_form: string, _fields: unknown, _sig: unknown) => new Blob(['regenerated']))
vi.mock('./jobsDocuments/lienWaiverRelease', async (orig) => ({
  ...(await orig<typeof import('./jobsDocuments/lienWaiverRelease')>()),
  buildLienWaiverPdfBlob: (f: string, fields: unknown, sig: unknown) => buildPdf(f, fields, sig),
}))
vi.mock('./jobs/lienReleaseTracking', async (orig) => ({
  ...(await orig<typeof import('./jobs/lienReleaseTracking')>()),
  lienReleaseSnapshotToWaiverFields: () => ({ projectDescription: 'Oak Ridge <Phase 2>', signerName: 'Snapshot Signer' }),
}))
const wording = vi.fn(async (_type: string, _vars: Record<string, string>, fallback: { subject: string; body: string }) => ({ subject: fallback.subject, text: fallback.body, html: '<p>x</p>', overridden: false }))
vi.mock('./emailWording', () => ({ resolveEmailWording: (t: string, v: Record<string, string>, f: { subject: string; body: string }) => wording(t, v, f) }))
vi.mock('./readEdgeFunctionErrorBody', () => ({ readEdgeFunctionErrorBody: async (e: { detail?: string }) => e.detail ?? null }))
vi.mock('../utils/errorHandling', () => ({ formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback) }))

import { lienReleaseFormLabel, type JobLienReleaseRow } from './jobs/lienReleaseTracking'
import { buildLienReleaseEmailBodies, sendLienReleaseEmailToCustomer } from './sendLienReleaseEmail'

const release = (over: Record<string, unknown> = {}): JobLienReleaseRow =>
  ({
    id: 'r1',
    status: 'signed',
    voided_at: null,
    form_type: 'conditional_progress',
    signed_pdf_path: 'r1/signed.pdf',
    signer_printed_name: 'Pat Signer',
    signed_at: '2026-09-06T15:00:00Z',
    signer_consented_at: '2026-09-06T14:59:00Z',
    amount: 1250.5,
    ...over,
  }) as unknown as JobLienReleaseRow
const job = { id: 'j1', customer_email: ' pat@acme.test ', hcp_number: '1842', click_number: null }
const body = () => (invoke.mock.calls[0]![1] as { body: Record<string, unknown>; headers: Record<string, string> }).body

beforeEach(() => {
  getSession.mockClear()
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  download.mockClear()
  download.mockResolvedValue({ data: new Blob(['pdf']), error: null })
  invoke.mockClear()
  invoke.mockResolvedValue({ data: { success: true }, error: null })
  buildPdf.mockClear()
  wording.mockClear()
  wording.mockImplementation(async (_t, _v, fallback) => ({ subject: fallback.subject, text: fallback.body, html: '<p>x</p>', overridden: false }))
  bucketsUsed.length = 0
})

describe('buildLienReleaseEmailBodies', () => {
  it('is plain and formal, escapes the HTML, and says "your project" when the description is blank', () => {
    const b = buildLienReleaseEmailBodies({ formLabel: 'Conditional progress', projectDescription: 'Oak <2>', amountLabel: '$1,250.50' })
    expect(b.subject).toBe('Release of lien — Oak <2>')
    expect(b.text).toBe('Attached is the signed release of lien (Conditional progress, $1,250.50) for Oak <2>.\n\nThe attached PDF is the complete, signed document for your records.')
    expect(b.html).toBe('<p>Attached is the signed release of lien (<strong>Conditional progress</strong>, $1,250.50) for Oak &lt;2&gt;.</p><p>The attached PDF is the complete, signed document for your records.</p>')
    expect(buildLienReleaseEmailBodies({ formLabel: 'x', projectDescription: '', amountLabel: '$0.00' }).subject).toBe('Release of lien — your project')
  })
})

describe('sendLienReleaseEmailToCustomer', () => {
  it('refuses an unsigned or voided release, a job without a customer email, and a signed-out session', async () => {
    expect(await sendLienReleaseEmailToCustomer(release({ status: 'awaiting_signature' }), job)).toEqual({ ok: false, message: 'Only a signed release can be emailed.' })
    expect(await sendLienReleaseEmailToCustomer(release({ voided_at: '2026-09-07' }), job)).toEqual({ ok: false, message: 'Only a signed release can be emailed.' })
    expect(await sendLienReleaseEmailToCustomer(release(), { ...job, customer_email: '  ' })).toEqual({ ok: false, message: 'Job has no customer email; add it on Edit Job.' })
    getSession.mockResolvedValueOnce({ data: { session: null } })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'Not signed in' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('sends the stored signed PDF (exact bytes) with the built-in wording, the trimmed recipient and the bearer token', async () => {
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: true, sentTo: 'pat@acme.test' })
    expect(bucketsUsed).toEqual(['lien-release-documents'])
    expect(download).toHaveBeenCalledWith('r1/signed.pdf')
    expect(buildPdf).not.toHaveBeenCalled()
    expect(invoke.mock.calls[0]![0]).toBe('send-lien-release-email')
    expect((invoke.mock.calls[0]![1] as { headers: Record<string, string> }).headers).toEqual({ Authorization: 'Bearer tok' })
    expect(body()).toEqual({
      release_id: 'r1',
      job_id: 'j1',
      customer_email: 'pat@acme.test',
      subject: 'Release of lien — Oak Ridge <Phase 2>',
      email_text: `Attached is the signed release of lien (${lienReleaseFormLabel('conditional_progress')}, $1,250.50) for Oak Ridge <Phase 2>.\n\nThe attached PDF is the complete, signed document for your records.`,
      email_html: expect.stringContaining('Oak Ridge &lt;Phase 2&gt;'),
      pdf_base64: 'cGRm',
      pdf_filename: 'lien-release-conditional-progress-1842.pdf',
    })
    expect(wording).toHaveBeenCalledWith('lien_release_to_customer', { project: 'Oak Ridge <Phase 2>', form_label: lienReleaseFormLabel('conditional_progress'), amount: '$1,250.50', signer: 'Pat Signer' }, expect.objectContaining({ subject: 'Release of lien — Oak Ridge <Phase 2>' }))
  })

  it('regenerates the PDF with the typed signature when nothing is stored or the download fails; an unknown form type falls back to conditional progress', async () => {
    await sendLienReleaseEmailToCustomer(release({ signed_pdf_path: null, form_type: 'mystery' }), job)
    expect(download).not.toHaveBeenCalled()
    expect(buildPdf).toHaveBeenCalledTimes(1)
    const [form, , sig] = buildPdf.mock.calls[0]! as [string, unknown, { mode: string; printedName: string; auditLine: string }]
    expect(form).toBe('conditional_progress')
    expect(sig.mode).toBe('type')
    expect(sig.printedName).toBe('Pat Signer')
    expect(sig.auditLine.length).toBeGreaterThan(0)
    expect(body().pdf_base64).toBe(btoa('regenerated'))
    expect(body().pdf_filename).toBe('lien-release-conditional-progress-1842.pdf')

    invoke.mockClear()
    buildPdf.mockClear()
    download.mockRejectedValueOnce(new Error('bucket down'))
    await sendLienReleaseEmailToCustomer(release({ signer_printed_name: null }), job)
    expect(buildPdf.mock.calls[0]![2]).toBeNull() // no printed name: no signature block
    expect(body().pdf_base64).toBe(btoa('regenerated'))
  })

  it('uses the dev-saved wording when one is set, names the file by the Click number when there is no HCP, and "job" when neither', async () => {
    wording.mockResolvedValueOnce({ subject: 'Custom subject', text: 'Custom text', html: '<p>Custom</p>', overridden: true })
    await sendLienReleaseEmailToCustomer(release(), { ...job, hcp_number: ' ', click_number: 'C 9' })
    expect(body()).toMatchObject({ subject: 'Custom subject', email_text: 'Custom text', email_html: '<p>Custom</p>', pdf_filename: 'lien-release-conditional-progress-C-9.pdf' })
    invoke.mockClear()
    await sendLienReleaseEmailToCustomer(release(), { ...job, hcp_number: null, click_number: null })
    expect(body().pdf_filename).toBe('lien-release-conditional-progress-job.pdf')
  })

  it('refuses a PDF too large to email', async () => {
    download.mockResolvedValueOnce({ data: new Blob([new Uint8Array(4_200_000)]), error: null })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'The signed PDF is too large to email.' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('maps the edge function’s answers and any throw to messages', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { detail: 'Recipient rejected' } })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'Recipient rejected' })
    invoke.mockResolvedValueOnce({ data: null, error: new Error('network') })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'network' })
    invoke.mockResolvedValueOnce({ data: null, error: {} })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'Send release email failed' })
    invoke.mockResolvedValueOnce({ data: { error: 'Resend refused' }, error: null })
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'Resend refused' })
    invoke.mockRejectedValueOnce(new Error('boom'))
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'boom' })
    invoke.mockRejectedValueOnce('weird')
    expect(await sendLienReleaseEmailToCustomer(release(), job)).toEqual({ ok: false, message: 'Send release email failed' })
  })
})
