// @vitest-environment jsdom
/**
 * The Saved band (punch list #392, step 3): it says the save landed, and its one blue press makes
 * the link and opens the phone's Messages, with a second press when the phone will not. On the
 * server's yes the phone picks the link's code and Messages is opened inside the press (#394). A
 * page left after the band stopped waiting takes back what the band said. Every map and link code
 * here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({ canMakePaintedMapLink: vi.fn(), loadPaintedMapLinks: vi.fn(), pickPaintedMapLinkCode: vi.fn(), registerPaintedMapLink: vi.fn(), rememberPaintedMapLink: vi.fn(), rememberedPaintedMapLink: vi.fn(() => null) }))

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

/** The band's doors. The server says no to the question unless a case says yes, so a case is on the waiting path by default. */
function makeIo(over: Partial<PaintedMapSavedBandIo> & { kept?: { code: string; endsOn: string | null } | null } = {}) {
  let kept = over.kept ?? null
  const hrefs: string[] = []
  /** What happened, in order: the ask for the link must leave before the phone is handed its text. */
  const order: string[] = []
  const left: Array<() => void> = []
  const io: PaintedMapSavedBandIo = {
    remembered: () => kept,
    remember: vi.fn((_id, link) => {
      kept = link
    }),
    can: vi.fn(async () => false),
    pickCode: vi.fn(() => 'k7m2x9qd4t'),
    register: vi.fn(async (_id: string, code: string) => {
      order.push('register')
      return { code, endsOn: '2027-02-16' }
    }),
    loadLinks: vi.fn(async () => ({ ok: true as const, value: [] as PaintedMapLinkRow[] })),
    openMessages: vi.fn(async (href: string) => {
      order.push('messages')
      hrefs.push(href)
      return true
    }),
    onPageLeft: (listener) => {
      left.push(listener)
      return () => {
        left.splice(left.indexOf(listener), 1)
      }
    },
    ...over,
  }
  /** The phone leaves the page for another app. */
  const leavePage = () => act(() => left.forEach((l) => l()))
  return { io, hrefs, order, leavePage }
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
    expect(io.register).toHaveBeenCalledWith('m1', 'k7m2x9qd4t')
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
    expect(io.register).toHaveBeenCalledTimes(1)
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
    expect(io.register).not.toHaveBeenCalled()
    expect(decodeURIComponent(hrefs[0]!)).toContain('https://app.test/way/aaaaaaaaaa')
  })

  it('a link this phone holds that was ended elsewhere is not sent: a new one is made', async () => {
    const { io, hrefs } = makeIo({ kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [endedLink] })) })
    render(band(io))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
    await settle()
    expect(io.register).toHaveBeenCalledTimes(1)
    expect(decodeURIComponent(hrefs[0]!)).toContain('https://app.test/way/k7m2x9qd4t')
  })

  it('says why when the link was not made, and opens nothing', async () => {
    const { io } = makeIo({ register: vi.fn(async () => Promise.reject({ message: 'No signal.' })) })
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

  describe('on the server’s yes, the phone picks the code', () => {
    /** A fresh yes for each band, so one case's ask is never counted in another's. */
    const yes = () => ({ can: vi.fn(async () => true) })

    it('asks once on showing, and not where the press is not offered', async () => {
      const a = makeIo(yes())
      render(band(a.io))
      await settle()
      expect(a.io.can).toHaveBeenCalledTimes(1)
      expect(a.io.can).toHaveBeenCalledWith('m1')
      cleanup()
      const b = makeIo(yes())
      render(band(b.io, false))
      await settle()
      expect(b.io.can).not.toHaveBeenCalled()
    })

    it('hands the phone its text inside the press, before the link is back, with the ask for the link already gone', async () => {
      let land: (link: { code: string; endsOn: string | null }) => void = () => undefined
      const { io, hrefs, order } = makeIo(yes())
      const held = vi.fn((_id: string, _code: string) => {
        order.push('register')
        return new Promise<{ code: string; endsOn: string | null }>((resolve) => {
          land = resolve
        })
      })
      io.register = held
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      // Nothing has come back from the server, and Messages already has the words and the address.
      expect(order).toEqual(['register', 'messages'])
      expect(decodeURIComponent(hrefs[0]!)).toContain('Here is a map for you, The way in. Open it here: https://app.test/way/k7m2x9qd4t')
      await act(async () => {
        land({ code: 'k7m2x9qd4t', endsOn: '2027-02-16' })
      })
      await settle()
      expect(io.remember).toHaveBeenCalledWith('m1', { code: 'k7m2x9qd4t', endsOn: '2027-02-16' })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(document.querySelector('[data-painted-saved-said]')).toBeNull()
      expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    })

    it('says not to send the text when the link in it was refused', async () => {
      const { io } = makeIo({ ...yes(), register: vi.fn(async () => Promise.reject({ message: 'This map has 20 links out. End one first.' })) })
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      expect(io.openMessages).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('alert').textContent).toBe('This map has 20 links out. End one first. The link in that text will not open. Do not send it.')
      expect(io.remember).not.toHaveBeenCalled()
    })

    it('says not to send the text when the link came back under another code', async () => {
      const { io } = makeIo({ ...yes(), register: vi.fn(async () => ({ code: 'zzzzzzzzzz', endsOn: null })) })
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      expect(screen.getByRole('alert').textContent).toBe('The link in that text will not open. Do not send it.')
      // The link that was made is still the one this phone keeps: the next press texts it.
      expect(io.remember).toHaveBeenCalledWith('m1', { code: 'zzzzzzzzzz', endsOn: null })
    })

    it('a link this phone holds is texted as it is, with no question to wait for', async () => {
      const { io, hrefs } = makeIo({ ...yes(), kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [openLink] })) })
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      expect(io.register).not.toHaveBeenCalled()
      expect(decodeURIComponent(hrefs[0]!)).toContain('https://app.test/way/aaaaaaaaaa')
    })
  })

  describe('a page left after the band stopped waiting', () => {
    it('takes back The link is ready, and the press goes back to its own name', async () => {
      const { io, leavePage } = makeIo({ openMessages: vi.fn(async () => false) })
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      expect(document.querySelector('[data-painted-saved-said]')?.textContent).toBe('The link is ready. Press Open Messages.')
      expect(screen.getByRole('button', { name: 'Open Messages' })).toBeTruthy()
      // The phone was slow to switch: Messages did open.
      leavePage()
      expect(document.querySelector('[data-painted-saved-said]')).toBeNull()
      expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    })

    it('takes back that the phone would not open Messages', async () => {
      const { io, leavePage } = makeIo({ kept: { code: 'aaaaaaaaaa', endsOn: null }, loadLinks: vi.fn(async () => ({ ok: true as const, value: [openLink] })), openMessages: vi.fn(async () => false) })
      render(band(io))
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      expect(screen.getByRole('alert').textContent).toBe('This phone would not open Messages. Copy the link and paste it into a text.')
      leavePage()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('keeps a reason that is not about Messages, and says nothing new when no press came first', async () => {
      const { io, leavePage } = makeIo({ register: vi.fn(async () => Promise.reject({ message: 'No signal.' })) })
      render(band(io))
      await settle()
      leavePage()
      expect(screen.queryByRole('alert')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
      await settle()
      leavePage()
      expect(screen.getByRole('alert').textContent).toContain('No signal.')
    })

    it('leaves the words alone when the page is left long after the press', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        const { io, leavePage } = makeIo({ openMessages: vi.fn(async () => false) })
        render(band(io))
        await settle()
        fireEvent.click(screen.getByRole('button', { name: 'Text it from my phone…' }))
        await settle()
        vi.setSystemTime(Date.now() + 61_000)
        leavePage()
        expect(document.querySelector('[data-painted-saved-said]')?.textContent).toBe('The link is ready. Press Open Messages.')
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
