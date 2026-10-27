// @vitest-environment jsdom
/**
 * The job window's phone bar and the Note sheet (punch list #30 PR 2b; punch list #189 PR 4): the bar draws the row
 * the kernel returns, every button at least 48 px, four of them fitting a 375 px phone, and hands each press back by
 * its key; the Note sheet focuses its box, holds Save until there are words, and closes only once the note is on the
 * thread.
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { JobWindowActionBar, JobWindowNoteSheet } from './JobWindowActionBar'
import { crewJobWindowBar, tabbedJobWindowBar } from '../../lib/jobs/jobWindowBar'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const minHeightPx = (el: HTMLElement) => parseFloat(el.style.minHeight)

describe('JobWindowActionBar', () => {
  it('draws the tabbed row at 48 px, Status ▾ and Note opening sheets, and hands back each press by its key', () => {
    const onPress = vi.fn()
    renderWithProviders(<JobWindowActionBar buttons={tabbedJobWindowBar({ label: 'Set % done', tone: 'red', target: 'pct' })} onPress={onPress} />)
    const bar = screen.getByRole('toolbar', { name: 'Job actions' })
    const buttons = within(bar).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Status ▾', 'Set % done', 'Note'])
    for (const b of buttons) expect(minHeightPx(b)).toBeGreaterThanOrEqual(48)
    expect(buttons.map((b) => b.getAttribute('aria-haspopup'))).toEqual(['dialog', null, 'dialog'])
    for (const b of buttons) fireEvent.click(b)
    expect(onPress.mock.calls.map((c) => c[0])).toEqual(['status', 'verb', 'note'])
  })

  it('fits Status ▾ · the verb · Leaving · Note on a 375 px phone: only the verb gives, and it ellipsizes', () => {
    const onPress = vi.fn()
    renderWithProviders(<JobWindowActionBar buttons={tabbedJobWindowBar({ label: 'Ready to bill', tone: 'blue', target: 'status' }, 'leaving')} onPress={onPress} />)
    const bar = screen.getByRole('toolbar', { name: 'Job actions' })
    const buttons = within(bar).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Status ▾', 'Ready to bill', 'Leaving', 'Note'])
    for (const b of buttons) expect(minHeightPx(b)).toBeGreaterThanOrEqual(48)
    fireEvent.click(within(bar).getByRole('button', { name: 'Leaving' }))
    expect(onPress).toHaveBeenCalledWith('leaving')

    // jsdom lays nothing out, so the fit is held two ways. First the grid: the verb's track is the
    // only one that can shrink, to nothing, and its words ellipsize rather than push Note off the bar.
    expect(bar.style.gridTemplateColumns).toBe('auto minmax(0, 1fr) auto auto')
    const verb = buttons[1]!
    expect([verb.style.overflow, verb.style.textOverflow, verb.style.whiteSpace, parseFloat(verb.style.minWidth)]).toEqual(['hidden', 'ellipsis', 'nowrap', 0])
    // Then the room: the three fixed buttons at a generous 9.5 px a glyph (15 px bold measures 7.3 to
    // 8.8 in Chromium), their padding and border as styled, three gaps and the bar's own padding leave
    // the verb a thumb's width inside 375 px. Measured in headless Chromium at 375 px, the fixed three
    // take 214 px and the verb 124, with no sideways overflow.
    const rem = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v))
    const fixed = [buttons[0]!, buttons[2]!, buttons[3]!].reduce(
      (sum, b) => sum + (b.textContent ?? '').length * 9.5 + rem(b.style.paddingLeft) + rem(b.style.paddingRight) + 2,
      0,
    )
    const gaps = 3 * rem(bar.style.gap)
    const sides = rem(bar.style.paddingLeft) + rem(bar.style.paddingRight)
    expect(375 - sides - gaps - fixed).toBeGreaterThanOrEqual(48)
  })

  it('draws the crew row, and nothing at all for an empty row', () => {
    const onPress = vi.fn()
    const { rerender } = renderWithProviders(<JobWindowActionBar buttons={crewJobWindowBar({ stamp: 'leaving', canLeaveReport: true, canNote: true })} onPress={onPress} safeAreaBottom={false} />)
    const bar = screen.getByRole('toolbar', { name: 'Job actions' })
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Leaving', 'Leave report', 'Note'])
    fireEvent.click(within(bar).getByRole('button', { name: 'Leaving' }))
    expect(onPress).toHaveBeenCalledWith('leaving')
    rerender(<JobWindowActionBar buttons={[]} onPress={onPress} />)
    expect(screen.queryByRole('toolbar', { name: 'Job actions' })).toBeNull()
  })
})

/** The sheet over a draft it shares with its caller, as the window's composer shares it. */
function NoteSheetHarness({ onSave, onClose }: { onSave: () => Promise<boolean>; onClose: () => void }) {
  const [draft, setDraft] = useState('')
  return <JobWindowNoteSheet open draft={draft} onDraftChange={setDraft} submitting={false} onSave={onSave} onClose={onClose} />
}

describe('JobWindowNoteSheet', () => {
  it('focuses the note box, holds Save at 48 px until there are words, and closes once the note lands', async () => {
    const onSave = vi.fn(() => Promise.resolve(true))
    const onClose = vi.fn()
    renderWithProviders(<NoteSheetHarness onSave={onSave} onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    const box = within(sheet).getByRole('textbox', { name: 'Add a note' })
    expect(document.activeElement).toBe(box)
    const save = within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(minHeightPx(save)).toBeGreaterThanOrEqual(48)
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: 'Pan set, heater in tomorrow.' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('stays open with the words when the post fails', async () => {
    const onSave = vi.fn(() => Promise.resolve(false))
    const onClose = vi.fn()
    renderWithProviders(<NoteSheetHarness onSave={onSave} onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Add a note' }), { target: { value: 'Pan set.' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // Let the failed post's promise settle before reading what is left.
    await Promise.resolve()
    expect(onClose).not.toHaveBeenCalled()
    expect((within(sheet).getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement).value).toBe('Pan set.')
  })
})
