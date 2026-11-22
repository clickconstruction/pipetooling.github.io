import { useRef, type CSSProperties } from 'react'
import { ScrollableTabStrip } from '../ScrollableTabStrip'
import { LIT_SELECTED, useLitPillInView } from '../../hooks/useLitPillInView'
import { pageSubTabStyle, pageTabStyle } from '../../lib/pageTabStyle'
import { PEOPLE_TAB_LABELS, type PeopleTab, type PeopleTabGroupId, type VisiblePeopleTabGroup } from '../../lib/people/peopleTabGroups'
import {
  PHONE_PILL_FADE_SLACK_PX,
  PHONE_PILL_PEEK_PX,
  PHONE_PILL_PRESS_PX,
  PHONE_TAB_FADE_SLACK_PX,
  PHONE_TAB_PEEK_PX,
  type PhoneTabRows,
} from '../../lib/phoneLayout/phoneTabRows'

const TITLE: CSSProperties = { flexShrink: 0, margin: 0, marginLeft: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }
/** The title kept for a screen reader while the top bar shows the page's name, as the app hides a label it still says. */
const TITLE_UNDRAWN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)' }

/**
 * A pill's press on the one-line row. A pill is 27 px tall, too short for a thumb, and a row that slides
 * sideways needs room to be caught. The press is `PHONE_PILL_PRESS_PX` tall with the pill drawn in its middle.
 */
const PILL_PRESS: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: PHONE_PILL_PRESS_PX,
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
}

/** The words a pointer resting on a pill reads, where the pill has any. */
function pillTitle(view: PeopleTab): string | undefined {
  return view === 'person' ? 'One person, every control — the Person Desk as a page' : undefined
}

/**
 * The People page's two rows: its sections (People, Pay, Paperwork…) with the page's title, and under them
 * the open section's views as pills, when the section has more than one.
 *
 * Off the new phone layout both rows are drawn as they were: the sections in a plain sideways scroller that
 * keeps the lit one in view (`useLitPillInView`, v2.8130), the pills folding onto as many rows as they need.
 * On it (`rows.oneLine`) each row is one line in `ScrollableTabStrip`, which fades an edge that has more
 * past it and brings the open tab whole into view, and the title is not drawn while the top bar names the page.
 */
export function PeoplePageTabRows({
  groups,
  activeGroupId,
  subTabs,
  activeTab,
  onGroup,
  onView,
  rows,
}: {
  /** The sections this person may open, in the row's order. */
  groups: readonly VisiblePeopleTabGroup[]
  activeGroupId: PeopleTabGroupId
  /** The open section, when it offers a choice of views. Null draws no second row. */
  subTabs: VisiblePeopleTabGroup | null
  activeTab: PeopleTab
  onGroup: (group: VisiblePeopleTabGroup) => void
  onView: (view: PeopleTab) => void
  rows: PhoneTabRows
}) {
  /**
   * The row of sections scrolls sideways on a phone, and the lit section is kept whole in view (v2.8130). It used to
   * sit where the row left it: at 320 px Paperwork read "Pape" under the title, and Review or Feedback sat out of sight.
   * Under the new phone layout the row is `ScrollableTabStrip`'s, which keeps it itself, and this ref holds nothing.
   */
  const groupStripRef = useRef<HTMLDivElement | null>(null)
  useLitPillInView(groupStripRef, [activeGroupId, groups.map((g) => g.id).join(',')].join(':'), LIT_SELECTED)

  const groupButtons = groups.map((g) => (
    <button
      key={g.id}
      type="button"
      role="tab"
      aria-selected={g.id === activeGroupId}
      data-tabkey={rows.oneLine ? g.id : undefined}
      onClick={() => onGroup(g)}
      style={pageTabStyle(g.id === activeGroupId)}
    >
      {g.label}
    </button>
  ))
  const pillButtons = subTabs
    ? subTabs.views.map((v) =>
        rows.oneLine ? (
          // One line on a phone: the pill is drawn as it was, inside a press as tall as a thumb needs.
          <button key={v} type="button" role="tab" aria-selected={v === activeTab} data-tabkey={v} onClick={() => onView(v)} style={PILL_PRESS} title={pillTitle(v)}>
            <span style={{ ...pageSubTabStyle(v === activeTab), display: 'block' }}>{PEOPLE_TAB_LABELS[v]}</span>
          </button>
        ) : (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === activeTab}
            onClick={() => onView(v)}
            style={pageSubTabStyle(v === activeTab)}
            title={pillTitle(v)}
          >
            {PEOPLE_TAB_LABELS[v]}
          </button>
        ),
      )
    : null
  const sectionsFrame: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    borderBottom: subTabs ? 'none' : '1px solid var(--border)',
    marginBottom: subTabs ? 0 : '1.5rem',
    overflow: 'hidden',
  }

  if (rows.oneLine) {
    return (
      <>
        <div data-phone-tab-row style={sectionsFrame}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ScrollableTabStrip role="tablist" ariaLabel="People sections" activeKey={activeGroupId} activePeek={PHONE_TAB_PEEK_PX} edgeMarks fadeSlack={PHONE_TAB_FADE_SLACK_PX} align="start" gap="0">
              {groupButtons}
            </ScrollableTabStrip>
          </div>
          {rows.titleDrawn ? <h1 style={TITLE}>People</h1> : <h1 className="sr-only" style={TITLE_UNDRAWN}>People</h1>}
        </div>
        {subTabs ? (
          <div data-phone-tab-row style={{ paddingBottom: '0.2rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <ScrollableTabStrip role="tablist" ariaLabel={`${subTabs.label} views`} activeKey={activeTab} activePeek={PHONE_PILL_PEEK_PX} edgeMarks fadeSlack={PHONE_PILL_FADE_SLACK_PX} align="start" gap="0.4rem">
              {pillButtons}
            </ScrollableTabStrip>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <>
      <div style={sectionsFrame}>
        <div ref={groupStripRef} style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div role="tablist" aria-label="People sections" style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
            {groupButtons}
          </div>
        </div>
        <h1 style={TITLE}>People</h1>
      </div>
      {subTabs ? (
        <div
          role="tablist"
          aria-label={`${subTabs.label} views`}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0 0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}
        >
          {pillButtons}
        </div>
      ) : null}
    </>
  )
}
