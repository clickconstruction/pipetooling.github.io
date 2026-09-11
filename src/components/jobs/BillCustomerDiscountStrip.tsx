import { useMemo, useState } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import {
  DISCOUNT_REASON_PRESETS,
  discountNameForReason,
  discountRowsFromDb,
  parseDiscountEntry,
  planBillDiscount,
  type BillDiscountEntry,
  type BillDiscountPlan,
  type DiscountReasonPreset,
} from '../../lib/jobs/discountLine'

/** Discount green stays literal (saturated status color, theme rules). */
const INK = '#0f7a52'

export type BillCustomerDiscountStripRow = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order: number
  invoice_id?: string | null
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
}

type Props = {
  /** Every line item on the job (DB rows). */
  rows: BillCustomerDiscountStripRow[]
  /** The rows this bill lists — a draw's linked rows; null = the whole-job remainder. */
  scopedIds: string[] | null
  billAmount: number
  disabled?: boolean
  onApply: (plan: BillDiscountPlan) => Promise<void>
  /** Standing discount (v2.3272): the customer's rate, offered as one tap that fills the fields. */
  offer?: { pct: number; reason: DiscountReasonPreset | null; customerName: string } | null
}

const GROUP: React.CSSProperties = { display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', height: 30, background: 'var(--surface)' }
const PRE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: INK, background: 'var(--bg-green-100)', borderRight: '1px solid var(--border)' }
const INPUT: React.CSSProperties = { boxSizing: 'border-box', padding: '0.3rem 0.5rem', border: 'none', fontSize: '0.875rem', textAlign: 'right', background: 'transparent', fontVariantNumeric: 'tabular-nums' }

/**
 * Discount at the moment you send (v2.3268, round two of the discount
 * tools): a collapsed "− Add discount" by the bill amount; open, two lines
 * in the office's own words — "Take off 10% or 500" or "make this bill
 * $13,500" — reason chips, and one sentence saying what it does. The basis is
 * decided for you (a draw discounts its own lines; the remainder discounts the
 * whole job) with one link to flip it. Apply writes the same discount row the
 * Bill tab uses, through `apply_job_discount`; the parent re-syncs the amount
 * and the previews. Pure render + a promise to the parent.
 */
