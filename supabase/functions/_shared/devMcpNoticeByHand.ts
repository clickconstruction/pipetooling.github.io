// A § 53.056 notice that already went out, recorded from the dev seat (v2.7229 / 0.85.0 — the owner's ask of
// 2026-11-13: one paper had been mailed for several jobs at a property and was on record for one of them).
//
// plan_notice_by_hand → apply_notice_by_hand is the Lien desk's own *Already mailed? Record it…*
// (src/components/jobs/LienNoticeByHandPane.tsx over src/lib/jobs/lienNoticeByHandIo.ts): one job_lien_filings row
// for each job the paper covered, all on one packet, written as the paper went — the day, how, to whom, the claim
// and the months as printed, the saved copy — and each covered job's live notice item on the desk marked sent on the
// mailing day. The rows are the app's own: the dry run builds them with the form's kernel from the mirror
// (gcKernels/lib/jobs/lienNoticeByHand.ts → byHandFilingPayloads), the snapshot each row keeps is the form's nine
// values for the first job (lienNoticeJobFields.ts → buildLienNoticeFieldsForJob) with the claim replaced by the
// paper's, and the day a desk item says it went is lienSentAt.ts's. The form's rules hold: its own list of what is
// missing refuses the plan, and a job named beside the first must be one the form would offer — another unpaid job at
// the same property.
//
// Two things the seat adds, because nobody is looking at the form: a job that already holds a live notice with the
// same mailing day and the same number is refused as already recorded, and a first job whose claim was set by hand is
// refused with the desk as its door, since the seat does not read a corrected claim.
//
// It records a fact. It mails nothing, drafts nothing, approves nothing and changes no bill. No wrapper RPC and no
// migration: the dry run is this server's read, hashed with the payload.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpNoticeByHand.test.ts).

import { BY_HAND_METHODS, byHandClaimWords, byHandFilingPayloads, byHandProblems, otherJobsAtProperty, type ByHandInput, type ByHandJob, type ByHandMethod, type ByHandRecipient } from './gcKernels/lib/jobs/lienNoticeByHand.ts'
import { buildLienNoticeFieldsForJob, homesteadStatementApplies, type LienNoticeIssuer } from './gcKernels/lib/jobs/lienNoticeJobFields.ts'
import { lienSignerNameFor } from './gcKernels/lib/jobs/lienSigner.ts'
import { earliestSendDay, sentAtForTypedDay } from './gcKernels/lib/jobs/lienSentAt.ts'
import { workMonthLabel } from './gcKernels/lib/jobs/forecastWorkMonths.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'

