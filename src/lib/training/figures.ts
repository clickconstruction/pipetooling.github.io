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
  'attic-strip',
  'attic-way',
  'backdraft-signs',
  'backdraft-strip',
  'backfeed-strip',
  'ball-gate-check',
  'blocked-vent-strip',
  'boil-and-squeeze',
  'bonding-jumper',
  'branch-circuit',
  'cave-in-signs',
  'clear-the-drain',
  'clearance-stack',
  'clog-strip',
  'clogged-drain-strip',
  'closet-air',
  'co-path',
  'co-scale',
  'condensate-drain',
  'confined-space-roles',
  'controls-ladder',
  'cooling-loop',
  'copper-sweat-joint',
  'copper-types',
  'cross-connection-strip',
  'current-scale',
  'cut-line-set-strip',
  'cut-pipe-strip',
  'defrost',
  'dig-flags',
  'dishwasher-air-gap',
  'drain-end',
  'dry-trap-strip',
  'duct-faults',
  'dwv-materials',
  'excavator-site-map',
  'fall-timeline',
  'filter-and-stat',
  'fire-classes',
  'first-timer-mistakes',
  'five-touch-points',
  'fixture-valves',
  'flush-strip',
  'forklift-load-center',
  'four-defences',
  'freeze-strip',
  'frost-proof-bib',
  'frozen-coil-strip',
  'furnace-cutaway',
  'furnace-order',
  'gas-smell-strip',
  'gas-to-appliance',
  'gauge-and-chart',
  'gfci-compare',
  'gfci-trip-strip',
  'ground-path',
  'guardrail',
  'hand-signals',
  'hard-hat-limits',
  'hard-hat-markings',
  'hazcom-pictograms',
  'heat-moves',
  'heat-pump-reverse',
  'heat-stages',
  'heater-bond',
  'house-to-sewer',
  'hvac-mistakes',
  'ice-on-the-line',
  'indoor-unit',
  'inspector-electrical',
  'inspector-mechanical',
  'inspector-tests',
  'ladder-angle',
  'left-alone-on-the-vent',
  'licence-line',
  'lift-steps',
  'lifting-zone',
  'line-set',
  'line-set-care',
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
  'outdoor-unit',
  'oxygen-gauge',
  'p-trap-seal',
  'pan-and-float',
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
  'rough-set-start',
  'san-tee-vs-wye',
  'seal-check',
  'septic-tank',
  'service-and-meter',
  'shared-vent',
  'sign-colours',
  'silica-particle',
  'siphon-and-vent',
  'six-touch-points',
  'slope-rule',
  'soil-cube-car',
  'solvent-joint',
  'stacking-limits',
  'starts-alone-strip',
  'stud-setback',
  'subpanel',
  'supply-and-return',
  'supply-fittings',
  'sweeps-and-direction',
  'swing-radius',
  'switch-and-light',
  'test-before-touch',
  'the-card',
  'three-points',
  'three-visits',
  'three-way-switch',
  'tip-over',
  'toilet-rough-in',
  'toilet-tank',
  'trap-arm-drop',
  'trench-section',
  'tripped-breaker-strip',
  'trunk-vs-manifold',
  'two-flames',
  'two-furnaces',
  'two-power-cuts',
  'two-systems',
  'under-the-sink',
  'vent-or-recover',
  'vent-types',
  'volts-amps-watts',
  'water-hammer-strip',
  'water-heater-circuit',
  'water-heater-cutaway',
  'water-heater-no-power-strip',
  'water-meets-air',
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
