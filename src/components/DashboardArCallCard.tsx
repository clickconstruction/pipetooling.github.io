/**
 * AR Customers view — call card (v2.2572, mockup Variant B). Renders at the
 * BOTTOM of a customer's expansion (the bills and their line items stay up
 * front): the call opener, their recent payments as speed chips, the last
 * chase touch, and one-tap outcomes that write through the shared Payment
 * Chase path (paymentChaseIo) so the Pipeline queue and this card can never
 * disagree on quiet windows or promises.
 */
import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { arCallOpener, arLastTouchLine, type ArChasePill, type ArChasePillKind } from '../lib/arCustomerChase'
import { buildArCallSummary } from '../lib/arCustomerChase'
import { addPaymentChaseTouch, recordPromiseForJobsSettled } from '../lib/jobs/paymentChaseIo'
import { DEFAULT_SNOOZE_DAYS, promiseOutcomeWords, type ChaseTouch } from '../lib/jobs/paymentChase'
import { receiptGapTone, formatYmdSlash } from '../lib/jobs/paySpeedsBreakdown'
import type { PaySpeedData } from '../lib/jobs/billedExpectedPay'
import type { ArCustomerRow } from '../lib/arCustomerRollup'
import type { ArLineItem } from '../lib/arModalLineItems'

