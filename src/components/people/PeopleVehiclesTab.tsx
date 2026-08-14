import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildVehicleLedger,
  currentPossession,
  fleetOilCounts,
  fleetSummary,
  handOffWrites,
  lastOilChange,
  latestReading,
  odometerAgeLabel,
  odometerFreshness,
  oilChipLabel,
  oilStatus,
  openProblemCounts,
  openProblems,
  parseOdometerInput,
  PROBLEM_SEVERITY_LABELS,
  SERVICE_TYPE_LABELS,
  vehicleDisplayName,
  vehicleMatchesSearch,
  vinTail,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetProblemReport,
  type FleetServiceEvent,
  type FleetValueEntry,
  type VehicleLedgerRowKind,
} from '../../lib/vehicleFleet'

/**
 * People → Vehicles (v2.1644 fleet redesign): a card per vehicle answering
 * "who has it / how many miles / is the reading fresh", with a click-through
 * ledger (readings + hand-offs + value updates merged) and a quick odometer
 * entry as the panel's first control. Kernels in src/lib/vehicleFleet.ts.
 */

type Vehicle = {
  id: string
  year: number | null
  make: string
  model: string
  vin: string | null
  weekly_insurance_cost: number
  weekly_registration_cost: number
  oil_change_interval_miles?: number | null
}

type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

export type PeopleVehiclesTabProps = {
  users: UserRow[]
}

