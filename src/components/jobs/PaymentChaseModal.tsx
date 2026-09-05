import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { extractContactFromCustomer } from '../../lib/customerContactDisplay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay, type PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import { addPaymentChaseTouch, recordPromiseForJobs } from '../../lib/jobs/paymentChaseIo'
import {
  CHASE_COLLECTIONS_SUGGESTION_THRESHOLD,
  DEFAULT_SNOOZE_DAYS,
  PROMISE_DAY_CHIPS,
  resolvePromiseDates,
  TOUCH_QUIET_DAYS,
  type ChaseBill,
  type ChaseCustomer,
  type ChaseDispute,
  type PaymentChaseQueue,
  type PromiseDateMode,
} from '../../lib/jobs/paymentChase'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import type { UserRole } from '../../hooks/useAuth'

/**
 * Payment follow-up call mode (owner-approved "Payment Chase Loop" v2 mockup,
 * v2.2025): one customer at a time, biggest late dollars first. The queue is
 * SNAPSHOTTED on open — outcomes write immediately (promises + chase touches)
 * but the rail doesn't reshuffle under the caller mid-session; the board and
 * card re-derive when the session ends. Bills are checkboxes so one call can
 * produce several answers (a date for some, a resend, a dispute); every
 * outcome logs a chase touch, and the session ends with a wrap-up.
 */

type SessionOutcome = {
  customerId: string
  name: string
  kind: 'promised' | 'cant_reach' | 'dispute' | 'note' | 'skipped'
  detail: string
  dollars: number
}

