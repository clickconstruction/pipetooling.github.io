import { lienPaneHeadOffsets, type LienPaneSection } from '../../lib/jobs/lienPaneSections'

/**
 * One stacked head of the notice pane (v2.4733): the Notices list's pile head, reused — a 30 px
 * sticky row, the uppercase label, the bold fact at the right, a blue bar when it is the section
 * the reader is in. Passed heads stack under the pinned strip, heads to come stack at the pane's
 * bottom edge, and pressing one scrolls its section up under it. A sibling of its section in the
 * pane's grid, never its parent: sticky stacking needs the pane itself as the scrolling box.
 */
export default function LienPaneHead({ section, index, count, stripHeight, lit, onGo }: { section: LienPaneSection; index: number; count: number; stripHeight: number; lit: boolean; onGo: () => void }) {
  const { top, bottom } = lienPaneHeadOffsets(index, count, stripHeight)
  return (
    <div className="lienPileHead lienPaneHead" data-lien-pane-head={section.key} data-on={lit ? 'yes' : 'no'} style={{ top, bottom }}>
      <button type="button" className="lienPileHeadBtn" onClick={onGo} title="Go to this section">
        <span className="lienPaneHeadLabel">{section.label}</span>
        <span className="n" data-lien-pane-head-fact>
          {section.fact}
          {section.tail ? <span className="lienPaneHeadTail"> · {section.tail}</span> : null}
        </span>
      </button>
    </div>
  )
}
