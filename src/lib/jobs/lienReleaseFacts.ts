/**
 * What a release of record keeps of its way out the door (punch list #435, piece 5): that it was printed for the
 * notary, the day it was notarized, and the day its stamped copies were sent. All three live in the `fields` the
 * release row already saves (`job_lien_filings`, kind `release_of_record`), beside its link to its affidavit and the
 * county's own instrument number (`lienReleaseOfRecord.ts`). The county's day stays the row's `filed_at`. No migration.
 *
 * It also says which act a release is on (`releaseRunStage`), so `lienPayoff.ts` can read it without a circle.
 *
 * Pure; tested beside it. The writes are `lienReleaseRunIo.ts`, the readers `lienReleaseRun.ts` and `lienPayoff.ts`.
 */
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../../utils/dateUtils'

/** Who pressed, and when. */
export type ReleaseBy = { by: string; name: string; at: string }

export type ReleaseFacts = {
  /** The run printed it for the notary: who and when. Null when it has not. */
  printed: ReleaseBy | null
  /** The day it was signed before a notary, or ''. */
  notarizedYmd: string
  /** The day the stamped copies were sent, with who recorded it. Null when they have not been. */
  copies: (ReleaseBy & { ymd: string }) | null
}

export const RELEASE_FACT_KEYS = { printed: 'printedForNotary', notarized: 'notarizedYmd', copies: 'copiesSent' } as const

const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const asObject = (fields: unknown): Record<string, unknown> => (fields && typeof fields === 'object' && !Array.isArray(fields) ? { ...(fields as Record<string, unknown>) } : {})

function readBy(raw: unknown): ReleaseBy | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const at = text(r.at)
  return at ? { by: text(r.by), name: text(r.name), at } : null
}

/** The three facts off a release row's `fields`. A broken one reads as not there. */
export function releaseFacts(fields: unknown): ReleaseFacts {
  const f = asObject(fields)
  const copiesBy = readBy(f[RELEASE_FACT_KEYS.copies])
  const copiesYmd = (f[RELEASE_FACT_KEYS.copies] as { ymd?: unknown } | null | undefined)?.ymd
  const notarized = f[RELEASE_FACT_KEYS.notarized]
  return {
    printed: readBy(f[RELEASE_FACT_KEYS.printed]),
    notarizedYmd: isYmd(notarized) ? notarized : '',
    copies: copiesBy && isYmd(copiesYmd) ? { ...copiesBy, ymd: copiesYmd } : null,
  }
}

export type ReleaseFactsChange = {
  /** Null takes the print off. Left out, it is left alone. */
  printed?: ReleaseBy | null
  /** '' takes the day off. Left out, it is left alone. */
  notarizedYmd?: string
  /** Null takes the copies off. Left out, they are left alone. */
  copies?: (ReleaseBy & { ymd: string }) | null
}

/** The row's `fields` with the change in it and every other field kept: the paper's own fields are never touched. */
export function releaseFactsPatch(fields: unknown, change: ReleaseFactsChange): Record<string, unknown> {
  const out = asObject(fields)
  if (change.printed !== undefined) {
    if (change.printed) out[RELEASE_FACT_KEYS.printed] = { by: change.printed.by, name: change.printed.name, at: change.printed.at }
    else delete out[RELEASE_FACT_KEYS.printed]
  }
  if (change.notarizedYmd !== undefined) {
    const day = change.notarizedYmd.trim()
    if (isYmd(day)) out[RELEASE_FACT_KEYS.notarized] = day
    else delete out[RELEASE_FACT_KEYS.notarized]
  }
  if (change.copies !== undefined) {
    if (change.copies && isYmd(change.copies.ymd)) out[RELEASE_FACT_KEYS.copies] = { ymd: change.copies.ymd, by: change.copies.by, name: change.copies.name, at: change.copies.at }
    else delete out[RELEASE_FACT_KEYS.copies]
  }
  return out
}

/** The act a saved release is on: printed for the notary, notarized, recorded at the county, copies sent. */
export type ReleaseRunStage = 'print' | 'notary' | 'county' | 'copies'

/** How long after the county's day the copies are still asked for. */
export const RELEASE_COPIES_ASK_DAYS = 30

/**
 * The act a saved release is on, or null when nothing is left to do on it. A release the county recorded more than
 * thirty days ago with no copies on record is left alone: the fact is new, and an older release would otherwise
 * stand open for ever.
 */
export function releaseRunStage(release: { filed_at: string | null; fields: unknown }, todayYmd: string): ReleaseRunStage | null {
  const facts = releaseFacts(release.fields)
  if (release.filed_at) {
    if (facts.copies) return null
    return release.filed_at.slice(0, 10) >= ymdAddDays(todayYmd, -RELEASE_COPIES_ASK_DAYS) ? 'copies' : null
  }
  if (facts.notarizedYmd) return 'county'
  return facts.printed ? 'notary' : 'print'
}

/** A press as the row keeps it: who is signed in, and now. */
export function releaseByNow(who: { id: string; name: string }, atIso: string): ReleaseBy {
  return { by: who.id, name: who.name.trim(), at: atIso }
}

/** The company-calendar day a press was made. */
export function releaseByYmd(by: ReleaseBy): string {
  return calendarYmdInAppTzFromIso(by.at) || by.at.slice(0, 10)
}
