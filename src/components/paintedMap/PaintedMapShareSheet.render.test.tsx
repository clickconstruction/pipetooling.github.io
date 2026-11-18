// @vitest-environment jsdom
/**
 * Share a painted map (punch list #345, PR 4; re-laid by #394). There is no Make a link step: the
 * first press that sends makes the link, remembers it on the device and does its own work. One
 * press leads. What a reader sees and does not is one line, with the rest a press away. A link is
 * ended on a press that names the act.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PaintedMapLinkRow, PaintedMapVisitRow } from '../../lib/paintedMap/paintedMapLink'
import { PAINTED_MAP_SHARE_WORDS_MAX, paintedMapShareWordCount } from '../../lib/paintedMap/paintedMapShare'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('qrcode.react', () => ({ QRCodeSVG: (props: { value: string }) => <svg data-testid="qr" data-value={props.value} /> }))

const io = vi.hoisted(() => ({
  links: [] as PaintedMapLinkRow[],
  visits: [] as PaintedMapVisitRow[],
  remembered: null as { code: string; endsOn: string | null } | null,
  calls: [] as string[],
  refuse: null as string | null,
}))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({
  loadPaintedMapLinks: async () => ({ ok: true, value: io.links }),
  loadPaintedMapVisits: async () => ({ ok: true, value: io.visits }),
  mintPaintedMapLink: async (mapId: string) => {
    io.calls.push(`mint:${mapId}`)
    if (io.refuse) throw new Error(io.refuse)
    io.links = [{ id: 'link-1', made_at: '2026-11-13T16:00:00Z', expires_at: '2999-01-01T00:00:00Z', ended_at: null, open_count: 0 }, ...io.links]
    return { code: 'q7m2kd4x9p', endsOn: '2027-02-11' }
  },
  endPaintedMapLinks: async (mapId: string) => {
    io.calls.push(`end:${mapId}`)
    const open = io.links.filter((l) => !l.ended_at).length
    io.links = io.links.map((l) => ({ ...l, ended_at: '2026-11-14T00:00:00Z' }))
    return open
  },
  rememberPaintedMapLink: (_mapId: string, link: { code: string; endsOn: string | null } | null) => {
    io.calls.push(link ? 'remember' : 'forget')
    io.remembered = link
  },
  rememberedPaintedMapLink: () => io.remembered,
}))

import { PaintedMapShareSheet } from './PaintedMapShareSheet'

const OPEN: PaintedMapLinkRow = { id: 'link-0', made_at: '2026-11-10T16:00:00Z', expires_at: '2999-01-01T00:00:00Z', ended_at: null, open_count: 3 }
const ADDRESS = 'https://example.test/way/q7m2kd4x9p'
const TEXT_HREF = `sms:?&body=${encodeURIComponent(`Here is a map for you, The way in for deliveries. Open it here: ${ADDRESS}`)}`
/** The phone's Messages, stood in for: what it was handed, and whether the page was left for it. */
const phone = { hrefs: [] as string[], opens: true }
const sheet = (over: { phone?: boolean } = {}) =>
  render(
    <PaintedMapShareSheet
      mapId="m1"
      mapName="The way in for deliveries"
      origin="https://example.test"
      onClose={() => {}}
      phone={over.phone ?? true}
      openMessages={async (href) => {
        phone.hrefs.push(href)
        return phone.opens
      }}
    />,
  )
const clipboard = { text: '', refuses: false }
const held = () => {
  io.remembered = { code: 'q7m2kd4x9p', endsOn: '2027-02-11' }
  io.links = [OPEN]
}
/** Every word a reader meets on the sheet, counted as the kernel counts. */
const wordsOnSheet = (): number => {
  const walker = document.createTreeWalker(screen.getByRole('dialog', { name: 'Share this map' }), NodeFilter.SHOW_TEXT)
  const texts: string[] = []
  while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? '')
  return paintedMapShareWordCount(texts)
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: async (t: string) => {
        if (clipboard.refuses) throw new Error('NotAllowedError')
        clipboard.text = t
      },
    },
    configurable: true,
  })
})
afterEach(() => {
  cleanup()
  io.links = []
  io.visits = []
  io.remembered = null
  io.calls = []
  io.refuse = null
  clipboard.text = ''
  clipboard.refuses = false
  phone.hrefs = []
  phone.opens = true
  delete (navigator as unknown as { share?: unknown }).share
})

