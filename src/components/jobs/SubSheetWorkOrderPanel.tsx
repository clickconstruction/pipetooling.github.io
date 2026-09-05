import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { portalShortUrl } from '../../lib/portal/portalShortOrigin'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import {
  buildSheetWorkOrderSnapshot,
  buildWorkOrderReferences,
  frozenAmountFromSheetTotal,
  generalConditionsStanding,
  parseSubWorkOrderSnapshot,
  scopeItemsForTrade,
  sheetWorkOrderLabel,
  sheetWorkOrderRail,
  signedAmountDrift,
  type SubScopeItem,
  type SubWorkOrderBond,
  type SubWorkOrderSnapshot,
} from '../../lib/subWorkOrders/subWorkOrder'
import type { SubSheetStage } from '../../lib/subSheetStage'
import SubPortalGlobeButton from '../people/SubPortalGlobeButton'

/**
 * "Work order" box on a Sub Labor sheet (Sub Work Orders train, PR 2 —
 * v2.2786). One step_commitments row anchored to the sheet (step_id NULL):
 * the office ticks the trade's scope library, adds job lines, sets the
 * window and terms, and sends; the sub signs on their portal (PR 4) and the
 * sheet's stage rail takes over. The amount is FIXED at send (owner
 * decision): it copies the sheet total and later sheet edits only show a
 * drift note here.
 *
 * Self-contained like SubSheetPortalFieldsBox — the 2.5k-line form modal
 * only mounts it with the sheet facts it already has.
 */

export type SubSheetWorkOrderPanelProps = {
  laborJobId: string
  sheet: { job_number: string | null; address: string | null; assigned_to_name: string | null }
  /** Live sheet total (items) — frozen into the work order at send. */
  sheetTotal: number
  /** Live open balance — drives the rail's Paid segment. */
  sheetOpen: number
  sheetStage: SubSheetStage
  /** The linked job's trade, when known — picks the scope list. */
  defaultServiceTypeId: string | null
  serviceTypes: Array<{ id: string; name: string }>
  authUserId: string | undefined
  /** Fires after a send / withdraw / cancel so the ledger row's chip can refresh. */
  onChanged?: () => void
  /**
   * Work Orders tab PR 3: when the sheet's job is in the cache the box is a door
   * into the assembler (same document, live preview) instead of the inline editor.
   * Receives the sub, the sheet, the order to re-offer, and the sheet total as the price.
   */
  onOpenAssembler?: (initial: { personId: string; laborJobId: string; commitmentId: string | null; amount: number }) => void
}

type AssigneeRow = { person_id: string; people: { id: string; name: string; email: string | null; kind: string } | null }
type BookDoc = { id: string; document_name: string; book_version_date: string | null }
type PersonDoc = {
  document_name: string
  doc_type: string
  status: string
  signed_at: string | null
  expires_at: string | null
  applied_version_date: string | null
  applied_contract_template_document_id: string | null
}

