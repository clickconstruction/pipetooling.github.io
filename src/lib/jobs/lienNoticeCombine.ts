/**
 * One notice per property, on purpose (#35 PR 3). The run already shares the
 * owner's envelope across the jobs at one property (v2.3720) but prints one
 * § 53.056 form per job. When the office ticks *combine*, the jobs at one
 * property under one original contractor become ONE notice: one form, the
 * claims summed, the months joined — and still one filing per job, on one
 * packet, each with its own share and the paper's total. Pure; the run modal
 * decides when to call it and the IO writes the rows.
 */
import { filingDocumentPayload } from './lienFilingDocumentLink'
import type { RunNotice, RunSendRecord } from './lienDeskRun'
import { propertyKey } from './ownerConfirm'

/** A job inside a combined notice — what its own filing records. */
export type CombinedPart = {
  itemId: string
  jobId: string
  jobNumber: string
  label: string
  amount: number
  months: string[]
}

export type CombinedRunNotice = RunNotice & {
  /** Present on a notice that stands for several jobs; absent on a plain one. */
  parts?: CombinedPart[]
}

/** Two notices combine when they go to the same owner at the same address from the same original contractor. */
export function combineKey(n: RunNotice): string {
  const owner = n.recipients.find((r) => r.key === 'owner')
  const gc = n.fields.originalContractorName.trim().toLowerCase()
  const addr = propertyKey(owner?.address ?? '') || ''
  const name = (owner?.name ?? '').trim().toLowerCase()
  if (!addr || !name || !gc) return ''
  return `${gc}|${name}|${addr}`
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** "273 + 858 + 866" */
export function combinedJobNumbers(parts: ReadonlyArray<Pick<CombinedPart, 'jobNumber'>>): string {
  return parts.map((p) => p.jobNumber).join(' + ')
}

/**
 * Fold the notices that share a `combineKey` into one each; the rest pass
 * through untouched, in their original order. The biggest claim leads (its
 * form, cover page and recipients carry), the months are the union, the claim
 * is the sum, and the parts remember each job's own share for its filing.
 */
export function combineNoticesByProperty(notices: ReadonlyArray<RunNotice>, opts: { combine: boolean }): CombinedRunNotice[] {
  if (!opts.combine) return notices.map((n) => ({ ...n }))
  const groups = new Map<string, RunNotice[]>()
  const order: string[] = []
  const out: CombinedRunNotice[] = []
  notices.forEach((n, i) => {
    const key = combineKey(n) || `solo:${i}`
    if (!groups.has(key)) { groups.set(key, []); order.push(key) }
    groups.get(key)!.push(n)
  })
  for (const key of order) {
    const group = groups.get(key)!
    if (group.length === 1) { out.push({ ...group[0]! }); continue }
    const sorted = group.slice().sort((a, b) => b.amount - a.amount || a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }))
    const lead = sorted[0]!
    const parts: CombinedPart[] = sorted.map((n) => ({ itemId: n.itemId, jobId: n.jobId, jobNumber: n.jobNumber, label: n.label, amount: n.amount, months: n.months.slice() }))
    const months = [...new Set(sorted.flatMap((n) => n.months))].sort()
    const amount = Math.round(sorted.reduce((s, n) => s + n.amount, 0) * 100) / 100
    const jobNumber = combinedJobNumbers(parts)
    out.push({
      ...lead,
      label: `${lead.label.split(' · ').slice(1).join(' · ') || lead.label} · ${jobNumber}`,
      jobNumber,
      months,
      amount,
      fields: { ...lead.fields, claimAmount: money(amount) },
      extras: { ...lead.extras, refItems: [`Jobs #${jobNumber.replace(/ \+ /g, ', #')}`, ...(lead.extras.refItems ?? []).filter((r) => !/^Job #/.test(r))] },
      parts,
    })
  }
  return out
}

/** How many notices the run prints, and how many jobs they stand for. */
export function combineSummary(notices: ReadonlyArray<CombinedRunNotice>): { notices: number; jobs: number; combined: number } {
  const jobs = notices.reduce((s, n) => s + (n.parts?.length ?? 1), 0)
  return { notices: notices.length, jobs, combined: notices.filter((n) => (n.parts?.length ?? 0) > 1).length }
}

/**
 * The `job_lien_filings` inserts for one notice — one per job it stands for,
 * all on one packet: the job's own share as the amount, the paper's months
 * and total, both sends, the saved copy. A plain notice yields one row and no
 * packet.
 */
export function combinedFilingPayloads(
  n: CombinedRunNotice,
  sends: ReadonlyArray<RunSendRecord>,
  opts: { userId: string | null; packetId: string; document?: { url?: string | null; note?: string | null } },
): Array<Record<string, unknown>> {
  const parts = n.parts && n.parts.length > 1 ? n.parts : null
  const doc = filingDocumentPayload(opts.document ?? {})
  const fields = JSON.parse(JSON.stringify(n.fields)) as Record<string, unknown>
  if (!parts) {
    return [{ job_id: n.jobId, created_by: opts.userId, kind: 'notice_53_056', amount: n.amount, months_covered: n.months, fields, sends: sends.map((s) => ({ ...s })), ...doc }]
  }
  return parts.map((p) => ({
    job_id: p.jobId,
    created_by: opts.userId,
    kind: 'notice_53_056',
    amount: Math.round(p.amount * 100) / 100,
    months_covered: n.months.slice(),
    fields,
    sends: sends.map((s) => ({ ...s })),
    packet_id: opts.packetId,
    printed_claim: n.amount,
    ...doc,
  }))
}
