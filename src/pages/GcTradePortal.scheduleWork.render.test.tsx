// @vitest-environment jsdom
/**
 * The Portal's P5d-ii-2: the trade's side of the schedule in its portal, drawn from `gc-trade-portal`'s `scheduleWork`
 * (to-dos/gc-mode/mockups/portal-p5d.md). On the sample's job being built: the chart first with the late door under
 * each of its own bars (a push back to keep, a bar to say late on, with the second look), then *Your dates moved*, then
 * *Your next three weeks* with the crew count under each coming week (amendment 2). Each press posts its kind; the
 * office's preview posts nothing; Needs you carries the schedule's to-dos the function worked out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  gcTradePortalSample,
  gcTradePortalSampleSchedules,
  gcTradePortalSampleScheduleWork,
  SAMPLE_TRADE_IDS as ID,
} from '../../supabase/functions/_shared/gcTradePortalSample'
import type { PortalTodo } from '../lib/gc/portal'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const posts: Record<string, unknown>[] = []
const lateReads: string[] = []
let withWork = true
let todos: PortalTodo[] = []

beforeEach(() => {
  posts.length = 0
  lateReads.length = 0
  withWork = true
  todos = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: true, json: async () => ({ ok: true }) }
      }
      if (url.includes('&late=')) {
        lateReads.push(url)
        return { ok: true, json: async () => ({ waiting: [{ work: 'Paint and finishes', company: 'Brushline Painting', start: '2026-10-27', days: 3 }] }) }
      }
      const work = gcTradePortalSampleScheduleWork(TODAY)
      return {
        ok: true,
        json: async () => ({ today: TODAY, slice: gcTradePortalSample(TODAY), schedules: gcTradePortalSampleSchedules(TODAY), ...(withWork ? { scheduleWork: work.scheduleWork, scheduleTodos: todos } : {}) }),
      }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = `/t/${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const openJob = async (path?: string) => {
  open(path)
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return screen.findByRole('region', { name: 'Your schedule on this job' })
}

const bar = (lineId: string) => document.querySelector(`[data-portal-late="${lineId}"]`) as HTMLElement

describe('the trade’s side of the schedule (P5d-ii-2)', () => {
  it('draws the chart first, then the dates to answer, then its next three weeks', async () => {
    const chart = await openJob()
    const dates = screen.getByRole('region', { name: 'Your dates moved' })
    const look = screen.getByRole('region', { name: 'Your next three weeks' })
    expect(chart.compareDocumentPosition(dates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dates.compareDocumentPosition(look) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The late door sits under each of its own bars, inside the chart.
    expect(within(chart).getAllByText('We will be late').length).toBeGreaterThan(0)
    expect(chart.contains(bar(ID.jobLine1))).toBe(true)
    expect(chart.contains(bar(ID.jobLine2))).toBe(true)
  })

  it('says the new dates work', async () => {
    await openJob()
    const dates = within(screen.getByRole('region', { name: 'Your dates moved' }))
    expect(dates.getByText('Your dates moved on Sample Dental Office')).toBeTruthy()
    fireEvent.click(dates.getByRole('button', { name: 'These dates work' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_dates', moveId: ID.move1, ok: true }]))
  })

  it('asks for another day with the day and a word on why', async () => {
    await openJob()
    const dates = within(screen.getByRole('region', { name: 'Your dates moved' }))
    fireEvent.click(dates.getByRole('button', { name: 'I need another day' }))
    const send = dates.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(dates.getByLabelText('The day you can'), { target: { value: '2026-10-22' } })
    fireEvent.change(dates.getByLabelText('A word on why, if you like'), { target: { value: ' Our crew is on another job. ' } })
    fireEvent.click(send)
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'answer_dates', moveId: ID.move1, ok: false, day: '2026-10-22', note: 'Our crew is on another job.' }]))
  })

  it('reads our push back on the rough-in, never who of ours pressed it, and keeps the day', async () => {
    await openJob()
    const rough = within(bar(ID.jobLine1))
    expect(rough.getByText(/^Click needs /)).toBeTruthy()
    expect(rough.getByText(/The drywall starts right after/)).toBeTruthy()
    fireEvent.click(rough.getByRole('button', { name: /^We will make / }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'keep_day', noticeId: ID.notice1 }]))
  })

  it('says a bar will be late with its day, why and a sentence, after the second look', async () => {
    await openJob()
    const trim = within(bar(ID.jobLine2))
    fireEvent.click(trim.getByRole('button', { name: 'We will be late' }))
    const send = trim.getByRole('button', { name: 'Send it to Click' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(trim.getByLabelText('The day you can start'), { target: { value: '2026-10-23' } })
    // The second look: what waits on it, by name, never a price.
    expect(await trim.findByText(/^Paint and finishes by Brushline Painting would start /)).toBeTruthy()
    expect(lateReads).toHaveLength(1)
    expect(lateReads[0]).toContain(`late=${ID.jobLine2}`)
    expect(lateReads[0]).toContain('day=2026-10-23')
    fireEvent.click(trim.getByRole('button', { name: 'Weather' }))
    fireEvent.change(trim.getByLabelText('Say what happened, in a sentence.'), { target: { value: 'Rain held the drywall two days.' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() =>
      expect(posts).toEqual([{ token: TOKEN, kind: 'say_late', activityId: ID.jobLine2, day: '2026-10-23', reason: 'weather', note: 'Rain held the drywall two days.' }]),
    )
  })

  it('marks this week done, or not done and why', async () => {
    await openJob()
    const week = within(document.querySelector('[data-portal-week="2026-10-05"]') as HTMLElement)
    fireEvent.click(week.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'mark_lookahead', activityId: ID.jobLine1, weekOf: '2026-10-05', done: true }]))
    fireEvent.click(week.getByRole('button', { name: 'Not done' }))
    fireEvent.change(week.getByRole('combobox'), { target: { value: 'materials' } })
    fireEvent.click(week.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts[1]).toEqual({ token: TOKEN, kind: 'mark_lookahead', activityId: ID.jobLine1, weekOf: '2026-10-05', done: false, reason: 'materials' }))
  })

  it('reads the crew count it gave, and gives one for a coming week, a whole number only', async () => {
    await openJob()
    expect(within(document.querySelector('[data-portal-crew="2026-10-12"]') as HTMLElement).getByText('You said 3 a day.')).toBeTruthy()
    const later = within(document.querySelector('[data-portal-crew="2026-10-19"]') as HTMLElement)
    const send = later.getByRole('button', { name: 'Tell Click' }) as HTMLButtonElement
    fireEvent.change(later.getByLabelText('How many people a day'), { target: { value: '2.5' } })
    expect(send.disabled).toBe(true)
    expect(later.getByText('A whole number, 0 to 50.')).toBeTruthy()
    fireEvent.change(later.getByLabelText('How many people a day'), { target: { value: '4' } })
    fireEvent.click(send)
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'crew_count', packageId: ID.jobTrade, weekOf: '2026-10-19', count: 4 }]))
  })

  it('posts nothing and reads no second look from the office’s preview', async () => {
    await openJob(`/t/${TOKEN}?preview=1`)
    const dates = within(screen.getByRole('region', { name: 'Your dates moved' }))
    fireEvent.click(dates.getByRole('button', { name: 'These dates work' }))
    expect(await dates.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    const trim = within(bar(ID.jobLine2))
    fireEvent.click(trim.getByRole('button', { name: 'We will be late' }))
    fireEvent.change(trim.getByLabelText('The day you can start'), { target: { value: '2026-10-23' } })
    await new Promise((r) => setTimeout(r, 500))
    expect(posts).toEqual([])
    expect(lateReads).toEqual([])
  })

  it('draws none of it when the function sent no schedule work', async () => {
    withWork = false
    await openJob()
    expect(screen.queryByRole('region', { name: 'Your dates moved' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Your next three weeks' })).toBeNull()
    expect(document.querySelector('[data-portal-late]')).toBeNull()
  })

  it('carries the schedule’s to-dos in Needs you, and opens the job at its block', async () => {
    todos = [{ key: `dates:${ID.move1}`, projectId: ID.job, text: 'New dates on Sample Dental Office to answer.', tone: 'amber', by: null, anchor: 'dates' }]
    open()
    const needs = within(await screen.findByRole('region', { name: /^Needs you/ }))
    fireEvent.click(needs.getByRole('button', { name: 'New dates on Sample Dental Office to answer.' }))
    expect(await screen.findByRole('region', { name: 'Your dates moved' })).toBeTruthy()
  })
})
