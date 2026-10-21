// @vitest-environment jsdom
/**
 * Punch list #140 PR 7: the reply box's fourth kind, Call. Over a fake io: the kind offers the number to dial, takes
 * what they said and the day they gave, and saves through `logCall` as their move; nothing saves without words; Our
 * move writes what we still owe after the call; a refused save keeps the words and says why; a job's box that was
 * given its kinds offers no Call.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import { CALL_WORDS } from '../../../../lib/messages/callLog'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))

// Cut 2's hooks read Follow up's store; here they are held still, with Our move's write a spy.
const cut2 = vi.hoisted(() => ({
  settling: { active: false, owed: null as unknown, cancel: () => {}, done: (_note: string, _job: string | null) => Promise.resolve() },
  owed: { owed: null as unknown, loaded: true },
  after: { mark: vi.fn((_what: string, _day: unknown) => Promise.resolve()), sentDone: (_id: string) => Promise.resolve() },
}))
vi.mock('../../../followUp/useOwedSettling', () => ({ useOwedSettling: () => cut2.settling }))
vi.mock('../../../followUp/useThreadOwed', () => ({ useThreadOwed: () => cut2.owed, useOwedAfterSend: () => cut2.after }))

const fakeIo = (over: Partial<ReplyIo> = {}): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note-new')),
  sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
  sendText: vi.fn(() => Promise.resolve('m-text-new')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
  ...over,
})

const fakeQuick = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve([])),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
  setShortcut: vi.fn(() => Promise.resolve(1)),
})

function box(more: { io?: ReplyIo; kinds?: readonly ('text' | 'email' | 'note' | 'call')[]; job?: { key: string; name: string } } = {}) {
  const io = more.io ?? fakeIo()
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
        <ReplyBox contact={contact} io={io} quickIo={fakeQuick()} kinds={more.kinds} job={more.job} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { io, reread, contact, el: document.querySelector('[data-reply-box]') as HTMLElement }
}

afterEach(() => {
  cleanup()
  cut2.after.mark.mockClear()
})

describe('ReplyBox: the Call kind (punch list #140 PR 7)', () => {
  it('offers Call fourth, with their number to dial, and saves what they said with the day they gave as their move', async () => {
    const { io, reread, el } = box()
    const kinds = within(el).getAllByRole('radio').map((r) => r.textContent)
    expect(kinds).toEqual(['Text', 'Email', 'Note', 'Call'])
    fireEvent.click(within(el).getByRole('radio', { name: 'Call' }))
    expect(el.querySelector('textarea')!.getAttribute('data-reply-look')).toBe('call')
    const dial = el.querySelector('[data-reply-call-dial]') as HTMLAnchorElement
    expect(dial.getAttribute('href')).toMatch(/^tel:\+?\d+$/)
    expect(within(el).getByText('they gave a day · their move clears the row')).toBeTruthy()
    expect(within(el).getByText(CALL_WORDS.hint)).toBeTruthy()

    fireEvent.change(within(el).getByRole('textbox', { name: CALL_WORDS.said }), { target: { value: 'Thursday works' } })
    fireEvent.click(within(el).getByRole('button', { name: CALL_WORDS.dayPress }))
    const typed = within(el).getByRole('textbox', { name: CALL_WORDS.dayTyped })
    fireEvent.change(typed, { target: { value: 'in two weeks' } })
    fireEvent.keyDown(typed, { key: 'Enter' })
    expect(el.querySelector('[data-reply-call-day-words]')!.textContent).toMatch(/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}$/)

    fireEvent.click(within(el).getByRole('button', { name: CALL_WORDS.save }))
    await waitFor(() => expect(io.logCall).toHaveBeenCalledTimes(1))
    const [contactId, draft, jobKey] = (io.logCall as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { said: string; day: { ymd: string | null; words: string | null } | null; theirMove: boolean }, string | null]
    expect(contactId).toBe('c-greg')
    expect(draft.said).toBe('Thursday works')
    expect(draft.theirMove).toBe(true)
    expect(draft.day?.ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(draft.day?.words).toBeNull()
    expect(jobKey).toBe('project:proj-stoneoak')
    expect(await screen.findByText('Call saved. Only the team sees it.')).toBeTruthy()
    expect(reread).toHaveBeenCalled()
    expect((within(el).getByRole('textbox', { name: CALL_WORDS.said }) as HTMLTextAreaElement).value).toBe('')
    expect(cut2.after.mark).not.toHaveBeenCalled()
  })

  it('saves nothing without their words', async () => {
    const { io, el } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Call' }))
    fireEvent.click(within(el).getByRole('button', { name: CALL_WORDS.save }))
    expect(await screen.findByText(CALL_WORDS.needWords)).toBeTruthy()
    expect(io.logCall).not.toHaveBeenCalled()
  })

  it('Our move writes what we still owe after the call is saved', async () => {
    const { io, el } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Call' }))
    fireEvent.change(within(el).getByRole('textbox', { name: CALL_WORDS.said }), { target: { value: 'She wants the revised quote' } })
    fireEvent.click(within(el).getByRole('radio', { name: 'Our move' }))
    fireEvent.change(within(el).getByRole('textbox', { name: 'What we still owe' }), { target: { value: 'the revised quote' } })
    fireEvent.change(within(el).getByRole('textbox', { name: 'By when' }), { target: { value: 'Friday' } })
    fireEvent.click(within(el).getByRole('button', { name: CALL_WORDS.save }))
    await waitFor(() => expect(io.logCall).toHaveBeenCalledTimes(1))
    expect((io.logCall as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ said: 'She wants the revised quote', theirMove: false })
    await waitFor(() => expect(cut2.after.mark).toHaveBeenCalledWith('the revised quote', expect.objectContaining({ ymd: expect.any(String) })))
    expect(await screen.findByText(/Call saved\. Only the team sees it\. Marked: we owe Greg Paulk the revised quote\./)).toBeTruthy()
  })

  it('keeps the words and says why when the save is refused', async () => {
    const io = fakeIo({ logCall: vi.fn(() => Promise.reject(new Error('Only the office team can log a call.'))) })
    const { el } = box({ io })
    fireEvent.click(within(el).getByRole('radio', { name: 'Call' }))
    fireEvent.change(within(el).getByRole('textbox', { name: CALL_WORDS.said }), { target: { value: 'Thursday works' } })
    fireEvent.click(within(el).getByRole('button', { name: CALL_WORDS.save }))
    expect(await screen.findByText('Only the office team can log a call.')).toBeTruthy()
    expect((within(el).getByRole('textbox', { name: CALL_WORDS.said }) as HTMLTextAreaElement).value).toBe('Thursday works')
  })

  it('a box given its kinds, as a job’s window gives them, offers no Call', () => {
    const { el } = box({ kinds: ['text', 'email'], job: { key: 'project:proj-stoneoak', name: 'Stone Oak' } })
    expect(within(el).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Text', 'Email'])
  })
})