export const NOTICE_BY_HAND_VERBS = ['plan_notice_by_hand', 'apply_notice_by_hand'] as const
export type NoticeByHandVerb = (typeof NOTICE_BY_HAND_VERBS)[number]
export function isNoticeByHandVerb(name: string): name is NoticeByHandVerb {
  return (NOTICE_BY_HAND_VERBS as readonly string[]).includes(name)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
/** How many jobs one paper may cover from the seat: the first and nineteen more. A property with more is the desk's. */
export const NOTICE_BY_HAND_JOBS_MAX = 20
export const NOTICE_BY_HAND_NOTE_MAX = 500
export const NOTICE_BY_HAND_LINK_MAX = 2000
export const NOTICE_BY_HAND_TRACKING_MAX = 200
/** The app's key for Settings → Company, where the claimant's name and mailing address live. */
export const ISSUER_SETTINGS_KEY = 'physical_invoice_issuer_v1'
/** The statuses the form reads for the other jobs at a property (`loadJobsAtProperty`). */
export const PROPERTY_JOB_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed'] as const

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export type NoticeByHandPayload = {
  action: 'notice_by_hand'
  job_id: string
  also_covers: string[]
  sent_on: string
  method: ByHandMethod
  tracking: string
  to: ByHandRecipient[]
  claim_as_printed: number
  months_as_printed: string[]
  saved_copy_link: string
  saved_copy_note: string
}

export type NoticeByHandInput = { ok: true; p: NoticeByHandPayload; target: string; planHash: string | null } | { ok: false; error: string }

const METHOD_KEYS = BY_HAND_METHODS.map((m) => m.key)
const NOTICE_SHAPE = `needs notice — { job_id (a jobs_ledger.id — find_job: the job the paper was printed for), also_covers? ([job ids]: the other unpaid jobs at the same property the one paper covered), sent_on (YYYY-MM-DD, the day it was mailed), method (${METHOD_KEYS.join(' | ')}), tracking? (the mail number; an email's address), to ([owner, original_contractor] — only who it really went to), claim_as_printed (dollars, the paper's total), months_as_printed ([YYYY-MM], the months the paper names), saved_copy_link? (the Drive link), saved_copy_note? (one line, under ${NOTICE_BY_HAND_NOTE_MAX}) }. Type it as the paper went.`

/** plan_notice_by_hand / apply_notice_by_hand's input, shaped. What the form itself would refuse is the dry run's to say. */
export function noticeByHandInput(verb: NoticeByHandVerb, input: Json): NoticeByHandInput {
  const src = obj(input.notice)
  const shape = `${verb} ${NOTICE_SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const jobId = str('job_id').toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
  const alsoRaw = src.also_covers === undefined ? [] : src.also_covers
  if (!Array.isArray(alsoRaw) || alsoRaw.some((v) => typeof v !== 'string' || !UUID_RE.test(v.trim()))) return { ok: false, error: `${verb}: also_covers is a list of job ids (find_job), or left out.` }
  const also = (alsoRaw as string[]).map((v) => v.trim().toLowerCase())
  if (new Set([jobId, ...also]).size !== also.length + 1) return { ok: false, error: `${verb}: a job is named twice. Name the paper's own job once in job_id and each other job once in also_covers.` }
  if (also.length + 1 > NOTICE_BY_HAND_JOBS_MAX) return { ok: false, error: `${verb}: one paper covers at most ${NOTICE_BY_HAND_JOBS_MAX} jobs from the seat. Record a larger one from the Lien desk.` }
  const sentOn = str('sent_on')
  if (!YMD_RE.test(sentOn) || Number.isNaN(Date.parse(`${sentOn}T00:00:00Z`))) return { ok: false, error: `${verb}: sent_on is YYYY-MM-DD, the day the paper was mailed. ${NOTICE_SHAPE}` }
  const method = str('method')
  if (!METHOD_KEYS.includes(method as ByHandMethod)) return { ok: false, error: `${verb}: method is one of ${METHOD_KEYS.join(', ')}.` }
  const toRaw = src.to
  if (!Array.isArray(toRaw) || toRaw.some((v) => v !== 'owner' && v !== 'original_contractor')) return { ok: false, error: `${verb}: to is a list of owner and original_contractor — only who the paper really went to.` }
  const to = (['owner', 'original_contractor'] as const).filter((r) => (toRaw as unknown[]).includes(r))
  const claimRaw = src.claim_as_printed
  const claim = typeof claimRaw === 'number' ? claimRaw : typeof claimRaw === 'string' ? Number(claimRaw.replace(/[$,\s]/g, '')) : NaN
  if (!Number.isFinite(claim) || claim < 0 || claim > 100_000_000) return { ok: false, error: `${verb}: claim_as_printed is the paper's total in dollars.` }
  const monthsRaw = src.months_as_printed
  if (!Array.isArray(monthsRaw) || monthsRaw.some((m) => typeof m !== 'string' || !MONTH_RE.test(m.trim()))) return { ok: false, error: `${verb}: months_as_printed is a list of YYYY-MM, the months the paper names.` }
  const months = [...new Set((monthsRaw as string[]).map((m) => m.trim()))].sort()
  const tracking = str('tracking')
  if (tracking.length > NOTICE_BY_HAND_TRACKING_MAX) return { ok: false, error: `${verb}: tracking is the mail number, under ${NOTICE_BY_HAND_TRACKING_MAX} characters.` }
  const link = str('saved_copy_link')
  if (link.length > NOTICE_BY_HAND_LINK_MAX || (link && !/^https:\/\//i.test(link))) return { ok: false, error: `${verb}: saved_copy_link is an https link to the saved copy, or left out.` }
  const note = str('saved_copy_note')
  if (note.length > NOTICE_BY_HAND_NOTE_MAX) return { ok: false, error: `${verb}: saved_copy_note is one line, under ${NOTICE_BY_HAND_NOTE_MAX} characters.` }
  const p: NoticeByHandPayload = { action: 'notice_by_hand', job_id: jobId, also_covers: also, sent_on: sentOn, method: method as ByHandMethod, tracking, to: [...to], claim_as_printed: cents(claim), months_as_printed: months, saved_copy_link: link, saved_copy_note: note }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${verb.replace('apply_', 'plan_')} replied with.` }
    planHash = h
  }
  return { ok: true, p, target: jobId, planHash }
}

// ── the world and the dry run ────────────────────────────────────────────────────────────────────────────────────

export type NoticeByHandReads = {
  rows(table: string, query: string): Promise<Json[]>
  /** `lien_billed_open` for one job, as the desk reads its claim: what the job's sent bills still owe. */
  billedOpen(job: { id: string; revenue: number; payments_made: number; status: string | null }): Promise<number>
}

export type ByHandJobRow = {
  id: string
  job_name: string | null
  job_address: string | null
  hcp_number: string | null
  click_number: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  customer_address_id: string | null
  gc_customer_id?: string | null
  master_user_id?: string | null
  service_type_id?: string | null
  lien_retainage_held?: number | null
}
export const BY_HAND_PRIMARY_COLS = 'id,job_name,job_address,hcp_number,click_number,status,revenue,payments_made,customer_address_id,gc_customer_id,master_user_id,service_type_id,lien_retainage_held'
export const BY_HAND_OTHER_COLS = 'id,job_name,job_address,hcp_number,click_number,status,revenue,payments_made,customer_address_id'

export type ByHandNoticeOnJob = { id: string; job_id: string; first_sent_on: string | null; trackings: string[]; months: string[]; by_hand: boolean; amount: number; printed_claim: number | null }
export type ByHandItemOnJob = { id: string; job_id: string; status: string; months: string[] }

export type NoticeByHandWorld = {
  primary: ByHandJobRow | null
  /** What the desk's claim reads for the first job: its sent bills' open balance. */
  primaryBilledOpen: number
  /** A claim set by hand on the first job, when there is one: the seat does not read it. */
  primaryCorrection: boolean
  /** The other unpaid jobs at the property, as the form lists them. */
  others: ByHandJobRow[]
  /** The newest live § 53.056 item on each covered job that is neither sent nor missed. */
  items: ByHandItemOnJob[]
  /** The live § 53.056 notices already on the covered jobs. */
  notices: ByHandNoticeOnJob[]
  property: { propertyKind: string; homestead: boolean } | null
  gcName: string
  signer: { id: string; name: string | null; notes: string | null } | null
  issuer: LienNoticeIssuer | null
  serviceTypeName: string
}

const inList = (ids: string[]) => `in.(${ids.join(',')})`
const normTracking = (t: string) => t.replace(/\s+/g, '').toLowerCase()

function parseIssuer(valueText: unknown): LienNoticeIssuer | null {
  if (typeof valueText !== 'string' || !valueText.trim()) return null
  try {
    const o = obj(JSON.parse(valueText))
    if (!o) return null
    return { companyName: typeof o.companyName === 'string' ? o.companyName : '', addressText: typeof o.addressText === 'string' ? o.addressText : '' }
  } catch {
    return null
  }
}

export async function readNoticeByHandWorld(reads: NoticeByHandReads, p: NoticeByHandPayload): Promise<NoticeByHandWorld> {
  const empty: NoticeByHandWorld = { primary: null, primaryBilledOpen: 0, primaryCorrection: false, others: [], items: [], notices: [], property: null, gcName: '', signer: null, issuer: null, serviceTypeName: '' }
  const primary = ((await reads.rows('jobs_ledger', `select=${BY_HAND_PRIMARY_COLS}&id=eq.${p.job_id}`))[0] as ByHandJobRow | undefined) ?? null
  if (!primary) return empty
  // The form's own read of the other jobs at the property: the same saved record, else the same street number.
  const streetNumber = (primary.job_address ?? '').trim().split(/\s+/)[0] ?? ''
  let others: ByHandJobRow[] = []
  if (primary.customer_address_id || /^\d/.test(streetNumber)) {
    const where = primary.customer_address_id ? `customer_address_id=eq.${primary.customer_address_id}` : `job_address=ilike.${encodeURIComponent(`${streetNumber}*`)}`
    const rows = (await reads.rows('jobs_ledger', `select=${BY_HAND_OTHER_COLS}&status=in.(${PROPERTY_JOB_STATUSES.join(',')})&id=neq.${primary.id}&${where}&limit=500`)) as ByHandJobRow[]
    others = otherJobsAtProperty(primary, rows)
  }
  const covered = [primary.id, ...p.also_covers]
  const itemRows = await reads.rows('job_lien_desk_items', `select=id,job_id,status,months,created_at&job_id=${inList(covered)}&kind=eq.notice_53_056&voided_at=is.null&status=not.in.(sent,missed)&order=created_at.desc`)
  const itemByJob = new Map<string, ByHandItemOnJob>()
  for (const r of itemRows) {
    const jobId = String(r.job_id ?? '')
    if (!itemByJob.has(jobId)) itemByJob.set(jobId, { id: String(r.id ?? ''), job_id: jobId, status: String(r.status ?? ''), months: Array.isArray(r.months) ? (r.months as unknown[]).filter((m): m is string => typeof m === 'string') : [] })
  }
  const noticeRows = await reads.rows('job_lien_filings', `select=id,job_id,sends,months_covered,by_hand,amount,printed_claim,created_at&job_id=${inList(covered)}&kind=eq.notice_53_056&voided_at=is.null&order=created_at.asc`)
  const notices: ByHandNoticeOnJob[] = noticeRows.map((r) => ({
    id: String(r.id ?? ''),
    job_id: String(r.job_id ?? ''),
    first_sent_on: earliestSendDay(r.sends),
    trackings: (Array.isArray(r.sends) ? r.sends : []).map((s) => (obj(s) && typeof obj(s)!.tracking === 'string' ? (obj(s)!.tracking as string).trim() : '')).filter(Boolean),
    months: Array.isArray(r.months_covered) ? (r.months_covered as unknown[]).filter((m): m is string => typeof m === 'string') : [],
    by_hand: r.by_hand === true,
    amount: num(r.amount),
    printed_claim: r.printed_claim === null || r.printed_claim === undefined ? null : num(r.printed_claim),
  }))
  const correction = (await reads.rows('job_lien_claim_corrections', `select=job_id&job_id=eq.${primary.id}`)).length > 0
  let property: NoticeByHandWorld['property'] = null
  if (primary.customer_address_id) {
    const rec = (await reads.rows('customer_addresses', `select=property_kind,homestead&id=eq.${primary.customer_address_id}`))[0]
    if (rec) property = { propertyKind: typeof rec.property_kind === 'string' ? rec.property_kind.trim() : '', homestead: rec.homestead === true }
  }
  const gc = primary.gc_customer_id ? (await reads.rows('customers', `select=name&id=eq.${primary.gc_customer_id}`))[0] : undefined
  const signerRow = primary.master_user_id ? (await reads.rows('users', `select=id,name,notes&id=eq.${primary.master_user_id}`))[0] : undefined
  const issuerRow = (await reads.rows('app_settings', `select=value_text&key=eq.${ISSUER_SETTINGS_KEY}`))[0]
  const serviceType = primary.service_type_id ? (await reads.rows('service_types', `select=name&id=eq.${primary.service_type_id}`))[0] : undefined
  const primaryBilledOpen = await reads.billedOpen({ id: primary.id, revenue: num(primary.revenue), payments_made: num(primary.payments_made), status: primary.status })
  return {
    primary,
    primaryBilledOpen,
    primaryCorrection: correction,
    others,
    items: [...itemByJob.values()],
    notices,
    property,
    gcName: typeof gc?.name === 'string' ? gc.name.trim() : '',
    signer: signerRow ? { id: String(signerRow.id ?? ''), name: typeof signerRow.name === 'string' ? signerRow.name : null, notes: typeof signerRow.notes === 'string' ? signerRow.notes : null } : null,
    issuer: parseIssuer(issuerRow?.value_text),
    serviceTypeName: typeof serviceType?.name === 'string' ? serviceType.name : '',
  }
}

export type DryRun = { ok: true; reply: Json; input: ByHandInput; fields: Json } | { ok: false; refused: string }

const NOT_DONE = 'Nothing is mailed, drafted, approved or signed, and no bill or payment changes. The record says a paper went; whether it does what the law asks of a notice is not judged here.'
const SHOWS = 'each job’s Lien window under Filings on this job, the Lien desk’s Notices and Affidavits on their next read, and the notice record that prints behind an affidavit'
const RECIPIENT_WORDS: Record<ByHandRecipient, string> = { owner: 'owner of record', original_contractor: 'original contractor' }
const monthsWords = (months: string[]): string => months.map((m) => workMonthLabel(m)).join(', ')

/** The form's own input, from the payload and the read: the first job at its desk claim, each other at its open balance. */
export function byHandInputOf(p: NoticeByHandPayload, world: NoticeByHandWorld): ByHandInput {
  const itemFor = (jobId: string) => world.items.find((i) => i.job_id === jobId)?.id ?? null
  const primary = world.primary!
  const jobs: ByHandJob[] = [{ jobId: primary.id, label: jobLabelOf(primary), amount: Math.max(0, world.primaryBilledOpen), itemId: itemFor(primary.id) }]
  for (const id of p.also_covers) {
    const o = world.others.find((j) => j.id === id)
    if (!o) continue
    jobs.push({ jobId: o.id, label: jobLabelOf(o), amount: Math.max(0, num(o.revenue) - num(o.payments_made)), itemId: itemFor(o.id) })
  }
  return { sentOn: p.sent_on, method: p.method, tracking: p.tracking, recipients: p.to, printedClaim: p.claim_as_printed, printedMonths: p.months_as_printed, documentUrl: p.saved_copy_link, documentNote: p.saved_copy_note, jobs }
}

/**
 * What the plan says and what the hash commits to: the paper as typed, each covered job with its share, the desk item
 * that will read sent and the notices it already holds, the snapshot every row keeps, and the other unpaid jobs at the
 * property the paper is not being recorded on. Refuses a job not visible, whatever the form's own list refuses, a job
 * in also_covers the form would not offer, a first job with a claim set by hand, and a job that already holds this
 * mailing.
 */
export function noticeByHandDryRun(p: NoticeByHandPayload, world: NoticeByHandWorld, who: { userId: string; name: string | null }, todayYmd: string): DryRun {
  const primary = world.primary
  if (!primary) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(primary)
  const strangers = p.also_covers.filter((id) => !world.others.some((j) => j.id === id))
  if (strangers.length > 0) return { ok: false, refused: `${label}: ${strangers.length === 1 ? 'one job in also_covers is' : `${strangers.length} jobs in also_covers are`} not among the other unpaid jobs at this property (${strangers.join(', ')}). The form offers only those: ${world.others.length === 0 ? 'there are none.' : world.others.map((j) => `${jobLabelOf(j)} (${j.id})`).join(' · ')}` }
  if (world.primaryCorrection) return { ok: false, refused: `${label} has a claim set by hand on the Lien desk. The seat does not read a corrected claim: record this notice from the Lien desk, on the job's notice, with Already mailed? Record it…` }
  const input = byHandInputOf(p, world)
  const problems = byHandProblems(input, todayYmd)
  if (problems.length > 0) return { ok: false, refused: `${label}: the form would not record this. Missing or wrong: ${problems.join(' · ')}.` }
  const sameMailing = world.notices.filter((n) => n.first_sent_on === p.sent_on && (p.tracking ? n.trackings.some((t) => normTracking(t) === normTracking(p.tracking)) : n.by_hand))
  if (sameMailing.length > 0) {
    const names = [...new Set(sameMailing.map((n) => n.job_id))].map((id) => (id === primary.id ? label : jobLabelOf(world.others.find((j) => j.id === id) ?? { job_name: null, click_number: null, hcp_number: null })))
    return { ok: false, refused: `Already on record: ${names.join(' · ')} ${names.length === 1 ? 'holds' : 'hold'} a notice mailed ${p.sent_on}${p.tracking ? ` with that number` : ' by hand'}. Leave ${names.length === 1 ? 'it' : 'them'} out and plan again for the rest; a job the paper was printed for but that is already recorded cannot be the first job.` }
  }
  // The first job is always there: byHandInputOf puts it first.
  const firstShare = input.jobs[0]?.amount ?? 0
  const fields = {
    ...buildLienNoticeFieldsForJob({
      jobName: primary.job_name,
      jobAddress: primary.job_address,
      homesteadStatement: homesteadStatementApplies(world.property),
      originalContractorName: world.gcName,
      openBalance: firstShare,
      contactPerson: lienSignerNameFor(world.signer ? [world.signer] : [], primary.master_user_id ?? null, who.name ?? ''),
      issuer: world.issuer,
      todayYmd,
      retainageHeld: primary.lien_retainage_held ?? null,
      serviceTypeName: world.serviceTypeName,
    }),
    claimAmount: p.claim_as_printed.toFixed(2),
  } as Json
  const coveredTotal = cents(input.jobs.reduce((s, j) => s + j.amount, 0))
  const difference = byHandClaimWords(p.claim_as_printed, input.jobs.length > 1 ? coveredTotal : firstShare)
  const sentAt = sentAtForTypedDay(p.sent_on, todayYmd)
  const jobs = input.jobs.map((j) => {
    const item = world.items.find((i) => i.job_id === j.jobId) ?? null
    const share = cents(j.amount)
    return {
      id: j.jobId,
      label: j.label,
      share,
      printed_claim_on_its_row: Math.abs(p.claim_as_printed - share) < 0.005 ? null : p.claim_as_printed,
      desk_item: item ? { id: item.id, status: item.status, months: item.months, becomes: 'sent', sent_at: sentAt ?? 'the moment of the write' } : null,
      notices_already_on_it: world.notices.filter((n) => n.job_id === j.jobId).map((n) => ({ id: n.id, mailed: n.first_sent_on, months: n.months, by_hand: n.by_hand })),
    }
  })
  const zero = jobs.filter((j) => j.share <= 0).map((j) => j.label)
  const notCovered = world.others.filter((j) => !p.also_covers.includes(j.id)).map((j) => ({ id: j.id, label: jobLabelOf(j), open: cents(Math.max(0, num(j.revenue) - num(j.payments_made))) }))
  const to = p.to.map((r) => RECIPIENT_WORDS[r]).join(' and ')
  return {
    ok: true,
    input,
    fields,
    reply: {
      action: 'notice_by_hand',
      paper: { mailed: p.sent_on, how: BY_HAND_METHODS.find((m) => m.key === p.method)?.label ?? p.method, tracking: p.tracking || null, to: p.to, claim_as_printed: p.claim_as_printed, months_as_printed: p.months_as_printed, saved_copy_link: p.saved_copy_link || null, saved_copy_note: p.saved_copy_note || null },
      jobs,
      covered_total: coveredTotal,
      difference: difference || null,
      snapshot: fields,
      recorded_by: who.userId,
      says: `One notice mailed ${p.sent_on} to the ${to}, claiming ${usd(p.claim_as_printed)} for ${monthsWords(p.months_as_printed)}, goes on record for ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}: ${jobs.map((j) => `${j.label} (${usd(j.share)})`).join(' · ')}.${difference ? ` The paper against the app: ${difference}.` : ''}`,
      ...(p.to.length < 2 ? { one_recipient: `The paper went to the ${to} alone. The record will say no copy to the ${p.to.includes('owner') ? 'original contractor' : 'owner of record'} is on record, and an affidavit's notice record will ask about it.` } : {}),
      ...(zero.length > 0 ? { nothing_open: `${zero.join(' · ')} ${zero.length === 1 ? 'reads' : 'read'} nothing open on sent bills, so ${zero.length === 1 ? 'its' : 'their'} share is $0.00.` } : {}),
      ...(notCovered.length > 0 ? { other_unpaid_jobs_at_the_property_not_covered: notCovered } : {}),
      not_done: NOT_DONE,
      shows: SHOWS,
    },
  }
}

/** The rows the apply inserts: the form's own payloads, on one packet. */
export function noticeByHandRows(dry: Extract<DryRun, { ok: true }>, who: { userId: string }, packetId: string): Json[] {
  return byHandFilingPayloads(dry.input, { userId: who.userId, packetId, fieldsFor: () => dry.fields as never }) as Json[]
}

/** The desk items the apply marks sent, each with its filing: the form's `markLienDeskItemSent`. */
export function noticeByHandItemPatches(dry: Extract<DryRun, { ok: true }>, filingByJob: ReadonlyMap<string, string>, todayYmd: string): Array<{ itemId: string; jobId: string; patch: Json }> {
  const sentAt = sentAtForTypedDay(dry.input.sentOn, todayYmd)
  const out: Array<{ itemId: string; jobId: string; patch: Json }> = []
  for (const j of dry.input.jobs) {
    const filingId = filingByJob.get(j.jobId)
    if (j.itemId && filingId) out.push({ itemId: j.itemId, jobId: j.jobId, patch: { status: 'sent', sent_filing_id: filingId, ...(sentAt ? { sent_at: sentAt } : {}) } })
  }
  return out
}

export type NoticeByHandOutcome = { jobId: string; label: string; filingId: string | null; item: 'marked sent' | 'none' | { failed: string } }

/** The apply's reply: what landed on each job, a job whose row did not land named with the rest, and what to read next. */
export function noticeByHandAppliedWords(p: NoticeByHandPayload, packetId: string, outcomes: NoticeByHandOutcome[]): Json {
  const landed = outcomes.filter((o) => o.filingId)
  const missing = outcomes.filter((o) => !o.filingId)
  const itemFailed = outcomes.filter((o) => typeof o.item === 'object')
  return {
    action: p.action,
    ok: missing.length === 0,
    packet_id: packetId,
    recorded: landed.map((o) => ({ job: o.label, job_id: o.jobId, filing_id: o.filingId, desk_item: typeof o.item === 'object' ? `not marked sent: ${o.item.failed}` : o.item })),
    ...(missing.length > 0 ? { not_recorded: missing.map((o) => ({ job: o.label, job_id: o.jobId, why: 'no row came back for this job (RLS let none through)' })) } : {}),
    next:
      missing.length === 0
        ? `The notice mailed ${p.sent_on} is on record for ${landed.length} ${landed.length === 1 ? 'job' : 'jobs'}${itemFailed.length > 0 ? `; ${itemFailed.length} desk ${itemFailed.length === 1 ? 'item was' : 'items were'} not marked sent and still ${itemFailed.length === 1 ? 'reads' : 'read'} to do on the desk` : ''}. read_rows on job_lien_filings (packet_id eq ${packetId}) reads the rows back; list_lien_affidavit_windows (call_read) shows what the desk now asks for. Nothing was mailed, drafted or approved.`
        : `Recorded on ${landed.length} of ${outcomes.length}. Plan again for the ${missing.length === 1 ? 'job' : 'jobs'} not recorded, leaving out the ones that are: the plan refuses a job that already holds this mailing.`,
  }
}
