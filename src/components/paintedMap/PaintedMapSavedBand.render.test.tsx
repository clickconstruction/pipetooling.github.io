// @vitest-environment jsdom
/**
 * The Saved band (punch list #392, step 3): it says the save landed, and its one blue press makes
 * the link and opens the phone's Messages, with a second press when the phone will not. Every map
 * and link code here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({ loadPaintedMapLinks: vi.fn(), mintPaintedMapLink: vi.fn(), rememberPaintedMapLink: vi.fn(), rememberedPaintedMapLink: vi.fn(() => null), canMakePaintedMapLink: vi.fn(async () => false), pickPaintedMapLinkCode: vi.fn(() => 'pppppppppp'), registerPaintedMapLink: vi.fn() }))

import type { PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'
import { PaintedMapSavedBand, type PaintedMapSavedBandIo } from './PaintedMapSavedBand'

afterEach(cleanup)

const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const openLink: PaintedMapLinkRow = { id: 'l1', made_at: '2026-11-18T15:00:00Z', expires_at: '2099-01-01T00:00:00Z', ended_at: null, open_count: 0 }
const endedLink: PaintedMapLinkRow = { ...openLink, ended_at: '2026-11-18T16:00:00Z' }

function makeIo(over: Partial<PaintedMapSavedBandIo> & { kept?: { code: string; endsOn: string | null } | null } = {}) {
  let kept = over.kept ?? null
  const hrefs: string[] = []
  /** What the band asked to hear when the page is left. A test calls it to leave the page. */
  const left: Array<() => void> = []
  const io: PaintedMapSavedBandIo = {
    remembered: () => kept,
    remember: vi.fn((_id, link) => {
      kept = link
    }),
    mint: vi.fn(async () => ({ code: 'k7m2x9qd4t', endsOn: '2027-02-16' })),
    loadLinks: vi.fn(async () => ({ ok: true as const, value: [] as PaintedMapLinkRow[] })),
    openMessages: vi.fn(async (href: string) => {
      hrefs.push(href)
      return true
    }),
    // The server from before the question: the band makes the link first, as it always did.
    canMake: vi.fn(async () => false),
    pick: vi.fn(() => 'p1ckedc0de'),
    register: vi.fn(async (_id: string, code: string) => ({ code, endsOn: '2027-02-16' })),
    onPageLeft: (listener) => {
      left.push(listener)
      return () => {}
    },
    ...over,
  }
  return { io, hrefs, leavePage: () => left.forEach((l) => l()) }
}

const band = (io: PaintedMapSavedBandIo, offersText = true) => <PaintedMapSavedBand mapId="m1" mapName="The way in" head="Saved on J2417 · Cedar Hollow 12" under="About 640 ft · 2 places. Anyone on the job can open it." offersText={offersText} origin="https://app.test" io={io} />

