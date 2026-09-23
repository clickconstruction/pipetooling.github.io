import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { OWNER_OWES_OPTIONS, OWNER_RESERVED_OPTIONS, affidavitPileFor, AFFIDAVIT_PILE_WORDS, reservationHoldEndsOn, type OwnerCall, type OwnerOwesGc, type OwnerReserved } from '../../lib/jobs/lienOwnerCall'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'

/**
 * The owner called (v2.3767): the three questions counsel's letters ask the
 * owner to answer by phone, typed once on the sent notice — do they still owe
 * the GC anything (and how much), did they reserve the statutory 10 percent
 * and is it still in their hands, when was their contract with the GC
 * completed — plus a note. Reads back as counsel's pile for the affidavit.
 */

const seg = (on: boolean): CSSProperties => ({ padding: '4px 10px', border: '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontWeight: on ? 600 : 500, fontSize: '0.8125rem', cursor: 'pointer' })
const segGroup: CSSProperties = { display: 'inline-flex', borderRadius: 6, overflow: 'hidden', flexWrap: 'wrap' }
const input: CSSProperties = { font: 'inherit', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontSize: '0.8125rem' }
const lab: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }
const btn = (kind: 'primary' | 'plain', disabled = false): CSSProperties => ({ padding: '5px 12px', borderRadius: 7, border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`, background: kind === 'primary' ? 'var(--text-link)' : 'var(--surface)', color: kind === 'primary' ? '#fff' : 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 })

export default function LienOwnerCallDialog({ jobLabel, ownerName, gcName, existing, takerName, onSave, onClose, busy }: { jobLabel: string; ownerName: string; gcName: string; existing: OwnerCall | null; takerName: string; onSave: (call: OwnerCall) => void; onClose: () => void; busy: boolean }) {
  const [owes, setOwes] = useState<OwnerOwesGc>(existing?.owesGc ?? 'unknown')
  const [owesAmount, setOwesAmount] = useState(existing?.owesAmount != null ? String(existing.owesAmount) : '')
  const [reserved, setReserved] = useState<OwnerReserved>(existing?.reserved ?? 'unknown')
  const [done, setDone] = useState(existing?.originalContractCompletedOn ?? '')
  const [open, setOpen] = useState(existing ? !existing.originalContractCompletedOn : true)
  const [note, setNote] = useState(existing?.note ?? '')
  const amount = owesAmount.replace(/[$,\s]/g, '')
  const amountN = amount === '' ? null : Number(amount)
  const amountBad = amountN != null && (!Number.isFinite(amountN) || amountN < 0)
  const preview: OwnerCall = { at: existing?.at ?? new Date().toISOString(), name: takerName, owesGc: owes, owesAmount: owes === 'yes' && amountN != null && !amountBad ? amountN : null, reserved, originalContractCompletedOn: open ? null : /^\d{4}-\d{2}-\d{2}$/.test(done) ? done : null, note: note.trim() }
  const pile = affidavitPileFor(preview)
  const hold = preview.originalContractCompletedOn ? reservationHoldEndsOn(preview.originalContractCompletedOn) : ''
  const canSave = !busy && !amountBad && (owes !== 'unknown' || reserved !== 'unknown' || !open || note.trim() !== '')

  return createPortal(
    <div className="lienMonthDialogScrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`The owner called · ${jobLabel}`} className="lienMonthDialog" style={{ maxWidth: 560, width: 'calc(100vw - 2rem)' }} onClick={(e) => e.stopPropagation()} data-lien-owner-call-dialog>
        <div className="lienMonthDialogHead">
          <strong>The owner called · {jobLabel}</strong>
          <button type="button" onClick={onClose} aria-label="Close" className="lienMonthDialogClose">×</button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ownerName || 'The owner'} · the three questions the letter asks. Typed once here, read by the desk, the affidavit pile and the grid.</p>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={lab}>Do they still owe {gcName || 'the GC'} anything, including retainage?</span>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span role="group" aria-label="Still owes the GC" style={segGroup}>
                {OWNER_OWES_OPTIONS.map((o) => (
                  <button key={o.key} type="button" onClick={() => setOwes(o.key)} style={seg(owes === o.key)} aria-pressed={owes === o.key}>{o.label}</button>
                ))}
              </span>
              {owes === 'yes' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
                  $<input aria-label="How much they still owe the GC" value={owesAmount} onChange={(e) => setOwesAmount(e.target.value)} placeholder="last draw" style={{ ...input, width: '8rem', textAlign: 'right', borderColor: amountBad ? 'var(--text-red-600)' : undefined }} />
                </span>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={lab}>Did they reserve the statutory 10%, and is it still in their hands?</span>
            <span role="group" aria-label="The 10 percent" style={segGroup}>
              {OWNER_RESERVED_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => setReserved(o.key)} style={seg(reserved === o.key)} aria-pressed={reserved === o.key}>{o.label}</button>
              ))}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={lab}>When was their contract with {gcName || 'the GC'} completed?</span>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span role="group" aria-label="Their contract" style={segGroup}>
                <button type="button" onClick={() => setOpen(true)} style={seg(open)} aria-pressed={open}>Not done · still open</button>
                <button type="button" onClick={() => setOpen(false)} style={seg(!open)} aria-pressed={!open}>Completed on</button>
              </span>
              {!open ? <input type="date" aria-label="Their contract completed on" value={done} onChange={(e) => setDone(e.target.value)} style={input} /> : null}
              {hold ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>the 10% hold (§ 53.101) ends {formatYmdMonthDay(hold)}</span> : null}
            </div>
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lab}>Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="“Will hold the last draw until we send a release” — spoke to Pat" aria-label="Note" style={input} />
          </label>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-owner-call-pile={pile ?? 'none'}>
            Reads back as: {pile ? <strong style={{ color: 'var(--text-700)' }}>Pile {pile} · {AFFIDAVIT_PILE_WORDS[pile].short} · {AFFIDAVIT_PILE_WORDS[pile].next}</strong> : <span>no pile yet — the answers do not say which</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
          <button type="button" onClick={onClose} style={btn('plain')}>Cancel</button>
          <button type="button" onClick={() => onSave({ ...preview, at: new Date().toISOString() })} disabled={!canSave} style={btn('primary', !canSave)} data-lien-owner-call-save>Save the call</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
