import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useGcOnNoticeData, type GcOnNoticeData } from '../../hooks/useGcOnNoticeData'
import { legalRpc } from '../../hooks/useLegalMatters'
import { canSendLienOnWord, isLienLeader, isLienOffice, type LienDeskEntry } from '../../lib/jobs/lienDesk'
import {
  GC_NOTICE_REASONS,
  daysUntil,
  defaultGcNoticeCoverLetter,
  gcNoticeBatchReason,
  gcNoticeFooterWords,
  gcNoticeMonthWords,
  gcNoticeReasonLabel,
  type GcNoticeJob,
  type GcNoticeReasonKey,
} from '../../lib/jobs/gcOnNotice'
import { approveLienDeskItem, saveLienDeskDraft, sendLienDeskItemOnWord, setCustomerLienNoticePolicy, submitLienDeskItem } from '../../lib/jobs/lienDeskIo'
import { buildLienNoticeFieldsForJob, DEFAULT_CLAIMANT_NAME } from '../../lib/jobs/lienNoticeDraft'
import { buildLienDeskRun } from '../../lib/jobs/lienDeskRun'
import { eligibleForUseAll, propertyKey, readsAs, type OwnerToConfirmRow } from '../../lib/jobs/ownerConfirm'
import { confirmOwnerForProperty, stampOwnerConfirmed } from '../../lib/jobs/ownerConfirmWrite'
import { cachedLookupPropertyRecord, getCachedPropertyLookup } from '../../lib/customers/propertyLookupCache'
import { propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { parcelProvenanceLine, titleCaseUpperWords } from '../../lib/customers/propertyRecord'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { CUSTOMER_PAYMENT_TERMS } from '../../lib/customerPaymentTerms'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import {
  buildGcNoticeSteps,
  countGcNoticeChanges,
  daysLeftWords,
  gcNoticeChanges,
  gcNoticeClaimTotals,
  gcNoticeNextWindow,
  gcNoticeOwnersSettled,
  sortOwnerRowsAttentionFirst,
  splitNoticeMonths,
  type GcNoticeStepKey,
} from '../../lib/jobs/gcOnNoticeSteps'
import { jobsSharingProperty, normalizePropertyKind, propertyKindWords, sharedPropertyWords, type PropertyKind } from '../../lib/jobs/propertyKind'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import LienDeskRunModal from './LienDeskRunModal'
import PropertyKindSwitch from './PropertyKindSwitch'
import { GcNoticeStepBar, GcNoticeStepPill, GcNoticeStepSection } from './GcNoticeStepShell'
import { useGcNoticeStepSpy } from '../../hooks/useGcNoticeStepSpy'

/**
 * Put a GC on notice (v2.3470, PR 1 of `to-dos/gc-on-notice/`).
 *
 * One modal, the GC already picked, in the order the work goes: the owners
 * (the app looked every property up on the appraisal roll — Use all found,
 * a miss gets the door), what each notice claims (every unnoticed month, a
 * closed window named as information, an unbilled job's contract balance
 * said out loud), then the decision once — a reason kept on every notice's
 * record, the GC's standing rule, its payment terms, the Legal desk matter —
 * and **Approve all N** (master / dev) or **The leader said to send them**
 * (office, with the note) → N approved desk items → the run. The office can
 * also send the whole set to the leader. The cover letter is PR 2.
 *
 * The page is long on a real GC, so the four steps are made hard to lose
 * (v2.3665): a step bar pinned to the top of the scroll with each step's live
 * status, numbered step sections on a connecting line, a brief that says the
 * money once, Step 1 folded when every owner is on the job, and the claims
 * table giving its color to the windows still open. The statuses and totals
 * come from `gcOnNoticeSteps`; the shell is `GcNoticeStepShell`.
 */
export type GcOnNoticeModalProps = {
  open: boolean
  gcId: string | null
  onClose: () => void
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  authName: string
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  /** "Find the owner ›" / "link a property ›" — Edit Job, opened on its Property record row when `focus` says so. */
  onOpenEditJob: (jobId: string, focus?: 'property-record') => void
  /** After any write — the desk and the board re-read. */
  onChanged: () => void
  /** "Bill the finished work first ›" — the Pipeline's capable list. */
  onOpenCapableList?: () => void
}

const chip = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle' })
/** Filled buttons carry a white label, so the fill is a literal that holds in both themes — the `--text-*` tokens go pale in dark mode (v2.3656 on the desk). */
const FILL = { primary: '#2563eb', green: '#166534', amber: '#92400e' } as const
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'plain' ? 'var(--surface)' : FILL[kind],
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
/** The footer's buttons are the window's decision — a size up from the row buttons. */
const footBtn = (kind: 'primary' | 'green' | 'plain' = 'plain', disabled = false): CSSProperties => ({ ...btn(kind, disabled), padding: '8px 14px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700 })
/** Not yet billed, on the brief's split bar (saturated, literal in both themes). */
const UNBILLED_FILL = '#d97706'
const swatch: CSSProperties = { display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 5 }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', overflow: 'hidden' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.69rem', fontWeight: 600, color: 'var(--text-muted)', padding: '7px 12px', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 12px', borderTop: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const totalTd: CSSProperties = { ...td, background: 'var(--bg-subtle)', fontWeight: 700 }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const factLabel: CSSProperties = { color: 'var(--text-muted)' }
const fieldLabel: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }
const fillCode: CSSProperties = { fontSize: '0.72rem', background: 'var(--bg-muted)', padding: '1px 5px', borderRadius: 4 }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
/** A window still open carries the color; one closing within a week goes red; "None open" is quiet. Closed months are a plain column. */
const openMonthChip = (tone: 'open' | 'soon' | 'none'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 5,
  padding: '2px 9px',
  borderRadius: 6,
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: tone === 'soon' ? 'var(--bg-red-tint)' : tone === 'none' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)',
  color: tone === 'soon' ? 'var(--text-red-600)' : tone === 'none' ? 'var(--text-700)' : 'var(--text-blue-700)',
})
const STEP_KEYS: ReadonlyArray<GcNoticeStepKey> = ['owners', 'claims', 'letter', 'decision']

