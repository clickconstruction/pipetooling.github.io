/**
 * A supply house's row, read from text with no model (punch list #308, PR 3).
 *
 * The text is whatever a person pasted (a line out of a mail, a fixture's block out of a quote) or a
 * PDF's own text layer. A row is a quantity, the house's item number, the words and a price, any of
 * which may be missing. A quote groups its rows under a fixture's heading and closes the group with a
 * `Subtotal … EACH` line; a row inside a group often carries no price of its own.
 *
 * Pure. The reader of scans and photos (PR 4) returns the same shapes.
 */

export type PricingUnit = 'each' | 'per_hundred' | 'per_thousand'

export type PastedRow = {
  qty: number | null
  /** The house's own item number, when the row opens with one. */
  houseCode: string
  description: string
  /** The unit price as printed, before the pricing unit is applied. Null on a kit row. */
  unitPrice: number | null
  pricingUnit: PricingUnit
  extended: number | null
  /** How many printed lines the row took. More than one means a description that ran on. */
  lines: number
}

export type PastedGroup = {
  /** The fixture's tag: SK-2, WC-1 & WC-2. */
  tag: string
  /** The words after the tag: DUMP SINK (BAR) (OFCI). */
  label: string
  /** The group's EACH subtotal, when the paper prints one. */
  each: number | null
  rows: PastedRow[]
}

export type PastedSheet = { groups: PastedGroup[]; loose: PastedRow[] }

/** How many of the book's units one printed price covers. */
export const PRICING_UNIT_FACTOR: Record<PricingUnit, number> = { each: 1, per_hundred: 100, per_thousand: 1000 }

const QTY_UNIT = '(?:ea|each|pc|pcs|ft|lf|bx|box|pk|pkg|pr|set|rl|roll)'
const GLUED_QTY = new RegExp(`^(\\d+(?:\\.\\d+)?)${QTY_UNIT}\\.?$`, 'i')
const QTY_UNIT_WORD = new RegExp(`^${QTY_UNIT}\\.?$`, 'i')
const HOUSE_CODE = /^\d{4,9}$/
const MONEY = /^\$?(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2,4})$/
const MONEY_WITH_UNIT = /^\$?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2,4})\/?(ea|each|e|c|m)$/i
const UNIT_SUFFIX = /^\/?(ea|each|e|c|m)\.?$/i

const RULE_LINE = /^[\s*=_.\-–—]{5,}$/
const HEADER_LINE = /\b(?:order\s+qty|item\s+no|unit\s+price|description\s+unit|page\s+\d+\s+of\s+\d+)\b/i
const SUBTOTAL_LINE = /^sub\s*-?\s*total\b/i
const TAG = /^([A-Z]{1,5}-?\d{1,3}[A-Z]?(?:\s*(?:&|\/|,)\s*[A-Z]{0,5}-?\d{1,3}[A-Z]?)*)\s+(\S.*)$/

function money(token: string): number | null {
  const m = MONEY.exec(token)
  return m ? Number(`${m[1]!.replace(/,/g, '')}.${m[2]}`) : null
}

