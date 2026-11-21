import type { ReactNode } from 'react'
import type { FigureProps } from './figureProps'
import { Air, Box, Drop, Flame } from './hvacParts'
import { LINE } from './hvacTokens'
import { Label, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The first-timer's mistakes (Intro to HVAC, lesson 30): five mistakes on the top row, each above the right way on
 * the bottom row. A drain tied straight in, a crushed duct, a sagging vent, a blocked closet, a line set used as a
 * hanger.
 */
export function HvacMistakes({ titleId }: FigureProps) {
  const W = 57
  const cell = (i: number, row: 0 | 1, art: ReactNode) => (
    <g transform={`translate(${3 + i * 59.2} ${row === 0 ? 20 : 98})`}>
      <rect x="0" y="0" width={W} height="72" rx="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      {art}
      {row === 0 ? (
        <g stroke={WRONG} strokeWidth="2" strokeLinecap="round">
          <line x1="44" y1="6" x2="51" y2="13" />
          <line x1="51" y1="6" x2="44" y2="13" />
        </g>
      ) : (
        <path d="M43 9 l3 4 l6 -8" fill="none" stroke={RIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </g>
  )
  const heads = ['the drain', 'the duct', 'the vent', 'the closet', 'the line set']
  return (
    <svg viewBox="0 0 300 174" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {heads.map((h, i) => (
        <Label key={h} x={3 + i * 59.2 + W / 2} y={13} anchor="middle" bold color="currentColor" size={7.5}>
          {h}
        </Label>
      ))}
      {cell(
        0,
        0,
        <>
          <Pipe d="M8 54 H50" bore={9} tint="waste" />
          <Pipe d="M22 16 V50" bore={4} tint="cold" />
        </>,
      )}
      {cell(
        0,
        1,
        <>
          <Pipe d="M22 12 V32" bore={4} tint="cold" />
          <Drop x={22} y={35} />
          <path d="M14 46 L18 52 M30 46 L26 52" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <Pipe d="M22 52 V66" bore={9} tint="waste" />
        </>,
      )}
      {cell(
        1,
        0,
        <>
          <Pipe d="M6 40 H22" bore={14} tint="air" />
          <Pipe d="M22 40 H34" bore={4} tint="air" />
          <Pipe d="M34 40 H51" bore={14} tint="air" />
          <Pipe d="M28 16 V62" bore={5} tint="cold" />
        </>,
      )}
      {cell(
        1,
        1,
        <>
          <Pipe d="M6 44 H51" bore={14} tint="air" />
          <Pipe d="M6 22 H40" bore={5} tint="cold" />
        </>,
      )}
      {cell(
        2,
        0,
        <>
          <Pipe d="M8 40 C20 58 34 58 48 24" bore={6} tint="hot" />
        </>,
      )}
      {cell(
        2,
        1,
        <>
          <Pipe d="M8 52 L48 26" bore={6} tint="hot" />
        </>,
      )}
      {cell(
        3,
        0,
        <>
          <Box x={12} y={18} w={32} h={46} fill="var(--bg-subtle)" />
          <Flame x={28} y={60} size={0.5} />
          <rect x="4" y="50" width="10" height="14" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1" />
        </>,
      )}
      {cell(
        3,
        1,
        <>
          <Box x={20} y={18} w={30} h={46} fill="var(--bg-subtle)" />
          <Flame x={35} y={60} size={0.5} />
          <Air x={3} y={26} len={15} />
          <Air x={3} y={56} len={15} />
        </>,
      )}
      {cell(
        4,
        0,
        <>
          <Pipe d="M4 26 H52" bore={LINE} tint="hot" />
          <line x1="28" y1="28" x2="28" y2="46" stroke="currentColor" strokeWidth="1.3" />
          <rect x="20" y="46" width="16" height="14" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
        </>,
      )}
      {cell(
        4,
        1,
        <>
          <line x1="4" y1="20" x2="52" y2="20" stroke="currentColor" strokeWidth="2" />
          <line x1="14" y1="20" x2="14" y2="34" stroke="currentColor" strokeWidth="1.3" />
          <line x1="42" y1="20" x2="42" y2="34" stroke="currentColor" strokeWidth="1.3" />
          <Pipe d="M4 36 H52" bore={LINE} tint="hot" />
        </>,
      )}
    </svg>
  )
}
