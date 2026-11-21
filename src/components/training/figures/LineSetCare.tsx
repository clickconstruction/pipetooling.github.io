import type { FigureProps } from './figureProps'
import { LINE, SUCTION } from './hvacTokens'
import { Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Three things about a refrigerant line (Intro to HVAC, lesson 6), in three frames: a kink, which is replaced and
 * never bent back; an open end, which stays capped; and a filling port on the outdoor unit with its locking cap.
 */
export function LineSetCare({ titleId }: FigureProps) {
  const W = 96
  const H = 132
  const at = (i: number) => ({ x: 2 + i * (W + 4), y: 2 })
  return (
    <svg viewBox="0 0 300 136" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="a kink" sub="chokes the flow" subColor={WRONG}>
        <Pipe d="M10 84 L46 56 L52 84 H86" bore={SUCTION} tint="cold" />
        <g stroke={WRONG} strokeWidth="2" strokeLinecap="round">
          <line x1="40" y1="42" x2="52" y2="54" />
          <line x1="52" y1="42" x2="40" y2="54" />
        </g>
        <Label x={48} y={112} anchor="middle" size={7}>
          replaced,
        </Label>
        <Label x={48} y={121} anchor="middle" size={7}>
          never bent back
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="an open end" sub="stays capped" subColor={RIGHT}>
        <Pipe d="M10 60 H66" bore={SUCTION} tint="cold" />
        <rect x="66" y="54" width="7" height="12" rx="2" fill="currentColor" />
        <Pipe d="M10 82 H66" bore={LINE} tint="hot" />
        <rect x="66" y="77" width="7" height="10" rx="2" fill="currentColor" />
        <Label x={48} y={112} anchor="middle" size={7}>
          damp air must
        </Label>
        <Label x={48} y={121} anchor="middle" size={7}>
          not get in
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="the filling ports" sub="locking caps" subColor={RIGHT}>
        <rect x="14" y="40" width="20" height="52" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
        <Pipe d="M34 66 H56" bore={LINE + 1} tint="hot" />
        <rect x="56" y="59" width="12" height="14" rx="3" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M74 62 v-4 a4 4 0 0 1 8 0 v4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="72" y="62" width="12" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <Label x={48} y={112} anchor="middle" size={7}>
          on the outdoor unit,
        </Label>
        <Label x={48} y={121} anchor="middle" size={7}>
          to keep children out
        </Label>
      </Panel>
    </svg>
  )
}
