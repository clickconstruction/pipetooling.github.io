import { useEffect, useState, type CSSProperties } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { lienHoursAfterHandDay, lienHoursAfterHandDayWords, LIEN_LAST_WORK_CLEAR, lienLastWorkDay, lienLastWorkSourceLine, type LienLastWorkJob } from '../../lib/jobs/lienLastWorkDay'
import { lienLastWorkClearedWords } from '../../lib/jobs/lienLastWorkDoor'
import { FinishedDateInput } from '../FinishedDateInput'
import { LienLastWorkDayWindow } from './LienLastWorkDayWindow'
import { useLienLastWorkDayWrite } from './useLienLastWorkDayWrite'

/**
 * The last day of work, on one line (v2.4676): the day, a chip saying where it came from (clock
 * hours, the job's creation, or a person), the reason when a person set it, and *Change ›* to set
 * it by hand — a day and a one-line reason, saved on the job. Clock hours and pay are never
 * touched, and the line says so. Drawn as the first row of the Months card on the Lien desk (`flat`,
 * no box of its own) and in Edit Job's lien row; the caller re-reads after a save. Since v2.7447 (punch list #335) the day may be earlier
 * than the clock hours, and the window says what that takes off the lien clock. Since v2.4717 *Save the day* opens a window first
 * (`LienLastWorkDayConfirm`): how far the day moves from the hours, the dates that move with it,
 * and the reason, asked there; the write happens on its *Set the day*. Since v2.7684 that window and
 * its write are `LienLastWorkDayWindow`, which the timeline's press under LAST WORK opens too.
 */
const chip = (tone: 'hand' | 'hours' | 'bill' | 'created'): CSSProperties => ({
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
  affidavitMonths,
  propertyKind,
  startEditing = false,
  onCancel,
  flat = false,
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
  /** "922 · Michael Palvern" — the window's subtitle. */
  jobLabel?: string
  /** The months with approved hours (YYYY-MM), for the window's dates; the Edit Job row has none. */
  clockMonths?: ReadonlyArray<string>
  noticedMonths?: ReadonlyArray<string>
  /** The months the job's approved or filed affidavit names (v2.7447), when the caller holds the paper. */
  affidavitMonths?: ReadonlyArray<string>
  /** 'residential' | 'commercial'; '' or absent draws the words without the table. */
  propertyKind?: string
  /** Open on the editor (v2.4733): the Lien window draws the line only when its timeline's *change ›* is pressed. */
  startEditing?: boolean
  /** Cancel pressed: the Lien window folds the line away again. */
  onCancel?: () => void
  /** No box of its own (punch list #361): the line is the first row of the Lien desk's Months card, on the card's hairline. */
  flat?: boolean
}) {
  const d = lienLastWorkDay(job)
  const laterHoursDay = lienHoursAfterHandDay(job)
  const [editing, setEditing] = useState(startEditing)
  const [dayDraft, setDayDraft] = useState(d.day ?? '')
  const [confirming, setConfirming] = useState(false)
  // Back to the clock hours writes through the same door as the window's Set the day (`useLienLastWorkDayWrite`).
  const { busy, write } = useLienLastWorkDayWrite(jobId, onSaved)
  useEffect(() => {
    // Back to how the line opened (the Lien window opens it editing) whenever the job or its day changes.
    setEditing(startEditing)
    setConfirming(false)
    setDayDraft(d.day ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.lien_last_work_on, job?.last_work_date])

  // Save the day opens the window (v2.4717); the write is its Set the day, after the day and the reason stand.
  const save = () => setConfirming(true)
  const clear = () =>
    void write(LIEN_LAST_WORK_CLEAR, lienLastWorkClearedWords(Boolean(job?.last_work_date))).then((saved) => {
      if (saved) setEditing(false)
    })

  return (
    <div data-testid="lien-last-work" data-source={d.source} data-flat={flat ? 'yes' : undefined} style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', ...(flat ? null : { padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }) }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last day of work</span>
        <strong data-testid="lien-last-work-day">{d.day ? formatYmdMonthDay(d.day) : 'none yet'}</strong>
        <span style={chip(d.source)} data-testid="lien-last-work-source">{lienLastWorkSourceLine(d, setByName)}</span>
        {d.note ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }} data-testid="lien-last-work-note">“{d.note}”</span> : null}
        {/* v2.7193, punch list #335, row 1: hours approved after a day set by hand do not move it, and the line says they are there. */}
        {laterHoursDay ? <span style={{ color: 'var(--text-amber-700)', fontSize: '0.78rem', fontWeight: 600 }} data-testid="lien-last-work-later-hours">{lienHoursAfterHandDayWords(laterHoursDay)}</span> : null}
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
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                onCancel?.()
              }}
              disabled={busy}
              style={btn()}
            >
              Cancel
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clock hours and pay are not changed. The day sets the lien months only.</span>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <LienLastWorkDayWindow
          jobId={jobId}
          job={job}
          todayYmd={todayYmd}
          userId={userId}
          onSaved={() => {
            setEditing(false)
            onSaved()
          }}
          onClose={() => setConfirming(false)}
          jobLabel={jobLabel}
          clockMonths={clockMonths}
          noticedMonths={noticedMonths}
          affidavitMonths={affidavitMonths}
          propertyKind={propertyKind}
          day={dayDraft}
          onDay={setDayDraft}
        />
      ) : null}
    </div>
  )
}
