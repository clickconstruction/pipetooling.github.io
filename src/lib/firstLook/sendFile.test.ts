import { describe, expect, it } from 'vitest'
import { PIECE_BYTES, type PieceTransport } from './pieces'
import type { KeptFile } from './kept'
import { REFUSED_BY_STORAGE_WORDS, goesInPieces, sendKeptFile, type DoneAnswer, type SendDeps, type SignAnswer, type WholeAnswer } from './sendFile'

const kept = (kind: 'photo' | 'video', bytes: number, more: Partial<KeptFile> = {}): KeptFile => ({
  id: 'k1',
  code: 'k7m2p9xq4d',
  kind,
  name: kind === 'photo' ? 'sink.jpg' : 'drip.mov',
  mime: kind === 'photo' ? 'image/jpeg' : 'video/quicktime',
  blob: new Blob([new Uint8Array(bytes)]),
  keptAt: 1,
  seconds: kind === 'video' ? 24 : null,
  fileId: null,
  location: null,
  resumed: 0,
  pieceFails: 0,
  startedAt: null,
  ...more,
})

const signedOk: SignAnswer = { ok: true, fileId: 'f1', bucket: 'first-look-files', path: 'look/f1.mov', token: 'tok', signedUrl: 'https://storage.example/sign/f1?token=tok' }

function rig(opts: { sign?: SignAnswer[]; done?: DoneAnswer[]; whole?: WholeAnswer[]; dropAtPiece?: number; refuseCreate?: boolean; refusePiece?: boolean } = {}) {
  const log: string[] = []
  const remembered: Array<Record<string, unknown>> = []
  const signs = [...(opts.sign ?? [signedOk])]
  const dones = [...(opts.done ?? [{ ok: true, photos: 1, videos: 1 } as DoneAnswer])]
  const wholes = [...(opts.whole ?? [{ ok: true } as WholeAnswer])]
  let clock = 1000
  let held = 0
  let pieces = 0
  let dropped = false
  const transport: PieceTransport = {
    async create() {
      log.push('create')
      if (opts.refuseCreate) return { ok: false, status: 400 }
      held = 0
      return { ok: true, location: 'loc' }
    },
    async offset() {
      log.push('offset')
      return held
    },
    async patch(_l, _h, offset, piece) {
      if (opts.refusePiece) return { ok: false, status: 413 }
      if (opts.dropAtPiece === pieces && !dropped) {
        dropped = true
        throw new Error('signal')
      }
      pieces++
      log.push(`piece@${offset}`)
      held = offset + piece.size
      return { ok: true, offset: held }
    },
  }
  const doneInputs: Array<Parameters<SendDeps['done']>[0]> = []
  const deps: SendDeps = {
    async sign(file) {
      log.push(file.fileId ? `sign:${file.fileId}` : 'sign')
      return signs.shift() ?? signedOk
    },
    async done(input) {
      log.push('done')
      doneInputs.push(input)
      return dones.shift() ?? { ok: true, photos: 1, videos: 1 }
    },
    async putWhole(_url, blob, _mime, onSent) {
      log.push('whole')
      onSent(blob.size)
      return wholes.shift() ?? { ok: true }
    },
    pieces: transport,
    piecePlan: (signed, mime) => ({ endpoint: 'e', bucket: signed.bucket, path: signed.path, mime, headers: { 'x-signature': signed.token } }),
    async remember(change) {
      remembered.push(change)
    },
    onProgress() {},
    now: () => (clock += 500),
  }
  return { deps, log, remembered, doneInputs }
}

