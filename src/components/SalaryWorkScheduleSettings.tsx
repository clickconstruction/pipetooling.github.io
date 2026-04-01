import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import { APP_CALENDAR_TZ, formatIanaTimeZoneLongOffsetLabel } from '../utils/dateUtils'

type TemplateInsert = Database['public']['Tables']['salary_work_schedule_templates']['Insert']

function timeLocalToInput(t: string | null | undefined): string {
  if (!t) return '08:00'
  const p = t.includes(':') ? t.split(':') : []
  const h = p[0] ?? '08'
  const m = p[1] ?? '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** 15-minute durations for segment A in split mode (segment B gets the remainder). */
function validSegmentADurations(): number[] {
  const out: number[] = []
  for (let m = 15; m <= 480 - 15; m += 15) out.push(m)
  return out
}

/** Display-only label; values remain stored as minutes. */
function formatSegmentLengthHoursLabel(minutes: number): string {
  const h = minutes / 60
  const label = Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, '')
  return `${label} h`
}

function toPgTime(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm
}

const US_CONTINENTAL_TIMEZONES = [
  { iana: 'America/New_York', label: 'Eastern' },
  { iana: 'America/Chicago', label: 'Central' },
  { iana: 'America/Denver', label: 'Mountain' },
  { iana: 'America/Los_Angeles', label: 'Pacific' },
] as const

function normalizeSalaryTimezone(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (US_CONTINENTAL_TIMEZONES.some((z) => z.iana === t)) return t
  return APP_CALENDAR_TZ
}

function formatTimezoneSelectOptionLabel(iana: string, regionLabel: string, at: Date = new Date()): string {
  const off = formatIanaTimeZoneLongOffsetLabel(iana, at)
  return off ? `${regionLabel} (${off})` : regionLabel
}

