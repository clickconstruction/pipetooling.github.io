import type { ComponentBurn } from './jobBudget'

/**
 * The Job Budget card's sentence, in dollars (punch list #406, the owner's walk of 2026-11-20). The card said
 * *labor is 9 points ahead of progress*: a point is a percentage point of a budget spent over the percent of
 * work done, a word nobody in the office says. The sentence now says the same thing as money, the dollars a
 * component has spent over or under what the work done calls for:
 *
 *   Materials are $6,700 over the estimate with 23 % of the work left, labor is $4,233 over for the work done,
 *   and subs are $1,305 under for the work done.
 *
 * When a component is named is not changed: past its whole estimate, or five percentage points or more either
 * side of the work done.
 *
 * This file is the client's alone. `jobBudget.ts` is copied to the edge functions, and a word changed there
 * makes every function that bundles the copy read as behind until it is redeployed. So the old
 * `budgetWhyWords` stands in that file, unused, until the kernel next changes for a reason of its own.
 */
export function budgetWhySentence(args: { labor: ComponentBurn; materials: ComponentBurn; subs: ComponentBurn; pctDone: number | null; fmt: (n: number) => string }): string {
  const parts: string[] = []
  const left = args.pctDone != null ? Math.max(0, 100 - Math.min(args.pctDone, 100)) : null
  const usdWords = (n: number): string => '$' + args.fmt(n)
  const say = (name: string, b: ComponentBurn) => {
    if (b.budgetUsd == null) return
    const verb = name === 'labor' ? 'is' : 'are'
    // The dollars over what the work done calls for: the lead in percentage points, of this component's budget.
    const usd = b.aheadPts != null ? (Math.abs(b.aheadPts) / 100) * b.budgetUsd : 0
    if (b.overUsd != null && b.overUsd > 0) parts.push(`${name} ${verb} ${usdWords(b.overUsd)} over the estimate${left != null ? ` with ${Math.round(left)} % of the work left` : ''}`)
    else if (b.aheadPts != null && b.aheadPts >= 5) parts.push(`${name} ${verb} ${usdWords(usd)} over for the work done`)
    else if (b.aheadPts != null && b.aheadPts <= -5) parts.push(`${name} ${verb} ${usdWords(usd)} under for the work done`)
  }
  say('materials', args.materials)
  say('labor', args.labor)
  say('subs', args.subs)
  if (parts.length === 0) return args.labor.budgetUsd == null && args.materials.budgetUsd == null && args.subs.budgetUsd == null ? 'No component budget to read against yet.' : 'Every component is on pace with the work.'
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0]!
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}
