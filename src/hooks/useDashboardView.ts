import { useEffect, useMemo, useState } from 'react'
import { supabaseDashboardViewIo, type DashboardViewIo } from '../lib/dashboard/dashboardViewIo'
import { canHaveShortDashboard, dashboardViewStorageKey, parseDashboardView, type DashboardView } from '../lib/dashboard/shortDashboard'

/** Fired in this tab when the viewer's own view is saved, so an open Dashboard follows without a reload. */
export const DASHBOARD_VIEW_CHANGED_EVENT = 'pipetooling-dashboard-view-changed'

function readCached(userId: string | null | undefined): DashboardView {
  if (!userId) return 'full'
  try {
    return parseDashboardView(window.localStorage.getItem(dashboardViewStorageKey(userId)))
  } catch {
    return 'full'
  }
}

/** Remembers the view on this device: what the next page load draws before the row is read. */
export function cacheDashboardView(userId: string, view: DashboardView): void {
  try {
    window.localStorage.setItem(dashboardViewStorageKey(userId), view)
  } catch {
    // A private window: the row is still the truth, the page only draws Full for a moment first.
  }
}

/**
 * The viewer's Dashboard view: Short or Full. The row (`users.dashboard_view`) is the truth, since the office may
 * set it from the People desk on another device. The last value read is kept on this device, so a leader on Short
 * opens straight onto the short page. A role the short page is not drawn for always reads Full and asks nothing.
 */
export function useDashboardView(userId: string | null | undefined, role: string | null | undefined, ioIn?: DashboardViewIo): DashboardView {
  const io = useMemo(() => ioIn ?? supabaseDashboardViewIo(), [ioIn])
  const eligible = Boolean(userId) && canHaveShortDashboard(role)
  const [view, setView] = useState<DashboardView>(() => (eligible ? readCached(userId) : 'full'))

  useEffect(() => {
    if (!eligible || !userId) {
      setView('full')
      return
    }
    setView(readCached(userId))
    let live = true
    const read = () =>
      void io.read(userId).then(
        (v) => {
          if (!live) return
          cacheDashboardView(userId, v)
          setView(v)
        },
        () => {},
      )
    read()
    const onChanged = () => setView(readCached(userId))
    window.addEventListener(DASHBOARD_VIEW_CHANGED_EVENT, onChanged)
    return () => {
      live = false
      window.removeEventListener(DASHBOARD_VIEW_CHANGED_EVENT, onChanged)
    }
  }, [eligible, io, userId])

  return view
}
