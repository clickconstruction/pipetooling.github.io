// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseLensName } from '../../lib/lens/lensName'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsWhatEveryoneSeesTab } from './SettingsWhatEveryoneSeesTab'

// The tab loads the courses apart; one small course stands in for the bundle's three.
vi.mock('../../lib/training/courseRegistry', () => ({
  TRAINING_COURSES: [
    {
      slug: 'pipes',
      title: 'Pipes',
      lessons: [
        { key: '01-in', order: 1, title: 'In', mustKnow: ['{{figure:two-systems|In under pressure, out by gravity.}}'], traps: [] },
        { key: '02-words', order: 2, title: 'Words', mustKnow: ['Only words here.'], traps: [] },
      ],
    },
  ],
  findCourse: () => null,
}))

const frames = () => [...document.querySelectorAll('iframe')]
/** The Where list's Lessons group, as the option words; null when the role lists none. */
const lessonOptions = () => {
  const group = (screen.getByRole('combobox', { name: 'Where' }) as HTMLSelectElement).querySelector('optgroup[label="Lessons"]')
  return group ? [...group.querySelectorAll('option')].map((o) => o.textContent) : null
}
/** Frames load one after another: each frame's load lets the next one in. */
const loadEach = () => {
  for (let round = 0; round < 12; round++) {
    const before = frames().length
    frames().forEach((f) => fireEvent.load(f))
    if (frames().length === before) return
  }
}

describe('Settings → What everyone sees', () => {
  afterEach(() => vi.useRealTimers())

  it('opens on six sealed frames of the estimator\'s dashboard: three widths, light over dark', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    // The first frame goes first; the other five wait their turn, so a fresh deploy's app is fetched once.
    expect(frames()).toHaveLength(1)
    expect(screen.getAllByText('Waiting its turn…')).toHaveLength(5)
    loadEach()
    expect(screen.queryByText('Waiting its turn…')).toBeNull()
    const f = frames()
    expect(f).toHaveLength(6)
    expect(f.map((x) => parseLensName(x.getAttribute('name'))?.theme)).toEqual(['light', 'light', 'light', 'dark', 'dark', 'dark'])
    expect(f.every((x) => x.getAttribute('src') === '/dashboard')).toBe(true)
    expect(f.map((x) => x.style.width)).toEqual(['375px', '768px', '1280px', '375px', '768px', '1280px'])
    expect(f[0]!.getAttribute('title')).toBe('Dashboard as Eli Sample, estimator, Phone 375, light, full')
  })

  it('draws a screen as all nine roles, six at a time, and swaps one in on Draw it', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Roles' }))
    loadEach()
    expect(frames()).toHaveLength(6)
    const draw = screen.getAllByRole('button', { name: 'Draw it' })
    expect(draw).toHaveLength(3)
    fireEvent.click(draw[0]!)
    loadEach()
    expect(frames()).toHaveLength(6)
    expect(frames().map((x) => parseLensName(x.getAttribute('name'))?.as)).toContain('superintendent')
  })

  it('holds the knobs that do not vary, and names the state on each frame across states', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'States' }))
    expect((screen.getByRole('button', { name: 'Failing' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText('Training mode').length).toBeGreaterThan(0)
    loadEach()
    const moods = frames().map((x) => parseLensName(x.getAttribute('name'))?.mood)
    expect(moods).toEqual(['full', 'empty', 'loading', 'slow', 'error', 'offline'])
  })

  it('lists only the screens the picked role can open', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Helper' }))
    const where = screen.getByRole('combobox', { name: 'Where' }) as HTMLSelectElement
    expect([...where.options].some((o) => o.value === 'page:/dashboard')).toBe(true)
    expect([...where.options].some((o) => o.value.startsWith('page:/bids'))).toBe(false)
  })

  it('ends the dev\'s list with each training lesson that draws a figure, and the estimator\'s with none', async () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    expect(lessonOptions()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dev' }))
    await waitFor(() => expect(lessonOptions()).toEqual(['Pipes · Lesson 1 · In · Training']))
    expect(screen.getByText(/screens dev can open$/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Estimator' }))
    expect(lessonOptions()).toBeNull()
  })

  it('lays every screen out as cards, and Check every screen draws them six at a time', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Every screen' }))
    expect(frames()).toHaveLength(0)
    expect(screen.getByText(/of \d+ screens checked, 6 at a time/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Check every screen' }))
    loadEach()
    expect(frames()).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Stop checking' })).toBeTruthy()
  })

  it('draws the homeowner\'s pages unsealed on their sample tokens, light only, with the state held', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    expect(screen.getByText('Who, outside')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Homeowner' }))
    loadEach()
    const f = frames()
    expect(f).toHaveLength(3)
    expect(f.every((x) => x.getAttribute('name') === null)).toBe(true)
    expect(f.every((x) => /sample/.test(x.getAttribute('src') ?? ''))).toBe(true)
    expect((screen.getByRole('button', { name: 'Failing' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Roles' })).toBeNull()
    expect(screen.getByText('Light, as every customer page is')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Estimator' }))
    expect(frames().every((x) => x.getAttribute('name')?.startsWith('pipetooling-lens:'))).toBe(true)
  })

  it('draws a frame once more when it loads with no app in it, and only once', () => {
    vi.useFakeTimers()
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    const first = frames()[0]!
    fireEvent.load(first)
    act(() => vi.advanceTimersByTime(1600))
    const second = frames()[0]!
    expect(second).not.toBe(first)
    fireEvent.load(second)
    act(() => vi.advanceTimersByTime(1600))
    expect(frames()[0]).toBe(second)
  })

  it('lets the next frame in after four seconds when one never loads', () => {
    vi.useFakeTimers()
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    expect(frames()).toHaveLength(1)
    act(() => vi.advanceTimersByTime(4100))
    expect(frames()).toHaveLength(2)
  })
})
