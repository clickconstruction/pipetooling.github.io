import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { LINE } from './hvacTokens'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Venting against recovery (Intro to HVAC, lesson 7), in two frames: a cut line letting the refrigerant out into
 * the air, in the house red; and the same line pumped through a machine into a tank before it is opened.
 */
export function VentOrRecover({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="venting" sub="against federal law" subColor={WRONG}>
        <Pipe d="M12 84 H66" bore={LINE + 1} tint="hot" />
        <Pipe d="M80 84 H134" bore={LINE + 1} tint="hot" />
        <g stroke={WRONG} strokeWidth="1.5" strokeLinecap="round">
          <line x1="73" y1="80" x2="62" y2="56" />
          <line x1="73" y1="80" x2="73" y2="50" />
          <line x1="73" y1="80" x2="84" y2="56" />
          <line x1="73" y1="88" x2="64" y2="106" />
          <line x1="73" y1="88" x2="82" y2="106" />
        </g>
        <Label x={73} y={42} anchor="middle" size={7} color={WRONG}>
          out into the air
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          a line cut or opened
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          with the refrigerant in it
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="recovery" sub="the legal way" subColor={RIGHT}>
        <Pipe d="M10 70 H48" bore={LINE + 1} tint="hot" />
        <Box x={48} y={56} w={30} h={28} />
        <Pipe d="M78 70 H104" bore={LINE + 1} tint="hot" />
        <Flow x={30} y={70} size={0.7} />
        <Flow x={92} y={70} size={0.7} />
        <rect x="108" y="52" width="6" height="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <rect x="100" y="58" width="22" height="46" rx="8" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
        <Label x={63} y={50} anchor="middle" size={6.5}>
          the machine
        </Label>
        <Label x={111} y={116} anchor="middle" size={6.5}>
          the tank
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          pumped into a tank first
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          by a carded technician
        </Label>
      </Panel>
    </svg>
  )
}
