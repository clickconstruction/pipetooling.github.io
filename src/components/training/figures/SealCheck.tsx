import type { FigureProps } from './figureProps'

/** The seal check in three frames (punch list #116): inspect, put it on, cover the valve and feel it bulge. Lesson 13. */
export function SealCheck({ titleId }: FigureProps) {
  const head = (cx: number) => (
    <>
      <circle cx={cx} cy="52" r="20" fill="var(--surface)" />
      <circle cx={cx - 7} cy="46" r="1.5" fill="currentColor" stroke="none" />
      <circle cx={cx + 7} cy="46" r="1.5" fill="currentColor" stroke="none" />
    </>
  )
  return (
    <svg viewBox="0 0 300 162" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="94" height="124" rx="6" fill="var(--surface)" />
        <rect x="103" y="2" width="94" height="124" rx="6" fill="var(--surface)" />
        <rect x="204" y="2" width="94" height="124" rx="6" fill="var(--surface)" />
        {head(49)}
        <path d="M26 94 c0 -14 10 -22 23 -22 s23 8 23 22" fill="var(--bg-subtle)" />
        <line x1="26" y1="94" x2="72" y2="94" />
        <path d="M22 100 l4 -6 M76 100 l-4 -6" />
        {head(150)}
        <path d="M134 56 c0 -8 7 -12 16 -12 s16 4 16 12 c0 10 -7 16 -16 16 s-16 -6 -16 -16z" fill="var(--bg-subtle)" />
        <path d="M134 56 c-6 -2 -10 -6 -14 -12 M166 56 c6 -2 10 -6 14 -12" />
        {head(251)}
        <path d="M235 56 c0 -8 7 -12 16 -12 s16 4 16 12 c0 10 -7 16 -16 16 s-16 -6 -16 -16z" fill="var(--bg-subtle)" />
        <path d="M226 70 c6 -4 10 -4 14 0 M262 70 c6 -4 10 -4 14 0" strokeWidth="2.5" />
        <path d="M251 88 v10 M245 92 l6 6 l6 -6" stroke="var(--text-green-700)" strokeWidth="2" />
        <path d="M232 46 l-6 -4 M270 46 l6 -4" stroke="var(--text-green-700)" strokeWidth="2" />
      </g>
      <g fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle">
        <text x="49" y="16">1 inspect</text>
        <text x="150" y="16">2 put it on</text>
        <text x="251" y="16">3 check the seal</text>
      </g>
      <g fontSize="8" fill="var(--text-muted)" textAnchor="middle">
        <text x="49" y="112">straps, valve, no cracks</text>
        <text x="150" y="112">before glasses or a hat</text>
        <text x="251" y="108" fontSize="7.5">cover the valve,</text>
        <text x="251" y="118" fontSize="7.5">breathe out, feel it bulge</text>
      </g>
      <text x="4" y="142" fontSize="9" fill="var(--text-muted)">
        every time you put it on; a fit test is the yearly one,
      </text>
      <text x="4" y="154" fontSize="9" fill="var(--text-muted)">
        and a loose hood needs no seal check
      </text>
    </svg>
  )
}
