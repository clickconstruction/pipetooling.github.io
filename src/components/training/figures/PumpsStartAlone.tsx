import type { FigureProps } from './figureProps'
import { Conductor, Load, Receptacle } from './electricalParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The sump and the well pump (punch list #120), two frames: the sump in its pit with its float and its cord to a
 * GFCI outlet, starting when the water lifts the float; the well with its pressure tank and the pressure switch,
 * starting when the tank drops to 30 psi, the wire running down the well with the pipe. Lesson 17.
 */
export function PumpsStartAlone({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="the sump" sub="the float lifts, it starts">
        <line x1="8" y1="70" x2="138" y2="70" stroke="currentColor" strokeWidth="1.5" />
        <path d="M40 70 V128 H110 V70" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="40" y="70" width="70" height="30" fill="var(--surface)" stroke="none" />
        <line x1="40" y1="70" x2="40" y2="128" stroke="currentColor" strokeWidth="1.5" />
        <line x1="110" y1="70" x2="110" y2="128" stroke="currentColor" strokeWidth="1.5" />
        <Load x={62} y={116} kind="motor" />
        <line x1="72" y1="110" x2="92" y2="100" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="96" cy="98" r="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <Label x={104} y={101} size={6.5}>
          float
        </Label>
        <Pipe d="M62 106 V40 H138" bore={5} />
        <Conductor d="M66 106 Q80 66 118 62" />
        <Receptacle x={126} y={62} kind="gfci" />
        <Label x={100} y={33} anchor="middle" size={6.5}>
          its own GFCI outlet
        </Label>
        <Label x={28} y={60} anchor="middle" size={6.5}>
          120 V
        </Label>
        <Label x={75} y={140} anchor="middle" size={6.5}>
          the pit, with water in it
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="the well" sub="the pressure drops, it starts">
        <line x1="8" y1="100" x2="138" y2="100" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="100" width="130" height="44" fill="var(--bg-subtle)" stroke="none" />
        <rect x="24" y="100" width="12" height="42" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Load x={30} y={132} kind="motor" />
        <Pipe d="M30 122 V60 H70" bore={5} />
        <Conductor d="M34 122 V62 H78 V52" />
        <ellipse cx="90" cy="70" rx="16" ry="22" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="72" y="40" width="12" height="12" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Conductor d="M78 40 V34 H127 V44" />
        <rect x="120" y="44" width="14" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Label x={144} y={72} anchor="end" size={6.5}>
          control box
        </Label>
        <Label x={90} y={73} anchor="middle" size={6.5} color="var(--text-600)">
          tank
        </Label>
        <Label x={60} y={34} anchor="end" size={6.5}>
          pressure switch
        </Label>
        <Label x={118} y={97} anchor="middle" size={6.5}>
          30 psi on, 50 off
        </Label>
        <Label x={48} y={118} size={6.5}>
          240 V, down the well
        </Label>
        <Label x={48} y={127} size={6.5}>
          with the pipe
        </Label>
      </Panel>
    </svg>
  )
}
