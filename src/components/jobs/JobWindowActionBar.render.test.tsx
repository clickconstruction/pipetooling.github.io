// @vitest-environment jsdom
/**
 * The job window's phone bar and the Note sheet (punch list #30 PR 2b; punch list #189 PR 4): the bar draws the row
 * the kernel returns, every button at least 48 px, four of them fitting a 375 px phone, and hands each press back by
 * its key; the Note sheet focuses its box, holds Save until there are words, and closes only once the note is on the
 * thread. Since the phone walk of 2026-11-21 the bar stands down while a sheet is up, the Note sheet is drawn at the
 * top of the page, and its box tags a teammate as the Activity composer does (punch list #363).
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const TAGGABLE = [
  { user_id: 'u-alv', name: 'Chris Alvarez', role: 'helpers', on_job: true },
  { user_id: 'u-bell', name: 'Chris Bell', role: 'assistant', on_job: false },
  { user_id: 'u-dana', name: 'Dana Whitlock', role: 'assistant', on_job: false },
]
/** The jobs whose names were read, in order. */
const asked = vi.hoisted(() => ({ jobs: [] as unknown[] }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { rpc: (n: string, a?: unknown) => unknown }
  const rpc = stub.rpc.bind(stub)
  stub.rpc = (name: string, args?: unknown) => {
    if (name !== 'job_note_taggable') return rpc(name, args)
    asked.jobs.push((args as { p_job_id?: string } | undefined)?.p_job_id)
    return Promise.resolve({ data: TAGGABLE, error: null })
  }
  return { supabase: stub }
})

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

  it('stands down while a sheet is up: it keeps its room, is not drawn, and is out of a screen reader’s way', () => {
    const onPress = vi.fn()
    const row = tabbedJobWindowBar({ label: 'Ready to bill', tone: 'green', target: 'status' }, 'arrived')
    const { rerender } = renderWithProviders(<JobWindowActionBar buttons={row} onPress={onPress} standsDown />)
    // Hidden, not unmounted: the body above the bar must not change height behind the sheet.
    expect(screen.queryByRole('toolbar', { name: 'Job actions' })).toBeNull()
    const bar = document.querySelector('[role="toolbar"][data-stands-down]') as HTMLElement
    expect(bar.style.visibility).toBe('hidden')
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(within(bar).getAllByRole('button', { hidden: true })).toHaveLength(4)
    rerender(<JobWindowActionBar buttons={row} onPress={onPress} />)
    const back = screen.getByRole('toolbar', { name: 'Job actions' })
    expect(back.style.visibility).toBe('')
    expect(back.getAttribute('aria-hidden')).toBeNull()
  })
})

