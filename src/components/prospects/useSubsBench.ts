import { useEffect, useState } from 'react'
import { loadGcBoardRows, loadGcProjects } from '../../lib/gc/gcIo'
import { benchReadFromBoard, type BenchRead } from '../../lib/prospects/benchRead'
import type { ProspectKind } from '../../lib/prospects/prospectKinds'
import type { StripRead } from '../../lib/prospects/stripState'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The bench, for the Subs lane (v2.5560): read the way GC projects reads it, so the strip says what the bench's
 * own rule says. It reads when the lane is Subs or New Prospect's kind is, and again whenever either kind or the
 * user changes. Fail-soft: a role the GC tables refuse sees the lane without the strip (`benchTrades` null).
 * Moved out of `src/pages/Prospects.tsx` unchanged.
 */
export function useSubsBench(kind: ProspectKind, newKind: ProspectKind, userId: string | null) {
  // The strips' reads (v2.5585): undefined until the first answer, null when the read failed, the rows once read.
  const [benchTrades, setBenchTrades] = useState<StripRead<BenchRead['benchTrades']>>(undefined)
  // What GC mode needs (v2.5782, punch list #148): the bench with its open asks, and the trades we do ourselves.
  const [gcBench, setGcBench] = useState<BenchRead['gcBench']>({ benches: [], ownTrades: [] })
  const [benchCompanies, setBenchCompanies] = useState<BenchRead['benchCompanies']>([])
  const [benchQuoted, setBenchQuoted] = useState<Set<string>>(() => new Set())
  const [gcPlans, setGcPlans] = useState<BenchRead['gcPlans']>([])

  useEffect(() => {
    if (kind !== 'sub' && newKind !== 'sub') return
    if (!userId) return
    let live = true
    ;(async () => {
      try {
        const projects = await loadGcProjects()
        const rows = await loadGcBoardRows(projects, todayYmdInAppTz(), { money: false })
        if (!live) return
        const read = benchReadFromBoard(rows, projects, todayYmdInAppTz())
        setBenchTrades(read.benchTrades)
        setBenchQuoted(read.benchQuoted)
        setGcPlans(read.gcPlans)
        setGcBench(read.gcBench)
        setBenchCompanies(read.benchCompanies)
      } catch {
        if (live) setBenchTrades(null)
      }
    })()
    return () => {
      live = false
    }
  }, [kind, newKind, userId])

  return { benchTrades, gcBench, benchCompanies, benchQuoted, gcPlans }
}
