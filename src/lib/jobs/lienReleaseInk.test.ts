import { afterEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ files: {} as Record<string, Blob>, reads: [] as string[] }))
vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        download: async (path: string) => {
          store.reads.push(path)
          const f = store.files[path]
          return f ? { data: f, error: null } : { data: null, error: { message: 'not found' } }
        },
      }),
    },
  },
}))
const built = vi.hoisted(() => ({ calls: [] as Array<{ png: string | null | undefined }> }))
vi.mock('../jobsDocuments/lienWaiverRelease', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  return {
    ...real,
    buildLienWaiverPdfBlob: async (_f: unknown, _fields: unknown, sig: { pngDataUrl?: string | null } | null) => {
      built.calls.push({ png: sig?.pngDataUrl })
      return new Blob(['rebuilt'], { type: 'application/pdf' })
    },
  }
})

import { __resetLienReleaseInkCache, lienReleaseRowSignatureWithInk, lienReleaseSignedPdfBlob, loadLienReleaseInk } from './lienReleaseInk'

const PNG = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
// Job 650's waiver of Oct 1, 4:23 PM: drawn, both files stored.
const ROW = {
  status: 'signed',
  signed_at: '2026-10-01T21:23:28Z',
  signer_consented_at: '2026-10-01T21:23:28Z',
  signer_printed_name: 'Malachi Whites',
  signer_signature_mode: 'draw',
  signer_signature_storage_path: 'r1/ink.png',
  signed_pdf_path: 'r1/signed.pdf',
}
const FIELDS = { companyName: 'Click Plumbing and Electrical', checkFrom: '', amount: '17777.51', projectDescription: 'ATI Schertz', throughDate: '2026-09-10', signedDate: '2026-10-01', signerName: 'Malachi Whites', signerTitle: '' }

afterEach(() => {
  store.files = {}
  store.reads = []
  built.calls = []
  __resetLienReleaseInkCache()
})

describe('loadLienReleaseInk', () => {
  it('reads the stored drawing as a picture, once per file', async () => {
    store.files['r1/ink.png'] = PNG
    const a = await loadLienReleaseInk(ROW)
    const b = await loadLienReleaseInk(ROW)
    expect(a).toMatch(/^data:image\/png;base64,/)
    expect(b).toBe(a)
    expect(store.reads).toEqual(['r1/ink.png'])
  })
  it('nothing for a typed signature or a row with no stored drawing; a failed read is tried again next time', async () => {
    expect(await loadLienReleaseInk({ ...ROW, signer_signature_mode: 'type' })).toBeNull()
    expect(await loadLienReleaseInk({ ...ROW, signer_signature_storage_path: null })).toBeNull()
    expect(await loadLienReleaseInk(ROW)).toBeNull()
    store.files['r1/ink.png'] = PNG
    expect(await loadLienReleaseInk(ROW)).toMatch(/^data:image\/png/)
  })
})

describe('lienReleaseRowSignatureWithInk', () => {
  it('the rebuilt signature carries the drawing (it was always null before v2.4335)', async () => {
    store.files['r1/ink.png'] = PNG
    const sig = await lienReleaseRowSignatureWithInk(ROW, 'Robert')
    expect(sig).toMatchObject({ mode: 'draw', printedName: 'Malachi Whites' })
    expect(sig?.pngDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(sig?.auditLine).toContain('on Robert’s screen')
  })
})

describe('lienReleaseSignedPdfBlob', () => {
  it('hands back the stored signed PDF exactly as signed — the same file the GC gets', async () => {
    const stored = new Blob(['the signed bytes'], { type: 'application/pdf' })
    store.files['r1/signed.pdf'] = stored
    const out = await lienReleaseSignedPdfBlob(ROW, 'unconditional_progress', FIELDS)
    expect(await out.text()).toBe('the signed bytes')
    expect(built.calls).toHaveLength(0)
  })
  it('with no stored PDF it rebuilds the page with the stored drawing', async () => {
    store.files['r1/ink.png'] = PNG
    const out = await lienReleaseSignedPdfBlob({ ...ROW, signed_pdf_path: null }, 'unconditional_progress', FIELDS)
    expect(await out.text()).toBe('rebuilt')
    expect(built.calls[0]?.png).toMatch(/^data:image\/png;base64,/)
  })
})
