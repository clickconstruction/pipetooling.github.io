/**
 * Send a work order from a row (v2.2963) — the assembler's step-3 defaults
 * without opening the assembler: the trade library's default scope lines, the
 * sub's book documents, the pay-run day, the issuer, the sub's COI and MSA,
 * a minted WO number, one insert (or one update of a draft), then the same
 * offer notification the assembler sends. Mirrors
 * `WorkOrderAssemblerModal.persist('offered')` + `send()`; keep the two in
 * step when either changes.
 */
import { supabase } from '../supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { StepCommitmentRow } from '../workflow/stepCommitments'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { notifySheetWorkOrderOffered } from '../workflow/workOrderNotifications'
import { resolveSubPortalUrl } from '../subPortal/resolveSubPortalUrl'
import { buildSheetWorkOrderSnapshot, buildWorkOrderReferences, scopeItemsForTrade, sheetWorkOrderLabel, type SubScopeItem } from './subWorkOrder'

/** The office role as the document prints it. Shared with the assembler. */
export function roleTitle(role: string): string {
  const map: Record<string, string> = { dev: 'Developer', master_technician: 'Leader', assistant: 'Assistant', controller: 'Controller', estimator: 'Estimator', superintendent: 'Superintendent', primary: 'Primary' }
  return map[role] ?? role
}

export type QuickSendJob = { id: string; hcp_number: string; customer_name: string | null; job_address: string | null; service_type_id: string | null; serviceTypeName?: string | null }

/** The slice of a Pipeline job the send needs. */
export function quickSendJobOf(job: JobWithDetails): QuickSendJob {
  return { id: job.id, hcp_number: job.hcp_number, customer_name: job.customer_name ?? null, job_address: job.job_address ?? null, service_type_id: job.service_type_id ?? null, serviceTypeName: (job as { serviceType?: { name?: string | null } | null }).serviceType?.name ?? null }
}
export type QuickSendPerson = { id: string; name: string; email: string | null }

export type QuickSendInput = {
  job: QuickSendJob
  person: QuickSendPerson
  /** The sheet the order covers (a handshake row) — null for a stage row with no sheet yet. */
  laborJobId: string | null
  /** The stage the order fulfils (a stage row) — null otherwise. */
  stageWindowId: string | null
  amount: number
  proposedStart: string | null
  proposedEnd: string | null
  workDays: number | null
  /** YYYY-MM-DD the offer lapses. */
  expires: string
  authUserId: string | null
  /** Re-send: update this draft/offer instead of inserting (keeps its WO number when it has one). */
  existingId?: string | null
}

export type QuickSendResult = { ok: true; row: StepCommitmentRow; emailed: boolean } | { ok: false; error: string; needsAssembler?: boolean }

type BookDoc = { id: string; document_name: string; book_version_date: string | null }
type PersonDoc = { document_name: string; doc_type: string; status: string; signed_at: string | null; expires_at: string | null }

