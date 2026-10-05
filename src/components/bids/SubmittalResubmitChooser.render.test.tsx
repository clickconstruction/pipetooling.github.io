// @vitest-environment jsdom
/**
 * Step 7's question (2026-10-05): one button opens it, and the two kinds of draft are choices
 * inside it. It renders and reports only.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalResubmitChooser } from './SubmittalResubmitChooser'
import { resubmitChooser, type ResubmitRows } from '../../lib/submittals/reviewDecisions'

const words = resubmitChooser(1, { sentBack: 4, noAnswer: 10, approved: 9, needTotal: 14, everyTotal: 23 })

function mount(over: { choice?: ResubmitRows; busy?: boolean } = {}) {
  const on = { choose: vi.fn(), cancel: vi.fn(), confirm: vi.fn() }
  render(<SubmittalResubmitChooser words={words} choice={over.choice ?? 'need'} busy={over.busy ?? false} onChoose={on.choose} onCancel={on.cancel} onConfirm={on.confirm} />)
  return on
}

describe('SubmittalResubmitChooser', () => {
  it('names the draft, offers the two kinds of row, and the button counts the ticked one', () => {
    const on = mount()
    const dialog = screen.getByRole('dialog', { name: 'Start a Rev 2 draft' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(within(dialog).getByRole('radiogroup', { name: 'Which rows go on Rev 2?' })).toBeTruthy()
    const radios = within(dialog).getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.checked)).toEqual([true, false])
    expect(within(dialog).getByTestId('resubmit-rows-need').textContent).toContain('The 9 rows approved stay on Rev 1 and on the procurement log.')
    expect(within(dialog).getByTestId('resubmit-rows-every').textContent).toContain('The 9 rows approved go on Rev 2 too.')
    expect(within(dialog).getByTestId('resubmit-chooser-foot').textContent).toBe('Rev 2 starts as a draft. Nothing is sent. The GC sees Rev 2 only after you press Share.')
    // The button takes the focus, so Enter starts the draft that is ticked.
    const go = within(dialog).getByRole('button', { name: 'Start the draft with 14 rows' })
    expect(document.activeElement).toBe(go)
    fireEvent.click(radios[1]!)
    expect(on.choose).toHaveBeenCalledWith('every')
    fireEvent.click(go)
    expect(on.confirm).toHaveBeenCalledTimes(1)
    expect(on.cancel).not.toHaveBeenCalled()
  })

  it('Every row ticked: the button says all the rows', () => {
    mount({ choice: 'every' })
    expect(screen.getByRole('button', { name: 'Start the draft with all 23 rows' })).toBeTruthy()
  })

  it('Cancel, Esc and a click outside close it; a click inside does not', () => {
    const on = mount()
    fireEvent.click(screen.getByRole('dialog'))
    expect(on.cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('presentation'))
    expect(on.cancel).toHaveBeenCalledTimes(3)
  })

  it('while the draft is being built, nothing closes it and the choice holds still', () => {
    const on = mount({ busy: true })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('presentation'))
    expect(on.cancel).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).every((r) => r.disabled)).toBe(true)
  })
})