describe('PaintedMapSavedBand', () => {
  it('says the save landed, where, and who can open it', () => {
    const { io } = makeIo()
    render(band(io, false))
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('✓ Saved on J2417 · Cedar Hollow 12')
    expect(status.textContent).toContain('Anyone on the job can open it.')
    // No text press where it is not offered: a desk, or a map that is not the reader's to share.
    expect(document.querySelector('[data-painted-saved-text]')).toBeNull()
    expect(io.loadLinks).not.toHaveBeenCalled()
  })

  it('one press makes the link and opens Messages with the words written', async () => {
    const { io, hrefs } = makeIo()
    render(band(io))
    const press = screen.getByRole('button', { name: 'Text it from my phone…' })
    fireEvent.click(press)
    await settle()
    expect(io.mint).toHaveBeenCalledWith('m1')
    expect(io.remember).toHaveBeenCalledWith('m1', { code: 'k7m2x9qd4t', endsOn: '2027-02-16' })
    expect(hrefs).toHaveLength(1)
    expect(hrefs[0]!.startsWith('sms:')).toBe(true)
    expect(decodeURIComponent(hrefs[0]!)).toContain('Here is a map for you, The way in. Open it here: https://app.test/way/k7m2x9qd4t')
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(document.querySelector('[data-painted-saved-said]')).toBeNull()
  })

  it('a phone that will not open Messages after the wait gets a second press that works at once', async () => {
    let n = 0
    const { io } = makeIo({ openMessages: vi.fn(async () => ++n > 1) })
    render(band(io))
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(document.querySelector('[data-painted-saved-said]')?.textContent).toBe('The link is ready. Press Open Messages.')
    fireEvent.click(screen.getByRole('button', { name: 'Open Messages' }))
    await settle()
    // The link was made once: the second press only opens Messages.
    expect(io.mint).toHaveBeenCalledTimes(1)
    expect(io.openMessages).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('a link this phone already holds is sent with no new one made', async () => {
    const { io, hrefs } = makeIo({ kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [openLink] })) })
    render(band(io))
    await settle()
    expect(io.loadLinks).toHaveBeenCalledWith('m1')
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(io.mint).not.toHaveBeenCalled()
    expect(decodeURIComponent(hrefs[0]!)).toContain('https://app.test/way/aaaaaaaaaa')
  })

  it('a link this phone holds that was ended elsewhere is not sent: a new one is made', async () => {
    const { io, hrefs } = makeIo({ kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [endedLink] })) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(io.mint).toHaveBeenCalledTimes(1)
    expect(decodeURIComponent(hrefs[0]!)).toContain('https://app.test/way/k7m2x9qd4t')
  })

  it('says why when the link was not made, and opens nothing', async () => {
    const { io } = makeIo({ mint: vi.fn(async () => Promise.reject({ message: 'No signal.' })) })
    render(band(io))
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('No signal.')
    expect(io.openMessages).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('a phone that will not open Messages even with the link in hand says to copy it', async () => {
    const { io } = makeIo({ kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [openLink] })), openMessages: vi.fn(async () => false) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('This phone would not open Messages. Copy the link and paste it into a text.')
  })

  it('with the server\'s word, hands the phone the text inside the press, before the link is back (punch list #394, step 3)', async () => {
    let land: (v: { code: string; endsOn: string | null }) => void = () => {}
    const { io, hrefs } = makeIo({ canMake: vi.fn(async () => true), register: vi.fn(() => new Promise<{ code: string; endsOn: string | null }>((resolve) => (land = resolve))) })
    render(band(io))
    await settle()
    expect(document.querySelector('[data-painted-saved-text]')?.getAttribute('data-painted-saved-at-once')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    // The phone has the address already, with the code this phone picked. The server has not answered yet.
    expect(io.register).toHaveBeenCalledWith('m1', 'p1ckedc0de')
    expect(hrefs).toHaveLength(1)
    expect(decodeURIComponent(hrefs[0]!)).toContain('Open it here: https://app.test/way/p1ckedc0de')
    expect(io.mint).not.toHaveBeenCalled()
    await act(async () => land({ code: 'p1ckedc0de', endsOn: '2027-02-16' }))
    await settle()
    expect(io.remember).toHaveBeenCalledWith('m1', { code: 'p1ckedc0de', endsOn: '2027-02-16' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('says not to send the text when the link in it was refused', async () => {
    const { io } = makeIo({ canMake: vi.fn(async () => true), register: vi.fn(async () => Promise.reject({ message: 'No signal. Check the connection and try again.' })) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('No signal. Check the connection and try again. The link in that text will not open. Do not send it.')
    expect(io.remember).not.toHaveBeenCalled()
  })

  it('says not to send the text when the server made the link under another code', async () => {
    const { io } = makeIo({ canMake: vi.fn(async () => true), register: vi.fn(async () => ({ code: 'an0therc0de', endsOn: null })) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('The link in that text will not open. Do not send it.')
  })

  it('takes back The link is ready once the page is left: Messages did open, only later than the wait', async () => {
    const { io, leavePage } = makeIo({ openMessages: vi.fn(async () => false) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(document.querySelector('[data-painted-saved-said]')?.textContent).toBe('The link is ready. Press Open Messages.')
    expect(screen.getByRole('button', { name: 'Open Messages' })).toBeTruthy()
    act(() => leavePage())
    expect(document.querySelector('[data-painted-saved-said]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('takes back This phone would not open Messages the same way, and leaves another reason alone', async () => {
    const { io, leavePage } = makeIo({ canMake: vi.fn(async () => true), openMessages: vi.fn(async () => false) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('This phone would not open Messages. Copy the link and paste it into a text.')
    act(() => leavePage())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a page left with no hand-off before it changes nothing the band says', async () => {
    const { io, leavePage } = makeIo({ mint: vi.fn(async () => Promise.reject({ message: 'No signal.' })) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    act(() => leavePage())
    expect(screen.getByRole('alert').textContent).toContain('No signal.')
  })
})
