/**
 * A price sheet as a digital twin hands it over (punch list #308, PR 9): the fixtures of a supply
 * house's quote with their rows, shaped and checked before anything is written. Pure, with no Deno
 * and no network, so the app's unit tests read it too (src/lib/materials/priceSheet/priceSheetRows.test.ts).
 *
 * The twin reads the quote's pages itself and reports every row as printed. It decides nothing about
 * the parts book: which part a row is, and whether its price is filed, stay a person's press.
 */

export type TwinSheetRow = {
  line_kind: 'part' | 'charge' | 'component'
  group_no: number | null
  group_tag: string
  group_label: string
  house_code: string
  mfr_number: string
  description: string
  qty: number | null
  unit_price: number | null
  pricing_unit: 'each' | 'per_hundred' | 'per_thousand'
  page_no: number | null
}

export type TwinSheetGroup = { group_no: number; tag: string; label: string; each_price: number | null }

export type TwinSheet = {
  number: string
  dated_on: string | null
  valid_until: string | null
  groups: TwinSheetGroup[]
  lines: TwinSheetRow[]
}

/** The most rows one sheet keeps: the database's own limit. */
export const TWIN_SHEET_MAX_ROWS = 800

const DAY = /^\d{4}-\d{2}-\d{2}$/
const CHARGE_WORDS = /^(?:misc(?:\.|ellaneous)?\s+charge|freight|shipping|delivery(?:\s+charge)?|fuel\s+surcharge|handling|restock(?:ing)?\s+fee)\b/i
const UNITS = new Set(['each', 'per_hundred', 'per_thousand'])

const text = (v: unknown, max: number): string => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max))
const day = (v: unknown): string | null => (DAY.test(String(v ?? '').trim()) ? String(v).trim() : null)

function money(v: unknown): number | null | undefined {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10000) / 10000 : undefined
}

/**
 * Shape a twin's sheet. `fixtures` are the quote's fixture headings, each with its rows; `loose` are
 * rows under no heading. Every problem is named with its place, and a sheet with any problem is not
 * written at all: a twin fixes its read and sends it whole.
 */
export function shapeTwinSheet(args: Record<string, unknown>): { ok: true; sheet: TwinSheet } | { ok: false; problems: string[] } {
  const problems: string[] = []
  const fixtures = Array.isArray(args.fixtures) ? (args.fixtures as Record<string, unknown>[]) : []
  const loose = Array.isArray(args.loose) ? (args.loose as Record<string, unknown>[]) : []
  const groups: TwinSheetGroup[] = []
  const lines: TwinSheetRow[] = []

  const row = (r: Record<string, unknown>, where: string, group: TwinSheetGroup | null): void => {
    const description = text(r.description, 400)
    if (!description) problems.push(`${where}: description is required, as printed`)
    const unit = r.pricing_unit == null || r.pricing_unit === '' ? 'each' : String(r.pricing_unit)
    if (!UNITS.has(unit)) problems.push(`${where}: pricing_unit "${unit}" is not each, per_hundred or per_thousand`)
    const price = money(r.unit_price)
    if (price === undefined) problems.push(`${where}: unit_price must be dollars as printed, zero or more, or left out for a row with no price of its own`)
    const qtyRaw = r.qty == null || r.qty === '' ? null : Number(r.qty)
    if (qtyRaw != null && (!Number.isFinite(qtyRaw) || qtyRaw < 0)) problems.push(`${where}: qty must be a number, zero or more`)
    const page = r.page == null || r.page === '' ? null : Math.round(Number(r.page))
    lines.push({
      // A charge by its words; a row under a fixture with no price of its own is a component of the fixture's bundle.
      line_kind: CHARGE_WORDS.test(description) ? 'charge' : group && price == null ? 'component' : 'part',
      group_no: group?.group_no ?? null,
      group_tag: group?.tag ?? '',
      group_label: group?.label ?? '',
      house_code: text(r.house_code, 60),
      mfr_number: text(r.mfr_number, 80),
      description,
      qty: qtyRaw != null && Number.isFinite(qtyRaw) ? qtyRaw : null,
      unit_price: price ?? null,
      pricing_unit: (UNITS.has(unit) ? unit : 'each') as TwinSheetRow['pricing_unit'],
      page_no: page != null && Number.isFinite(page) && page > 0 ? page : null,
    })
  }

  fixtures.forEach((f, i) => {
    const tag = text(f.tag, 60)
    const where = `fixture ${i + 1}${tag ? ` (${tag})` : ''}`
    if (!tag) problems.push(`${where}: tag is required, the fixture's tag as the quote prints it`)
    const each = money(f.each)
    if (each === undefined) problems.push(`${where}: each must be the printed Subtotal EACH in dollars, or left out when none is printed`)
    const group: TwinSheetGroup = { group_no: i + 1, tag, label: text(f.label, 200), each_price: each ?? null }
    groups.push(group)
    const rows = Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []
    if (rows.length === 0) problems.push(`${where}: rows is required, every row under the heading`)
    rows.forEach((r, j) => row(r, `${where} row ${j + 1}`, group))
  })
  loose.forEach((r, j) => row(r, `loose row ${j + 1}`, null))

  if (lines.length === 0) problems.push('a sheet needs at least one row: fixtures with their rows, or loose rows')
  if (lines.length > TWIN_SHEET_MAX_ROWS) problems.push(`a sheet keeps ${TWIN_SHEET_MAX_ROWS} rows at most; this one has ${lines.length}. Send it in two parts.`)
  if (args.dated_on != null && args.dated_on !== '' && !day(args.dated_on)) problems.push('dated_on must be YYYY-MM-DD, the day the quote prints')
  if (args.valid_until != null && args.valid_until !== '' && !day(args.valid_until)) problems.push('valid_until must be YYYY-MM-DD, the day the quote is good until')
  if (problems.length) return { ok: false, problems }
  return { ok: true, sheet: { number: text(args.number, 80), dated_on: day(args.dated_on), valid_until: day(args.valid_until), groups, lines } }
}

/** What the twin is told once the sheet is kept. */
export function twinSheetSaved(sheet: TwinSheet, houseName: string, replaced: boolean): Record<string, unknown> {
  const priced = sheet.lines.filter((l) => l.unit_price != null).length
  return {
    ok: true,
    house: houseName,
    fixtures: sheet.groups.length,
    rows: sheet.lines.length,
    rows_with_a_price: priced,
    charges: sheet.lines.filter((l) => l.line_kind === 'charge').length,
    replaced,
    filed: 0,
    next: 'Nothing is filed. The estimator opens the sheet on Bids → Takeoffs (Price sheet ▾) and presses. Next house, or finish_price_matrix.',
  }
}
