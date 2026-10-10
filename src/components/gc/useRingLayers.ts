import { useEffect, useMemo, useRef, useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { boardLayers, ringReady, RING_LAYERS, type BoardLayer, type BoardLayers } from '../../lib/gc/boardLayers'
import { loadGcChangeOrdersOffice } from '../../lib/gc/changeOrderOfficeIo'
import { loadCrewJobs, type CrewJobLink } from '../../lib/gc/crewJobIo'
import { loadGcCrewOnSite, loadGcDailyLogs } from '../../lib/gc/dailyLogIo'
import { loadGcDraws } from '../../lib/gc/drawsIo'
import { loadGcChangeRequests } from '../../lib/gc/gcIo'
import { loadGcPunch } from '../../lib/gc/punchIo'
import { ringStages } from '../../lib/gc/ringStages'
import { loadSchedule } from '../../lib/gc/scheduleIo'
import { loadGcSubmittals } from '../../lib/gc/submittalsIo'
import type { GcStage, GcState } from '../../lib/gc/types'

/** What the board's rings read, for the board and for How the stage is going: one state, and which stages may draw. */
export interface RingRead {
  /** The board with every layer read so far laid over it (`boardLayers`). */
  state: GcState
  /** The stages whose ring this reader may see (`ringStages`). */
  shown: ReadonlySet<GcStage>
  /** Of those, the stages whose every layer was read (`ringReady`): their rings draw. */
  ready: ReadonlySet<GcStage>
  /** A layer whose read failed: its stages' rings stay empty and say so. */
  failed: boolean
}

/**
 * GC mode, the real build, the Board's B2b-vi-c: the ring's reads, driven by `ringStages(role)` (call L of
 * to-dos/gc-mode/mockups/board-b2b-vi.md on branch spike/gc-mode). After the board paints, it reads the layers the stages
 * the reader may see count, all at once: the schedules of the jobs buying out and being built, and for those being built
 * their daily logs with our crew's clock-ins, the change orders' office half, the draws, the submittals, the trades' asks
 * for a change, the punch lists and our crew's percent. Each layer is set only once its read succeeds, so a stage waits for
 * every layer it counts and never reads a missing one as nothing.
 */
export function useRingLayers(board: GcState | null, role: UserRole | null | undefined, crewLinks: readonly CrewJobLink[], today: string): RingRead | null {
  const shown = useMemo(() => ringStages(role), [role])
  const [layers, setLayers] = useState<BoardLayers>({})
  const [failed, setFailed] = useState(false)
  const latest = useRef(board)
  latest.current = board
  // Read again when the jobs or their stages change, not when a layer the page lays over the board changes.
  const jobs = board ? board.projects.map((p) => `${p.id}:${p.stage}:${p.startedOn ?? ''}`).join('|') : ''
  const links = crewLinks.map((l) => `${l.packageId}:${l.jobId}`).join('|')
  useEffect(() => {
    const at = latest.current
    if (!at) return
    let live = true
    setLayers({})
    setFailed(false)
    const want = new Set<BoardLayer>([...shown].flatMap((stage) => [...RING_LAYERS[stage]]))
    const scheduled = at.projects.filter((p) => (p.stage === 'buyout' || p.stage === 'building') && shown.has(p.stage))
    const building = at.projects.filter((p) => p.stage === 'building')
    const ids = building.map((p) => p.id)
    const linked = new Set(crewLinks.map((l) => l.packageId))
    const read = <K extends BoardLayer>(layer: K, load: () => Promise<NonNullable<BoardLayers[K]>>) => {
      if (!want.has(layer)) return
      load()
        .then((value) => {
          if (live) setLayers((was) => ({ ...was, [layer]: value }))
        })
        .catch(() => {
          if (live) setFailed(true)
        })
    }
    read('schedules', async () => new Map(await Promise.all(scheduled.map(async (p) => [p.id, (await loadSchedule(at, p.id))?.project.schedule ?? null] as const))))
    read('logs', () => (ids.length ? loadGcDailyLogs(ids) : Promise.resolve([])))
    read('clockIns', async () =>
      (await Promise.all(building.filter((p) => p.startedOn && p.packages.some((k) => linked.has(k.id))).map((p) => loadGcCrewOnSite(p.id, p.startedOn!, today)))).flat(),
    )
    read('changeOrders', () => (ids.length ? loadGcChangeOrdersOffice(ids) : Promise.resolve([])))
    read('draws', () => loadGcDraws(building.flatMap((p) => p.packages.map((k) => k.id))))
    read('submittals', () => (ids.length ? loadGcSubmittals(ids) : Promise.resolve({ submittals: [], holds: [], rounds: [] })))
    read('changeRequests', () => (ids.length ? loadGcChangeRequests(ids) : Promise.resolve([])))
    read('punch', () => (ids.length ? loadGcPunch(ids) : Promise.resolve([])))
    read('crewPercents', () => loadCrewJobs(crewLinks.filter((l) => building.some((p) => p.packages.some((k) => k.id === l.packageId)))))
    return () => {
      live = false
    }
    // `jobs` and `links` stand for the board's jobs and the crew links; the board itself is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, links, shown, today])
  const state = useMemo(() => (board ? boardLayers(board, layers) : null), [board, layers])
  return useMemo(() => (state ? { state, shown, ready: ringReady(shown, layers), failed } : null), [state, shown, layers, failed])
}
