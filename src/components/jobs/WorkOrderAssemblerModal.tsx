import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { subLaborAssignPickerRows } from '../../lib/jobs/subLaborJobPicker'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import {
  buildSheetWorkOrderSnapshot,
  buildWorkOrderReferences,
  generalConditionsStanding,
  parseSubWorkOrderSnapshot,
  scopeItemsForTrade,
  sheetWorkOrderLabel,
  type SubScopeItem,
  type SubWorkOrderBond,
  type SubWorkOrderSnapshot,
} from '../../lib/subWorkOrders/subWorkOrder'
import { bidScopeLines, bidSubLaborTotals, buildWorkOrderDocument, renderWorkOrderDocumentHtml, WORK_ORDER_ISSUER } from '../../lib/subWorkOrders/workOrderDocument'
import { emitWorkOrderChanged } from '../../hooks/useJobWorkOrderCoverage'
import { WorkOrderDocumentView } from './WorkOrderDocumentView'

/**
 * The work order assembler (Work Orders tab, PR 2 — v2.2819): pick the job,
 * pick the sub, build the document in a live preview from three scope
 * sources (the trade's library, the job's bid takeoff, lines typed for this
 * job), set the terms, then send for signature or save a draft. Opened from
 * the Jobs → Work Orders board, the job window (PR 3), a sheet, or a step.
 * Drafts may be unpriced; Send requires a price (the master's review gate).
 */

export type WorkOrderAssemblerInitial = {
  /** Open on an existing order (draft → editable, sent/signed → the record). */
  commitmentId?: string | null
  jobId?: string | null
  personId?: string | null
  /** Anchor to carry when writing from a sheet or a step. */
  laborJobId?: string | null
  /** Sheet door (PR 3): the sheet total, pre-filled as the price. */
  amount?: number | null
  stepId?: string | null
}

type Roster = { id: string; name: string; email: string | null; notes: string | null }
type BookDoc = { id: string; document_name: string; book_version_date: string | null }
type PersonDoc = { document_name: string; doc_type: string; status: string; signed_at: string | null; expires_at: string | null; applied_version_date: string | null; applied_contract_template_document_id: string | null }
type Draft = {
  serviceTypeId: string | null
  tickedScope: Set<string>
  tickedBid: Set<number>
  customLines: string
  tickedExclusions: Set<string>
  tickedAcks: Set<string>
  checkedDocIds: Set<string>
  includePay: boolean
  includeInsurance: boolean
  bond: SubWorkOrderBond
  specialProvisions: string
  amount: string
  retainagePct: string
  proposedStart: string
  proposedEnd: string
  expires: string
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 } as const
const inputStyle = { width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-900)' } as const
const btn = (kind: 'primary' | 'ghost' | 'green', disabled = false) =>
  ({
    padding: '0.45rem 0.9rem',
    background: disabled ? '#9ca3af' : kind === 'primary' ? '#2563eb' : kind === 'green' ? '#16a34a' : 'var(--surface)',
    color: kind === 'ghost' ? 'var(--text-700)' : 'white',
    border: kind === 'ghost' ? '1px solid var(--border-strong)' : 'none',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }) as const
