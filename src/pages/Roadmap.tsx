import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFarmModeEnabled } from '../hooks/useFarmModeEnabled'
import { useRoleGate } from '../hooks/useRoleGate'
import { canOpenRoadmap } from '../lib/roadmapVisibility'
import { FARM_MODE_HOME } from '../lib/farmModeToggle'
import { canSeeTaskCosts } from '../lib/checklistCostEstimate'
import { ChecklistTechTreeTab } from '../components/checklist/ChecklistTechTreeTab'
import { ChecklistGoalsSection } from '../components/checklist/ChecklistGoalsSection'

/**
 * Roadmap (`/roadmap`, journey-map Tier-2 #41): the owner's planner as its own
 * page. Until v2.NNNN it was a fifth tab on the Checklist page, rendered for
 * the dev only, while the roadmap's other surfaces (the GOALS strip and the
 * Where-this-fits sheet) sat on the Review tab for every office role — two
 * products on one page. Now:
 *
 *   - `/checklist` (Today / History / Review / Manage) is the daily list;
 *   - `/roadmap` is the planner: GOALS (per-roadmap progress + stage ledger)
 *     on top, the roadmap picker + Members / Map / Plan / Timeline below;
 *   - the door is `canOpenRoadmap` — dev, master, assistant-like, primary —
 *     i.e. exactly the roles RLS already lets read and edit every roadmap.
 *
 * `?roadmap=<uuid>` and `?view=map|plan|timeline` deep links are unchanged in
 * shape (the Dashboard "needs a person" card, the Where-this-fits footer link
 * and old `/checklist?tab=roadmap` bookmarks all resolve here).
 *
 * Refusals follow the #29 convention (`useRoleGate`): a role without the door
 * lands on Today and is told why (helpers land quietly). Farm Mode is handled
 * by Layout's bounce before this page mounts; the effect below is the belt to
 * that suspender.
 */
export default function Roadmap() {
  const { user: authUser, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [farmModeEnabled] = useFarmModeEnabled(authUser?.id ?? null)
  const { bounce } = useRoleGate(role, authUser?.id)
  const allowed = canOpenRoadmap(role, farmModeEnabled)

  useEffect(() => {
    if (authLoading || role === null || allowed) return
    if (farmModeEnabled) {
      navigate(FARM_MODE_HOME, { replace: true })
      return
    }
    const { to } = bounce('roadmap', `${location.pathname}${location.search}`)
    navigate(to, { replace: true })
  }, [authLoading, role, allowed, farmModeEnabled, bounce, navigate, location.pathname, location.search])

  /** The tech tree's picker / the GOALS "Open roadmap →" — select a roadmap on this page. */
  const onRoadmapUrlParamChange = useCallback(
    (roadmapId: string) => {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('roadmap', roadmapId)
        return next
      })
    },
    [setSearchParams],
  )

  /** Roadmap task card → "Open on the checklist" (v2.1901): Today is a page away now. */
  const onOpenTodayTab = useCallback(() => {
    navigate('/checklist?tab=today')
  }, [navigate])

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading…</p>
  if (!allowed) return null

  /** Matches is_dev_or_master_or_assistant() in DB (includes primary) for roadmap structure + staff overrides. */
  const canEditTechTree = allowed
  const showTaskCosts = canSeeTaskCosts(role)

  return (
    <div
      style={{
        padding: '0.25rem 1.5rem 0.25rem',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', margin: '0.35rem 0 0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-strong)' }}>Roadmap</h1>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Plan the stages here; tasks in unlocked stages land on people's <strong>Today</strong> lists.
        </span>
      </div>
      {/* GOALS: moved here from Checklist → Review (Tier-2 #41). Scrolls within itself so an unfolded ledger never crushes the canvas below. */}
      <div style={{ flexShrink: 0, maxHeight: '50vh', overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <ChecklistGoalsSection
          authUserId={authUser?.id ?? null}
          canSeeCosts={showTaskCosts}
          canEditRoadmapTasks={canEditTechTree}
          onOpenRoadmap={onRoadmapUrlParamChange}
          setError={setError}
        />
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ChecklistTechTreeTab
          authUserId={authUser?.id ?? null}
          showTaskCosts={showTaskCosts}
          canEditTechTree={canEditTechTree}
          setError={setError}
          roadmapIdFromUrl={searchParams.get('roadmap')}
          viewFromUrl={searchParams.get('view')}
          onRoadmapUrlParamChange={onRoadmapUrlParamChange}
          onOpenTodayTab={onOpenTodayTab}
        />
      </div>
      {error && <p style={{ color: 'var(--text-red-700)', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}
