// @vitest-environment jsdom
/**
 * The My Time day editor's "Reject clock session?" confirm as a component. Pins the seam — no
 * session renders nothing; a session reads its times and the day; the approved warning and the
 * error show only when handed; the buttons and the backdrop call the editor's callbacks; busy holds
 * the buttons but not the backdrop, which the editor's own handler guards.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { MyTimeRejectSessionDialog, type MyTimeRejectSessionDialogProps } from './MyTimeRejectSessionDialog'

afterEach(() => {
  cleanup()
})

/** 8:05 AM – 5:30 PM in the company calendar (America/Chicago, CST in January). */
const session: DayEditorSession = {
  id: 'session-1',
  clocked_in_at: '2026-01-05T14:05:00Z',
  clocked_out_at: '2026-01-05T23:30:00Z',
  work_date: '2026-01-05',
  notes: '',
  job_ledger_id: null,
  bid_id: null,
  approved_at: null,
  origin: 'user_punch',
  salary_segment_index: null,
}

const APPROVED_WARNING = 'This session was already approved.'

function renderDialog(overrides: Partial<MyTimeRejectSessionDialogProps> = {}) {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  const view = renderWithProviders(
    <MyTimeRejectSessionDialog
      session={session}
      dateLabel="Monday, January 5, 2026"
      busy={false}
      error={null}
      onCancel={onCancel}
      onConfirm={onConfirm}
      zIndex={1310}
      {...overrides}
    />
  )
  return { ...view, onCancel, onConfirm }
}

/** Intl prints a narrow no-break space before AM/PM on newer ICU builds; read either as a space. */
function dialogText(): string {
  return (screen.getByRole('alertdialog', { name: 'Reject clock session?' }).textContent ?? '').replace(
    /\u202f/g,
    ' '
  )
}

describe('MyTimeRejectSessionDialog', () => {
  it('no session renders nothing', () => {
    const { container } = renderDialog({ session: null })
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('reads the clock-in and clock-out times and the day, and says what a reject does', () => {
    renderDialog()
    const text = dialogText()
    expect(text).toContain('8:05 AM – 5:30 PM · Monday, January 5, 2026')
    expect(text).toContain('This session will no longer count toward hours until restored by staff.')
  })

  it('a session still on the clock leaves the clock-out blank', () => {
    renderDialog({ session: { ...session, clocked_out_at: null } })
    expect(dialogText()).toContain('8:05 AM –  · Monday, January 5, 2026')
  })

  it('warns about payroll only when the session was approved', () => {
    renderDialog()
    expect(dialogText()).not.toContain(APPROVED_WARNING)
    cleanup()

    renderDialog({ session: { ...session, approved_at: '2026-01-06T15:00:00Z' } })
    expect(dialogText()).toContain(
      'This session was already approved. Rejecting removes those hours from payroll until it is approved again.'
    )
  })

  it('shows the error inside the dialog, and none without one', () => {
    renderDialog()
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()

    renderDialog({ error: 'Could not reject the session.' })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Could not reject the session.')
    expect(screen.getByRole('alertdialog').contains(alert)).toBe(true)
  })

  it('confirm hands the session to the editor; Cancel and the backdrop cancel; the dialog itself does not', () => {
    const { onCancel, onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Reject session' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(session)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('busy holds both buttons and the confirm reads "Rejecting…"', () => {
    const { onCancel, onConfirm } = renderDialog({ busy: true })
    expect(screen.queryByRole('button', { name: 'Reject session' })).toBeNull()
    const confirm = screen.getByRole('button', { name: 'Rejecting…' }) as HTMLButtonElement
    const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)

    fireEvent.click(confirm)
    fireEvent.click(cancel)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('busy leaves the backdrop calling onCancel — the editor’s handler is the guard', () => {
    const { onCancel } = renderDialog({ busy: true })
    fireEvent.click(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('sits at the z-index the editor hands it', () => {
    renderDialog({ zIndex: 1310 })
    expect(screen.getByRole('presentation').style.zIndex).toBe('1310')
    cleanup()

    renderDialog({ zIndex: 1402 })
    expect(screen.getByRole('presentation').style.zIndex).toBe('1402')
  })
})
