// @vitest-environment jsdom
/**
 * Share a painted map (punch list #345, PR 4). A link is made on a press, shown once, remembered on
 * the device that made it, and ended on a press that names the act. The sheet says what a reader
 * sees and does not before the link goes anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PaintedMapLinkRow } from '../../lib/paintedMap/paintedMapLink'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('qrcode.react', () => ({ QRCodeSVG: (props: { value: string }) => <svg data-testid="qr" data-value={props.value} /> }))

const io = vi.hoisted(() => ({
  links: [] as PaintedMapLinkRow[],
  remembered: null as { code: string; endsOn: string | null } | null,
  calls: [] as string[],
  refuse: null as string | null,
}))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({
  loadPaintedMapLinks: async () => ({ ok: true, value: io.links }),
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
const sheet = (onClose = () => {}) => render(<PaintedMapShareSheet mapId="m1" mapName="The way in for deliveries" origin="https://example.test" onClose={onClose} />)
const clipboard = { text: '' }

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void (clipboard.text = t) }, configurable: true })
})
afterEach(() => {
  cleanup()
  io.links = []
  io.remembered = null
  io.calls = []
  io.refuse = null
  clipboard.text = ''
  delete (navigator as unknown as { share?: unknown }).share
})

describe('PaintedMapShareSheet', () => {
  it('says what a reader sees and does not, before any link exists', async () => {
    sheet()
    expect(screen.getByText('Anyone who has the link can open the map. No sign-in.')).toBeTruthy()
    expect(screen.getByText('They see the name, the lines, and the places with their words and photos.')).toBeTruthy()
    expect(screen.getByText('They do not see who painted it, when, or anything else about the job.')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Make a link' })).toBeTruthy()
    expect(document.querySelector('[data-painted-share-link]')).toBeNull()
    expect(io.calls).toEqual([])
  })

  it('makes a link on a press, shows it, remembers it on this device and says when it ends', async () => {
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Make a link' }))
    await waitFor(() => expect(document.querySelector('[data-painted-share-link]')?.textContent).toBe('example.test/way/q7m2kd4x9p'))
    expect(io.calls).toEqual(['mint:m1', 'remember'])
    expect(screen.getByText('The link ends by itself on Feb 11.')).toBeTruthy()
    expect(document.querySelector('[data-painted-share-state]')?.textContent).toContain('One link is out, since Nov 13. Not opened yet.')
  })

  it('copies the whole address', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: '2027-02-11' }
    io.links = [OPEN]
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(clipboard.text).toBe('https://example.test/way/q7m2kd4x9p'))
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into a text or an email.')
  })

  it('shows a code to scan that opens the same address', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: '2027-02-11' }
    io.links = [OPEN]
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: /Show a code to scan/ }))
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe('https://example.test/way/q7m2kd4x9p')
    expect(screen.getByText('Point a phone’s camera here')).toBeTruthy()
  })

  it('hands the link to the phone\'s own share sheet where there is one', async () => {
    const shared: unknown[] = []
    Object.defineProperty(navigator, 'share', { value: async (data: unknown) => void shared.push(data), configurable: true })
    io.remembered = { code: 'q7m2kd4x9p', endsOn: null }
    io.links = [OPEN]
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: /Send it another way/ }))
    await waitFor(() => expect(shared).toEqual([{ title: 'The way in for deliveries', text: 'The way in for deliveries', url: 'https://example.test/way/q7m2kd4x9p' }]))
  })

  it('offers no share press on a browser that has none', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: null }
    io.links = [OPEN]
    sheet()
    await screen.findByRole('button', { name: 'Copy the link' })
    expect(screen.queryByRole('button', { name: /Send it another way/ })).toBeNull()
  })

  it('says a link made elsewhere cannot be read here, and makes one of its own', async () => {
    io.links = [OPEN]
    sheet()
    expect(await screen.findByText(/This map already has a link out\. A link can be read only on the device that made it/)).toBeTruthy()
    expect(document.querySelector('[data-painted-share-state]')?.textContent).toContain('Opened 3 times.')
    expect(screen.getByRole('button', { name: 'Make a link' })).toBeTruthy()
  })

  it('forgets a remembered link once every link of the map was ended elsewhere', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: null }
    io.links = [{ ...OPEN, ended_at: '2026-11-12T00:00:00Z' }]
    sheet()
    await screen.findByRole('button', { name: 'Make a link' })
    expect(io.calls).toContain('forget')
    expect(document.querySelector('[data-painted-share-link]')).toBeNull()
  })

  it('ends a link only after a confirm that names the act, then says what a reader will read', async () => {
    io.remembered = { code: 'q7m2kd4x9p', endsOn: null }
    io.links = [OPEN]
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'End this link now' }))
    expect(io.calls).not.toContain('end:m1')
    fireEvent.click(screen.getByRole('button', { name: 'End the link' }))
    await waitFor(() => expect(io.calls).toContain('end:m1'))
    expect(await screen.findByText('The link is ended. Anyone who opens it now reads that the map is no longer shared.')).toBeTruthy()
    expect(io.calls).toContain('forget')
    expect(screen.getByRole('button', { name: 'Make a link' })).toBeTruthy()
  })

  it('says why a link was not made', async () => {
    io.refuse = 'Only whoever painted a map, or the office, may share it.'
    sheet()
    fireEvent.click(await screen.findByRole('button', { name: 'Make a link' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only whoever painted a map, or the office, may share it.')
    expect(document.querySelector('[data-painted-share-link]')).toBeNull()
  })
})
