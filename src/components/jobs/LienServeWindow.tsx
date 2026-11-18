import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_SERVE_LETTER_READ_BY_COUNSEL, LIEN_SERVE_WORDS, LIEN_SERVED_COPY_READ_BY_COUNSEL, LIEN_SERVED_COPY_SENT_KIND } from '../../lib/jobsDocuments/lienServedCopy'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import { lienServeBatchPrint, lienServePlan, lienServePlanWords, type LienServeJob } from '../../lib/jobs/lienServePackets'
import { LIEN_SERVE_NUMBERS_WORDS, lienServeDraftFor, lienServeDraftWith, lienServeRecordOutcome, lienServeRecordWords, lienServeWrites, type LienServeDraft } from '../../lib/jobs/lienServeNumbers'
import { recordLienServices, type LienServeRecordResult } from '../../lib/jobs/lienServeNumbersIo'
import { LIEN_SERVICE_PROOF_WORDS, type ServiceCopy, type ServiceCopyDraft } from '../../lib/jobs/lienServiceProof'
import { LienReceiptPhotoPress } from './LienReceiptPhotoPress'
import { LIEN_RECEIPT_WORDS, lienCopyProofChanged, lienReceiptNotKeptWords } from '../../lib/jobs/lienReceiptFile'
import { keepLienCopyProof } from '../../lib/jobs/lienReceiptKeepIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_SCAN_BATCH_WORDS } from '../../lib/jobs/lienScanBatch'
import { useLienServeLetterChoice } from './lienHelpSheetChoice'
import { landOnWhenThere } from '../../lib/landOn'
import { lienServeLandingSelector, type LienServeLanding } from '../../lib/jobs/lienServeStage'

