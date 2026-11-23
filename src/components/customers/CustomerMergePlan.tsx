import { useState, type CSSProperties } from 'react'
import { LEGAL_BLOCKED_WORDS, sameJobWords, type MergePlan } from '../../lib/customers/customerMergePlan'
import { EmptyState } from '../EmptyState'

/**
 * What a customer merge will do, before it runs (v2.8324): everything the customer that goes holds, which all moves to
 * this one, then what the rules do where the two may not both hold a thing, the jobs that name the two as customer and
 * GC, and the legal matter that stops a merge. The words are `customerMergePlan.ts`'s. A long list folds after six
 * kinds behind a press.
 */
const SHOWN = 6

const cap: CSSProperties = { fontWeight: 600, marginBottom: 4 }
const list: CSSProperties = { margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: 2 }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '6px 0 0' }
const press: CSSProperties = { background: 'none', border: 0, padding: '6px 0', minHeight: 32, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const box: CSSProperties = { background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.75rem' }

export function CustomerMergePlan({ plan }: { plan: MergePlan }) {
  const [open, setOpen] = useState(false)
  const shown = open ? plan.holds : plan.holds.slice(0, SHOWN)
  const hidden = plan.holds.length - shown.length
  const sameJob = sameJobWords(plan.sameJob)
  return (
    <div data-testid="customer-merge-plan">
      {plan.legalBlocked && (
        <p role="alert" style={{ color: 'var(--text-red-700)', margin: '0 0 8px' }}>
          {LEGAL_BLOCKED_WORDS}
        </p>
      )}
      <div style={box}>
        <div style={cap}>Moves to this customer</div>
        {plan.holds.length === 0 ? (
          <EmptyState main="Nothing is linked to the other customer. Only its own row goes." compact />
        ) : (
          <>
            <ul style={list}>
              {shown.map((l) => (
                <li key={l.key}>{l.words}</li>
              ))}
            </ul>
            {(hidden > 0 || open) && plan.holds.length > SHOWN && (
              <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={press}>
                {open ? 'Show fewer' : `See ${hidden} more ${hidden === 1 ? 'kind' : 'kinds'} ›`}
              </button>
            )}
          </>
        )}
      </div>
      {plan.rules.length > 0 && (
        <div style={box}>
          <div style={cap}>Where only one can stand</div>
          <ul style={list}>
            {plan.rules.map((r) => (
              <li key={r.what}>{r.words}</li>
            ))}
          </ul>
          <p style={muted}>Anything dropped is kept in the deleted records, where a dev can bring it back.</p>
        </div>
      )}
      {sameJob && <p style={{ color: 'var(--text-amber-800)', margin: '0 0 0.75rem' }}>{sameJob}</p>}
    </div>
  )
}
