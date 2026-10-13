// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import { OWED_DONE_PLACEHOLDER, type Owed } from '../../../../lib/messages/owed'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

// Cut 2's hooks read Follow up's store; here they are held still, so the smoke checks the box's wiring.
const cut2 = vi.hoisted(() => ({
  settling: { active: false, owed: null as unknown, cancel: () => {}, done: (_note: string, _job: string | null) => Promise.resolve() },
  owed: { owed: null as unknown, loaded: true },
  after: { mark: (_what: string, _day: unknown) => Promise.resolve(), sentDone: (_id: string) => Promise.resolve() },
}))
vi.mock('../../../followUp/useOwedSettling', () => ({ useOwedSettling: () => cut2.settling }))
vi.mock('../../../followUp/useThreadOwed', () => ({ useThreadOwed: () => cut2.owed, useOwedAfterSend: () => cut2.after }))

const OWED: Owed = { what: 'the revised quote', byYmd: null, byWords: null, markedBy: 'Rosa', markedAt: '2026-10-01T15:00:00.000Z' }

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note-new')),
  sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
  sendText: vi.fn(() => Promise.resolve('m-text-new')),
})

const fakeQuick = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve([])),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
})

function box() {
  const io = fakeIo()
  const reread = vi.fn()
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === 'c-greg')!
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === 'c-greg'),
    jobFilter: null,
    rail: view.rails['c-greg'] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={open}>
        <ReplyBox contact={contact} io={io} quickIo={fakeQuick()} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { io, reread, el: document.querySelector('[data-reply-box]') as HTMLElement }
}

async function openEmailWindow(el: HTMLElement, words: string) {
  fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
  fireEvent.change(within(el).getByRole('textbox'), { target: { value: words } })
  fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
  const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
  const send = within(win).getByRole('button', { name: 'Send as email' }) as HTMLButtonElement
  await waitFor(() => expect(send.disabled).toBe(false))
  return { win, send }
}

beforeEach(() => {
  localStorage.clear()
  cut2.settling = { active: false, owed: null, cancel: vi.fn(), done: vi.fn(() => Promise.resolve()) }
  cut2.owed = { owed: null, loaded: true }
  cut2.after = { mark: vi.fn(() => Promise.resolve()), sentDone: vi.fn(() => Promise.resolve()) }
})