const chipBtn: CSSProperties = {
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  borderRadius: 9999,
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.28rem 0.75rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

export default function PaymentChaseModal({
  queue,
  loading,
  paySpeeds,
  todayYmd,
  authRole,
  onClose,
  onRecorded,
  onOpenInvoice,
}: {
  /** Built from the FULL billed rows; null while the billed scope is still merging. */
  queue: PaymentChaseQueue | null
  loading: boolean
  paySpeeds: PaySpeedData | null
  todayYmd: string
  authRole: UserRole | null
  onClose: () => void
  /** Fired after every successful write so the tab reloads touches + promises. */
  onRecorded: () => void
  /** Jump the board to a bill (closes the modal upstream). */
  onOpenInvoice: (invoiceId: string) => void
}) {
  const { showToast } = useToastContext()
  // Snapshot on the first loaded queue — the session works a fixed list.
  const [snapshot, setSnapshot] = useState<PaymentChaseQueue | null>(null)
  useEffect(() => {
    if (!snapshot && !loading && queue) setSnapshot(queue)
  }, [snapshot, loading, queue])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(() => new Set())
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([])
  const [billState, setBillState] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [customDate, setCustomDate] = useState('')
  // Promise builder (v2.2044): how the customer said the date. Mode is
  // sticky across the session (a net-terms morning stays in net terms);
  // the day count and picked date clear per customer.
  const [promiseMode, setPromiseMode] = useState<PromiseDateMode>('today')
  const [promiseDays, setPromiseDays] = useState<number | null>(null)
  const [snoozeDays, setSnoozeDays] = useState(DEFAULT_SNOOZE_DAYS)
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)
  const [contacts, setContacts] = useState<Record<string, { phone: string; email: string }>>({})

  const due = snapshot?.due ?? []
  const waiting = snapshot?.waiting ?? []
  const disputes = snapshot?.disputes ?? []
  const current: ChaseCustomer | null =
    (selectedId ? [...due, ...waiting].find((c) => c.customerId === selectedId) : due.find((c) => !doneIds.has(c.customerId))) ??
    null
  const currentDispute: ChaseDispute | null = selectedDispute
    ? (disputes.find((d) => d.touch.id === selectedDispute) ?? null)
    : null

  // Default every late bill checked when a customer opens.
  useEffect(() => {
    if (!current) return
    setChecked((prev) => {
      const next = { ...prev }
      for (const b of current.bills) if (next[b.invoiceId] == null) next[b.invoiceId] = true
      return next
    })
  }, [current])

  // Phones/emails for the snapshot's customers (contact_info JSON) — fail-soft.
  useEffect(() => {
    if (!snapshot) return
    const ids = [...due, ...waiting].map((c) => c.customerId)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('customers').select('id, contact_info').in('id', ids)
        if (cancelled || !data) return
        const map: Record<string, { phone: string; email: string }> = {}
        for (const row of data as { id: string; contact_info: unknown }[]) {
          map[row.id] = extractContactFromCustomer({ contact_info: row.contact_info as never })
        }
        setContacts(map)
      } catch {
        // no phone line — the call card still works
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])

  const advance = (fromCustomerId: string) => {
    setDoneIds((prev) => new Set([...prev, fromCustomerId]))
    setNote('')
    setCustomDate('')
    setPromiseDays(null)
    setSelectedId(null)
    setSelectedDispute(null)
    const next = due.find((c) => c.customerId !== fromCustomerId && !doneIds.has(c.customerId))
    if (!next) setFinished(true)
  }

  const recordTouch = async (
    customerId: string,
    jobId: string | null,
    outcome: 'promised' | 'cant_reach' | 'resend' | 'dispute' | 'note',
    opts?: { promisedYmd?: string; snoozeDays?: number },
  ) => {
    // Shared chase write path (v2.2572) — the AR call card writes through the same helper.
    await addPaymentChaseTouch({
      customerId,
      jobId,
      outcome,
      note: note.trim() || null,
      promisedYmd: opts?.promisedYmd ?? null,
      snoozeDays: opts?.snoozeDays ?? null,
    })
  }

  const applyPromise = async () => {
    if (!current || saving) return
    const bills = current.bills.filter((b) => checked[b.invoiceId] && !billState[b.invoiceId])
    if (bills.length === 0) {
      showToast('Check at least one bill for the promise.', 'error')
      return
    }
    const resolved = resolvePromiseDates({
      mode: promiseMode,
      ymd: customDate,
      days: promiseDays,
      bills,
      todayYmd,
    })
    if (!resolved) {
      showToast(promiseMode === 'date' ? 'Pick the date they named first.' : 'Tap a chip or type the days first.', 'error')
      return
    }
    setSaving(true)
    try {
      await recordPromiseForJobs({
        customerId: current.customerId,
        jobYmds: [...resolved.byJob].map(([jobId, ymd]) => [jobId, ymd] as const),
        note: note.trim() || null,
      })
      setBillState((prev) => {
        const next = { ...prev }
        for (const b of bills) {
          const ymd = resolved.byInvoice.get(b.invoiceId)
          if (ymd) next[b.invoiceId] = `✓ promised ${formatYmdMonthDay(ymd)}`
        }
        return next
      })
      const dollars = bills.reduce((s, b) => s + b.open, 0)
      const first = resolved.uniqueYmds[0]
      const last = resolved.uniqueYmds[resolved.uniqueYmds.length - 1]
      const dateWord =
        resolved.uniqueYmds.length === 1 && first
          ? formatYmdMonthDay(first)
          : `${first ? formatYmdMonthDay(first) : ''} – ${last ? formatYmdMonthDay(last) : ''}${promiseMode === 'billed' && promiseDays ? ` (billed + ${promiseDays}d)` : ''}`
      setOutcomes((prev) => [
        ...prev,
        {
          customerId: current.customerId,
          name: current.name,
          kind: 'promised',
          detail: `${bills.length} bill${bills.length === 1 ? '' : 's'} promised ${dateWord}${note.trim() ? ` · "${note.trim()}"` : ''}`,
          dollars,
        },
      ])
      onRecorded()
      showToast(`Promise marked — ${formatUsdNoCents(dollars)} now has a date.`, 'success')
      const remaining = current.bills.filter((b) => !billState[b.invoiceId] && !bills.some((x) => x.invoiceId === b.invoiceId))
      if (remaining.length === 0) advance(current.customerId)
      else {
        setNote('')
        setPromiseDays(null)
        setCustomDate('')
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not mark the promise'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const applyCantReach = async () => {
    if (!current || saving) return
    setSaving(true)
    try {
      await recordTouch(current.customerId, null, 'cant_reach', { snoozeDays })
      setOutcomes((prev) => [
        ...prev,
        {
          customerId: current.customerId,
          name: current.name,
          kind: 'cant_reach',
          detail: `no answer — back in ${snoozeDays} day${snoozeDays === 1 ? '' : 's'}`,
          dollars: 0,
        },
      ])
      onRecorded()
      advance(current.customerId)
    } catch (e) {
      showToast(formatErrorMessage(e, "Could not record the can't-reach"), 'error')
    } finally {
      setSaving(false)
    }
  }

  const applyDispute = async () => {
    if (!current || saving) return
    const bills = current.bills.filter((b) => checked[b.invoiceId] && !billState[b.invoiceId])
    if (bills.length === 0) {
      showToast('Check the disputed bill first.', 'error')
      return
    }
    setSaving(true)
    try {
      for (const b of bills) {
        await recordTouch(current.customerId, b.jobId, 'dispute')
      }
      setBillState((prev) => {
        const next = { ...prev }
        for (const b of bills) next[b.invoiceId] = '⚠ disputed'
        return next
      })
      setOutcomes((prev) => [
        ...prev,
        {
          customerId: current.customerId,
          name: current.name,
          kind: 'dispute',
          detail: `${bills.length} bill${bills.length === 1 ? '' : 's'} disputed${note.trim() ? ` · "${note.trim()}"` : ''} → flagged for review`,
          dollars: bills.reduce((s, b) => s + b.open, 0),
        },
      ])
      onRecorded()
      const remaining = current.bills.filter((b) => !billState[b.invoiceId] && !bills.some((x) => x.invoiceId === b.invoiceId))
      if (remaining.length === 0) advance(current.customerId)
      else setNote('')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not record the dispute'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const applyNote = async () => {
    if (!current || saving) return
    setSaving(true)
    try {
      await recordTouch(current.customerId, null, 'note')
      setOutcomes((prev) => [
        ...prev,
        {
          customerId: current.customerId,
          name: current.name,
          kind: 'note',
          detail: note.trim() ? `left a message · "${note.trim()}"` : 'left a message',
          dollars: 0,
        },
      ])
      onRecorded()
      advance(current.customerId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const resolveDispute = async (d: ChaseDispute) => {
    if (saving) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('resolve_payment_chase_dispute' as never, {
        p_touch_id: d.touch.id,
      } as never)
      if (error) throw error
      onRecorded()
      showToast('Dispute resolved — the bill re-enters the follow-up queue.', 'success')
      setSelectedDispute(null)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not resolve the dispute'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const skip = () => {
    if (!current) return
    setOutcomes((prev) => [
      ...prev,
      { customerId: current.customerId, name: current.name, kind: 'skipped', detail: 'skipped', dollars: 0 },
    ])
    advance(current.customerId)
  }

  const promisedDollars = outcomes.filter((o) => o.kind === 'promised').reduce((s, o) => s + o.dollars, 0)
  // Live preview of where the promise would land (per bill) — the confidence
  // check before committing. Null until the input resolves.
  const pendingBills = current ? current.bills.filter((b) => checked[b.invoiceId] && !billState[b.invoiceId]) : []
  const promisePreview =
    current && pendingBills.length > 0
      ? resolvePromiseDates({ mode: promiseMode, ymd: customDate, days: promiseDays, bills: pendingBills, todayYmd })
      : null
  const previewButtonLabel = (() => {
    if (!promisePreview) return 'Mark promise'
    const n = pendingBills.length
    const u = promisePreview.uniqueYmds
    const first = u[0]
    const last = u[u.length - 1]
    if (u.length === 1 && first) return `Mark ${n === 1 ? 'promise' : `${n} promises`} → ${formatYmdMonthDay(first)}`
    return `Mark ${n} promises · ${first ? formatYmdMonthDay(first) : ''} – ${last ? formatYmdMonthDay(last) : ''}`
  })()

  // Phone-in-hand keys (v2.2044): 1–4 tap the active mode's chips, Enter
  // marks the promise once it resolves, C can't-reach, → skips. Typing in
  // any field is left alone (Enter still applies from the date/number
  // inputs, but never from the note box — notes ride the buttons).
  useEffect(() => {
    if (!snapshot || finished || !current || currentDispute) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      const inNoteBox = inField && (t as HTMLInputElement).placeholder?.startsWith('✎')
      if (e.key === 'Enter' && !inNoteBox) {
        if (promisePreview && !saving) {
          e.preventDefault()
          void applyPromise()
        }
        return
      }
      if (inField) return
      if (promiseMode !== 'date' && /^[1-4]$/.test(e.key)) {
        const n = PROMISE_DAY_CHIPS[promiseMode][Number(e.key) - 1]
        if (n != null) {
          e.preventDefault()
          setPromiseDays((prev) => (prev === n ? null : n))
        }
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        void applyCantReach()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const promiseModePill = (m: PromiseDateMode): CSSProperties => ({
    border: 'none',
    borderLeft: m === 'today' || m === 'billed' ? '1px solid var(--border-strong)' : 'none',
    background: promiseMode === m ? 'var(--bg-green-tint)' : 'var(--surface)',
    color: promiseMode === m ? 'var(--text-green-700)' : 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.3rem 0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  })

  const railCustomer = (c: ChaseCustomer, kind: 'due' | 'waiting') => {
    const isDone = doneIds.has(c.customerId)
    const isSelected = current?.customerId === c.customerId && !currentDispute && !finished
    return (
      <button
        key={c.customerId}
        type="button"
        onClick={() => {
          setFinished(false)
          setSelectedDispute(null)
          setSelectedId(c.customerId)
        }}
        aria-selected={isSelected}
        style={{
          border: `1px solid ${isSelected ? 'var(--text-link)' : 'transparent'}`,
          background: isSelected ? 'var(--surface)' : 'none',
          borderRadius: 8,
          textAlign: 'left',
          padding: '0.45rem 0.55rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
          opacity: kind === 'waiting' || isDone ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 650, display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          {isDone ? (
            <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-green-700)' }}>✓</span>
          ) : (
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                borderRadius: 5,
                padding: '0.05rem 0.4rem',
                background: c.state === 'broken' ? 'var(--bg-amber-tint)' : 'var(--bg-red-tint)',
                color: c.state === 'broken' ? 'var(--text-amber-800)' : 'var(--text-red-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.state === 'broken' ? 'broken promise' : 'ask'}
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
          <span>
            {kind === 'waiting' && c.waitReason
              ? c.waitReason.kind === 'snoozed'
                ? `can't reach · back ${c.waitReason.untilYmd ? formatYmdMonthDay(c.waitReason.untilYmd) : 'soon'}`
                : `touched — quiet ${TOUCH_QUIET_DAYS}d`
              : `${c.bills.length} bill${c.bills.length === 1 ? '' : 's'} · to ${Math.max(...c.bills.map((b) => b.model.daysLate))}d late`}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(c.openLate)}</span>
        </span>
      </button>
    )
  }

  const railCap = (label: string) => (
    <span
      style={{
        fontSize: '0.66rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-muted)',
        padding: '0.2rem 0.4rem',
      }}
    >
      {label}
    </span>
  )

  const speedLine = (c: ChaseCustomer): string => {
    const own = paySpeeds?.customers[c.customerId]
    if (own && own.samples >= 3) return `usually pays in ~${own.medianDays}d`
    const company = paySpeeds?.company
    return company ? `company avg (~${company.medianDays}d)` : ''
  }

  const billEvidence = (b: ChaseBill): string => {
    const parts: string[] = []
    if (b.billedYmd) parts.push(`billed ${formatYmdMonthDay(b.billedYmd)}`)
    if (b.sentChannel === 'stripe') parts.push('Stripe email')
    else if (b.sentAtIso) parts.push('emailed')
    if (b.amount != null && b.amount > b.open) parts.push(`${formatUsdNoCents(b.amount - b.open)} of ${formatUsdNoCents(b.amount)} paid`)
    parts.push(b.model.label)
    return parts.join(' · ')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment follow-up call mode"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          width: 'min(860px, calc(100vw - 2rem))',
          maxHeight: 'min(88vh, 940px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.2rem 0.6rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Payment follow-up</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
              {snapshot
                ? `${due.length} customer${due.length === 1 ? '' : 's'} · ${formatUsdNoCents(snapshot.dueDollars)} past expected · promises you record here turn the board chips green`
                : 'Loading the billed board…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment follow-up"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, padding: '0.15rem' }}
          >
            ✕
          </button>
        </div>

        {!snapshot ? (
          <p style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }} aria-busy>
            Loading bills…
          </p>
        ) : finished || (due.every((c) => doneIds.has(c.customerId)) && !currentDispute && !selectedId) ? (
          /* ---------- Wrap-up ---------- */
          <div style={{ padding: '0.9rem 1.2rem 1.2rem', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem' }}>
              Calls done{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>
                · {outcomes.length} outcome{outcomes.length === 1 ? '' : 's'} recorded
              </span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.6rem', textAlign: 'center', background: 'var(--bg-muted)' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-green-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsdNoCents(promisedDollars)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>now has promised dates</div>
              </div>
              {(['cant_reach', 'dispute', 'note'] as const).map((k) => {
                const n = outcomes.filter((o) => o.kind === k).length
                if (n === 0) return null
                const label = k === 'cant_reach' ? "can't reach — snoozed" : k === 'dispute' ? 'disputes flagged for review' : 'messages left'
                return (
                  <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.6rem', textAlign: 'center', background: 'var(--bg-muted)' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
              {outcomes.map((o, i) => (
                <span key={i}>
                  {o.kind === 'promised' ? '✓' : o.kind === 'dispute' ? '⚠' : '◌'} <strong>{o.name}</strong> — {o.detail}
                  {o.dollars > 0 ? ` (${formatUsdNoCents(o.dollars)})` : ''}
                </span>
              ))}
              {outcomes.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Nothing recorded this session.</span>}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ ...chipBtn, marginTop: '0.9rem', background: 'var(--text-link)', borderColor: 'var(--text-link)', color: '#fff' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            {/* ---------- Rail ---------- */}
            <div
              style={{
                width: 236,
                flexShrink: 0,
                borderRight: '1px solid var(--border)',
                background: 'var(--bg-muted)',
                padding: '0.6rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                overflowY: 'auto',
              }}
            >
              {due.length > 0 && railCap(due.some((c) => c.temperature === 'cold' || c.temperature === 'cool') ? 'Owes a call — coldest first, then biggest' : 'Owes a call — biggest first')}
              {due.map((c) => railCustomer(c, 'due'))}
              {waiting.length > 0 && railCap('Waiting — not today')}
              {waiting.map((c) => railCustomer(c, 'waiting'))}
              {disputes.length > 0 && railCap('Disputes — need review')}
              {disputes.map((d) => (
                <button
                  key={d.touch.id}
                  type="button"
                  onClick={() => {
                    setFinished(false)
                    setSelectedId(null)
                    setSelectedDispute(d.touch.id)
                  }}
                  aria-selected={currentDispute?.touch.id === d.touch.id}
                  style={{
                    border: `1px solid ${currentDispute?.touch.id === d.touch.id ? 'var(--text-link)' : 'transparent'}`,
                    background: currentDispute?.touch.id === d.touch.id ? 'var(--surface)' : 'none',
                    borderRadius: 8,
                    textAlign: 'left',
                    padding: '0.45rem 0.55rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: 'inherit',
                    fontSize: '0.74rem',
                  }}
                >
                  <span style={{ fontWeight: 650 }}>⚠ {d.customerName}</span>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    {d.bill ? `${d.bill.label} · ${formatUsdNoCents(d.bill.open)}` : 'bill'}
                  </span>
                </button>
              ))}
            </div>

            {/* ---------- Pane ---------- */}
            <div style={{ flex: 1, minWidth: 0, padding: '0.9rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto' }}>
              {currentDispute ? (
                <>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>⚠ {currentDispute.customerName} — dispute</div>
                  <div style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
                    {currentDispute.bill ? `${currentDispute.bill.label} · ${formatUsdNoCents(currentDispute.bill.open)} open` : 'Bill'} · flagged{' '}
                    {formatYmdMonthDay(currentDispute.touch.createdAt.slice(0, 10))} by {currentDispute.touch.createdByName}
                    {currentDispute.touch.note ? ` · "${currentDispute.touch.note}"` : ''}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Resolving puts the bill back in the follow-up queue. To escalate instead, open the bill on the board and use its
                    Collections button.
                  </p>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void resolveDispute(currentDispute)}
                      style={{ ...chipBtn, background: 'var(--bg-green-tint)', borderColor: 'var(--text-green-700)', color: 'var(--text-green-700)' }}
                    >
                      Resolved — back to the queue
                    </button>
                    {currentDispute.bill ? (
                      <button type="button" onClick={() => onOpenInvoice(currentDispute.bill!.invoiceId)} style={chipBtn}>
                        Open the bill on the board →
                      </button>
                    ) : null}
                  </div>
                </>
              ) : current ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{current.name}</span>
                    {contacts[current.customerId]?.phone ? (
                      <a
                        href={`tel:${contacts[current.customerId]?.phone ?? ''}`}
                        style={{ color: 'var(--text-link)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {contacts[current.customerId]?.phone}
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>no phone on file</span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{speedLine(current)}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '0.4rem 0.6rem',
                      borderRadius: 8,
                      background: current.state === 'broken' ? 'var(--bg-amber-tint)' : 'var(--bg-red-tint)',
                      color: current.state === 'broken' ? 'var(--text-amber-800)' : 'var(--text-red-700)',
                    }}
                  >
                    {current.state === 'broken'
                      ? `Broken promise — ${current.bills[0]?.model.label ?? ''}`
                      : `Never asked — ${current.bills.length} bill${current.bills.length === 1 ? '' : 's'}, oldest ${Math.max(...current.bills.map((b) => b.model.daysLate))} days late`}
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {current.bills.map((b, i) => (
                      <label
                        key={b.invoiceId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto auto',
                          gap: '0.55rem',
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.78rem',
                          alignItems: 'start',
                          cursor: 'pointer',
                          background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checked[b.invoiceId]) && !billState[b.invoiceId]}
                          disabled={Boolean(billState[b.invoiceId])}
                          onChange={() => setChecked((prev) => ({ ...prev, [b.invoiceId]: !prev[b.invoiceId] }))}
                          style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                        />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                          <span>{b.label}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {billState[b.invoiceId] ? (
                              <strong style={{ color: billState[b.invoiceId]?.startsWith('✓') ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
                                {billState[b.invoiceId]}
                              </strong>
                            ) : (
                              billEvidence(b)
                            )}
                          </span>
                          {b.stripeInvoiceId && !b.stripePaid && !billState[b.invoiceId] ? (
                            <span onClick={(e) => e.preventDefault()} style={{ marginTop: '0.15rem' }}>
                              <StripeInvoiceSendFromStripeButton
                                jobsLedgerInvoiceId={b.invoiceId}
                                stripeInvoiceId={b.stripeInvoiceId}
                                customerEmail={contacts[current.customerId]?.email ?? null}
                                stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
                                onSent={() => {
                                  setBillState((prev) => ({ ...prev, [b.invoiceId]: '↩ resent just now' }))
                                  void recordTouch(current.customerId, b.jobId, 'resend')
                                    .then(onRecorded)
                                    .catch(() => {
                                      /* the send itself succeeded — the touch is best-effort */
                                    })
                                }}
                                compact
                                micro
                                unboxed
                                hideInlineSuccessLine
                                recordedLastSendAt={b.sentAtIso}
                                buttonLabel="Never got it? Resend"
                              />
                            </span>
                          ) : null}
                        </span>
                        {/* Live landing chip: where the pending promise puts THIS
                            bill. A landing already in the past goes amber — net
                            terms they've already blown; recording it is honest,
                            and the bill re-queues after the 7-day grace. */}
                        {(() => {
                          const landYmd = promisePreview?.byInvoice.get(b.invoiceId)
                          if (!landYmd) return <span />
                          const past = landYmd < todayYmd
                          return (
                            <span
                              title={past ? 'This lands in the past — these terms are already blown; the bill returns to the queue after the grace period' : undefined}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: past ? 'var(--text-amber-800)' : 'var(--text-green-700)',
                                background: past ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)',
                                borderRadius: 6,
                                padding: '0.1rem 0.4rem',
                                whiteSpace: 'nowrap',
                                alignSelf: 'center',
                              }}
                            >
                              → {formatYmdMonthDay(landYmd)}
                              {past ? ' · past' : ''}
                            </span>
                          )
                        })()}
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{formatUsdNoCents(b.open)}</span>
                      </label>
                    ))}
                    {current.notLate.length > 0 ? (
                      <>
                        <div
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--text-muted)',
                            padding: '0.35rem 0.6rem 0.1rem',
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          Also open — not late yet (cover it while you have them)
                        </div>
                        {current.notLate.map((b) => (
                          <div
                            key={b.invoiceId}
                            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.55rem', padding: '0.35rem 0.6rem', fontSize: '0.76rem', opacity: 0.65 }}
                          >
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 }}>
                              <span>{b.label}</span>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{b.model.label}</span>
                            </span>
                            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{formatUsdNoCents(b.open)}</span>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Promise builder (v2.2044): three ways to say a date —
                        the exact date, N days from today, or N days after
                        each bill went out (net terms; dates diverge per bill,
                        previewed live as green landing chips on the bill rows). */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-700)', width: 108, flexShrink: 0 }}>They gave a date</span>
                        <span
                          role="group"
                          aria-label="How they said it"
                          style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 9999, overflow: 'hidden' }}
                        >
                          <button type="button" aria-pressed={promiseMode === 'date'} onClick={() => setPromiseMode('date')} style={promiseModePill('date')}>
                            📅 A date
                          </button>
                          <button type="button" aria-pressed={promiseMode === 'today'} onClick={() => setPromiseMode('today')} style={promiseModePill('today')}>
                            In N days
                          </button>
                          <button type="button" aria-pressed={promiseMode === 'billed'} onClick={() => setPromiseMode('billed')} style={promiseModePill('billed')}>
                            N days after billing
                          </button>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', paddingLeft: 108 + 8 }}>
                        {promiseMode === 'date' ? (
                          <>
                            <input
                              type="date"
                              value={customDate}
                              onChange={(e) => setCustomDate(e.target.value)}
                              aria-label="The date they named"
                              style={{ height: 28, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.74rem', padding: '0 0.3rem', fontFamily: 'inherit' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>the same date lands on every checked bill</span>
                          </>
                        ) : (
                          <>
                            {PROMISE_DAY_CHIPS[promiseMode].map((n) => (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={promiseDays === n}
                                onClick={() => setPromiseDays((prev) => (prev === n ? null : n))}
                                style={{
                                  ...chipBtn,
                                  ...(promiseDays === n
                                    ? { background: 'var(--bg-green-tint)', borderColor: 'var(--text-green-700)', color: 'var(--text-green-700)' }
                                    : {}),
                                }}
                              >
                                {promiseMode === 'billed' ? `net ${n}` : `${n}d`}
                              </button>
                            ))}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border-strong)', borderRadius: 9999, padding: '0.1rem 0.55rem 0.1rem 0.55rem', background: 'var(--surface)' }}>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={promiseDays ?? ''}
                                placeholder="—"
                                onChange={(e) => {
                                  const v = Number(e.target.value)
                                  setPromiseDays(Number.isFinite(v) && v > 0 ? Math.round(v) : null)
                                }}
                                aria-label={promiseMode === 'billed' ? 'Days after each bill went out' : 'Days from today'}
                                style={{ width: 44, border: 'none', background: 'none', color: 'var(--text)', font: 'inherit', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center', outline: 'none' }}
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {promiseMode === 'billed' ? 'days after each bill went out' : 'days from today'}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', paddingLeft: 108 + 8 }}>
                        <button
                          type="button"
                          disabled={saving || !promisePreview}
                          onClick={() => void applyPromise()}
                          style={{
                            ...chipBtn,
                            fontWeight: 700,
                            ...(promisePreview
                              ? { background: 'var(--text-green-700)', borderColor: 'var(--text-green-700)', color: 'var(--surface)' }
                              : { background: 'var(--bg-green-tint)', borderColor: 'var(--border-strong)', color: 'var(--text-green-700)', opacity: 0.55 }),
                          }}
                        >
                          {previewButtonLabel}
                        </button>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {promisePreview
                            ? promisePreview.uniqueYmds.length > 1
                              ? 'each bill lands on its own date — net terms, honestly kept'
                              : `applies to the ${pendingBills.length} checked`
                            : pendingBills.length === 0
                              ? 'check at least one bill'
                              : promiseMode === 'date'
                                ? 'pick the date they named'
                                : 'tap a chip or type the days'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-700)', width: 108, flexShrink: 0 }}>They push back</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void applyDispute()}
                        style={{ ...chipBtn, background: 'var(--bg-amber-tint)', borderColor: 'var(--text-amber-700)', color: 'var(--text-amber-800)' }}
                      >
                        Dispute — flag for review
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-700)', width: 108, flexShrink: 0 }}>No answer</span>
                      <button type="button" disabled={saving} onClick={() => void applyCantReach()} style={chipBtn}>
                        Can&#8217;t reach
                      </button>
                      <select
                        value={snoozeDays}
                        onChange={(e) => setSnoozeDays(Number(e.target.value))}
                        aria-label="Can't-reach snooze window"
                        style={{ height: 28, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.72rem', fontFamily: 'inherit' }}
                      >
                        <option value={1}>back tomorrow</option>
                        <option value={3}>back in 3 days</option>
                        <option value={7}>back in 7 days</option>
                      </select>
                      <button type="button" disabled={saving} onClick={() => void applyNote()} style={{ ...chipBtn, color: 'var(--text-muted)' }}>
                        Left a message / note only
                      </button>
                    </div>
                    {current.brokenPromiseTouches >= CHASE_COLLECTIONS_SUGGESTION_THRESHOLD ? (
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.4rem 0.6rem' }}>
                        ⚠️ {current.brokenPromiseTouches} promises have come and gone — consider Collections (open the bill on the board for the button)
                      </div>
                    ) : null}
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="✎ what they said… (saves with whichever button you tap)"
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.45rem 0.6rem',
                        fontSize: '0.78rem',
                        background: 'var(--bg-muted)',
                        color: 'var(--text)',
                        fontFamily: 'inherit',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody owes a call right now. 🎉</p>
              )}
            </div>
          </div>
        )}

        {snapshot && !finished && current && !currentDispute ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.1rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>
              keys: 1&#8211;4 tap a chip · Enter marks the promise · C can&#8217;t reach · &#8594; skip — every outcome logs who
              called and what happened
            </span>
            <button type="button" onClick={skip} style={{ ...chipBtn, marginLeft: 'auto' }}>
              Skip →
            </button>
            <button type="button" onClick={() => setFinished(true)} style={chipBtn}>
              Finish
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
