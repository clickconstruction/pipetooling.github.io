/**
 * Same-page alternates (v2.2370): plan ONE letter from a GC packet's sections — the base bids
 * form the letter's proposed amount and fixture list, alternates become one line each under it
 * ("Alternate 1 — …: $62,024.11 (reduced $5,287)"). Pure helpers; no React, no DB.
 *
 * When a packet has no base sections at all (every bid offered as an alternate), the FIRST
 * alternate leads the letter — no more $0.00 letters — and the rest are listed against it.
 */

import { COVER_LETTER_OPTIONS_INTRO_DEFAULT, type CoverLetterAlternateItem, type CoverLetterAlternateOption, type CoverLetterAlternatesBlock, type CoverLetterOptionItem, type CoverLetterOptionsBlock } from '../bidDocuments/coverLetter'

export type SamePageSection = {
  name: string
  bidVersionId: string | null
  revenueSum: number
  fixtureRows: { fixture: string; count: number }[]
  isAlternate: boolean
  offeredPricingId?: string
}

/** Per-bid customer-facing wording (bids.cover_letter_alt_texts): heading + per-section label/note. */
export type CoverLetterAltTexts = {
  heading?: string
  sections?: Record<string, { label?: string; note?: string }>
  /**
   * v2.4195: the with-and-without alternates (count-row groups in `bids.alternate_group_tags`), keyed
   * `group:<normalized tag>` — whether the letter offers one (default yes) and the add-on amount the
   * letter last stamped on a send, which the Bid Board's "+$ alt" chip reads. Their wording lives in
   * `sections` under the same key, so the preview's click-to-edit works unchanged.
   */
  groups?: Record<string, { offered?: boolean; amount?: number }>
}

export const COVER_LETTER_ALTS_HEADING_DEFAULT = 'Alternates:'

/** The studio's alternates layout: one letter with a line per alternate, or the pre-2370 letter per section. */
export type CoverLetterAltsLayout = 'same-page' | 'separate'

/** Per device: the studio's Same page / Separate pages switch remembers it here. */
export const COVER_LETTER_ALTS_LAYOUT_KEY = 'bids_cover_letter_alts_layout_v1'

/** This device's layout — same-page unless it chose separate pages, or storage cannot be read. */
export function readCoverLetterAltsLayout(): CoverLetterAltsLayout {
  try {
    return globalThis.localStorage?.getItem(COVER_LETTER_ALTS_LAYOUT_KEY) === 'separate' ? 'separate' : 'same-page'
  } catch {
    return 'same-page'
  }
}

export function parseCoverLetterAltTexts(raw: unknown): CoverLetterAltTexts {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const out: CoverLetterAltTexts = {}
  if (typeof obj.heading === 'string') out.heading = obj.heading
  if (obj.sections != null && typeof obj.sections === 'object' && !Array.isArray(obj.sections)) {
    const sections: Record<string, { label?: string; note?: string }> = {}
    for (const [key, val] of Object.entries(obj.sections as Record<string, unknown>)) {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) continue
      const v = val as Record<string, unknown>
      const entry: { label?: string; note?: string } = {}
      if (typeof v.label === 'string') entry.label = v.label
      if (typeof v.note === 'string') entry.note = v.note
      if (entry.label != null || entry.note != null) sections[key] = entry
    }
    if (Object.keys(sections).length > 0) out.sections = sections
  }
  if (obj.groups != null && typeof obj.groups === 'object' && !Array.isArray(obj.groups)) {
    const groups: Record<string, { offered?: boolean; amount?: number }> = {}
    for (const [key, val] of Object.entries(obj.groups as Record<string, unknown>)) {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) continue
      const v = val as Record<string, unknown>
      const entry: { offered?: boolean; amount?: number } = {}
      if (typeof v.offered === 'boolean') entry.offered = v.offered
      if (typeof v.amount === 'number' && Number.isFinite(v.amount)) entry.amount = v.amount
      if (entry.offered != null || entry.amount != null) groups[key] = entry
    }
    if (Object.keys(groups).length > 0) out.groups = groups
  }
  return out
}

