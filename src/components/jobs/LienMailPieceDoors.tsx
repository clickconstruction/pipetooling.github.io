import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { mailParty, mailPartyProblems } from '../../lib/mail/mailAddress'
import type { LienMailPieceRow } from '../../lib/mail/lienMailPieces'
import { resendDocsmitPiece, resolveDocsmitPiece } from '../../lib/mail/runDocsmitIo'

/**
 * The doors on an envelope that came back (the Docsmit train, 6b-3 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`): under the
 * footer's line for a returned, unclaimed or refused piece, the office answers it one of three ways. A plain copy
 * goes First Class to the same address through Docsmit; another address takes a name and a one-line address, split
 * as the run splits one, and mails the same letter again; handled by hand records a courier or a visit in a few
 * words. Each marks the piece answered, so Do now stops asking. Drawn on the Lien desk's Sent footer only.
 */
export default function LienMailPieceDoors({ piece, jobNumber, onChanged }: { piece: LienMailPieceRow; jobNumber?: string | null; onChanged: () => void }) {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState<'address' | 'hand' | null>(null)
  const [name, setName] = useState((piece.organization ?? '').trim() || (piece.name ?? '').trim())
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const party = mailParty(name, address)
  const problems = address.trim() ? mailPartyProblems(party) : []

  const plain = async () => {
    if (busy) return
    setBusy(true)
    try {
      const a = await resendDocsmitPiece({ pieceId: piece.id, mode: 'plain', jobNumber })
      if (a.ok) showToast(`A plain copy is with Docsmit${a.tracking ? ` · ${a.tracking}` : ''}.`, 'success')
      else showToast(a.error ?? 'Docsmit did not answer.', 'error')
      if (a.ok) onChanged()
    } finally {
      setBusy(false)
    }
  }
  const again = async () => {
    if (busy || !address.trim() || problems.length > 0) return
    setBusy(true)
    try {
      const a = await resendDocsmitPiece({ pieceId: piece.id, mode: 'address', jobNumber, address: { name: party.organization ? '' : `${party.firstName} ${party.lastName}`.trim(), organization: party.organization, address1: party.address1, address2: party.address2, city: party.city, state: party.state, postal_code: party.postalCode } })
      if (a.ok) {
        showToast(`Mailed again to ${party.address1}, ${party.city}${a.tracking ? ` · ${a.tracking}` : ''}.`, 'success')
        setOpen(null)
        setAddress('')
        onChanged()
      } else showToast(a.error ?? 'Docsmit did not answer.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const byHand = async () => {
    if (busy || !note.trim()) return
    setBusy(true)
    try {
      const a = await resolveDocsmitPiece(piece.id, note.trim())
      if (a.ok) {
        showToast('Recorded; the desk stops asking about this envelope.', 'success')
        setOpen(null)
        setNote('')
        onChanged()
      } else showToast(a.error ?? 'Could not record it.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const door = (words: string, onClick: () => void, on = false, disabled = false) => (
    <button type="button" onClick={onClick} disabled={busy || disabled} style={{ border: 'none', background: 'none', color: on ? 'var(--text-blue-700)' : 'var(--text-link)', fontWeight: 700, cursor: busy || disabled ? 'default' : 'pointer', padding: 0, font: 'inherit', opacity: busy || disabled ? 0.6 : 1 }}>
      {words}
    </button>
  )
  const input = { font: 'inherit', padding: '2px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' } as const

  return (
    <span data-lien-mail-doors={piece.id} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', alignItems: 'center', fontSize: '0.78rem' }}>
      {door('send a plain copy ›', () => void plain())}
      {door('mail to another address ›', () => setOpen((o) => (o === 'address' ? null : 'address')), open === 'address')}
      {door('handled by hand ›', () => setOpen((o) => (o === 'hand' ? null : 'hand')), open === 'hand')}
      {open === 'address' ? (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flexBasis: '100%' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name on the envelope" placeholder="Name or company" style={{ ...input, width: '14rem' }} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void again() }} aria-label="The other address, on one line" placeholder="Street, City, TX 78701" style={{ ...input, width: '20rem' }} />
          {problems.length > 0 ? <span style={{ color: 'var(--text-red-600)' }}>needs {problems.join(', ')}</span> : null}
          {door('mail it again ›', () => void again(), false, !address.trim() || problems.length > 0)}
        </span>
      ) : open === 'hand' ? (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flexBasis: '100%' }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void byHand() }} aria-label="How it was handled" placeholder="courier, Oct 14, signed by the front desk" style={{ ...input, width: '22rem' }} />
          {door('record it ›', () => void byHand(), false, !note.trim())}
        </span>
      ) : null}
    </span>
  )
}
