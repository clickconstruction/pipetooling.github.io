import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { telHrefFor } from '../../lib/phoneContact'
import { messagesThreadHref } from '../../lib/messages/customerThread'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatDayLabel, formatMarkTime } from '../../lib/quickfill/markHistory'
import { ASK_LOOKBACK_DAYS, askCounts, askRows, askWords, asksMarkNote, asksNextLine, asksSince, type AskLine, type AskRow, type AskState } from '../../lib/quickfill/vehicleAsks'
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
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/**
 * Quickfill "Vehicle check-ins" station (v2.2199, owner mockup 9ebd178b):
 * vehicles due for a reading — assigned vehicles on the weekly cadence, motor
 * pool on the monthly cadence (both dev-tunable from the Vehicles board's ⚙
 * Check-in settings). The assistant calls the holder (or walks out to a
 * motor-pool truck), types the miles, answers the check-in questions ("Any
 * lights on the dash?" → check the box + say what you saw), and Save writes
 * the odometer entry + a vehicle_checkins history row; each checked box also
 * files a Monitor-severity problem report so it lands on the fleet board.
 *
 * Since v2.5887 (punch list #180, PR 4) the station also reads the office's own side: each late
 * truck's holder has a Messages thread, and an outbound line since the last reading is the ask, an
 * inbound line after it the answer (`lib/quickfill/vehicleAsks.ts`). The rows fold into still to do
 * (not asked, answered with the miles not typed yet, the motor pool to walk) and asked, waiting on
 * the driver; the count is what is still to do, the standard ask is one Copy press, and the Mark's
 * note is written from the rows.
 */

type RosterUser = { id: string; name: string | null; phone: string | null }
type PersonLink = { id: string; account_user_id: string | null }
type ContactLink = { id: string; person_id: string | null }
type LineRow = { contact_id: string; at: string; direction: string }

const STATE_WORDS: Record<AskState, string> = { notAsked: 'Not asked', answered: 'Answered', asked: 'Asked', walk: 'Walk out' }

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

