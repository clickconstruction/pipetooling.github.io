import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The signs of a backdraft and the smoke test (Intro to HVAC, lesson 21), in two frames: the top of a water heater
 * with melted rings at its pipes, soot at the draft hood and streaks down its side; and smoke held at the hood,
 * pulled in as it should be.
 */
export function BackdraftSigns({ titleId }: FigureProps) {
  const top = (
    <>
      <Pipe d="M73 70 V30" bore={9} tint="air" />
      <path d="M40 110 V96 a12 12 0 0 1 12 -12 H94 a12 12 0 0 1 12 12 V110" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M61 84 L66 70 H80 L85 84" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Pipe d="M50 84 V64" bore={4} tint="cold" />
      <Pipe d="M96 84 V64" bore={4} tint="hot" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="the signs" sub="on top of the heater" subColor={WRONG}>
        {top}
        <g fill={WRONG} stroke="none">
          <ellipse cx="50" cy="86" rx="6" ry="2.6" />
          <ellipse cx="96" cy="86" rx="6" ry="2.6" />
        </g>
        <g fill="currentColor" stroke="none">
          <circle cx="60" cy="78" r="1.6" />
          <circle cx="64" cy="74" r="1.3" />
          <circle cx="84" cy="76" r="1.6" />
          <circle cx="88" cy="80" r="1.3" />
        </g>
        <g stroke={WRONG} strokeWidth="1.3" strokeLinecap="round">
          <line x1="42" y1="96" x2="42" y2="108" />
          <line x1="104" y1="94" x2="104" y2="108" />
        </g>
        <Label x={10} y={74} size={6.5}>
          melted
        </Label>
        <Label x={10} y={82} size={6.5}>
          rings
        </Label>
        <Label x={112} y={72} size={6.5}>
          soot
        </Label>
        <Label x={112} y={102} size={6.5}>
          streaks
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          the spilled gas is hot and wet
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          and it marks what it touches
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="the smoke test" sub="the smoke is pulled in" subColor={RIGHT}>
        {top}
        <Flow x={73} y={46} angle={-90} size={0.7} />
        <line x1="20" y1="96" x2="44" y2="80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.4 2" strokeLinecap="round">
          <path d="M46 78 C52 74 58 76 64 73" />
          <path d="M46 82 C54 80 58 80 63 77" />
        </g>
        <Label x={9} y={108} size={6.5}>
          smoke
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          a few minutes after it lights
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          smoke pushed out means a backdraft
        </Label>
      </Panel>
    </svg>
  )
}
