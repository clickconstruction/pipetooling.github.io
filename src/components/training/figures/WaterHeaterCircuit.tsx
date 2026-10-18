import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Load } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The water heater's circuit (punch list #120): two hots leave the panel on a two-pole breaker, run to the
 * disconnect by the heater and on through the whip into the tank, where the top thermostat feeds the top element
 * and hands off to the bottom one; no neutral anywhere. The plumber's side begins at the disconnect. Lesson 15.
 */
export function WaterHeaterCircuit({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="6" y="20" width="46" height="110" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={29} y={34} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M16 60 H26 M42 60 H120 V66" />
      <Conductor d="M16 76 H26 M42 76 H112 V66" />
      <Breaker x={34} y={60} amps={30} />
      <Breaker x={34} y={76} />
      <line x1="34" y1="60" x2="34" y2="76" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1" />
      <Label x={29} y={96} anchor="middle" size={6.5}>
        two-pole
      </Label>
      <Label x={29} y={105} anchor="middle" size={6.5}>
        10 AWG
      </Label>
      <rect x="104" y="66" width="24" height="26" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="110" y1="86" x2="118" y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Label x={116} y={103} anchor="middle" size={7} bold color="currentColor">
        disconnect
      </Label>
      <line x1="140" y1="14" x2="140" y2="146" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="4 3" />
      <Label x={136} y={150} anchor="end" size={7}>
        the electrician's
      </Label>
      <Label x={144} y={150} size={7} bold color="currentColor">
        the plumber's, dead first
      </Label>
      <Conductor d="M128 74 H150 V50 H170" />
      <Conductor d="M128 84 H146 V120 H170" />
      <Label x={168} y={44} anchor="end" size={6.5}>
        the whip
      </Label>
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="170" y="20" width="60" height="120" rx="10" fill="var(--bg-blue-200)" />
        <path d="M170 30 a10 10 0 0 1 10 -10 H220 a10 10 0 0 1 10 10 V80 H170 Z" fill="var(--bg-red-100)" stroke="none" />
        <rect x="170" y="20" width="60" height="120" rx="10" fill="none" />
      </g>
      <Load x={192} y={50} kind="element" w={28} h={14} />
      <Load x={192} y={120} kind="element" w={28} h={14} />
      <rect x="210" y="42" width="12" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="210" y="112" width="12" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Conductor d="M206 50 H210 M222 50 V112" />
      <Label x={236} y={40} size={6.5}>
        top thermostat
      </Label>
      <Label x={236} y={49} size={6.5}>
        runs first
      </Label>
      <Label x={236} y={58} size={6.5}>
        high-limit reset
      </Label>
      <Label x={236} y={116} size={6.5}>
        bottom thermostat
      </Label>
      <Label x={236} y={125} size={6.5}>
        runs next
      </Label>
      <Label x={196} y={82} anchor="middle" size={6} bold color="currentColor">
        240 V
      </Label>
      <Label x={196} y={91} anchor="middle" size={6}>
        no neutral
      </Label>
      <Label x={196} y={100} anchor="middle" size={6}>
        one at a time
      </Label>
    </svg>
  )
}
