import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchUserDashboardGoals,
  shouldOpenGateAfterFirstClockIn,
  shouldOpenGateOnAppLoad,
  toLocalDateString,
  upsertDailyGoalsAck,
  type DashboardGoalRow,
} from '../lib/dailyGoalsGate'

type DailyGoalsGateContextValue = {
  gateOpen: boolean
  goals: DashboardGoalRow[]
  activeLocalDate: string | null
  loading: boolean
  /** Call after successful first clock-in of the day (both insert paths). */
  notifyFirstClockInOfDay: (workDate: string, forUserId?: string) => Promise<void>
  /** Complete checklist for activeLocalDate and close gate. */
  completeGate: () => Promise<void>
}

const DailyGoalsGateContext = createContext<DailyGoalsGateContextValue | null>(null)

export function DailyGoalsGateProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth()
  const [gateOpen, setGateOpen] = useState(false)
  const [goals, setGoals] = useState<DashboardGoalRow[]>([])
  const [activeLocalDate, setActiveLocalDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const openGateForDate = useCallback(async (userId: string, localDate: string) => {
    const rows = await fetchUserDashboardGoals(userId)
    if (rows.length === 0) {
      setGateOpen(false)
      setGoals([])
      setActiveLocalDate(null)
      return
    }
    setGoals(rows)
    setActiveLocalDate(localDate)
    setGateOpen(true)
  }, [])

  const notifyFirstClockInOfDay = useCallback(
    async (workDate: string, forUserId?: string) => {
      const uid = forUserId ?? authUser?.id
      if (!uid) return
      try {
        const show = await shouldOpenGateAfterFirstClockIn(uid, workDate)
        if (show) await openGateForDate(uid, workDate)
      } catch (e) {
        console.warn('[DailyGoalsGate] notifyFirstClockInOfDay', e)
      }
    },
    [authUser?.id, openGateForDate],
  )

  const completeGate = useCallback(async () => {
    if (!authUser?.id || !activeLocalDate) return
    await upsertDailyGoalsAck(authUser.id, activeLocalDate)
    setGateOpen(false)
    setGoals([])
    setActiveLocalDate(null)
  }, [authUser?.id, activeLocalDate])

  useEffect(() => {
    if (!authUser?.id) {
      setGateOpen(false)
      setGoals([])
      setActiveLocalDate(null)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const today = toLocalDateString(new Date())
        const show = await shouldOpenGateOnAppLoad(authUser.id, today)
        if (cancelled) return
        if (show) await openGateForDate(authUser.id, today)
      } catch (e) {
        console.warn('[DailyGoalsGate] load', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, openGateForDate])

  const value = useMemo(
    () => ({
      gateOpen,
      goals,
      activeLocalDate,
      loading,
      notifyFirstClockInOfDay,
      completeGate,
    }),
    [gateOpen, goals, activeLocalDate, loading, notifyFirstClockInOfDay, completeGate],
  )

  return <DailyGoalsGateContext.Provider value={value}>{children}</DailyGoalsGateContext.Provider>
}

export function useDailyGoalsGate(): DailyGoalsGateContextValue {
  const ctx = useContext(DailyGoalsGateContext)
  if (!ctx) {
    throw new Error('useDailyGoalsGate must be used within DailyGoalsGateProvider')
  }
  return ctx
}
