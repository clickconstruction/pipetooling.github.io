import { useEffect, useMemo, useRef, useState } from 'react'
import { LienJobHeading } from './LienJobNumber'
import { createPortal } from 'react-dom'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienRetainageNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { holdUntilFor, isLienLeader, isLienOffice, submitOutcome } from '../../lib/jobs/lienDesk'
import { contractEndedWords, parseContractEndedHow, parsePaymentBond, paymentBondWords, type LienContractEndedHow, type LienRetainageEntry } from '../../lib/jobs/lienDeskRetainage'
import { useJobRetainage } from '../../hooks/useJobRetainage'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useLienPaneHeads } from './useLienPaneHeads'
import { lienRetainagePaneSections, lienRetainageWindowWords } from '../../lib/jobs/lienAffidavitPaneSections'
import { retainageReleaseWords, retainageSourceWords } from '../../lib/ar/retainageHeld'
import { holdLienDeskItem, pullBackLienDeskItem, saveLienDeskDraft, sendLienDeskItemOnWord, submitLienDeskItem, tellLeaderOfLienApproval } from '../../lib/jobs/lienDeskIo'
import { lienNoticeToldWords } from '../../lib/jobs/lienLeaderTold'
import { signLienDeskItem } from '../../lib/jobs/lienDeskSignIo'
import { defaultWordNote, wordRecordPreview, wordRecordWords, type LienWordChannel } from '../../lib/jobs/lienWord'
import { lienLeaderPressWords } from '../../lib/jobs/lienLeaderPress'
import { lienFooter } from '../../lib/jobs/lienFooterMenu'
import { LienFootMenu } from './LienFootMenu'
import { LienWordRecordRow } from './LienWordRecordRow'
import { buildLienRetainageNoticeFieldsForJob, homesteadStatementApplies, lienRetainageCoverLetter } from '../../lib/jobs/lienNoticeDraft'
import { coverLetterKindFor } from '../../lib/jobs/gcOnNotice'
import { runCoverNoteBlocks } from '../../lib/jobs/lienDeskRun'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'
import { LIEN_RUN_ACT, LIEN_RUN_NOW_TO_MAIL } from '../../lib/jobs/lienRunWords'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { lienDayValues } from '../../lib/jobs/lienDayValues'
import {
  LIEN_CONTRACT_NOT_SAVED_WORDS,
  LIEN_CONTRACT_NO_DAY_WORDS,
  LIEN_CONTRACT_STATE_CHOICES,
  LIEN_CONTRACT_STILL_OPEN,
  LIEN_CONTRACT_STILL_OPEN_PATCH,
  LIEN_CONTRACT_STILL_OPEN_SAVED_WORDS,
  LIEN_PAYMENT_BOND_CHOICES,
  LIEN_RETAINAGE_FROM_APPLICATION,
  LIEN_RETAINAGE_HELD_HINT,
  LIEN_RETAINAGE_VALUE_LABELS,
  lienContractDayPreview,
  lienContractEndedAsk,
  lienContractEndedPatch,
  lienContractEndedSavedWords,
  lienContractStartHint,
  lienContractStateText,
  lienContractStillOpenAsk,
  lienPaymentBondPatch,
  lienPaymentBondSavedWords,
  lienPaymentBondText,
  lienRetainageHeldPatch,
  lienRetainageHeldPreview,
  lienRetainageHeldSavedWords,
  lienRetainageHeldText,
  lienRetainageHeldValue,
  retainageDeadlineValues,
  type LienContractPatch,
} from '../../lib/jobs/lienRetainageFacts'
import { saveLienContractFacts } from '../../lib/jobs/lienRetainageFactsIo'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * The retainage pane of the Lien desk (v2.3753, punch list #33 PR 1): the
 * § 53.057 notice of claim for unpaid retainage — its gate (owner of record,
 * the GC, the day our contract on the job ended, the retainage the GC holds),
 * whether a recorded § 53.056 notice already named the retainage (the trap
 * that works now — § 53.081(c) makes a retainage-only notice wait for the
 * affidavit), the paper as the run prints it (the retainage cover letter in counsel's form,
 * then the statute's form), and the same draft → approve → send verbs as the
 * monthly notice. Approved ones ride in the desk's run.
 *
 * Values in place (punch list #399, the Lien desk's second screen): every day, amount and name on the pane is drawn
 * apart from its words, one fact a line. The three facts a person types — the day our contract ended with how it
 * ended, the retainage the GC holds, the payment bond — are changed where they sit (`lienRetainageFacts.ts`), where
 * *Change ›* and *Set on the job ›* used to open Edit Job. A change to the day asks first, because it moves the
 * § 53.057 deadline.
 */

const chip = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle' })
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'primary' ? '#2563eb' : kind === 'green' ? '#166534' : kind === 'amber' ? '#92400e' : 'var(--surface)',
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})

/** A day or an amount the app works out, never broken across two lines. `tone` is for a day inside a red sentence. */
const worked = (text: string, tone?: 'red') => (
  <WorkedOutValue tone={tone}>
    <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
  </WorkedOutValue>
)
/** A value inside a toned chip keeps the chip's colour. */
const inChip = (text: string) => <b style={{ fontWeight: 700, whiteSpace: 'nowrap' }} data-value="worked-out">{text}</b>

export default function LienDeskRetainagePane({
  entry,
  data,
  todayYmd,
  authRole,
  authUserId,
  authName = '',
  issuer,
  signerNameFor,
  leaderNameFor,
  signerPhoneFor,
  onChanged,
  onOpenEditJob,
  onOpenJob,
  onOpenRun,
  onShowNotices,
  footerEl,
}: {
  entry: LienRetainageEntry
  data: LienDeskData
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  /** The signed-in person's name — who made a record on the leader's word (v2.3813). */
  authName?: string
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  /** The job's master by his plain name (v2.4856): the word row and the record say *on Malachi's word*; absent, *the leader*. */
  leaderNameFor?: (masterUserId: string | null) => string
  /** The signing master's own phone (v2.3844) for the letter's call line; the letterhead's when absent. */
  signerPhoneFor?: (masterUserId: string | null) => string
  onChanged: () => void
  /** Edit Job — on its Property record row (the owner), or on *Our contract on this job* (the clock, the retainage). */
  onOpenEditJob: (jobId: string, focus: 'property-record' | 'lien-contract') => void
  /** The heading's job number opens the job itself (v2.4535). */
  onOpenJob?: (jobId: string) => void
  /** The desk's run — approved retainage notices go out with the monthly ones. */
  onOpenRun: () => void
  /** Switch the desk to the notices kind on this job — where the retainage rides inside the § 53.056 claim. */
  onShowNotices: (jobId: string) => void
  /** The desk's footer strip — the pane portals its footer there (v2.3753). */
  footerEl: HTMLElement | null
}) {
  const { showToast } = useToastContext()
  const leader = isLienLeader(authRole)
  const office = isLienOffice(authRole)
  const [busy, setBusy] = useState(false)
  // Punch list #165 (PR 4): the figure's source and, once a release exists, the door to it.
  const { retainage: jobRetainage, loading: retainageLoading, reload: reloadRetainage } = useJobRetainage(entry.jobId)
  const confirmDialog = useConfirmDialog()
  // Starting the clock is two facts, how our contract ended and its day. The way is picked first and held here, unsaved, until its day is kept.
  const [startHow, setStartHow] = useState<LienContractEndedHow | null>(null)
  // Each count opens a field again: the day's after a way is picked, the way's after the footer's press.
  const [dayAsk, setDayAsk] = useState(0)
  const [howAsk, setHowAsk] = useState(0)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<LienWordChannel>('phone')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)

  const job = data.jobsById[entry.jobId]
  const gc = entry.gcCustomerId ? data.gcsById[entry.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, data.ownerByJob[entry.jobId] ?? null), [address, data.ownerByJob, entry.jobId])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const promise = data.promisesByJob[entry.jobId] ?? null
  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
  const label = job ? `${jobNumber}${(job.job_name ?? '').trim() ? ` · ${(job.job_name ?? '').trim()}` : ''}` : entry.jobId.slice(0, 8)
  // The job's master by name (v2.4856): the word row and the record say *on Malachi's word*.
  const leaderName = leaderNameFor?.(job?.master_user_id ?? null) ?? ''
  const press = lienLeaderPressWords(leaderName, 'retainage')
  const item = entry.item && entry.item.status !== 'sent' && entry.item.status !== 'missed' ? entry.item : null
  const endedWords = contractEndedWords(entry.contractEndedHow, entry.contractEndedOn, formatYmdMonthDay)

  const fields = useMemo(
    () =>
      buildLienRetainageNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        retainageHeld: entry.retainageHeld,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        homesteadStatement: homesteadStatementApplies(property),
        serviceTypeName: job?.service_type?.name,
      }),
    [job, gc, entry.retainageHeld, signerNameFor, issuer, todayYmd, property],
  )
  const extras = useMemo(
    () => ({ letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${jobNumber}`, entry.contractEndedOn ? `Our contract ${entry.contractEndedHow ?? 'ended'} ${demandDate(entry.contractEndedOn)}` : '', demandDate(todayYmd)].filter(Boolean) }),
    [issuer, jobNumber, entry.contractEndedOn, entry.contractEndedHow, todayYmd],
  )
  const coverHtml = useMemo(
    () => filingDocHtml(runCoverNoteBlocks({ kind: 'retainage_53_057', label, months: [], fields, extras, coverNote: null, coverLetter: lienRetainageCoverLetter({ claimantName: fields.claimantName, gcName: gc?.name ?? fields.originalContractorName, property: (job?.job_address ?? '').trim(), amount: demandMoney(fields.claimAmount), inClaim: entry.inClaim, endedHow: entry.contractEndedHow, endedOn: entry.contractEndedOn ? demandDate(entry.contractEndedOn) : '', paymentBond: entry.paymentBond, kind: coverLetterKindFor(property), contact: fields.contactPerson, phone: (signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : '') || (issuer?.phone ?? '').trim(), trade: job?.service_type?.name }) })),
    [label, fields, extras, entry.inClaim, entry.contractEndedHow, entry.contractEndedOn, entry.paymentBond, property, gc?.name, job?.job_address, job?.master_user_id, job?.service_type?.name, issuer?.phone, signerPhoneFor],
  )
  const docHtml = useMemo(() => filingDocHtml(buildLienRetainageNoticeBlocks(fields, extras)), [fields, extras])

  const run = async (labelText: string, fn: () => Promise<void>, done?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      // No words here when the act said its own: the send for approval reads what the leader's message did.
      if (done) showToast(done, 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${labelText}: ${e.message}` : `${labelText} failed.`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const ensureDraft = () => saveLienDeskDraft({ itemId: item?.id ?? null, jobId: entry.jobId, months: [], fields: { notice: fields, gcEmail: gc?.email ?? '' }, coverNote: true, userId: authUserId, kind: 'retainage_53_057' })
  const policy = gc?.policy ?? 'ask'
  const submit = () => {
    const outcome = submitOutcome({ policy, earliestDeadline: entry.deadline }, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(entry.gcCustomerId && data.gcsWithPriorNotice.has(entry.gcCustomerId)), gcHeldBefore: Boolean(entry.gcCustomerId && data.gcsHeldBefore.has(entry.gcCustomerId)) }, todayYmd)
    return run(
      'Send for approval',
      async () => {
        const id = await ensureDraft()
        await submitLienDeskItem(id, outcome)
        // The leader is told (v2.7478), as a monthly notice tells them: after the write, best effort, with the day the window closes.
        // Until then a retainage notice sent for approval told nobody. A tell that fails is said with its reason, and the paper stays sent.
        if (outcome.status === 'awaiting_approval') {
          const told = lienNoticeToldWords(await tellLeaderOfLienApproval(id, entry.deadline), leaderName)
          showToast(told.said, told.tone)
        }
      },
      // A paper the standing rule approved or held is not the leader's to decide, so nobody is told and the words say which it was.
      outcome.status === 'awaiting_approval' ? undefined : outcome.status === 'approved' ? `Approved by the standing rule. ${LIEN_RUN_NOW_TO_MAIL}` : 'Held by the standing rule. The desk asks again before the window closes.',
    )
  }
  const sendOnWord = () => run('Send on the leader’s word', async () => void (await sendLienDeskItemOnWord(await ensureDraft(), { note: wordNote, channel: wordChannel })), `Recorded on the leader’s word. ${LIEN_RUN_NOW_TO_MAIL}`)
  // Sign and approve (v2.5082): the draft is saved first so the mark binds to it, then one press under the leader's own sign-in signs and approves.
  const approve = () =>
    run(
      'Sign and approve',
      async () => {
        const id = await ensureDraft()
        const signed = await signLienDeskItem({ itemId: id, fields: { notice: fields, gcEmail: gc?.email ?? '' }, signer: { userId: authUserId, printedName: authName }, payload: { mode: 'type' }, onDevice: null, approve: true })
        if (!signed.ok) throw new Error(signed.message)
      },
      `Signed and approved. ${LIEN_RUN_NOW_TO_MAIL}`,
    )
  const hold = (reason: 'promised' | 'call_first') => run('Hold', async () => void (item && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, entry.deadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the window closes.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')

  // ---------- the facts a person types, changed where they sit (punch list #399) ----------
  // A refusal is thrown, so the open field says the reason under what was typed. A save reads the desk and the job's retainage line again.
  const saveFact = async (patch: LienContractPatch, done: string) => {
    await saveLienContractFacts(entry.jobId, patch)
    showToast(done, 'success')
    onChanged()
    reloadRetainage()
  }
  const endedHow = entry.contractEndedOn ? entry.contractEndedHow : null
  const endedOn = endedHow ? (entry.contractEndedOn ?? '') : ''
  /** The day is kept: the window says which day the notice is then due, and its press is the write. */
  const keepDay = async (day: string) => {
    const how = endedHow ?? startHow
    if (!how) return
    const ask = lienContractEndedAsk({ how, day, was: endedOn, todayYmd, formatDay: formatYmdMonthDay })
    if (!(await confirmDialog({ title: ask.title, message: ask.message, confirmLabel: ask.confirmLabel }))) return
    await saveFact(lienContractEndedPatch(day, how, authUserId, new Date().toISOString()), lienContractEndedSavedWords(how, day, formatYmdMonthDay))
    setStartHow(null)
  }
  /** How it ended is kept. On an ended contract the word alone moves no deadline; *Still open* takes the day off and asks first. */
  const keepHow = (picked: string): void | Promise<void> => {
    const how = parseContractEndedHow(picked)
    if (endedHow) return changeHow(picked, how)
    // Still open: nothing is written until the day is kept. The day's field opens beside the pick, in the same draw, so the day's box can take the cursor.
    setStartHow(how)
    if (how) setDayAsk((n) => n + 1)
  }
  const changeHow = async (picked: string, how: LienContractEndedHow | null) => {
    if (picked === LIEN_CONTRACT_STILL_OPEN) {
      const ask = lienContractStillOpenAsk({ was: endedOn, formatDay: formatYmdMonthDay })
      if (!(await confirmDialog({ title: ask.title, message: ask.message, confirmLabel: ask.confirmLabel }))) return
      await saveFact(LIEN_CONTRACT_STILL_OPEN_PATCH, LIEN_CONTRACT_STILL_OPEN_SAVED_WORDS)
      return
    }
    if (how) await saveFact(lienContractEndedPatch(endedOn, how, authUserId, new Date().toISOString()), lienContractEndedSavedWords(how, endedOn, formatYmdMonthDay))
  }
  const keepHeld = (draft: string) => saveFact(lienRetainageHeldPatch(Number(draft)), lienRetainageHeldSavedWords(Number(draft)))
  const keepBond = (picked: string) => saveFact(lienPaymentBondPatch(parsePaymentBond(picked)), lienPaymentBondSavedWords(parsePaymentBond(picked)))
  // The figure as the job holds it: an empty column reads *not recorded*, where the desk's row reads it as 0.
  const heldOnJob = job?.lien_retainage_held == null ? (entry.retainageHeld > 0 ? entry.retainageHeld : null) : Number(job.lien_retainage_held)
  // A figure read from a pay application is changed in the AIA window. While the source is still being read the figure has no press.
  const heldFromApplication = jobRetainage?.figure?.source === 'pay_application'

  // The pane's stacked heads (v2.7320, the owner's ask of 2026-11-15): the notice pane's grey bars over the gates, the § 53.056 claim and the paper, where two boxes wore a tiny caption.
  const isMobile = useIsMobile()
  const paneRef = useRef<HTMLDivElement | null>(null)
  const paneHeads = lienRetainagePaneSections({ gates: entry.gates, endedWords, retainageWords: formatUsdNoCents(entry.retainageHeld), inClaim: entry.inClaim, pages: 2 })
  const heads = useLienPaneHeads({ paneRef, sections: paneHeads, phone: isMobile })
  // A way of ending was just picked: its day is the next thing to type, so the day's box takes the cursor the pick's press took back.
  useEffect(() => {
    if (dayAsk > 0) paneRef.current?.querySelector<HTMLInputElement>('[data-lien-retainage-contract] input[type="date"]')?.focus()
  }, [dayAsk])

  // ---------- footer ----------
  let footer: React.ReactNode = null
  const fuse = entry.deadline ? <span style={{ color: 'var(--text-red-600)' }}>The § 53.057 window on {label} closes {worked(demandDate(entry.deadline), 'red')}.</span> : null
  if (entry.pile === 'clock_not_started') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>No clock yet — the 30 days start the day our contract on this job is complete, terminated or abandoned. Type that day on the job the day it happens; do not wait for {gc?.name ?? 'the GC'} to declare it.</span>
        <span style={{ flex: 1 }} />
        {/* The press opens the fact's own field on its line (punch list #399), where it used to open Edit Job. */}
        <button type="button" onClick={() => setHowAsk((n) => n + 1)} disabled={!office} style={btn('primary', !office)} data-lien-retainage-start>Set the day our contract ended</button>
      </div>
    )
  } else if (entry.pile === 'needs_owner' || entry.pile === 'to_draft') {
    const blocked = !entry.ready
    const foot = lienFooter({ role: authRole, paper: 'retainage', leaderName, blocked, route: policy === 'send' && !promise ? 'run' : 'leader' })
    footer = wordOpen ? (
      <LienWordRecordRow
        note={wordNote}
        onNote={setWordNote}
        channel={wordChannel}
        onChannel={setWordChannel}
        radioName="ret-word-channel"
        recorderName={authName}
        leaderName={leaderName}
        preview={wordRecordPreview({ leaderName, note: wordNote, channel: wordChannel, recorderName: authName, jobLabel: label, gcName: gc?.name ?? null, amountWords: formatUsdNoCents(entry.retainageHeld) })}
        actionLabel="Approve on his word ▸"
        onAction={sendOnWord}
        actionDisabled={busy || !wordNote.trim()}
        onCancel={() => setWordOpen(false)}
        btn={btn}
      />
    ) : (
      <>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          ✉ Certified mail to <WorkedOutValue>{ownerName || 'the owner of record'}</WorkedOutValue> and <WorkedOutValue>{gc?.name ?? 'the original contractor'}</WorkedOutValue> · {blocked ? 'Blocked until every gate above is clear.' : leader ? foot.primary?.line : policy === 'send' && !promise ? `${gc?.name ?? 'This GC'} has a standing "send" rule — approved on submit, into the run.` : promise ? <>They promised {worked(formatYmdMonthDay(promise.promisedYmd))} — {press.name} decides between paper and their word.</> : foot.primary?.line} {fuse}
        </div>
        {/* One press per footer (v2.7324): his word waits behind He already okayed it ▾; the one press is the leader's okay or the office's ask. */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ flex: 1 }} />
          {foot.menus.map((m) => (
            <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={(k) => { if (k === 'word') { setWordNote(defaultWordNote(leaderName, demandDate(todayYmd))); setWordOpen(true) } }} />
          ))}
          {leader ? (
            <button type="button" onClick={approve} disabled={busy || blocked} style={btn('green', busy || blocked)} title={foot.primary?.line} data-lien-retainage-approve>{press.approve}</button>
          ) : (
            <button type="button" onClick={submit} disabled={busy || blocked || !office} style={btn('primary', busy || blocked || !office)} title={foot.primary?.line} data-lien-retainage-ask>{press.ask}</button>
          )}
        </div>
      </>
    )
  } else if (entry.pile === 'awaiting') {
    footer = leader ? (
      holdOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          <span>Holds until {worked(formatYmdMonthDay(holdUntilFor(holdOpen, entry.deadline, promise?.promisedYmd ?? null, todayYmd)))}, then asks again. {fuse}</span>
          <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
          <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
          <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
          <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Sign and approve ▸</button>
        </div>
      )
    ) : (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Waiting on the leader since {item?.submitted_at ? worked(demandDate(calendarYmdInAppTzFromIso(item.submitted_at))) : '—'}. {fuse}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
      </div>
    )
  } else if (entry.pile === 'ready') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>{item?.approval_mode === 'word' ? `On ${wordRecordWords(item, leaderName).slice(3)}.` : item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule.` : 'Approved.'} It goes out with the monthly notices, one envelope per name and address. {fuse}</span>
        {leader && item?.approval_mode === 'word' ? <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Not what I said</button> : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onOpenRun} disabled={!office} style={btn('primary', !office)}>{LIEN_RUN_ACT.print} ▸</button>
      </div>
    )
  } else if (entry.pile === 'held') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Held{item?.hold_reason === 'promised' ? ' — they promised' : " — the leader will call first"} · asks again {item?.hold_until ? worked(demandDate(item.hold_until)) : ''}. {fuse}</span>
        <span style={{ flex: 1 }} />
        {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold, sign and approve ▸</button> : null}
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
      </div>
    )
  } else if (entry.pile === 'sent') {
    footer = (
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Sent{entry.item?.sent_at ? <> {worked(demandDate(calendarYmdInAppTzFromIso(entry.item.sent_at)))}</> : ''} · the notice is in the job's Lien window.{entry.inClaim ? '' : ' The owner may withhold this retainage once they receive a copy of the filed affidavit (§ 53.081(c)) — the Lien affidavits tab is watching this job.'}
      </div>
    )
  } else if (entry.pile === 'missed') {
    footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>The § 53.057 window closed {entry.deadline ? worked(demandDate(entry.deadline), 'red') : ''} with nothing sent. {entry.inClaim ? 'The retainage was named in a § 53.056 notice, so the claim on it stands to that extent (§ 53.057(f)).' : 'Talk to the attorney about what the lien can still reach.'}</div>
  }
  const tone = entry.severity === 'red' ? chip('var(--bg-red-tint)', 'var(--text-red-600)') : entry.severity === 'amber' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-subtle)', 'var(--text-muted)')

  return (
    <>
    {footerEl && footer ? createPortal(footer, footerEl) : null}
    <div
      ref={paneRef}
      data-lien-retainage-pane
      data-lien-pane-phone={isMobile ? 'yes' : undefined}
      onScroll={heads.onScroll}
      // The pane is the scrolling box its heads stick in (v2.7320), the notice pane's shape: its gutter is the pane's padding, which the heads cancel to run across; the one column is held to the pane's width on every screen (v2.7446).
      style={{ position: 'relative', padding: '0 1.1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.7rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', paddingTop: isMobile ? '0.6rem' : '0.9rem' }}>
        <LienJobHeading label={label} onOpenJob={onOpenJob ? () => onOpenJob(entry.jobId) : undefined} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>· GC {gc?.name ? <WorkedOutValue>{gc.name}</WorkedOutValue> : ''} {job?.job_address ? `· ${job.job_address}` : ''}</span>
        <span style={tone} data-lien-retainage-deadline>§ 53.057 · <ValueSentence text={retainageDeadlineValues(entry, formatYmdMonthDay)} values={{ day: inChip, days: inChip }} /></span>
        <span style={chip(entry.paymentBond === 'yes' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', entry.paymentBond === 'yes' ? 'var(--text-amber-800)' : 'var(--text-muted)')}>{paymentBondWords(entry.paymentBond)}</span>
      </div>
      {heads.head('gates')}
      <div data-lien-pane-body="gates" data-lien-retainage-gates style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} data-lien-retainage-window><ValueSentence text={lienDayValues(lienRetainageWindowWords(endedWords))} /></div>
        {/* One fact a line (punch list #399): the gate's own words on the left, its value on the right. A value a person types opens its field right there. */}
        <div style={{ fontSize: '0.8125rem' }} data-lien-retainage-facts>
          <ValueLines>
            {entry.gates.map((g) => (
              <ValueLine
                key={g.key}
                label={
                  <span data-lien-retainage-gate={g.key} data-ok={g.ok ? 'yes' : 'no'} style={{ color: 'var(--text-base)' }}>
                    <span style={{ fontWeight: 700, color: g.ok ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{g.ok ? '✓' : '✗'}</span> {g.label}
                  </span>
                }
              >
                {g.key === 'owner' ? (
                  <>
                    {ownerName ? <WorkedOutValue>{ownerName}</WorkedOutValue> : null}
                    {!g.ok ? <button type="button" onClick={() => onOpenEditJob(entry.jobId, 'property-record')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem', marginLeft: ownerName ? 8 : 0 }}>Property record ›</button> : null}
                  </>
                ) : g.key === 'gc' ? (
                  gc?.name ? <WorkedOutValue>{gc.name}</WorkedOutValue> : null
                ) : g.key === 'contract_ended' ? (
                  <span data-lien-retainage-contract style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'baseline', maxWidth: '100%' }}>
                    <ChangeableValue
                      key={`how-${howAsk}`}
                      startOpen={howAsk > 0}
                      text={lienContractStateText(endedHow ?? startHow)}
                      label={LIEN_RETAINAGE_VALUE_LABELS.how}
                      type="choice"
                      value={endedHow ?? startHow ?? LIEN_CONTRACT_STILL_OPEN}
                      choices={LIEN_CONTRACT_STATE_CHOICES}
                      onKeep={keepHow}
                      off={!office}
                    />
                    {endedHow ? (
                      <ChangeableValue
                        text={formatYmdMonthDay(endedOn)}
                        label={LIEN_RETAINAGE_VALUE_LABELS.day}
                        type="date"
                        value={endedOn}
                        preview={(draft) => <ValueSentence text={lienContractDayPreview(draft, todayYmd, formatYmdMonthDay)} />}
                        onKeep={keepDay}
                        off={!office}
                      />
                    ) : startHow && office ? (
                      <>
                        <ChangeableValue
                          key={`day-${dayAsk}`}
                          startOpen
                          text={LIEN_CONTRACT_NO_DAY_WORDS}
                          label={LIEN_RETAINAGE_VALUE_LABELS.day}
                          type="date"
                          value=""
                          hint={lienContractStartHint(startHow, job?.last_work_date, formatYmdMonthDay)}
                          preview={(draft) => <ValueSentence text={lienContractDayPreview(draft, todayYmd, formatYmdMonthDay)} />}
                          onKeep={keepDay}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} data-lien-retainage-not-saved>{LIEN_CONTRACT_NOT_SAVED_WORDS}</span>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <ChangeableValue
                    text={lienRetainageHeldText(heldOnJob)}
                    label={LIEN_RETAINAGE_VALUE_LABELS.held}
                    type="number"
                    value={lienRetainageHeldValue(heldOnJob)}
                    min="0"
                    hint={LIEN_RETAINAGE_HELD_HINT}
                    preview={(draft) => <ValueSentence text={lienRetainageHeldPreview(draft)} />}
                    onKeep={keepHeld}
                    locked={office && heldFromApplication ? LIEN_RETAINAGE_FROM_APPLICATION : undefined}
                    off={!office || (retainageLoading && !jobRetainage)}
                  />
                )}
              </ValueLine>
            ))}
            {entry.deadline ? (
              <ValueLine label="The § 53.057 notice is due by">
                <span data-lien-retainage-due>{worked(formatYmdMonthDay(entry.deadline), entry.daysLeft != null && entry.daysLeft < 0 ? 'red' : undefined)}</span>
              </ValueLine>
            ) : null}
            <ValueLine label="Retainage the notice claims">
              <span data-lien-retainage-claim>{worked(formatUsdNoCents(entry.retainageHeld))}</span>
            </ValueLine>
            <ValueLine label="Still unpaid on this job">
              <span data-lien-retainage-unpaid>{worked(formatUsdNoCents(entry.openBalance))}</span>
            </ValueLine>
            {entry.gates.length ? (
              <ValueLine label="Payment bond on the project">
                <ChangeableValue text={lienPaymentBondText(entry.paymentBond)} label={LIEN_RETAINAGE_VALUE_LABELS.bond} type="choice" value={entry.paymentBond} choices={LIEN_PAYMENT_BOND_CHOICES} onKeep={keepBond} off={!office} />
              </ValueLine>
            ) : null}
          </ValueLines>
        </div>
        {jobRetainage?.line ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center' }} data-lien-retainage-source>
            <span>Read <ValueSentence text={lienDayValues(retainageSourceWords(jobRetainage.line, formatYmdMonthDay))} /></span>
            {jobRetainage.line.release.state !== 'none' ? (
              <>
                <span>
                  · Release: {retainageReleaseWords(jobRetainage.line.release)}
                  {jobRetainage.releaseBillLabel ? <> · bill <WorkedOutValue>{jobRetainage.releaseBillLabel}</WorkedOutValue></> : ''}
                </span>
                {onOpenJob ? (
                  <button type="button" data-testid="lien-retainage-release-door" onClick={() => onOpenJob(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
                    Open the job ›
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {heads.head('claim')}
      <div data-lien-pane-body="claim" data-lien-retainage-in-claim={entry.inClaim ? 'yes' : 'no'} style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {entry.inClaim
            ? 'A recorded monthly notice on this job named this retainage in its claim, so the owner may already withhold it from the original contractor (§ 53.081(b)). This form is belt and suspenders — counsel says send it inside the 30 days anyway.'
            : 'No recorded monthly notice on this job has named this retainage. On a § 53.057 notice alone the owner may withhold only once they receive a copy of our filed lien affidavit (§ 53.081(c)) — the money is not trapped until then. Counsel: name the retainage inside the next § 53.056 claim while the job is open; the desk does that on its own once the figure is on the job.'}
        </div>
        {!entry.inClaim ? (
          <div>
            <button type="button" onClick={() => onShowNotices(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>The monthly notices on this job ›</button>
          </div>
        ) : null}
      </div>
      {heads.head('paper')}
      <div data-lien-pane-body="paper" style={{ display: 'grid', gap: '0.7rem', paddingBottom: '0.9rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page 1 of 2 · cover letter (counsel's retainage rules, 2026-09-22)</div>
      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page 2 of 2 · the form, as § 53.057(a-2) prescribes it</div>
      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>
      </div>
    </div>
    </>
  )
}