describe('PaintedMapShareSheet, before a link is out', () => {
  it('stands with one leading press, its tiles and one line about a reader, and makes nothing', async () => {
    sheet()
    expect(await screen.findByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show a code to scan' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy()
    expect(screen.getByText('Anyone with the link can open it. They give their name first.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Make a link' })).toBeNull()
    expect(document.querySelector('[data-painted-share-link]')).toBeNull()
    expect(io.calls).toEqual([])
  })

  it('stays under the count the card set, where the sheet once stood at 163 words', async () => {
    Object.defineProperty(navigator, 'share', { value: async () => {}, configurable: true })
    sheet()
    await screen.findByRole('button', { name: 'Send it another way…' })
    expect(wordsOnSheet()).toBeLessThanOrEqual(PAINTED_MAP_SHARE_WORDS_MAX)
    expect(wordsOnSheet()).toBe(36)
  })

  it('opens what a reader sees and does not, whole, on a press', async () => {
    sheet()
    expect(screen.queryByText('They do not see who painted it, when, or anything else about the job.')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'What they see' }))
    expect(screen.getByText('Anyone who has the link can open the map. No sign-in.')).toBeTruthy()
    expect(screen.getByText('They give their name first. We keep the name, the phone or computer and the time.')).toBeTruthy()
    expect(screen.getByText('They see the name, the lines, and the places with their words and photos.')).toBeTruthy()
    expect(screen.getByText('They do not see who painted it, when, or anything else about the job.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }))
    expect(screen.queryByText('They see the name, the lines, and the places with their words and photos.')).toBeNull()
  })

  it('leads with Copy the link at a desk, where there is no Messages to open, and draws it once', async () => {
    sheet({ phone: false })
    await screen.findByRole('button', { name: 'Copy the link' })
    expect(screen.queryByRole('button', { name: 'Text it from my phone…' })).toBeNull()
    expect(document.querySelectorAll('[data-painted-share-tile="copy"]')).toHaveLength(1)
  })
})

