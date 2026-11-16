/**
 * GC difficulty rating (punch list #357, PR 4): a rating turned into cost lines on a bid.
 *
 * One line per rated scale, by the price list: a field point is a percent of the bid's field hours at its labor
 * rate, an office point so many office hours at the office rate, a site point (PR 6) a percent of field hours, the
 * paying point a monthly rate on the price for the days the GC's median runs past the threshold. All lines together
 * stop at the cap, a percent of the bid's own cost; past it every line shrinks by the same share and the result says
 * so. A scale the price list has no rule for adds nothing and is named.
 *
 * Pure: the engine hands in the numbers, the lines come back as direct-cost rows would hold them, and nothing here
 * reads the database. A priced bid pins its lines in `bid_difficulty` as written; this kernel is only run again when
 * the Workbench reads a newer rating in.
 */
import type { DifficultyPriceList } from './difficultyPrice'
import { DIFFICULTY_PAYING_KEY, difficultyPayingByHandOf } from './difficultyPaying'

export type DifficultyRatedScale = { key: string; name: string; points: number; sentence: string }

export type DifficultyLinesInput = {
  /** The rated scales with their sentences, in the criteria's order (`GcDifficultyStanding.sentences`). */
  scales: readonly DifficultyRatedScale[]
  price: DifficultyPriceList
  /** The bid's field hours (the labor rows' hours added up) and its labor rate. */
  fieldHours: number
  laborRate: number
  /** The bid's own cost before difficulty, which the cap is a percent of. */
  ownCost: number
  /** What the paying point carries: the bid's price when it has one, else its own cost. */
  carried: number
  /** The GC's median days to pay when it was read from the bills; null for a by-hand point or no read. */
  payingMedianDays: number | null
  /** The paying pick's words from the rating (`pick_reasons.paying`), for the line's sentence. */
  payingReason: string | null
}

export type DifficultyLine = {
  key: string
  name: string
  points: number
  /** Hours on the line; 0 for the paying line, which is money and not time. */
  hours: number
  rate: number
  amount: number
  /** The rung's sentence from the rating. */
  sentence: string
  /** The arithmetic in words: "10% of 480 field hours at $80". */
  words: string
}

