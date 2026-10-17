// @vitest-environment jsdom
/**
 * The course page (punch list #111, v2.5566): `/training/<slug>` over a fixture course and fake reads. It opens on
 * the first lesson not yet passed with the rail's ticks and the final check locked; four right picks record the
 * lesson once and open Next lesson, a wrong pick offers Try again and counts a try; a course that is off is said
 * so to a helper and previewed by a dev; with every lesson done the final check draws, grades and records a pass.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../contexts/ToastContext'
import { installDomShims, settle } from '../test/renderSmokeMocks'
import Training from './Training'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const auth = vi.hoisted(() => ({ role: 'helpers' as string | null, loading: false }))
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../test/renderSmokeMocks')
  const byState = new Map<string, ReturnType<typeof makeUseAuthValue>>()
  const value = () => {
    const key = `${auth.role}|${auth.loading}`
    if (!byState.has(key)) byState.set(key, makeUseAuthValue({ role: auth.role, loading: auth.loading }))
    return byState.get(key)!
  }
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

// A fixture course: three lessons in two parts and a bank of twenty, built by the real parser.
vi.mock('../lib/training/courseRegistry', async () => {
  const { buildCourseRegistry } = await import('../lib/training/courseContent')
  const lesson = (title: string, part: number) => `---
title: ${title}
part: ${part}
minutes: 5
from: Unit 1
---
## Why it matters
One short line.

## Must know
- First fact.
- {{figure:controls-ladder|Start at the top.}}
- Second fact with a **number** in it.
- Third fact.
- Fourth fact.

## Traps
- A trap.

## Numbers
- **5 ft** a system
- **20 ft** an engineer
- **2 ft** spoil back

## Check yourself
${[1, 2, 3, 4]
  .map(
    (n) => `${n}. Question ${n}?
- [x] Right
- [ ] Wrong one
- [ ] Wrong two
- [ ] Wrong three
> right: Yes.
> wrong: No, the rule is the other way.`,
  )
  .join('\n\n')}
`
  const bank = `---
title: Final check bank
---
## Questions
${Array.from({ length: 20 }, (_, i) => `${i + 1}. Bank question ${i + 1}?\n- [x] Right\n- [ ] A\n- [ ] B\n- [ ] C\n> right: Yes.\n> wrong: No.`).join('\n\n')}
`
  const course = `---
title: Fixture course
summary: A course for the smoke.
line: A refresher, not a card.
final_draw: 8
final_pass: 6
---
## Parts
0. Start here
1. Foundations
`
  const courses = buildCourseRegistry({
    '../content/training/fixture-course/course.md': course,
    '../content/training/fixture-course/01-first.md': lesson('First lesson', 0),
    '../content/training/fixture-course/02-second.md': lesson('Second lesson', 1),
    '../content/training/fixture-course/03-third.md': lesson('Third lesson', 1),
    '../content/training/fixture-course/final-bank.md': bank,
  })
  return { TRAINING_COURSES: courses, findCourse: (slug: string) => courses.find((c) => c.slug === slug) ?? null }
})

const io = vi.hoisted(() => ({
  enabled: true,
  passed: ['01-first'] as string[],
  passes: [] as Array<{ slug: string; passedOn: string; contentVersion: string }>,
  passLesson: vi.fn(() => Promise.resolve()),
  finishCourse: vi.fn(() => Promise.resolve('pass-1')),
}))
vi.mock('../lib/training/trainingIo', () => ({
  loadTrainingCatalog: () =>
    Promise.resolve({
      policies: [{ slug: 'fixture-course', title: 'Fixture course', on: io.enabled, requiredRoles: ['helpers'], goodForMonths: 12, dueSoonDays: 30, retakeFrom: null }],
      missing: false,
    }),
  loadMyTraining: () => Promise.resolve({ lessonPasses: { 'fixture-course': io.passed }, passes: io.passes, missing: false }),
  passLesson: io.passLesson,
  finishCourse: io.finishCourse,
}))

function open(path = '/training/fixture-course') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/training/:slug" element={<Training />} />
          <Route path="/dashboard" element={<div>Dashboard landing</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

function pickRight(fieldset: HTMLElement) {
  fireEvent.click(within(fieldset).getByLabelText('Right'))
}

beforeEach(() => {
  installDomShims()
  window.scrollTo = () => {}
  auth.role = 'helpers'
  io.enabled = true
  io.passed = ['01-first']
  io.passes = []
  io.passLesson.mockClear()
  io.finishCourse.mockClear()
})
afterEach(cleanup)

describe('Training page', () => {
  it('opens on the first lesson not yet passed, ticks the passed one, and keeps the final check locked', async () => {
    open()
    await screen.findByRole('heading', { level: 2, name: 'Second lesson' })
    await settle()
    expect(screen.getByText(/Part 1 · Lesson 2 of 3/)).toBeTruthy()
    const first = document.querySelector('[data-lesson-row="01-first"]')!
    expect(first.getAttribute('data-done')).toBe('true')
    expect(first.textContent).toContain('✓')
    const finalRow = document.querySelector('[data-final-row]') as HTMLButtonElement
    expect(finalRow.disabled).toBe(true)
    expect(finalRow.textContent).toContain('opens when every lesson is done')
    expect(screen.getByText('1 of 3 lessons')).toBeTruthy()
    expect(document.querySelector('[data-standing]')).toBeNull()
    expect((screen.getByText('Next lesson ›') as HTMLButtonElement).disabled).toBe(true)
    // punch list #116: the figure line draws its figure under the sentence, named by its caption, with no bullet
    const figure = document.querySelector('figure[data-training-figure="controls-ladder"]')!
    expect(figure.querySelector('figcaption')?.textContent).toBe('Start at the top.')
    expect(screen.getByRole('img', { name: 'Start at the top.' })).toBeTruthy()
    expect((figure.parentElement as HTMLElement).style.listStyle).toBe('none')
    expect(screen.queryByText('{{figure:controls-ladder|Start at the top.}}')).toBeNull()
  })

  it('four right picks record the lesson once and open Next lesson; a wrong pick offers Try again', async () => {
    open()
    await screen.findByRole('heading', { level: 2, name: 'Second lesson' })
    // The open lesson pins itself in an effect after the record lands; settle so the click lands on the settled check.
    await settle()
    const questions = () => Array.from(document.querySelectorAll('[data-question]')) as HTMLElement[]
    // A wrong pick on the first question, then Try again.
    fireEvent.click(within(questions()[0]!).getByLabelText('Wrong one'))
    await waitFor(() => expect(questions()[0]!.getAttribute('data-state')).toBe('wrong'))
    expect(within(questions()[0]!).getByText(/Not this one/)).toBeTruthy()
    fireEvent.click(within(questions()[0]!).getByText('Try again'))
    await waitFor(() => expect(questions()[0]!.getAttribute('data-state')).toBe('open'))
    for (const q of questions()) pickRight(q)
    await waitFor(() => expect(io.passLesson).toHaveBeenCalledTimes(1))
    expect(io.passLesson).toHaveBeenCalledWith('fixture-course', '02-second', 2)
    expect(screen.getByText(/All four right/)).toBeTruthy()
    expect((screen.getByText('Next lesson ›') as HTMLButtonElement).disabled).toBe(false)
    expect(document.querySelector('[data-lesson-row="02-second"]')!.getAttribute('data-done')).toBe('true')
    fireEvent.click(screen.getByText('Next lesson ›'))
    await screen.findByRole('heading', { level: 2, name: 'Third lesson' })
  })

  it('a course that is off is said so to a helper, and previewed by a dev', async () => {
    io.enabled = false
    open()
    await screen.findByText(/is not on yet/)
    cleanup()
    auth.role = 'dev'
    open()
    await screen.findByRole('heading', { level: 2, name: 'Second lesson' })
    expect(screen.getByText('Preview · switched off')).toBeTruthy()
  })

  it('with every lesson done the final check draws, grades and records a pass', async () => {
    io.passed = ['01-first', '02-second', '03-third']
    open('/training/fixture-course?final=1')
    await screen.findByRole('heading', { level: 2, name: /8 questions from every part/ })
    await settle()
    const questions = Array.from(document.querySelectorAll('[data-final-check] [data-question]')) as HTMLElement[]
    expect(questions).toHaveLength(8)
    const handIn = screen.getByText('Hand it in') as HTMLButtonElement
    expect(handIn.disabled).toBe(true)
    for (const q of questions) pickRight(q)
    expect(handIn.disabled).toBe(false)
    fireEvent.click(handIn)
    await waitFor(() => expect(io.finishCourse).toHaveBeenCalledTimes(1))
    expect((io.finishCourse.mock.calls[0] as unknown[])[0]).toMatchObject({ courseSlug: 'fixture-course', score: 8, total: 8, pass: 6 })
    await screen.findByText(/Passed\. 8 of 8 right\. Recorded, due again/)
    await waitFor(() => expect(document.querySelector('[data-standing]')?.getAttribute('data-standing')).toBe('green'))
    expect(screen.getByText('Final check passed')).toBeTruthy()
    fireEvent.click(screen.getByText('‹ Back to the Dashboard'))
    await screen.findByText('Dashboard landing')
  })

  it('an unknown slug says so and offers the Dashboard', async () => {
    open('/training/no-such-course')
    await screen.findByText(/No course is named no-such-course/)
  })
})
