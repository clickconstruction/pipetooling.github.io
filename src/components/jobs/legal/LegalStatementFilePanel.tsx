import { useRef, useState, type CSSProperties } from 'react'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { legalDocumentProblem, legalDocumentSizeWords, legalDocumentWhoseChoices, type LegalDocumentWhose } from '../../../lib/legal/legalMatterDocuments'
import { clockWordsInAppTz, lastPrintWords, statementFilingProblem, statementFilingShows, type StatementDraft, type StatementFilingDraft, type StatementMeta } from '../../../lib/legal/affidavitPaper'
import { btn, btnPrimary, MUTED } from './legalDeskShared'

/**
 * File the signed copy (punch list #220, v2.6212): the signed paper comes back as a scan or a phone photo, and this
 * panel takes it through the same path as the Evidence tab's add press, with the two days the office cannot skip —
 * the day it is about confirmed, the day it was signed read off the jurat — and whether the paper reads as last
 * printed. The scan lands on Evidence on the signing day; the statement on the Timeline turns signed; the two point
 * at each other.
 */
export type FilePanelProps = {
  draft: StatementDraft
  meta: StatementMeta
  payerName: string
  todayYmd: string
  busy: boolean
  onFile: (file: File, filing: StatementFilingDraft) => Promise<boolean>
  onBack: () => void
}

const lab: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }
const field: CSSProperties = { font: 'inherit', fontSize: '0.86rem', padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 0, width: '100%', fontWeight: 400 }
const help: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.4 }

export default function LegalStatementFilePanel({ draft, meta, payerName, todayYmd, busy, onFile, onBack }: FilePanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [showsTouched, setShowsTouched] = useState(false)
  const [filing, setFiling] = useState<StatementFilingDraft>(() => {
    const base = { signedOn: '', asPrinted: true, incidentOn: draft.incidentOn, incidentTo: draft.incidentTo, whose: null as LegalDocumentWhose | null }
    return { ...base, shows: statementFilingShows(meta, base) }
  })
  const [touched, setTouched] = useState(false)
  const patch = (p: Partial<StatementFilingDraft>) => setFiling((f) => {
    const next = { ...f, ...p }
    if (!showsTouched) next.shows = statementFilingShows(meta, next)
    return next
  })
  const fileProblem = file ? legalDocumentProblem({ title: draft.title || 'Statement', shows: 'x' }, file) : null
  const problem = fileProblem ?? statementFilingProblem(filing, file, todayYmd)
  const lastPrint = lastPrintWords(meta, calendarYmdInAppTzFromIso, clockWordsInAppTz)
  const choices = legalDocumentWhoseChoices(payerName)
  const take = (files: FileList | File[]) => { const f = [...files][0]; if (f) setFile(f) }
  const submit = async () => {
    setTouched(true)
    if (problem || !file) return
    const ok = await onFile(file, { ...filing, shows: filing.shows.trim() })
    if (ok) onBack()
  }
  return (
    <form data-legal-statement-file onSubmit={(e) => { e.preventDefault(); void submit() }} style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div
        data-legal-statement-drop
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) take(e.dataTransfer.files) }}
        style={{ border: `2px dashed ${over ? 'var(--text-700)' : 'var(--border-strong)'}`, borderRadius: 8, padding: '12px', display: 'grid', gap: 6, textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}
      >
        <b style={{ color: 'var(--text)', fontSize: '0.84rem' }}>The signed scan</b>
        {file ? <span data-legal-statement-file-name style={{ color: 'var(--text)' }}>📄 {file.name} · {legalDocumentSizeWords(file.size)} <button type="button" onClick={() => fileRef.current?.click()} style={{ ...btn, height: 22, fontSize: '0.7rem', marginLeft: 6 }}>Choose another</button></span> : <span>Drop the scan or the photo here, or <button type="button" onClick={() => fileRef.current?.click()} style={btn}>Choose the scan</button></span>}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*" aria-label="The signed scan" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) take(e.target.files); e.target.value = '' }} />
        <span style={help}>A PDF or a photo, up to 10 MB. The same rules as Documents for the firm.</span>
        {fileProblem ? <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.78rem' }}>{fileProblem}</span> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <label style={lab}>
          The day it is about
          <input type="date" aria-label="The day it is about, confirmed" value={filing.incidentOn} max={todayYmd} onChange={(e) => patch({ incidentOn: e.target.value })} style={field} />
        </label>
        <label style={lab}>
          to
          <input type="date" aria-label="The last day of the span, confirmed" value={filing.incidentTo} min={filing.incidentOn || undefined} max={todayYmd} onChange={(e) => patch({ incidentTo: e.target.value })} style={field} />
        </label>
        <label style={lab}>
          Signed on
          <input type="date" aria-label="The day it was signed" value={filing.signedOn} max={todayYmd} onChange={(e) => patch({ signedOn: e.target.value })} style={field} />
        </label>
      </div>
      <span style={{ ...help, marginTop: -6 }}>As typed in the draft. Change the days if the signed paper says otherwise. Read the signing day off the jurat. The notary wrote it by hand. It is the Evidence row’s day.</span>
      <div style={lab}>
        {lastPrint ? `Is the signed paper the text as last printed, ${lastPrint}?` : 'Is the signed paper the text as saved here?'}
        <div role="group" aria-label="As printed or changed by hand" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" aria-pressed={filing.asPrinted} data-legal-statement-as-printed="yes" onClick={() => patch({ asPrinted: true })} style={{ ...btn, height: 28, ...(filing.asPrinted ? { background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' } : null) }}>{lastPrint ? 'Yes, as printed' : 'Yes, as saved'}</button>
          <button type="button" aria-pressed={!filing.asPrinted} data-legal-statement-as-printed="no" onClick={() => patch({ asPrinted: false })} style={{ ...btn, height: 28, ...(!filing.asPrinted ? { background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' } : null) }}>They changed it by hand</button>
        </div>
        <span style={help}>As printed marks that text as the sworn text. Changed by hand keeps the text as it is and says so. The scan governs.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <label style={lab}>
          Whose paper
          <select aria-label="Whose paper" value={filing.whose ?? ''} onChange={(e) => patch({ whose: (e.target.value || null) as LegalDocumentWhose | null })} style={field}>{choices.map((c) => <option key={c.value} value={c.value}>{c.words}</option>)}</select>
          <span style={help}>A team member’s or a neighbour’s statement is our record. A supplier’s person’s is the supplier’s.</span>
        </label>
        <label style={lab}>
          Shows, one line
          <input aria-label="Shows, one line" value={filing.shows} onChange={(e) => { setShowsTouched(true); setFiling({ ...filing, shows: e.target.value }) }} style={field} />
          <span style={help}>Prefilled from the form and the day. The firm reads this line beside the title.</span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" data-legal-statement-file-press disabled={busy || Boolean(problem)} title={problem ?? undefined} style={{ ...btnPrimary, opacity: busy || problem ? 0.6 : 1 }}>File the signed copy</button>
        <button type="button" onClick={onBack} style={btn}>Back to the statement</button>
        {touched && problem ? <span role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{problem}</span> : <span style={{ ...MUTED, fontSize: '0.78rem' }}>Evidence gets the scan on the signing day. The Timeline’s line turns signed. The two are linked.</span>}
      </div>
    </form>
  )
}
