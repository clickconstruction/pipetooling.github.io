import { useEffect, useMemo, useState } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocExtras } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, workMonthShort, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import {
  LIEN_ASK_REASON_LABELS,
  LIEN_DESK_PILES,
  LIEN_NOTICE_POLICIES,
  holdUntilFor,
  submitOutcome,
  type LienAskReason,
  type LienDeskEntry,
  type LienDeskPile,
  type LienNoticePolicy,
} from '../../lib/jobs/lienDesk'
import {
  approveLienDeskItem,
  holdLienDeskItem,
  pullBackLienDeskItem,
  saveLienDeskDraft,
  sendLienDeskItemOnWord,
  setCustomerLienNoticePolicy,
  skipLienDeskItem,
  submitLienDeskItem,
} from '../../lib/jobs/lienDeskIo'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, lienNoticeCoverNote, parseLienDeskDraftFields, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData, LienDeskJob } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { buildLienDeskRun } from '../../lib/jobs/lienDeskRun'
import LienDeskRunModal from './LienDeskRunModal'

/**
 * The Lien desk: the queue of § 53.056 notices the law says are due per
 * unpaid work month on sub jobs. The office readies (owner of record) and
 * drafts; the leader approves — once per GC with a standing rule, or per
 * item — or the office sends on his spoken word with a note; approved
 * notices go out and are recorded (the run, PR 3; until then the Lien
 * window's notice tab). Doors: the Dashboard's Needs you cards, the
 * Collections header, the Pipeline's tools menus, the forecast's Send
 * notice…, and `?liendesk=1`.
 */

export type LienDeskModalProps = {
  open: boolean
  onClose: () => void
  data: LienDeskData | null
  loading: boolean
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  /** The office's display name, for the spoken-word note. */
  authName: string
  /** Evidence per job — the forecast's work-months kernel over the desk's jobs. */
  workMonths: Record<string, JobWorkMonths> | null
  issuer: PhysicalInvoiceIssuer | null
  /** The signer's "Full name and title" for a job's master (else the session name) — the notice's contact person. */
  signerNameFor: (masterUserId: string | null) => string
  /** Land on this job's item when given (the forecast's Send notice…, the row icon). */
  initialJobId?: string | null
  /** Re-read after any write. */
  onChanged: () => void
  /** "Find the owner" — Edit Job → Property record. */
  onOpenEditJob: (jobId: string) => void
  /** The send door until the run ships: the Lien window on its notice tab. */
  onOpenLienInstruments: (jobId: string) => void
}

const PILE_ORDER: LienDeskPile[] = ['needs_owner', 'to_draft', 'awaiting', 'ready', 'held', 'sent', 'missed']

function isLeader(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician'
}
function isOffice(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}
function canSendOnWord(role: string | null): boolean {
  return role === 'dev' || role === 'assistant' || role === 'controller'
}

function jobLabel(j: LienDeskJob | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
  const name = (j.job_name ?? '').trim()
  return name ? `${number} · ${name}` : number
}

