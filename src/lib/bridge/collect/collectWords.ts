/**
 * The Collect desk, PR B (v2.5853): the words on the modal, from the pile and
 * the payers. One sentence per idea, none over twenty words, no dash or
 * parenthesis inside one: `collectWords.test.ts` holds every line to the
 * plain-words rule the help guides answer to. Pure.
 */
import type { LienArChip } from '../../jobs/lienArChip'
import { TOUCH_QUIET_DAYS } from '../../jobs/paymentChaseTouches'
import { stageUsd, weeksToClear } from '../stageFlow'
import type { CollectBillState, CollectPile } from './collectPile'
import type { CollectPayer, CollectPayerCut } from './collectPayers'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const round1 = (n: number): string => (n >= 100 ? `${Math.round(n)}` : n.toFixed(1))

export type CollectLegendEntry = { state: CollectBillState; label: string; usd: number; count: number; words: string }

/** The bar's legend, in the bar's order, then Collections apart. */
export function collectLegend(pile: CollectPile, opts: { largestNotDue?: { name: string; usd: number; dueYmd: string; dueWords: string } | null } = {}): CollectLegendEntry[] {
  const s = pile.byState
  const brokenSoonest = pile.bills.filter((b) => b.state === 'broken').sort((a, b) => (a.expectedYmd ?? '') < (b.expectedYmd ?? '') ? -1 : 1)[0]
  const brokenOnOne = brokenSoonest ? pile.bills.filter((b) => b.state === 'broken' && b.expectedYmd === brokenSoonest.expectedYmd).reduce((sum, b) => sum + b.usd, 0) : 0
  return [
    {
      state: 'notdue',
      label: `${stageUsd(s.notdue.usd)} not yet due`,
      usd: s.notdue.usd,
      count: s.notdue.count,
      words: `${s.notdue.count} ${plural(s.notdue.count, 'bill', 'bills')} inside their payer's pace. Leave them.${opts.largestNotDue ? ` ${opts.largestNotDue.name}'s ${stageUsd(opts.largestNotDue.usd)} is here until ${opts.largestNotDue.dueWords}.` : ''}`,
    },
    {
      state: 'promised',
      label: `${stageUsd(s.promised.usd)} promised`,
      usd: s.promised.usd,
      count: s.promised.count,
      words: s.promised.count > 0 ? `${s.promised.count} ${plural(s.promised.count, 'bill', 'bills')} with a date still ahead. Watch the date.` : 'No promise on the books has a date still ahead.',
    },
    {
      state: 'broken',
      label: `${stageUsd(s.broken.usd)} past a promise`,
      usd: s.broken.usd,
      count: s.broken.count,
      words: s.broken.count > 0 ? `${s.broken.count} ${plural(s.broken.count, 'bill', 'bills')} past the day the payer named.${brokenSoonest?.expectedYmd ? ` ${stageUsd(brokenOnOne)} of it was promised for ${ymdWords(brokenSoonest.expectedYmd)}.` : ''}` : 'No promise is broken.',
    },
    {
      state: 'late',
      label: `${stageUsd(s.late.usd)} late, no date`,
      usd: s.late.usd,
      count: s.late.count,
      words: `${s.late.count} ${plural(s.late.count, 'bill', 'bills')} past the day their payer usually pays, no promise recorded. This is the pile.`,
    },
    {
      state: 'doubtful',
      label: `${stageUsd(s.doubtful.usd)} doubtful`,
      usd: s.doubtful.usd,
      count: s.doubtful.count,
      words: `${s.doubtful.count} ${plural(s.doubtful.count, 'bill', 'bills')} more than ${pile.rules.doubtfulAfterDays} days past their day. The forecast leaves them out. Collections or lien.`,
    },
    {
      state: 'collections',
      label: `${stageUsd(s.collections.usd)} in Collections`,
      usd: s.collections.usd,
      count: s.collections.count,
      words: `${s.collections.count} ${plural(s.collections.count, 'bill', 'bills')}, kept apart from the pile and off the bar. Written off for planning.`,
    },
  ]
}

