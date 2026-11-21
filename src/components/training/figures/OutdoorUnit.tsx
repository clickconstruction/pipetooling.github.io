import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Air, Box, Compressor } from './hvacParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The outdoor unit (Intro to HVAC, lesson 4): the condensing unit on its pad, outdoor air pulled in through the
 * coil on its sides and blown hot out the top, the compressor and the capacitor inside, and the disconnect on the
 * house wall with the 240 V feed.
 */
export function OutdoorUnit({ titleId }: FigureProps) {
  const louvres = [84, 92, 100, 108, 116, 124, 132, 140]
  return (
    <svg viewBox="0 0 300 176" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="0" y="20" width="34" height="136" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="156" x2="300" y2="156" stroke="var(--text-muted)" strokeWidth="1.2" />
      <rect x="112" y="150" width="106" height="6" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
      <Conductor d="M40 78 H70 V140 H120" />
      <Box x={120} y={74} w={90} h={76} />
      {louvres.map((ly) => (
        <g key={ly} stroke="var(--text-muted)" strokeWidth="1">
          <line x1="124" y1={ly} x2="138" y2={ly} />
          <line x1="192" y1={ly} x2="206" y2={ly} />
        </g>
      ))}
      <ellipse cx="165" cy="74" rx="30" ry="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <Compressor x={165} y={118} />
      <rect x="144" y="84" width="7" height="12" rx="2" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.1" />
      <rect x="22" y="64" width="18" height="26" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="27" y1="84" x2="35" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Air x={152} y={64} angle={-90} len={24} tint="warm" />
      <Air x={178} y={64} angle={-90} len={24} tint="warm" />
      <Air x={90} y={104} len={26} />
      <Air x={240} y={104} angle={180} len={26} />
      <Label x={165} y={30} anchor="middle" bold color="currentColor">
        the heat leaves
      </Label>
      <Label x={254} y={92} anchor="middle" size={7}>
        outdoor air in
      </Label>
      <Label x={46} y={58} bold color="currentColor" size={8}>
        disconnect
      </Label>
      <Label x={76} y={136} size={7}>
        240 V
      </Label>
      <Label x={155} y={93} size={6.5} bold color="currentColor">
        capacitor
      </Label>
      <Label x={165} y={145} anchor="middle" size={6.5}>
        compressor
      </Label>
      <Label x={165} y={170} anchor="middle" size={7}>
        level on its pad, clear space all round
      </Label>
    </svg>
  )
}
