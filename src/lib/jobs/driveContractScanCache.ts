/**
 * The Drive pass's scan, remembered (Contract sweep refresh — to-dos/contract-sweep-refresh).
 *
 * `drive-contract-scan` lists up to 20 000 files and looks up hundreds of parent folders: it takes
 * a minute or more. The sweep runs it by itself when it opens, so it must not run on EVERY open —
 * one scan is shared by everyone who asks while it is in flight, and its answer is kept for
 * fifteen minutes. A failed scan is not remembered, so the next open tries again.
 *
 * v2.3709: the function keeps the last scan for the whole office (`drive_contract_scans`) and
 * answers from it for an hour, so this cache is the tab's copy of that; `refresh()` asks the
 * function to scan again now, and `held()` says when the scan the tab holds was made.
 */
import { supabase } from '../supabase'
import type { DriveScanFile } from './driveContractMatch'

export const DRIVE_SCAN_TTL_MS = 15 * 60_000

export interface DriveScanAnswer {
  ok: boolean
  files: DriveScanFile[]
  /** When the scan was made — the function's stamp, which may be older than the call when it served a kept scan. */
  scannedAt: string | null
  /** The function answered from its kept scan rather than reading Drive. */
  cached: boolean
  jobFolders: number
  scanned: number
  /** Why Drive could not be read, in the function's words (a setup pointer, a Drive refusal). */
  error?: string
}

export type DriveScanInvoke = (opts: { force: boolean }) => Promise<DriveScanAnswer>

export interface DriveScanHeld {
  files: DriveScanFile[]
  scannedAt: string | null
  jobFolders: number
  scanned: number
}

export function createDriveScanCache(invoke: DriveScanInvoke, now: () => number = Date.now) {
  let kept: { at: number; held: DriveScanHeld } | null = null
  let inFlight: Promise<DriveScanFile[] | null> | null = null
  let lastError: string | null = null
  const run = (force: boolean): Promise<DriveScanFile[] | null> => {
    if (inFlight) return inFlight
    inFlight = invoke({ force })
      .then((res) => {
        if (!res.ok) {
          lastError = res.error || 'Could not read Drive.'
          return null
        }
        lastError = null
        kept = { at: now(), held: { files: res.files, scannedAt: res.scannedAt, jobFolders: res.jobFolders, scanned: res.scanned } }
        return res.files
      })
      .catch((e: unknown) => {
        lastError = e instanceof Error && e.message ? e.message : 'Could not read Drive.'
        return null
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }
  return {
    /** The files, or null when Drive could not be read. */
    get(): Promise<DriveScanFile[] | null> {
      if (kept && now() - kept.at < DRIVE_SCAN_TTL_MS) return Promise.resolve(kept.held.files)
      return run(false)
    },
    /** Scan Drive again now, whatever anyone holds — the office filed or moved paper since. */
    refresh(): Promise<DriveScanFile[] | null> {
      kept = null
      return run(true)
    },
    /** What the tab holds, with the scan's own stamp; null before the first answer. */
    held(): DriveScanHeld | null {
      return kept?.held ?? null
    },
    /** Why the last read failed, in the function's words; null after a good one. */
    lastError(): string | null {
      return lastError
    },
    /** After a filing changes what is left to find — the next open scans again. */
    clear() {
      kept = null
      lastError = null
    },
  }
}

/** The sweep's one shared scan. */
export const sweepDriveScanCache = createDriveScanCache(async ({ force }) => {
  const { data, error } = await supabase.functions.invoke('drive-contract-scan', { body: force ? { force: true } : {} })
  const res = (data ?? {}) as { ok?: boolean; files?: DriveScanFile[]; scanned_at?: string; cached?: boolean; job_folders?: number; scanned?: number; error?: string }
  return {
    ok: !error && Boolean(res.ok),
    error: res.error || error?.message || undefined,
    files: res.files ?? [],
    scannedAt: res.scanned_at ?? null,
    cached: Boolean(res.cached),
    jobFolders: res.job_folders ?? 0,
    scanned: res.scanned ?? 0,
  }
})
