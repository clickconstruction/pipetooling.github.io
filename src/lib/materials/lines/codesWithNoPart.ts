/**
 * Supply house bill lines, Codes with no part (punch list #298 PR 2a, v2.7121; frames D and E of the card's
 * mock-up). Pure. A house prints its own code for a part on every line. The parts book learns a house's code once
 * (`supply_part_codes`, the crosswalk of punch list #308), and from then every past and future line with that code
 * is that part. This file lists the codes the book does not know yet, **the most dollars first**, so the first hour
 * of matching covers the most money, and offers a part for each where the book has one that fits.
 *
 * How a code is offered a part, in the matcher's own order (`matchRow` in `partMatch.ts`): by the manufacturer's
 * number in the line, by the same name, by the words where every size agrees. Nothing is written without a press.
 * One press may take every code whose offer is sure (a manufacturer's number, or the same name); an offer by words
 * alone waits for a person's look.
 */
import { foldCode, indexBook, indexHouseCodes, matchRow, type BookPart, type HouseCode, type MatchHow } from '../partMatch'
import type { CodeTeach, PurchaseLine } from './whatWeBuy'

export interface NoPartCode {
  /** The house and the folded code. */
  key: string
  houseId: string
  houseName: string
  /** The code as the newest line prints it. */
  code: string
  /** The newest line's words, and its manufacturer's number when it prints one. */
  description: string
  mfrNumber: string
  bills: number
  quantity: number
  unit: string
  spendCents: number
  /** The newest day it was bought, YYYY-MM-DD. */
  lastDay: string
  /** The newest line, kept on the crosswalk as where the code was taught. */
  lineId: string
  /** The one part the book offers, and how it was found; null when none fits or two or more do. */
  offer: { part: BookPart; how: Extract<MatchHow, 'model_number' | 'same_name' | 'words'> } | null
  /** The parts that fit when two or more do, for a person to pick from. */
  rivals: BookPart[]
}

/** A line as this list reads it: a purchase line, with the manufacturer's number where the paper printed one. */
export type CodeLine = PurchaseLine

/** The codes with no part, the most spent first. A charge, a line with no code, and a code already taught are left out. */
export function codesWithNoPart(args: { lines: readonly CodeLine[]; teaches: readonly CodeTeach[]; book: readonly BookPart[]; houseNames: ReadonlyMap<string, string> }): NoPartCode[] {
  const taught = new Set(args.teaches.map((t) => `${t.houseId}|${t.codeKey}`))
  type Acc = { key: string; houseId: string; code: string; description: string; mfr: Map<string, number>; bills: Set<string>; quantity: number; units: Map<string, number>; spendCents: number; lastDay: string; lineId: string }
  const accs = new Map<string, Acc>()
  for (const line of args.lines) {
    if (line.lineKind === 'charge' || line.partId || !line.houseId) continue
    const codeKey = foldCode(line.houseCode)
    if (!codeKey) continue
    const key = `${line.houseId}|${codeKey}`
    if (taught.has(key)) continue
    const day = line.datedOn ?? ''
    let acc = accs.get(key)
    if (!acc) {
      acc = { key, houseId: line.houseId, code: line.houseCode.trim(), description: line.description.trim(), mfr: new Map(), bills: new Set(), quantity: 0, units: new Map(), spendCents: 0, lastDay: day, lineId: line.id }
      accs.set(key, acc)
    }
    acc.bills.add(line.invoiceId)
    acc.quantity += line.quantity ?? 0
    acc.spendCents += line.extendedCents ?? 0
    const unit = line.unit.trim().toUpperCase()
    if (unit) acc.units.set(unit, (acc.units.get(unit) ?? 0) + 1)
    const mfr = (line.mfrNumber ?? '').trim()
    if (mfr) acc.mfr.set(mfr, (acc.mfr.get(mfr) ?? 0) + 1)
    if (day >= acc.lastDay) {
      acc.lastDay = day
      acc.lineId = line.id
      acc.code = line.houseCode.trim()
      if (line.description.trim()) acc.description = line.description.trim()
    }
  }

  const book = indexBook([...args.book])
  const codes = indexHouseCodes(args.teaches.map((t): HouseCode => ({ supplyHouseId: t.houseId, code: t.codeKey, partId: t.partId, notAPart: t.notAPart, unitFactor: t.unitFactor })))
  const top = <K>(m: Map<K, number>): K | undefined => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const rows: NoPartCode[] = [...accs.values()].map((a) => {
    const mfrNumber = top(a.mfr) ?? ''
    const match = matchRow({ supplyHouseId: a.houseId, houseCode: a.code, mfrNumber, description: a.description }, book, codes)
    const offered = match.how === 'model_number' || match.how === 'same_name' || match.how === 'words'
    return {
      key: a.key,
      houseId: a.houseId,
      houseName: args.houseNames.get(a.houseId) || 'A supply house',
      code: a.code,
      description: a.description,
      mfrNumber,
      bills: a.bills.size,
      quantity: Math.round(a.quantity * 1000) / 1000,
      unit: top(a.units) ?? '',
      spendCents: a.spendCents,
      lastDay: a.lastDay,
      lineId: a.lineId,
      offer: offered && match.part ? { part: match.part, how: match.how as 'model_number' | 'same_name' | 'words' } : null,
      rivals: offered && !match.part ? match.rivals : [],
    }
  })
  rows.sort((x, y) => y.spendCents - x.spendCents || y.bills - x.bills || x.key.localeCompare(y.key))
  return rows
}

/** How an offer was found, in a few words. */
export const OFFER_HOW_WORDS: Readonly<Record<'model_number' | 'same_name' | 'words', string>> = {
  model_number: 'by its manufacturer’s number',
  same_name: 'by the same name',
  words: 'by its words',
}

/** Whether one press may take an offer with the rest: a manufacturer's number or the same name. An offer by words alone waits for a look. */
export function offerIsSure(row: Pick<NoPartCode, 'offer'>): boolean {
  return row.offer != null && row.offer.how !== 'words'
}

/** Where the list stands: how many codes, the dollars behind them, and what share the first `topN` cover. */
export function codesStanding(rows: readonly NoPartCode[], topN = 40): { codes: number; spendCents: number; topN: number; topShare: number } {
  const spendCents = rows.reduce((s, r) => s + Math.max(0, r.spendCents), 0)
  const n = Math.min(topN, rows.length)
  const top = rows.slice(0, n).reduce((s, r) => s + Math.max(0, r.spendCents), 0)
  return { codes: rows.length, spendCents, topN: n, topShare: spendCents > 0 ? top / spendCents : 0 }
}

/** *2,060 codes with no part · $412,300 behind them · the first 40 are 34% of it*. */
export function codesStandingWords(s: { codes: number; spendCents: number; topN: number; topShare: number }): string {
  const dollars = `$${Math.round(s.spendCents / 100).toLocaleString('en-US')}`
  const head = `${s.codes.toLocaleString('en-US')} ${s.codes === 1 ? 'code' : 'codes'} with no part · ${dollars} behind ${s.codes === 1 ? 'it' : 'them'}`
  return s.codes > s.topN && s.topN > 0 ? `${head} · the first ${s.topN} are ${Math.round(s.topShare * 100)}% of it` : head
}

/** The parts of the book that fit what a person typed, for *Pick a part*: every word typed is in the name. Eight at most. */
export function partsMatching(book: readonly BookPart[], typed: string): BookPart[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return book.filter((p) => words.every((w) => `${p.name} ${p.manufacturer ?? ''}`.toLowerCase().includes(w))).slice(0, 8)
}
