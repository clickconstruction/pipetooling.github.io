/**
 * Site accounts (v2.8657): a person's seat on the sister sites, read beside their row on People → Users.
 *
 * PipeTooling is the record of people. CountTooling and TakeoffTooling each keep their own accounts, and each
 * hands its list over a dev-only bridge (`ct-bridge` and `tt-bridge`, verb `roster`). This kernel turns the two
 * lists into one shape, finds the account that belongs to a person, and counts the accounts that belong to
 * nobody here. It reads only: nothing in it makes, retires or changes an account.
 *
 * A person is matched by the id their `users` row holds for the site when it holds one (CountTooling's
 * `counttooling_user_id`), and by address otherwise. A robot's seat lives at another fleet domain on each site,
 * so the fleet domains are folded into one before two addresses are compared, as the Monday audit does
 * (`supabase/functions/_shared/ctRosterDiff.ts`).
 */

import { val } from '../valuesInPlace'

export type SiteKey = 'count' | 'takeoff'

export const SITES: ReadonlyArray<{ key: SiteKey; name: string; bridge: 'ct-bridge' | 'tt-bridge' }> = [
  { key: 'count', name: 'CountTooling', bridge: 'ct-bridge' },
  { key: 'takeoff', name: 'TakeoffTooling', bridge: 'tt-bridge' },
]

/** One account on a site, in the one shape both rosters are read into. */
export type SiteAccount = {
  id: string
  email: string | null
  /** False when the site has retired the seat (its auth ban). */
  active: boolean
  isTwin: boolean
  /** A role worth saying: CountTooling's admin flag, TakeoffTooling's `admin` or `dev`. Null for a plain user. */
  role: string | null
  /** Null when the site's roster does not carry it (CountTooling's does not). */
  lastSignInAt: string | null
}

/** Where the read of one site stands. A site that cannot be read never blanks the other. */
export type SiteRead = { state: 'loading' } | { state: 'ready'; accounts: SiteAccount[] } | { state: 'failed'; reason: string }

/** The person as the lens knows them: their roster address, and the id their row holds for the site. */
export type SitePerson = { email: string | null; linkedId?: string | null }

export type SiteSeat =
  | { kind: 'none'; linkGone: boolean }
  | { kind: 'seat'; account: SiteAccount; matchedBy: 'link' | 'email'; addressDiffers: boolean }

const FLEET_DOMAIN_RE = /@twins\.(pipetooling|counttooling|takeofftooling)\.local$/

/** An address as two sites would compare it: trimmed, lower case, the robots' fleet domains folded into one. */
export function normalizeSiteEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase().replace(FLEET_DOMAIN_RE, '@twins.<fleet>.local')
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/**
 * A bridge's `roster` answer as accounts. Throws with a plain reason when the answer carries no list, so the
 * lens can say the site was not read and never draw an empty site as "nobody has a seat".
 */
export function parseSiteRoster(site: SiteKey, json: unknown): SiteAccount[] {
  const body = asRecord(json)
  const rows = body && Array.isArray(body.roster) ? (body.roster as unknown[]) : null
  if (!rows) {
    const said = body ? asText(body.error) : null
    throw new Error(said ?? 'The site sent no list of accounts back.')
  }
  const idKey = site === 'count' ? 'ct_user_id' : 'tt_user_id'
  const out: SiteAccount[] = []
  for (const raw of rows) {
    const r = asRecord(raw)
    const id = r ? asText(r[idKey]) : null
    if (!r || !id) continue
    const ttRole = asText(r.role)
    out.push({
      id,
      email: asText(r.email),
      active: r.active !== false,
      isTwin: r.is_digital_twin === true,
      role: site === 'count' ? (r.is_admin === true ? 'admin' : null) : ttRole && ttRole !== 'user' ? ttRole : null,
      lastSignInAt: asText(r.last_sign_in_at),
    })
  }
  return out
}

/** The person's seat on one site: by the id their row holds, else by address. */
export function siteSeatFor(person: SitePerson, accounts: readonly SiteAccount[]): SiteSeat {
  const linkedId = person.linkedId ?? null
  const mine = normalizeSiteEmail(person.email)
  if (linkedId) {
    const byLink = accounts.find((a) => a.id === linkedId)
    if (byLink) return { kind: 'seat', account: byLink, matchedBy: 'link', addressDiffers: mine !== '' && normalizeSiteEmail(byLink.email) !== mine }
  }
  const byEmail = mine ? accounts.find((a) => normalizeSiteEmail(a.email) === mine) : undefined
  if (byEmail) return { kind: 'seat', account: byEmail, matchedBy: 'email', addressDiffers: false }
  return { kind: 'none', linkGone: Boolean(linkedId) }
}

/** How many of a site's accounts belong to nobody here, by link or by address. */
export function countUnmatchedSiteAccounts(people: readonly SitePerson[], accounts: readonly SiteAccount[]): number {
  const linked = new Set<string>()
  const addresses = new Set<string>()
  for (const p of people) {
    if (p.linkedId) linked.add(p.linkedId)
    const e = normalizeSiteEmail(p.email)
    if (e) addresses.add(e)
  }
  return accounts.filter((a) => !linked.has(a.id) && !addresses.has(normalizeSiteEmail(a.email))).length
}

export type SiteSeatWords = { status: 'no seat' | 'active' | 'retired'; flags: string[] }

/** The words of one cell: the seat's standing, then what is worth saying about it. */
export function siteSeatWords(seat: SiteSeat): SiteSeatWords {
  if (seat.kind === 'none') return { status: 'no seat', flags: seat.linkGone ? ['link gone'] : [] }
  const flags: string[] = []
  if (seat.account.role) flags.push(seat.account.role)
  if (seat.account.isTwin) flags.push('twin')
  if (seat.matchedBy === 'email') flags.push('by address')
  if (seat.addressDiffers) flags.push('address differs')
  return { status: seat.account.active ? 'active' : 'retired', flags }
}

/** What each flag means, for the cell's hover. */
export function siteFlagTitle(flag: string, siteName: string, seat: SiteSeat): string {
  if (flag === 'link gone') return `Their row holds a ${siteName} id that no account there has.`
  if (flag === 'by address') return `Matched by address. Their row holds no ${siteName} id yet.`
  if (flag === 'address differs') return seat.kind === 'seat' && seat.account.email ? `${siteName} has them as ${seat.account.email}.` : `${siteName} has them under another address.`
  if (flag === 'twin') return `A robot's seat on ${siteName}.`
  return `Their role on ${siteName}.`
}

/** The line under the lens for one site that was read, its count marked as a value. */
export function unmatchedSiteWords(siteName: string, unmatched: number): string {
  if (unmatched === 0) return `Every ${siteName} account matches a person here.`
  return unmatched === 1 ? `${val('count', '1')} ${siteName} account matches nobody here.` : `${val('count', String(unmatched))} ${siteName} accounts match nobody here.`
}

/** The line for a site that was not read. */
export function unreadSiteWords(siteName: string, reason: string): string {
  return `${siteName} could not be read. ${reason}`
}
