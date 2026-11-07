// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ThreadLine } from './ThreadLine'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { ThreadMessage } from '../../../lib/messages/thread'

const PLANS = 'https://maxxbuilders.box.example/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3'
const email: ThreadMessage = {
  id: 'm-glenn-invite',
  contactId: 'c-glenn',
  jobId: null,
  channel: 'email',
  direction: 'in',
  at: '2026-10-22T15:08:00.000Z',
  who: 'Glenn Geling <glenn@maxxbuilders.example> to bids@',
  subject: 'Northeast Bible Church Elementary Building @ San Antonio - Invitation to Bid',
  body: `Wendi,\n\nWe at *Maxx Builders* invite you to bid.\n\n*Link to Plans*:\n**${PLANS}\n<${PLANS}>*\nDeadline: *Monday, November 02, 2026, 3:00 PM*`,
}

describe('ThreadLine: a web address in the words is one press (v2.6508)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('draws the address once as a link that opens in a new tab, and the sender’s bold as bold', () => {
    renderWithProviders(<ThreadLine message={email} tile={undefined} job="none" showAll marked={false} tying={null} onOpen={vi.fn()} onTie={vi.fn()} onJob={vi.fn()} />)
    const line = document.querySelector('[data-thread-line="m-glenn-invite"]') as HTMLElement
    const links = [...line.querySelectorAll('a[data-body-link]')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([PLANS])
    expect(links[0]!.getAttribute('target')).toBe('_blank')
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer')
    expect(links[0]!.querySelector('svg')).toBeTruthy()
    // The first strong is the meta row's channel word; the rest are the sender's marks.
    expect([...line.querySelectorAll('strong')].slice(1).map((b) => b.textContent)).toEqual(['Maxx Builders', 'Link to Plans', PLANS, 'Monday, November 02, 2026, 3:00 PM'])
    expect(line.textContent).not.toContain('*')
    expect(line.textContent!.match(/https:/g)?.length).toBe(1)
  })

  it('lets the link’s press through without opening the message, while a press on the words still opens it', () => {
    const onOpen = vi.fn()
    // jsdom cannot follow a link; the press is still the link's own, so the line must not take it as its own.
    const stop = (e: Event) => e.preventDefault()
    document.addEventListener('click', stop)
    renderWithProviders(<ThreadLine message={email} tile={undefined} job="none" showAll marked={false} tying={null} onOpen={onOpen} onTie={vi.fn()} onJob={vi.fn()} />)
    fireEvent.click(screen.getByRole('link', { name: PLANS }))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-thread-line="m-glenn-invite"] strong') as HTMLElement)
    expect(onOpen).toHaveBeenCalledTimes(1)
    document.removeEventListener('click', stop)
  })
})

describe('ThreadLine: the bio line wears a small bio mark (v2.6659, punch list #282)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const bio: ThreadMessage = {
    id: 'm-luis-bio',
    contactId: 'c-dana',
    jobId: 'j-1',
    channel: 'text',
    direction: 'out',
    at: '2026-11-07T16:41:30.000Z',
    who: 'Luis',
    body: 'A little about Luis: he has been a plumber for twelve years and holds a Texas journeyman license.',
    introducesUserId: 'u-luis',
  }

  it('draws the mark beside who, with the tech named on hover', () => {
    renderWithProviders(<ThreadLine message={bio} tile={undefined} job="none" showAll marked={false} tying={null} userNames={{ 'u-luis': 'Luis' }} onOpen={vi.fn()} onTie={vi.fn()} onJob={vi.fn()} />)
    const mark = document.querySelector('[data-thread-line="m-luis-bio"] [data-thread-bio="u-luis"]') as HTMLElement
    expect(mark.textContent).toBe('bio')
    expect(mark.getAttribute('title')).toContain("Luis's bio, as the office wrote it")
  })

  it('draws no mark on the On my way line before it', () => {
    renderWithProviders(<ThreadLine message={{ ...bio, id: 'm-luis-line', body: 'Dana, this is Luis with Click Plumbing. I am on my way, about 20 minutes out.', introducesUserId: null }} tile={undefined} job="none" showAll marked={false} tying={null} onOpen={vi.fn()} onTie={vi.fn()} onJob={vi.fn()} />)
    expect(document.querySelector('[data-thread-bio]')).toBeNull()
  })
})
