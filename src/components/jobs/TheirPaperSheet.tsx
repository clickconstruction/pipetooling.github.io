/**
 * Their paper (punch list #173, v2.6698): the record of a contract on the other side's own form —
 * a GC's subcontract — that we signed and they did not countersign. The sheet types what is true:
 * who signed for us and when, whether they countersigned, whether they rely on it (the day and
 * what for), the file, and the key terms with their clause references. Opened from the contract
 * strip's *Their paper…* and from the Contract window's band; the same sheet edits the record.
 * The words every surface then reads are the kernel's (`theirPaper.ts`).
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { FinishedDateInput } from '../FinishedDateInput'
import { dispatchJobContractChanged } from '../../lib/jobs/jobContractNotNeeded'
import {
  emptyTheirPaperDraft,
  THEIR_PAPER_TERM_KEYS,
  THEIR_PAPER_TERM_WORDS,
  theirPaperDraftFromRecord,
  theirPaperDraftProblem,
  type TheirPaperDraft,
  type TheirPaperRecord,
  type TheirPaperTermKey,
} from '../../lib/jobs/theirPaper'
import { saveTheirPaper } from '../../lib/jobs/theirPaperIo'
import type { PayCalendarJob } from '../../lib/jobs/payCalendarJob'
import { formatErrorMessage } from '../../utils/errorHandling'

export type TheirPaperSheetProps = {
  open: boolean
  onClose: () => void
  /** After a save (the parent reloads its coverage). */
  onDone?: () => void
  job: { id: string; num: string; partyName: string }
  /** Who pays this job's bills (punch list #323, PR 7): with one, the sheet offers the press that sets their Pay calendar, carrying this paper's clause. */
  payer?: { id: string; name: string } | null
  /** The job as the Pay calendar window names it, with its development (punch list #341), so the window can offer the development's other jobs. Absent, the window reads *Job <number>*. */
  payCalendarJob?: PayCalendarJob | null
  /** The record being edited, or null for a new one. */
  existing: TheirPaperRecord | null
  overlayZIndex?: number
}

const field: React.CSSProperties = {
  font: 'inherit',
  fontSize: '0.85rem',
  padding: '0.45rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'inherit',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
}
const label: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)' }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }
const sect: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.35rem 0 0' }

