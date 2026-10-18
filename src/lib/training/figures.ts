/**
 * Figures in a lesson (punch list #116, v2.5598): one line in a lesson's Must know or Traps list draws a
 * figure beside the sentence it explains.
 *
 *   - {{figure:clearance-stack|Five distances stacked under the anchor.}}
 *
 * This module is pure (no React), so the content test and the parser can hold a lesson's figure names to
 * the registry without loading the drawings. The drawings themselves live in
 * `src/components/training/figures/`, one component per name, and `figures/index.ts` maps each name here
 * to its component; `figures.test.ts` holds the two lists equal.
 */

export type FigureItem = { figure: FigureName; caption: string }

/** Every figure the app draws, by the name a lesson uses. Kept sorted; the test holds it so. */
export const FIGURE_NAMES = [
  'afci-listens',
  'arc-flash-categories',
  'backfeed-strip',
  'ball-gate-check',
  'blocked-vent-strip',
  'bonding-jumper',
  'branch-circuit',
  'cave-in-signs',
  'clearance-stack',
  'clog-strip',
  'confined-space-roles',
  'controls-ladder',
  'copper-sweat-joint',
  'copper-types',
  'cross-connection-strip',
  'current-scale',
  'cut-pipe-strip',
  'dig-flags',
  'dishwasher-air-gap',
  'dry-trap-strip',
  'dwv-materials',
  'excavator-site-map',
  'fall-timeline',
  'fire-classes',
  'first-timer-mistakes',
  'five-touch-points',
  'fixture-valves',
  'flush-strip',
  'forklift-load-center',
  'freeze-strip',
  'frost-proof-bib',
  'gfci-compare',
  'gfci-trip-strip',
  'ground-path',
  'guardrail',
  'hand-signals',
  'hard-hat-limits',
  'hard-hat-markings',
  'hazcom-pictograms',
  'heat-stages',
  'house-to-sewer',
  'inspector-electrical',
  'inspector-tests',
  'ladder-angle',
  'lift-steps',
  'lifting-zone',
  'lockout-tag',
  'low-voltage-world',
  'main-panel',
  'meter-and-main-shutoff',
  'meter-dial',
  'neutral-vs-ground',
  'niosh-label',
  'noise-by-tool',
  'one-loop',
  'one-twenty-two-forty',
  'oxygen-gauge',
  'p-trap-seal',
  'pass-steps',
  'pex-bend',
  'pex-joints',
  'plumber-mistakes',
  'poison-ivy',
  'power-line-clearances',
  'ppe-labels',
  'pressure-and-prv',
  'pressure-drop-strip',
  'pumps-start-alone',
  'receptacle-faces',
  'san-tee-vs-wye',
  'seal-check',
  'septic-tank',
  'service-and-meter',
  'sign-colours',
  'silica-particle',
  'siphon-and-vent',
  'slope-rule',
  'soil-cube-car',
  'solvent-joint',
  'stacking-limits',
  'supply-fittings',
  'sweeps-and-direction',
  'swing-radius',
  'switch-and-light',
  'test-before-touch',
  'three-points',
  'three-visits',
  'tip-over',
  'toilet-rough-in',
  'toilet-tank',
  'trap-arm-drop',
  'trench-section',
  'tripped-breaker-strip',
  'trunk-vs-manifold',
  'two-systems',
  'under-the-sink',
  'vent-types',
  'volts-amps-watts',
  'water-hammer-strip',
  'water-heater-circuit',
  'water-heater-cutaway',
  'water-heater-no-power-strip',
  'water-on-panel-strip',
  'wet-floor-strip',
  'wet-vent',
  'wire-and-breaker',
] as const
export type FigureName = (typeof FIGURE_NAMES)[number]

const FIGURE_LINE = /^\{\{figure:([a-z0-9-]+)\|(.+)\}\}$/

export function isFigureName(name: string): name is FigureName {
  return (FIGURE_NAMES as readonly string[]).includes(name)
}

/**
 * A list item that is a figure line, or null for a sentence. A figure line with a name the app does not
 * draw throws: the lesson is wrong, not the reader.
 */
export function parseFigureItem(text: string, where = 'a lesson'): FigureItem | null {
  const m = FIGURE_LINE.exec(text.trim())
  if (!m) return null
  const name = m[1] ?? ''
  const caption = (m[2] ?? '').trim()
  if (!isFigureName(name)) throw new Error(`Training content "${where}": figure "${name}" is not drawn (the app draws: ${FIGURE_NAMES.join(', ')})`)
  if (!caption) throw new Error(`Training content "${where}": figure "${name}" has no caption`)
  return { figure: name, caption }
}

export type LessonItem = { kind: 'text'; text: string } | ({ kind: 'figure' } & FigureItem)

/** The items of a Must know or Traps list as the page draws them: a sentence, or a figure with its caption. */
export function lessonItems(items: readonly string[]): LessonItem[] {
  return items.map((text) => {
    const f = parseFigureItem(text)
    return f ? { kind: 'figure', ...f } : { kind: 'text', text }
  })
}

/** The words the plain-words rules read for an item: the sentence, or the figure's caption. */
export function itemWords(text: string): string {
  return parseFigureItem(text)?.caption ?? text
}
