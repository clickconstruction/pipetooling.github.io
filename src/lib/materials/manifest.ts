/**
 * The materials manifest (punch list #209): what was bought for a job, read off an invoice's text,
 * landed as Delivered rows with the invoice line as their source, and the three-way comparison the
 * owner asked for: bought, reported on site, left, and what walked away. The spike reads lines with
 * the rules below; the build sends the text to a model and keeps the same shape, reviewed once by
 * the office before anything lands, because a wrong manifest line becomes a false "walked away".
 */
import { containerLines, partKey, type Movement } from './onSite'

export type ParsedLine = {
  quantity: number
  name: string
  unit: string | null
  unitPrice: number | null
  /**
   * The one money figure on a line of more than one piece (v2.7250): the price of each, or the line's total? The
   * line does not say, so the reader takes neither and the office says which (`linePrice`).
   */
  loneFigure?: number | null
  raw: string
}

/** What the office said the one figure on a line is, for the whole paste: the price of each piece, or the line's total. */
export type LoneFigureIs = 'each' | 'total'

export const UNITS = ['EA', 'EACH', 'FT', 'LF', 'PC', 'PCS', 'BX', 'BOX', 'RL', 'ROLL', 'CS', 'CASE', 'BG', 'BAG', 'PR', 'ST', 'SET', 'CTN', 'PK']
const SKIP = /^(invoice|inv\b|date|ship|sold|bill|total|subtotal|sub-total|tax|freight|balance|terms|page|qty\b|quantity|description|amount|thank|remit|po\b|p\.o\.|order|account|customer|phone|fax|due)/i
/** A count: 25, 2.5, and 1,000 with its comma (a line of a thousand feet was dropped whole before v2.7250). */
const COUNT = '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)'
const MONEY = '\\$?(\\d[\\d,]*\\.\\d{2})'
/** A street address: a number, words with no digit in them, a street suffix. `10 2" PVC 90 ST` is a part, not a street. */
const STREET = /^\d+\s+[a-z .,'-]+\b(rd|st|dr|ave|blvd|ln|way|ct|pkwy|hwy|tx)\.?$/i
const CITY_ZIP = /\b[a-z]{2}\.?,?\s+\d{5}(-\d{4})?$/i

function count(s: string | undefined): number {
  return Number((s ?? '').replace(/,/g, ''))
}

/** A money figure off the line; a 0.00 is no figure, so a no-charge line never lands a price of nothing. */
function money(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s.replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The unit price off a line's figures. Two figures: the one that makes the other when multiplied by the count is
 * the unit price, whichever comes first, and when neither does (a discount moved the total) the first is, as
 * printed. One figure on a line of one piece is its price. One figure on a line of more is not read as either: a
 * line total taken for a unit price multiplied the money by the count.
 */
function priceOf(qty: number, first: number | null, second: number | null): Pick<ParsedLine, 'unitPrice' | 'loneFigure'> {
  if (first == null) return { unitPrice: null }
  if (second == null) return qty === 1 ? { unitPrice: first } : { unitPrice: null, loneFigure: first }
  const near = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.011, 0.005 * qty)
  if (near(first * qty, second)) return { unitPrice: first }
  if (near(second * qty, first)) return { unitPrice: second }
  return { unitPrice: first }
}

/** A line's unit price with the office's answer in it: the price read, or the one figure as each or as the line's total. */
export function linePrice(line: Pick<ParsedLine, 'unitPrice' | 'loneFigure' | 'quantity'>, loneIs: LoneFigureIs | null): number | null {
  if (line.unitPrice != null) return line.unitPrice
  if (line.loneFigure == null || loneIs == null) return null
  if (loneIs === 'each') return line.loneFigure
  return line.quantity > 0 ? Math.round((line.loneFigure / line.quantity) * 10000) / 10000 : null
}

type LineRead = ParsedLine | 'skip' | 'not-read'

function readLine(raw: string): LineRead {
  const line = raw.replace(/\s+/g, ' ').trim()
  if (!line || SKIP.test(line)) return 'skip'
  const unitRe = UNITS.join('|')
  // quantity first: "25 EA name [price] [total]"
  let m = new RegExp(`^${COUNT}(\\s*[x×]\\s+|\\s+)(?:(${unitRe})\\s+)?(.+?)(?:\\s+${MONEY})?(?:\\s+${MONEY})?$`, 'i').exec(line)
  if (m) {
    const qty = count(m[1])
    const said = Boolean(m[3]) || /[x×]/i.test(m[2] ?? '')
    const name = (m[4] ?? '').replace(/\s+\$?\d[\d,]*\.\d{2}$/, '').trim()
    // With no unit and no × the count is a guess, so three things stop it. An address is not a line. A number too
    // big to be a count is a street number. And 1, 2 or 3 right before a fraction may be one size, `2 1/2"`.
    const guess = !said && (STREET.test(line) || /^[123]$/.test(m[1] ?? '') && /^\d+\/\d+/.test(name))
    const tooBig = !m[3] && qty > 999
    if (qty > 0 && !guess && !tooBig && name && !/^\d+(\.\d+)?$/.test(name)) return { quantity: qty, name, unit: m[3]?.toUpperCase() ?? null, ...priceOf(qty, money(m[5]), money(m[6])), raw }
  }
  // name first: "name 25 EA [price] [total]"
  m = new RegExp(`^(.+?)\\s+${COUNT}\\s*(${unitRe})\\b(?:\\s+${MONEY})?(?:\\s+${MONEY})?$`, 'i').exec(line)
  if (m) {
    const qty = count(m[2])
    const name = (m[1] ?? '').trim()
    if (qty > 0 && name) return { quantity: qty, name, unit: m[3]?.toUpperCase() ?? null, ...priceOf(qty, money(m[4]), money(m[5])), raw }
  }
  // Not a line of parts: an address, or words with no number in them, or numbers with no word.
  if (STREET.test(line) || CITY_ZIP.test(line) || !/\d/.test(line) || !/[a-z]{2}/i.test(line)) return 'skip'
  return 'not-read'
}

/**
 * One invoice line → a quantity, a name and maybe a unit price. Accepts the shapes supply houses
 * print: "25 EA 3/4 COPPER 90 ELBOW 4.70 117.50", "3/4 COPPER 90 ELBOW 25 EA 4.70", "25 x Wax ring".
 * A line with no quantity, or a header, a total or an address line, is left out.
 */
export function parseInvoiceLine(raw: string): ParsedLine | null {
  const read = readLine(raw)
  return typeof read === 'string' ? null : read
}

export function parseInvoiceText(text: string): ParsedLine[] {
  return readInvoiceText(text).lines
}

/**
 * The paste read whole (v2.7250): the lines, and the lines that hold a number and a word and still did not read,
 * as pasted. A line the reader dropped was dropped in silence, so a part that came on the truck was never on the
 * job and nobody knew to type it. Headers, totals, addresses and blank lines are not listed.
 */
export function readInvoiceText(text: string): { lines: ParsedLine[]; notRead: string[] } {
  const lines: ParsedLine[] = []
  const notRead: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const read = readLine(raw)
    if (read === 'not-read') notRead.push(raw.replace(/\s+/g, ' ').trim())
    else if (read !== 'skip') lines.push(read)
  }
  return { lines, notRead }
}

