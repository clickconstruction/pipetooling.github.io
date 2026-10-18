import type { FigureProps } from './figureProps'
import { Flow, Hub, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A frost-proof hose bib cut open through the wall (punch list #119, second pass): the long stem reaches 8 to
 * 12 in inside the warm wall to its seat, so with the hose off the stem drains out the spout and nothing is left
 * outside to freeze. With a hose left on, water sits in the stem through the cold part and splits it. Lesson 10.
 */
export function FrostProofBib({ titleId }: FigureProps) {
  const W = 296
  const H = 90
  const bib = (full: boolean) => (
    <>
      <rect x="96" y="26" width="30" height="64" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
      <Pipe d="M296 56 H232" />
      <Flow x={270} y={56} angle={180} />
      <rect x="50" y="49" width="182" height="14" rx="2" fill={full ? 'var(--bg-blue-200)' : 'var(--surface)'} stroke="currentColor" strokeWidth="1.5" />
      <rect x="226" y="47" width="8" height="18" fill="currentColor" stroke="none" />
      <line x1="40" y1="56" x2="224" y2="56" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="40" cy="56" r="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" />
      <line x1="36" y1="52" x2="44" y2="60" stroke="currentColor" strokeWidth="1.2" />
      <line x1="44" y1="52" x2="36" y2="60" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M60 63 V78" tint={full ? 'cold' : 'air'} />
      <Label x={20} y={38} size={7}>
        outside
      </Label>
      <Label x={136} y={38} size={7}>
        inside, warm
      </Label>
      <Label x={230} y={44} anchor="middle" size={7} bold color="currentColor">
        seat
      </Label>
      <Label x={30} y={59} anchor="end" size={7}>
        handle
      </Label>
    </>
  )
  return (
    <svg viewBox="0 0 300 190" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={W} h={H} title="Hose off, the stem drains" subColor={RIGHT}>
        {bib(false)}
        <circle cx="60" cy="84" r="2.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1" />
        <line x1="126" y1="74" x2="226" y2="74" stroke="currentColor" strokeWidth="1" />
        <line x1="126" y1="70" x2="126" y2="78" stroke="currentColor" strokeWidth="1" />
        <line x1="226" y1="70" x2="226" y2="78" stroke="currentColor" strokeWidth="1" />
        <Label x={176} y={71} anchor="middle" size={7.5} bold color="currentColor">
          8 to 12 in
        </Label>
        <Label x={176} y={85} anchor="middle" size={7}>
          the water stops at the seat, in the warm
        </Label>
        <Label x={70} y={86} size={7} color={RIGHT}>
          empty
        </Label>
      </Panel>
      <Panel x={2} y={98} w={W} h={H} title="A hose left on, water sits in the stem" subColor={WRONG}>
        {bib(true)}
        <Pipe d="M60 78 V80 q0 6 -6 6 H8" />
        <Hub x={60} y={70} w={10} angle={90} />
        <line x1="104" y1="48" x2="118" y2="64" stroke={WRONG} strokeWidth="2" />
        <line x1="118" y1="48" x2="104" y2="64" stroke={WRONG} strokeWidth="2" />
        <Label x={176} y={76} anchor="middle" size={7} color={WRONG}>
          the hose holds the water in the stem
        </Label>
        <Label x={176} y={86} anchor="middle" size={7} bold color={WRONG}>
          it freezes in the cold part and splits the stem
        </Label>
        <Label x={10} y={77} size={7}>
          hose
        </Label>
      </Panel>
    </svg>
  )
}
