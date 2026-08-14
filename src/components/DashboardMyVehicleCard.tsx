import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import {
  lastOilChange,
  latestReading,
  odometerAgeLabel,
  odometerFreshness,
  oilChipLabel,
  oilStatus,
  oilThresholdsForVehicle,
  openProblems,
  parseOdometerInput,
  vehicleDisplayName,
  PROBLEM_SEVERITY_LABELS,
  type FleetOdometerEntry,
  type FleetProblemReport,
  type FleetServiceEvent,
} from '../lib/vehicleFleet'

/**
 * Dashboard "My Vehicle" card (v2.1648, Vehicles fleet phase 4): renders just
 * below My Time for whoever currently HOLDS a company vehicle (open
 * vehicle_possessions row — RLS policies from 20260814183650 scope every read
 * to the held vehicle). Two field actions keep the fleet current without the
 * office chasing anyone: submit an odometer reading and report a problem.
 * Renders nothing when the user holds no vehicle.
 */

type HeldVehicle = {
  id: string
  year: number | null
  make: string
  model: string
  vin: string | null
  oil_change_interval_miles?: number | null
  oil_suggest_window_miles?: number | null
  oil_require_past_due_miles?: number | null
}

export type DashboardMyVehicleCardProps = {
  userId: string
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardMyVehicleCard({ userId }: DashboardMyVehicleCardProps) {
  const { showToast } = useToastContext()
  const [vehicles, setVehicles] = useState<HeldVehicle[]>([])
  const [latestByVehicle, setLatestByVehicle] = useState<Record<string, FleetOdometerEntry>>({})
  const [lastOilByVehicle, setLastOilByVehicle] = useState<Record<string, FleetServiceEvent>>({})
  const [openByVehicle, setOpenByVehicle] = useState<Record<string, FleetProblemReport[]>>({})
  const [odoDrafts, setOdoDrafts] = useState<Record<string, string>>({})
  const [savingVehicleId, setSavingVehicleId] = useState<string | null>(null)
  const [reportingVehicleId, setReportingVehicleId] = useState<string | null>(null)
  const [problemDescription, setProblemDescription] = useState('')
  const [problemSeverity, setProblemSeverity] = useState('needs_service')
  const [reportSaving, setReportSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayYmd()

  async function load() {
    const { data: possData } = await supabase
      .from('vehicle_possessions')
      .select('vehicle_id, start_date, end_date')
      .eq('user_id', userId)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
    const ids = [...new Set(((possData ?? []) as { vehicle_id: string }[]).map((p) => p.vehicle_id))]
    if (ids.length === 0) {
      setVehicles([])
      return
    }
    const [{ data: vehData }, { data: odoData }, { data: oilData }, { data: probData }] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, year, make, model, vin, oil_change_interval_miles, oil_suggest_window_miles, oil_require_past_due_miles')
        .in('id', ids),
      supabase.from('vehicle_odometer_entries').select('*').in('vehicle_id', ids).order('read_date', { ascending: false }).limit(200),
      supabase
        .from('vehicle_service_events')
        .select('*')
        .in('vehicle_id', ids)
        .eq('service_type', 'oil_change')
        .order('service_date', { ascending: false })
        .limit(200),
      supabase.from('vehicle_problem_reports').select('*').in('vehicle_id', ids).is('resolved_at', null).limit(200),
    ])
    setVehicles((vehData ?? []) as HeldVehicle[])
    const latest: Record<string, FleetOdometerEntry> = {}
    const grouped = new Map<string, FleetOdometerEntry[]>()
    for (const e of (odoData ?? []) as FleetOdometerEntry[]) {
      const arr = grouped.get(e.vehicle_id) ?? []
      arr.push(e)
      grouped.set(e.vehicle_id, arr)
    }
    for (const [vid, arr] of grouped) {
      const best = latestReading(arr)
      if (best) latest[vid] = best
    }
    setLatestByVehicle(latest)
    const lastOil: Record<string, FleetServiceEvent> = {}
    const oilGrouped = new Map<string, FleetServiceEvent[]>()
    for (const e of (oilData ?? []) as FleetServiceEvent[]) {
      const arr = oilGrouped.get(e.vehicle_id) ?? []
      arr.push(e)
      oilGrouped.set(e.vehicle_id, arr)
    }
    for (const [vid, arr] of oilGrouped) {
      const best = lastOilChange(arr)
      if (best) lastOil[vid] = best
    }
    setLastOilByVehicle(lastOil)
    const open: Record<string, FleetProblemReport[]> = {}
    for (const p of openProblems((probData ?? []) as FleetProblemReport[])) {
      const arr = open[p.vehicle_id] ??= []
      arr.push(p)
    }
    setOpenByVehicle(open)
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const chip = (tone: 'plain' | 'amber' | 'red' | 'green', text: string) => (
    <span
      style={{
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        background:
          tone === 'amber' ? 'var(--bg-amber-100)' : tone === 'red' ? 'var(--bg-red-100)' : tone === 'green' ? 'var(--bg-green-100)' : 'var(--bg-subtle)',
        color:
          tone === 'amber' ? 'var(--text-amber-800)' : tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)',
      }}
    >
      {text}
    </span>
  )

  async function saveReading(vehicleId: string) {
    if (savingVehicleId) return
    const val = parseOdometerInput(odoDrafts[vehicleId] ?? '')
    if (val == null) {
      setError('Enter the odometer miles first')
      return
    }
    setSavingVehicleId(vehicleId)
    const { error: err } = await supabase
      .from('vehicle_odometer_entries')
      .insert({ vehicle_id: vehicleId, odometer_value: val, read_date: todayYmd(), created_by: userId })
    setSavingVehicleId(null)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setOdoDrafts((prev) => ({ ...prev, [vehicleId]: '' }))
    showToast('Odometer reading sent.', 'success')
    load()
  }

  async function submitReport(vehicleId: string) {
    if (reportSaving) return
    if (!problemDescription.trim()) {
      setError('Describe the problem first')
      return
    }
    setReportSaving(true)
    const { error: err } = await supabase.from('vehicle_problem_reports').insert({
      vehicle_id: vehicleId,
      description: problemDescription.trim(),
      severity: problemSeverity,
      report_date: todayYmd(),
      reported_by: userId,
    })
    setReportSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setReportingVehicleId(null)
    setProblemDescription('')
    setProblemSeverity('needs_service')
    showToast('Problem sent to the office.', 'success')
    load()
  }

  const anyVehicle = useMemo(() => vehicles.length > 0, [vehicles])
  if (!anyVehicle) return null

  return (
    <div
      role="region"
      aria-label="My vehicle"
      style={{
        marginBottom: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
      }}
    >
      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '0.6rem' }}>
        My Vehicle
      </div>
      {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', margin: '0 0 0.6rem' }}>{error}</p>}
      {vehicles.map((v, i) => {
        const latest = latestByVehicle[v.id] ?? null
        const freshness = odometerFreshness(latest, today)
        const oil = oilStatus(lastOilByVehicle[v.id] ?? null, v.oil_change_interval_miles, latest, oilThresholdsForVehicle(v))
        const open = openByVehicle[v.id] ?? []
        return (
          <div key={v.id} style={{ marginTop: i === 0 ? 0 : '0.9rem', paddingTop: i === 0 ? 0 : '0.9rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{vehicleDisplayName(v)}</span>
              {latest
                ? chip(freshness === 'fresh' ? 'plain' : 'amber', `${latest.odometer_value.toLocaleString()} mi · ${odometerAgeLabel(latest, today)}`)
                : chip('amber', 'No reading yet')}
              {freshness !== 'fresh' && chip('amber', 'reading requested')}
              {oil.state === 'ok' && chip('green', oilChipLabel(oil))}
              {open.length > 0 && chip('red', `${open.length} open problem${open.length === 1 ? '' : 's'}`)}
            </div>
            {(oil.state === 'due_soon' || oil.state === 'overdue') && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  borderRadius: 8,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.6rem',
                  fontSize: '0.8125rem',
                  background: oil.state === 'overdue' ? 'var(--bg-red-100)' : 'var(--bg-amber-100)',
                  color: oil.state === 'overdue' ? 'var(--text-red-700)' : 'var(--text-amber-800)',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>🛢</span>
                <span>
                  {oil.state === 'overdue' ? (
                    <>
                      <strong>Oil change required</strong> — {oil.milesOver.toLocaleString()} mi overdue. Get it in and
                      the office will log the service.
                    </>
                  ) : (
                    <>
                      <strong>Oil change suggested</strong> —{' '}
                      {oil.milesRemaining < 0
                        ? `${(-oil.milesRemaining).toLocaleString()} mi past due`
                        : `due in ${oil.milesRemaining.toLocaleString()} mi`}{' '}
                      (next at {oil.nextDueAt.toLocaleString()})
                    </>
                  )}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Odometer today"
                value={odoDrafts[v.id] ?? ''}
                onChange={(e) => setOdoDrafts((prev) => ({ ...prev, [v.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveReading(v.id)
                }}
                style={{ flex: '1 1 130px', minWidth: 120, maxWidth: 180, padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
              />
              <button
                type="button"
                onClick={() => saveReading(v.id)}
                disabled={savingVehicleId === v.id}
                style={{
                  padding: '0.45rem 0.8rem',
                  background: savingVehicleId === v.id ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: savingVehicleId === v.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {savingVehicleId === v.id ? '…' : 'Send reading'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportingVehicleId((prev) => (prev === v.id ? null : v.id))
                  setProblemDescription('')
                  setProblemSeverity('needs_service')
                }}
                style={{ padding: '0.45rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Report problem
              </button>
            </div>
            {reportingVehicleId === v.id && (
              <div style={{ marginTop: '0.6rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.8rem', background: 'var(--bg-subtle)' }}>
                <textarea
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="What's wrong? e.g. brakes grinding on front left"
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--border-strong)', borderRadius: 6 }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0', flexWrap: 'wrap' }}>
                  {Object.entries(PROBLEM_SEVERITY_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProblemSeverity(key)}
                      style={{
                        padding: '0.25rem 0.7rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        border: problemSeverity === key ? '1px solid #dc2626' : '1px solid var(--border-strong)',
                        background: problemSeverity === key ? 'var(--bg-red-100)' : 'var(--surface)',
                        color: problemSeverity === key ? 'var(--text-red-700)' : 'var(--text-muted)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => submitReport(v.id)}
                  disabled={reportSaving}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.8rem',
                    background: reportSaving ? '#9ca3af' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 500,
                    cursor: reportSaving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {reportSaving ? '…' : 'Send to the office'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
