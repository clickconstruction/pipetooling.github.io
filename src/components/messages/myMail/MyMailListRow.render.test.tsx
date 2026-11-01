// @vitest-environment jsdom
/**
 * One mail of the My email list (punch list #230 PR 3) over made-up rows: the way, who with the address, the subject
 * with the files and the snippet, the day, and each last column the mock-up draws, a guess with Yes and other…, no
 * guess with Tag…, a tagged conversation with ✓ and open the line ›, a box's line on a job; the presses each reach
 * their handler, a row being tagged waits, and a phone draws the row in one column.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { MY_MAIL_NOW, MY_MAIL_ROWS } from '../../../test/myMailRows'
import { MyMailListRow, type MyMailListRowProps } from './MyMailListRow'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const byId = (id: string) => MY_MAIL_ROWS.find((r) => r.gmailId === id)!

function draw(id: string, more: Partial<MyMailListRowProps> = {}) {
  const presses = { onOpen: vi.fn(), onYes: vi.fn(), onPick: vi.fn() }
  renderWithProviders(<MyMailListRow row={byId(id)} phone={false} nowIso={MY_MAIL_NOW} busy={false} {...presses} {...more} />)
  return { presses, row: document.querySelector(`[data-my-mail-row="${id}"]`) as HTMLElement }
}

describe('MyMailListRow', () => {
  it('draws a guessed mail with its chip, Yes and other…, and each press reaches its handler', () => {
    const { presses, row } = draw('dale-new')
    const r = within(row)
    expect(r.getByRole('img', { name: 'It came in' }).textContent).toBe('↓')
    expect(r.getByText('Dale Okafor')).toBeTruthy()
    expect(r.getByText('dale@ridgeway.example')).toBeTruthy()
    expect(r.getByText('Re: 4 Elm Ct water heater')).toBeTruthy()
    expect(r.getByLabelText('1 file').textContent).toBe('📎 1')
    expect(r.getByText('9:12 AM')).toBeTruthy()
    expect(row.querySelector('[data-my-mail-chip="guess"]')?.textContent).toBe('JP1077 · 4 Elm Ct?')
    fireEvent.click(r.getByRole('button', { name: 'Yes' }))
    expect(presses.onYes).toHaveBeenCalledTimes(1)
    fireEvent.click(r.getByRole('button', { name: 'other…' }))
    expect(presses.onPick).toHaveBeenCalledTimes(1)
    fireEvent.click(r.getByTestId('my-mail-open'))
    expect(presses.onOpen).toHaveBeenCalledTimes(1)
  })

  it('names who a mail out went to, and offers Tag… on a mail with no guess', () => {
    draw('priya-out')
    expect(screen.getByRole('img', { name: 'You sent it' }).textContent).toBe('↑')
    expect(screen.getByText('to Priya Nair')).toBeTruthy()
    expect(screen.getByText('Sat, Oct 31')).toBeTruthy()
    cleanup()
    const { presses } = draw('harlan')
    expect(screen.getByText('no guess')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tag…' }))
    expect(presses.onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull()
  })

  it('draws a tagged conversation with ✓ and open the line ›, which opens the reader', () => {
    const { presses, row } = draw('dale-old')
    expect(row.querySelector('[data-my-mail-chip="tagged"]')?.textContent).toBe('✓ JP1077 · 4 Elm Ct')
    fireEvent.click(within(row).getByRole('button', { name: 'open the line ›' }))
    expect(presses.onOpen).toHaveBeenCalledTimes(1)
    expect(within(row).queryByRole('button', { name: 'Yes' })).toBeNull()
  })

  it('reads a mail a box holds on a job as already in Messages, with nothing to press', () => {
    const { row } = draw('box')
    expect(row.querySelector('[data-my-mail-chip="in-messages"]')?.textContent).toBe('already in Messages ✓')
    expect(within(row.querySelector('[data-my-mail-end]') as HTMLElement).queryAllByRole('button')).toEqual([])
  })

  it('waits while its conversation is being tagged', () => {
    draw('dale-new', { busy: true })
    expect(screen.getByText('Tagging…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull()
  })

  it('on a phone draws the row in one column, the last column under the words', () => {
    const { row } = draw('dale-new', { phone: true })
    expect(row.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    expect((row.querySelector('[data-my-mail-end]') as HTMLElement).style.justifyContent).toBe('flex-start')
  })
})
