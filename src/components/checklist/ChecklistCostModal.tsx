import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  buildHourlyWageLookupByNormalizedName,
  hourlyWageForUserName,
} from '../../lib/bidBoardWeeklyEstimatorLaborCost'
import {
  ACCURACY_MIN_COUNT,
  estimateAccuracy,
  estimateDollars,
  estimateRelativeBands,
  formatMultiplier,
  formatWholeDollars,
  type ChecklistCostEstimate,
} from '../../lib/checklistCostEstimate'
import {
  cachedChecklistCostEstimates,
  writeChecklistCostActual,
  writeChecklistCostEstimate,
} from '../../lib/checklistCostStore'
import { useChecklistCostEstimates } from '../../hooks/useChecklistCostEstimates'

type UserRow = { id: string; name: string | null; email: string | null }

type Props = {
  open: boolean
  costKey: string | null
  taskTitle: string
  /** Pre-selected person (e.g. the row's assignee). */
  defaultUserId?: string | null
  onClose: () => void
}

const QUICK_HOURS = [0.5, 1, 2, 4, 8]

/**
 * Dev-only cost estimator: pick a person, their $/hr auto-fills from People
 * Pay config (editable — salaried/unconfigured people have no wage row), set
 * estimated hours, and the whole-dollar cost lands on the card as a gold chip.
 */
