import { buildReadingGaps, type ReadingGap, type ReadingGapKey, type ReadingGapsInput } from './readingGaps'

/**
 * Soft numbers (v2.6840, punch list #303, PR 2): the one list of what makes the Bridge's reading
 * unsure, each row saying what it moves and ending in its door. It stands in for four of the
 * page's five lists of things to do: *Fix the reading*, the piles in the Decision card's one
 * line, and the rows of *This week* that were about accuracy. The fifth, the moves on the link's
 * desk, is the call card on the first screen.
 *
 * The rows, their order and their doors are `buildReadingGaps`'s, so the count on the first
 * screen is the count it always was. The words are written here, in plain words.
 */

export type SoftNumber = {
  key: ReadingGapKey
  /** What is soft: "93 hours wait on approval". */
  name: string
  /** What it moves, in one or two sentences. */
  moves: string
  door: { to: string; label: string } | null
}

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 100_000 ? `${(Math.abs(n) / 1000).toFixed(0)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : `${Math.round(Math.abs(n))}`}`
const count = (n: number): string => Math.round(n).toLocaleString('en-US')
const plural = (c: number, one: string, many: string): string => (c === 1 ? one : many)

function words(gap: ReadingGap, input: ReadingGapsInput): { name: string; moves: string } {
  switch (gap.key) {
    case 'unapproved': {
      const h = Math.round(input.pendingClosedHours)
      const r = input.headlineRecordedUsd
      const a = input.headlineApprovedUsd
      return {
        name: `${count(h)} ${plural(h, 'hour waits', 'hours wait')} on approval`,
        moves: r != null && a != null ? `This week reads ${shortK(a)} until they are approved. With them it is about ${shortK(r)}.` : 'The week’s number and payroll read low until they are approved.',
      }
    }
    case 'cash_drift': {
      const bank = input.bankUsd ?? 0
      const typed = input.typedRolledUsd ?? 0
      return {
        name: `${shortK(Math.abs(typed - bank))} of bank flows are not in the app`,
        moves: `The figure typed ${input.typedLabel ?? 'earlier'} would read ${shortK(typed)} today. The bank says ${shortK(bank)}. Net position’s past is off by the same.`,
      }
    }
    case 'cash_typed': {
      const age = Math.max(0, Math.round(input.typedDaysAgo ?? 0))
      return {
        name: `Cash was typed ${input.typedLabel ?? 'earlier'}`,
        moves: age > 0 ? `The bank could not be read. The typed figure was rolled ${age} ${plural(age, 'day', 'days')} through the bank flows.` : 'The bank could not be read, so the typed figure stands.',
      }
    }
    case 'assumed_half':
      return {
        name: `${count(input.assumedHalfJobs)} ${plural(input.assumedHalfJobs, 'job', 'jobs')} worked with no percent complete`,
        // With nothing earned on them in the window the dollars are left out: "$0 of earned rests on a guess" says nothing.
        moves: `${input.assumedHalfEarnedUsd >= 1 ? `${shortK(input.assumedHalfEarnedUsd)} of earned` : 'What they earned'} rests on a guess of half done. Set the percent and the number firms up.`,
      }
    case 'no_contract': {
      const jobs = input.noContractJobs
      const labels = jobs.slice(0, 4).map((j) => j.label)
      const more = jobs.length - labels.length
      return {
        name: `${count(jobs.length)} worked ${plural(jobs.length, 'job', 'jobs')} with no price`,
        moves: `Their hours earn $0 until a price is on the job. ${jobs.length === 1 ? 'It is' : 'They are'} ${labels.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`,
      }
    }
    case 'transfers': {
      const c = input.unattributedNoncard ?? 0
      return {
        name: `${count(c)} bank ${plural(c, 'transfer', 'transfers')} not sorted`,
        moves: `Rent, insurance, trucks and loans in there never reach the paper. Overhead reads ${shortK(input.overheadPerDayUsd)} a day and is more.`,
      }
    }
    case 'card': {
      const c = input.unlinkedCard ?? 0
      return { name: `${count(c)} card ${plural(c, 'purchase', 'purchases')} not sorted`, moves: 'Job parts sit on the bank and not on a job. Job costs read low.' }
    }
    case 'bids_no_value':
      return { name: `${count(input.bidsNoValue)} ${plural(input.bidsNoValue, 'bid', 'bids')} sent with no value`, moves: 'They count as $0 sent. Put the bid value on each.' }
  }
}

export function buildSoftNumbers(input: ReadingGapsInput): SoftNumber[] {
  return buildReadingGaps(input).map((g) => ({ key: g.key, ...words(g, input), door: g.door }))
}
