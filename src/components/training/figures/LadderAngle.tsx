import type { FigureProps } from './figureProps'

/** An extension ladder at 4 to 1, tied top and bottom, 3 ft past the landing (punch list #116). Lesson 17; lessons 7 and 20 name it too. */
export function LadderAngle({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 236" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="10" y1="210" x2="290" y2="210" strokeWidth="3" />
        <rect x="240" y="70" width="50" height="140" fill="var(--bg-subtle)" strokeWidth="1" />
        <line x1="195" y1="210" x2="230" y2="42" />
        <line x1="207" y1="210" x2="242" y2="42" />
        <g strokeWidth="1.5">
          <line x1="198" y1="196" x2="210" y2="196" />
          <line x1="201" y1="180" x2="213" y2="180" />
          <line x1="204" y1="164" x2="216" y2="164" />
          <line x1="208" y1="148" x2="220" y2="148" />
          <line x1="211" y1="132" x2="223" y2="132" />
          <line x1="214" y1="116" x2="226" y2="116" />
          <line x1="218" y1="100" x2="230" y2="100" />
          <line x1="221" y1="84" x2="233" y2="84" />
          <line x1="224" y1="68" x2="236" y2="68" />
          <line x1="228" y1="52" x2="240" y2="52" />
        </g>
        <circle cx="238" cy="72" r="4" fill="var(--bg-green-100)" />
        <circle cx="201" cy="206" r="4" fill="var(--bg-green-100)" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="1" fill="none">
        <line x1="201" y1="222" x2="240" y2="222" />
        <line x1="201" y1="218" x2="201" y2="226" />
        <line x1="240" y1="218" x2="240" y2="226" />
        <line x1="262" y1="70" x2="262" y2="210" />
        <line x1="258" y1="70" x2="266" y2="70" />
        <line x1="258" y1="210" x2="266" y2="210" />
        <line x1="262" y1="42" x2="262" y2="68" />
        <line x1="258" y1="42" x2="266" y2="42" />
        <line x1="100" y1="36" x2="232" y2="70" />
        <line x1="118" y1="196" x2="196" y2="205" />
      </g>
      <g fontSize="10.5" fill="currentColor">
        <text x="220" y="233" textAnchor="middle" fill="var(--text-muted)" fontSize="9">1 out</text>
        <text x="268" y="144" fill="var(--text-muted)" fontSize="9.5">4 up</text>
        <text x="268" y="58" fill="var(--text-muted)" fontSize="9.5">3 ft</text>
        <text x="20" y="40">tied at the top</text>
        <text x="20" y="200">tied at the bottom</text>
        <text x="20" y="80" fill="var(--text-muted)" fontSize="9.5">for every 4 ft up the wall,</text>
        <text x="20" y="93" fill="var(--text-muted)" fontSize="9.5">the feet sit 1 ft out</text>
      </g>
    </svg>
  )
}
