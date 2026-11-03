/**
 * The shot-tile engine's pure part (punch list #244, the fold of v2.6453): the fields every shot tile carries whatever
 * its host adds (a report's checklist question, a job photo's words), how a send lost to the signal is told from a
 * refusal, and the time a shot reads until the camera's own is read. The machine is `hooks/useShotTiles.ts`.
 */

export type ShotTileStatus = 'shrinking' | 'sending' | 'sent' | 'kept' | 'failed'

/** A shot on a form, from the shutter to its press: what every host's tile has. */
export type ShotTileBase = {
  id: string
  status: ShotTileStatus
  /** An object URL of the shrunk shot (the original while it shrinks), for the thumbnail. */
  previewUrl: string
  /** The shot as the camera handed it over. */
  originalBytes: number
  /** After the shrink; 0 while it shrinks. */
  bytes: number
  width: number
  height: number
  longEdge: number
  shrunk: boolean
  /** The stage it shows, or null until picked (a one-stage job never asks). */
  fixtureId: string | null
  stageName: string | null
  /** Where it waits in the bucket once sent. */
  storagePath: string | null
  /** The camera's own time once read, else the moment the host's `pickedAt` gave. */
  takenAt: string
  /** Why it did not send, for the tile's Retry. */
  failWhy: string | null
}

/**
 * Whether a send failed for want of signal: the io's own error class by its name (a smoke that stubs the io throws a
 * plain error and must still fail the tile), with the network kind. Such a shot is kept on the phone for the press.
 */
export function sendLostSignal(err: unknown, errorName: string): boolean {
  return typeof err === 'object' && err != null && (err as { name?: unknown }).name === errorName && (err as { kind?: unknown }).kind === 'network'
}

/** A file's own time when it is a real moment already past, else now: the Job photos window's time for a picked file. */
export function fileTimeOrNow(file: Pick<File, 'lastModified'>, now: number = Date.now()): string {
  return new Date(file.lastModified > 0 && file.lastModified < now ? file.lastModified : now).toISOString()
}
