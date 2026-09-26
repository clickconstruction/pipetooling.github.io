import { useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AFFIDAVIT_PILE_WORDS, ownerCallWords, type OwnerCall } from '../../lib/jobs/lienOwnerCall'
import { CALL_OPENINGS, EMPTY_CALL_STATE, NEVER_SAY, callBack, callCard, callHasFacts, callJump, callPile, callReply, callSentence, callToOwnerCall, holdingWords, type CallLetterFacts, type CallReply, type CallState } from '../../lib/jobs/lienOwnerCallScript'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * The owner called — as a conversation (v2.3852, to-do #47; the form of
 * v2.3767 underneath). The letter they are holding sits at the top; each card
 * is one line to say in big type and the owner's replies in their own words;
 * a tap opens the next card; the chips jump to an opening from anywhere and
 * Back undoes a tap. The facts are collected on the way and read back as a
 * sentence; Save writes the same record the old dialog wrote, plus the new
 * facts. The words are `lienOwnerCallScript` — counsel's, for the phone.
 */

const lab: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }
const input: CSSProperties = { font: 'inherit', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontSize: '0.8125rem' }
const btn = (kind: 'primary' | 'plain', disabled = false): CSSProperties => ({ padding: '5px 12px', borderRadius: 7, border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`, background: kind === 'primary' ? 'var(--text-link)' : 'var(--surface)', color: kind === 'primary' ? '#fff' : 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 })
const chip = (on: boolean): CSSProperties => ({ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'transparent' : 'var(--border-strong)'}`, background: on ? 'var(--text-base)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: on ? 700 : 500, cursor: 'pointer' })
const reply = (on: boolean): CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', border: `1px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`, borderRadius: 10, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.95rem', cursor: 'pointer', boxShadow: on ? 'inset 0 0 0 1px var(--text-link)' : undefined })

const fmt = { day: formatYmdMonthDay, money: formatUsdNoCents }