/** Stable key for a section's saved wording: the version id, plus the offered scenario when it is one. */
export function altSectionKey(sec: { bidVersionId: string | null; offeredPricingId?: string }): string {
  return `${sec.bidVersionId ?? 'none'}${sec.offeredPricingId ? `:${sec.offeredPricingId}` : ''}`
}

/**
 * The customer-facing form of an alternate section's name (v2.2408, owner ask:
 * "(project name) value engineered, not (GC) value engineered"). Internal names
 * lead with the GC because ＋ Add GC names packets after the GC — but on the
 * letter the GC knows who they are; the project is what identifies the work.
 * Each ` · ` half that starts with the GC's name swaps it for the project name,
 * and halves left identical collapse (a version and its clone-named price
 * scenario otherwise print the same phrase twice).
 */
export function customerFacingAlternateName(
  name: string,
  gcName: string | null | undefined,
  projectName: string | null | undefined,
): string {
  const gc = (gcName ?? '').trim()
  const project = (projectName ?? '').trim()
  const parts = name.split(' · ').map((raw) => {
    const part = raw.trim()
    if (gc && part.toLowerCase().startsWith(gc.toLowerCase())) {
      const rest = part.slice(gc.length).trim()
      if (project) return rest ? `${project} ${rest}` : project
      return rest || part
    }
    return part
  })
  const deduped = parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1]!.toLowerCase())
  return deduped.join(' · ')
}

/** One of two or more base bids in a letter (v2.4723): its section and the offered prices on its own version. */
export type SamePageOption = {
  /** 1-based, in packet order; the first is the lead — the letter's headline, the Bid Board's value. */
  n: number
  section: SamePageSection
  alternates: SamePageSection[]
}

export type SamePagePlan = {
  /** Sections whose sum is the letter's proposed amount (bases; or the first alternate when no bases). With options, the lead option alone. */
  headline: SamePageSection[]
  /** Sections listed in the Alternates block, in packet order. With options, only the in-lieu-of ones (none belongs to an option). */
  alternates: SamePageSection[]
  headlineRevenue: number
  /** Headline sections' fixture rows merged (counts summed per fixture, first-seen order). With options, the lead's. */
  fixtureRows: { fixture: string; count: number }[]
  /** True when no base section existed and the first alternate leads the letter. */
  alternateLeads: boolean
  /**
   * v2.4723: two or more base bids are OPTIONS the GC picks between — each its own proposal with its
   * own alternates measured against it — never a sum. Read off prod (2026-10-06): every two-base
   * letter ever sent was To Plans vs Value Engineered, none two scopes of one job. Null otherwise.
   */
  options: SamePageOption[] | null
}

/**
 * Split a packet's sections into the letter headline and the alternates list. Two or more base
 * sections plan as options (even with no alternates); otherwise returns null when there is nothing
 * to combine — fewer than 2 sections, or no alternates.
 */
export function planSamePageLetter(sections: SamePageSection[]): SamePagePlan | null {
  const bases = sections.filter((s) => !s.isAlternate)
  const alts = sections.filter((s) => s.isAlternate)
  if (bases.length >= 2) {
    const options: SamePageOption[] = bases.map((b, i) => ({
      n: i + 1,
      section: b,
      alternates: alts.filter((a) => !!a.offeredPricingId && a.bidVersionId != null && a.bidVersionId === b.bidVersionId),
    }))
    const owned = new Set(options.flatMap((o) => o.alternates))
    const lead = bases[0]!
    return {
      headline: [lead],
      alternates: alts.filter((a) => !owned.has(a)),
      headlineRevenue: Number.isFinite(lead.revenueSum) ? lead.revenueSum : 0,
      fixtureRows: lead.fixtureRows.map((r) => ({ fixture: r.fixture, count: r.count })),
      alternateLeads: false,
      options,
    }
  }
  if (sections.length < 2) return null
  if (alts.length === 0) return null
  const alternateLeads = bases.length === 0
  const headline = alternateLeads ? alts.slice(0, 1) : bases
  const alternates = alternateLeads ? alts.slice(1) : alts
  if (alternates.length === 0) return null
  const headlineRevenue = headline.reduce((sum, s) => sum + (Number.isFinite(s.revenueSum) ? s.revenueSum : 0), 0)
  const fixtureRows: { fixture: string; count: number }[] = []
  const byFixture = new Map<string, { fixture: string; count: number }>()
  for (const sec of headline) {
    for (const row of sec.fixtureRows) {
      const existing = byFixture.get(row.fixture)
      if (existing) {
        existing.count += row.count
      } else {
        const merged = { fixture: row.fixture, count: row.count }
        byFixture.set(row.fixture, merged)
        fixtureRows.push(merged)
      }
    }
  }
  return { headline, alternates, headlineRevenue, fixtureRows, alternateLeads, options: null }
}

