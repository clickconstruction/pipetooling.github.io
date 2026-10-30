// @vitest-environment jsdom
/**
 * Punch list #217, outside-13 (a prototype): the trade's moved dates on its own schedule row. Without the flag the
 * page reads as today, the *Your dates moved* block under the bars; with `?shape=1` the move draws on the trade's own
 * row — a ghost of its old days behind the bar, the reason as a chip, the two answers under it — and the block is gone;
 * with `?sbs=1` on the sample both looks draw one above the other. A sample answer from a function without the moves
 * by line gets the fixture's; a real one keeps the block.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, gcTradePortalSampleSchedules, gcTradePortalSampleScheduleWork, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { ScheduleWork } from '../../supabase/functions/_shared/gcTradePortalSchedule'
import { pDate } from '../lib/gc/portalI18n'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const posts: Record<string, unknown>[] = []
let sample = false
let withMoves = true

const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10)
}
const d = (n: number) => addDays(TODAY, n)
/** The answer of a function deployed before the moves by line. */
const wordsOnly = (work: Record<string, ScheduleWork>): Record<string, ScheduleWork> =>
  Object.fromEntries(Object.entries(work).map(([k, w]) => [k, { ...w, dates: w.dates.map(({ moves: _m, reason: _r, note: _n, ...rest }) => rest) }]))

beforeEach(() => {
  posts.length = 0
  sample = false
  withMoves = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: true, json: async () => ({ ok: true }) }
      }
      const work = gcTradePortalSampleScheduleWork(TODAY).scheduleWork
      return {
        ok: true,
        json: async () => ({ today: TODAY, slice: gcTradePortalSample(TODAY), schedules: gcTradePortalSampleSchedules(TODAY), scheduleWork: withMoves ? work : wordsOnly(work), scheduleTodos: [], ...(sample ? { sample: true } : {}) }),
      }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )
const openJob = async (query = '') => {
  open(`/t/${TOKEN}${query}`)
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return screen.findAllByRole('region', { name: 'Your schedule on this job' })
}
const ghost = () => document.querySelector(`[data-portal-ghost="${ID.jobLine2}"]`)
const row = () => document.querySelector(`[data-portal-moved="${ID.jobLine2}"]`) as HTMLElement | null
const WAS = `was ${pDate('en', d(9))} – ${pDate('en', d(15))}`
const CHIP = 'moved 3 days later · weather · Two days of rain held the drywall.'

describe('the trade’s moved dates on its own row (punch list #217, outside-13)', () => {
  it('reads as today without the flag: the block under the bars, no ghost, no row', async () => {
    await openJob()
    expect(screen.getByRole('region', { name: 'Your dates moved' })).toBeTruthy()
    expect(ghost()).toBeNull()
    expect(row()).toBeNull()
  })

  it('draws the move on the trade’s own row with ?shape=1: the ghost of the old days, the chip, the answers, no block', async () => {
    await openJob('?shape=1')
    expect(screen.queryByRole('region', { name: 'Your dates moved' })).toBeNull()
    expect(ghost()?.getAttribute('title')).toBe(WAS)
    expect(screen.getByText(WAS)).toBeTruthy()
    const moved = within(row()!)
    expect(moved.getByText(CHIP)).toBeTruthy()
    fireEvent.click(moved.getByRole('button', { name: 'These dates work' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_dates', moveId: ID.move1, ok: true }]))
    expect(await moved.findByText('Thank you. The office has your answer.')).toBeTruthy()
  })

  it('asks for another day on the row, with the day and a word on why', async () => {
    await openJob('?shape=1')
    const moved = within(row()!)
    fireEvent.click(moved.getByRole('button', { name: 'I need another day' }))
    const send = moved.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(moved.getByLabelText('The day you can'), { target: { value: '2026-10-22' } })
    fireEvent.change(moved.getByLabelText('A word on why, if you like'), { target: { value: ' Our crew is on another job. ' } })
    fireEvent.click(send)
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_dates', moveId: ID.move1, ok: false, day: '2026-10-22', note: 'Our crew is on another job.' }]))
  })

  it('draws both looks one above the other with ?sbs=1 on the sample', async () => {
    sample = true
    await openJob('?sbs=1')
    const both = screen.getByTestId('portal-side-by-side')
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the strip')).toBeTruthy()
    const today = both.querySelector('[data-side-by-side-today]') as HTMLElement
    const shape = both.querySelector('[data-side-by-side-shape]') as HTMLElement
    expect(within(today).getByRole('region', { name: 'Your dates moved' })).toBeTruthy()
    expect(today.querySelector('[data-portal-ghost]')).toBeNull()
    expect(shape.querySelector(`[data-portal-ghost="${ID.jobLine2}"]`)).toBeTruthy()
    expect(within(shape).queryByRole('region', { name: 'Your dates moved' })).toBeNull()
    expect(within(shape).getByText(CHIP)).toBeTruthy()
  })

  it('lays the fixture’s moves over a sample answer from a function without them', async () => {
    sample = true
    withMoves = false
    await openJob('?shape=1')
    expect(ghost()?.getAttribute('title')).toBe(WAS)
    expect(screen.queryByRole('region', { name: 'Your dates moved' })).toBeNull()
  })

  it('keeps the block when a real answer has no moves by line', async () => {
    withMoves = false
    await openJob('?shape=1')
    expect(screen.getByRole('region', { name: 'Your dates moved' })).toBeTruthy()
    expect(ghost()).toBeNull()
    expect(row()).toBeNull()
  })

  it('keeps today’s look under ?sbs=1 on a real token with nobody signed in', async () => {
    await openJob('?sbs=1')
    expect(screen.queryByTestId('portal-side-by-side')).toBeNull()
    expect(screen.getByRole('region', { name: 'Your dates moved' })).toBeTruthy()
    expect(ghost()).toBeNull()
  })
})
