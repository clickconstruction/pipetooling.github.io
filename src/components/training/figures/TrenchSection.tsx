import type { FigureProps } from './figureProps'

/**
 * A trench in section (punch list #116): the box 18 in above the top, spoil 2 ft back, a ladder within 25 ft of
 * every worker, and the three soil slopes. Lesson 19; lesson 20 names it too.
 */
export function TrenchSection({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 290" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M10 60 H100 V190 H200 V60 H290" fill="var(--bg-subtle)" />
        <rect x="100" y="36" width="8" height="154" fill="var(--bg-blue-tint)" strokeWidth="1.5" />
        <rect x="192" y="36" width="8" height="154" fill="var(--bg-blue-tint)" strokeWidth="1.5" />
        <line x1="108" y1="90" x2="192" y2="90" strokeWidth="3" />
        <line x1="108" y1="150" x2="192" y2="150" strokeWidth="3" />
        <line x1="114" y1="190" x2="114" y2="12" />
        <line x1="124" y1="190" x2="124" y2="12" />
        <g strokeWidth="1.5">
          <line x1="114" y1="176" x2="124" y2="176" />
          <line x1="114" y1="158" x2="124" y2="158" />
          <line x1="114" y1="140" x2="124" y2="140" />
          <line x1="114" y1="122" x2="124" y2="122" />
          <line x1="114" y1="104" x2="124" y2="104" />
          <line x1="114" y1="86" x2="124" y2="86" />
          <line x1="114" y1="68" x2="124" y2="68" />
          <line x1="114" y1="50" x2="124" y2="50" />
          <line x1="114" y1="32" x2="124" y2="32" />
        </g>
        <path d="M236 60 C 250 30, 280 30, 294 60" fill="var(--bg-muted)" />
        <circle cx="160" cy="148" r="6" fill="var(--surface)" />
        <line x1="160" y1="154" x2="160" y2="176" />
        <polyline points="160,176 153,190" />
        <polyline points="160,176 167,190" />
        <polyline points="160,160 150,170" />
        <polyline points="160,160 170,170" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="1" fill="none">
        <line x1="88" y1="36" x2="88" y2="60" />
        <line x1="84" y1="36" x2="92" y2="36" />
        <line x1="84" y1="60" x2="92" y2="60" />
        <line x1="200" y1="52" x2="236" y2="52" />
        <line x1="200" y1="48" x2="200" y2="56" />
        <line x1="236" y1="48" x2="236" y2="56" />
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="14" y="32" fill="var(--text-muted)" fontSize="9.5">18 in above the top</text>
        <text x="204" y="44" fill="var(--text-muted)" fontSize="9.5">2 ft back</text>
        <text x="238" y="78" fill="var(--text-muted)" fontSize="9.5">the spoil</text>
        <text x="130" y="24" fill="var(--text-muted)" fontSize="9.5">a ladder within 25 ft</text>
        <text x="130" y="36" fill="var(--text-muted)" fontSize="9.5">of every worker</text>
        <text x="208" y="184" fill="var(--text-muted)" fontSize="9.5">the box holds</text>
        <text x="208" y="196" fill="var(--text-muted)" fontSize="9.5">the walls back</text>
      </g>
      <g stroke="currentColor" strokeWidth="1.5" fill="var(--bg-subtle)">
        <path d="M20 280 V240 L50 280 Z" />
        <path d="M110 280 V240 L150 280 Z" />
        <path d="M200 280 V240 L260 280 Z" />
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="20" y="232">A · ¾ to 1 · clay</text>
        <text x="110" y="232">B · 1 to 1</text>
        <text x="200" y="232">C · 1½ to 1 · sand, wet</text>
        <text x="20" y="218" fill="var(--text-muted)" fontSize="9.5">or, without a box, slope the walls back:</text>
      </g>
    </svg>
  )
}
