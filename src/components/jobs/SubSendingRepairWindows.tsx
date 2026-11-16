/**
 * A repair to recorded money (punch list #347's residue), shown before anything is saved.
 *
 * `OverToCreditWindow`: a sheet paid past its total. The window says which payment changes and that what left the
 * bank does not, then one press keeps the overage as the sub's credit.
 *
 * The plan and its words come from `subSendingRepair.ts`. The save is one function that is not on the database until
 * its migration is pushed: a refusal says so.
 */
import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { OverToCreditPlan } from '../../lib/subWorkOrders/subSendingRepair'
import { formatErrorMessage } from '../../utils/errorHandling'

const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shell: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }
const box: CSSProperties = { background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1.1rem 1.2rem', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }
const quiet: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const press = (live: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.875rem', fontWeight: 650, padding: '0.4rem 0.9rem', borderRadius: 6, border: 'none', background: live ? '#2563eb' : DEAD_PRESS_FILL, color: live ? 'white' : DEAD_PRESS_TEXT, cursor: live ? 'pointer' : 'default' })

/** A function its migration has not created yet answers with one of these. */
const notLive = (e: unknown): boolean => /PGRST202|42883|could not find the function/i.test(JSON.stringify(e ?? ''))

export function OverToCreditWindowView({ title, plan, saving, error, onConfirm, onClose }: { title: string; plan: OverToCreditPlan; saving: boolean; error: string | null; onConfirm: () => void; onClose: () => void }) {
  return (
    <div role="presentation" onClick={onClose} style={shell}>
      <div role="dialog" aria-modal="true" aria-label="Keep the overpayment as credit" onClick={(e) => e.stopPropagation()} style={{ ...box, width: 'min(500px, 100%)' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Paid past the sheet</h3>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{title}</div>
        {plan.ok ? (
          <>
            <ol data-testid="over-to-credit-plan" style={{ margin: '0.7rem 0 0', paddingLeft: '1.2rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
              {plan.words.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ol>
            <div style={{ marginTop: 10, padding: '0.5rem 0.7rem', background: 'var(--bg-page)', borderRadius: 6, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
              On the sheet {usd(plan.after)} + credit {usd(plan.over)} = <b style={{ color: 'var(--text-green-700)' }}>{usd(plan.before)} ✓ the payment, as it was</b>
            </div>
          </>
        ) : (
          <p role="alert" style={{ margin: '0.7rem 0 0', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
            {plan.error}
          </p>
        )}
        {error ? (
          <p role="alert" style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" style={quiet} onClick={onClose}>
            {plan.ok ? 'Cancel' : 'Close'}
          </button>
          {plan.ok ? (
            <button type="button" disabled={saving} style={press(!saving)} onClick={onConfirm}>
              {saving ? 'Saving…' : plan.confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** The connected window: one call to `convert_sub_overpayment_to_credit`. */
export function OverToCreditWindow({ title, plan, personId, onDone, onClose }: { title: string; plan: OverToCreditPlan; personId: string | null; onDone: () => void; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    if (!plan.ok || !personId) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.rpc('convert_sub_overpayment_to_credit' as never, { p_person_id: personId, p_payment_id: plan.paymentId, p_amount: plan.over } as never)
    setSaving(false)
    if (err) setError(notLive(err) ? 'Turning an overpayment into a credit is not switched on yet. Nothing was changed.' : formatErrorMessage(err, 'Nothing was changed'))
    else {
      onDone()
      onClose()
    }
  }
  return <OverToCreditWindowView title={title} plan={plan} saving={saving} error={error} onConfirm={() => void confirm()} onClose={onClose} />
}
