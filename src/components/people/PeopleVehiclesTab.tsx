import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchUserDisplayNames, missingUserIds, userDisplayLabel } from '../../lib/userDisplayNames'
import { formatCurrency } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { PeopleVehiclesWheelsSection } from './PeopleVehiclesWheelsSection'
import {
  DEFAULT_VEHICLE_CHECKIN_SETTINGS,
  fetchVehicleCheckinSettings,
  parseVehicleCheckinAnswers,
  checkinLedgerBody,
  saveVehicleCheckinSettings,
  type VehicleCheckinSettings,
} from '../../lib/vehicleCheckinSettings'
import {
  buildVehicleLedger,
  currentInsurancePeriod,
  currentPossession,
  fleetOilCounts,
  isMotorPoolPossession,
  lastEndedInsurancePeriod,
  maintenanceChecklistTitle,
  maintenanceTaskCounts,
  MOTOR_POOL_LABEL,
  oilThresholdsForVehicle,
  openMaintenanceTasks,
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
  type FleetInsurancePeriod,
  type FleetInsurancePlan,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetProblemReport,
  type FleetServiceEvent,
  type FleetValueEntry,
  type VehicleLedgerRowKind,
  type VehicleMaintenanceTask,
  type MaintenanceChecklistLinkIds,
  resolveChecklistCleanupIds,
} from '../../lib/vehicleFleet'
import { getNextDisplayOrders } from '../../utils/checklistOrder'
import { ChecklistItemActivity } from '../checklist/ChecklistItemActivity'
import { readingCatchUpRows, type ReadingCatchUpRow } from '../../lib/vehicleCatchUp'
import { VehicleReadingsCatchUpModal, VehicleTasksCatchUpModal } from './VehicleCatchUpModals'
import { VehiclesFleetSummary } from './VehiclesFleetSummary'
import { buildFleetAttentionItems, fleetFactsLine } from '../../lib/vehicleFleetAttention'
import {
  INSURANCE_COST_UNITS,
  effectiveWeeklyInsuranceCost,
  formatInsuranceCostLine,
  insurancePlanTotals,
  weeklyInsuranceCostFromInput,
  type InsuranceCostUnit,
} from '../../lib/vehicleInsuranceCost'
import { VehicleOdometerHistoryModal } from './VehicleOdometerHistoryModal'

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
  trim?: string | null
  vin: string | null
  weekly_insurance_cost: number
  weekly_registration_cost: number
  oil_change_interval_miles?: number | null
  oil_suggest_window_miles?: number | null
  oil_require_past_due_miles?: number | null
}

type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

/** vehicle_checkins row as read for the selected vehicle's ledger (v2.2199). */
type PanelCheckin = { id: string; checkin_date: string; answers: unknown; created_by: string | null }

export type PeopleVehiclesTabProps = {
  users: UserRow[]
}

