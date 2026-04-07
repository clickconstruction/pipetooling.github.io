import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import {
  denverWorkDateToday,
  removeSalaryScheduleForUser,
  syncSalaryClockSessionsForUserDay,
} from '../lib/salaryScheduleSync'
import { formatSalaryBlockEndDisplay } from '../lib/salaryScheduleEndTimeDisplay'
import {
  breakMinutesBetweenAB,
  nearestValidSplitBreakMinute,
  segmentBStartFromBreak,
  validSplitBreakMinutesForAnchor,
} from '../lib/salarySplitBreakDerivedStart'
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

/** First segment length when switching from straight 8h to split (avoids 8h-in-block-A + misleading end time). */
const SPLIT_FIRST_BLOCK_DEFAULT_MINUTES = 240

function coerceSplitSegmentAMinutes(raw: number | null | undefined, allowed: readonly number[]): number {
  if (raw != null && allowed.includes(raw)) return raw
  return SPLIT_FIRST_BLOCK_DEFAULT_MINUTES
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
  { iana: APP_CALENDAR_TZ, label: 'Central' },
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

const SALARY_END_HINT_STYLE: CSSProperties = { fontSize: '0.875rem', color: '#6b7280' }

const SALARY_SESSION_FIELDS_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  alignItems: 'flex-end',
}

const SALARY_SESSION_FIELDS_STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  alignItems: 'flex-start',
}

const SALARY_SESSION_CONTROL_MAX: CSSProperties = { width: '100%', maxWidth: '12rem' }

const SALARY_BREAK_STRIP_STYLE: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.75rem 0.875rem',
  background: '#f9fafb',
}

