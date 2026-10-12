/**
 * Messages, cut 9 (wave 1, helper 7): Bill day's walk, the superintendent's half. The claims to check on site in walking
 * order, one tap per line that becomes what we see, and the rule that a tap under the claim needs a photo or a note.
 * Lifted from the Messages prototype v1.178 (`claimsToCheck`, `drawClaims`, the checked gate in `gatesFor`) on branch
 * spike/gc-mode, to-dos/gc-mode/messages/prototype.html. Percents and photos only: nothing here names a dollar, because
 * the money is the office's. A check is a row of cut 9's `superintendent_checks`; the newest one on a line is what we see.
 */
import { payApplication, storedOf } from '../building'
import type { Draw, Sow } from '../types'
import { shortDate, weekdayDate } from '../words'

/** The places a walk goes through, in order. A place not on the list comes after them, in the order the lines name it. */
export const WALK_PLACES = ['Site', 'Yard', 'Level 1', 'Level 2', 'Roof'] as const

/** Where a line is when nobody said (`gc_sow_lines.where_on_site` empty). */
export const WALK_PLACE_UNSAID = 'Site'

/** One tap on one draw line, kept with who and when. */
export interface LineCheck {
  drawId: string
  /** The line's kernel id (`sowWithDraws` keys lines by their scope item). */
  sovId: string
  /** The percent we see in place. Null: this check is about stored material only. */
  weSee: number | null
  /** Stored material on site: seen or not. Null: this check is about work in place only. */
  onSite: boolean | null
  photo: boolean
  note: string
  by: string
  at: string
}

/** The newest check on each draw line, keyed `drawId:sovId`. A later `at` wins; on the same `at`, the later row. */
export function newestChecks(checks: LineCheck[]): Map<string, LineCheck> {
  const out = new Map<string, LineCheck>()
  for (const c of checks) {
    const key = checkKey(c.drawId, c.sovId)
    const was = out.get(key)
    if (!was || c.at >= was.at) out.set(key, c)
  }
  return out
}

export function checkKey(drawId: string, sovId: string): string {
  return `${drawId}:${sovId}`
}

/** A draw waiting on us, as the walk reads it. A row of ./trades.ts fits it. */
export interface WalkDraw {
  packageId: string
  company: string
  sow: Sow
  draw: Draw
}

/** One thing to check on site: the work a line claims this period, or the stored material it claims. */
export interface ClaimToCheck {
  packageId: string
  drawId: string
  drawNumber: number
  company: string
  sovId: string
  label: string
  where: string
  kind: 'work' | 'stored'
  /** On work: the percent claimed, and the percent the last draw took it to. Null on stored material. */
  claimed: number | null
  last: number | null
  /** On work: the schedule's percent by bill day. Null: no bar for the line, or stored material. */
  schedule: number | null
  weSee: number | null
  onSite: boolean | null
  photo: boolean
  note: string
  by: string | null
  at: string | null
}

/**
 * The claims to check on the draws waiting on us, in walking order. A line is walked when its work moved this
 * period or it claims stored material. A line that claims what was billed before has nothing to check.
 */
export function claimsToCheck(
  draws: WalkDraw[],
  checks: LineCheck[],
  whereOf: (sovId: string) => string | null,
  scheduleOf: (sovId: string) => number | null = () => null,
): ClaimToCheck[] {
  const newest = newestChecks(checks)
  const items: ClaimToCheck[] = []
  for (const { packageId, company, sow, draw } of draws) {
    const app = payApplication(sow, draw.number, Object.fromEntries(draw.lines.map((l) => [l.sovId, l.toPct])), false, storedOf(draw.lines))
    for (const claim of draw.lines) {
      const line = app.lines.find((l) => l.sovId === claim.sovId)
      if (!line) continue
      const check = newest.get(checkKey(draw.id, claim.sovId))
      const last = line.scheduled === 0 ? 0 : Math.round((line.fromPrevious / line.scheduled) * 100)
      const base = {
        packageId,
        drawId: draw.id,
        drawNumber: draw.number,
        company,
        sovId: claim.sovId,
        label: line.label,
        where: whereOf(claim.sovId)?.trim() || WALK_PLACE_UNSAID,
        photo: check?.photo ?? false,
        note: check?.note.trim() ?? '',
        by: check?.by ?? null,
        at: check?.at ?? null,
      }
      if (line.thisPeriod > 0) {
        items.push({ ...base, kind: 'work', claimed: line.pct, last, schedule: scheduleOf(claim.sovId), weSee: check?.weSee ?? null, onSite: null })
      }
      if ((claim.stored ?? 0) > 0) {
        items.push({ ...base, kind: 'stored', claimed: null, last: null, schedule: null, weSee: null, onSite: check?.onSite ?? null })
      }
    }
  }
  return walkOrder(items)
}

