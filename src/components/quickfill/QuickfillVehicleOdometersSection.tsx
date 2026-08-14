import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  currentPossession,
  latestReading,
  parseOdometerInput,
  staleOdometerCallList,
  vehicleDisplayName,
  vinTail,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetVehicle,
  type StaleOdometerRow,
} from '../../lib/vehicleFleet'

/**
 * Quickfill "Vehicle odometers" station (Vehicles fleet phase 7): vehicles
 * held by a PERSON with no odometer reading in over a week — the assistant
 * calls the holder (tap-to-call), types the number, Save writes a normal
 * vehicle_odometer_entries row and the row drops off. Motor pool and
 * unassigned vehicles are skipped (kernel: staleOdometerCallList).
 */

type RosterUser = { id: string; name: string | null; phone: string | null }

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const sectionWrapStyle: CSSProperties = { marginBottom: '2rem' }
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem 0.9rem',
  flexWrap: 'wrap',
  padding: '0.55rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.875rem',
}

export function QuickfillVehicleOdometersSection() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [canAccess, setCanAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [possessions, setPossessions] = useState<FleetPossession[]>([])
  const [readings, setReadings] = useState<FleetOdometerEntry[]>([])
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingVehicleId, setSavingVehicleId] = useState<string | null>(null)

  const loadAccess = useCallback(async () => {
    if (!authUser?.id) {
      setCanAccess(false)
      setAccessChecked(true)
      return
    }
    try {
      const [meRes, approvedRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      setCanAccess(
        role === 'dev' || isAssistantLike(role) || (role === 'master_technician' && approvedIds.has(authUser.id)),
      )
    } catch (e) {
      setCanAccess(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAccessChecked(true)
    }
  }, [authUser?.id])

  useEffect(() => {
    void loadAccess()
  }, [loadAccess])

  const loadAll = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    try {
      const { data: vehiclesData, error: vErr } = await supabase
        .from('vehicles')
        .select('id, year, make, model, vin')
        .order('year', { ascending: false })
      if (vErr) throw vErr
      const list = (vehiclesData ?? []) as FleetVehicle[]
      setVehicles(list)
      const ids = list.map((v) => v.id)
      if (ids.length === 0) {
        setPossessions([])
        setReadings([])
        setRoster([])
        return
      }
      const [possRes, odoRes, usersRes] = await Promise.all([
        supabase.from('vehicle_possessions').select('*').in('vehicle_id', ids).is('end_date', null),
        supabase
          .from('vehicle_odometer_entries')
          .select('*')
          .in('vehicle_id', ids)
          .order('read_date', { ascending: false })
          .limit(2000),
        supabase.from('users').select('id, name, phone'),
      ])
      if (possRes.error) throw possRes.error
      if (odoRes.error) throw odoRes.error
      if (usersRes.error) throw usersRes.error
      setPossessions((possRes.data ?? []) as FleetPossession[])
      setReadings((odoRes.data ?? []) as FleetOdometerEntry[])
      setRoster((usersRes.data ?? []) as RosterUser[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [canAccess])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const today = todayYmd()
  const holderByVehicle = new Map<string, FleetPossession>()
  const latestByVehicle = new Map<string, FleetOdometerEntry>()
  for (const v of vehicles) {
    const p = currentPossession(
      possessions.filter((x) => x.vehicle_id === v.id),
      today,
    )
    if (p) holderByVehicle.set(v.id, p)
    const best = latestReading(readings.filter((r) => r.vehicle_id === v.id))
    if (best) latestByVehicle.set(v.id, best)
  }
  const rows: StaleOdometerRow[] = canAccess
    ? staleOdometerCallList(vehicles, holderByVehicle, latestByVehicle, today)
    : []
  const userById = new Map(roster.map((u) => [u.id, u]))

  useReportQuickfillSectionMetric(
    'vehicle-odometers',
    !accessChecked || !canAccess ? null : loading ? null : rows.length,
    !!(canAccess && loading),
  )

  async function saveReading(row: StaleOdometerRow) {
    const raw = drafts[row.vehicle.id] ?? ''
    const val = parseOdometerInput(raw)
    if (val == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    setSavingVehicleId(row.vehicle.id)
    try {
      const { error: err } = await supabase.from('vehicle_odometer_entries').insert({
        vehicle_id: row.vehicle.id,
        odometer_value: val,
        read_date: today,
        created_by: authUser?.id ?? null,
      })
      if (err) {
        setError(err.message)
        return
      }
      setError(null)
      setDrafts((prev) => ({ ...prev, [row.vehicle.id]: '' }))
      showToast(`Reading saved for ${vehicleDisplayName(row.vehicle)}.`, 'success')
      void loadAll()
    } finally {
      setSavingVehicleId(null)
    }
  }

  if (accessChecked && !canAccess) {
    return (
      <section style={sectionWrapStyle}>
        <p style={{ color: 'var(--text-muted)' }}>
          You do not have access to vehicle odometers (requires dev, assistant, or master technician with pay-approved access).
        </p>
      </section>
    )
  }

  return (
    <section style={sectionWrapStyle}>
      <p style={{ color: 'var(--text-slate-600)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
        Vehicles held by a person with no odometer reading in over a week — call the holder, type the
        number, done. Motor pool and unassigned vehicles are skipped.
      </p>
      {error && (
        <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>
      )}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-green-800)', fontSize: '0.875rem', margin: 0 }}>
          All readings fresh — nothing to collect.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {rows.map((row, i) => {
            const holderUser = row.holder.user_id ? userById.get(row.holder.user_id) : undefined
            const holderName = (holderUser?.name ?? '').trim() || 'Unknown holder'
            const phone = (holderUser?.phone ?? '').trim()
            return (
              <div key={row.vehicle.id} style={{ ...rowStyle, borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <span style={{ fontWeight: 600 }}>{vehicleDisplayName(row.vehicle)}</span>
                  {vinTail(row.vehicle.vin) && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {vinTail(row.vehicle.vin)}
                    </span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {row.latest ? (
                      <>
                        last {row.latest.odometer_value.toLocaleString()} mi ·{' '}
                        <span style={{ color: 'var(--text-amber-800)' }}>{row.daysStale}d ago</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-amber-800)' }}>no reading yet</span>
                    )}
                  </div>
                </div>
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
                    title={`Call ${holderName} (${phone})`}
                  >
                    ☎ {holderName}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="No phone on file">
                    {holderName} <span style={{ fontSize: '0.75rem' }}>(no phone)</span>
                  </span>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Miles"
                  value={drafts[row.vehicle.id] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [row.vehicle.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveReading(row)
                  }}
                  aria-label={`Odometer for ${vehicleDisplayName(row.vehicle)}`}
                  style={{ width: 100, padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  onClick={() => void saveReading(row)}
                  disabled={savingVehicleId === row.vehicle.id}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: savingVehicleId === row.vehicle.id ? '#9ca3af' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    cursor: savingVehicleId === row.vehicle.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingVehicleId === row.vehicle.id ? '…' : 'Save'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
