/**
 * What everyone sees, the tab's kernel (punch list #194): which frames to draw for the knobs, what
 * each one is called, and what its asks add up to. Pure; the tab (SettingsWhatEveryoneSeesTab)
 * draws what this returns.
 */
import { doorsFor, plainViewer, type Door } from '../search/doors'
import type { LensAsk } from './answer/lensEngine'
import { LENS_MOODS, type LensConfig, type LensMood, type LensTheme } from './lensName'
import { LENS_PEOPLE, LENS_ROLES, type LensRole } from './lensPeople'

export const LENS_WIDTHS = {
  phone: { label: 'Phone 375', w: 375, h: 780 },
  tablet: { label: 'Tablet 768', w: 768, h: 1000 },
  desk: { label: 'Desk 1280', w: 1280, h: 800 },
} as const
export type LensWidth = keyof typeof LENS_WIDTHS
export const LENS_WIDTH_ORDER: readonly LensWidth[] = ['phone', 'tablet', 'desk']

export const LENS_MOOD_LABELS: Readonly<Record<LensMood, string>> = {
  full: 'Full',
  empty: 'Empty',
  loading: 'Loading',
  slow: 'Slow',
  error: 'Failing',
  offline: 'Offline',
  training: 'Training mode',
}

/** What varies across the frames; every other knob holds. */
export type LensAcross = 'widths' | 'roles' | 'states'

export type LensKnobs = { as: LensRole; where: string; mood: LensMood; across: LensAcross; width: LensWidth; theme: LensTheme }

export const DEFAULT_KNOBS: LensKnobs = { as: 'estimator', where: 'page:/dashboard', mood: 'full', across: 'widths', width: 'phone', theme: 'light' }

/** A screen the lens can draw: a page, a window with a link, or a Settings card. */
export type LensScreen = { id: string; label: string; where: string; to: string; kind: Door['kind'] }

const DRAWN_KINDS = new Set<Door['kind']>(['page', 'window', 'settings'])

/** Every screen a role can open, from the door index, through the app's own gates. */
export function lensScreens(role: LensRole): LensScreen[] {
  return doorsFor(plainViewer(role))
    .filter((d) => DRAWN_KINDS.has(d.kind))
    .map((d) => ({ id: d.id, label: d.label, where: d.where, to: d.to, kind: d.kind }))
}

export type LensFrameSpec = {
  /** Changes whenever the frame must load again: a new name or a new page. */
  key: string
  config: LensConfig
  to: string
  width: LensWidth
  /** The frame's caption: what varies. */
  lead: string
  /** The iframe's title, for a screen reader. */
  title: string
  /** Set when this role cannot open the chosen screen, so its frame shows its dashboard instead. */
  fallback?: string
}

function screenFor(role: LensRole, where: string): { screen: LensScreen | null; fallback?: string } {
  const screens = lensScreens(role)
  const hit = screens.find((s) => s.id === where)
  if (hit) return { screen: hit }
  const home = screens.find((s) => s.id === 'page:/dashboard') ?? screens[0] ?? null
  return { screen: home, fallback: home ? 'This role cannot open it, so here is their dashboard.' : undefined }
}

export function lensFrames(k: LensKnobs): LensFrameSpec[] {
  const spec = (as: LensRole, mood: LensMood, theme: LensTheme, width: LensWidth, lead: string): LensFrameSpec | null => {
    const { screen, fallback } = screenFor(as, k.where)
    if (!screen) return null
    const person = LENS_PEOPLE[as]
    const config: LensConfig = { as, mood, theme }
    return {
      key: `${as}|${mood}|${theme}|${width}|${screen.to}`,
      config,
      to: screen.to,
      width,
      lead,
      title: `${screen.label} as ${person.name}, ${person.label.toLowerCase()}, ${LENS_WIDTHS[width].label}, ${theme}, ${LENS_MOOD_LABELS[mood].toLowerCase()}`,
      fallback,
    }
  }
  const out: (LensFrameSpec | null)[] = []
  if (k.across === 'widths') {
    for (const theme of ['light', 'dark'] as const) for (const w of LENS_WIDTH_ORDER) out.push(spec(k.as, k.mood, theme, w, `${LENS_WIDTHS[w].label} · ${theme === 'light' ? 'Light' : 'Dark'}`))
  } else if (k.across === 'roles') {
    for (const r of LENS_ROLES) out.push(spec(r, k.mood, k.theme, k.width, LENS_PEOPLE[r].label))
  } else {
    for (const m of LENS_MOODS) out.push(spec(k.as, m, k.theme, k.width, LENS_MOOD_LABELS[m]))
  }
  return out.filter((x): x is LensFrameSpec => x !== null)
}

export type AskSummary = { total: number; world: number; rule: number; missing: number; unread: number; mood: number; refused: number; gaps: string[] }

/** What a frame's asks add up to: who answered, and the distinct ones the world has no answer for. */
export function askSummary(asks: readonly LensAsk[]): AskSummary {
  const s: AskSummary = { total: asks.length, world: 0, rule: 0, missing: 0, unread: 0, mood: 0, refused: 0, gaps: [] }
  const gaps = new Set<string>()
  for (const a of asks) {
    s[a.by] += 1
    if (a.by === 'missing' || a.by === 'unread') gaps.add(`${a.kind === 'rpc' ? 'RPC' : a.kind === 'function' ? 'function' : a.kind} ${a.name}`)
  }
  s.gaps = [...gaps].sort()
  return s
}
