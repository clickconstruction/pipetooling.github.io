// @vitest-environment jsdom
/**
 * The job form's close-flush banner and footer as a component. Pins the seam — which buttons each
 * mode draws (new, edit, the Job window, a phone), the autosave line, the undo confirm, the
 * failed-close banner's three choices — and that every button calls the shell's callback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobFormFooter, type JobFormFooterProps } from './JobFormFooter'

afterEach(() => {
  cleanup()
})

function footerProps(over: Partial<JobFormFooterProps> = {}): JobFormFooterProps {
  return {
    editing: true,
    narrowViewport: false,
    embedded: false,
    showDelete: true,
    deleting: false,
    migratingJob: false,
    closeFlushState: 'idle',
    editAutosaveAggregate: 'saved',
    undoAvailable: true,
    undoConfirmOpen: false,
    jobFormCanSubmit: true,
    jobFormMissingFields: [],
    saving: false,
    onClose: vi.fn(),
    onKeepEditing: vi.fn(),
    onCloseWithoutSaving: vi.fn(),
    onDelete: vi.fn(),
    onUndo: vi.fn(),
    onUndoConfirmOpenChange: vi.fn(),
    onCreateJob: vi.fn(),
    ...over,
  }
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

describe('JobFormFooter', () => {
  it('edit mode: Delete, Undo changes, the autosave line and Close, each wired to the shell', () => {
    const props = footerProps()
    renderWithProviders(<JobFormFooter {...props} />)
    expect(screen.getByText('All changes saved')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Job' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(button('Delete'))
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Undo changes'))
    expect(props.onUndoConfirmOpenChange).toHaveBeenCalledWith(true)
    fireEvent.click(button('Close'))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('the undo confirm replaces the Undo button; Revert and Keep wire through', () => {
    const props = footerProps({ undoConfirmOpen: true })
    renderWithProviders(<JobFormFooter {...props} />)
    expect(screen.getByText('Revert everything since opening?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo changes' })).toBeNull()
    fireEvent.click(button('Revert'))
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Keep'))
    expect(props.onUndoConfirmOpenChange).toHaveBeenCalledWith(false)
  })

  it('nothing to undo, a delete in flight and a close in flight disable their buttons', () => {
    renderWithProviders(<JobFormFooter {...footerProps({ undoAvailable: false, deleting: true, closeFlushState: 'saving', editAutosaveAggregate: 'error' })} />)
    expect(button('Undo changes').disabled).toBe(true)
    expect(button('Undo changes').title).toBe('Nothing to undo')
    expect(button('Deleting…').disabled).toBe(true)
    expect(button('Saving…').disabled).toBe(true)
    expect(screen.getByText('Autosave failed — edit the field again to retry')).toBeTruthy()
    cleanup()
    renderWithProviders(<JobFormFooter {...footerProps({ migratingJob: true })} />)
    expect(button('Delete').disabled).toBe(true)
  })

  it('new job: Cancel and Create Job, no Delete, Undo or autosave line; the missing fields hold Create', () => {
    const props = footerProps({ editing: false, showDelete: false })
    renderWithProviders(<JobFormFooter {...props} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo changes' })).toBeNull()
    expect(screen.queryByText('All changes saved')).toBeNull()
    fireEvent.click(button('Cancel'))
    expect(props.onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Create Job'))
    expect(props.onCreateJob).toHaveBeenCalledTimes(1)
    cleanup()
    renderWithProviders(<JobFormFooter {...footerProps({ editing: false, showDelete: false, jobFormCanSubmit: false, jobFormMissingFields: ['Job name', 'Customer'] })} />)
    expect(screen.getByText('Required:')).toBeTruthy()
    expect(screen.getByText('Job name')).toBeTruthy()
    expect(button('Create Job').disabled).toBe(true)
    expect(button('Create Job').title).toBe('Required: Job name, Customer')
    cleanup()
    renderWithProviders(<JobFormFooter {...footerProps({ editing: false, showDelete: false, jobFormCanSubmit: false, jobFormMissingFields: ['Job name'], saving: true })} />)
    expect(screen.queryByText('Required:')).toBeNull()
    expect(button('Creating…').disabled).toBe(true)
  })

  it('in the Job window the footer has no Close; off the Edit region it has no Delete either', () => {
    renderWithProviders(<JobFormFooter {...footerProps({ embedded: true, showDelete: false, editAutosaveAggregate: 'pending' })} />)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(button('Undo changes')).toBeTruthy()
    expect(screen.getByText('Unsaved changes…')).toBeTruthy()
  })

  it('on a phone in edit mode the Undo is short and the confirm sits above the button row', () => {
    renderWithProviders(<JobFormFooter {...footerProps({ narrowViewport: true, editAutosaveAggregate: 'blocked' })} />)
    expect(button('Undo')).toBeTruthy()
    expect(button('Delete')).toBeTruthy()
    expect(button('Close')).toBeTruthy()
    expect(screen.getByText('Waiting on required fields')).toBeTruthy()
    cleanup()
    renderWithProviders(<JobFormFooter {...footerProps({ narrowViewport: true, undoConfirmOpen: true })} />)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(button('Revert')).toBeTruthy()
    cleanup()
    // New Job on a phone keeps the desktop row.
    renderWithProviders(<JobFormFooter {...footerProps({ narrowViewport: true, editing: false, showDelete: false })} />)
    expect(button('Create Job')).toBeTruthy()
  })

  it('a failed close shows the banner with its three choices', () => {
    const props = footerProps({ closeFlushState: 'error' })
    renderWithProviders(<JobFormFooter {...props} />)
    expect(screen.getByRole('alert').textContent).toMatch(/could not be saved/)
    fireEvent.click(button('Retry and close'))
    expect(props.onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Keep editing'))
    expect(props.onKeepEditing).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Close without saving'))
    expect(props.onCloseWithoutSaving).toHaveBeenCalledTimes(1)
  })
})
