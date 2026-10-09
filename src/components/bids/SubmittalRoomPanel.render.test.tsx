// @vitest-environment jsdom
/**
 * Render smoke for the Share step's body, moved out of `BidsSubmittalsTab.tsx` (2026-10-04): the
 * seam pinned. It draws what it is handed and reports each press; nothing is written here.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalRoomPanel, type SubmittalRoomPanelProps } from './SubmittalRoomPanel'
import type { SubmittalEventRow, SubmittalPersonRow, SubmittalRoomRow } from '../../lib/submittals/submittalRoom'

const room = { id: 'room', bid_id: 'b', token: 'a'.repeat(48), status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null } as unknown as SubmittalRoomRow
const dana = { id: 'p1', room_id: 'room', name: 'Dana Whitfield', email: 'dana@arch.test', role: 'architect', may_decide: true, token: 'b'.repeat(48), how: 'named', invited_by: null, first_seen_at: null, last_seen_at: null, open_count: 0, closed_at: null, created_at: '', updated_at: '' } as unknown as SubmittalPersonRow
const view = { id: 'e1', room_id: 'room', person_id: null, submittal_id: null, event_type: 'view', metadata: {}, occurred_at: '2026-09-17T15:00:00Z' } as unknown as SubmittalEventRow

function mount(over: Partial<SubmittalRoomPanelProps> = {}) {
  const on = { onShare: vi.fn(), onCloseRoom: vi.fn(), onReopenRoom: vi.fn(), onSetMayDecide: vi.fn(), onClosePerson: vi.fn() }
  renderWithProviders(
    <SubmittalRoomPanel showShare revisionShared={false} shareGate={{ on: true, why: null }} room={room} roomLine="Room link · shared Sep 16 · opened 1×" people={[dana]} events={[view]} decidedBy={() => 3} busy={false} {...on} {...over} />,
  )
  return on
}

describe('SubmittalRoomPanel', () => {
  it('the Share button with its line, the room line, and a person with their trail and switch', () => {
    const on = mount()
    expect(screen.getByTestId('share-button').textContent).toBe('Share')
    expect(screen.getByTestId('share-caption').textContent).toBe('The same link shows every later version.')
    expect(screen.getByTestId('room-line').textContent).toContain('Room link · shared Sep 16 · opened 1×')
    const people = screen.getByTestId('room-people')
    expect(people.textContent).toContain('Dana Whitfield · architect')
    expect(people.textContent).toContain('decided 3')
    expect(people.textContent).toContain('+ 1 open')
    fireEvent.click(screen.getByTestId('share-button'))
    expect(on.onShare).toHaveBeenCalledTimes(1)
    fireEvent.click(within(people).getByRole('button', { name: 'watching' }))
    expect(on.onSetMayDecide).toHaveBeenCalledWith('p1', false)
    fireEvent.click(screen.getByRole('button', { name: "Close Dana Whitfield's link" }))
    expect(on.onClosePerson).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('button', { name: 'Close the room' }))
    expect(on.onCloseRoom).toHaveBeenCalledTimes(1)
  })

  it('v2.5027 · a submittal leaves only through Share or Send the link: no Sent by email door on a draft, before or after a share', () => {
    mount({ room: null, roomLine: '', people: [], events: [] })
    expect(screen.getByTestId('share-button').textContent).toBe('Share')
    expect(screen.queryByTestId('sent-outside-open')).toBeNull()
    expect(screen.queryByText(/Sent by email/)).toBeNull()
    cleanup()
    mount()
    expect(screen.queryByTestId('sent-outside-open')).toBeNull()
  })

  it('a held Share says what turns it on; a shared revision reads share again', () => {
    mount({ shareGate: { on: false, why: 'Share turns on once the package is built.' }, room: null, roomLine: '', people: [], events: [] })
    expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('share-caption').textContent).toBe('Share turns on once the package is built.')
    expect(screen.queryByTestId('room-line')).toBeNull()
  })

  it('a closed room holds Share and offers Reopen; with nobody on it, it says so', () => {
    const on = mount({ revisionShared: true, room: { ...room, status: 'closed' } as SubmittalRoomRow, roomLine: 'Room closed · Sep 19', people: [], events: [] })
    expect(screen.getByTestId('share-button').textContent).toBe('Shared · share again')
    expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('room-line').textContent).toContain('Nobody has identified themselves yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(on.onReopenRoom).toHaveBeenCalledTimes(1)
  })

  it('no Share button on an older revision: the room alone', () => {
    mount({ showShare: false })
    expect(screen.queryByTestId('share-button')).toBeNull()
    expect(screen.getByTestId('room-line')).toBeTruthy()
  })

  it('v2.4608 · Open their page opens the real page flagged as the office’s preview; Copy link still copies the plain link the office sends', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mount()
    const door = screen.getByTestId('room-open-preview') as HTMLAnchorElement
    expect(door.textContent).toBe('Open their page ↗')
    expect(door.getAttribute('href')).toBe(`${window.location.origin}/submittal?t=${'a'.repeat(48)}&preview=1`)
    expect(door.getAttribute('target')).toBe('_blank')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/submittal?t=${'a'.repeat(48)}`)
  })

  it('v2.4608 · no door while nothing was ever shared from the app', () => {
    mount({ room: { ...room, shared_at: null } as unknown as SubmittalRoomRow })
    expect(screen.queryByTestId('room-open-preview')).toBeNull()
  })
})

describe('SubmittalRoomPanel · v2.5026 Send the link (decision 11)', () => {
  it('a person with an address gets the door; its short form sends their id and the line, and closes once it went', async () => {
    const onSendLink = vi.fn(() => Promise.resolve(true))
    mount({ onSendLink })
    fireEvent.click(screen.getByTestId('send-link-open'))
    const form = screen.getByTestId('send-link-form')
    expect(form.textContent).toContain('Email Dana Whitfield their own link at dana@arch.test.')
    fireEvent.change(within(form).getByLabelText('A line of your own'), { target: { value: 'Rev 2 is up.' } })
    fireEvent.click(within(form).getByTestId('send-link-send'))
    expect(onSendLink).toHaveBeenCalledWith('p1', 'Rev 2 is up.')
    await waitFor(() => expect(screen.queryByTestId('send-link-form')).toBeNull())
  })

  it('a send that did not go keeps the form open', async () => {
    const onSendLink = vi.fn(() => Promise.resolve(false))
    mount({ onSendLink })
    fireEvent.click(screen.getByTestId('send-link-open'))
    fireEvent.click(screen.getByTestId('send-link-send'))
    await waitFor(() => expect(onSendLink).toHaveBeenCalledTimes(1))
    await waitFor(() => expect((screen.getByTestId('send-link-send') as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByTestId('send-link-form')).toBeTruthy()
  })

  it('once sent, the trail says when and the door reads Send it again', () => {
    const sent = { ...view, id: 'e2', person_id: 'p1', event_type: 'link_sent', occurred_at: '2026-10-09T15:00:00Z' } as unknown as SubmittalEventRow
    mount({ onSendLink: vi.fn(() => Promise.resolve(true)), events: [view, sent] })
    expect(screen.getByTestId('room-people').textContent).toContain('link sent Oct 9')
    expect(screen.getByTestId('send-link-open').textContent).toBe('Send it again')
  })

  it('no door without the tab’s handler, on a closed room or one never shared, for a closed link or a person with no address', () => {
    const onSendLink = vi.fn(() => Promise.resolve(true))
    const cases: Array<Partial<SubmittalRoomPanelProps>> = [
      {},
      { onSendLink, room: { ...room, status: 'closed' } as SubmittalRoomRow },
      { onSendLink, room: { ...room, shared_at: null } as unknown as SubmittalRoomRow },
      { onSendLink, people: [{ ...dana, closed_at: '2026-10-01T00:00:00Z' } as SubmittalPersonRow] },
      { onSendLink, people: [{ ...dana, email: '' } as SubmittalPersonRow] },
    ]
    for (const c of cases) {
      mount(c)
      expect(screen.queryByTestId('send-link-open')).toBeNull()
      cleanup()
    }
    mount({ onSendLink })
    expect(screen.getByTestId('send-link-open').textContent).toBe('Send the link')
  })
})

describe('SubmittalRoomPanel · v2.5051 the deciding / watching switch reads in both themes', () => {
  // The pressed watching segment was white on --text-strong, which is near-white in dark mode: a blank white box.
  const css = readFileSync('src/index.css', 'utf8')
  const block = (opener: string) => css.slice(css.indexOf(opener), css.indexOf('}', css.indexOf(opener)))
  const themes = { light: block("[data-theme='light'] {"), dark: block(":root[data-theme='dark'] {") }
  const hexOf = (theme: string, value: string) => {
    const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
    expect(name, `${value} is a theme token`).toBeTruthy()
    const hex = new RegExp(`\\s${name}:\\s*#([0-9a-f]{6});`, 'i').exec(theme)?.[1]
    expect(hex, `${name} is set in the theme`).toBeTruthy()
    return hex!
  }
  const channel = (hex: string, i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4)
  const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const pat = { ...dana, id: 'p2', name: 'Pat Ortega', email: 'pat@owner.test', role: 'owners_rep', may_decide: false } as SubmittalPersonRow
  const segment = (who: string, name: string) => within(screen.getByRole('group', { name: `${who} may` })).getByRole('button', { name })

  it('watching, pressed or not, is theme tokens that read in light and dark; deciding keeps its green', () => {
    mount({ people: [dana, pat] })
    const pressed = segment('Pat Ortega', 'watching')
    const unpressed = segment('Dana Whitfield', 'watching')
    expect([pressed.getAttribute('aria-pressed'), unpressed.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
    for (const [theme, vars] of Object.entries(themes)) {
      for (const b of [pressed, unpressed]) {
        const ratio = contrast(hexOf(vars, b.style.color), hexOf(vars, b.style.background))
        expect(ratio, `${theme} · ${b.style.color} on ${b.style.background}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    const deciding = segment('Dana Whitfield', 'deciding')
    expect([deciding.getAttribute('aria-pressed'), deciding.style.background, deciding.style.color]).toEqual(['true', 'rgb(22, 163, 74)', 'white'])
  })
})
