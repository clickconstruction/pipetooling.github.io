import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Receptacle } from './electricalParts'
import { Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The field mistakes a plumber makes near electrical (punch list #120): five columns, the mistake above in the
 * house red and the right way below in the verdict green. A jumper left off, a plastic section with no word, a
 * cord with no GFCI, a cover off live, a drilled cable. Lesson 30.
 */
export function PlumberMistakes({ titleId }: FigureProps) {
  const W = 58
  const col = (i: number, title: string, wrong: JSX.Element, right: JSX.Element, wrongWords: string, rightWords: string) => (
    <g key={title} transform={`translate(${2 + i * (W + 2)} 0)`}>
      <rect x="0" y="2" width={W} height="166" rx="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <text x={W / 2} y="14" fontSize="7" fontWeight="600" fill="currentColor" textAnchor="middle">
        {title}
      </text>
      <line x1="4" y1="92" x2={W - 4} y2="92" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
      <g transform="translate(0 22)">{wrong}</g>
      <text x={W / 2} y="87" fontSize="6" fill={WRONG} textAnchor="middle">
        {wrongWords}
      </text>
      <g transform="translate(0 98)">{right}</g>
      <text x={W / 2} y="163" fontSize="6" fill={RIGHT} textAnchor="middle">
        {rightWords}
      </text>
    </g>
  )
  const meter = <rect x="22" y="22" width="14" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
  return (
    <svg viewBox="0 0 300 170" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {col(0, 'the jumper',
        <>
          <Pipe d="M6 30 H52" bore={5} />
          {meter}
        </>,
        <>
          <Pipe d="M6 30 H52" bore={5} />
          {meter}
          <Conductor d="M16 28 V14 H42 V28" wire="ground" />
        </>,
        'left off', 'back on')}
      {col(1, 'plastic',
        <>
          <Pipe d="M6 30 H20" bore={5} />
          <Pipe d="M20 30 H38" bore={5} tint="air" />
          <Pipe d="M38 30 H52" bore={5} />
        </>,
        <>
          <Pipe d="M6 30 H20" bore={5} />
          <Pipe d="M20 30 H38" bore={5} tint="air" />
          <Pipe d="M38 30 H52" bore={5} />
          <Conductor d="M14 28 V12 H44 V28" wire="ground" />
        </>,
        'no word', 'the electrician')}
      {col(2, 'the cord',
        <>
          <Receptacle x={18} y={26} />
          <Conductor d="M28 30 H46" />
        </>,
        <>
          <Receptacle x={18} y={26} kind="gfci" />
          <Conductor d="M28 30 H46" />
        </>,
        'no GFCI', 'a GFCI')}
      {col(3, 'the cover',
        <>
          <Conductor d="M6 14 H16 M32 14 H40" />
          <Breaker x={24} y={14} />
          <rect x="18" y="26" width="22" height="32" rx="5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.2" />
          <rect x="22" y="32" width="12" height="10" rx="1.5" fill="var(--surface)" stroke={WRONG} strokeWidth="1.2" />
        </>,
        <>
          <Conductor d="M6 14 H16 M32 14 H40" />
          <Breaker x={24} y={14} open />
          <rect x="18" y="26" width="22" height="32" rx="5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.2" />
          <rect x="22" y="32" width="12" height="10" rx="1.5" fill="var(--surface)" stroke={RIGHT} strokeWidth="1.2" />
        </>,
        'off live', 'off, tested dead')}
      {col(4, 'the hole',
        <>
          <rect x="22" y="4" width="14" height="56" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
          <rect x="26" y="26" width="6" height="10" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
          <circle cx="29" cy="31" r="4" fill="none" stroke={WRONG} strokeWidth="1.6" />
        </>,
        <>
          <rect x="22" y="4" width="14" height="56" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
          <rect x="26" y="26" width="6" height="10" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
          <circle cx="29" cy="40" r="4" fill="none" stroke={RIGHT} strokeWidth="1.6" />
        </>,
        'into the cable', 'a look first')}
    </svg>
  )
}
