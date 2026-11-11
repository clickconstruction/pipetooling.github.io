/**
 * Which supply house a price sheet is from (punch list #308, PR 4), and what a sheet says about
 * itself at its head: its number, its day and how long it is good for.
 *
 * A price filed under the wrong house is the worst thing the reader can do, so the house is named
 * with its reasons and asked whenever the reasons disagree or only a weak one is there. Pure.
 */
import { nameTokens } from '../bills/billMatch'

export type House = { id: string; name: string }

/** The house whose name the head of the sheet prints, when exactly one house on file fits. */
export function letterheadHouse(text: string, houses: House[]): { houseId: string | null; printed: string | null } {
  const head = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('\f')).slice(0, 14)
  const words = new Set(nameTokens(head.join(' ')))
  let best: { house: House; tokens: number } | null = null
  let tie = false
  for (const h of houses) {
    const tokens = nameTokens(h.name)
    if (tokens.length === 0 || !tokens.every((t) => words.has(t))) continue
    if (!best || tokens.length > best.tokens) {
      best = { house: h, tokens: tokens.length }
      tie = false
    } else if (tokens.length === best.tokens) tie = true
  }
  if (!best || tie) return { houseId: null, printed: null }
  // The line of the head that carries the name, as printed.
  const first = nameTokens(best.house.name)[0]!
  const printed = head.find((l) => nameTokens(l).includes(first))?.trim().replace(/\s{2,}.*/, '') ?? best.house.name
  return { houseId: best.house.id, printed }
}

export type HouseVerdict = {
  /** The house to file under, or null when a person must say. */
  houseId: string | null
  /** Every reason agrees and at least one is strong: no question is asked. */
  sure: boolean
  /** Why, as the window shows it, the most trusted first. */
  reasons: string[]
  /** The question, when the house is not sure. */
  question: string | null
  /** The houses offered as answers, the likeliest first. */
  offers: string[]
}

export type HouseEvidence = {
  houses: House[]
  /** The house whose price request this sheet answers, when it was opened from that request. */
  requestHouseId?: string | null
  /**
   * The house the letterhead names, with the words as printed; null when the read found none. Left out when the
   * sheet was not read just now (opened again later): the words are gone, so nothing is said of the letterhead.
   */
  letterhead?: { houseId: string | null; printed: string | null } | null
  /** The houses this bid asked for prices. */
  askedHouseIds?: string[]
  /** The house most of the sheet's item numbers belong to, with the counts. */
  codeShare?: { houseId: string; known: number; total: number } | null
  /** The house of the contact the mail came from. */
  mailHouseId?: string | null
}

export function houseVerdict(e: HouseEvidence): HouseVerdict {
  const name = (id: string | null | undefined) => e.houses.find((h) => h.id === id)?.name ?? 'a supply house'
  const asked = e.askedHouseIds ?? []
  const letter = e.letterhead?.houseId ?? null
  const share = e.codeShare && e.codeShare.known >= 3 && e.codeShare.known * 2 >= e.codeShare.total ? e.codeShare : null

  const votes: { houseId: string; reason: string; strong: boolean }[] = []
  if (e.requestHouseId) votes.push({ houseId: e.requestHouseId, reason: `It answers the price request sent to ${name(e.requestHouseId)}`, strong: true })
  if (letter) votes.push({ houseId: letter, reason: `Letterhead reads ${e.letterhead?.printed ?? name(letter)}`, strong: true })
  if (share) votes.push({ houseId: share.houseId, reason: `${share.known} of its ${share.total} item numbers are ${name(share.houseId)}'s on file`, strong: false })
  if (e.mailHouseId) votes.push({ houseId: e.mailHouseId, reason: `Came by mail from a ${name(e.mailHouseId)} contact`, strong: false })

  const picked = [...new Set(votes.map((v) => v.houseId))]
  const offers = [...new Set([...picked, ...asked])]

  if (picked.length === 0) {
    const hint = asked.length === 1 ? ` This bid asked ${name(asked[0])} for prices.` : ''
    const read = e.letterhead !== undefined ? ' Nothing on it names one.' : ''
    return { houseId: null, sure: false, reasons: [], question: `Which house is this sheet from?${read}${hint}`, offers }
  }
  if (picked.length > 1) {
    return { houseId: null, sure: false, reasons: votes.map((v) => v.reason), question: `Which house is this sheet from? ${votes.map((v) => `${v.reason}.`).join(' ')}`, offers }
  }
  const houseId = picked[0]!
  const reasons = votes.map((v) => v.reason)
  if (asked.includes(houseId) && !e.requestHouseId) reasons.push(`This bid asked ${name(houseId)} for prices`)
  // The bid asked other houses and not this one: the letterhead may still be right, so it asks once.
  if (asked.length > 0 && !asked.includes(houseId) && !e.requestHouseId) {
    return {
      houseId: null,
      sure: false,
      reasons,
      question: `Which house is this sheet from? ${reasons[0]}. This bid's price ${asked.length === 1 ? 'request went' : 'requests went'} to ${asked.map(name).join(' and ')}.`,
      offers,
    }
  }
  if (!votes.some((v) => v.strong)) {
    return { houseId: null, sure: false, reasons, question: `Is this sheet from ${name(houseId)}? ${reasons[0]}.`, offers }
  }
  return { houseId, sure: true, reasons, question: null, offers }
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** A date as printed, as YYYY-MM-DD: 11/6/2026, 11/06/26, Nov 6, 2026, 2026-11-06. */
export function printedDay(text: string): string | null {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/.exec(text)
  if (us && Number(us[1]) >= 1 && Number(us[1]) <= 12 && Number(us[2]) >= 1 && Number(us[2]) <= 31) {
    const y = us[3]!.length === 2 ? 2000 + Number(us[3]) : Number(us[3])
    return `${y}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`
  }
  const words = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text)
  if (words) return `${words[3]}-${pad(MONTH_NAMES.indexOf(words[1]!.toLowerCase()) + 1)}-${pad(Number(words[2]))}`
  return null
}

export type SheetHeader = { number: string; datedOn: string | null; validUntil: string | null }

/** What the head of a sheet says of itself. Anything it does not print stays empty for a person to fill. */
export function sheetHeader(text: string): SheetHeader {
  const head = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('\f')).slice(0, 30)
  let number = ''
  let datedOn: string | null = null
  let validUntil: string | null = null
  for (const line of head) {
    if (!number) {
      const m = /\b(?:quot(?:e|ation)|estimate)\s*(?:no\.?|number|num\.?|#)?\s*[:#]?\s*([A-Z]{0,3}-?\d[\w-]{2,})/i.exec(line)
      if (m) number = m[1]!
    }
    const expires = /\b(?:valid|good|expir\w*)\b[^0-9A-Za-z]*(?:until|thru|through|date|on)?\b(.*)$/i.exec(line)
    if (expires && !validUntil) validUntil = printedDay(expires[1] ?? '')
    if (!datedOn && !expires) datedOn = printedDay(line)
  }
  return { number, datedOn, validUntil }
}
