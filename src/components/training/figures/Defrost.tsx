import type { FigureProps } from './figureProps'
import { Box, Drop, Fan } from './hvacParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * The defrost (Intro to HVAC, lesson 10), in two frames: a heat pump's outdoor unit in heating with frost growing
 * on its coil; and the same unit a few minutes into a defrost, the frost leaving as water and steam.
 */
export function Defrost({ titleId }: FigureProps) {
  const unit = (
    <>
      <Box x={44} y={56} w={58} h={54} />
      <Fan x={73} y={83} r={15} />
      <line x1="30" y1="110" x2="116" y2="110" stroke="var(--text-muted)" strokeWidth="1.2" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="heating" sub="frost grows on the coil">
        {unit}
        <g fill="var(--bg-sky-100)" stroke="currentColor" strokeWidth="0.8">
          <rect x="40" y="60" width="9" height="46" rx="3" />
          <rect x="97" y="60" width="9" height="46" rx="3" />
          <rect x="52" y="52" width="42" height="7" rx="3" />
        </g>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          the outdoor coil is the cold one
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          so the air's damp freezes on it
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="defrost" sub="a few minutes, and normal" subColor={RIGHT}>
        {unit}
        <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="3 2.4">
          <path d="M58 50 c-5 -6 5 -8 0 -16" />
          <path d="M73 50 c-5 -6 5 -8 0 -16" />
          <path d="M88 50 c-5 -6 5 -8 0 -16" />
        </g>
        <Drop x={40} y={100} size={0.8} />
        <Drop x={106} y={100} size={0.8} />
        <Label x={104} y={40} size={7}>
          steam,
        </Label>
        <Label x={104} y={49} size={7}>
          not smoke
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          the loop turns round to melt it
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          then goes back to heating
        </Label>
      </Panel>
    </svg>
  )
}
