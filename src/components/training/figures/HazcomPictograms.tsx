import type { FigureProps } from './figureProps'

/**
 * The nine HazCom pictograms, drawn simply and named (punch list #116). v2.5609 set them in two rows at twice
 * the size and redrew corrosion (two tubes pouring on a bar and a hand), health hazard (a bust with a star on
 * the chest) and the environment (a bare tree and a dead fish) closer to the real GHS set, since this sheet's
 * job is recognition. Lesson 14.
 */
export function HazcomPictograms({ titleId }: FigureProps) {
  const glyphs: Record<string, JSX.Element> = {
    flame: <path d="M0 -11 c4 5 7 8 7 13 a7 7 0 0 1 -14 0 c0 -4 2 -6 4 -8 c0 2 1 4 2 4 c0 -4 0 -6 1 -9z" stroke="none" />,
    oxidizer: (
      <>
        <path d="M0 -14 c3 4 5 6 5 9 a5 5 0 0 1 -10 0 c0 -3 1.5 -4.5 3 -6 c0 1.5 0.5 3 1.5 3 c0 -3 0 -4.5 0.5 -6z" stroke="none" />
        <circle cx="0" cy="8" r="5.5" fill="none" />
      </>
    ),
    corrosion: (
      <>
        <path d="M-9 -9 l5 -2.5 l2.5 5 l-5 2.5z" fill="none" strokeWidth="1.2" />
        <path d="M9 -9 l-5 -2.5 l-2.5 5 l5 2.5z" fill="none" strokeWidth="1.2" />
        <circle cx="-4" cy="-2" r="1" stroke="none" />
        <circle cx="-5" cy="1" r="1" stroke="none" />
        <circle cx="-3" cy="4" r="1" stroke="none" />
        <circle cx="4" cy="-2" r="1" stroke="none" />
        <circle cx="5" cy="1" r="1" stroke="none" />
        <circle cx="3" cy="4" r="1" stroke="none" />
        <path d="M-10 6 h7 v4 h-7z" stroke="none" />
        <path d="M3 10 v-4 h1.5 v-2.5 h1.5 v2.5 h1.5 v-2.5 h1.5 v2.5 h1.5 v4z" stroke="none" />
      </>
    ),
    skull: (
      <>
        <circle cx="0" cy="-5" r="6.5" fill="none" />
        <circle cx="-2.5" cy="-6" r="1.3" stroke="none" />
        <circle cx="2.5" cy="-6" r="1.3" stroke="none" />
        <line x1="-7" y1="5" x2="7" y2="12" strokeWidth="1.8" />
        <line x1="7" y1="5" x2="-7" y2="12" strokeWidth="1.8" />
      </>
    ),
    health: (
      <>
        <circle cx="0" cy="-10" r="3" stroke="none" />
        <path d="M-9 10 c0 -9 3 -14 9 -14 s9 5 9 14z" stroke="none" />
        <path d="M0 -2.5 l1.5 3.2 l3.5 0.4 l-2.6 2.3 l0.8 3.4 l-3.2 -1.9 l-3.2 1.9 l0.8 -3.4 l-2.6 -2.3 l3.5 -0.4z" fill="var(--surface)" stroke="none" />
      </>
    ),
    irritant: (
      <text x="0" y="8" fontSize="22" fontWeight="700" textAnchor="middle" stroke="none">
        !
      </text>
    ),
    gas: (
      <>
        <rect x="-5" y="-9" width="10" height="20" rx="4" fill="none" />
        <line x1="0" y1="-12" x2="0" y2="-9" />
        <line x1="-2" y1="-12" x2="2" y2="-12" />
      </>
    ),
    explosive: (
      <>
        <circle cx="0" cy="4" r="6" fill="none" />
        <path d="M4 -1 q3 -4 1 -7" fill="none" />
        <line x1="0" y1="-15" x2="0" y2="-11" />
        <line x1="-8" y1="-11" x2="-5" y2="-8" />
        <line x1="8" y1="-11" x2="5" y2="-8" />
        <line x1="-12" y1="-3" x2="-8" y2="-3" />
        <line x1="12" y1="-3" x2="8" y2="-3" />
      </>
    ),
    nature: (
      <>
        <line x1="-7" y1="10" x2="-7" y2="-8" strokeWidth="1.8" />
        <path d="M-7 -4 l-4 -4 M-7 -1 l5 -5 M-7 3 l-4 -3 M-7 2 l4 -3" strokeWidth="1.4" />
        <path d="M0 3 c3 -4 9 -4 12 0 c-3 4 -9 4 -12 0z" stroke="none" />
        <path d="M11 3 l3 -2.5 v5z" stroke="none" />
        <path d="M2 1.5 l2 2 M4 1.5 l-2 2" stroke="var(--surface)" strokeWidth="0.9" />
      </>
    ),
  }
  const rows: Array<[number, string[]]> = [
    [26, ['flame', 'oxidizer', 'corrosion', 'skull', 'health']],
    [88, ['irritant', 'gas', 'explosive', 'nature']],
  ]
  return (
    <svg viewBox="0 0 300 128" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      {rows.map(([cy, names]) =>
        names.map((name, i) => {
          const cx = names.length === 5 ? 30 + i * 60 : 60 + i * 60
          return (
            <g key={name} transform={`translate(${cx} ${cy})`}>
              <path d="M0 -22 L22 0 L0 22 L-22 0 Z" stroke="#dc2626" strokeWidth="2" fill="var(--surface)" />
              <g fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {glyphs[name]}
              </g>
              <text x="0" y="32" fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
                {name}
              </text>
            </g>
          )
        }),
      )}
    </svg>
  )
}
