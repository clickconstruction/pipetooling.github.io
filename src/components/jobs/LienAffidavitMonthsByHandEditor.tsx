import { useState } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { lienAffidavitMonthChoiceWords, lienAffidavitMonthChoices, lienAffidavitMonthKeyFromText, lienAffidavitMonthsByHandProblem, lienAffidavitMonthsByHandSaveWords, lienAffidavitMonthsByHandWords, lienAffidavitMonthsCleaned, type LienAffidavitMonthsByHand } from '../../lib/jobs/lienAffidavitMonthsByHand'
import { workMonthLabel } from '../../lib/jobs/forecastWorkMonths'

/**
 * The months an affidavit swears, set by hand (v2.7270, punch list #356 part 2): the line that says what is set, with
 * **Change…** and **Clear**, or **Set the months by hand…** that opens the editor in place. The editor offers the job's
 * work months and the notice's months to tick, a box to add another month, and counsel's reason, which it requires.
 * The office presses; nothing is written until the save press, and the caller writes it.
 */
export default function LienAffidavitMonthsByHandEditor({
  current,
  work,
  named,
  canEdit,
  busy,
  onSave,
  onClear,
}: {
  current: LienAffidavitMonthsByHand | null
  /** The job's own work months ('YYYY-MM'). */
  work: ReadonlyArray<string>
  /** The months the recorded notices name. */
  named: ReadonlyArray<string>
  canEdit: boolean
  busy: boolean
  onSave: (input: { months: string[]; reason: string }) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(current?.months ?? []))
  const [added, setAdded] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState(current?.reason ?? '')
  const choices = lienAffidavitMonthChoices({ work, named, current: [...(current?.months ?? []), ...added] })
  const months = lienAffidavitMonthsCleaned([...picked])
  const problem = lienAffidavitMonthsByHandProblem(months, reason)
  const typedKey = lienAffidavitMonthKeyFromText(typed)
  const start = () => {
    setPicked(new Set(current?.months ?? []))
    setAdded([])
    setTyped('')
    setReason(current?.reason ?? '')
    setOpen(true)
  }
  const addTyped = () => {
    if (!typedKey) return
    setAdded((a) => (a.includes(typedKey) ? a : [...a, typedKey]))
    setPicked((p) => new Set([...p, typedKey]))
    setTyped('')
  }
  const press: React.CSSProperties = { padding: '3px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }
  const field: React.CSSProperties = { padding: '0.3rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit' }
  const doorLink: React.CSSProperties = { padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }

  if (!open) {
    return (
      <div data-lien-affidavit-months-by-hand={current ? 'set' : 'none'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', fontSize: '0.78rem' }}>
        {current ? <span style={{ color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.25rem 0.5rem' }}>{lienAffidavitMonthsByHandWords(current, formatYmdMonthDay)}</span> : null}
        {canEdit ? (
          <>
            {/* Blue link text, not a boxed press (v2.7319): the owner's ask, so the door reads like Correct the claim › beside it. */}
            <button type="button" onClick={start} disabled={busy} style={doorLink} data-lien-affidavit-months-by-hand-open>
              {current ? 'Change ›' : 'Set the months by hand ›'}
            </button>
            {current ? (
              <button type="button" onClick={onClear} disabled={busy} style={{ ...doorLink, color: 'var(--text-muted)' }} data-lien-affidavit-months-by-hand-clear>
                Clear ›
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }
  return (
    <div data-lien-affidavit-months-by-hand-editor style={{ display: 'grid', gap: '0.45rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border-amber)', borderRadius: 8, background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
      <div style={{ fontWeight: 600 }}>The months the paper swears, set by hand</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Tick each month the paper names. The attorney line still reads each month against the notice record. The words a sworn paper uses are counsel’s.</div>
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        {choices.map((c) => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input type="checkbox" checked={picked.has(c.key)} onChange={(e) => setPicked((p) => { const next = new Set(p); if (e.target.checked) next.add(c.key); else next.delete(c.key); return next })} data-lien-affidavit-month-pick={c.key} />
            <span style={{ fontWeight: 600 }}>{c.label}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lienAffidavitMonthChoiceWords(c.from)}</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
        <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped() } }} placeholder="Another month, like Sep 2026" aria-label="Another month" style={{ ...field, width: 180 }} data-lien-affidavit-month-typed />
        <button type="button" onClick={addTyped} disabled={!typedKey} style={{ ...press, opacity: typedKey ? 1 : 0.55 }}>{typedKey ? `Add ${workMonthLabel(typedKey)}` : 'Add the month'}</button>
      </div>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Counsel’s reason: who said the paper may name these months, and when</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...field, resize: 'vertical' }} data-lien-affidavit-months-reason />
      </label>
      {problem ? <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }} data-lien-affidavit-months-problem>{problem}</div> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen(false)} disabled={busy} style={press}>Cancel</button>
        <button type="button" onClick={() => { if (!problem) { onSave({ months, reason: reason.trim() }); setOpen(false) } }} disabled={busy || Boolean(problem)} style={{ ...press, border: 'none', background: '#92400e', color: '#fff', opacity: busy || problem ? 0.55 : 1 }} data-lien-affidavit-months-save>
          {lienAffidavitMonthsByHandSaveWords(months)}
        </button>
      </div>
    </div>
  )
}