describe('sending one kept file', () => {
  it('a photo goes in one request', async () => {
    const { deps, log, doneInputs } = rig({ done: [{ ok: true, photos: 1, videos: 0 }] })
    const out = await sendKeptFile(kept('photo', 700_000), deps)
    expect(out).toEqual({ state: 'sent', road: 'whole', resumed: 0, photos: 1, videos: 0 })
    expect(log).toEqual(['sign', 'whole', 'done'])
    expect(doneInputs[0]).toMatchObject({ fileId: 'f1', road: 'whole', resumed: 0, seconds: null })
    expect(doneInputs[0]?.tookMs).toBeGreaterThan(0)
  })

  it('a video past one piece goes in pieces, and a short one in one request', async () => {
    expect(goesInPieces(kept('video', PIECE_BYTES + 1))).toBe(true)
    expect(goesInPieces(kept('video', PIECE_BYTES + 1, { pieceFails: 2 }))).toBe(false)
    expect(goesInPieces(kept('video', PIECE_BYTES))).toBe(false)
    expect(goesInPieces(kept('photo', PIECE_BYTES * 2))).toBe(false)
    const { deps, log, doneInputs, remembered } = rig()
    const out = await sendKeptFile(kept('video', PIECE_BYTES * 2 + 5), deps)
    expect(out).toMatchObject({ state: 'sent', road: 'pieces', resumed: 0 })
    expect(log).toEqual(['sign', 'create', `piece@0`, `piece@${PIECE_BYTES}`, `piece@${PIECE_BYTES * 2}`, 'done'])
    expect(doneInputs[0]).toMatchObject({ road: 'pieces', seconds: 24 })
    expect(remembered).toContainEqual({ fileId: 'f1' })
    expect(remembered).toContainEqual({ location: 'loc' })
  })

  it('a lost signal mid-video waits, and the next try picks up and counts it', async () => {
    const first = rig({ dropAtPiece: 1 })
    const file = kept('video', PIECE_BYTES * 3)
    expect(await sendKeptFile(file, first.deps)).toEqual({ state: 'waiting' })
    expect(first.log).toEqual(['sign', 'create', 'piece@0'])
    // The page kept what the first try remembered.
    const later = { ...file, fileId: 'f1', location: 'loc', startedAt: 1500 }
    const second = rig({ sign: [{ ...signedOk }] })
    // The second rig's storage starts empty, so hand it what the first one held.
    await second.deps.pieces.patch('loc', {}, 0, new Blob([new Uint8Array(PIECE_BYTES)]))
    second.log.length = 0
    const out = await sendKeptFile(later, second.deps)
    expect(out).toMatchObject({ state: 'sent', road: 'pieces', resumed: 1 })
    expect(second.log).toEqual(['sign:f1', 'offset', `piece@${PIECE_BYTES}`, `piece@${PIECE_BYTES * 2}`, 'done'])
    expect(second.doneInputs[0]?.resumed).toBe(1)
    expect(second.remembered).toContainEqual({ resumed: 1 })
  })

  it('a video storage will not take in pieces goes whole', async () => {
    const { deps, log } = rig({ refuseCreate: true })
    const out = await sendKeptFile(kept('video', PIECE_BYTES * 2), deps)
    expect(out).toMatchObject({ state: 'sent', road: 'whole' })
    expect(log).toEqual(['sign', 'create', 'whole', 'done'])
  })

  it('a piece turned away starts the upload again next time, from nothing, and is counted', async () => {
    const { deps, remembered } = rig({ refusePiece: true })
    expect(await sendKeptFile(kept('video', PIECE_BYTES * 2), deps)).toEqual({ state: 'waiting' })
    expect(remembered).toContainEqual({ location: null, pieceFails: 1 })
  })

  it('a video whose pieces were turned away twice goes in one request, so it never tries pieces for ever', async () => {
    const { deps, log } = rig({ refusePiece: true })
    const out = await sendKeptFile(kept('video', PIECE_BYTES * 2, { pieceFails: 2 }), deps)
    expect(out).toMatchObject({ state: 'sent', road: 'whole' })
    expect(log).toEqual(['sign', 'whole', 'done'])
  })

  it('no signal at any door waits and keeps the file', async () => {
    expect(await sendKeptFile(kept('photo', 10), rig({ sign: [{ ok: false, why: 'signal' }] }).deps)).toEqual({ state: 'waiting' })
    expect(await sendKeptFile(kept('photo', 10), rig({ whole: [{ ok: false, why: 'signal' }] }).deps)).toEqual({ state: 'waiting' })
    expect(await sendKeptFile(kept('photo', 10), rig({ done: [{ ok: false, why: 'signal' }] }).deps)).toEqual({ state: 'waiting' })
    expect(await sendKeptFile(kept('photo', 10), rig({ done: [{ ok: false, why: 'not-there' }] }).deps)).toEqual({ state: 'waiting' })
  })

  it('a refusal says why, and says when the link itself is gone', async () => {
    expect(await sendKeptFile(kept('photo', 10), rig({ sign: [{ ok: false, why: 'refused', words: 'This link takes 20 photos, and it has them.', gone: false }] }).deps)).toEqual({ state: 'refused', words: 'This link takes 20 photos, and it has them.', gone: false })
    expect(await sendKeptFile(kept('photo', 10), rig({ sign: [{ ok: false, why: 'refused', words: 'closed', gone: true }] }).deps)).toMatchObject({ state: 'refused', gone: true })
    expect(await sendKeptFile(kept('photo', 10), rig({ whole: [{ ok: false, why: 'refused', status: 413 }] }).deps)).toEqual({ state: 'refused', words: REFUSED_BY_STORAGE_WORDS, gone: false })
    expect(await sendKeptFile(kept('photo', 10), rig({ done: [{ ok: false, why: 'refused', words: 'That file is not a photo or a video we can open. It was not kept.' }] }).deps)).toMatchObject({ state: 'refused', gone: false })
  })

  it('a file the function already has only needs the last step', async () => {
    const { deps, log } = rig({ sign: [{ ok: false, why: 'finished' }] })
    const out = await sendKeptFile(kept('photo', 10, { fileId: 'f1', startedAt: 900 }), deps)
    expect(out).toMatchObject({ state: 'sent' })
    expect(log).toEqual(['sign:f1', 'done'])
  })

  it('the first try stamps when it began, and a later try keeps that stamp', async () => {
    const a = rig()
    await sendKeptFile(kept('photo', 10), a.deps)
    expect(a.remembered[0]).toHaveProperty('startedAt')
    const b = rig()
    await sendKeptFile(kept('photo', 10, { startedAt: 5 }), b.deps)
    expect(b.remembered.some((r) => 'startedAt' in r)).toBe(false)
  })
})
