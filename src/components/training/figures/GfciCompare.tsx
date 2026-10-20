import type { FigureProps } from './figureProps'
import { Conductor, Current, Receptacle } from './electricalParts'
import { FAULT } from './electricalTokens'
import { Label, Panel, Person } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * GFCI, what it catches (punch list #120), in two frames: the GFCI counts the current out on the hot and back
 * on the neutral, and holds while they match; a wet hand on the tool takes some of it to the floor, in the house
 * red, the two counts differ by 5 mA and the GFCI trips in 1/40 of a second. Lesson 13.
 */
export function GfciCompare({ titleId }: FigureProps) {
  const frame = (fault: boolean) => (
    <>
      <Conductor d="M8 60 H42" />
      <Current x={20} y={60} />
      <Current x={32} y={60} />
      <Conductor d="M8 86 H42" wire="neutral" />
      <Current x={32} y={86} angle={180} />
      {!fault && <Current x={20} y={86} angle={180} />}
      <Receptacle x={54} y={73} kind="gfci" />
      <Conductor d="M66 62 H92" />
      <Conductor d="M66 84 H92" wire="neutral" />
      <rect x="92" y="56" width="22" height="34" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={103} y={76} anchor="middle" size={6.5}>
        tool
      </Label>
      <Label x={24} y={52} anchor="middle" size={6.5}>
        out
      </Label>
      <Label x={24} y={98} anchor="middle" size={6.5}>
        back
      </Label>
      {fault ? (
        <>
          <Person x={126} y={134} h={44} arm="out" />
          <path d="M114 70 H120" fill="none" stroke={FAULT} strokeWidth="1.6" />
          <Current x={126} y={110} angle={90} fault />
          <Current x={126} y={126} angle={90} fault />
          <Label x={72} y={118} anchor="middle" size={7} color={FAULT}>
            5 mA less comes back
          </Label>
          <Label x={72} y={128} anchor="middle" size={7} color={FAULT}>
            it trips in 1/40 s
          </Label>
        </>
      ) : (
        <>
          <Label x={72} y={118} anchor="middle" size={7}>
            out and back match
          </Label>
          <Label x={72} y={128} anchor="middle" size={7}>
            it holds
          </Label>
        </>
      )}
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="1 counting" sub="out on the hot, back on the neutral">
        {frame(false)}
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="2 a leak" sub="some went through a person" subColor={FAULT}>
        {frame(true)}
      </Panel>
    </svg>
  )
}
