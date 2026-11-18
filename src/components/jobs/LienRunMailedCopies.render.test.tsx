// @vitest-environment jsdom
/**
 * What was mailed, on one row of the run's checklist (v2.7525): a listed file has Take off beside it, the press asks
 * first and says the file stays in Drive, and only the named answer takes it off.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LienRunMailedCopies from './LienRunMailedCopies'
import type { LienRunRow } from '../../lib/jobs/lienRunChecklist'
import type { LienMailedCopy } from '../../lib/jobs/lienMailedCopies'

afterEach(cleanup)

const copy = (n: number): LienMailedCopy => ({ url: `https://drive.google.com/file/d/f${n}/view`, driveFileId: `f${n}`, name: `Lien notice as mailed · 650 · 2026-11-16${n > 1 ? ` · ${n}` : ''}.pdf`, at: '2026-11-16T18:00:00.000Z', by: 'u1' })
const row = (mailedCopies: LienMailedCopy[]): LienRunRow => ({
  itemId: 'it1',
  jobId: 'j650',
  jobNumber: '650',
  label: '650 · AXO Schertz',
  street: '',
  recipients: [],
  amount: 33_500,
  printed: { at: '2026-11-15T15:00:00.000Z', by: null },
  signed: 'not_needed',
  mailed: null,
  waitsOn: 'mail',
  line: 'printed · not mailed',
  held: null,
  nothingToClaim: false,
  leader: null,
  paperless: false,
  mailedCopies,
})

describe('LienRunMailedCopies · take a file off the list (v2.7525)', () => {
  it('Take off asks first under the files, and only Take it off hands the file to the press', () => {
    const onRemove = vi.fn()
    render(<LienRunMailedCopies row={row([copy(1), copy(2)])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, onRemove, removingItemId: null }} />)
    expect(screen.queryByTestId('run-check-copy-ask-it1')).toBeNull()
    const off = screen.getByTestId('run-check-copy-off-it1-1')
    expect([off.textContent, off.getAttribute('aria-label')]).toEqual(['Take off', `Take off: ${copy(2).name}`])
    fireEvent.click(off)
    const ask = screen.getByTestId('run-check-copy-ask-it1')
    expect(ask.textContent).toContain(`Take ${copy(2).name} off this notice? The file goes to Drive’s trash. Drive keeps it there 30 days.`)
    expect([screen.getByTestId('run-check-copy-off-yes-it1').textContent, screen.getByTestId('run-check-copy-off-no-it1').textContent]).toEqual(['Take it off', 'Keep it'])
    // While the ask is open no other file can be asked about, and no file can be added.
    expect((screen.getByTestId('run-check-copy-off-it1-0') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('run-check-copy-add-it1') as HTMLButtonElement).disabled).toBe(true)
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('run-check-copy-off-yes-it1'))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove.mock.calls[0]![1]).toEqual(copy(2))
    expect(screen.queryByTestId('run-check-copy-ask-it1')).toBeNull()
  })

  it('Keep it closes the ask and takes nothing off', () => {
    const onRemove = vi.fn()
    render(<LienRunMailedCopies row={row([copy(1)])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, onRemove, removingItemId: null }} />)
    fireEvent.click(screen.getByTestId('run-check-copy-off-it1-0'))
    fireEvent.click(screen.getByTestId('run-check-copy-off-no-it1'))
    expect(screen.queryByTestId('run-check-copy-ask-it1')).toBeNull()
    expect(onRemove).not.toHaveBeenCalled()
    expect((screen.getByTestId('run-check-copy-off-it1-0') as HTMLButtonElement).disabled).toBe(false)
  })

  it('the files show with no Take off where the run gives no way to take one off, and with no press where the paper has not printed', () => {
    const { unmount } = render(<LienRunMailedCopies row={row([copy(1)])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null }} />)
    expect(screen.queryByTestId('run-check-copy-off-it1-0')).toBeNull()
    expect(screen.getByTestId('run-check-copy-add-it1').textContent).toBe('Add another')
    unmount()
    // Taken back after a scan was added: the file is still listed and can come off, but nothing is added until it prints again.
    render(<LienRunMailedCopies row={row([copy(1)])} canAdd={false} busy={false} press={{ onAdd: () => {}, addingItemId: null, onRemove: () => {}, removingItemId: null }} />)
    expect(screen.queryByTestId('run-check-copy-add-it1')).toBeNull()
    expect(screen.getByTestId('run-check-copy-off-it1-0').textContent).toBe('Take off')
    expect(screen.getByTestId('run-check-copies-it1').querySelector('a')!.getAttribute('href')).toBe(copy(1).url)
  })

  it('while a file is coming off, the row says so and every press on it is dead', () => {
    render(<LienRunMailedCopies row={row([copy(1)])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, onRemove: () => {}, removingItemId: 'it1' }} />)
    expect(screen.getByRole('status').textContent).toBe('Taking it off…')
    expect((screen.getByTestId('run-check-copy-off-it1-0') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('run-check-copy-add-it1') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('LienRunMailedCopies · a file that did not go up (v2.7635)', () => {
  it('leaves the reason under the row with Try again, and the press sends the row back', () => {
    const onRetry = vi.fn()
    render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, failed: { itemId: 'it1', words: 'The app could not reach Drive.', retry: true }, onRetry }} />)
    const failed = screen.getByTestId('run-check-copy-failed-it1')
    expect(failed.getAttribute('role')).toBe('alert')
    expect(failed.textContent).toContain('The app could not reach Drive.')
    fireEvent.click(screen.getByTestId('run-check-copy-retry-it1'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'it1' }))
  })

  it('shows a refusal with its reason and no Try again', () => {
    render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, failed: { itemId: 'it1', words: 'Drive did not take the file. Drive said: quota exceeded.', retry: false }, onRetry: () => {} }} />)
    expect(screen.getByTestId('run-check-copy-failed-it1').textContent).toContain('Drive said: quota exceeded.')
    expect(screen.queryByTestId('run-check-copy-retry-it1')).toBeNull()
  })

  it('draws nothing for another row’s failure, and hides the reason while the file goes again', () => {
    const { rerender } = render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, failed: { itemId: 'other', words: 'x', retry: true } }} />)
    expect(screen.queryByTestId('run-check-copy-failed-it1')).toBeNull()
    rerender(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: 'it1', failed: { itemId: 'it1', words: 'x', retry: true } }} />)
    expect(screen.queryByTestId('run-check-copy-failed-it1')).toBeNull()
  })
})

describe('LienRunMailedCopies · where a taken-off file went (v2.7699)', () => {
  it('says the file is in Drive’s trash and offers Put it back, with no second try', () => {
    const onPutBack = vi.fn()
    render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, off: { itemId: 'it1', words: 'Taken off. The file is in Drive’s trash.', canRetry: false, working: null }, onPutBack, onTrashAgain: () => {} }} />)
    const line = screen.getByTestId('run-check-copy-off-line-it1')
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toContain('Taken off. The file is in Drive’s trash.')
    expect(screen.queryByTestId('run-check-copy-trash-again-it1')).toBeNull()
    fireEvent.click(screen.getByTestId('run-check-copy-put-back-it1'))
    expect(onPutBack).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'it1' }))
  })

  it('says why a file stays in Drive, and offers the trash a second try where one can help', () => {
    const onTrashAgain = vi.fn()
    render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, off: { itemId: 'it1', words: 'Taken off. The file stays in Drive. Drive did not move the file to its trash. Drive said: Error 503 (Service Unavailable)', canRetry: true, working: null }, onPutBack: () => {}, onTrashAgain }} />)
    expect(screen.getByTestId('run-check-copy-off-line-it1').textContent).toContain('The file stays in Drive.')
    fireEvent.click(screen.getByTestId('run-check-copy-trash-again-it1'))
    expect(onTrashAgain).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('run-check-copy-put-back-it1').textContent).toBe('Put it back')
  })

  it('shows what is under way with no press, and draws nothing for another row', () => {
    const { rerender } = render(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, off: { itemId: 'it1', words: 'x', canRetry: true, working: 'back' }, onPutBack: () => {}, onTrashAgain: () => {} }} />)
    expect(screen.getByTestId('run-check-copy-off-line-it1').textContent).toBe('Putting it back…')
    expect(screen.queryByTestId('run-check-copy-put-back-it1')).toBeNull()
    expect(screen.queryByTestId('run-check-copy-trash-again-it1')).toBeNull()
    rerender(<LienRunMailedCopies row={row([])} canAdd busy={false} press={{ onAdd: () => {}, addingItemId: null, off: { itemId: 'other', words: 'x', canRetry: false, working: null }, onPutBack: () => {} }} />)
    expect(screen.queryByTestId('run-check-copy-off-line-it1')).toBeNull()
  })
})
