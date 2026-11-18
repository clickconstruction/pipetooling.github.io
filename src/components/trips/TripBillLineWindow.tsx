/**
 * Put a trip on a job's lines (punch list #391): the small window behind **Put on a bill** on an open Extra
 * trip. Four things to check: the job, the amount, the line's name and the words under it. The name and the
 * words are made from the trip and are the office's to change; both reach the customer's bill. The amount is
 * typed, since a trip holds no price. A dev or a controller sees What it cost under the box as a hint.
 *
 * The job total before and after is the function's own dry run, asked again when the job or the amount
 * changes. A dry run that is refused (a job billed from the GC desk, a trip that already holds a line) says
 * why in the function's words and leaves the button dead. The button names the act and its figure.
 *
 * A job billed from the GC desk is never offered (the card's default 7, the owner's answer of 2026-11-18): on a job
 * we build as the GC the customer's price grows only by a signed change order. The window reads which of its jobs
 * those are, holds each back with that reason, and gives the money team the door to the project's **Change orders**.
 *
 * The rules are `lib/trips/tripBillLine.ts`; this file draws them. Nothing is billed here: the press adds one
 * line, and a bill takes it later from the Job window. Drawn through a portal on the body, as the trip sheet.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { TRIP_COST_CAP, TRIP_COST_WHO } from '../../lib/trips/tripCost'
import {
  TRIP_BILL_CHANGE_ORDERS_LABEL,
  TRIP_BILL_CHANGE_ORDERS_WHO,
  TRIP_BILL_LINE_NOTE,
  TRIP_LINE_NAME_MAX,
  TRIP_LINE_WORDS_MAX,
  tripAlreadyOnLinesWords,
  tripBillJobChoices,
  tripBillTotalsWords,
  tripBillWindowState,
  tripBillWindowTitle,
  tripLineName,
  tripLineWords,
  type TripBillGcJob,
  type TripBillJob,
  type TripBillLineReply,
} from '../../lib/trips/tripBillLine'
import { putTripOnJobLine, readTripBillGcJobs, TripBillLineRefusal, type TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import type { TripRecord } from '../../lib/trips/tripRecord'
import { tripNameOfRecord } from '../../lib/trips/tripsLook'
import { formatErrorMessage } from '../../utils/errorHandling'
import { capStyle, SmallButton } from '../developments/developmentPageBits'

/** How long the window waits after a keystroke before it asks for the total again. */
export const TRIP_BILL_PREVIEW_WAIT_MS = 350

type Preview = { state: 'idle' } | { state: 'asking' } | { state: 'read'; reply: TripBillLineReply } | { state: 'refused'; words: string } | { state: 'failed'; words: string }

