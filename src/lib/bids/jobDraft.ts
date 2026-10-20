/**
 * An estimator's job draft (punch list #129 follow-up, v2.5659, the owner's call of 2026-10-20): an estimator reads no
 * job row and may not insert one, so the won bid's Job block offers them **Send to Dispatch** in place of New Job. The
 * draft is the estimator's word on the job — its name, address, GC, the figure it starts at, the trade, a wanted-by day
 * and a note — and it rides the Dispatch request (`dispatch_requests.job_draft`). The inbox's **Open the job** opens New
 * Job with it laid over the bid's own import (`useJobFormImport`), so the assistant adds the team and the schedule and
 * saves. The draft starts from the same kernels the import uses (`lib/bids/jobImportFromBid.ts`), so the two agree.
 * Scheduling stays with the assistant: the draft names no visit day. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatCurrency } from '../jobs/jobFormMoney'
import { bidImportCarry, decideBidImportGc, type BidImportGcOption } from './jobImportFromBid'
import type { GcPacket } from './gcPackets'

export const JOB_DRAFT_VERSION = 1

export interface JobDraft {
  v: typeof JOB_DRAFT_VERSION
  jobName: string
  address: string
  /** The GC packet's key (`BidImportGcOption.key`); null when the bid has no GC to choose. */
  gcKey: string | null
  gcName: string | null
  /** The job's first line: the figure it starts at; null starts it at $0. */
  carry: number | null
  serviceTypeId: string | null
  /** YYYY-MM-DD: the day the estimator wants it opened by; null for no day. */
  wantedBy: string | null
  note: string | null
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const textOrNull = (v: unknown): string | null => text(v) || null
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Defensive read of the column: a draft needs version 1 and an object; anything else is no draft. */
export function parseJobDraft(raw: unknown): JobDraft | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.v !== JOB_DRAFT_VERSION) return null
  const carry = typeof r.carry === 'number' && Number.isFinite(r.carry) && r.carry > 0 ? Math.round(r.carry * 100) / 100 : null
  const wantedBy = text(r.wantedBy)
  return {
    v: JOB_DRAFT_VERSION,
    jobName: text(r.jobName),
    address: text(r.address),
    gcKey: typeof r.gcKey === 'string' ? r.gcKey : null,
    gcName: textOrNull(r.gcName),
    carry,
    serviceTypeId: textOrNull(r.serviceTypeId),
    wantedBy: YMD.test(wantedBy) ? wantedBy : null,
    note: textOrNull(r.note),
  }
}

/** The draft a Dispatch request carries (`pending_payload.job_draft`), or null. */
export function jobDraftFromPayload(payload: unknown): JobDraft | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null
  return parseJobDraft((payload as Record<string, unknown>).job_draft)
}

/** What the sheet opens with: the bid's name, address and trade, the GC the import would pick, and its figure. */
export function draftFromBid(args: {
  bid: { project_name: string | null; address: string | null; service_type_id: string | null; agreed_value: number | string | null }
  packets: ReadonlyArray<GcPacket>
  options: ReadonlyArray<BidImportGcOption>
}): JobDraft {
  const decision = decideBidImportGc(args.packets, args.options)
  // One GC, or a recorded winner: that one. Several and undecided: none yet, the estimator picks.
  const gc = decision.kind === 'proceed' ? (decision.chosen ?? (args.options.length === 1 ? args.options[0]! : null)) : null
  const sentValue = decision.kind === 'proceed' ? decision.sentValue : null
  const { carryValue } = bidImportCarry({ agreedValueRaw: args.bid.agreed_value, sentValue })
  return {
    v: JOB_DRAFT_VERSION,
    jobName: (args.bid.project_name ?? '').trim(),
    address: (args.bid.address ?? '').trim(),
    gcKey: gc?.key ?? null,
    gcName: gc?.name ?? null,
    carry: carryValue,
    serviceTypeId: args.bid.service_type_id ?? null,
    wantedBy: null,
    note: null,
  }
}

/** The figure a GC choice starts the job at: the bid's agreed value, else what that GC was sent. */
export function draftCarryFor(bid: { agreed_value: number | string | null }, gc: Pick<BidImportGcOption, 'value'> | null): number | null {
  return bidImportCarry({ agreedValueRaw: bid.agreed_value, sentValue: gc?.value ?? null }).carryValue
}

/** Why the sheet will not send yet, or null when it may. */
export function draftProblem(d: JobDraft, options: ReadonlyArray<BidImportGcOption>): string | null {
  if (!d.jobName.trim()) return 'Give the job a name.'
  if (!d.address.trim()) return 'Give the job an address.'
  if (options.length > 1 && d.gcKey == null) return 'Pick the GC that won it.'
  return null
}

/** The draft as written: trimmed, empty words as null. */
export function draftForWrite(d: JobDraft): JobDraft {
  return parseJobDraft(d) ?? d
}

function shortDay(ymd: string): string {
  const [y, m, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * The words the inbox row and New Job show for a draft: "Wendi's draft: GC Southern Post · starts at $38,625 · wanted by
 * Oct 30 · note: the slab pour is the 3rd". Only the parts the draft holds.
 */
export function jobDraftWords(d: JobDraft, senderName: string | null | undefined): string {
  const who = (senderName ?? '').trim()
  const parts: string[] = []
  if (d.gcName) parts.push(`GC ${d.gcName}`)
  parts.push(d.carry != null ? `starts at $${formatCurrency(d.carry)}` : 'starts at $0')
  if (d.wantedBy) parts.push(`wanted by ${shortDay(d.wantedBy)}`)
  if (d.note) parts.push(`note: ${d.note}`)
  return `${who ? `${who}'s draft` : 'The draft'}: ${parts.join(' · ')}`
}

/** "Sent to Dispatch Oct 20 · waiting": the estimator's Job block while the request is open. */
export function draftSentLabel(createdAtIso: string | null | undefined): string {
  const ymd = createdAtIso ? calendarYmdInAppTzFromIso(createdAtIso) : ''
  return YMD.test(ymd) ? `Sent to Dispatch ${shortDay(ymd)} · waiting` : 'Sent to Dispatch · waiting'
}
