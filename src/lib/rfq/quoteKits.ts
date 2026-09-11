/**
 * Kits and option groups for the supply-house compare (Price Matrix PR 1 —
 * docs/PRICE_MATRIX_PLAN.md). Pure; the compare kernel and the modal call it,
 * nothing here reads or writes anywhere.
 *
 * What a real fixture quote looks like (NWS S6277623, SpaceX BA-2, 2026-09-02):
 *
 *   WC-1 & WC-2 WATER CLOSET
 *     1ea  CT728CUVG#01 TOTO wall mount bowl          (no unit price)
 *     1ea  TET2LBi31#SS TOTO flush valve              (no unit price)
 *     1ea  SC534#01 TOTO seat                         (no unit price)
 *          SEE THE CARRIER AND DRAIN QUOTE FOR THE CARRIER PRICING
 *     Subtotal ------- WC-1 & WC-2 EACH               1010.00
 *
 *   …and on a second sheet, under "WC-1 & WC-2 (CARRIERS)", eight Josam
 *   carriers from $298.75 to $713.52. Under "RPZ-1", six Watts sizes whose
 *   printed "subtotal" ($42,135.09) is the SUM of the alternatives.
 *
 * So a house prices a fixture as a KIT: one `kit` subtotal line ($/each) plus
 * component lines that carry a role (bowl · seat · flush valve · carrier …)
 * and usually no price of their own, plus components priced separately (the
 * carrier). A fixture may also carry an OPTION GROUP — several lines that are
 * alternatives (sizes), exactly one of which is right for this bid.
 *
 * Honesty rules this kernel enforces:
 *   - A kit is COMPLETE only when every role any house quoted for that
 *     fixture is present and priced in this house's kit (or covered by its
 *     kit subtotal). A house that skipped the carrier is "incomplete", never
 *     cheapest. Callers may add roles a rule requires (`requiredRoles`).
 *   - An option group with no chosen option is "needs a choice": the cell
 *     shows the range and is never summed and never best.
 *   - A plain single line (today's quotes) aggregates to itself — nothing
 *     about the existing compare changes for quotes with no roles.
 */

/** Roles a quote line can play inside a fixture's kit. `kit` is the subtotal line; `loose` is a part that belongs to no fixture. */
export const COMPONENT_ROLES = [
  'kit',
  'bowl',
  'seat',
  'flush_valve',
  'carrier',
  'faucet',
  'drain',
  'trap',
  'supply',
  'stops',
  'trim',
  'mixing_valve',
  'accessory',
  'freight',
  'loose',
] as const

export type ComponentRole = (typeof COMPONENT_ROLES)[number]

export const COMPONENT_ROLE_LABELS: Record<ComponentRole, string> = {
  kit: 'kit',
  bowl: 'bowl',
  seat: 'seat',
  flush_valve: 'flush valve',
  carrier: 'carrier',
  faucet: 'faucet',
  drain: 'drain',
  trap: 'trap',
  supply: 'supply',
  stops: 'stops',
  trim: 'trim',
  mixing_valve: 'mixing valve',
  accessory: 'accessory',
  freight: 'freight',
  loose: 'loose part',
}

export function isComponentRole(v: unknown): v is ComponentRole {
  return typeof v === 'string' && (COMPONENT_ROLES as ReadonlyArray<string>).includes(v)
}

/** Roles that do not make a kit incomplete when another house has them — they ride the kit subtotal or are order-level. */
const NON_REQUIRED_ROLES: ReadonlySet<ComponentRole> = new Set<ComponentRole>(['kit', 'loose', 'freight', 'accessory'])

/** One quote line as the kit kernel needs it — a subset of the store's row plus the PR-1 columns. */
export type KitLineInput = {
  id: string
  /** The BID fixture row this line prices (the compare's row key). */
  fixture: string
  unitPriceEachCents: number | null
  cantSupply?: boolean
  componentRole?: ComponentRole | null
  /** Vendor's description of the part ("Zurn Z1201 vertical, no side inlets"). */
  label?: string | null
  /** Alternatives share a group ("size"); exactly one should be chosen. */
  optionGroup?: string | null
  optionLabel?: string | null
  optionChosen?: boolean
  pageRef?: string | null
  picked?: boolean
  pickReason?: string | null
  lotId?: string | null
  lotTotalCents?: number | null
}