/** The lines a press lands: a count above zero and a name, the name trimmed. The button counts these and the press sends these, no others. */
export function landableLines(lines: ReadonlyArray<ParsedLine>): ParsedLine[] {
  return lines.filter((l) => l.quantity > 0 && l.name.trim()).map((l) => ({ ...l, name: l.name.trim().replace(/\s+/g, ' ') }))
}

/** What a job already holds from one invoice: its Delivered rows with that source, and the newest of them. Null when none, or when the source is no invoice's own. */
export function landedFromInvoice(movements: ReadonlyArray<Pick<Movement, 'reason' | 'source' | 'at'>>, invoiceNo: string): { lines: number; lastAt: string } | null {
  const want = invoiceNo.trim().toLowerCase()
  if (!want) return null
  let lines = 0
  let lastAt = ''
  for (const m of movements) {
    if (m.reason !== 'delivered' || (m.source ?? '').trim().toLowerCase() !== want) continue
    lines += 1
    if (m.at > lastAt) lastAt = m.at
  }
  return lines > 0 ? { lines, lastAt } : null
}

/** "Invoice 48812", "INV# 48812", "Invoice No. 48812" → "INV-48812"; null when nothing reads as one. */
export function invoiceNumber(text: string): string | null {
  const m = /\b(?:invoice|inv)\s*(?:no\.?|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{2,})/i.exec(text)
  return m ? `INV-${(m[1] ?? '').toUpperCase().replace(/^INV-?/, '')}` : null
}