export type CollectTile = { head: string; value: string; words: string; tone: 'red' | 'plain' | 'green' | 'amber' }

/** The three tiles under the title: the late part, the cut, the left-alone case. */
export function collectTiles(pile: CollectPile, cut: CollectPayerCut, pace: { paidPerWeekUsd: number; billedPerWeekUsd: number }): CollectTile[] {
  const lateWeeks = weeksToClear(pile.latePileUsd, pace.paidPerWeekUsd)
  const leftAlone = pile.headlineUsd + 12 * (pace.billedPerWeekUsd - pace.paidPerWeekUsd)
  const grows = pace.billedPerWeekUsd > pace.paidPerWeekUsd
  return [
    {
      head: 'Only this part waits on a call',
      value: `${stageUsd(pile.latePileUsd)} late`,
      words: `${pile.latePileCount} ${plural(pile.latePileCount, 'bill', 'bills')} past the day their payer usually pays, ${pile.byState.broken.count} of them past a promise. ${pile.byState.doubtful.count} more ${plural(pile.byState.doubtful.count, 'is', 'are')} doubtful, ${stageUsd(pile.byState.doubtful.usd)}.${lateWeeks != null ? ` The late part alone clears in ${round1(lateWeeks)} weeks at today's pace.` : ''}`,
      tone: 'red',
    },
    {
      head: `${cut.cut.length} ${plural(cut.cut.length, 'payer holds', 'payers hold')}`,
      value: `${stageUsd(cut.cutUsd)} · ${Math.round(cut.cutShare * 100)}%`,
      words: `${cut.cut.length} ${plural(cut.cut.length, 'move covers', 'moves cover')} it. The other ${cut.rest.bills} ${plural(cut.rest.bills, 'bill is', 'bills are')} ${stageUsd(cut.rest.usd)} across ${cut.rest.payers} ${plural(cut.rest.payers, 'payer', 'payers')}.`,
      tone: 'plain',
    },
    {
      head: 'Left alone',
      value: `${stageUsd(leftAlone)} in twelve weeks`,
      words: grows ? `The office bills ${stageUsd(pace.billedPerWeekUsd)} a week and customers pay ${stageUsd(pace.paidPerWeekUsd)}. The pile grows ${stageUsd(pace.billedPerWeekUsd - pace.paidPerWeekUsd)} a week.` : `Customers pay ${stageUsd(pace.paidPerWeekUsd)} a week against ${stageUsd(pace.billedPerWeekUsd)} billed. The pile shrinks on its own.`,
      tone: grows ? 'amber' : 'green',
    },
  ]
}

/** "~35 d" and the line under it. */
export function collectPaceWords(p: Pick<CollectPayer, 'paceDays' | 'paceSource' | 'paceSamples' | 'isGc'>): { value: string; sub: string } {
  if (p.paceDays == null) return { value: 'no pace', sub: 'nothing to read' }
  const value = `~${p.paceDays} d`
  switch (p.paceSource) {
    case 'own':
      return { value, sub: `${p.paceSamples} ${plural(p.paceSamples, 'payment', 'payments')} on record` }
    case 'gc':
      return { value, sub: 'first job · the GC pace here' }
    case 'segment':
      return { value, sub: p.isGc ? 'first job · the commercial pace' : 'first job · their segment’s pace' }
    case 'company':
      return { value, sub: 'first job · the company pace' }
    default:
      return { value, sub: '' }
  }
}

