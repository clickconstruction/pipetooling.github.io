import type { ComponentType } from 'react'
import type { FigureName } from '../../../lib/training/figures'
import type { FigureProps } from './figureProps'
import { ArcFlashCategories } from './ArcFlashCategories'
import { CaveInSigns } from './CaveInSigns'
import { ClearanceStack } from './ClearanceStack'
import { ConfinedSpaceRoles } from './ConfinedSpaceRoles'
import { ControlsLadder } from './ControlsLadder'
import { CurrentScale } from './CurrentScale'
import { DigFlags } from './DigFlags'
import { ExcavatorSiteMap } from './ExcavatorSiteMap'
import { FallTimeline } from './FallTimeline'
import { FireClasses } from './FireClasses'
import { ForkliftLoadCenter } from './ForkliftLoadCenter'
import { Guardrail } from './Guardrail'
import { HandSignals } from './HandSignals'
import { HardHatLimits } from './HardHatLimits'
import { HardHatMarkings } from './HardHatMarkings'
import { HazcomPictograms } from './HazcomPictograms'
import { HeatStages } from './HeatStages'
import { LadderAngle } from './LadderAngle'
import { LiftSteps } from './LiftSteps'
import { LiftingZone } from './LiftingZone'
import { NioshLabel } from './NioshLabel'
import { NoiseByTool } from './NoiseByTool'
import { OxygenGauge } from './OxygenGauge'
import { PassSteps } from './PassSteps'
import { PoisonIvy } from './PoisonIvy'
import { PowerLineClearances } from './PowerLineClearances'
import { PpeLabels } from './PpeLabels'
import { SealCheck } from './SealCheck'
import { SignColours } from './SignColours'
import { SilicaParticle } from './SilicaParticle'
import { SoilCubeCar } from './SoilCubeCar'
import { StackingLimits } from './StackingLimits'
import { SwingRadius } from './SwingRadius'
import { ThreePoints } from './ThreePoints'
import { TipOver } from './TipOver'
import { TrenchSection } from './TrenchSection'

/**
 * The drawings by the name a lesson uses (punch list #116). `figures.test.ts` holds these keys equal to
 * `FIGURE_NAMES` in `src/lib/training/figures.ts`, so a lesson can never name a figure the app does not draw
 * and the app never carries a drawing no lesson names. The drawings ride in the course page's lazy chunk only.
 */
import { BallGateCheck } from './BallGateCheck'
import { CopperSweatJoint } from './CopperSweatJoint'
import { FixtureValves } from './FixtureValves'
import { MeterAndMainShutoff } from './MeterAndMainShutoff'
import { PexJoints } from './PexJoints'
import { PressureAndPrv } from './PressureAndPrv'
import { SolventJoint } from './SolventJoint'
import { SupplyFittings } from './SupplyFittings'
import { TrunkVsManifold } from './TrunkVsManifold'
import { TwoSystems } from './TwoSystems'
import { WaterHeaterCutaway } from './WaterHeaterCutaway'

import { SlopeRule } from './SlopeRule'
import { PTrapSeal } from './PTrapSeal'
import { SiphonAndVent } from './SiphonAndVent'
import { VentTypes } from './VentTypes'
import { HouseToSewer } from './HouseToSewer'
import { SanTeeVsWye } from './SanTeeVsWye'
import { SweepsAndDirection } from './SweepsAndDirection'
import { DwvMaterials } from './DwvMaterials'

import { FlushStrip } from './FlushStrip'
import { ClogStrip } from './ClogStrip'
import { DryTrapStrip } from './DryTrapStrip'
import { BlockedVentStrip } from './BlockedVentStrip'
import { PressureDropStrip } from './PressureDropStrip'
import { FreezeStrip } from './FreezeStrip'
import { WaterHammerStrip } from './WaterHammerStrip'
import { CrossConnectionStrip } from './CrossConnectionStrip'

import { ThreeVisits } from './ThreeVisits'
import { InspectorTests } from './InspectorTests'
import { FirstTimerMistakes } from './FirstTimerMistakes'

import { OneLoop } from './OneLoop'
import { NeutralVsGround } from './NeutralVsGround'
import { BondingJumper } from './BondingJumper'

import { ServiceAndMeter } from './ServiceAndMeter'
import { MainPanel } from './MainPanel'
import { VoltsAmpsWatts } from './VoltsAmpsWatts'
import { OneTwentyTwoForty } from './OneTwentyTwoForty'
import { GroundPath } from './GroundPath'
import { BranchCircuit } from './BranchCircuit'
import { WireAndBreaker } from './WireAndBreaker'

