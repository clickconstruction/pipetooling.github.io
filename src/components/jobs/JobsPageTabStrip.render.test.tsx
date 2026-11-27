// @vitest-environment jsdom
/**
 * The Jobs page's row of tabs (`JobsPageTabStrip`), off and on the new phone layout.
 *
 * - Off, the row is the markup the page drew before the row was a component, character for character, for
 *   every role, every open tab and both widths. `StripBefore` below is that markup, copied from the page as
 *   of v2.8285.
 * - On, every tab the role has is still a press in the row: the same words, the same order, the same words
 *   for a resting pointer, the same press, the same place in the keyboard order. The two thin bars stay.
 * - The page's title is undrawn only while the top bar names the page, and a screen reader still reads it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { JobsPageTabStrip } from './JobsPageTabStrip'
import { jobsPageTabs, type JobsPageTabKey } from '../../lib/jobs/jobsPageTabs'
import { pageTabStyle } from '../../lib/pageTabStyle'
import { phoneTabRows } from '../../lib/phoneLayout/phoneTabRows'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { installDomShims } from '../../test/renderSmokeMocks'

/** The row as `Jobs.tsx` drew it at v2.8285, less the Billing tab, which left in v2.8698 and left its bar after Pipeline. Kept whole, one condition a button, so the comparison is with the page itself. */
function StripBefore({ authRole, myRole, activeTab, stickyTabStrip }: { authRole: string | null; myRole: string | null; activeTab: string; stickyTabStrip: boolean }) {
  const isPrimaryOrUnknown = authRole === 'primary' || myRole === 'primary' || (authRole === null && myRole === null)
  const showPrimaryRestrictedTabs = !isPrimaryOrUnknown
  const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
  const showStagesAndBillingTabs = showPrimaryRestrictedTabs && !isSuperintendent
  const showTeamsTab =
    showPrimaryRestrictedTabs && !isAssistantLike(authRole) && authRole !== 'superintendent' && myRole !== 'superintendent' && !isAssistantLike(myRole)
  const showTeamLaborTab = authRole !== 'assistant' && myRole !== 'assistant' && authRole !== 'superintendent' && myRole !== 'superintendent'
  const showSuperintendentExtraTabs = !isSuperintendent
  const press = () => {}
  return (
    <div
      data-jobs-page-tabs
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        ...(stickyTabStrip ? { position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface)' } : null),
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
          {showTeamsTab && (
            <button type="button" onClick={press} style={pageTabStyle(activeTab === 'teams-summary')}>
              Crew P&L
            </button>
          )}
          <button type="button" onClick={press} style={pageTabStyle(activeTab === 'reports')}>
            Reports
          </button>
          {showStagesAndBillingTabs && (
            <button type="button" onClick={press} style={pageTabStyle(activeTab === 'stages')}>
              Pipeline
            </button>
          )}
          {showPrimaryRestrictedTabs && (
            <>
              {showStagesAndBillingTabs && (
                <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
              )}
              {showTeamLaborTab && (
                <button type="button" onClick={press} style={pageTabStyle(activeTab === 'combined-labor')}>
                  Team
                </button>
              )}
              <button type="button" onClick={press} style={pageTabStyle(activeTab === 'subs')}>
                Subs
              </button>
              {showSuperintendentExtraTabs && (
                <button type="button" onClick={press} style={pageTabStyle(activeTab === 'parts')}>
                  Parts
                </button>
              )}
              {showSuperintendentExtraTabs && (
                <button
                  type="button"
                  onClick={press}
                  style={pageTabStyle(activeTab === 'materials')}
                  title="Materials on site: what is in the cages and boxes on every job, what went missing, which containers are due a count"
                >
                  Materials
                </button>
              )}
            </>
          )}
          {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
            <button type="button" onClick={press} style={pageTabStyle(activeTab === 'job-summary')}>
              Job Summary
            </button>
          )}
          {showPrimaryRestrictedTabs && showSuperintendentExtraTabs && (
            <>
              <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
              <button type="button" onClick={press} style={pageTabStyle(activeTab === 'inspections')}>
                Inspections
              </button>
            </>
          )}
        </div>
      </div>
      <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>Jobs</h1>
    </div>
  )
}

