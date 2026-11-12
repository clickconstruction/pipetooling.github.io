/**
 * A file's copy to Google Drive in pieces (punch list #319 PR 2), as a loop over four doors so it can be tried against
 * a stand-in before it meets Drive. The caller hands the doors: start an upload and answer its address, ask an address
 * how far it has got, put one piece, and read one range of the file from the app's storage. The loop holds one piece
 * at a time, keeps the address and the offset through `save` after every step, and stops past the deadline with
 * `paused`, so the next run asks Drive where it stopped and goes on from there.
 */
import { drivePiece } from './firstLookDrive.ts'

export interface DrivePieceDoors {
  /** Starts an upload and answers the address every piece goes to. */
  start(): Promise<string>
  /** Where an address stands: whole (the file's id), part way (the offset), or null when Drive no longer knows it. */
  status(uri: string): Promise<{ id: string } | { offset: number } | null>
  /** One piece. Answers the file's id when it was the last, else how far Drive has got. */
  put(uri: string, bytes: Uint8Array, contentRange: string): Promise<{ id: string } | { offset: number }>
  /** The file's bytes from `start` to `end`, both counted. */
  read(start: number, end: number): Promise<Uint8Array>
  /** Keeps the address and how far it has got, so a later run picks up. */
  save(uri: string | null, offset: number | null): Promise<void>
}

export async function copyInPieces(total: number, resumeUri: string | null, doors: DrivePieceDoors, deadline: number, now: () => number = Date.now): Promise<{ id: string } | { paused: true }> {
  let uri = resumeUri
  let offset = 0
  if (uri) {
    const at = await doors.status(uri)
    if (at && 'id' in at) return at
    if (at) offset = at.offset
    else uri = null
  }
  if (!uri) {
    uri = await doors.start()
    offset = 0
    await doors.save(uri, 0)
  }
  for (;;) {
    const piece = drivePiece(offset, total)
    if (!piece) throw new Error('Drive took every piece and did not finish the file.')
    if (now() > deadline) return { paused: true }
    const bytes = await doors.read(piece.start, piece.end)
    if (bytes.length !== piece.end - piece.start + 1) throw new Error('Our copy of that file read short.')
    const put = await doors.put(uri, bytes, piece.contentRange)
    if ('id' in put) return put
    if (put.offset <= offset) throw new Error('Drive did not keep the piece.')
    offset = put.offset
    await doors.save(uri, offset)
  }
}
