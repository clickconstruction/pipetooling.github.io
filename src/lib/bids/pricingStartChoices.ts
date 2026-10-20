/**
 * Bids → Pricing: what the Workbench offers a version with NO prices yet — the start panel
 * (punch list #137). Until v2.2707 the Old grid's "Price book" select was how a fresh version
 * got priced from a book; the empty state's words still pointed there after it retired, so a
 * side-by-side rebid (own counts, no prices) was left with only the ★ copy. The panel's
 * primary door prices from a book through `onSelectPriceBookTemplate`, which already clones
 * the book into the bid, stamps the version, and stars the copy.
 */
import { resolvePriceBookTemplateRoot } from './resolveCurrentPriceBookTemplateId'

type VersionLike = { id: string; name: string; customer_id: string | null; starred_price_book_version_id: string | null }
type PricingLike = { id: string; bid_version_id: string | null; source_version_id: string | null; name?: string | null }
type TemplateLike = { id: string; name: string | null }

export type PricingStartDonor = {
  versionId: string
  /** The button's words — version-named for a same-GC sibling, GC-named across packets. */
  label: string
  /** True when the donor is another GC's packet (the copy re-keys by fixture name, v2.2405). */
  crossGc: boolean
}

export type PricingStartChoices =
  | { kind: 'needs-setup' }
  | {
      kind: 'start'
      /** Names the version when same-GC siblings exist, else the GC (the old words named the GC twice). */
      title: string
      bookTemplateId: string | null
      /** The primary button's words ("Price from WENDI"); null when no book is known. */
      bookLabel: string | null
      /** The line under the button, honest about where the book and its prices come from. */
      bookSubline: string
      donors: PricingStartDonor[]
    }

export function pricingStartChoices(input: {
  selectedBidVersionId: string | null
  bidVersions: ReadonlyArray<VersionLike>
  bidPricings: ReadonlyArray<PricingLike>
  templates: ReadonlyArray<TemplateLike>
  defaultTemplateId: string | null
  /** The tab's `gcNameForVersion` — the GC a version's letter goes to. */
  gcName: (versionId: string | null) => string
  hasCounts: boolean
  hasCostEstimate: boolean
}): PricingStartChoices {
  const { selectedBidVersionId, bidVersions, bidPricings, templates, defaultTemplateId, gcName, hasCounts, hasCostEstimate } = input
  const me = selectedBidVersionId ? (bidVersions.find((v) => v.id === selectedBidVersionId) ?? null) : null
  const noPricingHere = me != null && !bidPricings.some((p) => p.bid_version_id === me.id)
  // The book door only helps when the Workbench could actually render afterward — a version
  // missing counts or the bid missing its cost estimate keeps the old setup sentence.
  if (!me || !noPricingHere || !hasCounts || !hasCostEstimate) return { kind: 'needs-setup' }

  const myGc = me.customer_id ?? null
  const sameGcSiblings = bidVersions.some((v) => v.id !== me.id && (v.customer_id ?? null) === myGc)
  const title = sameGcSiblings ? `No prices yet on ${me.name || gcName(me.id)}.` : `No prices yet for ${gcName(me.id)}.`

  // Donors: any other version whose ★ is a loaded price (the rule the copy always had, G1) —
  // same-GC siblings first, so a rebid leads with its own packet.
  const donors: PricingStartDonor[] = bidVersions
    .filter((v) => v.id !== me.id && v.starred_price_book_version_id && bidPricings.some((p) => p.id === v.starred_price_book_version_id))
    .map((v) => {
      const crossGc = (v.customer_id ?? null) !== myGc
      return {
        versionId: v.id,
        label: crossGc ? `Copy ${gcName(v.id)}'s base price` : `Copy prices from ${v.name || gcName(v.id)}`,
        crossGc,
      }
    })
    .sort((a, b) => Number(a.crossGc) - Number(b.crossGc))

  // The book the primary button offers: the first donor's own book (same-GC sibling first — a
  // rebid prices from the book the original did, apples to apples), else the viewer's default.
  const templateIds = templates.map((t) => t.id)
  let bookTemplateId: string | null = null
  let siblingName: string | null = null
  for (const d of donors) {
    const star = bidVersions.find((v) => v.id === d.versionId)?.starred_price_book_version_id ?? null
    const root = resolvePriceBookTemplateRoot({ pricingId: star, bidPricings: [...bidPricings], templateIds, templates })
    if (root) {
      bookTemplateId = root
      const v = bidVersions.find((x) => x.id === d.versionId)
      siblingName = v ? (d.crossGc ? gcName(v.id) : v.name || gcName(v.id)) : null
      break
    }
  }
  if (!bookTemplateId) bookTemplateId = defaultTemplateId
  const bookName = bookTemplateId ? (templates.find((t) => t.id === bookTemplateId)?.name ?? null) : null
  return {
    kind: 'start',
    title,
    bookTemplateId,
    bookLabel: bookTemplateId ? `Price from ${bookName ?? 'the book'}` : null,
    bookSubline: siblingName
      ? `The book ${siblingName} prices from, as a fresh copy at today's book prices.`
      : "A fresh copy of the book at today's prices.",
    donors,
  }
}
