import { useMemo, useState, type CSSProperties } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { lienServePlan, lienServePlanRead, type LienServeJob } from '../../lib/jobs/lienServePackets'
import { LIEN_SERVE_PRINT_WORDS, printLienServeRun } from '../../lib/jobs/lienServePrintIo'
import { loadLienSavedCopy } from '../../lib/jobs/lienStampedCopyIo'
import { LIEN_COPY_WORDS, lienCopyReadyWords } from '../../lib/jobs/lienStampedCopy'
import { normalizeDocumentUrl } from '../../lib/jobs/lienFilingDocumentLink'
import { filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_SERVE_LETTER_READ_BY_COUNSEL, LIEN_SERVE_WORDS, lienServeEnvelopeWords, lienServeHoldActs, lienServeHoldWords, type LienServeFacts } from '../../lib/jobsDocuments/lienServedCopy'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useLienServeLetterChoice } from './lienHelpSheetChoice'
import { useLienCopyReads } from './useLienCopyReads'

const small: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

/**
 * *Print the copies to mail* on a filed lien affidavit that has not been served (punch list #366): the copy § 53.055
 * has the office send to the owner, and to the original contractor on a job that has one, each behind its cover
 * letter. The copy is the clerk's stamped scan, the filing's saved copy, every page of it (v2.7916): the press reads
 * it as it is drawn, and is held with the reason when there is none or the app cannot print it. The print counts as
 * a send and is filed on the job (`docs/SENT_COPIES.md`). It is the batch window's own run, of one lien.
 *
 * It sits beside **Enter mail numbers…** (*Record service…* until v2.7816), which is still how the day and the mail numbers go on record. A filing with no
 * recording number is held, and the number is typed right here: until now a filing recorded without one had no place
 * to take it. A missing address is fixed on its own record, and the line under the press says which.
 */
