// @vitest-environment jsdom
/**
 * To-do #152 (v2.5803): the one Call button in its states. No seat: the `tel:` link, nothing beside it. A seat on a
 * desk: `tel:`, and the ▾ opens the words that make Quo the computer's calling app. A seat on a phone: the first press
 * opens the sheet with the two ways, each a link, and the pick is kept; Quo kept, the button is Quo's link and says
 * **Call in Quo**; the phone kept, `tel:` and **Call**; the ▾ brings the sheet back with the kept way marked. The words
 * a site gives it, and a glyph-only control's label, follow what the press does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import type { CallThrough } from '../../lib/quo/dial'

const state = vi.hoisted(() => ({
  seat: false,
  phone: false,
  kept: null as CallThrough | null,
  keep: vi.fn<(pick: CallThrough | null) => void>(),
  from: '(512) 555-0144' as string | null,
}))
vi.mock('../../hooks/useCallThrough', () => ({
  useCallThrough: () => ({ seat: state.seat, phone: state.phone, kept: state.kept, keep: state.keep, fromFor: () => state.from }),
}))

import { CallButton } from './CallButton'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const DANA = '(512) 555-0187'
const QUO = 'openphone://dial?number=%2B15125550187&from=%2B15125550144&action=call'
const green = { display: 'inline-flex', padding: '0.3rem 0.7rem', borderRadius: 8, background: '#16a34a', color: 'white' }

beforeEach(() => {
  state.seat = false
  state.phone = false
  state.kept = null
  state.from = '(512) 555-0144'
  state.keep.mockReset()
  document.body.innerHTML = ''
})

describe('CallButton', () => {
  it('no seat: the tel: link as it always was, with the glyph, and nothing beside it', () => {
    renderWithProviders(<CallButton number={DANA} name="Dana Whitfield" glyph="📞 " style={green} testId="call" />)
    const a = screen.getByTestId('call') as HTMLAnchorElement
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('tel:+15125550187')
    expect(a.textContent).toBe('📞 Call')
    expect(a.getAttribute('data-call-through')).toBe('phone')
    expect(screen.queryByRole('button', { name: 'Call another way' })).toBeNull()
  })

  it('a seat on a desk: tel:, and the ▾ opens the one-time words with the link under them', () => {
    state.seat = true
    renderWithProviders(<CallButton number={DANA} name="Dana Whitfield" style={green} testId="call" />)
    expect((screen.getByTestId('call') as HTMLAnchorElement).getAttribute('href')).toBe('tel:+15125550187')
    expect(screen.getByTestId('call').textContent).toBe('Call')
    fireEvent.click(screen.getByRole('button', { name: 'Call another way' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Call Dana Whitfield' })).toBeTruthy()
    expect(within(sheet).getByText('Call opens the app your computer uses for calls.')).toBeTruthy()
    expect(within(sheet).getByText(/On a Mac, open FaceTime/)).toBeTruthy()
    expect((within(sheet).getByTestId('call-ways-tel') as HTMLAnchorElement).getAttribute('href')).toBe('tel:+15125550187')
    expect((within(sheet).getByRole('link', { name: 'How calls go' }) as HTMLAnchorElement).getAttribute('href')).toBe('/help/call-a-customer-from-a-task')
    expect(state.keep).not.toHaveBeenCalled()
  })

  it('a seat on a phone, no pick yet: the press opens the sheet, the two ways are links, and the tap that picks keeps it', () => {
    state.seat = true
    state.phone = true
    renderWithProviders(<CallButton number={DANA} name="Dana Whitfield" glyph="📞 " style={green} testId="call" />)
    const press = screen.getByTestId('call')
    expect(press.tagName).toBe('BUTTON')
    expect(press.textContent).toBe('📞 Call')
    expect(press.getAttribute('data-call-through')).toBe('ask')
    fireEvent.click(press)
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Call Dana Whitfield' })).toBeTruthy()
    const quo = within(sheet).getByTestId('call-way-quo') as HTMLAnchorElement
    const phone = within(sheet).getByTestId('call-way-phone') as HTMLAnchorElement
    expect(quo.getAttribute('href')).toBe(QUO)
    expect(quo.textContent).toBe('Call in QuoDials from 512-555-0144. Quo writes the call in the thread.')
    expect(phone.getAttribute('href')).toBe('tel:+15125550187')
    expect(phone.textContent).toBe('Call from my phoneDials from your own number. Quo does not see the call.')
    expect(within(sheet).queryByText('Kept on this phone')).toBeNull()
    expect(within(sheet).getByText('The app keeps your pick on this phone. Press ▾ beside Call to change it.')).toBeTruthy()
    fireEvent.click(quo)
    expect(state.keep).toHaveBeenCalledWith('quo')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Quo kept: the button is Quo’s link and says Call in Quo; the ▾ shows the sheet with Quo marked', () => {
    state.seat = true
    state.phone = true
    state.kept = 'quo'
    renderWithProviders(<CallButton number={DANA} name="Dana Whitfield" verb="Call back" style={green} testId="call" />)
    const a = screen.getByTestId('call') as HTMLAnchorElement
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe(QUO)
    expect(a.textContent).toBe('Call back in Quo')
    expect(a.getAttribute('data-call-through')).toBe('quo')
    fireEvent.click(screen.getByTestId('call-ways'))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByTestId('call-way-quo').getAttribute('data-kept')).toBe('true')
    expect(within(sheet).getByTestId('call-way-phone').getAttribute('data-kept')).toBeNull()
    expect(within(sheet).getByText('Kept on this phone')).toBeTruthy()
    fireEvent.click(within(sheet).getByTestId('call-way-phone'))
    expect(state.keep).toHaveBeenCalledWith('phone')
  })

  it('the phone kept: tel: and plain Call, with the ▾ still there', () => {
    state.seat = true
    state.phone = true
    state.kept = 'phone'
    renderWithProviders(<CallButton number={DANA} glyph="☎ " style={green} testId="call" />)
    const a = screen.getByTestId('call') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('tel:+15125550187')
    expect(a.textContent).toBe('☎ Call')
    expect(screen.getByRole('button', { name: 'Call another way' })).toBeTruthy()
  })

  it('a number Quo’s link cannot carry stays tel: for a seat holder on a phone, with nothing beside it', () => {
    state.seat = true
    state.phone = true
    state.kept = 'quo'
    renderWithProviders(<CallButton number="(512) 555-0187 x12" style={green} testId="call" />)
    expect((screen.getByTestId('call') as HTMLAnchorElement).getAttribute('href')).toBe('tel:512555018712')
    expect(screen.getByTestId('call').textContent).toBe('Call')
    expect(screen.queryByRole('button', { name: 'Call another way' })).toBeNull()
  })

  it('a site’s own words and a glyph-only control’s label follow what the press does', () => {
    state.seat = true
    state.phone = true
    state.kept = 'quo'
    renderWithProviders(
      <>
        <CallButton number={DANA} words={(_, plain) => `${plain} ${DANA}`} testId="words" />
        <CallButton number={DANA} glyph="☎" words={() => null} ariaLabel={(plain) => `${plain} ${DANA}`} className="thread-head-control" testId="glyph" />
      </>,
    )
    expect(screen.getByTestId('words').textContent).toBe('Call in Quo (512) 555-0187')
    expect(screen.getByTestId('glyph').textContent).toBe('☎')
    expect(screen.getByTestId('glyph').getAttribute('aria-label')).toBe('Call in Quo (512) 555-0187')
    expect(screen.getByTestId('glyph-ways').className).toBe('thread-head-control')
  })

  it('titles the sheet by the number when there is no name', () => {
    state.seat = true
    state.phone = true
    renderWithProviders(<CallButton number={DANA} testId="call" />)
    fireEvent.click(screen.getByTestId('call'))
    expect(screen.getByRole('heading', { name: 'Call 512-555-0187' })).toBeTruthy()
  })
})
