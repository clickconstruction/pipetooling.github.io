import type { FigureProps } from './figureProps'

/**
 * The oxygen gauge (punch list #116): 23.5 percent at the top of the acceptable band, 20.9 normal, 19.5 where
 * the air turns deadly, 10 where people pass out or die. Lesson 13; lesson 26 names it too.
 */
export function OxygenGauge({ titleId }: FigureProps) {
  // 25 % at y = 20, 5 % at y = 200: 9 px a percent.
  const y = (pct: number) => 20 + (25 - pct) * 9
  return (
    <svg viewBox="0 0 300 220" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <rect x="60" y={y(23.5)} width="28" height={y(19.5) - y(23.5)} fill="var(--bg-green-100)" stroke="none" />
      <rect x="60" y={y(19.5)} width="28" height={y(10) - y(19.5)} fill="var(--bg-amber-100)" stroke="none" />
      <rect x="60" y={y(10)} width="28" height={y(5) - y(10)} fill="var(--bg-red-100)" stroke="none" />
      <rect x="60" y={y(25)} width="28" height={y(5) - y(25)} fill="none" stroke="currentColor" strokeWidth="2" />
      <g stroke="currentColor" strokeWidth="2">
        <line x1="52" y1={y(23.5)} x2="96" y2={y(23.5)} />
        <line x1="52" y1={y(20.9)} x2="96" y2={y(20.9)} strokeWidth="3" />
        <line x1="52" y1={y(19.5)} x2="96" y2={y(19.5)} />
        <line x1="52" y1={y(10)} x2="96" y2={y(10)} />
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="104" y={y(23.5) + 4}>23.5% · the top of the safe band</text>
        <text x="104" y={y(20.9) + 4} fontWeight="600">20.9% · normal air</text>
        <text x="104" y={y(19.5) + 4} fill="#b45309">19.5% · deadly below this line</text>
        <text x="104" y={y(19.5) + 16} fill="var(--text-muted)" fontSize="9">a monitor warns, ventilation fixes it</text>
        <text x="104" y={y(10) + 4} fill="#991b1b">10% · people pass out or die</text>
        <text x="104" y={y(10) + 16} fill="var(--text-muted)" fontSize="9">a dust mask does nothing here: supplied air only</text>
        <text x="8" y="120" fill="var(--text-muted)" fontSize="9.5" transform="rotate(-90 8 120)">oxygen in the air</text>
        <text x="60" y="214" fill="var(--text-muted)" fontSize="9">test oxygen first, then flammables, then toxics</text>
      </g>
    </svg>
  )
}
