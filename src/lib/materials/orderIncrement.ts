/**
 * Sold in sticks (v2.3406): the minimum-order rule. Pipe comes in 20 ft
 * sticks, PEX in 100 ft coils, some fittings by the box; a takeoff that needs
 * 105 ft buys 120 ft. The rule lives on the part type, a part can override
 * it, and a takeoff line snapshots the effective value when the part is
 * picked (the `unit_price` pattern). Pure — the one reader of the
 * `order_increment` / `order_increment_unit` columns.
 */

export type OrderIncrementUnitKey = 'ft_stick' | 'ft_coil' | 'pack' | 'box' | 'bundle'

export const ORDER_INCREMENT_UNITS: ReadonlyArray<{ key: OrderIncrementUnitKey; label: string }> = [
  { key: 'ft_stick', label: 'ft sticks' },
  { key: 'ft_coil', label: 'ft coils' },
  { key: 'pack', label: 'per pack' },
  { key: 'box', label: 'per box' },
  { key: 'bundle', label: 'per bundle' },
]

export const DEFAULT_ORDER_INCREMENT_UNIT: OrderIncrementUnitKey = 'ft_stick'

export type OrderIncrement = { increment: number; unit: OrderIncrementUnitKey }

/** The two columns as any carrier (a part type row, a part row, a takeoff line) exposes them. */
export type OrderIncrementFields = { order_increment?: number | string | null; order_increment_unit?: string | null }

export function parseOrderIncrementUnit(raw: string | null | undefined): OrderIncrementUnitKey {
  return ORDER_INCREMENT_UNITS.some((u) => u.key === raw) ? (raw as OrderIncrementUnitKey) : DEFAULT_ORDER_INCREMENT_UNIT
}

/** A rule from its two columns; null when the increment is missing, zero or not a number. */
export function parseOrderIncrement(fields: OrderIncrementFields | null | undefined): OrderIncrement | null {
  const n = Number(fields?.order_increment)
  if (!Number.isFinite(n) || n <= 0) return null
  return { increment: n, unit: parseOrderIncrementUnit(fields?.order_increment_unit) }
}

/** What a typed box holds: a positive number, else null (blank = sold by the each). */
export function parseTypedOrderIncrement(text: string): number | null {
  const n = Number(text.replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The part's own rule first, else its type's; `source` says which, for the grey inherited hint. */
export function effectiveOrderIncrement(
  part: OrderIncrementFields | null | undefined,
  partType: OrderIncrementFields | null | undefined,
): { value: OrderIncrement | null; source: 'part' | 'type' | 'none' } {
  const own = parseOrderIncrement(part)
  if (own) return { value: own, source: 'part' }
  const inherited = parseOrderIncrement(partType)
  if (inherited) return { value: inherited, source: 'type' }
  return { value: null, source: 'none' }
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** `20 ft sticks` · `100 ft coils` · `box of 10` · `bundle of 5` — the sentence form. */
export function formatOrderIncrement(v: OrderIncrement): string {
  switch (v.unit) {
    case 'ft_stick':
      return `${num(v.increment)} ft sticks`
    case 'ft_coil':
      return `${num(v.increment)} ft coils`
    case 'pack':
      return `packs of ${num(v.increment)}`
    case 'box':
      return `boxes of ${num(v.increment)}`
    case 'bundle':
      return `bundles of ${num(v.increment)}`
  }
}

/** `sticks` · `coils` · `packs` · `boxes` · `bundles` — the plural pack word for a unit. */
export function orderIncrementPackWord(unit: OrderIncrementUnitKey): string {
  switch (unit) {
    case 'ft_stick':
      return 'sticks'
    case 'ft_coil':
      return 'coils'
    case 'pack':
      return 'packs'
    case 'box':
      return 'boxes'
    case 'bundle':
      return 'bundles'
  }
}

/** True for the two footage units; the rest count pieces. */
export function orderIncrementIsFeet(unit: OrderIncrementUnitKey): boolean {
  return unit === 'ft_stick' || unit === 'ft_coil'
}

/** `20 ft` · `100 ft coil` · `pack of 5` · `box of 10` — the chip on a takeoff line. */
export function orderIncrementChip(v: OrderIncrement): string {
  switch (v.unit) {
    case 'ft_stick':
      return `${num(v.increment)} ft`
    case 'ft_coil':
      return `${num(v.increment)} ft coil`
    case 'pack':
      return `pack of ${num(v.increment)}`
    case 'box':
      return `box of ${num(v.increment)}`
    case 'bundle':
      return `bundle of ${num(v.increment)}`
  }
}

/** The quantity actually bought: `needed` rounded up to a whole number of packs (105 → 120 at 20). Zero stays zero. */
export function roundUpToIncrement(needed: number, increment: number): number {
  if (!Number.isFinite(needed) || needed <= 0) return 0
  if (!Number.isFinite(increment) || increment <= 0) return needed
  // Guard float dust: 120.0000001 / 20 must read as 6 packs, not 7.
  const packs = Math.ceil(needed / increment - 1e-6)
  return packs * increment
}

/** How many packs that is: 120 at 20 → 6. */
export function packsFor(ordered: number, increment: number): number {
  if (!Number.isFinite(increment) || increment <= 0) return 0
  return Math.round(ordered / increment)
}
