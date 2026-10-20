import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The inside of a toilet tank, cut open (punch list #119, second pass): the fill valve's tower with the float
 * riding it, the overflow tube standing above the water line, the flush valve under it with the flapper on its
 * seat, the refill tube from the fill valve clipped into the overflow tube, and the chain from the handle's lever
 * to the flapper. Lesson 20.
 */
export function ToiletTank({ titleId }: FigureProps) {
  const lead = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-muted)" strokeWidth="0.8" />
  return (
    <svg viewBox="0 0 300 176" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="60" y="14" width="160" height="138" rx="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" />
      <rect x="62" y="72" width="156" height="78" fill="var(--bg-blue-200)" stroke="none" />
      <line x1="62" y1="72" x2="218" y2="72" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
      <Pipe d="M100 174 V152" />
      <Flow x={100} y={166} angle={-90} />
      <rect x="95" y="48" width="10" height="104" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="89" y="40" width="22" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="85" y="62" width="30" height="20" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Pipe d="M111 45 Q138 45 160 54" bore={3} />
      <Flow x={150} y={51} angle={20} size={0.6} />
      <rect x="150" y="136" width="56" height="16" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="160" y="52" width="10" height="84" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M190 152 V174" bore={10} />
      <ellipse cx="190" cy="135" rx="13" ry="5" fill="var(--text-muted)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="190" cy="130" r="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
      <line x1="190" y1="128" x2="190" y2="32" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="60" y1="26" x2="190" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="22" width="16" height="7" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={40} y={18} anchor="end" size={7.5}>
        handle
      </Label>
      <Label x={54} y={46} anchor="end" size={7.5} bold color="currentColor">
        fill valve
      </Label>
      {lead(56, 44, 89, 44)}
      <Label x={54} y={75} anchor="end" size={7.5} bold color="currentColor">
        float
      </Label>
      {lead(56, 73, 85, 73)}
      <Label x={54} y={96} anchor="end" size={7}>
        the water line
      </Label>
      {lead(56, 93, 72, 73)}
      <Label x={92} y={171} anchor="end" size={7.5}>
        supply
      </Label>
      <Label x={226} y={50} size={7.5} bold color="currentColor">
        refill tube
      </Label>
      {lead(224, 48, 166, 52)}
      <Label x={226} y={92} size={7.5} bold color="currentColor">
        overflow tube
      </Label>
      {lead(224, 90, 171, 90)}
      <Label x={226} y={128} size={7.5} bold color="currentColor">
        flapper
      </Label>
      {lead(224, 126, 204, 132)}
      <Label x={226} y={150} size={7.5} bold color="currentColor">
        flush valve
      </Label>
      {lead(224, 148, 207, 146)}
      <Label x={198} y={171} size={7.5}>
        to the bowl
      </Label>
      <Label x={150} y={10} anchor="middle" size={7}>
        the lever and its chain
      </Label>
    </svg>
  )
}
