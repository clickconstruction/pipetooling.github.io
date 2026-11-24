import type { ReactNode } from 'react'
import { RAIL_FOLD_WORDS, railStripFacts } from '../../lib/bids/takeoffRailFold'
import { Money } from '../Money'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * The Sheet's rail folded to a strip (v2.8480): a bar across the top of the sheet,
 * pinned as the list scrolls. It keeps the rail's headline — the materials total,
 * costed fixtures as N of M, and the red no-cost count when there is one — and one
 * press. The press says **Show**, and **Hide** in the same place while the rail is
 * open over the list. The rail itself hangs under the strip as `children`, so it is
 * the next stop after the press for the Tab key and a screen reader.
 *
 * The look is `.takeoffRailStrip` in `index.css`; the words and the count are
 * `lib/bids/takeoffRailFold.ts`.
 */
export function TakeoffRailStrip({
  materialsTotal,
  costed,
  fixtures,
  uncosted,
  noCost,
  open,
  onPress,
  panelId,
  hint = null,
  children,
}: {
  materialsTotal: number
  costed: number
  fixtures: number
  uncosted: number
  noCost: number
  /** The rail is open over the list: the press reads Hide. */
  open: boolean
  onPress: () => void
  panelId: string
  /** The line that says where the rail went, the first times a narrow window folds it. */
  hint?: string | null
  /** The open rail, hung under the strip. */
  children?: ReactNode
}) {
  const facts = railStripFacts({ costed, fixtures, uncosted, noCost })
  return (
    <div className="takeoffRailStripWrap" data-testid="takeoff-rail-strip">
      <div className="takeoffRailStrip" role="group" aria-label={RAIL_FOLD_WORDS.name}>
        <span className="takeoffRailStripName">{RAIL_FOLD_WORDS.name}</span>
        <span className="takeoffRailStripFact">
          <span>{RAIL_FOLD_WORDS.materials}</span>
          <WorkedOutValue><Money amount={materialsTotal} /></WorkedOutValue>
        </span>
        <span className="takeoffRailStripFact" data-costed={facts.allCosted ? 'all' : 'some'}>
          <span>{RAIL_FOLD_WORDS.costed}</span>
          <WorkedOutValue tone={facts.allCosted ? 'green' : undefined}>{facts.costed}</WorkedOutValue>
        </span>
        {facts.noCost > 0 ? (
          <span className="takeoffRailStripNoCost" title={facts.noCostSentence} aria-label={facts.noCostSentence} role="img" data-testid="takeoff-rail-strip-no-cost">
            <WorkedOutValue tone="red">{String(facts.noCost)}</WorkedOutValue> {facts.noCostWords}
          </span>
        ) : null}
        {hint ? (
          <span className="takeoffRailStripHint" role="status" data-testid="takeoff-rail-strip-hint">
            {hint}
          </span>
        ) : null}
        <button
          type="button"
          className="takeoffRailStripPress"
          data-rail-press
          onClick={onPress}
          title={open ? RAIL_FOLD_WORDS.hideName : RAIL_FOLD_WORDS.showName}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={open ? RAIL_FOLD_WORDS.hideName : RAIL_FOLD_WORDS.showName}
        >
          {open ? RAIL_FOLD_WORDS.hide : RAIL_FOLD_WORDS.show}
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>
      {children}
    </div>
  )
}