import { ReceptacleFaces } from './ReceptacleFaces'
import { SwitchAndLight } from './SwitchAndLight'
import { GfciCompare } from './GfciCompare'
import { AfciListens } from './AfciListens'
import { WaterHeaterCircuit } from './WaterHeaterCircuit'
import { UnderTheSink } from './UnderTheSink'
import { PumpsStartAlone } from './PumpsStartAlone'
import { LowVoltageWorld } from './LowVoltageWorld'

export const FIGURES: Record<FigureName, ComponentType<FigureProps>> = {
  'arc-flash-categories': ArcFlashCategories,
  'cave-in-signs': CaveInSigns,
  'clearance-stack': ClearanceStack,
  'confined-space-roles': ConfinedSpaceRoles,
  'controls-ladder': ControlsLadder,
  'current-scale': CurrentScale,
  'dig-flags': DigFlags,
  'excavator-site-map': ExcavatorSiteMap,
  'fall-timeline': FallTimeline,
  'fire-classes': FireClasses,
  'forklift-load-center': ForkliftLoadCenter,
  guardrail: Guardrail,
  'hand-signals': HandSignals,
  'hard-hat-limits': HardHatLimits,
  'hard-hat-markings': HardHatMarkings,
  'hazcom-pictograms': HazcomPictograms,
  'heat-stages': HeatStages,
  'ladder-angle': LadderAngle,
  'lift-steps': LiftSteps,
  'lifting-zone': LiftingZone,
  'niosh-label': NioshLabel,
  'noise-by-tool': NoiseByTool,
  'oxygen-gauge': OxygenGauge,
  'pass-steps': PassSteps,
  'poison-ivy': PoisonIvy,
  'power-line-clearances': PowerLineClearances,
  'ppe-labels': PpeLabels,
  'seal-check': SealCheck,
  'sign-colours': SignColours,
  'silica-particle': SilicaParticle,
  'soil-cube-car': SoilCubeCar,
  'stacking-limits': StackingLimits,
  'swing-radius': SwingRadius,
  'three-points': ThreePoints,
  'tip-over': TipOver,
  'trench-section': TrenchSection,
  'ball-gate-check': BallGateCheck,
  'copper-sweat-joint': CopperSweatJoint,
  'fixture-valves': FixtureValves,
  'meter-and-main-shutoff': MeterAndMainShutoff,
  'pex-joints': PexJoints,
  'pressure-and-prv': PressureAndPrv,
  'solvent-joint': SolventJoint,
  'supply-fittings': SupplyFittings,
  'trunk-vs-manifold': TrunkVsManifold,
  'two-systems': TwoSystems,
  'water-heater-cutaway': WaterHeaterCutaway,
  'slope-rule': SlopeRule,
  'p-trap-seal': PTrapSeal,
  'siphon-and-vent': SiphonAndVent,
  'vent-types': VentTypes,
  'house-to-sewer': HouseToSewer,
  'san-tee-vs-wye': SanTeeVsWye,
  'sweeps-and-direction': SweepsAndDirection,
  'dwv-materials': DwvMaterials,
  'flush-strip': FlushStrip,
  'clog-strip': ClogStrip,
  'dry-trap-strip': DryTrapStrip,
  'blocked-vent-strip': BlockedVentStrip,
  'pressure-drop-strip': PressureDropStrip,
  'freeze-strip': FreezeStrip,
  'water-hammer-strip': WaterHammerStrip,
  'cross-connection-strip': CrossConnectionStrip,
  'three-visits': ThreeVisits,
  'inspector-tests': InspectorTests,
  'first-timer-mistakes': FirstTimerMistakes,
  'one-loop': OneLoop,
  'neutral-vs-ground': NeutralVsGround,
  'bonding-jumper': BondingJumper,
  'service-and-meter': ServiceAndMeter,
  'main-panel': MainPanel,
  'volts-amps-watts': VoltsAmpsWatts,
  'one-twenty-two-forty': OneTwentyTwoForty,
  'ground-path': GroundPath,
  'branch-circuit': BranchCircuit,
  'wire-and-breaker': WireAndBreaker,
  'receptacle-faces': ReceptacleFaces,
  'switch-and-light': SwitchAndLight,
  'gfci-compare': GfciCompare,
  'afci-listens': AfciListens,
  'water-heater-circuit': WaterHeaterCircuit,
  'under-the-sink': UnderTheSink,
  'pumps-start-alone': PumpsStartAlone,
  'low-voltage-world': LowVoltageWorld,
}