export type KitComponent = {
  lineId: string
  role: ComponentRole | null
  label: string | null
  unitPriceEachCents: number | null
  /** True when the component carries no price of its own because the kit subtotal covers it. */
  inKit: boolean
  pageRef: string | null
}

export type KitOption = {
  lineId: string
  label: string
  unitPriceEachCents: number | null
  chosen: boolean
}

export type KitCell = {
  /** $/each for the whole fixture when it can be stated; null when incomplete, needs a choice, or can't supply. */
  kitEachCents: number | null
  /** How the $/each was reached — a plain line, a kit subtotal (+ separately priced components), or a chosen option. */
  basis: 'line' | 'kit' | 'option' | 'none'
  components: KitComponent[]
  /** Roles some house quoted for this fixture that this house did not price or cover. */
  missingRoles: ComponentRole[]
  incomplete: boolean
  cantSupply: boolean
  /** Present when the house quoted alternatives and none is chosen. */
  needsChoice: { group: string; options: KitOption[]; minCents: number | null; maxCents: number | null } | null
  picked: boolean
  pickReason: string | null
  /** The first lot found on the lines (lots still count once in totals — see quoteCompare). */
  lotId: string | null
  lotTotalCents: number | null
}

/** Any line with a role or an option group means "the quote was structured" — the kit path applies. */
export function isStructured(lines: ReadonlyArray<KitLineInput>): boolean {
  return lines.length > 1 || lines.some((l) => l.componentRole != null || l.optionGroup != null)
}

/**
 * Roles that a complete kit for this fixture must price, given every house's
 * lines for it: the union of component roles any house quoted (minus the
 * roles that never make a kit incomplete), plus any `requiredRoles` a rule
 * adds ("a wall-hung WC needs a carrier").
 */
export function expectedRoles(
  linesByHouse: ReadonlyArray<ReadonlyArray<KitLineInput>>,
  requiredRoles: ReadonlyArray<ComponentRole> = [],
): ComponentRole[] {
  const out = new Set<ComponentRole>()
  for (const lines of linesByHouse) {
    for (const l of lines) {
      if (l.componentRole && !NON_REQUIRED_ROLES.has(l.componentRole)) out.add(l.componentRole)
    }
  }
  for (const r of requiredRoles) if (!NON_REQUIRED_ROLES.has(r)) out.add(r)
  return [...out].sort()
}

/**
 * Collapse one house's lines for one fixture into a single compare cell.
 *
 * - Plain single line → `basis: 'line'`, its own price.
 * - A `kit` line → `basis: 'kit'`, $/each = kit subtotal + every separately
 *   priced component (the carrier from the other sheet). Unpriced components
 *   are "in kit" when a kit line exists.
 * - Option lines → chosen one prices the cell; none chosen → `needsChoice`.
 * - A component role in `expected` that is neither priced nor in-kit →
 *   `missingRoles`, `incomplete`, and no $/each.
 */
