/**
 * The reads and writes behind a job's charges (punch list #254, PR 3): approved clock sessions with each person's
 * standing, the job's material lines, the rate card, the job's rule and markup, its revenue and its adjustments —
 * handed to `buildJobCharges` — and the three writes the Charges window makes: adjustments added, adjustments
 * reverted, the job's rule and markup saved. Reads as the signed-in user under RLS; the adjustments table and the
 * job's new columns are read and written through casts until the generated types catch up.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { CrewSessionInput, JobChargeRule } from './crewDays'
import { jobChargeRuleFrom } from './crewDays'
import { isEstimateCharge, type MaterialLineInput } from './materialsCharged'
import { chargeAdjustmentFromRow, type ChargeAdjustment, type ChargeAdjustmentKind } from './adjustments'
import { parseChargeStanding, parseCrewShape, rateCardFromSettings, RATE_CARD_SETTING_KEYS, type CrewShape, type RateCard } from './rateCard'
import type { JobChargesInput } from './jobCharges'

export type JobChargesReadResult = {
  input: JobChargesInput
  job: { id: string; number: string; name: string; customerName: string; revenue: number }
  rule: JobChargeRule
  /** The job's own markup, or null for the company's. */
  jobMarkupPct: number | null
  adjustments: ChargeAdjustment[]
  /** Why the adjustments could not be read, when they could not: the window shows the record and says so. */
  adjustmentsError: string | null
}

const ADJUSTMENTS = 'job_charge_adjustments' as never

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** The job's approved sessions as crew-session inputs, each person's standing read from their user row. */
export async function loadCrewSessions(jobId: string): Promise<CrewSessionInput[]> {
  const { data, error } = await supabase
    .from('clock_sessions')
    .select('user_id, work_date, clocked_in_at, clocked_out_at, origin, users!clock_sessions_user_id_fkey(name)')
    .eq('job_ledger_id', jobId)
    .not('approved_at', 'is', null)
    .not('clocked_out_at', 'is', null)
  if (error) throw error
  const rows = (data ?? []) as Array<{ user_id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; origin: string | null; users: { name: string | null } | null }>
  const ids = Array.from(new Set(rows.map((r) => r.user_id)))
  const standings = new Map<string, ReturnType<typeof parseChargeStanding>>()
  if (ids.length) {
    // The two columns the lookup needs, never `*` (v2.6484); a read that fails throws, and the window names its reason.
    const { data: users, error: uerr } = await supabase.from('users').select('id, charge_standing').in('id', ids)
    if (uerr) throw uerr
    for (const u of (users ?? []) as unknown as Array<{ id: string; charge_standing?: unknown }>) standings.set(u.id, parseChargeStanding(u.charge_standing))
  }
  return rows.map((r) => ({
    userId: r.user_id,
    name: (r.users?.name ?? '').split(' ')[0] || 'someone',
    standing: standings.get(r.user_id) ?? 'none',
    workDate: r.work_date,
    hours: r.clocked_out_at ? Math.max(0, (new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) / 3.6e6) : 0,
    imported: r.origin === 'imported',
  }))
}

/** The job's supply-house invoice shares as material lines; tallied parts and typed charges join them in `loadMaterialLines`. */
export async function loadSupplyHouseLines(jobId: string): Promise<MaterialLineInput[]> {
  const { data, error } = await supabase
    .from('supply_house_invoice_job_allocations')
    .select('invoice_id, pct, supply_house_invoices!inner(invoice_number, invoice_date, amount, supply_houses(name))')
    .eq('job_id', jobId)
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{ invoice_id: string; pct: number | null; supply_house_invoices: { invoice_number: string | null; invoice_date: string | null; amount: number | null; supply_houses: { name: string | null } | null } | null }>
  return rows
    .map((r) => {
      const inv = r.supply_house_invoices
      const share = Math.round(num(inv?.amount) * (num(r.pct) / 100) * 100) / 100
      const house = inv?.supply_houses?.name?.trim() || 'Supply house'
      return { id: `inv:${r.invoice_id}`, kind: 'supply_invoice' as const, label: `${house} · invoice ${inv?.invoice_number ?? '?'}`, dateKey: inv?.invoice_date ?? null, cost: share }
    })
    .sort((a, b) => (a.dateKey ?? '') < (b.dateKey ?? '') ? -1 : 1)
}

/** The job's tallied parts as material lines. */
export async function loadTallyPartLines(jobId: string): Promise<MaterialLineInput[]> {
  const { data, error } = await supabase.from('jobs_tally_parts').select('id, fixture_name, fixture_cost, quantity, created_at').eq('job_id', jobId)
  if (error) throw error
  return ((data ?? []) as Array<{ id: string; fixture_name: string | null; fixture_cost: number | null; quantity: number | null; created_at: string | null }>).map((r) => ({
    id: `part:${r.id}`,
    kind: 'tally_part' as const,
    label: `${r.fixture_name ?? 'part'}${num(r.quantity) > 1 ? ` × ${num(r.quantity)}` : ''}`,
    dateKey: r.created_at ? r.created_at.slice(0, 10) : null,
    cost: Math.round(num(r.fixture_cost) * 100) / 100,
  }))
}

/** The job's typed material charges (the job form's Other job charges) as material lines; a cost batch's ESTIMATE rows are left out. */
export async function loadTypedChargeLines(jobId: string): Promise<MaterialLineInput[]> {
  const { data, error } = await supabase.from('jobs_ledger_materials').select('id, description, amount, charged_on, created_at').eq('job_id', jobId)
  if (error) throw error
  return ((data ?? []) as Array<{ id: string; description: string | null; amount: number | null; charged_on: string | null; created_at: string | null }>)
    .filter((r) => !isEstimateCharge(r.description) && num(r.amount) > 0)
    .map((r) => ({
      id: `typed:${r.id}`,
      kind: 'typed_charge' as const,
      label: (r.description ?? '').trim() || 'Typed charge',
      dateKey: r.charged_on ?? (r.created_at ? r.created_at.slice(0, 10) : null),
      cost: Math.round(num(r.amount) * 100) / 100,
    }))
}

