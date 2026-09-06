import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { recordNavClick } from '../../lib/navClickTelemetry'
import {
  AGING_ITEM_OPENED_CONTROL,
  ageChipStyle,
  agingItemOpenedTarget,
  describeAge,
  HR_PENDING_REPORT_AGE,
  shouldRecordAgingOpen,
} from '../../lib/ageState'
import {
  formatHrReportWhen,
  sortPendingReportsOldestFirst,
  summarizePendingReportAging,
} from '../../lib/people/hrPendingReports'

/**
 * People → HR → "Pending reports" (v2.2235): the queue of field reports
 * masters/devs wrote from their Dashboard, waiting to be folded into a
 * person's HR file.
 *
 * Filing calls file_person_report, which appends an ordinary (append-only)
 * person_file_entries row dated when the thing HAPPENED and labeled with the
 * reporter — then marks the report filed. Dismissing keeps the text and a
 * required reason; nothing is deleted. The whole section hides when the queue
 * is empty, so the tab doesn't carry a permanent empty box.
 *
 * Oldest first with an age chip (journey-map #40): the report that has waited
 * eleven days leads the list and reads red, not gray under this morning's.
 */

export type PendingReport = {
  id: string
  subject_person_id: string
  author_name: string
  occurred_date: string
  content: string
  created_at: string
}

export function HrPendingReportsSection({
  nameForPerson,
  onOpenPerson,
  onFiled,
}: {
  nameForPerson: (personId: string) => string
  onOpenPerson: (personId: string) => void
  onFiled: () => void
}) {
  const { showToast } = useToastContext()
  const { user: authUser, role } = useAuth()
  const [rows, setRows] = useState<PendingReport[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dismissId, setDismissId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('person_reports')
      .select('id, subject_person_id, author_name, occurred_date, content, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      setRows([])
      return
    }
    setRows(sortPendingReportsOldestFirst((data ?? []) as PendingReport[]))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (rows == null || rows.length === 0) return null

  const aging = summarizePendingReportAging(rows, 0)
  // Rows are oldest-first, so the head of the list is the oldest report.
  const oldestAge = describeAge(rows[0]!.created_at, undefined, HR_PENDING_REPORT_AGE)

  function openPerson(r: PendingReport) {
    const age = describeAge(r.created_at, undefined, HR_PENDING_REPORT_AGE)
    if (age && shouldRecordAgingOpen(age.state)) {
      recordNavClick(authUser?.id, role, AGING_ITEM_OPENED_CONTROL, agingItemOpenedTarget('hr-pending-report', age.days, age.state))
    }
    onOpenPerson(r.subject_person_id)
  }

  async function file(id: string) {
    setBusyId(id)
    const { error } = await supabase.rpc('file_person_report', { p_report_id: id })
    if (error) showToast(`Could not file: ${error.message}`, 'error')
    else {
      showToast('Filed as a dated entry on their record.', 'success')
      onFiled()
    }
    await load()
    setBusyId(null)
  }

  async function dismiss(id: string) {
    if (reason.trim() === '') return
    setBusyId(id)
    const { error } = await supabase.rpc('dismiss_person_report', { p_report_id: id, p_reason: reason.trim() })
    if (error) showToast(`Could not dismiss: ${error.message}`, 'error')
    else showToast('Dismissed — the report and your reason are kept.', 'success')
    setDismissId(null)
    setReason('')
    await load()
    setBusyId(null)
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    font: 'inherit',
    fontSize: '0.76rem',
    fontWeight: 650,
    padding: '0.25rem 0.6rem',
    borderRadius: 6,
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? '#2563eb' : 'transparent',
    color: primary ? 'var(--surface)' : 'var(--text-link)',
    cursor: 'pointer',
  })

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Pending reports</h3>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, background: 'var(--bg-subtle)', color: 'var(--text-amber-700)' }}>
          {rows.length} waiting
        </span>
        {aging && aging.oldestAgeDays > 0 ? (
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ageChipStyle(oldestAge?.state ?? 'fresh').color }}>
            oldest {aging.oldestAgeDays} {aging.oldestAgeDays === 1 ? 'day' : 'days'}
          </span>
        ) : null}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          written from the field, oldest first — filing appends a dated entry on that person’s record
        </span>
      </div>

      {rows.map((r) => {
        const age = describeAge(r.created_at, undefined, HR_PENDING_REPORT_AGE)
        return (
        <div key={r.id} style={{ border: `1px solid ${age?.state === 'red' ? 'var(--border-red)' : age?.state === 'amber' ? 'var(--border-amber)' : 'var(--border)'}`, borderRadius: 8, padding: '0.65rem 0.75rem', marginBottom: '0.5rem', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>About {nameForPerson(r.subject_person_id)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
              {age ? (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.45rem', borderRadius: 7, whiteSpace: 'nowrap', ...ageChipStyle(age.state) }}>
                  {age.label}
                </span>
              ) : null}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatHrReportWhen(r)}</span>
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-700)', margin: '0.45rem 0 0', whiteSpace: 'pre-wrap', borderLeft: '3px solid var(--border)', paddingLeft: '0.65rem' }}>
            {r.content}
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
            <button type="button" style={btn(true)} disabled={busyId === r.id} onClick={() => void file(r.id)}>
              {busyId === r.id ? 'Filing…' : `File to ${nameForPerson(r.subject_person_id)}’s record`}
            </button>
            <button type="button" style={btn(false)} onClick={() => openPerson(r)}>
              Open their file
            </button>
            <button type="button" style={btn(false)} onClick={() => { setDismissId(dismissId === r.id ? null : r.id); setReason('') }}>
              Dismiss…
            </button>
          </div>
          {dismissId === r.id ? (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this not going on the record?"
                style={{ flex: '1 1 220px', font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
              />
              <button type="button" style={{ ...btn(false), color: 'var(--text-red-600)' }} disabled={reason.trim() === '' || busyId === r.id} onClick={() => void dismiss(r.id)}>
                Confirm dismiss
              </button>
            </div>
          ) : null}
        </div>
        )
      })}
    </div>
  )
}