export function SalaryWorkScheduleSettings({
  userId,
  userPayName,
  canEditPastDayOverrides,
}: {
  userId: string
  userPayName: string
  /** Dev / master / assistant: pick any work_date for day override (RLS). Others: company calendar today only. */
  canEditPastDayOverrides: boolean
}) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSalary, setIsSalary] = useState(false)
  const [mode, setMode] = useState<'continuous' | 'split'>('continuous')
  const [segmentAStart, setSegmentAStart] = useState('08:00')
  const [segmentADuration, setSegmentADuration] = useState(480)
  const [segmentBStart, setSegmentBStart] = useState('12:30')
  const [useSplitFocus, setUseSplitFocus] = useState(false)
  const [timezone, setTimezone] = useState(APP_CALENDAR_TZ)
  const [excludeWeekends, setExcludeWeekends] = useState(true)
  const [todayOverrideEnabled, setTodayOverrideEnabled] = useState(false)
  const [ovMode, setOvMode] = useState<'continuous' | 'split'>('continuous')
  const [ovAStart, setOvAStart] = useState('08:00')
  const [ovADur, setOvADur] = useState(480)
  const [ovBStart, setOvBStart] = useState('12:30')
  const [overrideDateYmd, setOverrideDateYmd] = useState<string>(() => denverWorkDateToday())

  const durOptionsA = useMemo(() => validSegmentADurations(), [])
  const segmentBDuration = 480 - segmentADuration
  const effectiveOverrideDate = canEditPastDayOverrides ? overrideDateYmd : denverWorkDateToday()

  const load = useCallback(async () => {
    if (!userId) {
      setIsSalary(false)
      setLoading(false)
      return
    }
    setLoading(true)
    let name = userPayName.trim()
    if (!name) {
      try {
        const urow = await withSupabaseRetry(
          async () => supabase.from('users').select('name').eq('id', userId).maybeSingle(),
          'salary settings self user name',
        )
        name = ((urow as { name?: string | null } | null)?.name ?? '').trim()
      } catch {
        name = ''
      }
    }
    if (!name) {
      setIsSalary(false)
      setLoading(false)
      return
    }
    try {
      const payRow = await withSupabaseRetry(
        async () => supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle(),
        'salary settings pay config',
      )
      const sal = !!(payRow as { is_salary?: boolean } | null)?.is_salary
      setIsSalary(sal)
      if (!sal) {
        return
      }
      const row = (await withSupabaseRetry(
        async () => supabase.from('salary_work_schedule_templates').select('*').eq('user_id', userId).maybeSingle(),
        'salary settings template',
      )) as Database['public']['Tables']['salary_work_schedule_templates']['Row'] | null
      if (row) {
        setMode((row.mode === 'split' ? 'split' : 'continuous') as 'continuous' | 'split')
        setSegmentAStart(timeLocalToInput(row.segment_a_start_local))
        setSegmentADuration(row.segment_a_duration_minutes)
        setSegmentBStart(timeLocalToInput(row.segment_b_start_local))
        setUseSplitFocus(row.use_split_focus)
        setTimezone(normalizeSalaryTimezone(row.timezone))
        setExcludeWeekends(row.exclude_weekends ?? true)
      } else {
        setMode('continuous')
        setSegmentAStart('08:00')
        setSegmentADuration(480)
        setSegmentBStart('12:30')
        setUseSplitFocus(false)
        setTimezone(APP_CALENDAR_TZ)
        setExcludeWeekends(true)
      }
      const ovDay = canEditPastDayOverrides ? overrideDateYmd : denverWorkDateToday()
      const ov = (await withSupabaseRetry(
        async () =>
          supabase.from('salary_work_schedule_day_overrides').select('*').eq('user_id', userId).eq('work_date', ovDay).maybeSingle(),
        'salary settings override',
      )) as Database['public']['Tables']['salary_work_schedule_day_overrides']['Row'] | null
      if (ov && (ov.mode != null || ov.segment_a_start_local != null)) {
        setTodayOverrideEnabled(true)
        setOvMode((ov.mode === 'split' ? 'split' : 'continuous') as 'continuous' | 'split')
        setOvAStart(timeLocalToInput(ov.segment_a_start_local))
        setOvADur(ov.segment_a_duration_minutes ?? 480)
        setOvBStart(timeLocalToInput(ov.segment_b_start_local))
      } else {
        setTodayOverrideEnabled(false)
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load schedule'), 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, userPayName, showToast, canEditPastDayOverrides, overrideDateYmd])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSaveTemplate() {
    if (!isSalary) return
    setSaving(true)
    try {
      const payload: TemplateInsert = {
        user_id: userId,
        timezone: timezone.trim() || APP_CALENDAR_TZ,
        exclude_weekends: excludeWeekends,
        mode,
        segment_a_start_local: toPgTime(segmentAStart),
        segment_a_duration_minutes: mode === 'continuous' ? 480 : segmentADuration,
        segment_b_start_local: mode === 'split' ? toPgTime(segmentBStart) : null,
        segment_b_duration_minutes: mode === 'split' ? segmentBDuration : null,
        use_split_focus: mode === 'split' ? useSplitFocus : false,
        job_ledger_id: null,
        bid_id: null,
        segment_b_job_ledger_id: null,
        segment_b_bid_id: null,
      }
      if (mode === 'split' && segmentADuration + segmentBDuration !== 480) {
        showToast('Split segments must total 8 hours', 'error')
        return
      }
      await withSupabaseRetry(
        async () => supabase.from('salary_work_schedule_templates').upsert(payload, { onConflict: 'user_id' }),
        'salary template upsert',
      )

      const ovDay = effectiveOverrideDate
      if (todayOverrideEnabled) {
        const ovPayload: Database['public']['Tables']['salary_work_schedule_day_overrides']['Insert'] = {
          user_id: userId,
          work_date: ovDay,
          timezone: timezone.trim() || null,
          mode: ovMode,
          segment_a_start_local: toPgTime(ovAStart),
          segment_a_duration_minutes: ovMode === 'continuous' ? 480 : ovADur,
          segment_b_start_local: ovMode === 'split' ? toPgTime(ovBStart) : null,
          segment_b_duration_minutes: ovMode === 'split' ? 480 - ovADur : null,
          use_split_focus: null,
          job_ledger_id: null,
          bid_id: null,
          segment_b_job_ledger_id: null,
          segment_b_bid_id: null,
        }
        if (ovMode === 'split' && ovADur + (480 - ovADur) !== 480) {
          showToast('Override segments must total 8 hours', 'error')
          return
        }
        await withSupabaseRetry(
          async () => supabase.from('salary_work_schedule_day_overrides').upsert(ovPayload, { onConflict: 'user_id,work_date' }),
          'salary override upsert',
        )
      } else {
        await withSupabaseRetry(
          async () => supabase.from('salary_work_schedule_day_overrides').delete().eq('user_id', userId).eq('work_date', ovDay),
          'salary override delete',
        )
      }

      const todayYmd = denverWorkDateToday()
      const syncErr = (await syncSalaryClockSessionsForUserDay(userId, ovDay)).error
      if (syncErr) throw new Error(syncErr)
      if (ovDay !== todayYmd) {
        const syncTodayErr = (await syncSalaryClockSessionsForUserDay(userId, todayYmd)).error
        if (syncTodayErr) throw new Error(syncTodayErr)
      }

      showToast('Workday schedule saved', 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading pay schedule…</p>
    )
  }
  if (!isSalary) return null

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 0 }}>
        You are marked <strong>salaried</strong> in pay settings. Define your usual 8-hour day (15-minute steps). The app
        creates clock sessions automatically so your team sees you on the clock strip. Use <strong>Update focus</strong> on
        the dashboard to link jobs or bids. To work on a Saturday or Sunday, turn on <strong>Custom schedule for this date</strong>{' '}
        below and pick that day.
      </p>
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Timezone</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ padding: '0.35rem 0.5rem', width: '100%', maxWidth: 400 }}
        >
          {US_CONTINENTAL_TIMEZONES.map((z) => (
            <option key={z.iana} value={z.iana}>
              {formatTimezoneSelectOptionLabel(z.iana, z.label)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        <input
          type="checkbox"
          checked={excludeWeekends}
          onChange={(e) => setExcludeWeekends(e.target.checked)}
        />
        <span style={{ marginLeft: '0.35rem' }}>
          Weekdays only (skip auto sessions Sat–Sun unless you use a custom date schedule below)
        </span>
      </label>
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Day layout</span>
        <label style={{ marginRight: '1rem' }}>
          <input type="radio" name="salary-mode" checked={mode === 'continuous'} onChange={() => setMode('continuous')} />{' '}
          8 hours straight
        </label>
        <label>
          <input type="radio" name="salary-mode" checked={mode === 'split'} onChange={() => setMode('split')} /> Two sessions
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label>
          <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>First block start</span>
          <input type="time" step={900} value={segmentAStart} onChange={(e) => setSegmentAStart(e.target.value)} />
        </label>
        {mode === 'split' ? (
          <>
            <label>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>First block length (hours)</span>
              <select value={segmentADuration} onChange={(e) => setSegmentADuration(Number(e.target.value))}>
                {durOptionsA.map((m) => (
                  <option key={m} value={m}>
                    {formatSegmentLengthHoursLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Second block start</span>
              <input type="time" step={900} value={segmentBStart} onChange={(e) => setSegmentBStart(e.target.value)} />
            </label>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Second block: {formatSegmentLengthHoursLabel(segmentBDuration)} (total 8 h)
            </span>
          </>
        ) : null}
      </div>
      {mode === 'split' && (
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={useSplitFocus} onChange={(e) => setUseSplitFocus(e.target.checked)} />
          <span style={{ marginLeft: '0.35rem' }}>Different job/bid focus for second block (set on dashboard per session)</span>
        </label>
      )}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem', background: '#fafafa' }}>
        {canEditPastDayOverrides && (
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Override work date (Central Time calendar)
            </span>
            <input
              type="date"
              value={overrideDateYmd}
              onChange={(e) => setOverrideDateYmd(e.target.value)}
              style={{ padding: '0.35rem 0.5rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
              Staff can correct past or future days. Everyone else: today only below.
            </span>
          </label>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
          <input type="checkbox" checked={todayOverrideEnabled} onChange={(e) => setTodayOverrideEnabled(e.target.checked)} />
          Custom schedule for this date ({effectiveOverrideDate} Central)
        </label>
        {todayOverrideEnabled && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Override layout</span>
              <label style={{ marginRight: '0.75rem' }}>
                <input type="radio" name="ov-mode" checked={ovMode === 'continuous'} onChange={() => setOvMode('continuous')} />{' '}
                Straight
              </label>
              <label>
                <input type="radio" name="ov-mode" checked={ovMode === 'split'} onChange={() => setOvMode('split')} /> Split
              </label>
            </div>
            <label>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>First start</span>
              <input type="time" step={900} value={ovAStart} onChange={(e) => setOvAStart(e.target.value)} />
            </label>
            {ovMode === 'split' && (
              <>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>First length (hours)</span>
                  <select value={ovADur} onChange={(e) => setOvADur(Number(e.target.value))}>
                    {durOptionsA.map((m) => (
                      <option key={m} value={m}>
                        {formatSegmentLengthHoursLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Second start</span>
                  <input type="time" step={900} value={ovBStart} onChange={(e) => setOvBStart(e.target.value)} />
                </label>
              </>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handleSaveTemplate()}
        disabled={saving}
        style={{ padding: '0.5rem 1rem', fontWeight: 600, background: '#ea580c', color: 'white', border: 'none', borderRadius: 6 }}
      >
        {saving ? 'Saving…' : 'Save schedule'}
      </button>
    </div>
  )
}
