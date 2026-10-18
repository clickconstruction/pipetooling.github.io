import type { FigureProps } from './figureProps'
import { Conductor, Current, Load } from './electricalParts'
import { FAULT } from './electricalTokens'
import { Label, Panel } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The neutral and the ground are not the same (punch list #120), in two frames: every day, the current goes out on
 * the hot and back on the neutral and the ground carries nothing; a fault, the hot touches the washer's metal case
 * and the current runs back on the ground, in the house red, and the breaker trips next. In both, the neutral bar
 * and the ground bar join once, in the main panel. Lesson 6.
 */
export function NeutralVsGround({ titleId }: FigureProps) {
  const frame = (fault: boolean) => (
    <>
      <rect x="8" y="36" width="36" height="88" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Conductor d="M18 56 V106" wire="neutral" />
      <Conductor d="M34 56 V106" wire="ground" />
      <Conductor d="M18 106 V114 H34 V106" wire="ground" />
      <Label x={26} y={121} anchor="middle" size={6.5}>
        panel
      </Label>
      <Conductor d="M26 44 V50 H118 V58" />
      <Current x={80} y={50} />
      <rect x="102" y="56" width="32" height="44" rx="3" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="3 2" />
      <Load x={118} y={74} kind="motor" />
      <Conductor d="M118 84 V106 H18" wire="neutral" />
      <Conductor d="M34 114 H138 V92 H134" wire="ground" />
      {fault ? (
        <>
          <path d="M112 58 l-6 6 l5 2 l-6 6" fill="none" stroke={FAULT} strokeWidth="1.6" strokeLinecap="round" />
          <Current x={138} y={104} angle={90} fault />
          <Current x={100} y={114} angle={180} fault />
          <Current x={62} y={114} angle={180} fault />
          <Label x={84} y={132} anchor="middle" size={7} color={FAULT}>
            the hot touches the case
          </Label>
          <Label x={84} y={141} anchor="middle" size={7} color={FAULT}>
            the breaker trips next
          </Label>
        </>
      ) : (
        <>
          <Current x={80} y={106} angle={180} />
          <Label x={82} y={45} anchor="middle" size={7}>
            hot
          </Label>
          <Label x={82} y={102} anchor="middle" size={7}>
            neutral
          </Label>
          <Label x={90} y={126} anchor="middle" size={7}>
            ground: nothing
          </Label>
          <Label x={36} y={136} anchor="middle" size={6.5}>
            joined here, once
          </Label>
        </>
      )}
      <Label x={99} y={68} anchor="end" size={6.5}>
        the washer
      </Label>
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="1 every day" sub="out on the hot, back on the neutral">
        {frame(false)}
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="2 a fault" sub="the ground carries it back" subColor={FAULT}>
        {frame(true)}
      </Panel>
    </svg>
  )
}
