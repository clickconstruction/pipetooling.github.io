import { lienPaneHeadFactWords, lienPaneHeadOffsets, type LienPaneSection } from '../../lib/jobs/lienPaneSections'
import { MoneyText } from '../Money'

/**
 * One stacked head of the notice pane (v2.4733): the Notices list's pile head, reused — a sticky
 * row `LIEN_PANE_HEAD_H` tall (24 since v2.7323), the uppercase label, the bold fact at the right, a blue bar when it is the section
 * the reader is in. Passed heads stack under the pinned strip, heads to come stack at the pane's
 * bottom edge, and pressing one scrolls its section up under it. The affidavit and retainage panes draw
 * theirs with it too (v2.7320, `lienAffidavitPaneSections.ts`). A sibling of its section in the
 * pane's grid, never its parent: sticky stacking needs the pane itself as the scrolling box.
 *
 * The footer's head (v2.7422, `section.foot`) is the one blue bar: it pins at the pane's bottom edge while its
 * section is ahead and scrolls with it once reached. It takes no place under the strip, so at the pane's end it
 * sits over its own box and never on it.
 *
 * The fact is the piece that gives way in a narrow pane: it ends in an ellipsis, and its `title` holds its whole words (v2.7446).
 */
export default function LienPaneHead({ section, index, count, stripHeight, lit, onGo, phone = false }: { section: LienPaneSection<string>; index: number; count: number; stripHeight: number; lit: boolean; onGo: () => void; /** A phone pins one head, a thumb tall, in place of the stack (punch list #352, PR 6). */ phone?: boolean }) {
  const { top, bottom, height } = lienPaneHeadOffsets(index, count, stripHeight, phone)
  return (
    <div className="lienPileHead lienPaneHead" data-lien-pane-head={section.key} data-on={lit ? 'yes' : 'no'} data-tone={section.foot ? 'blue' : undefined} style={{ top: section.foot ? 'auto' : top, bottom, height, ...(phone ? { fontSize: '0.75rem' } : null) }}>
      <button type="button" className="lienPileHeadBtn" onClick={onGo} title="Go to this section">
        <span className="lienPaneHeadLabel">{section.label}</span>
        <span className="n" data-lien-pane-head-fact title={lienPaneHeadFactWords(section)}>
          <MoneyText text={section.fact} />
          {section.tail ? <span className="lienPaneHeadTail"> · {section.tail}</span> : null}
        </span>
      </button>
    </div>
  )
}
