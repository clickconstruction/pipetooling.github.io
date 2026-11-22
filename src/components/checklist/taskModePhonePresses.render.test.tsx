// @vitest-environment jsdom
/**
 * Task Mode's small presses (punch list #369), each a thumb's 44 px on a phone since the phone walk of 2026-11-21 read
 * them at 18 to 38. None of them has a phone flag: each reads the screen's floor through `phonePressFloor.ts`, so the
 * same style is its desk size at a desk and 44 px on a phone. A layout is a browser's to measure; this holds the
 * values the measure rests on. `src/lib/phonePressFloor.test.ts` holds the stylesheet's side.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { phoneGiveBack, phoneTall } from '../../lib/phonePressFloor'
import { TASK_PILL_STYLE } from '../../lib/tasks/taskPillStyle'
import { TaskModeChip } from '../TaskModeChip'
import { TaskDayBar } from './TaskDayBar'

afterEach(cleanup)

const source = (file: string) => readFileSync(resolve(process.cwd(), 'src/components', file), 'utf8')

describe('Task Mode’s presses on a phone (the walk of 2026-11-21)', () => {
  it('a task card’s pill is 32 px at a desk and 44 on a phone: ＋ Note, 📷 Photo, 🗺 Map and ⋯ More share the one style', () => {
    expect(TASK_PILL_STYLE.minHeight).toBe(phoneTall(32))
    expect(TASK_PILL_STYLE.minHeight).toBe('max(32px, var(--phone-press-min, 0px))')
  })

  it('Exit is a 44 px press around its 28 px pill, and the strip keeps its height', () => {
    const onExit = vi.fn()
    render(<TaskModeChip onExit={onExit} />)
    const exit = screen.getByRole('button', { name: 'Exit Task Mode' })
    expect(exit.style.minHeight).toBe(phoneTall(28))
    expect([exit.style.marginTop, exit.style.marginBottom]).toEqual([phoneGiveBack(28), phoneGiveBack(28)])
    // The press has no look of its own: the pill inside it is the pill Exit was.
    expect([exit.style.background, exit.style.padding]).toEqual(['none', '0px'])
    const pill = exit.querySelector<HTMLElement>('[data-task-mode-exit-pill]')!
    expect([pill.style.minHeight, pill.style.borderRadius, pill.textContent]).toEqual(['28px', '999px', 'Exit'])
    fireEvent.click(exit)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Today and History are 38 px at a desk and 44 on a phone', () => {
    render(<TaskDayBar tab="today" onPick={vi.fn()} />)
    for (const name of ['Today', 'History']) expect(screen.getByRole('button', { name }).style.minHeight).toBe(phoneTall(38))
  })

  it('Go through them and Fold stand a thumb tall in the line they had', () => {
    const still = source('checklist/ChecklistOutstandingSection.tsx')
    expect(still).toContain('const GO_THROUGH_THUMB: CSSProperties = { minHeight: phoneTall(20), marginTop: phoneGiveBack(20), marginBottom: phoneGiveBack(20) }')
    expect(still).toMatch(/data-go-through onClick=\{onGoThrough\} style=\{\{[^}]*\.\.\.GO_THROUGH_THUMB \}\}/)
    const tagged = source('jobs/TaggedJobNotesSection.tsx')
    expect(tagged).toContain("const FOLD_THUMB: CSSProperties = { minHeight: phoneTall(18), minWidth: phoneTall(34), marginTop: phoneGiveBack(18), marginBottom: phoneGiveBack(18), textAlign: 'right' }")
    expect(tagged).toMatch(/data-tagged-notes-fold onClick=\{toggleFold\}[^\n]*\.\.\.FOLD_THUMB \}\}/)
  })
})
