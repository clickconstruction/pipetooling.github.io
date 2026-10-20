// @vitest-environment jsdom
/**
 * Dashboard → Training (punch list #111, v2.5567): the card in its three colours over fake reads, the press on
 * each, nothing drawn while the role need not take a course or the tables are not there yet, and the dock told
 * whether the card is on the page.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims } from '../../test/renderSmokeMocks'
import { DashboardTrainingSection } from './DashboardTrainingSection'

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))

const io = vi.hoisted(() => ({
  missing: false,
  enabled: true,
  passes: [] as Array<{ slug: string; passedOn: string; contentVersion: string }>,
  lessons: [] as string[],
  offered: false,
  plumbingLessons: [] as string[],
}))
vi.mock('../../lib/training/trainingIo', () => ({
  loadTrainingCatalog: () =>
    Promise.resolve({
      policies: [
        { slug: 'osha-30-refresher', title: 'OSHA 30 refresher', on: io.enabled, requiredRoles: ['helpers'], goodForMonths: 12, dueSoonDays: 30, retakeFrom: null, offered: false },
        ...(io.offered ? [{ slug: 'intro-to-plumbing', title: 'Intro to plumbing', on: true, requiredRoles: ['helpers'], goodForMonths: 120, dueSoonDays: 30, retakeFrom: null, offered: true }] : []),
      ],
      missing: io.missing,
    }),
  loadMyTraining: () => Promise.resolve({ lessonPasses: { 'osha-30-refresher': io.lessons, 'intro-to-plumbing': io.plumbingLessons }, passes: io.passes, missing: io.missing }),
}))

const TODAY = new Date()
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => ymd(new Date(TODAY.getTime() - n * 86_400_000))

function open(role: string | null = 'helpers', onVisibility?: (v: boolean) => void) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<DashboardTrainingSection userId="u-1" role={role as never} onVisibility={onVisibility} />} />
        <Route path="/training/:slug" element={<div>Course page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  installDomShims()
  io.missing = false
  io.enabled = true
  io.passes = []
  io.lessons = []
  io.offered = false
  io.plumbingLessons = []
})
afterEach(cleanup)

describe('DashboardTrainingSection', () => {
  it('red with nothing done: the verdict, the course row and Start, which opens the course', async () => {
    const seen: boolean[] = []
    open('helpers', (v) => seen.push(v))
    await screen.findByText('1 course to do')
    expect(document.querySelector('[data-training-card]')?.getAttribute('data-training-card')).toBe('red')
    expect(screen.getByText('OSHA 30 refresher')).toBeTruthy()
    expect(screen.getByText(/30 lessons of about five minutes · about 3 hours in all/)).toBeTruthy()
    fireEvent.click(screen.getByText('Start'))
    await screen.findByText('Course page')
    expect(seen[seen.length - 1]).toBe(true)
  })

  it('started reads Continue with the lessons done', async () => {
    io.lessons = ['01-a', '02-b', '03-c']
    open()
    await screen.findByText('Continue')
    expect(screen.getByText('3 of 30 lessons done')).toBeTruthy()
  })

  it('lapsed is amber with Take it again; caught up is green with Read it again', async () => {
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(400), contentVersion: 'a' }]
    open()
    await screen.findByText('1 course to take again')
    expect(document.querySelector('[data-training-card]')?.getAttribute('data-training-card')).toBe('amber')
    expect(screen.getByText('Take it again')).toBeTruthy()
    cleanup()
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(100), contentVersion: 'a' }]
    open()
    await screen.findByText('You are caught up')
    expect(document.querySelector('[data-training-card]')?.getAttribute('data-training-card')).toBe('green')
    expect(screen.getByText('Read it again')).toBeTruthy()
  })

  it('draws nothing for a role the course is not required of, when the course is off, or before the tables exist', async () => {
    const seen: boolean[] = []
    open('assistant', (v) => seen.push(v))
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    expect(document.querySelector('[data-training-card]')).toBeNull()
    expect(seen[seen.length - 1]).toBe(false)
    cleanup()
    io.enabled = false
    open()
    await waitFor(() => expect(document.querySelector('[data-training-card]')).toBeNull())
    cleanup()
    io.enabled = true
    io.missing = true
    open()
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('[data-training-card]')).toBeNull()
  })

  it('an offered course (v2.5610) sits under Available for a role it is not required of, with no verdict line, and the press follows the record', async () => {
    io.offered = true
    const seen: boolean[] = []
    open('assistant', (v) => seen.push(v))
    await screen.findByText('Intro to plumbing')
    expect(document.querySelector('[data-training-card]')?.getAttribute('data-training-card')).toBe('none')
    expect(document.querySelector('[data-training-verdict]')).toBeNull()
    expect(screen.getByText('Available')).toBeTruthy()
    expect(screen.queryByText('OSHA 30 refresher')).toBeNull()
    expect(seen[seen.length - 1]).toBe(true)
    fireEvent.click(screen.getByText('Start'))
    await screen.findByText('Course page')
    cleanup()
    io.plumbingLessons = ['01-a']
    open('assistant')
    await screen.findByText('Continue')
    cleanup()
    io.passes = [{ slug: 'intro-to-plumbing', passedOn: daysAgo(500), contentVersion: 'a' }]
    open('assistant')
    await screen.findByText('Read it again')
    expect(screen.getByText(/^Done /)).toBeTruthy()
  })

  it('a helper, who must take the offered course, sees it as a red row and never under Available', async () => {
    io.offered = true
    open('helpers')
    await screen.findByText('2 courses to do')
    expect(screen.getByText('Intro to plumbing')).toBeTruthy()
    expect(screen.queryByText('Available')).toBeNull()
    expect(document.querySelector('[data-training-offered]')).toBeNull()
  })
})