const ROLES: Array<string | null> = [null, 'dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'primary', 'helpers', 'subcontractor']
/** Every value the page's open tab takes, with Billed, which has no tab in the row. */
const OPEN: string[] = ['teams-summary', 'reports', 'stages', 'combined-labor', 'subs', 'parts', 'materials', 'job-summary', 'inspections', 'billed']

const OFF = phoneTabRows({ phoneLayoutOn: false, barNamesPage: false })
const ON_BAR_NAMES_PAGE = phoneTabRows({ phoneLayoutOn: true, barNamesPage: true })
const ON_DOCK = phoneTabRows({ phoneLayoutOn: true, barNamesPage: false })

function drawStrip(role: string | null, activeTab: string, rows = ON_BAR_NAMES_PAGE, onSelect: (key: JobsPageTabKey) => void = () => {}) {
  installDomShims()
  return render(<JobsPageTabStrip tabs={jobsPageTabs({ authRole: role, myRole: role })} activeTab={activeTab} sticky rows={rows} onSelect={onSelect} />)
}

/** What a person reads off a press: its words, the words for a resting pointer, and whether it is the lit one. */
const read = (b: HTMLElement) => ({ words: b.textContent, title: b.getAttribute('title'), lit: b.style.fontWeight === '700' })

/** The markup a draw leaves in the page, as one string. */
function markupOf(ui: ReactElement): string {
  installDomShims()
  const html = render(ui).container.innerHTML
  cleanup()
  return html
}

afterEach(() => cleanup())

describe('JobsPageTabStrip, off the new phone layout', () => {
  it('is the markup the page drew before, for every role, open tab and width', () => {
    let drawn = 0
    for (const role of ROLES) {
      for (const activeTab of OPEN) {
        for (const sticky of [false, true]) {
          const now = markupOf(
            <JobsPageTabStrip tabs={jobsPageTabs({ authRole: role, myRole: role })} activeTab={activeTab} sticky={sticky} rows={OFF} onSelect={() => {}} />,
          )
          const before = markupOf(<StripBefore authRole={role} myRole={role} activeTab={activeTab} stickyTabStrip={sticky} />)
          expect(now, `${role} on ${activeTab}, sticky ${sticky}`).toBe(before)
          drawn += 1
        }
      }
    }
    expect(drawn).toBe(ROLES.length * OPEN.length * 2)
  })

  it('draws nothing of the new layout', () => {
    const view = drawStrip('dev', 'stages', OFF)
    expect(view.container.querySelector('[data-phone-tab-row]')).toBeNull()
    expect(view.container.querySelector('.tab-strip-scroll')).toBeNull()
    expect(view.container.querySelector('[data-tabkey]')).toBeNull()
  })
})

describe('JobsPageTabStrip, on the new phone layout', () => {
  it('keeps every tab a role has: the same words, order and resting words, for every role', () => {
    for (const role of ROLES) {
      const off = drawStrip(role, 'reports', OFF)
      const before = Array.from(off.container.querySelectorAll('button')).map(read)
      cleanup()
      const on = drawStrip(role, 'reports')
      const now = Array.from(on.container.querySelectorAll('button')).map(read)
      expect(now, String(role)).toEqual(before)
      expect(now.length).toBeGreaterThan(0)
      cleanup()
    }
  })

  it('each press opens the tab it opened', () => {
    const picked = vi.fn()
    const view = drawStrip('dev', 'stages', ON_BAR_NAMES_PAGE, picked)
    const buttons = Array.from(view.container.querySelectorAll('button'))
    buttons.forEach((b) => fireEvent.click(b))
    expect(picked.mock.calls.map((c) => c[0])).toEqual(jobsPageTabs({ authRole: 'dev', myRole: 'dev' }).map((t) => t.key))
    // The row finds the open tab by this mark, so each press carries its own.
    expect(buttons.map((b) => b.dataset.tabkey)).toEqual(picked.mock.calls.map((c) => c[0]))
  })

  it('keeps the keyboard order: the presses are the row’s only stops, in the row’s order, none taken out', () => {
    const view = drawStrip('dev', 'stages')
    const strip = view.container.querySelector('[data-jobs-page-tabs]') as HTMLElement
    const stops = Array.from(strip.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [tabindex]'))
    expect(stops.map((s) => s.textContent)).toEqual(['Crew P&L', 'Reports', 'Pipeline', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections'])
    expect(stops.every((s) => s.tagName === 'BUTTON' && !s.hasAttribute('tabindex') && !(s as HTMLButtonElement).disabled)).toBe(true)
  })

  it('keeps the two thin bars, after Pipeline and before Inspections', () => {
    const view = drawStrip('dev', 'stages')
    const bars = Array.from(view.container.querySelectorAll('span')).filter((s) => s.textContent === '|')
    expect(bars.map((b) => b.nextElementSibling?.textContent)).toEqual(['Team', 'Inspections'])
  })

  it('lights the open tab alone, and none for Billed', () => {
    const lit = (activeTab: string) => {
      const view = drawStrip('dev', activeTab)
      const words = Array.from(view.container.querySelectorAll('button')).filter((b) => b.style.fontWeight === '700').map((b) => b.textContent)
      cleanup()
      return words
    }
    expect(lit('materials')).toEqual(['Materials'])
    expect(lit('inspections')).toEqual(['Inspections'])
    expect(lit('billed')).toEqual([])
  })

  it('is one scrolling line with the row’s own mark, still the strip the Pipeline’s sticky head measures', () => {
    const view = drawStrip('dev', 'stages')
    const strip = view.container.querySelector('[data-jobs-page-tabs]') as HTMLElement
    expect(strip.hasAttribute('data-phone-tab-row')).toBe(true)
    expect(strip.style.position).toBe('sticky')
    expect(strip.style.background).toBe('var(--surface)')
    const scroller = strip.querySelector('.tab-strip-scroll') as HTMLElement
    expect(scroller.getAttribute('aria-label')).toBe('Jobs tabs')
    expect(scroller.querySelectorAll('button')).toHaveLength(9)
    // One line: the row never folds.
    expect((scroller.firstElementChild as HTMLElement).style.flexWrap).toBe('nowrap')
  })

  it('leaves the title undrawn while the top bar names the page, and a screen reader still reads it', () => {
    const view = drawStrip('dev', 'stages', ON_BAR_NAMES_PAGE)
    const title = view.getByRole('heading', { level: 1, name: 'Jobs' })
    expect(title.style.width).toBe('1px')
    expect(title.style.height).toBe('1px')
    expect(title.style.overflow).toBe('hidden')
    expect(title.style.position).toBe('absolute')
  })

  it('keeps the title drawn where the bar names no page: the role dock', () => {
    const view = drawStrip('assistant', 'stages', ON_DOCK)
    const title = view.getByRole('heading', { level: 1, name: 'Jobs' })
    expect(title.style.fontSize).toBe('1.5rem')
    expect(title.style.width).toBe('')
    expect(title.style.position).toBe('')
    // The row is still the one scrolling line.
    expect(view.container.querySelector('.tab-strip-scroll')).not.toBeNull()
  })
})