/** The items in walking order: the known places first, then the others as the lines name them. Within a place, as given. */
export function walkOrder<T extends { where: string }>(items: T[]): T[] {
  const others: string[] = []
  for (const i of items) if (!(WALK_PLACES as readonly string[]).includes(i.where) && !others.includes(i.where)) others.push(i.where)
  const order = [...WALK_PLACES, ...others]
  return items
    .map((item, at) => ({ item, at }))
    .sort((a, b) => order.indexOf(a.item.where) - order.indexOf(b.item.where) || a.at - b.at)
    .map((x) => x.item)
}

/** The quick taps for a line: the claim, then 15 and 25 under it, never under what was billed before. */
export function tapChoices(claimed: number, last: number): number[] {
  return [claimed, claimed - 15, claimed - 25].filter((x, i, all) => x >= last && all.indexOf(x) === i)
}

/** Tapped: the percent is in on work, the yes or no on stored material. */
export function tapped(item: ClaimToCheck): boolean {
  return item.kind === 'work' ? item.weSee !== null : item.onSite !== null
}

/** Under the claim: less work than claimed, or the stored material not on site. */
export function underClaim(item: ClaimToCheck): boolean {
  if (item.kind === 'stored') return item.onSite === false
  return item.weSee !== null && item.claimed !== null && item.weSee < item.claimed
}

/** A tap under the claim needs a photo or a note, so the office can say why when it sends the draw back. */
export function needsWhy(item: ClaimToCheck): boolean {
  return underClaim(item) && !item.photo && item.note === ''
}

/** Every claim is tapped, and every one under the claim says why: the office's checked gate clears by itself. */
export function checkedGateClear(items: ClaimToCheck[]): boolean {
  return items.every((i) => tapped(i) && !needsWhy(i))
}

/** How the walk stands: lines, the draws they are on, how many are left to tap, how many need a photo or a note. */
export function walkCounts(items: ClaimToCheck[]): { lines: number; draws: number; left: number; needs: number } {
  return {
    lines: items.length,
    draws: new Set(items.map((i) => i.drawId)).size,
    left: items.filter((i) => !tapped(i)).length,
    needs: items.filter(needsWhy).length,
  }
}

/** "3 to tap, 1 needs a photo or a note", "every line tapped". */
export function walkCountWords(items: ClaimToCheck[]): string {
  const { left, needs } = walkCounts(items)
  const head = left ? `${left} to tap` : 'every line tapped'
  return needs ? `${head}, ${needs} ${needs === 1 ? 'needs' : 'need'} a photo or a note` : head
}

/** The small line under a claim on her phone: the claim, the last draw and the schedule, or the stored question. */
export function claimWords(item: ClaimToCheck, billDay: string): string {
  if (item.kind === 'stored') return 'stored material, on site?'
  const parts = [`claims ${item.claimed}%`, `last draw ${item.last}%`]
  if (item.schedule !== null) parts.push(`schedule ${Math.round(item.schedule)}% by ${shortDate(billDay)}`)
  return parts.join(', ')
}

/** What the phone asks when a tap is under the claim. */
export function underWords(item: ClaimToCheck): string {
  if (item.kind === 'stored') return 'The stored material is not on site. A photo or a note says why.'
  return `${item.weSee}% is under the ${item.claimed}% claimed. A photo or a note says why.`
}

/** The line at the foot of the list. */
export function walkFootWords(items: ClaimToCheck[]): string {
  return checkedGateClear(items)
    ? "Every claim is checked. The office's gate clears by itself."
    : 'Each tap is kept with who and when. The office approves. A tap never does.'
}

/** The checking days: from the cut-off through two days before bill day. */
export function inCheckWindow(dates: { checkFrom: string; checkBy: string }, today: string): boolean {
  return today >= dates.checkFrom && today <= dates.checkBy
}

/** The daily log's heading line on a checking day, or the line that says when the list comes. */
export function checkWindowWords(dates: { checkFrom: string; checkBy: string }, today: string): string {
  return inCheckWindow(dates, today)
    ? `Walk them by ${weekdayDate(dates.checkBy)}.`
    : `The list comes on the checking days, ${weekdayDate(dates.checkFrom)} to ${weekdayDate(dates.checkBy)}, with a text on the first.`
}