export type DifficultyLines = {
  lines: DifficultyLine[]
  /** The lines' amounts added up, after the cap. */
  total: number
  points: number
  /** When the cap bit: what the lines came to before it and the cap they were held to. */
  capped: { before: number; cap: number } | null
  /** Scales the price list has no rule for, or whose rule prices to nothing. */
  skipped: { key: string; name: string; why: string }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const moneyShort = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000).toLocaleString('en-US')}k` : money(n))
const pctWords = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`
const hoursWords = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} field hour${n === 1 ? '' : 's'}`

/** The days the paying point carries: the median past the threshold when read, else one threshold's worth by hand. */
export function difficultyPayingDays(price: DifficultyPriceList, medianDays: number | null): number {
  if (medianDays == null) return price.payingDaysPast
  return Math.max(0, medianDays - price.payingDaysPast)
}

export function difficultyLines(input: DifficultyLinesInput): DifficultyLines {
  const { price } = input
  const lines: DifficultyLine[] = []
  let payingSource = ''
  const skipped: DifficultyLines['skipped'] = []
  let points = 0
  for (const s of input.scales) {
    if (s.points <= 0) continue
    points += s.points
    if (s.key === 'field' || s.key === 'site') {
      const pctPerPoint = s.key === 'field' ? price.fieldPctPerPoint : price.sitePctPerPoint
      const pct = pctPerPoint * s.points
      const hours = round2((pct / 100) * input.fieldHours)
      const amount = round2(hours * input.laborRate)
      if (amount <= 0) {
        skipped.push({ key: s.key, name: s.name, why: input.fieldHours <= 0 ? 'the bid has no field hours yet' : pct <= 0 ? 'the price list gives it no percent' : 'the bid has no labor rate' })
        continue
      }
      lines.push({ key: s.key, name: s.name, points: s.points, hours, rate: input.laborRate, amount, sentence: s.sentence, words: `${pctWords(pct)} of ${hoursWords(input.fieldHours)} at ${money(input.laborRate)}` })
      continue
    }
    if (s.key === 'office') {
      const hours = round2(price.officeHoursPerPoint * s.points)
      const amount = round2(hours * price.officeRate)
      if (amount <= 0) {
        skipped.push({ key: s.key, name: s.name, why: 'the price list gives an office point no hours or no rate' })
        continue
      }
      lines.push({ key: s.key, name: s.name, points: s.points, hours, rate: price.officeRate, amount, sentence: s.sentence, words: `${Number.isInteger(hours) ? hours : hours.toFixed(1)} office hours at ${money(price.officeRate)}` })
      continue
    }
    if (s.key === DIFFICULTY_PAYING_KEY) {
      const days = difficultyPayingDays(price, input.payingMedianDays)
      const amount = round2(s.points * input.carried * (price.payingMonthlyRate / 100) * (days / 30))
      if (amount <= 0) {
        skipped.push({ key: s.key, name: s.name, why: input.carried <= 0 ? 'the bid has nothing to carry yet' : days <= 0 ? `their median is not past ${price.payingDaysPast} days` : 'the price list gives it no monthly rate' })
        continue
      }
      const byHand = difficultyPayingByHandOf(input.payingReason)
      const source = byHand != null ? `Set by hand: ${byHand}` : input.payingMedianDays != null ? 'Read from their bills.' : ''
      // The source is said after the arithmetic, and after the cap's words when the cap bit (see below).
      if (source) payingSource = source
      const words = `carrying ${moneyShort(input.carried)} for ${days} day${days === 1 ? '' : 's'} past ${price.payingDaysPast}, at ${pctWords(price.payingMonthlyRate)} a month`
      lines.push({ key: s.key, name: s.name, points: s.points, hours: 0, rate: 0, amount, sentence: s.sentence, words })
      continue
    }
    skipped.push({ key: s.key, name: s.name, why: 'the price list has no rule for it' })
  }
  const before = round2(lines.reduce((n, l) => n + l.amount, 0))
  const cap = round2((price.capPct / 100) * input.ownCost)
  let capped: DifficultyLines['capped'] = null
  if (lines.length > 0 && input.ownCost > 0 && before > cap) {
    const share = cap / before
    for (const l of lines) {
      l.amount = round2(l.amount * share)
      l.hours = round2(l.hours * share)
      // The words are the arithmetic before the cap, so they say what the cap left (the walks of PR 4 read a line
      // whose words and dollars disagreed).
      l.words = `${l.words}, held to ${money(l.amount)} by the cap`
    }
    capped = { before, cap }
  }
  // Where a point came from closes the paying line: on the Workbench the cap's words once landed in the middle of a
  // reason set by hand ("…on another system, held to $113 by the cap: They pay slow.").
  if (payingSource) for (const l of lines) if (l.key === DIFFICULTY_PAYING_KEY) l.words = `${l.words}. ${payingSource}`
  const total = round2(lines.reduce((n, l) => n + l.amount, 0))
  return { lines, total, points, capped, skipped }
}

/** The Workbench strip's chip: "Difficulty · 4 points · +$6,420 in cost". */
export function difficultyStripWords(d: Pick<DifficultyLines, 'points' | 'total'>): string {
  return `Difficulty · ${d.points} point${d.points === 1 ? '' : 's'} · +${money(d.total)} in cost`
}

/** "about +$9,170 on the price at 30%". */
export function difficultyOnPriceWords(total: number, marginPct: number | null): string | null {
  if (marginPct == null || marginPct >= 100 || marginPct < 0) return null
  const onPrice = total / (1 - marginPct / 100)
  return `about +${money(onPrice)} on the price at ${Number.isInteger(marginPct) ? marginPct : marginPct.toFixed(1)}%`
}

/** One line of the fold: "Field 2 · $3,840 · 10% of 480 field hours at $80: The order of work changes after we mobilize." */
export function difficultyLineWords(l: DifficultyLine): string {
  // The sentence stands as the criteria wrote it: lowering its first letter turned a name into *zZ walk…*.
  const sentence = l.sentence.trim()
  const tail = sentence ? `: ${sentence}` : ''
  return `${l.name} ${l.points} · ${money(l.amount)} · ${l.words}${tail}`
}

/** The cap's line when it bit. */
export function difficultyCapWords(d: DifficultyLines): string | null {
  if (!d.capped) return null
  return `The lines came to ${money(d.capped.before)}; the price list holds them to ${money(d.capped.cap)}, ${pctWords(d.capped.cap > 0 ? Math.round((d.capped.cap / d.capped.before) * 1000) / 10 : 0)} of that, so each shrank by the same share.`
}

/** The description a direct-cost row carries: the line's name, points and arithmetic, so the Labor tab reads it alone. */
export function difficultyRowDescription(l: DifficultyLine): string {
  return `Difficulty · ${l.name} ${l.points} · ${l.words}`
}

/** A skipped scale's line: "Paying adds nothing: the bid has nothing to carry yet." */
export function difficultySkippedWords(s: DifficultyLines['skipped'][number]): string {
  return `${s.name} adds nothing: ${s.why}.`
}

/** The lines as `bid_difficulty.lines` holds them. */
export type DifficultyLineStored = Pick<DifficultyLine, 'key' | 'name' | 'points' | 'hours' | 'rate' | 'amount' | 'sentence' | 'words'>

export function difficultyLinesToStore(d: DifficultyLines): DifficultyLineStored[] {
  return d.lines.map(({ key, name, points, hours, rate, amount, sentence, words }) => ({ key, name, points, hours, rate, amount, sentence, words }))
}