export type ComparisonRow = {
  partKey: string
  partName: string
  manufacturer: string | null
  /** Delivered rows with a source: an invoice or a PO line. */
  bought: number
  /** Delivered rows with no source: a crew added it on site. */
  addedOnSite: number
  used: number
  returned: number
  /** Taken to the truck or the shop, or marked damaged. */
  takenOrDamaged: number
  cannotFind: number
  /** On hand across every container, as the ledger reads it. */
  left: number
  /** bought + added − used − returned − taken − left, floored at zero: what nobody can account for. */
  walkedAway: number
  money: number | null
  lastCountAt: string | null
}

/**
 * Per part across the job: what came in, what the crew reported, what is left, and the gap. The
 * gap is "since the last count" in spirit: a count resets what is left, so an uncounted box can
 * hide a gap and an honest count shows it.
 */
export function manifestComparison(movements: ReadonlyArray<Movement>, priceOf: (partKey: string) => number | null): ComparisonRow[] {
  const rows = new Map<string, ComparisonRow>()
  const get = (m: Movement): ComparisonRow => {
    const k = partKey(m.partId, m.partName)
    let r = rows.get(k)
    if (!r) {
      r = { partKey: k, partName: m.partName, manufacturer: m.manufacturer, bought: 0, addedOnSite: 0, used: 0, returned: 0, takenOrDamaged: 0, cannotFind: 0, left: 0, walkedAway: 0, money: null, lastCountAt: null }
      rows.set(k, r)
    }
    return r
  }
  for (const m of movements) {
    const r = get(m)
    switch (m.reason) {
      case 'delivered':
        if (m.source) r.bought += m.quantity
        else r.addedOnSite += m.quantity
        break
      case 'used':
        r.used += m.quantity
        break
      case 'returned':
        r.returned += m.quantity
        break
      case 'taken':
      case 'damaged':
        r.takenOrDamaged += m.quantity
        break
      case 'cannot_find':
        r.cannotFind += m.quantity
        break
      case 'counted':
        if (!r.lastCountAt || m.at > r.lastCountAt) r.lastCountAt = m.at
        break
      default:
        break
    }
  }
  for (const l of containerLines(movements)) {
    const r = rows.get(l.partKey)
    if (r && l.onHand > 0) r.left += l.onHand
  }
  for (const r of rows.values()) {
    r.walkedAway = Math.max(0, r.bought + r.addedOnSite - r.used - r.returned - r.takenOrDamaged - r.left)
    const price = priceOf(r.partKey)
    r.money = price != null && r.walkedAway > 0 ? Math.round(r.walkedAway * price * 100) / 100 : null
  }
  return [...rows.values()].sort((a, b) => b.walkedAway - a.walkedAway || a.partName.localeCompare(b.partName))
}

/** A made-up invoice, the shape a supply house prints, so the office can try the paste without typing. */
export const SAMPLE_INVOICE_TEXT = `PECAN SUPPLY CO
Invoice 48812          Date 10/24
Ship to: Oak Hollow Bldg C, 4410 Pecan Creek Rd

QTY   UNIT  DESCRIPTION                         PRICE     AMOUNT
25    EA    3/4" copper 90                       4.70     117.50
4     EA    3/4" ball valve                     18.60      74.40
30    EA    3/4" type L copper, 10 ft           31.20     936.00
40    EA    1/2" copper tee                      1.90      76.00
2     EA    50 gal gas water heater            184.00     368.00
12    EA    Wax ring                             2.10      25.20

SUBTOTAL                                                1597.10
TAX                                                      131.76
TOTAL                                                   1728.86`