export function aggregateKit(lines: ReadonlyArray<KitLineInput>, expected: ReadonlyArray<ComponentRole> = []): KitCell {
  const empty: KitCell = {
    kitEachCents: null,
    basis: 'none',
    components: [],
    missingRoles: [],
    incomplete: false,
    cantSupply: false,
    needsChoice: null,
    picked: false,
    pickReason: null,
    lotId: null,
    lotTotalCents: null,
  }
  if (lines.length === 0) return empty

  const picked = lines.some((l) => Boolean(l.picked))
  const pickReason = lines.find((l) => l.pickReason)?.pickReason ?? null
  const lotLine = lines.find((l) => l.lotId != null)
  const lotId = lotLine?.lotId ?? null
  const lotTotalCents = lotLine?.lotTotalCents ?? null

  // Option groups: alternatives, one right answer.
  const optionLines = lines.filter((l) => l.optionGroup != null)
  const nonOption = lines.filter((l) => l.optionGroup == null)
  if (optionLines.length > 0) {
    const group = optionLines[0]!.optionGroup!
    const options: KitOption[] = optionLines.map((l) => ({
      lineId: l.id,
      label: l.optionLabel ?? l.label ?? l.fixture,
      unitPriceEachCents: l.unitPriceEachCents,
      chosen: Boolean(l.optionChosen),
    }))
    const chosen = options.filter((o) => o.chosen)
    if (chosen.length === 1 && chosen[0]!.unitPriceEachCents != null) {
      // A chosen option prices the fixture; any non-option components add on.
      const extras = nonOption.filter((l) => l.unitPriceEachCents != null && !l.cantSupply)
      const cents = chosen[0]!.unitPriceEachCents + extras.reduce((s, l) => s + (l.unitPriceEachCents ?? 0), 0)
      return {
        ...empty,
        kitEachCents: cents,
        basis: 'option',
        components: [
          { lineId: chosen[0]!.lineId, role: null, label: chosen[0]!.label, unitPriceEachCents: chosen[0]!.unitPriceEachCents, inKit: false, pageRef: null },
          ...extras.map(toComponent(false)),
        ],
        picked,
        pickReason,
        lotId,
        lotTotalCents,
      }
    }
    const priced = options.map((o) => o.unitPriceEachCents).filter((c): c is number => c != null)
    return {
      ...empty,
      basis: 'none',
      components: nonOption.map(toComponent(false)),
      needsChoice: {
        group,
        options,
        minCents: priced.length ? Math.min(...priced) : null,
        maxCents: priced.length ? Math.max(...priced) : null,
      },
      picked,
      pickReason,
      lotId,
      lotTotalCents,
    }
  }

  // Plain single line — today's quotes, unchanged.
  if (lines.length === 1 && lines[0]!.componentRole == null) {
    const l = lines[0]!
    return {
      ...empty,
      kitEachCents: l.cantSupply ? null : l.unitPriceEachCents,
      basis: l.cantSupply || l.unitPriceEachCents == null ? 'none' : 'line',
      components: [toComponent(false)(l)],
      cantSupply: Boolean(l.cantSupply),
      picked,
      pickReason,
      lotId,
      lotTotalCents,
    }
  }

  // Kit: a subtotal line plus roles.
  const kitLine = lines.find((l) => l.componentRole === 'kit')
  const hasKit = kitLine != null && kitLine.unitPriceEachCents != null && !kitLine.cantSupply
  const components = lines.map(toComponent(hasKit))
  const allCantSupply = lines.every((l) => l.cantSupply)
  if (allCantSupply) {
    return { ...empty, components, cantSupply: true, picked, pickReason, lotId, lotTotalCents }
  }

  const presentRoles = new Set<ComponentRole>()
  for (const l of lines) {
    if (!l.componentRole || l.cantSupply) continue
    if (l.unitPriceEachCents != null || hasKit) presentRoles.add(l.componentRole)
  }
  const missingRoles = expected.filter((r) => !presentRoles.has(r))
  // An unpriced component with no kit subtotal to ride is a hole too.
  const unpricedOutsideKit = lines.some(
    (l) => !hasKit && l.componentRole != null && l.componentRole !== 'kit' && !l.cantSupply && l.unitPriceEachCents == null,
  )
  const incomplete = missingRoles.length > 0 || unpricedOutsideKit

  const cents = lines.reduce((s, l) => (l.cantSupply ? s : s + (l.unitPriceEachCents ?? 0)), 0)
  return {
    ...empty,
    kitEachCents: incomplete ? null : cents,
    basis: incomplete ? 'none' : hasKit ? 'kit' : 'line',
    components,
    missingRoles,
    incomplete,
    picked,
    pickReason,
    lotId,
    lotTotalCents,
  }
}