const LEDGER_FILTERS: Array<{ key: 'all' | VehicleLedgerRowKind; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'reading', label: 'Odometer' },
  { key: 'service', label: 'Service' },
  { key: 'problem', label: 'Problems' },
  { key: 'checkin', label: 'Check-ins' },
  { key: 'handoff', label: 'Holders' },
  { key: 'insurance_on', label: 'Insurance' },
  { key: 'value', label: 'Value' },
]

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Sentinel value for the hand-off select's "Motor pool" destination. */
const MOTOR_POOL_OPTION = '__motor_pool__'

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
  const confirmDialog = useConfirmDialog()
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
  const [vehicleTrim, setVehicleTrim] = useState('')
  const [vehicleVin, setVehicleVin] = useState('')
  /** Insurance card (v2.2180): cost typed in the carrier's unit, stored weekly. */
  const [insCostDraft, setInsCostDraft] = useState('')
  const [insCostUnit, setInsCostUnit] = useState<InsuranceCostUnit>('mo')
  const [insCostSaving, setInsCostSaving] = useState(false)
  const [vehicleRegCost, setVehicleRegCost] = useState('')

  const [handOffVehicle, setHandOffVehicle] = useState<Vehicle | null>(null)
  const [handOffUserId, setHandOffUserId] = useState('')
  const [handOffDate, setHandOffDate] = useState(todayYmd)
  const [handOffOdometer, setHandOffOdometer] = useState('')
  const [handOffSaving, setHandOffSaving] = useState(false)

  const [insurancePlans, setInsurancePlans] = useState<FleetInsurancePlan[]>([])
  const [insurancePeriodsAll, setInsurancePeriodsAll] = useState<FleetInsurancePeriod[]>([])
  const [plansOpen, setPlansOpen] = useState(false)
  const [checkinSettingsOpen, setCheckinSettingsOpen] = useState(false)
  const [checkinSettingsDraft, setCheckinSettingsDraft] = useState<VehicleCheckinSettings>(DEFAULT_VEHICLE_CHECKIN_SETTINGS)
  const [checkinSettingsSaving, setCheckinSettingsSaving] = useState(false)
  const [panelCheckins, setPanelCheckins] = useState<PanelCheckin[]>([])
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<FleetInsurancePlan | null>(null)
  const [planName, setPlanName] = useState('')
  const [planCarrier, setPlanCarrier] = useState('')
  const [planPolicy, setPlanPolicy] = useState('')
  const [planRenewal, setPlanRenewal] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [planSaving, setPlanSaving] = useState(false)
  const [insVehicle, setInsVehicle] = useState<Vehicle | null>(null)
  const [insPlanId, setInsPlanId] = useState('')
  const [insStartDate, setInsStartDate] = useState(todayYmd)
  const [insSaving, setInsSaving] = useState(false)
  const [takeOffPeriod, setTakeOffPeriod] = useState<FleetInsurancePeriod | null>(null)
  const [takeOffVehicleName, setTakeOffVehicleName] = useState('')
  const [takeOffDate, setTakeOffDate] = useState(todayYmd)
  const [takeOffSaving, setTakeOffSaving] = useState(false)

  const [maintenanceTasksAll, setMaintenanceTasksAll] = useState<VehicleMaintenanceTask[]>([])
  // Task edit + activity spine (v2.2102): same tap-to-expand notes thread as
  // the checklist screens for assigned tasks; Edit covers title + note.
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  // Catch-up modals behind the summary chips (v2.2106). Reading rows snapshot
  // at open so saved rows stay visible (green) instead of vanishing as they
  // turn fresh; saves overlay via catchUpSaved.
  const [readingsCatchUp, setReadingsCatchUp] = useState<ReadingCatchUpRow[] | null>(null)
  const [catchUpSaved, setCatchUpSaved] = useState<Record<string, number>>({})
  const [catchUpSavingId, setCatchUpSavingId] = useState<string | null>(null)
  const [tasksCatchUpOpen, setTasksCatchUpOpen] = useState(false)
  /** Odometer history sheet (v2.2172): the vehicle whose reading line was tapped. */
  const [odoHistoryVehicleId, setOdoHistoryVehicleId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<VehicleMaintenanceTask | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskNote, setEditTaskNote] = useState('')
  const [editTaskSaving, setEditTaskSaving] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [assignTask, setAssignTask] = useState<VehicleMaintenanceTask | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignDue, setAssignDue] = useState(todayYmd)
  const [assignNotify, setAssignNotify] = useState(true)
  const [assignSaving, setAssignSaving] = useState(false)

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
  const [vehicleOilSuggestWindow, setVehicleOilSuggestWindow] = useState('')
  const [vehicleOilRequirePastDue, setVehicleOilRequirePastDue] = useState('')

  /** Names for possession/reading users outside the roster prop (archived crew — v2.1652). */
  const [extraNames, setExtraNames] = useState<Record<string, string>>({})
  const userNameById = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.name ?? '']))
    for (const [id, name] of Object.entries(extraNames)) {
      if (!m.has(id)) m.set(id, name)
    }
    return m
  }, [users, extraNames])
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

  const insuranceByVehicle = useMemo(() => {
    const m = new Map<string, FleetInsurancePeriod>()
    for (const v of vehicles) {
      const p = currentInsurancePeriod(
        insurancePeriodsAll.filter((x) => x.vehicle_id === v.id),
        today,
      )
      if (p) m.set(v.id, p)
    }
    return m
  }, [vehicles, insurancePeriodsAll, today])

  const planNameById = useMemo(() => new Map(insurancePlans.map((p) => [p.id, p.name])), [insurancePlans])

  const uninsuredCount = useMemo(
    () => vehicles.filter((v) => !insuranceByVehicle.get(v.id)).length,
    [vehicles, insuranceByVehicle],
  )

  const taskCounts = useMemo(() => maintenanceTaskCounts(maintenanceTasksAll), [maintenanceTasksAll])
  const openTaskTotal = useMemo(() => {
    let n = 0
    for (const c of taskCounts.values()) n += c.open
    return n
  }, [taskCounts])

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

  // v2.2180 (D5): insurance counts only while the vehicle sits on a plan; registration always.
  const weeklyTotal = useMemo(
    () =>
      vehicles.reduce(
        (s, v) =>
          s + effectiveWeeklyInsuranceCost(v.weekly_insurance_cost, insuranceByVehicle.has(v.id)) + (v.weekly_registration_cost ?? 0),
        0,
      ),
    [vehicles, insuranceByVehicle],
  )

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        const holder = holderByVehicle.get(v.id)
        const holderName = holder
          ? holder.user_id
            ? (userNameById.get(holder.user_id) ?? null)
            : MOTOR_POOL_LABEL
          : null
        return vehicleMatchesSearch(v, holderName, search)
      }),
    [vehicles, holderByVehicle, userNameById, search],
  )

  /** Active = a person is using it; Inactive = motor pool or unassigned. */
  const activeVehicles = useMemo(
    () =>
      filteredVehicles.filter((v) => {
        const h = holderByVehicle.get(v.id)
        return h != null && !isMotorPoolPossession(h)
      }),
    [filteredVehicles, holderByVehicle],
  )
  const inactiveVehicles = useMemo(
    () =>
      filteredVehicles.filter((v) => {
        const h = holderByVehicle.get(v.id)
        return h == null || isMotorPoolPossession(h)
      }),
    [filteredVehicles, holderByVehicle],
  )

  const selectedVehicle = selectedVehicleId ? (vehicles.find((v) => v.id === selectedVehicleId) ?? null) : null

  function resolveExtraNames(ids: Array<string | null | undefined>) {
    const rosterIds = new Set(users.map((u) => u.id))
    const unresolved = missingUserIds(ids.filter((id): id is string => !!id), rosterIds)
    if (unresolved.length === 0) return
    void fetchUserDisplayNames(unresolved).then((resolved) => {
      if (resolved.length === 0) return
      setExtraNames((prev) => {
        const next = { ...prev }
        for (const n of resolved) next[n.id] = userDisplayLabel(n)
        return next
      })
    })
  }

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
    // Plans load regardless of fleet size — the manager works with zero vehicles.
    const { data: plansData } = await supabase.from('vehicle_insurance_plans').select('*').order('name')
    setInsurancePlans((plansData ?? []) as FleetInsurancePlan[])
    const ids = list.map((v) => v.id)
    if (ids.length === 0) {
      setPossessionsAll([])
      setLatestByVehicle({})
      setInsurancePeriodsAll([])
      setMaintenanceTasksAll([])
      return
    }
    const [{ data: possData }, { data: odoData }, { data: oilData }, { data: probData }, { data: insData }, { data: taskData }] = await Promise.all([
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
      supabase
        .from('vehicle_insurance_periods')
        .select('*')
        .in('vehicle_id', ids)
        .order('start_date', { ascending: false })
        .limit(2000),
      supabase
        .from('vehicle_maintenance_tasks')
        .select('*')
        .in('vehicle_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000),
    ])
    setInsurancePeriodsAll((insData ?? []) as FleetInsurancePeriod[])
    setMaintenanceTasksAll((taskData ?? []) as VehicleMaintenanceTask[])
    const probCounts: Record<string, number> = {}
    for (const [vid, n] of openProblemCounts((probData ?? []) as FleetProblemReport[])) probCounts[vid] = n
    setOpenProblemsByVehicle(probCounts)
    setPossessionsAll((possData ?? []) as FleetPossession[])
    // Possession/reading history references archived crew invisible to the
    // roster prop (users SELECT policy) — resolve their names via the
    // display-name RPC so holders and ledger rows never show a raw id (v2.1652).
    resolveExtraNames([
      ...((possData ?? []) as FleetPossession[]).map((p) => p.user_id),
      ...((odoData ?? []) as FleetOdometerEntry[]).map((e) => e.created_by ?? ''),
    ])
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
    // Check-in history (v2.2199) — fail-soft while the table hasn't been migrated yet.
    let checkins: PanelCheckin[] = []
    try {
      const { data: ciData, error: ciErr } = await supabase
        .from('vehicle_checkins')
        .select('id, checkin_date, answers, created_by')
        .eq('vehicle_id', vehicleId)
        .order('checkin_date', { ascending: false })
      if (!ciErr) checkins = (ciData ?? []) as unknown as PanelCheckin[]
    } catch {
      checkins = []
    }
    setPanelCheckins(checkins)
    resolveExtraNames([
      ...((odoData ?? []) as FleetOdometerEntry[]).map((e) => e.created_by),
      ...((probData2 ?? []) as FleetProblemReport[]).map((p) => p.reported_by),
      ...checkins.map((c) => c.created_by),
    ])
  }

  useEffect(() => {
    const t = setTimeout(() => loadFleet(), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once load; name resolution re-runs via resolveExtraNames on each load
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
      setPanelCheckins([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only on vehicle switch
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
    setVehicleTrim(v?.trim ?? '')
    setVehicleVin(v?.vin ?? '')
    setVehicleRegCost(v?.weekly_registration_cost?.toString() ?? '')
    setVehicleOilInterval((v?.oil_change_interval_miles ?? 5000).toString())
    setVehicleOilSuggestWindow((v?.oil_suggest_window_miles ?? 1000).toString())
    setVehicleOilRequirePastDue((v?.oil_require_past_due_miles ?? 0).toString())
    setVehicleFormOpen(true)
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false)
    setEditingVehicle(null)
  }

  // Escape closes the vehicle form — small viewports could once clip both
  // buttons with no way out (v2.1671).
  useEffect(() => {
    if (!vehicleFormOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVehicleForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeVehicleForm is stable state-setters only
  }, [vehicleFormOpen])

  async function upsertVehicle() {
    const year = parseInt(vehicleYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      setError('Year must be 1900–2100')
      return
    }
    const reg = parseFloat(vehicleRegCost) || 0
    const interval = parseInt(vehicleOilInterval, 10)
    const suggestWindow = parseInt(vehicleOilSuggestWindow, 10)
    const requirePastDue = parseInt(vehicleOilRequirePastDue, 10)
    const payload = {
      year,
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      trim: vehicleTrim.trim() || null,
      vin: vehicleVin.trim() || null,
      // Insurance cost is set on the vehicle's Insurance card (v2.2180), not here.
      weekly_registration_cost: reg,
      oil_change_interval_miles: !isNaN(interval) && interval > 0 ? interval : 5000,
      oil_suggest_window_miles: !isNaN(suggestWindow) && suggestWindow >= 0 ? suggestWindow : 1000,
      oil_require_past_due_miles: !isNaN(requirePastDue) && requirePastDue >= 0 ? requirePastDue : 0,
    }
    const { error: err } = editingVehicle
      ? await supabase.from('vehicles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingVehicle.id)
      : await supabase.from('vehicles').insert({ ...payload, weekly_insurance_cost: 0 })
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    closeVehicleForm()
    loadFleet()
  }

  async function deleteVehicle(v: Vehicle) {
    if (!(await confirmDialog({ message: `Delete ${vehicleDisplayName(v)}? Its readings and history delete with it.`, confirmLabel: 'Delete', danger: true }))) return
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
    const toUserId = handOffUserId === MOTOR_POOL_OPTION ? null : handOffUserId
    const open = currentPossession(
      possessionsAll.filter((p) => p.vehicle_id === handOffVehicle.id),
      today,
    )
    const writes = handOffWrites({
      vehicleId: handOffVehicle.id,
      openPossession: open,
      toUserId,
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
      showToast(
        toUserId ? `Handed off to ${userNameById.get(toUserId) ?? 'new holder'}.` : 'Parked in the motor pool.',
        'success',
      )
      setHandOffVehicle(null)
      loadFleet()
      if (selectedVehicleId) loadPanel(selectedVehicleId)
    } finally {
      setHandOffSaving(false)
    }
  }

  function openPlanForm(p?: FleetInsurancePlan) {
    setEditingPlan(p ?? null)
    setPlanName(p?.name ?? '')
    setPlanCarrier(p?.carrier ?? '')
    setPlanPolicy(p?.policy_number ?? '')
    setPlanRenewal(p?.renewal_date ?? '')
    setPlanNote(p?.note ?? '')
    setPlanFormOpen(true)
  }

  async function savePlan() {
    if (planSaving) return
    if (!planName.trim()) {
      setError('Name the plan first')
      return
    }
    const payload = {
      name: planName.trim(),
      carrier: planCarrier.trim() || null,
      policy_number: planPolicy.trim() || null,
      renewal_date: planRenewal || null,
      note: planNote.trim() || null,
    }
    setPlanSaving(true)
    const { error: err } = editingPlan
      ? await supabase.from('vehicle_insurance_plans').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingPlan.id)
      : await supabase.from('vehicle_insurance_plans').insert(payload)
    setPlanSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setPlanFormOpen(false)
    setEditingPlan(null)
    showToast(editingPlan ? 'Plan updated.' : 'Plan added.', 'success')
    loadFleet()
  }

  async function deletePlan(p: FleetInsurancePlan) {
    if (!(await confirmDialog({ message: `Delete plan "${p.name}"? Its coverage history deletes with it.`, confirmLabel: 'Delete', danger: true }))) return
    const { error: err } = await supabase.from('vehicle_insurance_plans').delete().eq('id', p.id)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    loadFleet()
  }

  /** Insurance card (v2.2180): store the typed amount as weekly cents; the local list updates in place. */
  async function saveInsuranceCost() {
    if (!selectedVehicle || insCostSaving) return
    const weekly = weeklyInsuranceCostFromInput(insCostDraft, insCostUnit)
    if (weekly == null) {
      setError('Enter the insurance cost as a number')
      return
    }
    setInsCostSaving(true)
    const { error: err } = await supabase
      .from('vehicles')
      .update({ weekly_insurance_cost: weekly, updated_at: new Date().toISOString() })
      .eq('id', selectedVehicle.id)
    setInsCostSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    const id = selectedVehicle.id
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, weekly_insurance_cost: weekly } : v)))
    setInsCostDraft('')
  }

  function openAddToPlan(v: Vehicle) {
    const cur = insuranceByVehicle.get(v.id)
    setInsVehicle(v)
    setInsPlanId(cur?.plan_id ?? insurancePlans[0]?.id ?? '')
    setInsStartDate(todayYmd())
  }

  async function submitAddToPlan() {
    if (!insVehicle || insSaving) return
    if (!insPlanId) {
      setError('Select a plan')
      return
    }
    const open = currentInsurancePeriod(
      insurancePeriodsAll.filter((p) => p.vehicle_id === insVehicle.id),
      today,
    )
    setInsSaving(true)
    try {
      if (open) {
        // Plan change: close the current coverage on the new start date.
        const { error: endErr } = await supabase
          .from('vehicle_insurance_periods')
          .update({ end_date: insStartDate })
          .eq('id', open.id)
        if (endErr) {
          setError(endErr.message)
          return
        }
      }
      const { error: insErr } = await supabase.from('vehicle_insurance_periods').insert({
        vehicle_id: insVehicle.id,
        plan_id: insPlanId,
        start_date: insStartDate,
        created_by: authUser?.id ?? null,
      })
      if (insErr) {
        setError(insErr.message)
        return
      }
      setError(null)
      showToast(`Added to ${planNameById.get(insPlanId) ?? 'plan'}.`, 'success')
      setInsVehicle(null)
      loadFleet()
    } finally {
      setInsSaving(false)
    }
  }

  async function addMaintenanceTask(vehicleId: string, title: string, sourceProblemReportId?: string) {
    const t = title.trim()
    if (!t || taskSaving) return
    setTaskSaving(true)
    const { error: err } = await supabase.from('vehicle_maintenance_tasks').insert({
      vehicle_id: vehicleId,
      title: t,
      source_problem_report_id: sourceProblemReportId ?? null,
      created_by: authUser?.id ?? null,
    })
    setTaskSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setNewTaskTitle('')
    showToast('Task added.', 'success')
    loadFleet()
  }

  /**
   * Local task state can predate an assignment made this same page session
   * (both checklist ids null in memory while the DB row has them), which used
   * to orphan the assignee's checklist row on delete. Re-read the row before
   * any checklist cleanup; local state is only the fallback if the read fails.
   */
  async function fetchChecklistLinkIds(t: VehicleMaintenanceTask): Promise<MaintenanceChecklistLinkIds> {
    const { data } = await supabase
      .from('vehicle_maintenance_tasks')
      .select('checklist_item_id, checklist_instance_id')
      .eq('id', t.id)
      .maybeSingle()
    return resolveChecklistCleanupIds((data as MaintenanceChecklistLinkIds | null) ?? null, t)
  }

  async function completeMaintenanceTask(t: VehicleMaintenanceTask, opts?: { skipServiceNudge?: boolean }) {
    const links = await fetchChecklistLinkIds(t)
    const nowIso = new Date().toISOString()
    const { error: err } = await supabase
      .from('vehicle_maintenance_tasks')
      .update({ completed_at: nowIso, completed_by: authUser?.id ?? null })
      .eq('id', t.id)
    if (err) {
      setError(err.message)
      return
    }
    if (links.checklist_instance_id) {
      // Clear it off the assignee's checklist too (the trigger only syncs the
      // other direction).
      await supabase
        .from('checklist_instances')
        .update({ completed_at: nowIso, completed_by_user_id: authUser?.id ?? null })
        .eq('id', links.checklist_instance_id)
    }
    setError(null)
    showToast('Task done.', 'success')
    loadFleet()
    // The skippable "log it as a service?" nudge — prefilled, Cancel to skip.
    // Suppressed from the catch-up modal, where a second modal would stack.
    if (opts?.skipServiceNudge) return
    setServiceType('repair')
    setServiceDate(todayYmd())
    setServiceOdometer('')
    setServiceCost('')
    setServiceNote(t.title)
    setServiceFormOpen(true)
  }

  function openReadingsCatchUp() {
    setCatchUpSaved({})
    setReadingsCatchUp(readingCatchUpRows(vehicles, holderByVehicle, latestMap, today))
  }

  async function saveCatchUpReading(vehicleId: string, raw: string) {
    const val = parseOdometerInput(raw)
    if (val == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    setCatchUpSavingId(vehicleId)
    const { error: err } = await supabase
      .from('vehicle_odometer_entries')
      .insert({ vehicle_id: vehicleId, odometer_value: val, read_date: todayYmd(), created_by: authUser?.id ?? null })
    setCatchUpSavingId(null)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setCatchUpSaved((s) => ({ ...s, [vehicleId]: val }))
    loadFleet()
  }

  function openTaskEdit(t: VehicleMaintenanceTask) {
    setEditTask(t)
    setEditTaskTitle(t.title)
    setEditTaskNote(t.note ?? '')
  }

  async function saveTaskEdit() {
    if (!editTask) return
    const title = editTaskTitle.trim()
    if (!title) return
    setEditTaskSaving(true)
    try {
      const { error: upErr } = await supabase
        .from('vehicle_maintenance_tasks')
        .update({ title, note: editTaskNote.trim() || null })
        .eq('id', editTask.id)
      if (upErr) throw upErr
      // Keep the assignee's checklist copy reading the same (title format is
      // "<vehicle> — <task> {{1:vehicle}}").
      if (editTask.checklist_item_id) {
        const v = vehicles.find((x) => x.id === editTask.vehicle_id)
        await supabase
          .from('checklist_items')
          .update({ title: maintenanceChecklistTitle(v ? vehicleDisplayName(v) : 'Vehicle', title) })
          .eq('id', editTask.checklist_item_id)
      }
      setEditTask(null)
      setError(null)
      showToast('Task updated.', 'success')
      loadFleet()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setEditTaskSaving(false)
    }
  }

  async function deleteMaintenanceTask(t: VehicleMaintenanceTask) {
    // Fetched before the confirm so the "comes off the checklist" warning is
    // accurate even when the assignment happened this session.
    const links = await fetchChecklistLinkIds(t)
    if (
      !(await confirmDialog({
        message: `Delete task "${t.title}"?${links.checklist_instance_id ? ' It also comes off the assignee’s checklist.' : ''}`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    // Best-effort cleanup of the linked checklist rows first.
    if (links.checklist_instance_id) await supabase.from('checklist_instances').delete().eq('id', links.checklist_instance_id)
    if (links.checklist_item_id) await supabase.from('checklist_items').delete().eq('id', links.checklist_item_id)
    const { error: err } = await supabase.from('vehicle_maintenance_tasks').delete().eq('id', t.id)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    loadFleet()
  }

  function openAssignTask(t: VehicleMaintenanceTask) {
    setAssignTask(t)
    setAssignUserId(t.assigned_user_id ?? '')
    setAssignDue(t.due_date ?? todayYmd())
    setAssignNotify(true)
  }

  async function submitAssignTask() {
    if (!assignTask || assignSaving || !authUser?.id) return
    if (!assignUserId) {
      setError('Select who does it')
      return
    }
    const vehicle = vehicles.find((v) => v.id === assignTask.vehicle_id)
    setAssignSaving(true)
    try {
      // Reassignment replaces the old checklist rows.
      const links = await fetchChecklistLinkIds(assignTask)
      if (links.checklist_instance_id) await supabase.from('checklist_instances').delete().eq('id', links.checklist_instance_id)
      if (links.checklist_item_id) await supabase.from('checklist_items').delete().eq('id', links.checklist_item_id)
      // The Checklist Forward pattern: one-off item + assignee + instance.
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: maintenanceChecklistTitle(vehicle ? vehicleDisplayName(vehicle) : 'Vehicle', assignTask.title),
          created_by_user_id: authUser.id,
          repeat_type: 'once',
          start_date: assignDue,
          show_until_completed: true,
          notify_on_complete_user_id: assignNotify ? authUser.id : null,
          links: ['/people?tab=vehicles'],
        })
        .select('id')
        .single()
      if (itemErr) throw itemErr
      const itemId = (newItem as { id: string } | null)?.id
      if (!itemId) throw new Error('Checklist item was not created')
      const nextOrders = await getNextDisplayOrders([assignUserId])
      await supabase.from('checklist_item_assignees').insert({
        checklist_item_id: itemId,
        user_id: assignUserId,
        display_order: nextOrders.get(assignUserId) ?? 1,
      })
      const { data: newInst, error: instErr } = await supabase
        .from('checklist_instances')
        .insert({ checklist_item_id: itemId, scheduled_date: assignDue })
        .select('id')
        .single()
      if (instErr) throw instErr
      const instId = (newInst as { id: string } | null)?.id
      if (instId) {
        await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: instId, user_id: assignUserId })
      }
      const { error: taskErr } = await supabase
        .from('vehicle_maintenance_tasks')
        .update({
          checklist_item_id: itemId,
          checklist_instance_id: instId ?? null,
          assigned_user_id: assignUserId,
          due_date: assignDue,
        })
        .eq('id', assignTask.id)
      if (taskErr) throw taskErr
      setError(null)
      showToast(`Assigned to ${userNameById.get(assignUserId) ?? 'assignee'} — it's on their checklist.`, 'success')
      setAssignTask(null)
      loadFleet()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAssignSaving(false)
    }
  }

  function openTakeOff(period: FleetInsurancePeriod, vehicleName: string) {
    setTakeOffPeriod(period)
    setTakeOffVehicleName(vehicleName)
    setTakeOffDate(todayYmd())
  }

  async function submitTakeOff() {
    if (!takeOffPeriod || takeOffSaving) return
    setTakeOffSaving(true)
    const { error: err } = await supabase
      .from('vehicle_insurance_periods')
      .update({ end_date: takeOffDate })
      .eq('id', takeOffPeriod.id)
    setTakeOffSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setTakeOffPeriod(null)
    showToast('Taken off insurance.', 'success')
    loadFleet()
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

  const isDev = useMemo(() => users.find((u) => u.id === authUser?.id)?.role === 'dev', [users, authUser?.id])

  async function openCheckinSettings() {
    setCheckinSettingsDraft(await fetchVehicleCheckinSettings())
    setCheckinSettingsOpen(true)
  }

  async function saveCheckinSettings() {
    if (checkinSettingsSaving) return
    setCheckinSettingsSaving(true)
    try {
      await saveVehicleCheckinSettings(checkinSettingsDraft)
      setCheckinSettingsOpen(false)
      showToast('Check-in settings saved.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCheckinSettingsSaving(false)
    }
  }

  async function deleteLedgerRow(kind: VehicleLedgerRowKind, sourceId: string) {
    if (kind === 'checkin') {
      const { error: err } = await supabase.from('vehicle_checkins').delete().eq('id', sourceId)
      if (err) {
        setError(err.message)
        return
      }
      if (selectedVehicleId) loadPanel(selectedVehicleId)
      return
    }
    const table =
      kind === 'reading'
        ? 'vehicle_odometer_entries'
        : kind === 'value'
          ? 'vehicle_replacement_value_entries'
          : kind === 'service'
            ? 'vehicle_service_events'
            : kind === 'problem' || kind === 'problem_resolved'
              ? 'vehicle_problem_reports'
              : kind === 'insurance_on' || kind === 'insurance_off'
                ? 'vehicle_insurance_periods'
                : kind === 'task_done'
                  ? 'vehicle_maintenance_tasks'
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
      insurancePeriods: insurancePeriodsAll.filter((p) => p.vehicle_id === selectedVehicleId),
      planNameById,
      maintenanceTasks: maintenanceTasksAll.filter((t) => t.vehicle_id === selectedVehicleId),
      userNameById,
      checkins: panelCheckins.map((c) => {
        const body = checkinLedgerBody(parseVehicleCheckinAnswers(c.answers))
        const by = c.created_by ? (userNameById.get(c.created_by) ?? null) : null
        const what = body.allClear
          ? 'Check-in · all clear'
          : `⚠ Check-in · ${body.flaggedLines.join(' · ')} · problem report filed`
        return { id: c.id, checkin_date: c.checkin_date, label: by ? `${what} — by ${by}` : what }
      }),
    })
  }, [selectedVehicleId, panelReadings, panelValues, panelServiceEvents, panelProblems, panelCheckins, possessionsAll, insurancePeriodsAll, planNameById, maintenanceTasksAll, userNameById])

  const visibleLedgerRows = useMemo(
    () =>
      ledgerFilter === 'all'
        ? ledgerRows
        : ledgerRows.filter(
            (r) =>
              r.kind === ledgerFilter ||
              (ledgerFilter === 'handoff' && r.kind === 'return') ||
              (ledgerFilter === 'problem' && r.kind === 'problem_resolved') ||
              (ledgerFilter === 'insurance_on' && r.kind === 'insurance_off') ||
              (ledgerFilter === 'service' && r.kind === 'task_done'),
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
    const inPool = holder != null && isMotorPoolPossession(holder)
    const holderName = holder?.user_id ? (userNameById.get(holder.user_id) ?? holder.user_id.slice(0, 8)) : null
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
            background: holderName ? 'var(--bg-sky-tint)' : inPool ? 'var(--bg-subtle)' : 'var(--bg-amber-100)',
            color: holderName ? 'var(--text-link)' : inPool ? 'var(--text-muted)' : 'var(--text-amber-800)',
          }}
        >
          {holderName ? initials(holderName) : inPool ? 'P' : '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: holderName ? undefined : inPool ? 'var(--text-muted)' : 'var(--text-amber-800)' }}>
            {holderName ?? (inPool ? MOTOR_POOL_LABEL : 'Unassigned')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {holder ? `${inPool ? 'parked since' : 'since'} ${formatYmdShort(holder.start_date)}` : 'no current holder'}
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
          {holder && !inPool ? 'Hand off' : inPool ? 'Hand off' : 'Assign'}
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
            <button
              type="button"
              onClick={() => openVehicleForm()}
              style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Add Vehicle
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="search"
            placeholder="Search vehicles or people"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: '0.9rem', width: '100%', maxWidth: 440, boxSizing: 'border-box' }}
          />
        </div>
        {/* Fleet strip (v2.2169): facts as one line, to-dos as a short list — see VehiclesFleetSummary. */}
        <VehiclesFleetSummary
          facts={fleetFactsLine({ total: summary.total, motorPool: summary.motorPool, weeklyInsReg: weeklyTotal }, formatCurrency)}
          onInsurancePlans={() => setPlansOpen(true)}
          onCheckinSettings={isDev ? () => void openCheckinSettings() : undefined}
          items={buildFleetAttentionItems({
            unassigned: summary.unassigned,
            uninsured: uninsuredCount,
            staleReadings: summary.staleReadings,
            oilDueSoon: oilCounts.dueSoon,
            oilOverdue: oilCounts.overdue,
            openProblems: Object.values(openProblemsByVehicle).reduce((acc, n) => acc + n, 0),
            openTasks: openTaskTotal,
          })}
          onOpenReadings={openReadingsCatchUp}
          onOpenTasks={() => setTasksCatchUpOpen(true)}
        />
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
                  {(selectedVehicle.trim ?? '').trim() && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedVehicle.trim}</span>
                  )}
                  {selectedVehicle.vin && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>VIN {selectedVehicle.vin}</span>
                  )}
                  {(() => {
                    const holder = holderByVehicle.get(selectedVehicle.id)
                    if (holder && isMotorPoolPossession(holder)) {
                      return (
                        <span style={chipStyle('plain')}>
                          {MOTOR_POOL_LABEL} · parked since {formatYmdShort(holder.start_date)}
                        </span>
                      )
                    }
                    const nm = holder?.user_id ? (userNameById.get(holder.user_id) ?? '') : null
                    return nm ? (
                      <span style={{ ...chipStyle('plain'), background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }}>
                        {nm} · since {formatYmdShort(holder!.start_date)}
                      </span>
                    ) : (
                      <span style={chipStyle('amber')}>Unassigned</span>
                    )
                  })()}
                  {(() => {
                    const s = oilStatus(
                      lastOilMap.get(selectedVehicle.id) ?? null,
                      selectedVehicle.oil_change_interval_miles,
                      latestMap.get(selectedVehicle.id) ?? null,
                      oilThresholdsForVehicle(selectedVehicle),
                    )
                    if (s.state === 'unknown') return null
                    return <span style={chipStyle(oilChipToneFor(s.state))}>{oilChipLabel(s)}</span>
                  })()}
                  {(() => {
                    const cur = insuranceByVehicle.get(selectedVehicle.id)
                    return cur ? (
                      <span style={chipStyle('green')}>
                        {planNameById.get(cur.plan_id) ?? 'Insurance plan'} · since {formatYmdShort(cur.start_date)}
                      </span>
                    ) : (
                      <span style={chipStyle('amber')}>Not on insurance</span>
                    )
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

              {/* Insurance card (v2.2180, owner mockup): status + plan action + the cost, in the odometer card's anatomy. */}
              {(() => {
                const cur = insuranceByVehicle.get(selectedVehicle.id) ?? null
                const weekly = selectedVehicle.weekly_insurance_cost ?? 0
                const preview = insCostDraft.trim() ? weeklyInsuranceCostFromInput(insCostDraft, insCostUnit) : null
                return (
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
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Insurance</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {cur ? (
                          <>
                            <span>
                              <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{planNameById.get(cur.plan_id) ?? 'Insurance plan'}</span> · since {formatYmdShort(cur.start_date)}
                            </span>
                            <button type="button" onClick={() => openAddToPlan(selectedVehicle)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
                              Change plan
                            </button>
                            <button type="button" onClick={() => openTakeOff(cur, vehicleDisplayName(selectedVehicle))} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
                              Take off
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={chipStyle('amber')}>Not on insurance</span>
                            <button type="button" onClick={() => openAddToPlan(selectedVehicle)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
                              Add to plan
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: weekly > 0 ? 'var(--text-700)' : 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                        {weekly > 0
                          ? cur
                            ? formatInsuranceCostLine(weekly)
                            : `$0.00/wk while off a plan · last cost $${formatCurrency(weekly)}/wk`
                          : 'no cost set — type what the carrier charges for this vehicle'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={weekly > 0 ? 'New amount' : 'Amount'}
                          value={insCostDraft}
                          onChange={(e) => setInsCostDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveInsuranceCost()
                          }}
                          aria-label="Insurance cost"
                          style={{ width: 104, padding: '0.45rem 0.6rem', border: 'none', fontSize: '0.875rem', background: 'transparent', color: 'inherit' }}
                        />
                        <select
                          value={insCostUnit}
                          onChange={(e) => setInsCostUnit(e.target.value as InsuranceCostUnit)}
                          aria-label="Per week, month, or year"
                          style={{ border: 'none', borderLeft: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0 0.4rem', cursor: 'pointer' }}
                        >
                          {INSURANCE_COST_UNITS.map((u) => (
                            <option key={u.key} value={u.key}>{u.label}</option>
                          ))}
                        </select>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minHeight: '1em' }}>
                        {preview != null && insCostUnit !== 'wk' ? `saved as $${formatCurrency(preview)} / wk` : '\u00a0'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveInsuranceCost()}
                      disabled={insCostSaving || preview == null}
                      style={{
                        padding: '0.45rem 0.9rem',
                        background: insCostSaving || preview == null ? '#9ca3af' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 500,
                        cursor: insCostSaving || preview == null ? 'not-allowed' : 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {insCostSaving ? '…' : 'Save cost'}
                    </button>
                  </div>
                )
              })()}

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
                            onClick={() => void addMaintenanceTask(p.vehicle_id, p.description, p.id)}
                            title="Create a maintenance task from this problem"
                          >
                            Create task
                          </button>
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

              {(() => {
                const open = openMaintenanceTasks(maintenanceTasksAll.filter((t) => t.vehicle_id === selectedVehicle.id))
                return (
                  <div style={{ marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Maintenance{open.length > 0 ? ` (${open.length} open)` : ''}
                    </div>
                    {open.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        {open.map((t, i) => {
                          const assigneeName = t.assigned_user_id ? (userNameById.get(t.assigned_user_id) ?? '') : null
                          const hasThread = !!t.checklist_item_id
                          const expanded = expandedTaskId === t.id
                          return (
                            <div key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.55rem 0.9rem',
                                fontSize: '0.875rem',
                                flexWrap: 'wrap',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => void completeMaintenanceTask(t)}
                                aria-label={`Mark done: ${t.title}`}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <div
                                role={hasThread ? 'button' : undefined}
                                tabIndex={hasThread ? 0 : undefined}
                                aria-expanded={hasThread ? expanded : undefined}
                                onClick={hasThread ? () => setExpandedTaskId((prev) => (prev === t.id ? null : t.id)) : undefined}
                                onKeyDown={hasThread ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedTaskId((prev) => (prev === t.id ? null : t.id)) } } : undefined}
                                title={hasThread ? (expanded ? 'Hide activity and notes' : 'Show activity and notes') : undefined}
                                style={{ flex: 1, minWidth: 160, cursor: hasThread ? 'pointer' : undefined, borderRadius: 6, padding: '0.1rem 0.25rem', margin: '-0.1rem -0.25rem', background: expanded ? 'var(--bg-muted)' : undefined }}
                              >
                                <div>{t.title}</div>
                                {t.note ? (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-700)', fontStyle: 'italic' }}>“{t.note}”</div>
                                ) : null}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {t.source_problem_report_id
                                    ? 'from problem report'
                                    : `added by ${(t.created_by ? userNameById.get(t.created_by) : null) ?? 'Office'}`}
                                  {t.created_at ? ` · ${formatYmdShort(t.created_at.slice(0, 10))}` : ''}
                                </div>
                              </div>
                              {assigneeName ? (
                                <span style={{ ...chipStyle('plain'), background: 'var(--bg-sky-tint)', color: 'var(--text-link)' }}>
                                  {assigneeName}
                                  {t.due_date ? ` · due ${formatYmdShort(t.due_date)}` : ''}
                                </span>
                              ) : (
                                <span style={chipStyle('amber')}>Unassigned</span>
                              )}
                              <button type="button" style={actionBtn} onClick={() => openTaskEdit(t)}>
                                Edit
                              </button>
                              <button type="button" style={actionBtn} onClick={() => openAssignTask(t)}>
                                {assigneeName ? 'Reassign' : 'Assign'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteMaintenanceTask(t)}
                                title="Delete this task"
                                style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '0.8125rem' }}
                              >
                                ×
                              </button>
                            </div>
                            {expanded && t.checklist_item_id ? (
                              <div style={{ margin: '0 0.9rem 0.6rem 2.4rem', padding: '0.5rem 0.65rem 0.6rem', background: 'var(--bg-muted)', borderRadius: 10 }}>
                                <ChecklistItemActivity
                                  item={{ id: t.checklist_item_id, title: t.title, created_at: t.created_at, created_by_user_id: t.created_by }}
                                  authUserId={authUser?.id ?? null}
                                  showInstanceDays={false}
                                  setError={setError}
                                  commentInstanceId={t.checklist_instance_id ?? undefined}
                                  onComplete={async () => {
                                    await completeMaintenanceTask(t)
                                    return true
                                  }}
                                />
                              </div>
                            ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: open.length > 0 ? '0.5rem' : 0 }}>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void addMaintenanceTask(selectedVehicle.id, newTaskTitle)
                        }}
                        placeholder="Add a task, e.g. Replace serpentine belt"
                        aria-label="New maintenance task"
                        style={{ flex: 1, minWidth: 200, padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => void addMaintenanceTask(selectedVehicle.id, newTaskTitle)}
                        disabled={taskSaving || !newTaskTitle.trim()}
                        style={{
                          padding: '0.45rem 0.9rem',
                          background: taskSaving || !newTaskTitle.trim() ? '#9ca3af' : '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 500,
                          cursor: taskSaving || !newTaskTitle.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Ledger</span>
                {/* Wraps (phone fix): the seven chips were a 485px nowrap row that widened the whole page past a 375px screen. */}
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', minWidth: 0 }}>
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
                        flexWrap: 'wrap',
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
                            r.kind === 'problem' ? 'red' : r.kind === 'problem_resolved' || r.kind === 'service' || r.kind === 'task_done' ? 'green' : 'plain',
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
                                  : r.kind === 'insurance_on' || r.kind === 'insurance_off'
                                    ? 'Insurance'
                                    : r.kind === 'task_done'
                                      ? 'Task'
                                      : 'Hand-off'}
                      </span>
                      {/* Phone (v2.2176): the label claims its own line when the row can't fit date · chip · label · value side by side. */}
                      <span style={{ flex: '1 1 160px', minWidth: 0 }}>{r.label}</span>
                      <span style={{ textAlign: 'right', width: 90, flexShrink: 0, color: r.odometer == null && r.amount == null ? 'var(--text-muted)' : undefined }}>
                        {r.odometer != null ? `${r.odometer.toLocaleString()} mi` : r.amount != null ? `$${formatCurrency(r.amount)}` : '—'}
                      </span>
                      {r.kind !== 'return' && r.kind !== 'problem_resolved' && r.kind !== 'insurance_off' && (
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
          (() => {
            const renderVehicleCard = (v: Vehicle) => {
              const latest = latestMap.get(v.id) ?? null
              const freshness = odometerFreshness(latest, today)
              const holder = holderByVehicle.get(v.id)
              const inactive = holder == null || isMotorPoolPossession(holder)
              const inPool = holder != null && isMotorPoolPossession(holder)
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
                    background: inactive ? 'var(--bg-subtle)' : 'var(--surface)',
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
                    {latest ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOdoHistoryVehicleId(v.id)
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        title="Odometer history — every reading, and miles per month / year"
                        aria-label={`Odometer history for ${vehicleDisplayName(v)}`}
                        style={{ font: 'inherit', fontSize: '0.8125rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: freshness === 'fresh' ? 'var(--text-muted)' : 'var(--text-amber-800)', textDecoration: 'underline dotted', textDecorationColor: 'var(--text-faint)', textUnderlineOffset: 3 }}
                      >
                        {`${latest.odometer_value.toLocaleString()} mi · ${odometerAgeLabel(latest, today)}`}
                        <span aria-hidden style={{ color: 'var(--text-faint)', marginLeft: 4, fontSize: '0.8rem' }}>›</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>No reading yet</span>
                    )}
                    {freshness !== 'fresh' && <span style={chipStyle('amber')}>{freshness === 'none' ? 'needs first reading' : 'needs a reading'}</span>}
                    {(() => {
                      const s = oilStatus(lastOilMap.get(v.id) ?? null, v.oil_change_interval_miles, latest, oilThresholdsForVehicle(v))
                      if (s.state === 'unknown') return null
                      return <span style={chipStyle(oilChipToneFor(s.state))}>{oilChipLabel(s)}</span>
                    })()}
                    {(openProblemsByVehicle[v.id] ?? 0) > 0 && (
                      <span style={chipStyle('red')}>
                        {openProblemsByVehicle[v.id]} problem{openProblemsByVehicle[v.id] === 1 ? '' : 's'}
                      </span>
                    )}
                    {(taskCounts.get(v.id)?.open ?? 0) > 0 && (
                      <span style={chipStyle('amber')}>
                        {taskCounts.get(v.id)!.open} task{taskCounts.get(v.id)!.open === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const cur = insuranceByVehicle.get(v.id)
                    const lastEnded = cur
                      ? null
                      : lastEndedInsurancePeriod(insurancePeriodsAll.filter((x) => x.vehicle_id === v.id))
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem' }}>
                          {cur ? (
                            <>
                              <span style={{ fontWeight: 600 }}>{planNameById.get(cur.plan_id) ?? 'Insurance plan'}</span>
                              <span style={{ color: 'var(--text-muted)' }}> · on plan since {formatYmdShort(cur.start_date)}</span>
                              {inPool && (
                                <span style={{ color: 'var(--text-amber-800)' }}> · still insured while parked</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 600, color: 'var(--text-amber-800)' }}>Not on insurance</span>
                              {lastEnded?.end_date && (
                                <span style={{ color: 'var(--text-muted)' }}> · off since {formatYmdShort(lastEnded.end_date)}</span>
                              )}
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          style={{ ...actionBtn, flexShrink: 0 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openAddToPlan(v)
                          }}
                        >
                          {cur ? 'Change' : 'Add to plan'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            const groupHeader = (label: string, count: number, hint: string) => (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', margin: '0 0 0.5rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                  {label} ({count})
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>
              </div>
            )
            const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.75rem' }
            return (
              <>
                {activeVehicles.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    {groupHeader('Active', activeVehicles.length, 'someone is using these')}
                    <div style={grid}>{activeVehicles.map(renderVehicleCard)}</div>
                  </div>
                )}
                {inactiveVehicles.length > 0 && (
                  <div>
                    {groupHeader('Inactive', inactiveVehicles.length, 'parked or waiting for a holder')}
                    <div style={grid}>{inactiveVehicles.map(renderVehicleCard)}</div>
                  </div>
                )}
                {filteredVehicles.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', margin: 0, padding: '0.5rem 0' }}>
                    {vehicles.length === 0 ? 'No vehicles yet. Add one to get started.' : 'No vehicles match the search.'}
                  </p>
                )}
              </>
            )
          })()
        )}
        {/* Wheels (v2.2733): vehicle cost per field hour, dev-only like Review. */}
        {isDev && !loading && !selectedVehicle ? <PeopleVehiclesWheelsSection users={users} /> : null}
      </div>

      {vehicleFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Compact layout (v2.1671): short fields share rows and the dialog
              caps at 90vh with its own scroll, so small viewports can always
              reach Save/Cancel (the old stacked form clipped both). */}
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, 94vw)', maxHeight: 'min(90vh, 100%)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</h3>
              <button
                type="button"
                onClick={closeVehicleForm}
                aria-label="Close"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', padding: '0 0.2rem' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '0.6rem', marginBottom: '0.7rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Year *</label>
                <input type="number" min={1900} max={2100} value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Make *</label>
                <input type="text" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model *</label>
                <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '0.7rem' }}>
              <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trim</label>
              <input
                type="text"
                value={vehicleTrim}
                onChange={(e) => setVehicleTrim(e.target.value)}
                placeholder="XLT Crew Cab Long Bed"
                style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '0.7rem' }}>
              <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>VIN</label>
              <input
                type="text"
                value={vehicleVin}
                onChange={(e) => setVehicleVin(e.target.value)}
                placeholder="Optional"
                style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginBottom: '0.7rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Weekly cost ($)</div>
              {/* Insurance cost moved to the vehicle's Insurance card (v2.2180) — one place to set it, beside the plan status. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registration</label>
                  <input type="number" min={0} step={0.01} value={vehicleRegCost} onChange={(e) => setVehicleRegCost(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Oil change reminders (miles)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interval</label>
                  <input type="number" min={500} step={500} value={vehicleOilInterval} onChange={(e) => setVehicleOilInterval(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suggest within</label>
                  <input type="number" min={0} step={100} value={vehicleOilSuggestWindow} onChange={(e) => setVehicleOilSuggestWindow(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Require past</label>
                  <input type="number" min={0} step={100} value={vehicleOilRequirePastDue} onChange={(e) => setVehicleOilRequirePastDue(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.5rem', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Require past 0 = required the moment it hits the interval. These drive the holder's Dashboard prompts.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeVehicleForm} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={upsertVehicle}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {handOffVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>
              {holderByVehicle.get(handOffVehicle.id) ? 'Hand off vehicle' : 'Assign vehicle'}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {vehicleDisplayName(handOffVehicle)}
              {(() => {
                const holder = holderByVehicle.get(handOffVehicle.id)
                if (!holder) return ' · currently unassigned'
                if (isMotorPoolPossession(holder)) return ' · currently in the motor pool'
                const nm = holder.user_id ? userNameById.get(holder.user_id) : null
                return nm ? ` · currently ${nm}` : ' · currently unassigned'
              })()}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>New holder *</label>
              <select value={handOffUserId} onChange={(e) => setHandOffUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {(() => {
                  const holder = holderByVehicle.get(handOffVehicle.id)
                  const inPool = holder != null && isMotorPoolPossession(holder)
                  return inPool ? null : <option value={MOTOR_POOL_OPTION}>Motor pool — parked, no one using it</option>
                })()}
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
              {handOffUserId === MOTOR_POOL_OPTION
                ? 'Ends the current possession and parks the vehicle in the motor pool — no one is using it.'
                : holderByVehicle.get(handOffVehicle.id)
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 400 }}>
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 400 }}>
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280 }}>
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

      {plansOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 560, width: '92%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Insurance plans</h3>
              <button type="button" style={actionBtn} onClick={() => openPlanForm()}>
                + Add plan
              </button>
            </div>
            {insurancePlans.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No plans yet. Add the company's insurance plans, then put each vehicle on one from its card.
              </p>
            ) : (
              insurancePlans.map((plan) => {
                const onPlan = vehicles.filter((v) => insuranceByVehicle.get(v.id)?.plan_id === plan.id)
                const meta = [plan.carrier, plan.policy_number ? `Policy ${plan.policy_number}` : null, plan.renewal_date ? `renews ${formatYmdShort(plan.renewal_date)}` : null]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div key={plan.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{plan.name}</div>
                        {(meta || plan.note) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{meta || plan.note}</div>
                        )}
                      </div>
                      <span style={chipStyle(onPlan.length > 0 ? 'green' : 'plain')}>
                        {onPlan.length} vehicle{onPlan.length === 1 ? '' : 's'}
                      </span>
                      <button type="button" style={actionBtn} onClick={() => openPlanForm(plan)}>Edit</button>
                      <button type="button" style={{ ...actionBtn, color: 'var(--text-red-700)' }} onClick={() => deletePlan(plan)}>
                        Delete
                      </button>
                    </div>
                    {onPlan.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {onPlan.map((v) => {
                          const period = insuranceByVehicle.get(v.id)
                          if (!period) return null
                          const cost = v.weekly_insurance_cost ?? 0
                          return (
                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPlansOpen(false)
                                  setSelectedVehicleId(v.id)
                                }}
                                title="Open this vehicle — its Insurance card sets the cost"
                                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}
                              >
                                {vehicleDisplayName(v)}
                              </button>
                              <span style={{ color: 'var(--text-muted)' }}>since {formatYmdShort(period.start_date)}</span>
                              {/* v2.2180: each vehicle's weekly cost, so the plan can be held up against the carrier's bill. */}
                              <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 78, textAlign: 'right', color: cost > 0 ? undefined : 'var(--text-amber-800)' }}>
                                {cost > 0 ? `$${formatCurrency(cost)}/wk` : 'no cost set'}
                              </span>
                              <button type="button" style={actionBtn} onClick={() => openTakeOff(period, vehicleDisplayName(v))}>
                                Take off
                              </button>
                            </div>
                          )
                        })}
                        {(() => {
                          const t = insurancePlanTotals(onPlan.map((v) => v.weekly_insurance_cost))
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.45rem 0.9rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span>
                                Plan total{t.unpriced > 0 ? ` (${t.priced} of ${t.priced + t.unpriced} priced)` : ''}
                              </span>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                <strong style={{ color: 'var(--text-700)' }}>${formatCurrency(t.weekly)}/wk</strong> · {formatInsuranceCostLine(t.weekly).split(' · ').slice(1).join(' · ')}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setPlansOpen(false)} style={{ padding: '0.5rem 1rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in settings (v2.2199, dev-only): the cadence + questions that drive Quickfill's Vehicle check-ins station. */}
      {checkinSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} onClick={() => setCheckinSettingsOpen(false)}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 520, width: '92%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '0.35rem' }}>Check-in settings</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Drives Quickfill's <strong>Vehicle check-ins</strong> station: how often each kind of vehicle needs an odometer
              reading, and the questions the assistant answers while they have the holder on the phone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-slate-600)' }}>
                Assigned vehicles — every
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 4 }}>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={checkinSettingsDraft.assignedDays}
                    onChange={(e) => setCheckinSettingsDraft((prev) => ({ ...prev, assignedDays: Math.max(1, Math.min(365, Math.floor(Number(e.target.value) || 0))) }))}
                    style={{ width: 72, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
                  />
                  days
                </span>
              </label>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-slate-600)' }}>
                Motor pool — every
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={checkinSettingsDraft.motorPoolDays}
                    onChange={(e) => setCheckinSettingsDraft((prev) => ({ ...prev, motorPoolDays: Math.max(0, Math.min(365, Math.floor(Number(e.target.value) || 0))) }))}
                    style={{ width: 72, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
                  />
                  days <span style={{ color: 'var(--text-muted)' }}>(0 = skip)</span>
                </span>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Questions asked at each check-in</div>
              {checkinSettingsDraft.questions.length === 0 && (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No questions — check-ins will just collect the odometer.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {checkinSettingsDraft.questions.map((q, qi) => (
                  <div key={q.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={q.label}
                      onChange={(e) =>
                        setCheckinSettingsDraft((prev) => ({
                          ...prev,
                          questions: prev.questions.map((qq, i) => (i === qi ? { ...qq, label: e.target.value } : qq)),
                        }))
                      }
                      placeholder="e.g. Any lights on the dash?"
                      aria-label={`Check-in question ${qi + 1}`}
                      style={{ flex: 1, padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setCheckinSettingsDraft((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== qi) }))}
                      aria-label={`Remove question ${qi + 1}`}
                      title="Remove question"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCheckinSettingsDraft((prev) => ({
                    ...prev,
                    questions: [...prev.questions, { id: `q-${crypto.randomUUID().slice(0, 8)}`, label: '' }],
                  }))
                }
                style={{ marginTop: '0.5rem', padding: '0.35rem 0.7rem', background: 'none', border: '1px dashed var(--border-strong)', borderRadius: 6, color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                + Add question
              </button>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Renaming a question only changes future check-ins — history keeps the wording that was asked.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setCheckinSettingsOpen(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={() => void saveCheckinSettings()}
                disabled={checkinSettingsSaving}
                style={{ padding: '0.5rem 1rem', background: checkinSettingsSaving ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: checkinSettingsSaving ? 'not-allowed' : 'pointer' }}
              >
                {checkinSettingsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {planFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0 }}>{editingPlan ? 'Edit plan' : 'Add insurance plan'}</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Name *</label>
              <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Progressive Commercial" style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Carrier</label>
              <input type="text" value={planCarrier} onChange={(e) => setPlanCarrier(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Policy number</label>
              <input type="text" value={planPolicy} onChange={(e) => setPlanPolicy(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Renewal date</label>
              <input type="date" value={planRenewal} onChange={(e) => setPlanRenewal(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <input type="text" value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setPlanFormOpen(false); setEditingPlan(null) }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={savePlan}
                disabled={planSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: planSaving ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: planSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {planSaving ? '…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {insVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>
              {insuranceByVehicle.get(insVehicle.id) ? 'Change insurance plan' : 'Add to insurance'}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {vehicleDisplayName(insVehicle)}
              {(() => {
                const cur = insuranceByVehicle.get(insVehicle.id)
                if (cur) return ` · currently ${planNameById.get(cur.plan_id) ?? 'on a plan'}`
                const lastEnded = lastEndedInsurancePeriod(insurancePeriodsAll.filter((x) => x.vehicle_id === insVehicle.id))
                return lastEnded?.end_date ? ` · off insurance since ${formatYmdShort(lastEnded.end_date)}` : ' · not on insurance'
              })()}
            </p>
            {insurancePlans.length === 0 ? (
              <>
                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                  No plans yet — add the company's insurance plans first.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setInsVehicle(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      setInsVehicle(null)
                      setPlansOpen(true)
                      openPlanForm()
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Add a plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Plan *</label>
                  <select value={insPlanId} onChange={(e) => setInsPlanId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                    <option value="">— Select —</option>
                    {insurancePlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.35rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Start date</label>
                  <input type="date" value={insStartDate} onChange={(e) => setInsStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {insuranceByVehicle.get(insVehicle.id)
                    ? 'Ends the current coverage on the start date and keeps the history.'
                    : 'Starts the coverage on this date.'}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {(() => {
                    const cur = insuranceByVehicle.get(insVehicle.id)
                    if (!cur) return null
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const name = vehicleDisplayName(insVehicle)
                          setInsVehicle(null)
                          openTakeOff(cur, name)
                        }}
                        style={{ ...actionBtn, marginRight: 'auto', color: 'var(--text-amber-800)' }}
                      >
                        Take off insurance…
                      </button>
                    )
                  })()}
                  <button type="button" onClick={() => setInsVehicle(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                  <button
                    type="button"
                    onClick={submitAddToPlan}
                    disabled={insSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: insSaving ? '#9ca3af' : '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: insSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {insSaving ? '…' : insuranceByVehicle.get(insVehicle.id) ? 'Change plan' : 'Add to plan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {odoHistoryVehicleId && (() => {
        const v = vehicles.find((x) => x.id === odoHistoryVehicleId)
        return v ? (
          <VehicleOdometerHistoryModal
            vehicle={v}
            todayYmd={today}
            nameById={(id) => (id ? userNameById.get(id) ?? null : null)}
            formatDate={formatYmdShort}
            onClose={() => setOdoHistoryVehicleId(null)}
            onAdded={() => loadFleet()}
          />
        ) : null
      })()}
      {readingsCatchUp && (
        <VehicleReadingsCatchUpModal
          rows={readingsCatchUp}
          userNameById={userNameById}
          savedById={catchUpSaved}
          savingVehicleId={catchUpSavingId}
          onSave={(vehicleId, raw) => void saveCatchUpReading(vehicleId, raw)}
          onClose={() => setReadingsCatchUp(null)}
        />
      )}
      {tasksCatchUpOpen && (
        <VehicleTasksCatchUpModal
          tasks={openMaintenanceTasks(maintenanceTasksAll)}
          vehicleById={new Map(vehicles.map((v) => [v.id, v]))}
          userNameById={userNameById}
          onComplete={(t) => void completeMaintenanceTask(t, { skipServiceNudge: true })}
          onAssign={(t) => openAssignTask(t)}
          onClose={() => setTasksCatchUpOpen(false)}
        />
      )}
      {editTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }} onClick={() => { if (!editTaskSaving) setEditTask(null) }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Edit maintenance task</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {(() => {
                const v = vehicles.find((x) => x.id === editTask.vehicle_id)
                return v ? vehicleDisplayName(v) : 'Vehicle'
              })()}
              {editTask.checklist_item_id ? ' · updates the assignee’s checklist copy too' : ''}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Task *</label>
              <input
                type="text"
                value={editTaskTitle}
                onChange={(e) => setEditTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveTaskEdit() }}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Note</label>
              <textarea
                value={editTaskNote}
                onChange={(e) => setEditTaskNote(e.target.value)}
                rows={3}
                placeholder="context for whoever does it — part location, symptoms, gotchas…"
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', font: 'inherit', fontSize: '0.875rem', resize: 'vertical' }}
              />
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                The note shows here and on the assignee’s 🚗 vehicle card.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setEditTask(null)} disabled={editTaskSaving} style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTaskEdit()}
                disabled={editTaskSaving || !editTaskTitle.trim()}
                style={{ padding: '0.5rem 1rem', background: editTaskSaving || !editTaskTitle.trim() ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: editTaskSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                {editTaskSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {assignTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Assign maintenance task</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {assignTask.title}
              {(() => {
                const v = vehicles.find((x) => x.id === assignTask.vehicle_id)
                return v ? ` · ${vehicleDisplayName(v)}` : ''
              })()}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Assign to *</label>
              <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {[...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Due date</label>
              <input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '0.6rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={assignNotify} onChange={(e) => setAssignNotify(e.target.checked)} style={{ width: 15, height: 15 }} />
              Notify me when it's done
            </label>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Creates a one-time checklist task on their list that stays until completed, linked back to this vehicle.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAssignTask(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitAssignTask}
                disabled={assignSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: assignSaving ? '#9ca3af' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: assignSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {assignSaving ? '…' : assignTask.assigned_user_id ? 'Reassign' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {takeOffPeriod && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 300, maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Take off insurance</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {takeOffVehicleName} · {planNameById.get(takeOffPeriod.plan_id) ?? 'plan'} since {formatYmdShort(takeOffPeriod.start_date)}
            </p>
            <div style={{ marginBottom: '0.35rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>End date</label>
              <input type="date" value={takeOffDate} onChange={(e) => setTakeOffDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} />
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ends the coverage on this date. The history stays on the vehicle's ledger, and the vehicle can go back on a plan any time.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setTakeOffPeriod(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              <button
                type="button"
                onClick={submitTakeOff}
                disabled={takeOffSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: takeOffSaving ? '#9ca3af' : '#d97706',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: takeOffSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {takeOffSaving ? '…' : 'Take off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
