/**
 * The Collect desk, PR C (v2.5854): the guess, stated as one. If half of what
 * the moves ask for lands in three weeks, on top of today's pace, where does
 * the pile stand and who holds the link? The pile still grows with what is
 * billed; the pace rises with what landed; the link goes by the stage flow's
 * own pair rule. Left alone: the dial's twelve-week number. Pure.
 *
 * v2.5873: it reads the card's pile, what is already late, as the stage flow
 * and the dial do, so its weeks start from the card's weeks and its
 * twelve-week number is the dial's. It read the whole billed pile before.
 */
import { STAGE_PAIR_MARGIN, stageUsd, weeksToClear } from '../stageFlow'

export type CollectWhatIfInput = {
  /** The card's pile: what is already late (late, past a promise, doubtful), as the stage flow and the dial read it. */
  pileUsd: number
  askUsd: number
  paidPerWeekUsd: number
  billedPerWeekUsd: number
  /** The window the pace averages over, in weeks. */
  windowWeeks: number
  /** Build's weeks to clear, the stage Collect hands the link to; null when Build has no reading. */
  buildWeeks: number | null
  weeksAhead?: number
  share?: number
}

export type CollectWhatIf = {
  head: string
  /** "10.2 → about 5.5 weeks" */
  value: string
  words: string
  weeksNow: number | null
  weeksThen: number | null
  pileThenUsd: number
  paceThenUsd: number
  /** Who holds the link then: Collect, Build, or the two as a pair. */
  linkThen: 'collect' | 'build' | 'pair' | null
  leftAlone: { usd: number; words: string }
}

const round1 = (n: number): string => (n >= 100 ? `${Math.round(n)}` : n.toFixed(1))

export function collectWhatIf(input: CollectWhatIfInput): CollectWhatIf {
  const weeksAhead = input.weeksAhead ?? 3
  const share = input.share ?? 0.5
  const lands = input.askUsd * share
  const weeksNow = weeksToClear(input.pileUsd, input.paidPerWeekUsd)
  const pileThenUsd = Math.max(0, input.pileUsd + weeksAhead * (input.billedPerWeekUsd - input.paidPerWeekUsd) - lands)
  const paceThenUsd = input.windowWeeks > 0 ? (input.windowWeeks * input.paidPerWeekUsd + lands) / input.windowWeeks : input.paidPerWeekUsd
  const weeksThen = weeksToClear(pileThenUsd, paceThenUsd)
  let linkThen: CollectWhatIf['linkThen'] = null
  if (weeksThen != null) {
    if (input.buildWeeks == null) linkThen = 'collect'
    else if (weeksThen >= input.buildWeeks && input.buildWeeks >= weeksThen * STAGE_PAIR_MARGIN) linkThen = 'pair'
    else if (input.buildWeeks >= weeksThen && weeksThen >= input.buildWeeks * STAGE_PAIR_MARGIN) linkThen = 'pair'
    else linkThen = weeksThen > input.buildWeeks ? 'collect' : 'build'
  }
  const leftAloneUsd = input.pileUsd + 12 * (input.billedPerWeekUsd - input.paidPerWeekUsd)
  const grows = input.billedPerWeekUsd > input.paidPerWeekUsd
  const linkWords = linkThen === 'pair' ? `Collect and Build then read as a pair, ${round1(weeksThen ?? 0)} and ${round1(input.buildWeeks ?? 0)} weeks.` : linkThen === 'build' ? `Build is then the link at ${round1(input.buildWeeks ?? 0)} weeks.` : linkThen === 'collect' ? 'Collect still holds the link.' : ''
  return {
    head: `If half of the ${stageUsd(input.askUsd)} lands in ${weeksAhead} weeks`,
    value: weeksNow != null && weeksThen != null ? `${round1(weeksNow)} → about ${round1(weeksThen)} weeks` : 'no pace to read',
    words: `${stageUsd(lands)} more in the bank. The late part still grows with what is billed, to about ${stageUsd(pileThenUsd)} in ${weeksAhead} weeks. The pace rises to about ${stageUsd(paceThenUsd)}. ${linkWords} A guess, stated as one.`.replace(/\s+/g, ' ').trim(),
    weeksNow,
    weeksThen,
    pileThenUsd,
    paceThenUsd,
    linkThen,
    leftAlone: {
      usd: leftAloneUsd,
      words: grows ? `Left alone, the late part reads ${stageUsd(leftAloneUsd)} in twelve weeks.` : `Left alone, the late part shrinks to ${stageUsd(Math.max(0, leftAloneUsd))} in twelve weeks.`,
    },
  }
}
