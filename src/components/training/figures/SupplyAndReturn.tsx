import type { FigureProps } from './figureProps'
import { Air, Box } from './hvacParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Ducts, supply and return (Intro to HVAC, lesson 16): a house in section with the indoor unit in the attic, the
 * return duct bringing room air back from one room, the plenum on the unit where the supply duct begins, and that
 * duct carrying cooled air out to the other.
 */
export function SupplyAndReturn({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M6 92 L150 10 L294 92" />
        <path d="M18 92 V156 H282 V92" />
        <line x1="18" y1="92" x2="282" y2="92" />
        <line x1="150" y1="92" x2="150" y2="156" />
      </g>
      <Pipe d="M60 92 V66 H130" bore={12} tint="hot" />
      <Pipe d="M188 66 H240 V92" bore={12} tint="cold" />
      <Box x={130} y={50} w={40} h={32} />
      <Box x={170} y={54} w={18} h={24} fill="var(--bg-subtle)" />
      <Flow x={96} y={66} size={0.8} />
      <Flow x={214} y={66} size={0.8} />
      <line x1="48" y1="92" x2="72" y2="92" stroke="currentColor" strokeWidth="4" strokeDasharray="2 2" />
      <line x1="228" y1="92" x2="252" y2="92" stroke="currentColor" strokeWidth="4" strokeDasharray="2 2" />
      <Air x={60} y={126} angle={-90} len={24} tint="warm" />
      <Air x={240} y={100} angle={90} len={24} tint="cool" />
      <Label x={150} y={64} anchor="middle" size={6.5}>
        indoor
      </Label>
      <Label x={150} y={73} anchor="middle" size={6.5}>
        unit
      </Label>
      <Label x={179} y={49} anchor="middle" size={6.5}>
        plenum
      </Label>
      <Label x={100} y={86} anchor="middle" bold color="currentColor" size={8}>
        return
      </Label>
      <Label x={212} y={86} anchor="middle" bold color="currentColor" size={8}>
        supply
      </Label>
      <Label x={84} y={140} anchor="middle" size={7}>
        room air back
      </Label>
      <Label x={84} y={149} anchor="middle" size={6.5}>
        through the return grille
      </Label>
      <Label x={216} y={140} anchor="middle" size={7}>
        cooled air out
      </Label>
      <Label x={216} y={149} anchor="middle" size={6.5}>
        at the register
      </Label>
      <Label x={150} y={168} anchor="middle" size={7}>
        what goes out must come back
      </Label>
    </svg>
  )
}
