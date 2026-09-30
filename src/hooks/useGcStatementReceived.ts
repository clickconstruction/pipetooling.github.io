import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGcChecksInputs } from '../lib/jobs/gcChecksAppliedIo'
import { gcStatementReceived, type GcStatementReceived } from '../lib/jobsDocuments/gcStatementEmail'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * The statement's "Payments we have received" (v2.4260), read once per GC as
 * GC Review needs it: for every GC in `gcIds` (the opened rows, the GC whose
 * Draft Message is open) the checks are fetched the moment the id appears and
 * kept for the modal's life. `receivedFor` is the snapshot a click reads
 * (null while loading or after a failed read — then the statement prints no
 * block); `receivedWhenReady` is what a send awaits, so a statement sent a
 * moment after the dialog opened still carries the block.
 */
export function useGcStatementReceived(gcIds: readonly string[]): {
  receivedFor: (gcId: string | null | undefined) => GcStatementReceived | null
  receivedWhenReady: (gcId: string | null | undefined) => Promise<GcStatementReceived | null>
} {
  const [ready, setReady] = useState<Record<string, GcStatementReceived | null>>({})
  const promises = useRef(new Map<string, Promise<GcStatementReceived | null>>())

  const start = useCallback((gcId: string): Promise<GcStatementReceived | null> => {
    const held = promises.current.get(gcId)
    if (held) return held
    const p = fetchGcChecksInputs(gcId)
      .then((inputs) => gcStatementReceived(inputs, gcId, todayYmdInAppTz()))
      .catch(() => null)
    promises.current.set(gcId, p)
    void p.then((r) => setReady((prev) => (gcId in prev ? prev : { ...prev, [gcId]: r })))
    return p
  }, [])

  useEffect(() => {
    for (const id of gcIds) if (id) void start(id)
  }, [gcIds, start])

  return {
    receivedFor: (gcId) => (gcId ? ready[gcId] ?? null : null),
    receivedWhenReady: (gcId) => (gcId ? start(gcId) : Promise.resolve(null)),
  }
}
