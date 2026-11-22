import type { FigureProps } from './figureProps'
import { Box, Flame } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The water heater left alone on a shared vent (Intro to HVAC, lesson 14), in two frames: a furnace and a water
 * heater on one vent that stays hot and draws; and the furnace gone to its own plastic vent, the water heater alone
 * on a vent too big to warm, its gas spilling at the draft hood in the house red.
 */
export function LeftAloneOnTheVent({ titleId }: FigureProps) {
  const heater = (
    <>
      <rect x="96" y="104" width="30" height="34" rx="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M103 104 L106 95 H116 L119 104" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Flame x={111} y={135} size={0.5} />
    </>
  )
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={168} title="two on one vent" sub="it stays hot and draws" subColor={RIGHT}>
        <Pipe d="M73 78 V32" bore={10} tint="hot" />
        <Pipe d="M33 104 V92 L73 78" bore={6} tint="hot" />
        <Pipe d="M111 93 V90 L73 78" bore={6} tint="hot" />
        <Flow x={73} y={52} angle={-90} size={0.8} />
        <Box x={16} y={104} w={34} h={34} />
        <Flame x={33} y={135} size={0.5} />
        {heater}
        <Label x={33} y={150} anchor="middle" size={6.5}>
          furnace
        </Label>
        <Label x={111} y={150} anchor="middle" size={6.5}>
          water heater
        </Label>
        <Label x={73} y={162} anchor="middle" size={7}>
          sized for the two together
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={168} title="the furnace is gone" sub="too big, and cold" subColor={WRONG}>
        <Pipe d="M73 78 V32" bore={10} tint="air" />
        <Pipe d="M111 93 V90 L73 78" bore={6} tint="air" />
        <Pipe d="M73 78 L52 85" bore={6} tint="air" />
        <rect x="45" y="80" width="5" height="12" rx="1" fill="currentColor" transform="rotate(-18 48 86)" />
        <Flow x={73} y={56} angle={90} size={0.8} color={WRONG} />
        <Box x={16} y={104} w={34} h={34} dash="4 3" />
        <Pipe d="M16 114 H6" bore={5} tint="cold" />
        {heater}
        <g fill="none" stroke={WRONG} strokeWidth="1.5" strokeDasharray="3 2.4" strokeLinecap="round">
          <path d="M120 98 C132 92 138 102 138 114" />
          <path d="M102 98 C92 94 86 104 86 114" />
        </g>
        <Label x={33} y={150} anchor="middle" size={6.5}>
          its own vent
        </Label>
        <Label x={111} y={150} anchor="middle" size={6.5} color={WRONG}>
          it spills
        </Label>
        <Label x={73} y={162} anchor="middle" size={7}>
          the water heater cannot warm it
        </Label>
      </Panel>
    </svg>
  )
}