function unitOf(word: string | undefined): PricingUnit {
  const w = (word ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return w === 'c' ? 'per_hundred' : w === 'm' ? 'per_thousand' : 'each'
}

/** One printed line as a row, or null when the line is not one (a heading, a rule, a line of words only). */
export function parsePastedRow(line: string): PastedRow | null {
  const tokens = line.replace(/\t/g, '  ').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  // The quantity: 1ea, or 2 EA, or a small number ahead of the house's item number.
  let qty: number | null = null
  let at = 0
  const glued = GLUED_QTY.exec(tokens[0]!)
  if (glued) {
    qty = Number(glued[1])
    at = 1
  } else if (/^\d{1,4}(?:\.\d+)?$/.test(tokens[0]!) && tokens[1] && QTY_UNIT_WORD.test(tokens[1])) {
    qty = Number(tokens[0])
    at = 2
  } else if (/^\d{1,3}$/.test(tokens[0]!) && tokens[1] && HOUSE_CODE.test(tokens[1])) {
    qty = Number(tokens[0])
    at = 1
  }

  let houseCode = ''
  if (tokens[at] && HOUSE_CODE.test(tokens[at]!)) {
    houseCode = tokens[at]!
    at += 1
  }

  // The price, from the right: a unit word, then one money figure or two (the unit price and the extension).
  let end = tokens.length
  let pricingUnit: PricingUnit = 'each'
  const figures: number[] = []
  if (end > at && UNIT_SUFFIX.test(tokens[end - 1]!) && end - 2 >= at && money(tokens[end - 2]!) != null) {
    pricingUnit = unitOf(tokens[end - 1])
    end -= 1
  }
  while (end > at && figures.length < 2) {
    const token = tokens[end - 1]!
    const withUnit = MONEY_WITH_UNIT.exec(token)
    const value = withUnit ? money(withUnit[1]!) : money(token)
    if (value == null) break
    if (withUnit) pricingUnit = unitOf(withUnit[2])
    figures.unshift(value)
    end -= 1
    // 18.40 EA 36.80: the unit word sits between the two figures.
    if (figures.length === 1 && end - 1 > at && UNIT_SUFFIX.test(tokens[end - 1]!) && money(tokens[end - 2]!) != null) {
      pricingUnit = unitOf(tokens[end - 1])
      end -= 1
    }
  }
  let unitPrice: number | null = null
  let extended: number | null = null
  if (figures.length === 1) unitPrice = figures[0]!
  else if (figures.length === 2) {
    // Unit then extension when the second is the larger; a list and a net price when it is the smaller.
    if (figures[1]! >= figures[0]!) {
      unitPrice = figures[0]!
      extended = figures[1]!
    } else unitPrice = figures[1]!
  }

  const description = tokens.slice(at, end).join(' ')
  if (!description) return null
  if (qty == null && !houseCode && unitPrice == null) return null
  return { qty, houseCode, description, unitPrice, pricingUnit, extended, lines: 1 }
}

type Heading = { tag: string; label: string }

function parseHeading(line: string, afterBreak: boolean): Heading | null {
  const m = TAG.exec(line.trim())
  if (!m) return null
  // A size or a schedule can look like a tag (SCH40 PVC). A tag with a dash is a tag; one without needs a break above it.
  if (!m[1]!.includes('-') && !afterBreak) return null
  return { tag: m[1]!.replace(/\s+/g, ' '), label: m[2]!.trim() }
}

function parseSubtotal(line: string): { each: number | null } | null {
  if (!SUBTOTAL_LINE.test(line.trim())) return null
  const tokens = line.trim().split(/\s+/)
  const last = money(tokens[tokens.length - 1]!)
  return { each: last }
}

/** Pasted text, or a PDF's text layer, as fixture groups and loose rows. */
export function parsePasted(text: string): PastedSheet {
  const groups: PastedGroup[] = []
  const loose: PastedRow[] = []
  let group: PastedGroup | null = null
  let lastRow: PastedRow | null = null
  let afterBreak = true

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, '  ')
    if (!line.trim() || RULE_LINE.test(line)) {
      afterBreak = true
      lastRow = null
      continue
    }
    if (HEADER_LINE.test(line)) continue

    const subtotal = parseSubtotal(line)
    if (subtotal) {
      if (group) group.each = subtotal.each
      group = null
      lastRow = null
      afterBreak = true
      continue
    }

    const row = parsePastedRow(line)
    if (row) {
      ;(group ? group.rows : loose).push(row)
      lastRow = row
      afterBreak = false
      continue
    }

    const heading = parseHeading(line, afterBreak)
    // A tag with a dash is a heading wherever it stands; one without is a heading only when no row is running on.
    if (heading && (!lastRow || heading.tag.includes('-'))) {
      group = { tag: heading.tag, label: heading.label, each: null, rows: [] }
      groups.push(group)
      afterBreak = false
      continue
    }

    // Words with no quantity, number or price: the row above ran on to this line.
    if (lastRow) {
      lastRow.description = `${lastRow.description} ${line.trim().replace(/\s+/g, ' ')}`
      lastRow.lines += 1
      afterBreak = false
      continue
    }
    if (heading) {
      group = { tag: heading.tag, label: heading.label, each: null, rows: [] }
      groups.push(group)
    }
    afterBreak = false
  }
  return { groups: groups.filter((g) => g.rows.length > 0 || g.each != null), loose }
}

/** Every row of a pasted sheet, the grouped ones first in their order. */
export function allRows(sheet: PastedSheet): PastedRow[] {
  return [...sheet.groups.flatMap((g) => g.rows), ...sheet.loose]
}

/** A printed price as the book keeps it: each, to the cent. */
export function bookPrice(unitPrice: number, factor: number): number {
  return Math.round((unitPrice / factor) * 100) / 100
}
