import type { ComponentType } from 'react'
import type { FigureName } from '../../../lib/training/figures'
import type { FigureProps } from './figureProps'
import { ArcFlashCategories } from './ArcFlashCategories'
import { CaveInSigns } from './CaveInSigns'
import { ClearanceStack } from './ClearanceStack'
import { ControlsLadder } from './ControlsLadder'
import { CurrentScale } from './CurrentScale'
import { DigFlags } from './DigFlags'
import { ExcavatorSiteMap } from './ExcavatorSiteMap'
import { FallTimeline } from './FallTimeline'
import { FireClasses } from './FireClasses'
import { ForkliftLoadCenter } from './ForkliftLoadCenter'
import { Guardrail } from './Guardrail'
import { HardHatLimits } from './HardHatLimits'
import { HardHatMarkings } from './HardHatMarkings'
import { HazcomPictograms } from './HazcomPictograms'
import { HeatStages } from './HeatStages'
import { LadderAngle } from './LadderAngle'
import { LiftingZone } from './LiftingZone'
import { NioshLabel } from './NioshLabel'
import { NoiseByTool } from './NoiseByTool'
import { OxygenGauge } from './OxygenGauge'
import { PoisonIvy } from './PoisonIvy'
import { PowerLineClearances } from './PowerLineClearances'
import { PpeLabels } from './PpeLabels'
import { SignColours } from './SignColours'
import { SilicaParticle } from './SilicaParticle'
import { SoilCubeCar } from './SoilCubeCar'
import { StackingLimits } from './StackingLimits'
import { SwingRadius } from './SwingRadius'
import { TrenchSection } from './TrenchSection'

/**
 * The drawings by the name a lesson uses (punch list #116). `figures.test.ts` holds these keys equal to
 * `FIGURE_NAMES` in `src/lib/training/figures.ts`, so a lesson can never name a figure the app does not draw
 * and the app never carries a drawing no lesson names. The drawings ride in the course page's lazy chunk only.
 */
export const FIGURES: Record<FigureName, ComponentType<FigureProps>> = {
  'arc-flash-categories': ArcFlashCategories,
  'cave-in-signs': CaveInSigns,
  'clearance-stack': ClearanceStack,
  'controls-ladder': ControlsLadder,
  'current-scale': CurrentScale,
  'dig-flags': DigFlags,
  'excavator-site-map': ExcavatorSiteMap,
  'fall-timeline': FallTimeline,
  'fire-classes': FireClasses,
  'forklift-load-center': ForkliftLoadCenter,
  guardrail: Guardrail,
  'hard-hat-limits': HardHatLimits,
  'hard-hat-markings': HardHatMarkings,
  'hazcom-pictograms': HazcomPictograms,
  'heat-stages': HeatStages,
  'ladder-angle': LadderAngle,
  'lifting-zone': LiftingZone,
  'niosh-label': NioshLabel,
  'noise-by-tool': NoiseByTool,
  'oxygen-gauge': OxygenGauge,
  'poison-ivy': PoisonIvy,
  'power-line-clearances': PowerLineClearances,
  'ppe-labels': PpeLabels,
  'sign-colours': SignColours,
  'silica-particle': SilicaParticle,
  'soil-cube-car': SoilCubeCar,
  'stacking-limits': StackingLimits,
  'swing-radius': SwingRadius,
  'trench-section': TrenchSection,
}
