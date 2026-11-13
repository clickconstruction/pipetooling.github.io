/**
 * The door to a painted map (punch list #345): any screen may ask for a map to open or for a new
 * one to be started, and the one host in the Layout answers. A list of listeners and nothing
 * else, so a line under an address can open the window whatever window it happens to sit in, with
 * no provider to be above it.
 */
import type { PaintedPoint } from './paintedLine'

/** Where a new map will hang, and what the start sheet calls it. */
export type PaintedMapHome = {
  jobId?: string | null
  developmentId?: string | null
  /** The job in words. */
  label?: string | null
  /** The development in words, for a job that is in one: the map can be for the whole site. */
  developmentLabel?: string | null
  /**
   * The job's or the site's address. A map with nothing on it yet opens there, and the window is what looks the
   * address up, only when it needs to: a line under an address must cost nothing to draw.
   */
  address?: string | null
  /** The same thing for a caller that already knows the point. */
  center?: PaintedPoint | null
}

export type PaintedMapAsk =
  | { kind: 'open'; mapId: string; address?: string | null }
  | { kind: 'start'; home: PaintedMapHome }

type AskListener = (ask: PaintedMapAsk) => void
type ChangeListener = () => void

const askListeners = new Set<AskListener>()
const changeListeners = new Set<ChangeListener>()

/** The host listens here. The function it gets back stops the listening. */
export function onPaintedMapAsk(listener: AskListener): () => void {
  askListeners.add(listener)
  return () => {
    askListeners.delete(listener)
  }
}

/** Open a saved map. `false` when no host is listening, so a caller can say so instead of doing nothing. */
export function openPaintedMap(mapId: string, address?: string | null): boolean {
  if (askListeners.size === 0) return false
  for (const l of askListeners) l({ kind: 'open', mapId, address: address ?? null })
  return true
}

/** Start a new map for a home. `false` when no host is listening. */
export function startPaintedMap(home: PaintedMapHome): boolean {
  if (askListeners.size === 0) return false
  for (const l of askListeners) l({ kind: 'start', home })
  return true
}

/** The lines under an address listen here, and read again when a map was made, changed or removed. */
export function onPaintedMapsChanged(listener: ChangeListener): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

/** Something about the painted maps changed. */
export function paintedMapsChanged(): void {
  for (const l of changeListeners) l()
}
