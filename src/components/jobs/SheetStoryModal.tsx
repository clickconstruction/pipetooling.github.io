/**
 * The sheet story (Work Orders one-row spine, PR 6): click a rail, get one
 * row per dot with the facts behind it. Loads the sheet, its orders, the
 * Activity feed's stage lines, the Pipeline job's bill, the sub's paperwork
 * and portal link, hands them to `buildSheetStory`, and offers the office's
 * move on the live step. Opens from Jobs → Work Orders, Jobs → Sub Labor and
 * the sheet's Work order box.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'
import { normalizeSubSheetStage, type SubSheetStage } from '../../lib/subSheetStage'
import { normalizePersonNameKey } from '../../lib/personNameKey'
import { buildJobWorkOrderCoverage, type WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
import { buildSheetRail } from '../../lib/subWorkOrders/sheetRail'
import { buildSheetStory, SHEET_STORY_ACTION_LABEL, type SheetStoryAction, type SheetStoryInput, type SheetStoryRow, type SheetStoryStageEvent } from '../../lib/subWorkOrders/sheetStory'
import { isRosterSubSheet, type NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
import { SHEET_RAIL_GAP, SHEET_RAIL_NOW } from '../../lib/subWorkOrders/sheetRailTone'
import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
import { emitWorkOrderChanged } from '../../hooks/useJobWorkOrderCoverage'
import { notifySheetWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { SheetRail } from './SheetRail'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'

export type SheetStoryModalProps = {
  /** The sheet to tell; null keeps the modal closed. */
  sheetId: string | null
  onClose: () => void
  /** The Pipeline list when the caller has it (the assembler needs it); otherwise the job is looked up by number. */
  jobs?: JobWithDetails[]
  authUserId: string | undefined
  /** Sheet › — the Sub Labor editor. */
  onOpenSheet?: (sheetId: string) => void
  /** After a stage move or a payable-after change. */
  onSheetChanged?: () => void
}

