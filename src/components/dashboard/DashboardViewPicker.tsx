import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { cacheDashboardView, DASHBOARD_VIEW_CHANGED_EVENT } from '../../hooks/useDashboardView'
import { supabaseDashboardViewIo, type DashboardViewIo } from '../../lib/dashboard/dashboardViewIo'
import { DASHBOARD_VIEW_PICKER_WORDS, DASHBOARD_VIEW_WORDS, DASHBOARD_VIEWS, type DashboardView } from '../../lib/dashboard/shortDashboard'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Short or Full: the one control for a person's Dashboard view (`users.dashboard_view` through
 * `set_dashboard_view`). Settings mounts it for the viewer (`self`), the People desk for the person the desk is
 * open on, so the office can set a leader's view without his phone. Each choice is a press that says what the
 * page will hold; the one in force is marked. `self` also remembers the choice on this device and tells an open
 * Dashboard, so the page follows without a reload.
 */

const CHOICE: CSSProperties = { display: 'grid', gap: 2, flex: '1 1 12rem', minHeight: 44, padding: '0.55rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const CHOICE_ON: CSSProperties = { ...CHOICE, border: '2px solid #2563eb', background: 'var(--bg-blue-tint)' }

export function DashboardViewPicker({ userId, self = false, editable = true, changeKey = 0, io: ioIn }: { userId: string; self?: boolean; editable?: boolean; changeKey?: number; io?: DashboardViewIo }) {
  const io = useMemo(() => ioIn ?? supabaseDashboardViewIo(), [ioIn])
  const [view, setView] = useState<DashboardView | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void io.read(userId).then((v) => live && setView(v), () => live && setView('full'))
    return () => {
      live = false
    }
  }, [io, userId, changeKey])

  const pick = async (next: DashboardView) => {
    if (!editable || busy || next === view) return
    setBusy(true)
    setProblem(null)
    try {
      await io.set(userId, next)
      setView(next)
      if (self) {
        cacheDashboardView(userId, next)
        window.dispatchEvent(new Event(DASHBOARD_VIEW_CHANGED_EVENT))
      }
    } catch (e) {
      setProblem(formatErrorMessage(e, DASHBOARD_VIEW_PICKER_WORDS.notSaved))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-dashboard-view-picker style={{ display: 'grid', gap: 6 }}>
      <div role="group" aria-label={DASHBOARD_VIEW_PICKER_WORDS.label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DASHBOARD_VIEWS.map((v) => {
          const on = view === v
          const dead = !editable || busy || view === undefined
          return (
            <button key={v} type="button" data-dashboard-view={v} aria-pressed={on} disabled={dead} onClick={() => void pick(v)} style={{ ...(on ? CHOICE_ON : CHOICE), ...(dead && !on ? { opacity: 0.6, cursor: 'default' } : null) }}>
              <strong style={{ fontSize: '0.9375rem' }}>{DASHBOARD_VIEW_WORDS[v].label}</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{DASHBOARD_VIEW_WORDS[v].hint}</span>
            </button>
          )
        })}
      </div>
      {problem ? (
        <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--text-red-600)' }}>
          {problem}
        </span>
      ) : null}
    </div>
  )
}
