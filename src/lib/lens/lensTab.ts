/**
 * What everyone sees, the tab's kernel (punch list #194): which frames to draw for the knobs, what
 * each one is called, and what its asks add up to. Pure; the tab (SettingsWhatEveryoneSeesTab)
 * draws what this returns.
 */
import { customerJourneys, type JourneyId } from '../customerJourneys'
import { doorsFor, plainViewer, type Door } from '../search/doors'
import type { Course, CourseLesson } from '../training/courseContent'
import { lessonItems } from '../training/figures'
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

/** What varies across the frames; every other knob holds. `sheet` is every screen the role can open. */
export type LensAcross = 'widths' | 'roles' | 'states' | 'sheet'

/** A customer audience, whose pages What customers see already draws with its sample tokens. */
export type LensAudience = JourneyId

export type LensKnobs = { as: LensRole; where: string; mood: LensMood; across: LensAcross; width: LensWidth; theme: LensTheme; /** Set when Who is a customer audience instead of a role. */ audience: LensAudience | null }

export const DEFAULT_KNOBS: LensKnobs = { as: 'estimator', where: 'page:/dashboard', mood: 'full', across: 'widths', width: 'phone', theme: 'light', audience: null }

/** A screen the lens can draw: a page, a window with a link, a Settings card, or a training lesson. */
export type LensScreen = { id: string; label: string; where: string; to: string; kind: Door['kind'] | 'lesson' }

/** What a lesson's screen reads from its course. */
export type LensCourse = Pick<Course, 'slug' | 'title'> & { lessons: readonly Pick<CourseLesson, 'key' | 'order' | 'title' | 'mustKnow' | 'traps'>[] }

/**
 * What the lens draws beside the door index, handed in by the caller: the training courses live in a Vite-only module
 * (`courseRegistry`), loaded apart so their words never ride in the Settings chunk.
 */
export type LensSources = { courses?: readonly LensCourse[] }

const DRAWN_KINDS = new Set<Door['kind']>(['page', 'window', 'settings'])

/**
 * The door a dev reads a course that is off by (Training.tsx). The lens world turns no course on, so every lesson is
 * behind it, and a role that holds it reads them all.
 */
const holdsCoursePreview = (doors: readonly Door[]) => doors.some((d) => d.id === 'dev:page-training-preview')

/** Each lesson that draws a figure, at its own door (`/training/<slug>?lesson=<key>`), in course and lesson order. */
export function lessonScreens(courses: readonly LensCourse[]): LensScreen[] {
  return courses.flatMap((c) =>
    c.lessons
      .filter((l) => lessonItems([...l.mustKnow, ...l.traps]).some((item) => item.kind === 'figure'))
      .map((l): LensScreen => ({ id: `lesson:${c.slug}/${l.key}`, label: `${c.title} · Lesson ${l.order} · ${l.title}`, where: 'Training', to: `/training/${c.slug}?lesson=${encodeURIComponent(l.key)}`, kind: 'lesson' })),
  )
}

/** True when the role's screens end with the lessons. */
export function lensReadsLessons(role: LensRole): boolean {
  return holdsCoursePreview(doorsFor(plainViewer(role)))
}

/**
 * Every screen a role can open, from the door index, through the app's own gates. A role that holds the course preview
 * door also gets every lesson that draws a figure, so each drawing is drawn and checked once, as the dev.
 */
export function lensScreens(role: LensRole, sources: LensSources = {}): LensScreen[] {
  const doors = doorsFor(plainViewer(role))
  const screens: LensScreen[] = doors
    .filter((d) => DRAWN_KINDS.has(d.kind))
    .map((d) => ({ id: d.id, label: d.label, where: d.where, to: d.to, kind: d.kind }))
  return holdsCoursePreview(doors) ? [...screens, ...lessonScreens(sources.courses ?? [])] : screens
}

export type LensFrameSpec = {
  /** Changes whenever the frame must load again: a new name or a new page. */
  key: string
  /** The seal's config; null for a customer's page, which answers from its own sample token instead. */
  config: LensConfig | null
  to: string
  width: LensWidth
  /** The frame's caption: what varies. */
  lead: string
  /** The iframe's title, for a screen reader. */
  title: string
  /** Set when this role cannot open the chosen screen, so its frame shows its dashboard instead. */
  fallback?: string
}

function screenFor(role: LensRole, where: string, sources: LensSources): { screen: LensScreen | null; fallback?: string } {
  const screens = lensScreens(role, sources)
  const hit = screens.find((s) => s.id === where)
  if (hit) return { screen: hit }
  const home = screens.find((s) => s.id === 'page:/dashboard') ?? screens[0] ?? null
  return { screen: home, fallback: home ? 'This role cannot open it, so here is their dashboard.' : undefined }
}