/** True when every option prints the same fixture list (same rows, counts and order) — it then prints once. */
export function optionsShareFixtures(options: ReadonlyArray<SamePageOption>): boolean {
  const first = options[0]
  if (!first) return true
  const key = (rows: ReadonlyArray<{ fixture: string; count: number }>) => rows.map((r) => `${r.fixture.trim().toLowerCase()}\u0001${r.count}`).join('\u0002')
  const k0 = key(first.section.fixtureRows)
  return options.every((o) => key(o.section.fixtureRows) === k0)
}

/** How many alternates the options block numbers, so the in-lieu-of block continues the count. */
export function optionsAlternateCount(plan: SamePagePlan): number {
  return plan.options ? plan.options.reduce((n, o) => n + o.alternates.length, 0) : 0
}

/**
 * The letter's options block (v2.4723): "Option 1 — To Plans: <words> ($X)" with its alternates
 * under it, each a deduct or add against THAT option. Alternates number across the whole letter
 * (the in-lieu-of block continues from `optionsAlternateCount`). An offered price's internal
 * scenario name never prints — it is a bare "Alternate N" until the estimator writes one (the same
 * rule as the in-lieu-of block). A saved label on an option prints verbatim.
 */
export function buildOptionsBlock(
  plan: SamePagePlan,
  texts: CoverLetterAltTexts,
  fmt: (n: number) => string,
  toWords: (n: number) => string,
  editable = false,
  naming?: { gcName?: string | null; projectName?: string | null },
): CoverLetterOptionsBlock | null {
  if (!plan.options || plan.options.length < 2) return null
  let n = 0
  const items: CoverLetterOptionItem[] = plan.options.map((o) => {
    const key = altSectionKey(o.section)
    const saved = texts.sections?.[key]
    const autoName = naming ? customerFacingAlternateName(o.section.name, naming.gcName, naming.projectName) : o.section.name
    return {
      label: saved?.label?.trim() || `Option ${o.n} — ${autoName}`,
      amountWords: toWords(o.section.revenueSum).toUpperCase(),
      amountFormatted: `$${fmt(o.section.revenueSum)}`,
      fixtureRows: o.section.fixtureRows,
      ...(editable ? { editKey: key } : {}),
      alternates: o.alternates.map((a): CoverLetterAlternateItem => {
        n += 1
        const aKey = altSectionKey(a)
        const aSaved = texts.sections?.[aKey]
        return {
          label: aSaved?.label?.trim() || `Alternate ${n}`,
          deltaText: formatAlternateDeltaText(a.revenueSum, o.section.revenueSum, fmt),
          amountFormatted: `$${fmt(a.revenueSum)}`,
          note: aSaved?.note?.trim() || null,
          ...(editable ? { editKey: aKey } : {}),
        }
      }),
    }
  })
  return { intro: COVER_LETTER_OPTIONS_INTRO_DEFAULT, items, sharedFixtures: optionsShareFixtures(plan.options) }
}

/**
 * Delta-first lead (v2.2422, owner-approved mockup): "Deduct $5,287" / "Add $4,100" — the
 * Add/Deduct convention builders read — or "no change" when the alternate matches the
 * headline. Null only when there is no headline to compare against (amount renders alone).
 * Whole dollars unless the difference has real cents.
 */