const boxStyle = { border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.2rem 0.6rem' } as const
const checkRow = { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' } as const
const srcTag = (kind: 'lib' | 'bid' | 'job') =>
  ({
    marginLeft: 'auto',
    fontSize: '0.62rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '1px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
    background: kind === 'lib' ? 'var(--bg-blue-tint)' : kind === 'bid' ? 'var(--bg-violet-100)' : 'var(--bg-amber-tint)',
    color: kind === 'lib' ? 'var(--text-blue-700)' : kind === 'bid' ? 'var(--text-violet-700)' : 'var(--text-amber-800)',
  }) as const


export function WorkOrderAssemblerModal({
  open,
  onClose,
  jobs,
  initial,
  authUserId,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  jobs: JobWithDetails[]
  initial: WorkOrderAssemblerInitial | null
  authUserId: string | undefined
  onChanged?: () => void
}) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [jobPickerOpen, setJobPickerOpen] = useState(false)
  const [jobSearch, setJobSearch] = useState('')
  const [jobNumberQuery, setJobNumberQuery] = useState('')
  const [roster, setRoster] = useState<Roster[]>([])
  const [personId, setPersonId] = useState<string>('')
  const [rosterSearch, setRosterSearch] = useState('')
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [addSub, setAddSub] = useState({ name: '', email: '', phone: '' })
  const [existing, setExisting] = useState<StepCommitmentRow | null>(null)
  const [scopeItems, setScopeItems] = useState<SubScopeItem[]>([])
  const [bookDocs, setBookDocs] = useState<BookDoc[]>([])
  const [payRunDay, setPayRunDay] = useState<string | null>(null)
  const [issuer, setIssuer] = useState<{ name: string | null; title: string | null }>({ name: null, title: null })
  const [personDocs, setPersonDocs] = useState<PersonDoc[]>([])
  const [bidLines, setBidLines] = useState<Array<{ stage: string; label: string }>>([])
  const [bidTotals, setBidTotals] = useState<{ rough_in: number; top_out: number; trim_set: number; total: number } | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showAllScope, setShowAllScope] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const readOnly = !!existing && existing.status !== 'draft' && existing.status !== 'declined'

  // ── loads ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [pRes, sRes, bRes, aRes, uRes] = await Promise.all([
          supabase.from('people').select('id, name, email, notes').eq('kind', 'sub').is('archived_at', null).order('name'),
          supabase.from('sub_scope_items').select('*').is('archived_at', null).order('sequence_order', { ascending: true }),
          supabase.from('contract_template_documents').select('id, document_name, book_version_date').eq('audience', 'sub').order('sequence_order', { ascending: true }),
          supabase.from('app_settings').select('key, value_text').in('key', ['sub_pay_run_day']),
          authUserId ? supabase.from('users').select('name, role').eq('id', authUserId).maybeSingle() : Promise.resolve({ data: null }),
        ])
        if (cancelled) return
        setRoster((pRes.data ?? []) as Roster[])
        setScopeItems(((sRes.data ?? []) as SubScopeItem[]).filter((i) => !i.archived_at))
        setBookDocs((bRes.data ?? []) as BookDoc[])
        setPayRunDay((((aRes.data ?? []) as Array<{ key: string; value_text: string | null }>)[0]?.value_text ?? '').trim() || null)
        const u = uRes.data as { name?: string | null; role?: string | null } | null
        setIssuer({ name: (u?.name ?? '').trim() || null, title: u?.role ? roleTitle(u.role) : null })
        let row: StepCommitmentRow | null = null
        if (initial?.commitmentId) {
          const { data } = await supabase.from('step_commitments').select('*').eq('id', initial.commitmentId).maybeSingle()
          row = (data ?? null) as StepCommitmentRow | null
        }
        if (cancelled) return
        setExisting(row)
        const jobId = row?.job_id ?? initial?.jobId ?? null
        const j = jobId ? jobs.find((x) => x.id === jobId) ?? null : null
        setJob(j)
        setPersonId(row?.person_id ?? initial?.personId ?? '')
        setStep(row || (j && (initial?.personId || row)) ? 3 : j ? 2 : 1)
      } catch (e) {
        showToast(`Could not open the assembler: ${formatErrorMessage(e)}`, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.commitmentId, initial?.jobId, initial?.personId])

  // The sub's paperwork + the job's bid, whenever either changes.
  useEffect(() => {
    if (!open || !personId) {
      setPersonDocs([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('person_contract_documents')
        .select('document_name, doc_type, status, signed_at, expires_at, applied_version_date, applied_contract_template_document_id')
        .eq('person_id', personId)
      if (!cancelled) setPersonDocs((data ?? []) as PersonDoc[])
    })()
    return () => {
      cancelled = true
    }
  }, [open, personId])

  useEffect(() => {
    const bidId = job?.bid_id ?? null
    if (!open || !bidId) {
      setBidLines([])
      setBidTotals(null)
      return
    }
    let cancelled = false
    void (async () => {
      const [{ data: versions }, { data: counts }, { data: estimates }] = await Promise.all([
        supabase.from('bid_versions').select('id, created_at').eq('bid_id', bidId).order('created_at', { ascending: false }).limit(1),
        supabase.from('bids_count_rows').select('fixture, count, group_tag, bid_version_id').eq('bid_id', bidId).order('sequence_order', { ascending: true }),
        supabase.from('cost_estimates').select('id').eq('bid_id', bidId),
      ])
      if (cancelled) return
      const latestVersion = ((versions ?? []) as Array<{ id: string }>)[0]?.id ?? null
      const rows = ((counts ?? []) as Array<{ fixture: string; count: number; group_tag: string | null; bid_version_id: string | null }>)
      const active = latestVersion && rows.some((r) => r.bid_version_id === latestVersion) ? rows.filter((r) => r.bid_version_id === latestVersion) : rows.filter((r) => r.bid_version_id == null)
      setBidLines(bidScopeLines(active.length > 0 ? active : rows))
      const estimateIds = ((estimates ?? []) as Array<{ id: string }>).map((e) => e.id)
      if (estimateIds.length > 0) {
        const { data: subRows } = await supabase.from('cost_estimate_subcontractor_rows').select('rough_in, top_out, trim_set').in('cost_estimate_id', estimateIds)
        if (!cancelled) setBidTotals(bidSubLaborTotals((subRows ?? []) as Array<{ rough_in: number | null; top_out: number | null; trim_set: number | null }>))
      } else {
        setBidTotals(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.bid_id])

  // Seed the editor once the job (trade) and any existing row are known.
  const serviceTypeIdOfJob = job?.service_type_id ?? null
  useEffect(() => {
    if (!open || loading) return
    if (step !== 3) return
    if (draft) return
    const prior = existing ? parseSubWorkOrderSnapshot(existing.offer_scope_snapshot) : null
    const scope = scopeItemsForTrade(scopeItems, serviceTypeIdOfJob, 'scope')
    const excl = scopeItemsForTrade(scopeItems, serviceTypeIdOfJob, 'exclusion')
    const acks = scopeItemsForTrade(scopeItems, serviceTypeIdOfJob, 'acknowledgement')
    const priorLabels = new Set((prior?.lines ?? []).map((l) => l.label.toLowerCase()))
    const libraryLabels = new Set(scope.map((s) => s.item.label.toLowerCase()))
    const bidLabels = new Set(bidLines.map((b) => b.label.toLowerCase()))
    const customLines = prior ? prior.lines.map((l) => l.label).filter((l) => !libraryLabels.has(l.toLowerCase()) && !bidLabels.has(l.toLowerCase())) : []
    const priorExcl = new Set((prior?.exclusions ?? []).map((x) => x.toLowerCase()))
    const priorAcks = new Set((prior?.acknowledgements ?? []).map((x) => x.toLowerCase()))
    const defaultExpires = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
    setDraft({
      serviceTypeId: serviceTypeIdOfJob,
      tickedScope: new Set(scope.filter(({ item, ticked }) => (prior ? priorLabels.has(item.label.toLowerCase()) : ticked)).map(({ item }) => item.id)),
      tickedBid: new Set(bidLines.map((b, i) => (prior ? (priorLabels.has(b.label.toLowerCase()) ? i : -1) : -1)).filter((i) => i >= 0)),
      customLines: customLines.join('\n'),
      tickedExclusions: new Set(excl.filter(({ item, ticked }) => (prior ? priorExcl.has(item.label.toLowerCase()) : ticked)).map(({ item }) => item.id)),
      tickedAcks: new Set(acks.filter(({ item, ticked }) => (prior ? priorAcks.has(item.label.toLowerCase()) : ticked)).map(({ item }) => item.id)),
      checkedDocIds: new Set(bookDocs.map((d) => d.id)),
      includePay: true,
      includeInsurance: true,
      bond: prior?.bond ?? 'none',
      specialProvisions: prior?.specialProvisions ?? '',
      amount: existing?.amount != null ? String(Number(existing.amount)) : initial?.amount != null && initial.amount > 0 ? String(initial.amount) : '',
      retainagePct: existing ? String(Number(existing.retainage_pct) || 0) : '0',
      proposedStart: existing?.proposed_start ?? '',
      proposedEnd: existing?.proposed_end ?? '',
      expires: existing?.offer_expires_at && existing.status === 'offered' ? existing.offer_expires_at : defaultExpires,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, step, existing, scopeItems, bookDocs, bidLines, serviceTypeIdOfJob, initial?.amount])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setJob(null)
      setPersonId('')
      setExisting(null)
      setDraft(null)
      setShowAllScope(false)
      setAddSubOpen(false)
    }
  }, [open])

  const person = roster.find((r) => r.id === personId) ?? null
  const msa = useMemo(() => personDocs.find((d) => d.status === 'signed' && (/master subcontract/i.test(d.document_name) || d.doc_type === 'agreement')) ?? null, [personDocs])
  const coi = useMemo(() => personDocs.find((d) => d.doc_type === 'coi' && d.status !== 'unsent') ?? null, [personDocs])
  const generalConditions = useMemo(() => bookDocs.find((d) => /general conditions/i.test(d.document_name)) ?? bookDocs[0] ?? null, [bookDocs])
  const gcStanding = useMemo(() => {
    if (!generalConditions) return 'none' as const
    const copy = personDocs.find((d) => d.status === 'signed' && (d.applied_contract_template_document_id === generalConditions.id || d.document_name.trim().toLowerCase() === generalConditions.document_name.trim().toLowerCase()))
    return generalConditionsStanding({ bookVersionDate: generalConditions.book_version_date, signedVersionDate: copy?.applied_version_date ?? null, signed: !!copy })
  }, [generalConditions, personDocs])

  const scopeChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'scope') : []), [draft, scopeItems])
  const exclusionChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'exclusion') : []), [draft, scopeItems])
  const ackChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'acknowledgement') : []), [draft, scopeItems])

  const jobLabel = job ? sheetWorkOrderLabel({ job_number: job.hcp_number, address: job.job_address }) : (existing ? parseSubWorkOrderSnapshot(existing.offer_scope_snapshot).sheetLabel : null) ?? 'Job'
  const trade = (job as { serviceType?: { name?: string | null } | null } | null)?.serviceType?.name ?? null

  const buildSnapshot = useCallback(
    (d: Draft, recordId: string | null, issuedOn: string | null): SubWorkOrderSnapshot => {
      const byId = new Map(scopeItems.map((i) => [i.id, i]))
      const scopeLines = [
        ...scopeChoices.filter(({ item }) => d.tickedScope.has(item.id)).map(({ item }) => item.label),
        ...bidLines.filter((_, i) => d.tickedBid.has(i)).map((b) => b.label),
        ...d.customLines.split('\n').map((l) => l.trim()).filter(Boolean),
      ]
      return buildSheetWorkOrderSnapshot({
        sheet: { job_number: job?.hcp_number ?? null, address: job?.job_address ?? null },
        scopeLines,
        exclusions: [...d.tickedExclusions].map((id) => byId.get(id)?.label ?? '').filter(Boolean),
        references: buildWorkOrderReferences({
          bookDocs: bookDocs.filter((b) => d.checkedDocIds.has(b.id)),
          payRunDay: d.includePay ? payRunDay : null,
          includePay: d.includePay,
          coiExpiresOn: coi?.expires_at ?? null,
          includeInsurance: d.includeInsurance,
        }),
        acknowledgements: [...d.tickedAcks].map((id) => byId.get(id)?.label ?? '').filter(Boolean),
        bond: d.bond,
        specialProvisions: d.specialProvisions,
        proposedStart: d.proposedStart || null,
        proposedEnd: d.proposedEnd || null,
        anchor: existing?.step_id ? 'step' : existing?.labor_job_id || initial?.laborJobId ? 'sheet' : 'job',
        facts: {
          jobLabel: job?.hcp_number ?? null,
          jobAddress: job?.job_address ?? null,
          customerName: job?.customer_name ?? null,
          trade,
          recordId,
          issuedOn,
          issuerName: issuer.name,
          issuerTitle: issuer.title,
          subCompany: null,
          msaSignedOn: msa?.signed_at ? msa.signed_at.slice(0, 10) : null,
        },
      })
    },
    [scopeItems, scopeChoices, bidLines, job, bookDocs, payRunDay, coi, existing, initial?.laborJobId, trade, issuer, msa],
  )

  const previewDoc = useMemo(() => {
    if (!draft) return null
    const amountNum = draft.amount.trim() === '' ? null : Number(draft.amount)
    const snap = existing && readOnly ? existing.offer_scope_snapshot : buildSnapshot(draft, existing?.record_id ?? null, existing?.offered_at ? existing.offered_at.slice(0, 10) : todayYmdInAppTz())
    return buildWorkOrderDocument({
      snapshot: snap,
      commitment: {
        amount: existing && readOnly ? existing.amount : Number.isFinite(amountNum as number) ? amountNum : null,
        retainage_pct: Number(draft.retainagePct) || 0,
        proposed_start: draft.proposedStart || null,
        proposed_end: draft.proposedEnd || null,
        offer_expires_at: draft.expires || null,
        record_id: existing?.record_id ?? null,
        offered_at: existing?.offered_at ?? null,
        signed_at: existing?.signed_at ?? null,
        accepted_at: existing?.accepted_at ?? null,
        signer_printed_name: existing?.signer_printed_name ?? null,
        signer_signature_mode: existing?.signer_signature_mode ?? null,
        display_name: person?.name ?? existing?.display_name ?? 'Subcontractor',
        status: existing?.status ?? 'draft',
      },
      issuer: WORK_ORDER_ISSUER,
    })
  }, [draft, existing, readOnly, buildSnapshot, person])

  function toggleIn<T>(set: Set<T>, id: T): Set<T> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  async function addSubToRoster() {
    const name = addSub.name.trim()
    if (!name || !authUserId) return
    setSaving(true)
    const { data, error } = await supabase
      .from('people')
      .insert({ master_user_id: authUserId, kind: 'sub', name, email: addSub.email.trim() || null, phone: addSub.phone.trim() || null })
      .select('id, name, email, notes')
      .single()
    setSaving(false)
    if (error) {
      showToast(`Could not add the sub: ${formatErrorMessage(error)}`, 'error')
      return
    }
    const r = data as Roster
    setRoster((prev) => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)))
    setPersonId(r.id)
    setAddSubOpen(false)
    setAddSub({ name: '', email: '', phone: '' })
  }

  async function persist(status: 'draft' | 'offered'): Promise<StepCommitmentRow | null> {
    if (!draft || !job || !person) return null
    const amountNum = draft.amount.trim() === '' ? null : Number(draft.amount)
    if (status === 'offered' && (amountNum == null || !Number.isFinite(amountNum) || amountNum <= 0)) {
      showToast('Set the amount before sending — drafts can wait for a price, a sent work order cannot.', 'error')
      return null
    }
    let recordId = existing?.record_id ?? null
    if (status === 'offered' && !recordId) {
      const { data, error } = await supabase.rpc('next_work_order_record_id', { p_job_id: job.id })
      if (error) {
        showToast(`Could not number the work order: ${formatErrorMessage(error)}`, 'error')
        return null
      }
      recordId = (data as string | null) ?? null
    }
    const issuedOn = status === 'offered' ? todayYmdInAppTz() : null
    const snapshot = buildSnapshot(draft, recordId, issuedOn)
    if (status === 'offered' && snapshot.lines.length === 0) {
      showToast('Tick at least one scope line, or add one for this job.', 'error')
      return null
    }
    const nowIso = new Date().toISOString()
    const patch = {
      job_id: job.id,
      person_id: person.id,
      display_name: person.name,
      amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : null,
      retainage_pct: Math.min(100, Math.max(0, Number(draft.retainagePct) || 0)),
      status,
      offered_at: status === 'offered' ? nowIso : null,
      declined_at: null,
      decline_reason: null,
      proposed_start: draft.proposedStart || null,
      proposed_end: draft.proposedEnd || null,
      offer_expires_at: status === 'offered' ? draft.expires || null : null,
      offer_scope_snapshot: snapshot as unknown as StepCommitmentRow['offer_scope_snapshot'],
      record_id: recordId,
    }
    setSaving(true)
    try {
      if (existing) {
        const { data, error } = await supabase.from('step_commitments').update(patch).eq('id', existing.id).select('*').single()
        if (error) throw error
        return data as StepCommitmentRow
      }
      const { data, error } = await supabase
        .from('step_commitments')
        .insert({ ...patch, labor_job_id: initial?.laborJobId ?? null, step_id: initial?.stepId ?? null, created_by: authUserId ?? null })
        .select('*')
        .single()
      if (error) throw error
      return data as StepCommitmentRow
    } catch (e) {
      showToast(`Could not save the work order: ${formatErrorMessage(e)}`, 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft() {
    const row = await persist('draft')
    if (!row) return
    setExisting(row)
    emitWorkOrderChanged()
    onChanged?.()
    showToast(row.amount == null ? 'Draft saved — it will wait for a price' : 'Draft saved', 'success')
    onClose()
  }

  async function send() {
    const row = await persist('offered')
    if (!row || !person) return
    setExisting(row)
    emitWorkOrderChanged()
    onChanged?.()
    const portalUrl = await resolveSubPortalUrl(person.id)
    const { data: acct } = await supabase.from('people').select('account_user_id').eq('id', person.id).maybeSingle()
    const userId = (acct as { account_user_id?: string | null } | null)?.account_user_id ?? null
    let email = person.email
    if (!email && userId) {
      const { data: u } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      email = (u as { email?: string | null } | null)?.email ?? null
    }
    void notifySheetWorkOrderOffered({
      laborJobId: row.labor_job_id,
      workOrderId: row.labor_job_id ? null : row.id,
      sheetLabel: jobLabel,
      offeredByName: issuer.name ?? 'The office',
      recipientName: person.name,
      recipientEmail: email,
      recipientUserId: userId,
      amount: Number(row.amount),
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      portalUrl,
    })
    showToast(email ? `${row.record_id ?? 'Work order'} sent to ${person.name} — they sign on their portal` : `${row.record_id ?? 'Work order'} saved. ${person.name} has no email on the roster — share their portal link by text`, email ? 'success' : 'info')
    onClose()
  }

  function print() {
    if (!previewDoc) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(renderWorkOrderDocumentHtml(previewDoc))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  if (!open) return null

  const stepTitle = step === 1 ? 'Job' : step === 2 ? 'Sub' : readOnly ? 'The signed document' : 'Scope and terms'
  const filteredRoster = roster.filter((r) => r.name.toLowerCase().includes(rosterSearch.trim().toLowerCase()))
  const bidTotalHint = bidTotals && bidTotals.total > 0 ? bidTotals : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 55, overflowY: 'auto', padding: '2rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1180px, 100%)', padding: '1.25rem 1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{existing ? (readOnly ? `${existing.record_id ?? 'Work order'} · ${existing.display_name}` : `Edit work order${existing.record_id ? ` ${existing.record_id}` : ''}`) : 'New work order'}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {job ? jobLabel : ''}
            {person ? ` · ${person.name}` : ''}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" style={btn('ghost')} onClick={onClose}>Close</button>
        </div>
        {!readOnly && (
          <>
            <div style={{ display: 'flex', gap: 6, margin: '0.75rem 0 0.35rem' }}>
              {[1, 2, 3].map((n) => (
                <span key={n} style={{ flex: 1, height: 5, borderRadius: 3, background: n <= step ? '#2563eb' : 'var(--border)' }} />
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Step {step} of 3 · {stepTitle}</div>
          </>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : step === 1 ? (
          <div>
            <label style={labelStyle}>Job</label>
            <button type="button" onClick={() => setJobPickerOpen(true)} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}>
              {job ? (
                <>
                  <span style={{ fontWeight: 600 }}>{jobLabel}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {trade ?? 'trade unknown'}{job.bid_id ? ' · from a bid' : ''}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Search job # / name / address / customer</span>
              )}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>The job decides the trade, the address, and — when it came from a bid — the scope lines the bid already priced.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" style={btn('primary', !job)} disabled={!job} onClick={() => setStep(2)}>Next · Sub</button>
            </div>
            {jobPickerOpen && (
              <ScheduleDispatchAssignJobPickerModal
                open
                onClose={() => setJobPickerOpen(false)}
                title="Which job is this work order for?"
                subtitle="Number, name, address or customer — finished jobs sit under their own divider"
                jobRows={subLaborAssignPickerRows(jobs, jobSearch, jobNumberQuery)}
                searchValue={jobSearch}
                onSearchChange={setJobSearch}
                numberQuery={jobNumberQuery}
                onNumberQueryChange={setJobNumberQuery}
                searchPlaceholder="Search job # / name / address / customer"
                onPickJob={(jobId) => {
                  const j = jobs.find((x) => x.id === jobId) ?? null
                  setJob(j)
                  setDraft(null)
                  setJobPickerOpen(false)
                }}
              />
            )}
          </div>
        ) : step === 2 ? (
          <div>
            <label style={labelStyle}>Sub</label>
            <input value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} placeholder="Search the roster" style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {filteredRoster.map((r) => {
                const on = r.id === personId
                return (
                  <button key={r.id} type="button" aria-pressed={on} onClick={() => setPersonId(r.id)} style={{ padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', border: on ? '1px solid #2563eb' : '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)' }}>
                    {on ? '✓ ' : ''}
                    {r.name}
                  </button>
                )
              })}
              <button type="button" onClick={() => setAddSubOpen((v) => !v)} style={{ padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.8125rem', border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}>
                + Add Sub
              </button>
            </div>
            {addSubOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto', gap: '0.5rem', marginTop: 10, alignItems: 'end' }}>
                <div><span style={labelStyle}>Name</span><input value={addSub.name} onChange={(e) => setAddSub({ ...addSub, name: e.target.value })} style={inputStyle} /></div>
                <div><span style={labelStyle}>Email</span><input value={addSub.email} onChange={(e) => setAddSub({ ...addSub, email: e.target.value })} style={inputStyle} /></div>
                <div><span style={labelStyle}>Phone</span><input value={addSub.phone} onChange={(e) => setAddSub({ ...addSub, phone: e.target.value })} style={inputStyle} /></div>
                <button type="button" style={btn('primary', saving || !addSub.name.trim())} disabled={saving || !addSub.name.trim()} onClick={() => void addSubToRoster()}>Add</button>
              </div>
            )}
            {person && (
              <div style={{ marginTop: 10, display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                <span style={{ background: msa ? 'var(--bg-green-tint)' : 'var(--bg-red-tint)', color: msa ? 'var(--text-green-800)' : 'var(--text-red-700)', borderRadius: 999, padding: '0.08rem 0.55rem', fontWeight: 650 }}>{msa ? `MSA signed ${msa.signed_at?.slice(0, 10) ?? ''}` : 'MSA missing'}</span>
                <span style={{ background: coi ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: coi ? 'var(--text-green-800)' : 'var(--text-amber-800)', borderRadius: 999, padding: '0.08rem 0.55rem', fontWeight: 650 }}>{coi ? `COI${coi.expires_at ? ` to ${coi.expires_at}` : ' on file'}` : 'No COI on file'}</span>
                {gcStanding !== 'none' && (
                  <span style={{ background: gcStanding === 'current' ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: gcStanding === 'current' ? 'var(--text-green-800)' : 'var(--text-amber-800)', borderRadius: 999, padding: '0.08rem 0.55rem', fontWeight: 650 }}>Gen. Cond. {gcStanding === 'current' ? '✓' : gcStanding}</span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>A missing agreement warns but doesn't block — the portal asks at signing.</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" style={btn('ghost')} onClick={() => setStep(1)}>Back</button>
              <button type="button" style={btn('primary', !person)} disabled={!person} onClick={() => setStep(3)}>Next · Scope and terms</button>
            </div>
          </div>
        ) : draft && previewDoc ? (
          <div style={{ display: 'grid', gridTemplateColumns: readOnly ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
            {!readOnly && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={boxStyle}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.4rem 0 0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>Scope</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{trade ? `${trade} library` : 'All trades'} · {draft.tickedScope.size + draft.tickedBid.size} ticked</span>
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={() => setDraft({ ...draft, tickedScope: new Set(scopeChoices.filter((s) => s.ticked).map((s) => s.item.id)) })} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.72rem', cursor: 'pointer' }}>Reset to library defaults</button>
                  </div>
                  {(showAllScope ? scopeChoices : scopeChoices.slice(0, 8)).map(({ item }) => (
                    <label key={item.id} style={checkRow}>
                      <input type="checkbox" checked={draft.tickedScope.has(item.id)} onChange={() => setDraft({ ...draft, tickedScope: toggleIn(draft.tickedScope, item.id) })} style={{ marginTop: 2 }} />
                      <span>{item.label}</span>
                      <span style={srcTag('lib')}>{item.is_default ? 'library' : 'ask'}</span>
                    </label>
                  ))}
                  {scopeChoices.length > 8 && (
                    <button type="button" onClick={() => setShowAllScope((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: '0.3rem 0' }}>
                      {showAllScope ? 'Show fewer' : `+ ${scopeChoices.length - 8} more in the library · show all`}
                    </button>
                  )}
                  {bidLines.map((b, i) => (
                    <label key={`bid-${i}`} style={checkRow}>
                      <input type="checkbox" checked={draft.tickedBid.has(i)} onChange={() => setDraft({ ...draft, tickedBid: toggleIn(draft.tickedBid, i) })} style={{ marginTop: 2 }} />
                      <span>{b.label}</span>
                      <span style={srcTag('bid')}>from the bid</span>
                    </label>
                  ))}
                  <textarea value={draft.customLines} onChange={(e) => setDraft({ ...draft, customLines: e.target.value })} rows={2} placeholder={'Lines for this job, one per line\ne.g. Rough-in the second-floor med-gas room per sheet P-402, rev 3'} style={{ ...inputStyle, margin: '6px 0 8px', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>

                {exclusionChoices.length > 0 && (
                  <div style={boxStyle}>
                    <span style={{ ...labelStyle, padding: '0.4rem 0 0.2rem' }}>Exclusions</span>
                    {exclusionChoices.map(({ item }) => (
                      <label key={item.id} style={checkRow}>
                        <input type="checkbox" checked={draft.tickedExclusions.has(item.id)} onChange={() => setDraft({ ...draft, tickedExclusions: toggleIn(draft.tickedExclusions, item.id) })} style={{ marginTop: 2 }} />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div style={boxStyle}>
                  <span style={{ ...labelStyle, padding: '0.4rem 0 0.2rem' }}>Price and window</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', padding: '0.2rem 0 0.5rem' }}>
                    <div>
                      <span style={{ ...labelStyle, fontWeight: 600 }}>Amount</span>
                      <input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Leave blank to draft" style={{ ...inputStyle, fontWeight: 700 }} />
                      {bidTotalHint ? (
                        <button type="button" onClick={() => setDraft({ ...draft, amount: String(bidTotalHint.total) })} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.7rem', cursor: 'pointer', padding: '2px 0' }}>
                          From the bid: {money(bidTotalHint.total)} sub labor
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fixed at send</span>
                      )}
                    </div>
                    <div><span style={{ ...labelStyle, fontWeight: 600 }}>Retainage %</span><input type="number" min="0" max="100" step="1" value={draft.retainagePct} onChange={(e) => setDraft({ ...draft, retainagePct: e.target.value })} style={inputStyle} /></div>
                    <div><span style={{ ...labelStyle, fontWeight: 600 }}>Work window from</span><input type="date" value={draft.proposedStart} onChange={(e) => setDraft({ ...draft, proposedStart: e.target.value })} style={inputStyle} /></div>
                    <div><span style={{ ...labelStyle, fontWeight: 600 }}>to</span><input type="date" value={draft.proposedEnd} onChange={(e) => setDraft({ ...draft, proposedEnd: e.target.value })} style={inputStyle} /></div>
                    <div><span style={{ ...labelStyle, fontWeight: 600 }}>Offer good through</span><input type="date" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} style={inputStyle} /></div>
                    <div>
                      <span style={{ ...labelStyle, fontWeight: 600 }}>Performance bond</span>
                      <select value={draft.bond} onChange={(e) => setDraft({ ...draft, bond: e.target.value === 'furnished' ? 'furnished' : 'none' })} style={inputStyle}>
                        <option value="none">Will not be furnished</option>
                        <option value="furnished">Will be furnished by the sub</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ paddingBottom: '0.5rem' }}>
                    <span style={{ ...labelStyle, fontWeight: 600 }}>Special provisions</span>
                    <input type="text" value={draft.specialProvisions} onChange={(e) => setDraft({ ...draft, specialProvisions: e.target.value })} placeholder="None for this job" style={inputStyle} />
                  </div>
                </div>

                <div style={boxStyle}>
                  <span style={{ ...labelStyle, padding: '0.4rem 0 0.2rem' }}>Attached by reference</span>
                  {bookDocs.map((d) => (
                    <label key={d.id} style={{ ...checkRow, alignItems: 'center' }}>
                      <input type="checkbox" checked={draft.checkedDocIds.has(d.id)} onChange={() => setDraft({ ...draft, checkedDocIds: toggleIn(draft.checkedDocIds, d.id) })} />
                      <span style={{ flex: 1 }}>{d.document_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{d.book_version_date ? `v. ${d.book_version_date}` : 'no version date'}</span>
                    </label>
                  ))}
                  {bookDocs.length === 0 && <p style={{ margin: '0.3rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>No documents for subs in the Contract library yet — add General Conditions there with the audience set to Subs.</p>}
                  <label style={{ ...checkRow, alignItems: 'center' }}>
                    <input type="checkbox" checked={draft.includePay} onChange={() => setDraft({ ...draft, includePay: !draft.includePay })} />
                    <span style={{ flex: 1 }}>How pay works here{payRunDay ? ` · pay-run ${payRunDay}` : ''}</span>
                  </label>
                  <label style={{ ...checkRow, alignItems: 'center', borderBottom: 0 }}>
                    <input type="checkbox" checked={draft.includeInsurance} onChange={() => setDraft({ ...draft, includeInsurance: !draft.includeInsurance })} />
                    <span style={{ flex: 1 }}>Insurance requirements</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{coi?.expires_at ? `COI exp ${coi.expires_at}` : coi ? 'COI on file' : 'no COI on file'}</span>
                  </label>
                </div>

                {ackChoices.length > 0 && (
                  <div style={boxStyle}>
                    <span style={{ ...labelStyle, padding: '0.4rem 0 0.2rem' }}>They confirm at signing</span>
                    {ackChoices.map(({ item }) => (
                      <label key={item.id} style={checkRow}>
                        <input type="checkbox" checked={draft.tickedAcks.has(item.id)} onChange={() => setDraft({ ...draft, tickedAcks: toggleIn(draft.tickedAcks, item.id) })} style={{ marginTop: 2 }} />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 6 }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>{readOnly ? 'Document' : 'Live preview'}</span>
                <span style={{ flex: 1 }} />
                <button type="button" style={btn('ghost')} onClick={print}>Print / PDF</button>
              </div>
              <WorkOrderDocumentView doc={previewDoc} />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {!readOnly ? (
                  <>
                    <button type="button" style={btn('primary', saving)} disabled={saving} onClick={() => void send()}>
                      {saving ? 'Sending…' : `Send for signature${draft.amount.trim() ? ` · ${money(Number(draft.amount) || 0)}` : ''}`}
                    </button>
                    <button type="button" style={btn('ghost', saving)} disabled={saving} onClick={() => void saveDraft()}>Save draft</button>
                    <button type="button" style={btn('ghost')} onClick={() => setStep(2)}>Back</button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{draft.amount.trim() ? `Push + email to ${person?.name ?? 'the sub'}; the link opens the offer on their portal.` : 'No price yet — save as a draft and it waits for the master on the dashboard.'}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {existing?.status === 'offered' ? 'Sent and awaiting the sub\'s signature on their portal.' : existing?.signed_at ? 'Signed on the sub portal.' : 'Accepted; recorded by the office.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Preparing the document…</p>
        )}
      </div>
    </div>
  )
}

function roleTitle(role: string): string {
  const map: Record<string, string> = { dev: 'Developer', master_technician: 'Master', assistant: 'Assistant', controller: 'Controller', estimator: 'Estimator', superintendent: 'Superintendent', primary: 'Primary' }
  return map[role] ?? role
}

export default WorkOrderAssemblerModal
