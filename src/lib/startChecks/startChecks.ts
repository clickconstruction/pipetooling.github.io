/**
 * Before we start (punch list #382, design spike): what has to be true before a stage begins, who said so, and who
 * decided to go. A stage carries a short list of bullets. A bullet waits on them (the GC, the customer) or on us.
 * A bullet on them is open or a yes, and a yes says how we know: their word, their photo, or we saw it. A bullet
 * that asks for a photo is not a yes on their word alone. A bullet on us is read from the app (the order log, the
 * trip, the permit) and nobody ticks it. The go or no-go day is our first day less the notice we need. Go and Hold
 * are decisions with a name on them. Nothing here blocks anything: the rules only say where a stage stands and
 * what the next press is.
 *
 * Pure. Days are 'YYYY-MM-DD'. The spike's screens and its sample store read only this file for their rules.
 */

export type Know = 'word' | 'photo' | 'saw'

export type Yes = { know: Know; who: string; how: string; day: string }
export type Ask = { day: string; how: string }

export type ThemBullet = {
  id: string
  on: 'them'
  words: string
  /** Their word alone leaves it open: it needs their photo, or one of ours on site. */
  wantsPhoto: boolean
  /** Shown on the GC's page. */
  eye: boolean
  yes: Yes | null
  asks: Ask[]
  /** The day they say it will be true, when they gave one. */
  byDay: string | null
}

export type UsBullet = {
  id: string
  on: 'us'
  words: string
  eye: boolean
  /** Where the app reads it from. 'hand' is ticked by a person. */
  reads: 'order_log' | 'trip' | 'permit' | 'hand'
  ok: boolean
  fact: string
  door: string
}

export type Bullet = ThemBullet | UsBullet

export type TheirDay = { day: string; said: string; who: string; how: string }

export type Decision = { kind: 'go' | 'hold'; by: string; day: string; openThen: string[] }

/** What the crew found on arrival: the bullets that were not as told. */
export type Arrival = { day: string; by: string; notAsTold: string[] }

export type Stage = {
  id: string
  part: string
  job: string
  name: string
  window: [string, string]
  trip: [string, string] | null
  finished: boolean
  theirDays: TheirDay[]
  bullets: Bullet[]
  decision: Decision | null
  arrival: Arrival | null
}

export type Site = { name: string; customer: string; where: string; noticeDays: number; contact: string; contactRole: string }

// ---------- Days ----------

