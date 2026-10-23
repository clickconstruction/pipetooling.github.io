/**
 * The desk's second exit, as a panel inside the desk (v2.5760): **Write it down…** asks *How much will we
 * accept?* for the whole account, shows the split across its open bills, and its Save button says exactly what
 * it will do. Each bill then goes through the same per-bill write-down the Apply discount window uses — Stripe's
 * for a Stripe-hosted bill, the RPC for the rest — one at a time: a bill the write-down refuses is held with the
 * reason, and the rest still go.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { useAuth } from '../../../hooks/useAuth'
import { stripeModeInvokeBody } from '../../../lib/billingStripeModePref'
import { stripeModeForBillingFromRole } from '../../../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../../../lib/supabaseAccessTokenForEdge'
import { readEdgeFunctionErrorBody } from '../../../lib/readEdgeFunctionErrorBody'
import { supabase } from '../../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../../utils/errorHandling'
import { formatLegalMoney, type LegalPacket } from '../../../lib/legal/legalPacket'
import { accountBills, billRowWords, planAccountWriteDown, writeDownButtonWords, type AccountJob } from '../../../lib/legal/accountWriteDown'
import { runAccountWriteDown, type WriteDownHeld } from '../../../lib/legal/accountWriteDownRun'

export type { WriteDownHeld }

const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const TH: CSSProperties = { textAlign: 'left', fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', borderBottom: '1px solid var(--border)' }
const TD: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', verticalAlign: 'top' }
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
// Longhands, not the `border` shorthand with a `borderColor` over it: the box flips between the two styles and React warns on the mix (v2.5780).
const box: CSSProperties = { font: 'inherit', fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: '2px 6px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', textAlign: 'right' }
const boxOn: CSSProperties = { ...box, borderColor: '#2563eb' }

const cents = (n: number) => Math.round(n * 100)
const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
const plainMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export default function AccountWriteDownPanel({ jobs, lines, onDone, onCancel }: {
  jobs: ReadonlyArray<AccountJob>
  lines: ReadonlyArray<Pick<LegalPacket['account']['jobs'][number], 'jobId' | 'label'>>
  /** After the run: how many bills were written down, and the ones held with the reason. */
  onDone: (done: number, held: WriteDownHeld[]) => Promise<void>
  onCancel: () => void
}) {
  const { role: authRole } = useAuth()
  const bills = useMemo(() => accountBills(jobs, lines), [jobs, lines])
  const openTotal = bills.reduce((s, b) => s + cents(b.open), 0) / 100
  // We start at the full balance: nothing written down until the person moves it.
  const [unit, setUnit] = useState<'pct' | 'usd'>('pct')
  const [pct, setPct] = useState(100)
  const [pctText, setPctText] = useState('100')
  const [usdText, setUsdText] = useState(plainMoney(openTotal))
  const [note, setNote] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dollarsAt = (p: number) => Math.round((openTotal * p) / 100)
  const fromPct = (p: number) => { setUnit('pct'); setPct(p); setPctText(String(p)); setUsdText(p > 0 ? dollarsAt(p).toLocaleString('en-US') : '0') }
  const typePct = (raw: string) => {
    const text = raw.replace(/[^0-9]/g, '')
    setPctText(text)
    const n = Number(text)
    if (text === '') { setUnit('pct'); setPct(0); setUsdText('0') }
    else if (n >= 0 && n <= 100) { setUnit('pct'); setPct(n); setUsdText(dollarsAt(n).toLocaleString('en-US')) }
  }
  const typeUsd = (text: string) => {
    setUsdText(text)
    const n = Number(text.replace(/[$,]/g, ''))
    if (text.trim() === '') { setUnit('usd'); setPct(0); setPctText('0') }
    else if (Number.isFinite(n) && n >= 0) { setUnit('usd'); const p = openTotal > 0 ? clampPct((n / openTotal) * 100) : 0; setPct(p); setPctText(String(p)) }
  }
  const usdN = Number(usdText.replace(/[$,]/g, ''))
  const accept = unit === 'usd' ? (Number.isFinite(usdN) ? usdN : openTotal) : (openTotal * pct) / 100
  const plan = useMemo(() => planAccountWriteDown(bills, accept), [bills, accept])
  const noteOk = note.trim().length >= 3
  const canSave = plan.writes.length > 0 && noteOk && !running

  const run = async () => {
    setError(null)
    setRunning(true)
    try {
      const noteTrim = note.trim()
      let token: string | null = null
      const { done, held } = await runAccountWriteDown(plan.writes, noteTrim, {
        stripe: async (s, n) => {
          token = token ?? (await getAccessTokenForEdgeFunctions())
          if (!token) return 'not signed in for Stripe'
          try {
            const { data, error: fnErr } = await supabase.functions.invoke('stripe-invoice-agreed-write-down', {
              body: { jobs_ledger_invoice_id: s.invoiceId, new_total_dollars: s.newTotal, note: n, ...stripeModeInvokeBody(stripeModeForBillingFromRole(authRole)) },
              headers: { Authorization: `Bearer ${token}` },
            })
            if (fnErr) return (await readEdgeFunctionErrorBody(fnErr)) ?? formatErrorMessage(fnErr, 'Stripe refused it')
            const d = data as { error?: string } | null
            return d && typeof d.error === 'string' && d.error ? d.error : null
          } catch (e: unknown) {
            return e instanceof FunctionsHttpError ? ((await readEdgeFunctionErrorBody(e)) ?? 'Stripe refused it') : formatErrorMessage(e, 'Stripe refused it')
          }
        },
        rpc: async (s, n) => {
          const data = await withSupabaseRetry(
            () => supabase.rpc('apply_agreed_write_down_to_billed_invoice', { p_invoice_id: s.invoiceId, p_new_amount: s.newTotal, p_note: n }),
            'apply_agreed_write_down_to_billed_invoice',
          )
          const r = data as { error?: string } | null
          return r && typeof r === 'object' && typeof r.error === 'string' && r.error ? r.error : null
        },
      })
      await onDone(done, held)
    } catch (e: unknown) {
      setError(formatErrorMessage(e, 'Could not finish the write-down'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      data-legal-account-write-down
      onKeyDown={(e) => { if (e.key === 'Escape' && !running) { e.stopPropagation(); onCancel() } }}
      style={{ margin: '12px 0 0', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-muted)', maxWidth: 680 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>How much will we accept?</h3>
        <span style={{ ...MUTED, fontSize: '0.8rem' }}>They owe {formatLegalMoney(openTotal)} on {bills.length} bill{bills.length === 1 ? '' : 's'}.</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '10px 0 6px', fontSize: '0.84rem' }}>
        <span>We accept</span>
        <span style={{ fontWeight: 600 }}>$</span>
        <input type="text" inputMode="decimal" value={usdText} onChange={(e) => typeUsd(e.target.value)} aria-label="We accept, in dollars" style={{ ...(unit === 'usd' ? boxOn : box), width: 120 }} />
        <span style={MUTED}>or</span>
        <input type="text" inputMode="numeric" value={pctText} onChange={(e) => typePct(e.target.value)} aria-label="We accept, percent of what they owe" style={{ ...(unit === 'pct' ? boxOn : box), width: 52 }} />
        <span style={{ fontWeight: 600 }}>%</span>
        <span style={MUTED}>of what they owe</span>
        {plan.forgive > 0 ? <span style={{ fontWeight: 600, color: '#b42318' }}>· we forgive {formatLegalMoney(plan.forgive)}</span> : null}
      </div>
      <input type="range" min={0} max={100} step={1} value={pct} onChange={(e) => fromPct(Number(e.target.value))} aria-label="We accept, slider" autoFocus style={{ width: '100%', accentColor: '#2563eb' }} />
      <div style={{ ...MUTED, display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}><span>Forgive it all</span><span>Half</span><span>The full balance</span></div>

      {bills.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 0' }} data-legal-write-down-split>
          <thead><tr><th style={TH}>Job</th><th style={{ ...TH, textAlign: 'right' }}>Owes</th><th style={{ ...TH, textAlign: 'right' }}>We accept</th><th style={{ ...TH, textAlign: 'right' }}>We forgive</th><th style={{ ...TH, textAlign: 'right' }}>Still owes after</th></tr></thead>
          <tbody>
            {plan.shares.map((s) => (
              <tr key={s.invoiceId}>
                <td style={TD}>
                  {(() => { const w = billRowWords(s, plan.shares.filter((x) => x.jobId === s.jobId).length, formatLegalMoney); return <>{w.job}{w.bill ? <span style={{ ...MUTED, fontSize: '0.72rem' }}> · {w.bill}</span> : null}</> })()}
                  {s.stripeHosted ? <span style={{ ...MUTED, fontSize: '0.7rem' }}> · Stripe</span> : null}
                </td>
                <td style={{ ...TD, ...NUM }}>{formatLegalMoney(s.open)}</td>
                <td style={{ ...TD, ...NUM }}>{formatLegalMoney(s.accept)}</td>
                <td style={{ ...TD, ...NUM, color: s.forgive > 0 ? '#b42318' : undefined }}>{s.forgive > 0 ? formatLegalMoney(s.forgive) : '—'}</td>
                <td style={{ ...TD, ...NUM }}>{s.accept > 0 ? formatLegalMoney(s.accept) : 'nothing'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ ...MUTED, fontSize: '0.82rem', margin: '10px 0 0' }}>No open bill to write down. Create the bill lines first.</p>
      )}

      <label style={{ display: 'block', margin: '10px 0 0', fontSize: '0.8rem' }}>
        <span style={MUTED}>What was agreed, and with whom</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Settled by phone with Dana Burd on 10/22" aria-label="Write-down note" style={{ display: 'block', width: '100%', marginTop: 4, font: 'inherit', fontSize: '0.84rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
      </label>

      {error ? <p style={{ color: '#b42318', fontSize: '0.8rem', margin: '8px 0 0' }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" disabled={!canSave} onClick={() => void run()} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }} data-legal-write-down-save>
          {running ? 'Writing down…' : writeDownButtonWords(plan, formatLegalMoney)}
        </button>
        <button type="button" disabled={running} onClick={onCancel} style={btn}>Cancel</button>
        <span style={{ ...MUTED, fontSize: '0.74rem' }}>
          {plan.writes.length === 0 ? 'Move the slider or type what we accept.' : !noteOk ? 'Add a note of what was agreed.' : 'Each bill is written down to its share, one at a time. A bill the write-down refuses is listed with the reason; the rest still go.'}
        </span>
      </div>
    </div>
  )
}
