/**
 * Vehicle check-ins: whom we already asked, read from the thread (punch list #180, PR 4). The
 * station already reads the thing itself, each truck's last reading against its cadence with the
 * days since, and its count sat at the size of the fleet for eight weeks because readings do not
 * land. What the person held in their head was the office's own side: which drivers were asked,
 * when, and who answered. That is on the holder's Messages thread: an outbound line since the last
 * reading is an ask, an inbound line after it is the answer. This kernel sorts the due rows into
 * **not asked**, **asked, waiting on the driver**, **answered, miles not typed yet** and, for the
 * motor pool, **walk out**, writes the standard ask, the count (the trucks the office still has to
 * ask or walk to), the Next line, the since-last-look line and the Mark's note. Pure.
 */

export type AskVehicle = { id: string; year: number | string | null; make: string | null; model: string | null }
export type AskDueRow = {
  vehicle: AskVehicle
  holderUserId: string | null
  holderName: string | null
  motorPool: boolean
  /** Days since the last reading; null when never read. */
  daysStale: number | null
  /** ISO of the last reading's day, or null. */
  lastReadIso: string | null
  dueDays: number
}
/** A line on the holder's thread: `out` is the office writing, `in` the driver. */
export type AskLine = { contactId: string; at: string; direction: 'in' | 'out' | string }

export type AskState = 'notAsked' | 'asked' | 'answered' | 'walk'

export type AskRow = {
  row: AskDueRow
  state: AskState
  truck: string
  /** The holder's Messages contact, when the app knows it. */
  contactId: string | null
  /** The newest outbound line since the last reading. */
  askedAt: string | null
  askedDays: number | null
  /** The newest inbound line after the ask. */
  answeredAt: string | null
  answeredDays: number | null
  words: string
}

export type AskInput = {
  rows: ReadonlyArray<AskDueRow>
  /** Holder user id → Messages contact id. */
  contactByUser: ReadonlyMap<string, string>
  lines: ReadonlyArray<AskLine>
  nowIso: string
  /** An ask older than this many days is stale and the truck is asked again. */
  askStaleDays?: number
}

export const ASK_STALE_DAYS_DEFAULT = 5
/** How far back the thread is read for asks: a reading older than this reads as never asked. */
export const ASK_LOOKBACK_DAYS = 60

const DAY_MS = 86_400_000

function daysBetween(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, Math.floor((b - a) / DAY_MS))
}

export function truckName(v: AskVehicle): string {
  return [v.year, v.make, v.model].filter((x) => x != null && String(x).trim() !== '').join(' ') || 'the truck'
}

function firstName(name: string | null): string {
  const n = (name ?? '').trim()
  return n ? n.split(/\s+/)[0]! : 'there'
}

