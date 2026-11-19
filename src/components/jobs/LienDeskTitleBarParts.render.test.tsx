// @vitest-environment jsdom
/**
 * The Lien desk's title bar parts on their own (v2.7586): the GC picker (which no test named before), the four
 * view tabs and By paper's three. Inside the desk they are held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { LienGcPickerOption } from '../../lib/jobs/lienDeskGcPicker'
import { lienDeskFirstTab } from '../../lib/jobs/lienDeskTitleBar'
import { LienDeskGcPicker } from './LienDeskGcPicker'
import { LienDeskPaperTabs, LienDeskViewTabs } from './LienDeskViewTabs'

const gc = (id: string, over: Partial<LienGcPickerOption> = {}): LienGcPickerOption => ({ id, name: `ZZ Test Builder ${id}`, policy: 'ask', jobs: 2, open: 1_000, earliestDeadline: '2026-12-15', daysLeft: 28, needOwner: 0, awaiting: 0, missed: 0, nothingToClaim: false, closedMonths: [], ...over })

const options = [gc('a', { needOwner: 1, awaiting: 1 }), gc('b', { policy: 'send', jobs: 1 }), gc('c', { nothingToClaim: true, closedMonths: ['2026-06', '2026-07'], earliestDeadline: '', daysLeft: null }), gc('d', { nothingToClaim: true, earliestDeadline: '', daysLeft: null })]

afterEach(() => cleanup())

describe('LienDeskGcPicker, a phone’s sheet (a computer’s door left the title bar in v2.7806)', () => {
  const draw = (over: Partial<Parameters<typeof LienDeskGcPicker>[0]> = {}) => {
    const props = { open: true, onClose: vi.fn(), options, onPick: vi.fn(), ...over }
    render(<LienDeskGcPicker {...props} />)
    return props
  }

  it('closed, it draws nothing: no door of its own, and no sheet', () => {
    draw({ open: false })
    expect(document.querySelector('[data-lien-gc-picker]')).toBeNull()
    expect(document.querySelector('button')).toBeNull()
  })

  it('open, lists one row a GC with what is stuck on it', () => {
    draw()
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-lien-gc-option]')]
    expect(rows.map((r) => r.dataset.lienGcOption)).toEqual(['a', 'b', 'c', 'd'])
    expect(rows[0]!.textContent).toContain('ZZ Test Builder a')
    expect(rows[0]!.textContent).toContain('2 jobs')
    expect(rows[0]!.textContent).toContain('1 needs the owner')
    expect(rows[0]!.textContent).toContain('1 awaiting approval')
    expect(rows[1]!.textContent).toContain('1 job')
    expect(rows[1]!.textContent).toContain('rule: send')
  })

  it('heads the GCs with nothing left to claim once, before the first of them', () => {
    draw()
    const menu = document.querySelector('[data-lien-gc-picker]') as HTMLElement
    expect(menu.textContent?.split('Nothing left to claim')).toHaveLength(2)
    const dead = [...menu.querySelectorAll<HTMLButtonElement>('[data-nothing-to-claim="yes"]')]
    expect(dead.map((r) => r.dataset.lienGcOption)).toEqual(['c', 'd'])
    expect(dead[0]!.textContent).toContain('windows closed')
    expect(dead[1]!.textContent).toContain('every window closed')
    expect(dead[0]!.textContent).toContain('chase it in Collections')
  })

  it('a row’s press closes the menu and hands the GC to the desk', () => {
    const props = draw()
    fireEvent.click(document.querySelector('[data-lien-gc-option="b"]') as HTMLButtonElement)
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.onPick).toHaveBeenCalledWith('b')
  })

  it('open, it is a sheet with no door over it, and a press outside closes it', () => {
    const props = draw()
    expect(document.querySelector('button[aria-haspopup="menu"]')).toBeNull()
    const sheet = document.querySelector('[data-lien-gc-picker]') as HTMLElement
    expect(sheet.style.position).toBe('fixed')
    fireEvent.click(sheet.previousElementSibling as HTMLElement)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('LienDeskViewTabs and LienDeskPaperTabs', () => {
  const kindTabs = { ref: { current: null }, onScroll: () => {}, style: {} }

  it('on a computer the first tab is the page’s name and its press is the title’s', () => {
    const onTitle = vi.fn()
    const onPick = vi.fn()
    render(<LienDeskViewTabs kindTabs={kindTabs} isMobile={false} kind="notice" paperShown firstTab={lienDeskFirstTab({ isMobile: false, count: 3 })} onTitle={onTitle} onPick={onPick} />)
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-lien-desk-view]')]
    expect(tabs.map((t) => t.dataset.lienDeskView)).toEqual(['next', 'calendar', 'paper', 'timeline'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false'])
    expect(tabs[0]!.hasAttribute('data-lien-desk-title')).toBe(true)
    // The other three read one word each (v2.7784), and each is still found by its view's name.
    expect(tabs.slice(1).map((t) => t.textContent)).toEqual(['Date', 'Paper', 'Job'])
    expect(tabs.slice(1).map((t) => t.title.split(':')[0])).toEqual(['By date', 'By paper', 'By job'])
    expect(screen.getByRole('tab', { name: 'By paper' })).toBe(tabs[2])
    fireEvent.click(tabs[0]!)
    expect(onTitle).toHaveBeenCalledTimes(1)
    fireEvent.click(tabs[3]!)
    expect(onPick).toHaveBeenCalledWith('timeline')
  })

  it('on a phone the first tab is a plain view tab', () => {
    const onTitle = vi.fn()
    const onPick = vi.fn()
    render(<LienDeskViewTabs kindTabs={kindTabs} isMobile kind="next" paperShown={false} firstTab={lienDeskFirstTab({ isMobile: true, count: 3 })} onTitle={onTitle} onPick={onPick} />)
    const first = document.querySelector('[data-lien-desk-view="next"]') as HTMLButtonElement
    expect(first.hasAttribute('data-lien-desk-title')).toBe(false)
    // A phone's tabs read the names whole, with no label over them.
    const rest = [...document.querySelectorAll<HTMLButtonElement>('[data-lien-desk-view]')].slice(1)
    expect(rest.map((t) => t.textContent)).toEqual(['By date', 'By paper', 'By job'])
    expect(rest.map((t) => t.getAttribute('aria-label'))).toEqual([null, null, null])
    fireEvent.click(first)
    expect(onPick).toHaveBeenCalledWith('next')
    expect(onTitle).not.toHaveBeenCalled()
  })

  it('By paper’s tabs carry their counts once the desk has them', () => {
    const onPick = vi.fn()
    const { rerender } = render(<LienDeskPaperTabs isMobile={false} kind="affidavit" toolsOnTitleLine={false} noticeCount={null} affCount={null} retCount={null} onPick={onPick} />)
    const words = () => [...document.querySelectorAll('[data-lien-desk-paper-kinds] [role="tab"]')].map((t) => t.textContent)
    expect(words()).toEqual(['Monthly notices', 'Lien affidavits', 'Retainage notices'])
    rerender(<LienDeskPaperTabs isMobile={false} kind="affidavit" toolsOnTitleLine={false} noticeCount={4} affCount={0} retCount={2} onPick={onPick} />)
    expect(words()).toEqual(['Monthly notices · 4', 'Lien affidavits · 0', 'Retainage notices · 2'])
    fireEvent.click(document.querySelectorAll('[data-lien-desk-paper-kinds] [role="tab"]')[2] as HTMLElement)
    expect(onPick).toHaveBeenCalledWith('retainage')
  })
})
