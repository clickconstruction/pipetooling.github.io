/**
 * One row as a card (punch list #308, PR 3): the part it is, how it was found, what the book holds
 * for that part at that house, and the one question the row raises, in words.
 *
 * The card is the unit of the price sheet reader. One price pasted or typed is one card; a sheet is
 * many. Pure: the window draws what this returns and files on the press it names.
 */
import type { BookPart, MatchHow, PartMatch } from '../partMatch'
import { bookPrice, PRICING_UNIT_FACTOR, type PastedRow } from './pastedRow'

/** A move past this share of the price on file waits for a person. */
export const BIG_MOVE_SHARE = 0.25

export type OnFilePrice = { price: number; effectiveDate: string | null }

export type RowCardInput = {
  row: Pick<PastedRow, 'houseCode' | 'description' | 'unitPrice' | 'pricingUnit' | 'lines'>
  houseName: string | null
  match: PartMatch
  /** The part's price at this house today, when a part is matched and a house is known. */
  onFile: OnFilePrice | null
  /** The paper's day, YYYY-MM-DD. */
  datedOn: string
}

export type RowCardStatus =
  /** Matched by the house's own number, nothing to ask. */
  | 'ready'
  /** Matched by the model number, the name or the words: one look, then file. */
  | 'offer'
  /** A question only a person answers: a big move, a unit, a newer price on file. */
  | 'ask'
  /** More than one part fits. */
  | 'pick'
  /** Nothing on file. */
  | 'new'
  | 'not_a_part'
  | 'no_house'
  | 'no_price'