export function QuickfillVehicleOdometersSection({ lastMarkedAt = null }: { /** The station's last mark, anyone's: what "since the last look" counts from. */ lastMarkedAt?: string | null } = {}) {
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
  const [contactByUser, setContactByUser] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [lines, setLines] = useState<AskLine[]>([])
  const [waitingOpen, setWaitingOpen] = useState(false)
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
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
      setError(formatErrorMessage(e))
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
      const poss = (possRes.data ?? []) as FleetPossession[]
      setPossessions(poss)
      setReadings((odoRes.data ?? []) as FleetOdometerEntry[])
      setRoster((usersRes.data ?? []) as RosterUser[])
      // The holders' Messages threads (v2.5887): a holder's roster row (`people.account_user_id`), its contact
      // (`contacts.person_id`), and the lines on it since the look-back. Fail-soft: the readings still draw.
      try {
        const holderIds = [...new Set(poss.map((x) => x.user_id).filter((u): u is string => !!u))]
        if (holderIds.length === 0) {
          setContactByUser(new Map())
          setLines([])
        } else {
          const { data: peopleRows } = await supabase.from('people').select('id, account_user_id').in('account_user_id', holderIds)
          const people = (peopleRows ?? []) as PersonLink[]
          const userByPerson = new Map(people.map((pr) => [pr.id, pr.account_user_id!]))
          const { data: contactRows } = people.length ? await supabase.from('contacts').select('id, person_id').in('person_id', people.map((pr) => pr.id)) : { data: [] }
          const contacts = (contactRows ?? []) as ContactLink[]
          const byUser = new Map<string, string>()
          for (const c of contacts) {
            const u = c.person_id ? userByPerson.get(c.person_id) : undefined
            if (u && !byUser.has(u)) byUser.set(u, c.id)
          }
          setContactByUser(byUser)
          const floor = new Date(Date.now() - ASK_LOOKBACK_DAYS * 86_400_000).toISOString()
          const { data: lineRows } = byUser.size
            ? await supabase.from('messages').select('contact_id, at, direction').in('contact_id', [...byUser.values()]).gte('at', floor).order('at', { ascending: false }).limit(2000)
            : { data: [] }
          setLines(((lineRows ?? []) as LineRow[]).map((l) => ({ contactId: l.contact_id, at: l.at, direction: l.direction })))
        }
      } catch {
        setContactByUser(new Map())
        setLines([])
      }
    } catch (e) {
      setError(formatErrorMessage(e))
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
  const nowIso = new Date().toISOString()
  const asks = useMemo(
    () =>
      askRows({
        rows: rows.map((r) => {
          const holderUser = r.holder.user_id ? userById.get(r.holder.user_id) : undefined
          return {
            vehicle: { id: r.vehicle.id, year: r.vehicle.year ?? null, make: r.vehicle.make ?? null, model: r.vehicle.model ?? null },
            holderUserId: r.holder.user_id ?? null,
            holderName: holderUser?.name ?? null,
            motorPool: r.motorPool,
            daysStale: r.daysStale,
            lastReadIso: r.latest ? new Date(`${r.latest.read_date}T00:00:00`).toISOString() : null,
            dueDays: r.dueDays,
          }
        }),
        contactByUser,
        lines,
        nowIso,
      }),
    // `nowIso` moves every render; the asks follow the rows, the threads and the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, contactByUser, lines, roster],
  )
  const counts = useMemo(() => askCounts(asks), [asks])
  const since = useMemo(
    () => asksSince(asks, lastMarkedAt, nowIso, (iso) => `${formatDayLabel(calendarYmdInAppTzFromIso(iso))} at ${formatMarkTime(iso)}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asks, lastMarkedAt],
  )
  const ready = accessChecked && canAccess && !loading

  useReportQuickfillSectionMetric('vehicle-odometers', ready ? counts.todo : null, !!(canAccess && loading), null, ready ? asksMarkNote(asks, since) : null, ready ? asksNextLine(asks) : null)

  async function copyAsk(ask: AskRow) {
    try {
      await navigator.clipboard.writeText(askWords(ask.row))
      setCopiedFor(ask.row.vehicle.id)
      showToast('The ask is copied. Paste it into the thread.', 'success')
    } catch {
      showToast('Could not copy. Select the words and copy them.', 'error')
    }
  }

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
        Vehicles due for a check-in. Assigned trucks {cadenceLabel(settings.assignedDays)},{' '}
        {settings.motorPoolDays > 0 ? `motor pool ${cadenceLabel(settings.motorPoolDays)}` : 'motor pool skipped'}. Ask the
        holder by text or call, type the miles when they answer, answer the questions, done. Each row says whether the holder
        was asked and whether they answered, read from their Messages thread.
      </p>
      {ready && asks.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }} data-vehicle-count-line>
          <b style={{ color: counts.todo > 0 ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>{counts.todo} still to do</b>
          <span>· {counts.late} late · {counts.notAsked} not asked · {counts.asked} asked and waiting · {counts.answered} answered</span>
        </div>
      )}
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
        <>
        {[false, true].map((waiting) => {
          const group = asks.filter((a) => (a.state === 'asked') === waiting)
          if (group.length === 0) return null
          if (waiting && !waitingOpen) {
            return (
              <button key="waiting" type="button" aria-expanded={false} onClick={() => setWaitingOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, font: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }} data-vehicle-waiting-fold>
                <span aria-hidden style={{ color: 'var(--text-muted)' }}>▸</span>
                Asked, waiting on the driver
                <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0 7px', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-link)' }}>{group.length}</span>
              </button>
            )
          }
          return (
        <div key={waiting ? 'waiting' : 'todo'} style={{ marginTop: waiting ? '0.6rem' : 0 }} data-vehicle-group={waiting ? 'waiting' : 'todo'}>
        {waiting && (
          <button type="button" aria-expanded onClick={() => setWaitingOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderBottom: 0, borderRadius: '8px 8px 0 0', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }} data-vehicle-waiting-fold>
            <span aria-hidden style={{ color: 'var(--text-muted)' }}>▾</span>
            Asked, waiting on the driver
            <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0 7px', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-link)' }}>{group.length}</span>
          </button>
        )}
        <div style={{ border: '1px solid var(--border)', borderRadius: waiting ? '0 0 8px 8px' : 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {group.map((ask, i) => {
            const row = rows.find((r) => r.vehicle.id === ask.row.vehicle.id)!
            const holderUser = row.holder.user_id ? userById.get(row.holder.user_id) : undefined
            const holderName = (holderUser?.name ?? '').trim() || 'Unknown holder'
            const phone = (holderUser?.phone ?? '').trim()
            const saving = savingVehicleId === row.vehicle.id
            return (
              <div key={row.vehicle.id} style={{ ...cardStyle, borderBottom: i === group.length - 1 ? 'none' : '1px solid var(--border)' }} data-vehicle-ask={ask.state}>
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
                        background: row.motorPool ? 'var(--bg-indigo-100)' : 'var(--bg-blue-tint)',
                        color: row.motorPool ? 'var(--text-link)' : 'var(--text-link)',
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
                    <div style={{ fontSize: '0.75rem', marginTop: '0.1rem', display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }} data-vehicle-ask-words>
                      <span style={{ ...pillStyle, background: ask.state === 'notAsked' ? 'var(--bg-red-100)' : ask.state === 'answered' ? 'var(--bg-green-100)' : ask.state === 'asked' ? 'var(--bg-amber-100)' : 'var(--bg-subtle)', color: ask.state === 'notAsked' ? 'var(--text-red-800)' : ask.state === 'answered' ? 'var(--text-green-800)' : ask.state === 'asked' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{STATE_WORDS[ask.state]}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{ask.words}</span>
                      {!row.motorPool && ask.state !== 'answered' && (
                        <button type="button" onClick={() => void copyAsk(ask)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                          {copiedFor === row.vehicle.id ? 'Copied ✓' : 'Copy the ask'}
                        </button>
                      )}
                      {ask.contactId && (
                        <Link to={messagesThreadHref(ask.contactId)} style={{ fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {ask.state === 'answered' ? 'Read the answer →' : 'Open the thread →'}
                        </Link>
                      )}
                    </div>
                  </div>
                  {row.motorPool ? (
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="Nobody holds this vehicle — check it in person">
                      🚶 walk out &amp; check
                    </span>
                  ) : phone ? (
                    <a
                      href={telHrefFor(phone)}
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
                      background: saving ? DEAD_PRESS_FILL : '#3b82f6',
                      color: saving ? DEAD_PRESS_TEXT : '#fff',
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
        </div>
          )
        })}
        {since && (
          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', padding: '0.6rem 0.1rem 0' }} data-vehicle-since>
            <span>{since.words}:</span>
            <b style={{ color: 'var(--text-red-700)' }}>+{since.newLate} new late</b>
            <b>{since.askedSince} asked</b>
            <b style={{ color: 'var(--text-green-800)' }}>{since.answeredSince} answered</b>
          </div>
        )}
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', lineHeight: 1.45 }} data-vehicle-stance>
          <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>Reads the readings, who holds each truck, and the holder's Messages thread.</b> A text from the office since the last reading is the ask, a text back is the answer. The miles are still typed from the answer.
        </p>
        </>
      )}
    </section>
  )
}
