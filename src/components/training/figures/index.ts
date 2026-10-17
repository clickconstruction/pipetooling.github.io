import type { ComponentType } from 'react'
import type { FigureName } from '../../../lib/training/figures'
import type { FigureProps } from './figureProps'
import { ClearanceStack } from './ClearanceStack'
import { ControlsLadder } from './ControlsLadder'

/**
 * The drawings by the name a lesson uses (punch list #116). `figures.test.ts` holds these keys equal to
 * `FIGURE_NAMES` in `src/lib/training/figures.ts`, so a lesson can never name a figure the app does not draw
 * and the app never carries a drawing no lesson names. The drawings ride in the course page's lazy chunk only.
 */
export const FIGURES: Record<FigureName, ComponentType<FigureProps>> = {
  'clearance-stack': ClearanceStack,
  'controls-ladder': ControlsLadder,
}
