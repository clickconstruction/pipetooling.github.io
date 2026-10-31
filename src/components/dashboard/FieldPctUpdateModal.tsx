import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { fieldPctDeltaLabel, fieldPctStartValue } from '../../lib/jobs/fieldPctUpdate'
import { propagateReportPctToJob } from '../../lib/propagateReportPctToJob'
import { submitStatusReportFromStepper } from '../../lib/reports/submitStatusReportFromStepper'
import { REPORT_FIELD_LABEL_STAGE_PROGRESS } from '../../lib/reports/stageProgressReport'
import { LINES_QUESTION, MARK_EACH_LINE_LINK, lineProgressFieldValue } from '../../lib/reports/lineProgressReport'
import { STAGE_PCT_WORDS, STAGE_QUICK_PICK_MIN_HEIGHT, saveWords } from '../../lib/reports/stagePct'
import { stampMovedLines, useJobLineProgress } from '../../hooks/useJobLineProgress'
import { ReportLinesProgressField } from '../ReportLinesProgressField'
import { StagePctControl } from '../reports/StagePctControl'
import { MarkJobReadyToBillPrompt } from '../jobs/MarkJobReadyToBillPrompt'
import { PhoneSheet } from '../PhoneSheet'
import AutosizeTextarea from '../AutosizeTextarea'

const BAR_BASE_COLOR = '#3b82f6'
const BAR_GAIN_COLOR = '#16a34a'
const BAR_DROP_COLOR = '#d97706'

/**
 * Field "% done" stepper (v2.1806): subs and helpers move a job's percent
 * complete from their My Schedule cards — ±1/±5/±20 chips, a live
 * "45% → 65% (▲ 20)" preview over the same blue/green bar idiom as the card,
 * and an optional note.
 *
 * Since v2.2078 (owner decision) a save FILES A STATUS REPORT — the percent
 * and note land on the Status Report template via
 * `submitStatusReportFromStepper`, then the shared report pipeline runs:
 * `propagateReportPctToJob` mirrors the % into jobs_ledger (thread note, day
 * deltas, Stages), and 100% on a Working job chains into the same
 * MarkJobReadyToBillPrompt as Leave Report. So both doors — the stepper and
 * the report modal — are one flow: report → % mirror → Ready to Bill. The
 * report clears the Report-due reminder and counts in the reports chip.
 * If no Status Report template exists, the save falls back to the legacy
 * bare-% write (set_job_pct_from_field) so the field never strands.
 *
 * The saved-from base is fetched fresh on open — the card's cached % can lag
 * another crew member's update.
 *
 * Report by line (punch list #130, v2.5664): on a job with two or more priced
 * lines the stepper opens the same list Leave Report shows (`useJobLineProgress`,
 * `ReportLinesProgressField`) — each line its own number, the job's number
 * derived from their shares — and files the same Status Report with the moved
 * lines named under "Stage progress".
 *
 * Phone first (punch list #189, PR 5a): the window is a sheet from the bottom on a
 * phone (`PhoneSheet`), opened from the press bar's % done on the clocked-in job
 * as well as from My Schedule's card, and the ±1/±5/±20 chips are gone: a
 * one-line job takes the same precise-number control the stage rows take
 * (`StagePctControl`: quick picks at 48 px, −5 and +5 at 56 px, or a typed
 * number), and behind "Set the whole-job % instead" so does every job. Not now
 * and Save stand in the sheet's foot, Save naming what it writes.
 */
