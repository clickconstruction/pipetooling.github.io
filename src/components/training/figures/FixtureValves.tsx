import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe, Sink, Valve } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The valves at the fixture and the hose (punch list #119): an angle stop on the hot and the cold riser under a sink,
 * so one line stops without the house; a hose bib through the wall with a vacuum breaker on its spout, so the hose
 * in a bucket cannot pull the bucket back into the house. Lesson 10.
 */
export function FixtureValves({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="0" y1="152" x2="140" y2="152" stroke="currentColor" strokeWidth="1.5" />
      <Sink x={76} y={54} w={48} />
      <Pipe d="M62 152 V74" tint="hot" />
      <Pipe d="M90 152 V74" />
      <Flow x={62} y={96} angle={-90} />
      <Flow x={90} y={96} angle={-90} />
      <g transform="rotate(90 62 122)">
        <Valve x={62} y={122} kind="stop" tint="hot" />
      </g>
      <g transform="rotate(90 90 122)">
        <Valve x={90} y={122} kind="stop" />
      </g>
      <Label x={76} y={26} anchor="middle" bold color="currentColor">
        under the sink
      </Label>
      <Label x={40} y={128} anchor="end" size={8} color="#b91c1c">
        hot
      </Label>
      <Label x={112} y={128} size={8} color="#2563eb">
        cold
      </Label>
      <Label x={4} y={104} size={7.5}>
        an angle stop
      </Label>
      <Label x={4} y={113} size={7.5}>
        on each line
      </Label>
      <g stroke="currentColor" strokeWidth="1.5" fill="var(--bg-subtle)">
        <rect x="160" y="20" width="14" height="132" />
      </g>
      <Label x={150} y={32} anchor="end" size={8}>
        inside
      </Label>
      <Label x={184} y={32} size={8}>
        outside
      </Label>
      <Pipe d="M150 70 H208" />
      <Flow x={190} y={70} />
      <Valve x={222} y={70} kind="stop" />
      <Pipe d="M230 70 h12 v16" />
      <rect x="236" y="86" width="12" height="9" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M242 95 q4 30 20 40 q14 10 14 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M242 95 q4 30 20 40 q14 10 14 20" fill="none" stroke="var(--bg-blue-200)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M262 140 h30 l-3 18 h-24 z" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
      <Flow x={252} y={118} angle={-120} color={WRONG} />
      <line x1="238" y1="104" x2="246" y2="112" stroke={WRONG} strokeWidth="2" />
      <line x1="246" y1="104" x2="238" y2="112" stroke={WRONG} strokeWidth="2" />
      <Label x={252} y={62} anchor="middle" size={8} bold color="currentColor">
        hose bib
      </Label>
      <Label x={252} y={84} size={8}>
        vacuum
      </Label>
      <Label x={252} y={93} size={8}>
        breaker
      </Label>
      <Label x={178} y={128} size={7.5}>
        the bucket
      </Label>
      <Label x={178} y={137} size={7.5}>
        cannot come back
      </Label>
    </svg>
  )
}
