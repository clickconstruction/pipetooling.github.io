import { useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { workMonthLabel } from '../../lib/jobs/forecastWorkMonths'
import { claimDeltaWords, claimSplit, claimSplitWords, correctedClaim, correctionSetWords, type LienClaimCorrection } from '../../lib/jobs/lienClaimCorrection'

/**
 * The claim box on the Lien desk's Months card (v2.3682): the figure the notice claims,
 * and — for the office — the editor for correcting it by hand. Click the figure and it
 * becomes a box: one number, one required reason, one tick to carry it to later notices
 * and the affidavit. "Say it per month" is the second path, for a month that genuinely
 * has its own figure. Under the balance is the office's call; over it the figure turns
 * red and the leader decides. The app's balance is never touched.
 */
type Props = {
  balance: number
  correction: LienClaimCorrection | null
  /** The months the notice names — the per-month path's rows. */
  months: string[]
  office: boolean
  busy: boolean
  onSave: (input: { amountOff: number; perMonth: Record<string, number> | null; reason: string; carry: boolean }) => void
  onClear: () => void
}

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
const parseMoney = (s: string): number | null => {
  const t = s.replace(/[$,\s]/g, '')
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const link: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }
const quiet: CSSProperties = { ...link, color: 'var(--text-muted)' }
const input: CSSProperties = { font: 'inherit', padding: '3px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }
const chipStyle = (over: boolean): CSSProperties => ({ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, borderRadius: 6, padding: '0 6px', verticalAlign: 'middle', background: over ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)', color: over ? 'var(--text-red-700)' : 'var(--text-amber-800)' })

export default function LienClaimBox({ balance, correction, months, office, busy, onSave, onClear }: Props) {
  const current = correctedClaim(balance, correction)
  const [editing, setEditing] = useState(false)
  const [figure, setFigure] = useState('')
  const [reason, setReason] = useState('')
  const [carry, setCarry] = useState(true)
  const [perOpen, setPerOpen] = useState(false)
  const [per, setPer] = useState<Record<string, string>>({})

  const open = () => {
    setFigure(money(current.claim))
    setReason(correction?.reason ?? '')
    setCarry(correction?.carry ?? true)
    const pm = correction?.perMonth ?? null
    setPer(Object.fromEntries(months.map((m) => [m, pm && typeof pm[m] === 'number' ? money(pm[m]!) : ''])))
    setPerOpen(Boolean(pm && Object.keys(pm).length))
    setEditing(true)
  }

  if (!editing) {
    return (
      <div className="lienMonthsClaim" data-lien-claim-box data-corrected={current.corrected ? 'yes' : 'no'} data-over={current.over ? 'yes' : 'no'}>
        <span>Claim amount on the notice</span>
        <strong>
          {formatUsdNoCents(current.claim)} {current.corrected ? <span style={chipStyle(current.over)}>set by hand</span> : null}
        </strong>
        {current.corrected && correction ? (
          <>
            <span>
              {claimDeltaWords(current.delta, balance) || 'the same as the app’s balance'} · {correction.carry ? 'carries until cleared' : 'this notice only'}
            </span>
            <span>{correctionSetWords(correction, formatYmdMonthDay)}</span>
            {office ? (
              <span style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="button" style={link} onClick={open} disabled={busy}>Change ›</button>
                <button type="button" style={quiet} onClick={onClear} disabled={busy} data-lien-claim-clear>Back to the job’s figure</button>
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span>Still unpaid on this job</span>
            {office ? (
              <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={open} disabled={busy} data-lien-claim-correct>
                Correct the claim ›
              </button>
            ) : null}
          </>
        )}
      </div>
    )
  }

  const typed = parseMoney(figure)
  const claim = typed == null ? current.claim : Math.max(0, typed)
  const delta = claim - Math.max(0, balance)
  const over = delta > 0.005
  const perMonth: Record<string, number> | null = perOpen
    ? Object.fromEntries(months.map((m) => [m, parseMoney(per[m] ?? '')] as const).filter((e): e is readonly [string, number] => e[1] != null))
    : null
  const split = claimSplit(months, claim, perMonth && Object.keys(perMonth).length ? perMonth : null)
  const canApply = typed != null && reason.trim() !== '' && !busy
  const edge = over ? 'var(--border-red)' : 'var(--border-amber)'
  return (
    <div data-lien-claim-editor style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.7rem', border: `1px solid ${edge}`, borderRadius: 8, background: over ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)', fontSize: '0.78rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>Claim amount on the notice</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>$</span>
        <input aria-label="Claim amount on the notice" value={figure} onChange={(e) => setFigure(e.target.value)} style={{ ...input, width: '8.5rem', fontSize: '1.05rem', fontWeight: 700, textAlign: 'right', borderColor: over ? 'var(--text-red-600)' : 'var(--text-amber-800)', borderWidth: 2 }} />
      </label>
      <span style={{ color: over ? 'var(--text-red-700)' : 'var(--text-amber-800)', lineHeight: 1.4 }} data-lien-claim-delta>
        {over ? (
          <>
            <strong>{claimDeltaWords(delta, balance)}.</strong> A notice that claims more than is owed is the fact pattern behind fraudulent-lien claims. If the invoice is short, fix it so the books agree — the notice re-reads the balance. If you are sure, the leader approves this notice knowingly; it will not go on a standing rule or on the leader’s word.
          </>
        ) : delta < -0.005 ? (
          <>
            <strong>{claimDeltaWords(delta, balance)}.</strong> The rest stays on the books for Collections; it does not ride on the lien.
          </>
        ) : (
          'The same as the app’s balance.'
        )}
      </span>
      <label style={{ display: 'grid', gap: '0.15rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>
          Why <span style={{ color: 'var(--text-red-600)' }}>· required</span>
        </span>
        <input aria-label="Why the claim is corrected" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="GC disputes the 8/14 change order ($1,500); claim the agreed portion" style={input} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} style={{ margin: 0 }} /> Carry this to later notices and the affidavit until I clear it
      </label>
      {perOpen ? (
        <div style={{ display: 'grid', gap: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Only when a month genuinely has its own figure. Blank means “part of the total”.</span>
          {months.map((m) => (
            <label key={m} style={{ display: 'grid', gridTemplateColumns: '6rem minmax(0, 1fr)', alignItems: 'center', gap: '0.5rem' }}>
              <strong>{workMonthLabel(m)}</strong>
              <input aria-label={`Claim for ${workMonthLabel(m)}`} value={per[m] ?? ''} onChange={(e) => setPer((p) => ({ ...p, [m]: e.target.value }))} placeholder="part of the total" style={{ ...input, textAlign: 'right' }} />
            </label>
          ))}
          <span style={{ color: 'var(--text-amber-800)' }}>{split ? `The paper prints: ${claimSplitWords(split)}` : months.length > 1 ? 'Give every month a figure but one — the paper prints the split only when it needs no formula.' : ''}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {months.length ? (
          <button type="button" style={link} onClick={() => setPerOpen((o) => !o)}>
            {perOpen ? 'One figure ›' : 'Say it per month ›'}
          </button>
        ) : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setEditing(false)} disabled={busy} style={{ ...input, cursor: 'pointer', fontWeight: 600, color: 'var(--text-700)' }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => {
            if (typed == null) return
            onSave({ amountOff: Math.max(0, balance) - Math.max(0, typed), perMonth: perMonth && Object.keys(perMonth).length ? perMonth : null, reason: reason.trim(), carry })
            setEditing(false)
          }}
          data-lien-claim-apply
          style={{ ...input, cursor: canApply ? 'pointer' : 'default', fontWeight: 700, color: '#fff', background: over ? '#b91c1c' : '#2563eb', border: '1px solid transparent', opacity: canApply ? 1 : 0.55 }}
        >
          {over ? 'Apply — the leader decides' : 'Apply'}
        </button>
      </div>
    </div>
  )
}