export default function FieldPctUpdateModal({
  job,
  onClose,
  onSaved,
}: {
  job: {
    id: string
    /** Display number for the title / RTB prompt (e.g. "J949"). */
    hcpNumber: string
    jobName: string
    /** e.g. "J949 · Dominguez- Run camera" — the card's row label. */
    label: string
  }
  onClose: () => void
  /** Fired after a successful save (and after the RTB prompt, when shown). */
  onSaved: (newPct: number) => void
}) {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const [base, setBase] = useState<number | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  /** A save's refusal, under the note. */
  const [error, setError] = useState<string | null>(null)
  /** The job's failed read with its class: a lost signal offers Retry and reads again when it comes back (v2.5962). */
  const [loadFailure, setLoadFailure] = useState<OfflineRecoveryLastError | null>(null)
  /** Bumped by Retry: the read below runs again. */
  const [reloadKey, setReloadKey] = useState(0)
  const [rtbJob, setRtbJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [savedPct, setSavedPct] = useState<number | null>(null)
  // Report by line (v2.5664): the job's priced lines, two or more; null = the ± chips as before.
  const lineProgress = useJobLineProgress(job.id, true)
  const linesActive = lineProgress.lines != null

  useEffect(() => {
    let cancelled = false
    setLoadFailure(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').select('pct_complete, status').eq('id', job.id).maybeSingle(),
          'load job',
        )
        if (cancelled) return
        const row = data as { pct_complete: number | null; status: string | null } | null
        const start = fieldPctStartValue(row?.pct_complete ?? null, row?.status ?? null)
        setBase(start)
        setNext(start)
        setJobStatus(row?.status ?? null)
      } catch (e) {
        if (!cancelled) setLoadFailure(recoveryFailureFromError(e, "Couldn't load the job"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.id, reloadKey])

  /** Legacy bare-% write — the pre-v2.2078 path, kept as the no-template fallback. */
  const saveLegacyPctOnly = async () => {
    const data = await withSupabaseRetry(
      async () =>
        supabase.rpc('set_job_pct_from_field', {
          p_job_id: job.id,
          p_pct: saveValue!,
          p_note: note.trim() || undefined,
        }),
      'field pct update',
    )
    const r = data as { ok?: boolean; error?: string } | null
    if (!r?.ok) throw new Error(r?.error || 'Could not save the update')
  }

  // The number a save writes: by line, what the lines say once something moved (else the base, as a
  // note-only save keeps today's number); by chips, the stepped value.
  const linesNext = linesActive ? (lineProgress.moved.length > 0 ? lineProgress.derivedPct : base) : null
  const saveValue = linesActive ? linesNext : next

  const save = async () => {
    if (base == null || saveValue == null || saving) return
    setSaving(true)
    setError(null)
    try {
      let effectiveStatus: string | null = jobStatus
      if (authUser?.id) {
        const moves = linesActive && lineProgress.lines ? lineProgressFieldValue(lineProgress.lines, lineProgress.picks, base) : ''
        const res = await submitStatusReportFromStepper({
          authUserId: authUser.id,
          jobId: job.id,
          pct: saveValue,
          note,
          ...(moves ? { extraFields: { [REPORT_FIELD_LABEL_STAGE_PROGRESS]: moves } } : null),
        })
        if (res.ok) {
          // Report by line: stamp each moved line on its row, best-effort.
          if (linesActive && lineProgress.moved.length > 0) await stampMovedLines(job.id, lineProgress.moved, res.reportId)
          // Shared report pipeline: mirror the % into jobs_ledger (thread note,
          // Stages, day deltas). The report itself is already saved.
          const { jobStatus: freshStatus, pctError } = await propagateReportPctToJob(job.id, res.fieldValues)
          if (pctError) {
            showToast(`Report saved, but the job's % done could not update: ${pctError}`, 'warning')
          }
          effectiveStatus = freshStatus ?? jobStatus
          showToast(`Report saved — ${job.hcpNumber} is now ${saveValue}% done.`, 'success')
        } else if (res.reason === 'no_template') {
          await saveLegacyPctOnly()
          showToast(`Saved — ${job.hcpNumber} is now ${saveValue}% done.`, 'success')
        } else {
          throw new Error(res.message)
        }
      } else {
        await saveLegacyPctOnly()
        showToast(`Saved — ${job.hcpNumber} is now ${saveValue}% done.`, 'success')
      }
      if (saveValue === 100 && effectiveStatus === 'working') {
        setSavedPct(saveValue)
        setRtbJob({ id: job.id, hcpNumber: job.hcpNumber, jobName: job.jobName })
        return
      }
      onSaved(saveValue)
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not save the update'))
    } finally {
      setSaving(false)
    }
  }

  if (rtbJob) {
    return (
      <MarkJobReadyToBillPrompt
        job={rtbJob}
        onClose={() => {
          setRtbJob(null)
          if (savedPct != null) onSaved(savedPct)
          onClose()
        }}
      />
    )
  }

  const delta = base != null && next != null ? fieldPctDeltaLabel(base, next) : null
  const loaded = base != null && next != null
  const canSave = loaded && !saving && (linesActive ? lineProgress.moved.length > 0 || note.trim() !== '' : next !== base || note.trim() !== '')
  const barBase = loaded ? Math.min(base, next) : 0
  const barChange = loaded ? Math.abs(next - base) : 0
  const footBtn: CSSProperties = {
    minHeight: STAGE_QUICK_PICK_MIN_HEIGHT,
    padding: '0.55rem 0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <PhoneSheet label={`Update % done for ${job.label}`} title={linesActive ? LINES_QUESTION : 'How done is this job?'} width={440} zIndex={1100} onClose={onClose}>
      <div style={{ padding: '0.5rem 1rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)', flex: 'none' }}>{job.label}</div>
      <div style={{ overflowY: 'auto', minHeight: 0, padding: '0.5rem 1rem 0.75rem' }}>
        {linesActive && lineProgress.lines && loaded ? (
          <ReportLinesProgressField
            rows={lineProgress.lines}
            picks={lineProgress.picks}
            openId={lineProgress.openId}
            onOpen={lineProgress.setOpenId}
            onPct={lineProgress.setPick}
            recordedPct={base}
            onSwitchToWholeJob={() => lineProgress.setLinesMode(false)}
          />
        ) : null}

        {!linesActive ? (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
            {loaded ? (
              <>
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{base}%</span>
                <span aria-hidden style={{ color: 'var(--text-faint)' }}>→</span>
                <span style={{ fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{next}%</span>
                {delta ? (
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color:
                        delta.tone === 'up'
                          ? 'var(--text-green-600)'
                          : delta.tone === 'down'
                            ? 'var(--text-amber-800)'
                            : 'var(--text-faint)',
                    }}
                  >
                    {delta.label}
                  </span>
                ) : null}
              </>
            ) : loadFailure ? (
              // A read is safe to repeat: when the signal returns the job reads again by itself.
              <OfflineRetryPanel failure={loadFailure} onRetry={() => setReloadKey((n) => n + 1)} surface="field-pct" idempotent />
            ) : (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</span>
            )}
          </div>
        ) : null}

        {/* Same bar idiom as the schedule card (v2.1567): blue = where it was,
            green = the gain being proposed (amber = a downward correction). */}
        {!linesActive && loaded ? (
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-muted)', marginTop: '0.75rem' }}>
            <span style={{ width: `${barBase}%`, background: BAR_BASE_COLOR }} />
            <span style={{ width: `${barChange}%`, background: next < base ? BAR_DROP_COLOR : BAR_GAIN_COLOR }} />
          </div>
        ) : null}

        {/* A one-stage job: the same control a stage row takes, alone for the job (punch list #189, PR 5a). */}
        {!linesActive && loaded ? (
          <div style={{ marginTop: '1rem' }}>
            <StagePctControl name="Job" value={next} onChange={setNext} disabled={saving} />
          </div>
        ) : null}

        {lineProgress.hasLines && !lineProgress.linesMode ? (
          <button
            type="button"
            onClick={() => lineProgress.setLinesMode(true)}
            style={{ marginTop: '0.5rem', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600 }}
          >
            {MARK_EACH_LINE_LINK}
          </button>
        ) : null}

        <label style={{ display: 'block', marginTop: '0.9rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            What got done? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — saving files a report for the office)</span>
          </span>
          <AutosizeTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            minRows={2}
            placeholder="Set fixtures in units 3–5, waiting on parts for 6…"
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.5rem', fontFamily: 'inherit', fontSize: '1rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </label>

        {error && loaded ? (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>
        ) : null}
      </div>

      {/* The foot: Not now beside Save, the one press the thumb reaches last (the mock-up's section 4). */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: '0.5rem', padding: '0.6rem 1rem 0.75rem', borderTop: '1px solid var(--border)', flex: 'none' }}>
        <button type="button" onClick={onClose} style={{ ...footBtn, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }}>
          {STAGE_PCT_WORDS.notNow}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          style={{
            ...footBtn,
            background: canSave ? '#2563eb' : 'var(--bg-muted)',
            color: canSave ? '#fff' : 'var(--text-muted)',
            border: 'none',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : !loaded ? 'Save' : linesActive ? saveWords({ jobPct: saveValue ?? 0 }) : `Save ${next}%`}
        </button>
      </div>
    </PhoneSheet>
  )
}