/** The sheet over a draft it shares with its caller, as the window's composer shares it. */
function NoteSheetHarness({ onSave, onClose, tagJobId, canTag }: { onSave: (tagged?: string[]) => Promise<boolean>; onClose: () => void; tagJobId?: string; canTag?: boolean }) {
  const [draft, setDraft] = useState('')
  return <JobWindowNoteSheet open draft={draft} onDraftChange={setDraft} submitting={false} onSave={onSave} onClose={onClose} tagJobId={tagJobId} canTag={canTag} />
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value, selectionStart: value.length } })
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

  it('is drawn at the top of the page, outside whatever window opens it', () => {
    const { container } = renderWithProviders(
      <div data-testid="window-body" style={{ overflowY: 'auto' }}>
        <NoteSheetHarness onSave={() => Promise.resolve(true)} onClose={() => undefined} />
      </div>,
    )
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    const layer = sheet.closest('[data-phone-sheet]') as HTMLElement
    // A sheet inside the window's scrolling body was cut to that body's edge on an iPhone, under the bar.
    expect(layer.parentElement).toBe(document.body)
    expect(container.contains(layer)).toBe(false)
    expect(screen.getByTestId('window-body').contains(layer)).toBe(false)
  })

  it('offers no @ and no names without a job to tag on, and saves the note plain', async () => {
    asked.jobs.length = 0
    const onSave = vi.fn((_tagged?: string[]) => Promise.resolve(true))
    renderWithProviders(<NoteSheetHarness onSave={onSave} onClose={() => undefined} />)
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    const box = within(sheet).getByRole('textbox', { name: 'Add a note' })
    expect(within(sheet).queryByRole('button', { name: 'Tag a teammate' })).toBeNull()
    type(box, 'ask @da')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(asked.jobs).toEqual([])
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(undefined))
  })

  it('tags as the Activity composer does: the row of names in the sheet’s flow, a tap, the tint, Will tag, and the id on Save', async () => {
    asked.jobs.length = 0
    const onSave = vi.fn((_tagged?: string[]) => Promise.resolve(true))
    const onClose = vi.fn()
    renderWithProviders(<NoteSheetHarness onSave={onSave} onClose={onClose} tagJobId="job-1" canTag />)
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    const box = within(sheet).getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement
    const at = within(sheet).getByRole('button', { name: 'Tag a teammate' })
    expect([at.style.width, at.style.height]).toEqual(['44px', '44px'])
    type(box, 'ask @')
    const list = await within(sheet).findByRole('listbox', { name: 'Teammates' })
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(3))
    expect(asked.jobs).toEqual(['job-1'])
    // The same names in the same order as the composer's row, the crew first, each a thumb's press.
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['@Chris Alvarezcrew · on this job', '@Chris Belloffice', '@Dana Whitlockoffice'])
    expect(within(list).getAllByRole('option').every((o) => o.style.minHeight === '44px')).toBe(true)
    // In the sheet's own flow, above the box: the sheet grows by the row, so it stays above the keyboard and
    // is never cut by the sheet's edge as a row hung over the box would be.
    expect(list.style.position).toBe('')
    expect(parseFloat(list.style.maxHeight)).toBeLessThanOrEqual(130)
    expect(list.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    type(box, 'ask @da')
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(1))
    // pointerdown, its default prevented: the box keeps its focus and a phone's keyboard stays up.
    expect(fireEvent.pointerDown(within(list).getByRole('option'))).toBe(false)
    await waitFor(() => expect(box.value).toBe('ask @Dana Whitlock '))
    expect(document.querySelector('[data-note-tag-mark] [data-mark="tag"]')?.textContent).toBe('@Dana Whitlock')
    expect(within(sheet).getByLabelText('Take Dana Whitlock off')).toBeTruthy()
    expect(sheet.querySelector('[data-note-tag-chips]')?.textContent).toContain('Will tag:')
    expect(within(sheet).queryByRole('listbox')).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['u-dana']))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('takes a whole tag off with one Backspace, and then saves no tag', async () => {
    const onSave = vi.fn((_tagged?: string[]) => Promise.resolve(true))
    renderWithProviders(<NoteSheetHarness onSave={onSave} onClose={() => undefined} tagJobId="job-1" canTag />)
    const sheet = screen.getByRole('dialog', { name: 'Note' })
    const box = within(sheet).getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement
    type(box, 'ask @chris b')
    await waitFor(() => expect(within(sheet).getAllByRole('option')).toHaveLength(1))
    // Enter picks the lit name. It adds no line and saves nothing.
    expect(fireEvent.keyDown(box, { key: 'Enter' })).toBe(false)
    await waitFor(() => expect(box.value).toBe('ask @Chris Bell '))
    expect(onSave).not.toHaveBeenCalled()
    box.setSelectionRange(16, 16)
    expect(fireEvent.keyDown(box, { key: 'Backspace' })).toBe(false)
    await waitFor(() => expect(box.value).toBe('ask '))
    expect(within(sheet).queryByLabelText('Take Chris Bell off')).toBeNull()
    // A name typed back by hand is plain words: a tag is a tap or Enter.
    type(box, 'ask @Chris Bell now')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]))
  })
})
