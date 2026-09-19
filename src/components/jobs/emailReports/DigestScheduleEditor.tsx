import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { APP_CALENDAR_TZ } from '../../../utils/dateUtils'
import { WEEKDAYS, defaultWeekdays, fromPgTime, toPgTime } from '../../../lib/reports/digestScheduleFields'
import type { ScheduleRow } from './useEmailReportsData'

/**
 * One digest schedule — name · enabled · days · 15-minute time (v2.3595; the schedule half of
 * the retired `RecurringDigestsPanel`'s inline editor, without its recipients table). Who is
 * on the schedule is each person's business now: the person editor writes recipient rows one
 * by one, so saving a schedule here never touches them.
 */
export function DigestScheduleEditor({
  schedule,
  scopeMasterId,
  authUserId,
  onDone,
  onCancel,
}: {
  schedule: ScheduleRow | null
  scopeMasterId: string | null
  authUserId: string | undefined
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [name, setName] = useState(schedule?.name ?? 'Daily recap')
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true)
  const [timeHm, setTimeHm] = useState(schedule ? fromPgTime(schedule.time_local ?? undefined) : '07:00')
  const [days, setDays] = useState<number[]>(() =>
    schedule ? [...(Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [])].sort((a, b) => a - b) : defaultWeekdays(),
  )
  const [saving, setSaving] = useState(false)
  const timezone = schedule?.timezone ?? APP_CALENDAR_TZ

  function toggleDay(bit: number) {
    setDays((d) => (d.includes(bit) ? d.filter((x) => x !== bit) : [...d, bit].sort((a, b) => a - b)))
  }

  async function save() {
    const [, mm] = timeHm.split(':').map((x) => Number.parseInt(x, 10))
    if ((mm ?? NaN) % 15 !== 0) {
      showToast('Pick a time on a 15-minute boundary (cron runs every 15 minutes)', 'warning')
      return
    }
    if (!name.trim()) {
      showToast('Give the schedule a name', 'warning')
      return
    }
    if (!authUserId) return
    const scopeMaster = schedule?.scope_master_user_id ?? scopeMasterId
    if (!scopeMaster) {
      showToast('Choose scope leader user', 'warning')
      return
    }
    setSaving(true)
    try {
      if (!schedule) {
        const { error } = await supabase.from('recurring_job_report_schedules').insert({
          name: name.trim(),
          enabled,
          time_local: toPgTime(timeHm),
          days_of_week: days,
          timezone,
          reporting_preset: 'prior_calendar_day',
          scope_master_user_id: scopeMaster,
          created_by: authUserId,
        })
        if (error) throw error
        showToast('Schedule created — add people to it from their rows.', 'success')
      } else {
        const { error } = await supabase
          .from('recurring_job_report_schedules')
          .update({ name: name.trim(), enabled, time_local: toPgTime(timeHm), days_of_week: days, timezone, updated_at: new Date().toISOString() })
          .eq('id', schedule.id)
        if (error) throw error
        showToast('Schedule updated', 'success')
      }
      await onDone()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!schedule) return
    const ok = await confirmDialog({ message: `Delete "${schedule.name}"?\n\nEveryone on it stops getting this digest.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    setSaving(true)
    try {
      const { error } = await supabase.from('recurring_job_report_schedules').delete().eq('id', schedule.id)
      if (error) throw error
      showToast('Schedule deleted', 'success')
      await onDone()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="digest-schedule-editor" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem', background: 'var(--bg-subtle)' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{schedule ? `Edit schedule — ${schedule.name}` : 'New schedule'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '0.4rem 0.5rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
          Send time ({timezone})
          <input type="time" step={900} value={timeHm} onChange={(e) => setTimeHm(e.target.value)} style={{ padding: '0.4rem 0.5rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }}>
          <span>Enabled</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: '1.25rem', height: '1.25rem' }} />
        </label>
      </div>
      <div style={{ marginTop: 10, fontSize: '0.8125rem' }}>
        <strong>Days</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {WEEKDAYS.map((d) => (
            <label key={d.bit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={days.includes(d.bit)} onChange={() => toggleDay(d.bit)} />
              {d.label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
        <button type="button" onClick={() => void save()} disabled={saving} style={{ padding: '0.45rem 0.9rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}>
          {saving ? '…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '0.45rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}>
          Cancel
        </button>
        {schedule ? (
          <button type="button" onClick={() => void remove()} disabled={saving} style={{ marginLeft: 'auto', padding: '0.45rem 0.9rem', background: 'none', color: 'var(--text-red-700)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}>
            Delete schedule
          </button>
        ) : null}
      </div>
    </div>
  )
}
