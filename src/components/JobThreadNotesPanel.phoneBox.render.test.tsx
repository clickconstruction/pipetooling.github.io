// @vitest-environment jsdom
/**
 * The note box on a phone (the owner's walk of 2026-11-21): inside the job window's Activity card the box sat four
 * borders deep and 273 px wide at 375. Where the host draws the card the panel and the composer are flat, with one
 * hairline over the composer; every phone gets the short hint, 16 px words and 44 px presses; a desk keeps every box.
 * The rule is `noteComposerLook` (src/lib/jobs/noteComposerLook.test.ts).
 */
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { JobThreadNotesPanel } from './JobThreadNotesPanel'

const viewport = vi.hoisted(() => ({ narrow: true }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => viewport.narrow }))

afterEach(() => {
  cleanup()
  viewport.narrow = true
})

function draw(over: { hostCard?: boolean } = {}) {
  const r = renderWithProviders(
    <JobThreadNotesPanel
      activity={[]}
      viewerRole="dev"
      loading={false}
      canPost
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      tagJobId="job-1"
      tagViewerId="u-me"
      onSubmitTagged={() => undefined}
      submitting={false}
      showSectionTitle={false}
      showEmptyPlaceholder={false}
      showComposerLabel={false}
      pctComplete={25}
      canEditPct
      onCommitPct={() => undefined}
      customerBox={{ render: () => null }}
      {...over}
    />,
  )
  const panel = r.container.querySelector('[data-note-panel]') as HTMLElement
  const composer = r.container.querySelector('[data-note-composer]') as HTMLElement
  const box = screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement
  return { panel, composer, box }
}

/** How many boxes are drawn from the panel down to the note box: an element with a border on every side. */
function boxesAround(panel: HTMLElement, box: HTMLElement): number {
  let count = 0
  for (let el: HTMLElement | null = box; el; el = el === panel ? null : el.parentElement) {
    if (el.style.border && !el.style.border.startsWith('medium') && el.style.borderStyle !== 'none') count += 1
  }
  return count
}

describe('JobThreadNotesPanel: the note box on a phone', () => {
  it('inside the host’s card: the panel and the composer are flat, one hairline over the composer, the box the one border', () => {
    const { panel, composer, box } = draw({ hostCard: true })
    expect(panel.dataset.notePanel).toBe('flat')
    expect(panel.style.border).toBe('')
    expect(panel.style.paddingLeft).toBe('0px')
    expect(panel.style.paddingRight).toBe('0px')
    expect(panel.style.background).toBe('')
    expect(composer.style.borderTop).toBe('1px solid var(--border)')
    expect(composer.style.borderLeft).toBe('')
    expect(composer.style.background).toBe('')
    expect(composer.style.borderRadius).toBe('')
    expect(composer.style.paddingLeft).toBe('')
    // The list's own foot rule is gone: the composer's hairline is the one line between the entries and the box.
    const list = panel.querySelector('[data-activity-scroll]') as HTMLElement
    expect(list.style.borderBottom).toBe('')
    expect(box.style.border).toBe('1px solid var(--border-strong)')
    expect(box.style.width).toBe('100%')
    // The card around the panel is the host's. From the panel down, the note box is the only box.
    expect(boxesAround(panel, box)).toBe(1)
  })

  it('a phone without a host card keeps the panel’s box and the composer’s', () => {
    const { panel, composer, box } = draw()
    expect(panel.dataset.notePanel).toBe('boxed')
    expect(panel.style.border).toBe('1px solid var(--border)')
    expect(composer.style.border).toBe('1px solid var(--border)')
    expect(boxesAround(panel, box)).toBe(3)
  })

  it('every phone: the short hint, 16 px words, and every press in the composer 44 px tall', () => {
    for (const hostCard of [true, false]) {
      const { composer, box } = draw({ hostCard })
      expect(box.placeholder).toBe('Type a note…')
      expect(box.style.fontSize).toBe('1rem')
      expect(parseFloat(box.style.minHeight)).toBeGreaterThanOrEqual(44)
      const presses = within(composer).getAllByRole('button').concat(within(composer).getAllByRole('radio'))
      expect(presses.map((b) => b.textContent)).toEqual(['Set % complete', '@', 'Post note', 'Note', 'Text', 'Email'])
      for (const b of presses) {
        const tall = b.style.height ? parseFloat(b.style.height) : parseFloat(b.style.minHeight)
        expect(tall, b.textContent ?? '').toBeGreaterThanOrEqual(44)
      }
      // One line under the box: neither Set % complete nor Post note may break its words.
      expect(within(composer).getByRole('button', { name: 'Set % complete' }).style.whiteSpace).toBe('nowrap')
      expect(within(composer).getByRole('button', { name: 'Post note' }).style.whiteSpace).toBe('nowrap')
      cleanup()
    }
  })

  it('a desk is as it was, host card or not: every box, the keyboard hint, 14 px words, the small presses', () => {
    viewport.narrow = false
    const { panel, composer, box } = draw({ hostCard: true })
    expect(panel.dataset.notePanel).toBe('boxed')
    expect(panel.style.border).toBe('1px solid var(--border)')
    expect(panel.style.padding).toBe('0.75rem')
    expect(composer.style.border).toBe('1px solid var(--border)')
    expect(composer.style.background).toBe('var(--bg-subtle)')
    expect(box.placeholder).toBe('Type a note… (Enter to post, Shift+Enter for new line)')
    expect(box.style.fontSize).toBe('0.875rem')
    expect(box.style.minHeight).toBe('2.4rem')
    for (const name of ['Set % complete', 'Post note']) expect(within(composer).getByRole('button', { name }).style.minHeight).toBe('')
    expect(within(composer).getByRole('button', { name: 'Tag a teammate' }).style.height).toBe('')
  })
})