export function formatAlternateDeltaText(revenueSum: number, headlineRevenue: number, fmt: (n: number) => string): string | null {
  if (!(headlineRevenue > 0)) return null
  const delta = revenueSum - headlineRevenue
  if (Math.abs(delta) < 0.005) return 'no change'
  const amount = fmt(Math.abs(delta)).replace(/\.00$/, '')
  return `${delta < 0 ? 'Deduct' : 'Add'} $${amount}`
}

/**
 * The letter's Alternates block (v2.2422 shape): offered prices GROUP under their scope
 * ("— or <name>: Deduct $X ($Y)"), scope alternates are numbered ("Alternate 1 — …"), and
 * internal scenario names never print — an option's "— or" line carries a name only when the
 * estimator wrote one (the panel's ✎ / click-to-edit both store it in cover_letter_alt_texts).
 * A saved label on a scope alternate prints verbatim (no number is forced onto it).
 * `editable` adds the preview-only click-to-edit keys.
 */
export function buildAlternatesBlock(
  plan: SamePagePlan,
  texts: CoverLetterAltTexts,
  fmt: (n: number) => string,
  editable = false,
  /** Auto labels read customer-facing (project, not GC) when the letter's names are passed. */
  naming?: { gcName?: string | null; projectName?: string | null },
  /** v2.4723: numbering continues after the options' alternates ("Alternate 3 — …"). */
  startAt = 1,
): CoverLetterAlternatesBlock {
  const scopeAlts = plan.alternates.filter((s) => !s.offeredPricingId)
  const optionSecs = plan.alternates.filter((s) => s.offeredPricingId)
  const scopeByVersion = new Map<string, SamePageSection>()
  for (const s of scopeAlts) if (s.bidVersionId) scopeByVersion.set(s.bidVersionId, s)

  const optionFor = (sec: SamePageSection): CoverLetterAlternateOption => {
    const key = altSectionKey(sec)
    const saved = texts.sections?.[key]
    return {
      label: saved?.label?.trim() || null,
      deltaText: formatAlternateDeltaText(sec.revenueSum, plan.headlineRevenue, fmt),
      amountFormatted: `$${fmt(sec.revenueSum)}`,
      note: saved?.note?.trim() || null,
      ...(editable ? { editKey: key } : {}),
    }
  }

  // Options whose scope is itself an alternate nest under it; options on a BASE scope (or an
  // orphan) stand alone — they are alternate prices for the headline itself.
  const nested = new Map<string, CoverLetterAlternateOption[]>()
  const standalone: SamePageSection[] = []
  for (const sec of optionSecs) {
    const parent = sec.bidVersionId ? scopeByVersion.get(sec.bidVersionId) : undefined
    if (parent) nested.set(parent.bidVersionId!, [...(nested.get(parent.bidVersionId!) ?? []), optionFor(sec)])
    else standalone.push(sec)
  }

  let n = startAt - 1
  const topLevel = (sec: SamePageSection, options?: CoverLetterAlternateOption[], nameless = false): CoverLetterAlternateItem => {
    n += 1
    const key = altSectionKey(sec)
    const saved = texts.sections?.[key]
    const autoName = naming ? customerFacingAlternateName(sec.name, naming.gcName, naming.projectName) : sec.name
    return {
      // A standalone offered price (on the base scope) has only an internal name — unless the
      // estimator wrote one, it prints as a bare "Alternate N".
      label: saved?.label?.trim() || (nameless ? `Alternate ${n}` : `Alternate ${n} — ${autoName}`),
      deltaText: formatAlternateDeltaText(sec.revenueSum, plan.headlineRevenue, fmt),
      amountFormatted: `$${fmt(sec.revenueSum)}`,
      note: saved?.note?.trim() || null,
      ...(editable ? { editKey: key } : {}),
      ...(options && options.length > 0 ? { options } : {}),
    }
  }

  const items: CoverLetterAlternateItem[] = [
    ...scopeAlts.map((sec) => topLevel(sec, sec.bidVersionId ? nested.get(sec.bidVersionId) : undefined)),
    ...standalone.map((sec) => topLevel(sec, undefined, true)),
  ]
  return {
    heading: texts.heading?.trim() || COVER_LETTER_ALTS_HEADING_DEFAULT,
    items,
    ...(editable ? { headingEditKey: 'heading' } : {}),
  }
}