export function LienServeCopiesPress({ filing, jobId, jobNumber, isSub, issuer, to, onChanged, onPrinted, tall, readCopy = loadLienSavedCopy, printRun = printLienServeRun }: { filing: JobLienFilingRow; jobId: string; jobNumber: string; isSub: boolean; issuer: PhysicalInvoiceIssuer | null; to?: LienServeFacts['to']; onChanged?: () => void; /** The copies went to the printer: the doors to them read *Enter mail numbers* from now on (`lienServeStage.ts`). */ onPrinted?: (filingId: string) => void; tall?: boolean; /** One saved copy read and looked at; a test hands its own. */ readCopy?: typeof loadLienSavedCopy; /** The print itself; a test hands its own. */ printRun?: typeof printLienServeRun }) {
  const { showToast } = useToastContext()
  const [letterOn, setLetterOn] = useLienServeLetterChoice()
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [anyway, setAnyway] = useState<ReadonlySet<string>>(new Set())
  const ownerName = to?.owner?.name ?? ''
  const ownerAddress = to?.owner?.address ?? ''
  const contractorName = to?.contractor?.name ?? ''
  const contractorAddress = to?.contractor?.address ?? ''
  const todayYmd = todayYmdInAppTz()
  // The batch window's own plan, of this one lien: what the rows say, then what reading its saved copy found.
  const base = useMemo(() => {
    const job: LienServeJob = { jobId, jobNumber, jobLabel: jobNumber, filing, isSub, to: { owner: { name: ownerName, address: ownerAddress }, contractor: { name: contractorName, address: contractorAddress } } }
    return lienServePlan([job], { todayYmd, phone: issuer?.phone ?? '' })
  }, [filing, jobId, jobNumber, isSub, issuer?.phone, ownerName, ownerAddress, contractorName, contractorAddress, todayYmd])
  const asks = useMemo(() => base.ready.map((r) => ({ filingId: r.job.filing.id, jobId: r.job.jobId, fileId: r.copy.fileId })), [base])
  const { reads, bytesOf } = useLienCopyReads(asks, readCopy)
  const run = useMemo(() => lienServePlanRead(base, reads, anyway), [base, reads, anyway])
  if (base.ready.length === 0 && base.held.length === 0) return null
  const ready = run.ready[0] ?? null
  const holds = run.held[0]?.holds ?? []
  const reading = run.reading > 0
  const dead = !ready
  const needsNumber = holds.some((h) => h.key === 'no_recording_number')
  const askOnly = holds.length > 0 && holds.every((h) => h.ask)
  const savedCopy = normalizeDocumentUrl(filing.document_url)

  const print = async () => {
    if (dead || printing) return
    setPrinting(true)
    // A print counts as a send: the papers are filed on the job as they printed, against the filing they copy.
    const out = await printRun(run, bytesOf, { letter: letterOn, letterhead: filingLetterheadFromIssuer(issuer), todayYmd })
    setPrinting(false)
    if (out.how === 'blocked') showToast(LIEN_SERVE_PRINT_WORDS.blocked, 'error')
    else if (out.how === 'failed') showToast(out.notPrinted[0]?.reason ? `The copies did not print: ${out.notPrinted[0].reason}.` : out.reason, 'error')
    else if (out.printed.length > 0) onPrinted?.(filing.id)
  }

  const saveNumber = async () => {
    const value = number.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ recording_number: value }).eq('id', filing.id), 'save lien recording number')
      showToast('Recording number saved.', 'success')
      setNumber('')
      onChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the recording number.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-lien-serve-copies style={{ flexBasis: '100%', display: 'grid', gap: '0.3rem', justifyItems: 'start' }}>
      <button
        type="button"
        onClick={() => void print()}
        disabled={dead || printing}
        data-lien-serve-print
        style={{
          padding: '0.45rem 0.9rem',
          fontSize: '0.8125rem',
          borderRadius: 4,
          fontWeight: 600,
          ...(tall ? { minHeight: 44 } : {}),
          ...(dead || printing ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid var(--border)', cursor: 'not-allowed' } : { background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', cursor: 'pointer' }),
        }}
      >
        {printing ? LIEN_SERVE_PRINT_WORDS.building : LIEN_SERVE_WORDS.press}
      </button>
      {reading ? (
        <div data-lien-serve-reading style={small}>
          {LIEN_COPY_WORDS.reading}
        </div>
      ) : dead ? (
        <>
          <div data-lien-serve-held style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
            {lienServeHoldWords(holds)} <span style={{ fontWeight: 400 }}>{lienServeHoldActs(holds)}</span>
          </div>
          {askOnly ? (
            <div data-lien-serve-ask style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.7rem', alignItems: 'center' }}>
              {savedCopy ? (
                <a href={savedCopy} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}>
                  {LIEN_COPY_WORDS.open}
                </a>
              ) : null}
              <button type="button" data-lien-serve-anyway onClick={() => setAnyway(new Set([filing.id]))} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', borderRadius: 4, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'inherit', cursor: 'pointer', ...(tall ? { minHeight: 44 } : {}) }}>
                {LIEN_COPY_WORDS.anyway}
              </button>
            </div>
          ) : null}
          {needsNumber ? (
            <div data-lien-serve-number style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="2026-…" aria-label={LIEN_SERVE_WORDS.numberLabel} autoComplete="off" style={{ padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', minWidth: '11rem', ...(tall ? { minHeight: 44 } : {}) }} />
              <button
                type="button"
                onClick={() => void saveNumber()}
                disabled={!number.trim() || saving}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  borderRadius: 4,
                  fontWeight: 600,
                  ...(tall ? { minHeight: 44 } : {}),
                  ...(!number.trim() ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid var(--border)', cursor: 'not-allowed' } : { background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'inherit', cursor: saving ? 'wait' : 'pointer' }),
                }}
              >
                {saving ? 'Saving…' : LIEN_SERVE_WORDS.numberSave}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={small}>
            {lienServeEnvelopeWords(ready.facts)} {LIEN_SERVE_WORDS.then}
          </div>
          <div data-lien-serve-copy-is style={small}>
            {lienCopyReadyWords(ready.file)} {LIEN_SERVE_WORDS.copyIs} {LIEN_SERVE_WORDS.opens} <strong>{LIEN_SERVE_WORDS.oneSide}</strong>
          </div>
          {ready.letter ? (
            <>
              <label data-lien-serve-letter style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={letterOn} onChange={(e) => setLetterOn(e.target.checked)} />
                {LIEN_SERVE_WORDS.letterBox}
              </label>
              {letterOn && !LIEN_SERVE_LETTER_READ_BY_COUNSEL ? (
                <div data-lien-serve-unread="letter" style={{ ...small, color: 'var(--text-amber-700)' }}>
                  {LIEN_SERVE_WORDS.letterUnread}
                </div>
              ) : null}
            </>
          ) : (
            <div data-lien-serve-no-letter style={small}>
              {LIEN_SERVE_WORDS.noLetter}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LienServeCopiesPress
