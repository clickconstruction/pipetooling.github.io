// @vitest-environment jsdom
/**
 * The presses the phone walk of 2026-11-21 read under a thumb on the Lien desk (punch list #352), each held at 44 px
 * on a phone and left as it was on a computer. A layout is a browser's to measure, so this holds the sizes the measure
 * rests on: the style each press is drawn with, and `thumbInLine`, the rule that grows a press without moving the
 * line it sits in. The find box is held in `LienDeskFindBox.render.test.tsx`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PhoneSheet, PHONE_SHEET_QUERY } from '../PhoneSheet'
import { resetModalStackForTests } from '../../lib/modalStack'
import { LienJobNumber } from './LienJobNumber'
import { LienPilePress } from './LienPileHeads'
import { LIEN_PHONE_LIST_PRESS } from './lienDeskRowStyles'

const realMatchMedia = window.matchMedia

function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_SHEET_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

afterEach(() => {
  cleanup()
  resetModalStackForTests()
  window.matchMedia = realMatchMedia
})

const source = (file: string) => readFileSync(resolve(process.cwd(), 'src/components/jobs', file), 'utf8')

describe('the Lien desk’s presses on a phone (the walk of 2026-11-21)', () => {
  it('a sheet’s × is a thumb’s square on a phone and the title row keeps its height; a desk’s window keeps the small ×', () => {
    screenIs(true)
    const phone = render(
      <PhoneSheet label="More on the Lien desk" title="More" onClose={vi.fn()}>
        <div />
      </PhoneSheet>,
    )
    const x = screen.getByRole('button', { name: 'Close' })
    expect([x.style.minHeight, x.style.minWidth]).toEqual(['44px', '44px'])
    // 27 px drawn: 8.5 comes back over it and under it, and 9.5 at each side, so the × is drawn where it was.
    expect([x.style.marginTop, x.style.marginBottom, x.style.marginLeft, x.style.marginRight]).toEqual(['-8.5px', '-8.5px', '-9.5px', '-9.5px'])
    phone.unmount()
    screenIs(false)
    render(
      <PhoneSheet label="More on the Lien desk" title="More" onClose={vi.fn()}>
        <div />
      </PhoneSheet>,
    )
    const desk = screen.getByRole('button', { name: 'Close' })
    expect([desk.style.minHeight, desk.style.minWidth, desk.style.marginTop]).toEqual(['', '', ''])
  })

  it('a job’s number on a By date row is a thumb’s square that leaves the row’s first line 28 px', () => {
    const phone = render(<LienJobNumber number="2104" onOpen={vi.fn()} phone />)
    const door = screen.getByRole('button', { name: '2104' })
    expect([door.style.minHeight, door.style.minWidth, door.style.marginTop, door.style.marginBottom]).toEqual(['44px', '44px', '-8px', '-8px'])
    phone.unmount()
    render(<LienJobNumber number="2104" onOpen={vi.fn()} />)
    const desk = screen.getByRole('button', { name: '2104' })
    expect([desk.style.minHeight, desk.style.minWidth]).toEqual(['', ''])
  })

  it('a press in a pile’s title is 44 px with its pill drawn inside at 30, and the 40 px title is left alone', () => {
    const look = { padding: '1px 8px', borderRadius: 6, background: '#2563eb', color: '#fff', fontSize: '0.66rem' }
    const phone = render(
      <LienPilePress phone look={look} data-lien-pile-run onClick={vi.fn()} title="Every approved notice as one packet">
        Print and mail 14
      </LienPilePress>,
    )
    const press = screen.getByRole('button', { name: 'Print and mail 14' })
    expect(press.hasAttribute('data-lien-pile-run')).toBe(true)
    // 38 px inside the title's two hairlines: 3 comes back over the press and under it.
    expect([press.style.minHeight, press.style.marginTop, press.style.marginBottom]).toEqual(['44px', '-3px', '-3px'])
    expect(press.style.background).toBe('none')
    const pill = press.querySelector<HTMLElement>('[data-lien-pile-press-pill]')!
    expect([pill.style.minHeight, pill.style.fontSize, pill.style.borderRadius]).toEqual(['30px', '0.8125rem', '6px'])
    phone.unmount()
    // A computer's press is the pill itself, as it was.
    render(
      <LienPilePress phone={false} look={look} data-lien-pile-run onClick={vi.fn()}>
        Print and mail 14
      </LienPilePress>,
    )
    const desk = screen.getByRole('button', { name: 'Print and mail 14' })
    expect([desk.style.minHeight, desk.style.fontSize, desk.style.padding]).toEqual(['', '0.66rem', '1px 8px'])
    expect(desk.querySelector('[data-lien-pile-press-pill]')).toBeNull()
  })

  it('the batch presses over the affidavits are 44 px on a phone only', () => {
    expect(LIEN_PHONE_LIST_PRESS.minHeight).toBe(44)
    const list = source('LienDeskAffidavitList.tsx')
    expect(list).toContain("style={{ ...btn('plain', affSendBusy), justifySelf: 'start', ...(isMobile ? LIEN_PHONE_LIST_PRESS : null) }}")
    expect(list).toContain("style={{ ...btn('plain', redrawBusy), justifySelf: 'start', ...(isMobile ? LIEN_PHONE_LIST_PRESS : null) }}")
  })

  it('Worked later? on a phone row and the Board’s red line stand a thumb tall in the line they had', () => {
    // The phone row's press was 28 px; the desk's own Worked later? on the axis is another press and is not touched.
    expect(source('LienDeskCalendarTab.tsx')).toMatch(/data-testid="lien-cal-worked-later"[\s\S]{0,320}style=\{\{ flex: 'none', \.\.\.thumbInLine\(28\), border: 'none'/)
    // The Board's line was 32 px on a phone and has no height of its own on a computer.
    expect(source('LienBoard.tsx')).toMatch(/data-lien-board-tile-line-press=[^\n]*borderRadius: 3, \.\.\.\(isMobile \? thumbInLine\(32\) : null\) \}\}>/)
  })
})
