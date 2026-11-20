/**
 * Before we start (punch list #382, PR 8): what the app reads for the bullets of ours on these stage lines. It asks
 * only for the kinds a live bullet uses, on the jobs that use them, and hands back the reader `stageFromRows` takes.
 * With no reads io (a test's in-memory list) it hands back none, and such a bullet says the app does not read it.
 */
import { useEffect, useMemo, useState } from 'react'
import { readerFor, readsWanted, type JobReads } from '../lib/startChecks/startCheckReaders'
import type { ReaderJob, StartReadersIo } from '../lib/startChecks/startCheckReadersIo'
import type { StageLine, StartBulletRow, UsReading } from '../lib/startChecks/startCheckRows'

const NO_READS: ReadonlyMap<string, JobReads> = new Map()

export function useStartCheckReads(args: { io: StartReadersIo | null; jobs: readonly ReaderJob[]; lines: readonly StageLine[]; bullets: readonly StartBulletRow[]; role: string | null; todayYmd: string }): ((row: StartBulletRow) => UsReading | null) | undefined {
  const { io, jobs, lines, bullets, role, todayYmd } = args
  const wanted = useMemo(() => readsWanted(bullets), [bullets])
  // The read runs again when a bullet starts or stops reading a kind, and when a job's bid, address or site changes.
  const key = useMemo(() => {
    const asked = new Set([...wanted.orderLog, ...wanted.trips, ...wanted.permits])
    if (!io || asked.size === 0) return ''
    return JSON.stringify([wanted, jobs.filter((j) => asked.has(j.id)).map((j) => [j.id, j.bidId, j.address, j.developmentId]), role, todayYmd])
  }, [io, wanted, jobs, role, todayYmd])
  const [read, setRead] = useState<{ key: string; reads: ReadonlyMap<string, JobReads> }>({ key: '', reads: NO_READS })

  useEffect(() => {
    if (!io || !key) return
    let live = true
    io.read({ jobs, ...wanted, role, todayYmd }).then(
      (reads) => live && setRead({ key, reads }),
      () => live && setRead({ key, reads: new Map([...new Set([...wanted.orderLog, ...wanted.trips, ...wanted.permits])].map((id) => [id, { failed: true }])) }),
    )
    return () => {
      live = false
    }
    // `key` holds everything the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [io, key])

  // Today goes to the reader too: a line whose day to land has gone by is open, however far ahead of day one it reads.
  return useMemo(() => (io ? readerFor(lines, read.key === key ? read.reads : NO_READS, todayYmd) : undefined), [io, lines, read, key, todayYmd])
}