type Tick = { rule: boolean; terms: boolean; legal: boolean }

function jobLabel(d: GcOnNoticeData, jobId: string): string {
  const j = d.desk.jobsById[jobId]
  const n = j ? effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—' : '—'
  const name = (j?.job_name ?? '').trim()
  return name ? `${n} · ${name}` : n
}

function statusWords(j: GcNoticeJob): string {
  const months = `${j.months.length} mo`
  return j.isBilled ? `Billed · ${months} · ${formatUsdNoCents(j.claimAmount)} open` : `${j.jobStatus === 'working' ? 'Working' : 'Not billed'} · ${months} · ${formatUsdNoCents(j.claimAmount)} unbilled`
}

function ownerText(l: PropertyLookupOutcome): string {
  if (!l.ok) return ''
  return titleCaseUpperWords(l.proposal.ownerCompany || l.proposal.ownerName)
}

export default function GcOnNoticeModal({ open, gcId, onClose, todayYmd, authRole, authUserId, authName, issuer, signerNameFor, onOpenEditJob, onChanged, onOpenCapableList }: GcOnNoticeModalProps) {
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const { data, loading, refetch } = useGcOnNoticeData(open ? gcId : null, todayYmd)
  const leader = isLienLeader(authRole)
  const office = isLienOffice(authRole)
  const canWord = canSendLienOnWord(authRole)

  // Step 1: the roll's answer per property, saved rows for the sitting.
  const [lookups, setLookups] = useState<Record<string, PropertyLookupOutcome>>({})
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState<{ done: number; total: number } | null>(null)
  const [typed, setTyped] = useState<Record<string, { name: string; address: string }>>({})
  // Step 4
  const [reason, setReason] = useState<GcNoticeReasonKey>('not_paying_subs')
  const [note, setNote] = useState('')
  const [ticks, setTicks] = useState<Tick>({ rule: true, terms: true, legal: true })
  // Step 3 (v2.3482): the letter written once for all; seeded from the GC's name the first time the data lands.
  const [letter, setLetter] = useState('')
  const [includeLetter, setIncludeLetter] = useState(true)
  const letterSeededFor = useRef<string | null>(null)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<'phone' | 'in_person' | 'text'>('phone')
  const [busy, setBusy] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const runPendingRef = useRef(false)
  const cancelRef = useRef(false)
  // The step bar (v2.3665): which step is in view, and Step 1 folded once every owner is on the job (null — the app decides).
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [ownersOpenChoice, setOwnersOpenChoice] = useState<boolean | null>(null)
  // Step 2's kind switch (v2.3667): the job whose answered kind is being changed, and the property being saved.
  const [kindEditing, setKindEditing] = useState<string | null>(null)
  const [kindBusy, setKindBusy] = useState<string | null>(null)
  const [currentStep, jumpToStep] = useGcNoticeStepSpy(scrollRef, STEP_KEYS, open && !!data && data.jobs.length > 0)

  // Properties that still need an owner: group the missing rows by address and look them up.
  const missingByProperty = useMemo(() => {
    if (!data) return [] as { key: string; address: string; jobs: OwnerToConfirmRow[] }[]
    const map = new Map<string, { key: string; address: string; jobs: OwnerToConfirmRow[] }>()
    for (const j of data.jobs) {
      if (j.ownerState !== 'missing') continue
      const row = data.ownerRowByJob[j.jobId]
      if (!row) continue
      const key = propertyKey(row.jobAddress)
      const g = map.get(key) ?? { key, address: row.jobAddress, jobs: [] }
      g.jobs.push(row)
      map.set(key, g)
    }
    return [...map.values()]
  }, [data])

  useEffect(() => {
    if (!open) {
      cancelRef.current = true
      return
    }
    cancelRef.current = false
    setLookups({})
    setTyped({})
    setWordOpen(false)
    setRunOpen(false)
    setOwnersOpenChoice(null)
    setKindEditing(null)
    runPendingRef.current = false
    return () => {
      cancelRef.current = true
    }
  }, [open, gcId])

  useEffect(() => {
    if (!open || missingByProperty.length === 0) return
    const seeded: Record<string, PropertyLookupOutcome> = {}
    const todo: typeof missingByProperty = []
    for (const p of missingByProperty) {
      if (!p.address) continue
      const hit = getCachedPropertyLookup(p.address)
      if (hit) seeded[p.key] = hit
      else todo.push(p)
    }
    if (Object.keys(seeded).length) setLookups((prev) => ({ ...prev, ...seeded }))
    if (todo.length === 0) return
    setProgress({ done: 0, total: todo.length })
    void (async () => {
      let done = 0
      for (const p of todo) {
        if (cancelRef.current) return
        const res = await cachedLookupPropertyRecord(p.address)
        if (cancelRef.current) return
        done += 1
        setLookups((prev) => ({ ...prev, [p.key]: res }))
        setProgress({ done, total: todo.length })
      }
      setProgress(null)
    })()
  }, [open, missingByProperty])

  useEffect(() => {
    if (!data?.gc || letterSeededFor.current === data.gc.id) return
    letterSeededFor.current = data.gc.id
    setLetter(defaultGcNoticeCoverLetter({ gcName: data.gc.name, claimantName: (issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME }))
  }, [data, issuer])

  // The run opens once the re-read after Approve all has landed.
  useEffect(() => {
    if (!runPendingRef.current || loading || !data) return
    runPendingRef.current = false
    setRunOpen(true)
  }, [loading, data])

  if (!open) return null

  const gc = data?.gc ?? null
  const gcName = gc?.name || 'this GC'
  const s = data?.summary ?? null

  const foundOnRoll = missingByProperty.filter((p) => {
    const l = lookups[p.key]
    return l?.ok && l.proposal.found && eligibleForUseAll(readsAs(p.jobs[0]!, l.parcel))
  })
  const foundJobs = foundOnRoll.reduce((n, p) => n + p.jobs.length, 0)

  async function saveProperty(p: { key: string; address: string; jobs: OwnerToConfirmRow[] }): Promise<boolean> {
    const l = lookups[p.key]
    if (!l?.ok || !l.proposal.found) return false
    try {
      await confirmOwnerForProperty({ address: p.address, jobs: p.jobs, source: { kind: 'proposal', proposal: l.proposal }, userId: authUserId })
      return true
    } catch (e) {
      showToast(`Could not save the owner on ${p.address}: ${formatErrorMessage(e, 'write failed')}`, 'error')
      return false
    }
  }
  async function takeOneFound(p: { key: string; address: string; jobs: OwnerToConfirmRow[] }) {
    if (busyKey || busyAll) return
    setBusyKey(p.key)
    const ok = await saveProperty(p)
    setBusyKey(null)
    if (ok) {
      showToast(`Owner of record saved on ${p.address} — ${p.jobs.length} job${p.jobs.length === 1 ? '' : 's'} covered`, 'success')
      refetch()
      onChanged()
    }
  }
  async function takeAllFound() {
    if (busyKey || busyAll || foundOnRoll.length === 0) return
    const list = [...foundOnRoll]
    setBusyAll({ done: 0, total: list.length })
    let okCount = 0
    for (let i = 0; i < list.length; i++) {
      if (await saveProperty(list[i]!)) okCount += 1
      setBusyAll({ done: i + 1, total: list.length })
    }
    setBusyAll(null)
    if (okCount > 0) {
      showToast(`Owner of record saved on ${okCount} propert${okCount === 1 ? 'y' : 'ies'}`, 'success')
      refetch()
      onChanged()
    }
  }
  async function saveTyped(p: { key: string; address: string; jobs: OwnerToConfirmRow[] }) {
    const t = typed[p.key]
    if (!t || !t.name.trim() || !t.address.trim() || busyKey || busyAll) return
    setBusyKey(p.key)
    try {
      await confirmOwnerForProperty({
        address: p.address,
        jobs: p.jobs,
        source: {
          kind: 'record',
          record: { county: '', legal_description: '', property_kind: '', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: t.name.trim(), owner_mailing_address: t.address.trim(), parcel_source: '', parcel_tax_year: '', parcel_id: '', parcel_looked_up_at: '' } as never,
        },
        userId: authUserId,
      })
      showToast(`Owner of record saved on ${p.address}`, 'success')
      refetch()
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the owner'), 'error')
    } finally {
      setBusyKey(null)
    }
  }
  async function confirmUnconfirmed(j: GcNoticeJob) {
    const job = data?.desk.jobsById[j.jobId]
    if (!job?.customer_address_id || busyKey) return
    setBusyKey(j.jobId)
    try {
      await stampOwnerConfirmed(job.customer_address_id, authUserId)
      refetch()
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not confirm the owner'), 'error')
    } finally {
      setBusyKey(null)
    }
  }

  /** The kind lives on the saved property, so every job at the address follows; the re-read brings the new § 53.056 dates. */
  async function pickPropertyKind(j: GcNoticeJob, kind: PropertyKind) {
    const addressId = data?.desk.jobsById[j.jobId]?.customer_address_id
    if (!addressId || kindBusy) return
    setKindBusy(addressId)
    try {
      await savePropertyKind(addressId, kind)
      setKindEditing(null)
      refetch()
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the property kind'), 'error')
    } finally {
      setKindBusy(null)
    }
  }

  const batchReason = gcNoticeBatchReason(reason, note)

  /** Steps 1–2 → N desk items with the same reason, then the approval the role allows, then the ticks. */
  async function approveAll(mode: 'leader' | 'word' | 'to_leader') {
    if (!data || !gc || busy) return
    const ready = data.jobs.filter((j) => j.readiness === 'ready')
    if (ready.length === 0) return
    setBusy(true)
    let done = 0
    try {
      for (const j of ready) {
        const job = data.desk.jobsById[j.jobId]
        const fields = {
          notice: buildLienNoticeFieldsForJob({
            jobName: job?.job_name,
            jobAddress: job?.job_address,
            originalContractorName: gc.name,
            openBalance: j.claimAmount,
            contactPerson: signerNameFor(job?.master_user_id ?? null),
            issuer,
            todayYmd,
          }),
          gcEmail: gc.email,
          batchReason,
          ...(includeLetter && letter.trim() ? { coverLetter: letter.trim() } : {}),
        }
        const id = await saveLienDeskDraft({ itemId: j.item?.id ?? null, jobId: j.jobId, months: j.months.map((m) => m.key), fields, coverNote: true, userId: authUserId })
        if (mode === 'leader') await approveLienDeskItem(id)
        else if (mode === 'word') await sendLienDeskItemOnWord(id, { note: wordNote, channel: wordChannel })
        else await submitLienDeskItem(id, { status: 'awaiting_approval', reason: data.gcHasPriorNotice ? 'no_rule' : 'first_notice' })
        done += 1
      }
      if (mode !== 'to_leader') {
        const consequences: string[] = []
        if (ticks.rule && gc.policy !== 'send') {
          await setCustomerLienNoticePolicy(gc.id, 'send', batchReason)
          consequences.push('standing rule → send without asking')
        }
        if (ticks.terms && data.gcTerms !== 'winding_down') {
          await withSupabaseRetry(
            () => supabase.from('customers').update({ payment_terms: 'winding_down', payment_terms_note: batchReason, payment_terms_set_by: authUserId, payment_terms_set_at: new Date().toISOString() } as never).eq('id', gc.id),
            'GC on notice: payment terms',
          )
          consequences.push('terms → Winding down')
        }
        if (ticks.legal) {
          const jobIds = [...new Set([...data.legalMatterJobIds, ...data.jobs.map((j) => j.jobId)])]
          const err = await legalRpc('legal_matter_save_review', { p_payer_key: `c:${gc.id}`, p_customer_id: gc.id, p_payer_name: gc.name, p_job_ids: jobIds })
          if (err) showToast(`The Legal desk matter could not be saved: ${err}`, 'error')
          else consequences.push(`Legal desk matter · ${jobIds.length} jobs`)
        }
        showToast(`${done} notice${done === 1 ? '' : 's'} approved for ${gc.name}${consequences.length ? ` · ${consequences.join(' · ')}` : ''}. The run is next.`, 'success')
        runPendingRef.current = true
      } else {
        showToast(`${done} notice${done === 1 ? '' : 's'} sent to the leader for ${gc.name}.`, 'success')
      }
      setWordOpen(false)
      refetch()
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, `Stopped after ${done} of ${ready.length}`), 'error')
      refetch()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const runEntries: LienDeskEntry[] = data ? data.desk.queue.entries.filter((e) => e.item?.status === 'approved') : []
  const readyCount = s?.ready ?? 0
  const blocked = busy || readyCount === 0 || loading
  const hasRows = !!data && !!s && data.jobs.length > 0

  // What the step bar, the step headers and the claims table read (kernel: gcOnNoticeSteps).
  const termsLabel = CUSTOMER_PAYMENT_TERMS.find((t) => t.key === data?.gcTerms)?.label ?? data?.gcTerms ?? ''
  const changes = data && s ? gcNoticeChanges({ policy: gc?.policy, termsKey: data.gcTerms, termsLabel, legalMatterExists: data.legalMatterExists, legalMatterJobs: data.legalMatterJobIds.length, jobs: s.jobs, publicOwners: s.publicOwners }) : []
  const steps = s
    ? buildGcNoticeSteps({ summary: s, foundOnRoll: foundJobs, lookingUp: progress != null, claimTotalWords: formatUsdNoCents(s.claimTotal), includeLetter, letterIsEmpty: !letter.trim(), reasonLabel: gcNoticeReasonLabel(reason), changes: countGcNoticeChanges(changes, ticks) })
    : []
  const stepOf = (key: GcNoticeStepKey) => steps.find((st) => st.key === key)!
  const totals = data ? gcNoticeClaimTotals(data.jobs) : null
  const nextWindow = data ? gcNoticeNextWindow(data.jobs, todayYmd) : null
  const ownersOpen = ownersOpenChoice ?? (s ? !gcNoticeOwnersSettled(s) : true)
  const ownerRows = data ? sortOwnerRowsAttentionFirst(data.jobs) : []
  const ticksLocked = !leader && !canWord

  // The Dispatch / Job mode footer is fixed at z 1000; the overlay ends above it (--app-bottom-chrome) so the footer's buttons are never under the bar — as on the desk (v2.3522).
  return (
    <div role="dialog" aria-modal="true" aria-label="Put a GC on notice" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1140px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 2rem - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1.25rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gap: '0.25rem', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
                <path d="M12 3 1.8 20.5h20.4L12 3Z" fill="#f59e0b" />
                <path d="M12 9.5v5.2" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="12" cy="17.6" r="1.15" fill="#1a1a1a" />
              </svg>
              <h2 style={{ margin: 0, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>Put {gcName} on notice</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem 0.75rem', alignItems: 'baseline', flexWrap: 'wrap', paddingLeft: 'calc(22px + 0.6rem)' }}>
              {data && hasRows ? data.gcHasPriorNotice ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>noticed before</span> : <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>first notice we've sent them</span> : null}
              <details style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '82ch' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, width: 'fit-content' }}>What this does</summary>
                <p style={{ margin: '0.25rem 0 0' }}>
                  Every job with this GC and unpaid work. One § 53.056 notice per job naming every unnoticed month, to the owner of record and to {gcName}, in one run. Once an owner has it, they may withhold what we are owed from any payment to {gcName} and never owe it twice (§ 53.081).
                </p>
              </details>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>

        <div ref={scrollRef} style={{ overflow: 'auto', minHeight: 0, position: 'relative' }}>
          {loading && !data ? <p style={{ ...faint, margin: 0, padding: '0.9rem 1.25rem' }}>Reading every job with unpaid work under {gcName}…</p> : null}
          {!loading && data && data.jobs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', padding: '0.9rem 1.25rem' }}>No job with unpaid work and approved hours names {gcName} as its GC. Nothing to send.</p>
          ) : null}
          {data && s && totals && hasRows ? (
            <>
              <GcNoticeStepBar steps={steps} current={currentStep} onJump={jumpToStep} compact={isMobile} />
              <div style={{ padding: '1rem 1.25rem 1.5rem', display: 'grid' }}>
                {/* the brief: what is open and what is known, said once */}
                <div data-testid="gc-notice-brief" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 5fr) 7fr', gap: '1rem 1.75rem', paddingBottom: '1.1rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={faint}>Open with {gcName}, across {s.jobs} job{s.jobs === 1 ? '' : 's'}</div>
                    <div style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(s.openOnBills + s.notYetBilled)}</div>
                    {s.openOnBills + s.notYetBilled > 0 ? (
                      <div aria-hidden="true" style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', margin: '0.6rem 0 0.4rem' }}>
                        {s.openOnBills > 0 ? <span style={{ flex: s.openOnBills, background: FILL.primary }} /> : null}
                        {s.notYetBilled > 0 ? <span style={{ flex: s.notYetBilled, background: UNBILLED_FILL }} /> : null}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: '0.25rem 1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-700)' }}>
                      <span><span aria-hidden="true" style={{ ...swatch, background: FILL.primary }} /><strong>{formatUsdNoCents(s.openOnBills)}</strong> open on bills · {s.billedJobs} job{s.billedJobs === 1 ? '' : 's'}</span>
                      <span><span aria-hidden="true" style={{ ...swatch, background: UNBILLED_FILL }} /><strong>{formatUsdNoCents(s.notYetBilled)}</strong> not yet billed · {s.unbilledJobs} job{s.unbilledJobs === 1 ? '' : 's'} · claims the contract balance</span>
                    </div>
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 0.9rem', fontSize: '0.8125rem', margin: 0, alignContent: 'start' }}>
                    <dt style={factLabel}>Their word</dt>
                    <dd style={{ margin: 0 }}>{data.promise ? <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(data.promise.promisedYmd)}{data.promise.markedByName ? ` · ${data.promise.markedByName}` : ''}</span> : 'No live promise'}</dd>
                    <dt style={factLabel}>Standing rule</dt>
                    <dd style={{ margin: 0 }}>{gc?.policy === 'send' ? 'Send without asking' : gc?.policy === 'hold' ? 'Hold' : 'Ask each time'}</dd>
                    <dt style={factLabel}>Payment terms</dt>
                    <dd style={{ margin: 0 }}>{termsLabel}</dd>
                    <dt style={factLabel}>Legal desk</dt>
                    <dd style={{ margin: 0 }}>{data.legalMatterExists ? `A matter exists · ${data.legalMatterJobIds.length} job${data.legalMatterJobIds.length === 1 ? '' : 's'} on it` : 'No matter yet'}</dd>
                    <dt style={factLabel}>Unpaid work</dt>
                    <dd style={{ margin: 0 }}>{s.unpaidMonths} month{s.unpaidMonths === 1 ? '' : 's'}</dd>
                    {nextWindow ? (
                      <>
                        <dt style={factLabel}>Next window</dt>
                        <dd style={{ margin: 0, color: nextWindow.days <= 7 ? 'var(--text-red-600)' : undefined }}>
                          <strong>{formatYmdMonthDay(nextWindow.deadline)}</strong> · {daysLeftWords(nextWindow.days)} · {nextWindow.jobs} job{nextWindow.jobs === 1 ? '' : 's'}{nextWindow.days <= 7 ? ' — a run recorded today keeps it' : ''}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {data.promise ? <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>A live promise: the desk would send these to the leader either way — "paper, or their word".</div> : null}
                </div>

                {/* STEP 1 */}
                <GcNoticeStepSection
                  step={stepOf('owners')}
                  current={currentStep === 'owners'}
                  title="The owners"
                  description={progress ? `Looking up ${Math.min(progress.done + 1, progress.total)} of ${progress.total} on the appraisal roll…` : 'A notice can only go to an owner of record. The app looks every property without one up on the appraisal roll as this opens.'}
                  right={
                    <>
                      {office && (foundOnRoll.length > 0 || busyAll != null) ? (
                        <button type="button" onClick={() => void takeAllFound()} disabled={busyAll != null || busyKey != null || foundOnRoll.length === 0} style={btn('green', busyAll != null || busyKey != null || foundOnRoll.length === 0)} data-testid="gc-notice-use-all">
                          {busyAll ? `Saving ${busyAll.done} of ${busyAll.total}…` : `Use all found · ${foundOnRoll.length} ▸`}
                        </button>
                      ) : null}
                      <GcNoticeStepPill tone={stepOf('owners').tone} testId="gc-notice-owners-pill">{stepOf('owners').tone === 'done' ? '✓ ' : ''}{s.ownersOnFile + s.publicOwners} of {s.jobs} on file</GcNoticeStepPill>
                    </>
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderRadius: 9, fontSize: '0.8125rem', border: `1px solid ${stepOf('owners').tone === 'done' ? 'var(--border-green)' : 'var(--border-amber)'}`, background: stepOf('owners').tone === 'done' ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)' }}>
                    <span>{gcNoticeOwnersSettled(s) ? 'Every job has an owner of record on the job. Nothing to do here.' : stepOf('owners').status}</span>
                    <button type="button" style={linkBtn} onClick={() => setOwnersOpenChoice(!ownersOpen)} aria-expanded={ownersOpen} data-testid="gc-notice-owners-toggle">
                      {ownersOpen ? 'Hide the owners ▴' : `Show the ${s.jobs} owner${s.jobs === 1 ? '' : 's'} ▾`}
                    </button>
                  </div>
                  {ownersOpen ? (
                    <div style={card}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                          <thead><tr><th style={th}>Job</th><th style={th}>Property</th><th style={th}>Owner of record</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
                          <tbody>
                            {ownerRows.map((j) => {
                              const row = data.ownerRowByJob[j.jobId]
                              const key = row ? propertyKey(row.jobAddress) : j.jobId
                              const group = missingByProperty.find((p) => p.key === key)
                              const l = group ? lookups[group.key] : undefined
                              const proposal = l?.ok ? l.proposal : null
                              const parcel = l?.ok ? l.parcel : null
                              const chips = proposal?.found && row ? readsAs(row, parcel) : []
                              const county = proposal?.county.county || data.countyByJob[j.jobId] || ''
                              const propId = proposal?.provenance?.propId ?? ''
                              const cadUrl = txCountyCadPropertyUrl(county, propId) || txCountyCadSearchUrl(county)
                              const provenance = proposal?.provenance ? parcelProvenanceLine({ parcel_source: proposal.provenance.source, parcel_tax_year: proposal.provenance.taxYear, parcel_id: '' }) : ''
                              const t = typed[key] ?? { name: '', address: '' }
                              const rowBg = j.ownerState === 'public' ? 'var(--bg-red-tint)' : j.ownerState === 'missing' && l && !(proposal?.found) ? 'var(--bg-amber-tint)' : undefined
                              return (
                                <tr key={j.jobId} style={{ background: rowBg }} data-testid="gc-notice-owner-row" data-owner-state={j.ownerState}>
                                  <td style={{ ...td, whiteSpace: isMobile ? undefined : 'nowrap' }}><strong>{jobLabel(data, j.jobId)}</strong><div style={faint}>{statusWords(j)}</div></td>
                                  <td style={td}>{row?.jobAddress || '—'}<div style={faint}>{county || '—'}</div></td>
                                  <td style={td}>
                                    {j.ownerState === 'on_file' ? (
                                      <><span style={{ color: 'var(--text-green-800)', fontWeight: 700 }}>✓</span> {data.ownerLineByJob[j.jobId]}</>
                                    ) : j.ownerState === 'public' ? (
                                      <><span style={{ color: 'var(--text-red-600)', fontWeight: 700 }}>✗</span> {data.ownerLineByJob[j.jobId]}<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}><span style={chip('var(--bg-red-tint)', 'var(--text-red-600)')}>public owner — bond claim, not a lien</span><span style={faint}>left out of the run · talk to the attorney</span></div></>
                                    ) : j.ownerState === 'unconfirmed' ? (
                                      <><span style={{ color: 'var(--text-amber-800)', fontWeight: 700 }}>!</span> {data.ownerLineByJob[j.jobId]}<div style={faint}>from the roll · unconfirmed — the run refuses to record until someone confirms it</div></>
                                    ) : !l ? (
                                      <><span style={{ color: 'var(--text-red-600)', fontWeight: 700 }}>✗</span> missing<div style={faint}>{progress ? 'waiting for the roll…' : 'not looked up'}</div></>
                                    ) : proposal?.found ? (
                                      <>
                                        <span style={{ color: 'var(--text-green-800)', fontWeight: 700 }}>✓</span> {ownerText(l)}{proposal.ownerMailingAddress ? ` · mail to ${titleCaseUpperWords(proposal.ownerMailingAddress)}` : ' · no mailing address on the roll'}
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                                          {chips.map((c) => <span key={c.key} style={chip(c.tone === 'red' ? 'var(--bg-red-tint)' : c.tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', c.tone === 'red' ? 'var(--text-red-600)' : c.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)')}>{c.label}</span>)}
                                          <span style={faint}>the roll says{provenance ? ` · ${provenance}` : ''}{group && group.jobs.length > 1 ? ` · one Use covers ${group.jobs.length} jobs here` : ''}</span>
                                          {cadUrl ? <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)}>{propId ? `this parcel on ${county} CAD ↗` : `${county} CAD ↗`}</button> : null}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <span style={{ color: 'var(--text-red-600)', fontWeight: 700 }}>✗</span> {l.ok ? 'No parcel under the pin' : propertyLookupErrorMessage(l.error)}
                                        <div style={{ ...faint, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                          <span>the roll could not place it ·</span>
                                          <button type="button" style={linkBtn} onClick={() => onOpenEditJob(j.jobId)}>Find the owner ›</button>
                                          <span>· or type it:</span>
                                        </div>
                                      </>
                                    )}
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {j.ownerState === 'on_file' ? <span style={chip('var(--bg-green-tint)', 'var(--text-green-800)')}>on the job</span> : null}
                                    {j.ownerState === 'public' ? <span style={chip('var(--bg-muted)', 'var(--text-muted)')}>excluded</span> : null}
                                    {j.ownerState === 'unconfirmed' && office ? <button type="button" onClick={() => void confirmUnconfirmed(j)} disabled={busyKey != null} style={btn('primary', busyKey != null)}>Confirm</button> : null}
                                    {j.ownerState === 'missing' && group && proposal?.found && office ? (
                                      <button type="button" onClick={() => void takeOneFound(group)} disabled={busyKey != null || busyAll != null || !eligibleForUseAll(chips)} style={btn('primary', busyKey != null || busyAll != null || !eligibleForUseAll(chips))} data-testid="gc-notice-use">
                                        {busyKey === group.key ? 'Saving…' : 'Use'}
                                      </button>
                                    ) : null}
                                    {j.ownerState === 'missing' && group && l && !proposal?.found && office ? (
                                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <input value={t.name} onChange={(ev) => setTyped((prev) => ({ ...prev, [key]: { ...t, name: ev.target.value } }))} placeholder="Owner name…" aria-label={`Owner name for ${row?.jobAddress ?? j.jobId}`} style={{ width: 130, fontSize: '0.75rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6 }} />
                                        <input value={t.address} onChange={(ev) => setTyped((prev) => ({ ...prev, [key]: { ...t, address: ev.target.value } }))} placeholder="Mailing address…" aria-label={`Mailing address for ${row?.jobAddress ?? j.jobId}`} style={{ width: 170, fontSize: '0.75rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6 }} />
                                        <button type="button" onClick={() => void saveTyped(group)} disabled={busyKey != null || !t.name.trim() || !t.address.trim()} style={btn('plain', busyKey != null || !t.name.trim() || !t.address.trim())}>Save</button>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </GcNoticeStepSection>

                {/* STEP 2 */}
                <GcNoticeStepSection
                  step={stepOf('claims')}
                  current={currentStep === 'claims'}
                  title="What each notice claims"
                  description="Every month with approved hours and no live notice — no 30-day window. A month whose window has closed is still named as information: its lien is gone, the owner still learns the balance."
                  right={<GcNoticeStepPill tone={stepOf('claims').tone}>{stepOf('claims').status}</GcNoticeStepPill>}
                >
                  {totals.kindUnknown > 0 ? (
                    <div data-testid="gc-notice-kind-callout" style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 9, fontSize: '0.78rem' }}>
                      <strong>{totals.kindUnknown === totals.notices ? `Property kind isn't set on any of these ${totals.notices} job${totals.notices === 1 ? '' : 's'}.` : `Property kind isn't set on ${totals.kindUnknown} of these ${totals.notices} jobs.`}</strong> Commercial dates are shown for {totals.kindUnknown === 1 ? 'it' : 'them'}; a residential property is due a month earlier. Answer it on the row — the dates follow.
                    </div>
                  ) : null}
                  <div style={card}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead><tr><th style={th}>Job</th><th style={th}>Windows still open</th><th style={th}>Also named · window closed</th><th style={{ ...th, textAlign: 'right' }}>Affidavit by</th><th style={{ ...th, textAlign: 'right' }}>Claim</th></tr></thead>
                        <tbody>
                          {data.jobs.filter((j) => j.readiness !== 'public_owner').map((j) => {
                            const split = splitNoticeMonths(j.months)
                            return (
                              <tr key={j.jobId} data-testid="gc-notice-claim-row" data-readiness={j.readiness}>
                                <td style={{ ...td, whiteSpace: isMobile ? undefined : 'nowrap' }}>
                                  <strong>{jobLabel(data, j.jobId)}</strong>
                                  {(() => {
                                    const kind = normalizePropertyKind(j.propertyKind)
                                    const addressId = data.desk.jobsById[j.jobId]?.customer_address_id ?? null
                                    const shared = sharedPropertyWords(jobsSharingProperty(j.jobId, data.jobs.map((x) => x.jobId), (id) => data.desk.jobsById[id]?.customer_address_id).map((id) => jobLabel(data, id).split(' · ')[0]!))
                                    // No saved property on the job: there is nowhere to keep the answer yet — Edit Job links one.
                                    if (!addressId && !kind) return <div style={faint}>{propertyKindWords(kind)} · <button type="button" style={linkBtn} onClick={() => onOpenEditJob(j.jobId, 'property-record')}>link a property ›</button></div>
                                    if (office && addressId && (!kind || kindEditing === j.jobId)) {
                                      return (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                                          <PropertyKindSwitch value={kind} onPick={(k) => void pickPropertyKind(j, k)} disabled={kindBusy != null} label={`Property kind for ${jobLabel(data, j.jobId)}`} />
                                          {kindBusy === addressId ? <span style={faint}>saving…</span> : shared ? <span style={faint}>{shared}</span> : null}
                                        </div>
                                      )
                                    }
                                    return (
                                      <div style={faint}>
                                        {propertyKindWords(kind)}
                                        {office && kind && addressId ? <> · <button type="button" style={linkBtn} onClick={() => setKindEditing(j.jobId)}>change</button></> : null}
                                        {shared ? ` · ${shared}` : ''}
                                      </div>
                                    )
                                  })()}
                                  {j.readiness === 'already_sent' ? <div><span style={chip('var(--bg-green-tint)', 'var(--text-green-800)')}>approved · in the run</span></div> : j.item?.status === 'awaiting_approval' ? <div><span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>awaiting the leader</span></div> : j.item?.status === 'held' ? <div><span style={chip('var(--bg-muted)', 'var(--text-muted)')}>held · folded into this run</span></div> : null}
                                </td>
                                <td style={td}>
                                  {j.months.length === 0 ? <span style={faint}>every month is already noticed{j.noticedMonths.length ? ` (${j.noticedMonths.map(workMonthShort).join(', ')})` : ''}</span> : split.open.length === 0 ? <span style={openMonthChip('none')}>None open</span> : (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                      {split.open.map((m) => {
                                        const d = daysUntil(m.deadline || null, todayYmd)
                                        return (
                                          <span key={m.key} style={openMonthChip(d != null && d <= 7 ? 'soon' : 'open')} data-testid="gc-notice-open-month">
                                            <strong>{workMonthShort(m.key)}</strong>{m.deadline ? <span style={{ fontWeight: 500 }}>by {formatYmdMonthDay(m.deadline)}{d != null ? ` · ${daysLeftWords(d)}` : ''}</span> : null}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td style={{ ...td, color: 'var(--text-muted)' }} data-testid="gc-notice-closed-months">
                                  {split.closed.length === 0 ? '—' : split.closed.map((m, i) => <span key={m.key} title={gcNoticeMonthWords(m, workMonthShort, formatYmdMonthDay)}>{i > 0 ? ', ' : ''}{workMonthShort(m.key)}</span>)}
                                </td>
                                <td style={{ ...td, ...num }}>{j.affidavitBy ? formatYmdMonthDay(j.affidavitBy) : '—'}</td>
                                <td style={{ ...td, ...num }}>
                                  <strong>{formatUsdNoCents(j.claimAmount)}</strong>
                                  {j.isBilled ? <div style={faint}>open on bills</div> : (
                                    <div style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                                      <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>unbilled · contract balance</span>
                                      {onOpenCapableList ? <button type="button" style={linkBtn} onClick={onOpenCapableList}>Bill the finished work first ›</button> : null}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          <tr data-testid="gc-notice-claim-total">
                            <td style={{ ...totalTd }}>{totals.notices} notice{totals.notices === 1 ? '' : 's'}</td>
                            <td style={{ ...totalTd }}>{totals.openWindows} open window{totals.openWindows === 1 ? '' : 's'}</td>
                            <td style={{ ...totalTd, color: 'var(--text-muted)', fontWeight: 600 }}>{totals.closedWindows} named as information</td>
                            <td style={{ ...totalTd }}></td>
                            <td style={{ ...totalTd, ...num }}>{formatUsdNoCents(totals.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={faint}>Each row is the same document the Lien window prints, filled from the same job; the unpaid invoices ride behind it as the statute allows (§ 53.056(a-3)).</div>
                </GcNoticeStepSection>

                {/* STEP 3 — the cover letter, written once for all (v2.3482) */}
                <GcNoticeStepSection
                  step={stepOf('letter')}
                  current={currentStep === 'letter'}
                  title={`The cover letter, written once for all ${s.ready}`}
                  description="Printed as the first page of each owner's copy, on the letterhead, signed by the master. It replaces the standard cover note on these notices."
                  right={
                    <label style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)' }}>
                      <input type="checkbox" checked={includeLetter} onChange={(ev) => setIncludeLetter(ev.target.checked)} disabled={!office} /> Include the cover letter
                    </label>
                  }
                >
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 260px', gap: '0.85rem' }}>
                    {/* The letter is paper: it stays light in both themes, like the desk's notice (v2.3522). */}
                    <div data-theme="light" style={{ display: 'grid' }}>
                      <textarea
                        value={letter}
                        onChange={(ev) => setLetter(ev.target.value)}
                        disabled={!office || !includeLetter}
                        aria-label="Cover letter"
                        rows={12}
                        style={{ width: '100%', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '0.8125rem', lineHeight: 1.6, padding: '1.1rem 1.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.18)', background: 'var(--surface)', color: 'var(--text-base)', opacity: includeLetter ? 1 : 0.55, resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '0.7rem', alignContent: 'start', fontSize: '0.75rem', color: 'var(--text-700)' }}>
                      <div style={{ border: '1px solid var(--border-amber)', borderRadius: 9, padding: '0.5rem 0.75rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'grid', gap: 3 }}>
                        <strong>Attorney wording pending</strong>
                        <div>The § 53.081 withholding paragraph prints as written until the attorney replaces it for homeowners on residential projects.</div>
                      </div>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <div style={{ fontWeight: 600 }}>Filled in per notice</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', alignItems: 'baseline' }}>
                          <code style={fillCode}>{'{{property}}'}</code><span>the job's address</span>
                          <code style={fillCode}>{'{{months}}'}</code><span>the months named</span>
                          <code style={fillCode}>{'{{job}}'}</code><span>the job number</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>Everything else prints the same on all {s.ready}.</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>The letter is saved on every notice's record, so the office sees exactly what each owner read. The GC's copy carries the statutory form only.</div>
                    </div>
                  </div>
                </GcNoticeStepSection>

                {/* STEP 4 — the decision */}
                <GcNoticeStepSection
                  step={stepOf('decision')}
                  current={currentStep === 'decision'}
                  title="The decision, once"
                  description={`Made once for the whole run, and kept on every notice's record and on ${gcName}'s card.`}
                  last
                >
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div style={fieldLabel}>Why now</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                      {GC_NOTICE_REASONS.map((r) => (
                        <label key={r.key} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 12px', border: `1px solid ${reason === r.key ? 'var(--text-link)' : 'var(--border-strong)'}`, borderRadius: 999, background: reason === r.key ? 'var(--bg-blue-tint)' : 'var(--surface)', fontWeight: reason === r.key ? 600 : 400, cursor: 'pointer' }}>
                          <input type="radio" name="gc-notice-reason" checked={reason === r.key} onChange={() => setReason(r.key)} disabled={!office} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                    <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="What you know — who said what, when (kept on the record)" aria-label="Reason note" disabled={!office} style={{ fontSize: '0.8125rem', padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, width: '100%' }} />
                  </div>
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div style={fieldLabel}>Also change, when the run is recorded</div>
                    <div style={card}>
                      {changes.map((c, i) => (
                        <label key={c.key} data-testid="gc-notice-change" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'auto 1fr' : 'auto minmax(0, 1fr) auto', gap: '2px 12px', alignItems: 'start', padding: '0.65rem 0.75rem', borderTop: i > 0 ? '1px solid var(--border)' : undefined, cursor: ticksLocked ? 'default' : 'pointer' }}>
                          <input type="checkbox" checked={ticks[c.key]} onChange={(ev) => setTicks((t) => ({ ...t, [c.key]: ev.target.checked }))} disabled={ticksLocked} style={{ marginTop: 3, gridRow: 'span 2' }} />
                          <strong style={{ fontSize: '0.84rem' }}>{c.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', whiteSpace: isMobile ? undefined : 'nowrap', gridRow: isMobile ? undefined : 'span 2', gridColumn: isMobile ? 2 : undefined, alignSelf: 'center' }}>
                            {c.alreadySet ? <><span style={{ color: 'var(--text-muted)' }}>{c.label}: </span>{c.to} <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>already set</span></> : <><span style={{ color: 'var(--text-muted)' }}>{c.label}: </span><s style={{ color: 'var(--text-muted)' }}>{c.from}</s> → <strong>{c.to}</strong></>}
                          </span>
                          <span style={{ gridColumn: 2, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.why}</span>
                        </label>
                      ))}
                    </div>
                    {ticksLocked ? <div style={faint}>The ticks are the leader's — they apply when he approves.</div> : null}
                  </div>
                </GcNoticeStepSection>
              </div>
            </>
          ) : null}
        </div>

        {/* footer */}
        {data && s && hasRows ? (
          <div style={{ display: 'grid', gap: '0.5rem', padding: '0.65rem 1.25rem 0.75rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            {wordOpen ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span>Who said it, when, and how:</span>
                <input value={wordNote} onChange={(ev) => setWordNote(ev.target.value)} placeholder="Robert, today 9:10" aria-label="Who said it and when" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6 }} />
                {(['phone', 'in_person', 'text'] as const).map((c) => (
                  <label key={c} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: wordChannel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)', cursor: 'pointer' }}>
                    <input type="radio" name="gc-word-channel" checked={wordChannel === c} onChange={() => setWordChannel(c)} />
                    {c === 'phone' ? 'by phone' : c === 'in_person' ? 'in person' : 'by text'}
                  </label>
                ))}
                <button type="button" onClick={() => void approveAll('word')} disabled={blocked || !wordNote.trim()} style={btn('amber', blocked || !wordNote.trim())}>Record it and send all {readyCount} ▸</button>
                <button type="button" onClick={() => setWordOpen(false)} style={btn('plain')}>Cancel</button>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem 1.25rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)', flex: '1 1 320px', minWidth: 0 }}>
                <strong>{gcNoticeFooterWords(s, { foundOnRoll: foundJobs })}</strong>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {s.envelopes} envelope{s.envelopes === 1 ? '' : 's'} · {formatUsdNoCents(s.claimTotal)} claimed</span>
                <div style={faint}>
                  Approving hands every ready notice to the run. Nothing is mailed or recorded until <em>Record the run</em>.
                  {runEntries.length > 0 ? ` ${runEntries.length} approved notice${runEntries.length === 1 ? '' : 's'} already wait${runEntries.length === 1 ? 's' : ''} in the run.` : ''}
                </div>
              </div>
              {wordOpen ? null : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {runEntries.length > 0 && office ? <button type="button" onClick={() => setRunOpen(true)} style={footBtn('plain')}>Open the run · {runEntries.length} ▸</button> : null}
                  {canWord ? (
                    <button type="button" onClick={() => { setWordNote(`${authName ? '' : ''}the leader, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={blocked} style={footBtn('plain', blocked)}>The leader said to send them…</button>
                  ) : null}
                  {office && !leader ? <button type="button" onClick={() => void approveAll('to_leader')} disabled={blocked} style={footBtn('primary', blocked)}>Send all {readyCount} to the leader ▸</button> : null}
                  {leader ? <button type="button" onClick={() => void approveAll('leader')} disabled={blocked} style={footBtn('green', blocked)} data-testid="gc-notice-approve-all">Approve all {readyCount} and send the run ▸</button> : null}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {runOpen && data ? (
        <LienDeskRunModal
          notices={buildLienDeskRun(runEntries, data.desk, issuer, signerNameFor, todayYmd)}
          issuer={issuer}
          todayYmd={todayYmd}
          userId={authUserId}
          onClose={() => setRunOpen(false)}
          onRecorded={() => {
            refetch()
            onChanged()
          }}
        />
      ) : null}
    </div>
  )
}
