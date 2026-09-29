// @vitest-environment jsdom
/**
 * Render smoke for the Delete bid window (punch list #51, PR 5): what it asks for, the confirm
 * button held until the project name is typed (spaces around it forgiven), a bid with no project
 * name confirmed with the field empty, everything held while the delete runs, the error, and the
 * two buttons' calls. The page's own cases (`Bids.render.test.tsx` → *Edit Bid writes*) pin what
 * a delete writes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BidDeleteConfirmModal } from './BidDeleteConfirmModal'

afterEach(() => cleanup())

function setup(over: Partial<Parameters<typeof BidDeleteConfirmModal>[0]> = {}) {
  const props = {
    projectName: 'Pondhill Building 2' as string | null,
    confirmValue: '',
    onConfirmValueChange: vi.fn(),
    error: null as string | null,
    deleting: false,
    onDelete: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
  render(<BidDeleteConfirmModal {...props} />)
  return props
}
const confirm = () => screen.getByRole('button', { name: /^(Delete bid|Deleting…)$/ }) as HTMLButtonElement
const cancel = () => screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement
const field = () => screen.getByRole('textbox') as HTMLInputElement

describe('BidDeleteConfirmModal', () => {
  it('asks for the project name and holds the delete until it matches', () => {
    setup({ confirmValue: 'Pondhill' })
    expect(screen.getByText('Pondhill Building 2').tagName).toBe('STRONG')
    expect(field().placeholder).toBe('Project name')
    expect(confirm().disabled).toBe(true)
    cleanup()
    const p = setup({ confirmValue: '  Pondhill Building 2 ' })
    expect(confirm().disabled).toBe(false)
    fireEvent.click(confirm())
    expect(p.onDelete).toHaveBeenCalledTimes(1)
  })

  it('reports what is typed', () => {
    const p = setup()
    fireEvent.change(field(), { target: { value: 'Pond' } })
    expect(p.onConfirmValueChange).toHaveBeenCalledWith('Pond')
  })

  it('a bid with no project name is confirmed with the field empty', () => {
    setup({ projectName: null })
    expect(screen.getByText('This bid has no project name; leave the field empty to confirm.')).toBeTruthy()
    expect(field().placeholder).toBe('No project name')
    expect(confirm().disabled).toBe(false)
  })

  it('while the delete runs everything is held and the button says so', () => {
    const p = setup({ confirmValue: 'Pondhill Building 2', deleting: true })
    expect(confirm().textContent).toBe('Deleting…')
    expect(confirm().disabled).toBe(true)
    expect(cancel().disabled).toBe(true)
    expect(field().disabled).toBe(true)
    fireEvent.click(cancel())
    expect(p.onCancel).not.toHaveBeenCalled()
  })

  it('shows the error, and Cancel calls cancel', () => {
    const p = setup({ error: 'permission denied' })
    expect(screen.getByText('permission denied')).toBeTruthy()
    fireEvent.click(cancel())
    expect(p.onCancel).toHaveBeenCalledTimes(1)
    expect(p.onDelete).not.toHaveBeenCalled()
  })
})
