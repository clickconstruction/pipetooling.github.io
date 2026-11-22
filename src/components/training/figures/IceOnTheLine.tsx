import type { FigureProps } from './figureProps'
import { Box, Drop, Fan } from './hvacParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The sign a frozen coil shows outdoors (Intro to HVAC, lesson 20), in two frames: the big wrapped line at the
 * outdoor unit cool and wet, as it should be; and the same line white with ice, which says the coil indoors is
 * freezing.
 */
export function IceOnTheLine({ titleId }: FigureProps) {
  const ICE = 'var(--bg-sky-100)'
  const unit = (
    <>
      <line x1="12" y1="40" x2="12" y2="108" stroke="currentColor" strokeWidth="2.4" />
      <Box x={84} y={46} w={48} h={56} />
      <Fan x={108} y={74} r={15} />
      <Pipe d="M12 66 H84" bore={2.4} tint="hot" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="as it should be" sub="cool and wet" subColor={RIGHT}>
        {unit}
        <Pipe d="M12 84 H84" bore={7} tint="cold" />
        <Drop x={34} y={96} size={0.8} />
        <Drop x={58} y={98} size={0.8} />
        <Label x={48} y={58} anchor="middle" size={6.5}>
          the small line
        </Label>
        <Label x={48} y={114} anchor="middle" size={6.5}>
          the big wrapped line
        </Label>
        <Label x={73} y={130} anchor="middle" bold color="currentColor" size={7.5}>
          drops of water on it
        </Label>
        <Label x={73} y={140} anchor="middle" size={7}>
          the coil indoors is working
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="white with ice" sub="the coil is freezing" subColor={WRONG}>
        {unit}
        <Pipe d="M12 84 H84" bore={7} tint="cold" />
        <g fill={ICE} stroke="currentColor" strokeWidth="1">
          <rect x="16" y="77" width="20" height="14" rx="5" />
          <rect x="32" y="76" width="22" height="16" rx="6" />
          <rect x="50" y="77" width="18" height="14" rx="5" />
          <rect x="64" y="76" width="18" height="16" rx="6" />
        </g>
        <Label x={48} y={108} anchor="middle" size={6.5} color={WRONG}>
          ice on the big line
        </Label>
        <Label x={73} y={130} anchor="middle" bold color="currentColor" size={7.5}>
          thermostat off, fan on
        </Label>
        <Label x={73} y={140} anchor="middle" size={7}>
          then the filter and the returns
        </Label>
      </Panel>
    </svg>
  )
}