export default function LienOwnerCallDialog({ facts, existing, takerName, onSave, onClose, busy }: { facts: CallLetterFacts; existing: OwnerCall | null; takerName: string; onSave: (call: OwnerCall) => void; onClose: () => void; busy: boolean }) {
  const [state, setState] = useState<CallState>(EMPTY_CALL_STATE)
  /** The reply whose inputs are open (amount / the dates) before it is taken. */
  const [pending, setPending] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [releasedOn, setReleasedOn] = useState('')
  const [completedOn, setCompletedOn] = useState('')
  const [contractOpen, setContractOpen] = useState(false)
  const card = useMemo(() => callCard(facts, state, fmt), [facts, state])
  const sentence = callSentence(facts, state, fmt)
  const pile = callPile(state)
  const amountN = amount.replace(/[$,\s]/g, '') === '' ? null : Number(amount.replace(/[$,\s]/g, ''))
  const amountBad = amountN != null && (!Number.isFinite(amountN) || amountN < 0)
  const ymd = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

  const take = (r: CallReply) => {
    if (r.needs && pending !== r.key) {
      setPending(r.key)
      return
    }
    setPending(null)
    setState((s) =>
      callReply(s, r.key, {
        amount: amountBad ? null : amountN,
        releasedOn: ymd(releasedOn),
        completedOn: contractOpen ? null : ymd(completedOn),
        contractOpen: contractOpen ? true : ymd(completedOn) ? false : null,
      }),
    )
  }
  const jump = (key: (typeof CALL_OPENINGS)[number]['key']) => {
    setPending(null)
    setState((s) => callJump(s, key))
  }
  const back = () => {
    setPending(null)
    setState((s) => callBack(s))
  }
  const canSave = !busy && callHasFacts(state) && !amountBad
  const save = () => onSave(callToOwnerCall(state, takerName, new Date().toISOString()))

  return createPortal(
    <div className="lienMonthDialogScrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`The owner called · ${facts.jobLabel}`} className="lienMonthDialog" style={{ maxWidth: 640, width: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()} data-lien-owner-call-dialog data-lien-owner-call-step={state.step}>
        <div className="lienMonthDialogHead" style={{ margin: 0, padding: '0.7rem 1rem 0.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <strong style={{ fontSize: '0.9rem' }}>The owner called · {facts.jobLabel}</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>{card.title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="lienMonthDialogClose">×</button>
        </div>

        <p style={{ margin: 0, padding: '0.55rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }} data-lien-owner-call-holding>
          <strong style={{ color: 'var(--text-700)' }}>{facts.ownerName || 'The owner'}</strong> is holding {holdingWords(facts, fmt)} — <strong style={{ color: 'var(--text-700)' }}>{facts.amount}</strong>
          {facts.months ? ` for ${facts.months}` : ''} under <strong style={{ color: 'var(--text-700)' }}>{facts.gcName}</strong>
          {facts.signer ? `, signed ${facts.signer.split(',')[0]}` : ''}.
          {existing ? <span style={{ display: 'block', marginTop: 2 }}>Last call: {ownerCallWords(existing, formatYmdMonthDay, formatUsdNoCents)}{existing.note ? ` — “${existing.note}”` : ''}. A new call overwrites it.</span> : null}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0.6rem 1rem 0' }} role="group" aria-label="They opened with">
          <span style={{ ...chip(state.step === 'open'), cursor: 'default' }}>They opened with…</span>
          {CALL_OPENINGS.map((o) => (
            <button key={o.key} type="button" onClick={() => jump(o.key)} style={chip(state.step === o.key)} aria-pressed={state.step === o.key} data-lien-owner-call-chip={o.key}>{o.chip}</button>
          ))}
        </div>

        <div style={{ margin: '0.7rem 1rem 0', padding: '0.75rem 0.9rem', borderLeft: '4px solid var(--text-green-800)', background: 'var(--bg-green-tint)', borderRadius: '0 8px 8px 0' }} data-lien-owner-call-say>
          <span style={{ ...lab, color: 'var(--text-green-800)', display: 'block', marginBottom: 4 }}>Say</span>
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--text-base)' }}>{card.say}</span>
          {card.cites ? <span title={card.cites} aria-label={card.cites} style={{ display: 'inline-block', marginLeft: 6, width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border-strong)', fontSize: '0.68rem', lineHeight: '14px', textAlign: 'center', color: 'var(--text-muted)', verticalAlign: 'middle' }}>i</span> : null}
        </div>

        <div style={{ padding: '0.75rem 1rem 0' }}>
          <div style={{ ...lab, marginBottom: 8 }}>{card.askLabel}</div>
          {card.final ? (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Note</span>
              <input value={state.note} onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))} placeholder="“Very calm — thought paying the builder ended it.”" aria-label="Note" style={input} />
            </label>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {card.replies.map((r) => {
                const open = pending === r.key
                return (
                  <div key={r.key} style={{ display: 'grid', gap: 6 }}>
                    <button type="button" onClick={() => take(r)} style={reply(open)} data-lien-owner-call-reply={r.key} aria-expanded={r.needs ? open : undefined}>
                      <span>{r.words}</span>
                      <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>›</span>
                    </button>
                    {open ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.8rem', alignItems: 'center', padding: '2px 4px 4px 14px', fontSize: '0.8125rem' }} data-lien-owner-call-inputs>
                        {r.needs === 'amount' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>about $<input aria-label="About how much is left" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="last draw" style={{ ...input, width: '7rem', textAlign: 'right', borderColor: amountBad ? 'var(--text-red-600)' : undefined }} /></span>
                        ) : null}
                        {r.needs === 'released' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>around <input type="date" aria-label="The day the 10% went to the GC" value={releasedOn} onChange={(e) => setReleasedOn(e.target.value)} style={input} /></span>
                        ) : null}
                        {r.needs === 'released' || r.needs === 'completed' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>and {facts.gcName} wrapped up</span>
                            <input type="date" aria-label="The day their contract with the GC finished" value={completedOn} disabled={contractOpen} onChange={(e) => setCompletedOn(e.target.value)} style={input} />
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={contractOpen} onChange={(e) => setContractOpen(e.target.checked)} /> still going</label>
                          </span>
                        ) : null}
                        <button type="button" onClick={() => take(r)} style={btn('primary', amountBad)} disabled={amountBad} data-lien-owner-call-next>Next ›</button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ margin: '0.75rem 1rem 0', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 8, fontSize: '0.8125rem' }} data-lien-owner-call-sentence>
          <div style={{ ...lab, marginBottom: 3 }}>{card.final ? 'The call, in one sentence' : 'So far'}</div>
          {sentence ? <span>{sentence}</span> : <span style={{ color: 'var(--text-muted)' }}>Nothing recorded yet.</span>}
          {pile ? <span data-lien-owner-call-pile={pile} title={AFFIDAVIT_PILE_WORDS[pile].next} style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 999, background: pile === 'A' ? 'var(--bg-green-tint)' : pile === 'B' ? 'var(--bg-yellow-tint)' : 'var(--bg-red-tint)', color: pile === 'A' ? 'var(--text-green-800)' : pile === 'B' ? 'var(--text-yellow-800)' : 'var(--text-red-700)', fontWeight: 700, fontSize: '0.7rem' }}>Pile {pile}</span> : null}
        </div>
        {card.final ? (
          <div style={{ margin: '0.6rem 1rem 0', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--text-red-600)', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontSize: '0.75rem' }}>
            <strong style={{ fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 6 }}>Never</strong>
            {NEVER_SAY.join(' · ')}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.7rem 1rem 0.9rem' }}>
          <button type="button" onClick={back} disabled={state.history.length === 0} style={{ ...btn('plain', state.history.length === 0), border: 'none', background: 'none', padding: 0 }}>‹ Back</button>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={btn('plain')}>Cancel</button>
            <button type="button" onClick={save} disabled={!canSave} style={btn('primary', !canSave)} data-lien-owner-call-save>Save the call</button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
