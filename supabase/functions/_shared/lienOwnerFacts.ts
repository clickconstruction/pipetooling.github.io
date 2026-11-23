/**
 * Two columns of counsel's lien grid, read off the owner's call (punch list #85,
 * a review residual). Every § 53.056 letter asks the owner three questions by
 * phone. The office types the answers on the sent notice's record
 * (`job_lien_desk_items.fields.ownerCall`, `src/lib/jobs/lienOwnerCall.ts`).
 * Two of them are columns on the grid: *Paid out to GC* and *10 % reserved*.
 * Until v2.8315 the grid drew both blank whatever the owner had answered, on
 * the office's print and on the firm's portal.
 *
 * What travels to the firm for a job on the grid is these four values and no
 * more: whether the owner has paid the GC out, the dollars it says it still
 * owes, what became of the 10 %, and the day it was released. Never the note,
 * who took the call, when, or the rest of `fields` (`shapeLienBookForCounsel`
 * cuts each fact to its keys once more before the book is sent).
 *
 * No imports, so the edge function, its shaping kernel and the app's grid read
 * one rule.
 */

export type LienOwnerPaidOut = 'yes' | 'no' | 'unknown'
export type LienOwnerReserved = 'held' | 'released' | 'never' | 'unknown'

export type LienOwnerFacts = {
  /** `yes`: the owner owes the GC nothing more. `no`: it still owes the GC. `unknown`: asked, not answered. */
  paidOut: LienOwnerPaidOut
  /** What the owner says it still owes the GC, when it gave a figure. */
  owesAmount: number | null
  reserved: LienOwnerReserved
  /** 'YYYY-MM-DD', the day the 10 % went to the GC, when it was released and they gave a day. */
  releasedOn: string | null
}

export const LIEN_OWNER_FACT_KEYS = ['paidOut', 'owesAmount', 'reserved', 'releasedOn'] as const

const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** The facts off one stored owner's call; null when there is no call (a call has its `at`). */
export function lienOwnerFactsFromCall(rawCall: unknown): LienOwnerFacts | null {
  if (!isRecord(rawCall) || typeof rawCall.at !== 'string' || !rawCall.at) return null
  const reserved: LienOwnerReserved = rawCall.reserved === 'held' || rawCall.reserved === 'released' || rawCall.reserved === 'never' ? rawCall.reserved : 'unknown'
  return {
    // The call asks *do you still owe the GC anything*: no means paid out.
    paidOut: rawCall.owesGc === 'no' ? 'yes' : rawCall.owesGc === 'yes' ? 'no' : 'unknown',
    owesAmount: rawCall.owesGc === 'yes' && typeof rawCall.owesAmount === 'number' && Number.isFinite(rawCall.owesAmount) ? rawCall.owesAmount : null,
    reserved,
    releasedOn: reserved === 'released' && typeof rawCall.releasedOn === 'string' && YMD.test(rawCall.releasedOn) ? rawCall.releasedOn : null,
  }
}

/** Facts as they arrive in the portal's payload, cut to their keys; null when it is not the shape. */
export function parseLienOwnerFacts(raw: unknown): LienOwnerFacts | null {
  if (!isRecord(raw)) return null
  const paidOut: LienOwnerPaidOut = raw.paidOut === 'yes' || raw.paidOut === 'no' ? raw.paidOut : 'unknown'
  const reserved: LienOwnerReserved = raw.reserved === 'held' || raw.reserved === 'released' || raw.reserved === 'never' ? raw.reserved : 'unknown'
  return {
    paidOut,
    owesAmount: paidOut === 'no' && typeof raw.owesAmount === 'number' && Number.isFinite(raw.owesAmount) ? raw.owesAmount : null,
    reserved,
    releasedOn: reserved === 'released' && typeof raw.releasedOn === 'string' && YMD.test(raw.releasedOn) ? raw.releasedOn : null,
  }
}

/** A map of facts by job id as the payload carries it, each cut to its keys; {} when absent or not the shape. */
export function parseLienOwnerFactsByJob(raw: unknown): Record<string, LienOwnerFacts> {
  if (!isRecord(raw)) return {}
  const out: Record<string, LienOwnerFacts> = {}
  for (const [jobId, v] of Object.entries(raw)) {
    const facts = parseLienOwnerFacts(v)
    if (facts) out[jobId] = facts
  }
  return out
}

type NoticeItemLike = { job_id?: unknown; kind?: unknown; voided_at?: unknown; fields?: unknown }

/**
 * Each job's latest owner's call as facts, from its § 53.056 notice items (the
 * first packet carries the call; a later call overwrites). The same pick as
 * the desk's `ownerCallByJobFrom`, without needing the notice's draft block.
 */
export function lienOwnerFactsByJob(items: ReadonlyArray<NoticeItemLike>): Record<string, LienOwnerFacts> {
  const latest: Record<string, { at: string; facts: LienOwnerFacts }> = {}
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || it.voided_at || typeof it.job_id !== 'string') continue
    const call = isRecord(it.fields) ? it.fields.ownerCall : null
    const facts = lienOwnerFactsFromCall(call)
    if (!facts) continue
    const at = (call as { at: string }).at
    const prev = latest[it.job_id]
    if (!prev || at > prev.at) latest[it.job_id] = { at, facts }
  }
  return Object.fromEntries(Object.entries(latest).map(([jobId, v]) => [jobId, v.facts]))
}

/**
 * The two cells in words, the office's playbook wording: *yes* / *no · $12,000
 * owed*, and *yes · held* / *released Sep 3* / *never*. '' where the owner has
 * not answered, or was never called: the print leaves it blank and the screen
 * draws its `?`.
 */
export function lienOwnerFactsWords(facts: LienOwnerFacts | null | undefined, fmt: { day: (ymd: string) => string; money: (n: number) => string }): { paidOut: string; reserved: string } {
  if (!facts) return { paidOut: '', reserved: '' }
  const paidOut = facts.paidOut === 'yes' ? 'yes' : facts.paidOut === 'no' ? `no${facts.owesAmount != null ? ` · ${fmt.money(facts.owesAmount)} owed` : ''}` : ''
  const reserved = facts.reserved === 'held' ? 'yes · held' : facts.reserved === 'released' ? `released${facts.releasedOn ? ` ${fmt.day(facts.releasedOn)}` : ''}` : facts.reserved === 'never' ? 'never' : ''
  return { paidOut, reserved }
}

/**
 * The sample portal's answer with the grid's facts on its book. The sample tells one story: the owner's call
 * sits on the matter's notice item, and the book's facts are read off that same item here, as the function
 * reads them for a real book, so the two cannot drift. The function's sample branch and the page's own sample
 * both pass through this. A payload with no book, or no matters, comes back as it was.
 */
export function withSampleOwnerFacts<T>(payload: T): T {
  if (!isRecord(payload) || !isRecord(payload.lienBook) || !Array.isArray(payload.matters)) return payload
  const items = (payload.matters as unknown[]).flatMap((m) => (isRecord(m) && Array.isArray(m.lienDeskItems) ? (m.lienDeskItems as NoticeItemLike[]) : []))
  return { ...payload, lienBook: { ...payload.lienBook, ownerFacts: lienOwnerFactsByJob(items) } } as T
}
