import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * A septic tank cut open (punch list #119, second pass): the house's drain comes in past the inlet baffle, the
 * solids settle to the bottom and the scum floats, the liquid leaves under the outlet baffle to the drain field,
 * where perforated pipe in gravel lets it soak away. Lesson 16.
 */
export function SepticTank({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="0" y1="40" x2="300" y2="40" stroke="currentColor" strokeWidth="1.2" />
      <rect x="70" y="46" width="120" height="84" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" />
      <rect x="72" y="64" width="116" height="64" fill="var(--bg-amber-100)" stroke="none" />
      <rect x="72" y="64" width="116" height="7" fill="var(--bg-subtle)" stroke="none" />
      <rect x="72" y="112" width="116" height="16" fill="var(--text-muted)" stroke="none" opacity="0.55" />
      <Pipe d="M0 58 H82" bore={DRAIN} tint="waste" />
      <Flow x={30} y={58} />
      <rect x="82" y="52" width="6" height="36" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="172" y="52" width="6" height="42" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M178 62 H232" bore={9} tint="waste" />
      <Flow x={210} y={62} />
      <rect x="226" y="48" width="72" height="66" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <Pipe d="M232 56 V104" bore={7} tint="waste" />
      <Pipe d="M232 62 H296" bore={6} tint="waste" dash="5 3" />
      <Pipe d="M232 82 H296" bore={6} tint="waste" dash="5 3" />
      <Pipe d="M232 102 H296" bore={6} tint="waste" dash="5 3" />
      <Flow x={250} y={110} angle={90} color="var(--text-muted)" size={0.7} />
      <Flow x={270} y={110} angle={90} color="var(--text-muted)" size={0.7} />
      <Flow x={290} y={110} angle={90} color="var(--text-muted)" size={0.7} />
      <Label x={4} y={36} size={7}>
        ground
      </Label>
      <Label x={4} y={74} size={7.5}>
        from the house
      </Label>
      <Label x={130} y={34} anchor="middle" size={8} bold color="currentColor">
        septic tank, often 1,000 gal
      </Label>
      <Label x={130} y={84} anchor="middle" size={7}>
        scum floats
      </Label>
      <Label x={130} y={100} anchor="middle" size={7.5}>
        liquid
      </Label>
      <Label x={130} y={124} anchor="middle" size={7} color="var(--surface)">
        solids settle
      </Label>
      <Label x={85} y={142} anchor="middle" size={7}>
        inlet baffle
      </Label>
      <Label x={175} y={142} anchor="middle" size={7}>
        outlet baffle
      </Label>
      <Label x={262} y={36} anchor="middle" size={7.5} bold color="currentColor">
        drain field
      </Label>
      <Label x={262} y={126} anchor="middle" size={7}>
        the liquid soaks away
      </Label>
    </svg>
  )
}
