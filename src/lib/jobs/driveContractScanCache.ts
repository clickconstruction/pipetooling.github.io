/**
 * The Drive pass's scan, remembered (Contract sweep refresh — to-dos/contract-sweep-refresh).
 *
 * `drive-contract-scan` lists up to 20 000 files and looks up hundreds of parent folders: it takes
 * a minute or more. The sweep runs it by itself when it opens, so it must not run on EVERY open —
 * one scan is shared by everyone who asks while it is in flight, and its answer is kept for
 * fifteen minutes. A failed scan is not remembered, so the next open tries again.
 */
import { supabase } from '../supabase'
import type { DriveScanFile } from './driveContractMatch'

export const DRIVE_SCAN_TTL_MS = 15 * 60_000

export type DriveScanInvoke = () => Promise<{ ok: boolean; files: DriveScanFile[] }>

export function createDriveScanCache(invoke: DriveScanInvoke, now: () => number = Date.now) {
  let kept: { at: number; files: DriveScanFile[] } | null = null
  let inFlight: Promise<DriveScanFile[] | null> | null = null
  return {
    /** The files, or null when Drive could not be read. */
    get(): Promise<DriveScanFile[] | null> {
      if (kept && now() - kept.at < DRIVE_SCAN_TTL_MS) return Promise.resolve(kept.files)
      if (inFlight) return inFlight
      inFlight = invoke()
        .then((res) => {
          if (!res.ok) return null
          kept = { at: now(), files: res.files }
          return res.files
        })
        .catch(() => null)
        .finally(() => {
          inFlight = null
        })
      return inFlight
    },
    /** After a filing changes what is left to find — the next open scans again. */
    clear() {
      kept = null
    },
  }
}

/** The sweep's one shared scan. */
export const sweepDriveScanCache = createDriveScanCache(async () => {
  const { data, error } = await supabase.functions.invoke('drive-contract-scan', { body: {} })
  const res = (data ?? {}) as { ok?: boolean; files?: DriveScanFile[] }
  return { ok: !error && Boolean(res.ok), files: res.files ?? [] }
})
