import { demandDate } from '../jobsDocuments/demandLetter'

/**
 * What the short lien affidavit says about the notices (punch list #305). Pure.
 *
 * Tex. Prop. Code § 53.054(a), as the app reads it, asks a claimant other than an original contractor for two
 * things the earlier paper did not carry: each month for which payment is requested (a)(3), and the date each
 * notice of the claim was sent to the owner with the method of sending (a)(8). Both are already on the job: every
 * § 53.056 notice the office records is a `job_lien_filings` row with the months it named (`months_covered`) and
 * what went to whom (`sends`). This reads them, so the affidavit swears what the record holds and nothing typed
 * a second time. A notice with no send to the owner on record adds its months and no day: the paragraph cannot
 * state a day nobody wrote down, and the paper prints a blank for the office to see.
 */

/** A recorded filing, as much of it as this reads. */
export type LienAffidavitNoticeRow = {
  kind: string
  months_covered?: ReadonlyArray<string> | null
  /** `[{ recipient, method, tracking, sent_on }]` as the record steps write it. */
  sends?: unknown
  voided_at?: string | null
}

/** One notice sent to the owner: the day it went and how. */
export type LienAffidavitOwnerSend = { method: string; sentOn: string }

const liveNotices = (filings: ReadonlyArray<LienAffidavitNoticeRow> | null | undefined) => (filings ?? []).filter((f) => f.kind === 'notice_53_056' && !f.voided_at)

/** The months the recorded § 53.056 notices name: each once, oldest first. */
export function lienAffidavitNoticeMonths(filings: ReadonlyArray<LienAffidavitNoticeRow> | null | undefined): string[] {
  const months = new Set<string>()
  for (const f of liveNotices(filings)) for (const m of f.months_covered ?? []) if (/^\d{4}-\d{2}$/.test(m)) months.add(m)
  return [...months].sort()
}

/** Each notice's send to the owner, oldest first; the same day by the same method counts once (one envelope can carry several jobs). */
export function lienAffidavitOwnerSends(filings: ReadonlyArray<LienAffidavitNoticeRow> | null | undefined): LienAffidavitOwnerSend[] {
  const seen = new Set<string>()
  const out: LienAffidavitOwnerSend[] = []
  for (const f of liveNotices(filings)) {
    for (const raw of Array.isArray(f.sends) ? f.sends : []) {
      if (!raw || typeof raw !== 'object') continue
      const s = raw as { recipient?: unknown; method?: unknown; sent_on?: unknown }
      if (s.recipient !== 'owner' || typeof s.sent_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.sent_on)) continue
      const method = typeof s.method === 'string' ? s.method : ''
      const key = `${method}|${s.sent_on}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ method, sentOn: s.sent_on })
    }
  }
  return out.sort((a, b) => (a.sentOn !== b.sentOn ? (a.sentOn < b.sentOn ? -1 : 1) : a.method.localeCompare(b.method)))
}

/** The method as the sworn sentence says it. An unknown one prints as recorded, so nothing is guessed. */
const METHOD_WORDS: Record<string, string> = {
  certified_mail: 'certified mail',
  traceable_courier: 'a delivery service that confirms receipt',
  hand: 'hand delivery',
  email: 'email',
}

export function lienAffidavitMethodWords(method: string): string {
  return METHOD_WORDS[method] ?? (method.replace(/_/g, ' ').trim() || 'a method not recorded')
}

const andList = (xs: ReadonlyArray<string>) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/**
 * "certified mail on September 22, 2026 and October 14, 2026": what follows *sent to the owner by*. Days that went
 * the same way share the method; a second method starts its own run (", and by hand delivery on …"). '' when no
 * send to the owner is on record.
 */
export function lienAffidavitNoticesWords(sends: ReadonlyArray<LienAffidavitOwnerSend>): string {
  const runs: Array<{ method: string; days: string[] }> = []
  for (const s of sends) {
    const run = runs.find((r) => r.method === s.method)
    if (run) run.days.push(s.sentOn)
    else runs.push({ method: s.method, days: [s.sentOn] })
  }
  return runs.map((r) => `${lienAffidavitMethodWords(r.method)} on ${andList(r.days.map(demandDate))}`).join(', and by ')
}
