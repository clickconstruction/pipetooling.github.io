import type { FigureProps } from './figureProps'
import { Conductor, Current, Load } from './electricalParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Volts, amps and watts in plain words (punch list #120), three frames with the water picture above and the
 * electrical one below: volts is the push, like the pressure a gauge reads; amps is the flow, like gallons a
 * minute down a pipe; watts is the work, the shower that needs both and the lamp that is lit. Lesson 4.
 */
export function VoltsAmpsWatts({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={140} title="volts" sub="the push">
        <Pipe d="M10 60 H86" />
        <circle cx="48" cy="40" r="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1="48" y1="50" x2="48" y2="57" stroke="currentColor" strokeWidth="2" />
        <line x1="48" y1="40" x2="54" y2="34" stroke="currentColor" strokeWidth="1.5" />
        <Label x={48} y={79} anchor="middle" size={7}>
          pressure, psi
        </Label>
        <Conductor d="M10 112 H86" />
        <Label x={48} y={104} anchor="middle" size={8} bold color="currentColor">
          120 V
        </Label>
        <Label x={48} y={128} anchor="middle" size={7}>
          how hard it pushes
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={140} title="amps" sub="the flow">
        <Pipe d="M10 60 H86" />
        <Flow x={30} y={60} />
        <Flow x={48} y={60} />
        <Flow x={66} y={60} />
        <Label x={48} y={79} anchor="middle" size={7}>
          gallons a minute
        </Label>
        <Conductor d="M10 112 H86" />
        <Current x={30} y={112} />
        <Current x={48} y={112} />
        <Current x={66} y={112} />
        <Label x={48} y={104} anchor="middle" size={8} bold color="currentColor">
          15 A
        </Label>
        <Label x={48} y={128} anchor="middle" size={7}>
          how much flows
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={140} title="watts" sub="the work">
        <Pipe d="M10 40 H48 V50" />
        <path d="M40 50 h16 l-3 5 h-10 z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <g stroke="var(--bg-blue-200)" strokeWidth="2" strokeLinecap="round">
          <line x1="42" y1="58" x2="38" y2="70" />
          <line x1="48" y1="58" x2="48" y2="72" />
          <line x1="54" y1="58" x2="58" y2="70" />
        </g>
        <Label x={48} y={82} anchor="middle" size={7}>
          the shower
        </Label>
        <Load x={48} y={112} kind="lamp" />
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="34" y1="98" x2="30" y2="94" />
          <line x1="62" y1="98" x2="66" y2="94" />
          <line x1="48" y1="96" x2="48" y2="90" />
        </g>
        <Label x={48} y={134} anchor="middle" size={8} bold color="currentColor">
          1,800 W
        </Label>
      </Panel>
      <Label x={150} y={156} anchor="middle" size={8.5} bold color="currentColor">
        volts × amps = watts
      </Label>
    </svg>
  )
}
