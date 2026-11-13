import { useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { batchOutcomeWords } from '../../lib/batchWords'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { dispatchPayCalendarChanged, loadDevelopmentJobIds, loadPayCalendarJobs, loadPayerPayCalendars, loadPayerReceipts, savePayCalendar, type PayCalendarJobFacts, type PayCalendarSave } from '../../lib/jobs/payCalendarIo'
import {
  JOB_NO_CALENDAR_WORDS,
  PAY_CALENDAR_CLAUSE_MAX,
  PAY_CALENDAR_DEFAULT,
  PAY_CALENDAR_WORDS_MAX,
  latenessAgainst,
  latenessWords,
  payCalendarPreview,
  payCalendarShort,
  payCalendarWords,
  normalizePayCalendar,
  type PayCalendar,
  type PayCalendarReceipt,
  type PayCalendarRow,
} from '../../lib/jobs/payCalendar'
import type { PayCalendarJob } from '../../lib/jobs/payCalendarJob'
import PayCalendarFields, { payCalendarLabelStyle } from './PayCalendarFields'

/**
 * Pay calendar · <payer> (punch list #323): the day bills must be in by, the day they pay, and
 * how many months later. Three choices and a note, for a payer who pays on a set day of the
 * month. The window says the calendar back in plain dates before it is saved, and replays the
 * payer's measured payments against what is typed: the contract says when a bill is due, the
 * record says when it lands. Opened through `usePayCalendarModal`. The save goes through
 * `set_payer_pay_calendar`, which decides who may and stamps who did.
 *
 * Opened with terms an estimator read on a won bid (`initial.calendar`, the owner's call of
 * 2026-11-13) it starts on those terms and on whose they are, and says where they came from.
 * From New Job the job is not made yet (`jobToBe`): the window can still be for that job alone,
 * and hands the calendar back to set with the job instead of saving it.
 *
 * Opened from a job's row it also knows the job (PR 4). A switch at the top picks who the
 * calendar is for: every job the payer pays, or that job alone. A job can carry its own
 * calendar, or none, and one in a development can set the development's other jobs with it.
 */

export type { PayCalendarJob } from '../../lib/jobs/payCalendarJob'

type Scope = 'payer' | 'job'

/** What an opener can start the window with when nothing is stored for what it opens on. */
export type PayCalendarInitial = {
  clause?: string
  words?: string
  /** Terms read elsewhere (an estimator's job draft): the form starts on them, whatever is stored. */
  calendar?: PayCalendar | null
  /** Whose those terms are: the scope the window opens on. */
  scope?: Scope
  /** Where they came from, in a few words: "Dana Whitfield’s draft". */
  from?: string | null
}

/** A job New Job has not made yet: its name, and where the calendar goes when the office agrees. */
export type PayCalendarJobToBe = {
  label: string
  onUse: (calendar: PayCalendarSave) => void
}

const labelStyle = payCalendarLabelStyle
const boxStyle = { margin: '0.75rem 0 0', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem' } as const

function setAtWords(row: PayCalendarRow | null): string | null {
  if (!row?.setAt) return null
  const day = new Date(row.setAt)
  if (Number.isNaN(day.getTime())) return null
  const when = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return row.setByName ? `Set by ${row.setByName} on ${when}.` : `Set on ${when}.`
}

export default function PayCalendarModal({
  payerId,
  payerName,
  job = null,
  jobToBe = null,
  initial = null,
  zIndex = 1200,
  onClose,
  onSaved,
  onOpenJob,
}: {
  payerId: string
  payerName: string
  /** The job the press sat on; absent, the window is the payer's alone. */
  job?: PayCalendarJob | null
  /** A job not made yet (New Job): the window can be for it alone, and hands the calendar back instead of saving. Ignored with a `job`. */
  jobToBe?: PayCalendarJobToBe | null
  /** A clause and its words to start from when nothing is stored for what the window opens on (PR 7): the paper the press sat on. Or whole terms read elsewhere. */
  initial?: PayCalendarInitial | null
  /** The layer to draw at; 1200 unless the opener is itself a window above that. */
  zIndex?: number
  onClose: () => void
  onSaved?: () => void
  /** Reopens the window on one of the payer's jobs (punch list #341): the list of jobs that carry their own calendar is then a list of presses. Absent, it names them only. */
  onOpenJob?: (job: PayCalendarJob) => void
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const isTopmost = useModalStackEntry()
  const titleId = useId()
  const canSet = isStagesOfficeRole(role)

  const [payerRow, setPayerRow] = useState<PayCalendarRow | null>(null)
  const [jobRow, setJobRow] = useState<PayCalendarRow | null>(null)
  /** Every job that carries a row of its own under this payer (punch list #341): the payer's window lists them, so its calendar never claims a job it does not reach. */
  const [ownJobRows, setOwnJobRows] = useState<PayCalendarRow[]>([])
  const [ownJobFacts, setOwnJobFacts] = useState<ReadonlyMap<string, PayCalendarJobFacts>>(new Map())
  const [scope, setScope] = useState<Scope>('payer')
  const [receipts, setReceipts] = useState<PayCalendarReceipt[]>([])
  const [form, setForm] = useState<PayCalendar>(PAY_CALENDAR_DEFAULT)
  /** The job scope's other choice: no calendar on this job, whatever the payer holds. */
  const [jobOff, setJobOff] = useState(false)
  /** The development's other jobs, and whether the save reaches them too. */
  const [otherJobIds, setOtherJobIds] = useState<string[]>([])
  const [alsoOthers, setAlsoOthers] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const jobId = job?.id ?? null
  const developmentId = job?.developmentId ?? null
  /** The job the window can be for alone: the one the press sat on, or the one New Job is about to make. */
  const jobLabel = job?.label ?? jobToBe?.label ?? null
  const hasJob = jobLabel != null
  // One string, so an opener that rebuilds the same object each render does not read again.
  const initialKey = JSON.stringify(initial ?? null)
  const offered = useMemo(() => normalizePayCalendar((JSON.parse(initialKey) as PayCalendarInitial | null)?.calendar ?? null), [initialKey])
  const offeredFrom = offered ? (initial?.from ?? '').trim() || null : null

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [rows, paid, devJobs] = await Promise.all([
          loadPayerPayCalendars(supabase, payerId),
          loadPayerReceipts(supabase, payerId),
          jobId && developmentId ? loadDevelopmentJobIds(supabase, developmentId) : Promise.resolve([] as string[]),
        ])
        if (cancelled) return
        const own = rows.find((r) => r.jobId == null && r.calendar) ?? null
        const forJob = jobId ? (rows.find((r) => r.jobId === jobId) ?? null) : null
        setPayerRow(own)
        setJobRow(forJob)
        const jobRows = rows.filter((r) => r.jobId != null)
        setOwnJobRows(jobRows)
        // Their names come after the window has drawn: a list of jobs is not worth holding the form for.
        if (jobRows.length) {
          void loadPayCalendarJobs(supabase, jobRows.map((r) => r.jobId as string)).then((facts) => {
            if (!cancelled) setOwnJobFacts(facts)
          })
        }
        const init = JSON.parse(initialKey) as PayCalendarInitial | null
        const initCalendar = normalizePayCalendar(init?.calendar ?? null)
        // A job that already carries its own opens on the job; terms read for a job open on it; anything else opens on the payer.
        setScope(forJob || (initCalendar && init?.scope === 'job' && hasJob) ? 'job' : 'payer')
        setJobOff(forJob?.off === true)
        const stored = forJob?.calendar ?? own?.calendar ?? null
        // Terms read elsewhere start the form. With nothing stored, the paper's clause and words do, so they are not typed twice.
        setForm(
          initCalendar ??
            stored ?? { ...PAY_CALENDAR_DEFAULT, clause: (init?.clause?.trim() ?? '').slice(0, PAY_CALENDAR_CLAUSE_MAX), words: (init?.words?.trim() ?? '').slice(0, PAY_CALENDAR_WORDS_MAX) },
        )
        setReceipts(paid)
        setOtherJobIds(devJobs.filter((id) => id !== jobId))
      } catch (e) {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'Could not read the pay calendar'))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payerId, jobId, developmentId, initialKey, hasJob])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTopmost() && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTopmost, onClose, saving])

  const pickScope = (next: Scope) => {
    setScope(next)
    // Terms read elsewhere stay as typed: the office is choosing where they go, not which stored calendar to see.
    if (offered) return
    setForm(next === 'job' ? (jobRow?.calendar ?? payerRow?.calendar ?? PAY_CALENDAR_DEFAULT) : (payerRow?.calendar ?? PAY_CALENDAR_DEFAULT))
  }

  const todayYmd = todayYmdInAppTz()
  const preview = useMemo(() => payCalendarPreview(form, todayYmd), [form, todayYmd])
  const lateness = useMemo(() => latenessAgainst(receipts, form), [receipts, form])
  const ready = canSet && loaded && !loadError && !saving
  const onJob = scope === 'job' && hasJob
  const editable = ready && !(onJob && jobOff)
  const set = (patch: Partial<PayCalendar>) => setForm((f) => ({ ...f, ...patch }))
  const stored = onJob ? jobRow : payerRow

  const finish = (line: string, tone: 'success' | 'warning' | 'error') => {
    showToast(line, tone)
    // Every screen that reads a calendar reads again (punch list #341), whichever door opened this window.
    dispatchPayCalendarChanged()
    onSaved?.()
    if (tone === 'success') onClose()
  }

  const save = async () => {
    setSaving(true)
    try {
      const calendar: PayCalendarSave = onJob && jobOff ? { off: true } : { ...form, clause: form.clause.trim(), words: form.words.trim() }
      if (onJob && !job && jobToBe) {
        // The job is not made yet: nothing is written here. New Job sets it with the job.
        jobToBe.onUse(calendar)
        onClose()
        return
      }
      if (!onJob || !job) {
        await savePayCalendar(supabase, { payerId, calendar })
        finish('Pay calendar saved.', 'success')
        return
      }
      // This job first; then the development's other jobs, each on its own, past any that fails.
      await savePayCalendar(supabase, { payerId, jobId: job.id, calendar })
      const others = alsoOthers ? otherJobIds : []
      if (!others.length) {
        finish('Pay calendar saved for this job.', 'success')
        return
      }
      let done = 1
      let reason: string | null = null
      for (const id of others) {
        try {
          await savePayCalendar(supabase, { payerId, jobId: id, calendar })
          done += 1
        } catch (e) {
          reason = reason ?? formatErrorMessage(e, 'the save was refused')
        }
      }
      const outcome = batchOutcomeWords({ verb: 'Save', past: 'saved', done, failed: others.length + 1 - done, noun: ['job', 'jobs'] })
      finish(reason ? `${outcome.line} ${reason}` : outcome.line, outcome.tone)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the pay calendar'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (onJob && job) {
      // A job's own row goes without a question: the job reads the payer's again, and nothing typed is lost for good.
      setSaving(true)
      try {
        await savePayCalendar(supabase, { payerId, jobId: job.id, calendar: null })
        finish(`This job follows ${payerName} again.`, 'success')
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not change this job'), 'error')
      } finally {
        setSaving(false)
      }
      return
    }
    const yes = await confirmDialog({
      title: `Remove ${payerName}'s pay calendar?`,
      message: 'Their bills go back to the usual guess: the bill date plus how long they take to pay.',
      confirmLabel: 'Remove the pay calendar',
      danger: true,
    })
    if (!yes) return
    setSaving(true)
    try {
      await savePayCalendar(supabase, { payerId, calendar: null })
      finish('Pay calendar removed.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not remove the pay calendar'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const dead = !ready
  const storedWords = setAtWords(stored)
  const others = otherJobIds.length
  const where = (job?.developmentName ?? '').trim() || 'this development'
  const scopePress = (key: Scope, words: string) => {
    const on = scope === key
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        disabled={!loaded || saving}
        onClick={() => pickScope(key)}
        style={{ flex: '1 1 150px', minWidth: 0, textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', fontWeight: on ? 700 : 400, border: `1px solid ${on ? 'var(--text-link)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-base)', borderRadius: 8, cursor: 'pointer' }}
      >
        {words}
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="pay-calendar-modal"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem', boxSizing: 'border-box' }}
      onClick={(e) => {
        e.stopPropagation()
        if (!saving) onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(480px, 100%)', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.05rem' }}>
          Pay calendar · {payerName}
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          For a payer who pays on a set day of the month. Leave it unset for one who pays some days after each bill.
        </p>

        {loadError ? (
          <p role="alert" style={{ ...boxStyle, background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' }}>
            {loadError}
          </p>
        ) : null}

        {offered ? (
          <p data-testid="pay-calendar-offered" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            Filled in from {offeredFrom ?? 'a draft'}. Check it, then save.
          </p>
        ) : null}

        {hasJob ? (
          <>
            <div style={labelStyle}>This calendar is for</div>
            <div role="radiogroup" aria-label="This calendar is for" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scopePress('payer', `Every job ${payerName} pays`)}
              {scopePress('job', `Only ${jobLabel}`)}
            </div>
            {onJob ? (
              <>
                <p data-testid="pay-calendar-payer-words" style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {payerRow?.calendar ? `${payerName} on every other job: ${payCalendarShort(payerRow.calendar)}.` : `${payerName} has no pay calendar of their own.`}
                </p>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', marginTop: '0.6rem', cursor: ready ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={jobOff} disabled={!ready} onChange={(e) => setJobOff(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>This job has no pay calendar</span>
                </label>
              </>
            ) : null}
          </>
        ) : null}

        <PayCalendarFields form={form} onChange={set} disabled={!editable} />

        {onJob && jobOff ? (
          <div data-testid="pay-calendar-preview" style={{ ...boxStyle, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
            This job reads the usual guess: the bill date plus how long they take to pay.
          </div>
        ) : (
          <>
            <div data-testid="pay-calendar-preview" style={{ ...boxStyle, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
              <div style={{ fontWeight: 700 }}>{preview?.inBy ?? payCalendarWords(form)}</div>
              {preview ? <div>{preview.dayLate}</div> : null}
            </div>
            <div data-testid="pay-calendar-record" style={{ ...boxStyle, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
              <span style={{ fontWeight: 700 }}>Their record against this. </span>
              {loaded ? latenessWords(lateness) : 'Reading their payments…'}
            </div>
          </>
        )}

        {onJob && others > 0 ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', marginTop: '0.8rem', cursor: ready ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={alsoOthers} disabled={!ready} onChange={(e) => setAlsoOthers(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Also set on the other {others} {others === 1 ? 'job' : 'jobs'} in {where}
            </span>
          </label>
        ) : null}

        {!onJob && ownJobRows.length > 0 ? (
          <div data-testid="pay-calendar-own-jobs" style={{ ...boxStyle, border: '1px solid var(--border)', padding: '0.5rem 0.7rem' }}>
            <div style={{ fontWeight: 700 }}>
              {ownJobRows.length} {ownJobRows.length === 1 ? 'job does' : 'jobs do'} not follow this
            </div>
            {ownJobRows.map((r) => {
              const facts = r.jobId ? ownJobFacts.get(r.jobId) : undefined
              const label = facts?.job.label ?? 'A job'
              // The job's bills now go to someone else: this calendar is stored and no bill reads it.
              const stale = facts != null && facts.payerIdNow !== payerId
              return (
                <div key={r.jobId} data-testid="pay-calendar-own-job" style={{ marginTop: 4 }}>
                  {onOpenJob && facts ? (
                    <button type="button" className="payCalendarPress" disabled={saving} onClick={() => onOpenJob(facts.job)} style={{ fontWeight: 600 }}>
                      {label}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{label}</span>
                  )}
                  <span style={{ display: 'block', fontSize: '0.75rem', color: stale ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                    {r.off || !r.calendar ? JOB_NO_CALENDAR_WORDS : `Its own: ${payCalendarShort(r.calendar)}`}
                    {stale ? `. ${payerName} no longer pays this job, so no bill reads it.` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          {canSet && stored ? (
            <button type="button" onClick={() => void remove()} disabled={dead} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: onJob ? 'var(--text-700)' : 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 6, cursor: dead ? 'default' : 'pointer' }}>
              {onJob ? `Follow ${payerName} again` : 'Remove the pay calendar'}
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
            {canSet ? 'Cancel' : 'Close'}
          </button>
          {canSet ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={dead}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 6, cursor: dead ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : onJob ? (!job ? 'Use for this job' : alsoOthers && others > 0 ? `Save for ${others + 1} jobs` : 'Save for this job') : 'Save pay calendar'}
            </button>
          ) : null}
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {canSet ? (onJob ? (job ? 'Only this job’s bills read it.' : 'It sets when the job is created. Only this job’s bills read it.') : ownJobRows.length > 0 ? 'Every other bill this payer pays reads it.' : 'Every bill this payer pays reads it.') : 'The office sets this.'}
          {storedWords ? ` ${storedWords}` : ''}
        </p>
      </div>
    </div>
  )
}
