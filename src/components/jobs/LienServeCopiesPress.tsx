import { useMemo, useState, type CSSProperties } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { lienServeFactsFromFiling } from '../../lib/jobs/lienServeFacts'
import { filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import {
  LIEN_SERVE_LETTER_READ_BY_COUNSEL,
  LIEN_SERVE_WORDS,
  LIEN_SERVED_COPY_READ_BY_COUNSEL,
  LIEN_SERVED_COPY_SENT_KIND,
  lienServeEnvelopeWords,
  lienServeHoldActs,
  lienServeHoldWords,
  lienServeHolds,
  lienServePacketHtml,
  lienServeRecipients,
  lienServedCopySentTitle,
  type LienServeFacts,
} from '../../lib/jobsDocuments/lienServedCopy'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useLienServeLetterChoice } from './lienHelpSheetChoice'

const small: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

/**
 * *Print the copies to mail* on a filed lien affidavit that has not been served (punch list #366): the copy § 53.055
 * has the office send to the owner, and to the original contractor on a job that has one, each behind its cover
 * letter. The print counts as a send and is filed on the job (`docs/SENT_COPIES.md`).
 *
 * It sits beside **Record service…**, which is still how the day and the mail numbers go on record. A filing with no
 * recording number is held, and the number is typed right here: until now a filing recorded without one had no place
 * to take it. A missing address is fixed on its own record, and the line under the press says which.
 */
export function LienServeCopiesPress({ filing, jobId, jobNumber, isSub, issuer, to, onChanged, onPrinted, tall }: { filing: JobLienFilingRow; jobId: string; jobNumber: string; isSub: boolean; issuer: PhysicalInvoiceIssuer | null; to?: LienServeFacts['to']; onChanged?: () => void; /** The copies went to the printer: the doors to them read *Enter mail numbers* from now on (`lienServeStage.ts`). */ onPrinted?: (filingId: string) => void; tall?: boolean }) {
  const { showToast } = useToastContext()
  const [letterOn, setLetterOn] = useLienServeLetterChoice()
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const ownerName = to?.owner?.name ?? ''
  const ownerAddress = to?.owner?.address ?? ''
  const contractorName = to?.contractor?.name ?? ''
  const contractorAddress = to?.contractor?.address ?? ''
  const facts = useMemo(
    () => lienServeFactsFromFiling(filing, { isSub, letterYmd: todayYmdInAppTz(), phone: issuer?.phone ?? '', to: { owner: { name: ownerName, address: ownerAddress }, contractor: { name: contractorName, address: contractorAddress } } }),
    [filing, isSub, issuer?.phone, ownerName, ownerAddress, contractorName, contractorAddress],
  )
  const holds = useMemo(() => (facts ? lienServeHolds(facts) : []), [facts])
  if (!facts) return null
  const dead = holds.length > 0
  const needsNumber = holds.some((h) => h.key === 'no_recording_number')

  const print = () => {
    if (dead) return
    const title = lienServedCopySentTitle(jobNumber)
    const html = lienServePacketHtml(facts, { letter: letterOn, letterhead: filingLetterheadFromIssuer(issuer), title })
    if (!html) return
    // A print counts as a send: the packet is filed on the job as it printed, against the filing it copies.
    const ok = printAndFile(html, { kind: LIEN_SERVED_COPY_SENT_KIND, title, jobIds: [jobId], recipientName: lienServeRecipients(facts)[0]?.name ?? '', source: { table: 'job_lien_filings', id: filing.id } })
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
    else onPrinted?.(filing.id)
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
        onClick={print}
        disabled={dead}
        data-lien-serve-print
        style={{
          padding: '0.45rem 0.9rem',
          fontSize: '0.8125rem',
          borderRadius: 4,
          fontWeight: 600,
          ...(tall ? { minHeight: 44 } : {}),
          ...(dead ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid var(--border)', cursor: 'not-allowed' } : { background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', cursor: 'pointer' }),
        }}
      >
        {LIEN_SERVE_WORDS.press}
      </button>
      {dead ? (
        <>
          <div data-lien-serve-held style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
            {lienServeHoldWords(holds)} <span style={{ fontWeight: 400 }}>{lienServeHoldActs(holds)}</span>
          </div>
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
            {lienServeEnvelopeWords(facts)} {LIEN_SERVE_WORDS.then}
          </div>
          <label data-lien-serve-letter style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={letterOn} onChange={(e) => setLetterOn(e.target.checked)} />
            {LIEN_SERVE_WORDS.letterBox}
          </label>
          {letterOn && !LIEN_SERVE_LETTER_READ_BY_COUNSEL ? (
            <div data-lien-serve-unread="letter" style={{ ...small, color: 'var(--text-amber-700)' }}>
              {LIEN_SERVE_WORDS.letterUnread}
            </div>
          ) : null}
          {!LIEN_SERVED_COPY_READ_BY_COUNSEL ? (
            <div data-lien-serve-unread="copy" style={{ ...small, color: 'var(--text-amber-700)' }}>
              {LIEN_SERVE_WORDS.copyUnread}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default LienServeCopiesPress
