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
}

type Ctx = {
  metrics: Readonly<Record<string, QuickfillSectionMetric>>
  setSectionMetric: (sectionId: string, partial: Partial<QuickfillSectionMetric> | null) => void
  getOutstandingCount: (sectionId: string) => number | null
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

  const value = useMemo(
    () => ({ metrics, setSectionMetric, getOutstandingCount }),
    [metrics, setSectionMetric, getOutstandingCount],
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

export function useQuickfillSectionMetric(sectionId: string): QuickfillSectionMetric {
  const { metrics } = useQuickfillSectionMetricsContext()
  return metrics[sectionId] ?? { count: null, loading: false, onOutstandingClick: undefined }
}

/** Registers backlog count for a Quickfill section; clears on unmount. No-ops when used outside a provider (e.g. Schedule Dispatch Day tab). */
export function useReportQuickfillSectionMetric(
  sectionId: string,
  count: number | null,
  loading: boolean,
  onOutstandingClick?: (() => void) | null,
): void {
  const ctx = useContext(QuickfillSectionMetricsContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setSectionMetric(sectionId, {
      count,
      loading,
      onOutstandingClick: onOutstandingClick ?? undefined,
    })
    return () => ctx.setSectionMetric(sectionId, null)
  }, [sectionId, count, loading, onOutstandingClick, ctx])
}
