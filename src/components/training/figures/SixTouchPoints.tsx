import type { ReactNode } from 'react'
import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Box, Drop, Flame } from './hvacParts'
import { LINE } from './hvacTokens'
import { Label, Panel, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Where the trades meet (Intro to HVAC, lesson 27): six small frames, one for each place a plumber, an electrician
 * and an HVAC crew change each other's work, each with its one rule under it.
 */
export function SixTouchPoints({ titleId }: FigureProps) {
  const W = 96
  const H = 82
  const at = (i: number) => ({ x: 2 + (i % 3) * (W + 4), y: 2 + Math.floor(i / 3) * (H + 4) })
  const frame = (i: number, title: string, rule: string, art: ReactNode) => (
    <Panel {...at(i)} w={W} h={H} title={title}>
      {art}
      <Label x={W / 2} y={74} anchor="middle" size={7}>
        {rule}
      </Label>
    </Panel>
  )
  return (
    <svg viewBox="0 0 300 174" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {frame(
        0,
        '1 the drain',
        'ends in the open',
        <>
          <Pipe d="M18 28 L52 34 V44" bore={4} tint="cold" />
          <Drop x={52} y={47} />
          <path d="M44 56 L48 62 M60 56 L56 62" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>,
      )}
      {frame(
        1,
        '2 the gas',
        'the plumber pipes it',
        <>
          <Pipe d="M12 46 H34" tint="air" />
          <Pipe d="M50 46 H84" tint="air" />
          <Pipe d="M66 46 V58" tint="air" />
          <rect x="60" y="58" width="12" height="5" rx="1.5" fill="currentColor" />
          <Valve x={42} y={46} kind="ball" tint="air" />
        </>,
      )}
      {frame(
        2,
        '3 vent and air',
        'change one, check both',
        <>
          <Box x={20} y={34} w={22} h={28} />
          <rect x="54" y="38" width="18" height="24" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          <Pipe d="M31 34 V28 L48 22 L63 28 V38" bore={5} tint="hot" />
          <Pipe d="M48 22 V18" bore={6} tint="hot" />
          <Flame x={31} y={60} size={0.45} />
          <Flame x={63} y={60} size={0.45} />
        </>,
      )}
      {frame(
        3,
        '4 the power',
        'tested dead first',
        <>
          <rect x="36" y="24" width="22" height="34" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          <line x1="42" y1="50" x2="52" y2="32" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <Conductor d="M12 41 H36" />
          <Conductor d="M58 41 H84" dash="3 2" />
        </>,
      )}
      {frame(
        4,
        '5 the holes',
        'go round, and plate it',
        <>
          <rect x="38" y="20" width="18" height="44" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
          <Pipe d="M10 34 H86" bore={LINE} tint="hot" />
          <Pipe d="M10 50 H86" bore={5} tint="cold" />
          <line x1="35" y1="26" x2="35" y2="58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>,
      )}
      {frame(
        5,
        '6 water machines',
        'the loop takes the card',
        <>
          <rect x="34" y="34" width="28" height="30" rx="7" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
          <Box x={34} y={20} w={28} h={14} />
          <Pipe d="M22 26 H34" bore={4} tint="cold" />
          <Pipe d="M62 26 H74" bore={LINE} tint="hot" />
        </>,
      )}
    </svg>
  )
}