function toComponent(hasKit: boolean) {
  return (l: KitLineInput): KitComponent => ({
    lineId: l.id,
    role: l.componentRole ?? null,
    label: l.label ?? null,
    unitPriceEachCents: l.cantSupply ? null : l.unitPriceEachCents,
    inKit: hasKit && l.componentRole != null && l.componentRole !== 'kit' && l.unitPriceEachCents == null && !l.cantSupply,
    pageRef: l.pageRef ?? null,
  })
}

/** "$1,010.00 kit + carrier $338.41" — the one-line explanation of a kit cell's $/each. */
export function describeKitBasis(cell: KitCell, money: (cents: number) => string): string | null {
  if (cell.kitEachCents == null) return null
  if (cell.basis === 'line') return null
  if (cell.basis === 'option') {
    const chosen = cell.components[0]
    return chosen ? `${chosen.label ?? 'chosen option'} ${money(chosen.unitPriceEachCents ?? 0)}` : null
  }
  const kit = cell.components.find((c) => c.role === 'kit')
  const extras = cell.components.filter((c) => c.role !== 'kit' && !c.inKit && c.unitPriceEachCents != null)
  const parts: string[] = []
  if (kit?.unitPriceEachCents != null) parts.push(`${money(kit.unitPriceEachCents)} kit`)
  for (const e of extras) parts.push(`${e.role ? COMPONENT_ROLE_LABELS[e.role] : e.label ?? 'part'} ${money(e.unitPriceEachCents ?? 0)}`)
  return parts.join(' + ') || null
}

/**
 * Split a quote heading that covers several plan tags into the tags it
 * names: "WC-1 & WC-2" → ["WC-1", "WC-2"]; "RD-1 & RD-3" → ["RD-1", "RD-3"];
 * "FCO/CO" → ["FCO", "CO"]; "WC1&2" → ["WC1", "WC2"] (a bare trailing number
 * inherits the letters). Trailing words ("WATER CLOSET", "(CARRIERS)") are
 * dropped. A heading with one tag returns just that tag.
 */
export function splitTagHeading(heading: string): string[] {
  const head = heading
    .replace(/\(.*?\)/g, ' ')
    .trim()
    .split(/\s{2,}|\s+(?=[A-Z][A-Z]+(?:\s|$))/)[0] ?? ''
  const raw = head
    .split(/\s*(?:&|\/|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
  if (raw.length === 0) return []
  const out: string[] = []
  let prefix = ''
  for (const part of raw) {
    const m = part.match(/^([A-Za-z]+)[-\s]?(\d+[A-Za-z]?)$/)
    if (m) {
      prefix = m[1]!.toUpperCase()
      out.push(`${prefix}-${m[2]!.toUpperCase()}`)
      continue
    }
    if (/^\d+[A-Za-z]?$/.test(part) && prefix) {
      out.push(`${prefix}-${part.toUpperCase()}`)
      continue
    }
    out.push(part.toUpperCase())
  }
  return out
}

/**
 * The join between a bid's count-row name and a quote's tag: both sides
 * reduce to their tag set. "WC1&2" ↔ "WC-1 & WC-2 WATER CLOSET" match; so do
 * "RPZ" ↔ "RPZ-1" (a bare family matches any numbered tag of that family) and
 * "FCO" ↔ "FCO/CO". Returns the tags the two share, or the family match.
 */
export function tagsInCommon(bidRowName: string, quoteHeading: string): string[] {
  const a = splitTagHeading(bidRowName)
  const b = splitTagHeading(quoteHeading)
  const exact = a.filter((t) => b.includes(t))
  if (exact.length > 0) return exact
  const family = (t: string) => t.replace(/-.*$/, '')
  const bareA = a.filter((t) => !t.includes('-'))
  const fam = b.filter((t) => bareA.includes(family(t)))
  if (fam.length > 0) return fam
  const bareB = b.filter((t) => !t.includes('-'))
  return a.filter((t) => bareB.includes(family(t)))
}
