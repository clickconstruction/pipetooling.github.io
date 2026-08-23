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
  vehicleCheckinDueList,
  vehicleDisplayName,
  vinTail,
  type CheckinDueRow,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetVehicle,
} from '../../lib/vehicleFleet'
import {
  DEFAULT_VEHICLE_CHECKIN_SETTINGS,
  fetchVehicleCheckinSettings,
  type VehicleCheckinAnswer,
  type VehicleCheckinSettings,
} from '../../lib/vehicleCheckinSettings'

/**
 * Quickfill "Vehicle check-ins" station (v2.2199, owner mockup 9ebd178b):
 * vehicles due for a reading — assigned vehicles on the weekly cadence, motor
 * pool on the monthly cadence (both dev-tunable from the Vehicles board's ⚙
 * Check-in settings). The assistant calls the holder (or walks out to a
 * motor-pool truck), types the miles, answers the check-in questions ("Any
 * lights on the dash?" → check the box + say what you saw), and Save writes
 * the odometer entry + a vehicle_checkins history row; each checked box also
 * files a Monitor-severity problem report so it lands on the fleet board.
 */

type RosterUser = { id: string; name: string | null; phone: string | null }

type AnswerDraft = { flagged: boolean; comment: string }

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cadenceLabel(days: number): string {
  if (days === 7) return 'weekly'
  if (days === 14) return 'every 2 weeks'
  if (days === 30 || days === 31) return 'monthly'
  return `every ${days}d`
}

const sectionWrapStyle: CSSProperties = { marginBottom: '2rem' }
const cardStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.875rem',
}
const pillStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.5rem',
  borderRadius: 999,
  fontSize: '0.6875rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

