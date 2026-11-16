import { useCallback, useEffect, useMemo, useState } from 'react'
import { blankCountOf, NO_RESERVED, reservedOfJob, stickerMarksByBoxOf, stickersByBoxOf, type ReservedOfJob, type StickerMark } from '../lib/materials/stickerPlace'
import { fetchStickersOnBoxes } from '../lib/materials/stickerPlaceIo'
import { fetchStickerRuns } from '../lib/materials/stickerRunsIo'

export type JobStickers = {
  /** The stickers on each of the job's boxes, lowest first. Empty until read. */
  byBox: ReadonlyMap<string, number[]>
  /** The same stickers with the name printed on each (section 10, PR 9): what a row says beside a box's name. */
  marksByBox: ReadonlyMap<string, StickerMark[]>
  /** The job's stickers still on no box, across its runs. */
  blank: number
  /** The same stickers as the job's line says them (v2.7487): which names, who printed them and when. */
  reserved: ReservedOfJob
  loaded: boolean
  /** Reads again: after a sticker is placed here. */
  refresh: () => void
}

/**
 * A job's stickers for its screens (punch list #329, PR 3): the numbers beside each box's name and how many of the
 * job's stickers are not yet on a box. Two small reads under the viewer's own RLS, the stickers on the job's boxes and
 * the job's runs; a read that fails leaves the numbers off, since a box reads the same without them. Read once per
 * job and set of boxes, and again on `refresh`.
 */
export function useJobStickers(jobId: string | null, containerIds: ReadonlyArray<string>, reads: { onBoxes?: typeof fetchStickersOnBoxes; runs?: typeof fetchStickerRuns } = {}): JobStickers {
  const [state, setState] = useState<{ forJob: string | null; byBox: Map<string, number[]>; marksByBox: Map<string, StickerMark[]>; blank: number; reserved: ReservedOfJob; loaded: boolean }>({ forJob: null, byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: NO_RESERVED, loaded: false })
  const [tick, setTick] = useState(0)
  const idsKey = [...containerIds].sort().join('|')
  const onBoxes = reads.onBoxes ?? fetchStickersOnBoxes
  const runs = reads.runs ?? fetchStickerRuns

  useEffect(() => {
    if (!jobId) return
    let live = true
    const ids = idsKey ? idsKey.split('|') : []
    void (async () => {
      const [boxesRead, runsRead] = await Promise.allSettled([onBoxes(ids), runs(jobId)])
      if (!live) return
      setState((prev) => {
        const same = prev.forJob === jobId
        const byBox = boxesRead.status === 'fulfilled' ? stickersByBoxOf(boxesRead.value) : same ? prev.byBox : new Map<string, number[]>()
        const marksByBox = boxesRead.status === 'fulfilled' ? stickerMarksByBoxOf(boxesRead.value) : same ? prev.marksByBox : new Map<string, StickerMark[]>()
        const blank = runsRead.status === 'fulfilled' ? blankCountOf(runsRead.value) : same ? prev.blank : 0
        const reserved = runsRead.status === 'fulfilled' ? reservedOfJob(runsRead.value) : same ? prev.reserved : NO_RESERVED
        return { forJob: jobId, byBox, marksByBox, blank, reserved, loaded: true }
      })
    })()
    return () => {
      live = false
    }
  }, [jobId, idsKey, tick, onBoxes, runs])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return useMemo(() => (state.forJob === jobId ? { byBox: state.byBox, marksByBox: state.marksByBox, blank: state.blank, reserved: state.reserved, loaded: state.loaded, refresh } : { byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: NO_RESERVED, loaded: false, refresh }), [state, jobId, refresh])
}
