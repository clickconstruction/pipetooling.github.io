// @vitest-environment jsdom
/**
 * **Which site is it for?** on a phone with the keyboard up (finding 337, punch list #439, piece 3): the backdrop
 * follows the part of the page that shows, the head and its × never scroll, and while the room is short the lead and
 * then the first choice give way to the rows. At a desk the window is as it was. Every address here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetModalStackForTests } from '../../lib/modalStack'
import { PICKER_PHONE_QUERY } from '../../lib/addresses/paperSitePickerFrame'
import { PaperSitePicker } from './PaperSitePicker'

vi.mock('../../hooks/useAddressesOnFile', () => ({
  readAddresses: async () => ({
    rows: [
      { kind: 'job', id: 'j1', address: '118 Old Quarry Trail, Sampleton, TX 78000', developmentId: null, label: 'J1340' },
      { kind: 'job', id: 'j2', address: '240 Old Quarry Trail, Sampleton, TX 78000', developmentId: null, label: 'J1341' },
    ],
    developments: new Map<string, string>(),
  }),
}))

const realMatchMedia = window.matchMedia
const realViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')

function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PICKER_PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

/** The part of the page that shows. `set` moves the keyboard and says so, as the browser does. */
function viewport(height: number, offsetTop = 0) {
  const heard = new Set<() => void>()
  const vv = { height, offsetTop, width: 375, addEventListener: (_type: string, f: () => void) => heard.add(f), removeEventListener: (_type: string, f: () => void) => heard.delete(f) }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    set(nextHeight: number, nextTop: number) {
      vv.height = nextHeight
      vv.offsetTop = nextTop
      act(() => heard.forEach((f) => f()))
    },
  }
}

const draw = () => render(<PaperSitePicker busy={false} onPick={() => undefined} onClose={() => undefined} />)
const place = () => {
  const s = screen.getByTestId('paper-site-backdrop').style
  return { top: s.top, height: s.height, inset: s.inset }
}

afterEach(() => {
  cleanup()
  resetModalStackForTests()
  window.matchMedia = realMatchMedia
  if (realViewport) Object.defineProperty(window, 'visualViewport', realViewport)
  else Reflect.deleteProperty(window, 'visualViewport')
})

describe('PaperSitePicker on a phone', () => {
  it('follows the part of the page that shows when the keyboard comes up, and the head with its × is outside what scrolls', async () => {
    screenIs(true)
    const vv = viewport(553)
    draw()
    await screen.findByTestId('paper-site-hint')
    expect(place()).toMatchObject({ top: '0px', height: '553px' })
    // The keyboard is up and the iPhone slid the page down to the address box.
    vv.set(281, 187)
    expect(place()).toMatchObject({ top: '187px', height: '281px' })
    const head = screen.getByTestId('paper-site-head')
    const body = screen.getByTestId('paper-site-body')
    expect(head.textContent).toContain('Which site is it for?')
    expect(head.querySelector('button[aria-label="Close"]')).toBeTruthy()
    expect(body.contains(head)).toBe(false)
    expect(body.style.overflow).toBe('auto')
    expect(body.contains(screen.getByLabelText('Find an address on file'))).toBe(true)
  })

  it('in a short room the lead gives way, and the first choice gives way once something is typed and comes back with an empty box', async () => {
    screenIs(true)
    viewport(281, 187)
    draw()
    await screen.findByTestId('paper-site-hint')
    expect(screen.queryByText('Pick the address the paper is for. Every job and bid at that place is the site.')).toBeNull()
    expect(screen.getByRole('button', { name: /It is not for a site/ })).toBeTruthy()
    const box = screen.getByLabelText('Find an address on file')
    fireEvent.change(box, { target: { value: 'old quarry' } })
    expect(screen.getAllByTestId('paper-site-row')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /It is not for a site/ })).toBeNull()
    expect(screen.getByTestId('paper-site-head').textContent).toContain('Which site is it for?')
    fireEvent.change(box, { target: { value: '' } })
    expect(screen.getByRole('button', { name: /It is not for a site/ })).toBeTruthy()
  })

  it('on a phone with the keyboard down nothing gives way', async () => {
    screenIs(true)
    viewport(553)
    draw()
    await screen.findByTestId('paper-site-hint')
    expect(screen.getByText('Pick the address the paper is for. Every job and bid at that place is the site.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: 'old quarry' } })
    expect(screen.getByRole('button', { name: /It is not for a site/ })).toBeTruthy()
  })
})

describe('PaperSitePicker at a desk', () => {
  it('is pinned to the page as it was, whatever the browser says shows, and gives nothing up', async () => {
    screenIs(false)
    viewport(281, 187)
    draw()
    await screen.findByTestId('paper-site-hint')
    expect(place().inset).toBe('0')
    expect(place().top).not.toBe('187px')
    fireEvent.change(screen.getByLabelText('Find an address on file'), { target: { value: 'old quarry' } })
    expect(screen.getByText('Pick the address the paper is for. Every job and bid at that place is the site.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /It is not for a site/ })).toBeTruthy()
  })

  it('where the browser cannot say what shows, a phone keeps the whole page too', async () => {
    screenIs(true)
    Reflect.deleteProperty(window, 'visualViewport')
    draw()
    await screen.findByTestId('paper-site-hint')
    expect(place().inset).toBe('0')
  })
})
