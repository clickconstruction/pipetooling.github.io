import type { FigureProps } from './figureProps'

/**
 * Stacking limits (punch list #116): lumber 16 ft by hand and 20 by machine, loose bricks 7 ft tapering above 4,
 * blocks tapering above 6, cylinders 5 ft unless racked, on one scale. Lesson 10; lesson 21 names it too.
 */
export function StackingLimits({ titleId }: FigureProps) {
  // 20 ft → 180 px; the ground at y = 200.
  const y = (ft: number) => 200 - ft * 9
  return (
    <svg viewBox="0 0 300 226" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <line x1="6" y1="200" x2="294" y2="200" strokeWidth="3" />
        <rect x="18" y={y(16)} width="48" height={200 - y(16)} fill="var(--bg-amber-100)" />
        <rect x="18" y={y(20)} width="48" height={y(16) - y(20)} fill="none" strokeDasharray="3 3" />
        <rect x="100" y={y(4)} width="48" height={200 - y(4)} fill="var(--bg-red-100)" />
        <path d={`M100 ${y(4)} L148 ${y(4)} L136 ${y(7)} L112 ${y(7)} Z`} fill="var(--bg-red-100)" />
        <rect x="182" y={y(6)} width="48" height={200 - y(6)} fill="var(--bg-subtle)" />
        <path d={`M182 ${y(6)} L230 ${y(6)} L218 ${y(10)} L194 ${y(10)} Z`} fill="var(--bg-subtle)" />
        <rect x="258" y={y(5)} width="14" height={200 - y(5)} rx="4" fill="var(--bg-blue-tint)" />
        <rect x="276" y={y(5)} width="14" height={200 - y(5)} rx="4" fill="var(--bg-blue-tint)" />
        <g stroke="var(--text-muted)" strokeWidth="1">
          <line x1="66" y1={y(16)} x2="74" y2={y(16)} />
          <line x1="66" y1={y(20)} x2="74" y2={y(20)} />
          <line x1="90" y1={y(7)} x2="98" y2={y(7)} />
          <line x1="172" y1={y(6)} x2="180" y2={y(6)} />
          <line x1="248" y1={y(5)} x2="256" y2={y(5)} />
        </g>
      </g>
      <g fontSize="9.5" fill="var(--text-muted)">
        <text x="78" y={y(20) + 4}>20 ft by machine</text>
        <text x="78" y={y(16) + 4}>16 ft by hand</text>
        <text x="102" y={y(7) - 4}>7 ft at most</text>
        <text x="124" y={y(4) + 16} textAnchor="middle" fontSize="9" fill="var(--text-600)">taper from</text>
        <text x="124" y={y(4) + 27} textAnchor="middle" fontSize="9" fill="var(--text-600)">4 ft up</text>
        <text x="184" y={y(10) - 4}>taper above 6 ft</text>
        <text x="292" y={y(5) - 15} textAnchor="end">5 ft</text>
        <text x="292" y={y(5) - 4} textAnchor="end">unless racked</text>
      </g>
      <g fontSize="10" fill="currentColor" textAnchor="middle">
        <text x="42" y="218">lumber</text>
        <text x="124" y="218">loose bricks</text>
        <text x="206" y="218">blocks</text>
        <text x="274" y="218">cylinders</text>
      </g>
    </svg>
  )
}