export default function ChecklistCostModal({
  open,
  costKey,
  taskTitle,
  defaultUserId,
  onClose,
}: Props) {
  const isNarrow = useIsNarrowScreen()
  const [users, setUsers] = useState<UserRow[]>([])
  const [wageByName, setWageByName] = useState<Map<string, number | null>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [personUserId, setPersonUserId] = useState('')
  const [rateText, setRateText] = useState('')
  const [rateTouched, setRateTouched] = useState(false)
  const [hoursText, setHoursText] = useState('')
  const [hadEstimate, setHadEstimate] = useState(false)
  const [actualText, setActualText] = useState('')
  const [loadedActual, setLoadedActual] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  // Every estimate (cache-backed) — feeds the calibration hint.
  const allEstimates = useChecklistCostEstimates(open)

  useEffect(() => {
    if (!open || !costKey) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      let loadedUsers: UserRow[]
      let wages: Map<string, number | null>
      try {
        const [usersData, payData] = await Promise.all([
          withSupabaseRetry(
            () => supabase.from('users').select('id, name, email').order('name', { ascending: true }),
            'load users for cost estimate',
          ),
          withSupabaseRetry(
            () => supabase.from('people_pay_config').select('person_name, hourly_wage'),
            'load pay config for cost estimate',
          ),
        ])
        loadedUsers = (usersData ?? []) as UserRow[]
        wages = buildHourlyWageLookupByNormalizedName(payData ?? [])
      } catch (e) {
        if (cancelled) return
        setLoading(false)
        setError(e instanceof Error ? e.message : 'Load failed')
        return
      }
      if (cancelled) return
      setLoading(false)
      setUsers(loadedUsers)
      setWageByName(wages)

      const existing = cachedChecklistCostEstimates()[costKey]
      setHadEstimate(!!existing)
      setActualText(existing?.actualHours != null ? String(existing.actualHours) : '')
      setLoadedActual(existing?.actualHours ?? null)
      const startUserId = existing?.userId ?? defaultUserId ?? ''
      setPersonUserId(startUserId)
      setHoursText(existing ? String(existing.hours) : '')
      setRateTouched(false)
      if (existing) {
        setRateText(String(existing.rate))
        setRateTouched(true)
      } else {
        const startUser = loadedUsers.find((u) => u.id === startUserId)
        const wage = hourlyWageForUserName(startUser?.name, wages)
        setRateText(wage != null ? String(wage) : '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, costKey, defaultUserId])

  if (!open || !costKey) return null

  const selectedUser = users.find((u) => u.id === personUserId)
  const configuredWage = hourlyWageForUserName(selectedUser?.name, wageByName)
  const rate = Number(rateText)
  const hours = Number(hoursText)
  const valid = personUserId !== '' && Number.isFinite(rate) && rate > 0 && Number.isFinite(hours) && hours > 0
  const total = valid ? estimateDollars({ hours, rate }) : null
  const actualHoursNum = actualText.trim() === '' ? null : Number(actualText)
  const actualValid = actualHoursNum == null || (Number.isFinite(actualHoursNum) && actualHoursNum > 0)
  const actualTotal =
    actualHoursNum != null && actualValid && Number.isFinite(rate) && rate > 0
      ? estimateDollars({ hours: actualHoursNum, rate })
      : null
  // Calibration hint (advice, not autocorrect): only while composing an
  // estimate with no actual of its own, and only past the sample threshold.
  const accuracy = estimateAccuracy(Object.values(allEstimates))
  const hint =
    loadedActual == null && valid && accuracy && accuracy.count >= ACCURACY_MIN_COUNT && Math.abs(accuracy.multiplier - 1) >= 0.15
      ? `📐 Estimates have really run ${formatMultiplier(accuracy.multiplier)} (${accuracy.count} with actuals) — ${hours}h may be closer to ${Math.round(hours * accuracy.multiplier * 2) / 2}h (${formatWholeDollars(Math.round(hours * accuracy.multiplier * rate))}).`
      : null

  function pickPerson(userId: string) {
    setPersonUserId(userId)
    if (!rateTouched) {
      const wage = hourlyWageForUserName(users.find((u) => u.id === userId)?.name, wageByName)
      setRateText(wage != null ? String(wage) : '')
    }
  }

  async function save() {
    if (!valid || !costKey || saving) return
    const estimate: ChecklistCostEstimate = {
      userId: personUserId,
      personName: (selectedUser?.name ?? '').trim() || (selectedUser?.email ?? ''),
      hours,
      rate,
      updatedAt: new Date().toISOString(),
    }
    if (!actualValid) return
    setSaving(true)
    try {
      await writeChecklistCostEstimate(costKey, estimate)
      if (hadEstimate && (actualHoursNum ?? null) !== loadedActual) {
        await writeChecklistCostActual(costKey, actualHoursNum ?? null)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!costKey || saving) return
    setSaving(true)
    try {
      await writeChecklistCostEstimate(costKey, null)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setSaving(false)
    }
  }

  const fieldLabel = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 4 } as const
  const fieldInput = {
    width: '100%',
    boxSizing: 'border-box' as const,
    height: 44,
    padding: '0 0.65rem',
    fontSize: '1rem',
    border: '2px solid var(--text-600)',
    borderRadius: 10,
    background: 'var(--surface)',
    color: 'var(--text-strong)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        // Phones get a bottom sheet: actions land in thumb reach and the
        // native keyboard pushes the sheet up instead of covering a
        // centered card (matches the one-handed card conventions, v2.1854).
        alignItems: isNarrow ? 'flex-end' : 'center',
        justifyContent: 'center',
        // Above the fixed phone tab bar (z-index 1000) — the sheet's actions
        // sit at the exact bottom edge the bar occupies.
        zIndex: 1001,
        padding: isNarrow ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-cost-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: isNarrow ? '16px 16px 0 0' : 12,
          padding: isNarrow ? '1.1rem 1rem calc(0.9rem + env(safe-area-inset-bottom))' : '1.25rem',
          width: '100%',
          maxWidth: isNarrow ? 'none' : 420,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <h2
            id="checklist-cost-modal-title"
            style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)', flex: 1 }}
          >
            Cost this task
          </h2>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.12rem 0.45rem',
              borderRadius: 7,
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            Dev only
          </span>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {taskTitle}
        </p>
        {error ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
        ) : null}
        {loading ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={fieldLabel} htmlFor="checklist-cost-person">
                Who does it
              </label>
              <select
                id="checklist-cost-person"
                value={personUserId}
                onChange={(e) => pickPerson(e.target.value)}
                style={fieldInput}
              >
                <option value="">Pick a person…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || u.id}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.85rem' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="checklist-cost-rate">
                  $/hour
                </label>
                <input
                  id="checklist-cost-rate"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={rateText}
                  onChange={(e) => {
                    setRateText(e.target.value)
                    setRateTouched(true)
                  }}
                  placeholder="—"
                  style={fieldInput}
                />
                <div style={{ marginTop: 3, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {personUserId === ''
                    ? ' '
                    : configuredWage != null
                      ? `Pay config: $${configuredWage}/hr`
                      : 'No wage in pay config — enter one'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="checklist-cost-hours">
                  Hours
                </label>
                <input
                  id="checklist-cost-hours"
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  value={hoursText}
                  onChange={(e) => setHoursText(e.target.value)}
                  placeholder="0"
                  style={fieldInput}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                  {QUICK_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoursText(String(h))}
                      style={{
                        minHeight: 40,
                        minWidth: 52,
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        border: hoursText === String(h) ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                        borderRadius: 9,
                        background: hoursText === String(h) ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: hoursText === String(h) ? 'var(--text-blue-800)' : 'var(--text-700)',
                        cursor: 'pointer',
                      }}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                background: 'var(--bg-amber-tint)',
                border: '1px solid #d97706',
                marginBottom: '1rem',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', fontWeight: 600 }}>
                {valid ? `${hours}h × $${rate}/hr` : 'Pick a person, rate, and hours'}
              </span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>
                {total != null ? formatWholeDollars(total) : '—'}
              </span>
            </div>
            {hint ? (
              <div
                style={{
                  margin: '-0.4rem 0 1rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 9,
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-800)',
                  fontSize: '0.78125rem',
                  lineHeight: 1.45,
                }}
              >
                {hint}
              </div>
            ) : null}
            {hadEstimate ? (
              <div style={{ margin: '-0.25rem 0 1rem' }}>
                <label style={fieldLabel} htmlFor="checklist-cost-actual">
                  Actually took (record any time — blank means not recorded)
                </label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {estimateRelativeBands(hours > 0 ? hours : 1).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setActualText(actualText === String(b) ? '' : String(b))}
                      style={{
                        minHeight: 40,
                        minWidth: 52,
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        border:
                          actualText === String(b)
                            ? '2px solid #2563eb'
                            : b === hours
                              ? '1.5px solid #d97706'
                              : '1px solid var(--border-strong)',
                        borderRadius: 9,
                        background: actualText === String(b) ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: actualText === String(b) ? 'var(--text-blue-800)' : b === hours ? 'var(--text-amber-800)' : 'var(--text-700)',
                        cursor: 'pointer',
                      }}
                      title={b === hours ? 'As estimated' : undefined}
                    >
                      {b}h
                    </button>
                  ))}
                  <input
                    id="checklist-cost-actual"
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={actualText}
                    onChange={(e) => setActualText(e.target.value)}
                    placeholder="—"
                    style={{ ...fieldInput, width: 84, height: 40 }}
                  />
                </div>
                {actualTotal != null && total != null ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem',
                      borderRadius: 9,
                      marginTop: 8,
                      background: actualTotal > total ? 'var(--bg-red-100)' : 'var(--bg-green-100)',
                      border: `1px solid ${actualTotal > total ? '#dc2626' : '#16a34a'}`,
                      color: actualTotal > total ? 'var(--text-red-700)' : 'var(--text-green-700)',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Actually took · {actualHoursNum}h</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatWholeDollars(actualTotal)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {hadEstimate ? (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={saving}
                  style={{
                    padding: '0.55rem 0.9rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-red-700)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              ) : null}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onClose}
                style={{
                  minHeight: 48,
                  padding: '0 1.1rem',
                  background: 'var(--bg-200)',
                  color: 'var(--text-700)',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!valid || saving}
                style={{
                  minHeight: 48,
                  padding: '0 1.25rem',
                  ...(isNarrow ? { flex: 1, maxWidth: 220 } : {}),
                  background: valid && !saving ? '#f59e0b' : '#9ca3af',
                  color: valid && !saving ? '#451a03' : 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: valid && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'Saving…' : 'Save cost'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