export function QuickfillVehicleOdometersSection() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [canAccess, setCanAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState<VehicleCheckinSettings>(DEFAULT_VEHICLE_CHECKIN_SETTINGS)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [possessions, setPossessions] = useState<FleetPossession[]>([])
  const [readings, setReadings] = useState<FleetOdometerEntry[]>([])
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<string, AnswerDraft>>>({})
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
      const [{ data: vehiclesData, error: vErr }, checkinSettings] = await Promise.all([
        supabase.from('vehicles').select('id, year, make, model, vin').order('year', { ascending: false }),
        fetchVehicleCheckinSettings(),
      ])
      if (vErr) throw vErr
      setSettings(checkinSettings)
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
  const rows: CheckinDueRow[] = canAccess
    ? vehicleCheckinDueList(vehicles, holderByVehicle, latestByVehicle, today, settings)
    : []
  const userById = new Map(roster.map((u) => [u.id, u]))

  useReportQuickfillSectionMetric(
    'vehicle-odometers',
    !accessChecked || !canAccess ? null : loading ? null : rows.length,
    !!(canAccess && loading),
  )

  function answerDraftFor(vehicleId: string, questionId: string): AnswerDraft {
    return answerDrafts[vehicleId]?.[questionId] ?? { flagged: false, comment: '' }
  }

  function setAnswerDraft(vehicleId: string, questionId: string, patch: Partial<AnswerDraft>) {
    setAnswerDrafts((prev) => {
      const forVehicle = { ...(prev[vehicleId] ?? {}) }
      forVehicle[questionId] = { ...answerDraftFor(vehicleId, questionId), ...patch }
      return { ...prev, [vehicleId]: forVehicle }
    })
  }

  async function saveReading(row: CheckinDueRow) {
    const vehicleId = row.vehicle.id
    const raw = drafts[vehicleId] ?? ''
    const val = parseOdometerInput(raw)
    if (val == null) {
      setError('Odometer must be a non-negative number')
      return
    }
    const answers: VehicleCheckinAnswer[] = settings.questions.map((q) => {
      const d = answerDraftFor(vehicleId, q.id)
      return { q: q.label, flagged: d.flagged, comment: d.comment.trim() }
    })
    const missingComment = answers.find((a) => a.flagged && !a.comment)
    if (missingComment) {
      setError(`“${missingComment.q}” is checked — add a quick note about what you saw before saving.`)
      return
    }
    setSavingVehicleId(vehicleId)
    try {
      const { data: entryData, error: err } = await supabase
        .from('vehicle_odometer_entries')
        .insert({
          vehicle_id: vehicleId,
          odometer_value: val,
          read_date: today,
          created_by: authUser?.id ?? null,
        })
        .select('id')
        .single()
      if (err) {
        setError(err.message)
        return
      }
      const entryId = (entryData as { id: string } | null)?.id ?? null

      // Check-in history row (fail-soft: the reading is already saved, so a
      // missing table pre-migration must not block the assistant).
      const flagged = answers.filter((a) => a.flagged)
      let checkinSaved = true
      try {
        const { error: ciErr } = await supabase.from('vehicle_checkins').insert({
          vehicle_id: vehicleId,
          odometer_entry_id: entryId,
          checkin_date: today,
          answers,
          created_by: authUser?.id ?? null,
        })
        if (ciErr) throw ciErr
      } catch {
        checkinSaved = false
      }

      // Every checked box files a Monitor problem report so it shows on the
      // fleet board's problem list too (owner decision D2).
      let reportsFailed = 0
      for (const a of flagged) {
        const { error: prErr } = await supabase.from('vehicle_problem_reports').insert({
          vehicle_id: vehicleId,
          description: `${a.q} — ${a.comment} (from vehicle check-in)`,
          severity: 'monitor',
          report_date: today,
          reported_by: authUser?.id ?? null,
        })
        if (prErr) reportsFailed += 1
      }

      setError(null)
      setDrafts((prev) => ({ ...prev, [vehicleId]: '' }))
      setAnswerDrafts((prev) => ({ ...prev, [vehicleId]: {} }))
      const name = vehicleDisplayName(row.vehicle)
      if (!checkinSaved) {
        showToast(`Reading saved for ${name}. Check-in log unavailable — questions were not recorded.`, 'info')
      } else if (reportsFailed > 0) {
        showToast(`Check-in saved for ${name}, but ${reportsFailed} problem report(s) failed to file.`, 'info')
      } else if (flagged.length > 0) {
        showToast(`Check-in saved for ${name} — ${flagged.length} problem report(s) filed.`, 'success')
      } else {
        showToast(`Check-in saved for ${name} — all clear.`, 'success')
      }
      void loadAll()
    } finally {
      setSavingVehicleId(null)
    }
  }

  if (accessChecked && !canAccess) {
    return (
      <section style={sectionWrapStyle}>
        <p style={{ color: 'var(--text-muted)' }}>
          You do not have access to vehicle check-ins (requires dev, assistant, or master technician with pay-approved access).
        </p>
      </section>
    )
  }

  return (
    <section style={sectionWrapStyle}>
      <p style={{ color: 'var(--text-slate-600)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
        Vehicles due for a check-in — assigned trucks {cadenceLabel(settings.assignedDays)},{' '}
        {settings.motorPoolDays > 0 ? `motor pool ${cadenceLabel(settings.motorPoolDays)}` : 'motor pool skipped'}. Call the
        holder (or walk out to a motor-pool truck), type the miles, answer the questions, done.
      </p>
      {error && (
        <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</p>
      )}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-green-800)', fontSize: '0.875rem', margin: 0 }}>
          All check-ins fresh — nothing to collect.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {rows.map((row, i) => {
            const holderUser = row.holder.user_id ? userById.get(row.holder.user_id) : undefined
            const holderName = (holderUser?.name ?? '').trim() || 'Unknown holder'
            const phone = (holderUser?.phone ?? '').trim()
            const saving = savingVehicleId === row.vehicle.id
            return (
              <div key={row.vehicle.id} style={{ ...cardStyle, borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <span style={{ fontWeight: 600 }}>{vehicleDisplayName(row.vehicle)}</span>
                    {vinTail(row.vehicle.vin) && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {vinTail(row.vehicle.vin)}
                      </span>
                    )}
                    <span
                      style={{
                        ...pillStyle,
                        marginLeft: '0.5rem',
                        background: row.motorPool ? 'var(--surface-indigo-50)' : 'var(--surface-blue-50, var(--surface-strong))',
                        color: row.motorPool ? 'var(--text-indigo-700, var(--text-link))' : 'var(--text-link)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {row.motorPool ? `Motor pool · ${cadenceLabel(row.dueDays)}` : cadenceLabel(row.dueDays)}
                    </span>
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
                  {row.motorPool ? (
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="Nobody holds this vehicle — check it in person">
                      🚶 walk out &amp; check
                    </span>
                  ) : phone ? (
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
                    disabled={saving}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: saving ? '#9ca3af' : '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 500,
                      fontSize: '0.8125rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                </div>
                {settings.questions.length > 0 && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {settings.questions.map((q) => {
                      const d = answerDraftFor(row.vehicle.id, q.id)
                      return (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: d.flagged ? 'var(--text-amber-800)' : 'var(--text-slate-600)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={d.flagged}
                              onChange={(e) => setAnswerDraft(row.vehicle.id, q.id, { flagged: e.target.checked })}
                            />
                            {q.label}
                          </label>
                          {d.flagged && (
                            <input
                              type="text"
                              placeholder="What did you see? (required)"
                              value={d.comment}
                              onChange={(e) => setAnswerDraft(row.vehicle.id, q.id, { comment: e.target.value })}
                              aria-label={`Note for “${q.label}” on ${vehicleDisplayName(row.vehicle)}`}
                              style={{ flex: '1 1 220px', minWidth: 180, padding: '0.35rem 0.55rem', border: '1px solid var(--border-amber, var(--border-strong))', borderRadius: 6, fontSize: '0.8125rem' }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
