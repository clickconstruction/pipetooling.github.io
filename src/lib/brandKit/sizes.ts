/**
 * Cards and footers (punch list #313) — the sizes of the business card's back.
 *
 * A card is 3.5 by 2 inches. Between the safe margins the photo and the words share about 3.15
 * inches of width, so a size is a trade. `photo` gives the ring the most room. `text` gives the
 * words the most room, by moving the seam between the panel and the ground to the left. Both are
 * larger than `standard`, the card as the designer set it, on both counts.
 *
 * A size is not a look. A look only recolours, so one test covers every look. A size moves
 * things, so each one carries its own numbers, and `sizes.test.ts` holds that a long name, a
 * title and three lines stay inside the safe margin in every size. The two are separate picks:
 * any size works in any look. Only the card's back changes; the front and the footer stay.
 *
 * In a larger size the words are centred on the card's middle, so a person with fewer lines still
 * sits right.
 *
 * Which sizes the company offers is a setting of its own (`card_sizes_v1`), kept apart from the
 * looks' setting so that saving one never rewrites the other. A person's pick is
 * `users.card_size`. A pick the owner has since switched off falls back to the default. The owner
 * offered all three on 2026-11-11.
 */
import { CARD, type KitFact, type KitLayout, type KitRow } from './layouts'
import { LOOK_IDS, lookLayouts, type KitLookId } from './looks'

export const SIZE_IDS = ['standard', 'photo', 'text'] as const
export type KitSizeId = (typeof SIZE_IDS)[number]

export const SIZES: Record<KitSizeId, { name: string; says: string }> = {
  standard: { name: 'Standard', says: 'The card as the designer set it.' },
  photo: { name: 'Larger photo', says: 'The photo grows by a third. The words grow a little.' },
  text: { name: 'Larger text', says: 'The words grow by a quarter. The photo grows a little.' },
}

/** How far a long line shrinks before it is let run: the share of its size `fitSize` stops at. */
const FIT_FLOOR = 0.55

/** The right edge of the safe margin: nothing that matters goes past it. */
const SAFE_RIGHT = CARD.w - CARD.bleed - CARD.safe

type SizeNumbers = {
  /** Where the panel ends and the ring sits. */
  seam: number
  photo: number
  ring: number
  /** Where the words and the icons start. */
  x: number
  textX: number
  icon: number
  rise: number
  name: number
  title: number
  titleAdvance: number
  line: number
  firstLine: { afterName: number; afterTitle: number }
  step: number
}

const NUMBERS: Record<Exclude<KitSizeId, 'standard'>, SizeNumbers> = {
  photo: { seam: 300, photo: 172, ring: 186, x: 520, textX: 590, icon: 54, rise: 37, name: 62, title: 34, titleAdvance: 44, line: 42, firstLine: { afterName: 84, afterTitle: 60 }, step: 62 },
  text: { seam: 230, photo: 150, ring: 163, x: 420, textX: 492, icon: 56, rise: 38, name: 66, title: 34, titleAdvance: 46, line: 44, firstLine: { afterName: 88, afterTitle: 62 }, step: 64 },
}

function sized(base: KitLayout, n: SizeNumbers): KitLayout {
  const L = JSON.parse(JSON.stringify(base)) as KitLayout
  const w = L.words!
  const row = Object.fromEntries(w.rows.map((r) => [r.fact, r])) as Record<KitFact, KitRow | undefined>
  L.panels = [{ points: [[0, 0], [n.seam, 0], [n.seam, CARD.h], [0, CARD.h]], colour: 'orange' }]
  L.ring = { cx: n.seam, cy: CARD.h / 2, photo: n.photo, ring: n.ring }
  delete w.start
  w.centre = CARD.h / 2
  w.x = n.x
  w.firstLine = n.firstLine
  w.lineSteps = [n.step]
  w.icons = { x: n.x, size: n.icon, rise: n.rise, textX: n.textX }
  // a long line shrinks as far as it would on the standard card, so a larger size never holds less
  const grow = (r: KitRow | undefined, change: Partial<KitRow> & { size: number }) => {
    if (r) Object.assign(r, { min: FIT_FLOOR * r.size }, change)
  }
  grow(row.name, { size: n.name, fit: SAFE_RIGHT - n.x })
  grow(row.title, { size: n.title, advance: n.titleAdvance, x: n.x + 3, fit: SAFE_RIGHT - n.x - 10 })
  for (const fact of ['email', 'mobile', 'office'] as const) grow(row[fact], { size: n.line, fit: SAFE_RIGHT - n.textX })
  return L
}

