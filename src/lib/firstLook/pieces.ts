/**
 * An upload in pieces (punch list #319, the spike, v2.6981): a video goes from the phone to storage a few megabytes at
 * a time, and picks up where it stopped after a lost signal. This is the resumable upload protocol (tus 1.0.0) cut to
 * what one file needs: make the upload, ask how far it got, send the next piece. Storage takes pieces of exactly six
 * megabytes, the last one smaller, and the link's one-file key rides each request as `x-signature`.
 *
 * The transport is handed in, so the test drives the rules against a storage that drops the signal; the browser's own
 * transport is `browserPieceTransport` in `showUsIo.ts`.
 */

/** Storage takes pieces of exactly this size, the last one smaller. */
export const PIECE_BYTES = 6 * 1024 * 1024

export type PiecePlan = {
  /** The storage's resumable endpoint. */
  endpoint: string
  bucket: string
  path: string
  mime: string
  /** The link's one-file key, and the project's public key. */
  headers: Record<string, string>
}

export type PieceTransport = {
  /** Makes the upload. Answers where it lives, or the status that refused it. Throws on a lost signal. */
  create(plan: PiecePlan, length: number): Promise<{ ok: true; location: string } | { ok: false; status: number }>
  /** How many bytes storage holds for this upload, or null when it no longer knows it. Throws on a lost signal. */
  offset(location: string, headers: Record<string, string>): Promise<number | null>
  /** Sends one piece from `offset`. Answers the new offset. Throws on a lost signal. */
  patch(location: string, headers: Record<string, string>, offset: number, piece: Blob, onSent?: (bytes: number) => void): Promise<{ ok: true; offset: number } | { ok: false; status: number }>
}

export type PiecesOutcome =
  /** Every byte is in. `location` is where it was sent. */
  | { ok: true; location: string; resumed: boolean }
  /** The signal dropped. `location` is kept so the next try picks up; null when the upload was never made. */
  | { ok: false; why: 'signal'; location: string | null }
  /** Storage refused. `stage` says whether the upload was never made or a piece was turned away. */
  | { ok: false; why: 'refused'; stage: 'create' | 'piece'; status: number; location: string | null }

const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** The protocol's metadata header: each value base64, as storage reads the bucket, the object and its type. */
export function pieceMetadata(plan: Pick<PiecePlan, 'bucket' | 'path' | 'mime'>): string {
  return [`bucketName ${b64(plan.bucket)}`, `objectName ${b64(plan.path)}`, `contentType ${b64(plan.mime)}`, `cacheControl ${b64('3600')}`].join(',')
}

/**
 * Sends a file in pieces. With a `location` from an earlier try it first asks how far that one got and goes on from
 * there; an upload storage no longer knows is made again from the start. `onProgress` hears the bytes storage holds
 * plus what the piece in flight has sent.
 */
export async function uploadInPieces(
  blob: Blob,
  plan: PiecePlan,
  transport: PieceTransport,
  opts: { location?: string | null; onLocation?: (location: string) => void; onProgress?: (sentBytes: number) => void } = {},
): Promise<PiecesOutcome> {
  let location = opts.location ?? null
  let offset = 0
  let resumed = false
  try {
    if (location) {
      const held = await transport.offset(location, plan.headers)
      if (held == null) location = null
      else {
        offset = Math.min(held, blob.size)
        resumed = true
      }
    }
    if (!location) {
      const made = await transport.create(plan, blob.size)
      if (!made.ok) return { ok: false, why: 'refused', stage: 'create', status: made.status, location: null }
      location = made.location
      offset = 0
      resumed = false
      opts.onLocation?.(location)
    }
    opts.onProgress?.(offset)
    let conflicts = 0
    while (offset < blob.size) {
      const from = offset
      const piece = blob.slice(from, Math.min(from + PIECE_BYTES, blob.size))
      const sent = await transport.patch(location, plan.headers, from, piece, (n) => opts.onProgress?.(from + n))
      if (sent.ok) {
        // Storage that answers no further than before would spin here for ever.
        if (sent.offset <= from) return { ok: false, why: 'refused', stage: 'piece', status: 0, location }
        offset = Math.min(sent.offset, blob.size)
        opts.onProgress?.(offset)
        continue
      }
      // 409: storage holds a different offset than we sent from. Ask it, and go on from there, a few times at most.
      if (sent.status === 409 && conflicts < 3) {
        conflicts++
        const held = await transport.offset(location, plan.headers)
        if (held != null) {
          offset = Math.min(held, blob.size)
          continue
        }
      }
      return { ok: false, why: 'refused', stage: 'piece', status: sent.status, location }
    }
    return { ok: true, location, resumed }
  } catch {
    return { ok: false, why: 'signal', location }
  }
}
