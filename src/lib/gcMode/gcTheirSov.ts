/**
 * GC mode — design spike: a trade's own schedule of values beside ours (the owner, 2026-10-04,
 * question 4: draws by percent with retainage, and "these usually match a schedule of values based
 * on the rough in, top out, trim stage"). Draws stay by percent on our lines; this says where the
 * money claimed stands on theirs, so the two can be read side by side.
 */
import type { Sow, TheirSovLine, TradePackage } from './gcTypes'
import { money } from './gcWords'

/** The lines a trade's form starts with. They can rename, add or take any out. */
export const SOV_STAGES = ['Rough-in', 'Top out', 'Trim']

/** Their schedule of values: on the statement of work once awarded, else on the quote we carry. */
export function theirSovOf(pkg: TradePackage): TheirSovLine[] | null {
  if (pkg.sow?.theirSov && pkg.sow.theirSov.length > 0) return pkg.sow.theirSov
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return invite?.bid?.sov && invite.bid.sov.length > 0 ? invite.bid.sov : null
}

export function theirSovSum(lines: TheirSovLine[]): number {
  return lines.reduce((t, l) => t + l.amount, 0)
}

/** Their lines' total less the number it should match. 0: it adds up. */
export function theirSovGap(lines: TheirSovLine[], amount: number): number {
  return Math.round((theirSovSum(lines) - amount) * 100) / 100
}

/** Billed to date on the original contract, by our lines: what the draws claimed. Change orders are left out. */
export function claimedToDate(sow: Sow): number {
  return sow.sov.filter((l) => !l.changeOrderId).reduce((t, l) => t + (l.amount * l.pctBilled) / 100, 0)
}

export interface StageReached {
  claimed: number
  /** Their lines the money claimed covers in full, in their order. */
  through: string[]
  /** The line the money claimed reaches into, and how far. Null: none, or every line is covered. */
  into: { label: string; pct: number } | null
}

/** Walks their lines in order, each in full before the next, the way a stage schedule bills. */
export function stageReached(lines: TheirSovLine[], claimed: number): StageReached {
  let left = claimed
  const through: string[] = []
  for (const line of lines) {
    if (line.amount <= 0) continue
    if (left >= line.amount - 0.005) {
      through.push(line.label)
      left -= line.amount
      continue
    }
    return { claimed, through, into: left > 0.005 ? { label: line.label, pct: Math.round((left / line.amount) * 100) } : null }
  }
  return { claimed, through, into: null }
}

/** "Claimed $89,000 to date: through Underground and gear, 19% into Rough-in." */
export function stageReachedWords(lines: TheirSovLine[], r: StageReached): string {
  if (r.claimed <= 0) return 'Nothing claimed yet.'
  const head = `Claimed ${money(r.claimed)} to date`
  const live = lines.filter((l) => l.amount > 0)
  if (r.through.length === live.length && live.length > 0) return `${head}: every line on their schedule.`
  const parts: string[] = []
  if (r.through.length > 0) parts.push(`through ${r.through.join(', ')}`)
  if (r.into) parts.push(`${r.into.pct}% into ${r.into.label}`)
  return `${head}: ${parts.join(', ')}.`
}