function severityColors(sev: LienDeskEntry['severity']): { bg: string; fg: string } {
  if (sev === 'red') return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
  if (sev === 'amber') return { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
  return { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
}

function deadlineWords(e: LienDeskEntry): string {
  if (e.daysLeft == null || !e.earliestDeadline) return e.missedMonths.length ? 'window closed' : ''
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'due today'
  if (e.daysLeft === 1) return 'due tomorrow'
  if (e.daysLeft <= 14) return `due in ${e.daysLeft}d`
  return `by ${formatYmdMonthDay(e.earliestDeadline)}`
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 5,
  fontSize: '0.68rem',
  fontWeight: 600,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  background: bg,
  color: fg,
  verticalAlign: 'middle',
})
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'primary' ? 'var(--text-link)' : kind === 'green' ? 'var(--text-green-800)' : kind === 'amber' ? 'var(--text-amber-800)' : 'var(--surface)',
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
const boxStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
const boxHead: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export default function LienDeskModal({
  open,
  onClose,
  data,
  loading,
  todayYmd,
  authRole,
  authUserId,
  authName,
  workMonths,
  issuer,
  signerNameFor,
  initialJobId,
  onChanged,
  onOpenEditJob,
  onOpenLienInstruments,
}: LienDeskModalProps) {
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const leader = isLeader(authRole)
  const office = isOffice(authRole)
  const [pile, setPile] = useState<LienDeskPile | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [checkedMonths, setCheckedMonths] = useState<ReadonlySet<string> | null>(null)
  const [coverNote, setCoverNote] = useState(true)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<'phone' | 'in_person' | 'text'>('phone')
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  const [rulePick, setRulePick] = useState<LienNoticePolicy | null>(null)
  const [busy, setBusy] = useState(false)
  const [mobileListShown, setMobileListShown] = useState(true)
  // The run (v2.3410): every approved notice as one packet + one tracking form.
  const [runOpen, setRunOpen] = useState(false)

  const entries = data?.queue.entries ?? []
  const visible = useMemo(() => {
    const list = pile ? entries.filter((e) => e.pile === pile) : entries
    return PILE_ORDER.flatMap((p) => list.filter((e) => e.pile === p))
  }, [entries, pile])

  // Selection follows the list: the requested job, else the first visible row (desktop).
  useEffect(() => {
    if (!open) return
    if (initialJobId && entries.some((e) => e.jobId === initialJobId)) {
      setSelectedJobId(initialJobId)
      setMobileListShown(false)
      return
    }
    if (selectedJobId && visible.some((e) => e.jobId === selectedJobId)) return
    setSelectedJobId(!isMobile && visible[0] ? visible[0].jobId : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialJobId, visible.map((e) => e.jobId).join('|')])

  const selected = visible.find((e) => e.jobId === selectedJobId) ?? entries.find((e) => e.jobId === selectedJobId) ?? null
  const job = selected ? data?.jobsById[selected.jobId] : undefined
  const gc = selected?.gcCustomerId ? data?.gcsById[selected.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data?.addressesById[job.customer_address_id] ?? null : null
  const ownerRow = selected ? data?.ownerByJob[selected.jobId] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, ownerRow ?? null), [address, ownerRow])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const promise = selected ? data?.promisesByJob[selected.jobId] ?? null : null
  const wm = selected ? workMonths?.[selected.jobId] ?? null : null
  const item = selected?.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? selected.item : null
  const storedDraft = useMemo(() => (selected?.item ? parseLienDeskDraftFields(selected.item.fields) : null), [selected?.item])

  // Months a new notice names: the draft's, else every open month, minus what the user unticked.
  const monthChoices = useMemo(() => (selected ? selected.months.map((m) => ({ ...m, closed: m.daysLeft < 0 })) : []), [selected])
  const defaultMonths = useMemo(() => new Set(item?.months.length ? item.months : (selected?.dueMonths ?? [])), [item, selected])
  useEffect(() => {
    setCheckedMonths(null)
    setCoverNote(selected?.item ? selected.item.cover_note : true)
    setWordOpen(false)
    setSkipOpen(false)
    setHoldOpen(null)
    setRulePick(null)
    setWordNote('')
  }, [selected?.jobId])
  const months = checkedMonths ?? defaultMonths
  const monthsList = [...months].sort()

  const openBalance = selected?.openBalance ?? 0
  const noticeFields = useMemo(
    () =>
      storedDraft?.notice ??
      buildLienNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        openBalance,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
      }),
    [storedDraft, job, gc, openBalance, signerNameFor, issuer, todayYmd],
  )
  const docExtras: FilingDocExtras = useMemo(
    () => ({
      letterhead: filingLetterheadFromIssuer(issuer),
      refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, monthsList.length ? `Work months ${describeNoticeMonths(monthsList)}` : '', demandDate(todayYmd)].filter(Boolean),
    }),
    [issuer, job, monthsList, todayYmd],
  )
  const docHtml = useMemo(() => filingDocHtml(buildLienNoticeBlocks(noticeFields, docExtras)), [noticeFields, docExtras])

  const draftFields = (): LienDeskDraftFields => ({ notice: noticeFields, gcEmail: gc?.email ?? '' })
  const ready = Boolean(ownerName && property.owner.mailingAddress) && Boolean(gc?.name) && monthsList.length > 0

  const askReason: LienAskReason | null = useMemo(() => {
    if (!selected || !data) return null
    if (promise) return 'promise_live'
    if (selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) return 'held_before'
    if (selected.gcCustomerId && !data.gcsWithPriorNotice.has(selected.gcCustomerId)) return 'first_notice'
    return 'no_rule'
  }, [selected, data, promise])

  const gcOpenTotal = useMemo(() => {
    if (!selected?.gcCustomerId) return 0
    return entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).reduce((s, e) => s + e.openBalance, 0)
  }, [entries, selected])

  const run = async (label: string, fn: () => Promise<void>, done?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      if (done) showToast(done, 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${label}: ${e.message}` : `${label} failed.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const ensureDraft = async (): Promise<string> => {
    if (!selected) throw new Error('nothing selected')
    return saveLienDeskDraft({ itemId: item?.id ?? null, jobId: selected.jobId, months: monthsList, fields: draftFields(), coverNote, userId: authUserId })
  }

  const saveDraft = () => run('Save draft', async () => void (await ensureDraft()), 'Draft saved.')
  const sendToLeader = () =>
    run(
      'Send for approval',
      async () => {
        if (!selected || !data) return
        const id = await ensureDraft()
        const outcome = submitOutcome(selected, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(selected.gcCustomerId && data.gcsWithPriorNotice.has(selected.gcCustomerId)), gcHeldBefore: Boolean(selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) }, todayYmd)
        await submitLienDeskItem(id, outcome)
      },
      selected?.policy === 'send' && !promise ? 'Approved by the standing rule — it is in the run.' : selected?.policy === 'hold' ? 'Held by the standing rule — it re-asks before the deadline.' : 'Sent for approval.',
    )
  const sendOnWord = () =>
    run(
      'Send on the leader’s word',
      async () => {
        const id = await ensureDraft()
        await sendLienDeskItemOnWord(id, { note: wordNote, channel: wordChannel })
      },
      'Recorded on the leader’s word — it is in the run.',
    )
  const skip = () =>
    run(
      'Skip',
      async () => {
        if (!selected) return
        await skipLienDeskItem({ itemId: item?.id ?? null, jobId: selected.jobId, months: monthsList, fields: draftFields(), reason: skipReason, userId: authUserId })
      },
      'Skipped — the lien right on those months is given up.',
    )
  const approve = () => run('Approve', async () => void (item && (await approveLienDeskItem(item.id))), 'Approved — it is in the run.')
  const hold = (reason: 'promised' | 'call_first') =>
    run('Hold', async () => void (item && selected && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the deadline.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')
  const saveRule = (policy: LienNoticePolicy) =>
    run('Standing rule', async () => void (selected?.gcCustomerId && (await setCustomerLienNoticePolicy(selected.gcCustomerId, policy, ''))), `Rule saved for ${gc?.name ?? 'this GC'}.`)

  if (!open) return null

  const counts = data?.queue.counts
  const wordSent = entries.filter((e) => e.item?.approval_mode === 'word' && (e.pile === 'ready' || e.pile === 'sent'))

  const list = (
    <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {visible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every unpaid sub job…' : pile ? 'Nothing in this pile.' : 'Nothing is due — every unpaid month on a sub job is noticed, or is more than 30 days from its deadline.'}
        </p>
      ) : null}
      {PILE_ORDER.map((p) => {
        const rows = visible.filter((e) => e.pile === p)
        if (rows.length === 0) return null
        const label = LIEN_DESK_PILES.find((x) => x.key === p)?.label ?? p
        return (
          <div key={p}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.6rem 0.9rem 0.2rem' }}>{label}</div>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === selectedJobId
              const sev = severityColors(e.severity)
              const named = e.item && e.item.status !== 'sent' && e.item.status !== 'missed' && e.item.months.length ? e.item.months : e.dueMonths
              const state =
                e.pile === 'awaiting'
                  ? `awaiting approval · ${e.item?.submitted_at ? formatYmdMonthDay(e.item.submitted_at.slice(0, 10)) : ''}`
                  : e.pile === 'ready'
                    ? e.item?.approval_mode === 'word'
                      ? `on the leader’s word · ${e.item.word_note}`
                      : e.item?.approval_mode === 'rule'
                        ? 'standing rule'
                        : 'approved'
                    : e.pile === 'held'
                      ? `held · ${e.item?.hold_reason === 'promised' ? 'they promised' : 'call first'} · re-asks ${e.item?.hold_until ? formatYmdMonthDay(e.item.hold_until) : ''}`
                      : e.pile === 'sent'
                        ? `sent ${e.item?.sent_at ? formatYmdMonthDay(e.item.sent_at.slice(0, 10)) : ''}`
                        : e.pile === 'missed'
                          ? `window closed on ${e.missedMonths.map(workMonthShort).join(', ')}`
                          : e.pile === 'needs_owner'
                            ? 'owner of record missing'
                            : e.item
                              ? 'draft saved'
                              : ''
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    {g?.name ? <span style={{ color: 'var(--text-muted)' }}> · GC {g.name}</span> : null}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {deadlineWords(e) ? <span style={chip(sev.bg, sev.fg)}>{deadlineWords(e)}</span> : null}
                    <span>{named.map(workMonthShort).join(' + ')}</span>
                    {state ? <span>· {state}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  const pane = selected ? (
    <div style={{ padding: '0.9rem 1.1rem', display: 'grid', gap: '0.7rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}>
      {isMobile ? (
        <button type="button" onClick={() => setMobileListShown(true)} style={{ ...btn('plain'), justifySelf: 'start' }}>
          ← Back to the list
        </button>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline' }}>
        <strong style={{ fontSize: '1rem' }}>{jobLabel(job, selected.jobId)}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {gc?.name ? `· GC ${gc.name}` : '· no GC'} {job?.job_address ? `· ${job.job_address}` : ''}
        </span>
        {deadlineWords(selected) ? <span style={chip(severityColors(selected.severity).bg, severityColors(selected.severity).fg)}>{workMonthShort(monthsList[0] ?? selected.dueMonths[0] ?? '')} notice {deadlineWords(selected)}</span> : null}
        {askReason && (selected.pile === 'awaiting' || selected.pile === 'to_draft' || selected.pile === 'needs_owner') ? (
          <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')} title="Why this one comes to the leader">
            {LIEN_ASK_REASON_LABELS[askReason]}
          </span>
        ) : null}
      </div>

      {leader && selected.pile === 'awaiting' ? (
        <div style={boxStyle}>
          <div style={boxHead}>What you're deciding</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Open with {gc?.name ?? 'this GC'}: </span>
              <strong>{formatUsdNoCents(gcOpenTotal)}</strong> on {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length} {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length === 1 ? 'job' : 'jobs'} in the desk
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Their word: </span>
              {promise ? (
                <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(promise.promisedYmd)}{promise.markedByName ? ` · ${promise.markedByName}` : ''}</span>
              ) : (
                'no promise on file'
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Months: </span>
              {monthsList.map(workMonthShort).join(' · ')}
              {wm ? ` — ${wm.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h, ${new Set(wm.months.flatMap((m) => m.people)).size} people` : ''}
            </div>
            <div style={{ color: 'var(--text-red-600)' }}>
              If you hold: {monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : '—'}` : ''}
            </div>
          </div>
        </div>
      ) : null}

      <div style={boxStyle}>
        <div style={boxHead}>Before it can go out</div>
        <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: ownerName && property.owner.mailingAddress ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{ownerName && property.owner.mailingAddress ? '✓' : '✗'}</span>
            <span>Owner of record with a mailing address{ownerName ? ` — ${ownerName}${property.owner.mailingAddress ? `, ${property.owner.mailingAddress}` : ' (mailing address missing)'}` : ''}</span>
            {!(ownerName && property.owner.mailingAddress) ? (
              <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job → Property record: link or add the property, then its owner of record">
                Find the owner ›
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: gc?.name ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{gc?.name ? '✓' : '✗'}</span>
            <span>Original contractor{gc?.name ? `: ${gc.name}${gc.address ? `, ${gc.address}` : ' — no address on the customer'}` : ' — set the GC on the job'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: property.propertyKind ? 'var(--text-green-800)' : 'var(--text-amber-800)' }}>{property.propertyKind ? '✓' : '!'}</span>
            <span>
              Property kind: {property.propertyKind === 'residential' ? 'residential (2nd-month clock)' : property.propertyKind ? 'commercial' : 'unknown — commercial dates shown; a residential property is a month earlier'}
              {property.county ? ` · county: ${property.county}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-green-800)' }}>✓</span>
            <span>
              Work months with approved hours: {selected.months.map((m) => workMonthShort(m.key)).join(', ')}
              {wm && wm.pendingSessions > 0 ? ` (${wm.pendingSessions} ${wm.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted)` : ''}
            </span>
          </div>
        </div>
      </div>

      <div style={boxStyle}>
        <div style={boxHead}>Months this notice names</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          {monthChoices.map((m) => {
            const on = months.has(m.key)
            const locked = m.noticed || m.closed || (item != null && item.status !== 'drafted')
            const hours = wm?.months.find((x) => x.key === m.key)?.hours ?? m.approvedHours
            return (
              <label key={m.key} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: `1px solid ${on && m.daysLeft <= 7 && !m.noticed ? 'var(--text-red-600)' : 'var(--border)'}`, borderRadius: 6, background: on && m.daysLeft <= 7 && !m.noticed ? 'var(--bg-red-tint)' : 'var(--bg-subtle)', opacity: locked && !on ? 0.6 : 1 }}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={(ev) => {
                    const next = new Set(months)
                    if (ev.target.checked) next.add(m.key)
                    else next.delete(m.key)
                    setCheckedMonths(next)
                  }}
                />
                {workMonthLabel(m.key)} · {hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h · {m.noticed ? 'notice sent' : m.closed ? 'window closed' : `by ${formatYmdMonthDay(m.deadline)}`}
              </label>
            )
          })}
        </div>
        {wm ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {wm.months
              .filter((m) => months.has(m.key))
              .map((m) => `${workMonthShort(m.key)}: ${m.people.length} ${m.people.length === 1 ? 'person' : 'people'} · ${m.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h · ${m.dayCount} ${m.dayCount === 1 ? 'day' : 'days'} · ${m.hoursShare}% of hours`)
              .join('   ·   ')}
          </div>
        ) : null}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Claim amount <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(openBalance)}</strong> (open on the job) · the same document the Lien window prints, filled from the same job.
        </div>
      </div>

      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.9rem 1.1rem', maxHeight: 360, overflow: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>

      <div style={boxStyle}>
        <div style={boxHead}>Send</div>
        <div style={{ fontSize: '0.8125rem' }}>
          Certified mail to {ownerName || 'the owner of record'} and to {gc?.name || 'the original contractor'}
          {gc?.email ? <span style={{ ...chip('var(--bg-subtle)', 'var(--text-muted)'), marginLeft: 6 }}>courtesy PDF by email to {gc.email}</span> : null}
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem' }}>
          <input type="checkbox" checked={coverNote} disabled={item != null && item.status !== 'drafted'} onChange={(ev) => setCoverNote(ev.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Add the cover note — <span style={{ color: 'var(--text-muted)' }}>{lienNoticeCoverNote(noticeFields.claimantName, monthsList)}</span>
          </span>
        </label>
      </div>

      {leader && (selected.pile === 'awaiting' || selected.pile === 'held' || selected.pile === 'to_draft') && selected.gcCustomerId ? (
        <div style={boxStyle}>
          <div style={boxHead}>Standing rule for {gc?.name ?? 'this GC'}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            {LIEN_NOTICE_POLICIES.map((p) => (
              <label key={p.key} title={p.hint} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: (rulePick ?? selected.policy) === p.key ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                <input type="radio" name="lien-rule" checked={(rulePick ?? selected.policy) === p.key} onChange={() => { setRulePick(p.key); void saveRule(p.key) }} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A rule sets the default for every future month on every {gc?.name ?? 'GC'} job. You still see each send in your FYI list, and a live promise always comes back to you.</div>
        </div>
      ) : null}
    </div>
  ) : (
    <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
  )

  // ---------- footer by state / role ----------
  let footer: React.ReactNode = null
  if (selected) {
    const state = selected.pile
    const monthsWord = monthsList.length ? describeNoticeMonths(monthsList) : 'no months'
    if (state === 'needs_owner' || state === 'to_draft' || (state === 'missed' && selected.dueMonths.length > 0)) {
      const blocked = !ready
      const say = blocked
        ? !gc?.name
          ? 'Blocked until the GC is on the job.'
          : !(ownerName && property.owner.mailingAddress)
            ? 'Blocked until the owner of record is on the property record.'
            : 'Pick at least one month.'
        : selected.policy === 'send' && !promise
          ? `${gc?.name} has a standing "send" rule — this goes straight to the run.`
          : selected.policy === 'hold'
            ? `${gc?.name} has a standing "hold" rule — this parks and re-asks before the deadline.`
            : promise
              ? `They promised ${formatYmdMonthDay(promise.promisedYmd)} — the leader decides between the paper and their word.`
              : `No standing rule for ${gc?.name ?? 'this GC'}, so this goes to the leader.`
      footer = (
        <>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-700)' }}>{monthsWord}</strong> on {jobLabel(job, selected.jobId)} · {say}
          </div>
          {skipOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-red-600)' }}>Skipping gives up the lien right on {monthsWord}.</span>
              <input value={skipReason} onChange={(ev) => setSkipReason(ev.target.value)} placeholder="why (kept on the record)" aria-label="Skip reason" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={skip} disabled={busy || !skipReason.trim()} style={btn('amber', busy || !skipReason.trim())}>Skip these months</button>
              <button type="button" onClick={() => setSkipOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : wordOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>Who said it, when, and how:</span>
              <input value={wordNote} onChange={(ev) => setWordNote(ev.target.value)} placeholder="Robert, today 9:10" aria-label="Who said it and when" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              {(['phone', 'in_person', 'text'] as const).map((c) => (
                <label key={c} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: wordChannel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                  <input type="radio" name="word-channel" checked={wordChannel === c} onChange={() => setWordChannel(c)} />
                  {c === 'phone' ? 'by phone' : c === 'in_person' ? 'in person' : 'by text'}
                </label>
              ))}
              <button type="button" onClick={sendOnWord} disabled={busy || !wordNote.trim()} style={btn('amber', busy || !wordNote.trim())}>Record it and send ▸</button>
              <button type="button" onClick={() => setWordOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setSkipOpen(true)} disabled={busy || !office} style={btn('plain', busy || !office)}>Skip these months…</button>
              <button type="button" onClick={saveDraft} disabled={busy || !office || monthsList.length === 0} style={btn('plain', busy || !office || monthsList.length === 0)}>Save draft</button>
              <span style={{ flex: 1 }} />
              {canSendOnWord(authRole) ? (
                <button type="button" onClick={() => { setWordNote(`${authName ? '' : ''}${'the leader'}, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={busy || blocked} style={btn('amber', busy || blocked)} title="The leader already said to send it — record who, when and how, and it goes in the run">
                  The leader said to send it ▸
                </button>
              ) : null}
              {leader ? (
                <button type="button" onClick={() => run('Approve', async () => { const id = await ensureDraft(); await approveLienDeskItem(id) }, 'Approved — it is in the run.')} disabled={busy || blocked} style={btn('green', busy || blocked)}>
                  Approve ▸
                </button>
              ) : (
                <button type="button" onClick={sendToLeader} disabled={busy || blocked || !office} style={btn('primary', busy || blocked || !office)}>
                  {selected.policy === 'send' && !promise ? 'Put it in the run ▸' : 'Send for approval ▸'}
                </button>
              )}
            </div>
          )}
        </>
      )
    } else if (state === 'awaiting') {
      footer = leader ? (
        <>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Approves <strong style={{ color: 'var(--text-700)' }}>{monthsWord}</strong> on {jobLabel(job, selected.jobId)}{rulePick ? ` and keeps the rule "${LIEN_NOTICE_POLICIES.find((p) => p.key === rulePick)?.label}"` : ''}.
          </div>
          {holdOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>
                Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again.{' '}
                <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
              </span>
              <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
              <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
              <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
              <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve &amp; next ▸</button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>Waiting on the leader since {selected.item?.submitted_at ? demandDate(selected.item.submitted_at.slice(0, 10)) : '—'}.</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
        </div>
      )
    } else if (state === 'ready') {
      footer = (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            {selected.item?.approval_mode === 'word' ? `On the leader's word — ${selected.item.word_note}` : selected.item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule` : `Approved${selected.item?.approved_at ? ` ${demandDate(selected.item.approved_at.slice(0, 10))}` : ''}`} · in the run.
          </span>
          {leader && selected.item?.approval_mode === 'word' ? (
            <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)} title="Pull it back to the office's draft — it has not gone out">Not what I said</button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => onOpenLienInstruments(selected.jobId)} disabled={!office} style={btn('plain', !office)} title="One notice on its own: print or email it and record the sends in the Lien window">
            Just this one, from the Lien window ›
          </button>
          <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="Every approved notice as one packet and one tracking form">
            Send the run · {counts?.ready ?? 0} ▸
          </button>
        </div>
      )
    } else if (state === 'held') {
      footer = (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            Held{selected.item?.hold_reason === 'promised' ? ' — they promised' : selected.item?.hold_reason === 'rule' ? ` — ${gc?.name ?? 'the GC'}'s standing rule` : " — the leader will call first"} · asks again {selected.item?.hold_until ? demandDate(selected.item.hold_until) : ''}.{' '}
            <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
          </span>
          <span style={{ flex: 1 }} />
          {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
        </div>
      )
    } else if (state === 'sent') {
      footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sent {selected.item?.sent_at ? demandDate(selected.item.sent_at.slice(0, 10)) : ''} · the notice is on the job's lien instruments.</div>
    } else if (state === 'missed') {
      footer = (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
          The window closed on {selected.missedMonths.map(workMonthLabel).join(', ')} with no notice — the lien right on that work is gone. {selected.item?.status === 'missed' ? `Skipped: ${parseLienDeskDraftFields(selected.item.fields)?.skipReason ?? ''}` : ''}
        </div>
      )
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lien desk"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1140px, calc(100vw - 2rem))', maxHeight: '92vh', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>⏱ Lien desk</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
              Every unpaid work month on a job with a GC needs its own § 53.056 notice — the office readies and drafts, the leader approves once per GC or per notice, the run goes out and is recorded.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', padding: '0.6rem 1.25rem 0.5rem', alignItems: 'center' }}>
          {LIEN_DESK_PILES.map((p) => {
            const n = counts?.[p.key] ?? 0
            if (n === 0 && pile !== p.key) return null
            const on = pile === p.key
            return (
              <button key={p.key} type="button" aria-pressed={on} onClick={() => setPile(on ? null : p.key)} style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: on ? 600 : 500, cursor: 'pointer' }}>
                {p.label} <strong>{n}</strong>
              </button>
            )
          })}
          {office && (counts?.ready ?? 0) > 0 ? (
            <button type="button" onClick={() => setRunOpen(true)} style={{ ...btn('primary'), marginLeft: 'auto' }} title="Every approved notice as one packet and one tracking form">
              Send the run · {counts?.ready}
            </button>
          ) : null}
          {leader && wordSent.length > 0 ? (
            <span style={{ marginLeft: office && (counts?.ready ?? 0) > 0 ? 0 : 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Notices the office sent on your spoken word">
              Sent on your word: {wordSent.map((e) => jobLabel(data?.jobsById[e.jobId], e.jobId).split(' · ')[0]).join(', ')}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', overflow: 'hidden', minHeight: 0 }}>
          {isMobile ? (mobileListShown ? list : pane) : (
            <>
              {list}
              {pane}
            </>
          )}
        </div>
        {footer ? <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{footer}</div> : null}
      </div>
      {runOpen && data ? (
        <LienDeskRunModal
          notices={buildLienDeskRun(data.queue.piles.ready, data, issuer, signerNameFor, todayYmd)}
          issuer={issuer}
          todayYmd={todayYmd}
          userId={authUserId}
          onClose={() => setRunOpen(false)}
          onRecorded={onChanged}
        />
      ) : null}
    </div>
  )
}
