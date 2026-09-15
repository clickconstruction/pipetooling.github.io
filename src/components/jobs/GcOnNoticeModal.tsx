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
  closedWindowsSentence,
  daysUntil,
  gcNoticeBatchReason,
  gcNoticeFooterWords,
  gcNoticeMonthWords,
  type GcNoticeJob,
  type GcNoticeReasonKey,
} from '../../lib/jobs/gcOnNotice'
import { approveLienDeskItem, saveLienDeskDraft, sendLienDeskItemOnWord, setCustomerLienNoticePolicy, submitLienDeskItem } from '../../lib/jobs/lienDeskIo'
import { buildLienNoticeFieldsForJob } from '../../lib/jobs/lienNoticeDraft'
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
import LienDeskRunModal from './LienDeskRunModal'

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
  /** "Find the owner ›" — Edit Job → Property record. */
  onOpenEditJob: (jobId: string) => void
  /** After any write — the desk and the board re-read. */
  onChanged: () => void
  /** "Bill the finished work first ›" — the Pipeline's capable list. */
  onOpenCapableList?: () => void
}

const chip = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle' })
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): CSSProperties => ({
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
const boxStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', background: 'var(--surface)' }
const boxHead: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px', borderBottom: '1px solid var(--border)' }
const td: CSSProperties = { padding: '7px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
const monthChip = (closed: boolean, dueSoon: boolean): CSSProperties => ({
  display: 'inline-flex',
  gap: 5,
  alignItems: 'center',
  padding: '2px 8px',
  border: `1px solid ${closed || dueSoon ? 'var(--text-red-600)' : 'var(--border)'}`,
  borderRadius: 6,
  fontSize: '0.75rem',
  color: closed ? 'var(--text-red-600)' : 'inherit',
  background: dueSoon && !closed ? 'var(--bg-red-tint)' : 'transparent',
})

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
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<'phone' | 'in_person' | 'text'>('phone')
  const [busy, setBusy] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const runPendingRef = useRef(false)
  const cancelRef = useRef(false)

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
  const soon = s ? daysUntil(s.earliestOpenDeadline, todayYmd) : null
  const readyCount = s?.ready ?? 0
  const blocked = busy || readyCount === 0 || loading

  return (
    <div role="dialog" aria-modal="true" aria-label="Put a GC on notice" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1140px, calc(100vw - 2rem))', maxHeight: '92vh', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>⚠ Put {gcName} on notice</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
              Every job with this GC and unpaid work. One § 53.056 notice per job naming every unnoticed month, to the owner of record and to {gcName}, in one run. Once an owner has it, they may withhold what we are owed from any payment to {gcName} and never owe it twice (§ 53.081).
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>

        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1.25rem 1rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
          {loading && !data ? <p style={{ ...faint, margin: 0 }}>Reading every job with unpaid work under {gcName}…</p> : null}
          {!loading && data && data.jobs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem' }}>No job with unpaid work and approved hours names {gcName} as its GC. Nothing to send.</p>
          ) : null}
          {data && s && data.jobs.length > 0 ? (
            <>
              {/* the strip */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: '0.6rem' }}>
                <div style={boxStyle}><div style={boxHead}>Jobs with unpaid work</div><div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{s.jobs}</div><div style={faint}>{s.billedJobs} billed · {s.unbilledJobs} not yet billed</div></div>
                <div style={boxStyle}><div style={boxHead}>Open on bills</div><div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{formatUsdNoCents(s.openOnBills)}</div><div style={faint}>{s.unpaidMonths} unpaid work month{s.unpaidMonths === 1 ? '' : 's'}</div></div>
                <div style={boxStyle}><div style={boxHead}>Not yet billed</div><div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{formatUsdNoCents(s.notYetBilled)}</div><div style={faint}>{s.unbilledJobs} job{s.unbilledJobs === 1 ? '' : 's'} · claims the contract balance</div></div>
                <div style={{ ...boxStyle, background: s.ownersMissing + s.ownersUnconfirmed > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)', borderColor: s.ownersMissing + s.ownersUnconfirmed > 0 ? 'var(--border-amber)' : 'var(--border-green)' }}>
                  <div style={boxHead}>Owners</div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{s.ownersOnFile + s.publicOwners} of {s.jobs} on file</div>
                  <div style={faint}>{progress ? `looking up ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : `the roll found ${foundJobs} more · ${Math.max(0, s.ownersMissing - foundJobs)} miss${Math.max(0, s.ownersMissing - foundJobs) === 1 ? '' : 'es'}`}{s.ownersUnconfirmed ? ` · ${s.ownersUnconfirmed} to confirm` : ''}{s.publicOwners ? ` · ${s.publicOwners} public` : ''}</div>
                </div>
              </div>

              {/* what you're deciding */}
              <div style={boxStyle}>
                <div style={boxHead}>What you're deciding</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Open with {gcName}: </span><strong>{formatUsdNoCents(s.openOnBills + s.notYetBilled)}</strong> across {s.jobs} job{s.jobs === 1 ? '' : 's'}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Their word: </span>{data.promise ? <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(data.promise.promisedYmd)}{data.promise.markedByName ? ` · ${data.promise.markedByName}` : ''}</span> : <span style={{ color: 'var(--text-muted)' }}>no live promise</span>}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Standing rule today: </span>{gc?.policy === 'send' ? 'send without asking' : gc?.policy === 'hold' ? 'hold' : 'ask each time'} {data.gcHasPriorNotice ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>noticed before</span> : <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>first notice we've sent them</span>} · <span style={{ color: 'var(--text-muted)' }}>terms: </span>{CUSTOMER_PAYMENT_TERMS.find((t) => t.key === data.gcTerms)?.label ?? data.gcTerms}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Legal desk: </span>{data.legalMatterExists ? `a matter exists · ${data.legalMatterJobIds.length} job${data.legalMatterJobIds.length === 1 ? '' : 's'} on it` : 'no matter yet'}</div>
                </div>
                {soon != null && soon <= 7 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>
                    The earliest open window closes {soon <= 0 ? 'today' : soon === 1 ? 'tomorrow' : `in ${soon} days`} ({formatYmdMonthDay(s.earliestOpenDeadline!)}). A run recorded today keeps it.
                  </div>
                ) : null}
                {data.promise ? <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>A live promise: the desk would send these to the leader either way — "paper, or their word".</div> : null}
              </div>

              {/* STEP 1 */}
              <div style={boxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={boxHead}>Step 1 · The owners</div>
                    <span style={faint}>{progress ? `Looking up ${Math.min(progress.done + 1, progress.total)} of ${progress.total} on the appraisal roll…` : s.ownersMissing > 0 ? 'The app looked every property without an owner up on the appraisal roll as this opened.' : 'Every job has an owner of record on file.'}</span>
                  </div>
                  {office ? (
                    <button type="button" onClick={() => void takeAllFound()} disabled={busyAll != null || busyKey != null || foundOnRoll.length === 0} style={btn('green', busyAll != null || busyKey != null || foundOnRoll.length === 0)} data-testid="gc-notice-use-all">
                      {busyAll ? `Saving ${busyAll.done} of ${busyAll.total}…` : `Use all found · ${foundOnRoll.length} ▸`}
                    </button>
                  ) : null}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr><th style={th}>Job</th><th style={th}>Property</th><th style={th}>Owner of record</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
                    <tbody>
                      {data.jobs.map((j) => {
                        const row = data.ownerRowByJob[j.jobId]
                        const key = row ? propertyKey(row.jobAddress) : j.jobId
                        const group = missingByProperty.find((p) => p.key === key)
                        const l = group ? lookups[group.key] : undefined
                        const proposal = l?.ok ? l.proposal : null
                        const parcel = l?.ok ? l.parcel : null
                        const chips = proposal?.found && row ? readsAs(row, parcel) : []
                        const county = proposal?.county.county ?? ''
                        const propId = proposal?.provenance?.propId ?? ''
                        const cadUrl = txCountyCadPropertyUrl(county, propId) || txCountyCadSearchUrl(county)
                        const provenance = proposal?.provenance ? parcelProvenanceLine({ parcel_source: proposal.provenance.source, parcel_tax_year: proposal.provenance.taxYear, parcel_id: '' }) : ''
                        const t = typed[key] ?? { name: '', address: '' }
                        const rowBg = j.ownerState === 'public' ? 'var(--bg-red-tint)' : j.ownerState === 'missing' && l && !(proposal?.found) ? 'var(--bg-amber-tint)' : undefined
                        return (
                          <tr key={j.jobId} style={{ background: rowBg }} data-testid="gc-notice-owner-row" data-owner-state={j.ownerState}>
                            <td style={td}><strong>{jobLabel(data, j.jobId)}</strong><div style={faint}>{statusWords(j)}</div></td>
                            <td style={td}>{row?.jobAddress || '—'}<div style={faint}>{county || '—'} · {j.propertyKind === 'residential' ? 'residential' : j.propertyKind === 'non_residential' ? 'commercial' : 'kind unknown'}</div></td>
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

              {/* STEP 2 */}
              <div style={boxStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <div style={boxHead}>Step 2 · What each notice claims</div>
                  <span style={faint}>every month with approved hours and no live notice · no 30-day window</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr><th style={th}>Job</th><th style={th}>Months named</th><th style={th}>Claim amount</th><th style={th}>Affidavit by</th></tr></thead>
                    <tbody>
                      {data.jobs.filter((j) => j.readiness !== 'public_owner').map((j) => {
                        const closedSentence = closedWindowsSentence(j.months, workMonthShort)
                        return (
                          <tr key={j.jobId} data-testid="gc-notice-claim-row" data-readiness={j.readiness}>
                            <td style={td}><strong>{jobLabel(data, j.jobId)}</strong> <span style={faint}>· {j.propertyKind === 'residential' ? 'residential' : j.propertyKind === 'non_residential' ? 'commercial' : 'kind unknown'}</span>{j.readiness === 'already_sent' ? <div><span style={chip('var(--bg-green-tint)', 'var(--text-green-800)')}>approved · in the run</span></div> : j.item?.status === 'awaiting_approval' ? <div><span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>awaiting the leader</span></div> : j.item?.status === 'held' ? <div><span style={chip('var(--bg-muted)', 'var(--text-muted)')}>held · folded into this run</span></div> : null}</td>
                            <td style={td}>
                              {j.months.length === 0 ? <span style={faint}>every month is already noticed{j.noticedMonths.length ? ` (${j.noticedMonths.map(workMonthShort).join(', ')})` : ''}</span> : (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {j.months.map((m) => {
                                    const d = daysUntil(m.deadline || null, todayYmd)
                                    return <span key={m.key} style={monthChip(m.closed, d != null && d <= 7)}>{gcNoticeMonthWords(m, workMonthShort, formatYmdMonthDay)}</span>
                                  })}
                                </div>
                              )}
                              {closedSentence ? <div style={{ ...faint, marginTop: 3 }}>{closedSentence}</div> : null}
                              {!j.propertyKind ? <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)', marginTop: 3 }}>! kind unknown — commercial dates shown; a residential property is a month earlier</div> : null}
                            </td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                              <strong>{formatUsdNoCents(j.claimAmount)}</strong>
                              {j.isBilled ? <div style={faint}>open on bills</div> : (
                                <div style={{ display: 'grid', gap: 2 }}>
                                  <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>unbilled · contract balance</span>
                                  {onOpenCapableList ? <button type="button" style={{ ...linkBtn, textAlign: 'left' }} onClick={onOpenCapableList}>Bill the finished work first ›</button> : null}
                                </div>
                              )}
                            </td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{j.affidavitBy ? formatYmdMonthDay(j.affidavitBy) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={faint}>Each row is the same document the Lien window prints, filled from the same job; the unpaid invoices ride behind it as the statute allows (§ 53.056(a-3)). The standard cover note goes with each.</div>
              </div>

              {/* STEP 4 (the cover letter, Step 3, is the next PR) */}
              <div style={boxStyle}>
                <div style={boxHead}>Step 3 · The decision, once</div>
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  <div style={faint}>Why now — kept on every notice's record and on {gcName}'s card:</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                    {GC_NOTICE_REASONS.map((r) => (
                      <label key={r.key} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: `1px solid ${reason === r.key ? 'var(--text-link)' : 'var(--border)'}`, borderRadius: 6, background: reason === r.key ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer' }}>
                        <input type="radio" name="gc-notice-reason" checked={reason === r.key} onChange={() => setReason(r.key)} disabled={!office} />
                        {r.label}
                      </label>
                    ))}
                  </div>
                  <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="What you know — who said what, when (kept on the record)" aria-label="Reason note" disabled={!office} style={{ fontSize: '0.8125rem', padding: '5px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, width: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.8125rem' }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={ticks.rule} onChange={(ev) => setTicks((t) => ({ ...t, rule: ev.target.checked }))} disabled={!leader && !canWord} style={{ marginTop: 3 }} />
                    <span>Set {gcName}'s standing rule to <strong>send notices without asking</strong> <span style={{ color: 'var(--text-muted)' }}>— starts the moment this run is recorded. This run is the first notice, approved by the leader; a rule never sends a GC's first notice.</span>{gc?.policy === 'send' ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>already set</span> : null}</span>
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={ticks.terms} onChange={(ev) => setTicks((t) => ({ ...t, terms: ev.target.checked }))} disabled={!leader && !canWord} style={{ marginTop: 3 }} />
                    <span>Set {gcName}'s payment terms to <strong>Winding down</strong> <span style={{ color: 'var(--text-muted)' }}>— finish open jobs, decline new ones</span>{data.gcTerms === 'winding_down' ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>already set</span> : null}</span>
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={ticks.legal} onChange={(ev) => setTicks((t) => ({ ...t, legal: ev.target.checked }))} disabled={!leader && !canWord} style={{ marginTop: 3 }} />
                    <span>{data.legalMatterExists ? 'Add all ' : 'Open a '}<strong>Legal desk</strong> matter for {gcName} with all {s.jobs} job{s.jobs === 1 ? '' : 's'} <span style={{ color: 'var(--text-muted)' }}>— the affidavits and the attorney start from one place{s.publicOwners ? '; the bond claim goes there too' : ''}</span></span>
                  </label>
                </div>
                {!leader && !canWord ? <div style={faint}>The ticks are the leader's — they apply when he approves.</div> : null}
              </div>
            </>
          ) : null}
        </div>

        {/* footer */}
        {data && s && data.jobs.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              <strong>{gcNoticeFooterWords(s, { foundOnRoll: foundJobs })}</strong>
              <div style={faint}>
                Approving hands every ready notice to the run — {s.ready} notice{s.ready === 1 ? '' : 's'} · {s.envelopes} envelope{s.envelopes === 1 ? '' : 's'} · {formatUsdNoCents(s.claimTotal)} claimed. Nothing is mailed or recorded until <em>Record the run</em>.
                {runEntries.length > 0 ? ` ${runEntries.length} approved notice${runEntries.length === 1 ? '' : 's'} already wait${runEntries.length === 1 ? 's' : ''} in the run.` : ''}
              </div>
            </div>
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
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                {runEntries.length > 0 && office ? <button type="button" onClick={() => setRunOpen(true)} style={btn('plain')}>Open the run · {runEntries.length} ▸</button> : null}
                <span style={{ flex: 1 }} />
                {office && !leader ? <button type="button" onClick={() => void approveAll('to_leader')} disabled={blocked} style={btn('primary', blocked)}>Send all {readyCount} to the leader ▸</button> : null}
                {canWord ? (
                  <button type="button" onClick={() => { setWordNote(`${authName ? '' : ''}the leader, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={blocked} style={btn('amber', blocked)}>The leader said to send them ▸</button>
                ) : null}
                {leader ? <button type="button" onClick={() => void approveAll('leader')} disabled={blocked} style={btn('green', blocked)} data-testid="gc-notice-approve-all">Approve all {readyCount} and send the run ▸</button> : null}
              </div>
            )}
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