function specFor(as: LensRole, screen: LensScreen, mood: LensMood, theme: LensTheme, width: LensWidth, lead: string, fallback?: string): LensFrameSpec {
  const person = LENS_PEOPLE[as]
  return {
    key: `${as}|${mood}|${theme}|${width}|${screen.to}`,
    config: { as, mood, theme },
    to: screen.to,
    width,
    lead,
    title: `${screen.label} as ${person.name}, ${person.label.toLowerCase()}, ${LENS_WIDTHS[width].label}, ${theme}, ${LENS_MOOD_LABELS[mood].toLowerCase()}`,
    fallback,
  }
}

/** The audiences of What customers see, in its order. */
export const LENS_AUDIENCES: readonly { id: LensAudience; label: string }[] = customerJourneys().map((j) => ({ id: j.id, label: j.title }))

/** An audience's pages on this origin, from its journey, each opened by its sample token. */
export function audienceScreens(audience: LensAudience): LensScreen[] {
  const journey = customerJourneys().find((j) => j.id === audience)
  const seen = new Set<string>()
  const out: LensScreen[] = []
  for (const s of journey?.steps ?? []) {
    if (s.render.kind !== 'page' || s.render.absolute || seen.has(s.render.path)) continue
    seen.add(s.render.path)
    out.push({ id: `step:${s.id}`, label: s.label, where: s.when, to: s.render.path, kind: 'page' })
  }
  return out
}

function audienceFrames(k: LensKnobs, audience: LensAudience): LensFrameSpec[] {
  const label = LENS_AUDIENCES.find((a) => a.id === audience)?.label ?? audience
  const screens = audienceScreens(audience)
  const spec = (s: LensScreen, width: LensWidth, lead: string): LensFrameSpec => ({
    key: `out|${audience}|${width}|${s.to}`,
    config: null,
    to: s.to,
    width,
    lead,
    title: `${s.label} as the ${label.toLowerCase()} sees it, ${LENS_WIDTHS[width].label}`,
  })
  if (k.across === 'sheet') return screens.map((s) => spec(s, k.width, s.label))
  const screen = screens.find((s) => s.id === k.where) ?? screens[0]
  // A customer's page pins itself light, so its widths are one row.
  return screen ? LENS_WIDTH_ORDER.map((w) => spec(screen, w, LENS_WIDTHS[w].label)) : []
}

export function lensFrames(k: LensKnobs, sources: LensSources = {}): LensFrameSpec[] {
  if (k.audience) return audienceFrames(k, k.audience)
  if (k.across === 'sheet') {
    // Every screen the role can open, once each, under the held state, width and theme.
    const seen = new Set<string>()
    return lensScreens(k.as, sources)
      .filter((s) => !seen.has(s.to) && seen.add(s.to))
      .map((s) => specFor(k.as, s, k.mood, k.theme, k.width, s.label))
  }
  const spec = (as: LensRole, mood: LensMood, theme: LensTheme, width: LensWidth, lead: string): LensFrameSpec | null => {
    const { screen, fallback } = screenFor(as, k.where, sources)
    return screen ? specFor(as, screen, mood, theme, width, lead, fallback) : null
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

/** The sweep's next frames: the first ones, in order, not checked yet, at most `max` of them. */
export function sweepWindow(keys: readonly string[], checked: ReadonlySet<string>, max: number): string[] {
  const out: string[] = []
  for (const k of keys) {
    if (out.length >= max) break
    if (!checked.has(k)) out.push(k)
  }
  return out
}

/**
 * The live frames that may load now: each one that has loaded, and the first one that has not. Frames load one after
 * another because the first visit after a deploy fetches the app through the service worker, and six frames asking at
 * once left five of them empty (2026-10-27). Once one frame has the app, the rest load from memory.
 */
export function admittedFrames(live: readonly string[], loaded: ReadonlySet<string>): string[] {
  const next = live.find((k) => !loaded.has(k))
  return live.filter((k) => loaded.has(k) || k === next)
}

export type AskSummary = { total: number; world: number; rule: number; missing: number; unread: number; mood: number; refused: number; network: number; gaps: string[] }

/** What a frame's asks add up to: who answered, and the distinct ones the world has no answer for. */
export function askSummary(asks: readonly LensAsk[]): AskSummary {
  const s: AskSummary = { total: asks.length, world: 0, rule: 0, missing: 0, unread: 0, mood: 0, refused: 0, network: 0, gaps: [] }
  const gaps = new Set<string>()
  for (const a of asks) {
    s[a.by] += 1
    if (a.by === 'missing' || a.by === 'unread') gaps.add(`${a.kind === 'rpc' ? 'RPC' : a.kind === 'function' ? 'function' : a.kind} ${a.name}`)
  }
  s.gaps = [...gaps].sort()
  return s
}
