/**
 * The Hours statement window (punch list #212, PR 2, v2.6097; the signing PR 3, v2.6411): one worker's recorded hours
 * on one job for a period, as the paper they sign, read live from the clock and the pay reports. Opened from the job
 * window's Documents tab (who: the people who clocked here) or from the person's desk (the job instead). Two switches:
 * *Show the rate, the amount and what was paid* (on for whoever sees the window: a dev and the controller, Diane's call of 2026-11-02)
 * and *Add days the app did not record* (the stated block, call 5). A line says what the app has in the span and a held
 * line names a session still waiting for approval, which the paper says under its day instead of counting. The preview
 * is the paper itself. A sub on the job's sheets is in the Who list too (v2.6636, `kind: 'sheet'`): their paper reads the
 * sheets' lines through `hoursStatementSheets.ts`, always on the paid basis, since a sheet is agreed work.
 *
 * Presses: **Save a draft** writes the `hours_statements` row with the read as its snapshot and mints the record id
 * (`HS-<job>-<n>`); **Print** saves the same way (a draft becomes printed), stamps the record id on the paper and files
 * nothing — the paper is signed with a pen. **Send for signature…** saves, draws the statement as its own Contract Form
 * (`hours-statement-signing`) and opens the channel sheet: the link by email, by text, copied, or **Hand the phone to
 * <name>** on this device; **Sign here now** is the last of those in one press; **File a signed scan…** is the paper
 * path, the pen-signed paper filed with the days the worker wrote. A sent statement is a record that can be sent again;
 * a signed one opens its PDF through `open-contract-form-pdf`'s gate. The kernel and the print are PR 1's.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatDenverDateTimeShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { hoursStatementGap, hoursStatementLongDate } from '../../lib/people/hoursStatement'
import { listHoursStatementJobs, listHoursStatementPeople, loadHoursStatementInputs, type HoursStatementJob, type HoursStatementPerson, type HoursStatementRead } from '../../lib/people/hoursStatementRead'
import { hoursStatementPayAllowed, type HoursStatementMaker } from '../../lib/people/hoursStatementAccess'
import { hoursStatementSavedWords, hoursStatementSpanWords } from '../../lib/people/hoursStatementWindow'
import { hoursStatementIsOpen, hoursStatementStateAfterPrint, type HoursStatementState } from '../../lib/people/hoursStatementRecord'
import { saveHoursStatement, type HoursStatementRecordRow, type HoursStatementSnapshot } from '../../lib/people/hoursStatementsIo'
import { buildHoursStatementPaper, printHoursStatementPaper } from '../../lib/people/hoursStatementPrint'
import {
  HOURS_STATEMENT_OPEN_WORDS,
  HOURS_STATEMENT_SENT_WORDS,
  HOURS_STATEMENT_SIGNED_WORDS,
  hoursStatementSentWords,
  hoursStatementTextBody,
  inPersonUrl,
  smsHref,
  type HoursStatementChannel,
  type ScanStatedRow,
} from '../../lib/people/hoursStatementSigning'
import { fileToBase64, supabaseHoursStatementSigningIo, type HoursStatementSigningIo } from '../../lib/people/hoursStatementSigningIo'
import { HoursStatementSendSheet, type HoursStatementContact } from './HoursStatementSendSheet'
import { HoursStatementScanSheet, type ScanSheetDraft } from './HoursStatementScanSheet'
import { UnchargedCallout } from '../charges/UnchargedCallout'
import { officeNotes } from '../../lib/charges/crewDays'

/** Where the window was opened from: a job (pick who) or a person (pick the job). */
export type HoursStatementScope =
  | { kind: 'job'; job: { id: string; number: string; name: string; customer: string | null; site: string } }
  | { kind: 'person'; userId: string; name: string }

export type HoursStatementModalProps = {
  open: boolean
  onClose: () => void
  scope: HoursStatementScope
  /** The viewer: whether the pay switch is theirs. */
  maker: HoursStatementMaker
  /** A saved statement to open on: its who, span and switches fill in, and Save and Print keep its record id. */
  existing?: HoursStatementRecordRow | null
  /** On a job, the worker to pick first (the Legal desk's Ask…, v2.6413); the first who clocked here otherwise. */
  initialUserId?: string | null
  /** Above the job window (1010) by default; the person's desk passes its editor layer. */
  zIndex?: number
  onSaved?: (row: HoursStatementRecordRow) => void
  /** The signing's calls; the smoke hands a fake. */
  signingIo?: HoursStatementSigningIo
}

