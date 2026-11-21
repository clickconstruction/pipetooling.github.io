import type { FigureProps } from './figureProps'
import { Flame } from './hvacParts'
import { Flow, Label, Person, Pipe } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Carbon monoxide (Intro to HVAC, lesson 15): a water heater whose vent is blocked, the flame's gas spilling at the
 * draft hood into the room where a person stands, and the alarm on the wall. Red is the gas where it should not be.
 */
export function CoPath({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 174" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="0" y1="150" x2="300" y2="150" stroke="var(--text-muted)" strokeWidth="1.2" />
      <Pipe d="M62 60 V8" bore={9} tint="air" />
      <g stroke={WRONG} strokeWidth="2.4" strokeLinecap="round">
        <line x1="54" y1="22" x2="70" y2="36" />
        <line x1="70" y1="22" x2="54" y2="36" />
      </g>
      <rect x="40" y="74" width="44" height="76" rx="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M50 74 L55 62 H69 L74 74" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Flame x={62} y={146} size={0.7} />
      <g fill="none" stroke={WRONG} strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round">
        <path d="M76 64 C116 44 170 58 208 88" />
        <path d="M78 70 C116 84 166 96 206 112" />
      </g>
      <Flow x={211} y={90} angle={38} size={0.8} color={WRONG} />
      <Flow x={209} y={113} angle={20} size={0.8} color={WRONG} />
      <Person x={236} y={150} h={46} />
      <rect x="272" y="34" width="16" height="16" rx="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="280" cy="42" r="2" fill="currentColor" />
      <Label x={76} y={26} bold color={WRONG} size={8}>
        blocked vent
      </Label>
      <Label x={146} y={44} anchor="middle" size={7.5} color={WRONG}>
        the flame's gas spills here
      </Label>
      <Label x={98} y={66} size={6.5}>
        draft hood
      </Label>
      <Label x={280} y={62} anchor="middle" size={7}>
        alarm
      </Label>
      <Label x={254} y={116} size={6.5}>
        headache,
      </Label>
      <Label x={254} y={125} size={6.5}>
        dizzy, sleepy
      </Label>
      <Label x={150} y={166} anchor="middle" bold color="currentColor" size={7.5}>
        no colour, no smell, no taste
      </Label>
    </svg>
  )
}
