import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { usePersonDesk } from '../../hooks/usePersonDesk'
import type { PersonDeskOpenArgs } from '../../contexts/PersonDeskContext'
import type { PersonDeskViewer } from '../../lib/people/personDeskGates'
import { PersonDeskHeader } from './PersonDeskHeader'
import { PersonDeskAccessSection } from './sections/PersonDeskAccessSection'
import { PersonDeskTeamSection } from './sections/PersonDeskTeamSection'
import { PersonDeskHoursSection } from './sections/PersonDeskHoursSection'
import { PersonDeskPortalSection } from './sections/PersonDeskPortalSection'
import { PersonDeskWorkOrdersSection } from './sections/PersonDeskWorkOrdersSection'
import { PersonDeskPaySection } from './sections/PersonDeskPaySection'
import { PersonDeskFieldSection } from './sections/PersonDeskFieldSection'
import { PersonDeskPaperworkSection } from './sections/PersonDeskPaperworkSection'
import { PersonDeskRecordsSection } from './sections/PersonDeskRecordsSection'
import { PersonDeskScheduleSection } from './sections/PersonDeskScheduleSection'
import { PersonDeskLifecycleModal } from './PersonDeskLifecycleModal'

/**
 * The Person Desk body (PR 3): header + the section registry + the lifecycle
 * flows, rendered the same by the drawer (one column) and the People → Person
 * tab (two columns when wide). The registry order is the reading order:
 * what needs you now, then money, then the person's things, then records.
 */
export function PersonDeskBody({
  payload,
  changeKey,
  onChanged,
  onClose,
  variant,
}: {
  payload: PersonDeskOpenArgs
  changeKey: number
  onChanged: () => void
  onClose: () => void
  variant: 'drawer' | 'page'
}) {
  const { user: authUser, role, readOnly } = useAuth()
  const access = usePeopleAccess(authUser?.id)
  const { key, user, person, loading, error } = usePersonDesk(payload, changeKey)
  const [serviceTypeNames, setServiceTypeNames] = useState<Map<string, string>>(() => new Map())
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
    if (serviceTypeNames.size > 0) return
    void (async () => {
      const { data } = await supabase.from('service_types').select('id, name')
      const m = new Map<string, string>()
      for (const r of (data ?? []) as Array<{ id: string; name: string }>) m.set(r.id, r.name)
      setServiceTypeNames(m)
    })()
  }, [serviceTypeNames.size])

  const displayName = key?.displayName ?? payload.displayName ?? 'Loading…'
  const viewerUserId = authUser?.id ?? null

  return (
    <>
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
        changeKey={changeKey}
        onChanged={onChanged}
        onClose={onClose}
        placeholderName={payload.displayName ?? null}
        onOpenFlow={(m) => setFlow(m)}
        hideClose={variant === 'page'}
      />
      <div
        style={{
          overflow: variant === 'drawer' ? 'auto' : undefined,
          flex: variant === 'drawer' ? 1 : undefined,
          display: 'grid',
          gridTemplateColumns: variant === 'page' ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr',
          alignItems: 'start',
          gap: '0.6rem',
          padding: '0.7rem 0.75rem 1rem',
        }}
      >
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)', gridColumn: '1 / -1' }}>
            {error}
          </p>
        ) : null}
        {loading && !key ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p> : null}
        {key ? (
          <>
            <PersonDeskHoursSection userId={key.userId} payName={key.payName} displayName={displayName} viewer={viewer} viewerUserId={viewerUserId} changeKey={changeKey} onChanged={onChanged} />
            {key.isSub ? <PersonDeskPortalSection personId={key.personId} displayName={displayName} changeKey={changeKey} /> : null}
            {key.isSub ? <PersonDeskWorkOrdersSection personId={key.personId} changeKey={changeKey} /> : null}
            <PersonDeskPaySection personKey={key} viewer={viewer} changeKey={changeKey} onChanged={onChanged} />
            <PersonDeskTeamSection userId={key.userId} displayName={displayName} viewer={viewer} viewerUserId={viewerUserId} changeKey={changeKey} onChanged={onChanged} />
            <PersonDeskFieldSection userId={key.userId} payName={key.payName} displayName={displayName} viewer={viewer} changeKey={changeKey} onChanged={onChanged} />
            <PersonDeskPaperworkSection payName={key.payName} personId={key.personId} viewer={viewer} changeKey={changeKey} onChanged={onChanged} />
            <PersonDeskRecordsSection userId={key.userId} personId={key.personId} viewer={viewer} changeKey={changeKey} />
            <PersonDeskScheduleSection userId={key.userId} displayName={displayName} />
            <PersonDeskAccessSection user={user} viewer={viewer} viewerUserId={viewerUserId} serviceTypeNames={serviceTypeNames} onChanged={onChanged} />
          </>
        ) : null}
      </div>
      {flow && key ? <PersonDeskLifecycleModal mode={flow} personKey={key} viewer={viewer} viewerUserId={viewerUserId} userEmail={user?.email ?? null} onClose={() => setFlow(null)} onChanged={onChanged} /> : null}
    </>
  )
}
