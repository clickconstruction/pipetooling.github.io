import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { countiesByFirmOfCoverage, countyWords, type Coverage } from '../../../lib/legal/firmCounties'
import type { LegalMapCase } from '../../../lib/legal/firmMap'
import { firmWindowCoverage } from '../../../lib/legal/firmWindowCoverage'
import { handOffButton, handOffDoneWords, handOffErrorWords, handOffHold, handOffWords, receiverName, retireWithHandOffHold, type HandOffReceiver } from '../../../lib/legal/firmHandOff'
import { legalFirmInputProblem } from '../../../lib/legal/legalFirmFacts'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'

const db = supabase as unknown as SupabaseClient

type NewFirm = { name: string; handling_name: string; email: string; phone: string; contingency_pct: string; filing_cost: string }

/**
 * **Hand off counties** (punch list #222, PR 4, v2.6233), from the firm's window: replace a firm for a zone, not
 * everywhere. Three steps in one sheet — which of the firm's counties move (each with its role and the cases it
 * holds), to which firm (one that stands, or a new one typed here), and what happens, in plain sentences, before
 * the press. The button names the count and the receiver and is dead with its reason until both are picked. With
 * every county ticked, *Retire <firm> too* retires the giver in the same call, held while an account is still
 * with it. One database call (`legal_hand_off_counties`) does it all, so the map is never half moved, and a live
 * matter never moves.
 */
