import type { FigureProps } from './figureProps'
import { Conductor, Receptacle } from './electricalParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * What the inspector looks at (punch list #120), four frames: the jumper around the water meter, the water
 * heater's disconnect within sight of it, the 36 in clear in front of the panel, and the GFCI faces near water.
 * A tick on each one; one missing jumper fails the job. Lesson 29.
 */
export function InspectorElectrical({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const tick = <path d="M52 36 l4 4 l8 -9" fill="none" stroke={RIGHT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="the jumper" sub="around the meter">
        {tick}
        <Pipe d="M6 90 H66" />
        <rect x="28" y="82" width="16" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <Conductor d="M22 86 V70 H50 V86" wire="ground" />
        <Label x={36} y={122} anchor="middle" size={6.5}>
          one missing
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          fails the job
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="disconnect" sub="in sight of it">
        {tick}
        <rect x="38" y="60" width="22" height="50" rx="6" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.3" />
        <rect x="12" y="62" width="14" height="18" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <line x1="16" y1="76" x2="22" y2="66" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <Conductor d="M26 71 H38" />
        <Label x={36} y={122} anchor="middle" size={6.5}>
          in some cycles
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          the company's rule
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="36 in clear" sub="before the panel">
        {tick}
        <rect x="26" y="52" width="20" height="30" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <rect x="18" y="86" width="36" height="24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 2" />
        <Label x={36} y={101} anchor="middle" size={6} color="var(--text-muted)">
          nothing here
        </Label>
        <Label x={36} y={122} anchor="middle" size={6.5}>
          no shelf, no heater
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="the GFCIs" sub="near water">
        {tick}
        <Receptacle x={24} y={78} kind="gfci" />
        <Receptacle x={50} y={78} kind="gfci" />
        <Label x={36} y={122} anchor="middle" size={6.5}>
          near every sink
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          AFCIs by room
        </Label>
      </Panel>
    </svg>
  )
}