/** The standard ask, one text: the truck, the days, what to send back. */
export function askWords(row: AskDueRow): string {
  const t = truckName(row.vehicle)
  const since = row.daysStale == null ? 'we have no reading on file' : `the last reading was ${row.daysStale} days ago`
  return `Hi ${firstName(row.holderName)}, quick check-in on the ${t}: ${since}. Text back the miles on the dash and anything the truck needs. Thanks!`
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** The rows: not asked first (most stale first), then answered, then asked, then the motor pool. */
export function askRows(input: AskInput): AskRow[] {
  const stale = input.askStaleDays ?? ASK_STALE_DAYS_DEFAULT
  const byContact = new Map<string, AskLine[]>()
  for (const l of input.lines) {
    const arr = byContact.get(l.contactId) ?? []
    arr.push(l)
    byContact.set(l.contactId, arr)
  }
  const out = input.rows.map((row): AskRow => {
    const truck = truckName(row.vehicle)
    const contactId = row.holderUserId ? input.contactByUser.get(row.holderUserId) ?? null : null
    const base = { row, truck, contactId, askedAt: null, askedDays: null, answeredAt: null, answeredDays: null }
    if (row.motorPool) return { ...base, state: 'walk', words: 'nobody holds it · walk out and read it' }
    const lines = contactId ? byContact.get(contactId) ?? [] : []
    const floor = row.lastReadIso ?? new Date(Date.parse(input.nowIso) - ASK_LOOKBACK_DAYS * DAY_MS).toISOString()
    let askedAt: string | null = null
    for (const l of lines) if (l.direction === 'out' && l.at > floor && (!askedAt || l.at > askedAt)) askedAt = l.at
    let answeredAt: string | null = null
    if (askedAt) for (const l of lines) if (l.direction === 'in' && l.at > askedAt && (!answeredAt || l.at > answeredAt)) answeredAt = l.at
    const askedDays = daysBetween(askedAt, input.nowIso)
    const answeredDays = daysBetween(answeredAt, input.nowIso)
    const who = (row.holderName ?? '').trim() || 'the holder'
    if (!askedAt || (askedDays != null && askedDays >= stale && !answeredAt)) {
      const why = !askedAt ? (contactId ? 'never asked' : 'never asked · no thread with the holder yet') : `asked ${askedDays}d ago, no answer · ask again`
      return { ...base, state: 'notAsked', askedAt, askedDays, words: `${who} · ${why}` }
    }
    if (answeredAt) return { ...base, state: 'answered', askedAt, askedDays, answeredAt, answeredDays, words: `${who} answered ${answeredDays === 0 ? 'today' : `${answeredDays}d ago`} · type the miles from the thread` }
    return { ...base, state: 'asked', askedAt, askedDays, words: `asked ${who} ${askedDays === 0 ? 'today' : `${askedDays}d ago`} · waiting on the driver` }
  })
  const order: Record<AskState, number> = { notAsked: 0, answered: 1, asked: 2, walk: 3 }
  return out.sort((a, b) => order[a.state] - order[b.state] || (b.row.daysStale ?? 9999) - (a.row.daysStale ?? 9999))
}

export type AskCounts = { notAsked: number; asked: number; answered: number; walk: number; late: number; /** What the office still has to do: ask, type an answer, or walk out. */ todo: number }

export function askCounts(rows: ReadonlyArray<AskRow>): AskCounts {
  const c = { notAsked: 0, asked: 0, answered: 0, walk: 0 }
  for (const r of rows) c[r.state]++
  return { ...c, late: rows.length, todo: c.notAsked + c.answered + c.walk }
}

/** The first thing to do, under the station's question. Null when every late truck is asked and waiting. */
export function asksNextLine(rows: ReadonlyArray<AskRow>): string | null {
  const r = rows.find((x) => x.state !== 'asked')
  if (!r) return null
  const stale = r.row.daysStale == null ? 'never read' : `${r.row.daysStale} ${plural(r.row.daysStale, 'day', 'days')} since the last reading`
  if (r.state === 'walk') return `Read the ${r.truck}'s miles · ${stale}`
  if (r.state === 'answered') return `Type the ${r.truck}'s miles from ${(r.row.holderName ?? 'the holder').trim()}'s answer · ${stale}`
  return `Ask ${(r.row.holderName ?? 'the holder').trim()} for the ${r.truck}'s miles by text · ${stale}`
}

export type AsksSince = { newLate: number; askedSince: number; answeredSince: number; words: string }

export function asksSince(rows: ReadonlyArray<AskRow>, sinceIso: string | null, nowIso: string, whenWords: (iso: string) => string): AsksSince | null {
  if (!sinceIso) return null
  const daysSince = daysBetween(sinceIso, nowIso) ?? 0
  let newLate = 0
  let askedSince = 0
  let answeredSince = 0
  for (const r of rows) {
    if (r.row.daysStale != null && r.row.daysStale - daysSince < r.row.dueDays) newLate++
    if (r.askedAt && r.askedAt > sinceIso) askedSince++
    if (r.answeredAt && r.answeredAt > sinceIso) answeredSince++
  }
  return { newLate, askedSince, answeredSince, words: `Since the last look, ${whenWords(sinceIso)}` }
}

/** What the Mark saves when nobody typed. Null with no late trucks. */
export function asksMarkNote(rows: ReadonlyArray<AskRow>, since: AsksSince | null): string | null {
  if (rows.length === 0) return null
  const c = askCounts(rows)
  const parts = [`${c.late} late`, `${c.notAsked} not asked`, `${c.asked} asked and waiting`, `${c.answered} answered, miles to type`]
  if (c.walk > 0) parts.push(`${c.walk} motor pool to walk`)
  const first = rows.find((r) => r.state === 'notAsked')
  if (first) parts.push(`oldest not asked ${first.row.daysStale == null ? 'never read' : `${first.row.daysStale}d`} (${first.truck}${first.row.holderName ? `, ${first.row.holderName.trim()}` : ''})`)
  if (since) parts.push(`+${since.newLate} new late, ${since.askedSince} asked, ${since.answeredSince} answered since the last look`)
  return parts.join(' · ')
}
