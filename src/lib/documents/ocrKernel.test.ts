import { describe, expect, it } from 'vitest'
import { OCR_KIND_NOTE, OCR_MAX_BYTES, OCR_MAX_PAGES, OCR_MIMES, OCR_PER_PASS_MAX, OCR_PROCESSOR_SECRET, OCR_READ_MS, ocrDue, ocrEndpoint, ocrMimeOf, ocrReadAnswer, ocrRequestBody, ocrStateWords, ocrTakes } from '../../../supabase/functions/_shared/ocrKernel'

/** Our own OCR for scans (punch list #240, PR 3): which files go, where, what the request carries, how the answer and the refusal read, when a scan is tried again. */
describe('ocrKernel', () => {
  it('takes a PDF and the common pictures, never a HEIC or a drawing', () => {
    expect(ocrMimeOf({ name: 'Permit scan.pdf', mimeType: 'application/pdf' })).toBe('application/pdf')
    expect(ocrMimeOf({ name: 'scan.PDF', mimeType: 'application/octet-stream' })).toBe('application/pdf')
    expect(ocrMimeOf({ name: 'IMG_0412.jpg', mimeType: 'image/jpeg' })).toBe('image/jpeg')
    expect(ocrMimeOf({ name: 'page.png', mimeType: 'application/octet-stream' })).toBe('image/png')
    expect(ocrMimeOf({ name: 'fax.tif', mimeType: 'image/tiff' })).toBe('image/tiff')
    expect(ocrMimeOf({ name: 'IMG_0412.HEIC', mimeType: 'image/heic' })).toBeNull()
    expect(ocrMimeOf({ name: 'plans.dwg', mimeType: 'application/acad' })).toBeNull()
  })

  it('takes a kind it reads within the inline cap; a phone’s HEIC or a scan past the cap it never takes', () => {
    expect(ocrTakes({ name: 'Permit.pdf', mimeType: 'application/pdf', size: String(OCR_MAX_BYTES) })).toBe(true)
    expect(ocrTakes({ name: 'Permit.pdf', mimeType: 'application/pdf', size: String(OCR_MAX_BYTES + 1) })).toBe(false)
    expect(ocrTakes({ name: 'Permit.pdf', mimeType: 'application/pdf', size: null })).toBe(true)
    expect(ocrTakes({ name: 'IMG_0412.heic', mimeType: 'image/heic', size: '1000' })).toBe(false)
  })

  it('reads the processor name into its endpoint, and refuses any other shape', () => {
    expect(ocrEndpoint('projects/123456/locations/us/processors/abc123DEF')).toEqual({ ok: true, url: 'https://us-documentai.googleapis.com/v1/projects/123456/locations/us/processors/abc123DEF:process', location: 'us' })
    expect(ocrEndpoint(' projects/1/locations/eu/processors/x ')).toMatchObject({ ok: true, location: 'eu' })
    expect(ocrEndpoint('abc123DEF')).toMatchObject({ ok: false, error: expect.stringContaining(OCR_PROCESSOR_SECRET) })
    expect(ocrEndpoint('projects/1/locations/us/processors/x/evil').ok).toBe(false)
  })

  it('sends the bytes inline, no human review, the first pages alone, the text and page numbers back and no page images', () => {
    expect(ocrRequestBody('QUJD', 'application/pdf')).toEqual({ rawDocument: { content: 'QUJD', mimeType: 'application/pdf' }, skipHumanReview: true, fieldMask: 'text,pages.pageNumber', imagelessMode: true, processOptions: { fromStart: OCR_MAX_PAGES } })
    expect(OCR_MIMES).toContain('image/jpeg')
    expect(OCR_MIMES).not.toContain('image/heic')
    expect(OCR_PER_PASS_MAX).toBe(5)
    expect(OCR_READ_MS).toBe(20_000)
    expect(OCR_KIND_NOTE).toContain('HEIC')
    expect(ocrRequestBody('QUJD', 'image/png', 3)).toMatchObject({ processOptions: { fromStart: 3 } })
  })

  it('reads the text and the page count, and a refusal in the provider’s own words', () => {
    expect(ocrReadAnswer(200, { document: { text: 'PERMIT 2026-0412\nCity of Example', pages: [{}, {}] } })).toEqual({ ok: true, text: 'PERMIT 2026-0412\nCity of Example', pages: 2 })
    expect(ocrReadAnswer(200, { document: {} })).toEqual({ ok: true, text: '', pages: 0 })
    expect(ocrReadAnswer(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Document AI API has not been used in project 123456 before or it is disabled.' } })).toEqual({ ok: false, error: 'Document AI answered PERMISSION_DENIED: Document AI API has not been used in project 123456 before or it is disabled.' })
    expect(ocrReadAnswer(502, 'Bad Gateway')).toEqual({ ok: false, error: 'Document AI answered HTTP 502: Bad Gateway' })
    expect(ocrReadAnswer(200, {})).toEqual({ ok: false, error: 'Document AI answered with no document.' })
  })

  it('tries a scan never tried, or tried over a day ago, and leaves a fresh refusal alone', () => {
    const now = new Date('2026-11-02T12:00:00Z')
    expect(ocrDue(null, now)).toBe(true)
    expect(ocrDue('2026-11-01T11:00:00Z', now)).toBe(true)
    expect(ocrDue('2026-11-02T06:00:00Z', now)).toBe(false)
    expect(ocrDue('not a time', now)).toBe(true)
    expect(ocrStateWords(false)).toContain(OCR_PROCESSOR_SECRET)
    expect(ocrStateWords(true)).toContain('set up')
  })
})
