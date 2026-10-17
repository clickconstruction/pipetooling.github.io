import type { ComponentType } from 'react'
import type { FigureName } from '../../../lib/training/figures'
import type { FigureProps } from './figureProps'
import { CaveInSigns } from './CaveInSigns'
import { ClearanceStack } from './ClearanceStack'
import { ControlsLadder } from './ControlsLadder'
import { DigFlags } from './DigFlags'
import { ExcavatorSiteMap } from './ExcavatorSiteMap'
import { FireClasses } from './FireClasses'
import { ForkliftLoadCenter } from './ForkliftLoadCenter'
import { Guardrail } from './Guardrail'
import { HardHatMarkings } from './HardHatMarkings'
import { HazcomPictograms } from './HazcomPictograms'
import { LadderAngle } from './LadderAngle'
import { LiftingZone } from './LiftingZone'
import { NioshLabel } from './NioshLabel'
import { PoisonIvy } from './PoisonIvy'
import { PowerLineClearances } from './PowerLineClearances'
import { PpeLabels } from './PpeLabels'
import { SignColours } from './SignColours'
import { StackingLimits } from './StackingLimits'
import { SwingRadius } from './SwingRadius'
import { TrenchSection } from './TrenchSection'

/**
 * The drawings by the name a lesson uses (punch list #116). `figures.test.ts` holds these keys equal to
 * `FIGURE_NAMES` in `src/lib/training/figures.ts`, so a lesson can never name a figure the app does not draw
 * and the app never carries a drawing no lesson names. The drawings ride in the course page's lazy chunk only.
 */
export const FIGURES: Record<FigureName, ComponentType<FigureProps>> = {
  'cave-in-signs': CaveInSigns,
  'clearance-stack': ClearanceStack,
  'controls-ladder': ControlsLadder,
  'dig-flags': DigFlags,
  'excavator-site-map': ExcavatorSiteMap,
  'fire-classes': FireClasses,
  'forklift-load-center': ForkliftLoadCenter,
  guardrail: Guardrail,
  'hard-hat-markings': HardHatMarkings,
  'hazcom-pictograms': HazcomPictograms,
  'ladder-angle': LadderAngle,
  'lifting-zone': LiftingZone,
  'niosh-label': NioshLabel,
  'poison-ivy': PoisonIvy,
  'power-line-clearances': PowerLineClearances,
  'ppe-labels': PpeLabels,
  'sign-colours': SignColours,
  'stacking-limits': StackingLimits,
  'swing-radius': SwingRadius,
  'trench-section': TrenchSection,
}