const BACKS = Object.fromEntries(
  LOOK_IDS.map((look) => {
    const standard = lookLayouts(look).back
    return [look, { standard, photo: sized(standard, NUMBERS.photo), text: sized(standard, NUMBERS.text) }]
  }),
) as Record<KitLookId, Record<KitSizeId, KitLayout>>

/** The card's back in a look and a size. Standard is the look's own back, untouched. */
export function cardBackFor(look: KitLookId, size: KitSizeId): KitLayout {
  return BACKS[look][size]
}

export function isSizeId(v: unknown): v is KitSizeId {
  return typeof v === 'string' && (SIZE_IDS as readonly string[]).includes(v)
}

// ── The company's setting: which sizes are on, and the default ────────────────────────────────

/** `app_settings.key`: a JSON object in `value_text`. Any signed-in person reads it; only a dev writes it. */
export const CARD_SIZES_SETTING_KEY = 'card_sizes_v1'

export type CardSizesSetting = { approved: KitSizeId[]; default: KitSizeId }

/** With no setting on file, the standard card is the only one, so nobody is offered a size the owner has not switched on. */
export const DEFAULT_CARD_SIZES: CardSizesSetting = { approved: ['standard'], default: 'standard' }

const fallback = (): CardSizesSetting => ({ approved: [...DEFAULT_CARD_SIZES.approved], default: DEFAULT_CARD_SIZES.default })

/** The setting as saved, read back safely: an unknown size is dropped, at least one stays on, and the default is always one that is on. */
export function parseCardSizes(raw: string | null | undefined): CardSizesSetting {
  if (!raw) return fallback()
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return fallback()
  }
  const rec = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
  const listed = Array.isArray(rec.approved) ? rec.approved.filter(isSizeId) : []
  // kept in the sizes' own order, each once
  const approved = SIZE_IDS.filter((id) => listed.includes(id))
  if (!approved.length) approved.push('standard')
  const def = isSizeId(rec.default) && approved.includes(rec.default) ? rec.default : approved[0]!
  return { approved, default: def }
}

export function serializeCardSizes(setting: CardSizesSetting): string {
  return JSON.stringify({ approved: SIZE_IDS.filter((id) => setting.approved.includes(id)), default: setting.default })
}

/** The size a person's card is drawn in: their pick when the owner still offers it, else the company's default. */
export function resolveSize(pick: string | null | undefined, setting: CardSizesSetting): KitSizeId {
  return isSizeId(pick) && setting.approved.includes(pick) ? pick : setting.default
}

/** The setting with one size switched on or off. The default cannot be switched off: pick another default first. */
export function withSizeSwitched(setting: CardSizesSetting, id: KitSizeId, on: boolean): CardSizesSetting {
  if (!on && id === setting.default) return setting
  return { approved: SIZE_IDS.filter((x) => (x === id ? on : setting.approved.includes(x))), default: setting.default }
}

/** The setting with another default. Making a size the default switches it on. */
export function withDefaultSize(setting: CardSizesSetting, id: KitSizeId): CardSizesSetting {
  return { approved: SIZE_IDS.filter((x) => x === id || setting.approved.includes(x)), default: id }
}

/** How many people's cards are drawn in each size, picks that are switched off counted on the default. */
export function sizeCounts(picks: readonly (string | null | undefined)[], setting: CardSizesSetting): Record<KitSizeId, number> {
  const counts = Object.fromEntries(SIZE_IDS.map((id) => [id, 0])) as Record<KitSizeId, number>
  for (const pick of picks) counts[resolveSize(pick, setting)]++
  return counts
}

/** How a size prints: points for the words (a card is drawn 300 units to the inch), inches for the photo. */
export function sizePrints(size: KitSizeId): { namePt: number; linePt: number; photoIn: number } {
  const L = cardBackFor('classic', size)
  const rows = L.words!.rows
  const of = (fact: KitFact) => rows.find((r) => r.fact === fact)?.size ?? 0
  const pt = (units: number) => Math.round(((units * 72) / 300) * 10) / 10
  return { namePt: pt(of('name')), linePt: pt(of('mobile')), photoIn: Math.round(((2 * L.ring!.photo) / 300) * 100) / 100 }
}
