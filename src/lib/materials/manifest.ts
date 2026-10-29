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
  raw: string
}

const UNITS = ['EA', 'EACH', 'FT', 'LF', 'PC', 'PCS', 'BX', 'BOX', 'RL', 'ROLL', 'CS', 'CASE', 'BG', 'BAG', 'PR', 'ST', 'SET', 'CTN', 'PK']
const SKIP = /^(invoice|inv\b|date|ship|sold|bill|total|subtotal|sub-total|tax|freight|balance|terms|page|qty\b|quantity|description|amount|thank|remit|po\b|p\.o\.|order|account|customer|phone|fax|due)/i

function money(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s.replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * One invoice line → a quantity, a name and maybe a unit price. Accepts the shapes supply houses
 * print: "25 EA 3/4 COPPER 90 ELBOW 4.70 117.50", "3/4 COPPER 90 ELBOW 25 EA 4.70", "25 x Wax ring".
 * A line with no quantity, or a header, a total or an address line, is left out.
 */
export function parseInvoiceLine(raw: string): ParsedLine | null {
  const line = raw.replace(/\s+/g, ' ').trim()
  if (!line || SKIP.test(line)) return null
  const unitRe = UNITS.join('|')
  // quantity first: "25 EA name [price] [total]"
  // An address is not a line: a street suffix at the end, or a number too big to be a count with no unit after it.
  if (/\b(rd|st|dr|ave|blvd|ln|way|ct|pkwy|hwy|tx)\.?$/i.test(line)) return null
  let m = new RegExp(`^(\\d+(?:\\.\\d+)?)(?:\\s*[x×]\\s+|\\s+)(?:(${unitRe})\\s+)?(.+?)(?:\\s+\\$?(\\d[\\d,]*\\.\\d{2}))?(?:\\s+\\$?(\\d[\\d,]*\\.\\d{2}))?$`, 'i').exec(line)
  if (m) {
    const qty = Number(m[1])
    const name = (m[3] ?? '').replace(/\s+\$?\d[\d,]*\.\d{2}$/, '').trim()
    if (qty > 0 && (m[2] || qty <= 999) && name && !/^\d+(\.\d+)?$/.test(name)) return { quantity: qty, name, unit: m[2]?.toUpperCase() ?? null, unitPrice: money(m[4]), raw }
  }
  // name first: "name 25 EA [price] [total]"
  m = new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${unitRe})\\b(?:\\s+\\$?(\\d[\\d,]*\\.\\d{2}))?(?:\\s+\\$?(\\d[\\d,]*\\.\\d{2}))?$`, 'i').exec(line)
  if (m) {
    const qty = Number(m[2])
    const name = (m[1] ?? '').trim()
    if (qty > 0 && name) return { quantity: qty, name, unit: m[3]?.toUpperCase() ?? null, unitPrice: money(m[4]), raw }
  }
  return null
}

export function parseInvoiceText(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map(parseInvoiceLine)
    .filter((l): l is ParsedLine => l != null)
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