export async function loadMaterialLines(jobId: string): Promise<MaterialLineInput[]> {
  const [invoices, parts, typed] = await Promise.all([loadSupplyHouseLines(jobId), loadTallyPartLines(jobId), loadTypedChargeLines(jobId)])
  return [...invoices, ...parts, ...typed]
}

export async function loadRateCard(): Promise<RateCard> {
  const { data, error } = await supabase.from('app_settings').select('key, value_num').in('key', RATE_CARD_SETTING_KEYS)
  if (error) throw error
  return rateCardFromSettings((data ?? []) as Array<{ key: string; value_num: unknown }>)
}

export async function loadChargeAdjustments(jobId: string): Promise<ChargeAdjustment[]> {
  const { data, error } = await supabase
    .from(ADJUSTMENTS)
    .select('id, job_id, kind, target, shape, amount, reason, created_at, reverted_at, made_by_user:users!job_charge_adjustments_made_by_fkey(name)')
    .eq('job_id', jobId)
    .is('reverted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown[]).map(chargeAdjustmentFromRow).filter((a): a is ChargeAdjustment => a != null)
}

type JobRow = { id: string; click_number: string | null; hcp_number: string | null; job_name: string | null; customer_name: string | null; revenue: number | null; charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown; materials_markup_pct?: unknown }

export async function loadJobCharges(jobId: string): Promise<JobChargesReadResult> {
  const [{ data: jobRaw, error: jerr }, sessions, lines, card, adjustmentsRead] = await Promise.all([
    supabase.from('jobs_ledger').select('*').eq('id', jobId).maybeSingle(),
    loadCrewSessions(jobId),
    loadMaterialLines(jobId),
    loadRateCard(),
    loadChargeAdjustments(jobId).then(
      (rows) => ({ rows, error: null as string | null }),
      (e: unknown) => ({ rows: [] as ChargeAdjustment[], error: formatErrorMessage(e, 'The adjustments could not be read.') }),
    ),
  ])
  if (jerr) throw jerr
  const adjustments = adjustmentsRead.rows
  if (!jobRaw) throw new Error('The job could not be read.')
  const job = jobRaw as unknown as JobRow
  const rule = jobChargeRuleFrom(job, parseCrewShape)
  const jobMarkupPct = job.materials_markup_pct == null ? null : num(job.materials_markup_pct)
  const revenue = num(job.revenue)
  return {
    input: { sessions, lines, card, rule, markupPct: jobMarkupPct, adjustments, revenue },
    job: { id: job.id, number: job.click_number || job.hcp_number || '', name: job.job_name ?? '', customerName: job.customer_name ?? '', revenue },
    rule,
    jobMarkupPct,
    adjustments,
    adjustmentsError: adjustmentsRead.error,
  }
}

export type NewChargeAdjustment = { kind: ChargeAdjustmentKind; target: string; shape: CrewShape | null; /** A line's cost as it stands, for a line adjustment. */ amount: number | null; reason: string }

/** The window's Save: every adjustment in one insert, as the signed-in user. */
export async function addChargeAdjustments(jobId: string, rows: ReadonlyArray<NewChargeAdjustment>, madeBy: string): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from(ADJUSTMENTS).insert(rows.map((r) => ({ job_id: jobId, kind: r.kind, target: r.target, shape: r.kind === 'day_shape' ? r.shape : null, amount: r.kind === 'line_off' || r.kind === 'line_pass_through' ? r.amount : null, reason: r.reason.trim(), made_by: madeBy })) as never)
  if (error) throw error
}

/** Every open adjustment on a set of jobs in one read, by job, for the ledger's column. */
export async function loadChargeAdjustmentsForJobs(jobIds: ReadonlyArray<string>): Promise<Map<string, ChargeAdjustment[]>> {
  const out = new Map<string, ChargeAdjustment[]>()
  if (!jobIds.length) return out
  const { data, error } = await supabase
    .from(ADJUSTMENTS)
    .select('id, job_id, kind, target, shape, amount, reason, created_at, reverted_at')
    .in('job_id', jobIds as string[])
    .is('reverted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  for (const raw of (data ?? []) as unknown[]) {
    const a = chargeAdjustmentFromRow(raw)
    if (!a) continue
    const list = out.get(a.jobId) ?? []
    list.push(a)
    out.set(a.jobId, list)
  }
  return out
}

/** Revert to the record: every open adjustment on the job stamped, never deleted. */
export async function revertChargeAdjustments(jobId: string, by: string, ids?: ReadonlyArray<string>): Promise<void> {
  let q = supabase.from(ADJUSTMENTS).update({ reverted_at: new Date().toISOString(), reverted_by: by } as never).eq('job_id', jobId).is('reverted_at', null)
  if (ids && ids.length) q = q.in('id', ids as string[])
  const { error } = await q
  if (error) throw error
}

/** The job's rule and markup, as the window and Edit Job write them. */
export async function saveJobChargeRule(jobId: string, rule: JobChargeRule, markupPct: number | null): Promise<void> {
  const patch = {
    charge_rule: rule.kind,
    charge_shape: rule.kind === 'shape' ? rule.shape : null,
    hourly_charge_rate: rule.kind === 'flat' ? rule.rate : null,
    materials_markup_pct: markupPct,
  }
  const { error } = await supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)
  if (error) throw error
}
