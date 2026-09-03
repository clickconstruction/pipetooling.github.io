import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useAuth } from '../../../hooks/useAuth'
import { handOffWrites, vehicleDisplayName } from '../../../lib/vehicleFleet'
import { denverWorkDateToday } from '../../../lib/salaryScheduleSync'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import PersonLicenseHoursLogModal from '../../people/PersonLicenseHoursLogModal'
import { BTN, BTN_BLUE, BTN_QUIET, Chip, DeskRow, DeskSection, LockTag, deskBtn, fmtDate } from '../personDeskShared'

type HeldVehicle = { possessionId: string; vehicleId: string; label: string; since: string }
type Occupancy = { possessionId: string; label: string; since: string; until: string | null }
type License = { id: string; license_type: string; date_of_expiry: string | null; note: string | null }

function expiryTone(ymd: string | null, todayYmd: string): 'green' | 'amber' | 'red' | 'gray' {
  if (!ymd) return 'gray'
  const days = Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86_400_000)
  return days < 0 ? 'red' : days <= 30 ? 'amber' : 'green'
}

/** Field (PR 3): the truck they hold, the housing they occupy, the licenses they carry — each with the tab's own write. */
export function PersonDeskFieldSection({ userId, payName, displayName, viewer, changeKey, onChanged }: { userId: string | null; payName: string | null; displayName: string; viewer: PersonDeskViewer; changeKey: number; onChanged: () => void }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const { user: authUser } = useAuth()
  const [vehicles, setVehicles] = useState<HeldVehicle[] | null>(null)
  const [fleet, setFleet] = useState<Array<{ id: string; label: string }>>([])
  const [housing, setHousing] = useState<Occupancy[] | null>(null)
  const [units, setUnits] = useState<Array<{ id: string; address: string }>>([])
  const [licenses, setLicenses] = useState<License[] | null>(null)
  const [vehiclePick, setVehiclePick] = useState('')
  const [unitPick, setUnitPick] = useState('')
  const [hoursLogOpen, setHoursLogOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const todayYmd = denverWorkDateToday()

  const showVehicles = viewer.canAccessVehicles
  const showHousing = viewer.canAccessPay
  const showLicenses = viewer.canAccessLicenses
  const canEditVehicles = showVehicles && !viewer.readOnly
  const canEditHousing = showHousing && !viewer.readOnly

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [vp, fl, hp, hu, li] = await Promise.all([
        showVehicles && userId ? supabase.from('vehicle_possessions').select('id, vehicle_id, start_date, vehicles(year, make, model)').eq('user_id', userId).is('end_date', null) : Promise.resolve({ data: [] }),
        showVehicles ? supabase.from('vehicles').select('id, year, make, model').order('year', { ascending: false }) : Promise.resolve({ data: [] }),
        showHousing && userId ? supabase.from('housing_possessions').select('id, start_date, end_date, housing_units(address)').eq('user_id', userId).or(`end_date.is.null,end_date.gte.${todayYmd}`) : Promise.resolve({ data: [] }),
        showHousing ? supabase.from('housing_units').select('id, address').order('address') : Promise.resolve({ data: [] }),
        showLicenses && payName ? supabase.from('person_licenses').select('id, license_type, date_of_expiry, note').eq('person_name', payName).order('date_of_expiry', { ascending: true }) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      setVehicles(
        (((vp as { data: unknown[] | null }).data ?? []) as Array<{ id: string; vehicle_id: string; start_date: string; vehicles: { year: number | null; make: string | null; model: string | null } | null }>).map((v) => ({
          possessionId: v.id,
          vehicleId: v.vehicle_id,
          label: v.vehicles ? vehicleDisplayName({ year: v.vehicles.year ?? null, make: v.vehicles.make ?? '', model: v.vehicles.model ?? '' } as never) : 'Vehicle',
          since: v.start_date,
        })),
      )
      setFleet((((fl as { data: unknown[] | null }).data ?? []) as Array<{ id: string; year: number | null; make: string | null; model: string | null }>).map((v) => ({ id: v.id, label: vehicleDisplayName({ year: v.year ?? null, make: v.make ?? '', model: v.model ?? '' } as never) })))
      setHousing((((hp as { data: unknown[] | null }).data ?? []) as Array<{ id: string; start_date: string; end_date: string | null; housing_units: { address: string | null } | null }>).map((h) => ({ possessionId: h.id, label: h.housing_units?.address ?? 'Housing', since: h.start_date, until: h.end_date })))
      setUnits((((hu as { data: unknown[] | null }).data ?? []) as Array<{ id: string; address: string }>))
      setLicenses((((li as { data: unknown[] | null }).data ?? []) as License[]))
    })()
    return () => {
      cancelled = true
    }
  }, [userId, payName, showVehicles, showHousing, showLicenses, changeKey, todayYmd])

  if (!showVehicles && !showHousing && !showLicenses) return null

  async function park(v: HeldVehicle) {
    const ok = await confirmDialog({ message: `Park ${v.label} in the motor pool today? ${displayName} stops holding it.`, confirmLabel: 'To motor pool' })
    if (!ok) return
    setBusy(v.possessionId)
    try {
      const w = handOffWrites({ vehicleId: v.vehicleId, openPossession: { id: v.possessionId, vehicle_id: v.vehicleId, user_id: userId, start_date: v.since, end_date: null, created_at: null }, toUserId: null, dateYmd: todayYmd, odometer: null, byUserId: authUser?.id ?? null })
      if (w.endPossession) {
        const { error } = await supabase.from('vehicle_possessions').update({ end_date: w.endPossession.end_date }).eq('id', w.endPossession.id)
        if (error) throw error
      }
      const { error: e2 } = await supabase.from('vehicle_possessions').insert(w.newPossession)
      if (e2) throw e2
      showToast('Parked in the motor pool', 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handOff() {
    if (!userId || !vehiclePick) return
    const label = fleet.find((f) => f.id === vehiclePick)?.label ?? 'vehicle'
    const ok = await confirmDialog({ message: `Hand ${label} to ${displayName} today? Whoever holds it now stops.`, confirmLabel: 'Hand off' })
    if (!ok) return
    setBusy('handoff')
    try {
      const { data: open } = await supabase.from('vehicle_possessions').select('id, vehicle_id, user_id, start_date, end_date, created_at').eq('vehicle_id', vehiclePick).is('end_date', null).limit(1)
      const cur = ((open ?? [])[0] as { id: string; vehicle_id: string; user_id: string | null; start_date: string; end_date: string | null; created_at: string | null } | undefined) ?? null
      const w = handOffWrites({ vehicleId: vehiclePick, openPossession: cur, toUserId: userId, dateYmd: todayYmd, odometer: null, byUserId: authUser?.id ?? null })
      if (w.endPossession) {
        const { error } = await supabase.from('vehicle_possessions').update({ end_date: w.endPossession.end_date }).eq('id', w.endPossession.id)
        if (error) throw error
      }
      const { error: e2 } = await supabase.from('vehicle_possessions').insert(w.newPossession)
      if (e2) throw e2
      showToast(`${label} handed to ${displayName}`, 'success')
      setVehiclePick('')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function assignHousing() {
    if (!userId || !unitPick) return
    setBusy('housing')
    const { error } = await supabase.from('housing_possessions').insert({ housing_id: unitPick, user_id: userId, start_date: todayYmd, end_date: null })
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Housing assigned', 'success')
      setUnitPick('')
      onChanged()
    }
  }

  async function endHousing(o: Occupancy) {
    const ok = await confirmDialog({ message: `End ${displayName}'s occupancy at ${o.label} today?`, confirmLabel: 'End occupancy' })
    if (!ok) return
    setBusy(o.possessionId)
    const { error } = await supabase.from('housing_possessions').update({ end_date: todayYmd }).eq('id', o.possessionId)
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Occupancy ended', 'success')
      onChanged()
    }
  }

  return (
    <DeskSection title="Field">
      {showVehicles ? (
        <DeskRow
          label="Vehicle"
          actions={
            canEditVehicles && userId ? (
              <>
                <select value={vehiclePick} onChange={(e) => setVehiclePick(e.target.value)} style={{ fontSize: '0.78125rem', padding: '0.1rem 0.3rem', maxWidth: 160 }} aria-label="Vehicle to hand off">
                  <option value="">Hand off…</option>
                  {fleet.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {vehiclePick ? (
                  <button type="button" style={deskBtn(BTN_BLUE, busy === 'handoff')} disabled={busy === 'handoff'} onClick={() => void handOff()}>
                    Hand off
                  </button>
                ) : null}
              </>
            ) : canEditVehicles ? null : (
              <LockTag label="vehicle roles" />
            )
          }
        >
          {!userId ? (
            <span style={{ color: 'var(--text-muted)' }}>Needs a login</span>
          ) : vehicles == null ? (
            <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
          ) : vehicles.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>None held</span>
          ) : (
            vehicles.map((v) => (
              <span key={v.possessionId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>{v.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>since {fmtDate(v.since)}</span>
                {canEditVehicles ? (
                  <button type="button" style={deskBtn(BTN_QUIET, busy === v.possessionId)} disabled={busy === v.possessionId} onClick={() => void park(v)}>
                    To motor pool
                  </button>
                ) : null}
              </span>
            ))
          )}
        </DeskRow>
      ) : null}
      {showHousing ? (
        <DeskRow
          label="Housing"
          actions={
            canEditHousing && userId ? (
              <>
                <select value={unitPick} onChange={(e) => setUnitPick(e.target.value)} style={{ fontSize: '0.78125rem', padding: '0.1rem 0.3rem', maxWidth: 160 }} aria-label="Housing unit to assign">
                  <option value="">Assign…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.address}
                    </option>
                  ))}
                </select>
                {unitPick ? (
                  <button type="button" style={deskBtn(BTN_BLUE, busy === 'housing')} disabled={busy === 'housing'} onClick={() => void assignHousing()}>
                    Assign
                  </button>
                ) : null}
              </>
            ) : canEditHousing ? null : (
              <LockTag label="pay roles" />
            )
          }
        >
          {!userId ? (
            <span style={{ color: 'var(--text-muted)' }}>Needs a login</span>
          ) : housing == null ? (
            <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
          ) : housing.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          ) : (
            housing.map((h) => (
              <span key={h.possessionId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>{h.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  since {fmtDate(h.since)}
                  {h.until ? ` · until ${fmtDate(h.until)}` : ''}
                </span>
                {canEditHousing ? (
                  <button type="button" style={deskBtn(BTN_QUIET, busy === h.possessionId)} disabled={busy === h.possessionId} onClick={() => void endHousing(h)}>
                    End occupancy
                  </button>
                ) : null}
              </span>
            ))
          )}
        </DeskRow>
      ) : null}
      {showLicenses ? (
        <DeskRow
          label="Licenses"
          actions={
            <>
              {userId && payName ? (
                <button type="button" style={BTN_QUIET} onClick={() => setHoursLogOpen(true)}>
                  Hours log
                </button>
              ) : null}
              <a href="/people?tab=licenses" style={{ ...BTN, textDecoration: 'none' }}>
                Licenses
              </a>
            </>
          }
        >
          {!payName ? (
            <span style={{ color: 'var(--text-muted)' }}>Needs a pay name</span>
          ) : licenses == null ? (
            <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
          ) : licenses.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>None on file</span>
          ) : (
            licenses.map((l) => (
              <Chip key={l.id} tone={expiryTone(l.date_of_expiry, todayYmd)} title={l.note ?? undefined}>
                {l.license_type}
                {l.date_of_expiry ? ` · exp ${fmtDate(l.date_of_expiry)}` : ''}
              </Chip>
            ))
          )}
        </DeskRow>
      ) : null}
      {hoursLogOpen && userId && payName ? <PersonLicenseHoursLogModal personName={payName} userId={userId} onClose={() => setHoursLogOpen(false)} /> : null}
    </DeskSection>
  )
}
