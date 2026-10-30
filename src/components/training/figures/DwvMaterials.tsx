import type { FigureProps } from './figureProps'
import { Label, Panel } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The three drain pipes (punch list #119): white PVC with its purple primer and cement, black ABS with its own
 * cement and no primer, grey cast iron with a no-hub band. Lesson 19.
 */
export function DwvMaterials({ titleId }: FigureProps) {
  const pipe = (fill: string, x: number, w: number) => <rect x={x} y="60" width={w} height="22" fill={fill} stroke="currentColor" strokeWidth="1.5" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="PVC" sub="white">
        {pipe('var(--surface)', 6, 50)}
        <rect x="48" y="56" width="42" height="30" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="48" y="58" width="8" height="26" fill="#7c3aed" stroke="none" />
        <Label x={48} y={108} anchor="middle" size={7.5} color="var(--text-violet-700)">
          purple primer
        </Label>
        <Label x={48} y={118} anchor="middle" size={7.5}>
          then PVC cement
        </Label>
        <Label x={48} y={138} anchor="middle" size={7}>
          glued
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="ABS" sub="black">
        {pipe('var(--text-muted)', 6, 50)}
        <rect x="48" y="56" width="42" height="30" rx="2" fill="var(--text-muted)" stroke="currentColor" strokeWidth="1.5" />
        <Label x={48} y={108} anchor="middle" size={7.5}>
          ABS cement alone
        </Label>
        <Label x={48} y={118} anchor="middle" size={7.5}>
          no primer
        </Label>
        <Label x={48} y={138} anchor="middle" size={7}>
          never PVC's cement
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="Cast iron" sub="grey and heavy">
        {pipe('var(--bg-subtle)', 6, 36)}
        {pipe('var(--bg-subtle)', 56, 34)}
        <rect x="36" y="54" width="26" height="34" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
        <line x1="42" y1="54" x2="42" y2="88" stroke="currentColor" strokeWidth="1" />
        <line x1="56" y1="54" x2="56" y2="88" stroke="currentColor" strokeWidth="1" />
        <circle cx="42" cy="50" r="2.5" fill="currentColor" />
        <circle cx="56" cy="50" r="2.5" fill="currentColor" />
        <Label x={48} y={108} anchor="middle" size={7.5}>
          a no-hub band
        </Label>
        <Label x={48} y={118} anchor="middle" size={7.5}>
          torqued to 60 in-lb
        </Label>
        <Label x={48} y={138} anchor="middle" size={7}>
          quiet, 50 to 100 years
        </Label>
      </Panel>
    </svg>
  )
}
