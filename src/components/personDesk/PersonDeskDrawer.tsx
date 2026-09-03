import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { usePersonDesk } from '../../hooks/usePersonDesk'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { canOpenPersonDesk, type PersonDeskViewer } from '../../lib/people/personDeskGates'
import { PersonDeskHeader } from './PersonDeskHeader'
import { PersonDeskAccessSection } from './sections/PersonDeskAccessSection'
import { PersonDeskTeamSection } from './sections/PersonDeskTeamSection'
import { PersonDeskHoursSection } from './sections/PersonDeskHoursSection'
import { PersonDeskPortalSection } from './sections/PersonDeskPortalSection'
import { PersonDeskPaySection } from './sections/PersonDeskPaySection'
import { PersonDeskLifecycleModal } from './PersonDeskLifecycleModal'
import { DESK_Z } from './personDeskShared'

/**
 * The Person Desk drawer (v2.2701): one person, every control, opened from
 * their name anywhere in the app. Right-hand panel on desktop, full-screen
 * sheet under 640px. Sections are thin wrappers over the tabs' own writes —
 * the Desk adds no permissions (personDeskGates.ts restates the existing ones).
 */
export function PersonDeskDrawer() {
  const desk = usePersonDeskContext()
  const { user: authUser, role, readOnly } = useAuth()
  const access = usePeopleAccess(authUser?.id)
  const payload = desk.payload
  const { key, user, person, loading, error } = usePersonDesk(payload, desk.changeKey)
  const [serviceTypeNames, setServiceTypeNames] = useState<Map<string, string>>(() => new Map())
  const [narrow, setNarrow] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 640 : false))
  const [flow, setFlow] = useState<'start' | 'end' | null>(null)

  const viewer: PersonDeskViewer = useMemo(
    () => ({
      role,
      isDev: access.isDev,
      canAccessPay: access.canAccessPay,
      canAccessHours: access.canAccessHours,
      canAccessVehicles: access.canAccessVehicles,
      canAccessLicenses: access.canAccessLicenses,
      canAccessContracts: access.canAccessContracts,
      readOnly,
    }),
    [role, access.isDev, access.canAccessPay, access.canAccessHours, access.canAccessVehicles, access.canAccessLicenses, access.canAccessContracts, readOnly],
  )

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') desk.close()
    }
    const onResize = () => setNarrow(window.innerWidth <= 640)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [payload, desk])

  useEffect(() => {
    if (!payload || serviceTypeNames.size > 0) return
    void (async () => {
      const { data } = await supabase.from('service_types').select('id, name')
      const m = new Map<string, string>()
      for (const r of (data ?? []) as Array<{ id: string; name: string }>) m.set(r.id, r.name)
      setServiceTypeNames(m)
    })()
  }, [payload, serviceTypeNames.size])

  if (!payload) return null
  if (!canOpenPersonDesk(role)) return null

  const displayName = key?.displayName ?? payload.displayName ?? 'Loading…'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Person Desk: ${displayName}`}
      style={{ position: 'fixed', inset: 0, zIndex: DESK_Z, background: 'rgba(17,24,39,0.32)', display: 'flex', justifyContent: 'flex-end' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) desk.close()
      }}
    >
      <div
        style={{
          width: narrow ? '100vw' : 'min(600px, 96vw)',
          height: '100%',
          background: 'var(--bg-page)',
          borderLeft: narrow ? 'none' : '1px solid var(--border)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {readOnly ? (
          <div role="status" style={{ padding: '0.35rem 1rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid #f59e0b' }}>
            Training mode: you can look, but every change is blocked for your account.
          </div>
        ) : null}
        <PersonDeskHeader
          personKey={key}
          user={user}
          person={person}
          viewer={viewer}
          serviceTypeNames={serviceTypeNames}
          changeKey={desk.changeKey}
          onChanged={desk.markChanged}
          onClose={desk.close}
          placeholderName={payload.displayName ?? null}
          onOpenFlow={(m) => setFlow(m)}
        />
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.7rem 0.75rem 1rem' }}>
          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
              {error}
            </p>
          ) : null}
          {loading && !key ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p> : null}
          {key ? (
            <>
              <PersonDeskHoursSection
                userId={key.userId}
                payName={key.payName}
                displayName={displayName}
                viewer={viewer}
                viewerUserId={authUser?.id ?? null}
                changeKey={desk.changeKey}
                onChanged={desk.markChanged}
              />
              {key.isSub ? <PersonDeskPortalSection personId={key.personId} displayName={displayName} changeKey={desk.changeKey} /> : null}
              <PersonDeskPaySection personKey={key} viewer={viewer} changeKey={desk.changeKey} onChanged={desk.markChanged} />
              <PersonDeskTeamSection userId={key.userId} displayName={displayName} viewer={viewer} viewerUserId={authUser?.id ?? null} changeKey={desk.changeKey} onChanged={desk.markChanged} />
              <PersonDeskAccessSection user={user} viewer={viewer} viewerUserId={authUser?.id ?? null} serviceTypeNames={serviceTypeNames} onChanged={desk.markChanged} />
            </>
          ) : null}
        </div>
      </div>
      {flow && key ? (
        <PersonDeskLifecycleModal
          mode={flow}
          personKey={key}
          viewer={viewer}
          viewerUserId={authUser?.id ?? null}
          userEmail={user?.email ?? null}
          onClose={() => setFlow(null)}
          onChanged={desk.markChanged}
        />
      ) : null}
    </div>
  )
}
