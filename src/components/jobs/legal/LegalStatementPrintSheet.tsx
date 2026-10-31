import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { saveBlobAs } from '../../../lib/storageSave'
import { DECLARANT_BLANK, STATEMENT_FACES, declarantProblem, type DeclarantDetails, type StatementDraft, type StatementFace } from '../../../lib/legal/affidavitPaper'
import { printNeedsDeclarant, statementPdfBlob, statementPdfFilename, statementPrintHtml } from '../../../lib/legal/statementPrint'
import { btn, btnPrimary, MUTED } from './legalDeskShared'

/**
 * The print sheet (punch list #220, v2.6211): the paper as it prints, drawn in a light frame inside the window, with
 * the three faces as a pick — the whole paper, the statement alone, the signing page alone — **Print** (the frame's
 * own print: the phone's print sheet or the desktop's dialog, no popup) and **Save as PDF**. A declaration's whole
 * paper and signing page carry the declarant's name, date of birth and address, typed here when the office presses
 * Print, held for the session so a reprint after an edit does not ask again, and never saved.
 */
export type PrintSheetProps = {
  draft: StatementDraft
  face: StatementFace
  onFace: (face: StatementFace) => void
  accountWords: string
  declarant: DeclarantDetails | null
  onDeclarant: (d: DeclarantDetails) => void
  /** Note the print on the row (`legal_statement_print`); the sheet prints whether or not the note lands. */
  onPrinted: (face: StatementFace) => Promise<void>
  onBack: () => void
  busy: boolean
}

const field: CSSProperties = { font: 'inherit', fontSize: '0.84rem', padding: '5px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 0, width: '100%' }
const lab: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }

export default function LegalStatementPrintSheet({ draft, face, onFace, accountWords, declarant, onDeclarant, onPrinted, onBack, busy }: PrintSheetProps) {
  const frame = useRef<HTMLIFrameElement | null>(null)
  const [details, setDetails] = useState<DeclarantDetails>(declarant ?? { ...DECLARANT_BLANK, firstName: draft.affiant.name.trim().split(/\s+/)[0] ?? '', lastName: draft.affiant.name.trim().split(/\s+/).slice(-1)[0] ?? '' })
  const [asking, setAsking] = useState(() => printNeedsDeclarant(draft.form, face, declarant))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setAsking(printNeedsDeclarant(draft.form, face, declarant)) }, [draft.form, face, declarant])
  const html = useMemo(() => statementPrintHtml({ draft, face, declarant, accountWords }), [draft, face, declarant, accountWords])
  const detailsProblem = declarantProblem(details)

  const print = async () => {
    setError(null)
    const win = frame.current?.contentWindow
    if (!win) {
      setError('The paper has not drawn yet. Try again in a moment.')
      return
    }
    try {
      win.focus()
      win.print()
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not open the print sheet.'))
      return
    }
    await onPrinted(face)
  }
  const savePdf = async () => {
    setError(null)
    setSaving(true)
    try {
      saveBlobAs(await statementPdfBlob({ draft, face, declarant, accountWords }), statementPdfFilename(draft, face))
      await onPrinted(face)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not make the PDF.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-legal-statement-print style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div role="group" aria-label="Which face to print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATEMENT_FACES.map((f) => <button key={f.face} type="button" aria-pressed={face === f.face} data-legal-print-face={f.face} onClick={() => onFace(f.face)} style={{ ...btn, height: 28, ...(face === f.face ? { background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' } : null) }}>{f.label}</button>)}
        <span style={{ ...MUTED, fontSize: '0.76rem' }}>{face === 'whole' ? (draft.form === 'notary' ? 'The statement, the signature line and the jurat for the notary.' : 'The statement and the declaration block, signed with no notary.') : face === 'statement' ? 'No signing block. To read over together before anyone signs.' : draft.form === 'notary' ? 'The jurat with a line naming the handwritten statement it is stapled to.' : 'The declaration block, stapled on what they wrote.'}</span>
      </div>
      {asking ? (
        <form data-legal-declarant-form onSubmit={(e) => { e.preventDefault(); if (!detailsProblem) { onDeclarant(details); setAsking(false) } }} style={{ display: 'grid', gap: 8, padding: '10px 12px', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
          <b style={{ fontSize: '0.84rem' }}>The declaration names the declarant</b>
          <span style={{ ...MUTED, fontSize: '0.78rem' }}>Texas asks for their full name, date of birth and address on the paper. Typed here, kept for this session only, never saved to the record. The signed scan carries them, as it must.</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <label style={lab}>First<input aria-label="First name" value={details.firstName} onChange={(e) => setDetails({ ...details, firstName: e.target.value })} style={field} /></label>
            <label style={lab}>Middle<input aria-label="Middle name" value={details.middleName} onChange={(e) => setDetails({ ...details, middleName: e.target.value })} style={field} /></label>
            <label style={lab}>Last<input aria-label="Last name" value={details.lastName} onChange={(e) => setDetails({ ...details, lastName: e.target.value })} style={field} /></label>
            <label style={lab}>Date of birth<input type="date" aria-label="Date of birth" value={details.dateOfBirth} onChange={(e) => setDetails({ ...details, dateOfBirth: e.target.value })} style={field} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <label style={{ ...lab, gridColumn: 'span 2' }}>Street<input aria-label="Street" value={details.street} onChange={(e) => setDetails({ ...details, street: e.target.value })} style={field} /></label>
            <label style={lab}>City<input aria-label="City" value={details.city} onChange={(e) => setDetails({ ...details, city: e.target.value })} style={field} /></label>
            <label style={lab}>State<input aria-label="State" value={details.state} onChange={(e) => setDetails({ ...details, state: e.target.value })} style={field} /></label>
            <label style={lab}>Zip code<input aria-label="Zip code" value={details.zip} onChange={(e) => setDetails({ ...details, zip: e.target.value })} style={field} /></label>
            <label style={lab}>Country<input aria-label="Country" value={details.country} onChange={(e) => setDetails({ ...details, country: e.target.value })} style={field} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={Boolean(detailsProblem)} title={detailsProblem ?? undefined} style={{ ...btnPrimary, opacity: detailsProblem ? 0.6 : 1 }}>Put them on the paper</button>
            <button type="button" onClick={() => onFace('statement')} style={btn}>Print the statement alone instead</button>
            {detailsProblem ? <span style={{ ...MUTED, fontSize: '0.76rem' }}>{detailsProblem}</span> : null}
          </div>
        </form>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" data-legal-print-press disabled={busy} onClick={() => void print()} style={btnPrimary}>Print</button>
            <button type="button" data-legal-print-pdf disabled={busy || saving} onClick={() => void savePdf()} style={btn}>{saving ? 'Making the PDF…' : 'Save as PDF'}</button>
            <button type="button" onClick={onBack} style={btn}>Back to the statement</button>
            <span style={{ ...MUTED, fontSize: '0.76rem' }}>Each print is noted on the row: when, by whom, which face.</span>
            {error ? <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{error}</span> : null}
          </div>
          {/* The paper is a print surface, so its frame is pinned light whatever theme the desk wears (CLAUDE.md → theme tokens). */}
          <div data-theme="light" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <iframe ref={frame} title="The paper as it prints" data-legal-print-frame srcDoc={html} style={{ display: 'block', width: '100%', minHeight: 'min(70vh, 820px)', border: 'none', background: 'var(--surface)' }} />
          </div>
        </>
      )}
    </div>
  )
}