describe('PaintedMapShareSheet, Text it from my phone…', () => {
  it('makes the link on the press, remembers it, and opens Messages with the words written', async () => {
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    await waitFor(() => expect(phone.hrefs).toEqual([TEXT_HREF]))
    expect(io.calls).toEqual(['mint:m1', 'remember'])
    await waitFor(() => expect(document.querySelector('[data-painted-share-state]')?.textContent).toContain('One link is out, since Nov 13. Not opened yet.'))
    expect(screen.getByText('The link ends by itself on Feb 11.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens Messages at once, with no wait, when the link is already out', async () => {
    held()
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    await waitFor(() => expect(phone.hrefs).toEqual([TEXT_HREF]))
    expect(io.calls).toEqual([])
  })

  it('says the link is ready and offers Open Messages when the phone would not open it after the wait', async () => {
    phone.opens = false
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    expect((await screen.findByRole('status')).textContent).toBe('The link is ready. Press Open Messages.')
    phone.opens = true
    fireEvent.click(screen.getByRole('button', { name: 'Open Messages' }))
    await waitFor(() => expect(phone.hrefs).toEqual([TEXT_HREF, TEXT_HREF]))
    expect(io.calls.filter((c) => c.startsWith('mint'))).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('takes back that Messages would not open when the page is left after the wait: a slow phone did open it', async () => {
    held()
    phone.opens = false
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This phone would not open Messages. Copy the link and paste it into a text.')
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('takes back The link is ready the same way, and the press gets its own name again', async () => {
    phone.opens = false
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    await screen.findByRole('button', { name: 'Open Messages' })
    fireEvent(window, new Event('blur'))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open Messages' })).toBeNull()
  })

  it('leaves other words alone when the page is left, and says nothing new with no hand-off', async () => {
    io.refuse = 'Only whoever painted a map, or the office, may share it.'
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Show a code to scan' }))
    await screen.findByRole('alert')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('alert').textContent).toBe('Only whoever painted a map, or the office, may share it.')
  })

  it('gives the press its own name back once another way is pressed', async () => {
    phone.opens = false
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    await screen.findByRole('button', { name: 'Open Messages' })
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(clipboard.text).toBe(ADDRESS))
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into a text or an email.')
  })

  it('says to copy the link when the phone will not open Messages even with the link made', async () => {
    held()
    phone.opens = false
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Text it from my phone…' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This phone would not open Messages. Copy the link and paste it into a text.')
    expect(screen.queryByRole('button', { name: 'Open Messages' })).toBeNull()
  })
})

describe('PaintedMapShareSheet, the tiles', () => {
  it('copies the whole address, making the link first when none is out', async () => {
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(clipboard.text).toBe(ADDRESS))
    expect(io.calls).toEqual(['mint:m1', 'remember'])
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into a text or an email.')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('copies a link that is already out without making another', async () => {
    held()
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(clipboard.text).toBe(ADDRESS))
    expect(io.calls).toEqual([])
  })

  it('shows the link to press and hold when the browser will not copy', async () => {
    held()
    clipboard.refuses = true
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the link' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This browser would not copy the link. Press and hold the link to copy it.example.test/way/q7m2kd4x9p')
    expect(document.querySelector('[data-painted-share-link]')?.textContent).toBe('example.test/way/q7m2kd4x9p')
  })

  it('shows a code to scan alone on the sheet, and goes back on Hide the code', async () => {
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Show a code to scan' }))
    await waitFor(() => expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(ADDRESS))
    expect(io.calls).toEqual(['mint:m1', 'remember'])
    expect(screen.getByText('Point a phone’s camera here')).toBeTruthy()
    expect(document.querySelector('[data-painted-share-link]')?.textContent).toBe('example.test/way/q7m2kd4x9p')
    expect(screen.queryByRole('button', { name: 'Text it from my phone…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the code' }))
    expect(screen.queryByTestId('qr')).toBeNull()
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('hands the link to the phone\'s own share sheet where there is one', async () => {
    const shared: unknown[] = []
    Object.defineProperty(navigator, 'share', { value: async (data: unknown) => void shared.push(data), configurable: true })
    held()
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Send it another way…' }))
    await waitFor(() => expect(shared).toEqual([{ title: 'The way in for deliveries', text: 'The way in for deliveries', url: ADDRESS }]))
  })

  it('says the link is ready when the phone refused its share sheet after the wait, and nothing when the person backed out', async () => {
    let name = 'NotAllowedError'
    Object.defineProperty(navigator, 'share', { value: async () => Promise.reject(Object.assign(new Error('refused'), { name })), configurable: true })
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Send it another way…' }))
    expect((await screen.findByRole('status')).textContent).toBe('The link is ready. Press Send it another way… again.')
    name = 'AbortError'
    fireEvent.click(screen.getByRole('button', { name: 'Send it another way…' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers no share press on a browser that has none', async () => {
    held()
    sheet()
    await screen.findByRole('button', { name: 'Copy the link' })
    expect(screen.queryByRole('button', { name: 'Send it another way…' })).toBeNull()
  })

  it('says why a link was not made, on whichever press asked for it', async () => {
    io.refuse = 'Only whoever painted a map, or the office, may share it.'
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Show a code to scan' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only whoever painted a map, or the office, may share it.')
    expect(screen.queryByTestId('qr')).toBeNull()
    expect(phone.hrefs).toEqual([])
  })
})

describe('PaintedMapShareSheet, a link that is out', () => {
  it('says a link made elsewhere is out, with no step to take, and the first press here makes this device its own', async () => {
    io.links = [OPEN]
    sheet()
    await waitFor(() => expect(document.querySelector('[data-painted-share-state]')?.textContent).toContain('One link is out, since Nov 10. Opened 3 times.'))
    expect(screen.queryByText(/A link can be read only on the device that made it/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(clipboard.text).toBe(ADDRESS))
    expect(io.calls).toEqual(['mint:m1', 'remember'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'End all 2 links now' })).toBeTruthy())
  })

  it('forgets a remembered link once every link of the map was ended elsewhere', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: null }
    io.links = [{ ...OPEN, ended_at: '2026-11-12T00:00:00Z' }]
    sheet()
    await waitFor(() => expect(io.calls).toContain('forget'))
    expect(document.querySelector('[data-painted-share-state]')).toBeNull()
  })

  it('ends a link only after a confirm that names the act, then says what a reader will read', async () => {
    held()
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'End this link now' }))
    expect(io.calls).not.toContain('end:m1')
    fireEvent.click(screen.getByRole('button', { name: 'End the link' }))
    await waitFor(() => expect(io.calls).toContain('end:m1'))
    expect(await screen.findByText('The link is ended. Anyone who opens it now reads that the map is no longer shared.')).toBeTruthy()
    expect(io.calls).toContain('forget')
    await waitFor(() => expect(document.querySelector('[data-painted-share-state]')).toBeNull())
    expect(screen.getByRole('button', { name: 'Text it from my phone…' })).toBeTruthy()
  })

  it('lists who opened the link for whoever may read that', async () => {
    io.links = [OPEN]
    io.visits = [
      { id: 'v1', visitor_name: 'Dana Reyes', user_id: null, device_words: 'iPhone · Safari', last_opened_at: '2026-11-15T21:02:00Z', open_count: 2, first_lat: 30.35, first_lng: -97.75, first_located_at: '2026-11-15T21:03:00Z', last_lat: null, last_lng: null, last_located_at: null },
      { id: 'v2', visitor_name: 'Marcus Bell', user_id: 'u1', device_words: 'Mac · Chrome', last_opened_at: '2026-11-15T20:00:00Z', open_count: 1, first_lat: null, first_lng: null, first_located_at: null, last_lat: null, last_lng: null, last_located_at: null },
    ]
    sheet()
    await waitFor(() => expect(document.querySelectorAll('[data-painted-share-visit]')).toHaveLength(2))
    const rows = [...document.querySelectorAll('[data-painted-share-visit]')].map((r) => r.textContent ?? '')
    expect(rows[0]).toMatch(/^Dana ReyesiPhone · Safari · opened .+ · 2 timesShowed where they were, .+\. See that place$/)
    expect(rows[1]).toMatch(/^Marcus Bell · signed inMac · Chrome · opened /)
    expect((screen.getByRole('link', { name: 'See that place' }) as HTMLAnchorElement).href).toBe('https://www.google.com/maps/search/?api=1&query=30.350000,-97.750000')
  })

  it('says nothing about who opened it to a reader the list is not for', async () => {
    io.links = [OPEN]
    io.visits = []
    sheet()
    await screen.findByText(/One link is out/)
    expect(document.querySelector('[data-painted-share-visits]')).toBeNull()
  })
})
