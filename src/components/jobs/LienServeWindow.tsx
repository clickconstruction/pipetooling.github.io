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
import { LIEN_SERVE_NUMBERS_WORDS, lienMailedNotSavedWords, lienMailedSavedWords, lienServeDraftFor, lienServeDraftWith, lienServeNumberTicks, lienServeTickDay, type LienServeDraft } from '../../lib/jobs/lienServeNumbers'
import { setLienMailed } from '../../lib/jobs/lienServeMailedIo'
import { type ServiceCopy, type ServiceCopyDraft } from '../../lib/jobs/lienServiceProof'
import { LienReceiptPhotoPress } from './LienReceiptPhotoPress'
import { LIEN_RECEIPT_WORDS, lienCopyProofChanged, lienReceiptDoubt, lienReceiptNotKeptWords } from '../../lib/jobs/lienReceiptFile'
import { keepLienCopyProof } from '../../lib/jobs/lienReceiptKeepIo'
import { LIEN_DOC_NUMBER_WORDS, lienDocCheck, lienDocFiledWords, lienDocNotSavedWords, lienDocNumberClean, type LienDocKnown } from '../../lib/jobs/lienDocNumber'
import { saveLienDocNumber } from '../../lib/jobs/lienDocNumberIo'
import { normalizeDocumentUrl } from '../../lib/jobs/lienFilingDocumentLink'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_SCAN_BATCH_WORDS } from '../../lib/jobs/lienScanBatch'
import { useLienServeLetterChoice } from './lienHelpSheetChoice'
import { landOnWhenThere } from '../../lib/landOn'
import { lienServeLandingSelector, type LienServeLanding } from '../../lib/jobs/lienServeStage'

