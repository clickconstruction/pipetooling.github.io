// @vitest-environment jsdom
/**
 * The box a look at another person's Task Mode is drawn in (punch list #381): a press that would change something
 * never reaches its own code, a press that only opens or folds does, and a box to type in never keeps the keyboard.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { useState } from 'react'
import { TaskLookGate } from './TaskLookGate'

function Screen({ onAct, onType }: { onAct: (what: string) => void; onType: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <TaskLookGate>
      <button type="button" onClick={() => onAct('done')}>
        Mark done
      </button>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen((o) => !o)} onKeyDown={(e) => (e.key === 'Enter' ? setOpen((o) => !o) : undefined)}>
        Restock the van
      </div>
      <div role="button" tabIndex={0} onClick={() => onAct('row')} onKeyDown={(e) => (e.key === 'Enter' ? onAct('row-key') : undefined)}>
        A row that acts
      </div>
      <label>
        <input type="checkbox" aria-label="Bins filled" onChange={() => onAct('tick')} />
        Bins filled
      </label>
      <form onSubmit={() => onAct('submit')}>
        <textarea aria-label="Note" onChange={onType} onKeyDown={(e) => (e.key === 'Enter' ? onAct('note-key') : undefined)} />
        <button type="submit">Post</button>
      </form>
      {open ? <p>The thread of this task</p> : null}
      {createPortal(
        <button type="button" onClick={() => onAct('sheet')}>
          Send from a sheet
        </button>,
        document.body,
      )}
    </TaskLookGate>
  )
}

describe('TaskLookGate', () => {
  it('stops every press that acts, by pointer and by key', () => {
    const onAct = vi.fn()
    render(<Screen onAct={onAct} onType={() => {}} />)
    fireEvent.click(screen.getByText('Mark done'))
    fireEvent.click(screen.getByText('A row that acts'))
    fireEvent.keyDown(screen.getByText('A row that acts'), { key: 'Enter' })
    fireEvent.click(screen.getByLabelText('Bins filled'))
    fireEvent.click(screen.getByText('Post'))
    fireEvent.submit(screen.getByText('Post').closest('form')!)
    expect(onAct).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Bins filled') as HTMLInputElement).checked).toBe(false)
  })

  it('stops a press on a sheet the screen drew elsewhere on the page', () => {
    const onAct = vi.fn()
    render(<Screen onAct={onAct} onType={() => {}} />)
    fireEvent.click(screen.getByText('Send from a sheet'))
    expect(onAct).not.toHaveBeenCalled()
  })

  it('lets a press that only opens go through, by pointer and by key', () => {
    render(<Screen onAct={() => {}} onType={() => {}} />)
    const title = screen.getByText('Restock the van')
    fireEvent.click(title)
    expect(screen.getByText('The thread of this task')).toBeTruthy()
    fireEvent.keyDown(title, { key: 'Enter' })
    expect(screen.queryByText('The thread of this task')).toBeNull()
  })

  it('takes the keyboard back from a box, and no typing reaches it', () => {
    const onAct = vi.fn()
    const onType = vi.fn()
    render(<Screen onAct={onAct} onType={onType} />)
    const note = screen.getByLabelText('Note') as HTMLTextAreaElement
    note.focus()
    expect(document.activeElement).not.toBe(note)
    fireEvent.keyDown(note, { key: 'Enter' })
    fireEvent.change(note, { target: { value: 'done already' } })
    expect(onAct).not.toHaveBeenCalled()
    expect(onType).not.toHaveBeenCalled()
  })
})
