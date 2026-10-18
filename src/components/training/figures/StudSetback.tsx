import type { FigureProps } from './figureProps'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The cable in the stud (punch list #120, v2.5620), two frames seen from above: the cable bored through the
 * middle of the stud sits 1-1/4 in back from the face, so a screw through the drywall stops short of it; a cable
 * closer than that gets a steel nail plate on the face, and the screw stops at the plate. Lesson 28.
 */
export function StudSetback({ titleId }: FigureProps) {
  const stud = (cableX: number) => (
    <g>
      <rect x="30" y="40" width="40" height="92" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="24" y1="40" x2="24" y2="132" stroke="currentColor" strokeWidth="3" />
      <circle cx={cableX} cy="86" r="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <circle cx={cableX} cy="86" r="2" fill="currentColor" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="in the middle" sub="the screw misses it" subColor={RIGHT}>
        {stud(50)}
        <line x1="24" y1="56" x2="44" y2="56" stroke={RIGHT} strokeWidth="1.2" />
        <line x1="24" y1="52" x2="24" y2="60" stroke={RIGHT} strokeWidth="1.2" />
        <line x1="44" y1="52" x2="44" y2="60" stroke={RIGHT} strokeWidth="1.2" />
        <Label x={48} y={50} size={6.5} color={RIGHT}>
          1-1/4 in
        </Label>
        <line x1="6" y1="112" x2="38" y2="112" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <Label x={88} y={90} size={6.5}>
          the cable
        </Label>
        <Label x={88} y={99} size={6.5}>
          set back
        </Label>
        <Label x={76} y={122} size={6.5}>
          a normal screw
        </Label>
        <Label x={76} y={131} size={6.5}>
          stops short
        </Label>
        <Label x={12} y={34} size={6.5}>
          drywall
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="too close" sub="a steel plate covers it" subColor={WRONG}>
        {stud(36)}
        <rect x="20" y="70" width="5" height="32" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.3" />
        <line x1="6" y1="86" x2="18" y2="86" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <Label x={80} y={80} size={6.5} bold color="currentColor">
          the nail plate
        </Label>
        <Label x={80} y={89} size={6.5}>
          on the face
        </Label>
        <Label x={80} y={110} size={6.5}>
          the screw stops
        </Label>
        <Label x={80} y={119} size={6.5}>
          at the plate
        </Label>
        <Label x={80} y={138} size={6.5} color={WRONG}>
          a cable is behind it
        </Label>
      </Panel>
    </svg>
  )
}