type SheetRow = SheetStoryInput['sheet'] & {
  id: string
  labor_rate: number | null
  stage_changed_by: string | null
  items?: Array<{ fixture?: string | null; count?: number; hrs_per_unit?: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>
  assignees?: Array<{ person_id: string }> | null
}

type Loaded = {
  sheet: SheetRow
  orders: StepCommitmentRow[]
  job: SheetStoryInput['job'] & { id: string } | null
  events: SheetStoryStageEvent[]
  eventsCount: number
  paperwork: SheetStoryInput['paperwork']
  hasPortalLink: boolean
  namesById: Map<string, string>
}

const CHIP_TONE: Record<NonNullable<SheetStoryRow['chip']>['tone'], { bg: string; fg: string }> = {
  gap: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
  amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
  violet: { bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-700)' },
  gray: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
}

const btn = (primary = false, busy = false) =>
  ({
    padding: '0.3rem 0.7rem',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: busy ? 'not-allowed' : 'pointer',
    border: primary ? 'none' : '1px solid var(--border-strong)',
    background: busy ? '#9ca3af' : primary ? '#2563eb' : 'var(--surface)',
    color: primary ? 'white' : 'var(--text-700)',
    whiteSpace: 'nowrap',
  }) as const
const ghost = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' } as const
const money = (n: number) => `$${formatCurrency(n)}`

export function SheetStoryModal({ sheetId, onClose, jobs, authUserId, onOpenSheet, onSheetChanged }: SheetStoryModalProps) {
  const { showToast } = useToastContext()
  const { roster } = useRosterSubKinds(sheetId != null)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
  const [payableDraft, setPayableDraft] = useState<string | null>(null)
  const today = todayYmdInAppTz()

  const load = useCallback(async () => {
    if (!sheetId) return
    setError(null)
    try {
      const { data: sheetData, error: sheetErr } = await supabase
        .from('people_labor_jobs')
        .select('id, job_number, address, assigned_to_name, labor_rate, job_date, created_at, stage, stage_changed_at, stage_changed_by, stage_source, stage_note, payable_after, pay_hold_reason, items:people_labor_job_items(fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount), payments:people_labor_job_payments(amount, memo, created_at, payment_date), assignees:people_labor_job_assignees(person_id)')
        .eq('id', sheetId)
        .maybeSingle()
      if (sheetErr) throw sheetErr
      if (!sheetData) throw new Error('That sheet is gone')
      const sheet = sheetData as unknown as SheetRow
      const number = (sheet.job_number ?? '').trim()
      // The Pipeline job behind the number: from the caller's list, else one lookup.
      let job: Loaded['job'] = null
      const fromList = number ? jobs?.find((j) => j.hcp_number.trim().toLowerCase() === number.toLowerCase()) : undefined
      let jobId: string | null = fromList?.id ?? null
      type JobBase = { id: string; hcp_number: string; customer_name: string | null; status: string | null; revenue: number | null }
      let jobBase: JobBase | null = fromList
        ? { id: fromList.id, hcp_number: fromList.hcp_number, customer_name: fromList.customer_name ?? null, status: fromList.status ?? null, revenue: fromList.revenue ?? null }
        : null
      if (!jobBase && number) {
        const { data: j } = await supabase.from('jobs_ledger').select('id, hcp_number, customer_name, status, revenue').ilike('hcp_number', number).limit(1).maybeSingle()
        const looked = (j as JobBase | null) ?? null
        jobBase = looked
        jobId = looked?.id ?? null
      }
      const [{ data: sheetOrders }, { data: jobOrders }, { data: invoices }, { data: eventRows }] = await Promise.all([
        supabase.from('step_commitments').select('*').eq('labor_job_id', sheetId).neq('status', 'cancelled'),
        jobId ? supabase.from('step_commitments').select('*').eq('job_id', jobId).is('labor_job_id', null).neq('status', 'cancelled') : Promise.resolve({ data: [] as StepCommitmentRow[] }),
        jobId ? supabase.from('jobs_ledger_invoices').select('status').eq('job_id', jobId) : Promise.resolve({ data: [] as Array<{ status: string | null }> }),
        supabase.from('job_activity_events').select('occurred_at, actor_user_id, detail').eq('event_type', 'sub_stage_change').eq('detail->>source_id', sheetId).order('occurred_at', { ascending: true }).limit(100),
      ])
      if (jobBase) {
        const inv = (invoices ?? []) as Array<{ status: string | null }>
        job = { ...jobBase, billsOut: inv.filter((i) => i.status && i.status !== 'draft').length, billsPaid: inv.filter((i) => i.status === 'paid').length }
      }
      const orders = [...((sheetOrders ?? []) as StepCommitmentRow[]), ...((jobOrders ?? []) as StepCommitmentRow[])]
      const rawEvents = (eventRows ?? []) as Array<{ occurred_at: string; actor_user_id: string | null; detail: { from?: string; to?: string; source?: string; note?: string | null } | null }>
      const ids = new Set<string>()
      for (const e of rawEvents) if (e.actor_user_id) ids.add(e.actor_user_id)
      for (const o of orders) if (o.created_by) ids.add(o.created_by)
      const namesById = new Map<string, string>()
      if (ids.size > 0) {
        const { data: users } = await supabase.from('users').select('id, name').in('id', [...ids])
        for (const u of (users ?? []) as Array<{ id: string; name: string | null }>) if (u.name) namesById.set(u.id, u.name)
      }
      const events: SheetStoryStageEvent[] = rawEvents.map((e) => ({
        occurred_at: e.occurred_at,
        from: (e.detail?.from as SubSheetStage | undefined) ?? null,
        to: (e.detail?.to as SubSheetStage | undefined) ?? null,
        source: (e.detail?.source as SheetStoryStageEvent['source']) ?? null,
        note: e.detail?.note ?? null,
        actorName: e.actor_user_id ? (namesById.get(e.actor_user_id) ?? null) : null,
      }))
      // Paperwork + portal for the single assignee.
      const personIds = (sheet.assignees ?? []).map((a) => a.person_id)
      const personId = personIds.length === 1 ? personIds[0]! : null
      let paperwork: Loaded['paperwork'] = null
      let hasPortalLink = false
      if (personId) {
        const [{ data: docs }, { data: links }] = await Promise.all([
          supabase.from('person_contract_documents').select('document_name, doc_type, status, signed_at, expires_at').eq('person_id', personId),
          supabase.from('sub_portal_links').select('id').eq('person_id', personId).is('revoked_at', null).limit(1),
        ])
        const d = (docs ?? []) as Array<{ document_name: string; doc_type: string | null; status: string | null; signed_at: string | null; expires_at: string | null }>
        const msa = d.find((x) => x.status === 'signed' && (/master subcontract/i.test(x.document_name) || x.doc_type === 'agreement')) ?? null
        const coi = d.find((x) => x.doc_type === 'coi' && x.status !== 'unsent') ?? null
        paperwork = { msaSignedOn: msa?.signed_at ?? null, gcStanding: 'none', coiExpiresOn: coi?.expires_at ?? null }
        hasPortalLink = ((links ?? []) as unknown[]).length > 0
      }
      setData({ sheet, orders, job, events, eventsCount: rawEvents.length, paperwork, hasPortalLink, namesById })
    } catch (e) {
      setError(formatErrorMessage(e))
    }
  }, [sheetId, jobs])

  useEffect(() => {
    setData(null)
    setPayableDraft(null)
    if (sheetId) void load()
  }, [sheetId, load])

  useEffect(() => {
    if (!sheetId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !assembler) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetId, onClose, assembler])

  const story = useMemo(() => {
    if (!data) return null
    const { sheet, orders, job, events, paperwork, hasPortalLink } = data
    const bal = subLaborJobBalance({ labor_rate: sheet.labor_rate, items: sheet.items, payments: sheet.payments })
    const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
    const open = Math.max(0, bal.balance)
    const coverage = buildJobWorkOrderCoverage(orders as WorkOrderRowLike[], today)
    const personById = new Map(roster.map((p) => [p.id, p]))
    const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
    for (const p of roster) {
      const k = normalizePersonNameKey(p.name)
      if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
    }
    const assigneeIds = new Map<string, string[]>()
    const ids = (sheet.assignees ?? []).map((a) => a.person_id)
    if (ids.length > 0) assigneeIds.set(sheet.id, ids)
    const crewPay = roster.length > 0 && !isRosterSubSheet(sheet, assigneeIds, personById, personByNameKey)
    const rail = buildSheetRail({ coverage, sheetStage: normalizeSubSheetStage(sheet.stage), payableAfter: sheet.payable_after ?? null, agreed: bal.totalCost, open, unpriced, crewPay })
    const orderRow = coverage.kind === 'none' ? null : (orders.find((o) => o.id === coverage.id) ?? null)
    const order: SheetStoryInput['order'] = orderRow
      ? {
          status: orderRow.status,
          amount: orderRow.amount == null ? null : Number(orderRow.amount),
          created_at: orderRow.created_at,
          createdByName: orderRow.created_by ? (data.namesById.get(orderRow.created_by) ?? null) : null,
          offered_at: orderRow.offered_at,
          offer_expires_at: orderRow.offer_expires_at,
          signed_at: orderRow.signed_at,
          accepted_at: orderRow.accepted_at,
          declined_at: orderRow.declined_at,
          decline_reason: orderRow.decline_reason,
          record_id: orderRow.record_id,
          signer_printed_name: orderRow.signer_printed_name,
          signer_signature_mode: orderRow.signer_signature_mode,
        }
      : null
    const rows = buildSheetStory({ sheet, money: { agreed: bal.totalCost, paid: bal.paid, open, unpriced }, coverage, rail, order, job, events, paperwork, portal: { hasLink: hasPortalLink }, crewPay, todayYmd: today })
    const personId = ids.length === 1 ? ids[0]! : null
    return { rows, rail, coverage, orderRow, money: { agreed: bal.totalCost, paid: bal.paid, open, unpriced }, crewPay, personId, job }
  }, [data, roster, today])

  async function setStage(stage: SubSheetStage) {
    if (!sheetId) return
    setBusy(true)
    try {
      const { error: err } = await supabase.rpc('set_sub_sheet_stage' as never, { p_labor_job_id: sheetId, p_stage: stage, p_note: null } as never)
      if (err) throw err
      await load()
      onSheetChanged?.()
    } catch (e) {
      showToast(`Could not move the stage: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function savePayableAfter(value: string | null) {
    if (!sheetId) return
    setBusy(true)
    try {
      const { error: err } = await supabase.from('people_labor_jobs').update({ payable_after: value }).eq('id', sheetId)
      if (err) throw err
      setPayableDraft(null)
      await load()
      onSheetChanged?.()
      showToast(value ? `Queued for the pay run after ${value}` : 'Payable-after date cleared', 'success')
    } catch (e) {
      showToast(`Could not save: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function nudge(order: StepCommitmentRow) {
    setBusy(true)
    try {
      const portalUrl = await resolveSubPortalUrl(order.person_id)
      const { data: acct } = await supabase.from('people').select('account_user_id, email').eq('id', order.person_id).maybeSingle()
      const a = acct as { account_user_id?: string | null; email?: string | null } | null
      void notifySheetWorkOrderOffered({
        laborJobId: order.labor_job_id,
        workOrderId: order.id,
        sheetLabel: data?.sheet ? `${data.sheet.job_number ?? ''} ${data.sheet.address ?? ''}`.trim() : 'Work order',
        offeredByName: 'The office',
        recipientName: order.display_name,
        recipientEmail: a?.email ?? null,
        recipientUserId: a?.account_user_id ?? null,
        amount: Number(order.amount ?? 0),
        proposedStart: order.proposed_start,
        proposedEnd: order.proposed_end,
        portalUrl,
      })
      showToast(a?.email ? `Reminder sent to ${order.display_name}` : 'No email on the roster — share their portal link instead', a?.email ? 'success' : 'info')
    } finally {
      setBusy(false)
    }
  }

  function act(action: SheetStoryAction) {
    if (!story || !sheetId) return
    switch (action) {
      case 'draft':
        setAssembler({ jobId: story.job?.id ?? null, laborJobId: sheetId, personId: story.personId, amount: story.money.agreed > 0 ? story.money.agreed : null })
        return
      case 'open_order':
      case 'view_record':
      case 'reoffer':
        if (story.orderRow) setAssembler({ commitmentId: story.orderRow.id })
        return
      case 'nudge':
        if (story.orderRow) void nudge(story.orderRow)
        return
      case 'to_walkthrough':
        void setStage('walkthrough')
        return
      case 'to_customer_pays':
        void setStage('customer_pay')
        return
      case 'back_to_work':
        void setStage('working')
        return
      case 'back_to_walkthrough':
        void setStage('walkthrough')
        return
      case 'set_payable_after':
        setPayableDraft(data?.sheet.payable_after ?? today)
        return
      case 'open_sheet':
        onOpenSheet?.(sheetId)
        onClose()
        return
    }
  }

  if (!sheetId) return null
  const sheet = data?.sheet ?? null
  const label = sheet ? `${sheet.job_number ? `#${sheet.job_number}` : 'Sub sheet'}${story?.job?.customer_name ? ` · ${story.job.customer_name}` : ''}${sheet.address ? ` · ${sheet.address}` : ''}` : ''

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 56, overflowY: 'auto', padding: '2rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Sheet story" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: 'min(780px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,.25)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.1rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: '1.05rem' }}>{sheet?.assigned_to_name ?? 'Sheet'}</b>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{label}</span>
            {story?.job == null && sheet ? <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }}>Not in Pipeline</span> : null}
            {story?.crewPay ? <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>Crew pay</span> : null}
            {story?.coverage.kind === 'signed' && story.coverage.recordId ? <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>{story.coverage.recordId}</span> : null}
            <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
          </div>
          {story ? (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>
                {[
                  ['Agreed', story.money.unpriced ? 'unpriced' : money(story.money.agreed), false],
                  ['Paid', money(story.money.paid), false],
                  ['Open', story.money.unpriced ? '—' : money(story.money.open), story.money.open > 0 && story.rail.gap],
                  ['Sheet dated', sheet?.job_date ?? (sheet?.created_at ?? '').slice(0, 10) ?? '—', false],
                  ['Portal', data?.hasPortalLink ? '🌐 link open' : 'no link yet', false],
                ].map(([k, v, red]) => (
                  <div key={String(k)}>
                    <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{k}</div>
                    <div style={{ fontWeight: 700, color: red ? SHEET_RAIL_GAP : 'inherit' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
                <SheetRail rail={story.rail} />
              </div>
            </>
          ) : null}
        </div>

        {error ? <p style={{ margin: 0, padding: '0.9rem 1.1rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p> : null}
        {!story && !error ? <p style={{ margin: 0, padding: '0.9rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading the sheet…</p> : null}

        {story ? (
          <div>
            {story.rows.map((row) => {
              const now = row.state === 'now'
              const dotColor = row.state === 'gap' ? SHEET_RAIL_GAP : row.state === 'done' ? 'var(--text-faint)' : row.state === 'now' ? (row.key === 'paid' ? 'var(--text-green-700)' : SHEET_RAIL_NOW) : 'var(--border-strong)'
              const primary = row.actions[0]
              const rest = row.actions.slice(1)
              const isPayableEditor = row.key === 'customer_pays' && payableDraft != null
              return (
                <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: 12, padding: '0.7rem 1.1rem', borderBottom: '1px solid var(--border)', background: now ? 'var(--bg-subtle)' : 'transparent', alignItems: 'start' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      width: row.office ? 10 : 13,
                      height: row.office ? 10 : 13,
                      marginTop: 4,
                      marginLeft: row.office ? 9 : 7,
                      borderRadius: '50%',
                      boxSizing: 'border-box',
                      border: `2px solid ${dotColor}`,
                      borderStyle: row.state === 'gap' ? 'dashed' : 'solid',
                      background: row.state === 'done' || row.state === 'now' ? dotColor : 'transparent',
                      boxShadow: now ? `0 0 0 3px ${row.key === 'paid' ? 'var(--bg-green-tint)' : 'rgba(181, 101, 29, 0.24)'}` : undefined,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: '0.875rem', color: row.state === 'todo' ? 'var(--text-muted)' : 'inherit' }}>{row.label}</b>
                      {row.chip ? <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, background: CHIP_TONE[row.chip.tone].bg, color: CHIP_TONE[row.chip.tone].fg, whiteSpace: 'nowrap' }}>{row.chip.label}</span> : null}
                    </div>
                    <div style={{ display: 'grid', gap: 2, marginTop: 3, fontSize: '0.8rem', color: row.state === 'todo' ? 'var(--text-muted)' : 'var(--text-700)' }}>
                      {row.facts.map((f, i) => (
                        <div key={i} style={f.quote ? { borderLeft: '2px solid var(--border-strong)', paddingLeft: 8, fontStyle: 'italic', color: 'var(--text-muted)' } : undefined}>
                          {f.k ? <span style={{ color: 'var(--text-muted)' }}>{f.k} </span> : null}
                          {f.text}
                        </div>
                      ))}
                      {isPayableEditor ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          <input type="date" value={payableDraft ?? ''} onChange={(e) => setPayableDraft(e.target.value)} style={{ padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8rem' }} />
                          <button type="button" style={btn(true, busy)} disabled={busy || !payableDraft} onClick={() => void savePayableAfter(payableDraft)}>Queue for the pay run</button>
                          {data?.sheet.payable_after ? <button type="button" style={btn(false, busy)} disabled={busy} onClick={() => void savePayableAfter(null)}>Clear</button> : null}
                          <button type="button" style={ghost} onClick={() => setPayableDraft(null)}>Cancel</button>
                        </div>
                      ) : null}
                    </div>
                    {row.sees ? <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}><b style={{ fontWeight: 600 }}>The sub sees:</b> {row.sees}</div> : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {primary && !isPayableEditor ? (
                      <button type="button" style={btn(primary === 'draft' || primary === 'reoffer' || primary === 'nudge' || primary === 'to_customer_pays', busy)} disabled={busy} onClick={() => act(primary)}>
                        {SHEET_STORY_ACTION_LABEL[primary]}
                      </button>
                    ) : null}
                    {rest.map((a) => (
                      <button key={a} type="button" style={ghost} disabled={busy} onClick={() => act(a)}>
                        {SHEET_STORY_ACTION_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ padding: '0.6rem 1.1rem 0.8rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>Activity: {data?.eventsCount ?? 0} Sub labor line{data?.eventsCount === 1 ? '' : 's'} on the job's feed</span>
              <span>·</span>
              <span>Every move here posts to the feed, same as the tabs</span>
              {onOpenSheet ? (
                <button type="button" style={{ ...btn(false), marginLeft: 'auto' }} onClick={() => act('open_sheet')}>
                  Sheet ›
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <WorkOrderAssemblerModal
        open={assembler != null}
        onClose={() => setAssembler(null)}
        jobs={jobs ?? []}
        initial={assembler}
        authUserId={authUserId}
        onChanged={() => {
          void load()
          emitWorkOrderChanged()
        }}
      />
    </div>
  )
}

export default SheetStoryModal