const PILL_COLORS: Record<ArChasePillKind, { bg: string; fg: string }> = {
  ask: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  broken: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  dispute: { bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
  promised: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  snoozed: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  quiet: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

/** The row-level chase pill (beside the customer name). */
export function ArChasePillTag({ pill }: { pill: ArChasePill }) {
  const c = PILL_COLORS[pill.kind]
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        padding: '1px 7px',
        borderRadius: 9999,
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {pill.label}
    </span>
  )
}

const GAP_TONE_COLORS: Record<ReturnType<typeof receiptGapTone>, { bg: string; fg: string }> = {
  fast: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  mid: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  slow: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  neutral: { bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
}

const ACTION_BTN: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: 7,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export default function DashboardArCallCard({
  row,
  paySpeeds,
  touches,
  todayYmd,
  canAct,
  linesByJob,
  onChanged,
}: {
  row: ArCustomerRow
  paySpeeds: PaySpeedData | null
  touches: ChaseTouch[] | null
  todayYmd: string
  /** Office roles only (dev / master / assistant-like) — mirrors the Pipeline chase gate. */
  canAct: boolean
  linesByJob: Map<string, ArLineItem[]> | null
  /** Refetch chase state upstream after a write. */
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [promiseYmd, setPromiseYmd] = useState('')
  // Their Word (v2.3286): who at the customer named the date — optional, rides the promise event.
  const [promiseSaidBy, setPromiseSaidBy] = useState('')
  const [saving, setSaving] = useState(false)
  // The bills whose job the promise did not reach (punch list #184), each with the reason; Save then covers only their jobs.
  const [promiseMiss, setPromiseMiss] = useState<Array<{ key: string; label: string; why: string }>>([])
  const [retryJobIds, setRetryJobIds] = useState<string[] | null>(null)

  const customerId = row.customerId
  const receipts = customerId ? paySpeeds?.receipts[customerId] ?? [] : []
  const companyMedian = paySpeeds?.company?.medianDays ?? null
  const lastTouch = arLastTouchLine(touches, customerId, todayYmd)

  /** The jobs a promise covers: distinct jobs behind late bills, else every job on the row. */
  const promiseJobIds = (() => {
    const late = row.bills.filter((b) => b.tone === 'warn' || b.tone === 'late')
    const source = late.length > 0 ? late : row.bills
    return [...new Set(source.map((b) => b.item.jobId).filter((id): id is string => id != null))]
  })()

  const coverJobIds = retryJobIds ?? promiseJobIds

  const savePromise = async () => {
    if (!customerId || saving) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(promiseYmd)) {
      showToast('Pick the date they named first.', 'error')
      return
    }
    setSaving(true)
    try {
      // Every job is written, past one that fails (punch list #184).
      const result = await recordPromiseForJobsSettled({
        customerId,
        jobYmds: coverJobIds.map((jobId) => [jobId, promiseYmd] as const),
        saidBy: promiseSaidBy.trim() || null,
        channel: 'phone',
      })
      if (result.saved.length > 0) onChanged()
      if (result.failed.length === 0) {
        showToast(
          result.untouched.length > 0 ? `Promise marked — their late bills now carry the date. The call log did not save: ${result.untouched[0]!.why}` : 'Promise marked — their late bills now carry the date.',
          result.untouched.length > 0 ? 'warning' : 'success',
        )
        setPromiseOpen(false)
        setPromiseYmd('')
        setPromiseSaidBy('')
        setPromiseMiss([])
        setRetryJobIds(null)
        return
      }
      // The bills on the jobs that did not take stay named with the reason, and the next Save covers only those jobs.
      const whyByJob = new Map(result.failed.map((f) => [f.jobId, f.why]))
      const missed = row.bills
        .filter((b) => b.item.jobId != null && whyByJob.has(b.item.jobId))
        .map((b) => ({ key: b.item.key, label: b.item.label, why: whyByJob.get(b.item.jobId!)! }))
      const words = promiseOutcomeWords(row.bills.filter((b) => b.item.jobId != null && result.saved.includes(b.item.jobId)).length, missed.length)
      showToast(words.line, words.tone)
      setPromiseMiss(missed)
      setRetryJobIds(result.failed.map((f) => f.jobId))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not mark the promise'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const logCantReach = async () => {
    if (!customerId || saving) return
    setSaving(true)
    try {
      await addPaymentChaseTouch({
        customerId,
        jobId: null,
        outcome: 'cant_reach',
        snoozeDays: DEFAULT_SNOOZE_DAYS,
      })
      showToast(`Logged — they leave the call queue for ${DEFAULT_SNOOZE_DAYS} days.`, 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not log the call'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildArCallSummary(row, linesByJob))
      showToast('Call summary copied.', 'success')
    } catch {
      showToast('Could not reach the clipboard.', 'error')
    }
  }

  return (
    <div
      style={{
        marginTop: '0.55rem',
        padding: '0.65rem 0.75rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-subtle)',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ color: 'var(--text-700)' }}>
        <span aria-hidden>📞 </span>
        {arCallOpener(row)}
      </div>
      {receipts.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            They paid
          </span>
          {receipts.slice(0, 5).map((r, i) => {
            const tone = GAP_TONE_COLORS[receiptGapTone(r.gapDays, companyMedian)]
            return (
              <span
                key={i}
                title={`Billed ${r.billedYmd} → paid ${r.paidYmd} (+${r.gapDays}d)`}
                style={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: 6, padding: '1px 7px', background: tone.bg, color: tone.fg, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatYmdSlash(r.paidYmd)} · {r.gapDays}d
              </span>
            )
          })}
        </div>
      ) : null}
      {lastTouch ? (
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last touch: {lastTouch}</div>
      ) : null}
      {canAct && customerId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
          {promiseOpen ? (
            <>
              <input
                type="date"
                value={promiseYmd}
                onChange={(e) => setPromiseYmd(e.target.value)}
                aria-label="Promised payment date"
                style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                value={promiseSaidBy}
                onChange={(e) => setPromiseSaidBy(e.target.value.slice(0, 120))}
                placeholder="who said it"
                aria-label="Who said it"
                title="Who at the customer named the date — rides the promise as 'by Dana by phone' (optional)"
                style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8rem', width: 130 }}
              />
              <button type="button" disabled={saving || coverJobIds.length === 0} onClick={() => void savePromise()} style={{ ...ACTION_BTN, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: '#fff' }}>
                {saving ? 'Saving…' : `Save promise (${coverJobIds.length} job${coverJobIds.length === 1 ? '' : 's'})`}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setPromiseOpen(false)
                  setPromiseMiss([])
                  setRetryJobIds(null)
                }}
                style={ACTION_BTN}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={saving} onClick={() => setPromiseOpen(true)} style={ACTION_BTN}>
                They promised…
              </button>
              <button type="button" disabled={saving} onClick={() => void logCantReach()} style={ACTION_BTN}>
                Can't reach — snooze {DEFAULT_SNOOZE_DAYS}d
              </button>
              <button type="button" onClick={() => void copySummary()} style={ACTION_BTN}>
                Copy summary
              </button>
            </>
          )}
        </div>
      ) : null}
      {promiseMiss.length > 0 ? (
        <div role="status" data-ar-promise-missed style={{ marginTop: '0.45rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-red)', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 6, fontSize: '0.75rem' }}>
          <strong>{promiseOutcomeWords(0, promiseMiss.length).head}</strong> Save the promise again to try them.
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
            {promiseMiss.map((m) => (
              <li key={m.key}>
                <span style={{ fontWeight: 600 }}>{m.label}</span> · {m.why}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
