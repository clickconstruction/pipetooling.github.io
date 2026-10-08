/**
 * The option the GC took (v2.4728, the v2.4723 follow-up): a letter with two or more base
 * versions is two options the GC picks between, and the win has to say which. The record is
 * `bid_versions.outcome` — the taken option reads `won`, the others stay as they were (not
 * taken is not lost: no loss reason, no Why-we-lost row). The taken option also becomes the
 * bid's active version (`bids.selected_bid_version_id`), so the job, the takeoff and the labor
 * follow it, and the agreed value is that option's sent value plus the accepted add-ons.
 * Pure; the write lives in wonOptionWrite.ts and the room's signature in sign-bid-room.
 */

import { agreedValueFromAcceptance, type OfferedAlternate } from './alternateAcceptance'
import { planSamePageLetter, type SamePageOption, type SamePagePlan, type SamePageSection } from './coverLetterSamePage'

export type OptionVersion = {
  id: string
  name: string
  sort_order: number
  include_in_submission: boolean
  is_alternate?: boolean | null
  outcome?: string | null
  customer_id?: string | null
}

/**
 * The letter's options for one GC packet: its base versions in the letter, in step-1 order.
 * `packetCustomerId` null = the bid's own GC (versions with no customer_id). Fewer than two
 * means the letter had no options and nothing to ask.
 */
export function letterOptionVersions<T extends OptionVersion>(versions: readonly T[], packetCustomerId: string | null = null): T[] {
  return versions
    .filter((v) => v.include_in_submission && !v.is_alternate && (v.customer_id ?? null) === packetCustomerId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/** The option already recorded as taken: the first in order reading `won`, else null. */
export function wonOptionVersionId(options: ReadonlyArray<Pick<OptionVersion, 'id' | 'outcome'>>): string | null {
  return options.find((o) => o.outcome === 'won')?.id ?? null
}

/** The version writes for an answer: the chosen option to `won`, any other option that read `won` back to unanswered. */
export function wonOptionWrites(options: ReadonlyArray<Pick<OptionVersion, 'id' | 'outcome'>>, chosenId: string): { won: string[]; cleared: string[] } {
  const chosen = options.find((o) => o.id === chosenId)
  return {
    won: chosen && chosen.outcome !== 'won' ? [chosenId] : chosen ? [] : [],
    cleared: options.filter((o) => o.id !== chosenId && o.outcome === 'won').map((o) => o.id),
  }
}

/** The agreed value for the option taken: its sent value plus the accepted add-ons (the v2.4211 rule, on the option's number). */
export function agreedValueForOption(sentValue: number | null, alternates: readonly OfferedAlternate[], accepted: readonly string[]): number | null {
  return agreedValueFromAcceptance(sentValue, alternates, accepted)
}

export type RoomOptionSection = {
  name: string
  isAlternate: boolean
  revenueSum: number
  fixtureRows: { fixture: string; count: number }[]
  bidVersionId: string | null
}

/**
 * The bid room's pickable proposals for a letter with options: Option 1 as the proposal, then
 * every signable combination as an alternate in lieu of it — Option 1 with each of its
 * alternates, each other option, and each other option with each of its alternates — every one
 * carrying its version, so the signature can record which option was taken. The in-lieu-of
 * versions (flagged Alternate) follow, as before.
 */
export function roomSectionsForLetterOptions(
  options: ReadonlyArray<SamePageOption>,
  inLieu: ReadonlyArray<SamePageSection>,
  labels: { option: (o: SamePageOption) => string; alternate: (o: SamePageOption, a: SamePageSection, j: number) => string },
): RoomOptionSection[] {
  const lead = options[0]
  if (!lead) return []
  const sec = (name: string, s: SamePageSection, isAlternate: boolean): RoomOptionSection => ({ name, isAlternate, revenueSum: s.revenueSum, fixtureRows: s.fixtureRows, bidVersionId: s.bidVersionId })
  const out: RoomOptionSection[] = [sec(labels.option(lead), lead.section, false)]
  for (const [j, a] of lead.alternates.entries()) out.push(sec(`${labels.option(lead)} · ${labels.alternate(lead, a, j)}`, a, true))
  for (const o of options.slice(1)) {
    out.push(sec(labels.option(o), o.section, true))
    for (const [j, a] of o.alternates.entries()) out.push(sec(`${labels.option(o)} · ${labels.alternate(o, a, j)}`, a, true))
  }
  for (const s of inLieu) out.push(sec(s.name, s, true))
  return out
}

/**
 * The sections one GC's bid room offers (v2.4892). Two or more base bids are options the GC picks
 * between, never a sum (v2.4723), so whenever the GC's letter holds two bases the room offers
 * `roomSectionsForLetterOptions`, named by `labels` (the letter's own option labels), whatever the
 * letter's layout; otherwise the letter's sections as they are, each carrying its version. Until
 * v2.4892 the Cover Letter tab built the options only for a bid with no versions, which never has
 * two bases, so a two-option letter's room folded both into one "Base bid" at their sum.
 */
export function roomSectionsForPacket(
  sections: ReadonlyArray<SamePageSection>,
  labels: (plan: SamePagePlan) => Parameters<typeof roomSectionsForLetterOptions>[2],
): RoomOptionSection[] {
  const plan = planSamePageLetter([...sections])
  if (plan?.options) return roomSectionsForLetterOptions(plan.options, plan.alternates, labels(plan))
  return sections.map((s) => ({ name: s.name, isAlternate: s.isAlternate, revenueSum: s.revenueSum, fixtureRows: s.fixtureRows, bidVersionId: s.bidVersionId }))
}
