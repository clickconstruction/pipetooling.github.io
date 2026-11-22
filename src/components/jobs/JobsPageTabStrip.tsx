import { Fragment, type CSSProperties } from 'react'
import { ScrollableTabStrip } from '../ScrollableTabStrip'
import { pageTabStyle } from '../../lib/pageTabStyle'
import type { JobsPageTab, JobsPageTabKey } from '../../lib/jobs/jobsPageTabs'
import { PHONE_TAB_FADE_SLACK_PX, PHONE_TAB_PEEK_PX, type PhoneTabRows } from '../../lib/phoneLayout/phoneTabRows'

const TITLE: CSSProperties = { margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }
/** The title kept for a screen reader while the top bar shows the page's name, as the app hides a label it still says. */
const TITLE_UNDRAWN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)' }
const BAR: CSSProperties = { color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }

/**
 * The Jobs page's row of tabs with the page's title. The tabs come from `jobsPageTabs`, so a role sees the
 * tabs it has, in the row's order.
 *
 * Off the new phone layout the row is drawn as it always was: a plain sideways scroller with the title at
 * its right. On it (`rows.oneLine`) the same buttons sit in `ScrollableTabStrip`, which fades an edge that
 * has more past it and brings the open tab whole into view, and the title is not drawn while the top bar
 * names the page.
 */
export function JobsPageTabStrip({
  tabs,
  activeTab,
  onSelect,
  sticky,
  rows,
}: {
  tabs: readonly JobsPageTab[]
  /** The open tab. A value with no tab in the row (Billed) lights none. */
  activeTab: string
  onSelect: (key: JobsPageTabKey) => void
  /** The row stays at the top of the screen as the page scrolls: a phone's width. */
  sticky: boolean
  rows: PhoneTabRows
}) {
  const buttons = tabs.map((t) => (
    <Fragment key={t.key}>
      {t.barBefore ? <span style={BAR}>|</span> : null}
      <button
        type="button"
        data-tabkey={rows.oneLine ? t.key : undefined}
        onClick={() => onSelect(t.key)}
        style={pageTabStyle(activeTab === t.key)}
        title={t.title}
      >
        {t.label}
      </button>
    </Fragment>
  ))
  const frame: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    marginBottom: '1.5rem',
    overflow: 'hidden',
    ...(sticky ? { position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface)' } : null),
  }

  if (rows.oneLine) {
    return (
      <div data-jobs-page-tabs data-phone-tab-row style={frame}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ScrollableTabStrip
            activeKey={activeTab}
            activePeek={PHONE_TAB_PEEK_PX}
            edgeMarks
            fadeSlack={PHONE_TAB_FADE_SLACK_PX}
            ariaLabel="Jobs tabs"
            align="start"
            gap="0"
            fadeColor={sticky ? 'var(--surface)' : undefined}
          >
            {buttons}
          </ScrollableTabStrip>
        </div>
        {rows.titleDrawn ? <h1 style={TITLE}>Jobs</h1> : <h1 className="sr-only" style={TITLE_UNDRAWN}>Jobs</h1>}
      </div>
    )
  }

  return (
    <div data-jobs-page-tabs style={frame}>
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>{buttons}</div>
      </div>
      <h1 style={TITLE}>Jobs</h1>
    </div>
  )
}
