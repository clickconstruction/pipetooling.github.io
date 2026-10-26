import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type QuickfillSectionMetric = {
  count: number | null
  loading: boolean
  /** When set, section header can make "N open" open a detail (e.g. breakdown by day). */
  onOutstandingClick?: (() => void) | undefined
  /** The note the Mark writes when nobody typed one (v2.5825): a station that has no box says its day in words. */
  markNote?: string | null
  /**
   * The Next line (v2.5839, punch list #176, change 2): the first row to act on and its verb, drawn under the
   * station's question on every view. Null when the station has nothing to say (at zero, or a count with no
   * row-level next step).
   */
  nextLine?: string | null
}

type Ctx = {
  metrics: Readonly<Record<string, QuickfillSectionMetric>>
  setSectionMetric: (sectionId: string, partial: Partial<QuickfillSectionMetric> | null) => void
  getOutstandingCount: (sectionId: string) => number | null
  getMarkNote: (sectionId: string) => string | null
}

const QuickfillSectionMetricsContext = createContext<Ctx | null>(null)

export function QuickfillSectionMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<Record<string, QuickfillSectionMetric>>({})
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics

  const setSectionMetric = useCallback((sectionId: string, partial: Partial<QuickfillSectionMetric> | null) => {
    setMetrics((prev) => {
      if (partial === null) {
        const next = { ...prev }
        delete next[sectionId]
        return next
      }
      const cur = prev[sectionId] ?? { count: null, loading: false }
      return { ...prev, [sectionId]: { ...cur, ...partial } }
    })
  }, [])

  const getOutstandingCount = useCallback((sectionId: string) => {
    const m = metricsRef.current[sectionId]
    if (!m || m.loading) return null
    return m.count
  }, [])

  const getMarkNote = useCallback((sectionId: string) => {
    const m = metricsRef.current[sectionId]
    if (!m || m.loading) return null
    const t = m.markNote?.trim()
    return t ? t : null
  }, [])

  const value = useMemo(
    () => ({ metrics, setSectionMetric, getOutstandingCount, getMarkNote }),
    [metrics, setSectionMetric, getOutstandingCount, getMarkNote],
  )

  return (
    <QuickfillSectionMetricsContext.Provider value={value}>{children}</QuickfillSectionMetricsContext.Provider>
  )
}

export function useQuickfillSectionMetricsContext(): Ctx {
  const ctx = useContext(QuickfillSectionMetricsContext)
  if (!ctx) {
    throw new Error('QuickfillSectionMetricsProvider is required')
  }
  return ctx
}

/**
 * Every station's metric as it stands, for a station that reads its siblings (the Assistant Dailys, v2.5884). An
 * empty map outside a provider, so a body drawn alone still mounts.
 */
export function useQuickfillSectionMetricsSnapshot(): Readonly<Record<string, QuickfillSectionMetric>> {
  const ctx = useContext(QuickfillSectionMetricsContext)
  return ctx?.metrics ?? EMPTY_METRICS
}
const EMPTY_METRICS: Readonly<Record<string, QuickfillSectionMetric>> = Object.freeze({})

export function useQuickfillSectionMetric(sectionId: string): QuickfillSectionMetric {
  const { metrics } = useQuickfillSectionMetricsContext()
  return metrics[sectionId] ?? { count: null, loading: false, onOutstandingClick: undefined }
}

/**
 * Registers backlog count for a Quickfill section; clears on unmount. No-ops when used outside a provider (e.g. Schedule Dispatch Day tab).
 * `markNote` (v2.5825) is the note the Mark writes when nobody typed one: a station with no box, the Physical inbox deck,
 * says its day in words (*2 undecided · oldest 4 d · 1 task · 1 filed*). `nextLine` (v2.5839) is the first row to act on
 * and its verb, *Lean on TF Harper · $29,323 · 38 days*. They ride the same call so one cleanup clears all three.
 */
export function useReportQuickfillSectionMetric(
  sectionId: string,
  count: number | null,
  loading: boolean,
  onOutstandingClick?: (() => void) | null,
  markNote?: string | null,
  nextLine?: string | null,
): void {
  const ctx = useContext(QuickfillSectionMetricsContext)
  const setSectionMetric = ctx?.setSectionMetric
  useEffect(() => {
    if (!setSectionMetric) return
    setSectionMetric(sectionId, {
      count,
      loading,
      onOutstandingClick: onOutstandingClick ?? undefined,
      markNote: markNote ?? null,
      nextLine: nextLine ?? null,
    })
    return () => setSectionMetric(sectionId, null)
  }, [sectionId, count, loading, onOutstandingClick, markNote, nextLine, setSectionMetric])
}
