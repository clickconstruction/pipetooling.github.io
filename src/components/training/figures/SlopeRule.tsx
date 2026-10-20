import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The slope rule (punch list #119): a drain falling a quarter inch for every foot, with a level on it showing the
 * gap; beside it a run too flat, where water sits in a belly, and a run too steep, where the water has gone on and
 * the solids stay. Lesson 12.
 */
export function SlopeRule({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Pipe d="M8 50 L176 64" bore={DRAIN} tint="waste" />
      <Flow x={60} y={54} angle={5} />
      <Flow x={130} y={60} angle={5} />
      <rect x="40" y="26" width="100" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" transform="rotate(4.8 90 31)" />
      <rect x="84" y="28" width="12" height="6" rx="3" fill="var(--bg-green-100)" stroke="currentColor" strokeWidth="1" transform="rotate(4.8 90 31)" />
      <line x1="140" y1="22" x2="140" y2="46" stroke="currentColor" strokeWidth="1" />
      <line x1="40" y1="22" x2="40" y2="38" stroke="currentColor" strokeWidth="1" />
      <Label x={92} y={16} anchor="middle" size={8} bold color="currentColor">
        1/4 in of fall for every foot
      </Label>
      <Label x={92} y={92} anchor="middle" size={8}>
        water and solids travel together
      </Label>
      <Label x={92} y={102} anchor="middle" size={8}>
        at about 2 ft a second
      </Label>
      <Panel x={190} y={2} w={108} h={64} title="too flat" subColor={WRONG}>
        <Pipe d="M8 36 Q54 52 100 38" bore={DRAIN} tint="air" />
        <path d="M30 42 Q54 50 78 42" fill="none" stroke="var(--bg-amber-100)" strokeWidth="8" />
        <path d="M30 42 Q54 50 78 42" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <Label x={54} y={60} anchor="middle" size={7.5}>
          water sits in the belly
        </Label>
      </Panel>
      <Panel x={190} y={72} w={108} h={64} title="too steep" subColor={WRONG}>
        <Pipe d="M8 24 L100 50" bore={DRAIN} tint="air" />
        <Flow x={90} y={46} angle={16} />
        <circle cx="30" cy="31" r="2" fill="currentColor" />
        <circle cx="42" cy="35" r="2" fill="currentColor" />
        <circle cx="54" cy="38" r="2" fill="currentColor" />
        <path d="M70 39 L96 46" stroke="var(--bg-amber-100)" strokeWidth="6" strokeLinecap="round" />
        <Label x={54} y={60} anchor="middle" size={7.5}>
          the water leaves the solids
        </Label>
      </Panel>
    </svg>
  )
}
