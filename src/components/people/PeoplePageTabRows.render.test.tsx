// @vitest-environment jsdom
/**
 * The People page's two rows of tabs (`PeoplePageTabRows`), off and on the new phone layout.
 *
 * - Off, both rows are the markup the page drew before they were a component, character for character, for
 *   every set of sections and every open view. `RowsBefore` below is that markup, copied from the page as of
 *   v2.8285.
 * - On, every section and every pill is still a press in its row: the same words, the same order, the same
 *   lit one, the same press, the same place in the keyboard order. The pills are one line, never two.
 * - The page's title is undrawn only while the top bar names the page, and a screen reader still reads it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PeoplePageTabRows } from './PeoplePageTabRows'
import { pageSubTabStyle, pageTabStyle } from '../../lib/pageTabStyle'
import {
  PEOPLE_TABS,
  PEOPLE_TAB_LABELS,
  groupOfTab,
  visibleTabGroups,
  type PeopleTab,
  type VisiblePeopleTabGroup,
} from '../../lib/people/peopleTabGroups'
import { PHONE_PILL_PRESS_PX, phoneTabRows } from '../../lib/phoneLayout/phoneTabRows'
import { installDomShims } from '../../test/renderSmokeMocks'

/** The two rows as `People.tsx` drew them at v2.8285, so the comparison is with the page itself. */
function RowsBefore({ tabGroups, activeTab }: { tabGroups: VisiblePeopleTabGroup[]; activeTab: PeopleTab }) {
  const activeGroupId = groupOfTab(activeTab)
  const activeGroup = tabGroups.find((g) => g.id === activeGroupId)
  const activeSubTabs = activeGroup && activeGroup.views.length > 1 ? activeGroup : null
  const press = () => {}
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: activeSubTabs ? 'none' : '1px solid var(--border)', marginBottom: activeSubTabs ? 0 : '1.5rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div role="tablist" aria-label="People sections" style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}>
            {tabGroups.map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={g.id === activeGroupId} onClick={press} style={pageTabStyle(g.id === activeGroupId)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <h1 style={{ flexShrink: 0, margin: 0, marginLeft: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>People</h1>
      </div>
      {activeSubTabs ? (
        <div
          role="tablist"
          aria-label={`${activeSubTabs.label} views`}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0 0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}
        >
          {activeSubTabs.views.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === activeTab}
              onClick={press}
              style={pageSubTabStyle(v === activeTab)}
              title={v === 'person' ? 'One person, every control — the Person Desk as a page' : undefined}
            >
              {PEOPLE_TAB_LABELS[v]}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

const all = (views: readonly PeopleTab[]) => Object.fromEntries(views.map((v) => [v, true])) as Partial<Record<PeopleTab, boolean>>

/** Three people's sets of views: every view, an office set with no Review or Feedback, and the two a helper keeps. */
const SETS: Record<string, readonly PeopleTab[]> = {
  everything: PEOPLE_TABS,
  office: ['users', 'subs', 'person', 'spending', 'whos_where', 'utilization', 'hours', 'pay_stubs', 'offsets', 'employment', 'contracts', 'licenses', 'writeups', 'vehicles', 'housing'],
  few: ['users', 'subs'],
}

const OFF = phoneTabRows({ phoneLayoutOn: false, barNamesPage: false })
const ON_BAR_NAMES_PAGE = phoneTabRows({ phoneLayoutOn: true, barNamesPage: true })
const ON_DOCK = phoneTabRows({ phoneLayoutOn: true, barNamesPage: false })

function rowsFor(views: readonly PeopleTab[], activeTab: PeopleTab) {
  const groups = visibleTabGroups(all(views))
  const activeGroupId = groupOfTab(activeTab)
  const activeGroup = groups.find((g) => g.id === activeGroupId)
  return { groups, activeGroupId, subTabs: activeGroup && activeGroup.views.length > 1 ? activeGroup : null }
}

function drawRows(
  views: readonly PeopleTab[],
  activeTab: PeopleTab,
  rows = ON_BAR_NAMES_PAGE,
  on: { group?: (g: VisiblePeopleTabGroup) => void; view?: (v: PeopleTab) => void } = {},
) {
  installDomShims()
  const { groups, activeGroupId, subTabs } = rowsFor(views, activeTab)
  return render(
    <PeoplePageTabRows groups={groups} activeGroupId={activeGroupId} subTabs={subTabs} activeTab={activeTab} rows={rows} onGroup={on.group ?? (() => {})} onView={on.view ?? (() => {})} />,
  )
}

/** What a person reads off a tab: its words, the words for a resting pointer, and whether it is the lit one. */
const read = (b: Element) => ({ words: b.textContent, title: b.getAttribute('title'), lit: b.getAttribute('aria-selected') })
const tabsOf = (list: Element) => Array.from(list.querySelectorAll('[role="tab"]'))

/** The markup a draw leaves in the page, as one string. */
function markupOf(ui: ReactElement): string {
  installDomShims()
  const html = render(ui).container.innerHTML
  cleanup()
  return html
}

afterEach(() => cleanup())

describe('PeoplePageTabRows, off the new phone layout', () => {
  it('is the markup the page drew before, for every set of sections and every open view', () => {
    let drawn = 0
    for (const [name, views] of Object.entries(SETS)) {
      for (const activeTab of views) {
        const { groups, activeGroupId, subTabs } = rowsFor(views, activeTab)
        const now = markupOf(
          <PeoplePageTabRows groups={groups} activeGroupId={activeGroupId} subTabs={subTabs} activeTab={activeTab} rows={OFF} onGroup={() => {}} onView={() => {}} />,
        )
        const before = markupOf(<RowsBefore tabGroups={groups} activeTab={activeTab} />)
        expect(now, `${name} on ${activeTab}`).toBe(before)
        drawn += 1
      }
    }
    expect(drawn).toBe(PEOPLE_TABS.length + SETS.office!.length + SETS.few!.length)
  })

  it('draws nothing of the new layout, and the pills still fold onto as many rows as they need', () => {
    const view = drawRows(PEOPLE_TABS, 'users', OFF)
    expect(view.container.querySelector('[data-phone-tab-row]')).toBeNull()
    expect(view.container.querySelector('.tab-strip-scroll')).toBeNull()
    expect(view.container.querySelector('[data-tabkey]')).toBeNull()
    expect((view.getByRole('tablist', { name: 'People views' }) as HTMLElement).style.flexWrap).toBe('wrap')
  })
})

describe('PeoplePageTabRows, on the new phone layout', () => {
  it('keeps every section and every pill: the same words, order, lit one and resting words', () => {
    for (const [name, views] of Object.entries(SETS)) {
      for (const activeTab of views) {
        const off = drawRows(views, activeTab, OFF)
        const before = off.getAllByRole('tablist').map((list) => ({ name: list.getAttribute('aria-label'), tabs: tabsOf(list).map(read) }))
        cleanup()
        const on = drawRows(views, activeTab)
        const now = on.getAllByRole('tablist').map((list) => ({ name: list.getAttribute('aria-label'), tabs: tabsOf(list).map(read) }))
        expect(now, `${name} on ${activeTab}`).toEqual(before)
        cleanup()
      }
    }
  })

  it('a dev’s seven People pills are one line, in the row’s order', () => {
    const view = drawRows(PEOPLE_TABS, 'users')
    const pills = view.getByRole('tablist', { name: 'People views' }) as HTMLElement
    expect(tabsOf(pills).map((p) => p.textContent)).toEqual(['Users', 'Subs', 'Person', 'Spending', 'Day book', "Who's where", 'Utilization'])
    expect(pills.classList.contains('tab-strip-scroll')).toBe(true)
    expect((pills.firstElementChild as HTMLElement).style.flexWrap).toBe('nowrap')
    const sections = view.getByRole('tablist', { name: 'People sections' })
    expect(tabsOf(sections).map((p) => p.textContent)).toEqual(['People', 'Pay', 'Paperwork', 'Fleet & Housing', 'Review', 'Feedback'])
  })

  it('each section’s press and each pill’s press runs what it ran', () => {
    const group = vi.fn()
    const pill = vi.fn()
    const view = drawRows(PEOPLE_TABS, 'users', ON_BAR_NAMES_PAGE, { group, view: pill })
    tabsOf(view.getByRole('tablist', { name: 'People sections' })).forEach((t) => fireEvent.click(t))
    expect(group.mock.calls.map((c) => (c[0] as VisiblePeopleTabGroup).id)).toEqual(['people', 'pay', 'paperwork', 'fleet', 'review', 'feedback'])
    tabsOf(view.getByRole('tablist', { name: 'People views' })).forEach((t) => fireEvent.click(t))
    expect(pill.mock.calls.map((c) => c[0])).toEqual(['users', 'subs', 'person', 'spending', 'day_book', 'whos_where', 'utilization'])
  })

  it('a pill is drawn as it was, inside a press as tall as a thumb needs', () => {
    const view = drawRows(PEOPLE_TABS, 'spending')
    const presses = tabsOf(view.getByRole('tablist', { name: 'People views' })) as HTMLElement[]
    for (const press of presses) {
      expect(press.tagName).toBe('BUTTON')
      expect(press.style.minHeight).toBe(`${PHONE_PILL_PRESS_PX}px`)
      const pill = press.firstElementChild as HTMLElement
      const look = pageSubTabStyle(press.getAttribute('aria-selected') === 'true')
      expect(pill.style.borderRadius).toBe('999px')
      expect(pill.style.fontSize).toBe(look.fontSize)
      expect(pill.style.padding).toBe(look.padding)
      expect(pill.style.backgroundColor).toBe(look.backgroundColor)
      expect(pill.style.fontWeight).toBe(String(look.fontWeight))
    }
    expect(presses.filter((p) => p.getAttribute('aria-selected') === 'true').map((p) => p.textContent)).toEqual(['Spending'])
  })

  it('keeps the keyboard order: sections, then pills, each row in its order, none taken out', () => {
    const view = drawRows(PEOPLE_TABS, 'day_book')
    const stops = Array.from(view.container.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [tabindex]'))
    expect(stops.map((s) => s.textContent)).toEqual([
      'People', 'Pay', 'Paperwork', 'Fleet & Housing', 'Review', 'Feedback',
      'Users', 'Subs', 'Person', 'Spending', 'Day book', "Who's where", 'Utilization',
    ])
    expect(stops.every((s) => s.tagName === 'BUTTON' && !s.hasAttribute('tabindex') && !(s as HTMLButtonElement).disabled)).toBe(true)
  })

  it('draws no second row for a section with one view', () => {
    const view = drawRows(PEOPLE_TABS, 'feedback')
    expect(view.getAllByRole('tablist')).toHaveLength(1)
    expect(view.container.querySelectorAll('[data-phone-tab-row]')).toHaveLength(1)
  })

  it('leaves the title undrawn while the top bar names the page, and a screen reader still reads it', () => {
    const view = drawRows(PEOPLE_TABS, 'users', ON_BAR_NAMES_PAGE)
    const title = view.getByRole('heading', { level: 1, name: 'People' })
    expect(title.style.width).toBe('1px')
    expect(title.style.height).toBe('1px')
    expect(title.style.overflow).toBe('hidden')
    expect(title.style.position).toBe('absolute')
  })

  it('keeps the title drawn where the bar names no page: the role dock', () => {
    const view = drawRows(SETS.office!, 'users', ON_DOCK)
    const title = view.getByRole('heading', { level: 1, name: 'People' })
    expect(title.style.fontSize).toBe('1.5rem')
    expect(title.style.width).toBe('')
    expect(title.style.position).toBe('')
    expect(view.container.querySelectorAll('.tab-strip-scroll')).toHaveLength(2)
  })
})
