// @vitest-environment jsdom
/**
 * Dashboard → Training (punch list #111, v2.5567): the card in its three colours over fake reads, the press on
 * each, nothing drawn while the role need not take a course or the tables are not there yet, and the dock told
 * whether the card is on the page.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { shapeViewStorageKey } from '../prototypes/useShapeView'
import { DashboardTrainingSection, TRAINING_DUE_STRIP_KEY } from './DashboardTrainingSection'

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))

const io = vi.hoisted(() => ({
  missing: false,
  enabled: true,
  passes: [] as Array<{ slug: string; passedOn: string; contentVersion: string }>,
  lessons: [] as string[],
  offered: false,
  plumbingLessons: [] as string[],
  retakeFrom: null as string | null,
}))
const auth = vi.hoisted(() => ({ role: 'helpers' as string }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useOptionalAuth: () => m.makeUseAuthValue({ role: auth.role }) }
})
vi.mock('../../lib/training/trainingIo', () => ({
  loadTrainingCatalog: () =>
    Promise.resolve({
      policies: [
        { slug: 'osha-30-refresher', title: 'OSHA 30 refresher', on: io.enabled, requiredRoles: ['helpers'], goodForMonths: 12, dueSoonDays: 30, retakeFrom: io.retakeFrom, offered: false },
        ...(io.offered ? [{ slug: 'intro-to-plumbing', title: 'Intro to plumbing', on: true, requiredRoles: ['helpers'], goodForMonths: 120, dueSoonDays: 30, retakeFrom: null, offered: true }] : []),
      ],
      missing: io.missing,
    }),
  loadMyTraining: () => Promise.resolve({ lessonPasses: { 'osha-30-refresher': io.lessons, 'intro-to-plumbing': io.plumbingLessons }, passes: io.passes, missing: io.missing }),
}))

const TODAY = new Date()
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => ymd(new Date(TODAY.getTime() - n * 86_400_000))

function open(role: string | null = 'helpers', onVisibility?: (v: boolean) => void, search = '') {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <Routes>
        <Route path="/" element={<DashboardTrainingSection userId="u-1" role={role as never} onVisibility={onVisibility} />} />
        <Route path="/training/:slug" element={<div>Course page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const STORAGE_KEY = shapeViewStorageKey(TRAINING_DUE_STRIP_KEY, SMOKE_AUTH_USER_ID)

beforeEach(() => {
  installDomShims()
  localStorage.clear()
  auth.role = 'helpers'
  io.retakeFrom = null
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

  it('Due strip (punch list #217, field-11): off by default the words stay; on, a pass due in days draws the strip with the window, the chip reads due soon, and the verdict splits', async () => {
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(361), contentVersion: '1a2b3c4d' }]
    open()
    await screen.findByText('1 course to take again')
    expect(screen.queryByTestId('training-due-strip')).toBeNull()
    expect(document.querySelector('[data-training-card]')?.getAttribute('data-training-shape')).toBe('words')
    const sw = screen.getByTestId('shape-switch') as HTMLButtonElement
    expect(sw.textContent).toBe('Due strip')
    fireEvent.click(sw)
    const strip = await screen.findByTestId('training-due-strip')
    expect(strip.getAttribute('data-state')).toBe('due-soon')
    expect(within(strip).getByTestId('training-due-window')).toBeTruthy()
    const pct = Number(strip.getAttribute('data-today-pct'))
    expect(pct).toBeGreaterThan(90)
    expect(pct).toBeLessThan(100)
    expect(strip.getAttribute('aria-label')).toMatch(/^OSHA 30 refresher: passed .* on version 1a2b3c4d, good until .*\. Today is \d+ days? before, inside the last 30 days: due soon\.$/)
    expect(screen.getByTestId('training-due-chip').textContent).toMatch(/^due soon · \d+ days?$/)
    expect(screen.getByText(/^1 course due soon$/)).toBeTruthy()
    expect(screen.queryByText(/^Done /)).toBeNull()
    expect(screen.getByText('Take it again')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('Due strip: a pass past its day reads lapsed, full strip, the tick at the end', async () => {
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(400), contentVersion: '1a2b3c4d' }]
    localStorage.setItem(STORAGE_KEY, '1')
    open()
    const strip = await screen.findByTestId('training-due-strip')
    expect(strip.getAttribute('data-state')).toBe('lapsed')
    expect(strip.getAttribute('data-today-pct')).toBe('100')
    expect(screen.getByTestId('training-due-chip').textContent).toMatch(/^lapsed · \d+ days$/)
    expect(screen.getByText('1 course lapsed')).toBeTruthy()
  })

  it('Due strip: a retake day that voids the old pass is its own case, the strip cut at that day, the chip red', async () => {
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(100), contentVersion: 'aaaa1111' }]
    io.retakeFrom = daysAgo(10)
    localStorage.setItem(STORAGE_KEY, '1')
    open()
    const strip = await screen.findByTestId('training-due-strip')
    expect(strip.getAttribute('data-state')).toBe('superseded')
    expect(within(strip).queryByTestId('training-due-window')).toBeNull()
    expect(screen.getByTestId('training-due-chip').textContent).toBe('older version · take it again')
    expect(screen.getByText('1 course to take again')).toBeTruthy()
    expect(screen.getByText(/^Passed .* on an older version\. Everyone takes it again from .*\.$/)).toBeTruthy()
    expect(strip.getAttribute('aria-label')).toContain('counts for nothing')
  })

  it('Due strip: a dev with ?sbs=1 sees Today and With the strip on the same read', async () => {
    io.passes = [{ slug: 'osha-30-refresher', passedOn: daysAgo(100), contentVersion: '1a2b3c4d' }]
    auth.role = 'dev'
    open('helpers', undefined, '?sbs=1')
    await screen.findByTestId('side-by-side')
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('With the strip')).toBeTruthy()
    expect(screen.getAllByText('OSHA 30 refresher').length).toBe(2)
    expect(screen.getByText(/^Done /)).toBeTruthy()
    expect(screen.getByTestId('training-due-strip').getAttribute('data-state')).toBe('current')
    expect(screen.getByTestId('training-due-chip').textContent).toBe('current')
    expect(screen.getAllByText('You are caught up').length).toBe(2)
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
