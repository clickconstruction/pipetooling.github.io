// @vitest-environment jsdom
/**
 * The Case view of the HR file (punch list #315, upgrade 2): the open items by number with who has each, the closed
 * ones folded, the log newest first; Add an item, Close… with its reason, Hand over…, Open again and a log line each
 * go through the case's one door. Made-up items.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PersonCaseView } from './PersonCaseView'
import { writePersonCase } from '../../../lib/people/personCaseIo'
import type { PersonCaseItem, PersonCaseLogLine } from '../../../lib/people/personCase'

vi.mock('../../../lib/people/personCaseIo', () => ({ writePersonCase: vi.fn(async () => ({ ok: true })) }))

const item = (over: Partial<PersonCaseItem> & Pick<PersonCaseItem, 'item_no' | 'title'>): PersonCaseItem => ({ id: `i${over.item_no}`, detail: '', owner_label: '', state: 'open', opened_at: '2026-03-02T18:00:00+00:00', closed_at: null, closed_why: null, author_label: 'Robert', session_label: null, ...over })
const ITEMS: PersonCaseItem[] = [
  item({ item_no: 22, title: 'The OAuth log', owner_label: 'a second session' }),
  item({ item_no: 3, title: 'Pull the March gate logs', detail: 'Both gates.' }),
  item({ item_no: 1, title: 'Ask about Friday', state: 'done', closed_at: '2026-03-10T18:00:00+00:00', closed_why: 'He was off.' }),
]
const LOG: PersonCaseLogLine[] = [
  { id: 'l1', logged_at: '2026-03-02T18:00:00+00:00', line: 'Item 3 opened: Pull the March gate logs', item_no: 3, author_label: 'Robert', session_label: 'bed session' },
  { id: 'l2', logged_at: '2026-03-10T18:00:00+00:00', line: 'Item 1 done: He was off.', item_no: 1, author_label: 'Robert', session_label: null },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function show(over: Partial<Parameters<typeof PersonCaseView>[0]> = {}) {
  const onChanged = vi.fn()
  const showToast = vi.fn()
  render(<PersonCaseView personId="p1" canWrite items={ITEMS} log={LOG} heldWhy={null} onChanged={onChanged} showToast={showToast} {...over} />)
  return { onChanged, showToast }
}
const lastPayload = () => {
  const calls = vi.mocked(writePersonCase).mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('PersonCaseView (punch list #315)', () => {
  it('lists the open items by number with who has each, folds the closed, and reads the log newest first', () => {
    show()
    expect(screen.getByTestId('person-case-view').textContent).toContain('2 open, 1 done.')
    const open = within(screen.getByRole('region', { name: 'Open items' })).getAllByRole('listitem')
    expect(open.map((li) => li.getAttribute('data-case-item'))).toEqual(['3', '22'])
    expect(open[0]?.textContent).toContain('Item 3')
    expect(open[0]?.textContent).toContain('nobody has it yet')
    expect(open[0]?.textContent).toContain('Both gates.')
    expect(open[1]?.textContent).toContain('with a second session')
    expect(screen.getByTestId('case-closed').textContent).toContain('1 closed')
    expect(screen.getByTestId('case-closed').textContent).toContain('done: He was off.')
    const lines = within(screen.getByTestId('case-log')).getAllByRole('listitem')
    expect(lines[0]?.textContent).toContain('Item 1 done: He was off.')
    expect(lines[1]?.textContent).toContain('Robert, bed session')
  })

  it('adds an item through the door, the number left to the file', async () => {
    const { onChanged } = show()
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item' }))
    const form = screen.getByTestId('case-add-item')
    const add = within(form).getByRole('button', { name: 'Add the item' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('What the item is'), { target: { value: ' Call the supply house ' } })
    fireEvent.change(within(form).getByLabelText('Who has it'), { target: { value: 'me' } })
    fireEvent.click(add)
    await waitFor(() => expect(writePersonCase).toHaveBeenCalledTimes(1))
    expect(lastPayload()).toEqual({ person_id: 'p1', items: [{ add: { title: 'Call the supply house', owner: 'me' } }] })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('refuses a carried-over number that is not one, in words', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item' }))
    const form = screen.getByTestId('case-add-item')
    fireEvent.change(within(form).getByLabelText('What the item is'), { target: { value: 'x' } })
    fireEvent.change(within(form).getByLabelText('Its number, if it already has one'), { target: { value: '2a' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add the item' }))
    expect(within(form).getByRole('alert').textContent).toContain('whole number from 1')
    expect(writePersonCase).not.toHaveBeenCalled()
  })

  it('closes an item only with its reason, as done or dropped', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Close Item 3' }))
    const close = screen.getByRole('button', { name: 'Close item 3' }) as HTMLButtonElement
    expect(close.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('How it closes'), { target: { value: 'dropped' } })
    fireEvent.change(screen.getByLabelText('Why it closes'), { target: { value: 'Not needed.' } })
    expect(close.disabled).toBe(false)
    fireEvent.click(close)
    await waitFor(() => expect(writePersonCase).toHaveBeenCalledTimes(1))
    expect(lastPayload()).toEqual({ person_id: 'p1', items: [{ item_no: 3, close: { why: 'Not needed.', state: 'dropped' } }] })
  })

  it('hands an item over, opens a closed one again, and adds a line to the log', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Hand Item 22 over' }))
    const hand = screen.getByRole('button', { name: 'Hand it over' }) as HTMLButtonElement
    expect(hand.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Who has it now'), { target: { value: 'Robert' } })
    fireEvent.click(hand)
    await waitFor(() => expect(lastPayload()).toEqual({ person_id: 'p1', items: [{ item_no: 22, set: { owner: 'Robert' } }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Item 1 again' }))
    await waitFor(() => expect(lastPayload()).toEqual({ person_id: 'p1', items: [{ item_no: 1, reopen: true }] }))
    fireEvent.change(screen.getByLabelText('A line for the log'), { target: { value: 'Read the file end to end.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the line' }))
    await waitFor(() => expect(lastPayload()).toEqual({ person_id: 'p1', log: ['Read the file end to end.'] }))
  })

  it('says why a write was refused and leaves the form open', async () => {
    vi.mocked(writePersonCase).mockResolvedValueOnce({ ok: false, why: 'item 22 already stands on this file' })
    const { showToast, onChanged } = show()
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item' }))
    fireEvent.change(screen.getByLabelText('What the item is'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the item' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Not written: item 22 already stands on this file', 'error'))
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.getByTestId('case-add-item')).toBeTruthy()
  })

  it('with nothing on the case, says so and offers the press; a reader with no write sees no press', () => {
    show({ items: [], log: [] })
    expect(screen.getByRole('region', { name: 'Open items' }).textContent).toContain('Nothing open on this case.')
    expect(screen.getByRole('region', { name: 'The log' }).textContent).toContain('Nothing on the log yet.')
    cleanup()
    show({ items: ITEMS, log: LOG, canWrite: false })
    expect(screen.queryByRole('button', { name: '+ Add an item' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close Item 3' })).toBeNull()
  })

  it('names the reason when the case could not be read', () => {
    show({ heldWhy: 'relation "person_case_items" does not exist' })
    expect(screen.getByTestId('case-held').textContent).toContain('could not be read')
  })
})
