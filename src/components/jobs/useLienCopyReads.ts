import { useCallback, useEffect, useRef, useState } from 'react'
import { loadLienSavedCopy } from '../../lib/jobs/lienStampedCopyIo'
import type { LienCopyRead } from '../../lib/jobs/lienStampedCopy'

/** One filed lien whose saved copy is to be read: the filing, its job, and the scan's file in Drive. */
export type LienCopyAsk = { filingId: string; jobId: string; fileId: string }

/** How many saved copies are read at once: a batch of twelve liens must not open twelve reads on the function together. */
const READS_AT_ONCE = 3

/**
 * The saved copies of the liens a print window shows (v2.7916), read once each as the window opens: what each one is
 * and whether the print can carry it (`LienCopyRead`), and its bytes for the print. A filing whose saved copy changes
 * while the window is open is read again. A read that fails is a hold with its reason and never throws.
 */
export function useLienCopyReads(asks: ReadonlyArray<LienCopyAsk>, load: typeof loadLienSavedCopy = loadLienSavedCopy): { reads: Record<string, LienCopyRead>; bytesOf: (filingId: string) => Uint8Array | null } {
  const [reads, setReads] = useState<Record<string, LienCopyRead>>({})
  // The file each filing's read is of, the bytes it brought, and the reads waiting their turn.
  const fileOf = useRef<Record<string, string>>({})
  const bytes = useRef<Map<string, Uint8Array>>(new Map())
  const waiting = useRef<LienCopyAsk[]>([])
  const running = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const pump = useCallback(() => {
    while (running.current < READS_AT_ONCE && waiting.current.length > 0) {
      const ask = waiting.current.shift()!
      running.current += 1
      void load(ask.jobId, ask.fileId)
        .then((loaded) => {
          // A read of a file the filing no longer names is dropped.
          if (!alive.current || fileOf.current[ask.filingId] !== ask.fileId) return
          if (loaded.bytes) bytes.current.set(ask.filingId, loaded.bytes)
          else bytes.current.delete(ask.filingId)
          setReads((cur) => ({ ...cur, [ask.filingId]: loaded.read }))
        })
        .finally(() => {
          running.current -= 1
          if (alive.current) pump()
        })
    }
  }, [load])

  const key = asks.map((a) => `${a.filingId}:${a.fileId}`).join('|')
  useEffect(() => {
    const fresh = asks.filter((a) => fileOf.current[a.filingId] !== a.fileId)
    if (fresh.length === 0) return
    for (const a of fresh) {
      fileOf.current[a.filingId] = a.fileId
      bytes.current.delete(a.filingId)
    }
    setReads((cur) => ({ ...cur, ...Object.fromEntries(fresh.map((a) => [a.filingId, { state: 'reading' } as LienCopyRead])) }))
    waiting.current = [...waiting.current.filter((w) => !fresh.some((a) => a.filingId === w.filingId)), ...fresh]
    pump()
    // The asks are read by their key: the list is made again on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pump])

  const bytesOf = useCallback((filingId: string) => bytes.current.get(filingId) ?? null, [])
  return { reads, bytesOf }
}
