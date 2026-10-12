/**
 * Messages, cut 9 (wave 1, helper 7): a draw's lines on Bill day, for the money team. What each line claims, what we
 * see, what the schedule says, and this draw's money at what we see, less the statement of work's retainage, with any
 * change order held out until it is signed. Lifted from the Messages prototype v1.178 (`linesHtml`'s money) on branch
 * spike/gc-mode, to-dos/gc-mode/messages/prototype.html. The money is main's: `drawApprovedLess` approves at what we
 * see, the way the Draws window does, so the two never disagree.
 */
import { drawApprovedLess, payApplication, storedOf, tradeChangesFor, type TradeChange } from '../building'
import type { Draw, GcProject, Sow, TradePackage } from '../types'
import { weekdayDate } from '../words'
import { checkKey, newestChecks, type LineCheck } from './walk'

export interface DrawLineAtWeSee {
  sovId: string
  /** The line's number on the statement of work, from 1. */
  item: number
  label: string
  /** What the line is worth. */
  value: number
  /** The percent the last draw took it to, the percent claimed, and the percent we see. Null: not walked yet. */
  last: number
  claimed: number
  weSee: number | null
  /** The schedule's percent by bill day. Null: no bar for the line. */
  schedule: number | null
  /** Stored material claimed on the line, in dollars, and whether the walk saw it. */
  stored: number
  onSite: boolean | null
  /** We see less work in place than they claim. */
  doubt: boolean
  /** This draw's money on the line at what we see, before retainage: the work this period and the change in stored. */
  thisDraw: number
  /** The same at what they claim. */
  asClaimed: number
  photo: boolean
  note: string
}

/** A change order of theirs not yet signed both ways: none of it is billed until it is. */
export interface HeldOutChange {
  name: string
  amount: number
  /** Whose signature it waits on: the customer's, ours to send it to the trade, or the trade's. */
  waitsOn: 'customer' | 'us' | 'trade'
}

export interface DrawAtWeSee {
  lines: DrawLineAtWeSee[]
  /** The draw at what we see: the money the Draws window approves. */
  gross: number
  retainage: number
  net: number
  retainagePct: number
  /** What they asked, as the draw came in. */
  asked: { gross: number; retainage: number; net: number }
  heldOut: HeldOutChange[]
  /** The newest tap on any line, and who made it. Null: not walked yet. */
  walkedOn: string | null
  walkedBy: string | null
}

/** What a draw asks, after retainage and before any back-charge we took off it. */
export function askedOf(draw: Draw): { gross: number; retainage: number; net: number } {
  if (draw.asked) return { gross: draw.asked.gross, retainage: draw.asked.retainage, net: draw.asked.net }
  const taken = (draw.backCharges ?? []).reduce((s, c) => s + c.amount, 0)
  return { gross: draw.gross, retainage: draw.retainage, net: draw.net + taken }
}

/** The change orders on a trade not yet signed both ways, by the Building lane's states. */
export function heldOutChanges(project: GcProject, pkg: TradePackage): HeldOutChange[] {
  const waits: Record<Exclude<TradeChange['state'], 'signed'>, HeldOutChange['waitsOn']> = { owner: 'customer', toSend: 'us', sent: 'trade' }
  return tradeChangesFor(project, pkg)
    .filter((c): c is TradeChange & { state: Exclude<TradeChange['state'], 'signed'> } => c.state !== 'signed')
    .map((c) => ({ name: `CO ${c.co.number}`, amount: c.co.cost, waitsOn: waits[c.state] }))
}

/** Each line's stored dollars on the draw before this one, so a line's money counts only the change in stored. */
function storedBeforeByLine(sow: Sow, number: number): Map<string, number> {
  const prev = [...sow.draws].filter((d) => d.number < number).sort((a, b) => b.number - a.number)[0]
  return new Map((prev?.lines ?? []).map((l) => [l.sovId, l.stored ?? 0]))
}

/**
 * A draw's lines at what we see. A line nobody walked counts at the claim, and a tap above the claim counts at the
 * claim: we never approve more than they asked. Stored material stays as asked, as the Draws window approves it;
 * the walk says whether it was on site.
 */
export function drawAtWeSee(
  project: GcProject,
  pkg: TradePackage,
  sow: Sow,
  draw: Draw,
  checks: LineCheck[],
  scheduleOf: (sovId: string) => number | null = () => null,
): DrawAtWeSee {
  const newest = newestChecks(checks)
  const checkOf = (sovId: string) => newest.get(checkKey(draw.id, sovId))
  const weSee: Record<string, number> = {}
  for (const l of draw.lines) {
    const pct = checkOf(l.sovId)?.weSee
    if (pct !== null && pct !== undefined) weSee[l.sovId] = pct
  }
  const stored = storedOf(draw.lines)
  const claimedApp = payApplication(sow, draw.number, Object.fromEntries(draw.lines.map((l) => [l.sovId, l.toPct])), false, stored)
  const seeApp = payApplication(sow, draw.number, Object.fromEntries(draw.lines.map((l) => [l.sovId, Math.min(l.toPct, weSee[l.sovId] ?? l.toPct)])), false, stored)
  const before = storedBeforeByLine(sow, draw.number)
  const lines: DrawLineAtWeSee[] = draw.lines.flatMap((claim) => {
    const asked = claimedApp.lines.find((l) => l.sovId === claim.sovId)
    const seen = seeApp.lines.find((l) => l.sovId === claim.sovId)
    if (!asked || !seen) return []
    const check = checkOf(claim.sovId)
    const was = before.get(claim.sovId) ?? 0
    const see = check?.weSee ?? null
    return [
      {
        sovId: claim.sovId,
        item: asked.item,
        label: asked.label,
        value: asked.scheduled,
        last: asked.scheduled === 0 ? 0 : Math.round((asked.fromPrevious / asked.scheduled) * 100),
        claimed: asked.pct,
        weSee: see,
        schedule: scheduleOf(claim.sovId),
        stored: claim.stored ?? 0,
        onSite: check?.onSite ?? null,
        doubt: see !== null && see < asked.pct && asked.thisPeriod > 0,
        thisDraw: seen.thisPeriod + seen.stored - was,
        asClaimed: asked.thisPeriod + asked.stored - was,
        photo: check?.photo ?? false,
        note: check?.note.trim() ?? '',
      },
    ]
  })
  const money = drawApprovedLess(sow, draw, weSee)
  const taps = draw.lines.map((l) => checkOf(l.sovId)).filter((c): c is LineCheck => c !== undefined)
  const newestTap = taps.reduce<LineCheck | null>((n, c) => (!n || c.at >= n.at ? c : n), null)
  return {
    lines,
    gross: money.gross,
    retainage: money.retainage,
    net: money.net,
    retainagePct: sow.retainagePct,
    asked: askedOf(draw),
    heldOut: heldOutChanges(project, pkg),
    walkedOn: newestTap?.at ?? null,
    walkedBy: newestTap?.by ?? null,
  }
}

/** The line over the lines: who saw them on site and when, or that nobody has. */
export function walkedWords(d: Pick<DrawAtWeSee, 'walkedOn' | 'walkedBy'>): string {
  if (!d.walkedOn) return 'Not walked yet.'
  return `${d.walkedBy ?? 'The superintendent'} saw the lines on site ${weekdayDate(d.walkedOn.slice(0, 10))}. The photos are on the daily log.`
}
