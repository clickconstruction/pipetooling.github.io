import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { LIEN_LAST_WORK_CLEAR, lienLastWorkDay, lienLastWorkDayPatch, lienLastWorkDayProblem, lienLastWorkSourceLine, type LienLastWorkJob } from '../../lib/jobs/lienLastWorkDay'
import { FinishedDateInput } from '../FinishedDateInput'
import { LienLastWorkDayConfirm } from './LienLastWorkDayConfirm'

/**
 * The last day of work, on one line (v2.4676): the day, a chip saying where it came from (clock
 * hours, the job's creation, or a person), the reason when a person set it, and *Change ›* to set
 * it by hand — a day and a one-line reason, saved on the job. Clock hours and pay are never
 * touched, and the line says so. Drawn above the Months card on the Lien desk and in Edit Job's
 * lien row; the caller re-reads after a save. Since v2.4717 *Save the day* opens a window first
 * (`LienLastWorkDayConfirm`): how far the day moves from the hours, the dates that move with it,
 * and the reason, asked there; the write happens on its *Set the day*.
 */
const chip = (tone: 'hand' | 'hours' | 'created'): CSSProperties => ({
  display: 'inline-block',
  padding: '0 7px',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 700,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  background: tone === 'hand' ? 'var(--bg-green-tint)' : tone === 'hours' ? 'var(--bg-blue-tint)' : 'var(--bg-amber-tint)',
  color: tone === 'hand' ? 'var(--text-green-800)' : tone === 'hours' ? 'var(--text-blue-700)' : 'var(--text-amber-800)',
})
const btn = (primary = false): CSSProperties => ({ padding: '4px 10px', borderRadius: 7, border: primary ? '1px solid transparent' : '1px solid var(--border-strong)', background: primary ? '#2563eb' : 'var(--surface)', color: primary ? '#fff' : 'var(--text-700)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' })

export function LienLastWorkDayLine({
  jobId,
  job,
  todayYmd,
  canEdit,
  userId,
  setByName,
  onSaved,
  jobLabel,
  clockMonths,
  noticedMonths,
  propertyKind,
}: {
  jobId: string
  job: LienLastWorkJob | null | undefined
  todayYmd: string
  canEdit: boolean
  userId: string | null
  /** The name behind `lien_last_work_set_by`, when the caller knows it. */
  setByName?: string | null
  /** After a save or a clear: the caller re-reads the job and the desk. */
  onSaved: () => void
  /** "922 · Michael Palmer" — the window's subtitle. */
  jobLabel?: string
  /** The months with approved hours (YYYY-MM), for the window's dates; the Edit Job row has none. */
  clockMonths?: ReadonlyArray<string>
  noticedMonths?: ReadonlyArray<string>
  /** 'residential' | 'commercial'; '' or absent draws the words without the table. */
  propertyKind?: string
}) {
  const { showToast } = useToastContext()
  const d = lienLastWorkDay(job)
  const [editing, setEditing] = useState(false)
  const [dayDraft, setDayDraft] = useState(d.day ?? '')
  const [noteDraft, setNoteDraft] = useState(d.note)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    setEditing(false)
    setConfirming(false)
    setDayDraft(d.day ?? '')
    setNoteDraft(d.note)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.lien_last_work_on, job?.last_work_date])

  const write = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true)
    const { error } = await supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)
    setBusy(false)
    if (error) {
      showToast(`Could not save the last day of work: ${error.message}`, 'error')
      return
    }
    showToast(done, 'success')
    setConfirming(false)
    setEditing(false)
    onSaved()
  }
  // Save the day opens the window (v2.4717); the write is its Set the day, after the day and the reason stand.
  const save = () => setConfirming(true)
  const confirm = () => {
    const problem = lienLastWorkDayProblem(dayDraft, job?.last_work_date ?? null, todayYmd)
    if (problem || !noteDraft.trim()) return
    void write(lienLastWorkDayPatch(dayDraft, noteDraft, userId, new Date().toISOString()), `Last day of work set to ${formatYmdMonthDay(dayDraft)}. The lien months follow it; clock hours are untouched.`)
  }
  const clear = () => void write(LIEN_LAST_WORK_CLEAR, job?.last_work_date ? 'Back to the clock hours.' : "Back to the job's creation day.")

  return (
    <div data-testid="lien-last-work" data-source={d.source} style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last day of work</span>
        <strong data-testid="lien-last-work-day">{d.day ? formatYmdMonthDay(d.day) : 'none yet'}</strong>
        <span style={chip(d.source)} data-testid="lien-last-work-source">{lienLastWorkSourceLine(d, setByName)}</span>
        {d.note ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }} data-testid="lien-last-work-note">“{d.note}”</span> : null}
        {canEdit && !editing ? (
          <button type="button" onClick={() => setEditing(true)} data-testid="lien-last-work-change" style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }}>
            Change ›
          </button>
        ) : null}
      </div>
      {editing ? (
        <div data-testid="lien-last-work-editor" style={{ display: 'grid', gap: 8, padding: '0.6rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 3, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last day of work
              <FinishedDateInput aria-label="Last day of work" value={dayDraft} onCommit={(day) => setDayDraft(day ?? '')} style={{ padding: '0.3rem 0.4rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }} />
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 16rem', minWidth: 0 }}>Save the day shows what moves with it before anything is written, and asks why.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={save} disabled={busy} data-testid="lien-last-work-save" style={btn(true)}>
              {busy ? 'Saving…' : 'Save the day'}
            </button>
            {d.source === 'hand' ? (
              <button type="button" onClick={clear} disabled={busy} data-testid="lien-last-work-clear" style={btn()}>
                {job?.last_work_date ? 'Back to clock hours' : "Back to the job's creation day"}
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing(false)} disabled={busy} style={btn()}>
              Cancel
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clock hours and pay are not changed. The day sets the lien months only.</span>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <LienLastWorkDayConfirm
          jobLabel={jobLabel ?? ''}
          input={{ currentDay: d.day, currentSource: d.source, lastSessionDay: job?.last_work_date ?? null, clockMonths: clockMonths ?? [], noticedMonths: noticedMonths ?? [], propertyKind: propertyKind ?? '', todayYmd }}
          day={dayDraft}
          onDay={setDayDraft}
          note={noteDraft}
          onNote={setNoteDraft}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
          busy={busy}
        />
      ) : null}
    </div>
  )
}
