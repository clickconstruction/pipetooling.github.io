/**
 * Cards and footers (punch list #313) — the looks, and which of them the company offers.
 *
 * A look is the chosen layouts in other colours: the ground, the accent (the pipes, the ring,
 * the panels, the name on the card) and the ink of the logo's two words where they sit on the
 * accent. The bones do not move, so every look fits the same names and the same lines, and one
 * test covers them all (`looks.test.ts`: the same rows on the same baselines, and every pair of
 * colours reads).
 *
 * A developer draws a look here. The owner approves it on Settings → People & teams → *Card and
 * footer looks*, which keeps one company setting: which looks are on, and which is the default.
 * A person picks among the looks that are on (`users.card_look`); the office may pick for a
 * teammate. A pick the owner has since switched off falls back to the default.
 *
 * The owner approved these three on 2026-11-11: the look in use, navy and orange, and navy and
 * yellow with the logo's orange hand kept. A yellow hand was passed on: it would be a second
 * version of the company's mark, and that is the designer's to draw.
 */
import { BRAND, LAYOUTS, type KitLayout } from './layouts'

export const LOOK_IDS = ['classic', 'navy-orange', 'navy-yellow'] as const
export type KitLookId = (typeof LOOK_IDS)[number]

export type KitTheme = {
  name: string
  /** One line for the owner's card and the picker. */
  says: string
  /** The footer's ground and the card's. The designer's footer is pure black and the card a hair off it. */
  ground: `#${string}`
  cardGround: `#${string}`
  accent: `#${string}`
  /** The logo's two words where they sit on the accent, on the card front. */
  ink: `#${string}`
}

/** The navy of the app's signed-out pages. The yellow is a stand-in for safety yellow until the designer names one. */
const NAVY = '#16283c'
const YELLOW = '#f6c700'

export const THEMES: Record<KitLookId, KitTheme> = {
  classic: { name: 'Classic', says: 'Black and orange.', ground: '#000000', cardGround: '#050708', accent: BRAND.orange, ink: '#ffffff' },
  'navy-orange': { name: 'Navy and orange', says: 'Navy where the black was.', ground: NAVY, cardGround: NAVY, accent: BRAND.orange, ink: '#ffffff' },
  'navy-yellow': { name: 'Navy and yellow', says: 'Navy, with yellow pipes, ring and panels.', ground: NAVY, cardGround: NAVY, accent: YELLOW, ink: NAVY },
}

export type KitLookLayouts = { footer: KitLayout; back: KitLayout; front: KitLayout }

function themed(base: KitLayout, theme: KitTheme, isCard: boolean): KitLayout {
  const copy = JSON.parse(JSON.stringify(base)) as KitLayout
  copy.ground = isCard ? theme.cardGround : theme.ground
  copy.orange = theme.accent
  // on the card front the logo's two words sit on the accent panel
  if (copy.logo && isCard) copy.logo.ink = theme.ink
  return copy
}

/**
 * The three layouts of each look. Classic is the look in use, untouched: its card front sits on
 * the designer's pipe photo. The navy looks take the drawn front, navy where the photo was, since
 * the photo is tinted black.
 */
const LOOK_LAYOUTS: Record<KitLookId, KitLookLayouts> = {
  classic: { footer: LAYOUTS.footerReworked, back: LAYOUTS.cardBackReworked, front: LAYOUTS.cardFrontReworked },
  'navy-orange': {
    footer: themed(LAYOUTS.footerReworked, THEMES['navy-orange'], false),
    back: themed(LAYOUTS.cardBackReworked, THEMES['navy-orange'], true),
    front: themed(LAYOUTS.cardFrontPipes, THEMES['navy-orange'], true),
  },
  'navy-yellow': {
    footer: themed(LAYOUTS.footerReworked, THEMES['navy-yellow'], false),
    back: themed(LAYOUTS.cardBackReworked, THEMES['navy-yellow'], true),
    front: themed(LAYOUTS.cardFrontPipes, THEMES['navy-yellow'], true),
  },
}

