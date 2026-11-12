/**
 * Sending one kept file (punch list #319, the spike, v2.6981): ask the function for an upload address, send the bytes
 * to storage, tell the function it is in. A video goes in pieces and picks up after a drop; a photo, and a video
 * storage will not take in pieces, goes in one request. Every door is handed in, so the test drives a lost signal, a
 * refusal and a pick-up without a browser.
 *
 * Three outcomes and no others. **sent**: the function has it. **waiting**: the signal dropped or the file has not
 * landed yet; the file stays kept and the next try picks up. **refused**: it will never go (too big, not a photo or a
 * video, the link is closed), with the words to show; the file is dropped from the phone.
 */
import { PIECE_BYTES, uploadInPieces, type PiecePlan, type PieceTransport } from './pieces'
import type { KeptFile } from './kept'

export type SignAnswer =
  | { ok: true; fileId: string; bucket: string; path: string; token: string; signedUrl: string }
  /** The function said no, in its words. `gone` when the link itself no longer takes files. */
  | { ok: false; why: 'refused'; words: string; gone: boolean }
  /** The same file was already finished: nothing to send. */
  | { ok: false; why: 'finished' }
  | { ok: false; why: 'signal' }

export type DoneAnswer = { ok: true; photos: number; videos: number } | { ok: false; why: 'refused'; words: string } | { ok: false; why: 'not-there' } | { ok: false; why: 'signal' }

export type WholeAnswer = { ok: true } | { ok: false; why: 'signal' } | { ok: false; why: 'refused'; status: number }

export type SendDeps = {
  sign(file: { mime: string; bytes: number; name: string; fileId: string | null }): Promise<SignAnswer>
  done(input: { fileId: string; road: 'pieces' | 'whole'; resumed: number; tookMs: number; seconds: number | null }): Promise<DoneAnswer>
  putWhole(signedUrl: string, blob: Blob, mime: string, onSent: (bytes: number) => void): Promise<WholeAnswer>
  pieces: PieceTransport
  /** The storage's resumable endpoint and the public key each piece carries. */
  piecePlan(signed: { bucket: string; path: string; token: string }, mime: string): PiecePlan
  /** Remembers what the next try needs: the function's id, where the pieces live, how often it picked up. */
  remember(change: Partial<Pick<KeptFile, 'fileId' | 'location' | 'resumed' | 'pieceFails' | 'startedAt'>>): Promise<void>
  onProgress(sentBytes: number): void
  now(): number
}

export type SendOutcome =
  | { state: 'sent'; road: 'pieces' | 'whole'; resumed: number; photos: number; videos: number }
  | { state: 'waiting' }
  | { state: 'refused'; words: string; gone: boolean }

export const REFUSED_BY_STORAGE_WORDS = 'That file did not go through. Pick it again, or text it to us.'

/** After this many pieces turned away, a video stops trying pieces and goes in one request. */
export const PIECE_FAILS_BEFORE_WHOLE = 2

/**
 * A video past one piece goes in pieces; everything else in one request. A video whose pieces storage has turned
 * away twice goes in one request too, so a file can never try pieces for ever.
 */
export function goesInPieces(file: Pick<KeptFile, 'kind' | 'blob' | 'pieceFails'>): boolean {
  return file.kind === 'video' && file.blob.size > PIECE_BYTES && file.pieceFails < PIECE_FAILS_BEFORE_WHOLE
}

export async function sendKeptFile(file: KeptFile, deps: SendDeps): Promise<SendOutcome> {
  const startedAt = file.startedAt ?? deps.now()
  if (file.startedAt == null) await deps.remember({ startedAt })

  const signed = await deps.sign({ mime: file.mime, bytes: file.blob.size, name: file.name, fileId: file.fileId })
  if (!signed.ok) {
    if (signed.why === 'signal') return { state: 'waiting' }
    if (signed.why === 'refused') return { state: 'refused', words: signed.words, gone: signed.gone }
    // Already finished on an earlier try whose answer never reached the phone: only the last step is left.
    if (!file.fileId) return { state: 'refused', words: REFUSED_BY_STORAGE_WORDS, gone: false }
    return finish(file.fileId, file.location ? 'pieces' : 'whole', file.resumed, startedAt, file.seconds, deps)
  }
  if (signed.fileId !== file.fileId) await deps.remember({ fileId: signed.fileId })

  let road: 'pieces' | 'whole' = 'whole'
  let resumed = file.resumed
  if (goesInPieces(file)) {
    const out = await uploadInPieces(file.blob, deps.piecePlan(signed, file.mime), deps.pieces, {
      location: file.location,
      onLocation: (location) => void deps.remember({ location }),
      onProgress: deps.onProgress,
    })
    if (out.ok) {
      road = 'pieces'
      if (out.resumed) {
        resumed += 1
        await deps.remember({ resumed })
      }
    } else if (out.why === 'signal') {
      return { state: 'waiting' }
    } else if (out.stage === 'piece') {
      // A piece turned away after the upload began: start it again next time, from nothing, and count it.
      await deps.remember({ location: null, pieceFails: file.pieceFails + 1 })
      return { state: 'waiting' }
    }
    // Storage would not make an upload in pieces at all: fall through and send it whole.
  }
  if (road === 'whole') {
    const whole = await deps.putWhole(signed.signedUrl, file.blob, file.mime, deps.onProgress)
    if (!whole.ok) return whole.why === 'signal' ? { state: 'waiting' } : { state: 'refused', words: REFUSED_BY_STORAGE_WORDS, gone: false }
  }
  return finish(signed.fileId, road, resumed, startedAt, file.seconds, deps)
}

async function finish(fileId: string, road: 'pieces' | 'whole', resumed: number, startedAt: number, seconds: number | null, deps: SendDeps): Promise<SendOutcome> {
  const done = await deps.done({ fileId, road, resumed, tookMs: Math.max(0, deps.now() - startedAt), seconds })
  if (done.ok) return { state: 'sent', road, resumed, photos: done.photos, videos: done.videos }
  if (done.why === 'refused') return { state: 'refused', words: done.words, gone: false }
  return { state: 'waiting' }
}