export function TripBillLineWindow({
  record,
  siteName,
  jobs,
  todayYmd,
  costWords = null,
  busy,
  zIndex = 760,
  preview = putTripOnJobLine,
  readGcJobs = readTripBillGcJobs,
  onOpenChangeOrders,
  onAdd,
  onClose,
}: {
  /** The trip going on a bill. */
  record: TripRecord
  siteName: string
  /** The site's jobs, as the page lists them. */
  jobs: ReadonlyArray<TripBillJob>
  todayYmd: string
  /** What the trip cost, in words, for a dev or a controller. Null for everyone else: no cost is shown. */
  costWords?: string | null
  busy: boolean
  zIndex?: number
  /** The dry run that says the job total before and after. Injectable for tests. */
  preview?: (press: TripBillLinePress) => Promise<TripBillLineReply>
  /** Which of these jobs are billed from the GC desk. Injectable for tests. */
  readGcJobs?: (jobIds: ReadonlyArray<string>) => Promise<TripBillGcJob[]>
  /**
   * Open a GC project's Change orders. Handed in only for a reader on the GC money team, who can open them;
   * absent, a held job says who writes the change order instead.
   */
  onOpenChangeOrders?: (projectId: string) => void
  /** The press. True when the line was added, so the window closes. */
  onAdd: (press: Omit<TripBillLinePress, 'dryRun'>) => Promise<boolean>
  onClose: () => void
}) {
  const tripShort = useMemo(() => tripNameOfRecord(record, todayYmd).short, [record, todayYmd])
  // The jobs billed from the GC desk, read once for the jobs this window could offer. Until it is in, and when it
  // cannot be read, none is held: the function's own refusal then says so on the dry run.
  const [gcJobs, setGcJobs] = useState<TripBillGcJob[]>([])
  const readGcJobsRef = useRef(readGcJobs)
  readGcJobsRef.current = readGcJobs
  const jobIdsKey = useMemo(() => jobs.map((j) => j.id).sort().join(','), [jobs])
  useEffect(() => {
    if (!jobIdsKey) return
    let live = true
    readGcJobsRef.current(jobIdsKey.split(',')).then(
      (found) => {
        if (live) setGcJobs(found)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [jobIdsKey])
  const choices = useMemo(() => tripBillJobChoices({ tripJobIds: record.jobIds, siteJobs: jobs, siteName, gcJobs }), [record.jobIds, jobs, siteName, gcJobs])
  const [jobId, setJobId] = useState<string | null>(choices.picked)
  // A job picked before the read came in may turn out to be one the window holds back: the pick moves off it.
  useEffect(() => {
    if (jobId && !choices.jobs.some((j) => j.id === jobId)) setJobId(choices.picked)
    else if (!jobId && choices.picked) setJobId(choices.picked)
  }, [choices, jobId])
  const [amountTyped, setAmountTyped] = useState('')
  const [name, setName] = useState(() => tripLineName(record, todayYmd))
  const [words, setWords] = useState(() => tripLineWords(record))
  const [look, setLook] = useState<Preview>({ state: 'idle' })
  useModalStackEntry(true)
  useEffect(() => {
    // Taken in the capture phase and marked handled, so a window under this one keeps its own Escape for the next press.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const job = jobs.find((j) => j.id === jobId) ?? null
  const ui = tripBillWindowState({ jobId, amountTyped, name, askWords: choices.askWords, noneWords: choices.noneWords })
  const amount = ui.amount

  // The job total before and after: the function's own dry run, asked again once the job or the amount settles.
  const previewRef = useRef(preview)
  previewRef.current = preview
  const tripId = record.id
  useEffect(() => {
    if (!jobId || amount == null) {
      setLook({ state: 'idle' })
      return
    }
    let live = true
    setLook({ state: 'asking' })
    const timer = setTimeout(() => {
      // The name is not what the total hangs on: a stand-in keeps a half-typed name from refusing the dry run.
      previewRef.current({ tripId, jobId, amount, name: 'Trip', words: '', dryRun: true }).then(
        (reply) => {
          if (live) setLook({ state: 'read', reply })
        },
        (e: unknown) => {
          if (!live) return
          if (e instanceof TripBillLineRefusal) setLook({ state: 'refused', words: e.message })
          else setLook({ state: 'failed', words: formatErrorMessage(e, 'The job total did not read.') })
        },
      )
    }, TRIP_BILL_PREVIEW_WAIT_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [tripId, jobId, amount])

  const already = look.state === 'read' && look.reply.duplicate
  const totals = look.state === 'read' && !look.reply.duplicate ? tripBillTotalsWords(look.reply) : null
  // What keeps the button dead, most telling first: the window's own check, then what the dry run said.
  const problem = ui.problem ?? (look.state === 'refused' ? look.words : already ? tripAlreadyOnLinesWords(tripShort, null) : null)
  const dead = !!problem || busy
  const add = async () => {
    if (dead || !jobId || amount == null) return
    const ok = await onAdd({ tripId, jobId, amount, name: name.trim(), words: words.trim() })
    if (ok) onClose()
  }
  const title = tripBillWindowTitle(tripShort, job)
  const input = { font: 'inherit', fontSize: '0.84rem', padding: '6px 9px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0, width: '100%', boxSizing: 'border-box' } as const
  const quiet = { fontSize: '0.76rem', color: 'var(--text-muted)' } as const

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="trip-bill-window"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px' }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="developmentHistoryBox" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 460, maxWidth: '100%', maxHeight: 'calc(100vh - 32px - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1rem' }} data-testid="trip-bill-title">
            {title}
          </strong>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'grid', gap: 12 }}>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Job</div>
            {choices.noneWords ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-amber-800)' }} data-testid="trip-bill-no-job">
                {choices.noneWords}
              </div>
            ) : choices.jobs.length === 1 && job ? (
              <div style={{ fontSize: '0.88rem' }} data-testid="trip-bill-job">
                <strong>{job.label}</strong> {job.name}
              </div>
            ) : (
              <select value={jobId ?? ''} aria-label="Job" data-testid="trip-bill-job-pick" style={input} onChange={(e) => setJobId(e.target.value || null)}>
                <option value="">{choices.askWords}</option>
                {choices.jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {`${j.label} ${j.name}`.trim()}
                  </option>
                ))}
              </select>
            )}
            {/* A job billed from the GC desk takes no trip's line: why, and the press that takes the amount instead. */}
            {choices.held.map((h) => (
              <div key={h.job.id} style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-subtle)', fontSize: '0.8rem' }} data-testid="trip-bill-held-job">
                <div style={{ color: 'var(--text-700)' }}>{h.words}</div>
                <div style={{ marginTop: 5 }}>
                  {onOpenChangeOrders ? (
                    <SmallButton onClick={() => onOpenChangeOrders(h.projectId)} title="Opens this job’s change orders on the GC desk. This window closes and nothing is added.">
                      {TRIP_BILL_CHANGE_ORDERS_LABEL}
                    </SmallButton>
                  ) : (
                    <span style={quiet}>{TRIP_BILL_CHANGE_ORDERS_WHO}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Amount</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>
                $
              </span>
              <input value={amountTyped} inputMode="decimal" autoFocus onChange={(e) => setAmountTyped(e.target.value)} placeholder="0.00" aria-label="Amount in dollars" data-testid="trip-bill-amount" style={{ ...input, width: 160, fontVariantNumeric: 'tabular-nums' }} />
            </div>
            {costWords ? (
              <div style={{ ...quiet, marginTop: 4 }} data-testid="trip-bill-cost">
                {TRIP_COST_CAP}: {costWords} · shown to {TRIP_COST_WHO} only
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Line</div>
            <input value={name} maxLength={TRIP_LINE_NAME_MAX} onChange={(e) => setName(e.target.value)} aria-label="The line’s name" data-testid="trip-bill-name" style={input} />
          </div>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Words under it</div>
            <textarea value={words} maxLength={TRIP_LINE_WORDS_MAX} rows={3} onChange={(e) => setWords(e.target.value)} aria-label="The words under the line" data-testid="trip-bill-words" style={{ ...input, resize: 'vertical' }} />
            <div style={{ ...quiet, marginTop: 4 }}>The name and the words go on the customer’s bill.</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-subtle)' }} data-testid="trip-bill-totals">
            <div style={capStyle}>Job total</div>
            <div style={{ marginTop: 4, fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }} aria-label={totals ? `${totals.before} now, ${totals.after} with the line` : undefined}>
              {totals ? (
                <>
                  {totals.before} <span aria-hidden>→</span> <strong>{totals.after}</strong>
                </>
              ) : look.state === 'asking' ? (
                <span style={quiet}>Reading the job total…</span>
              ) : look.state === 'failed' ? (
                <span style={{ ...quiet, color: 'var(--text-amber-800)' }}>{look.words}</span>
              ) : look.state === 'refused' || already ? (
                <span style={quiet}>The total stays as it is.</span>
              ) : (
                <span style={quiet}>Pick the job and type the amount to see it before and after.</span>
              )}
            </div>
            <div style={{ ...quiet, marginTop: 4 }}>{TRIP_BILL_LINE_NOTE}</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: problem ? 'var(--text-amber-800)' : 'var(--text-muted)', flex: '1 1 160px', minWidth: 0 }} data-testid="trip-bill-foot">
            {problem ?? 'Nothing is sent to anyone.'}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <SmallButton onClick={onClose}>Cancel</SmallButton>
            <SmallButton onClick={() => void add()} primary disabled={dead} title={problem ?? 'Add this line to the job. A bill takes it later.'}>
              {busy ? 'Adding the line…' : ui.confirmLabel}
            </SmallButton>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