export function lookLayouts(id: KitLookId): KitLookLayouts {
  return LOOK_LAYOUTS[id]
}

export function isLookId(v: unknown): v is KitLookId {
  return typeof v === 'string' && (LOOK_IDS as readonly string[]).includes(v)
}

// ── The company's setting: which looks are on, and the default ────────────────────────────────

/** `app_settings.key`: a JSON object in `value_text`. Any signed-in person reads it; only a dev writes it. */
export const CARD_LOOKS_SETTING_KEY = 'card_looks_v1'

export type CardLooksSetting = { approved: KitLookId[]; default: KitLookId }

/** With no setting on file, the look in use is the only one, so nobody is offered a look the owner has not switched on. */
export const DEFAULT_CARD_LOOKS: CardLooksSetting = { approved: ['classic'], default: 'classic' }

/** The setting as saved, read back safely: an unknown look is dropped, at least one stays on, and the default is always one that is on. */
export function parseCardLooks(raw: string | null | undefined): CardLooksSetting {
  if (!raw) return { ...DEFAULT_CARD_LOOKS, approved: [...DEFAULT_CARD_LOOKS.approved] }
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_CARD_LOOKS, approved: [...DEFAULT_CARD_LOOKS.approved] }
  }
  const rec = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
  const listed = Array.isArray(rec.approved) ? rec.approved.filter(isLookId) : []
  // kept in the looks' own order, each once
  const approved = LOOK_IDS.filter((id) => listed.includes(id))
  if (!approved.length) approved.push('classic')
  const def = isLookId(rec.default) && approved.includes(rec.default) ? rec.default : approved[0]!
  return { approved, default: def }
}

export function serializeCardLooks(setting: CardLooksSetting): string {
  return JSON.stringify({ approved: LOOK_IDS.filter((id) => setting.approved.includes(id)), default: setting.default })
}

/** The look a person's card is drawn in: their pick when the owner still offers it, else the company's default. */
export function resolveLook(pick: string | null | undefined, setting: CardLooksSetting): KitLookId {
  return isLookId(pick) && setting.approved.includes(pick) ? pick : setting.default
}

/** The setting with one look switched on or off. The default cannot be switched off: pick another default first. */
export function withLookSwitched(setting: CardLooksSetting, id: KitLookId, on: boolean): CardLooksSetting {
  if (!on && id === setting.default) return setting
  const approved = LOOK_IDS.filter((x) => (x === id ? on : setting.approved.includes(x)))
  return { approved, default: setting.default }
}

/** The setting with another default. Making a look the default switches it on. */
export function withDefaultLook(setting: CardLooksSetting, id: KitLookId): CardLooksSetting {
  return { approved: LOOK_IDS.filter((x) => x === id || setting.approved.includes(x)), default: id }
}

/** How many people's cards are drawn in each look, picks that are switched off counted on the default. */
export function lookCounts(picks: readonly (string | null | undefined)[], setting: CardLooksSetting): Record<KitLookId, number> {
  const counts = Object.fromEntries(LOOK_IDS.map((id) => [id, 0])) as Record<KitLookId, number>
  for (const pick of picks) counts[resolveLook(pick, setting)]++
  return counts
}

// ── Can it be read ─────────────────────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** How strongly two colours stand apart, from 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** The three pairs a look is read by, each with what it needs: small words 4.5 to 1, large words 3 to 1. */
export function lookReadability(theme: KitTheme): { pair: string; ratio: number; needs: number }[] {
  return [
    { pair: 'white lines on the ground', ratio: contrast('#ffffff', theme.cardGround), needs: 4.5 },
    { pair: 'the name on the card, in the accent', ratio: contrast(theme.accent, theme.cardGround), needs: 3 },
    { pair: 'the logo’s two words on the panel', ratio: contrast(theme.ink, theme.accent), needs: 3 },
  ]
}
