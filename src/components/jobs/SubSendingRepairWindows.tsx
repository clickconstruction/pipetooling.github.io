/**
 * The two repairs to recorded money (punch list #347's residue), each shown before anything is saved:
 *
 *  - `OverToCreditWindow`: a sheet paid past its total. The window says which payment changes and that what left
 *    the bank does not, then one press keeps the overage as the sub's credit.
 *  - `GatherSendingsWindow`: payments typed one per sheet, offered as the sendings they were. A group the app is
 *    unsure of is held with its reason and left unticked. The press names its count and what it leaves, goes on
 *    past a group that is refused, and says which and why.
 *
 * Plans and words come from `subSendingRepair.ts`. A save whose function is not on the database yet says so.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { ledgerDayWords } from '../../lib/subWorkOrders/subPaymentsLedger'
import { gatherOutcomeWords, gatherPlan, type OverToCreditPlan, type SendingGroup } from '../../lib/subWorkOrders/subSendingRepair'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MoneyText } from '../Money'

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
              On the sheet <MoneyText text={usd(plan.after)} /> + credit <MoneyText text={usd(plan.over)} /> = <b style={{ color: 'var(--text-green-700)' }}><MoneyText text={usd(plan.before)} /> ✓ the payment, as it was</b>
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
    const { error: err } = await supabase.rpc('convert_sub_overpayment_to_credit', { p_person_id: personId, p_payment_id: plan.paymentId, p_amount: plan.over })
    setSaving(false)
    if (err) setError(notLive(err) ? 'Turning an overpayment into a credit is not switched on yet. Nothing was changed.' : formatErrorMessage(err, 'Nothing was changed'))
    else {
      onDone()
      onClose()
    }
  }
  return <OverToCreditWindowView title={title} plan={plan} saving={saving} error={error} onConfirm={() => void confirm()} onClose={onClose} />
}

export type GatherOutcome = { done: number; payments: number; failed: Array<{ group: SendingGroup; reason: string }> }

export function GatherSendingsWindowView({ groups, busy, outcome, onGather, onClose }: { groups: readonly SendingGroup[]; busy: boolean; outcome: GatherOutcome | null; onGather: (picked: SendingGroup[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(groups.filter((g) => g.ready).map((g) => g.key)))
  const plan = useMemo(() => gatherPlan(groups, picked), [groups, picked])
  const said = outcome ? gatherOutcomeWords(outcome.done, outcome.failed.length) : null
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <div role="presentation" onClick={onClose} style={shell}>
      <div role="dialog" aria-modal="true" aria-label="Gather old payments into sendings" onClick={(e) => e.stopPropagation()} style={{ ...box, width: 'min(640px, 100%)' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Payments that were one check</h3>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
          These were typed one per sheet before a sending could cover several. Gathering changes no amount, date or sheet. It gives the rows one number, so they tick against the bank together.
        </div>
        {groups.length === 0 ? (
          <p style={{ margin: '0.8rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nothing waiting on this. Every payment that shares a person, a day and a way of paying is already one sending.</p>
        ) : null}
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {groups.map((g) => {
            const on = picked.has(g.key)
            return (
              <label key={g.key} data-testid="gather-group" style={{ display: 'block', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderRadius: 8, padding: '0.5rem 0.7rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 0.6rem', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(g.key)} aria-label={`${g.paidTo}, ${ledgerDayWords(g.ymd, true)}, ${usd(g.amount)}`} />
                  <b>{g.paidTo}</b>
                  <span>{ledgerDayWords(g.ymd, true)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{g.how || 'no method recorded'}</span>
                  <b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(g.amount)} /></b>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, paddingLeft: 22 }}>{g.lines.map((l) => `${usd(l.amount)} on ${l.job}`).join(' · ')}</div>
                {g.held ? <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-900)', marginTop: 3, paddingLeft: 22 }}>Held: {g.held}</div> : null}
              </label>
            )
          })}
        </div>
        {plan.sumWords ? (
          <div data-testid="gather-sum" style={{ marginTop: 10, fontSize: '0.8125rem' }}>
            {plan.sumWords}
          </div>
        ) : null}
        {outcome && said ? (
          <div role="status" data-testid="gather-outcome" style={{ marginTop: 10, fontSize: '0.8125rem' }}>
            <div style={{ color: said.tone === 'success' ? 'var(--text-green-700)' : 'var(--text-700)' }}>{said.line}</div>
            {said.head ? <div style={{ marginTop: 4, fontWeight: 600 }}>{said.head}</div> : null}
            {outcome.failed.map((f) => (
              <div key={f.group.key} style={{ color: 'var(--text-red-700)' }}>
                {f.group.paidTo}, {ledgerDayWords(f.group.ymd, true)}, <MoneyText text={usd(f.group.amount)} />: {f.reason}
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          {plan.leftWords ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>{plan.leftWords}</span> : null}
          <button type="button" style={quiet} onClick={onClose}>
            Close
          </button>
          <button type="button" disabled={plan.words.dead || busy} style={press(!plan.words.dead && !busy)} onClick={() => onGather(plan.groups)}>
            {busy ? 'Gathering…' : plan.words.button}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The connected window: one call per group, each on its own, so a refusal stops only its group. */
export function GatherSendingsWindow({ groups, onDone, onClose }: { groups: readonly SendingGroup[]; onDone: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<GatherOutcome | null>(null)
  const gather = async (picked: SendingGroup[]) => {
    setBusy(true)
    const result: GatherOutcome = { done: 0, payments: 0, failed: [] }
    for (const g of picked) {
      const { error } = await supabase.rpc('gather_sub_payments_into_sending', { p_person_id: g.personId, p_payment_ids: g.lines.map((l) => l.id) })
      if (error) result.failed.push({ group: g, reason: notLive(error) ? 'Gathering is not switched on yet.' : formatErrorMessage(error) })
      else {
        result.done += 1
        result.payments += g.lines.length
      }
    }
    setBusy(false)
    setOutcome(result)
    if (result.done > 0) onDone()
  }
  return <GatherSendingsWindowView groups={groups} busy={busy} outcome={outcome} onGather={(picked) => void gather(picked)} onClose={onClose} />
}
