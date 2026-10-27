// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OfficeRating } from '../../lib/ratings/ratingsOffice'
import type { RatingsOfficeIo } from '../../lib/ratings/ratingsOfficeIo'
import { SettingsReviewsBlock } from './SettingsReviewsBlock'

const auth = vi.hoisted(() => ({ role: 'dev' as string }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: auth.role }), useOptionalAuth: () => makeUseAuthValue({ role: auth.role }) }
})

const now = Date.now()
const iso = (daysAgo: number) => new Date(now - daysAgo * 24 * 3600 * 1000).toISOString()
const row = (p: Partial<OfficeRating>): OfficeRating => ({
  id: 'r',
  contactId: 'c-dana',
  jobId: 'job-1312',
  customerName: 'Dana Whitfield',
  askedAt: iso(0),
  openedAt: null,
  answeredAt: iso(0),
  score: 5,
  words: 'Luis was great.',
  googlePressedAt: iso(0),
  calledAt: null,
  callNote: '',
  ...p,
})

function ioWith(link: string, rows: OfficeRating[]): RatingsOfficeIo & { saveGoogleLink: ReturnType<typeof vi.fn> } {
  return {
    forJob: vi.fn(async () => []),
    lowOwed: vi.fn(async () => []),
    recent: vi.fn(async () => rows),
    jobWord: vi.fn(async () => null),
    recordCall: vi.fn(async () => undefined),
    googleLink: vi.fn(async () => link),
    saveGoogleLink: vi.fn(async (_v: string) => undefined),
  }
}

afterEach(() => {
  cleanup()
  auth.role = 'dev'
})

describe('SettingsReviewsBlock (v2.5946, punch list #185)', () => {
  it('a dev sets the Google link: a bad one says why, a good one saves', async () => {
    const io = ioWith('', [row({ id: 'a' }), row({ id: 'b', customerName: 'Tom Reyes', contactId: 'c-tom', score: 2, words: 'Late twice.', googlePressedAt: null })])
    render(<SettingsReviewsBlock io={io} />)
    const field = (await screen.findByLabelText('The company’s Google review link')) as HTMLInputElement
    fireEvent.change(field, { target: { value: 'g.page/r/abc' } })
    expect(screen.getByText(/starts with https/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save the link' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: 'https://g.page/r/abc/review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the link' }))
    await waitFor(() => expect(io.saveGoogleLink).toHaveBeenCalledWith('https://g.page/r/abc/review'))
    expect(await screen.findByText('Saved. The review page uses it now.')).toBeTruthy()
  })

  it('counts the month and lists the newest answers, each opening its thread', async () => {
    render(<SettingsReviewsBlock io={ioWith('https://g.page/r/abc/review', [row({ id: 'a' }), row({ id: 'b', customerName: 'Tom Reyes', contactId: 'c-tom', score: 2, words: 'Late twice.', googlePressedAt: null })])} />)
    expect(await screen.findByText('average stars')).toBeTruthy()
    expect(screen.getByText('3.5')).toBeTruthy()
    expect(screen.getByText('0 of 1')).toBeTruthy()
    const tom = screen.getByRole('link', { name: 'Tom Reyes' })
    expect(tom.getAttribute('href')).toBe('/messages?thread=c-tom')
    expect(screen.getByText('“Late twice.”')).toBeTruthy()
  })

  it('an assistant reads the link and cannot change it', async () => {
    auth.role = 'assistant'
    render(<SettingsReviewsBlock io={ioWith('https://g.page/r/abc/review', [])} />)
    expect(await screen.findByText('Only the owner or a dev changes the link.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save the link' })).toBeNull()
    expect(await screen.findByText('No answers yet this month.')).toBeTruthy()
  })
})