export type RowCard = {
  status: RowCardStatus
  chip: { tone: 'green' | 'blue' | 'amber' | 'gray'; label: string }
  /** The sentence above the presses. */
  question: string
  /** The book price the main press files, each. */
  each: number | null
  /** The other reading of a price whose unit is in doubt: the printed figure taken as each. */
  eachAsPrinted: number | null
  /** What the book holds now: "$214.00 on file from Hillcrest Supply, Aug 12." */
  onFileLine: string | null
  /** The move against the price on file, as a share: 0.46 is up 46%. */
  move: number | null
  bigMove: boolean
  /** The price on file is dated after this paper. */
  older: boolean
  /** The printed price is by the hundred or the thousand and the house's number has not said so before. */
  unitAsk: boolean
  /** The description ran over this many printed lines. */
  ranOver: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 2026-08-12 as Aug 12, with the year when it is not the paper's year. */
export function shortDay(ymd: string | null | undefined, thisYear?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  const day = `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`
  return thisYear && m[1] !== thisYear ? `${day}, ${m[1]}` : day
}

export function dollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const HOW_CHIP: Record<Exclude<MatchHow, 'none' | 'not_a_part'>, string> = {
  house_number: 'Same house number',
  model_number: 'Same model number',
  same_name: 'Same name',
  words: 'Same words',
}

function howChip(how: MatchHow, houseName: string | null): string {
  if (how === 'house_number') return houseName ? `Same ${houseName} number` : HOW_CHIP.house_number
  return HOW_CHIP[how as keyof typeof HOW_CHIP] ?? ''
}

function rivalsQuestion(match: PartMatch<BookPart>): string {
  const n = match.rivals.length
  const count = n === 2 ? 'Two parts' : `${n} parts`
  if (match.how === 'model_number') return `${count} in the book carry this model number. Which one is it?`
  if (match.how === 'same_name') return `${count} in the book have this name. Which one is it?`
  return `${count} in the book say the same words. Which one is it?`
}

const UNIT_WORDS = { each: 'each', per_hundred: 'by the hundred', per_thousand: 'by the thousand' } as const

export function rowCard(input: RowCardInput): RowCard {
  const { row, houseName, match, onFile, datedOn } = input
  const base = { each: null, eachAsPrinted: null, onFileLine: null, move: null, bigMove: false, older: false, unitAsk: false, ranOver: row.lines > 1 ? row.lines : 0 }

  if (match.how === 'not_a_part') {
    return {
      ...base,
      status: 'not_a_part',
      chip: { tone: 'gray', label: 'Not a part' },
      question: `${houseName ?? 'This house'} uses ${row.houseCode} for anything it does not stock, so it is never matched to a part.`,
    }
  }
  if (match.how === 'none') {
    return { ...base, status: 'new', chip: { tone: 'amber', label: 'Nothing on file' }, question: 'No part has this number, this model number or these words.' }
  }
  if (!match.part) {
    return { ...base, status: 'pick', chip: { tone: 'amber', label: match.rivals.length === 2 ? 'Two parts on file' : `${match.rivals.length} parts on file` }, question: rivalsQuestion(match) }
  }
  if (!houseName) {
    return { ...base, status: 'no_house', chip: { tone: 'amber', label: 'Which house?' }, question: 'Say which supply house this price is from.' }
  }
  if (row.unitPrice == null) {
    return { ...base, status: 'no_price', chip: { tone: match.how === 'house_number' ? 'green' : 'blue', label: howChip(match.how, houseName) }, question: 'This row has no price of its own.' }
  }

  // The house's number remembers its unit; a number met for the first time takes the unit the paper prints.
  // A factor of one kept by hand says nothing of units, so a paper that prints by the hundred still asks.
  const stored = match.how === 'house_number' ? (match.unitFactor ?? 1) : null
  const known = stored != null && (stored !== 1 || row.pricingUnit === 'each')
  const factor = known ? stored! : PRICING_UNIT_FACTOR[row.pricingUnit]
  const each = bookPrice(row.unitPrice, factor)
  const unitAsk = !known && row.pricingUnit !== 'each'
  const eachAsPrinted = unitAsk ? bookPrice(row.unitPrice, 1) : null

  const year = datedOn.slice(0, 4)
  const onFileLine = onFile ? `${dollars(onFile.price)} on file from ${houseName}${onFile.effectiveDate ? `, ${shortDay(onFile.effectiveDate, year)}` : ''}.` : null
  const move = onFile && onFile.price > 0 ? (each - onFile.price) / onFile.price : null
  const bigMove = move != null && Math.abs(move) > BIG_MOVE_SHARE
  const older = onFile?.effectiveDate != null && onFile.effectiveDate > datedOn
  const common = { ...base, each, eachAsPrinted, onFileLine, move, bigMove, older, unitAsk }

  if (older) {
    return {
      ...common,
      status: 'ask',
      chip: { tone: 'gray', label: 'A newer price is on file' },
      question: `The price on file is newer: ${dollars(onFile!.price)} from ${shortDay(onFile!.effectiveDate, year)}. This paper is dated ${shortDay(datedOn)}. It is kept unless you say so.`,
    }
  }
  if (unitAsk) {
    return { ...common, status: 'ask', chip: { tone: 'amber', label: 'Unit differs' }, question: `${houseName} prices this ${UNIT_WORDS[row.pricingUnit]}. The book prices it each.` }
  }
  if (bigMove) {
    const pct = Math.round(Math.abs(move!) * 100)
    return {
      ...common,
      status: 'ask',
      chip: { tone: 'amber', label: 'Price moved a lot' },
      question: `${onFileLine} This paper says ${dollars(each)}. That is ${move! > 0 ? 'up' : 'down'} ${pct}%.`,
    }
  }
  if (match.how === 'house_number') {
    return { ...common, status: 'ready', chip: { tone: 'green', label: howChip(match.how, houseName) }, question: onFileLine ?? `${houseName} has no price on file for this part yet.` }
  }
  const offer =
    match.how === 'model_number'
      ? `The model number is on this part. ${houseName}'s number is new for it.`
      : match.how === 'same_name'
        ? 'A part in the book has this name.'
        : 'A part in the book says the same words, and its sizes agree.'
  return { ...common, status: 'offer', chip: { tone: 'blue', label: howChip(match.how, houseName) }, question: offer }
}

/** Where a filed price came from, as the Prices window says it. */
export type PriceSource = { cameBy: string; kind: string; number: string; validUntil: string | null; filedPrice: number | null; replacedPrice: number | null }

export function priceSourceWords(src: PriceSource | null, thisYear?: string): string {
  if (!src) return ''
  const number = src.number ? ` ${src.number}` : ''
  const from =
    src.cameBy === 'phone' ? 'By phone'
    : src.cameBy === 'counter' ? 'At the counter'
    : src.cameBy === 'mail' ? 'From a mail'
    : src.cameBy === 'website' ? 'From its website'
    : src.cameBy === 'pasted' ? `Pasted from a quote${number}`
    : src.cameBy === 'sheet' ? `Quote${number}`
    : `${src.kind === 'invoice' ? 'Bill' : src.kind === 'credit' ? 'Credit' : 'Paper'}${number}`
  const good = src.validUntil ? ` · good until ${shortDay(src.validUntil, thisYear)}` : ''
  const was = src.replacedPrice != null ? ` · was ${dollars(src.replacedPrice)}` : ''
  return `${from}${good}${was}`
}