export function BillCustomerDiscountStrip({ rows, scopedIds, billAmount, disabled = false, onApply, offer = null }: Props) {
  const [open, setOpen] = useState(false)
  const [takeOff, setTakeOff] = useState('')
  const [makeIt, setMakeIt] = useState('')
  const [wholeJob, setWholeJob] = useState(false)
  const [reason, setReason] = useState<DiscountReasonPreset | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kernelRows = useMemo(() => discountRowsFromDb(rows), [rows])
  const entry: BillDiscountEntry | null = useMemo(() => {
    const total = parseFloat(makeIt.replace(/[$,\s]/g, ''))
    if (makeIt.trim() && Number.isFinite(total)) return { mode: 'total', total }
    const parsed = parseDiscountEntry(takeOff)
    if (!parsed) return null
    return parsed.mode === 'pct' ? { mode: 'pct', pct: parsed.pct } : { mode: 'usd', dollars: parsed.dollars }
  }, [takeOff, makeIt])
  const plan = useMemo(
    () =>
      entry
        ? planBillDiscount({
            rows: kernelRows,
            scopedIds,
            billAmount,
            entry,
            wholeJob,
            name: reason ? discountNameForReason(reason) : undefined,
            reason,
            newRowId: 'new',
          })
        : null,
    [entry, kernelRows, scopedIds, billAmount, wholeJob, reason],
  )
  const canFlip = scopedIds != null && entry?.mode !== 'total'

  if (!open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 0.5rem' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          title="Take a percent or dollars off, or make this bill a number you agreed — it becomes a discount line item on the job"
          style={{ padding: '0.3rem 0.7rem', background: 'transparent', border: '1px dashed #a7dcc2', borderRadius: 6, color: INK, fontSize: '0.8125rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 }}
        >
          − Add discount
        </button>
      </div>
    )
  }

  const apply = async () => {
    if (!plan || busy) return
    setBusy(true)
    setError(null)
    try {
      await onApply(plan)
      setOpen(false)
      setTakeOff('')
      setMakeIt('')
      setWholeJob(false)
      setReason(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid="bill-discount-strip"
      style={{ margin: '0 0 0.75rem', padding: '0.55rem 0.7rem', border: '1px dashed #a7dcc2', borderRadius: 8, background: 'var(--bg-green-100)', fontSize: '0.8125rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.6rem', alignItems: 'center' }}
    >
      {offer ? (
        <div data-testid="bill-discount-offer" style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{offer.customerName} gets {offer.pct}%</strong>
            <span style={{ color: 'var(--text-muted)' }}>{offer.reason ? ` (${offer.reason.toLowerCase()}, set on their card)` : ' (set on their card)'}</span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTakeOff(`${offer.pct}%`)
              setMakeIt('')
              setReason(offer.reason)
              setWholeJob(true)
            }}
            style={{ padding: '0.2rem 0.7rem', background: INK, color: '#ffffff', border: 'none', borderRadius: 5, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Use it
          </button>
        </div>
      ) : null}
      <span style={{ color: 'var(--text-700)', whiteSpace: 'nowrap' }}>Take off</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={GROUP}>
          <span aria-hidden style={PRE}>{entry?.mode === 'usd' ? '$' : '%'}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Take off — a percent like 10% or a dollar amount"
            placeholder="10% or 500"
            value={takeOff}
            disabled={busy}
            onChange={(e) => {
              setTakeOff(e.target.value.replace(/[^0-9.,%$\s]/g, ''))
              if (e.target.value.trim()) setMakeIt('')
            }}
            style={{ ...INPUT, width: '5.6rem' }}
          />
        </span>
      </span>
      <span style={{ color: 'var(--text-700)', whiteSpace: 'nowrap' }}>or make this bill</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={GROUP}>
          <span aria-hidden style={{ ...PRE, color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>$</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Make this bill — the total you agreed"
            placeholder={formatCurrency(billAmount)}
            value={makeIt}
            disabled={busy}
            onChange={(e) => {
              setMakeIt(e.target.value.replace(/[^0-9.,]/g, ''))
              if (e.target.value.trim()) setTakeOff('')
            }}
            style={{ ...INPUT, width: '6.6rem' }}
          />
        </span>
        <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
          {DISCOUNT_REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => setReason((r) => (r === p ? null : p))}
              aria-pressed={reason === p}
              style={{ border: `1px solid ${reason === p ? INK : '#a7dcc2'}`, background: reason === p ? INK : 'var(--surface)', color: reason === p ? '#ffffff' : INK, borderRadius: 999, padding: '1px 9px', fontSize: '0.71875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {p}
            </button>
          ))}
        </span>
      </span>
      <div style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span data-testid="bill-discount-sentence" style={{ flex: 1, minWidth: 0, color: plan ? 'var(--text-700)' : 'var(--text-muted)' }}>
          {plan ? (
            <>
              <strong>{plan.sentence.split(' · ')[0]}</strong>
              {plan.sentence.includes(' · ') ? ` · ${plan.sentence.split(' · ').slice(1).join(' · ')}` : ''}
              {canFlip ? (
                <>
                  {' · '}
                  <button type="button" onClick={() => setWholeJob((v) => !v)} style={{ padding: 0, background: 'transparent', border: 'none', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {wholeJob ? 'this draw only instead' : 'apply to the whole job instead'}
                  </button>
                </>
              ) : null}
              {' → '}
              <strong style={{ color: INK }}>${formatCurrency(plan.newBillAmount)}</strong>
            </>
          ) : entry?.mode === 'total' ? (
            'Type a total below what the bill is now.'
          ) : (
            'Type 10% or 500, or the total you agreed.'
          )}
        </span>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} style={{ padding: '0.25rem 0.6rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={!plan || busy || disabled}
          style={{ padding: '0.3rem 0.8rem', background: plan && !busy ? INK : 'var(--bg-muted)', color: plan && !busy ? '#ffffff' : 'var(--text-faint)', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: plan && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {error ? (
        <div role="alert" style={{ gridColumn: '1 / span 2', color: 'var(--text-red-700)', fontSize: '0.75rem' }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}