const LEDGER_FILTERS: Array<{ key: 'all' | VehicleLedgerRowKind; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'reading', label: 'Odometer' },
  { key: 'service', label: 'Service' },
  { key: 'problem', label: 'Problems' },
  { key: 'handoff', label: 'Holders' },
  { key: 'value', label: 'Value' },
]

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function formatYmdShort(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(Date.UTC(y, m - 1, d))
  const currentYear = new Date().getFullYear()
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(y !== currentYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

export default function PeopleVehiclesTab({ users }: PeopleVehiclesTabProps) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [possessionsAll, setPossessionsAll] = useState<FleetPossession[]>([])
  const [latestByVehicle, setLatestByVehicle] = useState<Record<string, FleetOdometerEntry>>({})
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [panelReadings, setPanelReadings] = useState<FleetOdometerEntry[]>([])
  const [panelValues, setPanelValues] = useState<FleetValueEntry[]>([])
  const [ledgerFilter, setLedgerFilter] = useState<'all' | VehicleLedgerRowKind>('all')
  const [quickOdoValue, setQuickOdoValue] = useState('')
  const [quickOdoDate, setQuickOdoDate] = useState(todayYmd)
  const [savingReading, setSavingReading] = useState(false)
  const quickOdoRef = useRef<HTMLInputElement | null>(null)

  const [vehicleFormOpen, setVehicleFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleVin, setVehicleVin] = useState('')
  const [vehicleInsCost, setVehicleInsCost] = useState('')
  const [vehicleRegCost, setVehicleRegCost] = useState('')

  const [handOffVehicle, setHandOffVehicle] = useState<Vehicle | null>(null)
  const [handOffUserId, setHandOffUserId] = useState('')
  const [handOffDate, setHandOffDate] = useState(todayYmd)
  const [handOffOdometer, setHandOffOdometer] = useState('')
  const [handOffSaving, setHandOffSaving] = useState(false)

  const [valueFormOpen, setValueFormOpen] = useState(false)
  const [valueDate, setValueDate] = useState(todayYmd)
  const [valueAmount, setValueAmount] = useState('')

  const [openProblemsByVehicle, setOpenProblemsByVehicle] = useState<Record<string, number>>({})
  const [panelProblems, setPanelProblems] = useState<FleetProblemReport[]>([])
  const [problemFormOpen, setProblemFormOpen] = useState(false)
  const [problemDescription, setProblemDescription] = useState('')
  const [problemSeverity, setProblemSeverity] = useState('needs_service')
  const [problemSaving, setProblemSaving] = useState(false)
  const [resolvingProblem, setResolvingProblem] = useState<FleetProblemReport | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolveSaving, setResolveSaving] = useState(false)

  const [lastOilByVehicle, setLastOilByVehicle] = useState<Record<string, FleetServiceEvent>>({})
  const [panelServiceEvents, setPanelServiceEvents] = useState<FleetServiceEvent[]>([])
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [serviceType, setServiceType] = useState('oil_change')
  const [serviceDate, setServiceDate] = useState(todayYmd)
  const [serviceOdometer, setServiceOdometer] = useState('')
  const [serviceCost, setServiceCost] = useState('')
  const [serviceNote, setServiceNote] = useState('')
  const [serviceSaving, setServiceSaving] = useState(false)
  const [vehicleOilInterval, setVehicleOilInterval] = useState('')

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name ?? ''])), [users])
  const today = todayYmd()

  const holderByVehicle = useMemo(() => {
    const m = new Map<string, FleetPossession>()
    for (const v of vehicles) {
      const p = currentPossession(
        possessionsAll.filter((x) => x.vehicle_id === v.id),
        today,
      )
      if (p) m.set(v.id, p)
    }
    return m
  }, [vehicles, possessionsAll, today])

  const latestMap = useMemo(() => {
    const m = new Map<string, FleetOdometerEntry>()
    for (const [k, v] of Object.entries(latestByVehicle)) m.set(k, v)
    return m
  }, [latestByVehicle])

  const summary = useMemo(
    () => fleetSummary(vehicles, holderByVehicle, latestMap, today),
    [vehicles, holderByVehicle, latestMap, today],
  )

  const lastOilMap = useMemo(() => {
    const m = new Map<string, FleetServiceEvent>()
    for (const [k, v] of Object.entries(lastOilByVehicle)) m.set(k, v)
    return m
  }, [lastOilByVehicle])

  const oilCounts = useMemo(
    () => fleetOilCounts(vehicles, lastOilMap, latestMap),
    [vehicles, lastOilMap, latestMap],
  )

  const weeklyTotal = useMemo(
    () => vehicles.reduce((s, v) => s + (v.weekly_insurance_cost ?? 0) + (v.weekly_registration_cost ?? 0), 0),
    [vehicles],
  )

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        const holder = holderByVehicle.get(v.id)
        const holderName = holder ? (userNameById.get(holder.user_id) ?? null) : null
        return vehicleMatchesSearch(v, holderName, search)
      }),
    [vehicles, holderByVehicle, userNameById, search],
  )

  const selectedVehicle = selectedVehicleId ? (vehicles.find((v) => v.id === selectedVehicleId) ?? null) : null

  async function loadFleet() {
    setLoading(true)
    setError(null)
    const { data: vehiclesData, error: vErr } = await supabase.from('vehicles').select('*').order('year', { ascending: false })
    setLoading(false)
    if (vErr) {
      setError(vErr.message)
      return
    }
    const list = (vehiclesData ?? []) as Vehicle[]
    setVehicles(list)
    const ids = list.map((v) => v.id)
    if (ids.length === 0) {
      setPossessionsAll([])
      setLatestByVehicle({})
      return
    }
    const [{ data: possData }, { data: odoData }, { data: oilData }, { data: probData }] = await Promise.all([
      supabase.from('vehicle_possessions').select('*').in('vehicle_id', ids).order('start_date', { ascending: false }),
      supabase
        .from('vehicle_odometer_entries')
        .select('*')
        .in('vehicle_id', ids)
        .order('read_date', { ascending: false })
        .limit(2000),
      supabase
        .from('vehicle_service_events')
        .select('*')
        .in('vehicle_id', ids)
        .eq('service_type', 'oil_change')
        .order('service_date', { ascending: false })
        .limit(2000),
      supabase
        .from('vehicle_problem_reports')
        .select('*')
        .in('vehicle_id', ids)
        .is('resolved_at', null)
        .limit(2000),
    ])
    const probCounts: Record<string, number> = {}
    for (const [vid, n] of openProblemCounts((probData ?? []) as FleetProblemReport[])) probCounts[vid] = n
    setOpenProblemsByVehicle(probCounts)
    setPossessionsAll((possData ?? []) as FleetPossession[])
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
  }

  async function loadPanel(vehicleId: string) {
    const [{ data: odoData }, { data: valData }, { data: svcData }, { data: probData2 }] = await Promise.all([
      supabase.from('vehicle_odometer_entries').select('*').eq('vehicle_id', vehicleId).order('read_date', { ascending: false }),
      supabase.from('vehicle_replacement_value_entries').select('*').eq('vehicle_id', vehicleId).order('read_date', { ascending: false }),
      supabase.from('vehicle_service_events').select('*').eq('vehicle_id', vehicleId).order('service_date', { ascending: false }),
      supabase.from('vehicle_problem_reports').select('*').eq('vehicle_id', vehicleId).order('report_date', { ascending: false }),
    ])
    setPanelReadings((odoData ?? []) as FleetOdometerEntry[])
    setPanelValues((valData ?? []) as FleetValueEntry[])
    setPanelServiceEvents((svcData ?? []) as FleetServiceEvent[])
    setPanelProblems((probData2 ?? []) as FleetProblemReport[])
  }

  useEffect(() => {
    const t = setTimeout(() => loadFleet(), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (selectedVehicleId) {
      setLedgerFilter('all')
      setQuickOdoValue('')
      setQuickOdoDate(todayYmd())
      loadPanel(selectedVehicleId)
      setTimeout(() => quickOdoRef.current?.focus(), 50)
    } else {
      setPanelReadings([])
      setPanelValues([])
      setPanelServiceEvents([])
      setPanelProblems([])
    }
  }, [selectedVehicleId])

  async function saveQuickReading() {
    if (!selectedVehicleId || savingReading) return
    const val = parseOdometerInput(quickOdoValue)
    if (val == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    setSavingReading(true)
    const { error: err } = await supabase
      .from('vehicle_odometer_entries')
      .insert({ vehicle_id: selectedVehicleId, odometer_value: val, read_date: quickOdoDate, created_by: authUser?.id ?? null })
    setSavingReading(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setQuickOdoValue('')
    setQuickOdoDate(todayYmd())
    showToast('Odometer reading saved.', 'success')
    loadPanel(selectedVehicleId)
    loadFleet()
  }

  function openVehicleForm(v?: Vehicle) {
    setEditingVehicle(v ?? null)
    setVehicleYear(v?.year?.toString() ?? '')
    setVehicleMake(v?.make ?? '')
    setVehicleModel(v?.model ?? '')
    setVehicleVin(v?.vin ?? '')
    setVehicleInsCost(v?.weekly_insurance_cost?.toString() ?? '')
    setVehicleRegCost(v?.weekly_registration_cost?.toString() ?? '')
    setVehicleOilInterval((v?.oil_change_interval_miles ?? 5000).toString())
    setVehicleFormOpen(true)
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false)
    setEditingVehicle(null)
  }

  async function upsertVehicle() {
    const year = parseInt(vehicleYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      setError('Year must be 1900–2100')
      return
    }
    const ins = parseFloat(vehicleInsCost) || 0
    const reg = parseFloat(vehicleRegCost) || 0
    const interval = parseInt(vehicleOilInterval, 10)
    const payload = {
      year,
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      vin: vehicleVin.trim() || null,
      weekly_insurance_cost: ins,
      weekly_registration_cost: reg,
      oil_change_interval_miles: !isNaN(interval) && interval > 0 ? interval : 5000,
    }
    const { error: err } = editingVehicle
      ? await supabase.from('vehicles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingVehicle.id)
      : await supabase.from('vehicles').insert(payload)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    closeVehicleForm()
    loadFleet()
  }

  async function deleteVehicle(v: Vehicle) {
    if (!window.confirm(`Delete ${vehicleDisplayName(v)}? Its readings and history delete with it.`)) return
    const { error: err } = await supabase.from('vehicles').delete().eq('id', v.id)
    if (err) {
      setError(err.message)
      return
    }
    setSelectedVehicleId((prev) => (prev === v.id ? null : prev))
    loadFleet()
  }

  function openHandOff(v: Vehicle) {
    setHandOffVehicle(v)
    setHandOffUserId('')
    setHandOffDate(todayYmd())
    setHandOffOdometer('')
  }

  async function submitHandOff() {
    if (!handOffVehicle || handOffSaving) return
    if (!handOffUserId) {
      setError('Select the new holder')
      return
    }
    const odo = handOffOdometer.trim() ? parseOdometerInput(handOffOdometer) : null
    if (handOffOdometer.trim() && odo == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    const open = currentPossession(
      possessionsAll.filter((p) => p.vehicle_id === handOffVehicle.id),
      today,
    )
    const writes = handOffWrites({
      vehicleId: handOffVehicle.id,
      openPossession: open,
      toUserId: handOffUserId,
      dateYmd: handOffDate,
      odometer: odo,
      byUserId: authUser?.id ?? null,
    })
    setHandOffSaving(true)
    try {
      if (writes.endPossession) {
        const { error: err } = await supabase
          .from('vehicle_possessions')
          .update({ end_date: writes.endPossession.end_date })
          .eq('id', writes.endPossession.id)
        if (err) {
          setError(err.message)
          return
        }
      }
      const { error: insErr } = await supabase.from('vehicle_possessions').insert(writes.newPossession)
      if (insErr) {
        setError(insErr.message)
        return
      }
      if (writes.odometerEntry) {
        const { error: odoErr } = await supabase.from('vehicle_odometer_entries').insert(writes.odometerEntry)
        if (odoErr) {
          setError(odoErr.message)
          return
        }
      }
      setError(null)
      showToast(`Handed off to ${userNameById.get(handOffUserId) ?? 'new holder'}.`, 'success')
      setHandOffVehicle(null)
      loadFleet()
      if (selectedVehicleId) loadPanel(selectedVehicleId)
    } finally {
      setHandOffSaving(false)
    }
  }

  async function submitService() {
    if (!selectedVehicleId || serviceSaving) return
    const odo = serviceOdometer.trim() ? parseOdometerInput(serviceOdometer) : null
    if (serviceOdometer.trim() && odo == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    const cost = serviceCost.trim() ? parseFloat(serviceCost) : null
    if (serviceCost.trim() && (cost == null || isNaN(cost) || cost < 0)) {
      setError('Cost must be a non-negative number')
      return
    }
    setServiceSaving(true)
    try {
      const { error: err } = await supabase.from('vehicle_service_events').insert({
        vehicle_id: selectedVehicleId,
        service_type: serviceType,
        service_date: serviceDate,
        odometer_value: odo,
        cost: cost != null && !isNaN(cost) ? cost : null,
        note: serviceNote.trim() || null,
        created_by: authUser?.id ?? null,
      })
      if (err) {
        setError(err.message)
        return
      }
      if (odo != null) {
        // A service visit with miles is also a reading — feed the mileage history.
        await supabase
          .from('vehicle_odometer_entries')
          .insert({ vehicle_id: selectedVehicleId, odometer_value: odo, read_date: serviceDate, created_by: authUser?.id ?? null })
      }
      setError(null)
      setServiceFormOpen(false)
      showToast('Service logged.', 'success')
      loadPanel(selectedVehicleId)
      loadFleet()
    } finally {
      setServiceSaving(false)
    }
  }

  async function submitProblem() {
    if (!selectedVehicleId || problemSaving) return
    if (!problemDescription.trim()) {
      setError('Describe the problem first')
      return
    }
    setProblemSaving(true)
    const { error: err } = await supabase.from('vehicle_problem_reports').insert({
      vehicle_id: selectedVehicleId,
      description: problemDescription.trim(),
      severity: problemSeverity,
      report_date: todayYmd(),
      reported_by: authUser?.id ?? null,
    })
    setProblemSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setProblemFormOpen(false)
    setProblemDescription('')
    setProblemSeverity('needs_service')
    showToast('Problem reported.', 'success')
    loadPanel(selectedVehicleId)
    loadFleet()
  }

  async function submitResolve() {
    if (!resolvingProblem || resolveSaving) return
    setResolveSaving(true)
    const { error: err } = await supabase
      .from('vehicle_problem_reports')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: authUser?.id ?? null,
        resolution_note: resolutionNote.trim() || null,
      })
      .eq('id', resolvingProblem.id)
    setResolveSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setResolvingProblem(null)
    setResolutionNote('')
    showToast('Problem resolved.', 'success')
    if (selectedVehicleId) loadPanel(selectedVehicleId)
    loadFleet()
  }

  async function submitValueEntry() {
    if (!selectedVehicleId) return
    const val = parseFloat(valueAmount)
    if (isNaN(val) || val < 0) {
      setError('Replacement value must be a non-negative number')
      return
    }
    const { error: err } = await supabase
      .from('vehicle_replacement_value_entries')
      .insert({ vehicle_id: selectedVehicleId, replacement_value: val, read_date: valueDate })
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setValueFormOpen(false)
    setValueAmount('')
    setValueDate(todayYmd())
    loadPanel(selectedVehicleId)
  }

  async function deleteLedgerRow(kind: VehicleLedgerRowKind, sourceId: string) {
    const table =
      kind === 'reading'
        ? 'vehicle_odometer_entries'
        : kind === 'value'
          ? 'vehicle_replacement_value_entries'
          : kind === 'service'
            ? 'vehicle_service_events'
            : kind === 'problem' || kind === 'problem_resolved'
              ? 'vehicle_problem_reports'
              : 'vehicle_possessions'
    const { error: err } = await supabase.from(table).delete().eq('id', sourceId)
    if (err) {
      setError(err.message)
      return
    }
    if (selectedVehicleId) loadPanel(selectedVehicleId)
    loadFleet()
  }

  const ledgerRows = useMemo(() => {
    if (!selectedVehicleId) return []
    return buildVehicleLedger({
      readings: panelReadings,
      possessions: possessionsAll.filter((p) => p.vehicle_id === selectedVehicleId),
      valueEntries: panelValues,
      serviceEvents: panelServiceEvents,
      problemReports: panelProblems,
      userNameById,
    })
  }, [selectedVehicleId, panelReadings, panelValues, panelServiceEvents, panelProblems, possessionsAll, userNameById])

  const visibleLedgerRows = useMemo(
    () =>
      ledgerFilter === 'all'
        ? ledgerRows
        : ledgerRows.filter(
            (r) =>
              r.kind === ledgerFilter ||
              (ledgerFilter === 'handoff' && r.kind === 'return') ||
              (ledgerFilter === 'problem' && r.kind === 'problem_resolved'),
          ),
    [ledgerRows, ledgerFilter],
  )

  const chipStyle = (tone: 'plain' | 'amber' | 'red' | 'green'): React.CSSProperties => ({
    padding: '0.2rem 0.65rem',
    borderRadius: 999,
    fontSize: '0.8125rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background:
      tone === 'amber' ? 'var(--bg-amber-100)' : tone === 'red' ? 'var(--bg-red-100)' : tone === 'green' ? 'var(--bg-green-100)' : 'var(--bg-subtle)',
    color:
      tone === 'amber' ? 'var(--text-amber-800)' : tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)',
  })

  const oilChipToneFor = (state: string): 'plain' | 'amber' | 'red' | 'green' =>
    state === 'ok' ? 'green' : state === 'due_soon' ? 'amber' : state === 'overdue' ? 'red' : 'plain'

  const actionBtn: React.CSSProperties = {
    padding: '0.3rem 0.7rem',
    fontSize: '0.8125rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    background: 'var(--surface)',
    cursor: 'pointer',
  }

  function renderHolderRow(v: Vehicle) {
    const holder = holderByVehicle.get(v.id)
    const holderName = holder ? (userNameById.get(holder.user_id) ?? holder.user_id.slice(0, 8)) : null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.6rem 0' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: holderName ? 'var(--bg-sky-tint)' : 'var(--bg-amber-100)',
            color: holderName ? 'var(--text-link)' : 'var(--text-amber-800)',
          }}
        >
          {holderName ? initials(holderName) : '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: holderName ? undefined : 'var(--text-amber-800)' }}>
            {holderName ?? 'Unassigned'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {holder ? `since ${formatYmdShort(holder.start_date)}` : 'no current holder'}
          </div>
        </div>
        <button
          type="button"
          style={actionBtn}
          onClick={(e) => {
            e.stopPropagation()
            openHandOff(v)
          }}
        >
          {holder ? 'Hand off' : 'Assign'}
        </button>
      </div>
    )
  }

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Vehicles</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search vehicles or people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '0.45rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', minWidth: 200 }}
            />
            <button
              type="button"
              onClick={() => openVehicleForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Add Vehicle
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={chipStyle('plain')}>{summary.total} vehicle{summary.total === 1 ? '' : 's'}</span>
          {summary.unassigned > 0 && <span style={chipStyle('amber')}>{summary.unassigned} unassigned</span>}
          {summary.staleReadings > 0 && <span style={chipStyle('amber')}>{summary.staleReadings} need a reading</span>}
          {oilCounts.dueSoon > 0 && <span style={chipStyle('amber')}>{oilCounts.dueSoon} oil due soon</span>}
          {oilCounts.overdue > 0 && <span style={chipStyle('red')}>{oilCounts.overdue} oil overdue</span>}
          {(() => {
            const totalOpen = Object.values(openProblemsByVehicle).reduce((s, n) => s + n, 0)
            return totalOpen > 0 ? <span style={chipStyle('red')}>{totalOpen} open problem{totalOpen === 1 ? '' : 's'}</span> : null
          })()}
          {weeklyTotal > 0 && <span style={chipStyle('plain')}>${formatCurrency(weeklyTotal)}/wk ins+reg</span>}
        </div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : selectedVehicle ? (
          <div>
            <button
              type="button"
              onClick={() => setSelectedVehicleId(null)}
              style={{ ...actionBtn, marginBottom: '0.75rem' }}
            >
              ← All vehicles
            </button>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.0625rem', fontWeight: 600 }}>{vehicleDisplayName(selectedVehicle)}</span>
                  {selectedVehicle.vin && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>VIN {selectedVehicle.vin}</span>
                  )}
                  {(() => {
                    const holder = holderByVehicle.get(selectedVehicle.id)
                    const nm = holder ? (userNameById.get(holder.user_id) ?? '') : null
                    return nm ? (
                      <span style={{ ...chipStyle('plain'), background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }}>
                        {nm} · since {formatYmdShort(holder!.start_date)}
                      </span>
                    ) : (
                      <span style={chipStyle('amber')}>Unassigned</span>
                    )
                  })()}
                  {(() => {
                    const s = oilStatus(lastOilMap.get(selectedVehicle.id) ?? null, selectedVehicle.oil_change_interval_miles, latestMap.get(selectedVehicle.id) ?? null)
                    if (s.state === 'unknown') return null
                    return <span style={chipStyle(oilChipToneFor(s.state))}>{oilChipLabel(s)}</span>
                  })()}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button type="button" style={actionBtn} onClick={() => openHandOff(selectedVehicle)}>
                    {holderByVehicle.get(selectedVehicle.id) ? 'Hand off' : 'Assign'}
                  </button>
                  <button
                    type="button"
                    style={actionBtn}
                    onClick={() => {
                      setServiceType('oil_change')
                      setServiceDate(todayYmd())
                      setServiceOdometer('')
                      setServiceCost('')
                      setServiceNote('')
                      setServiceFormOpen(true)
                    }}
                  >
                    Log service
                  </button>
                  <button
                    type="button"
                    style={actionBtn}
                    onClick={() => {
                      setProblemDescription('')
                      setProblemSeverity('needs_service')
                      setProblemFormOpen(true)
                    }}
                  >
                    Report problem
                  </button>
                  <button type="button" style={actionBtn} onClick={() => { setValueFormOpen(true); setValueAmount(''); setValueDate(todayYmd()) }}>
                    Update value
                  </button>
                  <button type="button" style={actionBtn} onClick={() => openVehicleForm(selectedVehicle)}>Edit</button>
                  <button type="button" style={{ ...actionBtn, color: 'var(--text-red-700)' }} onClick={() => deleteVehicle(selectedVehicle)}>
                    Delete
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.7rem 0.9rem',
                  marginBottom: '0.9rem',
                  background: 'var(--bg-subtle)',
                }}
              >
                <div style={{ flex: '1 1 160px', minWidth: 150 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Current odometer</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(() => {
                      const latest = latestMap.get(selectedVehicle.id) ?? null
                      return latest
                        ? `last ${latest.odometer_value.toLocaleString()} mi · ${odometerAgeLabel(latest, today)}`
                        : 'no reading yet'
                    })()}
                  </div>
                </div>
                <input
                  ref={quickOdoRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="Miles"
                  value={quickOdoValue}
                  onChange={(e) => setQuickOdoValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveQuickReading()
                  }}
                  style={{ width: 110, padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                <input
                  type="date"
                  value={quickOdoDate}
                  onChange={(e) => setQuickOdoDate(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem' }}
                />
                <button
                  type="button"
                  onClick={saveQuickReading}
                  disabled={savingReading}
                  style={{
                    padding: '0.45rem 0.9rem',
                    background: savingReading ? '#9ca3af' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 500,
                    cursor: savingReading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingReading ? '…' : 'Save reading'}
                </button>
              </div>

              {(() => {
                const open = openProblems(panelProblems)
                if (open.length === 0) return null
                return (
                  <div style={{ marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-red-700)' }}>
                      Open problems ({open.length})
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {open.map((p, i) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.6rem',
                            padding: '0.6rem 0.9rem',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span
                            style={{
                              ...chipStyle(p.severity === 'urgent' ? 'red' : p.severity === 'monitor' ? 'plain' : 'amber'),
                              fontSize: '0.6875rem',
                              flexShrink: 0,
                            }}
                          >
                            {PROBLEM_SEVERITY_LABELS[p.severity] ?? p.severity}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div>{p.description}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {(p.reported_by ? (userNameById.get(p.reported_by) ?? '') : '') || 'Office'} · {formatYmdShort(p.report_date)}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={{ ...actionBtn, flexShrink: 0 }}
                            onClick={() => {
                              setResolutionNote('')
                              setResolvingProblem(p)
                            }}
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Ledger</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {LEDGER_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setLedgerFilter(f.key)}
                      style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        border: ledgerFilter === f.key ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                        background: ledgerFilter === f.key ? '#3b82f6' : 'var(--surface)',
                        color: ledgerFilter === f.key ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {visibleLedgerRows.length === 0 ? (
                  <p style={{ padding: '0.9rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Nothing here yet — save a reading above to start the ledger.
                  </p>
                ) : (
                  visibleLedgerRows.map((r, i) => (
                    <div
                      key={r.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.55rem 0.9rem',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', width: 88, flexShrink: 0, fontSize: '0.8125rem' }}>{formatYmdShort(r.dateYmd)}</span>
                      <span
                        style={{
                          ...chipStyle(
                            r.kind === 'problem' ? 'red' : r.kind === 'problem_resolved' || r.kind === 'service' ? 'green' : 'plain',
                          ),
                          fontSize: '0.6875rem',
                          ...(r.kind === 'handoff' || r.kind === 'return'
                            ? { background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }
                            : {}),
                        }}
                      >
                        {r.kind === 'reading'
                          ? 'Odometer'
                          : r.kind === 'value'
                            ? 'Value'
                            : r.kind === 'service'
                              ? 'Service'
                              : r.kind === 'problem'
                                ? 'Problem'
                                : r.kind === 'problem_resolved'
                                  ? 'Resolved'
                                  : 'Hand-off'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>{r.label}</span>
                      <span style={{ textAlign: 'right', width: 90, flexShrink: 0, color: r.odometer == null && r.amount == null ? 'var(--text-muted)' : undefined }}>
                        {r.odometer != null ? `${r.odometer.toLocaleString()} mi` : r.amount != null ? `$${formatCurrency(r.amount)}` : '—'}
                      </span>
                      {r.kind !== 'return' && r.kind !== 'problem_resolved' && (
                        <button
                          type="button"
                          onClick={() => deleteLedgerRow(r.kind, r.sourceId)}
                          title={r.kind === 'handoff' ? 'Delete this possession row' : r.kind === 'problem' ? 'Delete this problem report' : 'Delete this entry'}
                          style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.75rem' }}>
            {filteredVehicles.map((v) => {
              const latest = latestMap.get(v.id) ?? null
              const freshness = odometerFreshness(latest, today)
              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVehicleId(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedVehicleId(v.id)
                    }
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '0.8rem 0.95rem',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{vehicleDisplayName(v)}</span>
                    {vinTail(v.vin) && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{vinTail(v.vin)}</span>
                    )}
                  </div>
                  {renderHolderRow(v)}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: freshness === 'fresh' ? 'var(--text-muted)' : 'var(--text-amber-800)' }}>
                      {latest ? `${latest.odometer_value.toLocaleString()} mi · ${odometerAgeLabel(latest, today)}` : 'No reading yet'}
                    </span>
                    {freshness !== 'fresh' && <span style={chipStyle('amber')}>{freshness === 'none' ? 'needs first reading' : 'needs a reading'}</span>}
                    {(() => {
                      const s = oilStatus(lastOilMap.get(v.id) ?? null, v.oil_change_interval_miles, latest)
                      if (s.state === 'unknown') return null
                      return <span style={chipStyle(oilChipToneFor(s.state))}>{oilChipLabel(s)}</span>
                    })()}
                    {(openProblemsByVehicle[v.id] ?? 0) > 0 && (
                      <span style={chipStyle('red')}>
                        {openProblemsByVehicle[v.id]} problem{openProblemsByVehicle[v.id] === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredVehicles.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0, padding: '0.5rem 0' }}>
                {vehicles.length === 0 ? 'No vehicles yet. Add one to get started.' : 'No vehicles match the search.'}
              </p>
            )}
          </div>
        )}
      </div>

      {vehicleFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Year *</label>
              <input type="number" min={1900} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Make *</label>
              <input type="text" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Model *</label>
              <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>VIN</label>
              <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly insurance cost</label>
              <input type="number" min={0} step={0.01} value={vehicleInsCost} onChange={(e) => setVehicleInsCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Weekly registration cost</label>
              <input type="number" min={0} step={0.01} value={vehicleRegCost} onChange={(e) => setVehicleRegCost(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Oil change interval (miles)</label>
              <input type="number" min={500} step={500} value={vehicleOilInterval} onChange={(e) => setVehicleOilInterval(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={upsertVehicle} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={closeVehicleForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {handOffVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>
              {holderByVehicle.get(handOffVehicle.id) ? 'Hand off vehicle' : 'Assign vehicle'}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {vehicleDisplayName(handOffVehicle)}
              {(() => {
                const holder = holderByVehicle.get(handOffVehicle.id)
                const nm = holder ? userNameById.get(holder.user_id) : null
                return nm ? ` · currently ${nm}` : ' · currently unassigned'
              })()}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>New holder *</label>
              <select value={handOffUserId} onChange={(e) => setHandOffUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {[...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Hand-off date</label>
              <input type="date" value={handOffDate} onChange={(e) => setHandOffDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '0.35rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Odometer at hand-off</label>
              <input
                type="text"
                inputMode="numeric"
                value={handOffOdometer}
                onChange={(e) => setHandOffOdometer(e.target.value)}
                placeholder="Optional"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {holderByVehicle.get(handOffVehicle.id)
                ? 'Ends the current possession on the hand-off date and saves the reading.'
                : 'Starts the possession on the hand-off date and saves the reading.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setHandOffVehicle(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitHandOff}
                disabled={handOffSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: handOffSaving ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: handOffSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {handOffSaving ? '…' : holderByVehicle.get(handOffVehicle.id) ? 'Hand off' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {serviceFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0 }}>Log service</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Service type</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{key === 'other' ? 'Other' : label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '0.35rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Odometer at service</label>
              <input
                type="text"
                inputMode="numeric"
                value={serviceOdometer}
                onChange={(e) => setServiceOdometer(e.target.value)}
                placeholder={serviceType === 'oil_change' ? 'Needed for oil-due tracking' : 'Optional'}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Also saves as an odometer reading.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Cost ($)</label>
              <input type="number" min={0} step={0.01} value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={serviceNote} onChange={(e) => setServiceNote(e.target.value)} placeholder="e.g. Take 5, Bandera Rd" style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setServiceFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitService}
                disabled={serviceSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: serviceSaving ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: serviceSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {serviceSaving ? '…' : 'Log service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {problemFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>Report a problem</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>What's wrong? *</label>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="e.g. brakes grinding on front left, worse when loaded"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', font: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Severity</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {Object.entries(PROBLEM_SEVERITY_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProblemSeverity(key)}
                    style={{
                      padding: '0.3rem 0.8rem',
                      borderRadius: 999,
                      fontSize: '0.8125rem',
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
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setProblemFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitProblem}
                disabled={problemSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: problemSaving ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: problemSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {problemSaving ? '…' : 'Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolvingProblem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 400 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Resolve problem</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{resolvingProblem.description}</p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>How was it fixed? (optional)</label>
              <input
                type="text"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. new pads with the May service visit"
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setResolvingProblem(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitResolve}
                disabled={resolveSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: resolveSaving ? '#9ca3af' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: resolveSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {resolveSaving ? '…' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {valueFormOpen && selectedVehicleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
            <h3 style={{ marginTop: 0 }}>Update replacement value</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Value ($)</label>
              <input type="number" min={0} step={0.01} value={valueAmount} onChange={(e) => setValueAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitValueEntry} style={{ padding: '0.5rem 1rem' }}>Save</button>
              <button type="button" onClick={() => setValueFormOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