const ymdWords = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** The row's "where it stands": the money by state, the promise, the hand-marked share, the lien paper. */
export function collectStandsWords(p: CollectPayer, chip: LienArChip | null | undefined, todayYmd: string): string[] {
  const out: string[] = []
  if (p.promise.state === 'broken' && p.promise.promise) {
    const days = Math.max(0, Math.round((Date.parse(`${todayYmd}T12:00:00Z`) - Date.parse(`${p.promise.promise.promisedYmd}T12:00:00Z`)) / 86_400_000))
    out.push(`Promised for ${ymdWords(p.promise.promise.promisedYmd)}, recorded by ${p.promise.promise.markedByName}. ${days} days past.`)
  } else if (p.promise.state === 'promised' && p.promise.promise) {
    out.push(`Promised for ${ymdWords(p.promise.promise.promisedYmd)}, recorded by ${p.promise.promise.markedByName}.`)
  }
  const late = p.byState.late + p.byState.broken
  if (p.byState.doubtful > 0) out.push(`${stageUsd(p.byState.doubtful)} is doubtful by their pace.`)
  if (late > 0 && p.byState.notdue > 0) out.push(`${stageUsd(late)} is late. ${stageUsd(p.byState.notdue)} is not yet due.`)
  else if (late > 0 && p.promise.state !== 'broken') out.push(`${stageUsd(late)} is late.`)
  else if (p.byState.notdue > 0 && late === 0 && p.byState.doubtful === 0) out.push(`Nothing is late yet.`)
  if (p.over60Usd > 0 && p.billCount > 1) out.push(`${stageUsd(p.over60Usd)} of it is over 60 days old.`)
  if (p.handMarkedUsd > 0) out.push(p.handMarkedUsd >= p.usd - 0.5 ? 'Marked billed by hand, never sent from here.' : `${stageUsd(p.handMarkedUsd)} of it was marked billed by hand, never sent from here.`)
  const touch = p.lastTouch && !p.lastTouch.resolvedAt ? p.lastTouch : null
  const touchDay = touch ? calendarYmdInAppTzFromIso(touch.createdAt) || null : null
  const touchNote = touch?.note?.trim() ? ` ${chipSentence(touch.note)}` : ''
  if (touch && touchDay && touch.outcome === 'dispute') {
    out.push(`Disputed ${ymdWords(touchDay)}, recorded by ${touch.createdByName}.${touch.note?.trim() ? ` Their words: ${touch.note.trim()}` : ''}`)
    out.push('The bills stay in the pile, marked disputed, until the owner decides.')
  } else if (touch && touchDay && QUIET_OUTCOMES.has(touch.outcome) && addDaysYmd(touchDay, TOUCH_QUIET_DAYS) > todayYmd) {
    out.push(`Called ${ymdWords(touchDay)}, ${touch.createdByName}.${touchNote}`)
    out.push(`Back on the sheet ${ymdWords(addDaysYmd(touchDay, TOUCH_QUIET_DAYS))}.`)
  } else if (p.lastTouch) out.push(`Last touch ${ymdWords(calendarYmdInAppTzFromIso(p.lastTouch.createdAt))}, ${p.lastTouch.createdByName}.`)
  else out.push('No call recorded.')
  if (p.misses >= 2) out.push(`${p.misses} misses on the account. The owner makes the next call.`)
  // The chip's own words ride on the move's paper link; the row reads its sentence.
  if (chip) out.push(chipSentence(chip.sentence))
  return out
}

/** The touch outcomes after which a payer waits off the sheet for TOUCH_QUIET_DAYS: no date was named. */
export const QUIET_OUTCOMES: ReadonlySet<string> = new Set(['cant_reach', 'note', 'resend'])

