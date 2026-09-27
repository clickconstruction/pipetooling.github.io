// @vitest-environment jsdom
/**
 * Render smokes for the block sheet (v2.3885): the verbs in order, each drawn
 * only when its handler is passed, the note row's two readings, and the
 * Day tab's Move wording.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScheduleBlockSheet } from './ScheduleBlockSheet'

vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))

afterEach(cleanup)

const base = { title: 'J473 · Mike Holub', subtitle: '7:00 AM–9:00 AM · Malachi · 109 Tuscarora Trail', note: '', onClose: () => {}, onOpenJob: () => {} }

describe('ScheduleBlockSheet', () => {
  it('the Day tab’s sheet: Open the job · Add a note · Move or reassign · Remove, and each fires its handler', () => {
    const onOpenJob = vi.fn()
    const onEditNote = vi.fn()
    const onMove = vi.fn()
    const onRemove = vi.fn()
    const onClose = vi.fn()
    render(<ScheduleBlockSheet {...base} onClose={onClose} onOpenJob={onOpenJob} onEditNote={onEditNote} onMove={onMove} moveLabel="Move or reassign" moveHint="Pick the day and the person" onRemove={onRemove} />)
    const dialog = screen.getByRole('dialog', { name: 'J473 · Mike Holub' })
    expect(dialog.textContent).toContain('7:00 AM–9:00 AM · Malachi · 109 Tuscarora Trail')
    const labels = [...dialog.querySelectorAll('button')].map((b) => b.querySelector('span')?.textContent ?? b.textContent)
    expect(labels).toEqual(['Open the job', 'Add a note', 'Move or reassign', 'Remove from the schedule', 'Close'])
    fireEvent.click(screen.getByText('Open the job'))
    fireEvent.click(screen.getByText('Add a note'))
    fireEvent.click(screen.getByText('Move or reassign'))
    fireEvent.click(screen.getByText('Remove from the schedule'))
    fireEvent.click(screen.getByText('Close'))
    for (const fn of [onOpenJob, onEditNote, onMove, onRemove, onClose]) expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a reader sees only Open the job; a note reads back on its row; Copy to techs sits before Move', () => {
    const { unmount } = render(<ScheduleBlockSheet {...base} />)
    expect([...screen.getByRole('dialog').querySelectorAll('button')].map((b) => b.textContent)).toEqual(["Open the jobJob detail with this visit's times", 'Close'])
    unmount()
    render(<ScheduleBlockSheet {...base} note="call first" onEditNote={() => {}} onCopyToTechs={() => {}} onMove={() => {}} />)
    expect(screen.getByText('Edit the note')).toBeTruthy()
    expect(screen.getByText('call first')).toBeTruthy()
    const labels = [...screen.getByRole('dialog').querySelectorAll('button')].map((b) => b.querySelector('span')?.textContent)
    expect(labels.indexOf('Copy to techs')).toBeLessThan(labels.indexOf('Move'))
  })
})