const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.875rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', width: '100%', boxSizing: 'border-box' }
const label: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }
const toggle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-base)', cursor: 'pointer' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontWeight: 600 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const btnDead: CSSProperties = { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }

type Sheet = 'send' | 'scan' | null

export function HoursStatementModal({ open, onClose, scope, maker, existing = null, initialUserId = null, zIndex = 1030, onSaved, signingIo = supabaseHoursStatementSigningIo }: HoursStatementModalProps) {
  const { user, profileName, role } = useAuth()
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const narrow = useMatchMedia('(max-width: 860px)')
  const titleId = useId()
  useBodyScrollLock(open)
  const payAllowed = hoursStatementPayAllowed(maker)

  const [people, setPeople] = useState<HoursStatementPerson[] | null>(null)
  const [jobs, setJobs] = useState<HoursStatementJob[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  // The pick: the worker's login on a job, the job on a person.
  const [pick, setPick] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [withPay, setWithPay] = useState(payAllowed)
  // Punch list #251: the charged paper — the person's days as the crew-days they were part of, at the rate card or the
  // job's rule, nothing on it what the worker was paid. Open to every maker; the pay switch is ignored while it is on.
  const [charged, setCharged] = useState(false)
  const [stated, setStated] = useState(false)
  const [read, setRead] = useState<{ read: HoursStatementRead; asOf: string } | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [row, setRow] = useState<HoursStatementRecordRow | null>(existing)
  const [busy, setBusy] = useState<'save' | 'print' | 'sign' | 'scan' | 'pdf' | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [contact, setContact] = useState<HoursStatementContact | null>(null)
  const [signing, setSigning] = useState<HoursStatementChannel | null>(null)
  const token = useRef(0)

  const scopeKey = scope.kind === 'job' ? `job:${scope.job.id}` : `person:${scope.userId}`
  const existingId = existing?.id ?? null

  // On open: who clocked here (or the jobs the person clocked on), the first picked with their span filled in, or
  // the saved statement's own who, span and switches.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRow(existing)
    setWithPay(existing ? existing.with_pay && payAllowed : payAllowed)
    setCharged(existing?.basis === 'charged')
    setStated(existing ? existing.stated_days.length > 0 || existing.snapshot?.input.addStatedBlock === true : false)
    setRead(null)
    setReadError(null)
    setListError(null)
    setPeople(null)
    setJobs(null)
    setSheet(null)
    setContact(null)
    void (async () => {
      try {
        if (scope.kind === 'job') {
          const list = await listHoursStatementPeople(scope.job.id)
          if (cancelled) return
          setPeople(list)
          const first = existing ? (list.find((p) => p.userId === existing.user_id) ?? null) : ((initialUserId ? list.find((p) => p.userId === initialUserId) : null) ?? list[0] ?? null)
          setPick(existing?.user_id ?? first?.userId ?? '')
          setFrom(existing?.period_start ?? first?.firstDay ?? '')
          setTo(existing?.period_end ?? first?.lastDay ?? '')
        } else {
          const list = await listHoursStatementJobs(scope.userId)
          if (cancelled) return
          setJobs(list)
          const first = existing ? (list.find((j) => j.jobId === existing.job_ledger_id) ?? null) : (list[0] ?? null)
          setPick(existing?.job_ledger_id ?? first?.jobId ?? '')
          setFrom(existing?.period_start ?? first?.firstDay ?? '')
          setTo(existing?.period_end ?? first?.lastDay ?? '')
        }
      } catch (e: unknown) {
        if (!cancelled) setListError(formatErrorMessage(e, scope.kind === 'job' ? 'The people who clocked here could not be read.' : 'The jobs could not be read.'))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the open, the scope and the saved row decide; the rest is read inside
  }, [open, scopeKey, existingId, payAllowed, initialUserId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const userId = scope.kind === 'job' ? pick : scope.userId
  const jobId = scope.kind === 'job' ? scope.job.id : pick
  const pickedJob = useMemo(() => (scope.kind === 'person' ? (jobs?.find((j) => j.jobId === pick) ?? null) : null), [scope.kind, jobs, pick])
  // Where the rows come from (v2.6636): a sub's sheets when the pick is one, the clock otherwise; a saved row keeps its kind.
  const pickedSource: 'clock' | 'sheet' = (scope.kind === 'job' ? people?.find((p) => p.userId === pick)?.kind : pickedJob?.kind) ?? (existing?.kind === 'sheet' ? 'sheet' : 'clock')
  const isSheet = pickedSource === 'sheet'
  // The job's facts on the paper: the scope's job, the picked job, or the saved statement's own.
  const jobFacts = useMemo(() => {
    if (scope.kind === 'job') return scope.job
    if (pickedJob) return { id: pickedJob.jobId, number: pickedJob.number, name: pickedJob.name, customer: pickedJob.customer, site: pickedJob.site }
    if (existing?.snapshot && existing.job_ledger_id === pick) return { id: existing.job_ledger_id, ...existing.snapshot.job }
    return null
  }, [scope, pickedJob, existing, pick])

  // The read, a moment after the last change, dropping any answer that is no longer the newest ask.
  const spanOk = Boolean(open && userId && jobId && from && to && from <= to)
  useEffect(() => {
    if (!spanOk) {
      setRead(null)
      setReading(false)
      return
    }
    const mine = token.current + 1
    token.current = mine
    setReading(true)
    setReadError(null)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await loadHoursStatementInputs({ jobId, userId, periodStart: from, periodEnd: to, withPay: (isSheet || !charged) && withPay && payAllowed, basis: charged && !isSheet ? 'charged' : 'paid', addStatedBlock: stated, kind: isSheet ? 'sheet' : 'clock' })
          if (token.current !== mine) return
          setRead({ read: r, asOf: formatDenverDateTimeShort(Date.now()) })
        } catch (e: unknown) {
          if (token.current === mine) setReadError(formatErrorMessage(e, 'The clock and the pay reports could not be read.'))
        } finally {
          if (token.current === mine) setReading(false)
        }
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [spanOk, jobId, userId, from, to, withPay, payAllowed, stated, charged, isSheet])

  const snapshot = useMemo<HoursStatementSnapshot | null>(() => {
    if (!read || !jobFacts) return null
    return {
      input: read.read.input,
      worker: read.read.worker,
      job: { number: jobFacts.number, name: jobFacts.name, customer: jobFacts.customer, site: jobFacts.site, isOfficeJob: read.read.isOfficeJob },
      approvedBy: read.read.approvedBy,
      preparedBy: (profileName ?? '').trim() || 'the office',
      preparedOn: hoursStatementLongDate(todayYmdInAppTz()),
      asOf: read.asOf,
    }
  }, [read, jobFacts, profileName])
  // A sent or signed statement is a record: its paper is its snapshot's, never the live read's.
  const paperSnapshot = row && !hoursStatementIsOpen(row.state) && row.snapshot?.job ? row.snapshot : snapshot
  const html = useMemo(() => (paperSnapshot ? buildHoursStatementPaper(paperSnapshot, row?.record_id ?? null) : null), [paperSnapshot, row?.record_id])
  const span = read ? hoursStatementSpanWords(read.read.counts, { isOfficeJob: read.read.isOfficeJob }) : null
  const rowOpen = row == null || hoursStatementIsOpen(row.state)
  const signed = row?.state === 'signed'
  const workerName = row?.snapshot?.worker.name ?? row?.worker?.name ?? read?.read.worker.name ?? (scope.kind === 'person' ? scope.name : '')
  const jobLabel = jobFacts ? `${jobFacts.number} · ${jobFacts.name}` : row?.snapshot ? `${row.snapshot.job.number} · ${row.snapshot.job.name}` : ''

  const save = useCallback(
    async (state: HoursStatementState): Promise<HoursStatementRecordRow | null> => {
      if (!snapshot || !read || !jobFacts || !userId) return null
      const saved = await saveHoursStatement({
        id: row?.id ?? null,
        jobId: jobFacts.id,
        jobNumber: jobFacts.number,
        userId,
        personId: read.read.personId,
        laborCompany: null,
        periodStart: from,
        periodEnd: to,
        withPay: snapshot.input.withPay,
        basis: snapshot.input.basis === 'charged' ? 'charged' : 'paid',
        chargeRate: read.read.charge?.rate ?? null,
        chargeWords: read.read.charge?.words ?? null,
        kind: snapshot.input.kind,
        statedDays: snapshot.input.statedDays ?? [],
        gap: hoursStatementGap(from, to, snapshot.input.firstRecordedDay),
        snapshot,
        state,
        preparedBy: user?.id ?? null,
      })
      setRow(saved)
      onSaved?.(saved)
      return saved
    },
    [snapshot, read, jobFacts, userId, row?.id, from, to, user?.id, onSaved],
  )

  /** The saved row the signing works on: a record as it stands, or the live read saved first so the paper is current. */
  const ensureSaved = useCallback(async (): Promise<HoursStatementRecordRow | null> => {
    if (row && !hoursStatementIsOpen(row.state)) return row
    if (!snapshot) return row
    return await save(row ? row.state : 'draft')
  }, [row, snapshot, save])

  const onSaveDraft = async () => {
    if (busy || !snapshot) return
    setBusy('save')
    try {
      const saved = await save(row ? row.state : 'draft')
      if (saved) showToast(hoursStatementSavedWords(saved.record_id, saved.state), 'success')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The statement was not saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  // Print saves first (a draft becomes printed) so the paper carries its record id; the window opens inside the press.
  const onPrint = () => {
    if (busy || !paperSnapshot) return
    const snap = paperSnapshot
    setBusy('print')
    let saveError: unknown = null
    void printHoursStatementPaper(async () => {
      try {
        if (row && !hoursStatementIsOpen(row.state)) return buildHoursStatementPaper(snap, row.record_id)
        const saved = await save(hoursStatementStateAfterPrint(row?.state ?? 'draft'))
        if (!saved) throw new Error('The statement was not saved.')
        return buildHoursStatementPaper(snap, saved.record_id)
      } catch (e: unknown) {
        saveError = e
        throw e
      }
    })
      .then((ok) => {
        if (saveError != null) showToast(formatErrorMessage(saveError, 'The statement was not saved.'), 'error')
        else if (!ok) showToast('The print window was blocked. Allow pop-ups for this site and press Print again.', 'error')
      })
      .finally(() => setBusy(null))
  }

  // Send for signature…: save, draw the statement as its form (the worker's contact comes back), and open the sheet.
  const openSendSheet = async () => {
    if (busy || signed) return
    setBusy('sign')
    try {
      const saved = await ensureSaved()
      if (!saved) throw new Error('The statement was not saved.')
      const prepared = await signingIo.prepare(saved.id, 'email')
      setContact({ email: prepared.worker.email ?? '', phone: prepared.worker.phone ?? '' })
      setSheet('send')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The statement could not be made ready to sign.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  /** One channel: the form drawn with how it goes, the link minted, handed on its way, the statement moved to sent. */
  const sendBy = async (channel: HoursStatementChannel, current: HoursStatementRecordRow, who: HoursStatementContact) => {
    const prepared = await signingIo.prepare(current.id, channel)
    const sent = await signingIo.send(prepared.documentId, { channel, email: who.email })
    if (channel === 'text') {
      window.location.href = smsHref(who.phone, hoursStatementTextBody({ recordId: current.record_id, jobLabel, url: sent.acceptUrl }))
    } else if (channel === 'link') {
      try {
        await navigator.clipboard.writeText(sent.acceptUrl)
      } catch {
        // The clipboard is closed to the app here: the link shows in a window to copy by hand.
        await promptDialog({ title: 'Copy the signing link', message: 'The app could not reach the clipboard. Select the link below and copy it.', defaultValue: sent.acceptUrl, confirmLabel: 'I copied it' })
      }
    } else if (channel === 'in_person') {
      const url = inPersonUrl(sent.acceptUrl)
      const opened = window.open(url, '_blank', 'noopener')
      if (!opened) await promptDialog({ title: 'Open the signing page', message: 'The window was blocked. Open this link on this device and hand it over.', defaultValue: url, confirmLabel: 'I opened it' })
    }
    const updated = await signingIo.markSent(current.id)
    setRow(updated)
    onSaved?.(updated)
    showToast(hoursStatementSentWords(channel, { recordId: current.record_id, workerName: prepared.worker.name, emailed: sent.emailed, emailError: sent.emailError }), channel === 'email' && !sent.emailed ? 'error' : 'success')
  }

  const onPickChannel = async (channel: HoursStatementChannel) => {
    if (signing || !row || !contact) return
    setSigning(channel)
    try {
      await sendBy(channel, row, contact)
      setSheet(null)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The statement was not sent.'), 'error')
    } finally {
      setSigning(null)
    }
  }

  // Sign here now: Hand the phone in one press, the sheet skipped.
  const onSignHereNow = async () => {
    if (busy || signed) return
    setBusy('sign')
    try {
      const saved = await ensureSaved()
      if (!saved) throw new Error('The statement was not saved.')
      await sendBy('in_person', saved, contact ?? { email: '', phone: '' })
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The signing page could not be opened.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const openScanSheet = async () => {
    if (busy || signed) return
    setBusy('scan')
    try {
      const saved = await ensureSaved()
      if (!saved) throw new Error('The statement was not saved.')
      setSheet('scan')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The statement was not saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const onFileScan = async (draft: ScanSheetDraft) => {
    if (busy || !row || !draft.file) return
    setBusy('scan')
    try {
      const base64 = await fileToBase64(draft.file)
      const statedDays = draft.rows.filter((r) => r.day.trim() || r.hours.trim() || r.note.trim()).map((r) => ({ day: r.day.trim(), hours: r.hours.trim() || null, note: r.note.trim() }))
      const filed = await signingIo.fileScan({ statementId: row.id, scan: { base64, mime: draft.file.type, filename: draft.file.name }, signedOnYmd: draft.signedOn, signerPrintedName: draft.printedName.trim(), statedDays })
      const updated: HoursStatementRecordRow = { ...row, state: 'signed', contract_document_id: filed.documentId, stated_days: statedDays.map((d) => ({ day: d.day, hours: d.hours == null ? null : Number(d.hours.replace(',', '.')), note: d.note, statedBy: `${draft.printedName.trim()}, ${draft.signedOn}` })) }
      setRow(updated)
      onSaved?.(updated)
      setSheet(null)
      showToast(`${row.record_id} filed as signed on paper.`, 'success')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The signed scan was not filed.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const onOpenSignedPdf = async () => {
    if (busy || !row?.contract_document_id) return
    setBusy('pdf')
    try {
      const url = await signingIo.openSignedPdf(row.contract_document_id)
      const opened = window.open(url, '_blank', 'noopener')
      if (!opened) await promptDialog({ title: 'Open the signed PDF', message: 'The window was blocked. Open this link; it works for five minutes.', defaultValue: url, confirmLabel: 'I opened it' })
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The signed PDF could not be opened.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null
  const title = scope.kind === 'job' ? `Hours statement · ${scope.job.number} · ${scope.job.name}` : `Hours statement · ${scope.name}`
  const canAct = Boolean(snapshot) && !reading && !busy && rowOpen
  // The signing presses: a paper to work on (the live read, or a record), nothing else in flight, not signed yet.
  const canSign = (Boolean(snapshot) || Boolean(row)) && !reading && !busy && !signed && sheet == null
  const listEmpty = scope.kind === 'job' ? people != null && people.length === 0 && !existing : jobs != null && jobs.length === 0 && !existing
  const statedRows: ScanStatedRow[] = (row?.stated_days ?? []).map((d) => ({ day: d.day, hours: d.hours == null ? '' : String(d.hours), note: d.note }))
  const paperHasStatedBlock = Boolean(row?.gap_from) || (row?.stated_days.length ?? 0) > 0 || row?.snapshot?.input.addStatedBlock === true || Boolean(snapshot && (snapshot.input.addStatedBlock || hoursStatementGap(snapshot.input.periodStart, snapshot.input.periodEnd, snapshot.input.firstRecordedDay)))
  const footerWords = signed ? HOURS_STATEMENT_SIGNED_WORDS : row && !rowOpen ? HOURS_STATEMENT_SENT_WORDS : HOURS_STATEMENT_OPEN_WORDS

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(2vh + var(--app-top-chrome, 0px)) 0.75rem 2vh', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="hours-statement-window"
        style={{ width: 'min(1180px, 100%)', maxHeight: 'min(96vh, 100%)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 18px 48px rgba(17,24,39,0.25)', color: 'var(--text-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '1.1rem', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '300px minmax(0, 1fr)', gap: '1rem', padding: '0.9rem 1rem', overflow: 'auto', minHeight: 0, flex: 1 }}>
          <div style={{ display: 'grid', gap: '0.7rem', alignContent: 'start' }}>
            {listError ? <p style={{ ...quiet, color: 'var(--text-red-600)' }}>{listError}</p> : null}
            {scope.kind === 'job' ? (
              <label style={label}>
                Who
                <select style={field} value={pick} onChange={(e) => {
                  setPick(e.target.value)
                  const p = people?.find((x) => x.userId === e.target.value)
                  if (p) {
                    setFrom(p.firstDay)
                    setTo(p.lastDay)
                  }
                }} aria-label="Who" disabled={people == null || Boolean(existing)}>
                  {people == null ? <option value="">Reading who clocked here…</option> : null}
                  {people?.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name} · {p.sessions} {p.kind === 'sheet' ? (p.sessions === 1 ? 'sheet' : 'sheets') : p.sessions === 1 ? 'session' : 'sessions'}
                    </option>
                  ))}
                  {existing && people != null && !people.some((p) => p.userId === existing.user_id) ? <option value={existing.user_id}>{existing.worker?.name ?? 'The worker'}</option> : null}
                </select>
              </label>
            ) : (
              <label style={label}>
                Job
                <select style={field} value={pick} onChange={(e) => {
                  setPick(e.target.value)
                  const j = jobs?.find((x) => x.jobId === e.target.value)
                  if (j) {
                    setFrom(j.firstDay)
                    setTo(j.lastDay)
                  }
                }} aria-label="Job" disabled={jobs == null || Boolean(existing)}>
                  {jobs == null ? <option value="">Reading the jobs…</option> : null}
                  {jobs?.map((j) => (
                    <option key={j.jobId} value={j.jobId}>
                      {j.number} · {j.name} · {j.sessions} {j.kind === 'sheet' ? (j.sessions === 1 ? 'sheet' : 'sheets') : j.sessions === 1 ? 'session' : 'sessions'}
                    </option>
                  ))}
                  {existing && jobs != null && !jobs.some((j) => j.jobId === existing.job_ledger_id) ? <option value={existing.job_ledger_id}>{existing.snapshot?.job.number ?? ''} · {existing.snapshot?.job.name ?? 'The job'}</option> : null}
                </select>
              </label>
            )}
            {listEmpty ? <p style={quiet}>{scope.kind === 'job' ? 'Nothing is clocked on this job yet. A statement needs at least one counted session here.' : `${scope.name} has no counted session on a job yet.`}</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label style={label}>
                From
                <input type="date" style={field} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" disabled={!rowOpen} />
              </label>
              <label style={label}>
                To
                <input type="date" style={field} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" disabled={!rowOpen} />
              </label>
            </div>
            {from && to && from > to ? <p style={{ ...quiet, color: 'var(--text-red-600)' }}>From is after To. Pick a span that starts first.</p> : null}
            <label style={toggle}>
              <input type="checkbox" checked={charged && !isSheet} disabled={!rowOpen || isSheet} onChange={(e) => setCharged(e.target.checked)} style={{ marginTop: 3 }} data-testid="hours-statement-charged" />
              <span>
                Charged to the customer, not paid to the worker
                {isSheet ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="hours-statement-sheet-note">A sub’s sheet is agreed work, so the paper reads the sheet’s lines as paid.</span> : <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Each day as the crew it was part of, at the rate card or the job’s rule. Nothing on the paper is what the worker was paid.</span>}
                {charged && read?.read.charge ? (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-base)' }} data-testid="hours-statement-charge-words">
                    {read.read.charge.words}
                    {(() => {
                      // The office reads who counts as nobody in the note below, so the paper's neutral line is not repeated here.
                      const whys = officeNotes(read.read.charge.unpriced, read.read.charge.uncharged)
                      return whys.length ? ` · ${whys.join(' ')}` : ''
                    })()}
                    {read.read.charge.uncharged.length ? null : <span style={{ display: 'block', color: 'var(--text-muted)' }}>Change the job’s rule or the rate card in the Job Summary’s Charges window.</span>}
                  </span>
                ) : null}
              </span>
            </label>
            {charged && read?.read.charge?.uncharged.length ? <UnchargedCallout people={read.read.charge.uncharged} unchargedDays={read.read.charge.unchargedDays} role={role} onNavigate={onClose} margin="0" /> : null}
            <label style={{ ...toggle, cursor: payAllowed && (!charged || isSheet) ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" checked={(isSheet || !charged) && withPay && payAllowed} disabled={!payAllowed || !rowOpen || (charged && !isSheet)} onChange={(e) => setWithPay(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Show the rate, the amount and what was paid
                {charged && !isSheet ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Off while the paper is charged to the customer.</span> : null}
              </span>
            </label>
            <label style={toggle}>
              <input type="checkbox" checked={stated} disabled={!rowOpen} onChange={(e) => setStated(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Add days the app did not record</span>
            </label>
            {readError ? <p style={{ ...quiet, color: 'var(--text-red-600)' }}>{readError}</p> : null}
            {span && rowOpen ? (
              <div data-testid="hours-statement-span" style={{ display: 'grid', gap: '0.25rem' }}>
                <p style={quiet}>{span.has}</p>
                {span.held ? <p style={{ ...quiet, color: 'var(--text-amber-800)', fontWeight: 600 }}>{span.held}</p> : null}
              </div>
            ) : null}
            {row ? <p data-testid="hours-statement-saved" style={{ ...quiet, color: 'var(--text-strong)', fontWeight: 600 }}>{hoursStatementSavedWords(row.record_id, row.state)}</p> : null}
            {row && !rowOpen ? <p style={quiet}>{signed ? HOURS_STATEMENT_SIGNED_WORDS : HOURS_STATEMENT_SENT_WORDS}</p> : null}
            {signed && (row?.stated_days.length ?? 0) > 0 ? <p style={quiet}>{row!.stated_days.length} {row!.stated_days.length === 1 ? 'day' : 'days'} stated by the worker on the signed copy.</p> : null}
          </div>

          <div style={{ minHeight: narrow ? 520 : 620, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            {html ? (
              <iframe title="The paper" data-testid="hours-statement-paper" srcDoc={html} sandbox="" style={{ flex: 1, width: '100%', minHeight: narrow ? 520 : 620, border: 0 }} />
            ) : (
              <p style={{ ...quiet, padding: '1rem' }}>{reading ? 'Reading the clock and the pay reports…' : spanOk ? 'The paper draws here.' : 'Pick who and a span, and the paper draws here.'}</p>
            )}
            {html && reading && rowOpen ? <div style={{ position: 'absolute', top: 8, right: 8, padding: '0.25rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Reading…</div> : null}
          </div>
        </div>

        {sheet === 'send' && row ? <HoursStatementSendSheet workerName={workerName} contact={contact} onContactChange={setContact} busy={signing} onPick={(c) => void onPickChannel(c)} onCancel={() => setSheet(null)} /> : null}
        {sheet === 'scan' && row ? <HoursStatementScanSheet workerName={workerName} todayYmd={todayYmdInAppTz()} initialRows={statedRows} showStatedRows={paperHasStatedBlock} busy={busy === 'scan'} onFile={(d) => void onFileScan(d)} onCancel={() => setSheet(null)} /> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
          <button type="button" style={paperSnapshot && !busy ? btn : btnDead} disabled={!paperSnapshot || Boolean(busy)} onClick={onPrint}>
            {busy === 'print' ? 'Printing…' : 'Print'}
          </button>
          {rowOpen ? (
            <button type="button" style={canAct ? btnPrimary : btnDead} disabled={!canAct} onClick={() => void onSaveDraft()}>
              {busy === 'save' ? 'Saving…' : row ? 'Save' : 'Save a draft'}
            </button>
          ) : null}
          {!signed ? (
            <>
              <button type="button" style={canSign ? btn : btnDead} disabled={!canSign} onClick={() => void openSendSheet()}>
                {busy === 'sign' && sheet == null ? 'Getting it ready…' : 'Send for signature…'}
              </button>
              <button type="button" style={canSign ? btn : btnDead} disabled={!canSign} onClick={() => void onSignHereNow()}>
                Sign here now
              </button>
              <button type="button" style={canSign ? btn : btnDead} disabled={!canSign} onClick={() => void openScanSheet()}>
                File a signed scan…
              </button>
            </>
          ) : (
            <button type="button" style={row?.contract_document_id && !busy ? btnPrimary : btnDead} disabled={!row?.contract_document_id || Boolean(busy)} onClick={() => void onOpenSignedPdf()}>
              {busy === 'pdf' ? 'Opening…' : 'Open the signed PDF'}
            </button>
          )}
          <span style={{ ...quiet, flexBasis: '100%' }}>{footerWords}</span>
        </div>
      </div>
    </div>
  )
}

export default HoursStatementModal