const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`)
export const addDays = (ymd: string, n: number): string => {
  const d = at(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string): number => Math.round((at(b).getTime() - at(a).getTime()) / 864e5)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const monthDay = (ymd: string): string => `${MONTHS[at(ymd).getUTCMonth()]} ${at(ymd).getUTCDate()}`
export const weekDay = (ymd: string): string => `${DAYS[at(ymd).getUTCDay()]} ${monthDay(ymd)}`
export const daySpan = (a: string, b: string): string => (at(a).getUTCMonth() === at(b).getUTCMonth() ? `${monthDay(a)} to ${at(b).getUTCDate()}` : `${monthDay(a)} to ${monthDay(b)}`)
export const countWords = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
/** "today", "in 4 days", "3 days ago". */
export function inDaysWords(today: string, ymd: string): string {
  const n = daysBetween(today, ymd)
  if (n === 0) return 'today'
  return n > 0 ? `in ${countWords(n, 'day', 'days')}` : `${countWords(-n, 'day', 'days')} ago`
}

// ---------- A bullet ----------

/** A yes that stands: a bullet that asks for a photo needs more than their word. */
export function bulletIsYes(b: Bullet): boolean {
  if (b.on === 'us') return b.ok
  if (!b.yes) return false
  return !(b.wantsPhoto && b.yes.know === 'word')
}

/** Their word is in, and the bullet still waits on a photo. */
export const waitsOnPhoto = (b: Bullet): boolean => b.on === 'them' && !!b.yes && b.wantsPhoto && b.yes.know === 'word'

export const KNOW_WORDS: Record<Know, string> = { word: 'their word', photo: 'their photo', saw: 'we saw it' }

export const lastAsk = (b: Bullet): Ask | null => (b.on === 'them' && b.asks.length ? b.asks[b.asks.length - 1] : null)

/** The line under a bullet: how we know, or when we asked. */
export function bulletLine(b: Bullet): string {
  if (b.on === 'us') return b.fact
  if (b.yes) {
    const base = `${b.yes.who}, ${b.yes.how}, ${monthDay(b.yes.day)}`
    return waitsOnPhoto(b) ? `${base}. Still needs a photo` : base
  }
  const a = lastAsk(b)
  const parts = [a ? `Asked ${monthDay(a.day)} by ${a.how}, no answer yet` : 'Not asked yet']
  if (b.byDay) parts.push(`they say by ${monthDay(b.byDay)}`)
  return parts.join(' · ')
}

// ---------- A stage ----------

/**
 * How ready a list is, as a share of its bullets: 4 of 5 is 80%. Every bullet counts the same. It reads 100% only
 * when every bullet has a yes that stands, so 199 of 200 is 99%, never rounded up to ready.
 */
export function readiness(bullets: readonly Bullet[]): { yes: number; total: number; pct: number } {
  const total = bullets.length
  const yes = bullets.filter(bulletIsYes).length
  return { yes, total, pct: total ? (yes === total ? 100 : Math.floor((yes / total) * 100)) : 0 }
}

export const openBullets = (s: Stage): Bullet[] => s.bullets.filter((b) => !bulletIsYes(b))
export const openOnThem = (s: Stage): ThemBullet[] => openBullets(s).filter((b): b is ThemBullet => b.on === 'them')
export const openOnUs = (s: Stage): UsBullet[] => openBullets(s).filter((b): b is UsBullet => b.on === 'us')
export const goNoGoDay = (s: Stage, site: Site): string => addDays(s.window[0], -site.noticeDays)
/** The day before the crew leaves: the last look at a go made on a promise. */
export const lastCheckDay = (s: Stage): string => addDays((s.trip ?? s.window)[0], -1)
export const theirDay = (s: Stage): TheirDay | null => (s.theirDays.length ? s.theirDays[s.theirDays.length - 1] : null)
/** How far they have moved the day they said it would be ready, first day to newest. Never below zero. */
export const movedDays = (s: Stage): number => (s.theirDays.length > 1 ? Math.max(0, daysBetween(s.theirDays[0].day, s.theirDays[s.theirDays.length - 1].day)) : 0)
/** They say ready after our first day. */
export function startClash(s: Stage): boolean {
  const t = theirDay(s)
  return !!t && t.day > s.window[0]
}

// ---------- Values inside a sentence ----------

/**
 * A sentence here is words around values: a day, a count, a name. A value is written ⟦kind|text⟧ so a screen can
 * draw it apart from the words and a reader can scan the values alone. Some kinds can be changed where they stand
 * (our first day, the day they gave, the notice we need, who we ask). The rest are worked out and only read.
 */
export type ValueKind = 'start' | 'their' | 'notice' | 'contact' | 'decide' | 'count' | 'check' | 'who' | 'day'
export const CHANGEABLE_VALUES: ReadonlySet<ValueKind> = new Set<ValueKind>(['start', 'their', 'notice', 'contact'])
export const val = (kind: ValueKind, text: string): string => `⟦${kind}|${text}⟧`
export type SentencePart = string | { kind: ValueKind; text: string }
export function sentenceParts(sentence: string): SentencePart[] {
  const out: SentencePart[] = []
  const re = /⟦([a-z]+)\|([^⟧]*)⟧/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(sentence))) {
    if (m.index > last) out.push(sentence.slice(last, m.index))
    out.push({ kind: m[1] as ValueKind, text: m[2] })
    last = m.index + m[0].length
  }
  if (last < sentence.length) out.push(sentence.slice(last))
  return out
}
/** The sentence as plain words, for a place that cannot draw a value apart. */
export const plainSentence = (sentence: string): string => sentenceParts(sentence).map((p) => (typeof p === 'string' ? p : p.text)).join('')

export type Light = 'green' | 'amber' | 'red' | 'grey'
export type NextPress = 'ask' | 'decide' | 'go' | 'move' | 'ours' | 'write' | 'look' | 'none'
export type Standing = { light: Light; headline: string; sentence: string; next: NextPress; nextLabel: string | null }

/**
 * Where a stage stands, as one sentence and one press. The order of the questions is the order a person would ask
 * them: is it decided, did it go wrong on arrival, do their day and ours disagree, what is still open, and how
 * close is the day we must decide. Every value in the sentence is marked (see `val`).
 */
export function stageStanding(s: Stage, site: Site, today: string): Standing {
  if (s.finished) return { light: 'grey', headline: 'Done', sentence: 'This stage is finished.', next: 'none', nextLabel: null }
  if (!s.bullets.length) return { light: 'grey', headline: 'No list yet', sentence: 'Nobody has written what must be true before this stage.', next: 'write', nextLabel: 'Write the list' }
  if (s.arrival && s.arrival.notAsTold.length) {
    const first = s.bullets.find((b) => b.id === s.arrival?.notAsTold[0])
    return { light: 'red', headline: 'Not as told', sentence: `${val('who', s.arrival.by)} got there ${val('day', monthDay(s.arrival.day))} and it was not as told: ${first ? first.words : 'a bullet'}`, next: 'look', nextLabel: 'Open the stage' }
  }
  const them = openOnThem(s)
  const us = openOnUs(s)
  const decideBy = goNoGoDay(s, site)
  const daysLeft = daysBetween(today, decideBy)
  const start = val('start', weekDay(s.window[0]))
  const contact = val('contact', site.contact)
  if (s.decision?.kind === 'go') {
    const still = openBullets(s).length
    const pressed = `${val('who', s.decision.by)} pressed Go ${val('day', monthDay(s.decision.day))}`
    if (!still) return { light: 'green', headline: 'Go', sentence: `Crew confirmed for ${start}. ${pressed}.`, next: 'none', nextLabel: null }
    return { light: 'amber', headline: 'Go, on a promise', sentence: `${pressed} with ${val('count', countWords(still, 'thing', 'things'))} open. Last check ${val('check', weekDay(lastCheckDay(s)))}.`, next: them.length ? 'ask' : 'ours', nextLabel: them.length ? `Ask ${site.contact}` : (us[0]?.door ?? null) }
  }
  if (startClash(s)) {
    const t = theirDay(s) as TheirDay
    return { light: 'red', headline: 'Their day is after ours', sentence: `${val('who', t.who)} says ready ${val('their', monthDay(t.day))}. We planned to start ${start}.`, next: 'move', nextLabel: 'Move our start' }
  }
  const held = s.decision?.kind === 'hold' ? `On hold since ${val('day', monthDay(s.decision.day))}. ` : ''
  if (!them.length && !us.length) return { light: 'green', headline: 'Everything has a yes', sentence: `${held}Nothing is open. Press Go to confirm the crew for ${start}.`, next: 'go', nextLabel: 'Go' }
  const decide = val('decide', weekDay(decideBy))
  const when = daysLeft < 0 ? `We should have decided ${decide}.` : daysLeft === 0 ? `We decide ${val('decide', 'today')}.` : `We decide by ${decide}, ${inDaysWords(today, decideBy)}.`
  if (!them.length) {
    return { light: daysLeft <= 0 ? 'red' : 'amber', headline: 'Ours to do', sentence: `${held}${contact} is done. ${val('count', countWords(us.length, 'thing of ours', 'things of ours'))} ${us.length === 1 ? 'is' : 'are'} not ready. ${when}`, next: daysLeft <= 0 ? 'decide' : 'ours', nextLabel: daysLeft <= 0 ? 'Go or hold' : us[0].door }
  }
  const waiting = `${held}Waiting on ${contact} for ${val('count', countWords(them.length, 'thing', 'things'))}${us.length ? `, and ${val('count', String(us.length))} of ours` : ''}. ${when}`
  if (daysLeft <= 0) return { light: 'red', headline: 'Decide now', sentence: waiting, next: 'decide', nextLabel: 'Go or hold' }
  if (daysLeft <= 14) {
    const askedAll = them.every((b) => lastAsk(b) && daysBetween((lastAsk(b) as Ask).day, today) <= 2)
    return { light: 'amber', headline: 'Waiting on them', sentence: waiting, next: askedAll ? 'decide' : 'ask', nextLabel: askedAll ? 'Go or hold' : `Ask ${site.contact}` }
  }
  return { light: 'grey', headline: 'Later', sentence: `${held}${val('count', countWords(them.length + us.length, 'thing', 'things'))} open. Nothing to do until ${val('check', monthDay(addDays(decideBy, -14)))}.`, next: 'none', nextLabel: null }
}

// ---------- The site ----------

export const stagesAhead = (stages: readonly Stage[]): Stage[] => stages.filter((s) => !s.finished)

/** The stages whose open bullets on them are worth one ask now: not decided Go with nothing open, and due inside 14 days. */
export function stagesToAsk(stages: readonly Stage[], site: Site, today: string): Stage[] {
  return stagesAhead(stages).filter((s) => openOnThem(s).length > 0 && daysBetween(today, goNoGoDay(s, site)) <= 14)
}

export const siteMovedDays = (stages: readonly Stage[]): number => stagesAhead(stages).reduce((n, s) => n + movedDays(s), 0)

/** The ask, written for the office: one message to one person, across every stage it covers. */
export function askText(site: Site, stages: readonly Stage[]): string {
  const lines: string[] = [`${site.contact}, a few things before we lock in our crew.`]
  for (const s of stages) {
    const open = openOnThem(s)
    if (!open.length) continue
    lines.push('')
    lines.push(`${s.part} ${s.name.toLowerCase()}, we plan ${weekDay(s.window[0])} and decide by ${weekDay(goNoGoDay(s, site))}:`)
    open.forEach((b, i) => lines.push(`${i + 1}. ${b.words}${b.wantsPhoto ? ' A photo would settle it.' : ''}`))
  }
  lines.push('')
  lines.push('A yes or a not yet on each is all we need. Or tap to answer on your page.')
  return lines.join('\n')
}

/** The hold notice, written for the office to send. */
export function holdText(site: Site, s: Stage, newStart: string): string {
  const open = openOnThem(s)
  const why = open.length ? open.map((b) => b.words.replace(/\.$/, '').toLowerCase()).join('; ') : 'everything on our list has a yes'
  return `${site.contact}, we are holding our start on the ${s.part.toLowerCase()} ${s.name.toLowerCase()}. We planned ${weekDay(s.window[0])}. We cannot send a crew until: ${why}. Our next opening is ${weekDay(newStart)}. Tell us the day it is ready and we will lock it in.`
}

/** What the GC's page may show of a stage: only bullets with the eye on. Never ours unless turned on, never a note. */
export const sharedBullets = (s: Stage): Bullet[] => s.bullets.filter((b) => b.eye)