type Draft = {
  personId: string
  serviceTypeId: string | null
  tickedScope: Set<string>
  customLines: string
  tickedExclusions: Set<string>
  tickedAcks: Set<string>
  checkedDocIds: Set<string>
  includePay: boolean
  includeInsurance: boolean
  bond: SubWorkOrderBond
  specialProvisions: string
  proposedStart: string
  proposedEnd: string
  expires: string
  retainagePct: string
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const fmtYmd = (ymd: string | null) => {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 } as const
const inputStyle = {
  width: '100%',
  padding: '0.45rem 0.55rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  color: 'var(--text-900)',
} as const
const primaryBtn = (disabled: boolean) =>
  ({
    padding: '0.4rem 0.9rem',
    background: disabled ? '#9ca3af' : '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }) as const
const ghostBtn = (disabled: boolean) =>
  ({
    padding: '0.4rem 0.8rem',
    background: 'var(--surface)',
    color: 'var(--text-700)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }) as const

/** The sub's portal address for the offer email: custom slug, else the live token link, else mint one. */
async function resolveSubPortalUrl(personId: string): Promise<string | null> {
  const { data: slugRow } = await supabase.from('sub_portal_slugs').select('slug').eq('person_id', personId).maybeSingle()
  const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim()
  if (slug) return portalShortUrl(slug)
  const { data: linkRow } = await supabase
    .from('sub_portal_links')
    .select('token')
    .eq('person_id', personId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let token = ((linkRow as { token?: string | null } | null)?.token ?? '').trim()
  if (!token) {
    const { data, error } = await supabase.rpc('mint_sub_portal_link' as never, { p_person_id: personId, p_rotate: false } as never)
    if (error) return null
    token = ((data as { token?: string | null } | null)?.token ?? '').trim()
  }
  return token ? `${window.location.origin}/sub?t=${token}` : null
}

export function SubSheetWorkOrderPanel({
  laborJobId,
  sheet,
  sheetTotal,
  sheetOpen,
  sheetStage,
  defaultServiceTypeId,
  serviceTypes,
  authUserId,
  onChanged,
  onOpenAssembler,
}: SubSheetWorkOrderPanelProps) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [commitment, setCommitment] = useState<StepCommitmentRow | null>(null)
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string; email: string | null }>>([])
  const [scopeItems, setScopeItems] = useState<SubScopeItem[]>([])
  const [bookDocs, setBookDocs] = useState<BookDoc[]>([])
  const [personDocs, setPersonDocs] = useState<PersonDoc[]>([])
  const [payRunDay, setPayRunDay] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [showAllScope, setShowAllScope] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, aRes, sRes, bRes, pRes] = await Promise.all([
        supabase
          .from('step_commitments')
          .select('*')
          .eq('labor_job_id', laborJobId)
          .is('step_id', null)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('people_labor_job_assignees').select('person_id, people(id, name, email, kind)').eq('labor_job_id', laborJobId),
        supabase.from('sub_scope_items').select('*').is('archived_at', null).order('sequence_order', { ascending: true }),
        supabase.from('contract_template_documents').select('id, document_name, book_version_date').eq('audience', 'sub').order('sequence_order', { ascending: true }),
        supabase.from('app_settings').select('key, value_text').in('key', ['sub_pay_run_day']),
      ])
      const c = (cRes.data ?? null) as StepCommitmentRow | null
      setCommitment(c)
      const rows = ((aRes.data ?? []) as unknown as AssigneeRow[])
        .map((r) => r.people)
        .filter((p): p is NonNullable<AssigneeRow['people']> => !!p)
        .map((p) => ({ id: p.id, name: p.name, email: p.email }))
      setAssignees(rows)
      setScopeItems(((sRes.data ?? []) as SubScopeItem[]).filter((i) => !i.archived_at))
      setBookDocs((bRes.data ?? []) as BookDoc[])
      const day = ((pRes.data ?? []) as Array<{ key: string; value_text: string | null }>).find((r) => r.key === 'sub_pay_run_day')?.value_text ?? null
      setPayRunDay((day ?? '').trim() || null)
    } catch (e) {
      showToast(`Could not load the work order: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [laborJobId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  // The sub's paperwork: MSA line + General Conditions standing + COI expiry.
  const personId = commitment?.person_id ?? draft?.personId ?? assignees[0]?.id ?? null
  useEffect(() => {
    if (!personId) {
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
  }, [personId])

  const msa = useMemo(
    () => personDocs.find((d) => d.status === 'signed' && (/master subcontract/i.test(d.document_name) || d.doc_type === 'agreement')) ?? null,
    [personDocs],
  )
  const coi = useMemo(() => personDocs.find((d) => d.doc_type === 'coi' && d.status !== 'unsent') ?? null, [personDocs])
  const generalConditions = useMemo(() => bookDocs.find((d) => /general conditions/i.test(d.document_name)) ?? bookDocs[0] ?? null, [bookDocs])
  const gcStanding = useMemo(() => {
    if (!generalConditions) return 'none' as const
    const signedCopy = personDocs.find(
      (d) => d.status === 'signed' && (d.applied_contract_template_document_id === generalConditions.id || d.document_name.trim().toLowerCase() === generalConditions.document_name.trim().toLowerCase()),
    )
    return generalConditionsStanding({ bookVersionDate: generalConditions.book_version_date, signedVersionDate: signedCopy?.applied_version_date ?? null, signed: !!signedCopy })
  }, [generalConditions, personDocs])

  /** Seed the editor from the library defaults, or from a declined order's snapshot for a re-offer. */
  const seedDraft = useCallback(
    (from: StepCommitmentRow | null) => {
      const serviceTypeId = defaultServiceTypeId
      const scope = scopeItemsForTrade(scopeItems, serviceTypeId, 'scope')
      const excl = scopeItemsForTrade(scopeItems, serviceTypeId, 'exclusion')
      const acks = scopeItemsForTrade(scopeItems, serviceTypeId, 'acknowledgement')
      const prior = from ? parseSubWorkOrderSnapshot(from.offer_scope_snapshot) : null
      const priorLabels = new Set((prior?.lines ?? []).map((l) => l.label.toLowerCase()))
      const tickedScope = new Set<string>()
      const libraryLabels = new Set<string>()
      for (const { item, ticked } of scope) {
        libraryLabels.add(item.label.toLowerCase())
        if (prior ? priorLabels.has(item.label.toLowerCase()) : ticked) tickedScope.add(item.id)
      }
      const customLines = prior ? prior.lines.map((l) => l.label).filter((l) => !libraryLabels.has(l.toLowerCase())) : []
      const priorExcl = new Set((prior?.exclusions ?? []).map((x) => x.toLowerCase()))
      const priorAcks = new Set((prior?.acknowledgements ?? []).map((x) => x.toLowerCase()))
      const defaultExpires = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
      setDraft({
        personId: from?.person_id ?? assignees[0]?.id ?? '',
        serviceTypeId,
        tickedScope,
        customLines: customLines.join('\n'),
        tickedExclusions: new Set(excl.filter(({ item, ticked }) => (prior ? priorExcl.has(item.label.toLowerCase()) : ticked)).map(({ item }) => item.id)),
        tickedAcks: new Set(acks.filter(({ item, ticked }) => (prior ? priorAcks.has(item.label.toLowerCase()) : ticked)).map(({ item }) => item.id)),
        checkedDocIds: new Set(bookDocs.map((d) => d.id)),
        includePay: true,
        includeInsurance: true,
        bond: prior?.bond ?? 'none',
        specialProvisions: prior?.specialProvisions ?? '',
        proposedStart: from?.proposed_start ?? '',
        proposedEnd: from?.proposed_end ?? '',
        expires: from?.offer_expires_at && from.status !== 'declined' ? from.offer_expires_at : defaultExpires,
        retainagePct: from ? String(Number(from.retainage_pct) || 0) : '0',
      })
      setEditing(true)
      setShowAllScope(false)
    },
    [assignees, bookDocs, defaultServiceTypeId, scopeItems],
  )

  const amount = frozenAmountFromSheetTotal(sheetTotal)
  const scopeChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'scope') : []), [draft, scopeItems])
  const exclusionChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'exclusion') : []), [draft, scopeItems])
  const ackChoices = useMemo(() => (draft ? scopeItemsForTrade(scopeItems, draft.serviceTypeId, 'acknowledgement') : []), [draft, scopeItems])

  function toggleIn(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  function buildSnapshotFromDraft(d: Draft): SubWorkOrderSnapshot {
    const byId = new Map(scopeItems.map((i) => [i.id, i]))
    const scopeLines = [
      ...scopeChoices.filter(({ item }) => d.tickedScope.has(item.id)).map(({ item }) => item.label),
      ...d.customLines.split('\n').map((l) => l.trim()).filter(Boolean),
    ]
    return buildSheetWorkOrderSnapshot({
      sheet,
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
    })
  }

  async function persist(d: Draft, status: 'draft' | 'offered'): Promise<StepCommitmentRow | null> {
    const person = assignees.find((a) => a.id === d.personId)
    if (!person) {
      showToast('Pick which sub this work order goes to.', 'error')
      return null
    }
    const snapshot = buildSnapshotFromDraft(d)
    if (status === 'offered' && snapshot.lines.length === 0) {
      showToast('Tick at least one scope line, or add one for this job.', 'error')
      return null
    }
    if (status === 'offered' && amount <= 0) {
      showToast('Add the work and cost first — the work order freezes the sheet total.', 'error')
      return null
    }
    const retainage = Math.min(100, Math.max(0, Number(d.retainagePct) || 0))
    const nowIso = new Date().toISOString()
    const patch = {
      person_id: person.id,
      display_name: person.name,
      amount,
      retainage_pct: retainage,
      status,
      offered_at: status === 'offered' ? nowIso : null,
      declined_at: null,
      decline_reason: null,
      proposed_start: d.proposedStart || null,
      proposed_end: d.proposedEnd || null,
      offer_expires_at: status === 'offered' ? d.expires || null : null,
      offer_scope_snapshot: snapshot as unknown as StepCommitmentRow['offer_scope_snapshot'],
    }
    setSaving(true)
    try {
      if (commitment) {
        const { data, error } = await supabase.from('step_commitments').update(patch).eq('id', commitment.id).select('*').single()
        if (error) throw error
        return data as StepCommitmentRow
      }
      const { data, error } = await supabase
        .from('step_commitments')
        .insert({ ...patch, labor_job_id: laborJobId, step_id: null, created_by: authUserId ?? null })
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
    if (!draft) return
    const row = await persist(draft, 'draft')
    if (!row) return
    setCommitment(row)
    setEditing(false)
    showToast('Work order saved as a draft', 'success')
    onChanged?.()
  }

  async function send() {
    if (!draft) return
    const row = await persist(draft, 'offered')
    if (!row) return
    setCommitment(row)
    setEditing(false)
    onChanged?.()
    const person = assignees.find((a) => a.id === row.person_id)
    const portalUrl = await resolveSubPortalUrl(row.person_id)
    let offeredBy = 'The office'
    if (authUserId) {
      const { data: me } = await supabase.from('users').select('name').eq('id', authUserId).maybeSingle()
      offeredBy = ((me as { name?: string | null } | null)?.name ?? '').trim() || offeredBy
    }
    const { data: acct } = await supabase.from('people').select('account_user_id').eq('id', row.person_id).maybeSingle()
    let email = person?.email ?? null
    const userId = (acct as { account_user_id?: string | null } | null)?.account_user_id ?? null
    if (!email && userId) {
      const { data: u } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      email = (u as { email?: string | null } | null)?.email ?? null
    }
    void notifySheetWorkOrderOffered({
      laborJobId,
      sheetLabel: sheetWorkOrderLabel(sheet),
      offeredByName: offeredBy,
      recipientName: row.display_name,
      recipientEmail: email,
      recipientUserId: userId,
      amount: Number(row.amount),
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      portalUrl,
    })
    showToast(email ? `Sent to ${row.display_name} — they sign on their portal` : `Saved. ${row.display_name} has no email on the roster — share their portal link by text`, email ? 'success' : 'info')
  }

  async function transition(action: 'withdraw' | 'accept' | 'cancel') {
    if (!commitment) return
    const nowIso = new Date().toISOString()
    const update =
      action === 'withdraw'
        ? { status: 'draft', offered_at: null, offer_expires_at: null }
        : action === 'accept'
          ? { status: 'accepted', accepted_at: nowIso }
          : { status: 'cancelled' }
    setSaving(true)
    const { data, error } = await supabase.from('step_commitments').update(update).eq('id', commitment.id).select('*').single()
    setSaving(false)
    if (error) {
      showToast(`Could not update the work order: ${formatErrorMessage(error)}`, 'error')
      return
    }
    setCommitment(action === 'cancel' ? null : (data as StepCommitmentRow))
    onChanged?.()
  }

  async function nudge() {
    if (!commitment) return
    const person = assignees.find((a) => a.id === commitment.person_id)
    const portalUrl = await resolveSubPortalUrl(commitment.person_id)
    const { data: acct } = await supabase.from('people').select('account_user_id, email').eq('id', commitment.person_id).maybeSingle()
    const a = acct as { account_user_id?: string | null; email?: string | null } | null
    const email = person?.email ?? a?.email ?? null
    void notifySheetWorkOrderOffered({
      laborJobId,
      sheetLabel: sheetWorkOrderLabel(sheet),
      offeredByName: 'The office',
      recipientName: commitment.display_name,
      recipientEmail: email,
      recipientUserId: a?.account_user_id ?? null,
      amount: Number(commitment.amount),
      proposedStart: commitment.proposed_start,
      proposedEnd: commitment.proposed_end,
      portalUrl,
    })
    showToast(email ? 'Reminder sent' : 'No email on the roster — share their portal link instead', email ? 'success' : 'info')
  }

  const snapshot = commitment ? parseSubWorkOrderSnapshot(commitment.offer_scope_snapshot) : null
  const rail = commitment ? sheetWorkOrderRail(commitment.status, sheetStage, sheetOpen) : sheetWorkOrderRail('draft', sheetStage, sheetOpen)
  const signed = !!commitment && (commitment.status === 'accepted' || commitment.status === 'approved' || commitment.status === 'settled')
  const drift = commitment && signed ? signedAmountDrift(Number(commitment.amount), sheetTotal) : null
  const personName = commitment?.display_name ?? assignees.find((a) => a.id === draft?.personId)?.name ?? assignees[0]?.name ?? sheet.assigned_to_name ?? 'the sub'

  const railEl = (
    <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0.5rem 0 0.25rem' }}>
      {rail.map((seg, i) => (
        <span
          key={seg.key}
          style={{
            fontSize: '0.68rem',
            fontWeight: 650,
            letterSpacing: '0.02em',
            padding: '0.14rem 0.55rem',
            border: '1px solid var(--border)',
            borderLeftWidth: i === 0 ? 1 : 0,
            borderRadius: i === 0 ? '999px 0 0 999px' : i === rail.length - 1 ? '0 999px 999px 0' : 0,
            background: seg.state === 'done' ? 'var(--bg-green-tint)' : seg.state === 'now' ? 'var(--bg-orange-tint)' : 'var(--surface)',
            color: seg.state === 'done' ? '#059669' : seg.state === 'now' ? '#E87600' : 'var(--text-faint)',
            whiteSpace: 'nowrap',
          }}
        >
          {seg.label}
        </span>
      ))}
    </div>
  )

  const referencesList = (refs: SubWorkOrderSnapshot['references']) =>
    refs.length === 0 ? null : (
      <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
        {refs.map((r, i) => (
          <li key={i}>
            {r.name}
            {r.versionDate ? <span style={{ color: 'var(--text-muted)' }}> · {r.kind === 'compliance' ? 'expires' : 'v.'} {fmtYmd(r.versionDate)}</span> : null}
          </li>
        ))}
      </ul>
    )

  const bindsUnder = (
    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {msa ? (
        <>
          {personName} signed the Master Subcontract Agreement on {fmtDate(msa.signed_at)}. This work order binds under it.
        </>
      ) : (
        <>No signed Master Subcontract Agreement on file for {personName} — assign the Subs packet on People → Contracts first.</>
      )}
      {generalConditions ? (
        gcStanding === 'current' ? (
          <> General Conditions v. {fmtYmd(generalConditions.book_version_date)} on file.</>
        ) : gcStanding === 'behind' ? (
          <> <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>General Conditions behind</span> — they signed an older version than v. {fmtYmd(generalConditions.book_version_date)}.</>
        ) : gcStanding === 'unsigned' ? (
          <> <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>General Conditions not signed yet</span> — the portal asks them at signing.</>
        ) : null
      ) : null}
    </p>
  )

  return (
    <div style={{ marginTop: '1.25rem', border: '1.5px solid var(--border-strong)', borderRadius: 9, padding: '0.7rem 0.8rem', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-700)', letterSpacing: '0.05em' }}>WORK ORDER</div>
        <span style={{ flex: 1 }} />
        {commitment ? (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 650,
              borderRadius: 999,
              padding: '0.08rem 0.55rem',
              background: signed ? 'var(--bg-green-tint)' : commitment.status === 'offered' ? 'var(--bg-amber-tint)' : commitment.status === 'declined' ? 'var(--bg-red-tint)' : 'var(--bg-muted)',
              color: signed ? 'var(--text-green-800)' : commitment.status === 'offered' ? 'var(--text-amber-800)' : commitment.status === 'declined' ? 'var(--text-red-700)' : 'var(--text-muted)',
            }}
          >
            {signed ? `Signed ${fmtDate(commitment.signed_at ?? commitment.accepted_at)}` : commitment.status === 'offered' ? `Sent ${fmtDate(commitment.offered_at)} · awaiting signature` : commitment.status === 'declined' ? 'Declined' : 'Draft · not sent'}
          </span>
        ) : null}
        {personId ? <SubPortalGlobeButton personId={personId} personName={personName} size={15} /> : null}
      </div>
      {railEl}

      {loading ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : assignees.length === 0 ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          This sheet isn't linked to a roster sub yet, so there's nobody to send a work order to. Link it from the unlinked-sheets warning on People → Subs, or pick the sub under Crew and save.
        </p>
      ) : !commitment && !editing ? (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            style={primaryBtn(false)}
            onClick={() => (onOpenAssembler && assignees.length === 1 ? onOpenAssembler({ personId: assignees[0]!.id, laborJobId, commitmentId: null, amount: sheetTotal }) : seedDraft(null))}
          >
            Write a work order for {assignees.length === 1 ? assignees[0]!.name : 'this sheet'}…
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {onOpenAssembler && assignees.length === 1 ? 'Opens the assembler with the sheet total as the price — the same document the Work Orders tab builds.' : 'Scope from the library, the sheet total frozen as the price, signed on their portal.'}
          </span>
        </div>
      ) : editing && draft ? (
        <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.7rem' }}>
          {assignees.length > 1 && (
            <div>
              <label style={labelStyle}>To</label>
              <select value={draft.personId} onChange={(e) => setDraft({ ...draft, personId: e.target.value })} style={inputStyle}>
                <option value="">Pick the sub…</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Scope</label>
              <select
                value={draft.serviceTypeId ?? ''}
                onChange={(e) => {
                  const serviceTypeId = e.target.value || null
                  const scope = scopeItemsForTrade(scopeItems, serviceTypeId, 'scope')
                  const excl = scopeItemsForTrade(scopeItems, serviceTypeId, 'exclusion')
                  const acks = scopeItemsForTrade(scopeItems, serviceTypeId, 'acknowledgement')
                  setDraft({
                    ...draft,
                    serviceTypeId,
                    tickedScope: new Set(scope.filter((s) => s.ticked).map((s) => s.item.id)),
                    tickedExclusions: new Set(excl.filter((s) => s.ticked).map((s) => s.item.id)),
                    tickedAcks: new Set(acks.filter((s) => s.ticked).map((s) => s.item.id)),
                  })
                }}
                style={{ ...inputStyle, width: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                title="Which trade's scope library to tick from"
              >
                <option value="">All trades only</option>
                {serviceTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} library
                  </option>
                ))}
              </select>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                onClick={() => setDraft({ ...draft, tickedScope: new Set(scopeChoices.filter((s) => s.ticked).map((s) => s.item.id)) })}
              >
                Reset to library defaults
              </button>
            </div>
            <p style={{ margin: '2px 0 4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tick what applies; add lines for this job below. Ticked wording freezes into what {personName} signs.</p>
            {scopeChoices.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                The scope library is empty for this trade — add items on People → Contracts → Contract library → Scope, or just type the lines below.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.2rem 0.6rem' }}>
                {(showAllScope ? scopeChoices : scopeChoices.slice(0, 8)).map(({ item }) => (
                  <label key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.tickedScope.has(item.id)} onChange={() => setDraft({ ...draft, tickedScope: toggleIn(draft.tickedScope, item.id) })} style={{ marginTop: 2 }} />
                    <span>{item.label}</span>
                  </label>
                ))}
                {scopeChoices.length > 8 && (
                  <button type="button" onClick={() => setShowAllScope((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: '0.3rem 0' }}>
                    {showAllScope ? 'Show fewer' : `+ ${scopeChoices.length - 8} more in the library · show all`}
                  </button>
                )}
              </div>
            )}
            <textarea
              value={draft.customLines}
              onChange={(e) => setDraft({ ...draft, customLines: e.target.value })}
              rows={2}
              placeholder={'Lines for this job, one per line\ne.g. Rough-in the second-floor med-gas room per sheet P-402, rev 3'}
              style={{ ...inputStyle, marginTop: 6, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          {exclusionChoices.length > 0 && (
            <div>
              <label style={labelStyle}>Exclusions</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.2rem 0.6rem' }}>
                {exclusionChoices.map(({ item }) => (
                  <label key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.tickedExclusions.has(item.id)} onChange={() => setDraft({ ...draft, tickedExclusions: toggleIn(draft.tickedExclusions, item.id) })} style={{ marginTop: 2 }} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Terms</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>Amount</span>
                <div style={{ ...inputStyle, background: 'var(--bg-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(amount)}</div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fixed at send · the sheet total</span>
              </div>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>Work window from</span>
                <input type="date" value={draft.proposedStart} onChange={(e) => setDraft({ ...draft, proposedStart: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>to</span>
                <input type="date" value={draft.proposedEnd} onChange={(e) => setDraft({ ...draft, proposedEnd: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>Offer good through</span>
                <input type="date" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>Retainage %</span>
                <input type="number" min="0" max="100" step="1" value={draft.retainagePct} onChange={(e) => setDraft({ ...draft, retainagePct: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <span style={{ ...labelStyle, fontWeight: 600 }}>Performance bond</span>
                <select value={draft.bond} onChange={(e) => setDraft({ ...draft, bond: e.target.value === 'furnished' ? 'furnished' : 'none' })} style={inputStyle}>
                  <option value="none">Will not be furnished</option>
                  <option value="furnished">Will be furnished by the sub</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Special provisions</span>
              <input type="text" value={draft.specialProvisions} onChange={(e) => setDraft({ ...draft, specialProvisions: e.target.value })} placeholder="None for this job" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Attached by reference</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.2rem 0.6rem' }}>
              {bookDocs.map((d) => (
                <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={draft.checkedDocIds.has(d.id)} onChange={() => setDraft({ ...draft, checkedDocIds: toggleIn(draft.checkedDocIds, d.id) })} />
                  <span style={{ flex: 1 }}>{d.document_name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{d.book_version_date ? `v. ${fmtYmd(d.book_version_date)}` : 'no version date'}</span>
                </label>
              ))}
              {bookDocs.length === 0 && (
                <p style={{ margin: '0.3rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  No documents for subs in the Contract library yet — add General Conditions there with the audience set to Subs.
                </p>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.includePay} onChange={() => setDraft({ ...draft, includePay: !draft.includePay })} />
                <span style={{ flex: 1 }}>How pay works here{payRunDay ? ` · pay-run ${payRunDay}` : ''}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Settings</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.28rem 0', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.includeInsurance} onChange={() => setDraft({ ...draft, includeInsurance: !draft.includeInsurance })} />
                <span style={{ flex: 1 }}>Insurance requirements</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{coi?.expires_at ? `COI on file · exp ${fmtYmd(coi.expires_at)}` : coi ? 'COI on file' : 'no COI on file'}</span>
              </label>
            </div>
            {bindsUnder}
          </div>

          {ackChoices.length > 0 && (
            <div>
              <label style={labelStyle}>They confirm at signing</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.2rem 0.6rem' }}>
                {ackChoices.map(({ item }) => (
                  <label key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '0.28rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.tickedAcks.has(item.id)} onChange={() => setDraft({ ...draft, tickedAcks: toggleIn(draft.tickedAcks, item.id) })} style={{ marginTop: 2 }} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={primaryBtn(saving)} disabled={saving} onClick={() => void send()}>
              {saving ? 'Sending…' : `Send for signature · ${money(amount)}`}
            </button>
            <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => void saveDraft()}>
              Save draft
            </button>
            <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => { setEditing(false); setDraft(null) }}>
              Cancel
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Push + email to {personName}; the link opens the offer on their portal.</span>
          </div>
        </div>
      ) : commitment && snapshot ? (
        <div style={{ marginTop: '0.6rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, background: 'var(--bg-blue-tint)', color: 'var(--text-link)', borderRadius: 999, padding: '0.08rem 0.55rem' }}>{commitment.display_name}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(Number(commitment.amount))}</span>
            {Number(commitment.retainage_pct) > 0 && <span style={{ color: 'var(--text-muted)' }}>({Number(commitment.retainage_pct)}% retainage)</span>}
            {snapshot.startsLabel && <span style={{ color: 'var(--text-muted)' }}>· {snapshot.startsLabel}</span>}
            {commitment.status === 'offered' && commitment.offer_expires_at && <span style={{ color: 'var(--text-muted)' }}>· good through {fmtYmd(commitment.offer_expires_at)}</span>}
          </div>

          {drift?.differs && (
            <div style={{ marginTop: '0.45rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
              ⚠ The sheet now totals {money(sheetTotal)}, which differs from the signed {money(Number(commitment.amount))} by {money(Math.abs(drift.delta))}. The signed number stands — write a change order for the difference.
            </div>
          )}

          {signed && (
            <div style={{ marginTop: '0.45rem', background: 'var(--bg-green-tint)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>
              ✍ Signed{commitment.signer_printed_name ? <> by <strong>{commitment.signer_printed_name}</strong></> : null} · {fmtDate(commitment.signed_at ?? commitment.accepted_at)}
              {commitment.signed_at ? <> · from their portal{commitment.signer_signature_mode === 'draw' ? ' (drawn signature on file)' : ''}</> : ' · marked by the office'}
              {Array.isArray(commitment.signer_acknowledgements) && (commitment.signer_acknowledgements as unknown[]).length > 0 ? (
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-700)' }}>
                  {(commitment.signer_acknowledgements as Array<{ text?: string }>).map((a, i) => (
                    <li key={i}>☑ {a?.text ?? ''}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {commitment.status === 'declined' && (
            <div style={{ marginTop: '0.45rem', background: 'var(--bg-red-tint)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>
              Declined{commitment.decline_reason ? <> — <strong>“{commitment.decline_reason}”</strong></> : null}
              {commitment.declined_at ? <span style={{ color: 'var(--text-muted)' }}> · {fmtDate(commitment.declined_at)}</span> : null}
            </div>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <span style={labelStyle}>Scope</span>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {snapshot.lines.map((l, i) => (
                <li key={i}>{l.label}</li>
              ))}
            </ul>
            {snapshot.exclusions.length > 0 && (
              <>
                <span style={{ ...labelStyle, marginTop: '0.4rem' }}>Exclusions</span>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {snapshot.exclusions.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </>
            )}
            {(snapshot.bond === 'furnished' || snapshot.specialProvisions) && (
              <p style={{ margin: '0.4rem 0 0', color: 'var(--text-700)' }}>
                {snapshot.bond === 'furnished' ? 'Performance and payment bond furnished by the sub. ' : ''}
                {snapshot.specialProvisions ? <>Special provisions: {snapshot.specialProvisions}</> : null}
              </p>
            )}
            {snapshot.references.length > 0 && (
              <>
                <span style={{ ...labelStyle, marginTop: '0.4rem' }}>Attached by reference</span>
                {referencesList(snapshot.references)}
              </>
            )}
            {bindsUnder}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.6rem' }}>
            {commitment.status === 'draft' && (
              <>
                <button type="button" style={primaryBtn(saving)} disabled={saving} onClick={() => seedDraft(commitment)}>
                  Edit and send…
                </button>
                <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => void transition('cancel')}>
                  Discard draft
                </button>
              </>
            )}
            {commitment.status === 'offered' && (
              <>
                <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => void nudge()} title="Resend the offer notification">
                  Nudge
                </button>
                <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => void transition('accept')} title="Fallback when the sub told you directly instead of signing">
                  Mark accepted
                </button>
                <button type="button" style={ghostBtn(saving)} disabled={saving} onClick={() => void transition('withdraw')}>
                  Withdraw
                </button>
              </>
            )}
            {commitment.status === 'declined' && (
              <button
                type="button"
                style={primaryBtn(saving)}
                disabled={saving}
                onClick={() => (onOpenAssembler ? onOpenAssembler({ personId: commitment.person_id, laborJobId, commitmentId: commitment.id, amount: sheetTotal }) : seedDraft(commitment))}
              >
                Re-offer…
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SubSheetWorkOrderPanel
