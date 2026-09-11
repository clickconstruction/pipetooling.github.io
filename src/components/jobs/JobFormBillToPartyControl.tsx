import type { CSSProperties } from 'react'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import { jobBillToPartyOptions, type JobBillToParty } from '../../lib/jobs/billToParty'

/**
 * "Bills go to" (v2.3345): the job's one answer to who pays — This customer,
 * the GC (when the job has one that is not the customer row), or Split by
 * line. Shared by the Edit-tab fact row and the New Job customer block; the
 * shell owns the value (identity autosave slice).
 */
export function JobFormBillToPartyControl({
  value,
  onChange,
  customerId,
  gcCustomerId,
  gcName,
  gcBillingEmail,
  customerName,
  compact = false,
}: {
  value: JobBillToParty
  onChange: (v: JobBillToParty) => void
  customerId: string | null
  gcCustomerId: string | null
  gcName: string | null
  /** The GC's billing email (or contact email) — named in the hint under the GC choice. */
  gcBillingEmail: string | null
  customerName: string | null
  compact?: boolean
}) {
  const options = jobBillToPartyOptions({ gcCustomerId, customerId, gcName })
  const gcOffered = options.some((o) => o.value === 'gc')
  // A saved "gc" on a job whose GC was cleared shows as customer (the payload
  // writes it back that way on the next save — see buildEditJobIdentityUpdatePayload).
  const effective: JobBillToParty = value === 'gc' && !gcOffered ? 'customer' : value
  const segBtn = (active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: compact ? '0.25rem 0.6rem' : '0.35rem 0.75rem',
    fontSize: compact ? '0.75rem' : '0.8125rem',
    fontWeight: 600,
    border: 'none',
    borderRight: '1px solid var(--border-strong)',
    background: active ? 'var(--text-strong)' : 'var(--surface)',
    color: active ? 'var(--surface)' : 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })
  const hint = (() => {
    const cust = (customerName ?? '').trim() || 'the job customer'
    const gc = (gcName ?? '').trim() || 'the GC'
    switch (effective) {
      case 'gc':
        return `Bills, the GC statement and the portal address ${gc}${gcBillingEmail ? ` · ${gcBillingEmail}` : ' — add a billing email on the GC'}. ${cust} is not billed.`
      case 'split':
        return 'Each draft invoice picks its payer on the Bill tab — Customer, GC, or someone else.'
      default:
        return gcOffered ? `Bills address ${cust}. ${gc} sees the stage plan only.` : `Bills address ${cust}.`
    }
  })()
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Bills go to"
        style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', maxWidth: '100%' }}
      >
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={effective === o.value}
            title={o.hint}
            onClick={(e) => {
              e.stopPropagation()
              onChange(o.value)
            }}
            style={{ ...segBtn(effective === o.value), ...(i === options.length - 1 ? { borderRight: 'none' } : {}) }}
          >
            {o.value === 'gc' ? <GcHardHatIcon size={11} /> : null}
            {o.label}
          </button>
        ))}
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{hint}</p>
    </div>
  )
}