export default function LegalFirmHandOffSheet({ firm, firms, coverage, cases, liveMatters, zIndex, onDone, onCancel }: {
  firm: LegalFirmRow
  /** The firms that stand. */
  firms: ReadonlyArray<LegalFirmRow>
  coverage: Coverage
  cases: ReadonlyArray<LegalMapCase>
  /** The accounts with this firm: they stay with it, and they hold a retire. */
  liveMatters: ReadonlyArray<{ payerName: string }>
  zIndex: number
  /** After a hand-off: the desk reloads its firms and counties. */
  onDone: () => void
  onCancel: () => void
}) {
  const { showToast } = useToastContext()
  const rows = useMemo(() => firmWindowCoverage(firm.id, coverage, cases).rows, [firm.id, coverage, cases])
  const others = useMemo(() => firms.filter((f) => f.active && f.id !== firm.id), [firms, firm.id])
  const byFirm = useMemo(() => countiesByFirmOfCoverage(coverage), [coverage])
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [choice, setChoice] = useState<string | null>(null) // a firm id, or 'new'
  const [next, setNext] = useState<NewFirm>({ name: '', handling_name: '', email: '', phone: '', contingency_pct: String(firm.contingency_pct), filing_cost: String(firm.filing_cost) })
  const [retire, setRetire] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      if (!busy) onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  const receiver: HandOffReceiver | null = choice === 'new' ? { kind: 'new', name: next.name } : choice ? { kind: 'firm', id: choice, name: firmNames.get(choice) ?? 'the firm' } : null
  const pickedList = rows.map((r) => r.county).filter((c) => picked.has(c))
  const allPicked = rows.length > 0 && pickedList.length === rows.length
  const retireHoldWords = retireWithHandOffHold(firm.name, allPicked, liveMatters)
  const retiring = retire && !retireHoldWords
  const words = handOffWords({ firmId: firm.id, firmName: firm.name, coverage, picked: pickedList, receiver, liveMatters, cases, retire: retiring })
  const hold = handOffHold({ picked: pickedList, receiver })
  const label = busy ? 'Handing off…' : handOffButton({ picked: pickedList, receiver })
  const dead = Boolean(hold) || busy

  const toggle = (county: string) => setPicked((cur) => {
    const n = new Set(cur)
    if (n.has(county)) n.delete(county)
    else n.add(county)
    return n
  })
  const set = (k: keyof NewFirm) => (e: { target: { value: string } }) => setNext((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (dead || !receiver) return
    if (receiver.kind === 'new') {
      const problem = legalFirmInputProblem(next)
      if (problem) {
        setError(problem)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await db.rpc('legal_hand_off_counties', {
        p_from_firm: firm.id,
        p_counties: pickedList,
        p_to_firm: receiver.kind === 'firm' ? receiver.id : null,
        p_new_firm: receiver.kind === 'new' ? { name: next.name.trim(), handling_name: next.handling_name.trim(), email: next.email.trim(), phone: next.phone.trim(), contingency_pct: Number(next.contingency_pct), filing_cost: Number(next.filing_cost) } : null,
        p_retire: retiring,
      })
      if (rpcError) {
        setError(handOffErrorWords(rpcError))
        return
      }
      const answer = (data ?? {}) as { ok?: boolean; error?: string; retired?: boolean }
      if (answer.error) {
        setError(answer.error)
        return
      }
      showToast(handOffDoneWords(pickedList, receiverName(receiver), firm.name, Boolean(answer.retired)), 'success')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="presentation" onClick={(e) => { e.stopPropagation(); if (!busy) onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label={`Hand off ${firm.name}’s counties`} data-legal-firm-hand-off onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 620, maxHeight: '100%', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.3)', padding: '16px 18px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Hand off {firm.name}’s counties</h3>
        <p style={{ ...muted, margin: '0 0 12px' }}>New releases in the counties you pick go to the firm you pick. Matters already with {firm.name} stay with {firm.name}.</p>

        <div style={step}>1 · Which counties</div>
        <div role="group" aria-label="Which counties" style={{ display: 'grid', gap: 4 }}>
          {rows.map((r) => (
            <label key={r.county} data-legal-hand-off-county={r.county} style={line}>
              <input type="checkbox" checked={picked.has(r.county)} onChange={() => toggle(r.county)} />
              <span><b>{countyWords(r.county)}</b> <span style={muted}>· {r.cases ? `${r.cases} ${r.cases === 1 ? 'case' : 'cases'} · ${formatLegalMoney(r.balance)}` : 'no cases'} · {r.role === 'first' ? 'first call' : `also covers, ${firmNames.get(r.firstCall) ?? 'another firm'} first call`}</span></span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, margin: '6px 0 12px' }}>
          <button type="button" onClick={() => setPicked(new Set(rows.map((r) => r.county)))} style={linkBtn}>All {rows.length}</button>
          <button type="button" onClick={() => setPicked(new Set())} style={linkBtn}>None</button>
        </div>

        <div style={step}>2 · To</div>
        <div role="radiogroup" aria-label="To" style={{ display: 'grid', gap: 4 }}>
          {others.map((f) => (
            <label key={f.id} data-legal-hand-off-to={f.id} style={line}>
              <input type="radio" name="legal-hand-off-to" checked={choice === f.id} onChange={() => setChoice(f.id)} />
              <span><b>{f.name}</b> <span style={muted}>· {(byFirm.get(f.id) ?? []).length} {(byFirm.get(f.id) ?? []).length === 1 ? 'county' : 'counties'} · {f.contingency_pct}% · ${f.filing_cost} filing</span></span>
            </label>
          ))}
          <label data-legal-hand-off-to="new" style={line}>
            <input type="radio" name="legal-hand-off-to" checked={choice === 'new'} onChange={() => setChoice('new')} />
            <span><b>A new firm…</b> <span style={muted}>· added with the hand-off, with no link and no people yet</span></span>
          </label>
        </div>
        {choice === 'new' ? (
          <div data-legal-hand-off-new style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 8 }}>
            <label style={field}>Firm<input style={input} value={next.name} onChange={set('name')} placeholder="Example Law Firm, PLLC" /></label>
            <label style={field}>Handling person<input style={input} value={next.handling_name} onChange={set('handling_name')} placeholder="A. Attorney" /></label>
            <label style={field}>Email<input style={input} type="email" value={next.email} onChange={set('email')} placeholder="attorney@firm.example" /></label>
            <label style={field}>Phone<input style={input} value={next.phone} onChange={set('phone')} /></label>
            <label style={field}>Contingency %<input style={input} type="number" min={0} max={100} step={1} value={next.contingency_pct} onChange={set('contingency_pct')} /></label>
            <label style={field}>Filing cost ($)<input style={input} type="number" min={0} step={1} value={next.filing_cost} onChange={set('filing_cost')} /></label>
          </div>
        ) : null}

        <div style={{ ...step, marginTop: 12 }}>3 · What happens when you press it</div>
        {words.length ? (
          <ul data-legal-hand-off-words style={info}>
            {words.map((w) => <li key={w} style={{ margin: '2px 0' }}>{w}</li>)}
          </ul>
        ) : (
          <p style={{ ...muted, margin: '2px 0 0' }}>Tick a county to see what happens.</p>
        )}
        <label data-legal-hand-off-retire style={{ ...line, marginTop: 8, opacity: retireHoldWords ? 0.6 : 1 }} title={retireHoldWords ?? undefined}>
          <input type="checkbox" checked={retiring} disabled={Boolean(retireHoldWords)} onChange={(e) => setRetire(e.target.checked)} />
          <span><b>Retire {firm.name} too</b> <span style={muted}>· {retireHoldWords ?? 'its link stops working and its history stays'}</span></span>
        </label>

        {error ? <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.84rem', margin: '10px 0 0' }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" onClick={() => void submit()} disabled={dead} title={hold ?? undefined} data-legal-hand-off-submit style={dead ? { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: DEAD_PRESS_FILL, cursor: 'default' } : btnPrimary}>{label}</button>
          <button type="button" onClick={onCancel} disabled={busy} style={btn}>Cancel</button>
          {hold ? <span style={muted}>{hold}</span> : null}
        </div>
      </div>
    </div>
  )
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const step: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px' }
const line: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '0.86rem', cursor: 'pointer' }
const info: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-blue-900)', borderRadius: 8, padding: '8px 12px 8px 28px', fontSize: '0.84rem', margin: 0 }
const field: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.78rem', color: 'var(--text-muted)' }
const input: CSSProperties = { width: '100%', padding: '0.35rem 0.5rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.88rem' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.9rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.86rem', cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const linkBtn: CSSProperties = { padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }
