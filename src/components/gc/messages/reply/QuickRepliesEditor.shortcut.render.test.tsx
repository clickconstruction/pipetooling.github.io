// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { SEED_FLOWS } from '../../../../lib/flows/seed'
import { stepsByKind, type QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { SHORTCUT_WORDS } from '../../../../lib/quickReplies/shortcut'
import { QuickRepliesEditor } from './QuickRepliesEditor'

// Robert is signed in; Rosa wrote the team's lines.
const ME = 'u-robert'
const NAMES = { 'u-robert': 'Robert', 'u-rosa': 'Rosa' }

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-10-01T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('q1', '{first}, here is your bill for {job}. You can pay it here: {bill}', { shortcut: 'bill' }),
  line('q2', '{first}, we are running behind. The new window is {window}.'),
  line('q3', 'Running ten minutes behind.', { for: 'any', scope: 'mine', addedBy: ME, shortcut: 'late' }),
]

function fakeIo(): QuickRepliesIo {
  return {
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
  }
}

async function editor(io: QuickRepliesIo = fakeIo()) {
  renderWithProviders(
    <QuickRepliesEditor io={io} me={ME} steps={stepsByKind(SEED_FLOWS)} names={NAMES} contactNames={{}} initialAdd="" onChanged={vi.fn()} onClose={vi.fn()} />,
  )
  const el = await screen.findByRole('dialog', { name: 'Quick replies' })
  await waitFor(() => expect(el.querySelector('[data-qr-editor-lines]')).toBeTruthy())
  return { el, io }
}

const openLine = (el: HTMLElement, id: string) => {
  fireEvent.click(within(el.querySelector(`[data-qr-editor-row="${id}"]`) as HTMLElement).getAllByRole('button')[0]!)
  return el.querySelector(`[data-qr-open="${id}"]`) as HTMLElement
}

describe('the quick replies editor: a shortcut per line (punch list #126 C)', () => {
  it('marks a line that has a shortcut with its / word', async () => {
    const { el } = await editor()
    expect(el.querySelector('[data-qr-editor-row="q1"] [data-qr-mark="shortcut"]')?.textContent).toBe('/bill')
    expect(el.querySelector('[data-qr-editor-row="q2"] [data-qr-mark="shortcut"]')).toBeNull()
  })

  it('gives a line a shortcut, cleaned, through its own function and not the words’ save', async () => {
    const { el, io } = await editor()
    const opened = openLine(el, 'q2')
    const field = within(opened).getByRole('textbox', { name: SHORTCUT_WORDS.label }) as HTMLInputElement
    expect(field.value).toBe('')
    fireEvent.change(field, { target: { value: ' /Wait' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.setShortcut).toHaveBeenCalledWith('q2', 'wait'))
    expect(io.edit).not.toHaveBeenCalled()
  })

  it('clears a shortcut with a blank', async () => {
    const { el, io } = await editor()
    const opened = openLine(el, 'q1')
    const field = within(opened).getByRole('textbox', { name: SHORTCUT_WORDS.label }) as HTMLInputElement
    expect(field.value).toBe('bill')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.setShortcut).toHaveBeenCalledWith('q1', null))
  })

  it('says why before the Save goes: a word another team line holds, or not one word', async () => {
    const { el, io } = await editor()
    const opened = openLine(el, 'q2')
    const field = within(opened).getByRole('textbox', { name: SHORTCUT_WORDS.label })
    fireEvent.change(field, { target: { value: 'bill' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    expect(within(opened).getByRole('alert').textContent).toBe("/bill is another line's shortcut.")
    fireEvent.change(field, { target: { value: 'two words' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    expect(within(opened).getByRole('alert').textContent).toBe(SHORTCUT_WORDS.bad)
    expect(io.setShortcut).not.toHaveBeenCalled()
    expect(io.edit).not.toHaveBeenCalled()
  })

  it('lets a team line take a word one person’s own line holds', async () => {
    const { el, io } = await editor()
    const opened = openLine(el, 'q2')
    fireEvent.change(within(opened).getByRole('textbox', { name: SHORTCUT_WORDS.label }), { target: { value: 'late' } })
    fireEvent.click(within(opened).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.setShortcut).toHaveBeenCalledWith('q2', 'late'))
  })
})