export async function quickSendWorkOrder(input: QuickSendInput): Promise<QuickSendResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: 'Set the price — a sent work order needs one' }
  try {
    const [sRes, bRes, aRes, uRes, dRes, pRes] = await Promise.all([
      supabase.from('sub_scope_items').select('*').is('archived_at', null).order('sequence_order', { ascending: true }),
      supabase.from('contract_template_documents').select('id, document_name, book_version_date').eq('audience', 'sub').order('sequence_order', { ascending: true }),
      supabase.from('app_settings').select('key, value_text').in('key', ['sub_pay_run_day']),
      input.authUserId ? supabase.from('users').select('name, role').eq('id', input.authUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from('person_contract_documents').select('document_name, doc_type, status, signed_at, expires_at').eq('person_id', input.person.id),
      supabase.from('people').select('account_user_id, email').eq('id', input.person.id).maybeSingle(),
    ])
    const scopeItems = ((sRes.data ?? []) as SubScopeItem[]).filter((i) => !i.archived_at)
    const scopeLines = scopeItemsForTrade(scopeItems, input.job.service_type_id, 'scope')
      .filter(({ ticked }) => ticked)
      .map(({ item }) => item.label)
    if (scopeLines.length === 0) return { ok: false, error: 'The trade library has no default scope lines — tick them in the full assembler', needsAssembler: true }
    const exclusions = scopeItemsForTrade(scopeItems, input.job.service_type_id, 'exclusion').filter(({ ticked }) => ticked).map(({ item }) => item.label)
    const acknowledgements = scopeItemsForTrade(scopeItems, input.job.service_type_id, 'acknowledgement').filter(({ ticked }) => ticked).map(({ item }) => item.label)
    const bookDocs = (bRes.data ?? []) as BookDoc[]
    const payRunDay = (((aRes.data ?? []) as Array<{ key: string; value_text: string | null }>)[0]?.value_text ?? '').trim() || null
    const u = uRes.data as { name?: string | null; role?: string | null } | null
    const issuer = { name: (u?.name ?? '').trim() || null, title: u?.role ? roleTitle(u.role) : null }
    const personDocs = (dRes.data ?? []) as PersonDoc[]
    const msa = personDocs.find((d) => d.status === 'signed' && (/master subcontract/i.test(d.document_name) || d.doc_type === 'agreement')) ?? null
    const coi = personDocs.find((d) => d.doc_type === 'coi' && d.status !== 'unsent') ?? null

    let existing: StepCommitmentRow | null = null
    if (input.existingId) {
      const { data } = await supabase.from('step_commitments').select('*').eq('id', input.existingId).maybeSingle()
      existing = (data ?? null) as StepCommitmentRow | null
    }
    let recordId = existing?.record_id ?? null
    if (!recordId) {
      const { data, error } = await supabase.rpc('next_work_order_record_id', { p_job_id: input.job.id })
      if (error) return { ok: false, error: `Could not number the work order: ${error.message}` }
      recordId = (data as string | null) ?? null
    }
    const issuedOn = todayYmdInAppTz()
    const snapshot = buildSheetWorkOrderSnapshot({
      sheet: { job_number: input.job.hcp_number, address: input.job.job_address },
      scopeLines,
      exclusions,
      references: buildWorkOrderReferences({ bookDocs, payRunDay, includePay: true, coiExpiresOn: coi?.expires_at ?? null, includeInsurance: true }),
      acknowledgements,
      bond: 'none',
      specialProvisions: '',
      proposedStart: input.proposedStart,
      proposedEnd: input.proposedEnd,
      anchor: input.laborJobId ? 'sheet' : 'job',
      facts: {
        jobLabel: input.job.hcp_number,
        jobAddress: input.job.job_address,
        customerName: input.job.customer_name,
        trade: input.job.serviceTypeName ?? null,
        recordId,
        issuedOn,
        issuerName: issuer.name,
        issuerTitle: issuer.title,
        subCompany: null,
        msaSignedOn: msa?.signed_at ? msa.signed_at.slice(0, 10) : null,
      },
    })
    const nowIso = new Date().toISOString()
    const patch = {
      job_id: input.job.id,
      person_id: input.person.id,
      display_name: input.person.name,
      amount: Math.round(input.amount * 100) / 100,
      retainage_pct: existing ? Number(existing.retainage_pct) || 0 : 0,
      status: 'offered',
      offered_at: nowIso,
      declined_at: null,
      decline_reason: null,
      proposed_start: input.proposedStart,
      proposed_end: input.proposedEnd,
      offer_expires_at: input.expires,
      offer_scope_snapshot: snapshot as unknown as StepCommitmentRow['offer_scope_snapshot'],
      record_id: recordId,
      stage_window_id: input.stageWindowId ?? existing?.stage_window_id ?? null,
      work_days: input.workDays != null && input.workDays >= 1 ? Math.min(120, Math.floor(input.workDays)) : null,
    }
    let row: StepCommitmentRow
    if (existing) {
      const { data, error } = await supabase.from('step_commitments').update(patch).eq('id', existing.id).select('*').single()
      if (error) return { ok: false, error: error.message }
      row = data as StepCommitmentRow
    } else {
      const { data, error } = await supabase
        .from('step_commitments')
        .insert({ ...patch, labor_job_id: input.laborJobId, created_by: input.authUserId })
        .select('*')
        .single()
      if (error) return { ok: false, error: error.message }
      row = data as StepCommitmentRow
    }

    const acct = pRes.data as { account_user_id?: string | null; email?: string | null } | null
    const userId = acct?.account_user_id ?? null
    let email = input.person.email ?? acct?.email ?? null
    if (!email && userId) {
      const { data: usr } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      email = (usr as { email?: string | null } | null)?.email ?? null
    }
    const portalUrl = await resolveSubPortalUrl(input.person.id)
    void notifySheetWorkOrderOffered({
      laborJobId: row.labor_job_id,
      workOrderId: row.labor_job_id ? null : row.id,
      sheetLabel: sheetWorkOrderLabel({ job_number: input.job.hcp_number, address: input.job.job_address }),
      offeredByName: issuer.name ?? 'The office',
      recipientName: input.person.name,
      recipientEmail: email,
      recipientUserId: userId,
      amount: Number(row.amount),
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      portalUrl,
    })
    return { ok: true, row, emailed: !!email }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
