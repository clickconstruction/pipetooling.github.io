import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Load, Receptacle } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The branch circuit (punch list #120): one breaker in the panel, one wire run, and the outlets and the light on
 * it; a second breaker below feeds a second run, so what shares a breaker goes dead with it and nothing else does.
 * Lesson 9.
 */
export function BranchCircuit({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="4" y="10" width="40" height="126" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={24} y={24} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M14 44 H22 M38 44 H260" />
      <Breaker x={30} y={44} amps={20} />
      <Conductor d="M100 44 V58" />
      <Receptacle x={100} y={73} />
      <Conductor d="M160 44 V58" />
      <Receptacle x={160} y={73} />
      <Conductor d="M220 44 V58" />
      <Receptacle x={220} y={73} />
      <Conductor d="M260 44 V58" />
      <Load x={260} y={68} kind="lamp" />
      <path d="M86 92 V97 H274 V92" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" />
      <Label x={180} y={107} anchor="middle" size={7.5} bold color="currentColor">
        one breaker, one wire run, the outlets on it
      </Label>
      <Label x={180} y={116} anchor="middle" size={7}>
        20 A is the most the wire may carry
      </Label>
      <Conductor d="M14 128 H22 M38 128 H70" />
      <Breaker x={30} y={128} amps={15} />
      <Label x={74} y={131} size={7}>
        another circuit
      </Label>
    </svg>
  )
}
