/**
 * The "send this job as a task" preset (v2.3751).
 *
 * Four doors open the Add-task dialog from a job: the Pipeline row's purple
 * arrow, the phone card's "Send as task" (twice), and the Job Detail header.
 * Until v2.3751 each seeded the title box with the checklist's own link grammar,
 * `{{1:1016 · Mission faucet}} — `, and the sender typed after the dash. The
 * grammar renders as a link once the task is on a list, but in the box it is
 * braces and a "1" to the person typing. Now the doors hand the dialog the job
 * itself; the dialog shows it as a bar above the box and composes the stored
 * title on Send — byte-for-byte what was stored before, so every row, report
 * and history that reads a task title keeps working unchanged.
 */
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'

export type ChecklistJobPreset = {
  id: string
  /** The display number — HCP first, else C# (the app-wide precedence); null when the job has neither. */
  number: string | null
  name: string
  /** "PLUM" and its color when the service type is a known trade; null otherwise. */
  trade: { tag: string; color: string } | null
  address: string | null
  /** The customer, or the GC when the job has none — whoever the row names under the address. */
  customer: string | null
  /** In-app path the bar's "open" door navigates to (the dialog stays open behind it). */
  path: string
  /** Absolute link stored as link [1], exactly as the doors stored it before. */
  url: string
}

export type ChecklistJobPresetInput = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  serviceTypeName?: string | null
  customerName?: string | null
  /** The GC's name — shown when the job has no customer of its own (the pipeline row's second line). */
  gcName?: string | null
}

const clean = (s: string | null | undefined): string => (s ?? '').trim()

export function checklistJobPath(jobId: string): string {
  return `/jobs?jobDetail=${encodeURIComponent(jobId)}`
}

export function buildChecklistJobPreset(input: ChecklistJobPresetInput, origin: string): ChecklistJobPreset {
  const path = checklistJobPath(input.id)
  const trade = getBidServiceTypeTag(input.serviceTypeName)
  return {
    id: input.id,
    number: effectiveJobLedgerNumber(input.hcp_number, input.click_number) || null,
    name: clean(input.job_name) || 'Job',
    trade: trade ? { tag: trade.tag.toUpperCase(), color: trade.color } : null,
    address: clean(input.job_address) || null,
    customer: clean(input.customerName) || clean(input.gcName) || null,
    path,
    url: `${origin}${path}`,
  }
}

/**
 * The link's anchor text: "1016 · Mission faucet" ("— · Job" when the job has
 * no number). Braces are dropped so the label can never close the token early.
 */
export function checklistJobLinkLabel(job: Pick<ChecklistJobPreset, 'number' | 'name'>): string {
  const num = clean(job.number) || '—'
  return `${num} · ${job.name}`.replace(/[{}]/g, '')
}

/** What Send stores: `{{1:<label>}} — <typed>` — the pre-v2.3751 shape, unchanged. */
export function composeChecklistJobTitle(job: Pick<ChecklistJobPreset, 'number' | 'name'>, typed: string): string {
  return `{{1:${checklistJobLinkLabel(job)}}} — ${typed.trim()}`
}

/**
 * Link [1] is the job, always, and never twice: the stored links start with the
 * job's URL whatever the sender did in the Links section.
 */
export function checklistJobLinks(job: Pick<ChecklistJobPreset, 'url'>, links: string[]): string[] {
  return [job.url, ...links.filter((u) => u.trim() && u !== job.url)]
}

/** The dialog preset a job door opens with: empty title box, the job on the bar, its link as [1]. */
export function checklistJobModalPreset(
  input: ChecklistJobPresetInput,
  origin: string
): { title: string; links: string[]; job: ChecklistJobPreset } {
  const job = buildChecklistJobPreset(input, origin)
  return { title: '', links: [job.url], job }
}