function SalarySessionPanel({
  title,
  variant,
  children,
}: {
  title: string
  variant: 'a' | 'b'
  children: ReactNode
}) {
  const accent = variant === 'a' ? '#2563eb' : '#d97706'
  const bg = variant === 'a' ? '#eff6ff' : '#fffbeb'
  return (
    <div
      style={{
        background: bg,
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 8,
        padding: '0.75rem 0.875rem',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem', color: '#374151' }}>{title}</div>
      {children}
    </div>
  )
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
  /** Pay config says hourly but a `salary_work_schedule_templates` row may still exist from before. */
  const [orphanWorkScheduleTemplate, setOrphanWorkScheduleTemplate] = useState(false)
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
  const [splitBreakMinutes, setSplitBreakMinutes] = useState(60)
  const [ovSplitBreakMinutes, setOvSplitBreakMinutes] = useState(60)
  const [overrideDateYmd, setOverrideDateYmd] = useState<string>(() => denverWorkDateToday())

  const durOptionsA = useMemo(() => validSegmentADurations(), [])
  const segmentBDuration = 480 - segmentADuration
  const ovBDuration = 480 - ovADur
  const effectiveOverrideDate = canEditPastDayOverrides ? overrideDateYmd : denverWorkDateToday()

  const templateBreakOptions = useMemo(
    () =>
      mode === 'split'
        ? validSplitBreakMinutesForAnchor({
            segmentAStart,
            segmentADurationMinutes: segmentADuration,
            timeZone: timezone,
            anchorWorkDateYmd: effectiveOverrideDate,
          })
        : [],
    [mode, segmentAStart, segmentADuration, timezone, effectiveOverrideDate],
  )

  const overrideBreakOptions = useMemo(
    () =>
      todayOverrideEnabled && ovMode === 'split'
        ? validSplitBreakMinutesForAnchor({
            segmentAStart: ovAStart,
            segmentADurationMinutes: ovADur,
            timeZone: timezone,
            anchorWorkDateYmd: effectiveOverrideDate,
          })
        : [],
    [todayOverrideEnabled, ovMode, ovAStart, ovADur, timezone, effectiveOverrideDate],
  )

  const load = useCallback(async () => {
    if (!userId) {
      setIsSalary(false)
      setOrphanWorkScheduleTemplate(false)
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
      setOrphanWorkScheduleTemplate(false)
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
        try {
          const tmpl = await withSupabaseRetry(
            async () =>
              supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', userId).maybeSingle(),
            'salary orphan template probe',
          )
          const tr = tmpl as { user_id?: string } | null
          setOrphanWorkScheduleTemplate(!!tr?.user_id)
        } catch {
          setOrphanWorkScheduleTemplate(false)
        }
        return
      }
      setOrphanWorkScheduleTemplate(false)
      const row = (await withSupabaseRetry(
        async () => supabase.from('salary_work_schedule_templates').select('*').eq('user_id', userId).maybeSingle(),
        'salary settings template',
      )) as Database['public']['Tables']['salary_work_schedule_templates']['Row'] | null
      const segmentAAllowed = validSegmentADurations()
      const anchorYmd = canEditPastDayOverrides ? overrideDateYmd : denverWorkDateToday()
      if (row) {
        const rowSplit = row.mode === 'split'
        setMode((rowSplit ? 'split' : 'continuous') as 'continuous' | 'split')
        const aStart = timeLocalToInput(row.segment_a_start_local)
        const aDur = rowSplit
          ? coerceSplitSegmentAMinutes(row.segment_a_duration_minutes, segmentAAllowed)
          : (row.segment_a_duration_minutes ?? 480)
        const bStart = timeLocalToInput(row.segment_b_start_local)
        setSegmentAStart(aStart)
        setSegmentADuration(aDur)
        setSegmentBStart(bStart)
        setUseSplitFocus(row.use_split_focus)
        const tzRow = normalizeSalaryTimezone(row.timezone)
        setTimezone(tzRow)
        setExcludeWeekends(row.exclude_weekends ?? true)
        setSplitBreakMinutes(
          rowSplit
            ? breakMinutesBetweenAB({
                segmentAStart: aStart,
                segmentADurationMinutes: aDur,
                segmentBStart: bStart,
                timeZone: tzRow,
                anchorWorkDateYmd: anchorYmd,
              })
            : 60,
        )
      } else {
        setMode('continuous')
        setSegmentAStart('08:00')
        setSegmentADuration(480)
        setSegmentBStart('12:30')
        setUseSplitFocus(false)
        setTimezone(APP_CALENDAR_TZ)
        setExcludeWeekends(true)
        setSplitBreakMinutes(60)
      }
      const ovDay = anchorYmd
      const ov = (await withSupabaseRetry(
        async () =>
          supabase.from('salary_work_schedule_day_overrides').select('*').eq('user_id', userId).eq('work_date', ovDay).maybeSingle(),
        'salary settings override',
      )) as Database['public']['Tables']['salary_work_schedule_day_overrides']['Row'] | null
      if (ov && (ov.mode != null || ov.segment_a_start_local != null)) {
        setTodayOverrideEnabled(true)
        const ovSplit = ov.mode === 'split'
        setOvMode((ovSplit ? 'split' : 'continuous') as 'continuous' | 'split')
        const ovTz = normalizeSalaryTimezone(ov.timezone ?? row?.timezone ?? '')
        const ovaStart = timeLocalToInput(ov.segment_a_start_local ?? row?.segment_a_start_local)
        const ovaDur = ovSplit
          ? coerceSplitSegmentAMinutes(ov.segment_a_duration_minutes, segmentAAllowed)
          : (ov.segment_a_duration_minutes ?? 480)
        const ovbStart = timeLocalToInput(ov.segment_b_start_local ?? row?.segment_b_start_local)
        setOvAStart(ovaStart)
        setOvADur(ovaDur)
        setOvBStart(ovbStart)
        setOvSplitBreakMinutes(
          ovSplit
            ? breakMinutesBetweenAB({
                segmentAStart: ovaStart,
                segmentADurationMinutes: ovaDur,
                segmentBStart: ovbStart,
                timeZone: ovTz,
                anchorWorkDateYmd: ovDay,
              })
            : 60,
        )
      } else {
        setTodayOverrideEnabled(false)
        setOvSplitBreakMinutes(60)
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

  useEffect(() => {
    if (mode !== 'split') return
    const opts = validSplitBreakMinutesForAnchor({
      segmentAStart,
      segmentADurationMinutes: segmentADuration,
      timeZone: timezone,
      anchorWorkDateYmd: effectiveOverrideDate,
    })
    if (opts.length === 0) return
    let br = splitBreakMinutes
    if (!opts.includes(br)) {
      const n = nearestValidSplitBreakMinute(br, opts)
      if (n != null && n !== br) {
        setSplitBreakMinutes(n)
        return
      }
    }
    br = opts.includes(splitBreakMinutes) ? splitBreakMinutes : nearestValidSplitBreakMinute(splitBreakMinutes, opts) ?? opts[0]!
    const next = segmentBStartFromBreak({
      segmentAStart,
      segmentADurationMinutes: segmentADuration,
      breakMinutes: br,
      timeZone: timezone,
      anchorWorkDateYmd: effectiveOverrideDate,
    })
    if (next != null) setSegmentBStart(next)
  }, [mode, segmentAStart, segmentADuration, splitBreakMinutes, timezone, effectiveOverrideDate])

  useEffect(() => {
    if (!todayOverrideEnabled || ovMode !== 'split') return
    const opts = validSplitBreakMinutesForAnchor({
      segmentAStart: ovAStart,
      segmentADurationMinutes: ovADur,
      timeZone: timezone,
      anchorWorkDateYmd: effectiveOverrideDate,
    })
    if (opts.length === 0) return
    let br = ovSplitBreakMinutes
    if (!opts.includes(br)) {
      const n = nearestValidSplitBreakMinute(br, opts)
      if (n != null && n !== br) {
        setOvSplitBreakMinutes(n)
        return
      }
    }
    br =
      opts.includes(ovSplitBreakMinutes) ? ovSplitBreakMinutes : nearestValidSplitBreakMinute(ovSplitBreakMinutes, opts) ?? opts[0]!
    const next = segmentBStartFromBreak({
      segmentAStart: ovAStart,
      segmentADurationMinutes: ovADur,
      breakMinutes: br,
      timeZone: timezone,
      anchorWorkDateYmd: effectiveOverrideDate,
    })
    if (next != null) setOvBStart(next)
  }, [todayOverrideEnabled, ovMode, ovAStart, ovADur, ovSplitBreakMinutes, timezone, effectiveOverrideDate])

  async function handleRemoveOrphanWorkSchedule() {
    if (!userId) return
    setSaving(true)
    try {
      const { error } = await removeSalaryScheduleForUser(userId)
      if (error) {
        showToast(error, 'error')
        return
      }
      showToast('Saved work schedule removed', 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Remove failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

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
      if (mode === 'split') {
        const brOpts = validSplitBreakMinutesForAnchor({
          segmentAStart,
          segmentADurationMinutes: segmentADuration,
          timeZone: timezone,
          anchorWorkDateYmd: effectiveOverrideDate,
        })
        if (brOpts.length === 0) {
          showToast('No valid break length fits this first session on the selected work date.', 'error')
          return
        }
        const br =
          brOpts.includes(splitBreakMinutes) ? splitBreakMinutes : nearestValidSplitBreakMinute(splitBreakMinutes, brOpts) ?? brOpts[0]!
        const derivedB = segmentBStartFromBreak({
          segmentAStart,
          segmentADurationMinutes: segmentADuration,
          breakMinutes: br,
          timeZone: timezone,
          anchorWorkDateYmd: effectiveOverrideDate,
        })
        if (derivedB == null) {
          showToast('This break does not fit on the selected work date in your timezone.', 'error')
          return
        }
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
        if (ovMode === 'split') {
          const ovBrOpts = validSplitBreakMinutesForAnchor({
            segmentAStart: ovAStart,
            segmentADurationMinutes: ovADur,
            timeZone: timezone,
            anchorWorkDateYmd: effectiveOverrideDate,
          })
          if (ovBrOpts.length === 0) {
            showToast('No valid break length fits this override first session on the selected work date.', 'error')
            return
          }
          const ovBr =
            ovBrOpts.includes(ovSplitBreakMinutes)
              ? ovSplitBreakMinutes
              : nearestValidSplitBreakMinute(ovSplitBreakMinutes, ovBrOpts) ?? ovBrOpts[0]!
          const ovDerivedB = segmentBStartFromBreak({
            segmentAStart: ovAStart,
            segmentADurationMinutes: ovADur,
            breakMinutes: ovBr,
            timeZone: timezone,
            anchorWorkDateYmd: effectiveOverrideDate,
          })
          if (ovDerivedB == null) {
            showToast('Override break does not fit on the selected work date in your timezone.', 'error')
            return
          }
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
  if (!isSalary) {
    if (!orphanWorkScheduleTemplate) return null
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 0 }}>
          You are not marked salaried in pay settings, but a saved salaried workday schedule still exists. Remove it to
          avoid showing automatic &quot;(s)&quot; sessions on the team clock strip.
        </p>
        <button
          type="button"
          onClick={() => void handleRemoveOrphanWorkSchedule()}
          disabled={saving}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: saving ? '#f3f4f6' : '#fff',
            cursor: saving ? 'wait' : 'pointer',
            fontWeight: 600,
          }}
        >
          {saving ? 'Removing…' : 'Remove saved work schedule'}
        </button>
      </div>
    )
  }

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
          <input
            type="radio"
            name="salary-mode"
            checked={mode === 'continuous'}
            onChange={() => {
              setMode('continuous')
              setSegmentADuration(480)
            }}
          />{' '}
          8 hours straight
        </label>
        <label>
          <input
            type="radio"
            name="salary-mode"
            checked={mode === 'split'}
            onChange={() => {
              if (mode === 'continuous') {
                setSegmentADuration((d) => (d === 480 ? SPLIT_FIRST_BLOCK_DEFAULT_MINUTES : d))
              }
              setMode('split')
            }}
          />{' '}
          Two sessions
        </label>
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        {mode === 'continuous' ? (
          <SalarySessionPanel title="Workday" variant="a">
            <div style={SALARY_SESSION_FIELDS_STACK}>
              <label>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Start</span>
                <input
                  type="time"
                  step={900}
                  value={segmentAStart}
                  onChange={(e) => setSegmentAStart(e.target.value)}
                  style={SALARY_SESSION_CONTROL_MAX}
                />
              </label>
              <div>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>End</span>
                <span>
                  {formatSalaryBlockEndDisplay({
                    startHhMm: segmentAStart,
                    durationMinutes: 480,
                    timeZone: timezone,
                    anchorWorkDateYmd: effectiveOverrideDate,
                  })}
                </span>
              </div>
            </div>
          </SalarySessionPanel>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SalarySessionPanel title="First session" variant="a">
              <div style={SALARY_SESSION_FIELDS_STACK}>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Start</span>
                  <input
                    type="time"
                    step={900}
                    value={segmentAStart}
                    onChange={(e) => setSegmentAStart(e.target.value)}
                    style={SALARY_SESSION_CONTROL_MAX}
                  />
                </label>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                  <select
                    value={segmentADuration}
                    onChange={(e) => setSegmentADuration(Number(e.target.value))}
                    style={SALARY_SESSION_CONTROL_MAX}
                  >
                    {durOptionsA.map((m) => (
                      <option key={m} value={m}>
                        {formatSegmentLengthHoursLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>End</span>
                  <span>
                    {formatSalaryBlockEndDisplay({
                      startHhMm: segmentAStart,
                      durationMinutes: segmentADuration,
                      timeZone: timezone,
                      anchorWorkDateYmd: effectiveOverrideDate,
                    })}
                  </span>
                </div>
              </div>
            </SalarySessionPanel>
            <div style={SALARY_BREAK_STRIP_STYLE}>
              <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem', color: '#374151' }}>Break</div>
              <label>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                <select
                  value={
                    templateBreakOptions.includes(splitBreakMinutes)
                      ? splitBreakMinutes
                      : (templateBreakOptions[0] ?? splitBreakMinutes)
                  }
                  onChange={(e) => setSplitBreakMinutes(Number(e.target.value))}
                  style={SALARY_SESSION_CONTROL_MAX}
                  disabled={templateBreakOptions.length === 0}
                >
                  {(templateBreakOptions.length > 0 ? templateBreakOptions : [0, 15, 30, 45, 60]).map((m) => (
                    <option key={m} value={m}>
                      {formatSegmentLengthHoursLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SalarySessionPanel title="Second session" variant="b">
              <div style={SALARY_SESSION_FIELDS_STACK}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Start</span>
                  <span>
                    {formatSalaryBlockEndDisplay({
                      startHhMm: segmentBStart,
                      durationMinutes: 0,
                      timeZone: timezone,
                      anchorWorkDateYmd: effectiveOverrideDate,
                    })}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                  <span>
                    {formatSegmentLengthHoursLabel(segmentBDuration)} · 8 h day total
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>End</span>
                  <span>
                    {formatSalaryBlockEndDisplay({
                      startHhMm: segmentBStart,
                      durationMinutes: segmentBDuration,
                      timeZone: timezone,
                      anchorWorkDateYmd: effectiveOverrideDate,
                    })}
                  </span>
                </div>
              </div>
            </SalarySessionPanel>
          </div>
        )}
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
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{
                ...SALARY_SESSION_FIELDS_ROW,
                marginBottom: ovMode === 'split' ? '0.75rem' : 0,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Override layout</span>
                <label style={{ marginRight: '0.75rem' }}>
                  <input
                    type="radio"
                    name="ov-mode"
                    checked={ovMode === 'continuous'}
                    onChange={() => {
                      setOvMode('continuous')
                      setOvADur(480)
                    }}
                  />{' '}
                  Straight
                </label>
                <label>
                  <input
                    type="radio"
                    name="ov-mode"
                    checked={ovMode === 'split'}
                    onChange={() => {
                      if (ovMode === 'continuous') {
                        setOvADur((d) => (d === 480 ? SPLIT_FIRST_BLOCK_DEFAULT_MINUTES : d))
                      }
                      setOvMode('split')
                    }}
                  />{' '}
                  Split
                </label>
              </div>
              {ovMode === 'continuous' ? (
                <>
                  <label>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>First start</span>
                    <input type="time" step={900} value={ovAStart} onChange={(e) => setOvAStart(e.target.value)} />
                  </label>
                  <span style={SALARY_END_HINT_STYLE}>
                    Day end:{' '}
                    {formatSalaryBlockEndDisplay({
                      startHhMm: ovAStart,
                      durationMinutes: 480,
                      timeZone: timezone,
                      anchorWorkDateYmd: effectiveOverrideDate,
                    })}
                  </span>
                </>
              ) : null}
            </div>
            {ovMode === 'split' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SalarySessionPanel title="First session (override)" variant="a">
                  <div style={SALARY_SESSION_FIELDS_STACK}>
                    <label>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Start</span>
                      <input
                        type="time"
                        step={900}
                        value={ovAStart}
                        onChange={(e) => setOvAStart(e.target.value)}
                        style={SALARY_SESSION_CONTROL_MAX}
                      />
                    </label>
                    <label>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                      <select
                        value={ovADur}
                        onChange={(e) => setOvADur(Number(e.target.value))}
                        style={SALARY_SESSION_CONTROL_MAX}
                      >
                        {durOptionsA.map((m) => (
                          <option key={m} value={m}>
                            {formatSegmentLengthHoursLabel(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>End</span>
                      <span>
                        {formatSalaryBlockEndDisplay({
                          startHhMm: ovAStart,
                          durationMinutes: ovADur,
                          timeZone: timezone,
                          anchorWorkDateYmd: effectiveOverrideDate,
                        })}
                      </span>
                    </div>
                  </div>
                </SalarySessionPanel>
                <div style={SALARY_BREAK_STRIP_STYLE}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem', color: '#374151' }}>
                    Break
                  </div>
                  <label>
                    <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                    <select
                      value={
                        overrideBreakOptions.includes(ovSplitBreakMinutes)
                          ? ovSplitBreakMinutes
                          : (overrideBreakOptions[0] ?? ovSplitBreakMinutes)
                      }
                      onChange={(e) => setOvSplitBreakMinutes(Number(e.target.value))}
                      style={SALARY_SESSION_CONTROL_MAX}
                      disabled={overrideBreakOptions.length === 0}
                    >
                      {(overrideBreakOptions.length > 0 ? overrideBreakOptions : [0, 15, 30, 45, 60]).map((m) => (
                        <option key={m} value={m}>
                          {formatSegmentLengthHoursLabel(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <SalarySessionPanel title="Second session (override)" variant="b">
                  <div style={SALARY_SESSION_FIELDS_STACK}>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Start</span>
                      <span>
                        {formatSalaryBlockEndDisplay({
                          startHhMm: ovBStart,
                          durationMinutes: 0,
                          timeZone: timezone,
                          anchorWorkDateYmd: effectiveOverrideDate,
                        })}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Length (hours)</span>
                      <span>
                        {formatSegmentLengthHoursLabel(ovBDuration)} · 8 h day total
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>End</span>
                      <span>
                        {formatSalaryBlockEndDisplay({
                          startHhMm: ovBStart,
                          durationMinutes: ovBDuration,
                          timeZone: timezone,
                          anchorWorkDateYmd: effectiveOverrideDate,
                        })}
                      </span>
                    </div>
                  </div>
                </SalarySessionPanel>
              </div>
            ) : null}
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