type Props = {
  /** Every filed lien that owes its copies (`lienServeJobsFromDesk`). */
  jobs: ReadonlyArray<LienServeJob>
  /** The liens whose mailing day is on record and that still lack a number or a receipt (`lienServeMailedJobsFromDesk`): shown under the rest, ticked. */
  mailed?: ReadonlyArray<LienServeJob>
  todayYmd: string
  issuer: PhysicalInvoiceIssuer | null
  isMobile?: boolean
  /** A held lien's door: its own Lien window, where the property record opens. */
  onOpenJob: (jobId: string) => void
  /** The desk reads again: on the way out when anything was kept, and at once when a document number changed, since the print reads it. */
  onChanged: () => void
  /** The door to Add the stamped scans; absent draws none. */
  onAddScans?: () => void
  onClose: () => void
  /** One copy's proof kept on its filing the moment it is added; a test hands its own. */
  keep?: typeof keepLienCopyProof
  /** The mailing day written, or taken back, the moment the box is ticked or unticked; a test hands its own. */
  mark?: typeof setLienMailed
  /** A document number kept the moment its box is left; a test hands its own. */
  saveNumber?: typeof saveLienDocNumber
  /** Every filed lien's number on the desk (`lienDocKnownFromFilings`), for the check on a typed one. */
  docKnown?: ReadonlyArray<LienDocKnown>
  /** The filings whose copies a print is filed for: a changed number says to print them again. */
  printed?: ReadonlySet<string>
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
const field: CSSProperties = { padding: '0.3rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', minWidth: 0 }
const wordsLink: CSSProperties = { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const TO: Record<ServiceCopy, string> = { owner: 'Owner', original_contractor: 'Original contractor' }

type Said = { tone: 'ok' | 'warn' | 'bad'; words: string; /** An odd number, saved on the reader's word. */ anyway?: boolean }
const SAID_COLOR: Record<Said['tone'], string> = { ok: 'var(--text-green-800)', warn: 'var(--text-amber-700)', bad: 'var(--text-red-700)' }

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

type Row = { job: LienServeJob; clock: { chip: string; late: boolean; daysLeft: number | null } | null; envelopes: Array<{ recipient: ServiceCopy; name: string }>; mailedRow: boolean }

/**
 * Serve the filed liens (punch list #366, steps 3 and 4): one window for every filed lien that owes its copies. The
 * top half prints the stack, the mail sheet first and then each envelope's letter and copy; a lien with no document
 * number or no address is left out with its reason and its door. The bottom half takes the day the copies were
 * mailed, each certified mail number and each receipt.
 *
 * Each print is filed on its own job. Nothing here mails anything: the office does, and says so by ticking *Mailed*.
 *
 * Everything saves by itself (v2.7846, the owner's call of 2026-11-18; `lienServeNumbers.ts` has the story). A
 * receipt or a number is kept on its filing the moment it is added. A tick writes the *Mailed on* day to that lien at
 * once and an untick takes it back, so there is no Record press and nothing to lose by closing. A mail number ticks
 * the box; a file alone does not.
 *
 * Each lien's card says what the clerk gave back: its document number, the county, the day filed and the stamped
 * lien, with **Change** for a number typed wrong and a box for one not typed yet (`lienDocNumber.ts`). The receipt
 * press reads **Add the mail receipt**, and a file that looks like the lien, or like the other envelope's file, is
 * asked about before it is kept (`lienReceiptDoubt`).
 *
 * A lien that leaves the desk's list while the window is open, because its day was just written, stays on screen
 * until the window closes. A mailed lien that still lacks a number or a receipt comes back under the rest next time.
 */
export default function LienServeWindow({ jobs, mailed = [], todayYmd, issuer, isMobile, onOpenJob, onChanged, onAddScans, onClose: onCloseProp, keep = keepLienCopyProof, mark = setLienMailed, saveNumber = saveLienDocNumber, docKnown = [], printed, zIndex = 1200, land = null, onPrinted }: Props) {
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
  // The drafts as drawn, and the same in a ref: a handler that runs after an await reads the ref, never a stale render.
  const [drafts, setDrafts] = useState<Record<string, LienServeDraft>>({})
  const draftsRef = useRef<Record<string, LienServeDraft>>({})
  const numberRefs = useRef<Array<HTMLInputElement | null>>([])
  // Kept as you go: each copy's last word from its filing, `''` for kept and a sentence for a write that failed.
  const [kept, setKept] = useState<Record<string, string>>({})
  // What this window last kept for each copy, so a second blur with nothing new writes nothing.
  const keptProof = useRef<Record<string, { tracking: string; receiptUrl: string }>>({})
  const keptAny = useRef(false)
  // The boxes a hand has ticked or unticked in this sitting: a number does not change those.
  const touched = useRef<Set<string>>(new Set())
  // The day each lien's mailing holds, as this window last wrote it, and what the box last said.
  const mailedDay = useRef<Record<string, string>>({})
  const [mailedSaid, setMailedSaid] = useState<Record<string, Said>>({})
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  // The document numbers saved in this sitting, the box that is open, what is typed in it and what it last said.
  const [numbers, setNumbers] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [numberSaid, setNumberSaid] = useState<Record<string, Said>>({})
  const [savingNumber, setSavingNumber] = useState<Record<string, boolean>>({})
  // The file each envelope took in this sitting, to tell a second envelope's file from it.
  const picked = useRef<Record<string, { name: string; size: number }>>({})
  // Every lien shown since the window opened: one that leaves the desk's list mid-sitting stays on screen.
  const seen = useRef<Map<string, LienServeJob>>(new Map())
  const order = useRef<string[]>([])

  // The desk reads again once on the way out when anything was kept, so its rows show the proof.
  const onClose = useCallback(() => {
    if (keptAny.current) onChanged()
    keptAny.current = false
    onCloseProp()
  }, [onChanged, onCloseProp])

  const plan = useMemo(() => lienServePlan(jobs, { todayYmd, phone: issuer?.phone ?? '' }), [jobs, todayYmd, issuer?.phone])
  const words = lienServePlanWords(plan, todayYmd)

  // The liens that owe their copies, the soonest day first: a held lien is still mailed, by photocopy, and still recorded.
  // Under them, the mailed ones still shown: the desk's, and any that left its list while this window was open.
  const rows = useMemo(() => {
    const owing: Row[] = [...plan.ready.map((r) => ({ job: r.job, clock: r.clock, envelopes: r.envelopes.map((e) => ({ recipient: e.recipient, name: e.name })), mailedRow: false })), ...plan.held.map((h) => ({ job: h.job, clock: h.clock, envelopes: [] as Array<{ recipient: ServiceCopy; name: string }>, mailedRow: false }))]
    const shown = new Set(owing.map((r) => r.job.filing.id))
    const under: Row[] = []
    for (const job of mailed) {
      if (shown.has(job.filing.id)) continue
      shown.add(job.filing.id)
      under.push({ job, clock: null, envelopes: [], mailedRow: true })
    }
    for (const id of order.current) {
      const job = seen.current.get(id)
      if (!job || shown.has(id)) continue
      shown.add(id)
      under.push({ job, clock: null, envelopes: [], mailedRow: true })
    }
    for (const r of [...owing, ...under]) {
      if (!seen.current.has(r.job.filing.id)) order.current.push(r.job.filing.id)
      seen.current.set(r.job.filing.id, r.job)
    }
    return { owing, under }
  }, [plan, mailed])
  const allRows = [...rows.owing, ...rows.under]

  const draftOf = (job: LienServeJob): LienServeDraft => draftsRef.current[job.filing.id] ?? drafts[job.filing.id] ?? lienServeDraftFor(job)
  const putDraft = (id: string, next: LienServeDraft) => {
    draftsRef.current = { ...draftsRef.current, [id]: next }
    setDrafts(draftsRef.current)
  }
  const copyOf = (job: LienServeJob, copy: ServiceCopy): ServiceCopyDraft => {
    const d = draftOf(job)
    return (copy === 'owner' ? d.owner : d.contractor) ?? { tracking: '', receiptUrl: '' }
  }
  const dayOf = (job: LienServeJob): string => mailedDay.current[job.filing.id] ?? (job.filing.served_at ?? '').toString().slice(0, 10)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopmost()) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isTopmost, onClose])

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

  /**
   * Write one lien's mailing day, or take it back. The box moves at once and goes back if the write does not land.
   * `byHand` marks the box as the hand's, so a number typed later leaves it alone.
   */
  const tick = async (job: LienServeJob, want: boolean, byHand: boolean) => {
    const id = job.filing.id
    if (byHand) touched.current.add(id)
    const day = want ? lienServeTickDay(servedOn) : null
    if (want && !day?.ymd) {
      setMailedSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: LIEN_SERVE_NUMBERS_WORDS.needDay } }))
      return
    }
    const before = draftOf(job)
    putDraft(id, { ...before, mailed: want })
    setMarking((cur) => ({ ...cur, [id]: true }))
    try {
      await mark({ filingId: id, servedOn: want ? day!.ymd : null })
      keptAny.current = true
      if (want) mailedDay.current[id] = day!.ymd!
      else delete mailedDay.current[id]
      setMailedSaid((cur) => ({ ...cur, [id]: { tone: 'ok', words: want ? lienMailedSavedWords(day!.ymd!) : LIEN_SERVE_NUMBERS_WORDS.takenBack } }))
    } catch (e) {
      putDraft(id, { ...draftOf(job), mailed: before.mailed })
      setMailedSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: lienMailedNotSavedWords(formatErrorMessage(e, 'the lien did not take it')) } }))
    } finally {
      setMarking((cur) => ({ ...cur, [id]: false }))
    }
  }

  const setCopy = (job: LienServeJob, copy: ServiceCopy, next: ServiceCopyDraft) => putDraft(job.filing.id, lienServeDraftWith(draftOf(job), copy, next))
  /**
   * Keep one copy's number and receipt on its filing now. A write that fails says why under the envelope. A mail
   * number then ticks *Mailed* on a lien no hand has ticked, and on a lien already mailed the day goes on the copy's
   * own line. Answers whether the filing now holds what the draft holds.
   */
  const keepCopy = async (job: LienServeJob, copy: ServiceCopy, draft: ServiceCopyDraft): Promise<boolean> => {
    const id = job.filing.id
    const key = `${id}:${copy}`
    const last = keptProof.current[key]
    if (last ? last.tracking === draft.tracking.trim() && last.receiptUrl === draft.receiptUrl.trim() : !lienCopyProofChanged(job.filing.sends, copy, draft)) return true
    try {
      await keep({ filingId: id, recipient: copy, proof: { tracking: draft.tracking, receiptUrl: draft.receiptUrl } })
      keptProof.current[key] = { tracking: draft.tracking.trim(), receiptUrl: draft.receiptUrl.trim() }
      keptAny.current = true
      setKept((cur) => ({ ...cur, [key]: '' }))
    } catch (e) {
      setKept((cur) => ({ ...cur, [key]: lienReceiptNotKeptWords(formatErrorMessage(e, 'the lien did not take it')) }))
      return false
    }
    const whole = draftOf(job)
    if (lienServeNumberTicks(whole, touched.current.has(id))) await tick(job, true, false)
    else if (whole.mailed && dayOf(job)) {
      // The copy's own line takes the day the lien was mailed, as the Lien window's form writes it.
      try {
        await mark({ filingId: id, servedOn: dayOf(job) })
      } catch {
        // The proof is kept. The day on the copy's line follows the next time the box is ticked.
      }
    }
    return true
  }
  /**
   * The receipt press's write (v2.7743): the draft takes the link, the filing takes it, and the press waits for that
   * before a wrong file goes to Drive's trash. A write that did not land rejects, so the file stays where it is.
   */
  const setReceipt = async (job: LienServeJob, copy: ServiceCopy, receiptUrl: string) => {
    const next = { ...copyOf(job, copy), receiptUrl }
    setCopy(job, copy, next)
    if (!(await keepCopy(job, copy, next))) throw new Error(LIEN_RECEIPT_WORDS.notKept)
  }
  /** A number read off a receipt's barcode goes in an empty box, and is kept as a typed one is. */
  const readNumber = (job: LienServeJob, copy: ServiceCopy, tracking: string) => {
    const cur = copyOf(job, copy)
    if (cur.tracking.trim() || !tracking.trim()) return
    const next = { ...cur, tracking: tracking.trim() }
    setCopy(job, copy, next)
    void keepCopy(job, copy, next)
  }

  const numberOf = (job: LienServeJob): string => numbers[job.filing.id] ?? (job.filing.recording_number ?? '').trim()
  // The numbers on record with this sitting's changes on top, so a twin typed a minute ago is caught.
  const known = useMemo(() => {
    const out = docKnown.map((k) => (numbers[k.filingId] != null ? { ...k, number: numbers[k.filingId]! } : k))
    const have = new Set(out.map((k) => k.filingId))
    for (const [id, number] of Object.entries(numbers)) {
      const job = seen.current.get(id)
      if (have.has(id) || !job || !number) continue
      out.push({ filingId: id, county: (job.filing.county ?? '').trim(), number, filedYmd: (job.filing.filed_at ?? '').toString().slice(0, 10), jobLabel: job.jobLabel })
    }
    return out
  }, [docKnown, numbers])

  /** Keep a typed document number. A twin is held, an odd one is asked about, and the rest is saved at once. */
  const keepNumber = async (job: LienServeJob, value: string, anyway = false) => {
    const id = job.filing.id
    const number = lienDocNumberClean(value)
    const had = numberOf(job)
    if (savingNumber[id]) return
    if (!number || number === had) {
      // Nothing new: the box closes on a lien that has a number, and stays for one that has none.
      setEditing((cur) => ({ ...cur, [id]: false }))
      setTyped((cur) => ({ ...cur, [id]: had }))
      return
    }
    const check = lienDocCheck({ number, county: (job.filing.county ?? '').trim(), filedYmd: (job.filing.filed_at ?? '').toString().slice(0, 10), known, selfId: id })
    if (check.kind === 'twin') {
      setNumberSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: check.words } }))
      return
    }
    if (check.kind === 'odd' && !anyway) {
      setNumberSaid((cur) => ({ ...cur, [id]: { tone: 'warn', words: check.words, anyway: true } }))
      return
    }
    setSavingNumber((cur) => ({ ...cur, [id]: true }))
    try {
      await saveNumber({ filingId: id, number })
      keptAny.current = false
      setNumbers((cur) => ({ ...cur, [id]: number }))
      setEditing((cur) => ({ ...cur, [id]: false }))
      setNumberSaid((cur) => ({ ...cur, [id]: { tone: had && printed?.has(id) ? 'warn' : 'ok', words: had && printed?.has(id) ? `${LIEN_DOC_NUMBER_WORDS.saved} ${LIEN_DOC_NUMBER_WORDS.reprint}` : LIEN_DOC_NUMBER_WORDS.saved } }))
      // The print reads the number off the desk's own rows, so the desk reads again now.
      onChanged()
    } catch (e) {
      setNumberSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: lienDocNotSavedWords(formatErrorMessage(e, LIEN_DOC_NUMBER_WORDS.failed)) } }))
    } finally {
      setSavingNumber((cur) => ({ ...cur, [id]: false }))
    }
  }

  /** The line under a lien's name: what the clerk gave back, or the box that takes it. */
  const numberLine = (job: LienServeJob) => {
    const id = job.filing.id
    const number = numberOf(job)
    const open = editing[id] || !number
    const value = typed[id] ?? number
    const said = numberSaid[id]
    const stamped = normalizeDocumentUrl(job.filing.document_url)
    const filed = lienDocFiledWords({ county: job.filing.county, filedYmd: (job.filing.filed_at ?? '').toString().slice(0, 10) })
    return (
      <div data-lien-serve-doc={job.jobNumber} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {open ? (
          <>
            <label htmlFor={`lien-doc-${id}`} style={{ fontWeight: 700, color: number ? 'var(--text-base)' : 'var(--text-amber-700)' }}>
              {number ? LIEN_DOC_NUMBER_WORDS.label : LIEN_DOC_NUMBER_WORDS.none}
            </label>
            <input
              id={`lien-doc-${id}`}
              data-lien-doc-input={id}
              type="text"
              inputMode="numeric"
              value={value}
              autoFocus={Boolean(editing[id])}
              disabled={Boolean(savingNumber[id])}
              onChange={(e) => setTyped((cur) => ({ ...cur, [id]: e.target.value }))}
              onBlur={(e) => void keepNumber(job, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void keepNumber(job, (e.target as HTMLInputElement).value)
                } else if (e.key === 'Escape' && number) {
                  // Esc closes the box, not the window, and puts back what the lien holds.
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                  setTyped((cur) => ({ ...cur, [id]: number }))
                  setEditing((cur) => ({ ...cur, [id]: false }))
                  setNumberSaid((cur) => ({ ...cur, [id]: { tone: 'ok', words: '' } }))
                }
              }}
              placeholder={LIEN_DOC_NUMBER_WORDS.placeholder}
              aria-label={`Job ${job.jobNumber}, document number`}
              autoComplete="off"
              style={{ ...field, width: isMobile ? '100%' : '13rem', ...(isMobile ? { minHeight: 44 } : {}) }}
            />
            {savingNumber[id] ? <span>{LIEN_DOC_NUMBER_WORDS.saving}</span> : !number && !said ? <span>{LIEN_DOC_NUMBER_WORDS.noneWhy}</span> : null}
          </>
        ) : (
          <>
            <span>
              {LIEN_DOC_NUMBER_WORDS.short} <strong data-lien-serve-doc-number style={{ color: 'var(--text-base)', fontVariantNumeric: 'tabular-nums' }}>{number}</strong>
              {filed ? ` · ${filed}` : ''}
            </span>
            <button type="button" data-lien-serve-doc-change onClick={() => { setTyped((cur) => ({ ...cur, [id]: number })); setEditing((cur) => ({ ...cur, [id]: true })) }} aria-label={`Job ${job.jobNumber}, change the document number`} style={{ ...wordsLink, ...(isMobile ? { minHeight: 44 } : {}) }}>
              {LIEN_DOC_NUMBER_WORDS.change}
            </button>
          </>
        )}
        <span data-lien-serve-stamped style={{ whiteSpace: 'nowrap' }}>
          {stamped ? (
            <>
              {LIEN_DOC_NUMBER_WORDS.stamped}{' '}
              <a href={stamped} target="_blank" rel="noreferrer" aria-label={`Job ${job.jobNumber}, open the stamped lien`} style={{ fontWeight: 600, color: 'var(--text-link)' }}>
                {LIEN_DOC_NUMBER_WORDS.open} ›
              </a>
            </>
          ) : (
            LIEN_DOC_NUMBER_WORDS.noStamped
          )}
        </span>
        {said?.words ? (
          <span data-lien-serve-doc-said={said.tone} role={said.tone === 'ok' ? 'status' : 'alert'} style={{ flexBasis: '100%', fontWeight: 600, color: SAID_COLOR[said.tone] }}>
            {said.words}{' '}
            {said.anyway ? (
              <button type="button" data-lien-serve-doc-anyway onMouseDown={(e) => e.preventDefault()} onClick={() => void keepNumber(job, typed[id] ?? '', true)} style={{ ...btn, padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                {LIEN_DOC_NUMBER_WORDS.anyway}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    )
  }

  let slot = -1
  const numberInput = (job: LienServeJob, copy: ServiceCopy, name: string, draft: ServiceCopyDraft) => {
    slot += 1
    const at = slot
    const key = `${job.filing.id}:${copy}`
    const otherKey = `${job.filing.id}:${copy === 'owner' ? 'original_contractor' : 'owner'}`
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
          onChange={(e) => setCopy(job, copy, { ...copyOf(job, copy), tracking: e.target.value })}
          onBlur={() => void keepCopy(job, copy, copyOf(job, copy))}
          onKeyDown={(e) => {
            // A scanner ends its number with Enter: the next envelope takes the next scan.
            if (e.key !== 'Enter') return
            e.preventDefault()
            const next = numberRefs.current[at + 1]
            if (next) next.focus()
            else (e.target as HTMLInputElement).blur()
          }}
          placeholder={LIEN_SERVE_NUMBERS_WORDS.numberPlaceholder}
          aria-label={`Job ${job.jobNumber}, ${TO[copy].toLowerCase()}, certified mail number`}
          autoComplete="off"
          style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }}
        />
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', minWidth: 0 }}>
          <LienReceiptPhotoPress
            jobId={job.jobId}
            jobNumber={job.jobNumber}
            of={copy}
            day={dayOf(job) || servedOn}
            url={draft.receiptUrl}
            compact={!isMobile}
            label={LIEN_SERVE_NUMBERS_WORDS.addReceipt}
            savedWords={LIEN_SERVE_NUMBERS_WORDS.receiptSaved}
            doubt={(file) => lienReceiptDoubt(file, { recordingNumber: numberOf(job), other: picked.current[otherKey] ?? null })}
            onPicked={(file) => {
              picked.current[key] = file
            }}
            onRead={(tracking) => readNumber(job, copy, tracking)}
            onSaved={(url) => setReceipt(job, copy, url)}
            onTakeOff={() => {
              delete picked.current[key]
              return setReceipt(job, copy, '')
            }}
          />
          {!draft.receiptUrl ? <span style={small}>{LIEN_SERVE_NUMBERS_WORDS.receiptHint}</span> : null}
          {kept[key] === '' ? (
            <span data-lien-serve-kept={copy} role="status" style={{ ...small, color: 'var(--text-green-800)', fontWeight: 600 }}>{LIEN_RECEIPT_WORDS.kept}</span>
          ) : kept[key] ? (
            <span data-lien-serve-not-kept={copy} role="alert" style={{ ...small, color: 'var(--text-red-700)', fontWeight: 600 }}>{kept[key]}</span>
          ) : null}
        </div>
      </div>
    )
  }

  const card = (r: Row) => {
    const d = draftOf(r.job)
    const id = r.job.filing.id
    const said = mailedSaid[id]
    // A held lien's envelopes are not known to the plan: the paper's own two readers are asked for.
    const envelopes: Array<{ recipient: ServiceCopy; name: string }> = r.envelopes.length > 0 ? r.envelopes : [{ recipient: 'owner', name: r.job.to?.owner?.name ?? '' }, ...(d.contractor ? [{ recipient: 'original_contractor' as const, name: r.job.to?.contractor?.name ?? '' }] : [])]
    const holdsProof = [d.owner, d.contractor].some((c) => c != null && (c.tracking.trim() !== '' || c.receiptUrl.trim() !== ''))
    const day = dayOf(r.job)
    return (
      <div key={id} data-lien-serve-row={r.job.jobNumber} data-lien-serve-job={r.job.jobId} data-lien-serve-mailed={d.mailed ? 'yes' : 'no'} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{r.job.jobLabel}</span>
          {d.mailed && day ? <span style={chipStyle(false, false)}>mailed {formatYmdMonthDay(day)}</span> : r.clock?.chip ? <span style={chipStyle(r.clock.late, r.clock.daysLeft === 0)}>{r.clock.chip}</span> : null}
          <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', justifyContent: 'flex-end' }}>
            {said?.words ? (
              <span data-lien-serve-mailed-said={said.tone} role={said.tone === 'ok' ? 'status' : 'alert'} style={{ fontSize: '0.75rem', fontWeight: 600, color: SAID_COLOR[said.tone] }}>
                {said.words}
              </span>
            ) : null}
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, cursor: marking[id] ? 'wait' : 'pointer', ...(isMobile ? { minHeight: 44 } : {}) }}>
              <input type="checkbox" checked={d.mailed} disabled={Boolean(marking[id])} onChange={(e) => void tick(r.job, e.target.checked, true)} aria-label={`Job ${r.job.jobNumber}, mailed`} />
              {LIEN_SERVE_NUMBERS_WORDS.mailed}
            </label>
          </span>
        </div>
        {numberLine(r.job)}
        {envelopes.map((e) => numberInput(r.job, e.recipient, e.name, e.recipient === 'owner' ? d.owner : (d.contractor ?? { tracking: '', receiptUrl: '' })))}
        {!d.mailed && holdsProof ? (
          <div data-lien-serve-tick-when style={{ ...small, marginTop: '0.2rem' }}>
            {LIEN_SERVE_NUMBERS_WORDS.tickWhen}
          </div>
        ) : null}
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
        if (e.target === e.currentTarget) onClose()
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
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.25rem 0.6rem', ...(isMobile ? { minHeight: 44, minWidth: 44 } : {}) }}>
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
                {plan.held.map((h) => {
                  // A lien held for its number alone takes it on its own card below: no trip to another window.
                  const numberOnly = h.holds.every((x) => x.key === 'no_recording_number')
                  return (
                    <li key={h.job.filing.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem 0.55rem' }}>
                      <span style={{ fontWeight: 700 }}>{h.job.jobLabel}</span>
                      <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>{h.holds.map((x) => x.words).join(', ')}.</span>
                      <span style={{ color: 'var(--text-muted)' }}>{[...new Set(h.holds.map((x) => x.act))].join(' ')}</span>
                      {numberOnly ? (
                        <button type="button" data-lien-serve-held-number onClick={() => scopeRef.current?.querySelector<HTMLInputElement>(`[data-lien-doc-input="${h.job.filing.id}"]`)?.focus()} style={{ ...btn, marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                          Type it on its card ›
                        </button>
                      ) : (
                        <button type="button" onClick={() => onOpenJob(h.job.jobId)} style={{ ...btn, marginLeft: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                          Open the Lien window
                        </button>
                      )}
                    </li>
                  )
                })}
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
            <label style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600 }}>
              {LIEN_SERVE_NUMBERS_WORDS.day}
              <input type="date" value={servedOn} onChange={(e) => setServedOn(e.target.value)} aria-label={LIEN_SERVE_NUMBERS_WORDS.day} style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }} />
              <span style={{ ...small, fontWeight: 400 }}>{LIEN_SERVE_NUMBERS_WORDS.dayHint}</span>
            </label>
            <div style={small}>{LIEN_SERVE_NUMBERS_WORDS.hint}</div>
            {allRows.length > 0 ? (
              <div data-lien-serve-kept-lead style={{ fontSize: '0.78rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                <strong>{LIEN_RECEIPT_WORDS.keptLead}</strong> {LIEN_RECEIPT_WORDS.keptRest}
              </div>
            ) : null}
            {rows.owing.map(card)}
            {rows.under.length > 0 ? (
              <>
                <h3 data-lien-serve-mailed-head style={{ ...head, marginTop: '0.4rem' }}>
                  {LIEN_SERVE_NUMBERS_WORDS.mailedHead}
                </h3>
                <div style={small}>{LIEN_SERVE_NUMBERS_WORDS.mailedWhy}</div>
                {rows.under.map(card)}
              </>
            ) : null}
          </section>

          {/* The clerk's stamped scans for several liens at once (punch list #366): its own window, since a scan is the filing's saved copy and not part of the mailing. */}
          {onAddScans ? (
            <section data-lien-serve-scans-part style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start' }}>
              <h3 style={head}>3 · The clerk’s stamped scans</h3>
              <button type="button" onClick={onAddScans} data-lien-serve-add-scans style={{ ...btn, ...(isMobile ? { minHeight: 44 } : {}) }}>
                {LIEN_SCAN_BATCH_WORDS.door}
              </button>
              <div style={small}>{LIEN_SCAN_BATCH_WORDS.where}</div>
            </section>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          {allRows.length > 0 ? (
            <span data-lien-serve-foot style={{ ...small, marginRight: 'auto' }}>
              {LIEN_SERVE_NUMBERS_WORDS.foot}
            </span>
          ) : null}
          <button type="button" onClick={onClose} data-lien-serve-close style={{ ...btn, ...(isMobile ? { minHeight: 44 } : {}) }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
