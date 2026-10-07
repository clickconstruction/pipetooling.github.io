import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { useReloadDraft } from '../../../hooks/useReloadDraft'
import { legalRpcData } from '../../../hooks/useLegalMatters'
import { draftStorageKey } from '../../../lib/reloadDraft'
import { legalFirmInputProblem, legalFirmReplaceWords, legalReplaceErrorWords, type LegalFirmFacts } from '../../../lib/legal/legalFirmFacts'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'

type NewFirm = { name: string; handling_name: string; email: string; phone: string; contingency_pct: string; filing_cost: string }

/**
 * Replace the collections law firm (v2.4712), in the firm's window, a dev's only: the stand-in
 * is retired and the new firm added in one database call (`legal_replace_firm`). Before it is
 * pressed the panel says what retiring does, from what hangs on the firm now. While an account
 * is still with the old firm the call is refused, so the panel lists those accounts with a way
 * back to each on the desk, where *Pull back* lives.
 */
export default function LegalFirmReplacePanel({ firm, facts, onReplaced, onShowAccount }: {
  firm: LegalFirmRow
  facts: LegalFirmFacts
  onReplaced: () => void
  onShowAccount?: (payerKey: string) => void
}) {
  const { showToast } = useToastContext()
  // The Settings block's draft of the old firm must not come back onto the new one.
  const oldFirmDraft = useReloadDraft<unknown>(draftStorageKey('legal-firm', 'form'))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [next, setNext] = useState<NewFirm>({ name: '', handling_name: '', email: '', phone: '', contingency_pct: String(firm.contingency_pct), filing_cost: String(firm.filing_cost) })
  const set = (k: keyof NewFirm) => (e: { target: { value: string } }) => setNext((n) => ({ ...n, [k]: e.target.value }))
  const blocked = facts.withFirm.length > 0

  const replace = async () => {
    const problem = legalFirmInputProblem(next)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await legalRpcData('legal_replace_firm', {
        p_old_firm_id: firm.id,
        p_name: next.name.trim(),
        p_handling_name: next.handling_name.trim(),
        p_email: next.email.trim(),
        p_phone: next.phone.trim(),
        p_contingency_pct: Number(next.contingency_pct),
        p_filing_cost: Number(next.filing_cost),
      })
      if (r.error) {
        setError(legalReplaceErrorWords(r.error))
        return
      }
      oldFirmDraft.clear()
      showToast(`${next.name.trim()} is the firm now. ${firm.name} is retired.`, 'success')
      setOpen(false)
      onReplaced()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <section data-legal-firm-replace="closed" style={section}>
        <h4 style={h4}>Replace this firm</h4>
        <p style={hint}>For a stand-in, or a change of firm. You add the new firm, and this one is retired: its link stops working, its people stop getting emails, and its history stays.</p>
        <button type="button" onClick={() => setOpen(true)} style={btn}>Replace with a new firm…</button>
      </section>
    )
  }

  return (
    <section data-legal-firm-replace={blocked ? 'blocked' : 'open'} style={section}>
      <h4 style={h4}>Replace {firm.name}</h4>
      {blocked ? (
        <div style={warn}>
          <b>{facts.withFirm.length === 1 ? '1 account is' : `${facts.withFirm.length} accounts are`} with {firm.name}.</b> Pull {facts.withFirm.length === 1 ? 'it' : 'them'} back first, so no account is left with a firm that is gone.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {facts.withFirm.map((m) => (
              <li key={m.id} style={{ margin: '3px 0' }}>
                {m.payerName}
                {onShowAccount ? <> · <button type="button" onClick={() => onShowAccount(m.payerKey)} style={linkBtn}>Show it on the desk</button></> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div style={info}>
            When you press <b>Replace the firm</b>:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {legalFirmReplaceWords(firm.name, facts).map((w) => <li key={w} style={{ margin: '3px 0' }}>{w}</li>)}
            </ul>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 12 }}>
            <label style={label}>New firm<input style={input} value={next.name} onChange={set('name')} placeholder="Example Law Firm, PLLC" /></label>
            <label style={label}>Handling person<input style={input} value={next.handling_name} onChange={set('handling_name')} placeholder="A. Attorney" /></label>
            <label style={label}>Email (the firm’s contact)<input style={input} type="email" value={next.email} onChange={set('email')} placeholder="attorney@firm.example" /></label>
            <label style={label}>Phone<input style={input} value={next.phone} onChange={set('phone')} /></label>
            <label style={label}>Contingency %<input style={input} type="number" min={0} max={100} step={1} value={next.contingency_pct} onChange={set('contingency_pct')} /></label>
            <label style={label}>Filing cost ($)<input style={input} type="number" min={0} step={1} value={next.filing_cost} onChange={set('filing_cost')} /></label>
          </div>
        </>
      )}
      {error ? <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.84rem', margin: '10px 0 0' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void replace()} disabled={blocked || busy} style={{ ...btnPrimary, opacity: blocked || busy ? 0.5 : 1 }}>{busy ? 'Replacing…' : 'Replace the firm'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null) }} disabled={busy} style={btn}>Cancel</button>
        {blocked ? <span style={hint}>Ready once {facts.withFirm.length === 1 ? 'it is' : 'they are'} pulled back.</span> : null}
      </div>
    </section>
  )
}

const section: CSSProperties = { marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }
const h4: CSSProperties = { margin: 0, fontSize: '0.92rem' }
const hint: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 10px' }
const label: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }
const input: CSSProperties = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem' }
const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.86rem', cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const linkBtn: CSSProperties = { border: 'none', background: 'none', padding: 0, color: 'var(--text-blue-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }
const info: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-blue-900)', borderRadius: 8, padding: '10px 12px', fontSize: '0.84rem', marginTop: 8 }
const warn: CSSProperties = { background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '10px 12px', fontSize: '0.84rem', marginTop: 8 }
