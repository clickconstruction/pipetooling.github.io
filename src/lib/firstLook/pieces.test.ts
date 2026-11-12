import { describe, expect, it } from 'vitest'
import { PIECE_BYTES, pieceMetadata, signedPiecesEndpoint, uploadInPieces, type PiecePlan, type PieceTransport } from './pieces'

const plan: PiecePlan = { endpoint: 'https://storage.example/upload/resumable', bucket: 'first-look-files', path: 'look/file.mov', mime: 'video/quicktime', headers: { apikey: 'anon', 'x-signature': 'token' } }

/** A storage that holds one upload, counts what it was asked, and drops the signal when told to. */
function fakeStorage(opts: { dropAfterPieces?: number; refuseCreate?: number; forget?: boolean; conflictOnce?: boolean; stuck?: boolean } = {}) {
  const state = { held: 0, length: 0, creates: 0, patches: [] as Array<{ from: number; size: number }>, heads: 0, dropsLeft: opts.dropAfterPieces != null ? 1 : 0, conflictLeft: opts.conflictOnce ? 1 : 0 }
  const transport: PieceTransport = {
    async create(_plan, length) {
      state.creates++
      if (opts.refuseCreate) return { ok: false, status: opts.refuseCreate }
      state.length = length
      state.held = 0
      return { ok: true, location: 'https://storage.example/upload/resumable/abc' }
    },
    async offset() {
      state.heads++
      return opts.forget ? null : state.held
    },
    async patch(_location, _headers, offset, piece, onSent) {
      if (state.dropsLeft > 0 && state.patches.length === opts.dropAfterPieces) {
        state.dropsLeft--
        throw new Error('signal')
      }
      if (state.conflictLeft > 0) {
        state.conflictLeft--
        state.held = PIECE_BYTES // storage is ahead of the phone
        return { ok: false, status: 409 }
      }
      if (offset !== state.held) return { ok: false, status: 409 }
      onSent?.(piece.size)
      state.patches.push({ from: offset, size: piece.size })
      if (!opts.stuck) state.held += piece.size
      return { ok: true, offset: state.held }
    },
  }
  return { state, transport }
}

const blobOf = (bytes: number): Blob => new Blob([new Uint8Array(bytes)])

describe('an upload in pieces', () => {
  it('sends six megabytes at a time, the last piece smaller', async () => {
    const { state, transport } = fakeStorage()
    const progress: number[] = []
    const out = await uploadInPieces(blobOf(PIECE_BYTES * 2 + 1000), plan, transport, { onProgress: (n) => progress.push(n) })
    expect(out).toEqual({ ok: true, location: 'https://storage.example/upload/resumable/abc', resumed: false })
    expect(state.patches).toEqual([
      { from: 0, size: PIECE_BYTES },
      { from: PIECE_BYTES, size: PIECE_BYTES },
      { from: PIECE_BYTES * 2, size: 1000 },
    ])
    expect(progress[progress.length - 1]).toBe(PIECE_BYTES * 2 + 1000)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  it('a lost signal keeps where the upload lives, and the next try picks up where it stopped', async () => {
    const { state, transport } = fakeStorage({ dropAfterPieces: 1 })
    const blob = blobOf(PIECE_BYTES * 3)
    let kept: string | null = null
    const first = await uploadInPieces(blob, plan, transport, { onLocation: (l) => (kept = l) })
    expect(first).toEqual({ ok: false, why: 'signal', location: 'https://storage.example/upload/resumable/abc' })
    expect(kept).toBe('https://storage.example/upload/resumable/abc')
    expect(state.held).toBe(PIECE_BYTES)

    const second = await uploadInPieces(blob, plan, transport, { location: kept })
    expect(second).toEqual({ ok: true, location: kept, resumed: true })
    expect(state.creates).toBe(1) // never made twice
    expect(state.patches.map((p) => p.from)).toEqual([0, PIECE_BYTES, PIECE_BYTES * 2]) // the first piece was not sent again
  })

  it('an upload storage no longer knows is made again from the start', async () => {
    const { state, transport } = fakeStorage({ forget: true })
    const out = await uploadInPieces(blobOf(1000), plan, transport, { location: 'https://storage.example/upload/resumable/old' })
    expect(out.ok).toBe(true)
    expect(out.ok && out.resumed).toBe(false)
    expect(state.creates).toBe(1)
    expect(state.patches).toEqual([{ from: 0, size: 1000 }])
  })

  it('storage that will not make the upload says so with its status', async () => {
    const { transport } = fakeStorage({ refuseCreate: 400 })
    expect(await uploadInPieces(blobOf(1000), plan, transport)).toEqual({ ok: false, why: 'refused', stage: 'create', status: 400, location: null })
  })

  it('storage that is ahead of the phone is asked where it is, and the upload goes on from there', async () => {
    const { state, transport } = fakeStorage({ conflictOnce: true })
    const out = await uploadInPieces(blobOf(PIECE_BYTES * 2), plan, transport)
    expect(out.ok).toBe(true)
    expect(state.heads).toBe(1)
    expect(state.patches).toEqual([{ from: PIECE_BYTES, size: PIECE_BYTES }])
  })

  it('storage that never moves on is given up on, not asked for ever', async () => {
    const { state, transport } = fakeStorage({ stuck: true })
    const out = await uploadInPieces(blobOf(PIECE_BYTES * 2), plan, transport)
    expect(out).toMatchObject({ ok: false, why: 'refused', stage: 'piece' })
    expect(state.patches).toHaveLength(1)
  })

  it('a file already whole in storage sends nothing more', async () => {
    const { state, transport } = fakeStorage()
    const blob = blobOf(5000)
    await uploadInPieces(blob, plan, transport)
    const again = await uploadInPieces(blob, plan, transport, { location: 'https://storage.example/upload/resumable/abc' })
    expect(again).toMatchObject({ ok: true, resumed: true })
    expect(state.patches).toHaveLength(1)
  })

  it('a link\'s key is taken at the signed address only, whatever the base address ends in', () => {
    expect(signedPiecesEndpoint('https://ref.supabase.co')).toBe('https://ref.supabase.co/storage/v1/upload/resumable/sign')
    expect(signedPiecesEndpoint('https://ref.supabase.co/')).toBe('https://ref.supabase.co/storage/v1/upload/resumable/sign')
  })

  it('the metadata names the bucket, the object and its type, each base64', () => {
    expect(pieceMetadata(plan)).toBe(`bucketName ${btoa('first-look-files')},objectName ${btoa('look/file.mov')},contentType ${btoa('video/quicktime')},cacheControl ${btoa('3600')}`)
  })
})