describe('cut 2 in the reply box (Messages, cut 3, R3)', () => {
  it('gives a note a day to come back, then folds the day away when the note goes', async () => {
    const { el, io } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    fireEvent.click(within(el).getByRole('button', { name: '↩ Bring it back on a day…' }))
    const days = el.querySelector('[data-note-back-day]') as HTMLElement
    fireEvent.click(days.querySelector('button[aria-pressed]') as HTMLElement)
    expect(within(days).getByRole('button', { name: 'No day ×' })).toBeTruthy()
    fireEvent.change(within(el).getByRole('textbox', { name: 'A note for the team' }), { target: { value: 'Greg calls back after lunch.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Add the note' }))
    await waitFor(() => expect(io.addNote).toHaveBeenCalledWith('c-greg', 'Greg calls back after lunch.', 'project:proj-stoneoak', expect.objectContaining({ words: null })))
    const back = (io.addNote as ReturnType<typeof vi.fn>).mock.calls[0]?.[3] as { ymd: string | null }
    expect(back.ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await screen.findByText(/It comes back to Follow up/)).toBeTruthy()
    expect(el.querySelector('[data-note-back-day]')).toBeNull()
    expect(within(el).getByRole('button', { name: '↩ Bring it back on a day…' })).toBeTruthy()
  })

  it('folds the day away again on No day ×', () => {
    const { el } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    fireEvent.click(within(el).getByRole('button', { name: '↩ Bring it back on a day…' }))
    const days = el.querySelector('[data-note-back-day]') as HTMLElement
    fireEvent.click(days.querySelector('button[aria-pressed]') as HTMLElement)
    fireEvent.click(within(days).getByRole('button', { name: 'No day ×' }))
    expect(el.querySelector('[data-note-back-day]')).toBeNull()
  })

  it('settles what we owe with a team note: the note’s words, Done with this note, and no empty note', async () => {
    cut2.settling = { active: true, owed: OWED, cancel: vi.fn(), done: vi.fn(() => Promise.resolve()) }
    const { el, reread } = box()
    expect(el.querySelector('[data-settling-note]')).toBeTruthy()
    expect(within(el).getByRole('radio', { name: 'Note' }).getAttribute('aria-checked')).toBe('true')
    const note = within(el).getByRole('textbox', { name: 'A note for the team' })
    expect(note.getAttribute('placeholder')).toBe(OWED_DONE_PLACEHOLDER)
    fireEvent.click(within(el).getByRole('button', { name: 'Done, with this note' }))
    expect(within(el).getByRole('alert').textContent).toBe('Say how it got done, or press Not done yet.')
    expect(cut2.settling.done).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: 'Sent it by email this morning.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Done, with this note' }))
    await waitFor(() => expect(cut2.settling.done).toHaveBeenCalledWith('Sent it by email this morning.', 'project:proj-stoneoak'))
    expect(await screen.findByText(/Done, with the note for the team/)).toBeTruthy()
    expect(reread).toHaveBeenCalledTimes(1)
  })

  it('says After this sends with what we owe, and a send that gets it done says so', async () => {
    cut2.owed = { owed: OWED, loaded: true }
    const { el } = box()
    const { win, send } = await openEmailWindow(el, 'The revised quote is attached.')
    const row = win.querySelector('[data-after-send]') as HTMLElement
    expect(row.getAttribute('data-after-send')).toBe('ours')
    expect(row.textContent).toContain('We still owe the revised quote.')
    fireEvent.click(within(row).getByRole('radio', { name: 'Their move' }))
    expect(row.textContent).toContain('This message gets the revised quote done.')
    fireEvent.click(send)
    await waitFor(() => expect(cut2.after.sentDone).toHaveBeenCalledWith('m-email-new'))
    expect(await screen.findByText(/Its copy is kept in Documents\. It is done\./)).toBeTruthy()
  })

  it('marks what we still owe from the two blanks when nothing is owed yet', async () => {
    const { el } = box()
    const { win, send } = await openEmailWindow(el, 'We will send the numbers.')
    const row = win.querySelector('[data-after-send]') as HTMLElement
    expect(row.getAttribute('data-after-send')).toBe('theirs')
    expect(row.textContent).toContain('Nothing is on us.')
    fireEvent.click(within(row).getByRole('radio', { name: 'Our move' }))
    fireEvent.change(within(row).getByRole('textbox', { name: 'What we still owe' }), { target: { value: 'the numbers' } })
    fireEvent.change(within(row).getByRole('textbox', { name: 'By when' }), { target: { value: 'whenever' } })
    expect(row.textContent).toContain('Kept as typed, with no day.')
    fireEvent.click(send)
    await waitFor(() => expect(cut2.after.mark).toHaveBeenCalledWith('the numbers', { ymd: null, words: 'whenever' }))
  })

  it('keeps the message sent and says why when what we owe is refused after it', async () => {
    cut2.owed = { owed: OWED, loaded: true }
    cut2.after = { mark: vi.fn(() => Promise.resolve()), sentDone: vi.fn(() => Promise.reject(new Error('Nothing is owed to them now.'))) }
    const { el, io } = box()
    const { win, send } = await openEmailWindow(el, 'The revised quote is attached.')
    fireEvent.click(within(win.querySelector('[data-after-send]') as HTMLElement).getByRole('radio', { name: 'Their move' }))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendEmail).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Nothing is owed to them now.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Before it goes, this is what they see' })).toBeNull())
  })

  it('waits for what we owe before it shows After this sends', async () => {
    cut2.owed = { owed: null, loaded: false }
    const { el } = box()
    const { win } = await openEmailWindow(el, 'Hello.')
    expect(win.querySelector('[data-after-send]')).toBeNull()
  })
})
