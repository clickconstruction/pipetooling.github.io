import type { FigureProps } from './figureProps'
import { Flame } from './hvacParts'
import { Label } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Refrigerants and the card (Intro to HVAC, lesson 7): three tanks for the three refrigerants a crew meets, the
 * old R-22, R-410A and the new A2L kinds with a flame beside them, and the EPA Section 608 card it takes to open
 * a loop holding any of them.
 */
export function TheCard({ titleId }: FigureProps) {
  const tank = (cx: number) => (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x={cx - 5} y="26" width="10" height="8" fill="var(--surface)" />
      <rect x={cx - 18} y="34" width="36" height="62" rx="12" fill="var(--bg-subtle)" />
      <rect x={cx - 18} y="56" width="36" height="16" fill="var(--surface)" strokeWidth="1" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {tank(42)}
      {tank(112)}
      {tank(182)}
      <Flame x={212} y={94} size={0.9} />
      <Label x={42} y={67} anchor="middle" bold color="currentColor" size={7.5}>
        R-22
      </Label>
      <Label x={112} y={67} anchor="middle" bold color="currentColor" size={7.5}>
        R-410A
      </Label>
      <Label x={182} y={67} anchor="middle" bold color="currentColor" size={7.5}>
        A2L
      </Label>
      <Label x={42} y={110} anchor="middle" size={6.5}>
        the old one
      </Label>
      <Label x={42} y={119} anchor="middle" size={6.5}>
        none made since 2020
      </Label>
      <Label x={112} y={110} anchor="middle" size={6.5}>
        most systems
      </Label>
      <Label x={112} y={119} anchor="middle" size={6.5}>
        does not burn
      </Label>
      <Label x={186} y={110} anchor="middle" size={6.5}>
        R-32 and R-454B
      </Label>
      <Label x={186} y={119} anchor="middle" size={6.5} color={WRONG}>
        can burn
      </Label>
      <g>
        <rect x="236" y="42" width="56" height="36" rx="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1="242" y1="66" x2="270" y2="66" stroke="var(--text-muted)" strokeWidth="1" />
        <line x1="242" y1="71" x2="262" y2="71" stroke="var(--text-muted)" strokeWidth="1" />
        <Label x={264} y={56} anchor="middle" bold color="currentColor" size={8}>
          EPA 608
        </Label>
        <Label x={264} y={92} anchor="middle" bold color="currentColor" size={7.5}>
          the card
        </Label>
        <Label x={264} y={101} anchor="middle" size={6.5}>
          to open any loop
        </Label>
      </g>
    </svg>
  )
}
