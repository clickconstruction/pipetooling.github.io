import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lienFieldsHash } from './lienNoticeSignature'

const db = vi.hoisted(() => ({
  updates: [] as Array<{ patch: Record<string, unknown>; id: string }>,
  uploads: [] as Array<{ bucket: string; path: string; type: string }>,
  updateError: null as string | null,
  uploadError: null as string | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          db.updates.push({ patch, id })
          return db.updateError ? { data: null, error: { message: db.updateError } } : { data: null, error: null }
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _bytes: Blob, opts: { contentType: string }) => {
          db.uploads.push({ bucket, path, type: opts.contentType })
          return db.uploadError ? { error: { message: db.uploadError } } : { error: null }
        },
      }),
    },
  },
}))
vi.mock('../../utils/errorHandling', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (fn: () => Promise<{ error: { message: string } | null }>) => {
    const r = await fn()
    if (r.error) throw new Error(r.error.message)
    return r
  },
}))
vi.mock('../signatureInkTrim', () => ({ trimSignatureInk: async (d: string) => d }))

const PNG = `data:image/png;base64,${btoa('png-bytes')}`
const FIELDS = { notice: { claimAmount: '12480.00' }, gcEmail: 'ap@brightline.example', extra: undefined }

beforeEach(() => {
  db.updates = []
  db.uploads = []
  db.updateError = null
  db.uploadError = null
  vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob(['png']) }))
})

describe('signLienDeskItem (v2.5082)', () => {
  it('one press under his own sign-in: no file, the seven columns on the row with the draft’s hash, and the approval in the same write', async () => {
    const { signLienDeskItem } = await import('./lienDeskSignIo')
    const r = await signLienDeskItem({ itemId: 'it1', fields: FIELDS, signer: { userId: 'u-robert', printedName: ' Robert Douglas ' }, payload: { mode: 'type' }, onDevice: null, approve: true })
    expect(r.ok).toBe(true)
    expect(db.uploads).toEqual([])
    expect(db.updates).toHaveLength(1)
    const { patch, id } = db.updates[0]!
    expect(id).toBe('it1')
    expect(patch.status).toBe('approved')
    expect(patch.approval_mode).toBe('leader')
    expect(patch.signed_by).toBe('u-robert')
    expect(patch.signed_on_device_of).toBeNull()
    expect(patch.signer_printed_name).toBe('Robert Douglas')
    expect(patch.signer_signature_mode).toBe('type')
    expect(patch.signer_signature_storage_path).toBeNull()
    expect(patch.signed_fields_hash).toBe(lienFieldsHash({ notice: { claimAmount: '12480.00' }, gcEmail: 'ap@brightline.example' }))
    expect(typeof patch.signed_at).toBe('string')
  })

  it('sign only (a notice approved on his word) leaves the status alone; no name, no signature', async () => {
    const { signLienDeskItem } = await import('./lienDeskSignIo')
    const r = await signLienDeskItem({ itemId: 'it2', fields: FIELDS, signer: { userId: 'u-robert', printedName: 'Robert Douglas' }, payload: { mode: 'type' }, onDevice: null, approve: false })
    expect(r.ok).toBe(true)
    expect(db.updates[0]!.patch.status).toBeUndefined()
    expect(db.updates[0]!.patch.approval_mode).toBeUndefined()
    const none = await signLienDeskItem({ itemId: 'it2', fields: FIELDS, signer: { userId: 'u-robert', printedName: '  ' }, payload: { mode: 'type' }, onDevice: null, approve: true })
    expect(none.ok).toBe(false)
    expect(db.updates).toHaveLength(1)
  })

  it('drawn: the PNG goes under desk/<item>/ in the release bucket and the row names the path; a failed upload still records the signature', async () => {
    const { signLienDeskItem } = await import('./lienDeskSignIo')
    const r = await signLienDeskItem({ itemId: 'it3', fields: FIELDS, signer: { userId: 'u-robert', printedName: 'Robert Douglas' }, payload: { mode: 'draw', signaturePngBase64: PNG }, onDevice: null, approve: true })
    expect(r.ok).toBe(true)
    expect(db.uploads).toHaveLength(1)
    expect(db.uploads[0]!.bucket).toBe('lien-release-documents')
    expect(db.uploads[0]!.path).toMatch(/^desk\/it3\/[0-9a-f-]{36}\.png$/)
    expect(db.updates[0]!.patch.signer_signature_mode).toBe('draw')
    expect(db.updates[0]!.patch.signer_signature_storage_path).toBe(db.uploads[0]!.path)
    db.uploadError = 'bucket closed'
    const again = await signLienDeskItem({ itemId: 'it3', fields: FIELDS, signer: { userId: 'u-robert', printedName: 'Robert Douglas' }, payload: { mode: 'draw', signaturePngBase64: PNG }, onDevice: null, approve: true })
    expect(again.ok).toBe(true)
    expect(db.updates[1]!.patch.signer_signature_storage_path).toBeNull()
    expect(db.updates[1]!.patch.signer_signature_mode).toBe('draw')
  })

  it('at someone else’s screen only a drawing is taken, and the row names whose screen; a refused write saves nothing', async () => {
    const { signLienDeskItem } = await import('./lienDeskSignIo')
    const pressed = await signLienDeskItem({ itemId: 'it4', fields: FIELDS, signer: { userId: 'u-robert', printedName: 'Robert Douglas' }, payload: { mode: 'type' }, onDevice: { userId: 'u-taunya', name: 'Taunya' }, approve: true })
    expect(pressed.ok).toBe(false)
    expect(pressed.ok ? '' : pressed.message).toContain('Draw the signature')
    expect(db.updates).toHaveLength(0)
    const drawn = await signLienDeskItem({ itemId: 'it4', fields: FIELDS, signer: { userId: 'u-robert', printedName: 'Robert Douglas' }, payload: { mode: 'draw', signaturePngBase64: PNG }, onDevice: { userId: 'u-taunya', name: 'Taunya' }, approve: true })
    expect(drawn.ok).toBe(true)
    expect(db.updates[0]!.patch.signed_by).toBe('u-robert')
    expect(db.updates[0]!.patch.signed_on_device_of).toBe('u-taunya')
    db.updateError = 'only a master or dev signs a lien notice'
    const refused = await signLienDeskItem({ itemId: 'it5', fields: FIELDS, signer: { userId: 'u-office', printedName: 'Taunya' }, payload: { mode: 'type' }, onDevice: null, approve: true })
    expect(refused.ok).toBe(false)
    expect(refused.ok ? '' : refused.message).toContain('only a master or dev')
  })
})