type Props = {
  /** Every filed lien that owes its copies (`lienServeJobsFromDesk`). */
  jobs: ReadonlyArray<LienServeJob>
  todayYmd: string
  issuer: PhysicalInvoiceIssuer | null
  isMobile?: boolean
  /** A held lien's door: its own Lien window, where the number is typed or the property record opens. */
  onOpenJob: (jobId: string) => void
  /** The desk reads again after a record. */
  onChanged: () => void
  /** The door to Add the stamped scans; absent draws none. */
  onAddScans?: () => void
  onClose: () => void
  /** The write, handed in by a test. */
  record?: typeof recordLienServices
  /** One copy's proof kept on its filing the moment it is added; a test hands its own. */
  keep?: typeof keepLienCopyProof
  zIndex?: number
  /** Open on the half the door named, scrolled to and lit for a moment (`landOn.ts`, `lienServeStage.ts`): the print half, the numbers half, or one copy's line in it. */
  land?: LienServeLanding | null
  /** The copies of these filings were sent to the printer: the desk's doors to them read *Enter mail numbers* from now on. */
  onPrinted?: (filingIds: string[]) => void
}

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }
const dead: CSSProperties = { ...btn, border: '1px solid var(--border)', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const field: CSSProperties = { padding: '0.3rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', minWidth: 0 }
const TO: Record<ServiceCopy, string> = { owner: 'Owner', original_contractor: 'Original contractor' }

function chipStyle(late: boolean, today: boolean): CSSProperties {
  return {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.1rem 0.45rem',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    background: late ? 'var(--bg-red-tint)' : today ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
    color: late ? 'var(--text-red-700)' : today ? 'var(--text-amber-700)' : 'var(--text-muted)',
  }
}

/**
 * Serve the filed liens (punch list #366, steps 3 and 4): one window for every filed lien that owes its copies. The
 * top half prints the stack, the mail sheet first and then each envelope's letter and copy; a lien with no recording
 * number or no address is left out with its reason and its door. The bottom half takes the day the copies were
 * mailed and each certified mail number, and one press records every ticked lien as **Record service…** would.
 *
 * Each print is filed on its own job. Nothing here mails anything: the office does, and says so by ticking *Mailed*.
 *
 * A receipt or a number is kept on its filing the moment it is added (`lienReceiptFile.ts`), so a window closed before
 * **Record** loses nothing. **Record** still sets the day, which is what clears the serve-by watch.
 */
export default function LienServeWindow({ jobs, todayYmd, issuer, isMobile, onOpenJob, onChanged, onAddScans, onClose: onCloseProp, record = recordLienServices, keep = keepLienCopyProof, zIndex = 1200, land = null, onPrinted }: Props) {
  const isTopmost = useModalStackEntry()
  const scopeRef = useRef<HTMLDivElement | null>(null)
  // The half, or the copy, a door sent the reader to: in view and lit once it is drawn.
  const landAt = land ? lienServeLandingSelector(land) : ''
  const landCursor = land?.part === 'numbers' && Boolean(land.cursor)
  useEffect(() => {
    if (!landAt) return
    return landOnWhenThere(() => scopeRef.current?.querySelector<HTMLElement>(landAt), { focus: landCursor ? 'input[type="text"]' : null })
  }, [landAt, landCursor])
  const { showToast } = useToastContext()
  const [letterOn, setLetterOn] = useLienServeLetterChoice()
  const [servedOn, setServedOn] = useState(todayYmd)
  const [drafts, setDrafts] = useState<Record<string, LienServeDraft>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<LienServeRecordResult['failed']>([])
  const numberRefs = useRef<Array<HTMLInputElement | null>>([])
  // Kept as you go: each copy's last word from its filing, `''` for kept and a sentence for a write that failed.
  const [kept, setKept] = useState<Record<string, string>>({})
  // The `sends` this window last wrote on a filing, so a second blur with nothing new writes nothing.
  const writtenSends = useRef<Record<string, unknown>>({})
  const keptAny = useRef(false)
  // The desk reads again once on the way out when anything was kept, so its rows show the proof.
  const onClose = useCallback(() => {
    if (keptAny.current) onChanged()
    keptAny.current = false
    onCloseProp()
  }, [onChanged, onCloseProp])

  const plan = useMemo(() => lienServePlan(jobs, { todayYmd, phone: issuer?.phone ?? '' }), [jobs, todayYmd, issuer?.phone])
  const words = lienServePlanWords(plan, todayYmd)
  // Every lien in one list for the numbers, the soonest day first: a held lien is still mailed, by photocopy, and still recorded.
  const rows = useMemo(() => [...plan.ready.map((r) => ({ job: r.job, clock: r.clock, envelopes: r.envelopes.map((e) => ({ recipient: e.recipient, name: e.name })), held: false })), ...plan.held.map((h) => ({ job: h.job, clock: h.clock, envelopes: [] as Array<{ recipient: ServiceCopy; name: string }>, held: true }))], [plan])
  const draftOf = (job: LienServeJob): LienServeDraft => drafts[job.filing.id] ?? lienServeDraftFor(job)
  const writes = lienServeWrites(rows.map((r) => r.job), Object.fromEntries(rows.map((r) => [r.job.filing.id, draftOf(r.job)])), servedOn)
  const recordWords = lienServeRecordWords(writes.length, /^\d{4}-\d{2}-\d{2}$/.test(servedOn))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy || !isTopmost()) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, isTopmost, onClose])

  const print = () => {
    if (words.dead) return
    const out = lienServeBatchPrint(plan, { letter: letterOn, letterhead: filingLetterheadFromIssuer(issuer), todayYmd })
    if (!out) return
    if (!openHtmlPrintWindow(out.html)) {
      showToast('Popup blocked — allow popups to print.', 'error')
      return
    }
    // A print counts as a send (docs/SENT_COPIES.md): each job keeps its own papers, never the mail sheet, which is a desk paper.
    for (const j of out.jobs) void fileSentCopy({ kind: LIEN_SERVED_COPY_SENT_KIND, title: j.title, how: 'print', jobIds: [j.jobId], recipientName: j.recipientName, source: { table: 'job_lien_filings', id: j.filingId } }, { html: j.html })
    // The desk's doors to these copies read *Enter mail numbers* at once, ahead of the desk's next read.
    onPrinted?.(out.jobs.map((j) => j.filingId))
  }

  const recordNow = async () => {
    if (recordWords.dead || busy) return
    setBusy(true)
    try {
      const result = await record(writes)
      const outcome = lienServeRecordOutcome(result.done.length, result.failed.length)
      showToast(outcome.line, outcome.tone)
      setFailed(result.failed)
      if (result.done.length > 0) {
        const took = new Set(result.done.map((w) => w.filingId))
        setDrafts((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !took.has(id))))
        onChanged()
        keptAny.current = false
      }
      if (result.failed.length === 0 && result.done.length === rows.length) onClose()
    } finally {
      setBusy(false)
    }
  }

  const setCopy = (job: LienServeJob, copy: ServiceCopy, next: ServiceCopyDraft) => setDrafts((cur) => ({ ...cur, [job.filing.id]: lienServeDraftWith(cur[job.filing.id] ?? lienServeDraftFor(job), copy, next) }))
  /**
   * Keep one copy's number and receipt on its filing now. A write that fails says why under the envelope; Record still
   * writes it. Answers whether the filing now holds what the draft holds.
   */
  const keepCopy = async (job: LienServeJob, copy: ServiceCopy, draft: ServiceCopyDraft): Promise<boolean> => {
    const id = job.filing.id
    if (!lienCopyProofChanged(writtenSends.current[id] ?? job.filing.sends, copy, draft)) return true
    const key = `${id}:${copy}`
    try {
      writtenSends.current[id] = await keep({ filingId: id, recipient: copy, proof: { tracking: draft.tracking, receiptUrl: draft.receiptUrl } })
      keptAny.current = true
      setKept((cur) => ({ ...cur, [key]: '' }))
      return true
    } catch (e) {
      setKept((cur) => ({ ...cur, [key]: lienReceiptNotKeptWords(formatErrorMessage(e, 'the lien did not take it')) }))
      return false
    }
  }
  /**
   * The receipt press's write (v2.7743): the draft takes the link, the filing takes it, and the press waits for that
   * before a wrong file goes to Drive's trash. A write that did not land rejects, so the file stays where it is.
   */
  const setReceipt = async (job: LienServeJob, copy: ServiceCopy, draft: ServiceCopyDraft, receiptUrl: string) => {
    const next = { ...draft, receiptUrl }
    setCopy(job, copy, next)
    if (!(await keepCopy(job, copy, next))) throw new Error(LIEN_RECEIPT_WORDS.notKept)
  }
  const setMailed = (job: LienServeJob, mailed: boolean) => setDrafts((cur) => ({ ...cur, [job.filing.id]: { ...(cur[job.filing.id] ?? lienServeDraftFor(job)), mailed } }))

  let slot = -1
  const numberInput = (job: LienServeJob, copy: ServiceCopy, name: string, draft: ServiceCopyDraft) => {
    slot += 1
    const at = slot
    return (
      <div key={copy} data-lien-serve-envelope={copy} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 16rem)', gap: '0.35rem 0.6rem', alignItems: 'center', padding: '0.25rem 0' }}>
        <div style={{ fontSize: '0.78rem', minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{TO[copy]}</span>
          {name ? <span style={{ color: 'var(--text-muted)' }}> · {name}</span> : null}
        </div>
        <input
          ref={(el) => {
            numberRefs.current[at] = el
          }}
          type="text"
          inputMode="numeric"
          value={draft.tracking}
          onChange={(e) => setCopy(job, copy, { ...draft, tracking: e.target.value })}
          onBlur={() => void keepCopy(job, copy, draft)}
          onKeyDown={(e) => {
            // A scanner ends its number with Enter: the next envelope takes the next scan.
            if (e.key !== 'Enter') return
            e.preventDefault()
            numberRefs.current[at + 1]?.focus()
          }}
          placeholder={LIEN_SERVICE_PROOF_WORDS.numberPlaceholder}
          aria-label={`Job ${job.jobNumber}, ${TO[copy].toLowerCase()}, certified mail number`}
          autoComplete="off"
          style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }}
        />
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', minWidth: 0 }}>
          <LienReceiptPhotoPress
            jobId={job.jobId}
            jobNumber={job.jobNumber}
            of={copy}
            day={servedOn}
            url={draft.receiptUrl}
            compact={!isMobile}
            onSaved={(url) => setReceipt(job, copy, draft, url)}
            onTakeOff={() => setReceipt(job, copy, draft, '')}
          />
          {!draft.receiptUrl ? <span style={small}>{LIEN_RECEIPT_WORDS.hint}</span> : null}
          {kept[`${job.filing.id}:${copy}`] === '' ? (
            <span data-lien-serve-kept={copy} role="status" style={{ ...small, color: 'var(--text-green-800)', fontWeight: 600 }}>{LIEN_RECEIPT_WORDS.kept}</span>
          ) : kept[`${job.filing.id}:${copy}`] ? (
            <span data-lien-serve-not-kept={copy} role="alert" style={{ ...small, color: 'var(--text-red-700)', fontWeight: 600 }}>{kept[`${job.filing.id}:${copy}`]}</span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filed liens: copies to mail"
      data-testid="lien-serve-window"
      ref={scopeRef}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: isMobile ? 0 : 10, width: isMobile ? '100%' : 'min(52rem, calc(100vw - 2rem))', maxHeight: isMobile ? '100%' : 'calc(100% - 2rem)', height: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>Filed liens: copies to mail</div>
            <div data-lien-serve-lead style={{ ...small, marginTop: '0.15rem' }}>
              {words.lead || LIEN_SERVE_NUMBERS_WORDS.none}
            </div>
            {words.late ? (
              <div data-lien-serve-late style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-red-700)', marginTop: '0.15rem' }}>
                {words.late}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ ...btn, padding: '0.25rem 0.6rem', ...(isMobile ? { minHeight: 44, minWidth: 44 } : {}) }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.9rem 1.1rem', display: 'grid', gap: '1.1rem' }}>
          <section data-lien-serve-print-part style={{ display: 'grid', gap: '0.4rem', justifyItems: 'start' }}>
            <h3 style={head}>1 · Print the letters and the copies</h3>
            <button type="button" onClick={print} disabled={words.dead} data-lien-serve-batch-print style={{ ...(words.dead ? dead : press), ...(isMobile ? { minHeight: 44 } : {}) }}>
              {words.button}
            </button>
            {plan.ready.length > 0 ? <div style={small}>{plan.envelopes === 1 ? '1 envelope.' : `${plan.envelopes} envelopes.`} A mail sheet prints first and stays in the office. Each print is kept on its job.</div> : null}
            {words.foot ? <div style={{ ...small, color: 'var(--text-amber-700)', fontWeight: 600 }}>{words.foot}</div> : null}
            {plan.held.length > 0 ? (
              <ul data-lien-serve-held-list style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem', width: '100%' }}>
                {plan.held.map((h) => (
                  <li key={h.job.filing.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem 0.55rem' }}>
                    <span style={{ fontWeight: 700 }}>{h.job.jobLabel}</span>
                    <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>{h.holds.map((x) => x.words).join(', ')}.</span>
                    <span style={{ color: 'var(--text-muted)' }}>{[...new Set(h.holds.map((x) => x.act))].join(' ')}</span>
                    <button type="button" onClick={() => onOpenJob(h.job.jobId)} style={{ ...btn, marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                      Open the Lien window
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {plan.ready.length > 0 ? (
              <>
                <label data-lien-serve-letter style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={letterOn} onChange={(e) => setLetterOn(e.target.checked)} />
                  {LIEN_SERVE_WORDS.letterBox}
                </label>
                {letterOn && !LIEN_SERVE_LETTER_READ_BY_COUNSEL ? <div style={{ ...small, color: 'var(--text-amber-700)' }}>{LIEN_SERVE_WORDS.letterUnread}</div> : null}
                {!LIEN_SERVED_COPY_READ_BY_COUNSEL ? <div style={{ ...small, color: 'var(--text-amber-700)' }}>{LIEN_SERVE_WORDS.copyUnread}</div> : null}
              </>
            ) : null}
          </section>

          <section data-lien-serve-numbers-part style={{ display: 'grid', gap: '0.45rem' }}>
            <h3 style={head}>2 · After the post office: enter mail numbers</h3>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600 }}>
              {LIEN_SERVE_NUMBERS_WORDS.day}
              <input type="date" value={servedOn} onChange={(e) => setServedOn(e.target.value)} aria-label={LIEN_SERVE_NUMBERS_WORDS.day} style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }} />
            </label>
            <div style={small}>{LIEN_SERVE_NUMBERS_WORDS.hint}</div>
            {rows.length > 0 ? (
              <div data-lien-serve-kept-lead style={{ fontSize: '0.78rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                <strong>{LIEN_RECEIPT_WORDS.keptLead}</strong> {LIEN_RECEIPT_WORDS.keptRest}
              </div>
            ) : null}
            {rows.map((r) => {
              const d = draftOf(r.job)
              const why = failed.find((f) => f.write.filingId === r.job.filing.id)?.reason
              // A held lien's envelopes are not known to the plan: the paper's own two readers are asked for.
              const envelopes: Array<{ recipient: ServiceCopy; name: string }> = r.envelopes.length > 0 ? r.envelopes : [{ recipient: 'owner', name: r.job.to?.owner?.name ?? '' }, ...(d.contractor ? [{ recipient: 'original_contractor' as const, name: r.job.to?.contractor?.name ?? '' }] : [])]
              return (
                <div key={r.job.filing.id} data-lien-serve-row={r.job.jobNumber} data-lien-serve-job={r.job.jobId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{r.job.jobLabel}</span>
                    {r.clock.chip ? <span style={chipStyle(r.clock.late, r.clock.daysLeft === 0)}>{r.clock.chip}</span> : null}
                    <label style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input type="checkbox" checked={d.mailed} onChange={(e) => setMailed(r.job, e.target.checked)} aria-label={`Job ${r.job.jobNumber}, mailed`} />
                      {LIEN_SERVE_NUMBERS_WORDS.mailed}
                    </label>
                  </div>
                  {envelopes.map((e) => numberInput(r.job, e.recipient, e.name, e.recipient === 'owner' ? d.owner : (d.contractor ?? { tracking: '', receiptUrl: '' })))}
                  {why ? (
                    <div data-lien-serve-failed style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-700)', marginTop: '0.2rem' }}>
                      Not recorded: {why}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </section>

          {/* The clerk's stamped scans for several liens at once (punch list #366): its own window, since a scan is the filing's saved copy and not part of the mailing. */}
          {onAddScans ? (
            <section data-lien-serve-scans-part style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start' }}>
              <h3 style={head}>3 · The clerk’s stamped scans</h3>
              <button type="button" onClick={onAddScans} disabled={busy} data-lien-serve-add-scans style={{ ...btn, ...(isMobile ? { minHeight: 44 } : {}) }}>
                {LIEN_SCAN_BATCH_WORDS.door}
              </button>
              <div style={small}>{LIEN_SCAN_BATCH_WORDS.where}</div>
            </section>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          {recordWords.dead && rows.length > 0 ? <span style={{ ...small, marginRight: 'auto' }}>{recordWords.why}</span> : null}
          <button type="button" onClick={onClose} disabled={busy} style={{ ...btn, ...(isMobile ? { minHeight: 44 } : {}) }}>
            Close
          </button>
          <button type="button" onClick={() => void recordNow()} disabled={recordWords.dead || busy} data-lien-serve-record style={{ ...(recordWords.dead ? dead : press), ...(busy ? { cursor: 'wait' } : {}), ...(isMobile ? { minHeight: 44 } : {}) }}>
            {busy ? 'Saving…' : recordWords.button}
          </button>
        </div>
      </div>
    </div>
  )
}
