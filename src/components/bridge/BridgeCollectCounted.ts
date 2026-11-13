/**
 * The Collect window's words (punch list #334, PR 1): the headline, the three-part bar under it, the
 * foot's plan line and *How this is counted*. Each sentence is one idea, under twenty words, with no dash, semicolon,
 * parenthesis or dot list inside it: `BridgeCollectDesk.render.test.tsx` holds every line to `plainWordsFailures`.
 * The kernels under `src/lib/bridge/collect` keep the arithmetic and the older words. Pure.
 */
import { stageUsd } from '../../lib/bridge/stageFlow'
import type { CollectPile } from '../../lib/bridge/collect/collectPile'
import type { CollectPayerCut } from '../../lib/bridge/collect/collectPayers'
import type { CollectSheet } from '../../lib/bridge/collect/collectMoves'
import { collectWaitingWords } from '../../lib/bridge/collect/collectMoves'

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const round1 = (n: number): string => (n >= 100 ? `${Math.round(n)}` : n.toFixed(1))

/** The bar under the headline: three parts that add up to everything billed and not yet paid. */
export type CollectThreeParts = { notDueUsd: number; lateUsd: number; doubtfulUsd: number }

/** A promise with its day still ahead is not yet due. A broken promise is late. */
export function collectThreeParts(pile: CollectPile): CollectThreeParts {
  return { notDueUsd: pile.byState.notdue.usd + pile.byState.promised.usd, lateUsd: pile.latePileUsd, doubtfulUsd: pile.byState.doubtful.usd }
}

/** "$176k is late. Five customers hold most of it." */
export function collectHeadline(pile: CollectPile, cut: CollectPayerCut): { words: string; bad: boolean } {
  const parts = collectThreeParts(pile)
  if (!(parts.lateUsd > 0)) {
    if (parts.doubtfulUsd > 0) return { words: `Nothing is late. ${stageUsd(parts.doubtfulUsd)} is doubtful.`, bad: true }
    return { words: pile.headlineUsd > 0 ? 'Nothing is late.' : 'Nothing is billed and unpaid.', bad: false }
  }
  const n = cut.cut.length
  if (n === 0) return { words: `${stageUsd(parts.lateUsd)} is late.`, bad: true }
  return { words: `${stageUsd(parts.lateUsd)} is late. ${COUNT_WORDS[n] ?? String(n)} ${n === 1 ? 'customer holds' : 'customers hold'} most of it.`, bad: true }
}

/** The line that opens *What is in the pile*: the whole pile, the bills past their day, the pace and the weeks. */
export function collectPileLead(pile: CollectPile, pace: { paidPerWeekUsd: number }, weeks: number | null): string {
  const out = [`${stageUsd(pile.headlineUsd)} is billed and not yet paid, on ${pile.headlineCount} ${pile.headlineCount === 1 ? 'bill' : 'bills'}.`]
  out.push(pile.pastDueCount === 1 ? '1 of them is past its expected day.' : `${pile.pastDueCount} of them are past their expected day.`)
  out.push(`Customers pay ${stageUsd(pace.paidPerWeekUsd)} a week.`)
  if (weeks != null) out.push(`At that pace, what is already late takes ${round1(weeks)} weeks to collect.`)
  return out.join(' ')
}

/** The foot's line: what the sheet asks for. The page makes no call, so it asks nothing on Friday (punch list #334, PR 7). */
export function collectPlanLine(sheet: CollectSheet | null | undefined): string {
  if (!sheet) return 'The moves and the owner’s decisions come next.'
  return `${sheet.moves} ${sheet.moves === 1 ? 'move asks' : 'moves ask'} for ${stageUsd(sheet.askUsd)}.${sheet.waiting > 0 ? ` ${collectWaitingWords(sheet.waiting)}` : ''}`
}

/** *How this is counted*: the old *How this reads*, one short sentence to a line. */
export function collectCountedLines(pile: CollectPile, cut: CollectPayerCut, segments: { commercial: number | null; residential: number | null; company: number | null }): string[] {
  const out = [
    'A customer’s pace is the number of days they usually take to pay.',
    'It is the middle value of the bills they have paid us.',
    'A bill is late once it is past the day it was billed plus that pace.',
    `A bill is doubtful once it is ${pile.rules.doubtfulAfterDays} days past that day.`,
    `A promise is broken ${pile.rules.brokenGraceDays} days after the day the customer named.`,
  ]
  if (pile.gcPace) {
    out.push(`A general contractor, or GC, with no history here is read at ${pile.gcPace.medianDays} days.`)
    out.push(pile.gcPacePayers === 1 ? 'That pace comes from the 1 GC who has paid us.' : `That pace comes from the ${pile.gcPacePayers} GCs who have paid us.`)
  }
  if (pile.rules.gcByPayApp) out.push('A customer with a pay application on the job is read as a GC.')
  if (pile.rules.gcByHandMarked) out.push('So is a commercial customer whose bill was marked billed by hand.')
  if (segments.commercial != null) out.push(`Any other commercial customer with no history is read at ${segments.commercial} days.`)
  if (segments.residential != null) out.push(`A residential customer with no history is read at ${segments.residential} days.`)
  if (segments.company != null) out.push(`When the kind of customer is not on record, the pace is ${segments.company} days.`)
  out.push('A bill marked billed by hand counts from the day it was marked.')
  out.push('Not yet due is every bill still inside its customer’s pace.')
  out.push('A promise with its day still ahead counts as not yet due.')
  out.push('Late is every bill past its day and every broken promise.')
  out.push('Doubtful bills are left out of the forecast.')
  out.push('Bills in Collections are kept apart and counted in none of the three.')
  if (cut.cut.length > 0) out.push(`The customers to call are the fewest who hold most of the open money, ${Math.round(cut.cutShare * 100)}% of it today.`)
  out.push('The chips on the board and the payment forecast use the same paces.')
  return out
}