export default function TheirPaperSheet(p: TheirPaperSheetProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [draft, setDraft] = useState<TheirPaperDraft>(() => (p.existing ? theirPaperDraftFromRecord(p.existing) : emptyTheirPaperDraft()))
  const [file, setFile] = useState<File | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const payCalendarModal = usePayCalendarModal()

  // Opened again, or on another record: the form starts from that record.
  useEffect(() => {
    if (!p.open) return
    setDraft(p.existing ? theirPaperDraftFromRecord(p.existing) : emptyTheirPaperDraft())
    setFile(null)
    setScanOpen(false)
    setError(null)
  }, [p.open, p.existing])

  if (!p.open) return null

  const set = <K extends keyof TheirPaperDraft>(k: K, v: TheirPaperDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setTerm = (key: TheirPaperTermKey, part: 'clause' | 'words', v: string) => setDraft((d) => ({ ...d, terms: { ...d.terms, [key]: { ...d.terms[key], [part]: v } } }))
  const problem = theirPaperDraftProblem(draft)
  const canSubmit = !busy && problem == null

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const { uploadError } = await saveTheirPaper({ jobId: p.job.id, existingId: p.existing?.contractId ?? null, draft, file, authUserId: user?.id ?? null })
      dispatchJobContractChanged()
      if (uploadError) showToast(`The record was saved, but the file did not upload: ${uploadError}`, 'error')
      else showToast(p.existing ? 'The record was saved.' : 'Their paper is recorded — the job and the Legal desk read who signed, and whether they rely on it.', 'success')
      p.onDone?.()
      p.onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not save the record.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: p.overlayZIndex ?? 1300,
        whiteSpace: 'normal',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) p.onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="their-paper-title"
        data-testid="their-paper-sheet"
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
      >
        <div>
          <h2 id="their-paper-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            {p.existing ? 'Their paper · the record' : 'Their paper'}
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Job {p.job.num}
            {p.job.partyName ? ` · ${p.job.partyName}` : ''} · a contract on their form that we signed. The record says who signed, whether they rely on it, and what its clauses say.
          </div>
        </div>

        <div style={col}>
          <label htmlFor="their-paper-what" style={label}>
            What the paper is
          </label>
          <input id="their-paper-what" type="text" value={draft.title} disabled={busy} placeholder={`${p.job.partyName || 'Their'} subcontract, their form`} onChange={(e) => set('title', e.target.value)} style={field} />
        </div>

        <div style={sect}>Signed by us</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
          <div style={col}>
            <label htmlFor="their-paper-signer" style={label}>
              Who signed for us
            </label>
            <input id="their-paper-signer" type="text" value={draft.ourSigner} disabled={busy} placeholder="Name and role" onChange={(e) => set('ourSigner', e.target.value)} style={field} />
          </div>
          <div style={col}>
            <label htmlFor="their-paper-signed-on" style={label}>
              Signed on
            </label>
            <FinishedDateInput id="their-paper-signed-on" value={draft.ourSignedOn || null} disabled={busy} onCommit={(v) => set('ourSignedOn', v ?? '')} style={field} />
          </div>
          <div style={col}>
            <label htmlFor="their-paper-how" style={label}>
              How
            </label>
            <input id="their-paper-how" type="text" value={draft.ourSignedHow} disabled={busy} placeholder="their e-sign, on paper" onChange={(e) => set('ourSignedHow', e.target.value)} style={field} />
          </div>
        </div>

        <div style={sect}>Signed by them</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem', alignItems: 'end' }}>
          <div style={col}>
            <label htmlFor="their-paper-their-signed-on" style={label}>
              Countersigned on
            </label>
            <FinishedDateInput id="their-paper-their-signed-on" value={draft.theirSignedOn || null} disabled={busy} onCommit={(v) => set('theirSignedOn', v ?? '')} style={field} />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: '0.5rem' }} data-testid="their-paper-countersign-words">
            {draft.theirSignedOn ? 'Signed by both sides: it reads as a signed agreement.' : 'Blank means not countersigned.'}
          </div>
        </div>

        <div style={sect}>They rely on it</div>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', cursor: busy ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={draft.reliedOn} disabled={busy} onChange={(e) => set('reliedOn', e.target.checked)} data-testid="their-paper-relied" />
          <span>
            They rely on it <span style={{ color: 'var(--text-muted)' }}>· their notice, their pay application. Once they do, the Legal desk counts the paper as the agreement.</span>
          </span>
        </label>
        {draft.reliedOn ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 180px) minmax(0, 1fr)', gap: '0.6rem' }}>
            <div style={col}>
              <label htmlFor="their-paper-relied-on" style={label}>
                On
              </label>
              <FinishedDateInput id="their-paper-relied-on" value={draft.reliedOnOn || null} disabled={busy} onCommit={(v) => set('reliedOnOn', v ?? '')} style={field} />
            </div>
            <div style={col}>
              <label htmlFor="their-paper-relied-what" style={label}>
                What they relied on it for
              </label>
              <input id="their-paper-relied-what" type="text" value={draft.reliedOnWhat} disabled={busy} placeholder="their notice of termination" onChange={(e) => set('reliedOnWhat', e.target.value)} style={field} />
            </div>
          </div>
        ) : null}

        <div style={sect}>The file</div>
        <div style={col}>
          <label htmlFor="their-paper-link" style={label}>
            Link to the paper
          </label>
          <input id="their-paper-link" type="url" inputMode="url" value={draft.link} disabled={busy} placeholder="Paste the Google Drive link" onChange={(e) => set('link', e.target.value)} style={field} />
          {scanOpen ? (
            <input type="file" accept="application/pdf,image/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.8rem' }} data-testid="their-paper-file" />
          ) : (
            <button type="button" disabled={busy} onClick={() => setScanOpen(true)} style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>
              Have the PDF or a scan instead?
            </button>
          )}
          {p.existing?.hasUpload && !file ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A file is on the record. Picking another replaces it.</div> : null}
        </div>

        <div style={sect}>Key terms</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.3rem' }}>Each one in a few words, with the clause it sits in. Leave a term blank when the paper has none.</div>
        <div style={{ display: 'grid', gap: '0.4rem' }} data-testid="their-paper-terms">
          {THEIR_PAPER_TERM_KEYS.map((key) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 150px) minmax(70px, 90px) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor={`their-paper-term-${key}`} style={{ ...label, fontSize: '0.78rem' }}>
                {THEIR_PAPER_TERM_WORDS[key].label}
              </label>
              <input aria-label={`${THEIR_PAPER_TERM_WORDS[key].label} clause`} type="text" value={draft.terms[key].clause} disabled={busy} placeholder="§" onChange={(e) => setTerm(key, 'clause', e.target.value)} style={{ ...field, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem' }} />
              <input id={`their-paper-term-${key}`} type="text" value={draft.terms[key].words} disabled={busy} placeholder={THEIR_PAPER_TERM_WORDS[key].hint} onChange={(e) => setTerm(key, 'words', e.target.value)} style={{ ...field, fontSize: '0.8rem' }} />
            </div>
          ))}
        </div>

        {p.payer && payCalendarModal ? (
          // Punch list #323, PR 7: the paper names the cutoff and the pay day; the Pay calendar is where they are set, for this
          // job or for every job this payer pays. The press carries the clause and its words so they are not typed twice.
          <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>
            <button
              type="button"
              className="payCalendarPress"
              data-testid="their-paper-pay-calendar"
              disabled={busy}
              onClick={() => {
                const payer = p.payer
                if (!payer) return
                payCalendarModal.openPayCalendar(payer, {
                  job: p.payCalendarJob ?? { id: p.job.id, label: `Job ${p.job.num}` },
                  initial: { clause: draft.terms.pay_calendar.clause, words: draft.terms.pay_calendar.words },
                  zIndex: (p.overlayZIndex ?? 1300) + 10,
                })
              }}
            >
              Set {p.payer.name}’s pay calendar…
            </button>{' '}
            The cutoff and the pay day are set there, for this job or for every job they pay.
          </div>
        ) : null}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>Nothing is sent to anyone. The job reads the paper as it is, and the Legal desk's agreement line reads it too.</div>
        {problem && (draft.ourSigner || draft.reliedOn || draft.link) ? <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-700)' }} data-testid="their-paper-problem">{problem}</div> : null}
        {error ? <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={p.onClose} style={{ ...field, width: 'auto', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            data-testid="their-paper-submit"
            style={{ font: 'inherit', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: canSubmit ? '#2563eb' : 'var(--bg-muted)', color: canSubmit ? 'white' : 'var(--text-faint)', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            {busy ? 'Saving…' : p.existing ? 'Save the record' : 'Record their paper'}
          </button>
        </div>
      </div>
    </div>
  )
}