/** YYYY-MM-DD plus n days. */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A lien chip's sentence (or a touch's note) as a sentence: a capital first, a stop last. */
export function chipSentence(s: string): string {
  const t = s.trim()
  if (!t) return t
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

/** The one line for everyone outside the cut. */
export function collectRestWords(cut: CollectPayerCut): { head: string; words: string } {
  const r = cut.rest
  if (r.payers === 0) return { head: 'Everyone else', words: 'Nothing outside the cut.' }
  return {
    head: `Everyone else · ${r.bills} ${plural(r.bills, 'bill', 'bills')}, ${r.payers} ${plural(r.payers, 'payer', 'payers')}, none over ${stageUsd(r.maxUsd)}`,
    words: `${stageUsd(r.latePileUsd)} of it is late. Pay links and reminders do this work. Nothing here moves the weeks.`,
  }
}

/** The footnote: how the modal reads, so a reader can see where it could lie. */
export function collectHowItReads(pile: CollectPile, segments: { commercial: number | null; residential: number | null; company: number | null }): string {
  const parts = [
    'How this reads: a payer’s pace is the median days they took to pay past bills.',
    'A bill is late once it is past its billed day plus that pace.',
    `Doubtful is ${pile.rules.doubtfulAfterDays} days past that.`,
    `A promise is broken ${pile.rules.brokenGraceDays} days after its day.`,
  ]
  if (pile.gcPace) parts.push(`A GC with no history reads at the GC pace here, ${pile.gcPace.medianDays} days. That pace comes from the ${pile.gcPacePayers} ${plural(pile.gcPacePayers, 'GC', 'GCs')} who have paid us.`)
  if (pile.rules.gcByPayApp) parts.push('A payer with a pay application on the job reads as a GC, whatever its customer record says.')
  if (pile.rules.gcByHandMarked) parts.push('So does a commercial payer whose bill was marked billed by hand. That is how a pay application is recorded today.')
  if (segments.commercial != null || segments.residential != null) parts.push(`Anyone else with no history reads at the commercial median, ${segments.commercial ?? '?'} days, or the residential median, ${segments.residential ?? '?'} days.`)
  if (segments.company != null) parts.push(`The forecast today reads any payer with no history at the company’s ${segments.company}-day median.`)
  parts.push('A bill marked billed by hand counts from the day it was marked.')
  return parts.join(' ')
}

export type CollectSlowFact = { tone: 'red' | 'amber' | 'grey'; head: string; words: string }

/** What slows Collect before any call: the facts the pile alone can tell. */
export function collectSlowFacts(pile: CollectPile, cut: CollectPayerCut): CollectSlowFact[] {
  const out: CollectSlowFact[] = []
  const handMarked = pile.bills.filter((b) => b.state !== 'collections' && b.sentFromHere === false).reduce((s, b) => s + b.usd, 0)
  if (handMarked > 0) out.push({ tone: 'red', head: `${stageUsd(handMarked)} was marked billed by hand and never sent from here.`, words: 'A GC pay application pays on the GC’s calendar, not ours. The forecast has no approval date to read.' })
  const noDate = pile.headlineUsd - pile.byState.promised.usd - pile.byState.broken.usd
  if (noDate > 0) out.push({ tone: 'red', head: `No pay date on ${stageUsd(noDate)} of the pile.`, words: 'Every call ends with a date or it was not a call. The forecast and the week’s reading both lean on it.' })
  const firstJobs = cut.cut.filter((p) => p.paceSource !== 'own')
  if (firstJobs.length) {
    const usd = firstJobs.reduce((s, p) => s + p.usd, 0)
    out.push({ tone: 'amber', head: `No pay history on ${firstJobs.length === 1 ? firstJobs[0]!.payerName : `${firstJobs.length} of the ${cut.cut.length} payers`}, ${stageUsd(usd)}.`, words: firstJobs.some((p) => p.isGc) ? `A first job reads at the pace of its kind here until the payer pays once. The GC pace here is ${pile.gcPace ? `${pile.gcPace.medianDays} days` : 'not on record'}.` : 'A first job reads at the pace of its kind here until the payer pays once.' })
  }
  if (pile.byState.doubtful.usd > 0) out.push({ tone: 'grey', head: `${stageUsd(pile.byState.doubtful.usd)} is doubtful.`, words: `${pile.byState.doubtful.count} ${plural(pile.byState.doubtful.count, 'bill', 'bills')} more than ${pile.rules.doubtfulAfterDays} days past their day. Collections, or the Lien desk.` })
  return out
}
